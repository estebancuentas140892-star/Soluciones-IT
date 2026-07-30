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

93 iconos Phosphor (MIT) inlineados como SVG propios, para no depender de CDN (rompe offline) ni cargar el paquete completo. Suma desde la tarea 182: `DotsNine` (el glifo de "Más", una cuadrícula de 9 puntos; sin variante `Fill`, el mockup usa el mismo trazo activo e inactivo).

- Props: `IconoProps = SVGProps<SVGSVGElement> & { size?: number }`. `size` por defecto 16, `fill="currentColor"` (hereda el color del texto), `aria-hidden` por defecto.
- Variantes: el sufijo `Fill` marca la versión rellena (`Star`/`StarFill`, `House`/`HouseFill`, `Vault`/`VaultFill`...), usada típicamente para la pestaña activa.

## 2. Componentes de `src/components`

Convención: "Props" muestra la firma real; los opcionales llevan su default. "Dónde se usa" viene de los call sites reales.

### 2.0 `Chasis` (`src/app/Chasis.tsx`)

- **Propósito:** el chasis único de la app (tarea 185, mockup `4c`). Reemplaza a `ShellNocturne` (eliminado) y a los 15 contenedores `max-w-md` que cada pantalla montaba a mano. Aporta el marco completo: sidebar de escritorio de catorce destinos, columna de contenido de ancho progresivo, barra superior o de tarea, y barra de cinco pestañas en móvil.
- **Tres niveles y ni uno más (regla R18).** Cada pantalla declara el suyo:

  | `modo` | Qué es | Cabecera | Pestañas | Sidebar |
  |---|---|---|---|---|
  | `seccion` (default) | raíz de una pila: las cinco pestañas, la Bóveda y su bloqueo | `BarraSuperior` (título, estado del dato, buscar, cuenta) | sí | sí |
  | `documento` | algo que se lee o se recorre dentro de una sección | fila de regreso + acciones propias | sí | sí |
  | `tarea` | algo que se hace y de lo que se sale: editor, asistente, escáner, importador, migración | `BarraTarea` | **no** | no |

- **Props** (unión discriminada por `modo`, así cada nivel solo acepta lo suyo):
  - `seccion`: `{ titulo: string, barra?: ReactNode, children }`
  - `documento`: `{ modo: 'documento', volverA?: string, volverEtiqueta?: string, acciones?: ReactNode, barra?: ReactNode, children }`
  - `tarea`: `{ modo: 'tarea', rotulo: string, titulo: string, vuelta?: string, salidaA?: string, salidaEtiqueta?: string, alSalir?: () => void, barra?: ReactNode, children }`
  - `barra` es siempre la banda de controles propios de la pantalla, dentro del mismo bloque pegajoso que la cabecera (AD-023).
- **Reserva su propio espacio (regla R22).** La columna de contenido lleva `pb-[calc(65px+env(safe-area-inset-bottom))] md:pb-0` en los niveles con pestañas, así que ninguna pantalla calcula a mano el alto de la barra. Los 65 px son **medidos** (63,6 de celda + 1 de borde), no los 53 que citaba la auditoría, un dato anterior a la tarea 182.
- **Cuatro puntos de quiebre, cuatro composiciones (tarea 191, regla R30).** Los define el chasis y ninguna pantalla los repite. Medidos en el navegador:

  | Ventana | Sidebar | Pestañas | Tope de la columna |
  |---|---|---|---|
  | `<768` | oculta | sí | 448 |
  | `768-1279` (`md`) | rail de iconos, 64 px | no | 1040 |
  | `1280-1679` (`xl`) | completa, 240 px | no | 1040 |
  | `>=1680` (`3xl`) | completa, 232 px | no | 1294 (322 + 720 + 252) |

  El rail estrecho es lo que cierra el hueco de tableta: antes la sidebar no llegaba hasta 1024, así que entre 768 y 1023 el contenido medía 768 mientras la barra de pestañas seguía anclada a 448 centrados. El tope de la columna **crece y nunca se estrecha**. El punto de 1680 vive en `@theme` como `--breakpoint-3xl: 105rem`, en rem y no en px por el motivo de [DECISIONES.md](DECISIONES.md) AD-028. Las tres zonas propiamente dichas (maestro-detalle) las reparte la tarea 199; aquí solo se reserva su ancho.
