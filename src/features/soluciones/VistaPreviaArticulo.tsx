import { useEffect, useRef, useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { DispositivoAfectado, Procedimiento, TipoArticulo } from '../../lib/db'
import { claveVistaPrevia, limpiarProgresoVistaPrevia, reiniciarProgreso } from '../../lib/progresoPasos'
import { procedimientoEjecutable } from '../../lib/procedimiento'
import { useUrlAdjunto } from '../../components/useUrlAdjunto'
import { ArrowLeft, Play } from '../../components/iconos'
import { ImagenAmpliable } from '../../components/VisorImagen'
import { TagNeutral } from '../../components/nocturne'
import { ProveedorEjecucion } from './ProveedorEjecucion'
import { ProcedimientoVista } from './ProcedimientoVista'
import { IntroduccionGuia, ListaIntro, ResumenGuia, SeccionIntro } from './IntroduccionGuia'
import { etiquetaDeTipo } from './tiposArticulo'

interface Props {
  // Id del articulo en edicion. La vista previa NO ejecuta sobre el:
  // estrena una raiz efimera por sesion, de modo que ni las casillas
  // que se marquen aqui ni el avance de las guias vinculadas que se
  // abran dentro tocan el progreso real de ninguna guia.
  articuloId: string
  titulo: string
  tipo: TipoArticulo
  etiquetas: string[]
  procedimiento: Procedimiento | null
  contenido: string
  // Lo que la ficha muestra de una incidencia, para que la prueba
  // enseñe la MISMA presentacion inicial que vera el tecnico (encargo
  // del 2026-09-10, tarea 2). Llegan ya en lineas desde el editor.
  sintomas?: string[]
  causas?: string[]
  dispositivosAfectados?: DispositivoAfectado[]
  // Paso que "Probar" quiere enseñar (tablero 6b): la vista previa
  // entra abierta en ese paso y lo trae a la vista, en vez de empezar
  // por la portada del articulo. null = vista previa normal.
  pasoDestacadoId?: string | null
  onCerrar: () => void
}

// Vista previa del articulo ANTES de guardarlo (fase S1): muestra
// exactamente lo que vera el tecnico (portada, descripcion,
// procedimiento interactivo y notas en Markdown) con los datos en
// memoria del formulario. No guarda nada; el unico rastro (el
// progreso efimero de las casillas de prueba) se borra al cerrar.
// Se carga en diferido desde el formulario para no sumar el peso de
// react-markdown a la apertura del editor.
//
// LA PRESENTACION Y LA EJECUCION TAMBIEN SE SEPARAN AQUI (encargo del
// 2026-09-10, tarea 2). La prueba montaba el procedimiento entero
// debajo de la descripcion, que es justo lo que la ficha real dejo de
// hacer: si la prueba no separa lo mismo, el autor no ve lo que vera el
// tecnico. Ahora se entra por la presentacion y "Empecemos" abre el
// procedimiento. "Probar" desde un paso del editor sigue entrando
// directo a ese paso: ahi lo que se pide ver es el paso, no la ficha.
export function VistaPreviaArticulo({
  articuloId,
  titulo,
  tipo,
  etiquetas,
  procedimiento,
  contenido,
  sintomas = [],
  causas = [],
  dispositivosAfectados = [],
  pasoDestacadoId = null,
  onCerrar,
}: Props) {
  // UNA RAIZ POR SESION DE PRUEBA (tarea 6 del encargo). Antes la raiz
  // era `vista-previa:<id>`, fija: cerrar y volver a abrir "Probar"
  // reencontraba lo marcado en la prueba anterior, con sus guias
  // vinculadas ya dadas por hechas. Se calcula una sola vez por montaje.
  const [idEfimero] = useState(() => claveVistaPrevia(articuloId))
  const urlPortada = useUrlAdjunto(procedimiento?.portada?.referencia ?? null)
  // "Probar" un paso concreto entra directo a la ejecución: lo que el
  // autor acaba de pedir ver es ese paso, no la ficha.
  const [enEjecucion, setEnEjecucion] = useState(pasoDestacadoId !== null)
  const hayPasos = procedimientoEjecutable(procedimiento)

  // LA PRUEBA NO SE BORRA A SI MISMA A MITAD DE SESION.
  //
  // El efecto que limpiaba el progreso llevaba `onCerrar` en sus
  // dependencias, y ese `onCerrar` nacia de nuevo en cada render del
  // formulario: cualquier tecla escrita en el editor cambiaba la
  // referencia, React ejecutaba la limpieza y la prueba en curso perdia
  // su avance (3/4 -> 0/4 al terminar una guia vinculada). Ademas
  // limpiaba TODAS las raices de prueba, no la suya.
  //
  // Se separa en dos efectos con dependencias distintas: el del teclado
  // y el scroll puede volver a montarse sin consecuencias, y el del
  // progreso depende SOLO de `idEfimero`, que no cambia mientras la
  // vista previa este montada. `onCerrar` se lee por referencia, asi
  // que el teclado siempre llama a la ultima version sin reengancharse.
  const cerrarRef = useRef(onCerrar)
  useEffect(() => {
    cerrarRef.current = onCerrar
  }, [onCerrar])

  useEffect(() => {
    function alTeclado(evento: KeyboardEvent) {
      if (evento.key === 'Escape') cerrarRef.current()
    }
    document.addEventListener('keydown', alTeclado)
    const overflowPrevio = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', alTeclado)
      document.body.style.overflow = overflowPrevio
    }
  }, [])

  useEffect(() => {
    // Al abrir se barre lo que dejaron pruebas anteriores que no se
    // cerraron con el boton (un recargo a media prueba), conservando
    // esta sesion.
    void limpiarProgresoVistaPrevia(idEfimero)
    return () => {
      // Al cerrar se borra SOLO esta raiz, que se lleva consigo el
      // avance de las guias vinculadas abiertas dentro. Otras pruebas
      // que pudieran estar abiertas no se tocan.
      void reiniciarProgreso(idEfimero)
    }
  }, [idEfimero])

  return (
    <div className="nocturne fixed inset-0 z-[70] overflow-y-auto bg-noct-bg font-inter text-noct-text">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-noct-divider bg-noct-bg/[.92] px-4 py-3 backdrop-blur-[12px]">
        <p className="text-sm font-medium text-noct-text">
          {pasoDestacadoId ? 'Como lo ve el técnico' : 'Vista previa'}
          <span className="ml-2 rounded-full border border-noct-precaucion/50 bg-noct-precaucion/[.14] px-2 py-0.5 text-[10px] text-noct-precaucion">
            Sin guardar
          </span>
        </p>
        <button
          type="button"
          onClick={onCerrar}
          className="rounded-lg border border-noct-divider px-3 py-1.5 text-xs text-noct-text hover:bg-noct-text/[.07]"
        >
          Cerrar
        </button>
      </div>

      <div className="mx-auto flex max-w-2xl flex-col gap-5 px-4 pt-5 pb-10">
        {enEjecucion ? (
          <>
            {/* La salida de la ejecución de prueba: en la app real el
                técnico sale con la X del modo ejecución, aquí vuelve a
                la ficha sin cerrar la prueba ni perder lo marcado. */}
            <button
              type="button"
              onClick={() => setEnEjecucion(false)}
              className="inline-flex min-h-11 w-fit items-center gap-2 rounded-lg border border-noct-divider px-3 text-[13px] font-medium text-noct-neutral-300 hover:bg-noct-text/[.07]"
            >
              <ArrowLeft size={15} className="shrink-0" aria-hidden />
              Volver a la presentación
            </button>
            <h1 className="text-xl font-semibold">{titulo || '(Sin título)'}</h1>
            {procedimiento && (
              // Raiz efimera: lo que se marque aqui, incluido el avance
              // de las guias vinculadas, vive dentro de esta fila de
              // prueba y se borra al cerrar.
              <ProveedorEjecucion raizId={idEfimero}>
                <ProcedimientoVista
                  articuloId={idEfimero}
                  procedimiento={procedimiento}
                  pasoDestacadoId={pasoDestacadoId}
                />
              </ProveedorEjecucion>
            )}
          </>
        ) : (
          <>
            {urlPortada && (
              <ImagenAmpliable
                url={urlPortada}
                alt={`Portada: ${titulo}`}
                claseBoton="rounded-xl border border-noct-divider"
                className="max-h-44 w-full object-cover"
              />
            )}

            <div>
              <h1 className="text-xl font-semibold">{titulo || '(Sin título)'}</h1>
              <p className="text-xs text-noct-neutral-500">{etiquetaDeTipo(tipo)}</p>
              {etiquetas.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {etiquetas.map((etiqueta) => (
                    <li key={etiqueta}>
                      <TagNeutral>{etiqueta}</TagNeutral>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {procedimiento?.descripcion && (
              <p className="rounded-xl border border-noct-divider bg-noct-surface px-4 py-3 text-sm text-noct-neutral-200">
                {procedimiento.descripcion}
              </p>
            )}

            {procedimiento && (
              <ResumenGuia
                tiempoMin={procedimiento.tiempoEstimadoMin}
                dificultad={procedimiento.dificultad}
                totalPasos={procedimiento.pasos.length}
              />
            )}

            <ListaIntro titulo="Síntomas" items={sintomas} />
            <ListaIntro titulo="Posibles causas" items={causas} />
            {dispositivosAfectados.length > 0 && (
              <SeccionIntro titulo="Equipos afectados">
                <div className="flex flex-wrap gap-1.5">
                  {/* Sin enlace: durante la prueba no se sale del
                      editor (mismo criterio que los vínculos inertes). */}
                  {dispositivosAfectados.map((dispositivo) => (
                    <span
                      key={dispositivo.id}
                      className="inline-flex items-center rounded-md border border-noct-accent/30 bg-noct-accent/10 px-2.5 py-1 text-xs font-medium text-noct-accent-300"
                    >
                      {dispositivo.nombre}
                    </span>
                  ))}
                </div>
              </SeccionIntro>
            )}

            {procedimiento && <IntroduccionGuia procedimiento={procedimiento} />}

            {contenido.trim() !== '' && (
              <article className="prose prose-invert prose-sm max-w-none prose-headings:font-medium prose-headings:text-noct-text prose-p:text-noct-neutral-200 prose-li:text-noct-neutral-200 prose-strong:text-noct-text prose-a:text-noct-accent-400">
                <Markdown remarkPlugins={[remarkGfm]}>{contenido}</Markdown>
              </article>
            )}

            {/* La acción dominante, detrás de la información
                introductoria: es la misma puerta que la barra inferior
                de la ficha real. */}
            {hayPasos && (
              <button
                type="button"
                onClick={() => setEnEjecucion(true)}
                className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl border border-noct-accent bg-noct-accent/[.12] px-4 text-[15px] font-semibold text-noct-accent-300 hover:bg-noct-accent/[.18]"
              >
                <Play size={17} className="shrink-0" aria-hidden />
                Empecemos
              </button>
            )}

            {!procedimiento && contenido.trim() === '' && (
              <p className="rounded-xl border border-dashed border-noct-divider px-4 py-6 text-center text-sm text-noct-neutral-500">
                Todavía no hay contenido para previsualizar.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
