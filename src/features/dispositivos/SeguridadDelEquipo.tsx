import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { CampoContrasena } from '../../components/CampoContrasena'
import { DialogoEliminar } from '../../components/DialogoEliminar'
import {
  BookOpen,
  CaretDown,
  CaretRight,
  CaretUp,
  Key,
  LockSimple,
  PencilSimple,
  Plus,
  TrashSimple,
  X,
} from '../../components/iconos'
import { BTN_GHOST_ACENTO, BTN_GHOST_PELIGRO, BTN_PRIMARIO, BTN_SECUNDARIO, TituloSeccion } from '../../components/nocturne'
import { useGrafo } from '../../components/useGrafo'
import { db, type CampoProtegido, type TipoCampoProtegido } from '../../lib/db'
import { origenesDistintos, referenciasHacia, resumenImpacto } from '../../lib/grafo'
import { eliminarRegistro, guardarRegistro, nuevoId, registrarAccesoBoveda } from '../../lib/repositorio'
import { CampoSecreto } from '../boveda/CampoSecreto'
import { cifrarValor, desbloquear, descifrarValor } from '../boveda/sesionBoveda'
import { useBovedaDesbloqueada } from '../boveda/useSesionBoveda'
import { Historial } from '../historial/Historial'
import {
  camposDeDispositivo,
  esOcultoPorDefecto,
  etiquetaTipo,
  siguienteOrden,
  TIPOS_CAMPO_PROTEGIDO,
  validarNombre,
} from './camposProtegidos'

// Seccion "Seguridad" de la ficha del dispositivo (grupo P1): los datos
// sensibles PROPIOS del equipo (usuario administrador, contraseña, PIN
// de impresion). Antes esto obligaba a crear una credencial suelta en
// la boveda que ademas repetia la identidad del equipo (titulo,
// categoria, IP); ahora vive donde pertenece y no se duplica nada.
//
// Se edita desde la ficha, NO desde DispositivoForm, por dos razones:
// (1) coherencia, es el mismo patron que Adjuntos y ConexionesFicha,
// que tambien son tablas aparte con sus propias filas; (2) guardar un
// campo protegido exige la boveda desbloqueada, y meterlo en el
// formulario del equipo haria que no se pudiera guardar una ficha
// normal con la boveda cerrada.
//
// Proteccion: la tabla remota lleva la misma RLS que credenciales, asi
// que un tecnico sin permiso de boveda no descarga ni una fila y esta
// seccion no se le muestra siquiera (no se le insinua que exista algo
// protegido). Con permiso pero con la boveda bloqueada ve los NOMBRES
// de los datos, nunca los valores, y desbloquea aqui mismo.
export function SeguridadDelEquipo({
  dispositivoId,
  puedeVerBoveda,
  nombreSugerido,
}: {
  dispositivoId: string
  puedeVerBoveda: boolean
  // Nudge anti duplicidad de la Bóveda (fase P3): cuando llega no
  // vacío, abre el editor de "nuevo dato protegido" ya mismo con este
  // nombre precargado, en vez de esperar a que el técnico toque
  // "Agregar dato protegido" y lo escriba de nuevo.
  nombreSugerido?: string
}) {
  const desbloqueada = useBovedaDesbloqueada()
  const todos = useLiveQuery(() => db.campos_protegidos.toArray(), [], [] as CampoProtegido[])
  const campos = useMemo(() => camposDeDispositivo(todos, dispositivoId), [todos, dispositivoId])

  // Id del campo que se esta editando, 'nuevo' mientras se crea uno, o
  // null si el editor esta cerrado.
  const [editando, setEditando] = useState<string | 'nuevo' | null>(() => (nombreSugerido ? 'nuevo' : null))
  const [aEliminar, setAEliminar] = useState<CampoProtegido | null>(null)

  // Impacto antes de eliminar (grupo P2): que procedimientos vinculan
  // este campo y quedarian sin el, mismo patron que CredencialPage.
  const grafo = useGrafo()
  const impactoEliminar = aEliminar ? resumenImpacto(grafo, 'campo_protegido', aEliminar.id) : null

  if (!puedeVerBoveda) return null

  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-2">
        <TituloSeccion>Seguridad</TituloSeccion>
        <span className="inline-flex items-center gap-1.5 text-[11.5px] text-noct-neutral-500">
          <LockSimple size={12} aria-hidden />
          Cifrado en el dispositivo
        </span>
      </div>

      <div className="rounded-lg border border-dashed border-noct-neutral-700 bg-noct-surface/55 p-3">
        {campos.length === 0 && editando === null ? (
          <p className="px-0.5 py-1 text-[13px] leading-relaxed text-noct-neutral-500">
            Sin datos protegidos. Aquí van el usuario, la contraseña o el PIN de este equipo, en vez
            de crearlos como un secreto aparte en la Bóveda.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {campos.map((campo) =>
              editando === campo.id ? (
                <EditorCampo
                  key={campo.id}
                  dispositivoId={dispositivoId}
                  campo={campo}
                  camposDelEquipo={campos}
                  onCerrar={() => setEditando(null)}
                />
              ) : (
                <FilaCampoProtegido
                  key={campo.id}
                  campo={campo}
                  desbloqueada={desbloqueada}
                  onEditar={() => setEditando(campo.id)}
                  onEliminar={() => setAEliminar(campo)}
                />
              ),
            )}
          </div>
        )}

        {editando === 'nuevo' ? (
          <div className="mt-2">
            <EditorCampo
              dispositivoId={dispositivoId}
              campo={null}
              camposDelEquipo={campos}
              nombreInicial={nombreSugerido}
              onCerrar={() => setEditando(null)}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditando('nuevo')}
            className={`mt-2 ${BTN_GHOST_ACENTO}`}
          >
            <Plus size={13} aria-hidden />
            Agregar dato protegido
          </button>
        )}
      </div>

      <DialogoEliminar
        abierto={Boolean(aEliminar)}
        sensible
        titulo={`¿Eliminar "${aEliminar?.nombre ?? ''}"?`}
        descripcion="Se elimina este dato protegido del equipo para todo el equipo de trabajo."
        advertencia={impactoEliminar ? `${impactoEliminar} Esos pasos quedarán sin el dato vinculado.` : null}
        onCerrar={() => setAEliminar(null)}
        onConfirmar={async () => {
          if (!aEliminar) return
          await registrarAccesoBoveda({
            entidadTipo: 'campo_protegido',
            credencialId: aEliminar.id,
            credencialTitulo: aEliminar.nombre,
            accion: 'elimino',
          })
          await eliminarRegistro('campos_protegidos', aEliminar.id)
          setAEliminar(null)
        }}
      />
    </section>
  )
}

