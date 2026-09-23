import { describe, expect, it } from 'vitest'
import type { Referencia, TipoReferencia } from '../../lib/db'
import { comandosEnTexto, fichasEnlazadasDelPaso, MAXIMO_POR_TAREA } from './comandosEnTexto'

// "¿QUÉ HACE?" SOLO CON EL VALOR EXACTO (tarea 270). Fichas INVENTADAS.

function ficha(id: string, tipo: TipoReferencia, valor: string, datos: Partial<Referencia> = {}): Referencia {
  return { id, tipo, titulo: `Ficha ${id}`, valor, eliminadoEn: null, ...datos } as Referencia
}

const DNS = ficha('dns', 'comando', 'ipconfig /flushdns')
const IPCONFIG = ficha('ipconfig', 'comando', 'ipconfig')
const PING = ficha('ping', 'comando', 'ping')
const EJECUTAR = ficha('ejecutar', 'atajo', 'Win + R')
const TERMINO = ficha('dhcp', 'termino', 'DHCP')

describe('comandosEnTexto', () => {
  it('encuentra el comando escrito entero, sin mirar mayúsculas ni espacios de sobra', () => {
    expect(comandosEnTexto('Abrir la consola y ejecutar IPCONFIG   /flushdns', [DNS])).toEqual([DNS])
  })

  it('un atajo coincide con o sin espacios alrededor del "+"', () => {
    expect(comandosEnTexto('Pulsar Win+R y escribir cmd', [EJECUTAR])).toEqual([EJECUTAR])
    expect(comandosEnTexto('Pulsar win + r', [EJECUTAR])).toEqual([EJECUTAR])
  })

  it('no adivina: dentro de otra palabra, a medias o con otro nombre no es el comando', () => {
    expect(comandosEnTexto('El pingüino de la mascota', [PING])).toEqual([])
    expect(comandosEnTexto('Hacer un pingback', [PING])).toEqual([])
    expect(comandosEnTexto('Ejecutar ipconfig /flush', [DNS])).toEqual([])
    expect(comandosEnTexto('Limpiar la caché de nombres', [DNS])).toEqual([])
  })

  it('si uno está dentro de otro, gana el que se va a teclear entero', () => {
    expect(comandosEnTexto('Ejecutar ipconfig /flushdns', [IPCONFIG, DNS])).toEqual([DNS])
    // Separados, los dos cuentan, en el orden del texto.
    expect(comandosEnTexto('Ejecutar ping y después ipconfig', [IPCONFIG, PING])).toEqual([PING, IPCONFIG])
  })

  it('los términos, las fichas eliminadas y los valores de una letra no se detectan', () => {
    const eliminada = ficha('vieja', 'comando', 'gpupdate', { eliminadoEn: '2026-09-01T00:00:00.000Z' })
    const corta = ficha('f', 'atajo', 'F')
    expect(comandosEnTexto('Renovar DHCP con gpupdate y F', [TERMINO, eliminada, corta])).toEqual([])
  })

  it('dos fichas con el mismo valor dan una sola etiqueta, y hay un tope por tarea', () => {
    const duplicada = ficha('dns-2', 'comando', 'ipconfig /flushdns')
    expect(comandosEnTexto('ipconfig /flushdns', [DNS, duplicada])).toEqual([DNS])
    const muchas = ['uno', 'dos', 'tres', 'cuatro', 'cinco'].map((v) => ficha(v, 'comando', v))
    expect(comandosEnTexto('uno dos tres cuatro cinco', muchas)).toHaveLength(MAXIMO_POR_TAREA)
  })

  it('un hueco del valor vale por una palabra, y los del final son opcionales', () => {
    const pingConHueco = ficha('ping-hueco', 'comando', 'ping [dirección]')
    expect(comandosEnTexto('Escribir ping 192.0.2.40 y pulsar Intro', [pingConHueco])).toEqual([pingConHueco])
    expect(comandosEnTexto('Ejecutar ping', [pingConHueco])).toEqual([pingConHueco])
    const activar = ficha('activar', 'comando', 'net user <usuario> /active:yes')
    expect(comandosEnTexto('Escribir net user prueba /active:yes', [activar])).toEqual([activar])
    // Un hueco intermedio no se salta: sin el usuario no es ese comando.
    expect(comandosEnTexto('Escribir net user /active:yes', [activar])).toEqual([])
    // Un valor que es solo un hueco no deja nada que buscar.
    expect(comandosEnTexto('Pulsar la tecla', [ficha('hueco', 'atajo', '[tecla]')])).toEqual([])
  })

  it('los caracteres especiales del valor se buscan tal cual', () => {
    const procesos = ficha('procesos', 'comando', 'Get-Process | Sort-Object CPU')
    expect(comandosEnTexto('Ejecutar get-process | sort-object cpu en PowerShell', [procesos])).toEqual([procesos])
    expect(comandosEnTexto('Ejecutar get-process sort-object cpu', [procesos])).toEqual([])
  })

  it('las fichas que el paso ya enlaza se reconocen por su bloque de referencia', () => {
    expect(
      fichasEnlazadasDelPaso([
        { tipo: 'tarea', referenciaId: null },
        { tipo: 'referencia', referenciaId: 'dns' },
        { tipo: 'referencia', referenciaId: null },
      ]),
    ).toEqual(new Set(['dns']))
  })
})
