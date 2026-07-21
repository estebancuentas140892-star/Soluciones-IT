import { describe, expect, it } from 'vitest'
import type {
  Articulo,
  CampoProtegido,
  Conexion,
  Credencial,
  Diagnostico,
  Dispositivo,
  PasoProcedimiento,
  Procedimiento,
} from './db'
import {
  construirGrafo,
  origenesDistintos,
  referenciasHacia,
  resumenImpacto,
  type DatosGrafo,
} from './grafo'

function articulo(cambios: Partial<Articulo> & { id: string; titulo: string }): Articulo {
  return {
    categoriaId: 'cat-1',
    tipo: 'instalacion',
    contenido: '',
    etiquetas: [],
    procedimiento: null,
    sintomas: [],
    causas: [],
    dispositivosAfectados: [],
    esRutaInicio: false,
    ordenRutaInicio: 0,
    estado: 'publicado',
    version: '1.0',
    relacionados: [],
    updatedAt: '',
    updatedBy: null,
    eliminadoEn: null,
    ...cambios,
  }
}

function paso(cambios: Partial<PasoProcedimiento>): PasoProcedimiento {
  return {
    id: cambios.id ?? crypto.randomUUID(),
    titulo: 'Paso',
    objetivo: '',
    bloques: [],
    adjuntos: [],
    vinculoProtegido: null,
    subArticuloId: null,
    subArticuloTitulo: '',
    solucionArticuloId: null,
    solucionArticuloTitulo: '',
    ...cambios,
  }
}

function procedimiento(pasos: PasoProcedimiento[]): Procedimiento {
  return {
    descripcion: '',
    portada: null,
    objetivoGeneral: '',
    requisitos: [],
    pasos,
    verificacionFinal: [],
    tiempoEstimadoMin: null,
    dificultad: null,
  }
}

function dispositivo(cambios: Partial<Dispositivo> & { id: string; nombre: string }): Dispositivo {
  return {
    categoriaId: 'cat-red',
    marca: '',
    modelo: '',
    serial: '',
    placaInventario: '',
    ubicacion: '',
    ubicacionId: null,
    ip: '',
    estado: '',
    observaciones: '',
    detalles: {},
    foto: null,
    updatedAt: '',
    updatedBy: null,
    eliminadoEn: null,
    ...cambios,
  }
}

function credencial(cambios: Partial<Credencial> & { id: string; titulo: string }): Credencial {
  return {
    categoria: '',
    tipo: 'cuenta',
    datosCifrados: '',
    venceEn: null,
    dispositivos: [],
    archivo: null,
    updatedAt: '',
    updatedBy: null,
    eliminadoEn: null,
    ...cambios,
  }
}

function diagnostico(cambios: Partial<Diagnostico> & { id: string; titulo: string }): Diagnostico {
  return {
    categoriaId: 'cat-1',
    descripcion: '',
    nodos: [],
    updatedAt: '',
    updatedBy: null,
    eliminadoEn: null,
    ...cambios,
  }
}

function campoProtegido(cambios: Partial<CampoProtegido> & { id: string; nombre: string }): CampoProtegido {
  return {
    dispositivoId: null,
    tipo: 'texto',
    valorCifrado: '',
    orden: 0,
    updatedAt: '',
    updatedBy: null,
    eliminadoEn: null,
    ...cambios,
  }
}

function conexion(cambios: Partial<Conexion> & { id: string }): Conexion {
  return {
    tipo: 'enlace',
    origenId: 'a',
    origenNombre: 'A',
    origenPuerto: '',
    destinoId: 'b',
    destinoNombre: 'B',
    destinoPuerto: '',
    medio: '',
    notas: '',
    updatedAt: '',
    updatedBy: null,
    eliminadoEn: null,
    ...cambios,
  }
}

function datos(parcial: Partial<DatosGrafo>): DatosGrafo {
  return {
    articulos: [],
    dispositivos: [],
    credenciales: [],
    diagnosticos: [],
    conexiones: [],
    camposProtegidos: [],
    ...parcial,
  }
}

