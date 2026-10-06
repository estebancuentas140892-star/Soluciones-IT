import type { ComponentType, ReactNode } from 'react'
import { CloudSlash, LockSimple, MagnifyingGlass, type IconoProps } from './iconos'

// CUANDO NO HAY NADA QUE MOSTRAR (tarea 291, auditoría UX de Claude
// Design, sección 11, S4).
//
// Vacío, sin resultados, sin permiso y no disponible sin conexión se
// resolvían caso a caso: algunos muy bien (Equipos crea con lo escrito, el
// Centro de consulta dice dónde sí hay coincidencias, la Bóveda sin permiso
// no revela nada) y otros solo decían "No hay…". Desde aquí son cuatro
// respuestas fijas, cada una con su patrón:
//
// - `vacio`: qué va aquí y, si hay permiso, crear ("Crear un equipo").
// - `sin-resultados`: repite lo buscado y da la alternativa más cercana
//   (crear con lo escrito, "Sí hay coincidencias en…").
// - `sin-permiso`: lo dice y a quién pedirlo. Sin botón y sin revelar nada
//   del contenido (B6).
// - `sin-conexion`: qué falta, cuándo estará y, si se puede, "Descargar".
//
// Sin caja: es contenido de la pantalla, no un aviso flotante.
export type TipoSinContenido = 'vacio' | 'sin-resultados' | 'sin-permiso' | 'sin-conexion'

const ICONO_POR_TIPO: Partial<Record<TipoSinContenido, ComponentType<IconoProps>>> = {
  'sin-resultados': MagnifyingGlass,
  'sin-permiso': LockSimple,
  'sin-conexion': CloudSlash,
}

export function SinContenido({
  tipo,
  titulo,
  texto,
  Icono,
  accion,
  children,
  className = '',
}: {
  tipo: TipoSinContenido
  titulo: ReactNode
  texto?: ReactNode
  // El dibujo de lo que falta (el de la sección en un vacío: un monitor en
  // Equipos). Los otros tres tipos traen el suyo.
  Icono?: ComponentType<IconoProps>
  // La salida, si existe: crear, descargar. Nunca en `sin-permiso`.
  accion?: ReactNode
  // Lo que sigue a la acción ("Sí hay coincidencias en Guías (2)").
  children?: ReactNode
  className?: string
}) {
  const Dibujo = Icono ?? ICONO_POR_TIPO[tipo]
  return (
    <div className={`flex flex-col gap-2.5 ${className}`}>
      <div className="flex flex-col gap-1.5 py-2">
        {Dibujo && (
          <Dibujo
            size={22}
            className={tipo === 'sin-conexion' ? 'text-noct-precaucion' : 'text-noct-neutral-400'}
            aria-hidden
          />
        )}
        <p className="text-pretty text-base font-medium leading-[1.3] text-noct-text">{titulo}</p>
        {texto && <p className="text-pretty text-[13.5px] leading-normal text-noct-neutral-300">{texto}</p>}
      </div>
      {tipo !== 'sin-permiso' && accion && <div className="flex flex-wrap items-center gap-2">{accion}</div>}
      {children}
    </div>
  )
}
