# Auditoría de las guías reales para el flujo natural (tarea 289, fase 1)

Base de la tarea 289 ("Las guías como un solo flujo natural"). Se hizo **antes de cambiar la ejecución** y sin corregir ninguna guía: sirve para diseñar y probar la arquitectura, y será el punto de partida de la revisión de contenido de las guías reales, que es la etapa siguiente.

Principio que guía la lectura: **la complejidad pertenece al sistema, no al técnico.** Un procedimiento puede reutilizar otros por dentro, pero quien lo ejecuta debería recorrer un único flujo continuo: qué estoy resolviendo, cuándo corresponde, qué necesito antes, qué hago ahora, dónde, qué debo ver y cuándo terminé.

## 1. Alcance y método

- **Qué se miró:** las 36 guías vivas de la base (30 publicadas y 6 borradores) con sus 149 pasos, leídas el 2026-10-02 en modo solo lectura. Las 8 eliminadas no cuentan.
- **Cómo:** las mismas reglas que ya usa el editor (`revisionGuia.ts`: requisitos que son acciones, tareas que encadenan acciones, alertas que solo recuerdan) aplicadas a las guías reales con un script temporal, más una revisión manual de los casos representativos. El script y la copia de los datos vivieron solo en la máquina de trabajo: no están en el repositorio.
- **Qué no tiene este documento, a propósito:** ninguna dirección IP, URL, nombre de credencial ni dato protegido. El repositorio es público; las guías se nombran por su título y los textos se citan solo cuando no llevan nada de eso.

## 2. Números

| Qué | Cuántos |
|---|---|
| Guías vivas (publicadas / borradores) | 36 (30 / 6) |
| Pasos | 149, de los que 13 son un paso que es otra guía entera ("paso contenedor") |
| Pasos propios sin "Dónde" | 101 de 136 |
| Pasos propios sin "Debes ver" | 101 de 136 |
| Guías que usan "Dónde" y "Debes ver" | 8 |
| Pasos con más de 5 tareas | 4 |
| Tareas que encadenan 3 o más acciones | 9 |
| Requisitos que el editor reconoce como acción | 1 |
| Alertas que solo recuerdan algo | 0 |
| Requisitos que hablan de la arquitectura | 7 |
| "Cuándo usar" que habla de la arquitectura | 2 |
| Guías que reutilizan otras | 8 |
| Tareas escritas como requisito previo | 0 |

## 3. Hallazgos, por clase

### 3.1 Requisitos que en realidad son acciones

- **Restablecer AnyDesk cuando aparece espera de 999 segundos:** «Aplicar este procedimiento únicamente cuando corresponda al caso de espera de 999 segundos…». No es algo que deba existir antes de empezar: es **cuándo usar** la guía. Su sitio es "¿Cuándo usar este procedimiento?".
- Ninguna otra guía publicada escribe pasos en sus requisitos ("Abrir…", "Ir a…"): el editor ya lo señala desde la tarea 246 y el contenido lo respetó.

### 3.2 Requisitos que hablan de cómo está construida la aplicación

- **Crear un trabajador para almuerzo y Crear un cliente externo en ICG Manager:** «Acceso autorizado a ICG Manager mediante el **procedimiento relacionado**». El técnico no tiene por qué saber que el acceso es otra guía.
- **Acceder a ICG Manager mediante Escritorio remoto, Conectar de forma remota a un POS, Diagnosticar cuando un usuario no aparece en Impresión bloqueada y Actualizar la resolución DIAN:** «Tener acceso a la **información protegida** …» o «**Acceso protegido** … disponible». Nombran el mecanismo de la Bóveda en vez de lo que hace falta (un acceso autorizado). La credencial ya aparece sola en la acción que la necesita.

### 3.3 "Cuándo usar" que no dice cuándo

- **Configurar el computador para un usuario nuevo:** «Guía principal para preparar el computador… **Centraliza el recorrido y abre las guías específicas** sin duplicar sus pasos». Describe la arquitectura, no la situación.
- **Acceder a ICG Manager mediante Escritorio remoto:** «Usa esta guía cuando **otra guía requiera** abrir ICG Manager…».
- **Describen lo que hace la guía en vez de cuándo usarla** (el campo es útil igual, pero no responde la pregunta): Configurar las páginas de inicio de Chrome para un usuario administrativo, Configurar la firma corporativa en Outlook, Configurar Microsoft 365, Configurar OneDrive, Configurar Outlook, Configurar SICOF, Establecer Google Chrome como navegador predeterminado, Conectar la carpeta Pública como unidad de red y Crear y almacenar una copia de seguridad del correo (.pst).
- El resto empieza con "Usa esta guía cuando…" y describe una situación, que es lo que se busca.

