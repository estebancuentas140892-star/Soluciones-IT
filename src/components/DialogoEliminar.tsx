import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { estadoInicialBoveda, verificarContrasenaMaestra } from '../features/boveda/sesionBoveda'
import { CampoContrasena } from './CampoContrasena'
import { CLASE_ETIQUETA } from './campos'
import { Dialogo } from './Dialogo'
import { Warning } from './iconos'
import { MensajeError } from './MensajeError'

interface Props {
  abierto: boolean
  titulo: string
  descripcion: string
  // true para las eliminaciones sensibles (procedimientos, credenciales,
  // dispositivos): exigen la contrasena maestra antes de continuar.
  sensible?: boolean
  // Aviso de impacto (fase N1): qué otras entidades referencian a esta,
  // calculado por la página desde el grafo. Se muestra antes de confirmar
  // para que eliminar no rompa vínculos a ciegas. null u omitido: sin
  // referencias, no se muestra nada.
  advertencia?: ReactNode
  // El nombre completo de la acción, con su objeto: "Eliminar el equipo",
  // "Eliminar el acceso" (tarea 291, F2: "Eliminar" solo no decía qué
  // eliminaba).
  textoConfirmar: string
  onCerrar: () => void
  // Ejecuta la eliminacion. Suele navegar; si no, el padre cierra el
  // dialogo tras completarse.
  onConfirmar: () => void | Promise<void>
}

// - 'cargando': comprobando si el equipo tiene contrasena maestra.
// - 'simple': confirmacion normal, sin contrasena.
// - 'contrasena': pide y verifica la contrasena maestra.
// - 'sin-comprobar': hay dudas de si existe contrasena maestra (sin
//   verificador local y el servidor no respondio); por seguridad la
//   eliminacion sensible se niega hasta poder comprobar.
type Modo = 'cargando' | 'simple' | 'contrasena' | 'sin-comprobar'

// Confirmar una eliminacion. En las acciones sensibles agrega una capa de
// seguridad: pide la contrasena maestra (la misma de la boveda) y solo
// elimina si es correcta. Cualquier tecnico autenticado puede autorizarla
// (decision del 2026-07-17: ya no se exige el permiso puede_ver_boveda,
// que ademas bloqueaba al resto del equipo); ver credenciales de la boveda
// sigue exigiendo el permiso, eso no cambia. Si el equipo aun no definio
// la contrasena maestra, se cae a confirmacion normal (no se puede exigir
// algo que no existe).
//
// Desde la tarea 291 (auditoría UX, F2) se apoya en el `Dialogo` común: en
// el teléfono, la acción a todo el ancho con su nombre y "Cancelar"
// debajo, sobre el teclado si se escribe la contraseña maestra; en
// escritorio, centrado a 440 px. La contraseña maestra, el aviso de
// impacto y la negativa cuando no se puede comprobar se quedan igual.
export function DialogoEliminar({
  abierto,
  titulo,
  descripcion,
  sensible = false,
  advertencia,
  textoConfirmar,
  onCerrar,
  onConfirmar,
}: Props) {
  const [modo, setModo] = useState<Modo>('cargando')
  const [contrasena, setContrasena] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    if (!abierto) return
    setContrasena('')
    setError(null)
    setOcupado(false)

    if (!sensible) {
      setModo('simple')
      return
    }

    // Solo se exige la contrasena maestra si el equipo ya tiene una
    // definida ('verificar'). Si el servidor confirma que no existe
    // ('crear'), confirmacion normal. Si no se puede saber (sin
    // conexion y sin verificador local), la eliminacion se niega en
    // vez de asumir que no hay contrasena.
    setModo('cargando')
    let vigente = true
    void estadoInicialBoveda().then((estado) => {
      if (!vigente) return
      if (estado === 'verificar') setModo('contrasena')
      else if (estado === 'crear') setModo('simple')
      else setModo('sin-comprobar')
    })
    return () => {
      vigente = false
    }
  }, [abierto, sensible])

  async function confirmar(evento?: FormEvent) {
    evento?.preventDefault()
    if (ocupado) return
    setError(null)

    if (modo === 'contrasena') {
      if (contrasena === '') {
        setError('Escribe la contraseña maestra.')
        return
      }
      setOcupado(true)
      const resultado = await verificarContrasenaMaestra(contrasena)
      if (resultado !== 'correcta') {
        setOcupado(false)
        setError(
          resultado === 'incorrecta'
            ? 'Contraseña incorrecta.'
            : 'No se pudo comprobar la contraseña maestra. Conéctate a internet e inténtalo de nuevo.',
        )
        return
      }
    }

    setOcupado(true)
    await onConfirmar()
  }

  const puedeConfirmar = modo === 'simple' || modo === 'contrasena'

  return (
    <Dialogo
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={titulo}
      descripcion={descripcion}
      accion={
        puedeConfirmar
          ? {
              texto: textoConfirmar,
              onConfirmar: () => void confirmar(),
              cargando: ocupado,
              textoCargando: 'Eliminando…',
            }
          : undefined
      }
    >
      {advertencia && (
        <div className="flex items-start gap-2.5 rounded-lg border border-noct-precaucion/40 bg-noct-precaucion/[.08] px-3 py-2.5">
          <Warning size={16} className="mt-0.5 shrink-0 text-noct-precaucion" aria-hidden />
          <p className="text-pretty text-sm leading-[1.45] text-noct-text">{advertencia}</p>
        </div>
      )}

      {modo === 'cargando' && <p className="text-sm text-noct-neutral-400">Comprobando…</p>}

      {modo === 'sin-comprobar' && (
        <MensajeError
          tono="bloqueo"
          titulo="No se pudo comprobar la contraseña maestra"
          conserva="No se ha borrado nada. Conéctate a internet, espera a que la aplicación sincronice y vuelve a intentarlo."
        />
      )}

      {modo === 'contrasena' && (
        // Enter en el campo confirma, igual que el botón.
        <form onSubmit={(evento) => void confirmar(evento)} className="flex flex-col gap-1">
          <label htmlFor="contrasena-eliminar" className={CLASE_ETIQUETA}>
            Contraseña maestra
          </label>
          <CampoContrasena
            id="contrasena-eliminar"
            autoFocus
            value={contrasena}
            onChange={(e) => {
              setContrasena(e.target.value)
              setError(null)
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'contrasena-eliminar-error' : undefined}
            className={`box-border min-h-[46px] w-full rounded-lg border bg-noct-bg px-3 text-[15px] text-noct-text outline-none focus:border-noct-accent focus:ring-1 focus:ring-noct-accent ${
              error ? 'border-noct-error' : 'border-noct-divider'
            }`}
          />
          {error && (
            <p id="contrasena-eliminar-error" className="text-[13px] text-noct-error">
              {error}
            </p>
          )}
        </form>
      )}
    </Dialogo>
  )
}
