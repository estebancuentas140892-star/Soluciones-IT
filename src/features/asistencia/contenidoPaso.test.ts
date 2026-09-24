import { describe, expect, it } from 'vitest'
import type { BloquePaso, PasoProcedimiento, Referencia } from '../../lib/db'
import { construirContenidoDePaso, urlsEnTexto } from './contenidoPaso'
import { validarContenido } from './modelo'

// LO QUE SALE DE UN PASO HACIA EL COMPUTADOR ATENDIDO (tarea 258).
// Todo lo sembrado es INVENTADO: ninguna IP, usuario ni clave real.

function bloque(datos: Partial<BloquePaso> & { id: string; tipo: BloquePaso['tipo'] }): BloquePaso {
  return {
    texto: '',
    tono: null,
    adjunto: null,
    tipoTarea: null,
    decisionArticuloId: null,
    decisionArticuloTitulo: '',
    vinculoProtegido: null,
    alcance: null,
    tareaId: null,
    guiaArticuloId: null,
    guiaArticuloTitulo: '',
    intencionGuia: null,
    referenciaId: null,
    referenciaTitulo: '',
    referenciaTipo: null,
    ...datos,
  }
}

function referencia(datos: Partial<Referencia> & { id: string; tipo: Referencia['tipo']; titulo: string }): Referencia {
  return {
    abreviatura: '',
    alias: [],
    definicion: '',
    ejemplo: '',
    categoria: '',
    plataforma: '',
    valor: '',
    cuandoUsar: '',
    resultadoEsperado: '',
    requiereAdmin: false,
    advertencia: '',
    relacionadas: [],
    etiquetas: [],
    proveedor: '',
    usoEnMetroparques: '',
    estadoUso: '',
    notas: '',
    guiasRelacionadas: [],
    updatedAt: '2026-09-24T00:00:00.000Z',
    updatedBy: null,
    eliminadoEn: null,
    ...datos,
  }
}

const VINCULO_SECRETO = { tipo: 'credencial' as const, id: 'cred-secreta-1', titulo: 'Acceso de prueba al panel' }

function pasoCompleto(): PasoProcedimiento {
  return {
    id: 'p1',
    titulo: 'Vaciar la caché DNS',
    objetivo: 'Que los nombres vuelvan a resolver',
    lugar: 'Símbolo del sistema como administrador',
    resultado: 'Se vació correctamente la caché de resolución de DNS',
    bloques: [
      bloque({ id: 't1', tipo: 'tarea', texto: 'Ejecuta ipconfig /flushdns', tipoTarea: 'accion', vinculoProtegido: VINCULO_SECRETO }),
      bloque({ id: 'a1', tipo: 'aviso', texto: 'Cierra el navegador antes', tono: 'precaucion', alcance: 'tarea', tareaId: 't1' }),
      bloque({ id: 't2', tipo: 'tarea', texto: 'Abre https://soporte.test/ayuda-dns. y revisa', tipoTarea: 'accion' }),
      bloque({ id: 'd1', tipo: 'aviso', texto: 'Servidor DNS: [dirección del servidor]', tono: 'dato', alcance: 'tarea', tareaId: 't2' }),
      bloque({ id: 'r1', tipo: 'referencia', referenciaId: 'ref-ping', alcance: 'tarea', tareaId: 't2' }),
      bloque({ id: 't3', tipo: 'tarea', texto: '¿Responde el servidor?', tipoTarea: 'decision' }),
      bloque({ id: 'i1', tipo: 'imagen', adjunto: { referencia: 'compartidos/x', nombre: 'captura.png', tipo: 'image/png' } }),
      bloque({ id: 'f1', tipo: 'archivo', adjunto: { referencia: 'compartidos/y', nombre: 'manual-dns.pdf', tipo: 'application/pdf' } }),
      bloque({ id: 'g1', tipo: 'guia', guiaArticuloId: 'otra', guiaArticuloTitulo: 'Otra guía interna' }),
    ],
    adjuntos: [],
    vinculoProtegido: VINCULO_SECRETO,
    subArticuloId: null,
    subArticuloTitulo: '',
    solucionArticuloId: null,
    solucionArticuloTitulo: '',
  }
}

const FICHAS = new Map<string, Referencia>([
  ['ref-dns', referencia({ id: 'ref-dns', tipo: 'comando', titulo: 'Limpiar la caché DNS', valor: 'ipconfig /flushdns', plataforma: 'Windows' })],
  ['ref-ping', referencia({ id: 'ref-ping', tipo: 'comando', titulo: 'Comprobar la conexión', valor: 'ping [dirección]' })],
  ['ref-term', referencia({ id: 'ref-term', tipo: 'termino', titulo: 'DNS', definicion: 'Traduce nombres' })],
])

