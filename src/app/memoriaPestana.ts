import { useEffect } from 'react'
import { RAICES_DE_PESTANA } from '../lib/navegacion'

// Memoria de filtros por pestaña (tarea 187, mockup `4e`, regla R20:
// "volver es volver al mismo sitio"). La otra mitad de la memoria, el
// scroll, vive en `memoriaScroll.ts`.
//
// El diagnóstico del handoff es literal: "el filtro vive en la URL, pero
// la pestaña apunta a /soluciones pelado: volver aquí desde otra pestaña
// lo borra". Así que la memoria guarda, por cada raíz de pestaña, la
// última cadena de búsqueda que se vio EN ESA RAÍZ, y el enlace de la
// pestaña la vuelve a poner al regresar.
//
// Vive en un Map de módulo, fuera de React, por el mismo motivo que
// `memoriaScroll`: cada pantalla monta su propio Chasis, así que un
// estado de componente no sobreviviría de una pestaña a la siguiente.
const busquedas = new Map<string, string>()

function normalizar(pathname: string): string {
  return pathname !== '/' ? pathname.replace(/\/+$/, '') : '/'
}

// ¿Cuál de las raíces contiene a `pathname`? La raíz "/" es prefijo de
// todo, así que solo cuenta cuando coincide exacta; el resto compara por
// segmento completo, para que `/redes` no caiga dentro de `/red`.
export function raizQueContiene(pathname: string, raices: string[]): string | null {
  const ruta = normalizar(pathname)
  for (const raiz of raices) {
    if (raiz === '/') {
      if (ruta === '/') return raiz
      continue
    }
    if (ruta === raiz || ruta.startsWith(`${raiz}/`)) return raiz
  }
  return null
}

// Solo se recuerda la búsqueda de la RAÍZ de la pestaña, nunca la de una
// ficha interna: los filtros son de la lista. Sin esta condición, salir
// de `/soluciones/impresoras/zebra?x=1` dejaría a la pestaña Guías
// apuntando a `/soluciones?x=1`.
export function recordarBusqueda(pathname: string, search: string, raices: string[]): void {
  const raiz = raizQueContiene(pathname, raices)
  if (raiz === null || normalizar(pathname) !== raiz) return
  busquedas.set(raiz, search)
}

// Destino real del enlace de una pestaña. Estando FUERA de ella,
// devuelve la raíz con su último filtro (R20). Estando dentro, devuelve
// la raíz pelada: tocar la pestaña activa vuelve a su raíz, y eso
// incluye soltar el filtro.
export function destinoDePestana(raiz: string, pathnameActual: string, raices: string[]): string {
  if (raizQueContiene(pathnameActual, raices) === raiz) return raiz
  const search = busquedas.get(raiz)
  return search ? `${raiz}${search}` : raiz
}

// Las funciones puras reciben las raíces para poder probarse con
// cualquier lista; el hook usa directamente la de la app, que es la única
// que tiene sentido en producción.
export function useMemoriaPestana(pathname: string, search: string): void {
  useEffect(() => {
    recordarBusqueda(pathname, search, RAICES_DE_PESTANA)
  }, [pathname, search])
}

// Solo para las pruebas: el Map de módulo sobrevive entre casos.
export function olvidarTodo(): void {
  busquedas.clear()
}
