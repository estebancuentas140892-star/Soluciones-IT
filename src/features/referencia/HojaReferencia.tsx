import { useEffect, useState, type ReactNode } from 'react'
import { Modal } from '../../components/Modal'
import { ArrowLeft, WarningCircle, X } from '../../components/iconos'
import { TagNeutral } from '../../components/nocturne'
import type { Referencia } from '../../lib/db'
import { nombreVivo } from '../../lib/referencia'
import { EstadoUso } from './EstadoUso'
import { iconoDeReferencia } from './iconosReferencia'
import { esTipoConocido, INFO_TIPO } from './referencias'

// LA CONSULTA DE UNA FICHA SIN SALIR DE LA GUIA.
//
// En movil `Modal` ya entra pegado abajo (hoja inferior) y en pantallas
// grandes queda centrado (dialogo), que es exactamente lo que pide el
// encargo, asi que no hay dos componentes sino dos comportamientos del
// mismo.
//
// LO QUE ESTA HOJA NO HACE, y es la mitad del requisito:
//
//   - no navega a ningun sitio (nada de "Ver en el Centro de consulta"):
//     abrir un termino no puede costar perder el punto de la ejecucion;
//   - no toca el avance: leer una definicion no es trabajo hecho;
//   - al cerrarse devuelve el foco al chip que la abrio (lo hace quien
//     la abre, ver ChipReferencia), asi que el lector de pantalla y el
//     teclado vuelven a la tarea, no al principio del documento.
//
// Las fichas relacionadas se recorren DENTRO de la hoja: cambiar de
// ficha aqui es seguir consultando, no salir. Al cerrar vuelve a la
// ficha con la que se abrio. Una herramienta muestra aqui lo mismo que
// se lee primero en su ficha: para que sirve y como se usa en
// Metroparques, con lo que se sabe de ese uso.

const ID_TITULO = 'hoja-referencia-titulo'

interface Props {
  abierto: boolean
  onCerrar: () => void
  /** Id de la ficha a mostrar. */
  referenciaId: string
  /** Copia del título guardada en el bloque, para cuando la fila no está. */
  tituloRespaldo: string
  /** Fichas vivas por id (ver useReferencias). */
  referencias: Map<string, Referencia>
}

