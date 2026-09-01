import { useLiveQuery } from 'dexie-react-hooks'
import type { ReactNode } from 'react'
import { db } from '../../lib/db'
import { normalizarProcedimiento } from '../../lib/procedimiento'
import { Modal } from '../../components/Modal'
import { ArrowRight, Camera, CaretRight, Warning, Wrench } from '../../components/iconos'
import { fraseAvanceConservado } from './salidasFalla'

// La hoja "Algo va mal en el paso N" (handoff "Diseño móvil", tablero
// 3d).
//
// El hueco que cierra: la válvula de escape de la ejecución
// ("¿Ocurrió algún error durante este paso?") era el control MÁS
// PEQUEÑO de la pantalla, 28 px de alto con texto de 12, y solo
// aparecía cuando `trabajoPrevio` era verdadero, es decir cuando ya
// estaban marcadas todas las tareas del paso. Si el paso fallaba no se
// podían marcar, así que la salida no se mostraba nunca: existía justo
// cuando ya no hacía falta. Además reemplazaba la barra de acción fija,
// así que al aparecer la pantalla se quedaba sin acción dominante y el
// layout saltaba.
//
// Ahora el botón "Falla" es permanente y esta hoja es lo que abre. La
// pregunta desapareció: preguntar "¿ocurrió un error?" al que acaba de
// pulsar "Falla" es hacerle repetir lo que ya dijo. Lo que se le
// ofrece son las salidas reales, cada una de 56 a 60 px.
//
// Ninguna salida borra progreso, y la hoja lo dice antes de que elija:
// el técnico está de pie frente al equipo con el procedimiento a
// medias, y la duda de "¿pierdo lo que llevo?" es lo que lo hace no
// tocar el botón.

interface Props {
  abierto: boolean
  onCerrar: () => void
  // 1-based: es el número que el técnico ve en la banda del paso.
  numeroPaso: number
  // Pasos ya completados del procedimiento, para la promesa de arriba.
  pasosHechos: number
  // La tarea concreta en la que el técnico declaró la falla, cuando
  // viene del modo foco. En la vista completa no hay una tarea señalada.
  tarea: string | null
  solucionArticuloId: string | null
  solucionArticuloTitulo: string
  onAbrirContingencia: () => void
  // `null` cuando el procedimiento no tiene equipo afectado donde
  // registrar la evidencia: sin equipo no hay historial al que adjuntar
  // la foto, y una salida que no lleva a ninguna parte estorba más de
  // lo que ayuda.
  onFotografiar: (() => void) | null
  // `null` cuando no hay a dónde saltar (ver `destinoAlSaltar`).
  onSaltar: (() => void) | null
}

const ID_TITULO = 'hoja-falla-titulo'

// Salida de la hoja: 56 px de alto (60 la primera, que lleva segunda
// línea), texto de 16 y toda la fila como objetivo.
function Salida({
  Icono,
  titulo,
  detalle,
  tono = 'neutro',
  onClick,
}: {
  Icono: typeof Wrench
  titulo: string
  detalle?: ReactNode
  tono?: 'precaucion' | 'neutro'
  onClick: () => void
}) {
  const clases =
    tono === 'precaucion'
      ? 'border-noct-precaucion/60 bg-noct-precaucion/10 active:bg-noct-precaucion/[.24]'
      : 'border-noct-text/[.26] active:bg-noct-text/10'
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[56px] w-full items-center gap-3 rounded-[11px] border-[1.5px] px-3.5 py-2 text-left text-noct-text ${clases}`}
    >
      <Icono
        size={20}
        className={`shrink-0 ${tono === 'precaucion' ? 'text-noct-precaucion' : 'text-noct-neutral-300'}`}
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-medium leading-tight">{titulo}</span>
        {detalle && <span className="mt-0.5 block text-[12.5px] text-noct-neutral-400">{detalle}</span>}
      </span>
      <CaretRight size={16} className="shrink-0 text-noct-neutral-400" aria-hidden />
    </button>
  )
}

export function HojaFalla({
  abierto,
  onCerrar,
  numeroPaso,
  pasosHechos,
  tarea,
  solucionArticuloId,
  solucionArticuloTitulo,
  onAbrirContingencia,
  onFotografiar,
  onSaltar,
}: Props) {
  // Solo se consulta con la hoja abierta: el paso en ejecución se
  // vuelve a pintar en cada marca de tarea y esta guía no se necesita
  // hasta que algo falla.
  const contingencia = useLiveQuery(
    async () => {
      if (!abierto || !solucionArticuloId) return null
      const articulo = await db.articulos.get(solucionArticuloId)
      if (!articulo || articulo.eliminadoEn) return 'rota' as const
      return {
        titulo: articulo.titulo,
        pasos: normalizarProcedimiento(articulo.procedimiento)?.pasos.length ?? 0,
      }
    },
    [abierto, solucionArticuloId],
  )

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} tituloId={ID_TITULO}>
      <div className="flex flex-col gap-2">
        <span id={ID_TITULO} className="flex items-center gap-2 text-[18px] font-medium leading-tight text-noct-text">
          <Warning size={20} className="shrink-0 text-noct-precaucion" aria-hidden />
          Algo va mal en el paso {numeroPaso}
        </span>

        {/* La tarea señalada, cuando la falla se declaró desde el modo
            foco: es el dato que el técnico acaba de dar y que la hoja
            no debe hacerle repetir. */}
        {tarea && (
          <p className="text-[13.5px] leading-snug text-noct-neutral-300">
            En «<span className="text-noct-text">{tarea}</span>».
          </p>
        )}

        <p className="mb-1.5 text-[13.5px] leading-[1.45] text-noct-neutral-400">
          {fraseAvanceConservado(pasosHechos)}
        </p>

        {contingencia && contingencia !== 'rota' && (
          <Salida
            Icono={Wrench}
            tono="precaucion"
            titulo="Abrir la contingencia vinculada"
            detalle={
              <>
                «{contingencia.titulo}»
                {contingencia.pasos > 0
                  ? ` · ${contingencia.pasos} ${contingencia.pasos === 1 ? 'paso' : 'pasos'}`
                  : ''}
              </>
            }
            onClick={onAbrirContingencia}
          />
        )}

        {contingencia === 'rota' && (
          <p className="rounded-[10px] border border-noct-precaucion/35 bg-noct-precaucion/10 px-3 py-2.5 text-[13px] leading-normal text-noct-precaucion">
            La contingencia vinculada{solucionArticuloTitulo ? ` "${solucionArticuloTitulo}"` : ''} ya no está
            disponible. Edita la guía para vincular otra.
          </p>
        )}

        {/* Sin vínculo la hoja lo dice en vez de callarlo: así el
            técnico sabe que no hay una guía esperándolo y deja de
            buscarla. */}
        {!solucionArticuloId && (
          <p className="text-[12.5px] leading-normal text-noct-neutral-400">
            Este paso no tiene una guía de contingencia vinculada.
          </p>
        )}

        {onFotografiar && (
          <Salida Icono={Camera} titulo="Fotografiar y anotar el problema" onClick={onFotografiar} />
        )}

        {onSaltar && (
          <Salida
            Icono={ArrowRight}
            titulo="Saltar el paso y seguir"
            detalle="Queda sin marcar y el índice lo señala como saltado"
            onClick={onSaltar}
          />
        )}

        <button
          type="button"
          onClick={onCerrar}
          className="mt-1 flex min-h-12 w-full items-center justify-center rounded-[11px] text-[15px] font-medium text-noct-neutral-400 active:bg-noct-text/[.08]"
        >
          Cancelar
        </button>
      </div>
    </Modal>
  )
}
