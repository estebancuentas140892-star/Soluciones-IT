import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { db, type Conexion, type Dispositivo } from '../../lib/db'
import { Chasis } from '../../app/Chasis'
import { eliminarRegistro } from '../../lib/repositorio'
import { agruparConexiones, type ExtremoConexion } from '../../lib/conexiones'
import { mapaDeTextos, nombreVivo } from '../../lib/referencia'
import { CaretRight, CaretDown, Monitor, Plus, TreeStructure, Warning, X } from '../../components/iconos'
import { VALOR_TECNICO_COMPACTO } from '../../components/FilaDato'
import { conOrigen, type EstadoConOrigen } from '../../lib/origenNavegacion'
import { BTN_GHOST, BTN_SECUNDARIO, TituloSeccion } from '../../components/nocturne'
import { IconoNodo } from './IconoNodo'
import { FormularioConexion } from './FormularioConexion'
import { construirArbol, contarDescendientes, contarImpacto, infoDeDispositivos, type NodoTopologia } from './arbol'
import { claseEstado, detalleDeNodo, estadoConEtiqueta, tipoDeNodoVisual } from './topologiaVisual'

// Topología de un equipo re-autorizada en el sistema Nocturne (handoff
// "Rediseño de aplicación empresarial", Topología de Equipo.dc.html).
// Es la vista de topología centrada en UN dispositivo (ruta
// /red/topologia/:dispositivoId): antes solo mostraba un árbol pelado
// en tema claro; ahora es una pantalla rica que responde de un vistazo
// "¿de qué depende?", "¿qué se cae si falla?" y "¿qué depende de él?",
// más el editor de conexiones. La lógica y los datos son los mismos que
// ya usan la ficha y el mapa de red: árbol de topología (arbol.ts),
// agrupación de conexiones (conexiones.ts) y el guardado real
// (repositorio.ts); esta pantalla solo compone esas piezas con el
// aspecto del mockup. El bosque general (/red/topologia, sin equipo)
// sigue en TopologiaPage hasta su propia re-autoría (tarea 92).
//
// El formulario de "Agregar conexión" es el mismo componente compartido
// que usa ConexionesFicha (hallazgo D1 de AUDITORIA_FLUJOS_TI.md: antes
// eran dos implementaciones casi idénticas ya divergidas), ver
// FormularioConexion.tsx.

