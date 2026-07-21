import type { CampoProtegido, TipoCampoProtegido } from '../../lib/db'

// Logica pura de los campos protegidos de un dispositivo (grupo P1),
// separada del componente para poder probarla sin navegador ni base,
// mismo patron que completitud.ts o problemasDeDispositivo.ts.

// Que se ve de cada tipo y como se comporta:
// - `oculto`: arranca tapado tras el ojo. Un usuario administrador no
//   es un secreto que haya que esconder de la pantalla (se necesita
//   leerlo para escribirlo), una contrasena o un PIN si.
// - `etiqueta`: como se nombra el tipo en el selector del editor.
export const TIPOS_CAMPO_PROTEGIDO: {
  tipo: TipoCampoProtegido
  etiqueta: string
  oculto: boolean
}[] = [
  { tipo: 'usuario', etiqueta: 'Usuario', oculto: false },
  { tipo: 'contrasena', etiqueta: 'Contraseña', oculto: true },
  { tipo: 'pin', etiqueta: 'PIN', oculto: true },
  { tipo: 'llave', etiqueta: 'Llave', oculto: true },
  { tipo: 'token', etiqueta: 'Token', oculto: true },
  { tipo: 'texto', etiqueta: 'Otro dato', oculto: true },
]

const POR_TIPO = new Map(TIPOS_CAMPO_PROTEGIDO.map((t) => [t.tipo, t]))

// Un tipo desconocido (fila creada por una version mas nueva de la app
// y sincronizada hacia atras) cae a 'texto', que es el comodin: se
// muestra oculto, que es el lado seguro por el que equivocarse.
export function esOcultoPorDefecto(tipo: TipoCampoProtegido): boolean {
  return POR_TIPO.get(tipo)?.oculto ?? true
}

export function etiquetaTipo(tipo: TipoCampoProtegido): string {
  return POR_TIPO.get(tipo)?.etiqueta ?? 'Otro dato'
}

// Los campos vivos de un equipo, en el orden en que se muestran: por
// `orden` y, a igualdad, por nombre (nunca por fecha, que haria saltar
// las filas al editarlas). Excluye los eliminados.
export function camposDeDispositivo(
  campos: CampoProtegido[],
  dispositivoId: string,
): CampoProtegido[] {
  return campos
    .filter((c) => c.dispositivoId === dispositivoId && !c.eliminadoEn)
    .sort((a, b) => {
      if (a.orden !== b.orden) return a.orden - b.orden
      return a.nombre.localeCompare(b.nombre, 'es', { numeric: true })
    })
}

// Siguiente `orden` para un campo nuevo: al final de los que ya hay.
// Se calcula sobre la lista ya filtrada del equipo.
export function siguienteOrden(camposDelEquipo: CampoProtegido[]): number {
  if (camposDelEquipo.length === 0) return 0
  return Math.max(...camposDelEquipo.map((c) => c.orden)) + 1
}

// Un nombre de campo es valido si no esta vacio y no se repite dentro
// del mismo equipo (comparando sin distinguir mayusculas ni acentos,
// misma normalizacion que el resto de vocabularios derivados de la
// app). Devuelve el mensaje de error o null si es valido.
//
// Se valida el DUPLICADO porque dos campos "Contraseña" en el mismo
// equipo son indistinguibles al vincularlos desde un procedimiento
// (fase P2), que es justo para lo que existe el nombre.
export function validarNombre(
  nombre: string,
  camposDelEquipo: CampoProtegido[],
  idEnEdicion: string | null,
): string | null {
  const limpio = nombre.trim()
  if (!limpio) return 'Escribe un nombre para el dato.'
  const clave = normalizar(limpio)
  const repetido = camposDelEquipo.some((c) => c.id !== idEnEdicion && normalizar(c.nombre) === clave)
  return repetido ? 'Ya existe un dato con ese nombre en este equipo.' : null
}

function normalizar(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}
