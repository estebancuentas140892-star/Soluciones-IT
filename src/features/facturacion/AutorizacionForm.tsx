import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useId, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Chasis } from '../../app/Chasis'
import { useOrigen } from '../../app/useOrigen'
import { Campo, CLASE_CAMPO, CLASE_ETIQUETA } from '../../components/campos'
import { Check, FloppyDisk } from '../../components/iconos'
import { BTN_PRIMARIO } from '../../components/nocturne'
import { OpcionRadio } from '../../components/OpcionRadio'
import { etiquetaEstadoAutorizacion, ESTADOS_AUTORIZACION } from '../../lib/autorizaciones'
import { db, type EstadoAutorizacion } from '../../lib/db'
import { conOrigen } from '../../lib/origenNavegacion'
import { guardarRegistro, nuevoId } from '../../lib/repositorio'
import { hoyIso } from '../mantenimientos/mantenimiento'
import {
  autorizacionDesdeDatos,
  DATOS_VACIOS,
  datosDesdeAutorizacion,
  errorDeAutorizacion,
  esCategoriaPos,
  evidenciaValida,
  type DatosAutorizacion,
} from './autorizacion'

// REGISTRAR O EDITAR UNA AUTORIZACIÓN DE FACTURACIÓN (tarea 321).
//
// Tres grupos con su propio rótulo, en el orden en que se conoce el dato,
// para que nunca se mezcle lo que dice un papel con lo que alguien
// comprobó ni con lo que se acaba de leer:
//   1. "Lo que dice el documento": prefijo, formulario, rango,
//      formalización, vigencia, el vencimiento según la fuente, la fuente,
//      los POS que la usan y el documento adjunto.
//   2. "Confirmación": el estado. "Confirmada" pide cuándo y con qué
//      fuente actual se comprobó; un PDF por sí solo no la confirma. Solo
//      aquí cabe el vencimiento confirmado.
//   3. "Dato actual: el consecutivo": la última lectura real, con su día
//      y dónde se leyó. Nunca se calcula.
// Las claves de ICG o HKA no tienen sitio aquí: van en la Bóveda.
//
// Desde la ficha de un POS se llega con `?equipo=<id>`: ese POS ya va
// marcado y, al guardar, la ficha de la autorización vuelve a él.

const AYUDA_ESTADO: Record<EstadoAutorizacion, string> = {
  documentada: 'La dice un documento y nadie la ha comprobado todavía.',
  confirmada: 'Comprobada con una fuente actual: la configuración en ICG/HKA o la consulta en la DIAN.',
  conflicto: 'Las fuentes no coinciden. Se explica en las observaciones y no se elige ninguna.',
  reemplazada: 'Ya no se usa: la sustituyó otra autorización.',
}

export function AutorizacionForm() {
  const { autorizacionId } = useParams()
  // Una instancia por autorización: registrar y editar comparten este
  // componente, y React lo reutilizaría al pasar de una ruta a la otra
  // sin desmontarlo, con el id y lo escrito de la anterior (guardaría una
  // autorización nueva en vez de editar la que se abrió).
  return <FormularioAutorizacion key={autorizacionId ?? 'nueva'} autorizacionId={autorizacionId} />
}

