import { lazy, Suspense, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../features/autenticacion/authContext'
import { usePerfilVivo } from '../features/autenticacion/usePerfilVivo'
import { Avatar } from './Avatar'
import { CabeceraColapsable } from './CabeceraColapsable'
import { MagnifyingGlass } from './iconos'
import { PastillaSync } from './PastillaSync'

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

export function BarraSuperior({ titulo, children }: { titulo: string; children?: ReactNode }) {
  const { perfil } = useAuth()
  const perfilVivo = usePerfilVivo()
  const [buscadorAbierto, setBuscadorAbierto] = useState(false)

  const usuario = perfilVivo ?? perfil

  return (
    <div className="sticky top-0 z-20 border-b border-noct-divider bg-noct-bg/[.92] backdrop-blur-[12px]">
      <div className="flex items-center justify-between gap-2 pl-4 pr-2 pt-2.5">
        <CabeceraColapsable titulo={titulo} />
        <div className="flex shrink-0 items-center gap-0.5">
          <PastillaSync />
          <button
            type="button"
            onClick={() => setBuscadorAbierto(true)}
            aria-label="Buscar en todo"
            title="Buscar en todo"
            className="flex h-11 w-11 items-center justify-center rounded-lg text-noct-neutral-200 hover:bg-noct-text/[.05]"
          >
            <MagnifyingGlass size={20} aria-hidden />
          </button>
          {/* Mi cuenta deja de alcanzarse solo desde Inicio. En escritorio
              el sidebar ya la ofrece al pie, asi que aqui se oculta. */}
          <Link
            to="/cuenta"
            aria-label="Mi cuenta"
            title={usuario?.nombre || 'Mi cuenta'}
            className="flex h-11 w-11 items-center justify-center lg:hidden"
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
