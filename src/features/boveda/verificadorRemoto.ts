import { ID_VERIFICADOR } from '../../lib/db'
import { supabase } from '../../lib/supabase'

// Acceso directo al verificador de la contrasena maestra en Supabase
// (tabla boveda_meta). Vive en su propio modulo para que las pruebas
// de la sesion de la boveda puedan simular el servidor.
//
// La regla de oro del desbloqueo depende de estas respuestas: crear
// una contrasena maestra nueva SOLO se permite cuando el servidor
// confirma explicitamente que no existe ni verificador ni credencial
// alguna. Cualquier duda (sin conexion, sin sesion, esquema sin
// aplicar) se responde como 'error' y el desbloqueo NO permite crear.

export type ConsultaVerificador =
  | { tipo: 'ok'; verificador: string | null; hayCredenciales: boolean }
  | { tipo: 'error' }

export async function consultarVerificadorRemoto(): Promise<ConsultaVerificador> {
  if (!supabase) return { tipo: 'error' }
  try {
    const meta = await supabase
      .from('boveda_meta')
      .select('id, verificador')
      .eq('id', ID_VERIFICADOR)
      .maybeSingle()
    if (meta.error) return { tipo: 'error' }
    if (meta.data && typeof meta.data.verificador === 'string' && meta.data.verificador !== '') {
      return { tipo: 'ok', verificador: meta.data.verificador, hayCredenciales: true }
    }

    // Sin verificador: mirar si al menos hay credenciales cifradas
    // (equipo que viene de una version anterior de la app). En ese
    // caso tampoco es "primera vez".
    const credenciales = await supabase
      .from('credenciales')
      .select('id', { count: 'exact', head: true })
      .is('eliminado_en', null)
    if (credenciales.error) return { tipo: 'error' }
    return { tipo: 'ok', verificador: null, hayCredenciales: (credenciales.count ?? 0) > 0 }
  } catch {
    return { tipo: 'error' }
  }
}

// Crea la unica fila del verificador. 'conflicto' significa que otro
// dispositivo la creo primero (clave primaria fija): el que llama
// debe releer el verificador del servidor y verificar contra ese.
export async function subirVerificadorRemoto(
  verificador: string,
): Promise<'creado' | 'conflicto' | 'error'> {
  if (!supabase) return 'error'
  try {
    const { error } = await supabase.from('boveda_meta').insert({ id: ID_VERIFICADOR, verificador })
    if (!error) return 'creado'
    return error.code === '23505' ? 'conflicto' : 'error'
  } catch {
    return 'error'
  }
}
