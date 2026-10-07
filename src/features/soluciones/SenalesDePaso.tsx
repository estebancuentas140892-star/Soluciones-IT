import { useId, useState } from 'react'
import { ArrowElbowDownRight, CaretDown, Code, Eye, MapPin } from '../../components/iconos'
import { llevaPuntoFinal, ROTULO_RUTA_RAPIDA, segmentoDeRuta } from '../../lib/comoHacer'
import type { MicroPasoComoHacer } from '../../lib/db'

// LAS SEÑALES DE UN PASO (encargo del 2026-09-22, secciones 4 y 6).
//
// Bloques que responden las preguntas de un paso que no son la acción:
// DÓNDE se hace, CÓMO HACERLO, QUÉ DEBO VER después y el DATO TÉCNICO que
// la acción necesita. Viven aparte porque los usan las tres vistas de una
// guía (una acción a la vez, el paso entero y la lectura), la lectura de
// una guía reutilizada y el portal de asistencia, y ModoFoco ya importa de
// ProcedimientoVista: tenerlos en cualquiera de los dos cerraría un ciclo
// de importaciones.
//
// JERARQUÍA DE UNA ACCIÓN (tarea 303, regla 27, AD-066). La pantalla
// responde "¿qué tengo que hacer ahora?" y solo la instrucción manda (26
// px). Estas señales conservan su papel y su sitio, pero pesan menos que
// ella, y se distinguen por icono, palabra, tipografía y espacio antes que
// por fondos y bordes:
//
//   - Dónde orienta: neutro, con su chincheta y su palabra. Sin el
//     amarillo ni la barra que lo hacían parecer una advertencia (sección
//     13 de la auditoría UX: el ámbar con texto es "requiere atención").
//   - Cómo hacerlo: las microacciones que hacen la acción, pegadas a la
//     instrucción y en voz más baja que ella. Primero la ruta rápida
//     (los elementos en orden, para quien ya conoce el sitio) y, plegado,
//     el paso a paso numerado (para quien llega nuevo). Texto normal, sin
//     caja ni color de estado: es apoyo operativo, no un aviso ni un valor.
//   - Dato técnico: un valor exacto que la acción necesita, con su rótulo
//     y en monoespaciada, subordinado a la instrucción.
//   - Debes ver comprueba, después del trabajo: el verde va en su icono y
//     su palabra, sin caja, para no competir con la acción antes de hacerla.
//
// El único bloque del cuerpo de un paso con fondo de color sigue siendo el
// riesgo real (Precaución e Importante, en tonos.ts).

// DÓNDE HACERLO: dónde hay que estar para hacer la acción. Solo orienta.
export function DondeSeHacePaso({ lugar }: { lugar: string }) {
  return (
    <p className="flex items-start gap-2 text-[14px] leading-snug text-noct-neutral-300">
      <MapPin size={16} className="mt-[2px] shrink-0 text-noct-neutral-400" aria-hidden />
      <span className="min-w-0 text-pretty [overflow-wrap:anywhere]">
        <span className="font-medium text-noct-neutral-400">Dónde: </span>
        {lugar}
      </span>
    </p>
  )
}

// Tamaños según dónde se lee: bajo la instrucción de 26 px (una acción a
// la vez), bajo la fila de una tarea (paso entero, lectura y "Probar") o
// en la lectura compacta de una guía reutilizada. `sangria` alinea el
// paso a paso con el texto de la ruta (el icono y su hueco).
const TAMANOS_COMO_HACERLO = {
  accion: { ruta: 'text-[16px]', icono: 17, margen: 'mt-[3px]', sangria: 'pl-[25px]', paso: 'text-[15px]', ubicacion: 'text-[13px]', boton: 'text-[14px]' },
  fila: { ruta: 'text-[14px]', icono: 15, margen: 'mt-[2px]', sangria: 'pl-[23px]', paso: 'text-[14px]', ubicacion: 'text-[12.5px]', boton: 'text-[13px]' },
  lectura: { ruta: 'text-[13px]', icono: 14, margen: 'mt-[2px]', sangria: 'pl-[22px]', paso: 'text-[13px]', ubicacion: 'text-[12px]', boton: 'text-[13px]' },
} as const

