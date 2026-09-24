import QRCode from 'qrcode'

// La matriz del QR como una sola ruta SVG ("M3 2h1v1h-1z…"), con zona
// tranquila de 2 módulos. Separada del componente para poder probarla.
export function rutaDeModulos(texto: string): { lado: number; ruta: string } {
  const qr = QRCode.create(texto, { errorCorrectionLevel: 'M' })
  const { size, data } = qr.modules
  const margen = 2
  const partes: string[] = []
  for (let fila = 0; fila < size; fila += 1) {
    for (let columna = 0; columna < size; columna += 1) {
      if (data[fila * size + columna]) partes.push(`M${columna + margen} ${fila + margen}h1v1h-1z`)
    }
  }
  return { lado: size + margen * 2, ruta: partes.join('') }
}