// Una fila de la lista: nombre y tipo siempre visibles (no son el
// secreto), el valor solo tras desplegar y con la boveda abierta.
function FilaCampoProtegido({
  campo,
  desbloqueada,
  onEditar,
  onEliminar,
}: {
  campo: CampoProtegido
  desbloqueada: boolean
  onEditar: () => void
  onEliminar: () => void
}) {
  const [abierto, setAbierto] = useState(false)
  // "Usado en" (grupo P2): procedimientos que vinculan este campo,
  // derivado del grafo (nunca se guarda). Mismo patron que "Usada en"
  // en la ficha de una credencial de la boveda.
  const grafo = useGrafo()
  const usadoEn = useMemo(
    () => origenesDistintos(referenciasHacia(grafo, 'campo_protegido', campo.id, ['campo_paso', 'campo_tarea'])),
    [grafo, campo.id],
  )

  return (
    <div className="rounded-md border border-noct-divider bg-noct-bg/40">
      <button
        type="button"
        onClick={() => {
          // La consulta se audita al ABRIR, no al montar la fila: ver
          // la lista de nombres no es consultar el secreto. El registro
          // va FUERA del actualizador de estado porque React puede
          // invocarlo dos veces (modo estricto) y quedaría auditado por
          // duplicado; es el mismo cuidado que documenta CredencialPage.
          if (!abierto && desbloqueada) {
            void registrarAccesoBoveda({
              entidadTipo: 'campo_protegido',
              credencialId: campo.id,
              credencialTitulo: campo.nombre,
              accion: 'consulto',
            })
          }
          setAbierto((v) => !v)
        }}
        aria-expanded={abierto}
        className="flex min-h-11 w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left"
      >
        <LockSimple size={15} className="shrink-0 text-noct-neutral-400" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-medium leading-tight">{campo.nombre}</span>
          <span className="mt-px block truncate text-[11.5px] text-noct-neutral-500">
            {etiquetaTipo(campo.tipo)}
          </span>
        </span>
        {abierto ? (
          <CaretUp size={14} className="shrink-0 text-noct-neutral-500" aria-hidden />
        ) : (
          <CaretDown size={14} className="shrink-0 text-noct-neutral-500" aria-hidden />
        )}
      </button>

      {abierto && (
        <div className="flex flex-col gap-2 border-t border-noct-divider p-3">
          {desbloqueada ? (
            <ValorDescifrado campo={campo} />
          ) : (
            <FormularioDesbloqueo />
          )}
          <div className="flex gap-1.5">
            <button type="button" onClick={onEditar} className={BTN_SECUNDARIO}>
              <PencilSimple size={13} aria-hidden />
              Editar
            </button>
            <button type="button" onClick={onEliminar} className={BTN_GHOST_PELIGRO}>
              <TrashSimple size={13} aria-hidden />
              Eliminar
            </button>
          </div>
          {usadoEn.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-noct-neutral-500">
                Usado en
              </span>
              {usadoEn.map((origen) => (
                <Link
                  key={`${origen.tipo}:${origen.id}`}
                  to={origen.ruta}
                  className="flex min-h-9 items-center gap-2 rounded-md px-1.5 text-[12.5px] text-noct-text hover:bg-noct-text/[.05]"
                >
                  <BookOpen size={14} className="shrink-0 text-noct-neutral-500" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{origen.titulo}</span>
                  <CaretRight size={13} className="shrink-0 text-noct-neutral-600" aria-hidden />
                </Link>
              ))}
              <p className="px-1.5 text-[11.5px] text-noct-neutral-600">
                Si se elimina este dato, esos pasos quedan sin él.
              </p>
            </div>
          )}

          {/* Historial POR CAMPO: cuelga de 'campo_protegido' + el id
              del campo, no del dispositivo. Es lo que permite que la
              RLS lo restrinja a quien tiene permiso de bóveda; colgarlo
              del equipo lo habría publicado en el "Ver historial"
              normal de la ficha, que ve todo el equipo. */}
          <Historial entidadTipo="campo_protegido" entidadId={campo.id} />
        </div>
      )}
    </div>
  )
}

