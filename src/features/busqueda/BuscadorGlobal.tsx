import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { CaretLeft, MagnifyingGlass, Plus, X } from '../../components/iconos'
import { useAltoDelTeclado } from '../../components/useAltoDelTeclado'
import { useAnchoTelefono } from '../../components/useAnchoTelefono'
import { CampoBusqueda } from '../../components/CampoBusqueda'
import { BTN_SECUNDARIO } from '../../components/nocturne'
import { normalizarTexto } from '../soluciones/iconosSoluciones'
import type { ModoBuscador } from './modoConsulta'
import { alcanceEfectivo, conteoPorAlcance, filtrarPorAlcance, type Alcance } from './alcanceBusqueda'
import { ChipsDeAlcance } from './ChipsDeAlcance'
import { useIdsDeRed } from './useIdsDeRed'
import { PuenteBoveda } from './PuenteBoveda'
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
  // EL ALCANCE (tarea 330): solo filtra lo que ya se encontró.
  const [alcanceElegido, setAlcance] = useState<Alcance>('todo')
  const idsDeRed = useIdsDeRed()
  const conteo = useMemo(() => conteoPorAlcance(resultados, idsDeRed), [resultados, idsDeRed])
  const alcance = alcanceEfectivo(alcanceElegido, conteo)
  const visibles = useMemo(() => filtrarPorAlcance(resultados, alcance, idsDeRed), [resultados, alcance, idsDeRed])
  const teclado = useAltoDelTeclado()
  // El campo va abajo, al pulgar, solo con ancho de teléfono (tarea 338).
  // Desde 768 px vuelve arriba, junto a la X, como antes del rediseño móvil.
  const telefono = useAnchoTelefono()
  const IconoCerrar = telefono ? CaretLeft : X

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

  // Portal a <body> por el mismo motivo que Modal: la barra superior
  // desde la que se invoca lleva `backdrop-blur`, que crea bloque
  // contenedor y romperia `fixed inset-0`.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={modo === 'consulta' ? 'Consultar sin salir de la tarea' : 'Buscar en Soluciones IT'}
      className="nocturne fixed inset-0 z-[60] flex flex-col bg-noct-bg font-inter text-[15px] leading-[1.55] text-noct-text"
      // Con el teclado abierto (iOS no encoge la página), todo sube por
      // encima de él: el campo, abajo, queda pegado al teclado.
      style={teclado > 0 ? { paddingBottom: teclado } : undefined}
    >
      {/* LA CABECERA DE LA BÚSQUEDA (rediseño móvil "1b Pulgar", tarea 330):
          el regreso a la izquierda y qué es. El campo baja al pulgar.
          Desde 768 px (tarea 338), la barra de antes: el campo arriba, la X
          a su derecha y el título oculto (lo dicen el campo y el diálogo). */}
      <div className="flex min-h-[50px] flex-none items-center gap-1 px-1 py-0.5 md:min-h-0 md:gap-2 md:border-b md:border-noct-divider md:px-3 md:py-2.5">
        {!telefono && (
          <CampoBusqueda
            valor={query}
            onCambiar={setQuery}
            alcance="Soluciones IT"
            textoAlternativo={MARCADOR_BUSCADOR}
            refCampo={campo}
            className="min-w-0 flex-1"
          />
        )}
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar el buscador"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-noct-neutral-200 hover:bg-noct-text/[.05]"
        >
          <IconoCerrar size={20} aria-hidden />
        </button>
        <h2 className="min-w-0 flex-1 truncate text-[17px] font-semibold md:hidden">
          {modo === 'consulta' ? 'Consultar sin salir de la tarea' : 'Buscar en Soluciones IT'}
        </h2>
      </div>

      {/* EN MODO CONSULTA, POR QUÉ ES SEGURO TOCAR (sección 9): el técnico
          tiene que saber que nada de aquí lo saca de ella, o no se
          atreverá a tocar un resultado. Una línea, sin caja. */}
      {modo === 'consulta' && (
        <p className="flex-none px-4 pb-2 text-[12.5px] leading-snug text-noct-neutral-400 md:border-b md:border-noct-divider md:pt-2">
          Modo consulta: lo que abras aquí no te saca de lo que estás haciendo.
        </p>
      )}

      {/* LOS CHIPS DE ALCANCE (tarea 330): solo filtran la vista. Desde 768
          px (tarea 338) van en su propia franja bajo la barra, con la línea
          debajo que en el teléfono lleva la lista. */}
      {buscando && resultados.length > 0 && (
        <div className="flex-none px-3.5 pb-2.5 md:border-b md:border-noct-divider md:px-4 md:pt-2.5">
          <ChipsDeAlcance conteo={conteo} alcance={alcance} onCambiar={setAlcance} />
        </div>
      )}

      <div
        // Desplazar la lista con el dedo cierra el teclado: se está
        // mirando lo encontrado, no escribiendo.
        onTouchMove={() => campo.current?.blur()}
        className="min-h-0 flex-1 overflow-y-auto border-t border-noct-divider px-4 pb-6 pt-4 md:border-t-0 md:pb-8"
      >
        {!buscando ? (
          <div className="flex flex-col gap-1 px-0.5">
            <p className="text-[14.5px] font-medium leading-snug">¿Qué necesitas resolver?</p>
            <p className="text-[13px] leading-relaxed text-noct-neutral-400">{AYUDA_BUSCADOR}</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-noct-neutral-500">
              Tolera errores de escritura y entiende sinónimos: "backup" encuentra "copia de seguridad".
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
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-noct-neutral-700 px-6 py-12 text-center">
              <MagnifyingGlass size={30} className="text-noct-neutral-600" aria-hidden />
              <div>
                <p className="text-[14.5px] font-medium">Sin coincidencias</p>
                <p className="mt-1 text-[13px] leading-relaxed text-noct-neutral-400">
                  Nada coincide con "{consultaCruda}". Prueba otra palabra o revisa la ortografía.
                </p>
              </div>
              <div className="mt-0.5 flex flex-wrap justify-center gap-2">
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
      </div>

      {/* EL CAMPO, ABAJO, AL PULGAR (tarea 330): con el teclado abierto,
          pegado a él. El marcador invita a contar lo que pasa (tarea 288) y
          la etiqueta accesible sigue diciendo el alcance (regla M-R8). Solo
          en el teléfono (tarea 338): desde 768 px va arriba. */}
      {telefono && (
        <div className="flex-none border-t border-noct-divider bg-noct-bg px-3 pb-[calc(10px+env(safe-area-inset-bottom))] pt-2.5">
          <CampoBusqueda
            valor={query}
            onCambiar={setQuery}
            alcance="Soluciones IT"
            textoAlternativo={MARCADOR_BUSCADOR}
            refCampo={campo}
            variante="dock"
          />
        </div>
      )}
    </div>,
    document.body,
  )
}
