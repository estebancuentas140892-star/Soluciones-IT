import type { HistorialEntrada } from '../../lib/db'

// Traduccion de los nombres de campo (identificadores en ingles del
// modelo de datos) a etiquetas en espanol para mostrar en el visor.
const ETIQUETAS_CAMPO: Record<string, string> = {
  titulo: 'Título',
  contenido: 'Contenido',
  etiquetas: 'Etiquetas',
  categoriaId: 'Categoría',
  categoria: 'Categoría',
  tipo: 'Tipo',
  nombre: 'Nombre',
  marca: 'Marca',
  modelo: 'Modelo',
  serial: 'Número de serie',
  placaInventario: 'Placa de inventario',
  ubicacion: 'Ubicación',
  responsable: 'Responsable',
  ip: 'Dirección IP',
  estado: 'Estado',
  observaciones: 'Observaciones',
  detalles: 'Campos adicionales',
  datosCifrados: 'Datos protegidos',
  procedimiento: 'Procedimiento',
  esRutaInicio: 'Ruta de inicio',
  ordenRutaInicio: 'Orden en Para empezar',
  sintomas: 'Síntomas',
  causas: 'Posibles causas',
  dispositivosAfectados: 'Equipos afectados',
  aplicaA: 'Aplica a',
  dispositivos: 'Equipos con acceso',
  descripcion: 'Descripción',
  nodos: 'Preguntas del diagnóstico',
  // Ubicaciones (grupo N3).
  padreId: 'Ubicación superior',
  notas: 'Notas',
  color: 'Color',
  // Ciclo de vida de la persona (tarea 266).
  fechaIngreso: 'Fecha de ingreso',
  fechaRetiro: 'Fecha de retiro',
  motivoRetiro: 'Motivo del retiro',
}

export function etiquetaDeCampo(campo: string): string {
  return ETIQUETAS_CAMPO[campo] ?? campo
}

// ENTRADAS QUE SON DATO, NO LECTURA (tarea 266). `responsableId` se
// registra con los ids de la persona anterior y la nueva para poder
// reconstruir las asignaciones (ver repositorio.ts); el mismo guardado
// deja al lado la entrada `responsable` con los nombres, que es la que
// una persona lee. Mostrar las dos repetiría el cambio, y una con dos
// UUID no le dice nada a nadie.
const CAMPOS_TECNICOS = new Set(['responsableId'])

export function esEntradaTecnica(entrada: Pick<HistorialEntrada, 'campo'>): boolean {
  return CAMPOS_TECNICOS.has(entrada.campo)
}

// Valores de un enum guardados en minúscula que se leen mejor como
// palabra: el estado de una persona (tarea 266).
const VALORES_LEGIBLES: Record<string, string> = {
  activa: 'Activa',
  retirada: 'Retirada',
}

function legible(valor: string): string {
  return VALORES_LEGIBLES[valor] ?? valor
}

type EntradaDescriptible = Pick<HistorialEntrada, 'campo' | 'valorAnterior' | 'valorNuevo'>

// Separada del componente para poder probarla sin depender de React
// ni de la base local.
export function descripcionEntrada(entrada: EntradaDescriptible): string {
  if (entrada.campo === 'intervencion') return entrada.valorNuevo
  if (entrada.campo === 'creacion') return `Se creó: ${entrada.valorNuevo}`
  if (entrada.campo === 'eliminacion') return `Se eliminó: ${entrada.valorAnterior}`
  if (entrada.campo === 'adjunto') return `Se agregó el adjunto: ${entrada.valorNuevo}`
  // El procedimiento y los campos adicionales tienen su propia vista de
  // resumen (ver Historial.tsx); estos textos son solo un respaldo para
  // no volcar nunca el JSON crudo.
  if (entrada.campo === 'procedimiento') return 'Se actualizó el procedimiento'
  if (entrada.campo === 'detalles') return 'Se actualizaron los campos adicionales'
  if (entrada.campo === 'conexion') {
    if (!entrada.valorNuevo) return `Se quitó la conexión: ${entrada.valorAnterior}`
    // Con los dos valores la conexion no se creo: se edito, y hoy la
    // unica edicion posible es invertir su direccion (hallazgo N1).
    // Sin esta rama el cambio se leia "Se agregó la conexión" y el
    // historial afirmaba algo que no paso.
    if (entrada.valorAnterior) {
      return `Se invirtió la dirección: ${entrada.valorAnterior} pasó a ${entrada.valorNuevo}`
    }
    return `Se agregó la conexión: ${entrada.valorNuevo}`
  }

  const etiqueta = etiquetaDeCampo(entrada.campo)
  const anterior = legible(entrada.valorAnterior)
  const nuevo = legible(entrada.valorNuevo)
  if (!anterior) return `${etiqueta}: se definió como "${nuevo}"`
  if (!nuevo) return `${etiqueta}: se quitó "${anterior}"`
  return `${etiqueta}: "${anterior}" → "${nuevo}"`
}
