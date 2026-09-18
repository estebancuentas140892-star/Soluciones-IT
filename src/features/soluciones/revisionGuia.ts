import type { PasoProcedimiento } from '../../lib/db'
import { normalizarTexto } from './iconosSoluciones'

// REVISIÓN DEL CONTENIDO DE UNA GUÍA MIENTRAS SE ESCRIBE (regla 20 de
// REGLAS.md, segunda pasada del encargo del 2026-09-17).
//
// La pantalla de ejecución ya enseña una acción a la vez, los requisitos
// solo en el paso 1 y las alertas junto a su acción. Pero enseña lo que
// la guía DICE: si una tarea encadena cinco acciones, el técnico ve las
// cinco en una sola pantalla; si "Antes de empezar" dice "Entra al
// administrador", lo lee ahí y otra vez en el paso 2. Así falló la guía
// de la resolución DIAN en un procedimiento real.
//
// Estas reglas miran lo escrito y señalan tres cosas al autor, sin tocar
// nada por su cuenta:
//
//   - un requisito que en realidad es una ACCIÓN del procedimiento
//     ("entra", "abre", "selecciona", "ve a"), y si ya está en los pasos;
//   - una tarea que ENCADENA varias acciones ("ingresa al administrador,
//     entra a terminales, selecciona editar, luego entra a impresoras");
//   - una alerta (precaución o importante) que solo RECUERDA algo
//     ("Recuerda que…", "No olvides…"), que no es un riesgo.
//
// Son pistas, no validaciones: nunca impiden guardar. Por eso el umbral
// es conservador. "Selecciona la terminal y pulsa Editar" es UNA acción
// para quien la ejecuta (se elige y se pulsa en la misma pantalla), así
// que dos verbos juntos no bastan: hacen falta tres, o dos unidos por un
// marcador de secuencia ("luego", "después", "a continuación").

// Verbos con los que se escribe un gesto sobre una pantalla o un menú.
// Son los que delatan que un requisito es un paso: nadie "tiene a mano"
// entrar a un menú. En imperativo de tú y de usted y en infinitivo, que
// son las tres formas en que el equipo escribe. Sin tildes: se compara
// sobre el texto normalizado.
const VERBOS_DE_PANTALLA = [
  'entra', 'entre', 'entrar',
  'ingresa', 'ingrese', 'ingresar',
  'abre', 'abra', 'abrir',
  'selecciona', 'seleccione', 'seleccionar',
  'pulsa', 'pulse', 'pulsar',
  'presiona', 'presione', 'presionar',
  'oprime', 'oprima', 'oprimir',
  'toca', 'toque', 'tocar',
  'navega', 'navegue', 'navegar',
  'edita', 'edite', 'editar',
  'elige', 'elija', 'elegir',
  'escoge', 'escoja', 'escoger',
  'marca', 'marque', 'marcar',
  'desmarca', 'desmarque', 'desmarcar',
  'busca', 'busque', 'buscar',
  'escribe', 'escriba', 'escribir',
  'digita', 'digite', 'digitar',
  'guarda', 'guarde', 'guardar',
  'cierra', 'cierre', 'cerrar',
  'accede', 'acceda', 'acceder',
  'inicia', 'inicie', 'iniciar',
  'despliega', 'despliegue', 'desplegar',
  'cambia', 'cambie', 'cambiar',
  'modifica', 'modifique', 'modificar',
  'configura', 'configure', 'configurar',
  'copia', 'copie', 'copiar',
  'pega', 'pegue', 'pegar',
  'confirma', 'confirme', 'confirmar',
  'acepta', 'acepte', 'aceptar',
  'aplica', 'aplique', 'aplicar',
  'actualiza', 'actualice', 'actualizar',
  'ubica', 'ubique', 'ubicar',
  'localiza', 'localice', 'localizar',
  'completa', 'complete', 'completar',
  'llena', 'llene', 'llenar',
  'diligencia', 'diligencie', 'diligenciar',
  'agrega', 'agregue', 'agregar',
  'anade', 'anada', 'anadir',
  'crea', 'cree', 'crear',
  'elimina', 'elimine', 'eliminar',
  'borra', 'borre', 'borrar',
  'quita', 'quite', 'quitar',
  'activa', 'active', 'activar',
  'desactiva', 'desactive', 'desactivar',
  'habilita', 'habilite', 'habilitar',
  'deshabilita', 'deshabilite', 'deshabilitar',
  'regresa', 'regrese', 'regresar',
  'vuelve', 'vuelva', 'volver',
  'sal', 'salga', 'salir',
]

