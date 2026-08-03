import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { db, type Dispositivo } from '../../lib/db'
import { BarraTarea } from '../../components/BarraTarea'
import { VALOR_TECNICO_COMPACTO } from '../../components/FilaDato'
import { claseEstado, estadoConEtiqueta } from '../red/topologiaVisual'
import {
  ArrowRight,
  CameraSlash,
  Check,
  Flashlight,
  FlashlightFill,
  Monitor,
  Question,
} from '../../components/iconos'
import { BTN_GHOST, BTN_PRIMARIO, BTN_SECUNDARIO } from '../../components/nocturne'
import { conOrigen } from '../../lib/origenNavegacion'
import { resolverCodigo } from './resolverCodigo'
import { codigosLeidos, registrarCodigoLeido, reiniciarConteo } from './sesionEscaneo'

// Pantalla de escaneo a pantalla completa (sin la barra inferior),
// re-autorizada en Nocturne (handoff "Rediseño de aplicación
// empresarial", Escanear Equipo.dc.html; tarea 82). Enciende la camara
// trasera, lee codigos QR y de barras y abre la ficha del dispositivo.
// Usa el detector nativo del navegador (BarcodeDetector, disponible en
// Android) y cae a jsQR (solo QR, importado bajo demanda) donde no
// exista, como en iPhone.

type EstadoCamara = 'iniciando' | 'lista' | 'sin_permiso' | 'sin_camara' | 'no_soportado'

type Aviso =
  | { tipo: 'encontrado'; dispositivo: Dispositivo }
  | { tipo: 'no_encontrado'; codigo: string }
  | { tipo: 'varios'; codigo: string; dispositivos: Dispositivo[] }

// El detector nativo no figura en los tipos de TypeScript: se declara
// solo lo que se usa.
interface DetectorNativo {
  detect(fuente: HTMLVideoElement): Promise<{ rawValue: string }[]>
}

interface ConstructorDetectorNativo {
  new (opciones: { formats: string[] }): DetectorNativo
  getSupportedFormats(): Promise<string[]>
}

// Ademas de QR, los formatos de barras habituales en placas de
// inventario y seriales de fabricante.
const FORMATOS_DESEADOS = [
  'qr_code',
  'code_128',
  'code_39',
  'ean_13',
  'ean_8',
  'upc_a',
  'upc_e',
  'itf',
]

type Lector = (video: HTMLVideoElement) => Promise<string | null>

async function crearLector(): Promise<Lector> {
  const Nativo = (window as { BarcodeDetector?: ConstructorDetectorNativo }).BarcodeDetector
  if (Nativo) {
    try {
      const soportados = await Nativo.getSupportedFormats()
      const formatos = FORMATOS_DESEADOS.filter((f) => soportados.includes(f))
      if (formatos.length > 0) {
        const detector = new Nativo({ formats: formatos })
        return async (video) => {
          const codigos = await detector.detect(video)
          return codigos[0]?.rawValue ?? null
        }
      }
    } catch {
      // Si el detector nativo no arranca, se sigue con jsQR.
    }
  }

  const { default: jsQR } = await import('jsqr')
  const canvas = document.createElement('canvas')
  const contexto = canvas.getContext('2d', { willReadFrequently: true })
  return (video) => {
    if (!contexto || video.videoWidth === 0) return Promise.resolve(null)
    // Se reduce el cuadro para que jsQR corra fluido en telefonos.
    const escala = Math.min(1, 640 / video.videoWidth)
    canvas.width = Math.round(video.videoWidth * escala)
    canvas.height = Math.round(video.videoHeight * escala)
    contexto.drawImage(video, 0, 0, canvas.width, canvas.height)
    const imagen = contexto.getImageData(0, 0, canvas.width, canvas.height)
    const codigo = jsQR(imagen.data, imagen.width, imagen.height, {
      inversionAttempts: 'dontInvert',
    })
    return Promise.resolve(codigo ? codigo.data : null)
  }
}

