import { describe, expect, it } from 'vitest'
import type {
  Articulo,
  CampoProtegido,
  Credencial,
  Dispositivo,
  EstadoArticulo,
  Referencia,
} from '../../lib/db'
import { agruparResultados } from './resultados'
import {
  buscar,
  buscarArticulosSimilares,
  buscarSimilares,
  crearIndiceDesdeDocumentos,
  documentoDeReferencia,
  documentosDeBusqueda,
  type DatosIndice,
  type DocumentoBusqueda,
} from './useIndiceBusqueda'

const documentos: DocumentoBusqueda[] = [
  {
    id: 'articulo:1',
    tipo: 'articulo',
    titulo: 'Ticket de soporte para POS Verifone',
    subtitulo: 'POS · Problemas frecuentes',
    ruta: '/soluciones/cat-1/1',
    texto:
      'Ticket de soporte para POS Verifone. La impresora térmica Zebra conectada al POS puede fallar si el cable USB está flojo.',
  },
  {
    id: 'articulo:2',
    tipo: 'articulo',
    titulo: 'Configurar impresora Epson TM-T88',
    subtitulo: 'Impresoras · Configuración',
    ruta: '/soluciones/cat-1/2',
    texto: 'Configurar impresora Epson TM-T88 puerto serial',
  },
  {
    id: 'articulo:3',
    tipo: 'articulo',
    titulo: 'Reinicio de switch de red',
    subtitulo: 'Switches · Mantenimiento',
    ruta: '/soluciones/cat-2/3',
    texto: 'Reinicio de switch de red procedimiento estándar',
  },
  {
    id: 'dispositivo:1',
    tipo: 'dispositivo',
    titulo: 'Cámara bodega norte',
    subtitulo: 'Hikvision · DS-2CD1023 · Bodega norte',
    ruta: '/dispositivos/1',
    texto: 'Cámara bodega norte Hikvision DS-2CD1023 Bodega norte 192.168.1.50',
  },
  {
    id: 'articulo:5',
    tipo: 'articulo',
    titulo: 'Crear copia de seguridad del SQL Server',
    subtitulo: 'Servidores · Mantenimiento',
    ruta: '/soluciones/cat-3/5',
    texto: 'Crear copia de seguridad del SQL Server con SQL Server Management Studio',
  },
  {
    id: 'categoria:cat-1',
    tipo: 'categoria',
    titulo: 'Impresoras',
    subtitulo: 'Categoría',
    ruta: '/soluciones/cat-1',
    texto: 'Impresoras',
  },
  {
    id: 'adjunto:manual-zebra',
    tipo: 'adjunto',
    titulo: 'manual_zebra.pdf',
    subtitulo: 'Configurar impresora Epson TM-T88 · Paso 1',
    ruta: '/soluciones/cat-1/2',
    texto: 'manual_zebra.pdf',
  },
  {
    id: 'ubicacion:sala-servidores',
    tipo: 'ubicacion',
    titulo: 'Sala de servidores',
    subtitulo: 'Sede Norte',
    ruta: '/ubicaciones/sala-servidores',
    texto: 'Sala de servidores acceso restringido con llave',
  },
  {
    id: 'persona:juan-perez',
    tipo: 'persona',
    titulo: 'Juan Pérez',
    subtitulo: 'Persona',
    ruta: '/personas/juan-perez',
    texto: 'Juan Pérez contador',
  },
  {
    id: 'diagnostico:d1',
    tipo: 'diagnostico',
    titulo: 'La impresora no imprime',
    subtitulo: 'Impresoras · Diagnóstico',
    ruta: '/diagnostico/d1',
    texto: 'La impresora no imprime revisar spooler y cable',
  },
]

const indice = crearIndiceDesdeDocumentos(documentos)

