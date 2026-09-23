// Fuente única de la jerarquía de navegación "Up" (la pantalla lógica
// superior de cada ruta). Cada botón "Volver"/"Cancelar" pregunta aquí
// quién es su pantalla padre en vez de cablear el destino a mano. Así,
// cuando una pantalla se rediseña y cambia de forma (como pasó con
// Soluciones al pasar a Nocturne), los "Volver" de las pantallas que
// cuelgan de ella no se desincronizan ni terminan apuntando a una
// pantalla obsoleta (causa raíz de las tareas 75 y 76).
//
// Es navegación "Up" (padre lógico declarado), no un `history.back()`:
// en esta app hay flujos hacia adelante (guardar -> ficha nueva), donde
// retroceder en el historial caería en el formulario recién enviado. El
// padre lógico es determinista, a prueba de enlaces profundos y de
// recargas, y no depende del estado de la pila del navegador.

export interface Padre {
  /** Ruta de la pantalla superior (puede incluir query para reponer un filtro). */
  to: string
  /** Etiqueta por defecto del botón (una pantalla puede sobreescribirla con contexto). */
  etiqueta: string
}

// Las RUTAS conservan su nombre original aunque las secciones se
// renombraran a "Guías" y "Equipos" (regla R12, tarea 180): el handoff
// solo pide el cambio visible, y renombrar `/soluciones` y
// `/dispositivos` invalidaría los enlaces profundos que el equipo ya
// tiene compartidos y guardados en sus teléfonos. Aquí solo cambian las
// etiquetas; los identificadores de código siguen en su idioma original
// (regla 9 de REGLAS.md).

// LOS CUATRO DESTINOS PRINCIPALES (encargo del 2026-09-22, sección 2).
//
// Soluciones IT se organiza alrededor de buscar, encontrar, ejecutar y
// solucionar. La navegación principal es la misma en el teléfono, la
// tableta y el escritorio, y solo tiene cuatro puertas:
//
//   Resolver  `/`             ¿Qué necesitas resolver? El buscador y los
//                             procedimientos. Absorbe Inicio y la pestaña
//                             Guías: el catálogo (`/soluciones`) cuelga de
//                             aquí.
//   Equipos   `/dispositivos` ¿Qué sabemos de este dispositivo? El
//                             escáner es otra forma de buscar uno.
//   Bóveda    `/boveda`       Las claves, con sus controles de siempre.
//   Más       `/mas`          Todo lo demás: consulta, infraestructura
//                             (Red y Topología), herramientas y cuenta.
//
// Son las raíces de pestaña: no muestran "Volver" (se navega entre ellas
// por la barra), recuerdan su filtro (tarea 187) y cambiar de una a otra
// es un movimiento lateral. Orden significativo: `raizQueContiene`
// devuelve la primera que coincide, así que "/" va al final.
export const RAICES_DE_PESTANA = ['/dispositivos', '/boveda', '/mas', '/']
const TABS = new Set(RAICES_DE_PESTANA)

export type DestinoPrincipal = '/' | '/dispositivos' | '/boveda' | '/mas'

function normalizarRuta(pathname: string): string {
  return pathname !== '/' ? pathname.replace(/\/+$/, '') : '/'
}

function cuelgaDe(ruta: string, raiz: string): boolean {
  return ruta === raiz || ruta.startsWith(`${raiz}/`)
}

/**
 * Qué destino principal se ilumina en esta ruta, en la barra del
 * teléfono y en la lateral de escritorio por igual. Resolver cubre su
 * agenda, el catálogo de guías con todo lo que cuelga de él (la guía en
 * ejecución incluida) y el emparejamiento con un equipo atendido; Equipos
 * cubre su escáner; y Más, todo lo demás, porque todo lo demás se abre
 * desde Más. Antes la barra lateral iluminaba por su propio enlace y la
 * del teléfono por esta función, así que podían no coincidir.
 */
export function destinoPrincipalDe(pathname: string): DestinoPrincipal {
  const ruta = normalizarRuta(pathname)
  if (ruta === '/' || ruta === '/agenda' || cuelgaDe(ruta, '/conectar') || cuelgaDe(ruta, '/soluciones')) return '/'
  // Un recorrido con preguntas en ejecución es Resolver (tarea 263); su
  // lista y su administración siguen en Más.
  if (esRecorridoEnEjecucion(ruta)) return '/'
  // Importar y Etiquetas se abren desde Más > Herramientas de inventario
  // (tarea 268): aunque vivan bajo /dispositivos, se ilumina Más.
  if (HERRAMIENTAS_DE_INVENTARIO.has(ruta)) return '/mas'
  if (cuelgaDe(ruta, '/dispositivos') || cuelgaDe(ruta, '/escaner')) return '/dispositivos'
  if (cuelgaDe(ruta, '/boveda')) return '/boveda'
  return '/mas'
}

