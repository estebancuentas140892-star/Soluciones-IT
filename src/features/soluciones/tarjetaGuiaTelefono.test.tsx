// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import type { Articulo, TipoArticulo } from '../../lib/db'
import { desmontarTodo, esperar, montar, pasoPrueba } from '../../pruebas/montaje'
import { TarjetaGuiaTelefono } from './TarjetaGuiaTelefono'

// LA TARJETA DE UNA GUÍA EN EL TELÉFONO (tarea 358, D4 y D11): la forma del
// tipo, la línea que la distingue y su medida, con «Aplica a» delante y la
// categoría solo donde la lista las mezcla. Todo lo sembrado es inventado.

const AHORA = '2026-10-26T12:00:00.000Z'

function guia(id: string, extra: Partial<Articulo> = {}, conPasos = true, descripcion = ''): Articulo {
  return {
    id,
    categoriaId: 'cat-imp',
    titulo: `Guía ${id}`,
    tipo: 'configuracion',
    contenido: '',
    etiquetas: [],
    procedimiento: {
      descripcion,
      portada: null,
      objetivoGeneral: '',
      requisitos: [],
      verificacionFinal: [],
      tiempoEstimadoMin: 10,
      dificultad: null,
      pasos: conPasos ? [pasoPrueba(`${id}-p1`, 'Uno', ['Hacer algo']), pasoPrueba(`${id}-p2`, 'Dos', ['Hacer otra cosa'])] : [],
    },
    sintomas: [],
    causas: [],
    dispositivosAfectados: [],
    esRutaInicio: false,
    estado: 'publicado',
    version: '1.0',
    relacionados: [],
    ordenRutaInicio: 0,
    origenSugerenciaId: null,
    aplicaA: null,
    updatedAt: AHORA,
    updatedBy: null,
    eliminadoEn: null,
    ...extra,
  }
}

async function pintar(...tarjetas: React.JSX.Element[]): Promise<HTMLAnchorElement[]> {
  await montar([{ ruta: '/', elemento: <div>{tarjetas}</div> }], '/')
  return esperar(() => {
    const halladas = Array.from(document.body.querySelectorAll<HTMLAnchorElement>('a[data-tarjeta-guia]'))
    return halladas.length === tarjetas.length ? halladas : null
  }, 'las tarjetas')
}

afterEach(async () => {
  await desmontarTodo()
})

const TIPOS: TipoArticulo[] = ['instalacion', 'configuracion', 'conexion', 'problema_frecuente', 'mantenimiento', 'manual']

