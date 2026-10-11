import type { AutorizacionFacturacion, Dispositivo, EstadoAutorizacion } from '../../lib/db'
import { formatearNumero, necesitaRevision } from '../../lib/autorizaciones'
import { diasDeCalendario, DIAS_AVISO_VENCIMIENTO, fechaCorta, textoVencimiento } from '../../lib/vencimiento'
import { normalizarTexto } from '../soluciones/iconosSoluciones'
import type { ItemPendiente } from '../inicio/pendientes'

// AUTORIZACIONES DE FACTURACIÓN EN LA AGENDA, EN LA FICHA DEL POS Y AL
// GUARDAR (tarea 321, encargo del 2026-10-10, fase C).
//
// LA AGENDA SOLO AVISA DE LO CONFIABLE. Sigue siendo una vista derivada,
// no un gestor de tareas, y de una autorización deriva como mucho dos
// avisos, los dos solo si está CONFIRMADA (con su verificación) y
// asociada a un POS que existe:
//   - VENCIMIENTO: con su `vencimientoConfirmado`, dentro del mismo aviso
//     que un acceso de la Bóveda (`DIAS_AVISO_VENCIMIENTO`, 30 días) o ya
//     vencida. Texto: "Vence el 12 nov", "Vence hoy", "Venció hace 3
//     días" (`textoVencimiento`). Precaución si falta, error si venció.
//   - RANGO AGOTADO: con rango y un consecutivo leído (número, día y
//     fuente) igual o mayor que el final del rango. Texto: "Rango agotado
//     (leído el 3 oct)", tono error, fechado el día de la lectura.
// Nunca se avisa por el vencimiento según la fuente
// (`vencimientoDocumentado`), ni se estima el consumo, ni se infiere un
// consecutivo por fechas. Una documentada, en conflicto o reemplazada no
// avisa de nada: su revisión se ve en la ficha del POS ("por validar",
// "en conflicto"). Una sin POS (PNTE) tampoco: no se sabe a qué punto
// avisar.
//
// "POR AGOTARSE" NO EXISTE TODAVÍA, A PROPÓSITO: hace falta un umbral
// (cuántos números o qué porcentaje del rango) que nadie ha decidido, y
// no se inventa. Mientras tanto la ficha enseña cuántos números quedan
// según la última lectura, sin avisar. Decisión pendiente del usuario
// (TAREAS.md, tarea 321).

type AutorizacionDeAgenda = Pick<
  AutorizacionFacturacion,
  | 'id'
  | 'dispositivoIds'
  | 'prefijo'
  | 'estado'
  | 'rangoHasta'
  | 'vencimientoConfirmado'
  | 'consecutivoActual'
  | 'consecutivoLeidoEn'
  | 'consecutivoFuente'
  | 'eliminadoEn'
>
type EquipoDeAgenda = Pick<Dispositivo, 'id' | 'nombre' | 'eliminadoEn'>

/** Los POS que existen (sin eliminar) de una autorización, en su orden. */
function equiposDe(autorizacion: Pick<AutorizacionFacturacion, 'dispositivoIds'>, equipos: Map<string, EquipoDeAgenda>) {
  return (autorizacion.dispositivoIds ?? []).flatMap((id) => {
    const equipo = equipos.get(id)
    return equipo && !equipo.eliminadoEn ? [equipo] : []
  })
}

/**
 * Si el consecutivo de la autorización es un dato medido: número, día de
 * lectura y fuente, los tres. Sin uno de ellos no hay consecutivo.
 */
export function tieneConsecutivoLeido(
  autorizacion: Pick<AutorizacionFacturacion, 'consecutivoActual' | 'consecutivoLeidoEn' | 'consecutivoFuente'>,
): boolean {
  return (
    autorizacion.consecutivoActual !== null &&
    Boolean(autorizacion.consecutivoLeidoEn) &&
    (autorizacion.consecutivoFuente ?? '').trim() !== ''
  )
}

