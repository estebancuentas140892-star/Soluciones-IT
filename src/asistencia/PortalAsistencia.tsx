import { useCallback, useEffect, useRef, useState } from 'react'
import { CloudSlash, LockSimple, Monitor, PlugsConnected } from '../components/iconos'
import { VistaContenidoAsistencia } from '../features/asistencia/VistaContenidoAsistencia'
import type { MensajeAsistencia } from '../features/asistencia/modelo'
import {
  ErrorDeRed,
  cerrarDesdePortal,
  consultarEstado,
  crearSesion,
  type EstadoServidor,
} from './apiPortal'
import { CodigoQr } from './CodigoQr'
import {
  formatoCodigo,
  formatoRestante,
  guardarSesionPortal,
  intervaloConsulta,
  leerSesionPortal,
  olvidarSesionPortal,
  textoFinal,
  unirMensajes,
  type SesionPortal,
} from './estadoPortal'

// EL PORTAL PUBLICO DE ASISTENCIA (tarea 258, secciones 7 a 9 del
// encargo del 2026-09-23).
//
// Lo abre el computador atendido, SIN iniciar sesion. Pide un codigo,
// espera a que un tecnico lo canjee desde su telefono y, mientras la
// sesion vive, muestra SOLO lo que ese tecnico le envia. No carga la app:
// ni Dexie, ni la sincronizacion, ni el cliente de Supabase, ni el
// service worker, ni la Boveda, ni el buscador, ni las guias. Es una
// entrada propia del build (`asistencia.html`).
//
// Estados que enseña: preparando, esperando conexion (codigo + QR +
// cuenta atras), conectado sin nada todavia, mensajes recibidos,
// terminado (con su motivo: el tecnico se desconecto, se termino aqui,
// inactividad, codigo vencido, maximo, otro equipo), sin conexion (se
// reintenta solo), no disponible y "abierta en otra pestaña".

type Fase =
  | { tipo: 'preparando' }
  | { tipo: 'esperando'; codigo: string; venceEn: number }
  | { tipo: 'conectada' }
  | { tipo: 'terminada'; estado: EstadoServidor; motivo: string | null }
  | { tipo: 'no_disponible' }
  | { tipo: 'otra_pestana' }

function horaCorta(iso: string): string {
  const fecha = new Date(iso)
  return Number.isNaN(fecha.getTime())
    ? ''
    : fecha.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
}

// UNA PESTAÑA POR SESION. Si se duplica la pestaña, la copia hereda la
// sesion (sessionStorage se copia al duplicar): con un candado del
// navegador por id de sesion solo una la usa, y la otra lo dice y espera
// a que la primera se cierre. Dos pestañas NUEVAS no chocan: cada una
// crea su propia sesion con su propio id. Sin la API de candados
// (navegadores viejos) no se bloquea.
function candados(): LockManager | null {
  return (navigator as Navigator & { locks?: LockManager }).locks ?? null
}

function nombreCandado(id: string): string {
  return `asistencia-portal:${id}`
}

/** Toma el candado si está libre y lo sostiene hasta soltarlo. */
function sostenerCandado(id: string): () => void {
  const locks = candados()
  if (!locks) return () => {}
  let liberar: (() => void) | null = null
  let soltado = false
  void locks.request(nombreCandado(id), { ifAvailable: true }, async (candado) => {
    if (!candado || soltado) return
    await new Promise<void>((resolver) => (liberar = resolver))
  })
  return () => {
    soltado = true
    liberar?.()
  }
}

/** Retomar una sesión guardada: si otra pestaña la tiene, se espera a que la suelte. */
function esperarCandado(id: string, alObtener: () => void, alOcupado: () => void): () => void {
  const locks = candados()
  if (!locks) {
    alObtener()
    return () => {}
  }
  let liberar: (() => void) | null = null
  let cancelado = false
  const controlador = new AbortController()
  const sostener = async () => {
    if (cancelado) return
    alObtener()
    await new Promise<void>((resolver) => (liberar = resolver))
  }
  void locks
    .request(nombreCandado(id), { ifAvailable: true }, async (candado) => {
      if (!candado) return 'ocupado'
      await sostener()
      return 'liberado'
    })
    .then((resultado) => {
      if (resultado !== 'ocupado' || cancelado) return
      alOcupado()
      void locks.request(nombreCandado(id), { signal: controlador.signal }, sostener).catch(() => {})
    })
  return () => {
    cancelado = true
    controlador.abort()
    liberar?.()
  }
}

