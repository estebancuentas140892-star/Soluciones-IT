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

107 iconos Phosphor (MIT) inlineados como SVG propios, para no depender de CDN (rompe offline) ni cargar el paquete completo. Suma desde la tarea 182: `DotsNine` (el glifo de "Más", una cuadrícula de 9 puntos; sin variante `Fill`, el mockup usa el mismo trazo activo e inactivo). Suma desde la tarea 208: `ArrowsLeftRight` (invertir la dirección de un enlace). Suma desde la tarea 209: `DotsSixVertical` (asa de arrastre del editor de pasos; es el glifo universal de "esto se agarra y se mueve"). Suma desde la tarea 211: `Crosshair` (entrar al modo foco). El mockup dibujaba un compuesto propio (círculo con cuatro esquinas) que no existe en Phosphor; se usó el icono real más cercano en significado, para no inventar nombres fuera del set. No se reutilizó `ArrowsClockwise`, que en esta app ya significa "rotar/reemplazar" (un icono, un significado). Suma desde la tarea 255: `CursorClick` ("Qué hacer": la acción de un paso de guía) y `ListChecks` (los requisitos de una guía). Suma desde la tarea 257: `Graph` (un grafo de nodos: la topología de la red, en la fila Topología de Más). No se reutilizó `TreeStructure`, que en toda la app es la guía con preguntas y en Más está a la vista a la vez, en Diagnóstico (R24); las pantallas de Red siguen dibujando su topología con `TreeStructure`, colisión anterior anotada en la tarea 189.

Suma desde la tarea 268: `Package` (una caja: la puerta "Herramientas de inventario" de Más; no se reutilizan `QrCode` ni `UploadSimple`, que son solo una de sus herramientas) y `Pulse` (el estado de un equipo, en la fila "Estados escritos a mano"; no se reutiliza `Monitor`, que es la pestaña Equipos). Regla R24: un icono, un significado.

**El generador `scripts/generar-iconos.mjs` ya no reproduce este archivo** (detectado en la tarea 257): conoce 91 iconos, y aquí hay 16 añadidos a mano con sus comentarios, que ejecutarlo borraría. Hasta ponerlo al día (tarea 264), un icono nuevo se copia a mano del SVG de Phosphor (`@phosphor-icons/core` 2.1.1, `assets/regular/<nombre>.svg`; se instala con `npm install --no-save` porque no figura en `package.json`), con la misma forma que los demás (`IconoBase` y un `path`).

- Props: `IconoProps = SVGProps<SVGSVGElement> & { size?: number }`. `size` por defecto 16, `fill="currentColor"` (hereda el color del texto), `aria-hidden` por defecto.
- Variantes: el sufijo `Fill` marca la versión rellena (`Star`/`StarFill`, `House`/`HouseFill`, `Vault`/`VaultFill`...), usada típicamente para la pestaña activa. Suma desde la tarea 254: `WrenchFill`, la pestaña Resolver activa (la inactiva es `Wrench`, que dentro de un paso sigue significando "abrir la contingencia": en los dos casos, una solución).

## 2. Componentes de `src/components`

Convención: "Props" muestra la firma real; los opcionales llevan su default. "Dónde se usa" viene de los call sites reales.

### 2.0 `Chasis` (`src/app/Chasis.tsx`)
- **`conBusqueda` (nivel tarea, tarea 241):** con `compacta`, pone la lupa en la cabecera y monta `BuscadorGlobal` (carga diferida) como capa sobre la tarea. Hoy solo lo usa `AsistentePage`. La capa es un portal a `<body>`, así que la tarea de debajo **no se vuelve a montar**: al cerrar se sigue en el mismo paso, con el mismo progreso y el mismo cronómetro.
- **`amplio` (nivel tarea, tarea 255):** la columna de la tarea pasa de `max-w-md` (448 px) a `md:max-w-3xl` (768 px) desde 768 px de ancho; en el teléfono no cambia nada. Lo usa `AsistentePage`, porque la ruta del procedimiento se ve entera en horizontal y necesita sitio. Los controles de dentro no se estiran: `ModoFoco` y el pie de `AsistenteVista` los centran en `max-w-xl` (576 px).

- **Propósito:** el chasis único de la app (tarea 185, mockup `4c`). Reemplaza a `ShellNocturne` (eliminado) y a los 15 contenedores `max-w-md` que cada pantalla montaba a mano. Aporta el marco completo: sidebar de escritorio, columna de contenido de ancho progresivo, barra superior o de tarea, y barra de pestañas en móvil.
- **Cuatro destinos (2026-09-22, tarea 254, AD-042).** `DESTINOS` es UNA lista para la barra del teléfono, el rail y la barra lateral: **Resolver** (`Wrench`/`WrenchFill`), **Equipos** (`Monitor`/`MonitorFill`), **Bóveda** (`Vault`/`VaultFill`) y **Más** (`DotsNine`). El destino iluminado lo decide `destinoPrincipalDe(pathname)` en los tres, con `aria-current` a mano; el número de urgentes (`AvisoPestana`) va sobre Resolver también en la barra lateral. Desaparecen los grupos "Consulta" y "Trabajo técnico" y `EnlaceGrupo`. En `seccion`, si la ruta tiene padre (`padreDe`, es decir, no es uno de los cuatro destinos), el chasis pasa a `BarraSuperior` la prop `volver` (origen del salto o padre declarado), visible en todos los tamaños.
- **Las guías en el centro (2026-09-17 a 2026-09-21, tarea 244, AD-040; sustituido).** En móvil, **tres pestañas: Inicio, Guías y Más** (antes cinco: Inicio, Guías, Equipos, Red, Más). La pestaña iluminada la decide `pestanaMovilDe(pathname)` y no el enlace, así que dentro de Equipos, Red, Bóveda, Personas o el Centro de consulta se ilumina Más; los enlaces son `Link` con `aria-current` a mano. En escritorio el nav principal es **Inicio y Guías**, y debajo dos grupos de `EnlaceGrupo`: **Consulta** (Equipos, Red, Bóveda con permiso, Centro de consulta, Ubicaciones, Personas) y **Trabajo técnico** (Agenda, Diagnóstico, Escanear). En `seccion`, si la ruta es la raíz de una sección que en el teléfono se abre desde Más (`esSeccionEnMas`), pasa `volverEnMovilA="/mas"` a `BarraSuperior`.
- **Tres niveles y ni uno más (regla R18).** Cada pantalla declara el suyo:

  | `modo` | Qué es | Cabecera | Pestañas | Sidebar |
  |---|---|---|---|---|
  | `seccion` (default) | raíz de una pila: los cuatro destinos (Resolver, Equipos, Bóveda con su bloqueo, Más), y el catálogo de guías y Red, que llevan regreso | `BarraSuperior` (título, estado del dato, buscar, cuenta) | sí | sí |
  | `documento` | algo que se lee o se recorre dentro de una sección | fila de regreso + acciones propias | sí | sí |
  | `tarea` | algo que se hace y de lo que se sale: editor, asistente, escáner, importador, migración | `BarraTarea` | **no** | no |

- **Props** (unión discriminada por `modo`, así cada nivel solo acepta lo suyo):
  - `seccion`: `{ titulo: string, barra?: ReactNode, children }`
  - `documento`: `{ modo: 'documento', volverA?: string, volverEtiqueta?: string, titulo?: string, contexto?: string, acciones?: ReactNode, barra?: ReactNode, children }`
  - `tarea`: `{ modo: 'tarea', rotulo: string, titulo: string, vuelta?: string, salidaA?: string, salidaEtiqueta?: string, alSalir?: () => void, barra?: ReactNode, children }`
  - `barra` es siempre la banda de controles propios de la pantalla, dentro del mismo bloque pegajoso que la cabecera (AD-023).
- **El origen manda sobre el padre declarado (tarea 202, regla M-R2).** En `documento`, el regreso, su etiqueta y la línea de contexto se resuelven en este orden: **origen** (el último salto real, ver 2.4b) → **override de la pantalla** (`volverA`/`volverEtiqueta`, para lo que depende de datos en runtime) → **`padreDe`**, dentro de `BotonVolver`. El origen va primero porque el override es una regla general ("un equipo de red vuelve a Red") y el origen es el hecho concreto de este recorrido ("vengo del escáner"). En `tarea`, lo mismo con el destino de la X y la ruta de vuelta escrita, salvo que la pantalla pase su propia `vuelta`: cuando una tarea sabe nombrarla ("Guías › Impresoras"), sabe más que el chasis.
- **Ancla permanente del nivel documento (tarea 201, hallazgo M-001, regla M-R1).** Con `titulo`, la fila superior pasa de `[regreso con etiqueta] [acciones]` a `[chevron de 44 px] [contexto a 11 px / nombre a 14 px] [acciones]`. Hasta la tarea 201 esa fila solo llevaba el regreso y los iconos: el nombre del equipo o del artículo era un `h1` dentro del scroll, así que en una ficha de tres o cuatro pantallas, tras el primer desplazamiento, lo único que orientaba era la pestaña iluminada, y esa dice "Equipos", no **qué** equipo. Sin `titulo` la fila se comporta como antes, que es lo correcto en las pantallas de documento que son listas y ya escriben su nombre en la banda de abajo (Ubicaciones, Personas, Diagnósticos, Estadísticas, Sugerencias, ficha de categoría, Mi cuenta, Seguridad, Topología). Lo usan las cinco fichas: equipo, artículo, credencial, ubicación y persona.
- **Ranura pegajosa del nivel tarea (tarea 201):** dentro del bloque de `BarraTarea`, bajo `barra`, el chasis publica un hueco que un descendiente puede llenar por portal con `BandaTarea` (ver 2.10n). Lo usa el modo ejecución para su ancla de paso.
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
  - **Memoria por pestaña (R20):** `useMemoriaScroll(pathname)` guarda y restaura la posición de scroll por ruta; `useMemoriaPestana(pathname, search)` guarda los filtros por raíz de pestaña y `destinoDePestana()` los repone en el `to` del enlace. Estando dentro de la pestaña el enlace queda pelado, así que tocar la pestaña activa suelta el filtro y vuelve a su raíz. **Desde la tarea 257 también recuerda `/red`**, que dejó de ser pestaña en la 254 y con eso perdió el nodo que se estaba recorriendo: `RAICES_CON_MEMORIA` (en `memoriaPestana.ts`) son las raíces de pestaña más `/red`, y la fila Red de Más pide su destino con esa lista. Red no entra en `RAICES_DE_PESTANA`, que decide qué es una pestaña (la barra, el padre, qué se ilumina).
  - **Tocar la pestaña activa** en su raíz pelada sube al principio de la lista (con `behavior: smooth`, o `auto` si el sistema pide menos movimiento).
- **Dónde:** todas las rutas autenticadas. `BotonVolver` ya solo lo usan el propio chasis y `BarraTarea`.

### 2.1 `ActualizacionDisponible`
- **Propósito:** barra flotante que avisa cuando hay una versión nueva de la PWA y la aplica al tocar "Actualizar". Hace su propio chequeo cada hora.
- **Props:** ninguna. Devuelve `null` mientras no haya novedad.
- **Dónde:** montado una vez en `App.tsx`, global.
- **La recarga la controla el componente, nunca la librería** (corregido el 2026-07-27 tras un fallo reportado en el teléfono: "le doy al botón y no pasa nada"). `updateServiceWorker` acaba llamando a `messageSkipWaiting()` de workbox-window, que es literalmente `registration.waiting && enviarMensaje(...)`: **si no hay worker en espera no hace nada en silencio**, no se emite `controllerchange` y no hay recarga, pero el aviso sigue visible porque `needRefresh` continúa en `true`. El botón quedaba inerte para siempre. Y `waiting` puede ser `null` con el aviso delante si otra ventana de la app ya activó ese worker, o si el teléfono suspendió la app y el navegador lo activó por su cuenta (raro en escritorio, normal en móvil: por eso el fallo solo se veía en el teléfono). Ahora el componente engancha su propio `controllerchange` **y** una red de seguridad por tiempo (2,5 s) que recarga igual, así que el botón tiene un solo contrato: recarga. Muestra "Actualizando..." y se deshabilita al pulsarse, para que el toque siempre tenga respuesta visible.

### 2.2 `Adjuntos`
- **Propósito:** galería de adjuntos de una ficha (subir desde cámara o archivo, ver, eliminar) con compresión, deduplicación por hash y cola offline.
- **Props:** `{ entidadTipo: 'articulo' | 'dispositivo' | 'historial', entidadId, sinCabecera?: boolean = false }`. `sinCabecera` oculta el rótulo "Adjuntos" cuando el bloque va dentro de una `SeccionPlegable` que ya lo escribe con su conteo (ficha de equipo, M-014); los dos botones de subida se conservan, alineados a la derecha.
- **Variantes:** decide imagen vs archivo genérico según el `tipo`; usa `VisorImagen` para imágenes.
- **Dónde:** `DispositivoPage`, `ArticuloPage`, `Historial` (adjuntos de una intervención), `RegistrarIntervencion`, `AsistenteVista`.

### 2.2b `Avatar`
- **Propósito:** las iniciales del técnico en un círculo, o el icono genérico de usuario si no hay nombre ni correo. Extraído en la tarea 182 al reutilizarse en `PantallaMas` con otro tamaño (34 px, contra los 30 px de `BarraSuperior`); nació en la tarea 181.
- **Props:** `{ nombre?, correo?, className?: string = 'h-[30px] w-[30px] text-[11px]' }`. El tamaño y la tipografía van en `className` (no hay tamaño único posible con clases Tailwind estáticas).
- **Detalles:** las iniciales las calcula `inicialesDe()` (`src/lib/iniciales.ts`, con pruebas): nombre y primer apellido, un solo nombre (sus dos primeras letras), o la parte local del correo como respaldo.
- **Dónde:** `BarraSuperior` (avatar de la ranura de cuenta, con la etiqueta accesible "Ajustes"), el pie de la barra lateral del `Chasis` y `PantallaMas` (fila "Ajustes" del grupo "Aplicación" desde la tarea 268; antes, la fila de perfil de "Configuración" y, hasta la 257, de "Mi cuenta").

### 2.2c `BotonInstalarApp`
- **Propósito:** botón que instala la PWA en el dispositivo, con las instrucciones manuales dentro (modal) para los navegadores que no ofrecen diálogo nativo. Nace en la tarea 184.
- **Props:** `{ className?: string }` (se concatena tras `BTN_PRIMARIO min-h-11 shrink-0 px-3`).
- **Variantes:** el rótulo es **"Instalar"** cuando hay diálogo nativo guardado y **"Cómo instalar"** cuando no (Safari de iOS siempre; el resto, cuando el diálogo ya se usó o se rechazó). Si el técnico rechaza el diálogo, cae al modal de instrucciones.
- **Detalles:** no decide si debe verse; eso depende del contexto (en la bienvenida lo decide el paso 2, en Ajustes la tarjeta que lo contiene, que se oculta si `obtenerEstadoInstalacion().instalada`). Lee el estado con `useSyncExternalStore` desde `src/lib/instalacionPwa.ts`.
- **Dónde:** `BienvenidaPrimerDia` (paso 2) y `CuentaPage` (Ajustes, bloque "Este teléfono"). Son los dos únicos sitios desde donde la app ofrece instalarse: la decisión del handoff es "ahí y en Mi cuenta (hoy Ajustes), nunca como banner intrusivo".

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
- **Props:** `{ to?, children?, soloIcono?: boolean = false, estado? }`. `to` sobreescribe el destino derivado (contexto en runtime, ej. equipo de red vuelve a Red); `children` sobreescribe la etiqueta ("Salir", "Cancelar"); `soloIcono` lo reduce a un cuadrado de 44 px con el chevron, para la fila de nivel documento que ya lleva el ancla permanente de **M-R1** (la etiqueta viaja como `aria-label` y `title`, y el destino lo nombra la línea de contexto). `estado` (2026-09-16) es el `state` del enlace: el chasis lo usa para devolver la búsqueda a la pantalla de la que se salió (`estadoDeRegreso`, ver 2.4b).
- **Dónde:** desde la tarea 185, **solo dos sitios**: `Chasis` en `modo="documento"` y `BarraTarea` (para derivar el destino de la X). Antes lo llamaban 31 archivos, cada uno dentro de una cabecera propia; ahora la cabecera es del chasis y las pantallas solo pasan `volverA`/`volverEtiqueta` cuando el destino depende de datos en runtime (un equipo de red vuelve a Red).

