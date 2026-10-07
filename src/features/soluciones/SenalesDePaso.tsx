import { Code, Eye, MapPin } from '../../components/iconos'

// LAS SEÑALES DE UN PASO (encargo del 2026-09-22, secciones 4 y 6).
//
// Bloques que responden las preguntas de un paso que no son la acción:
// DÓNDE se hace, QUÉ DEBO VER después y el DATO TÉCNICO que la acción
// necesita. Viven aparte porque los usan las tres vistas de una guía (una
// acción a la vez, el paso entero y la lectura), y ModoFoco ya importa de
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
