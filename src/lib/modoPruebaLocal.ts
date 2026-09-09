// MODO DE PRUEBA LOCAL, SOLO EN DESARROLLO.
//
// La app exige sesion de Supabase (`RequireAuth`), asi que sin
// credenciales no se puede abrir ninguna pantalla ni siquiera para
// mirarla en un ancho de telefono. Esto habilita un banco de pruebas
// con datos INVENTADOS en la base local (Dexie), sin tocar el servidor
// ni usar contenido real del equipo.
//
// Dos cierres para que nunca llegue a produccion:
//
//   1. `import.meta.env.DEV` es `false` en el build de produccion, asi
//      que Rollup elimina la rama entera (y con ella el import dinamico
//      de la semilla, que por eso NUNCA se importa de forma estatica).
//   2. Ademas hay que pedirlo a mano con `VITE_MODO_PRUEBA_LOCAL=1` en
//      un `.env.local`, que no se versiona.
//
// Nunca se activa si hay Supabase configurado: con servidor real manda
// la sesion real.
export const MODO_PRUEBA_LOCAL =
  import.meta.env.DEV && import.meta.env.VITE_MODO_PRUEBA_LOCAL === '1'

/** Identidad ficticia del banco de pruebas. */
export const PERFIL_PRUEBA = {
  id: '00000000-0000-4000-8000-000000000001',
  nombre: 'Tecnico de prueba',
  correo: 'prueba@local',
  puedeVerBoveda: true,
}
