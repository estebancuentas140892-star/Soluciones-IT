import { useLiveQuery } from 'dexie-react-hooks'
import { useId, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Chasis } from '../../app/Chasis'
import { destinoDePestana, RAICES_CON_MEMORIA } from '../../app/memoriaPestana'
import { Avatar } from '../../components/Avatar'
import { BuscarActualizacion } from '../../components/BuscarActualizacion'
import {
  BookBookmark,
  CaretDown,
  CaretRight,
  ClockCountdown,
  Graph,
  type IconoProps,
  LockSimple,
  MapPin,
  PlugsConnected,
  QrCode,
  Star,
  TreeStructure,
  UploadSimple,
  UsersThree,
} from '../../components/iconos'
import { db, ID_BLOQUEO_APP } from '../../lib/db'
import { obtenerFavoritos, type ElementoFavorito } from '../../lib/favoritos'
import { conOrigen, type EstadoConOrigen } from '../../lib/origenNavegacion'
import { useAuth } from '../autenticacion/authContext'
import { usePerfilVivo } from '../autenticacion/usePerfilVivo'
import { VISUAL_POR_TIPO } from '../busqueda/resultados'
import { agruparAgenda, resumenUrgente } from '../inicio/agenda'
import { usePendientes } from '../inicio/usePendientes'

// Pestaña "Más" (tarea 182, mockup 3f del handoff "Auditoría de
// Soluciones TI"). Puerta de los destinos que no aparecen en la barra
// (regla R15): antes un técnico nuevo no podía encontrarlos sin que
// alguien se los mostrara.
//
// CUATRO GRUPOS desde la tarea 257 (Fase 5 del encargo del 2026-09-22,
// sección 6 de PROPUESTA_REDISENO_RESOLVER.md), uno por pregunta:
//
//   - Consulta: lo que se mira (Centro de consulta, Agenda y, solo si
//     hay, Mis favoritos).
//   - Infraestructura: cómo está montado todo (Red, Topología,
//     Ubicaciones, Personas). Red y Topología cambian de PUERTA, no de
//     comportamiento: sus pantallas son las mismas.
//   - Herramientas: lo que se hace de vez en cuando (Diagnóstico,
//     Importar equipos, Etiquetas QR).
//   - Configuración: la cuenta y este teléfono.
//
// Lo que dejó de estar aquí: "Actividad del equipo" se mudó al final de
// la Agenda, porque no es un destino sino lo que pasa en el equipo; y
// "Mejor desde el ordenador" dejó de ser un grupo, así que Importar y
// Etiquetas llevan esa nota en su propia fila. En pantallas anchas los
// grupos se reparten en dos columnas: Más es una sola puerta en todos
// los tamaños (la barra lateral de escritorio ya no tiene grupos).

// La nota que antes titulaba un grupo entero. En la fila dice lo mismo
// sin convertir en "menos importante" lo que queda al final.
const NOTA_ORDENADOR = 'Mejor desde el ordenador'

