import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Chasis } from '../../app/Chasis'
import { CheckCircle, Warning } from '../../components/iconos'
import { BTN_PRIMARIO } from '../../components/nocturne'
import { db } from '../../lib/db'
import { guardarRegistro } from '../../lib/repositorio'
import { ESTADOS_SUGERIDOS } from '../dispositivos/estados'
import { cambiosDeEstado, estadosPorUnificar, type TextoEstado } from '../dispositivos/estadosEscritos'

// ESTADOS ESCRITOS A MANO (tarea 268, sección 9 del encargo del
// 2026-09-23): lleva los estados de texto libre a la lista de cinco, con
// el técnico decidiendo.
//
//   - Un texto que YA ES un estado de la lista escrito de otra forma
//     ("OPERATIVO", "Dado de baja") viene propuesto: es una equivalencia
//     segura, y se puede desmarcar.
//   - Cualquier otro texto viene en "Dejar como está". Si parece un
//     estado ("Activo" parece Operativo) se dice, pero no se elige solo:
//     un equipo nunca pasa a un estado que su texto no dice.
//
// Cada equipo se relee antes de escribir y el cambio queda en su
// historial con el motivo "Unificación de estados".

const DEJAR = '__dejar__'

export function EstadosPorUnificarPage() {
  const dispositivos = useLiveQuery(() => db.dispositivos.toArray(), [])
  const textos = useMemo(() => estadosPorUnificar(dispositivos ?? []), [dispositivos])

  // Clave del texto -> estado elegido, o DEJAR. Sin entrada, la
  // propuesta de siempre: el canónico si es seguro; si no, dejarlo.
  const [elecciones, setElecciones] = useState<Record<string, string>>({})
  const [aplicando, setAplicando] = useState<{ hechos: number; total: number } | null>(null)
  const [aplicados, setAplicados] = useState<number | null>(null)

  const eleccionDe = (t: TextoEstado) => elecciones[t.clave] ?? t.canonico ?? DEJAR
  const plan = useMemo(() => {
    const mapa = new Map<string, string>()
    for (const t of textos) {
      const destino = elecciones[t.clave] ?? t.canonico ?? DEJAR
      if (destino !== DEJAR) mapa.set(t.clave, destino)
    }
    return cambiosDeEstado(dispositivos ?? [], mapa)
  }, [textos, elecciones, dispositivos])

  if (!dispositivos) {
    return (
      <div className="nocturne min-h-svh bg-noct-bg font-inter text-noct-text">
        <p className="px-4 pt-6 text-sm text-noct-neutral-400">Cargando...</p>
      </div>
    )
  }
  if (textos.length === 0 && aplicados === null) return <Navigate to="/inventario" replace />

  async function aplicar() {
    const cambios = plan
    setAplicando({ hechos: 0, total: cambios.length })
    let hechos = 0
    for (const cambio of cambios) {
      const d = await db.dispositivos.get(cambio.dispositivoId)
      hechos += 1
      // Si otro teléfono lo cambió mientras tanto, no se pisa.
      if (!d || d.eliminadoEn || d.estado !== cambio.de) continue
      await guardarRegistro('dispositivos', { ...d, estado: cambio.a }, 'Unificación de estados')
      if (hechos % 10 === 0 || hechos === cambios.length) setAplicando({ hechos, total: cambios.length })
    }
    setAplicando(null)
    setAplicados(cambios.length)
    // Las elecciones se conservan: lo que se marcó "Dejar como está"
    // sigue así, y no vuelve a salir propuesto después de unificar.
  }

  return (
    // Nivel 3 del chasis (tarea 185): tarea con salida.
    <Chasis
      modo="tarea"
      rotulo="Ordenando"
      titulo="Estados escritos a mano"
      salidaEtiqueta="Salir sin unificar"
      barra={
        <p className="px-4 pb-2.5 text-[12px] leading-[1.5] text-noct-neutral-500">
          Lo que ya es un estado de la lista escrito de otra forma viene propuesto. Lo demás lo decides tú: si no dice
          qué le pasa al equipo, déjalo como está.
        </p>
      }
    >
      <main className="flex flex-1 flex-col gap-3.5 px-4 pb-12 pt-[18px]">
        {aplicados !== null && (
          <p className="flex items-start gap-2 rounded-md border border-noct-exito/35 bg-noct-exito/[.08] px-3 py-2.5 text-[13px] leading-[1.5] text-noct-exito">
            <CheckCircle size={16} className="mt-px shrink-0" aria-hidden />
            {aplicados === 1 ? 'Se unificó 1 equipo.' : `Se unificaron ${aplicados} equipos.`}
            {textos.length > 0 && ' Lo que queda abajo se dejó como estaba.'}
          </p>
        )}

        {textos.map((t) => {
          const eleccion = eleccionDe(t)
          return (
            <div key={t.clave} className="flex flex-col gap-2.5 rounded-md border border-noct-divider bg-noct-surface px-3 py-3">
              <div>
                <p className="text-sm text-noct-text">«{t.texto}»</p>
                <p className="text-xs text-noct-neutral-500">
                  {t.cantidad} {t.cantidad === 1 ? 'equipo' : 'equipos'}
                  {t.variantes.length > 1 && ` · incluye ${t.variantes.map((v) => `«${v}»`).join(' y ')}`}
                </p>
              </div>
              {t.canonico ? (
                <p className="flex items-center gap-1.5 text-[12.5px] text-noct-exito">
                  <CheckCircle size={14} className="shrink-0" aria-hidden />
                  Es «{t.canonico}» escrito de otra forma.
                </p>
              ) : (
                <p className="flex items-start gap-1.5 text-[12.5px] leading-[1.5] text-noct-precaucion">
                  <Warning size={14} className="mt-px shrink-0" aria-hidden />
                  <span>
                    Por validar: ¿qué estado es?
                    {t.sugerido && <span className="text-noct-neutral-300"> Parece «{t.sugerido}».</span>}
                  </span>
                </p>
              )}
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={`Estado para «${t.texto}»`}>
                {[...ESTADOS_SUGERIDOS, DEJAR].map((opcion) => {
                  const activa = eleccion === opcion
                  return (
                    <button
                      key={opcion}
                      type="button"
                      role="radio"
                      aria-checked={activa}
                      onClick={() => setElecciones((actuales) => ({ ...actuales, [t.clave]: opcion }))}
                      className={`inline-flex min-h-11 items-center rounded-full border px-3.5 text-[13px] transition-colors ${
                        activa
                          ? 'border-noct-accent bg-noct-accent/[.12] text-noct-accent-300'
                          : 'border-noct-divider text-noct-neutral-400 hover:bg-noct-text/[.05]'
                      }`}
                    >
                      {opcion === DEJAR ? 'Dejar como está' : opcion}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}

        <div className="flex flex-col gap-3 rounded-lg border border-noct-divider bg-noct-surface p-3.5">
          <p className="text-sm text-noct-neutral-300">
            {plan.length === 0 ? (
              'Nada que cambiar con lo elegido.'
            ) : (
              <>
                Se {plan.length === 1 ? 'cambiará' : 'cambiarán'} <strong className="text-noct-text">{plan.length}</strong>{' '}
                {plan.length === 1 ? 'equipo' : 'equipos'}. El estado anterior queda en su historial.
              </>
            )}
          </p>
          <button
            type="button"
            onClick={() => void aplicar()}
            disabled={aplicando !== null || plan.length === 0}
            className={`${BTN_PRIMARIO} min-h-11 self-start px-4 disabled:opacity-50`}
          >
            {aplicando ? `Unificando ${aplicando.hechos} de ${aplicando.total}…` : 'Unificar estados'}
          </button>
        </div>
      </main>
    </Chasis>
  )
}
