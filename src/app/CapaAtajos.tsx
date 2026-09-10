import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AyudaAtajos } from './AyudaAtajos'
import { esCampoEditable, MS_SECUENCIA, resolverAtajo } from './atajosApp'

const BuscadorGlobal = lazy(() =>
  import('../features/busqueda/BuscadorGlobal').then((m) => ({ default: m.BuscadorGlobal })),
)

// LA CAPA QUE ESCUCHA EL TECLADO.
//
// Vive en el chasis, asi que cubre las tres clases de pantalla sin que
// ninguna tenga que enterarse. No dibuja NINGUN control propio: los
// atajos son una mejora para quien tiene teclado, y sumar un boton
// "atajos" a la barra de un telefono seria pagar espacio de pantalla
// por algo que ahi no se puede usar. La unica entrada visible vive en
// Referencia, donde el equipo consulta el resto del vocabulario.
//
// MIENTRAS HAY UNA CAPA ABIERTA, EL TECLADO ES SUYO. Si el buscador, la
// ayuda, un dialogo o el visor de imagenes estan arriba, esta capa se
// aparta entera: cada uno cierra el suyo con su propio oyente de
// Escape, que es lo que hace que Esc cierre SOLO la capa superior en
// vez de dos a la vez.

export function CapaAtajos({
  puedeVerBoveda,
  navegacion,
}: {
  puedeVerBoveda: boolean
  /** Los atajos de navegación están permitidos en esta pantalla. */
  navegacion: boolean
}) {
  const navigate = useNavigate()
  const [buscadorAbierto, setBuscadorAbierto] = useState(false)
  const [ayudaAbierta, setAyudaAbierta] = useState(false)
  // La secuencia G vive en una ref y no en estado: cambia con cada
  // tecla y no pinta nada, así que guardarla en estado provocaría un
  // render por pulsación sin ningún efecto visible.
  const secuencia = useRef(false)
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    function limpiarSecuencia() {
      secuencia.current = false
      if (temporizador.current) {
        clearTimeout(temporizador.current)
        temporizador.current = null
      }
    }

    function alTeclado(evento: KeyboardEvent) {
      // Una capa nuestra abierta, o cualquier diálogo/visor: el teclado
      // es de quien está arriba.
      if (buscadorAbierto || ayudaAbierta) return
      if (document.querySelector('[role="dialog"]')) return
      // Se escribe: la tecla es del campo, no un atajo.
      if (esCampoEditable(evento.target as HTMLElement | null)) return

      const accion = resolverAtajo(evento, {
        secuenciaActiva: secuencia.current,
        puedeVerBoveda,
        navegacion,
      })
      if (!accion) {
        // Una tecla cualquiera durante la secuencia también la abandona.
        if (secuencia.current) limpiarSecuencia()
        return
      }

      if (accion.tipo === 'cancelar') {
        limpiarSecuencia()
        return
      }

      evento.preventDefault()

      if (accion.tipo === 'esperar') {
        secuencia.current = true
        if (temporizador.current) clearTimeout(temporizador.current)
        // Caduca sola: dejarla abierta convertiría cualquier "e"
        // posterior en un salto a Equipos.
        temporizador.current = setTimeout(limpiarSecuencia, MS_SECUENCIA)
        return
      }

      limpiarSecuencia()
      if (accion.tipo === 'buscar') setBuscadorAbierto(true)
      else if (accion.tipo === 'ayuda') setAyudaAbierta(true)
      else if (accion.tipo === 'ir') navigate(accion.ruta)
    }

    document.addEventListener('keydown', alTeclado)
    return () => {
      document.removeEventListener('keydown', alTeclado)
      limpiarSecuencia()
    }
  }, [buscadorAbierto, ayudaAbierta, puedeVerBoveda, navegacion, navigate])

  return (
    <>
      {buscadorAbierto && (
        <Suspense fallback={null}>
          <BuscadorGlobal abierto onCerrar={() => setBuscadorAbierto(false)} />
        </Suspense>
      )}
      <AyudaAtajos
        abierto={ayudaAbierta}
        onCerrar={() => setAyudaAbierta(false)}
        puedeVerBoveda={puedeVerBoveda}
      />
    </>
  )
}
