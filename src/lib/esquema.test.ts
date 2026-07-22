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
