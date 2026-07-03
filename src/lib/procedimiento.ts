import type { DecisionPaso, PasoProcedimiento, Procedimiento } from './db'

// Logica pura de los procedimientos paso a paso, separada de los
// componentes para poder probarla sin navegador. El dato viaja como
// JSON por Supabase, asi que aqui se valida y se completa cualquier
// campo faltante antes de usarlo en la interfaz.

export function crearPaso(): PasoProcedimiento {
  return {
    id: crypto.randomUUID(),
    titulo: '',
    detalle: '',
    imagen: null,
    nota: '',
    advertencia: '',
    consejo: '',
    decision: null,
    credencialId: null,
    credencialTitulo: '',
    subArticuloId: null,
    subArticuloTitulo: '',
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

function normalizarPaso(origen: Record<string, unknown>): PasoProcedimiento {
  const credencialId =
    typeof origen.credencialId === 'string' && origen.credencialId !== '' ? origen.credencialId : null
  const subArticuloId =
    typeof origen.subArticuloId === 'string' && origen.subArticuloId !== '' ? origen.subArticuloId : null
  return {
    id: typeof origen.id === 'string' && origen.id !== '' ? origen.id : crypto.randomUUID(),
    titulo: texto(origen.titulo),
    detalle: texto(origen.detalle),
    imagen: typeof origen.imagen === 'string' && origen.imagen !== '' ? origen.imagen : null,
    nota: texto(origen.nota),
    advertencia: texto(origen.advertencia),
    consejo: texto(origen.consejo),
    decision: normalizarDecision(origen.decision),
    credencialId,
    // Los titulos de referencia solo tienen sentido junto a su id.
    credencialTitulo: credencialId ? texto(origen.credencialTitulo) : '',
    subArticuloId,
    subArticuloTitulo: subArticuloId ? texto(origen.subArticuloTitulo) : '',
  }
}

function normalizarDecision(valor: unknown): DecisionPaso | null {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return null
  const origen = valor as Record<string, unknown>
  const pregunta = texto(origen.pregunta).trim()
  if (pregunta === '') return null
  return {
    pregunta,
    pasoSi: numeroDePaso(origen.pasoSi),
    pasoNo: numeroDePaso(origen.pasoNo),
  }
}

// Numero de paso valido (1 en adelante) o null, que significa
// "continuar con el paso siguiente".
function numeroDePaso(valor: unknown): number | null {
  const numero = typeof valor === 'string' ? Number(valor) : valor
  if (typeof numero !== 'number' || !Number.isFinite(numero)) return null
  const entero = Math.trunc(numero)
  return entero >= 1 ? entero : null
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
    partes.push(paso.titulo, paso.detalle, paso.nota, paso.advertencia, paso.consejo)
    if (paso.decision) partes.push(paso.decision.pregunta)
    // El titulo del subprocedimiento vinculado si se indexa (no es
    // informacion protegida): buscar "impresora" encuentra tambien
    // los procedimientos que incluyen esa tarea.
    partes.push(paso.subArticuloTitulo)
  }
  return partes.filter(Boolean).join(' ')
}

// Prepara el procedimiento que se va a guardar: limpia espacios,
// descarta pasos totalmente vacios y devuelve null si no queda nada.
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
      detalle: paso.detalle.trim(),
      nota: paso.nota.trim(),
      advertencia: paso.advertencia.trim(),
      consejo: paso.consejo.trim(),
      decision: paso.decision && paso.decision.pregunta.trim() !== ''
        ? { ...paso.decision, pregunta: paso.decision.pregunta.trim() }
        : null,
      credencialTitulo: paso.credencialId ? paso.credencialTitulo.trim() : '',
      subArticuloTitulo: paso.subArticuloId ? paso.subArticuloTitulo.trim() : '',
    }))
    .filter(
      (paso) =>
        paso.titulo !== '' ||
        paso.detalle !== '' ||
        paso.imagen !== null ||
        paso.credencialId !== null ||
        paso.subArticuloId !== null,
    )

  if (pasosLimpios.length === 0) return null
  return { requisitos, pasos: pasosLimpios }
}
