// Igual que resumenProcedimiento.ts (tarea 29), pero para el campo
// "detalles" de un dispositivo (Record<string, string>, mostrado como
// "Campos adicionales" en la ficha). El historial guarda el JSON de
// antes y despues; aqui se compara clave por clave para describir el
// cambio en lenguaje natural en vez de volcar el objeto completo.

export interface ResumenDetalles {
  cambios: string[]
}

export function resumenDetalles(valorAnterior: string, valorNuevo: string): ResumenDetalles {
  const anterior = parsear(valorAnterior)
  const nueva = parsear(valorNuevo)

  const claves = new Set([...Object.keys(anterior), ...Object.keys(nueva)])
  const cambios: string[] = []

  for (const clave of claves) {
    const antes = anterior[clave]
    const despues = nueva[clave]
    if (antes === despues) continue

    if (antes === undefined) cambios.push(`Se agregó el campo "${clave}": "${despues}".`)
    else if (despues === undefined) cambios.push(`Se quitó el campo "${clave}" ("${antes}").`)
    else cambios.push(`Se cambió "${clave}": "${antes}" → "${despues}".`)
  }

  return { cambios: cambios.length > 0 ? cambios : ['Se actualizaron los campos adicionales.'] }
}

// El valor del historial es el JSON de un Record<string,string> (o ""
// cuando no habia ninguno). Tolera datos invalidos o incompletos.
function parsear(valor: string): Record<string, string> {
  if (!valor) return {}
  try {
    const datos = JSON.parse(valor)
    if (!datos || typeof datos !== 'object' || Array.isArray(datos)) return {}
    const limpio: Record<string, string> = {}
    for (const [clave, dato] of Object.entries(datos)) {
      if (typeof dato === 'string') limpio[clave] = dato
    }
    return limpio
  } catch {
    return {}
  }
}
