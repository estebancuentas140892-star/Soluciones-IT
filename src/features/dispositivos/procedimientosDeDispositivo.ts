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
