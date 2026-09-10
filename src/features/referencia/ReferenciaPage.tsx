import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Chasis } from '../../app/Chasis'
import { CampoBusqueda } from '../../components/CampoBusqueda'
import { HojaFiltro, type OpcionHoja } from '../../components/HojaFiltro'
import {
  BookBookmark,
  CaretDown,
  CaretRight,
  CaretUp,
  Keyboard,
  Plus,
  Sliders,
  TerminalWindow,
  Warning,
  X,
  type IconoProps,
} from '../../components/iconos'
import { BTN_SECUNDARIO } from '../../components/nocturne'
import { db, type Referencia, type TipoReferencia } from '../../lib/db'
import {
  categoriasDe,
  filtrarComandos,
  filtrarGlosario,
  INFO_TIPO,
  plataformasDe,
  resumenDeLista,
} from './referencias'
import { revisarCatalogo } from './consistencia'
import { AyudaAtajos } from '../../app/AyudaAtajos'
import { useAuth } from '../autenticacion/authContext'
import { usePerfilVivo } from '../autenticacion/usePerfilVivo'

// REFERENCIA: EL VOCABULARIO Y LOS ATAJOS DEL EQUIPO, EN UN SOLO SITIO.
//
// Dos pestañas y ni una mas: "Glosario" (los terminos) y "Atajos y
// comandos" (lo que se teclea). Son dos preguntas distintas y se
// responden con filtros distintos: un termino se busca por su nombre,
// su abreviatura o el alias con el que uno lo llama, y se acota por
// categoria; un atajo se busca ademas por la combinacion de teclas o
// por el comando entero, y se acota por programa.
//
// TRES REGLAS DE PANTALLA, todas del encargo y todas medidas en 360 px:
//
//   1. Tarjetas de UNA columna en movil, con el titulo a ancho completo.
//      Nada de pastillas ni botones a su derecha comiendose el nombre,
//      que es justo el dato por el que se entra.
//   2. Los filtros viven en una hoja inferior (`HojaFiltro`), no en un
//      carrusel de chips: la cabecera pegajosa ya lleva titulo,
//      pestañas y buscador.
//   3. NADA VACIO. Si no hay categorias escritas, no hay filtro de
//      categoria; si no hay atajos, no aparece su filtro de tipo; y
//      ningun contador se dibuja en cero.

type Pestana = 'glosario' | 'comandos'

const CLAVE_PESTANA = 'tab'

const ICONO_POR_TIPO: Record<TipoReferencia, (props: IconoProps) => React.JSX.Element> = {
  termino: BookBookmark,
  atajo: Keyboard,
  comando: TerminalWindow,
}

