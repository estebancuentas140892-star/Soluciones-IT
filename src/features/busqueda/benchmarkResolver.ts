import type MiniSearch from 'minisearch'
import type {
  Articulo,
  CampoProtegido,
  Categoria,
  Credencial,
  Diagnostico,
  Dispositivo,
  NodoDiagnostico,
  PasoProcedimiento,
  Persona,
  Procedimiento,
  Referencia,
  TipoArticulo,
  Ubicacion,
} from '../../lib/db'
import { CAMPOS_BLOQUE_VACIOS } from '../../lib/procedimiento'
import { normalizarTexto } from '../soluciones/iconosSoluciones'
import type { Intencion } from './mejores'
import { prominenciaPuenteBoveda, type ProminenciaPuente } from './reglasPuenteBoveda'
import {
  crearIndiceDesdeDocumentos,
  documentosDeBusqueda,
  type DatosIndice,
  type DocumentoBusqueda,
  type ResultadoBusqueda,
  type TipoResultado,
} from './useIndiceBusqueda'

// BENCHMARK DE CONSULTAS NATURALES DE RESOLVER (tarea 288, fase 1).
//
// El encargo del 2026-10-02 pide que Resolver entienda QUÉ intenta
// conseguir el técnico ("la impresora de mercadeo no imprime") y no
// dependa de que conozca el nombre exacto de una guía. Antes de tocar el
// ranking hacía falta una vara fija con la que medir: estas consultas, lo
// que cada una pide y lo que tiene que quedar arriba.
//
// LAS EXPECTATIVAS SE ESCRIBIERON ANTES DE CAMBIAR EL ALGORITMO y no se
// ajustan después para que coincidan con él. El primer commit de la tarea
// las ejecutó contra el buscador de entonces y anotó qué fallaba (el
// "ANTES", en BUSCADOR.md); el mismo banco, sin tocar un caso, mide el
// "DESPUÉS".
//
// LOS DATOS SON SINTÉTICOS. Ningún equipo, persona, guía ni credencial
// sale de la base real: son inventados con la MISMA ESTRUCTURA que los
// reales (artículos con procedimiento, síntomas y causas; equipos con
// marca, modelo, serial, placa, IP, ubicación vinculada y responsable;
// guías con preguntas; fichas del Centro de consulta; credenciales y
// datos protegidos de un equipo) y pasan por el mismo camino que en la
// app: `documentosDeBusqueda` -> `crearIndiceDesdeDocumentos` -> `buscar`
// -> "Mejores resultados". Las credenciales y el dato protegido solo
// entran con la Bóveda abierta, como en la app; sus "valores cifrados"
// son marcas de texto que una prueba busca para demostrar que no se
// filtran.

const MARCA = { updatedAt: '2026-10-02T00:00:00.000Z', updatedBy: null, eliminadoEn: null }

// ----------------------------------------------------------------
// Constructores con la forma completa de cada entidad
// ----------------------------------------------------------------

function categoria(id: string, nombre: string, orden: number): Categoria {
  return { id, nombre, icono: '', orden, esRed: false, color: null, ...MARCA }
}

function ubicacion(id: string, nombre: string, padreId: string | null): Ubicacion {
  return { id, nombre, padreId, notas: '', ...MARCA }
}

function persona(id: string, nombre: string, notas: string): Persona {
  return {
    id,
    nombre,
    notas,
    estado: 'activa',
    fechaIngreso: null,
    fechaRetiro: null,
    motivoRetiro: '',
    ...MARCA,
  }
}

function equipo(parcial: Partial<Dispositivo> & Pick<Dispositivo, 'id' | 'nombre' | 'categoriaId'>): Dispositivo {
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
    ...MARCA,
    ...parcial,
  }
}

function paso(id: string, titulo: string, tareas: string[]): PasoProcedimiento {
  return {
    id,
    titulo,
    objetivo: '',
    lugar: '',
    resultado: '',
    bloques: tareas.map((texto, indice) => ({
      ...CAMPOS_BLOQUE_VACIOS,
      id: `${id}-t${indice + 1}`,
      tipo: 'tarea' as const,
      tipoTarea: 'accion' as const,
      texto,
    })),
    adjuntos: [],
    vinculoProtegido: null,
    subArticuloId: null,
    subArticuloTitulo: '',
    solucionArticuloId: null,
    solucionArticuloTitulo: '',
  }
}

// El procedimiento viaja como JSON (columna `procedimiento`), igual que en
// Supabase. `formasBusqueda` va dentro de ese JSON: es el campo editorial
// de la fase 5 ("¿Cómo buscaría alguien esta guía?"). Un buscador que no
// lo conoce simplemente lo ignora, que es lo que pasaba en el ANTES.
function procedimiento(datos: {
  cuandoUsar: string
  objetivo?: string
  requisitos?: string[]
  pasos: PasoProcedimiento[]
  formasBusqueda?: string[]
}): Procedimiento {
  return {
    descripcion: datos.cuandoUsar,
    portada: null,
    objetivoGeneral: datos.objetivo ?? '',
    requisitos: datos.requisitos ?? [],
    pasos: datos.pasos,
    verificacionFinal: [],
    tiempoEstimadoMin: null,
    dificultad: null,
    formasBusqueda: datos.formasBusqueda ?? [],
  } as Procedimiento
}

function guia(datos: {
  id: string
  categoriaId: string
  titulo: string
  tipo: TipoArticulo
  procedimiento: Procedimiento | null
  sintomas?: string[]
  causas?: string[]
  etiquetas?: string[]
  dispositivosAfectados?: { id: string; nombre: string }[]
  estado?: Articulo['estado']
}): Articulo {
  return {
    id: datos.id,
    categoriaId: datos.categoriaId,
    titulo: datos.titulo,
    tipo: datos.tipo,
    contenido: '',
    etiquetas: datos.etiquetas ?? [],
    procedimiento: datos.procedimiento,
    sintomas: datos.sintomas ?? [],
    causas: datos.causas ?? [],
    dispositivosAfectados: datos.dispositivosAfectados ?? [],
    esRutaInicio: false,
    estado: datos.estado ?? 'publicado',
    version: '1.0',
    relacionados: [],
    ordenRutaInicio: 0,
    origenSugerenciaId: null,
    aplicaA: null,
    ...MARCA,
  }
}

