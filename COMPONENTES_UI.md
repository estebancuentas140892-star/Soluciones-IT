# Catálogo de componentes UI de Soluciones IT

Referencia de las primitivas y componentes reutilizables de la interfaz: propósito, props, variantes, un ejemplo real y dónde se usan. Pensado para reutilizar antes de escribir un componente nuevo y para incorporar desarrolladores.

Frontera con otros documentos: aquí se documenta el componente en sí (su contrato). La pantalla donde aparece y el flujo del usuario viven en [DOCUMENTACION_FUNCIONAL.md](DOCUMENTACION_FUNCIONAL.md); las decisiones de sistema visual (Nocturne, los tres lenguajes de color) en [ARQUITECTURA.md](ARQUITECTURA.md). El código es la fuente de verdad.

## 0. Regla transversal de Tailwind (leer antes de tocar variantes)

Dos utilidades Tailwind del mismo tipo (dos colores de texto, dos fondos, dos anchos) empatan en especificidad, y gana la que Tailwind emite después en la hoja, no la que se escribe al final del atributo `className`. Consecuencias que se repiten en todo el catálogo:

- Una variante de color de botón (`nocturne.tsx`) no se puede componer con `${BTN_GHOST} text-noct-error`; cada variante repite el juego completo (texto + hover + active).
- Un fondo de campo (`campos.tsx`) tiene su propia constante (`CLASE_CAMPO` vs `CLASE_CAMPO_SOBRE_SUPERFICIE`); no se concatena.
- `BotonFavorito` aplica el color de "activo" sobre el SVG, no sobre el botón.

Lo que sí se puede concatenar sin problema: `font-mono`, `text-center`, `min-h-*`.

## 1. Primitivas base

### 1.1 `src/components/nocturne.tsx` (variantes de botón y rótulos)

Fuente única de las variantes de botón del sistema Nocturne. Importado en unos 47 archivos.

Constantes de clase (para interpolar en `className`, no son componentes):

| Constante | Aspecto |
|---|---|
| `BTN_PRIMARIO` | delineado en acento |
| `BTN_SECUNDARIO` | delineado en el divisor |
| `BTN_PRIMARIO_PELIGRO` | delineado en rojo (ejecuta eliminación) |
| `BTN_GHOST` | sin borde, tinte al pasar |
| `BTN_GHOST_PELIGRO` | fantasma en rojo |
| `BTN_GHOST_ACENTO` | fantasma en acento |
| `BTN_GHOST_TENUE` | fantasma atenuado (descarte) |
| `BTN_ICONO_SECUNDARIO` | cuadrado 34x34 delineado |
| `BTN_ICONO_PELIGRO` | cuadrado 34x34 sin borde, rojo |

Componentes: `TituloSeccion({ children, className? })` y `TagNeutral({ children, className? })` (rótulos de sección y etiqueta neutra; importados en 27 archivos).

Ejemplo (`DialogoEliminar.tsx`):
```tsx
<button className={BTN_SECUNDARIO}>Cancelar</button>
<button className={`${BTN_PRIMARIO_PELIGRO} disabled:opacity-50`}>{textoConfirmar}</button>
```

### 1.2 `src/components/campos.tsx` (campos de formulario)

Fuente única de cómo se ve un campo y su etiqueta (antes `CLASE_CAMPO` estaba redefinida en 13 archivos con deriva visual). Importado en 22 archivos.

Constantes: `CLASE_CAMPO`, `CLASE_CAMPO_SIN_ANCHO` (sin `w-full`), `CLASE_CAMPO_SOBRE_SUPERFICIE` (fondo de tarjeta), `CLASE_CAMPO_MONO` y `CLASE_CAMPO_MONO_SIN_ANCHO` (monoespaciado, para claves/PIN/puertos), `CLASE_ETIQUETA`.

Componentes:

