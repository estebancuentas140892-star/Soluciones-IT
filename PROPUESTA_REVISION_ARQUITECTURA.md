# Revisión arquitectónica completa (2026-07-17)

Revisión sección por sección de toda la aplicación contra el código real, con foco en arquitectura, reutilización, automatización y experiencia móvil. NO propone funciones nuevas: propone converger, extraer piezas compartidas y explotar el valor ya recolectado, sin deuda técnica ni duplicación.

Filosofía rectora (del proyecto): cada dato existe una sola vez y todo lo demás lo referencia; evitar duplicidad; reducir trabajo manual; automatizar; diseñar primero la arquitectura; priorizar móvil. Decisión de tema: solo oscuro (Nocturne), REGLAS.md regla 12.

## 1. Veredicto global

Tres capas, tres estados de salud muy distintos:

- **Capa de lógica pura: excelente, no tocar.** `lib/grafo.ts`, `lib/conexiones.ts`, `features/red/arbol.ts`, `lib/procedimiento.ts`, `lib/diagnostico.ts`, `lib/referencia.ts`, `lib/crypto.ts`. Funciones puras, probadas, sin React ni base local, con corte de ciclos, orden natural, validaciones explicadas en español y transiciones compartidas entre modo real y modo prueba. Es "diseñar primero la arquitectura" ya cumplido. La criptografía (AES-256-GCM + PBKDF2 600k, formato versionado por bloque, verificador anclado al servidor) es correcta.
- **Capa de datos: sólida y bien decidida.** JSON-en-fila para procedimientos y árboles de diagnóstico (atómico para offline), grafos derivados nunca almacenados, registros inmutables (historial, ejecuciones, accesos), patrón de copia de referencia (id + título congelado) con regla de frescura viva. No requiere rediseño. Casi ningún cambio de esquema en toda esta propuesta.
- **Capa de presentación: fragmentada y con duplicación.** Aquí está el 90 % del trabajo pendiente, y casi todo es refactor de cliente.

## 2. Hallazgos transversales (se repitieron en casi todas las secciones)

1. **Tres sistemas de diseño vivos a la vez.** Nocturne oscuro (Soluciones lista, Ficha de Procedimiento); AppShell claro (Dispositivos, Red, Topología); Layout oscuro viejo `slate-*` (Inicio, Bóveda, Diagnóstico, Cuenta/Seguridad, CategoriaPage, formularios). El flujo salta de tema a mitad de recorrido; el peor caso es Dispositivos/Red (lista clara → ficha oscura). Con la regla 12, todo converge a Nocturne oscuro; el tema claro y el Layout viejo se retiran.
2. **Cuatro buscadores.** Índice global MiniSearch (Inicio, con fuzzy y sinónimos) + tres filtros de subcadena caseros (Soluciones, Dispositivos, Red) que reinventan una versión peor. El índice global ya indexa artículos, dispositivos y diagnósticos: debe ser el único.
3. **La fila de dispositivo, copiada 3 veces** (Dispositivos, Red, Categoría) con markup y helpers casi idénticos.
4. **Iconos SVG inlineados 4+ veces** (Inicio, Dispositivos, Red...), varios byte a byte idénticos, en vez de venir de `components/iconos.tsx`.
5. **Dos mapeos de estado de dispositivo** (`dispositivos/estados` y `red/topologiaVisual`) que pueden divergir.
6. **`CLASE_INPUT`/`claseCampo` repetido en 4 formularios** (Artículo, Dispositivo, Credencial, Diagnóstico), y el editor de campos clave/valor DUPLICADO entre Dispositivos y Bóveda. Es la mayor oportunidad de reutilización de la app.
7. **Helpers puros duplicados** (`texto(valor)` en procedimiento.ts y diagnostico.ts; el patrón "conservar título solo si hay id" en varios normalizadores).
8. **Valor recolectado sin explotar.** `ejecuciones_diagnostico` acumula problema, camino, resuelto, motivo y duración; nadie los ve (no hay tablero). Es el aprendizaje del equipo esperando ser surfaceado.

## 3. Veredicto por sección

| Sección | Núcleo | Principal pendiente |
|---|---|---|
| Inicio | Buscador como pantalla principal | Migrar a Nocturne; rejilla de categorías con color; recientes derivadas del historial (hoy manual); cumple a medias su propia spec (faltan accesos a categorías) |
| Color (base) | No existe color de categoría (solo acento único; el "verde de mantenimiento" es color de TIPO) | Columna `color` en categorias + `colorDeCategoria` único + 10 tokens OKLCH oscuros + retirar color por tipo; separar 3 lenguajes: estado / categoría / tipo(forma) |
| Soluciones | Modelo de procedimiento y grafo, sólidos | Flujo salta Nocturne↔viejo (CategoriaPage y ArticuloForm rezagados); dos buscadores; dos vistas de categoría; `<FilaArticulo>` compartida |
| Dispositivos | Campos dinámicos aprendidos por categoría: el mejor patrón de la app | Lista clara → ficha/form oscuros (peor salto); primitivas de formulario; estado y buscador únicos; anti-duplicados serial/IP |
| Red | Inventario no duplicado + grafo derivado + lógica pura: ejemplar | Convergencia (claro→Nocturne); 4º buscador; 3ª fila; acción primaria debería ser "conectar equipos"; ubicación de texto libre parte grupos (argumento para N3) |
| Diagnóstico | Transiciones puras compartidas real/prueba + registro inmutable: de lo mejor | Re-autoría a Nocturne; explotar el log (tablero de insights); bucle sugerencia→artículo; costura: dos mecanismos de árbol de decisión en paralelo (no fusionar) |
| Bóveda | Cripto + verificador anclado + RLS: correctos | Nocturne; `<CamposClaveValor>` duplicado con Dispositivos; categoría como vocabulario paralelo (N3); riesgo residual de fuerza bruta tras la tarea 69 (recomendar maestra larga) |
| Config/Cuenta y seguridad | Bloqueo de app reutiliza el verificador cripto de la bóveda (buena reutilización) | Convergencia a Nocturne; sin hallazgos de fondo |
| Historial (transversal) | Un solo componente para 5 entidades + fusión pura de 3 fuentes inmutables (`lineaDeTiempo.ts`): convergencia YA lograda, modelo a seguir | Solo heredará los tokens/color al migrar sus contenedores |
| Escáner (transversal) | Cámara a pantalla completa que abre fichas por QR; reutiliza la ficha | Menor; consistencia visual |

