# Propuesta: biblioteca de pasos reutilizables y ejecución guiada

Fecha: 2026-08-24. Estado: **plan, sin código escrito**. Cada fase espera confirmación explícita del usuario antes de tocar `src/`.

Encargo original: llevar el principio "cada dato existe una sola vez" a los pasos de las guías, y quitar los puntos de fricción de quien EJECUTA una guía (no de quien la escribe).

Todo lo que sigue está contrastado contra el código real, con ruta y línea. Lo que NO se verificó se marca como tal.

---

## 0. Diagnóstico previo (lo que ya existe y cambia el alcance)

Antes del plan, siete hechos del código que modifican lo que hay que construir. Están primero a propósito: dos de ellos reducen trabajo y tres lo aumentan.

**0.1. La reutilización a nivel de PASO completo ya existe.** `PasoProcedimiento.subArticuloId` / `subArticuloTitulo` (`src/lib/db.ts:168-176`) permite que un paso ejecute otro artículo completo como subprocedimiento, con referencia viva, resolución en ejecución (`ProcedimientoVista.tsx:404`, `SubProcedimientoEnPaso`), avance propio (`useProcedimientoEjecucion.ts:60-92`) y arista de grafo `'subprocedimiento'` con su inverso "Usado como subprocedimiento en" (`components/ReferenciadoPor.tsx:15`). El hueco real es **solo a nivel de bloque `tarea`**, que es exactamente lo que pide la Fase 1. Conviene documentar la diferencia para que las dos formas no compitan: guía completa reutilizada = `subArticuloId`; acción suelta reutilizada = biblioteca de tareas.

**0.2. `AsistenteVista` no muestra los requisitos.** Grep de `requisitos` en `src/features/soluciones/AsistenteVista.tsx`: cero coincidencias. `ProcedimientoVista.tsx:103-114` sí los pinta ("Antes de empezar"), pero el modo ejecución (el que usa el técnico en el sitio) los omite por completo. La Fase 2 no es solo "estructurar" los requisitos: tiene que **reponerlos** en el asistente.

**0.3. El patrón "en curso" de la Fase 6b ya está construido dos veces.** `InicioPage.tsx:190-214` ("Continuar donde quedaste", sobre `progresoPasos`) y `DiagnosticosPage.tsx:48-58` ("Diagnóstico en curso", sobre `progresoDiagnostico`) son el mismo algoritmo con distinta tabla. Además `AsistenteVista.tsx:80-96` ya arranca en el primer paso pendiente. La Fase 6b se reduce a: extraer un hook compartido (las dos copias son deuda de la Fase 0 de `PROPUESTA_REVISION_ARQUITECTURA.md`) y colocar la tarjeta también en Soluciones y en la ficha del artículo.

**0.4. Las categorías no tienen editor en la aplicación.** Coincide con lo que dice la auditoría en `§26` ("Semilla de `schema.sql` (sin editor de UI confirmado)"). Verificado: ninguna pantalla escribe en `db.categorias`, solo leen. La Fase 4 (avisos heredados por categoría) **exige construir ese editor**, o los avisos solo se podrían crear con SQL. Es alcance nuevo que el usuario debe aceptar de forma explícita.

**0.5. El `schema.sql` sigue sin aplicarse en producción.** `TAREAS.md` lo marca como bloqueante desde la tarea 116, con tres grupos acumulados (N3, P1, P5). Las Fases 1 y 4 agregan esquema. Recomendación: aplicar lo pendiente ANTES de sumar una cuarta capa, o la pastilla de sincronización seguirá en "Con error" y no se podrá distinguir un fallo nuevo de los viejos.

**0.6. `ReferenciadoPor` sigue escrito con el tema claro heredado.** `components/ReferenciadoPor.tsx:82-100` usa `border-slate-800`, `bg-slate-900`, `text-slate-400`, `bg-slate-950`, `text-sky-400`. La tarea 113 dio por extinguido el tema claro en todo el proyecto y la tarea 125 borró `Seccion.tsx` justo por esto. Las Fases 1 y 5 hacen ese componente mucho más visible. Decisión a tomar: re-autorizarlo a Nocturne dentro de la Fase 1, o dejarlo como tarea aparte.

