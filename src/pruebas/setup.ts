// Hace que IndexedDB (y por lo tanto Dexie) funcione en Node
// durante las pruebas, sin necesidad de un navegador.
import 'fake-indexeddb/auto'

// LAS PRUEBAS DE INTERFAZ MIRAN UN TELÉFONO (tarea 338). happy-dom abre una
// ventana de 1024 x 768, y desde la tarea 338 lo poco del rediseño móvil que
// se decide en JavaScript (el buscador en el dock, src/lib/anchoTelefono.ts)
// mira el ancho. Las pruebas existentes describen el teléfono, así que la
// ventana de prueba es de teléfono; la que quiera tableta o escritorio lo
// pide con `window.happyDOM.setViewport({ width: 1280, height: 800 })`.
const ventana = globalThis as { happyDOM?: { setViewport: (vista: { width: number; height: number }) => void } }
ventana.happyDOM?.setViewport({ width: 375, height: 812 })
