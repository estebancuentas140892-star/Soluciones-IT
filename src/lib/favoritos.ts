import { db, type Favorito } from './db'

// Favoritos del tecnico (fase J1 de la jornada): fichas fijadas a mano
// que Inicio muestra siempre, a diferencia de "Recientes" que se
// desplaza con cada consulta. No se sincroniza: cada tecnico arma su
// propia lista (decision D1). Solo se guarda la referencia (tipo + id);
// titulo, subtitulo y ruta se resuelven en vivo contra las fichas, asi
// un cambio de nombre se refleja solo y una ficha eliminada se omite.

export type TipoFavorito = Favorito['tipo']

export interface ElementoFavorito {
  clave: string
  tipo: TipoFavorito
  titulo: string
  subtitulo: string
  ruta: string
}

export async function esFavorito(tipo: TipoFavorito, entidadId: string): Promise<boolean> {
  return (await db.favoritos.get(`${tipo}:${entidadId}`)) !== undefined
}

// Marca o desmarca segun el estado actual. Devuelve el estado nuevo.
export async function alternarFavorito(tipo: TipoFavorito, entidadId: string): Promise<boolean> {
  const clave = `${tipo}:${entidadId}`
  const existente = await db.favoritos.get(clave)
  if (existente) {
    await db.favoritos.delete(clave)
    return false
  }
  await db.favoritos.put({ clave, tipo, entidadId, marcadoEn: new Date().toISOString() })
  return true
}

// Devuelve los favoritos ya resueltos a titulo y ruta, el marcado mas
// recientemente primero. Las fichas eliminadas (o que ya no existen)
// se omiten sin borrar la marca: si la ficha reaparece al sincronizar,
// el favorito vuelve solo.
export async function obtenerFavoritos(): Promise<ElementoFavorito[]> {
  const marcas = await db.favoritos.orderBy('marcadoEn').reverse().toArray()
  const elementos: ElementoFavorito[] = []

  for (const marca of marcas) {
    if (marca.tipo === 'articulo') {
      const articulo = await db.articulos.get(marca.entidadId)
      if (!articulo || articulo.eliminadoEn) continue
      const categoria = await db.categorias.get(articulo.categoriaId)
      elementos.push({
        clave: marca.clave,
        tipo: marca.tipo,
        titulo: articulo.titulo,
        subtitulo: categoria?.nombre ?? 'Solución',
        ruta: `/soluciones/${articulo.categoriaId}/${articulo.id}`,
      })
    } else if (marca.tipo === 'dispositivo') {
      const dispositivo = await db.dispositivos.get(marca.entidadId)
      if (!dispositivo || dispositivo.eliminadoEn) continue
      elementos.push({
        clave: marca.clave,
        tipo: marca.tipo,
        titulo: dispositivo.nombre,
        subtitulo: [dispositivo.marca, dispositivo.ubicacion].filter(Boolean).join(' · ') || 'Dispositivo',
        ruta: `/dispositivos/${dispositivo.id}`,
      })
    } else {
      const diagnostico = await db.diagnosticos.get(marca.entidadId)
      if (!diagnostico || diagnostico.eliminadoEn) continue
      const categoria = await db.categorias.get(diagnostico.categoriaId)
      elementos.push({
        clave: marca.clave,
        tipo: marca.tipo,
        titulo: diagnostico.titulo,
        subtitulo: categoria?.nombre ?? 'Diagnóstico',
        ruta: `/diagnostico/${diagnostico.id}`,
      })
    }
  }

  return elementos
}
