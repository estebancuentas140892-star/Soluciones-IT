import type { PasoProcedimiento, Procedimiento } from './db'

// Logica pura de los procedimientos paso a paso, separada de los
// componentes para poder probarla sin navegador. El dato viaja como
// JSON por Supabase, asi que aqui se valida y se completa cualquier
// campo faltante antes de usarlo en la interfaz.

export function crearPaso(): PasoProcedimiento {
  return {
    id: crypto.randomUUID(),
    titulo: '',
    instrucciones: [],
    imagen: null,
    credencialId: null,
    credencialTitulo: '',
    subArticuloId: null,
    subArticuloTitulo: '',
    solucionArticuloId: null,
    solucionArticuloTitulo: '',
  }
}

// Devuelve un procedimiento bien formado o null si no hay pasos (un
// articulo sin pasos es un articulo normal). Tolera datos incompletos
// o corruptos que lleguen del servidor o de versiones anteriores.
export function normalizarProcedimiento(valor: unknown): Procedimiento | null {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return null
  const origen = valor as Record<string, unknown>

  const requisitos = Array.isArray(origen.requisitos)
    ? origen.requisitos.filter((r): r is string => typeof r === 'string' && r.trim() !== '')
    : []

  const pasos = Array.isArray(origen.pasos)
    ? origen.pasos
        .filter((p): p is Record<string, unknown> => Boolean(p) && typeof p === 'object')
        .map(normalizarPaso)
    : []

  if (pasos.length === 0) return null
  return { requisitos, pasos }
}

// Los campos que el editor dejo de ofrecer (detalle, nota,
// advertencia, consejo y decision de ramificacion) se descartan aqui
// a proposito: los articulos guardados antes del rediseño los pierden
// al normalizar, decision tomada por el usuario el 2026-07-03.
function normalizarPaso(origen: Record<string, unknown>): PasoProcedimiento {
  const credencialId =
    typeof origen.credencialId === 'string' && origen.credencialId !== '' ? origen.credencialId : null
  const subArticuloId =
    typeof origen.subArticuloId === 'string' && origen.subArticuloId !== '' ? origen.subArticuloId : null
  const solucionArticuloId =
    typeof origen.solucionArticuloId === 'string' && origen.solucionArticuloId !== ''
      ? origen.solucionArticuloId
      : null
  return {
    id: typeof origen.id === 'string' && origen.id !== '' ? origen.id : crypto.randomUUID(),
    titulo: texto(origen.titulo),
    instrucciones: Array.isArray(origen.instrucciones)
      ? origen.instrucciones.filter((i): i is string => typeof i === 'string' && i.trim() !== '')
      : [],
    imagen: typeof origen.imagen === 'string' && origen.imagen !== '' ? origen.imagen : null,
    credencialId,
    // Los titulos de referencia solo tienen sentido junto a su id.
    credencialTitulo: credencialId ? texto(origen.credencialTitulo) : '',
    subArticuloId,
    subArticuloTitulo: subArticuloId ? texto(origen.subArticuloTitulo) : '',
    solucionArticuloId,
    solucionArticuloTitulo: solucionArticuloId ? texto(origen.solucionArticuloTitulo) : '',
  }
}

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor : ''
}

// Texto plano de un procedimiento para el indice de busqueda: asi
// "back up" encuentra el articulo aunque solo aparezca en un paso.
// El titulo de la credencial vinculada queda fuera a proposito: los
// titulos de la boveda solo aparecen en la busqueda cuando esta
// desbloqueada (ARQUITECTURA.md, seccion 6).
export function textoDeProcedimiento(procedimiento: Procedimiento | null): string {
  if (!procedimiento) return ''
  const partes = [...procedimiento.requisitos]
  for (const paso of procedimiento.pasos) {
    partes.push(paso.titulo)
    partes.push(...paso.instrucciones)
    // Los titulos del subprocedimiento y de la solucion vinculados si
    // se indexan (no son informacion protegida): buscar "impresora"
    // encuentra tambien los procedimientos que incluyen esa tarea.
    partes.push(paso.subArticuloTitulo, paso.solucionArticuloTitulo)
  }
  return partes.filter(Boolean).join(' ')
}

// A que paso avanzar automaticamente despues de completar el del
// indice dado: el siguiente pendiente hacia adelante o, si no hay,
// el primero pendiente desde el inicio (por si el tecnico salto
// alguno). Devuelve el indice destino o null si no queda ninguno.
export function siguientePasoPendiente(
  idsEnOrden: string[],
  hechos: ReadonlySet<string>,
  desdeIndice: number,
): number | null {
  for (let i = desdeIndice + 1; i < idsEnOrden.length; i++) {
    if (!hechos.has(idsEnOrden[i])) return i
  }
  for (let i = 0; i < desdeIndice; i++) {
    if (!hechos.has(idsEnOrden[i])) return i
  }
  return null
}

// Prepara el procedimiento que se va a guardar: limpia espacios,
// descarta pasos totalmente vacios y devuelve null si no queda nada.
// Los requisitos ya no se editan, pero los articulos guardados antes
// del rediseño los conservan: llegan como texto y pasan de largo.
export function prepararProcedimientoParaGuardar(
  requisitosTexto: string,
  pasos: PasoProcedimiento[],
): Procedimiento | null {
  const requisitos = requisitosTexto
    .split('\n')
    .map((linea) => linea.trim())
    .filter(Boolean)

  const pasosLimpios = pasos
    .map((paso) => ({
      ...paso,
      titulo: paso.titulo.trim(),
      instrucciones: paso.instrucciones.map((i) => i.trim()).filter(Boolean),
      credencialTitulo: paso.credencialId ? paso.credencialTitulo.trim() : '',
      subArticuloTitulo: paso.subArticuloId ? paso.subArticuloTitulo.trim() : '',
      solucionArticuloTitulo: paso.solucionArticuloId ? paso.solucionArticuloTitulo.trim() : '',
    }))
    .filter(
      (paso) =>
        paso.titulo !== '' ||
        paso.instrucciones.length > 0 ||
        paso.imagen !== null ||
        paso.credencialId !== null ||
        paso.subArticuloId !== null ||
        paso.solucionArticuloId !== null,
    )

  if (pasosLimpios.length === 0) return null
  return { requisitos, pasos: pasosLimpios }
}
