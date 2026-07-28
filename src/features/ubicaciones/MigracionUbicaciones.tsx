import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Chasis } from '../../app/Chasis'
import { ArrowElbowDownRight } from '../../components/iconos'
import { BTN_PRIMARIO } from '../../components/nocturne'
import { db } from '../../lib/db'
import { CLASE_CAMPO_SIN_ANCHO } from '../../components/campos'
import { guardarRegistro, nuevoId } from '../../lib/repositorio'
import {
  claveUbicacion,
  construirMigracion,
  textosSinUbicacion,
  type GrupoMigracion,
} from './migracion'

// Sin ancho propio: cada fila del informe le fija el suyo (`w-2/5`).
const CLASE_CAMPO = CLASE_CAMPO_SIN_ANCHO

// Migracion asistida de ubicaciones (grupo N3) re-autorizada al sistema
// Nocturne: convierte los textos de ubicacion sueltos de los
// dispositivos en entidades `ubicaciones`. Lista los textos distintos,
// deja renombrarlos (o dejarlos en blanco para omitirlos) y fusiona
// automaticamente los que reciben el mismo nombre final ("Taq. Norte" y
// "taquilla norte" -> "Taquilla Norte"). La logica de agrupado y
// asignacion es pura (migracion.ts); aqui solo se ejecuta. Trae su
// propio shell Nocturne, por eso sale del Layout oscuro.
export function MigracionUbicaciones() {
  const dispositivos = useLiveQuery(() => db.dispositivos.filter((d) => !d.eliminadoEn).toArray(), [], [])
  const textos = useMemo(() => textosSinUbicacion(dispositivos), [dispositivos])

  // nombre final editable por cada texto (clave -> nombre propuesto).
  const [nombres, setNombres] = useState<Record<string, string>>({})
  const [aplicando, setAplicando] = useState(false)
  const [listo, setListo] = useState(false)

  const nombreDe = (texto: string) => nombres[claveUbicacion(texto)] ?? texto

  // Agrupa por nombre final (sin distinguir mayusculas): dos textos con
  // el mismo nombre final se fusionan en una sola ubicacion.
  const grupos = useMemo<GrupoMigracion[]>(() => {
    const porNombre = new Map<string, GrupoMigracion>()
    for (const t of textos) {
      const clave = claveUbicacion(t.texto)
      const nombreFinal = (nombres[clave] ?? t.texto).trim()
      if (nombreFinal === '') continue
      const claveFinal = claveUbicacion(nombreFinal)
      const existente = porNombre.get(claveFinal)
      if (existente) existente.claves.push(clave)
      else porNombre.set(claveFinal, { id: nuevoId(), nombre: nombreFinal, claves: [clave] })
    }
    return [...porNombre.values()]
  }, [textos, nombres])

  const resultado = useMemo(() => construirMigracion(dispositivos, grupos), [dispositivos, grupos])

  if (listo) return <Navigate to="/ubicaciones" replace />
  // Si no queda nada por migrar (todo ya vinculado), no tiene sentido la
  // pantalla: se vuelve a la lista.
  if (dispositivos.length > 0 && textos.length === 0) return <Navigate to="/ubicaciones" replace />

  async function aplicar() {
    setAplicando(true)
    // Primero las ubicaciones, luego los vinculos: asi el dispositivo
    // siempre apunta a una fila que ya existe localmente.
    for (const u of resultado.ubicaciones) {
      await guardarRegistro('ubicaciones', { id: u.id, nombre: u.nombre, padreId: null, notas: '' })
    }
    const porId = new Map(dispositivos.map((d) => [d.id, d]))
    for (const asignacion of resultado.asignaciones) {
      const d = porId.get(asignacion.dispositivoId)
      if (!d) continue
      // El spread pasa la ficha completa (guardarRegistro reescribe
      // updatedAt/updatedBy) fijando el id de la ubicacion y su nombre
      // como copia de referencia.
      await guardarRegistro('dispositivos', {
        ...d,
        ubicacionId: asignacion.ubicacionId,
        ubicacion: asignacion.nombre,
      })
    }
    setAplicando(false)
    setListo(true)
  }

  return (
    // Nivel 3 del chasis (tarea 185): tarea con salida.
    <Chasis
      modo="tarea"
      rotulo="Migrando"
      titulo="Ubicaciones escritas como texto"
      salidaA="/ubicaciones"
      vuelta="Ubicaciones"
      salidaEtiqueta="Salir sin migrar"
      barra={
        <p className="px-4 pb-2.5 text-[12px] leading-[1.5] text-noct-neutral-500">
          Convierte los lugares escritos a mano en ubicaciones con ficha propia. Renombra para unir las variantes
          del mismo lugar (dos con el mismo nombre se fusionan). Deja el nombre en blanco para omitir un texto por
          ahora.
        </p>
      }
    >
      <main className="flex flex-1 flex-col gap-3.5 px-4 pb-12 pt-[18px]">
        {textos.length === 0 ? (
          <p className="rounded-md border border-dashed border-noct-neutral-700 px-4 py-6 text-center text-sm text-noct-neutral-500">
            No hay textos de ubicación pendientes de migrar.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {textos.map((t) => (
              <div
                key={claveUbicacion(t.texto)}
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
                    setNombres((actuales) => ({ ...actuales, [claveUbicacion(t.texto)]: e.target.value }))
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
              Se crearán <strong className="text-noct-text">{resultado.ubicaciones.length}</strong>{' '}
              {resultado.ubicaciones.length === 1 ? 'ubicación' : 'ubicaciones'} y se vincularán{' '}
              <strong className="text-noct-text">{resultado.asignaciones.length}</strong>{' '}
              {resultado.asignaciones.length === 1 ? 'equipo' : 'equipos'}.
            </p>
            <button
              type="button"
              onClick={() => void aplicar()}
              disabled={aplicando || resultado.ubicaciones.length === 0}
              className={`${BTN_PRIMARIO} min-h-11 self-start px-4 disabled:opacity-50`}
            >
              {aplicando ? 'Aplicando...' : 'Crear ubicaciones y vincular equipos'}
            </button>
            <p className="text-xs text-noct-neutral-500">
              Cada equipo conserva el texto como respaldo. Se puede volver a ejecutar esto más tarde con los que se
              dejen pendientes.
            </p>
          </div>
        )}
      </main>
    </Chasis>
  )
}
