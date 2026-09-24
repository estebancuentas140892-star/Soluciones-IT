#!/usr/bin/env node
// SIMULADOR LOCAL DE LA ASISTENCIA (tarea 258). SOLO PARA DESARROLLO.
//
// Responde en memoria las siete funciones de la asistencia remota con las
// mismas reglas que supabase/schema.sql (seccion 7): codigo de 6 cifras
// que vence, canje unico, reemplazo de la sesion anterior del tecnico,
// cierre por inactividad, limite de intentos y rechazo de secretos. Sirve
// para recorrer el portal y la pantalla del tecnico en el navegador SIN
// tocar Supabase; la logica de verdad se prueba contra la base real con
// supabase/pruebas/asistencia.sql.
//
// Uso:
//   node scripts/asistencia-simulada.mjs            (puerto 5199)
//   y en .env.local (con el banco de pruebas):
//     VITE_MODO_PRUEBA_LOCAL=1
//     VITE_ASISTENCIA_SIMULADA_URL=http://localhost:5199
//
// Control para las pruebas visuales:
//   POST /control/cerrar?motivo=tecnico|portal|inactividad|codigo_vencido|maximo
//        cierra la sesion abierta mas reciente con ese motivo.
//   GET  /control/estado   lo que hay en memoria (sin secretos).

import { createServer } from 'node:http'
import { createHash, randomBytes, randomInt, randomUUID } from 'node:crypto'

const PUERTO = Number(process.env.PUERTO ?? 5199)
const CODIGO_MS = Number(process.env.CODIGO_MS ?? 10 * 60_000)
const INACTIVIDAD_MS = Number(process.env.INACTIVIDAD_MS ?? 15 * 60_000)

const sesiones = new Map()
const eventos = []
let ultimoMensaje = 0

const NOMBRES = ['contraseña', 'contrasena', 'password', 'passwd', 'pwd', 'clave', 'llave', 'pin', 'token', 'api[ _-]?key', 'secreto', 'secret']
const SECRETOS = [
  new RegExp(`(?<![\\p{L}\\p{N}_])(${NOMBRES.join('|')})(?![\\p{L}\\p{N}_])(\\s+\\p{L}+){0,2}\\s*[:=]\\s*\\S`, 'iu'),
  /v1\.[0-9]+\.[A-Za-z0-9+/=]{8,}\.[A-Za-z0-9+/=]{8,}\.[A-Za-z0-9+/=]{8,}/,
  /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\./,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/i,
  /[a-z][a-z0-9+.-]*:\/\/[^/\s:@]+:[^/\s@]+@/i,
]
const TIPOS = new Set(['donde', 'accion', 'comprobacion', 'nota', 'dato', 'comando', 'atajo', 'url', 'archivo', 'debes_ver'])

function hash(texto) {
  return createHash('sha256').update(texto).digest('hex')
}

function evento(tipo, sesion = null, tecnico = null, detalle = '') {
  eventos.push({ tipo, sesion, tecnico, detalle, fecha: Date.now() })
}

function vencer(sesion) {
  if (!sesion) return
  const ahora = Date.now()
  let motivo = null
  if (sesion.estado === 'esperando' && ahora >= sesion.codigoVence) motivo = 'codigo_vencido'
  if (sesion.estado === 'conectada' && ahora - sesion.ultimaActividad >= INACTIVIDAD_MS) motivo = 'inactividad'
  if (motivo) cerrar(sesion, 'expirada', motivo)
}

function cerrar(sesion, estado, motivo) {
  sesion.estado = estado
  sesion.motivo = motivo
  sesion.mensajes = []
  evento(estado === 'expirada' ? 'expirada' : 'cerrada', sesion.id, sesion.tecnico, motivo)
}

