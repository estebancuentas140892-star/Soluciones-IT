import { describe, expect, it } from 'vitest'
import { aEntidadLocal, configTablas, normalizarEntidad, TABLAS_SINCRONIZADAS } from './tablas'

// `normalizarEntidad` repara filas YA guardadas en IndexedDB por
// versiones anteriores de la app (tarea 137). El caso que la motivo es
// el de la tarea 136: una credencial anterior al grupo N3 llega sin la
// propiedad `dispositivos` y reventaba el render de la Boveda.

describe('normalizarEntidad', () => {
  it('repone una propiedad ausente con su valor por defecto (el caso que rompio la Boveda)', () => {
    const credencialVieja: Record<string, unknown> = {
      id: 'c1',
      titulo: 'Acceso impresora',
      categoria: 'Impresoras',
      datosCifrados: 'xxx',
      venceEn: null,
      eliminadoEn: null,
      // `dispositivos`, `tipo` y `archivo` no existen: la fila se
      // descargo antes de que existieran esas columnas.
    }
    expect(normalizarEntidad('credenciales', credencialVieja)).toBe(true)
    expect(credencialVieja.dispositivos).toEqual([])
    expect(credencialVieja.tipo).toBe('cuenta')
    // Sin default declarado y ausente: queda en null, igual que haria hoy una descarga.
    expect(credencialVieja.archivo).toBeNull()
  })

  it('repone tambien cuando la propiedad esta en null, no solo cuando falta', () => {
    const articulo: Record<string, unknown> = { id: 'a1', etiquetas: null, esRutaInicio: null }
    expect(normalizarEntidad('articulos', articulo)).toBe(true)
    expect(articulo.etiquetas).toEqual([])
    expect(articulo.esRutaInicio).toBe(false)
  })

  it('nunca pisa un valor existente, ni siquiera uno vacio', () => {
    // '' , 0 y false son datos legitimos: si se trataran como "hueco",
    // normalizar borraria informacion real del tecnico. Se parte de una
    // fila ya completa (la que daria una descarga de hoy) para que el
    // false del resultado signifique exactamente "no cambio nada".
    const dispositivo = aEntidadLocal('dispositivos', {}) as unknown as Record<string, unknown>
    dispositivo.id = 'd1'
    dispositivo.marca = ''
    dispositivo.observaciones = ''
    dispositivo.estado = 'Operativo'
    dispositivo.detalles = { puerto: '8080' }

    expect(normalizarEntidad('dispositivos', dispositivo)).toBe(false)
    expect(dispositivo.marca).toBe('')
    expect(dispositivo.observaciones).toBe('')
    expect(dispositivo.estado).toBe('Operativo')
    expect(dispositivo.detalles).toEqual({ puerto: '8080' })
  })

  it('cuenta como cambio solo si de verdad repuso algo', () => {
    const incompleta: Record<string, unknown> = { id: 'd1', nombre: 'Switch' }
    expect(normalizarEntidad('dispositivos', incompleta)).toBe(true)
    expect(incompleta.nombre).toBe('Switch')
    expect(incompleta.detalles).toEqual({})
    expect(incompleta.ip).toBe('')
  })

  it('deja en paz un null legitimo de una columna sin default y no lo cuenta como cambio', () => {
    const credencial: Record<string, unknown> = {
      id: 'c1',
      titulo: 'Secreto',
      categoria: '',
      datosCifrados: 'xxx',
      venceEn: null,
      dispositivos: [],
      tipo: 'cuenta',
      archivo: null,
      eliminadoEn: null,
    }
    expect(normalizarEntidad('credenciales', credencial)).toBe(false)
    expect(credencial.venceEn).toBeNull()
    expect(credencial.eliminadoEn).toBeNull()
  })

  it('no toca updatedAt ni updatedBy, que los pone siempre el servidor', () => {
    const fila: Record<string, unknown> = { id: 'c1', dispositivos: [] }
    normalizarEntidad('credenciales', fila)
    expect('updatedAt' in fila).toBe(false)
    expect('updatedBy' in fila).toBe(false)
  })

  it('nunca inventa un valor para los campos cifrados', () => {
    const credencial: Record<string, unknown> = { id: 'c1', datosCifrados: 'secreto-real' }
    normalizarEntidad('credenciales', credencial)
    expect(credencial.datosCifrados).toBe('secreto-real')

    const campo: Record<string, unknown> = { id: 'cp1', valorCifrado: 'otro-secreto' }
    normalizarEntidad('campos_protegidos', campo)
    expect(campo.valorCifrado).toBe('otro-secreto')
  })

  it('es idempotente: la segunda pasada ya no cambia nada', () => {
    const fila: Record<string, unknown> = { id: 'c1', titulo: 'X', datosCifrados: 'y' }
    expect(normalizarEntidad('credenciales', fila)).toBe(true)
    const copia = { ...fila }
    expect(normalizarEntidad('credenciales', fila)).toBe(false)
    expect(fila).toEqual(copia)
  })

  it('da a cada fila su propia copia de los valores por defecto que son arreglos', () => {
    // Si las dos filas compartieran el MISMO arreglo, vincular un
    // equipo en una credencial lo habria vinculado en la otra.
    const a: Record<string, unknown> = { id: 'c1' }
    const b: Record<string, unknown> = { id: 'c2' }
    normalizarEntidad('credenciales', a)
    normalizarEntidad('credenciales', b)
    expect(a.dispositivos).not.toBe(b.dispositivos)
    ;(a.dispositivos as unknown[]).push({ id: 'd1', nombre: 'Equipo 1' })
    expect(b.dispositivos).toEqual([])
  })

  it('deja la fila igual que si se descargara hoy del servidor, en TODAS las tablas', () => {
    // El contrato real: normalizar una fila vieja y vacia debe dar el
    // mismo resultado que `aEntidadLocal` sobre una fila remota vacia
    // (salvo updatedAt/updatedBy, excluidos a proposito). Recorre las
    // 13 tablas, asi que una tabla nueva queda cubierta sola.
    for (const tabla of TABLAS_SINCRONIZADAS) {
      const viaDescarga = aEntidadLocal(tabla, {}) as unknown as Record<string, unknown>
      const viaNormalizacion: Record<string, unknown> = {}
      normalizarEntidad(tabla, viaNormalizacion)
      for (const local of Object.keys(configTablas[tabla].campos)) {
        if (local === 'updatedAt' || local === 'updatedBy') continue
        expect({ tabla, local, valor: viaNormalizacion[local] }).toEqual({
          tabla,
          local,
          valor: viaDescarga[local],
        })
      }
    }
  })
})
