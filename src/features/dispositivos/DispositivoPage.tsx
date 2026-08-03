import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { db, type Dispositivo } from '../../lib/db'
import { dependenciasDeBaja, sinDependencias } from './baja'
import { completitudDispositivo, pasosSiguientes, type PasoSiguiente } from './completitud'
import { compartirOCopiar } from '../../lib/portapapeles'
import { eliminarRegistro } from '../../lib/repositorio'
import { registrarVisita } from '../../lib/recientes'
import { textoVivo } from '../../lib/referencia'
import { referenciasHacia, resumenImpacto } from '../../lib/grafo'
import { tiempoRelativo } from '../../lib/tiempoRelativo'
import { conOrigen } from '../../lib/origenNavegacion'
import { Chasis } from '../../app/Chasis'
import { usePerfilVivo } from '../autenticacion/usePerfilVivo'
import { Adjuntos } from '../../components/Adjuntos'
import { BotonFavorito } from '../../components/BotonFavorito'
import { DialogoEliminar } from '../../components/DialogoEliminar'
import { FilaDato } from '../../components/FilaDato'
import { MiniaturaPortada } from '../../components/MiniaturaPortada'
import { SeccionPlegable } from '../../components/SeccionPlegable'
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
  LockSimple,
  MapPin,
  Paperclip,
  PencilSimple,
  PlugsConnected,
  Plus,
  QrCode,
  ShareNetwork,
  TrashSimple,
  TreeStructure,
  User,
  WarningOctagon,
  XCircle,
} from '../../components/iconos'
import {
  BTN_GHOST_PELIGRO,
  BTN_ICONO_SECUNDARIO,
  BTN_SECUNDARIO,
  PEGADA_SOBRE_PESTANAS,
  TituloSeccion,
} from '../../components/nocturne'
import { ImpactoYDependencias } from '../red/ImpactoYDependencias'
import { useImpactoEquipo } from '../red/useImpactoEquipo'
import { ConexionesFicha } from '../red/ConexionesFicha'
import { IconoNodo } from '../red/IconoNodo'
import { estadoConEtiqueta, tipoDeNodoVisual } from '../red/topologiaVisual'
import { esDeRed } from '../../lib/categorias'
import { procedimientosDeCategoria, procedimientosDeDispositivo } from './procedimientosDeDispositivo'
import { problemasDeCategoria, problemasDeDispositivo } from './problemasDeDispositivo'
import { Historial } from '../historial/Historial'
import { IniciarDiagnosticoBoton } from './IniciarDiagnosticoBoton'
import { CredencialesDelEquipo } from './CredencialesDelEquipo'
import { ProblemasDelEquipo } from './ProblemasDelEquipo'
import { ProcedimientosDelEquipo } from './ProcedimientosDelEquipo'
import { RegistrarIntervencion } from './RegistrarIntervencion'
import { SeguridadDelEquipo } from './SeguridadDelEquipo'

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
const PILL_ESTADO: Record<string, string> = {
  operativo: 'border-noct-exito/40 bg-noct-exito/10 text-noct-exito',
  'en mantenimiento': 'border-noct-precaucion/40 bg-noct-precaucion/10 text-noct-precaucion',
  'fuera de servicio': 'border-noct-error/40 bg-noct-error/10 text-noct-error',
  'de baja': 'border-noct-neutral-500/40 bg-noct-neutral-500/10 text-noct-neutral-400',
}

function pillEstado(etiqueta: string): string {
  return PILL_ESTADO[etiqueta.toLowerCase()] ?? PILL_ESTADO['de baja']
}

