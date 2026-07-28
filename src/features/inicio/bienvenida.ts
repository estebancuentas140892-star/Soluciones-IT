// Bienvenida del primer dia (tarea 184, turno 3 del handoff): los tres
// pasos que dejan a un tecnico nuevo listo para trabajar, y la regla de
// cuando el bloque se retira solo.
//
// El problema que resuelve: con la base vacia, seis de los nueve bloques
// de Inicio no se pintan (se ocultan si estan vacios), asi que la primera
// impresion de la app eran un saludo, un buscador y tres atajos. Y lo mas
// importante que tiene que hacer un tecnico el primer dia (instalar la
// app y bajar los adjuntos, de lo que depende el trabajo sin señal) no se
// ofrecia en ninguna pantalla.
//
// Logica pura y sin dependencias del navegador: quien la use le pasa lo
// que ya sabe (si corre instalada, si hubo descarga) y recibe los pasos
// ya resueltos. Asi la regla se prueba sin montar la pantalla.

export type ClavePasoBienvenida = 'sesion' | 'instalar' | 'offline'

export interface PasoBienvenida {
  clave: ClavePasoBienvenida
  // Numero visible del paso (1, 2, 3): no cambia cuando uno se cumple,
  // porque los pasos hechos no se quitan de la lista, se apagan.
  numero: number
  titulo: string
  hecho: boolean
  // El primero que falta: es el unico que se pinta en el acento. Los
  // demas pendientes quedan en neutro, para que no compitan por la
  // atencion (regla R1, un solo lenguaje de color por superficie).
  siguiente: boolean
}

export interface EntradaBienvenida {
  // Corre ya como app instalada (ver src/lib/instalacionPwa.ts).
  instalada: boolean
  // Hubo al menos una descarga de adjuntos para offline (el
  // `ultimaDescarga` de adjuntosOffline.ts).
  descargaHecha: boolean
}

// El paso 1 siempre esta hecho: esta pantalla solo se ve con sesion
// abierta. Aparece igual porque el primer paso cumplido es la prueba de
// que la lista se apaga sola, y da sentido a los otros dos.
export function pasosBienvenida({ instalada, descargaHecha }: EntradaBienvenida): PasoBienvenida[] {
  const pasos: Omit<PasoBienvenida, 'numero' | 'siguiente'>[] = [
    { clave: 'sesion', titulo: 'Entraste con tu cuenta', hecho: true },
    { clave: 'instalar', titulo: 'Instala la app en el teléfono', hecho: instalada },
    { clave: 'offline', titulo: 'Descarga todo para trabajar sin señal', hecho: descargaHecha },
  ]
  const primerPendiente = pasos.findIndex((paso) => !paso.hecho)
  return pasos.map((paso, indice) => ({
    ...paso,
    numero: indice + 1,
    siguiente: indice === primerPendiente,
  }))
}

export interface EntradaVisibilidad {
  pasos: PasoBienvenida[]
  // ¿Inicio ya tiene bloques propios que mostrar? Son exactamente los
  // tres que nombra el handoff: recientes, pendientes y un procedimiento
  // a medias. Cuando aparecen, la bienvenida deja de ser la primera
  // impresion y se retira sin que nadie la cierre.
  hayBloquesReales: boolean
}

export function debeMostrarBienvenida({ pasos, hayBloquesReales }: EntradaVisibilidad): boolean {
  if (hayBloquesReales) return false
  return pasos.some((paso) => !paso.hecho)
}