/** Números que quedan según la última lectura, o null si no hay rango o lectura. */
export function numerosRestantes(
  autorizacion: Pick<
    AutorizacionFacturacion,
    'rangoHasta' | 'consecutivoActual' | 'consecutivoLeidoEn' | 'consecutivoFuente'
  >,
): number | null {
  if (autorizacion.rangoHasta === null || !tieneConsecutivoLeido(autorizacion)) return null
  return Math.max(0, autorizacion.rangoHasta - (autorizacion.consecutivoActual as number))
}

/** Rango agotado según una lectura confiable: el último emitido ya es el final del rango (o lo pasó). */
export function rangoAgotado(
  autorizacion: Pick<
    AutorizacionFacturacion,
    'rangoHasta' | 'consecutivoActual' | 'consecutivoLeidoEn' | 'consecutivoFuente'
  >,
): boolean {
  return numerosRestantes(autorizacion) === 0
}

/**
 * Lo que la Agenda tiene que mostrar hoy de las autorizaciones. El título
 * son los POS (lo que hay que atender), la razón el aviso y el origen qué
 * autorización es. Lleva a la ficha de la autorización.
 */
export function autorizacionesEnAgenda(
  autorizaciones: AutorizacionDeAgenda[],
  dispositivos: EquipoDeAgenda[],
  hoy: Date = new Date(),
): ItemPendiente[] {
  const equipos = new Map(dispositivos.map((d) => [d.id, d]))
  return autorizaciones.flatMap((autorizacion): ItemPendiente[] => {
    if (autorizacion.eliminadoEn || autorizacion.estado !== 'confirmada') return []
    const delPos = equiposDe(autorizacion, equipos)
    if (delPos.length === 0) return []
    const titulo = delPos.map((e) => e.nombre).join(', ')
    const origen = `Autorización ${autorizacion.prefijo.trim()}`
    const ruta = `/facturacion/${autorizacion.id}`
    const avisos: ItemPendiente[] = []

    const vence = autorizacion.vencimientoConfirmado
    const restantes = vence ? diasDeCalendario(vence, hoy) : null
    if (vence && restantes !== null && restantes <= DIAS_AVISO_VENCIMIENTO) {
      avisos.push({
        clave: `facturacion-vence:${autorizacion.id}`,
        titulo,
        detalle: textoVencimiento(vence, hoy),
        ruta,
        tono: restantes < 0 ? 'error' : 'precaucion',
        categoria: 'facturacion',
        fecha: vence,
        diasRestantes: restantes,
        origen,
      })
    }

    const leido = autorizacion.consecutivoLeidoEn
    const desdeLectura = leido ? diasDeCalendario(leido, hoy) : null
    if (rangoAgotado(autorizacion) && leido && desdeLectura !== null) {
      avisos.push({
        clave: `facturacion-agotada:${autorizacion.id}`,
        titulo,
        detalle: `Rango agotado (leído el ${fechaCorta(leido)})`,
        ruta,
        tono: 'error',
        categoria: 'facturacion',
        // Fechado el día de la lectura: desde entonces ya no queda
        // numeración, así que cae en "Vencidos" (o en "Para hoy" si se
        // leyó hoy) y nunca en "Próximos".
        fecha: leido,
        diasRestantes: Math.min(0, desdeLectura),
        origen,
      })
    }
    return avisos
  })
}

// ----------------------------------------------------------------
// La ficha del POS
// ----------------------------------------------------------------

/** Si la categoría de un equipo es la de los POS ("POS", sin importar mayúsculas ni tildes). */
export function esCategoriaPos(nombreCategoria: string | undefined | null): boolean {
  return normalizarTexto(nombreCategoria ?? '').trim() === 'pos'
}

/** Las autorizaciones de un POS, sin eliminar: primero las que siguen en uso, por prefijo; las reemplazadas al final. */
export function autorizacionesDelPos<T extends Pick<AutorizacionFacturacion, 'dispositivoIds' | 'estado' | 'prefijo' | 'eliminadoEn'>>(
  autorizaciones: T[],
  dispositivoId: string,
): T[] {
  return autorizaciones
    .filter((a) => !a.eliminadoEn && (a.dispositivoIds ?? []).includes(dispositivoId))
    .sort(porUso)
}

