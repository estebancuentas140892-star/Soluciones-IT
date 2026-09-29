import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

// scripts/restauracion-sql.mjs convierte un respaldo descifrado en el SQL
// que lo vuelve a cargar (supabase/RESPALDO.md, "Simulacro de restauracion").
// Se prueba como lo usa la persona: ejecutando el script sobre una carpeta.

const SCRIPT = 'scripts/restauracion-sql.mjs'
let carpeta = ''

function respaldo(tablas: Record<string, unknown[]>, conteos?: Record<string, number>) {
  carpeta = mkdtempSync(join(tmpdir(), 'respaldo-'))
  const manifiesto = {
    fecha: '2026-09-27T13:00:00Z',
    tablas: conteos ?? Object.fromEntries(Object.entries(tablas).map(([t, filas]) => [t, filas.length])),
  }
  writeFileSync(join(carpeta, 'manifiesto.json'), JSON.stringify(manifiesto))
  for (const [tabla, filas] of Object.entries(tablas)) {
    writeFileSync(join(carpeta, `${tabla}.json`), JSON.stringify(filas))
  }
  return carpeta
}

function generar(dir: string, ...opciones: string[]) {
  return execFileSync(process.execPath, [SCRIPT, ...opciones, dir], { encoding: 'utf8' })
}

function fallo(dir: string) {
  const resultado = spawnSync(process.execPath, [SCRIPT, dir], { encoding: 'utf8' })
  return { codigo: resultado.status, error: resultado.stderr }
}

afterEach(() => {
  if (carpeta) rmSync(carpeta, { recursive: true, force: true })
  carpeta = ''
})

describe('restauracion-sql', () => {
  it('carga todo en una transaccion sin triggers y sin pisar lo que existe', () => {
    const sql = generar(respaldo({
      categorias: [{ id: 'c1', nombre: 'Impresoras', orden: 1 }],
      dispositivos: [{ id: 'd1', nombre: 'HP M404', categoria_id: 'c1' }],
    }))
    expect(sql.indexOf('begin;')).toBeLessThan(sql.indexOf('set local session_replication_role = replica;'))
    expect(sql.indexOf('insert into public.categorias')).toBeLessThan(sql.indexOf('insert into public.dispositivos'))
    expect(sql).toContain('insert into public.dispositivos ("id", "nombre", "categoria_id")')
    expect(sql).toContain('jsonb_populate_recordset(null::public.dispositivos, $respaldo$[{"id":"d1"')
    expect(sql.match(/on conflict \(id\) do nothing;/g)).toHaveLength(2)
    expect(sql.indexOf('commit;')).toBeGreaterThan(sql.indexOf('insert into public.dispositivos'))
  })

  it('termina con el conteo de cada tabla frente al manifiesto', () => {
    const sql = generar(respaldo({ categorias: [{ id: 'c1' }], historial: [] }))
    expect(sql).toContain("select 'categorias' as tabla, count(*) as filas, 1 as en_respaldo from public.categorias")
    expect(sql).toContain("select 'historial' as tabla, count(*) as filas, 0 as en_respaldo from public.historial")
    expect(sql).toContain('-- historial: sin filas.')
    expect(sql).not.toContain('insert into public.historial')
  })

  it('no carga perfiles: nacen con su cuenta de Authentication', () => {
    const sql = generar(respaldo({ perfiles: [{ id: 'u1', nombre: 'Ana' }], categorias: [] }))
    expect(sql).not.toContain('insert into public.perfiles')
    expect(sql).not.toContain("select 'perfiles'")
    expect(sql).toContain('-- perfiles: no se carga')
  })

  it('cambia las comillas de dolar si los datos las contienen', () => {
    const sql = generar(respaldo({ articulos: [{ id: 'a1', contenido: 'texto con $respaldo$ dentro' }] }))
    expect(sql).toContain('null::public.articulos, $respaldo1$[')
    expect(sql).toContain(']$respaldo1$::jsonb')
  })

  it('rechaza un respaldo cuyo JSON no coincide con el manifiesto', () => {
    const { codigo, error } = fallo(respaldo({ dispositivos: [{ id: 'd1' }] }, { dispositivos: 2 }))
    expect(codigo).toBe(1)
    expect(error).toContain('dispositivos.json trae 1 filas y el manifiesto dice 2')
  })

  it('rechaza nombres de tabla o de columna que no son identificadores simples', () => {
    expect(fallo(respaldo({ 'categorias; drop table x': [] })).error).toContain('Nombre de tabla no válido')
    expect(fallo(respaldo({ categorias: [{ id: 'c1', 'nombre")--': 'x' }] })).error).toContain('Nombre de columna de categorias no válido')
  })

  it('por defecto no borra nada: solo agrega lo que falte', () => {
    const sql = generar(respaldo({ categorias: [{ id: 'c1' }], dispositivos: [{ id: 'd1' }] }))
    expect(sql).not.toMatch(/delete from|raise exception/)
  })

  it('en un proyecto nuevo vacia antes las tablas, y se niega si ya hay datos propios', () => {
    const sql = generar(
      respaldo({ categorias: [{ id: 'c1' }], referencias: [], dispositivos: [{ id: 'd1' }], historial: [] }),
      '--proyecto-nuevo',
    )
    // La guarda mira las tablas que el esquema no siembra; categorias y
    // referencias ya traen filas en un proyecto recien creado.
    const guarda = sql.slice(sql.indexOf('do $comprobacion$'), sql.indexOf('$comprobacion$;'))
    expect(guarda).toContain('exists (select 1 from public.dispositivos)')
    expect(guarda).toContain('exists (select 1 from public.historial)')
    expect(guarda).not.toContain('public.categorias')
    expect(guarda).not.toContain('public.referencias')
    expect(guarda).toContain('raise exception')
    for (const tabla of ['categorias', 'referencias', 'dispositivos', 'historial']) {
      expect(sql.indexOf(`delete from public.${tabla};`)).toBeGreaterThan(sql.indexOf('$comprobacion$;'))
    }
    expect(sql.indexOf('delete from public.categorias;')).toBeLessThan(sql.indexOf('insert into public.categorias'))
  })

  it('una fecha alterada no sale del comentario', () => {
    const dir = respaldo({ categorias: [] })
    writeFileSync(join(dir, 'manifiesto.json'), JSON.stringify({ fecha: '2026-09-27\ndrop table x;', tablas: { categorias: 0 } }))
    const sql = generar(dir)
    expect(sql.split('\n')[0]).toBe('-- Restauración del respaldo del 2026-09-27.')
    expect(sql).not.toContain('drop table')
  })
})
