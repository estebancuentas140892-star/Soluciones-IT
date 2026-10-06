import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  db,
  type CampoProtegido,
  type VinculoProtegido,
  type VinculoProtegidoDelEquipo,
  type VinculoProtegidoFijo,
} from '../../lib/db'
import { registrarAccesoBoveda } from '../../lib/repositorio'
import { CampoContrasena } from '../../components/CampoContrasena'
import { CaretRight, Key, LockSimple } from '../../components/iconos'
import { FilaVinculo } from '../soluciones/FilaVinculo'
import { HojaVinculo } from '../soluciones/HojaVinculo'
import { useEjecucion } from '../soluciones/contextoEjecucion'
import { ZONA_ANIDADA } from '../soluciones/vinculoAnidado'
import { usePerfilVivo } from '../autenticacion/usePerfilVivo'
import { esOcultoPorDefecto, etiquetaTipo } from '../dispositivos/camposProtegidos'
import { CampoSecreto } from './CampoSecreto'
import { esIdDeEquipo, resolverCredencialDelEquipo, type ResolucionCredencialDelEquipo } from './credencialDelEquipo'
import { IndicadorVencimiento } from './IndicadorVencimiento'
import { desbloquear, descifrarCredencial, descifrarValor, type DatosCredencial } from './sesionBoveda'
import { useBovedaDesbloqueada } from './useSesionBoveda'
import { Boton } from '../../components/Boton'

// Salida del bloque protegido hacia la ficha completa (decisión 10 de la
// tarea 172): una acción de ancho completo, no una fila de texto con una
// flecha que parece un enlace más entre los datos. Es el único camino
// desde aquí a la ficha, y en un teléfono tiene que poder tocarse sin
// apuntar (R6, toque de 44).
const ACCION_BLOQUE =
  'mt-0.5 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-noct-accent/40 px-3 text-[13px] font-medium text-noct-accent hover:bg-noct-accent/10 active:bg-noct-accent/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-noct-accent'

interface Props {
  // Vinculo protegido de un paso o una tarea (grupo P2): un secreto
  // independiente de la boveda o un campo protegido de un dispositivo.
  // Reemplaza a las props sueltas `credencialId`/`tituloReferencia`
  // (unico vinculo que existia antes de P2).
  vinculo: VinculoProtegido
  /**
   * CREDENCIAL NECESARIA (encargo del 2026-09-22, sección 8). En la
   * ejecución de una guía el dato protegido deja de ser una fila más
   * entre los vínculos del paso y se presenta como lo que es: la
   * credencial que hace falta AHÍ, con su rótulo. Los controles no
   * cambian: sigue contraído, sigue exigiendo permiso, contraseña
   * maestra y autobloqueo, y cada consulta se sigue registrando.
   */
  variante?: 'fila' | 'bloque'
}

// Bloque protegido de un paso de procedimiento: la informacion
// protegida vinculada al paso. Se muestra contraido y sin secretos;
// solo al tocarlo se consulta la boveda, con las mismas protecciones
// que en su propia seccion (permiso puedeVerBoveda del perfil,
// contrasena maestra y autobloqueo). El secreto nunca vive en el
// articulo y quien no este autorizado solo ve el titulo de referencia.
//
// LA CAJA DESAPARECE (M-012, regla M-R11, tablero `3b`). Antes esto era
// una tarjeta con borde discontinuo, fondo propio y el kicker "Datos
// protegidos": un marco más entre los cinco que podía llegar a mostrar
// un paso. Ahora es una fila de 44 px como los demás vínculos, y lo que
// dice que el dato está protegido es el candado, que es el signo que ya
// significaba eso, más el hecho de que no aparezca nada hasta
// desbloquear. El rótulo también cambia (turno 12): "Datos protegidos"
// nombra la CATEGORÍA del dato; el título del secreto nombra lo que el
// técnico va a obtener, que es lo que estaba buscando.
export function CredencialEnPaso({ vinculo, variante = 'fila' }: Props) {
  // LA CREDENCIAL DEL EQUIPO (tarea 290): la misma consulta, con la
  // credencial que corresponde al equipo de la ejecución.
  if (vinculo.tipo === 'equipo') return <CredencialDelEquipoEnPaso vinculo={vinculo} variante={variante} />
  return <CredencialFijaEnPaso vinculo={vinculo} variante={variante} />
}

