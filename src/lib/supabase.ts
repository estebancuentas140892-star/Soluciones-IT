import { createClient } from '@supabase/supabase-js'
import { claveSesionDe } from './sesionGuardada'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

// Donde supabase-js guarda la sesión en localStorage. Es la clave que usa
// por defecto (`sb-<proyecto>-auth-token`), escrita aquí para que la app
// pueda leerla y borrarla sin conexión (tarea 284) y para que no cambie
// si supabase-js cambia la suya: cambiarla cerraría la sesión de todos.
export const CLAVE_SESION = supabaseConfigured ? claveSesionDe(supabaseUrl) : null

export const supabase = supabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, { auth: { storageKey: CLAVE_SESION ?? undefined } })
  : null
