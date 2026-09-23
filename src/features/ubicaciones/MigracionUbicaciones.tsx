import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Chasis } from '../../app/Chasis'
import { ArrowElbowDownRight, CheckCircle, MapPin, Warning } from '../../components/iconos'
import { BTN_GHOST, BTN_PRIMARIO, BTN_SECUNDARIO } from '../../components/nocturne'
import { db } from '../../lib/db'
import { CLASE_CAMPO } from '../../components/campos'
import { guardarRegistro, nuevoId } from '../../lib/repositorio'
import { mapaPorId, rutaUbicacion } from './arbol'
import {
  claveUbicacion,
  construirMigracion,
  existenteConNombre,
  MOTIVO_COINCIDENCIA,
  nombreAmbiguo,
  posiblesCoincidencias,
  textosSinUbicacion,
  type GrupoMigracion,
  type PosibleCoincidencia,
  type TextoUbicacion,
} from './migracion'

// Migracion asistida de ubicaciones (grupo N3; revisada en la tarea 267,
// seccion 11 del encargo del 2026-09-23). Convierte los textos de
// ubicacion sueltos de los dispositivos en entidades `ubicaciones`:
//
//   - lo que solo difiere en mayusculas o espacios ya va junto, y la
//     tarjeta lo ENSEÑA ("Incluye «LOGISTICA» y «Logistica»");
//   - lo que solo se parece (una abreviatura, una tilde, una letra) es
//     una "Posible coincidencia · por validar": el tecnico dice si es el
//     mismo lugar o no, y mientras no lo diga ESE texto no se migra;
//   - un texto cuyo nombre final ya es el de una ubicacion existente se
//     vincula a ella, en vez de crear otra igual;
//   - renombrar un texto al nombre de otro los une (como antes); dejarlo
//     en blanco lo omite por ahora.
//
// No crea jerarquias: toda ubicacion nueva nace en la raiz, y colgarla de
// otra se hace a mano desde su ficha. La logica es pura (migracion.ts);
// aqui solo se decide y se ejecuta.

// Clave de una coincidencia, para recordar las descartadas.
function claveCoincidencia(c: PosibleCoincidencia): string {
  return `${c.clave}→${c.con.tipo === 'texto' ? `t:${c.con.clave}` : `u:${c.con.id}`}`
}