describe('construirGrafo', () => {
  it('crea aristas de subprocedimiento, solución, credencial y decisión desde los pasos', () => {
    const proc = procedimiento([
      paso({
        subArticuloId: 'sub-1',
        subArticuloTitulo: 'Subproc',
        vinculoProtegido: { tipo: 'credencial', id: 'cred-1', titulo: 'Router' },
        bloques: [
          {
            id: 'bloque-1',
            tipo: 'tarea',
            texto: 'Ingresar clave',
            tono: null,
            adjunto: null,
            tipoTarea: 'decision',
            decisionArticuloId: 'dec-1',
            decisionArticuloTitulo: 'Solución',
            vinculoProtegido: { tipo: 'credencial', id: 'cred-2', titulo: 'Switch' },
          },
        ],
      }),
      paso({ solucionArticuloId: 'sol-1', solucionArticuloTitulo: 'Reparar' }),
    ])
    const grafo = construirGrafo(
      datos({ articulos: [articulo({ id: 'art-1', titulo: 'Principal', procedimiento: proc })] }),
    )

    const relaciones = grafo.map((a) => [a.relacion, a.destinoTipo, a.destinoId])
    expect(relaciones).toContainEqual(['subprocedimiento', 'articulo', 'sub-1'])
    expect(relaciones).toContainEqual(['solucion', 'articulo', 'sol-1'])
    expect(relaciones).toContainEqual(['decision', 'articulo', 'dec-1'])
    expect(relaciones).toContainEqual(['credencial_paso', 'credencial', 'cred-1'])
    expect(relaciones).toContainEqual(['credencial_tarea', 'credencial', 'cred-2'])
    // El origen lleva el título vivo del artículo, no una copia.
    expect(grafo[0].origen.titulo).toBe('Principal')
    expect(grafo[0].origen.ruta).toBe('/soluciones/cat-1/art-1')
  })

  it('crea aristas de campo protegido (tipo "campo") desde un paso y desde una tarea', () => {
    const proc = procedimiento([
      paso({
        vinculoProtegido: { tipo: 'campo', id: 'cp-1', titulo: 'Contraseña administrador' },
        bloques: [
          {
            id: 'bloque-1',
            tipo: 'tarea',
            texto: 'Ingresar el PIN',
            tono: null,
            adjunto: null,
            tipoTarea: 'accion',
            decisionArticuloId: null,
            decisionArticuloTitulo: '',
            vinculoProtegido: { tipo: 'campo', id: 'cp-2', titulo: 'PIN de impresión' },
          },
        ],
      }),
    ])
    const grafo = construirGrafo(
      datos({ articulos: [articulo({ id: 'art-1', titulo: 'Conectar impresora', procedimiento: proc })] }),
    )
    const relaciones = grafo.map((a) => [a.relacion, a.destinoTipo, a.destinoId])
    expect(relaciones).toContainEqual(['campo_paso', 'campo_protegido', 'cp-1'])
    expect(relaciones).toContainEqual(['campo_tarea', 'campo_protegido', 'cp-2'])
  })

  it('crea aristas de relacionado y dispositivo afectado', () => {
    const grafo = construirGrafo(
      datos({
        articulos: [
          articulo({
            id: 'art-1',
            titulo: 'Incidencia',
            tipo: 'problema_frecuente',
            relacionados: [{ id: 'art-2', titulo: 'Otro' }],
            dispositivosAfectados: [{ id: 'disp-1', nombre: 'Impresora' }],
          }),
        ],
      }),
    )
    expect(grafo.map((a) => [a.relacion, a.destinoId])).toContainEqual(['relacionado', 'art-2'])
    expect(grafo.map((a) => [a.relacion, a.destinoId])).toContainEqual(['dispositivo_afectado', 'disp-1'])
  })

  it('crea aristas desde las opciones de un diagnóstico que ejecutan un artículo', () => {
    const grafo = construirGrafo(
      datos({
        diagnosticos: [
          diagnostico({
            id: 'diag-1',
            titulo: 'La impresora no imprime',
            nodos: [
              {
                id: 'n1',
                tituloInterno: '',
                pregunta: '¿Enciende?',
                descripcion: '',
                opciones: [
                  { id: 'o1', etiqueta: 'Sí', siguienteNodoId: null, articuloId: 'art-9', articuloTitulo: 'Reparar', mensajeFinal: '' },
                  { id: 'o2', etiqueta: 'No', siguienteNodoId: null, articuloId: null, articuloTitulo: '', mensajeFinal: 'Fin' },
                ],
              },
            ],
          }),
        ],
      }),
    )
    const arista = grafo.find((a) => a.relacion === 'diagnostico_articulo')
    expect(arista?.destinoId).toBe('art-9')
    expect(arista?.origen.titulo).toBe('La impresora no imprime')
    expect(arista?.origen.ruta).toBe('/diagnostico/diag-1')
  })

  it('crea una arista por cada extremo de una conexión, con el nombre vivo del dispositivo', () => {
    const grafo = construirGrafo(
      datos({
        dispositivos: [dispositivo({ id: 'sw', nombre: 'Switch renombrado' })],
        // La conexión guarda el nombre viejo como copia de referencia.
        conexiones: [conexion({ id: 'c1', origenId: 'sw', origenNombre: 'Switch viejo', destinoId: 'ap', destinoNombre: 'AP-01' })],
      }),
    )
    const desdeSwitch = grafo.find((a) => a.relacion === 'conexion' && a.origen.id === 'sw')
    // El grafo resuelve el nombre vivo, no la copia congelada.
    expect(desdeSwitch?.origen.titulo).toBe('Switch renombrado')
    expect(desdeSwitch?.destinoId).toBe('ap')
  })

  it('crea una arista de campo protegido a su dispositivo dueño, con el título del propio campo', () => {
    const grafo = construirGrafo(
      datos({
        camposProtegidos: [campoProtegido({ id: 'cp-1', nombre: 'Contraseña administrador', dispositivoId: 'd1' })],
      }),
    )
    const arista = grafo.find((a) => a.relacion === 'campo_dispositivo')
    expect(arista?.origen).toEqual({
      tipo: 'campo_protegido',
      id: 'cp-1',
      titulo: 'Contraseña administrador',
      ruta: '/dispositivos/d1',
    })
    expect(arista?.destinoTipo).toBe('dispositivo')
    expect(arista?.destinoId).toBe('d1')
  })

  it('un campo protegido sin dispositivo o eliminado no genera arista de pertenencia', () => {
    const grafo = construirGrafo(
      datos({
        camposProtegidos: [
          campoProtegido({ id: 'cp-1', nombre: 'Sin equipo', dispositivoId: null }),
          campoProtegido({ id: 'cp-2', nombre: 'Borrado', dispositivoId: 'd1', eliminadoEn: '2026-01-01' }),
        ],
      }),
    )
    expect(grafo.some((a) => a.relacion === 'campo_dispositivo')).toBe(false)
  })

  it('ignora entidades eliminadas', () => {
    const proc = procedimiento([paso({ subArticuloId: 'sub-1', subArticuloTitulo: 'X' })])
    const grafo = construirGrafo(
      datos({
        articulos: [articulo({ id: 'art-1', titulo: 'Eliminado', procedimiento: proc, eliminadoEn: '2026-01-01' })],
      }),
    )
    expect(grafo).toHaveLength(0)
  })
})

