import { db, type Reciente } from './db'

// Registro local de los ultimos articulos y dispositivos abiertos,
// para la seccion "Recientes" de la pantalla de Inicio. No se
// sincroniza: cada tecnico ve sus propios recientes.

const MAX_RECIENTES = 20

export interface ElementoReciente {
  clave: string
  titulo: string
  subtitulo: string
  ruta: string
}

export async function registrarVisita(tipo: Reciente['tipo'], entidadId: string): Promise<void> {
  await db.recientes.put({
    clave: `${tipo}:${entidadId}`,
    tipo,
    entidadId,
    visitadoEn: new Date().toISOString(),
  })

  const total = await db.recientes.count()
  if (total > MAX_RECIENTES) {
    const sobrantes = await db.recientes
      .orderBy('visitadoEn')
      .limit(total - MAX_RECIENTES)
      .toArray()
    await db.recientes.bulkDelete(sobrantes.map((r) => r.clave))
  }
}

// Devuelve los recientes mas nuevos primero, ya resueltos a titulo y
// ruta. Las fichas eliminadas (o que ya no existen) se omiten.
export async function obtenerRecientes(limite = 8): Promise<ElementoReciente[]> {
  const visitas = await db.recientes.orderBy('visitadoEn').reverse().toArray()
  const elementos: ElementoReciente[] = []

  for (const visita of visitas) {
    if (elementos.length >= limite) break

    if (visita.tipo === 'articulo') {
      const articulo = await db.articulos.get(visita.entidadId)
      if (!articulo || articulo.eliminadoEn) continue
      const categoria = await db.categorias.get(articulo.categoriaId)
      elementos.push({
        clave: visita.clave,
        titulo: articulo.titulo,
        subtitulo: categoria?.nombre ?? 'Solución',
        ruta: `/soluciones/${articulo.categoriaId}/${articulo.id}`,
      })
    } else {
      const dispositivo = await db.dispositivos.get(visita.entidadId)
      if (!dispositivo || dispositivo.eliminadoEn) continue
      elementos.push({
        clave: visita.clave,
        titulo: dispositivo.nombre,
        subtitulo: [dispositivo.marca, dispositivo.ubicacion].filter(Boolean).join(' · ') || 'Dispositivo',
        ruta: `/dispositivos/${dispositivo.id}`,
      })
    }
  }

  return elementos
}
