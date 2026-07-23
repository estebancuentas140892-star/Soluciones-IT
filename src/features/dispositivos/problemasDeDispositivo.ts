import type { Articulo } from '../../lib/db'

// Problemas frecuentes que afectan a un equipo concreto (tarea 39,
// fase 1): el inverso del vínculo `dispositivosAfectados` (tarea 38),
// que hoy solo se ve del artículo hacia el equipo. Aquí, desde la
// ficha del equipo, se listan las incidencias que lo mencionan. Solo
// incidencias publicadas (un borrador u obsoleto no es contenido
// oficial, mismo criterio que el buscador). Lógica pura para poder
// probarla sin navegador.
export function problemasDeDispositivo(articulos: Articulo[], dispositivoId: string): Articulo[] {
  return articulos
    .filter(
      (a) =>
        !a.eliminadoEn &&
        a.tipo === 'problema_frecuente' &&
        (a.estado ?? 'publicado') === 'publicado' &&
        (a.dispositivosAfectados ?? []).some((d) => d.id === dispositivoId),
    )
    .sort((a, b) => a.titulo.localeCompare(b.titulo, 'es', { numeric: true }))
}

// Incidencias aplicables por CATEGORIA (hallazgo H1): las incidencias
// publicadas de la misma categoria del equipo, aunque no lo mencionen en
// dispositivosAfectados. Mismo criterio que procedimientosDeCategoria;
// se excluyen las ya listadas como especificas del equipo. Derivada, sin
// esquema. Logica pura.
export function problemasDeCategoria(
  articulos: Articulo[],
  categoriaId: string,
  idsExcluidos: ReadonlySet<string>,
): Articulo[] {
  return articulos
    .filter(
      (a) =>
        !a.eliminadoEn &&
        a.tipo === 'problema_frecuente' &&
        (a.estado ?? 'publicado') === 'publicado' &&
        a.categoriaId === categoriaId &&
        !idsExcluidos.has(a.id),
    )
    .sort((a, b) => a.titulo.localeCompare(b.titulo, 'es', { numeric: true }))
}
