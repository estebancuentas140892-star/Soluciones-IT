import { db, type Articulo, type DatosBorradorArticulo } from '../../lib/db'
import { normalizarProcedimiento } from '../../lib/procedimiento'

// BORRADOR CONTINUO DEL EDITOR (tarea 219, hallazgo G-29).
//
// El hallazgo, uno de los cinco criticos del informe: el editor vivia
// entero en estado de componente hasta que alguien tocaba "Guardar".
// En un telefono con llamadas entrantes, cambios de app y bateria
// finita, escribir siete pasos de pie era una apuesta.
//
// Que ES y que NO ES esta tabla. Es una RED, no el guardado: recoge lo
// que se esta escribiendo para que una interrupcion no se lo lleve.
// NO sustituye a `guardarRegistro`, y esa distincion es deliberada:
//
//   - Escribir en `articulos` con cada tecla encolaria decenas de
//     cambios en `cambiosPendientes` por cada guia.
//   - Y al editar un articulo YA PUBLICADO iria pisando en vivo lo que
//     el resto del equipo esta leyendo, a medio redactar.
//
// Asi que el borrador es local, no se sincroniza, y muere en cuanto el
// articulo se guarda de verdad.

// Cuanto vive un borrador que nadie retomo. Un articulo NUEVO que se
// abandona deja un borrador cuyo id no vuelve a abrirse nunca (el
// editor genera uno nuevo cada vez que se entra a "Crear"), asi que sin
// barrido la tabla solo crece.
export const DIAS_VIDA_BORRADOR = 30

// El formulario vacio. Sirve de base al normalizar una fila vieja o
// incompleta: un borrador es local y no pasa por el motor de
// sincronizacion, asi que nadie mas garantiza su forma.
export function datosVacios(): DatosBorradorArticulo {
  return {
    titulo: '',
    tipo: 'manual',
    contenido: '',
    etiquetas: [],
    descripcion: '',
    portada: null,
    objetivoGeneral: '',
    requisitos: '',
    pasos: [],
    verificacionFinal: '',
    tiempoEstimadoMin: '',
    dificultad: '',
    sintomas: '',
    causas: '',
    esRutaInicio: false,
    ordenRutaInicio: 0,
    estado: 'borrador',
    motivo: '',
    dispositivosAfectados: [],
    aplicaAMarca: '',
    aplicaAModelo: '',
    relacionados: [],
  }
}

// Rellena los huecos de una fila guardada por una version anterior del
// editor. No valida los enumerados (`tipo`, `dificultad`, `estado`):
// quien restaura los contrasta con su propia lista, que es la unica que
// sabe cuales son validos hoy.
export function normalizarDatosBorrador(valor: unknown): DatosBorradorArticulo {
  const base = datosVacios()
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return base
  const origen = valor as Record<string, unknown>
  const texto = (clave: keyof DatosBorradorArticulo): string =>
    typeof origen[clave] === 'string' ? (origen[clave] as string) : (base[clave] as string)
  const lista = <T,>(clave: keyof DatosBorradorArticulo): T[] =>
    Array.isArray(origen[clave]) ? (origen[clave] as T[]) : (base[clave] as T[])

  return {
    ...base,
    titulo: texto('titulo'),
    tipo: texto('tipo'),
    contenido: texto('contenido'),
    etiquetas: lista<string>('etiquetas'),
    descripcion: texto('descripcion'),
    portada: (origen.portada ?? null) as DatosBorradorArticulo['portada'],
    objetivoGeneral: texto('objetivoGeneral'),
    requisitos: texto('requisitos'),
    pasos: lista<DatosBorradorArticulo['pasos'][number]>('pasos'),
    verificacionFinal: texto('verificacionFinal'),
    tiempoEstimadoMin: texto('tiempoEstimadoMin'),
    dificultad: texto('dificultad'),
    sintomas: texto('sintomas'),
    causas: texto('causas'),
    esRutaInicio: origen.esRutaInicio === true,
    ordenRutaInicio: typeof origen.ordenRutaInicio === 'number' ? origen.ordenRutaInicio : 0,
    estado: texto('estado'),
    motivo: texto('motivo'),
    dispositivosAfectados: lista<{ id: string; nombre: string }>('dispositivosAfectados'),
    aplicaAMarca: texto('aplicaAMarca'),
    aplicaAModelo: texto('aplicaAModelo'),
    relacionados: lista<{ id: string; titulo: string }>('relacionados'),
  }
}

