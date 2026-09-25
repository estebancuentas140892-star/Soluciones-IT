/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath } from 'node:url'

// LA VERSION QUE SE VE EN EL TELEFONO (encargo del 2026-09-20, punto 4).
// Vercel expone el commit del despliegue en VERCEL_GIT_COMMIT_SHA; se
// hornea recortado en el build para que "Mas" pueda decir exactamente
// que copia esta corriendo. En local no existe: entonces es "desarrollo".
const versionApp = (process.env.VERCEL_GIT_COMMIT_SHA ?? '').trim().slice(0, 7)

// /version.json: LA VERSION QUE HAY EN EL SERVIDOR, FUERA DEL SERVICE
// WORKER (encargo del 2026-09-21, punto 3).
//
// El defecto que cierra: para enterarse de que hay version nueva, la app
// dependia de que el navegador revalidara `sw.js`. Con la PWA instalada
// eso puede no pasar en dias (el navegador cachea el script del worker),
// asi que el telefono se quedaba en la version vieja y el aviso no
// aparecia nunca. Este archivo es un dato independiente: se pide SIEMPRE
// a la red (`cache: 'no-store'`), NO entra en el precache (no es .js ni
// .css: `globPatterns` no lo recoge, y ademas se excluye a mano), y
// comparar su contenido con la version horneada dice la verdad sin
// depender de ningun cache.
function pluginVersionJson(version: string) {
  return {
    name: 'soluciones-it-version-json',
    apply: 'build' as const,
    generateBundle(this: { emitFile: (archivo: Record<string, unknown>) => void }) {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify(
          { version: version || 'desarrollo', compiladoEn: new Date().toISOString() },
          null,
          2,
        ),
      })
    },
  }
}

// EL PORTAL DE ASISTENCIA EN DESARROLLO (tarea 258). En produccion,
// `vercel.json` reescribe `/asistencia` a `asistencia.html`; el servidor
// de desarrollo, en cambio, responderia con la app (su fallback de SPA),
// asi que aqui se hace la misma reescritura.
function pluginPortalAsistencia() {
  return {
    name: 'soluciones-it-portal-asistencia',
    configureServer(servidor: { middlewares: { use: (fn: (req: { url?: string }, res: unknown, next: () => void) => void) => void } }) {
      servidor.middlewares.use((req, _res, next) => {
        if (req.url && /^\/asistencia\/?(\?|$)/.test(req.url)) {
          req.url = req.url.replace(/^\/asistencia\/?/, '/asistencia.html')
        }
        next()
      })
    },
  }
}