**0.7. El progreso local no se rompe con ninguna de estas fases.** `ProgresoPasos.instruccionesHechas` (`db.ts:713-720`) guarda ids de bloque, y un bloque que referencia la biblioteca **conserva su propio id** dentro del artículo (lo que se referencia es el contenido, no el bloque). Por eso ningún avance guardado se invalida al migrar. Es la razón principal por la que el diseño de la Fase 1 va por "campo nuevo en el bloque" y no por "sustituir el bloque".

---

## FASE 1: biblioteca de pasos reutilizables

### 1.1. Modelo de datos

Tabla nueva `tareas_reutilizables`. Nombre con guion bajo a propósito: el motor de sincronización usa el MISMO nombre local y remoto (criterio ya aplicado en `campos_protegidos`, `ejecuciones_diagnostico`, `accesos_boveda`).

```ts
// src/lib/db.ts
// Una acción que varias guías comparten ("Verificar la conexión de red",
// "Reiniciar el switch"). Vive UNA sola vez y las guías la referencian;
// mismo espíritu que CredencialEnPaso, donde el paso nunca copia el
// secreto sino su id. Editarla aquí actualiza todas las guías que la usan.
export interface TareaReutilizable {
  id: string
  texto: string
  tipoTarea: TipoTarea
  // Secreto de la bóveda de apoyo, o null. Ver decisión D2: solo
  // 'credencial', nunca 'campo' (un campo protegido pertenece a UN
  // equipo, así que no es reutilizable entre guías de equipos distintos).
  vinculoProtegido: VinculoProtegido | null
  // Categoría para agrupar y filtrar en el selector, o null (transversal).
  categoriaId: string | null
  // Nota para el autor ("cuándo usar esta tarea"), no se muestra al ejecutar.
  notas: string
  updatedAt: string
  updatedBy: string | null
  eliminadoEn: string | null
}
```

`BloquePaso` (`db.ts:130-140`) gana **un solo campo**:

```ts
  // Referencia viva a una tarea de la biblioteca, o null (tarea propia
  // de esta guía, el caso de todo lo guardado hasta hoy). Cuando está
  // puesto, `texto`, `tipoTarea` y `vinculoProtegido` del bloque pasan a
  // ser COPIA DE REFERENCIA: se muestran solo si la fila de la
  // biblioteca no está local (sin sincronizar o eliminada), misma regla
  // que subArticuloTitulo o que credencialTitulo.
  tareaRefId: string | null
```

Se reutiliza `texto` como copia de referencia en vez de agregar `tareaRefTexto`: es exactamente el patrón de `subArticuloTitulo` y de `VinculoProtegido.titulo`, y evita un campo redundante en un JSON que ya es denso.

### 1.2. Esquema Dexie y Supabase

Dexie versión **13** (la actual es la 12, `db.ts:889-891`):

```ts
// Biblioteca de tareas reutilizables: una acción compartida vive una
// sola vez y las guías la referencian. Indexada por categoriaId para
// poder poblar el selector por categoría sin recorrer la tabla entera.
// El campo nuevo de `BloquePaso` (tareaRefId) NO se declara aquí: vive
// dentro del JSON de `articulos.procedimiento`, igual que el resto.
this.version(13).stores({
  tareas_reutilizables: 'id, categoriaId, updatedAt',
})
```

`src/lib/tablas.ts`: entrada nueva **al final** de `TABLAS_SINCRONIZADAS` (regla ya escrita en el propio archivo: las más nuevas al final, para que su fallo no impida descargar las demás), más `configTablas.tareas_reutilizables` con `porDefecto: { texto: '', tipoTarea: 'accion', notas: '' }` (solo columnas NOT NULL DEFAULT, según el contrato que fijó la tarea 128).

`supabase/schema.sql`, en un bloque nuevo al final con el mismo estilo de comentario que el grupo P1:

```sql
create table if not exists public.tareas_reutilizables (
  id uuid primary key default gen_random_uuid(),
  texto text not null default '',
  tipo_tarea text not null default 'accion' check (tipo_tarea in ('accion','verificacion','decision')),
  vinculo_protegido jsonb,
  categoria_id uuid references public.categorias (id),
  notas text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id),
  eliminado_en timestamptz
);
create index if not exists idx_tareas_reutilizables_updated on public.tareas_reutilizables (updated_at);
create index if not exists idx_tareas_reutilizables_categoria on public.tareas_reutilizables (categoria_id);
```

