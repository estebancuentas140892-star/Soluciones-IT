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

## Scripts

- `npm run dev`: servidor de desarrollo
- `npm run build`: compila TypeScript y genera el build de producción
- `npm run preview`: sirve el build de producción localmente
- `npm run lint`: analiza el código con Oxlint
