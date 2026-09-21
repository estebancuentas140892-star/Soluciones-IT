import { useLiveQuery } from 'dexie-react-hooks'
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../../lib/db'
import { Chasis } from '../../app/Chasis'
import { CampoBusqueda } from '../../components/CampoBusqueda'
import { MagnifyingGlass, Plus } from '../../components/iconos'
import { BTN_SECUNDARIO } from '../../components/nocturne'
import { buscar, useIndiceBusqueda } from '../busqueda/useIndiceBusqueda'
import { useBusquedaRestaurada } from '../busqueda/busquedaEnHistorial'
import { PuenteBoveda } from '../busqueda/PuenteBoveda'
import { ResultadosBusqueda } from '../busqueda/ResultadosBusqueda'
import { BorradoresCoincidentes, GuiasEnBorrador } from '../busqueda/BorradoresCoincidentes'
import {
  borradoresCoincidentes,
  esBorradorVivo,
  hayGuiaPublicadaEnTitulo,
  repartirBorradores,
  sinLosYaOficiales,
} from '../busqueda/borradoresEnBusqueda'
import { normalizarTexto } from '../soluciones/iconosSoluciones'
import { useReanudar } from '../soluciones/useReanudar'
import { usePerfilVivo } from '../autenticacion/usePerfilVivo'
import { BienvenidaPrimerDia } from './BienvenidaPrimerDia'
import { agruparAgenda } from './agenda'
import { ResumenDelDia, SeccionesAgenda } from './SeccionesAgenda'
import { usePendientes } from './usePendientes'

// Pantalla de Inicio en el sistema Nocturne. Declara nivel de sección en
// el chasis único (tarea 185), que le pone sidebar en escritorio y
// pestañas en móvil.
//
// INICIO ES LA AGENDA OPERATIVA, CON EL BUSCADOR ARRIBA (encargo del
// 2026-09-20, tarea 1).
//
// El 2026-09-17 la agenda se mudó entera a `/agenda` y en Inicio quedó
// una línea con lo urgente. El efecto en el uso diario fue el contrario
// del buscado: al abrir la app ya no se sabía qué había pendiente, qué
// vencía hoy ni qué trabajo estaba a medias, porque todo eso estaba a un
// toque de distancia en otra pantalla. Buscar sigue siendo la entrada
// rápida y se queda arriba del todo; debajo vuelve la agenda.
//
// De arriba abajo:
//
//   1. la pregunta y el buscador global, lo primero y lo más grande;
//   2. la fecha de hoy y el resumen de lo que hay con fecha;
//   3. Vencidos · 4. Para hoy · 5. Próximos (tres) · 6. En curso ·
//      7. Por revisar del equipo, con "Ver agenda completa" al final.
//
// Los grupos NO se dibujan aquí: son `SeccionesAgenda`, el mismo
// componente que usa `AgendaPage`, sobre el mismo `agruparAgenda` de los
// mismos `usePendientes`. Una sola regla de negocio, dos sitios donde se
// ve.
//
// Nada se inventa: no hay calendario, ni recordatorios a mano, ni tabla
// nueva; la agenda es una vista de datos que ya existen.