RLS: la misma de `articulos` (lectura y escritura para autenticados), **no** la de bóveda. El texto de una tarea no es un secreto, y `vinculo_protegido` solo guarda un id y un título, exactamente como ya viaja hoy dentro de `articulos.procedimiento`. Sin cambio de criterio.

También hay que ampliar el CHECK de `historial.entidad_tipo` para admitir `'tarea_reutilizable'` (mismo `alter table ... drop constraint / add constraint` que usó el grupo P1 en `schema.sql:434-436`) y sumar el valor a `TipoEntidadHistorial` en `db.ts:605-614`.

### 1.3. Resolución de la referencia (viva, nunca snapshot)

Archivo nuevo `src/lib/tareasReutilizables.ts`, lógica pura y testable:

```ts
export interface TareaResuelta {
  texto: string
  tipoTarea: TipoTarea
  vinculoProtegido: VinculoProtegido | null
  // true si el contenido vino de la biblioteca (para la insignia).
  deBiblioteca: boolean
  // true si el bloque referencia una tarea que no está local o fue
  // eliminada: se cayó a la copia de referencia y hay que avisarlo.
  referenciaRota: boolean
}

export function resolverTarea(
  bloque: BloquePaso,
  biblioteca: Map<string, TareaReutilizable>,
): TareaResuelta
```

Usa `textoVivo` de `src/lib/referencia.ts` para el texto, y toma `tipoTarea` y `vinculoProtegido` de la fila viva cuando existe. Ninguna pantalla reinventa la regla, igual que hoy con `nombreVivo`.

Hook `useBibliotecaTareas()` en `src/features/soluciones/`: **una** `useLiveQuery` que devuelve el `Map`, no una consulta por bloque. Se construye una vez en `ProcedimientoVista`, `AsistenteVista`, `PasosEditor` y `VistaPreviaArticulo`, y baja por props hasta `BloqueVista` (`ProcedimientoVista.tsx:666`) y `FilaTarea` (`ProcedimientoVista.tsx:614`). Motivo: `BloqueVista` se renderiza decenas de veces por pantalla; una live query por bloque sería un patrón nuevo y peor que el existente.

Cambios en `src/lib/procedimiento.ts`:
- `normalizarBloque` lee `tareaRefId` (string no vacío, o null). Los bloques ya guardados no lo traen: quedan en null y se comportan **exactamente** como hoy. Cero riesgo de regresión.
- `limpiarBloques` (`procedimiento.ts:508-524`) hoy descarta toda tarea con texto vacío. Hay que exceptuar las que tienen `tareaRefId`: su texto es solo respaldo y puede quedar vacío legítimamente.
- `duplicarProcedimiento` conserva `tareaRefId` (es una referencia, no contenido). Ya es lo que dice su comentario para el resto de vínculos.
- `textoDeProcedimiento` (índice de búsqueda) **debe** resolver la biblioteca, o una guía dejará de encontrarse por el texto de sus propias tareas. Como la función es pura y no puede consultar Dexie, la firma pasa a `textoDeProcedimiento(procedimiento, biblioteca?)` y quien la llama (`features/busqueda/useIndiceBusqueda.ts`) le pasa el mapa. **Este punto es obligatorio, no opcional**: sin él la Fase 1 degrada el buscador global.

### 1.4. Interfaz de edición (`PasosEditor`)

Hoy el pie de cada paso tiene tres botones (`PasosEditor.tsx:437-447`): Tarea, Advertencia, Imagen. Pasa a cuatro:

| Botón | Acción |
|---|---|
| `+ Tarea` | Igual que hoy: bloque nuevo, texto propio de esta guía. |
| `+ De la biblioteca` | Abre un selector (mismo patrón visual que `VinculoDelPaso`, `PasosEditor.tsx:560`) agrupado por categoría, con buscador, que inserta un bloque con `tareaRefId` y el texto como copia. |
| `+ Advertencia` | Sin cambios. |
| `+ Imagen` | Sin cambios. |

Un bloque referenciado se ve distinto **de forma inequívoca**: fondo `bg-noct-surface`, campo de texto en solo lectura, `TagNeutral` con "De la biblioteca", y dos acciones: "Abrir en la biblioteca" (navega a su ficha) y "Convertir en tarea propia" (copia el texto vivo al bloque y pone `tareaRefId: null`, salida sin puerta trasera).

