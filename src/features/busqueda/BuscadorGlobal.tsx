import { useLiveQuery } from 'dexie-react-hooks'
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { CaretLeft, MagnifyingGlass, Plus } from '../../components/iconos'
import { useAltoDelTeclado } from '../../components/useAltoDelTeclado'
import { CampoBusqueda } from '../../components/CampoBusqueda'
import { EsqueletoBusqueda } from '../../components/Esqueleto'
import { ANCHO_ESCRITORIO, useEsAncho } from '../../components/useEsAncho'
import { BTN_SECUNDARIO } from '../../components/nocturne'
import { db } from '../../lib/db'
import { normalizarTexto } from '../soluciones/iconosSoluciones'
import type { ModoBuscador } from './modoConsulta'
import { alcanceEfectivo, conteoPorAlcance, filtrarPorAlcance, type Alcance } from './alcanceBusqueda'
import { ChipsDeAlcance } from './ChipsDeAlcance'
import { useIdsDeRed } from './useIdsDeRed'
import { PuenteBoveda } from './PuenteBoveda'
import { ProveedorRanuraVistaRapida } from './ranuraVistaRapida'
import { AYUDA_BUSCADOR, MARCADOR_BUSCADOR } from './resultados'
import { ResultadosBusqueda } from './ResultadosBusqueda'
import { buscar, useIndiceBusqueda } from './useIndiceBusqueda'

// Buscador global en capa (tarea 181, mockup 3d del handoff). Hasta
// ahora buscar era global pero vivia DENTRO de Inicio: desde cualquier
// otra pestaña habia que volver a Inicio y perder el sitio donde se
// estaba. Ahora la lupa vive en la barra superior de las cinco pestañas
// y abre esta capa sin abandonar la pantalla (regla R14).
//
// Declara su alcance por escrito, que es la otra mitad del problema: la
// app tenia cinco buscadores con la misma forma y cinco alcances
// distintos, y nada decia cual era cual.

// DOS MODOS (encargo del 2026-09-16, secciones 8 a 11). Abierta desde una
// sección, la capa es la de siempre: un resultado lleva a su ficha, una
// guía se empieza. Abierta encima de una TAREA (la ejecución de una guía,
// un editor) es de CONSULTA: nada navega, las fichas se consultan en su
// vista rápida dentro de la capa y ninguna acción abre otra ejecución.
// Cerrarla deja la tarea de debajo exactamente como estaba, porque la
// capa vive en un portal y nunca la desmonta. Las reglas, en
// `modoConsulta.ts`.