### 2.4b `origenNavegacion` (`src/lib/origenNavegacion.ts`) y `useOrigen` (`src/app/useOrigen.ts`)
- **Propósito:** de dónde vino el técnico, cuando no vino de la lista padre (tarea 202, hallazgos M-002, M-020 y M-029, regla **M-R2**). Complementa a `padreDe` sin sustituirlo: volver pasa a **deshacer el último salto** y el rótulo nombra el destino real ("‹ Escáner").
- **API:** `conOrigen(to, etiqueta)` arma el `state` de un `<Link>`; `leerOrigen(state)` lo lee validándolo; `useOrigen()` lo resuelve para la pantalla actual. El tipo es `{ to, etiqueta }`.
- **Quién lo escribe:** el que ORIGINA el salto, nunca el destino (el destino no puede saber de dónde lo abrieron). Hoy: `EscanerPage` (`Escáner`), `TopologiaEquipoPage` (`Topología`), `DispositivoPage` (el nombre del equipo, para los enlaces a ubicación, persona, reemplazos y, desde la tarea 268, "Etiqueta QR") `HerramientasInventarioPage` (`Herramientas de inventario`, en sus filas: Importar, Etiquetas y las migraciones de ubicaciones y personas; tarea 268) y `SolucionesPage` (`Guías`, con su filtro, en la fila "Guías con preguntas"; tarea 269). Desde la tarea 269 `DispositivoPage` lo pasa también a "Iniciar diagnóstico" (`IniciarDiagnosticoBoton`, prop `estado`) y a "Resolver un problema con este equipo". `PantallaMas` lo escribía en la fila Topología (tarea 257) hasta que esa fila se quitó en la 268. **Excepciones que lo leen por su cuenta:** `EtiquetasPage` (su `BarraTarea` propia no pasa por el chasis), `MigracionUbicaciones` y `MigracionPersonas` (su `Navigate` de salida cuando no queda nada que migrar).
- **Quién lo consume:** el `Chasis`, en `documento` (regreso, etiqueta y línea de contexto) y en `tarea` (destino de la X y ruta de vuelta escrita), y las tres excepciones de arriba.
- **Por qué en `location.state`:** ver [DECISIONES.md](DECISIONES.md) AD-030. En resumen: es por entrada de historial (expresa "el último salto"), llega vacío en un enlace compartido y entonces cae al padre declarado, y no ensucia la URL.
- **`useOrigen` recuerda por pathname, no por montaje.** Un ancla `#seccion` o una query nueva **no** borran el origen (React Router trata un cambio de hash como una navegación con `state: null`), pero pasar de una ficha a otra del mismo tipo sí lo relee, porque ahí React reutiliza la instancia del componente y no hay montaje nuevo.
- **La búsqueda viaja con el origen (2026-09-16).** `conOrigen(to, etiqueta, busqueda?)` acepta `{ consulta, capa }` cuando el salto sale de un buscador; `leerOrigen` la valida (una búsqueda rota no invalida el origen); `estadoDeRegreso(origen)` es el `state` con el que `BotonVolver` y la X de `BarraTarea` la entregan; `leerBusquedaRestaurada(state)` la lee al llegar; `anotarBusqueda` y `sinBusqueda` escriben o borran la de la entrada actual. Los hooks que las usan viven en `src/features/busqueda/busquedaEnHistorial.ts` (`useAnotarBusqueda`, `useBusquedaRestaurada`, que relee en cada llegada PUSH o POP y nunca en un REPLACE). Ver [BUSCADOR.md](BUSCADOR.md), sección 7.8.

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
- **Variantes:** 3 estados internos (en curso, con fallidos, completada). El botón "Descargar" mide 44 px de alto desde la tarea 268 (R6).
- **Dónde:** `CuentaPage` (Ajustes, bloque "Este teléfono"; vivía en Inicio hasta el 2026-09-11). La bienvenida del primer día comparte su estado (`adjuntosOffline.ts`).

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
- **Props:** `{ dispositivo, categoriaNombre, subtitulo, conFoto?: boolean = false, estado?: unknown, alAbrir?: () => void }`. `estado` (tarea 256) es el `state` del salto a la ficha: Equipos pasa su origen con la búsqueda, para que el regreso vuelva a la lista con lo escrito aunque el equipo sea de red; `alAbrir` se llama en el mismo gesto, antes del salto, y Equipos anota ahí su búsqueda para el botón atrás del teléfono.
- **Variantes:** `conFoto` decide avatar de foto (`MiniaturaPortada`) vs siempre icono (`IconoNodo`, para Red).
- **Dónde:** `DispositivosPage` (con foto), `RedPage` (sin foto). Nota: `CategoriaPage` reimplementa esta fila a mano (candidato CAND-2, sección 5).
- **La IP cumple el piso de dato técnico** (**M-R5**, tarea 201): usa `VALOR_TECNICO_COMPACTO` de `FilaDato` (13 px monoespaciado, `neutral-300`, tabular). Antes iba a 11 px en `neutral-600`, unos 3,9:1 de contraste: el texto más pequeño de toda la app justo para el dato que más se busca de pie frente a un rack.

### 2.10b `HojaFiltro`
- **Propósito:** hoja inferior para elegir UNA opción de una lista corta: el segundo eje de filtro de una pantalla de lista, o "en qué categoría" al crear. Implementa la regla R4 de la auditoría de Soluciones (un solo eje de filtro visible; el segundo se plega aquí con su contador).
- **Props:** `{ abierto, onCerrar, titulo, opciones: OpcionHoja<T>[], seleccionada?: T | null, onElegir, onLimpiar? }`. Genérico sobre `T extends string`.
- **`OpcionHoja<T>`:** `{ valor, etiqueta, Icono?, claseIcono?, count? }`. Sin `count` la opción elegida muestra un check en vez del número.
- **Variantes:** "Limpiar" solo aparece si se pasa `onLimpiar` y hay algo elegido (en la hoja de creación no elegir no es un estado válido). Rejilla de 2 columnas, cada opción con `min-h-11` (44 px, regla R6).
- **Dónde:** `SolucionesPage` (hoja de "Tipo de documento" y hoja de "¿En qué categoría?"). Usa `Modal` internamente, que ya resuelve portal, Escape y bloqueo de scroll.

### 2.10c `IndicadorAvance`
- **Propósito:** único indicador de "vas por X de Y pasos" de la app, en cuatro variantes. Al completarse pasa de acento a verde, que es el momento que el técnico busca.
- **Props:** `{ hechos, total, variante?: 'anillo' | 'barra' | 'texto' | 'segmentos' = 'anillo', size?: number = 26, expandido?: boolean = false, actual?: number | null = null, className? }`. `expandido` y `actual` son solo de `segmentos` (tarea 210): el primero reparte los segmentos por TODO el ancho disponible (lo que pide una banda a pantalla completa; con 14 px fijos se leen como un fragmento de barra rota), el segundo pinta a media tinta el segmento del paso que se está haciendo. Sin `actual`, "cuál sigue" se deducía del primer segmento vacío, y eso deja de ser cierto en cuanto hay pasos saltados. **Ojo:** el relleno va por CANTIDAD (`i < hechos`), no por qué pasos concretos están hechos, así que con saltados los segmentos llenos no coinciden uno a uno con las filas del índice; para el mapa exacto está `HojaPasos`.
- **Variantes:** `anillo` es la de fila (su ancho NO cambia con el valor, así que las filas de una lista siguen alineadas); `barra` la de bloque; `texto` la de lectura precisa; **`segmentos`** (tarea 172, mockup `1f`) dibuja un segmento por paso junto al título de una sección, y dice dos cosas que la barra continua no dice: cuántos pasos hay en total y cuál es el que sigue. Por encima de 12 pasos cae sola a `barra`, porque los segmentos se estrecharían hasta no leerse. Todas menos `texto` exponen `role="progressbar"` con sus `aria-value*`.
- **Dónde:** `SolucionesPage` (`barra`, bloque "Sin terminar"), `ProcedimientoVista` y `AsistenteVista` (`segmentos` + `texto` en la cabecera de "Pasos" y en la banda del paso, y `anillo` en la fila de un vínculo), `BarraReanudar` (`anillo`). **CAND-7 cerrado en la tarea 172** para `ContadorSubProgreso`, que era una pastilla "X/Y" propia y además discrepaba del resto (su intermedio era ámbar; en el resto de la app, acento); **ese componente desapareció en la tarea 206**, cuando el anillo pasó a vivir dentro de `FilaVinculo`. **Queda `AvanceArticulo` de `CategoriaPage`**, que se unifica al rediseñar P4 (tarea 174).
- **Uno por documento (regla R57, tarea 206).** El documento anidado ya no dibuja su propio avance: lo dice la fila que lo abre, con el anillo y la frase "Paso 1 de 3 de esta guía". Se retiraron la cabecera "Pasos · 0 de 3" del nivel anidado (`ProcedimientoVista`) y la barra con contador del nivel anidado (`AsistenteVista`), que eran dos barras de acento midiendo cosas distintas.

### 2.10d `PastillaEstado`
- **Propósito:** UNA sola forma para todo estado que acompaña a una fila: pastilla de contorno, sin relleno. Es el `IndicadorEstado` que pedía CAND-1. Antes el mismo tipo de dato se dibujaba de tres maneras a la vez (Borrador con borde punteado y relleno ámbar, Obsoleto con relleno neutro sólido, estado de equipo como punto de color + etiqueta).
- **Props:** `{ tono: 'precaucion' | 'neutro' | 'exito' | 'error', Icono?, children, className? }`.
- **Helpers:** `PastillaEstadoArticulo({ estado })` resuelve tono y rótulo del estado de un artículo; devuelve `null` en `'publicado'` (si todo lleva pastilla, la pastilla no informa). `PastillaEstadoDispositivo({ estado })` (tarea 207) hace lo propio con el estado de un equipo, apoyándose en `estadoConEtiqueta` y en `tonoEstado` de `topologiaVisual.ts`.
- **Variantes:** el texto va en el color pleno del estado (neutral-300 el neutro) y nunca en neutral-600, que a 11 px da 4.0:1 sobre el fondo cuando AA pide 4.5 (regla R2).
- **Dónde:** `FilaArticulo` (y por tanto `SolucionesPage`) para el estado de artículo; `FilaDispositivo`, `DispositivoPage`, `CategoriaPage`, `EscanerPage`, `RedPage` y `TopologiaEquipoPage` para el de equipo. **CAND-1 CERRADO en la tarea 207** (hallazgo **M-017**): las seis copias a mano de "punto de color + etiqueta", más la variante propia `pillEstado` de la ficha del equipo, pasaron a esta pastilla.
- **El punto suelto se conserva a propósito** en el árbol de topología (`TopologiaPage`) y en el de dependencias (`NodoRed`): ahí la fila no lleva el rótulo del estado, solo su color, y una pastilla por nodo sería ruido en un árbol de veinte. `claseEstado` sigue existiendo justo para eso.

### 2.10d-bis `CampoBusqueda`
- **Propósito (tarea 207, hallazgos M-004, M-005 y M-009, regla M-R8):** UN solo campo de búsqueda para toda la app. Había **nueve copias** con cuatro alturas (46, 44, 42), dos radios, dos tamaños de icono y alcances redactados cada uno a su manera; Inicio y Guías llegaban a mostrar dos buscadores a la vez. La auditoría lo midió como una duda antes de escribir: "¿esto busca en todo o solo aquí?".
- **Props:** `{ valor, onCambiar, alcance, textoAlternativo?, refCampo?, className? }`. `alcance` compone el marcador ("Buscar en Guías") y la etiqueta accesible; `textoAlternativo` sustituye SOLO el marcador, para el campo que no busca sino que pregunta (Diagnóstico: "Describir el problema: no imprime, sin red...").
- **Medidas fijas:** 46 px de alto, lupa de 18 que se tiñe de acento al escribir, borde de acento mientras hay texto **y mientras el campo tiene el foco** (`focus-within`, segunda pasada del 2026-09-17; el input lleva `data-campo-busqueda` para que el anillo global de `:focus-visible` no dibuje un segundo marco rectangular dentro de la caja, regla en `src/index.css`; con el foco se suma `ring-1`, así que el foco son 2 px de acento, tan visibles como el anillo que sustituye y distintos del borde de 1 px que queda con texto escrito), y **borrar de 44x44 con margen negativo** (antes unos 26 px en todas menos Guías, y es el control que más se falla porque se usa con el teclado abierto). La "x" nativa de WebKit se oculta siempre, porque duplicaba el botón y medía la mitad.
- **Dónde:** `InicioPage`, `SolucionesPage`, `DispositivosPage`, `BovedaPage`, `EquiposRedPage`, `PersonasPage`, `UbicacionesPage`, `DiagnosticosPage`, `TopologiaPage` y `BuscadorGlobal`.
- **Regla que lo acompaña:** donde la pantalla tiene su campo, la lupa global de `BarraSuperior` no se repite (`conLupa={false}` en Inicio, Guías, Equipos y Bóveda).

### 2.10e `PastillaFrescura`
- **Propósito:** "46 artículos al día · hace 4 min" bajo el título de una pantalla de lista. Implementa la regla R7 de la auditoría (toda lista dice qué tan al día está el dato y si hay cambios sin subir). Antes esta señal solo existía en Inicio, así que en el resto de la app no se sabía si se estaba viendo la copia de ayer.
- **Props:** `{ total, singular, plural, className? }`. El sustantivo lo pone quien la usa, para que sirva a cualquier lista.
- **Variantes:** tres mensajes por prioridad: cambios propios sin subir (ámbar, `CloudArrowUp`), sin sincronizar aún (`CloudSlash`) y al día (`CloudCheck` verde). Es de **solo lectura**: no abre el panel de sincronización, para no sumar un control a una cabecera que la auditoría pedía adelgazar.
- **Dónde:** `SolucionesPage`. Lee el estado con `useSyncExternalStore(suscribirSync, obtenerEstadoSync)` y la antigüedad con `tiempoRelativo()` de `src/lib/tiempoRelativo.ts`.

### 2.10e1 `PEGADA_SOBRE_PESTANAS` (constante de `nocturne.tsx`)
- **Propósito:** el desplazamiento inferior de **cualquier barra pegajosa** en los niveles que conservan la barra de pestañas (sección y documento): `bottom-[calc(65px+env(safe-area-inset-bottom))] md:bottom-0`.
- **Por qué existe** (corregido el 2026-08-03, tarea 201): `sticky bottom-0` ancla el elemento al borde inferior del **viewport**, no al de su contenedor, así que mientras quede contenido por debajo la barra se pinta **detrás** de las pestañas, que son `fixed`. Medido a 360x640 sobre un artículo de 3.348 px: 65 px tapados, casi todo el botón de 52 y su nota. Al llegar al final del scroll la barra vuelve a su sitio en el flujo y se ve bien, y por eso la verificación de la tarea 172 no lo detectó: **hay que medir a mitad de un documento largo, no al final.**
- **El valor es el mismo** `ALTO_PESTANAS` que reserva el chasis (65 px medidos más el área segura, [DECISIONES.md](DECISIONES.md) AD-027), en una sola constante para que un cambio de alto de la barra no haya que perseguirlo por varios archivos.
- **Dónde:** la acción dominante de `DispositivoPage` (hasta el 2026-09-17 también `BarraAccionFicha`, eliminado). **No** se usa en el nivel `tarea` (asistente, editores): ahí no hay pestañas y `bottom-0` es lo correcto.

### 2.10e2 `BarraAccionFicha` (ELIMINADO el 2026-09-17)
- **Retirado en la tarea 244.** Abrir una guía ya lleva a su primer paso pendiente (`GuiaPage`, 3.8r) y la ficha pasó a ser "Detalles de la guía", a la que no se viene a empezar: la barra "Empecemos" / "Continuar en el paso N" / "Repetir guía" no tenía ningún uso. Lo que queda de la historia, abajo.
- **Propósito (histórico):** la única acción dominante de una ficha, fija abajo (tarea 172, mockup `1f`). Nace de la auditoría de la ficha de artículo: "Ejecutar" y "Editar" pesaban lo mismo (Nocturne pide el primario delineado, así que eran dos botones de borde uno al lado del otro), vivían arriba (la zona menos alcanzable del pulgar) y decían siempre "Ejecutar", incluso con 2 de 6 pasos hechos, donde lo que se hace es *seguir*.
- **Props:** `{ to: string, estado: 'empezar' | 'seguir' | 'repetir', paso?: number, total?: number }`. El estado lo calcula quien la monta a partir del avance real; `paso` y `total` solo se usan en `seguir`.
- **Variantes:** la etiqueta y el icono salen del estado ("Empezar" con play, "Seguir en el paso N de M" con play, "Repetir" con flechas circulares), y debajo va una nota de una línea con la promesa correspondiente ("Tu avance se guarda en este teléfono"). Botón de 52 px de alto, pegajoso al pie de la columna de contenido.
- **Dónde:** `ArticuloPage`. La comparte con el editor de P5 (tarea 175).

### 2.10f `BarraSuperior`
- **Propósito:** la barra superior global del chasis (tarea 181, mockup `3d` del handoff). Tres ranuras fijas, siempre en el mismo orden y en todas las secciones (regla **R14**): **título de la sección** (confirma cuál pestaña está iluminada), **estado del dato** (`PastillaSync`) y **buscar + cuenta**. Antes no existía: cada pantalla dibujaba su cabecera con altura, relleno y controles distintos, y los tres servicios globales vivían dentro de Inicio.
- **Props:** `{ titulo: string, conLupa?: boolean, volver?: { to: string; etiqueta: string; estado?: unknown }, children?: ReactNode }`. `children` es la banda de controles propios de la pantalla, que se dibuja justo debajo dentro del mismo bloque pegajoso. **`volver` (2026-09-22, sustituye a `volverEnMovilA`):** chevron de regreso de 44 px antes del título, **en todos los tamaños**, con `aria-label` "Volver a {etiqueta}" y el `state` del regreso (devuelve la búsqueda si el salto salió de un buscador). Lo pasa el chasis en las secciones que no son uno de los cuatro destinos: el catálogo de guías (a Resolver) y Red (a Más). **El avatar de la cuenta** se oculta desde 768 px (`md:hidden`, antes `lg:hidden`): el rail y la barra lateral ya la ofrecen al pie, y la tableta la enseñaba dos veces.
- **El título no lo dibuja ella:** desde la tarea 187 delega en `CabeceraColapsable` (ver 2.10j), que lo contrae al desplazarse sin sacarlo de pantalla.
- **Variantes:** es la cabecera del nivel 1 del chasis (`modo="seccion"`). El nivel 2 (documento) usa una fila de regreso propia del chasis y el nivel 3 (tarea) usa `BarraTarea`; la miga llega con `MigaDePan` (tarea 188).
- **Reglas que aplica:** las acciones propias de la pantalla ("Crear", "Escanear", el menú "···") **no** van en la fila del título: van en `children`. Es la única forma de que la fila superior caiga siempre en el mismo sitio, que es el problema que la barra resuelve. Ver [DECISIONES.md](DECISIONES.md) AD-023.
- **Dónde:** ya no la montan las pantallas: desde la tarea 185 la monta `Chasis` cuando el nivel es `seccion` (Resolver, Equipos, Bóveda y su pantalla de bloqueo, Más, el catálogo de guías y Red).