Además, cada bloque `tarea` normal gana en su menú "Guardar en la biblioteca": crea la fila con `guardarRegistro('tareas_reutilizables', ...)` y convierte ese mismo bloque en referencia **en el sitio**, sin duplicar nada. Es la vía natural por la que crece la biblioteca durante el trabajo real, sin obligar a nadie a ir primero a una pantalla aparte.

### 1.5. Pantallas nuevas

- `/soluciones/biblioteca`: lista de tareas reutilizables, con chips de categoría y buscador local. Reutiliza el layout de listas de Soluciones.
- `/soluciones/biblioteca/:tareaId`: ficha con el texto, su tipo, su vínculo protegido, el bloque "Usado en" (grafo), `Historial` y `DialogoEliminar` con `resumenImpacto`. Editar desde aquí actualiza todas las guías: la ficha lo dice de forma literal antes de guardar ("Esta tarea se usa en N guías. El cambio se verá en todas.").
- Entradas nuevas en `src/lib/navegacion.ts` (`padreDe`), obligatorio por la regla 13 de `REGLAS.md`.
- Acceso desde el menú de overflow de `SolucionesPage`, junto a los que ya existen.

### 1.6. Grafo

`src/lib/grafo.ts`:
- `TipoEntidad` suma `'tarea_reutilizable'`.
- `TipoRelacion` suma `'tarea_biblioteca'` (artículo que usa una tarea de la biblioteca).
- `DatosGrafo` suma `tareasReutilizables: TareaReutilizable[]`; `useGrafo` (`components/useGrafo.ts`) suma su live query.
- Al recorrer los bloques (`grafo.ts:99-110`), un bloque con `tareaRefId` emite la arista `articulo -> tarea_reutilizable`.
- **Aplanado obligatorio**: ese mismo bloque emite ADEMÁS la arista `articulo -> credencial` con el `vinculoProtegido` de la tarea de biblioteca. Sin esto, `resumenImpacto` sobre una credencial contaría de menos y el diálogo de eliminar diría "no se usa en ningún sitio" cuando sí se usa a través de la biblioteca. Es un riesgo de pérdida de datos, no cosmético.
- `categoriaImpacto` clasifica `'tarea_biblioteca'` como `'procedimiento'` (las guías son lo que se rompería).
- `ReferenciadoPor` suma la etiqueta `tarea_biblioteca: 'Usada en el procedimiento'` y su posición en `ORDEN_RELACION`.

Las pruebas de `src/lib/grafo.test.ts` (437 líneas) y `src/lib/procedimiento.test.ts` (880 líneas) se extienden en el mismo estilo: normalización tolerante, aplanado del vínculo protegido, ida y vuelta de "guardar en biblioteca" y "convertir en tarea propia".

### 1.7. Migración de lo que hoy está embebido

**Regla: nada automático.** La versión 13 de Dexie solo crea la tabla. Ningún bloque existente se toca; todos quedan con `tareaRefId: null` y se comportan igual que hoy. Riesgo de migración: cero.

La conversión llega después, **asistida y reversible**, en `/soluciones/biblioteca/migrar`, con el mismo patrón ya probado dos veces en el proyecto (`MigracionUbicaciones`, `MigracionCredenciales`, descrito en la auditoría `§15.5`):

1. Recorre todos los artículos no eliminados y agrupa los bloques `tarea` por texto normalizado (`normalizarTexto`, ya existe en el proyecto).
2. Propone solo los grupos con 2 o más apariciones **en 2 o más artículos distintos**. Un texto repetido dentro de una sola guía no es reutilización, es una lista.
3. Muestra el informe previo: el texto, cuántas guías lo usan, cuáles, y si sus `vinculoProtegido` coinciden (si difieren, **no se propone**: son tareas distintas que se parecen).
4. Al confirmar, por cada grupo: crea UNA fila en `tareas_reutilizables` y reescribe esos bloques a referencia, con un `guardarRegistro` por artículo (historial y outbox normales). Nunca se borra el texto: queda como copia de referencia.
5. Cada bloque se puede devolver a texto propio uno por uno desde el editor, así que la operación es reversible sin restaurar respaldos.

No se pierde nada y no se duplica nada: la fila nueva contiene el mismo texto que los bloques que la referencian, y esos bloques dejan de ser fuente para pasar a ser referencia.

