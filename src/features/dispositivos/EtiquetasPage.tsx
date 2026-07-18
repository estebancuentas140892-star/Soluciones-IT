import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { BotonVolver } from '../../components/BotonVolver'
import QRCode from 'qrcode'
import { db, type Dispositivo } from '../../lib/db'

// Etiquetas QR imprimibles para pegar en los equipos. Cada etiqueta
// codifica la URL de la ficha del dispositivo; al escanearla (con la
// pantalla de escaneo o con la camara normal del telefono) se abre la
// ficha. Vive fuera del Layout para imprimir sin la barra inferior;
// los controles de pantalla se ocultan con print:hidden.

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

  const seleccionados = useMemo(() => {
    const lista = categoriaId
      ? dispositivos.filter((d) => d.categoriaId === categoriaId)
      : dispositivos
    return [...lista].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  }, [dispositivos, categoriaId])

  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col gap-4 bg-slate-950 px-4 pt-6 pb-8 text-slate-100 print:block print:min-h-0 print:max-w-none print:bg-white print:p-0 print:text-black">
      <header className="flex flex-col gap-2 print:hidden">
        <BotonVolver />
        <div>
          <h1 className="text-xl font-semibold">Etiquetas QR</h1>
          <p className="text-sm text-slate-400">
            Imprime las etiquetas y pégalas en los equipos: al escanearlas se abre la ficha del
            dispositivo
          </p>
        </div>
      </header>

      <div className="flex gap-2 print:hidden">
        <select
          value={categoriaId}
          onChange={(evento) => setCategoriaId(evento.target.value)}
          className="flex-1 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
        >
          <option value="">Todas las categorías</option>
          {categorias.map((categoria) => (
            <option key={categoria.id} value={categoria.id}>
              {categoria.nombre}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => window.print()}
          disabled={seleccionados.length === 0}
          className="shrink-0 rounded-xl bg-sky-500 px-4 py-2 text-xs font-medium text-slate-950 disabled:opacity-50"
        >
          Imprimir
        </button>
      </div>

      {seleccionados.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-800 px-4 py-6 text-center text-sm text-slate-500 print:hidden">
          No hay dispositivos en esta categoría
        </p>
      ) : (
        <p className="text-xs text-slate-500 print:hidden">
          {seleccionados.length === 1 ? '1 etiqueta' : `${seleccionados.length} etiquetas`}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 print:grid-cols-3 print:gap-3">
        {seleccionados.map((dispositivo) => (
          <Etiqueta key={dispositivo.id} dispositivo={dispositivo} />
        ))}
      </div>
    </div>
  )
}

function Etiqueta({ dispositivo }: { dispositivo: Dispositivo }) {
  // El QR lleva la URL absoluta para que tambien lo entienda la
  // camara normal del telefono, no solo el escaner de la app.
  const url = `${window.location.origin}/dispositivos/${dispositivo.id}`
  const codigo = dispositivo.placaInventario || dispositivo.serial

  return (
    <div className="flex break-inside-avoid flex-col items-center gap-1 rounded-xl bg-white p-3 text-center print:rounded-md print:border print:border-black/40">
      <ImagenQr valor={url} alt={`Etiqueta QR de ${dispositivo.nombre}`} />
      <p className="text-xs font-semibold text-black">{dispositivo.nombre}</p>
      {codigo && <p className="break-all text-[10px] text-black/70">{codigo}</p>}
      {dispositivo.ubicacion && (
        <p className="text-[10px] text-black/70">{dispositivo.ubicacion}</p>
      )}
    </div>
  )
}

function ImagenQr({ valor, alt }: { valor: string; alt: string }) {
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

  if (!imagen) return <div className="h-28 w-28" aria-hidden />
  return <img src={imagen} alt={alt} className="h-28 w-28" />
}