// Además de los de pantalla, los gestos físicos y las comprobaciones.
// Cuentan para decidir si una tarea encadena acciones, pero NO delatan
// un requisito: "conectar el lector antes de empezar" es justo el tipo
// de preparación que el encargo pone como requisito válido.
const OTROS_VERBOS_DE_ACCION = [
  'conecta', 'conecte', 'conectar',
  'desconecta', 'desconecte', 'desconectar',
  'enciende', 'encienda', 'encender',
  'apaga', 'apague', 'apagar',
  'reinicia', 'reinicie', 'reiniciar',
  'verifica', 'verifique', 'verificar',
  'revisa', 'revise', 'revisar',
  'comprueba', 'compruebe', 'comprobar',
  'espera', 'espere', 'esperar',
  'anota', 'anote', 'anotar',
  'toma', 'tome', 'tomar',
  'imprime', 'imprima', 'imprimir',
  'ejecuta', 'ejecute', 'ejecutar',
  'instala', 'instale', 'instalar',
  'desinstala', 'desinstale', 'desinstalar',
  'descarga', 'descargue', 'descargar',
  'sube', 'suba', 'subir',
  'carga', 'cargue', 'cargar',
  'retira', 'retire', 'retirar',
  'inserta', 'inserte', 'insertar',
  'coloca', 'coloque', 'colocar',
  'valida', 'valide', 'validar',
  'prueba', 'pruebe', 'probar',
  'exporta', 'exporte', 'exportar',
  'importa', 'importe', 'importar',
  'arrastra', 'arrastre', 'arrastrar',
  'envia', 'envie', 'enviar',
]

const DE_PANTALLA = new Set(VERBOS_DE_PANTALLA)
const DE_ACCION = new Set([...VERBOS_DE_PANTALLA, ...OTROS_VERBOS_DE_ACCION])

// "Ve a", "vaya a", "ir a": el verbo solo cuenta con su destino detrás,
// porque "ve" suelto también es "se ve".
const IR = new Set(['ve', 'vaya', 'ir'])
const DESTINO_DE_IR = new Set(['a', 'al', 'hasta'])

// "Haz clic", "dé clic", "dale clic": el verbo es "clic".
const PREVIO_A_CLIC = new Set(['haz', 'haga', 'hacer', 'da', 'de', 'dale', 'dele', 'dar'])
const CLIC = new Set(['clic', 'click', 'doble'])

// Palabras que unen una acción con la siguiente y no forman parte de
// ninguna: se descartan al principio de cada tramo.
const CONECTORES = new Set([
  'y', 'e', 'luego', 'despues', 'entonces', 'finalmente', 'posteriormente', 'seguidamente',
])
const CONECTORES_DOBLES = new Set(['a continuacion', 'por ultimo', 'por otro lado'])

// Marcadores de secuencia: con uno de ellos, dos acciones ya son una
// cadena ("abre la consola y luego escribe el comando").
const MARCADOR_DE_SECUENCIA =
  /\b(luego|despues|a continuacion|posteriormente|finalmente|por ultimo|seguidamente)\b/