- **`BarraReanudar` cambia de sitio en escritorio (tarea 191):** al pie del rail, encima de la cuenta, en vez de flotar sobre el contenido. Ver 2.10i.
- **`BarraReanudar` (tarea 186):** en `seccion` y `documento` (nunca en `tarea`), monta la barra flotante del procedimiento a medias más reciente (ver 2.10i) a partir de `useReanudar()`. Mientras esté descartada, la pestaña Guías (solo móvil) muestra un punto de aviso junto a su icono.
- **Comportamientos dinámicos (tarea 187).** Los cuatro se calculan aquí porque el chasis es el único envoltorio de TODAS las pantallas:
  - **Avisos con dato detrás (R23):** punto en Guías (procedimiento a medias descartado) y número en Más (conteo real de `usePendientes()`, no los seis que Inicio muestra). Ver 2.10k.
  - **Transiciones con dirección (R21):** pone `data-transicion` en la columna de contenido con el valor que devuelve `direccionPara(location)` de `src/app/direccionTransicion.ts` (`entra` al bajar un nivel, `vuelve` al subir, `lateral` entre raíces de pestaña). Los keyframes viven en `src/index.css` y se anulan bajo `prefers-reduced-motion`.
  - **Memoria por pestaña (R20):** `useMemoriaScroll(pathname)` guarda y restaura la posición de scroll por ruta; `useMemoriaPestana(pathname, search)` guarda los filtros por raíz de pestaña y `destinoDePestana()` los repone en el `to` del enlace. Estando dentro de la pestaña el enlace queda pelado, así que tocar la pestaña activa suelta el filtro y vuelve a su raíz.
  - **Tocar la pestaña activa** en su raíz pelada sube al principio de la lista (con `behavior: smooth`, o `auto` si el sistema pide menos movimiento).
- **Dónde:** todas las rutas autenticadas. `BotonVolver` ya solo lo usan el propio chasis y `BarraTarea`.

### 2.1 `ActualizacionDisponible`
- **Propósito:** barra flotante que avisa cuando hay una versión nueva de la PWA y la aplica al tocar "Actualizar". Hace su propio chequeo cada hora.
- **Props:** ninguna. Devuelve `null` mientras no haya novedad.
- **Dónde:** montado una vez en `App.tsx`, global.
- **La recarga la controla el componente, nunca la librería** (corregido el 2026-07-27 tras un fallo reportado en el teléfono: "le doy al botón y no pasa nada"). `updateServiceWorker` acaba llamando a `messageSkipWaiting()` de workbox-window, que es literalmente `registration.waiting && enviarMensaje(...)`: **si no hay worker en espera no hace nada en silencio**, no se emite `controllerchange` y no hay recarga, pero el aviso sigue visible porque `needRefresh` continúa en `true`. El botón quedaba inerte para siempre. Y `waiting` puede ser `null` con el aviso delante si otra ventana de la app ya activó ese worker, o si el teléfono suspendió la app y el navegador lo activó por su cuenta (raro en escritorio, normal en móvil: por eso el fallo solo se veía en el teléfono). Ahora el componente engancha su propio `controllerchange` **y** una red de seguridad por tiempo (2,5 s) que recarga igual, así que el botón tiene un solo contrato: recarga. Muestra "Actualizando..." y se deshabilita al pulsarse, para que el toque siempre tenga respuesta visible.

### 2.2 `Adjuntos`
- **Propósito:** galería de adjuntos de una ficha (subir desde cámara o archivo, ver, eliminar) con compresión, deduplicación por hash y cola offline.
- **Props:** `{ entidadTipo: 'articulo' | 'dispositivo' | 'historial', entidadId }` (ambas obligatorias).
- **Variantes:** decide imagen vs archivo genérico según el `tipo`; usa `VisorImagen` para imágenes.
- **Dónde:** `DispositivoPage`, `ArticuloPage`, `Historial` (adjuntos de una intervención), `RegistrarIntervencion`, `AsistenteVista`.

