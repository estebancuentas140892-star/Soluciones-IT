import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState, type ReactNode } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { Chasis } from '../../app/Chasis'
import { DialogoEliminar } from '../../components/DialogoEliminar'
import { FilaDato } from '../../components/FilaDato'
import {
  BookBookmark,
  BookOpen,
  CaretRight,
  Keyboard,
  LockSimple,
  PencilSimple,
  TerminalWindow,
  TrashSimple,
  Warning,
} from '../../components/iconos'
import { BTN_GHOST_PELIGRO, BTN_SECUNDARIO, TagNeutral, TituloSeccion } from '../../components/nocturne'
import { db, type Referencia } from '../../lib/db'
import { eliminarRegistro } from '../../lib/repositorio'
import { nombreVivo, mapaDeTextos } from '../../lib/referencia'
import { Historial } from '../historial/Historial'
import { guiasQueUsan, INFO_TIPO } from './referencias'

// FICHA DE UNA ENTRADA DE REFERENCIA.
//
// Un termino y un comando enseñan cosas distintas, asi que la ficha se
// bifurca en dos cuerpos en vez de pintar un formulario generico con
// media docena de filas vacias. Y NADA VACIO SE DIBUJA: un termino sin
// ejemplo no muestra el rotulo "Ejemplo", igual que la ficha de un
// equipo no muestra una IP que nadie escribio.
export function ReferenciaFicha() {
  const { referenciaId = '' } = useParams()
  const navigate = useNavigate()
  const [mostrarEliminar, setMostrarEliminar] = useState(false)

  const referencia = useLiveQuery(() => db.referencias.get(referenciaId), [referenciaId])
  const articulos = useLiveQuery(() => db.articulos.toArray(), [], [])
  const referencias = useLiveQuery(() => db.referencias.toArray(), [], [])

  const usos = useMemo(() => guiasQueUsan(referenciaId, articulos), [referenciaId, articulos])
  // Las relacionadas se resuelven EN VIVO contra la fila actual (regla
  // de referencia viva, src/lib/referencia.ts): renombrar un termino
  // actualiza su nombre en todas las fichas que lo mencionan, y la
  // copia guardada solo entra en juego si la fila ya no esta.
  const nombres = useMemo(() => mapaDeTextos(referencias, (r) => r.titulo), [referencias])

  if (referencia === null) return <Navigate to="/referencia" replace />
  if (!referencia) {
    return (
      <div className="nocturne min-h-svh bg-noct-bg font-inter text-noct-text">
        <p className="px-4 pt-6 text-sm text-noct-neutral-400">Cargando...</p>
      </div>
    )
  }

  async function eliminar() {
    await eliminarRegistro('referencias', referenciaId)
    navigate('/referencia')
  }

  const info = INFO_TIPO[referencia.tipo]
  const esTermino = referencia.tipo === 'termino'
  const Icono = esTermino ? BookBookmark : referencia.tipo === 'atajo' ? Keyboard : TerminalWindow
  const advertenciaBorrado =
    usos.length > 0
      ? `${usos.length === 1 ? 'Una guía la usa' : `${usos.length} guías la usan`}. Sus bloques se conservarán, pero mostrarán que la referencia ya no está disponible.`
      : null

  return (
    <Chasis
      modo="documento"
      volverA={`/referencia${esTermino ? '' : '?tab=comandos'}`}
      volverEtiqueta="Referencia"
      titulo={referencia.titulo}
      contexto={esTermino ? 'Glosario' : 'Atajos y comandos'}
      barra={
        <div className="px-4 pb-3 pt-0.5">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.08em] text-noct-accent-300">
            <Icono size={14} className="shrink-0" aria-hidden />
            {info.etiqueta}
          </p>
          <p className="m-0 mt-0.5 text-pretty text-[19px] font-medium leading-[1.25]">
            {referencia.titulo}
          </p>
        </div>
      }
    >
      <main className="@container flex flex-1 flex-col gap-[22px] px-4 pb-12 pt-3.5">
        <div className="flex flex-wrap gap-2">
          <Link to={`/referencia/${referenciaId}/editar`} className={`shrink-0 ${BTN_SECUNDARIO}`}>
            <PencilSimple size={14} aria-hidden />
            Editar
          </Link>
          <button type="button" onClick={() => setMostrarEliminar(true)} className={BTN_GHOST_PELIGRO}>
            <TrashSimple size={14} aria-hidden />
            Eliminar
          </button>
        </div>

        {esTermino ? (
          <CuerpoTermino referencia={referencia} />
        ) : (
          <CuerpoComando referencia={referencia} />
        )}

        {(referencia.relacionadas ?? []).length > 0 && (
          <section>
            <TituloSeccion className="mb-1.5">
              {esTermino ? 'Términos relacionados' : 'Referencias relacionadas'}
            </TituloSeccion>
            <div className="flex flex-col">
              {referencia.relacionadas.map((relacionada) => (
                <Link
                  key={relacionada.id}
                  to={`/referencia/${relacionada.id}`}
                  className="flex min-h-[46px] items-center gap-2.5 rounded-md px-1.5 py-2 text-noct-text transition-colors hover:bg-noct-text/[.05]"
                >
                  <span className="min-w-0 flex-1 text-[13.5px]">
                    {nombreVivo(nombres, relacionada.id, relacionada.titulo)}
                  </span>
                  <CaretRight size={13} className="shrink-0 text-noct-neutral-600" aria-hidden />
                </Link>
              ))}
            </div>
          </section>
        )}

        {(referencia.etiquetas ?? []).length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {referencia.etiquetas.map((etiqueta) => (
              <TagNeutral key={etiqueta}>{etiqueta}</TagNeutral>
            ))}
          </div>
        )}

        {/* Dónde se usa: el inverso del vínculo, derivado de los bloques
            de cada guía en vez de guardarse aquí (dos copias de la misma
            verdad se desincronizan). Sin usos, la sección no existe. */}
        {usos.length > 0 && (
          <section>
            <TituloSeccion className="mb-1.5">Guías donde se utiliza</TituloSeccion>
            <div className="flex flex-col">
              {usos.map((uso) => (
                <Link
                  key={uso.articuloId}
                  to={`/soluciones/${uso.categoriaId}/${uso.articuloId}`}
                  className="flex min-h-[46px] items-center gap-2.5 rounded-md px-1.5 py-2 text-noct-text transition-colors hover:bg-noct-text/[.05]"
                >
                  <BookOpen size={16} className="shrink-0 text-noct-neutral-500" aria-hidden />
                  <span className="min-w-0 flex-1 text-[13.5px]">{uso.titulo}</span>
                  {uso.veces > 1 && (
                    <span className="shrink-0 text-[12px] text-noct-neutral-500">
                      {uso.veces} tareas
                    </span>
                  )}
                  <CaretRight size={13} className="shrink-0 text-noct-neutral-600" aria-hidden />
                </Link>
              ))}
            </div>
          </section>
        )}

        <Historial entidadTipo="referencia" entidadId={referenciaId} />
      </main>

      <DialogoEliminar
        abierto={mostrarEliminar}
        titulo={`¿Eliminar "${referencia.titulo}"?`}
        descripcion="Dejará de aparecer en Referencia y en el buscador."
        advertencia={advertenciaBorrado}
        onCerrar={() => setMostrarEliminar(false)}
        onConfirmar={eliminar}
      />
    </Chasis>
  )
}

