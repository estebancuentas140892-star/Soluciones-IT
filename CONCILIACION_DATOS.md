# Estado de los datos reales al cierre de la conciliación (2026-10-10)

Foto fechada de los datos de producción al cerrar la conciliación del inventario que hizo ChatGPT el 2026-10-10 (regla 26 de [REGLAS.md](REGLAS.md): los datos operativos los modifica ChatGPT; Claude Code, el código). **No es la fuente de verdad del dato**, que sigue siendo Supabase: es la línea base que las fases siguientes (tareas 320 a 325 de [TAREAS.md](TAREAS.md)) usan para no repetir cargas, no inventar datos y no dar por resuelto lo que sigue en conflicto.

- **Qué no tiene este documento, a propósito:** ninguna dirección IP, serial, código Redeban, número de formulario o rango DIAN, credencial ni nombre de persona. El repositorio es público. Los casos se nombran por su código de equipo, su prefijo o su categoría; el detalle vive en Supabase y en el archivo de cierre que ChatGPT entregó al usuario (`Cierre_conciliacion_Soluciones_IT_2026-10-10.md`, fuera del repositorio).
- **Registro:** tarea 318.

## 1. Cargas ya aplicadas (no se repiten)

ChatGPT las aplicó y las verificó en Supabase Production. **No se vuelven a ejecutar ni se convierten en migraciones de datos:** `supabase/schema.sql` declara el esquema, no carga datos reales.

- **Área de las personas:** las 94 personas activas tienen `area` (la columna de la tarea 317).
- **Categoría `Datáfonos`**, que no es de red (`es_red = false`), con 13 datáfonos activos.
- **13 conexiones de tipo `relacionado`**, una por datáfono, entre cada datáfono y su POS.
- **Datos documentales de facturación en `detalles` de los 15 POS/FJP:** `DIAN - estado de verificación` y `Facturación - vencimiento fuente` en los 15; `DIAN - formulario`, `DIAN - rango`, `DIAN - formalización` y `DIAN - vigencia reportada` en los 11 con formulario o rango DIAN documentado.
- **Dos ubicaciones estructuradas nuevas:** `Taquilla 1 Principal (Convenios)` y `Taquilla Regional PN`. POSPN01, POSJP06 y el datáfono de la Taquilla Regional quedaron vinculados a ellas (`ubicacion_id`).

## 2. Cifras al cierre

Comprobadas por Claude Code el 2026-10-10 con consultas de solo lectura en Supabase Production; coinciden con el cierre de ChatGPT.

| Medida | Valor | Cómo se cuenta |
|---|---|---|
| Dispositivos activos | 210 | `dispositivos` sin `eliminado_en` |
| Personas activas | 94 | `personas` con `estado = 'activa'` y sin `eliminado_en` |
| Personas activas sin área | 0 | las anteriores con `area` vacía |
| Datáfonos | 13 | dispositivos activos de la categoría `Datáfonos` |
| Relaciones Datáfono a POS | 13 | `conexiones` con `tipo = 'relacionado'` |
| POS con fecha documental de facturación | 15 | clave `Facturación - vencimiento fuente` |
| POS con PDF DIAN conciliado | 11 | claves `DIAN - formulario`, `DIAN - rango`, `DIAN - formalización` y `DIAN - vigencia reportada` |
| Dispositivos sin ubicación estructurada | 54 | activos con `ubicacion_id` nulo |
| Responsables textuales por validar | 8 | activos con `responsable` escrito y sin `responsable_id` |
| Portátiles MP01 a MP17 sin alta | 17 | no están en el inventario: esperan comprobación física |
| Adjuntos en producción | 0 | `adjuntos` sin `eliminado_en` |
| Intervenciones manuales | 2 | `historial` con `campo = 'intervencion'` |

## 3. Cómo se leen estos datos

- **Vigente, histórico y por validar son tres cosas distintas.** Vigente es lo confirmado con una fuente actual. Histórico es lo que ocurrió o era cierto en una fecha: evidencia, no estado actual. Por validar es lo que aparece en una fuente sin estar confirmado.
- **Nada se considera actual por aparecer en un archivo antiguo.** No se inventan fechas, técnico, responsable, resultado, vigencia ni consecutivo consumido para completar un hueco.
- **La interfaz puede señalar "por validar", pero no decide el dato.** Lo decide el usuario o ChatGPT con una fuente.
- **Las claves `DIAN - ...` de `detalles` se conservan** como trazabilidad de la conciliación, también cuando exista el modelo de autorizaciones de facturación (tarea 321). Retirarlas lo decide el usuario después.
- **Los campos heredados de datáfono y pinpad dentro de los POS se conservan** mientras se comprueba la presentación de los datáfonos (tarea 325).
- **Área pertenece a Persona y Ubicación pertenece al Equipo:** el área de un equipo se lee de su responsable (RN-072) y su lugar, de su ubicación vinculada.