describe('construirContenidoDePaso', () => {
  it('arma el paso entero con lo permitido y en su orden', () => {
    const { contenido, apartados } = construirContenidoDePaso({
      paso: pasoCompleto(),
      numeroPaso: 3,
      tituloGuia: 'Guía de prueba DNS',
      referencias: FICHAS,
    })
    expect(apartados).toEqual([])
    expect(contenido).not.toBeNull()
    expect(contenido?.titulo).toBe('Paso 3 · Vaciar la caché DNS')
    expect(contenido?.subtitulo).toBe('Guía de prueba DNS')
    expect(contenido?.bloques).toEqual([
      { tipo: 'donde', texto: 'Símbolo del sistema como administrador' },
      { tipo: 'accion', texto: 'Ejecuta ipconfig /flushdns' },
      // El comando que la instrucción escribe y tiene ficha, con Copiar.
      { tipo: 'comando', texto: 'ipconfig /flushdns', titulo: 'Limpiar la caché DNS', plataforma: 'Windows' },
      { tipo: 'nota', texto: 'Cierra el navegador antes', etiqueta: 'Precaución' },
      { tipo: 'accion', texto: 'Abre https://soporte.test/ayuda-dns. y revisa' },
      // La URL del texto, sin el punto que cierra la frase.
      { tipo: 'url', texto: 'https://soporte.test/ayuda-dns' },
      { tipo: 'dato', texto: 'Servidor DNS: [dirección del servidor]' },
      { tipo: 'comando', texto: 'ping [dirección]', titulo: 'Comprobar la conexión' },
      { tipo: 'comprobacion', texto: '¿Responde el servidor?' },
      { tipo: 'archivo', texto: 'manual-dns.pdf' },
      { tipo: 'debes_ver', texto: 'Se vació correctamente la caché de resolución de DNS' },
    ])
    expect(validarContenido(contenido)).toBeNull()
  })

  it('NUNCA incluye el vínculo protegido del paso ni el de una tarea', () => {
    const { contenido } = construirContenidoDePaso({
      paso: pasoCompleto(),
      numeroPaso: 1,
      tituloGuia: 'Guía',
      referencias: FICHAS,
    })
    const texto = JSON.stringify(contenido)
    expect(texto).not.toContain('cred-secreta-1')
    expect(texto).not.toContain('Acceso de prueba al panel')
    // Tampoco imágenes, guías vinculadas ni términos del glosario.
    expect(texto).not.toContain('captura.png')
    expect(texto).not.toContain('Otra guía interna')
  })

  it('"Solo esta acción": la tarea y lo que cuelga de ella', () => {
    const { contenido } = construirContenidoDePaso({
      paso: pasoCompleto(),
      numeroPaso: 1,
      tituloGuia: 'Guía',
      referencias: FICHAS,
      tareaId: 't2',
    })
    expect(contenido?.bloques.map((b) => b.tipo)).toEqual(['donde', 'accion', 'url', 'dato', 'comando'])
    expect(contenido?.bloques.some((b) => b.tipo === 'debes_ver')).toBe(false)
  })

  it('aparta lo que parece un secreto y lo dice sin repetirlo', () => {
    const paso = pasoCompleto()
    paso.bloques.push(bloque({ id: 'x1', tipo: 'aviso', texto: 'Contraseña del administrador: Prueba123', tono: 'dato' }))
    const { contenido, apartados } = construirContenidoDePaso({ paso, numeroPaso: 1, tituloGuia: 'Guía', referencias: FICHAS })
    expect(apartados).toEqual([{ que: 'un dato técnico', motivo: 'secreto' }])
    expect(JSON.stringify(contenido)).not.toContain('Prueba123')
    expect(validarContenido(contenido)).toBeNull()
  })

  it('un título con forma de secreto se queda en el número del paso', () => {
    const paso = { ...pasoCompleto(), titulo: 'Clave: 1234' }
    const { contenido } = construirContenidoDePaso({ paso, numeroPaso: 4, tituloGuia: 'Guía', referencias: FICHAS })
    expect(contenido?.titulo).toBe('Paso 4')
  })

  it('no pasa del máximo de bloques y lo dice', () => {
    const paso = {
      ...pasoCompleto(),
      lugar: '',
      resultado: '',
      bloques: Array.from({ length: 45 }, (_, i) => bloque({ id: `t${i}`, tipo: 'tarea' as const, texto: `Acción ${i}` })),
    }
    const { contenido, apartados } = construirContenidoDePaso({ paso, numeroPaso: 1, tituloGuia: 'Guía', referencias: FICHAS })
    expect(contenido?.bloques).toHaveLength(40)
    expect(apartados.filter((a) => a.motivo === 'limite')).toHaveLength(5)
    expect(validarContenido(contenido)).toBeNull()
  })

  it('un paso sin nada que enviar no arma envío', () => {
    const paso = { ...pasoCompleto(), lugar: '', resultado: '', bloques: [] }
    expect(construirContenidoDePaso({ paso, numeroPaso: 1, tituloGuia: 'Guía', referencias: FICHAS }).contenido).toBeNull()
  })

  it('no repite un mismo comando enlazado y escrito', () => {
    const paso = {
      ...pasoCompleto(),
      bloques: [
        bloque({ id: 't1', tipo: 'tarea', texto: 'Ejecuta ipconfig /flushdns' }),
        bloque({ id: 'r1', tipo: 'referencia', referenciaId: 'ref-dns', alcance: 'tarea', tareaId: 't1' }),
      ],
    }
    const { contenido } = construirContenidoDePaso({ paso, numeroPaso: 1, tituloGuia: 'Guía', referencias: FICHAS })
    expect(contenido?.bloques.filter((b) => b.tipo === 'comando')).toHaveLength(1)
  })
})

describe('urlsEnTexto', () => {
  it('solo http(s), sin la puntuación final', () => {
    expect(urlsEnTexto('Ve a https://a.test/x, luego a http://b.test/y). Y no a javascript:alert(1)')).toEqual([
      'https://a.test/x',
      'http://b.test/y',
    ])
  })
})