function CuerpoTermino({ referencia }: { referencia: Referencia }) {
  return (
    <>
      {referencia.definicion && (
        <Seccion titulo="Definición">
          <p className="text-pretty text-sm leading-[1.55]">{referencia.definicion}</p>
        </Seccion>
      )}

      {referencia.ejemplo && (
        <Seccion titulo="Ejemplo">
          <p className="text-pretty rounded-lg bg-noct-surface p-3.5 text-[13.5px] leading-[1.55] text-noct-neutral-200">
            {referencia.ejemplo}
          </p>
        </Seccion>
      )}

      {(referencia.abreviatura || (referencia.alias ?? []).length > 0 || referencia.categoria) && (
        <Seccion titulo="Cómo se nombra">
          <dl className="flex flex-col divide-y divide-noct-divider">
            {referencia.abreviatura && (
              <FilaDato etiqueta="Abreviatura" valor={referencia.abreviatura} />
            )}
            {(referencia.alias ?? []).length > 0 && (
              <FilaDato etiqueta="También se llama" valor={referencia.alias.join(', ')} />
            )}
            {referencia.categoria && <FilaDato etiqueta="Categoría" valor={referencia.categoria} />}
          </dl>
        </Seccion>
      )}

      {referencia.advertencia && <Advertencia texto={referencia.advertencia} />}
    </>
  )
}

