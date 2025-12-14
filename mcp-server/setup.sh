#!/bin/bash
# Script de setup para el servidor MCP de AuriPortal

set -e

echo "🚀 Configurando servidor MCP para AuriPortal..."

# Crear entorno virtual si no existe
if [ ! -d "venv" ]; then
    echo "📦 Creando entorno virtual..."
    python3 -m venv venv
fi

# Activar entorno virtual
echo "🔧 Activando entorno virtual..."
source venv/bin/activate

# Instalar dependencias (si las hay)
if [ -f "requirements.txt" ]; then
    echo "📥 Instalando dependencias..."
    pip install -r requirements.txt
fi

# Hacer el script ejecutable
chmod +x server.py

echo "✅ Setup completado!"
echo ""
echo "Para usar el servidor MCP, añade esta configuración a tu Cursor:"
echo ""
echo '{'
echo '  "mcpServers": {'
echo '    "aurelinportal-server": {'
echo '      "command": "ssh",'
echo '      "args": ['
echo '        "-o", "StrictHostKeyChecking=no",'
echo '        "-o", "UserKnownHostsFile=/dev/null",'
echo '        "TU_USUARIO@TU_IP",'
echo '        "-p", "22",'
echo '        "cd /var/www/aurelinportal/mcp-server && source venv/bin/activate && python3 server.py"'
echo '      ],'
echo '      "description": "Servidor MCP para gestionar recursos de AuriPortal (archivos, servicios, PM2, Nginx)"'
echo '    }'
echo '  }'
echo '}'

