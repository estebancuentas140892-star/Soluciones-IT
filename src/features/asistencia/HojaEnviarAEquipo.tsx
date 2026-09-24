import { useMemo, useState, useSyncExternalStore } from 'react'
import { Modal } from '../../components/Modal'
import { CloudSlash, PlugsConnected, WarningCircle, X } from '../../components/iconos'
import { BTN_GHOST_PELIGRO, BTN_PRIMARIO, BTN_SECUNDARIO } from '../../components/nocturne'
import type { PasoProcedimiento, Referencia } from '../../lib/db'
import { TEXTO_ERROR, type ErrorAsistencia } from './apiTecnico'
import { construirContenidoDePaso, type Apartado } from './contenidoPaso'
import { formatoCodigo } from './modelo'
import { desconectarEquipo, enviarAlEquipo, type SesionAsistencia } from './sesionAsistencia'
import { VistaContenidoAsistencia } from './VistaContenidoAsistencia'

// "ENVIAR A ESTE EQUIPO" (tarea 258, secciones 11 y 12 del encargo).
//
// Vista previa OBLIGATORIA: el tecnico ve exactamente lo que el
// computador mostrara (el mismo componente que el portal) y solo al
// confirmar se envia. Lo que el constructor aparto (forma de secreto,
// demasiado largo) se dice, sin repetir su contenido. Sin conexion no se
// envia nada y la guia sigue igual: el portal es una ayuda, no una
// dependencia.

const ID_TITULO = 'hoja-enviar-equipo-titulo'

function suscribirRed(avisar: () => void) {
  window.addEventListener('online', avisar)
  window.addEventListener('offline', avisar)
  return () => {
    window.removeEventListener('online', avisar)
    window.removeEventListener('offline', avisar)
  }
}

function useEnLinea(): boolean {
  return useSyncExternalStore(suscribirRed, () => navigator.onLine, () => true)
}

const PALABRA_MOTIVO: Record<Apartado['motivo'], string> = {
  secreto: 'parece un dato protegido',
  largo: 'es demasiado largo',
  limite: 'no cabe en un envío',
}

function textoApartados(apartados: Apartado[]): string[] {
  return apartados.map((a) => `No se envía ${a.que}: ${PALABRA_MOTIVO[a.motivo]}.`)
}

interface Props {
  abierto: boolean
  onCerrar: () => void
  onEnviado: () => void
  sesion: SesionAsistencia
  paso: PasoProcedimiento
  numeroPaso: number
  tituloGuia: string
  referencias: Map<string, Referencia>
  /** La acción a la vista (modo de una acción a la vez), o null. */
  tareaId: string | null
}

