import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Modal } from '../../components/Modal'
import { CampoContrasena } from '../../components/CampoContrasena'
import { ArrowsClockwise, Eye, EyeSlash, Key, LockSimple, X } from '../../components/iconos'
import { BTN_ICONO_SECUNDARIO, BTN_PRIMARIO, BTN_SECUNDARIO } from '../../components/nocturne'
import { Campo, CampoConSugerencias, CLASE_CAMPO, CLASE_CAMPO_MONO, CLASE_ETIQUETA } from '../../components/campos'
import { db } from '../../lib/db'
import { generarContrasena } from '../../lib/generarContrasena'
import { guardarRegistro, nuevoId } from '../../lib/repositorio'
import { valoresUnicos } from '../../lib/vocabulario'
import { cifrarCredencial, desbloquear } from './sesionBoveda'
import { useBovedaDesbloqueada } from './useSesionBoveda'

// Crear un acceso SIN salir del editor de la guía (encargo del
// 2026-09-10, tarea 6).
//
// El caso real: mientras se escribe "entra al panel del router", la
// clave todavía no está en la Bóveda. Hasta ahora había que abrir
// /boveda/nueva en otra pantalla, con el editor a medias y sin guardar,
// crear el acceso, volver, buscar la tarea y recién ahí vincularlo.
//
// Aquí se abre una hoja encima del editor: el editor no se desmonta, la
// guía no pierde nada, el paso activo y el desplazamiento siguen donde
// estaban. Al guardar, quien llamó recibe {id, titulo} y hace el
// vínculo con LA tarea que abrió el selector, ninguna otra. Si se
// cancela no se crea ningún registro.
//
// Es un formulario corto a propósito (nombre, usuario opcional, clave,
// categoría, notas): lo demás —URL, vencimiento, equipos, otros datos
// protegidos— se completa luego desde la ficha del acceso, con el
// editor completo. El tipo interno se deduce de lo escrito: 'cuenta'
// cuando hay usuario, 'red' cuando solo se guarda una clave.
//
// La sesión de la bóveda es la misma de toda la app: si está bloqueada
// se desbloquea aquí dentro (mismo formulario en línea que
// CredencialEnPaso), sin salir del editor, y el autobloqueo por
// inactividad sigue aplicando igual.

const ID_TITULO = 'crear-acceso-rapido-titulo'

interface Props {
  abierto: boolean
  onCerrar: () => void
  /** Nombre sugerido (lo que la tarea ya nombra), editable. */
  tituloInicial?: string
  /** Se llama solo cuando la credencial ya quedó guardada y cifrada. */
  onCreada: (credencial: { id: string; titulo: string }) => void
}

