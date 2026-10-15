import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { db, type Dispositivo } from '../../lib/db'
import { PastillaEstadoDispositivo } from '../../components/PastillaEstado'
import { dependenciasDeBaja, sinDependencias } from './baja'
import { completitudDispositivo, pasosSiguientes, type PasoSiguiente } from './completitud'
import { compartirOCopiar } from '../../lib/portapapeles'
import { eliminarRegistro } from '../../lib/repositorio'
import { registrarVisita } from '../../lib/recientes'
import { textoVivo } from '../../lib/referencia'
import { lineaDeContexto, ubicacionDeEquipo } from '../../lib/contextoEquipo'
import { origenesDistintos, referenciasHacia, resumenImpacto } from '../../lib/grafo'
import { conectadoA, textoConectadoA } from '../../lib/conexiones'
import { tiempoRelativo } from '../../lib/tiempoRelativo'
import { conOrigen } from '../../lib/origenNavegacion'
import { Chasis } from '../../app/Chasis'
import { usePerfilVivo } from '../autenticacion/usePerfilVivo'
import { Adjuntos } from '../../components/Adjuntos'
import { BotonFavorito } from '../../components/BotonFavorito'
import { DialogoEliminar } from '../../components/DialogoEliminar'
import { BotonCopiar, FilaDato } from '../../components/FilaDato'
import { HojaInferior } from '../../components/HojaInferior'
import { MiniaturaPortada } from '../../components/MiniaturaPortada'
import { useEsAncho } from '../../components/useEsAncho'
import { useGrafo } from '../../components/useGrafo'
import { useUrlAdjunto } from '../../components/useUrlAdjunto'
import {
  ArrowsClockwise,
  BookOpen,
  CaretDown,
  CaretRight,
  Camera,
  Check,
  Copy,
  ClockCounterClockwise,
  DotsThreeOutline,
  Info,
  Key,
  LockSimple,
  MapPin,
  Paperclip,
  PencilSimple,
  PlugsConnected,
  Plus,
  QrCode,
  ShareNetwork,
  TrashSimple,
  Storefront,
  WarningOctagon,
  User,
  WarningCircle,
  Wrench,
  XCircle,
} from '../../components/iconos'
import { BTN_GHOST_PELIGRO, BTN_ICONO_SECUNDARIO, BTN_SECUNDARIO } from '../../components/nocturne'
import { ImpactoYDependencias } from '../red/ImpactoYDependencias'
import { useImpactoEquipo } from '../red/useImpactoEquipo'
import { ConexionesFicha } from '../red/ConexionesFicha'
import { IconoNodo } from '../red/IconoNodo'
import { tipoDeNodoVisual } from '../red/topologiaVisual'
import { esDeRed } from '../../lib/categorias'
import { procedimientosDeCategoria, procedimientosDeDispositivo } from './procedimientosDeDispositivo'
import { problemasDeCategoria, problemasDeDispositivo } from './problemasDeDispositivo'
import { Historial } from '../historial/Historial'
import { IniciarDiagnosticoBoton } from './IniciarDiagnosticoBoton'
import { AvisosDelEquipo, BarraAccionEquipo, FilaIndice, ResolverConEsteEquipo, type AvisoEquipo, type ItemResolver } from './PiezasFicha'
import { rutaGuiaConEquipo } from '../soluciones/contextoEjecucion'
import { etiquetaDeTipo } from '../soluciones/tiposArticulo'
import { CredencialesDelEquipo } from './CredencialesDelEquipo'
import { ProblemasDelEquipo } from './ProblemasDelEquipo'
import { ProcedimientosDelEquipo } from './ProcedimientosDelEquipo'
import { RegistrarIntervencion } from './RegistrarIntervencion'
import { SeguridadDelEquipo } from './SeguridadDelEquipo'
import { ResponsableDelEquipo, ResponsablesAnteriores } from '../personas/ResponsableDelEquipo'
import { HojaAsignarPersona } from '../personas/HojaAsignarPersona'
import { esDeBaja, responsablePorValidar } from '../personas/cicloPersona'
import { useResponsablesAnteriores } from '../personas/useAsignaciones'
import { conteoDeMantenimientos } from '../mantenimientos/mantenimiento'
import { conteoDeFacturacion, esCategoriaPos } from '../facturacion/autorizacion'
import { AutorizacionesDelPos } from '../facturacion/AutorizacionesDelPos'

// LAS HOJAS DE LA FICHA (tarea 329): lo que se consulta sin dejarla. Una
// sola abierta a la vez.
type HojaFicha =
  | 'datos'
  | 'impacto'
  | 'conexiones'
  | 'credenciales'
  | 'seguridad'
  | 'adjuntos'
  | 'facturacion'
  | 'intervenciones'
  | 'resolver'

// Las anclas de "Más del equipo": llegar a una abre su hoja (el bloque
// "¿Qué sigue?" de un equipo recién creado y los enlaces de otras pantallas
// las usan; si no, el salto no encontraría su destino).
const HOJA_POR_ANCLA: Record<string, HojaFicha> = {
  '#datos': 'datos',
  '#conexiones': 'conexiones',
  '#seguridad': 'seguridad',
  '#foto': 'adjuntos',
  '#facturacion': 'facturacion',
}

// Fecha corta al estilo del diseño ("12 jul"), con el año solo cuando
// no es el actual (mismo criterio que la ficha de artículo).
function fechaCorta(iso: string): string {
  const fecha = new Date(iso)
  const opciones: Intl.DateTimeFormatOptions =
    fecha.getFullYear() === new Date().getFullYear()
      ? { day: 'numeric', month: 'short' }
      : { day: 'numeric', month: 'short', year: 'numeric' }
  return new Intl.DateTimeFormat('es', opciones).format(fecha)
}

