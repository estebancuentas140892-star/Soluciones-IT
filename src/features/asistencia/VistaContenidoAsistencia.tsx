import { useState } from 'react'
import {
  ArrowSquareOut,
  Check,
  Copy,
  CursorClick,
  Keyboard,
  Paperclip,
  SealCheck,
  TerminalWindow,
  Code,
} from '../../components/iconos'
import { copiarAlPortapapeles } from '../../lib/portapapeles'
import { DebesVerPaso, DondeSeHacePaso } from '../soluciones/SenalesDePaso'
import { TONOS_AVISO } from '../soluciones/tonos'
import type { BloqueAsistencia, ContenidoAsistencia } from './modelo'
import { esUrlWeb } from './modelo'

// LO QUE VE EL COMPUTADOR ATENDIDO (tarea 258).
//
// UN SOLO COMPONENTE para el portal y para la vista previa del tecnico:
// "Así se verá en el equipo" no es una promesa, es el mismo codigo. Por
// eso este archivo, igual que `modelo.ts`, no toca la base local ni
// Supabase: el portal lo importa y no puede arrastrar la app.
//
// Todo se dibuja como TEXTO (React lo escapa): ningun envio puede meter
// HTML ni script en el portal. Un enlace solo se vuelve enlace si es
// http(s), se abre en otra pestaña sin `Referer` ni acceso a esta, y
// siempre se puede copiar en vez de abrir. Nada se ejecuta nunca: un
// comando es texto con un boton de copiar, igual que en la guia
// (`TarjetaComando`).

interface Props {
  contenido: ContenidoAsistencia
  /** Cuándo llegó, ya formateado ("10:42"). Solo en el portal. */
  recibido?: string
  /** El envío más reciente va destacado; los anteriores, más discretos. */
  destacado?: boolean
}

export function VistaContenidoAsistencia({ contenido, recibido, destacado = true }: Props) {
  const acciones = contenido.bloques.filter((b) => b.tipo === 'accion' || b.tipo === 'comprobacion')
  const numerar = acciones.length > 1
  let numero = 0

  return (
    <article
      className={`flex flex-col gap-3 rounded-2xl border bg-noct-surface p-4 ${
        destacado ? 'border-noct-accent/40' : 'border-noct-divider opacity-90'
      }`}
    >
      <header className="flex flex-col gap-0.5">
        {(contenido.subtitulo || recibido) && (
          <p className="flex flex-wrap items-baseline gap-x-2 text-[12px] text-noct-neutral-400">
            {contenido.subtitulo && <span className="min-w-0 text-pretty">{contenido.subtitulo}</span>}
            {recibido && <span className="tabular-nums">· {recibido}</span>}
          </p>
        )}
        <h2 className="text-pretty text-[19px] font-semibold leading-snug text-noct-text">{contenido.titulo}</h2>
      </header>

      {contenido.bloques.map((bloque, i) => {
        if (bloque.tipo === 'accion' || bloque.tipo === 'comprobacion') numero += 1
        return <Bloque key={`${i}-${bloque.tipo}`} bloque={bloque} numero={numerar ? numero : null} />
      })}
    </article>
  )
}

function Bloque({ bloque, numero }: { bloque: BloqueAsistencia; numero: number | null }) {
  switch (bloque.tipo) {
    case 'donde':
      return <DondeSeHacePaso lugar={bloque.texto} />
    case 'debes_ver':
      return <DebesVerPaso texto={bloque.texto} />
    case 'accion':
    case 'comprobacion': {
      const Icono = bloque.tipo === 'accion' ? CursorClick : SealCheck
      return (
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex min-w-[22px] shrink-0 items-center justify-center text-noct-accion">
            {numero !== null ? (
              <span className="text-[14px] font-semibold tabular-nums">{numero}.</span>
            ) : (
              <Icono size={18} aria-hidden />
            )}
          </span>
          <p className="min-w-0 text-pretty text-[17px] leading-snug text-noct-text">
            {bloque.tipo === 'comprobacion' && (
              <span className="font-semibold text-noct-neutral-300">Comprueba: </span>
            )}
            {bloque.texto}
          </p>
        </div>
      )
    }
    case 'nota': {
      const tono = TONOS_AVISO.find((t) => t.etiqueta === bloque.etiqueta) ?? TONOS_AVISO[0]
      const Icono = tono.Icono
      return (
        <p className={`flex items-start gap-2.5 rounded-r-[10px] border-l-[3px] px-3.5 py-2.5 text-[14.5px] leading-snug ${tono.claseBarra} ${tono.claseFondo}`}>
          <Icono size={17} className={`mt-px shrink-0 ${tono.claseIcono}`} aria-hidden />
          <span className="min-w-0 text-pretty">
            <span className="font-semibold">{tono.etiqueta}: </span>
            {bloque.texto}
          </span>
        </p>
      )
    }
    case 'dato':
      return <Copiable icono={Code} rotulo={bloque.etiqueta || 'Dato técnico'} valor={bloque.texto} />
    case 'comando':
      return (
        <Copiable
          icono={TerminalWindow}
          rotulo={bloque.plataforma ? `Comando · ${bloque.plataforma}` : 'Comando'}
          titulo={bloque.titulo}
          valor={bloque.texto}
        />
      )
    case 'atajo':
      // Un atajo se teclea, no se pega: sin copiar (mismo criterio que la guía).
      return (
        <Copiable icono={Keyboard} rotulo="Atajo" titulo={bloque.titulo} valor={bloque.texto} sinCopiar />
      )
    case 'url':
      return <Enlace url={bloque.texto} />
    case 'archivo':
      return <Copiable icono={Paperclip} rotulo="Archivo" valor={bloque.texto} />
    default:
      // Un tipo que esta versión no conoce no se dibuja: nunca se
      // interpreta algo que no se validó.
      return null
  }
}

