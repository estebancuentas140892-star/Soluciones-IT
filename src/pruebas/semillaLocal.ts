import type { Session } from '@supabase/supabase-js'
import { db, type Articulo, type BloquePaso, type Categoria, type PasoProcedimiento } from '../lib/db'

/** Identidad ficticia del banco de pruebas. */
export const PERFIL_PRUEBA = {
  id: '00000000-0000-4000-8000-000000000001',
  nombre: 'Tecnico de prueba',
  correo: 'prueba@local',
  puedeVerBoveda: true,
}

// Sesion ficticia: no lleva token de nada, solo hace que `RequireAuth`
// deje pasar para poder mirar la interfaz sin credenciales del servidor.
export const SESION_PRUEBA = {
  access_token: 'prueba-local',
  refresh_token: 'prueba-local',
  expires_in: 0,
  token_type: 'bearer',
  user: { id: PERFIL_PRUEBA.id, email: PERFIL_PRUEBA.correo },
} as unknown as Session

// BANCO DE PRUEBAS LOCAL (solo desarrollo, ver src/lib/modoPruebaLocal.ts).
//
// Todo lo que hay aqui esta INVENTADO para ejercitar la interfaz: no es
// contenido real del equipo, no lleva contrasenas, direcciones, tarifas
// ni instrucciones tecnicas de verdad, y no sale nunca del navegador.
// Reproduce la FORMA de los casos reportados (un paso con tres tareas y
// un solo aviso, un paso que depende de otra guia, categorias
// suficientes para que la fila de chips no quepa en 360 px) para poder
// comprobar el comportamiento sin credenciales del servidor.
//
// Este modulo solo se importa de forma DINAMICA y bajo `import.meta.env.DEV`,
// asi que no entra en el paquete de produccion.

const AHORA = '2026-09-09T12:00:00.000Z'

function categoria(id: string, nombre: string, orden: number): Categoria {
  return {
    id,
    nombre,
    icono: '',
    orden,
    esRed: false,
    color: null,
    updatedAt: AHORA,
    updatedBy: PERFIL_PRUEBA.id,
    eliminadoEn: null,
  }
}

const CATEGORIAS: Categoria[] = [
  categoria('cat-pos', 'POS', 1),
  categoria('cat-software', 'Software', 2),
  categoria('cat-impresoras', 'Impresoras', 3),
  categoria('cat-redes', 'Redes', 4),
  categoria('cat-camaras', 'Camaras', 5),
  categoria('cat-telefonia', 'Telefonia', 6),
  categoria('cat-accesos', 'Control de acceso', 7),
  categoria('cat-servidores', 'Servidores', 8),
]

function tarea(id: string, texto: string, tipoTarea: 'accion' | 'verificacion' | 'decision' = 'accion'): BloquePaso {
  return {
    id,
    tipo: 'tarea',
    texto,
    tono: null,
    adjunto: null,
    tipoTarea,
    decisionArticuloId: null,
    decisionArticuloTitulo: '',
    vinculoProtegido: null,
    alcance: null,
    tareaId: null,
    guiaArticuloId: null,
    guiaArticuloTitulo: '',
    intencionGuia: null,
  }
}

function aviso(id: string, texto: string): BloquePaso {
  return {
    id,
    tipo: 'aviso',
    texto,
    tono: 'precaucion',
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
  }
}

// Apoyos CON alcance declarado, para comprobar el comportamiento nuevo
// (los helpers de arriba los dejan sin declarar a proposito, que es el
// caso heredado).
function avisoDeTarea(id: string, tareaId: string, texto: string): BloquePaso {
  return { ...aviso(id, texto), alcance: 'tarea', tareaId }
}

function imagenDeTarea(id: string, tareaId: string, pie: string): BloquePaso {
  return {
    ...aviso(id, pie),
    tipo: 'imagen',
    tono: null,
    adjunto: { referencia: 'pruebas/1700000001-captura-de-ejemplo.png', nombre: 'captura-de-ejemplo.png', tipo: 'image/png' },
    alcance: 'tarea',
    tareaId,
  }
}

function archivoDeTarea(id: string, tareaId: string, proposito: string): BloquePaso {
  return {
    ...aviso(id, proposito),
    tipo: 'archivo',
    tono: null,
    adjunto: { referencia: 'pruebas/1700000002-planilla-de-ejemplo.pdf', nombre: 'planilla-de-ejemplo.pdf', tipo: 'application/pdf' },
    alcance: 'tarea',
    tareaId,
  }
}