| Componente | Props |
|---|---|
| `Campo` | `{ etiqueta, ayuda?, children, className? }` (envoltorio `<label>` + rótulo) |
| `CampoConSugerencias` | `{ valor, onChange, sugerencias, placeholder?, className? }` (input + `datalist` derivado del uso real) |
| `CamposClaveValor` | `{ titulo, ayuda?, campos, onChange, sugerenciasClave?, valorMono?, valorAutoComplete? }` (editor de pares clave/valor) |

`CamposClaveValor` unifica las "Propiedades personalizadas" de un dispositivo y los "Otros datos protegidos" de un secreto.

### 1.3 `src/components/iconos.tsx` (set de iconos)

92 iconos Phosphor (MIT) inlineados como SVG propios, para no depender de CDN (rompe offline) ni cargar el paquete completo.

- Props: `IconoProps = SVGProps<SVGSVGElement> & { size?: number }`. `size` por defecto 16, `fill="currentColor"` (hereda el color del texto), `aria-hidden` por defecto.
- Variantes: el sufijo `Fill` marca la versión rellena (`Star`/`StarFill`, `House`/`HouseFill`, `Vault`/`VaultFill`...), usada típicamente para la pestaña activa.

## 2. Componentes de `src/components`

Convención: "Props" muestra la firma real; los opcionales llevan su default. "Dónde se usa" viene de los call sites reales.

### 2.1 `ActualizacionDisponible`
- **Propósito:** barra flotante que avisa cuando hay una versión nueva de la PWA y la aplica al tocar "Actualizar". Hace su propio chequeo cada hora.
- **Props:** ninguna. Devuelve `null` mientras no haya novedad.
- **Dónde:** montado una vez en `App.tsx`, global.

### 2.2 `Adjuntos`
- **Propósito:** galería de adjuntos de una ficha (subir desde cámara o archivo, ver, eliminar) con compresión, deduplicación por hash y cola offline.
- **Props:** `{ entidadTipo: 'articulo' | 'dispositivo' | 'historial', entidadId }` (ambas obligatorias).
- **Variantes:** decide imagen vs archivo genérico según el `tipo`; usa `VisorImagen` para imágenes.
- **Dónde:** `DispositivoPage`, `ArticuloPage`, `Historial` (adjuntos de una intervención), `RegistrarIntervencion`, `AsistenteVista`.

### 2.3 `BotonFavorito`
- **Propósito:** estrella para marcar/desmarcar una ficha como favorita.
- **Props:** `{ tipo: TipoFavorito, entidadId, variante?: 'cabecera' | 'fila' = 'cabecera' }`.
- **Variantes:** `'cabecera'` usa `BTN_ICONO_SECUNDARIO` (botón con borde, fila de acciones de una ficha); `'fila'` es solo el icono con tinte al pasar (fila de lista). El color activo va sobre el SVG.
- **Dónde:** `ArticuloPage`, `DispositivoPage` (cabecera), `DiagnosticosPage` (fila).

### 2.4 `BotonVolver`
- **Propósito:** botón de regreso unificado; deriva destino y etiqueta de la fuente única `padreDe` (`src/lib/navegacion.ts`) en vez de cablearlos a mano.
- **Props:** `{ to?, children? }`. `to` sobreescribe el destino derivado (contexto en runtime, ej. equipo de red vuelve a Red); `children` sobreescribe la etiqueta ("Salir", "Cancelar").
- **Dónde:** 31 archivos (casi toda cabecera de ficha o formulario).

### 2.5 `CampoContrasena`
- **Propósito:** campo para **escribir** un secreto que evita que el sistema operativo o gestores de terceros lo detecten como login y ofrezcan guardarlo. Complementario de `CampoSecreto` (que muestra un secreto ya guardado).
- **Props:** `Omit<InputHTMLAttributes, 'type'> & { revelado?: boolean = false }`. Reenvía `ref`.
- **Variantes:** si el navegador soporta `-webkit-text-security`, usa `type="text"` enmascarado por CSS (clase `.enmascarado`); si no, cae a `type="password"`. Fija `autoComplete="off"` y `data-1p-ignore` / `data-lpignore` / `data-bwignore`.
- **Dónde:** LoginPage, BovedaGuard, CredencialForm, CredencialEnPaso, CuentaPage, BloqueoAppGuard, SeguridadPage, SeguridadDelEquipo, DialogoEliminar.

