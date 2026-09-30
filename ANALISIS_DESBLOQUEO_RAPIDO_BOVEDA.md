# Análisis: desbloqueo rápido de la Bóveda (tarea 279)

**Fecha:** 2026-09-30. **Estado:** análisis terminado; espera la decisión del usuario.
**Resultado:** **D**, la seguridad dependería demasiado del PIN del dispositivo (con parte de **C**: la compatibilidad real en los dispositivos del equipo no está confirmada).
**Recomendación:** no implementar todavía. La Bóveda sigue abriéndose solo con la contraseña maestra.
**Qué se tocó:** nada de la Bóveda (ni `sesionBoveda.ts`, ni `crypto.ts`, ni formatos, ni `boveda_meta`, ni datos). Solo este documento y un experimento aislado, `scripts/experimento-prf.mjs`, que no está conectado a la Bóveda.

Cinco cosas distintas que no se deben confundir:

| Concepto | Qué es | Secreto |
|---|---|---|
| Entrada del PRF | Bytes que la app le pasa al autenticador para evaluar el PRF | No |
| Salida del PRF | 32 bytes que devuelve el autenticador; material de clave | **Sí** |
| Salt de PBKDF2 | 16 bytes de cada bloque cifrado de la Bóveda (`crypto.ts`) | No |
| IV de AES-GCM | 12 bytes aleatorios por cifrado | No |
| Desafío de WebAuthn | Bytes aleatorios que firma el autenticador (tarea 278) | No |

---

## 1. Arquitectura actual de la Bóveda

### 1.1 El flujo

```
contraseña maestra (escrita en el formulario de desbloqueo)
  -> PBKDF2-SHA256, 600.000 iteraciones, con el salt de 16 bytes del bloque
  -> CryptoKey AES-GCM de 256 bits, extractable: false, usos encrypt y decrypt
  -> descifra el verificador de boveda_meta (el texto fijo "soluciones-it:boveda"): si abre, la contraseña es la correcta
  -> AES-GCM (IV aleatorio de 12 bytes por bloque, etiqueta de 16 bytes)
  -> credenciales (datosCifrados), campos protegidos (valorCifrado) y archivos seguros (bucket archivos_boveda)
```

Código: `src/lib/crypto.ts` (`derivarClave`, `cifrarTexto`, `descifrarTexto`, formato de texto `v1.<iteraciones>.<salt>.<iv>.<datos>` y binario `[versión][iteraciones][salt][iv][cifrado+etiqueta]`) y `src/features/boveda/sesionBoveda.ts` (`desbloquear`, `derivarClavesDeBloques`, `bloquear`, `cifrarCredencial`, `cifrarValor`, `cifrarArchivo` y sus pares de descifrado). Se desbloquea desde cinco puntos, todos con `desbloquear()`: `BovedaGuard`, `CredencialEnPaso`, `SeguridadDelEquipo`, `PuenteBoveda` (vista rápida del buscador) y `CrearAccesoRapido`.

### 1.2 Dónde vive cada cosa

| Pieza | Dónde | Cuánto tiempo | Extraíble |
|---|---|---|---|
| Contraseña maestra | Estado del formulario (React) y argumento de `desbloquear()` | Lo que dura la derivación y hasta que el recolector libera la cadena (JavaScript no permite borrarla). Nunca en disco ni en el servidor | No aplica |
| Clave principal (salt del verificador) | Memoria del módulo `sesionBoveda.ts` (`principal`) | Hasta `bloquear()`: autobloqueo por inactividad (1, 5, 15 o 30 min, ajuste en `localStorage`), bloqueo manual o recarga | **No** |
| Claves de otros salts | `clavesPorSal` (Map salt -> CryptoKey), en memoria | Igual | **No** |
| Verificador | `boveda_meta` en Supabase (una fila; la lee cualquier autenticado; solo INSERT con permiso; sin UPDATE ni DELETE) y copia local `bovedaMeta` (Dexie) | Permanente | Es un bloque cifrado |
| Bloques cifrados | `credenciales` y `campos_protegidos` (Supabase e IndexedDB), `archivos_boveda` (Storage), copias en `historial` | Permanente | No aplica |

