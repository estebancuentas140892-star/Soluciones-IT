import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  origenesDistintos,
  referenciasHacia,
  type Arista,
  type TipoEntidad,
  type TipoRelacion,
} from '../lib/grafo'
import { useGrafo } from './useGrafo'

// Etiqueta que ve el usuario para cada tipo de relación, redactada desde
// el punto de vista de la entidad REFERENCIADA ("quién me usa").
const ETIQUETA_RELACION: Record<TipoRelacion, string> = {
  subprocedimiento: 'Usado como subprocedimiento en',
  solucion: 'Usado como solución de error en',
  decision: 'Vinculado desde una decisión en',
  credencial_paso: 'Usada en el procedimiento',
  credencial_tarea: 'Usada en una tarea de',
  // Grupo P2: mismas etiquetas que su par de credencial, pero para un
  // campo protegido de un dispositivo. La ficha del dispositivo NO usa
  // este componente para sus propios campos (viven en SeguridadDelEquipo,
  // no son un "referenciado por" del equipo); estas etiquetas solo
  // aplican si algo pidiera ReferenciadoPor sobre un 'campo_protegido'.
  campo_paso: 'Usado en el procedimiento',
  campo_tarea: 'Usado en una tarea de',
  relacionado: 'Relacionado desde',
  dispositivo_afectado: 'Aparece en',
  diagnostico_articulo: 'Ejecutado por el diagnóstico',
  conexion: 'Conectado con',
  // La ficha del dispositivo muestra sus credenciales con un componente
  // propio que aplica el permiso de bóveda; esta etiqueta es solo el
  // respaldo del Record exhaustivo, redactada desde el equipo.
  credencial_dispositivo: 'Credencial de acceso',
  // Igual que la anterior: la ficha del dispositivo muestra sus propios
  // campos protegidos en SeguridadDelEquipo, no vía este componente.
  campo_dispositivo: 'Dato protegido del equipo',
  // Hallazgo L3: la ficha del dispositivo muestra su propia fila
  // "Reemplazado por" (DispositivoPage.tsx), no vía este componente; esta
  // etiqueta es solo el respaldo del Record exhaustivo.
  reemplaza: 'Reemplazado por',
}

// Orden estable de los grupos en la ficha.
const ORDEN_RELACION: TipoRelacion[] = [
  'diagnostico_articulo',
  'subprocedimiento',
  'solucion',
  'decision',
  'credencial_paso',
  'credencial_tarea',
  'campo_paso',
  'campo_tarea',
  'dispositivo_afectado',
  'relacionado',
  'conexion',
  'credencial_dispositivo',
  'campo_dispositivo',
  'reemplaza',
]

interface Props {
  tipo: TipoEntidad
  id: string
  // Relaciones a incluir. Se limita a propósito por ficha para no
  // duplicar bloques que ya existen (el artículo ya tiene "Aparece como
  // relacionado en" y el dispositivo ya muestra sus conexiones aparte).
  relaciones?: TipoRelacion[]
  titulo?: string
}

// Inverso universal "¿qué referencia a esto?" (fase N1): a partir del
// grafo derivado, lista quién usa esta entidad, agrupado por el tipo de
// vínculo y con enlace a cada origen. Los títulos son vivos (vienen de la
// fila local al construir el grafo), así que renombrar el origen se
// refleja aquí sin tocar nada. Se oculta si no hay referencias.
export function ReferenciadoPor({ tipo, id, relaciones, titulo = 'Referenciado por' }: Props) {
  const grafo = useGrafo()
  const grupos = useMemo(() => agruparPorRelacion(referenciasHacia(grafo, tipo, id, relaciones)), [
    grafo,
    tipo,
    id,
    relaciones,
  ])

  if (grupos.length === 0) return null

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900 px-4 py-4">
      <h2 className="text-sm font-medium text-slate-400">{titulo}</h2>
      {grupos.map((grupo) => (
        <div key={grupo.relacion}>
          <p className="mb-1 text-xs text-slate-500">{ETIQUETA_RELACION[grupo.relacion]}</p>
          <ul className="flex flex-wrap gap-2">
            {grupo.origenes.map((origen) => (
              <li key={`${origen.tipo}:${origen.id}`}>
                <Link
                  to={origen.ruta}
                  className="rounded-full border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-sky-400"
                >
                  {origen.titulo}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

// Agrupa las aristas entrantes por tipo de relación, con los orígenes
// distintos ya ordenados por título, en el orden estable de ORDEN_RELACION.
function agruparPorRelacion(aristas: Arista[]) {
  return ORDEN_RELACION.map((relacion) => ({
    relacion,
    origenes: origenesDistintos(aristas.filter((a) => a.relacion === relacion)),
  })).filter((grupo) => grupo.origenes.length > 0)
}
