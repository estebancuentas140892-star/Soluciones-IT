import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../../../lib/db'
import { guardarRegistro, nuevoId } from '../../../lib/repositorio'
import { BotonVolver } from '../../../components/BotonVolver'
import {
  CaretDown,
  CaretUp,
  CheckCircle,
  DownloadSimple,
  Plus,
  UploadSimple,
  Warning,
  WarningOctagon,
} from '../../../components/iconos'
import { BTN_GHOST, BTN_PRIMARIO, BTN_SECUNDARIO, TituloSeccion } from '../../../components/nocturne'
import { leerArchivoTabular } from './leerArchivo'
import { CLASE_CAMPO } from '../../../components/campos'
import { ETIQUETA_CAMPO, generarPlantillaCsv, mapearFilas } from './mapearFilas'

type Fase =
  | { paso: 'elegir'; error: string | null }
  | { paso: 'revisar'; nombreArchivo: string; filas: string[][] }
  | { paso: 'importando'; total: number; avance: number }
  | { paso: 'terminado'; importados: number; fallidos: number }

// Importación masiva de dispositivos re-autorizada al sistema Nocturne
// (handoff "Rediseño de aplicación empresarial", Importar
// Dispositivos.dc.html): un flujo de 3 pasos (elegir archivo, revisar,
// importar) con revisión antes de guardar. Trae su propio shell Nocturne
// enfocado (cabecera pegajosa con el indicador de paso y barra inferior
// fija en la revisión), por eso sale del Layout oscuro. La lógica y los
// datos no cambian: lectura tabular, mapeo por sinónimos de encabezado,
// omisión de duplicados y guardado con la nota de origen en el historial.
export function ImportarDispositivosPage() {
  const navigate = useNavigate()
  const [fase, setFase] = useState<Fase>({ paso: 'elegir', error: null })
  const [categoriaPredeterminadaId, setCategoriaPredeterminadaId] = useState('')
  const [omitidasAbiertas, setOmitidasAbiertas] = useState(false)
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

  const PASO_ETIQUETA: Record<Fase['paso'], string> = {
    elegir: 'Paso 1 de 3',
    revisar: 'Paso 2 de 3',
    importando: 'Paso 3 de 3',
    terminado: 'Listo',
  }

  async function manejarArchivo(archivo: File | undefined) {
    if (!archivo) return
    try {
      const filas = await leerArchivoTabular(archivo)
      setOmitidasAbiertas(false)
      setFase({ paso: 'revisar', nombreArchivo: archivo.name, filas })
    } catch {
      setFase({
        paso: 'elegir',
        error: `No se pudo leer "${archivo.name}". Verificar que sea un archivo .xlsx o .csv válido.`,
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
    <div className="nocturne min-h-svh bg-noct-bg font-inter text-[15px] leading-[1.55] text-noct-text">
      <div className="mx-auto flex min-h-svh max-w-md flex-col">
        <div className="sticky top-0 z-20 border-b border-noct-divider bg-noct-bg/[.92] backdrop-blur-[12px]">
          <header className="flex items-center justify-between gap-2 py-2.5 pl-2 pr-3 pb-0">
            <BotonVolver to="/dispositivos">
              Dispositivos
            </BotonVolver>
            <span className="shrink-0 text-[12px] text-noct-neutral-500">{PASO_ETIQUETA[fase.paso]}</span>
          </header>
          <div className="px-4 pb-3 pt-0.5">
            <h1 className="m-0 text-[22px] font-medium leading-[1.25]">Importar inventario</h1>
            <p className="mt-[3px] text-[12.5px] text-noct-neutral-500">
              Carga masiva desde Excel o CSV, con revisión antes de guardar
            </p>
          </div>
        </div>

        <main className="flex flex-1 flex-col gap-4 px-4 pb-[110px] pt-[18px]">
          {fase.paso === 'elegir' && (
            <>
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
                className="flex flex-col items-center gap-2.5 rounded-md border border-dashed border-noct-neutral-700 px-5 py-8 text-center text-noct-text transition-colors hover:border-noct-accent"
              >
                <UploadSimple size={32} className="text-noct-accent-300" aria-hidden />
                <span className="text-[14.5px] font-medium">Elegir archivo .xlsx o .csv</span>
                <span className="max-w-[280px] text-[12.5px] leading-[1.5] text-noct-neutral-500">
                  La primera fila debe traer los encabezados: Nombre, Categoría, Marca, Serial, Ubicación...
                </span>
              </button>

              <div className="flex flex-col gap-2 rounded-lg border border-noct-divider bg-noct-surface px-3.5 py-3">
                <p className="text-[13px] font-medium">Cómo se interpreta el archivo</p>
                <p className="text-[12.5px] leading-[1.55] text-noct-neutral-400">
                  Se reconocen encabezados parecidos ("No. de serie" cuenta como Serial, "Sede" como Ubicación).
                  Cualquier otra columna se guarda como propiedad del equipo. Las filas con serial o placa ya
                  registrados se detectan para no duplicar.
                </p>
                <button
                  type="button"
                  onClick={descargarPlantilla}
                  className="inline-flex items-center gap-1.5 self-start text-[12.5px] text-noct-accent-300 hover:text-noct-accent-400"
                >
                  <DownloadSimple size={14} aria-hidden />
                  Descargar plantilla CSV de ejemplo
                </button>
              </div>

              {fase.error && (
                <div className="flex items-start gap-2.5 rounded-md border border-noct-error/35 bg-noct-error/[.09] px-3 py-2.5">
                  <WarningOctagon size={16} className="mt-px shrink-0 text-noct-error" aria-hidden />
                  <p className="text-[13px] leading-[1.5]">{fase.error}</p>
                </div>
              )}
            </>
          )}

          {fase.paso === 'revisar' && mapeo && (
            <>
              <div className="flex items-center gap-2.5 rounded-md border border-noct-divider bg-noct-surface px-3 py-2.5">
                <CheckCircle size={20} className="shrink-0 text-noct-exito" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-[13.5px]">{fase.nombreArchivo}</span>
                <button
                  type="button"
                  onClick={() => setFase({ paso: 'elegir', error: null })}
                  className="shrink-0 p-1 text-[12px] text-noct-neutral-500 hover:text-noct-text"
                >
                  Cambiar
                </button>
              </div>

              {mapeo.errorGeneral ? (
                <div className="flex items-start gap-2.5 rounded-md border border-noct-error/35 bg-noct-error/[.09] px-3 py-2.5">
                  <WarningOctagon size={16} className="mt-px shrink-0 text-noct-error" aria-hidden />
                  <p className="text-[13px] leading-[1.5]">{mapeo.errorGeneral}</p>
                </div>
              ) : (
                <>
                  <section>
                    <TituloSeccion className="mb-2">Columnas detectadas</TituloSeccion>
                    <div className="flex flex-col gap-[5px]">
                      {mapeo.columnas
                        .filter((c) => c.destino.tipo !== 'ignorada')
                        .map((columna, indice) => {
                          const esCampo = columna.destino.tipo === 'campo'
                          return (
                            <p key={indice} className="flex items-center gap-2 text-[12.5px] text-noct-neutral-300">
                              {esCampo ? (
                                <CheckCircle size={14} className="shrink-0 text-noct-exito" aria-hidden />
                              ) : (
                                <Plus size={14} className="shrink-0 text-noct-accent-300" aria-hidden />
                              )}
                              "{columna.encabezado}" <span className="text-noct-neutral-600">→</span>{' '}
                              {columna.destino.tipo === 'campo'
                                ? ETIQUETA_CAMPO[columna.destino.campo]
                                : 'propiedad del equipo'}
                            </p>
                          )
                        })}
                    </div>
                  </section>

                  {mapeo.hayFilasSinCategoria && (
                    <label className="flex flex-col gap-1.5">
                      <span className="text-[12.5px] font-medium text-noct-neutral-400">
                        Categoría para las filas que no traen una
                      </span>
                      <select
                        value={categoriaPredeterminadaId}
                        onChange={(e) => setCategoriaPredeterminadaId(e.target.value)}
                        className={`min-h-11 ${CLASE_CAMPO}`}
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

                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-md border border-noct-exito/35 bg-noct-exito/[.08] p-2.5 text-center">
                      <p className="text-[20px] font-medium text-noct-exito">{mapeo.importables.length}</p>
                      <p className="mt-0.5 text-[11px] leading-[1.35] text-noct-neutral-400">nuevos</p>
                    </div>
                    <div className="rounded-md border border-noct-precaucion/35 bg-noct-precaucion/[.08] p-2.5 text-center">
                      <p className="text-[20px] font-medium text-noct-precaucion">{mapeo.omitidas.length}</p>
                      <p className="mt-0.5 text-[11px] leading-[1.35] text-noct-neutral-400">se omiten</p>
                    </div>
                  </div>

                  {mapeo.omitidas.length > 0 && (
                    <section>
                      <button
                        type="button"
                        onClick={() => setOmitidasAbiertas((v) => !v)}
                        aria-expanded={omitidasAbiertas}
                        className="flex min-h-11 w-full items-center gap-2 px-0.5 py-1 text-left"
                      >
                        <Warning size={15} className="shrink-0 text-noct-precaucion" aria-hidden />
                        <span className="text-[13px] font-medium">
                          {mapeo.omitidas.length} {mapeo.omitidas.length === 1 ? 'fila se omite' : 'filas se omiten'}
                        </span>
                        {omitidasAbiertas ? (
                          <CaretUp size={13} className="ml-auto text-noct-neutral-500" aria-hidden />
                        ) : (
                          <CaretDown size={13} className="ml-auto text-noct-neutral-500" aria-hidden />
                        )}
                      </button>
                      {omitidasAbiertas && (
                        <div className="flex flex-col gap-[5px] py-1 pl-[25px] pr-1">
                          {mapeo.omitidas.slice(0, 30).map((fila) => (
                            <p key={fila.numeroFila} className="text-[12.5px] text-noct-neutral-400">
                              Fila {fila.numeroFila}: {fila.motivo}
                            </p>
                          ))}
                          {mapeo.omitidas.length > 30 && (
                            <p className="text-[12.5px] text-noct-neutral-500">
                              ... y {mapeo.omitidas.length - 30} filas más.
                            </p>
                          )}
                        </div>
                      )}
                    </section>
                  )}

                  {mapeo.importables.length > 0 && (
                    <section>
                      <TituloSeccion className="mb-2">Vista previa (primeras filas)</TituloSeccion>
                      <div className="flex flex-col">
                        {mapeo.importables.slice(0, 6).map((fila) => {
                          const detalle = [
                            nombreCategoria.get(fila.datos.categoriaId),
                            fila.datos.ubicacion,
                            fila.datos.ip,
                          ]
                            .filter(Boolean)
                            .join(' · ')
                          return (
                            <div
                              key={fila.numeroFila}
                              className="flex min-h-12 items-center gap-[11px] border-b border-noct-divider py-2.5 last:border-b-0"
                            >
                              <span className="inline-flex min-h-[22px] shrink-0 items-center whitespace-nowrap rounded-full border border-noct-exito/40 px-2 text-[10.5px] font-medium text-noct-exito">
                                Nuevo
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[13px] font-medium leading-[1.3]">
                                  {fila.datos.nombre}
                                </span>
                                {detalle && (
                                  <span className="mt-px block truncate text-[11.5px] text-noct-neutral-500">
                                    {detalle}
                                  </span>
                                )}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                      {mapeo.importables.length > 6 && (
                        <p className="mt-2 text-[12px] text-noct-neutral-600">
                          ... y {mapeo.importables.length - 6} filas más.
                        </p>
                      )}
                    </section>
                  )}
                </>
              )}
            </>
          )}

          {fase.paso === 'importando' && (
            <div className="flex flex-col gap-3.5 py-6">
              <p className="text-[14px]">
                Importando {fase.avance} de {fase.total}...
              </p>
              <span className="block h-1 overflow-hidden rounded-full bg-noct-neutral-900">
                <span
                  className="block h-full rounded-full bg-noct-accent transition-[width] duration-150"
                  style={{ width: `${fase.total === 0 ? 0 : Math.round((fase.avance / fase.total) * 100)}%` }}
                />
              </span>
              <p className="text-[12.5px] leading-[1.5] text-noct-neutral-500">
                No cerrar la aplicación. Cada equipo queda con la nota del archivo de origen en su historial.
              </p>
            </div>
          )}

          {fase.paso === 'terminado' && (
            <>
              <div className="rounded-md border border-noct-exito/35 bg-noct-exito/[.09] p-3.5">
                <p className="text-[11px] font-medium uppercase tracking-[0.07em] text-noct-exito">
                  Importación completada
                </p>
                <p className="mt-1.5 text-[14.5px] leading-[1.5]">
                  {fase.importados} {fase.importados === 1 ? 'dispositivo importado' : 'dispositivos importados'}.
                  {fase.fallidos > 0 && ` ${fase.fallidos} filas fallaron al guardarse.`} Los cambios se sincronizan
                  solos con el resto del equipo.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/dispositivos')}
                className={`${BTN_PRIMARIO} min-h-12 justify-center`}
              >
                Ver dispositivos
              </button>
              <button
                type="button"
                onClick={() => setFase({ paso: 'elegir', error: null })}
                className={`${BTN_GHOST} self-center`}
              >
                Importar otro archivo
              </button>
            </>
          )}
        </main>

        {fase.paso === 'revisar' && mapeo && !mapeo.errorGeneral && (
          <div className="fixed bottom-0 left-1/2 z-30 w-full max-w-md -translate-x-1/2 border-t border-noct-divider bg-noct-bg/90 px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 backdrop-blur-[12px]">
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setFase({ paso: 'elegir', error: null })}
                className={`${BTN_SECUNDARIO} px-4 py-[11px]`}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={mapeo.importables.length === 0}
                onClick={importar}
                className={`flex-1 ${BTN_PRIMARIO} justify-center py-[11px] disabled:opacity-50`}
              >
                <DownloadSimple size={15} aria-hidden />
                Importar {mapeo.importables.length} {mapeo.importables.length === 1 ? 'dispositivo' : 'dispositivos'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
