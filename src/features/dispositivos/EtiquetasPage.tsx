import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { BotonVolver } from '../../components/BotonVolver'
import { Check, Printer, QrCode } from '../../components/iconos'
import { BTN_PRIMARIO } from '../../components/nocturne'
import { db, type Dispositivo } from '../../lib/db'

// Etiquetas QR imprimibles para pegar en los equipos, re-autorizadas al
// sistema Nocturne (handoff "Rediseño de aplicación empresarial",
// Etiquetas QR.dc.html). Cada etiqueta codifica la URL de la ficha del
// dispositivo; al escanearla (con la pantalla de escaneo o con la camara
// normal del telefono) se abre la ficha. Fiel al mockup: filtro por
// chips de categoria, seleccion por tarjeta (con "Seleccionar/Quitar
// todas") y barra inferior fija que imprime SOLO las marcadas. Vive
// fuera del Layout para imprimir sin el shell de la app; en pantalla se
// ve el sistema Nocturne y al imprimir la hoja pasa a blanco (3 por fila
// en carta). La logica de generacion del QR y de impresion no cambia.
export function EtiquetasPage() {
  const categorias = useLiveQuery(
    () => db.categorias.filter((c) => !c.eliminadoEn).sortBy('orden'),
    [],
    [],
  )
  const dispositivos = useLiveQuery(
    () => db.dispositivos.filter((d) => !d.eliminadoEn).toArray(),
    [],
    [],
  )
  const [categoriaId, setCategoriaId] = useState('')
  // Se guardan las DESeleccionadas (no las marcadas): asi, por defecto,
  // todo equipo nuevo o recien cargado entra ya marcado, sin tener que
  // sincronizar un Set de marcadas con la carga asincrona de Dexie.
  const [deseleccionadas, setDeseleccionadas] = useState<Set<string>>(new Set())

  const visibles = useMemo(() => {
    const lista = categoriaId ? dispositivos.filter((d) => d.categoriaId === categoriaId) : dispositivos
    return [...lista].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { numeric: true }))
  }, [dispositivos, categoriaId])

  const marcadas = useMemo(() => visibles.filter((d) => !deseleccionadas.has(d.id)), [visibles, deseleccionadas])
  const todasMarcadas = marcadas.length === visibles.length && visibles.length > 0

  function alternar(id: string) {
    setDeseleccionadas((actuales) => {
      const copia = new Set(actuales)
      if (copia.has(id)) copia.delete(id)
      else copia.add(id)
      return copia
    })
  }

  function alternarTodas() {
    setDeseleccionadas((actuales) => {
      const copia = new Set(actuales)
      if (todasMarcadas) for (const d of visibles) copia.add(d.id)
      else for (const d of visibles) copia.delete(d.id)
      return copia
    })
  }

  const n = marcadas.length
  const resumen =
    n === 0 ? 'Ninguna etiqueta seleccionada' : `${n} de ${visibles.length} seleccionadas`

  return (
    <div className="nocturne min-h-svh bg-noct-bg font-inter text-[15px] leading-[1.55] text-noct-text print:block print:min-h-0 print:bg-white print:text-black">
      {/* Interfaz de pantalla (no se imprime). */}
      <div className="mx-auto flex min-h-svh max-w-md flex-col print:hidden">
        <div className="sticky top-0 z-20 border-b border-noct-divider bg-noct-bg/[.92] backdrop-blur-[12px]">
          <header className="flex items-center justify-between gap-2 py-2.5 pl-2 pr-3 pb-0">
            <BotonVolver to="/dispositivos">
              Dispositivos
            </BotonVolver>
          </header>
          <div className="px-4 pb-2.5 pt-0.5">
            <h1 className="m-0 text-[22px] font-medium leading-[1.25]">Etiquetas QR</h1>
            <p className="mt-[3px] text-[12.5px] text-noct-neutral-500">
              Imprimir y pegar en los equipos: al escanear se abre su ficha
            </p>
          </div>
          {categorias.length > 0 && (
            <div className="flex gap-[7px] overflow-x-auto px-4 pb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {[{ id: '', nombre: 'Todas' }, ...categorias].map((c) => {
                const activa = c.id === categoriaId
                return (
                  <button
                    key={c.id || '__todas'}
                    type="button"
                    aria-pressed={activa}
                    onClick={() => setCategoriaId(c.id)}
                    className={`inline-flex min-h-9 shrink-0 items-center whitespace-nowrap rounded-full border px-[13px] text-[13px] font-medium transition-colors ${
                      activa
                        ? 'border-noct-accent bg-noct-accent/[.12] text-noct-accent-300'
                        : 'border-noct-divider text-noct-neutral-300 hover:bg-noct-text/[.05]'
                    }`}
                  >
                    {c.nombre}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <main className="flex flex-1 flex-col gap-3 px-4 pb-[110px] pt-3.5">
          {visibles.length > 0 ? (
            <>
              <div className="flex items-center justify-between gap-2.5 px-0.5">
                <span className="text-[12.5px] text-noct-neutral-500">{resumen}</span>
                <button
                  type="button"
                  onClick={alternarTodas}
                  className="whitespace-nowrap px-0.5 py-1.5 text-[12.5px] font-medium text-noct-accent-300 hover:text-noct-accent-400"
                >
                  {todasMarcadas ? 'Quitar todas' : 'Seleccionar todas'}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {visibles.map((d) => (
                  <EtiquetaTarjeta
                    key={d.id}
                    dispositivo={d}
                    marcada={!deseleccionadas.has(d.id)}
                    onToggle={() => alternar(d.id)}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-noct-neutral-700 px-6 py-10 text-center">
              <QrCode size={30} className="text-noct-neutral-600" aria-hidden />
              <p className="text-[13px] leading-[1.5] text-noct-neutral-400">No hay dispositivos en esta categoría.</p>
            </div>
          )}
        </main>

        <div className="fixed bottom-0 left-1/2 z-30 w-full max-w-md -translate-x-1/2 border-t border-noct-divider bg-noct-bg/90 px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 backdrop-blur-[12px]">
          <div className="flex items-center gap-2.5">
            <span className="flex-1 text-[12px] text-noct-neutral-500">Formato: 3 por fila en hoja carta</span>
            <button
              type="button"
              onClick={() => window.print()}
              disabled={n === 0}
              className={`${BTN_PRIMARIO} min-h-[46px] whitespace-nowrap px-4 disabled:opacity-50`}
            >
              <Printer size={15} aria-hidden />
              {n > 0 ? `Imprimir ${n}` : 'Imprimir'}
            </button>
          </div>
        </div>
      </div>

      {/* Hoja de impresion: solo las etiquetas marcadas, en blanco. */}
      <div className="hidden grid-cols-3 gap-3 print:grid">
        {marcadas.map((d) => (
          <EtiquetaImprimible key={d.id} dispositivo={d} />
        ))}
      </div>
    </div>
  )
}

// Tarjeta seleccionable en pantalla: miniatura del QR real, casilla de
// selección, nombre, código (placa o serie) y ubicación.
function EtiquetaTarjeta({
  dispositivo,
  marcada,
  onToggle,
}: {
  dispositivo: Dispositivo
  marcada: boolean
  onToggle: () => void
}) {
  const url = `${window.location.origin}/dispositivos/${dispositivo.id}`
  const codigo = dispositivo.placaInventario || dispositivo.serial

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={marcada}
      className={`relative flex flex-col items-center gap-1.5 rounded-md border bg-noct-surface px-2.5 pb-3 pt-3.5 text-center text-noct-text transition-colors ${
        marcada ? 'border-noct-accent' : 'border-noct-divider'
      }`}
    >
      <span
        className={`absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-md border-[1.5px] ${
          marcada ? 'border-noct-accent bg-noct-accent' : 'border-noct-neutral-600 bg-transparent'
        }`}
      >
        {marcada && <Check size={13} className="text-noct-bg" aria-hidden />}
      </span>
      <span className="flex h-[88px] w-[88px] items-center justify-center overflow-hidden rounded-md bg-white">
        <ImagenQr valor={url} alt={`Etiqueta QR de ${dispositivo.nombre}`} className="h-[88px] w-[88px]" />
      </span>
      <span className="text-pretty text-[12.5px] font-medium leading-[1.3]">{dispositivo.nombre}</span>
      {codigo && <span className="break-all font-mono text-[10.5px] text-noct-neutral-500">{codigo}</span>}
      {dispositivo.ubicacion && <span className="text-[10.5px] text-noct-neutral-500">{dispositivo.ubicacion}</span>}
    </button>
  )
}

// Etiqueta blanca para la hoja impresa (3 por fila en carta).
function EtiquetaImprimible({ dispositivo }: { dispositivo: Dispositivo }) {
  const url = `${window.location.origin}/dispositivos/${dispositivo.id}`
  const codigo = dispositivo.placaInventario || dispositivo.serial

  return (
    <div className="flex break-inside-avoid flex-col items-center gap-1 rounded-md border border-black/40 bg-white p-3 text-center text-black">
      <ImagenQr valor={url} alt={`Etiqueta QR de ${dispositivo.nombre}`} className="h-28 w-28" />
      <p className="text-xs font-semibold">{dispositivo.nombre}</p>
      {codigo && <p className="break-all text-[10px] text-black/70">{codigo}</p>}
      {dispositivo.ubicacion && <p className="text-[10px] text-black/70">{dispositivo.ubicacion}</p>}
    </div>
  )
}

function ImagenQr({ valor, alt, className }: { valor: string; alt: string; className: string }) {
  const [imagen, setImagen] = useState('')

  useEffect(() => {
    let cancelado = false
    QRCode.toDataURL(valor, { errorCorrectionLevel: 'M', margin: 1, scale: 6 })
      .then((datos) => {
        if (!cancelado) setImagen(datos)
      })
      .catch(() => {
        // Si el QR no se puede generar, la etiqueta queda sin imagen.
      })
    return () => {
      cancelado = true
    }
  }, [valor])

  if (!imagen) return <div className={className} aria-hidden />
  return <img src={imagen} alt={alt} className={className} />
}
