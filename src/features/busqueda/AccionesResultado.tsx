import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../../lib/db'
import { copiarAlPortapapeles } from '../../lib/portapapeles'
import { empezarEjecucion } from '../../lib/progresoPasos'
import { ArrowsClockwise, Check, Copy, Play, Warning } from '../../components/iconos'
import { accionesRapidasDeCredencial, copiarCampoCredencial } from '../boveda/accionesCredencial'
import { useBovedaDesbloqueada } from '../boveda/useSesionBoveda'
import { estrenaEjecucion, etiquetaAccionGuia } from '../soluciones/accionGuia'
import { idDeEntidad, useContextoResultados } from './contextoResultados'
import { eventoDeResolucion } from './medicion'
import type { ResultadoBusqueda } from './useIndiceBusqueda'

// ACTUAR DESDE EL RESULTADO (encargo del 2026-09-15, tarea 241,
// secciones 3, 4 y 13).
//
// Hasta hoy un resultado solo sabia hacer una cosa: abrir su ficha. El
// recorrido real era siempre buscar, abrir, buscar la accion dentro y
// ejecutarla; cuatro pasos para lo que en campo es uno solo ("empieza
// esta guia", "dame esa clave").
//
// Que ofrece cada tipo, y por que solo estos cuatro:
//
//   - GUIA: "Empezar" o "Continuar · paso N de M". Lo decide
//     `accionDeGuia`, la MISMA funcion que la ficha y el catalogo; aqui
//     no hay ninguna regla de progreso nueva.
//   - DIAGNOSTICO: "Iniciar". La ruta del diagnostico ya arranca la
//     sesion sola, asi que es la misma ruta con el verbo dicho.
//   - CREDENCIAL: copiar lo que de verdad guarda, con el descifrado, los
//     permisos y la AUDITORIA de siempre (`copiarCampoCredencial`).
//   - COMANDO y ATAJO: copiar lo que se teclea. Es lo que se consulta a
//     mitad de una guia, y asi no hay que salir de ella.
//
// El resto NO lleva boton a proposito (seccion 13, "no convertir todo en
// botones"): en un equipo, una ubicacion, una persona, una categoria o
// una ficha del Centro de consulta, abrir la ficha ES la accion, y la
// fila entera ya la abre. Un boton que repite el enlace de al lado solo
// ocupa sitio.

// Boton de accion de una fila: 44 px reales de alto (regla R6) sin
// ensanchar la fila. El primario va delineado en el acento, como el
// resto de la familia Nocturne.
const ACCION_BASE =
  'inline-flex min-h-11 max-w-full cursor-pointer items-center justify-center gap-1.5 rounded-[9px] border px-3 text-[13.5px] font-medium leading-tight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-noct-accent disabled:opacity-50'
const ACCION_PRIMARIA = `${ACCION_BASE} border-noct-accent bg-noct-accent/10 text-noct-accent-300 hover:bg-noct-accent/[.22]`
const ACCION_SECUNDARIA = `${ACCION_BASE} border-noct-divider text-noct-neutral-200 hover:bg-noct-text/[.07]`

/** Cuanto dura el "Copiado" antes de volver al rotulo normal. */
const MS_AVISO = 1400

/**
 * Las acciones directas de un resultado, o null si su tipo no tiene
 * ninguna mas alla de abrir la ficha.
 */
export function AccionesDeResultado({
  resultado,
  desdeMejores,
}: {
  resultado: ResultadoBusqueda
  /** Salio de "Mejores resultados" (solo para la medicion, seccion 17). */
  desdeMejores: boolean
}) {
  switch (resultado.tipo) {
    case 'articulo':
      return <AccionGuiaResultado resultado={resultado} desdeMejores={desdeMejores} />
    case 'diagnostico':
      return <AccionDiagnostico resultado={resultado} desdeMejores={desdeMejores} />
    case 'credencial':
      return <AccionesCredencial resultado={resultado} desdeMejores={desdeMejores} />
    case 'comando':
    case 'atajo':
      return <AccionCopiarReferencia resultado={resultado} />
    default:
      return null
  }
}

