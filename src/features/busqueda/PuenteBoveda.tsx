import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { CampoContrasena } from '../../components/CampoContrasena'
import { Key, LockSimple } from '../../components/iconos'
import { BTN_PRIMARIO } from '../../components/nocturne'
import { usePerfilVivo } from '../autenticacion/usePerfilVivo'
import { desbloquear, estadoInicialBoveda, type EstadoInicialBoveda } from '../boveda/sesionBoveda'
import { useBovedaDesbloqueada } from '../boveda/useSesionBoveda'
import { debeOfrecerPuenteBoveda, etiquetaPuenteBoveda } from './reglasPuenteBoveda'

// EL PUENTE HACIA LA BOVEDA BLOQUEADA (encargo del 2026-09-15, tarea
// 241, secciones 5, 6, 10 y 19).
//
// El problema: con la boveda bloqueada, sus credenciales NO entran al
// indice (y eso no cambia, es la garantia de la seccion 19). El efecto
// secundario era que buscar "administrador POS" devolvia "sin
// coincidencias" y el tecnico tenia que acordarse por su cuenta de que
// eso vive en la Boveda, ir a Mas, entrar, escribir la contrasena
// maestra y VOLVER A ESCRIBIR lo mismo.
//
// Lo que esta fila hace, y lo que NO hace:
//
//   - Es GENERICA. Ofrece buscar el texto que se escribio dentro de la
//     boveda; NO dice, ni insinua, que exista una credencial con ese
//     nombre. Aparece igual escribiendo "administrador POS" que
//     escribiendo "xyz": si confirmara la existencia seria una filtracion
//     por sugerencia, que es justo lo que la seccion 19 prohibe.
//   - NO desbloquea sola nada, NO guarda la consulta en ningun sitio y
//     NO toca la criptografia: el desbloqueo es `desbloquear()`, la
//     UNICA fuente de verdad de la sesion de la boveda, la misma que usa
//     `BovedaGuard` y la misma que ya usaba el bloque protegido de un
//     paso de guia.
//
// POR QUE EL DESBLOQUEO ES EN LINEA Y NO UN VIAJE A /boveda. Porque el
// mismo puente tiene que funcionar DENTRO de una guia en ejecucion
// (seccion 10: "NO saques al tecnico de la guia"), y salir a la seccion
// Boveda desmontaria el modo ejecucion con su cronometro y su paso
// activo. Al resolverlo aqui, la consulta ni siquiera viaja: sigue
// escrita en el campo, asi que "conservar la consulta" (seccion 6) deja
// de necesitar estado de navegacion, parametro de URL o sesion. Un dato
// que no se guarda no se puede filtrar.
//
// Al desbloquear, el indice se reconstruye solo (`useIndiceBusqueda`
// depende de `useBovedaDesbloqueada`) y los resultados protegidos
// aparecen en la MISMA busqueda, con sus acciones rapidas.

export function PuenteBoveda({
  consulta,
  onDesbloqueada,
}: {
  /** Lo que el tecnico escribio, tal cual, para poder citarlo. */
  consulta: string
  /** La boveda acaba de abrirse desde aqui (para contar el recorrido). */
  onDesbloqueada?: () => void
}) {
  const perfil = usePerfilVivo()
  const desbloqueada = useBovedaDesbloqueada()
  const [abierto, setAbierto] = useState(false)

  // La regla vive aparte, en `puenteBoveda.ts`, con sus pruebas: de ella
  // depende que quien no tiene permiso no llegue a saber siquiera que
  // existe una seccion protegida con contenido buscable.
  const ofrecer = debeOfrecerPuenteBoveda({
    puedeVerBoveda: Boolean(perfil?.puedeVerBoveda),
    desbloqueada,
    consulta,
  })
  if (!ofrecer) return null

  return (
    <section className="rounded-lg border border-dashed border-noct-neutral-700 px-3 py-3">
      <div className="flex items-start gap-3">
        <span className="mt-px flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded bg-noct-neutral-400/[.12] text-noct-neutral-300">
          <LockSimple size={17} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-[1.3] [overflow-wrap:anywhere] [text-wrap:pretty]">
            {etiquetaPuenteBoveda(consulta)}
          </p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-noct-neutral-500">
            La bóveda está bloqueada: sus accesos no aparecen en esta búsqueda.
          </p>
        </div>
      </div>

      {!abierto ? (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="mt-2 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-[9px] border border-noct-accent bg-noct-accent/10 px-3 text-[13.5px] font-medium text-noct-accent-300 hover:bg-noct-accent/[.22] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-noct-accent"
        >
          <Key size={16} className="shrink-0" aria-hidden />
          Desbloquear y buscar
        </button>
      ) : (
        <FormularioDesbloqueo onCerrar={() => setAbierto(false)} onDesbloqueada={onDesbloqueada} />
      )}
    </section>
  )
}

