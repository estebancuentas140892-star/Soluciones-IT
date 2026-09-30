import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Chasis } from '../../app/Chasis'
import { CampoContrasena } from '../../components/CampoContrasena'
import { LockSimple } from '../../components/iconos'
import { BTN_GHOST, BTN_PRIMARIO, BTN_SECUNDARIO } from '../../components/nocturne'
import { db, ID_BLOQUEO_APP, type ConfigBloqueoApp, type MetodoBloqueoApp } from '../../lib/db'
import type { CredencialRegistrada } from '../../lib/webauthn'
import {
  bloquearApp,
  cambiarBloqueoApp,
  completarDesbloqueoDispositivo,
  configurarBloqueoApp,
  confirmarBloqueoActual,
  crearDesbloqueoDispositivo,
  definirMinutosAutobloqueoApp,
  desactivarDesbloqueoDispositivo,
  descartarDesbloqueoPendiente,
  MENSAJE_DISPOSITIVO_NO_SE_PUDO,
  OPCIONES_AUTOBLOQUEO_APP_MIN,
  probarDesbloqueoDispositivo,
  quitarBloqueoApp,
  validarSecreto,
} from './bloqueoApp'
import { useDesbloqueoDispositivoDisponible } from './useBloqueoApp'
import { serializarPatron } from './patron'
import { PatronInput } from './PatronInput'
import { CLASE_CAMPO as CLASE_CAMPO_BASE } from '../../components/campos'

// Contraseña de desbloqueo centrada: `text-center` es alineación, no
// tamaño, así que no compite con el `text-sm` del campo compartido.
const CLASE_CAMPO = `${CLASE_CAMPO_BASE} text-center`

// "Seguridad de la aplicación" re-autorizada al sistema Nocturne
// (tarea 97, sin mockup: se traduce el diseño heredado siguiendo el
// patrón ya establecido, regla 12): activa, cambia o quita el bloqueo
// de este dispositivo (patrón o contraseña) y, desde la tarea 278, el
// desbloqueo del dispositivo como vía rápida sobre ese respaldo. Es una
// capa adicional a la sesión de inicio; para las credenciales de la
// bóveda sigue rigiendo la contraseña maestra. Mismo shell centrado
// "alcanzada desde Inicio" que CuentaPage y DiagnosticosPage.
export function SeguridadPage() {
  const config = useLiveQuery(async () => (await db.seguridadApp.get(ID_BLOQUEO_APP)) ?? null, [])

  return (
    // Nivel 2 del chasis (tarea 185): documento.
    <Chasis
      modo="documento"
      barra={
        <div className="px-4 pb-3 pt-0.5">
          <h1 className="text-[22px] font-medium leading-[1.25]">Seguridad de la aplicación</h1>
          <p className="mt-[3px] text-[12.5px] text-noct-neutral-500">
            Bloqueo de este dispositivo. Se pide al abrir la app y tras un rato de inactividad.
          </p>
        </div>
      }
    >
      <main className="flex flex-1 flex-col gap-4 px-4 pb-10 pt-4">
        {config === undefined ? (
          <p className="text-[13px] text-noct-neutral-400">Cargando...</p>
        ) : config === null ? (
          <PanelSinConfigurar />
        ) : (
          <PanelConfigurado config={config} />
        )}
      </main>
    </Chasis>
  )
}

// ----------------------------------------------------------------
// Sin bloqueo: invitacion y alta
// ----------------------------------------------------------------

