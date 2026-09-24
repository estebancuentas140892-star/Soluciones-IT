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
    // Solo las semillas (secciones 5.x): desde la tarea 258 el esquema
    // sigue con el detector de secretos del portal de asistencia, que
    // nombra "contraseña" y "password" a proposito.
    const bloque = esquema.slice(
      esquema.indexOf('5.1 Contenido inicial de Referencia'),
      esquema.indexOf('-- 6. Tiempo real'),
    )
    // Una IPv4 literal en el contenido seria un dato interno filtrado;
    // los ejemplos usan marcadores entre corchetes.
    expect(bloque).not.toMatch(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/)
    expect(bloque.toLowerCase()).not.toContain('contraseña')
    expect(bloque.toLowerCase()).not.toContain('password')
  })
})

// LAS HERRAMIENTAS DEL CENTRO DE CONSULTA (encargo del 2026-09-14). Mismo
// contrato que el bloque anterior, mas lo propio de este encargo: solo
// lo confirmado, lo historico nunca como uso actual, y ninguna ficha
// para lo que no se sabe que es.
describe('herramientas del Centro de consulta', () => {
  const bloque = esquema.slice(esquema.indexOf('5.2 Herramientas del Centro de consulta'))

  // La fila entera de una herramienta, desde su tipo hasta el cierre de
  // su lista de etiquetas.
  function filaDe(nombre: string): string {
    const inicio = bloque.indexOf(`'herramienta', '${nombre}'`)
    expect(inicio).toBeGreaterThanOrEqual(0)
    const resto = bloque.slice(inicio)
    return resto.slice(0, resto.search(/\]\)(,|\n)/))
  }

  it('siembra 20 fichas nuevas con identificadores estables propios', () => {
    const ids = new Set(esquema.match(/2026090e-0000-4000-8000-[0-9a-f]{12}/g) ?? [])
    expect(ids.size).toBe(20)
  })

  it('siembra las dieciséis herramientas del encargo', () => {
    const nombres = [
      'TightVNC',
      'AnyDesk',
      'Zabbix',
      'SICOF ERP',
      'ICG Manager',
      'FrontRest',
      'HKA Factura',
      'DOCUMENT',
      'WORKFLOW',
      'SharePoint',
      'SonicWall',
      'Kaspersky',
      'VMware ESXi',
      'Issabel',
      'Power BI',
      'SQL Server Management Studio',
    ]
    expect(bloque.match(/'herramienta', '/g) ?? []).toHaveLength(nombres.length)
    for (const nombre of nombres) expect(bloque).toContain(`'herramienta', '${nombre}'`)
  })

  it('no inventa una ficha para Software A.M.', () => {
    expect(bloque).not.toMatch(/'herramienta', 'Software A\.M\.'/)
  })

  it('el esquema admite el tipo herramienta y los tres estados de uso', () => {
    expect(esquema).toContain("check (tipo in ('herramienta', 'termino', 'atajo', 'comando'))")
    expect(esquema).toContain("check (estado_uso in ('', 'confirmado', 'documentado'))")
  })

  it('lo que solo tiene evidencia historica nunca se siembra como confirmado', () => {
    for (const nombre of ['VMware ESXi', 'Issabel', 'DOCUMENT', 'WORKFLOW', 'SonicWall', 'SICOF ERP']) {
      expect(filaDe(nombre)).toContain("'documentado'")
      expect(filaDe(nombre)).not.toContain("'confirmado'")
    }
    for (const nombre of ['TightVNC', 'AnyDesk', 'Zabbix', 'ICG Manager', 'FrontRest']) {
      expect(filaDe(nombre)).toContain("'confirmado'")
    }
  })

  it('SICOF es de ADA y DOCUMENT de Coldetec, nunca al reves', () => {
    expect(filaDe('SICOF ERP')).toContain("'ADA'")
    expect(filaDe('DOCUMENT')).toContain("'Coldetec'")
    expect(filaDe('DOCUMENT')).not.toContain("'ADA'")
  })

  it('enlaza las guias por su titulo exacto y sin pisar lo que el equipo cambie', () => {
    expect(bloque).toContain('join public.articulos a on a.titulo = datos.titulo and a.eliminado_en is null')
    expect(bloque).toContain("r.guias_relacionadas = '[]'::jsonb")
    for (const titulo of [
      'Conectar de forma remota a un POS desde un computador',
      'Acceder a ICG Manager mediante Escritorio remoto',
      'Crear un cliente externo en ICG Manager',
      'Crear un trabajador para almuerzo en ICG Manager',
      'Crear un usuario de taquillero en ICG Manager',
      'Actualizar la resolución DIAN para facturación electrónica en un POS',
      'Crear copia de seguridad de una base de datos en SQL Server',
    ]) {
      expect(bloque).toContain(`'${titulo}'`)
    }
  })
})

// El respaldo semanal (scripts/respaldo-supabase.sh) lista sus tablas a
// mano. Hasta el 2026-09-24 respaldaba 11 de 16: las cinco creadas despues
// de escribirlo (ubicaciones, campos_protegidos, personas, referencias y
// boveda_meta) quedaban fuera sin que nada avisara.
describe('el respaldo cubre todas las tablas del esquema', () => {
  const script = readFileSync('scripts/respaldo-supabase.sh', 'utf8')
  const lista = /^TABLAS=\(([^)]*)\)/m.exec(script)?.[1].trim().split(/\s+/) ?? []
  // Tablas CERRADAS a la API a proposito (tarea 258): sin politicas ni
  // privilegios para authenticated, asi que el usuario de respaldo no
  // puede leerlas y el script fallaria. Sus sesiones y mensajes son
  // efimeros, y su auditoria se consulta en el panel de Supabase.
  const SIN_RESPALDO_POR_API = ['asistencia_sesiones', 'asistencia_mensajes', 'asistencia_eventos']
  const tablasDelEsquema = [...esquema.matchAll(/create table if not exists public\.(\w+) \(/g)]
    .map((m) => m[1])
    .filter((tabla) => !SIN_RESPALDO_POR_API.includes(tabla))

  it('el script declara su lista de tablas', () => {
    expect(lista.length).toBeGreaterThan(0)
  })

  it.each(tablasDelEsquema)('la tabla %s entra en el respaldo', (tabla) => {
    expect(lista).toContain(tabla)
  })
})

