import { useState } from 'react'
import type { Articulo, BloquePaso, DestinoOpcion, DestinoPaso, OpcionDecision, PasoProcedimiento } from '../../lib/db'
import { crearOpcion } from '../../lib/procedimiento'
import type { ProblemaRuta } from '../../lib/rutaProcedimiento'
import {
  ArrowDown,
  ArrowElbowDownRight,
  ArrowUp,
  BookOpen,
  CaretDown,
  FlagCheckered,
  Plus,
  Signpost,
  TrashSimple,
  Warning,
} from '../../components/iconos'
import { CLASE_CAMPO_SIN_ANCHO } from '../../components/campos'
import { moverPorId } from './bloquesEditor'
import { BotonIconoLinea } from './controlesEditor'
import { HojaTipoBloque, type OpcionTipoBloque } from './HojaTipoBloque'
import { HojaVinculo } from './HojaVinculo'
import {
  etiquetaAlTerminar,
  etiquetaDestinoOpcion,
  nombreDePaso,
  pasosPosteriores,
  siguientePorDefecto,
  textoCamino,
} from './rutasEditor'

// EL EDITOR DE UNA DECISIÓN CON OPCIONES (tarea 302).
//
// Debajo de la pregunta, una tarjeta por respuesta: su título, una ayuda
// opcional para reconocerla y a dónde lleva (continuar, ir a un paso,
// abrir una guía o terminar). Cada una dice además el camino que recorre
// ("Después: 2 → 4 → 5 → 6"): así el autor ve sin ejecutar la guía si las
// rutas se juntan donde quiere. Nada de JSON y nada que elegir de una rueda:
// los destinos se eligen en las mismas hojas que el resto del editor.

type TipoDestino = DestinoOpcion['tipo']

// La hoja abierta y para qué opción: la de los cuatro destinos, la de los
// pasos o la de las guías.
type HojaAbierta = { opcionId: string; cual: 'destino' | 'paso' | 'guia' } | null

const ICONO_DESTINO = {
  continuar: ArrowDown,
  paso: ArrowElbowDownRight,
  guia: BookOpen,
  fin: FlagCheckered,
} as const

