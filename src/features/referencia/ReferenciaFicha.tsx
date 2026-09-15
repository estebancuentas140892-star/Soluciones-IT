import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState, type ReactNode } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { Chasis } from '../../app/Chasis'
import { DialogoEliminar } from '../../components/DialogoEliminar'
import { FilaDato } from '../../components/FilaDato'
import { PastillaEstadoArticulo } from '../../components/PastillaEstado'
import {
  BookOpen,
  CaretRight,
  LockSimple,
  PencilSimple,
  TrashSimple,
  Warning,
} from '../../components/iconos'
import { BTN_GHOST_PELIGRO, BTN_SECUNDARIO, TagNeutral, TituloSeccion } from '../../components/nocturne'
import { db, type Referencia } from '../../lib/db'
import { conOrigen } from '../../lib/origenNavegacion'
import { nombreVivo, mapaDeTextos } from '../../lib/referencia'
import { eliminarRegistro } from '../../lib/repositorio'
import { Historial } from '../historial/Historial'
import { EstadoUso } from './EstadoUso'
import { ICONO_POR_TIPO, iconoDeReferencia } from './iconosReferencia'
import {
  esTipoConocido,
  guiasQueUsan,
  INFO_TIPO,
  resolverGuiasRelacionadas,
  rutaDeCatalogo,
} from './referencias'

