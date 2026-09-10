import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Chasis } from '../../app/Chasis'
import { Campo, CampoConSugerencias, CLASE_CAMPO, CLASE_CAMPO_MONO, CLASE_ETIQUETA } from '../../components/campos'
import { HojaTipoBloque, type OpcionTipoBloque } from '../soluciones/HojaTipoBloque'
import { HojaVinculo } from '../soluciones/HojaVinculo'
import {
  BookBookmark,
  CaretDown,
  Check,
  FloppyDisk,
  Keyboard,
  Plus,
  TerminalWindow,
  X,
} from '../../components/iconos'
import { BTN_GHOST_ACENTO, BTN_PRIMARIO } from '../../components/nocturne'
import { db, type ReferenciaRelacionada, type TipoReferencia } from '../../lib/db'
import { guardarRegistro, nuevoId } from '../../lib/repositorio'
import { valoresUnicos } from '../../lib/vocabulario'
import { INFO_TIPO, TIPOS_REFERENCIA } from './referencias'

// CREAR O EDITAR UNA ENTRADA DE REFERENCIA.
//
// El formulario cambia con el TIPO, y no muestra los campos que no
// aplican: un termino no tiene combinacion de teclas ni "requiere
// administrador", y un comando no tiene abreviatura. Enseñarlos todos
// convertiria una ficha de cuatro campos en una de trece, la mayoria en
// blanco para siempre.

const OPCIONES_TIPO: OpcionTipoBloque<TipoReferencia>[] = TIPOS_REFERENCIA.map((valor) => ({
  valor,
  etiqueta: INFO_TIPO[valor].etiqueta,
  descripcion: INFO_TIPO[valor].descripcion,
  Icono: valor === 'termino' ? BookBookmark : valor === 'atajo' ? Keyboard : TerminalWindow,
  claseIcono: 'text-noct-accent-300',
}))

function tipoValido(valor: string | null): TipoReferencia {
  return (TIPOS_REFERENCIA as string[]).includes(valor ?? '') ? (valor as TipoReferencia) : 'termino'
}