// ----------------------------------------------------------------
// Guia
// ----------------------------------------------------------------

function AccionGuiaResultado({
  resultado,
  desdeMejores,
}: {
  resultado: ResultadoBusqueda
  desdeMejores: boolean
}) {
  const { accionesGuia, consulta, onNavegar, onResolver, huboDesbloqueo } = useContextoResultados()
  const navegar = useNavigate()
  const [preparando, setPreparando] = useState(false)
  const articuloId = idDeEntidad(resultado.id)
  const accion = accionesGuia.get(articuloId)

  // Sin entrada en el mapa la guia no tiene pasos (un manual, un
  // borrador vacio): no hay ejecucion que ofrecer, solo abrir la ficha.
  if (!accion) return null

  const etiqueta = etiquetaAccionGuia(accion, 'tarjeta')
  const prepara = estrenaEjecucion(accion)

  async function ejecutar() {
    if (preparando) return
    setPreparando(true)
    try {
      // Continuar no prepara nada: su progreso se conserva intacto.
      if (prepara) await empezarEjecucion(articuloId)
      onResolver(
        eventoDeResolucion({
          accion: prepara ? 'empezar_guia' : 'continuar_guia',
          tipo: resultado.tipo,
          desdeMejores,
          consulta,
          huboDesbloqueo,
        }),
      )
      onNavegar?.()
      navegar(`${resultado.ruta}/ejecutar`)
    } finally {
      setPreparando(false)
    }
  }

  return (
    <button
      type="button"
      disabled={preparando}
      onClick={() => void ejecutar()}
      aria-label={`${etiqueta}: "${resultado.titulo}"`}
      className={ACCION_PRIMARIA}
    >
      {accion.estado === 'repetir' ? (
        <ArrowsClockwise size={16} className="shrink-0" aria-hidden />
      ) : (
        <Play size={16} className="shrink-0" aria-hidden />
      )}
      <span className="truncate">{etiqueta}</span>
    </button>
  )
}

// ----------------------------------------------------------------
// Diagnostico
// ----------------------------------------------------------------

function AccionDiagnostico({
  resultado,
  desdeMejores,
}: {
  resultado: ResultadoBusqueda
  desdeMejores: boolean
}) {
  const { consulta, onNavegar, onResolver, huboDesbloqueo } = useContextoResultados()
  const navegar = useNavigate()

  // Boton y no enlace: es la misma ruta que abre la fila, pero con el
  // verbo dicho y registrando que el recorrido termino en resolver algo.
  return (
    <button
      type="button"
      onClick={() => {
        onResolver(
          eventoDeResolucion({
            accion: 'iniciar_diagnostico',
            tipo: resultado.tipo,
            desdeMejores,
            consulta,
            huboDesbloqueo,
          }),
        )
        onNavegar?.()
        navegar(resultado.ruta)
      }}
      aria-label={`Iniciar el diagnóstico "${resultado.titulo}"`}
      className={ACCION_PRIMARIA}
    >
      <Play size={16} className="shrink-0" aria-hidden />
      <span className="truncate">Iniciar</span>
    </button>
  )
}

// ----------------------------------------------------------------
// Credencial
// ----------------------------------------------------------------

