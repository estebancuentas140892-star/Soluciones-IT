import type { TipoSecreto } from '../../lib/db'

// Qué hace falta para que un acceso NO quede vacío.
//
// Hasta ahora el editor solo exigía el título, así que se podía guardar
// una "cuenta" sin contraseña, una "nota segura" sin texto o un
// "archivo seguro" sin archivo: filas que ocupan sitio en la Bóveda,
// aparecen en las búsquedas y no responden a la única pregunta que se
// le hace a la sección ("¿cuál es la clave de esto?").
//
// Cada tipo tiene su propio dato mínimo, así que la regla vive aquí,
// separada del formulario, y se prueba sola. El formulario la usa para
// dos cosas a la vez: marcar el campo que falta y escribir en la barra
// inferior qué falta, sin inventar dos textos distintos.
//
// No valida nada más: usuario, URL, categoría, vencimiento, equipos y
// notas (fuera de "Nota segura") siguen siendo opcionales.

/** Campo del formulario al que se ancla el error. */
export type CampoFaltante = 'titulo' | 'contrasena' | 'archivo' | 'notas'

export interface DatoProtegido {
  clave: string
  valor: string
}

export interface EntradaAcceso {
  tipo: TipoSecreto
  titulo: string
  /** Contraseña, clave/PIN o token según el tipo. */
  contrasena: string
  notas: string
  /** Si hay un archivo cifrado elegido (tipo `archivo`). */
  tieneArchivo: boolean
  /** "Otros datos protegidos": alternativa válida para el tipo `llave`. */
  extras: DatoProtegido[]
}

export interface Faltante {
  campo: CampoFaltante
  /** Frase corta, tal cual se muestra junto al campo y en la barra. */
  mensaje: string
}

// Un dato protegido cuenta solo si tiene nombre Y valor: una fila a
// medio escribir no es un secreto guardado.
function hayDatoProtegido(extras: DatoProtegido[]): boolean {
  return extras.some((e) => e.clave.trim() !== '' && e.valor.trim() !== '')
}

/**
 * Devuelve lo que falta, en el orden en que aparece en el formulario.
 * Lista vacía = se puede guardar.
 */
export function faltantesDeAcceso(entrada: EntradaAcceso): Faltante[] {
  const faltantes: Faltante[] = []

  if (entrada.titulo.trim() === '') {
    faltantes.push({ campo: 'titulo', mensaje: 'Falta el nombre del acceso' })
  }

  const hayClave = entrada.contrasena.trim() !== ''

  switch (entrada.tipo) {
    case 'cuenta':
      // El usuario sigue siendo opcional: hay servicios que solo piden
      // una clave. La contraseña, no.
      if (!hayClave) faltantes.push({ campo: 'contrasena', mensaje: 'Falta la contraseña' })
      break
    case 'red':
      if (!hayClave) faltantes.push({ campo: 'contrasena', mensaje: 'Falta la clave o PIN' })
      break
    case 'llave':
      // Un token puede venir partido en varios datos (identificador +
      // secreto), así que vale el campo principal o al menos un dato
      // protegido con nombre y valor.
      if (!hayClave && !hayDatoProtegido(entrada.extras)) {
        faltantes.push({
          campo: 'contrasena',
          mensaje: 'Falta el token, licencia o clave, o algún dato protegido',
        })
      }
      break
    case 'archivo':
      if (!entrada.tieneArchivo) {
        faltantes.push({ campo: 'archivo', mensaje: 'Falta elegir el archivo' })
      }
      break
    case 'nota':
      if (entrada.notas.trim() === '') {
        faltantes.push({ campo: 'notas', mensaje: 'Falta el texto de la nota' })
      }
      break
  }

  return faltantes
}
