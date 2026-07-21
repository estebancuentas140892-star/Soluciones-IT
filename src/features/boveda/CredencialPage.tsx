import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { ShellNocturne } from '../../app/ShellNocturne'
import { BotonVolver } from '../../components/BotonVolver'
import { DialogoEliminar } from '../../components/DialogoEliminar'
import {
  ArrowSquareOut,
  BookOpen,
  CaretRight,
  Check,
  ClockCounterClockwise,
  Copy,
  Eye,
  EyeSlash,
  Monitor,
  PencilSimple,
  TrashSimple,
  type IconoProps,
} from '../../components/iconos'
import { BTN_ICONO_PELIGRO, BTN_SECUNDARIO, TituloSeccion } from '../../components/nocturne'
import { useGrafo } from '../../components/useGrafo'
import { db, type AccesoBoveda, type Dispositivo } from '../../lib/db'
import { origenesDistintos, referenciasHacia, resumenImpacto } from '../../lib/grafo'
import { copiarAlPortapapeles } from '../../lib/portapapeles'
import { textoVivo } from '../../lib/referencia'
import { eliminarRegistro, registrarAccesoBoveda } from '../../lib/repositorio'
import { combinarEventos, ETIQUETA_ACCION_BOVEDA, type EventoLinea } from '../historial/lineaDeTiempo'
import { descripcionEntrada } from '../historial/textoHistorial'
import { IndicadorVencimiento } from './IndicadorVencimiento'
import { descifrarCredencial, type DatosCredencial } from './sesionBoveda'

// Ficha de una credencial re-autorizada al sistema Nocturne (handoff
// "Rediseño de aplicación empresarial", Ficha de Credencial.dc.html,
// tarea 105): responde "¿cuál es el usuario y la contraseña de esto?"
// con el secreto ya descifrado en el propio teléfono. Cabecera pegajosa
// (volver a la Bóveda, Editar, Eliminar), encabezado con el aviso de
// vencimiento y la línea de último acceso, una sola tarjeta de campos
// (etiqueta / valor monoespaciado / ojo si es secreto / copiar) con la
// URL como enlace, y tres bloques de contexto: "Da acceso a" (equipos
// vinculados, con su nombre vivo), "Usada en" (procedimientos que la
// referencian, derivado del grafo) y "Actividad" (auditoría de la
// bóveda + historial de cambios, en una sola línea de tiempo).
// Trae su propio ShellNocturne, por eso su ruta sale del Layout oscuro
// heredado. La lógica no cambia: cada consulta, revelado y copia queda
// registrada, y el secreto nunca sale del dispositivo.

// "2 jul, 10:32": fecha corta con hora, con el año solo cuando no es el
// actual (mismo criterio que la ficha de dispositivo).
function fechaHoraCorta(iso: string): string {
  const fecha = new Date(iso)
  const base: Intl.DateTimeFormatOptions =
    fecha.getFullYear() === new Date().getFullYear()
      ? { day: 'numeric', month: 'short' }
      : { day: 'numeric', month: 'short', year: 'numeric' }
  return new Intl.DateTimeFormat('es', { ...base, hour: '2-digit', minute: '2-digit' }).format(fecha)
}

// Un campo de la tarjeta del secreto. `secreto` decide si arranca
// oculto tras el ojo; `accionCopia` es la acción de auditoría que
// registra copiarlo (solo el usuario y la contraseña tienen una).
interface CampoFicha {
  clave: string
  etiqueta: string
  valor: string
  secreto: boolean
  accionCopia?: AccesoBoveda['accion']
}

// Icono de cada evento de la línea de tiempo, según lo que se hizo.
const ICONO_ACCION: Record<AccesoBoveda['accion'], (props: IconoProps) => React.JSX.Element> = {
  consulto: Eye,
  mostro: Eye,
  copio_usuario: Copy,
  copio_contrasena: Copy,
  modifico: PencilSimple,
  elimino: TrashSimple,
}

