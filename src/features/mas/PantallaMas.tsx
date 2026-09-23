import { useLiveQuery } from 'dexie-react-hooks'
import { useId, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Chasis } from '../../app/Chasis'
import { destinoDePestana, RAICES_CON_MEMORIA } from '../../app/memoriaPestana'
import { Avatar } from '../../components/Avatar'
import {
  BookBookmark,
  CaretDown,
  CaretRight,
  ClockCountdown,
  MapPin,
  Package,
  PlugsConnected,
  Star,
  TreeStructure,
  UsersThree,
} from '../../components/iconos'
import { db } from '../../lib/db'
import { obtenerFavoritos, type ElementoFavorito } from '../../lib/favoritos'
import { useAuth } from '../autenticacion/authContext'
import { usePerfilVivo } from '../autenticacion/usePerfilVivo'
import { VISUAL_POR_TIPO } from '../busqueda/resultados'
import { agruparAgenda, resumenUrgente } from '../inicio/agenda'
import { usePendientes } from '../inicio/usePendientes'
import { estaActiva } from '../personas/cicloPersona'
import { ConteoFila, FilaMas as Fila, TituloGrupo } from './FilasMas'

// Pestaña "Más" (tarea 182, mockup 3f del handoff "Auditoría de
// Soluciones TI"). Puerta de los destinos que no aparecen en la barra
// (regla R15): antes un técnico nuevo no podía encontrarlos sin que
// alguien se los mostrara.
//
// CINCO GRUPOS desde la tarea 268 (sección 22 del encargo del
// 2026-09-23), una puerta por capacidad y ninguna función perdida:
//
//   - Consulta: lo que se mira (Centro de consulta, Agenda y, solo si
//     hay, Mis favoritos).
//   - Organización: quién y dónde (Personas, Ubicaciones).
//   - Infraestructura: Red. Topología dejó de ser fila propia: se abre
//     desde Red ("Mapa completo, desde cada raíz"), que ya la enlazaba;
//     su pantalla, sus rutas y sus datos no cambian.
//   - Herramientas: "Herramientas de inventario" (Importar equipos,
//     Etiquetas QR y los datos por ordenar, en una sola puerta) y, hasta
//     la tarea 269, Diagnóstico.
//   - Aplicación: "Ajustes" (cuenta, contraseña, bloqueo, sin conexión,
//     instalar, buscar actualización y cerrar sesión, que antes eran tres
//     filas).
//
// En pantallas anchas los grupos se reparten en dos columnas: Más es una
// sola puerta en todos los tamaños.

export function PantallaMas() {
  const { perfil } = useAuth()
  const perfilVivo = usePerfilVivo()
  const usuario = perfilVivo ?? perfil

  const ubicaciones = useLiveQuery(() => db.ubicaciones.filter((u) => !u.eliminadoEn).count(), [])
  // Las activas: una persona retirada no es alguien con quien trabajar hoy.
  const personasActivas = useLiveQuery(
    () => db.personas.filter((p) => !p.eliminadoEn && estaActiva(p)).count(),
    [],
  )
  const diagnosticos = useLiveQuery(() => db.diagnosticos.filter((d) => !d.eliminadoEn).count(), [])
  const referencias = useLiveQuery(
    () => db.referencias.filter((r) => !r.eliminadoEn).count(),
    [],
  )
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
            tarea 257). `items-start` evita que abrir Mis favoritos
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
            <TituloGrupo>Organización</TituloGrupo>
            <div className="flex flex-col divide-y divide-noct-divider">
              <Fila
                to="/personas"
                Icono={UsersThree}
                titulo="Personas"
                subtitulo="Quién tiene cada equipo, ingresos y retiros"
                conteo={personasActivas ?? null}
              />
              <Fila
                to="/ubicaciones"
                Icono={MapPin}
                titulo="Ubicaciones"
                subtitulo="Qué hay en cada sede, área y rack"
                conteo={ubicaciones ?? null}
              />
            </div>
          </section>

          <section>
            <TituloGrupo>Infraestructura</TituloGrupo>
            <div className="flex flex-col divide-y divide-noct-divider">
              {/* Red recorre la infraestructura, busca un equipo, dice qué
                  cae si falla y abre el mapa completo (Topología), que ya
                  no necesita fila propia (tarea 268). */}
              <Fila
                to={destinoRed}
                Icono={PlugsConnected}
                titulo="Red"
                subtitulo="Conexiones, impacto y el mapa completo"
              />
            </div>
          </section>

          <section>
            <TituloGrupo>Herramientas</TituloGrupo>
            <div className="flex flex-col divide-y divide-noct-divider">
              <Fila
                to="/inventario"
                Icono={Package}
                titulo="Herramientas de inventario"
                subtitulo="Importar equipos, etiquetas QR y datos por ordenar"
              />
              <Fila
                to="/diagnostico"
                Icono={TreeStructure}
                titulo="Diagnóstico"
                subtitulo="Del síntoma a la guía, paso a paso"
                conteo={diagnosticos ?? null}
              />
            </div>
          </section>

          <section>
            <TituloGrupo>Aplicación</TituloGrupo>
            <div className="flex flex-col divide-y divide-noct-divider">
              {/* AJUSTES, una sola puerta (tarea 268): Mi cuenta, Bloqueo
                  y seguridad y Buscar actualización eran tres filas, y Mi
                  cuenta ya enlazaba la seguridad y ofrecía instalar y
                  trabajar sin conexión. El avatar dice de quién es la
                  cuenta abierta. */}
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
                  <span className="block text-[15px] font-medium leading-[1.3]">Ajustes</span>
                  <span className="mt-0.5 block truncate text-[12px] text-noct-neutral-400">
                    {usuario?.nombre ? `${usuario.nombre} · ` : ''}cuenta, bloqueo, sin conexión y actualización
                  </span>
                </span>
                <CaretRight size={15} className="shrink-0 text-noct-neutral-600" aria-hidden />
              </Link>
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