// Viñetas, números y comillas con que se suelen pegar los apuntes.
const VINETA_INICIAL = /^[\s\-–•*·>"'«“]*(\d+[.)-]\s*)?/

function palabras(texto: string): string[] {
  return normalizarTexto(texto)
    .replace(VINETA_INICIAL, '')
    .split(/[^a-z0-9ñ]+/u)
    .filter(Boolean)
}

// ¿El tramo EMPIEZA con una acción? Devuelve cuántas palabras ocupan los
// conectores del principio (para poder quitarlos al dividir), o null si
// no empieza con una acción.
function inicioDeAccion(texto: string, verbos: ReadonlySet<string>): number | null {
  const lista = palabras(texto)
  let i = 0
  while (i < lista.length) {
    const doble = `${lista[i]} ${lista[i + 1] ?? ''}`
    if (CONECTORES_DOBLES.has(doble)) i += 2
    else if (CONECTORES.has(lista[i])) i += 1
    else break
  }
  const primera = lista[i]
  if (!primera) return null
  if (IR.has(primera)) return DESTINO_DE_IR.has(lista[i + 1] ?? '') ? i : null
  if (PREVIO_A_CLIC.has(primera)) return CLIC.has(lista[i + 1] ?? '') ? i : null
  if (CLIC.has(primera)) return i
  return verbos.has(primera) ? i : null
}

/** ¿Este texto empieza con un gesto sobre una pantalla o un menú? */
export function esAccionDePantalla(texto: string): boolean {
  return inicioDeAccion(texto, DE_PANTALLA) !== null
}

// Cortes posibles entre acciones: comas, punto y coma, punto seguido y
// las conjunciones y marcadores de secuencia. Se corta de más a
// propósito: "terminales y dispositivos" se parte en dos, pero como
// "dispositivos" no empieza con un verbo, se vuelve a pegar a su tramo.
const CORTE =
  /(\s*[,;]\s*|\.\s+|\s+(?:y\s+luego|y\s+despu[eé]s|luego|despu[eé]s|a\s+continuaci[oó]n|posteriormente|finalmente|y\s+finalmente|y\s+por\s+[uú]ltimo|por\s+[uú]ltimo|seguidamente|y|e)\s+)/i

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

// Quita las primeras `n` palabras normalizadas de un tramo original,
// conservando mayúsculas, tildes y signos del resto.
function sinPrimerasPalabras(texto: string, n: number): string {
  let resto = texto.replace(/^[\s\-–•*·>"'«“]*/, '')
  for (let i = 0; i < n; i++) resto = resto.replace(/^\S+\s*/, '')
  return resto
}

/**
 * Si la tarea encadena varias acciones, las acciones una por una, listas
 * para ser tareas propias. Si no, null.
 *
 * Nunca inventa texto: cada pieza es un trozo literal de lo escrito, sin
 * el conector que la unía a la anterior ("luego", "y") y con la primera
 * letra en mayúscula.
 */
export function accionesEncadenadas(texto: string): string[] | null {
  const limpio = texto.replace(/\s+/g, ' ').trim()
  if (!limpio) return null

  // Tramos y los cortes que los separaban, alternados. Cada tramo que
  // empieza con una acción abre una pieza nueva; el que no (el resto de
  // "terminales y dispositivos", un "si no aparece") se pega a la pieza
  // en curso con su separador original. Lo que va ANTES de la primera
  // acción ("En el POS, abre FrontRest") es su contexto y viaja con ella.
  const partes = limpio.split(CORTE)
  const piezas: string[] = []
  let actual = ''
  let actualTieneAccion = false
  let acciones = 0
  for (let i = 0; i < partes.length; i += 2) {
    const tramo = partes[i] ?? ''
    const separador = i > 0 ? (partes[i - 1] ?? '') : ''
    if (!tramo.trim()) continue
    const conectores = inicioDeAccion(tramo, DE_ACCION)
    if (conectores === null) {
      actual = actual ? `${actual}${separador}${tramo}` : tramo
      continue
    }
    acciones++
    // El conector ("luego", "y") se pierde con el corte: une dos
    // acciones, no pertenece a ninguna.
    const accion = sinPrimerasPalabras(tramo, conectores)
    if (actualTieneAccion) {
      piezas.push(actual)
      actual = accion
    } else {
      actual = actual ? `${actual}${separador}${accion}` : accion
    }
    actualTieneAccion = true
  }
  if (actual) piezas.push(actual)

  const conSecuencia = MARCADOR_DE_SECUENCIA.test(normalizarTexto(limpio))
  const esCadena = acciones >= 3 || (acciones >= 2 && conSecuencia)
  if (!esCadena) return null

  return piezas.map((p) => capitalizar(p.replace(/[\s.,;]+$/, '').trim())).filter(Boolean)
}

// Cómo empieza un aviso que solo recuerda algo. Un riesgo se escribe
// diciendo qué pasa ("Guardar reemplaza la resolución vigente"), no
// pidiendo que se recuerde.
const INICIO_DE_RECORDATORIO =
  /^(recuerda|recuerde|recordar|recordatorio|no olvides|no olvide|no olvidar|ten presente|tenga presente|tener presente|ten en cuenta|tenga en cuenta|tener en cuenta)\b/

/** ¿El texto de un aviso empieza como un recordatorio? */
export function esRecordatorio(texto: string): boolean {
  const normalizado = normalizarTexto(texto).replace(VINETA_INICIAL, '').replace(/^[¡!\s]+/, '')
  return INICIO_DE_RECORDATORIO.test(normalizado)
}

// Artículos y preposiciones que quedan entre el verbo y su objeto: "al
// administrador", "en Administrador" y "el administrador" nombran lo
// mismo.
const ENLACES = new Set(['a', 'al', 'en', 'el', 'la', 'los', 'las', 'de', 'del', 'un', 'una', 'hacia', 'hasta'])

// El OBJETO de una acción: el texto sin conectores, sin el verbo y sin
// los enlaces del principio. Sirve para reconocer la misma acción
// escrita con otro verbo o con otra forma del verbo ("Entrar al
// administrador", "Ingresa en Administrador").
function nucleo(texto: string): string {
  const lista = palabras(texto)
  const inicio = inicioDeAccion(texto, DE_ACCION)
  let resto = lista
  if (inicio !== null) {
    // "Ve a", "haz clic": el verbo ocupa dos palabras.
    const primera = lista[inicio]
    const largoVerbo = IR.has(primera) || PREVIO_A_CLIC.has(primera) ? 2 : 1
    resto = lista.slice(inicio + largoVerbo)
  }
  let i = 0
  while (i < resto.length && ENLACES.has(resto[i])) i++
  return resto.slice(i).join(' ')
}

export interface RequisitoQueEsAccion {
  texto: string
  // Paso (1, 2, 3...) donde ya está escrita esa misma acción, o null si
  // no aparece en ninguno.
  enPaso: number | null
}

export interface TareaEncadenada {
  pasoIndice: number
  tareaId: string
  texto: string
  acciones: string[]
}

export interface AlertaRecordatorio {
  pasoIndice: number
  bloqueId: string
  texto: string
}

export interface RevisionGuia {
  requisitosQueSonAcciones: RequisitoQueEsAccion[]
  tareasEncadenadas: TareaEncadenada[]
  alertasQueRecuerdan: AlertaRecordatorio[]
}

/** Lo que conviene revisar en una guía, según la regla 20. */
export function revisarGuia(requisitos: string[], pasos: PasoProcedimiento[]): RevisionGuia {
  const tareas = pasos.flatMap((paso, pasoIndice) =>
    paso.bloques
      .filter((b) => b.tipo === 'tarea')
      .map((b) => ({ pasoIndice, bloque: b, nucleo: nucleo(b.texto) })),
  )

  const requisitosQueSonAcciones = requisitos
    .map((r) => r.trim())
    .filter((r) => r !== '' && esAccionDePantalla(r))
    .map((texto) => {
      const buscado = nucleo(texto)
      // Mismo objeto: igual, o uno contiene al otro con texto suficiente
      // para no confundir "menú" con cualquier cosa que lo nombre.
      const coincide = tareas.find(
        (t) =>
          t.nucleo.length >= 4 &&
          buscado.length >= 4 &&
          (t.nucleo === buscado ||
            (buscado.length >= 10 && t.nucleo.includes(buscado)) ||
            (t.nucleo.length >= 10 && buscado.includes(t.nucleo))),
      )
      return { texto, enPaso: coincide ? coincide.pasoIndice + 1 : null }
    })

  const tareasEncadenadas = tareas.flatMap(({ pasoIndice, bloque }) => {
    // Una comprobación o una decisión no se parten: su texto es una
    // pregunta o una condición, no una lista de gestos.
    if (bloque.tipoTarea === 'verificacion' || bloque.tipoTarea === 'decision') return []
    const acciones = accionesEncadenadas(bloque.texto)
    return acciones ? [{ pasoIndice, tareaId: bloque.id, texto: bloque.texto, acciones }] : []
  })

  const alertasQueRecuerdan = pasos.flatMap((paso, pasoIndice) =>
    paso.bloques
      .filter(
        (b) =>
          b.tipo === 'aviso' && (b.tono === 'precaucion' || b.tono === 'importante') && esRecordatorio(b.texto),
      )
      .map((b) => ({ pasoIndice, bloqueId: b.id, texto: b.texto })),
  )

  return { requisitosQueSonAcciones, tareasEncadenadas, alertasQueRecuerdan }
}
