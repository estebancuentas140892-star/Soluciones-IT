import { useLiveQuery } from 'dexie-react-hooks'
import { useId, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Chasis } from '../../app/Chasis'
import { ANCHO_ESCRITORIO, useEsAncho } from '../../components/useEsAncho'
import { destinoDePestana, RAICES_CON_MEMORIA } from '../../app/memoriaPestana'
import {
  BookBookmark,
  CaretDown,
  MapPin,
  Package,
  PlugsConnected,
  Star,
  Storefront,
  UserCircle,
  UsersThree,
} from '../../components/iconos'
import { db } from '../../lib/db'
import { obtenerFavoritos, type ElementoFavorito } from '../../lib/favoritos'
import { VISUAL_POR_TIPO } from '../busqueda/resultados'
import { estaActiva } from '../personas/cicloPersona'
import { ConteoFila, FILAS_EN_TARJETA, FilaMas as Fila, TituloGrupo } from './FilasMas'
import { AparienciaTelefono } from './AparienciaTelefono'

// Pestaña "Más" (tarea 182, mockup 3f del handoff "Auditoría de
// Soluciones TI"). Puerta de los destinos que no aparecen en la barra
// (regla R15): antes un técnico nuevo no podía encontrarlos sin que
// alguien se los mostrara.
//
// CINCO GRUPOS desde la tarea 268 (sección 22 del encargo del
// 2026-09-23), una puerta por capacidad y ninguna función perdida:
//
//   - Consulta: lo que se mira (Centro de consulta y, solo si hay, Mis
//     favoritos). La Agenda salió en la tarea 265 (encargo del
//     2026-09-29): pertenece a Resolver, que la abre desde Atención, y
//     dos puertas para lo mismo confundían a dónde volver.
//   - Organización: quién y dónde (Personas, Ubicaciones).
//   - Infraestructura: Red. Topología dejó de ser fila propia: se abre
//     desde Red ("Mapa completo, desde cada raíz"), que ya la enlazaba;
//     su pantalla, sus rutas y sus datos no cambian.
//   - Herramientas: "Herramientas de inventario" (Importar equipos,
//     Etiquetas QR y los datos por ordenar, en una sola puerta).
//     Diagnóstico salió en la tarea 269: las guías con preguntas se
//     encuentran y se ejecutan desde Resolver, y su administración
//     (crear, editar, estadísticas, sugerencias) tiene puerta en Guías.
//   - Aplicación: "Ajustes" (cuenta, contraseña, bloqueo, sin conexión,
//     instalar, buscar actualización y cerrar sesión, que antes eran tres
//     filas).
//
// En pantallas anchas los grupos se reparten en dos columnas: Más es una
// sola puerta en todos los tamaños.
//
// PROPUESTA FINAL DE CLAUDE DESIGN (2026-10-01): los grupos se nombran por
// INTENCIÓN (Consultar, Personas y lugares, Infraestructura, Inventario,
// Cuenta y aplicación) y las filas son de índice: icono de línea, título,
// una línea de qué contiene y galón, sin cajas (`FilaMas`). Mismos
// destinos, ni uno más ni uno menos. "Cuenta y aplicación" porque Ajustes
// guarda también el trabajo sin conexión y la actualización.
//
// REDISEÑO MÓVIL "1b PULGAR" (tarea 332): mismos grupos y destinos; los
// rótulos de grupo en minúsculas a 13,5 px y las filas de 60 px
// (`FilasMas`).

