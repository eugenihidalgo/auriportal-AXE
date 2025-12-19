#!/bin/bash
# Script para hacer push a GitHub de AXE v0.5

set -e

cd /var/www/aurelinportal

echo "🚀 Preparando push a GitHub..."

# Verificar que estamos en master
CURRENT_BRANCH=$(git branch --show-current)
echo "📍 Rama actual: $CURRENT_BRANCH"

# Verificar que el commit existe
if ! git rev-parse --verify HEAD >/dev/null 2>&1; then
    echo "❌ Error: No hay commits en la rama actual"
    exit 1
fi

# Verificar que el tag existe
if ! git rev-parse --verify v5.4.0 >/dev/null 2>&1; then
    echo "❌ Error: El tag v5.4.0 no existe"
    exit 1
fi

echo "✅ Commit y tag verificados"

# Verificar si hay remote configurado
if git remote get-url origin >/dev/null 2>&1; then
    REMOTE_URL=$(git remote get-url origin)
    echo "✅ Remote configurado: $REMOTE_URL"
    
    # Intentar push
    echo "📤 Haciendo push de la rama $CURRENT_BRANCH..."
    git push -u origin $CURRENT_BRANCH || {
        echo "⚠️  Error al hacer push de la rama. Verificando permisos..."
        exit 1
    }
    
    echo "📤 Haciendo push del tag v5.4.0..."
    git push origin v5.4.0 || {
        echo "⚠️  Error al hacer push del tag"
        exit 1
    }
    
    echo "✅ Push completado exitosamente"
    echo ""
    echo "🔗 Verifica en GitHub:"
    echo "   - Commit: $(git rev-parse --short HEAD)"
    echo "   - Tag: v5.4.0"
    echo "   - Remote: $REMOTE_URL"
    
else
    echo "⚠️  No hay remote 'origin' configurado"
    echo ""
    echo "Para configurar el remote, ejecuta:"
    echo "  git remote add origin https://github.com/TU_USUARIO/auriportal.git"
    echo ""
    echo "Luego ejecuta este script nuevamente o:"
    echo "  git push -u origin $CURRENT_BRANCH"
    echo "  git push origin v5.4.0"
    exit 1
fi




