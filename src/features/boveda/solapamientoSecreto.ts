import type { CampoProtegido, DispositivoAfectado } from '../../lib/db'

// Hallazgo S5 de AUDITORIA_FLUJOS_TI.md: una credencial 'cuenta' vinculada
// a un equipo guarda usuario+contraseña, y ese mismo equipo puede tener un
// CampoProtegido 'contrasena' en su ficha (Seguridad). Nada impide que la
// misma contraseña viva en los dos lados; al rotar hay que acordarse de
// cambiarla en ambos, o divergen. Las fases P0-P4 resolvieron "un secreto
// REPRESENTA un equipo", no "dos lugares guardan la misma contraseña".
//
// Devuelve los equipos vinculados que YA tienen una contraseña protegida
// activa, para avisar antes de duplicarla en la Bóveda.
export function equiposConContrasenaProtegida(
  vinculados: DispositivoAfectado[],
  camposProtegidos: CampoProtegido[],
): DispositivoAfectado[] {
  const idsConContrasena = new Set(
    camposProtegidos
      .filter((c) => !c.eliminadoEn && c.tipo === 'contrasena' && c.dispositivoId)
      .map((c) => c.dispositivoId as string),
  )
  return vinculados.filter((v) => idsConContrasena.has(v.id))
}