function CuerpoComando({ referencia }: { referencia: Referencia }) {
  const esAtajo = referencia.tipo === 'atajo'
  return (
    <>
      {referencia.valor && (
        <Seccion titulo={esAtajo ? 'Combinación de teclas' : 'Comando'}>
          <div className="rounded-lg border border-noct-divider bg-noct-surface px-3">
            {/* Un atajo NO lleva botón de copiar: no se pega en ningún
                sitio, se teclea. Un comando sí, que es justo lo que se
                viene a hacer con él. */}
            <FilaDato
              etiqueta={esAtajo ? 'Teclas' : 'Comando completo'}
              valor={referencia.valor}
              tecnico
              copiable={esAtajo ? undefined : referencia.valor}
            />
          </div>
        </Seccion>
      )}

      <Seccion titulo="Dónde y para qué">
        <dl className="flex flex-col divide-y divide-noct-divider">
          <FilaDato etiqueta="Tipo" valor={INFO_TIPO[referencia.tipo].etiqueta} />
          {referencia.plataforma && (
            <FilaDato
              etiqueta={esAtajo ? 'Programa' : 'Plataforma'}
              valor={referencia.plataforma}
            />
          )}
          {referencia.cuandoUsar && (
            <FilaDato etiqueta={esAtajo ? 'Qué hace' : 'Cuándo usarlo'} valor={referencia.cuandoUsar} />
          )}
          {referencia.resultadoEsperado && (
            <FilaDato etiqueta="Resultado esperado" valor={referencia.resultadoEsperado} />
          )}
          {referencia.categoria && <FilaDato etiqueta="Categoría" valor={referencia.categoria} />}
        </dl>
      </Seccion>

      {/* Los permisos se dicen ANTES de que el técnico lo teclee y
          descubra que falla, no después. Solo cuando hacen falta: una
          fila "Permisos: no" es ruido. */}
      {referencia.requiereAdmin && (
        <div className="flex items-start gap-2.5 rounded-lg border border-noct-divider bg-noct-surface px-3 py-2.5">
          <LockSimple size={16} className="mt-px shrink-0 text-noct-neutral-300" aria-hidden />
          <p className="text-[13px] leading-normal">
            Necesita permisos de administrador. Sin ellos, el comando falla o no hace nada.
          </p>
        </div>
      )}

      {referencia.advertencia && <Advertencia texto={referencia.advertencia} />}

      {referencia.definicion && (
        <Seccion titulo="Notas">
          <p className="text-pretty text-sm leading-[1.55]">{referencia.definicion}</p>
        </Seccion>
      )}
    </>
  )
}

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section>
      <TituloSeccion className="mb-1.5">{titulo}</TituloSeccion>
      {children}
    </section>
  )
}

function Advertencia({ texto }: { texto: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-r-lg border-l-2 border-noct-precaucion bg-noct-precaucion/10 px-3 py-2.5">
      <Warning size={16} className="mt-px shrink-0 text-noct-precaucion" aria-hidden />
      <p className="min-w-0 text-pretty text-[13px] leading-normal">
        <span className="font-semibold text-noct-precaucion">Precaución.</span> {texto}
      </p>
    </div>
  )
}