function pregunta(
  id: string,
  texto: string,
  opciones: {
    etiqueta: string
    siguiente?: string
    articulo?: { id: string; titulo: string }
    final?: string
  }[],
): NodoDiagnostico {
  return {
    id,
    tituloInterno: '',
    pregunta: texto,
    descripcion: '',
    opciones: opciones.map((opcion, indice) => ({
      id: `${id}-o${indice + 1}`,
      etiqueta: opcion.etiqueta,
      siguienteNodoId: opcion.siguiente ?? null,
      articuloId: opcion.articulo?.id ?? null,
      articuloTitulo: opcion.articulo?.titulo ?? '',
      mensajeFinal: opcion.final ?? '',
      resultado: '',
    })),
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
    ...MARCA,
    ...parcial,
  }
}

function credencial(
  parcial: Pick<Credencial, 'id' | 'titulo' | 'categoria' | 'datosCifrados'> & Partial<Credencial>,
): Credencial {
  return { tipo: 'cuenta', venceEn: null, dispositivos: [], archivo: null, ...MARCA, ...parcial }
}

// ----------------------------------------------------------------
// El conjunto de datos
// ----------------------------------------------------------------

const CATEGORIAS: Categoria[] = [
  categoria('cat-impresoras', 'Impresoras', 1),
  categoria('cat-correo', 'Correo', 2),
  categoria('cat-usuarios', 'Usuarios y accesos', 3),
  categoria('cat-redes', 'Redes', 4),
  categoria('cat-servidores', 'Servidores', 5),
  categoria('cat-pos', 'POS', 6),
  categoria('cat-computadores', 'Computadores', 7),
]

const UBICACIONES: Ubicacion[] = [
  ubicacion('u-sede', 'Sede Administrativa', null),
  ubicacion('u-mercadeo', 'Mercadeo', 'u-sede'),
  ubicacion('u-contabilidad', 'Contabilidad', 'u-sede'),
  ubicacion('u-sistemas', 'Cuarto de sistemas', 'u-sede'),
  ubicacion('u-parque', 'Parque Norte', null),
  ubicacion('u-taquilla', 'Taquilla principal', 'u-parque'),
]

const PERSONAS: Persona[] = [
  persona('p-carlos', 'Carlos Restrepo', 'Coordinador de mercadeo'),
  persona('p-laura', 'Laura Gómez', 'Auxiliar contable'),
  persona('p-ana', 'Ana María Ríos', 'Taquillera'),
  persona('p-juan', 'Juan Pérez', 'Analista de sistemas'),
]

const EQUIPOS: Dispositivo[] = [
  equipo({
    id: 'd-imp-mercadeo',
    nombre: 'Impresora Mercadeo',
    categoriaId: 'cat-impresoras',
    marca: 'Ricoh',
    modelo: 'MP 501',
    serial: 'W3089500123',
    placaInventario: '1123',
    ubicacion: 'Mercadeo',
    ubicacionId: 'u-mercadeo',
    responsable: 'Carlos Restrepo',
    responsableId: 'p-carlos',
    ip: '10.10.6.8',
    observaciones: 'Multifuncional del área: imprime, copia y escanea a correo.',
  }),
  equipo({
    id: 'd-switch-mercadeo',
    nombre: 'Switch Mercadeo',
    categoriaId: 'cat-redes',
    marca: 'TP-Link',
    modelo: 'TL-SG1016',
    serial: '22041A00987',
    placaInventario: '1124',
    ubicacion: 'Mercadeo',
    ubicacionId: 'u-mercadeo',
    ip: '10.10.6.1',
  }),
  equipo({
    id: 'd-imp-caja1',
    nombre: 'Impresora Caja 1',
    categoriaId: 'cat-pos',
    marca: 'Epson',
    modelo: 'TM-T88V',
    serial: 'X5KE012345',
    placaInventario: '2201',
    ubicacion: 'Taquilla principal',
    ubicacionId: 'u-taquilla',
    ip: '10.10.20.11',
  }),
  equipo({
    id: 'd-imp-caja2',
    nombre: 'Impresora Caja 2',
    categoriaId: 'cat-pos',
    marca: 'Epson',
    modelo: 'TM-T88V',
    serial: 'X5KE012346',
    placaInventario: '2202',
    ubicacion: 'Taquilla principal',
    ubicacionId: 'u-taquilla',
    ip: '10.10.20.12',
  }),
  equipo({
    id: 'd-imp-contabilidad',
    nombre: 'Impresora Contabilidad',
    categoriaId: 'cat-impresoras',
    marca: 'HP',
    modelo: 'LaserJet M404',
    serial: 'PHBQ123456',
    placaInventario: '1201',
    ubicacion: 'Contabilidad',
    ubicacionId: 'u-contabilidad',
    responsable: 'Laura Gómez',
    responsableId: 'p-laura',
    ip: '10.10.5.20',
  }),
  equipo({
    id: 'd-pc-contabilidad',
    nombre: 'PC-CONT-01',
    categoriaId: 'cat-computadores',
    marca: 'Lenovo',
    modelo: 'ThinkCentre M70q',
    serial: 'MJ0ABC12',
    placaInventario: '1210',
    ubicacion: 'Contabilidad',
    ubicacionId: 'u-contabilidad',
    responsable: 'Laura Gómez',
    responsableId: 'p-laura',
    ip: '10.10.5.31',
    detalles: { 'Sistema operativo': 'Windows 11 Pro', 'Usuario de red': 'lgomez' },
  }),
  equipo({
    id: 'd-srv-facturacion',
    nombre: 'Servidor de facturación',
    categoriaId: 'cat-servidores',
    marca: 'Dell',
    modelo: 'PowerEdge R440',
    serial: '7XK9P23',
    placaInventario: '0890',
    ubicacion: 'Cuarto de sistemas',
    ubicacionId: 'u-sistemas',
    ip: '10.10.1.20',
    observaciones: 'Base de datos de facturación electrónica de los POS.',
  }),
  equipo({
    id: 'd-srv-archivos',
    nombre: 'Servidor de archivos',
    categoriaId: 'cat-servidores',
    marca: 'HP',
    modelo: 'ProLiant DL380',
    serial: 'CZJ1234567',
    placaInventario: '0891',
    ubicacion: 'Cuarto de sistemas',
    ubicacionId: 'u-sistemas',
    ip: '10.10.1.21',
    observaciones: 'Carpetas compartidas de las áreas.',
  }),
  equipo({
    id: 'd-lector-taquilla',
    nombre: 'Lector de huella Taquilla',
    categoriaId: 'cat-pos',
    marca: 'ZKTeco',
    modelo: 'U160',
    serial: 'ABC123',
    placaInventario: '3301',
    ubicacion: 'Taquilla principal',
    ubicacionId: 'u-taquilla',
    ip: '10.10.20.40',
  }),
  equipo({
    id: 'd-ups-sistemas',
    nombre: 'UPS Cuarto de sistemas',
    categoriaId: 'cat-servidores',
    marca: 'APC',
    modelo: 'Smart-UPS 1500',
    serial: 'AS1234567890',
    placaInventario: '456',
    ubicacion: 'Cuarto de sistemas',
    ubicacionId: 'u-sistemas',
  }),
]