function PanelSinConfigurar() {
  const [metodo, setMetodo] = useState<MetodoBloqueoApp | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [procesando, setProcesando] = useState(false)

  async function crear(secreto: string) {
    setProcesando(true)
    const mensaje = await configurarBloqueoApp(metodo!, secreto)
    setProcesando(false)
    if (mensaje) setError(mensaje)
    // Si sale bien, el bloqueo queda activo y desbloqueado; la vista
    // se actualiza sola por el useLiveQuery de arriba.
  }

  if (!metodo) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-lg border border-noct-divider bg-noct-surface p-4">
          <p className="text-[13px] leading-relaxed text-noct-neutral-300">
            Este dispositivo no tiene bloqueo. Actívalo para que nadie pueda abrir la app y ver la
            información con solo tomar el teléfono, aunque la sesión siga iniciada.
          </p>
        </div>
        <p className="text-sm font-medium text-noct-text">Elige el método</p>
        <SelectorMetodo onElegir={setMetodo} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <button type="button" onClick={() => setMetodo(null)} className={`${BTN_GHOST} self-start`}>
        Cambiar método
      </button>
      <CrearSecreto metodo={metodo} onCreado={crear} error={error} onError={setError} procesando={procesando} />
    </div>
  )
}

// ----------------------------------------------------------------
// Con bloqueo: estado y acciones
// ----------------------------------------------------------------

type Accion = 'inicio' | 'cambiar' | 'quitar' | 'dispositivo'