// El marco del bloque protegido: en la ejecución, "Credencial necesaria"
// encima de la fila (sección 8 del encargo del 2026-09-22).
function MarcoProtegido({ variante, children }: { variante: 'fila' | 'bloque'; children: ReactNode }) {
  return (
    <div
      className={
        variante === 'bloque'
          ? 'rounded-[10px] border border-noct-divider bg-noct-surface px-3 py-1.5'
          : undefined
      }
    >
      {variante === 'bloque' && (
        <p className="flex items-center gap-1.5 pt-1 text-[12px] font-semibold uppercase tracking-[.06em] text-noct-neutral-300">
          <Key size={13} className="shrink-0 text-noct-neutral-400" aria-hidden />
          Credencial necesaria
        </p>
      )}
      {children}
    </div>
  )
}

// EL VÍNCULO FIJO: la acción sabe exactamente qué dato necesita. Es el
// comportamiento de siempre, sin cambios (vinculoFijo.test.tsx).
function CredencialFijaEnPaso({ vinculo, variante }: { vinculo: VinculoProtegidoFijo; variante: 'fila' | 'bloque' }) {
  const desbloqueada = useBovedaDesbloqueada()
  // Contraido por defecto: los secretos no entran a la pantalla hasta
  // que el tecnico los pide, aunque la boveda ya este desbloqueada.
  const [abierto, setAbierto] = useState(false)

  const perfil = usePerfilVivo()
  const credencial = useLiveQuery(
    async () => (vinculo.tipo === 'credencial' ? ((await db.credenciales.get(vinculo.id)) ?? null) : null),
    [vinculo.tipo, vinculo.id],
  )
  const campo = useLiveQuery(
    async () => (vinculo.tipo === 'campo' ? ((await db.campos_protegidos.get(vinculo.id)) ?? null) : null),
    [vinculo.tipo, vinculo.id],
  )

  const cargando = vinculo.tipo === 'credencial' ? credencial === undefined : campo === undefined
  if (perfil === undefined || cargando) return null

  const autorizado = Boolean(perfil?.puedeVerBoveda)
  const existe = (vinculo.tipo === 'credencial' ? credencial : campo) !== null
  const eliminada = vinculo.tipo === 'credencial' ? Boolean(credencial?.eliminadoEn) : Boolean(campo?.eliminadoEn)
  const tituloVivo =
    existe && !eliminada ? (vinculo.tipo === 'credencial' ? (credencial?.titulo ?? '') : (campo?.nombre ?? '')) : ''
  const titulo = tituloVivo || vinculo.titulo
  const entidadTipo = vinculo.tipo === 'campo' ? 'campo_protegido' : 'credencial'

  const nombre = titulo || 'Secreto'

  return (
    <MarcoProtegido variante={variante}>
      <FilaVinculo
        Icono={LockSimple}
        titulo={nombre}
        abierto={abierto}
        accion={abierto ? 'Ocultar' : 'Mostrar'}
        ariaLabel={`Dato protegido: ${nombre}`}
        extra={
          vinculo.tipo === 'credencial' && credencial && !eliminada ? (
            <IndicadorVencimiento venceEn={credencial.venceEn ?? null} />
          ) : undefined
        }
        onAlternar={() => {
          // El registro va FUERA del actualizador de estado: React
          // puede invocarlo dos veces (modo estricto) y se registraria
          // el consulto por duplicado.
          if (!abierto && autorizado && existe && !eliminada) {
            void registrarAccesoBoveda({ entidadTipo, credencialId: vinculo.id, credencialTitulo: titulo, accion: 'consulto' })
          }
          setAbierto((v) => !v)
        }}
      />

      {abierto && (
        <div className={`my-1 flex flex-col gap-2.5 ${ZONA_ANIDADA}`}>
          {!autorizado || !existe ? (
            <p className="text-[13px] leading-normal text-noct-neutral-400">
              Solo los usuarios autorizados pueden consultar los datos de este paso.
            </p>
          ) : eliminada ? (
            <p className="text-[13px] leading-normal text-noct-neutral-200">
              Los datos vinculados fueron eliminados. Edita el artículo para quitar el vínculo o
              vincular otros.
            </p>
          ) : !desbloqueada ? (
            <FormularioDesbloqueo />
          ) : vinculo.tipo === 'credencial' && credencial ? (
            <>
              <DatosDescifrados datosCifrados={credencial.datosCifrados} credencialId={vinculo.id} credencialTitulo={titulo} />
              <Link to={`/boveda/${vinculo.id}`} className={ACCION_BLOQUE}>
                Ver ficha completa en Bóveda
                <CaretRight size={13} aria-hidden />
              </Link>
            </>
          ) : campo ? (
            <>
              <ValorCampoDescifrado campo={campo} titulo={titulo} />
              {campo.dispositivoId && (
                <Link to={`/dispositivos/${campo.dispositivoId}`} className={ACCION_BLOQUE}>
                  Ver ficha del equipo
                  <CaretRight size={13} aria-hidden />
                </Link>
              )}
            </>
          ) : null}
        </div>
      )}
    </MarcoProtegido>
  )
}

