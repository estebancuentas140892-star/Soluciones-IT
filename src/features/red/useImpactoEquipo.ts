import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db } from '../../lib/db'
import { caminoAscendente, construirArbol, contarImpacto, infoDeDispositivos } from './arbol'

/**
 * Impacto de una falla y cadena de dependencia de un equipo, como dato.
 *
 * Vive aparte del componente que lo pinta porque la ficha de equipo
 * necesita el TOTAL antes de decidir si monta la sección y qué escribe
 * en su cabecera plegada ("Si falla, caen · 9 equipos", regla M-R4 de la
 * auditoría móvil). Sacar el cálculo aquí evita que la ficha lo copie: el
 * árbol de topología se construye en un solo sitio
 * (`src/features/red/arbol.ts`), igual que hace la vista de mapa.
 */
export function useImpactoEquipo(dispositivoId: string) {
  const dispositivos = useLiveQuery(() => db.dispositivos.filter((d) => !d.eliminadoEn).toArray(), [], [])
  const conexiones = useLiveQuery(() => db.conexiones.filter((c) => !c.eliminadoEn).toArray(), [], [])
  const categorias = useLiveQuery(() => db.categorias.toArray(), [], [])

  const infoPorId = useMemo(() => infoDeDispositivos(dispositivos ?? []), [dispositivos])
  const nombreCategoria = useMemo(
    () => new Map((categorias ?? []).map((c) => [c.id, c.nombre])),
    [categorias],
  )

  const impacto = useMemo(() => {
    if (!conexiones) return new Map<string, number>()
    return contarImpacto(construirArbol(dispositivoId, conexiones, infoPorId))
  }, [dispositivoId, conexiones, infoPorId])

  const camino = useMemo(
    () => (conexiones ? caminoAscendente(dispositivoId, conexiones, infoPorId) : []),
    [dispositivoId, conexiones, infoPorId],
  )

  const totalEquipos = useMemo(() => [...impacto.values()].reduce((suma, n) => suma + n, 0), [impacto])

  return { impacto, camino, nombreCategoria, totalEquipos }
}