// Pastilla de estado en Nocturne (mismo criterio de color que la lista,
// tarea 85): operativo verde, mantenimiento ámbar, fuera de servicio
// rojo, de baja/otro neutro. Se indexa por la etiqueta canónica.
// Ficha de un dispositivo re-autorizada al sistema Nocturne (handoff
// "Rediseño de aplicación empresarial", Ficha de Dispositivo.dc.html):
// cabecera con regreso contextual, compartir y menú "···" (duplicar,
// editar, etiqueta QR, eliminar), foto banner, título + estado en
// pastilla, tarjeta de Información con filas copiables y ubicación viva,
// "Resolver con este equipo" (diagnóstico destacado + procedimientos,
// problemas y credenciales vinculados + creación contextual), "Si este
// equipo falla" (impacto y dependencias), conexiones e intervenciones.
// Declara nivel de documento en el chasis (tarea 185), así que conserva
// las pestañas, y toda la lógica y los datos de la vista 360°. El reparto
// vigente de la ficha (tarea 256: Ahora, Problemas frecuentes,
// Procedimientos, Credenciales y Profundidad) se explica en el cuerpo.
export function DispositivoPage() {
  const { dispositivoId = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  // Nudge anti duplicidad de la Bóveda (fase P3): "Ir a la ficha" desde
  // un secreto cuyo título coincide con este equipo llega con
  // ?nuevoCampoProtegido=<nombre sugerido>, para abrir directo el
  // editor de "Seguridad" con el nombre precargado.
  const nombreCampoSugerido = searchParams.get('nuevoCampoProtegido') ?? ''
  const [mostrarEliminar, setMostrarEliminar] = useState(false)
  const [menuAbierto, setMenuAbierto] = useState(false)
  // Bloque "Que sigue" (hallazgo O1): capturado UNA SOLA VEZ al montar,
  // no releido de `location.state` en cada render. Los pasos son anclas
  // <a href="#..."> nativas (mas abajo, no <Link>), y el propio history
  // de React Router trata un cambio de hash como una navegacion nueva
  // CON `state: null`; si se leyera `location.state` en cada render, el
  // bloque se autodestruiria en cuanto el tecnico tocara uno de sus
  // propios enlaces (confirmado en navegador antes de esta correccion).
  const [recienCreado] = useState(
    () => Boolean((location.state as { recienCreado?: boolean } | null)?.recienCreado),
  )

  const dispositivo = useLiveQuery(() => db.dispositivos.get(dispositivoId), [dispositivoId])
  const categoria = useLiveQuery(
    () => (dispositivo ? db.categorias.get(dispositivo.categoriaId) : undefined),
    [dispositivo],
  )
  const perfil = usePerfilVivo()
  // Ubicacion como entidad (grupo N3): el dato canonico es `ubicacionId`;
  // `dispositivo.ubicacion` es solo la copia de referencia. Se resuelve
  // en vivo contra la tabla `ubicaciones` (regla de referencia viva), asi
  // renombrar el lugar se refleja aqui sin reescribir el dispositivo.
  const ubicacionVinculada = useLiveQuery(
    () => (dispositivo?.ubicacionId ? db.ubicaciones.get(dispositivo.ubicacionId) : undefined),
    [dispositivo?.ubicacionId],
  )
  // Responsable como entidad (hallazgo T1): la fila vive en
  // `ResponsableDelEquipo` desde la tarea 266 (persona activa o retirada,
  // texto por validar o nadie). Aquí solo se cuentan los responsables
  // anteriores, para la cabecera plegada de "Más datos del equipo".
  const anterioresResponsables = useResponsablesAnteriores(dispositivoId)
  // ¿Hay una persona viva a cargo? Decide si la línea de identidad dice
  // "sin responsable" (propuesta final de Claude Design, 2026-10-01).
  // `undefined` mientras se lee: no se afirma nada hasta saberlo.
  const personaResponsable = useLiveQuery(
    async () => (dispositivo?.responsableId ? ((await db.personas.get(dispositivo.responsableId)) ?? null) : null),
    [dispositivo?.responsableId],
  )
  const [asignando, setAsignando] = useState(false)
  // LA HOJA ABIERTA (tarea 329): "Más del equipo" es un índice de un solo
  // nivel y cada fila abre la suya. Se llega abierta con el nombre sugerido
  // de un dato protegido (el nudge de la Bóveda, fase P3) o con un ancla.
  const [hoja, setHoja] = useState<HojaFicha | null>(
    () => HOJA_POR_ANCLA[location.hash] ?? (nombreCampoSugerido ? 'seguridad' : null),
  )
  useEffect(() => {
    const deLaAncla = HOJA_POR_ANCLA[location.hash]
    if (deLaAncla) setHoja(deLaAncla)
  }, [location.hash])
  const cerrarHoja = () => setHoja(null)
  // "Resolver un problema" va en la barra fija del teléfono y, desde 768 px,
  // en la cabecera del documento (tarea 339): una sola vez por ventana.
  const ancho = useEsAncho()
  // EL NOMBRE SUBE A LA CABECERA AL DESPLAZARSE (tarea 329): mientras el
  // carnet está a la vista, la cabecera dice solo a dónde se vuelve; cuando
  // el nombre grande sale por arriba, aparece en ella (M-R1 se cumple: el
  // nombre siempre está a la vista, pero no dos veces en la primera
  // pantalla). Sin IntersectionObserver, el nombre va siempre arriba.
  const [nodoNombre, setNodoNombre] = useState<HTMLElement | null>(null)
  const [nombreALaVista, setNombreALaVista] = useState(true)
  useEffect(() => {
    if (!nodoNombre || typeof IntersectionObserver === 'undefined') return
    const observador = new IntersectionObserver(([entrada]) => setNombreALaVista(entrada.isIntersecting), {
      rootMargin: '-56px 0px 0px 0px',
    })
    observador.observe(nodoNombre)
    return () => observador.disconnect()
  }, [nodoNombre])
  // Reemplazo (hallazgo L3): equipo al que este reemplaza (si lo hay) y
  // equipo que reemplazo a este (inverso, derivado con un filtro directo
  // ya que no hay copia de referencia que consultar sin ella).
  const reemplazaVinculado = useLiveQuery(
    () => (dispositivo?.reemplazaA ? db.dispositivos.get(dispositivo.reemplazaA) : undefined),
    [dispositivo?.reemplazaA],
  )
  const reemplazadoPor = useLiveQuery(
    () => db.dispositivos.filter((d) => !d.eliminadoEn && d.reemplazaA === dispositivoId).first(),
    [dispositivoId],
  )

  // Conteos de la capa "Profundidad" (M-014, regla M-R4: plegar exige
  // mostrar el conteo, para que plegar informe en vez de esconder).
  // Viven aquí, con la cabecera plegada, y no dentro de cada bloque: si
  // vivieran dentro habría que abrirlos para saber si vale la pena
  // abrirlos, que es justo lo que la regla evita.
  const totalConexiones = useLiveQuery(
    async () =>
      (await db.conexiones.where('origenId').equals(dispositivoId).filter((c) => !c.eliminadoEn).count()) +
      (await db.conexiones.where('destinoId').equals(dispositivoId).filter((c) => !c.eliminadoEn).count()),
    [dispositivoId],
    0,
  )
  const totalCamposProtegidos = useLiveQuery(
    () =>
      db.campos_protegidos
        .where('dispositivoId')
        .equals(dispositivoId)
        .filter((c) => !c.eliminadoEn)
        .count(),
    [dispositivoId],
    0,
  )
  const totalAdjuntos = useLiveQuery(
    () =>
      db.adjuntos
        .where('[entidadTipo+entidadId]')
        .equals(['dispositivo', dispositivoId])
        .filter((a) => !a.eliminadoEn)
        .count(),
    [dispositivoId],
    0,
  )
  // "Mantenimiento" (tarea 320) dice en su fila plegada el abierto más
  // cercano ("Atrasado", "Hoy", "20 oct") o "Ninguno".
  const mantenimientos = useLiveQuery(
    () =>
      db.mantenimientos
        .where('dispositivoId')
        .equals(dispositivoId)
        .filter((m) => !m.eliminadoEn)
        .toArray(),
    [dispositivoId],
    [],
  )
  // "Facturación" (tarea 321): las autorizaciones que usa este POS. La
  // fila plegada dice sus prefijos en uso o "Ninguna", en precaución si
  // alguna pide revisión.
  const autorizaciones = useLiveQuery(
    () => db.autorizaciones_facturacion.where('dispositivoIds').equals(dispositivoId).toArray(),
    [dispositivoId],
    [],
  )
  // "Intervenciones" cuenta el trabajo ESCRITO A MANO sobre el equipo
  // (`campo: 'intervencion'`), no cada cambio de campo: la cabecera
  // plegada promete lo que hay dentro, y lo que el técnico busca ahí es
  // "¿qué le han hecho a este equipo?".
  const intervenciones = useLiveQuery(
    async () => {
      const entradas = await db.historial
        .where('[entidadTipo+entidadId]')
        .equals(['dispositivo', dispositivoId])
        .filter((e) => e.campo === 'intervencion')
        .toArray()
      const fechas = entradas.map((e) => e.fechaHora).sort()
      return { total: fechas.length, ultima: fechas.at(-1) ?? null }
    },
    [dispositivoId],
    { total: 0, ultima: null as string | null },
  )
  // "CONECTADO A" (tarea 256): el enlace por el que este equipo recibe
  // servicio, y el nombre VIVO del otro extremo (la conexión guarda una
  // copia de referencia que puede haberse quedado vieja).
  const conexionesEntrantes = useLiveQuery(
    () => db.conexiones.where('destinoId').equals(dispositivoId).filter((c) => !c.eliminadoEn).toArray(),
    [dispositivoId],
    [],
  )
  const subida = useMemo(() => conectadoA(conexionesEntrantes, dispositivoId), [conexionesEntrantes, dispositivoId])
  const idEquipoDeSubida = subida?.extremo.otroId
  const equipoDeSubida = useLiveQuery(
    () => (idEquipoDeSubida ? db.dispositivos.get(idEquipoDeSubida) : undefined),
    [idEquipoDeSubida],
  )
  // ¿Hay diagnósticos de su categoría? Decide si "Problemas frecuentes"
  // tiene algo que enseñar aunque no haya incidencias escritas.
  const categoriaDelEquipo = dispositivo?.categoriaId
  const hayDiagnosticos = useLiveQuery(
    async () =>
      categoriaDelEquipo
        ? (await db.diagnosticos.where('categoriaId').equals(categoriaDelEquipo).filter((x) => !x.eliminadoEn).count()) > 0
        : false,
    [categoriaDelEquipo],
    false,
  )
  const { totalEquipos: equiposEnRiesgo, camino: cadenaDependencia } = useImpactoEquipo(dispositivoId)
  const articulos = useLiveQuery(() => db.articulos.filter((a) => !a.eliminadoEn).toArray(), [], [])

  const idVisitado = dispositivo && !dispositivo.eliminadoEn ? dispositivo.id : null
  useEffect(() => {
    if (idVisitado) void registrarVisita('dispositivo', idVisitado)
  }, [idVisitado])

  // Impacto antes de eliminar (fase N1): incidencias que lo mencionan y
  // conexiones que lo tocan y quedarían huérfanas. Las relaciones ya se
  // muestran en la ficha (Problemas del equipo, Conexiones), así que aquí
  // el grafo solo alimenta el aviso del diálogo.
  const grafo = useGrafo()
  const impacto = resumenImpacto(grafo, 'dispositivo', dispositivoId)

  if (dispositivo === null) return <Navigate to="/dispositivos" replace />
  if (!dispositivo) {
    return (
      <Chasis modo="documento">
        <p className="px-4 pt-6 text-sm text-noct-neutral-400">Cargando...</p>
      </Chasis>
    )
  }

  // Los dispositivos de red se listan en la seccion Red: la navegacion
  // de vuelta y la eliminacion regresan alli.
  const esRed = esDeRed(categoria)
  const volverA = esRed ? '/red' : '/dispositivos'

  async function eliminar() {
    await eliminarRegistro('dispositivos', dispositivoId)
    navigate(volverA)
  }

  // Reparto de los datos (M-014, regla M-R4; revisado en la tarea 256).
  // Arriba, lo que se viene a buscar con el equipo delante: qué es, su IP,
  // dónde está, quién responde de él y a qué está conectado. Serial,
  // placa, detalles, reemplazos y observaciones van plegados en "Más
  // datos del equipo", que es donde se consultan.
  // A Ubicaciones y a Personas se llega tocando un enlace DENTRO de esta
  // ficha, y al llegar nada decía desde qué equipo (hallazgo M-002,
  // mockup `6b`). Con el origen, su regreso vuelve aquí y su línea de
  // contexto dice el nombre del equipo. Lo mismo entre equipos, para la
  // cadena de reemplazos.
  const origenEsteEquipo = conOrigen(`/dispositivos/${dispositivoId}`, dispositivo.nombre)

  const marcaModelo = [dispositivo.marca, dispositivo.modelo].filter(Boolean).join(' ')
  const camposContexto: { etiqueta: string; valor: string; tecnico?: boolean }[] = [
    { etiqueta: 'Número de serie', valor: dispositivo.serial, tecnico: true },
    { etiqueta: 'Placa de inventario', valor: dispositivo.placaInventario, tecnico: true },
  ].filter((c) => c.valor)

  // Nombre a mostrar de la ubicacion: el vivo de la fila enlazada si
  // existe y no esta eliminada; si no, la copia de referencia guardada.
  const ubicacionViva = ubicacionVinculada && !ubicacionVinculada.eliminadoEn ? ubicacionVinculada : null
  const ubicacionNombre = ubicacionDeEquipo(dispositivo, ubicacionViva)

  // Sin copia de referencia para reemplazaA (autorreferencia estricta,
  // fijada una sola vez al crear): si la fila vinculada no esta
  // disponible (aun sincronizando, o realmente no existe) la fila de la
  // ficha simplemente no se muestra, en vez de mostrar el id crudo.
  const reemplazaNombre = reemplazaVinculado?.nombre ?? null

  const detalles = Object.entries(dispositivo.detalles).filter(([, valor]) => valor)
  const metaLinea = [categoria?.nombre, `actualizado ${fechaCorta(dispositivo.updatedAt)}`]
    .filter(Boolean)
    .join(' · ')
  // Bajo el nombre: el tipo (su categoría) y la marca y el modelo, pero
  // solo lo que el nombre no dice ya (tarea 277): "Impresora Taquilla"
  // no repite "Impresoras". Si no hay nada que decir, no hay línea; la
  // fecha de `metaLinea` solo ocupa su sitio cuando el equipo no tiene ni
  // categoría ni marca ni modelo, como antes.
  const tipoCompleto = [categoria?.nombre, marcaModelo].filter(Boolean).join(' · ')
  const lineaTipo = tipoCompleto ? lineaDeContexto(dispositivo.nombre, [categoria?.nombre, marcaModelo]) : metaLinea
  // LA LÍNEA DE IDENTIDAD (propuesta final de Claude Design, 2026-10-01):
  // qué es y, si nadie responde de él, "sin responsable" aquí, como el
  // dato que falta, y no como una fila más de los datos para trabajar. Un
  // equipo de baja o de red sin nada anotado no lo dice (no aplica).
  const personaVivaACargo = personaResponsable && !personaResponsable.eliminadoEn ? personaResponsable : null
  const aplicaResponsable = !esRed || Boolean(dispositivo.responsableId) || dispositivo.responsable.trim() !== ''
  const sinResponsable =
    aplicaResponsable && !esDeBaja(dispositivo) && personaResponsable !== undefined && personaVivaACargo === null
  // Con un nombre anotado (por validar) la fila lo dice y trae su "Asignar".
  const anotadoPorValidar = responsablePorValidar(dispositivo)
  // Cuántos datos guarda "Más datos del equipo" (M-R4: plegar informa).
  // "Categoría y fecha" va siempre.
  const totalMasDatos =
    camposContexto.length +
    detalles.length +
    (reemplazaNombre ? 1 : 0) +
    (reemplazadoPor ? 1 : 0) +
    (anterioresResponsables.length > 0 ? 1 : 0) +
    1
  const nombreSubida = subida
    ? textoVivo(equipoDeSubida && !equipoDeSubida.eliminadoEn ? equipoDeSubida.nombre : null, subida.extremo.otroNombre)
    : ''

  // Lo que se puede resolver con este equipo, contado para la promesa de
  // la acción dominante (M-R3: la acción fija dice qué va a pasar).
  const procedimientosPropios = procedimientosDeDispositivo(articulos, dispositivoId)
  const problemasPropios = problemasDeDispositivo(articulos, dispositivoId)
  const criterio = { marca: dispositivo.marca, modelo: dispositivo.modelo }
  const procedimientos = [
    ...procedimientosPropios,
    ...procedimientosDeCategoria(articulos, dispositivo.categoriaId, new Set(procedimientosPropios.map((a) => a.id)), criterio),
  ]
  const problemas = [
    ...problemasPropios,
    ...problemasDeCategoria(articulos, dispositivo.categoriaId, new Set(problemasPropios.map((a) => a.id)), criterio),
  ]
  const totalResolver = procedimientos.length
  const totalProblemas = problemas.length
  // "RESOLVER CON ESTE EQUIPO" (tarea 329): los problemas frecuentes primero
  // (los del equipo y después los de su categoría), luego los procedimientos;
  // las tres primeras a la vista y el resto en su hoja. Cada una abre la guía
  // con este equipo (tarea 290).
  const formasDeResolver: ItemResolver[] = [
    ...problemas.map((a) => ({
      id: a.id,
      ruta: rutaGuiaConEquipo(`/soluciones/${a.categoriaId}/${a.id}`, dispositivoId),
      Icono: WarningCircle,
      tipo: 'Problema frecuente',
      titulo: a.titulo,
      extra: a.sintomas[0],
    })),
    ...procedimientos.map((a) => ({
      id: a.id,
      ruta: rutaGuiaConEquipo(`/soluciones/${a.categoriaId}/${a.id}`, dispositivoId),
      Icono: BookOpen,
      tipo: etiquetaDeTipo(a.tipo),
      titulo: a.titulo,
    })),
  ]

  // Las credenciales de la Bóveda que dan acceso a este equipo: solo
  // con permiso, como la propia lista (`CredencialesDelEquipo`).
  const totalCredenciales = perfil?.puedeVerBoveda
    ? origenesDistintos(referenciasHacia(grafo, 'dispositivo', dispositivoId, ['credencial_dispositivo'])).length
    : 0

  // Completitud de la ficha (fase J3): guia, nunca bloquea. Solo se
  // muestra cuando falta algo.
  // Tarea 321: "Facturación" sale en un POS, o en un equipo de otra
  // categoría que ya use alguna autorización (no se esconde una relación
  // que existe).
  const facturacion = conteoDeFacturacion(autorizaciones)
  const tieneFacturacion = esCategoriaPos(categoria?.nombre) || autorizaciones.some((a) => !a.eliminadoEn)
  const completitud = completitudDispositivo(dispositivo, esRed)

  // Pasos del bloque "Que sigue" (`recienCreado` ya capturado arriba):
  // se calculan en vivo contra el grafo ya cargado (useGrafo), asi que
  // un paso desaparece de la lista en cuanto se completa, sin recargar.
  const pasos = recienCreado
    ? pasosSiguientes(dispositivo, {
        puedeVerBoveda: Boolean(perfil?.puedeVerBoveda),
        tieneSeguridad: referenciasHacia(grafo, 'dispositivo', dispositivoId, ['campo_dispositivo']).length > 0,
        tieneConexiones: referenciasHacia(grafo, 'dispositivo', dispositivoId, ['conexion']).length > 0,
        tieneProcedimiento: referenciasHacia(grafo, 'dispositivo', dispositivoId, ['dispositivo_afectado']).length > 0,
      })
    : []

  // AVISOS DEL EQUIPO (tarea 329): lo que sus datos ya dicen que pide
  // atención, dicho bajo el carnet con su verbo. Sin datos nuevos.
  const autorizacionesEnUso = autorizaciones.filter((a) => !a.eliminadoEn && a.estado !== 'reemplazada')
  const conflictosAnotados = detalles.filter(([clave]) => /^conflicto/i.test(clave.trim()))
  const avisos: AvisoEquipo[] = [
    ...(autorizacionesEnUso.some((a) => a.estado === 'conflicto')
      ? [
          {
            clave: 'facturacion-conflicto',
            Icono: WarningCircle,
            texto: 'Autorización de facturación en conflicto',
            tono: 'error' as const,
            verbo: 'Ver',
            etiqueta: 'Ver la facturación del equipo: una autorización está en conflicto',
            onAbrir: () => setHoja('facturacion'),
          },
        ]
      : autorizacionesEnUso.some((a) => a.estado === 'documentada')
        ? [
            {
              clave: 'facturacion-validar',
              Icono: WarningCircle,
              texto: 'Autorización de facturación por validar',
              tono: 'precaucion' as const,
              verbo: 'Ver',
              etiqueta: 'Ver la facturación del equipo: una autorización está por validar',
              onAbrir: () => setHoja('facturacion'),
            },
          ]
        : []),
    ...(anotadoPorValidar
      ? [
          {
            clave: 'responsable-validar',
            Icono: User,
            texto: 'Responsable anotado, por validar',
            tono: 'precaucion' as const,
            verbo: 'Validar',
            etiqueta: 'Validar el responsable anotado',
            onAbrir: () => setAsignando(true),
          },
        ]
      : []),
    ...conflictosAnotados.map(([clave]) => ({
      clave: `detalle-${clave}`,
      Icono: WarningCircle,
      texto: clave.trim(),
      tono: 'error' as const,
      verbo: 'Ver',
      etiqueta: `Ver los datos del equipo: ${clave.trim()}`,
      onAbrir: () => setHoja('datos'),
    })),
  ]

  // El índice "Más del equipo" (tarea 329): un solo nivel, cada fila con lo
  // que guarda y su hoja. Mantenimiento y Facturación tendrán su pantalla
  // (tarea 331); hasta entonces abren lo de siempre en su hoja.
  const intervencionesValor =
    intervenciones.total === 0 ? 'Ninguna' : (tiempoRelativo(intervenciones.ultima) ?? String(intervenciones.total))
  const hayImpacto = equiposEnRiesgo > 0 || cadenaDependencia.length > 0
  const conCredenciales = Boolean(perfil?.puedeVerBoveda)

  // A dónde lleva "Resolver un problema": el diagnóstico de su categoría si
  // existe; si no, la hoja con todo lo que se resuelve con el equipo.
  const resolverBarra = hayDiagnosticos
    ? { to: `/diagnostico?categoria=${dispositivo.categoriaId}`, estado: origenEsteEquipo }
    : formasDeResolver.length > 0
      ? { onAbrir: () => setHoja('resolver') }
      : null

  return (
    // Nivel 2 del chasis (tarea 185): documento. Conserva las pestañas
    // (R19) y el regreso es contextual: un equipo de red vuelve a Red,
    // que es de donde se llega, y no a Equipos. Desde la tarea 329 las
    // pestañas se esconden al bajar y el nombre sube a la cabecera solo
    // cuando el carnet sale de la pantalla.
    <Chasis
      modo="documento"
      volverA={volverA}
      volverEtiqueta={esRed ? 'Red' : 'Equipos'}
      // Ancla permanente (M-001, M-R1): el nombre del equipo se queda en
      // pantalla al desplazarse, con de dónde viene y dónde está.
      titulo={dispositivo.nombre}
      contexto={[esRed ? 'Red' : 'Equipos', ubicacionNombre].filter(Boolean).join(' · ')}
      tituloVisible={!nombreALaVista}
      pestanasSeOcultanAlBajar
      // Desde 768 px, la acción de la barra fija sube a la cabecera, detrás
      // del menú (tarea 339). El chasis solo la pinta desde 768.
      accionPrincipal={
        <BarraAccionEquipo
          variante="cabecera"
          resolver={resolverBarra}
          onCredenciales={conCredenciales && totalCredenciales > 0 ? () => setHoja('credenciales') : null}
          abierta={hoja === 'credenciales' || hoja === 'resolver' ? hoja : null}
        />
      }
      acciones={
        // Favorito y Compartir viven en el menú desde la tarea 329: la
        // cabecera de un documento lleva el regreso, de qué es y "···".
        <button
          type="button"
          onClick={() => setMenuAbierto((v) => !v)}
          aria-label="Acciones del equipo: favorito, compartir, duplicar, editar, etiqueta QR, reemplazar, dar de baja o eliminar"
          aria-expanded={menuAbierto}
          className={BTN_ICONO_SECUNDARIO}
        >
          <DotsThreeOutline size={17} aria-hidden />
        </button>
      }
      barra={menuAbierto && (
        <div className="flex flex-col gap-3 px-4 pb-3 lg:px-10">
          <div className="flex flex-wrap gap-2">
            <BotonFavorito tipo="dispositivo" entidadId={dispositivoId} variante="menu" />
            <BotonCompartir titulo={dispositivo.nombre} />
            <Link
              to={`/dispositivos/nuevo?copiarDe=${dispositivoId}`}
              onClick={() => setMenuAbierto(false)}
              className={`shrink-0 ${BTN_SECUNDARIO}`}
            >
              <Copy size={14} aria-hidden />
              Duplicar
            </Link>
            <Link
              to={`/dispositivos/${dispositivoId}/editar`}
              onClick={() => setMenuAbierto(false)}
              className={`shrink-0 ${BTN_SECUNDARIO}`}
            >
              <PencilSimple size={14} aria-hidden />
              Editar
            </Link>
            <Link
              to="/dispositivos/etiquetas"
              // Etiquetas vuelve a este equipo, no a su puerta de inventario.
              state={origenEsteEquipo}
              onClick={() => setMenuAbierto(false)}
              className={`shrink-0 ${BTN_SECUNDARIO}`}
            >
              <QrCode size={14} aria-hidden />
              Etiqueta QR
            </Link>
            <Link
              to={`/dispositivos/nuevo?reemplazaA=${dispositivoId}`}
              onClick={() => setMenuAbierto(false)}
              className={`shrink-0 ${BTN_SECUNDARIO}`}
            >
              <ArrowsClockwise size={14} aria-hidden />
              Reemplazar
            </Link>
          </div>
          {/* LO DESTRUCTIVO, APARTE (regla 30): separado del resto por
              espacio y una línea, nunca junto a Editar. */}
          <div className="flex flex-wrap gap-2 border-t border-noct-divider pt-3">
            <Link
              to={`/dispositivos/${dispositivoId}/baja`}
              onClick={() => setMenuAbierto(false)}
              className={`shrink-0 ${BTN_SECUNDARIO}`}
            >
              <XCircle size={14} aria-hidden />
              Dar de baja
            </Link>
            <button
              type="button"
              onClick={() => {
                setMenuAbierto(false)
                setMostrarEliminar(true)
              }}
              className={BTN_GHOST_PELIGRO}
            >
              <TrashSimple size={14} aria-hidden />
              Eliminar
            </button>
          </div>
        </div>
      )}
    >
      {/* LA FICHA EN EL TELÉFONO (rediseño móvil "1b Pulgar", tarea 329,
          AD-079; antes, las cuatro capas de la auditoría móvil, M-014).

            Carnet y avisos   qué es, en qué estado y qué pide atención.
            Datos para trabajar
                              su IP copiable, dónde está, quién responde
                              de él y a qué está conectado, sin tarjeta.
                              Con los avisos, cabe en la primera pantalla.
            Resolver con este equipo
                              tres formas a la vista y "Ver N" con todas.
            Más del equipo    un índice de un solo nivel: cada fila dice lo
                              que guarda y abre su hoja.

          No se quita ni un dato: lo que iba en pliegues dentro de pliegues
          está ahora en hojas, una a la vez. Un solo eje vertical (R26,
          tarea 191): `lg:px-10`.

          POR ANCHO (tarea 339, T4; pizarras Ficha 768 y 1280): desde 768 los
          datos para trabajar y el índice van en dos columnas; desde 1280 el
          documento y, al lado, el índice de 344 px, pegado arriba al
          desplazarse. Es la misma lista de piezas: en el teléfono la
          envoltura del documento no existe (`contents`) y el orden de lectura
          no cambia. */}
      <main className="@container flex flex-1 flex-col gap-6 px-4 pb-4 pt-2 lg:px-10 md:gap-[26px] xl:grid xl:grid-cols-[minmax(0,1fr)_344px] xl:items-start xl:gap-x-12 xl:gap-y-7">
        <div className="contents xl:col-start-1 xl:row-start-1 xl:flex xl:min-w-0 xl:flex-col xl:gap-7">
        {/* Migracion pendiente (hallazgos L2/L3): este equipo reemplaza a
            otro que todavia tiene conexiones, credenciales o campos
            protegidos sin mover. */}
        {dispositivo.reemplazaA && (
          <BannerMigracionPendiente nuevoId={dispositivoId} viejoId={dispositivo.reemplazaA} />
        )}

        {pasos.length > 0 && <QueSigue pasos={pasos} dispositivoId={dispositivoId} />}

        {/* EL CARNET: qué es, a la vista y sin caja. Icono de 52 px, el
            nombre a 28 px (entero, es su identidad), debajo lo que el
            nombre no dice ya y, si nadie responde de él, "sin responsable"
            con su "Asignar". El estado, debajo y solo si está registrado:
            a la derecha le quitaba ancho al nombre, que a 28 px partía
            palabras ("Administracio-n"). Después, sus avisos. */}
        <section aria-label="Identidad del equipo" className="flex flex-col gap-3 pt-2">
          <div className="flex items-start gap-3.5">
            <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center overflow-hidden rounded-[14px] bg-noct-text/[.06] text-noct-neutral-300">
              {dispositivo.foto ? (
                <MiniaturaPortada
                  referencia={dispositivo.foto.referencia}
                  alt={dispositivo.nombre}
                  className="h-full w-full object-cover"
                />
              ) : (
                <IconoNodo tipo={tipoDeNodoVisual(categoria?.nombre ?? '')} className="h-[26px] w-[26px]" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span
                ref={setNodoNombre}
                data-nombre-equipo
                className="block text-[28px] font-[650] leading-[1.1] tracking-[-.02em] text-pretty [overflow-wrap:anywhere]"
              >
                {dispositivo.nombre}
              </span>
              {(lineaTipo || sinResponsable) && (
                <span
                  data-linea-identidad
                  className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[14px] leading-[1.4] text-noct-neutral-400"
                >
                  {/* El separador va pegado al final del primer tramo: si la
                      línea parte, "sin responsable" no empieza con un punto. */}
                  {lineaTipo && (
                    <span className="min-w-0">
                      {lineaTipo}
                      {sinResponsable ? ' ·' : ''}
                    </span>
                  )}
                  {sinResponsable && <span>sin responsable</span>}
                  {sinResponsable && !anotadoPorValidar && (
                    <button
                      type="button"
                      onClick={() => setAsignando(true)}
                      aria-label="Asignar un responsable"
                      className="-my-3 inline-flex min-h-11 items-center rounded-md px-1 text-[14px] font-semibold text-noct-accent-300 hover:bg-noct-accent/10"
                    >
                      Asignar
                    </button>
                  )}
                </span>
              )}
              {/* La misma pastilla de siempre (M-017). */}
              {dispositivo.estado && <PastillaEstadoDispositivo estado={dispositivo.estado} className="mt-2" />}
            </span>
          </div>
          <AvisosDelEquipo avisos={avisos} />
        </section>
        <HojaAsignarPersona dispositivo={dispositivo} abierto={asignando} onCerrar={() => setAsignando(false)} />

        {/* DATOS PARA TRABAJAR: lo que se usa con el equipo delante, sin
            tarjeta: filas con su divisor. Su IP en IBM Plex Mono a 20 px
            con copiar, dónde está, quién responde de él y a qué está
            conectado. Sin ninguno, no hay bloque. */}
        {(dispositivo.ip || ubicacionNombre || personaVivaACargo || anotadoPorValidar || subida) && (
        <section aria-label="Datos para trabajar" className="flex flex-col md:grid md:grid-cols-2 md:gap-x-8">
          {dispositivo.ip && (
            <div className="flex min-h-[68px] items-center gap-3 border-b border-noct-divider">
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] leading-snug text-noct-neutral-500">Dirección IP</p>
                <p className="font-mono text-[20px] font-medium leading-[1.3] tracking-[-.01em] [overflow-wrap:anywhere]">
                  {dispositivo.ip}
                </p>
              </div>
              <BotonCopiar etiqueta="Dirección IP" texto={dispositivo.ip} destacado />
            </div>
          )}

          {ubicacionNombre &&
            (ubicacionViva ? (
              <Link
                to={`/ubicaciones/${ubicacionViva.id}`}
                state={origenEsteEquipo}
                className="flex min-h-14 items-center gap-3 border-b border-noct-divider py-1.5 hover:bg-noct-text/[.04]"
              >
                <MapPin size={18} className="shrink-0 text-noct-neutral-500" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px] leading-snug text-noct-neutral-500">Ubicación</span>
                  <span className="block text-[15px] leading-snug text-noct-text [overflow-wrap:anywhere]">{ubicacionNombre}</span>
                </span>
                <CaretRight size={14} className="shrink-0 text-noct-neutral-500" aria-hidden />
              </Link>
            ) : (
              <span className="flex min-h-14 items-center gap-3 border-b border-noct-divider py-1.5">
                <MapPin size={18} className="shrink-0 text-noct-neutral-500" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px] leading-snug text-noct-neutral-500">Ubicación</span>
                  <span className="block text-[15px] leading-snug text-noct-neutral-200 [overflow-wrap:anywhere]">{ubicacionNombre}</span>
                </span>
              </span>
            ))}

          {/* Quién responde de él, con "Cambiar"; o el nombre anotado por
              validar, con "Asignar". Sin nadie, la fila no se dibuja: lo
              dice la línea del carnet. Un equipo de red solo la lleva si
              alguien lo anotó. Sus filas traen su propio margen (las de la
              tarjeta de antes): se compensa aquí. */}
          {aplicaResponsable && (
            <div className="-mx-3.5 border-b border-noct-divider empty:hidden md:mx-0 md:[&>*]:-mx-3.5">
              <ResponsableDelEquipo dispositivo={dispositivo} origen={origenEsteEquipo} ocultarSiNoHay />
            </div>
          )}

          {/* A QUÉ ESTÁ CONECTADO (sección 18): el switch que le da
              servicio y su puerto, que es lo que se busca en el rack. Abre
              la topología de este equipo. */}
          {subida && (
            <Link
              to={`/red/topologia/${dispositivoId}`}
              state={origenEsteEquipo}
              aria-label={`Conectado a ${textoConectadoA(nombreSubida, subida.extremo.puertoRemoto)}${
                subida.otros > 0 ? ` y ${subida.otros} más` : ''
              }. Ver conexión`}
              className="flex min-h-14 items-center gap-3 border-b border-noct-divider py-1.5 hover:bg-noct-text/[.04]"
            >
              <PlugsConnected size={18} className="shrink-0 text-noct-neutral-500" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] leading-snug text-noct-neutral-500">Conectado a</span>
                <span className="block font-mono text-[14.5px] leading-snug text-noct-text [overflow-wrap:anywhere]">
                  {textoConectadoA(nombreSubida, subida.extremo.puertoRemoto)}
                  {subida.otros > 0 && <span className="font-inter text-noct-neutral-500"> · y {subida.otros} más</span>}
                </span>
              </span>
              <CaretRight size={14} className="shrink-0 text-noct-neutral-500" aria-hidden />
            </Link>
          )}
        </section>
        )}

        <ResolverConEsteEquipo
          items={formasDeResolver.slice(0, 5)}
          total={formasDeResolver.length}
          onVerTodos={() => setHoja('resolver')}
          visibles={3}
          visiblesEscritorio={5}
        />
        </div>

        {/* MÁS DEL EQUIPO: un índice de un solo nivel (antes, un pliegue con
            pliegues dentro). Cada fila dice lo que guarda y abre su hoja;
            una sola a la vez. En dos columnas en la tableta y, desde 1280,
            en su columna de 344, pegado bajo la cabecera (T4). */}
        <section
          aria-labelledby="mas-del-equipo"
          className="flex flex-col xl:sticky xl:top-[84px] xl:col-start-2 xl:row-span-2 xl:row-start-1"
        >
          <h2 id="mas-del-equipo" className="pb-1 text-[17px] font-semibold tracking-[-.01em] xl:pb-1.5">
            Más del equipo
          </h2>
          <ul className="flex flex-col md:grid md:grid-cols-2 md:gap-x-7 xl:flex">
            <FilaIndice Icono={Info} titulo="Más datos" valor={`${totalMasDatos}`} abierta={hoja === 'datos'} onAbrir={() => setHoja('datos')} />
            {hayImpacto && (
              <FilaIndice
                Icono={WarningOctagon}
                titulo="Si falla, caen"
                valor={`${equiposEnRiesgo} ${equiposEnRiesgo === 1 ? 'equipo' : 'equipos'}`}
                tono="precaucion"
                abierta={hoja === 'impacto'}
                onAbrir={() => setHoja('impacto')}
              />
            )}
            <FilaIndice
              Icono={PlugsConnected}
              titulo="Conexiones"
              valor={totalConexiones === 0 ? 'Ninguna' : `${totalConexiones}`}
              abierta={hoja === 'conexiones'}
              onAbrir={() => setHoja('conexiones')}
            />
            {conCredenciales && (
              <FilaIndice
                Icono={Key}
                titulo="Credenciales"
                valor={totalCredenciales === 0 ? 'Ninguna' : `${totalCredenciales}`}
                abierta={hoja === 'credenciales'}
                onAbrir={() => setHoja('credenciales')}
              />
            )}
            {conCredenciales && (
              <FilaIndice
                Icono={LockSimple}
                titulo="Datos protegidos"
                valor={totalCamposProtegidos === 0 ? 'Ninguno' : `${totalCamposProtegidos}`}
                abierta={hoja === 'seguridad'}
                onAbrir={() => setHoja('seguridad')}
              />
            )}
            <FilaIndice
              Icono={Paperclip}
              titulo="Adjuntos"
              valor={totalAdjuntos === 0 ? 'Ninguno' : `${totalAdjuntos}`}
              abierta={hoja === 'adjuntos'}
              onAbrir={() => setHoja('adjuntos')}
            />
            {/* Mantenimiento se trabaja: abre su pantalla (tarea 331). */}
            <FilaIndice
              Icono={Wrench}
              titulo="Mantenimiento"
              valor={conteoDeMantenimientos(mantenimientos)}
              abre="pantalla"
              onAbrir={() => navigate(`/dispositivos/${dispositivoId}/mantenimientos`, { state: origenEsteEquipo })}
            />
            {tieneFacturacion && (
              <FilaIndice
                Icono={Storefront}
                titulo="Facturación"
                valor={facturacion.texto}
                tono={facturacion.revisar ? 'precaucion' : 'neutro'}
                abierta={hoja === 'facturacion'}
                onAbrir={() => setHoja('facturacion')}
              />
            )}
            <FilaIndice
              Icono={ClockCounterClockwise}
              titulo="Intervenciones"
              valor={intervencionesValor}
              abierta={hoja === 'intervenciones'}
              onAbrir={() => setHoja('intervenciones')}
            />
          </ul>
        </section>

        {/* La puerta única de documentar (M-016, M-031, regla M-R10). Desde
            1280, en la columna del documento, bajo lo demás. */}
        <div className="empty:hidden xl:col-start-1 xl:row-start-2 xl:min-w-0">
          <PuertaDocumentar
            dispositivo={dispositivo}
            categoriaNombre={categoria?.nombre ?? ''}
            puedeVerBoveda={Boolean(perfil?.puedeVerBoveda)}
            completitud={completitud}
          />
        </div>

        {/* La barra fija (M-R3): "Resolver un problema", relleno, y la llave
            de sus credenciales. */}
        {!ancho && (
          <BarraAccionEquipo
            resolver={resolverBarra}
            onCredenciales={conCredenciales && totalCredenciales > 0 ? () => setHoja('credenciales') : null}
          />
        )}
      </main>

      {/* LAS HOJAS (tarea 329): lo que antes iba plegado, ahora encima de la
          ficha, una a la vez. El contenido solo se monta con su hoja abierta. */}
      <HojaInferior abierta={hoja === 'datos'} onCerrar={cerrarHoja} titulo="Más datos del equipo" contexto={dispositivo.nombre}>
        <div className="divide-y divide-noct-divider">
          {camposContexto.map((campo) => (
            <FilaDato
              key={campo.etiqueta}
              etiqueta={campo.etiqueta}
              valor={campo.valor}
              tecnico={campo.tecnico}
              copiable={campo.valor}
            />
          ))}
          {detalles.map(([clave, valor]) => (
            <FilaDato key={clave} etiqueta={clave} valor={valor} copiable={valor} />
          ))}
          {reemplazaNombre && (
            <FilaDato etiqueta="Reemplaza a">
              <Link
                to={`/dispositivos/${dispositivo.reemplazaA}`}
                state={origenEsteEquipo}
                className="inline-flex min-w-0 flex-1 items-center gap-1.5 truncate text-[13.5px] text-noct-accent-300 hover:text-noct-accent-400"
              >
                <ArrowsClockwise size={14} className="shrink-0" aria-hidden />
                {reemplazaNombre}
              </Link>
            </FilaDato>
          )}
          {reemplazadoPor && (
            <FilaDato etiqueta="Reemplazado por">
              <Link
                to={`/dispositivos/${reemplazadoPor.id}`}
                state={origenEsteEquipo}
                className="inline-flex min-w-0 flex-1 items-center gap-1.5 truncate text-[13.5px] text-noct-accent-300 hover:text-noct-accent-400"
              >
                <ArrowsClockwise size={14} className="shrink-0" aria-hidden />
                {reemplazadoPor.nombre}
              </Link>
            </FilaDato>
          )}
          <ResponsablesAnteriores periodos={anterioresResponsables} origen={origenEsteEquipo} />
          <FilaDato etiqueta="Categoría y fecha">
            <span className="min-w-0 flex-1 truncate text-[13.5px] text-noct-neutral-300">{metaLinea}</span>
          </FilaDato>
        </div>
        {dispositivo.observaciones && (
          <p className="mt-2.5 whitespace-pre-wrap text-[13px] leading-[1.55] text-noct-neutral-300">
            {dispositivo.observaciones}
          </p>
        )}
      </HojaInferior>

      <HojaInferior abierta={hoja === 'impacto'} onCerrar={cerrarHoja} titulo="Si falla, caen" contexto={dispositivo.nombre}>
        <ImpactoYDependencias dispositivo={dispositivo} sinCabecera />
      </HojaInferior>

      <HojaInferior abierta={hoja === 'conexiones'} onCerrar={cerrarHoja} titulo="Conexiones" contexto={dispositivo.nombre}>
        <ConexionesFicha dispositivo={dispositivo} sinCabecera />
      </HojaInferior>

      {conCredenciales && (
        <HojaInferior abierta={hoja === 'credenciales'} onCerrar={cerrarHoja} titulo="Credenciales" contexto={dispositivo.nombre}>
          {totalCredenciales > 0 ? (
            <div className="flex flex-col">
              <CredencialesDelEquipo dispositivoId={dispositivoId} puedeVerBoveda />
            </div>
          ) : (
            <p className="text-[14px] leading-snug text-noct-neutral-400">Ninguna credencial de la Bóveda da acceso a este equipo.</p>
          )}
        </HojaInferior>
      )}

      {conCredenciales && (
        <HojaInferior abierta={hoja === 'seguridad'} onCerrar={cerrarHoja} titulo="Datos protegidos" contexto={dispositivo.nombre}>
          <SeguridadDelEquipo
            dispositivoId={dispositivoId}
            puedeVerBoveda
            nombreSugerido={nombreCampoSugerido}
            sinCabecera
          />
        </HojaInferior>
      )}

      <HojaInferior abierta={hoja === 'adjuntos'} onCerrar={cerrarHoja} titulo="Adjuntos" contexto={dispositivo.nombre}>
        {dispositivo.foto && <FotoDispositivo referencia={dispositivo.foto.referencia} nombre={dispositivo.nombre} />}
        <Adjuntos entidadTipo="dispositivo" entidadId={dispositivoId} sinCabecera />
      </HojaInferior>

      {tieneFacturacion && (
        <HojaInferior abierta={hoja === 'facturacion'} onCerrar={cerrarHoja} titulo="Facturación" contexto={dispositivo.nombre}>
          <AutorizacionesDelPos dispositivoId={dispositivoId} nombre={dispositivo.nombre} />
        </HojaInferior>
      )}

      <HojaInferior abierta={hoja === 'intervenciones'} onCerrar={cerrarHoja} titulo="Intervenciones" contexto={dispositivo.nombre}>
        <div className="flex flex-col gap-2.5">
          <RegistrarIntervencion dispositivoId={dispositivoId} />
          <Historial entidadTipo="dispositivo" entidadId={dispositivoId} />
        </div>
      </HojaInferior>

      {/* Todo lo que se resuelve con el equipo: sus problemas frecuentes, sus
          procedimientos y, al final, el diagnóstico de su categoría. */}
      <HojaInferior
        abierta={hoja === 'resolver'}
        onCerrar={cerrarHoja}
        titulo="Resolver con este equipo"
        contexto={dispositivo.nombre}
      >
        <div className="flex flex-col gap-4">
          {totalProblemas > 0 && (
            <div className="flex flex-col">
              <h3 className="pb-1 text-[13.5px] font-semibold text-noct-neutral-400">Problemas frecuentes</h3>
              <ProblemasDelEquipo
                dispositivoId={dispositivoId}
                categoriaId={dispositivo.categoriaId}
                categoriaNombre={categoria?.nombre}
                marca={dispositivo.marca}
                modelo={dispositivo.modelo}
              />
            </div>
          )}
          {totalResolver > 0 && (
            <div className="flex flex-col">
              <h3 className="pb-1 text-[13.5px] font-semibold text-noct-neutral-400">Procedimientos</h3>
              <ProcedimientosDelEquipo
                dispositivoId={dispositivoId}
                categoriaId={dispositivo.categoriaId}
                categoriaNombre={categoria?.nombre}
                marca={dispositivo.marca}
                modelo={dispositivo.modelo}
              />
            </div>
          )}
          <IniciarDiagnosticoBoton
            categoriaId={dispositivo.categoriaId}
            categoriaNombre={categoria?.nombre}
            // La lista de problemas vuelve a este equipo (M-R2).
            estado={origenEsteEquipo}
          />
        </div>
      </HojaInferior>

      <DialogoEliminar
        abierto={mostrarEliminar}
        sensible
        titulo={`¿Eliminar el equipo "${dispositivo.nombre}"?`}
        descripcion="Esta acción eliminará la ficha del equipo, sus campos y sus conexiones registradas."
        advertencia={impacto ? `${impacto} Esas referencias quedarán rotas.` : null}
        onCerrar={() => setMostrarEliminar(false)}
        onConfirmar={eliminar}
      />
    </Chasis>
  )
}

