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

// Pestañas de la barra inferior: son raíces de su pila, no muestran
// "Volver" (se navega entre ellas por la barra, no retrocediendo).
// `/mas` (tarea 182) reemplaza a `/boveda` como quinta pestaña móvil;
// `/boveda` sigue siendo raíz aparte (pestaña de escritorio, y puerta
// destacada dentro de "Más" en móvil), así que se queda en el set.
const TABS = new Set(['/', '/soluciones', '/dispositivos', '/red', '/boveda', '/mas'])

// Raíces que no son pestañas pero se alcanzan desde otra sección: su
// "Volver" sube a esa sección de origen.
const RAICES_NO_TAB: Record<string, Padre> = {
  '/diagnostico': { to: '/', etiqueta: 'Inicio' },
  '/escaner': { to: '/', etiqueta: 'Inicio' },
  // Antes subían a Equipos (de donde se alcanzaban por el menú "···").
  // Desde la tarea 182 su puerta principal es "Más" (regla R15), así
  // que ese es su padre real: subir a Equipos llevaría a una sección
  // que el técnico no visitó si llegó por Más (el mismo problema que
  // ya tenía este par, detectado en la auditoría de la tarea 179-182).
  '/ubicaciones': { to: '/mas', etiqueta: 'Más' },
  '/personas': { to: '/mas', etiqueta: 'Más' },
  '/cuenta': { to: '/', etiqueta: 'Inicio' },
}

// Devuelve la pantalla superior de `pathname`, o null si es una raíz
// (pestaña) que no debe mostrar "Volver". Solo necesita el pathname: los
// destinos que reponen un filtro (Soluciones) llevan el id en la propia
// ruta, así que se reconstruyen sin depender de la query entrante.
export function padreDe(pathname: string): Padre | null {
  const ruta = pathname !== '/' ? pathname.replace(/\/+$/, '') : '/'
  if (TABS.has(ruta)) return null
  if (ruta in RAICES_NO_TAB) return RAICES_NO_TAB[ruta]

  const seg = ruta.split('/').filter(Boolean)
  const [seccion, a, b, c] = seg

  switch (seccion) {
    case 'soluciones': {
      // a = categoriaId. Rutas bajo una categoría:
      //   /soluciones/:cat                 ficha de categoría  -> lista
      //   /soluciones/:cat/nuevo           crear artículo      -> lista + chip
      //   /soluciones/:cat/:art            ficha de artículo   -> lista + chip
      //   /soluciones/:cat/:art/editar     editar artículo     -> ficha
      //   /soluciones/:cat/:art/ejecutar   asistente           -> ficha
      const lista: Padre = { to: '/soluciones', etiqueta: 'Guías' }
      if (!a) return lista
      // La categoría es un FILTRO de la lista (decisión del usuario,
      // 2026-07-18): volver a un artículo o a crear repone su chip.
      const listaConChip: Padre = { to: `/soluciones?categoria=${a}`, etiqueta: 'Guías' }
      if (!b) return lista // ficha de categoría -> lista principal
      if (b === 'nuevo') return listaConChip
      if (!c) return listaConChip // ficha de artículo -> lista con su chip
      return { to: `/soluciones/${a}/${b}`, etiqueta: 'Volver' } // editar/ejecutar -> ficha
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
      return { to: '/dispositivos', etiqueta: 'Equipos' }
    }
    case 'ubicaciones': {
      if (b === 'editar') return { to: `/ubicaciones/${a}`, etiqueta: 'Volver' }
      return { to: '/ubicaciones', etiqueta: 'Ubicaciones' }
    }
    case 'personas': {
      if (b === 'editar') return { to: `/personas/${a}`, etiqueta: 'Volver' }
      return { to: '/personas', etiqueta: 'Personas' }
    }
    case 'boveda': {
      if (b === 'editar') return { to: `/boveda/${a}`, etiqueta: 'Volver' }
      return { to: '/boveda', etiqueta: 'Bóveda' }
    }
    case 'diagnostico':
      // nuevo, sugerencias, :id (asistente) y :id/editar vuelven a la lista.
      return { to: '/diagnostico', etiqueta: 'Diagnósticos' }
    case 'red':
      // Jerarquía de los mockups Nocturne: la topología de un equipo
      // (topologia/:id) sube al mapa general, y este a Red.
      if (a === 'topologia' && b) return { to: '/red/topologia', etiqueta: 'Topología' }
      return { to: '/red', etiqueta: 'Red' }
    case 'cuenta':
      // /cuenta/seguridad -> Mi cuenta (/cuenta ya lo cubre RAICES_NO_TAB).
      return { to: '/cuenta', etiqueta: 'Mi cuenta' }
    default:
      return { to: '/', etiqueta: 'Inicio' }
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