// LA CREDENCIAL DEL EQUIPO CON EL QUE SE TRABAJA (tarea 290).
//
// La acción no nombra una credencial: pide la del equipo de la ejecución
// (`ContextoEjecucion.equipoId`), y `resolverCredencialDelEquipo` la busca
// en la relación que la Bóveda ya tiene. Resuelta, es EXACTAMENTE la
// consulta del vínculo fijo sobre esa credencial: contraída, con permiso,
// desbloqueo en línea, la contraseña tras el ojo y cada consulta
// registrada. Sin resolver, un estado neutro: ni valores, ni títulos de
// otras credenciales, ni una "parecida".
//
// Debajo de la fila, de qué equipo es y cómo cambiarlo, SIN abrir la
// consulta (abrirla registra un acceso). Quien no tiene permiso de Bóveda
// no tiene ninguna credencial en el teléfono: ve el título del vínculo y
// el aviso de siempre, sin que nada le insinúe si el equipo tiene una.
function CredencialDelEquipoEnPaso({
  vinculo,
  variante,
}: {
  vinculo: VinculoProtegidoDelEquipo
  variante: 'fila' | 'bloque'
}) {
  const desbloqueada = useBovedaDesbloqueada()
  const perfil = usePerfilVivo()
  const autorizado = Boolean(perfil?.puedeVerBoveda)

  // El equipo es el de la ejecución: uno para la guía y lo que reutiliza.
  // Fuera de una ejecución, el que se elija aquí.
  const ejecucion = useEjecucion()
  const [equipoLocal, setEquipoLocal] = useState<string | null>(null)
  const equipoId = ejecucion ? ejecucion.equipoId : equipoLocal
  const fijarEquipo = ejecucion ? ejecucion.fijarEquipo : setEquipoLocal

  const [abierto, setAbierto] = useState(false)
  const [eligiendo, setEligiendo] = useState(false)
  // CAMBIAR DE EQUIPO RECOGE LA CONSULTA: lo descifrado del equipo
  // anterior no se queda en pantalla, y ver el nuevo es otro gesto (y otro
  // registro).
  const [equipoVisto, setEquipoVisto] = useState(equipoId)
  if (equipoVisto !== equipoId) {
    setEquipoVisto(equipoId)
    setAbierto(false)
  }

  const equipo = useLiveQuery(
    async () => (esIdDeEquipo(equipoId) ? ((await db.dispositivos.get(equipoId)) ?? null) : null),
    [equipoId],
  )
  // Sin permiso no se lee nada de la Bóveda (y RLS tampoco lo habría bajado).
  const credenciales = useLiveQuery(async () => (autorizado ? db.credenciales.toArray() : []), [autorizado])

  const resolucion = useMemo(
    () =>
      resolverCredencialDelEquipo(
        { equipoId, finalidad: vinculo.finalidad },
        { equipos: equipo ? [equipo] : [], credenciales: credenciales ?? [] },
      ),
    [equipoId, vinculo.finalidad, equipo, credenciales],
  )

  if (perfil === undefined || equipo === undefined || credenciales === undefined) return null

  const resuelta = autorizado && resolucion.estado === 'resuelta' ? resolucion.credencial : null
  const nombre = resuelta?.titulo || vinculo.titulo || 'Credencial del equipo'
  const equipoVivo = equipo && !equipo.eliminadoEn ? equipo : null

  return (
    <MarcoProtegido variante={variante}>
      <FilaVinculo
        Icono={LockSimple}
        titulo={nombre}
        abierto={abierto}
        accion={abierto ? 'Ocultar' : 'Mostrar'}
        ariaLabel={`Dato protegido: ${nombre}`}
        extra={resuelta ? <IndicadorVencimiento venceEn={resuelta.venceEn ?? null} /> : undefined}
        onAlternar={() => {
          // Fuera del actualizador de estado, como en el vínculo fijo.
          if (!abierto && resuelta) {
            void registrarAccesoBoveda({ credencialId: resuelta.id, credencialTitulo: resuelta.titulo, accion: 'consulto' })
          }
          setAbierto((v) => !v)
        }}
      />

      {autorizado && (
        <div className="flex min-h-11 items-center gap-2 pl-[26px]">
          <p className="min-w-0 flex-1 text-[12.5px] leading-snug text-noct-neutral-400 [overflow-wrap:anywhere]">
            {equipoVivo ? (
              <>
                Equipo: <span className="text-noct-neutral-200">{equipoVivo.nombre}</span>
              </>
            ) : equipoId ? (
              'El equipo elegido ya no está disponible.'
            ) : (
              'Sin equipo elegido.'
            )}
          </p>
          <button
            type="button"
            onClick={() => setEligiendo(true)}
            aria-label={equipoVivo ? `Cambiar el equipo (ahora ${equipoVivo.nombre})` : 'Elegir el equipo'}
            className="min-h-11 shrink-0 px-1 text-[12.5px] font-medium text-noct-accent-300 outline-none focus-visible:outline-2 focus-visible:outline-noct-accent"
          >
            {equipoVivo ? 'Cambiar' : 'Elegir equipo'}
          </button>
        </div>
      )}

      {abierto && (
        <div className={`my-1 flex flex-col gap-2.5 ${ZONA_ANIDADA}`}>
          {!autorizado ? (
            <p className="text-[13px] leading-normal text-noct-neutral-400">
              Solo los usuarios autorizados pueden consultar los datos de este paso.
            </p>
          ) : resuelta ? (
            !desbloqueada ? (
              <FormularioDesbloqueo />
            ) : (
              <>
                <DatosDescifrados
                  key={resuelta.id}
                  datosCifrados={resuelta.datosCifrados}
                  credencialId={resuelta.id}
                  credencialTitulo={resuelta.titulo}
                />
                <Link to={`/boveda/${resuelta.id}`} className={ACCION_BLOQUE}>
                  Ver ficha completa en Bóveda
                  <CaretRight size={13} aria-hidden />
                </Link>
              </>
            )
          ) : (
            <p className="text-[13px] leading-normal text-noct-neutral-200">
              {mensajeSinResolver(resolucion.estado, vinculo.finalidad)}
            </p>
          )}
        </div>
      )}

      {autorizado && <SelectorEquipo abierto={eligiendo} onCerrar={() => setEligiendo(false)} onElegir={fijarEquipo} />}
    </MarcoProtegido>
  )
}

