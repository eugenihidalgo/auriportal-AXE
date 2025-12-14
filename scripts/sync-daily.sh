#!/bin/bash
# Script para sincronización masiva diaria de Kajabi → SQL
# Ejecutar diariamente a las 3 AM

# Directorio del proyecto
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$PROJECT_DIR/logs"
LOG_FILE="$LOG_DIR/sync-daily-$(date +%Y%m%d).log"

# Crear directorio de logs si no existe
mkdir -p "$LOG_DIR"

# URL del endpoint (ajustar según tu configuración)
SYNC_URL="https://controlauriportal.eugenihidalgo.work/sync-kajabi-all"
PASSWORD="kaketes7897"

# Función de logging
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "=========================================="
log "Iniciando sincronización masiva diaria"
log "=========================================="

# Ejecutar sincronización
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "${SYNC_URL}?password=${PASSWORD}" 2>&1)
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 200 ]; then
    log "✅ Sincronización completada exitosamente (HTTP $HTTP_CODE)"
    log "Respuesta: ${BODY:0:200}..."
else
    log "❌ Error en sincronización (HTTP $HTTP_CODE)"
    log "Respuesta: $BODY"
    exit 1
fi

log "=========================================="
log "Sincronización masiva diaria finalizada"
log "=========================================="

# Mantener solo los últimos 30 días de logs
find "$LOG_DIR" -name "sync-daily-*.log" -type f -mtime +30 -delete

exit 0








