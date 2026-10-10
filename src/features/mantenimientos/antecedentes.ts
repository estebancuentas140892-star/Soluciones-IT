import type { Mantenimiento, TipoMantenimiento } from '../../lib/db'
import { normalizarTexto } from '../soluciones/iconosSoluciones'

// ANTECEDENTES DE MANTENIMIENTO SACADOS DE DOCUMENTACION HISTORICA
// (tarea 320, encargo del 2026-10-10).
//
// La via para registrar o importar lo que dice un cronograma antiguo SIN
// convertirlo en un mantenimiento confirmado:
//   - todo antecedente queda 'documentado_por_validar', con su fuente, y
//     la Agenda nunca lo muestra (mantenimiento.ts, `entraEnAgenda`);
//   - solo copia lo que la fuente dice: una marca de cronograma da un
//     equipo, un dia y una hoja, no quien lo hizo, si se hizo ni como
//     quedo, asi que tecnico, resultado, fecha real e intervencion quedan
//     vacios;
//   - una marca solo se vuelve fecha cuando el mes de su hoja y el de su
//     titulo coinciden, o cuando una persona concilio el mes. En las
//     hojas con titulo mensual inconsistente (10 en el cronograma
//     conciliado el 2026-10-10, CONCILIACION_DATOS.md seccion 6) el
//     antecedente se registra SIN fecha y con la marca tal cual en las
//     observaciones, para no perder el dato ni inventarlo.
//
// Lo usa quien carga los antecedentes (por la regla 26, ChatGPT con los
// datos reales): construye las filas con `antecedenteDesdeCronograma` y
// las guarda con `guardarRegistro('mantenimientos', ...)`, o las inserta
// con el mismo contrato, que schema.sql (bloque 1.u) tambien exige.

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

// "Setiembre" es una forma aceptada de septiembre y aparece en documentos
// reales; se reconoce igual.
const VARIANTES: Record<string, number> = { setiembre: 9 }

/**
 * El mes (1 a 12) que nombra un texto ("Marzo", "CRONOGRAMA MARZO 2025"),
 * sin distinguir mayúsculas ni tildes. null si no nombra ninguno o nombra
 * dos distintos: un título que dice dos meses no decide por sí solo.
 */
export function mesDeTexto(texto: string): number | null {
  const palabras = normalizarTexto(texto).split(/[^a-z]+/)
  const encontrados = new Set<number>()
  for (const palabra of palabras) {
    const indice = MESES.indexOf(palabra)
    if (indice >= 0) encontrados.add(indice + 1)
    const variante = VARIANTES[palabra]
    if (variante) encontrados.add(variante)
  }
  return encontrados.size === 1 ? [...encontrados][0] : null
}

export interface MarcaDeCronograma {
  dispositivoId: string
  tipo: TipoMantenimiento
  /** El año del cronograma. */
  anio: number
  /** El nombre de la hoja ("Marzo"). */
  hoja: string
  /** El título que lleva la hoja dentro ("Cronograma de mantenimiento marzo 2025"). */
  tituloHoja: string
  /** El día marcado en la hoja. */
  dia: number
  /** De dónde sale: archivo y hoja, para poder volver a mirarlo. Obligatoria. */
  fuente: string
  /**
   * El mes que una persona confirmó al conciliar la hoja, cuando hoja y
   * título no coinciden. Sin él, una hoja inconsistente no da fecha.
   */
  mesConciliado?: number
}

export type FechaDeMarca =
  | { ok: true; fecha: string }
  | { ok: false; motivo: 'mes_sin_conciliar' | 'dia_invalido' }

/**
 * La fecha que da una marca del cronograma, o por qué no la da. Sin
 * conciliar, el mes de la hoja y el del título tienen que existir y
 * coincidir; si no, la marca no se convierte en fecha.
 */
export function fechaDeMarca(marca: MarcaDeCronograma): FechaDeMarca {
  let mes: number | null
  if (marca.mesConciliado !== undefined) {
    mes = Number.isInteger(marca.mesConciliado) && marca.mesConciliado >= 1 && marca.mesConciliado <= 12
      ? marca.mesConciliado
      : null
  } else {
    const deHoja = mesDeTexto(marca.hoja)
    const deTitulo = mesDeTexto(marca.tituloHoja)
    mes = deHoja !== null && deHoja === deTitulo ? deHoja : null
  }
  if (mes === null) return { ok: false, motivo: 'mes_sin_conciliar' }

  const { anio, dia } = marca
  if (!Number.isInteger(anio) || !Number.isInteger(dia) || dia < 1) return { ok: false, motivo: 'dia_invalido' }
  // Día imposible ("31 de abril"): se rechaza en vez de dejar que la
  // fecha se desborde en silencio al mes siguiente.
  const instante = new Date(Date.UTC(anio, mes - 1, dia))
  if (instante.getUTCMonth() !== mes - 1 || instante.getUTCDate() !== dia) {
    return { ok: false, motivo: 'dia_invalido' }
  }
  const mm = String(mes).padStart(2, '0')
  const dd = String(dia).padStart(2, '0')
  return { ok: true, fecha: `${anio}-${mm}-${dd}` }
}

export type AntecedenteNuevo = Omit<Mantenimiento, 'updatedAt' | 'updatedBy' | 'eliminadoEn'>

/**
 * La fila de un antecedente sacado de una marca del cronograma: siempre
 * 'documentado_por_validar' y 'programado' (el cronograma planificaba;
 * no dice si se hizo), con la fecha solo si la marca la da y la marca tal
 * cual en las observaciones. Nunca afirma técnico, resultado, fecha real
 * ni intervención. Lanza si falta la fuente: un antecedente sin fuente no
 * se puede volver a comprobar.
 */
export function antecedenteDesdeCronograma(id: string, marca: MarcaDeCronograma): AntecedenteNuevo {
  const fuente = marca.fuente.trim()
  if (!fuente) throw new Error('Un antecedente necesita su fuente.')
  const fecha = fechaDeMarca(marca)
  const marcaTalCual = `Marca del cronograma ${marca.anio}: hoja «${marca.hoja.trim()}», título «${marca.tituloHoja.trim()}», día ${marca.dia}.`
  const aviso = fecha.ok
    ? ''
    : fecha.motivo === 'mes_sin_conciliar'
      ? ' Sin fecha: el mes de la hoja y el de su título no coinciden; falta conciliarlo.'
      : ' Sin fecha: el día no existe en ese mes.'
  return {
    id,
    dispositivoId: marca.dispositivoId,
    tipo: marca.tipo,
    fechaProgramada: fecha.ok ? fecha.fecha : null,
    estado: 'programado',
    tecnico: '',
    fechaRealizada: null,
    resultado: '',
    observaciones: `${marcaTalCual}${aviso}`,
    historialId: null,
    fuente,
    validacion: 'documentado_por_validar',
  }
}