### 1.3 Varios salts

Normalmente toda la Bóveda comparte el salt del verificador: cifrar siempre usa la clave principal. Otros salts vienen de credenciales anteriores al verificador o creadas en dos teléfonos sin conexión. Al desbloquear se deriva una clave por cada salt distinto de las credenciales locales (una PBKDF2 de 600.000 iteraciones por salt) y se conservan las que abren; un bloque de otra contraseña queda ilegible sin impedir el desbloqueo.

### 1.4 Segundo dispositivo y sin conexión

- **Segundo dispositivo:** baja el verificador del servidor y, con la maestra, deriva la misma clave (mismo salt).
- **Sin conexión:** con el verificador local, abrir no necesita red. Sin nada local y sin respuesta del servidor, no deja crear una maestra nueva.

### 1.5 Cambio de la maestra

No existe en la app. Restablecerla es empezar la Bóveda de cero desde el panel de Supabase (`supabase/INSTRUCCIONES.md` § 5): se borran el verificador y las credenciales, y lo cifrado con la anterior queda ilegible. **Hallazgo de esta revisión:** ese procedimiento no menciona `campos_protegidos` ni `archivos_boveda`, que también quedarían ilegibles (registrado como tarea 286).

### 1.6 La maestra es del equipo

AD-007: una sola maestra para todo el equipo, que además autoriza las eliminaciones sensibles (`verificarContrasenaMaestra`, sin abrir la sesión). La RLS `puede_ver_boveda()` es la única barrera entre un técnico sin permiso y los bloques; el cifrado protege contra quien se lleva una copia de los datos.

### 1.7 Pruebas existentes

`src/features/boveda/sesionBoveda.test.ts`: 33 pruebas (verificador, primera vez, migración sin verificador, sesión y bloqueo, campos protegidos, archivos, comprobación puntual y estado inicial).

## 2. Modelo de amenaza actual

Hoy, para abrir la Bóveda en un teléfono hacen falta **dos cosas independientes**: acceso a la app en ese teléfono (sesión y, si está puesto, el bloqueo de la app, que desde la 278 puede ser el desbloqueo del dispositivo) **y la contraseña maestra**.

- **Protege de:** quien copia IndexedDB, `localStorage`, la caché, los archivos del navegador, la base de Supabase o Storage: solo encuentra bloques cifrados. Le queda atacar el verificador fuera de línea, con PBKDF2 de 600.000 iteraciones, así que su éxito depende de la fuerza de la maestra (no hay límite de intentos fuera de línea).
- **No protege de:** quien conoce la maestra (todo el equipo, por diseño) ni de código malicioso dentro del origen con la Bóveda abierta (usa las claves como oráculo mientras dura la sesión).

## 3. Objetivo

Abrir la sesión de la Bóveda sin escribir la maestra cada vez, **sin perder**:

> Copiar los datos locales del navegador no basta para abrir la Bóveda.

y sin quedar más débil que hoy frente a las amenazas de la sección 9. La protección adicional tendría que depender de verdad del autenticador del dispositivo.

## 4. Cómo funciona PRF

La extensión `prf` (WebAuthn nivel 3, § 10.1.4) permite evaluar una función pseudoaleatoria asociada a una credencial:

- Entrada de cualquier largo, salida de **32 bytes**. El navegador no pasa la entrada tal cual: calcula `SHA-256("WebAuthn PRF" || 0x00 || entrada)`, así que la web no puede evaluar el PRF sobre entradas arbitrarias ni tocar los usos propios de la plataforma.
- Se construye sobre `hmac-secret` de CTAP2 (o un mecanismo equivalente del autenticador). `hmac-secret` tiene **dos** PRF por credencial, con y sin verificación del usuario; WebAuthn expone solo la de **con verificación**, "y eso se impone sobre `userVerification` si hace falta".
- Al **crear** la credencial, la salida puede venir o no ("no todos los autenticadores la evalúan al crear"): si no viene, hace falta una aserción.
- Admite dos entradas en una misma aserción (`first` y `second`) para rotar, y `evalByCredential` para varias credenciales.

