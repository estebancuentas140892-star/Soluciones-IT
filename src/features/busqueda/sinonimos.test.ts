import { describe, expect, it } from 'vitest'
import { expandirConsulta } from './sinonimos'

describe('expandirConsulta', () => {
  it('agrega los sinónimos de una palabra conocida', () => {
    const expandida = expandirConsulta('backup')
    expect(expandida).toContain('backup')
    expect(expandida).toContain('respaldo')
    expect(expandida).toContain('copia')
    expect(expandida).toContain('seguridad')
  })

  it('no toca una consulta sin sinónimos', () => {
    expect(expandirConsulta('zebra')).toBe('zebra')
    expect(expandirConsulta('switch bodega')).toBe('switch bodega')
  })

  it('es insensible a mayúsculas y acentos', () => {
    expect(expandirConsulta('Cámara')).toContain('cctv')
    expect(expandirConsulta('IMPRESION')).toContain('impresora')
  })

  it('conserva los términos originales al inicio', () => {
    expect(expandirConsulta('internet lento').startsWith('internet lento')).toBe(true)
  })

  it('no repite palabras que el usuario ya escribió', () => {
    const expandida = expandirConsulta('impresora impresion')
    const veces = expandida.split(/\s+/).filter((p) => p === 'impresora').length
    expect(veces).toBe(1)
  })

  it('las frases del diccionario aportan sus palabras sin las vacías', () => {
    // 'pos' expande 'punto de venta' pero sin el 'de'.
    const expandida = expandirConsulta('pos')
    expect(expandida).toContain('punto')
    expect(expandida).toContain('venta')
    expect(expandida.split(/\s+/)).not.toContain('de')
  })

  it('una frase del diccionario se detecta escrita entera y seguida', () => {
    expect(expandirConsulta('copia de seguridad')).toContain('backup')
    expect(expandirConsulta('crear copia de seguridad')).toContain('respaldo')
    // Separadas no son la frase.
    expect(expandirConsulta('acceso al servidor remoto')).not.toContain('tightvnc')
  })
})

// Encargo del 2026-09-14: los nombres reales que usa el equipo, sin
// expansiones generales que contaminen los resultados.
describe('sinónimos de las herramientas de Metroparques', () => {
  function palabras(consulta: string): string[] {
    return expandirConsulta(consulta).split(/\s+/)
  }

  it('tightvnc y vnc se encuentran entre sí', () => {
    expect(palabras('vnc')).toContain('tightvnc')
    expect(palabras('tightvnc')).toContain('vnc')
  })

  it('"acceso remoto" lleva a TightVNC y a AnyDesk; "control remoto", a TightVNC', () => {
    expect(palabras('acceso remoto')).toEqual(expect.arrayContaining(['tightvnc', 'anydesk']))
    expect(palabras('control remoto')).toContain('tightvnc')
    expect(palabras('control remoto')).not.toContain('anydesk')
  })

  it('la palabra general lleva a la herramienta, y la herramienta no arrastra la palabra general', () => {
    expect(palabras('monitoreo')).toContain('zabbix')
    expect(palabras('monitorización')).toContain('zabbix')
    expect(palabras('monitorizacion')).toContain('zabbix')
    expect(palabras('ada')).toContain('sicof')
    expect(palabras('erp')).toContain('sicof')
    expect(palabras('front rest')).toContain('frontrest')
    expect(palabras('document')).toContain('workflow')
    expect(palabras('gestión documental')).toContain('workflow')
    expect(palabras('documentos')).toContain('sharepoint')

    for (const herramienta of ['zabbix', 'sicof', 'anydesk', 'frontrest', 'workflow', 'sharepoint']) {
      expect(expandirConsulta(herramienta)).toBe(herramienta)
    }
  })

  it('los grupos simétricos acotados funcionan en los dos sentidos', () => {
    expect(palabras('icg')).toContain('manager')
    expect(palabras('hka')).toContain('factura')
    expect(palabras('facturación')).toContain('hka')
    expect(palabras('facturacion')).toContain('hka')
    expect(palabras('sonicwall')).toContain('firewall')
    expect(palabras('firewall')).toContain('sonicwall')
    expect(palabras('esxi')).toContain('vmware')
    expect(palabras('virtualización')).toEqual(expect.arrayContaining(['vmware', 'esxi']))
    expect(palabras('telefonía')).toEqual(expect.arrayContaining(['issabel', 'pbx']))
    expect(palabras('ssms')).toEqual(expect.arrayContaining(['sql', 'server']))
    expect(palabras('sql server management studio')).toContain('ssms')
  })

  it('buscar "red" no arrastra herramientas ni equipos de red', () => {
    const expandida = palabras('red')
    for (const ajena of ['zabbix', 'sonicwall', 'firewall', 'switch', 'servidor', 'server', 'vmware', 'tightvnc']) {
      expect(expandida).not.toContain(ajena)
    }
  })
})