### 1.8. Decisiones que necesito del usuario

- **D1.** ¿Granularidad de bloque (lo pedido) sabiendo que la de paso completo ya existe vía `subArticuloId`? Recomendación: sí, bloque, y documentar la diferencia en `ARQUITECTURA.md` para que no compitan.
- **D2.** ¿Una tarea de biblioteca puede llevar `vinculoProtegido` de tipo `'campo'`? Recomendación: **no**, solo `'credencial'`. Un campo protegido pertenece a UN equipo (`db.ts:611-620`); una tarea compartida entre guías de equipos distintos que apunte al campo de uno solo mostraría el dato equivocado. El selector de la biblioteca ofrecería únicamente el grupo "Secretos de la bóveda".
- **D3.** ¿Editar una tarea de biblioteca debe mostrar antes cuántas guías afecta? Recomendación: sí, con `resumenImpacto`, mismo aviso que ya se da al eliminar.

---

## FASE 2: prerrequisitos estructurados

### 2.1. Modelo (sin esquema, sin versión de Dexie)

Vive dentro del JSON de `procedimiento`, igual que `portada` (`db.ts:390-396`), así que no necesita columna nueva ni versión de Dexie. Es la razón de ponerlo aquí y no en una tabla.

```ts
export type TipoRequisito = 'credencial' | 'campo' | 'dispositivo' | 'articulo' | 'herramienta'

// Un requisito previo de la guía: acceso, dato protegido, equipo,
// otra guía que hay que haber completado, o una herramienta física.
// Los cuatro primeros REFERENCIAN una entidad real (id + copia del
// título, mismo patrón que dispositivosAfectados); 'herramienta' es
// texto libre a propósito (un destornillador no es una entidad).
export interface RequisitoVinculado {
  id: string
  tipo: TipoRequisito
  refId: string | null
  titulo: string
  nota: string
}
```

`Procedimiento` suma `requisitosVinculados: RequisitoVinculado[]`.

**`requisitos: string[]` se conserva intacto.** Nada se migra ni se borra: los requisitos escritos hasta hoy siguen mostrándose. La conversión de texto a vínculo se hace a mano cuando alguien edite la guía, no de golpe.

`normalizarProcedimiento` lo parsea con tolerancia (ausente = `[]`), mismo estilo que el resto del archivo.

### 2.2. Edición

En `ArticuloForm`, pestaña Pasos, encima del textarea actual (`ArticuloForm.tsx:629-638`): un editor de lista donde cada fila es tipo + selector. Los selectores se reutilizan tal cual: credenciales y campos del equipo salen de las mismas consultas de `PasosEditor.tsx:150-195`; dispositivos, del selector que ya usa `dispositivosAfectados`; guías, de `vinculables` (`PasosEditor.tsx:199-212`).

El textarea de texto libre se queda abajo, rotulado "Otros requisitos (texto libre)".

### 2.3. Ejecución (lo que arregla el hueco 0.2)

- `ProcedimientoVista`: el bloque "Antes de empezar" (`ProcedimientoVista.tsx:103-114`) pinta primero los vinculados, con icono por tipo, título vivo y enlace navegable, y después los de texto libre.
- `AsistenteVista`: **pantalla previa nueva**, antes del paso 1, con el título "Antes de empezar" y un botón "Todo listo, empezar". Los requisitos con `vinculoProtegido` se muestran contraídos vía `CredencialEnPaso`, que ya sabe descifrar bajo demanda. No bloquea: si el técnico toca empezar sin marcar nada, entra igual. Es coherente con la filosofía del proyecto (la completitud avisa, nunca frena, `§16` de la auditoría). La pantalla solo aparece si hay al menos un requisito.

### 2.4. Grafo

Una sola relación nueva `'requisito'`, con `destinoTipo` llevando la clase (credencial, campo, dispositivo o artículo). Etiqueta en `ReferenciadoPor`: "Requisito previo de". Con esto, la ficha de una credencial ya dice qué guías la exigen antes de empezar, sin que nadie lo escriba.

El requisito de tipo `'articulo'` **es** el "requiere haber completado" de la Fase 5: se define una sola vez, aquí.

---

## FASE 3: placeholders de datos del equipo

### 3.1. Sintaxis

`{{equipo.<campo>}}`. Campos admitidos, todos de `Dispositivo` (`db.ts:289-317`):