export function MigracionUbicaciones() {
  const dispositivos = useLiveQuery(() => db.dispositivos.filter((d) => !d.eliminadoEn).toArray(), [])
  const existentes = useLiveQuery(() => db.ubicaciones.toArray(), [], [])
  const textos = useMemo(() => textosSinUbicacion(dispositivos ?? []), [dispositivos])
  const porIdUbicacion = useMemo(() => mapaPorId(existentes), [existentes])

  // Nombre final editable por cada texto (clave -> nombre propuesto).
  const [nombres, setNombres] = useState<Record<string, string>>({})
  // Coincidencias que el tecnico dijo que NO son el mismo lugar.
  const [descartadas, setDescartadas] = useState<Set<string>>(new Set())
  const [aplicando, setAplicando] = useState<{ hechos: number; total: number } | null>(null)
  const [aplicado, setAplicado] = useState<{ creadas: number; vinculados: number } | null>(null)

  const nombreFinal = (t: TextoUbicacion) => (nombres[claveUbicacion(t.texto)] ?? t.texto).trim()
  const textoPorClave = useMemo(() => new Map(textos.map((t) => [claveUbicacion(t.texto), t])), [textos])

  const coincidencias = useMemo(() => posiblesCoincidencias(textos, existentes), [textos, existentes])

  // Una coincidencia queda RESUELTA si el tecnico la descarto o si ya
  // puso a los dos textos el mismo nombre final ("Es el mismo lugar").
  const pendientesPorClave = useMemo(() => {
    const mapa = new Map<string, PosibleCoincidencia[]>()
    for (const c of coincidencias) {
      if (descartadas.has(claveCoincidencia(c))) continue
      const propio = textoPorClave.get(c.clave)
      if (!propio) continue
      const miNombre = claveUbicacion(nombres[c.clave] ?? propio.texto)
      const suNombre =
        c.con.tipo === 'ubicacion'
          ? claveUbicacion(c.con.nombre)
          : claveUbicacion(nombres[c.con.clave] ?? c.con.texto)
      if (miNombre === suNombre) continue
      const lista = mapa.get(c.clave)
      if (lista) lista.push(c)
      else mapa.set(c.clave, [c])
    }
    return mapa
  }, [coincidencias, descartadas, nombres, textoPorClave])

  // Agrupa por nombre final (sin distinguir mayusculas): dos textos con
  // el mismo nombre final se fusionan en una sola ubicacion. Los textos
  // con una posible coincidencia sin decidir se quedan fuera: no se
  // migra lo que el tecnico todavia no ha validado.
  const grupos = useMemo<GrupoMigracion[]>(() => {
    const porNombre = new Map<string, GrupoMigracion>()
    for (const t of textos) {
      const clave = claveUbicacion(t.texto)
      if (pendientesPorClave.has(clave)) continue
      const final = (nombres[clave] ?? t.texto).trim()
      if (final === '') continue
      const claveFinal = claveUbicacion(final)
      const existente = porNombre.get(claveFinal)
      if (existente) existente.claves.push(clave)
      else porNombre.set(claveFinal, { id: nuevoId(), nombre: final, claves: [clave] })
    }
    return [...porNombre.values()]
  }, [textos, nombres, pendientesPorClave])

  const resultado = useMemo(
    () => construirMigracion(dispositivos ?? [], grupos, existentes),
    [dispositivos, grupos, existentes],
  )

  if (!dispositivos) {
    return (
      <div className="nocturne min-h-svh bg-noct-bg font-inter text-noct-text">
        <p className="px-4 pt-6 text-sm text-noct-neutral-400">Cargando...</p>
      </div>
    )
  }
  // Si no queda nada por migrar (todo ya vinculado), no tiene sentido la
  // pantalla: se vuelve a la lista.
  if (textos.length === 0 && !aplicando) return <Navigate to="/ubicaciones" replace />

  const cuantosPendientes = pendientesPorClave.size

  async function aplicar() {
    const plan = resultado
    setAplicando({ hechos: 0, total: plan.asignaciones.length })
    // Primero las ubicaciones, luego los vinculos: asi el dispositivo
    // siempre apunta a una fila que ya existe localmente.
    for (const u of plan.ubicaciones) {
      await guardarRegistro('ubicaciones', { id: u.id, nombre: u.nombre, padreId: null, notas: '' })
    }
    let hechos = 0
    for (const asignacion of plan.asignaciones) {
      // Se relee cada equipo: entre que se abrio la pantalla y se aplico
      // puede haber llegado un cambio del equipo por sincronizacion.
      const d = await db.dispositivos.get(asignacion.dispositivoId)
      hechos += 1
      if (!d || d.eliminadoEn || d.ubicacionId) continue
      // El spread pasa la ficha completa (guardarRegistro reescribe
      // updatedAt/updatedBy) fijando el id de la ubicacion y su nombre
      // como copia de referencia. El texto anterior queda en el historial.
      await guardarRegistro(
        'dispositivos',
        { ...d, ubicacionId: asignacion.ubicacionId, ubicacion: asignacion.nombre },
        'Migración de ubicaciones',
      )
      if (hechos % 10 === 0 || hechos === plan.asignaciones.length) {
        setAplicando({ hechos, total: plan.asignaciones.length })
      }
    }
    setAplicando(null)
    setAplicado({ creadas: plan.ubicaciones.length, vinculados: plan.asignaciones.length })
    setNombres({})
  }

  function mismoLugar(c: PosibleCoincidencia) {
    const destino =
      c.con.tipo === 'ubicacion'
        ? c.con.nombre
        : (nombres[c.con.clave] ?? c.con.texto).trim() || c.con.texto
    setNombres((actuales) => ({ ...actuales, [c.clave]: destino }))
  }

  function sonDistintos(c: PosibleCoincidencia) {
    setDescartadas((actuales) => new Set(actuales).add(claveCoincidencia(c)))
  }

  // Cuántos textos terminan en cada nombre final, para decir "se une con".
  const textosPorNombreFinal = new Map<string, TextoUbicacion[]>()
  for (const t of textos) {
    const final = claveUbicacion(nombreFinal(t))
    if (!final) continue
    const lista = textosPorNombreFinal.get(final)
    if (lista) lista.push(t)
    else textosPorNombreFinal.set(final, [t])
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
          Cada texto se convierte en una ubicación con ficha. Lo que solo cambia en mayúsculas o espacios ya va junto; lo
          que solo se parece lo decides tú. Deja un nombre en blanco para omitir ese texto por ahora.
        </p>
      }
    >
      <main className="flex flex-1 flex-col gap-3.5 px-4 pb-12 pt-[18px]">
        {aplicado && (
          <p className="flex items-start gap-2 rounded-md border border-noct-exito/35 bg-noct-exito/[.08] px-3 py-2.5 text-[13px] leading-[1.5] text-noct-exito">
            <CheckCircle size={16} className="mt-px shrink-0" aria-hidden />
            {aplicado.creadas === 1 ? 'Se creó 1 ubicación' : `Se crearon ${aplicado.creadas} ubicaciones`} y se
            {aplicado.vinculados === 1 ? ' vinculó 1 equipo' : ` vincularon ${aplicado.vinculados} equipos`}. Lo que
            queda abajo espera tu decisión.
          </p>
        )}

        <div className="flex flex-col gap-2">
          {textos.map((t) => {
            const clave = claveUbicacion(t.texto)
            const final = nombreFinal(t)
            const pendientes = pendientesPorClave.get(clave) ?? []
            const existente = final ? existenteConNombre(final, existentes) : null
            const ambiguo = final ? nombreAmbiguo(final, existentes) : false
            const juntos = (textosPorNombreFinal.get(claveUbicacion(final)) ?? []).filter((o) => o !== t)
            return (
              <div key={clave} className="flex flex-col gap-2.5 rounded-md border border-noct-divider bg-noct-surface px-3 py-3">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-noct-text">{t.texto}</p>
                    <p className="text-xs text-noct-neutral-500">
                      {t.cantidad} {t.cantidad === 1 ? 'equipo' : 'equipos'}
                      {t.variantes.length > 1 && ` · incluye ${t.variantes.map((v) => `«${v}»`).join(' y ')}`}
                    </p>
                  </div>
                </div>
                <label className="flex flex-col gap-1">
                  <span className="text-[12px] text-noct-neutral-400">Nombre de la ubicación</span>
                  <span className="flex items-center gap-2">
                    <ArrowElbowDownRight size={15} className="shrink-0 text-noct-neutral-600" aria-hidden />
                    <input
                      type="text"
                      value={nombres[clave] ?? t.texto}
                      onChange={(e) => setNombres((actuales) => ({ ...actuales, [clave]: e.target.value }))}
                      aria-label={`Nombre final para ${t.texto}`}
                      className={`min-h-11 ${CLASE_CAMPO}`}
                    />
                  </span>
                </label>

                {pendientes.length > 0 ? (
                  pendientes.map((c) => (
                    <div
                      key={claveCoincidencia(c)}
                      className="flex flex-col gap-2 rounded-md border border-noct-precaucion/35 bg-noct-precaucion/[.07] px-3 py-2.5"
                    >
                      <p className="flex items-start gap-1.5 text-[12.5px] leading-[1.5] text-noct-text">
                        <Warning size={14} className="mt-[3px] shrink-0 text-noct-precaucion" aria-hidden />
                        <span>
                          <strong className="font-medium text-noct-precaucion">Posible coincidencia · por validar.</strong>{' '}
                          ¿Es el mismo lugar que{' '}
                          {c.con.tipo === 'ubicacion' ? (
                            <>la ubicación «{rutaUbicacion(c.con.id, porIdUbicacion) || c.con.nombre}»</>
                          ) : (
                            <>«{c.con.texto}»</>
                          )}
                          ? ({MOTIVO_COINCIDENCIA[c.motivo]})
                        </span>
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => mismoLugar(c)} className={`${BTN_SECUNDARIO} min-h-11 px-3`}>
                          Es el mismo lugar
                        </button>
                        <button type="button" onClick={() => sonDistintos(c)} className={`${BTN_GHOST} min-h-11 px-3`}>
                          Son distintos
                        </button>
                      </div>
                      <p className="text-[11.5px] text-noct-neutral-500">Mientras no lo decidas, este texto no se migra.</p>
                    </div>
                  ))
                ) : final === '' ? (
                  <p className="text-[12px] text-noct-neutral-500">Se omite por ahora.</p>
                ) : ambiguo ? (
                  <p className="flex items-start gap-1.5 text-[12px] leading-[1.5] text-noct-precaucion">
                    <Warning size={13} className="mt-px shrink-0" aria-hidden />
                    Hay varias ubicaciones llamadas «{final}». Cambia el nombre o vincula estos equipos desde su ficha.
                  </p>
                ) : existente ? (
                  <p className="flex items-center gap-1.5 text-[12px] text-noct-exito">
                    <MapPin size={13} className="shrink-0" aria-hidden />
                    Se vincula a la ubicación que ya existe: {rutaUbicacion(existente.id, porIdUbicacion) || existente.nombre}
                  </p>
                ) : juntos.length > 0 ? (
                  <p className="text-[12px] text-noct-neutral-400">
                    Se une con {juntos.map((o) => `«${o.texto}»`).join(' y ')} en una sola ubicación.
                  </p>
                ) : (
                  <p className="text-[12px] text-noct-neutral-500">Se crea como ubicación nueva.</p>
                )}
              </div>
            )
          })}
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-noct-divider bg-noct-surface p-3.5">
          <p className="text-sm leading-[1.5] text-noct-neutral-300">
            Se {resultado.ubicaciones.length === 1 ? 'creará' : 'crearán'}{' '}
            <strong className="text-noct-text">{resultado.ubicaciones.length}</strong>{' '}
            {resultado.ubicaciones.length === 1 ? 'ubicación' : 'ubicaciones'}
            {resultado.existentesUsadas.length > 0 && (
              <>
                , se {resultado.existentesUsadas.length === 1 ? 'usará' : 'usarán'}{' '}
                <strong className="text-noct-text">{resultado.existentesUsadas.length}</strong> que ya{' '}
                {resultado.existentesUsadas.length === 1 ? 'existe' : 'existen'}
              </>
            )}{' '}
            y se {resultado.asignaciones.length === 1 ? 'vinculará' : 'vincularán'}{' '}
            <strong className="text-noct-text">{resultado.asignaciones.length}</strong>{' '}
            {resultado.asignaciones.length === 1 ? 'equipo' : 'equipos'}.
          </p>
          {cuantosPendientes > 0 && (
            <p className="text-[12.5px] leading-[1.5] text-noct-precaucion">
              {cuantosPendientes === 1
                ? '1 texto espera que decidas su posible coincidencia.'
                : `${cuantosPendientes} textos esperan que decidas su posible coincidencia.`}
            </p>
          )}
          <button
            type="button"
            onClick={() => void aplicar()}
            disabled={aplicando !== null || resultado.asignaciones.length === 0}
            className={`${BTN_PRIMARIO} min-h-11 self-start px-4 disabled:opacity-50`}
          >
            {aplicando
              ? `Vinculando ${aplicando.hechos} de ${aplicando.total}…`
              : 'Crear ubicaciones y vincular equipos'}
          </button>
          <p className="text-xs leading-[1.5] text-noct-neutral-500">
            Las ubicaciones nuevas nacen sin ubicación superior: colgarlas de otra se hace desde su ficha. El texto que
            tenía cada equipo queda en su historial. Se puede volver aquí más tarde con lo que quede pendiente.
          </p>
        </div>
      </main>
    </Chasis>
  )
}
