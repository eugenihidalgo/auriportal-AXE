#!/bin/bash
# ============================================================================
# Script de Configuración Inicial de GitHub - AuriPortal v4.3.0
# ============================================================================
# Este script prepara el repositorio local para conectarse a GitHub
# IMPORTANTE: Lee GIT_WORKFLOW.md antes de ejecutar este script
# ============================================================================

set -e  # Detener si hay errores

echo "🔧 Configurando AuriPortal para GitHub..."
echo ""

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verificar que estamos en el directorio correcto
if [ ! -f "server.js" ]; then
    echo -e "${RED}❌ Error: No estás en el directorio de AuriPortal${NC}"
    echo "   Ejecuta: cd /var/www/aurelinportal"
    exit 1
fi

# Verificar que Git está inicializado
if [ ! -d ".git" ]; then
    echo -e "${RED}❌ Error: Git no está inicializado${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Directorio correcto detectado${NC}"
echo ""

# Paso 1: Verificar estado de Git
echo "📊 Paso 1: Verificando estado del repositorio..."
echo ""

CHANGES=$(git status --porcelain)
if [ -n "$CHANGES" ]; then
    echo -e "${YELLOW}⚠️  Hay cambios sin commitear:${NC}"
    git status --short
    echo ""
    echo "Opciones:"
    echo "  1) Commitear los cambios ahora"
    echo "  2) Descartar los cambios"
    echo "  3) Cancelar y hacerlo manualmente"
    echo ""
    read -p "¿Qué deseas hacer? (1/2/3): " choice
    
    case $choice in
        1)
            git add .
            git commit -m "chore: preparar repo para GitHub (tests y CI configurados)"
            echo -e "${GREEN}✅ Cambios commiteados${NC}"
            ;;
        2)
            echo -e "${YELLOW}⚠️  Descartando cambios...${NC}"
            git restore .
            git clean -fd
            ;;
        3)
            echo "❌ Cancelado. Ejecuta este script después de resolver los cambios."
            exit 0
            ;;
        *)
            echo -e "${RED}❌ Opción inválida${NC}"
            exit 1
            ;;
    esac
else
    echo -e "${GREEN}✅ No hay cambios pendientes${NC}"
fi

echo ""

# Paso 2: Verificar que .env no está siendo rastreado
echo "🔐 Paso 2: Verificando seguridad de secretos..."
echo ""

if git ls-files | grep -q "^\.env$"; then
    echo -e "${RED}❌ ERROR CRÍTICO: .env está siendo rastreado por Git${NC}"
    echo "   Esto es un riesgo de seguridad. El archivo .env contiene secretos."
    echo ""
    echo "   Solución:"
    echo "   1. Verifica que .env está en .gitignore"
    echo "   2. Ejecuta: git rm --cached .env"
    echo "   3. Vuelve a ejecutar este script"
    exit 1
fi

if [ ! -f ".env.example" ]; then
    echo -e "${YELLOW}⚠️  Advertencia: .env.example no existe${NC}"
    echo "   Es recomendable tener un archivo .env.example con placeholders"
else
    echo -e "${GREEN}✅ .env.example existe y es seguro${NC}"
    
    # Verificar que .env.example no contiene secretos reales
    if grep -q "CLICKUP_API_TOKEN=[^<]" .env.example 2>/dev/null || \
       grep -q "PGPASSWORD=[^<]" .env.example 2>/dev/null; then
        echo -e "${YELLOW}⚠️  Advertencia: .env.example puede contener valores reales${NC}"
        echo "   Debe contener solo placeholders como <TOKEN>"
    else
        echo -e "${GREEN}✅ .env.example solo contiene placeholders (seguro)${NC}"
    fi
fi

echo ""

# Paso 3: Renombrar master a main si es necesario
echo "🔄 Paso 3: Verificando nombre de rama principal..."
echo ""

CURRENT_BRANCH=$(git branch --show-current)

if [ "$CURRENT_BRANCH" = "master" ]; then
    echo -e "${YELLOW}📝 Renombrando rama 'master' a 'main'...${NC}"
    git branch -m master main
    echo -e "${GREEN}✅ Rama renombrada a 'main'${NC}"
elif [ "$CURRENT_BRANCH" = "main" ]; then
    echo -e "${GREEN}✅ Ya estás en la rama 'main'${NC}"
else
    echo -e "${YELLOW}⚠️  Estás en la rama '$CURRENT_BRANCH'${NC}"
    echo "   Para continuar, necesitas estar en 'main'"
    read -p "¿Cambiar a main ahora? (s/n): " change_branch
    if [ "$change_branch" = "s" ] || [ "$change_branch" = "S" ]; then
        git checkout -b main 2>/dev/null || git checkout main
        echo -e "${GREEN}✅ Cambiado a rama 'main'${NC}"
    fi
fi

echo ""

# Paso 4: Verificar remoto
echo "🌐 Paso 4: Verificando configuración de remoto..."
echo ""

if git remote | grep -q "^origin$"; then
    REMOTE_URL=$(git remote get-url origin)
    echo -e "${YELLOW}⚠️  Ya existe un remoto 'origin':${NC}"
    echo "   $REMOTE_URL"
    echo ""
    read -p "¿Deseas cambiarlo? (s/n): " change_remote
    if [ "$change_remote" = "s" ] || [ "$change_remote" = "S" ]; then
        read -p "Ingresa la URL de GitHub (ej: https://github.com/USUARIO/auriportal.git): " new_url
        git remote set-url origin "$new_url"
        echo -e "${GREEN}✅ Remoto actualizado${NC}"
    fi
else
    echo -e "${YELLOW}ℹ️  No hay remoto configurado aún${NC}"
    echo ""
    echo "Para añadir el remoto, ejecuta manualmente:"
    echo "  git remote add origin https://github.com/TU_USUARIO/auriportal.git"
    echo ""
    echo "Reemplaza 'TU_USUARIO' con tu nombre de usuario de GitHub"
fi

echo ""

# Paso 5: Resumen y próximos pasos
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ Configuración local completada${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 PRÓXIMOS PASOS:"
echo ""
echo "1. Crear el repositorio en GitHub:"
echo "   - Ve a https://github.com/new"
echo "   - Nombre: auriportal (o el que prefieras)"
echo "   - Visibilidad: ✅ PRIVATE"
echo "   - NO marques ninguna opción (README, .gitignore, license)"
echo "   - Haz clic en 'Create repository'"
echo ""
echo "2. Añadir el remoto (si no lo hiciste antes):"
echo "   git remote add origin https://github.com/TU_USUARIO/auriportal.git"
echo ""
echo "3. Hacer el primer push:"
echo "   git push -u origin main"
echo ""
echo "4. Configurar protecciones de rama en GitHub:"
echo "   - Settings → Branches → Add branch protection rule"
echo "   - Branch: main"
echo "   - Activa: Require PR, Require status checks, Include administrators"
echo "   - (Ver GIT_WORKFLOW.md para detalles)"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📚 Documentación completa: lee GIT_WORKFLOW.md"
echo ""












