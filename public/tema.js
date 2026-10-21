// EL TEMA, ANTES DE PINTAR (tarea 333). Script clásico y síncrono en el
// <head> de index.html: pone `data-tema` en <html> y el color de la barra
// del navegador antes de que se vea nada, para que quien eligió el tema
// claro no vea un destello oscuro al abrir. La CSP no admite scripts en
// línea, por eso es un archivo. La lógica completa vive en
// src/lib/tema.ts, que toma el relevo al arrancar: misma clave
// ('sit-tema'), mismas preferencias y mismos colores.
;(function () {
  var preferencia = 'oscuro'
  try {
    var guardada = localStorage.getItem('sit-tema')
    if (guardada === 'claro' || guardada === 'automatico') preferencia = guardada
  } catch {
    // Almacenamiento bloqueado: se queda el oscuro de siempre.
  }
  var claro =
    preferencia === 'claro' ||
    (preferencia === 'automatico' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-color-scheme: light)').matches)
  document.documentElement.setAttribute('data-tema', claro ? 'claro' : 'oscuro')
  // En el teléfono, el fondo de «Ventana» (tarea 349); desde 768 px, el de siempre.
  var telefono =
    typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 47.999rem)').matches
  var barra = document.querySelector('meta[name="theme-color"]')
  if (barra) {
    if (telefono) barra.setAttribute('content', claro ? '#f2f5f9' : '#0e131b')
    else barra.setAttribute('content', claro ? '#f4f5f8' : '#161826')
  }
})()
