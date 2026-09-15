import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Chasis } from '../../app/Chasis'
import { Campo, CampoConSugerencias, CLASE_CAMPO, CLASE_CAMPO_MONO, CLASE_ETIQUETA } from '../../components/campos'
import { PastillaEstadoArticulo } from '../../components/PastillaEstado'
import {
  BookOpen,
  CaretDown,
  Check,
  CheckCircle,
  Circle,
  ClockCountdown,
  FloppyDisk,
  Plus,
  X,
  type IconoProps,
} from '../../components/iconos'
import { BTN_GHOST_ACENTO, BTN_PRIMARIO } from '../../components/nocturne'
import {
  db,
  type ArticuloRelacionado,
  type EstadoUsoHerramienta,
  type ReferenciaRelacionada,
  type TipoReferencia,
} from '../../lib/db'
import { guardarRegistro, nuevoId } from '../../lib/repositorio'
import { valoresUnicos } from '../../lib/vocabulario'
import { HojaTipoBloque, type OpcionTipoBloque } from '../soluciones/HojaTipoBloque'
import { HojaVinculo, type GrupoVinculo } from '../soluciones/HojaVinculo'
import { AvisosConsistencia } from './AvisosConsistencia'
import { revisarReferencia } from './consistencia'
import { ICONO_POR_TIPO, iconoDeReferencia } from './iconosReferencia'
import {
  esTipoConocido,
  INFO_TIPO,
  OPCIONES_ESTADO_USO,
  rutaDeCatalogo,
  TIPOS_REFERENCIA,
  tituloConAbreviatura,
} from './referencias'

// CREAR O EDITAR UNA FICHA DEL CENTRO DE CONSULTA.
//
// El formulario cambia con el TIPO, y no muestra los campos que no
// aplican: un término no tiene combinación de teclas ni "requiere
// administrador", y un comando no tiene abreviatura. Enseñarlos todos
// convertiría una ficha de cuatro campos en una de veinte, la mayoría en
// blanco para siempre.
//
// UNA HERRAMIENTA SE ESCRIBE CORTA (encargo del 2026-09-14): qué es,
// para qué sirve, cómo se usa en Metroparques y qué se sabe de ese uso,
// quién la hace y sus notas. Todo opcional salvo el nombre: una ficha
// con solo lo confirmado es mejor que una llena por obligación. Los
// pasos de cómo hacer algo NO se escriben aquí: se enlaza la guía.

const OPCIONES_TIPO: OpcionTipoBloque<TipoReferencia>[] = TIPOS_REFERENCIA.map((valor) => ({
  valor,
  etiqueta: INFO_TIPO[valor].etiqueta,
  descripcion: INFO_TIPO[valor].descripcion,
  Icono: ICONO_POR_TIPO[valor],
  claseIcono: 'text-noct-accent-300',
}))

const ICONO_USO: Record<EstadoUsoHerramienta, (props: IconoProps) => React.JSX.Element> = {
  '': Circle,
  confirmado: CheckCircle,
  documentado: ClockCountdown,
}

const CLASE_ICONO_USO: Record<EstadoUsoHerramienta, string> = {
  '': 'text-noct-neutral-400',
  confirmado: 'text-noct-exito',
  documentado: 'text-noct-precaucion',
}

const OPCIONES_USO: OpcionTipoBloque<EstadoUsoHerramienta>[] = OPCIONES_ESTADO_USO.map((opcion) => ({
  ...opcion,
  Icono: ICONO_USO[opcion.valor],
  claseIcono: CLASE_ICONO_USO[opcion.valor],
}))

// El nombre de un atajo ES lo que hace ("Abrir la ventana Ejecutar"), y
// el de un comando, su propósito: así se lee primero lo que se busca.
const ETIQUETA_NOMBRE: Record<TipoReferencia, string> = {
  herramienta: 'Nombre',
  termino: 'Nombre',
  atajo: 'Qué hace',
  comando: 'Nombre o propósito',
}

const EJEMPLO_NOMBRE: Record<TipoReferencia, string> = {
  herramienta: 'TightVNC',
  termino: 'Gigabyte',
  atajo: 'Abrir la ventana Ejecutar',
  comando: 'Comprobar si un equipo responde',
}

function tipoValido(valor: string | null): TipoReferencia {
  return esTipoConocido(valor) ? valor : 'herramienta'
}

