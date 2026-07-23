import type { Articulo } from '../../lib/db'

// Procedimientos de este equipo (fase N2, sin esquema): el inverso de
// "Equipos donde aplica" para articulos que NO son incidencias (esas
// ya tienen su propio inverso en problemasDeDispositivo.ts). Mismo
// criterio de solo contenido publicado que el resto de la app. Logica
// pura para poder probarla sin navegador.
export function procedimientosDeDispositivo(articulos: Articulo[], dispositivoId: string): Articulo[] {
  return articulos
    .filter(
      (a) =>
        !a.eliminadoEn &&
        a.tipo !== 'problema_frecuente' &&
        (a.estado ?? 'publicado') === 'publicado' &&
        (a.dispositivosAfectados ?? []).some((d) => d.id === dispositivoId),
    )
    .sort((a, b) => a.titulo.localeCompare(b.titulo, 'es', { numeric: true }))
}

// Procedimientos aplicables por CATEGORIA (hallazgo H1 de
// AUDITORIA_FLUJO_INSTALACION.md): un procedimiento generico ("Instalar
// impresora de red") debe aparecer en la ficha de CADA equipo de esa
// categoria sin vincularlo uno por uno, igual que ya se ofrece el
// diagnostico por categoria. Es una consulta DERIVADA, sin esquema:
// tanto el articulo como el dispositivo ya llevan categoria_id. Se
// excluyen los ya listados como especificos del equipo (idsExcluidos)
// para no repetirlos. Logica pura para poder probarla sin navegador.
export function procedimientosDeCategoria(
  articulos: Articulo[],
  categoriaId: string,
  idsExcluidos: ReadonlySet<string>,
): Articulo[] {
  return articulos
    .filter(
      (a) =>
        !a.eliminadoEn &&
        a.tipo !== 'problema_frecuente' &&
        (a.estado ?? 'publicado') === 'publicado' &&
        a.categoriaId === categoriaId &&
        !idsExcluidos.has(a.id),
    )
    .sort((a, b) => a.titulo.localeCompare(b.titulo, 'es', { numeric: true }))
}