describe('referenciasHacia', () => {
  const proc = procedimiento([paso({ vinculoProtegido: { tipo: 'credencial', id: 'cred-1', titulo: 'Router' } })])
  const grafo = construirGrafo(
    datos({
      articulos: [
        articulo({ id: 'art-1', titulo: 'Usa la credencial', procedimiento: proc }),
        articulo({ id: 'art-2', titulo: 'No la usa' }),
      ],
      credenciales: [credencial({ id: 'cred-1', titulo: 'Router' })],
    }),
  )

  it('encuentra quién referencia a una credencial', () => {
    const refs = referenciasHacia(grafo, 'credencial', 'cred-1')
    expect(refs).toHaveLength(1)
    expect(refs[0].origen.id).toBe('art-1')
  })

  it('filtra por tipos de relación cuando se piden', () => {
    const refs = referenciasHacia(grafo, 'credencial', 'cred-1', ['credencial_tarea'])
    expect(refs).toHaveLength(0)
  })

  it('no cuenta una entidad como referencia de sí misma', () => {
    const grafoAuto = construirGrafo(
      datos({
        articulos: [articulo({ id: 'art-1', titulo: 'Auto', relacionados: [{ id: 'art-1', titulo: 'Auto' }] })],
      }),
    )
    expect(referenciasHacia(grafoAuto, 'articulo', 'art-1')).toHaveLength(0)
  })
})