export function PantallaMas() {
  const ubicaciones = useLiveQuery(() => db.ubicaciones.filter((u) => !u.eliminadoEn).count(), [])
  // Las activas: una persona retirada no es alguien con quien trabajar hoy.
  const personasActivas = useLiveQuery(
    () => db.personas.filter((p) => !p.eliminadoEn && estaActiva(p)).count(),
    [],
  )
  const referencias = useLiveQuery(
    () => db.referencias.filter((r) => !r.eliminadoEn).count(),
    [],
  )
  // Tarea 321: cuántas autorizaciones de facturación hay registradas.
  const autorizaciones = useLiveQuery(
    () => db.autorizaciones_facturacion.filter((a) => !a.eliminadoEn).count(),
    [],
  )
  // Mis favoritos solo aparece si hay alguno: una fila vacía sería un
  // destino que no lleva a nada.
  const favoritos = useLiveQuery(() => obtenerFavoritos(), [], [])
  // Red abre en el nodo donde se dejó, como cuando era pestaña (tarea
  // 257, ver `RAICES_CON_MEMORIA`).
  const { pathname } = useLocation()
  const destinoRed = destinoDePestana('/red', pathname, RAICES_CON_MEMORIA)
  // DESDE 1280, UN DIRECTORIO Y SUS FAVORITOS AL LADO (tarea 339, T9; pizarra
  // Más 1280): cada grupo es una fila del directorio (su nombre en 180 px y
  // sus puertas, de una línea) y Mis favoritos, abierto, en su columna. Que
  // los favoritos dejen de ser un pliegue y sean una columna cambia la
  // estructura, así que se decide aquí.
  const escritorio = useEsAncho(ANCHO_ESCRITORIO)
  const favoritosAlLado = escritorio && favoritos.length > 0
  // Los cambios de forma del directorio, por CSS: el grupo en dos columnas y
  // su nombre y sus filas con la línea de arriba.
  const grupo = 'xl:grid xl:grid-cols-[180px_minmax(0,1fr)] xl:gap-x-6'
  const tituloGrupo = 'xl:border-t xl:border-noct-divider xl:pb-0 xl:pt-[13px]'
  const filas = `flex flex-col divide-y divide-noct-divider xl:divide-y-0 xl:border-t xl:border-noct-divider xl:py-1 ${FILAS_EN_TARJETA}`
  // «Apariencia», arriba de Más, solo en el teléfono (tarea 350, prototipo de
  // Claude Design): la misma preferencia de Ajustes, a un toque.
  const ancho = useEsAncho()

  const directorio = (
    // Una columna en el teléfono y en la tableta; desde 1024 px, dos. A
    // 768 las dos columnas dejaban unos 340 px por grupo y recortaban los
    // subtítulos (medido en las capturas de la tarea 257). `items-start`
    // evita que abrir Mis favoritos estire el grupo de al lado. Desde 1280,
    // el directorio: un grupo debajo de otro (T9).
    //
    // `grid-cols-1` NO sobra aunque sea una sola columna: sin columnas
    // declaradas, la columna implícita es `auto` y no puede encogerse por
    // debajo del texto `truncate` más largo (no parte línea), así que en el
    // teléfono crecía más que la pantalla y el conteo y el galón quedaban
    // fuera, recortados sin barra de desplazamiento. Tailwind la define con
    // `minmax(0, 1fr)`, que sí se encoge.
    <div className="grid min-w-0 grid-cols-1 items-start gap-[22px] lg:grid-cols-2 lg:gap-x-8 xl:grid-cols-1 xl:gap-0">
      {!ancho && <AparienciaTelefono />}
      <section className={grupo}>
        <TituloGrupo className={tituloGrupo}>Consultar</TituloGrupo>
        <div className={filas}>
          {/* Centro de consulta (antes "Referencia"): responde "¿qué
              es esto?" con el equipo delante, en mitad de una guía o
              de una llamada. */}
          <Fila
            to="/referencia"
            Icono={BookBookmark}
            titulo="Centro de consulta"
            subtitulo="Herramientas, glosario, atajos y comandos"
            conteo={referencias ?? null}
            unaLinea
          />
          {favoritos.length > 0 && !favoritosAlLado && <FilaFavoritos favoritos={favoritos} />}
        </div>
      </section>

      <section className={grupo}>
        <TituloGrupo className={tituloGrupo}>Personas y lugares</TituloGrupo>
        <div className={filas}>
          <Fila
            to="/personas"
            Icono={UsersThree}
            titulo="Personas"
            subtitulo="Quién tiene cada equipo, ingresos y retiros"
            conteo={personasActivas ?? null}
            unaLinea
          />
          <Fila
            to="/ubicaciones"
            Icono={MapPin}
            titulo="Ubicaciones"
            subtitulo="Qué hay en cada sede, área y rack"
            conteo={ubicaciones ?? null}
            unaLinea
          />
        </div>
      </section>

      <section className={grupo}>
        <TituloGrupo className={tituloGrupo}>Infraestructura</TituloGrupo>
        <div className={filas}>
          {/* Red recorre la infraestructura, busca un equipo, dice qué
              cae si falla y abre el mapa completo (Topología), que ya
              no necesita fila propia (tarea 268). */}
          <Fila
            to={destinoRed}
            Icono={PlugsConnected}
            titulo="Red"
            subtitulo="Conexiones, impacto y el mapa completo"
            unaLinea
          />
        </div>
      </section>

      <section className={grupo}>
        <TituloGrupo className={tituloGrupo}>Inventario</TituloGrupo>
        <div className={filas}>
          <Fila
            to="/inventario"
            Icono={Package}
            titulo="Herramientas de inventario"
            subtitulo="Importar, etiquetas QR y datos por ordenar"
            unaLinea
          />
          {/* Tarea 321: todas las autorizaciones, también las que no
              tienen POS (no cuelgan de ninguna ficha). */}
          <Fila
            to="/facturacion"
            Icono={Storefront}
            titulo="Autorizaciones de facturación"
            subtitulo="Prefijos y rangos DIAN de los POS"
            conteo={autorizaciones ?? null}
            unaLinea
          />
        </div>
      </section>

      <section className={grupo}>
        <TituloGrupo className={tituloGrupo}>Cuenta y aplicación</TituloGrupo>
        <div className={filas}>
          {/* AJUSTES, una sola puerta (tarea 268): Mi cuenta, Bloqueo
              y seguridad y Buscar actualización eran tres filas, y Mi
              cuenta ya enlazaba la seguridad y ofrecía instalar y
              trabajar sin conexión. Desde la propuesta final, una fila
              de índice como las demás: de quién es la cuenta lo dice el
              avatar de la barra superior y la cabecera de Ajustes. */}
          <Fila
            to="/cuenta"
            Icono={UserCircle}
            titulo="Ajustes"
            subtitulo="Cuenta, bloqueo, sin conexión y actualización"
            unaLinea
          />
        </div>
      </section>
    </div>
  )

  return (
    // Nivel 1 del chasis (tarea 185): raíz de su pila, sin controles
    // propios bajo la fila superior.
    <Chasis titulo="Más">
      <main className="flex-1 px-4 pb-16 pt-4">
        {favoritosAlLado ? (
          <div className="grid grid-cols-[minmax(0,1fr)_320px] items-start gap-x-12">
            {directorio}
            <ColumnaFavoritos favoritos={favoritos} />
          </div>
        ) : (
          directorio
        )}
      </main>
    </Chasis>
  )
}

