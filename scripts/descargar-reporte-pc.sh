#!/bin/bash
# Script para ejecutar DESDE TU PC (no desde el servidor)
# Descarga el reporte HTML generado en el servidor

echo "📥 Descargando reporte HTML de Kajabi..."
echo ""

# Configuración del servidor
SERVER="88.99.173.249"
USER="root"
REMOTE_PATH="/var/www/aurelinportal/kajabi-data-report.html"
LOCAL_PATH="$HOME/Desktop/kajabi-data-report.html"

# Descargar
scp ${USER}@${SERVER}:${REMOTE_PATH} ${LOCAL_PATH}

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ ¡Reporte descargado exitosamente!"
    echo "📄 Ubicación: ${LOCAL_PATH}"
    echo ""
    echo "🌐 Abriendo en tu navegador..."
    
    # Abrir automáticamente según el sistema operativo
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        xdg-open ${LOCAL_PATH} 2>/dev/null || echo "Abre manualmente: ${LOCAL_PATH}"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        open ${LOCAL_PATH}
    elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
        start ${LOCAL_PATH}
    else
        echo "Abre manualmente el archivo: ${LOCAL_PATH}"
    fi
else
    echo ""
    echo "❌ Error al descargar."
    echo "   Verifica que tengas acceso SSH configurado."
    echo "   O copia manualmente con:"
    echo "   scp ${USER}@${SERVER}:${REMOTE_PATH} ~/Desktop/"
fi






