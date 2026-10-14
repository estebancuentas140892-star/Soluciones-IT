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
  // El claro solo pinta con ancho de teléfono (tarea 338): desde 768 px la
  // página sigue oscura y la barra del navegador con ella. Mismo corte que
  // src/lib/anchoTelefono.ts.
  var telefono = typeof window.matchMedia !== 'function' || window.matchMedia('(width < 48rem)').matches
  var barra = document.querySelector('meta[name="theme-color"]')
  if (barra) barra.setAttribute('content', claro && telefono ? '#f4f5f8' : '#161826')
})()