function PanelConfigurado({ config }: { config: ConfigBloqueoApp }) {
  const metodo = config.metodo
  const minutos = config.minutosAutobloqueo
  const [accion, setAccion] = useState<Accion>('inicio')
  const [minutosSel, setMinutosSel] = useState(
    OPCIONES_AUTOBLOQUEO_APP_MIN.includes(minutos) ? minutos : OPCIONES_AUTOBLOQUEO_APP_MIN[1],
  )

  function cambiarMinutos(valor: number) {
    setMinutosSel(valor)
    void definirMinutosAutobloqueoApp(valor)
  }

  if (accion === 'cambiar') return <FlujoCambiar metodoActual={metodo} onListo={() => setAccion('inicio')} />
  if (accion === 'quitar') {
    return (
      <FlujoQuitar
        metodoActual={metodo}
        conDispositivo={Boolean(config.desbloqueoDispositivo)}
        onListo={() => setAccion('inicio')}
      />
    )
  }
  if (accion === 'dispositivo') {
    return (
      // Al volver, la tarjeta dice "Activo en este dispositivo.": no hace
      // falta otro aviso que repita lo mismo (regla 22).
      <FlujoActivarDispositivo
        metodoActual={metodo}
        reemplazo={Boolean(config.desbloqueoDispositivo)}
        onListo={() => setAccion('inicio')}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2 rounded-lg border border-noct-divider bg-noct-surface p-4">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-medium text-noct-exito">
            <LockSimple size={14} aria-hidden />
            Bloqueo activo
          </p>
          <p className="mt-0.5 text-[12.5px] text-noct-neutral-500">
            Método: {metodo === 'patron' ? 'patrón' : 'contraseña'}
          </p>
        </div>
        <button type="button" onClick={bloquearApp} className={`shrink-0 ${BTN_SECUNDARIO}`}>
          Bloquear ahora
        </button>
      </div>

      <SeccionDispositivo config={config} onActivar={() => setAccion('dispositivo')} />

      <label className="flex items-center justify-between gap-2 rounded-lg border border-noct-divider bg-noct-surface px-4 py-3 text-sm text-noct-neutral-300">
        Autobloqueo por inactividad
        <select
          value={minutosSel}
          onChange={(e) => cambiarMinutos(Number(e.target.value))}
          className="rounded-md border border-noct-divider bg-noct-bg px-3 py-2 text-sm text-noct-text outline-none focus:border-noct-accent"
        >
          {OPCIONES_AUTOBLOQUEO_APP_MIN.map((m) => (
            <option key={m} value={m}>
              {m} min
            </option>
          ))}
        </select>
      </label>

      <div className="flex gap-2">
        <button type="button" onClick={() => setAccion('cambiar')} className={`flex-1 justify-center ${BTN_SECUNDARIO}`}>
          Cambiar
        </button>
        <button
          type="button"
          onClick={() => setAccion('quitar')}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-noct-error/45 px-2.5 py-[7px] text-[13px] font-medium text-noct-error hover:bg-noct-error/10"
        >
          Quitar bloqueo
        </button>
      </div>
    </div>
  )
}

function FlujoCambiar({ metodoActual, onListo }: { metodoActual: MetodoBloqueoApp; onListo: () => void }) {
  const [actual, setActual] = useState<string | null>(null)
  const [metodoNuevo, setMetodoNuevo] = useState<MetodoBloqueoApp | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [procesando, setProcesando] = useState(false)

  async function aplicar(secretoNuevo: string) {
    setProcesando(true)
    const mensaje = await cambiarBloqueoApp(actual!, metodoNuevo!, secretoNuevo)
    setProcesando(false)
    if (mensaje) {
      setError(mensaje)
      return
    }
    onListo()
  }

  return (
    <div className="flex flex-col gap-4">
      <button type="button" onClick={onListo} className={`${BTN_GHOST} self-start`}>
        Cancelar
      </button>
      <h2 className="text-sm font-medium text-noct-text">Cambiar el bloqueo</h2>

      {actual === null ? (
        <EntradaSecreto
          metodo={metodoActual}
          etiqueta={metodoActual === 'patron' ? 'Dibuja tu patrón actual' : 'Escribe tu contraseña actual'}
          onCompletar={(s) => {
            setError(null)
            setActual(s)
          }}
        />
      ) : !metodoNuevo ? (
        <div className="flex flex-col gap-3">
          <p className="text-[13px] text-noct-neutral-300">Elige el método nuevo</p>
          <SelectorMetodo onElegir={setMetodoNuevo} />
        </div>
      ) : (
        <CrearSecreto metodo={metodoNuevo} onCreado={aplicar} error={error} onError={setError} procesando={procesando} />
      )}

      {error && actual === null && <p className="text-[12.5px] text-noct-error">{error}</p>}
    </div>
  )
}

function FlujoQuitar({
  metodoActual,
  conDispositivo,
  onListo,
}: {
  metodoActual: MetodoBloqueoApp
  conDispositivo: boolean
  onListo: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [procesando, setProcesando] = useState(false)

  async function quitar(secreto: string) {
    setProcesando(true)
    const mensaje = await quitarBloqueoApp(secreto)
    setProcesando(false)
    if (mensaje) {
      setError(mensaje)
      return
    }
    onListo()
  }

  return (
    <div className="flex flex-col gap-4">
      <button type="button" onClick={onListo} className={`${BTN_GHOST} self-start`}>
        Cancelar
      </button>
      <h2 className="text-sm font-medium text-noct-text">Quitar el bloqueo</h2>
      <p className="text-[12.5px] text-noct-neutral-500">
        Confirma con tu {metodoActual === 'patron' ? 'patrón' : 'contraseña'} actual. La app dejará
        de pedir desbloqueo en este dispositivo.
        {conDispositivo && ' También se desactiva el desbloqueo del dispositivo.'}
      </p>
      <EntradaSecreto
        metodo={metodoActual}
        etiqueta={metodoActual === 'patron' ? 'Dibuja tu patrón' : 'Escribe tu contraseña'}
        onCompletar={quitar}
        deshabilitado={procesando}
      />
      {error && <p className="text-[12.5px] text-noct-error">{error}</p>}
    </div>
  )
}

// ----------------------------------------------------------------
// Piezas reutilizables
// ----------------------------------------------------------------

// A 44 px de alto (regla R6): la validación de la 260 los midió en 32
// (tarea 285, que dejó estos dos para esta pantalla).
function SelectorMetodo({ onElegir }: { onElegir: (metodo: MetodoBloqueoApp) => void }) {
  return (
    <div className="flex gap-2">
      <button type="button" onClick={() => onElegir('patron')} className={`min-h-11 flex-1 justify-center ${BTN_SECUNDARIO}`}>
        Patrón
      </button>
      <button
        type="button"
        onClick={() => onElegir('contrasena')}
        className={`min-h-11 flex-1 justify-center ${BTN_SECUNDARIO}`}
      >
        Contraseña
      </button>
    </div>
  )
}

// ----------------------------------------------------------------
// Desbloqueo del dispositivo (tarea 278)
// ----------------------------------------------------------------

const EXPLICACION_DISPOSITIVO =
  'Usa la huella, rostro, Windows Hello o código seguro disponible en este dispositivo. La verificación la hace el dispositivo: Soluciones IT no recibe datos biométricos.'

function nombreRespaldo(metodo: MetodoBloqueoApp): string {
  return metodo === 'patron' ? 'patrón' : 'contraseña'
}

// Estado y acciones de la vía rápida. Sin términos técnicos: ni
// credencial, ni clave pública, ni algoritmo. Si el navegador no lo
// permite, se dice en una línea y no se ofrece nada.
function SeccionDispositivo({ config, onActivar }: { config: ConfigBloqueoApp; onActivar: () => void }) {
  const disponible = useDesbloqueoDispositivoDisponible()
  const activo = Boolean(config.desbloqueoDispositivo)
  const [probando, setProbando] = useState(false)
  const [prueba, setPrueba] = useState<'ok' | 'fallo' | null>(null)

  async function probar() {
    setPrueba(null)
    setProbando(true)
    const resultado = await probarDesbloqueoDispositivo()
    setProbando(false)
    setPrueba(resultado === 'ok' ? 'ok' : 'fallo')
  }

  if (disponible === null) return null

  const estado = !disponible
    ? 'No disponible en este dispositivo.'
    : activo
      ? 'Activo en este dispositivo.'
      : 'Desactivado.'

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-noct-divider bg-noct-surface p-4">
      <div>
        <p className="text-sm font-medium text-noct-text">Desbloqueo del dispositivo</p>
        <p className="mt-0.5 text-[12.5px] text-noct-neutral-500">{estado}</p>
      </div>
      {disponible && !activo && (
        <p className="text-[12.5px] leading-relaxed text-noct-neutral-400">
          {EXPLICACION_DISPOSITIVO} Tu {nombreRespaldo(config.metodo)} sigue sirviendo.
        </p>
      )}
      {prueba === 'ok' && <p className="text-[12.5px] text-noct-exito">Funciona en este dispositivo.</p>}
      {prueba === 'fallo' && (
        <p className="text-[12.5px] text-noct-neutral-300">
          {MENSAJE_DISPOSITIVO_NO_SE_PUDO} Si borraste la huella o los datos del navegador, regístralo de nuevo.
        </p>
      )}

      {disponible && !activo && (
        <button type="button" onClick={onActivar} className={`min-h-11 justify-center ${BTN_SECUNDARIO}`}>
          Activar
        </button>
      )}
      {activo && (
        <div className="flex flex-wrap gap-2">
          {disponible && (
            <button
              type="button"
              onClick={() => void probar()}
              disabled={probando}
              className={`min-h-11 flex-1 justify-center ${BTN_SECUNDARIO} disabled:opacity-50`}
            >
              {probando ? 'Esperando al dispositivo...' : 'Probar'}
            </button>
          )}
          {disponible && prueba === 'fallo' && (
            <button type="button" onClick={onActivar} className={`min-h-11 flex-1 justify-center ${BTN_SECUNDARIO}`}>
              Registrar de nuevo
            </button>
          )}
          <button
            type="button"
            onClick={() => void desactivarDesbloqueoDispositivo()}
            className={`min-h-11 flex-1 justify-center ${BTN_GHOST}`}
          >
            Desactivar
          </button>
        </div>
      )}
    </div>
  )
}

type PasoDispositivo = 'confirmar' | 'crear' | 'comprobar'

// Activar (o registrar de nuevo) en tres pasos, cada uno con su toque:
// 1. confirmar el patrón o la contraseña actual (quien encuentre la app
//    abierta no puede registrar su propia huella);
// 2. "Activar en este dispositivo": el sistema crea la credencial;
// 3. "Comprobar": el sistema la usa una vez y la app verifica la firma.
// Solo tras el paso 3 se guarda. Cancelar en cualquier punto deja todo
// como estaba.
function FlujoActivarDispositivo({
  metodoActual,
  reemplazo,
  onListo,
}: {
  metodoActual: MetodoBloqueoApp
  reemplazo: boolean
  onListo: () => void
}) {
  const [paso, setPaso] = useState<PasoDispositivo>('confirmar')
  const [pendiente, setPendiente] = useState<CredencialRegistrada | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [procesando, setProcesando] = useState(false)
  const [reinicio, setReinicio] = useState(0)
  const pendienteRef = useRef<CredencialRegistrada | null>(null)
  const respaldo = nombreRespaldo(metodoActual)
  const noSePudo = `No se pudo activar el desbloqueo del dispositivo. Tu ${respaldo} sigue igual.`
  const confirmaDeNuevo = `Vuelve a confirmar tu ${respaldo}.`

  function fijarPendiente(valor: CredencialRegistrada | null) {
    pendienteRef.current = valor
    setPendiente(valor)
  }

  // Una credencial creada que no se llegó a guardar (se salió a la mitad).
  useEffect(
    () => () => {
      if (pendienteRef.current) descartarDesbloqueoPendiente(pendienteRef.current)
    },
    [],
  )

  async function confirmar(secreto: string) {
    setProcesando(true)
    const mensaje = await confirmarBloqueoActual(secreto)
    setProcesando(false)
    if (mensaje) {
      setError(mensaje)
      setReinicio((n) => n + 1)
      return
    }
    setError(null)
    setPaso('crear')
  }

  async function crear() {
    setError(null)
    setProcesando(true)
    const resultado = await crearDesbloqueoDispositivo()
    setProcesando(false)
    if (resultado.ok) {
      fijarPendiente(resultado.pendiente)
      setPaso('comprobar')
      return
    }
    if (resultado.motivo === 'sin-confirmar') {
      setError(confirmaDeNuevo)
      setPaso('confirmar')
      return
    }
    setError(noSePudo)
  }

  async function comprobar() {
    if (!pendiente) return
    setError(null)
    setProcesando(true)
    const resultado = await completarDesbloqueoDispositivo(pendiente)
    setProcesando(false)
    if (resultado === 'ok') {
      pendienteRef.current = null
      onListo()
      return
    }
    if (resultado === 'sin-confirmar') {
      descartarDesbloqueoPendiente(pendiente)
      fijarPendiente(null)
      setError(confirmaDeNuevo)
      setPaso('confirmar')
      return
    }
    setError(noSePudo)
  }

  return (
    <div className="flex flex-col gap-4">
      <button type="button" onClick={onListo} className={`${BTN_GHOST} self-start`}>
        Cancelar
      </button>
      <h2 className="text-sm font-medium text-noct-text">
        {reemplazo ? 'Registrar de nuevo el desbloqueo del dispositivo' : 'Activar el desbloqueo del dispositivo'}
      </h2>

      {paso === 'confirmar' ? (
        <EntradaSecreto
          metodo={metodoActual}
          etiqueta={metodoActual === 'patron' ? 'Dibuja tu patrón actual' : 'Escribe tu contraseña actual'}
          onCompletar={(s) => void confirmar(s)}
          deshabilitado={procesando}
          reinicio={reinicio}
        />
      ) : paso === 'crear' ? (
        <div className="flex flex-col gap-3">
          <p className="text-[12.5px] leading-relaxed text-noct-neutral-400">{EXPLICACION_DISPOSITIVO}</p>
          <button
            type="button"
            onClick={() => void crear()}
            disabled={procesando}
            className={`${BTN_PRIMARIO} min-h-11 justify-center disabled:opacity-50`}
          >
            {procesando ? 'Esperando al dispositivo...' : 'Activar en este dispositivo'}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-[12.5px] leading-relaxed text-noct-neutral-400">
            Último paso: comprueba que funciona. El dispositivo te lo pedirá una vez más.
          </p>
          <button
            type="button"
            onClick={() => void comprobar()}
            disabled={procesando}
            className={`${BTN_PRIMARIO} min-h-11 justify-center disabled:opacity-50`}
          >
            {procesando ? 'Esperando al dispositivo...' : 'Comprobar'}
          </button>
        </div>
      )}

      {error && <p className="text-[12.5px] text-noct-error">{error}</p>}
    </div>
  )
}

// Captura UN secreto (un solo patron o una sola contrasena) y lo
// entrega al completar. Para el patron se dibuja; para la contrasena
// hay un campo con boton.
function EntradaSecreto({
  metodo,
  etiqueta,
  textoBoton = 'Continuar',
  onCompletar,
  deshabilitado,
  reinicio,
}: {
  metodo: MetodoBloqueoApp
  etiqueta: string
  textoBoton?: string
  onCompletar: (secreto: string) => void
  deshabilitado?: boolean
  reinicio?: number
}) {
  const [contrasena, setContrasena] = useState('')

  if (metodo === 'patron') {
    return (
      <div className="flex flex-col items-center gap-2">
        <p className="text-[12.5px] text-noct-neutral-500">{etiqueta}</p>
        <PatronInput
          onCompletar={(s) => onCompletar(serializarPatron(s))}
          deshabilitado={deshabilitado}
          reiniciarToken={reinicio}
        />
      </div>
    )
  }

  function enviar(evento: FormEvent) {
    evento.preventDefault()
    onCompletar(contrasena)
    setContrasena('')
  }

  return (
    <form onSubmit={enviar} className="flex w-full max-w-xs flex-col gap-2 self-center">
      <p className="text-center text-[12.5px] text-noct-neutral-500">{etiqueta}</p>
      <CampoContrasena
        required
        value={contrasena}
        onChange={(e) => setContrasena(e.target.value)}
        placeholder="Contraseña"
        className={`min-h-11 ${CLASE_CAMPO}`}
      />
      <button type="submit" disabled={deshabilitado} className={`${BTN_PRIMARIO} min-h-11 justify-center disabled:opacity-50`}>
        {textoBoton}
      </button>
    </form>
  )
}

// Captura un secreto NUEVO con confirmacion (dos veces) y lo entrega
// si ambas coinciden y pasan la validacion de longitud/puntos.
function CrearSecreto({
  metodo,
  onCreado,
  error,
  onError,
  procesando,
}: {
  metodo: MetodoBloqueoApp
  onCreado: (secreto: string) => void
  error: string | null
  onError: (mensaje: string | null) => void
  procesando?: boolean
}) {
  const [primero, setPrimero] = useState<string | null>(null)
  const [reinicio, setReinicio] = useState(0)

  function paso1(secreto: string) {
    const invalido = validarSecreto(metodo, secreto)
    if (invalido) {
      onError(invalido)
      setReinicio((n) => n + 1)
      return
    }
    onError(null)
    setPrimero(secreto)
    setReinicio((n) => n + 1)
  }

  function paso2(secreto: string) {
    if (secreto !== primero) {
      onError(metodo === 'patron' ? 'Los patrones no coinciden.' : 'Las contraseñas no coinciden.')
      setPrimero(null)
      setReinicio((n) => n + 1)
      return
    }
    onError(null)
    onCreado(secreto)
  }

  const enConfirmacion = primero !== null
  const etiqueta = enConfirmacion
    ? metodo === 'patron'
      ? 'Vuelve a dibujar el patrón para confirmar'
      : 'Repite la contraseña para confirmar'
    : metodo === 'patron'
      ? 'Dibuja el patrón nuevo (une al menos 4 puntos)'
      : 'Escribe la contraseña nueva (mínimo 4 caracteres)'

  return (
    <div className="flex flex-col items-center gap-3">
      <EntradaSecreto
        metodo={metodo}
        etiqueta={etiqueta}
        textoBoton={enConfirmacion ? 'Confirmar' : 'Continuar'}
        onCompletar={enConfirmacion ? paso2 : paso1}
        deshabilitado={procesando}
        reinicio={reinicio}
      />
      {error && <p className="text-[12.5px] text-noct-error">{error}</p>}
      {enConfirmacion && (
        <button
          type="button"
          onClick={() => {
            setPrimero(null)
            onError(null)
            setReinicio((n) => n + 1)
          }}
          className={BTN_GHOST}
        >
          Empezar de nuevo
        </button>
      )}
    </div>
  )
}