### 2.6 `Cargando`
- **Propósito:** indicador de carga compartido; fallback de `Suspense` mientras se descarga el chunk de una pantalla diferida. Trae su propio fondo porque se dibuja antes del shell autenticado.
- **Props:** ninguna.
- **Dónde:** `main.tsx`.

### 2.7 `DescargarOffline`
- **Propósito:** tarjeta con botón para precachear el contenido de todos los adjuntos antes de salir sin señal.
- **Props:** ninguna. Lee el progreso con `useSyncExternalStore` desde `src/lib/adjuntosOffline.ts`.
- **Variantes:** 3 estados internos (en curso, con fallidos, completada).
- **Dónde:** solo `InicioPage`.

### 2.8 `DialogoEliminar`
- **Propósito:** diálogo de confirmación de eliminación; en acciones "sensibles" exige la contraseña maestra. Envuelve a `Modal`.
- **Props:** `{ abierto, titulo, descripcion, sensible?: boolean = false, advertencia?: ReactNode, textoConfirmar?: string = 'Eliminar', onCerrar, onConfirmar }`. `advertencia` es el aviso de impacto que la página calcula desde el grafo.
- **Variantes (estado interno):** `cargando`, `simple` (confirmación normal), `contrasena` (pide y verifica la maestra), `sin-comprobar` (offline sin verificador: la eliminación sensible se niega por seguridad).
- **Dónde:** Adjuntos, BovedaPage, UbicacionPage, CredencialPage, ArticuloPage, SeguridadDelEquipo, PersonaPage, PasosEditor, DispositivoPage, DiagnosticoForm.

### 2.9 `ErrorBoundary`
- **Propósito:** límite de error de toda la app; si un import dinámico falla tras publicar una versión nueva, recarga una vez; cualquier otro error muestra pantalla de reintento.
- **Props:** `{ children }`.
- **Nota de arquitectura:** a propósito no importa `iconos.tsx` (entraría al chunk de entrada); solo usa `BTN_PRIMARIO`.
- **Dónde:** envuelve toda la app en `main.tsx`.

### 2.10 `FilaDispositivo`
- **Propósito:** fila de un dispositivo en un listado, compartida entre Dispositivos y Red: avatar (foto o icono de tipo de nodo), nombre, subtítulo y estado con punto de color + IP.
- **Props:** `{ dispositivo, categoriaNombre, subtitulo, conFoto?: boolean = false }`.
- **Variantes:** `conFoto` decide avatar de foto (`MiniaturaPortada`) vs siempre icono (`IconoNodo`, para Red).
- **Dónde:** `DispositivosPage` (con foto), `RedPage` (sin foto). Nota: `CategoriaPage` reimplementa esta fila a mano (candidato CAND-2, sección 5).

### 2.10b `HojaFiltro`
- **Propósito:** hoja inferior para elegir UNA opción de una lista corta: el segundo eje de filtro de una pantalla de lista, o "en qué categoría" al crear. Implementa la regla R4 de la auditoría de Soluciones (un solo eje de filtro visible; el segundo se plega aquí con su contador).
- **Props:** `{ abierto, onCerrar, titulo, opciones: OpcionHoja<T>[], seleccionada?: T | null, onElegir, onLimpiar? }`. Genérico sobre `T extends string`.
- **`OpcionHoja<T>`:** `{ valor, etiqueta, Icono?, claseIcono?, count? }`. Sin `count` la opción elegida muestra un check en vez del número.
- **Variantes:** "Limpiar" solo aparece si se pasa `onLimpiar` y hay algo elegido (en la hoja de creación no elegir no es un estado válido). Rejilla de 2 columnas, cada opción con `min-h-11` (44 px, regla R6).
- **Dónde:** `SolucionesPage` (hoja de "Tipo de documento" y hoja de "¿En qué categoría?"). Usa `Modal` internamente, que ya resuelve portal, Escape y bloqueo de scroll.

