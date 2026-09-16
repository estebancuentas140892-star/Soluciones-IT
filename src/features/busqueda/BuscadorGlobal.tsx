import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { MagnifyingGlass, Plus, X } from '../../components/iconos'
import { CampoBusqueda } from '../../components/CampoBusqueda'
import { BTN_SECUNDARIO } from '../../components/nocturne'
import { normalizarTexto } from '../soluciones/iconosSoluciones'
import type { ModoBuscador } from './modoConsulta'
import { PuenteBoveda } from './PuenteBoveda'
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
    >
      <div className="flex items-center gap-2 border-b border-noct-divider px-3 py-2.5">
        {/* Mismo campo que el resto de la app (tarea 207, regla M-R8):
            46 px, el alcance escrito y el borrar a 44 px reales, que
            aquí ni siquiera existía. Lo que distingue a este buscador
            del de cada sección es su alcance, no su forma. */}
        {/* La pregunta, no el alcance (tarea 241, sección 1 del
            encargo): el técnico no viene a "buscar en Soluciones IT",
            viene a resolver algo. La etiqueta accesible sigue diciendo
            el alcance, que es lo que distingue este buscador de los de
            sección (regla M-R8). */}
        <CampoBusqueda
          valor={query}
          onCambiar={setQuery}
          alcance="Soluciones IT"
          textoAlternativo="¿Qué necesitas resolver?"
          refCampo={campo}
          className="min-w-0 flex-1"
        />
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar el buscador"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-noct-neutral-200 hover:bg-noct-text/[.05]"
        >
          <X size={20} aria-hidden />
        </button>
      </div>

      {/* EL MODO SE DICE (sección 8): quien busca a mitad de una guía
          tiene que saber que nada de aquí lo saca de ella, o no se
          atreverá a tocar un resultado. Una línea, sin caja. */}
      {modo === 'consulta' && (
        <p className="border-b border-noct-divider px-4 py-2 text-[12.5px] leading-snug text-noct-neutral-400">
          Modo consulta: lo que abras aquí no te saca de lo que estás haciendo.
        </p>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 pt-4">
        {!buscando ? (
          // Alcance declarado: es lo que distingue a este buscador de los
          // de seccion, que tienen la misma forma y otro limite. Se dice
          // en una frase corta (2026-09-14) en vez de enumerar los diez
          // tipos que indexa: la lista larga daba a entender que solo
          // buscaba en los primeros que nombraba.
          <div className="flex flex-col gap-1 px-0.5">
            <p className="text-[14.5px] font-medium leading-snug">¿Qué necesitas resolver?</p>
            <p className="text-[13px] leading-relaxed text-noct-neutral-400">
              Busca una guía, equipo, acceso, herramienta, comando o problema.
            </p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-noct-neutral-500">
              Tolera errores de escritura y entiende sinónimos: "backup" encuentra "copia de seguridad".
            </p>
          </div>
        ) : resultados.length > 0 ? (
          <ResultadosBusqueda
            resultados={resultados}
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
            {/* Estado vacío más útil (sección 16 del encargo): con la
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
                {/* Crear un equipo es salir a un formulario: no se ofrece
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
    </div>,
    document.body,
  )
}