export function ReferenciaPage() {
  const { perfil } = useAuth()
  const perfilVivo = usePerfilVivo()
  const usuario = perfilVivo ?? perfil
  const [params, setParams] = useSearchParams()
  const pestana: Pestana = params.get(CLAVE_PESTANA) === 'comandos' ? 'comandos' : 'glosario'

  const referencias = useLiveQuery(() => db.referencias.filter((r) => !r.eliminadoEn).toArray(), [], [])
  // Para la revisión de consistencia hacen falta TODAS (incluidas las
  // eliminadas, que es donde vive el último caso) y las guías, para
  // saber cuáles siguen vinculadas.
  const todasLasReferencias = useLiveQuery(() => db.referencias.toArray(), [], [])
  const articulos = useLiveQuery(() => db.articulos.toArray(), [], [])

  const [consulta, setConsulta] = useState('')
  const [categoria, setCategoria] = useState<string | null>(null)
  const [tipo, setTipo] = useState<TipoReferencia | null>(null)
  const [plataforma, setPlataforma] = useState<string | null>(null)
  const [hoja, setHoja] = useState<'categoria' | 'tipo' | 'plataforma' | null>(null)
  const [revisionAbierta, setRevisionAbierta] = useState(false)
  const [ayudaAbierta, setAyudaAbierta] = useState(false)

  const terminos = useMemo(() => referencias.filter((r) => r.tipo === 'termino'), [referencias])
  const comandos = useMemo(() => referencias.filter((r) => r.tipo !== 'termino'), [referencias])

  const categorias = useMemo(() => categoriasDe(terminos), [terminos])
  const plataformas = useMemo(() => plataformasDe(comandos), [comandos])

  const visiblesGlosario = useMemo(
    () => filtrarGlosario(terminos, { consulta, categoria }),
    [terminos, consulta, categoria],
  )
  const visiblesComandos = useMemo(
    () => filtrarComandos(comandos, { consulta, tipo, plataforma }),
    [comandos, consulta, tipo, plataforma],
  )

  const revision = useMemo(
    () => revisarCatalogo(todasLasReferencias, articulos),
    [todasLasReferencias, articulos],
  )

  const visibles = pestana === 'glosario' ? visiblesGlosario : visiblesComandos
  const hayFiltro = consulta.trim() !== '' || categoria !== null || tipo !== null || plataforma !== null

  // Cambiar de pestaña limpia lo que no aplica a la otra: un filtro de
  // plataforma no significa nada en el glosario, y dejarlo puesto e
  // invisible haria que la lista pareciera vacia sin motivo.
  function irA(destino: Pestana) {
    if (destino === pestana) return
    const siguiente = new URLSearchParams(params)
    if (destino === 'glosario') siguiente.delete(CLAVE_PESTANA)
    else siguiente.set(CLAVE_PESTANA, destino)
    setParams(siguiente, { replace: true })
    setCategoria(null)
    setTipo(null)
    setPlataforma(null)
    setHoja(null)
  }

  const opcionesTipo: OpcionHoja<TipoReferencia>[] = (['atajo', 'comando'] as const)
    .map((valor) => ({
      valor,
      etiqueta: INFO_TIPO[valor].plural,
      Icono: ICONO_POR_TIPO[valor],
      count: comandos.filter((r) => r.tipo === valor).length,
    }))
    .filter((opcion) => opcion.count > 0)

  return (
    // Nivel 2 del chasis: documento. Referencia es un registro que se
    // consulta y se recorre, no una tarea de la que se sale, así que
    // conserva la barra de pestañas (R19).
    <Chasis
      modo="documento"
      volverA="/mas"
      volverEtiqueta="Más"
      acciones={
        <Link
          to={`/referencia/nueva?tipo=${pestana === 'glosario' ? 'termino' : 'comando'}`}
          className={`shrink-0 ${BTN_SECUNDARIO}`}
        >
          <Plus size={15} aria-hidden />
          Crear
        </Link>
      }
      barra={
        <>
          <div className="px-4 pb-2 pt-0.5">
            <h1 className="m-0 text-[22px] font-medium leading-[1.25]">Referencia</h1>
            <p className="mt-[3px] text-[12.5px] text-noct-neutral-500">
              El vocabulario, los atajos y los comandos del equipo
            </p>
          </div>

          <div role="tablist" aria-label="Secciones de Referencia" className="flex px-2">
            <PestanaBoton
              activa={pestana === 'glosario'}
              onClick={() => irA('glosario')}
              etiqueta="Glosario"
            />
            <PestanaBoton
              activa={pestana === 'comandos'}
              onClick={() => irA('comandos')}
              etiqueta="Atajos y comandos"
            />
          </div>

          <div className="flex flex-col gap-2 px-4 pb-3 pt-2.5">
            <CampoBusqueda
              valor={consulta}
              onCambiar={setConsulta}
              alcance={pestana === 'glosario' ? 'el glosario' : 'atajos y comandos'}
              textoAlternativo={
                pestana === 'glosario'
                  ? 'Buscar por nombre, abreviatura o alias'
                  : 'Buscar por nombre, valor o programa'
              }
            />

            {/* Los filtros solo existen cuando hay algo que filtrar
                (regla 3): sin categorías escritas no hay filtro de
                categoría, y con un solo tipo tampoco hay filtro de tipo. */}
            {pestana === 'glosario'
              ? categorias.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    <BotonFiltro
                      etiqueta="Categoría"
                      valor={categoria}
                      onAbrir={() => setHoja('categoria')}
                      onLimpiar={() => setCategoria(null)}
                    />
                  </div>
                )
              : (opcionesTipo.length > 1 || plataformas.length > 0) && (
                  <div className="flex flex-wrap gap-2">
                    {opcionesTipo.length > 1 && (
                      <BotonFiltro
                        etiqueta="Tipo"
                        valor={tipo ? INFO_TIPO[tipo].plural : null}
                        onAbrir={() => setHoja('tipo')}
                        onLimpiar={() => setTipo(null)}
                      />
                    )}
                    {plataformas.length > 0 && (
                      <BotonFiltro
                        etiqueta="Plataforma"
                        valor={plataforma}
                        onAbrir={() => setHoja('plataforma')}
                        onLimpiar={() => setPlataforma(null)}
                      />
                    )}
                  </div>
                )}
          </div>
        </>
      }
    >
      <main className="flex flex-1 flex-col gap-2 px-4 pb-12 pt-3.5">
        {/* REVISIÓN DE CONSISTENCIA DEL CATÁLOGO. Solo aparece si hay
            algo que revisar: un panel que dice "0 problemas" enseña a
            ignorarlo. Incluye lo único que no se ve desde una ficha
            suelta: las referencias eliminadas que siguen vinculadas a
            una guía. */}
        {revision.length > 0 && (
          <div className="mb-1.5 flex flex-col gap-2 rounded-lg border border-noct-precaucion/35 bg-noct-precaucion/[.08] p-3">
            <button
              type="button"
              onClick={() => setRevisionAbierta((v) => !v)}
              aria-expanded={revisionAbierta}
              className="flex min-h-11 items-center gap-2.5 text-left"
            >
              <Warning size={16} className="shrink-0 text-noct-precaucion" aria-hidden />
              <span className="min-w-0 flex-1 text-[13px] font-medium leading-snug">
                {revision.length === 1
                  ? 'Hay 1 inconsistencia por revisar'
                  : `Hay ${revision.length} inconsistencias por revisar`}
              </span>
              {revisionAbierta ? (
                <CaretUp size={14} className="shrink-0 text-noct-neutral-400" aria-hidden />
              ) : (
                <CaretDown size={14} className="shrink-0 text-noct-neutral-400" aria-hidden />
              )}
            </button>
            {revisionAbierta && (
              <div className="flex flex-col">
                {revision.map((aviso, indice) => (
                  <Link
                    key={`${aviso.clave}-${aviso.referenciaId}-${indice}`}
                    to={`/referencia/${aviso.referenciaId}`}
                    className="flex min-h-[46px] flex-col justify-center rounded-md px-1.5 py-2 hover:bg-noct-text/[.06]"
                  >
                    <span className="text-[12.5px] font-medium text-noct-text">
                      {aviso.referenciaTitulo}
                    </span>
                    <span className="mt-0.5 text-pretty text-[12px] leading-snug text-noct-neutral-300">
                      {aviso.texto}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* LOS ATAJOS DE LA PROPIA APLICACIÓN, junto a los del resto de
            programas: para el técnico son lo mismo, cosas que se teclean
            para ir más rápido. Es además la única entrada visible que
            tienen, porque "?" solo lo encuentra quien ya sabe que
            existe. Sin filtro puesto, para no aparecer como si fuera un
            resultado de la búsqueda. */}
        {pestana === 'comandos' && !hayFiltro && (
          <button
            type="button"
            onClick={() => setAyudaAbierta(true)}
            aria-haspopup="dialog"
            className="flex flex-col gap-1.5 rounded-lg border border-noct-divider bg-noct-surface p-3 text-left text-noct-text transition-colors hover:bg-noct-text/[.04]"
          >
            <span className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[.06em] text-noct-neutral-400">
              <Keyboard size={14} className="shrink-0 text-noct-accent-300" aria-hidden />
              Soluciones IT
            </span>
            <span className="flex items-start gap-2">
              <span className="min-w-0 flex-1 text-pretty text-[15.5px] font-medium leading-[1.3]">
                Atajos de la aplicación
              </span>
              <CaretRight size={14} className="mt-1 shrink-0 text-noct-neutral-600" aria-hidden />
            </span>
            <span className="text-pretty text-[13px] leading-normal text-noct-neutral-300">
              Buscar, pedir ayuda e ir a una sección sin soltar el teclado
            </span>
          </button>
        )}

        {visibles.length > 0 ? (
          visibles.map((referencia) => <TarjetaReferencia key={referencia.id} referencia={referencia} />)
        ) : (
          <Vacio pestana={pestana} hayFiltro={hayFiltro} />
        )}
      </main>

      <AyudaAtajos
        abierto={ayudaAbierta}
        onCerrar={() => setAyudaAbierta(false)}
        puedeVerBoveda={Boolean(usuario?.puedeVerBoveda)}
      />

      <HojaFiltro
        abierto={hoja === 'categoria'}
        onCerrar={() => setHoja(null)}
        titulo="Filtrar por categoría"
        opciones={categorias.map((c) => ({
          valor: c,
          etiqueta: c,
          count: terminos.filter((r) => r.categoria === c).length,
        }))}
        seleccionada={categoria}
        onElegir={setCategoria}
        onLimpiar={() => setCategoria(null)}
      />

      <HojaFiltro
        abierto={hoja === 'tipo'}
        onCerrar={() => setHoja(null)}
        titulo="Atajos o comandos"
        opciones={opcionesTipo}
        seleccionada={tipo}
        onElegir={setTipo}
        onLimpiar={() => setTipo(null)}
      />

      <HojaFiltro
        abierto={hoja === 'plataforma'}
        onCerrar={() => setHoja(null)}
        titulo="Filtrar por plataforma o programa"
        opciones={plataformas.map((p) => ({
          valor: p,
          etiqueta: p,
          count: comandos.filter((r) => r.plataforma === p).length,
        }))}
        seleccionada={plataforma}
        onElegir={setPlataforma}
        onLimpiar={() => setPlataforma(null)}
      />
    </Chasis>
  )
}

function PestanaBoton({
  activa,
  onClick,
  etiqueta,
}: {
  activa: boolean
  onClick: () => void
  etiqueta: string
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={activa}
      onClick={onClick}
      className={`flex h-[52px] flex-1 items-center justify-center border-b-[2.5px] px-1 text-[13.5px] font-medium transition-colors ${
        activa
          ? 'border-noct-accent text-noct-accent-300'
          : 'border-transparent text-noct-neutral-400 hover:text-noct-text'
      }`}
    >
      {etiqueta}
    </button>
  )
}

// El control que abre una hoja de filtro y, cuando hay algo elegido, lo
// dice y ofrece quitarlo sin abrir la hoja. La "x" mide 44 px reales
// (regla R6): quitar un filtro es el gesto que más se repite.
function BotonFiltro({
  etiqueta,
  valor,
  onAbrir,
  onLimpiar,
}: {
  etiqueta: string
  valor: string | null
  onAbrir: () => void
  onLimpiar: () => void
}) {
  const activo = valor !== null
  return (
    <span
      className={`inline-flex items-center rounded-lg border ${
        activo ? 'border-noct-accent bg-noct-accent/[.12]' : 'border-noct-divider'
      }`}
    >
      <button
        type="button"
        onClick={onAbrir}
        aria-haspopup="dialog"
        className={`flex min-h-11 items-center gap-2 px-3 text-[13px] font-medium ${
          activo ? 'text-noct-accent-300' : 'text-noct-neutral-300'
        }`}
      >
        <Sliders size={15} className="shrink-0" aria-hidden />
        {activo ? valor : etiqueta}
      </button>
      {activo && (
        <button
          type="button"
          onClick={onLimpiar}
          aria-label={`Quitar el filtro de ${etiqueta.toLowerCase()}`}
          className="flex h-11 w-9 shrink-0 items-center justify-center text-noct-accent-300 hover:text-noct-text"
        >
          <X size={14} aria-hidden />
        </button>
      )}
    </span>
  )
}

// LA TARJETA: UNA COLUMNA Y EL TÍTULO A ANCHO COMPLETO.
//
// El icono va arriba a la izquierda en su propia línea, junto a la
// abreviatura o la plataforma; el nombre ocupa el renglón entero y
// puede envolver en dos líneas. Con el nombre y una pastilla en la
// misma fila, "Gigabits por segundo" se recortaba a "Gigabits por…" en
// 360 px, que es exactamente el ancho del teléfono del equipo.
function TarjetaReferencia({ referencia }: { referencia: Referencia }) {
  const Icono = ICONO_POR_TIPO[referencia.tipo]
  const resumen = resumenDeLista(referencia)
  const esValor = referencia.tipo !== 'termino' && referencia.valor.trim() !== ''
  const meta = [
    referencia.tipo === 'termino' ? referencia.abreviatura : referencia.plataforma,
    referencia.tipo === 'termino' ? referencia.categoria : INFO_TIPO[referencia.tipo].etiqueta,
  ].filter((valor) => valor && valor.trim() !== '')

  return (
    <Link
      to={`/referencia/${referencia.id}`}
      className="flex flex-col gap-1.5 rounded-lg border border-noct-divider bg-noct-surface p-3 text-noct-text transition-colors hover:bg-noct-text/[.04]"
    >
      {meta.length > 0 && (
        <span className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[.06em] text-noct-neutral-400">
          <Icono size={14} className="shrink-0 text-noct-accent-300" aria-hidden />
          {meta.join(' · ')}
        </span>
      )}
      <span className="flex items-start gap-2">
        {meta.length === 0 && (
          <Icono size={16} className="mt-[3px] shrink-0 text-noct-accent-300" aria-hidden />
        )}
        <span className="min-w-0 flex-1 text-pretty text-[15.5px] font-medium leading-[1.3]">
          {referencia.titulo}
        </span>
        <CaretRight size={14} className="mt-1 shrink-0 text-noct-neutral-600" aria-hidden />
      </span>
      {resumen && (
        <span
          className={`text-pretty leading-normal text-noct-neutral-300 ${
            esValor ? 'font-mono text-[13px]' : 'text-[13px]'
          }`}
        >
          {resumen}
        </span>
      )}
    </Link>
  )
}

function Vacio({ pestana, hayFiltro }: { pestana: Pestana; hayFiltro: boolean }) {
  const Icono = pestana === 'glosario' ? BookBookmark : TerminalWindow
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-noct-neutral-700 px-6 py-10 text-center">
      <Icono size={30} className="text-noct-neutral-600" aria-hidden />
      <p className="text-[13px] leading-[1.5] text-noct-neutral-400">
        {hayFiltro
          ? 'Nada coincide con la búsqueda o el filtro.'
          : pestana === 'glosario'
            ? 'Todavía no hay términos en el glosario.'
            : 'Todavía no hay atajos ni comandos.'}
      </p>
      {!hayFiltro && (
        <Link
          to={`/referencia/nueva?tipo=${pestana === 'glosario' ? 'termino' : 'comando'}`}
          className={BTN_SECUNDARIO}
        >
          <Plus size={15} aria-hidden />
          {pestana === 'glosario' ? 'Crear un término' : 'Crear un comando'}
        </Link>
      )}
    </div>
  )
}