### 2.10c `IndicadorAvance`
- **Propósito:** único indicador de "vas por X de Y pasos" de la app, en tres variantes. Al completarse pasa de acento a verde, que es el momento que el técnico busca.
- **Props:** `{ hechos, total, variante?: 'anillo' | 'barra' | 'texto' = 'anillo', size?: number = 26, className? }`.
- **Variantes:** `anillo` es la de fila (su ancho NO cambia con el valor, así que las filas de una lista siguen alineadas); `barra` la de bloque; `texto` la de lectura precisa. `anillo` y `barra` exponen `role="progressbar"` con sus `aria-value*`.
- **Dónde:** `SolucionesPage` (variante `barra`, en el bloque "Sin terminar"). **Pendiente de migrar:** `AvanceArticulo` de `CategoriaPage` y `ContadorSubProgreso` de `ProcedimientoVista` siguen siendo copias propias del mismo dato (candidato CAND-7, sección 5); se unifican al rediseñar P4 y P2.

### 2.10d `PastillaEstado`
- **Propósito:** UNA sola forma para todo estado que acompaña a una fila: pastilla de contorno, sin relleno. Es el `IndicadorEstado` que pedía CAND-1. Antes el mismo tipo de dato se dibujaba de tres maneras a la vez (Borrador con borde punteado y relleno ámbar, Obsoleto con relleno neutro sólido, estado de equipo como punto de color + etiqueta).
- **Props:** `{ tono: 'precaucion' | 'neutro' | 'exito' | 'error', Icono?, children, className? }`.
- **Helper:** `PastillaEstadoArticulo({ estado })` resuelve tono y rótulo del estado de un artículo; devuelve `null` en `'publicado'` (si todo lleva pastilla, la pastilla no informa).
- **Variantes:** el texto va en el color pleno del estado (neutral-300 el neutro) y nunca en neutral-600, que a 11 px da 4.0:1 sobre el fondo cuando AA pide 4.5 (regla R2).
- **Dónde:** `FilaArticulo` (y por tanto `SolucionesPage`). **Pendiente:** el estado de equipo de `CategoriaPage`/`DispositivoPage`/`Topologia*` sigue en su forma antigua (CAND-1 no cerrado del todo).

### 2.10e `PastillaFrescura`
- **Propósito:** "46 artículos al día · hace 4 min" bajo el título de una pantalla de lista. Implementa la regla R7 de la auditoría (toda lista dice qué tan al día está el dato y si hay cambios sin subir). Antes esta señal solo existía en Inicio, así que en el resto de la app no se sabía si se estaba viendo la copia de ayer.
- **Props:** `{ total, singular, plural, className? }`. El sustantivo lo pone quien la usa, para que sirva a cualquier lista.
- **Variantes:** tres mensajes por prioridad: cambios propios sin subir (ámbar, `CloudArrowUp`), sin sincronizar aún (`CloudSlash`) y al día (`CloudCheck` verde). Es de **solo lectura**: no abre el panel de sincronización, para no sumar un control a una cabecera que la auditoría pedía adelgazar.
- **Dónde:** `SolucionesPage`. Lee el estado con `useSyncExternalStore(suscribirSync, obtenerEstadoSync)` y la antigüedad con `tiempoRelativo()` de `src/lib/tiempoRelativo.ts`.

### 2.11 `MiniaturaPortada`
- **Propósito:** miniatura de la portada de un procedimiento o la foto de un dispositivo en listados; si la imagen no está disponible offline, no muestra nada.
- **Props:** `{ referencia, alt?: string = '', className?: string = 'h-10 w-10 ...' }`.
- **Dónde:** `FilaDispositivo`, `CategoriaPage` (portada de artículo y foto de dispositivo).

