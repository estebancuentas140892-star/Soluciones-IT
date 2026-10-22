import { useId, useSyncExternalStore } from 'react'
import { IconoVentana, type NombreIconoVentana } from '../../components/ventana/IconoVentana'
import { TituloGrupo } from './FilasMas'
import {
  guardarPreferenciaTema,
  preferenciaTemaActual,
  suscribirPreferenciaTema,
  temaEfectivo,
  type PreferenciaTema,
} from '../../lib/tema'

// «APARIENCIA», ARRIBA DE MÁS, EN EL TELÉFONO (tarea 350, «Más · con
// Apariencia» del prototipo de Claude Design). La MISMA preferencia que
// Ajustes > Aplicación > Tema (`src/lib/tema.ts`), en el control segmentado
// del prototipo: elegir es un toque, sin entrar en Ajustes, para pasar al
// claro a pleno sol y volver. No cambia el valor por defecto (oscuro, regla 12)
// ni se sincroniza: vale solo en este teléfono, como siempre.

const OPCIONES: { valor: PreferenciaTema; titulo: string; icono: NombreIconoVentana }[] = [
  { valor: 'automatico', titulo: 'Automático', icono: 'movil' },
  { valor: 'claro', titulo: 'Claro', icono: 'sol' },
  { valor: 'oscuro', titulo: 'Oscuro', icono: 'luna' },
]

function sistemaPideClaro(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: light)').matches
    : false
}

export function AparienciaTelefono() {
  const preferencia = useSyncExternalStore(suscribirPreferenciaTema, preferenciaTemaActual)
  const idTitulo = useId()
  const ahora = temaEfectivo(preferencia, sistemaPideClaro())
  const ayuda =
    preferencia === 'automatico'
      ? `Automático sigue al teléfono. Ahora mismo usa el tema ${ahora}.`
      : `Elegiste el tema ${preferencia}. Se recuerda en este teléfono.`
  return (
    <section aria-labelledby={idTitulo} data-apariencia-telefono className="flex flex-col gap-2">
      <TituloGrupo>
        <span id={idTitulo}>Apariencia</span>
      </TituloGrupo>
      <div role="radiogroup" aria-labelledby={idTitulo} className="grid grid-cols-3 gap-1 rounded-2xl bg-noct-neutral-900 p-1">
        {OPCIONES.map((opcion) => {
          const activa = preferencia === opcion.valor
          return (
            <button
              key={opcion.valor}
              type="button"
              role="radio"
              aria-checked={activa}
              onClick={() => guardarPreferenciaTema(opcion.valor)}
              className={`flex h-[46px] min-w-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl text-[15px] font-bold ${
                activa
                  ? 'bg-noct-surface text-noct-text shadow-[0_1px_0_var(--color-noct-divider),0_2px_6px_rgb(0_0_0/0.12)]'
                  : 'text-noct-neutral-300 active:bg-noct-presionado'
              }`}
            >
              <IconoVentana nombre={opcion.icono} tam={17} className="shrink-0" />
              <span className="min-w-0 truncate">{opcion.titulo}</span>
            </button>
          )
        })}
      </div>
      <p className="px-1 text-[14px] leading-5 text-noct-neutral-300">{ayuda}</p>
    </section>
  )
}