function FormularioAutorizacion({ autorizacionId }: { autorizacionId: string | undefined }) {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const origen = useOrigen()
  const esEdicion = Boolean(autorizacionId)
  const [id] = useState(() => autorizacionId ?? nuevoId())
  const equipoContextual = esEdicion ? '' : (searchParams.get('equipo') ?? '')

  const autorizacion = useLiveQuery(
    async () => (autorizacionId ? ((await db.autorizaciones_facturacion.get(autorizacionId)) ?? null) : undefined),
    [autorizacionId],
  )
  const categorias = useLiveQuery(() => db.categorias.toArray(), [], [])
  const dispositivos = useLiveQuery(() => db.dispositivos.filter((d) => !d.eliminadoEn).toArray(), [], [])

  const [datos, setDatos] = useState<DatosAutorizacion>(() => ({
    ...DATOS_VACIOS,
    dispositivoIds: equipoContextual ? [equipoContextual] : [],
  }))
  const [motivo, setMotivo] = useState('')
  const [cargado, setCargado] = useState(!esEdicion)
  const [intentado, setIntentado] = useState(false)
  const [guardando, setGuardando] = useState(false)
  // Lo que se dice cuando desmarcar un POS se lleva el documento elegido.
  const [avisoEvidencia, setAvisoEvidencia] = useState<string | null>(null)

  useEffect(() => {
    if (!autorizacion || cargado) return
    setDatos(datosDesdeAutorizacion(autorizacion))
    setCargado(true)
  }, [autorizacion, cargado])

  // Los POS que se pueden marcar: los de la categoría POS y, además,
  // cualquiera que ya la use aunque sea de otra categoría (no se quita
  // una relación por no aparecer en la lista).
  const candidatos = useMemo(() => {
    const idsPos = new Set(categorias.filter((c) => esCategoriaPos(c.nombre)).map((c) => c.id))
    return dispositivos
      .filter((d) => idsPos.has(d.categoriaId) || datos.dispositivoIds.includes(d.id))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { numeric: true }))
  }, [categorias, dispositivos, datos.dispositivoIds])

  // El documento se elige entre los adjuntos de los POS marcados: existe
  // una sola vez, colgado de su equipo.
  const adjuntos = useLiveQuery(
    async () => {
      if (datos.dispositivoIds.length === 0) return []
      const todos = await db.adjuntos.where('[entidadTipo+entidadId]').anyOf(
        datos.dispositivoIds.map((d) => ['dispositivo', d]),
      ).toArray()
      return todos.filter((a) => !a.eliminadoEn)
    },
    [datos.dispositivoIds.join(',')],
    [],
  )

  const nombreContextual = dispositivos.find((d) => d.id === equipoContextual)?.nombre
  if (esEdicion && autorizacion === null) return <Navigate to="/facturacion" replace />

  const error = errorDeAutorizacion(datos)
  const mostrarError = intentado ? error : null
  const permiteVencimientoConfirmado =
    datos.estado === 'confirmada' || datos.estado === 'reemplazada' || Boolean(datos.vencimientoConfirmado)
  // La verificación es obligatoria en una confirmada y donde haya un
  // vencimiento confirmado (una reemplazada lo conserva con ella).
  const pideVerificacion = datos.estado === 'confirmada' || Boolean(datos.vencimientoConfirmado)

  function cambiar<K extends keyof DatosAutorizacion>(campo: K, valor: DatosAutorizacion[K]) {
    setDatos((actual) => ({ ...actual, [campo]: valor }))
  }

  // Desmarcar el POS del que cuelga el documento elegido lo quita de la
  // autorización, y se dice: el documento tiene que ser de uno de sus POS.
  function alternarPos(dispositivoId: string) {
    const quitando = datos.dispositivoIds.includes(dispositivoId)
    const marcados = quitando
      ? datos.dispositivoIds.filter((x) => x !== dispositivoId)
      : [...datos.dispositivoIds, dispositivoId]
    let evidencia = datos.evidenciaAdjuntoId
    const documento = adjuntos.find((a) => a.id === evidencia)
    if (quitando && documento && documento.entidadId === dispositivoId) {
      evidencia = ''
      const pos = candidatos.find((d) => d.id === dispositivoId)?.nombre ?? 'ese POS'
      setAvisoEvidencia(`Se quitó el documento «${documento.nombre}»: es de ${pos}, que ya no está marcado.`)
    }
    setDatos({ ...datos, dispositivoIds: marcados, evidenciaAdjuntoId: evidencia })
  }

  function invalido(campo: keyof DatosAutorizacion): boolean {
    return mostrarError?.campo === campo
  }

  async function guardar(evento: FormEvent) {
    evento.preventDefault()
    setIntentado(true)
    if (error || guardando) return
    setGuardando(true)
    const fila = autorizacionDesdeDatos(id, datos)
    // Nunca un id huérfano: el documento tiene que existir, seguir vivo y
    // colgar de uno de sus POS (aunque la base no tenga una FK que lo
    // impida, por el modelo offline primero).
    if (fila.evidenciaAdjuntoId && !evidenciaValida(await db.adjuntos.get(fila.evidenciaAdjuntoId), fila.dispositivoIds)) {
      fila.evidenciaAdjuntoId = null
    }
    await guardarRegistro('autorizaciones_facturacion', fila, motivo.trim())
    // Editar se abre desde la ficha de la autorización: se vuelve atrás a
    // ella, que conserva su propio origen (el POS, la Agenda o la lista).
    // Con un enlace directo no hay a dónde volver ('default'), y se va a
    // la ficha como al registrar.
    if (esEdicion && location.key !== 'default') {
      navigate(-1)
      return
    }
    // Al registrar, la ficha nueva vuelve a donde se empezó.
    const vuelta =
      origen ?? (equipoContextual && nombreContextual ? { to: `/dispositivos/${equipoContextual}`, etiqueta: nombreContextual } : null)
    navigate(`/facturacion/${id}`, { replace: true, state: vuelta ? conOrigen(vuelta.to, vuelta.etiqueta) : undefined })
  }

  return (
    <Chasis
      modo="tarea"
      rotulo={esEdicion ? 'Editando' : 'Registrando'}
      titulo={datos.prefijo.trim() || (esEdicion ? 'Autorización' : 'Autorización nueva')}
      salidaEtiqueta="Cancelar y volver"
      barra={
        <p className="px-4 pb-2.5 text-[12px] text-noct-neutral-500">
          Prefijo y rango DIAN de uno o varios POS. Las claves de ICG o HKA van en la Bóveda.
        </p>
      }
    >
      {esEdicion && !cargado ? (
        <p className="px-4 pt-6 text-sm text-noct-neutral-400">Cargando...</p>
      ) : (
        <form onSubmit={guardar} noValidate className="flex flex-1 flex-col gap-6 px-4 pb-12 pt-[18px]">
          <Grupo titulo="Lo que dice el documento" ayuda="Sin confirmar: así lo dice la fuente.">
            <Campo etiqueta={<Obligatorio>Prefijo</Obligatorio>}>
              <input
                type="text"
                value={datos.prefijo}
                onChange={(e) => cambiar('prefijo', e.target.value)}
                aria-invalid={invalido('prefijo')}
                autoCapitalize="characters"
                className={`min-h-11 ${CLASE_CAMPO}`}
              />
            </Campo>
            <Campo etiqueta="Formulario o documento (opcional)">
              <input
                type="text"
                inputMode="numeric"
                value={datos.formulario}
                onChange={(e) => cambiar('formulario', e.target.value)}
                className={`min-h-11 ${CLASE_CAMPO}`}
              />
            </Campo>
            <div className="grid grid-cols-2 gap-2.5">
              <Campo etiqueta="Rango desde">
                <input
                  type="text"
                  inputMode="numeric"
                  value={datos.rangoDesde}
                  onChange={(e) => cambiar('rangoDesde', e.target.value)}
                  aria-invalid={invalido('rangoDesde')}
                  className={`min-h-11 ${CLASE_CAMPO}`}
                />
              </Campo>
              <Campo etiqueta="Rango hasta">
                <input
                  type="text"
                  inputMode="numeric"
                  value={datos.rangoHasta}
                  onChange={(e) => cambiar('rangoHasta', e.target.value)}
                  aria-invalid={invalido('rangoHasta')}
                  className={`min-h-11 ${CLASE_CAMPO}`}
                />
              </Campo>
            </div>
            <Campo etiqueta="Formalización (opcional)">
              <input
                type="date"
                value={datos.fechaFormalizacion}
                onChange={(e) => cambiar('fechaFormalizacion', e.target.value)}
                aria-invalid={invalido('fechaFormalizacion')}
                className={`min-h-11 ${CLASE_CAMPO}`}
              />
            </Campo>
            <Campo etiqueta="Vigencia reportada (opcional)" ayuda='Como la dice la fuente: "24 meses".'>
              <input
                type="text"
                value={datos.vigenciaReportada}
                onChange={(e) => cambiar('vigenciaReportada', e.target.value)}
                className={`min-h-11 ${CLASE_CAMPO}`}
              />
            </Campo>
            <Campo
              etiqueta="Vence según la fuente (opcional)"
              ayuda="No avisa en la Agenda: solo avisa el vencimiento confirmado."
            >
              <input
                type="date"
                value={datos.vencimientoDocumentado}
                onChange={(e) => cambiar('vencimientoDocumentado', e.target.value)}
                aria-invalid={invalido('vencimientoDocumentado')}
                className={`min-h-11 ${CLASE_CAMPO}`}
              />
            </Campo>
            <Campo etiqueta={<Obligatorio>Fuente</Obligatorio>} ayuda='El documento o archivo que lo dice: "PDF DIAN y Equipos POS.xlsx".'>
              <input
                type="text"
                value={datos.fuente}
                onChange={(e) => cambiar('fuente', e.target.value)}
                aria-invalid={invalido('fuente')}
                className={`min-h-11 ${CLASE_CAMPO}`}
              />
            </Campo>
            <SeleccionPos
              candidatos={candidatos}
              marcados={datos.dispositivoIds}
              alAlternar={alternarPos}
            />
            {avisoEvidencia && (
              <p role="status" className="text-[12.5px] leading-[1.45] text-noct-precaucion [overflow-wrap:anywhere]">
                {avisoEvidencia}
              </p>
            )}
            {adjuntos.length > 0 && (
              <Campo etiqueta="Documento adjunto (opcional)" ayuda="Uno de los adjuntos de sus POS: el archivo existe una sola vez.">
                <select
                  value={datos.evidenciaAdjuntoId}
                  onChange={(e) => {
                    cambiar('evidenciaAdjuntoId', e.target.value)
                    setAvisoEvidencia(null)
                  }}
                  className={`min-h-11 ${CLASE_CAMPO}`}
                >
                  <option value="">Ninguno</option>
                  {adjuntos.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nombre}
                    </option>
                  ))}
                </select>
              </Campo>
            )}
          </Grupo>

          <Grupo titulo="Confirmación">
            <SelectorEstado valor={datos.estado} alCambiar={(estado) => cambiar('estado', estado)} />
            <Campo
              etiqueta={pideVerificacion ? <Obligatorio>Verificada el</Obligatorio> : 'Verificada el (opcional)'}
              ayuda="El día y la fuente van juntos: los dos o ninguno."
            >
              <input
                type="date"
                max={hoyIso()}
                value={datos.verificadoEn}
                onChange={(e) => cambiar('verificadoEn', e.target.value)}
                aria-invalid={invalido('verificadoEn')}
                className={`min-h-11 ${CLASE_CAMPO}`}
              />
            </Campo>
            <Campo
              etiqueta={
                pideVerificacion ? <Obligatorio>Con qué fuente actual</Obligatorio> : 'Con qué fuente actual (opcional)'
              }
              ayuda="La configuración en ICG/HKA o la consulta en la DIAN. Un PDF por sí solo no confirma."
            >
              <input
                type="text"
                value={datos.verificacionFuente}
                onChange={(e) => cambiar('verificacionFuente', e.target.value)}
                aria-invalid={invalido('verificacionFuente')}
                className={`min-h-11 ${CLASE_CAMPO}`}
              />
            </Campo>
            {permiteVencimientoConfirmado && (
              <Campo
                etiqueta="Vencimiento confirmado (opcional)"
                ayuda="Lleva la verificación que lo confirmó. En una confirmada, avisa en la Agenda desde 30 días antes."
              >
                <input
                  type="date"
                  value={datos.vencimientoConfirmado}
                  onChange={(e) => cambiar('vencimientoConfirmado', e.target.value)}
                  aria-invalid={invalido('vencimientoConfirmado')}
                  className={`min-h-11 ${CLASE_CAMPO}`}
                />
              </Campo>
            )}
          </Grupo>

          <Grupo titulo="Dato actual: el consecutivo" ayuda="Solo una lectura real, con su día y dónde se leyó. Nunca se calcula.">
            <Campo etiqueta="Último consecutivo emitido (opcional)">
              <input
                type="text"
                inputMode="numeric"
                value={datos.consecutivoActual}
                onChange={(e) => cambiar('consecutivoActual', e.target.value)}
                aria-invalid={invalido('consecutivoActual')}
                className={`min-h-11 ${CLASE_CAMPO}`}
              />
            </Campo>
            <Campo etiqueta="Leído el">
              <input
                type="date"
                max={hoyIso()}
                value={datos.consecutivoLeidoEn}
                onChange={(e) => cambiar('consecutivoLeidoEn', e.target.value)}
                aria-invalid={invalido('consecutivoLeidoEn')}
                className={`min-h-11 ${CLASE_CAMPO}`}
              />
            </Campo>
            <Campo etiqueta="Dónde se leyó" ayuda='"HKA Factura", "ICG FrontRest".'>
              <input
                type="text"
                value={datos.consecutivoFuente}
                onChange={(e) => cambiar('consecutivoFuente', e.target.value)}
                aria-invalid={invalido('consecutivoFuente')}
                className={`min-h-11 ${CLASE_CAMPO}`}
              />
            </Campo>
          </Grupo>

          <Campo
            etiqueta={datos.estado === 'conflicto' ? <Obligatorio>Observaciones</Obligatorio> : 'Observaciones (opcional)'}
            ayuda={datos.estado === 'conflicto' ? 'Qué fuentes no coinciden y en qué.' : undefined}
          >
            <textarea
              rows={3}
              value={datos.observaciones}
              onChange={(e) => cambiar('observaciones', e.target.value)}
              aria-invalid={invalido('observaciones')}
              className={`resize-y leading-[1.5] ${CLASE_CAMPO}`}
            />
          </Campo>

          {esEdicion && (
            <Campo etiqueta="Motivo del cambio (opcional)">
              <input
                type="text"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                className={`min-h-11 ${CLASE_CAMPO}`}
              />
            </Campo>
          )}

          {mostrarError && (
            <p role="alert" className="text-[12.5px] text-noct-error">
              {mostrarError.mensaje}
            </p>
          )}
          <button type="submit" disabled={guardando} className={`${BTN_PRIMARIO} min-h-11 disabled:opacity-50`}>
            <FloppyDisk size={15} aria-hidden />
            {guardando ? 'Guardando...' : 'Guardar autorización'}
          </button>
        </form>
      )}
    </Chasis>
  )
}

