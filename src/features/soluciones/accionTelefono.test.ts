import { describe, expect, it } from 'vitest'
import type { BloquePaso, PasoAdjunto, Referencia, ResultadoVisual } from '../../lib/db'
import { CAMPOS_BLOQUE_VACIOS } from '../../lib/procedimiento'
import {
  claseTamanoInstruccion,
  esImagen,
  etiquetaTenAMano,
  lineaDeLaAccion,
  motivoGuiasDeLaAccion,
  partesDeLaLinea,
  pieDeLaAccion,
  rotuloListo,
  seccionesDeAyuda,
  tamanoDeInstruccion,
  type ContenidoDeAyuda,
  type DatosPieDeLaAccion,
} from './accionTelefono'
import { notaDeAviso } from './notasGuia'
import { instruccionDeEntrada, tareasParaFoco } from './tareasFoco'
import { textoMasAbajo } from './ventana'

// UNA ACCIÓN POR PANTALLA EN EL TELÉFONO (tarea 355), LA LÓGICA PURA: el
// tamaño de la instrucción según su largo, la línea bajo el título, el pie
// (qué dice «Listo» y, cuando no se puede, por qué) y las secciones de
// «Ayuda con este paso», en su orden y nunca vacías. Todo es inventado.

const adjunto = (referencia: string, tipo: string): PasoAdjunto => ({ referencia, nombre: `${referencia}.dat`, tipo })
const bloque = (parcial: Partial<BloquePaso> & { id: string }): BloquePaso => ({ ...CAMPOS_BLOQUE_VACIOS, tipo: 'tarea', ...parcial })

describe('el tamaño de la instrucción según su largo (sección 8)', () => {
  it('30 hasta 22 caracteres, 26 hasta 44, 22 hasta 80 y 19 desde 81', () => {
    expect(tamanoDeInstruccion('a'.repeat(22))).toBe(30)
    expect(tamanoDeInstruccion('a'.repeat(23))).toBe(26)
    expect(tamanoDeInstruccion('a'.repeat(44))).toBe(26)
    expect(tamanoDeInstruccion('a'.repeat(45))).toBe(22)
    expect(tamanoDeInstruccion('a'.repeat(80))).toBe(22)
    expect(tamanoDeInstruccion('a'.repeat(81))).toBe(19)
  })

  it('cuenta caracteres del texto sin los espacios de los bordes, también los acentuados', () => {
    expect(tamanoDeInstruccion('   Pulsa Guardar   ')).toBe(30)
    // 22 letras con tildes y eñes siguen siendo 22.
    expect(tamanoDeInstruccion('Ábrelo con la señal ñá')).toBe(30)
  })

  it('las clases llevan el ajuste por ancho: −3 bajo 350, −1 de 350 a 379 y +1 desde 420', () => {
    expect(claseTamanoInstruccion('Pulsa Guardar')).toBe(
      'text-[30px] max-[379px]:text-[29px] max-[349px]:text-[27px] min-[420px]:text-[31px]',
    )
    expect(claseTamanoInstruccion('a'.repeat(100))).toBe(
      'text-[19px] max-[379px]:text-[18px] max-[349px]:text-[16px] min-[420px]:text-[20px]',
    )
  })
})

describe('la línea bajo el título de la guía', () => {
  it('«Paso X de Y · acción a de b · equipo»', () => {
    expect(lineaDeLaAccion('Paso 2 de 4', { actual: 0, total: 3 }, 'POSPN01')).toBe('Paso 2 de 4 · acción 1 de 3 · POSPN01')
    expect(partesDeLaLinea('Paso 2 de 4', { actual: 2, total: 3 }, '')).toEqual(['Paso 2 de 4', 'acción 3 de 3'])
  })

  it('con una sola acción no dice «acción 1 de 1» (regla 22), y sin equipo no deja un separador colgando', () => {
    expect(lineaDeLaAccion('Paso 1 de 2', { actual: 0, total: 1 }, '')).toBe('Paso 1 de 2')
    expect(lineaDeLaAccion('Paso 1 de 2', null, '  ')).toBe('Paso 1 de 2')
  })
})

