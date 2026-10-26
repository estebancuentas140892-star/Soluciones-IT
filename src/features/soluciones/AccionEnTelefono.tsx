import type { ReactNode } from 'react'
import type { Referencia } from '../../lib/db'
import {
  ArrowDown,
  BookOpen,
  Camera,
  Eye,
  Info,
  Lightbulb,
  ListChecks,
  MapPin,
  Note,
  Paperclip,
  Question,
  type IconoProps,
} from '../../components/iconos'
import { HojaInferior } from '../../components/HojaInferior'
import { IconoVentana } from '../../components/ventana/IconoVentana'
import { ChipReferencia } from '../referencia/ChipReferencia'
import { ROTULOS_AYUDA, type SeccionAyuda } from './accionTelefono'
import { AdjuntoPaso, AdjuntosPaso, GuiaVinculadaEnBloque } from './ProcedimientoVista'
import { ImagenDelResultado } from './SenalesDePaso'

// LAS PIEZAS DE LA ACCIÓN A LA VEZ EN EL TELÉFONO (tarea 355, «Equilibrada
// esencial» de Claude Design; la lógica, en accionTelefono.ts). Las monta
// `ModoFoco` por debajo de 768 px, junto con las de `components/ventana/`
// (el pie, las advertencias, «Más abajo»), con los tokens Nocturne y sin
// variantes propias (regla 31 e).

// ----------------------------------------------------------------
// «Dónde»
// ----------------------------------------------------------------

/**
 * DÓNDE SE HACE LA ACCIÓN, en una línea (nota 2 de la especificación): el
 * programa o la ventana del paso («Outlook», «Ficha del cliente»), para no
 * perder el contexto con una acción por pantalla. Sin fondo ni color propio:
 * el fondo de color es solo del riesgo real (regla 27 i). Sin texto, nada.
 */
export function LineaDonde({ lugar }: { lugar: string }) {
  const texto = lugar.trim()
  if (!texto) return null
  return (
    <p data-donde className="flex min-w-0 items-start gap-1.5 text-[14px] font-semibold leading-5 text-noct-neutral-300">
      <MapPin size={17} className="mt-px shrink-0" aria-hidden />
      <span className="sr-only">Dónde: </span>
      <span className="min-w-0 text-pretty [overflow-wrap:anywhere]">{texto}</span>
    </p>
  )
}

// ----------------------------------------------------------------
// «Tengo un problema», en la cabecera
// ----------------------------------------------------------------

/**
 * EL ICONO «TENGO UN PROBLEMA» DE LA CABECERA (nota 1 de la especificación):
 * sin la tarjeta de la ventana, su salida «Tengo un problema» se queda sin
 * sitio, así que sube a la fila de la X y el índice. 44 x 44, abre las mismas
 * salidas de siempre (`HojaFalla`).
 */
export function BotonProblemaCabecera({ onAbrir }: { onAbrir: () => void }) {
  return (
    <button
      type="button"
      onClick={onAbrir}
      aria-haspopup="dialog"
      aria-label="Tengo un problema con esta acción: ver las salidas"
      title="Tengo un problema"
      data-problema-cabecera
      className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl text-noct-text outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-noct-accent active:bg-noct-presionado"
    >
      <IconoVentana nombre="problema" tam={21} grosor={2.4} />
    </button>
  )
}

// ----------------------------------------------------------------
// «Ayuda con este paso»
// ----------------------------------------------------------------

/**
 * EL BOTÓN QUE ABRE LA AYUDA (sección 6 de la especificación): una píldora
 * delineada de 44 de alto, sin relleno, para no competir con «Listo», la única
 * acción rellena de la pantalla (regla 30). En la primera acción de la guía,
 * con requisitos y sin avance, dice además «Ten a mano N cosas». Quien lo
 * monta decide si se dibuja: sin nada que enseñar, no hay botón.
 */
