// @vitest-environment happy-dom
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AvisoVentana } from './AvisoVentana'
import { FilaComprobacion, FilaInstruccion } from './FilaInstruccion'
import { IndicadorMasAbajo } from './IndicadorMasAbajo'
import { MensajeNoDisponible } from './MensajeNoDisponible'
import { BotonesDelPie, PieVentana, RespuestasDelPie } from './PieVentana'

// LOS COMPONENTES DE LA VENTANA, UNO A UNO (tarea 348).
//
// Son los ladrillos que la ejecución en el teléfono comparte con las demás
// pantallas que los pidan, así que aquí se fija lo que no puede cambiar sin
// que cambie la regla: que las dos advertencias se distingan por más que el
// color, que lo apagado diga por qué, que lo apagado no se esconda con
// opacidad cuando lleva información, y que «Más abajo» sea solo un indicador.

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let contenedor: HTMLDivElement
let raiz: Root

async function pintar(hijo: ReactNode) {
  await act(async () => {
    raiz.render(hijo)
  })
}

function boton(nombre: RegExp | string): HTMLButtonElement {
  const botones = Array.from(contenedor.querySelectorAll<HTMLButtonElement>('button'))
  const hallado = botones.find((b) => {
    const texto = (b.getAttribute('aria-label') ?? b.textContent ?? '').replace(/\s+/g, ' ').trim()
    return typeof nombre === 'string' ? texto === nombre : nombre.test(texto)
  })
  if (!hallado) throw new Error(`No hay botón «${String(nombre)}».`)
  return hallado
}

async function tocar(elemento: HTMLElement) {
  await act(async () => {
    elemento.click()
  })
}

beforeEach(() => {
  contenedor = document.createElement('div')
  document.body.appendChild(contenedor)
  raiz = createRoot(contenedor)
})

afterEach(async () => {
  await act(async () => raiz.unmount())
  contenedor.remove()
})

describe('AvisoVentana', () => {
  it('la precaución lleva su palabra y no pide ningún toque, aunque se le pase un confirmar', async () => {
    const confirmar = vi.fn()
    await pintar(<AvisoVentana nivel="precaucion" texto="Esto borra la copia local." onConfirmar={confirmar} />)
    const aviso = contenedor.querySelector('[data-aviso-ventana="precaucion"]')
    expect(aviso?.textContent).toContain('Precaución')
    expect(aviso?.textContent).toContain('Esto borra la copia local.')
    expect(contenedor.querySelector('button')).toBeNull()
    expect(aviso?.getAttribute('aria-label')).toBe('Precaución')
    expect(aviso?.getAttribute('data-confirmada')).toBeNull()
  })

  it('la crítica se distingue por palabra, icono y borde, no solo por el color', async () => {
    await pintar(
      <>
        <AvisoVentana nivel="precaucion" texto="Una." />
        <AvisoVentana nivel="critica" texto="Otra." />
      </>,
    )
    const precaucion = contenedor.querySelector<HTMLElement>('[data-aviso-ventana="precaucion"]')!
    const critica = contenedor.querySelector<HTMLElement>('[data-aviso-ventana="critica"]')!
    expect(precaucion.textContent).toContain('Precaución')
    expect(critica.textContent).toContain('Advertencia crítica')
    expect(precaucion.querySelector('svg')).not.toBeNull()
    expect(critica.querySelector('svg')).not.toBeNull()
    // Borde fino en la una, de 2 px en la otra, cada una con su línea y su
    // tinte (tarea 350, valores del prototipo).
    expect(precaucion.className).toContain('border-[1.5px]')
    expect(precaucion.className).toContain('border-noct-precaucion-linea')
    expect(critica.className).toContain('border-2')
    expect(critica.className).toContain('border-noct-error-linea')
    expect(critica.className).toContain('bg-noct-error-tinte')
  })

  it('la crítica sin confirmar se lee y no pide nada', async () => {
    await pintar(<AvisoVentana nivel="critica" texto="Irreversible." />)
    expect(contenedor.querySelector('button')).toBeNull()
  })

  it('la crítica pide «Confirmo que la leí», pasa a «Advertencia confirmada» y se deshace tocándola otra vez', async () => {
    const confirmar = vi.fn()
    await pintar(<AvisoVentana nivel="critica" texto="Irreversible." onConfirmar={confirmar} />)
    const pendiente = boton('Confirmo que la leí')
    expect(pendiente.getAttribute('aria-pressed')).toBe('false')
    expect(contenedor.querySelector('[data-aviso-ventana]')?.getAttribute('data-confirmada')).toBe('false')
    await tocar(pendiente)
    expect(confirmar).toHaveBeenCalledTimes(1)

    await pintar(<AvisoVentana nivel="critica" texto="Irreversible." confirmada onConfirmar={confirmar} />)
    // Confirmada, en el verde de lo comprobado, como el prototipo (tarea 350).
    const leida = boton('Advertencia confirmada')
    expect(leida.className).toContain('bg-noct-exito-tinte')
    expect(leida.getAttribute('aria-pressed')).toBe('true')
    expect(contenedor.querySelector('[data-aviso-ventana]')?.getAttribute('data-confirmada')).toBe('true')
    await tocar(leida)
    expect(confirmar).toHaveBeenCalledTimes(2)
  })

  it('el botón de confirmar mide al menos 48 px de alto', async () => {
    await pintar(<AvisoVentana nivel="critica" texto="Irreversible." onConfirmar={() => {}} />)
    expect(boton('Confirmo que la leí').className).toContain('min-h-12')
  })
})