describe('el pie de la acción', () => {
  const base: DatosPieDeLaAccion = {
    numeroDelTrabajo: null,
    seguir: null,
    guiaPendiente: null,
    criticaPendiente: false,
    preguntaPendiente: false,
    destino: 'siguiente',
  }

  it('«Listo» dice a dónde lleva: siguiente, comprobar el resultado o terminar la guía', () => {
    expect(rotuloListo('siguiente')).toBe('Listo · Siguiente')
    expect(rotuloListo('comprobar')).toBe('Listo · Comprobar el resultado')
    expect(rotuloListo('fin')).toBe('Listo · Terminar guía')
    expect(pieDeLaAccion({ ...base, destino: 'comprobar' })).toEqual({
      accion: 'listo',
      etiqueta: 'Listo · Comprobar el resultado',
      etiquetaCompleta: 'Listo · Comprobar el resultado',
      motivo: null,
    })
  })

  it('con una advertencia crítica sin confirmar, no está disponible y una frase dice qué falta (regla 31 b)', () => {
    const pie = pieDeLaAccion({ ...base, criticaPendiente: true })
    expect(pie.accion).toBe('no-disponible')
    expect(pie.etiqueta).toBe('Falta confirmar la advertencia')
    expect(pie.motivo).toBe('Confirma la advertencia crítica de arriba para poder seguir.')
  })

  it('lo que falta va en el orden del trabajo: la guía necesaria, la crítica y la pregunta', () => {
    const guia = motivoGuiasDeLaAccion(['Preparar la impresora de prueba'])
    expect(pieDeLaAccion({ ...base, guiaPendiente: guia, criticaPendiente: true, preguntaPendiente: true }).motivo).toBe(
      'Completa «Preparar la impresora de prueba» para poder seguir.',
    )
    expect(pieDeLaAccion({ ...base, criticaPendiente: true, preguntaPendiente: true }).etiqueta).toBe(
      'Falta confirmar la advertencia',
    )
    expect(pieDeLaAccion({ ...base, preguntaPendiente: true }).etiqueta).toBe('Responde la pregunta')
  })

  it('consultando un paso de más adelante solo devuelve al trabajo; revisando, sigue sin marcar nada', () => {
    expect(pieDeLaAccion({ ...base, numeroDelTrabajo: 2, criticaPendiente: true })).toMatchObject({
      accion: 'volver',
      etiqueta: 'Volver al paso 2',
    })
    expect(pieDeLaAccion({ ...base, seguir: { etiqueta: 'Ir a la acción 3' } })).toMatchObject({
      accion: 'seguir',
      etiqueta: 'Ir a la acción 3',
    })
  })

  it('con varias guías necesarias, la primera por su nombre y cuántas quedan', () => {
    expect(motivoGuiasDeLaAccion([])).toBeNull()
    expect(motivoGuiasDeLaAccion(['Una', 'Otra', 'Tercera'])).toBe('Completa «Una» y 2 guías más para poder seguir.')
    expect(motivoGuiasDeLaAccion(['  '])).toBe('Completa lo que falta para poder seguir.')
  })
})

