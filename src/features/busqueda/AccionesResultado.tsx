import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { db } from '../../lib/db'
import { copiarAlPortapapeles } from '../../lib/portapapeles'
import { CaretRight, Check, Copy, Eye, Play, Warning } from '../../components/iconos'
import { usePerfilVivo } from '../autenticacion/usePerfilVivo'
import { accionesRapidasDeCredencial, copiarCampoCredencial, tipoDe } from '../boveda/accionesCredencial'
import { useBovedaDesbloqueada } from '../boveda/useSesionBoveda'
import { ACCION_PRIMARIA, ACCION_SECUNDARIA, MS_AVISO } from './clasesAcciones'
import { idDeEntidad, useContextoResultados } from './contextoResultados'
import { eventoDeResolucion } from './medicion'
import { ofreceAccionDirecta } from './modoConsulta'
import type { ResultadoBusqueda } from './useIndiceBusqueda'

// ACTUAR DESDE EL RESULTADO (encargo del 2026-09-15, tarea 241,
// secciones 3, 4 y 13).
//
// Hasta hoy un resultado solo sabia hacer una cosa: abrir su ficha. El
// recorrido real era siempre buscar, abrir, buscar la accion dentro y
// ejecutarla; cuatro pasos para lo que en campo es uno solo ("empieza
// esta guia", "dame esa clave").
//
// Que ofrece cada tipo, y por que solo estos:
//
//   - GUIA: nada desde el 2026-09-17. Abrir la guia ya la lleva a su
//     primer paso pendiente, asi que "Empezar" repetia la fila.
//   - DIAGNOSTICO: "Iniciar". La ruta del diagnostico ya arranca la
//     sesion sola, asi que es la misma ruta con el verbo dicho.
//   - CREDENCIAL: copiar lo que de verdad guarda, con el descifrado, los
//     permisos y la AUDITORIA de siempre (`copiarCampoCredencial`), y
//     desde el 2026-09-16 "Ver", que despliega su vista rapida debajo de
//     la fila (`VistaRapidaCredencial`). Un archivo seguro solo lleva a
//     su ficha.
//   - COMANDO y ATAJO: copiar lo que se teclea. Es lo que se consulta a
//     mitad de una guia, y asi no hay que salir de ella.
//
// El resto NO lleva boton a proposito (seccion 13, "no convertir todo en
// botones"): en un equipo, una ubicacion, una persona, una categoria o
// una ficha del Centro de consulta, abrir la ficha ES la accion, y la
// fila entera ya la abre. Un boton que repite el enlace de al lado solo
// ocupa sitio.
//
// EN MODO CONSULTA (encima de una guia en ejecucion, encargo del
// 2026-09-16, seccion 10) no se ofrece nada que abra OTRA ejecucion: ni
// empezar o continuar una guia ni iniciar un diagnostico. Lo decide
// `ofreceAccionDirecta`. Copiar si sigue: no saca a nadie de ningun sitio.

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
  const { modo } = useContextoResultados()
  if (!ofreceAccionDirecta(resultado.tipo, modo)) return null

  switch (resultado.tipo) {
    // Una GUIA ya no lleva boton (encargo del 2026-09-17): abrirla desde
    // la fila la lleva a su primer paso pendiente, que es lo que hacia
    // "Empezar" / "Continuar". El boton repetia el enlace de al lado.
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
// Diagnostico
// ----------------------------------------------------------------

function AccionDiagnostico({
  resultado,
  desdeMejores,
}: {
  resultado: ResultadoBusqueda
  desdeMejores: boolean
}) {
  const { consulta, onNavegar, onResolver, huboDesbloqueo, alSaltar } = useContextoResultados()
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
        alSaltar()
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
  const perfil = usePerfilVivo()
  const { consulta, onResolver, huboDesbloqueo, modo, alternarVista, estadoDeSalto, alSaltar, onNavegar } =
    useContextoResultados()
  const credencialId = idDeEntidad(resultado.id)
  const credencial = useLiveQuery(() => db.credenciales.get(credencialId), [credencialId])
  const [aviso, setAviso] = useState<{ campo: string; ok: boolean; mensaje?: string } | null>(null)
  const temporizador = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => () => clearTimeout(temporizador.current), [])

  // Doble guarda. Una credencial solo llega al indice con la boveda
  // abierta, pero el autobloqueo por inactividad puede cerrarla mientras
  // los resultados siguen en pantalla: sin esto quedaria un boton de
  // copiar que ya no puede descifrar nada. Y sin el permiso del perfil no
  // se ofrece nada, aunque quedara una fila vieja en este telefono.
  if (!desbloqueada || !perfil?.puedeVerBoveda || !credencial || credencial.eliminadoEn) return null

  // UN ARCHIVO SEGURO NO SE ABRE EN EL BUSCADOR (encargo del 2026-09-16,
  // seccion 2): se descarga y se descifra en su ficha. Fuera de una tarea
  // la accion es ir a ella; en modo consulta no hay accion (la fila
  // despliega la nota que lo explica).
  if (tipoDe(credencial) === 'archivo') {
    if (modo !== 'normal') return null
    return (
      <Link
        to={resultado.ruta}
        state={estadoDeSalto}
        onClick={() => {
          alSaltar()
          onNavegar?.()
        }}
        aria-label={`Abrir la ficha de "${resultado.titulo}"`}
        className={ACCION_SECUNDARIA}
      >
        Abrir ficha
        <CaretRight size={14} className="shrink-0" aria-hidden />
      </Link>
    )
  }

  const acciones = accionesRapidasDeCredencial(credencial)

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
      {/* VER, SIN SALIR DE AQUÍ (encargo del 2026-09-16, sección 2): la
          vista rápida se despliega debajo de esta fila, con la clave
          tapada hasta que se pide. La fila sigue abriendo la ficha
          completa fuera de una tarea. */}
      <button
        type="button"
        onClick={() => alternarVista(resultado.id)}
        aria-label={`Ver "${resultado.titulo}"`}
        className={ACCION_SECUNDARIA}
      >
        <Eye size={16} className="shrink-0" aria-hidden />
        <span className="truncate">Ver</span>
      </button>
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
