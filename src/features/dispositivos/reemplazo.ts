import type { CampoProtegido, Conexion, Credencial } from '../../lib/db'

// Logica pura de "Reemplazar equipo" (hallazgos L2 y L3 de
// AUDITORIA_FLUJOS_TI.md): el escenario real "se quemo el switch, entro
// uno nuevo en el mismo rack y puerto" obligaba a recablear cada
// conexion a mano, re-vincular cada credencial editandola en la boveda y
// recrear cada campo protegido. Estas funciones puras (sin React ni base
// local, con pruebas) devuelven la fila ya migrada del equipo saliente
// al entrante; `dependenciasDeBaja` (baja.ts) sigue siendo la fuente de
// QUE dependencias hay que migrar, aqui solo se decide COMO se migra
// cada una. Decision del usuario (2026-07-22): se migra todo junto, sin
// excluir items puntuales (a diferencia de "dar de baja", aqui la accion
// es siempre la misma para todos).

export interface DispositivoRef {
  id: string
  nombre: string
}

// Reasigna el extremo de la conexion que apunte al equipo saliente hacia
// el entrante (copia el id y el nombre, mismo patron de referencia viva
// que el resto de vinculos). Si ninguno de los dos extremos es el
// saliente, la conexion vuelve igual.
export function migrarConexion(conexion: Conexion, viejoId: string, nuevo: DispositivoRef): Conexion {
  return {
    ...conexion,
    origenId: conexion.origenId === viejoId ? nuevo.id : conexion.origenId,
    origenNombre: conexion.origenId === viejoId ? nuevo.nombre : conexion.origenNombre,
    destinoId: conexion.destinoId === viejoId ? nuevo.id : conexion.destinoId,
    destinoNombre: conexion.destinoId === viejoId ? nuevo.nombre : conexion.destinoNombre,
  }
}

// Reemplaza al equipo saliente por el entrante dentro de la lista
// `dispositivos` de la credencial (el resto de vinculos, si los hay, se
// conservan intactos). No toca `datosCifrados`: el contenido secreto no
// cambia, solo a que equipo da acceso.
export function migrarCredencial(credencial: Credencial, viejoId: string, nuevo: DispositivoRef): Credencial {
  return {
    ...credencial,
    dispositivos: credencial.dispositivos.map((d) => (d.id === viejoId ? { id: nuevo.id, nombre: nuevo.nombre } : d)),
  }
}

// Reasigna el dueño del campo protegido al equipo entrante. No toca
// `valorCifrado`: mover un campo protegido es solo reasignar
// `dispositivoId`, no hay que descifrar (mismo criterio documentado en
// el hallazgo L2).
export function migrarCampoProtegido(campo: CampoProtegido, nuevoId: string): CampoProtegido {
  return { ...campo, dispositivoId: nuevoId }
}
