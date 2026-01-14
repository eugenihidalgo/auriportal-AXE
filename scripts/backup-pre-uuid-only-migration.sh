#!/bin/bash
# Backup completo antes de migración UUID-only
# Fecha: 2025-01-14

set -e

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/www/aurelinportal/.local_backups"
BACKUP_NAME="aurelinportal_${TIMESTAMP}_pre_uuid_only_migration"
DUMP_FILE="${BACKUP_DIR}/${BACKUP_NAME}.dump"
GLOBALS_FILE="${BACKUP_DIR}/globals_${TIMESTAMP}.sql"
CHECKSUMS_FILE="${BACKUP_DIR}/SHA256SUMS_${TIMESTAMP}.txt"

echo "=== BACKUP PRE-UUID-ONLY MIGRATION ==="
echo "Timestamp: ${TIMESTAMP}"
echo "Backup dir: ${BACKUP_DIR}"
echo ""

# Verificar que DATABASE_URL está configurado
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL no está configurado"
    exit 1
fi

# Extraer componentes de DATABASE_URL si es necesario
# Por ahora usamos pg_dump con DATABASE_URL directamente

echo "[1] Creando backup completo (formato custom)..."
pg_dump --format=custom \
    --no-owner \
    --no-privileges \
    --verbose \
    --file="${DUMP_FILE}" \
    "${DATABASE_URL}"

if [ ! -f "${DUMP_FILE}" ]; then
    echo "❌ ERROR: Backup dump no se creó"
    exit 1
fi

DUMP_SIZE=$(du -h "${DUMP_FILE}" | cut -f1)
echo "✅ Backup dump creado: ${DUMP_FILE} (${DUMP_SIZE})"

echo ""
echo "[2] Creando backup de globals..."
pg_dumpall --globals-only \
    --file="${GLOBALS_FILE}" \
    "${DATABASE_URL}"

if [ ! -f "${GLOBALS_FILE}" ]; then
    echo "❌ ERROR: Backup globals no se creó"
    exit 1
fi

GLOBALS_SIZE=$(du -h "${GLOBALS_FILE}" | cut -f1)
echo "✅ Backup globals creado: ${GLOBALS_FILE} (${GLOBALS_SIZE})"

echo ""
echo "[3] Generando checksums SHA256..."
sha256sum "${DUMP_FILE}" "${GLOBALS_FILE}" > "${CHECKSUMS_FILE}"

echo "✅ Checksums generados: ${CHECKSUMS_FILE}"
cat "${CHECKSUMS_FILE}"

echo ""
echo "[4] Verificando que el dump es legible..."
pg_restore --list "${DUMP_FILE}" | head -20

echo ""
echo "=== BACKUP COMPLETADO ==="
echo "Dump: ${DUMP_FILE}"
echo "Globals: ${GLOBALS_FILE}"
echo "Checksums: ${CHECKSUMS_FILE}"
echo ""
echo "Para restaurar:"
echo "  pg_restore --clean --if-exists --dbname=\"\${DATABASE_URL}\" ${DUMP_FILE}"