### 2.2b `Avatar`
- **Propósito:** las iniciales del técnico en un círculo, o el icono genérico de usuario si no hay nombre ni correo. Extraído en la tarea 182 al reutilizarse en `PantallaMas` con otro tamaño (34 px, contra los 30 px de `BarraSuperior`); nació en la tarea 181.
- **Props:** `{ nombre?, correo?, className?: string = 'h-[30px] w-[30px] text-[11px]' }`. El tamaño y la tipografía van en `className` (no hay tamaño único posible con clases Tailwind estáticas).
- **Detalles:** las iniciales las calcula `inicialesDe()` (`src/lib/iniciales.ts`, con pruebas): nombre y primer apellido, un solo nombre (sus dos primeras letras), o la parte local del correo como respaldo.
- **Dónde:** `BarraSuperior` (avatar de la ranura de cuenta), `PantallaMas` (fila de perfil del grupo "Mi cuenta").

### 2.2c `BotonInstalarApp`
- **Propósito:** botón que instala la PWA en el dispositivo, con las instrucciones manuales dentro (modal) para los navegadores que no ofrecen diálogo nativo. Nace en la tarea 184.
- **Props:** `{ className?: string }` (se concatena tras `BTN_PRIMARIO min-h-11 shrink-0 px-3`).
- **Variantes:** el rótulo es **"Instalar"** cuando hay diálogo nativo guardado y **"Cómo instalar"** cuando no (Safari de iOS siempre; el resto, cuando el diálogo ya se usó o se rechazó). Si el técnico rechaza el diálogo, cae al modal de instrucciones.
- **Detalles:** no decide si debe verse; eso depende del contexto (en la bienvenida lo decide el paso 2, en Mi cuenta la tarjeta que lo contiene, que se oculta si `obtenerEstadoInstalacion().instalada`). Lee el estado con `useSyncExternalStore` desde `src/lib/instalacionPwa.ts`.
- **Dónde:** `BienvenidaPrimerDia` (paso 2) y `CuentaPage`. Son los dos únicos sitios desde donde la app ofrece instalarse: la decisión del handoff es "ahí y en Mi cuenta, nunca como banner intrusivo".

### 2.2d `Marca`
- **Propósito:** el glifo de la marca (el cerebro). **No** forma parte del set de iconos de dominio (`iconos.tsx`): es el logotipo, y se usa solo donde la app se presenta a sí misma.
- **Props:** las de un `<svg>` (`React.SVGProps<SVGSVGElement>`); el tamaño y el color van en `className`.
- **Detalles:** vivía como función privada dentro del shell (hoy `Chasis.tsx`); la tarea 184 lo extrajo al necesitarlo también el login. La regla R12 retiró el nombre "IT Brain" de la interfaz (tarea 180) pero conserva este glifo como marca ([DECISIONES.md](DECISIONES.md) AD-022).
- **Dónde:** `Chasis` (cabecera del sidebar de escritorio), `LoginPage` (cuadro de 52 px delineado en acento).

### 2.3 `BotonFavorito`
- **Propósito:** estrella para marcar/desmarcar una ficha como favorita.
- **Props:** `{ tipo: TipoFavorito, entidadId, variante?: 'cabecera' | 'fila' = 'cabecera' }`.
- **Variantes:** `'cabecera'` usa `BTN_ICONO_SECUNDARIO` (botón con borde, fila de acciones de una ficha); `'fila'` es solo el icono con tinte al pasar (fila de lista). El color activo va sobre el SVG.
- **Dónde:** `ArticuloPage`, `DispositivoPage` (cabecera), `DiagnosticosPage` (fila).

