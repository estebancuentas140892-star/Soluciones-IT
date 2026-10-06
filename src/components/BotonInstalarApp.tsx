import { useState, useSyncExternalStore } from 'react'
import {
  instalarApp,
  obtenerEstadoInstalacion,
  PASOS_INSTALACION_MANUAL,
  suscribirEstadoInstalacion,
} from '../lib/instalacionPwa'
import { Boton } from './Boton'
import { Hoja } from './Hoja'
import { DownloadSimple } from './iconos'

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
  // `className` es solo colocación (márgenes, `self-*`): el aspecto es el
  // del botón común (tarea 291).
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
      <Boton
        papel="principal"
        className={`shrink-0 ${className}`}
        icono={<DownloadSimple size={14} aria-hidden />}
        onClick={() => void manejarInstalar()}
      >
        {instalacion.puedeInstalar ? 'Instalar' : 'Cómo instalar'}
      </Boton>

      {/* Sin "Entendido": las instrucciones no hace falta cerrarlas con un
          botón propio (auditoría UX, sección 10); la × de la hoja basta. */}
      <Hoja
        abierta={instruccionesAbiertas}
        onCerrar={() => setInstruccionesAbiertas(false)}
        titulo="Instalar la app en el teléfono"
      >
        <p className="text-[13px] leading-relaxed text-noct-neutral-300">
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
      </Hoja>
    </>
  )
}