/** Orden de lectura: las que siguen en uso antes que las reemplazadas, y por prefijo. */
export function porUso(
  a: Pick<AutorizacionFacturacion, 'estado' | 'prefijo'>,
  b: Pick<AutorizacionFacturacion, 'estado' | 'prefijo'>,
): number {
  const ra = a.estado === 'reemplazada' ? 1 : 0
  const rb = b.estado === 'reemplazada' ? 1 : 0
  return ra !== rb ? ra - rb : a.prefijo.localeCompare(b.prefijo, 'es')
}

/**
 * Lo que dice la fila plegada "Facturación" de la ficha: el prefijo en
 * uso ("PNC"), cuántas hay si son varias ("2 en uso") o "Ninguna". Varios
 * prefijos seguidos no caben junto al título en un teléfono de 320 px (lo
 * pisaban): se leen al abrir la sección. Con `revisar` en verdadero si
 * alguna pide revisión, para pintar la fila en precaución.
 */
export function conteoDeFacturacion(
  autorizaciones: Pick<AutorizacionFacturacion, 'estado' | 'prefijo' | 'eliminadoEn'>[],
): { texto: string; revisar: boolean } {
  const enUso = autorizaciones.filter((a) => !a.eliminadoEn && a.estado !== 'reemplazada')
  if (enUso.length === 0) return { texto: 'Ninguna', revisar: false }
  return {
    texto: enUso.length === 1 ? enUso[0].prefijo.trim() : `${enUso.length} en uso`,
    revisar: enUso.some(necesitaRevision),
  }
}

/**
 * Por qué una autorización pide revisión, dicho para quien está frente al
 * POS, o null si no la pide.
 */
export function motivoDeRevision(autorizacion: Pick<AutorizacionFacturacion, 'estado'>): string | null {
  if (autorizacion.estado === 'documentada') return 'Por validar: falta comprobarla con una fuente actual (ICG/HKA o la DIAN).'
  if (autorizacion.estado === 'conflicto') return 'En conflicto: las fuentes no coinciden. Nada se decide hasta comprobarlo.'
  return null
}

// ----------------------------------------------------------------
// Lo que pide el formulario antes de guardar
// ----------------------------------------------------------------
//
// El formulario trabaja con textos (lo que dan los <input>); aquí se
// validan y se convierten. Las fechas llegan como las da un <input
// type="date"> ("YYYY-MM-DD"); `hoy` es el día del teléfono.

/** Lo que el formulario edita, como texto. */
export interface DatosAutorizacion {
  // Lo documentado.
  prefijo: string
  formulario: string
  rangoDesde: string
  rangoHasta: string
  fechaFormalizacion: string
  vigenciaReportada: string
  vencimientoDocumentado: string
  fuente: string
  dispositivoIds: string[]
  evidenciaAdjuntoId: string
  // Lo confirmado.
  estado: EstadoAutorizacion
  verificadoEn: string
  verificacionFuente: string
  vencimientoConfirmado: string
  // El dato actual medido.
  consecutivoActual: string
  consecutivoLeidoEn: string
  consecutivoFuente: string
  observaciones: string
}

export const DATOS_VACIOS: DatosAutorizacion = {
  prefijo: '',
  formulario: '',
  rangoDesde: '',
  rangoHasta: '',
  fechaFormalizacion: '',
  vigenciaReportada: '',
  vencimientoDocumentado: '',
  fuente: '',
  dispositivoIds: [],
  evidenciaAdjuntoId: '',
  estado: 'documentada',
  verificadoEn: '',
  verificacionFuente: '',
  vencimientoConfirmado: '',
  consecutivoActual: '',
  consecutivoLeidoEn: '',
  consecutivoFuente: '',
  observaciones: '',
}

/**
 * Un entero escrito a mano: "90000" o con el punto de miles ("90.000").
 * null si está vacío y NaN si no es un entero (una coma, letras, un
 * decimal o un punto mal puesto no se interpretan).
 */
export function leerEntero(texto: string): number | null {
  const limpio = texto.trim()
  if (!limpio) return null
  if (/^\d+$/.test(limpio)) return Number(limpio)
  if (/^\d{1,3}(\.\d{3})+$/.test(limpio)) return Number(limpio.replace(/\./g, ''))
  return Number.NaN
}

