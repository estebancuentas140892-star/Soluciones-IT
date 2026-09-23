import { Eye, MapPin } from '../../components/iconos'

// LAS SEÑALES DE UN PASO (encargo del 2026-09-22, secciones 4 y 6).
//
// Dos bloques que responden dos de las tres preguntas de un paso: DÓNDE
// se hace y QUÉ DEBO VER después. Viven aparte porque los usan las tres
// vistas de una guía (una acción a la vez, el paso entero y la lectura),
// y ModoFoco ya importa de ProcedimientoVista: tenerlos en cualquiera de
// los dos cerraría un ciclo de importaciones.
//
// Cada uno lleva su color, su icono y su palabra, nunca el color solo:
// amarillo el lugar que hay que localizar, verde el resultado correcto.

// DÓNDE HACERLO: el lugar que hay que localizar (amarillo, sección 4).
export function DondeSeHacePaso({ lugar }: { lugar: string }) {
  return (
    <p className="flex items-start gap-2.5 rounded-r-[10px] border-l-[3px] border-noct-lugar bg-noct-lugar/[.1] px-3.5 py-2.5 text-[15.5px] leading-snug">
      <MapPin size={19} className="mt-px shrink-0 text-noct-lugar" aria-hidden />
      <span className="min-w-0 text-pretty">
        <span className="font-semibold text-noct-lugar">Dónde: </span>
        <span className="text-noct-text">{lugar}</span>
      </span>
    </p>
  )
}

// QUÉ DEBO VER DESPUÉS: el resultado que confirma que el paso salió
// (verde, sección 4).
export function DebesVerPaso({ texto }: { texto: string }) {
  return (
    <p className="flex items-start gap-2.5 rounded-r-[10px] border-l-[3px] border-noct-exito bg-noct-exito/[.1] px-3.5 py-2.5 text-[15.5px] leading-snug">
      <Eye size={19} className="mt-px shrink-0 text-noct-exito" aria-hidden />
      <span className="min-w-0 text-pretty">
        <span className="font-semibold text-noct-exito">Debes ver: </span>
        <span className="text-noct-text">{texto}</span>
      </span>
    </p>
  )
}