### 2.10h `BarraTarea`
- **Propósito:** la cabecera del nivel 3 del chasis (tarea 185, mockup `4c`). El nivel `tarea` es el único que puede quedarse sin la barra de pestañas, y la regla **R19** exige que quien la quita ponga algo que oriente en su lugar: fondo de superficie (para que se note que el chasis cambió), rótulo de lo que se está haciendo ("Editando", "Ejecutando", "Migrando"), sobre qué, la ruta de vuelta **escrita** ("Guías › Impresoras · vuelves aquí al terminar") y una X de salida siempre en el mismo sitio.
- **Props:** `{ rotulo, titulo, vuelta?, salidaA?, salidaEstado?, salidaEtiqueta = 'Salir sin guardar', alSalir?, children?, compacta?, trailing?, onBuscar? }`. `salidaEstado` (2026-09-16) es el `state` de la X cuando es enlace (devuelve la búsqueda al origen). `onBuscar` (tarea 241) añade una **lupa** de 44 px entre el título y `trailing`, **solo en modo `compacta`**: abre el buscador global como capa sobre la tarea, sin devolver la navegación principal, y desde el 2026-09-16 en **modo consulta** (nada de la capa navega). Sin la prop, el botón no existe. `vuelta` se deriva de `vueltaDeTarea(pathname)` si no se pasa; esa función devuelve `null` cuando la jerarquía solo sabe decir "Volver" (editar y ejecutar suben a una ficha cuyo nombre depende de datos en runtime), y entonces la pantalla escribe el texto. `alSalir` reemplaza la navegación de la X, para las tareas que guardan avance antes de salir.
- **Dónde:** la monta `Chasis` en `modo="tarea"`. Tres pantallas la usan directamente porque conservan su contenedor propio: `EscanerPage` (el video va detrás a pantalla completa), `EtiquetasPage` (la hoja de impresión vive fuera de la columna) y, por herencia del chasis, el resto de editores.

### 2.10g `PastillaSync`
- **Propósito:** la ranura "estado del dato" de la barra superior: responde de un vistazo "¿ya subió lo que cambié?" con icono, etiqueta y color. Tocarla fuerza una sincronización y abre `PanelSync`.
- **Props:** ninguna. Lee el estado con `useSyncExternalStore(suscribirSync, obtenerEstadoSync)` y la conexión con los eventos `online`/`offline`.
- **Variantes:** cuatro estados. **Al día no gasta palabras en la buena noticia** (tarea 187): solo el icono verde, en un hueco cuadrado de 44x44 igual al del resto de botones de la fila. Los otros tres (sin conexión, con error, subiendo o pendiente) muestran texto y pasan el color también al texto, porque hay algo que atender, y **dicen el número real** ("3 sin subir", "2 con error", "Sin conexión · 3 sin subir") en vez de un genérico "Sincronizando".
- **Historia:** vivía dentro de `InicioPage`, así que en las otras cuatro pestañas no había forma de saber si lo escrito ya había subido. La tarea 181 la extrajo a `src/components/PastillaSync.tsx` y la montó en el chasis (regla **R7** aplicada al chasis); la 187 la volvió adaptativa. **Queda fuera** la franja de ancho completo que el mockup `4e` dibuja para "sin conexión con cambios": exigiría reestructurar la fila de tres ranuras de `BarraSuperior` en todas las pantallas de sección, un cambio de más alcance que el color y el texto.
- **Dónde:** solo `BarraSuperior`.

### 2.10h-bis `contraerAlBajar.ts`
- **Propósito (tarea 207, hallazgo M-033):** la regla de "se encoge al bajar" como función pura, fuera del componente. `decidirContraida(estado, y)` decide, a partir de la posición de la última DECISIÓN (no de la última posición vista), si la barra va contraída.
- **Por qué separada:** la decisión tiene tres matices (dirección, umbral de 8 px y zona de arranque de 40 px) y el entorno de verificación no despacha eventos de scroll con el panel oculto, así que sin extraerla la regla no se podría probar de ninguna forma. 6 pruebas.
- **Dónde:** `BarraReanudar` (`useContraidaPorScroll`), que solo aporta el cableado del evento.

### 2.10i `BarraReanudar`
- **Propósito:** barra flotante que viaja por toda la app mientras haya un procedimiento a medias (tarea 186, mockup `4e`). Caso real: estar en el paso 3 de un mantenimiento y salir a la Bóveda a buscar una clave, sin perder el hilo de vuelta. Muestra el título del artículo, el paso actual, los minutos restantes estimados y un acceso directo "Seguir" al asistente.
- **Props:** `{ articulo: Articulo, hechos: number, total: number, minutosRestantes: number | null, onDescartar: () => void, variante?: 'flotante' | 'sidebar' }`. Presentacional puro; los datos y el estado de descarte los resuelve `useReanudar` (`src/features/soluciones/useReanudar.ts`), que reutiliza `articulosSinTerminar` (ya usado en el bloque "Sin terminar" de `SolucionesPage`) en vez de duplicar la consulta a `progresoPasos`.
- **Se encoge al bajar (tarea 207, hallazgo M-033).** En un teléfono de 360x640 las pestañas (65 px más área segura) y esta barra se sumaban y dejaban unos 430 px de contenido: la pieza que existe para no perder el hilo se comía la pantalla donde se trabaja. Desplazarse hacia abajo es leer, y ahí la variante `flotante` se reduce de 54 a **36 px**, con el anillo de avance, el título truncado y "Paso N de M"; desaparecen el "Seguir" y la "X", pero toda la barra sigue siendo el enlace y el descarte por deslizamiento sigue funcionando. Desplazarse hacia arriba, o volver al principio, la devuelve entera. La regla vive en `contraerAlBajar.ts` (sección 2.10h-bis).
- **Dos variantes desde la tarea 191.** `flotante` (por defecto) es la del teléfono, fija sobre las pestañas y con el arrastre para descartar; se oculta desde 768. `sidebar` es la de escritorio: al pie del rail de navegación, encima de la cuenta, porque ahí el rail ya es persistente y el recordatorio no necesita robar altura al documento. En el rail estrecho (768-1279) queda solo el anillo de avance, del tamaño de los iconos que lo rodean, con el botón de descarte debajo. La variante `sidebar` **no tiene arrastre** a propósito: deslizar es un gesto de dedo, y el botón siempre estuvo como alternativa sin gesto. Medido: 46 px de contenido en el rail de 64 y 206 en el de 232, sin desborde.
- **Se descarta** deslizando horizontalmente (arrastre con umbral de 90 px, con un umbral previo de 6 px antes de capturar el puntero para no robarle el click al botón "X" ni al enlace "Seguir") o con el botón "X", siempre presente como alternativa sin gesto. El descarte se recuerda en `localStorage` mientras siga siendo el mismo artículo: si aparece un procedimiento más reciente para retomar, la barra vuelve a mostrarse sola.
- **Reglas que aplica:** **R23** (un aviso solo si hay un dato detrás: no se muestra si no hay ningún procedimiento a medias). Mientras la barra está descartada, la pestaña Guías (solo móvil) muestra un punto de aviso en su lugar.
- **Dónde:** la monta `Chasis` en los niveles `seccion` y `documento` (no en `tarea`: esas pantallas ya tienen su propia `BarraTarea` y no necesitan una segunda barra flotante, R19).

### 2.10j `CabeceraColapsable`
- **Propósito:** el título de la sección dentro de `BarraSuperior` (tarea 187, mockup `4e`). Al desplazarse pasa de 21 a 14 px y **se queda en pantalla**: la orientación no debe depender solo de la pestaña iluminada, que en escritorio está a 700 px de distancia y mide 10,5 px. El mockup lo mide como una cabecera que baja de 232 a 150 px sin perder el nombre.
- **Props:** `{ titulo: string }`.
- **Cómo:** un listener de `scroll` sobre `window`, con el trabajo diferido a `requestAnimationFrame` y un guardia para no encolar dos por fotograma. Umbral de 12 px, deliberadamente bajo: el mockup lo dibuja como "desplazado", no como un salto que tarde en notarse. La transición es solo de `font-size` y se anula con `motion-reduce`.
- **Dónde:** solo `BarraSuperior` (y por tanto, el nivel `seccion` del chasis). Desde la tarea 201 el nivel `documento` tiene su propia ancla permanente, escrita directamente en el chasis (14 px fijos, sin contraerse: ahí no hay 21 px de los que bajar, ver 2.0). `MigaDePan` con los tramos completos sigue siendo la tarea 188.

### 2.10k `AvisoPestana`
- **Propósito:** el aviso de una pestaña de la barra inferior (tarea 187, mockup `4e`). Aplica la regla **R23** (un aviso solo si hay un dato detrás, ningún punto decorativo): quien la usa decide **cuándo**, este componente solo dibuja.
- **Props:** unión discriminada. `{ variante: 'punto' }` para Guías (hay un procedimiento a medias y la `BarraReanudar` está descartada) y `{ variante: 'numero', valor: number }` para Más (conteo real de `usePendientes()`). Con `valor <= 0` devuelve `null`; por encima de nueve muestra "9+".
- **Variantes:** el punto es de acento y mide 7 px; el número va en `precaucion` sobre texto de fondo, con anillo de 2 px del color del fondo para separarse del icono. Los dos son `aria-hidden`: el texto accesible lo pone la pestaña ("hay un procedimiento a medias", "N pendientes").
- **Dónde:** solo `Chasis`, en la barra de pestañas móvil.

### 2.10l `FilaDato`

- **Propósito:** la fila de etiqueta y valor de una ficha, y el **piso de legibilidad del dato técnico** (tarea 201, hallazgos M-015 y M-032, reglas **M-R5** y **M-R13**). Antes cada ficha la escribía a mano con una etiqueta de 118 px fijos, así que a 360 px de ancho quedaban unos 174 px para el valor y un serial o una MAC se truncaban justo en el teléfono más común del equipo.
- **Props:** `{ etiqueta, valor?, tecnico?: boolean = false, children?, copiable?: string }`. `tecnico` marca IP, serial, placa, MAC, puerto o clave; `children` sustituye el valor de texto por un enlace vivo o una pastilla; `copiable` dibuja el botón de copiar con su confirmación breve.
- **Variantes:** un dato **técnico** nunca comparte renglón con su etiqueta (va debajo, a ancho completo, en `VALOR_TECNICO`: 14 px monoespaciado tabular en `noct-text`) y su botón de copiar mide 44x44 con fondo propio. Un dato **corriente** comparte renglón solo si el contenedor da para ello: el umbral es una **container query de 380 px** sobre el contenedor de la ficha, no el ancho de la ventana, porque la misma fila vive en una columna de 328 px en el teléfono y en una de 720 en escritorio. La etiqueta nunca pasa de 96 px (`w-24`).
- **Exporta dos constantes** para quien pinta un dato técnico fuera de una fila: `VALOR_TECNICO` (14 px, `noct-text`) y `VALOR_TECNICO_COMPACTO` (13 px, `neutral-300`, el piso exacto de M-R5, para listas donde el dato acompaña a un nombre).
- **Exporta `BotonCopiar`** (2026-09-14): `{ etiqueta, texto, destacado?: boolean = false, conTexto?: boolean = false }`. Siempre 44 px de alto con su confirmación breve. `conTexto` escribe "Copiar"/"Copiado" junto al icono, para una tarjeta de lista donde un icono suelto no dice qué hace. Lo usan las tarjetas de atajos y comandos del Centro de consulta (`ReferenciaPage`), que copian la combinación o el comando sin abrir la ficha.
- **Dónde:** `DispositivoPage` (capas "Ahora" y "Contexto"); las constantes, en `FilaDispositivo` y `TopologiaEquipoPage`. Es el camino para retirar las copias a mano de la fila etiqueta-valor que quedan en `CredencialPage`, `UbicacionPage` y `PersonaPage`.

### 2.10m1 `useReanudar` (`src/features/soluciones/useReanudar.ts`)
- **Propósito:** el único dato de "procedimiento a medias" de la app. Lo consumen el chasis (barra flotante + punto de la pestaña Guías) e `InicioPage` (tarjeta).
- **El descarte se comparte entre todas las instancias del hook** (tarea 203). Vivía en un `useState` por instancia y con un solo consumidor bastaba; desde que Inicio lee el mismo dato hay dos, y con estado local **descartar la barra flotante no llegaba a Inicio**: la barra desaparecía y la tarjeta no aparecía en su lugar. Ahora es una variable de módulo leída con `useSyncExternalStore`, así que las dos instancias ven lo mismo en el mismo render.
- **Devuelve:** `{ actual, descartado, descartar }`.

### 2.10m0 `useAccionesDeGuia` (`src/features/soluciones/useAccionesDeGuia.ts`)
- **Propósito:** qué ofrece cada guía ejecutable en este teléfono ("Empezar", "Continuar · paso N de M", "Repetir guía"), resuelto por `accionDeGuia`, en **un solo sitio**. Nació al necesitarlo dos pantallas (tarea 241): el catálogo de Guías, que ya lo calculaba dentro de `SolucionesPage`, y las acciones directas del buscador global.
- **API:** `accionesDeGuia(articulos, progresos)` es pura (para probarla sin React y para que el catálogo la use con los artículos que ya tiene cargados); `useAccionesDeGuia()` la alimenta con dos `useLiveQuery`. Una guía **sin pasos** no entra en el mapa: su ausencia es la señal de que no hay recorrido que ofrecer.
- **Dónde:** `SolucionesPage` (tarjetas del catálogo) y `busqueda/AccionesResultado` (a través del contexto de resultados).

### 2.10m `SeccionPlegable`

- **Propósito:** una sección que **informa al plegarse** (tarea 201, hallazgo M-014, regla **M-R4**). La ficha 360° de un equipo pintaba nueve secciones siempre abiertas: plegar sin más habría cambiado un problema (todo a la vez) por otro (esconder), así que la cabecera plegada muestra **su conteo**: "Conexiones · 4" dice más que cuatro filas que hay que desplazar.
- **Props:** `{ titulo, Icono, conteo: ReactNode, tono?: 'neutro' | 'precaucion' = 'neutro', inicialAbierta?: boolean = false, id?, children }`. `conteo` admite un número ("4"), una cantidad con unidad ("9 equipos") o una frase corta ("hace 6 d"); `tono` tiñe icono y conteo solo cuando el dato en sí es una advertencia; `id` sirve de ancla para los enlaces internos de la ficha.
- **Detalles:** cabecera de 52 px con `aria-expanded`/`aria-controls`, chevron que rota y foco visible. **El contenido solo se monta cuando está abierta**: además de ahorrar trabajo, evita que cinco bloques con sus propias consultas en vivo se pinten enteros para quedar fuera de pantalla.
- **Dónde:** `DispositivoPage`, capa "Profundidad", y `ActividadDelEquipo`, al final de la Agenda (tarea 257; antes, en Más, junto a Mis favoritos, que ahora es una fila que se despliega). Prevista también para las fichas de artículo, credencial y Red (tareas 202 a 205).

### 2.10ñ `BarraReanudar`, variante `tarjeta`
- **Propósito:** el bloque grande de "reanudar" de Inicio (tarea 203, hallazgo **M-013**, mockup `2b`). El procedimiento a medias se dibujaba de **tres** formas que parecían tres cosas distintas y eran la misma: "Continuar donde quedaste" (con su propia consulta dentro de `InicioPage`), "Sin terminar" en Guías y la barra flotante del chasis; en Inicio se veían **dos a la vez**. Ahora las tres salen del mismo dato (`useReanudar` -> `articulosSinTerminar`) y las dos de reanudar, del mismo componente.
- **Props:** las mismas, con `variante="tarjeta"`. Rótulo "Sigues en el paso N de M", título a 15 px, barra de avance y el tiempo restante.
- **Sin botón de descartar**, a diferencia de `flotante` y `sidebar`: esas acompañan al técnico por toda la app y a veces estorban; esta vive dentro de la agenda, que es justo donde se va a retomar el trabajo, así que descartarla no tendría a dónde llevar el recordatorio.
- **La acción, en un verbo (2026-09-20, tarea 247):** `aria-label="Continuar {título} · paso N de M"`. Su nombre accesible era "Sigues en el paso 2 de 5 …", que describe el estado y no lo que pasa al tocarla.
- **No se repite:** es la fila de "En curso" de la agenda, y `agendaSinGuiaEnCurso` saca de ese grupo el borrador que ya representa.
- **Dónde:** `SeccionesAgenda` (y con ella Inicio y `/agenda`).

### 2.10n `BandaTarea` (`src/app/bandaTarea.tsx`)

- **Propósito:** ranura pegajosa del nivel `tarea` del chasis (tarea 201, hallazgo M-010). `BarraTarea` ya es un bloque pegajoso y admite una banda debajo, pero el dato que el modo ejecución necesita ahí ("Paso 3 de 7 · Sustituir el cartucho", con su progreso) depende del paso actual, que vive dentro de `AsistenteVista`, varios niveles por debajo del `Chasis` que monta la barra.
- **Props:** `{ children }`. Fuera del nivel `tarea` no dibuja nada (no falla), así que el mismo componente puede montarse en una pantalla de documento.
- **Cómo:** el chasis publica un hueco dentro de su propio bloque pegajoso y lo expone por contexto; quien tiene el dato lo llena con `createPortal`. El hueco se guarda en **estado** (no en una ref) para que, al montarse, los hijos vuelvan a renderizar y el portal encuentre su destino. Las dos alternativas eran peores: subir todo el estado del asistente a la pantalla (un componente que además se anida en sí mismo), o poner un segundo bloque pegajoso con un `top` calculado contra el alto medido de la barra, que cambia con el largo del título.
- **Dónde:** `Chasis` (provee) y `AsistenteVista` en nivel 0 (consume).

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
- **Dónde:** solo `PastillaSync` (se abre al tocar la pastilla de la barra superior, en cualquier sección). Hasta la tarea 181 se abría solo desde Inicio.

### 2.14 `ReferenciadoPor`
- **Propósito:** inverso universal "¿qué referencia a esto?"; a partir del grafo derivado (`useGrafo`) lista quién usa una entidad, agrupado por tipo de vínculo, con enlace a cada origen. Se oculta si no hay referencias.
- **Props:** `{ tipo: TipoEntidad, id, relaciones?: TipoRelacion[], titulo?: string = 'Referenciado por' }`. `relaciones` limita qué vínculos mostrar (para no duplicar bloques propios de la ficha).
- **Dónde:** hoy solo `ArticuloPage`. Otras fichas (Dispositivo, Credencial) usan `useGrafo`/`referenciasHacia` directo.