// Minimo privilegio en las funciones (tarea 271). Postgres da EXECUTE a
// PUBLIC en toda funcion nueva y Supabase ademas a anon y authenticated,
// y lo que vive en public se puede invocar por /rest/v1/rpc. Cada funcion
// del esquema tiene que fijar su search_path y revocar EXECUTE de forma
// explicita, y solo las de la lista pueden ser security definer.
describe('las funciones del esquema tienen permisos explicitos', () => {
  const SECURITY_DEFINER_PERMITIDAS = [
    // La dispara Auth (supabase_auth_admin), que no puede escribir en
    // public.perfiles; nadie la invoca por la API.
    'crear_perfil',
    // El portal de asistencia (tarea 258): sus tablas no tienen
    // politicas ni privilegios, asi que solo estas funciones las tocan.
    // Las tres primeras son para anon (el computador atendido, sin
    // sesion) y las cuatro ultimas para authenticated (el tecnico).
    'asistencia_crear',
    'asistencia_estado',
    'asistencia_cerrar_portal',
    'asistencia_conectar',
    'asistencia_enviar',
    'asistencia_estado_tecnico',
    'asistencia_desconectar',
  ]
  const funciones = [...esquema.matchAll(/create or replace function public\.(\w+)\(([^)]*)\)([\s\S]*?)\nas \$\$/g)].map(
    (m) => ({ nombre: m[1], cabecera: m[3] }),
  )

  it('encuentra las funciones del esquema', () => {
    expect(funciones.map((f) => f.nombre)).toEqual(
      expect.arrayContaining(['registrar_modificacion', 'crear_perfil', 'puede_ver_boveda', 'sellar_registro_inmutable']),
    )
  })

  it.each(funciones.map((f) => [f.nombre, f.cabecera]))('%s fija su search_path', (_nombre, cabecera) => {
    expect(cabecera).toMatch(/set search_path = ''/)
  })

  it.each(funciones.map((f) => [f.nombre]))('%s revoca EXECUTE de forma explicita', (nombre) => {
    expect(esquema).toMatch(new RegExp(`revoke execute on function public\\.${nombre}\\([^)]*\\) from public`))
  })

  it.each(funciones.map((f) => [f.nombre, f.cabecera]))('%s solo es security definer si esta justificada', (nombre, cabecera) => {
    if (/security definer/.test(cabecera)) expect(SECURITY_DEFINER_PERMITIDAS).toContain(nombre)
  })
})

// EL PORTAL DE ASISTENCIA NO ABRE NADA (tarea 258). Es la primera
// superficie publica de la app: sus tablas quedan cerradas a la API y
// cada funcion se concede solo al rol que la usa.
describe('el portal de asistencia no abre sus tablas', () => {
  const TABLAS = ['asistencia_sesiones', 'asistencia_mensajes', 'asistencia_eventos']
  const DEL_PORTAL = ['asistencia_crear()', 'asistencia_estado(uuid, text, bigint)', 'asistencia_cerrar_portal(uuid, text)']
  const DEL_TECNICO = [
    'asistencia_conectar(text)',
    'asistencia_enviar(uuid, jsonb)',
    'asistencia_estado_tecnico(uuid)',
    'asistencia_desconectar(uuid)',
  ]
  const INTERNAS = ['asistencia_parece_secreto(text)', 'asistencia_validar_contenido(jsonb)', 'asistencia_vencer(uuid)']
  const realtime = /tablas text\[\] := array\[([\s\S]*?)\];/.exec(esquema)?.[1] ?? ''

  it.each(TABLAS)('%s tiene RLS, ninguna politica y ningun privilegio para la API', (tabla) => {
    expect(esquema).toContain(`alter table public.${tabla} enable row level security;`)
    expect(esquema).toContain(`revoke all on table public.${tabla} from public, anon, authenticated;`)
    expect(esquema).not.toMatch(new RegExp(`create policy \\w+ on public\\.${tabla}\\b`))
    expect(esquema).not.toMatch(new RegExp(`grant [^;]* on (table )?public\\.${tabla}\\b`))
  })

  it.each(TABLAS)('%s no se publica por Realtime', (tabla) => {
    expect(realtime).not.toBe('')
    expect(realtime).not.toContain(`'${tabla}'`)
  })

  it.each(DEL_PORTAL)('%s solo la ejecuta anon', (firma) => {
    expect(esquema).toContain(`grant execute on function public.${firma} to anon;`)
    expect(esquema).not.toContain(`grant execute on function public.${firma} to authenticated;`)
  })

  it.each(DEL_TECNICO)('%s solo la ejecuta authenticated', (firma) => {
    expect(esquema).toContain(`grant execute on function public.${firma} to authenticated;`)
    expect(esquema).not.toContain(`grant execute on function public.${firma} to anon;`)
  })

  it.each(INTERNAS)('%s no se concede a nadie', (firma) => {
    expect(esquema).toContain(`revoke execute on function public.${firma} from public, anon, authenticated;`)
    expect(esquema).not.toMatch(new RegExp(`grant execute on function public\\.${firma.replace(/[()]/g, '\\$&')}`))
  })
})