const CAMPO =
  'min-w-0 flex-1 rounded-lg border border-noct-divider bg-noct-bg px-3 py-2 text-[15px] text-noct-text caret-noct-accent outline-none placeholder:text-noct-neutral-600 focus:border-noct-accent'

/**
 * El formulario de la contrasena maestra, en linea. No implementa nada
 * de seguridad: delega entero en `desbloquear()`, igual que la pantalla
 * de la seccion Boveda y que el bloque protegido de un paso.
 *
 * Lo unico propio es la guarda de "primera vez": DEFINIR la contrasena
 * maestra del equipo es una decision que se toma en la Boveda, con su
 * confirmacion y su aviso, no desde una fila de resultados de busqueda.
 */
function FormularioDesbloqueo({
  onCerrar,
  onDesbloqueada,
}: {
  onCerrar: () => void
  onDesbloqueada?: () => void
}) {
  const [modo, setModo] = useState<'cargando' | EstadoInicialBoveda>('cargando')
  const [contrasena, setContrasena] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [abriendo, setAbriendo] = useState(false)

  useEffect(() => {
    let vigente = true
    void estadoInicialBoveda().then((estado) => {
      if (vigente) setModo(estado)
    })
    return () => {
      vigente = false
    }
  }, [])

  async function manejarEnvio(evento: FormEvent) {
    evento.preventDefault()
    setError(null)
    setAbriendo(true)
    const resultado = await desbloquear(contrasena)
    setAbriendo(false)
    // La contrasena no se conserva ni un render de mas.
    setContrasena('')
    if (resultado) {
      setError(resultado)
      return
    }
    onDesbloqueada?.()
  }

  if (modo === 'cargando') {
    return <p className="mt-2 text-[12.5px] text-noct-neutral-400">Comprobando...</p>
  }

  if (modo !== 'verificar') {
    return (
      <div className="mt-2 flex flex-col gap-2">
        <p className="text-[12.5px] leading-relaxed text-noct-neutral-400">
          {modo === 'crear'
            ? 'La bóveda todavía no tiene contraseña maestra. Se define una sola vez, desde la sección Bóveda.'
            : 'No se pudo comprobar la contraseña maestra del equipo. Conéctate a internet, espera a que la aplicación sincronice y vuelve a intentarlo.'}
        </p>
        <Link
          to="/boveda"
          className="flex min-h-11 items-center justify-center rounded-[9px] border border-noct-divider px-3 text-[13.5px] font-medium text-noct-text hover:bg-noct-text/[.07]"
        >
          Ir a Bóveda
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={manejarEnvio} className="mt-2 flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <CampoContrasena
          required
          autoFocus
          value={contrasena}
          onChange={(e) => {
            setContrasena(e.target.value)
            setError(null)
          }}
          placeholder="Contraseña maestra"
          className={CAMPO}
        />
        <button
          type="submit"
          disabled={abriendo}
          className={`${BTN_PRIMARIO} min-h-11 shrink-0 px-3 disabled:opacity-50`}
        >
          <Key size={15} aria-hidden />
          {abriendo ? 'Abriendo...' : 'Desbloquear'}
        </button>
      </div>
      {error && <p className="text-[12.5px] text-noct-error">{error}</p>}
      <button
        type="button"
        onClick={onCerrar}
        className="min-h-11 self-start px-1 text-[12.5px] font-medium text-noct-neutral-400 hover:text-noct-text"
      >
        Cancelar
      </button>
    </form>
  )
}
