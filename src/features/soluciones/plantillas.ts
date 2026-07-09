import type { PasoProcedimiento, TipoArticulo } from '../../lib/db'
import { crearBloqueTarea, crearPaso } from '../../lib/procedimiento'

// Plantillas inteligentes (fase S1): la estructura recomendada para
// cada tipo de documento. Al crear un articulo nuevo con el
// formulario vacio, se ofrece precargarla; el tecnico solo edita los
// textos en vez de organizar la estructura desde cero. Son datos, no
// componentes: ajustar una plantilla es editar este archivo.

interface PlantillaPaso {
  titulo: string
  objetivo: string
  tareas: string[]
}

export interface Plantilla {
  requisitos: string[]
  pasos: PlantillaPaso[]
  verificacionFinal: string[]
  // Solo el tipo manual: esqueleto de contenido en Markdown en vez de
  // pasos (los manuales no son procedimientos paso a paso).
  contenido: string
}

const VACIA: Plantilla = { requisitos: [], pasos: [], verificacionFinal: [], contenido: '' }

const PLANTILLAS: Record<TipoArticulo, Plantilla> = {
  instalacion: {
    ...VACIA,
    requisitos: ['Permisos de administrador', 'Instalador o medio de instalación', 'Acceso a la red'],
    pasos: [
      {
        titulo: 'Preparar el equipo',
        objetivo: 'El equipo queda listo para la instalación',
        tareas: ['Verificar los requisitos previos', 'Respaldar la información si aplica'],
      },
      {
        titulo: 'Instalar',
        objetivo: 'El software o equipo queda instalado',
        tareas: ['Ejecutar la instalación', 'Seguir el asistente hasta finalizar'],
      },
      {
        titulo: 'Configurar y probar',
        objetivo: 'Queda funcionando y listo para usar',
        tareas: ['Aplicar la configuración inicial', 'Hacer una prueba de funcionamiento'],
      },
    ],
    verificacionFinal: ['La instalación funciona correctamente', 'El usuario puede trabajar con normalidad'],
  },
  configuracion: {
    ...VACIA,
    requisitos: ['Acceso al equipo o sistema', 'Credenciales necesarias (vincúlalas desde la bóveda)'],
    pasos: [
      {
        titulo: 'Respaldar la configuración actual',
        objetivo: 'Se puede volver atrás si algo falla',
        tareas: ['Anotar o exportar los valores actuales'],
      },
      {
        titulo: 'Aplicar los cambios',
        objetivo: 'La nueva configuración queda aplicada',
        tareas: ['Modificar los parámetros necesarios'],
      },
      {
        titulo: 'Validar',
        objetivo: 'El cambio quedó funcionando',
        tareas: ['Comprobar que el cambio quedó aplicado', 'Probar el funcionamiento'],
      },
    ],
    verificacionFinal: ['El sistema funciona con la nueva configuración'],
  },
  conexion: {
    ...VACIA,
    pasos: [
      {
        titulo: 'Identificar los puntos de conexión',
        objetivo: 'Se sabe qué va conectado a qué',
        tareas: ['Ubicar el equipo y el punto de red o puerto'],
      },
      {
        titulo: 'Conectar',
        objetivo: 'La conexión queda establecida',
        tareas: ['Realizar la conexión física o lógica'],
      },
      {
        titulo: 'Probar la conexión',
        objetivo: 'La conexión responde',
        tareas: ['Verificar que el equipo responde (ping o prueba de uso)'],
      },
    ],
    verificacionFinal: ['La conexión quedó estable y funcionando'],
  },
  problema_frecuente: {
    ...VACIA,
    pasos: [
      {
        titulo: 'Diagnosticar',
        objetivo: 'Se identifica la causa del problema',
        tareas: ['Confirmar los síntomas del problema', 'Identificar la causa'],
      },
      {
        titulo: 'Aplicar la solución',
        objetivo: 'El problema queda corregido',
        tareas: ['Ejecutar la corrección'],
      },
      {
        titulo: 'Validar',
        objetivo: 'Se confirma que el problema no se repite',
        tareas: ['Probar el funcionamiento con el usuario'],
      },
    ],
    verificacionFinal: ['El problema quedó resuelto y validado con el usuario'],
  },
  mantenimiento: {
    ...VACIA,
    requisitos: ['Ventana de mantenimiento acordada'],
    pasos: [
      {
        titulo: 'Preparar',
        objetivo: 'Todo listo para intervenir sin sorpresas',
        tareas: ['Avisar a los usuarios afectados', 'Respaldar la información si aplica'],
      },
      {
        titulo: 'Ejecutar el mantenimiento',
        objetivo: 'Las tareas de mantenimiento quedan hechas',
        tareas: ['Realizar las tareas de mantenimiento'],
      },
      {
        titulo: 'Pruebas y cierre',
        objetivo: 'Todo queda operativo y documentado',
        tareas: ['Probar el funcionamiento', 'Registrar la intervención en la ficha del equipo'],
      },
    ],
    verificacionFinal: ['Todo quedó operativo tras el mantenimiento'],
  },
  manual: {
    ...VACIA,
    contenido: ['# Objetivo', '', '# Alcance', '', '# Contenido', '', '## Sección 1', '', '## Sección 2', '', '# Recursos', ''].join('\n'),
  },
}

export function plantillaDe(tipo: TipoArticulo): Plantilla {
  return PLANTILLAS[tipo] ?? VACIA
}

// ¿La plantilla aporta algo para este tipo? (el formulario solo la
// ofrece cuando hay estructura que precargar).
export function hayPlantilla(tipo: TipoArticulo): boolean {
  const plantilla = plantillaDe(tipo)
  return plantilla.pasos.length > 0 || plantilla.contenido !== ''
}

// Construye los pasos reales de la plantilla (con ids nuevos): cada
// texto de tarea se convierte en un bloque con casilla.
export function pasosDePlantilla(plantilla: Plantilla): PasoProcedimiento[] {
  return plantilla.pasos.map((pasoPlantilla) => {
    const paso = crearPaso()
    paso.titulo = pasoPlantilla.titulo
    paso.objetivo = pasoPlantilla.objetivo
    paso.bloques = pasoPlantilla.tareas.map((textoTarea) => {
      const bloque = crearBloqueTarea()
      bloque.texto = textoTarea
      return bloque
    })
    return paso
  })
}
