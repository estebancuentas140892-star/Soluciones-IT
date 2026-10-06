import type { BloquePaso, DestinoOpcion, PasoProcedimiento } from '../../lib/db'
import { esDecisionConOpciones } from '../../lib/procedimiento'
import { caminoDeOpcion, decisionDeRuta, type Ruta } from '../../lib/rutaProcedimiento'
import { tituloDePaso } from './estadoPasos'

// LO QUE EL EDITOR DICE DE LOS CAMINOS DE UNA GUÍA (tarea 302).
//
// Quien escribe una guía con decisiones tiene que poder ver, sin ejecutarla,
// a dónde lleva cada respuesta y por dónde sigue cada paso. Aquí viven esas
// frases, puras, para que el editor solo pinte y las pruebas las fijen. Los
// pasos se nombran por su número en el editor (el que ve el autor) y su
// título.

/** ¿La guía tiene caminos? Entonces cada paso enseña dónde sigue al terminar. */
export function guiaConCaminos(pasos: PasoProcedimiento[]): boolean {
  return pasos.some(
    (paso) => paso.alTerminar !== undefined || paso.bloques.some((bloque) => esDecisionConOpciones(bloque)),
  )
}

/**
 * ¿Cuenta dónde sigue este paso al terminar? No en el paso de una decisión
 * cuyas respuestas llevan todas a un paso o al final: ninguna sigue la
 * continuación del paso, y ofrecerla haría pensar que decide algo.
 */
export function usaAlTerminar(paso: PasoProcedimiento): boolean {
  const decision = decisionDeRuta(paso)
  if (!decision) return true
  return (decision.opciones ?? []).some((opcion) => opcion.destino.tipo === 'continuar' || opcion.destino.tipo === 'guia')
}

/** "Paso 4 · Guardar y comprobar el archivo", o null si el paso no existe. */
export function nombreDePaso(pasos: PasoProcedimiento[], pasoId: string): string | null {
  const indice = pasos.findIndex((paso) => paso.id === pasoId)
  if (indice < 0) return null
  const titulo = pasos[indice].titulo.trim()
  return titulo ? `Paso ${indice + 1} · ${titulo}` : `Paso ${indice + 1}`
}

/** Los pasos a los que se puede saltar desde el paso `indice`: los posteriores. */
export function pasosPosteriores(pasos: PasoProcedimiento[], indice: number): { id: string; numero: number; titulo: string }[] {
  return pasos.slice(indice + 1).map((paso, i) => ({
    id: paso.id,
    numero: indice + 2 + i,
    titulo: tituloDePaso(paso, indice + 1 + i),
  }))
}

/**
 * Por dónde sigue el paso `indice` cuando nada lo desvía: su "al terminar"
 * o el de abajo. Es lo que hace "Continuar" en una decisión de ese paso.
 */
export function siguientePorDefecto(pasos: PasoProcedimiento[], indice: number): string {
  const alTerminar = pasos[indice]?.alTerminar
  if (alTerminar?.tipo === 'fin') return 'termina la guía'
  if (alTerminar?.tipo === 'paso') {
    const nombre = nombreDePaso(pasos, alTerminar.pasoId)
    if (nombre) return `sigue en el ${minuscula(nombre)}`
  }
  const siguiente = pasos[indice + 1]
  return siguiente ? `sigue en el ${minuscula(nombreDePaso(pasos, siguiente.id) as string)}` : 'termina la guía'
}

function minuscula(texto: string): string {
  return texto.charAt(0).toLowerCase() + texto.slice(1)
}

/** El rótulo del botón que elige a dónde lleva una opción. */
export function etiquetaDestinoOpcion(destino: DestinoOpcion, pasos: PasoProcedimiento[], indicePaso: number): string {
  switch (destino.tipo) {
    case 'continuar':
      return `Continuar: ${siguientePorDefecto(pasos, indicePaso)}`
    case 'paso': {
      if (!destino.pasoId) return 'Ir a un paso: elige cuál'
      const nombre = nombreDePaso(pasos, destino.pasoId)
      return nombre ? `Ir al ${minuscula(nombre)}` : 'Ir a un paso que ya no existe'
    }
    case 'guia':
      return destino.articuloId ? `Abrir «${destino.titulo.trim() || 'guía sin título'}»` : 'Abrir una guía: elige cuál'
    case 'fin':
      return 'Terminar la guía'
  }
}

/**
 * EL CAMINO DE UNA RESPUESTA, en una línea: "Después: 2 → 4 → 5 → 6". Si
 * acaba en otra decisión, lo dice; si la respuesta termina la guía, también.
 * Con una guía, primero la guía.
 */
export function textoCamino(
  pasos: PasoProcedimiento[],
  pasoId: string,
  decision: BloquePaso,
  opcionId: string,
): string {
  const opcion = decision.opciones?.find((o) => o.id === opcionId)
  if (!opcion) return ''
  if (opcion.destino.tipo === 'fin') return 'Después: termina la guía.'
  const camino: Ruta = caminoDeOpcion({ pasos }, pasoId, decision.id, opcionId)
  const numeros = camino.pasos.map((paso) => String(pasos.indexOf(paso) + 1))
  const tras = numeros.length === 0 ? 'termina la guía' : numeros.join(' → ')
  const otraDecision = camino.pendiente ? `, donde se decide otra vez` : ''
  const guia =
    opcion.destino.tipo === 'guia' && opcion.destino.articuloId
      ? `«${opcion.destino.titulo.trim() || 'la guía'}», y después `
      : ''
  return `Después: ${guia}${tras}${otraDecision}.`
}

/** El rótulo del control que elige por dónde sigue un paso al terminar. */
export function etiquetaAlTerminar(pasos: PasoProcedimiento[], indice: number): string {
  const alTerminar = pasos[indice]?.alTerminar
  if (alTerminar?.tipo === 'paso') {
    const nombre = nombreDePaso(pasos, alTerminar.pasoId)
    return nombre ? `Al terminar, ir al ${minuscula(nombre)}` : 'Al terminar, ir a un paso que ya no existe'
  }
  if (alTerminar?.tipo === 'fin') return 'Al terminar, termina la guía'
  const siguiente = pasos[indice + 1]
  return siguiente
    ? `Al terminar, sigue en el ${minuscula(nombreDePaso(pasos, siguiente.id) as string)}`
    : 'Al terminar, termina la guía'
}