function Obligatorio({ children }: { children: ReactNode }) {
  return (
    <>
      {children} <span className="text-noct-accent-300">*</span>
    </>
  )
}

function Grupo({ titulo, ayuda, children }: { titulo: string; ayuda?: string; children: ReactNode }) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-3.5">
      <legend className="mb-1 flex flex-col gap-0.5">
        <span className="text-[15px] font-medium text-noct-text">{titulo}</span>
        {ayuda && <span className="text-[12px] font-normal text-noct-neutral-500">{ayuda}</span>}
      </legend>
      {children}
    </fieldset>
  )
}

function SelectorEstado({ valor, alCambiar }: { valor: EstadoAutorizacion; alCambiar: (estado: EstadoAutorizacion) => void }) {
  const idPregunta = useId()
  return (
    <div className="flex flex-col gap-1.5">
      <span id={idPregunta} className={CLASE_ETIQUETA}>
        Estado
      </span>
      <div role="radiogroup" aria-labelledby={idPregunta} className="flex flex-col gap-1.5">
        {ESTADOS_AUTORIZACION.map((estado) => (
          <OpcionRadio key={estado} activa={valor === estado} onClick={() => alCambiar(estado)}>
            <span className="block">{etiquetaEstadoAutorizacion(estado)}</span>
            <span className="block text-[12px] text-noct-neutral-500">{AYUDA_ESTADO[estado]}</span>
          </OpcionRadio>
        ))}
      </div>
    </div>
  )
}