const GUIA_COLA = { id: 'a-cola', titulo: 'Reiniciar la cola de impresión' }
const GUIA_DESBLOQUEAR = { id: 'a-desbloquear', titulo: 'Desbloquear usuario en Active Directory' }

const GUIAS: Articulo[] = [
  guia({
    id: 'a-conectar-red',
    categoriaId: 'cat-impresoras',
    titulo: 'Conectar una impresora de red en Windows',
    tipo: 'conexion',
    etiquetas: ['windows'],
    procedimiento: procedimiento({
      cuandoUsar:
        'Usar cuando un computador necesita imprimir en una impresora de red nueva o que perdió su configuración.',
      objetivo: 'El computador imprime en la impresora de red.',
      requisitos: ['Dirección IP de la impresora'],
      pasos: [
        paso('red-p1', 'Abrir Impresoras y escáneres', ['Abre Configuración > Dispositivos > Impresoras y escáneres']),
        paso('red-p2', 'Agregar la impresora por su IP', [
          'Pulsa "Agregar una impresora o un escáner"',
          'Elige "La impresora que deseo no está en la lista" y escribe la dirección IP',
        ]),
        paso('red-p3', 'Imprimir una página de prueba', [
          'Abre las propiedades de la impresora y pulsa "Imprimir página de prueba"',
        ]),
      ],
      formasBusqueda: ['agregar impresora al computador', 'instalar impresora en un pc'],
    }),
  }),
  guia({
    id: GUIA_COLA.id,
    categoriaId: 'cat-impresoras',
    titulo: GUIA_COLA.titulo,
    tipo: 'problema_frecuente',
    sintomas: ['No imprime nada', 'Los documentos se quedan en cola'],
    causas: ['El servicio Cola de impresión se detuvo', 'Un documento dañado bloquea la cola'],
    procedimiento: procedimiento({
      cuandoUsar: 'Usar cuando los documentos se quedan en cola y la impresora no saca nada.',
      objetivo: 'La cola queda vacía y la impresora vuelve a imprimir.',
      pasos: [
        paso('cola-p1', 'Detener el servicio', [
          'Abre Servicios (services.msc)',
          'Detén el servicio "Cola de impresión"',
        ]),
        paso('cola-p2', 'Vaciar la cola', ['Borra el contenido de C:\\Windows\\System32\\spool\\PRINTERS']),
        paso('cola-p3', 'Iniciar el servicio', [
          'Inicia de nuevo el servicio "Cola de impresión"',
          'Imprime una página de prueba',
        ]),
      ],
      formasBusqueda: ['documentos atascados en la cola', 'se quedó pegada la impresión'],
    }),
  }),
  guia({
    id: 'a-pdf',
    categoriaId: 'cat-impresoras',
    titulo: 'Imprimir un PDF que no sale en la impresora',
    tipo: 'problema_frecuente',
    sintomas: ['Word imprime pero el PDF no', 'El PDF se queda en cola y no sale'],
    causas: [
      'Controlador de la impresora desactualizado',
      'El PDF tiene fuentes o imágenes que la impresora no procesa',
    ],
    procedimiento: procedimiento({
      cuandoUsar: 'Usar cuando los documentos de Word salen bien y los PDF no.',
      pasos: [
        paso('pdf-p1', 'Imprimir como imagen', [
          'Abre el PDF en Adobe Acrobat Reader',
          'Ve a Imprimir > Avanzado y marca "Imprimir como imagen"',
        ]),
        paso('pdf-p2', 'Actualizar el controlador', ['Descarga el controlador del fabricante e instálalo']),
      ],
      formasBusqueda: ['no imprime el pdf', 'el pdf no sale'],
    }),
  }),
  guia({
    id: 'a-crear-usuario',
    categoriaId: 'cat-usuarios',
    titulo: 'Crear usuario en Active Directory',
    tipo: 'configuracion',
    etiquetas: ['active directory'],
    procedimiento: procedimiento({
      cuandoUsar: 'Usar cuando ingresa una persona nueva a la empresa y necesita cuenta de red y correo.',
      requisitos: ['Formato de ingreso firmado por Gestión Humana'],
      pasos: [
        paso('usu-p1', 'Abrir Usuarios y equipos', ['En el servidor, abre "Usuarios y equipos de Active Directory"']),
        paso('usu-p2', 'Crear la cuenta', [
          'Clic derecho en la unidad del área > Nuevo > Usuario',
          'Escribe nombre, apellido y el usuario con la inicial y el apellido',
        ]),
        paso('usu-p3', 'Asignar la contraseña temporal', [
          'Marca "El usuario debe cambiar la contraseña en el siguiente inicio de sesión"',
        ]),
        paso('usu-p4', 'Agregar a los grupos del área', ['Agrega la cuenta a los grupos de su área y al de correo']),
      ],
      formasBusqueda: ['usuario nuevo', 'cuenta para un empleado nuevo'],
    }),
  }),
  guia({
    id: GUIA_DESBLOQUEAR.id,
    categoriaId: 'cat-usuarios',
    titulo: GUIA_DESBLOQUEAR.titulo,
    tipo: 'configuracion',
    procedimiento: procedimiento({
      cuandoUsar: 'Usar cuando una cuenta queda bloqueada después de varios intentos fallidos de contraseña.',
      pasos: [
        paso('des-p1', 'Buscar la cuenta', [
          'En "Usuarios y equipos de Active Directory", busca al usuario por su nombre',
        ]),
        paso('des-p2', 'Desbloquear', [
          'Abre Propiedades > Cuenta y marca "Desbloquear la cuenta"',
          'Pide a la persona que vuelva a iniciar sesión',
        ]),
      ],
      formasBusqueda: ['cuenta bloqueada', 'no deja iniciar sesión'],
    }),
  }),
  guia({
    id: 'a-adjunto',
    categoriaId: 'cat-correo',
    titulo: 'Enviar archivos pesados por correo con OneDrive',
    tipo: 'configuracion',
    procedimiento: procedimiento({
      cuandoUsar: 'Usar cuando Outlook no deja adjuntar un archivo porque supera el tamaño permitido.',
      pasos: [
        paso('adj-p1', 'Subir el archivo a OneDrive', ['Abre OneDrive y sube el archivo a una carpeta']),
        paso('adj-p2', 'Compartir el enlace', [
          'Clic derecho > Compartir > Copiar vínculo',
          'Pega el vínculo en el correo',
        ]),
      ],
      // Las cuatro frases del ejemplo del encargo (fase 5).
      formasBusqueda: [
        'no me deja enviar archivo pesado',
        'archivo grande por correo',
        'no puedo adjuntar archivo',
        'mandar archivo pesado',
      ],
    }),
  }),
  guia({
    id: 'a-pst',
    categoriaId: 'cat-correo',
    titulo: 'Exportar el buzón de Outlook a un archivo PST',
    tipo: 'mantenimiento',
    procedimiento: procedimiento({
      cuandoUsar: 'Usar para guardar una copia de seguridad del correo antes de formatear o cambiar de computador.',
      pasos: [
        paso('pst-p1', 'Abrir Importar y exportar', [
          'En Outlook ve a Archivo > Abrir y exportar > Importar o exportar',
        ]),
        paso('pst-p2', 'Exportar a PST', [
          'Elige "Exportar a un archivo" > "Archivo de datos de Outlook (.pst)"',
          'Guarda el archivo en el disco externo',
        ]),
      ],
      formasBusqueda: ['sacar copia del correo', 'respaldar el correo'],
    }),
  }),
  guia({
    id: 'a-backup-srv',
    categoriaId: 'cat-servidores',
    titulo: 'Configurar el backup del servidor de archivos',
    tipo: 'configuracion',
    procedimiento: procedimiento({
      cuandoUsar: 'Usar para programar la copia nocturna de las carpetas compartidas.',
      pasos: [
        paso('bak-p1', 'Abrir Copias de seguridad de Windows Server', [
          'En el servidor de archivos, abre "Copias de seguridad de Windows Server"',
        ]),
        paso('bak-p2', 'Programar la copia', [
          'Elige "Programar copia de seguridad" y marca las carpetas compartidas',
          'Deja la hora en las 11:00 p. m.',
        ]),
      ],
    }),
  }),
  guia({
    id: 'a-ip-fija',
    categoriaId: 'cat-impresoras',
    titulo: 'Asignar IP fija a una impresora',
    tipo: 'configuracion',
    procedimiento: procedimiento({
      cuandoUsar: 'Usar cuando una impresora cambia de dirección y los computadores dejan de encontrarla.',
      pasos: [
        paso('ipf-p1', 'Entrar al panel de la impresora', ['Escribe la IP actual de la impresora en el navegador']),
        paso('ipf-p2', 'Fijar la dirección', [
          'En Red > TCP/IP cambia de DHCP a manual y escribe la IP reservada',
        ]),
      ],
    }),
  }),
  guia({
    id: 'a-toner',
    categoriaId: 'cat-impresoras',
    titulo: 'Cambiar el tóner de la impresora Ricoh',
    tipo: 'mantenimiento',
    dispositivosAfectados: [{ id: 'd-imp-mercadeo', nombre: 'Impresora Mercadeo' }],
    procedimiento: procedimiento({
      cuandoUsar: 'Usar cuando la impresora avisa tóner bajo o las hojas salen claras.',
      pasos: [
        paso('ton-p1', 'Abrir la tapa frontal', ['Abre la tapa frontal y gira la palanca del tóner']),
        paso('ton-p2', 'Cambiar el cartucho', ['Saca el cartucho vacío y pon el nuevo hasta que haga clic']),
      ],
    }),
  }),
  guia({
    id: 'a-ping-red',
    categoriaId: 'cat-redes',
    titulo: 'Diagnosticar la red con ping y tracert',
    tipo: 'problema_frecuente',
    sintomas: ['El equipo no tiene internet', 'La conexión se corta'],
    causas: ['Cable de red dañado', 'Puerta de enlace caída'],
    procedimiento: procedimiento({
      cuandoUsar: 'Usar cuando un equipo no tiene red o la conexión se corta.',
      pasos: [
        paso('png-p1', 'Probar la puerta de enlace', ['Abre una consola y ejecuta ping a la puerta de enlace']),
        paso('png-p2', 'Ver dónde se corta', [
          'Ejecuta tracert hacia el servidor para ver en qué salto se pierde',
        ]),
      ],
    }),
  }),
  // Un borrador nunca entra al índice oficial: está aquí para que el
  // banco lo tenga delante y no lo devuelva.
  guia({
    id: 'a-borrador-escaneo',
    categoriaId: 'cat-impresoras',
    titulo: 'Configurar escaneo a correo en la Ricoh',
    tipo: 'configuracion',
    estado: 'borrador',
    procedimiento: procedimiento({
      cuandoUsar: 'Usar cuando el área pide escanear directo a su correo.',
      pasos: [paso('esc-p1', 'Entrar al panel', ['Escribe la IP de la impresora en el navegador'])],
    }),
  }),
]