`nombre`, `marca`, `modelo`, `serial`, `placaInventario`, `ip`, `estado`, `ubicacion` (resuelta en vivo contra `ubicaciones` cuando hay `ubicacionId`, según la regla de referencia viva), y `{{equipo.detalles.<clave>}}` para el diccionario libre.

Cualquier otra cosa **no se sustituye y no se rompe**: se deja el literal tal cual, para que un texto que casualmente traiga llaves no desaparezca.

Se eligió `{{ }}` por ser el delimitador que ningún texto técnico de esta base usa hoy (verificado por grep sobre `src/`: cero apariciones en textos de datos).

### 3.2. Dónde se resuelve

Archivo nuevo `src/lib/placeholders.ts`, función pura:

```ts
export function sustituirPlaceholders(
  texto: string,
  equipo: Dispositivo | null,
  nombreUbicacion?: string | null,
): { partes: ParteTexto[]; faltantes: string[] }
```

Devuelve **partes**, no un string, porque un campo sin valor no se pinta como texto plano: se pinta como una pastilla neutra. Se aplica **solo al renderizar** (`BloqueVista`, título y objetivo del paso, requisitos de texto libre), nunca al guardar. En la base siempre queda el literal `{{equipo.ip}}`, que es la única forma de que la guía siga sirviendo para cualquier equipo.

### 3.3. Qué equipo es "el equipo actual"

Hoy no existe ese concepto. `AsistenteVista.tsx:57-58` usa `articulo.dispositivosAfectados[0]` para la evidencia fotográfica, que es una aproximación. Propuesta, en orden:

1. Parámetro de URL `?equipo=<id>` en la ficha y en `/ejecutar`. Lo pone `ProcedimientosDelEquipo` de la ficha del dispositivo, que es de donde nace el flujo real ("estoy frente a ESTE equipo").
2. Si no viene y `dispositivosAfectados` tiene exactamente uno, ese.
3. Si no viene y la guía contiene placeholders, `AsistenteVista` pregunta al empezar: "¿Sobre qué equipo vas a ejecutar?", con la lista de equipos de la categoría de la guía. Es una pantalla que también mejora la evidencia fotográfica actual y alimenta la Fase 6c.
4. Si el técnico la salta, contexto nulo.

### 3.4. Qué pasa si el campo no existe

Nunca se muestran las llaves crudas y nunca se muestra un hueco en blanco. Tres casos:

| Situación | Qué se ve |
|---|---|
| Campo con valor | El valor, en `font-mono` cuando es IP o serial, tocable para copiar (mismo gesto que la ficha del equipo). |
| Campo vacío o inexistente en ESE equipo | Pastilla neutra con el nombre del campo: `(IP del equipo)`, en `text-noct-neutral-500`. |
| Sin equipo de contexto | Igual que el anterior, más un aviso de una línea arriba del paso: "Este paso usa datos del equipo. Elegí uno para verlos." con enlace a elegirlo. |

### 3.5. Consecuencia sobre el buscador (a aceptar de forma consciente)

`textoDeProcedimiento` indexa el literal. Buscar "192.168.1.1" no encontrará una guía que lo muestre vía placeholder. Es correcto: ese dato pertenece al equipo, y el equipo sí está indexado por su IP. Se anota para que nadie lo lea después como un defecto.

---

## FASE 4: avisos heredados por categoría

### 4.1. Modelo

Columna nueva en una tabla existente, así que **no necesita versión de Dexie** (Dexie solo declara índices; los campos viven dentro del objeto, criterio ya escrito en `db.ts:857-864`). Solo `schema.sql` y `tablas.ts`.

```sql
alter table public.categorias add column if not exists avisos jsonb not null default '[]'::jsonb;
```

```ts
export interface AvisoCategoria { id: string; texto: string; tono: TonoAviso }
// Categoria suma: avisos: AvisoCategoria[]
```

`tablas.ts`: `campos.avisos = 'avisos'` y `porDefecto.avisos = []` (contrato NOT NULL DEFAULT, tarea 128).

Reutiliza `TonoAviso` y `tonos.ts` tal cual: cero vocabulario nuevo.

### 4.2. Alcance oculto que hay que aceptar

