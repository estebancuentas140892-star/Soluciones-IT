import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../../lib/db'
import { Chasis } from '../../app/Chasis'
import { idsDeRed, esDeRed } from '../../lib/categorias'
import { incluyeTexto } from '../../lib/texto'
import { FilaDispositivo } from '../../components/FilaDispositivo'
import {
  DotsThreeOutline,
  MagnifyingGlass,
  MapPin,
  Monitor,
  Plus,
  QrCode,
  UploadSimple,
  User,
  XCircleFill,
} from '../../components/iconos'
import { BTN_ICONO_SECUNDARIO, BTN_SECUNDARIO } from '../../components/nocturne'
import { estadoConEtiqueta } from '../red/topologiaVisual'

// Pantalla Dispositivos re-autorizada en el sistema Nocturne (handoff
// "Rediseño de aplicación empresarial", Dispositivos.dc.html, entrada
// R4): responde "¿qué se sabe de cada equipo?" con el inventario
// general (las categorías de red van en la sección Red, no aquí:
// decisión ya existente antes del rediseño). Buscador único, chips de
// categoría deslizables con conteo (incluye "Todos") y un resumen de
// estados siempre sobre el total, sin filtrar (vista general de un
// vistazo). Declara nivel de sección en el chasis único (tarea 185),
// que le pone sidebar en escritorio y pestañas en móvil. La lógica y
// los datos no cambian respecto de la versión de tema claro: solo se
// re-autoriza el aspecto a Nocturne.