// Lo que se dice cuando no hay UNA credencial: neutro, sin valores, sin
// nombrar otras credenciales y sin ofrecer probar ninguna.
function mensajeSinResolver(estado: ResolucionCredencialDelEquipo['estado'], finalidad: string): string {
  switch (estado) {
    case 'sin-equipo':
      return 'Elige el equipo con el que trabajas para ver su credencial.'
    case 'equipo-no-disponible':
      return 'El equipo elegido ya no está disponible. Elige el equipo con el que trabajas.'
    case 'varias':
      return 'Este equipo tiene varias credenciales y no se puede saber cuál corresponde a esta acción.'
    case 'ninguna':
    case 'resuelta':
      return finalidad.trim()
        ? `No hay una credencial configurada para este equipo con la finalidad «${finalidad.trim()}».`
        : 'No hay una credencial configurada para este equipo.'
  }
}

// ELEGIR EL EQUIPO SIN SALIR DE LA GUÍA (tarea 290). La misma hoja con
// buscador que eligen los vínculos en el editor (`HojaVinculo`), con los
// equipos vivos del inventario por su nombre y su lugar. Solo nombres:
// ningún dato protegido del equipo.
function SelectorEquipo({
  abierto,
  onCerrar,
  onElegir,
}: {
  abierto: boolean
  onCerrar: () => void
  onElegir: (equipoId: string) => void
}) {
  const equipos = useLiveQuery(
    async () => (abierto ? db.dispositivos.filter((d) => !d.eliminadoEn).toArray() : []),
    [abierto],
    [],
  )
  const opciones = useMemo(
    () =>
      [...equipos]
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { numeric: true }))
        .map((d) => ({ id: d.id, titulo: d.ubicacion ? `${d.nombre} · ${d.ubicacion}` : d.nombre })),
    [equipos],
  )
  return (
    <HojaVinculo
      abierto={abierto}
      onCerrar={onCerrar}
      titulo="¿Con qué equipo trabajas?"
      placeholderBuscar={`Buscar en ${opciones.length} ${opciones.length === 1 ? 'equipo' : 'equipos'}`}
      grupos={[{ opciones }]}
      onElegir={onElegir}
      // El nombre del equipo es lo que se elige: no se recorta (regla 23).
      sinRecortar
    />
  )
}

