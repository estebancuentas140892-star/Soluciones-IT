import type { Session } from '@supabase/supabase-js'
import {
  db,
  type Articulo,
  type BloquePaso,
  type Categoria,
  type Conexion,
  type Credencial,
  type Dispositivo,
  type PasoProcedimiento,
  type Referencia,
} from '../lib/db'

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
  // Una categoria de red (encargo del 2026-09-22): sus equipos van a
  // Infraestructura, pero se encuentran tambien buscando en Equipos.
  { ...categoria('cat-switches', 'Switches', 9), esRed: true },
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
    referenciaId: null,
    referenciaTitulo: '',
    referenciaTipo: null,
  }
}

// Decision CON destino para el "No", que es lo que ejercita la seccion
// 6 del encargo: pregunta clara y respuesta con destino definido.
function decision(id: string, texto: string, destinoId: string, destinoTitulo: string): BloquePaso {
  return {
    ...tarea(id, texto, 'decision'),
    decisionArticuloId: destinoId,
    decisionArticuloTitulo: destinoTitulo,
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
    referenciaId: null,
    referenciaTitulo: '',
    referenciaTipo: null,
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
    lugar: '',
    resultado: '',
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
        lugar: 'Puesto de trabajo de ejemplo',
        resultado: 'El equipo de ejemplo encendido',
        bloques: [tarea('rec-p1-t1', 'Encender el equipo de ejemplo')],
      }),
      paso({
        id: 'rec-p2',
        titulo: 'Abrir los recursos compartidos de ejemplo',
        objetivo: 'Ver la lista de recursos del servidor de ejemplo',
        lugar: 'Ventana Ejecutar de Windows',
        resultado: 'La lista de recursos del servidor de ejemplo',
        // "Credencial necesaria" (tarea 255). El id no existe en la
        // bóveda de prueba: basta para ver el bloque y su rótulo.
        vinculoProtegido: { tipo: 'credencial', id: 'cred-ejemplo-servidor', titulo: 'Acceso de ejemplo al servidor' },
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
        lugar: 'Explorador de archivos de ejemplo',
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
        lugar: '',
        resultado: '',
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

// Caso de la seccion 1 del encargo del 2026-09-09: titulos largos en la
// tarjeta del catalogo. El reportado por el usuario, palabra por
// palabra, mas su variante en borrador y una tarjeta de titulo corto
// para comparar en la misma lista.
const GUIA_TITULO_LARGO = articulo({
  id: 'art-titulo-largo',
  categoriaId: 'cat-pos',
  titulo: 'Configurar las paginas que abre Google Chrome al iniciar en un POS',
  tipo: 'configuracion',
  procedimiento: {
    descripcion: 'Caso de prueba de titulo largo.',
    portada: null,
    objetivoGeneral: 'Comprobar el reparto de la tarjeta con un titulo largo.',
    requisitos: [],
    verificacionFinal: ['El navegador de ejemplo abre las paginas configuradas'],
    tiempoEstimadoMin: 12,
    dificultad: 'principiante',
    pasos: [
      paso({
        id: 'largo-p1',
        titulo: 'Abrir la configuracion del navegador de ejemplo',
        bloques: [tarea('largo-p1-t1', 'Abrir el menu de configuracion de ejemplo')],
      }),
      paso({
        id: 'largo-p2',
        titulo: 'Anotar las paginas de inicio de ejemplo',
        bloques: [
          tarea('largo-p2-t1', 'Escribir la primera pagina de ejemplo'),
          tarea('largo-p2-t2', 'Comprobar que quedan guardadas', 'verificacion'),
        ],
      }),
    ],
  },
})

const GUIA_TITULO_LARGO_BORRADOR = articulo({
  id: 'art-titulo-largo-borrador',
  categoriaId: 'cat-software',
  titulo: 'Restablecer el perfil del navegador de ejemplo cuando el POS arranca con pestanas equivocadas',
  tipo: 'configuracion',
  estado: 'borrador',
  procedimiento: {
    descripcion: 'Caso de prueba de titulo largo en borrador.',
    portada: null,
    objetivoGeneral: 'Comprobar la tarjeta con titulo largo y estado borrador.',
    requisitos: [],
    verificacionFinal: [],
    tiempoEstimadoMin: 7,
    dificultad: 'intermedio',
    pasos: [
      paso({
        id: 'largo-b-p1',
        titulo: 'Cerrar el navegador de ejemplo',
        bloques: [tarea('largo-b-p1-t1', 'Cerrar todas las ventanas de ejemplo')],
      }),
    ],
  },
})

// Caso de las secciones 5 y 6: una decision con pregunta y destino, y
// una verificacion, para comprobar que los tres tipos de tarea usan
// controles distintos en el modo de una tarea a la vez.
const GUIA_CON_DECISION = articulo({
  id: 'art-decision',
  categoriaId: 'cat-pos',
  titulo: 'Revisar la caja de ejemplo antes de abrir turno',
  tipo: 'mantenimiento',
  procedimiento: {
    descripcion: 'Caso de prueba de decision con destino.',
    portada: null,
    objetivoGeneral: 'Comprobar los tres tipos de tarea.',
    requisitos: [],
    verificacionFinal: ['La caja de ejemplo queda lista'],
    tiempoEstimadoMin: 4,
    dificultad: 'principiante',
    pasos: [
      paso({
        id: 'dec-p1',
        titulo: 'Comprobar el estado de la caja de ejemplo',
        bloques: [
          tarea('dec-p1-t1', 'Encender la caja de ejemplo'),
          decision(
            'dec-p1-t2',
            '¿La caja de ejemplo enciende y llega a la pantalla principal?',
            GUIA_VINCULADA.id,
            GUIA_VINCULADA.titulo,
          ),
          tarea('dec-p1-t3', 'Comprobar que la fecha de ejemplo es la de hoy', 'verificacion'),
        ],
      }),
    ],
  },
})

// Caso de la tarea 1 del encargo del 2026-09-09: una tarea sin guias,
// otra con UNA necesaria y otra con DOS, mas una de consulta que no
// debe bloquear nada.
const GUIA_SEGUNDA = articulo({
  id: 'art-segunda-necesaria',
  categoriaId: 'cat-software',
  titulo: 'Abrir la consola de ejemplo',
  tipo: 'conexion',
  procedimiento: {
    descripcion: 'Segunda guia necesaria del banco.',
    portada: null,
    objetivoGeneral: 'Dejar la consola de ejemplo abierta.',
    requisitos: [],
    verificacionFinal: [],
    tiempoEstimadoMin: 2,
    dificultad: 'principiante',
    pasos: [
      paso({
        id: 'consola-p1',
        titulo: 'Abrir la consola de ejemplo',
        bloques: [tarea('consola-p1-t1', 'Abrir la consola de ejemplo')],
      }),
    ],
  },
})

const GUIA_VARIAS_OBLIGATORIAS = articulo({
  id: 'art-varias-obligatorias',
  categoriaId: 'cat-software',
  titulo: 'Tarea con varias guias necesarias (ejemplo)',
  tipo: 'configuracion',
  procedimiento: {
    descripcion: 'Caso de prueba de guias obligatorias por tarea.',
    portada: null,
    objetivoGeneral: 'Comprobar cero, una y varias guias necesarias.',
    requisitos: [],
    verificacionFinal: [],
    tiempoEstimadoMin: 6,
    dificultad: 'intermedio',
    pasos: [
      paso({
        id: 'vo-p1',
        titulo: 'Preparar el entorno de ejemplo',
        bloques: [
          tarea('vo-t1', 'Tarea sin guias necesarias'),
          tarea('vo-t2', 'Tarea con UNA guia necesaria'),
          guiaDeTarea('vo-g1', 'vo-t2', GUIA_VINCULADA.id, GUIA_VINCULADA.titulo, 'necesario'),
          tarea('vo-t3', 'Tarea con DOS guias necesarias'),
          guiaDeTarea('vo-g2', 'vo-t3', GUIA_VINCULADA.id, GUIA_VINCULADA.titulo, 'necesario'),
          guiaDeTarea('vo-g3', 'vo-t3', 'art-que-no-existe-2', 'Consulta de ejemplo', 'consulta'),
          guiaDeTarea('vo-g4', 'vo-t3', GUIA_SEGUNDA.id, GUIA_SEGUNDA.titulo, 'necesario'),
        ],
      }),
    ],
  },
})

// Caso del encargo del 2026-09-17 (secciones 4 a 8): una guía con
// requisitos reales y un aviso de cada tono, para comprobar que solo los
// riesgos se ven como alerta, que el dato va a la vista, que la
// información y el consejo quedan plegados y que "Antes de empezar" sale
// en el paso 1. Todo inventado.
function avisoConTono(
  id: string,
  tareaId: string,
  tono: 'info' | 'precaucion' | 'importante' | 'consejo' | 'dato',
  texto: string,
): BloquePaso {
  return { ...aviso(id, texto), tono, alcance: 'tarea', tareaId }
}

const GUIA_TONOS = articulo({
  id: 'art-tonos',
  categoriaId: 'cat-pos',
  titulo: 'Cambiar un dato de la caja de ejemplo',
  tipo: 'configuracion',
  procedimiento: {
    descripcion: 'Caso de prueba de avisos por tono.',
    portada: null,
    objetivoGeneral: 'Dejar el dato de ejemplo cambiado.',
    requisitos: ['Documento de ejemplo con el dato nuevo', 'Usuario de ejemplo con permisos'],
    verificacionFinal: ['La caja de ejemplo muestra el dato nuevo'],
    tiempoEstimadoMin: 5,
    dificultad: 'intermedio',
    pasos: [
      paso({
        id: 'tonos-p1',
        titulo: 'Abrir el programa de ejemplo',
        bloques: [tarea('tonos-p1-t1', 'Abre el programa de ejemplo en la caja')],
      }),
      paso({
        id: 'tonos-p2',
        titulo: 'Escribir el dato nuevo',
        objetivo: 'Que la caja use el dato del documento',
        lugar: '',
        resultado: '',
        bloques: [
          tarea('tonos-p2-t1', 'Escribe el dato nuevo en el campo de ejemplo'),
          avisoConTono('tonos-a-dato', 'tonos-p2-t1', 'dato', 'Formato del dato de ejemplo: EJ-0000'),
          avisoConTono('tonos-a-info', 'tonos-p2-t1', 'info', 'Explicación de ejemplo de por qué el campo se llama así'),
          tarea('tonos-p2-t2', 'Pulsa Guardar'),
          avisoConTono('tonos-a-imp', 'tonos-p2-t2', 'importante', 'Guardar reemplaza el dato anterior de la caja de ejemplo'),
          avisoConTono('tonos-a-consejo', 'tonos-p2-t2', 'consejo', 'Consejo de ejemplo: anota el dato viejo antes'),
        ],
      }),
    ],
  },
})

// Segunda pasada del encargo del 2026-09-17 (regla 20): una guía escrita
// como un apunte sin revisar, con los tres problemas que el editor
// señala (un requisito que es una acción y ya está en el paso 1, una
// tarea que encadena cuatro acciones y una alerta que solo recuerda
// algo), para ver sus pistas en /soluciones/cat-pos/art-apunte/editar.
// Todo inventado.
const GUIA_APUNTE = articulo({
  id: 'art-apunte',
  categoriaId: 'cat-pos',
  titulo: 'Apunte sin revisar de la caja de ejemplo',
  tipo: 'configuracion',
  procedimiento: {
    descripcion: 'Caso de prueba de la revisión del editor.',
    portada: null,
    objetivoGeneral: '',
    requisitos: ['Documento de ejemplo con el dato nuevo', 'Entrar al administrador de ejemplo'],
    verificacionFinal: [],
    tiempoEstimadoMin: 6,
    dificultad: 'intermedio',
    pasos: [
      paso({
        id: 'apunte-p1',
        titulo: 'Entrar',
        bloques: [tarea('apunte-p1-t1', 'Entra en el administrador de ejemplo')],
      }),
      paso({
        id: 'apunte-p2',
        titulo: 'Llegar a la configuración',
        bloques: [
          tarea(
            'apunte-p2-t1',
            'Ingresa a Terminales, selecciona la terminal de ejemplo, luego pulsa Editar y abre Impresoras',
          ),
          avisoConTono('apunte-a1', 'apunte-p2-t1', 'precaucion', 'Recuerda cerrar la caja de ejemplo al terminar'),
        ],
      }),
    ],
  },
})

const ARTICULOS: Articulo[] = [
  GUIA_TONOS,
  GUIA_APUNTE,
  GUIA_VINCULADA,
  GUIA_CON_VINCULO,
  GUIA_TRES_TAREAS,
  GUIA_ALCANCE_POR_TAREA,
  GUIA_VINCULO_ROTO,
  GUIA_TITULO_LARGO,
  GUIA_TITULO_LARGO_BORRADOR,
  GUIA_CON_DECISION,
  GUIA_SEGUNDA,
  GUIA_VARIAS_OBLIGATORIAS,
  ...RELLENO,
]

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
    updatedAt: AHORA,
    updatedBy: PERFIL_PRUEBA.id,
    eliminadoEn: null,
    ...parcial,
  }
}