function esFecha(texto: string): boolean {
  return diasDeCalendario(texto, new Date()) !== null
}

/** El campo que falla y el mensaje que se enseña, o null si se puede guardar. */
export interface ErrorDeAutorizacion {
  campo: keyof DatosAutorizacion
  mensaje: string
}

const FECHAS: { campo: keyof DatosAutorizacion; nombre: string }[] = [
  { campo: 'fechaFormalizacion', nombre: 'de formalización' },
  { campo: 'vencimientoDocumentado', nombre: 'de vencimiento según la fuente' },
  { campo: 'verificadoEn', nombre: 'de la verificación' },
  { campo: 'vencimientoConfirmado', nombre: 'de vencimiento confirmado' },
  { campo: 'consecutivoLeidoEn', nombre: 'de la lectura' },
]

export function errorDeAutorizacion(datos: DatosAutorizacion, hoy: Date = new Date()): ErrorDeAutorizacion | null {
  // Lo documentado.
  if (!datos.prefijo.trim()) return { campo: 'prefijo', mensaje: 'Escribe el prefijo.' }
  const desde = leerEntero(datos.rangoDesde)
  const hasta = leerEntero(datos.rangoHasta)
  if ((desde === null) !== (hasta === null)) {
    return { campo: desde === null ? 'rangoDesde' : 'rangoHasta', mensaje: 'Escribe el rango completo: desde y hasta.' }
  }
  if (desde !== null && hasta !== null) {
    if (!Number.isSafeInteger(desde) || desde <= 0) {
      return { campo: 'rangoDesde', mensaje: 'El rango tiene que ser de números enteros mayores que cero.' }
    }
    if (!Number.isSafeInteger(hasta) || hasta <= 0) {
      return { campo: 'rangoHasta', mensaje: 'El rango tiene que ser de números enteros mayores que cero.' }
    }
    if (desde > hasta) return { campo: 'rangoDesde', mensaje: 'El inicio del rango no puede ser mayor que el final.' }
  }
  for (const { campo, nombre } of FECHAS) {
    const valor = datos[campo] as string
    if (valor && !esFecha(valor)) return { campo, mensaje: `La fecha ${nombre} no es válida.` }
  }
  if (!datos.fuente.trim()) return { campo: 'fuente', mensaje: 'Di de dónde sale: el documento o archivo que lo dice.' }

  // Lo confirmado.
  if (datos.estado === 'confirmada' && (!datos.verificadoEn || !datos.verificacionFuente.trim())) {
    return {
      campo: datos.verificadoEn ? 'verificacionFuente' : 'verificadoEn',
      mensaje: 'Para confirmarla, di cuándo y con qué fuente actual se comprobó.',
    }
  }
  if (datos.verificadoEn && (diasDeCalendario(datos.verificadoEn, hoy) as number) > 0) {
    return { campo: 'verificadoEn', mensaje: 'La verificación no puede ser de una fecha futura.' }
  }
  if (datos.vencimientoConfirmado && datos.estado !== 'confirmada' && datos.estado !== 'reemplazada') {
    return {
      campo: 'vencimientoConfirmado',
      mensaje: 'Un vencimiento confirmado solo cabe en una autorización confirmada.',
    }
  }
  if (datos.estado === 'conflicto' && !datos.observaciones.trim()) {
    return { campo: 'observaciones', mensaje: 'Explica el conflicto en las observaciones: qué fuentes no coinciden y en qué.' }
  }

  // El dato actual medido: los tres o ninguno, y dentro del rango.
  const consecutivo = leerEntero(datos.consecutivoActual)
  const algunoDelConsecutivo =
    consecutivo !== null || Boolean(datos.consecutivoLeidoEn) || datos.consecutivoFuente.trim() !== ''
  if (algunoDelConsecutivo) {
    if (consecutivo === null || !datos.consecutivoLeidoEn || !datos.consecutivoFuente.trim()) {
      return {
        campo: consecutivo === null ? 'consecutivoActual' : !datos.consecutivoLeidoEn ? 'consecutivoLeidoEn' : 'consecutivoFuente',
        mensaje: 'El consecutivo actual pide el número, el día en que se leyó y dónde se leyó, los tres.',
      }
    }
    if (!Number.isSafeInteger(consecutivo) || consecutivo <= 0) {
      return { campo: 'consecutivoActual', mensaje: 'El consecutivo tiene que ser un número entero mayor que cero.' }
    }
    if (desde === null || hasta === null) {
      return { campo: 'consecutivoActual', mensaje: 'Sin el rango no se puede registrar el consecutivo.' }
    }
    if (consecutivo < desde || consecutivo > hasta) {
      return {
        campo: 'consecutivoActual',
        mensaje: `El consecutivo tiene que estar dentro del rango (${formatearNumero(desde)} a ${formatearNumero(hasta)}).`,
      }
    }
    if ((diasDeCalendario(datos.consecutivoLeidoEn, hoy) as number) > 0) {
      return { campo: 'consecutivoLeidoEn', mensaje: 'La lectura no puede ser de una fecha futura.' }
    }
  }
  return null
}