export function CredencialPage() {
  const { credencialId = '' } = useParams()
  const navigate = useNavigate()

  const credencial = useLiveQuery(
    async () => (await db.credenciales.get(credencialId)) ?? null,
    [credencialId],
  )

  // Auditoria de la boveda (fase B3) e historial de cambios: alimentan
  // la seccion "Actividad" y, el mas reciente, la linea de "ultimo
  // acceso" del encabezado.
  const accesos = useLiveQuery(
    () => db.accesos_boveda.where('credencialId').equals(credencialId).toArray(),
    [credencialId],
    [] as AccesoBoveda[],
  )
  const cambios = useLiveQuery(
    () => db.historial.where('[entidadTipo+entidadId]').equals(['credencial', credencialId]).toArray(),
    [credencialId],
    [],
  )
  // Equipos a los que da acceso (grupo N3): la fila guarda {id, nombre}
  // como copia de referencia, pero el nombre, la ubicacion y la IP que
  // se muestran salen de la fila viva del dispositivo (regla de
  // referencia viva), asi renombrar un equipo se refleja aqui solo.
  const dispositivos = useLiveQuery(() => db.dispositivos.toArray(), [], [] as Dispositivo[])

  // undefined: descifrando; null: no se pudo descifrar.
  const [datos, setDatos] = useState<DatosCredencial | null | undefined>(undefined)
  // Campos revelados (por clave). Todo lo secreto arranca oculto: la
  // ficha se abre a menudo delante de otras personas.
  const [revelados, setRevelados] = useState<Set<string>>(new Set())
  const [mostrarEliminar, setMostrarEliminar] = useState(false)
  const [verTodaActividad, setVerTodaActividad] = useState(false)

  // Impacto antes de eliminar (fase N1): procedimientos que muestran
  // esta credencial en alguno de sus pasos o tareas y quedarían sin ella.
  const grafo = useGrafo()
  const impacto = resumenImpacto(grafo, 'credencial', credencialId)
  // El mismo vínculo, pero navegable: "Usada en" del mockup.
  const usadaEn = useMemo(
    () =>
      origenesDistintos(
        referenciasHacia(grafo, 'credencial', credencialId, ['credencial_paso', 'credencial_tarea']),
      ),
    [grafo, credencialId],
  )

  useEffect(() => {
    if (!credencial) return
    let vigente = true
    void descifrarCredencial(credencial.datosCifrados).then((resultado) => {
      if (vigente) setDatos(resultado)
    })
    return () => {
      vigente = false
    }
  }, [credencial])

  // Auditoria de la boveda (fase B3): una entrada de "consulto" por
  // apertura de la ficha, una vez que la credencial ya cargo. El ref
  // evita registrar de nuevo si `credencial` se refresca (por ejemplo
  // al sincronizar) sin que el tecnico haya vuelto a abrir la ficha.
  const yaRegistrado = useRef<string | null>(null)
  useEffect(() => {
    if (!credencial || yaRegistrado.current === credencial.id) return
    yaRegistrado.current = credencial.id
    void registrarAccesoBoveda({
      credencialId: credencial.id,
      credencialTitulo: credencial.titulo,
      accion: 'consulto',
    })
  }, [credencial])

  const eventos = useMemo(() => combinarEventos(cambios, [], accesos), [cambios, accesos])
  // Ultimo acceso (fase B3): el mas reciente sin contar el que se acaba
  // de registrar por abrir esta misma ficha (ese es "ahora mismo", no
  // aporta nada mostrarlo como el ultimo acceso de otra persona).
  const ultimoAcceso = useMemo(
    () => [...accesos].sort((a, b) => (a.fechaHora < b.fechaHora ? 1 : -1))[1] ?? null,
    [accesos],
  )

  // Equipos vinculados con su dato vivo resuelto.
  const equipos = useMemo(() => {
    const vivos = new Map(dispositivos.filter((d) => !d.eliminadoEn).map((d) => [d.id, d]))
    return (credencial?.dispositivos ?? []).map((vinculo) => {
      const vivo = vivos.get(vinculo.id) ?? null
      return {
        id: vinculo.id,
        nombre: textoVivo(vivo?.nombre, vinculo.nombre) || '(equipo sin nombre)',
        detalle: vivo ? [vivo.ubicacion, vivo.ip].filter(Boolean).join(' · ') : 'Ya no está en el inventario',
        vivo: Boolean(vivo),
      }
    })
  }, [credencial?.dispositivos, dispositivos])

  if (credencial === null || credencial?.eliminadoEn) return <Navigate to="/boveda" replace />
  if (!credencial || datos === undefined) {
    return (
      <ShellNocturne>
        <p className="px-4 pt-6 text-sm text-noct-neutral-400">Cargando...</p>
      </ShellNocturne>
    )
  }
  // Copia local: TypeScript no conserva el descarte de null/undefined
  // de arriba dentro de las funciones declaradas mas abajo.
  const tituloActual = credencial.titulo

  async function eliminar() {
    await registrarAccesoBoveda({ credencialId, credencialTitulo: tituloActual, accion: 'elimino' })
    await eliminarRegistro('credenciales', credencialId)
    navigate('/boveda')
  }

  // Revelar u ocultar un campo. Solo la contraseña genera entrada de
  // auditoría ('mostro'): es la única acción que el registro inmutable
  // sabe nombrar, y es el secreto que importa vigilar. El registro va
  // FUERA del actualizador de estado: React puede invocarlo dos veces
  // (modo estricto) y se registraría el revelado por duplicado.
  function alternarRevelado(clave: string) {
    const revelando = !revelados.has(clave)
    if (revelando && clave === 'contrasena') {
      void registrarAccesoBoveda({ credencialId, credencialTitulo: tituloActual, accion: 'mostro' })
    }
    setRevelados((actuales) => {
      const siguiente = new Set(actuales)
      if (revelando) siguiente.add(clave)
      else siguiente.delete(clave)
      return siguiente
    })
  }

  // Copiar el usuario o la contraseña queda en la auditoría; el resto
  // de los campos no tiene una acción que el registro sepa nombrar.
  function registrarCopia(campo: CampoFicha) {
    if (!campo.accionCopia) return
    void registrarAccesoBoveda({
      credencialId,
      credencialTitulo: tituloActual,
      accion: campo.accionCopia,
    })
  }

  // Campos de la tarjeta. Los "otros datos protegidos" (extras) también
  // se tratan como secretos: el editor los guarda cifrados junto al
  // resto, así que no tiene sentido mostrarlos en claro al abrir.
  const camposPosibles: CampoFicha[] = datos
    ? [
        { clave: 'usuario', etiqueta: 'Usuario', valor: datos.usuario, secreto: false, accionCopia: 'copio_usuario' },
        { clave: 'contrasena', etiqueta: 'Contraseña', valor: datos.contrasena, secreto: true, accionCopia: 'copio_contrasena' },
        { clave: 'ip', etiqueta: 'Dirección IP', valor: datos.ip, secreto: false },
        ...Object.entries(datos.extras).map(([clave, valor]) => ({
          clave: `extra:${clave}`,
          etiqueta: clave,
          valor,
          secreto: true,
        })),
      ]
    : []
  const campos = camposPosibles.filter((campo) => campo.valor)

  const url = datos?.url ?? ''
  const sinContenido = campos.length === 0 && !url
  const metaLinea = [credencial.categoria, `modificada el ${fechaHoraCorta(credencial.updatedAt)}`]
    .filter(Boolean)
    .join(' · ')
  const eventosVisibles = verTodaActividad ? eventos : eventos.slice(0, 6)

  return (
    <ShellNocturne>
      {/* Cabecera pegajosa: volver a la Bóveda y las dos acciones de la
          ficha. Eliminar va en rojo y de solo icono, como en el mockup. */}
      <div className="sticky top-0 z-20 border-b border-noct-divider bg-noct-bg/[.92] backdrop-blur-[12px]">
        <header className="flex items-center justify-between gap-2 py-2 pl-2 pr-3 lg:px-10">
          <BotonVolver variante="nocturne" />
          <div className="flex shrink-0 gap-1.5">
            <Link to={`/boveda/${credencialId}/editar`} className={BTN_SECUNDARIO}>
              <PencilSimple size={14} aria-hidden />
              Editar
            </Link>
            <button
              type="button"
              onClick={() => setMostrarEliminar(true)}
              aria-label="Eliminar el secreto"
              className={BTN_ICONO_PELIGRO}
            >
              <TrashSimple size={16} aria-hidden />
            </button>
          </div>
        </header>
      </div>

      <main className="flex flex-1 flex-col gap-[22px] px-4 pb-[116px] pt-4 lg:px-10 lg:pb-16">
        <header>
          <div className="flex items-start justify-between gap-2.5">
            <div className="min-w-0">
              <h1 className="text-pretty text-[21px] font-medium leading-[1.25]">{credencial.titulo}</h1>
              {metaLinea && <p className="mt-1 text-[12.5px] text-noct-neutral-500">{metaLinea}</p>}
            </div>
            <IndicadorVencimiento venceEn={credencial.venceEn ?? null} variante="nocturne" />
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-[12px] text-noct-neutral-600">
            <Eye size={13} className="shrink-0" aria-hidden />
            {ultimoAcceso
              ? `Último acceso: ${fechaHoraCorta(ultimoAcceso.fechaHora)}${
                  ultimoAcceso.usuarioNombre ? `, ${ultimoAcceso.usuarioNombre}` : ''
                } · cada consulta queda registrada`
              : 'Cada consulta, revelado y copia queda registrada'}
          </p>
        </header>

        {datos === null ? (
          <p className="rounded-md border border-noct-precaucion/35 bg-noct-precaucion/[.08] px-[13px] py-2.5 text-[12.5px] leading-relaxed text-noct-precaucion">
            No se pudo descifrar este secreto con la contraseña maestra actual. Se guardó con una
            contraseña distinta: verifica con el equipo cuál se usó, o edítala para reemplazar su
            contenido.
          </p>
        ) : (
          <section>
            {sinContenido ? (
              <p className="rounded-lg border border-dashed border-noct-neutral-700 px-4 py-6 text-center text-[13px] text-noct-neutral-500">
                Este secreto no tiene datos guardados.
              </p>
            ) : (
              <div className="divide-y divide-noct-divider rounded-lg border border-noct-divider bg-noct-surface px-3.5">
                {campos.map((campo) => (
                  <FilaSecreto
                    key={campo.clave}
                    campo={campo}
                    oculto={campo.secreto && !revelados.has(campo.clave)}
                    onAlternar={campo.secreto ? () => alternarRevelado(campo.clave) : undefined}
                    onCopiado={() => registrarCopia(campo)}
                  />
                ))}
                {url && <FilaUrl url={url} />}
              </div>
            )}
            {datos.notas && (
              <p className="mt-2.5 whitespace-pre-wrap px-0.5 text-[13px] leading-[1.55] text-noct-neutral-300">
                {datos.notas}
              </p>
            )}
            {/* Dato heredado de un secreto de tipo "equipo" guardado antes
                de la fase P0 (2026-07-21): el editor ya no permite crear
                una IP nueva aquí, pero se sigue mostrando hasta que se
                edite el secreto y se quite a mano. */}
            {datos.ip && (
              <p className="mt-2.5 rounded-md border border-noct-precaucion/35 bg-noct-precaucion/[.08] px-[13px] py-2.5 text-[12px] leading-relaxed text-noct-precaucion">
                La dirección IP es un dato heredado de un equipo. Vincula el equipo en &quot;Da
                acceso a&quot; y edita este secreto para quitarla.
              </p>
            )}
          </section>
        )}

        {/* Da acceso a: el vínculo credencial -> equipo (grupo N3). No va
            cifrado a propósito, así que se ve aunque el contenido no se
            haya podido descifrar. */}
        {equipos.length > 0 && (
          <section>
            <TituloSeccion className="mb-2">Da acceso a</TituloSeccion>
            <div className="flex flex-col">
              {equipos.map((equipo) =>
                equipo.vivo ? (
                  <Link
                    key={equipo.id}
                    to={`/dispositivos/${equipo.id}`}
                    className="flex min-h-[50px] items-center gap-[13px] rounded-md px-2 py-2.5 text-noct-text transition-colors hover:bg-noct-text/[.05]"
                  >
                    <IconoFila Icono={Monitor} tono="exito" />
                    <TextoFila titulo={equipo.nombre} detalle={equipo.detalle} />
                    <CaretRight size={15} className="shrink-0 text-noct-neutral-600" aria-hidden />
                  </Link>
                ) : (
                  <div
                    key={equipo.id}
                    className="flex min-h-[50px] items-center gap-[13px] rounded-md px-2 py-2.5 text-noct-neutral-400"
                  >
                    <IconoFila Icono={Monitor} tono="neutro" />
                    <TextoFila titulo={equipo.nombre} detalle={equipo.detalle} />
                  </div>
                ),
              )}
            </div>
          </section>
        )}

        {/* Usada en: inverso universal (fase N1). Antes no había forma de
            saber, desde la bóveda, qué procedimientos dependen de esta
            credencial. */}
        {usadaEn.length > 0 && (
          <section>
            <TituloSeccion className="mb-2">Usada en</TituloSeccion>
            <div className="flex flex-col">
              {usadaEn.map((origen) => (
                <Link
                  key={`${origen.tipo}:${origen.id}`}
                  to={origen.ruta}
                  className="flex min-h-[50px] items-center gap-[13px] rounded-md px-2 py-2.5 text-noct-text transition-colors hover:bg-noct-text/[.05]"
                >
                  <IconoFila Icono={BookOpen} tono="acento" />
                  <TextoFila titulo={origen.titulo} detalle="Procedimiento" />
                  <CaretRight size={15} className="shrink-0 text-noct-neutral-600" aria-hidden />
                </Link>
              ))}
            </div>
            <p className="mt-1.5 px-2 text-[12px] leading-[1.5] text-noct-neutral-600">
              Si se elimina este secreto, esos pasos quedan sin él.
            </p>
          </section>
        )}

        {/* Actividad: auditoría de la bóveda y cambios de la credencial en
            una sola línea de tiempo (fase N4), lo más reciente primero. */}
        <section>
          <TituloSeccion className="mb-2">Actividad</TituloSeccion>
          {eventos.length === 0 ? (
            <p className="px-2 text-[13px] text-noct-neutral-500">Sin actividad registrada todavía.</p>
          ) : (
            <div className="flex flex-col gap-0.5">
              {eventosVisibles.map((evento) => (
                <FilaActividad key={claveEvento(evento)} evento={evento} />
              ))}
              {eventos.length > eventosVisibles.length && (
                <button
                  type="button"
                  onClick={() => setVerTodaActividad(true)}
                  className="mt-1 self-start px-2 text-[12.5px] font-medium text-noct-accent-300 hover:text-noct-accent-400"
                >
                  Ver toda la actividad ({eventos.length})
                </button>
              )}
            </div>
          )}
        </section>
      </main>

      <DialogoEliminar
        abierto={mostrarEliminar}
        sensible
        titulo={`¿Eliminar "${credencial.titulo}"?`}
        descripcion="Se elimina de la bóveda de todo el equipo."
        advertencia={impacto ? `${impacto} Esos pasos quedarán sin el secreto vinculado.` : null}
        onCerrar={() => setMostrarEliminar(false)}
        onConfirmar={eliminar}
      />
    </ShellNocturne>
  )
}

