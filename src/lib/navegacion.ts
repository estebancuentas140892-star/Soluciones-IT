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

// Pestañas de la barra inferior: son raíces de su pila, no muestran
// "Volver" (se navega entre ellas por la barra, no retrocediendo).
const TABS = new Set(['/', '/soluciones', '/dispositivos', '/red', '/boveda'])

// Raíces que no son pestañas pero se alcanzan desde otra sección: su
// "Volver" sube a esa sección de origen.
const RAICES_NO_TAB: Record<string, Padre> = {
  '/diagnostico': { to: '/', etiqueta: 'Inicio' },
  '/ubicaciones': { to: '/dispositivos', etiqueta: 'Dispositivos' },
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
      const lista: Padre = { to: '/soluciones', etiqueta: 'Soluciones' }
      if (!a) return lista
      // La categoría es un FILTRO de la lista (decisión del usuario,
      // 2026-07-18): volver a un artículo o a crear repone su chip.
      const listaConChip: Padre = { to: `/soluciones?categoria=${a}`, etiqueta: 'Soluciones' }
      if (!b) return lista // ficha de categoría -> lista principal
      if (b === 'nuevo') return listaConChip
      if (!c) return listaConChip // ficha de artículo -> lista con su chip
      return { to: `/soluciones/${a}/${b}`, etiqueta: 'Volver' } // editar/ejecutar -> ficha
    }
    case 'dispositivos': {
      // /dispositivos/:id/editar -> ficha; el resto (nuevo, importar,
      // etiquetas, :id) -> lista. La ficha de un equipo de red vuelve a
      // Red: eso depende de datos en runtime (es_red), la pantalla lo
      // resuelve con un override.
      if (b === 'editar') return { to: `/dispositivos/${a}`, etiqueta: 'Volver' }
      return { to: '/dispositivos', etiqueta: 'Dispositivos' }
    }
    case 'ubicaciones': {
      if (b === 'editar') return { to: `/ubicaciones/${a}`, etiqueta: 'Volver' }
      return { to: '/ubicaciones', etiqueta: 'Ubicaciones' }
    }
    case 'boveda': {
      if (b === 'editar') return { to: `/boveda/${a}`, etiqueta: 'Volver' }
      return { to: '/boveda', etiqueta: 'Bóveda' }
    }
    case 'diagnostico':
      // nuevo, sugerencias, :id (asistente) y :id/editar vuelven a la lista.
      return { to: '/diagnostico', etiqueta: 'Diagnósticos' }
    case 'red':
      // topologia y topologia/:id vuelven a Red.
      return { to: '/red', etiqueta: 'Red' }
    case 'cuenta':
      // /cuenta/seguridad -> Mi cuenta (/cuenta ya lo cubre RAICES_NO_TAB).
      return { to: '/cuenta', etiqueta: 'Mi cuenta' }
    default:
      return { to: '/', etiqueta: 'Inicio' }
  }
}
