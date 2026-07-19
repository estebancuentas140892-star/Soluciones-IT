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

export type ResultadoCompartir = 'nativo' | 'copiado' | 'fallo'

// Comparte una URL con el dialogo nativo del telefono si existe
// (cancelar no se trata como error); si no, la copia al portapapeles.
// Quien llama decide que aviso mostrar segun el resultado (antes esta
// misma logica estaba calcada en el boton de la ficha de dispositivo y
// en el menu de la ficha de articulo).
export async function compartirOCopiar(
  titulo: string,
  url = window.location.href,
): Promise<ResultadoCompartir> {
  if (navigator.share) {
    try {
      await navigator.share({ title: titulo, url })
    } catch {
      // El usuario canceló el diálogo de compartir: no es un error.
    }
    return 'nativo'
  }
  return (await copiarAlPortapapeles(url)) ? 'copiado' : 'fallo'
}
