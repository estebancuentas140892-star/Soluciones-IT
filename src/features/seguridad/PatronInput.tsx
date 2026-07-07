import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { agregarNodo, LADO_PATRON, TOTAL_NODOS } from './patron'

// Cuadricula 3x3 para dibujar el patron con el dedo (o el puntero).
// Reutilizada para crear, confirmar y desbloquear: solo notifica la
// secuencia de nodos al soltar, la validacion la decide quien la usa.

const LADO_LIENZO = 300
const PASO = LADO_LIENZO / LADO_PATRON // 100
const CENTRO = PASO / 2 // 50
const RADIO_NODO = 10
const RADIO_ACIERTO = 30

function centroNodo(indice: number): { x: number; y: number } {
  const fila = Math.floor(indice / LADO_PATRON)
  const col = indice % LADO_PATRON
  return { x: CENTRO + col * PASO, y: CENTRO + fila * PASO }
}

interface Props {
  onCompletar: (secuencia: number[]) => void
  deshabilitado?: boolean
  // Al cambiar este valor la cuadricula se limpia (para reintentar
  // tras un error o pedir la confirmacion).
  reiniciarToken?: number
}

export function PatronInput({ onCompletar, deshabilitado, reiniciarToken }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const secuenciaRef = useRef<number[]>([])
  const [secuencia, setSecuenciaEstado] = useState<number[]>([])
  const [puntero, setPuntero] = useState<{ x: number; y: number } | null>(null)
  const [activo, setActivo] = useState(false)

  function fijarSecuencia(nueva: number[]): void {
    secuenciaRef.current = nueva
    setSecuenciaEstado(nueva)
  }

  useEffect(() => {
    fijarSecuencia([])
    setPuntero(null)
    setActivo(false)
  }, [reiniciarToken])

  function puntoDesdeEvento(evento: ReactPointerEvent): { x: number; y: number } | null {
    const svg = svgRef.current
    if (!svg) return null
    const rect = svg.getBoundingClientRect()
    if (!rect.width || !rect.height) return null
    return {
      x: ((evento.clientX - rect.left) / rect.width) * LADO_LIENZO,
      y: ((evento.clientY - rect.top) / rect.height) * LADO_LIENZO,
    }
  }

  function nodoEn(punto: { x: number; y: number }): number | null {
    for (let i = 0; i < TOTAL_NODOS; i++) {
      const c = centroNodo(i)
      if (Math.hypot(c.x - punto.x, c.y - punto.y) <= RADIO_ACIERTO) return i
    }
    return null
  }

  function alBajar(evento: ReactPointerEvent): void {
    if (deshabilitado) return
    const punto = puntoDesdeEvento(evento)
    if (!punto) return
    const nodo = nodoEn(punto)
    if (nodo === null) return
    // Capturar el puntero mantiene el trazo aunque el dedo salga del
    // svg. Puede fallar en algunos entornos (puntero ya liberado); no
    // es critico para dibujar, asi que no se interrumpe el trazo.
    try {
      svgRef.current?.setPointerCapture(evento.pointerId)
    } catch {
      // sin captura: el trazo sigue funcionando dentro del svg
    }
    setActivo(true)
    setPuntero(punto)
    fijarSecuencia(agregarNodo([], nodo))
  }

  function alMover(evento: ReactPointerEvent): void {
    if (!activo) return
    const punto = puntoDesdeEvento(evento)
    if (!punto) return
    setPuntero(punto)
    const nodo = nodoEn(punto)
    if (nodo !== null) fijarSecuencia(agregarNodo(secuenciaRef.current, nodo))
  }

  function alSoltar(): void {
    if (!activo) return
    setActivo(false)
    setPuntero(null)
    const resultado = secuenciaRef.current
    if (resultado.length > 0) onCompletar(resultado)
  }

  const seleccionados = new Set(secuencia)
  const puntos = secuencia.map(centroNodo)
  const lineas = puntos.slice(0, -1).map((p, i) => ({ desde: p, hasta: puntos[i + 1] }))

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${LADO_LIENZO} ${LADO_LIENZO}`}
      className={`aspect-square w-full max-w-[16rem] touch-none select-none ${
        deshabilitado ? 'opacity-50' : ''
      }`}
      role="application"
      aria-label="Cuadrícula para dibujar el patrón"
      onPointerDown={alBajar}
      onPointerMove={alMover}
      onPointerUp={alSoltar}
      onPointerCancel={alSoltar}
    >
      {lineas.map((linea, i) => (
        <line
          key={i}
          x1={linea.desde.x}
          y1={linea.desde.y}
          x2={linea.hasta.x}
          y2={linea.hasta.y}
          stroke="currentColor"
          strokeWidth={4}
          strokeLinecap="round"
          className="text-sky-500"
        />
      ))}

      {activo && puntero && puntos.length > 0 && (
        <line
          x1={puntos[puntos.length - 1].x}
          y1={puntos[puntos.length - 1].y}
          x2={puntero.x}
          y2={puntero.y}
          stroke="currentColor"
          strokeWidth={4}
          strokeLinecap="round"
          className="text-sky-500/60"
        />
      )}

      {Array.from({ length: TOTAL_NODOS }, (_, i) => {
        const c = centroNodo(i)
        const activoNodo = seleccionados.has(i)
        return (
          <g key={i}>
            <circle
              cx={c.x}
              cy={c.y}
              r={RADIO_ACIERTO}
              fill="transparent"
            />
            <circle
              cx={c.x}
              cy={c.y}
              r={activoNodo ? RADIO_NODO + 3 : RADIO_NODO}
              className={activoNodo ? 'fill-sky-500' : 'fill-slate-700'}
            />
          </g>
        )
      })}
    </svg>
  )
}
