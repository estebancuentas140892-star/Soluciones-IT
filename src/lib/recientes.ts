import { db, type Reciente } from './db'
// Unica dependencia de esta capa hacia una funcionalidad: el nombre de
// cada clase de ficha del Centro de consulta ("Herramienta", "Comando").
// Se importa en vez de copiarlo para que un resultado reciente y el
// mismo resultado en el buscador no puedan llamarse distinto.
import { esTipoConocido, INFO_TIPO } from '../features/referencia/referencias'

// Registro local de las ultimas fichas abiertas, para la seccion
// "Recientes" de la pantalla de Inicio. No se sincroniza: cada tecnico
// ve sus propios recientes.
//
// NUNCA entra aqui una credencial ni un campo protegido (ver `Reciente`
// en db.ts): lo que la boveda protege no puede reaparecer como un
// nombre suelto en la portada.

const MAX_RECIENTES = 20

export interface ElementoReciente {
  clave: string
  tipo: Reciente['tipo']
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
    const elemento = await resolverVisita(visita)
    if (elemento) elementos.push(elemento)
  }

  return elementos
}

async function resolverVisita(visita: Reciente): Promise<ElementoReciente | null> {
  const base = { clave: visita.clave, tipo: visita.tipo }

  if (visita.tipo === 'articulo') {
    const articulo = await db.articulos.get(visita.entidadId)
    if (!articulo || articulo.eliminadoEn) return null
    const categoria = await db.categorias.get(articulo.categoriaId)
    return {
      ...base,
      titulo: articulo.titulo,
      subtitulo: categoria?.nombre ?? 'Solución',
      ruta: `/soluciones/${articulo.categoriaId}/${articulo.id}`,
    }
  }

  if (visita.tipo === 'diagnostico') {
    const diagnostico = await db.diagnosticos.get(visita.entidadId)
    if (!diagnostico || diagnostico.eliminadoEn) return null
    const categoria = await db.categorias.get(diagnostico.categoriaId)
    return {
      ...base,
      titulo: diagnostico.titulo,
      subtitulo: [categoria?.nombre, 'Diagnóstico'].filter(Boolean).join(' · '),
      ruta: `/diagnostico/${diagnostico.id}`,
    }
  }

  if (visita.tipo === 'referencia') {
    const referencia = await db.referencias.get(visita.entidadId)
    // Un tipo que esta version no conoce (lo escribio una version mas
    // nueva) no se sabe nombrar: se omite, igual que en el buscador.
    if (!referencia || referencia.eliminadoEn || !esTipoConocido(referencia.tipo)) return null
    return {
      ...base,
      titulo: referencia.titulo,
      subtitulo: [INFO_TIPO[referencia.tipo].etiqueta, referencia.categoria].filter(Boolean).join(' · '),
      ruta: `/referencia/${referencia.id}`,
    }
  }

  const dispositivo = await db.dispositivos.get(visita.entidadId)
  if (!dispositivo || dispositivo.eliminadoEn) return null
  return {
    ...base,
    titulo: dispositivo.nombre,
    subtitulo: [dispositivo.marca, dispositivo.ubicacion].filter(Boolean).join(' · ') || 'Dispositivo',
    ruta: `/dispositivos/${dispositivo.id}`,
  }
}
