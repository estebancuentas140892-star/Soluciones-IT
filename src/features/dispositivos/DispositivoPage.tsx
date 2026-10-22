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
import { conOrigen, type EstadoConOrigen } from '../../lib/origenNavegacion'
import { Chasis } from '../../app/Chasis'
import { usePerfilVivo } from '../autenticacion/usePerfilVivo'
import { Adjuntos } from '../../components/Adjuntos'
import { BotonFavorito } from '../../components/BotonFavorito'
import { DialogoEliminar } from '../../components/DialogoEliminar'
import { BotonCopiar, FilaDato } from '../../components/FilaDato'
import { EsqueletoFicha } from '../../components/Esqueleto'
import { HojaInferior } from '../../components/HojaInferior'
import { avisar } from '../../components/avisosFlotantes'
import { MiniaturaPortada } from '../../components/MiniaturaPortada'
import { ANCHO_AMPLIO, useEsAncho } from '../../components/useEsAncho'
import { useGrafo } from '../../components/useGrafo'
import { useUrlAdjunto } from '../../components/useUrlAdjunto'
import {
  ArrowsClockwise,
  BookOpen,
  CaretDown,
  CaretRight,
  CaretUp,
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
import {
  BTN_GHOST_PELIGRO,
  BTN_ICONO_SECUNDARIO,
  BTN_SECUNDARIO,
  FILA_ACCION_HOJA,
  FILA_ACCION_HOJA_PELIGRO,
} from '../../components/nocturne'
import { ImpactoYDependencias } from '../red/ImpactoYDependencias'
import { useImpactoEquipo } from '../red/useImpactoEquipo'
import { ConexionesFicha } from '../red/ConexionesFicha'
import { IconoNodo } from '../red/IconoNodo'
import { tipoDeNodoVisual } from '../red/topologiaVisual'
import { IconoCategoria } from '../../components/IconoCategoria'
import { IconoVentana } from '../../components/ventana/IconoVentana'
import { TITULO_SECCION } from '../../components/ventana/estilos'
import { esDeRed } from '../../lib/categorias'
import { procedimientosDeCategoria, procedimientosDeDispositivo } from './procedimientosDeDispositivo'
import { problemasDeCategoria, problemasDeDispositivo } from './problemasDeDispositivo'
import { Historial } from '../historial/Historial'
import { IniciarDiagnosticoBoton } from './IniciarDiagnosticoBoton'
import {
  AvisosDelEquipo,
  BarraAccionEquipo,
  FilaIndice,
  ResolverConEsteEquipo,
  type AvisoEquipo,
  type ItemResolver,
} from './PiezasFicha'
import { ZonaListaEquipos } from './ZonaListaEquipos'
import { rutaGuiaConEquipo } from '../soluciones/contextoEjecucion'
import { normalizarProcedimiento } from '../../lib/procedimiento'
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
import { resumenDeMantenimientos } from '../mantenimientos/mantenimiento'
import { esCategoriaPos, resumenDeFacturacion } from '../facturacion/autorizacion'
import { useBovedaDesbloqueada } from '../boveda/useSesionBoveda'
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
  // Con permiso pero la Bóveda bloqueada, la fila de credenciales lo dice
  // ("Bloqueadas", tarea 342): sus títulos se ven, lo que dan no.
  const bovedaAbierta = useBovedaDesbloqueada()
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
  // Desde 1680, la ficha entre la lista de Equipos y su índice (T10): el
  // índice deja el documento y pasa a su zona, una sola vez por ventana.
  const amplio = useEsAncho(ANCHO_AMPLIO)
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
  // Mientras se lee la copia local, la forma de la ficha (tarea 342): nada
  // se afirma antes de leer.
  if (!dispositivo) {
    return (
      <Chasis modo="documento">
        <main className="flex flex-1 flex-col px-4 pb-4 pt-2">
          <EsqueletoFicha />
        </main>
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
  // La MAC, si el equipo la escribió entre sus detalles (tarea 350).
  const mac = detalles.find(([clave]) => /^(direcci[oó]n\s+)?mac$/i.test(clave.trim()))?.[1].trim() ?? ''
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
  const pasosDe = (articulo: (typeof articulos)[number]) => normalizarProcedimiento(articulo.procedimiento)?.pasos.length
  const formasDeResolver: ItemResolver[] = [
    ...problemas.map((a) => ({
      id: a.id,
      ruta: rutaGuiaConEquipo(`/soluciones/${a.categoriaId}/${a.id}`, dispositivoId),
      Icono: WarningCircle,
      tipo: 'Problema frecuente',
      titulo: a.titulo,
      extra: a.sintomas[0],
      pasos: pasosDe(a),
    })),
    ...procedimientos.map((a) => ({
      id: a.id,
      ruta: rutaGuiaConEquipo(`/soluciones/${a.categoriaId}/${a.id}`, dispositivoId),
      Icono: BookOpen,
      tipo: etiquetaDeTipo(a.tipo),
      titulo: a.titulo,
      pasos: pasosDe(a),
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
  const facturacion = resumenDeFacturacion(autorizaciones)
  const mantenimiento = resumenDeMantenimientos(mantenimientos)
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

  const abrirMantenimiento = () =>
    navigate(`/dispositivos/${dispositivoId}/mantenimientos`, { state: origenEsteEquipo })
  // EL MANTENIMIENTO, A LA VISTA EN EL TELÉFONO (tarea 344): lo mismo que dice
  // su fila del índice, en una frase. Sin ninguno registrado, "Nada
  // programado" (decir "Al día" de algo que nunca se programó confunde).
  const lineaMantenimiento =
    mantenimiento.texto === 'Atrasado'
      ? 'Atrasado'
      : mantenimiento.texto === 'Hoy'
        ? 'Toca hoy'
        : mantenimiento.texto !== 'Al día'
          ? `Programado para el ${mantenimiento.texto}`
          : mantenimientos.some((m) => !m.eliminadoEn)
            ? 'Al día'
            : 'Nada programado'

  // A dónde lleva "Resolver un problema": el diagnóstico de su categoría si
  // existe; si no, la hoja con todo lo que se resuelve con el equipo.
  const resolverBarra = hayDiagnosticos
    ? { to: `/diagnostico?categoria=${dispositivo.categoriaId}`, estado: origenEsteEquipo }
    : formasDeResolver.length > 0
      ? { onAbrir: () => setHoja('resolver') }
      : null

  // MÁS DEL EQUIPO: un índice de un solo nivel (antes, un pliegue con
  // pliegues dentro). Cada fila dice lo que guarda y abre su hoja;
  // una sola a la vez. En dos columnas en la tableta y, desde 1280,
  // en su columna de 344, pegado bajo la cabecera (T4). Desde 1680, en la
  // zona de contexto del chasis, que ya va pegada y se desplaza sola (T10).
  const masDelEquipo = (
    <section
      aria-labelledby="mas-del-equipo"
      className="flex flex-col xl:sticky xl:top-[84px] xl:col-start-2 xl:row-span-2 xl:row-start-1 3xl:static"
    >
      <h2
        id="mas-del-equipo"
        className={
          ancho ? 'pb-1 text-[17px] font-semibold tracking-[-.01em] xl:pb-1.5' : `pb-2.5 ${TITULO_SECCION}`
        }
      >
        {ancho ? 'Más del equipo' : 'Información del equipo'}
      </h2>
      <ul
        className={
          ancho
            ? 'flex flex-col md:grid md:grid-cols-2 md:gap-x-7 xl:flex'
            : 'flex flex-col rounded-2xl border-[1.5px] border-noct-divider bg-noct-surface px-3.5 [&>li:last-child>button]:border-b-0'
        }
      >
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
            // Con la Bóveda bloqueada, que las hay pero cerradas (tarea 342).
            valor={totalCredenciales === 0 ? 'Ninguna' : bovedaAbierta ? `${totalCredenciales}` : 'Bloqueadas'}
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
        {/* Mantenimiento se trabaja: abre su pantalla (tarea 331). Su valor
            dice si algo pide atención o si está al día (tarea 342). En el
            teléfono tiene su propia fila, a la vista, bajo los datos para
            trabajar (tarea 344): aquí no se repite. */}
        {ancho && (
          <FilaIndice
            Icono={Wrench}
            titulo="Mantenimiento"
            valor={mantenimiento.texto}
            tono={mantenimiento.tono}
            abre="pantalla"
            onAbrir={abrirMantenimiento}
          />
        )}
        {tieneFacturacion && (
          <FilaIndice
            Icono={Storefront}
            titulo="Facturación"
            valor={facturacion.texto}
            tono={facturacion.tono}
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
  )

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
      // Desde 1680: la lista de Equipos y el índice a los lados (T10).
      zonas={amplio ? { lista: <ZonaListaEquipos actualId={dispositivoId} />, contexto: masDelEquipo } : undefined}
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
          aria-haspopup={ancho ? undefined : 'dialog'}
          className={BTN_ICONO_SECUNDARIO}
        >
          <DotsThreeOutline size={17} aria-hidden />
        </button>
      }
      // EN EL TELÉFONO, EL MENÚ ES UNA HOJA (tarea 342, handoff móvil "1b
      // Pulgar"): ver `MenuEnHoja`, al final. Desde 768, la banda de
      // siempre bajo la cabecera.
      barra={menuAbierto && ancho && (
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
      <main className="@container flex flex-1 flex-col gap-6 px-4 pb-4 pt-2 lg:px-10 md:gap-[26px] xl:grid xl:grid-cols-[minmax(0,1fr)_344px] xl:items-start xl:gap-x-12 xl:gap-y-7 3xl:flex 3xl:gap-7">
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
          {/* EL CARNET EN EL TELÉFONO (tarea 344, DESPUÉS de Claude Design):
              qué es, encima; el nombre a 28 px con todo el ancho (sin el
              icono, que lo partía en más líneas; la foto, si la hay, a la
              derecha) y el estado con su palabra.
              Quién responde de él va en los datos para trabajar, con su
              "Asignar" si no hay nadie. Desde 768, el de siempre. */}
          {!ancho ? (
            <div className="flex items-start gap-3 px-0.5">
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                {/* QUÉ CLASE DE EQUIPO ES, DE UN VISTAZO (tarea 349, panel del
                    equipo de Ventana): el icono de su tipo, el de la lista y
                    los resultados, en un recuadro junto a su categoría y su
                    modelo. Va en esta línea y no junto al nombre, que conserva
                    todo el ancho. */}
                {/* EL «ICONO DE CATEGORÍA» A 48 (tarea 350, ficha del prototipo
                    de Claude Design): la clase del equipo con su color, junto a
                    qué es. */}
                {(lineaTipo || categoria) && (
                  <span className="flex min-w-0 items-center gap-3">
                    <span data-icono-tipo-equipo={tipoDeNodoVisual(categoria?.nombre ?? '')} className="contents">
                      <IconoCategoria nombre={categoria?.nombre} tam={48} />
                    </span>
                    {lineaTipo && (
                      <span
                        data-linea-identidad
                        className="min-w-0 text-[14.5px] font-bold leading-snug text-noct-neutral-300 [overflow-wrap:anywhere]"
                      >
                        {lineaTipo}
                      </span>
                    )}
                  </span>
                )}
                <span
                  ref={setNodoNombre}
                  data-nombre-equipo
                  className="block pt-1 text-[28px] font-extrabold leading-[1.1] tracking-[-.02em] text-pretty [overflow-wrap:anywhere]"
                >
                  {dispositivo.nombre}
                </span>
                {dispositivo.estado && (
                  <PastillaEstadoDispositivo estado={dispositivo.estado} conPunto className="mt-1 self-start" />
                )}
              </div>
              {/* Con foto, a la derecha: también identifica el equipo. */}
              {dispositivo.foto && (
                <span className="h-14 w-14 shrink-0 overflow-hidden rounded-[14px] bg-noct-text/[.06]">
                  <MiniaturaPortada
                    referencia={dispositivo.foto.referencia}
                    alt={dispositivo.nombre}
                    className="h-full w-full object-cover"
                  />
                </span>
              )}
            </div>
          ) : (
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
              {/* La misma pastilla de siempre (M-017); en el teléfono, con su
                  punto delante, como el carnet del handoff (tarea 342). */}
              {dispositivo.estado && <PastillaEstadoDispositivo estado={dispositivo.estado} conPunto className="mt-2" />}
            </span>
          </div>
          )}
          <AvisosDelEquipo avisos={avisos} />
        </section>
        <HojaAsignarPersona dispositivo={dispositivo} abierto={asignando} onCerrar={() => setAsignando(false)} />

        {/* DATOS PARA TRABAJAR: lo que se usa con el equipo delante, sin
            tarjeta: filas con su divisor. Su IP en IBM Plex Mono a 20 px
            con copiar, dónde está, quién responde de él y a qué está
            conectado. Sin ninguno, no hay bloque. */}
        {(dispositivo.ip ||
          ubicacionNombre ||
          personaVivaACargo ||
          anotadoPorValidar ||
          subida ||
          (!ancho && (sinResponsable || dispositivo.serial || mac || dispositivo.placaInventario))) && (
        <section
          aria-label="Datos para trabajar"
          // En el teléfono, una tarjeta (tarea 344): los datos que se usan con
          // el equipo delante, juntos y separados de lo demás.
          // LA TABLA DEL PROTOTIPO (tarea 350): el rótulo en su columna de 78 y
          // el dato a su lado, copiable donde se copia.
          className="flex flex-col md:grid md:grid-cols-2 md:gap-x-8 max-md:rounded-2xl max-md:border-[1.5px] max-md:border-noct-divider max-md:bg-noct-surface max-md:px-3.5 max-md:[&>*:last-child]:border-b-0"
        >
          {dispositivo.ip && !ancho && (
            <FilaDatoTelefono etiqueta="IP" mono>
              {dispositivo.ip}
              <BotonCopiar etiqueta="Dirección IP" texto={dispositivo.ip} ventana aviso={`IP copiada: ${dispositivo.ip}`} />
            </FilaDatoTelefono>
          )}
          {dispositivo.ip && ancho && (
            <div className="flex min-h-[68px] items-center gap-3 border-b border-noct-divider">
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] leading-snug text-noct-neutral-500">Dirección IP</p>
                <p className="font-mono text-[20px] font-medium leading-[1.3] tracking-[-.01em] [overflow-wrap:anywhere]">
                  {dispositivo.ip}
                </p>
              </div>
              {/* En el teléfono, "Copiar" con su palabra (tarea 344): el
                  icono solo no decía qué hacía. */}
              <BotonCopiar
                etiqueta="Dirección IP"
                texto={dispositivo.ip}
                destacado={ancho}
                grande={ancho}
                conTexto={!ancho}
                aviso={`IP copiada: ${dispositivo.ip}`}
              />
            </div>
          )}

          {/* EL SERIAL, A LA VISTA EN EL TELÉFONO (tarea 349): es lo que pide
              el proveedor o la mesa de ayuda con el equipo delante, y estaba
              a un toque, dentro de «Más datos». Aquí, compacto y con su
              «Copiar», bajo la IP. «Más datos» sigue guardando el registro
              completo. Desde 768, como siempre. */}
          {!ancho && dispositivo.serial && (
            <FilaDatoTelefono etiqueta="Serial" mono marca="data-serial-equipo">
              {dispositivo.serial}
              <BotonCopiar etiqueta="Número de serie" texto={dispositivo.serial} ventana aviso={`Serial copiado: ${dispositivo.serial}`} />
            </FilaDatoTelefono>
          )}
          {/* LA MAC Y LA PLACA, A LA VISTA EN EL TELÉFONO (tarea 350): la
              tabla del prototipo las enseña con la IP y el serial; antes
              estaban en «Más datos», que las sigue guardando. La MAC es un
              detalle escrito por el equipo («MAC», «Dirección MAC»). */}
          {!ancho && mac && (
            <FilaDatoTelefono etiqueta="MAC" mono>
              {mac}
              <BotonCopiar etiqueta="Dirección MAC" texto={mac} ventana aviso={`MAC copiada: ${mac}`} />
            </FilaDatoTelefono>
          )}
          {!ancho && dispositivo.placaInventario && (
            <FilaDatoTelefono etiqueta="Placa" mono>
              {dispositivo.placaInventario}
            </FilaDatoTelefono>
          )}

          {/* La ubicación, en la tabla del teléfono (tarea 350): su rótulo y,
              si tiene ficha, la abre. */}
          {ubicacionNombre && !ancho && (
            ubicacionViva ? (
              <Link
                to={`/ubicaciones/${ubicacionViva.id}`}
                state={origenEsteEquipo}
                className="flex min-h-[52px] items-center gap-2.5 border-b border-noct-divider py-1 text-noct-text active:bg-noct-presionado"
              >
                <span className="w-[78px] shrink-0 text-[13.5px] font-bold leading-snug text-noct-neutral-300">Ubicación</span>
                <span className="min-w-0 flex-1 text-[15px] font-semibold leading-snug [overflow-wrap:anywhere]">{ubicacionNombre}</span>
                <IconoVentana nombre="adelante" tam={18} className="shrink-0 text-noct-neutral-400" />
              </Link>
            ) : (
              <FilaDatoTelefono etiqueta="Ubicación">{ubicacionNombre}</FilaDatoTelefono>
            )
          )}
          {ubicacionNombre && ancho &&
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
            // Su divisor, al margen de las demás filas; la fila, compensada.
            <div className="border-b border-noct-divider empty:hidden [&>*]:-mx-3.5">
              <ResponsableDelEquipo dispositivo={dispositivo} origen={origenEsteEquipo} ocultarSiNoHay={ancho} />
            </div>
          )}

          {/* A QUÉ ESTÁ CONECTADO (sección 18): el switch que le da
              servicio y su puerto, que es lo que se busca en el rack. Desde
              la tarea 342 abre la hoja de Conexiones (se consulta sin dejar
              la ficha), que lleva su "Ver en topología". */}
          {subida && !ancho && (
            <button
              type="button"
              onClick={() => setHoja('conexiones')}
              aria-haspopup="dialog"
              aria-expanded={hoja === 'conexiones'}
              aria-label={`Conectado a ${textoConectadoA(nombreSubida, subida.extremo.puertoRemoto)}${
                subida.otros > 0 ? ` y ${subida.otros} más` : ''
              }. Ver sus conexiones`}
              className="flex min-h-[52px] w-full items-center gap-2.5 border-b border-noct-divider py-1 text-left text-noct-text active:bg-noct-presionado"
            >
              <span className="w-[78px] shrink-0 text-[13.5px] font-bold leading-snug text-noct-neutral-300">Conectado a</span>
              <span className="min-w-0 flex-1 font-mono text-[14.5px] font-semibold leading-snug [overflow-wrap:anywhere]">
                {textoConectadoA(nombreSubida, subida.extremo.puertoRemoto)}
                {subida.otros > 0 && <span className="font-inter text-noct-neutral-300"> · y {subida.otros} más</span>}
              </span>
              <IconoVentana nombre="adelante" tam={18} className="shrink-0 text-noct-neutral-400" />
            </button>
          )}
          {subida && ancho && (
            <button
              type="button"
              onClick={() => setHoja('conexiones')}
              aria-haspopup="dialog"
              aria-expanded={hoja === 'conexiones'}
              aria-label={`Conectado a ${textoConectadoA(nombreSubida, subida.extremo.puertoRemoto)}${
                subida.otros > 0 ? ` y ${subida.otros} más` : ''
              }. Ver sus conexiones`}
              className="flex min-h-14 w-full items-center gap-3 border-b border-noct-divider py-1.5 text-left text-noct-text hover:bg-noct-text/[.04] max-md:active:bg-noct-presionado"
            >
              <PlugsConnected size={18} className="shrink-0 text-noct-neutral-500" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] leading-snug text-noct-neutral-500">Conectado a</span>
                <span className="block font-mono text-[14.5px] leading-snug text-noct-text [overflow-wrap:anywhere]">
                  {textoConectadoA(nombreSubida, subida.extremo.puertoRemoto)}
                  {subida.otros > 0 && <span className="font-inter text-noct-neutral-500"> · y {subida.otros} más</span>}
                </span>
              </span>
              {/* `CaretUp`: se consulta en una hoja (el galón del índice). En
                  el teléfono, el galón de siempre (tarea 344). */}
              <CaretUp size={14} className="hidden shrink-0 text-noct-neutral-500 md:block" aria-hidden />
              <CaretRight size={14} className="shrink-0 text-noct-neutral-500 md:hidden" aria-hidden />
            </button>
          )}
        </section>
        )}

        {/* LAS CREDENCIALES DEL EQUIPO, EN SU TARJETA (tarea 350, ficha del
            prototipo de Claude Design): la Bóveda invertida, con cuántas
            hay y «Desbloquear» (o «Ver», abierta), que abre la misma hoja de
            siempre con su desbloqueo. Sustituye a la «Clave» de la barra
            fija: un solo sitio para lo mismo. Solo con permiso de Bóveda y
            si hay alguna; la Bóveda, sus permisos y su registro no cambian. */}
        {!ancho && conCredenciales && totalCredenciales > 0 && (
          <div
            data-boveda-del-equipo
            className="flex items-center gap-3 rounded-2xl bg-noct-boveda py-3 pl-3.5 pr-3 text-noct-on-boveda"
          >
            <IconoVentana nombre="candado" tam={22} className="shrink-0" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-[15px] font-bold leading-snug">
                {totalCredenciales === 1 ? '1 credencial del equipo' : `${totalCredenciales} credenciales del equipo`}
              </span>
              <span className="text-[13.5px] font-medium leading-snug opacity-80">Protegidas en la Bóveda</span>
            </span>
            <button
              type="button"
              onClick={() => setHoja('credenciales')}
              aria-haspopup="dialog"
              aria-label={totalCredenciales === 1 ? 'Clave del equipo' : 'Claves del equipo'}
              className="flex h-11 shrink-0 cursor-pointer items-center rounded-xl bg-noct-surface px-3 text-[14px] font-extrabold text-noct-text active:bg-noct-neutral-900"
            >
              {bovedaAbierta ? 'Ver' : 'Desbloquear'}
            </button>
          </div>
        )}

        {/* EL MANTENIMIENTO, A LA VISTA (tarea 344, DESPUÉS de Claude Design):
            en el teléfono, su fila bajo los datos, con lo que dice y "Ver",
            que abre su pantalla. Desde 768 sigue en el índice. */}
        {!ancho && (
          <button
            type="button"
            onClick={abrirMantenimiento}
            className="flex min-h-[68px] w-full items-center gap-3 rounded-2xl border-[1.5px] border-noct-divider bg-noct-surface px-3.5 py-3 text-left text-noct-text hover:bg-noct-text/[.04] max-md:active:bg-noct-presionado"
          >
            <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-noct-neutral-900 text-noct-neutral-300">
              <Wrench size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[16px] font-semibold leading-snug">Mantenimiento</span>
              <span className={`block text-[14.5px] leading-snug ${TONO_LINEA_MANTENIMIENTO[mantenimiento.tono]}`}>
                {lineaMantenimiento}
              </span>
            </span>
            <span className="shrink-0 text-[15px] font-semibold text-noct-accent-300">Ver</span>
          </button>
        )}

        <ResolverConEsteEquipo
          items={formasDeResolver.slice(0, 5)}
          total={formasDeResolver.length}
          onVerTodos={() => setHoja('resolver')}
          visibles={3}
          visiblesEscritorio={5}
          compacta={!ancho}
          titulo={ancho ? undefined : 'Guías para este equipo'}
        />
        </div>

        {!amplio && masDelEquipo}

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
        {/* Las credenciales tienen su tarjeta bajo los datos (tarea 350). */}
        {!ancho && <BarraAccionEquipo resolver={resolverBarra} onCredenciales={null} />}
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
        <HojaInferior
          abierta={hoja === 'credenciales'}
          onCerrar={cerrarHoja}
          // En el teléfono la abre "Clave" (tarea 344): la hoja se llama igual.
          titulo={ancho ? 'Credenciales' : totalCredenciales > 1 ? 'Claves del equipo' : 'Clave del equipo'}
          contexto={dispositivo.nombre}
        >
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

      {!ancho && (
        <MenuEnHoja
          abierta={menuAbierto}
          onCerrar={() => setMenuAbierto(false)}
          dispositivoId={dispositivoId}
          nombre={dispositivo.nombre}
          origen={origenEsteEquipo}
          onEliminar={() => {
            setMenuAbierto(false)
            setMostrarEliminar(true)
          }}
        />
      )}

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

// UNA FILA DE LA TABLA DE DATOS DEL TELÉFONO (tarea 350, ficha del
// prototipo de Claude Design): el rótulo en su columna de 78, en tinta 2, y el
// dato a su lado (en mono si se compara o se copia), con su acción al final.
// El dato parte línea antes que recortarse. El último hijo, si es un botón,
// es la acción.
function FilaDatoTelefono({
  etiqueta,
  mono = false,
  marca,
  children,
}: {
  etiqueta: string
  mono?: boolean
  /** Un atributo `data-*` para encontrar la fila (las pruebas, las capturas). */
  marca?: string
  children: React.ReactNode
}) {
  const hijos = Array.isArray(children) ? children : [children]
  const valor = hijos[0]
  const accion = hijos.slice(1)
  return (
    <div {...(marca ? { [marca]: '' } : {})} className="flex min-h-[52px] items-center gap-2.5 border-b border-noct-divider py-1">
      <span className="w-[78px] shrink-0 text-[13.5px] font-bold leading-snug text-noct-neutral-300">{etiqueta}</span>
      <span
        className={`min-w-0 flex-1 font-semibold leading-snug [overflow-wrap:anywhere] ${
          mono ? 'font-mono text-[16px]' : 'text-[15px]'
        }`}
      >
        {valor}
      </span>
      {accion}
    </div>
  )
}

// El color de la línea del mantenimiento del teléfono: el de su fila del
// índice, que dice siempre su palabra (tarea 342).
const TONO_LINEA_MANTENIMIENTO = {
  neutro: 'text-noct-neutral-400',
  precaucion: 'text-noct-precaucion',
  error: 'text-noct-error',
  exito: 'text-noct-exito',
} as const

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
      <p className="text-[11px] max-md:text-[12px] font-medium uppercase tracking-[0.07em] text-noct-accent-300">¿Qué sigue?</p>
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
      {/* La acción en texto 2 (a 14 en el teléfono, tarea 342) y debajo, a
          12 en texto 4, la nota de que se hace mejor en el ordenador. Antes
          la nota iba en neutral-600, por debajo de 4.5:1. */}
      <button
        type="button"
        onClick={() => setAbierta((v) => !v)}
        aria-expanded={abierta}
        className="flex min-h-11 items-center gap-2 py-1 text-left text-noct-neutral-300 hover:text-noct-text max-md:active:bg-noct-presionado"
      >
        <PencilSimple size={15} className="shrink-0" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] leading-snug max-md:text-[14px]">
            Documentar este equipo: foto, procedimiento o incidencia
          </span>
          <span className="block text-[12px] leading-snug text-noct-neutral-500">Se hace mejor desde el ordenador</span>
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

// EL MENÚ "···" DE LA FICHA EN EL TELÉFONO (tarea 342, handoff móvil "1b
// Pulgar"). Antes, una banda de botones dentro de la cabecera, que empujaba
// la ficha hacia abajo; ahora la hoja de siempre, con una fila de 54 por
// acción. Lo destructivo va aparte (regla 30): después de un espacio y una
// línea, en rojo, nunca junto a Editar. Cada acción cierra la hoja al
// elegirse, menos Favorito, que cambia su estrella a la vista. Compartir
// confirma con el aviso flotante cuando copia el enlace. Desde 768 la ficha
// sigue usando la banda: esta hoja solo se monta en el teléfono.
function MenuEnHoja({
  abierta,
  onCerrar,
  dispositivoId,
  nombre,
  origen,
  onEliminar,
}: {
  abierta: boolean
  onCerrar: () => void
  dispositivoId: string
  nombre: string
  /** Etiquetas vuelve a este equipo, no a su puerta de inventario. */
  origen: EstadoConOrigen
  onEliminar: () => void
}) {
  async function compartir() {
    const resultado = await compartirOCopiar(nombre)
    if (resultado === 'copiado') avisar('Enlace de la ficha copiado', 'copiado')
    if (resultado !== 'fallo') onCerrar()
  }
  const icono = 'shrink-0 text-noct-neutral-300'

  return (
    <HojaInferior abierta={abierta} onCerrar={onCerrar} titulo="Acciones del equipo" contexto={nombre}>
      <div role="group" aria-label="Acciones del equipo" className="flex flex-col">
        <BotonFavorito tipo="dispositivo" entidadId={dispositivoId} variante="hoja" />
        <button type="button" onClick={() => void compartir()} className={FILA_ACCION_HOJA}>
          <ShareNetwork size={19} className={icono} aria-hidden />
          Compartir la ficha
        </button>
        <Link to={`/dispositivos/nuevo?copiarDe=${dispositivoId}`} onClick={onCerrar} className={FILA_ACCION_HOJA}>
          <Copy size={19} className={icono} aria-hidden />
          Duplicar
        </Link>
        <Link to={`/dispositivos/${dispositivoId}/editar`} onClick={onCerrar} className={FILA_ACCION_HOJA}>
          <PencilSimple size={19} className={icono} aria-hidden />
          Editar
        </Link>
        <Link to="/dispositivos/etiquetas" state={origen} onClick={onCerrar} className={FILA_ACCION_HOJA}>
          <QrCode size={19} className={icono} aria-hidden />
          Etiqueta QR
        </Link>
        <Link to={`/dispositivos/nuevo?reemplazaA=${dispositivoId}`} onClick={onCerrar} className={FILA_ACCION_HOJA}>
          <ArrowsClockwise size={19} className={icono} aria-hidden />
          Reemplazar
        </Link>
      </div>
      {/* Lo que retira el equipo, aparte: 18 px de aire y una línea. */}
      <div
        role="group"
        aria-label="Retirar el equipo"
        className="mt-[18px] flex flex-col border-t border-noct-divider [&>*:last-child]:border-b-0"
      >
        <Link to={`/dispositivos/${dispositivoId}/baja`} onClick={onCerrar} className={FILA_ACCION_HOJA_PELIGRO}>
          <XCircle size={19} className="shrink-0" aria-hidden />
          Dar de baja
        </Link>
        <button type="button" onClick={onEliminar} className={FILA_ACCION_HOJA_PELIGRO}>
          <TrashSimple size={19} className="shrink-0" aria-hidden />
          Eliminar
        </button>
      </div>
    </HojaInferior>
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
