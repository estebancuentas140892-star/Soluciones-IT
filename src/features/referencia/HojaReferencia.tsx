import { useEffect, useState } from 'react'
import { Hoja } from '../../components/Hoja'
import { ArrowLeft, WarningCircle } from '../../components/iconos'
import type { Referencia } from '../../lib/db'
import { nombreVivo } from '../../lib/referencia'
import { ContenidoReferencia } from './ContenidoReferencia'
import { TarjetaComando } from './TarjetaComando'
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
  const volvioDeUnaRelacionada = actualId !== referenciaId

  return (
    <Hoja
      abierta={abierto}
      onCerrar={onCerrar}
      textoCerrar="Cerrar y volver a la tarea"
      rotulo={
        <>
          {volvioDeUnaRelacionada && (
            // 44 px de toque (T3) con margen negativo: no empuja el título.
            <button
              type="button"
              onClick={() => setActualId(referenciaId)}
              className="-my-1.5 -ml-1 mb-0 flex min-h-11 items-center gap-1.5 self-start rounded-md px-1 text-[12px] font-medium text-noct-neutral-400 hover:text-noct-text"
            >
              <ArrowLeft size={13} aria-hidden />
              Volver a «{nombreVivo(mapaTitulos(referencias), referenciaId, tituloRespaldo)}»
            </button>
          )}
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[.08em] text-noct-accent-300">
            <Icono size={13} aria-hidden />
            {tipo ? INFO_TIPO[tipo].etiqueta : 'Centro de consulta'}
          </p>
        </>
      }
      titulo={
        <>
          {referencia?.titulo || tituloRespaldo || 'Ficha'}
          {referencia?.abreviatura && <span className="text-noct-neutral-400"> ({referencia.abreviatura})</span>}
        </>
      }
    >

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
      ) : referencia.tipo === 'comando' || referencia.tipo === 'atajo' ? (
        // Un comando o un atajo se lee como en la guía y en la vista
        // rápida del buscador: su valor, copiar, qué hace o cuándo
        // usarlo, el resultado y los permisos (tarea 270, "¿Qué hace?").
        <TarjetaComando referencia={referencia} tituloRespaldo={tituloRespaldo} sinTitulo />
      ) : (
        // El cuerpo es compartido con la vista rápida del buscador en modo
        // consulta (2026-09-16): la misma ficha se lee igual en los dos.
        <ContenidoReferencia referencia={referencia} referencias={referencias} onAbrirRelacionada={setActualId} />
      )}
    </Hoja>
  )
}

// Mapa id -> título vivo, para resolver la copia guardada de la ficha
// de origen mientras se lee una relacionada.
function mapaTitulos(referencias: Map<string, Referencia>): Map<string, string> {
  const mapa = new Map<string, string>()
  for (const [id, referencia] of referencias) mapa.set(id, referencia.titulo)
  return mapa
}