**Qué aporta:** un secreto que solo el autenticador puede recalcular, y solo tras verificar a la persona. Con él se puede derivar una clave simétrica (HKDF) y envolver otra clave: copiar los datos locales ya no basta.

**Qué no es:** no es la firma de WebAuthn (la 278 verifica firmas; la firma no entrega ningún secreto), no es el desafío, no es `hmac-secret` expuesto a JavaScript ni un PRF de Web Crypto. Tampoco es una "clave biométrica" ni un "hash de la huella": es un secreto de la credencial, que el autenticador entrega tras verificar a la persona **con el método que el sistema decida**.

**Detectar no es comprobar.** Hay dos niveles: el navegador conoce la extensión (`getClientCapabilities()['extension:prf']`, `prf.enabled`) y el autenticador concreto la cumple. En iOS 18.4.1, Safari respondía `prf.enabled: true` sin `hmac-secret` en los datos del autenticador (hilo del foro de Apple, cerrado como aclaración de la especificación). La única prueba válida es una aserción que devuelva `results.first`.

## 5. Compatibilidad

"Documental" es lo que dicen fuentes oficiales (W3C, MDN, Chromium, WebKit, Apple, Microsoft); lo que solo afirman terceros va marcado. "Real" es lo que se probó en esta sesión.

| Plataforma | Navegador y autenticador | WebAuthn | PRF | Comprobado documentalmente | Comprobado realmente |
|---|---|---|---|---|---|
| Android | Chrome, gestor de contraseñas de Google | Sí (tarea 278) | Por confirmar | Chrome la ofrece desde la 116 en todas sus plataformas (MDN); su "Intent to Ship" advierte que "algunos proveedores de passkeys en Android 14 pueden no soportarla". La página oficial de Google sobre entornos no menciona PRF; solo terceros afirman que el gestor de Google sí | No |
| Android | Firefox | Sí | No para abrir | MDN: al crear desde Firefox 149; en `get()`, no | No |
| iPhone y iPad | Safari 18 o posterior, llavero de iCloud | Sí | Sí, con contradicciones | WebKit anuncia `prf` en Safari 18.0. MDN marca `get()` como no soportado (en contradicción con WebKit y con el bug 259934, cerrado como resuelto). En el foro de Apple: por el flujo con QR daba valores distintos que en el propio dispositivo (Safari 18.2 a 18.4) | No |
| macOS | Safari 18 o posterior | Sí | Sí, mismas salvedades | Igual que la fila anterior | No |
| macOS | Chrome | Sí | Depende del proveedor | Chrome 116 o posterior; con el llavero de iCloud solo desde Chrome 132 y sin PRF en el perfil local de Chrome, según terceros | No |
| Windows | Chrome y Edge, Windows Hello | Sí (278, RS256) | Por confirmar | La API de Windows (`webauthn.h`) expone valores PRF sobre `hmac-secret`. Que Windows Hello los devuelva solo desde Windows 11 25H2, y PRF al crear desde Chrome 147, lo dicen terceros | No |
| Windows | Firefox 139 o posterior | Sí | Por confirmar | MDN: Firefox 139 (en la 135, parcial y no en macOS) | No |
| Cualquiera | Chromium con autenticador virtual (`hasPrf`) | Sí | **Sí** | Protocolo de DevTools | **Sí, este experimento** |

**Conclusión de compatibilidad:** el único comportamiento comprobado de verdad es el de Chromium con el autenticador virtual. Qué teléfonos y computadores usa el equipo, y si sus autenticadores devuelven PRF estable, está por confirmar. Los flujos por QR (un teléfono como autenticador de un PC) no son fiables para esto.

## 6. Resultados del experimento

`node scripts/experimento-prf.mjs`, Chrome 154 sin ventana, autenticador de plataforma virtual con `hasPrf` y verificación del usuario simulada. En consola solo salen huellas cortas de cada salida; ninguna salida se guarda. Resultado: **23 de 23 comprobaciones en verde.**