describe('buscar', () => {
  it('encuentra por una marca mencionada en el contenido, aunque no esté en el título', () => {
    const resultados = buscar(indice, 'zebra')
    expect(resultados.map((r) => r.id)).toContain('articulo:1')
  })

  it('tolera errores de escritura (fuzzy)', () => {
    const resultados = buscar(indice, 'epsom')
    expect(resultados.map((r) => r.id)).toContain('articulo:2')
  })

  it('busca por prefijo mientras se escribe', () => {
    const resultados = buscar(indice, 'impre')
    const ids = resultados.map((r) => r.id)
    expect(ids).toContain('articulo:1')
    expect(ids).toContain('articulo:2')
  })

  it('encuentra dispositivos por marca y ubicación', () => {
    const porMarca = buscar(indice, 'hikvision')
    expect(porMarca.map((r) => r.id)).toContain('dispositivo:1')

    const porUbicacion = buscar(indice, 'bodega')
    expect(porUbicacion.map((r) => r.id)).toContain('dispositivo:1')
  })

  it('prioriza las coincidencias en el título sobre las del contenido', () => {
    const resultados = buscar(indice, 'impresora')
    const posicionTitulo = resultados.findIndex((r) => r.id === 'articulo:2')
    const posicionContenido = resultados.findIndex((r) => r.id === 'articulo:1')
    expect(posicionTitulo).toBeGreaterThanOrEqual(0)
    expect(posicionContenido).toBeGreaterThanOrEqual(0)
    expect(posicionTitulo).toBeLessThan(posicionContenido)
  })

  it('no devuelve nada para una consulta vacía', () => {
    expect(buscar(indice, '   ')).toEqual([])
  })

  it('no mezcla resultados de una categoría con otra sin relación', () => {
    const resultados = buscar(indice, 'switch')
    expect(resultados.map((r) => r.id)).toEqual(['articulo:3'])
  })

  it('encuentra por sinónimo: "backup" halla la copia de seguridad', () => {
    const resultados = buscar(indice, 'backup')
    expect(resultados.map((r) => r.id)).toContain('articulo:5')
  })

  it('encuentra por sinónimo: "internet" halla los artículos de red', () => {
    const resultados = buscar(indice, 'internet')
    expect(resultados.map((r) => r.id)).toContain('articulo:3')
  })

  it('ofrece la categoría además de sus artículos (fase N2)', () => {
    const resultados = buscar(indice, 'impresoras')
    const categoria = resultados.find((r) => r.id === 'categoria:cat-1')
    expect(categoria).toBeDefined()
    expect(categoria?.tipo).toBe('categoria')
  })

  it('encuentra un adjunto por su nombre de archivo (fase N2)', () => {
    const resultados = buscar(indice, 'manual_zebra')
    expect(resultados.map((r) => r.id)).toContain('adjunto:manual-zebra')
    expect(resultados.find((r) => r.id === 'adjunto:manual-zebra')?.tipo).toBe('adjunto')
  })

  it('encuentra una ubicación por su nombre (fase P3)', () => {
    const resultados = buscar(indice, 'sala de servidores')
    const ubicacion = resultados.find((r) => r.id === 'ubicacion:sala-servidores')
    expect(ubicacion).toBeDefined()
    expect(ubicacion?.tipo).toBe('ubicacion')
    expect(ubicacion?.subtitulo).toBe('Sede Norte')
  })

  it('encuentra una persona por su nombre (hallazgo T1)', () => {
    const resultados = buscar(indice, 'juan perez')
    const persona = resultados.find((r) => r.id === 'persona:juan-perez')
    expect(persona).toBeDefined()
    expect(persona?.tipo).toBe('persona')
  })
})

describe('buscarArticulosSimilares', () => {
  it('sugiere artículos con título parecido, excluyendo el propio', () => {
    const similares = buscarArticulosSimilares(indice, 'Configurar impresora Epson', 'nuevo-id')
    expect(similares.map((r) => r.id)).toContain('articulo:2')

    const sinElPropio = buscarArticulosSimilares(indice, 'Configurar impresora Epson', '2')
    expect(sinElPropio.map((r) => r.id)).not.toContain('articulo:2')
  })

  it('ignora coincidencias que solo están en el contenido, no en el título', () => {
    // "zebra" y "flojo" solo aparecen en el texto del articulo:1.
    const similares = buscarArticulosSimilares(indice, 'zebra flojo', 'nuevo-id')
    expect(similares.map((r) => r.id)).not.toContain('articulo:1')
  })

  it('no sugiere nada con títulos muy cortos ni devuelve dispositivos', () => {
    expect(buscarArticulosSimilares(indice, 'cá', 'nuevo-id')).toEqual([])
    const similares = buscarArticulosSimilares(indice, 'Cámara bodega', 'nuevo-id')
    expect(similares.every((r) => r.tipo === 'articulo')).toBe(true)
  })
})