// Icono de cada paso sugerido (hallazgo O1).
const ICONO_PASO: Record<PasoSiguiente['clave'], typeof Camera> = {
  foto: Camera,
  seguridad: LockSimple,
  conexiones: PlugsConnected,
  procedimiento: BookOpen,
}

// Bloque "Que sigue" (hallazgo O1 de la auditoría de flujos): documentar
// un equipo completo hoy cruza 4 contextos de la misma ficha, recorridos
// de a uno. En vez de un asistente por pasos (stepper) completo, se
// muestra una sola vez justo después de crear el equipo (decisión del
// usuario, 2026-07-22), con enlaces directos a lo que falta.
function QueSigue({ pasos, dispositivoId }: { pasos: PasoSiguiente[]; dispositivoId: string }) {
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-noct-accent/35 bg-noct-accent/[.08] p-3.5">
      <p className="text-[11px] font-medium uppercase tracking-[0.07em] text-noct-accent-300">¿Qué sigue?</p>
      <div className="flex flex-col">
        {pasos.map((paso) => {
          const Icono = ICONO_PASO[paso.clave]
          const fila = (
            <>
              <Icono size={16} className="shrink-0 text-noct-accent-300" aria-hidden />
              <span className="min-w-0 flex-1">{paso.etiqueta}</span>
              <CaretRight size={14} className="shrink-0 text-noct-neutral-500" aria-hidden />
            </>
          )
          const clase = 'flex min-h-11 items-center gap-2.5 rounded-md px-1.5 text-[13px] text-noct-text hover:bg-noct-text/[.06]'
          // "foto" navega al formulario (unico dato de estos 4 que se
          // edita ahi); el resto es un ancla NATIVA (<a href="#...">,
          // no <Link>) a una seccion que ya esta mas abajo en esta misma
          // ficha: el salto lo resuelve el navegador, sin depender de
          // que React Router reaccione al cambio de hash. Desde la tarea
          // 256 "procedimiento" apunta a la puerta de documentar (que se
          // abre sola con ese ancla): la seccion "Accion" a la que
          // apuntaba ya no existe, y ahi es donde se vincula o reporta.
          return paso.clave === 'foto' ? (
            <Link key={paso.clave} to={`/dispositivos/${dispositivoId}/editar`} className={clase}>
              {fila}
            </Link>
          ) : (
            <a key={paso.clave} href={`#${paso.clave === 'procedimiento' ? 'documentar' : paso.clave}`} className={clase}>
              {fila}
            </a>
          )
        })}
      </div>
    </section>
  )
}

