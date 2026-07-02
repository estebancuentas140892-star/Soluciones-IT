# Soluciones IT

Aplicación web instalable (PWA) para el equipo de soporte y mantenimiento de TI: base de conocimiento por categorías, inventario de dispositivos, bóveda de IP y credenciales, y búsqueda global, todo con funcionamiento offline.

Ver [ARQUITECTURA.md](ARQUITECTURA.md) para el detalle técnico y [TAREAS.md](TAREAS.md) para el estado del desarrollo.

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

## Scripts

- `npm run dev`: servidor de desarrollo
- `npm run build`: compila TypeScript y genera el build de producción
- `npm run preview`: sirve el build de producción localmente
- `npm run lint`: analiza el código con Oxlint
