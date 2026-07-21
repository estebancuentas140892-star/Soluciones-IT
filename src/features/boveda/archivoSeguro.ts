// Constantes compartidas del "Archivo seguro" (fase P5 de
// PROPUESTA_SEGURIDAD_DISPOSITIVO.md), usadas tanto al subir
// (CredencialForm.tsx) como al descargar o eliminar (CredencialPage.tsx).
//
// Bucket de Storage PROPIO y privado, distinto del bucket `adjuntos`
// (fotos, manuales): ese lo puede leer cualquier técnico autenticado
// (`adjuntos_storage_lectura` en schema.sql no exige ningún permiso),
// y desde el 2026-07-17 la contraseña maestra la conoce todo el
// equipo, así que subir ahí un archivo cifrado sería una regresión de
// seguridad silenciosa: cualquiera sin permiso de bóveda podría
// descargarlo y, si conoce la contraseña compartida, descifrarlo. Por
// eso `archivos_boveda` tiene su propia política RLS que exige
// `puede_ver_boveda()` (ver supabase/schema.sql).
export const BUCKET_ARCHIVOS_BOVEDA = 'archivos_boveda'

// Vigencia corta de la URL firmada para descargar un archivo seguro (a
// diferencia de la 1 hora que usan los adjuntos normales, useUrlAdjunto.ts):
// una URL firmada es un token portador que Storage no vuelve a validar
// contra la RLS en cada descarga, así que si se filtra sigue siendo
// descargable mientras dure. La descarga aquí es una acción puntual de
// un clic, no algo que deba quedar vivo una hora.
export const DURACION_URL_ARCHIVO_SEGURO_SEGUNDOS = 120
