#!/bin/bash
# scripts/reiniciar-servidor.sh
# Script para reiniciar el servidor con PM2 y verificar estado

set -e

echo "🔄 Reiniciando servidor AuriPortal..."

# Obtener directorio del script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Verificar que PM2 está instalado
if ! command -v pm2 &> /dev/null; then
    echo "❌ PM2 no está instalado. Instalando..."
    npm install -g pm2
fi

# Verificar estado actual
echo "📊 Estado actual del servidor:"
pm2 status

# Reiniciar servidor
echo ""
echo "🔄 Reiniciando servidor..."
pm2 restart aurelinportal --update-env

# Esperar un momento para que el servidor inicie
sleep 3

# Verificar nuevo estado
echo ""
echo "📊 Estado después del reinicio:"
pm2 status

# Obtener nuevo PID
PID=$(pm2 jlist | grep -o '"pid":[0-9]*' | head -1 | cut -d':' -f2)
echo ""
echo "✅ Servidor reiniciado correctamente"
echo "   PID: $PID"
echo ""
echo "📋 Para ver logs en tiempo real:"
echo "   pm2 logs aurelinportal"
echo ""
echo "📋 Para verificar estado:"
echo "   pm2 status"
echo ""
echo "🌐 Verificar en /admin/progreso-v4:"
echo "   - Niveles correctos"
echo "   - Fases coherentes"
echo "   - Rachas reales"
echo "   - Pausas visibles"




