function validar(c) {
  if (!c || typeof c !== 'object' || Array.isArray(c) || c.v !== 1) return 'estructura'
  if (typeof c.titulo !== 'string' || !c.titulo || !Array.isArray(c.bloques) || c.bloques.length < 1 || c.bloques.length > 40) return 'estructura'
  const textos = [c.titulo, c.subtitulo ?? '']
  for (const b of c.bloques) {
    if (!b || typeof b !== 'object' || !TIPOS.has(b.tipo) || typeof b.texto !== 'string' || !b.texto) return 'estructura'
    for (const [clave, valor] of Object.entries(b)) {
      if (!['tipo', 'texto', 'titulo', 'plataforma', 'etiqueta'].includes(clave) || typeof valor !== 'string') return 'estructura'
    }
    if (b.tipo === 'url' && !/^https?:\/\/\S+$/i.test(b.texto)) return 'url'
    textos.push(b.texto, b.titulo ?? '', b.etiqueta ?? '', b.plataforma ?? '')
  }
  return textos.some((t) => SECRETOS.some((p) => p.test(t))) ? 'secreto' : null
}

const funciones = {
  asistencia_crear() {
    let codigo
    do codigo = String(randomInt(0, 1_000_000)).padStart(6, '0')
    while ([...sesiones.values()].some((s) => s.estado === 'esperando' && s.codigo === codigo))
    const secreto = randomBytes(32).toString('hex')
    const sesion = {
      id: randomUUID(),
      codigo,
      secretoHash: hash(secreto),
      estado: 'esperando',
      tecnico: null,
      codigoVence: Date.now() + CODIGO_MS,
      ultimaActividad: null,
      motivo: null,
      mensajes: [],
    }
    sesiones.set(sesion.id, sesion)
    evento('creada', sesion.id)
    return { ok: true, id: sesion.id, secreto, codigo, codigo_vence_en: new Date(sesion.codigoVence).toISOString(), ahora: new Date().toISOString() }
  },
  asistencia_estado({ p_id, p_secreto, p_desde }) {
    const sesion = sesiones.get(p_id)
    vencer(sesion)
    const ahora = new Date().toISOString()
    if (!sesion || sesion.secretoHash !== hash(String(p_secreto ?? ''))) return { ok: true, estado: 'no_encontrada', ahora }
    return {
      ok: true,
      estado: sesion.estado,
      codigo: sesion.estado === 'esperando' ? sesion.codigo : null,
      codigo_vence_en: sesion.estado === 'esperando' ? new Date(sesion.codigoVence).toISOString() : null,
      motivo: sesion.motivo,
      mensajes: sesion.estado === 'conectada' ? sesion.mensajes.filter((m) => m.id > Number(p_desde ?? 0)) : [],
      ahora,
    }
  },
  asistencia_cerrar_portal({ p_id, p_secreto }) {
    const sesion = sesiones.get(p_id)
    if (sesion && sesion.secretoHash === hash(String(p_secreto ?? '')) && ['esperando', 'conectada'].includes(sesion.estado)) {
      cerrar(sesion, 'cerrada', 'portal')
    }
    return { ok: true, estado: 'cerrada' }
  },
  asistencia_conectar({ p_codigo }, tecnico) {
    const codigo = String(p_codigo ?? '').replace(/\s/g, '')
    if (!/^\d{6}$/.test(codigo)) return { ok: false, error: 'codigo_invalido' }
    const fallos = eventos.filter((e) => e.tipo === 'codigo_incorrecto' && e.tecnico === tecnico && Date.now() - e.fecha < 600_000)
    if (fallos.length >= 5) return { ok: false, error: 'demasiados_intentos' }
    for (const s of sesiones.values()) vencer(s)
    const sesion = [...sesiones.values()].find((s) => s.estado === 'esperando' && s.codigo === codigo)
    if (!sesion) {
      evento('codigo_incorrecto', null, tecnico)
      const reciente = [...sesiones.values()].reverse().find((s) => s.codigo === codigo)
      if (reciente?.motivo === 'codigo_vencido') return { ok: false, error: 'codigo_vencido' }
      if (reciente) return { ok: false, error: 'codigo_usado' }
      return { ok: false, error: 'codigo_incorrecto' }
    }
    for (const otra of sesiones.values()) {
      if (otra.tecnico === tecnico && otra.estado === 'conectada') cerrar(otra, 'cerrada', 'reemplazada')
    }
    Object.assign(sesion, { estado: 'conectada', tecnico, ultimaActividad: Date.now(), conectadaEn: Date.now() })
    evento('conectada', sesion.id, tecnico)
    return {
      ok: true,
      id: sesion.id,
      codigo: sesion.codigo,
      conectada_en: new Date(sesion.conectadaEn).toISOString(),
      vence_inactividad_en: new Date(Date.now() + INACTIVIDAD_MS).toISOString(),
      vence_maximo_en: new Date(Date.now() + 4 * 3_600_000).toISOString(),
    }
  },
  asistencia_enviar({ p_id, p_contenido }, tecnico) {
    const sesion = sesiones.get(p_id)
    vencer(sesion)
    if (!sesion || sesion.tecnico !== tecnico || sesion.estado !== 'conectada') {
      return { ok: false, error: 'sesion_no_activa', estado: sesion?.estado ?? 'no_encontrada', motivo: sesion?.motivo ?? null }
    }
    const error = validar(p_contenido)
    if (error) {
      evento('mensaje_rechazado', sesion.id, tecnico, error)
      return { ok: false, error: error === 'secreto' ? 'contenido_protegido' : 'contenido_no_valido', motivo: error }
    }
    ultimoMensaje += 1
    sesion.mensajes.push({ id: ultimoMensaje, creado_en: new Date().toISOString(), contenido: p_contenido })
    sesion.ultimaActividad = Date.now()
    evento('mensaje', sesion.id, tecnico, `${p_contenido.bloques.length} bloques`)
    return { ok: true, id: ultimoMensaje }
  },
  asistencia_estado_tecnico({ p_id }, tecnico) {
    const sesion = sesiones.get(p_id)
    vencer(sesion)
    if (!sesion || sesion.tecnico !== tecnico) return { ok: true, estado: 'no_encontrada' }
    if (sesion.estado === 'conectada') sesion.ultimaActividad = Date.now()
    return { ok: true, estado: sesion.estado, codigo: sesion.codigo, motivo: sesion.motivo }
  },
  asistencia_desconectar({ p_id }, tecnico) {
    const sesion = sesiones.get(p_id)
    if (sesion && sesion.tecnico === tecnico && sesion.estado === 'conectada') cerrar(sesion, 'cerrada', 'tecnico')
    return { ok: true, estado: 'cerrada' }
  },
}

