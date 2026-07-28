import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../../lib/db'
import { articulosSinTerminar, type ArticuloSinTerminar } from './sinTerminar'

// Clave de localStorage con el id del articulo que el tecnico descarto
// de la BarraReanudar (tarea 186): "ahora no", no "nunca". Si el avance
// sigue y el articulo deja de estar sin terminar (se completa o se
// reinicia), o si aparece un procedimiento mas reciente para retomar,
// el descarte de este id deja de tener efecto por si solo.
const CLAVE_DESCARTADO = 'reanudar_descartado_id'

function leerDescartado(): string | null {
  try {
    return localStorage.getItem(CLAVE_DESCARTADO)
  } catch {
    return null
  }
}

interface Reanudar {
  // El procedimiento a medias mas reciente de todo el equipo de
  // articulos, o null si no hay ninguno empezado sin terminar.
  actual: ArticuloSinTerminar | null
  // True cuando `actual` es justo el que se descarto: la barra se
  // oculta y la pestaña Guías muestra su punto en su lugar.
  descartado: boolean
  descartar: () => void
}

// Unico dato que alimenta tanto la BarraReanudar (chasis) como el punto
// de aviso de la pestaña Guías: reutiliza `articulosSinTerminar`, ya
// usado en el bloque "Sin terminar" de SolucionesPage, en vez de
// duplicar la consulta a `progresoPasos`.
export function useReanudar(): Reanudar {
  const articulos = useLiveQuery(() => db.articulos.filter((a) => !a.eliminadoEn).toArray(), [], [])
  const progresos = useLiveQuery(() => db.progresoPasos.toArray(), [], [])
  const [descartadoId, setDescartadoId] = useState<string | null>(leerDescartado)

  const actual = articulosSinTerminar(articulos, progresos)[0] ?? null

  function descartar() {
    if (!actual) return
    try {
      localStorage.setItem(CLAVE_DESCARTADO, actual.articulo.id)
    } catch {
      // Almacenamiento no disponible (navegacion privada): el descarte
      // no sobrevive a un recargo, pero no rompe nada.
    }
    setDescartadoId(actual.articulo.id)
  }

  return {
    actual,
    descartado: actual != null && actual.articulo.id === descartadoId,
    descartar,
  }
}
