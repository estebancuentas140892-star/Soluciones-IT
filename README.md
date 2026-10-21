# Soluciones IT

Aplicación web instalable (PWA) para el equipo de soporte y mantenimiento de TI: base de conocimiento por categorías, inventario de dispositivos, bóveda de IP y credenciales, y búsqueda global, todo con funcionamiento offline.

La documentación está organizada así, cada concepto en un solo lugar:

- [ARQUITECTURA.md](ARQUITECTURA.md): stack y decisiones técnicas de implementación.
- [ARQUITECTURA_FUNCIONAL.md](ARQUITECTURA_FUNCIONAL.md): comportamiento interno (reglas de negocio, permisos, estados, eventos, modelo entidad-relación).
- [DOCUMENTACION_FUNCIONAL.md](DOCUMENTACION_FUNCIONAL.md): lo visible al usuario (pantallas, formularios, botones, flujos).
- [COMPONENTES_UI.md](COMPONENTES_UI.md) y [BUSCADOR.md](BUSCADOR.md): componentes reutilizables y el buscador.
- [DECISIONES.md](DECISIONES.md) y [CHANGELOG.md](CHANGELOG.md): decisiones de arquitectura e historial de cambios.
- [TAREAS.md](TAREAS.md) para el estado del desarrollo e [INSTALACION.md](INSTALACION.md) para instalarla en el teléfono o la PC.

## Requisitos

- Node.js 20 o superior

## Puesta en marcha

```bash
npm install
npm run dev
```

## Variables de entorno

Copiar `.env.example` a `.env` y completar con las credenciales del proyecto de Supabase (ver tarea 2 en [TAREAS.md](TAREAS.md)):

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Son las dos únicas que el cliente necesita (`src/lib/supabase.ts`). La versión que muestra la app (`VITE_VERSION_APP`) sale sola de `VERCEL_GIT_COMMIT_SHA` al compilar en Vercel. `VITE_MODO_PRUEBA_LOCAL=1` (banco de pruebas con datos inventados, en `.env.local`) y `VITE_ASISTENCIA_SIMULADA_URL` solo funcionan con `npm run dev`: el build de producción las descarta. Nunca se pone en el cliente una clave `service_role`.

### Vista previa de Vercel (Preview)

Vite **incrusta** las variables `VITE_*` en el JavaScript al compilar. Por eso cada entorno de Vercel necesita las suyas en el momento del build: si `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` solo están marcadas para Production, el despliegue Preview de una rama compila sin ellas, la app queda sin cliente de Supabase y el inicio de sesión dice «La aplicación aún no está conectada al servidor». Cambiar una variable no arregla un despliegue ya hecho: hay que volver a desplegar la rama.

Diagnóstico del 2026-10-21 (tarea 349): el despliegue Preview de `feat/rediseno-movil-ventanas` existe y terminó bien (está protegido por Vercel Authentication), pero sin esas variables. Supabase solo tiene el proyecto de producción («Soluciones TI»); no hay un proyecto de pruebas. Las opciones, que decide el usuario:

1. **Un proyecto Supabase de pruebas** (recomendada): crear el proyecto, ejecutar `supabase/schema.sql`, cargar datos inventados y usuarios de prueba, y poner su URL y su clave anónima en Vercel **solo para Preview**. Las vistas previas nunca tocan datos reales.
2. **Preview contra producción**, solo con autorización expresa: marcar las dos variables también para Preview. La clave anónima es pública por diseño y las políticas RLS y el inicio de sesión siguen protegiendo, pero quien pruebe la vista previa trabaja sobre los datos reales del equipo.
3. **Sin Supabase en Preview**: revisar la interfaz en local con el banco de pruebas (`.env.local` con `VITE_MODO_PRUEBA_LOCAL=1` y `npm run dev`) o con `node scripts/capturas-moviles.mjs`.

## Scripts

- `npm run dev`: servidor de desarrollo
- `npm run build`: compila TypeScript y genera el build de producción
- `npm run preview`: sirve el build de producción localmente
- `npm test`: ejecuta las pruebas (Vitest)
- `npm run lint`: analiza el código con Oxlint
- `npm run prueba:pwa`: prueba de verdad la actualización de la app instalada (versión A a B, con Chrome)
- `npm run prueba:sin-conexion`: prueba de verdad la app sin red (build de producción, service worker, sesión inventada y el autenticador virtual de WebAuthn de Chrome para el desbloqueo del dispositivo)
- `node scripts/vectores-webauthn.mjs`: vuelve a generar con Chrome los vectores reales de WebAuthn que verifican las pruebas (`src/lib/webauthn.vectores-chromium.json`)

Cada push y cada pull request a `main` repite `npm ci`, `npm test`, `npm run lint` y `npm run build` en GitHub Actions (`.github/workflows/ci.yml`): un cambio no está listo hasta que ese workflow termina en verde.
