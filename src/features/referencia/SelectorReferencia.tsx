import { useEffect, useMemo, useState } from 'react'
import { Modal } from '../../components/Modal'
import { CLASE_CAMPO_SOBRE_SUPERFICIE, CLASE_ETIQUETA } from '../../components/campos'
import { BookBookmark, Keyboard, MagnifyingGlass, Plus, TerminalWindow, X } from '../../components/iconos'
import { BTN_GHOST, BTN_PRIMARIO } from '../../components/nocturne'
import type { Referencia, TipoReferencia } from '../../lib/db'
import { guardarRegistro, nuevoId } from '../../lib/repositorio'
import { coincide, INFO_TIPO, ordenarPorTitulo } from './referencias'

// ELEGIR UNA REFERENCIA, O CREARLA SIN PERDER LO ESCRITO.
//
// El requisito que resuelve (encargo, tarea 3): "permite crear uno
// nuevo sin perder los cambios del procedimiento". Navegar al editor de
// Referencia dejaria el borrador del procedimiento a medias en otra
// pantalla; abrir una hoja aqui mismo no mueve al autor de sitio.
//
// La creacion escribe DIRECTO en la tabla central con el repositorio,
// no en el borrador del articulo: una referencia es una entidad propia
// del equipo, no parte de la guia. Asi queda disponible al instante
// para el resto de guias y para el buscador, y si el autor luego
// descarta el procedimiento, el termino que escribio no se pierde.
//
// Crea con lo MINIMO (titulo y tipo) a proposito: rellenar la
// definicion, el ejemplo y los alias es trabajo de la ficha, y pedirlo
// aqui convertiria "vincular una palabra" en un formulario de diez
// campos en mitad de la escritura de un paso.

const ID_TITULO = 'selector-referencia-titulo'

const ICONO: Record<TipoReferencia, typeof BookBookmark> = {
  termino: BookBookmark,
  atajo: Keyboard,
  comando: TerminalWindow,
}

interface Props {
  abierto: boolean
  onCerrar: () => void
  /** Qué clase de referencia se está eligiendo. Acota la lista y la creación. */
  tipo: TipoReferencia
  /** Todas las referencias vivas; el selector filtra por tipo. */
  referencias: Referencia[]
  onElegir: (referencia: Referencia) => void
}