// Descifra y muestra el valor. Reutiliza CampoSecreto (el mismo que usa
// la boveda), asi que el mostrar/ocultar y el copiar con auditoria se
// comportan igual en los dos lugares.
function ValorDescifrado({ campo }: { campo: CampoProtegido }) {
  // undefined: descifrando; null: no se pudo descifrar.
  const [valor, setValor] = useState<string | null | undefined>(undefined)
  const [revelado, setRevelado] = useState(false)

  useEffect(() => {
    let vigente = true
    setValor(undefined)
    void descifrarValor(campo.valorCifrado).then((descifrado) => {
      if (vigente) setValor(descifrado)
    })
    return () => {
      vigente = false
    }
  }, [campo.valorCifrado])

  if (valor === undefined) return <p className="text-xs text-noct-neutral-400">Descifrando...</p>
  if (valor === null) {
    return (
      <p className="text-[13px] leading-normal text-noct-precaucion">
        No se pudo descifrar con la contraseña maestra actual. Se guardó con una contraseña distinta.
      </p>
    )
  }
  if (valor === '') {
    return <p className="text-xs text-noct-neutral-500">Este dato está vacío.</p>
  }

  const oculto = esOcultoPorDefecto(campo.tipo) && !revelado

  return (
    <dl className="m-0">
      <CampoSecreto
        etiqueta={etiquetaTipo(campo.tipo)}
        valor={valor}
        oculto={oculto}
        alternarOculto={
          esOcultoPorDefecto(campo.tipo)
            ? () => {
                // Igual que arriba: el registro va fuera del
                // actualizador de estado para no auditar dos veces bajo
                // el modo estricto de React.
                if (!revelado) {
                  void registrarAccesoBoveda({
                    entidadTipo: 'campo_protegido',
                    credencialId: campo.id,
                    credencialTitulo: campo.nombre,
                    accion: 'mostro',
                  })
                }
                setRevelado((v) => !v)
              }
            : undefined
        }
        onCopiado={() =>
          void registrarAccesoBoveda({
            entidadTipo: 'campo_protegido',
            credencialId: campo.id,
            credencialTitulo: campo.nombre,
            accion: campo.tipo === 'usuario' ? 'copio_usuario' : 'copio_contrasena',
          })
        }
      />
    </dl>
  )
}