// CENTRO DE CONSULTA (2026-09-14). Reproduce la FORMA del contenido que
// siembra supabase/schema.sql (seccion 5.2) para poder mirar las cuatro
// pestañas sin servidor: una herramienta con uso confirmado y una guia
// publicada, otra que no llego a este telefono, una con uso solo
// documentado, una con abreviatura y una guia en borrador, mas un
// termino, un atajo y un comando. Solo descripciones publicas de cada
// producto: ni un dato interno.
const REFERENCIAS: Referencia[] = [
  ficha({
    id: 'ref-tightvnc',
    tipo: 'herramienta',
    titulo: 'TightVNC',
    alias: ['Tight VNC'],
    categoria: 'Acceso remoto',
    definicion: 'Herramienta de acceso remoto utilizada para controlar computadores a distancia.',
    usoEnMetroparques: 'Herramienta de ejemplo para conectarse a un equipo de prueba.',
    estadoUso: 'confirmado',
    relacionadas: [
      { id: 'ref-vnc', titulo: 'VNC' },
      { id: 'ref-dhcp', titulo: 'DHCP' },
    ],
    guiasRelacionadas: [
      { id: 'art-alta-usuario', titulo: 'Dar de alta un usuario de ejemplo' },
      { id: 'art-que-no-llego', titulo: 'Guia de ejemplo que no llego a este telefono' },
    ],
  }),
  ficha({
    id: 'ref-esxi',
    tipo: 'herramienta',
    titulo: 'VMware ESXi',
    categoria: 'Servidores y virtualización',
    definicion:
      'Plataforma de virtualización que permite ejecutar múltiples máquinas virtuales sobre infraestructura física.',
    usoEnMetroparques: 'Uso de ejemplo con evidencia histórica.',
    estadoUso: 'documentado',
  }),
  ficha({
    id: 'ref-ssms',
    tipo: 'herramienta',
    titulo: 'SQL Server Management Studio',
    abreviatura: 'SSMS',
    categoria: 'Bases de datos',
    proveedor: 'Microsoft',
    definicion: 'Herramienta gráfica para administrar Microsoft SQL Server.',
    guiasRelacionadas: [{ id: GUIA_TITULO_LARGO_BORRADOR.id, titulo: GUIA_TITULO_LARGO_BORRADOR.titulo }],
  }),
  ficha({
    id: 'ref-sicof',
    tipo: 'herramienta',
    titulo: 'SICOF ERP',
    categoria: 'Administración',
    proveedor: 'ADA',
    definicion: 'Sistema ERP administrativo y financiero.',
    notas: 'No confundir con las aplicaciones de ejemplo del POS.',
    estadoUso: 'documentado',
  }),
  ficha({
    id: 'ref-vnc',
    tipo: 'termino',
    titulo: 'VNC',
    categoria: 'Acceso remoto',
    definicion: 'Sistema para ver y controlar el escritorio de otro equipo a través de la red.',
  }),
  ficha({
    id: 'ref-dhcp',
    tipo: 'termino',
    titulo: 'DHCP',
    categoria: 'Redes',
    definicion: 'El servicio que reparte direcciones IP automáticamente a los equipos que se conectan.',
  }),
  ficha({
    id: 'ref-ejecutar',
    tipo: 'atajo',
    titulo: 'Abrir la ventana Ejecutar',
    valor: 'Windows + R',
    plataforma: 'Windows',
    categoria: 'Windows',
    cuandoUsar: 'Abre la ventana Ejecutar, donde se escriben comandos cortos sin abrir una consola.',
  }),
  ficha({
    id: 'ref-ping',
    tipo: 'comando',
    titulo: 'Comprobar si un equipo responde',
    valor: 'ping [dirección]',
    plataforma: 'Windows, macOS y Linux',
    categoria: 'Redes',
    cuandoUsar: 'Para comprobar si hay camino de red hasta un equipo.',
    resultadoEsperado: 'Aparecen líneas de respuesta con el tiempo en milisegundos.',
  }),
]