export function BotonAyudaPaso({ etiqueta, onAbrir }: { etiqueta: string | null; onAbrir: () => void }) {
  return (
    <button
      type="button"
      onClick={onAbrir}
      aria-haspopup="dialog"
      data-ayuda-paso
      className="flex min-h-11 w-fit max-w-full cursor-pointer flex-wrap items-center gap-x-2.5 gap-y-1 rounded-[22px] border-[1.5px] border-noct-divider-fuerte px-4 py-2 text-left text-[15px] font-semibold leading-5 text-noct-neutral-300 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-noct-accent active:bg-noct-presionado"
    >
      <span className="flex items-center gap-2">
        <Question size={19} className="shrink-0 text-noct-accent-300" aria-hidden />
        Ayuda con este paso
      </span>
      {etiqueta && (
        <span data-ten-a-mano className="flex items-center gap-1.5 text-[14px] font-bold text-noct-accent-300">
          <ListChecks size={16} className="shrink-0" aria-hidden />
          {etiqueta}
        </span>
      )}
    </button>
  )
}

// El dibujo de cada sección: icono, rótulo y su color. «Así sabes que
// funcionó» va en el verde de lo que confirma; lo demás, en el acento, que
// aquí no se toca: solo encabeza.
const DIBUJO: Record<SeccionAyuda['clave'], { Icono: (props: IconoProps) => ReactNode; color: string }> = {
  requisitos: { Icono: ListChecks, color: 'text-noct-accent-300' },
  funciono: { Icono: Eye, color: 'text-noct-exito' },
  imagenes: { Icono: Camera, color: 'text-noct-accent-300' },
  significa: { Icono: BookOpen, color: 'text-noct-accent-300' },
  paraQue: { Icono: Info, color: 'text-noct-accent-300' },
  notas: { Icono: Note, color: 'text-noct-accent-300' },
  archivos: { Icono: Paperclip, color: 'text-noct-accent-300' },
  consulta: { Icono: BookOpen, color: 'text-noct-accent-300' },
  loQueSigue: { Icono: ArrowDown, color: 'text-noct-neutral-300' },
}

/**
 * LA HOJA «AYUDA CON ESTE PASO» (sección 6 de la especificación): lo que
 * acompaña a la acción, a pedido, sobre `HojaInferior`, como `HojaFalla`. El
 * rótulo es «Ayuda con este paso» y el título, la instrucción. Las secciones
 * llegan ya ordenadas y nunca vacías (`seccionesDeAyuda`). Al pie, la salida
 * de siempre cuando lo que se ve no es lo que la guía dice.
 */
export function HojaAyudaPaso({
  abierta,
  onCerrar,
  instruccion,
  secciones,
  referencias,
  tituloPaso,
  onTengoUnProblema,
}: {
  abierta: boolean
  onCerrar: () => void
  instruccion: string
  secciones: SeccionAyuda[]
  /** Las fichas del Centro de consulta, para los términos y «¿Qué hace?». */
  referencias: Map<string, Referencia>
  /** El título del paso, para el nombre de sus imágenes y archivos. */
  tituloPaso: string
  onTengoUnProblema: () => void
}) {
  return (
    <HojaInferior
      abierta={abierta}
      onCerrar={onCerrar}
      contexto="Ayuda con este paso"
      titulo={instruccion}
      etiquetaCerrar="Cerrar la ayuda y volver a la acción"
    >
      <div data-hoja-ayuda className="flex flex-col gap-5 pb-1 pt-2">
        {secciones.map((seccion) => {
          const { Icono, color } = DIBUJO[seccion.clave]
          return (
            <section key={seccion.clave} data-seccion-ayuda={seccion.clave} className="flex items-start gap-3">
              <Icono size={21} className={`mt-px shrink-0 ${color}`} />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <h3 className={`text-[15px] font-bold leading-5 ${color}`}>{ROTULOS_AYUDA[seccion.clave]}</h3>
                <CuerpoDeSeccion seccion={seccion} referencias={referencias} tituloPaso={tituloPaso} />
              </div>
            </section>
          )
        })}
        <button
          type="button"
          onClick={onTengoUnProblema}
          aria-haspopup="dialog"
          className="-mx-1 flex min-h-11 w-fit max-w-full cursor-pointer items-center gap-2.5 rounded-xl px-1 text-left text-[15.5px] font-bold leading-snug text-noct-text active:bg-noct-presionado"
        >
          <IconoVentana nombre="problema" tam={20} grosor={2.4} className="shrink-0 text-noct-neutral-300" />
          No sale como dice: tengo un problema
        </button>
      </div>
    </HojaInferior>
  )
}