// Lista separada por comas <-> array. Se acepta la coma porque es como
// el equipo escribe los alias de corrido ("AP, punto de acceso") y
// obligar a un editor de filas para dos palabras seria peor.
function aLista(texto: string): string[] {
  return texto
    .split(',')
    .map((parte) => parte.trim())
    .filter(Boolean)
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
  const todas = useLiveQuery(() => db.referencias.filter((r) => !r.eliminadoEn).toArray(), [], [])

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
  const [motivo, setMotivo] = useState('')
  const [hojaTipo, setHojaTipo] = useState(false)
  const [hojaRelacionada, setHojaRelacionada] = useState(false)
  const [cargadoInicial, setCargadoInicial] = useState(!esEdicion)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!referencia || cargadoInicial) return
    setTipo(referencia.tipo)
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
    setCargadoInicial(true)
  }, [referencia, cargadoInicial])

  const categoriasUsadas = useMemo(() => valoresUnicos(todas.map((r) => r.categoria)), [todas])
  const plataformasUsadas = useMemo(() => valoresUnicos(todas.map((r) => r.plataforma)), [todas])
  const idsRelacionadas = useMemo(() => new Set(relacionadas.map((r) => r.id)), [relacionadas])
  const vinculables = useMemo(
    () =>
      todas
        .filter((r) => r.id !== id && !idsRelacionadas.has(r.id))
        .map((r) => ({ id: r.id, titulo: `${r.titulo}${r.abreviatura ? ` (${r.abreviatura})` : ''}` }))
        .sort((a, b) => a.titulo.localeCompare(b.titulo, 'es', { numeric: true })),
    [todas, id, idsRelacionadas],
  )

  if (esEdicion && referencia === null) return <Navigate to="/referencia" replace />

  const esTermino = tipo === 'termino'
  const esAtajo = tipo === 'atajo'

  async function manejarEnvio(evento: FormEvent) {
    evento.preventDefault()
    if (titulo.trim() === '' || guardando) return
    setGuardando(true)
    await guardarRegistro(
      'referencias',
      {
        id,
        tipo,
        titulo: titulo.trim(),
        abreviatura: esTermino ? abreviatura.trim() : '',
        alias: aLista(alias),
        definicion: definicion.trim(),
        ejemplo: esTermino ? ejemplo.trim() : '',
        categoria: categoria.trim(),
        plataforma: esTermino ? '' : plataforma.trim(),
        valor: esTermino ? '' : valor.trim(),
        cuandoUsar: esTermino ? '' : cuandoUsar.trim(),
        resultadoEsperado: esTermino ? '' : resultadoEsperado.trim(),
        requiereAdmin: tipo === 'comando' ? requiereAdmin : false,
        advertencia: advertencia.trim(),
        relacionadas,
        etiquetas: aLista(etiquetas),
      },
      motivo.trim(),
    )
    navigate(`/referencia/${id}`)
  }

  function agregarRelacionada(idElegido: string) {
    const elegida = todas.find((r) => r.id === idElegido)
    if (!elegida) return
    setRelacionadas((actuales) => [...actuales, { id: elegida.id, titulo: elegida.titulo }])
  }

  return (
    <Chasis
      modo="tarea"
      rotulo={esEdicion ? 'Editando' : 'Creando'}
      titulo={titulo.trim() || (esEdicion ? 'Editar referencia' : `Nuevo ${INFO_TIPO[tipo].etiqueta.toLowerCase()}`)}
      vuelta="Referencia"
      salidaA={`/referencia${esTermino ? '' : '?tab=comandos'}`}
      salidaEtiqueta="Cancelar y volver"
    >
      {esEdicion && !cargadoInicial ? (
        <p className="px-4 pt-6 text-sm text-noct-neutral-400">Cargando...</p>
      ) : (
        <form onSubmit={manejarEnvio} className="flex flex-1 flex-col gap-4 px-4 pb-16 pt-[18px]">
          {/* El tipo se elige en una hoja con los tres a la vista y su
              descripción, no en una rueda nativa: cambia qué campos
              tiene la ficha, así que elegirlo a ciegas cuesta caro. */}
          <div className="flex flex-col gap-1.5">
            <span className={CLASE_ETIQUETA}>Tipo de referencia</span>
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

          <Campo etiqueta={<>Nombre <span className="text-noct-accent-300">*</span></>}>
            <input
              type="text"
              required
              autoFocus={!esEdicion}
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder={esTermino ? 'Gigabyte' : esAtajo ? 'Abrir Ejecutar' : 'Ver la configuración de red'}
              className={`min-h-11 ${CLASE_CAMPO}`}
            />
          </Campo>

          {esTermino && (
            <Campo etiqueta="Abreviatura (opcional)" ayuda="La forma corta con la que se escribe: GB, DNS, AP.">
              <input
                type="text"
                value={abreviatura}
                onChange={(e) => setAbreviatura(e.target.value)}
                placeholder="GB"
                className={`min-h-11 ${CLASE_CAMPO}`}
              />
            </Campo>
          )}

          {!esTermino && (
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
                placeholder={esAtajo ? 'Windows + R' : 'ipconfig'}
                className={`min-h-11 ${CLASE_CAMPO_MONO}`}
              />
            </Campo>
          )}

          {!esTermino && (
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

          <Campo
            etiqueta={esTermino ? 'Definición corta' : 'Notas (opcional)'}
            ayuda={esTermino ? 'Una o dos frases, prácticas y correctas.' : undefined}
          >
            <textarea
              rows={3}
              value={definicion}
              onChange={(e) => setDefinicion(e.target.value)}
              placeholder={
                esTermino ? 'Unidad de almacenamiento. Equivale a 1.000 millones de bytes.' : ''
              }
              className={`resize-y leading-[1.5] ${CLASE_CAMPO}`}
            />
          </Campo>

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

          {!esTermino && (
            <>
              <Campo etiqueta={esAtajo ? 'Qué acción realiza' : 'Cuándo utilizarlo'}>
                <textarea
                  rows={2}
                  value={cuandoUsar}
                  onChange={(e) => setCuandoUsar(e.target.value)}
                  placeholder={
                    esAtajo ? 'Abre la ventana Ejecutar de Windows.' : 'Para comprobar la IP del equipo.'
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

          {tipo === 'comando' && (
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

          <Campo
            etiqueta="Advertencia (opcional)"
            ayuda="Lo que puede salir mal si se usa sin cuidado."
          >
            <textarea
              rows={2}
              value={advertencia}
              onChange={(e) => setAdvertencia(e.target.value)}
              className={`resize-y leading-[1.5] ${CLASE_CAMPO}`}
            />
          </Campo>

          <Campo etiqueta="Categoría (opcional)" ayuda="Agrupa la ficha en el filtro: Redes, Almacenamiento, Windows.">
            <CampoConSugerencias
              valor={categoria}
              onChange={setCategoria}
              sugerencias={categoriasUsadas}
              placeholder="Redes"
              className="min-h-11"
            />
          </Campo>

          <Campo
            etiqueta="Alias o nombres alternativos (opcional)"
            ayuda="Separados por comas. Es lo que hace que buscar por la palabra que uno usa encuentre la ficha que escribió otro."
          >
            <input
              type="text"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              placeholder="AP, punto de acceso"
              className={`min-h-11 ${CLASE_CAMPO}`}
            />
          </Campo>

          <Campo etiqueta="Etiquetas (opcional)" ayuda="Separadas por comas.">
            <input
              type="text"
              value={etiquetas}
              onChange={(e) => setEtiquetas(e.target.value)}
              placeholder="red, medida"
              className={`min-h-11 ${CLASE_CAMPO}`}
            />
          </Campo>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className={CLASE_ETIQUETA}>Referencias relacionadas (opcional)</span>
              {vinculables.length > 0 && (
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
            {relacionadas.map((relacionada) => (
              <div
                key={relacionada.id}
                className="flex items-center gap-2 rounded-md border border-noct-divider bg-noct-surface px-3 py-2"
              >
                <span className="min-w-0 flex-1 truncate text-[13.5px]">{relacionada.titulo}</span>
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
            ))}
          </div>

          {esEdicion && (
            <Campo etiqueta="Motivo del cambio (opcional)">
              <input
                type="text"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Por qué se actualizó esta referencia"
                className={`min-h-11 ${CLASE_CAMPO}`}
              />
            </Campo>
          )}

          <button
            type="submit"
            disabled={guardando || titulo.trim() === ''}
            className={`mt-1 ${BTN_PRIMARIO} min-h-11 disabled:opacity-50`}
          >
            <FloppyDisk size={15} aria-hidden />
            {guardando ? 'Guardando...' : 'Guardar referencia'}
          </button>
        </form>
      )}

      <HojaTipoBloque
        abierto={hojaTipo}
        onCerrar={() => setHojaTipo(false)}
        titulo="¿Qué clase de referencia es?"
        opciones={OPCIONES_TIPO}
        seleccionado={tipo}
        onElegir={setTipo}
      />

      <HojaVinculo
        abierto={hojaRelacionada}
        onCerrar={() => setHojaRelacionada(false)}
        titulo="Vincular otra referencia"
        placeholderBuscar="Buscar en Referencia"
        grupos={[{ opciones: vinculables }]}
        onElegir={agregarRelacionada}
      />
    </Chasis>
  )
}