// AGENDA, EQUIPOS Y RECIENTES DEL BANCO (encargo del 2026-09-22). Todo
// INVENTADO: las direcciones son del rango de documentacion 192.0.2.0/24
// (RFC 5737), que no existe en ninguna red, y las credenciales no llevan
// ningun dato cifrado (solo su nombre y su fecha, que es lo que la agenda
// lee). Las fechas se calculan desde hoy para que "vencido" y "proximo"
// sigan siendo verdad el dia que se mire.

function fechaEnDias(dias: number): string {
  const fecha = new Date()
  fecha.setDate(fecha.getDate() + dias)
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${fecha.getFullYear()}-${mes}-${dia}`
}

function credencial(id: string, titulo: string, venceEnDias: number): Credencial {
  return {
    id,
    titulo,
    categoria: 'Ejemplo',
    tipo: 'cuenta',
    datosCifrados: '',
    venceEn: fechaEnDias(venceEnDias),
    dispositivos: [],
    archivo: null,
    updatedAt: AHORA,
    updatedBy: PERFIL_PRUEBA.id,
    eliminadoEn: null,
  }
}

const CREDENCIALES: Credencial[] = [
  credencial('cred-resolucion-ejemplo', 'Resolucion POS de ejemplo', 12),
  credencial('cred-wifi-ejemplo', 'Wifi de invitados de ejemplo', -3),
]

function dispositivo(datos: Partial<Dispositivo> & { id: string; nombre: string; categoriaId: string }): Dispositivo {
  return {
    marca: '',
    modelo: '',
    serial: '',
    placaInventario: '',
    ubicacion: '',
    ubicacionId: null,
    responsable: '',
    responsableId: null,
    reemplazaA: null,
    ip: '',
    estado: 'Operativo',
    observaciones: '',
    detalles: {},
    foto: null,
    updatedAt: AHORA,
    updatedBy: PERFIL_PRUEBA.id,
    eliminadoEn: null,
    ...datos,
  }
}

const DISPOSITIVOS: Dispositivo[] = [
  dispositivo({
    id: 'dis-impresora-ejemplo',
    nombre: 'Impresora de ejemplo Administracion',
    categoriaId: 'cat-impresoras',
    marca: 'Marca de ejemplo',
    modelo: 'Modelo A1',
    ip: '192.0.2.40',
    ubicacion: 'Oficina de ejemplo',
    responsable: 'Persona de ejemplo',
    placaInventario: 'EJ-0040',
    detalles: { 'Bandeja': 'Carta y Oficio', 'Firmware': 'Version de ejemplo' },
  }),
  dispositivo({
    id: 'dis-caja-ejemplo',
    nombre: 'Caja de ejemplo 1',
    categoriaId: 'cat-pos',
    ip: '192.0.2.21',
    ubicacion: 'Taquilla de ejemplo',
    estado: 'En mantenimiento',
    placaInventario: 'EJ-0021',
  }),
  dispositivo({
    id: 'dis-switch-ejemplo',
    nombre: 'SW-EJEMPLO-02',
    categoriaId: 'cat-switches',
    ip: '192.0.2.2',
    ubicacion: 'Rack de ejemplo',
    placaInventario: 'EJ-0002',
  }),
]

const CONEXIONES: Conexion[] = [
  {
    id: 'con-switch-impresora-ejemplo',
    tipo: 'enlace',
    origenId: 'dis-switch-ejemplo',
    origenNombre: 'SW-EJEMPLO-02',
    origenPuerto: '18',
    destinoId: 'dis-impresora-ejemplo',
    destinoNombre: 'Impresora de ejemplo Administracion',
    destinoPuerto: '',
    medio: 'UTP',
    notas: '',
    updatedAt: AHORA,
    updatedBy: PERFIL_PRUEBA.id,
    eliminadoEn: null,
  },
]

/** Solo lo que no existe todavia: lo editado desde la app no se pisa. */
async function sembrarAgendaYEquipos(): Promise<void> {
  await db.transaction('rw', [db.credenciales, db.dispositivos, db.conexiones, db.recientes], async () => {
    const credencialesExistentes = new Set(
      (await db.credenciales.bulkGet(CREDENCIALES.map((c) => c.id))).flatMap((c) => (c ? [c.id] : [])),
    )
    await db.credenciales.bulkAdd(CREDENCIALES.filter((c) => !credencialesExistentes.has(c.id)))
    const equiposExistentes = new Set(
      (await db.dispositivos.bulkGet(DISPOSITIVOS.map((d) => d.id))).flatMap((d) => (d ? [d.id] : [])),
    )
    await db.dispositivos.bulkAdd(DISPOSITIVOS.filter((d) => !equiposExistentes.has(d.id)))
    const conexionesExistentes = new Set(
      (await db.conexiones.bulkGet(CONEXIONES.map((c) => c.id))).flatMap((c) => (c ? [c.id] : [])),
    )
    await db.conexiones.bulkAdd(CONEXIONES.filter((c) => !conexionesExistentes.has(c.id)))
    // Dos guias usadas hace poco, para que Resolver tenga "Recientes".
    if ((await db.recientes.count()) === 0) {
      const haceDias = (dias: number) => new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString()
      await db.recientes.bulkPut([
        { clave: 'articulo:art-recurso-compartido', tipo: 'articulo', entidadId: 'art-recurso-compartido', visitadoEn: haceDias(0.2) },
        { clave: 'articulo:art-tonos', tipo: 'articulo', entidadId: 'art-tonos', visitadoEn: haceDias(2) },
      ])
    }
  })
}

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
  //
  // Dentro de UNA transaccion: en desarrollo StrictMode monta dos veces
  // y siembra dos veces a la vez. Sin transaccion, las dos pasadas veian
  // la tabla vacia y la segunda fallaba con "Key already exists" (asi
  // aparecio al sembrar por primera vez las fichas del Centro de
  // consulta); con ella, IndexedDB las ordena y la segunda ya las ve.
  await db.transaction('rw', db.articulos, db.referencias, async () => {
    const existentes = new Set(
      (await db.articulos.bulkGet(ARTICULOS.map((a) => a.id))).flatMap((a) => (a ? [a.id] : [])),
    )
    const faltantes = ARTICULOS.filter((a) => !existentes.has(a.id))
    if (faltantes.length > 0) await db.articulos.bulkAdd(faltantes)
    // Mismo criterio para las fichas del Centro de consulta: lo editado
    // desde la propia app no se pisa al recargar.
    const fichasExistentes = new Set(
      (await db.referencias.bulkGet(REFERENCIAS.map((r) => r.id))).flatMap((r) => (r ? [r.id] : [])),
    )
    const fichasFaltantes = REFERENCIAS.filter((r) => !fichasExistentes.has(r.id))
    if (fichasFaltantes.length > 0) await db.referencias.bulkAdd(fichasFaltantes)
  })
  await sembrarAgendaYEquipos()
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
