import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AyudaAtajos } from '../../app/AyudaAtajos'
import { Chasis } from '../../app/Chasis'
import { CampoBusqueda } from '../../components/CampoBusqueda'
import { BotonCopiar } from '../../components/FilaDato'
import { HojaFiltro } from '../../components/HojaFiltro'
import { PastillaEstado } from '../../components/PastillaEstado'
import {
  CaretDown,
  CaretRight,
  CaretUp,
  ClockCountdown,
  Keyboard,
  Plus,
  Sliders,
  Warning,
  X,
} from '../../components/iconos'
import { BTN_SECUNDARIO } from '../../components/nocturne'
import { db, type Referencia, type TipoReferencia } from '../../lib/db'
import { conOrigen, type EstadoConOrigen } from '../../lib/origenNavegacion'
import { useAuth } from '../autenticacion/authContext'
import { usePerfilVivo } from '../autenticacion/usePerfilVivo'
import { revisarCatalogo } from './consistencia'
import { ICONO_POR_TIPO } from './iconosReferencia'
import {
  categoriasDe,
  coincidenciasPorTipo,
  esTipoConocido,
  filtrarCatalogo,
  INFO_TIPO,
  PARAMETRO_PESTANA,
  plataformasDe,
  resumenDeLista,
  TIPOS_REFERENCIA,
  tipoDePestana,
} from './referencias'

// CENTRO DE CONSULTA: LO QUE UN TECNICO NECESITA SABER, EN UN SOLO SITIO.
//
// Responde "¿que es esto?", no "¿como lo hago?" (eso son las Guias). Se
// llamaba "Referencia" y tenia dos pestañas; desde el encargo del
// 2026-09-14 organiza cuatro clases de conocimiento que se buscan
// distinto, cada una en su pestaña:
//
//   - Herramientas: los programas y plataformas del equipo (Zabbix,
//     TightVNC, SICOF ERP). Se acotan por categoria.
//   - Glosario: los conceptos tecnicos (DHCP, Byte). Por categoria.
//   - Atajos: combinaciones de teclas (Windows + R). Por programa.
//   - Comandos: ordenes escritas (ping, ipconfig). Por plataforma.
//
// Atajos y comandos compartian pestaña. Se separan porque una
// combinacion de teclas y una orden escrita no son lo mismo, y
// mezclarlas obligaba a filtrar por tipo para encontrar cualquiera.
//
// TRES REGLAS DE PANTALLA, todas medidas en 360 px:
//
//   1. Tarjetas de UNA columna en movil, con el titulo a ancho completo.
//      Nada de pastillas ni botones a su derecha comiendose el nombre,
//      que es justo el dato por el que se entra.
//   2. Los filtros viven en una hoja inferior (`HojaFiltro`), no en un
//      carrusel de chips: la cabecera pegajosa ya lleva titulo,
//      pestañas y buscador.
//   3. NADA VACIO. Sin categorias escritas no hay filtro de categoria,
//      y ningun contador se dibuja en cero.
//
// VOLVER ES VOLVER AL MISMO SITIO (regla R20). La pestaña, la busqueda y
// el filtro viven en la URL, y cada tarjeta lleva ese sitio como origen
// (`conOrigen`, mismo mecanismo que Red con su nodo): el "Volver" de la
// ficha repone la lista exactamente como estaba.

const ALCANCE: Record<TipoReferencia, string> = {
  herramienta: 'Herramientas',
  termino: 'el glosario',
  atajo: 'Atajos',
  comando: 'Comandos',
}

const MARCADOR: Record<TipoReferencia, string> = {
  herramienta: 'Buscar por nombre, uso o proveedor',
  termino: 'Buscar por nombre, abreviatura o alias',
  atajo: 'Buscar por lo que hace o por las teclas',
  comando: 'Buscar por propósito o por el comando',
}

const VACIO: Record<TipoReferencia, string> = {
  herramienta: 'Todavía no hay herramientas.',
  termino: 'Todavía no hay términos en el glosario.',
  atajo: 'Todavía no hay atajos.',
  comando: 'Todavía no hay comandos.',
}