### 2.4 `BotonVolver`
- **Propósito:** botón de regreso unificado; deriva destino y etiqueta de la fuente única `padreDe` (`src/lib/navegacion.ts`) en vez de cablearlos a mano.
- **Props:** `{ to?, children? }`. `to` sobreescribe el destino derivado (contexto en runtime, ej. equipo de red vuelve a Red); `children` sobreescribe la etiqueta ("Salir", "Cancelar").
- **Dónde:** desde la tarea 185, **solo dos sitios**: `Chasis` en `modo="documento"` y `BarraTarea` (para derivar el destino de la X). Antes lo llamaban 31 archivos, cada uno dentro de una cabecera propia; ahora la cabecera es del chasis y las pantallas solo pasan `volverA`/`volverEtiqueta` cuando el destino depende de datos en runtime (un equipo de red vuelve a Red).

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
- **Propósito:** único indicador de "vas por X de Y pasos" de la app, en cuatro variantes. Al completarse pasa de acento a verde, que es el momento que el técnico busca.
- **Props:** `{ hechos, total, variante?: 'anillo' | 'barra' | 'texto' | 'segmentos' = 'anillo', size?: number = 26, className? }`.
- **Variantes:** `anillo` es la de fila (su ancho NO cambia con el valor, así que las filas de una lista siguen alineadas); `barra` la de bloque; `texto` la de lectura precisa; **`segmentos`** (tarea 172, mockup `1f`) dibuja un segmento por paso junto al título de una sección, y dice dos cosas que la barra continua no dice: cuántos pasos hay en total y cuál es el que sigue. Por encima de 12 pasos cae sola a `barra`, porque los segmentos se estrecharían hasta no leerse. Todas menos `texto` exponen `role="progressbar"` con sus `aria-value*`.
- **Dónde:** `SolucionesPage` (`barra`, bloque "Sin terminar"), `ProcedimientoVista` (`segmentos` + `texto` en la cabecera de "Pasos", y `anillo` en la tarjeta de un subprocedimiento vinculado), `BarraReanudar` (`anillo`). **CAND-7 cerrado en la tarea 172** para `ContadorSubProgreso`, que era una pastilla "X/Y" propia y además discrepaba del resto (su intermedio era ámbar; en el resto de la app, acento). **Queda `AvanceArticulo` de `CategoriaPage`**, que se unifica al rediseñar P4 (tarea 174).

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

### 2.10e2 `BarraAccionFicha`
- **Propósito:** la única acción dominante de una ficha, fija abajo (tarea 172, mockup `1f`). Nace de la auditoría de la ficha de artículo: "Ejecutar" y "Editar" pesaban lo mismo (Nocturne pide el primario delineado, así que eran dos botones de borde uno al lado del otro), vivían arriba (la zona menos alcanzable del pulgar) y decían siempre "Ejecutar", incluso con 2 de 6 pasos hechos, donde lo que se hace es *seguir*.
- **Props:** `{ to: string, estado: 'empezar' | 'seguir' | 'repetir', paso?: number, total?: number }`. El estado lo calcula quien la monta a partir del avance real; `paso` y `total` solo se usan en `seguir`.
- **Variantes:** la etiqueta y el icono salen del estado ("Empezar" con play, "Seguir en el paso N de M" con play, "Repetir" con flechas circulares), y debajo va una nota de una línea con la promesa correspondiente ("Tu avance se guarda en este teléfono"). Botón de 52 px de alto, pegajoso al pie de la columna de contenido.
- **Dónde:** `ArticuloPage`. La comparte con el editor de P5 (tarea 175).

### 2.10f `BarraSuperior`
- **Propósito:** la barra superior global del chasis (tarea 181, mockup `3d` del handoff). Tres ranuras fijas, siempre en el mismo orden y en las cinco pestañas (regla **R14**): **título de la sección** (confirma cuál pestaña está iluminada), **estado del dato** (`PastillaSync`) y **buscar + cuenta**. Antes no existía: cada pantalla dibujaba su cabecera con altura, relleno y controles distintos, y los tres servicios globales vivían dentro de Inicio.
- **Props:** `{ titulo: string, children?: ReactNode }`. `children` es la banda de controles propios de la pantalla, que se dibuja justo debajo dentro del mismo bloque pegajoso.
- **El título no lo dibuja ella:** desde la tarea 187 delega en `CabeceraColapsable` (ver 2.10j), que lo contrae al desplazarse sin sacarlo de pantalla.
- **Variantes:** es la cabecera del nivel 1 del chasis (`modo="seccion"`). El nivel 2 (documento) usa una fila de regreso propia del chasis y el nivel 3 (tarea) usa `BarraTarea`; la miga llega con `MigaDePan` (tarea 188).
- **Reglas que aplica:** las acciones propias de la pantalla ("Crear", "Escanear", el menú "···") **no** van en la fila del título: van en `children`. Es la única forma de que la fila superior caiga siempre en el mismo sitio, que es el problema que la barra resuelve. Ver [DECISIONES.md](DECISIONES.md) AD-023.
- **Dónde:** ya no la montan las pantallas: desde la tarea 185 la monta `Chasis` cuando el nivel es `seccion` (Inicio, Guías, Equipos, Red, Más, Bóveda y su pantalla de bloqueo).

