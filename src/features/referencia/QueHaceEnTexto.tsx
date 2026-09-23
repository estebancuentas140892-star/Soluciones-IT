import { useMemo } from 'react'
import type { Referencia } from '../../lib/db'
import { ChipReferencia } from './ChipReferencia'
import { comandosEnTexto } from './comandosEnTexto'

// "¿QUÉ HACE?" PARA LOS COMANDOS Y ATAJOS QUE UNA INSTRUCCIÓN YA ESCRIBE
// (tarea 270). Una etiqueta discreta por cada uno que existe en el
// Centro de consulta (ver `comandosEnTexto`): se toca y abre SU ficha en
// la hoja de siempre (`HojaReferencia`), sin salir de la guía ni tocar
// el avance. La guía no copia nada de la ficha: si se corrige la ficha,
// la hoja enseña lo corregido.
//
// No se ofrece para las fichas que el autor ya enlazó en el paso: esas
// ya están a la vista (la tarjeta del comando o la etiqueta del término),
// y repetirlas sería ruido.

export function QueHaceEnTexto({
  texto,
  referencias,
  excluir,
  className = '',
}: {
  texto: string
  /** Fichas vivas por id (ver `useReferencias`). */
  referencias: Map<string, Referencia>
  /** Ids de fichas ya enlazadas en el paso. */
  excluir?: ReadonlySet<string>
  className?: string
}) {
  const encontradas = useMemo(
    () => comandosEnTexto(texto, referencias.values()).filter((r) => !excluir?.has(r.id)),
    [texto, referencias, excluir],
  )
  if (encontradas.length === 0) return null
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {encontradas.map((referencia) => (
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
}
