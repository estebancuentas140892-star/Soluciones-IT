#!/usr/bin/env node
// Comprueba el PRECACHE del build (tarea 259), despues de `npm run build`.
//
// Importar (con `xlsx`) y Etiquetas (con `qrcode`) salen del precache y se
// guardan en tiempo de ejecucion la primera vez que se abren
// (vite.config.ts, `globIgnores` y `runtimeCaching`). Eso solo es seguro si
// ningun trozo precacheado los importa de forma ESTATICA: si alguno lo
// hiciera, la pantalla que lo usa dejaria de abrir sin conexion. Aqui se
// comprueba sobre el build real, que es donde el empaquetador decide que
// va en cada trozo:
//   1. los cuatro trozos existen y ninguno esta en el precache;
//   2. el cierre estatico de todo trozo precacheado esta precacheado;
//   3. lo que carga index.html esta precacheado;
//   4. sw.js guarda esos trozos al usarlos (CacheFirst, su propia cache).
//
// Uso: node scripts/verificar-precache.mjs [carpeta del build, por defecto dist]

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const dist = process.argv[2] ?? 'dist'
const FUERA = ['ImportarDispositivosPage', 'xlsx', 'EtiquetasPage', 'qrcode']
const fallos = []

const sw = readFileSync(join(dist, 'sw.js'), 'utf8')
const precache = new Set([...sw.matchAll(/url:"([^"]+)"/g)].map((m) => m[1]))
const trozos = readdirSync(join(dist, 'assets')).filter((f) => f.endsWith('.js'))
const tam = (archivo) => statSync(join(dist, archivo)).size

// 1. Los trozos que salen existen (si no, el patron quedo viejo) y no estan.
const fuera = []
for (const nombre of FUERA) {
  const suyos = trozos.filter((f) => f.startsWith(`${nombre}-`)).map((f) => `assets/${f}`)
  if (suyos.length === 0) fallos.push(`no hay trozo ${nombre}-*: el patron de globIgnores ya no corresponde al build`)
  for (const archivo of suyos) {
    fuera.push(archivo)
    if (precache.has(archivo)) fallos.push(`${archivo} sigue en el precache`)
  }
}

// 2. Cierre estatico de lo precacheado.
for (const archivo of precache) {
  if (!archivo.endsWith('.js') || !existsSync(join(dist, archivo))) continue
  const codigo = readFileSync(join(dist, archivo), 'utf8')
  for (const [, relativo] of codigo.matchAll(/(?:from|import)\s*["']\.\/([^"']+\.js)["']/g)) {
    const importado = `assets/${relativo}`
    if (!precache.has(importado)) fallos.push(`${archivo} importa de forma estatica ${importado}, que no esta en el precache`)
  }
}

// 3. El arranque.
const html = readFileSync(join(dist, 'index.html'), 'utf8')
for (const [, archivo] of html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.js)"/g)) {
  if (!precache.has(archivo)) fallos.push(`index.html carga ${archivo}, que no esta en el precache`)
}

// 4. La cache en tiempo de ejecucion.
if (!/herramientas-bajo-demanda/.test(sw) || !/CacheFirst/.test(sw)) {
  fallos.push('sw.js no guarda las herramientas al usarlas (falta la ruta CacheFirst de herramientas-bajo-demanda)')
}

const kib = (bytes) => `${(bytes / 1024).toFixed(1)} KiB`
const total = [...precache].filter((a) => existsSync(join(dist, a))).reduce((suma, a) => suma + tam(a), 0)
console.log(`Precache: ${precache.size} entradas, ${kib(total)}.`)
console.log(`Fuera del precache (se guardan al usarse): ${fuera.length} trozos, ${kib(fuera.reduce((s, a) => s + tam(a), 0))}.`)
for (const archivo of fuera.sort()) console.log(`  ${archivo} (${kib(tam(archivo))})`)

if (fallos.length > 0) {
  console.error('\nFALLOS:')
  for (const fallo of fallos) console.error(`  - ${fallo}`)
  process.exit(1)
}
console.log('\nOK: nada precacheado depende de lo que quedo fuera, y sw.js lo guarda al usarse.')