// Desbloqueo en linea, sin salir del procedimiento. Usa la misma
// sesion global de la boveda: desbloquear aqui desbloquea tambien la
// seccion Boveda (y el autobloqueo por inactividad aplica igual).
// Solo se muestra a usuarios con permiso y con la fila ya sincronizada,
// asi que nunca queda vacia en este punto.
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
        La bóveda está bloqueada. Los datos no entran a la pantalla hasta desbloquearla con la
        contraseña maestra.
      </p>
      <div className="flex gap-2">
        <CampoContrasena
          required
          value={contrasena}
          onChange={(e) => setContrasena(e.target.value)}
          placeholder="Contraseña maestra"
          className="min-h-11 min-w-0 flex-1 rounded-lg border border-noct-divider bg-noct-bg px-3 py-2 text-sm text-noct-text caret-noct-accent placeholder:text-noct-neutral-600"
        />
        {/* De dedo, 44 px (R6): se desbloquea de pie, en medio de una guía. */}
        <Boton
          type="submit"
          papel="principal"
          className="shrink-0"
          icono={<Key size={14} aria-hidden />}
          cargando={abriendo}
          textoCargando="Abriendo…"
        >
          Desbloquear
        </Boton>
      </div>
      {error && <p className="text-xs text-noct-error">{error}</p>}
    </form>
  )
}

