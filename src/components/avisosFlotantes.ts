import { useSyncExternalStore } from 'react'

// EL AVISO FLOTANTE (tarea 341, handoff móvil "1b Pulgar": "Aviso (toast):
// sobre el pie fijo, invertido, 200 ms, 2.4 s. Nunca muestra un secreto").
//
// Una confirmación breve de algo que ya pasó y no pide nada más: la IP se
// copió, el avance de la guía quedó guardado, la Bóveda se desbloqueó, el
// mantenimiento quedó en el historial. NO es para errores ni para nada que
// exija una acción: esos se dicen donde ocurren, y se quedan hasta que se
// atienden. Un aviso nuevo sustituye al anterior.
//
// Es un almacén de módulo y no un contexto: lo llama quien termina algo
// (un botón, un guardado) desde cualquier pantalla, y el aviso vive en la
// raíz de la app (`AvisoFlotante`), fuera de las rutas, para que siga a la
// vista aunque la acción navegue (salir de la guía con la X).

export type IconoAviso = 'hecho' | 'copiado' | 'candado' | 'historial'

export interface Aviso {
  /** Cambia en cada aviso, aunque el texto se repita: así se vuelve a anunciar. */
  id: number
  texto: string
  icono: IconoAviso
}

/** Lo que dura a la vista, como en el handoff. */
export const DURACION_AVISO_MS = 2400

let actual: Aviso | null = null
let siguienteId = 1
let temporizador: ReturnType<typeof setTimeout> | undefined
const suscriptores = new Set<() => void>()

function notificar(): void {
  for (const escucha of suscriptores) escucha()
}

function suscribir(escucha: () => void): () => void {
  suscriptores.add(escucha)
  return () => suscriptores.delete(escucha)
}

/** Muestra `texto` 2,4 s. Nunca un secreto: el aviso lo lee cualquiera. */
export function avisar(texto: string, icono: IconoAviso = 'hecho'): void {
  clearTimeout(temporizador)
  actual = { id: siguienteId++, texto, icono }
  notificar()
  temporizador = setTimeout(() => {
    actual = null
    notificar()
  }, DURACION_AVISO_MS)
}

/** Para las pruebas: quita el aviso a la vista sin esperar. */
export function retirarAviso(): void {
  clearTimeout(temporizador)
  actual = null
  notificar()
}

export function useAvisoFlotante(): Aviso | null {
  return useSyncExternalStore(
    suscribir,
    () => actual,
    () => null,
  )
}