export function TopologiaEquipoPage() {
  const { dispositivoId = '' } = useParams()

  const dispositivos = useLiveQuery(() => db.dispositivos.filter((d) => !d.eliminadoEn).toArray(), [], [])
  const conexiones = useLiveQuery(() => db.conexiones.filter((c) => !c.eliminadoEn).toArray(), [], [])
  const categorias = useLiveQuery(() => db.categorias.toArray(), [], [])

  const equipo = (dispositivos ?? []).find((d) => d.id === dispositivoId)

  const nombreCategoria = useMemo(
    () => new Map((categorias ?? []).map((c) => [c.id, c.nombre])),
    [categorias],
  )
  const nombrePorId = useLiveQuery(
    async () => mapaDeTextos(await db.dispositivos.toArray(), (d) => d.nombre),
    [],
    new Map<string, string>(),
  )

  const infoPorId = useMemo(() => infoDeDispositivos(dispositivos ?? []), [dispositivos])

  // Árbol de dependientes con este equipo como raíz: sus hijos son los
  // equipos a los que da servicio (enlaces) o que contiene (rack).
  const arbol = useMemo(
    () => construirArbol(dispositivoId, conexiones ?? [], infoPorId),
    [dispositivoId, conexiones, infoPorId],
  )
  const impacto = useMemo(() => contarImpacto(arbol), [arbol])
  const totalDependientes = useMemo(() => contarDescendientes(arbol), [arbol])

  // Conexiones agrupadas de este equipo (mismas cuatro categorías que
  // la ficha). "Depende de" se arma de sus padres directos: donde está
  // instalado y los enlaces que RECIBE (no los que da).
  const grupos = useMemo(
    () => agruparConexiones(conexiones ?? [], dispositivoId),
    [conexiones, dispositivoId],
  )

  const dependeDe = useMemo(() => {
    const padres: { id: string; nombre: string; via: string }[] = []
    for (const e of grupos.instaladoEn) {
      padres.push({ id: e.otroId, nombre: nombreVivo(nombrePorId, e.otroId, e.otroNombre), via: 'Instalado' })
    }
    for (const e of grupos.enlaces) {
      if (e.esOrigen) continue // los que este equipo SIRVE son hijos, no padres
      const via = e.puertoRemoto ? `Puerto ${e.puertoRemoto}` : e.conexion.medio || 'Enlace'
      padres.push({
        id: e.otroId,
        nombre: nombreVivo(nombrePorId, e.otroId, e.otroNombre),
        via: [via, e.conexion.medio && e.conexion.medio !== via ? e.conexion.medio : '']
          .filter(Boolean)
          .join(' · '),
      })
    }
    return padres
  }, [grupos, nombrePorId])

  const chipsImpacto = useMemo(() => {
    return [...impacto.entries()]
      .map(([categoriaId, cantidad]) => {
        const categoria = nombreCategoria.get(categoriaId) ?? categoriaId
        return { categoriaId, cantidad, categoria, texto: `${cantidad} ${categoria}` }
      })
      .sort((a, b) => b.cantidad - a.cantidad)
  }, [impacto, nombreCategoria])

  const [agregando, setAgregando] = useState(false)

  if (!dispositivos || !conexiones) {
    return <Chasis modo="documento">{null}</Chasis>
  }

  if (!equipo) {
    return (
      <Chasis modo="documento">
        <main className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
          <TreeStructure size={30} className="text-noct-neutral-600" aria-hidden />
          <p className="text-[14.5px] font-medium">No se encontró el equipo</p>
          <Link to="/red/topologia" className={BTN_SECUNDARIO}>
            Volver a la topología
          </Link>
        </main>
      </Chasis>
    )
  }

  const estado = estadoConEtiqueta(equipo.estado)

  // Seguir una conexión rompía el hilo en cada salto: el equipo abierto
  // desde aquí volvía a la LISTA de Red, no a esta topología (hallazgo
  // M-020). Con el origen, el regreso deshace un salto (regla M-R2).
  const origenTopologia = conOrigen(`/red/topologia/${equipo.id}`, 'Topología')

  return (
    // Nivel 2 del chasis (tarea 185): documento. El chasis pone el
    // bloque pegajoso, el retorno a la topología y las pestañas; aquí
    // quedan el acceso a la ficha y la identidad del equipo (nombre,
    // estado con punto de color e IP).
    <Chasis
      modo="documento"
      acciones={
        <Link to={`/dispositivos/${equipo.id}`} state={origenTopologia} className={`shrink-0 ${BTN_GHOST}`}>
          <Monitor size={14} aria-hidden />
          Abrir la ficha
        </Link>
      }
      barra={
        <div className="flex items-center gap-3 px-4 pb-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-noct-accent/[.14] text-noct-accent-300">
            <TreeStructure size={20} aria-hidden />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-[18px] font-medium leading-[1.3]">{equipo.nombre}</h1>
            <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-noct-neutral-500">
              <span className={`inline-flex items-center gap-1.5 ${claseEstado(estado.etiqueta)}`}>
                <span className="h-[7px] w-[7px] rounded-full bg-current" />
                {estado.etiqueta}
              </span>
              {equipo.ip && (
                <>
                  <span className="text-noct-neutral-600">·</span>
                  {/* Piso del dato técnico (M-R5): la IP no baja de 13 px
                      ni de neutral-300. */}
                  <span className={VALOR_TECNICO_COMPACTO}>{equipo.ip}</span>
                </>
              )}
            </p>
          </div>
        </div>
      }
    >
      <main className="flex flex-1 flex-col gap-[22px] px-4 pb-16 pt-4">
        {/* Depende de: padres directos, navegables a su ficha. */}
        {dependeDe.length > 0 && (
          <section>
            <TituloSeccion className="mb-2">Depende de</TituloSeccion>
            <div className="flex flex-col">
              {dependeDe.map((p) => (
                <Link
                  key={`${p.id}-${p.via}`}
                  to={`/dispositivos/${p.id}`}
                  state={origenTopologia}
                  className="flex min-h-12 items-center gap-[11px] rounded-md px-1.5 py-2 text-noct-text hover:bg-noct-text/[.05]"
                >
                  <FlechaCodoArriba className="w-6 shrink-0 text-noct-neutral-500" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium leading-[1.3]">{p.nombre}</span>
                    <span className="mt-px block text-[11.5px] text-noct-neutral-500">{p.via}</span>
                  </span>
                  <CaretRight size={14} className="shrink-0 text-noct-neutral-600" aria-hidden />
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Si este equipo falla: impacto por categoría, resaltado en el
            tono de precaución. */}
        {chipsImpacto.length > 0 && (
          <section>
            <TituloSeccion className="mb-2">Si este equipo falla</TituloSeccion>
            <div className="rounded-lg border border-noct-precaucion/[.35] bg-noct-precaucion/[.08] px-3.5 py-3">
              <p className="flex items-center gap-1.5 text-[13px] leading-normal text-noct-neutral-300">
                <Warning size={14} className="shrink-0 text-noct-precaucion" aria-hidden />
                También quedarían sin servicio{' '}
                <strong className="font-medium">
                  {totalDependientes} {totalDependientes === 1 ? 'equipo' : 'equipos'}
                </strong>
                :
              </p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {chipsImpacto.map((chip) => (
                  <span
                    key={chip.categoriaId}
                    className="inline-flex min-h-7 items-center gap-1.5 rounded-full border border-noct-divider px-2.5 text-[12px] text-noct-neutral-300"
                  >
                    <IconoNodo
                      tipo={tipoDeNodoVisual(chip.categoria)}
                      className="h-[13px] w-[13px] text-noct-neutral-400"
                    />
                    {chip.texto}
                  </span>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Dependen de este equipo: árbol expandible de descendientes. */}
        {arbol.hijos.length > 0 && (
          <section>
            <div className="mb-2 flex items-center justify-between">
              <TituloSeccion>Dependen de este equipo</TituloSeccion>
              <span className="text-[11px] text-noct-neutral-600">
                {totalDependientes} {totalDependientes === 1 ? 'equipo depende' : 'equipos dependen'}
              </span>
            </div>
            <ArbolDependientes nodo={arbol} nombreCategoria={nombreCategoria} origen={origenTopologia} />
          </section>
        )}

        {/* Conexiones: lista agrupada editable + alta de conexión. */}
        <ConexionesSeccion
          equipo={equipo}
          grupos={grupos}
          nombrePorId={nombrePorId}
          agregando={agregando}
          onToggleAgregar={() => setAgregando((v) => !v)}
          origen={origenTopologia}
        />
      </main>
    </Chasis>
  )
}

// Árbol de descendientes: filas indentadas con caret para expandir o
// contraer, icono por tipo de equipo, detalle de cómo conecta con su
// padre y punto de estado. Todas las ramas arrancan abiertas; el
// técnico contrae lo que no necesita. Se clavea por camino (no por id)
// porque el mismo equipo puede aparecer en dos ramas.
function ArbolDependientes({
  nodo,
  nombreCategoria,
  origen,
}: {
  nodo: NodoTopologia
  nombreCategoria: Map<string, string>
  // Estado de navegación con el que salen los enlaces a una ficha, para
  // que su regreso vuelva a ESTA topología y no a la lista de Red
  // (tarea 202, hallazgo M-020, regla M-R2).
  origen: EstadoConOrigen
}) {
  const [contraidos, setContraidos] = useState<ReadonlySet<string>>(new Set())

  function alternar(clave: string) {
    setContraidos((previos) => {
      const siguientes = new Set(previos)
      if (siguientes.has(clave)) siguientes.delete(clave)
      else siguientes.add(clave)
      return siguientes
    })
  }

  return (
    <div className="flex flex-col">
      {nodo.hijos.map((hijo) => (
        <FilaArbol
          key={`${hijo.dispositivoId}·${hijo.via}`}
          nodo={hijo}
          nivel={0}
          clave={`${hijo.dispositivoId}·${hijo.via}`}
          contraidos={contraidos}
          alternar={alternar}
          nombreCategoria={nombreCategoria}
          origen={origen}
        />
      ))}
    </div>
  )
}

function FilaArbol({
  nodo,
  nivel,
  clave,
  contraidos,
  alternar,
  nombreCategoria,
  origen,
}: {
  nodo: NodoTopologia
  nivel: number
  clave: string
  contraidos: ReadonlySet<string>
  alternar: (clave: string) => void
  nombreCategoria: Map<string, string>
  origen: EstadoConOrigen
}) {
  const tieneHijos = nodo.hijos.length > 0
  const abierto = tieneHijos && !contraidos.has(clave)
  const categoria = nombreCategoria.get(nodo.categoriaId) ?? ''
  const detalle = detalleDeNodo({ via: nodo.via, medio: nodo.medio })
  const estado = estadoConEtiqueta(nodo.estado)

  return (
    <>
      <div
        className="flex min-h-[50px] items-center gap-2 rounded-md py-1.5 pr-1"
        style={{ paddingLeft: `${4 + nivel * 20}px` }}
      >
        {tieneHijos ? (
          <button
            type="button"
            onClick={() => alternar(clave)}
            aria-expanded={abierto}
            aria-label={`${abierto ? 'Contraer' : 'Expandir'} ${nodo.nombre}`}
            className="flex min-h-11 w-[34px] shrink-0 items-center justify-center rounded-md text-noct-neutral-400 hover:bg-noct-text/[.06] hover:text-noct-text"
          >
            {abierto ? <CaretDown size={15} aria-hidden /> : <CaretRight size={15} aria-hidden />}
          </button>
        ) : (
          <span className="flex w-[34px] shrink-0 justify-center" aria-hidden>
            <span className="h-[5px] w-[5px] rounded-full bg-noct-neutral-700" />
          </span>
        )}
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-noct-text/[.06] text-noct-neutral-400">
          <IconoNodo tipo={tipoDeNodoVisual(categoria)} className="h-4 w-4" />
        </span>
        <Link to={`/dispositivos/${nodo.dispositivoId}`} state={origen} className="min-w-0 flex-1 text-noct-text">
          <span className="block truncate text-[13.5px] font-medium leading-[1.3]">
            {nodo.nombre}
            {nodo.truncado && (
              <span className="ml-1 text-noct-precaucion" title="Ya aparece más arriba">
                ↺
              </span>
            )}
          </span>
          {detalle && <span className="mt-px block truncate text-[11.5px] text-noct-neutral-500">{detalle}</span>}
        </Link>
        <span
          title={estado.etiqueta}
          className={`h-[7px] w-[7px] shrink-0 rounded-full bg-current ${claseEstado(estado.etiqueta)}`}
        />
      </div>
      {abierto &&
        nodo.hijos.map((hijo) => (
          <FilaArbol
            key={`${clave}/${hijo.dispositivoId}·${hijo.via}`}
            nodo={hijo}
            nivel={nivel + 1}
            clave={`${clave}/${hijo.dispositivoId}·${hijo.via}`}
            contraidos={contraidos}
            alternar={alternar}
            nombreCategoria={nombreCategoria}
            origen={origen}
          />
        ))}
    </>
  )
}

function ConexionesSeccion({
  equipo,
  grupos,
  nombrePorId,
  agregando,
  onToggleAgregar,
  origen,
}: {
  equipo: Dispositivo
  grupos: ReturnType<typeof agruparConexiones>
  origen: EstadoConOrigen
  nombrePorId: Map<string, string>
  agregando: boolean
  onToggleAgregar: () => void
}) {
  const listas: { titulo: string; items: ExtremoConexion[] }[] = [
    { titulo: 'Instalado en', items: grupos.instaladoEn },
    { titulo: 'Contiene', items: grupos.contiene },
    { titulo: 'Enlaces', items: grupos.enlaces },
    { titulo: 'Relacionados', items: grupos.relacionados },
  ].filter((g) => g.items.length > 0)

  const total =
    grupos.instaladoEn.length + grupos.contiene.length + grupos.enlaces.length + grupos.relacionados.length

  async function quitar(conexion: Conexion) {
    await eliminarRegistro('conexiones', conexion.id)
  }

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <TituloSeccion>Conexiones</TituloSeccion>
        <button type="button" onClick={onToggleAgregar} className={BTN_GHOST}>
          <Plus size={13} aria-hidden />
          Agregar
        </button>
      </div>

      {agregando && (
        <FormularioConexion
          dispositivo={equipo}
          enlaces={grupos.enlaces}
          variante="topologia"
          onCerrar={onToggleAgregar}
        />
      )}

      {total === 0 && !agregando && (
        <p className="rounded-lg border border-dashed border-noct-neutral-700 px-4 py-4 text-center text-sm text-noct-neutral-500">
          Sin conexiones registradas
        </p>
      )}

      {listas.map((grupo) => (
        <div key={grupo.titulo} className="mb-2.5">
          <p className="mb-1 px-0.5 text-[12px] text-noct-neutral-500">{grupo.titulo}</p>
          <div className="flex flex-col gap-1.5">
            {grupo.items.map((extremo) => {
              const nombre = nombreVivo(nombrePorId, extremo.otroId, extremo.otroNombre)
              const detalle = [
                extremo.puertoLocal && `Puerto ${extremo.puertoLocal}`,
                extremo.puertoRemoto && `→ puerto ${extremo.puertoRemoto}`,
                extremo.conexion.medio,
              ]
                .filter(Boolean)
                .join(' · ')
              return (
                <div
                  key={extremo.conexion.id}
                  className="flex min-h-[50px] items-center gap-2.5 rounded-lg border border-noct-divider bg-noct-surface py-1.5 pl-3 pr-1.5"
                >
                  <Link to={`/dispositivos/${extremo.otroId}`} state={origen} className="min-w-0 flex-1 text-noct-text">
                    <span className="block truncate text-[13.5px] font-medium leading-[1.3]">{nombre}</span>
                    {(detalle || extremo.conexion.notas) && (
                      <span className="mt-px block truncate text-[11.5px] text-noct-neutral-500">
                        {detalle || extremo.conexion.notas}
                      </span>
                    )}
                  </Link>
                  <button
                    type="button"
                    onClick={() => void quitar(extremo.conexion)}
                    aria-label={`Quitar la conexión con ${nombre}`}
                    className="flex min-h-11 w-[38px] shrink-0 items-center justify-center rounded-md text-noct-neutral-600 hover:bg-noct-error/[.08] hover:text-noct-error"
                  >
                    <X size={15} aria-hidden />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </section>
  )
}

// Flecha de codo hacia arriba (ph-arrow-elbow-left-up del mockup):
// glifo local decorativo para la sección "Depende de", como los
// chevrons inline de TopologiaPage. No entra al set de iconos de
// dominio (regenerable) por ser exclusivo de esta pantalla.
function FlechaCodoArriba({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className} aria-hidden>
      <path d="M14 20H9a3 3 0 0 1-3-3V8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m3 11 3-4 3 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