// Aviso de migración pendiente (hallazgos L2/L3): este equipo se creó
// como reemplazo de otro (`reemplazaA`) pero la migración de conexiones,
// credenciales o campos protegidos todavía no se hizo (se dejó "para
// después" desde ReemplazoPage). Reutiliza la misma `dependenciasDeBaja`
// que la pantalla de migración, así el aviso desaparece solo en cuanto
// no quede nada pendiente.
function BannerMigracionPendiente({ nuevoId, viejoId }: { nuevoId: string; viejoId: string }) {
  const conexiones = useLiveQuery(() => db.conexiones.filter((c) => !c.eliminadoEn).toArray(), [], [])
  const credenciales = useLiveQuery(() => db.credenciales.filter((c) => !c.eliminadoEn).toArray(), [], [])
  const camposProtegidos = useLiveQuery(
    () => db.campos_protegidos.filter((c) => !c.eliminadoEn).toArray(),
    [],
    [],
  )
  const dependencias = useMemo(
    () => dependenciasDeBaja(viejoId, { conexiones, credenciales, camposProtegidos }),
    [viejoId, conexiones, credenciales, camposProtegidos],
  )

  if (sinDependencias(dependencias)) return null

  return (
    <Link
      to={`/dispositivos/${nuevoId}/reemplazo`}
      className="flex items-center gap-2.5 rounded-md border border-noct-precaucion/35 bg-noct-precaucion/[.08] px-[13px] py-2.5 text-noct-text"
    >
      <ArrowsClockwise size={17} className="shrink-0 text-noct-precaucion" aria-hidden />
      <span className="min-w-0 flex-1 text-[13px] leading-[1.45]">
        Este equipo reemplaza a otro que todavía tiene conexiones, credenciales o campos protegidos sin migrar.
      </span>
      <CaretRight size={14} className="shrink-0 text-noct-neutral-500" aria-hidden />
    </Link>
  )
}