function guiaDeTarea(
  id: string,
  tareaId: string,
  guiaArticuloId: string,
  guiaArticuloTitulo: string,
  intencionGuia: 'necesario' | 'consulta' | 'contingencia',
): BloquePaso {
  return {
    ...aviso(id, ''),
    tipo: 'guia',
    tono: null,
    guiaArticuloId,
    guiaArticuloTitulo,
    intencionGuia,
    alcance: 'tarea',
    tareaId,
  }
}

function paso(parcial: Partial<PasoProcedimiento> & { id: string }): PasoProcedimiento {
  return {
    titulo: '',
    objetivo: '',
    bloques: [],
    adjuntos: [],
    vinculoProtegido: null,
    subArticuloId: null,
    subArticuloTitulo: '',
    solucionArticuloId: null,
    solucionArticuloTitulo: '',
    ...parcial,
  }
}

function articulo(parcial: Partial<Articulo> & { id: string; categoriaId: string; titulo: string }): Articulo {
  return {
    tipo: 'configuracion',
    contenido: '',
    etiquetas: [],
    procedimiento: null,
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
    updatedBy: PERFIL_PRUEBA.id,
    eliminadoEn: null,
    ...parcial,
  }
}

// Guia auxiliar que otras vinculan (el papel que en produccion hace
// "acceder al gestor"): tiene pasos propios, asi que se ejecuta anidada.
const GUIA_VINCULADA = articulo({
  id: 'art-acceso-gestor',
  categoriaId: 'cat-software',
  titulo: 'Acceder al gestor de ejemplo',
  tipo: 'conexion',
  procedimiento: {
    descripcion: 'Guia de apoyo del banco de pruebas.',
    portada: null,
    objetivoGeneral: 'Dejar el gestor de ejemplo abierto.',
    requisitos: [],
    verificacionFinal: [],
    tiempoEstimadoMin: 3,
    dificultad: 'principiante',
    pasos: [
      paso({
        id: 'gestor-p1',
        titulo: 'Abrir el gestor de ejemplo',
        bloques: [tarea('gestor-p1-t1', 'Abrir el programa de ejemplo')],
      }),
      paso({
        id: 'gestor-p2',
        titulo: 'Entrar con el usuario de ejemplo',
        bloques: [
          tarea('gestor-p2-t1', 'Escribir el usuario de ejemplo'),
          tarea('gestor-p2-t2', 'Comprobar que aparece la pantalla principal', 'verificacion'),
        ],
      }),
    ],
  },
})

// Caso H05 / A09 / A10: el primer paso depende de la guia vinculada.
const GUIA_CON_VINCULO = articulo({
  id: 'art-alta-usuario',
  categoriaId: 'cat-software',
  titulo: 'Dar de alta un usuario de ejemplo',
  tipo: 'configuracion',
  procedimiento: {
    descripcion: 'Caso de prueba de guia vinculada.',
    portada: null,
    objetivoGeneral: 'Crear un usuario de ejemplo.',
    requisitos: [],
    verificacionFinal: ['El usuario de ejemplo aparece en la lista'],
    tiempoEstimadoMin: 8,
    dificultad: 'intermedio',
    pasos: [
      paso({
        id: 'alta-p1',
        titulo: 'Entrar al gestor',
        subArticuloId: GUIA_VINCULADA.id,
        subArticuloTitulo: GUIA_VINCULADA.titulo,
        bloques: [tarea('alta-p1-t1', 'Tener el gestor de ejemplo abierto')],
      }),
      paso({
        id: 'alta-p2',
        titulo: 'Crear la ficha del usuario',
        bloques: [
          tarea('alta-p2-t1', 'Abrir la ficha nueva'),
          tarea('alta-p2-t2', 'Escribir el nombre de ejemplo'),
          tarea('alta-p2-t3', 'Comprobar que la ficha queda guardada', 'verificacion'),
        ],
      }),
    ],
  },
})