function DatosDescifrados({
  datosCifrados,
  credencialId,
  credencialTitulo,
}: {
  datosCifrados: string
  credencialId: string
  credencialTitulo: string
}) {
  // undefined: descifrando; null: no se pudo descifrar.
  const [datos, setDatos] = useState<DatosCredencial | null | undefined>(undefined)
  const [verContrasena, setVerContrasena] = useState(false)

  useEffect(() => {
    let vigente = true
    setDatos(undefined)
    void descifrarCredencial(datosCifrados).then((resultado) => {
      if (vigente) setDatos(resultado)
    })
    return () => {
      vigente = false
    }
  }, [datosCifrados])

  if (datos === undefined) {
    return <p className="text-xs text-noct-neutral-400">Descifrando...</p>
  }
  if (datos === null) {
    return (
      <p className="text-[13px] leading-normal text-noct-neutral-200">
        No se pudo descifrar este secreto con la contraseña maestra actual. Ábrelo en la sección
        Bóveda para ver los detalles.
      </p>
    )
  }

  const sinCampos =
    !datos.usuario &&
    !datos.contrasena &&
    !datos.ip &&
    !datos.url &&
    Object.keys(datos.extras).length === 0

  return (
    <div className="flex flex-col gap-2">
      {!sinCampos && (
        <dl className="flex flex-col gap-2">
          {datos.usuario && (
            <CampoSecreto
              etiqueta="Usuario"
              valor={datos.usuario}
              onCopiado={() => void registrarAccesoBoveda({ credencialId, credencialTitulo, accion: 'copio_usuario' })}
            />
          )}
          {datos.contrasena && (
            <CampoSecreto
              etiqueta="Contraseña"
              valor={datos.contrasena}
              oculto={!verContrasena}
              alternarOculto={() =>
                setVerContrasena((v) => {
                  const nuevoValor = !v
                  if (nuevoValor) void registrarAccesoBoveda({ credencialId, credencialTitulo, accion: 'mostro' })
                  return nuevoValor
                })
              }
              onCopiado={() =>
                void registrarAccesoBoveda({ credencialId, credencialTitulo, accion: 'copio_contrasena' })
              }
            />
          )}
          {datos.ip && <CampoSecreto etiqueta="Dirección IP" valor={datos.ip} />}
          {datos.url && <CampoSecreto etiqueta="URL" valor={datos.url} />}
          {Object.entries(datos.extras).map(([clave, valor]) => (
            <CampoSecreto key={clave} etiqueta={clave} valor={valor} />
          ))}
        </dl>
      )}
      {datos.notas && (
        <p className="whitespace-pre-wrap text-xs leading-normal text-noct-neutral-400">{datos.notas}</p>
      )}
      {sinCampos && !datos.notas && (
        <p className="text-xs text-noct-neutral-500">Esta credencial no tiene datos guardados.</p>
      )}
    </div>
  )
}

// Equivalente de DatosDescifrados para un campo protegido de un
// dispositivo (grupo P2): un solo valor, no un conjunto de campos, asi
// que reutiliza CampoSecreto directo en vez del <dl> con varias filas.
function ValorCampoDescifrado({ campo, titulo }: { campo: CampoProtegido; titulo: string }) {
  // undefined: descifrando; null: no se pudo descifrar.
  const [valor, setValor] = useState<string | null | undefined>(undefined)
  const [revelado, setRevelado] = useState(false)

  useEffect(() => {
    let vigente = true
    setValor(undefined)
    void descifrarValor(campo.valorCifrado).then((resultado) => {
      if (vigente) setValor(resultado)
    })
    return () => {
      vigente = false
    }
  }, [campo.valorCifrado])

  if (valor === undefined) return <p className="text-xs text-noct-neutral-400">Descifrando...</p>
  if (valor === null) {
    return (
      <p className="text-[13px] leading-normal text-noct-neutral-200">
        No se pudo descifrar con la contraseña maestra actual. Ábrelo en la ficha del equipo para
        ver los detalles.
      </p>
    )
  }
  if (valor === '') {
    return <p className="text-xs text-noct-neutral-500">Este dato está vacío.</p>
  }

  const oculto = esOcultoPorDefecto(campo.tipo)

  return (
    <dl className="m-0">
      <CampoSecreto
        etiqueta={etiquetaTipo(campo.tipo)}
        valor={valor}
        oculto={oculto && !revelado}
        alternarOculto={
          oculto
            ? () => {
                if (!revelado) {
                  void registrarAccesoBoveda({
                    entidadTipo: 'campo_protegido',
                    credencialId: campo.id,
                    credencialTitulo: titulo,
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
            credencialTitulo: titulo,
            accion: campo.tipo === 'usuario' ? 'copio_usuario' : 'copio_contrasena',
          })
        }
      />
    </dl>
  )
}