// VitePWA pone `<link rel="manifest">` en TODAS las paginas del build.
// En el portal no: el computador atendido no debe ofrecer "Instalar
// Soluciones IT" (la pagina no es la app ni registra su service worker).
// Va con `enforce: 'post'` y DESPUES de VitePWA en la lista de plugins,
// porque VitePWA inyecta el enlace en su propio paso final.
function pluginPortalSinManifiesto() {
  return {
    name: 'soluciones-it-portal-sin-manifiesto',
    enforce: 'post' as const,
    apply: 'build' as const,
    transformIndexHtml: {
      order: 'post' as const,
      handler(html: string, contexto: { filename: string }) {
        if (!/[\\/]asistencia\.html$/.test(contexto.filename)) return html
        return html.replace(/\s*<link rel="manifest"[^>]*>/g, '')
      },
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  define: {
    'import.meta.env.VITE_VERSION_APP': JSON.stringify(versionApp),
  },
  plugins: [
    react(),
    tailwindcss(),
    pluginVersionJson(versionApp),
    pluginPortalAsistencia(),
    VitePWA({
      // 'prompt' (en vez de 'autoUpdate'): la version nueva queda en
      // espera y el aviso ActualizacionDisponible deja que el tecnico
      // actualice cuando quiera, sin recargar en medio de un paso. El
      // registro y la recarga los maneja el hook useRegisterSW, por lo
      // que ya no se autoinyecta el registerSW.js minimo (que no
      // comprobaba actualizaciones ni recargaba, y dejaba a los
      // clientes en la version vieja).
      registerType: 'prompt',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Soluciones IT',
        short_name: 'Soluciones IT',
        description: 'Base de conocimiento, inventario de dispositivos y credenciales para el equipo de soporte de TI',
        theme_color: '#161826',
        background_color: '#161826',
        display: 'standalone',
        start_url: '/',
        icons: [
          // SVG unico: liviano y escala perfecto en cualquier tamano.
          // El arte respeta la "zona segura" de los iconos maskable
          // (todo el contenido cabe dentro del circulo central del
          // 80% del lienzo) para que Android no lo recorte mal al
          // aplicar su propia mascara.
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        // Todos los trozos JS que produce la division del bundle
        // quedan precacheados, asi las pantallas cargadas bajo demanda
        // tambien funcionan sin conexion.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // `version.json` NUNCA se precachea: es justo el archivo que
        // tiene que llegar fresco de la red para detectar que hay
        // version nueva. (Con estos `globPatterns` ya quedaria fuera por
        // extension; se escribe explicito para que no se cuele si
        // alguien agrega json a la lista.)
        globIgnores: [
          'version.json',
          // EL PORTAL PUBLICO NO ES DE LA APP DEL TECNICO (tarea 258): ni
          // su HTML ni su entrada ni sus estilos entran en el precache.
          // Lo que comparte con la app (React, el componente que dibuja
          // un envio) ya estaba en el precache por la app.
          'asistencia.html',
          'assets/asistencia-*',
          // LAS HERRAMIENTAS DE ESCRITORIO TAMPOCO (tarea 259): Importar
          // (con `xlsx`, casi medio mega) y Etiquetas (con `qrcode`) son el
          // 20 % del precache y se usan con el computador delante, casi
          // nunca en campo. Se bajan la primera vez que se abren y desde
          // ahi las guarda `runtimeCaching` (abajo), asi que sin conexion
          // funcionan desde su primer uso. Si se abren sin red antes de
          // eso, `ErrorBoundary` lo dice sin tocar nada (recargaChunk.ts).
          // Solo trozos que nada precacheado importa de forma estatica:
          // lo comprueba scripts/verificar-precache.mjs sobre el build.
          'assets/ImportarDispositivosPage-*',
          'assets/xlsx-*',
          'assets/EtiquetasPage-*',
          'assets/qrcode-*',
        ],
        runtimeCaching: [
          {
            // Nombre con hash: el contenido de una direccion no cambia
            // nunca, asi que la cache manda. Doce entradas dan para tres
            // versiones de los cuatro trozos; las viejas salen solas.
            urlPattern: /\/assets\/(?:ImportarDispositivosPage|xlsx|EtiquetasPage|qrcode)-[\w-]+\.js$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'herramientas-bajo-demanda',
              expiration: { maxEntries: 12, purgeOnQuotaError: true },
            },
          },
        ],
        // Y el service worker de la app no sirve su `index.html` cuando
        // el navegador pide `/asistencia`: esa navegacion va a la red,
        // donde Vercel responde con el portal.
        navigateFallbackDenylist: [/^\/asistencia(\.html)?(\/|\?|$)/],
      },
    }),
    pluginPortalSinManifiesto(),
  ],
  build: {
    rollupOptions: {
      // Dos entradas: la app del tecnico y el portal publico de
      // asistencia (tarea 258), que no comparte con la app mas que React,
      // los estilos y el componente que dibuja un envio.
      input: {
        index: fileURLToPath(new URL('./index.html', import.meta.url)),
        asistencia: fileURLToPath(new URL('./asistencia.html', import.meta.url)),
      },
      output: {
        // Vendors pesados que se cargan al arranque (autenticacion y
        // sincronizacion) en trozos propios y estables: se cachean
        // aparte del codigo de la app, que cambia con mas frecuencia.
        // react-markdown y minisearch no aparecen aqui a proposito:
        // los aisla la carga diferida por ruta (solo la vista de
        // articulo y la de inicio, respectivamente).
        advancedChunks: {
          groups: [
            {
              // El ayudante de precarga de Vite (`__vitePreload`) en su
              // propio trozo minimo. Sin esto caia dentro del de Supabase y
              // todo trozo con una importacion diferida (React incluido)
              // importaba supabase-js entero: el portal de asistencia lo
              // descargaba sin usarlo (tarea 258).
              name: 'precarga',
              test: /vite\/preload-helper/,
              priority: 30,
            },
            {
              name: 'supabase',
              test: /[\\/]node_modules[\\/]@supabase[\\/]/,
              priority: 20,
            },
            {
              // Nombres propios y estables para las dos librerias que solo
              // usan Importar y Etiquetas (y el portal, `qrcode`): el
              // precache las deja fuera por nombre (tarea 259). Sin esto,
              // `qrcode` salia como `browser-*`, el nombre de su archivo
              // de entrada.
              name: 'xlsx',
              test: /[\\/]node_modules[\\/]xlsx[\\/]/,
              priority: 20,
            },
            {
              name: 'qrcode',
              test: /[\\/]node_modules[\\/](qrcode|dijkstrajs)[\\/]/,
              priority: 20,
            },
            {
              name: 'react-vendor',
              test: /[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/,
              priority: 10,
            },
            {
              name: 'dexie',
              test: /[\\/]node_modules[\\/]dexie[\\/]/,
              priority: 15,
            },
          ],
        },
      },
    },
  },
  test: {
    environment: 'node',
    setupFiles: ['./src/pruebas/setup.ts'],
    // Solo las pruebas de este arbol (tarea 178). Un worktree de
    // sesion anterior bajo `.claude/` traia una copia entera de `src`,
    // asi que vitest corria la suite DOS veces y reportaba el doble de
    // fallos, sin decir de donde venian. El worktree se retiro; esto
    // evita que vuelva a pasar con el siguiente.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**', '.claude/**'],
  },
})
