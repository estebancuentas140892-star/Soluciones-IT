import type { Dispositivo } from '../../lib/db'

// Completitud de la ficha del dispositivo (fase J3 de la jornada del
// tecnico): el inventario tiene fichas a medias (foto sin subir, serial
// vacio) y nadie lo ve hasta que necesita el dato en el sitio. Señales
// de peso igual, mismo espiritu que el indicador de completitud del
// editor de articulos (ArticuloForm.tsx): guia, nunca bloquea el
// guardado ni el uso de la ficha.
//
// Los campos pueden llegar `undefined` en registros de migraciones
// viejas sin backfill (lección registrada del proyecto): se leen
// siempre con `?? ''`.

export interface ResultadoCompletitud {
  porcentaje: number
  // Etiquetas legibles de las señales que faltan, en el orden en que
  // se evaluaron (mismo orden que ve el tecnico al leer "Falta: ...").
  faltantes: string[]
}

function tieneTexto(valor: string | null | undefined): boolean {
  return (valor ?? '').trim() !== ''
}

// `categoriaEsRed` decide si la IP entra como señal: solo tiene sentido
// exigirla en equipos de infraestructura de red (switches, APs...), no
// en un dispositivo cualquiera del inventario general.
export function completitudDispositivo(
  dispositivo: Dispositivo,
  categoriaEsRed: boolean,
): ResultadoCompletitud {
  const senales: { etiqueta: string; cumple: boolean }[] = [
    { etiqueta: 'nombre', cumple: tieneTexto(dispositivo.nombre) },
    { etiqueta: 'categoría', cumple: tieneTexto(dispositivo.categoriaId) },
    { etiqueta: 'marca', cumple: tieneTexto(dispositivo.marca) },
    { etiqueta: 'modelo', cumple: tieneTexto(dispositivo.modelo) },
    { etiqueta: 'serial', cumple: tieneTexto(dispositivo.serial) },
    // La ubicacion cuenta como completa con la entidad enlazada
    // (ubicacionId, dato canonico) o, a falta de ella, con el texto
    // libre de respaldo (equipos aun no migrados a la entidad N3).
    { etiqueta: 'ubicación', cumple: tieneTexto(dispositivo.ubicacionId) || tieneTexto(dispositivo.ubicacion) },
    { etiqueta: 'estado', cumple: tieneTexto(dispositivo.estado) },
    { etiqueta: 'foto', cumple: Boolean(dispositivo.foto) },
  ]
  if (categoriaEsRed) {
    senales.push({ etiqueta: 'dirección IP', cumple: tieneTexto(dispositivo.ip) })
  }

  const cumplidas = senales.filter((s) => s.cumple).length
  return {
    porcentaje: Math.round((cumplidas / senales.length) * 100),
    faltantes: senales.filter((s) => !s.cumple).map((s) => s.etiqueta),
  }
}

export interface PasoSiguiente {
  clave: 'foto' | 'seguridad' | 'conexiones' | 'procedimiento'
  etiqueta: string
}

export interface DisponibilidadPasos {
  // Sin permiso de bóveda el técnico no puede guardar datos de
  // Seguridad, así que ese paso no se le ofrece (mismo criterio que ya
  // aplica SeguridadDelEquipo.tsx, que directamente no se renderiza).
  puedeVerBoveda: boolean
  tieneSeguridad: boolean
  tieneConexiones: boolean
  tieneProcedimiento: boolean
}

// Pasos sugeridos tras dar de alta un equipo (hallazgo O1 de la
// auditoría de flujos): documentar un equipo completo cruza 4
// contextos de la misma ficha (foto, Seguridad, Conexiones,
// procedimiento vinculado) que hoy se recorren de a uno. No es una
// lista de bloqueo, es una guía puntual que se muestra una sola vez
// justo después de crear el equipo (ver DispositivoPage.tsx); se
// recalcula en vivo, así que un paso desaparece de la lista en cuanto
// se completa, sin recargar la página.
export function pasosSiguientes(
  dispositivo: Dispositivo,
  disponibilidad: DisponibilidadPasos,
): PasoSiguiente[] {
  const pasos: PasoSiguiente[] = []
  if (!dispositivo.foto) pasos.push({ clave: 'foto', etiqueta: 'Agregar una foto' })
  if (disponibilidad.puedeVerBoveda && !disponibilidad.tieneSeguridad) {
    pasos.push({ clave: 'seguridad', etiqueta: 'Guardar sus datos de acceso' })
  }
  if (!disponibilidad.tieneConexiones) {
    pasos.push({ clave: 'conexiones', etiqueta: 'Registrar sus conexiones de red' })
  }
  if (!disponibilidad.tieneProcedimiento) {
    pasos.push({ clave: 'procedimiento', etiqueta: 'Vincular un procedimiento o reportar una incidencia' })
  }
  return pasos
}
