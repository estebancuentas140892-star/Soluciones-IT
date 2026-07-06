/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
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
        theme_color: '#0f172a',
        background_color: '#0f172a',
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
      },
    }),
  ],
  build: {
    rollupOptions: {
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
              name: 'supabase',
              test: /[\\/]node_modules[\\/]@supabase[\\/]/,
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
  },
})