// Hallazgo K5 de AUDITORIA_FLUJOS_TI.md: un problema_frecuente y un
// diagnostico del mismo problema son dos entradas al mismo
// conocimiento; `buscarSimilares` generaliza el aviso de duplicado
// para cruzarlas, en vez de comparar solo artículos con artículos.
describe('buscarSimilares', () => {
  it('cruza artículos y diagnósticos cuando se piden ambos tipos', () => {
    const similares = buscarSimilares(indice, 'La impresora no imprime', 'nuevo-id', ['articulo', 'diagnostico'])
    expect(similares.map((r) => r.id)).toContain('diagnostico:d1')
  })

  it('respeta la lista de tipos: pedir solo diagnóstico excluye artículos parecidos', () => {
    const similares = buscarSimilares(indice, 'Reinicio de switch de red', 'nuevo-id', ['diagnostico'])
    expect(similares).toEqual([])
  })

  it('al editar, excluye el propio diagnóstico de sus resultados', () => {
    const similares = buscarSimilares(indice, 'La impresora no imprime', 'd1', ['articulo', 'diagnostico'])
    expect(similares.map((r) => r.id)).not.toContain('diagnostico:d1')
  })

  it('buscarArticulosSimilares sigue siendo equivalente a pedir solo artículos', () => {
    const general = buscarSimilares(indice, 'Configurar impresora Epson', 'nuevo-id', ['articulo'])
    const especifico = buscarArticulosSimilares(indice, 'Configurar impresora Epson', 'nuevo-id')
    expect(especifico).toEqual(general)
  })
})

// ----------------------------------------------------------------
// Centro de consulta en el buscador global (encargo del 2026-09-14)
// ----------------------------------------------------------------

function datosIndice(parcial: Partial<DatosIndice>): DatosIndice {
  return {
    articulos: [],
    dispositivos: [],
    categorias: [],
    ubicaciones: [],
    personas: [],
    referencias: [],
    credenciales: [],
    diagnosticos: [],
    adjuntos: [],
    camposProtegidos: [],
    bovedaDesbloqueada: false,
    ...parcial,
  }
}

function ficha(parcial: Partial<Referencia> & Pick<Referencia, 'id' | 'tipo' | 'titulo'>): Referencia {
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
    updatedAt: '2026-09-14T00:00:00.000Z',
    updatedBy: null,
    eliminadoEn: null,
    ...parcial,
  }
}

function guia(id: string, titulo: string, estado: EstadoArticulo, contenido = ''): Articulo {
  return {
    id,
    categoriaId: 'cat-1',
    titulo,
    tipo: 'configuracion',
    contenido,
    etiquetas: [],
    procedimiento: null,
    sintomas: [],
    causas: [],
    dispositivosAfectados: [],
    estado,
  } as unknown as Articulo
}