### 2.15 `VisorImagen` e `ImagenAmpliable`
- **Propósito:** visor de imagen a pantalla completa, y la miniatura que lo abre. **Reescrito el 2026-09-10** (encargo, tarea 3): existía, pero solo lo alcanzaban dos sitios y **los gestos no se veían** (acercar exigía saber de antemano que había pellizco y doble toque, que con un ratón no existen, y no había forma de volver al tamaño original salvo adivinar el gesto inverso).
- **`VisorImagen`, props:** `{ url, alt, pie?, onCerrar }`.
  - **Controles visibles de 52 px:** **alejar**, **restablecer** y **acercar**, más el **porcentaje** de zoom y un **botón de regreso** ("Volver") arriba a la izquierda. Los gestos siguen: pellizco, doble toque (alterna 1 y 2.5) y arrastre con `escala > 1`. Límites de escala **1 a 4**, paso de 0,5.
  - **La imagen se ve COMPLETA** (`object-contain`), aunque la miniatura de origen vaya recortada.
  - **Conserva el texto alternativo y el pie**, que se muestra bajo la imagen.
  - **Cierra** con "Volver", con **Escape** o tocando fuera. El Escape va **en fase de captura y detiene la propagación**: la vista previa del editor también escucha Escape en `document`, así que sin eso una sola pulsación cerraba el visor **y** la prueba entera.
  - **Devuelve el foco y la posición:** al abrir recuerda qué elemento tenía el foco y cuánto había desplazado la página, y los repone al cerrar. Es `role="dialog"` con `aria-modal`.
- **`ImagenAmpliable`, props:** `{ url, alt, pie?, className?, claseBoton?, etiqueta? }`. La miniatura dentro de un control tocable con la invitación **"Toca para ampliar"** visible (icono de lupa con +) y `cursor-zoom-in`. `className` manda en el recorte de la miniatura; el visor abre **la misma URL**, que es el archivo original de Storage, nunca una miniatura estirada.
- **Dónde:** portada de la ficha (`ArticuloPage`) y de la prueba (`VistaPreviaArticulo`), imágenes de un paso y de una tarea y adjuntos de la galería del paso (`ProcedimientoVista`), y adjuntos heredados (`Adjuntos`).

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
- **Propósito:** línea de tiempo unificada de una entidad: combina cambios de campos, intervenciones manuales, ejecuciones de diagnóstico y accesos de auditoría de bóveda en un solo componente plegable. Desde la tarea 266 no enseña las entradas técnicas (`esEntradaTecnica`: el `responsableId` que acompaña al nombre del responsable).
- **Props:** `{ entidadTipo: TipoEntidadHistorial, entidadId }`.
- **Variantes:** por `entidadTipo` decide qué sub-eventos anexar (artículo suma `ejecuciones_diagnostico`; credencial o campo protegido suman `accesos_boveda`). `procedimiento` y `detalles` muestran un resumen en lenguaje natural con el JSON plegado en "Detalle técnico".
- **Dónde:** `DispositivoPage`, `ArticuloPage`, `CredencialPage` (vía la ficha), `CategoriaPage`, `UbicacionPage`, `PersonaPage`, `DiagnosticoForm` (solo edición), `SeguridadDelEquipo` (por campo protegido). Cubre 8 tipos de entidad.

### 3.1c `historial/ActividadDelEquipo` (2026-09-23, tarea 257)
- **Propósito:** lo que pasa en el equipo (quién creó, editó o eliminó qué ficha y quién ejecutó qué diagnóstico), plegado tras su conteo. Vivía dentro de `PantallaMas` (y antes en Inicio); salió a un componente propio al mudarse a la Agenda, porque Más es un índice de destinos y esto no es un sitio al que se va.
- **Props:** ninguna. Lee `obtenerActividadReciente()` (`actividadEquipo.ts`: las cinco últimas, con las ediciones seguidas de un mismo técnico sobre una misma ficha en un solo renglón) con `useLiveQuery`. **Sin actividad devuelve `null`**: la pantalla no reserva sitio.
- **Detalles:** `SeccionPlegable` ("Actividad del equipo", `UsersThree`, el conteo) dentro de un marco con borde. Cada fila (`FilaActividadItem`, la misma de siempre) es una frase enlazada a su ficha, "Ana editó Reiniciar el switch (3 cambios)", con el tiempo relativo a la derecha.
- **Dónde:** `AgendaPage`, lo último de la pantalla. No en el resumen de Resolver.

### 3.1b `red/useImpactoEquipo` (hook)
- **Propósito:** el impacto de una falla y la cadena de dependencia de un equipo, **como dato**. Devuelve `{ impacto, camino, nombreCategoria, totalEquipos }` a partir del mismo árbol de topología que la vista de mapa (`src/features/red/arbol.ts`), así que no duplica la lógica de "qué depende de qué".
- **Por qué existe aparte del componente** (tarea 201): la ficha de equipo necesita el TOTAL **antes** de decidir si monta la sección y qué escribe en su cabecera plegada ("Si falla, caen · 9 equipos", regla **M-R4**). Sacar el cálculo del componente evita que la ficha lo copie.
- **Dónde:** `ImpactoYDependencias` (que lo pinta) y `DispositivoPage` (que lo cuenta).

### 3.2 `boveda/CampoSecreto`
- **Propósito:** fila de un dato descifrado (usuario, contraseña, IP) con botón de copiar y, si aplica, mostrar/ocultar. Es para **mostrar**, no para escribir.
- **Props:** `{ etiqueta, valor, oculto?: boolean = false, alternarOculto?, onCopiado? }`. `onCopiado` deja que quien lo use registre la auditoría de bóveda sin acoplar el componente a ella.
- **Variantes:** la presencia de `alternarOculto` decide si aparece el botón de ojo (IP/URL no lo llevan). Botón interno "copiar + tilde 1.5 s".
- **Valor largo (tarea 240):** mostrado, el valor se lee **entero**: ocupa el ancho que queda (`min-w-0 flex-1`) y parte en varias líneas aunque no tenga espacios (`whitespace-normal break-all`, monoespaciado). Oculto, los puntos siguen en una sola línea (`truncate`). La fila va alineada arriba, con un relleno que centra la primera línea con los botones, y las acciones no se encogen (`shrink-0`); la etiqueta no pasa del 45 % del ancho y parte si hace falta. Copiar copia siempre el valor completo. `FilaSecreto` de `CredencialPage` (la ficha de la Bóveda) sigue el mismo criterio.
- **Dónde:** `CredencialEnPaso`, `MigracionCredenciales`, `SeguridadDelEquipo`.

### 3.3 `boveda/CredencialEnPaso`
- **Propósito:** el dato protegido vinculado a un paso o a una tarea; contraído por defecto, solo consulta la bóveda al abrirse, con las mismas protecciones que la sección Bóveda.
- **Desde la tarea 206 es una `FilaVinculo`** (sección 3.8n), no una caja: perdió el borde discontinuo, el fondo propio y el rótulo "Datos protegidos" porque era un marco más entre los cinco que llegaba a mostrar un paso (M-012). Lo que dice que está protegido es el candado, más el hecho de que no aparezca nada hasta desbloquear; lo que dice qué es, el título del secreto, que además nombra lo que el técnico va a obtener. Al abrirse, los datos van sangrados tras la línea de `ZONA_ANIDADA`.
- **Props:** `{ vinculo: VinculoProtegido, variante?: 'fila' | 'bloque' = 'fila' }` donde `VinculoProtegido = { tipo: 'credencial' | 'campo', id, titulo }`.
- **Variantes:** según `vinculo.tipo` muestra los datos de una credencial (`<dl>`) o el valor de un campo protegido. Estados: sin autorización, vínculo eliminado, bóveda bloqueada (desbloqueo inline). **`variante="bloque"` (2026-09-22, tarea 255, sección 8 del encargo):** "Credencial necesaria", con la llave y el rótulo, en un bloque neutro (borde divisor y superficie, sin color) que envuelve la misma fila. Los controles no cambian: contraído, permiso, contraseña maestra, autobloqueo y registro de cada consulta. Desde ese día los mensajes "Los datos vinculados fueron eliminados" y "No se pudo descifrar" van neutros: dentro de una guía el amarillo significa "lugar".
- **Dónde:** siempre como `bloque` desde la tarea 255: `ModoFoco` (el de la acción o, si no tiene, el del paso), `AsistenteVista` (el del paso, tras el cuerpo y antes de "Debes ver"; ya no es una fila entre los vínculos) y `ProcedimientoVista` (el del paso, en el mismo sitio, y el de una tarea, sangrado bajo ella en `BloqueVista`). También dentro de una guía con preguntas (tarea 263), porque su procedimiento se ejecuta con la misma `AsistenteVista`.
- **Desbloqueo en línea a 44 px (2026-09-22, tarea 263):** el campo de la contraseña maestra y "Desbloquear" medían 38 px; se desbloquea de pie, en medio de una guía (regla R6).

### 3.4 `boveda/IndicadorVencimiento`
- **Propósito:** aviso de vencimiento de una credencial (ámbar si se acerca, rojo si venció); nada si no hay fecha o falta mucho. La lógica de cálculo vive en `src/lib/vencimiento.ts`.
- **Props:** `{ venceEn: string | null, variante?: 'claro' | 'nocturne' = 'claro' }`.
- **Variantes:** `'claro'` (pastilla rellena con emoji, en el paso de un procedimiento); `'nocturne'` (delineada, con icono `ClockCountdown`).
- **Dónde:** `CredencialEnPaso` (claro), `CredencialPage` (nocturne). **No es lo que pinta la fila de `BovedaPage`**: esa lista tiene su propio marcado (tarea 205), porque una fila vencida no lleva pastilla sino la duración escrita en la segunda línea (`descripcionVencida` en `vencimiento.ts`); solo la "próxima a vencer" conserva una pastilla, distinta de esta.

### 3.5 `dispositivos/estados.ts` y el estado visual
- **Aclaración:** no existe un componente `IndicadorEstado` con ese nombre; el que cumple ese papel es `PastillaEstado` (sección 2.10d). `estados.ts` es solo un re-export de `ESTADOS_SUGERIDOS` (los chips del formulario) y, desde la tarea 266, de `estadoCanonico`.
- El VOCABULARIO del estado vive en `src/features/red/topologiaVisual.ts`, que es su única fuente: `ESTADOS_CONOCIDOS` (agregar, renombrar o recolorear un estado es tocar esa lista y nada más; cada estado puede declarar `alias`), `estadoConEtiqueta(estado)` (etiqueta canónica), `estadoCanonico(estado)` (la etiqueta canónica o null, para la lógica que DECIDE por el estado, tarea 266), `claseEstado(etiqueta)` (color Nocturne, para los puntos de los árboles) y `tonoEstado(etiqueta)` (tono de pastilla, tarea 207, con pruebas).
- **Cinco estados desde la tarea 266:** Operativo, **Disponible** (tono `exito`, como Operativo, porque también funciona; en el editor su punto va hueco), En mantenimiento, Fuera de servicio y De baja (con el alias "Dado de baja").
- **`dispositivos/estadosEscritos.ts` (tarea 268):** la lógica pura de la unificación asistida (RN-053). `estadosPorUnificar(dispositivos)` agrupa los textos fuera de la lista (sin distinguir mayúsculas ni espacios) con su `canonico` (equivalencia segura) o su `sugerido` (palabra conocida, a confirmar); `cambiosDeEstado(dispositivos, elecciones)` da los cambios concretos; `cuantosEstadosPorUnificar` es el número de la fila de Herramientas de inventario. La pantalla es `inventario/EstadosPorUnificarPage`: una tarjeta por texto con radios en forma de chip de 44 px (los cinco estados y "Dejar como está").
- **Desde la tarea 207 la FORMA es una sola** (hallazgo M-017): `PastillaEstadoDispositivo`. Antes el marcado "punto de color + etiqueta" se repetía a mano en seis pantallas y la ficha del equipo tenía además su propia `pillEstado`, que mantenía a mano el mismo dominio de estados.

### 3.6 `ubicaciones/SelectorUbicacion`
- **Propósito:** selector de ubicación dentro del editor de dispositivo; el dato canónico es `ubicacionId`, `ubicacion` (texto) es la copia de referencia. Permite elegir una existente, escribir texto libre o crear una nueva sin salir del formulario.
- **Props:** `{ ubicacionId: string | null, ubicacion, onChange(ubicacionId, ubicacionTexto) }` (controlado).
- **Variantes (estado interno):** vinculada a fila / texto libre / nueva (mini-formulario inline).
- **Dónde:** solo `DispositivoForm`.

### 3.7 `personas/SelectorPersona`
- **Propósito:** selector de persona, mismo patrón que `SelectorUbicacion` pero sin jerarquía; canónico `responsableId`, copia `responsable`.
- **Props:** `{ responsableId: string | null, responsable, onChange(responsableId, responsableTexto) }`.
- **Desde la tarea 266** solo ofrece personas activas; la ya vinculada se conserva aunque se haya retirado, marcada "(retirada)", para que editar otro dato del equipo no la suelte sin querer. Una persona creada aquí nace activa.
- **Dónde:** solo `DispositivoForm`. (Nota: `FormularioConexion` reimplementa el mismo patrón por su cuenta, candidato CAND-6.)

### 3.7b `personas/DecisionSobreEquipo` (`DecisionEquipo.tsx`, 2026-09-23, tarea 266)
- **Propósito:** "¿Qué pasa con este equipo?" en un solo control, porque la misma pregunta aparece al retirar a una persona (una por equipo) y al liberar un equipo. Tres opciones de radio (`role="radio"`, 44 px): **Dejar sin responsable** (con la casilla "Marcar como Disponible", `role="checkbox"` con la forma de las casillas de las guías; marcada si el equipo funcionaba, desmarcada y con aviso si su estado no lo dice, oculta si está en mantenimiento o fuera de servicio, ver `sugerirDisponible`), **Asignar a otra persona** (un `select` de personas activas) y **Dar de baja** (con la explicación de que la baja se completa en su pantalla si hay dependencias).
- **Props:** `{ dispositivo, eleccion: Eleccion, onCambiar, personas, permitirBaja? = true }` (controlado). `Eleccion`, `eleccionInicial` y `aDecision` (traduce a la `DecisionEquipo` que ejecuta `retirarPersona`, o null si falta la persona) viven en `eleccionEquipo.ts`, aparte, para que el archivo del componente solo exporte componentes.
- **Dónde:** `RetirarPersonaPage` y `HojaLiberarEquipo`.

### 3.7c `personas/HojaLiberarEquipo` y `personas/HojaAsignarPersona` (2026-09-23, tarea 266)
- **`HojaLiberarEquipo`:** `Modal` con `DecisionSobreEquipo` y un motivo opcional. "Confirmar" libera o reasigna (`liberarEquipo`, `asignarEquipo`); con "Dar de baja", "Ir a dar de baja" abre la pantalla de baja de siempre. Props: `{ dispositivo: Dispositivo | null (null = cerrada), persona, otrasPersonas, onCerrar, desdeElEquipo? }`; con `desdeElEquipo` la pantalla de baja vuelve al equipo en vez de a la persona. Dónde: "Liberar" en `PersonaPage` y "Cambiar" en `ResponsableDelEquipo`.
- **`HojaAsignarPersona`:** `Modal` con `CampoBusqueda` y la lista de personas activas (radio de 44 px); si lo escrito no existe, "Crear a «…» y asignarle el equipo". Props: `{ dispositivo, abierto, onCerrar }`. Dónde: "Asignar" en `ResponsableDelEquipo`.

### 3.7d `personas/ResponsableDelEquipo`, `ResponsablesAnteriores` y `useAsignaciones` (2026-09-23, tarea 266)
- **`ResponsableDelEquipo`:** la fila "Responsable" de la ficha del equipo, con sus cuatro casos: persona activa (enlace, "Desde el …" si el historial lo dice y "Cambiar"), persona retirada (el aviso para reasignar o liberar), texto que no es una persona ("Sin responsable" y "Anotado: «…» · por validar", con "Asignar") y nada ("Sin responsable" y "Asignar"). En un equipo de baja que conserva el vínculo de antes dice "Último responsable"; sin vínculo, no se dibuja. Props: `{ dispositivo, origen }`.
- **`ResponsablesAnteriores`:** la fila de "Más datos del equipo" con quién lo tuvo y cuándo, cada persona como fila de 44 px que abre su ficha. Props: `{ periodos, origen }`; no dibuja nada sin periodos.
- **`useAsignaciones.ts`:** `useEntradasDeAsignacion(dispositivoId)` (las entradas `responsableId` de un equipo, por el índice `[entidadTipo+entidadId]`) y `useResponsablesAnteriores(dispositivoId)`, que la ficha usa también para contar la fila en la cabecera plegada (M-R4).
- **Dónde:** `DispositivoPage` (sección "Ahora" y "Más datos del equipo").

### 3.7e `mas/FilasMas`: `FilaMas`, `TituloGrupo` y `ConteoFila` (2026-09-23, tarea 268)
- **Propósito:** las filas de una pantalla índice. Vivían dentro de `PantallaMas`; salieron a su módulo para que Herramientas de inventario tenga exactamente la forma de Más sin copiarla.
- **`FilaMas`:** `{ to, Icono, titulo, subtitulo, conteo?: number | null, nota?, estado?: EstadoConOrigen }`. Enlace de 58 px de alto: icono neutro de 17 en un recuadro de 34, título a 15 px, subtítulo a 12 que **parte línea en vez de recortarse** (desde la tarea 268), `nota` debajo ("Mejor desde el ordenador"), el conteo a la derecha y el galón. `estado` es el `state` del salto (`conOrigen`), para las filas cuya pantalla no tiene a esta como padre (M-R2).
- **`TituloGrupo`:** el `h2` en versalitas de 11 px que abre cada grupo. **`ConteoFila`:** `{ valor: number | null }`, cifra tabular a la derecha (M-025); con `null` no dibuja nada.
- **Dónde:** `PantallaMas` (todas sus filas menos Mis favoritos, que se despliega, y Ajustes, que lleva el avatar), `inventario/HerramientasInventarioPage` y, desde la tarea 269, `soluciones/SolucionesPage` (la fila "Guías con preguntas", dentro de una tarjeta con borde).

