import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { db, type Dispositivo } from '../../lib/db'
import { resolverCodigo } from './resolverCodigo'

// Pantalla de escaneo a pantalla completa (sin la barra inferior):
// enciende la camara trasera, lee codigos QR y de barras y abre la
// ficha del dispositivo. Usa el detector nativo del navegador
// (BarcodeDetector, disponible en Android) y cae a jsQR (solo QR,
// importado bajo demanda) donde no exista, como en iPhone.

type EstadoCamara = 'iniciando' | 'lista' | 'sin_permiso' | 'sin_camara' | 'no_soportado'

type Aviso =
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
  const navigate = useNavigate()
  const videoRef = useRef<HTMLVideoElement>(null)
  const pistaRef = useRef<MediaStreamTrack | null>(null)

  const [camara, setCamara] = useState<EstadoCamara>('iniciando')
  const [aviso, setAviso] = useState<Aviso | null>(null)
  const [linterna, setLinterna] = useState({ disponible: false, encendida: false })
  const [codigoManual, setCodigoManual] = useState('')

  const dispositivos = useLiveQuery(() => db.dispositivos.toArray(), [], [])
  const dispositivosRef = useRef(dispositivos)
  dispositivosRef.current = dispositivos

  // Mientras hay un aviso en pantalla el bucle no procesa cuadros:
  // asi el mismo codigo no vuelve a dispararse hasta cerrarlo.
  const avisoRef = useRef(aviso)
  avisoRef.current = aviso

  // Devuelve true si navego a una ficha (la pantalla se desmonta).
  function manejarCodigo(codigo: string): boolean {
    const resultado = resolverCodigo(codigo, dispositivosRef.current)
    if (resultado.tipo === 'dispositivo') {
      navigator.vibrate?.(60)
      navigate(`/dispositivos/${resultado.dispositivoId}`, { replace: true })
      return true
    }
    if (resultado.tipo === 'varios') {
      navigator.vibrate?.(60)
      const porId = new Map(dispositivosRef.current.map((d) => [d.id, d]))
      const encontrados = resultado.dispositivoIds
        .map((id) => porId.get(id))
        .filter((d): d is Dispositivo => Boolean(d))
      setAviso({ tipo: 'varios', codigo, dispositivos: encontrados })
      return false
    }
    setAviso({ tipo: 'no_encontrado', codigo })
    return false
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
          if (codigo && manejarCodigoRef.current(codigo)) return
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
    if (codigoManual.trim()) manejarCodigo(codigoManual)
  }

  const fallo = camara === 'sin_permiso' || camara === 'sin_camara' || camara === 'no_soportado'

  return (
    <div className="relative mx-auto flex min-h-svh max-w-md flex-col overflow-hidden bg-slate-950 text-slate-100">
      <video
        ref={videoRef}
        playsInline
        muted
        className="absolute inset-0 h-full w-full object-cover"
      />

      <header className="relative z-10 flex items-center justify-between gap-2 px-4 pt-4">
        <Link
          to="/dispositivos"
          className="rounded-lg bg-slate-950/70 px-3 py-1.5 text-xs text-slate-200"
        >
          ← Volver
        </Link>
        <h1 className="text-sm font-medium drop-shadow">Escanear código</h1>
        {linterna.disponible ? (
          <button
            type="button"
            onClick={() => void alternarLinterna()}
            className={`rounded-lg px-3 py-1.5 text-xs ${
              linterna.encendida ? 'bg-amber-400 text-slate-950' : 'bg-slate-950/70 text-slate-200'
            }`}
          >
            Linterna
          </button>
        ) : (
          <span className="w-16" />
        )}
      </header>

      {camara === 'iniciando' && (
        <p className="relative z-10 flex flex-1 items-center justify-center text-sm text-slate-400">
          Iniciando cámara...
        </p>
      )}

      {camara === 'lista' && (
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-3 px-8">
          <div className="aspect-square w-full max-w-xs rounded-2xl border-2 border-white/60" />
          <p className="text-center text-xs drop-shadow">
            Apunta al código QR de la etiqueta o al código de barras del equipo
          </p>
        </div>
      )}

      {fallo && (
        <div className="relative z-10 mx-4 my-auto flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900 px-4 py-5">
          <p className="text-sm text-slate-200">
            {camara === 'sin_permiso' &&
              'La app no tiene permiso para usar la cámara. Actívalo en los ajustes del navegador y vuelve a entrar.'}
            {camara === 'sin_camara' && 'No se encontró una cámara en este equipo.'}
            {camara === 'no_soportado' && 'Este navegador no permite usar la cámara aquí.'}
          </p>
          <form onSubmit={buscarManual} className="flex flex-col gap-2">
            <p className="text-xs text-slate-400">
              También puedes escribir la placa de inventario o el serial:
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={codigoManual}
                onChange={(evento) => setCodigoManual(evento.target.value)}
                placeholder="Placa o serial..."
                className="min-w-0 flex-1 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <button
                type="submit"
                className="shrink-0 rounded-xl bg-sky-500 px-3 py-2 text-xs font-medium text-slate-950"
              >
                Buscar
              </button>
            </div>
          </form>
        </div>
      )}

      {aviso && (
        <div className="absolute inset-x-4 bottom-6 z-20 flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900 px-4 py-4">
          {aviso.tipo === 'no_encontrado' ? (
            <>
              <p className="text-sm text-slate-200">Ningún dispositivo coincide con este código:</p>
              <p className="break-all font-mono text-xs text-slate-400">{aviso.codigo}</p>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-200">Varios dispositivos comparten este código:</p>
              <ul className="flex flex-col gap-1.5">
                {aviso.dispositivos.map((dispositivo) => (
                  <li key={dispositivo.id}>
                    <Link
                      to={`/dispositivos/${dispositivo.id}`}
                      className="block rounded-lg border border-slate-800 bg-slate-950 px-3 py-2"
                    >
                      <span className="text-sm text-slate-100">{dispositivo.nombre}</span>
                      {dispositivo.ubicacion && (
                        <span className="text-xs text-slate-400"> · {dispositivo.ubicacion}</span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAviso(null)}
              className="rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-medium text-slate-950"
            >
              {fallo ? 'Cerrar' : 'Seguir escaneando'}
            </button>
            {aviso.tipo === 'no_encontrado' && (
              <Link
                to="/dispositivos/nuevo"
                className="rounded-lg border border-slate-800 px-3 py-1.5 text-xs text-slate-300"
              >
                Registrar dispositivo
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