// Alta y edicion de un campo. Guardar exige la boveda abierta (hay que
// cifrar), asi que el formulario pide el desbloqueo antes de mostrarse.
function EditorCampo({
  dispositivoId,
  campo,
  camposDelEquipo,
  nombreInicial,
  onCerrar,
}: {
  dispositivoId: string
  campo: CampoProtegido | null
  camposDelEquipo: CampoProtegido[]
  // Solo se usa al crear (campo null): nombre precargado desde el
  // nudge anti duplicidad de la Bóveda (fase P3).
  nombreInicial?: string
  onCerrar: () => void
}) {
  const desbloqueada = useBovedaDesbloqueada()
  const [nombre, setNombre] = useState(campo?.nombre ?? nombreInicial ?? '')
  const [tipo, setTipo] = useState<TipoCampoProtegido>(campo?.tipo ?? 'contrasena')
  const [valor, setValor] = useState('')
  const [verValor, setVerValor] = useState(false)
  const [cargado, setCargado] = useState(campo === null)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  // Al editar se precarga el valor actual para no obligar a
  // reescribirlo solo por cambiarle el nombre o el tipo.
  useEffect(() => {
    if (!campo || !desbloqueada) return
    let vigente = true
    void descifrarValor(campo.valorCifrado).then((descifrado) => {
      if (!vigente) return
      if (descifrado !== null) setValor(descifrado)
      setCargado(true)
    })
    return () => {
      vigente = false
    }
  }, [campo, desbloqueada])

  if (!desbloqueada) {
    return (
      <div className="rounded-md border border-noct-divider bg-noct-bg/40 p-3">
        <FormularioDesbloqueo />
        <button type="button" onClick={onCerrar} className={`mt-2 ${BTN_SECUNDARIO}`}>
          Cancelar
        </button>
      </div>
    )
  }

  async function guardar(evento: FormEvent) {
    evento.preventDefault()
    const problema = validarNombre(nombre, camposDelEquipo, campo?.id ?? null)
    if (problema) {
      setError(problema)
      return
    }
    setGuardando(true)
    setError(null)
    try {
      const id = campo?.id ?? nuevoId()
      await guardarRegistro('campos_protegidos', {
        id,
        dispositivoId,
        nombre: nombre.trim(),
        tipo,
        valorCifrado: await cifrarValor(valor),
        orden: campo?.orden ?? siguienteOrden(camposDelEquipo),
      })
      if (campo) {
        await registrarAccesoBoveda({
          entidadTipo: 'campo_protegido',
          credencialId: id,
          credencialTitulo: nombre.trim(),
          accion: 'modifico',
        })
      }
      onCerrar()
    } catch {
      // Ocurre si el autobloqueo cerro la boveda mientras se escribia.
      setError('La bóveda se bloqueó por inactividad. Desbloquéala de nuevo para guardar.')
      setGuardando(false)
    }
  }

  return (
    <form
      onSubmit={guardar}
      className="flex flex-col gap-2.5 rounded-md border border-noct-accent/40 bg-noct-bg/40 p-3"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-medium text-noct-neutral-400">
          {campo ? 'Editar dato protegido' : 'Nuevo dato protegido'}
        </span>
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar"
          className="flex p-1 text-noct-neutral-500 hover:text-noct-text"
        >
          <X size={14} aria-hidden />
        </button>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-[12px] text-noct-neutral-400">Nombre</span>
        <input
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Usuario administrador, PIN de impresión..."
          className="min-h-11 w-full box-border rounded-md border border-noct-divider bg-noct-surface px-3 py-2.5 text-sm text-noct-text outline-none focus:border-noct-accent placeholder:text-noct-neutral-600"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[12px] text-noct-neutral-400">Tipo</span>
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as TipoCampoProtegido)}
          className="min-h-11 w-full box-border rounded-md border border-noct-divider bg-noct-surface px-3 py-2.5 text-sm text-noct-text outline-none focus:border-noct-accent"
        >
          {TIPOS_CAMPO_PROTEGIDO.map((t) => (
            <option key={t.tipo} value={t.tipo}>
              {t.etiqueta}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-col gap-1.5">
        <span className="text-[12px] text-noct-neutral-400">Valor</span>
        <div className="flex gap-2">
          <CampoContrasena
            revelado={verValor}
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className="min-h-11 min-w-0 flex-1 box-border rounded-md border border-noct-divider bg-noct-surface px-3 py-2.5 font-mono text-sm text-noct-text outline-none focus:border-noct-accent"
          />
          <button
            type="button"
            onClick={() => setVerValor((v) => !v)}
            className={`${BTN_SECUNDARIO} shrink-0`}
          >
            {verValor ? 'Ocultar' : 'Ver'}
          </button>
        </div>
        {!cargado && (
          <p className="text-[11.5px] text-noct-neutral-500">Cargando el valor actual...</p>
        )}
      </div>

      {error && <p className="text-[12px] text-noct-error">{error}</p>}

      <div className="flex gap-1.5">
        <button type="submit" disabled={guardando} className={`${BTN_PRIMARIO} disabled:opacity-50`}>
          <LockSimple size={13} aria-hidden />
          {guardando ? 'Guardando...' : 'Guardar'}
        </button>
        <button type="button" onClick={onCerrar} className={BTN_SECUNDARIO}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

// Desbloqueo en linea, sin salir de la ficha del equipo. Usa la misma
// sesion global de la boveda (y su autobloqueo), igual que
// CredencialEnPaso: desbloquear aqui desbloquea tambien la seccion
// Boveda.
function FormularioDesbloqueo() {
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
        La bóveda está bloqueada. Los datos protegidos no entran a la pantalla hasta desbloquearla
        con la contraseña maestra.
      </p>
      <div className="flex gap-2">
        <CampoContrasena
          required
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