describe('origenesDistintos', () => {
  it('colapsa un origen que referencia varias veces al mismo destino', () => {
    const proc = procedimiento([
      paso({ vinculoProtegido: { tipo: 'credencial', id: 'cred-1', titulo: 'Router' } }),
      paso({ vinculoProtegido: { tipo: 'credencial', id: 'cred-1', titulo: 'Router' } }),
    ])
    const grafo = construirGrafo(
      datos({ articulos: [articulo({ id: 'art-1', titulo: 'Doble uso', procedimiento: proc })] }),
    )
    const refs = referenciasHacia(grafo, 'credencial', 'cred-1')
    expect(refs.length).toBe(2)
    expect(origenesDistintos(refs)).toHaveLength(1)
  })
})

describe('resumenImpacto', () => {
  it('resume en una frase quién usa una credencial', () => {
    const proc = procedimiento([paso({ vinculoProtegido: { tipo: 'credencial', id: 'cred-1', titulo: 'Router' } })])
    const grafo = construirGrafo(
      datos({ articulos: [articulo({ id: 'art-1', titulo: 'P', procedimiento: proc })] }),
    )
    expect(resumenImpacto(grafo, 'credencial', 'cred-1')).toBe('Se usa en 1 procedimiento.')
  })

  it('resume en una frase quién usa un campo protegido', () => {
    const proc = procedimiento([paso({ vinculoProtegido: { tipo: 'campo', id: 'cp-1', titulo: 'PIN' } })])
    const grafo = construirGrafo(
      datos({ articulos: [articulo({ id: 'art-1', titulo: 'P', procedimiento: proc })] }),
    )
    expect(resumenImpacto(grafo, 'campo_protegido', 'cp-1')).toBe('Se usa en 1 procedimiento.')
  })

  it('avisa antes de eliminar un dispositivo con campos protegidos (cierra el hueco de huérfanos de P1)', () => {
    const grafo = construirGrafo(
      datos({
        camposProtegidos: [
          campoProtegido({ id: 'cp-1', nombre: 'Usuario', dispositivoId: 'd1' }),
          campoProtegido({ id: 'cp-2', nombre: 'Contraseña', dispositivoId: 'd1' }),
        ],
      }),
    )
    expect(resumenImpacto(grafo, 'dispositivo', 'd1')).toBe('Se usa en 2 datos protegidos.')
  })

  it('combina categorías con "y"', () => {
    const proc = procedimiento([paso({ subArticuloId: 'art-hijo', subArticuloTitulo: 'Hijo' })])
    const grafo = construirGrafo(
      datos({
        articulos: [
          articulo({ id: 'art-padre', titulo: 'Padre', procedimiento: proc }),
          articulo({ id: 'art-hijo', titulo: 'Hijo' }),
        ],
        diagnosticos: [
          diagnostico({
            id: 'd1',
            titulo: 'Diag',
            nodos: [
              {
                id: 'n1',
                tituloInterno: '',
                pregunta: '?',
                descripcion: '',
                opciones: [{ id: 'o1', etiqueta: 'Sí', siguienteNodoId: null, articuloId: 'art-hijo', articuloTitulo: 'Hijo', mensajeFinal: '' }],
              },
            ],
          }),
        ],
      }),
    )
    expect(resumenImpacto(grafo, 'articulo', 'art-hijo')).toBe('Se usa en 1 procedimiento y 1 diagnóstico.')
  })

  it('devuelve null cuando nada la referencia', () => {
    const grafo = construirGrafo(datos({ credenciales: [credencial({ id: 'cred-1', titulo: 'Sola' })] }))
    expect(resumenImpacto(grafo, 'credencial', 'cred-1')).toBeNull()
  })
})
