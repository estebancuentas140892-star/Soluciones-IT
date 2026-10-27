import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { avisar, avisarConDeshacer } from '../../components/avisosFlotantes'
import { CLASE_CAMPO_SOBRE_SUPERFICIE } from '../../components/campos'
import { HojaInferior } from '../../components/HojaInferior'
import { IconoCategoria } from '../../components/IconoCategoria'
import { CaretDown, CaretUp, Monitor } from '../../components/iconos'
import { BTN_GHOST, BTN_PRIMARIO_RELLENO } from '../../components/nocturne'
import { db, type Dispositivo, type Tarea, type TipoMantenimiento } from '../../lib/db'
import { eliminarRegistro, guardarRegistro, nuevoId } from '../../lib/repositorio'
import { diasDeCalendario } from '../../lib/vencimiento'
import { usePerfilVivo } from '../autenticacion/usePerfilVivo'
import { textoProgramado } from '../mantenimientos/mantenimiento'
import { SelectorTipoMantenimiento } from '../mantenimientos/SelectorTipoMantenimiento'
import { ContextoHojaTarea, type ValorHojaTarea } from './contextoHojaTarea'
import { cuandoDeFecha, errorDeTarea, fechaDeCuando, opcionesCuando, razonTarea, type Cuando } from './tareas'

// LA HOJA «NUEVA TAREA» (tarea 365, D5 de la auditoría del 2026-10-27,
// prototipo de Claude Design). La hoja de siempre (`HojaInferior`: desde
// abajo en el teléfono, panel lateral desde 768 px, como «Programar
// mantenimiento»): qué hay que hacer, cuándo (Hoy, Mañana, el viernes, otra
// fecha o sin fecha), el equipo si lo hay y una nota. Con un equipo y «Es un
// mantenimiento de este equipo», guarda un mantenimiento programado, el
// mismo de su ficha (el flujo de siempre), y la hoja pasa a llamarse así.
// Al guardar, el aviso ofrece «Deshacer».

/** Cuántos equipos enseña la lista de «Elegir equipo» antes de pedir que se busque. */
const EQUIPOS_A_LA_VISTA = 8

/**
 * Monta la hoja una vez para la pantalla y la ofrece por contexto a sus filas
 * (`useHojaTarea`). `contexto` es lo que dice la línea pequeña sobre el título
 * («Tu trabajo de hoy», «Agenda»).
 */
export function ProveedorHojaTarea({ contexto, children }: { contexto: string; children: ReactNode }) {
  // null: cerrada; '': nueva; un id: editando esa tarea.
  const [abierta, setAbierta] = useState<string | null>(null)
  const valor = useMemo<ValorHojaTarea>(() => ({ nueva: () => setAbierta(''), editar: (id) => setAbierta(id) }), [])
  const tarea = useLiveQuery(async () => (abierta ? ((await db.tareas.get(abierta)) ?? null) : null), [abierta])
  const [mantenimiento, setMantenimiento] = useState(false)
  const editando = abierta !== null && abierta !== ''
  const titulo = editando ? 'Editar tarea' : mantenimiento ? 'Programar mantenimiento' : 'Nueva tarea'
  function cerrar() {
    setAbierta(null)
    setMantenimiento(false)
  }
  return (
    <ContextoHojaTarea.Provider value={valor}>
      {children}
      <HojaInferior abierta={abierta !== null} onCerrar={cerrar} titulo={titulo} contexto={contexto}>
        {/* Se monta de nuevo en cada apertura: el formulario empieza limpio
            (o con la tarea que se edita, cuando ya se leyó). */}
        {abierta !== null && (!editando || tarea) && (
          <FormularioTarea
            key={abierta}
            tarea={editando ? (tarea ?? undefined) : undefined}
            onMantenimiento={setMantenimiento}
            alTerminar={cerrar}
          />
        )}
      </HojaInferior>
    </ContextoHojaTarea.Provider>
  )
}

