#!/usr/bin/env node
// Reporte de solo lectura: compara el bucket de Storage 'adjuntos' contra
// las referencias reales que la app conoce (tabla adjuntos + procedimiento
// de cada articulo + foto de cada dispositivo) y lista los archivos que
// sobran, sin borrar nada. Ver tarea 101 en TAREAS_ARCHIVO.md.
//
// Este script NUNCA llama a storage.remove(): solo lee y reporta. Decidir
// si vale la pena borrar los huerfanos (y borrarlos, a mano o en un script
// aparte) es un paso del usuario, con el reporte en la mano.
//
// Variables de entorno requeridas (las mismas credenciales de cualquier
// tecnico del equipo, o las del usuario de respaldo de RESPALDO.md):
//   SUPABASE_URL
//   SUPABASE_ANON_KEY
//   SUPABASE_EMAIL
//   SUPABASE_PASSWORD
//
// Uso: node scripts/huerfanos-storage.mjs

import { createClient } from '@supabase/supabase-js'

const BUCKET = 'adjuntos'
const TAMANO_PAGINA = 1000

function variableRequerida(nombre) {
  const valor = process.env[nombre]
  if (!valor) {
    console.error(`Falta la variable de entorno ${nombre}. Ver el encabezado de este script.`)
    process.exit(1)
  }
  return valor
}

const SUPABASE_URL = variableRequerida('SUPABASE_URL')
const SUPABASE_ANON_KEY = variableRequerida('SUPABASE_ANON_KEY')
const SUPABASE_EMAIL = variableRequerida('SUPABASE_EMAIL')
const SUPABASE_PASSWORD = variableRequerida('SUPABASE_PASSWORD')

// Todas las filas de una tabla, paginando (mismo patron que
// scripts/respaldo-supabase.sh): un equipo de 5 tecnicos no tiene miles de
// filas, pero no hay que asumirlo.
async function todasLasFilas(supabase, tabla, columnas) {
  const filas = []
  let desde = 0
  for (;;) {
    const { data, error } = await supabase
      .from(tabla)
      .select(columnas)
      .range(desde, desde + TAMANO_PAGINA - 1)
    if (error) throw new Error(`Error leyendo ${tabla}: ${error.message}`)
    filas.push(...data)
    if (data.length < TAMANO_PAGINA) break
    desde += TAMANO_PAGINA
  }
  return filas
}

// Referencias de Storage que aparecen dentro del JSON `procedimiento` de un
// articulo: portada, la galeria de cada paso y las imagenes intercaladas en
// los bloques. Incluye el campo `imagen` (string) del modelo viejo, anterior
// a la migracion a `adjuntos` (procedimiento.ts, normalizarProcedimiento):
// una fila sin migrar en la base real no debe reportarse como huerfana.
function referenciasDeProcedimiento(procedimiento) {
  const referencias = []
  if (!procedimiento || typeof procedimiento !== 'object') return referencias

  if (procedimiento.portada?.referencia) referencias.push(procedimiento.portada.referencia)
  if (typeof procedimiento.imagen === 'string' && procedimiento.imagen !== '') {
    referencias.push(procedimiento.imagen)
  }
  for (const paso of procedimiento.pasos ?? []) {
    for (const adjunto of paso.adjuntos ?? []) {
      if (adjunto?.referencia) referencias.push(adjunto.referencia)
    }
    for (const bloque of paso.bloques ?? []) {
      if (bloque?.adjunto?.referencia) referencias.push(bloque.adjunto.referencia)
    }
  }
  return referencias
}