### 2.12 `Modal`
- **Propósito:** ventana modal centrada con fondo oscurecido; en móvil aparece pegada abajo (hoja), en pantallas grandes centrada (responsive por CSS, no por prop). Se cierra con Escape o tocando fuera.
- **Props:** `{ abierto, onCerrar, tituloId?, children }`.
- **Variantes:** ninguna. Siempre se monta con `createPortal(..., document.body)` (agregado el 2026-07-21 tras un bug real: `position: fixed` no se resuelve contra el viewport si un ancestro con `backdrop-blur` crea un containing block).
- **Dónde:** solo internamente, por `PanelSync` y `DialogoEliminar`. Ninguna pantalla de features lo importa directo hoy (ver `HojaInferior`, candidato CAND-5).

### 2.13 `PanelSync`
- **Propósito:** vista humana del estado de sincronización: qué falta subir, qué falló y cómo seguir. "Descartar" es la salida de emergencia de un cambio atascado (restaura la versión del servidor).
- **Props:** `{ abierto, onCerrar }`. Usa `Modal` internamente.
- **Dónde:** solo `InicioPage` (se abre desde la pastilla de sincronización de la cabecera).

### 2.14 `ReferenciadoPor`
- **Propósito:** inverso universal "¿qué referencia a esto?"; a partir del grafo derivado (`useGrafo`) lista quién usa una entidad, agrupado por tipo de vínculo, con enlace a cada origen. Se oculta si no hay referencias.
- **Props:** `{ tipo: TipoEntidad, id, relaciones?: TipoRelacion[], titulo?: string = 'Referenciado por' }`. `relaciones` limita qué vínculos mostrar (para no duplicar bloques propios de la ficha).
- **Dónde:** hoy solo `ArticuloPage`. Otras fichas (Dispositivo, Credencial) usan `useGrafo`/`referenciasHacia` directo.

### 2.15 `VisorImagen`
- **Propósito:** visor de imagen a pantalla completa con pellizco para zoom, doble toque y arrastre.
- **Props:** `{ url, alt, onCerrar }` (las tres obligatorias).
- **Variantes:** gestos: pellizco, doble toque (alterna 1 y 2.5), arrastre con `escala > 1`. Límites de escala 1 a 4.
- **Dónde:** `Adjuntos`, `ProcedimientoVista` (imagen de un paso).

### 2.16 `useGrafo` (hook)
- **Propósito:** reconstruye en memoria el grafo de referencias entre entidades cada vez que cambian los datos locales; lo comparten `ReferenciadoPor` y el aviso de impacto antes de eliminar.
- **Firma:** `useGrafo(): Arista[]`.
- **Dónde:** `ReferenciadoPor`, `ArticuloPage`, `DispositivoPage`, `SeguridadDelEquipo`, `CredencialesDelEquipo`, `CredencialPage`, `BovedaPage`.

### 2.17 `useUrlAdjunto` (hook)
- **Propósito:** resuelve la URL para mostrar un archivo de Storage a partir de su referencia; si ya se descargó para offline lo sirve sin red, si no pide una URL firmada y la cachea.
- **Firma:** `useUrlAdjunto(referencia: string | null): string | null`.
- **Dónde:** `MiniaturaPortada`, `Adjuntos`, `ProcedimientoVista`.

## 3. Componentes compartidos de features