// FICHA DE UNA ENTRADA DEL CENTRO DE CONSULTA.
//
// Cada tipo enseña cosas distintas, así que la ficha se bifurca en tres
// cuerpos en vez de pintar un formulario genérico con media docena de
// filas vacías. Y NADA VACÍO SE DIBUJA: un término sin ejemplo no
// muestra el rótulo "Ejemplo", igual que la ficha de un equipo no
// muestra una IP que nadie escribió.
//
// UNA HERRAMIENTA EXPLICA QUÉ ES; UNA GUÍA, CÓMO HACERLO (encargo del
// 2026-09-14). La ficha de TightVNC dice qué es y cómo se usa en
// Metroparques, y ENLAZA la guía "Conectar de forma remota a un POS":
// nunca copia sus pasos, que se desactualizarían en cuanto alguien
// editara la guía.
export function ReferenciaFicha() {
  const { referenciaId = '' } = useParams()
  const navigate = useNavigate()
  const [mostrarEliminar, setMostrarEliminar] = useState(false)

  // `?? null` distingue "no existe" (null) de "todavía cargando"
  // (undefined): `get` devuelve undefined en los dos casos.
  const referencia = useLiveQuery(
    async () => (await db.referencias.get(referenciaId)) ?? null,
    [referenciaId],
  )
  const articulos = useLiveQuery(() => db.articulos.toArray(), [], [])
  const referencias = useLiveQuery(() => db.referencias.toArray(), [], [])

  const usos = useMemo(() => guiasQueUsan(referenciaId, articulos), [referenciaId, articulos])
  const guias = useMemo(
    () => resolverGuiasRelacionadas(referencia?.guiasRelacionadas, articulos),
    [referencia, articulos],
  )
  // Las relacionadas se resuelven EN VIVO contra la fila actual (regla
  // de referencia viva, src/lib/referencia.ts): renombrar una ficha
  // actualiza su nombre en todas las que la mencionan, y la copia
  // guardada solo entra en juego si la fila ya no está.
  const nombres = useMemo(() => mapaDeTextos(referencias, (r) => r.titulo), [referencias])
  const tipos = useMemo(
    () => new Map(referencias.filter((r) => !r.eliminadoEn).map((r) => [r.id, r.tipo])),
    [referencias],
  )

  if (referencia === null) return <Navigate to="/referencia" replace />
  if (!referencia) {
    return (
      <div className="nocturne min-h-svh bg-noct-bg font-inter text-noct-text">
        <p className="px-4 pt-6 text-sm text-noct-neutral-400">Cargando...</p>
      </div>
    )
  }

  const tipo = esTipoConocido(referencia.tipo) ? referencia.tipo : null
  if (!tipo) {
    // La escribió una versión más nueva de la app: se dice en vez de
    // romper la pantalla con un tipo que esta no sabe dibujar.
    return (
      <Chasis modo="documento" volverA="/referencia" volverEtiqueta="Centro de consulta">
        <p className="px-4 pt-6 text-pretty text-sm leading-[1.55] text-noct-neutral-300">
          Esta ficha es de un tipo que esta versión de la aplicación todavía no conoce. Actualiza la
          aplicación para verla.
        </p>
      </Chasis>
    )
  }

  async function eliminar() {
    await eliminarRegistro('referencias', referenciaId)
    navigate(rutaDeCatalogo(tipo ?? 'herramienta'))
  }

  const info = INFO_TIPO[tipo]
  const Icono = ICONO_POR_TIPO[tipo]
  const esHerramienta = tipo === 'herramienta'
  // Las guías que se abren desde aquí vuelven a esta ficha, no a su
  // lista (regla M-R2: volver deshace el último salto).
  const origenFicha = conOrigen(`/referencia/${referenciaId}`, referencia.titulo)
  // Una guía enlazada a mano ya sale en "Guías relacionadas": no se
  // repite debajo como "donde se utiliza".
  const idsDeGuias = new Set(guias.map((guia) => guia.id))
  const usosSinRepetir = usos.filter((uso) => !idsDeGuias.has(uso.articuloId))
  const advertenciaBorrado =
    usos.length > 0
      ? `${usos.length === 1 ? 'Una guía la usa' : `${usos.length} guías la usan`}. Sus bloques se conservarán, pero mostrarán que la ficha ya no está disponible.`
      : null

  return (
    <Chasis
      modo="documento"
      volverA={rutaDeCatalogo(tipo)}
      volverEtiqueta="Centro de consulta"
      titulo={referencia.titulo}
      contexto={info.pestana}
      barra={
        <div className="px-4 pb-3 pt-0.5">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-semibold uppercase tracking-[.08em] text-noct-accent-300">
            <Icono size={14} className="shrink-0" aria-hidden />
            {info.etiqueta}
            {esHerramienta && referencia.categoria && (
              <span className="font-medium text-noct-neutral-400">· {referencia.categoria}</span>
            )}
          </p>
          <p className="m-0 mt-0.5 text-pretty text-[19px] font-medium leading-[1.25]">
            {referencia.titulo}
            {esHerramienta && referencia.abreviatura && (
              <span className="font-normal text-noct-neutral-400"> ({referencia.abreviatura})</span>
            )}
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

        {tipo === 'herramienta' ? (
          <CuerpoHerramienta referencia={referencia} />
        ) : tipo === 'termino' ? (
          <CuerpoTermino referencia={referencia} />
        ) : (
          <CuerpoComando referencia={referencia} />
        )}

        {/* CÓMO HACERLO: las guías, enlazadas y nunca copiadas. Un
            borrador se lista con su pastilla (enlazar lo que se está
            escribiendo es útil), y una guía que no está en este
            dispositivo conserva su nombre sin enlace. */}
        {guias.length > 0 && (
          <section>
            <TituloSeccion className="mb-0.5">Guías relacionadas</TituloSeccion>
            <p className="mb-1.5 text-[12px] leading-snug text-noct-neutral-500">
              Cómo hacerlo, paso a paso. Esta ficha solo explica qué es.
            </p>
            <div className="flex flex-col">
              {guias.map((guia) =>
                guia.ruta ? (
                  <Link
                    key={guia.id}
                    to={guia.ruta}
                    state={origenFicha}
                    className="flex min-h-[46px] items-center gap-2.5 rounded-md px-1.5 py-2 text-noct-text transition-colors hover:bg-noct-text/[.05]"
                  >
                    <BookOpen size={16} className="shrink-0 text-noct-accent-300" aria-hidden />
                    <span className="min-w-0 flex-1 text-pretty text-[13.5px]">{guia.titulo}</span>
                    {guia.estado && <PastillaEstadoArticulo estado={guia.estado} />}
                    <CaretRight size={13} className="shrink-0 text-noct-neutral-600" aria-hidden />
                  </Link>
                ) : (
                  <div
                    key={guia.id}
                    className="flex min-h-[46px] items-center gap-2.5 px-1.5 py-2 text-noct-neutral-500"
                  >
                    <BookOpen size={16} className="shrink-0" aria-hidden />
                    <span className="min-w-0 flex-1 text-pretty text-[13.5px]">{guia.titulo}</span>
                    <span className="shrink-0 text-[12px]">No disponible aquí</span>
                  </div>
                ),
              )}
            </div>
          </section>
        )}

        {(referencia.relacionadas ?? []).length > 0 && (
          <section>
            <TituloSeccion className="mb-1.5">Relacionado</TituloSeccion>
            <div className="flex flex-col">
              {referencia.relacionadas.map((relacionada) => {
                const tipoRelacionada = tipos.get(relacionada.id)
                const conocido = esTipoConocido(tipoRelacionada) ? tipoRelacionada : null
                const IconoRelacionada = iconoDeReferencia(conocido)
                return (
                  <Link
                    key={relacionada.id}
                    to={`/referencia/${relacionada.id}`}
                    className="flex min-h-[46px] items-center gap-2.5 rounded-md px-1.5 py-2 text-noct-text transition-colors hover:bg-noct-text/[.05]"
                  >
                    <IconoRelacionada size={16} className="shrink-0 text-noct-neutral-500" aria-hidden />
                    <span className="min-w-0 flex-1 text-[13.5px]">
                      {nombreVivo(nombres, relacionada.id, relacionada.titulo)}
                    </span>
                    {conocido && (
                      <span className="shrink-0 text-[12px] text-noct-neutral-500">
                        {INFO_TIPO[conocido].etiqueta}
                      </span>
                    )}
                    <CaretRight size={13} className="shrink-0 text-noct-neutral-600" aria-hidden />
                  </Link>
                )
              })}
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
        {usosSinRepetir.length > 0 && (
          <section>
            <TituloSeccion className="mb-1.5">Guías donde se utiliza</TituloSeccion>
            <div className="flex flex-col">
              {usosSinRepetir.map((uso) => (
                <Link
                  key={uso.articuloId}
                  to={`/soluciones/${uso.categoriaId}/${uso.articuloId}`}
                  state={origenFicha}
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
        descripcion="Dejará de aparecer en el Centro de consulta y en el buscador."
        advertencia={advertenciaBorrado}
        onCerrar={() => setMostrarEliminar(false)}
        onConfirmar={eliminar}
      />
    </Chasis>
  )
}

// UNA HERRAMIENTA, EN EL ORDEN EN QUE SE LEE: qué es (la descripción, sin
// rótulo porque es lo primero), para qué sirve, cómo se usa en
// Metroparques y con qué seguridad se sabe, quién la hace y las notas.
// Solo lo que existe: una ficha de Kaspersky con descripción y categoría
// es una ficha de tres líneas, no un formulario a medio llenar.
function CuerpoHerramienta({ referencia }: { referencia: Referencia }) {
  const alias = referencia.alias ?? []
  const hayDatos = Boolean(referencia.proveedor || referencia.categoria || alias.length > 0)
  return (
    <>
      {referencia.definicion && (
        <p className="text-pretty text-[15px] leading-[1.55]">{referencia.definicion}</p>
      )}

      {referencia.cuandoUsar && (
        <Seccion titulo="¿Para qué sirve?">
          <p className="text-pretty text-sm leading-[1.55]">{referencia.cuandoUsar}</p>
        </Seccion>
      )}

      {(referencia.usoEnMetroparques || referencia.estadoUso) && (
        <Seccion titulo="En Metroparques">
          <div className="flex flex-col gap-2">
            {referencia.usoEnMetroparques && (
              <p className="text-pretty text-sm leading-[1.55]">{referencia.usoEnMetroparques}</p>
            )}
            <EstadoUso estado={referencia.estadoUso} />
          </div>
        </Seccion>
      )}

      {hayDatos && (
        <dl className="flex flex-col divide-y divide-noct-divider">
          {referencia.proveedor && <FilaDato etiqueta="Proveedor" valor={referencia.proveedor} />}
          {referencia.categoria && <FilaDato etiqueta="Categoría" valor={referencia.categoria} />}
          {alias.length > 0 && <FilaDato etiqueta="También se llama" valor={alias.join(', ')} />}
        </dl>
      )}

      {referencia.notas && (
        <Seccion titulo="Notas">
          <p className="text-pretty text-sm leading-[1.55]">{referencia.notas}</p>
        </Seccion>
      )}

      {referencia.advertencia && <Advertencia texto={referencia.advertencia} />}
    </>
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
            {/* Los dos se copian (encargo del 2026-09-14): un comando
                para pegarlo en la consola, y una combinación para
                pasársela escrita a quien está frente al equipo. */}
            <FilaDato
              etiqueta={esAtajo ? 'Teclas' : 'Comando completo'}
              valor={referencia.valor}
              tecnico
              copiable={referencia.valor}
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
            <FilaDato etiqueta={esAtajo ? 'Cuándo sirve' : 'Cuándo usarlo'} valor={referencia.cuandoUsar} />
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
