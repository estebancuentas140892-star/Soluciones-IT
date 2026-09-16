import type { Session } from '@supabase/supabase-js'
import { act, createElement, type ReactElement, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
  type Location,
  type NavigateFunction,
} from 'react-router-dom'
import { AuthContext, type AuthContextValue } from '../features/autenticacion/authContext'
import { bloquear, cifrarCredencial, desbloquear, TEXTO_VERIFICADOR } from '../features/boveda/sesionBoveda'
import { cifrarTexto, derivarClave, nuevaSal } from '../lib/crypto'
import {
  db,
  ID_VERIFICADOR,
  type Articulo,
  type Credencial,
  type Dispositivo,
  type PasoProcedimiento,
  type Referencia,
  type TipoReferencia,
  type TipoSecreto,
} from '../lib/db'

// MONTAR PANTALLAS REALES EN LAS PRUEBAS DE FLUJO (encargo del
// 2026-09-16, sección 16).
//
// Las pruebas de siempre son de lógica pura, en Node y sin DOM. Los casos
// de esta tarea son RECORRIDOS ("buscar, desbloquear, ver, copiar, cerrar
// y seguir en la misma pantalla"), y lo que hay que demostrar es
// justamente lo que ninguna función pura ve: que no se navega, que la
// ejecución de debajo no se desmonta, que la consulta sigue escrita. Así
// que estos archivos piden `// @vitest-environment happy-dom` y montan la
// pantalla de verdad, con su router en memoria y la base local de
// `fake-indexeddb`.
//
// Sin JSX a propósito: este módulo exporta funciones, no componentes.
//
// Todo lo que se siembra es INVENTADO: ningún usuario, contraseña ni
// dato real del equipo.

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

export const PERFIL_PRUEBA = {
  id: '00000000-0000-4000-8000-00000000f10a',
  nombre: 'Técnica de prueba',
  correo: 'prueba@local',
}

/** Contraseña maestra de las pruebas de flujo. Inventada. */
export const MAESTRA_PRUEBA = 'Maestra-De-Prueba!2026'

// Iteraciones bajas SOLO aquí: el verificador lleva las suyas dentro, así
// que `desbloquear()` corre el mismo código que en producción, pero cada
// recorrido no tarda un segundo en derivar la clave.
const ITERACIONES_PRUEBA = 1_000

const AHORA = '2026-09-16T12:00:00.000Z'

// ----------------------------------------------------------------
// Montaje
// ----------------------------------------------------------------

let ubicacion: Location | null = null
let navegar: NavigateFunction | null = null

function EspiaUbicacion() {
  ubicacion = useLocation()
  navegar = useNavigate()
  return null
}

/** Dónde está el router ahora mismo. */
export function ubicacionActual(): Location {
  if (!ubicacion) throw new Error('No hay nada montado.')
  return ubicacion
}

/** El botón atrás del teléfono (o del navegador): la entrada anterior del historial. */
export async function navegarAtras(): Promise<void> {
  const ir = navegar
  if (!ir) throw new Error('No hay nada montado.')
  await act(async () => {
    await ir(-1)
  })
  await pausa()
}

export interface RutaPrueba {
  ruta: string
  elemento: ReactNode
}

export interface Montaje {
  desmontar: () => Promise<void>
}

const raices = new Set<Root>()

/**
 * Monta las rutas dadas dentro del mismo `AuthContext` que usa la app, con
 * una sesión ficticia del perfil de prueba, y espera a que se asiente.
 */
export async function montar(
  rutas: RutaPrueba[],
  entrada: string | { pathname: string; state?: unknown },
): Promise<Montaje> {
  const contenedor = document.createElement('div')
  document.body.appendChild(contenedor)
  const raiz = createRoot(contenedor)
  raices.add(raiz)

  const arbol: ReactElement = createElement(
    AuthContext.Provider,
    { value: valorAuth() },
    createElement(
      MemoryRouter,
      { initialEntries: [entrada] },
      createElement(EspiaUbicacion),
      createElement(
        Routes,
        null,
        rutas.map(({ ruta, elemento }) => createElement(Route, { key: ruta, path: ruta, element: elemento })),
      ),
    ),
  )

  await act(async () => {
    raiz.render(arbol)
  })
  await pausa()

  return {
    desmontar: async () => {
      await act(async () => raiz.unmount())
      raices.delete(raiz)
      contenedor.remove()
    },
  }
}