function responder(res, estado, cuerpo) {
  res.writeHead(estado, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'apikey, content-type, x-tecnico-prueba',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  })
  res.end(JSON.stringify(cuerpo))
}

createServer((req, res) => {
  if (req.method === 'OPTIONS') return responder(res, 204, {})
  const url = new URL(req.url ?? '/', `http://localhost:${PUERTO}`)
  if (url.pathname === '/control/estado') {
    return responder(res, 200, [...sesiones.values()].map(({ secretoHash: _sinSecreto, ...resto }) => ({ ...resto, mensajes: resto.mensajes.length })))
  }
  let cuerpo = ''
  req.on('data', (trozo) => (cuerpo += trozo))
  req.on('end', () => {
    if (url.pathname === '/control/cerrar') {
      const motivo = url.searchParams.get('motivo') ?? 'tecnico'
      const abierta = [...sesiones.values()].reverse().find((s) => ['esperando', 'conectada'].includes(s.estado))
      if (abierta) cerrar(abierta, ['inactividad', 'codigo_vencido', 'maximo'].includes(motivo) ? 'expirada' : 'cerrada', motivo)
      return responder(res, 200, { ok: Boolean(abierta) })
    }
    const nombre = url.pathname.replace(/^\/rpc\//, '')
    const funcion = funciones[nombre]
    if (!funcion) return responder(res, 404, { code: 'PGRST202', message: `No existe ${nombre}` })
    const tecnico = req.headers['x-tecnico-prueba'] ?? null
    if (['asistencia_conectar', 'asistencia_enviar', 'asistencia_estado_tecnico', 'asistencia_desconectar'].includes(nombre) && !tecnico) {
      return responder(res, 401, { message: 'permission denied' })
    }
    try {
      responder(res, 200, funcion(cuerpo ? JSON.parse(cuerpo) : {}, tecnico))
    } catch (error) {
      responder(res, 500, { message: String(error) })
    }
  })
}).listen(PUERTO, () => console.log(`Asistencia simulada en http://localhost:${PUERTO}`))