describe('FilaInstruccion y FilaComprobacion', () => {
  it('la instrucción lleva su número y ninguna casilla, y lo que cuelga va debajo', async () => {
    await pintar(
      <FilaInstruccion numero={3} texto="Guarda el cambio">
        <span>Debes ver</span>
      </FilaInstruccion>,
    )
    const fila = contenedor.querySelector('[data-instruccion-ventana="3"]')
    expect(fila?.textContent).toContain('Guarda el cambio')
    // A 19/27, el texto de la instrucción del prototipo (tarea 350).
    expect(fila?.querySelector('p')?.className).toContain('text-[19px]')
    // Lo que cuelga va debajo, alineado con el texto.
    expect(contenedor.querySelector('.pl-\\[42px\\]')?.textContent).toBe('Debes ver')
    expect(contenedor.querySelector('[role="checkbox"], input[type="checkbox"]')).toBeNull()
    // El número visible se oculta al lector, que oye «Instrucción 3:».
    expect(contenedor.querySelector('.sr-only')?.textContent).toBe('Instrucción 3: ')
  })

  it('con dos microacciones o más, la instrucción encabeza y cada microacción lleva su número (tarea 350)', async () => {
    await pintar(
      <FilaInstruccion
        numero={2}
        texto="Elimina la carpeta de AppData"
        microacciones={[
          { id: 'm1', accion: 'Pulsa', elemento: 'Windows + R' },
          { id: 'm2', accion: 'Escribe', elemento: '%appdata%', ubicacion: 'Cuadro Ejecutar' },
        ]}
      />,
    )
    // La instrucción, sin número, encabeza.
    expect(contenedor.querySelector('[data-fila-ventana] > p')?.textContent).toBe('Elimina la carpeta de AppData')
    // Cada microacción con su número, siguiendo el de la ventana, y el
    // elemento en negrita.
    const dos = contenedor.querySelector('[data-instruccion-ventana="2"]')
    const tres = contenedor.querySelector('[data-instruccion-ventana="3"]')
    expect(dos?.textContent).toContain('Pulsa Windows + R')
    expect(dos?.querySelector('strong')?.textContent).toBe('Windows + R')
    expect(tres?.textContent).toContain('Cuadro Ejecutar')
    expect(contenedor.textContent).not.toContain('Cómo hacerlo')
  })

  it('sin nada que cuelgue no deja un hueco', async () => {
    await pintar(<FilaInstruccion numero={1} texto="Abre el panel" />)
    expect(contenedor.querySelector('.pl-\\[42px\\]')).toBeNull()
  })

  it('la comprobación lleva su palabra, no es una casilla y deja su salida dentro', async () => {
    await pintar(
      <FilaComprobacion texto="Se ve el cambio">
        <button type="button">No se cumple</button>
      </FilaComprobacion>,
    )
    const tarjeta = contenedor.querySelector('[data-comprobacion-ventana]')
    expect(tarjeta?.textContent).toContain('Comprobación')
    expect(tarjeta?.textContent).toContain('Se ve el cambio')
    expect(tarjeta?.querySelector('button')?.textContent).toBe('No se cumple')
    expect(tarjeta?.querySelector('[role="checkbox"]')).toBeNull()
  })
})