function Copiable({
  icono: Icono,
  rotulo,
  titulo,
  valor,
  sinCopiar = false,
}: {
  icono: typeof Code
  rotulo: string
  titulo?: string
  valor: string
  sinCopiar?: boolean
}) {
  const [copiado, setCopiado] = useState(false)

  async function copiar() {
    if (!(await copiarAlPortapapeles(valor))) return
    setCopiado(true)
    setTimeout(() => setCopiado(false), 1600)
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-noct-divider bg-noct-bg/40 p-3">
      <div className="flex flex-col gap-0.5">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[.06em] text-noct-accent-300">
          <Icono size={13} className="shrink-0" aria-hidden />
          {rotulo}
        </span>
        {titulo && <span className="text-pretty text-[14px] font-medium text-noct-neutral-200">{titulo}</span>}
      </div>
      <div className="flex items-center gap-2 rounded-lg bg-noct-bg px-3 py-2.5">
        {/* Se corta por palabra y solo parte una palabra si no cabe
            (`ipconfig /flushdns` no queda como "ipconfig /flushdn s"). */}
        <code className="min-w-0 flex-1 font-mono text-[15px] leading-[1.35] text-noct-text [overflow-wrap:anywhere]">
          {valor}
        </code>
        {!sinCopiar && (
          <button
            type="button"
            onClick={() => void copiar()}
            aria-label={copiado ? 'Copiado' : `Copiar: ${valor}`}
            className="flex h-11 shrink-0 items-center gap-1.5 rounded-lg bg-noct-text/[.07] px-2.5 text-[12.5px] font-medium text-noct-neutral-200 hover:bg-noct-text/[.13]"
          >
            {copiado ? (
              <>
                <Check size={15} className="text-noct-exito" aria-hidden />
                Copiado
              </>
            ) : (
              <>
                <Copy size={15} aria-hidden />
                Copiar
              </>
            )}
          </button>
        )}
      </div>
      {copiado && (
        <p role="status" className="text-[12px] text-noct-exito">
          Copiado al portapapeles.
        </p>
      )}
    </div>
  )
}

function Enlace({ url }: { url: string }) {
  // Doble control: el servidor ya rechaza lo que no es http(s), y aquí
  // tampoco se vuelve enlace.
  if (!esUrlWeb(url)) return <Copiable icono={ArrowSquareOut} rotulo="Dirección" valor={url} />
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-noct-divider bg-noct-bg/40 p-3">
      <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[.06em] text-noct-accent-300">
        <ArrowSquareOut size={13} className="shrink-0" aria-hidden />
        Enlace
      </span>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        referrerPolicy="no-referrer"
        className="text-[15px] leading-snug text-noct-accent underline [overflow-wrap:anywhere] decoration-noct-accent/40 underline-offset-2"
      >
        {url}
      </a>
      <CopiarEnlace url={url} />
    </div>
  )
}

function CopiarEnlace({ url }: { url: string }) {
  const [copiado, setCopiado] = useState(false)
  return (
    <button
      type="button"
      onClick={() =>
        void copiarAlPortapapeles(url).then((ok) => {
          if (!ok) return
          setCopiado(true)
          setTimeout(() => setCopiado(false), 1600)
        })
      }
      className="flex h-11 items-center justify-center gap-1.5 self-start rounded-lg bg-noct-text/[.07] px-3 text-[12.5px] font-medium text-noct-neutral-200 hover:bg-noct-text/[.13]"
    >
      {copiado ? <Check size={15} className="text-noct-exito" aria-hidden /> : <Copy size={15} aria-hidden />}
      {copiado ? 'Enlace copiado' : 'Copiar enlace'}
    </button>
  )
}