export function InicioPage() {
  // VOLVER CON LA BÚSQUEDA ESCRITA (encargo del 2026-09-16, sección 13).
  // Abrir una ficha desde un resultado y volver (con el regreso de la app
  // o con el botón atrás del teléfono) repone lo que estaba escrito en
  // este campo. Viaja en el estado de navegación, nunca en la URL ni en
  // localStorage.
  const { restaurada, descartar } = useBusquedaRestaurada()
  const repuesta = restaurada && !restaurada.capa ? restaurada.consulta : ''
  const [query, setQuery] = useState(repuesta)
  // Vaciar el campo repuesto es dar la búsqueda por terminada: se olvida
  // también en el historial, para que volver más tarde a Inicio no la
  // reponga.
  useEffect(() => {
    if (repuesta !== '' && query === '') descartar()
  }, [repuesta, query, descartar])
  // BUSCAR NADA MÁS ABRIR, EN ESCRITORIO (segunda pasada del encargo del
  // 2026-09-17, sección 2: "al abrir la aplicación, poder empezar a buscar
  // inmediatamente"). Con ratón y teclado físico el campo recibe el foco
  // al llegar a Inicio: se escribe sin tocar nada. En el teléfono NO: el
  // teclado en pantalla taparía la agenda, que es justo lo que se viene a
  // leer al abrir; ahí el campo ya es lo primero y lo más grande.
  const refCampo = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const conPunteroFino =
      typeof window.matchMedia === 'function' && window.matchMedia('(hover: hover) and (pointer: fine)').matches
    if (conPunteroFino) refCampo.current?.focus({ preventScroll: true })
  }, [])
  // La bóveda se abrió desde el puente de la propia búsqueda, sin salir
  // de Inicio: cuenta una interacción más en la medición del recorrido.
  const [huboDesbloqueo, setHuboDesbloqueo] = useState(false)
  // El input usa `query` directo (nunca se atrasa); todo lo derivado de
  // buscar y pintar resultados usa la version diferida, para que
  // escribir se sienta instantaneo.
  const queryDiferida = useDeferredValue(query)
  const consultaCruda = queryDiferida.trim()
  const consulta = normalizarTexto(consultaCruda)
  const buscando = consultaCruda.length > 0

  const indice = useIndiceBusqueda()
  const resultados = useMemo(() => buscar(indice, queryDiferida), [indice, queryDiferida])

  // ALCANCES DISTINTOS, DICHOS EN VOZ ALTA (hallazgo H09, criterio A16;
  // rehecho en el encargo del 2026-09-20, tarea 1).
  //
  // El buscador global solo indexa lo PUBLICADO, y así debe seguir: un
  // borrador no es un procedimiento del equipo. Lo que estaba mal era
  // CÓMO se decía. El aviso de "hay borradores que coinciden" vivía
  // dentro del estado "Sin coincidencias", así que bastaba con que
  // coincidiera cualquier otra cosa (buscando "DIAN", la ficha de HKA
  // Factura) para que no se dibujara nunca y la guía en borrador
  // pareciera no existir. Ahora es un bloque propio que sale SIEMPRE que
  // haya búsqueda y algún borrador que coincida.
  //
  // `estado === 'borrador'` y nada más: un artículo obsoleto no es un
  // borrador, y uno eliminado no se nombra.
  const borradores = useLiveQuery(
    () => db.articulos.filter(esBorradorVivo).toArray(),
    [],
    [],
  )
  const nombresCategoriaPorId = useLiveQuery(
    async () => new Map((await db.categorias.toArray()).map((c) => [c.id, c.nombre])),
    [],
    new Map<string, string>(),
  )
  const borradoresQueCoinciden = useMemo(
    () =>
      sinLosYaOficiales(borradoresCoincidentes(borradores, nombresCategoriaPorId, consulta), resultados),
    [borradores, nombresCategoriaPorId, consulta, resultados],
  )

  // COINCIDENCIA FUERTE ARRIBA (encargo del 2026-09-20, tarea 1). Un
  // borrador que coincide EN EL TÍTULO es la respuesta a lo que se
  // escribió, aunque no esté publicado: buscando "DIAN" el técnico quiere
  // HACER el procedimiento que se llama así, no leer la ficha de la
  // herramienta que lo acompaña. Sube con los resultados, siempre
  // marcado. El que solo coincide por etiqueta, categoría o tipo se queda
  // en el bloque de abajo.
  const { destacados, secundarios } = useMemo(
    () => repartirBorradores(borradoresQueCoinciden),
    [borradoresQueCoinciden],
  )
  // Lo PUBLICADO manda: si ya hay una guía oficial con la consulta en el
  // título, el borrador va detrás de los resultados, no delante.
  const hayPublicadaEnTitulo = useMemo(
    () => hayGuiaPublicadaEnTitulo(resultados, consulta, normalizarTexto),
    [resultados, consulta],
  )

  // LA AGENDA. Los mismos pendientes que cuenta el número de la pestaña,
  // repartidos por fecha con la misma función que usa `/agenda`: aquí no
  // se vuelve a decidir qué está vencido ni qué es de hoy.
  const perfil = usePerfilVivo()
  const { items: pendientes, cargando: agendaCargando } = usePendientes()
  const agenda = useMemo(() => agruparAgenda(pendientes), [pendientes])

  // LA TARJETA DE REANUDAR la dibuja `SeccionesAgenda` dentro de "En
  // curso". Aquí el dato se lee solo para saber si ya hay trabajo real,
  // que es lo que retira la bienvenida del primer día.
  const reanudar = useReanudar()

  // Bienvenida del primer día (tarea 184): se muestra mientras falte
  // alguno de sus tres pasos Y no haya todavía trabajo real. Sin valor
  // por defecto, `useLiveQuery` devuelve `undefined` hasta que resuelve:
  // es la señal de "ya sé lo que hay" que evita enseñarla un instante a
  // quien sí tiene trabajo a medias.
  const consultasListas = useLiveQuery(() => db.progresoPasos.count(), []) !== undefined
  const hayBloquesReales = pendientes.length > 0 || reanudar.actual != null

  return (
    // Nivel 1 del chasis (tarea 185): raíz de su pila.
    //
    // `conLupa={false}` (regla M-R8, "un buscador por pantalla"): esta
    // pantalla trae su propio campo de búsqueda en línea, así que la lupa
    // del chasis sería el segundo buscador de la misma pantalla.
    <Chasis
      titulo="Inicio"
      conLupa={false}
      barra={
        <div className="px-4 pb-3.5 pt-1.5">
          {/* LA PREGUNTA, NO EL MÓDULO (tarea 241, sección 1; encargo del
              2026-09-17). El técnico no llega con ganas de buscar, llega
              con algo que solucionar. La etiqueta accesible sigue
              nombrando el alcance (regla M-R8). */}
          <p className="mb-2 px-0.5 text-[17px] font-medium leading-snug text-noct-text">
            ¿Qué necesitas solucionar?
          </p>
          <CampoBusqueda
            valor={query}
            onCambiar={setQuery}
            alcance="Soluciones IT"
            textoAlternativo="Procedimiento, error, equipo…"
            refCampo={refCampo}
          />
        </div>
      }
    >
      <main className="flex-1 px-4 pb-16 pt-4">
        {buscando ? (
          <div className="flex flex-col gap-4">
            {/* La guía en borrador que coincide en el título, DELANTE de
                todo lo demás, salvo que ya haya una publicada que también
                coincida en el título: esa conserva la prioridad. */}
            {!hayPublicadaEnTitulo && <GuiasEnBorrador borradores={destacados} consulta={consulta} consultaCruda={consultaCruda} />}

            {resultados.length > 0 ? (
              <ResultadosBusqueda
                resultados={resultados}
                consulta={consulta}
                consultaCruda={consultaCruda}
                onDesbloqueada={() => setHuboDesbloqueo(true)}
                huboDesbloqueo={huboDesbloqueo}
              />
            ) : (
              <>
                {/* Estado vacío más útil: con la bóveda bloqueada, "no se
                    encontró nada" no es toda la verdad, porque sus accesos ni
                    siquiera se buscaron. */}
                <PuenteBoveda consulta={consultaCruda} onDesbloqueada={() => setHuboDesbloqueo(true)} />
                {borradoresQueCoinciden.length > 0 ? (
                  // NO ES "SIN COINCIDENCIAS": hay algo escrito sobre esto,
                  // solo que sin publicar. Decir que no hay nada mandaría a
                  // escribir de cero una guía que ya existe a medias.
                  <div className="rounded-lg border border-dashed border-noct-neutral-700 px-4 py-4">
                    <p className="text-[14.5px] font-medium">No hay una guía publicada con esta búsqueda.</p>
                    <p className="mt-1 text-[13px] leading-relaxed text-noct-neutral-400">
                      Lo que hay está sin publicar y lleva su aviso.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-noct-neutral-700 px-6 py-12 text-center">
                    <MagnifyingGlass size={30} className="text-noct-neutral-600" aria-hidden />
                    <div>
                      <p className="text-[14.5px] font-medium">Sin coincidencias</p>
                      <p className="mt-1 text-[13px] leading-relaxed text-noct-neutral-400">
                        Nada coincide con "{consultaCruda}" en Soluciones IT. Prueba otra palabra o revisa la
                        ortografía.
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}

            {hayPublicadaEnTitulo && <GuiasEnBorrador borradores={destacados} consulta={consulta} consultaCruda={consultaCruda} />}

            {/* BORRADORES COINCIDENTES: los que solo coinciden por
                etiqueta, categoría o tipo. En su propio bloque, nunca
                mezclados con los oficiales, y sin repetir los que ya
                subieron arriba. */}
            <BorradoresCoincidentes
              borradores={secundarios}
              consulta={consulta}
              consultaCruda={consultaCruda}
            />

            {resultados.length === 0 && (
              <div className="flex flex-wrap justify-center gap-2">
                <Link to={`/soluciones?q=${encodeURIComponent(consultaCruda)}`} className={BTN_SECUNDARIO}>
                  <MagnifyingGlass size={15} aria-hidden />
                  Buscar solo en Guías
                </Link>
                <Link
                  to={`/dispositivos/nuevo?nombre=${encodeURIComponent(consultaCruda)}`}
                  className={BTN_SECUNDARIO}
                >
                  <Plus size={15} aria-hidden />
                  Crear equipo
                </Link>
                <button type="button" onClick={() => setQuery('')} className={BTN_SECUNDARIO}>
                  Limpiar búsqueda
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-[22px]">
            {/* LA AGENDA OPERATIVA, JUSTO DEBAJO DEL BUSCADOR. El día y el
                resumen primero, y debajo los grupos en el orden en que se
                decide la jornada. La guía a medias entra en "En curso"
                (con su tarjeta) y no se repite en ninguna otra sección. */}
            <div className="flex flex-col gap-[18px]">
              <ResumenDelDia agenda={agenda} cargando={agendaCargando} />
              <SeccionesAgenda agenda={agenda} cargando={agendaCargando} conEnlaceCompleta />
            </div>

            {/* Bienvenida del primer día: los tres pasos que dejan al
                técnico listo para trabajar sin señal. Va DEBAJO de la
                agenda para no empujarla, se retira sola en cuanto hay
                trabajo real y, cumplida, no vuelve. */}
            {consultasListas && (
              <BienvenidaPrimerDia nombre={perfil?.nombre} hayBloquesReales={hayBloquesReales} />
            )}
          </div>
        )}
      </main>
    </Chasis>
  )
}
