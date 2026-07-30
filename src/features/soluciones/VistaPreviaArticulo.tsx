import { useEffect } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { db, type Procedimiento, type TipoArticulo } from '../../lib/db'
import { useUrlAdjunto } from '../../components/useUrlAdjunto'
import { TagNeutral } from '../../components/nocturne'
import { ProcedimientoVista } from './ProcedimientoVista'
import { etiquetaDeTipo } from './tiposArticulo'

interface Props {
  // Id del articulo en edicion: la vista previa usa un id derivado
  // ("vista-previa:<id>") para que las casillas que se marquen aqui
  // jamas toquen el progreso real del articulo.
  articuloId: string
  titulo: string
  tipo: TipoArticulo
  etiquetas: string[]
  procedimiento: Procedimiento | null
  contenido: string
  onCerrar: () => void
}

// Vista previa del articulo ANTES de guardarlo (fase S1): muestra
// exactamente lo que vera el tecnico (portada, descripcion,
// procedimiento interactivo y notas en Markdown) con los datos en
// memoria del formulario. No guarda nada; el unico rastro (el
// progreso efimero de las casillas de prueba) se borra al cerrar.
// Se carga en diferido desde el formulario para no sumar el peso de
// react-markdown a la apertura del editor.
export function VistaPreviaArticulo({
  articuloId,
  titulo,
  tipo,
  etiquetas,
  procedimiento,
  contenido,
  onCerrar,
}: Props) {
  const idEfimero = `vista-previa:${articuloId}`
  const urlPortada = useUrlAdjunto(procedimiento?.portada?.referencia ?? null)

  useEffect(() => {
    function alTeclado(evento: KeyboardEvent) {
      if (evento.key === 'Escape') onCerrar()
    }
    document.addEventListener('keydown', alTeclado)
    const overflowPrevio = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', alTeclado)
      document.body.style.overflow = overflowPrevio
      // Limpia el progreso efimero de la prueba al cerrar.
      void db.progresoPasos.delete(idEfimero)
    }
  }, [onCerrar, idEfimero])

  return (
    <div className="nocturne fixed inset-0 z-[70] overflow-y-auto bg-noct-bg font-inter text-noct-text">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-noct-divider bg-noct-bg/[.92] px-4 py-3 backdrop-blur-[12px]">
        <p className="text-sm font-medium text-noct-text">
          Vista previa
          <span className="ml-2 rounded-full border border-noct-precaucion/50 bg-noct-precaucion/[.14] px-2 py-0.5 text-[10px] text-noct-precaucion">
            Sin guardar
          </span>
        </p>
        <button
          type="button"
          onClick={onCerrar}
          className="rounded-lg border border-noct-divider px-3 py-1.5 text-xs text-noct-text hover:bg-noct-text/[.07]"
        >
          Cerrar
        </button>
      </div>

      <div className="mx-auto flex max-w-2xl flex-col gap-5 px-4 pt-5 pb-10">
        {urlPortada && (
          <img
            src={urlPortada}
            alt={`Portada: ${titulo}`}
            className="max-h-44 w-full rounded-xl border border-noct-divider object-cover"
          />
        )}

        <div>
          <h1 className="text-xl font-semibold">{titulo || '(Sin título)'}</h1>
          <p className="text-xs text-noct-neutral-500">{etiquetaDeTipo(tipo)}</p>
          {etiquetas.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {etiquetas.map((etiqueta) => (
                <li key={etiqueta}>
                  <TagNeutral>{etiqueta}</TagNeutral>
                </li>
              ))}
            </ul>
          )}
        </div>

        {procedimiento?.descripcion && (
          <p className="rounded-xl border border-noct-divider bg-noct-surface px-4 py-3 text-sm text-noct-neutral-200">
            {procedimiento.descripcion}
          </p>
        )}

        {procedimiento && (
          <ProcedimientoVista articuloId={idEfimero} procedimiento={procedimiento} />
        )}

        {contenido.trim() !== '' && (
          <article className="prose prose-invert prose-sm max-w-none prose-headings:font-medium prose-headings:text-noct-text prose-p:text-noct-neutral-200 prose-li:text-noct-neutral-200 prose-strong:text-noct-text prose-a:text-noct-accent-400">
            <Markdown remarkPlugins={[remarkGfm]}>{contenido}</Markdown>
          </article>
        )}

        {!procedimiento && contenido.trim() === '' && (
          <p className="rounded-xl border border-dashed border-noct-divider px-4 py-6 text-center text-sm text-noct-neutral-500">
            Todavía no hay contenido para previsualizar.
          </p>
        )}
      </div>
    </div>
  )
}