export function HojaReferencia({ abierto, onCerrar, referenciaId, tituloRespaldo, referencias }: Props) {
  // Qué ficha se está leyendo ahora mismo: cambia al tocar una
  // relacionada y vuelve a la original en cada apertura.
  const [actualId, setActualId] = useState(referenciaId)

  useEffect(() => {
    if (abierto) setActualId(referenciaId)
  }, [abierto, referenciaId])

  const referencia = referencias.get(actualId)
  const tipo = referencia && esTipoConocido(referencia.tipo) ? referencia.tipo : null
  const Icono = iconoDeReferencia(tipo)
  const esHerramienta = tipo === 'herramienta'
  const volvioDeUnaRelacionada = actualId !== referenciaId

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} tituloId={ID_TITULO}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {volvioDeUnaRelacionada && (
            <button
              type="button"
              onClick={() => setActualId(referenciaId)}
              className="-ml-1 mb-1 flex min-h-9 items-center gap-1.5 rounded-md px-1 text-[12px] font-medium text-noct-neutral-400 hover:text-noct-text"
            >
              <ArrowLeft size={13} aria-hidden />
              Volver a «{nombreVivo(mapaTitulos(referencias), referenciaId, tituloRespaldo)}»
            </button>
          )}
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[.08em] text-noct-accent-300">
            <Icono size={13} aria-hidden />
            {tipo ? INFO_TIPO[tipo].etiqueta : 'Centro de consulta'}
          </p>
          <h2
            id={ID_TITULO}
            className="mt-0.5 text-pretty text-[19px] font-medium leading-[1.25] text-noct-text"
          >
            {referencia?.titulo || tituloRespaldo || 'Ficha'}
            {referencia?.abreviatura && (
              <span className="text-noct-neutral-400"> ({referencia.abreviatura})</span>
            )}
          </h2>
        </div>
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar y volver a la tarea"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-noct-text/[.08] text-noct-text hover:bg-noct-text/[.14]"
        >
          <X size={20} aria-hidden />
        </button>
      </div>

      {!referencia ? (
        // NO DISPONIBLE, NO ROTO. El bloque conserva el vínculo y la
        // copia del título; lo único que falta es la ficha, y puede
        // llegar en la próxima sincronización.
        <div className="flex items-start gap-2.5 rounded-lg border border-noct-divider bg-noct-surface px-3 py-3">
          <WarningCircle size={17} className="mt-px shrink-0 text-noct-neutral-400" aria-hidden />
          <p className="min-w-0 text-[13px] leading-normal text-noct-neutral-300">
            Esta ficha no está disponible en este dispositivo. Puede haberse eliminado o no haber
            llegado todavía. El vínculo se conserva.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          {referencia.definicion && (
            <p className="text-pretty text-[14.5px] leading-[1.55] text-noct-text">{referencia.definicion}</p>
          )}

          {esHerramienta && referencia.cuandoUsar && (
            <Bloque titulo="¿Para qué sirve?">
              <p className="text-pretty text-[13.5px] leading-[1.55] text-noct-neutral-200">
                {referencia.cuandoUsar}
              </p>
            </Bloque>
          )}

          {esHerramienta && (referencia.usoEnMetroparques || referencia.estadoUso) && (
            <Bloque titulo="En Metroparques">
              <div className="flex flex-col gap-1.5">
                {referencia.usoEnMetroparques && (
                  <p className="text-pretty text-[13.5px] leading-[1.55] text-noct-neutral-200">
                    {referencia.usoEnMetroparques}
                  </p>
                )}
                <EstadoUso estado={referencia.estadoUso} />
              </div>
            </Bloque>
          )}

          {esHerramienta && referencia.notas && (
            <Bloque titulo="Notas">
              <p className="text-pretty text-[13.5px] leading-[1.55] text-noct-neutral-200">{referencia.notas}</p>
            </Bloque>
          )}

          {referencia.valor && (
            <p className="rounded-lg bg-noct-bg px-3 py-2.5 font-mono text-[13.5px] leading-normal text-noct-text">
              {referencia.valor}
            </p>
          )}

          {referencia.ejemplo && (
            <Bloque titulo="Ejemplo">
              <p className="text-pretty rounded-lg bg-noct-bg px-3 py-2.5 text-[13px] leading-[1.55] text-noct-neutral-200">
                {referencia.ejemplo}
              </p>
            </Bloque>
          )}

          {(referencia.alias ?? []).length > 0 && (
            <Bloque titulo="También se llama">
              <div className="flex flex-wrap gap-1.5">
                {referencia.alias.map((alias) => (
                  <TagNeutral key={alias}>{alias}</TagNeutral>
                ))}
              </div>
            </Bloque>
          )}

          {(referencia.relacionadas ?? []).length > 0 && (
            <Bloque titulo="Relacionado">
              <div className="flex flex-col">
                {referencia.relacionadas.map((relacionada) => {
                  const viva = referencias.get(relacionada.id)
                  return (
                    <button
                      key={relacionada.id}
                      type="button"
                      disabled={!viva}
                      onClick={() => setActualId(relacionada.id)}
                      className="flex min-h-11 items-center rounded-md px-1.5 text-left text-[13.5px] text-noct-text hover:bg-noct-text/[.06] disabled:text-noct-neutral-500 disabled:hover:bg-transparent"
                    >
                      <span className="min-w-0 flex-1">
                        {viva?.titulo || relacionada.titulo}
                        {!viva && (
                          <span className="text-[12px] text-noct-neutral-600"> (no disponible)</span>
                        )}
                      </span>
                    </button>
                  )
                })}
              </div>
            </Bloque>
          )}

          {referencia.advertencia && (
            <p className="rounded-r-lg border-l-2 border-noct-precaucion bg-noct-precaucion/10 px-3 py-2.5 text-[13px] leading-normal">
              <span className="font-semibold text-noct-precaucion">Precaución.</span>{' '}
              {referencia.advertencia}
            </p>
          )}
        </div>
      )}
    </Modal>
  )
}

function Bloque({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-medium uppercase tracking-[.08em] text-noct-neutral-500">{titulo}</p>
      {children}
    </div>
  )
}

// Mapa id -> título vivo, para resolver la copia guardada de la ficha
// de origen mientras se lee una relacionada.
function mapaTitulos(referencias: Map<string, Referencia>): Map<string, string> {
  const mapa = new Map<string, string>()
  for (const [id, referencia] of referencias) mapa.set(id, referencia.titulo)
  return mapa
}
