#!/bin/bash

# Script para verificar y configurar SSH para Cursor
# Ejecutar este script en tu PC LOCAL (no en el servidor)

echo "🔍 Verificando configuración SSH para Cursor..."
echo ""

# Verificar si existe ~/.ssh/config
if [ -f ~/.ssh/config ]; then
    echo "✅ Archivo ~/.ssh/config encontrado"
    echo ""
    echo "📄 Contenido actual:"
    echo "---"
    cat ~/.ssh/config
    echo "---"
    echo ""
else
    echo "⚠️  Archivo ~/.ssh/config no existe"
    echo "   Se creará uno nuevo cuando configures Cursor"
    echo ""
fi

# Verificar Tailscale
echo "🔍 Verificando Tailscale..."
if command -v tailscale &> /dev/null; then
    echo "✅ Tailscale está instalado"
    echo ""
    echo "📡 Máquinas disponibles en tu red Tailscale:"
    tailscale status 2>/dev/null || echo "   (Ejecuta 'tailscale status' para ver las máquinas)"
    echo ""
else
    echo "⚠️  Tailscale no encontrado en PATH"
    echo "   (Pero si puedes conectarte por SSH, Tailscale está funcionando)"
    echo ""
fi

# Verificar conexión SSH
echo "🔍 ¿Cómo te conectas normalmente al servidor?"
echo ""
echo "   Ejemplos comunes:"
echo "   - ssh usuario@nombre-maquina-tailscale"
echo "   - ssh usuario@100.x.x.x"
echo "   - ssh servidor-amigo"
echo ""
echo "💡 Anota exactamente cómo te conectas para configurarlo en Cursor"
echo ""

# Verificar si hay claves SSH
echo "🔑 Verificando claves SSH..."
if [ -f ~/.ssh/id_rsa ] || [ -f ~/.ssh/id_ed25519 ]; then
    echo "✅ Claves SSH encontradas"
    ls -la ~/.ssh/id_* 2>/dev/null | grep -v ".pub"
else
    echo "⚠️  No se encontraron claves SSH privadas"
    echo "   (Puedes usar contraseña o generar una clave)"
fi
echo ""

echo "📝 Próximos pasos:"
echo "   1. Abre Cursor"
echo "   2. Presiona F1 (o Ctrl+Shift+P)"
echo "   3. Escribe: 'Remote-SSH: Connect to Host'"
echo "   4. Si ves tu servidor en la lista, selecciónalo"
echo "   5. Si no aparece, elige 'Add New SSH Host'"
echo "   6. Ingresa exactamente como te conectas normalmente"
echo ""