function AccionesCredencial({
  resultado,
  desdeMejores,
}: {
  resultado: ResultadoBusqueda
  desdeMejores: boolean
}) {
  const desbloqueada = useBovedaDesbloqueada()
  const { consulta, onResolver, huboDesbloqueo } = useContextoResultados()
  const credencialId = idDeEntidad(resultado.id)
  const credencial = useLiveQuery(() => db.credenciales.get(credencialId), [credencialId])
  const [aviso, setAviso] = useState<{ campo: string; ok: boolean; mensaje?: string } | null>(null)
  const temporizador = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => () => clearTimeout(temporizador.current), [])

  // Doble guarda. Una credencial solo llega al indice con la boveda
  // abierta, pero el autobloqueo por inactividad puede cerrarla mientras
  // los resultados siguen en pantalla: sin esto quedaria un boton de
  // copiar que ya no puede descifrar nada.
  if (!desbloqueada || !credencial || credencial.eliminadoEn) return null

  const acciones = accionesRapidasDeCredencial(credencial)
  if (acciones.length === 0) return null

  async function copiar(campo: 'usuario' | 'contrasena', etiqueta: string) {
    if (!credencial) return
    const resultadoCopia = await copiarCampoCredencial(credencial, campo)
    if (resultadoCopia.ok) {
      onResolver(
        eventoDeResolucion({
          accion: 'copiar_credencial',
          tipo: resultado.tipo,
          desdeMejores,
          consulta,
          huboDesbloqueo,
        }),
      )
    }
    clearTimeout(temporizador.current)
    setAviso({ campo: etiqueta, ok: resultadoCopia.ok, mensaje: resultadoCopia.mensaje })
    temporizador.current = setTimeout(() => setAviso(null), MS_AVISO)
  }

  return (
    <>
      {acciones.map(({ campo, etiqueta }) => {
        const avisando = aviso?.campo === etiqueta
        return (
          <button
            key={campo}
            type="button"
            onClick={() => void copiar(campo, etiqueta)}
            aria-label={`${etiqueta} de "${resultado.titulo}"`}
            className={avisando && !aviso.ok ? ACCION_SECUNDARIA : ACCION_PRIMARIA}
          >
            {avisando ? (
              aviso.ok ? (
                <Check size={16} className="shrink-0 text-noct-exito" aria-hidden />
              ) : (
                <Warning size={16} className="shrink-0 text-noct-precaucion" aria-hidden />
              )
            ) : (
              <Copy size={16} className="shrink-0" aria-hidden />
            )}
            <span className="truncate">{avisando ? (aviso.ok ? 'Copiado' : 'No se pudo') : etiqueta}</span>
          </button>
        )
      })}
      {/* El motivo del fallo, donde el técnico está mirando. El valor
          copiado NUNCA se muestra: solo va al portapapeles. */}
      {aviso && !aviso.ok && aviso.mensaje && (
        <p role="status" className="basis-full text-[12px] leading-snug text-noct-precaucion">
          {aviso.mensaje}
        </p>
      )}
    </>
  )
}

// ----------------------------------------------------------------
// Comando y atajo
// ----------------------------------------------------------------

function AccionCopiarReferencia({ resultado }: { resultado: ResultadoBusqueda }) {
  const referenciaId = idDeEntidad(resultado.id)
  const referencia = useLiveQuery(() => db.referencias.get(referenciaId), [referenciaId])
  const [copiado, setCopiado] = useState(false)
  const temporizador = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => () => clearTimeout(temporizador.current), [])

  // `valor` es el comando o la combinación tal como se teclea. Esta
  // tabla NUNCA guarda secretos (ver `Referencia` en db.ts), así que
  // aquí no hay descifrado ni auditoría que hacer.
  const valor = referencia?.valor?.trim() ?? ''
  if (!valor) return null

  const etiqueta = resultado.tipo === 'comando' ? 'Copiar comando' : 'Copiar atajo'

  async function copiar() {
    const ok = await copiarAlPortapapeles(valor)
    clearTimeout(temporizador.current)
    setCopiado(ok)
    if (ok) temporizador.current = setTimeout(() => setCopiado(false), MS_AVISO)
  }

  return (
    <button
      type="button"
      onClick={() => void copiar()}
      aria-label={`${etiqueta}: ${resultado.titulo}`}
      className={ACCION_SECUNDARIA}
    >
      {copiado ? (
        <Check size={16} className="shrink-0 text-noct-exito" aria-hidden />
      ) : (
        <Copy size={16} className="shrink-0" aria-hidden />
      )}
      <span className="truncate">{copiado ? 'Copiado' : etiqueta}</span>
    </button>
  )
}
