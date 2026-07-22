import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { db } from '../../lib/db'
import { dependenciasDeBaja, sinDependencias } from './baja'
import { completitudDispositivo, pasosSiguientes, type PasoSiguiente } from './completitud'
import { compartirOCopiar, copiarAlPortapapeles } from '../../lib/portapapeles'
import { eliminarRegistro } from '../../lib/repositorio'
import { registrarVisita } from '../../lib/recientes'
import { textoVivo } from '../../lib/referencia'
import { referenciasHacia, resumenImpacto } from '../../lib/grafo'
import { ShellNocturne } from '../../app/ShellNocturne'
import { usePerfilVivo } from '../autenticacion/usePerfilVivo'
import { Adjuntos } from '../../components/Adjuntos'
import { BotonFavorito } from '../../components/BotonFavorito'
import { BotonVolver } from '../../components/BotonVolver'
import { DialogoEliminar } from '../../components/DialogoEliminar'
import { useGrafo } from '../../components/useGrafo'
import { useUrlAdjunto } from '../../components/useUrlAdjunto'
import {
  ArrowsClockwise,
  BookOpen,
  CaretRight,
  Camera,
  Check,
  Copy,
  DotsThreeOutline,
  LockSimple,
  MapPin,
  PencilSimple,
  PlugsConnected,
  Plus,
  QrCode,
  ShareNetwork,
  TrashSimple,
  User,
  Warning,
  XCircle,
} from '../../components/iconos'
import {
  BTN_GHOST,
  BTN_GHOST_ACENTO,
  BTN_GHOST_PELIGRO,
  BTN_ICONO_SECUNDARIO,
  BTN_SECUNDARIO,
  TituloSeccion,
} from '../../components/nocturne'
import { ImpactoYDependencias } from '../red/ImpactoYDependencias'
import { ConexionesFicha } from '../red/ConexionesFicha'
import { estadoConEtiqueta } from '../red/topologiaVisual'
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
// Trae su propio ShellNocturne, por eso su ruta sale del Layout oscuro.
// Conserva intacta toda la lógica y los datos de la vista 360°.
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
      <ShellNocturne>
        <p className="px-4 pt-6 text-sm text-noct-neutral-400">Cargando...</p>
      </ShellNocturne>
    )
  }

  // Los dispositivos de red se listan en la seccion Red: la navegacion
  // de vuelta y la eliminacion regresan alli.
  const esRed = Boolean(categoria?.esRed)
  const volverA = esRed ? '/red' : '/dispositivos'

  async function eliminar() {
    await eliminarRegistro('dispositivos', dispositivoId)
    navigate(volverA)
  }

  const campos: { etiqueta: string; valor: string; mono?: boolean }[] = [
    { etiqueta: 'Marca', valor: dispositivo.marca },
    { etiqueta: 'Modelo', valor: dispositivo.modelo },
    { etiqueta: 'Número de serie', valor: dispositivo.serial, mono: true },
    { etiqueta: 'Placa de inventario', valor: dispositivo.placaInventario, mono: true },
    { etiqueta: 'Dirección IP', valor: dispositivo.ip, mono: true },
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
    <ShellNocturne>
      {/* Cabecera: regreso contextual, compartir y menú de acciones. */}
      <header className="flex items-center justify-between gap-2 pb-2 pl-2 pr-3 pt-2.5 lg:px-10 lg:pt-4">
        <BotonVolver to={volverA}>
          {esRed ? 'Red' : 'Dispositivos'}
        </BotonVolver>
        <div className="flex shrink-0 items-center gap-2">
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
        </div>
      </header>

      {menuAbierto && (
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

      <main className="flex flex-1 flex-col gap-[22px] px-4 pb-[116px] pt-1 lg:px-12 lg:pb-16">
        {/* Encabezado del equipo: foto, título, categoría/fecha y estado. */}
        <header className="flex flex-col gap-3">
          {dispositivo.foto && <FotoDispositivo referencia={dispositivo.foto.referencia} nombre={dispositivo.nombre} />}
          <div className="flex items-start justify-between gap-2.5">
            <div className="min-w-0">
              <h1 className="text-pretty text-[21px] font-medium leading-[1.25]">{dispositivo.nombre}</h1>
              <p className="mt-1 text-[12.5px] text-noct-neutral-500">{metaLinea}</p>
            </div>
            {estado && (
              <span
                className={`inline-flex min-h-[28px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-[12px] font-medium ${pillEstado(estado.etiqueta)}`}
              >
                <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-current" />
                {estado.etiqueta}
              </span>
            )}
          </div>

          {/* Completitud de la ficha (fase J3): linea discreta dentro de
              la propia cabecera, solo cuando falta algo, con enlace
              directo a Editar. Nunca bloquea el uso de la ficha, solo lo
              señala. */}
          {completitud.faltantes.length > 0 && (
            <Link
              to={`/dispositivos/${dispositivoId}/editar`}
              className="flex items-center gap-1.5 text-[12.5px] text-noct-precaucion hover:underline"
            >
              <Warning size={13} className="shrink-0" aria-hidden />
              <span className="min-w-0 truncate">
                Ficha al {completitud.porcentaje}%. Falta: {completitud.faltantes.join(', ')}.
              </span>
            </Link>
          )}
        </header>

        {/* Migracion pendiente (hallazgos L2/L3): este equipo reemplaza a
            otro que todavia tiene conexiones, credenciales o campos
            protegidos sin mover. Enlaza a la pantalla de migracion en vez
            de repetir aqui la logica de que hay pendiente. */}
        {dispositivo.reemplazaA && (
          <BannerMigracionPendiente nuevoId={dispositivoId} viejoId={dispositivo.reemplazaA} />
        )}

        {pasos.length > 0 && <QueSigue pasos={pasos} dispositivoId={dispositivoId} />}

        {/* Información: filas copiables, ubicación, responsable y
            reemplazo vivos. */}
        {(campos.length > 0 ||
          ubicacionNombre ||
          responsableNombre ||
          reemplazaNombre ||
          reemplazadoPor ||
          detalles.length > 0) && (
          <section>
            <TituloSeccion className="mb-2">Información</TituloSeccion>
            <div className="divide-y divide-noct-divider rounded-lg border border-noct-divider bg-noct-surface px-3.5">
              {campos.map((campo) => (
                <FilaCampo key={campo.etiqueta} etiqueta={campo.etiqueta} valor={campo.valor} mono={campo.mono} />
              ))}
              {detalles.map(([clave, valor]) => (
                <FilaCampo key={clave} etiqueta={clave} valor={valor} />
              ))}
              {ubicacionNombre && (
                <div className="flex min-h-[46px] items-center gap-2.5 py-1.5">
                  <span className="w-[118px] shrink-0 text-[12px] text-noct-neutral-500">Ubicación</span>
                  {ubicacionViva ? (
                    <Link
                      to={`/ubicaciones/${ubicacionViva.id}`}
                      className="inline-flex min-w-0 flex-1 items-center gap-1.5 truncate text-[13.5px] text-noct-accent-300 hover:text-noct-accent-400"
                    >
                      <MapPin size={14} className="shrink-0" aria-hidden />
                      {ubicacionNombre}
                    </Link>
                  ) : (
                    <span className="inline-flex min-w-0 flex-1 items-center gap-1.5 truncate text-[13.5px] text-noct-neutral-200">
                      <MapPin size={14} className="shrink-0 text-noct-neutral-500" aria-hidden />
                      {ubicacionNombre}
                    </span>
                  )}
                </div>
              )}
              {responsableNombre && (
                <div className="flex min-h-[46px] items-center gap-2.5 py-1.5">
                  <span className="w-[118px] shrink-0 text-[12px] text-noct-neutral-500">Responsable</span>
                  {responsableVivo ? (
                    <Link
                      to={`/personas/${responsableVivo.id}`}
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
                </div>
              )}
              {reemplazaNombre && (
                <div className="flex min-h-[46px] items-center gap-2.5 py-1.5">
                  <span className="w-[118px] shrink-0 text-[12px] text-noct-neutral-500">Reemplaza a</span>
                  <Link
                    to={`/dispositivos/${dispositivo.reemplazaA}`}
                    className="inline-flex min-w-0 flex-1 items-center gap-1.5 truncate text-[13.5px] text-noct-accent-300 hover:text-noct-accent-400"
                  >
                    <ArrowsClockwise size={14} className="shrink-0" aria-hidden />
                    {reemplazaNombre}
                  </Link>
                </div>
              )}
              {reemplazadoPor && (
                <div className="flex min-h-[46px] items-center gap-2.5 py-1.5">
                  <span className="w-[118px] shrink-0 text-[12px] text-noct-neutral-500">Reemplazado por</span>
                  <Link
                    to={`/dispositivos/${reemplazadoPor.id}`}
                    className="inline-flex min-w-0 flex-1 items-center gap-1.5 truncate text-[13.5px] text-noct-accent-300 hover:text-noct-accent-400"
                  >
                    <ArrowsClockwise size={14} className="shrink-0" aria-hidden />
                    {reemplazadoPor.nombre}
                  </Link>
                </div>
              )}
            </div>
            {dispositivo.observaciones && (
              <p className="mt-2.5 whitespace-pre-wrap px-0.5 text-[13px] leading-[1.55] text-noct-neutral-300">
                {dispositivo.observaciones}
              </p>
            )}
          </section>
        )}

        {/* Seguridad (grupo P1): los datos sensibles PROPIOS de este
            equipo, cifrados y con la misma protección que la Bóveda.
            Va justo después de Información porque es más información
            del equipo, no una acción. Sin permiso de bóveda no se
            renderiza nada (el componente devuelve null). El id ancla el
            bloque "Que sigue" (O1). */}
        <div id="seguridad">
          <SeguridadDelEquipo
            dispositivoId={dispositivoId}
            puedeVerBoveda={Boolean(perfil?.puedeVerBoveda)}
            nombreSugerido={nombreCampoSugerido}
          />
        </div>

        {/* Resolver con este equipo: diagnóstico, vínculos y creación.
            El id ancla el paso "procedimiento" del bloque "Que sigue" (O1). */}
        <section id="resolver">
          <TituloSeccion className="mb-2">Resolver con este equipo</TituloSeccion>
          <div className="flex flex-col gap-2">
            <IniciarDiagnosticoBoton categoriaId={dispositivo.categoriaId} categoriaNombre={categoria?.nombre} />
            <div className="flex flex-col">
              <ProcedimientosDelEquipo dispositivoId={dispositivoId} />
              <ProblemasDelEquipo dispositivoId={dispositivoId} />
              <CredencialesDelEquipo dispositivoId={dispositivoId} puedeVerBoveda={Boolean(perfil?.puedeVerBoveda)} />
            </div>
            {/* Creacion contextual (fase N2, punto 1): precarga la
                categoria y el equipo afectado, asi ningun dato visible
                aqui se vuelve a escribir a mano en el formulario. */}
            <div className="flex flex-wrap gap-2">
              <Link
                to={`/soluciones/${dispositivo.categoriaId}/nuevo?tipo=problema_frecuente&dispositivoAfectado=${dispositivo.id}&dispositivoNombre=${encodeURIComponent(dispositivo.nombre)}`}
                className={BTN_GHOST_ACENTO}
              >
                <Plus size={13} aria-hidden />
                Reportar incidencia
              </Link>
              {perfil?.puedeVerBoveda && (
                <Link
                  to={`/boveda/nueva?titulo=${encodeURIComponent(`Acceso ${dispositivo.nombre}`)}&categoria=${encodeURIComponent(categoria?.nombre ?? '')}&dispositivoId=${dispositivo.id}&dispositivoNombre=${encodeURIComponent(dispositivo.nombre)}`}
                  className={BTN_GHOST}
                >
                  <LockSimple size={13} aria-hidden />
                  Guardar secreto
                </Link>
              )}
            </div>
          </div>
        </section>

        <ImpactoYDependencias dispositivo={dispositivo} />

        {/* El id ancla el paso "conexiones" del bloque "Que sigue" (O1). */}
        <div id="conexiones">
          <ConexionesFicha dispositivo={dispositivo} />
        </div>

        <Adjuntos entidadTipo="dispositivo" entidadId={dispositivoId} />

        {/* Intervenciones: registro manual + línea de tiempo (Historial). */}
        <section className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <TituloSeccion>Intervenciones</TituloSeccion>
          </div>
          <RegistrarIntervencion dispositivoId={dispositivoId} />
          <Historial entidadTipo="dispositivo" entidadId={dispositivoId} />
        </section>
      </main>

      <DialogoEliminar
        abierto={mostrarEliminar}
        sensible
        titulo={`¿Eliminar el dispositivo "${dispositivo.nombre}"?`}
        descripcion="Esta acción eliminará la ficha del dispositivo, sus campos y sus conexiones registradas."
        advertencia={impacto ? `${impacto} Esas referencias quedarán rotas.` : null}
        onCerrar={() => setMostrarEliminar(false)}
        onConfirmar={eliminar}
      />
    </ShellNocturne>
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

// Fila de la tarjeta de Información: etiqueta, valor y botón de copiar
// con confirmación breve (mismo gesto que ValorCopiable, adaptado al
// diseño de fila del mockup).
function FilaCampo({ etiqueta, valor, mono = false }: { etiqueta: string; valor: string; mono?: boolean }) {
  const [copiado, setCopiado] = useState(false)

  async function copiar() {
    if (await copiarAlPortapapeles(valor)) {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1400)
    }
  }

  return (
    <div className="flex min-h-[46px] items-center gap-2.5 py-1.5">
      <span className="w-[118px] shrink-0 text-[12px] text-noct-neutral-500">{etiqueta}</span>
      <span className={`min-w-0 flex-1 truncate text-[13.5px] text-noct-text ${mono ? 'font-mono' : ''}`}>{valor}</span>
      <button
        type="button"
        onClick={() => void copiar()}
        aria-label={copiado ? 'Copiado' : `Copiar ${etiqueta.toLowerCase()}`}
        className="flex min-h-11 w-9 shrink-0 items-center justify-center rounded-md hover:bg-noct-text/[.05]"
      >
        {copiado ? (
          <Check size={16} className="text-noct-exito" aria-hidden />
        ) : (
          <Copy size={16} className="text-noct-neutral-500" aria-hidden />
        )}
      </button>
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
