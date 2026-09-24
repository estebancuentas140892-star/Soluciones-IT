#!/usr/bin/env node
// Comprueba el BUILD del portal de asistencia (tarea 258), despues de
// `npm run build`: lo que el navegador del computador atendido descarga
// de verdad. `src/asistencia/aislamiento.test.ts` vigila el codigo
// fuente; esto vigila lo que sale del empaquetador, que puede juntar
// modulos por su cuenta (el 2026-09-24 el ayudante de precarga de Vite
// cayo dentro del trozo de Supabase y el portal descargaba supabase-js
// entero sin importarlo).
//
// Uso: node scripts/verificar-portal.mjs [carpeta del build, por defecto dist]

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const dist = process.argv[2] ?? 'dist'
const fallos = []

function leer(ruta) {
  return readFileSync(join(dist, ruta), 'utf8')
}

const html = leer('asistencia.html')

// 1. Lo que la pagina carga, y lo que eso importa a su vez.
const iniciales = [...html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.js)"/g)].map((m) => m[1])
const visitados = new Set()
const pendientes = [...iniciales]
while (pendientes.length > 0) {
  const archivo = pendientes.pop()
  if (visitados.has(archivo)) continue
  visitados.add(archivo)
  if (!existsSync(join(dist, archivo))) {
    fallos.push(`falta el archivo ${archivo}`)
    continue
  }
  const codigo = leer(archivo)
  for (const [, relativo] of codigo.matchAll(/(?:from|import)\s*["']\.\/([^"']+\.js)["']/g)) {
    pendientes.push(`assets/${relativo}`)
  }
}

const PROHIBIDOS = [
  [/^assets\/supabase-/, 'el cliente de Supabase'],
  [/^assets\/dexie-/, 'Dexie'],
  [/^assets\/index-/, 'la entrada de la app'],
  [/^assets\/Chasis-/, 'el chasis de la app'],
  [/^assets\/workbox-/, 'el service worker'],
]
for (const archivo of visitados) {
  for (const [patron, que] of PROHIBIDOS) {
    if (patron.test(archivo)) fallos.push(`el portal carga ${que} (${archivo})`)
  }
}

// 2. Ni manifiesto (no se ofrece "Instalar") ni registro del service worker.
if (/rel="manifest"/.test(html)) fallos.push('asistencia.html enlaza el manifiesto de la app')
if (/registerSW|serviceWorker\.register/.test(html)) fallos.push('asistencia.html registra el service worker')

// 3. El service worker de la app no precachea el portal y deja pasar
//    /asistencia a la red.
const sw = leer('sw.js')
if (/url:"asistencia\.html"|url:"assets\/asistencia-/.test(sw)) fallos.push('sw.js precachea el portal')
if (!/asistencia/.test(sw)) fallos.push('sw.js no excluye /asistencia de su navegacion')

const total = [...visitados].reduce((suma, archivo) => suma + readFileSync(join(dist, archivo)).length, 0)
console.log(`Portal: ${visitados.size} archivos JS, ${(total / 1024).toFixed(1)} KiB sin comprimir.`)
for (const archivo of [...visitados].sort()) console.log(`  ${archivo}`)

if (fallos.length > 0) {
  console.error('\nFALLOS:')
  for (const fallo of fallos) console.error(`  - ${fallo}`)
  process.exit(1)
}
console.log('\nOK: el portal no carga la app, ni Supabase, ni Dexie, ni el service worker.')
