import { useState } from 'react'
import { Check, Copy, Keyboard, LockSimple, TerminalWindow, WarningCircle } from '../../components/iconos'
import type { Referencia } from '../../lib/db'
import { copiarAlPortapapeles } from '../../lib/portapapeles'

// UN ATAJO O UN COMANDO DENTRO DE UNA TAREA.
//
// A diferencia de un termino, que se consulta y por eso vive detras de
// una etiqueta, un atajo o un comando SE USA en el momento: esconderlo
// tras un toque obligaria a abrir y cerrar una hoja con el teclado en
// una mano y el equipo en la otra. Por eso va entero y a la vista.
//
// LO QUE ESTA TARJETA NO HACE, y es la mitad del requisito:
//
//   - no ejecuta nada, nunca. Ni al mostrarse ni al tocarla: es texto
//     mas un boton de copiar;
//   - no abre ninguna aplicacion externa. No hay enlaces `ms-settings:`
//     ni nada parecido, ni siquiera detras de una accion explicita:
//     esta app no lanza programas del sistema;
//   - no marca la tarea, no cuenta para cerrar el paso y no toca el
//     avance. El bloque no es una tarea, asi que su id no entra en el
//     progreso guardado;
//   - no aparece en otra tarea: cuelga de la suya por `tareaId`, igual
//     que una imagen o un aviso.
//
// COPIAR SOLO EL COMANDO. Un atajo no se pega en ningun sitio, se
// teclea, asi que ofrecer "copiar" ahi seria un control muerto (R3).

export function TarjetaComando({
  referencia,
  tituloRespaldo,
}: {
  /** La ficha viva, o undefined si no está en este dispositivo. */
  referencia: Referencia | undefined
  /** Copia del título guardada en el bloque. */
  tituloRespaldo: string
}) {
  const [copiado, setCopiado] = useState(false)

  if (!referencia) {
    return (
      <div className="flex items-start gap-2.5 rounded-xl border border-dashed border-noct-neutral-700 px-3 py-3">
        <WarningCircle size={16} className="mt-px shrink-0 text-noct-neutral-500" aria-hidden />
        <p className="min-w-0 text-[13px] leading-normal text-noct-neutral-400">
          <span className="font-medium text-noct-neutral-300">
            {tituloRespaldo || 'Esta referencia'}
          </span>{' '}
          no está disponible en este dispositivo. Puede haberse eliminado o no haber llegado todavía.
        </p>
      </div>
    )
  }

  const esAtajo = referencia.tipo === 'atajo'
  const Icono = esAtajo ? Keyboard : TerminalWindow

  async function copiar() {
    if (!referencia || !(await copiarAlPortapapeles(referencia.valor))) return
    setCopiado(true)
    setTimeout(() => setCopiado(false), 1600)
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-noct-divider bg-noct-surface p-3">
      <div className="flex flex-col gap-0.5">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[.06em] text-noct-accent-300">
          <Icono size={13} className="shrink-0" aria-hidden />
          {esAtajo ? 'Atajo' : 'Comando'}
          {referencia.plataforma && (
            <span className="font-medium normal-case tracking-normal text-noct-neutral-400">
              · {referencia.plataforma}
            </span>
          )}
        </span>
        <span className="text-pretty text-[15px] font-medium leading-[1.3] text-noct-text">
          {referencia.titulo}
        </span>
      </div>

      {referencia.valor && (
        <div className="flex items-center gap-2 rounded-lg bg-noct-bg px-3 py-2.5">
          {/* 15 px monoespaciado y seleccionable: es el dato que hay que
              leer carácter a carácter, de pie y a un brazo (regla M-R5). */}
          <code className="min-w-0 flex-1 break-all font-mono text-[15px] leading-[1.35] text-noct-text">
            {referencia.valor}
          </code>
          {!esAtajo && (
            <button
              type="button"
              onClick={() => void copiar()}
              aria-label={copiado ? 'Comando copiado' : 'Copiar comando'}
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
      )}

      {/* La confirmación vive DENTRO del bloque, no en un aviso flotante
          que tape la instrucción siguiente. Se anuncia también para el
          lector de pantalla, que no ve el cambio del botón. */}
      {copiado && (
        <p role="status" className="text-[12px] text-noct-exito">
          Comando copiado al portapapeles.
        </p>
      )}

      <dl className="flex flex-col gap-1.5">
        {referencia.cuandoUsar && (
          <Dato etiqueta={esAtajo ? 'Qué hace' : 'Cuándo usarlo'} valor={referencia.cuandoUsar} />
        )}
        {referencia.resultadoEsperado && (
          <Dato etiqueta="Resultado esperado" valor={referencia.resultadoEsperado} />
        )}
      </dl>

      {/* Los permisos se dicen ANTES de teclearlo, no después de que
          falle. Solo cuando hacen falta: "Permisos: no" sería ruido. */}
      {referencia.requiereAdmin && (
        <p className="flex items-start gap-2 text-[12.5px] leading-normal text-noct-neutral-300">
          <LockSimple size={14} className="mt-0.5 shrink-0 text-noct-neutral-400" aria-hidden />
          Necesita permisos de administrador.
        </p>
      )}

      {referencia.advertencia && (
        <p className="rounded-r-lg border-l-2 border-noct-precaucion bg-noct-precaucion/10 px-3 py-2 text-[12.5px] leading-normal">
          <span className="font-semibold text-noct-precaucion">Precaución.</span>{' '}
          {referencia.advertencia}
        </p>
      )}
    </div>
  )
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex flex-col gap-px">
      <dt className="text-[11px] font-medium uppercase tracking-[.06em] text-noct-neutral-500">
        {etiqueta}
      </dt>
      <dd className="text-pretty text-[13px] leading-normal text-noct-neutral-200">{valor}</dd>
    </div>
  )
}