/** Desmonta todo lo que quedara montado (para `afterEach`). */
export async function desmontarTodo(): Promise<void> {
  for (const raiz of raices) await act(async () => raiz.unmount())
  raices.clear()
  document.body.innerHTML = ''
  document.body.removeAttribute('style')
  ubicacion = null
  navegar = null
}

function valorAuth(): AuthContextValue {
  return {
    cargando: false,
    session: { user: { id: PERFIL_PRUEBA.id, email: PERFIL_PRUEBA.correo } } as unknown as Session,
    perfil: { ...PERFIL_PRUEBA, puedeVerBoveda: true },
    iniciarSesion: async () => null,
    cambiarContrasena: async () => null,
    cerrarSesion: async () => undefined,
  }
}

// ----------------------------------------------------------------
// Esperar e interactuar
// ----------------------------------------------------------------

/** Deja correr las consultas vivas, los efectos y los temporizadores cortos. */
export async function pausa(ms = 30): Promise<void> {
  await act(async () => {
    await new Promise((resolver) => setTimeout(resolver, ms))
  })
}

/** Espera a que la condición devuelva algo verdadero y lo devuelve. */
export async function esperar<T>(condicion: () => T | null | undefined | false, que: string, ms = 4000): Promise<T> {
  const limite = Date.now() + ms
  for (;;) {
    const valor = condicion()
    if (valor) return valor
    if (Date.now() > limite) throw new Error(`No llegó a pasar: ${que}`)
    await pausa()
  }
}

/** Como `esperar`, para condiciones que leen la base local. */
export async function esperarQue(condicion: () => Promise<boolean>, que: string, ms = 4000): Promise<void> {
  const limite = Date.now() + ms
  for (;;) {
    if (await condicion()) return
    if (Date.now() > limite) throw new Error(`No llegó a pasar: ${que}`)
    await pausa()
  }
}

/** Nombre accesible simple: el aria-label o, si no hay, el texto visible. */
function nombreDe(elemento: Element): string {
  return (elemento.getAttribute('aria-label') ?? elemento.textContent ?? '').replace(/\s+/g, ' ').trim()
}

/** El botón (o enlace) cuyo nombre coincide, o null. */
export function control(nombre: string | RegExp): HTMLElement | null {
  const candidatos = Array.from(document.body.querySelectorAll<HTMLElement>('button, a'))
  return (
    candidatos.find((elemento) => {
      const texto = nombreDe(elemento)
      return typeof nombre === 'string' ? texto === nombre : nombre.test(texto)
    }) ?? null
  )
}

/** Espera a que aparezca un control y lo devuelve. */
export function esperarControl(nombre: string | RegExp): Promise<HTMLElement> {
  return esperar(() => control(nombre), `aparece el control ${String(nombre)}`)
}

export async function tocar(elemento: HTMLElement): Promise<void> {
  await act(async () => {
    elemento.click()
  })
  await pausa()
}