### 3.8b `soluciones/FilaArticulo`
- **UNA TARJETA, UN TOQUE (2026-09-17, tarea 244).** La tarjeta entera es **un solo enlace** a la guía (que abre su paso pendiente), con `state` de origen (`conOrigen` de la lista con su filtro y término, criterio A03) y un galón a la derecha. **Se retira la zona de acción** ("Empezar", "Continuar · paso N de M", "Abrir"): con la tarjeta llevando a lo mismo, repetía el enlace. Lo que decía de una guía a medias queda como información en una línea de acento, **"Vas en el paso N de M"** o **"Faltan las comprobaciones finales"** (`lineaAvanceGuia`, en `accionGuia.ts`, que sustituye a `etiquetaAccionGuia` y `estrenaEjecucion`). Prop `accion?: AccionGuia | null`. Lo que sigue describe las zonas 1 y 2, que no cambian.
- **Propósito:** tarjeta de un artículo en un listado, en zonas apiladas: título y metadatos. Reemplaza el marcado que `SolucionesPage` y `CategoriaPage` copiaban por separado.
- **Props:** `{ articulo, to, categoriaNombre?, consulta?, coincidencia?: CoincidenciaFila, avance?: AvanceFila | null }`. `conSeparador` **se retiró** en la tarea 214: la fila dejó de ser un renglón de una lista continua y pasó a ser una tarjeta con hueco.
- **LAS TRES ZONAS (tarea 234, encargo del 2026-09-09, sección 1).** Hasta entonces la tarjeta era **una fila**: glifo, título, pastilla "Borrador" y botón de ejecutar de 52 px repartiéndose el mismo ancho. En 360 px al título le quedaban unos **150**, así que "Configurar las páginas que abre Google Chrome al iniciar en un POS" se leía como una columna de palabras sueltas. Ahora:
  1. **Título**, con el glifo al lado y nada más en su renglón: unos **252 px** útiles en 360, y el texto entero sin recorte.
  2. **Metadatos** en una línea que envuelve: categoría, pasos, minutos, verificación y la pastilla de estado, que **bajó aquí** desde su antigua ranura del renglón del título.
  3. **Acción** en su propia fila, que nunca le quita ancho al título.
  **Sin `line-clamp` ni puntos suspensivos:** el nombre completo se lee en la tarjeta, así que no hace falta ningún gesto para recuperarlo, y menos uno de `hover`, que en un teléfono no existe.
- **Línea de capacidad (tarea 214, tablero `3b`).** La fila decía `categoría · tipo · min`, exactamente igual para una guía de 7 pasos con verificación final que para un borrador sin un solo paso, así que el técnico descubría que la guía estaba vacía **después de abrirla**, de pie y frente al equipo. Ahora dice **"7 pasos · ~25 min · verificación"** o **"Sin pasos · para leer"** (ver `capacidadGuia.ts`, 3.8k). Desde la segunda pasada del 2026-09-17 **ninguna parte va en ámbar**: el ámbar es de los riesgos (regla 20c) y un artículo para leer no lo es; lo distinguen el borde punteado y las palabras.
- **(Histórico, hasta el 2026-09-17) la acción en su propia fila:** "Empezar" a 48 px directo a `/ejecutar`, "Continuar · paso N de M" con avance a medias y "Abrir" de 44 px sin procedimiento. Se retiró con la tarea 244 (ver arriba).
- **La línea de avance no resucita "Sin terminar"** (retirado por H01): no ordena, no filtra ni saca ninguna guía de su sitio; solo informa de la que ya estás mirando. Sin pasos cerrados, o con la guía terminada, no se dibuja.
- **Un solo control:** al no quedar ninguna acción dentro, la tarjeta entera puede ser el enlace sin anidar controles, con `aria-label` "Abrir la guía «X»" (o "Abrir «X»" si no tiene pasos).
- **Variantes:** `categoriaNombre` se pasa solo cuando la lista puede mezclar categorías (buscando, en "Todos" o por etiqueta); dentro de una categoría sería repetirlo en cada fila. `coincidencia` sustituye la línea de metadatos por "Coincide en la etiqueta X" cuando el término no acertó en el título. Un artículo obsoleto baja de jerarquía (título en neutral-300) sin desaparecer.
- **Regla R1 ("color con oficio"):** el matiz del TIPO vive en el glifo y el recuadro va neutro (`text/6%`). Antes el recuadro entero iba relleno del color del tipo y, con seis tipos en la misma columna, la lista se leía como un arcoíris donde el color ya no informaba. El color de la CATEGORÍA sigue viviendo en los chips de filtro, nunca en la fila.
- **Dónde:** `SolucionesPage`. **Pendiente:** migrar `CategoriaPage` al rediseñar P4.
- **Relación con la decisión de la tarea 145** (que dijo "NO crear `<FilaArticulo>`"): ahí se comparaba la fila de artículo contra `FilaDispositivo` y la de Red, y sigue valiendo (esto **no** se unifica con la fila de dispositivo). Lo que se unifica son las **dos filas de artículo**, que divergían solo porque nadie las había mirado juntas y que el rediseño hace converger a propósito. Ver [DECISIONES.md](DECISIONES.md).

### 3.8p `soluciones/IntroduccionGuia`
- **Propósito:** la PRESENTACIÓN de una guía, lo que se lee **antes** de empezarla (encargo del **2026-09-10**, tarea 2). Nace de separar la ficha de la ejecución: `ArticuloPage` montaba el procedimiento entero debajo del título, así que las tareas, sus casillas, sus verificaciones, los cierres de paso, las guías vinculadas desplegadas y las comprobaciones finales se veían (y se podían marcar) sin haber empezado nada.
- **Exporta cuatro piezas**, compartidas por la ficha real (`ArticuloPage`) y la prueba del editor (`VistaPreviaArticulo`), para que el autor vea exactamente lo mismo que el técnico:
  - **`ResumenGuia({ tiempoMin, dificultad, totalPasos })`**: los tres datos que dicen cuánto cuesta la guía, en fichas de una línea (2 columnas en móvil, 3 desde `sm`). Omite el dato que no existe. Tiempo y dificultad **salieron** de la lista de metadatos, donde se leían junto a la versión.
  - **`IntroduccionGuia({ procedimiento })`**: **Objetivo** y **Requisitos** (hasta el 2026-09-22, "Antes de empezar"), cada uno en su sección corta. Vivían dentro de `ProcedimientoVista`, así que desaparecían al quitarlo de la ficha.
  - **`ListaIntro({ titulo, items })`**: lista de viñetas sin casilla (síntomas, posibles causas). **Sin casilla a propósito:** en la presentación no se marca nada.
  - **`SeccionIntro({ titulo, children })`**: el rótulo de sección más su contenido, para que la información llegue en bloques breves y diferenciados y no como un muro en 360 px.
- **Dónde:** `ArticuloPage` (desde el 2026-09-17, **Detalles de la guía**: ya no es la puerta de una guía con pasos) y `VistaPreviaArticulo` (la prueba del editor, que desde el 2026-09-17 **entra por los pasos**, como el técnico, y ofrece "Ver los detalles de la guía").

### 3.8q `soluciones/TarjetaGuiaVinculada` y `soluciones/estadoVinculo.ts`
- **Propósito:** la tarjeta compacta con la que un vínculo se presenta dentro del modo foco (encargo del **2026-09-10**, tarea 4). Antes un vínculo era una fila de 44 px que, al abrirla, **desplegaba el procedimiento entero debajo de la tarea principal**: dos guías en una pantalla, con dos zonas de acciones y una página que no acababa.
- **`TarjetaGuiaVinculada`, props:** `{ kicker, titulo, estado, onAbrir }`. Muestra el **papel** (**"Guía necesaria"** o **"Consulta opcional"**), el **nombre entero sin truncar**, el **estado escrito** y una sola acción.
- **`estadoVinculo(hechos, total, completada)`** traduce el avance a texto: **"Sin iniciar"**, **"Paso X de Y"** o **"Completada"**, con su acción (**"Abrir guía"**, **"Continuar guía"**, **"Ver guía completada"**). Sustituye al **anillo de avance de 22 px**, que no dice ni cuántos pasos hay ni en cuál va y encima obligaba a recortar el nombre. `completada` la resuelve quien llama con `guiaTerminada`, la misma regla que usa la ejecución: pasos cerrados **y** comprobaciones finales.
- **Abrir NO despliega nada aquí:** avisa a `ModoFoco`, que sustituye el contenido de la tarea por la ejecución de esa guía (ver 3.8i).
- **Dónde:** `AsistenteVista` (`VinculoEnFoco`), tanto para el vínculo del paso (`subArticuloId`) como para los bloques `guia` de una tarea.

### 3.8r `soluciones/GuiaPage` y `RedireccionAGuia` (2026-09-17, tarea 244)
- **Propósito:** que abrir una guía sea empezar a hacerla (RN-036, AD-040). Es la pantalla de la dirección `/soluciones/:categoriaId/:articuloId`: lee el artículo y monta `AsistentePage` (la ejecución) si tiene pasos, o `ArticuloPage` (la lectura) si no los tiene o no existe. Las dos se cargan en diferido, así que abrir una guía con pasos no descarga `react-markdown`.
- **`RedireccionAGuia`:** la dirección antigua `/ejecutar` redirige a la guía con `replace` y conservando el `state` (origen y búsqueda), para que la X siga deshaciendo el recorrido real.
- **Sin props.** Cambiar lo que hay detrás de la dirección, y no la dirección, mantiene válidos los enlaces guardados, la lista, el buscador, los recientes, la ficha del equipo y las guías relacionadas.
- **Relacionados:** `ArticuloPage` acepta `comoDetalles` (ruta `/detalles`): en una guía con pasos su regreso dice "la guía" y su contexto "Detalles de la guía"; ya no monta ninguna barra de acción. `AsistentePage` pasa a `AsistenteVista` la `salida` de la pantalla de terminada (origen o padre declarado).

### 3.8t `busqueda/BorradoresCoincidentes` (2026-09-20, tarea 248)
- **Propósito:** enseñar en Inicio los artículos en `borrador` que coinciden con la búsqueda, **sin meterlos en el índice oficial**. Cierra el defecto de la guía de la resolución DIAN: existe, tiene nueve pasos y está en borrador, y como "DIAN" encuentra la ficha de HKA Factura, el viejo aviso (que solo vivía dentro de "Sin coincidencias") no se dibujaba nunca.
- **Props:** `{ borradores, consulta, consultaCruda }`. La lista la calcula quien busca, con `borradoresCoincidentes` (`borradoresEnBusqueda.ts`, lógica pura y probada): `estado === 'borrador'`, sin eliminar, cruzado con la MISMA `coincidenciaArticulo` de la lista de Guías. Con la lista vacía devuelve `null`.
- **Forma:** bloque con borde propio, rótulo "Borradores coincidentes" y conteo. Cada fila: título con el término resaltado, pastilla **"Borrador"** (`PastillaEstadoArticulo`), categoría y la acción **"Abrir borrador"**. Tres visibles, "Ver el otro" / "Ver los otros N" (`textoVerOtros`, la misma regla de plural que la agenda) y "Ver todos en Guías", que conserva la consulta. El desplegado va atado a la consulta que lo abrió: cambiar lo escrito lo repliega.
- **Solo coincidencias DÉBILES desde la tarea 249:** lo que coincide en el título sube arriba (`GuiasEnBorrador`) y no se repite aquí. Sin débiles, el bloque no se dibuja.
- **Dónde:** `InicioPage`, debajo de los resultados oficiales (o del aviso "No hay una guía publicada con esta búsqueda").

### 3.8u `busqueda/GuiasEnBorrador` (2026-09-20, tarea 249)
- **Propósito:** la guía en `borrador` que coincide **en el título**, pintada **encima de los resultados**: quien busca "DIAN" viene a hacer el procedimiento que se llama así, no a leer la ficha de la herramienta que lo acompaña (RN-042).
- **Props:** `{ borradores, consulta, consultaCruda }`. La lista sale de `repartirBorradores(...).destacados`; quién va delante o detrás de los resultados lo decide `hayGuiaPublicadaEnTitulo` en `InicioPage`.
- **Forma:** sin cabecera de sección (es la primera respuesta y un rótulo la bajaría una línea). Fila de 60 px con borde ámbar, título a 15 px con el término resaltado y, debajo, **"Borrador · contenido por confirmar · {categoría}"**.
- **Adónde lleva:** a la guía (`/soluciones/:categoriaId/:articuloId`), con el origen y la búsqueda en el `state` (`conOrigen` + `useAnotarBusqueda`), así que salir de la guía vuelve a Inicio con lo escrito. Con pasos, `GuiaPage` abre la ejecución en el primer paso pendiente.
- **Dónde:** `InicioPage`.

### 3.8v `BuscarActualizacion` y `AvisoActualizacion` (2026-09-20, tarea 250)
- **Propósito:** saber, cuando uno quiere, si el teléfono tiene la versión desplegada, y poder decir cuál lleva. `BuscarActualizacion` es el bloque "Aplicación" de Ajustes (fila de Más hasta la tarea 268); `AvisoActualizacion` es la pastilla flotante "Versión nueva disponible" con su botón.
- **Por qué están separados de `ActualizacionDisponible`:** ese componente importa `virtual:pwa-register/react`, que solo existe con el plugin PWA corriendo y cuelga bajo vitest. Con el aviso y la recarga (`activarYRecargar`) en piezas propias, todo el comportamiento se prueba y el componente queda como cableado.
- **`BuscarActualizacion`:** sin props. Lee el estado compartido con `useSyncExternalStore(suscribirActualizacion, estadoActualizacion)` y llama a `comprobarActualizacion(true)` (forzada: no espera el freno de un minuto), que pide `/version.json` a la red, hace `registration.update()` y lee todos los estados del worker. Cinco textos: buscando, al día, versión nueva disponible, sin conexión y sin service worker. Debajo, el diagnóstico (versión instalada, versión en el servidor, estado del worker y hora de la última comprobación).
- **`AvisoActualizacion`:** `{ visible, onActualizar }`. Al tocar, pasa a "Actualizando..." y se deshabilita. Sale con `needRefresh` de la librería **o** con la fase `disponible` que descubre una comprobación propia: `needRefresh` solo se enciende si el evento llega a esa ventana, y con la PWA instalada el worker puede quedar en espera sin que se vea.
- **Dónde:** `CuentaPage` (Ajustes > Aplicación, desde la tarea 268; antes `PantallaMas`) y `ActualizacionDisponible` (global).

### 3.8s `inicio/AgendaPage` (2026-09-17, tarea 244; reducida en la 247)
- **Propósito:** la **vista completa** de la agenda (vencidos, para hoy, próximos, en curso y por revisar del equipo), nivel `documento`, en `/agenda`. Desde la tarea 247 (2026-09-20) Inicio vuelve a resumir esos mismos grupos, y esta pantalla se conserva entera como la vista sin buscador delante.
- **Ya no dibuja nada por su cuenta:** monta `ResumenDelDia` (sin la fecha, que va en la cabecera del chasis como `contexto`) y `SeccionesAgenda`. Se quedó en 37 líneas: antes eran 268, con su propia copia de las filas. Desde la tarea 257 monta además, al final, `ActividadDelEquipo` (plegada, y solo si hay actividad).
- **Puertas:** "Ver la agenda completa" en el bloque "Atención" de Resolver y la fila "Agenda" del grupo Consulta de Más (con lo urgente como subtítulo). Desde el 2026-09-22 es la ÚNICA pantalla que pinta los cinco grupos: Resolver solo enseña lo que tiene fecha.

### 3.8s-bis `inicio/SeccionesAgenda` (2026-09-20, tarea 247)
- **Propósito:** los grupos de la agenda, **una sola vez**, para las dos pantallas que los muestran (Inicio y `/agenda`). Antes cada una tenía su copia de `FilaAgenda`, `CabeceraAgenda` y `BloqueLista`; dos copias del mismo dibujo es como empiezan a divergir (un tope distinto de "Próximos", un estado nuevo que solo entra en una).
- **Exporta:** `SeccionesAgenda` (los cinco grupos, el estado "Todo al día por hoy" y, opcional, el enlace "Ver agenda completa"), `ResumenDelDia` (fecha y resumen de una línea) y `FilaAgenda`.
- **Props de `SeccionesAgenda`:** `{ agenda, cargando?, conEnlaceCompleta? }`. La agenda se la pasa quien la calcula (`agruparAgenda(usePendientes().items)`): el componente no consulta la base, salvo `useReanudar()` para la tarjeta de "En curso".
- **No repite la guía a medias:** `agendaSinGuiaEnCurso` (en `agenda.ts`, probada) saca de "En curso" el borrador que ya lleva la tarjeta de reanudar.
- **Estados por grupo:** cada cabecera lleva un punto de color (`vencido` rojo, `hoy` ámbar, `proximo` y `porRevisar` gris, `enCurso` acento) y cada fila su acción en un verbo (`accionDeItem`: Abrir, Continuar o Revisar), también en el nombre accesible del enlace ("Abrir Panel del router · Vencido").
- **Cargando:** con `cargando` no dice "Todo al día por hoy" (afirmaría que no hay nada vencido antes de mirarlo); muestra "Cargando la agenda…".
- **Dónde:** `AgendaPage`. `FilaAgenda` la reutiliza además el bloque "Atención" de `ResolverPage` (ver 3.8w). `conEnlaceCompleta` ya no lo pasa nadie desde el 2026-09-22: el enlace a la agenda completa lo pone "Atención".

