import type { Articulo, Credencial, Dispositivo, Persona } from '../lib/db'
import type { DatosIndice } from '../features/busqueda/useIndiceBusqueda'

// DATOS INVENTADOS PARA LAS PRUEBAS DE LA COINCIDENCIA APROXIMADA (tarea
// 346). Ninguno es real: nombres, IP, seriales y placas son de ejemplo. Los
// comparten las pruebas de Resolver (índice global) y de Equipos
// (`buscarEquipos`), para que las dos pantallas se prueben con lo mismo.
//
// Lo que cada dato pone a prueba:
// - "Daniel García" (con tilde) es la coincidencia EXACTA de "daniel garcia";
//   "Daniel Gracia" y "Daniela Gracia", las aproximadas (letras cambiadas de
//   sitio en el apellido), y "Daniel Pérez", la que solo comparte el nombre.
// - "José Ramírez" se encuentra escribiendo "jose", sin tilde.
// - La guía "La impresora no imprime" se encuentra con "no impirme".
// - Dos equipos con IP y serial casi iguales: escribir uno no trae el otro.
// - "Portátil Sistemas" tiene un responsable ESCRITO por validar ("Jose
//   Ramirez"), no una persona vinculada.
// - "PC Contabilidad 02" está vinculado a Daniel Pérez y guarda una copia
//   vieja de su nombre: se busca por el nombre VIGENTE de la persona.

const MARCA = { updatedAt: '2026-10-20T00:00:00.000Z', updatedBy: null, eliminadoEn: null }

export function persona(id: string, nombre: string, cambios: Partial<Persona> = {}): Persona {
  return {
    id,
    nombre,
    area: '',
    notas: '',
    estado: 'activa',
    fechaIngreso: null,
    fechaRetiro: null,
    motivoRetiro: '',
    ...MARCA,
    ...cambios,
  }
}

export function equipo(id: string, nombre: string, cambios: Partial<Dispositivo> = {}): Dispositivo {
  return {
    id,
    categoriaId: 'cat-impresoras',
    nombre,
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
    estado: 'operativo',
    observaciones: '',
    detalles: {},
    foto: null,
    ...MARCA,
    ...cambios,
  }
}

export function guia(id: string, titulo: string, cambios: Partial<Articulo> = {}): Articulo {
  return {
    id,
    categoriaId: 'cat-impresoras',
    titulo,
    tipo: 'problema_frecuente',
    contenido: '',
    etiquetas: [],
    procedimiento: null,
    sintomas: [],
    causas: [],
    dispositivosAfectados: [],
    estado: 'publicado',
    ...MARCA,
    ...cambios,
  } as unknown as Articulo
}

export function credencial(id: string, titulo: string, cambios: Partial<Credencial> = {}): Credencial {
  return {
    id,
    titulo,
    categoria: 'Ejemplo',
    tipo: 'cuenta',
    datosCifrados: 'CIFRADO-DE-PRUEBA-NO-DEBE-SALIR',
    venceEn: null,
    dispositivos: [],
    archivo: null,
    ...MARCA,
    ...cambios,
  } as Credencial
}

export const PERSONAS: Persona[] = [
  persona('p-daniel-garcia', 'Daniel García', { area: 'Tesorería' }),
  persona('p-daniel-gracia', 'Daniel Gracia', { area: 'Contabilidad' }),
  persona('p-daniela-gracia', 'Daniela Gracia', { area: 'Mercadeo' }),
  persona('p-daniel-perez', 'Daniel Pérez', { area: 'Sistemas' }),
  persona('p-jose-ramirez', 'José Ramírez', { area: 'Taquilla' }),
  persona('p-ana-garcia', 'Ana García', { area: 'Compras' }),
]

export const EQUIPOS: Dispositivo[] = [
  equipo('eq-imp-mercadeo', 'Impresora Mercadeo', {
    marca: 'Epson',
    modelo: 'L3250',
    ip: '10.10.6.8',
    serial: 'XK7Q2291',
    placaInventario: 'MP-00123',
    ubicacion: 'Mercadeo',
    responsableId: 'p-daniela-gracia',
    responsable: 'Daniela Gracia',
  }),
  equipo('eq-imp-bodega', 'Impresora Bodega', {
    marca: 'Zebra',
    ip: '10.10.6.80',
    serial: 'XK7Q2292',
    placaInventario: 'MP-00124',
    ubicacion: 'Bodega',
    responsableId: 'p-daniel-gracia',
    responsable: 'Daniel Gracia',
  }),
  equipo('eq-pc-tesoreria', 'PC Tesorería', {
    categoriaId: 'cat-pc',
    ip: '10.10.7.4',
    responsableId: 'p-daniel-garcia',
    responsable: 'Daniel García',
  }),
  equipo('eq-pc-contabilidad', 'PC Contabilidad 02', {
    categoriaId: 'cat-pc',
    ip: '10.10.7.12',
    responsableId: 'p-daniel-perez',
    // La copia legible quedó con un nombre viejo: manda el de la persona.
    responsable: 'Dani P.',
  }),
  equipo('eq-portatil-sistemas', 'Portátil Sistemas', {
    categoriaId: 'cat-pc',
    // Escrito a mano y sin ficha de persona: por validar.
    responsable: 'Jose Ramirez',
  }),
  equipo('eq-sw-central', 'SW-CENTRAL-02', { categoriaId: 'cat-switches', ip: '10.10.0.2', ubicacion: 'Rack principal' }),
]

/** La categoría de red de estos datos (`idsRed` de Equipos). */
export const CATEGORIAS_RED: ReadonlySet<string> = new Set(['cat-switches'])

export const GUIAS: Articulo[] = [
  guia('g-no-imprime', 'La impresora no imprime', {
    sintomas: ['no imprime', 'la cola de impresión se queda detenida'],
  }),
  guia('g-instalar-red', 'Instalar una impresora de red', { tipo: 'instalacion' }),
  guia('g-toner', 'Cambiar el tóner de la impresora', { tipo: 'mantenimiento' }),
]

export const CREDENCIALES: Credencial[] = [
  credencial('c-acceso-mercadeo', 'Acceso Mercadeo', {
    dispositivos: [{ id: 'eq-imp-mercadeo', nombre: 'Impresora Mercadeo' }],
  } as Partial<Credencial>),
]

/** Todo lo de arriba como datos del índice global de Resolver. */
export function datosDelIndice(cambios: Partial<DatosIndice> = {}): DatosIndice {
  return {
    articulos: GUIAS,
    dispositivos: EQUIPOS,
    categorias: [
      { id: 'cat-impresoras', nombre: 'Impresoras', icono: '', orden: 1, ...MARCA },
      { id: 'cat-pc', nombre: 'Computadores', icono: '', orden: 2, ...MARCA },
      { id: 'cat-switches', nombre: 'Switches', icono: '', orden: 3, ...MARCA },
    ] as DatosIndice['categorias'],
    ubicaciones: [],
    personas: PERSONAS,
    referencias: [],
    credenciales: CREDENCIALES,
    diagnosticos: [],
    adjuntos: [],
    camposProtegidos: [],
    bovedaDesbloqueada: false,
    ...cambios,
  }
}