export function SelectorReferencia({ abierto, onCerrar, tipo, referencias, onElegir }: Props) {
  const [consulta, setConsulta] = useState('')
  const [creando, setCreando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Cada apertura empieza limpia, mismo criterio que HojaVinculo y el
  // buscador global: arrastrar la búsqueda anterior confunde más de lo
  // que ahorra.
  useEffect(() => {
    if (!abierto) {
      setConsulta('')
      setError(null)
    }
  }, [abierto])

  const info = INFO_TIPO[tipo]
  const Icono = ICONO[tipo]

  const candidatas = useMemo(
    () => ordenarPorTitulo(referencias.filter((r) => r.tipo === tipo)),
    [referencias, tipo],
  )
  const visibles = useMemo(() => candidatas.filter((r) => coincide(r, consulta)), [candidatas, consulta])

  const nuevoTitulo = consulta.trim()
  // Ya existe con ese nombre exacto: crear otra igual solo produciría un
  // duplicado, que es justo lo que la revisión de consistencia señala
  // después. Mejor no ofrecerlo.
  const yaExiste = candidatas.some((r) => r.titulo.trim().toLowerCase() === nuevoTitulo.toLowerCase())
  const puedeCrear = nuevoTitulo !== '' && !yaExiste

  async function crear() {
    if (!puedeCrear || creando) return
    setCreando(true)
    setError(null)
    const nueva: Referencia = {
      id: nuevoId(),
      tipo,
      titulo: nuevoTitulo,
      abreviatura: '',
      alias: [],
      definicion: '',
      ejemplo: '',
      categoria: '',
      plataforma: '',
      valor: '',
      cuandoUsar: '',
      resultadoEsperado: '',
      requiereAdmin: false,
      advertencia: '',
      relacionadas: [],
      etiquetas: [],
      updatedAt: '',
      updatedBy: null,
      eliminadoEn: null,
    }
    try {
      await guardarRegistro('referencias', nueva)
      onElegir(nueva)
      onCerrar()
    } catch {
      setError('No se pudo crear. Intenta de nuevo.')
    }
    setCreando(false)
  }

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} tituloId={ID_TITULO}>
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span id={ID_TITULO} className="min-w-0 text-[17px] font-medium leading-tight text-noct-text">
          {tipo === 'termino' ? 'Término del glosario' : info.etiqueta}
        </span>
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-noct-text/[.08] text-noct-text hover:bg-noct-text/[.14]"
        >
          <X size={20} aria-hidden />
        </button>
      </div>

      <label className="mb-2 flex h-12 items-center gap-2.5 rounded-[10px] border border-noct-divider bg-noct-bg px-3.5 focus-within:border-noct-accent">
        <MagnifyingGlass size={17} className="shrink-0 text-noct-neutral-400" aria-hidden />
        <input
          type="search"
          autoFocus
          value={consulta}
          onChange={(e) => setConsulta(e.target.value)}
          placeholder={`Buscar o escribir ${info.etiqueta.toLowerCase()}`}
          aria-label={`Buscar ${info.plural.toLowerCase()}`}
          className="min-w-0 flex-1 bg-transparent text-[15px] text-noct-text outline-none placeholder:text-noct-neutral-500 [&::-webkit-search-cancel-button]:hidden"
        />
      </label>

      <div className="flex max-h-[46vh] flex-col overflow-y-auto">
        {visibles.map((referencia) => (
          <button
            key={referencia.id}
            type="button"
            onClick={() => {
              onElegir(referencia)
              onCerrar()
            }}
            className="flex min-h-14 w-full items-center gap-2.5 rounded-[10px] px-3 text-left hover:bg-noct-text/[.06] active:bg-noct-text/[.1]"
          >
            <Icono size={16} className="shrink-0 text-noct-accent-300" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14.5px] text-noct-text">
                {referencia.titulo}
                {referencia.abreviatura && (
                  <span className="text-noct-neutral-400"> ({referencia.abreviatura})</span>
                )}
              </span>
              {(referencia.definicion || referencia.valor) && (
                <span className="mt-0.5 block truncate text-[12px] text-noct-neutral-500">
                  {referencia.valor || referencia.definicion}
                </span>
              )}
            </span>
          </button>
        ))}
        {visibles.length === 0 && (
          <p className="px-1 py-6 text-center text-[13px] text-noct-neutral-500">
            {candidatas.length === 0
              ? `Todavía no hay ${info.plural.toLowerCase()} en Referencia.`
              : 'Ninguna coincidencia.'}
          </p>
        )}
      </div>

      {/* CREAR SIN SALIR. Aparece con lo que ya se escribió en el
          buscador, así que crear "Gigabyte" son dos toques: escribirlo y
          confirmar. Los demás campos se rellenan luego en su ficha. */}
      <div className="mt-2 border-t border-noct-divider pt-2.5">
        <span className={CLASE_ETIQUETA}>Crear uno nuevo</span>
        <div className="mt-1.5 flex flex-col gap-2">
          <input
            type="text"
            value={consulta}
            onChange={(e) => setConsulta(e.target.value)}
            placeholder={tipo === 'termino' ? 'Gigabyte' : 'Nombre'}
            className={`min-h-11 ${CLASE_CAMPO_SOBRE_SUPERFICIE}`}
          />
          {yaExiste && nuevoTitulo !== '' && (
            <p className="text-[12px] leading-snug text-noct-precaucion">
              Ya existe «{nuevoTitulo}». Elígelo de la lista en vez de duplicarlo.
            </p>
          )}
          {error && <p className="text-[12px] text-noct-error">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void crear()}
              disabled={!puedeCrear || creando}
              className={`${BTN_PRIMARIO} min-h-11 px-3.5 disabled:opacity-40`}
            >
              <Plus size={14} aria-hidden />
              {creando ? 'Creando...' : 'Crear y vincular'}
            </button>
            <button type="button" onClick={onCerrar} className={`${BTN_GHOST} min-h-11 px-3.5`}>
              Cancelar
            </button>
          </div>
          <p className="text-[12px] leading-[1.5] text-noct-neutral-500">
            Se crea en Referencia con este nombre. La definición y el resto se completan luego en su ficha,
            sin perder lo que llevas escrito aquí.
          </p>
        </div>
      </div>
    </Modal>
  )
}
