import type { Procedimiento } from './db'
import { tareasDe } from './procedimiento'

// Indicador de calidad de un procedimiento (fase S1 de la propuesta
// por modulos): evalua que tan completa esta la documentacion y
// sugiere que falta. Es una GUIA, nunca un bloqueo: el formulario
// guarda igual con 0 %. Logica pura para poder probarla sin React.

export interface Completitud {
  // 0 a 100, redondeado.
  porcentaje: number
  // Que agregar para mejorar, en el orden de los criterios.
  sugerencias: string[]
}

interface Criterio {
  cumplido: (procedimiento: Procedimiento, etiquetas: string[]) => boolean
  sugerencia: string
}

// Cada criterio pesa igual: la meta es una lista de mejoras clara,
// no una calificacion cientifica. El orden es el de la ficha.
const CRITERIOS: Criterio[] = [
  {
    cumplido: (p) => p.descripcion.trim() !== '',
    sugerencia: 'Agrega la descripción: ¿en qué situaciones se usa este procedimiento?',
  },
  {
    cumplido: (p) => p.portada !== null,
    sugerencia: 'Agrega una imagen de portada para identificarlo de un vistazo.',
  },
  {
    cumplido: (p) => p.objetivoGeneral.trim() !== '',
    sugerencia: 'Define el objetivo general: qué se logra al completarlo.',
  },
  {
    cumplido: (p) => p.requisitos.length > 0,
    sugerencia: 'Agrega los requisitos ("Antes de empezar").',
  },
  {
    cumplido: (p) => p.tiempoEstimadoMin !== null,
    sugerencia: 'Indica el tiempo estimado.',
  },
  {
    cumplido: (p) => p.dificultad !== null,
    sugerencia: 'Indica la dificultad.',
  },
  {
    cumplido: (p) => p.verificacionFinal.length > 0,
    sugerencia: 'Agrega la verificación final para confirmar que el objetivo se cumplió.',
  },
  {
    cumplido: (_, etiquetas) => etiquetas.length > 0,
    sugerencia: 'Agrega etiquetas para que el buscador lo encuentre mejor.',
  },
  {
    cumplido: (p) => p.pasos.every((paso) => tareasDe(paso.bloques).length > 0),
    sugerencia: 'Hay pasos sin tareas: agrega el checklist de cada paso.',
  },
  {
    cumplido: (p) =>
      p.pasos.some(
        (paso) =>
          paso.adjuntos.some((a) => a.tipo.startsWith('image/')) ||
          paso.bloques.some((b) => b.tipo === 'imagen'),
      ),
    sugerencia: 'Agrega al menos una imagen explicativa o captura de pantalla.',
  },
  {
    cumplido: (p) =>
      p.pasos.some(
        (paso) =>
          paso.credencialId !== null ||
          paso.subArticuloId !== null ||
          paso.solucionArticuloId !== null ||
          paso.bloques.some((b) => b.credencialId !== null || b.decisionArticuloId !== null),
      ),
    sugerencia: 'Vincula procedimientos, soluciones o datos de la bóveda relacionados.',
  },
]

// Evalua un procedimiento preparado para guardar. Con null (articulo
// sin pasos) devuelve 0 sin sugerencias: el indicador solo tiene
// sentido para procedimientos y la interfaz lo oculta en ese caso.
export function evaluarCompletitud(
  procedimiento: Procedimiento | null,
  etiquetas: string[],
): Completitud {
  if (!procedimiento) return { porcentaje: 0, sugerencias: [] }

  const sugerencias: string[] = []
  let cumplidos = 0
  for (const criterio of CRITERIOS) {
    if (criterio.cumplido(procedimiento, etiquetas)) cumplidos += 1
    else sugerencias.push(criterio.sugerencia)
  }
  return {
    porcentaje: Math.round((cumplidos / CRITERIOS.length) * 100),
    sugerencias,
  }
}
