import { useState, type FormEvent } from 'react'
import { Campo, CLASE_CAMPO_SOBRE_SUPERFICIE } from '../../components/campos'
import { FloppyDisk } from '../../components/iconos'
import { BTN_PRIMARIO_RELLENO } from '../../components/nocturne'
import { formatearNumero } from '../../lib/autorizaciones'
import type { AutorizacionFacturacion } from '../../lib/db'
import { fechaConAnio } from '../../lib/mantenimientos'
import { guardarRegistro } from '../../lib/repositorio'
import { hoyIso } from '../mantenimientos/mantenimiento'
import {
  autorizacionDesdeDatos,
  datosDesdeAutorizacion,
  errorDeAutorizacion,
  tieneConsecutivoLeido,
  type DatosAutorizacion,
} from './autorizacion'

// REGISTRAR UNA LECTURA DEL CONSECUTIVO SIN ABRIR EL FORMULARIO
// (recomendación RP-2 del rediseño móvil, tarea 335). Se monta dentro de
// una hoja de la ficha de la autorización: los tres campos del dato actual
// (el número, el día en que se leyó y dónde) y nada más.
//
// No hay reglas nuevas: la autorización entera pasa por la misma
// validación que el formulario (`errorDeAutorizacion`: los tres o
// ninguno, dentro del rango, la fecha no futura) y se guarda igual
// (`guardarRegistro`, que deja su entrada en el historial de cada POS).
// Si lo que falla es otro dato de la autorización (guardada antes de una
// regla), se dice y se manda a Editar: aquí no se corrige. La hoja es
// una superficie, así que los campos llevan el fondo de la app.
//
// Desde 768 px (tarea 338) con la letra de los formularios de antes del
// rediseño móvil: los avisos a 12.5-13 px y el botón con el alto, el radio
// y la letra del primario de AutorizacionForm (su color lo da
// BTN_PRIMARIO_RELLENO, delineado desde 768).

type Lectura = Pick<DatosAutorizacion, 'consecutivoActual' | 'consecutivoLeidoEn' | 'consecutivoFuente'>
const CAMPOS_LECTURA: (keyof DatosAutorizacion)[] = ['consecutivoActual', 'consecutivoLeidoEn', 'consecutivoFuente']

export function RegistrarLectura({
  autorizacion,
  alTerminar,
}: {
  autorizacion: AutorizacionFacturacion
  /** Guardada la lectura: la hoja se cierra y la ficha la enseña. */
  alTerminar: () => void
}) {
  // Una lectura nueva: el número se escribe, el día es hoy y el sitio suele
  // ser el de la última vez, así que se propone.
  const [lectura, setLectura] = useState<Lectura>(() => ({
    consecutivoActual: '',
    consecutivoLeidoEn: hoyIso(),
    consecutivoFuente: autorizacion.consecutivoFuente,
  }))
  const [intentado, setIntentado] = useState(false)
  const [guardando, setGuardando] = useState(false)

  const datos: DatosAutorizacion = { ...datosDesdeAutorizacion(autorizacion), ...lectura }
  const error = errorDeAutorizacion(datos)
  const mostrarError = intentado ? error : null
  const deLaLectura = mostrarError !== null && CAMPOS_LECTURA.includes(mostrarError.campo)

  function cambiar(campo: keyof Lectura, valor: string) {
    setLectura((actual) => ({ ...actual, [campo]: valor }))
  }

  async function guardar(evento: FormEvent) {
    evento.preventDefault()
    setIntentado(true)
    if (error || guardando) return
    setGuardando(true)
    await guardarRegistro('autorizaciones_facturacion', autorizacionDesdeDatos(autorizacion.id, datos))
    alTerminar()
  }

  return (
    <form onSubmit={guardar} noValidate className="flex flex-col gap-4 md:gap-3.5">
      {tieneConsecutivoLeido(autorizacion) && (
        <p className="text-[13.5px] leading-[1.45] text-noct-neutral-300 md:text-[13px] md:text-noct-neutral-400">
          Última lectura: <span className="font-mono font-semibold">{formatearNumero(autorizacion.consecutivoActual as number)}</span>
          , el {fechaConAnio(autorizacion.consecutivoLeidoEn as string)} en {autorizacion.consecutivoFuente}.
        </p>
      )}
      <Campo etiqueta="Último consecutivo emitido">
        <input
          type="text"
          inputMode="numeric"
          value={lectura.consecutivoActual}
          onChange={(e) => cambiar('consecutivoActual', e.target.value)}
          aria-invalid={mostrarError?.campo === 'consecutivoActual'}
          className={`min-h-11 font-mono ${CLASE_CAMPO_SOBRE_SUPERFICIE}`}
        />
      </Campo>
      <Campo etiqueta="Leído el">
        <input
          type="date"
          max={hoyIso()}
          value={lectura.consecutivoLeidoEn}
          onChange={(e) => cambiar('consecutivoLeidoEn', e.target.value)}
          aria-invalid={mostrarError?.campo === 'consecutivoLeidoEn'}
          className={`min-h-11 ${CLASE_CAMPO_SOBRE_SUPERFICIE}`}
        />
      </Campo>
      <Campo etiqueta="Dónde se leyó" ayuda='"HKA Factura", "ICG FrontRest".'>
        <input
          type="text"
          value={lectura.consecutivoFuente}
          onChange={(e) => cambiar('consecutivoFuente', e.target.value)}
          aria-invalid={mostrarError?.campo === 'consecutivoFuente'}
          className={`min-h-11 ${CLASE_CAMPO_SOBRE_SUPERFICIE}`}
        />
      </Campo>
      {mostrarError && (
        <p role="alert" className="text-[13.5px] leading-[1.45] text-noct-error md:text-[12.5px]">
          {deLaLectura ? mostrarError.mensaje : `${mostrarError.mensaje} Corrígelo en Editar.`}
        </p>
      )}
      <button
        type="submit"
        disabled={guardando}
        className={`w-full ${BTN_PRIMARIO_RELLENO} md:min-h-11 md:gap-1.5 md:rounded-lg md:text-[13px] md:font-medium md:[&>svg]:size-3.5`}
      >
        <FloppyDisk size={18} aria-hidden />
        {guardando ? 'Guardando...' : 'Guardar lectura'}
      </button>
    </form>
  )
}