const GUIAS_CON_PREGUNTAS: Diagnostico[] = [
  {
    id: 'dg-imprime',
    categoriaId: 'cat-impresoras',
    titulo: 'La impresora no imprime',
    descripcion: 'Para cuando una impresora no saca las hojas o las deja en cola.',
    nodos: [
      pregunta('imp-n1', '¿La impresora está encendida y sin luces de error?', [
        { etiqueta: 'Sí', siguiente: 'imp-n2' },
        { etiqueta: 'No', final: 'Revisa el cable de energía y si hay papel atascado.' },
      ]),
      pregunta('imp-n2', '¿Los documentos se quedan en la cola?', [
        { etiqueta: 'Sí', articulo: GUIA_COLA },
        { etiqueta: 'No', final: 'Revisa el cable de red o la IP de la impresora.' },
      ]),
    ],
    ...MARCA,
  },
  {
    id: 'dg-sesion',
    categoriaId: 'cat-usuarios',
    titulo: 'El usuario no puede iniciar sesión',
    descripcion: 'Para cuando alguien no logra entrar a Windows o al correo.',
    nodos: [
      pregunta('ses-n1', '¿El mensaje dice que la cuenta está bloqueada?', [
        { etiqueta: 'Sí', articulo: GUIA_DESBLOQUEAR },
        { etiqueta: 'No', siguiente: 'ses-n2' },
      ]),
      pregunta('ses-n2', '¿La contraseña venció?', [
        { etiqueta: 'Sí', final: 'Restablece la contraseña desde Active Directory.' },
        { etiqueta: 'No', final: 'Escala a sistemas con la hora del intento.' },
      ]),
    ],
    ...MARCA,
  },
]