describe('MensajeNoDisponible', () => {
  it('dice el motivo y se anuncia', async () => {
    await pintar(<MensajeNoDisponible texto="Primero confirma la advertencia de arriba." />)
    const mensaje = contenedor.querySelector('[data-no-disponible]')
    expect(mensaje?.getAttribute('role')).toBe('status')
    expect(mensaje?.textContent).toBe('Primero confirma la advertencia de arriba.')
  })
})

describe('IndicadorMasAbajo', () => {
  it('es solo un indicador: oculto al lector, sin botón y sin capturar toques', async () => {
    await pintar(<IndicadorMasAbajo texto="Más abajo: 2 instrucciones" />)
    const franja = contenedor.querySelector<HTMLElement>('[data-mas-abajo]')!
    expect(franja.textContent).toContain('Más abajo: 2 instrucciones')
    expect(franja.getAttribute('aria-hidden')).toBe('true')
    expect(franja.className).toContain('pointer-events-none')
    expect(franja.className).toContain('h-[34px]')
    expect(franja.querySelector('button, a, [role="button"]')).toBeNull()
    expect(franja.getAttribute('tabindex')).toBeNull()
  })

  it('cuando lo que queda abajo es crítico, se pinta distinto y dice lo mismo con palabras', async () => {
    await pintar(
      <>
        <IndicadorMasAbajo texto="Más abajo: 1 instrucción" />
        <IndicadorMasAbajo texto="Más abajo: advertencia crítica" critico />
      </>,
    )
    const [normal, critico] = Array.from(contenedor.querySelectorAll<HTMLElement>('[data-mas-abajo]'))
    expect(normal.className).not.toContain('text-noct-error')
    expect(critico.className).toContain('text-noct-error')
    expect(critico.textContent).toContain('advertencia crítica')
  })
})