// CÓMO HACERLO (tarea 303): las microacciones de la acción, con UN solo
// contenido y dos niveles de lectura (ver `src/lib/comoHacer.ts`).
//
//   - RUTA RÁPIDA, siempre a la vista: los elementos en orden, separados
//     por "›" ("Fichero › Cliente › Fichero › Nuevo"). Es lo que lee de un
//     vistazo el técnico que ya conoce el sitio. Envuelve en varias líneas
//     cuando no cabe y nunca recorta ni abrevia un nombre: el separador va
//     pegado al elemento anterior, así que ninguna línea empieza por él.
//   - VER PASO A PASO, plegado: las mismas microacciones numeradas, como
//     frases ("Abre Fichero."), con la ubicación debajo cuando la hay. Es
//     para quien llega nuevo; ligero, sin tarjetas, y subordinado a la
//     instrucción por la sangría y la raya, no por una caja.
//
// Cuelga de la instrucción (la flecha en ángulo). Lo desplegado es de esta
// acción: quien la cambia por otra le da otra `key`, y vuelve plegado.
// Nada se interpreta: un comando escrito como elemento conserva el
// tratamiento de siempre ("¿Qué hace?", `QueHaceEnTexto`, fuera de aquí).
export function ComoHacerlo({
  microPasos,
  variante = 'accion',
  className = '',
}: {
  microPasos: MicroPasoComoHacer[]
  variante?: keyof typeof TAMANOS_COMO_HACERLO
  className?: string
}) {
  const [abierto, setAbierto] = useState(false)
  const idRuta = useId()
  const idPasoAPaso = useId()
  if (microPasos.length === 0) return null
  const tamano = TAMANOS_COMO_HACERLO[variante]
  return (
    <div className={`flex min-w-0 flex-col ${className}`}>
      <div className={`flex items-start gap-2 leading-snug ${tamano.ruta}`}>
        <ArrowElbowDownRight size={tamano.icono} className={`${tamano.margen} shrink-0 text-noct-neutral-400`} aria-hidden />
        <div className="min-w-0 text-pretty [overflow-wrap:anywhere]">
          <span id={idRuta} className="font-medium text-noct-neutral-400">
            {ROTULO_RUTA_RAPIDA}:{' '}
          </span>
          {/* Una lista de verdad (el orden importa) que se lee como una
              línea: `role` la conserva aunque se dibuje en línea. */}
          <ol role="list" aria-labelledby={idRuta} className="inline">
            {microPasos.map((micro, indice) => (
              <li key={micro.id} className="inline font-medium text-noct-neutral-200">
                {segmentoDeRuta(micro)}
                {indice < microPasos.length - 1 && (
                  <span aria-hidden className="font-normal text-noct-neutral-500">
                    {' ›'}{' '}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </div>
      </div>
      <div className={`flex flex-col ${tamano.sangria}`}>
        <button
          type="button"
          aria-expanded={abierto}
          aria-controls={abierto ? idPasoAPaso : undefined}
          onClick={() => setAbierto((valor) => !valor)}
          className={`-ml-1 inline-flex min-h-11 w-fit items-center gap-1.5 rounded-lg px-1 font-medium text-noct-neutral-300 hover:text-noct-text ${tamano.boton}`}
        >
          {abierto ? 'Ocultar paso a paso' : 'Ver paso a paso'}
          <CaretDown size={13} className={`shrink-0 transition-transform ${abierto ? 'rotate-180' : ''}`} aria-hidden />
        </button>
        {abierto && (
          <ol
            id={idPasoAPaso}
            className={`mb-1 list-decimal space-y-1.5 border-l-2 border-noct-divider pl-7 leading-snug text-noct-neutral-200 marker:text-noct-neutral-400 ${tamano.paso}`}
          >
            {microPasos.map((micro) => (
              <li key={micro.id} className="pl-0.5">
                <span className="text-pretty [overflow-wrap:anywhere]">
                  {micro.accion}
                  {micro.accion && micro.elemento && ' '}
                  {micro.elemento && <span className="font-medium text-noct-text">{micro.elemento}</span>}
                  {llevaPuntoFinal(micro.elemento || micro.accion) && '.'}
                </span>
                {micro.ubicacion && (
                  <span className={`mt-0.5 block text-pretty text-noct-neutral-400 [overflow-wrap:anywhere] ${tamano.ubicacion}`}>
                    <span className="sr-only">Ubicación: </span>
                    {micro.ubicacion}
                  </span>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}

// UN DATO TÉCNICO: el valor exacto que hace falta para la acción (una IP,
// un puerto, una ruta, un comando, un nombre de archivo). Su rótulo dice
// qué es, y la monoespaciada, que se escribe tal cual: así no se lee como
// una segunda instrucción.
export function DatoTecnico({ texto }: { texto: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <p className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[.06em] text-noct-neutral-400">
        <Code size={13} className="shrink-0" aria-hidden />
        Dato técnico
      </p>
      <p className="w-fit max-w-full rounded-md bg-noct-text/[.06] px-2.5 py-1.5 font-mono text-[14.5px] leading-snug text-noct-neutral-200 [overflow-wrap:anywhere]">
        {texto || 'Dato sin texto'}
      </p>
    </div>
  )
}

// QUÉ DEBO VER DESPUÉS: el resultado que confirma que el paso salió.
export function DebesVerPaso({ texto }: { texto: string }) {
  return (
    <p className="flex items-start gap-2 text-[15px] leading-snug text-noct-neutral-200">
      <Eye size={17} className="mt-[2px] shrink-0 text-noct-exito" aria-hidden />
      <span className="min-w-0 text-pretty [overflow-wrap:anywhere]">
        <span className="font-semibold text-noct-exito">Debes ver: </span>
        {texto}
      </span>
    </p>
  )
}