describe('TarjetaGuiaTelefono', () => {
  it('un glifo por tipo, en tinta y sin el color del tipo', async () => {
    const tarjetas = await pintar(...TIPOS.map((tipo) => <TarjetaGuiaTelefono key={tipo} articulo={guia(tipo, { tipo })} to={`/g/${tipo}`} />))
    const trazos = new Set<string>()
    tarjetas.forEach((tarjeta, i) => {
      const recuadro = tarjeta.querySelector('[data-glifo-tipo]') as HTMLElement
      expect(recuadro.getAttribute('data-glifo-tipo')).toBe(TIPOS[i])
      expect(recuadro.className).toContain('text-noct-text')
      expect(recuadro.className).toContain('bg-noct-neutral-900')
      expect(recuadro.innerHTML).not.toMatch(/noct-(precaucion|exito|tipo-)/)
      trazos.add(recuadro.innerHTML)
    })
    // Seis formas distintas; el problema frecuente, con el glifo de Ventana.
    expect(trazos.size).toBe(6)
    expect(tarjetas[3].querySelector('[data-glifo-tipo] svg')?.getAttribute('viewBox')).toBe('0 0 24 24')
  })

  it('la situación sin «Cuando»; si no hay, el primer síntoma; si tampoco, nada', async () => {
    const [conSituacion, conSintoma, sinNada] = await pintar(
      <TarjetaGuiaTelefono key="a" articulo={guia('a', {}, true, 'Usa esta guía cuando la impresora es nueva')} to="/a" />,
      <TarjetaGuiaTelefono key="b" articulo={guia('b', { tipo: 'problema_frecuente', sintomas: ['Sale en blanco'] })} to="/b" />,
      <TarjetaGuiaTelefono key="c" articulo={guia('c')} to="/c" />,
    )
    expect(conSituacion.querySelector('[data-situacion]')?.textContent).toBe('La impresora es nueva')
    expect(conSituacion.querySelector('[data-situacion]')?.className).toContain('line-clamp-1')
    expect(conSintoma.querySelector('[data-situacion]')?.textContent).toBe('Sale en blanco')
    expect(sinNada.querySelector('[data-situacion]')).toBeNull()
  })

  it('«Aplica a» delante de la medida; «para leer» sin pasos', async () => {
    const [zebra, manual] = await pintar(
      <TarjetaGuiaTelefono
        key="z"
        articulo={guia('z', { tipo: 'mantenimiento', aplicaA: { marca: 'Zebra', modelo: 'ZT411' } })}
        to="/z"
      />,
      <TarjetaGuiaTelefono key="m" articulo={guia('m', { tipo: 'manual' }, false)} to="/m" />,
    )
    expect(zebra.querySelector('[data-medida]')?.textContent).toBe('Zebra ZT411 · Mantenimiento · 2 pasos · ~10 min')
    expect(manual.querySelector('[data-medida]')?.textContent).toBe('Manual · para leer')
    expect(manual.getAttribute('aria-label')).toBe('Abrir "Guía m"')
    expect(zebra.getAttribute('aria-label')).toBe('Abrir la guía "Guía z"')
  })

  it('la categoría solo con `conCategoria`, con su icono de 18', async () => {
    const [con, sin] = await pintar(
      <TarjetaGuiaTelefono key="c" articulo={guia('c', { tipo: 'conexion' })} to="/c" conCategoria categoriaNombre="Impresoras" />,
      <TarjetaGuiaTelefono key="s" articulo={guia('s', { tipo: 'conexion' })} to="/s" categoriaNombre="Impresoras" />,
    )
    expect(con.querySelector('[data-medida]')?.textContent).toBe('Impresoras · Conexión · 2 pasos · ~10 min')
    expect(con.querySelector('[data-medida] [data-icono-categoria]')?.getAttribute('style')).toContain('width: 18px')
    expect(sin.querySelector('[data-medida]')?.textContent).toBe('Conexión · 2 pasos · ~10 min')
    expect(sin.querySelector('[data-medida] [data-icono-categoria]')).toBeNull()
  })

  it('una obsoleta baja de jerarquía y dice su estado', async () => {
    const [obsoleta] = await pintar(<TarjetaGuiaTelefono key="o" articulo={guia('o', { estado: 'obsoleto' })} to="/o" />)
    expect(obsoleta.querySelector('[data-glifo-tipo]')?.className).toContain('text-noct-neutral-500')
    expect(obsoleta.querySelector('[data-nombre-principal]')?.className).toContain('text-noct-neutral-400')
    expect(obsoleta.querySelector('[data-medida]')?.textContent).toMatch(/Obsolet/)
    // El nombre accesible dice lo que la pastilla dice a la vista.
    expect(obsoleta.getAttribute('aria-label')).toBe('Abrir la guía "Guía o" (obsoleta)')
  })

  it('el nombre accesible dice el borrador y la posible coincidencia', async () => {
    const [borrador] = await pintar(
      <TarjetaGuiaTelefono key="b" articulo={guia('b', { estado: 'borrador' })} to="/b" posibleCoincidencia />,
    )
    expect(borrador.getAttribute('aria-label')).toBe('Abrir la guía "Guía b" (borrador), posible coincidencia')
    expect(borrador.querySelector('[data-posible-coincidencia]')).not.toBeNull()
  })
})