export function BuscadorGlobal({
  abierto,
  onCerrar,
  onNavegar,
  modo = 'normal',
  consultaInicial = '',
}: {
  abierto: boolean
  /** El técnico cierra la capa (la X, Escape). */
  onCerrar: () => void
  /**
   * La capa se cierra porque un resultado lleva a otra pantalla. Separado
   * de `onCerrar` para que quien repone búsquedas sepa distinguir "la dio
   * por terminada" de "se fue a mirar un resultado y va a volver". Sin él,
   * se usa `onCerrar`.
   */
  onNavegar?: () => void
  /** Normal o consulta (encima de una tarea). */
  modo?: ModoBuscador
  /** La búsqueda a reponer al abrir, al volver de una ficha (sección 13). */
  consultaInicial?: string
}) {
  const [query, setQuery] = useState(consultaInicial)
  // La boveda se abrio desde el puente, sin salir de esta capa: cuenta
  // una interaccion mas en la medicion del recorrido (seccion 17).
  const [huboDesbloqueo, setHuboDesbloqueo] = useState(false)
  const campo = useRef<HTMLInputElement>(null)

  // Mismo criterio que Inicio: el input usa `query` directo y todo lo
  // derivado usa la version diferida, para que escribir se sienta
  // instantaneo aunque la busqueda tarde algo mas en ponerse al dia.
  const queryDiferida = useDeferredValue(query)
  const consultaCruda = queryDiferida.trim()
  const consulta = normalizarTexto(consultaCruda)
  const buscando = consultaCruda.length > 0

  const indice = useIndiceBusqueda()
  const resultados = useMemo(() => buscar(indice, queryDiferida), [indice, queryDiferida])
  // ¿YA SE LEYÓ LA COPIA LOCAL? (tarea 342) El índice nace de listas vacías
  // mientras Dexie lee, y una búsqueda escrita en ese instante diría "Nada
  // coincide" sin haber mirado. Hasta que las dos tablas que más pesan se
  // hayan leído (dos lecturas seguidas, detrás de las del índice), la capa
  // enseña su esqueleto. El índice no cambia.
  const copiaLeida = useLiveQuery(
    async () => {
      await db.articulos.count()
      await db.dispositivos.count()
      return true
    },
    [],
    false,
  )
  // EL ALCANCE (tarea 330): solo filtra lo que ya se encontró.
  const [alcanceElegido, setAlcance] = useState<Alcance>('todo')
  const idsDeRed = useIdsDeRed()
  const conteo = useMemo(() => conteoPorAlcance(resultados, idsDeRed), [resultados, idsDeRed])
  const alcance = alcanceEfectivo(alcanceElegido, conteo)
  const visibles = useMemo(() => filtrarPorAlcance(resultados, alcance, idsDeRed), [resultados, alcance, idsDeRed])
  const teclado = useAltoDelTeclado()
  // Desde 768 el campo va arriba; desde 1280 la capa es una paleta con la
  // vista rápida al lado (tarea 339, T6). Son puntos de montaje distintos.
  const ancho = useEsAncho()
  const escritorio = useEsAncho(ANCHO_ESCRITORIO)
  const [ranuraVista, setRanuraVista] = useState<HTMLElement | null>(null)

  // `onCerrar` llega como flecha nueva en cada render de quien abre la
  // capa. Leerlo de una ref deja el efecto de abajo atado SOLO a abrir y
  // cerrar: antes se volvía a ejecutar con cada render del padre y
  // devolvía el foco al campo de búsqueda, robándoselo a la contraseña
  // maestra o a la vista rápida que el técnico estaba usando.
  const alCerrar = useRef(onCerrar)
  useEffect(() => {
    alCerrar.current = onCerrar
  })
  const repone = useRef(consultaInicial !== '')

  useEffect(() => {
    if (!abierto) return
    function alTeclado(evento: KeyboardEvent) {
      if (evento.key === 'Escape') alCerrar.current()
    }
    document.addEventListener('keydown', alTeclado)
    const overflowPrevio = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // El teclado del telefono debe abrirse solo: quien toca la lupa ya
    // decidio que va a escribir. No al reponer una busqueda al volver de
    // una ficha: ahi el tecnico viene a mirar los resultados, y el
    // teclado le taparia la mitad.
    if (!repone.current) campo.current?.focus()
    return () => {
      document.removeEventListener('keydown', alTeclado)
      document.body.style.overflow = overflowPrevio
    }
  }, [abierto])

  // La consulta no sobrevive al cierre: la capa se abre siempre limpia,
  // porque se invoca desde cualquier pestaña y arrastrar la busqueda
  // anterior confundiria mas de lo que ahorra. La unica excepcion es
  // `consultaInicial`: volver de una ficha que se abrio desde aqui
  // (seccion 13 del encargo del 2026-09-16), que no es abrir de nuevo
  // sino seguir donde se estaba.
  useEffect(() => {
    if (!abierto) {
      setQuery('')
      setHuboDesbloqueo(false)
      setAlcance('todo')
    }
  }, [abierto])

  if (!abierto) return null

  const titulo = modo === 'consulta' ? 'Consultar sin salir de la tarea' : 'Buscar en Soluciones IT'

  // EL MISMO CAMPO, EN UN SOLO SITIO (tarea 339, T6): abajo, al pulgar, en el
  // teléfono; arriba desde 768 (la tableta tiene el teclado abajo y el campo
  // arriba no queda tapado); y desde 1280, la cabecera de la paleta.
  const campoUI = (
    <CampoBusqueda
      valor={query}
      onCambiar={setQuery}
      alcance="Soluciones IT"
      textoAlternativo={MARCADOR_BUSCADOR}
      refCampo={campo}
      variante={escritorio ? 'paleta' : ancho ? 'normal' : 'dock'}
    />
  )

  const contenido = (
    <>
      {escritorio ? (
        // LA CABECERA DE LA PALETA (desde 1280): el campo sin caja, qué busca
        // y Esc, que cierra (también un clic fuera, en el velo).
        <div className="flex h-16 flex-none items-center gap-3 border-b border-noct-divider pl-5 pr-[18px]">
          {campoUI}
          <span className="shrink-0 text-[12.5px] text-noct-neutral-500">{titulo}</span>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar el buscador"
            title="Cerrar el buscador (Esc)"
            className="flex h-9 shrink-0 items-center rounded-lg px-1.5 hover:bg-noct-text/[.05]"
          >
            <kbd aria-hidden className={KBD}>
              Esc
            </kbd>
          </button>
        </div>
      ) : (
        // LA CABECERA DE LA BÚSQUEDA (rediseño móvil "1b Pulgar", tarea 330):
        // el regreso a la izquierda y qué es. En el teléfono el campo baja al
        // pulgar; desde 768 ocupa el sitio del título (T6).
        <div className="flex min-h-[50px] flex-none items-center gap-1 px-1 py-0.5 md:h-16 md:gap-2.5 md:border-b md:border-noct-divider md:py-0 md:pl-3 md:pr-6">
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar el buscador"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-noct-neutral-200 hover:bg-noct-text/[.05]"
          >
            <CaretLeft size={20} aria-hidden />
          </button>
          {ancho ? (
            <div className="min-w-0 flex-1">{campoUI}</div>
          ) : (
            <h2 className="min-w-0 flex-1 truncate text-[17px] font-semibold">{titulo}</h2>
          )}
        </div>
      )}

      {/* EN MODO CONSULTA, POR QUÉ ES SEGURO TOCAR (sección 9): el técnico
          tiene que saber que nada de aquí lo saca de ella, o no se
          atreverá a tocar un resultado. Una línea, sin caja. */}
      {modo === 'consulta' && (
        <p className="flex-none px-4 pb-2 text-[12.5px] leading-snug text-noct-neutral-400 md:px-6 md:pt-3 xl:px-5">
          Modo consulta: lo que abras aquí no te saca de lo que estás haciendo.
        </p>
      )}

      {/* LOS CHIPS DE ALCANCE (tarea 330): solo filtran la vista. */}
      {copiaLeida && buscando && resultados.length > 0 && (
        <div className="flex-none px-3.5 pb-2.5 md:border-b md:border-noct-divider md:px-6 md:py-3 xl:px-5">
          <ChipsDeAlcance conteo={conteo} alcance={alcance} onCambiar={setAlcance} />
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <div
          // Desplazar la lista con el dedo cierra el teclado: se está
          // mirando lo encontrado, no escribiendo.
          onTouchMove={ancho ? undefined : () => campo.current?.blur()}
          className="min-h-0 min-w-0 flex-1 overflow-y-auto border-t border-noct-divider px-4 pb-6 pt-4 md:border-t-0 md:px-6 xl:px-[22px]"
        >
          <ProveedorRanuraVistaRapida value={escritorio ? ranuraVista : null}>
            {!copiaLeida ? (
              // Mientras se lee la copia local, la forma de lo que viene.
              <EsqueletoBusqueda />
            ) : !buscando ? (
              // EL ESTADO VACÍO, CON MENOS NIVELES (tarea 342): un rótulo a
              // 13/650, qué se puede buscar y, debajo, ejemplos reales. Las
              // búsquedas recientes y "Prueba con" del handoff piden
              // comportamiento nuevo y no entran aquí.
              <div className="flex flex-col gap-1.5 px-0.5">
                <p className="text-[13px] font-[650] text-noct-neutral-400">¿Qué necesitas resolver?</p>
                <p className="text-[14px] leading-[1.45] text-noct-neutral-300">
                  Nombre de equipo, IP, persona, ubicación, problema o guía. No hace falta elegir antes qué buscas.
                </p>
                <p className="text-[13px] leading-[1.45] text-noct-neutral-400">
                  {AYUDA_BUSCADOR}. Tolera errores de escritura y entiende sinónimos.
                </p>
              </div>
            ) : resultados.length > 0 ? (
              <ResultadosBusqueda
                resultados={visibles}
                consulta={consulta}
                consultaCruda={consultaCruda}
                onNavegar={onNavegar ?? onCerrar}
                onDesbloqueada={() => setHuboDesbloqueo(true)}
                huboDesbloqueo={huboDesbloqueo}
                modo={modo}
                enCapa
              />
            ) : (
              <div className="flex flex-col gap-4">
                {/* Estado vacío honesto (sección 14 del encargo): con la
                    bóveda bloqueada, "no hay nada" no es toda la verdad.
                    Sigue sin confirmar que exista ninguna credencial. Sin
                    resultados públicos, el puente conserva su forma
                    destacada (sección 14 del encargo del 2026-09-16). */}
                <PuenteBoveda consulta={consultaCruda} onDesbloqueada={() => setHuboDesbloqueo(true)} modo={modo} />
                {/* NADA COINCIDE, COMPACTO (tarea 342, handoff móvil): sin la
                    caja punteada, el glifo en su caja de 52, qué se buscó y
                    con qué probar. Crear equipo y Limpiar se quedan: son las
                    salidas que ya tenía. */}
                <div className="flex flex-col items-center gap-2.5 px-3 pb-3 pt-6 text-center">
                  <span className="flex h-[52px] w-[52px] items-center justify-center rounded-2xl bg-noct-tinte text-noct-neutral-400">
                    <MagnifyingGlass size={24} aria-hidden />
                  </span>
                  <p className="text-[16px] font-[650] leading-snug [overflow-wrap:anywhere]">Nada coincide con «{consultaCruda}»</p>
                  <p className="max-w-[280px] text-[13.5px] leading-[1.45] text-noct-neutral-400">
                    Prueba con el código del equipo, parte de la IP o una palabra del problema.
                  </p>
                  <div className="mt-1.5 flex flex-wrap justify-center gap-2">
                    {/* Crear es una salida: no en modo consulta, que vive
                        encima de una tarea. */}
                    {modo === 'normal' && (
                      <Link
                        to={`/dispositivos/nuevo?nombre=${encodeURIComponent(consultaCruda)}`}
                        onClick={onNavegar ?? onCerrar}
                        className={BTN_SECUNDARIO}
                      >
                        <Plus size={15} aria-hidden />
                        Crear equipo
                      </Link>
                    )}
                    <button type="button" onClick={() => setQuery('')} className={BTN_SECUNDARIO}>
                      Limpiar búsqueda
                    </button>
                  </div>
                </div>
              </div>
            )}
          </ProveedorRanuraVistaRapida>
        </div>
        {/* LA VISTA RÁPIDA, AL LADO (desde 1280, T6): la fila abierta pinta
            aquí su vista; sin ninguna abierta, la columna no existe. */}
        {escritorio && (
          <aside
            ref={setRanuraVista}
            aria-label="Vista rápida"
            className="w-[380px] shrink-0 overflow-y-auto border-l border-noct-divider bg-noct-bg/40 px-[22px] py-5 empty:hidden"
          />
        )}
      </div>

      {/* EL CAMPO, ABAJO, AL PULGAR (tarea 330), solo en el teléfono: con el
          teclado abierto, pegado a él. El marcador invita a contar lo que
          pasa (tarea 288) y la etiqueta accesible sigue diciendo el alcance
          (regla M-R8). */}
      {!ancho && (
        <div className="flex-none border-t border-noct-divider bg-noct-bg px-3 pb-[calc(10px+env(safe-area-inset-bottom))] pt-2.5">
          {campoUI}
        </div>
      )}

      {/* Los atajos que ya existen, dichos donde hay teclado (desde 1280). */}
      {escritorio && (
        <div className="flex h-[42px] flex-none items-center gap-[18px] border-t border-noct-divider px-5 text-[12.5px] text-noct-neutral-400">
          <span className="flex items-center gap-1.5">
            <kbd aria-hidden className={KBD}>
              Esc
            </kbd>
            cerrar
          </span>
          <span className="flex items-center gap-1.5">
            <kbd aria-hidden className={KBD}>
              /
            </kbd>
            buscar desde cualquier pantalla
          </span>
        </div>
      )}
    </>
  )

  // Portal a <body> por el mismo motivo que Modal: la barra superior
  // desde la que se invoca lleva `backdrop-blur`, que crea bloque
  // contenedor y romperia `fixed inset-0`.
  if (escritorio) {
    // LA PALETA (desde 1280, T6): 880 px (960 desde 1680) a 14 px de arriba
    // y de abajo, sobre un velo que la cierra al tocarlo. Encima de una
    // sección se centra sobre el contenido (a la derecha de la barra
    // lateral); encima de una tarea, que no la tiene, sobre la ventana.
    return createPortal(
      <div
        className="nocturne fixed inset-0 z-[60] bg-black/[.58] font-inter text-[15px] leading-[1.55] text-noct-text [:root[data-tema=claro]_&]:bg-noct-text/30"
        onClick={onCerrar}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={titulo}
          onClick={(evento) => evento.stopPropagation()}
          className={`absolute bottom-3.5 top-3.5 flex w-[880px] max-w-[calc(100vw-28px)] -translate-x-1/2 flex-col overflow-hidden rounded-[18px] bg-noct-surface shadow-[var(--shadow-noct-panel)] ring-1 ring-noct-divider 3xl:w-[960px] ${
            modo === 'consulta' ? 'left-1/2' : 'left-[calc(50%+120px)] 3xl:left-[calc(50%+116px)]'
          }`}
        >
          {contenido}
        </div>
      </div>,
      document.body,
    )
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
      className="nocturne fixed inset-0 z-[60] flex flex-col bg-noct-bg font-inter text-[15px] leading-[1.55] text-noct-text"
      // Con el teclado abierto (iOS no encoge la página), todo sube por
      // encima de él: el campo, abajo, queda pegado al teclado. Desde 768 el
      // campo está arriba y no hace falta.
      style={!ancho && teclado > 0 ? { paddingBottom: teclado } : undefined}
    >
      {contenido}
    </div>,
    document.body,
  )
}

// La tecla, dibujada (la misma que el disparador de la barra superior).
const KBD =
  'inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-md border border-b-2 border-noct-divider bg-noct-bg px-1.5 font-mono text-[11.5px] max-md:text-[12px] font-medium leading-none text-noct-neutral-400'