const CREAR: Record<TipoReferencia, string> = {
  herramienta: 'Crear una herramienta',
  termino: 'Crear un término',
  atajo: 'Crear un atajo',
  comando: 'Crear un comando',
}

export function ReferenciaPage() {
  const { perfil } = useAuth()
  const perfilVivo = usePerfilVivo()
  const usuario = perfilVivo ?? perfil
  const [params, setParams] = useSearchParams()

  const tipo = tipoDePestana(params.get(PARAMETRO_PESTANA))
  const eje = INFO_TIPO[tipo].eje
  const seleccionEje = params.get(eje)
  const categoria = eje === 'categoria' ? seleccionEje : null
  const plataforma = eje === 'plataforma' ? seleccionEje : null

  // EL TEXTO BUSCADO, en estado propio y escrito en la URL con retardo
  // (mismo criterio que Guías, criterio A03). Leerlo directo de la URL
  // haría que el campo fuera por detrás de lo que se teclea, porque el
  // router aplica sus cambios como transición; y escribirlo en cada
  // tecla ensuciaría el historial.
  const qUrl = params.get('q') ?? ''
  const [consulta, setConsulta] = useState(qUrl)
  const escrita = useRef(qUrl)

  // Una navegación de fuera (la barra lateral, un enlace) cambió la
  // búsqueda de la URL sin pasar por el campo: manda la URL.
  useEffect(() => {
    if (qUrl === escrita.current) return
    escrita.current = qUrl
    setConsulta(qUrl)
  }, [qUrl])

  useEffect(() => {
    const limpio = consulta.trim()
    if (limpio === escrita.current) return
    const id = setTimeout(() => {
      escrita.current = limpio
      const siguiente = new URLSearchParams(params)
      if (limpio) siguiente.set('q', limpio)
      else siguiente.delete('q')
      setParams(siguiente, { replace: true })
    }, 400)
    return () => clearTimeout(id)
  }, [consulta, params, setParams])

  // Solo los tipos que esta versión conoce: una fila escrita por una
  // versión más nueva no aparece en ninguna pestaña en vez de romperla.
  const referencias = useLiveQuery(
    () => db.referencias.filter((r) => !r.eliminadoEn && esTipoConocido(r.tipo)).toArray(),
    [],
    [],
  )
  // Para la revisión de consistencia hacen falta TODAS (incluidas las
  // eliminadas, que es donde vive el último caso) y las guías, para
  // saber cuáles siguen vinculadas.
  const todasLasReferencias = useLiveQuery(() => db.referencias.toArray(), [], [])
  const articulos = useLiveQuery(() => db.articulos.toArray(), [], [])

  const [hojaAbierta, setHojaAbierta] = useState(false)
  const [revisionAbierta, setRevisionAbierta] = useState(false)
  const [ayudaAbierta, setAyudaAbierta] = useState(false)

  const delTipo = useMemo(() => referencias.filter((r) => r.tipo === tipo), [referencias, tipo])
  const opcionesEje = useMemo(
    () => (eje === 'categoria' ? categoriasDe(delTipo) : plataformasDe(delTipo)),
    [delTipo, eje],
  )
  const visibles = useMemo(
    () => filtrarCatalogo(referencias, { tipo, consulta, categoria, plataforma }),
    [referencias, tipo, consulta, categoria, plataforma],
  )
  const coincidencias = useMemo(() => coincidenciasPorTipo(referencias, consulta), [referencias, consulta])
  const revision = useMemo(
    () => revisarCatalogo(todasLasReferencias, articulos),
    [todasLasReferencias, articulos],
  )

  const buscando = consulta.trim() !== ''
  const hayFiltro = buscando || seleccionEje !== null
  const etiquetaEje = eje === 'categoria' ? 'Categoría' : tipo === 'atajo' ? 'Programa' : 'Plataforma'

  // El sitio exacto de la lista, con lo tecleado AUNQUE todavía no haya
  // llegado a la URL: tocar una tarjeta dentro de los 400 ms del retardo
  // no debe perder la búsqueda al volver.
  const origen = useMemo(() => {
    const sitio = new URLSearchParams()
    if (tipo !== 'herramienta') sitio.set(PARAMETRO_PESTANA, INFO_TIPO[tipo].parametro)
    if (consulta.trim()) sitio.set('q', consulta.trim())
    if (seleccionEje) sitio.set(eje, seleccionEje)
    const cadena = sitio.toString()
    return conOrigen(cadena ? `/referencia?${cadena}` : '/referencia', 'Centro de consulta')
  }, [tipo, consulta, eje, seleccionEje])

  function elegirEje(valor: string | null) {
    const siguiente = new URLSearchParams(params)
    if (valor) siguiente.set(eje, valor)
    else siguiente.delete(eje)
    setParams(siguiente, { replace: true })
  }

  // Cambiar de pestaña limpia el filtro de eje, que no significa lo mismo
  // en la otra (una plataforma no dice nada en Herramientas); la búsqueda
  // sí viaja, porque es la misma pregunta hecha en otro sitio.
  function irA(destino: TipoReferencia) {
    if (destino === tipo) return
    const siguiente = new URLSearchParams(params)
    if (destino === 'herramienta') siguiente.delete(PARAMETRO_PESTANA)
    else siguiente.set(PARAMETRO_PESTANA, INFO_TIPO[destino].parametro)
    siguiente.delete('categoria')
    siguiente.delete('plataforma')
    const limpio = consulta.trim()
    if (limpio) siguiente.set('q', limpio)
    else siguiente.delete('q')
    escrita.current = limpio
    setParams(siguiente, { replace: true })
    setHojaAbierta(false)
  }

  return (
    // Nivel 2 del chasis: documento. El Centro de consulta es un
    // registro que se consulta y se recorre, no una tarea de la que se
    // sale, así que conserva la barra de pestañas (R19).
    <Chasis
      modo="documento"
      volverA="/mas"
      volverEtiqueta="Más"
      acciones={
        <Link to={`/referencia/nueva?tipo=${tipo}`} className={`shrink-0 ${BTN_SECUNDARIO}`}>
          <Plus size={15} aria-hidden />
          Crear
        </Link>
      }
      barra={
        <>
          <div className="px-4 pb-2 pt-0.5">
            <h1 className="m-0 text-[22px] font-medium leading-[1.25]">Centro de consulta</h1>
            <p className="mt-[3px] text-[12.5px] text-noct-neutral-500">
              Herramientas, conceptos, atajos y comandos del equipo
            </p>
          </div>

          {/* Cuatro pestañas en una fila. A 360 px caben con sitio
              (Herramientas es la más ancha, unos 95 px); si alguna vez
              no cupieran, la fila se desplaza en vez de recortar un
              nombre. */}
          <div
            role="tablist"
            aria-label="Secciones del Centro de consulta"
            className="flex overflow-x-auto px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {TIPOS_REFERENCIA.map((valor) => (
              <PestanaBoton
                key={valor}
                activa={valor === tipo}
                onClick={() => irA(valor)}
                etiqueta={INFO_TIPO[valor].pestana}
              />
            ))}
          </div>

          <div className="flex flex-col gap-2 px-4 pb-3 pt-2.5">
            <CampoBusqueda
              valor={consulta}
              onCambiar={setConsulta}
              alcance={ALCANCE[tipo]}
              textoAlternativo={MARCADOR[tipo]}
            />

            {/* El filtro solo existe cuando hay algo que filtrar
                (regla 3): sin categorías o plataformas escritas en esta
                pestaña, no hay botón. */}
            {opcionesEje.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <BotonFiltro
                  etiqueta={etiquetaEje}
                  valor={seleccionEje}
                  onAbrir={() => setHojaAbierta(true)}
                  onLimpiar={() => elegirEje(null)}
                />
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
            suelta: las fichas eliminadas que siguen vinculadas a una
            guía. */}
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
                    state={origen}
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
        {tipo === 'atajo' && !hayFiltro && (
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
          visibles.map((referencia) =>
            referencia.tipo === 'atajo' || referencia.tipo === 'comando' ? (
              <TarjetaTeclas key={referencia.id} referencia={referencia} origen={origen} />
            ) : (
              <TarjetaConsulta key={referencia.id} referencia={referencia} origen={origen} />
            ),
          )
        ) : (
          <Vacio
            tipo={tipo}
            hayFiltro={hayFiltro}
            buscando={buscando}
            coincidencias={coincidencias}
            onIrA={irA}
          />
        )}
      </main>

      <AyudaAtajos
        abierto={ayudaAbierta}
        onCerrar={() => setAyudaAbierta(false)}
        puedeVerBoveda={Boolean(usuario?.puedeVerBoveda)}
      />

      <HojaFiltro
        abierto={hojaAbierta}
        onCerrar={() => setHojaAbierta(false)}
        titulo={eje === 'categoria' ? 'Filtrar por categoría' : 'Filtrar por plataforma o programa'}
        opciones={opcionesEje.map((valor) => ({
          valor,
          etiqueta: valor,
          count: delTipo.filter((r) => (eje === 'categoria' ? r.categoria : r.plataforma) === valor).length,
        }))}
        seleccionada={seleccionEje}
        onElegir={elegirEje}
        onLimpiar={() => elegirEje(null)}
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
      className={`flex h-[52px] flex-1 items-center justify-center whitespace-nowrap border-b-[2.5px] px-1.5 text-[13.5px] font-medium transition-colors ${
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

// UNA HERRAMIENTA O UN TÉRMINO: SE CONSULTA, ASÍ QUE LA TARJETA ENTERA ABRE.
//
// El icono va arriba a la izquierda en su propia línea, junto a la
// categoría (y el proveedor de una herramienta, o la abreviatura de un
// término); el nombre ocupa el renglón entero y puede envolver en dos
// líneas. Con el nombre y una pastilla en la misma fila, "Gigabits por
// segundo" se recortaba a "Gigabits por…" en 360 px.
//
// Una herramienta cuyo uso solo está documentado lo dice ya en la lista:
// un técnico nuevo no debe salir de aquí creyendo que se usa hoy.
function TarjetaConsulta({ referencia, origen }: { referencia: Referencia; origen: EstadoConOrigen }) {
  const Icono = ICONO_POR_TIPO[referencia.tipo]
  const resumen = resumenDeLista(referencia)
  const esHerramienta = referencia.tipo === 'herramienta'
  const meta = (
    esHerramienta
      ? [referencia.categoria, referencia.proveedor]
      : [referencia.abreviatura, referencia.categoria]
  ).filter((valor) => valor && valor.trim() !== '')

  return (
    <Link
      to={`/referencia/${referencia.id}`}
      state={origen}
      className="flex flex-col gap-1.5 rounded-lg border border-noct-divider bg-noct-surface p-3 text-noct-text transition-colors hover:bg-noct-text/[.04]"
    >
      {meta.length > 0 && (
        <span className="flex items-start gap-2 text-[11px] font-medium uppercase tracking-[.06em] text-noct-neutral-400">
          <Icono size={14} className="shrink-0 text-noct-accent-300" aria-hidden />
          <span className="min-w-0">{meta.join(' · ')}</span>
        </span>
      )}
      <span className="flex items-start gap-2">
        {meta.length === 0 && (
          <Icono size={16} className="mt-[3px] shrink-0 text-noct-accent-300" aria-hidden />
        )}
        <span className="min-w-0 flex-1 text-pretty text-[15.5px] font-medium leading-[1.3]">
          {referencia.titulo}
          {esHerramienta && referencia.abreviatura && (
            <span className="font-normal text-noct-neutral-400"> ({referencia.abreviatura})</span>
          )}
        </span>
        <CaretRight size={14} className="mt-1 shrink-0 text-noct-neutral-600" aria-hidden />
      </span>
      {resumen && <span className="text-pretty text-[13px] leading-normal text-noct-neutral-300">{resumen}</span>}
      {esHerramienta && referencia.estadoUso === 'documentado' && (
        <PastillaEstado tono="neutro" Icono={ClockCountdown} className="self-start">
          Vigencia por confirmar
        </PastillaEstado>
      )}
    </Link>
  )
}

// UN ATAJO O UN COMANDO: SE USA, ASÍ QUE LO QUE SE TECLEA VA A LA VISTA.
//
// El orden es el del encargo: qué hace (el nombre), la combinación o el
// comando, y cuándo sirve. "Copiar" se copia sin abrir la ficha.
//
// El enlace cubre la tarjeta entera con su `::after` y el botón de copiar
// queda por encima (`relative z-[1]`): así toda la tarjeta abre la ficha
// sin meter un botón dentro de un enlace, que es HTML inválido y los
// lectores de pantalla anuncian mal.
function TarjetaTeclas({ referencia, origen }: { referencia: Referencia; origen: EstadoConOrigen }) {
  const Icono = ICONO_POR_TIPO[referencia.tipo]
  const esAtajo = referencia.tipo === 'atajo'
  const resumen = resumenDeLista(referencia)
  const valor = referencia.valor.trim()

  return (
    <div className="relative flex flex-col gap-2 rounded-lg border border-noct-divider bg-noct-surface p-3 text-noct-text transition-colors hover:bg-noct-text/[.04] has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-noct-accent">
      {referencia.plataforma && (
        <span className="flex items-start gap-2 text-[11px] font-medium uppercase tracking-[.06em] text-noct-neutral-400">
          <Icono size={14} className="shrink-0 text-noct-accent-300" aria-hidden />
          <span className="min-w-0">{referencia.plataforma}</span>
        </span>
      )}
      <span className="flex items-start gap-2">
        {!referencia.plataforma && (
          <Icono size={16} className="mt-[3px] shrink-0 text-noct-accent-300" aria-hidden />
        )}
        <Link
          to={`/referencia/${referencia.id}`}
          state={origen}
          className="min-w-0 flex-1 text-pretty text-[15.5px] font-medium leading-[1.3] outline-none after:absolute after:inset-0 after:rounded-lg"
        >
          {referencia.titulo}
        </Link>
        <CaretRight size={14} className="mt-1 shrink-0 text-noct-neutral-600" aria-hidden />
      </span>
      {valor && (
        <span className="flex items-center gap-2">
          {/* 14 px monoespaciado: se lee carácter a carácter (regla M-R5). */}
          <code className="min-w-0 flex-1 break-all rounded-md bg-noct-bg px-2.5 py-2 font-mono text-[14px] leading-[1.35] text-noct-text">
            {valor}
          </code>
          <span className="relative z-[1]">
            <BotonCopiar etiqueta={esAtajo ? 'Combinación' : 'Comando'} texto={valor} conTexto />
          </span>
        </span>
      )}
      {resumen && <span className="text-pretty text-[13px] leading-normal text-noct-neutral-300">{resumen}</span>}
    </div>
  )
}

function Vacio({
  tipo,
  hayFiltro,
  buscando,
  coincidencias,
  onIrA,
}: {
  tipo: TipoReferencia
  hayFiltro: boolean
  buscando: boolean
  coincidencias: Record<TipoReferencia, number>
  onIrA: (tipo: TipoReferencia) => void
}) {
  const Icono = ICONO_POR_TIPO[tipo]
  // Quien busca "zabbix" en el Glosario tiene que enterarse de que está
  // en Herramientas, sin volver a escribirlo en cada pestaña.
  const enOtras = buscando ? TIPOS_REFERENCIA.filter((otro) => otro !== tipo && coincidencias[otro] > 0) : []

  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-noct-neutral-700 px-6 py-10 text-center">
      <Icono size={30} className="text-noct-neutral-600" aria-hidden />
      <p className="text-[13px] leading-[1.5] text-noct-neutral-400">
        {hayFiltro ? 'Nada coincide aquí con la búsqueda o el filtro.' : VACIO[tipo]}
      </p>
      {enOtras.length > 0 && (
        <div className="flex flex-col items-center gap-2">
          <p className="text-[13px] leading-[1.5] text-noct-neutral-300">Sí hay coincidencias en:</p>
          <div className="flex flex-wrap justify-center gap-2">
            {enOtras.map((otro) => (
              <button key={otro} type="button" onClick={() => onIrA(otro)} className={BTN_SECUNDARIO}>
                {INFO_TIPO[otro].pestana}
                <span className="font-mono tabular-nums text-noct-neutral-400">{coincidencias[otro]}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {!hayFiltro && (
        <Link to={`/referencia/nueva?tipo=${tipo}`} className={BTN_SECUNDARIO}>
          <Plus size={15} aria-hidden />
          {CREAR[tipo]}
        </Link>
      )}
    </div>
  )
}
