import type { RefObject } from 'react'
import { textoMasAbajo } from '../../features/soluciones/ventana'
import { IndicadorMasAbajo } from './IndicadorMasAbajo'
import { useFueraDeVista } from './useFueraDeVista'

// «MÁS ABAJO» YA CONECTADO A LA VENTANA (tarea 348): observa las partes de la
// ventana que están debajo del borde de la pantalla y pinta la franja, o nada
// si todo se ve. Es un componente aparte, y no un gancho en la pantalla de la
// guía, para que se monte y se desmonte con la ventana sin alterar el orden
// de los ganchos de quien lo usa.

interface Props {
  /** La ventana, de donde se toman las partes que se observan. */
  contenedor: RefObject<HTMLElement | null>
  /** Cambia cuando cambian las partes (otra ventana, otro estado): vuelve a observar. */
  clave: string
}

export function MasAbajoDeLaVentana({ contenedor, clave }: Props) {
  const fuera = useFueraDeVista(contenedor, clave, true)
  const aviso = textoMasAbajo(fuera)
  if (!aviso) return null
  return <IndicadorMasAbajo texto={aviso.texto} critico={aviso.critico} />
}