/** Escribe en un campo como lo haría el teclado (React escucha `input`). */
export async function escribir(campo: HTMLInputElement, texto: string): Promise<void> {
  await act(async () => {
    const asignar = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    asignar?.call(campo, texto)
    campo.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await pausa()
}

/** El campo del buscador global (Inicio o capa). */
export function campoBuscador(): HTMLInputElement | null {
  return document.body.querySelector<HTMLInputElement>('input[aria-label="Buscar en Soluciones IT"]')
}

/** Todo el texto visible del documento, espacios normalizados. */
export function textoPantalla(): string {
  return (document.body.textContent ?? '').replace(/\s+/g, ' ')
}

/** Envía el formulario que contiene al elemento (el "Desbloquear" en línea). */
export async function enviarFormulario(dentro: HTMLElement): Promise<void> {
  const formulario = dentro.closest('form')
  if (!formulario) throw new Error('El elemento no está dentro de un formulario.')
  await act(async () => {
    formulario.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  })
  await pausa()
}

// ----------------------------------------------------------------
// Datos de prueba
// ----------------------------------------------------------------

/** Vacía la base local y cierra la bóveda. */
export async function limpiarBase(): Promise<void> {
  bloquear()
  await Promise.all(db.tables.map((tabla) => tabla.clear()))
}

export async function sembrarPerfil(puedeVerBoveda: boolean): Promise<void> {
  await db.perfiles.put({ ...PERFIL_PRUEBA, puedeVerBoveda })
}

/**
 * Deja anclada la contraseña maestra de prueba (el verificador, como lo
 * guarda la app) y la bóveda ABIERTA, para poder cifrar lo que se siembre.
 * Quien necesite empezar con la bóveda cerrada llama a `bloquear()`.
 */
export async function anclarMaestra(): Promise<void> {
  const salt = nuevaSal()
  const clave = await derivarClave(MAESTRA_PRUEBA, salt, ITERACIONES_PRUEBA)
  const verificador = await cifrarTexto(clave, salt, ITERACIONES_PRUEBA, TEXTO_VERIFICADOR)
  await db.bovedaMeta.put({ id: ID_VERIFICADOR, verificador, updatedAt: AHORA })
  const error = await desbloquear(MAESTRA_PRUEBA)
  if (error) throw new Error(error)
}

/** Una credencial cifrada con la maestra de prueba (la bóveda debe estar abierta). */
export async function sembrarCredencial(datos: {
  id: string
  titulo: string
  tipo: TipoSecreto
  usuario?: string
  contrasena?: string
  notas?: string
}): Promise<Credencial> {
  const credencial: Credencial = {
    id: datos.id,
    titulo: datos.titulo,
    categoria: 'Pruebas',
    tipo: datos.tipo,
    datosCifrados: await cifrarCredencial({
      usuario: datos.usuario ?? '',
      contrasena: datos.contrasena ?? '',
      ip: '',
      url: '',
      notas: datos.notas ?? '',
      extras: {},
    }),
    venceEn: null,
    dispositivos: [],
    archivo: datos.tipo === 'archivo' ? { referencia: 'pruebas/archivo', nombre: 'licencia-de-prueba.pdf', tipo: 'application/pdf', tamano: 2048 } : null,
    updatedAt: AHORA,
    updatedBy: null,
    eliminadoEn: null,
  }
  await db.credenciales.put(credencial)
  return credencial
}

/** Un paso con tareas de acción, con la forma que guarda el editor. */
export function pasoPrueba(id: string, titulo: string, tareas: string[]): PasoProcedimiento {
  return {
    id,
    titulo,
    objetivo: '',
    bloques: tareas.map((texto, indice) => ({
      id: `${id}-t${indice + 1}`,
      tipo: 'tarea',
      texto,
      tono: null,
      adjunto: null,
      tipoTarea: 'accion',
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
    })),
    adjuntos: [],
    vinculoProtegido: null,
    subArticuloId: null,
    subArticuloTitulo: '',
    solucionArticuloId: null,
    solucionArticuloTitulo: '',
  }
}

/** Una guía publicada con los pasos dados, en su categoría. */
export async function sembrarGuia(datos: {
  id: string
  titulo: string
  categoriaId?: string
  pasos: PasoProcedimiento[]
}): Promise<Articulo> {
  const categoriaId = datos.categoriaId ?? 'cat-pruebas'
  await db.categorias.put({
    id: categoriaId,
    nombre: 'Pruebas',
    icono: '',
    orden: 1,
    esRed: false,
    color: null,
    updatedAt: AHORA,
    updatedBy: null,
    eliminadoEn: null,
  })
  const articulo: Articulo = {
    id: datos.id,
    categoriaId,
    titulo: datos.titulo,
    tipo: 'configuracion',
    contenido: '',
    etiquetas: [],
    procedimiento: {
      descripcion: '',
      portada: null,
      objetivoGeneral: '',
      requisitos: [],
      verificacionFinal: [],
      tiempoEstimadoMin: 10,
      dificultad: 'principiante',
      pasos: datos.pasos,
    },
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
    updatedBy: null,
    eliminadoEn: null,
  }
  await db.articulos.put(articulo)
  return articulo
}

/** Una ficha del Centro de consulta. */
export async function sembrarReferencia(
  datos: Partial<Referencia> & { id: string; tipo: TipoReferencia; titulo: string },
): Promise<Referencia> {
  const referencia: Referencia = {
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
    updatedBy: null,
    eliminadoEn: null,
    ...datos,
  }
  await db.referencias.put(referencia)
  return referencia
}

/** Un equipo del inventario. */
export async function sembrarEquipo(datos: Partial<Dispositivo> & { id: string; nombre: string }): Promise<Dispositivo> {
  const equipo: Dispositivo = {
    categoriaId: 'cat-equipos',
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
    estado: '',
    observaciones: '',
    detalles: {},
    foto: null,
    updatedAt: AHORA,
    updatedBy: null,
    eliminadoEn: null,
    ...datos,
  }
  await db.dispositivos.put(equipo)
  return equipo
}
