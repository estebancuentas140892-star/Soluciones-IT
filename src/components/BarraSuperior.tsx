import { lazy, Suspense, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../features/autenticacion/authContext'
import { usePerfilVivo } from '../features/autenticacion/usePerfilVivo'
import { Avatar } from './Avatar'
import { CabeceraColapsable } from './CabeceraColapsable'
import { ProveedorCampoEnBarra } from './CampoBusqueda'
import { CaretLeft, MagnifyingGlass, QrCode } from './iconos'
import { PastillaSync } from './PastillaSync'
import { useEsAncho } from './useEsAncho'

const BuscadorGlobal = lazy(() =>
  import('../features/busqueda/BuscadorGlobal').then((m) => ({ default: m.BuscadorGlobal })),
)

// Barra superior global (tarea 181, mockup 3d del handoff "Auditoría de
// Soluciones TI"). Hasta ahora el shell aportaba pestañas y sidebar y
// nada mas: cada pantalla dibujaba su cabecera, con altura, relleno y
// controles distintos, y los tres servicios globales (dónde estoy, qué
// sabe la app, buscar) vivian dentro de una sola pestaña.
//
// Tres ranuras fijas, en este orden y siempre las mismas (regla R14):
//   1. titulo de la seccion, que confirma la pestaña iluminada
//   2. estado del dato (PastillaSync)
//   3. buscar + cuenta
//
// Las acciones propias de cada pantalla ("Crear", "Escanear", el menu
// "···") NO van en esta fila: van en `children`, la banda de controles
// que queda justo debajo dentro del mismo bloque pegajoso. Es la unica
// forma de que la fila superior caiga siempre en el mismo sitio, que es
// el problema que esta barra viene a resolver.
//
// Por ahora solo cubre el modo raiz (nivel 1, "sección"). Los modos
// documento y tarea, con regreso y miga, llegan con el chasis de tres
// niveles (tarea 185) y la miga de pan (tarea 188).
//
// DESDE 768 PX, LA BARRA BUSCA (tarea 339, handoff de tableta y
// escritorio). Una fila de 64 px (72 desde 1280) con el título, la
// búsqueda y el estado del dato; la cuenta ya está al pie de la barra
// lateral. La búsqueda es una de dos:
//   - el buscador propio de la pantalla (`buscador`: Resolver, Equipos,
//     Bóveda), que en el teléfono va en el dock y aquí sube junto al
//     título, con el escáner dentro del campo;
//   - en las demás secciones, en vez de la lupa, un disparador con forma
//     de campo ("Buscar en Soluciones IT", con la tecla "/" a la vista
//     desde 1280) que abre el mismo buscador global.

export function BarraSuperior({
  titulo,
  conLupa = true,
  tituloContraido = false,
  volver,
  buscador,
  children,
}: {
  titulo: string
  // El título a 14 px aunque no haya desplazamiento (Resolver mientras se
  // escribe, propuesta final de Claude Design).
  tituloContraido?: boolean
  // Regla M-R8, "un buscador por pantalla" (tarea 203): Inicio tiene su
  // propio campo de búsqueda en línea, con el alcance escrito, así que
  // ahí la lupa de esta barra sería el segundo buscador de la misma
  // pantalla. En el resto de las secciones la lupa ES el buscador y se
  // queda. Se apaga por pantalla, no se borra del chasis.
  conLupa?: boolean
  // Regreso de una sección que NO es uno de los cuatro destinos
  // principales (encargo del 2026-09-22): el catálogo de guías sube a
  // Resolver y Red a Más. En todos los tamaños, porque ninguna de las dos
  // tiene ya su propia entrada en la barra. Lo resuelve el chasis: el
  // último salto real si lo hay (M-R2) y si no el padre declarado.
  volver?: { to: string; etiqueta: string; estado?: unknown }
  // El buscador propio de la pantalla, cuando se ve desde 768 px (tarea
  // 339). Lo decide el chasis: por debajo de 768 lo monta en el dock, y
  // nunca en los dos sitios a la vez.
  buscador?: ReactNode
  children?: ReactNode
}) {
  const { perfil } = useAuth()
  const perfilVivo = usePerfilVivo()
  const [buscadorAbierto, setBuscadorAbierto] = useState(false)
  // Lupa en el teléfono, disparador con forma de campo desde 768 px: uno
  // u otro, nunca los dos.
  const ancho = useEsAncho()

  const usuario = perfilVivo ?? perfil

  return (
    <div className="sticky top-0 z-20 border-b border-noct-divider bg-noct-bg/[.92] backdrop-blur-[12px]">
      <div
        // El margen de la banda (T1): 24, 32 desde 1024 y 40 desde 1280, el
        // mismo del contenido; con regreso, 10 px antes para que su icono
        // caiga en la línea del margen.
        className={`flex items-center justify-between gap-2 pr-2 pt-2.5 md:h-16 md:justify-start md:gap-3.5 md:pr-6 md:pt-0 lg:pr-8 xl:h-[72px] xl:gap-4 xl:pr-10 ${
          volver ? 'pl-1 md:pl-3.5 lg:pl-[22px] xl:pl-[30px]' : 'pl-4 md:pl-6 lg:pl-8 xl:pl-10'
        }`}
      >
        <div className="flex min-w-0 items-center gap-0.5 md:shrink-0">
          {volver && (
            <Link
              to={volver.to}
              state={volver.estado}
              aria-label={`Volver a ${volver.etiqueta}`}
              title={`Volver a ${volver.etiqueta}`}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-noct-neutral-300 hover:bg-noct-text/5 hover:text-noct-text"
            >
              <CaretLeft size={18} aria-hidden />
            </Link>
          )}
          <CabeceraColapsable titulo={titulo} forzarContraida={tituloContraido} />
        </div>
        {buscador && (
          <div className="min-w-0 flex-1 md:max-w-[560px]">
            <ProveedorCampoEnBarra value={{ accesorio: <EscanerEnCampo /> }}>{buscador}</ProveedorCampoEnBarra>
          </div>
        )}
        {conLupa && ancho && (
          <button
            type="button"
            onClick={() => setBuscadorAbierto(true)}
            aria-label="Buscar en Soluciones IT"
            aria-keyshortcuts="/"
            title="Buscar en Soluciones IT (/)"
            className="flex h-11 min-w-0 flex-1 cursor-text items-center gap-2.5 rounded-xl border border-noct-text/25 bg-noct-surface pl-3.5 pr-2 text-left text-[14px] text-noct-neutral-400 shadow-[var(--shadow-noct-elevacion)] hover:border-noct-text/40 md:max-w-[440px] xl:h-10 xl:rounded-[11px]"
          >
            <MagnifyingGlass size={16} className="shrink-0" aria-hidden />
            <span className="min-w-0 flex-1 truncate">Buscar en Soluciones IT</span>
            <kbd
              aria-hidden
              className="hidden h-[22px] min-w-[22px] shrink-0 items-center justify-center rounded-md border border-b-2 border-noct-divider bg-noct-bg px-1.5 font-mono text-[11.5px] font-medium leading-none text-noct-neutral-400 xl:inline-flex"
            >
              /
            </kbd>
          </button>
        )}
        <div className="flex shrink-0 items-center gap-0.5 md:ml-auto">
          <PastillaSync />
          {conLupa && !ancho && (
            <button
              type="button"
              onClick={() => setBuscadorAbierto(true)}
              aria-label="Buscar en Soluciones IT"
              title="Buscar en Soluciones IT"
              className="flex h-11 w-11 items-center justify-center rounded-lg text-noct-neutral-200 hover:bg-noct-text/[.05]"
            >
              <MagnifyingGlass size={20} aria-hidden />
            </button>
          )}
          {/* Ajustes (la cuenta, tarea 268), en el teléfono. Desde 768 px la barra lateral (el
              rail de iconos y la completa) ya la ofrece al pie, así que
              aquí se oculta: con `lg:hidden` la tableta la enseñaba dos
              veces en la misma pantalla. */}
          <Link
            to="/cuenta"
            aria-label="Ajustes"
            title={usuario?.nombre || 'Ajustes'}
            className="flex h-11 w-11 items-center justify-center md:hidden"
          >
            <Avatar nombre={usuario?.nombre} correo={usuario?.correo} />
          </Link>
        </div>
      </div>

      {children}

      {buscadorAbierto && (
        <Suspense fallback={null}>
          <BuscadorGlobal abierto={buscadorAbierto} onCerrar={() => setBuscadorAbierto(false)} />
        </Suspense>
      )}
    </div>
  )
}

// El escáner dentro del campo de la barra, tras su línea (tarea 339): en el
// teléfono va al lado del dock, a 52 px; aquí, a 36, porque es la otra forma
// de buscar lo mismo y no una acción aparte.
function EscanerEnCampo() {
  return (
    <Link
      to="/escaner"
      aria-label="Escanear QR"
      title="Escanear QR"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] text-noct-neutral-300 hover:bg-noct-text/[.05] hover:text-noct-text"
    >
      <QrCode size={19} aria-hidden />
    </Link>
  )
}