### 3.8w `inicio/ResolverPage` y `inicio/resolver.ts` (2026-09-22, tarea 254)
- **Propósito:** Resolver, el primero de los cuatro destinos: "¿Qué necesitas resolver?", el buscador global en línea y, debajo, solo lo que ayuda a resolver algo. Sustituye a `InicioPage` (renombrada con `git mv`, conserva su historia) y a la pestaña Guías.
- **Bloques, cada uno solo si tiene algo que decir** (reglas puras y probadas en `resolver.ts`):
  - **Atención** (`BloqueAtencion`): `asuntosDeAtencion(agenda)` junta vencidos, de hoy y próximos en el orden de la agenda y recorta a tres (`ATENCION_VISIBLES`); se pinta con `FilaAgenda` y termina en "Ver la agenda completa" (con el total entre paréntesis si hay más de tres). Los borradores y las sugerencias no tienen plazo y no salen aquí.
  - **Recientes** (`BloqueRecientes`): `juntarRecientes(guiasRecientes(...), recorridosRecientes(...))` lista hasta tres (`RECIENTES_VISIBLES`) usadas en los últimos 14 días (`DIAS_RECIENTES`): guías con pasos (sin obsoletas ni eliminadas; un borrador entra marcado) y, desde la tarea 263, guías con preguntas (diagnósticos con preguntas, no eliminados), la más reciente primero. `GuiaReciente` gana `tipo` (`articulo` o `diagnostico`) y `enCurso` (`dondeVaElRecorrido`: "Vas en la pregunta N", "Haciendo «guía»" o "Llegaste al final: falta cerrarla"; `null` si no hay nada respondido). La que está a medias dice dónde va y su acción es "Continuar". El título y el detalle ocupan hasta dos líneas (`line-clamp-2`): a 360 px no se cortan. Una guía con preguntas sin empezar lleva el icono `TreeStructure` (el mismo de su resultado en el buscador) y "Guía con preguntas · hace N días". Los datos: `db.recientes` (local, no se sincroniza), el avance de `articulosSinTerminar` y `db.progresoDiagnostico`.
  - **Accesos rápidos** (`BloqueAccesos`): `accesosRapidos(categorias, articulos, visitas)` devuelve las categorías con al menos una guía publicada y ejecutable (`esGuiaPublicadaEjecutable`), las más usadas en 30 días primero y luego por su `orden`, hasta seis; con menos de dos devuelve `[]` y el bloque no se dibuja. Cada chip (44 px, icono de `iconoDeCategoria` en el color de la categoría) lleva a `/soluciones?categoria=<id>`. **"Todas las guías" está siempre**, con o sin accesos: es la única puerta al catálogo desde que Guías dejó de ser pestaña.
- **Todos los saltos llevan origen** (`conOrigen('/', 'Resolver')`): la X de la guía y el regreso del catálogo vuelven aquí.
- **Lo que conserva de Inicio:** el buscador con su lógica completa (borradores coincidentes, puente de la Bóveda, volver con la búsqueda escrita, foco automático solo con puntero fino) y la bienvenida del primer día al final.

### 3.8z `dispositivos/busquedaEquipos.ts`, `lib/conexiones.ts` (`conectadoA`) y el escáner (2026-09-22, tarea 256)
- **`busquedaEquipos.ts`** (lógica pura, con pruebas): `camposDeBusqueda(dispositivo)` (nombre, IP, ubicación, serial, placa, marca, modelo), `buscarEquipos(dispositivos, idsRed, { texto, categoriaId })` que devuelve `{ generales, deRed }` (los de red solo al escribir y sin chip; los dos en orden natural por nombre) y `conteosDeChips` ("Todos" incluye los de red). La usa `DispositivosPage`.
- **`conectadoA(conexiones, dispositivoId)`** y **`textoConectadoA(nombre, puerto)`** en `src/lib/conexiones.ts`: el enlace de subida del equipo (el otro extremo es el origen) y la línea "SW-CENTRAL-02 · Puerto 18". Los usa `DispositivoPage` ("Conectado a", en "Ahora").
- **Escáner:** `resolverCodigo` gana el resultado `asistencia` (`extraerCodigoAsistencia`: `/conectar?codigo=` con 6 cifras, de cualquier origen); `sesionEscaneo.ts` gana `ultimoAbierto`/`marcarAbierto` y `crearFiltroReapertura(bloqueado, cuadrosLibres = 5)`, que decide cuadro a cuadro si ignorar la etiqueta recién abierta. `EscanerPage` abre la ficha directamente con un solo equipo; la tarjeta "Equipo identificado" se retiró.
- **`DispositivosPage`:** buscador y "Escanear QR" con el mismo peso, "Crear equipo" secundario, sin menú "···" ni resumen de estados, chips de 44 px, bloque "Equipos de red" y la búsqueda repuesta al volver (`useBusquedaRestaurada` / `useAnotarBusqueda`, el chip en `?categoria=`).
- **`DispositivoPage`:** "Ahora" con tipo, IP, ubicación, responsable y "Conectado a"; "Problemas frecuentes", "Procedimientos" y "Credenciales" solo si tienen algo; "Más datos del equipo" plegado al principio de "Profundidad"; la puerta de documentar lleva `id="documentar"` y se abre sola con ese ancla.

### 3.8x `soluciones/RutaProcedimiento` y `soluciones/rutaVisual.ts` (2026-09-22, tarea 255)
- **Propósito:** la ruta del procedimiento (sección 5 del encargo del 2026-09-22): orienta, dice de dónde se viene, dónde se está y qué viene, sin enseñar el contenido de ningún paso. Debajo sigue mandando el paso actual.
- **Props:** `{ resumenes: ResumenPaso[], indiceActual, onIrAPaso(indice), onVerRutaCompleta() }`. Los `ResumenPaso` son los mismos del índice (`estadoPasos.ts`), así que la ruta y `HojaPasos` no pueden discrepar.
- **Teléfono (por debajo de `md`):** lista vertical recortada al paso anterior, el actual y el siguiente. El actual es la cabecera del paso ("Paso N de M" en azul y su título a 17 px); los vecinos son filas de 44 px que mueven la vista. **"Ver la ruta completa · N pasos"** abre el índice cuando quedan pasos fuera.
- **Desde `md`:** la ruta entera en horizontal, nodos en pastilla unidos por flechas que parten línea si hace falta, y debajo "Paso N de M" con el título. Nodo hecho: marca verde; actual: azul, en negrita, con su número y `aria-current="step"`; saltado: borde discontinuo; pendiente: neutro. Un paso con un riesgo real (`tieneCuidado`) lleva el aviso rojo pequeño. El color nunca va solo: el nombre accesible de cada nodo es `descripcionDeNodo` ("Paso 3 de 7: Abrir SGC (estás aquí, con un riesgo que atender)").
- **Tocar un nodo mueve la vista; nunca marca nada** (igual que el índice).
- **`rutaVisual.ts`** (lógica pura, con pruebas en `rutaVisual.test.ts`): `etiquetaDeRuta(titulo)` quita del título un verbo de NAVEGACIÓN inicial (entrar, abrir, ir a, seleccionar, hacer clic en... en infinitivo e imperativo, sin tildes, del más largo al más corto) y el artículo que le sigue: "Abrir SGC" da "SGC" y "Ir a la intranet", "Intranet". Un título que no empieza por uno de esos verbos se deja entero ("Verificar que imprime" no pasa a "Que imprime"), y si al quitarlo no queda nada que nombrar, también. `vecinosDeRuta` y `descripcionDeNodo` completan la pieza.
- **Dónde:** `AsistenteVista`, solo en nivel 0 (dentro de un vínculo orienta la ruta de arriba): en `ModoFoco` como su prop `ruta` y en la vista de paso entero como cabecera.

### 3.8y `soluciones/SenalesDePaso` (2026-09-22, tarea 255)
- **Propósito:** las dos señales que responden dos de las tres preguntas de un paso: DÓNDE se hace y QUÉ DEBO VER después (sección 6 del encargo). Viven aparte porque las usan las tres vistas de una guía y `ModoFoco` ya importa de `ProcedimientoVista`: tenerlas en cualquiera de los dos cerraría un ciclo de importaciones.
- **`DondeSeHacePaso({ lugar })`:** barra lateral y fondo en el amarillo `noct-lugar`, chincheta (`MapPin`) y la palabra "Dónde:".
- **`DebesVerPaso({ texto })`:** barra lateral y fondo en verde `noct-exito`, ojo (`Eye`) y la palabra "Debes ver:". Recibe `paso.resultado`, nunca `paso.objetivo` (AD-043).
- **Dónde:** `ModoFoco` ("Dónde" con la primera acción del paso, "Debes ver" con la última), `AsistenteVista` (paso entero: "Dónde" antes del cuerpo, "Debes ver" al final) y `ProcedimientoVista` (lectura, en los mismos sitios). Cada una solo se dibuja si el paso trae ese campo.

### 3.8j-bis `soluciones/HojaPasos`, prop `tituloGuia`
- **El nombre completo de la guía encabeza el índice (2026-09-09, cambio 4).** La cabecera de ejecución mide 44 px desde la tarea 218 y trunca el título; en 360 px se corta de verdad, y durante la ejecución ese es el **único** sitio donde aparece el nombre, así que quedaba irrecuperable (no hay `hover` en un teléfono y el `title` de HTML no se abre con el dedo). Va sin truncar y puede ocupar varias líneas.

### 3.8b-bis `soluciones/BloqueVista` (en `ProcedimientoVista`)
- **Una VERIFICACIÓN no se marca, se responde (2026-09-09, cambio 2).** Era la misma casilla de 56 px que una instrucción, con la etiqueta "Verificación" al lado, así que "lo miré y salió" y "lo hice" eran el mismo gesto, y la única forma de decir que **no** salió era el "Falla" del paso entero, que no nombra la comprobación. Sin responder se dibuja como bloque con **"Sí, lo comprobé"** y **"No se cumple"** (el mismo patrón que `DecisionEnTarea`); ya respondida vuelve a ser fila con casilla, para corregirse tocándola.
- **Prop `onNoSeCumple?(texto)`**: la aporta quien tiene la hoja de salidas a mano. `AsistenteVista` la conecta al MISMO `HojaFalla` que el "Falla" del paso, con la comprobación nombrada. `ProcedimientoVista` (mapa de lectura del artículo) no la pasa: ahí no hay contingencia que abrir, así que la comprobación solo se confirma.

### 3.8i `soluciones/ModoFoco` y `soluciones/tareasFoco.ts`
- **Propósito:** **la ejecución** de un procedimiento, **una acción a la vez** (tarea 211, tablero `6d`; promovida a modo por defecto en la **tarea 217**). Frente al equipo, con una mano y guantes, la unidad real de trabajo es la TAREA ("pulsa Editar"), no el paso.
- **QUÉ DICE LA PANTALLA DESDE EL 2026-09-17 (tarea 244, AD-040).** De arriba abajo, en el orden en que se usa: **"Antes de empezar, ten a mano"** (`AntesDeEmpezar`, exportado; solo en la primera acción del paso 1 de una ejecución sin avance y solo con requisitos) · segmentos de avance si el paso tiene más de una acción · **"Paso N de M"** y el título del paso cuando no repite la instrucción (más "hecha" si ya lo está) · **alertas** (precaución e importante) antes de la instrucción · la **instrucción a 26 px** · **datos técnicos** a la vista · atajos y comandos · **imágenes a la vista** (sin chip) · la **clave** (`CredencialEnPaso`) · **archivos** · tarjetas de guías vinculadas · términos · **"Más información"** plegado (información y consejos, el objetivo del paso en su primera acción, y las imágenes y archivos del paso en las acciones siguientes). Al pie: **"Anterior"** (64 px) y **"Siguiente"** / **"Terminar"** / **"Comprobado · siguiente"** (64 px), las dos respuestas de una decisión, y una línea discreta con **"Tengo un problema"** y, en una acción ya hecha, **"Desmarcar"**.
- **LA GUÍA SE ENTIENDE LEYENDO POCO (2026-09-22, tarea 255, AD-043).** `ruta?: ReactNode` (la aporta `AsistenteVista` en nivel 0) sustituye a la línea "Paso N de M": la ruta ya lo dice. Encima de la instrucción, `EtiquetaDeAccion` (interna) nombra la clase de trabajo con icono y palabra: "Qué hacer" (`CursorClick`, azul `noct-accion`), "Comprueba" (`SealCheck`, verde), "Decide" (`Question`, neutro) o "Hecha" (`Check`, verde). Con la **primera** acción del paso va `DondeSeHacePaso` (`paso.lugar`) y con la **última**, `DebesVerPaso` (`paso.resultado`); `paso.objetivo` sigue plegado en "Más información" como "Para qué". `AntesDeEmpezar` se titula **"Requisitos"** (con `ListChecks` y "Ten esto listo antes de empezar."). El dato protegido va como `CredencialEnPaso` `variante="bloque"`. El "No" de una decisión es neutro con una X, y la línea que dice qué guía falta (`motivoGuias`), neutra. Los controles de abajo se centran en `max-w-xl` para que no se estiren con el `Chasis` `amplio`.
- **Props:** `{ paso, tituloPaso, numeroPaso, totalPasos, hayPasoSiguiente, instruccionesHechas, subSatisfecho, guiaDelPasoDisponible?, anidado?, requisitos?, entrarPorElFinal?, onPasoAnterior?, onAlternarTarea, onCompletarPaso, etiquetaAvance, puedeCerrarPaso, onFalla, onDecisionResuelta, guiasPendientes, tituloGuiaPrincipal?, onVinculoCompletado, renderTarjetaGuia, renderGuia }`. **Retiradas** `avisosConfirmados` y `onConfirmarAviso`.
- **Los avisos acompañan y no detienen (2026-09-17, RN-038).** `tareasParaFoco` devuelve **solo trabajo** (clases `tarea`, `paso-entero` y `guia-del-paso`; la clase `aviso` se retiró) y `avisosDeTareaFoco(paso, tareas, indice)` entrega los de cada acción repartidos en `{ alertas, datos, plegados }` según `presenciaDeAviso` (tonos.ts). Los del paso, y los heredados sin asignar, van solo con la primera acción. Ya no hay pantalla de aviso ni "Entendido · continuar", ni confirmaciones que guardar. Deshace la tarea 1 del encargo del 2026-09-10: con varios avisos por guía se tocaba "Entendido" sin leer.
- **"Anterior" cruza de paso:** desde la primera acción de un paso llama a `onPasoAnterior`, y `AsistenteVista` vuelve al paso anterior **por su última acción** (`entrarPorElFinal`). "Siguiente" en una acción ya hecha recorre primero lo que queda delante en el mismo paso y desde la última pasa al siguiente, sin marcar nada.
- **Comportamiento:** entra en la primera acción pendiente del paso (la vista espera a que la lectura en vivo del avance llegue, `avanceCargado`, para no decidirla con el avance a medio leer). La acción dominante **registra la acción Y trae la siguiente** en un solo gesto; **desmarcar no mueve nada**. Completar la última acción del paso **cierra el paso y abre el siguiente** sin un segundo clic (lo hace `alternarTarea` del hook, que encadena `intentarCompletarPaso`). Una entrada `guia-del-paso` pendiente **no dibuja botón**: su acción dominante es la de la tarjeta del vínculo.
- **(Histórico)** Hasta el 2026-09-17: instrucción a 30 px, botón de 76 px, chips de 52 px para clave, fotos, archivos e "Información del paso" (que llegaba abierto en la primera tarea), pastillas "Tarea N de M", "Comprobación", "Decisión" y "Completada", "Tengo un problema" como botón ámbar de 56 px, y cada aviso como elemento del recorrido con su confirmación (`avisosConfirmados`, estado de `AsistenteVista`).
- **`onFalla` se ofrece como "Tengo un problema"**, en la línea secundaria. Abre la misma hoja de salidas **sin completar nada ni cambiar de acción**.
- **El botón grande cambia de trabajo, no de sitio** (tarea 217, `accionFoco`): completa la tarea mientras queden sin hacer, y **cierra el paso** (`onCompletarPaso`, con el mismo rótulo que la vista completa) cuando ya no queda ninguna. Antes había que salir al paso entero para avanzar, que con el foco por defecto habría dejado la ejecución sin salida. Desde el **2026-09-10** ese estado casi no llega a verse en un paso con tareas: completar la última ya lo cierra.
- **Un paso SIN tareas ya no expulsa a nadie** (tarea 217, hallazgo G-18): `tareasParaFoco` lo presenta como **una sola tarea** con el título del paso, y el botón grande cierra el paso directamente. Esa pseudo tarea lleva el id `paso:<id>`, que no puede chocar con el de ningún bloque, y no monta los segmentos: un solo segmento no mide nada.
- **SIN CABECERA PROPIA desde la tarea 218** (G-09, G-10). Hasta entonces montaba su propio bloque de 56 px ("3/7 · título" + "Ver el paso entero"), que sumado a los 68 px de la barra de tarea del chasis daba 124 px de cromo fijo, el doble cromo del que se dibujaba. Ese bloque se retiró: `indicePaso`, `totalPasos` y `onVerPasoEntero` **salieron de las props**, porque el "3/7" y el cambio de vista los da ahora la barra compacta de `AsistenteVista` (ver 3.8h) y el índice de pasos.
- **No toca el modelo de datos:** los bloques ya tenían id, tipo y progreso propio (`instruccionesHechas`), y `alternarTarea` ya marcaba de a una. Esta vista solo los recorre.
- **Una DECISIÓN se responde, no se marca (tarea 234, secciones 5 y 6 del encargo del 2026-09-09).** Esta vista pintaba una decisión igual que una instrucción: mismo "Marcar hecha" y ninguna de sus dos respuestas, así que marcarla equivalía a responder "sí" en silencio y el destino del "no" no aparecía en ninguna parte. Ahora lleva pastilla **"Decisión"**, la pregunta como titular y **dos respuestas**: "Sí" (marca y avanza) y **"No, abrir «X»"**, que despliega el destino ahí mismo con el rótulo "Si esto falla". Al terminarlo, la decisión queda respondida, el avance del destino se reinicia y el técnico se queda en el mismo punto; "Volver a la pregunta" deshace la respuesta. Sin destino configurado, "No, continuar" registra la decisión igual. Los datos (`decisionArticuloId`, `decisionArticuloTitulo`) existían desde antes: llegan al recorrido por `TareaFoco.decisionGuiaId`.
- **`renderGuia` decide qué significa terminar la guía anidada.** Sus opciones `kicker`, `abierta` y `alCompletar` son lo que permite que la misma pieza (`SubProcedimientoEnAsistente`) sirva para dos papeles: **requisito del paso** (al terminar, se intenta cerrar el paso) y **salida de una decisión** (al terminar, se responde la decisión).
- **Los apoyos del paso, UNA sola vez a la vista.** El reparto por `alcance`/`tareaId` vive en `apoyosTarea.ts`. Desde el **2026-09-17** las imágenes y archivos del paso se ven **con la primera acción del paso** y, en las siguientes, quedan dentro de "Más información"; el dato protegido del paso ya llegaba a cada acción por `TareaFoco.vinculoProtegido`. El chip "Información del paso" se retiró.
- **`onFalla`** abre la MISMA hoja de salidas que el control equivalente de la vista completa (`HojaFalla`, 3.8l; unificados en la tarea 215). Lo único que aporta el foco es saber en qué tarea estaba el técnico. **No sale del foco**: eso lo hace la salida que se elija, porque las salidas ocurren en el paso completo; cancelar devuelve al técnico donde estaba.
- **LA GUÍA VINCULADA SUSTITUYE EL CONTENIDO DE LA TAREA (encargo del 2026-09-10, tarea 4).** El vínculo se presenta como tarjeta compacta (ver 3.8q) y abrirlo **reemplaza** la tarea por la ejecución de esa guía, con una **cabecera compacta** ("Estás realizando «X» para continuar con «Y»") y "Volver a la guía principal". Mientras dure, **el pie de la tarea principal desaparece entero**: una sola zona de acciones por pantalla. Al terminarla se cierra sola y se vuelve al punto exacto; al salir sin terminarla, el vínculo **sigue pendiente**. Props nuevas: `tituloGuiaPrincipal`, `onVinculoCompletado` y `renderTarjetaGuia`; `renderGuia` pierde `kicker` y `abierta` (ya no hay fila que rotular ni nada que desplegar), y `guiaDelPasoEnLinea` **se retiró**, porque ya nunca hay dos zonas de acciones que arbitrar.
- **Arriba del todo y con el foco en el encabezado**, cada vez que cambia lo que está en pantalla: al pasar de tarea, al completar una y al volver de un vínculo. La ejecución no desplaza la ventana sino un contenedor del chasis, que conservaba el desplazamiento de la tarea anterior, así que la siguiente aparecía empezada por la mitad.
- **El pie es opaco y con borde, no un degradado:** el degradado dejaba el texto a medio leer detrás de su mitad transparente. Al ser `sticky` reserva además su propio hueco en el flujo.
- **Dónde:** `AsistenteVista` en nivel 0, con `key={paso.id}`: al completar el paso, el foco se remonta ya puesto en la primera tarea del siguiente.