export function DispositivosPage() {
  const dispositivos = useLiveQuery(
    () => db.dispositivos.filter((d) => !d.eliminadoEn).toArray(),
    [],
    [],
  )
  const categorias = useLiveQuery(
    () => db.categorias.filter((c) => !c.eliminadoEn).sortBy('orden'),
    [],
    [],
  )

  const [categoriaId, setCategoriaId] = useState('')
  const [texto, setTexto] = useState('')
  const [menuAbierto, setMenuAbierto] = useState(false)

  const categoriasGenerales = useMemo(
    () => (categorias ?? []).filter((c) => !esDeRed(c)),
    [categorias],
  )
  const idsRed = useMemo(() => idsDeRed(categorias), [categorias])
  const nombreCategoria = useMemo(
    () => new Map((categorias ?? []).map((c) => [c.id, c.nombre])),
    [categorias],
  )

  const generales = useMemo(
    () => (dispositivos ?? []).filter((d) => !idsRed.has(d.categoriaId)),
    [dispositivos, idsRed],
  )

  const filtrados = useMemo(() => {
    return generales.filter((d) => {
      if (categoriaId && d.categoriaId !== categoriaId) return false
      return incluyeTexto([d.nombre, d.ip, d.ubicacion, d.serial], texto)
    })
  }, [generales, categoriaId, texto])

  // Conteo de equipos por categoría para los chips ("N"), sobre el
  // inventario general completo (no sobre el filtro actual).
  const conteoPorCategoria = useMemo(() => {
    const mapa = new Map<string, number>()
    for (const d of generales) mapa.set(d.categoriaId, (mapa.get(d.categoriaId) ?? 0) + 1)
    return mapa
  }, [generales])

  const resumen = useMemo(
    () => ({
      total: generales.length,
      operativos: generales.filter((d) => estadoConEtiqueta(d.estado).etiqueta === 'Operativo').length,
      mantenimiento: generales.filter(
        (d) => estadoConEtiqueta(d.estado).etiqueta === 'En mantenimiento',
      ).length,
      fueraDeServicio: generales.filter(
        (d) => estadoConEtiqueta(d.estado).etiqueta === 'Fuera de servicio',
      ).length,
    }),
    [generales],
  )

  const buscando = texto.trim().length > 0
  const hayFiltrosActivos = Boolean(categoriaId || texto)
  const hayResultados = filtrados.length > 0

  function quitarFiltros() {
    setCategoriaId('')
    setTexto('')
  }

  return (
    // Nivel 1 del chasis (tarea 185): raíz de su pila. El título, el
    // estado del dato, buscar y la cuenta los aporta el chasis (tarea
    // 181); en `barra` quedan las acciones propias de la sección, el
    // buscador de equipos y la fila de chips deslizable.
    <Chasis titulo="Equipos" barra={
      <>
        <header className="flex items-center justify-between gap-2 px-4 pb-0.5 pt-1">
          <p className="min-w-0 truncate text-[12.5px] text-noct-neutral-400">
            Qué se sabe de cada equipo
          </p>
          <div className="flex shrink-0 gap-2">
            <Link
              to="/escaner"
              aria-label="Escanear equipo"
              className={BTN_ICONO_SECUNDARIO}
            >
              <QrCode size={17} aria-hidden />
            </Link>
            <Link to="/dispositivos/nuevo" className={`shrink-0 ${BTN_SECUNDARIO}`}>
              <Plus size={15} aria-hidden />
              Crear
            </Link>
            <button
              type="button"
              onClick={() => setMenuAbierto((v) => !v)}
              aria-label="Más acciones: ubicaciones, personas, etiquetas QR, importar"
              aria-expanded={menuAbierto}
              className={BTN_ICONO_SECUNDARIO}
            >
              <DotsThreeOutline size={17} aria-hidden />
            </button>
          </div>
        </header>

        {menuAbierto && (
          <div className="flex flex-wrap gap-2 px-4 pt-2">
            <Link
              to="/ubicaciones"
              onClick={() => setMenuAbierto(false)}
              className={`shrink-0 ${BTN_SECUNDARIO}`}
            >
              <MapPin size={14} aria-hidden />
              Ubicaciones
            </Link>
            <Link
              to="/personas"
              onClick={() => setMenuAbierto(false)}
              className={`shrink-0 ${BTN_SECUNDARIO}`}
            >
              <User size={14} aria-hidden />
              Personas
            </Link>
            <Link
              to="/dispositivos/etiquetas"
              onClick={() => setMenuAbierto(false)}
              className={`shrink-0 ${BTN_SECUNDARIO}`}
            >
              <QrCode size={14} aria-hidden />
              Etiquetas QR
            </Link>
            <Link
              to="/dispositivos/importar"
              onClick={() => setMenuAbierto(false)}
              className={`shrink-0 ${BTN_SECUNDARIO}`}
            >
              <UploadSimple size={14} aria-hidden />
              Importar
            </Link>
          </div>
        )}

        <div className="px-4 pb-2.5 pt-2">
          <label
            className={`flex h-11 items-center gap-2.5 rounded-lg border bg-noct-surface px-3.5 transition-colors ${
              buscando ? 'border-noct-accent' : 'border-noct-divider'
            }`}
          >
            <MagnifyingGlass
              size={18}
              className={`shrink-0 ${buscando ? 'text-noct-accent' : 'text-noct-neutral-500'}`}
              aria-hidden
            />
            <input
              type="search"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Nombre, IP, serial o ubicación"
              aria-label="Buscar equipos"
              className="dis-search min-w-0 flex-1 bg-transparent text-[15px] text-noct-text outline-none placeholder:text-noct-neutral-500"
            />
            {buscando && (
              <button
                type="button"
                onClick={() => setTexto('')}
                aria-label="Borrar búsqueda"
                className="-m-1 flex shrink-0 p-1 text-noct-neutral-400 hover:text-noct-text"
              >
                <XCircleFill size={18} aria-hidden />
              </button>
            )}
          </label>
        </div>

        {categoriasGenerales.length > 0 && (
          <div className="flex gap-2 overflow-x-auto px-4 pb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {[{ id: '', nombre: 'Todos', count: generales.length }, ...categoriasGenerales.map((c) => ({
              id: c.id,
              nombre: c.nombre,
              count: conteoPorCategoria.get(c.id) ?? 0,
            }))].map((chip) => {
              const activo = chip.id === categoriaId
              return (
                <button
                  key={chip.id || '__todos'}
                  type="button"
                  aria-pressed={activo}
                  onClick={() => setCategoriaId((v) => (v === chip.id ? '' : chip.id))}
                  className={`inline-flex h-[34px] shrink-0 items-center gap-[7px] whitespace-nowrap rounded-full border px-[13px] text-[13px] font-medium transition-colors ${
                    activo
                      ? 'border-noct-accent bg-noct-accent/[.14] text-noct-accent-300'
                      : 'border-noct-divider text-noct-neutral-300 hover:bg-noct-text/[.05]'
                  }`}
                >
                  {chip.nombre}
                  <span
                    className={`text-[11.5px] ${activo ? 'text-noct-accent-400' : 'text-noct-neutral-600'}`}
                  >
                    {chip.count}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </>
    }>
      <main className="flex-1 px-4 pb-16 pt-3">
        {/* Resumen de estados: total y desglose operativo/mantenimiento/
            fuera de servicio, siempre sobre el inventario completo. */}
        <div className="mb-3 flex flex-wrap items-center gap-x-3.5 gap-y-1.5 px-0.5">
          <span className="text-[12.5px] text-noct-neutral-500">{resumen.total} equipos</span>
          <ResumenEstado clase="bg-noct-exito" texto={`${resumen.operativos} operativos`} />
          <ResumenEstado clase="bg-noct-precaucion" texto={`${resumen.mantenimiento} en mantenimiento`} />
          <ResumenEstado clase="bg-noct-error" texto={`${resumen.fueraDeServicio} fuera de servicio`} />
        </div>

        {hayResultados ? (
          <div className="flex flex-col">
            {filtrados.map((d) => (
              <FilaDispositivo
                key={d.id}
                dispositivo={d}
                categoriaNombre={nombreCategoria.get(d.categoriaId) ?? ''}
                subtitulo={[nombreCategoria.get(d.categoriaId), d.ubicacion].filter(Boolean).join(' · ')}
                conFoto
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-noct-neutral-700 px-6 py-11 text-center">
            <Monitor size={30} className="text-noct-neutral-600" aria-hidden />
            <div>
              <p className="text-[14.5px] font-medium">
                {hayFiltrosActivos ? 'Ningún equipo coincide' : 'Aún no hay equipos registrados'}
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-noct-neutral-400">
                {hayFiltrosActivos
                  ? 'Probar con otra palabra o quitar el filtro de categoría.'
                  : 'Agregarlos desde "Crear".'}
              </p>
            </div>
            {hayFiltrosActivos && (
              <button type="button" onClick={quitarFiltros} className={`mt-0.5 ${BTN_SECUNDARIO}`}>
                Quitar filtros
              </button>
            )}
          </div>
        )}
      </main>
    </Chasis>
  )
}

function ResumenEstado({ clase, texto }: { clase: string; texto: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12.5px] text-noct-neutral-400">
      <span className={`h-[7px] w-[7px] shrink-0 rounded-full ${clase}`} />
      {texto}
    </span>
  )
}