// Fila de la tarjeta del secreto: etiqueta a la izquierda, valor en
// monoespaciado y las acciones de icono a la derecha (ojo si el campo
// es secreto, copiar siempre). Copiar confirma con un tilde breve.
function FilaSecreto({
  campo,
  oculto,
  onAlternar,
  onCopiado,
}: {
  campo: CampoFicha
  oculto: boolean
  onAlternar?: () => void
  onCopiado?: () => void
}) {
  const [copiado, setCopiado] = useState(false)
  // "Dirección IP" -> "dirección IP": la etiqueta se lee dentro de una
  // frase, pero bajarla entera destrozaría las siglas (IP, SSH).
  const etiquetaBaja = campo.etiqueta.charAt(0).toLowerCase() + campo.etiqueta.slice(1)

  async function copiar() {
    if (await copiarAlPortapapeles(campo.valor)) {
      setCopiado(true)
      onCopiado?.()
      setTimeout(() => setCopiado(false), 1400)
    }
  }

  return (
    <div className="flex min-h-12 items-center gap-2.5 py-1.5">
      <span className="w-24 shrink-0 text-[12px] text-noct-neutral-500">{campo.etiqueta}</span>
      <span
        className={`min-w-0 flex-1 truncate font-mono text-[13.5px] ${oculto ? 'tracking-[2px]' : ''}`}
      >
        {oculto ? '••••••••••••' : campo.valor}
      </span>
      {onAlternar && (
        <button
          type="button"
          onClick={onAlternar}
          aria-label={oculto ? `Mostrar ${etiquetaBaja} (queda registrado)` : `Ocultar ${etiquetaBaja}`}
          className="flex min-h-11 w-9 shrink-0 items-center justify-center rounded-md text-noct-neutral-500 transition-colors hover:bg-noct-text/5 hover:text-noct-text"
        >
          {oculto ? <Eye size={16} aria-hidden /> : <EyeSlash size={16} aria-hidden />}
        </button>
      )}
      <button
        type="button"
        onClick={() => void copiar()}
        aria-label={copiado ? 'Copiado' : `Copiar ${etiquetaBaja}`}
        className={`flex min-h-11 w-9 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-noct-text/5 hover:text-noct-text ${
          copiado ? 'text-noct-exito' : 'text-noct-neutral-500'
        }`}
      >
        {copiado ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
      </button>
    </div>
  )
}

// La URL no es un secreto: se muestra como enlace para abrir el panel
// directo, con el icono de "abrir fuera" del mockup.
function FilaUrl({ url }: { url: string }) {
  const esEnlace = /^https?:\/\//i.test(url)

  return (
    <div className="flex min-h-12 items-center gap-2.5 py-1.5">
      <span className="w-24 shrink-0 text-[12px] text-noct-neutral-500">URL</span>
      {esEnlace ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="min-w-0 flex-1 truncate font-mono text-[13.5px] text-noct-accent-300 hover:text-noct-accent-400"
        >
          {url}
        </a>
      ) : (
        <span className="min-w-0 flex-1 truncate font-mono text-[13.5px]">{url}</span>
      )}
      <ArrowSquareOut size={15} className="w-9 shrink-0 text-noct-neutral-600" aria-hidden />
    </div>
  )
}