| Qué se comprobó | Resultado |
|---|---|
| Crear dos credenciales con PRF | `prf.enabled: true`; este autenticador ya entrega 32 bytes al crear (otros no, ver sección 4) |
| `getClientCapabilities()['extension:prf']` | `true`: solo dice que el navegador la conoce |
| Misma credencial y misma entrada, 100 evaluaciones | 100 de 100 idénticas, comparadas byte a byte; 32 bytes; la aserción trae UV |
| Otra entrada | Otra salida |
| Otra credencial, misma entrada | Otra salida |
| Dos entradas en una aserción (`first` y `second`) | Cada una igual a su evaluación por separado (sirve para rotar) |
| Descartar la página y volver a abrirla | Sin ninguna salida en memoria; la misma entrada da la misma salida |
| PRF -> HKDF-SHA256 -> AES-GCM no extraíble -> blob de prueba (IV de 96 bits, AAD del formato) | Abre con la credencial correcta; no abre con otra credencial, otra entrada, otra AAD ni con un byte tocado |
| `wrapKey` sobre una clave derivada como la de hoy (`extractable: false`) | `InvalidAccessError: key is not extractable` |
| `deriveBits` con la misma contraseña y salt de prueba | Da la misma clave: lo cifrado con la de hoy se abre con la desenvuelta |
| `unwrapKey` con AES-GCM | Devuelve una clave no extraíble (`exportKey` falla) sin pasar los bytes por JavaScript |
| Sin red y con el servidor apagado | La misma salida |
| Pidiendo UV y sin verificar a la persona | `NotAllowedError`: ningún secreto |
| Con `userVerification: 'discouraged'` y sin verificar | También `NotAllowedError` (Chromium impone la verificación para PRF, como dice la especificación) |
| Credencial borrada del autenticador | `NotAllowedError`: ningún secreto |

**Qué demuestra:** la primitiva sirve para envolver una clave (estable, separada por credencial y por entrada, solo con verificación, sin red y sin estado previo), y Web Crypto permite la opción C sin tocar el formato de la Bóveda. **Qué no demuestra:** nada sobre los autenticadores reales del equipo (huella, rostro, PIN, Windows Hello), ni sobre passkeys sincronizadas. No se probó con ningún dispositivo físico.

## 7. Las cuatro opciones

Base común de B, C y D si alguna vez se implementa: credencial WebAuthn **propia de la Bóveda** (nunca la de la 278), entrada del PRF aleatoria de 32 bytes por activación, `HKDF-SHA256(salida del PRF, info "soluciones-it:boveda-desbloqueo:v1")` para la clave de envoltura (`info` separa el propósito; RFC 5869 § 3.3: con un material ya fuerte y uniforme, como la salida del PRF, la sal fija no le quita nada), AES-GCM con IV aleatorio de 96 bits y AAD que identifica el formato y la versión.

### Opción A: guardar la contraseña maestra cifrada con el PRF

PRF -> clave de envoltura -> descifra una copia local de la **contraseña maestra** -> PBKDF2 de siempre -> Bóveda.

- A favor: casi no toca la criptografía; los salts históricos y el segundo dispositivo siguen igual.
- En contra: quien logre usar el autenticador (por ejemplo, con el PIN del teléfono) y tenga el blob obtiene **la contraseña maestra del equipo**: sirve en todos los dispositivos, autoriza las eliminaciones sensibles y puede estar reutilizada fuera. Amplía el alcance de un compromiso local. Además sigue pagando las PBKDF2 en cada apertura.
- **Veredicto: descartada.**

### Opción B: envolver la clave AES de hoy

PRF -> clave de envoltura -> `unwrapKey` de la clave de la Bóveda.

- El experimento lo confirma: `wrapKey` exige una clave **extraíble** y la de hoy no lo es. Habría que cambiar `derivarClave` a `extractable: true`, y entonces cualquier código malicioso en el origen podría **exportar** la clave principal mientras la sesión está abierta. Hoy solo puede usarla como oráculo durante la sesión; con la clave exportada leería también los secretos que se creen después (la clave principal no cambia nunca).
- **Veredicto: descartada** (degrada frente a la amenaza E sin necesidad, porque C consigue lo mismo).

### Opción C: envolver por dispositivo las claves derivadas, en el momento en que se escribe la maestra

