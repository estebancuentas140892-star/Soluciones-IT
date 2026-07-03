// Analizador de CSV sin dependencias, pensado para los archivos que
// produce Excel en español: detecta el separador (coma, punto y coma
// o tabulador), respeta las comillas (campos con el separador o con
// saltos de línea adentro, comillas escapadas como "") y tolera los
// finales de línea de Windows.

export type Separador = ',' | ';' | '\t'

// Excel en español suele guardar los CSV en Windows-1252, no en UTF-8.
// Primero se intenta UTF-8 estricto; si los bytes no son UTF-8 válido,
// se reinterpreta como Windows-1252 para que la ñ y las tildes no
// lleguen convertidas en el carácter de reemplazo.
export function decodificarBytes(bytes: Uint8Array): string {
  let texto: string
  try {
    texto = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    texto = new TextDecoder('windows-1252').decode(bytes)
  }
  return texto.replace(new RegExp('^\\uFEFF'), '')
}

// Gana el separador que más veces aparece fuera de comillas en la
// línea de encabezados. Si ninguno aparece, se asume coma (archivo de
// una sola columna).
export function detectarSeparador(texto: string): Separador {
  const encabezado = primeraLinea(texto)
  let elegido: Separador = ','
  let mayorConteo = 0
  for (const candidato of [';', ',', '\t'] as const) {
    const conteo = contarFueraDeComillas(encabezado, candidato)
    if (conteo > mayorConteo) {
      elegido = candidato
      mayorConteo = conteo
    }
  }
  return elegido
}

export function parsearCsv(texto: string, separador?: Separador): string[][] {
  const limpio = texto.replace(new RegExp('^\\uFEFF'), '')
  const divisor = separador ?? detectarSeparador(limpio)

  const filas: string[][] = []
  let fila: string[] = []
  let celda = ''
  let enComillas = false

  let i = 0
  while (i < limpio.length) {
    const caracter = limpio[i]

    if (enComillas) {
      if (caracter === '"') {
        if (limpio[i + 1] === '"') {
          celda += '"'
          i += 2
          continue
        }
        enComillas = false
        i += 1
        continue
      }
      celda += caracter
      i += 1
      continue
    }

    if (caracter === '"' && celda === '') {
      enComillas = true
      i += 1
      continue
    }
    if (caracter === divisor) {
      fila.push(celda)
      celda = ''
      i += 1
      continue
    }
    if (caracter === '\r') {
      i += 1
      continue
    }
    if (caracter === '\n') {
      fila.push(celda)
      filas.push(fila)
      fila = []
      celda = ''
      i += 1
      continue
    }
    celda += caracter
    i += 1
  }

  if (celda !== '' || fila.length > 0) {
    fila.push(celda)
    filas.push(fila)
  }

  // Excel suele dejar filas vacías al final; no aportan nada.
  while (filas.length > 0 && filas[filas.length - 1].every((valor) => valor.trim() === '')) {
    filas.pop()
  }

  return filas
}

function primeraLinea(texto: string): string {
  let enComillas = false
  for (let i = 0; i < texto.length; i += 1) {
    const caracter = texto[i]
    if (caracter === '"') enComillas = !enComillas
    if (caracter === '\n' && !enComillas) return texto.slice(0, i)
  }
  return texto
}

function contarFueraDeComillas(texto: string, buscado: string): number {
  let conteo = 0
  let enComillas = false
  for (const caracter of texto) {
    if (caracter === '"') enComillas = !enComillas
    else if (caracter === buscado && !enComillas) conteo += 1
  }
  return conteo
}
