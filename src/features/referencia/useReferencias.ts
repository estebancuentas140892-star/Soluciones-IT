import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db, type Referencia } from '../../lib/db'

// LAS REFERENCIAS VIVAS, POR ID.
//
// Es la pieza que hace que editar una ficha central actualice su
// informacion en TODAS las guias que la usan: el bloque de un paso solo
// guarda el id mas una copia del titulo, y quien lo pinta resuelve el
// contenido contra este mapa (regla de referencia viva, ver
// src/lib/referencia.ts).
//
// Las ELIMINADAS quedan fuera a proposito. Que un id no este en el mapa
// significa exactamente "esta referencia no esta disponible en este
// dispositivo", que es lo unico honesto que se puede decir sin saber si
// la borraron o si todavia no sincronizo. El bloque se conserva igual y
// la vista lo dice; el vinculo nunca se descuelga solo.
export function useReferencias(): Map<string, Referencia> {
  const referencias = useLiveQuery(() => db.referencias.filter((r) => !r.eliminadoEn).toArray(), [], [])
  return useMemo(() => new Map(referencias.map((r) => [r.id, r])), [referencias])
}