const FICHAS: Referencia[] = [
  ficha({
    id: 'r-dhcp',
    tipo: 'termino',
    titulo: 'DHCP',
    alias: ['asignación automática de IP'],
    categoria: 'Redes',
    definicion: 'Servicio que reparte direcciones IP automáticamente a los equipos que se conectan a la red.',
  }),
  ficha({
    id: 'r-ip',
    tipo: 'termino',
    titulo: 'Dirección IP',
    abreviatura: 'IP',
    categoria: 'Redes',
    definicion: 'Número que identifica a un equipo dentro de la red.',
  }),
  ficha({
    id: 'r-ping',
    tipo: 'comando',
    titulo: 'Comprobar si un equipo responde',
    valor: 'ping [dirección]',
    plataforma: 'Windows, macOS y Linux',
    categoria: 'Redes',
    cuandoUsar: 'Para comprobar si hay camino de red hasta un equipo.',
  }),
  ficha({
    id: 'r-ipconfig',
    tipo: 'comando',
    titulo: 'Ver la configuración de red del equipo',
    valor: 'ipconfig /all',
    plataforma: 'Windows',
    categoria: 'Redes',
    cuandoUsar: 'Para ver la IP, la puerta de enlace y los DNS del equipo.',
  }),
  ficha({
    id: 'r-ejecutar',
    tipo: 'atajo',
    titulo: 'Abrir la ventana Ejecutar',
    valor: 'Windows + R',
    plataforma: 'Windows',
    categoria: 'Windows',
    cuandoUsar: 'Abre la ventana Ejecutar para escribir comandos cortos como services.msc.',
  }),
  ficha({
    id: 'r-acrobat',
    tipo: 'herramienta',
    titulo: 'Adobe Acrobat Reader',
    categoria: 'Ofimática',
    proveedor: 'Adobe',
    definicion: 'Programa para abrir, imprimir y firmar archivos PDF.',
  }),
  ficha({
    id: 'r-outlook',
    tipo: 'herramienta',
    titulo: 'Microsoft Outlook',
    categoria: 'Ofimática',
    proveedor: 'Microsoft',
    definicion: 'Cliente de correo y calendario del equipo.',
  }),
]

/** Marcas que hacen de "valor cifrado": nunca pueden aparecer en lo que se pinta. */
export const SECRETOS_BENCHMARK = ['cifrado-srv-admin', 'cifrado-ad-admin', 'cifrado-pos', 'cifrado-wifi', 'cifrado-clave-ricoh']

const CREDENCIALES: Credencial[] = [
  credencial({
    id: 'c-srv-admin',
    titulo: 'Administrador del servidor de facturación',
    categoria: 'Servidores',
    datosCifrados: 'cifrado-srv-admin',
    dispositivos: [{ id: 'd-srv-facturacion', nombre: 'Servidor de facturación' }],
  }),
  credencial({
    id: 'c-ad-admin',
    titulo: 'Usuario administrador de Active Directory',
    categoria: 'Directorio activo',
    datosCifrados: 'cifrado-ad-admin',
  }),
  credencial({ id: 'c-pos', titulo: 'Administrador POS', categoria: 'Punto de venta', datosCifrados: 'cifrado-pos' }),
  credencial({
    id: 'c-wifi',
    titulo: 'Clave wifi invitados',
    categoria: 'Redes',
    tipo: 'red',
    datosCifrados: 'cifrado-wifi',
  }),
]

const DATOS_PROTEGIDOS: CampoProtegido[] = [
  {
    id: 'cp-imp-mercadeo',
    dispositivoId: 'd-imp-mercadeo',
    nombre: 'Clave de administrador',
    tipo: 'contrasena',
    valorCifrado: 'cifrado-clave-ricoh',
    orden: 0,
    venceEn: null,
    ...MARCA,
  },
]

/** Los datos del banco, tal como los recibiría el índice de la app. */
export function datosBenchmark(bovedaDesbloqueada: boolean): DatosIndice {
  return {
    articulos: GUIAS,
    dispositivos: EQUIPOS,
    categorias: CATEGORIAS,
    ubicaciones: UBICACIONES,
    personas: PERSONAS,
    referencias: FICHAS,
    credenciales: CREDENCIALES,
    diagnosticos: GUIAS_CON_PREGUNTAS,
    adjuntos: [],
    camposProtegidos: DATOS_PROTEGIDOS,
    bovedaDesbloqueada,
  }
}

// ----------------------------------------------------------------
// Los casos
// ----------------------------------------------------------------

/** "Mejor coincidencia" (alta) o "Mejores resultados" (cercana). */
export type Confianza = 'alta' | 'cercana'

export interface CasoBenchmark {
  id: string
  consulta: string
  /** Qué pide la consulta, en palabras del técnico. */
  pide: string
  /** Intenciones que tienen que detectarse (todas). Vacío: ninguna exigida. */
  intenciones: Intencion[]
  /** Intenciones que NO pueden detectarse. */
  sinIntenciones?: Intencion[]
  /**
   * Consulta deliberadamente ambigua: no se fuerza ninguna intención y no
   * recibe "Mejor coincidencia" (no se finge certeza).
   */
  ambigua?: boolean
  /**
   * Lo que tiene que quedar PRIMERO en "Mejores resultados" cuando la
   * consulta es suficientemente clara: uno de estos ids o de estos tipos.
   */
  primero?: { ids?: string[]; tipos?: TipoResultado[] }
  /** Resultados que tienen que seguir dentro de "Mejores resultados". */
  secundarios?: string[]
  /** Cada grupo de tipos tiene que tener al menos un resultado en "Mejores resultados". */
  clases?: TipoResultado[][]
  /** Certeza que se espera; sin valor, no se exige ninguna. */
  confianza?: Confianza
  /** Bóveda abierta en este caso (por defecto, cerrada). */
  bovedaAbierta?: boolean
  /** Peso del puente a la Bóveda cerrada (solo con la Bóveda cerrada). */
  puente?: ProminenciaPuente
}

