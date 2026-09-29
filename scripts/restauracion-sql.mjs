#!/usr/bin/env node
// Convierte un respaldo ya descifrado (la carpeta con manifiesto.json y un
// JSON por tabla que deja scripts/respaldo-supabase.sh) en un script SQL que
// vuelve a cargar esas filas. Guía completa y simulacro de restauración en
// supabase/RESPALDO.md.
//
// Uso:
//   node scripts/restauracion-sql.mjs <carpeta> > restauracion.sql
//     Recupera en el proyecto de siempre lo que falte: cada fila entra con
//     "on conflict (id) do nothing", así que lo que ya existe no se pisa.
//   node scripts/restauracion-sql.mjs --proyecto-nuevo <carpeta> > restauracion.sql
//     Carga el respaldo entero en un proyecto recién creado con
//     supabase/schema.sql. Antes vacía las tablas que va a cargar, porque el
//     esquema siembra categorías (con ids al azar y nombre único) y
//     referencias, y el respaldo trae las del equipo, quizá editadas. Si el
//     proyecto ya tiene datos propios, se detiene sin tocar nada.
//
// El SQL corre en una sola transacción con session_replication_role =
// replica, igual que la restauración oficial de Supabase: sin triggers, así
// que autor, updated_at y recibido_en quedan tal como estaban (el sello de la
// tarea 271 los reescribiría), y una referencia de autoría a una cuenta que el
// proyecto de destino no tiene no frena la carga.
//
// perfiles no se carga: cada perfil nace al crear su cuenta en Authentication
// (trigger trg_crear_perfil), y un perfil sin cuenta no sirve para nada.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const NOMBRE_VALIDO = /^[a-z_][a-z0-9_]*$/
const SIN_CARGA = new Set(['perfiles'])
// Las que supabase/schema.sql siembra: un proyecto recién creado ya las trae
// con filas, y no por eso tiene datos del equipo.
const SEMBRADAS = new Set(['categorias', 'referencias'])

function leerJson(ruta) {
  try {
    return JSON.parse(readFileSync(ruta, 'utf8'))
  } catch (error) {
    throw new Error(`No se pudo leer ${ruta}: ${error.message}`)
  }
}

function comprobarNombre(nombre, que) {
  if (!NOMBRE_VALIDO.test(nombre)) {
    throw new Error(`Nombre de ${que} no válido: ${JSON.stringify(nombre)}`)
  }
}

// Comillas de dólar que no aparecen dentro de los datos.
function delimitador(texto) {
  let marca = '$respaldo$'
  for (let n = 1; texto.includes(marca); n++) marca = `$respaldo${n}$`
  return marca
}

function sqlDeRestauracion(carpeta, proyectoNuevo) {
  const manifiesto = leerJson(join(carpeta, 'manifiesto.json'))
  const tablas = Object.entries(manifiesto.tablas ?? {})
  if (tablas.length === 0) throw new Error('El manifiesto no lista ninguna tabla.')

  const cargas = []
  const omitidas = []
  for (const [tabla, enRespaldo] of tablas) {
    comprobarNombre(tabla, 'tabla')
    const filas = leerJson(join(carpeta, `${tabla}.json`))
    if (!Array.isArray(filas)) throw new Error(`${tabla}.json no es una lista de filas.`)
    if (filas.length !== enRespaldo) {
      throw new Error(`${tabla}.json trae ${filas.length} filas y el manifiesto dice ${enRespaldo}: el respaldo está incompleto o alterado.`)
    }
    if (SIN_CARGA.has(tabla)) omitidas.push(tabla)
    else cargas.push({ tabla, filas })
  }

  // La fecha va dentro de un comentario: solo se dejan los caracteres de una
  // fecha ISO, para que un salto de línea no la saque del comentario.
  const fecha = String(manifiesto.fecha ?? '').replace(/[^0-9TZ:.-]/g, '') || '(sin fecha)'
  const lineas = [
    `-- Restauración del respaldo del ${fecha}${proyectoNuevo ? ' en un proyecto nuevo' : ''}.`,
    '-- Generado por scripts/restauracion-sql.mjs. Lleva los datos del respaldo:',
    '-- no se sube al repositorio y se borra al terminar.',
    'begin;',
    'set local session_replication_role = replica;',
  ]
  if (proyectoNuevo) {
    const propias = cargas.filter(({ tabla }) => !SEMBRADAS.has(tabla))
    const hayDatos = propias.map(({ tabla }) => `exists (select 1 from public.${tabla})`).join('\n    or ') || 'false'
    lineas.push(
      'do $comprobacion$',
      'begin',
      `  if ${hayDatos} then`,
      "    raise exception 'Este proyecto ya tiene datos propios: --proyecto-nuevo solo se usa en un proyecto recién creado con supabase/schema.sql. No se tocó nada.';",
      '  end if;',
      'end',
      '$comprobacion$;',
      ...cargas.map(({ tabla }) => `delete from public.${tabla};`),
    )
  }
  for (const tabla of omitidas) {
    lineas.push(`-- ${tabla}: no se carga (ver la cabecera de scripts/restauracion-sql.mjs).`)
  }
  for (const { tabla, filas } of cargas) {
    if (filas.length === 0) {
      lineas.push(`-- ${tabla}: sin filas.`)
      continue
    }
    // Lista explícita de columnas: una columna que el respaldo no trae
    // (creada después) toma su valor por defecto en vez de un null.
    const columnas = [...new Set(filas.flatMap((fila) => Object.keys(fila)))]
    columnas.forEach((columna) => comprobarNombre(columna, `columna de ${tabla}`))
    const lista = columnas.map((columna) => `"${columna}"`).join(', ')
    const datos = JSON.stringify(filas)
    const marca = delimitador(datos)
    lineas.push(
      `insert into public.${tabla} (${lista})`,
      `select ${lista} from jsonb_populate_recordset(null::public.${tabla}, ${marca}${datos}${marca}::jsonb)`,
      'on conflict (id) do nothing;',
    )
  }
  lineas.push('commit;', '', '-- Filas de cada tabla después de la carga, frente a las del respaldo:')
  lineas.push(
    cargas
      .map(({ tabla, filas }) => `select '${tabla}' as tabla, count(*) as filas, ${filas.length} as en_respaldo from public.${tabla}`)
      .join('\nunion all\n') + ';',
  )
  return lineas.join('\n') + '\n'
}

const argumentos = process.argv.slice(2)
const proyectoNuevo = argumentos.includes('--proyecto-nuevo')
const carpeta = argumentos.find((argumento) => !argumento.startsWith('--'))
if (!carpeta) {
  console.error('Uso: node scripts/restauracion-sql.mjs [--proyecto-nuevo] <carpeta del respaldo descifrado> > restauracion.sql')
  process.exit(1)
}
try {
  process.stdout.write(sqlDeRestauracion(carpeta, proyectoNuevo))
} catch (error) {
  console.error(error.message)
  process.exit(1)
}