// Lista separada por comas <-> array. Se acepta la coma porque es como
// el equipo escribe los alias de corrido ("AP, punto de acceso") y
// obligar a un editor de filas para dos palabras sería peor.
function aLista(texto: string): string[] {
  return texto
    .split(',')
    .map((parte) => parte.trim())
    .filter(Boolean)
}

function porTitulo<T extends { titulo: string }>(a: T, b: T): number {
  return a.titulo.localeCompare(b.titulo, 'es', { numeric: true })
}

export function ReferenciaForm() {
  const { referenciaId } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const esEdicion = Boolean(referenciaId)
  const [id] = useState(() => referenciaId ?? nuevoId())

  const referencia = useLiveQuery(
    async () => (referenciaId ? ((await db.referencias.get(referenciaId)) ?? null) : undefined),
    [referenciaId],
  )
  const todas = useLiveQuery(
    () => db.referencias.filter((r) => !r.eliminadoEn && esTipoConocido(r.tipo)).toArray(),
    [],
    [],
  )
  // Las guías que se pueden enlazar desde una herramienta: todas las
  // vivas, también los borradores, que la hoja separa por estado.
  const articulos = useLiveQuery(() => db.articulos.filter((a) => !a.eliminadoEn).toArray(), [], [])

  const [tipo, setTipo] = useState<TipoReferencia>(() => tipoValido(params.get('tipo')))
  const [titulo, setTitulo] = useState('')
  const [abreviatura, setAbreviatura] = useState('')
  const [alias, setAlias] = useState('')
  const [definicion, setDefinicion] = useState('')
  const [ejemplo, setEjemplo] = useState('')
  const [categoria, setCategoria] = useState('')
  const [plataforma, setPlataforma] = useState('')
  const [valor, setValor] = useState('')
  const [cuandoUsar, setCuandoUsar] = useState('')
  const [resultadoEsperado, setResultadoEsperado] = useState('')
  const [requiereAdmin, setRequiereAdmin] = useState(false)
  const [advertencia, setAdvertencia] = useState('')
  const [etiquetas, setEtiquetas] = useState('')
  const [relacionadas, setRelacionadas] = useState<ReferenciaRelacionada[]>([])
  const [proveedor, setProveedor] = useState('')
  const [usoEnMetroparques, setUsoEnMetroparques] = useState('')
  const [estadoUso, setEstadoUso] = useState<EstadoUsoHerramienta>('')
  const [notas, setNotas] = useState('')
  const [guiasRelacionadas, setGuiasRelacionadas] = useState<ArticuloRelacionado[]>([])
  const [motivo, setMotivo] = useState('')
  const [hojaTipo, setHojaTipo] = useState(false)
  const [hojaUso, setHojaUso] = useState(false)
  const [hojaRelacionada, setHojaRelacionada] = useState(false)
  const [hojaGuia, setHojaGuia] = useState(false)
  const [cargadoInicial, setCargadoInicial] = useState(!esEdicion)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!referencia || cargadoInicial) return
    setTipo(tipoValido(referencia.tipo))
    setTitulo(referencia.titulo)
    setAbreviatura(referencia.abreviatura)
    setAlias((referencia.alias ?? []).join(', '))
    setDefinicion(referencia.definicion)
    setEjemplo(referencia.ejemplo)
    setCategoria(referencia.categoria)
    setPlataforma(referencia.plataforma)
    setValor(referencia.valor)
    setCuandoUsar(referencia.cuandoUsar)
    setResultadoEsperado(referencia.resultadoEsperado)
    setRequiereAdmin(referencia.requiereAdmin)
    setAdvertencia(referencia.advertencia)
    setEtiquetas((referencia.etiquetas ?? []).join(', '))
    setRelacionadas(referencia.relacionadas ?? [])
    setProveedor(referencia.proveedor ?? '')
    setUsoEnMetroparques(referencia.usoEnMetroparques ?? '')
    setEstadoUso(referencia.estadoUso ?? '')
    setNotas(referencia.notas ?? '')
    setGuiasRelacionadas(referencia.guiasRelacionadas ?? [])
    setCargadoInicial(true)
  }, [referencia, cargadoInicial])

  const esHerramienta = tipo === 'herramienta'
  const esTermino = tipo === 'termino'
  const esAtajo = tipo === 'atajo'
  const esComando = tipo === 'comando'
  const conTeclas = esAtajo || esComando

  // LA FICHA TAL COMO SE GUARDARÍA. Los campos que no aplican al tipo
  // viajan vacíos (el objeto tiene siempre la misma forma), y es esta
  // misma ficha la que se revisa mientras se escribe: avisar sobre un
  // dato que no se va a guardar confundiría.
  const ficha = {
    id,
    tipo,
    titulo: titulo.trim(),
    abreviatura: esTermino || esHerramienta ? abreviatura.trim() : '',
    alias: aLista(alias),
    definicion: definicion.trim(),
    ejemplo: esTermino ? ejemplo.trim() : '',
    categoria: categoria.trim(),
    plataforma: conTeclas ? plataforma.trim() : '',
    valor: conTeclas ? valor.trim() : '',
    cuandoUsar: esTermino ? '' : cuandoUsar.trim(),
    resultadoEsperado: conTeclas ? resultadoEsperado.trim() : '',
    requiereAdmin: esComando ? requiereAdmin : false,
    advertencia: advertencia.trim(),
    relacionadas,
    etiquetas: aLista(etiquetas),
    proveedor: esHerramienta ? proveedor.trim() : '',
    usoEnMetroparques: esHerramienta ? usoEnMetroparques.trim() : '',
    estadoUso: esHerramienta ? estadoUso : '',
    notas: esHerramienta ? notas.trim() : '',
    guiasRelacionadas: esHerramienta ? guiasRelacionadas : [],
  } satisfies Parameters<typeof guardarRegistro<'referencias'>>[1]

  // LA REVISIÓN DE CONSISTENCIA, EN VIVO MIENTRAS SE ESCRIBE. Se calcula
  // sobre el BORRADOR, no sobre lo guardado: avisar después de guardar
  // llega tarde. Describe y no bloquea: guardar sigue disponible siempre.
  const avisos = revisarReferencia({ ...ficha, updatedAt: '', updatedBy: null, eliminadoEn: null }, todas)

  // Sugerencias del MISMO tipo: una herramienta no necesita que le
  // propongan "Medidas" como categoría.
  const mismoTipo = useMemo(() => todas.filter((r) => r.tipo === tipo), [todas, tipo])
  const categoriasUsadas = useMemo(() => valoresUnicos(mismoTipo.map((r) => r.categoria)), [mismoTipo])
  const plataformasUsadas = useMemo(() => valoresUnicos(mismoTipo.map((r) => r.plataforma)), [mismoTipo])
  const proveedoresUsados = useMemo(() => valoresUnicos(todas.map((r) => r.proveedor ?? '')), [todas])

  const idsRelacionadas = useMemo(() => new Set(relacionadas.map((r) => r.id)), [relacionadas])
  const vivasPorId = useMemo(() => new Map(todas.map((r) => [r.id, r])), [todas])
  // Lo relacionable, agrupado por pestaña: con cuatro tipos, una lista
  // plana mezclaba "Ping" con "Punto de acceso".
  const gruposRelacionables: GrupoVinculo[] = useMemo(
    () =>
      TIPOS_REFERENCIA.map((otroTipo) => ({
        etiqueta: INFO_TIPO[otroTipo].pestana,
        opciones: todas
          .filter((r) => r.tipo === otroTipo && r.id !== id && !idsRelacionadas.has(r.id))
          .map((r) => ({ id: r.id, titulo: tituloConAbreviatura(r) }))
          .sort(porTitulo),
      })).filter((grupo) => grupo.opciones.length > 0),
    [todas, id, idsRelacionadas],
  )

  const guiasPorId = useMemo(() => new Map(articulos.map((a) => [a.id, a])), [articulos])
  const idsGuias = useMemo(() => new Set(guiasRelacionadas.map((g) => g.id)), [guiasRelacionadas])
  const gruposGuias: GrupoVinculo[] = useMemo(() => {
    const libres = articulos.filter((a) => !idsGuias.has(a.id))
    const deEstado = (estado: string) =>
      libres
        .filter((a) => (a.estado ?? 'publicado') === estado)
        .map((a) => ({ id: a.id, titulo: a.titulo }))
        .sort(porTitulo)
    return [
      { etiqueta: 'Publicadas', opciones: deEstado('publicado') },
      { etiqueta: 'Borradores', opciones: deEstado('borrador') },
      { etiqueta: 'Obsoletas', opciones: deEstado('obsoleto') },
    ].filter((grupo) => grupo.opciones.length > 0)
  }, [articulos, idsGuias])

  if (esEdicion && referencia === null) return <Navigate to="/referencia" replace />

  async function manejarEnvio(evento: FormEvent) {
    evento.preventDefault()
    if (ficha.titulo === '' || guardando) return
    setGuardando(true)
    await guardarRegistro('referencias', ficha, motivo.trim())
    navigate(`/referencia/${id}`)
  }

  function agregarRelacionada(idElegido: string) {
    const elegida = todas.find((r) => r.id === idElegido)
    if (!elegida) return
    setRelacionadas((actuales) => [...actuales, { id: elegida.id, titulo: elegida.titulo }])
  }

  function agregarGuia(idElegido: string) {
    const elegida = guiasPorId.get(idElegido)
    if (!elegida) return
    setGuiasRelacionadas((actuales) => [...actuales, { id: elegida.id, titulo: elegida.titulo }])
  }

  const IconoUso = ICONO_USO[estadoUso]
  const etiquetaUso = OPCIONES_ESTADO_USO.find((opcion) => opcion.valor === estadoUso)?.etiqueta ?? 'Sin indicar'

  const campoCategoria = (
    <Campo
      etiqueta="Categoría (opcional)"
      ayuda={
        esHerramienta
          ? 'Agrupa la herramienta en el filtro: Acceso remoto, Monitoreo, POS.'
          : 'Agrupa la ficha en el filtro: Redes, Almacenamiento, Windows.'
      }
    >
      <CampoConSugerencias
        valor={categoria}
        onChange={setCategoria}
        sugerencias={categoriasUsadas}
        placeholder={esHerramienta ? 'Acceso remoto' : 'Redes'}
        className="min-h-11"
      />
    </Campo>
  )

  return (
    <Chasis
      modo="tarea"
      rotulo={esEdicion ? 'Editando' : 'Creando'}
      titulo={titulo.trim() || (esEdicion ? 'Editar ficha' : INFO_TIPO[tipo].nueva)}
      vuelta="Centro de consulta"
      salidaA={rutaDeCatalogo(tipo)}
      salidaEtiqueta="Cancelar y volver"
    >
      {esEdicion && !cargadoInicial ? (
        <p className="px-4 pt-6 text-sm text-noct-neutral-400">Cargando...</p>
      ) : (
        <form onSubmit={manejarEnvio} className="flex flex-1 flex-col gap-4 px-4 pb-16 pt-[18px]">
          {/* El tipo se elige en una hoja con los cuatro a la vista y su
              descripción, no en una rueda nativa: cambia qué campos
              tiene la ficha, así que elegirlo a ciegas cuesta caro. */}
          <div className="flex flex-col gap-1.5">
            <span className={CLASE_ETIQUETA}>Tipo de ficha</span>
            <button
              type="button"
              onClick={() => setHojaTipo(true)}
              aria-haspopup="dialog"
              className={`flex min-h-11 items-center gap-2 text-left ${CLASE_CAMPO}`}
            >
              <span className="min-w-0 flex-1">{INFO_TIPO[tipo].etiqueta}</span>
              <CaretDown size={15} className="shrink-0 text-noct-neutral-400" aria-hidden />
            </button>
          </div>

          <Campo etiqueta={<>{ETIQUETA_NOMBRE[tipo]} <span className="text-noct-accent-300">*</span></>}>
            <input
              type="text"
              required
              autoFocus={!esEdicion}
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder={EJEMPLO_NOMBRE[tipo]}
              className={`min-h-11 ${CLASE_CAMPO}`}
            />
          </Campo>

          {(esTermino || esHerramienta) && (
            <Campo
              etiqueta={esHerramienta ? 'Nombre corto o abreviatura (opcional)' : 'Abreviatura (opcional)'}
              ayuda={
                esHerramienta
                  ? 'Solo si el equipo la usa: SSMS.'
                  : 'La forma corta con la que se escribe: GB, DNS, AP.'
              }
            >
              <input
                type="text"
                value={abreviatura}
                onChange={(e) => setAbreviatura(e.target.value)}
                placeholder={esHerramienta ? 'SSMS' : 'GB'}
                className={`min-h-11 ${CLASE_CAMPO}`}
              />
            </Campo>
          )}

          {esHerramienta && campoCategoria}

          {conTeclas && (
            <Campo
              etiqueta={esAtajo ? 'Combinación de teclas' : 'Comando completo'}
              ayuda={
                esAtajo
                  ? 'Tal como se teclea: Windows + R.'
                  : 'Tal como se escribe. Nunca contraseñas, tokens ni direcciones internas: eso va a la Bóveda o a los datos protegidos del equipo.'
              }
            >
              <input
                type="text"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder={esAtajo ? 'Windows + R' : 'ping <IP o nombre>'}
                className={`min-h-11 ${CLASE_CAMPO_MONO}`}
              />
            </Campo>
          )}

          {conTeclas && (
            <Campo
              etiqueta={esAtajo ? 'Programa o sistema' : 'Plataforma o herramienta'}
              ayuda="Dónde funciona: Windows, Chrome, la consola del router."
            >
              <CampoConSugerencias
                valor={plataforma}
                onChange={setPlataforma}
                sugerencias={plataformasUsadas}
                placeholder="Windows"
                className="min-h-11"
              />
            </Campo>
          )}

          {esHerramienta && (
            <>
              <Campo etiqueta="Descripción breve (opcional)" ayuda="Qué es, en una frase.">
                <textarea
                  rows={2}
                  value={definicion}
                  onChange={(e) => setDefinicion(e.target.value)}
                  placeholder="Herramienta de acceso remoto para controlar computadores a distancia."
                  className={`resize-y leading-[1.5] ${CLASE_CAMPO}`}
                />
              </Campo>

              <Campo etiqueta="¿Para qué sirve? (opcional)" ayuda="De una a tres frases.">
                <textarea
                  rows={3}
                  value={cuandoUsar}
                  onChange={(e) => setCuandoUsar(e.target.value)}
                  className={`resize-y leading-[1.5] ${CLASE_CAMPO}`}
                />
              </Campo>

              <Campo
                etiqueta="Cómo se usa en Metroparques (opcional)"
                ayuda="Solo lo confirmado. Nunca contraseñas ni accesos: eso va a la Bóveda."
              >
                <textarea
                  rows={3}
                  value={usoEnMetroparques}
                  onChange={(e) => setUsoEnMetroparques(e.target.value)}
                  className={`resize-y leading-[1.5] ${CLASE_CAMPO}`}
                />
              </Campo>

              <div className="flex flex-col gap-1.5">
                <span className={CLASE_ETIQUETA}>¿Se usa hoy en Metroparques?</span>
                <button
                  type="button"
                  onClick={() => setHojaUso(true)}
                  aria-haspopup="dialog"
                  className={`flex min-h-11 items-center gap-2 text-left ${CLASE_CAMPO}`}
                >
                  <IconoUso size={16} className={`shrink-0 ${CLASE_ICONO_USO[estadoUso]}`} aria-hidden />
                  <span className="min-w-0 flex-1">{etiquetaUso}</span>
                  <CaretDown size={15} className="shrink-0 text-noct-neutral-400" aria-hidden />
                </button>
                <span className="text-[12px] leading-[1.5] text-noct-neutral-600">
                  Lo documentado se muestra como pendiente de confirmar, nunca como uso actual.
                </span>
              </div>

              <Campo etiqueta="Proveedor o fabricante (opcional)" ayuda="Solo si se conoce.">
                <CampoConSugerencias
                  valor={proveedor}
                  onChange={setProveedor}
                  sugerencias={proveedoresUsados}
                  placeholder="Microsoft"
                  className="min-h-11"
                />
              </Campo>

              <Campo etiqueta="Notas (opcional)" ayuda="Aclaraciones cortas, por ejemplo con qué no confundirla.">
                <textarea
                  rows={2}
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  className={`resize-y leading-[1.5] ${CLASE_CAMPO}`}
                />
              </Campo>
            </>
          )}

          {esTermino && (
            <Campo etiqueta="Definición corta" ayuda="Una o dos frases, prácticas y correctas.">
              <textarea
                rows={3}
                value={definicion}
                onChange={(e) => setDefinicion(e.target.value)}
                placeholder="Unidad de almacenamiento. Equivale a 1.000 millones de bytes."
                className={`resize-y leading-[1.5] ${CLASE_CAMPO}`}
              />
            </Campo>
          )}

          {esTermino && (
            <Campo etiqueta="Ejemplo (opcional)">
              <textarea
                rows={2}
                value={ejemplo}
                onChange={(e) => setEjemplo(e.target.value)}
                placeholder="Un disco de 500 GB almacena 500 gigabytes de datos."
                className={`resize-y leading-[1.5] ${CLASE_CAMPO}`}
              />
            </Campo>
          )}

          {conTeclas && (
            <>
              <Campo etiqueta={esAtajo ? 'Cuándo sirve' : 'Cuándo utilizarlo'}>
                <textarea
                  rows={2}
                  value={cuandoUsar}
                  onChange={(e) => setCuandoUsar(e.target.value)}
                  placeholder={
                    esAtajo
                      ? 'Para abrir rutas de red, utilidades y comandos sin buscarlos en el menú.'
                      : 'Para comprobar la IP del equipo.'
                  }
                  className={`resize-y leading-[1.5] ${CLASE_CAMPO}`}
                />
              </Campo>

              <Campo etiqueta="Resultado esperado">
                <textarea
                  rows={2}
                  value={resultadoEsperado}
                  onChange={(e) => setResultadoEsperado(e.target.value)}
                  placeholder="Aparece una ventana pequeña en la esquina inferior izquierda."
                  className={`resize-y leading-[1.5] ${CLASE_CAMPO}`}
                />
              </Campo>
            </>
          )}

          {esComando && (
            <button
              type="button"
              onClick={() => setRequiereAdmin((v) => !v)}
              aria-pressed={requiereAdmin}
              className="flex min-h-11 items-start gap-2.5 rounded-lg border border-noct-divider bg-noct-surface px-3 py-3 text-left"
            >
              {requiereAdmin ? (
                <span className="mt-px flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded bg-noct-accent">
                  <Check size={13} className="text-noct-bg" aria-hidden />
                </span>
              ) : (
                <span className="mt-px h-[18px] w-[18px] shrink-0 rounded border-[1.5px] border-noct-neutral-700" />
              )}
              <span className="min-w-0">
                <span className="block text-[13.5px] font-medium">Requiere permisos de administrador</span>
                <span className="mt-0.5 block text-[12px] leading-[1.5] text-noct-neutral-500">
                  Se avisa antes de que el técnico lo teclee, no después de que falle.
                </span>
              </span>
            </button>
          )}

          {conTeclas && (
            <Campo etiqueta="Notas (opcional)">
              <textarea
                rows={2}
                value={definicion}
                onChange={(e) => setDefinicion(e.target.value)}
                className={`resize-y leading-[1.5] ${CLASE_CAMPO}`}
              />
            </Campo>
          )}

          {!esHerramienta && (
            <Campo etiqueta="Advertencia (opcional)" ayuda="Lo que puede salir mal si se usa sin cuidado.">
              <textarea
                rows={2}
                value={advertencia}
                onChange={(e) => setAdvertencia(e.target.value)}
                className={`resize-y leading-[1.5] ${CLASE_CAMPO}`}
              />
            </Campo>
          )}

          {!esHerramienta && campoCategoria}

          <Campo
            etiqueta="Alias o nombres alternativos (opcional)"
            ayuda="Separados por comas. Es lo que hace que buscar por la palabra que uno usa encuentre la ficha que escribió otro."
          >
            <input
              type="text"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              placeholder={esHerramienta ? 'Tight VNC' : 'AP, punto de acceso'}
              className={`min-h-11 ${CLASE_CAMPO}`}
            />
          </Campo>

          <Campo etiqueta="Etiquetas (opcional)" ayuda="Separadas por comas.">
            <input
              type="text"
              value={etiquetas}
              onChange={(e) => setEtiquetas(e.target.value)}
              placeholder={esHerramienta ? 'acceso remoto, pos' : 'red, medida'}
              className={`min-h-11 ${CLASE_CAMPO}`}
            />
          </Campo>

          {esHerramienta && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className={CLASE_ETIQUETA}>Guías relacionadas (opcional)</span>
                {gruposGuias.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setHojaGuia(true)}
                    className={`${BTN_GHOST_ACENTO} whitespace-nowrap`}
                  >
                    <Plus size={13} aria-hidden />
                    Vincular
                  </button>
                )}
              </div>
              <span className="-mt-1 text-[12px] leading-[1.5] text-noct-neutral-600">
                Las guías que explican cómo hacer algo con ella. Sus pasos no se copian aquí.
              </span>
              {guiasRelacionadas.map((guia) => {
                const viva = guiasPorId.get(guia.id)
                const nombre = viva?.titulo || guia.titulo
                return (
                  <div
                    key={guia.id}
                    className="flex items-center gap-2 rounded-md border border-noct-divider bg-noct-surface px-3 py-1"
                  >
                    <BookOpen size={15} className="shrink-0 text-noct-neutral-500" aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-[13.5px]">{nombre}</span>
                    {viva && <PastillaEstadoArticulo estado={viva.estado ?? 'publicado'} />}
                    <button
                      type="button"
                      onClick={() =>
                        setGuiasRelacionadas((actuales) => actuales.filter((g) => g.id !== guia.id))
                      }
                      aria-label={`Quitar ${nombre}`}
                      className="flex h-11 w-9 shrink-0 items-center justify-center text-noct-neutral-500 hover:text-noct-text"
                    >
                      <X size={14} aria-hidden />
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className={CLASE_ETIQUETA}>Relacionado (opcional)</span>
              {gruposRelacionables.length > 0 && (
                <button
                  type="button"
                  onClick={() => setHojaRelacionada(true)}
                  className={`${BTN_GHOST_ACENTO} whitespace-nowrap`}
                >
                  <Plus size={13} aria-hidden />
                  Vincular
                </button>
              )}
            </div>
            {relacionadas.map((relacionada) => {
              const viva = vivasPorId.get(relacionada.id)
              const IconoRelacionada = iconoDeReferencia(viva?.tipo)
              return (
                <div
                  key={relacionada.id}
                  className="flex items-center gap-2 rounded-md border border-noct-divider bg-noct-surface px-3 py-1"
                >
                  <IconoRelacionada size={15} className="shrink-0 text-noct-neutral-500" aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-[13.5px]">{viva?.titulo || relacionada.titulo}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setRelacionadas((actuales) => actuales.filter((r) => r.id !== relacionada.id))
                    }
                    aria-label={`Quitar ${relacionada.titulo}`}
                    className="flex h-11 w-9 shrink-0 items-center justify-center text-noct-neutral-500 hover:text-noct-text"
                  >
                    <X size={14} aria-hidden />
                  </button>
                </div>
              )
            })}
          </div>

          {esEdicion && (
            <Campo etiqueta="Motivo del cambio (opcional)">
              <input
                type="text"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Por qué se actualizó esta ficha"
                className={`min-h-11 ${CLASE_CAMPO}`}
              />
            </Campo>
          )}

          {/* Justo antes de guardar, que es cuando se puede corregir sin
              coste. Nunca impide guardar. */}
          <AvisosConsistencia avisos={avisos} />

          <button
            type="submit"
            disabled={guardando || titulo.trim() === ''}
            className={`mt-1 ${BTN_PRIMARIO} min-h-11 disabled:opacity-50`}
          >
            <FloppyDisk size={15} aria-hidden />
            {guardando ? 'Guardando...' : 'Guardar ficha'}
          </button>
        </form>
      )}

      <HojaTipoBloque
        abierto={hojaTipo}
        onCerrar={() => setHojaTipo(false)}
        titulo="¿Qué tipo de ficha es?"
        opciones={OPCIONES_TIPO}
        seleccionado={tipo}
        onElegir={setTipo}
      />

      <HojaTipoBloque
        abierto={hojaUso}
        onCerrar={() => setHojaUso(false)}
        titulo="¿Se usa hoy en Metroparques?"
        opciones={OPCIONES_USO}
        seleccionado={estadoUso}
        onElegir={setEstadoUso}
      />

      <HojaVinculo
        abierto={hojaRelacionada}
        onCerrar={() => setHojaRelacionada(false)}
        titulo="Vincular otra ficha"
        placeholderBuscar="Buscar en el Centro de consulta"
        grupos={gruposRelacionables}
        onElegir={agregarRelacionada}
      />

      <HojaVinculo
        abierto={hojaGuia}
        onCerrar={() => setHojaGuia(false)}
        titulo="Vincular una guía"
        placeholderBuscar="Buscar guía"
        grupos={gruposGuias}
        onElegir={agregarGuia}
      />
    </Chasis>
  )
}