### 2.10h `BarraTarea`
- **Propósito:** la cabecera del nivel 3 del chasis (tarea 185, mockup `4c`). El nivel `tarea` es el único que puede quedarse sin la barra de pestañas, y la regla **R19** exige que quien la quita ponga algo que oriente en su lugar: fondo de superficie (para que se note que el chasis cambió), rótulo de lo que se está haciendo ("Editando", "Ejecutando", "Migrando"), sobre qué, la ruta de vuelta **escrita** ("Guías › Impresoras · vuelves aquí al terminar") y una X de salida siempre en el mismo sitio.
- **Props:** `{ rotulo, titulo, vuelta?, salidaA?, salidaEtiqueta = 'Salir sin guardar', alSalir?, children? }`. `vuelta` se deriva de `vueltaDeTarea(pathname)` si no se pasa; esa función devuelve `null` cuando la jerarquía solo sabe decir "Volver" (editar y ejecutar suben a una ficha cuyo nombre depende de datos en runtime), y entonces la pantalla escribe el texto. `alSalir` reemplaza la navegación de la X, para las tareas que guardan avance antes de salir.
- **Dónde:** la monta `Chasis` en `modo="tarea"`. Tres pantallas la usan directamente porque conservan su contenedor propio: `EscanerPage` (el video va detrás a pantalla completa), `EtiquetasPage` (la hoja de impresión vive fuera de la columna) y, por herencia del chasis, el resto de editores.

### 2.10g `PastillaSync`
- **Propósito:** la ranura "estado del dato" de la barra superior: responde de un vistazo "¿ya subió lo que cambié?" con icono, etiqueta y color. Tocarla fuerza una sincronización y abre `PanelSync`.
- **Props:** ninguna. Lee el estado con `useSyncExternalStore(suscribirSync, obtenerEstadoSync)` y la conexión con los eventos `online`/`offline`.
- **Variantes:** cuatro estados. **Al día no gasta palabras en la buena noticia** (tarea 187): solo el icono verde, en un hueco cuadrado de 44x44 igual al del resto de botones de la fila. Los otros tres (sin conexión, con error, subiendo o pendiente) muestran texto y pasan el color también al texto, porque hay algo que atender, y **dicen el número real** ("3 sin subir", "2 con error", "Sin conexión · 3 sin subir") en vez de un genérico "Sincronizando".
- **Historia:** vivía dentro de `InicioPage`, así que en las otras cuatro pestañas no había forma de saber si lo escrito ya había subido. La tarea 181 la extrajo a `src/components/PastillaSync.tsx` y la montó en el chasis (regla **R7** aplicada al chasis); la 187 la volvió adaptativa. **Queda fuera** la franja de ancho completo que el mockup `4e` dibuja para "sin conexión con cambios": exigiría reestructurar la fila de tres ranuras de `BarraSuperior` en todas las pantallas de sección, un cambio de más alcance que el color y el texto.
- **Dónde:** solo `BarraSuperior`.

### 2.10i `BarraReanudar`
- **Propósito:** barra flotante que viaja por toda la app mientras haya un procedimiento a medias (tarea 186, mockup `4e`). Caso real: estar en el paso 3 de un mantenimiento y salir a la Bóveda a buscar una clave, sin perder el hilo de vuelta. Muestra el título del artículo, el paso actual, los minutos restantes estimados y un acceso directo "Seguir" al asistente.
- **Props:** `{ articulo: Articulo, hechos: number, total: number, minutosRestantes: number | null, onDescartar: () => void, variante?: 'flotante' | 'sidebar' }`. Presentacional puro; los datos y el estado de descarte los resuelve `useReanudar` (`src/features/soluciones/useReanudar.ts`), que reutiliza `articulosSinTerminar` (ya usado en el bloque "Sin terminar" de `SolucionesPage`) en vez de duplicar la consulta a `progresoPasos`.
- **Dos variantes desde la tarea 191.** `flotante` (por defecto) es la del teléfono, fija sobre las pestañas y con el arrastre para descartar; se oculta desde 768. `sidebar` es la de escritorio: al pie del rail de navegación, encima de la cuenta, porque ahí el rail ya es persistente y el recordatorio no necesita robar altura al documento. En el rail estrecho (768-1279) queda solo el anillo de avance, del tamaño de los iconos que lo rodean, con el botón de descarte debajo. La variante `sidebar` **no tiene arrastre** a propósito: deslizar es un gesto de dedo, y el botón siempre estuvo como alternativa sin gesto. Medido: 46 px de contenido en el rail de 64 y 206 en el de 232, sin desborde.
- **Se descarta** deslizando horizontalmente (arrastre con umbral de 90 px, con un umbral previo de 6 px antes de capturar el puntero para no robarle el click al botón "X" ni al enlace "Seguir") o con el botón "X", siempre presente como alternativa sin gesto. El descarte se recuerda en `localStorage` mientras siga siendo el mismo artículo: si aparece un procedimiento más reciente para retomar, la barra vuelve a mostrarse sola.
- **Reglas que aplica:** **R23** (un aviso solo si hay un dato detrás: no se muestra si no hay ningún procedimiento a medias). Mientras la barra está descartada, la pestaña Guías (solo móvil) muestra un punto de aviso en su lugar.
- **Dónde:** la monta `Chasis` en los niveles `seccion` y `documento` (no en `tarea`: esas pantallas ya tienen su propia `BarraTarea` y no necesitan una segunda barra flotante, R19).

