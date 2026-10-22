import { normalizarTexto } from './texto'

// LA CLASE VISUAL DE UNA CATEGORÍA O DE UN EQUIPO (tarea 350): qué glifo y qué
// color lleva su `IconoCategoria` en el teléfono. Se deduce del NOMBRE escrito
// por el equipo, por palabras clave (las categorías no guardan un icono), y lo
// que no se reconoce es `general`.

export type ClaseVisual =
  | 'software'
  | 'impresora'
  | 'pos'
  | 'servidor'
  | 'red'
  | 'computador'
  | 'camara'
  | 'switch'
  | 'datafono'
  | 'general'

// El orden importa: "Datáfonos" antes que POS ("caja"), "Puntos de venta" en
// POS antes que en red ("punto"), "Switch" antes que red.
const REGLAS: [RegExp, ClaseVisual][] = [
  [/impres/, 'impresora'],
  [/datafon/, 'datafono'],
  [/\bpos\b|venta|caja|taquill/, 'pos'],
  [/camara|cctv|video/, 'camara'],
  [/switch/, 'switch'],
  [/servidor|server|\bnas\b/, 'servidor'],
  [/\bred(es)?\b|access|rack|punto|wifi|router|inalambric/, 'red'],
  [/comput|\bpc\b|portatil|laptop|escritorio|equipo/, 'computador'],
  [/software|licencia|programa|aplicaci|office|correo/, 'software'],
]

export function claseDeNombre(nombre: string | null | undefined): ClaseVisual {
  const texto = normalizarTexto(nombre ?? '')
  for (const [regla, clase] of REGLAS) if (regla.test(texto)) return clase
  return 'general'
}
