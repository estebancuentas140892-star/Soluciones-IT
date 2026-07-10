#!/usr/bin/env bash
# Respaldo de las tablas de Supabase a un archivo cifrado.
#
# Inicia sesión con el usuario dedicado de respaldo (nunca con la clave
# service_role, prohibida en el repositorio; ver supabase/INSTRUCCIONES.md),
# exporta cada tabla por la API REST respetando las políticas RLS y empaqueta
# todo en un tar.gz cifrado con AES-256. La guía completa de configuración y
# restauración está en supabase/RESPALDO.md.
#
# Variables requeridas (en GitHub Actions vienen de los secretos):
#   RESPALDO_CORREO          correo del usuario de respaldo
#   RESPALDO_CONTRASENA      contraseña del usuario de respaldo
#   RESPALDO_CLAVE_CIFRADO   frase con la que se cifra el archivo
#
# No incluye los archivos del bucket de Storage (fotos, manuales), solo sus
# referencias en la tabla adjuntos.

set -euo pipefail

# La clave publishable es pública por diseño (viaja en el bundle de la app);
# RLS impide leer datos con ella sin una sesión válida.
SUPABASE_URL="${SUPABASE_URL:-https://kwwxnmlprdivckqcgjws.supabase.co}"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-sb_publishable_yHHdmM4xeo34Eq0-FVVo9A_hh33nemO}"

TABLAS=(categorias perfiles articulos dispositivos conexiones credenciales historial adjuntos diagnosticos ejecuciones_diagnostico accesos_boveda)
FILAS_POR_PAGINA=1000

for herramienta in curl jq tar openssl; do
  if ! command -v "$herramienta" >/dev/null 2>&1; then
    echo "Falta la herramienta requerida: $herramienta" >&2
    exit 1
  fi
done

faltantes=""
for variable in RESPALDO_CORREO RESPALDO_CONTRASENA RESPALDO_CLAVE_CIFRADO; do
  if [ -z "${!variable:-}" ]; then
    faltantes="$faltantes $variable"
  fi
done
if [ -n "$faltantes" ]; then
  echo "Faltan variables de entorno:$faltantes" >&2
  echo "En GitHub: Settings > Secrets and variables > Actions. Guía: supabase/RESPALDO.md" >&2
  exit 1
fi

echo "Iniciando sesión en Supabase..."
credenciales=$(jq -n --arg correo "$RESPALDO_CORREO" --arg contrasena "$RESPALDO_CONTRASENA" \
  '{email: $correo, password: $contrasena}')
respuesta=$(curl -s -w "\n%{http_code}" -X POST \
  "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  --data "$credenciales")
codigo=$(echo "$respuesta" | tail -n 1)
cuerpo=$(echo "$respuesta" | sed '$d')
if [ "$codigo" != "200" ]; then
  echo "No se pudo iniciar sesión con el usuario de respaldo (HTTP $codigo)." >&2
  echo "Detalle: $cuerpo" >&2
  exit 1
fi
token=$(echo "$cuerpo" | jq -r '.access_token')
if [ -z "$token" ] || [ "$token" = "null" ]; then
  echo "La respuesta de inicio de sesión no trajo un token de acceso." >&2
  exit 1
fi

directorio=$(mktemp -d)
trap 'rm -rf "$directorio"' EXIT

for tabla in "${TABLAS[@]}"; do
  echo "Exportando $tabla..."
  archivo="$directorio/$tabla.json"
  echo "[]" > "$archivo"
  desplazamiento=0
  while true; do
    pagina=$(curl -s -w "\n%{http_code}" \
      "$SUPABASE_URL/rest/v1/$tabla?select=*&order=id&limit=$FILAS_POR_PAGINA&offset=$desplazamiento" \
      -H "apikey: $SUPABASE_ANON_KEY" \
      -H "Authorization: Bearer $token")
    codigo=$(echo "$pagina" | tail -n 1)
    filas=$(echo "$pagina" | sed '$d')
    if [ "$codigo" != "200" ]; then
      echo "Error al exportar $tabla (HTTP $codigo): $filas" >&2
      exit 1
    fi
    echo "$filas" | jq -s '.[0] + .[1]' "$archivo" - > "$archivo.tmp"
    mv "$archivo.tmp" "$archivo"
    cantidad=$(echo "$filas" | jq 'length')
    desplazamiento=$((desplazamiento + cantidad))
    if [ "$cantidad" -lt "$FILAS_POR_PAGINA" ]; then
      break
    fi
  done
done

# Manifiesto con la fecha y el número de filas por tabla, para saber de un
# vistazo qué contiene el respaldo sin descomprimirlo entero.
manifiesto="$directorio/manifiesto.json"
jq -n --arg fecha "$(date -u +%Y-%m-%dT%H:%M:%SZ)" '{fecha: $fecha, tablas: {}}' > "$manifiesto"
echo "Filas exportadas:"
for tabla in "${TABLAS[@]}"; do
  cantidad=$(jq 'length' "$directorio/$tabla.json")
  jq --arg tabla "$tabla" --argjson cantidad "$cantidad" \
    '.tablas[$tabla] = $cantidad' "$manifiesto" > "$manifiesto.tmp"
  mv "$manifiesto.tmp" "$manifiesto"
  echo "  $tabla: $cantidad"
done

# La bóveda vacía puede ser legítima, pero lo más probable es que el usuario
# de respaldo no tenga puede_ver_boveda y RLS esté ocultando las filas.
if [ "$(jq 'length' "$directorio/credenciales.json")" = "0" ]; then
  echo "Aviso: credenciales exportó 0 filas. Si la bóveda no está vacía, el usuario de respaldo necesita puede_ver_boveda (ver supabase/RESPALDO.md)." >&2
fi

fecha_archivo=$(date -u +%Y-%m-%d)
salida="respaldo-supabase-$fecha_archivo.tar.gz.enc"
tar -czf "$directorio/respaldo.tar.gz" -C "$directorio" \
  manifiesto.json "${TABLAS[@]/%/.json}"
openssl enc -aes-256-cbc -pbkdf2 -iter 600000 -salt \
  -pass env:RESPALDO_CLAVE_CIFRADO \
  -in "$directorio/respaldo.tar.gz" -out "$salida"

echo "Respaldo cifrado generado: $salida ($(du -h "$salida" | cut -f1))"