function mayuscula(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

export function OpcionesDeDecision({
  decision,
  pasos,
  indicePaso,
  vinculables,
  problemas,
  onCambiar,
  onRevisarVinculo,
}: {
  decision: BloquePaso
  // Los pasos tal como están en el editor: para elegir a cuál se salta y
  // para enseñar el camino de cada respuesta.
  pasos: PasoProcedimiento[]
  indicePaso: number
  vinculables: Articulo[]
  // Lo que impide guardar (o avisa) en ESTA decisión.
  problemas: ProblemaRuta[]
  onCambiar: (opciones: OpcionDecision[]) => void
  onRevisarVinculo: (destinoId: string) => void
}) {
  const opciones = decision.opciones ?? []
  const [hoja, setHoja] = useState<HojaAbierta>(null)
  // La opción recién añadida recibe el foco, para escribir su título sin
  // buscarla.
  const [focoOpcionId, setFocoOpcionId] = useState<string | null>(null)
  const posteriores = pasosPosteriores(pasos, indicePaso)
  const pasoId = pasos[indicePaso]?.id ?? ''
  const enEdicion = hoja ? (opciones.find((o) => o.id === hoja.opcionId) ?? null) : null

  function cambiarOpcion(id: string, cambios: Partial<OpcionDecision>) {
    onCambiar(opciones.map((opcion) => (opcion.id === id ? { ...opcion, ...cambios } : opcion)))
  }

  function agregar() {
    const nueva = crearOpcion()
    onCambiar([...opciones, nueva])
    setFocoOpcionId(nueva.id)
  }

  // "Ir a un paso" y "Abrir una guía" piden elegir cuál: se abre su hoja.
  // Los otros dos se aplican al momento.
  function elegirTipo(id: string, tipo: TipoDestino) {
    if (tipo === 'continuar' || tipo === 'fin') cambiarOpcion(id, { destino: { tipo } })
    else setHoja({ opcionId: id, cual: tipo })
  }

  const tiposDestino: OpcionTipoBloque<TipoDestino>[] = [
    {
      valor: 'continuar',
      etiqueta: 'Continuar',
      descripcion: `${mayuscula(siguientePorDefecto(pasos, indicePaso))}.`,
      Icono: ICONO_DESTINO.continuar,
      claseIcono: 'text-noct-accent-300',
    },
    // Sin pasos después no hay a dónde saltar; sin guías publicadas con
    // pasos, ninguna que abrir.
    ...(posteriores.length > 0
      ? [
          {
            valor: 'paso' as const,
            etiqueta: 'Ir a un paso',
            descripcion: 'Salta a un paso posterior de esta guía.',
            Icono: ICONO_DESTINO.paso,
            claseIcono: 'text-noct-accent-300',
          },
        ]
      : []),
    ...(vinculables.length > 0
      ? [
          {
            valor: 'guia' as const,
            etiqueta: 'Abrir una guía',
            descripcion: 'Hace otra guía en el mismo flujo y después continúa.',
            Icono: ICONO_DESTINO.guia,
            claseIcono: 'text-noct-accent-300',
          },
        ]
      : []),
    {
      valor: 'fin',
      etiqueta: 'Terminar la guía',
      descripcion: 'Con esta respuesta no queda nada más que hacer.',
      Icono: ICONO_DESTINO.fin,
      claseIcono: 'text-noct-neutral-300',
    },
  ]

  const deLaDecision = problemas.filter((problema) => problema.opcionId === null)

  return (
    <div className="ml-1 flex flex-col gap-2">
      <p className="text-[12px] font-semibold uppercase tracking-[.06em] text-noct-neutral-400">Opciones</p>
      <ol className="flex flex-col gap-2">
        {opciones.map((opcion, i) => {
          const Icono = ICONO_DESTINO[opcion.destino.tipo]
          const errores = problemas.filter((problema) => problema.opcionId === opcion.id)
          return (
            <li key={opcion.id} className="flex flex-col gap-1.5 rounded-lg border border-noct-divider bg-noct-bg px-2.5 py-2">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-noct-neutral-600 font-mono text-[12px] text-noct-neutral-300"
                >
                  {i + 1}
                </span>
                <input
                  type="text"
                  value={opcion.titulo}
                  ref={(elemento) => {
                    if (elemento && focoOpcionId === opcion.id) {
                      elemento.focus()
                      setFocoOpcionId(null)
                    }
                  }}
                  onChange={(e) => cambiarOpcion(opcion.id, { titulo: e.target.value })}
                  placeholder={i === 0 ? 'Opción (por ejemplo: Outlook clásico)' : `Opción ${i + 1}`}
                  aria-label={`Título de la opción ${i + 1}`}
                  aria-invalid={errores.length > 0 || undefined}
                  className={`min-h-12 min-w-0 flex-1 text-[15px] font-medium ${CLASE_CAMPO_SIN_ANCHO}`}
                />
              </div>
              <input
                type="text"
                value={opcion.descripcion}
                onChange={(e) => cambiarOpcion(opcion.id, { descripcion: e.target.value })}
                placeholder="Ayuda para reconocerla (opcional)"
                aria-label={`Ayuda de la opción ${i + 1} (opcional)`}
                className={`min-h-11 text-[13.5px] ${CLASE_CAMPO_SIN_ANCHO}`}
              />
              {/* EL DESTINO, A TODO EL ANCHO Y ENTERO: es lo que el autor
                  tiene que poder leer ("Ir al paso 4 · Guardar y comprobar…").
                  Al lado de los tres botones se cortaba en "Ir al paso…". */}
              <button
                type="button"
                onClick={() => setHoja({ opcionId: opcion.id, cual: 'destino' })}
                aria-label={`A dónde lleva la opción ${i + 1}: ${etiquetaDestinoOpcion(opcion.destino, pasos, indicePaso)}. Tocar para cambiarlo`}
                className="flex min-h-11 w-full items-center gap-2 rounded-md border border-noct-divider px-2.5 py-2 text-left text-[13px] leading-snug text-noct-text hover:border-noct-neutral-500"
              >
                <Icono size={15} className="shrink-0 text-noct-accent-300" aria-hidden />
                <span className="min-w-0 flex-1 text-pretty [overflow-wrap:anywhere]">
                  {etiquetaDestinoOpcion(opcion.destino, pasos, indicePaso)}
                </span>
                <CaretDown size={12} className="shrink-0 text-noct-neutral-400" aria-hidden />
              </button>
              <div className="flex items-center gap-1.5">
                <p className="min-w-0 flex-1 text-[12px] leading-snug text-noct-neutral-400">
                  {textoCamino(pasos, pasoId, decision, opcion.id)}
                </p>
                <BotonIconoLinea
                  Icono={ArrowUp}
                  etiqueta={`Subir la opción ${i + 1}`}
                  onClick={() => onCambiar(moverPorId(opciones, opcion.id, -1))}
                  disabled={i === 0}
                />
                <BotonIconoLinea
                  Icono={ArrowDown}
                  etiqueta={`Bajar la opción ${i + 1}`}
                  onClick={() => onCambiar(moverPorId(opciones, opcion.id, 1))}
                  disabled={i === opciones.length - 1}
                />
                {/* Una decisión necesita al menos dos respuestas: con dos, quitar
                    una no se ofrece (para quitar la pregunta entera, la X de la
                    línea). */}
                <BotonIconoLinea
                  Icono={TrashSimple}
                  etiqueta={`Quitar la opción ${i + 1}`}
                  onClick={() => onCambiar(opciones.filter((o) => o.id !== opcion.id))}
                  disabled={opciones.length <= 2}
                />
              </div>
              {errores.map((error) => (
                <p key={error.mensaje} className="flex items-start gap-1.5 text-[12.5px] leading-snug text-noct-error">
                  <Warning size={13} className="mt-0.5 shrink-0" aria-hidden />
                  <span className="min-w-0">{error.mensaje}</span>
                </p>
              ))}
            </li>
          )
        })}
      </ol>
      <button
        type="button"
        onClick={agregar}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-noct-neutral-700 text-[13px] font-medium text-noct-accent-300 hover:border-noct-accent hover:bg-noct-accent/[.08]"
      >
        <Plus size={15} aria-hidden />
        Añadir opción
      </button>
      {deLaDecision.map((problema) => (
        <p key={problema.mensaje} className="flex items-start gap-1.5 text-[12.5px] leading-snug text-noct-error">
          <Warning size={13} className="mt-0.5 shrink-0" aria-hidden />
          <span className="min-w-0">{problema.mensaje}</span>
        </p>
      ))}

      <HojaTipoBloque
        abierto={hoja?.cual === 'destino' && enEdicion !== null}
        // Elegir "Ir a un paso" o "Abrir una guía" abre la hoja siguiente
        // en el mismo toque: cerrar esta no debe deshacerlo.
        onCerrar={() => setHoja((actual) => (actual?.cual === 'destino' ? null : actual))}
        titulo={enEdicion?.titulo.trim() ? `¿A dónde lleva «${enEdicion.titulo.trim()}»?` : '¿A dónde lleva esta opción?'}
        opciones={tiposDestino}
        seleccionado={enEdicion?.destino.tipo ?? 'continuar'}
        onElegir={(tipo) => enEdicion && elegirTipo(enEdicion.id, tipo)}
      />
      <HojaTipoBloque
        abierto={hoja?.cual === 'paso' && enEdicion !== null}
        onCerrar={() => setHoja(null)}
        titulo="¿A qué paso lleva?"
        opciones={posteriores.map((p) => ({
          valor: p.id,
          etiqueta: `Paso ${p.numero}`,
          descripcion: p.titulo,
          Icono: Signpost,
          claseIcono: 'text-noct-accent-300',
        }))}
        seleccionado={enEdicion?.destino.tipo === 'paso' ? enEdicion.destino.pasoId : ''}
        onElegir={(destinoId) => enEdicion && cambiarOpcion(enEdicion.id, { destino: { tipo: 'paso', pasoId: destinoId } })}
      />
      <HojaVinculo
        abierto={hoja?.cual === 'guia' && enEdicion !== null}
        onCerrar={() => setHoja(null)}
        titulo="¿Qué guía abre?"
        placeholderBuscar={`Buscar en ${vinculables.length} ${vinculables.length === 1 ? 'guía' : 'guías'}`}
        grupos={[{ opciones: vinculables.map((a) => ({ id: a.id, titulo: a.titulo })) }]}
        onElegir={(articuloId) => {
          const articulo = vinculables.find((a) => a.id === articuloId)
          if (!articulo || !enEdicion) return
          onRevisarVinculo(articulo.id)
          cambiarOpcion(enEdicion.id, { destino: { tipo: 'guia', articuloId: articulo.id, titulo: articulo.titulo } })
        }}
      />
    </div>
  )
}

// DÓNDE SIGUE UN PASO AL TERMINAR (tarea 302). Solo se enseña en una guía
// con caminos: es lo que junta dos caminos en un paso común ("al terminar,
// ir al paso 4"). Por defecto, el paso de abajo.
export function AlTerminarDelPaso({
  pasos,
  indice,
  problemas,
  onCambiar,
}: {
  pasos: PasoProcedimiento[]
  indice: number
  // Lo que impide guardar en el "al terminar" de este paso.
  problemas: ProblemaRuta[]
  onCambiar: (alTerminar: DestinoPaso | undefined) => void
}) {
  const [abierta, setAbierta] = useState(false)
  const paso = pasos[indice]
  const siguiente = pasos[indice + 1]
  // El de abajo ya es el camino por defecto: no se ofrece dos veces.
  const saltos = pasosPosteriores(pasos, indice).slice(1)
  // Valores de la hoja: el id del paso al que se salta, o una de las dos
  // claves con guiones (un id de paso nunca empieza así).
  const seleccionado =
    paso?.alTerminar?.tipo === 'paso' ? paso.alTerminar.pasoId : paso?.alTerminar?.tipo === 'fin' ? '__fin' : '__abajo'

  const opciones: OpcionTipoBloque<string>[] = [
    {
      valor: '__abajo',
      etiqueta: siguiente ? 'Seguir con el paso de abajo' : 'Terminar la guía',
      descripcion: siguiente ? (nombreDePaso(pasos, siguiente.id) as string) : 'Es el último paso.',
      Icono: ArrowDown,
      claseIcono: 'text-noct-accent-300',
    },
    ...saltos.map((p) => ({
      valor: p.id,
      etiqueta: `Ir al paso ${p.numero}`,
      descripcion: p.titulo,
      Icono: Signpost,
      claseIcono: 'text-noct-accent-300',
    })),
    ...(siguiente
      ? [
          {
            valor: '__fin',
            etiqueta: 'Terminar la guía',
            descripcion: 'Este paso cierra su camino: no sigue en ningún otro.',
            Icono: FlagCheckered,
            claseIcono: 'text-noct-neutral-300',
          },
        ]
      : []),
  ]

  return (
    <div className="mt-2 flex flex-col gap-1">
      <button
        type="button"
        onClick={() => setAbierta(true)}
        aria-label={`${etiquetaAlTerminar(pasos, indice)}. Tocar para cambiarlo`}
        className={`flex min-h-11 w-full items-center gap-2 rounded-md border px-2.5 text-left text-[13px] hover:border-noct-neutral-500 ${
          paso?.alTerminar ? 'border-noct-accent/45 text-noct-text' : 'border-dashed border-noct-neutral-700 text-noct-neutral-300'
        }`}
      >
        <Signpost size={15} className="shrink-0 text-noct-neutral-400" aria-hidden />
        <span className="min-w-0 flex-1 py-2 leading-snug text-pretty [overflow-wrap:anywhere]">
          {etiquetaAlTerminar(pasos, indice)}
        </span>
        <CaretDown size={12} className="shrink-0 text-noct-neutral-400" aria-hidden />
      </button>
      {problemas.map((problema) => (
        <p key={problema.mensaje} className="flex items-start gap-1.5 text-[12.5px] leading-snug text-noct-error">
          <Warning size={13} className="mt-0.5 shrink-0" aria-hidden />
          <span className="min-w-0">{problema.mensaje}</span>
        </p>
      ))}
      <HojaTipoBloque
        abierto={abierta}
        onCerrar={() => setAbierta(false)}
        titulo={`Al terminar el paso ${indice + 1}`}
        opciones={opciones}
        seleccionado={seleccionado}
        onElegir={(valor) =>
          onCambiar(
            valor === '__abajo' ? undefined : valor === '__fin' ? { tipo: 'fin' } : { tipo: 'paso', pasoId: valor },
          )
        }
      />
    </div>
  )
}
