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
  tiempoEstimadoMin: string
  dificultad: string
  verificacionFinal: string
  objetivoGeneral: string
  // Cuerpo en Markdown del articulo ("Notas adicionales" en el editor).
  // Solo la puntua la señal de tipo 'manual': es su unico contenido
  // real, ya que un manual normalmente no tiene procedimiento.
  contenido: string
  // Apoyos (imagenes, avisos, archivos o guias) que vienen de una
  // version anterior y no dicen a que tarea pertenecen (2026-09-09,
  // seccion 8 del encargo). No se les adivina un destino: se cuentan
  // aqui para que el autor los vea listados y los asigne.
  apoyosSinAsignar?: number
  // Lo que la revision del contenido encontro contra la regla 20 (ver
  // revisionGuia.ts): requisitos que son acciones, tareas que encadenan
  // varias acciones y alertas que solo recuerdan algo.
  requisitosQueSonAcciones?: number
  tareasEncadenadas?: number
  alertasQueRecuerdan?: number
}

// Concordancia de las sugerencias con número ("1 tarea", "3 tareas").
function contar(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`
}

// Señales del handoff "Editor de Artículo", cada una con la pestaña
// donde vive su campo desde J5. Un `manual` cambia las señales atadas a
// la pestaña "Pasos" (agregar paso, segundo paso, verificación final)
// por una sola: tener contenido escrito.
//
// LOS REQUISITOS YA NO PUNTÚAN (segunda pasada del encargo del
// 2026-09-17). La barra pedía "Anotar los requisitos previos" a toda
// guía y le restaba porcentaje si no los tenía, mientras la ayuda del
// mismo campo decía "si no hace falta nada, déjalo vacío". Ganaba la
// barra: para llegar al 100 % se escribían en "Antes de empezar"
// acciones que luego volvían a estar en los pasos, que es exactamente
// la duplicación del encargo. Una guía sin requisitos está completa.
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
          cumplida: Boolean(datos.verificacionFinal.trim()),
          pestana: 'pasos',
          sugerencia: 'Escribir la verificación final',
        },
      ]

  // LO QUE LA REGLA 20 PIDE CORREGIR (ver revisionGuia.ts). Como los
  // apoyos heredados, cada señal solo EXISTE cuando hay algo que
  // corregir: una guía bien escrita no ve moverse su porcentaje por
  // reglas que no le tocan. Todas se resuelven en la pestaña Pasos, donde
  // el editor señala además la línea concreta.
  const revision: SenalCompletitud[] = esManual
    ? []
    : [
        ...((datos.requisitosQueSonAcciones ?? 0) > 0
          ? [
              {
                cumplida: false,
                pestana: 'pasos' as const,
                sugerencia: `Sacar de «Requisitos» ${contar(datos.requisitosQueSonAcciones ?? 0, 'acción', 'acciones')}`,
              },
            ]
          : []),
        ...((datos.tareasEncadenadas ?? 0) > 0
          ? [
              {
                cumplida: false,
                pestana: 'pasos' as const,
                sugerencia: `Dividir ${contar(datos.tareasEncadenadas ?? 0, 'tarea que encadena', 'tareas que encadenan')} varias acciones`,
              },
            ]
          : []),
        ...((datos.alertasQueRecuerdan ?? 0) > 0
          ? [
              {
                cumplida: false,
                pestana: 'pasos' as const,
                sugerencia: `Revisar ${contar(datos.alertasQueRecuerdan ?? 0, 'alerta que solo recuerda', 'alertas que solo recuerdan')} algo`,
              },
            ]
          : []),
      ]

  // Contenido heredado que hay que repasar (seccion 8 del encargo). Un
  // procedimiento escrito antes de que el apoyo dijera a que tarea
  // pertenece se conserva entero y funciona; lo que falta es decidir
  // donde va cada pieza, y eso solo lo sabe el autor.
  //
  // La señal solo EXISTE cuando hay algo que asignar: si se sumara
  // siempre, los articulos que nunca tuvieron el problema veririan
  // moverse su porcentaje por una regla que no les toca.
  const pendientesDeAsignar = datos.apoyosSinAsignar ?? 0
  const senalesHeredadas: SenalCompletitud[] =
    pendientesDeAsignar > 0 && !esManual
      ? [
          {
            cumplida: false,
            pestana: 'pasos',
            sugerencia:
              pendientesDeAsignar === 1
                ? 'Decir a qué tarea pertenece 1 apoyo heredado'
                : `Decir a qué tarea pertenecen ${pendientesDeAsignar} apoyos heredados`,
          },
        ]
      : []

  return [
    { cumplida: Boolean(datos.titulo.trim()), pestana: 'general', sugerencia: '' },
    ...senalesDePasos,
    ...senalesHeredadas,
    ...revision,
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