### 2.10j `CabeceraColapsable`
- **Propósito:** el título de la sección dentro de `BarraSuperior` (tarea 187, mockup `4e`). Al desplazarse pasa de 21 a 14 px y **se queda en pantalla**: la orientación no debe depender solo de la pestaña iluminada, que en escritorio está a 700 px de distancia y mide 10,5 px. El mockup lo mide como una cabecera que baja de 232 a 150 px sin perder el nombre.
- **Props:** `{ titulo: string }`.
- **Cómo:** un listener de `scroll` sobre `window`, con el trabajo diferido a `requestAnimationFrame` y un guardia para no encolar dos por fotograma. Umbral de 12 px, deliberadamente bajo: el mockup lo dibuja como "desplazado", no como un salto que tarde en notarse. La transición es solo de `font-size` y se anula con `motion-reduce`.
- **Dónde:** solo `BarraSuperior` (y por tanto, el nivel `seccion` del chasis). El nivel `documento` contrae su propia cabecera en la tarea 188, junto con `MigaDePan`.

### 2.10k `AvisoPestana`
- **Propósito:** el aviso de una pestaña de la barra inferior (tarea 187, mockup `4e`). Aplica la regla **R23** (un aviso solo si hay un dato detrás, ningún punto decorativo): quien la usa decide **cuándo**, este componente solo dibuja.
- **Props:** unión discriminada. `{ variante: 'punto' }` para Guías (hay un procedimiento a medias y la `BarraReanudar` está descartada) y `{ variante: 'numero', valor: number }` para Más (conteo real de `usePendientes()`). Con `valor <= 0` devuelve `null`; por encima de nueve muestra "9+".
- **Variantes:** el punto es de acento y mide 7 px; el número va en `precaucion` sobre texto de fondo, con anillo de 2 px del color del fondo para separarse del icono. Los dos son `aria-hidden`: el texto accesible lo pone la pestaña ("hay un procedimiento a medias", "N pendientes").
- **Dónde:** solo `Chasis`, en la barra de pestañas móvil.

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
- **Dónde:** solo `PastillaSync` (se abre al tocar la pastilla de la barra superior, en cualquiera de las cinco pestañas). Hasta la tarea 181 se abría solo desde Inicio.

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

### 3.8d `inicio/BienvenidaPrimerDia`
- **Propósito:** la primera impresión de la app para un técnico nuevo (tarea 184, mockup `3b`). Con la base vacía, seis de los nueve bloques de Inicio no se pintan, así que la entrada eran un buscador y tres atajos; y lo que de verdad hay que hacer el primer día (instalar la app y bajar los adjuntos, de lo que depende el trabajo sin señal) no se ofrecía en ninguna pantalla.
- **Props:** `{ nombre?: string | null, hayBloquesReales: boolean }`. Del nombre usa solo el de pila ("Bienvenido, Andrés Vélez" se come la línea entera en 448 px).
- **Contenido:** tres pasos que se apagan solos (entraste · instala la app · descarga para offline), con `BotonInstalarApp` en el segundo y el botón "Descargar" en el tercero, que comparte estado con `DescargarOffline` (misma función, así que el progreso se ve en los dos sitios).
- **Se retira sola**, sin botón de cerrar: cuando los tres pasos están hechos o cuando `hayBloquesReales` (recientes, pendientes o un procedimiento a medias). Cerrar a mano habría exigido guardar la decisión en alguna parte; el bloque desaparece porque deja de ser cierto.
- **Reparto:** la regla vive aparte y probada en `inicio/bienvenida.ts` (`pasosBienvenida`, `debeMostrarBienvenida`); el componente solo lee el estado real del dispositivo (`instalacionPwa.ts`, `adjuntosOffline.ts`) y pinta. La marca de cada paso usa dos canales, forma y color (regla R16): check verde si está hecho, número si falta, en acento solo el primero que falta.
- **Dónde:** `InicioPage`, primer bloque del modo sin búsqueda.