// La forma del contenido que siembra supabase/schema.sql (5.1 y 5.2).
const FICHAS: Referencia[] = [
  ficha({
    id: 'zabbix',
    tipo: 'herramienta',
    titulo: 'Zabbix',
    categoria: 'Monitoreo',
    definicion: 'Plataforma de monitoreo de infraestructura tecnológica.',
    cuandoUsar:
      'Permite supervisar disponibilidad, rendimiento y otros indicadores de servidores, equipos de red, servicios y dispositivos compatibles, y generar alertas ante problemas.',
    estadoUso: 'confirmado',
  }),
  ficha({
    id: 'tightvnc',
    tipo: 'herramienta',
    titulo: 'TightVNC',
    alias: ['Tight VNC'],
    categoria: 'Acceso remoto',
    definicion: 'Herramienta de acceso remoto utilizada para controlar computadores a distancia.',
    usoEnMetroparques:
      'Es la herramienta principal utilizada por el equipo de TI para conectarse remotamente a POS y otros computadores compatibles.',
    estadoUso: 'confirmado',
  }),
  ficha({
    id: 'anydesk',
    tipo: 'herramienta',
    titulo: 'AnyDesk',
    categoria: 'Acceso remoto',
    definicion: 'Herramienta de acceso remoto entre computadores.',
  }),
  ficha({
    id: 'sicof',
    tipo: 'herramienta',
    titulo: 'SICOF ERP',
    categoria: 'Administración',
    proveedor: 'ADA',
    definicion: 'Sistema ERP administrativo y financiero.',
    notas: 'No confundir con ICG Manager ni con FrontRest, que pertenecen al entorno de los POS.',
  }),
  ficha({
    id: 'ssms',
    tipo: 'herramienta',
    titulo: 'SQL Server Management Studio',
    abreviatura: 'SSMS',
    categoria: 'Bases de datos',
    proveedor: 'Microsoft',
    definicion: 'Herramienta gráfica para administrar Microsoft SQL Server.',
  }),
  ficha({
    id: 'dhcp',
    tipo: 'termino',
    titulo: 'DHCP',
    alias: ['asignación automática de IP'],
    categoria: 'Redes',
    definicion: 'El servicio que reparte direcciones IP automáticamente a los equipos que se conectan.',
  }),
  ficha({
    id: 'router',
    tipo: 'termino',
    titulo: 'Router',
    alias: ['enrutador'],
    categoria: 'Redes',
    definicion: 'Equipo que une dos redes distintas y decide por dónde sale el tráfico.',
  }),
  ficha({
    id: 'ejecutar',
    tipo: 'atajo',
    titulo: 'Abrir la ventana Ejecutar',
    valor: 'Windows + R',
    plataforma: 'Windows',
    categoria: 'Windows',
    cuandoUsar: 'Abre la ventana Ejecutar, donde se escriben comandos cortos sin tener que abrir una consola.',
  }),
  ficha({
    id: 'mstsc',
    tipo: 'comando',
    titulo: 'Abrir Escritorio remoto',
    valor: 'mstsc',
    plataforma: 'Windows',
    categoria: 'Acceso remoto',
    cuandoUsar: 'Para conectarse al escritorio de otro equipo de la red.',
  }),
  ficha({
    id: 'ping',
    tipo: 'comando',
    titulo: 'Comprobar si un equipo responde',
    valor: 'ping [dirección]',
    plataforma: 'Windows, macOS y Linux',
    categoria: 'Redes',
    cuandoUsar: 'Para comprobar si hay camino de red hasta un equipo.',
  }),
]

describe('Centro de consulta en el buscador global', () => {
  const indiceConsulta = crearIndiceDesdeDocumentos(
    documentosDeBusqueda(
      datosIndice({
        referencias: FICHAS,
        articulos: [guia('a-router', 'Reiniciar el router de la sede', 'publicado', 'Revisar la red')],
      }),
    ),
  )

  // El primer resultado del grupo "Centro de consulta": es lo que el
  // técnico ve primero bajo ese rótulo.
  function primeroDelCentro(consulta: string) {
    return agruparResultados(buscar(indiceConsulta, consulta)).find((grupo) => grupo.id === 'referencia')?.items[0]
  }

  it.each([
    ['zabbix', 'referencia:zabbix', 'herramienta'],
    ['tightvnc', 'referencia:tightvnc', 'herramienta'],
    ['ada', 'referencia:sicof', 'herramienta'],
    ['sicof', 'referencia:sicof', 'herramienta'],
    ['windows r', 'referencia:ejecutar', 'atajo'],
    ['ping', 'referencia:ping', 'comando'],
    ['dhcp', 'referencia:dhcp', 'termino'],
    ['ssms', 'referencia:ssms', 'herramienta'],
  ])('"%s" encuentra primero %s, como %s', (consulta, id, tipo) => {
    const resultado = primeroDelCentro(consulta)
    expect(resultado?.id).toBe(id)
    expect(resultado?.tipo).toBe(tipo)
  })

  it('el grupo se llama Centro de consulta y reúne los cuatro tipos', () => {
    const grupos = agruparResultados(buscar(indiceConsulta, 'windows'))
    const centro = grupos.find((grupo) => grupo.id === 'referencia')
    expect(centro?.nombre).toBe('Centro de consulta')
    expect(centro?.tipos).toEqual(['herramienta', 'termino', 'atajo', 'comando'])
  })

  it('cada resultado dice de qué tipo es', () => {
    expect(documentoDeReferencia(FICHAS[0])?.subtitulo).toBe('Herramienta · Monitoreo')
    // Sin repetir la plataforma cuando coincide con la categoría.
    expect(documentoDeReferencia(FICHAS[7])?.subtitulo).toBe('Atajo · Windows')
    expect(documentoDeReferencia(FICHAS[5])?.subtitulo).toBe('Término · Redes')
    expect(documentoDeReferencia(FICHAS[4])?.titulo).toBe('SQL Server Management Studio (SSMS)')
  })

  it('una letra suelta junto a otras palabras es una tecla, no un prefijo', () => {
    const ids = buscar(indiceConsulta, 'windows r').map((r) => r.id)
    expect(ids).not.toContain('referencia:router')
    expect(ids).not.toContain('articulo:a-router')
    // Sola, sigue funcionando como el comienzo de lo que se teclea.
    expect(buscar(indiceConsulta, 'r').map((r) => r.id)).toContain('referencia:router')
  })

  it('no indexa una ficha eliminada ni una de un tipo que esta versión no conoce', () => {
    expect(documentoDeReferencia(ficha({ id: 'x', tipo: 'herramienta', titulo: 'Vieja', eliminadoEn: '2026-01-01' }))).toBeNull()
    expect(documentoDeReferencia(ficha({ id: 'y', tipo: 'software' as never, titulo: 'Futura' }))).toBeNull()
  })
})