export function PantallaMas() {
  const { perfil } = useAuth()
  const perfilVivo = usePerfilVivo()
  const usuario = perfilVivo ?? perfil

  const ubicaciones = useLiveQuery(() => db.ubicaciones.toArray(), [], [])
  const personas = useLiveQuery(() => db.personas.filter((p) => !p.eliminadoEn).toArray(), [], [])
  const diagnosticos = useLiveQuery(() => db.diagnosticos.filter((d) => !d.eliminadoEn).count(), [])
  const referencias = useLiveQuery(
    () => db.referencias.filter((r) => !r.eliminadoEn).count(),
    [],
  )
  const bloqueo = useLiveQuery(async () => (await db.seguridadApp.get(ID_BLOQUEO_APP)) ?? null, [])
  // Mis favoritos solo aparece si hay alguno: una fila vacía sería un
  // destino que no lleva a nada.
  const favoritos = useLiveQuery(() => obtenerFavoritos(), [], [])
  // Lo urgente de la agenda, como subtítulo de su fila: el mismo dato que
  // el número de la pestaña Resolver.
  const { items: pendientes } = usePendientes()
  const urgentes = resumenUrgente(agruparAgenda(pendientes))
  // Red abre en el nodo donde se dejó, como cuando era pestaña (tarea
  // 257, ver `RAICES_CON_MEMORIA`).
  const { pathname } = useLocation()
  const destinoRed = destinoDePestana('/red', pathname, RAICES_CON_MEMORIA)

  return (
    // Nivel 1 del chasis (tarea 185): raíz de su pila, sin controles
    // propios bajo la fila superior.
    <Chasis titulo="Más">
      <main className="flex-1 px-4 pb-16 pt-4">
        {/* Una columna en el teléfono y en la tableta; desde 1024 px,
            dos. A 768 las dos columnas dejaban unos 340 px por grupo y
            recortaban los subtítulos (medido en las capturas de la
            tarea 257). Con cuatro grupos el reparto queda en dos filas
            parejas, y `items-start` evita que abrir Mis favoritos
            estire el grupo de al lado.

            `grid-cols-1` NO sobra aunque sea una sola columna: sin
            columnas declaradas, la columna implícita es `auto` y no
            puede encogerse por debajo del texto `truncate` más largo
            (no parte línea), así que en el teléfono crecía más que la
            pantalla y el conteo y el galón quedaban fuera, recortados
            sin barra de desplazamiento. Tailwind la define con
            `minmax(0, 1fr)`, que sí se encoge. */}
        <div className="grid grid-cols-1 items-start gap-[22px] lg:grid-cols-2 lg:gap-x-8">
          <section>
            <TituloGrupo>Consulta</TituloGrupo>
            <div className="flex flex-col divide-y divide-noct-divider">
              {/* Centro de consulta (antes "Referencia"): responde "¿qué
                  es esto?" con el equipo delante, en mitad de una guía o
                  de una llamada. */}
              <Fila
                to="/referencia"
                Icono={BookBookmark}
                titulo="Centro de consulta"
                subtitulo="Herramientas, glosario, atajos y comandos"
                conteo={referencias ?? null}
              />
              <Fila
                to="/agenda"
                Icono={ClockCountdown}
                titulo="Agenda"
                subtitulo={urgentes || 'Vencimientos, borradores y sugerencias del equipo'}
              />
              {favoritos.length > 0 && <FilaFavoritos favoritos={favoritos} />}
            </div>
          </section>

          <section>
            <TituloGrupo>Infraestructura</TituloGrupo>
            <div className="flex flex-col divide-y divide-noct-divider">
              <Fila
                to={destinoRed}
                Icono={PlugsConnected}
                titulo="Red"
                subtitulo="Cómo está conectada la infraestructura"
              />
              {/* La misma puerta que "Mapa completo, desde cada raíz" de
                  la pantalla de Red, un toque más cerca. Su padre es Red,
                  pero aquí se llega desde Más, así que su regreso vuelve
                  a Más (regla M-R2), igual que desde Red vuelve al nodo
                  que se estaba recorriendo. */}
              <Fila
                to="/red/topologia"
                Icono={Graph}
                titulo="Topología"
                subtitulo="El mapa completo, desde cada raíz"
                estado={conOrigen('/mas', 'Más')}
              />
              <Fila
                to="/ubicaciones"
                Icono={MapPin}
                titulo="Ubicaciones"
                subtitulo="Sedes, salas y racks"
                conteo={ubicaciones.length}
              />
              <Fila
                to="/personas"
                Icono={UsersThree}
                titulo="Personas"
                subtitulo="Responsables de cada equipo"
                conteo={personas.length}
              />
            </div>
          </section>

          <section>
            <TituloGrupo>Herramientas</TituloGrupo>
            <div className="flex flex-col divide-y divide-noct-divider">
              <Fila
                to="/diagnostico"
                Icono={TreeStructure}
                titulo="Diagnóstico"
                subtitulo="Del síntoma a la guía, paso a paso"
                conteo={diagnosticos ?? null}
              />
              <Fila
                to="/dispositivos/importar"
                Icono={UploadSimple}
                titulo="Importar equipos"
                subtitulo="Carga masiva desde Excel o CSV"
                nota={NOTA_ORDENADOR}
              />
              <Fila
                to="/dispositivos/etiquetas"
                Icono={QrCode}
                titulo="Etiquetas QR"
                subtitulo="Generar e imprimir etiquetas para el inventario"
                nota={NOTA_ORDENADOR}
              />
            </div>
          </section>

          <section>
            <TituloGrupo>Configuración</TituloGrupo>
            <div className="flex flex-col divide-y divide-noct-divider">
              <Link
                to="/cuenta"
                className="flex min-h-[58px] items-center gap-[13px] rounded-md px-2 py-[11px] text-noct-text hover:bg-noct-text/[.05]"
              >
                <Avatar
                  nombre={usuario?.nombre}
                  correo={usuario?.correo}
                  className="h-[34px] w-[34px] text-[12px]"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-medium leading-[1.3]">
                    {usuario?.nombre || 'Mi cuenta'}
                  </span>
                  {usuario?.correo && (
                    <span className="mt-0.5 block truncate text-[12px] text-noct-neutral-400">
                      {usuario.correo}
                    </span>
                  )}
                </span>
                <CaretRight size={15} className="shrink-0 text-noct-neutral-600" aria-hidden />
              </Link>
              <Fila
                to="/cuenta/seguridad"
                Icono={LockSimple}
                titulo="Bloqueo y seguridad"
                subtitulo={
                  bloqueo === undefined
                    ? 'Cargando...'
                    : `${bloqueo?.metodo === 'contrasena' ? 'Contraseña' : 'Patrón'} de este teléfono · ${
                        bloqueo ? 'activo' : 'inactivo'
                      }`
                }
              />
              {/* QUÉ VERSIÓN LLEVA ESTE TELÉFONO, Y BUSCAR UNA NUEVA
                  (encargo del 2026-09-20). Va aquí y no en Cuenta porque
                  Más es la pantalla que se abre cuando algo "no se ve
                  como debería". */}
              <BuscarActualizacion />
            </div>
          </section>
        </div>
      </main>
    </Chasis>
  )
}

