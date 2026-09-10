import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { configTablas, TABLAS_SINCRONIZADAS, type TablaSincronizada } from './tablas'

// Guarda contra la deriva entre lo que la app SUBE y lo que el esquema
// remoto DEFINE (tarea 143).
//
// Por que existe: `aFilaRemota` manda todas las columnas declaradas en
// `configTablas`, y PostgREST rechaza la fila entera si una no existe
// en el servidor, dejando el cambio reintentandose para siempre en la
// cola. El 2026-07-22 el usuario vio ese error en produccion con
// `dispositivos.responsable`: la columna llevaba desde el principio en
// `configTablas` pero NUNCA estuvo en `supabase/schema.sql`, ni en el
// `create table` ni en un `alter table`. Una base creada desde ese
// archivo rechazaba toda escritura de dispositivos, y nada en el
// repositorio lo detectaba porque las pruebas solo miraban el lado
// TypeScript.
//
// Esta prueba lee el SQL real como texto (no ejecuta nada contra
// Supabase) y comprueba que cada columna configurada este definida.

const esquema = readFileSync('supabase/schema.sql', 'utf8').split('\r\n').join('\n')

// Columnas que `aFilaRemota` nunca envia pero que el esquema si define:
// las pone el servidor en cada escritura mediante trigger.
const COLUMNAS_DEL_SERVIDOR = ['updated_at', 'updated_by']

function bloqueCreateTable(tabla: string): string | null {
  const inicio = esquema.indexOf(`create table if not exists public.${tabla} (`)
  if (inicio < 0) return null
  return esquema.slice(inicio, esquema.indexOf('\n);', inicio))
}

function estaDefinida(tabla: string, columna: string): boolean {
  const create = bloqueCreateTable(tabla)
  if (create && new RegExp(`^\\s+${columna}\\s`, 'm').test(create)) return true
  return esquema.includes(`alter table public.${tabla} add column if not exists ${columna} `)
}

describe('schema.sql cubre todo lo que la app sincroniza', () => {
  it.each(TABLAS_SINCRONIZADAS)('la tabla %s existe en el esquema', (tabla) => {
    expect(bloqueCreateTable(tabla)).not.toBeNull()
  })

  it.each(TABLAS_SINCRONIZADAS)('todas las columnas configuradas de %s existen en el esquema', (tabla) => {
    const columnas = Object.values(configTablas[tabla as TablaSincronizada].campos)
    const faltantes = columnas.filter(
      (columna) => !COLUMNAS_DEL_SERVIDOR.includes(columna) && !estaDefinida(tabla, columna),
    )
    expect(faltantes).toEqual([])
  })

  // Una columna declarada `camposOpcionales` se omite del payload
  // cuando vale null, asi que NO debe tener tambien un valor por
  // defecto: ese default la haria viajar siempre y anularia la
  // proteccion.
  it.each(TABLAS_SINCRONIZADAS)('las columnas opcionales de %s no llevan valor por defecto', (tabla) => {
    const config = configTablas[tabla as TablaSincronizada]
    const conDefault = (config.camposOpcionales ?? []).filter((campo) => campo in config.porDefecto)
    expect(conDefault).toEqual([])
  })
})

// EL CONTENIDO INICIAL DE REFERENCIA TIENE QUE PODER APLICARSE DOS
// VECES (encargo del 2026-09-10, tarea 7: "migracion idempotente,
// identificadores estables, evitando duplicados").
//
// El archivo se aplica a mano en el SQL Editor y se vuelve a aplicar
// cada vez que hay un grupo de esquema nuevo, asi que un insert sin
// `on conflict` crearia 22 fichas repetidas en cada pasada. Esta
// prueba lee el SQL como texto, igual que las de arriba, y no ejecuta
// nada.
describe('contenido inicial de Referencia', () => {
  const inserts = esquema.split('insert into public.referencias').slice(1)

  it('siembra las 22 fichas del encargo con identificadores estables', () => {
    const ids = new Set(esquema.match(/2026090a-0000-4000-8000-[0-9a-f]{12}/g) ?? [])
    expect(ids.size).toBe(22)
  })

  it('cada insert de referencias es idempotente', () => {
    expect(inserts.length).toBeGreaterThan(0)
    for (const bloque of inserts) {
      expect(bloque).toContain('on conflict (id) do nothing')
    }
  })

  it('no siembra ninguna direccion IP real ni credenciales', () => {
    const bloque = esquema.slice(esquema.indexOf('5.1 Contenido inicial de Referencia'))
    // Una IPv4 literal en el contenido seria un dato interno filtrado;
    // los ejemplos usan marcadores entre corchetes.
    expect(bloque).not.toMatch(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/)
    expect(bloque.toLowerCase()).not.toContain('contraseña')
    expect(bloque.toLowerCase()).not.toContain('password')
  })
})