// MIS FAVORITOS, ABIERTOS EN SU COLUMNA (desde 1280, tarea 339, T9): la misma
// lista que despliega su fila en el teléfono, con su cabecera (la estrella, el
// nombre y cuántos), sin botón.
function ColumnaFavoritos({ favoritos }: { favoritos: ElementoFavorito[] }) {
  const idTitulo = useId()
  return (
    <aside aria-labelledby={idTitulo} className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2 border-b border-noct-divider pb-1 pt-2.5">
        <h2 id={idTitulo} className="flex items-center gap-2 text-[14.5px] font-semibold">
          <Star size={17} className="shrink-0 text-noct-neutral-400" aria-hidden />
          Mis favoritos
        </h2>
        <ConteoFila valor={favoritos.length} />
      </div>
      <ListaFavoritos favoritos={favoritos} />
    </aside>
  )
}

// La lista de favoritos, la misma en la fila plegable y en la columna.
function ListaFavoritos({ favoritos, id }: { favoritos: ElementoFavorito[]; id?: string }) {
  return (
    <div id={id} className="flex flex-col">
      {favoritos.map((favorito) => {
        const { Icono } = VISUAL_POR_TIPO[favorito.tipo]
        return (
          <Link
            key={favorito.clave}
            to={favorito.ruta}
            className="flex min-h-11 items-center gap-2.5 border-t border-noct-divider/60 text-[14px] text-noct-text first:border-t-0 hover:text-noct-accent-300"
          >
            <Icono size={15} className="shrink-0 text-noct-neutral-400" aria-hidden />
            {/* Hasta dos líneas, como los títulos de Recientes y de los
                resultados: recortado, "Conectar un recurso compartido…"
                no decía cuál era. */}
            <span className="line-clamp-2 min-w-0 flex-1 break-words py-1.5">{favorito.titulo}</span>
            {favorito.subtitulo && (
              <span className="max-w-[45%] shrink-0 truncate text-[12px] text-noct-neutral-400">{favorito.subtitulo}</span>
            )}
          </Link>
        )
      })}
    </div>
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
        className="flex min-h-[60px] w-full items-center gap-3.5 py-2 text-left text-noct-text hover:bg-noct-text/[.04] md:min-h-14 xl:min-h-[46px]"
      >
        <Star size={20} className="w-5 shrink-0 text-noct-neutral-400" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-[15.5px] font-[550] leading-[1.3]">Mis favoritos</span>
          <span className="block truncate text-[13px] leading-[1.35] text-noct-neutral-400">
            Lo que marcaste con la estrella
          </span>
        </span>
        <ConteoFila valor={favoritos.length} />
        <CaretDown
          size={15}
          className={`shrink-0 text-noct-neutral-500 transition-transform duration-150 motion-reduce:transition-none ${
            abierta ? 'rotate-180' : ''
          }`}
          aria-hidden
        />
      </button>
      {abierta && (
        // Sangría alineada con el título de la fila (20 de icono + 14 de
        // separación), para que se lea como su contenido.
        <div className="pb-1.5 pl-[34px]">
          <ListaFavoritos favoritos={favoritos} id={idCuerpo} />
        </div>
      )}
    </div>
  )
}
