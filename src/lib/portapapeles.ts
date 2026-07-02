// Copia texto al portapapeles. Intenta primero la API moderna y, si
// no esta disponible (permisos, navegadores viejos), recurre al
// mecanismo clasico con un textarea temporal.
export async function copiarAlPortapapeles(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto)
    return true
  } catch {
    try {
      const area = document.createElement('textarea')
      area.value = texto
      area.style.position = 'fixed'
      area.style.opacity = '0'
      document.body.appendChild(area)
      area.select()
      const exito = document.execCommand('copy')
      area.remove()
      return exito
    } catch {
      return false
    }
  }
}