describe('lo que el buscador global nunca muestra', () => {
  it('un borrador o una guía obsoleta no aparecen como procedimiento oficial', () => {
    const documentos = documentosDeBusqueda(
      datosIndice({
        articulos: [
          guia('a1', 'Conectar de forma remota a un POS desde un computador', 'publicado'),
          guia('a2', 'Crear copia de seguridad de una base de datos en SQL Server', 'borrador'),
          guia('a3', 'Guía retirada', 'obsoleto'),
        ],
      }),
    )
    const ids = documentos.map((documento) => documento.id)
    expect(ids).toContain('articulo:a1')
    expect(ids).not.toContain('articulo:a2')
    expect(ids).not.toContain('articulo:a3')
  })

  it('tampoco sale el borrador a través de la herramienta que lo enlaza', () => {
    const indiceBorrador = crearIndiceDesdeDocumentos(
      documentosDeBusqueda(
        datosIndice({
          articulos: [guia('a2', 'Crear copia de seguridad de una base de datos en SQL Server', 'borrador')],
          referencias: [
            ficha({
              id: 'ssms',
              tipo: 'herramienta',
              titulo: 'SQL Server Management Studio',
              guiasRelacionadas: [{ id: 'a2', titulo: 'Crear copia de seguridad de una base de datos en SQL Server' }],
            }),
          ],
        }),
      ),
    )
    expect(buscar(indiceBorrador, 'copia de seguridad')).toEqual([])
  })

  it('nada de la bóveda entra con la bóveda cerrada, y abierta nunca entra el secreto', () => {
    const equipo = { id: 'd1', nombre: 'Switch de ejemplo', detalles: {}, eliminadoEn: null } as unknown as Dispositivo
    const credencial = {
      id: 'c1',
      titulo: 'Acceso de ejemplo al panel',
      categoria: 'Redes',
      datosCifrados: 'secreto-cifrado',
      archivo: null,
      eliminadoEn: null,
    } as unknown as Credencial
    const campo = {
      id: 'cp1',
      dispositivoId: 'd1',
      nombre: 'PIN del panel',
      valorCifrado: 'valor-cifrado',
      eliminadoEn: null,
    } as unknown as CampoProtegido
    const conBoveda = { dispositivos: [equipo], credenciales: [credencial], camposProtegidos: [campo] }

    const cerrada = documentosDeBusqueda(datosIndice({ ...conBoveda, bovedaDesbloqueada: false }))
    expect(cerrada.some((d) => d.tipo === 'credencial' || d.id.startsWith('campo:'))).toBe(false)

    const abierta = documentosDeBusqueda(datosIndice({ ...conBoveda, bovedaDesbloqueada: true }))
    expect(abierta.map((d) => d.id)).toEqual(expect.arrayContaining(['credencial:c1', 'campo:cp1']))
    const texto = JSON.stringify(abierta)
    expect(texto).not.toContain('secreto-cifrado')
    expect(texto).not.toContain('valor-cifrado')
  })
})
