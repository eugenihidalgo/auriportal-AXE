#!/bin/bash
# Script para completar la configuración después de obtener el refresh token

echo "🔧 Completando configuración del Google Worker..."

# Solicitar el refresh token
read -p "Pega el refresh_token que obtuviste: " REFRESH_TOKEN

if [ -z "$REFRESH_TOKEN" ]; then
    echo "❌ No se proporcionó refresh_token"
    exit 1
fi

# Añadir al .env
echo ""
echo "📝 Añadiendo token al .env..."
cd /var/www/aurelinportal

# Verificar si .env existe
if [ ! -f .env ]; then
    echo "⚠️  Archivo .env no encontrado. Creando uno nuevo..."
    touch .env
fi

# Añadir o actualizar la variable
if grep -q "GOOGLE_APPS_SCRIPT_REFRESH_TOKEN" .env; then
    # Actualizar existente
    sed -i "s|GOOGLE_APPS_SCRIPT_REFRESH_TOKEN=.*|GOOGLE_APPS_SCRIPT_REFRESH_TOKEN=$REFRESH_TOKEN|" .env
    echo "✅ Token actualizado en .env"
else
    # Añadir nuevo
    echo "" >> .env
    echo "# Google Apps Script API" >> .env
    echo "GOOGLE_APPS_SCRIPT_REFRESH_TOKEN=$REFRESH_TOKEN" >> .env
    echo "✅ Token añadido a .env"
fi

# Exportar para uso inmediato
export GOOGLE_APPS_SCRIPT_REFRESH_TOKEN=$REFRESH_TOKEN

echo ""
echo "🚀 Subiendo archivos a Google Apps Script..."
cd /var/www/aurelinportal/google-worker
node subir-archivos.js


