// Todas las referencias de Storage que la app conoce hoy: la tabla
// `adjuntos`, el procedimiento de cada articulo y la foto de cada
// dispositivo. Esto ultimo es MAS completo que `referenciasParaOffline` de
// src/lib/adjuntosOffline.ts, que no incluye `dispositivos.foto` (hueco
// anotado aparte en TAREAS.md, tarea 114: ese hueco significa que las fotos
// de dispositivo hoy no entran al cache de "Descargar todo para offline").
// Solo cuenta filas vivas (eliminado_en null): una fila borrada logicamente
// ya no es un uso real, mismo criterio que el resto de la app.
async function referenciasReales(supabase) {
  const referencias = new Set()

  const adjuntos = await todasLasFilas(supabase, 'adjuntos', 'referencia,eliminado_en')
  for (const fila of adjuntos) {
    if (!fila.eliminado_en && fila.referencia) referencias.add(fila.referencia)
  }

  const articulos = await todasLasFilas(supabase, 'articulos', 'procedimiento,eliminado_en')
  for (const fila of articulos) {
    if (fila.eliminado_en) continue
    for (const referencia of referenciasDeProcedimiento(fila.procedimiento)) referencias.add(referencia)
  }

  const dispositivos = await todasLasFilas(supabase, 'dispositivos', 'foto,eliminado_en')
  for (const fila of dispositivos) {
    if (!fila.eliminado_en && fila.foto?.referencia) referencias.add(fila.foto.referencia)
  }

  return referencias
}

// Recorre el bucket completo (Storage no tiene un listado recursivo nativo:
// list() solo da un nivel por llamada). Una entrada sin `metadata` es una
// carpeta (se explora); con `metadata` es un archivo (se reporta con su
// ruta completa y su tamaño).
async function archivosDelBucket(supabase, prefijo = '') {
  const archivos = []
  let desde = 0
  for (;;) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(prefijo, { limit: TAMANO_PAGINA, offset: desde, sortBy: { column: 'name', order: 'asc' } })
    if (error) throw new Error(`Error listando "${prefijo}" en el bucket ${BUCKET}: ${error.message}`)

    for (const entrada of data) {
      const ruta = prefijo ? `${prefijo}/${entrada.name}` : entrada.name
      if (entrada.metadata) {
        archivos.push({ ruta, bytes: entrada.metadata.size ?? 0 })
      } else {
        archivos.push(...(await archivosDelBucket(supabase, ruta)))
      }
    }

    if (data.length < TAMANO_PAGINA) break
    desde += TAMANO_PAGINA
  }
  return archivos
}

function formatoBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

async function main() {
  // Sin persistencia ni auto-refresco: es un script de una sola pasada, y
  // el temporizador de refresco de sesion que supabase-js deja activo por
  // defecto impide que el proceso termine solo al final de main().
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error: errorSesion } = await supabase.auth.signInWithPassword({
    email: SUPABASE_EMAIL,
    password: SUPABASE_PASSWORD,
  })
  if (errorSesion) {
    throw new Error(`No se pudo iniciar sesión: ${errorSesion.message}`)
  }

  console.log('Leyendo referencias reales (adjuntos, procedimientos, fotos de dispositivo)...')
  const referencias = await referenciasReales(supabase)
  console.log(`  ${referencias.size} referencias encontradas.`)

  console.log(`Listando el bucket "${BUCKET}" (puede tardar según la cantidad de archivos)...`)
  const archivos = await archivosDelBucket(supabase)
  console.log(`  ${archivos.length} archivos en Storage.`)

  const huerfanos = archivos.filter((a) => !referencias.has(a.ruta))
  const bytesHuerfanos = huerfanos.reduce((total, a) => total + a.bytes, 0)

  console.log('')
  console.log('=== Reporte (solo lectura, no se borró nada) ===')
  if (huerfanos.length === 0) {
    console.log('Sin archivos huérfanos: todo lo que hay en Storage tiene al menos una fila que lo usa.')
  } else {
    console.log(`${huerfanos.length} archivo(s) huérfano(s), ${formatoBytes(bytesHuerfanos)} en total:`)
    for (const h of huerfanos) console.log(`  ${h.ruta}  (${formatoBytes(h.bytes)})`)
    console.log('')
    console.log('Ningún archivo fue borrado. Decidir si vale la pena limpiarlos es un paso aparte.')
  }

  await supabase.auth.signOut()
}

main().catch((error) => {
  console.error(error.message)
  // process.exitCode en vez de process.exit(): forzar la terminacion aqui
  // (con handles nativos de supabase-js todavia cerrandose de un intento de
  // login fallido) choca el proceso en este entorno (assertion de libuv,
  // "UV_HANDLE_CLOSING"). exitCode deja que el bucle de eventos drene solo.
  process.exitCode = 1
})