export function CrearAccesoRapido({ abierto, onCerrar, tituloInicial = '', onCreada }: Props) {
  const desbloqueada = useBovedaDesbloqueada()
  const credenciales = useLiveQuery(() => db.credenciales.filter((c) => !c.eliminadoEn).toArray(), [], [])
  const categorias = useMemo(
    () => valoresUnicos((credenciales ?? []).map((c) => c.categoria)),
    [credenciales],
  )

  const [titulo, setTitulo] = useState(tituloInicial)
  const [usuario, setUsuario] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [verContrasena, setVerContrasena] = useState(false)
  const [categoria, setCategoria] = useState('')
  const [notas, setNotas] = useState('')
  const [intentoGuardar, setIntentoGuardar] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Cada apertura empieza en blanco: arrastrar lo escrito en una tarea
  // anterior acabaría vinculando el acceso equivocado.
  useEffect(() => {
    if (!abierto) return
    setTitulo(tituloInicial)
    setUsuario('')
    setContrasena('')
    setVerContrasena(false)
    setCategoria('')
    setNotas('')
    setIntentoGuardar(false)
    setGuardando(false)
    setError(null)
  }, [abierto, tituloInicial])

  // Mismo mínimo que exige la Bóveda: un acceso sin clave no sirve para
  // nada (ver validacionAcceso.ts).
  const faltaTitulo = titulo.trim() === ''
  const faltaClave = contrasena.trim() === ''
  const valido = !faltaTitulo && !faltaClave

  async function manejarEnvio(evento: FormEvent) {
    evento.preventDefault()
    if (!valido) {
      setIntentoGuardar(true)
      return
    }
    setGuardando(true)
    setError(null)
    const id = nuevoId()
    const tituloFinal = titulo.trim()
    try {
      const datosCifrados = await cifrarCredencial({
        usuario: usuario.trim(),
        contrasena,
        ip: '',
        url: '',
        notas: notas.trim(),
        extras: {},
      })
      await guardarRegistro('credenciales', {
        id,
        titulo: tituloFinal,
        categoria: categoria.trim(),
        // Con usuario es un acceso de cuenta; sin él, una clave suelta.
        tipo: usuario.trim() ? 'cuenta' : 'red',
        datosCifrados,
        venceEn: null,
        dispositivos: [],
        archivo: null,
      })
    } catch {
      // Ocurre si el autobloqueo cerró la bóveda mientras se escribía.
      setError('La bóveda se bloqueó por inactividad. Desbloquéala de nuevo para guardar.')
      setGuardando(false)
      return
    }
    setGuardando(false)
    onCreada({ id, titulo: tituloFinal })
    onCerrar()
  }

  const aviso = error ?? (intentoGuardar && faltaTitulo ? 'Falta el nombre del acceso' : intentoGuardar && faltaClave ? 'Falta la contraseña o clave' : '')

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} tituloId={ID_TITULO}>
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span id={ID_TITULO} className="min-w-0 truncate text-[17px] font-medium leading-tight text-noct-text">
          Crear acceso y vincular
        </span>
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar sin crear nada"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-noct-text/[.08] text-noct-text hover:bg-noct-text/[.14]"
        >
          <X size={20} aria-hidden />
        </button>
      </div>

      {!desbloqueada ? (
        <DesbloqueoEnLinea />
      ) : (
        <form onSubmit={manejarEnvio} className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto px-0.5 pb-0.5">
          <p className="inline-flex items-center gap-1.5 text-[11.5px] text-noct-neutral-500">
            <LockSimple size={12} aria-hidden />
            Se guarda cifrada y queda vinculada a esta tarea
          </p>

          <label className="flex flex-col gap-1.5">
            <span className={CLASE_ETIQUETA}>
              Nombre del acceso <span className="text-noct-accent-300">*</span>
            </span>
            <input
              type="text"
              autoFocus
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Panel del router, correo de soporte..."
              className={`min-h-11 ${CLASE_CAMPO} ${intentoGuardar && faltaTitulo ? 'border-noct-error' : ''}`}
            />
            {intentoGuardar && faltaTitulo && (
              <span className="text-[12px] text-noct-error">Falta el nombre del acceso</span>
            )}
          </label>

          <label className="flex flex-col gap-1.5">
            <span className={CLASE_ETIQUETA}>Usuario (opcional)</span>
            <input
              type="text"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              autoComplete="off"
              className={`min-h-11 ${CLASE_CAMPO_MONO}`}
            />
          </label>

          <div className="flex flex-col gap-1.5">
            <span className={CLASE_ETIQUETA}>
              Contraseña o clave <span className="text-noct-accent-300">*</span>
            </span>
            <div className="flex gap-2">
              <CampoContrasena
                revelado={verContrasena}
                value={contrasena}
                onChange={(e) => setContrasena(e.target.value)}
                className={`min-h-11 flex-1 ${CLASE_CAMPO_MONO}`}
              />
              <button
                type="button"
                onClick={() => setVerContrasena((v) => !v)}
                aria-label={verContrasena ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className={`${BTN_ICONO_SECUNDARIO} min-h-11 min-w-11`}
              >
                {verContrasena ? <EyeSlash size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
              </button>
              <button
                type="button"
                onClick={() => {
                  setContrasena(generarContrasena())
                  setVerContrasena(true)
                }}
                className={`${BTN_SECUNDARIO} h-11 shrink-0 whitespace-nowrap`}
              >
                <ArrowsClockwise size={14} aria-hidden />
                Generar
              </button>
            </div>
            {intentoGuardar && faltaClave && (
              <span className="text-[12px] text-noct-error">Falta la contraseña o clave</span>
            )}
          </div>

          <Campo etiqueta="Categoría">
            <CampoConSugerencias
              valor={categoria}
              onChange={setCategoria}
              sugerencias={categorias}
              placeholder="Redes, Servidores, CCTV..."
              className="min-h-11"
            />
          </Campo>

          <label className="flex flex-col gap-1.5">
            <span className={CLASE_ETIQUETA}>Notas (opcional)</span>
            <textarea
              rows={2}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Cómo y cuándo se usa"
              className={`resize-y ${CLASE_CAMPO}`}
            />
          </label>

          <div className="flex items-center gap-2.5 pt-0.5">
            <span
              className={`min-w-0 flex-1 text-[12px] ${aviso ? 'text-noct-precaucion' : 'text-noct-neutral-500'}`}
            >
              {aviso || 'El resto de datos se completan luego desde su ficha'}
            </span>
            <button
              type="submit"
              disabled={guardando}
              className={`${BTN_PRIMARIO} min-h-[46px] shrink-0 px-4 disabled:opacity-50`}
              style={{ opacity: valido ? undefined : 0.55 }}
            >
              <LockSimple size={15} aria-hidden />
              {guardando ? 'Guardando...' : 'Crear y vincular'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}

// Desbloqueo dentro del propio flujo: es la misma sesión global, así
// que al abrirla aquí también queda abierta la sección Bóveda y el
// autobloqueo por inactividad se aplica igual. El editor de la guía
// sigue montado detrás, con sus cambios intactos.
function DesbloqueoEnLinea() {
  const [contrasena, setContrasena] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [abriendo, setAbriendo] = useState(false)

  async function manejarEnvio(evento: FormEvent) {
    evento.preventDefault()
    setError(null)
    setAbriendo(true)
    const resultado = await desbloquear(contrasena)
    setAbriendo(false)
    if (resultado) setError(resultado)
  }

  return (
    <form onSubmit={manejarEnvio} className="flex flex-col gap-2.5">
      <p className="text-[13px] leading-normal text-noct-neutral-400">
        La bóveda está bloqueada. Desbloquéala con la contraseña maestra para crear el acceso sin
        salir de la guía.
      </p>
      <div className="flex gap-2">
        <CampoContrasena
          required
          autoFocus
          value={contrasena}
          onChange={(e) => setContrasena(e.target.value)}
          placeholder="Contraseña maestra"
          className="min-w-0 flex-1 rounded-lg border border-noct-divider bg-noct-bg px-3 py-2 text-sm text-noct-text caret-noct-accent placeholder:text-noct-neutral-600"
        />
        <button type="submit" disabled={abriendo} className={`shrink-0 ${BTN_PRIMARIO} disabled:opacity-45`}>
          <Key size={14} aria-hidden />
          {abriendo ? 'Abriendo...' : 'Desbloquear'}
        </button>
      </div>
      {error && <p className="text-xs text-noct-error">{error}</p>}
    </form>
  )
}