// Puerta única de la autoría en la ficha de equipo (hallazgos M-016 y
// M-031, regla M-R10: la autoría tiene una sola puerta por pantalla,
// nombrada, al pie). Plegada de entrada: en el teléfono lo normal es
// consultar, así que documentar se ofrece sin ocupar sitio, y al abrirse
// da las cuatro puertas juntas en vez de repartidas por el cuerpo.
function PuertaDocumentar({
  dispositivo,
  categoriaNombre,
  puedeVerBoveda,
  completitud,
}: {
  dispositivo: Dispositivo
  categoriaNombre: string
  puedeVerBoveda: boolean
  completitud: { porcentaje: number; faltantes: string[] }
}) {
  // El ancla #documentar (paso "procedimiento" del bloque "¿Qué sigue?",
  // tarea 256) la abre: llegar a una puerta cerrada obligaría a buscar el
  // control que la abre. Se ajusta en el render al cambiar el hash, sin
  // efecto (patrón "estado derivado de una prop" de React).
  const { hash } = useLocation()
  const [abierta, setAbierta] = useState(hash === '#documentar')
  const [hashVisto, setHashVisto] = useState(hash)
  if (hash !== hashVisto) {
    setHashVisto(hash)
    if (hash === '#documentar') setAbierta(true)
  }
  const nombreCodificado = encodeURIComponent(dispositivo.nombre)

  return (
    <div id="documentar" className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setAbierta((v) => !v)}
        aria-expanded={abierta}
        className="flex min-h-11 items-center gap-2 text-left text-[12px] leading-[1.5] text-noct-neutral-400 hover:text-noct-neutral-300"
      >
        <PencilSimple size={14} className="shrink-0" aria-hidden />
        <span className="min-w-0 flex-1">
          Documentar este equipo · foto, procedimiento o incidencia
          <span className="text-noct-neutral-600"> se hace mejor desde el ordenador</span>
        </span>
        <CaretDown
          size={13}
          className={`shrink-0 transition-transform duration-150 motion-reduce:transition-none ${
            abierta ? 'rotate-180' : ''
          }`}
          aria-hidden
        />
      </button>

      {/* La completitud deja de ser ámbar (regla M-R11: el ámbar es
          advertencia y nada más; una ficha a medias no lo es) y deja de
          encabezar la pantalla: vive donde se resuelve. */}
      {abierta && (
        <div className="flex flex-col gap-2">
          {completitud.faltantes.length > 0 && (
            <p className="text-[12px] leading-[1.5] text-noct-neutral-400">
              Ficha al {completitud.porcentaje}%. Falta: {completitud.faltantes.join(', ')}.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Link to={`/dispositivos/${dispositivo.id}/editar`} className={BTN_SECUNDARIO}>
              <PencilSimple size={13} aria-hidden />
              Editar la ficha
            </Link>
            {/* Creacion contextual (fase N2, punto 1): precarga la
                categoria y el equipo afectado, asi ningun dato visible
                aqui se vuelve a escribir a mano en el formulario.
                "Documentar procedimiento" (hallazgo K6 de
                AUDITORIA_FLUJOS_TI.md) es el mismo mecanismo de
                "Reportar incidencia" pero sin forzar
                tipo=problema_frecuente. */}
            <Link
              to={`/soluciones/${dispositivo.categoriaId}/nuevo?tipo=problema_frecuente&dispositivoAfectado=${dispositivo.id}&dispositivoNombre=${nombreCodificado}`}
              className={BTN_SECUNDARIO}
            >
              <Plus size={13} aria-hidden />
              Reportar incidencia
            </Link>
            <Link
              to={`/soluciones/${dispositivo.categoriaId}/nuevo?dispositivoAfectado=${dispositivo.id}&dispositivoNombre=${nombreCodificado}`}
              className={BTN_SECUNDARIO}
            >
              <BookOpen size={13} aria-hidden />
              Documentar procedimiento
            </Link>
            {puedeVerBoveda && (
              <Link
                to={`/boveda/nueva?titulo=${encodeURIComponent(`Acceso ${dispositivo.nombre}`)}&categoria=${encodeURIComponent(categoriaNombre)}&dispositivoId=${dispositivo.id}&dispositivoNombre=${nombreCodificado}`}
                className={BTN_SECUNDARIO}
              >
                <LockSimple size={13} aria-hidden />
                Guardar secreto
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Compartir el enlace de la ficha con el diálogo nativo del teléfono, o
// copiarlo al portapapeles donde no exista. Desde la tarea 329 vive en el
// menú "···", con su palabra.
function BotonCompartir({ titulo }: { titulo: string }) {
  const [copiado, setCopiado] = useState(false)

  async function compartir() {
    if ((await compartirOCopiar(titulo)) === 'copiado') {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1500)
    }
  }

  return (
    <button
      type="button"
      onClick={() => void compartir()}
      className={`shrink-0 ${BTN_SECUNDARIO}`}
    >
      {copiado ? <Check size={14} className="text-noct-exito" aria-hidden /> : <ShareNetwork size={14} aria-hidden />}
      {copiado ? 'Enlace copiado' : 'Compartir la ficha'}
    </button>
  )
}

// Fotografia principal del equipo como banner sobre el titulo. Si aun
// no esta disponible (offline sin cache) no se muestra nada.
function FotoDispositivo({ referencia, nombre }: { referencia: string; nombre: string }) {
  const url = useUrlAdjunto(referencia)
  if (!url) return null
  return (
    <img
      src={url}
      alt={`Fotografía: ${nombre}`}
      className="h-[150px] w-full rounded-md border border-noct-divider object-cover"
    />
  )
}
