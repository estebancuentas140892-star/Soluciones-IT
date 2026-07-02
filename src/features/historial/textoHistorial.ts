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
  ip: 'Dirección IP',
  estado: 'Estado',
  observaciones: 'Observaciones',
  detalles: 'Campos adicionales',
  datosCifrados: 'Datos protegidos',
}

export function etiquetaDeCampo(campo: string): string {
  return ETIQUETAS_CAMPO[campo] ?? campo
}

type EntradaDescriptible = Pick<HistorialEntrada, 'campo' | 'valorAnterior' | 'valorNuevo'>

// Separada del componente para poder probarla sin depender de React
// ni de la base local.
export function descripcionEntrada(entrada: EntradaDescriptible): string {
  if (entrada.campo === 'creacion') return `Se creó: ${entrada.valorNuevo}`
  if (entrada.campo === 'eliminacion') return `Se eliminó: ${entrada.valorAnterior}`
  if (entrada.campo === 'adjunto') return `Se agregó el adjunto: ${entrada.valorNuevo}`

  const etiqueta = etiquetaDeCampo(entrada.campo)
  if (!entrada.valorAnterior) return `${etiqueta}: se definió como "${entrada.valorNuevo}"`
  if (!entrada.valorNuevo) return `${etiqueta}: se quitó "${entrada.valorAnterior}"`
  return `${etiqueta}: "${entrada.valorAnterior}" → "${entrada.valorNuevo}"`
}
