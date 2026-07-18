import type { CambioPendiente } from './db'

// Traduce un cambio de la cola de sincronizacion a lenguaje claro
// para el panel de sincronizacion: que ficha es, que se intento hacer
// y por que fallo. Logica pura, sin base ni red, para poder probarla.

const NOMBRE_TABLA: Record<string, string> = {
  categorias: 'Categoría',
  articulos: 'Solución',
  dispositivos: 'Equipo',
  conexiones: 'Conexión',
  credenciales: 'Credencial',
  adjuntos: 'Adjunto',
  historial: 'Registro de historial',
  diagnosticos: 'Diagnóstico',
  ejecuciones_diagnostico: 'Registro de diagnóstico',
  accesos_boveda: 'Registro de la bóveda',
}

// El titulo visible de la ficha, buscando en los campos que usan las
// distintas tablas. Sin titulo reconocible se muestra el id recortado.
function tituloDePayload(payload: unknown, entidadId: string): string {
  if (payload && typeof payload === 'object') {
    const origen = payload as Record<string, unknown>
    for (const campo of ['titulo', 'nombre', 'diagnosticoTitulo', 'credencialTitulo', 'campo']) {
      const valor = origen[campo]
      if (typeof valor === 'string' && valor.trim() !== '') return valor
    }
  }
  return entidadId.slice(0, 8)
}

function esEliminacion(payload: unknown): boolean {
  return Boolean(
    payload &&
      typeof payload === 'object' &&
      typeof (payload as Record<string, unknown>).eliminadoEn === 'string',
  )
}

// Los codigos y mensajes de Postgres no le dicen nada a un tecnico.
// Se traducen los casos conocidos a una explicacion y, cuando existe,
// a la accion que lo resuelve.
export function explicarErrorDeSync(mensaje: string): string {
  const m = mensaje.toLowerCase()
  if (m.includes('does not exist')) {
    return 'El servidor no tiene la última estructura de datos. Hay que aplicar el schema.sql actualizado en Supabase (guía en supabase/INSTRUCCIONES.md).'
  }
  if (m.includes('row-level security') || m.includes('permission') || m.includes('policy')) {
    return 'El servidor rechazó el cambio por permisos. Si es de la bóveda, revisa que tu usuario tenga el permiso puede_ver_boveda.'
  }
  if (m.includes('jwt') || m.includes('token') || m.includes('expired')) {
    return 'La sesión venció. Cierra sesión y vuelve a entrar; el cambio se subirá solo.'
  }
  if (m.includes('violates check constraint') || m.includes('invalid input')) {
    return 'El servidor no aceptó uno de los valores. Suele resolverse aplicando el schema.sql actualizado en Supabase.'
  }
  if (m.includes('foreign key')) {
    return 'La ficha depende de otra que aún no existe en el servidor (por ejemplo su categoría). Suele resolverse con una nueva sincronización.'
  }
  return mensaje
}

export interface DescripcionCambio {
  // "Solución: Instalar impresora Zebra (eliminación)"
  titulo: string
  // Explicacion del error en lenguaje claro, o null si no ha fallado.
  explicacion: string | null
  intentos: number
}

export function describirCambio(cambio: CambioPendiente): DescripcionCambio {
  const tipo = NOMBRE_TABLA[cambio.tabla] ?? cambio.tabla
  const nombre = tituloDePayload(cambio.payload, cambio.entidadId)
  const sufijo = esEliminacion(cambio.payload) ? ' (eliminación)' : ''
  return {
    titulo: `${tipo}: ${nombre}${sufijo}`,
    explicacion: cambio.error ? explicarErrorDeSync(cambio.error) : null,
    intentos: cambio.intentos,
  }
}
