import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db, type Procedimiento } from '../../lib/db'
import { normalizarProcedimiento } from '../../lib/procedimiento'
import { guiaDelPrimerPaso, requisitosEfectivos } from './preparacionGuia'

/**
 * Los requisitos de la guía entera (`requisitosEfectivos`): los suyos y
 * los de la guía que reutiliza en el paso 1, leída de la base local en
 * vivo. `undefined` mientras esa lectura no ha llegado, para que nadie
 * decida qué pantalla enseñar con la mitad de los datos.
 *
 * La misma lista en la ejecución, en los detalles de la guía y en la vista
 * previa del editor: una sola verdad para "qué hace falta antes".
 */
export function useRequisitosEfectivos(procedimiento: Procedimiento | null): string[] | undefined {
  const guiaId = procedimiento ? guiaDelPrimerPaso(procedimiento) : null
  // `null` es "no hay guía en el paso 1, o no está en este dispositivo";
  // `undefined`, que la lectura todavía no ha vuelto.
  const delPrimerPaso = useLiveQuery(async () => {
    if (!guiaId) return null
    const articulo = await db.articulos.get(guiaId)
    if (!articulo || articulo.eliminadoEn) return null
    return normalizarProcedimiento(articulo.procedimiento)?.requisitos ?? null
  }, [guiaId])
  const propios = procedimiento?.requisitos
  return useMemo(() => {
    if (!propios) return []
    if (guiaId && delPrimerPaso === undefined) return undefined
    return requisitosEfectivos(propios, delPrimerPaso ?? null)
  }, [propios, guiaId, delPrimerPaso])
}