const GUIA_O_PREGUNTAS: TipoResultado[] = ['articulo', 'diagnostico']

export const CASOS_BENCHMARK: CasoBenchmark[] = [
  {
    id: 'impresora',
    consulta: 'impresora',
    pide: 'Ambigua: un equipo, una guía o la categoría.',
    intenciones: [],
    ambigua: true,
    clases: [GUIA_O_PREGUNTAS, ['dispositivo']],
    confianza: 'cercana',
  },
  {
    id: 'impresora-mercadeo',
    consulta: 'impresora mercadeo',
    pide: 'Un equipo: Mercadeo es su nombre y su ubicación. Las guías relacionadas pueden ir después.',
    intenciones: ['equipo'],
    sinIntenciones: ['problema', 'procedimiento'],
    primero: { ids: ['dispositivo:d-imp-mercadeo'] },
    confianza: 'alta',
  },
  {
    id: 'impresora-caja-2',
    consulta: 'impresora caja 2',
    pide: 'El equipo de la caja 2, no el de la caja 1.',
    intenciones: ['equipo'],
    primero: { ids: ['dispositivo:d-imp-caja2'] },
    confianza: 'alta',
  },
  {
    id: 'no-imprime',
    consulta: 'la impresora no imprime',
    pide: 'Resolver un problema: una guía o una guía con preguntas, no un equipo que solo dice "impresora".',
    intenciones: ['problema'],
    sinIntenciones: ['equipo'],
    primero: { tipos: GUIA_O_PREGUNTAS },
  },
  {
    id: 'mercadeo-no-imprime',
    consulta: 'la impresora de mercadeo no imprime',
    pide: 'Problema + equipo: la solución muy arriba y el equipo de Mercadeo también.',
    intenciones: ['problema', 'equipo'],
    primero: { tipos: GUIA_O_PREGUNTAS },
    secundarios: ['dispositivo:d-imp-mercadeo'],
  },
  {
    id: 'word-pdf',
    consulta: 'word imprime pero pdf no',
    pide: 'Un problema descrito por su síntoma.',
    intenciones: ['problema'],
    primero: { ids: ['articulo:a-pdf'] },
  },
  {
    id: 'no-imprime-pdf',
    consulta: 'no imprime el pdf',
    pide: 'El ejemplo de la ayuda de Resolver: el problema del PDF.',
    intenciones: ['problema'],
    primero: { ids: ['articulo:a-pdf'] },
  },
  {
    id: 'ip-impresora-mercadeo',
    consulta: 'ip impresora mercadeo',
    pide: 'Un dato de ese equipo (su IP): el equipo arriba.',
    intenciones: ['equipo'],
    primero: { ids: ['dispositivo:d-imp-mercadeo'] },
  },
  {
    id: 'ip-sola',
    consulta: '10.10.6.8',
    pide: 'El equipo que tiene esa IP.',
    intenciones: ['equipo'],
    primero: { ids: ['dispositivo:d-imp-mercadeo'] },
    confianza: 'alta',
  },
  {
    id: 'crear-usuario',
    consulta: 'crear usuario nuevo',
    pide: 'Un procedimiento, no un acceso.',
    intenciones: ['procedimiento'],
    sinIntenciones: ['acceso', 'problema'],
    primero: { ids: ['articulo:a-crear-usuario'] },
  },
  {
    id: 'crear-usuario-boveda',
    consulta: 'crear usuario nuevo',
    pide: 'Procedimiento contra credencial: con la Bóveda abierta, la guía sigue primero.',
    intenciones: ['procedimiento'],
    sinIntenciones: ['acceso', 'problema'],
    primero: { ids: ['articulo:a-crear-usuario'] },
    bovedaAbierta: true,
  },
  {
    id: 'persona-nueva',
    consulta: 'llegó una persona nueva',
    pide: 'Sin palabra de intención: la guía cuyo "cuándo usar" lo describe, no las fichas de persona.',
    intenciones: [],
    primero: { ids: ['articulo:a-crear-usuario'] },
  },
  {
    id: 'usuario-bloqueado',
    consulta: 'usuario bloqueado',
    pide: 'Resolver un problema (no un procedimiento a secas).',
    intenciones: ['problema'],
    sinIntenciones: ['procedimiento'],
    primero: { ids: ['articulo:a-desbloquear', 'diagnostico:dg-sesion'] },
  },
  {
    id: 'usuario-bloqueado-boveda',
    consulta: 'usuario bloqueado',
    pide: 'El mismo problema con la Bóveda abierta: un acceso no le gana a la solución.',
    intenciones: ['problema'],
    sinIntenciones: ['procedimiento'],
    primero: { ids: ['articulo:a-desbloquear', 'diagnostico:dg-sesion'] },
    bovedaAbierta: true,
  },
  {
    id: 'varios-intentos',
    consulta: 'no puede entrar después de varios intentos',
    pide: 'Un problema contado con sus palabras: la cuenta bloqueada.',
    intenciones: ['problema'],
    primero: { ids: ['articulo:a-desbloquear', 'diagnostico:dg-sesion'] },
  },
  {
    id: 'archivo-pesado',
    consulta: 'no me deja enviar archivo pesado',
    pide: 'Un problema que la guía de OneDrive resuelve.',
    intenciones: ['problema'],
    primero: { ids: ['articulo:a-adjunto'] },
  },
  {
    id: 'archivo-grande',
    consulta: 'archivo grande por correo',
    pide: 'Sin palabra de intención: la guía que se busca así.',
    intenciones: [],
    primero: { ids: ['articulo:a-adjunto'] },
  },
  {
    id: 'backup-correo',
    consulta: 'poner backup del correo',
    pide: 'Un procedimiento: respaldar el correo (no el servidor).',
    intenciones: ['procedimiento'],
    primero: { ids: ['articulo:a-pst'] },
  },
  {
    id: 'que-es-dhcp',
    consulta: 'qué es DHCP',
    pide: 'Información: el término del glosario.',
    intenciones: ['glosario'],
    primero: { ids: ['referencia:r-dhcp'] },
    confianza: 'alta',
  },
  {
    id: 'ping',
    consulta: 'ping',
    pide: 'Un comando. La guía que lo usa puede quedar debajo.',
    intenciones: ['consola'],
    primero: { ids: ['referencia:r-ping'] },
    secundarios: ['articulo:a-ping-red'],
  },
  {
    id: 'windows-r',
    consulta: 'windows r',
    pide: 'Un atajo de teclado.',
    intenciones: ['consola'],
    primero: { ids: ['referencia:r-ejecutar'] },
    confianza: 'alta',
  },
  {
    id: 'clave-mercadeo-cerrada',
    consulta: 'clave impresora mercadeo',
    pide: 'Acceso + equipo, con la Bóveda cerrada: el equipo arriba y el puente a la Bóveda destacado.',
    intenciones: ['acceso', 'equipo'],
    primero: { ids: ['dispositivo:d-imp-mercadeo'] },
    puente: 'destacado',
  },
  {
    id: 'clave-mercadeo-abierta',
    consulta: 'clave impresora mercadeo',
    pide: 'Acceso + equipo, con la Bóveda abierta: el dato protegido del equipo y el equipo.',
    intenciones: ['acceso', 'equipo'],
    primero: { ids: ['campo:cp-imp-mercadeo'] },
    secundarios: ['dispositivo:d-imp-mercadeo'],
    bovedaAbierta: true,
  },
  {
    id: 'admin-servidor-abierta',
    consulta: 'usuario administrador servidor',
    pide: 'Un acceso, con la Bóveda abierta: una credencial primero.',
    intenciones: ['acceso'],
    sinIntenciones: ['procedimiento', 'problema'],
    primero: { tipos: ['credencial'] },
    bovedaAbierta: true,
  },
  {
    id: 'admin-servidor-cerrada',
    consulta: 'usuario administrador servidor',
    pide: 'El mismo acceso con la Bóveda cerrada: el puente se queda destacado.',
    intenciones: ['acceso'],
    sinIntenciones: ['procedimiento', 'problema'],
    puente: 'destacado',
  },
  {
    id: 'pc-contabilidad',
    consulta: 'pc contabilidad',
    pide: 'Un equipo por su ubicación (su nombre no dice Contabilidad).',
    intenciones: ['equipo'],
    primero: { ids: ['dispositivo:d-pc-contabilidad'] },
  },
  {
    id: 'servidor-facturacion',
    consulta: 'servidor facturación',
    pide: 'Un equipo por su nombre.',
    intenciones: ['equipo'],
    primero: { ids: ['dispositivo:d-srv-facturacion'] },
  },
  {
    id: 'ricoh-mp-501',
    consulta: 'ricoh mp 501',
    pide: 'Un equipo por marca y modelo; la guía de esa marca puede ir debajo.',
    intenciones: ['equipo'],
    primero: { ids: ['dispositivo:d-imp-mercadeo'] },
    secundarios: ['articulo:a-toner'],
  },
  {
    id: 'serial',
    consulta: 'serial ABC123',
    pide: 'Un equipo por su serial.',
    intenciones: ['equipo'],
    primero: { ids: ['dispositivo:d-lector-taquilla'] },
    confianza: 'alta',
  },
  {
    id: 'placa',
    consulta: 'placa 456',
    pide: 'Un equipo por su placa de inventario.',
    intenciones: ['equipo'],
    primero: { ids: ['dispositivo:d-ups-sistemas'] },
    confianza: 'alta',
  },
  {
    id: 'conectar-impresora-red',
    consulta: 'conectar impresora de red',
    pide: 'Procedimiento contra equipo: la guía, no una impresora del inventario.',
    intenciones: ['procedimiento'],
    sinIntenciones: ['equipo'],
    primero: { ids: ['articulo:a-conectar-red'] },
  },
  {
    id: 'errata',
    consulta: 'impresora mercadep',
    pide: 'Con una errata, el mismo equipo (búsqueda difusa).',
    intenciones: ['equipo'],
    primero: { ids: ['dispositivo:d-imp-mercadeo'] },
  },
  {
    id: 'titulo-exacto',
    consulta: 'reiniciar la cola de impresión',
    pide: 'El título exacto de una guía.',
    intenciones: ['procedimiento'],
    primero: { ids: ['articulo:a-cola'] },
    confianza: 'alta',
  },
  {
    id: 'sinonimo',
    consulta: 'respaldo del servidor',
    pide: 'Por sinónimo: "respaldo" es el backup del servidor.',
    intenciones: [],
    primero: { ids: ['articulo:a-backup-srv'] },
  },
  {
    id: 'correo',
    consulta: 'correo',
    pide: 'Ambigua: guías de correo, la herramienta o la categoría.',
    intenciones: [],
    ambigua: true,
    confianza: 'cercana',
  },
]