### 3.4 Pasos con demasiadas tareas (más de 5)

Conectar una impresora compartida (paso 2, 6 tareas), Actualizar la resolución DIAN (paso 7, 6), Configurar impresión bloqueada y perfiles Carta y Oficio (paso 1, 6) y Configurar las páginas de inicio de Chrome para un usuario administrativo (paso 1, 6). No todas sobran: la regla de cinco no es mecánica (regla 20 a). Se revisan en la etapa de contenido.

### 3.5 Tareas que encadenan acciones

Nueve, con tres o más acciones en una sola línea. Por ejemplo: «Haz clic derecho sobre el usuario → Propiedades → Account / Cuenta. Marca Desbloquear cuenta y selecciona Aplicar → Aceptar» (Desbloquear un usuario en Active Directory), las dos primeras tareas de Configurar la firma corporativa, la del paso 1 de Conectar la carpeta Pública, la del paso 2 de Establecer Google Chrome como predeterminado, la del paso 5 de Configurar SICOF y tres de borradores (DIAN, copia .pst y usuario de Active Directory). El editor ya ofrece "Dividir en N tareas".

### 3.6 Avisos usados como recordatorios

Ninguna alerta empieza con "Recuerda" o "No olvides". Las dos alertas "Importante" de Acceder a ICG Manager («no copies las credenciales en notas…») son de **seguridad**, que es un motivo válido de advertencia.

### 3.7 Guías que reutilizan otras

| Guía | Cómo reutiliza | Qué ve hoy el técnico |
|---|---|---|
| Crear un trabajador para almuerzo en ICG Manager | Paso 1 = Acceder a ICG Manager mediante Escritorio remoto (3 pasos, 2 credenciales) | Tarjeta "Guía necesaria" que hay que abrir; dentro, "Estás realizando «…» para continuar con «…»", "Volver a la guía principal", "Paso 1 de 3" y los requisitos de la otra guía |
| Crear un cliente externo / un usuario de taquillero en ICG Manager (borradores) | Igual, paso 1 | Igual |
| Configurar el computador para un usuario nuevo | Pasos 1 a 9 = nueve guías distintas | Nueve tarjetas: abrir, hacer, volver, nueve veces |
| Configurar acceso de un usuario a la carpeta Pública | Paso 2 = Conectar la carpeta Pública como unidad de red | Una tarjeta en mitad del recorrido |
| Diagnosticar una impresora instalada que no imprime | Paso 7: dos guías de consulta en una tarea | «Ejecuta únicamente la guía publicada que corresponda…» y dos tarjetas "Consulta opcional" |
| Crear y almacenar una copia de seguridad del correo (borrador) | Paso 5: una guía de contingencia | Tarjeta "Si esto falla" |
| Enviar un archivo pesado por correo mediante OneDrive | Decisión: «¿La persona solo necesita ver el archivo?» → No → Crear un vínculo con permiso de edición | La otra guía con su cabecera "Estás realizando…" y "Volver a la guía principal" |

### 3.8 Requisitos repetidos entre la guía y la que reutiliza

- **Las tres de ICG:** 4 requisitos propios más 4 de la guía de acceso, que se solapan («autorización para…») sin ser textos iguales.
- **Configurar el computador:** 6 propios, que ya resumen lo que piden sus nueve guías; las nueve suman unos 30, varios repetidos («Correo institucional y contraseña vigente», «Computador conectado a la red corporativa») y algunos que **produce un paso anterior de la misma guía** («Outlook configurado con el correo institucional», «SICOF ya configurado…», «Google Chrome configurado»). Sumarlos sin criterio pondría como requisito previo lo que el propio procedimiento hace.

### 3.9 Pasos sin "Dónde" ni "Debes ver"

101 de los 136 pasos propios no tienen ninguno de los dos. Los usan bien: Crear un trabajador para almuerzo (todos sus pasos), Diagnosticar una impresora, Restablecer AnyDesk, Conectarse y Desconectarse de la VPN, Enviar un archivo pesado, Crear un vínculo de OneDrive y Abrir una copia de seguridad (.pst). Es trabajo de contenido.

### 3.10 Verificaciones finales que piden algo que la guía no hizo

- **Conectar una impresora compartida a un computador:** pide que «la configuración de Impresión bloqueada quedó aplicada» y que «los perfiles Carta 2 caras y Oficio 2 caras quedaron disponibles según la guía de configuración». Ninguno de sus dos pasos los configura: eso lo hace otra guía que no está vinculada.
- **Configurar el computador para un usuario nuevo:** «la impresora… conserva los perfiles Carta y Oficio definidos». Tampoco hay paso que los configure.
- **Diagnosticar una impresora:** «No se realizaron cambios aleatorios…» es una comprobación de conducta, no de resultado. Se conserva, pero conviene revisarla.

