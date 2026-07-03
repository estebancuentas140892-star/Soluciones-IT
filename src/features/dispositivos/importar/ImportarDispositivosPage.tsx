import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { db } from '../../../lib/db'
import { guardarRegistro, nuevoId } from '../../../lib/repositorio'
import { leerArchivoTabular } from './leerArchivo'
import { ETIQUETA_CAMPO, generarPlantillaCsv, mapearFilas } from './mapearFilas'

type Fase =
  | { paso: 'elegir'; error: string | null }
  | { paso: 'revisar'; nombreArchivo: string; filas: string[][] }
  | { paso: 'importando'; total: number; avance: number }
  | { paso: 'terminado'; importados: number; fallidos: number }

export function ImportarDispositivosPage() {
  const navigate = useNavigate()
  const [fase, setFase] = useState<Fase>({ paso: 'elegir', error: null })
  const [categoriaPredeterminadaId, setCategoriaPredeterminadaId] = useState('')
  const entradaArchivo = useRef<HTMLInputElement>(null)

  const categorias = useLiveQuery(() => db.categorias.filter((c) => !c.eliminadoEn).sortBy('orden'), [], [])
  const existentes = useLiveQuery(() => db.dispositivos.filter((d) => !d.eliminadoEn).toArray(), [], [])

  const mapeo = useMemo(() => {
    if (fase.paso !== 'revisar') return null
    return mapearFilas(fase.filas, {
      categorias: categorias ?? [],
      categoriaPredeterminadaId: categoriaPredeterminadaId || undefined,
      serialesExistentes: (existentes ?? []).map((d) => d.serial).filter(Boolean),
      placasExistentes: (existentes ?? []).map((d) => d.placaInventario).filter(Boolean),
    })
  }, [fase, categorias, existentes, categoriaPredeterminadaId])

  const nombreCategoria = useMemo(
    () => new Map((categorias ?? []).map((c) => [c.id, c.nombre])),
    [categorias],
  )

  async function manejarArchivo(archivo: File | undefined) {
    if (!archivo) return
    try {
      const filas = await leerArchivoTabular(archivo)
      setFase({ paso: 'revisar', nombreArchivo: archivo.name, filas })
    } catch {
      setFase({
        paso: 'elegir',
        error: `No se pudo leer "${archivo.name}". Verifica que sea un archivo .xlsx o .csv válido.`,
      })
    }
  }

  function descargarPlantilla() {
    const blob = new Blob([generarPlantillaCsv()], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const enlace = document.createElement('a')
    enlace.href = url
    enlace.download = 'plantilla-inventario.csv'
    enlace.click()
    URL.revokeObjectURL(url)
  }

  async function importar() {
    if (!mapeo || fase.paso !== 'revisar') return
    const filas = mapeo.importables
    const motivo = `Importado desde ${fase.nombreArchivo}`
    setFase({ paso: 'importando', total: filas.length, avance: 0 })

    let importados = 0
    let fallidos = 0
    for (const fila of filas) {
      try {
        await guardarRegistro('dispositivos', { id: nuevoId(), ...fila.datos }, motivo)
        importados += 1
      } catch {
        fallidos += 1
      }
      setFase({ paso: 'importando', total: filas.length, avance: importados + fallidos })
    }
    setFase({ paso: 'terminado', importados, fallidos })
  }

  return (
    <div className="flex flex-col gap-5 px-4 pt-6 pb-8">
      <header>
        <Link to="/dispositivos" className="text-xs text-slate-400">
          ← Volver
        </Link>
        <h1 className="text-xl font-semibold">Importar inventario</h1>
        <p className="text-sm text-slate-400">Carga masiva de dispositivos desde Excel o CSV</p>
      </header>

      {fase.paso === 'elegir' && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate-300">
            La primera fila del archivo debe tener los encabezados. Se reconocen: Nombre, Categoría, Marca, Modelo,
            Serial, Placa de inventario, Ubicación, IP, Estado y Observaciones (también con nombres parecidos, por
            ejemplo &quot;No. de serie&quot; o &quot;Sede&quot;). Cualquier otra columna se guarda como campo
            adicional del dispositivo.
          </p>
          <input
            ref={entradaArchivo}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => manejarArchivo(e.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => entradaArchivo.current?.click()}
            className="rounded-xl bg-sky-500 px-6 py-3 text-sm font-medium text-slate-950"
          >
            Elegir archivo...
          </button>
          <button type="button" onClick={descargarPlantilla} className="text-xs text-sky-400 underline">
            Descargar plantilla CSV de ejemplo
          </button>
          {fase.error && (
            <p className="rounded-xl border border-red-900 bg-red-950/50 px-4 py-3 text-sm text-red-300">
              {fase.error}
            </p>
          )}
        </div>
      )}

      {fase.paso === 'revisar' && mapeo && (
        <div className="flex flex-col gap-4">
          {mapeo.errorGeneral ? (
            <>
              <p className="rounded-xl border border-red-900 bg-red-950/50 px-4 py-3 text-sm text-red-300">
                {mapeo.errorGeneral}
              </p>
              <button
                type="button"
                onClick={() => setFase({ paso: 'elegir', error: null })}
                className="rounded-xl border border-slate-800 px-6 py-3 text-sm text-slate-300"
              >
                Elegir otro archivo
              </button>
            </>
          ) : (
            <>
              <section className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
                <h2 className="text-sm font-medium text-slate-100">Columnas detectadas</h2>
                <ul className="mt-2 flex flex-col gap-1">
                  {mapeo.columnas
                    .filter((c) => c.destino.tipo !== 'ignorada')
                    .map((columna, indice) => (
                      <li key={indice} className="text-xs text-slate-400">
                        &quot;{columna.encabezado}&quot;{' '}
                        {columna.destino.tipo === 'campo' ? (
                          <>→ {ETIQUETA_CAMPO[columna.destino.campo]}</>
                        ) : (
                          <>→ campo adicional</>
                        )}
                      </li>
                    ))}
                </ul>
              </section>

              {mapeo.hayFilasSinCategoria && (
                <label className="flex flex-col gap-1 text-sm text-slate-300">
                  Categoría para las filas que no traen una
                  <select
                    value={categoriaPredeterminadaId}
                    onChange={(e) => setCategoriaPredeterminadaId(e.target.value)}
                    className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="">Elegir categoría...</option>
                    {categorias?.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <p className="text-sm text-slate-300">
                <span className="font-medium text-slate-100">{mapeo.importables.length}</span> dispositivos listos
                para importar
                {mapeo.omitidas.length > 0 && (
                  <>
                    {' '}
                    y <span className="font-medium text-slate-100">{mapeo.omitidas.length}</span> filas que se
                    omitirán
                  </>
                )}
                .
              </p>

              {mapeo.omitidas.length > 0 && (
                <section className="rounded-xl border border-amber-900 bg-amber-950/40 px-4 py-3">
                  <h2 className="text-sm font-medium text-amber-200">Filas omitidas</h2>
                  <ul className="mt-2 flex flex-col gap-1">
                    {mapeo.omitidas.slice(0, 30).map((fila) => (
                      <li key={fila.numeroFila} className="text-xs text-amber-200/80">
                        Fila {fila.numeroFila}: {fila.motivo}
                      </li>
                    ))}
                    {mapeo.omitidas.length > 30 && (
                      <li className="text-xs text-amber-200/80">
                        ... y {mapeo.omitidas.length - 30} filas más.
                      </li>
                    )}
                  </ul>
                </section>
              )}

              {mapeo.importables.length > 0 && (
                <section className="overflow-x-auto rounded-xl border border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900 text-slate-400">
                      <tr>
                        <th className="px-3 py-2 font-medium">Nombre</th>
                        <th className="px-3 py-2 font-medium">Categoría</th>
                        <th className="px-3 py-2 font-medium">Marca</th>
                        <th className="px-3 py-2 font-medium">Ubicación</th>
                      </tr>
                    </thead>
                    <tbody className="text-slate-300">
                      {mapeo.importables.slice(0, 15).map((fila) => (
                        <tr key={fila.numeroFila} className="border-t border-slate-800">
                          <td className="px-3 py-2">{fila.datos.nombre}</td>
                          <td className="px-3 py-2">{nombreCategoria.get(fila.datos.categoriaId) ?? ''}</td>
                          <td className="px-3 py-2">{fila.datos.marca}</td>
                          <td className="px-3 py-2">{fila.datos.ubicacion}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {mapeo.importables.length > 15 && (
                    <p className="border-t border-slate-800 px-3 py-2 text-xs text-slate-500">
                      ... y {mapeo.importables.length - 15} dispositivos más.
                    </p>
                  )}
                </section>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFase({ paso: 'elegir', error: null })}
                  className="rounded-xl border border-slate-800 px-6 py-3 text-sm text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={mapeo.importables.length === 0}
                  onClick={importar}
                  className="flex-1 rounded-xl bg-sky-500 px-6 py-3 text-sm font-medium text-slate-950 disabled:opacity-50"
                >
                  Importar {mapeo.importables.length} dispositivos
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {fase.paso === 'importando' && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-slate-300">
            Importando {fase.avance} de {fase.total}...
          </p>
          <div className="h-2 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-sky-500 transition-all"
              style={{ width: `${fase.total === 0 ? 0 : Math.round((fase.avance / fase.total) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {fase.paso === 'terminado' && (
        <div className="flex flex-col gap-4">
          <p className="rounded-xl border border-emerald-900 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-200">
            Se importaron {fase.importados} dispositivos.
            {fase.fallidos > 0 && ` ${fase.fallidos} filas fallaron al guardarse.`}
          </p>
          <p className="text-xs text-slate-500">
            Cada dispositivo quedó con la nota &quot;Importado desde el archivo&quot; en su historial. Los cambios se
            sincronizan solos con el resto del equipo.
          </p>
          <button
            type="button"
            onClick={() => navigate('/dispositivos')}
            className="rounded-xl bg-sky-500 px-6 py-3 text-sm font-medium text-slate-950"
          >
            Ver dispositivos
          </button>
        </div>
      )}
    </div>
  )
}