// ----------------------------------------------------------------
// La evaluación
// ----------------------------------------------------------------

/**
 * El buscador que se mide. El banco no importa el ranking directamente:
 * recibe sus piezas, para medir con la MISMA vara el buscador de antes y
 * el de después.
 */
export interface Pipeline {
  buscar: (indice: MiniSearch<DocumentoBusqueda>, consulta: string) => ResultadoBusqueda[]
  /** "Mejores resultados" a partir de lo que devolvió `buscar` y la consulta normalizada. */
  mejores: (resultados: ResultadoBusqueda[], consulta: string) => ResultadoBusqueda[]
  intenciones: (consulta: string, resultados: ResultadoBusqueda[]) => Intencion[]
  /** Lo que la interfaz diría: "Mejor coincidencia" o "Mejores resultados". */
  confianza: (resultados: ResultadoBusqueda[], consulta: string) => Confianza
}

export interface Criterio {
  nombre: 'intenciones' | 'ambigua' | 'primero' | 'contexto' | 'clases' | 'confianza' | 'puente' | 'boveda'
  ok: boolean
  detalle: string
}

export interface Veredicto {
  caso: CasoBenchmark
  ok: boolean
  criterios: Criterio[]
  intenciones: Intencion[]
  confianza: Confianza
  /** Ids de "Mejores resultados", en orden. */
  mejores: string[]
  /** Sus títulos, para leer el informe sin traducir ids. */
  titulos: string[]
}