## 4. Hoja de ruta priorizada

Ordenada por dependencia y retorno. Casi todo es refactor de cliente, sin esquema.

### Fase 0 — Fundaciones compartidas (habilitan el resto)
Máximo apalancamiento: cada pieza se paga sola en las migraciones siguientes.
- Primitivas de formulario: `<Campo>`, `<CampoTexto>`, `<CampoSelect>`, `<CampoConSugerencias>` (input+datalist), `<CamposClaveValor>`. Elimina `CLASE_INPUT`×4 y el editor clave/valor duplicado.
- `useVocabulario(campo)` (dedup de `valoresUnicos`).
- Centralizar iconos inline en `components/iconos.tsx`.
- Estado de dispositivo en una sola fuente; helpers `texto()`/`refViva()` compartidos.
- Sistema de color por categoría (tokens + `colorDeCategoria` + retirar color por tipo). Base visual de todas las migraciones.

### Fase 1 — Convergencia de diseño (regla 12: todo a Nocturne oscuro)
Reusando la Fase 0. Orden por dolor: Dispositivos (lista clara) → Red/Topología → CategoriaPage y ArticuloForm → Inicio, Bóveda, Diagnóstico, Cuenta/Seguridad. Al terminar, retirar `AppShell` claro y `Layout` viejo.
- Unificar los 4 buscadores en el índice global filtrado por tipo.
- `<FilaDispositivo>` y `<FilaArticulo>` compartidas; `esDeRed()` como único dueño de la regla `es_red`.

### Fase 2 — Explotar el valor recolectado (automatización; el "cerebro que aprende")
Sin esquema; sale de datos que ya se guardan.
- Tablero de insights sobre `ejecuciones_diagnostico` (problemas frecuentes, tasa de éxito por solución, tiempos).
- Bucle sugerencia→borrador de artículo.
- Recientes / más usadas derivadas del historial (Inicio), en vez de registro manual.
- Anti-duplicados de inventario (serial/IP), como ya hace Soluciones con títulos.
- Avisos proactivos: procedimientos vinculados rotos en las listas; vencimientos de credenciales en Inicio.

### Fase 3 — Evoluciones de esquema (una sola intervención)
Agrupar TODO lo de esquema en una aplicación del `schema.sql`. **Decisiones de forma resueltas el 2026-07-17** (ya no hay nada abierto que bloquee N3):
- Columna `color` en `categorias` (para overrides; el color arranca derivado del `orden` sin esquema en la Fase 0).
- Tabla `ubicaciones` **con jerarquía** (`padre_id` opcional) + `dispositivos.ubicacion_id` + migración asistida de textos (resuelve los grupos partidos de Red).
- `credenciales.dispositivos` (lista `{id, nombre}`) **sin cifrar**: la ficha del equipo lista sus credenciales sin desbloquear; el vínculo solo lo ve quien tiene acceso a la bóveda (RLS).
- Columna de **orden de rutas de inicio en `articulos`** (aplica también a manuales sin procedimiento).
- Tipo **`'relacionado'` en `conexiones`** (relacionar equipos no-red; no entra en la topología).
- `entidad_tipo` 'ubicacion' en `historial`.

Detalle de las decisiones en la sección 12 de [PROPUESTA_BASE_CONOCIMIENTO.md](PROPUESTA_BASE_CONOCIMIENTO.md). Falta solo agendar e implementar N3 como un único grupo de esquema.

## 5. Qué NO hacer (defender decisiones actuales)

- NO normalizar `procedimiento`/`nodos`/`detalles` a tablas: rompería la atomicidad offline y multiplicaría conflictos de sincronización. El JSON-en-fila es correcto.
- NO crear una tabla de "pasos reutilizables": para 5 técnicos es complejidad enorme. La reutilización correcta ya existe (vincular un artículo-procedimiento por id) y se sostiene con la sugerencia automática.
- NO fusionar los dos mecanismos de árbol de decisión (diagnóstico vs. decisión de paso): sirven a entradas distintas. Reconocer la costura y compartir capa, no modelo.
- NO tocar la criptografía de la bóveda: está correcta.
- NO reintroducir tema claro (regla 12).

## 6. Recomendación de arranque

Empezar por la Fase 0 (primitivas de formulario + sistema de color): es el mayor retorno, desbloquea todas las migraciones de la Fase 1 y ataca directamente dos pedidos explícitos del usuario ("formularios repetitivos" y "cada categoría con su color"). El único cambio de esquema de esa fase (columna `color`) se agrupa con la Fase 3.