### 3.8o-bis `soluciones/revisionGuia.ts`, `dividirTarea` y `DivisionSugerida` (regla 20 en el editor)
- **Propósito (segunda pasada del encargo del 2026-09-17, [DECISIONES.md](DECISIONES.md) AD-041):** que el editor señale lo que hace confusa una guía al ejecutarla, mientras se escribe: un requisito que es una acción, una tarea que encadena varias acciones y una alerta que solo recuerda algo. Son pistas: nunca impiden guardar ni cambian nada sin un toque del autor.
- **`revisionGuia.ts`** (lógica pura, con pruebas en `revisionGuia.test.ts`): `esAccionDePantalla(texto)` (empieza con un gesto sobre una pantalla o un menú: entra, abre, selecciona, pulsa, ve a, haz clic... en imperativo de tú y de usted y en infinitivo; NO los gestos físicos como "conectar", que son preparaciones válidas), `accionesEncadenadas(texto)` (las acciones una por una, con las palabras del autor y sin los conectores, o `null`; umbral: tres acciones, o dos con "luego", "después", "a continuación"...; el contexto inicial "En el POS, abre..." viaja con la primera), `esRecordatorio(texto)` ("Recuerda", "No olvides", "Ten presente", "Ten en cuenta") y `revisarGuia(requisitos, pasos)` → `{ requisitosQueSonAcciones: { texto, enPaso }[], tareasEncadenadas, alertasQueRecuerdan }`. `enPaso` busca la misma acción en los pasos comparando el OBJETO (sin verbo, conectores ni artículos: "Entrar al administrador" = "Entra en Administrador"). **Ajustes del mismo día, tras probarlo con frases de apuntes reales:** en un requisito no cuentan las formas que también son sustantivo, preposición o nombre propio ("Copia de la resolución DIAN en PDF", "Marca y modelo", "Cierre de caja hecho", "Entre 10 y 15 minutos", "Active Directory", "Despliegue aprobado"), aunque dentro de una tarea sí; se reconoce el verbo con el pronombre pegado ("ábrelo", "guárdalo", "cambiarla"); y un conector que la puntuación dejó suelto ("Abre FrontRest. Luego, entra…") no se pega a ninguna acción.
- **`dividirTarea(bloques, tareaId, acciones, crearTarea)`** en `bloquesEditor.ts` (con pruebas): la tarea original conserva id, tipo, dato protegido, apoyos y lo ya marcado, con el texto de la primera acción; las demás nacen detrás de su grupo. Los apoyos no se reparten (adivinar a qué acción pertenece una captura sería inventar).
- **En la interfaz:** `ArticuloForm` calcula `revisarGuia` y pasa los conteos a `senalesDeArticulo` (tres señales que solo existen cuando hay algo que corregir) y pinta, bajo "Requisitos" (hasta el 2026-09-22, "Antes de empezar"), cada requisito que es una acción con el paso donde ya está. En `PasosEditor`, `DivisionSugerida` (bajo el texto de una tarea que no es Verificación ni Decisión) enseña la lista numerada y "Dividir en N tareas"; el bloque Aviso en Precaución o Importante que empieza como recordatorio enseña "Pasar a Información". Botones de 44 px.
- **Pruebas de flujo:** `revisionEditor.test.tsx` monta el editor real (pista del requisito con su paso, dividir con las palabras del autor, pasar la alerta a Información).

### 3.8o `soluciones/borradorArticulo.ts` y el plegado de `PasosEditor`
- **Propósito:** que una interrupción no se lleve el trabajo del editor (tarea 219, hallazgo **G-29**, uno de los cinco críticos), y que una guía de siete pasos quepa en la pantalla (**G-28**).
- **`borradorArticulo.ts`** (lógica pura + acceso a la tabla, con pruebas): `datosVacios`, `normalizarDatosBorrador` (tolera una fila vieja, incompleta o con el tipo cambiado), `datosDesdeArticulo` (el formulario tal como quedaría al abrir un artículo ya guardado), `borradorDifiere`, `borradorTieneContenido`, `leerBorrador`, `guardarBorrador`, `borrarBorrador` y `limpiarBorradoresViejos`.
- **Es una RED, no el guardado.** Tabla local `borradoresArticulo`, no sincronizada; `guardarRegistro` sigue siendo quien escribe en `articulos`. El porqué, en [DECISIONES.md](DECISIONES.md) **AD-035**.
- **Guarda los campos como los tiene el FORMULARIO**, no como los guarda `articulos`: los requisitos son el texto crudo del textarea, no el array ya partido por líneas. Restaurar tiene que devolver hasta una línea a medio teclear.
- **El borrador existe exactamente mientras hay trabajo sin guardar:** el efecto compara contra lo guardado y escribe o borra la fila. Así, al abrir, "hay borrador" ya significa "hay algo que recuperar".
- **`EstadoBorrador`** (dentro de `ArticuloForm`) ocupa el `trailing` de la cabecera compacta, en el sitio que dejó la pastilla de estado del artículo, y dice algo más útil: no en qué estado está el documento (eso se elige en Publicación) sino si lo que se acaba de escribir está a salvo. Tres estados: "Guardado", "Borrador a salvo" y "Guardando..." (dura menos de un segundo; existe para que el hueco no parpadee).
- **Plegado de `PasosEditor`:** solo el paso activo se despliega; los demás quedan en una línea de 56 px con asa, número, título y conteo de tareas. El cuerpo **no se oculta con CSS: no se monta**. Medido en navegador sobre siete pasos: de unos 2.800 px a 745.
- **El asa lleva `data-asa` y el `onPointerDownCapture` de la tarjeta se la salta**, porque agarrarla no debe desplegar: `iniciarArrastre` ya midió las tarjetas con la altura que tenían. Ver **AD-036**.

### 3.8h `soluciones/HojaPasos` y `soluciones/estadoPasos.ts`
- **Propósito:** índice de los pasos del procedimiento en ejecución (tarea 210, tablero `6c`). Hoja inferior con los pasos en filas de 60 px que llevan directo a cualquiera de ellos. Cierra el hueco de que no había forma de **saltar al paso N**: el asistente solo ofrecía "Atrás", de uno en uno. **Desde la tarea 218 se abre también desde Foco**, algo que antes no existía: el índice era inalcanzable sin salir primero a la vista completa (hallazgo G-14).
- **Props:** `{ abierto, onCerrar, resumenes: ResumenPaso[], subtitulo, tituloGuia?, onIrAPaso, modoEjecucion, onCambiarModo, verificacionFinal?, rutaDetalles?, estadoDetalles?, onEmpezarDeNuevo? }`.
- **Es la ruta completa (2026-09-22, tarea 255):** el título dice "La ruta: N pasos" y las insignias usan el lenguaje de la guía: hecho en verde con la marca, el actual en el azul de la acción (con la pastilla "aquí"), saltado neutro con borde discontinuo y la pastilla "cuidado" en rojo. Lo abre también "Ver la ruta completa" de `RutaProcedimiento` en el teléfono.
- **"Al terminar se comprueba"** lista las comprobaciones finales sin casilla. La nota que había debajo ("Se leen aquí en cualquier momento. Marcarlas como cumplidas es otra cosa...") se retiró en la segunda pasada del 2026-09-17: el título ya dice cuándo y la falta de casilla, que aquí no se marcan.
- **Lo que salió de la pantalla de la guía (2026-09-17, tarea 244):** al pie, **"Detalles de la guía"** (enlace a `/detalles`, con el origen para volver a la ejecución) y **"Empezar de nuevo"** (solo si hay avance que borrar), uno debajo del otro para que no se recorten en 360 px. El cambio de vista dice ahora "Volver a una acción a la vez".
- **`estadoPasos.ts`** (lógica pura, con pruebas): `resumirPasos(pasos, hechos, instruccionesHechas, indiceActual)` devuelve un `ResumenPaso` por paso (`{ id, indice, titulo, estado, tareas, tareasHechas, tieneCuidado }`), más `minutosRestantes`, `resumenDeAvance` y `tituloDePaso`.
- **Los cuatro estados:** `hecho`, `actual`, `saltado`, `pendiente`. **`saltado` NO se guarda**: es un paso sin hacer que quedó POR DETRÁS del que se ejecuta. Guardarlo obligaría a migrar Dexie y `supabase/schema.sql` para un dato que se deduce sin error. `hecho` manda sobre todo lo demás (volver a un paso completo no lo descompleta), y sin paso actual (procedimiento terminado) nada es "saltado": lo que falte está pendiente.
- **`tieneCuidado`** marca solo los avisos de **precaución** e **importante**: información, consejo y dato técnico no advierten de nada, así que no ensucian la fila.
- **Dos canales, forma y color** (regla R16): hecho con check, actual y pendientes con su número, saltado con el número en un círculo de borde discontinuo.
- **El cambio entre Foco y el paso entero vive aquí desde la tarea 218**, con un control de 44 px al pie ("Ver el paso entero" o "Volver a una tarea a la vez", según `modoEjecucion`). Antes cada vista tenía su propio control (el botón "Foco" del pie de la vista completa, "Ver el paso entero" dentro de `ModoFoco`); al reducir la cabecera de ejecución a una línea de 44 px ninguna de las dos tenía ya sitio para el suyo, y el índice —ya el sitio donde se piensa en pasos— es el natural.
- **Dónde:** `AsistenteVista` en nivel 0, compartido por Foco y la vista completa (`indiceUI`). Usa `Modal` internamente.

### `app/Chasis` y `components/BarraTarea`: cabecera compacta de 44 px (tarea 218)
- **Qué cambia:** `Chasis` (modo `'tarea'`) y `BarraTarea` ganan una prop `compacta?: boolean`. Con ella, la cabecera de nivel tarea deja de ser el bloque de 68 px con rótulo ("Editando"/"Ejecutando"), título y ruta de vuelta en tres líneas, y pasa a una **sola línea de 44 px**: la X, el título truncado y `trailing` en la MISMA fila.
- **`trailing` frente a `children`** (precisado en la tarea 219): `trailing` es lo que va EN la línea de 44 px, junto al título, y `children` sigue siendo el bloque de DEBAJO. Se separaron porque las pestañas del editor no caben en la misma fila que el título: en la tarea 218, con un solo hueco, todo iba junto. La ranura de `BandaTarea` se monta dentro de `trailing` cuando la cabecera es compacta (ahí es donde el contador de paso de la ejecución tiene que estar) y como bloque debajo cuando no lo es.
- **Quién usa `trailing` hoy:** el contador que abre el índice de pasos en la ejecución (tarea 218) y el estado del borrador en el editor (tarea 219). Los dos son lo mismo conceptualmente: lo que cambia con el trabajo y tiene que estar siempre a la vista.
- **Alcance deliberadamente acotado:** el prop es opt-in y por defecto `false`, así que los otros 12 usos de `Chasis modo="tarea"` (los editores de dispositivo, credencial, persona, ubicación y diagnóstico, y las pantallas de reemplazo/baja/importación/migración) **no cambian**. Lo activan hoy `AsistentePage` (tarea 218) y `ArticuloForm` (tarea 219).
- **Por qué:** hallazgos **G-09** (262 px de cromo sobre 640, el mismo defecto que la barra de reanudar ya midió y corrigió en M-033) y **G-10** (la barra repetía en tres líneas lo que el técnico acaba de decidir cuatro segundos antes: útil al volver de una interrupción, caro los otros 40 minutos).
- **Dónde:** `src/app/Chasis.tsx` (interfaz `PropsTarea`) y `src/components/BarraTarea.tsx` (rama `if (compacta)`).

### 3.8j `soluciones/HojaVinculo`
- **Propósito:** hoja inferior con buscador que elige un vínculo del paso (tarea 212, hallazgo del tablero 6b). Sustituye a los cuatro `<select>` nativos del editor de pasos: información protegida, procedimiento relacionado, solución si el paso falla, y el "Si responde No" de una tarea de decisión.
- **Props:** `{ abierto, onCerrar, titulo, placeholderBuscar, grupos: GrupoVinculo[], onElegir }`.
- **`GrupoVinculo`:** `{ etiqueta?, opciones: { id, titulo }[] }`. Sin `etiqueta`: lista plana, sin encabezado (los tres selects de guías). Con `etiqueta`: agrupa con un rótulo, como el `<optgroup>` que reemplaza (información protegida: "Datos protegidos del equipo" / "Secretos de la bóveda"). El id de una opción puede codificar más de un dato (`"tipo:id"`), decodificado por quien llama `onElegir`.
- **Buscador siempre visible**, filtra sin distinguir mayúsculas ni tildes (`normalizarTexto`, ya usado por el buscador global). Se limpia solo al reabrir. Sin coincidencias: "Ninguna coincidencia para «...»".
- **Qué cierra:** en el teléfono un `<select>` largo abre la rueda del sistema, no se puede buscar dentro y el título se corta. Con la biblioteca de guías creciendo, la lista de vinculables ya no cabe en una rueda.
- **Dónde:** `PasosEditor` (`VinculoDelPaso`, `VinculoProtegidoDelPaso`, y el vínculo "Si responde No" dentro de `BloqueEditor`). Usa `Modal` internamente.

### 3.8e `soluciones/HojaTipoBloque`
- **Propósito:** hoja inferior que ELIGE el tipo de una línea de un paso: la clasificación de una tarea (acción / verificación / decisión) o el tono de un aviso (información / cuidado / alerta / consejo / dato). Tarea 209, tablero `6b` del handoff "Diseño móvil".
- **Props:** `{ abierto, onCerrar, titulo, opciones: OpcionTipoBloque<T>[], seleccionado: T, onElegir }`. Genérico sobre `T extends string`.
- **`OpcionTipoBloque<T>`:** `{ valor, etiqueta, descripcion, Icono, claseIcono }`. La `descripcion` es obligatoria a propósito: la hoja existe para decir qué significa cada valor.
- **Diferencia con `HojaFiltro`:** aquella filtra una lista (rejilla de 2 columnas, opción con conteo, se puede limpiar); esta clasifica un dato (columna de filas de 64 px, cada una con su explicación, siempre hay un valor elegido).
- **Qué cierra:** los dos selectores se cambiaban CICLANDO A CIEGAS (`CICLO_TIPO_TAREA` y `tonoSiguiente`, ambos eliminados): cada toque de un icono de 18 px avanzaba al siguiente valor sin decir cuál venía, así que pasarse costaba dos toques más, y en los avisos cuatro.
- **Dónde:** `PasosEditor` (`BloqueEditor`, para tarea y para aviso). Usa `Modal` internamente.

### 3.8f `soluciones/DialogoProbarPaso`
- **Propósito:** confirmación de "Probar" en el editor de pasos (tarea 209). Dice qué paso se va a ver y que no se sale del editor ni se guarda nada, antes de que la vista previa tape la pantalla completa.
- **Props:** `{ abierto, numeroPaso, onCerrar, onVerComoTecnico }`.
- **Por qué el paso intermedio:** la vista previa es una capa a pantalla completa y el editor tiene cambios sin guardar; que todo desaparezca de golpe se lee como "se perdió el trabajo".
- **Dónde:** `ArticuloForm`, solo dentro de la pestaña Pasos y con al menos un paso escrito. Fuera de ahí el botón sigue siendo "Vista previa" y abre el artículo entero.

