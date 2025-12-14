#!/bin/bash
# Script para descargar el reporte HTML a tu PC
# Ejecuta este script desde tu PC (no desde el servidor)

echo "📥 Descargando reporte HTML de Kajabi..."
echo ""

# Configuración (ajusta según tu servidor)
SERVER="tu-servidor.com"  # Cambia por tu servidor
USER="root"  # Cambia por tu usuario
REMOTE_PATH="/var/www/aurelinportal/kajabi-data-report.html"
LOCAL_PATH="$HOME/Desktop/kajabi-data-report.html"

# Descargar archivo
scp ${USER}@${SERVER}:${REMOTE_PATH} ${LOCAL_PATH}

if [ $? -eq 0 ]; then
    echo "✅ Reporte descargado exitosamente a: ${LOCAL_PATH}"
    echo "📄 Abre el archivo en tu navegador para ver los datos."
    
    # Intentar abrir automáticamente (Linux/Mac)
    if command -v xdg-open &> /dev/null; then
        xdg-open ${LOCAL_PATH} &
    elif command -v open &> /dev/null; then
        open ${LOCAL_PATH} &
    fi
else
    echo "❌ Error al descargar el reporte."
    echo "   Verifica que tengas acceso SSH al servidor."
fi