Al desbloquear **con la maestra** y activar el rápido: para cada salt presente, `deriveBits` (PBKDF2, los mismos parámetros) da los 32 bytes de la clave; se cifran con la clave de envoltura del PRF y se guardan solo los blobs. Al desbloquear rápido: PRF -> clave de envoltura -> `unwrapKey` -> CryptoKey AES-GCM **no extraíble** -> se comprueba que abre el verificador -> sesión.

- Los bytes de la clave pasan por JavaScript **solo al activar**, en el mismo instante en que la maestra ya está en memoria (y la maestra vale más que la clave). Al abrir no pasan: `unwrapKey` los mete directo en Web Crypto.
- Salts: los presentes al activar. Uno nuevo (raro: la Bóveda cifra con el del verificador) pide la maestra una vez y se re-envuelve.
- Segundo dispositivo: cada uno activa el suyo con la maestra.
- Maestra restablecida: el blob deja de abrir el verificador nuevo; se comprueba siempre y, si no abre, se borra y se pide la maestra.
- Revocación: borrar la fila local (credencial, entrada del PRF, blobs, metadatos) y avisar al gestor de credenciales (Signal API, como en la 278). Solo la maestra vuelve a abrir. No hace falta recifrar nada.
- Migración de datos: **ninguna**. Solo una tabla local nueva.
- **Veredicto: la mejor técnicamente.** Falla por el PIN (sección 10), no por su criptografía.

### Opción D: jerarquía de claves nueva (DEK)

Una clave de datos aleatoria (DEK) cifra la Bóveda; la DEK se guarda envuelta dos veces: con `PBKDF2(maestra)` (en el servidor, para todos los dispositivos) y con el PRF (local, por dispositivo).

- Lo más limpio para varios métodos de desbloqueo, y el único diseño que permitiría **rotar la maestra** (por ejemplo, cuando alguien deja el equipo) sin recifrar los datos.
- Exige **migrar toda la Bóveda**: recifrar credenciales, campos protegidos, archivos de Storage y el verificador; el `historial` es de solo inserción, así que sus copias quedarían con la clave vieja para siempre; varios teléfonos sin conexión escribiendo con el formato viejo durante la migración; formato de bloque nuevo (`v2` con identificador de clave). Rollback: leer los dos formatos y conservar lo viejo hasta confirmar lo nuevo en todos los dispositivos.
- El PIN abre la DEK igual que en C.
- **Veredicto: viable como proyecto propio y grande; no por el desbloqueo rápido.**

## 8. Tabla comparativa

| Propiedad | Actual | A | B | C | D |
|---|---|---|---|---|---|
| Contraseña se almacena | No | **Sí**, cifrada | No | No | No |
| La clave AES sale en claro | No | No | **Sí**: extraíble toda la sesión | Un instante al activar, junto a la maestra; nunca en disco; al abrir, no | No al usarla; la migración descifra todo |
| Funciona sin conexión | Sí | Sí | Sí | Sí | Sí |
| Segundo dispositivo | Sí, con la maestra | Sí | Sí | Sí, cada uno activa el suyo | Sí |
| Varios salts | Sí | Sí | Uno por salt | Los presentes al activar | Deja de haberlos |
| Cambio de contraseña | No existe (restablecer desde el panel) | Invalidar el blob | Invalidar | Invalidar comprobando el verificador | **Sí**, sin recifrar |
| Revocable por dispositivo | No aplica | Sí | Sí | Sí | Sí |
| Compromiso local revela la maestra | No | **Sí** | No | No | No |
| El PIN del dispositivo abre la Bóveda | **No** | Sí | Sí | Sí | Sí |
| Depende de la cuenta Apple o Google (passkeys sincronizadas) | No | Sí | Sí | Sí | Sí |
| Migración necesaria | No aplica | Ninguna de datos | Cambiar `derivarClave` | Solo una tabla local | Toda la Bóveda |
| Riesgo | Referencia | Alto | Alto | Medio (el PIN) | Alto (migración) y el PIN |

## 9. Riesgos frente a las amenazas

Comparación con la mejor opción (C). "Empeora" significa que alguien consigue algo que hoy no consigue.