// MIS FAVORITOS COMO UNA FILA MÁS DE CONSULTA (tarea 257). Antes era un
// bloque plegable propio, con marco, al final de Más junto a la
// actividad del equipo. Ahora tiene la misma forma que sus vecinas (icono
// en su caja, título, subtítulo y conteo) y se despliega en el sitio,
// sin pantalla nueva: son accesos, y un destino que solo lista enlaces
// sería un toque de más para llegar a ellos.
function FilaFavoritos({ favoritos }: { favoritos: ElementoFavorito[] }) {
  const [abierta, setAbierta] = useState(false)
  const idCuerpo = useId()

  return (
    <div>
      <button
        type="button"
        onClick={() => setAbierta((valor) => !valor)}
        aria-expanded={abierta}
        aria-controls={idCuerpo}
        className="flex min-h-[58px] w-full items-center gap-[13px] rounded-md px-2 py-[11px] text-left text-noct-text hover:bg-noct-text/[.05]"
      >
        <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-md bg-noct-text/[.06] text-noct-neutral-300">
          <Star size={17} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-medium leading-[1.3]">Mis favoritos</span>
          <span className="mt-0.5 block truncate text-[12px] text-noct-neutral-400">
            Lo que marcaste con la estrella
          </span>
        </span>
        <ConteoFila valor={favoritos.length} />
        <CaretDown
          size={15}
          className={`shrink-0 text-noct-neutral-600 transition-transform duration-150 motion-reduce:transition-none ${
            abierta ? 'rotate-180' : ''
          }`}
          aria-hidden
        />
      </button>
      {abierta && (
        // Sangría alineada con el título de la fila (8 de margen + 34 de
        // icono + 13 de separación), para que se lea como su contenido.
        <div id={idCuerpo} className="flex flex-col pb-1.5 pl-[55px] pr-2">
          {favoritos.map((favorito) => {
            const { Icono } = VISUAL_POR_TIPO[favorito.tipo]
            return (
              <Link
                key={favorito.clave}
                to={favorito.ruta}
                className="flex min-h-11 items-center gap-2.5 border-t border-noct-divider/60 text-[13.5px] text-noct-text first:border-t-0 hover:text-noct-accent-300"
              >
                <Icono size={15} className="shrink-0 text-noct-neutral-400" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{favorito.titulo}</span>
                {favorito.subtitulo && (
                  <span className="max-w-[45%] shrink-0 truncate text-[12px] text-noct-neutral-400">
                    {favorito.subtitulo}
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

function TituloGrupo({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-1.5 px-0.5 text-[11px] font-medium uppercase tracking-[0.08em] text-noct-neutral-400">
      {children}
    </h2>
  )
}

// EL CONTEO VA A LA DERECHA (tarea 207, hallazgo M-025). Iba pegado al
// final del subtítulo ("Sedes, salas y racks · 12"), así que se leía
// como parte de la descripción y no se podía comparar de un vistazo
// entre filas. A la derecha, antes del galón, queda en la misma ranura
// que en Guías y Equipos y las cifras se alinean solas.
function ConteoFila({ valor }: { valor: number | null }) {
  if (valor === null) return null
  return (
    <span className="shrink-0 font-mono text-[13px] tabular-nums text-noct-neutral-400">{valor}</span>
  )
}

function Fila({
  to,
  Icono,
  titulo,
  subtitulo,
  conteo = null,
  nota,
  estado,
}: {
  to: string
  Icono: (props: IconoProps) => React.JSX.Element
  titulo: string
  subtitulo: string
  conteo?: number | null
  /**
   * Una aclaración propia de la fila, debajo del subtítulo. Hoy solo
   * "Mejor desde el ordenador" en Importar y Etiquetas (tarea 257), que
   * antes era el título de un grupo entero.
   */
  nota?: string
  /**
   * El `state` del salto, para la fila que lleva a una pantalla cuyo
   * padre no es Más (regla M-R2: volver deshace el último salto). Hoy
   * solo Topología, que cuelga de Red.
   */
  estado?: EstadoConOrigen
}) {
  return (
    <Link
      to={to}
      state={estado}
      className="flex min-h-[58px] items-center gap-[13px] rounded-md px-2 py-[11px] text-noct-text hover:bg-noct-text/[.05]"
    >
      <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-md bg-noct-text/[.06] text-noct-neutral-300">
        <Icono size={17} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium leading-[1.3]">{titulo}</span>
        <span className="mt-0.5 block truncate text-[12px] text-noct-neutral-400">{subtitulo}</span>
        {nota && <span className="mt-0.5 block text-[11.5px] text-noct-neutral-500">{nota}</span>}
      </span>
      <ConteoFila valor={conteo} />
      <CaretRight size={15} className="shrink-0 text-noct-neutral-600" aria-hidden />
    </Link>
  )
}
