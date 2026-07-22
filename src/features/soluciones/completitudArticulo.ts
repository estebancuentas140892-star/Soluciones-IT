// Señales de completitud del editor de artículo, separadas de React
// para poder probarlas. Desde la fase J5 cada señal sabe ademas en que
// pestaña del editor se completa, para poder marcar con un punto la
// pestaña que todavia tiene algo pendiente: el indicador de completitud
// mira SIEMPRE todo el formulario, no solo la pestaña visible.

import type { TipoArticulo } from '../../lib/db'

export type PestanaEditor = 'general' | 'pasos' | 'detalles' | 'publicacion'

// Orden de las pestañas en la barra, que es tambien el orden en que se
// muestran las sugerencias pendientes.
export const PESTANAS: { valor: PestanaEditor; etiqueta: string }[] = [
  { valor: 'general', etiqueta: 'General' },
  { valor: 'pasos', etiqueta: 'Pasos' },
  { valor: 'detalles', etiqueta: 'Detalles' },
  { valor: 'publicacion', etiqueta: 'Publicación' },
]

export interface SenalCompletitud {
  cumplida: boolean
  pestana: PestanaEditor
  // Que hacer para cumplirla. Vacio para las señales que suman al
  // porcentaje pero no merecen una linea propia en la lista (por
  // ejemplo el titulo, que ya es obligatorio, o el segundo paso).
  sugerencia: string
}

export interface Sugerencia {
  texto: string
  pestana: PestanaEditor
}

export interface Completitud {
  porcentaje: number
  sugerencias: Sugerencia[]
  // Pestañas con al menos una sugerencia pendiente, para el punto de la
  // barra. Las señales sin texto no marcan la pestaña: no hay nada
  // concreto que decirle al tecnico sobre ellas.
  pestanasPendientes: ReadonlySet<PestanaEditor>
}

// Datos del formulario que alimentan las señales, ya en la forma en que
// el editor los tiene (textos sin recortar, contadores para las listas).
export interface DatosCompletitud {
  // Hallazgo K3 de AUDITORIA_FLUJOS_TI.md: las señales originales
  // exigian pasos, requisitos y verificacion sin importar el tipo. Un
  // `manual` (Markdown puro, sin procedimiento) se quedaba
  // permanentemente en un porcentaje que nunca podia subir, con
  // sugerencias que llevaban a la pestaña "Pasos" pese a no aplicarle.
  tipo: TipoArticulo
  titulo: string
  cantidadPasos: number
  descripcion: string
  cantidadEtiquetas: number
  requisitos: string
  tiempoEstimadoMin: string
  dificultad: string
  verificacionFinal: string
  objetivoGeneral: string
  // Cuerpo en Markdown del articulo ("Notas adicionales" en el editor).
  // Solo la puntua la señal de tipo 'manual': es su unico contenido
  // real, ya que un manual normalmente no tiene procedimiento.
  contenido: string
}

// Señales del handoff "Editor de Artículo", cada una con la pestaña
// donde vive su campo desde J5. Un `manual` cambia las cuatro señales
// atadas a la pestaña "Pasos" (agregar paso, segundo paso, requisitos,
// verificación final) por una sola: tener contenido escrito.
export function senalesDeArticulo(datos: DatosCompletitud): SenalCompletitud[] {
  const esManual = datos.tipo === 'manual'

  const senalesDePasos: SenalCompletitud[] = esManual
    ? [
        {
          cumplida: Boolean(datos.contenido.trim()),
          pestana: 'detalles',
          sugerencia: 'Escribir el contenido del manual',
        },
      ]
    : [
        { cumplida: datos.cantidadPasos > 0, pestana: 'pasos', sugerencia: 'Agregar al menos un paso' },
        { cumplida: datos.cantidadPasos > 1, pestana: 'pasos', sugerencia: '' },
        {
          cumplida: Boolean(datos.requisitos.trim()),
          pestana: 'pasos',
          sugerencia: 'Anotar los requisitos previos',
        },
        {
          cumplida: Boolean(datos.verificacionFinal.trim()),
          pestana: 'pasos',
          sugerencia: 'Escribir la verificación final',
        },
      ]

  return [
    { cumplida: Boolean(datos.titulo.trim()), pestana: 'general', sugerencia: '' },
    ...senalesDePasos,
    {
      cumplida: Boolean(datos.descripcion.trim()),
      pestana: 'general',
      sugerencia: 'Escribir cuándo usar este procedimiento',
    },
    {
      cumplida: datos.cantidadEtiquetas > 0,
      pestana: 'general',
      sugerencia: 'Agregar etiquetas para el buscador',
    },
    {
      cumplida: Boolean(datos.tiempoEstimadoMin.trim()),
      pestana: 'detalles',
      sugerencia: 'Indicar el tiempo estimado',
    },
    { cumplida: Boolean(datos.dificultad), pestana: 'detalles', sugerencia: 'Indicar la dificultad' },
    {
      cumplida: Boolean(datos.objetivoGeneral.trim()),
      pestana: 'general',
      sugerencia: 'Indicar el objetivo general',
    },
  ]
}

export function calcularCompletitud(senales: SenalCompletitud[]): Completitud {
  if (senales.length === 0) {
    return { porcentaje: 0, sugerencias: [], pestanasPendientes: new Set() }
  }

  const completas = senales.filter((s) => s.cumplida).length
  const pendientes = senales.filter((s) => !s.cumplida && s.sugerencia !== '')

  return {
    porcentaje: Math.round((completas / senales.length) * 100),
    sugerencias: pendientes.map((s) => ({ texto: s.sugerencia, pestana: s.pestana })),
    pestanasPendientes: new Set(pendientes.map((s) => s.pestana)),
  }
}