| Amenaza | Hoy | Con la opción C | Cambia |
|---|---|---|---|
| A. Roba IndexedDB | Bloques cifrados; ataque fuera de línea a la maestra | Igual; el blob está envuelto con una clave de 256 bits que sale del autenticador | No |
| B. IndexedDB y la base de Supabase | Igual que A | Igual que A (nada del rápido va al servidor) | No |
| C. Tiene un rato el teléfono bloqueado | Necesita desbloquear el teléfono | Igual: el PRF exige verificar a la persona | No |
| D. Conoce el PIN del teléfono | Abre el teléfono y, con la 278, la app; **la Bóveda sigue pidiendo la maestra** | **El PIN abre también la Bóveda** | **Empeora** |
| E. Código malicioso en el origen con la Bóveda abierta | Usa las claves durante la sesión; puede pedir la maestra con un formulario falso | Igual durante la sesión; con la Bóveda cerrada puede lanzar una ceremonia PRF con el diálogo real del sistema | Parecido; algo peor (el diálogo es auténtico) |
| F. Teléfono perdido | Necesita el PIN y la maestra | Solo el PIN | **Empeora** (se reduce a D) |
| G. La persona borra la passkey | No aplica | El rápido falla; la maestra abre; se puede registrar de nuevo | No |
| H. Cambia el patrón o la contraseña de la app | No aplica | Independiente: otra credencial y otra fila | No |
| I. Se restablece la maestra | La Bóveda empieza de cero | El blob deja de abrir el verificador y se invalida (hay que comprobarlo siempre) | No, si se comprueba |
| J. Teléfono nuevo | Escribe la maestra | Escribe la maestra y activa el rápido allí | No |
| K. Copia de seguridad o restauración | Restaurar datos del navegador no da la maestra | Si se restauran los datos del navegador y la passkey está sincronizada (iCloud o Google), el rápido abre en el teléfono restaurado **sin la maestra** | **Empeora**: la confianza pasa también a la cuenta Apple o Google |
| L. Cuenta del técnico revocada | La RLS corta las descargas; lo local sigue cifrado, y la persona conoce la maestra | Igual; el blob no le da nada que no tenga | No (rotar la maestra seguiría sin existir; solo D lo resolvería) |

## 10. El PIN del dispositivo

WebAuthn no permite exigir biometría: "verificar a la persona" lo resuelve el sistema con huella, rostro, Windows Hello **o el PIN o código del dispositivo**, y la app no puede saber cuál fue ni excluir el PIN. El experimento lo confirma desde el otro lado: el PRF solo exige que haya verificación, no cuál.

Con cualquier opción de desbloqueo rápido, **el PIN del teléfono o del PC ganaría capacidad criptográfica para abrir la Bóveda** en ese dispositivo. Comparado con escribir la maestra:

- El PIN suele ser de 4 a 6 dígitos y se teclea muchas veces al día, a menudo a la vista de otros: mirarlo y después llevarse el teléfono es una forma de robo conocida.
- Desde la 278, ese mismo PIN ya puede abrir la app. La maestra es hoy el **único factor independiente** que queda entre el teléfono y los secretos del equipo; con el desbloqueo rápido desaparecería en ese dispositivo.
- En el modelo de la empresa (AD-007: la maestra "rige lo crítico"), eso es una **reducción material** de la seguridad frente a las amenazas D, F y K.

Mitigaciones posibles, ninguna devuelve la equivalencia: pedir la maestra cada cierto tiempo (acorta la ventana, pero dentro de ella basta el PIN); exigir además el patrón de la app (frena al curioso, no a quien sepa extraer una salida del PRF); depender de protecciones del sistema como las que piden biometría fuera de lugares conocidos (no las controla una web).

## 11. Decisión

**Resultado D: la seguridad dependería demasiado del PIN del dispositivo. No se implementa.** La Bóveda sigue abriéndose solo con la contraseña maestra.

Además, parte de **C**: con las fuentes actuales no se puede garantizar PRF estable en los dispositivos del equipo (sección 5).

El umbral de la tarea, con la mejor opción (C):

