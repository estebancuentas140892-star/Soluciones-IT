import { useState, type FormEvent } from 'react'
import { Campo, CLASE_CAMPO_SOBRE_SUPERFICIE } from '../../components/campos'
import { FloppyDisk } from '../../components/iconos'
import { BTN_PRIMARIO_RELLENO } from '../../components/nocturne'
import type { Adjunto } from '../../lib/db'
import { fechaDeHoy } from '../personas/cicloPersona'
import { editarDocumento, errorDeDocumento, type DatosDocumento } from './documentosEquipo'

// EDITAR UN ADJUNTO DE UN EQUIPO (tarea 322), dentro de una hoja de su
// pantalla. Dos clases de dato, y la hoja lo dice:
//   - el nombre, el origen y la fecha son del DOCUMENTO: se guardan en
//     todos los equipos que lo tienen;
//   - la página o nota es de ESTE equipo.
// El origen y la fecha se dejan vacíos si nadie los confirmó: aquí no se
// propone ninguno (ni la fecha de hoy ni la del archivo). La hoja es una
// superficie, así que los campos llevan el fondo de la app.

export function EditarDocumento({
  adjunto,
  nombreEquipo,
  otrosEquipos,
  alTerminar,
}: {
  adjunto: Adjunto
  nombreEquipo: string
  /** En cuántos equipos más está el documento. */
  otrosEquipos: number
  alTerminar: () => void
}) {
  const [datos, setDatos] = useState<DatosDocumento>({
    nombre: adjunto.nombre,
    origen: adjunto.origen,
    fechaDocumento: adjunto.fechaDocumento,
  })
  const [nota, setNota] = useState(adjunto.nota)
  const [intentado, setIntentado] = useState(false)
  const [guardando, setGuardando] = useState(false)

  const error = errorDeDocumento(datos)
  const mostrarError = intentado ? error : null
  // El nombre se valida primero: si él está bien, el error es la fecha.
  const errorEnNombre = mostrarError !== null && !datos.nombre.trim()
  const errorEnFecha = mostrarError !== null && !errorEnNombre

  async function guardar(evento: FormEvent) {
    evento.preventDefault()
    setIntentado(true)
    if (error || guardando) return
    setGuardando(true)
    await editarDocumento(adjunto, datos, nota)
    alTerminar()
  }

  return (
    <form onSubmit={guardar} noValidate className="flex flex-col gap-4">
      {otrosEquipos > 0 && (
        <p className="text-[13.5px] leading-[1.45] text-noct-neutral-300">
          El nombre, el origen y la fecha son del documento: se guardan también en{' '}
          {otrosEquipos === 1 ? 'el otro equipo que lo tiene' : `los otros ${otrosEquipos} equipos que lo tienen`}. La página o nota
          es solo de {nombreEquipo}.
        </p>
      )}
      <Campo etiqueta="Nombre">
        <input
          type="text"
          value={datos.nombre}
          onChange={(e) => setDatos({ ...datos, nombre: e.target.value })}
          aria-invalid={errorEnNombre}
          className={`min-h-11 ${CLASE_CAMPO_SOBRE_SUPERFICIE}`}
        />
      </Campo>
      <Campo etiqueta="Origen (opcional)" ayuda='Solo si está confirmado: "Acta de entrega de Almacén", "Remisión del proveedor".'>
        <input
          type="text"
          value={datos.origen}
          onChange={(e) => setDatos({ ...datos, origen: e.target.value })}
          className={`min-h-11 ${CLASE_CAMPO_SOBRE_SUPERFICIE}`}
        />
      </Campo>
      <Campo etiqueta="Fecha del documento (opcional)" ayuda="Solo si está confirmada. Vacía si no se sabe.">
        <input
          type="date"
          max={fechaDeHoy()}
          value={datos.fechaDocumento ?? ''}
          onChange={(e) => setDatos({ ...datos, fechaDocumento: e.target.value || null })}
          aria-invalid={errorEnFecha}
          className={`min-h-11 ${CLASE_CAMPO_SOBRE_SUPERFICIE}`}
        />
      </Campo>
      <Campo etiqueta={`Página o nota en ${nombreEquipo} (opcional)`} ayuda='"Página 3", "Hoja de entrega del monitor".'>
        <input
          type="text"
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          className={`min-h-11 ${CLASE_CAMPO_SOBRE_SUPERFICIE}`}
        />
      </Campo>
      {mostrarError && (
        <p role="alert" className="text-[13.5px] leading-[1.45] text-noct-error">
          {mostrarError}
        </p>
      )}
      <button type="submit" disabled={guardando} className={`w-full ${BTN_PRIMARIO_RELLENO}`}>
        <FloppyDisk size={18} aria-hidden />
        {guardando ? 'Guardando...' : 'Guardar'}
      </button>
    </form>
  )
}
