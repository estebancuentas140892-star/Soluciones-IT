// EL TEMA DE LA APLICACIÓN (tarea 333, rediseño móvil "1b Pulgar", paso 7;
// regla 12 de REGLAS.md desde el 2026-10-13: oscuro por defecto, claro
// opcional).
//
// Tres preferencias: 'oscuro' (la de siempre y la de quien no elige nada),
// 'claro' (para leer a pleno sol, en una taquilla) y 'automatico' (sigue
// al teléfono, `prefers-color-scheme`). Lo que se pinta es el tema
// EFECTIVO, oscuro o claro, en el atributo `data-tema` de <html>: los
// tokens `--color-noct-*` del tema claro cuelgan de `:root[data-tema="claro"]`
// en src/index.css, así que ninguna pantalla sabe de temas.
//
// SOLO EN EL TELÉFONO (tarea 338, AD-087): esos tokens viven dentro de
// `@media (width < 48rem)`. La preferencia, su clave y su almacenamiento no
// cambian; desde 768 px simplemente no pinta (tableta y escritorio siguen
// en el oscuro de antes del rediseño móvil) y Ajustes no la ofrece ahí.
//
// Es una preferencia de ESTE teléfono, como el modo de ejecución, y no se
// sincroniza. Vive en localStorage y no en Dexie porque tiene que leerse
// ANTES de pintar, sin esperar a nada: public/tema.js la aplica de forma
// síncrona en el <head> (la CSP no admite scripts en línea) y este módulo
// toma el relevo cuando arranca la app. Los dos usan la misma clave y los
// mismos colores de la barra del navegador; si cambian, cambian juntos.

import { esAnchoTelefono, suscribirAnchoTelefono } from './anchoTelefono'

export type PreferenciaTema = 'oscuro' | 'claro' | 'automatico'
export type TemaEfectivo = 'oscuro' | 'claro'

export const CLAVE_TEMA = 'sit-tema'
export const PREFERENCIA_POR_DEFECTO: PreferenciaTema = 'oscuro'

/** El color de la barra del navegador (meta theme-color): el fondo de cada tema. */
export const COLOR_BARRA: Record<TemaEfectivo, string> = {
  oscuro: '#161826',
  claro: '#f4f5f8',
}

const CONSULTA_CLARO = '(prefers-color-scheme: light)'

export function esPreferenciaTema(valor: unknown): valor is PreferenciaTema {
  return valor === 'oscuro' || valor === 'claro' || valor === 'automatico'
}

/** El tema que se pinta con una preferencia y lo que pide el teléfono. */
export function temaEfectivo(preferencia: PreferenciaTema, telefonoPideClaro: boolean): TemaEfectivo {
  if (preferencia === 'automatico') return telefonoPideClaro ? 'claro' : 'oscuro'
  return preferencia
}

/** La preferencia guardada; la de por defecto si no hay, si no vale o si el almacenamiento está bloqueado. */
export function leerPreferenciaTema(): PreferenciaTema {
  try {
    const guardada = localStorage.getItem(CLAVE_TEMA)
    return esPreferenciaTema(guardada) ? guardada : PREFERENCIA_POR_DEFECTO
  } catch {
    return PREFERENCIA_POR_DEFECTO
  }
}

function telefonoPideClaro(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(CONSULTA_CLARO).matches
}

/**
 * El color de la barra del navegador para un tema efectivo. El claro solo
 * pinta con ancho de teléfono (tarea 338: sus tokens viven en
 * `@media (width < 48rem)`); desde 768 px la página sigue oscura, y la barra
 * con ella.
 */
export function colorBarra(tema: TemaEfectivo, anchoTelefono: boolean): string {
  return tema === 'claro' && anchoTelefono ? COLOR_BARRA.claro : COLOR_BARRA.oscuro
}

/** Pinta el tema efectivo de una preferencia: el atributo de <html> y la barra del navegador. */
export function aplicarTema(preferencia: PreferenciaTema): TemaEfectivo {
  const tema = temaEfectivo(preferencia, telefonoPideClaro())
  document.documentElement.setAttribute('data-tema', tema)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', colorBarra(tema, esAnchoTelefono()))
  return tema
}

const suscriptores = new Set<() => void>()

// Si localStorage no deja guardar, lo elegido se recuerda aquí mientras
// la app siga abierta.
let preferenciaEnMemoria: PreferenciaTema | null = null

/** Guarda la preferencia de este teléfono y la aplica en el acto. */
export function guardarPreferenciaTema(preferencia: PreferenciaTema): void {
  try {
    if (preferencia === PREFERENCIA_POR_DEFECTO) localStorage.removeItem(CLAVE_TEMA)
    else localStorage.setItem(CLAVE_TEMA, preferencia)
    preferenciaEnMemoria = null
  } catch {
    // Sin almacenamiento la elección dura lo que dure esta pestaña.
    preferenciaEnMemoria = preferencia
  }
  aplicarTema(preferencia)
  suscriptores.forEach((avisar) => avisar())
}

/** La preferencia vigente (para `useSyncExternalStore`). */
export function preferenciaTemaActual(): PreferenciaTema {
  return preferenciaEnMemoria ?? leerPreferenciaTema()
}

export function suscribirPreferenciaTema(avisar: () => void): () => void {
  suscriptores.add(avisar)
  return () => suscriptores.delete(avisar)
}

/**
 * Al arrancar la app: aplica la preferencia (public/tema.js ya lo hizo
 * antes de pintar; esto lo asegura si ese script no cargó) y, en
 * automático, sigue los cambios del teléfono sin recargar.
 */
export function iniciarTema(): void {
  aplicarTema(preferenciaTemaActual())
  if (typeof window.matchMedia !== 'function') return
  window.matchMedia(CONSULTA_CLARO).addEventListener('change', () => {
    if (preferenciaTemaActual() === 'automatico') aplicarTema('automatico')
  })
  // Al cruzar los 768 px (girar el teléfono, estrechar la ventana) cambia
  // si el claro pinta, y la barra del navegador lo acompaña (tarea 338).
  suscribirAnchoTelefono(() => aplicarTema(preferenciaTemaActual()))
}
