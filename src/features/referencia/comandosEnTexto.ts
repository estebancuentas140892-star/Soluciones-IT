import type { Referencia } from '../../lib/db'

// "¿QUÉ HACE ESTE COMANDO?" DENTRO DE UNA TAREA (tarea 270, sección 14
// del encargo del 2026-09-23).
//
// El autor enlaza una ficha del Centro de consulta a una tarea cuando
// quiere (un bloque de referencia: la tarjeta del comando o la etiqueta
// del término). Pero muchas instrucciones ya ESCRIBEN el comando o el
// atajo ("Ejecutar ipconfig /flushdns", "Pulsar Win + R") sin enlazar
// nada, y el técnico no sabe que el Centro de consulta lo explica.
//
// Esto encuentra esos casos sin adivinar: solo el VALOR EXACTO de un
// comando o de un atajo que existe como ficha, escrito entero en la
// instrucción. Se toleran lo que no cambia lo escrito: mayúsculas y
// espacios de sobra, y en los atajos los espacios alrededor del "+"
// ("Win+R" es "Win + R"). Nada de sinónimos, abreviaturas ni parecidos.
//
// LOS HUECOS DEL VALOR. Una ficha escribe el argumento como un hueco
// ("ping [dirección]", "net user <usuario> /active:yes"), y la
// instrucción lo escribe con el dato ("ping 192.0.2.40"). Un hueco entre
// corchetes, ángulos o llaves vale por UNA palabra cualquiera; los del
// final son opcionales, porque son los argumentos del comando ("ejecutar
// ping" también es el comando). Lo demás sigue siendo literal.
// Los términos y las herramientas NO se detectan: una palabra del
// glosario puede aparecer en otro sentido, y subrayarla sería adivinar
// (ver ChipReferencia).

/** Cuántas fichas se ofrecen como mucho por instrucción. */
export const MAXIMO_POR_TAREA = 3

function normalizar(texto: string): string {
  return texto.replace(/\s*\+\s*/g, '+').replace(/\s+/g, ' ').trim().toLowerCase()
}

// Un carácter que continúa una palabra: si toca el valor por un lado, el
// valor está dentro de otra palabra ("ping" en "pingüino").
const CONTINUA_PALABRA = /[\p{L}\p{N}_]/u

const HUECO = /^[[<{].*[\]>}]$/

function escapar(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * El patrón que busca un valor ya normalizado, o null si no deja nada
 * literal que buscar (un valor que es solo un hueco, o de una letra).
 */
function patronDe(valor: string): RegExp | null {
  const partes = valor.split(' ')
  // Los huecos del final son los argumentos: opcionales, así que no se
  // buscan.
  while (partes.length > 0 && HUECO.test(partes[partes.length - 1])) partes.pop()
  const literal = partes.filter((parte) => !HUECO.test(parte)).join('')
  if (literal.length < 2) return null
  return new RegExp(partes.map((parte) => (HUECO.test(parte) ? '\\S+' : escapar(parte))).join(' '), 'g')
}

interface Hallazgo {
  referencia: Referencia
  inicio: number
  fin: number
}

/**
 * Los comandos y atajos del Centro de consulta que la instrucción escribe
 * enteros, en el orden en que aparecen, sin repetir. Si uno está dentro
 * de otro que también coincide ("ipconfig" dentro de "ipconfig /all"),
 * gana el más largo: es el que el técnico va a teclear.
 */
export function comandosEnTexto(texto: string, referencias: Iterable<Referencia>): Referencia[] {
  const plano = normalizar(texto)
  if (plano === '') return []
  const hallazgos: Hallazgo[] = []
  // Dos fichas con el mismo valor (un duplicado del catálogo) darían dos
  // etiquetas iguales: se ofrece la primera.
  const valoresVistos = new Set<string>()
  for (const referencia of referencias) {
    if (referencia.eliminadoEn) continue
    if (referencia.tipo !== 'comando' && referencia.tipo !== 'atajo') continue
    const valor = normalizar(referencia.valor ?? '')
    if (valoresVistos.has(valor)) continue
    const patron = patronDe(valor)
    if (!patron) continue
    valoresVistos.add(valor)
    for (let coincidencia = patron.exec(plano); coincidencia; coincidencia = patron.exec(plano)) {
      const inicio = coincidencia.index
      const fin = inicio + coincidencia[0].length
      const bordeIzquierdo = inicio === 0 || !CONTINUA_PALABRA.test(plano[inicio - 1])
      const bordeDerecho = fin === plano.length || !CONTINUA_PALABRA.test(plano[fin])
      if (bordeIzquierdo && bordeDerecho) {
        hallazgos.push({ referencia, inicio, fin })
        break
      }
      // Sigue buscando desde la letra siguiente (no desde el final): un
      // intento dentro de otra palabra no debe tapar uno bueno que empieza
      // justo después.
      patron.lastIndex = inicio + 1
    }
  }
  const sinContenidos = hallazgos.filter(
    (h) =>
      !hallazgos.some(
        (otro) => otro !== h && otro.inicio <= h.inicio && otro.fin >= h.fin && otro.fin - otro.inicio > h.fin - h.inicio,
      ),
  )
  return sinContenidos
    .sort((a, b) => a.inicio - b.inicio)
    .slice(0, MAXIMO_POR_TAREA)
    .map((h) => h.referencia)
}

/** Los ids de las fichas que un paso ya enlaza, en cualquiera de sus bloques. */
export function fichasEnlazadasDelPaso(bloques: { tipo: string; referenciaId?: string | null }[]): Set<string> {
  const ids = new Set<string>()
  for (const bloque of bloques) {
    if (bloque.tipo === 'referencia' && bloque.referenciaId) ids.add(bloque.referenciaId)
  }
  return ids
}
