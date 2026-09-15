import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { CampoSecreto } from './CampoSecreto'

// UN SECRETO LARGO SE LEE ENTERO (2026-09-15). Se prueba lo que el campo
// pinta, no sus clases: mostrado, el valor llega completo, sin recortes ni
// "..." añadidos; oculto, el valor no se pinta; en los dos casos sigue el
// ojo, y copiar recibe el valor entero sea cual sea su largo. Que el valor
// parta en varias líneas lo comprueba el navegador (tarea 240).
//
// Sin montar nada: el campo no tiene estado propio, así que basta el árbol
// de elementos que devuelve. (`react-dom/server` no sirve aquí: sus
// archivos no se usan en la app y OneDrive puede dejarlos solo en la nube.)

type Elemento = ReactElement<Record<string, unknown>>

// Junta el texto de las etiquetas HTML del árbol y anota cada elemento.
// Lo que va dentro de otro componente (el icono, el botón de copiar) no se
// abre: de ese componente solo interesan sus props.
function recorrer(nodo: ReactNode, elementos: Elemento[]): string {
  if (typeof nodo === 'string' || typeof nodo === 'number') return String(nodo)
  if (Array.isArray(nodo)) return nodo.map((hijo: ReactNode) => recorrer(hijo, elementos)).join('')
  if (!isValidElement<Record<string, unknown>>(nodo)) return ''
  elementos.push(nodo)
  return typeof nodo.type === 'string' ? recorrer(nodo.props.children as ReactNode, elementos) : ''
}

function pintar(props: Parameters<typeof CampoSecreto>[0]) {
  const elementos: Elemento[] = []
  const texto = recorrer(CampoSecreto(props), elementos)
  return {
    texto,
    botones: elementos.filter((e) => e.type === 'button').map((e) => e.props['aria-label']),
    copia: elementos.find((e) => typeof e.type === 'function' && 'valor' in e.props)?.props.valor,
  }
}

// Inventados, con la forma de los que se cortaban: largos, sin espacios
// y con símbolos.
const VALORES = [
  { caso: 'contraseña corta', valor: 'Clave1!' },
  { caso: 'contraseña de más de 40 caracteres', valor: 'Pr0ceso-De-Prueba_Largo.2026+Sin/Espacios41x' },
  { caso: 'contraseña de más de 100 caracteres con símbolos', valor: 'Xq7#Lm2$Rt9@Vb4%'.repeat(7) },
  { caso: 'token largo', valor: `tok.${'a1B2c3D4e5F6g7H8'.repeat(10)}` },
  { caso: 'licencia larga', valor: 'ABCDE-12345-FGHIJ-67890-KLMNO-13579-PQRST-24680-UVWXY-97531' },
  { caso: 'certificado', valor: 'MIIBszCCAVmgAwIBAgIUX0prueba'.repeat(8) },
]

describe('CampoSecreto con valores largos', () => {
  it.each(VALORES)('$caso: mostrado, sale entero, con el ojo y copiando el valor completo', ({ valor }) => {
    const campo = pintar({ etiqueta: 'Clave', valor, oculto: false, alternarOculto: () => undefined })
    // La etiqueta y el valor, nada más.
    expect(campo.texto).toBe(`Clave${valor}`)
    expect(campo.botones).toEqual(['Ocultar Clave'])
    expect(campo.copia).toBe(valor)
  })

  it.each(VALORES)('$caso: oculto, el valor no se pinta y copiar sigue copiándolo entero', ({ valor }) => {
    const campo = pintar({ etiqueta: 'Clave', valor, oculto: true, alternarOculto: () => undefined })
    expect(campo.texto).toBe('Clave••••••••')
    expect(campo.botones).toEqual(['Mostrar Clave'])
    expect(campo.copia).toBe(valor)
  })

  it('un dato que no se oculta sale entero aunque sea largo, y copiar sigue', () => {
    const valor = VALORES[3].valor
    const campo = pintar({ etiqueta: 'Token', valor })
    expect(campo.texto).toBe(`Token${valor}`)
    expect(campo.botones).toEqual([])
    expect(campo.copia).toBe(valor)
  })
})
