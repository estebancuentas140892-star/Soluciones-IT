// Contador de la sesión de escaneo (auditoría móvil del 2026-08-03,
// hallazgo M-029, mockup `8b`).
//
// El escáner ya cumplía lo importante: acusa lo leído antes de navegar,
// muestra el código en monoespaciado y deja la búsqueda manual siempre a
// mano. Lo que fallaba era el CICLO: "Abrir la ficha" reemplazaba el
// escáner en el historial y la ficha volvía a Equipos, así que
// inventariar diez equipos de un rack costaba cuatro toques por equipo
// en vez de dos.
//
// Con el regreso arreglado (regla M-R2) hace falta además lo que da
// sentido a quedarse: saber cuántos llevas. De ahí este contador.
//
// **Qué es "la sesión", y por qué se reinicia a mano.** La primera
// versión de esta tarea intentaba adivinarlo con un marcador: el escáner
// lo escribía antes de saltar a una ficha y lo consumía al volver, de
// modo que entrar desde "Más" empezaba de cero y volver de una ficha
// seguía contando. Se descartó al probarlo: consumir el marcador al
// montar **no es idempotente**, y el doble montaje que React hace en
// desarrollo (StrictMode) lo destapó enseguida, dejando el contador y el
// almacenamiento diciendo cosas distintas. Ese doble montaje existe
// justamente para cazar esto.
//
// La regla que queda es una sola y el técnico la puede ver: el conteo
// vive mientras viva la pestaña, y se reinicia tocándolo. Sin reglas
// invisibles sobre cuándo empieza una sesión y cuándo no.
//
// Vive en `sessionStorage` y no en Dexie a propósito: es un dato de esta
// pestaña y de este rato, no del equipo. No se sincroniza, y cerrar la
// aplicación lo borra solo.

const CLAVE_CODIGOS = 'escaner:codigos-leidos'

// `sessionStorage` puede no existir o lanzar (modo privado de algunos
// navegadores, cuota llena). El contador es un adorno útil, nunca un
// motivo para que el escáner deje de escanear, así que todo va envuelto.
function leer(): string[] {
  try {
    const crudo = sessionStorage.getItem(CLAVE_CODIGOS)
    if (!crudo) return []
    const valor: unknown = JSON.parse(crudo)
    return Array.isArray(valor) ? valor.filter((c): c is string => typeof c === 'string') : []
  } catch {
    return []
  }
}

function guardar(codigos: string[]): void {
  try {
    sessionStorage.setItem(CLAVE_CODIGOS, JSON.stringify(codigos))
  } catch {
    // Sin almacenamiento no hay contador, y no pasa nada más.
  }
}

/**
 * Los códigos leídos que lleva la sesión. Es una lectura pura: se puede
 * llamar en un render, en un inicializador de estado o dos veces
 * seguidas sin que cambie nada.
 */
export function codigosLeidos(): string[] {
  return leer()
}

/**
 * Registra un código resuelto y devuelve la lista actualizada. Los
 * repetidos no suman: apuntar dos veces a la misma etiqueta no es haber
 * inventariado dos equipos.
 */
export function registrarCodigoLeido(codigo: string): string[] {
  const codigos = leer()
  if (codigos.includes(codigo)) return codigos
  const actualizados = [...codigos, codigo]
  guardar(actualizados)
  return actualizados
}

/** Vacía el conteo. Lo dispara el técnico tocando el contador. */
export function reiniciarConteo(): string[] {
  guardar([])
  return []
}