// Icono cuadrado de una fila de vínculo, con el tinte de su tipo.
function IconoFila({
  Icono,
  tono,
}: {
  Icono: (props: IconoProps) => React.JSX.Element
  tono: 'exito' | 'acento' | 'neutro'
}) {
  const clases = {
    exito: 'bg-noct-exito/[.12] text-noct-exito',
    acento: 'bg-noct-accent/[.12] text-noct-accent-300',
    neutro: 'bg-noct-neutral-400/[.12] text-noct-neutral-500',
  }[tono]

  return (
    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${clases}`}>
      <Icono size={16} aria-hidden />
    </span>
  )
}

function TextoFila({ titulo, detalle }: { titulo: string; detalle: string }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="block truncate text-[13.5px] font-medium leading-tight">{titulo}</span>
      {detalle && (
        <span className="mt-px block truncate text-[11.5px] text-noct-neutral-500">{detalle}</span>
      )}
    </span>
  )
}

function claveEvento(evento: EventoLinea): string {
  switch (evento.tipo) {
    case 'historial':
      return `historial:${evento.entrada.id}`
    case 'ejecucion_diagnostico':
      return `ejecucion:${evento.ejecucion.id}`
    case 'acceso_boveda':
      return `acceso:${evento.acceso.id}`
  }
}

// Una línea de la actividad: icono de lo que se hizo, qué pasó y, en
// gris, quién y cuándo (con el motivo del cambio si lo hay).
function FilaActividad({ evento }: { evento: EventoLinea }) {
  const { Icono, texto, quien, fechaHora, motivo } = describirEvento(evento)

  return (
    <div className="flex gap-3 px-2 py-2">
      <Icono size={15} className="mt-0.5 shrink-0 text-noct-neutral-500" aria-hidden />
      <div className="min-w-0">
        <p className="text-[13px] leading-[1.45]">{texto}</p>
        <p className="mt-px text-[11.5px] text-noct-neutral-500">
          {[quien, fechaHoraCorta(fechaHora), motivo && `"${motivo}"`].filter(Boolean).join(' · ')}
        </p>
      </div>
    </div>
  )
}

function describirEvento(evento: EventoLinea): {
  Icono: (props: IconoProps) => React.JSX.Element
  texto: string
  quien: string
  fechaHora: string
  motivo: string
} {
  if (evento.tipo === 'acceso_boveda') {
    const { acceso } = evento
    return {
      Icono: ICONO_ACCION[acceso.accion],
      texto: ETIQUETA_ACCION_BOVEDA[acceso.accion],
      quien: acceso.usuarioNombre || 'Usuario desconocido',
      fechaHora: acceso.fechaHora,
      motivo: '',
    }
  }
  if (evento.tipo === 'historial') {
    const { entrada } = evento
    return {
      Icono: entrada.campo === 'creacion' ? ClockCounterClockwise : PencilSimple,
      // El contenido de la credencial viaja cifrado: el historial guarda
      // "(cifrado)" en vez del valor, así que se nombra el cambio sin
      // intentar describir un antes y un después que nadie puede leer.
      texto:
        entrada.campo === 'datosCifrados'
          ? 'Actualizó el contenido protegido'
          : descripcionEntrada(entrada),
      quien: entrada.usuarioNombre || 'Usuario desconocido',
      fechaHora: entrada.fechaHora,
      motivo: entrada.motivo,
    }
  }
  // Las ejecuciones de diagnóstico no apuntan nunca a una credencial;
  // esta rama existe solo para agotar el tipo de la línea de tiempo.
  return {
    Icono: ClockCounterClockwise,
    texto: 'Actividad registrada',
    quien: '',
    fechaHora: evento.fechaHora,
    motivo: '',
  }
}
