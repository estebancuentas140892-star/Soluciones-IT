// Diccionario de sinonimos de la busqueda: permite encontrar
// "Crear copia de seguridad" buscando "backup", o "Diagnostico de
// red" buscando "internet", aunque la palabra escrita no aparezca en
// el contenido. Curado a mano para el dominio del equipo (POS,
// impresoras, camaras, redes y las herramientas de Metroparques); si
// crece mucho, puede moverse a datos editables.
//
// Los sinonimos solo AGREGAN resultados, nunca restan. Y desde el
// 2026-09-15 no pueden adelantarse a lo escrito: el indice pone primero
// lo que coincide con lo que el tecnico tecleo y despues lo que solo
// trae un sinonimo (`buscarConSinonimos`, en useIndiceBusqueda.ts).

// GRUPOS SIMETRICOS: buscar cualquiera de sus entradas agrega las demas.
// Una entrada de varias palabras ("copia de seguridad") aporta sus
// palabras sueltas cuando se busca otra del grupo, y desde el
// 2026-09-14 tambien se detecta cuando se escribe entera, seguida.
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
  // Herramientas del Centro de consulta (2026-09-14). Solo grupos cuyas
  // entradas nombran LO MISMO, o algo tan acotado que traerlo nunca
  // estorba: buscar "esxi" y ver VMware es encontrar lo que se buscaba.
  ['tightvnc', 'vnc'],
  ['icg', 'icg manager'],
  ['sonicwall', 'firewall'],
  ['vmware', 'esxi', 'virtualización'],
  ['issabel', 'pbx', 'telefonía'],
  ['ssms', 'sql server management studio'],
]

// GRUPOS DE UNA VIA (2026-09-14): las `claves` agregan `agrega`, pero
// buscar lo agregado NO trae de vuelta las claves.
//
// Existen para no contaminar los resultados. Buscar "acceso remoto"
// tiene que encontrar TightVNC y AnyDesk; pero si buscar "anydesk"
// agregara "acceso" y "remoto", por prefijo traeria "Punto de acceso",
// "Control de acceso" y cada ficha que diga "remotamente". Lo mismo con
// "zabbix" (agregaria "monitoreo", que por la tolerancia a erratas
// encuentra cada "monitor" del inventario), "sicof" ("ada" encuentra
// "cada" y "adaptadores") o "workflow" ("document" encuentra cada
// "documentado"). La palabra general lleva a la herramienta; la
// herramienta no arrastra la palabra general.
//
// HKA (2026-09-15) era un grupo simetrico con "factura" y "facturacion":
// buscar "hka" arrastraba cualquier guia que nombrara una factura, y
// buscar "factura" metia a HKA por sinonimo. Ahora solo la frase entera
// "facturación electrónica", que es a lo que HKA se dedica, lleva a HKA.
const GRUPOS_DE_UNA_VIA: { claves: string[]; agrega: string[] }[] = [
  { claves: ['acceso remoto', 'control remoto'], agrega: ['tightvnc', 'vnc'] },
  { claves: ['acceso remoto'], agrega: ['anydesk'] },
  { claves: ['monitoreo', 'monitorización'], agrega: ['zabbix'] },
  { claves: ['ada', 'erp'], agrega: ['sicof'] },
  { claves: ['front rest'], agrega: ['frontrest'] },
  { claves: ['document', 'gestión documental'], agrega: ['workflow'] },
  { claves: ['documentos'], agrega: ['sharepoint'] },
  { claves: ['facturación electrónica'], agrega: ['hka'] },
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

// Una regla: cuando la consulta contiene `palabras` (una sola, o una
// frase seguida), agrega `agrega`.
interface Regla {
  palabras: string[]
  agrega: string[]
}

function construirReglas(): Regla[] {
  const reglas: Regla[] = []
  for (const grupo of GRUPOS_SINONIMOS) {
    for (const entrada of grupo) {
      const palabras = palabrasDe(entrada)
      if (palabras.length === 0) continue
      const agrega = grupo.filter((otra) => otra !== entrada).flatMap(palabrasDe)
      reglas.push({ palabras, agrega })
    }
  }
  for (const grupo of GRUPOS_DE_UNA_VIA) {
    const agrega = grupo.agrega.flatMap(palabrasDe)
    for (const clave of grupo.claves) {
      const palabras = palabrasDe(clave)
      if (palabras.length > 0) reglas.push({ palabras, agrega })
    }
  }
  return reglas
}

const REGLAS = construirReglas()

// ¿Aparece `frase` como palabras seguidas dentro de `palabras`?
function contieneFrase(palabras: string[], frase: string[]): boolean {
  for (let inicio = 0; inicio + frase.length <= palabras.length; inicio++) {
    if (frase.every((palabra, desplazamiento) => palabras[inicio + desplazamiento] === palabra)) return true
  }
  return false
}

/**
 * Las palabras que los sinonimos agregan a lo escrito, normalizadas y
 * sin repetir nada de lo que ya se tecleo. Vacia si ninguno aplica.
 *
 * Separada de `expandirConsulta` para que el indice pueda buscarlas
 * APARTE y ponerlas detras de lo escrito.
 */
export function sinonimosDe(consulta: string): string[] {
  const escritas = palabrasDe(consulta)
  const extra = new Set<string>()
  for (const regla of REGLAS) {
    if (!contieneFrase(escritas, regla.palabras)) continue
    for (const palabra of regla.agrega) extra.add(palabra)
  }
  const yaEscritas = new Set(consulta.trim().split(/\s+/).filter(Boolean).map(normalizar))
  return [...extra].filter((palabra) => !yaEscritas.has(palabra))
}

// Expande la consulta con los sinonimos de lo escrito.
// "backup impresora" -> "backup impresora respaldo copia seguridad
// impresion imprimir". Los terminos originales van primero y nunca se
// pierden; sin sinonimos que aplicar, la consulta sale igual.
export function expandirConsulta(consulta: string): string {
  const agregadas = sinonimosDe(consulta)
  return agregadas.length === 0 ? consulta : `${consulta} ${agregadas.join(' ')}`
}