export function HojaEnviarAEquipo({
  abierto,
  onCerrar,
  onEnviado,
  sesion,
  paso,
  numeroPaso,
  tituloGuia,
  referencias,
  tareaId,
}: Props) {
  const enLinea = useEnLinea()
  const [soloAccion, setSoloAccion] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<ErrorAsistencia | null>(null)

  const { contenido, apartados } = useMemo(
    () =>
      construirContenidoDePaso({
        paso,
        numeroPaso,
        tituloGuia,
        referencias,
        tareaId: soloAccion ? tareaId : null,
      }),
    [paso, numeroPaso, tituloGuia, referencias, tareaId, soloAccion],
  )

  function cerrar() {
    setError(null)
    setSoloAccion(false)
    onCerrar()
  }

  async function enviar() {
    if (!contenido || enviando) return
    setEnviando(true)
    setError(null)
    const respuesta = await enviarAlEquipo(sesion.usuario, contenido)
    setEnviando(false)
    if (!respuesta.ok) {
      setError(respuesta.error)
      return
    }
    setSoloAccion(false)
    onEnviado()
  }

  return (
    <Modal abierto={abierto} onCerrar={cerrar} tituloId={ID_TITULO}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <span className="min-w-0">
          <span id={ID_TITULO} className="block text-[17px] font-medium leading-tight text-noct-text">
            Enviar a este equipo
          </span>
          <span className="mt-1 flex items-center gap-1.5 text-[12.5px] text-noct-neutral-300">
            <PlugsConnected size={14} className="shrink-0 text-noct-exito" aria-hidden />
            Conectado al equipo <span className="font-mono tracking-[.08em]">{formatoCodigo(sesion.codigo)}</span>
          </span>
        </span>
        <button
          type="button"
          onClick={cerrar}
          aria-label="Cerrar sin enviar"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-noct-text/[.08] text-noct-text hover:bg-noct-text/[.14]"
        >
          <X size={20} aria-hidden />
        </button>
      </div>

      {/* Todo el paso o solo la acción a la vista. Solo cuando hay una. */}
      {tareaId && (
        <div role="radiogroup" aria-label="Qué enviar" className="mb-3 grid grid-cols-2 gap-1.5">
          {[
            { valor: false, rotulo: 'Todo el paso' },
            { valor: true, rotulo: 'Solo esta acción' },
          ].map((opcion) => (
            <button
              key={opcion.rotulo}
              type="button"
              role="radio"
              aria-checked={soloAccion === opcion.valor}
              onClick={() => setSoloAccion(opcion.valor)}
              className={`flex h-11 items-center justify-center rounded-lg border text-[13.5px] font-medium ${
                soloAccion === opcion.valor
                  ? 'border-noct-accent bg-noct-accent/[.12] text-noct-accent-300'
                  : 'border-noct-divider text-noct-neutral-300 hover:bg-noct-text/[.06]'
              }`}
            >
              {opcion.rotulo}
            </button>
          ))}
        </div>
      )}

      {/* Lo que NO se envía, antes de la vista previa: se lee antes de decidir. */}
      {apartados.length > 0 && (
        <ul className="mb-3 flex flex-col gap-1">
          {textoApartados(apartados).map((texto, i) => (
            <li key={i} className="flex items-start gap-2 text-[12.5px] leading-snug text-noct-neutral-300">
              <WarningCircle size={14} className="mt-px shrink-0 text-noct-neutral-400" aria-hidden />
              {texto}
            </li>
          ))}
        </ul>
      )}

      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[.06em] text-noct-neutral-400">
        Así se verá en el equipo
      </p>
      {contenido ? (
        <VistaContenidoAsistencia contenido={contenido} />
      ) : (
        <p className="rounded-xl border border-dashed border-noct-neutral-700 px-3 py-3 text-[13.5px] text-noct-neutral-300">
          Este paso no tiene nada que se pueda enviar: ni acciones, ni comandos, ni enlaces.
        </p>
      )}

      {!enLinea && (
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-noct-text/[.05] px-3 py-2.5 text-[13px] leading-snug text-noct-neutral-200">
          <CloudSlash size={16} className="mt-px shrink-0 text-noct-neutral-400" aria-hidden />
          Sin conexión: la guía sigue aquí. Envía cuando vuelva la red.
        </p>
      )}

      {error && (
        <p role="alert" className="mt-3 text-[13px] leading-snug text-noct-error">
          {TEXTO_ERROR[error]}
        </p>
      )}

      {/* Las acciones, siempre a la vista: la vista previa de un paso largo
          ocupa más que la pantalla y "Enviar" no puede quedar debajo. */}
      <div className="sticky -bottom-5 -mx-5 -mb-5 mt-4 flex flex-col gap-2 border-t border-noct-divider bg-noct-surface px-5 pb-5 pt-3">
        <button
          type="button"
          onClick={() => void enviar()}
          disabled={!contenido || !enLinea || enviando}
          className={`min-h-11 justify-center ${BTN_PRIMARIO} disabled:opacity-40`}
        >
          {enviando ? 'Enviando…' : 'Enviar'}
        </button>
        <button type="button" onClick={cerrar} className={`min-h-11 justify-center ${BTN_SECUNDARIO}`}>
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => {
            void desconectarEquipo(sesion.usuario)
            cerrar()
          }}
          className={`min-h-11 justify-center ${BTN_GHOST_PELIGRO}`}
        >
          Desconectar equipo
        </button>
      </div>
    </Modal>
  )
}
