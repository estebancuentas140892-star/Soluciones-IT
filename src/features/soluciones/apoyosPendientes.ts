import type { PasoProcedimiento } from '../../lib/db'
import { apoyosSinAsignar } from './apoyosTarea'

// LOS APOYOS HEREDADOS QUE ALGUIEN TIENE QUE REPASAR (encargo del
// 2026-09-09, tarea 7).
//
// El contenido escrito antes de que el bloque dijera a que tarea
// pertenece se conserva entero y funciona: se comporta como apoyo del
// paso. Lo que faltaba era el trabajo del autor, y no habia por donde
// empezarlo: la pastilla ambar "Sin asignar" solo se veia si el autor
// abria el paso y bajaba hasta el bloque, asi que en una guia de siete
// pasos no habia forma de saber cuantos quedaban ni donde estaban.
//
// Nada se asigna solo: adivinarle un destino a un apoyo antiguo seria
// inventarle una intencion al dato. Lo que se hace es LISTARLO, llevar
// hasta el, y no dejar publicar una guia nueva con deberes pendientes.

export interface ApoyoPendiente {
  pasoId: string
  bloqueId: string
  /** Numero del paso de cara al autor (1-based). */
  numeroPaso: number
  tituloPaso: string
  /** Que clase de apoyo es, para nombrarlo en la lista. */
  clase: 'Aviso' | 'Imagen' | 'Archivo' | 'Guía vinculada' | 'Apoyo'
  /** Su texto, o el nombre del archivo, o el titulo de la guia. */
  resumen: string
}

function claseDe(tipo: string): ApoyoPendiente['clase'] {
  if (tipo === 'aviso') return 'Aviso'
  if (tipo === 'imagen') return 'Imagen'
  if (tipo === 'archivo') return 'Archivo'
  if (tipo === 'guia') return 'Guía vinculada'
  return 'Apoyo'
}

/**
 * Todos los apoyos sin asignar de la guia, en el orden del editor
 * (paso a paso, y dentro del paso en el orden en que estan escritos).
 *
 * Un paso SIN tareas no aparece: no hay entre que repartir, asi que su
 * apoyo es del paso y punto (lo decide `apoyosSinAsignar`).
 */
export function apoyosPendientes(pasos: PasoProcedimiento[]): ApoyoPendiente[] {
  return pasos.flatMap((paso, indice) =>
    apoyosSinAsignar(paso).map((bloque) => ({
      pasoId: paso.id,
      bloqueId: bloque.id,
      numeroPaso: indice + 1,
      tituloPaso: paso.titulo || `Paso ${indice + 1}`,
      clase: claseDe(bloque.tipo),
      resumen:
        bloque.texto.trim() ||
        bloque.adjunto?.nombre ||
        bloque.guiaArticuloTitulo ||
        'Sin texto',
    })),
  )
}

/** Cuantos quedan, escrito para el acceso del editor. */
export function resumenApoyosPendientes(cuantos: number): string {
  return cuantos === 1 ? '1 apoyo sin asignar' : `${cuantos} apoyos sin asignar`
}

/**
 * ¿Hay que impedir el guardado? Solo al PUBLICAR una guia que todavia
 * no estaba publicada: ahi el contenido heredado es una decision que el
 * autor puede tomar ahora, y publicarla sin tomarla la convierte en
 * deuda de otro.
 *
 * Una guia YA publicada se sigue pudiendo editar y guardar: bloquearla
 * dejaria encerrado a quien solo queria corregir una palabra, y su
 * contenido heredado ya esta en produccion. Lo que se hace ahi es
 * enseñarlo claramente, no cerrar la puerta. Un borrador tampoco se
 * bloquea: guardar a medias es justo para lo que sirve.
 */
export function bloqueaPublicacion({
  publicando,
  yaPublicado,
  pendientes,
}: {
  publicando: boolean
  yaPublicado: boolean
  pendientes: number
}): boolean {
  return publicando && !yaPublicado && pendientes > 0
}

export function motivoBloqueoPublicacion(pendientes: number): string {
  return pendientes === 1
    ? 'Queda 1 apoyo sin asignar. Di si pertenece a una tarea o a todo el paso antes de publicar.'
    : `Quedan ${pendientes} apoyos sin asignar. Di si cada uno pertenece a una tarea o a todo el paso antes de publicar.`
}
