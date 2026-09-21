/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  /** Commit corto del despliegue (Vercel). Vacio en desarrollo local. */
  readonly VITE_VERSION_APP: string
  /** Banco de pruebas local: ver src/pruebas/semillaLocal.ts. */
  readonly VITE_MODO_PRUEBA_LOCAL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