### 3.1 `historial/Historial`
- **Propósito:** línea de tiempo unificada de una entidad: combina cambios de campos, intervenciones manuales, ejecuciones de diagnóstico y accesos de auditoría de bóveda en un solo componente plegable.
- **Props:** `{ entidadTipo: TipoEntidadHistorial, entidadId }`.
- **Variantes:** por `entidadTipo` decide qué sub-eventos anexar (artículo suma `ejecuciones_diagnostico`; credencial o campo protegido suman `accesos_boveda`). `procedimiento` y `detalles` muestran un resumen en lenguaje natural con el JSON plegado en "Detalle técnico".
- **Dónde:** `DispositivoPage`, `ArticuloPage`, `CredencialPage` (vía la ficha), `CategoriaPage`, `UbicacionPage`, `PersonaPage`, `DiagnosticoForm` (solo edición), `SeguridadDelEquipo` (por campo protegido). Cubre 8 tipos de entidad.

### 3.2 `boveda/CampoSecreto`
- **Propósito:** fila de un dato descifrado (usuario, contraseña, IP) con botón de copiar y, si aplica, mostrar/ocultar. Es para **mostrar**, no para escribir.
- **Props:** `{ etiqueta, valor, oculto?: boolean = false, alternarOculto?, onCopiado? }`. `onCopiado` deja que quien lo use registre la auditoría de bóveda sin acoplar el componente a ella.
- **Variantes:** la presencia de `alternarOculto` decide si aparece el botón de ojo (IP/URL no lo llevan). Botón interno "copiar + tilde 1.5 s".
- **Dónde:** `CredencialEnPaso`, `MigracionCredenciales`, `SeguridadDelEquipo`.

### 3.3 `boveda/CredencialEnPaso`
- **Propósito:** bloque protegido dentro de un paso de procedimiento; contraído por defecto (candado + "Datos protegidos"), solo consulta la bóveda al abrirse, con las mismas protecciones que la sección Bóveda.
- **Props:** `{ vinculo: VinculoProtegido }` donde `VinculoProtegido = { tipo: 'credencial' | 'campo', id, titulo }`.
- **Variantes:** según `vinculo.tipo` muestra los datos de una credencial (`<dl>`) o el valor de un campo protegido. Estados: sin autorización, vínculo eliminado, bóveda bloqueada (desbloqueo inline).
- **Dónde:** `AsistenteVista`, `ProcedimientoVista`.

### 3.4 `boveda/IndicadorVencimiento`
- **Propósito:** aviso de vencimiento de una credencial (ámbar si se acerca, rojo si venció); nada si no hay fecha o falta mucho. La lógica de cálculo vive en `src/lib/vencimiento.ts`.
- **Props:** `{ venceEn: string | null, variante?: 'claro' | 'nocturne' = 'claro' }`.
- **Variantes:** `'claro'` (pastilla rellena con emoji, en el paso de un procedimiento); `'nocturne'` (delineada, con icono `ClockCountdown`).
- **Dónde:** `CredencialEnPaso` (claro), `CredencialPage` (nocturne).

### 3.5 `dispositivos/estados.ts` y el estado visual
- **Aclaración:** no existe un componente `IndicadorEstado`. `estados.ts` es solo un re-export de `ESTADOS_SUGERIDOS` (para el `datalist` del formulario).
- La lógica visual del estado vive en `src/features/red/topologiaVisual.ts`: `estadoConEtiqueta(estado)` (etiqueta canónica) y `claseEstado(etiqueta)` (color Nocturne). **No hay componente visual compartido**: el marcado "punto de color + etiqueta" se repite a mano en varias pantallas (candidato CAND-1, sección 5).
- **Dónde se usan las funciones:** `FilaDispositivo`, `CategoriaPage`, `TopologiaPage`, `TopologiaEquipoPage`, `DispositivoPage` (con una variante propia `pillEstado`).

### 3.6 `ubicaciones/SelectorUbicacion`
- **Propósito:** selector de ubicación dentro del editor de dispositivo; el dato canónico es `ubicacionId`, `ubicacion` (texto) es la copia de referencia. Permite elegir una existente, escribir texto libre o crear una nueva sin salir del formulario.
- **Props:** `{ ubicacionId: string | null, ubicacion, onChange(ubicacionId, ubicacionTexto) }` (controlado).
- **Variantes (estado interno):** vinculada a fila / texto libre / nueva (mini-formulario inline).
- **Dónde:** solo `DispositivoForm`.

