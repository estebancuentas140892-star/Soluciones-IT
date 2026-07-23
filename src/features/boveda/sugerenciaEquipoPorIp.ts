import type { Dispositivo } from '../../lib/db'

// Hallazgo S6 de AUDITORIA_FLUJOS_TI.md: la creacion contextual desde la
// ficha de un equipo ya precarga titulo, categoria y vinculo; el hueco es
// crear el secreto desde la Boveda, donde solo hay nudge por coincidencia
// EXACTA de titulo (dispositivoCoincidente). Esta funcion cubre el otro
// dato disponible al crear: la URL/IP que el tecnico ya esta tecleando.
//
// Devuelve el primer equipo cuya IP aparece dentro del texto escrito
// (URL o IP), o null si no hay coincidencia. Sustring, no igualdad
// exacta: cubre tanto "192.168.1.10" como "https://192.168.1.10/admin".
export function equipoPorIpOUrl(texto: string, dispositivos: Dispositivo[]): Dispositivo | null {
  const buscado = texto.trim().toLowerCase()
  if (!buscado) return null
  return (
    dispositivos.find((d) => {
      const ip = d.ip.trim().toLowerCase()
      return ip !== '' && buscado.includes(ip)
    }) ?? null
  )
}
