import type { CampoProtegido, Conexion, Credencial, DispositivoAfectado } from '../../lib/db'

// Logica pura del flujo "Dar de baja" (hallazgo L1 de AUDITORIA_FLUJOS_TI.md):
// hoy "De baja" solo fija un color en el estado y eliminar un equipo hace
// soft-delete de una sola fila sin tocar sus campos protegidos, sus
// credenciales vinculadas ni sus conexiones, que quedan huerfanos. Esta
// logica encuentra esas tres dependencias (separada de React y de la base
// local para poder probarla sola); la pantalla `DarDeBajaPage.tsx` las
// muestra y deja resolver cada una por separado (decision del usuario:
// confirmacion item por item, no archivado automatico) antes de fijar el
// estado.

export interface DependenciasBaja {
  conexiones: Conexion[]
  credenciales: Credencial[]
  camposProtegidos: CampoProtegido[]
}

interface DatosBaja {
  conexiones: Conexion[]
  credenciales: Credencial[]
  camposProtegidos: CampoProtegido[]
}

// Las conexiones, credenciales y campos protegidos que se perderian sin
// vinculo si el equipo se elimina o se desconecta del todo. No usa el
// grafo de referencias (construirGrafo/referenciasHacia): a diferencia del
// aviso de impacto (que solo necesita titulos para mostrar un enlace),
// aqui hace falta la fila completa para poder editarla o eliminarla.
export function dependenciasDeBaja(dispositivoId: string, datos: DatosBaja): DependenciasBaja {
  return {
    conexiones: datos.conexiones.filter(
      (c) => !c.eliminadoEn && (c.origenId === dispositivoId || c.destinoId === dispositivoId),
    ),
    credenciales: datos.credenciales.filter(
      (c) => !c.eliminadoEn && c.dispositivos.some((d) => d.id === dispositivoId),
    ),
    camposProtegidos: datos.camposProtegidos.filter((c) => !c.eliminadoEn && c.dispositivoId === dispositivoId),
  }
}

export function sinDependencias(dependencias: DependenciasBaja): boolean {
  return (
    dependencias.conexiones.length === 0 &&
    dependencias.credenciales.length === 0 &&
    dependencias.camposProtegidos.length === 0
  )
}

// Nueva lista de equipos con acceso de una credencial tras desvincularla
// de un dispositivo puntual (el resto de vinculos, si los hay, se
// conservan intactos).
export function sinDispositivo(vinculados: DispositivoAfectado[], dispositivoId: string): DispositivoAfectado[] {
  return vinculados.filter((d) => d.id !== dispositivoId)
}