### 3.7 `personas/SelectorPersona`
- **Propósito:** selector de persona, mismo patrón que `SelectorUbicacion` pero sin jerarquía; canónico `responsableId`, copia `responsable`.
- **Props:** `{ responsableId: string | null, responsable, onChange(responsableId, responsableTexto) }`.
- **Dónde:** solo `DispositivoForm`. (Nota: `FormularioConexion` reimplementa el mismo patrón por su cuenta, candidato CAND-6.)

### 3.8b `soluciones/FilaArticulo`
- **Propósito:** fila de un artículo en un listado: recuadro neutro con el glifo del tipo, título de 15 px, línea de metadatos y ranura de estado. Reemplaza el marcado que `SolucionesPage` y `CategoriaPage` copiaban por separado.
- **Props:** `{ articulo, to, categoriaNombre?, consulta?, coincidencia?: CoincidenciaFila, conSeparador?: boolean = true }`.
- **Variantes:** `categoriaNombre` se pasa solo cuando la lista puede mezclar categorías (buscando, en "Todos" o por etiqueta); dentro de una categoría sería repetirlo en cada fila. `coincidencia` sustituye la línea de metadatos por "Coincide en la etiqueta X" cuando el término no acertó en el título. Un artículo obsoleto baja de jerarquía (título en neutral-300) sin desaparecer.
- **Regla R1 ("color con oficio"):** el matiz del TIPO vive en el glifo y el recuadro va neutro (`text/6%`). Antes el recuadro entero iba relleno del color del tipo y, con seis tipos en la misma columna, la lista se leía como un arcoíris donde el color ya no informaba. El color de la CATEGORÍA sigue viviendo en los chips de filtro, nunca en la fila.
- **Dónde:** `SolucionesPage`. **Pendiente:** migrar `CategoriaPage` al rediseñar P4.
- **Relación con la decisión de la tarea 145** (que dijo "NO crear `<FilaArticulo>`"): ahí se comparaba la fila de artículo contra `FilaDispositivo` y la de Red, y sigue valiendo (esto **no** se unifica con la fila de dispositivo). Lo que se unifica son las **dos filas de artículo**, que divergían solo porque nadie las había mirado juntas y que el rediseño hace converger a propósito. Ver [DECISIONES.md](DECISIONES.md).

### 3.8 `red/IconoNodo`
- **Propósito:** icono del tipo de equipo de red (trazo estilo Lucide), compartido entre Topología y Red.
- **Props:** `{ tipo: TipoNodoVisual, className?: string = 'h-4 w-4' }`. `TipoNodoVisual` cubre router, switch, ap, punto, pc, impresora, pos, rack, camara, servidor, ups, generico.
- **Variantes:** un SVG por tipo (set visual con `stroke`, distinto de `iconos.tsx`).
- **Dónde:** `FilaDispositivo`, `TopologiaPage`, `TopologiaEquipoPage`, `CategoriaPage`.

## 4. Fuentes únicas de un patrón

Cada una centraliza un patrón que antes estaba duplicado (con su comentario en el código):

| Fuente única | Centraliza |
|---|---|
| `nocturne.tsx` (`BTN_*`) | variantes de botón |
| `campos.tsx` (`CLASE_CAMPO*`, `Campo*`) | aspecto de campo y su etiqueta; editor clave/valor |
| `topologiaVisual.ts` (`claseEstado`, `estadoConEtiqueta`) | color y etiqueta del estado de un dispositivo |
| `FilaDispositivo` | fila de dispositivo en listado |
| `BotonVolver` + `padreDe` | destino y etiqueta del botón de regreso |
| `useGrafo` / `grafo.ts` | grafo de referencias entre entidades |
| `Modal` | ventana modal + portal a `document.body` |
| `IndicadorVencimiento` + `vencimiento.ts` | lógica de vencimiento |