// Ficha de un dispositivo re-autorizada al sistema Nocturne (handoff
// "Rediseño de aplicación empresarial", Ficha de Dispositivo.dc.html):
// cabecera con regreso contextual, compartir y menú "···" (duplicar,
// editar, etiqueta QR, eliminar), foto banner, título + estado en
// pastilla, tarjeta de Información con filas copiables y ubicación viva,
// "Resolver con este equipo" (diagnóstico destacado + procedimientos,
// problemas y credenciales vinculados + creación contextual), "Si este
// equipo falla" (impacto y dependencias), conexiones e intervenciones.
// Declara nivel de documento en el chasis (tarea 185), así que conserva
// las pestañas, y toda la lógica y los datos de la vista 360°.
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
  // Responsable como entidad (hallazgo T1): mismo criterio de referencia
  // viva que la ubicacion.
  const responsableVinculado = useLiveQuery(
    () => (dispositivo?.responsableId ? db.personas.get(dispositivo.responsableId) : undefined),
    [dispositivo?.responsableId],
  )
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

  // Reparto de los datos entre las capas "Ahora" y "Contexto" (M-014,
  // regla M-R4). La IP sube a "Ahora" porque es el dato que se viene a
  // buscar con el equipo delante; marca y modelo pasan a ser la línea
  // bajo el nombre, no dos filas; serial y placa se quedan en
  // "Contexto", que es donde se consultan.
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
  const ubicacionNombre = textoVivo(ubicacionViva?.nombre, dispositivo.ubicacion)

  // Nombre a mostrar del responsable: el vivo de la persona enlazada si
  // existe y no esta eliminada; si no, la copia de referencia guardada.
  const responsableVivo = responsableVinculado && !responsableVinculado.eliminadoEn ? responsableVinculado : null
  const responsableNombre = textoVivo(responsableVivo?.nombre, dispositivo.responsable)

  // Sin copia de referencia para reemplazaA (autorreferencia estricta,
  // fijada una sola vez al crear): si la fila vinculada no esta
  // disponible (aun sincronizando, o realmente no existe) la fila de la
  // ficha simplemente no se muestra, en vez de mostrar el id crudo.
  const reemplazaNombre = reemplazaVinculado?.nombre ?? null

  const detalles = Object.entries(dispositivo.detalles).filter(([, valor]) => valor)
  const estado = dispositivo.estado ? estadoConEtiqueta(dispositivo.estado) : null
  const metaLinea = [categoria?.nombre, `actualizado ${fechaCorta(dispositivo.updatedAt)}`]
    .filter(Boolean)
    .join(' · ')

  // Lo que se puede resolver con este equipo, contado para la promesa de
  // la acción dominante (M-R3: la acción fija dice qué va a pasar).
  const procedimientosPropios = procedimientosDeDispositivo(articulos, dispositivoId)
  const problemasPropios = problemasDeDispositivo(articulos, dispositivoId)
  const criterio = { marca: dispositivo.marca, modelo: dispositivo.modelo }
  const totalResolver =
    procedimientosPropios.length +
    procedimientosDeCategoria(
      articulos,
      dispositivo.categoriaId,
      new Set(procedimientosPropios.map((a) => a.id)),
      criterio,
    ).length
  const totalProblemas =
    problemasPropios.length +
    problemasDeCategoria(articulos, dispositivo.categoriaId, new Set(problemasPropios.map((a) => a.id)), criterio)
      .length

  // Completitud de la ficha (fase J3): guia, nunca bloquea. Solo se
  // muestra cuando falta algo.
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

  return (
    // Nivel 2 del chasis (tarea 185): documento. Conserva las pestañas
    // (R19) y el regreso es contextual: un equipo de red vuelve a Red,
    // que es de donde se llega, y no a Equipos.
    <Chasis
      modo="documento"
      volverA={volverA}
      volverEtiqueta={esRed ? 'Red' : 'Equipos'}
      // Ancla permanente (M-001, M-R1): el nombre del equipo se queda en
      // pantalla al desplazarse, con de dónde viene y dónde está. Antes
      // era un `h1` dentro del scroll, así que a partir de los primeros
      // 400 px nada decía QUÉ equipo se estaba mirando.
      titulo={dispositivo.nombre}
      contexto={[esRed ? 'Red' : 'Equipos', ubicacionNombre].filter(Boolean).join(' · ')}
      acciones={
        <>
          <BotonFavorito tipo="dispositivo" entidadId={dispositivoId} />
          <BotonCompartir titulo={dispositivo.nombre} />
          <button
            type="button"
            onClick={() => setMenuAbierto((v) => !v)}
            aria-label="Más acciones: duplicar, editar, etiqueta QR, reemplazar, dar de baja o eliminar"
            aria-expanded={menuAbierto}
            className={BTN_ICONO_SECUNDARIO}
          >
            <DotsThreeOutline size={17} aria-hidden />
          </button>
        </>
      }
      barra={menuAbierto && (
        <div className="flex flex-wrap gap-2 px-4 pb-2 lg:px-10">
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
          <Link to="/dispositivos/etiquetas" onClick={() => setMenuAbierto(false)} className={`shrink-0 ${BTN_SECUNDARIO}`}>
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
      )}
    >
      {/* La ficha 360° en cuatro capas (auditoría móvil del 2026-08-03,
          hallazgo M-014 -P0-, regla M-R4, mockup `4b`).

          Lo medido: nueve secciones siempre abiertas, sin plegado ni
          índice, en orden de escritura y no de urgencia. A 360 px,
          "Conexiones" -la respuesta a "¿de qué depende esto?"- empezaba
          pasadas TRES pantallas de scroll, y la primera se iba entera en
          la foto de 150 px y la línea de completitud, que no sirven para
          trabajar con el equipo delante. "360°" se estaba leyendo como
          "todo a la vez".

          El reparto no quita ni un dato:

            Ahora        qué es, en qué estado, su IP copiable y dónde
                         está. Cabe en la primera pantalla.
            Contexto     la información técnica completa, abierta.
            Acción       lo que se puede resolver con este equipo, con
                         UNA sola acción dominante fija al pie (M-R3).
            Profundidad  impacto, conexiones, datos protegidos, adjuntos
                         e intervenciones, plegados CON SU CONTEO a la
                         vista: "Conexiones · 4" dice más que cuatro
                         filas que hay que desplazar (M-R4).

          Un solo eje vertical (R26, tarea 191): `lg:px-10`, el mismo de
          las fichas hermanas de artículo y credencial. */}
      <main className="@container flex flex-1 flex-col gap-[22px] px-4 pb-4 pt-2 lg:px-10">
        {/* Migracion pendiente (hallazgos L2/L3): este equipo reemplaza a
            otro que todavia tiene conexiones, credenciales o campos
            protegidos sin mover. Enlaza a la pantalla de migracion en vez
            de repetir aqui la logica de que hay pendiente. */}
        {dispositivo.reemplazaA && (
          <BannerMigracionPendiente nuevoId={dispositivoId} viejoId={dispositivo.reemplazaA} />
        )}

        {pasos.length > 0 && <QueSigue pasos={pasos} dispositivoId={dispositivoId} />}

        {/* CAPA 1 · AHORA. El nombre ya vive arriba, en el ancla
            permanente del chasis (M-001), así que aquí no se repite a
            21 px: la tarjeta lo da a 16 con lo que lo acompaña. */}
        <section>
          <TituloSeccion className="mb-2">Ahora</TituloSeccion>
          <div className="divide-y divide-noct-divider overflow-hidden rounded-lg border border-noct-divider bg-noct-surface">
            <div className="flex items-center gap-3 px-3.5 py-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-noct-text/[.06] text-noct-neutral-400">
                {dispositivo.foto ? (
                  <MiniaturaPortada
                    referencia={dispositivo.foto.referencia}
                    alt={dispositivo.nombre}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <IconoNodo tipo={tipoDeNodoVisual(categoria?.nombre ?? '')} className="h-5 w-5" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[16px] font-medium leading-[1.25]">{dispositivo.nombre}</span>
                <span className="mt-0.5 block truncate text-[12.5px] text-noct-neutral-400">
                  {marcaModelo || metaLinea}
                </span>
              </span>
              {estado && (
                <span
                  className={`inline-flex min-h-[26px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-[11.5px] font-medium ${pillEstado(estado.etiqueta)}`}
                >
                  <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-current" />
                  {estado.etiqueta}
                </span>
              )}
            </div>

            {dispositivo.ip && (
              <div className="px-3.5">
                <FilaDato etiqueta="Dirección IP" valor={dispositivo.ip} tecnico copiable={dispositivo.ip} />
              </div>
            )}

            {ubicacionNombre &&
              (ubicacionViva ? (
                <Link
                  to={`/ubicaciones/${ubicacionViva.id}`}
                  state={origenEsteEquipo}
                  className="flex min-h-12 items-center gap-2.5 px-3.5 text-[13.5px] text-noct-accent-300 hover:bg-noct-text/[.04]"
                >
                  <MapPin size={15} className="shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{ubicacionNombre}</span>
                  <CaretRight size={13} className="shrink-0 text-noct-neutral-500" aria-hidden />
                </Link>
              ) : (
                <span className="flex min-h-12 items-center gap-2.5 px-3.5 text-[13.5px] text-noct-neutral-200">
                  <MapPin size={15} className="shrink-0 text-noct-neutral-500" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{ubicacionNombre}</span>
                </span>
              ))}
          </div>
        </section>

        {/* CAPA 2 · CONTEXTO. Abierta, como manda M-R4. */}
        {(camposContexto.length > 0 ||
          detalles.length > 0 ||
          responsableNombre ||
          reemplazaNombre ||
          reemplazadoPor ||
          dispositivo.observaciones) && (
          <section>
            <TituloSeccion className="mb-2">Contexto</TituloSeccion>
            <div className="divide-y divide-noct-divider rounded-lg border border-noct-divider bg-noct-surface px-3.5">
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
              {responsableNombre && (
                <FilaDato etiqueta="Responsable">
                  {responsableVivo ? (
                    <Link
                      to={`/personas/${responsableVivo.id}`}
                      state={origenEsteEquipo}
                      className="inline-flex min-w-0 flex-1 items-center gap-1.5 truncate text-[13.5px] text-noct-accent-300 hover:text-noct-accent-400"
                    >
                      <User size={14} className="shrink-0" aria-hidden />
                      {responsableNombre}
                    </Link>
                  ) : (
                    <span className="inline-flex min-w-0 flex-1 items-center gap-1.5 truncate text-[13.5px] text-noct-neutral-200">
                      <User size={14} className="shrink-0 text-noct-neutral-500" aria-hidden />
                      {responsableNombre}
                    </span>
                  )}
                </FilaDato>
              )}
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
              <FilaDato etiqueta="Categoría y fecha">
                <span className="min-w-0 flex-1 truncate text-[13.5px] text-noct-neutral-300">{metaLinea}</span>
              </FilaDato>
            </div>
            {dispositivo.observaciones && (
              <p className="mt-2.5 whitespace-pre-wrap px-0.5 text-[13px] leading-[1.55] text-noct-neutral-300">
                {dispositivo.observaciones}
              </p>
            )}
          </section>
        )}

        {/* CAPA 3 · ACCIÓN. Lo que se consulta con el equipo delante. Los
            tres botones de creación que se intercalaban aquí bajaron a la
            puerta única del pie (M-016, regla M-R10: el teléfono consulta
            y ejecuta, el ordenador documenta). El id ancla el paso
            "procedimiento" del bloque "Que sigue" (O1). */}
        <section id="resolver">
          <TituloSeccion className="mb-2">Acción</TituloSeccion>
          <div className="flex flex-col gap-2">
            <IniciarDiagnosticoBoton categoriaId={dispositivo.categoriaId} categoriaNombre={categoria?.nombre} />
            <div className="flex flex-col">
              <ProcedimientosDelEquipo
                dispositivoId={dispositivoId}
                categoriaId={dispositivo.categoriaId}
                categoriaNombre={categoria?.nombre}
                marca={dispositivo.marca}
                modelo={dispositivo.modelo}
              />
              <ProblemasDelEquipo
                dispositivoId={dispositivoId}
                categoriaId={dispositivo.categoriaId}
                categoriaNombre={categoria?.nombre}
                marca={dispositivo.marca}
                modelo={dispositivo.modelo}
              />
              <CredencialesDelEquipo dispositivoId={dispositivoId} puedeVerBoveda={Boolean(perfil?.puedeVerBoveda)} />
            </div>
          </div>
        </section>

        {/* CAPA 4 · PROFUNDIDAD. Cinco filas de 52 px con su conteo, en
            vez de cinco secciones abiertas de varias pantallas. El
            contenido solo se monta al abrirse. */}
        <section>
          <TituloSeccion className="mb-2">Profundidad</TituloSeccion>
          <div className="divide-y divide-noct-divider overflow-hidden rounded-lg border border-noct-divider bg-noct-surface">
            {(equiposEnRiesgo > 0 || cadenaDependencia.length > 0) && (
              <SeccionPlegable
                titulo="Si falla, caen"
                Icono={WarningOctagon}
                tono="precaucion"
                conteo={`${equiposEnRiesgo} ${equiposEnRiesgo === 1 ? 'equipo' : 'equipos'}`}
              >
                <ImpactoYDependencias dispositivo={dispositivo} sinCabecera />
              </SeccionPlegable>
            )}

            <SeccionPlegable
              id="conexiones"
              titulo="Conexiones"
              Icono={PlugsConnected}
              conteo={totalConexiones === 0 ? 'Ninguna' : totalConexiones}
            >
              <ConexionesFicha dispositivo={dispositivo} sinCabecera />
            </SeccionPlegable>

            {perfil?.puedeVerBoveda && (
              <SeccionPlegable
                id="seguridad"
                titulo="Datos protegidos"
                Icono={LockSimple}
                conteo={totalCamposProtegidos === 0 ? 'Ninguno' : totalCamposProtegidos}
                // El nudge anti duplicidad de la Bóveda (fase P3) llega
                // con el nombre ya sugerido: si la sección se quedara
                // plegada, el editor precargado no se vería.
                inicialAbierta={Boolean(nombreCampoSugerido)}
              >
                <SeguridadDelEquipo
                  dispositivoId={dispositivoId}
                  puedeVerBoveda
                  nombreSugerido={nombreCampoSugerido}
                  sinCabecera
                />
              </SeccionPlegable>
            )}

            <SeccionPlegable
              id="foto"
              titulo="Adjuntos"
              Icono={Paperclip}
              conteo={totalAdjuntos === 0 ? 'Ninguno' : totalAdjuntos}
            >
              {dispositivo.foto && (
                <FotoDispositivo referencia={dispositivo.foto.referencia} nombre={dispositivo.nombre} />
              )}
              <Adjuntos entidadTipo="dispositivo" entidadId={dispositivoId} sinCabecera />
            </SeccionPlegable>

            <SeccionPlegable
              titulo="Intervenciones"
              Icono={ClockCounterClockwise}
              conteo={
                intervenciones.total === 0
                  ? 'Ninguna'
                  : (tiempoRelativo(intervenciones.ultima) ?? intervenciones.total)
              }
            >
              <div className="flex flex-col gap-2.5">
                <RegistrarIntervencion dispositivoId={dispositivoId} />
                <Historial entidadTipo="dispositivo" entidadId={dispositivoId} />
              </div>
            </SeccionPlegable>
          </div>
        </section>

        {/* La puerta única de documentar (M-016, M-031, regla M-R10).
            Antes eran tres botones de creación en medio de un bloque de
            consulta, más la línea de completitud arriba del todo: cuatro
            invitaciones a escribir repartidas por una pantalla que se usa
            de pie y con una mano. Aquí se reúnen, se nombran y se dice en
            voz alta dónde se hacen mejor. */}
        <PuertaDocumentar
          dispositivo={dispositivo}
          categoriaNombre={categoria?.nombre ?? ''}
          puedeVerBoveda={Boolean(perfil?.puedeVerBoveda)}
          completitud={completitud}
        />

        {/* Acción dominante fija al pie (M-R3). Solo si hay algo que
            resolver: un control que lleva a una lista vacía es un control
            muerto (R3). */}
        {(totalResolver > 0 || totalProblemas > 0) && (
          <AccionDominanteEquipo
            categoriaId={dispositivo.categoriaId}
            procedimientos={totalResolver}
            problemas={totalProblemas}
          />
        )}
      </main>

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
          // que React Router reaccione al cambio de hash.
          return paso.clave === 'foto' ? (
            <Link key={paso.clave} to={`/dispositivos/${dispositivoId}/editar`} className={clase}>
              {fila}
            </Link>
          ) : (
            <a key={paso.clave} href={`#${paso.clave === 'procedimiento' ? 'resolver' : paso.clave}`} className={clase}>
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

// Acción dominante de la ficha de equipo (regla M-R3: una sola acción,
// fija abajo, de 52 px, con su promesa escrita en una línea). Es el
// mismo patrón que la ficha de artículo ya tenía aprobado desde la tarea
// 172 (`BarraAccionFicha`), aplicado aquí: la ficha de equipo no tenía
// acción dominante, tenía tres botones de CREACIÓN en medio del cuerpo.
//
// No reutiliza `BarraAccionFicha` porque esa barra habla de un
// procedimiento y su avance ("Seguir en el paso 3 de 7"): sus tres
// estados y su nota no significan nada sobre un equipo.
function AccionDominanteEquipo({
  categoriaId,
  procedimientos,
  problemas,
}: {
  categoriaId: string
  procedimientos: number
  problemas: number
}) {
  const partes = [
    procedimientos > 0
      ? `${procedimientos} ${procedimientos === 1 ? 'procedimiento' : 'procedimientos'}`
      : null,
    problemas > 0 ? `${problemas} ${problemas === 1 ? 'problema frecuente' : 'problemas frecuentes'}` : null,
  ].filter(Boolean)

  return (
    <div
      className={`sticky ${PEGADA_SOBRE_PESTANAS} z-10 -mx-4 mt-auto border-t border-noct-divider bg-noct-bg/[.94] px-4 pb-3 pt-2.5 backdrop-blur-[12px] lg:px-10`}
    >
      <Link
        to={`/diagnostico?categoria=${categoriaId}`}
        className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl border border-noct-accent bg-noct-accent/[.12] px-4 text-[15px] font-semibold text-noct-accent-300 hover:bg-noct-accent/[.18] active:bg-noct-accent/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-noct-accent"
      >
        <TreeStructure size={18} aria-hidden />
        Resolver un problema con este equipo
      </Link>
      <p className="mt-1.5 text-center text-[11.5px] text-noct-neutral-400">
        {partes.join(' y ')} {procedimientos + problemas === 1 ? 'aplica' : 'aplican'} aquí
      </p>
    </div>
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
  const [abierta, setAbierta] = useState(false)
  const nombreCodificado = encodeURIComponent(dispositivo.nombre)

  return (
    <div className="flex flex-col gap-2">
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
// copiarlo al portapapeles donde no exista. Botón de icono en Nocturne.
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
      aria-label={copiado ? 'Enlace copiado' : 'Compartir la ficha'}
      className={BTN_ICONO_SECUNDARIO}
    >
      {copiado ? <Check size={16} className="text-noct-exito" aria-hidden /> : <ShareNetwork size={17} aria-hidden />}
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