export type AutorizacionGuardable = Omit<AutorizacionFacturacion, 'updatedAt' | 'updatedBy' | 'eliminadoEn'>

/** La fila que se guarda con lo que dice el formulario (ya validado). */
export function autorizacionDesdeDatos(id: string, datos: DatosAutorizacion): AutorizacionGuardable {
  const vacioANull = (texto: string) => texto.trim() || null
  return {
    id,
    dispositivoIds: [...new Set(datos.dispositivoIds)],
    prefijo: datos.prefijo.trim(),
    formulario: datos.formulario.trim(),
    rangoDesde: leerEntero(datos.rangoDesde),
    rangoHasta: leerEntero(datos.rangoHasta),
    fechaFormalizacion: vacioANull(datos.fechaFormalizacion),
    vigenciaReportada: datos.vigenciaReportada.trim(),
    vencimientoDocumentado: vacioANull(datos.vencimientoDocumentado),
    vencimientoConfirmado: vacioANull(datos.vencimientoConfirmado),
    consecutivoActual: leerEntero(datos.consecutivoActual),
    consecutivoLeidoEn: vacioANull(datos.consecutivoLeidoEn),
    consecutivoFuente: datos.consecutivoFuente.trim(),
    estado: datos.estado,
    fuente: datos.fuente.trim(),
    verificadoEn: vacioANull(datos.verificadoEn),
    verificacionFuente: datos.verificacionFuente.trim(),
    observaciones: datos.observaciones.trim(),
    evidenciaAdjuntoId: vacioANull(datos.evidenciaAdjuntoId),
  }
}

/** Lo que el formulario enseña al editar una autorización guardada. */
export function datosDesdeAutorizacion(autorizacion: AutorizacionFacturacion): DatosAutorizacion {
  const texto = (valor: string | null | undefined) => valor ?? ''
  const numero = (valor: number | null) => (valor === null ? '' : String(valor))
  return {
    prefijo: autorizacion.prefijo,
    formulario: autorizacion.formulario,
    rangoDesde: numero(autorizacion.rangoDesde),
    rangoHasta: numero(autorizacion.rangoHasta),
    fechaFormalizacion: texto(autorizacion.fechaFormalizacion),
    vigenciaReportada: autorizacion.vigenciaReportada,
    vencimientoDocumentado: texto(autorizacion.vencimientoDocumentado),
    fuente: autorizacion.fuente,
    dispositivoIds: [...(autorizacion.dispositivoIds ?? [])],
    evidenciaAdjuntoId: texto(autorizacion.evidenciaAdjuntoId),
    estado: autorizacion.estado,
    verificadoEn: texto(autorizacion.verificadoEn),
    verificacionFuente: autorizacion.verificacionFuente,
    vencimientoConfirmado: texto(autorizacion.vencimientoConfirmado),
    consecutivoActual: numero(autorizacion.consecutivoActual),
    consecutivoLeidoEn: texto(autorizacion.consecutivoLeidoEn),
    consecutivoFuente: autorizacion.consecutivoFuente,
    observaciones: autorizacion.observaciones,
  }
}