Como dice el punto 0.4, **no hay editor de categorías**. La Fase 4 incluye construirlo: pantalla `/soluciones/:categoriaId/editar` (o edición en línea dentro de `CategoriaPage`, que ya es la ficha 360 de la categoría) con nombre, color, `esRed` y la lista de avisos. Esto también cablea por fin el override manual de `categorias.color`, que existe desde N3.

Si el usuario prefiere no construir el editor ahora, la Fase 4 queda sin forma de crear los avisos y hay que posponerla entera. No hay término medio razonable.

### 4.3. Presentación

En `ProcedimientoVista` y `AsistenteVista`, arriba de "Antes de empezar", una sección con los avisos de `articulo.categoriaId`, pintados con el mismo componente y tono que un aviso propio, más un `TagNeutral` con el nombre de la categoría y enlace a su ficha. Un aviso propio de la guía se ve exactamente como hoy, sin insignia. La insignia es la única diferencia visual, y por eso es inequívoca.

Nunca se mezclan dentro de `procedimiento.pasos`: el aviso heredado se resuelve en pantalla, no se copia al artículo. Es el mismo principio que sostiene toda la propuesta.

Decisión menor: los artículos sin procedimiento (manuales) también deberían mostrarlos, en `ArticuloPage`. Recomendación: sí.

---

## FASE 5: guías relacionadas vía grafo

Sin esquema. Todo derivado, coherente con el comentario de cabecera de `grafo.ts`: "un grafo derivado no puede estar desactualizado".

Función nueva `guiasRelacionadas(...)` en `src/lib/grafo.ts`, con dos bloques bien separados en la ficha del artículo:

**a. "Requiere haber completado"** (explícito, sin inventar nada): sale de los `requisitosVinculados` de tipo `'articulo'` de la Fase 2, y su inverso ("es requisito de") también. Si el usuario no aprueba la Fase 2, este bloque necesitaría un campo propio y habría que replantearlo.

**b. "Guías que comparten lo mismo"** (calculado, con puntaje): recorre el grafo y suma señales, sin que el autor escriba nada:

| Señal | Puntos |
|---|---|
| Comparte una tarea de la biblioteca (Fase 1) | 3 |
| Comparte un dispositivo afectado | 3 |
| Comparte una etiqueta | 2 |
| Una embebe a la otra como subprocedimiento o solución | 2 |
| Misma categoría | 1 |

Se muestran las 5 mejores con puntaje 3 o más, excluyendo las que ya aparecen en "Artículos relacionados" (curados a mano) o en el bloque de requisitos, para que nada salga dos veces. Rotulado de forma honesta: "Guías que comparten lo mismo (calculado)". Que sea derivado tiene que verse; si no, un técnico lo leería como curaduría del equipo.

**Riesgo real**: con pocos artículos, un umbral bajo llena la ficha de ruido. Recomendación: entregar primero el bloque (a), medir con los datos reales del equipo y decidir (b) después con el corpus a la vista.

---

## FASE 6: UX de ejecución

### 6a. Breadcrumb de anidamiento

`ProcedimientoVista` y `AsistenteVista` ya llevan `nivel` (0 principal, 1 embebido). Suman una prop `ancestros: { id: string; titulo: string; ruta: string }[]`, que `SubProcedimientoEnPaso` (`ProcedimientoVista.tsx:404`) y `SolucionEnPaso` (`:483`) rellenan con el artículo padre y el número de paso.

En `nivel >= 1`, encabezado propio: `Guía principal › Paso 3 › Reiniciar el switch`, con el último tramo en `text-noct-accent-300` y los anteriores en `text-noct-neutral-500`. En el asistente va pegajoso, para que no se pierda al bajar. Se suma un borde izquierdo de acento en todo el bloque embebido, así la profundidad se ve incluso sin leer el breadcrumb. Sin datos nuevos, sin esquema.

### 6b. "En curso" para cualquier guía

Trabajo real, sabiendo que el algoritmo ya está escrito dos veces (punto 0.3):

1. Extraer `useProcedimientoEnCurso()` a `src/features/soluciones/`, con el cuerpo que hoy está en `InicioPage.tsx:190-214`. Inicio pasa a consumirlo (convergencia, no función nueva).
2. Tarjeta "Continuar donde quedaste" en `SolucionesPage`, con el mismo diseño de la tarjeta de `DiagnosticosPage.tsx:162-184`, oculta mientras hay filtro activo (fidelidad a lo que ya se decidió allí).
3. En `ArticuloPage`, cuando hay avance parcial, el botón "Ejecutar" pasa a "Retomar en el paso N de M" con su barra de progreso. El motor no cambia: `AsistenteVista.tsx:80-96` ya arranca en el primer pendiente.