// Caso H04 / A04 / A05: un paso con tres tareas, un aviso y un archivo.
// En el modelo heredado el aviso y el archivo no dicen a que tarea
// pertenecen, que es justo lo que hay que poder comprobar.
const GUIA_TRES_TAREAS = articulo({
  id: 'art-recurso-compartido',
  categoriaId: 'cat-impresoras',
  titulo: 'Conectar un recurso compartido de ejemplo',
  tipo: 'conexion',
  procedimiento: {
    descripcion: 'Caso de prueba de alcance por tarea.',
    portada: null,
    objetivoGeneral: 'Ver los recursos compartidos de ejemplo.',
    requisitos: ['Equipo encendido'],
    verificacionFinal: ['El recurso de ejemplo aparece en la lista', 'La prueba de ejemplo sale sin error'],
    tiempoEstimadoMin: 6,
    dificultad: 'principiante',
    pasos: [
      paso({
        id: 'rec-p1',
        titulo: 'Preparar el equipo',
        bloques: [tarea('rec-p1-t1', 'Encender el equipo de ejemplo')],
      }),
      paso({
        id: 'rec-p2',
        titulo: 'Abrir los recursos compartidos de ejemplo',
        objetivo: 'Ver la lista de recursos del servidor de ejemplo',
        bloques: [
          tarea('rec-p2-t1', 'Escribir la direccion de ejemplo'),
          aviso('rec-p2-a1', 'Aviso de ejemplo que solo corresponde a la primera tarea.'),
          tarea('rec-p2-t2', 'Confirmar con la tecla de aceptar'),
          tarea('rec-p2-t3', 'Comprobar que aparecen los recursos de ejemplo', 'verificacion'),
        ],
        adjuntos: [
          { referencia: 'pruebas/1700000000-manual-de-ejemplo.pdf', nombre: 'manual-de-ejemplo.pdf', tipo: 'application/pdf' },
        ],
      }),
      paso({
        id: 'rec-p3',
        titulo: 'Dejar el recurso a mano',
        solucionArticuloId: GUIA_VINCULADA.id,
        solucionArticuloTitulo: GUIA_VINCULADA.titulo,
        bloques: [tarea('rec-p3-t1', 'Anclar el recurso de ejemplo')],
      }),
    ],
  },
})

// Caso A04 / A05 / A07 con el modelo NUEVO: cada apoyo dice a que tarea
// pertenece, asi que la comprobacion es directa (la imagen de la tarea 1
// no debe salir en las tareas 2 ni 3).
const GUIA_ALCANCE_POR_TAREA = articulo({
  id: 'art-alcance-tarea',
  categoriaId: 'cat-impresoras',
  titulo: 'Apoyos asignados por tarea (ejemplo)',
  tipo: 'conexion',
  procedimiento: {
    descripcion: 'Caso de prueba del alcance por tarea con el modelo nuevo.',
    portada: null,
    objetivoGeneral: 'Comprobar que cada apoyo sale solo donde corresponde.',
    requisitos: [],
    verificacionFinal: ['La comprobación final se puede consultar sin marcar tareas'],
    tiempoEstimadoMin: 5,
    dificultad: 'principiante',
    pasos: [
      paso({
        id: 'alc-p1',
        titulo: 'Abrir los recursos compartidos de ejemplo',
        objetivo: 'Ver la lista de recursos del servidor de ejemplo',
        bloques: [
          tarea('alc-t1', 'Escribir la direccion de ejemplo'),
          avisoDeTarea('alc-a1', 'alc-t1', 'Precaucion que pertenece SOLO a la primera tarea.'),
          imagenDeTarea('alc-i1', 'alc-t1', 'Captura de ejemplo del campo de direccion'),
          tarea('alc-t2', 'Confirmar con la tecla de aceptar'),
          tarea('alc-t3', 'Comprobar que aparecen los recursos de ejemplo', 'verificacion'),
          archivoDeTarea('alc-f1', 'alc-t3', 'Planilla de ejemplo para anotar el resultado'),
          guiaDeTarea('alc-g1', 'alc-t2', GUIA_VINCULADA.id, GUIA_VINCULADA.titulo, 'consulta'),
        ],
        adjuntos: [
          { referencia: 'pruebas/1700000003-manual-del-paso.pdf', nombre: 'manual-del-paso.pdf', tipo: 'application/pdf' },
        ],
      }),
      paso({
        id: 'alc-p2',
        titulo: 'Dejar el recurso a mano',
        bloques: [tarea('alc-t4', 'Anclar el recurso de ejemplo')],
      }),
    ],
  },
})