export function EscanerPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const pistaRef = useRef<MediaStreamTrack | null>(null)

  const [camara, setCamara] = useState<EstadoCamara>('iniciando')
  const [aviso, setAviso] = useState<Aviso | null>(null)
  const [linterna, setLinterna] = useState({ disponible: false, encendida: false })
  const [codigoManual, setCodigoManual] = useState('')
  // Contador de la sesión (M-029, mockup `8b`): sobrevive a ir a una
  // ficha y volver, porque vive en `sessionStorage` y no en el estado de
  // esta pantalla. Ver src/features/escaner/sesionEscaneo.ts.
  const [leidos, setLeidos] = useState<string[]>(codigosLeidos)

  // El origen que se le pasa a todo lo que sale del escáner, para que el
  // regreso diga "‹ Escáner" y vuelva con la cámara viva (regla M-R2).
  const origenEscaner = conOrigen('/escaner', 'Escáner')

  const dispositivos = useLiveQuery(() => db.dispositivos.toArray(), [], [])
  const dispositivosRef = useRef(dispositivos)
  dispositivosRef.current = dispositivos

  // Mientras hay un aviso en pantalla el bucle no procesa cuadros:
  // asi el mismo codigo no vuelve a dispararse hasta cerrarlo.
  const avisoRef = useRef(aviso)
  avisoRef.current = aviso

  // Resuelve un codigo (escaneado o escrito) a un aviso. Un unico
  // equipo ya no salta directo a su ficha: se confirma con la tarjeta
  // "Equipo identificado" (fiel al diseño), para dar acuse de lo leido
  // y poder seguir escaneando varios equipos seguidos.
  function manejarCodigo(codigo: string) {
    const resultado = resolverCodigo(codigo, dispositivosRef.current)
    const porId = new Map(dispositivosRef.current.map((d) => [d.id, d]))
    if (resultado.tipo === 'dispositivo') {
      const dispositivo = porId.get(resultado.dispositivoId)
      if (dispositivo) {
        navigator.vibrate?.(60)
        setLeidos(registrarCodigoLeido(codigo))
        setAviso({ tipo: 'encontrado', dispositivo })
        return
      }
    }
    if (resultado.tipo === 'varios') {
      navigator.vibrate?.(60)
      setLeidos(registrarCodigoLeido(codigo))
      const encontrados = resultado.dispositivoIds
        .map((id) => porId.get(id))
        .filter((d): d is Dispositivo => Boolean(d))
      setAviso({ tipo: 'varios', codigo, dispositivos: encontrados })
      return
    }
    setAviso({ tipo: 'no_encontrado', codigo })
  }

  const manejarCodigoRef = useRef(manejarCodigo)
  manejarCodigoRef.current = manejarCodigo

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (!navigator.mediaDevices?.getUserMedia) {
      // Tambien pasa fuera de HTTPS: el navegador oculta la camara.
      setCamara('no_soportado')
      return
    }

    let cancelado = false
    let stream: MediaStream | null = null
    let temporizador: ReturnType<typeof setTimeout> | undefined

    async function iniciar() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        })
      } catch (error) {
        if (cancelado) return
        const nombre = error instanceof DOMException ? error.name : ''
        if (nombre === 'NotAllowedError') setCamara('sin_permiso')
        else if (nombre === 'NotFoundError' || nombre === 'OverconstrainedError')
          setCamara('sin_camara')
        else setCamara('no_soportado')
        return
      }
      if (cancelado || !video) {
        stream.getTracks().forEach((pista) => pista.stop())
        return
      }

      video.srcObject = stream
      try {
        await video.play()
      } catch {
        // play() se interrumpe si la pantalla se cierra enseguida.
      }
      if (cancelado) return
      setCamara('lista')

      const pista = stream.getVideoTracks()[0] ?? null
      pistaRef.current = pista
      const capacidades = pista?.getCapabilities?.() as
        | (MediaTrackCapabilities & { torch?: boolean })
        | undefined
      if (capacidades?.torch) setLinterna({ disponible: true, encendida: false })

      const leer = await crearLector()
      if (cancelado) return

      const bucle = async () => {
        if (cancelado) return
        if (!avisoRef.current && video.readyState >= 2) {
          let codigo: string | null = null
          try {
            codigo = await leer(video)
          } catch {
            // Un cuadro ilegible no detiene el escaneo.
          }
          if (cancelado) return
          if (codigo) manejarCodigoRef.current(codigo)
        }
        temporizador = setTimeout(() => void bucle(), 200)
      }
      void bucle()
    }

    void iniciar()

    return () => {
      cancelado = true
      clearTimeout(temporizador)
      stream?.getTracks().forEach((pista) => pista.stop())
      pistaRef.current = null
    }
  }, [])

  async function alternarLinterna() {
    const pista = pistaRef.current
    if (!pista) return
    const encendida = !linterna.encendida
    try {
      await pista.applyConstraints({ advanced: [{ torch: encendida } as MediaTrackConstraintSet] })
      setLinterna({ disponible: true, encendida })
    } catch {
      setLinterna({ disponible: false, encendida: false })
    }
  }

  function buscarManual(evento: React.FormEvent) {
    evento.preventDefault()
    if (codigoManual.trim()) manejarCodigo(codigoManual.trim())
  }

  const fallo = camara === 'sin_permiso' || camara === 'sin_camara' || camara === 'no_soportado'
  const mensajeFallo =
    camara === 'sin_permiso'
      ? 'La aplicación no tiene permiso para usar la cámara. Actívalo en los ajustes del navegador y vuelve a entrar. Mientras tanto puedes buscar el equipo escribiendo su placa o serial.'
      : camara === 'sin_camara'
        ? 'No se encontró una cámara en este equipo. Busca el equipo escribiendo su placa de inventario o el serial.'
        : 'Este navegador no permite usar la cámara aquí. Busca el equipo escribiendo su placa de inventario o el serial.'

  // Registrar el equipo precargando el codigo leido como serial
  // (hallazgo H3): asi el tecnico no reescribe lo que la app ya leyo. Se
  // omite si el codigo es una URL de etiqueta (no es un serial).
  const rutaRegistrarEquipo =
    aviso?.tipo === 'no_encontrado' && !/^https?:\/\//i.test(aviso.codigo)
      ? `/dispositivos/nuevo?serial=${encodeURIComponent(aviso.codigo)}`
      : '/dispositivos/nuevo'

  return (
    <div className="nocturne relative mx-auto flex min-h-svh max-w-md flex-col overflow-hidden bg-noct-bg font-inter text-[15px] text-noct-text">
      <video
        ref={videoRef}
        playsInline
        muted
        className="absolute inset-0 h-full w-full object-cover"
      />

      {/* Fondo con degradado radial: cubre el video vacío mientras la
          cámara arranca o cuando falla, para no dejar un rectángulo negro. */}
      {!(camara === 'lista') && (
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(120% 90% at 50% 30%, oklch(0.24 0.015 260) 0%, oklch(0.17 0.012 260) 55%, oklch(0.13 0.01 260) 100%)',
          }}
        />
      )}

      {/* Velo superior: mantiene legible la cabecera sobre el video en vivo. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[5] h-28 bg-gradient-to-b from-noct-bg/85 to-transparent" />

      {/* Nivel 3 del chasis (tarea 185): tarea con salida. El escáner
          conserva su propio contenedor porque el video va detrás a
          pantalla completa, pero adopta la BarraTarea, que orienta y da
          la salida siempre en el mismo sitio (R19). */}
      <BarraTarea rotulo="Escaneando" titulo="Código QR o de barras" salidaEtiqueta="Salir del escáner">
        {(leidos.length > 0 || linterna.disponible) && (
          <div className="flex items-center justify-between gap-2 px-3 pb-2">
            {/* Contador de la sesión (M-029): es lo que da sentido a
                quedarse dentro en vez de salir tras cada equipo. */}
            {leidos.length > 0 ? (
              <button
                type="button"
                onClick={() => setLeidos(reiniciarConteo())}
                title="Reiniciar el conteo"
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-noct-divider bg-noct-bg/65 px-3 text-[12px] font-medium text-noct-neutral-300 backdrop-blur-[8px] hover:text-noct-text"
              >
                <Check size={14} className="text-noct-exito" aria-hidden />
                {leidos.length} {leidos.length === 1 ? 'leído' : 'leídos'}
                <span className="sr-only"> en esta sesión de escaneo. Tocar para reiniciar el conteo</span>
              </button>
            ) : (
              <span />
            )}
            {linterna.disponible && (
            <button
              type="button"
              onClick={() => void alternarLinterna()}
              aria-pressed={linterna.encendida}
              className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-[12px] font-medium backdrop-blur-[8px] ${
                linterna.encendida
                  ? 'border-noct-precaucion/50 bg-noct-precaucion/[.12] text-noct-precaucion'
                  : 'border-noct-divider bg-noct-bg/65 text-noct-neutral-300'
              }`}
            >
              {linterna.encendida ? <FlashlightFill size={15} aria-hidden /> : <Flashlight size={15} aria-hidden />}
              Linterna
            </button>
            )}
          </div>
        )}
      </BarraTarea>

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center gap-[18px] px-8 pb-32 pt-6">
        {fallo ? (
          <div className="flex w-full flex-col gap-3 rounded-lg border border-noct-divider bg-noct-surface p-4">
            <div className="flex items-start gap-[11px]">
              <CameraSlash size={20} className="mt-px shrink-0 text-noct-precaucion" aria-hidden />
              <p className="text-[13.5px] leading-[1.55]">{mensajeFallo}</p>
            </div>
          </div>
        ) : (
          <>
            <div className="relative aspect-square w-full max-w-[280px]">
              <span className="absolute left-0 top-0 block h-[34px] w-[34px] rounded-tl-xl border-l-[2.5px] border-t-[2.5px] border-noct-accent" />
              <span className="absolute right-0 top-0 block h-[34px] w-[34px] rounded-tr-xl border-r-[2.5px] border-t-[2.5px] border-noct-accent" />
              <span className="absolute bottom-0 left-0 block h-[34px] w-[34px] rounded-bl-xl border-b-[2.5px] border-l-[2.5px] border-noct-accent" />
              <span className="absolute bottom-0 right-0 block h-[34px] w-[34px] rounded-br-xl border-b-[2.5px] border-r-[2.5px] border-noct-accent" />
              <span
                className="esc-linea absolute left-[6%] right-[6%] block h-0.5 rounded-full bg-gradient-to-r from-transparent via-noct-accent to-transparent"
                style={{ boxShadow: '0 0 14px color-mix(in srgb, var(--color-noct-accent) 60%, transparent)' }}
              />
            </div>
            <p className="max-w-[260px] text-center text-[13px] leading-[1.5] text-noct-neutral-300">
              {camara === 'iniciando'
                ? 'Iniciando la cámara...'
                : 'Apunta al código QR de la etiqueta o al código de barras del equipo'}
            </p>
          </>
        )}
      </main>

      {/* Barra inferior fija: búsqueda manual siempre visible; una tarjeta
          de aviso la reemplaza cuando hay un resultado que confirmar. */}
      <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-b from-transparent via-noct-bg/85 to-noct-bg px-4 pb-[calc(16px+env(safe-area-inset-bottom))] pt-3.5">
        {!aviso && (
          <form onSubmit={buscarManual} className="flex items-center gap-2.5">
            <input
              type="text"
              value={codigoManual}
              onChange={(evento) => setCodigoManual(evento.target.value)}
              placeholder="O escribir la placa o el serial"
              aria-label="Buscar por placa o serial"
              className="min-h-[46px] min-w-0 flex-1 rounded-lg border border-noct-divider bg-noct-surface px-3.5 text-[14px] text-noct-text outline-none placeholder:text-noct-neutral-600 focus:border-noct-accent"
            />
            <button type="submit" className={`min-h-[46px] px-4 ${BTN_PRIMARIO}`}>
              Buscar
            </button>
          </form>
        )}

        {aviso?.tipo === 'no_encontrado' && (
          <div className="flex flex-col gap-[11px] rounded-lg border border-noct-divider bg-noct-surface p-3.5 shadow-lg">
            <div className="flex items-start gap-[11px]">
              <Question size={19} className="mt-px shrink-0 text-noct-precaucion" aria-hidden />
              <div className="min-w-0">
                <p className="text-sm font-medium">Ningún equipo coincide con este código</p>
                <p className="mt-1 break-all font-mono text-[12px] text-noct-neutral-400">
                  {aviso.codigo}
                </p>
              </div>
            </div>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setAviso(null)}
                className={`flex-1 justify-center ${BTN_PRIMARIO}`}
              >
                {fallo ? 'Cerrar' : 'Seguir escaneando'}
              </button>
              <Link
                to={rutaRegistrarEquipo}
                state={origenEscaner}
                className={BTN_SECUNDARIO}
              >
                Registrar equipo
              </Link>
            </div>
          </div>
        )}

        {aviso?.tipo === 'varios' && (
          <div className="flex flex-col gap-[11px] rounded-lg border border-noct-divider bg-noct-surface p-3.5 shadow-lg">
            <p className="text-sm font-medium">Varios equipos comparten este código</p>
            <div className="flex flex-col gap-[7px]">
              {aviso.dispositivos.map((dispositivo) => (
                <Link
                  key={dispositivo.id}
                  to={`/dispositivos/${dispositivo.id}`}
                  state={origenEscaner}
                  className="flex min-h-[50px] items-center gap-[11px] rounded-lg border border-noct-divider bg-noct-bg px-3 py-2 text-noct-text hover:border-noct-accent"
                >
                  <Monitor size={17} className="shrink-0 text-noct-exito" aria-hidden />
                  <span className="min-w-0">
                    <span className="block text-[13.5px] font-medium leading-[1.3]">
                      {dispositivo.nombre}
                    </span>
                    {dispositivo.ubicacion && (
                      <span className="mt-px block truncate text-[11.5px] text-noct-neutral-500">
                        {dispositivo.ubicacion}
                      </span>
                    )}
                  </span>
                </Link>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setAviso(null)}
              className={`justify-center ${BTN_PRIMARIO}`}
            >
              Seguir escaneando
            </button>
          </div>
        )}

        {aviso?.tipo === 'encontrado' && (
          <div className="flex flex-col gap-[11px] rounded-lg border border-noct-exito/40 bg-noct-surface p-3.5 shadow-lg">
            <div className="flex items-center gap-[11px]">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-noct-exito/[.14] text-noct-exito">
                <Check size={18} aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-[0.07em] text-noct-exito">
                  Equipo identificado
                </p>
                <p className="mt-[3px] truncate text-[14.5px] font-medium leading-[1.3]">
                  {aviso.dispositivo.nombre}
                  {aviso.dispositivo.ubicacion && (
                    <span className="text-noct-neutral-400"> · {aviso.dispositivo.ubicacion}</span>
                  )}
                </p>
              </div>
            </div>

            {/* El estado y la IP en el propio acuse (M-029): muchas veces
                son lo único que se venía a mirar, y sacarlos aquí ahorra
                abrir la ficha entera. La IP cumple el piso de dato
                técnico (M-R5). */}
            {(aviso.dispositivo.estado || aviso.dispositivo.ip) && (
              <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 pl-[47px]">
                {aviso.dispositivo.estado && (
                  <span
                    className={`inline-flex items-center gap-1.5 text-[12px] font-medium ${claseEstado(
                      estadoConEtiqueta(aviso.dispositivo.estado).etiqueta,
                    )}`}
                  >
                    <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-current" />
                    {estadoConEtiqueta(aviso.dispositivo.estado).etiqueta}
                  </span>
                )}
                {aviso.dispositivo.ip && (
                  <span className={VALOR_TECNICO_COMPACTO}>{aviso.dispositivo.ip}</span>
                )}
              </p>
            )}

            <div className="flex gap-2.5">
              {/* Sin `replace: true` (M-029). Era literalmente lo que
                  borraba el escáner del historial: la ficha se abría
                  ENCIMA de él y luego volvía a Equipos, así que
                  inventariar un rack costaba cuatro toques por equipo en
                  vez de dos. Ahora la ficha se apila y su regreso dice
                  "‹ Escáner". */}
              <Link
                to={`/dispositivos/${aviso.dispositivo.id}`}
                state={origenEscaner}
                className={`flex-1 justify-center ${BTN_PRIMARIO}`}
              >
                <ArrowRight size={14} aria-hidden />
                Abrir la ficha
              </Link>
              <button type="button" onClick={() => setAviso(null)} className={BTN_GHOST}>
                Seguir
              </button>
            </div>
            {/* El compromiso escrito: sin él, "Abrir la ficha" sigue
                pareciendo el final del escaneo. */}
            <p className="text-center text-[11.5px] text-noct-neutral-500">La ficha vuelve aquí al terminar</p>
          </div>
        )}
      </div>
    </div>
  )
}
