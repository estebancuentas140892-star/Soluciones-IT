import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { estadoInicialBoveda, verificarContrasenaMaestra } from '../features/boveda/sesionBoveda'
import { CampoContrasena } from './CampoContrasena'
import { CLASE_CAMPO_SOBRE_SUPERFICIE, CLASE_ETIQUETA } from './campos'
import { Modal } from './Modal'
import { BTN_PRIMARIO_PELIGRO, BTN_SECUNDARIO } from './nocturne'

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
  textoConfirmar?: string
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

// Dialogo moderno para confirmar una eliminacion. En las acciones
// sensibles agrega una capa de seguridad: pide la contrasena maestra
// (la misma de la boveda) y solo elimina si es correcta. Cualquier
// tecnico autenticado puede autorizarla (decision del 2026-07-17: ya
// no se exige el permiso puede_ver_boveda, que ademas bloqueaba al
// resto del equipo); ver credenciales de la boveda sigue exigiendo el
// permiso, eso no cambia. Si el equipo aun no definio la contrasena
// maestra, se cae a confirmacion normal (no se puede exigir algo que
// no existe).
export function DialogoEliminar({
  abierto,
  titulo,
  descripcion,
  sensible = false,
  advertencia,
  textoConfirmar = 'Eliminar',
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
    setError(null)

    if (modo === 'contrasena') {
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

  const tituloId = 'dialogo-eliminar-titulo'

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} tituloId={tituloId}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <h2 id={tituloId} className="text-base font-semibold text-noct-text">
            {titulo}
          </h2>
          <p className="text-sm text-noct-neutral-400">{descripcion}</p>
        </div>

        {advertencia && (
          <div className="rounded-lg border border-noct-precaucion/35 bg-noct-precaucion/[.09] px-3 py-2 text-sm text-noct-precaucion">
            {advertencia}
          </div>
        )}

        {modo === 'cargando' && <p className="text-sm text-noct-neutral-500">Comprobando...</p>}

        {modo === 'sin-comprobar' && (
          <p className="rounded-lg border border-noct-precaucion/35 bg-noct-precaucion/[.09] px-3 py-2 text-sm text-noct-precaucion">
            No se pudo comprobar la contraseña maestra del equipo. Conéctate a internet, espera a
            que la aplicación sincronice y vuelve a intentarlo.
          </p>
        )}

        {modo === 'contrasena' && (
          <form onSubmit={confirmar} className="flex flex-col gap-2">
            <label htmlFor="contrasena-eliminar" className={CLASE_ETIQUETA}>
              Para continuar, ingresa la contraseña maestra.
            </label>
            <CampoContrasena
              id="contrasena-eliminar"
              autoFocus
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
              placeholder="Contraseña maestra"
              className={CLASE_CAMPO_SOBRE_SUPERFICIE}
            />
          </form>
        )}

        {error && <p className="text-sm text-noct-error">{error}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCerrar} className={BTN_SECUNDARIO}>
            {modo === 'sin-comprobar' ? 'Cerrar' : 'Cancelar'}
          </button>
          {modo !== 'sin-comprobar' && modo !== 'cargando' && (
            <button
              type="button"
              onClick={() => void confirmar()}
              disabled={ocupado || (modo === 'contrasena' && contrasena === '')}
              className={`${BTN_PRIMARIO_PELIGRO} disabled:opacity-50`}
            >
              {ocupado ? 'Eliminando...' : textoConfirmar}
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}
