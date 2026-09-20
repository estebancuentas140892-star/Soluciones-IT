import { describe, expect, it } from 'vitest'
import type {
  Articulo,
  CampoProtegido,
  Credencial,
  Diagnostico,
  Dispositivo,
  EstadoArticulo,
  Persona,
  Referencia,
  Ubicacion,
} from '../../lib/db'
import { agruparResultados } from './resultados'
import { hayQueSepararMejores, mejoresResultados } from './mejores'
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

const FICHA_HKA = ficha({
  id: 'hka',
  tipo: 'herramienta',
  titulo: 'HKA Factura',
  alias: ['HKA'],
  categoria: 'Facturación electrónica',
  definicion: 'Plataforma utilizada en procesos relacionados con facturación electrónica y secuenciales.',
  usoEnMetroparques: 'Forma parte del procedimiento documentado para resolución DIAN en el entorno POS.',
  notas: 'No confundir con SICOF ERP.',
  etiquetas: ['facturación electrónica', 'dian'],
})

describe('Centro de consulta en el buscador global', () => {
  const indiceConsulta = crearIndiceDesdeDocumentos(
    documentosDeBusqueda(
      datosIndice({
        referencias: [...FICHAS, FICHA_HKA],
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
    ['hka', 'referencia:hka', 'herramienta'],
    ['facturación electrónica', 'referencia:hka', 'herramienta'],
  ])('"%s" encuentra primero %s, como %s', (consulta, id, tipo) => {
    const resultado = primeroDelCentro(consulta)
    expect(resultado?.id).toBe(id)
    expect(resultado?.tipo).toBe(tipo)
  })

  it('cada ficha sale en el grupo Centro de consulta con su tipo al principio del subtítulo', () => {
    const etiquetas = { herramienta: 'Herramienta', termino: 'Término', atajo: 'Atajo', comando: 'Comando' }
    for (const referencia of [...FICHAS, FICHA_HKA]) {
      const grupos = agruparResultados(buscar(indiceConsulta, referencia.titulo))
      const centro = grupos.find((grupo) => grupo.id === 'referencia')
      const fila = centro?.items.find((item) => item.id === `referencia:${referencia.id}`)
      expect({ id: referencia.id, tipo: fila?.tipo }).toEqual({ id: referencia.id, tipo: referencia.tipo })
      expect(fila?.subtitulo.startsWith(etiquetas[referencia.tipo as keyof typeof etiquetas])).toBe(true)
      // Y en ningún otro grupo.
      for (const otro of grupos.filter((grupo) => grupo.id !== 'referencia')) {
        expect(otro.items.some((item) => item.id === `referencia:${referencia.id}`)).toBe(false)
      }
    }
  })

  // LO ESCRITO MANDA SOBRE EL SINÓNIMO (2026-09-15). Los sinónimos amplían
  // lo que se encuentra, pero una coincidencia con lo que el técnico
  // tecleó va siempre por delante de una que solo trae un sinónimo, y un
  // sinónimo no puede meter resultados que nada tienen que ver.
  describe('prioridad y contaminación de los sinónimos', () => {
    function equipo(id: string, nombre: string): Dispositivo {
      return {
        id,
        nombre,
        marca: '',
        modelo: '',
        serial: '',
        placaInventario: '',
        ubicacion: '',
        responsable: '',
        ip: '',
        estado: 'Operativo',
        observaciones: '',
        detalles: {},
        foto: null,
        eliminadoEn: null,
      } as unknown as Dispositivo
    }

    const indiceRanking = crearIndiceDesdeDocumentos(
      documentosDeBusqueda(
        datosIndice({
          referencias: [FICHA_HKA],
          articulos: [
            guia('a-backup', 'Backup del servidor de archivos', 'publicado'),
            guia('a-copia', 'Crear copia de seguridad de la base de datos', 'publicado'),
            guia('a-factura', 'Anular una factura en el POS', 'publicado'),
          ],
          dispositivos: [equipo('d-hka', 'Servidor HKA de pruebas')],
        }),
      ),
    )
    const ids = (consulta: string) => buscar(indiceRanking, consulta).map((resultado) => resultado.id)

    it('una coincidencia exacta va antes que una provocada solo por un sinónimo', () => {
      const resultados = ids('backup')
      expect(resultados[0]).toBe('articulo:a-backup')
      // El sinónimo sigue sumando resultados, detrás.
      expect(resultados).toContain('articulo:a-copia')
    })

    it('"hka" prioriza HKA y no arrastra lo que solo habla de facturas', () => {
      const resultados = ids('hka')
      expect(resultados[0]).toBe('referencia:hka')
      expect(resultados).not.toContain('articulo:a-factura')
    })

    it('"factura" sola no mete por sinónimo lo que solo nombra a HKA', () => {
      const resultados = ids('factura')
      expect(resultados).toContain('articulo:a-factura')
      expect(resultados).not.toContain('dispositivo:d-hka')
    })

    it('"facturación electrónica" conduce a HKA', () => {
      expect(ids('facturación electrónica')[0]).toBe('referencia:hka')
    })

    it('las sugerencias anti duplicados también ponen primero el título exacto', () => {
      const similares = buscarSimilares(indiceRanking, 'Backup nocturno', 'nuevo-id', ['articulo'])
      expect(similares.map((resultado) => resultado.id)).toContain('articulo:a-copia')
      expect(similares[0]?.id).toBe('articulo:a-backup')
    })
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

// Las fuentes que el buscador global reúne, cada una en su grupo, pasando
// por `documentosDeBusqueda` como en la app (2026-09-15).
describe('lo que el buscador global reúne', () => {
  const marca = { updatedAt: '2026-09-15T00:00:00.000Z', updatedBy: null, eliminadoEn: null }
  const ubicacion: Ubicacion = { id: 'u1', nombre: 'Sala Zafiro', padreId: null, notas: '', ...marca }
  const persona: Persona = { id: 'p1', nombre: 'Zafiro Gómez', notas: '', ...marca }
  const diagnostico: Diagnostico = {
    id: 'g1',
    categoriaId: 'cat-1',
    titulo: 'El equipo Zafiro no enciende',
    descripcion: '',
    nodos: [],
    ...marca,
  }
  const datos = datosIndice({
    articulos: [guia('a1', 'Reiniciar el servidor Zafiro', 'publicado'), guia('a2', 'Zafiro sin publicar', 'borrador')],
    dispositivos: [{ id: 'd1', nombre: 'Servidor Zafiro', detalles: {}, eliminadoEn: null } as unknown as Dispositivo],
    diagnosticos: [diagnostico],
    ubicaciones: [ubicacion],
    personas: [persona],
    referencias: [ficha({ id: 'r1', tipo: 'herramienta', titulo: 'Consola Zafiro' })],
    credenciales: [
      { id: 'c1', titulo: 'Acceso al panel Zafiro', categoria: 'Redes', archivo: null, eliminadoEn: null } as unknown as Credencial,
    ],
    camposProtegidos: [
      { id: 'cp1', dispositivoId: 'd1', nombre: 'PIN del Zafiro', eliminadoEn: null } as unknown as CampoProtegido,
    ],
  })

  // Qué resultados caen en cada grupo, tal como los pinta el buscador.
  function porGrupo(bovedaDesbloqueada: boolean) {
    const indiceFuentes = crearIndiceDesdeDocumentos(documentosDeBusqueda({ ...datos, bovedaDesbloqueada }))
    return Object.fromEntries(
      agruparResultados(buscar(indiceFuentes, 'zafiro')).map((grupo) => [grupo.id, grupo.items.map((item) => item.id).sort()]),
    )
  }

  it('guías publicadas y diagnósticos, equipos, ubicaciones, personas y Centro de consulta, cada uno en su grupo', () => {
    expect(porGrupo(false)).toEqual({
      soluciones: ['articulo:a1', 'diagnostico:g1'],
      dispositivos: ['dispositivo:d1'],
      ubicaciones: ['ubicacion:u1'],
      personas: ['persona:p1'],
      referencia: ['referencia:r1'],
    })
  })

  it('la bóveda y los datos protegidos de un equipo solo se suman con la bóveda abierta', () => {
    expect(porGrupo(true)).toEqual({
      soluciones: ['articulo:a1', 'diagnostico:g1'],
      dispositivos: ['campo:cp1', 'dispositivo:d1'],
      boveda: ['credencial:c1'],
      ubicaciones: ['ubicacion:u1'],
      personas: ['persona:p1'],
      referencia: ['referencia:r1'],
    })
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

// ----------------------------------------------------------------
// Resolver desde la búsqueda (encargo del 2026-09-15, tarea 241)
// ----------------------------------------------------------------

describe('mejores resultados sobre el índice real', () => {
  const equipoCaja = {
    id: 'd-caja',
    nombre: 'Impresora caja 4',
    marca: 'Epson',
    modelo: 'TM-T88',
    ubicacion: 'Caja 4',
    detalles: {},
    eliminadoEn: null,
  } as unknown as Dispositivo
  const indiceMixto = crearIndiceDesdeDocumentos(
    documentosDeBusqueda(
      datosIndice({
        articulos: [
          guia('a1', 'Cambiar el rodillo de una impresora', 'publicado'),
          guia('a2', 'Crear cliente externo en ICG Manager', 'publicado'),
        ],
        dispositivos: [equipoCaja],
      }),
    ),
  )

  it('el equipo exacto encabeza aunque las guías fueran primero por grupo', () => {
    const resultados = buscar(indiceMixto, 'impresora caja 4')
    const mejores = mejoresResultados(resultados, 'impresora caja 4')
    expect(mejores[0].id).toBe('dispositivo:d-caja')
    // El agrupado de siempre sigue poniendo Guías delante: por eso hacía
    // falta una lectura distinta arriba.
    expect(agruparResultados(resultados)[0].id).toBe('soluciones')
  })

  it('"crear cliente externo" lleva directo a la guía', () => {
    const consulta = 'crear cliente externo'
    expect(mejoresResultados(buscar(indiceMixto, consulta), consulta)[0].id).toBe('articulo:a2')
  })

  it('lo que sube arriba no se repite abajo y los grupos siguen completos', () => {
    const resultados = buscar(indiceMixto, 'impresora')
    const mejores = mejoresResultados(resultados, 'impresora')
    const restantes = resultados.filter((r) => !mejores.some((m) => m.id === r.id))
    expect(mejores.length + restantes.length).toBe(resultados.length)
    expect(new Set(resultados.map((r) => r.id)).size).toBe(resultados.length)
  })
})

describe('el sinónimo se marca y nunca adelanta a lo escrito', () => {
  const indiceSinonimo = crearIndiceDesdeDocumentos(
    documentosDeBusqueda(
      datosIndice({
        articulos: [
          guia('a-backup', 'Backup del servidor de archivos', 'publicado'),
          guia('a-copia', 'Crear copia de seguridad del SQL Server', 'publicado'),
        ],
      }),
    ),
  )

  it('"backup" pone primero lo que dice backup, y marca lo que llegó por sinónimo', () => {
    const resultados = buscar(indiceSinonimo, 'backup')
    expect(resultados[0].id).toBe('articulo:a-backup')
    expect(resultados[0].soloSinonimo).toBe(false)
    const porSinonimo = resultados.find((r) => r.id === 'articulo:a-copia')
    expect(porSinonimo?.soloSinonimo).toBe(true)
  })

  it('y "Mejores resultados" respeta ese orden aunque el otro puntúe mejor por título', () => {
    const consulta = 'backup'
    expect(mejoresResultados(buscar(indiceSinonimo, consulta), consulta)[0].id).toBe('articulo:a-backup')
  })
})

describe('con la bóveda bloqueada, ninguna credencial llega al técnico', () => {
  const credencial = {
    id: 'c-pos',
    titulo: 'Administrador POS',
    categoria: 'Punto de venta',
    datosCifrados: 'bloque-cifrado',
    archivo: null,
    eliminadoEn: null,
  } as unknown as Credencial
  const conCredencial = {
    articulos: [guia('a1', 'Configurar el POS de la taquilla', 'publicado')],
    credenciales: [credencial],
  }

  function resultadosCon(bovedaDesbloqueada: boolean) {
    const indice = crearIndiceDesdeDocumentos(
      documentosDeBusqueda(datosIndice({ ...conCredencial, bovedaDesbloqueada })),
    )
    return buscar(indice, 'administrador POS')
  }

  it('ni en los resultados, ni en los grupos, ni en "Mejores resultados"', () => {
    const resultados = resultadosCon(false)
    const mejores = mejoresResultados(resultados, 'administrador POS')
    for (const lista of [resultados, mejores]) {
      expect(lista.some((r) => r.tipo === 'credencial')).toBe(false)
      expect(JSON.stringify(lista)).not.toContain('Administrador POS')
    }
    expect(agruparResultados(resultados).some((grupo) => grupo.id === 'boveda')).toBe(false)
  })

  it('al desbloquear, la MISMA consulta ya la encuentra y la pone primero', () => {
    // Es lo que hace que el puente no necesite guardar la consulta en
    // ningún sitio: se desbloquea y la búsqueda escrita vuelve a correr.
    const resultados = resultadosCon(true)
    const mejores = mejoresResultados(resultados, 'administrador POS')
    expect(mejores[0].id).toBe('credencial:c-pos')
    expect(hayQueSepararMejores(resultados, mejores)).toBe(true)
  })

  it('ni desbloqueada entra el bloque cifrado en lo que se pinta', () => {
    expect(JSON.stringify(resultadosCon(true))).not.toContain('bloque-cifrado')
  })
})

// ----------------------------------------------------------------
// LA GUÍA DE LA RESOLUCIÓN DIAN (encargo del 2026-09-20, tarea 3)
// ----------------------------------------------------------------
//
// Regresión que se cierra: esa guía existía, con nueve pasos y sin
// eliminar, pero en `borrador`. El índice solo lleva lo publicado (así
// debe seguir), y como buscar "DIAN" SÍ encontraba la ficha de HKA
// Factura, la pantalla nunca decía que hubiera un borrador y la guía
// parecía no existir.
//
// Aquí se prueban las dos mitades de la garantía: publicada, se
// encuentra como guía; en borrador, no entra en el índice oficial.

const TITULO_DIAN = 'Actualizar la resolución DIAN para facturación electrónica en un POS'
const ID_DIAN = 'a1ac8d0a-72e7-4dd1-a377-afd2a2ca1cc0'

describe('la guía de la resolución DIAN en el buscador', () => {
  function indiceCon(estado: EstadoArticulo) {
    return crearIndiceDesdeDocumentos(
      documentosDeBusqueda(
        datosIndice({
          referencias: [FICHA_HKA],
          articulos: [guia(ID_DIAN, TITULO_DIAN, estado, 'Resolución, prefijo y rango del POS')],
          categorias: [
            { id: 'cat-1', nombre: 'POS', eliminadoEn: null } as unknown as DatosIndice['categorias'][number],
          ],
        }),
      ),
    )
  }

  const publicada = indiceCon('publicado')
  const enBorrador = indiceCon('borrador')

  it.each(['DIAN', 'resolución DIAN', 'resolucion dian', 'facturación electrónica', 'facturacion electronica', 'dian'])(
    'publicada, "%s" la encuentra',
    (consulta) => {
      expect(buscar(publicada, consulta).map((r) => r.id)).toContain(`articulo:${ID_DIAN}`)
    },
  )

  it('aparece como guía, no como ficha del Centro de consulta', () => {
    const encontrada = buscar(publicada, 'DIAN').find((r) => r.id === `articulo:${ID_DIAN}`)
    expect(encontrada?.tipo).toBe('articulo')
    expect(encontrada?.ruta).toBe(`/soluciones/cat-1/${ID_DIAN}`)
  })

  it('la ficha de HKA Factura puede seguir apareciendo: no compiten', () => {
    const ids = buscar(publicada, 'DIAN').map((r) => r.id)
    expect(ids).toContain('referencia:hka')
    expect(ids).toContain(`articulo:${ID_DIAN}`)
  })

  it('en borrador NO entra en el índice oficial, ni por DIAN ni por su título entero', () => {
    for (const consulta of ['DIAN', TITULO_DIAN, 'facturación electrónica']) {
      expect(buscar(enBorrador, consulta).map((r) => r.id)).not.toContain(`articulo:${ID_DIAN}`)
    }
    // Y lo que sí es oficial se sigue encontrando: el borrador no tapa nada.
    expect(buscar(enBorrador, 'DIAN').map((r) => r.id)).toContain('referencia:hka')
  })

  it('un artículo obsoleto tampoco entra en el índice', () => {
    expect(buscar(indiceCon('obsoleto'), 'DIAN').map((r) => r.id)).not.toContain(`articulo:${ID_DIAN}`)
  })

  it('publicarla la mete en el índice sin tocar nada más', () => {
    // Es lo que hace que baste con publicar desde el editor: el índice
    // se construye a partir de las mismas tablas, así que el cambio de
    // estado es todo lo que separa "no existe" de "resultado oficial".
    const antes = documentosDeBusqueda(
      datosIndice({ articulos: [guia(ID_DIAN, TITULO_DIAN, 'borrador')] }),
    ).map((d) => d.id)
    const despues = documentosDeBusqueda(
      datosIndice({ articulos: [guia(ID_DIAN, TITULO_DIAN, 'publicado')] }),
    ).map((d) => d.id)
    expect(antes).not.toContain(`articulo:${ID_DIAN}`)
    expect(despues).toContain(`articulo:${ID_DIAN}`)
  })

  it('eliminada no aparece aunque esté publicada', () => {
    const borrada = { ...guia(ID_DIAN, TITULO_DIAN, 'publicado'), eliminadoEn: '2026-09-19T00:00:00.000Z' }
    const documentos = documentosDeBusqueda(datosIndice({ articulos: [borrada] })).map((d) => d.id)
    expect(documentos).not.toContain(`articulo:${ID_DIAN}`)
  })
})