// ¿Es la raíz de una pestaña? La usa el cálculo de dirección de las
// transiciones (tarea 187, R21): cambiar de una raíz a otra es un
// movimiento lateral (fundido), no "entrar" ni "volver", aunque sus
// rutas tengan distinta profundidad (por ejemplo `/` tiene 0 segmentos
// y `/mas` tiene 1).
export function esRaizDePestana(pathname: string): boolean {
  return TABS.has(normalizarRuta(pathname))
}

// Las pantallas de /dispositivos que son herramientas de inventario
// (tarea 268): su puerta es /inventario, no la lista de Equipos.
const HERRAMIENTAS_DE_INVENTARIO = new Set(['/dispositivos/importar', '/dispositivos/etiquetas'])
const PUERTA_INVENTARIO: Padre = { to: '/inventario', etiqueta: 'Herramientas de inventario' }

// Raíces que no son pestañas: su "Volver" sube al destino principal
// desde el que se abren (encargo del 2026-09-22). El catálogo de guías y
// la agenda cuelgan de Resolver; el escáner, de Equipos; y lo que dejó
// de tener sitio en la barra (Red, Diagnóstico, Centro de consulta,
// Ubicaciones, Personas y la cuenta), de Más.
const RAICES_NO_TAB: Record<string, Padre> = {
  '/soluciones': { to: '/', etiqueta: 'Resolver' },
  '/agenda': { to: '/', etiqueta: 'Resolver' },
  '/conectar': { to: '/', etiqueta: 'Resolver' },
  '/escaner': { to: '/dispositivos', etiqueta: 'Equipos' },
  '/red': { to: '/mas', etiqueta: 'Más' },
  '/diagnostico': { to: '/mas', etiqueta: 'Más' },
  '/ubicaciones': { to: '/mas', etiqueta: 'Más' },
  '/personas': { to: '/mas', etiqueta: 'Más' },
  // El Centro de consulta (ruta `/referencia`, su nombre original).
  '/referencia': { to: '/mas', etiqueta: 'Más' },
  '/cuenta': { to: '/mas', etiqueta: 'Más' },
  // Herramientas de inventario (tarea 268): Importar, Etiquetas QR y los
  // datos por ordenar, en una sola puerta de Más.
  '/inventario': { to: '/mas', etiqueta: 'Más' },
}

// Devuelve la pantalla superior de `pathname`, o null si es una raíz
// (pestaña) que no debe mostrar "Volver". Solo necesita el pathname: los
// destinos que reponen un filtro (Soluciones) llevan el id en la propia
// ruta, así que se reconstruyen sin depender de la query entrante.
// Las pantallas de administración que cuelgan de /diagnostico con un
// nombre fijo; cualquier otro segmento es el id de un recorrido.
const ADMINISTRACION_DIAGNOSTICO = new Set(['nuevo', 'sugerencias', 'estadisticas'])

/** ¿Es `/diagnostico/:id`, un recorrido con preguntas en ejecución? */
export function esRecorridoEnEjecucion(pathname: string): boolean {
  const [seccion, a, b] = normalizarRuta(pathname).split('/').filter(Boolean)
  return seccion === 'diagnostico' && Boolean(a) && !b && !ADMINISTRACION_DIAGNOSTICO.has(a)
}