function evaluarCaso(
  caso: CasoBenchmark,
  indice: MiniSearch<DocumentoBusqueda>,
  pipeline: Pipeline,
): Veredicto {
  const resultados = pipeline.buscar(indice, caso.consulta)
  // La interfaz normaliza la consulta antes de pedir los mejores
  // (`ResultadosBusqueda` recibe `normalizarTexto(consultaCruda)`).
  const consulta = normalizarTexto(caso.consulta.trim())
  const mejores = pipeline.mejores(resultados, consulta)
  const intenciones = pipeline.intenciones(caso.consulta, resultados)
  const confianza = pipeline.confianza(resultados, consulta)
  const ids = mejores.map((r) => r.id)
  const criterios: Criterio[] = []

  const faltan = caso.intenciones.filter((i) => !intenciones.includes(i))
  const sobran = (caso.sinIntenciones ?? []).filter((i) => intenciones.includes(i))
  if (caso.intenciones.length > 0 || (caso.sinIntenciones ?? []).length > 0) {
    criterios.push({
      nombre: 'intenciones',
      ok: faltan.length === 0 && sobran.length === 0,
      detalle:
        faltan.length || sobran.length
          ? [faltan.length ? `faltan ${faltan.join(', ')}` : '', sobran.length ? `sobran ${sobran.join(', ')}` : '']
              .filter(Boolean)
              .join('; ')
          : `detecta ${intenciones.join(', ') || 'ninguna'}`,
    })
  }

  if (caso.ambigua) {
    criterios.push({
      nombre: 'ambigua',
      ok: intenciones.length === 0,
      detalle: intenciones.length === 0 ? 'ninguna intención forzada' : `fuerza ${intenciones.join(', ')}`,
    })
  }

  if (caso.primero) {
    const primero = mejores[0]
    const ok =
      primero !== undefined &&
      ((caso.primero.ids?.includes(primero.id) ?? false) || (caso.primero.tipos?.includes(primero.tipo) ?? false))
    criterios.push({
      nombre: 'primero',
      ok,
      detalle: primero ? `${primero.id} (${primero.tipo})` : 'sin resultados',
    })
  }

  if (caso.secundarios) {
    const ausentes = caso.secundarios.filter((id) => !ids.includes(id))
    criterios.push({
      nombre: 'contexto',
      ok: ausentes.length === 0,
      detalle: ausentes.length === 0 ? 'se conserva' : `falta ${ausentes.join(', ')}`,
    })
  }

  if (caso.clases) {
    const vacias = caso.clases.filter((clase) => !mejores.some((r) => clase.includes(r.tipo)))
    criterios.push({
      nombre: 'clases',
      ok: vacias.length === 0,
      detalle: vacias.length === 0 ? 'clases mezcladas' : `sin ${vacias.map((c) => c.join('/')).join(', ')}`,
    })
  }

  if (caso.confianza) {
    criterios.push({
      nombre: 'confianza',
      ok: confianza === caso.confianza,
      detalle: confianza === 'alta' ? 'Mejor coincidencia' : 'Mejores resultados',
    })
  } else if (caso.ambigua) {
    // Una ambigua nunca recibe certeza, aunque el caso no lo diga aparte.
    criterios.push({
      nombre: 'confianza',
      ok: confianza !== 'alta',
      detalle: confianza === 'alta' ? 'Mejor coincidencia (falsa certeza)' : 'Mejores resultados',
    })
  }

  if (caso.puente) {
    const prominencia = prominenciaPuenteBoveda(resultados, caso.consulta)
    criterios.push({ nombre: 'puente', ok: prominencia === caso.puente, detalle: prominencia })
  }

  // LA BÓVEDA, SIEMPRE. Cerrada, nada suyo llega a la lista; abierta,
  // nunca el valor cifrado.
  const pintado = JSON.stringify(resultados)
  const filtraSecreto = SECRETOS_BENCHMARK.some((secreto) => pintado.includes(secreto))
  const bovedaEnLista = resultados.some((r) => r.tipo === 'credencial' || r.id.startsWith('campo:'))
  const bovedaOk = !filtraSecreto && (caso.bovedaAbierta || !bovedaEnLista)
  criterios.push({
    nombre: 'boveda',
    ok: bovedaOk,
    detalle: filtraSecreto ? 'se filtró un valor cifrado' : bovedaEnLista && !caso.bovedaAbierta ? 'apareció la Bóveda cerrada' : 'respetada',
  })

  return {
    caso,
    ok: criterios.every((c) => c.ok),
    criterios,
    intenciones,
    confianza,
    mejores: ids,
    titulos: mejores.map((r) => r.titulo),
  }
}

/** Ejecuta el banco completo contra un buscador. */
export function ejecutarBenchmark(pipeline: Pipeline, casos: CasoBenchmark[] = CASOS_BENCHMARK): Veredicto[] {
  const indiceCerrada = crearIndiceDesdeDocumentos(documentosDeBusqueda(datosBenchmark(false)))
  const indiceAbierta = crearIndiceDesdeDocumentos(documentosDeBusqueda(datosBenchmark(true)))
  return casos.map((caso) => evaluarCaso(caso, caso.bovedaAbierta ? indiceAbierta : indiceCerrada, pipeline))
}

/**
 * El informe en Markdown: una fila por caso y el resumen. Con `detalle`,
 * una columna más con los títulos de "Mejores resultados", en orden.
 */
export function informeBenchmark(veredictos: Veredicto[], titulo: string, detalle = false): string {
  const filas = veredictos.map((v) => {
    const fallos = v.criterios.filter((c) => !c.ok)
    const estado = v.ok ? 'OK' : `FALLA: ${fallos.map((c) => `${c.nombre} (${c.detalle})`).join('; ')}`
    const consulta = v.caso.bovedaAbierta ? `${v.caso.consulta} (Bóveda abierta)` : v.caso.consulta
    const rotulo = v.confianza === 'alta' ? 'Mejor coincidencia' : 'Mejores resultados'
    const columnas = [consulta, v.intenciones.join(', ') || 'ninguna', v.mejores[0] ?? 'nada', rotulo, estado]
    if (detalle) columnas.push(v.titulos.join(' / '))
    return `| ${columnas.join(' | ')} |`
  })
  const bien = veredictos.filter((v) => v.ok).length
  return [
    `### ${titulo}: ${bien} de ${veredictos.length} casos cumplen`,
    '',
    `| Consulta | Intenciones | Primero | Rótulo | Resultado |${detalle ? ' Mejores resultados |' : ''}`,
    `|---|---|---|---|---|${detalle ? '---|' : ''}`,
    ...filas,
  ].join('\n')
}