| # | Condición | C |
|---|---|---|
| 1 | PRF disponible de verdad en los dispositivos objetivo, o respaldo claro | **No cumple**: solo comprobado con el autenticador virtual; los dispositivos del equipo, por confirmar |
| 2 | La maestra no se almacena | Cumple |
| 3 | La maestra no se puede recuperar del blob | Cumple |
| 4 | Ninguna clave AES sin protección | Cumple (envuelta; en claro solo un instante al activar) |
| 5 | Copiar IndexedDB no basta | Cumple |
| 6 | Funciona sin conexión | Cumple (experimento) |
| 7 | La maestra siempre recupera la Bóveda | Cumple (el rápido es opcional) |
| 8 | Se puede revocar | Cumple |
| 9 | Varios salts | Cumple, con una re-envoltura si aparece uno nuevo |
| 10 | Cambio de contraseña resuelto | Cumple, comprobando el verificador |
| 11 | Segundo dispositivo resuelto | Cumple |
| 12 | No se debilita frente al modelo actual | **No cumple**: amenazas D, F y K |
| 13 | Migración y rollback demostrables | Cumple (sin migración de datos) |
| 14 | Pruebas que verifiquen las propiedades | Cumple (como el experimento) |

Dos condiciones no se cumplen: no se implementa.

## 12. Arquitectura recomendada si el usuario decide aceptar el riesgo del PIN

**Opción C**, y solo tras confirmar los dispositivos reales del equipo (pregunta 4 de la sección 15):

1. **Credencial propia** de la Bóveda, creada con `extensions: { prf: {} }`, autenticador de plataforma, `userVerification: 'required'`. Nunca la de la 278.
2. Se habilita **solo tras una aserción que devuelva `results.first`**; `prf.enabled` o `getClientCapabilities()` no bastan.
3. Se activa **dentro del mismo desbloqueo con la maestra** (nunca desde una sesión ya abierta), con `deriveBits` para cada salt presente.
4. **Entrada del PRF**: 32 bytes aleatorios por activación, guardados junto al blob (no son secretos).
5. **Clave de envoltura**: `HKDF-SHA256(salida del PRF, info "soluciones-it:boveda-desbloqueo:v1")`, no extraíble, usos `wrapKey` y `unwrapKey`. La salida del PRF se sobrescribe con ceros apenas se importa.
6. **Envoltura**: AES-GCM, IV aleatorio de 96 bits por blob, AAD `"soluciones-it:boveda-quick-unlock:v1"` más el identificador de la credencial y el salt de la Bóveda.
7. **Almacenamiento**: una tabla local nueva de Dexie, sin sincronizar: versión, credencial, entrada del PRF, `{ salt, iv, blob }` por salt, huella del verificador y fecha. Nada va a Supabase.
8. **Abrir**: PRF -> clave de envoltura -> `unwrapKey` (no extraíble) -> descifrar el verificador; si no abre, borrar la fila y pedir la maestra. Cualquier fallo lleva a la maestra.
9. Las **eliminaciones sensibles** siguen pidiendo la maestra (`verificarContrasenaMaestra` no cambia).
10. **Desactivar**: borra la fila y avisa al gestor de credenciales. No cambia la maestra ni recifra nada.

Archivos que tocaría: `src/features/boveda/sesionBoveda.ts` (una función nueva que abre la sesión con claves ya desenvueltas; `desbloquear()` no cambia), un módulo nuevo `src/features/boveda/desbloqueoRapidoBoveda.ts`, `src/lib/db.ts` (tabla local nueva, versión 20), los cinco puntos de desbloqueo de la sección 1.1 y Ajustes. `crypto.ts` y el formato de los bloques, no.

**Opción D** solo si además se quiere poder rotar la maestra; sería otra tarea, con su propio análisis de migración.

## 13. Migración y rollback

- **Opción C:** sin migración de datos. Rollback: quitar la función y borrar la tabla local (una versión de Dexie que la elimina). La vía de la maestra no se toca, así que desactivar el rápido deja la Bóveda exactamente como hoy.
- **Opción D:** migración en varias fases (formato `v2` con identificador de clave, lectura doble, recifrado por tabla, archivos de Storage uno por uno, verificador nuevo, fin de la escritura en `v1`) y rollback por fases conservando lo viejo hasta confirmar lo nuevo en todos los dispositivos. El historial queda con la clave vieja para siempre.

