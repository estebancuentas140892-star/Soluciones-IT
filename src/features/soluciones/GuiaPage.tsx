import { useLiveQuery } from 'dexie-react-hooks'
import { lazy, Suspense, useMemo } from 'react'
import { Navigate, useLocation, useParams } from 'react-router-dom'
import { db } from '../../lib/db'
import { normalizarProcedimiento, procedimientoEjecutable } from '../../lib/procedimiento'
import { Cargando } from '../../components/Cargando'

const AsistentePage = lazy(() => import('./AsistentePage').then((m) => ({ default: m.AsistentePage })))
const ArticuloPage = lazy(() => import('./ArticuloPage').then((m) => ({ default: m.ArticuloPage })))

// ABRIR UNA GUÍA ES EMPEZAR A HACERLA (encargo del 2026-09-17, sección 3).
//
// `/soluciones/:categoriaId/:articuloId` era la ficha: portada, tipo,
// descripción, metadatos, tiempo y dificultad, objetivo, "Antes de
// empezar", términos, relacionados, etiquetas e historial, y al pie la
// barra "Empecemos". Para hacer el paso 1 había que atravesar todo eso
// y tocar un botón, y era la puerta de TODAS las guías: la lista, el
// buscador, los recientes, la ficha del equipo, las guías relacionadas.
//
// Ahora la misma dirección decide por el contenido:
//
//   - una guía con pasos se abre EJECUTÁNDOSE, en su primer paso
//     pendiente (`AsistentePage`);
//   - un artículo sin pasos (un manual, unas notas) no tiene nada que
//     ejecutar, así que sigue siendo lo que se lee (`ArticuloPage`).
//
// La ficha no desaparece: vive en `/detalles` y se abre desde el índice
// de pasos. Cambiar la dirección de la guía habría roto los enlaces que
// el equipo ya tiene guardados y compartidos; cambiar lo que hay detrás
// no rompe ninguno.
export function GuiaPage() {
  const { articuloId = '' } = useParams()
  const articulo = useLiveQuery(async () => (await db.articulos.get(articuloId)) ?? null, [articuloId])
  const ejecutable = useMemo(
    () => procedimientoEjecutable(normalizarProcedimiento(articulo?.procedimiento)),
    [articulo],
  )

  if (articulo === undefined) return <Cargando />

  return (
    <Suspense fallback={<Cargando />}>
      {/* Uno que no existe o está eliminado lo resuelve la ficha, que ya
          sabe devolver a la lista. */}
      {articulo && !articulo.eliminadoEn && ejecutable ? <AsistentePage /> : <ArticuloPage />}
    </Suspense>
  )
}

// `/ejecutar` era la dirección de la ejecución hasta el 2026-09-17. Sigue
// existiendo por los enlaces guardados, y lleva a la guía conservando el
// `state` del salto (de dónde se vino y qué búsqueda había), para que la
// X siga deshaciendo el recorrido real.
export function RedireccionAGuia() {
  const { categoriaId = '', articuloId = '' } = useParams()
  const { state } = useLocation()
  return <Navigate to={`/soluciones/${categoriaId}/${articuloId}`} state={state} replace />
}