describe('PieVentana con BotonesDelPie', () => {
  const base = {
    etiquetaVolver: 'Volver a la ventana 1',
    puedeVolver: true,
    onVolver: () => {},
    accion: 'listo' as const,
    etiqueta: 'Listo',
    etiquetaCompleta: 'Listo · Siguiente ventana',
    motivo: null,
    onPrincipal: () => {},
  }

  it('el pie es pegajoso y reserva su propio hueco: no es fixed', async () => {
    await pintar(
      <PieVentana>
        <BotonesDelPie {...base} />
      </PieVentana>,
    )
    const pie = contenedor.querySelector<HTMLElement>('[data-pie-ventana]')!
    expect(pie.className).toContain('sticky')
    expect(pie.className).not.toContain('fixed')
    // Respeta la barra del sistema de los teléfonos que la tienen.
    expect(pie.innerHTML).toContain('safe-area-inset-bottom')
  })

  it('«Listo» llama a continuar y su nombre accesible dice a dónde lleva', async () => {
    const principal = vi.fn()
    await pintar(
      <PieVentana>
        <BotonesDelPie {...base} onPrincipal={principal} />
      </PieVentana>,
    )
    const listo = contenedor.querySelector<HTMLElement>('[data-accion-pie="listo"]')!
    expect(listo.getAttribute('aria-label')).toBe('Listo · Siguiente ventana')
    expect(listo.getAttribute('aria-disabled')).toBe('false')
    await tocar(listo)
    expect(principal).toHaveBeenCalledTimes(1)
  })

  it('si la etiqueta ya es el nombre completo no lo repite como aria-label', async () => {
    await pintar(
      <PieVentana>
        <BotonesDelPie {...base} etiqueta="Seguir en la ventana 2" etiquetaCompleta="Seguir en la ventana 2" accion="seguir" />
      </PieVentana>,
    )
    expect(contenedor.querySelector('[data-accion-pie]')?.getAttribute('aria-label')).toBeNull()
  })

  it('apagado: dice por qué, sigue enfocable, no ejecuta la acción y lleva a lo que falta', async () => {
    const principal = vi.fn()
    const aLoQueFalta = vi.fn()
    await pintar(
      <PieVentana>
        <BotonesDelPie
          {...base}
          accion="no-disponible"
          etiqueta="Falta confirmar la advertencia"
          etiquetaCompleta="Falta confirmar la advertencia"
          motivo="Confirma la advertencia crítica de arriba para poder seguir."
          onPrincipal={principal}
          onNoDisponible={aLoQueFalta}
        />
      </PieVentana>,
    )
    const apagado = contenedor.querySelector<HTMLButtonElement>('[data-accion-pie="no-disponible"]')!
    expect(apagado.disabled).toBe(false)
    expect(apagado.getAttribute('aria-disabled')).toBe('true')
    const motivo = contenedor.querySelector('[data-no-disponible]')!
    expect(motivo.textContent).toContain('Confirma la advertencia crítica de arriba')
    expect(apagado.getAttribute('aria-describedby')).toBe(motivo.parentElement?.id)
    // No se apaga con opacidad: el texto sigue legible. (`disabled:opacity-45`
    // de la base solo aplica al atributo `disabled`, que este botón no usa.)
    expect(apagado.className.split(/\s+/).filter((clase) => !clase.startsWith('disabled:'))).not.toContainEqual(
      expect.stringMatching(/^opacity-/),
    )
    await tocar(apagado)
    expect(principal).not.toHaveBeenCalled()
    expect(aLoQueFalta).toHaveBeenCalledTimes(1)
  })

  it('«volver» sin ventana anterior dice que no la hay, y tocarlo no hace nada', async () => {
    const volver = vi.fn()
    await pintar(
      <PieVentana>
        <BotonesDelPie {...base} puedeVolver={false} etiquetaVolver="No hay ventana anterior" onVolver={volver} />
      </PieVentana>,
    )
    const atras = boton('No hay ventana anterior')
    expect(atras.getAttribute('aria-disabled')).toBe('true')
    await tocar(atras)
    expect(volver).not.toHaveBeenCalled()
  })

  it('«volver» disponible mide al menos 44 px', async () => {
    const volver = vi.fn()
    await pintar(
      <PieVentana>
        <BotonesDelPie {...base} onVolver={volver} />
      </PieVentana>,
    )
    const atras = boton('Volver a la ventana 1')
    // 58 x 58 con su relieve, el del prototipo (tarea 350).
    expect(atras.className).toContain('h-[58px]')
    expect(atras.className).toContain('w-[58px]')
    await tocar(atras)
    expect(volver).toHaveBeenCalledTimes(1)
  })

  it('el indicador «Más abajo» va encima de los botones, dentro del pie', async () => {
    await pintar(
      <PieVentana indicador={<IndicadorMasAbajo texto="Más abajo: 1 instrucción" />}>
        <BotonesDelPie {...base} />
      </PieVentana>,
    )
    const pie = contenedor.querySelector('[data-pie-ventana]')!
    const franja = pie.querySelector('[data-mas-abajo]')!
    const principal = pie.querySelector('[data-accion-pie]')!
    expect(franja.compareDocumentPosition(principal) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})

describe('PieVentana con RespuestasDelPie', () => {
  const respuestas = [
    { id: 'a', titulo: 'Clásica', descripcion: 'Veo el menú Archivo arriba.' },
    { id: 'b', titulo: 'Nueva', descripcion: 'Veo una cinta de botones.' },
  ]
  const base = {
    pregunta: '¿Qué versión usas?',
    respuestas,
    elegida: null,
    motivoBloqueo: null,
    onElegir: () => {},
    etiquetaVolver: 'Volver a la ventana 1',
    puedeVolver: true,
    onVolver: () => {},
  }

  it('cada respuesta lleva su criterio dentro y todas pesan igual', async () => {
    await pintar(
      <PieVentana>
        <RespuestasDelPie {...base} />
      </PieVentana>,
    )
    const botones = Array.from(contenedor.querySelectorAll<HTMLElement>('[data-respuesta-ventana]'))
    expect(botones).toHaveLength(2)
    expect(botones[0].textContent).toContain('Veo el menú Archivo arriba.')
    expect(botones[1].textContent).toContain('Veo una cinta de botones.')
    expect(botones[0].className).toBe(botones[1].className)
    // Ni verde ni rojo: ninguna es «la buena».
    for (const b of botones) expect(b.outerHTML).not.toMatch(/noct-(exito|error)/)
    // El grupo se nombra con la pregunta.
    const grupo = contenedor.querySelector('[role="group"]')!
    expect(contenedor.querySelector(`#${CSS.escape(grupo.getAttribute('aria-labelledby')!)}`)?.textContent).toBe('¿Qué versión usas?')
  })

  it('elegir llama a onElegir con el id', async () => {
    const elegir = vi.fn()
    await pintar(
      <PieVentana>
        <RespuestasDelPie {...base} onElegir={elegir} />
      </PieVentana>,
    )
    await tocar(contenedor.querySelectorAll<HTMLElement>('[data-respuesta-ventana]')[1])
    expect(elegir).toHaveBeenCalledWith('b')
  })

  it('Sí/No sin descripción: dos respuestas en fila, sin párrafos vacíos', async () => {
    await pintar(
      <PieVentana>
        <RespuestasDelPie
          {...base}
          respuestas={[
            { id: 'si', titulo: 'Sí', descripcion: '' },
            { id: 'no', titulo: 'No', descripcion: '' },
          ]}
        />
      </PieVentana>,
    )
    const botones = Array.from(contenedor.querySelectorAll<HTMLElement>('[data-respuesta-ventana]'))
    expect(botones.map((b) => b.textContent?.trim())).toEqual(['Sí', 'No'])
    expect(botones[0].querySelectorAll('span')).toHaveLength(1)
  })

  it('bloqueadas: dicen por qué, no responden y NO esconden su criterio con opacidad', async () => {
    const elegir = vi.fn()
    await pintar(
      <PieVentana>
        <RespuestasDelPie {...base} motivoBloqueo="Primero confirma la advertencia de arriba." onElegir={elegir} />
      </PieVentana>,
    )
    expect(contenedor.querySelector('[data-no-disponible]')?.textContent).toBe('Primero confirma la advertencia de arriba.')
    const botones = Array.from(contenedor.querySelectorAll<HTMLElement>('[data-respuesta-ventana]'))
    for (const b of botones) {
      expect(b.getAttribute('aria-disabled')).toBe('true')
      expect(b.className).not.toMatch(/\bopacity-/)
    }
    expect(botones[0].textContent).toContain('Veo el menú Archivo arriba.')
    await tocar(botones[0])
    expect(elegir).not.toHaveBeenCalled()
  })

  it('con una respuesta ya dada (ventana revisada), la marca con palabras además del color', async () => {
    await pintar(
      <PieVentana>
        <RespuestasDelPie {...base} elegida="b" />
      </PieVentana>,
    )
    const botones = Array.from(contenedor.querySelectorAll<HTMLElement>('[data-respuesta-ventana]'))
    expect(botones[0].getAttribute('aria-pressed')).toBe('false')
    expect(botones[1].getAttribute('aria-pressed')).toBe('true')
    expect(botones[1].textContent).toContain('Tu respuesta')
    expect(botones[0].textContent).not.toContain('Tu respuesta')
  })

  it('sin respuesta dada no declara aria-pressed (no son interruptores)', async () => {
    await pintar(
      <PieVentana>
        <RespuestasDelPie {...base} />
      </PieVentana>,
    )
    for (const b of Array.from(contenedor.querySelectorAll('[data-respuesta-ventana]'))) {
      expect(b.getAttribute('aria-pressed')).toBeNull()
    }
  })
})
