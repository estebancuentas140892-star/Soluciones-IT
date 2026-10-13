import { useLiveQuery } from 'dexie-react-hooks'
import { db, type VinculoProtegido } from '../../lib/db'

/**
 * El nombre con el que se presenta un vínculo protegido fuera de su bloque
 * (la fila que abre su hoja en la ejecución, tarea 328): el título vivo de la
 * credencial o del campo, si existe y no se eliminó, y si no, la copia de
 * referencia del vínculo. Es la misma regla que aplica `CredencialFijaEnPaso`
 * dentro de la hoja, así que la fila y la hoja dicen lo mismo. El título no es
 * un secreto (lo cifrado son los datos); sin permiso, la credencial no está en
 * el dispositivo y se lee la referencia. La credencial del equipo se resuelve
 * dentro de la hoja: aquí, su título de referencia.
 */
export function useTituloDelVinculo(vinculo: VinculoProtegido): string {
  const tipo = vinculo.tipo
  const id = vinculo.tipo === 'equipo' ? '' : vinculo.id
  const credencial = useLiveQuery(
    async () => (tipo === 'credencial' ? ((await db.credenciales.get(id)) ?? null) : null),
    [tipo, id],
  )
  const campo = useLiveQuery(async () => (tipo === 'campo' ? ((await db.campos_protegidos.get(id)) ?? null) : null), [tipo, id])
  const vivo =
    credencial && !credencial.eliminadoEn ? credencial.titulo : campo && !campo.eliminadoEn ? campo.nombre : ''
  return vivo || vinculo.titulo
}