// El formulario tal como quedaria al abrir un articulo YA GUARDADO.
// Es la misma traduccion que hace el editor al cargar (el procedimiento
// se desarma en campos de formulario, los arrays vuelven a ser texto de
// una linea por elemento), extraida aqui para poder COMPARARLA con el
// borrador sin duplicar la regla.
export function datosDesdeArticulo(articulo: Articulo): DatosBorradorArticulo {
  const procedimiento = normalizarProcedimiento(articulo.procedimiento)
  return {
    ...datosVacios(),
    titulo: articulo.titulo,
    tipo: articulo.tipo,
    contenido: articulo.contenido,
    etiquetas: articulo.etiquetas ?? [],
    descripcion: procedimiento?.descripcion ?? '',
    portada: procedimiento?.portada ?? null,
    objetivoGeneral: procedimiento?.objetivoGeneral ?? '',
    requisitos: procedimiento?.requisitos.join('\n') ?? '',
    pasos: procedimiento?.pasos ?? [],
    verificacionFinal: procedimiento?.verificacionFinal.join('\n') ?? '',
    tiempoEstimadoMin: procedimiento?.tiempoEstimadoMin ? String(procedimiento.tiempoEstimadoMin) : '',
    dificultad: procedimiento?.dificultad ?? '',
    sintomas: (articulo.sintomas ?? []).join('\n'),
    causas: (articulo.causas ?? []).join('\n'),
    esRutaInicio: articulo.esRutaInicio,
    ordenRutaInicio: articulo.ordenRutaInicio ?? 0,
    estado: articulo.estado ?? 'publicado',
    motivo: '',
    dispositivosAfectados: articulo.dispositivosAfectados ?? [],
    aplicaAMarca: articulo.aplicaA?.marca ?? '',
    aplicaAModelo: articulo.aplicaA?.modelo ?? '',
    relacionados: articulo.relacionados ?? [],
  }
}

// ¿El borrador dice algo distinto de lo ya guardado? Es lo que decide
// si se restaura: un borrador identico al articulo no aporta nada y
// solo asustaria ("tienes cambios sin guardar" cuando no los hay).
//
// La comparacion es estructural, sobre el JSON de los dos lados. Con
// formularios de este tamaño una comparacion campo a campo se
// desactualiza en cuanto alguien añade un campo y olvida sumarlo aqui;
// esta no puede quedarse corta.
export function borradorDifiere(borrador: DatosBorradorArticulo, guardado: DatosBorradorArticulo): boolean {
  return JSON.stringify(borrador) !== JSON.stringify(guardado)
}

// ¿Hay algo escrito? Un borrador de un articulo NUEVO no tiene con que
// compararse (todavia no hay fila en `articulos`), asi que la pregunta
// no es "¿difiere?" sino "¿tiene contenido que valga la pena
// recuperar?". Un titulo a medias ya lo vale; un formulario intacto no.
export function borradorTieneContenido(datos: DatosBorradorArticulo): boolean {
  return borradorDifiere(datos, datosVacios())
}

export async function leerBorrador(articuloId: string): Promise<DatosBorradorArticulo | null> {
  const fila = await db.borradoresArticulo.get(articuloId)
  return fila ? normalizarDatosBorrador(fila.datos) : null
}

export async function guardarBorrador(
  articuloId: string,
  categoriaId: string,
  datos: DatosBorradorArticulo,
): Promise<void> {
  await db.borradoresArticulo.put({
    articuloId,
    categoriaId,
    actualizadoEn: new Date().toISOString(),
    datos,
  })
}

export async function borrarBorrador(articuloId: string): Promise<void> {
  await db.borradoresArticulo.delete(articuloId)
}

// Barrido de los borradores que nadie retomo. Se llama al abrir el
// editor: es el unico sitio que garantiza que la tabla se toca, y el
// coste es una consulta por indice.
export async function limpiarBorradoresViejos(dias = DIAS_VIDA_BORRADOR): Promise<number> {
  const limite = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString()
  return db.borradoresArticulo.where('actualizadoEn').below(limite).delete()
}