export function padreDe(pathname: string): Padre | null {
  const ruta = normalizarRuta(pathname)
  if (TABS.has(ruta)) return null
  if (ruta in RAICES_NO_TAB) return RAICES_NO_TAB[ruta]

  const seg = ruta.split('/').filter(Boolean)
  const [seccion, a, b, c] = seg

  switch (seccion) {
    case 'soluciones': {
      // a = categoriaId. Rutas bajo una categoría:
      //   /soluciones/:cat                 ficha de categoría   -> lista
      //   /soluciones/:cat/nuevo           crear artículo       -> lista + chip
      //   /soluciones/:cat/:art            la guía (ejecución)  -> lista + chip
      //   /soluciones/:cat/:art/detalles   ficha de la guía     -> la guía
      //   /soluciones/:cat/:art/editar     editar artículo      -> ficha
      //   /soluciones/:cat/:art/ejecutar   dirección antigua    -> lista + chip
      //
      // Desde el 2026-09-17 abrir una guía con pasos ES ejecutarla (ver
      // `GuiaPage`): la dirección de la guía es la ejecución y la ficha
      // baja a `/detalles`, que vuelve a la guía. Editar sube a la ficha,
      // que es donde se decide editar y donde se ve la versión guardada.
      // `/ejecutar` solo redirige a la guía; su padre es el de la guía.
      const lista: Padre = { to: '/soluciones', etiqueta: 'Guías' }
      if (!a) return lista
      // La categoría es un FILTRO de la lista (decisión del usuario,
      // 2026-07-18): volver a un artículo o a crear repone su chip.
      const listaConChip: Padre = { to: `/soluciones?categoria=${a}`, etiqueta: 'Guías' }
      if (!b) return lista // ficha de categoría -> lista principal
      if (b === 'nuevo') return listaConChip
      if (!c || c === 'ejecutar') return listaConChip // la guía -> lista con su chip
      if (c === 'detalles') return { to: `/soluciones/${a}/${b}`, etiqueta: 'Guía' }
      return { to: `/soluciones/${a}/${b}/detalles`, etiqueta: 'Volver' } // editar -> ficha
    }
    case 'dispositivos': {
      // /dispositivos/:id/editar, /dispositivos/:id/baja y
      // /dispositivos/:id/reemplazo -> ficha; el resto (nuevo, importar,
      // etiquetas, :id) -> lista. La ficha de un equipo de red vuelve a
      // Red: eso depende de datos en runtime (es_red), la pantalla lo
      // resuelve con un override.
      if (b === 'editar' || b === 'baja' || b === 'reemplazo') {
        return { to: `/dispositivos/${a}`, etiqueta: 'Volver' }
      }
      if (HERRAMIENTAS_DE_INVENTARIO.has(ruta)) return PUERTA_INVENTARIO
      return { to: '/dispositivos', etiqueta: 'Equipos' }
    }
    case 'ubicaciones': {
      if (b === 'editar') return { to: `/ubicaciones/${a}`, etiqueta: 'Volver' }
      return { to: '/ubicaciones', etiqueta: 'Ubicaciones' }
    }
    case 'personas': {
      // Editar, asignar un equipo y retirar (tarea 266) son tareas sobre
      // la persona: vuelven a su ficha.
      if (b === 'editar' || b === 'asignar' || b === 'retirar') return { to: `/personas/${a}`, etiqueta: 'Volver' }
      return { to: '/personas', etiqueta: 'Personas' }
    }
    case 'referencia': {
      // Editar una ficha sube a la ficha; crear y la ficha misma suben
      // a la lista (regla 13 de REGLAS.md).
      if (b === 'editar') return { to: `/referencia/${a}`, etiqueta: 'Volver' }
      return { to: '/referencia', etiqueta: 'Centro de consulta' }
    }
    case 'boveda': {
      if (b === 'editar') return { to: `/boveda/${a}`, etiqueta: 'Volver' }
      return { to: '/boveda', etiqueta: 'Bóveda' }
    }
    case 'diagnostico':
      // RESOLUCIÓN GUIADA (tarea 263): el recorrido en ejecución
      // (/diagnostico/:id) cuelga de Resolver, que es por donde se entra a
      // resolver algo; la lista, crear, editar, sugerencias y estadísticas
      // son la administración y vuelven a la lista de diagnósticos (Más).
      if (esRecorridoEnEjecucion(ruta)) return { to: '/', etiqueta: 'Resolver' }
      return { to: '/diagnostico', etiqueta: 'Diagnósticos' }
    case 'red':
      // La topología de un equipo (topologia/:id) sube al mapa general,
      // y este a Red. La lista de equipos (red/equipos) también sube a
      // Red: desde la tarea 204 la raíz de la pestaña es el recorrido
      // por nodos y la lista cuelga de ella (hallazgo M-018).
      if (a === 'topologia' && b) return { to: '/red/topologia', etiqueta: 'Topología' }
      return { to: '/red', etiqueta: 'Red' }
    case 'cuenta':
      // /cuenta/seguridad -> Ajustes (/cuenta ya lo cubre RAICES_NO_TAB).
      // Desde la tarea 268 la pantalla se llama "Ajustes".
      return { to: '/cuenta', etiqueta: 'Ajustes' }
    case 'inventario':
      // /inventario/estados -> la puerta de inventario (tarea 268).
      return PUERTA_INVENTARIO
    default:
      return { to: '/', etiqueta: 'Resolver' }
  }
}

/**
 * Texto de la ruta de vuelta para la barra de tarea (nivel 3 del chasis,
 * tarea 185). Devuelve null cuando la jerarquía solo sabe decir "Volver":
 * editar y ejecutar suben a la ficha de una entidad cuyo nombre depende
 * de datos en runtime, así que ahí la pantalla debe escribir el suyo.
 * La regla R19 pide que quien quita la barra de pestañas ponga algo que
 * oriente, y "Volver" no orienta.
 */
export function vueltaDeTarea(pathname: string): string | null {
  const padre = padreDe(pathname)
  if (!padre || padre.etiqueta === 'Volver') return null
  return padre.etiqueta
}