function FormularioTarea({
  tarea,
  onMantenimiento,
  alTerminar,
}: {
  tarea?: Tarea
  onMantenimiento: (activo: boolean) => void
  alTerminar: () => void
}) {
  const perfil = usePerfilVivo()
  const hoy = useMemo(() => new Date(), [])
  const inicial = useMemo(() => (tarea ? cuandoDeFecha(tarea.fecha, hoy) : { cuando: 'hoy' as Cuando, otraFecha: '' }), [tarea, hoy])
  const [titulo, setTitulo] = useState(tarea?.titulo ?? '')
  const [cuando, setCuando] = useState<Cuando>(inicial.cuando)
  const [otraFecha, setOtraFecha] = useState(inicial.otraFecha)
  const [dispositivoId, setDispositivoId] = useState<string | null>(tarea?.dispositivoId ?? null)
  const [nota, setNota] = useState(tarea?.nota ?? '')
  const [mantenimiento, setMantenimientoLocal] = useState(false)
  const [tipo, setTipo] = useState<TipoMantenimiento>('preventivo')
  const [intentado, setIntentado] = useState(false)
  const [guardando, setGuardando] = useState(false)

  function setMantenimiento(activo: boolean) {
    setMantenimientoLocal(activo)
    onMantenimiento(activo)
    // Un mantenimiento necesita fecha: «Sin fecha» no se ofrece.
    if (activo && cuando === 'sin') setCuando('hoy')
  }

  const error = errorDeTarea({ titulo, cuando, otraFecha, mantenimiento })
  const opciones = opcionesCuando(hoy, !mantenimiento)

  async function guardar(evento: FormEvent) {
    evento.preventDefault()
    setIntentado(true)
    if (error || guardando) return
    const fecha = fechaDeCuando(cuando, otraFecha, hoy) ?? null
    setGuardando(true)
    if (mantenimiento && dispositivoId && fecha) {
      // EL FLUJO DE SIEMPRE: un mantenimiento programado, en su equipo.
      const id = nuevoId()
      await guardarRegistro('mantenimientos', {
        id,
        dispositivoId,
        tipo,
        fechaProgramada: fecha,
        estado: 'programado',
        tecnico: '',
        fechaRealizada: null,
        resultado: '',
        observaciones: '',
        historialId: null,
        fuente: '',
        validacion: 'confirmado',
      })
      const razon = textoProgramado(fecha, diasDeCalendario(fecha, hoy) ?? 0)
      avisarConDeshacer(`Mantenimiento programado: ${razon.charAt(0).toLowerCase()}${razon.slice(1)}`, () => {
        void eliminarRegistro('mantenimientos', id, 'Deshecho al programarlo')
      })
    } else if (tarea) {
      await guardarRegistro('tareas', { ...tarea, titulo: titulo.trim(), fecha, dispositivoId, nota: nota.trim() })
      avisar('Tarea guardada')
    } else {
      const id = nuevoId()
      await guardarRegistro('tareas', {
        id,
        titulo: titulo.trim(),
        fecha,
        dispositivoId,
        nota: nota.trim(),
        hechaEn: null,
        creadaPor: perfil?.id ?? null,
      })
      const dias = fecha ? diasDeCalendario(fecha, hoy) : null
      avisarConDeshacer(`Tarea guardada · ${razonTarea(dias, hoy)}`, () => {
        void eliminarRegistro('tareas', id, 'Deshecha al crearla')
      })
    }
    setGuardando(false)
    alTerminar()
  }

  return (
    <form onSubmit={guardar} noValidate className="flex flex-col gap-4">
      {!mantenimiento && (
        <label className="flex flex-col gap-1.5">
          <span className="text-[14px] font-bold text-noct-neutral-300">¿Qué hay que hacer?</span>
          <input
            type="text"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ej.: Instalar la impresora de Mercadeo"
            aria-invalid={intentado && !titulo.trim()}
            className={`min-h-[50px] text-[16px] font-semibold ${CLASE_CAMPO_SOBRE_SUPERFICIE} ${
              intentado && !titulo.trim() ? 'border-noct-error' : ''
            }`}
          />
        </label>
      )}

      <div className="flex flex-col gap-2">
        <span id="tarea-cuando" className="text-[14px] font-bold text-noct-neutral-300">
          ¿Cuándo?
        </span>
        <div role="group" aria-labelledby="tarea-cuando" className="flex flex-wrap gap-2">
          {opciones.map((opcion) => {
            const activa = opcion.valor === cuando
            return (
              <button
                key={opcion.valor}
                type="button"
                aria-pressed={activa}
                onClick={() => setCuando(opcion.valor)}
                className={`toque-amplio relative h-10 rounded-full border-[1.5px] px-3.5 text-[14.5px] font-bold ${
                  activa ? 'border-noct-text bg-noct-text text-noct-bg' : 'border-noct-divider-fuerte text-noct-text active:bg-noct-presionado'
                }`}
              >
                {opcion.texto}
              </button>
            )
          })}
        </div>
        {cuando === 'fecha' && (
          <input
            type="date"
            aria-label="Fecha"
            value={otraFecha}
            onChange={(e) => setOtraFecha(e.target.value)}
            aria-invalid={intentado && !otraFecha}
            className={`min-h-12 ${CLASE_CAMPO_SOBRE_SUPERFICIE}`}
          />
        )}
      </div>

      <ElegirEquipo
        dispositivoId={dispositivoId}
        onElegir={(id) => {
          setDispositivoId(id)
          if (!id) setMantenimiento(false)
        }}
        // Una tarea que ya existe no se convierte en mantenimiento: eso es
        // crear otra cosa, desde «Nueva».
        conMantenimiento={!tarea}
        mantenimiento={mantenimiento}
        onMantenimiento={setMantenimiento}
        tipo={tipo}
        onTipo={setTipo}
      />

      {!mantenimiento && (
        <label className="flex flex-col gap-1.5">
          <span className="text-[14px] font-bold text-noct-neutral-300">
            Nota <span className="font-medium text-noct-neutral-400">(opcional)</span>
          </span>
          <input
            type="text"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            className={`min-h-12 ${CLASE_CAMPO_SOBRE_SUPERFICIE}`}
          />
        </label>
      )}

      {intentado && error && (
        <p role="alert" className="text-[14px] font-bold text-noct-error">
          {error}
        </p>
      )}

      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={guardando} className={`${BTN_PRIMARIO_RELLENO} flex-1`}>
          {guardando ? 'Guardando...' : mantenimiento ? 'Programar mantenimiento' : 'Guardar tarea'}
        </button>
        <button type="button" onClick={alTerminar} className={`${BTN_GHOST} min-h-11 px-4`}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

/**
 * EL EQUIPO (OPCIONAL). «Elegir equipo» despliega aquí mismo la lista, con un
 * buscador: el inventario real no cabe entero. Elegido, se ve con su icono y
 * su lugar, con «Quitar», y entonces se ofrece «Es un mantenimiento de este
 * equipo».
 */
function ElegirEquipo({
  dispositivoId,
  onElegir,
  conMantenimiento,
  mantenimiento,
  onMantenimiento,
  tipo,
  onTipo,
}: {
  dispositivoId: string | null
  onElegir: (id: string | null) => void
  conMantenimiento: boolean
  mantenimiento: boolean
  onMantenimiento: (activo: boolean) => void
  tipo: TipoMantenimiento
  onTipo: (tipo: TipoMantenimiento) => void
}) {
  const [eligiendo, setEligiendo] = useState(false)
  const [filtro, setFiltro] = useState('')
  const equipos = useLiveQuery(() => db.dispositivos.filter((d) => !d.eliminadoEn).toArray(), [], [])
  const categorias = useLiveQuery(() => db.categorias.toArray(), [], [])
  const nombreCategoria = useMemo(() => new Map(categorias.map((c) => [c.id, c.nombre])), [categorias])
  const elegido = dispositivoId ? equipos.find((d) => d.id === dispositivoId) : undefined
  const candidatos = useMemo(() => {
    const buscado = filtro.trim().toLowerCase()
    return [...equipos]
      .filter((d) => !buscado || `${d.nombre} ${d.ubicacion ?? ''}`.toLowerCase().includes(buscado))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { numeric: true }))
  }, [equipos, filtro])

  const fila = (d: Dispositivo) => (
    <>
      <IconoCategoria nombre={nombreCategoria.get(d.categoriaId)} tam={34} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[15px] font-bold leading-snug [overflow-wrap:anywhere]">{d.nombre}</span>
        {d.ubicacion && <span className="text-[13px] font-semibold text-noct-neutral-300">{d.ubicacion}</span>}
      </span>
    </>
  )

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[14px] font-bold text-noct-neutral-300">
        Equipo <span className="font-medium text-noct-neutral-400">(opcional)</span>
      </span>
      {elegido ? (
        <>
          <div className="flex min-h-14 items-center gap-2.5 rounded-xl border-[1.5px] border-noct-divider bg-noct-bg py-1 pl-3 pr-1">
            {fila(elegido)}
            <button
              type="button"
              onClick={() => onElegir(null)}
              className="min-h-11 shrink-0 px-3 text-[14px] font-bold text-noct-accent-300"
            >
              Quitar
            </button>
          </div>
          {conMantenimiento && (
            <label className="flex min-h-12 cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={mantenimiento}
                onChange={(e) => onMantenimiento(e.target.checked)}
                className="h-[22px] w-[22px] shrink-0 accent-[var(--color-noct-accent)]"
              />
              <span className="flex flex-col">
                <span className="text-[15px] font-bold">Es un mantenimiento de este equipo</span>
                <span className="text-[13px] text-noct-neutral-300">Se guarda en su Mantenimiento, como hoy.</span>
              </span>
            </label>
          )}
          {mantenimiento && <SelectorTipoMantenimiento valor={tipo} alCambiar={onTipo} />}
        </>
      ) : (
        <>
          <button
            type="button"
            aria-expanded={eligiendo}
            onClick={() => setEligiendo(!eligiendo)}
            className="flex min-h-[50px] items-center gap-2.5 rounded-xl border-[1.5px] border-dashed border-noct-divider-fuerte px-3 text-left text-[15px] font-semibold text-noct-text active:bg-noct-presionado"
          >
            <Monitor size={18} aria-hidden className="shrink-0 text-noct-neutral-300" />
            <span className="flex-1">Elegir equipo</span>
            {eligiendo ? <CaretUp size={16} aria-hidden /> : <CaretDown size={16} aria-hidden />}
          </button>
          {eligiendo && (
            <div className="flex flex-col overflow-hidden rounded-xl border-[1.5px] border-noct-divider bg-noct-bg">
              <input
                type="search"
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                aria-label="Buscar equipo"
                placeholder={`Buscar en ${equipos.length} ${equipos.length === 1 ? 'equipo' : 'equipos'}`}
                className="min-h-12 border-b-[1.5px] border-noct-divider bg-transparent px-3 text-[16px] text-noct-text outline-none placeholder:text-noct-neutral-500"
              />
              {candidatos.slice(0, EQUIPOS_A_LA_VISTA).map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => {
                    onElegir(d.id)
                    setEligiendo(false)
                  }}
                  className="flex min-h-[52px] items-center gap-2.5 border-t-[1.5px] border-noct-divider px-3 py-1 text-left text-noct-text first-of-type:border-t-0 active:bg-noct-presionado"
                >
                  {fila(d)}
                </button>
              ))}
              {candidatos.length > EQUIPOS_A_LA_VISTA && (
                <p className="border-t-[1.5px] border-noct-divider px-3 py-2.5 text-[13px] text-noct-neutral-300">
                  Y {candidatos.length - EQUIPOS_A_LA_VISTA} más: escribe parte del nombre.
                </p>
              )}
              {candidatos.length === 0 && (
                <p className="px-3 py-2.5 text-[13px] text-noct-neutral-300">Ningún equipo coincide.</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
