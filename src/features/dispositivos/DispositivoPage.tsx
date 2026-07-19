import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { db } from '../../lib/db'
import { copiarAlPortapapeles } from '../../lib/portapapeles'
import { eliminarRegistro } from '../../lib/repositorio'
import { registrarVisita } from '../../lib/recientes'
import { textoVivo } from '../../lib/referencia'
import { resumenImpacto } from '../../lib/grafo'
import { ShellNocturne } from '../../app/ShellNocturne'
import { useAuth } from '../autenticacion/authContext'
import { Adjuntos } from '../../components/Adjuntos'
import { BotonVolver } from '../../components/BotonVolver'
import { DialogoEliminar } from '../../components/DialogoEliminar'
import { useGrafo } from '../../components/useGrafo'
import { useUrlAdjunto } from '../../components/useUrlAdjunto'
import {
  Check,
  Copy,
  DotsThreeOutline,
  LockSimple,
  MapPin,
  PencilSimple,
  Plus,
  QrCode,
  ShareNetwork,
  TrashSimple,
} from '../../components/iconos'
import { BTN_GHOST, BTN_ICONO_SECUNDARIO, BTN_SECUNDARIO, TituloSeccion } from '../../components/nocturne'
import { ImpactoYDependencias } from '../red/ImpactoYDependencias'
import { ConexionesFicha } from '../red/ConexionesFicha'
import { estadoConEtiqueta } from '../red/topologiaVisual'
import { Historial } from '../historial/Historial'
import { IniciarDiagnosticoBoton } from './IniciarDiagnosticoBoton'
import { CredencialesDelEquipo } from './CredencialesDelEquipo'
import { ProblemasDelEquipo } from './ProblemasDelEquipo'
import { ProcedimientosDelEquipo } from './ProcedimientosDelEquipo'
import { RegistrarIntervencion } from './RegistrarIntervencion'

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
  const [mostrarEliminar, setMostrarEliminar] = useState(false)
  const [menuAbierto, setMenuAbierto] = useState(false)
  const { session } = useAuth()

  const dispositivo = useLiveQuery(() => db.dispositivos.get(dispositivoId), [dispositivoId])
  const categoria = useLiveQuery(
    () => (dispositivo ? db.categorias.get(dispositivo.categoriaId) : undefined),
    [dispositivo],
  )
  const perfil = useLiveQuery(
    async () => (session?.user ? ((await db.perfiles.get(session.user.id)) ?? null) : null),
    [session],
  )
  // Ubicacion como entidad (grupo N3): el dato canonico es `ubicacionId`;
  // `dispositivo.ubicacion` es solo la copia de referencia. Se resuelve
  // en vivo contra la tabla `ubicaciones` (regla de referencia viva), asi
  // renombrar el lugar se refleja aqui sin reescribir el dispositivo.
  const ubicacionVinculada = useLiveQuery(
    () => (dispositivo?.ubicacionId ? db.ubicaciones.get(dispositivo.ubicacionId) : undefined),
    [dispositivo?.ubicacionId],
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

  const detalles = Object.entries(dispositivo.detalles).filter(([, valor]) => valor)
  const estado = dispositivo.estado ? estadoConEtiqueta(dispositivo.estado) : null
  const metaLinea = [categoria?.nombre, `actualizado ${fechaCorta(dispositivo.updatedAt)}`]
    .filter(Boolean)
    .join(' · ')

  return (
    <ShellNocturne>
      {/* Cabecera: regreso contextual, compartir y menú de acciones. */}
      <header className="flex items-center justify-between gap-2 pb-2 pl-2 pr-3 pt-2.5 lg:px-10 lg:pt-4">
        <BotonVolver variante="nocturne" to={volverA}>
          {esRed ? 'Red' : 'Dispositivos'}
        </BotonVolver>
        <div className="flex shrink-0 items-center gap-2">
          <BotonCompartir titulo={dispositivo.nombre} />
          <button
            type="button"
            onClick={() => setMenuAbierto((v) => !v)}
            aria-label="Más acciones: duplicar, editar, etiqueta QR o eliminar"
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
          <button
            type="button"
            onClick={() => {
              setMenuAbierto(false)
              setMostrarEliminar(true)
            }}
            className={`${BTN_GHOST} text-noct-error hover:bg-noct-error/10`}
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
        </header>

        {/* Información: filas copiables y ubicación viva. */}
        {(campos.length > 0 || ubicacionNombre || detalles.length > 0) && (
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
            </div>
            {dispositivo.observaciones && (
              <p className="mt-2.5 whitespace-pre-wrap px-0.5 text-[13px] leading-[1.55] text-noct-neutral-300">
                {dispositivo.observaciones}
              </p>
            )}
          </section>
        )}

        {/* Resolver con este equipo: diagnóstico, vínculos y creación. */}
        <section>
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
                className={`${BTN_GHOST} text-noct-accent`}
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
                  Guardar credencial
                </Link>
              )}
            </div>
          </div>
        </section>

        <ImpactoYDependencias dispositivo={dispositivo} />

        <ConexionesFicha dispositivo={dispositivo} />

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
    const url = window.location.href
    if (navigator.share) {
      try {
        await navigator.share({ title: titulo, url })
      } catch {
        // El usuario canceló el diálogo de compartir: no es un error.
      }
      return
    }
    if (await copiarAlPortapapeles(url)) {
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