## 5. Candidatos a componente (duplicación no extraída)

Patrones con marcado casi idéntico que hoy no tienen componente compartido. Registrados como tareas en [TAREAS.md](TAREAS.md):

- **CAND-1 (el mayor), PARCIALMENTE CERRADO el 2026-07-27:** "punto de estado + etiqueta" copiado en `FilaDispositivo`, `CategoriaPage`, `TopologiaPage`, `TopologiaEquipoPage` (dos veces), más una variante paralela `pillEstado` en `DispositivoPage` que mantiene a mano el mismo dominio de estados. El componente que pedía ya existe: `PastillaEstado` (sección 2.10d), hoy usado por `FilaArticulo` para borrador/obsoleto. **Falta** migrar a él el estado de EQUIPO en las cinco copias de arriba; se hace al rediseñar P4 (ficha de categoría), donde la auditoría ya lo pide (decisión P4-8).
- **CAND-2:** `CategoriaPage` reimplementa la fila de dispositivo en vez de usar `FilaDispositivo`. La auditoría de Soluciones lo resuelve en su decisión P4-2; pendiente de implementar P4.
- **CAND-3:** "copiar con confirmación (tilde)" implementado por separado en `CampoSecreto` (`BotonCopiar`) y `DispositivoPage` (`FilaCampo`); el comentario cita un `ValorCopiable` que ya no existe.
- **CAND-4:** `FormularioDesbloqueo` casi idéntico en `CredencialEnPaso` y `SeguridadDelEquipo` (el comentario lo admite). Candidato a `DesbloqueoBovedaInline`.
- **CAND-5:** `HojaInferior` de `BovedaPage` reimplementa `Modal` sin `createPortal`; sin bug hoy, pero expuesta al mismo riesgo que `Modal` ya resolvió.
- **CAND-6:** "buscar o crear inline" con tres copias (`SelectorUbicacion`, `SelectorPersona`, `FormularioConexion`), ninguna reutiliza `BTN_PRIMARIO`/`BTN_SECUNDARIO`. Candidato a `SelectorEntidadConAlta<T>`.
- **CAND-7 (nuevo el 2026-07-27):** el mismo dato de avance ("X de Y pasos") dibujado por separado en `AvanceArticulo` (`CategoriaPage`, pastilla con borde ámbar que solo aparece si hay avance, así que la columna derecha baila entre filas), `ContadorSubProgreso` (`ProcedimientoVista`, rectángulo relleno sin borde) y la barra pegajosa de la ficha y del asistente. El componente que las unifica ya existe: `IndicadorAvance` (sección 2.10c), hoy usado solo por `SolucionesPage`. Se migran al rediseñar P2 y P4.
  > **Nota:** la auditoría de diseño atribuyó esta unificación a "CAND-3", que en realidad es "copiar con confirmación (tilde)" y no tiene relación. Se registra como CAND-7 para no romper la numeración ya publicada.

## 6. Convenciones para agregar un componente

- Componentes en `PascalCase.tsx`; hooks `useX.ts`; lógica pura en `camelCase.ts` con su `.test.ts`.
- Los componentes de UI compartidos van en `src/components`; los específicos de un dominio, en `src/features/<dominio>`.
- Nunca redefinir clases de botón o campo: reutilizar `nocturne.tsx` y `campos.tsx`. Si hace falta una variante de color, crear una constante propia (no concatenar, ver sección 0).
- Textos visibles en español; identificadores en inglés.

## 7. Referencias

- Sistema visual Nocturne y los tres lenguajes de color: [ARQUITECTURA.md](ARQUITECTURA.md).
- Pantallas y flujos donde aparecen estos componentes: [DOCUMENTACION_FUNCIONAL.md](DOCUMENTACION_FUNCIONAL.md).
- Deuda de duplicación pendiente: [TAREAS.md](TAREAS.md).
