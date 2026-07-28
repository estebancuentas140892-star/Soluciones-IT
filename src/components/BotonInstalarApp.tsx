import { useState, useSyncExternalStore } from 'react'
import {
  instalarApp,
  obtenerEstadoInstalacion,
  PASOS_INSTALACION_MANUAL,
  suscribirEstadoInstalacion,
} from '../lib/instalacionPwa'
import { DownloadSimple, X } from './iconos'
import { Modal } from './Modal'
import { BTN_PRIMARIO, BTN_SECUNDARIO } from './nocturne'

// Boton que instala la app en el dispositivo, con las instrucciones
// manuales dentro. Compartido por los dos unicos sitios donde la app
// ofrece instalarse (decision del handoff: ahi y en Mi cuenta, "nunca
// como banner intrusivo"): la bienvenida del primer dia y Mi cuenta.
//
// Vive en components/ y no en la feature de Inicio porque sus dos
// consumidores estan en features distintas (convencion de la seccion 6
// de COMPONENTES_UI.md).
//
// NO decide si debe verse: eso depende del contexto (en la bienvenida lo
// decide el paso 2; en Mi cuenta, la tarjeta que lo contiene). Quien lo
// use mira `obtenerEstadoInstalacion().instalada`.
export function BotonInstalarApp({ className = '' }: { className?: string }) {
  const instalacion = useSyncExternalStore(suscribirEstadoInstalacion, obtenerEstadoInstalacion)
  const [instruccionesAbiertas, setInstruccionesAbiertas] = useState(false)

  async function manejarInstalar() {
    // Sin dialogo nativo (Safari de iOS siempre, y el resto de
    // navegadores cuando ya se uso una vez) no hay boton posible: solo
    // instrucciones.
    if (!instalacion.puedeInstalar) {
      setInstruccionesAbiertas(true)
      return
    }
    const resultado = await instalarApp()
    if (resultado !== 'instalada') setInstruccionesAbiertas(true)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void manejarInstalar()}
        className={`${BTN_PRIMARIO} min-h-11 shrink-0 px-3 ${className}`}
      >
        <DownloadSimple size={14} aria-hidden />
        {instalacion.puedeInstalar ? 'Instalar' : 'Cómo instalar'}
      </button>

      <Modal
        abierto={instruccionesAbiertas}
        onCerrar={() => setInstruccionesAbiertas(false)}
        tituloId="titulo-instalar-app"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="titulo-instalar-app" className="text-[17px] font-medium leading-[1.3]">
            Instalar la app en el teléfono
          </h2>
          <button
            type="button"
            onClick={() => setInstruccionesAbiertas(false)}
            aria-label="Cerrar"
            className="-m-1 flex shrink-0 p-1 text-noct-neutral-400 hover:text-noct-text"
          >
            <X size={18} aria-hidden />
          </button>
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-noct-neutral-300">
          Este navegador no ofrece el botón de instalación, así que se hace desde su propio menú. Con
          la app instalada, abre con su icono y funciona sin señal.
        </p>
        <ol className="mt-3 flex flex-col gap-2.5">
          {PASOS_INSTALACION_MANUAL.map((paso, indice) => (
            <li key={paso} className="flex items-start gap-2.5 text-[13.5px] leading-relaxed">
              <span className="mt-px flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border border-noct-divider text-[12px] font-medium text-noct-neutral-300">
                {indice + 1}
              </span>
              <span className="flex-1">{paso}</span>
            </li>
          ))}
        </ol>
        <button
          type="button"
          onClick={() => setInstruccionesAbiertas(false)}
          className={`${BTN_SECUNDARIO} mt-4 min-h-11 w-full justify-center`}
        >
          Entendido
        </button>
      </Modal>
    </>
  )
}