## 14. Pruebas necesarias si se implementa

- **Puras:** HKDF (vectores del RFC 5869), envoltura y AAD, IV nuevo por blob, rechazo de blobs tocados o de otra versión.
- **Integración** con un autenticador falso que implemente PRF (ampliar `src/pruebas/autenticadorFalso.ts`): activar, abrir, otra credencial, otra entrada, sin UV, credencial borrada, maestra restablecida (verificador nuevo), salt nuevo, desactivar, sin red.
- **Propiedades:** copiar la base local sin el autenticador no abre; la clave desenvuelta no es extraíble; la maestra nunca aparece en la fila local; la salida del PRF nunca se persiste.
- **Real:** `scripts/experimento-prf.mjs` convertido en paso de `npm run prueba:sin-conexion`, y una prueba manual en cada tipo de dispositivo del equipo antes de ofrecerlo.
- **Regresión:** las 33 pruebas de `sesionBoveda.test.ts` sin cambios.

## 15. Preguntas que requieren una decisión humana

1. ¿Aceptan que el **PIN o código del teléfono o del PC** (no solo la huella) abra la Bóveda en ese dispositivo? Es la pregunta que decide todo lo demás.
2. ¿Los teléfonos son corporativos o personales? ¿Hay una política de bloqueo del teléfono (PIN de 6 dígitos o más, borrado tras intentos)?
3. ¿Aceptan que la seguridad dependa también de la **cuenta Apple o Google** de cada técnico (las passkeys se sincronizan)?
4. ¿Qué dispositivos usa el equipo de verdad (marca y versión de Android, iPhone, versión de Windows 11 y navegador)? Sin eso no se puede confirmar PRF.
5. Si se hiciera: ¿pedir la maestra cada cierto tiempo aunque haya desbloqueo rápido? ¿Cada cuánto?
6. ¿Quieren poder **cambiar la maestra** (por ejemplo, cuando alguien deja el equipo)? Eso justificaría la opción D como proyecto propio, con o sin desbloqueo rápido.

## Fuentes

- W3C, [Web Authentication nivel 3](https://www.w3.org/TR/webauthn-3/): § 10.1.4 (extensión `prf`) y § 6.1.
- MDN, [datos de compatibilidad](https://github.com/mdn/browser-compat-data) (`api.CredentialsContainer.create/get.publicKey_option.extensions.prf`).
- Chromium, [Intent to Ship: WebAuthn PRF extension](https://groups.google.com/a/chromium.org/g/blink-dev/c/iTNOgLwD2bI/m/Oz1C7oEYAgAJ).
- WebKit, [Features in Safari 18.0](https://webkit.org/blog/15865/webkit-features-in-safari-18-0/) y [bug 259934](https://bugs.webkit.org/show_bug.cgi?id=259934).
- Apple Developer Forums: [PRF en el flujo con QR](https://developer.apple.com/forums/thread/774112) y [`prf.enabled` sin `hmac-secret`](https://developer.apple.com/forums/thread/782466).
- Microsoft Learn, [webauthn.h](https://learn.microsoft.com/en-us/windows/win32/api/webauthn/) y [WEBAUTHN_HMAC_SECRET_SALT](https://learn.microsoft.com/en-us/windows/win32/api/webauthn/ns-webauthn-webauthn_hmac_secret_salt).
- Google, [entornos compatibles con passkeys](https://developers.google.com/identity/passkeys/supported-environments) (no menciona PRF).
- Terceros, marcados como tales en la sección 5: [Corbado, PRF y passkeys](https://www.corbado.com/blog/passkeys-prf-webauthn); [Yubico, `hmac-secret`](https://developers.yubico.com/WebAuthn/Concepts/PRF_Extension/CTAP2_HMAC_Secret_Deep_Dive.html).
- IETF, [RFC 5869 (HKDF)](https://www.rfc-editor.org/rfc/rfc5869).