export function PortalAsistencia() {
  const [fase, setFase] = useState<Fase>({ tipo: 'preparando' })
  const [mensajes, setMensajes] = useState<MensajeAsistencia[]>([])
  const [sinConexion, setSinConexion] = useState(false)
  const [ahora, setAhora] = useState(() => Date.now())
  const [terminando, setTerminando] = useState(false)

  const sesion = useRef<SesionPortal | null>(null)
  const ultimoId = useRef(0)
  const desfase = useRef(0) // reloj del servidor menos reloj local
  const errores = useRef(0)
  const temporizador = useRef<number | null>(null)
  const activa = useRef(false)

  const detener = useCallback(() => {
    activa.current = false
    if (temporizador.current !== null) window.clearTimeout(temporizador.current)
    temporizador.current = null
  }, [])

  const consultar = useCallback(async () => {
    const actual = sesion.current
    if (!actual || !activa.current) return
    try {
      const estado = await consultarEstado(actual.id, actual.secreto, ultimoId.current)
      errores.current = 0
      setSinConexion(false)
      desfase.current = new Date(estado.ahora).getTime() - Date.now()
      if (estado.mensajes.length > 0) {
        ultimoId.current = Math.max(ultimoId.current, ...estado.mensajes.map((m) => m.id))
        setMensajes((previos) => unirMensajes(previos, estado.mensajes))
      }
      if (estado.estado === 'esperando' && estado.codigo && estado.codigo_vence_en) {
        setFase({ tipo: 'esperando', codigo: estado.codigo, venceEn: new Date(estado.codigo_vence_en).getTime() })
      } else if (estado.estado === 'conectada') {
        setFase({ tipo: 'conectada' })
      } else {
        // Cerrada, expirada o inexistente: se acabó para esta pestaña.
        detener()
        olvidarSesionPortal()
        sesion.current = null
        setMensajes([])
        setFase({ tipo: 'terminada', estado: estado.estado, motivo: estado.motivo ?? null })
        return
      }
    } catch (error) {
      errores.current += 1
      if (error instanceof ErrorDeRed || !navigator.onLine) setSinConexion(true)
      else if (errores.current >= 3) {
        detener()
        setFase({ tipo: 'no_disponible' })
        return
      }
    }
    if (!activa.current) return
    temporizador.current = window.setTimeout(
      () => void consultar(),
      intervaloConsulta(document.visibilityState === 'visible', errores.current),
    )
  }, [detener])

  // Cada arranque lleva un número: si otro arranque lo adelanta mientras
  // espera al servidor (el doble montaje de desarrollo, "Generar un código
  // nuevo" tocado dos veces), el viejo se retira y cierra la sesión que
  // alcanzó a crear, para no dejarla esperando sin pantalla.
  const generacion = useRef(0)
  const soltarCandado = useRef<(() => void) | null>(null)

  const empezar = useCallback(
    async (nueva: boolean) => {
      const esta = ++generacion.current
      detener()
      setMensajes([])
      ultimoId.current = 0
      errores.current = 0
      setFase({ tipo: 'preparando' })
      let actual = nueva ? null : leerSesionPortal()
      if (!actual) {
        try {
          const creada = await crearSesion()
          if (esta !== generacion.current) {
            void cerrarDesdePortal(creada.id, creada.secreto).catch(() => {})
            return
          }
          actual = { id: creada.id, secreto: creada.secreto }
          guardarSesionPortal(actual)
          soltarCandado.current?.()
          soltarCandado.current = sostenerCandado(actual.id)
          desfase.current = new Date(creada.ahora).getTime() - Date.now()
          setSinConexion(false)
          setFase({ tipo: 'esperando', codigo: creada.codigo, venceEn: new Date(creada.codigo_vence_en).getTime() })
        } catch (error) {
          if (esta !== generacion.current) return
          if (error instanceof ErrorDeRed) {
            setSinConexion(true)
            temporizador.current = window.setTimeout(() => void empezar(true), 5000)
          } else {
            setFase({ tipo: 'no_disponible' })
          }
          return
        }
      }
      if (esta !== generacion.current) return
      sesion.current = actual
      activa.current = true
      void consultar()
    },
    [consultar, detener],
  )

  // Arranque. Una pestaña que ya tenía sesión (recargada o duplicada) la
  // retoma solo si ninguna otra pestaña la está usando; una nueva crea la
  // suya.
  useEffect(() => {
    const previa = leerSesionPortal()
    let soltar = () => {}
    if (previa) {
      soltar = esperarCandado(
        previa.id,
        () => void empezar(false),
        () => setFase({ tipo: 'otra_pestana' }),
      )
    } else {
      void empezar(true)
    }
    return () => {
      generacion.current += 1
      soltar()
      soltarCandado.current?.()
      soltarCandado.current = null
      detener()
    }
  }, [empezar, detener])

  // Al volver a la vista o a la red, se consulta enseguida.
  useEffect(() => {
    function reanudar() {
      if (!activa.current) return
      if (temporizador.current !== null) window.clearTimeout(temporizador.current)
      void consultar()
    }
    function sinRed() {
      setSinConexion(true)
    }
    document.addEventListener('visibilitychange', reanudar)
    window.addEventListener('online', reanudar)
    window.addEventListener('offline', sinRed)
    return () => {
      document.removeEventListener('visibilitychange', reanudar)
      window.removeEventListener('online', reanudar)
      window.removeEventListener('offline', sinRed)
    }
  }, [consultar])

  // La cuenta atrás del código.
  useEffect(() => {
    if (fase.tipo !== 'esperando') return
    setAhora(Date.now())
    const intervalo = window.setInterval(() => setAhora(Date.now()), 1000)
    return () => window.clearInterval(intervalo)
  }, [fase.tipo])

  async function terminar() {
    const actual = sesion.current
    if (!actual || terminando) return
    setTerminando(true)
    try {
      await cerrarDesdePortal(actual.id, actual.secreto)
    } catch {
      // Aunque no llegue, esta pestaña deja de mostrar nada; el servidor
      // la cierra solo por inactividad o por vencimiento del código.
    }
    setTerminando(false)
    detener()
    olvidarSesionPortal()
    sesion.current = null
    setMensajes([])
    setFase({ tipo: 'terminada', estado: 'cerrada', motivo: 'portal' })
  }

  const urlConectar = fase.tipo === 'esperando' ? `${window.location.origin}/conectar?codigo=${fase.codigo}` : ''
  const restante = fase.tipo === 'esperando' ? fase.venceEn - (ahora + desfase.current) : 0
  const recientes = [...mensajes].reverse()

  return (
    <div className="nocturne flex min-h-dvh flex-col bg-noct-bg font-inter text-noct-text">
      <header className="border-b border-noct-divider">
        <div className="mx-auto flex h-14 w-full max-w-2xl items-center gap-2.5 px-4">
          <Monitor size={20} className="shrink-0 text-noct-accent" aria-hidden />
          <p className="min-w-0 flex-1 truncate text-[15px] font-medium">
            Soluciones IT <span className="font-normal text-noct-neutral-400">· Asistencia</span>
          </p>
          {fase.tipo === 'conectada' && (
            <span className="flex items-center gap-1.5 rounded-full bg-noct-exito/[.14] px-2.5 py-1 text-[12px] font-medium text-noct-exito">
              <PlugsConnected size={14} aria-hidden />
              Conectado
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-5">
        {sinConexion && (
          <p role="status" className="flex items-start gap-2 rounded-xl border border-noct-divider bg-noct-surface px-3.5 py-3 text-[14px] leading-snug text-noct-neutral-200">
            <CloudSlash size={18} className="mt-px shrink-0 text-noct-neutral-400" aria-hidden />
            Sin conexión. Se reintenta sola; lo que ya llegó sigue aquí.
          </p>
        )}

        {fase.tipo === 'preparando' && <p className="text-[15px] text-noct-neutral-300">Preparando la asistencia…</p>}

        {fase.tipo === 'esperando' && (
          <section className="flex flex-col items-center gap-4 rounded-2xl border border-noct-divider bg-noct-surface px-4 py-6 text-center">
            <p className="text-[15px] text-noct-neutral-200">Dale este código al técnico</p>
            <p aria-label={`Código ${fase.codigo.split('').join(' ')}`} className="font-mono text-[46px] font-semibold leading-none tracking-[.12em] tabular-nums">
              {formatoCodigo(fase.codigo)}
            </p>
            <CodigoQr texto={urlConectar} etiqueta="QR para conectar el teléfono del técnico" />
            <p className="max-w-sm text-[14px] leading-snug text-noct-neutral-300">
              En su teléfono, en Soluciones IT, toca <span className="font-medium text-noct-text">Conectar equipo</span> y
              escribe el código, o escanea este QR.
            </p>
            <p className="text-[13px] tabular-nums text-noct-neutral-400">
              {restante > 0 ? `El código vence en ${formatoRestante(restante)}` : 'El código está venciendo…'}
            </p>
            <p className="text-[14px] text-noct-neutral-200" role="status">
              Esperando al técnico…
            </p>
          </section>
        )}

        {fase.tipo === 'conectada' && recientes.length === 0 && (
          <section className="flex flex-col gap-2 rounded-2xl border border-noct-exito/30 bg-noct-exito/[.07] px-4 py-5">
            <p className="flex items-center gap-2 text-[16px] font-medium">
              <PlugsConnected size={19} className="shrink-0 text-noct-exito" aria-hidden />
              Conectado con el técnico
            </p>
            <p className="text-[14px] leading-snug text-noct-neutral-300">Aquí aparecerá lo que te envíe.</p>
          </section>
        )}

        {fase.tipo === 'conectada' &&
          recientes.map((mensaje, i) => (
            <VistaContenidoAsistencia
              key={mensaje.id}
              contenido={mensaje.contenido}
              recibido={horaCorta(mensaje.creado_en)}
              destacado={i === 0}
            />
          ))}

        {fase.tipo === 'terminada' && (
          <section className="flex flex-col gap-3 rounded-2xl border border-noct-divider bg-noct-surface px-4 py-5">
            <p className="text-[17px] font-medium">{textoFinal(fase.estado, fase.motivo).titulo}</p>
            <p className="text-[14px] leading-snug text-noct-neutral-300">{textoFinal(fase.estado, fase.motivo).detalle}</p>
            <button
              type="button"
              onClick={() => void empezar(true)}
              className="flex min-h-11 items-center justify-center rounded-lg border border-noct-accent px-3 text-[14px] font-medium text-noct-accent hover:bg-noct-accent/10"
            >
              Generar un código nuevo
            </button>
          </section>
        )}

        {fase.tipo === 'no_disponible' && (
          <section className="flex flex-col gap-3 rounded-2xl border border-noct-divider bg-noct-surface px-4 py-5">
            <p className="text-[17px] font-medium">La asistencia no está disponible ahora</p>
            <p className="text-[14px] leading-snug text-noct-neutral-300">
              Vuelve a intentarlo en unos minutos. Si sigue igual, avisa al equipo de TI por otro medio.
            </p>
            <button
              type="button"
              onClick={() => void empezar(true)}
              className="flex min-h-11 items-center justify-center rounded-lg border border-noct-divider px-3 text-[14px] font-medium text-noct-text hover:bg-noct-text/[.07]"
            >
              Reintentar
            </button>
          </section>
        )}

        {fase.tipo === 'otra_pestana' && (
          <section className="flex flex-col gap-2 rounded-2xl border border-noct-divider bg-noct-surface px-4 py-5">
            <p className="text-[17px] font-medium">Esta asistencia ya está abierta en otra pestaña</p>
            <p className="text-[14px] leading-snug text-noct-neutral-300">
              Usa la otra pestaña. Si la cierras, esta toma el relevo sola.
            </p>
          </section>
        )}

        {(fase.tipo === 'esperando' || fase.tipo === 'conectada') && (
          <button
            type="button"
            onClick={() => void terminar()}
            disabled={terminando}
            className="flex min-h-11 items-center justify-center self-center rounded-lg px-4 text-[14px] font-medium text-noct-neutral-300 hover:bg-noct-text/[.07] disabled:opacity-40"
          >
            {terminando ? 'Terminando…' : 'Terminar la asistencia'}
          </button>
        )}
      </main>

      <footer className="border-t border-noct-divider">
        <p className="mx-auto flex w-full max-w-2xl items-start gap-2 px-4 py-3 text-[12.5px] leading-snug text-noct-neutral-400">
          <LockSimple size={15} className="mt-px shrink-0" aria-hidden />
          Esta página no pide contraseñas ni instala nada. Solo muestra lo que el técnico te envía mientras la sesión
          está abierta.
        </p>
      </footer>
    </div>
  )
}