const TEXTO_SECCION = 'text-[16px] leading-[1.45] text-noct-text text-pretty [overflow-wrap:anywhere]'

function CuerpoDeSeccion({
  seccion,
  referencias,
  tituloPaso,
}: {
  seccion: SeccionAyuda
  referencias: Map<string, Referencia>
  tituloPaso: string
}) {
  switch (seccion.clave) {
    case 'requisitos':
      return (
        <ul className="flex flex-col gap-1">
          {seccion.requisitos.map((requisito, i) => (
            <li key={i} className={TEXTO_SECCION}>
              {requisito}
            </li>
          ))}
        </ul>
      )
    case 'funciono':
      return <ImagenDelResultado resultado={seccion.resultado} />
    case 'imagenes':
      return (
        <div className="flex flex-col gap-3">
          {seccion.imagenes.map((imagen) => (
            <figure key={imagen.id} className="flex flex-col gap-1.5">
              <AdjuntoPaso adjunto={imagen.adjunto} titulo={imagen.pie || tituloPaso} pie={imagen.pie || null} />
              {imagen.pie && <figcaption className="text-[13.5px] leading-snug text-noct-neutral-300">{imagen.pie}</figcaption>}
            </figure>
          ))}
        </div>
      )
    case 'significa':
      return (
        <div className="flex flex-wrap gap-1.5">
          {seccion.terminos.map((bloque) => (
            <ChipReferencia
              key={bloque.id}
              referenciaId={bloque.referenciaId as string}
              tituloRespaldo={bloque.referenciaTitulo}
              referencias={referencias}
            />
          ))}
          {seccion.queHace.map((referencia) => (
            <ChipReferencia
              key={referencia.id}
              referenciaId={referencia.id}
              tituloRespaldo={referencia.titulo}
              referencias={referencias}
              rotulo={`¿Qué hace «${referencia.valor.trim()}»?`}
            />
          ))}
        </div>
      )
    case 'paraQue':
      return <p className={`whitespace-pre-line ${TEXTO_SECCION}`}>{seccion.texto}</p>
    case 'notas':
      // Cada nota con su palabra, como en Detalles (`NotasDeLaGuia`): que no se
      // confunda con una advertencia.
      return (
        <ul className="flex flex-col gap-2.5">
          {seccion.notas.map((nota) => {
            const IconoNota = nota.tono === 'consejo' ? Lightbulb : Info
            return (
              <li key={nota.id} className="flex items-start gap-2">
                <IconoNota size={17} className="mt-[3px] shrink-0 text-noct-neutral-300" aria-hidden />
                <p className={`min-w-0 ${TEXTO_SECCION}`}>
                  <span className="font-bold">{nota.tono === 'consejo' ? 'Consejo' : 'Información'}. </span>
                  <span className="whitespace-pre-line">{nota.texto}</span>
                </p>
              </li>
            )
          })}
        </ul>
      )
    case 'archivos':
      return <AdjuntosPaso adjuntos={seccion.archivos} titulo={tituloPaso} />
    case 'consulta':
      return (
        <div className="flex flex-col gap-2">
          {seccion.guias.map((bloque) => (
            <GuiaVinculadaEnBloque
              key={bloque.id}
              articuloId={bloque.guiaArticuloId as string}
              tituloReferencia={bloque.guiaArticuloTitulo}
              intencion={bloque.intencionGuia}
            />
          ))}
        </div>
      )
    case 'loQueSigue':
      return <p className={TEXTO_SECCION}>{seccion.texto}</p>
  }
}
