import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { BotonVolver } from '../../components/BotonVolver'
import { ArrowElbowDownRight } from '../../components/iconos'
import { BTN_PRIMARIO } from '../../components/nocturne'
import { db } from '../../lib/db'
import { CLASE_CAMPO_SIN_ANCHO } from '../../components/campos'
import { guardarRegistro, nuevoId } from '../../lib/repositorio'
import {
  candidatosPersona,
  clavePersona,
  construirMigracion,
  textosSinPersona,
  type GrupoMigracion,
} from './migracion'

// Sin ancho propio: cada fila del informe le fija el suyo (`w-2/5`).
const CLASE_CAMPO = CLASE_CAMPO_SIN_ANCHO

// Migracion asistida de personas (hallazgo T1 de AUDITORIA_FLUJOS_TI.md)
// re-autorizada al sistema Nocturne: convierte los textos de "usuario
// asignado" sueltos dentro de `detalles` en entidades `personas`. A
// diferencia de MigracionUbicaciones, la fuente no es un campo fijo del
// dispositivo sino una clave cualquiera dentro de la bolsa libre
// `detalles` (candidatosPersona la detecta por alias). Lista los textos
// distintos, deja renombrarlos (o dejarlos en blanco para omitirlos) y
// fusiona automaticamente los que reciben el mismo nombre final. La
// logica de deteccion, agrupado y asignacion es pura (migracion.ts); aqui
// solo se ejecuta. Al aplicar, cada dispositivo migrado tambien pierde la
// clave de `detalles` que origino el dato, para no dejarlo duplicado.
export function MigracionPersonas() {
  const dispositivos = useLiveQuery(() => db.dispositivos.filter((d) => !d.eliminadoEn).toArray(), [], [])
  const candidatos = useMemo(() => candidatosPersona(dispositivos), [dispositivos])
  const textos = useMemo(() => textosSinPersona(candidatos), [candidatos])

  // nombre final editable por cada texto (clave -> nombre propuesto).
  const [nombres, setNombres] = useState<Record<string, string>>({})
  const [aplicando, setAplicando] = useState(false)
  const [listo, setListo] = useState(false)

  const nombreDe = (texto: string) => nombres[clavePersona(texto)] ?? texto

  // Agrupa por nombre final (sin distinguir mayusculas): dos textos con
  // el mismo nombre final se fusionan en una sola persona.
  const grupos = useMemo<GrupoMigracion[]>(() => {
    const porNombre = new Map<string, GrupoMigracion>()
    for (const t of textos) {
      const clave = clavePersona(t.texto)
      const nombreFinal = (nombres[clave] ?? t.texto).trim()
      if (nombreFinal === '') continue
      const claveFinal = clavePersona(nombreFinal)
      const existente = porNombre.get(claveFinal)
      if (existente) existente.claves.push(clave)
      else porNombre.set(claveFinal, { id: nuevoId(), nombre: nombreFinal, claves: [clave] })
    }
    return [...porNombre.values()]
  }, [textos, nombres])

  const resultado = useMemo(() => construirMigracion(candidatos, grupos), [candidatos, grupos])

  if (listo) return <Navigate to="/personas" replace />
  // Si no queda nada por migrar (todo ya vinculado), no tiene sentido la
  // pantalla: se vuelve a la lista.
  if (dispositivos.length > 0 && textos.length === 0) return <Navigate to="/personas" replace />

  async function aplicar() {
    setAplicando(true)
    // Primero las personas, luego los vinculos: asi el dispositivo
    // siempre apunta a una fila que ya existe localmente.
    for (const p of resultado.personas) {
      await guardarRegistro('personas', { id: p.id, nombre: p.nombre, notas: '' })
    }
    const porId = new Map(dispositivos.map((d) => [d.id, d]))
    for (const asignacion of resultado.asignaciones) {
      const d = porId.get(asignacion.dispositivoId)
      if (!d) continue
      // Retira del objeto `detalles` la clave que originó el dato (por
      // ejemplo "Usuario asignado"), para no dejarlo duplicado ahora que
      // vive en el campo canonico.
      const { [asignacion.claveDetalle]: _omitida, ...detallesSinClave } = d.detalles
      await guardarRegistro('dispositivos', {
        ...d,
        detalles: detallesSinClave,
        responsableId: asignacion.personaId,
        responsable: asignacion.nombre,
      })
    }
    setAplicando(false)
    setListo(true)
  }

  return (
    <div className="nocturne min-h-svh bg-noct-bg font-inter text-[15px] leading-[1.55] text-noct-text">
      <div className="mx-auto flex min-h-svh max-w-md flex-col">
        <div className="sticky top-0 z-20 border-b border-noct-divider bg-noct-bg/[.92] backdrop-blur-[12px]">
          <header className="flex items-center justify-between gap-2 py-2.5 pl-2 pr-3 pb-0">
            <BotonVolver to="/personas">Personas</BotonVolver>
          </header>
          <div className="px-4 pb-3 pt-0.5">
            <h1 className="m-0 text-[22px] font-medium leading-[1.25]">Migrar personas de texto</h1>
            <p className="mt-[3px] text-[12.5px] leading-[1.5] text-noct-neutral-500">
              Convierte los responsables escritos a mano (en "Usuario asignado", "Responsable" u otra clave
              parecida) en personas con ficha propia. Renombra para unir las variantes de un mismo nombre (dos
              con el mismo nombre final se fusionan). Deja el nombre en blanco para omitir un texto por ahora.
            </p>
          </div>
        </div>

        <main className="flex flex-1 flex-col gap-3.5 px-4 pb-12 pt-[18px]">
          {textos.length === 0 ? (
            <p className="rounded-md border border-dashed border-noct-neutral-700 px-4 py-6 text-center text-sm text-noct-neutral-500">
              No hay textos de responsable pendientes de migrar.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {textos.map((t) => (
                <div
                  key={clavePersona(t.texto)}
                  className="flex items-center gap-3 rounded-md border border-noct-divider bg-noct-surface px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-noct-text">{t.texto}</p>
                    <p className="text-xs text-noct-neutral-500">
                      {t.cantidad} {t.cantidad === 1 ? 'equipo' : 'equipos'}
                    </p>
                  </div>
                  <ArrowElbowDownRight size={15} className="shrink-0 text-noct-neutral-600" aria-hidden />
                  <input
                    type="text"
                    value={nombreDe(t.texto)}
                    onChange={(e) =>
                      setNombres((actuales) => ({ ...actuales, [clavePersona(t.texto)]: e.target.value }))
                    }
                    aria-label={`Nombre final para ${t.texto}`}
                    className={`min-h-11 w-2/5 shrink-0 ${CLASE_CAMPO}`}
                  />
                </div>
              ))}
            </div>
          )}

          {textos.length > 0 && (
            <div className="flex flex-col gap-3 rounded-lg border border-noct-divider bg-noct-surface p-3.5">
              <p className="text-sm text-noct-neutral-300">
                Se crearán <strong className="text-noct-text">{resultado.personas.length}</strong>{' '}
                {resultado.personas.length === 1 ? 'persona' : 'personas'} y se vincularán{' '}
                <strong className="text-noct-text">{resultado.asignaciones.length}</strong>{' '}
                {resultado.asignaciones.length === 1 ? 'equipo' : 'equipos'}.
              </p>
              <button
                type="button"
                onClick={() => void aplicar()}
                disabled={aplicando || resultado.personas.length === 0}
                className={`${BTN_PRIMARIO} min-h-11 self-start px-4 disabled:opacity-50`}
              >
                {aplicando ? 'Aplicando...' : 'Crear personas y vincular equipos'}
              </button>
              <p className="text-xs text-noct-neutral-500">
                Cada equipo conserva el nombre como respaldo. Se puede volver a ejecutar esto más tarde con los
                que se dejen pendientes.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