function SeleccionPos({
  candidatos,
  marcados,
  alAlternar,
}: {
  candidatos: { id: string; nombre: string }[]
  marcados: string[]
  alAlternar: (dispositivoId: string) => void
}) {
  const idRotulo = useId()
  return (
    <div className="flex flex-col gap-1">
      <span id={idRotulo} className={CLASE_ETIQUETA}>
        POS que la usan
      </span>
      <span className="text-[12px] leading-[1.5] text-noct-neutral-600">
        Ninguno si la fuente no identifica el equipo: no se asigna uno a la fuerza.
      </span>
      {candidatos.length === 0 ? (
        <p className="text-[12.5px] text-noct-neutral-500">No hay equipos en la categoría POS.</p>
      ) : (
        <div role="group" aria-labelledby={idRotulo} className="flex flex-col">
          {candidatos.map((d) => {
            const marcado = marcados.includes(d.id)
            return (
              // Casilla con la misma forma que las de la app (botón con
              // role="checkbox"), no la nativa del navegador.
              <button
                key={d.id}
                type="button"
                role="checkbox"
                aria-checked={marcado}
                onClick={() => alAlternar(d.id)}
                className="flex min-h-11 items-center gap-2.5 text-left text-[13.5px] text-noct-text"
              >
                {marcado ? (
                  <span aria-hidden className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-noct-accent">
                    <Check size={13} className="text-noct-bg" />
                  </span>
                ) : (
                  <span aria-hidden className="h-5 w-5 shrink-0 rounded-md border-[1.5px] border-noct-neutral-600" />
                )}
                <span className="min-w-0 [overflow-wrap:anywhere]">{d.nombre}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