Opcional a decidir: unificar también el "en curso" de diagnósticos en el mismo hook genérico. Se puede, pero mezcla dos tablas distintas; recomendación: no forzarlo.

### 6c. Salida a diagnóstico desde un paso

`IniciarDiagnosticoBoton` (`features/dispositivos/IniciarDiagnosticoBoton.tsx:14`) ya recibe solo `categoriaId` y ya devuelve `null` cuando no hay diagnósticos de esa categoría, así que no puede crear un callejón sin salida. Se usa tal cual.

Ubicación: en la rama de error que ya existe ("¿Ocurrió algún error durante este paso?"), junto a la solución vinculada, con el texto "Esto no lo resolvió: iniciar diagnóstico". La categoría sale del equipo de contexto de la Fase 3 y, si no hay, de `articulo.categoriaId`.

Detalle de orden: conviene mover el archivo de `features/dispositivos/` a `src/components/`, porque deja de ser exclusivo de la ficha de equipo. Cambio mecánico de import, sin lógica.

---

## Orden, dependencias y riesgos cruzados

| Fase | Esquema Supabase | Versión Dexie | Depende de |
|---|---|---|---|
| 1 | Sí (tabla nueva + CHECK de historial) | 13 | Aplicar antes el schema pendiente (0.5) |
| 2 | No | No | Nada |
| 3 | No | No | Nada (define el "equipo de contexto") |
| 4 | Sí (columna en `categorias`) | No | Editor de categorías (0.4) |
| 5 | No | No | Fase 2 para el bloque (a); mejora con Fase 1 |
| 6a | No | No | Nada |
| 6b | No | No | Nada |
| 6c | No | No | Fase 3 para el equipo de contexto (degrada bien sin ella) |

El orden pedido es correcto. Única sugerencia: **6b es barata, independiente y visible de inmediato**; si se quiere una victoria rápida antes de la Fase 1, es esa.

---

## Choques con decisiones existentes (señalados, no asumidos)

Tal como pide el encargo, esto se marca en vez de resolverse por cuenta propia:

1. **Doble mecanismo de reutilización.** `subArticuloId` ya reutiliza a nivel de paso. Si se aprueba la Fase 1, hay dos formas y el autor tiene que saber cuál usar. Se resuelve documentando, no con código, pero es una decisión de producto.
2. **`vinculoProtegido` de tipo `'campo'` en una tarea de biblioteca es semánticamente incorrecto** (decisión D2 de la Fase 1). No se puede asumir: cambia el selector.
3. **La Fase 4 exige un editor de categorías que hoy no existe.** Es alcance nuevo, no un detalle de implementación.
4. **`ReferenciadoPor` sigue en el tema claro heredado** pese a que la tarea 113 dio por cerrada la migración a Nocturne. Las Fases 1 y 5 lo hacen más visible. Decidir si se re-autoriza dentro de la Fase 1 o como tarea aparte.
5. **El índice de búsqueda deja de ser autosuficiente en la Fase 1** (punto 1.3). Está resuelto en el plan, pero implica cambiar la firma de una función pura ya probada; no es un cambio menor.
6. **Los placeholders de la Fase 3 no se indexan** (punto 3.5). Es la consecuencia correcta, se documenta para que no se "corrija" luego por error.
7. **Auditoría `§22.8`**: el alto táctil mínimo está repetido como literal por todo el proyecto. Toda la interfaz nueva de estas fases debe evitar sumar copias nuevas de ese valor.
8. **El `schema.sql` pendiente** (punto 0.5) es un bloqueo del usuario, no de código, y afecta a las Fases 1 y 4.

---

## Verificación exigida por fase

Para cada fase, antes de darla por terminada: `npm run typecheck`, lint, la suite completa de pruebas (hoy 588), `npm run build`, verificación en el navegador con el servidor de desarrollo, push a `main` y confirmación del despliegue en Vercel (regla 14 de `REGLAS.md`). Las fases con esquema suman: aplicar `supabase/schema.sql` y comprobar que la tabla nueva sincroniza sin dejar cambios atascados en la cola.
