// Diccionario de sinonimos de la busqueda: permite encontrar
// "Crear copia de seguridad" buscando "backup", o "Diagnostico de
// red" buscando "internet", aunque la palabra escrita no aparezca en
// el contenido. Curado a mano para el dominio del equipo (POS,
// impresoras, camaras, redes); si crece mucho, puede moverse a datos
// editables.
//
// Cada grupo agrupa terminos equivalentes. La expansion es simetrica:
// buscar cualquiera de ellos agrega los demas terminos del grupo a la
// consulta (que MiniSearch combina con OR, asi que solo AGREGA
// resultados; el orden por relevancia no cambia para las
// coincidencias exactas). Las entradas de varias palabras ("copia de
// seguridad") solo aportan sus palabras como expansion, no funcionan
// como termino de busqueda (detectar frases en la consulta seria
// desproporcionado para este tamano de datos).
const GRUPOS_SINONIMOS: string[][] = [
  ['backup', 'respaldo', 'copia de seguridad'],
  ['internet', 'red', 'wifi', 'ip', 'conexion'],
  ['impresora', 'impresion', 'imprimir'],
  ['contraseña', 'clave', 'password'],
  ['computador', 'computadora', 'pc', 'equipo'],
  ['camara', 'cctv', 'video'],
  ['pos', 'datafono', 'punto de venta'],
  ['correo', 'email'],
  ['servidor', 'server'],
  ['pantalla', 'monitor'],
  ['lento', 'lentitud', 'demorado'],
  ['encender', 'prender'],
]

// Palabras sin valor de busqueda que no vale la pena agregar cuando
// un sinonimo de varias palabras se expande.
const PALABRAS_VACIAS = new Set(['de', 'la', 'el', 'a', 'y', 'en'])

// La busqueda debe ser insensible a acentos ("camara" y "cámara" son
// la misma palabra para el tecnico que escribe rapido en el celular).
function normalizar(termino: string): string {
  return termino
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

function palabrasDe(entrada: string): string[] {
  return normalizar(entrada)
    .split(/\s+/)
    .filter((p) => p !== '' && !PALABRAS_VACIAS.has(p))
}

// termino normalizado -> palabras que agrega a la consulta.
function construirMapa(): Map<string, string[]> {
  const mapa = new Map<string, string[]>()
  for (const grupo of GRUPOS_SINONIMOS) {
    for (const entrada of grupo) {
      // Solo las entradas de UNA palabra funcionan como termino de
      // busqueda (ver comentario del diccionario).
      if (entrada.includes(' ')) continue
      const clave = normalizar(entrada)
      const expansion = grupo
        .filter((otra) => otra !== entrada)
        .flatMap(palabrasDe)
      mapa.set(clave, [...new Set(expansion)])
    }
  }
  return mapa
}

const MAPA_SINONIMOS = construirMapa()

// Expande la consulta con los sinonimos de cada palabra escrita.
// "backup impresora" -> "backup impresora respaldo copia seguridad
// impresion imprimir". Los terminos originales van primero y nunca se
// pierden; sin sinonimos que aplicar, la consulta sale igual.
export function expandirConsulta(consulta: string): string {
  const terminos = consulta.trim().split(/\s+/).filter(Boolean)
  const extra = new Set<string>()
  for (const termino of terminos) {
    for (const sinonimo of MAPA_SINONIMOS.get(normalizar(termino)) ?? []) {
      extra.add(sinonimo)
    }
  }
  // No repetir palabras que el usuario ya escribio.
  const escritas = new Set(terminos.map(normalizar))
  const agregadas = [...extra].filter((palabra) => !escritas.has(palabra))
  return agregadas.length === 0 ? consulta : `${consulta} ${agregadas.join(' ')}`
}