### 3.8g `soluciones/AccionesPaso` (`ranuraAccionesPaso.tsx`)
- **Propósito:** ranura para la barra de "añadir" del editor de pasos (tarea 209). Mismo patrón y mismo motivo que `BandaTarea` (2.10n): los cuatro botones tienen que vivir en la barra fija del pie, que monta `ArticuloForm`, pero saben del paso activo y de cómo se crea un bloque, que es cosa de `PasosEditor`.
- **Props:** `{ children }`. Fuera de la barra no dibuja nada (no falla).
- **Cómo:** `ArticuloForm` publica un `<div ref={setRanuraAcciones} className="empty:hidden" />` dentro de su barra fija y lo expone con `ProveedorAccionesPaso`; `PasosEditor` lo llena con `createPortal`. El hueco va en estado (no en una ref) para que los hijos vuelvan a renderizar cuando exista. Resultado: **una sola barra fija**, sin calcular ningún `bottom` contra el alto de la otra (que además cambia con las sugerencias de completitud abiertas).
- **Dónde:** `ArticuloForm` (provee) y `PasosEditor` (consume).

### 3.8l `soluciones/HojaFalla` y `soluciones/salidasFalla.ts`
- **Propósito:** la hoja **"Algo va mal en el paso N"** (tarea 215, tablero `3d`): las salidas reales cuando la realidad no coincide con la guía. Cierra el defecto más grave de la pantalla de ejecución: la válvula de escape era el control **más pequeño** (28 px con texto de 12) y solo aparecía **cuando ya estaban marcadas todas las tareas del paso**. Si el paso fallaba no se podían marcar, así que la salida no llegaba a mostrarse nunca.
- **Props:** `{ abierto, onCerrar, numeroPaso, pasosHechos, tarea, solucionArticuloId, solucionArticuloTitulo, onAbrirContingencia, onFotografiar, onSaltar }`.
- **Las cuatro salidas**, de 56 a 60 px: abrir la contingencia vinculada (con su título y su número de pasos), fotografiar y anotar el problema, saltar el paso y seguir, cancelar.
- **Color (2026-09-22, tarea 255):** el título y la salida a la contingencia van en rojo (`tono: 'riesgo' | 'neutro'` de `Salida`; antes `'precaucion'`, ámbar), como "Marcaste una falla": es el flujo de algo que salió mal. La contingencia que ya no existe se dice en un panel neutro.
- **Dos salidas pueden faltar, y faltan a propósito.** `onFotografiar` llega `null` cuando el procedimiento no tiene equipo afectado: sin equipo no hay historial donde registrar la foto. `onSaltar` llega `null` cuando no hay a dónde saltar (ver `destinoAlSaltar`). Un botón que no lleva a ninguna parte estorba más de lo que ayuda.
- **Sin vínculo de contingencia lo dice** ("Este paso no tiene una guía de contingencia vinculada") en vez de callarlo: así el técnico deja de buscarla.
- **La promesa va arriba, antes de elegir:** "Los 4 pasos que llevas hechos no se pierden". El técnico está de pie frente al equipo con el procedimiento a medias, y la duda de "¿pierdo lo que llevo?" es lo que le hace no tocar el botón.
- **`salidasFalla.ts`** (lógica pura, con 8 pruebas): `destinoAlSaltar(indiceActual, idsPasos, hechos)` y `fraseAvanceConservado(pasosHechos)`. Saltar es **avanzar sin marcar**, así que el destino es el siguiente en orden, esté hecho o no; devuelve `null` en el último paso pendiente, porque saltarlo dejaría el procedimiento sin nada por delante y la pantalla de cierre diría "completado" sobre un paso que falló.
- **Dónde:** `AsistenteVista`, en los dos caminos (vista completa y modo foco), en todos los niveles. Usa `Modal` internamente.

### 3.8k `soluciones/capacidadGuia.ts`
- **Propósito:** qué puede hacer una guía POR TI, para decirlo en su fila del listado (tarea 214, tablero `3b`). `capacidadDeGuia(articulo)` devuelve `{ ejecutable, pasos, minutos, tieneVerificacion }`; `lineaDeCapacidad(capacidad)` la redacta en trozos (`{ pasos, minutos, verificacion, aviso }`).
- **Por qué no reutiliza `completitudArticulo.ts`:** son dos preguntas distintas, no dos vistas de la misma. El editor mide "cuánto te falta para publicarla" (diez señales, porcentaje, sugerencias); esto responde "¿me sirve ahora mismo?", que es lo que se pregunta en el listado.
- **Trozos y no una cadena** porque el aviso de la guía no ejecutable se pinta en otro color que el resto: la fila necesita saber cuál es cuál.
- **Lógica pura, con 9 pruebas.** Cubre el caso K1 (un `procedimiento` que existe solo por su metadata y no tiene ni un paso **no** es ejecutable), que sin tiempo estimado no se inventa uno, y que lo no ejecutable no promete tiempo ni verificación aunque el dato esté en la base.
- **Dónde:** `FilaArticulo`.

### 3.8d `inicio/BienvenidaPrimerDia`
- **Propósito:** la primera impresión de la app para un técnico nuevo (tarea 184, mockup `3b`). Con la base vacía, seis de los nueve bloques de Inicio no se pintan, así que la entrada eran un buscador y tres atajos; y lo que de verdad hay que hacer el primer día (instalar la app y bajar los adjuntos, de lo que depende el trabajo sin señal) no se ofrecía en ninguna pantalla.
- **Props:** `{ nombre?: string | null, hayBloquesReales: boolean }`. Del nombre usa solo el de pila ("Bienvenido, Andrés Vélez" se come la línea entera en 448 px).
- **Contenido:** tres pasos que se apagan solos (entraste · instala la app · descarga para offline), con `BotonInstalarApp` en el segundo y el botón "Descargar" en el tercero, que comparte estado con `DescargarOffline` (misma función, así que el progreso se ve en los dos sitios).
- **Se retira sola**, sin botón de cerrar: cuando los tres pasos están hechos o cuando `hayBloquesReales` (recientes, pendientes o un procedimiento a medias). Cerrar a mano habría exigido guardar la decisión en alguna parte; el bloque desaparece porque deja de ser cierto.
- **Reparto:** la regla vive aparte y probada en `inicio/bienvenida.ts` (`pasosBienvenida`, `debeMostrarBienvenida`); el componente solo lee el estado real del dispositivo (`instalacionPwa.ts`, `adjuntosOffline.ts`) y pinta. La marca de cada paso usa dos canales, forma y color (regla R16): check verde si está hecho, número si falta, en acento solo el primero que falta.
- **Dónde:** `InicioPage`, primer bloque del modo sin búsqueda.

### 3.8c `busqueda/BuscadorGlobal` y `busqueda/ResultadosBusqueda`
- **Propósito:** el buscador global en capa (tarea 181, mockup `3d`). Hasta ahora buscar era global pero vivía **dentro** de Inicio: desde cualquier otra pestaña había que volver a Inicio y perder el sitio donde se estaba. Ahora la lupa vive en `BarraSuperior` y abre esta capa a pantalla completa sin abandonar la pantalla actual.
- **Props:** `BuscadorGlobal` recibe `{ abierto, onCerrar, onNavegar?, modo?: 'normal' | 'consulta', consultaInicial? }` (los tres últimos desde el 2026-09-16: `onNavegar` distingue "se fue a un resultado" de "la dio por terminada", `modo` elige las reglas de `busqueda/modoConsulta.ts` y `consultaInicial` repone la búsqueda al volver de una ficha); `ResultadosBusqueda`, `{ resultados, consulta, consultaCruda, onNavegar?, onDesbloqueada?, huboDesbloqueo?, modo?, enCapa? }` (desde la tarea 241 recibe la **lista plana** que devuelve `buscar` y decide él mismo qué sube a "Mejores resultados" y qué queda en los grupos; `enCapa` dice dónde reponer la búsqueda al volver); `FilaResultado`, `{ resultado, consulta, conTipo?, conAcciones?, desdeMejores? }`. En modo normal la fila es un enlace a su ficha; en modo consulta es un botón que despliega su vista rápida (`aria-expanded`) o, si no tiene, una referencia sin control.
- **Alcance declarado:** la capa dice por escrito qué abarca ("Busca en todo a la vez: Guías, Equipos, Bóveda, Ubicaciones y Personas"). Era la otra mitad del problema que detectó la auditoría: cinco buscadores con la misma forma y cinco alcances distintos, sin nada que los distinguiera.
- **Detalles:** portal a `document.body` por el mismo motivo que `Modal` (la barra desde la que se invoca lleva `backdrop-blur`, que crea bloque contenedor y rompería `fixed inset-0`); cierra con Escape, con la X o al elegir un resultado; enfoca el campo al abrir; la consulta **no** sobrevive al cierre.
- **Reparto:** el catálogo y los helpers sin JSX (`VISUAL_POR_TIPO`, `GRUPOS_BUSQUEDA`, `partirTitulo`, `agruparResultados`) viven en `busqueda/resultados.ts`; el ranking global y la intención, en `busqueda/mejores.ts`; la regla del puente, en `busqueda/reglasPuenteBoveda.ts`; la presentación, en `busqueda/ResultadosBusqueda.tsx`. Están separados para no mezclar componentes y constantes en un mismo archivo (lo avisa `oxlint` por fast-refresh) y para poder probar las reglas sin navegador.
- **Piezas nuevas (tarea 241):**
  - **`busqueda/AccionesResultado.tsx`**: la acción directa de cada tipo de resultado (`AccionesDeResultado`). Guía y diagnóstico navegan; credencial, comando y atajo **copian sin navegar**. La de guía sale de `accionDeGuia`; la de credencial, de `copiarCampoCredencial`. Devuelve `null` en los tipos cuya acción ES abrir la ficha.
  - **`busqueda/PuenteBoveda.tsx`**: la fila "Buscar «X» en Bóveda" con desbloqueo **en línea** (delega en `desbloquear()`, no recrea criptografía). Se auto-oculta sin permiso, con la bóveda abierta o sin consulta.
  - **`busqueda/contextoResultados.ts`**: lo que toda fila necesita y ninguna debe recalcular: el mapa de acciones de guía (dos consultas vivas, una sola vez), la consulta, el cierre de la capa y el punto de medición.
- **Piezas nuevas (2026-09-16):**
  - **`busqueda/PanelVistaRapida.tsx`**: el marco de una vista rápida, desplegado debajo de su resultado con la sangría de las zonas anidadas (`ZONA_ANIDADA`). Props `{ idPanel, titulo, onCerrar, fichaCompleta?, children }`. Recibe el foco al abrirse (tabIndex -1, como los titulares de `ModoFoco`) y trae `Cerrar` (y `Abrir ficha` solo fuera de una tarea).
  - **`busqueda/VistaRapida.tsx`** (`VistaRapidaResultado`): elige la vista de cada tipo según `vistaRapidaDe`. Un comando o un atajo reutilizan `referencia/TarjetaComando`; un término o una herramienta, `referencia/ContenidoReferencia`; un equipo, filas `FilaDato` con su `PastillaEstadoDispositivo`.
  - **`busqueda/VistaRapidaCredencial.tsx`**: la vista de un acceso. Descifra con `descifrarCredencial`, enseña `camposVistaRapida`, copia con `copiarCampoCredencial` y audita con `registrarAccesoBoveda` (consultó al abrir, mostró al destapar), las mismas reglas que la ficha. Todo secreto arranca tapado; mostrado, entero (`whitespace-pre-wrap break-all`, sin `truncate`). Sin bóveda abierta o sin permiso, no pinta nada.
  - **`busqueda/modoConsulta.ts`**: las reglas puras del modo consulta (`vistaRapidaDe`, `filaNavega`, `ofreceAccionDirecta`).
  - **`busqueda/clasesAcciones.ts`**: las clases de los botones de acción (primaria y secundaria, 44 px) y la duración del "Copiado", compartidas por la fila y la vista rápida.
  - **`busqueda/busquedaEnHistorial.ts`**: `useAnotarBusqueda` y `useBusquedaRestaurada` (ver 2.4b).
  - `PuenteBoveda` gana `prominencia` (`'destacado'` o `'secundario'`, que decide `prominenciaPuenteBoveda`) y `modo` (en consulta no enlaza a la Bóveda).
- **Dónde:** `BarraSuperior` monta la capa (carga diferida con `lazy`), y desde la tarea 241 también `Chasis` en modo tarea con `conBusqueda` (en modo consulta desde el 2026-09-16); `CapaAtajos` la abre con "/" (en consulta sobre una tarea) y la repone abierta al volver de una ficha; `InicioPage` reutiliza `ResultadosBusqueda` para su buscador en línea, que conserva porque esa pantalla **es** el buscador.

### 3.8m `red/NodoRed`, `red/useNodoRed.ts`, `red/nodoDeRed.ts` y `red/grupoUbicacion.ts`
- **Propósito:** la vecindad de un nodo de la topología ("Depende de", "Si este equipo falla", "Dependen de este equipo") y las reglas que la rodean (tarea 204, hallazgos M-018 y M-019).
- **`NodoRed`** estaba dentro de `TopologiaEquipoPage`. Sale de ahí porque la pestaña **Red pasó a abrir con esta misma pantalla**: la auditoría lo llama "el hallazgo que ahorra trabajo", la pantalla que Red necesitaba ya estaba construida y solo estaba a tres toques. Copiarla habría dejado dos versiones condenadas a divergir (el mismo error que cerró `FilaArticulo`).
- **Props:** `{ dependeDe, chipsImpacto, totalDependientes, arbol, nombreCategoria, enlaceANodo }`. Lo único que cambia entre las dos pantallas es **a dónde lleva tocar un equipo**, y por eso es una prop: en la topología de un equipo abre su ficha (con origen, regla M-R2); en la pestaña Red **sustituye el nodo en su sitio** y el recorrido sigue.
- **`useNodoRed.ts`** parte los datos en dos: `useRedCargada()` lee las tablas y arma el bosque, y `useNodoRed(id, red)` calcula lo de UN nodo. El corte no es estético: la pestaña Red necesita el bosque **antes** de saber qué nodo abrir, mientras que la topología de un equipo ya trae su id en la ruta.
- **`nodoDeRed.ts`** (lógica pura, 9 pruebas): `nodoInicial(pedido, bosque)` respeta el nodo que se estaba recorriendo solo si sigue existiendo (un enlace guardado a un equipo borrado no puede dejar la pestaña en blanco), y si no cae a `raizPrincipal`, la raíz con **más equipos colgando**. `contiene` recorre el bosque de forma iterativa, para que un ciclo mal registrado no reviente la pila.
- **`grupoUbicacion.ts`** (lógica pura, 11 pruebas): `agruparPorUbicacion(dispositivos, nombreUbicacion)` agrupa por `ubicacionId` y deja el texto de respaldo. Sin id agrupa por el texto normalizado (sin acentos, mayúsculas ni espacios de más) y el grupo toma la **grafía más repetida**; el desempate es una comparación estricta, no `compararNatural`, que ignora acentos y mayúsculas a propósito y por tanto no desempata nada.
- **Dónde:** `RedPage`, `TopologiaEquipoPage` (`NodoRed`, `useNodoRed`) y `EquiposRedPage` (`grupoUbicacion`).

### 3.8n `soluciones/FilaVinculo` y `soluciones/vinculoAnidado.ts`
- **Propósito (tarea 206, hallazgo M-012, regla M-R11, tableros `3b` y `12b`):** dar **una sola forma** a todo lo que cuelga de un paso. Antes cada vínculo traía su propia tarjeta con marco de color (acento el subprocedimiento y la credencial, ámbar la contingencia y la pregunta de error), así que el color acababa marcando el tipo de vínculo y la profundidad en vez del significado, y la advertencia real quedaba enterrada entre marcos de su mismo tono.
- **`FilaVinculo`** (despliega aquí mismo): `{ Icono, kicker?, titulo, nota?, extra?, abierto, onAlternar, accion?, ariaLabel? }`. Fila de 44 px, icono neutro de 16, sin fondo ni borde; caret de estado, o la palabra de `accion` ("Mostrar" / "Ocultar") cuando la hay. `extra` es el anillo de `IndicadorAvance`.
- **`EnlaceVinculo`** (sale de la pantalla, regla **R58**): misma fila con icono de salida y la nota `PROMESA_REGRESO`, "Se abre aparte, vuelves aquí al terminar". Antes la tarjeta enlazada y la desplegable eran idénticas, así que tocar una salía de la guía y tocar la otra no.
- **`AccionVinculo`** (ejecuta en el sitio): la foto de evidencia. Ni caret ni flecha, solo la palabra de la acción.
- **`vinculoAnidado.ts`** (lógica pura, 9 pruebas): `ZONA_ANIDADA` (la sangría de 13 px tras la línea vertical neutra de 2 px, el patrón de una cita), `modoVinculo(nivel, procedimiento)` (`'expandible' | 'enlazado'`, la regla de un solo nivel que corta los ciclos A → B → A, antes copiada en cuatro sitios), `PROMESA_REGRESO` y `fraseAvanceDocumento(hechos, total, 'guía' | 'contingencia')`, que nombra a qué documento pertenece el avance (regla **R57**).
- **Dónde:** `ProcedimientoVista` (`SubProcedimientoEnPaso`, `ContingenciaEnPaso`, `DecisionEnTarea`), `AsistenteVista` (`SubProcedimientoEnAsistente`, `SolucionEnAsistente`, `EvidenciaPaso`) y `CredencialEnPaso`.

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

- **CAND-1, CERRADO del todo el 2026-09-02 (tarea 207, hallazgo M-017):** las seis copias y la variante `pillEstado` migraron a `PastillaEstadoDispositivo`. Lo que sigue es el registro de cómo estaba. ~~**PARCIALMENTE CERRADO el 2026-07-27:**~~ "punto de estado + etiqueta" copiado en `FilaDispositivo`, `CategoriaPage`, `TopologiaPage`, `TopologiaEquipoPage` (dos veces), más una variante paralela `pillEstado` en `DispositivoPage` que mantiene a mano el mismo dominio de estados. El componente que pedía ya existe: `PastillaEstado` (sección 2.10d), hoy usado por `FilaArticulo` para borrador/obsoleto. **Falta** migrar a él el estado de EQUIPO en las cinco copias de arriba; se hace al rediseñar P4 (ficha de categoría), donde la auditoría ya lo pide (decisión P4-8).
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