### 3.8c `busqueda/BuscadorGlobal` y `busqueda/ResultadosBusqueda`
- **Propósito:** el buscador global en capa (tarea 181, mockup `3d`). Hasta ahora buscar era global pero vivía **dentro** de Inicio: desde cualquier otra pestaña había que volver a Inicio y perder el sitio donde se estaba. Ahora la lupa vive en `BarraSuperior` y abre esta capa a pantalla completa sin abandonar la pantalla actual.
- **Props:** `BuscadorGlobal` recibe `{ abierto, onCerrar }`; `ResultadosBusqueda`, `{ grupos, consulta, onNavegar? }`; `FilaResultado`, `{ resultado, consulta, onNavegar? }`.
- **Alcance declarado:** la capa dice por escrito qué abarca ("Busca en todo a la vez: Guías, Equipos, Bóveda, Ubicaciones y Personas"). Era la otra mitad del problema que detectó la auditoría: cinco buscadores con la misma forma y cinco alcances distintos, sin nada que los distinguiera.
- **Detalles:** portal a `document.body` por el mismo motivo que `Modal` (la barra desde la que se invoca lleva `backdrop-blur`, que crea bloque contenedor y rompería `fixed inset-0`); cierra con Escape, con la X o al elegir un resultado; enfoca el campo al abrir; la consulta **no** sobrevive al cierre.
- **Reparto:** el catálogo y los helpers sin JSX (`VISUAL_POR_TIPO`, `GRUPOS_BUSQUEDA`, `partirTitulo`, `agruparResultados`) viven en `busqueda/resultados.ts`; la presentación, en `busqueda/ResultadosBusqueda.tsx`. Están separados para no mezclar componentes y constantes en un mismo archivo (lo avisa `oxlint` por fast-refresh).
- **Dónde:** `BarraSuperior` monta la capa (carga diferida con `lazy`); `InicioPage` reutiliza `ResultadosBusqueda` para su buscador en línea, que conserva porque esa pantalla **es** el buscador.

### 3.8 `red/IconoNodo`
- **Propósito:** icono del tipo de equipo de red (trazo estilo Lucide), compartido entre Topología y Red.
- **Props:** `{ tipo: TipoNodoVisual, className?: string = 'h-4 w-4' }`. `TipoNodoVisual` cubre router, switch, ap, punto, pc, impresora, pos, rack, camara, servidor, ups, generico.
- **Variantes:** un SVG por tipo (set visual con `stroke`, distinto de `iconos.tsx`).
- **Dónde:** `FilaDispositivo`, `TopologiaPage`, `TopologiaEquipoPage`, `CategoriaPage`.

## 4. Fuentes únicas de un patrón

Cada una centraliza un patrón que antes estaba duplicado (con su comentario en el código):

| Fuente única | Centraliza |
|---|---|
| `Chasis` (`src/app/Chasis.tsx`) | el marco de toda pantalla: sidebar, columna, cabecera, pestañas y el espacio que la barra ocupa |
| `nocturne.tsx` (`BTN_*`) | variantes de botón |
| `campos.tsx` (`CLASE_CAMPO*`, `Campo*`) | aspecto de campo y su etiqueta; editor clave/valor |
| `topologiaVisual.ts` (`claseEstado`, `estadoConEtiqueta`) | color y etiqueta del estado de un dispositivo |
| `FilaDispositivo` | fila de dispositivo en listado |
| `BotonVolver` + `padreDe` | destino y etiqueta del botón de regreso |
| `useGrafo` / `grafo.ts` | grafo de referencias entre entidades |
| `Modal` | ventana modal + portal a `document.body` |
| `IndicadorVencimiento` + `vencimiento.ts` | lógica de vencimiento |
| `Marca` | el glifo de la marca (logotipo), fuera del set de iconos de dominio |
| `BotonInstalarApp` + `instalacionPwa.ts` | ofrecer instalar la PWA y detectar si ya lo está |

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