describe('«Ayuda con este paso» (sección 6)', () => {
  const vacio: ContenidoDeAyuda = {
    requisitos: [],
    resultadoVisual: null,
    imagenes: [],
    terminos: [],
    queHace: [],
    paraQue: '',
    notas: [],
    archivos: [],
    guiasDeConsulta: [],
    loQueSigue: null,
  }
  const resultado: ResultadoVisual = { adjunto: adjunto('res-1', 'image/png') }
  const ficha = { id: 'ref-1', titulo: 'Comando de prueba', valor: 'comando-ejemplo' } as Referencia

  it('sin nada que la acompañe no hay secciones: el botón no se dibuja', () => {
    expect(seccionesDeAyuda(vacio)).toEqual([])
    // Lo que solo tiene espacios no cuenta como contenido.
    expect(seccionesDeAyuda({ ...vacio, requisitos: ['  '], paraQue: '   ', loQueSigue: ' ' })).toEqual([])
  })

  it('las nueve secciones salen en su orden, cada una solo con contenido', () => {
    const secciones = seccionesDeAyuda({
      loQueSigue: 'Pulsa Guardar',
      guiasDeConsulta: [bloque({ id: 'g1', tipo: 'guia', guiaArticuloId: 'guia-x', intencionGuia: 'consulta' })],
      archivos: [adjunto('manual', 'application/pdf')],
      notas: [{ id: 'n1', tono: 'consejo', texto: 'Anota el dato viejo' }],
      paraQue: 'Que la caja use el dato nuevo',
      terminos: [bloque({ id: 't1', tipo: 'referencia', referenciaId: 'ref-2' })],
      queHace: [ficha],
      imagenes: [{ id: 'i1', adjunto: adjunto('captura', 'image/png'), pie: 'La ventana' }],
      resultadoVisual: resultado,
      requisitos: ['Documento de prueba'],
    })
    expect(secciones.map((s) => s.clave)).toEqual([
      'requisitos',
      'funciono',
      'imagenes',
      'significa',
      'paraQue',
      'notas',
      'archivos',
      'consulta',
      'loQueSigue',
    ])
  })

  it('«Qué significa» junta los términos y los «¿Qué hace?»; basta con uno de los dos', () => {
    expect(seccionesDeAyuda({ ...vacio, queHace: [ficha] })).toEqual([{ clave: 'significa', terminos: [], queHace: [ficha] }])
  })

  it('«Ten a mano N cosas» cuenta los requisitos que dicen algo', () => {
    expect(etiquetaTenAMano([])).toBeNull()
    expect(etiquetaTenAMano(['Documento de prueba'])).toBe('Ten a mano 1 cosa')
    expect(etiquetaTenAMano(['Documento de prueba', 'Acceso de prueba', ' '])).toBe('Ten a mano 2 cosas')
  })

  it('de la galería del paso, las imágenes van a «Imágenes» y lo demás a «Archivos»', () => {
    expect(esImagen(adjunto('foto', 'image/jpeg'))).toBe(true)
    expect(esImagen(adjunto('manual', 'application/pdf'))).toBe(false)
  })

  it('las notas son los avisos de Información y Consejo que dicen algo, con su palabra', () => {
    expect(notaDeAviso(bloque({ id: 'a1', tipo: 'aviso', tono: 'info', texto: ' Por qué ' }))).toEqual({
      id: 'a1',
      tono: 'info',
      texto: 'Por qué',
    })
    expect(notaDeAviso(bloque({ id: 'a2', tipo: 'aviso', tono: 'consejo', texto: 'Truco' }))?.tono).toBe('consejo')
    // Un riesgo, un dato técnico o un aviso vacío no son notas.
    expect(notaDeAviso(bloque({ id: 'a3', tipo: 'aviso', tono: 'importante', texto: 'Riesgo' }))).toBeNull()
    expect(notaDeAviso(bloque({ id: 'a4', tipo: 'aviso', tono: 'dato', texto: 'EJ-01' }))).toBeNull()
    expect(notaDeAviso(bloque({ id: 'a5', tipo: 'aviso', tono: 'info', texto: '  ' }))).toBeNull()
  })

  it('«Lo que sigue» dentro del paso es la instrucción de la entrada siguiente, la misma que su pantalla', () => {
    const paso = {
      id: 'p1',
      titulo: 'Preparar la prueba',
      bloques: [bloque({ id: 't1', texto: 'Abre el panel' }), bloque({ id: 't2', texto: '' })],
      adjuntos: [],
      vinculoProtegido: null,
      subArticuloId: null,
      subArticuloTitulo: '',
      solucionArticuloId: null,
      solucionArticuloTitulo: '',
    }
    const tareas = tareasParaFoco(paso, paso.titulo)
    expect(instruccionDeEntrada(paso, tareas[0])).toBe('Abre el panel')
    expect(instruccionDeEntrada(paso, tareas[1])).toBe('Tarea sin texto')
  })
})

describe('«Más abajo» en la acción a la vez', () => {
  it('nombra lo que acompaña a la acción, dos como mucho y sin repetir', () => {
    expect(
      textoMasAbajo([
        { parte: 'contenido', rotulo: 'cómo hacerlo' },
        { parte: 'contenido', rotulo: 'dato técnico' },
        { parte: 'contenido', rotulo: 'dato técnico' },
        { parte: 'contenido', rotulo: 'credencial' },
      ]),
    ).toEqual({ texto: 'Más abajo: cómo hacerlo y dato técnico', critico: false })
  })

  it('una advertencia crítica fuera de vista manda, en rojo', () => {
    expect(textoMasAbajo([{ parte: 'contenido', rotulo: 'credencial' }, { parte: 'critica' }])).toEqual({
      texto: 'Más abajo: advertencia crítica',
      critico: true,
    })
  })
})
