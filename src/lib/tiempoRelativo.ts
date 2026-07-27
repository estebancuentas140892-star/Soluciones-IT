// Antigüedad de un dato en lenguaje humano ("hace 4 min"). Nace con la
// pastilla de frescura de las listas (regla R7 de la auditoría de
// Soluciones: toda pantalla de lista dice qué tan al día está el dato y
// si hay cambios sin subir).
//
// No usa Intl.RelativeTimeFormat a propósito: el formateador nativo
// obliga a elegir la unidad por fuera (es lo que se quiere calcular) y
// su redondeo deja frases raras en el tramo corto, que es justo el que
// más se ve ("hace 40 segundos" cuando basta "hace un momento"). Aquí
// interesa una sola cadena corta, estable y en español.

const MINUTO = 60_000
const HORA = 60 * MINUTO
const DIA = 24 * HORA

// Devuelve null cuando no hay fecha o no es interpretable, para que
// quien la use pueda omitir la frase entera en vez de escribir
// "hace NaN". `ahora` es inyectable para poder probarla sin relojes.
export function tiempoRelativo(iso: string | null | undefined, ahora: number = Date.now()): string | null {
  if (!iso) return null
  const fecha = new Date(iso).getTime()
  if (Number.isNaN(fecha)) return null

  // Una fecha en el futuro solo aparece por desfase de reloj entre
  // dispositivos del equipo (el dato viene de otro teléfono). Se trata
  // como "recién", que es lo que el técnico entiende, en vez de
  // "hace -3 min".
  const transcurrido = Math.max(0, ahora - fecha)

  if (transcurrido < MINUTO) return 'hace un momento'
  if (transcurrido < HORA) {
    const minutos = Math.floor(transcurrido / MINUTO)
    return `hace ${minutos} min`
  }
  if (transcurrido < DIA) {
    const horas = Math.floor(transcurrido / HORA)
    return `hace ${horas} h`
  }
  const dias = Math.floor(transcurrido / DIA)
  return dias === 1 ? 'hace 1 día' : `hace ${dias} días`
}