### 3.11 Condiciones y diagnósticos escritos como tareas

- **Diagnosticar una impresora, paso 5:** «Aplica este paso solo a impresoras de red con una IP confirmada» es una **decisión**, no una acción.
- **Mismo, paso 6:** tres tareas que son conclusiones («Si otros computadores imprimen y este no, la falla parece…»). Son información o una decisión.

### 3.12 Guías sin requisitos

Ninguna guía real tiene cero requisitos. Las que tienen uno solo (Desconectarse de la VPN, Establecer Google Chrome como predeterminado y Crear un vínculo de OneDrive) los tienen legítimos. El caso "sin requisitos" se prueba con datos inventados.

## 4. Casos representativos elegidos

| Caso | Guía real | Por qué |
|---|---|---|
| Caso de referencia (alimentación) | Crear un trabajador para almuerzo en ICG Manager | Reutiliza el acceso en el paso 1, con dos credenciales, y tiene "Dónde" y "Debes ver" en todos sus pasos propios |
| Guía hecha de guías | Configurar el computador para un usuario nuevo | Nueve pasos seguidos que son otras guías |
| Impresora | Diagnosticar una impresora instalada que no imprime (y Agregar una impresora por su IP) | Guías de consulta dentro de una tarea, condiciones escritas como tareas |
| Guía que usa otra | Las anteriores y Enviar un archivo pesado (decisión con destino) | Las tres formas de reutilizar: paso, tarea y decisión |
| Sin requisitos | Datos inventados | No existe una real |
| Con credencial | Acceder a ICG Manager mediante Escritorio remoto | Dos datos protegidos en dos pasos |

Las pruebas (`src/features/soluciones/guiasFlujoNatural.test.tsx`) copian la **estructura** de estos casos con datos inventados: ninguna IP, credencial ni texto real.

## 5. Lo que hoy hace la ejecución (antes de la tarea 289)

Fijado en las pruebas de la fase 1 antes de cambiar nada:

- **Abrir una guía es empezarla** (AD-040): la ficha con "cuándo usar" y el objetivo vive en "Detalles de la guía"; la ejecución no orienta.
- **Los requisitos salen en la misma pantalla que la primera acción** del paso 1, y solo si no hay avance: preparar y ejecutar mezclados.
- **Un paso que es otra guía** se presenta como "Primero, completa esta guía" con una tarjeta "Guía necesaria", su estado ("Sin iniciar", "Paso 2 de 3") y "Abrir guía". Dentro: "Estás realizando «X» para continuar con «Y»", "Volver a la guía principal", la numeración de la otra guía ("Paso 1 de 3"), sus propios requisitos a mitad del recorrido, "Completar y terminar" en su última acción aunque la guía de fuera siga, y sus comprobaciones finales como "Antes de terminar, comprueba".
- **Una guía de consulta o de contingencia en una tarea** es una tarjeta "Consulta opcional" o "Si esto falla" con "Abrir guía".
- **El "No" de una decisión** abre la otra guía con la misma cabecera y el mismo "Volver a la guía principal".
- Lo que ya está bien y se conserva: el avance de la guía reutilizada vive dentro de la ejecución de la principal (tarea 2 del encargo del 2026-09-09), así que retomar y reiniciar ya funcionan como un solo procedimiento; la credencial aparece en la acción que la necesita y se desbloquea ahí mismo; la cabecera de la ejecución siempre lleva el nombre de la guía que se abrió.

## 6. Rutas asistidas por categoría

Evaluado sin implementar (sección 18 del encargo). Lo que ya existe cubre a quien no sabe qué escribir: los **accesos rápidos** de Resolver (las categorías con guías, las más usadas primero), **Todas las guías** con su filtro por categoría y las **guías con preguntas**, que son exactamente una ruta asistida para un problema. Resolver sigue llevando de la descripción a la solución ("la impresora no imprime" sube la guía del problema, tarea 288). Añadir "elegir categoría, elegir problema, elegir guía" como camino principal sumaría pasos. Propuesta posterior, sin tarea abierta: cuando la revisión de contenido rellene "cuándo usar" y las formas de búsqueda, medir si los accesos rápidos bastan antes de diseñar nada.

## 7. Lo que queda para la revisión de contenido (etapa siguiente)

Todo lo de la sección 3 que es texto: los requisitos y "cuándo usar" que nombran la arquitectura, las verificaciones finales que piden lo que la guía no hace, las condiciones escritas como tareas, las tareas encadenadas, los pasos de más de cinco tareas y los 101 pasos sin "Dónde" ni "Debes ver". La tarea 289 cambia cómo se presentan las guías; no reescribe ninguna.