// Caso A12: un vinculo que apunta a una guia que no esta en este
// dispositivo (eliminada, o todavia sin sincronizar). Sirve para
// comprobar que la ejecucion explica el motivo y ofrece una salida en
// vez de bloquear con una pantalla vacia.
const GUIA_VINCULO_ROTO = articulo({
  id: 'art-vinculo-roto',
  categoriaId: 'cat-software',
  titulo: 'Vinculo roto (ejemplo)',
  tipo: 'configuracion',
  procedimiento: {
    descripcion: 'Caso de prueba de vinculo no disponible.',
    portada: null,
    objetivoGeneral: 'Comprobar el mensaje de vinculo roto.',
    requisitos: [],
    verificacionFinal: [],
    tiempoEstimadoMin: 2,
    dificultad: 'principiante',
    pasos: [
      paso({
        id: 'roto-p1',
        titulo: 'Paso con vinculo que no existe',
        subArticuloId: 'art-que-no-existe',
        subArticuloTitulo: 'Guia que no llego a este dispositivo',
        bloques: [tarea('roto-t1', 'Tarea normal del paso')],
      }),
    ],
  },
})

// Relleno para que el catalogo tenga que desplazarse en 360 px.
const RELLENO: Articulo[] = [
  articulo({ id: 'art-pos-1', categoriaId: 'cat-pos', titulo: 'Caja de ejemplo: apertura de turno' }),
  articulo({ id: 'art-pos-2', categoriaId: 'cat-pos', titulo: 'Caja de ejemplo: cierre de turno' }),
  articulo({ id: 'art-pos-3', categoriaId: 'cat-pos', titulo: 'Caja de ejemplo: cambio de rollo' }),
  articulo({ id: 'art-sw-1', categoriaId: 'cat-software', titulo: 'Programa de ejemplo: instalacion' }),
  articulo({ id: 'art-sw-2', categoriaId: 'cat-software', titulo: 'Programa de ejemplo: actualizacion' }),
  articulo({ id: 'art-imp-1', categoriaId: 'cat-impresoras', titulo: 'Impresora de ejemplo: cambio de toner' }),
  articulo({ id: 'art-imp-2', categoriaId: 'cat-impresoras', titulo: 'Impresora de ejemplo: atasco de papel' }),
  articulo({ id: 'art-red-1', categoriaId: 'cat-redes', titulo: 'Punto de red de ejemplo: certificacion' }),
  articulo({ id: 'art-cam-1', categoriaId: 'cat-camaras', titulo: 'Camara de ejemplo: reinicio' }),
  articulo({ id: 'art-tel-1', categoriaId: 'cat-telefonia', titulo: 'Telefono de ejemplo: reasignacion' }),
  articulo({ id: 'art-acc-1', categoriaId: 'cat-accesos', titulo: 'Lector de ejemplo: alta de tarjeta' }),
  articulo({ id: 'art-srv-1', categoriaId: 'cat-servidores', titulo: 'Servidor de ejemplo: revision de disco' }),
  // Borrador, para comprobar el alcance del buscador (H09 / A16).
  articulo({
    id: 'art-borrador',
    categoriaId: 'cat-pos',
    titulo: 'Borrador de ejemplo sobre almuerzo',
    estado: 'borrador',
  }),
]

const ARTICULOS: Articulo[] = [
  GUIA_VINCULADA,
  GUIA_CON_VINCULO,
  GUIA_TRES_TAREAS,
  GUIA_ALCANCE_POR_TAREA,
  GUIA_VINCULO_ROTO,
  ...RELLENO,
]

/**
 * Deja la base local con el banco de pruebas. Idempotente: reescribe
 * siempre las mismas filas, asi que recargar no duplica nada.
 *
 * `conProgreso` siembra ademas un procedimiento a medias, que es lo que
 * hace aparecer el bloque "Sin terminar" y la barra de reanudar.
 */
export async function sembrarBancoDePruebas({ conProgreso = true } = {}): Promise<void> {
  await db.perfiles.put(PERFIL_PRUEBA)
  await db.categorias.bulkPut(CATEGORIAS)
  // Solo se siembra lo que NO existe todavia. Con `bulkPut` a secas, el
  // banco se rescribia en cada carga y se llevaba por delante lo que se
  // acabara de editar desde el propio editor, que es justo lo que hay
  // que poder probar (reordenar una tarea, asignar un apoyo, guardar).
  const existentes = new Set(
    (await db.articulos.bulkGet(ARTICULOS.map((a) => a.id))).flatMap((a) => (a ? [a.id] : [])),
  )
  const faltantes = ARTICULOS.filter((a) => !existentes.has(a.id))
  if (faltantes.length > 0) await db.articulos.bulkAdd(faltantes)
  if (conProgreso && (await db.progresoPasos.count()) === 0) {
    await db.progresoPasos.put({
      articuloId: GUIA_TRES_TAREAS.id,
      pasosHechos: ['rec-p1'],
      instruccionesHechas: ['rec-p1-t1'],
      verificacionHecha: [],
      actualizadoEn: AHORA,
    })
  }
}