## 4. Conflictos pendientes

**Ninguno está resuelto ni se resuelve por código o migración.** Se siguen en la tarea 319.

| Caso | Qué se sabe | Qué falta |
|---|---|---|
| PNT9 | La fecha del PDF de autorización y la fecha registrada en Equipos POS no coinciden. | Decidir cuál es la vigente con una fuente actual. Mientras tanto se conserva el conflicto, sin elegir. |
| PNTE | Equipos POS documenta el prefijo PNTE con una fecha, pero esa fila no identifica ningún equipo. Entre los PDF DIAN revisados no quedó conciliado un documento correspondiente a PNTE. | Confirmar qué autorización y qué punto representa, si fue reemplazada y qué está configurado realmente. No se asocia automáticamente a ningún POS. |
| PN10, PN11, PN12 y PN13 | Tienen fecha documental en Equipos POS. Entre las fuentes DIAN revisadas no quedó conciliado un PDF correspondiente a ninguno de los cuatro. | Confirmar la resolución y la configuración actuales en ICG/HKA. |
| Consecutivos actuales | Ningún POS tiene un consecutivo consumido de fuente confiable actual. | Sin él no se calcula ni se avisa agotamiento de rango. |
| Redeban | Cuatro conflictos: 4 datáfonos con `Estado de conciliación` y 2 POS con `Conflicto Redeban` en `detalles`. | Confirmar en sitio qué equipo es cuál. |
| Cámara Caja Principal: direccionamiento | Su ficha lleva `Conflicto IP histórico`: dos fuentes dan direcciones distintas. Comprobado de nuevo el 2026-10-10 en los datos actuales. | Confirmar la dirección vigente. |
| Cámara Restaurante: identidad | La app la identifica como Restaurante; otra fuente la identifica como Alimentos y aporta NVR. Nombre, ubicación e identidad no están conciliados. | Confirmación física antes de renombrarla o completar sus datos. |
| APLICACIONES | Dos fuentes dan direcciones distintas, que difieren en un octeto. | Confirmar la dirección vigente. |
| Videos de ICG | Dos videos del procedimiento no se recuperaron. | Recuperarlos. Siguen bloqueando parte de la tarea 245 (contenido de la guía DIAN). |

## 5. Casos que no son de desarrollo

Datos reales que esperan una comprobación de personas, no código. Se siguen en la tarea 319.

- **MP01 a MP17:** 17 portátiles que requieren comprobación física y de estado actual antes de darlos de alta.
- **8 responsables textuales por validar:** equipos con un nombre escrito y sin ficha de persona ("Anotado: «X» · por validar" en la lista de Equipos).
- **54 dispositivos sin ubicación estructurada:** tienen o no un texto de ubicación, pero ninguna ficha de Ubicación vinculada.

## 6. Fuentes históricas que no se importan automáticamente

Las fases siguientes pueden ofrecer una vía para registrarlas como antecedentes por validar, nunca para convertirlas en datos vigentes sin conciliar.

- **Cronograma de mantenimiento:** 87 marcas. No son mantenimientos confirmados (no dicen técnico, resultado ni evidencia), y 10 títulos mensuales son inconsistentes: en esas hojas, día más hoja no da una fecha sin conciliar antes el mes (tarea 320). La vía para registrarlas como antecedentes por validar, sin afirmar lo que no dicen, es `antecedenteDesdeCronograma` (`src/features/mantenimientos/antecedentes.ts`, ARQUITECTURA_FUNCIONAL RN-073); cargarlas es trabajo de datos, no de código.
- **Actas en PDF:** varias contienen páginas de distintos equipos; un documento tiene que poder vincularse a varios equipos sin copiar el archivo (tarea 322).
- **Compromisos de actas:** los de marzo y agosto están agrupados y la correspondencia entre tarea y responsable no es inequívoca, así que no se importan; los de septiembre pueden quedar disponibles para conciliación, no como pendientes actuales hasta confirmar su vigencia (tarea 323).
- **Esquema de publicaciones institucionales:** 241 filas que describen obligaciones; no demuestran que una publicación esté cumplida (tarea 324).
