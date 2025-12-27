#!/bin/bash

# Script de Release para AuriPortal
# Uso: ./scripts/release.sh [major|minor|patch]
# Ejemplo: ./scripts/release.sh patch

set -e  # Salir si hay error

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para imprimir mensajes
info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ]; then
    error "No se encontró package.json. Ejecuta este script desde la raíz del proyecto."
    exit 1
fi

# Verificar argumento
if [ -z "$1" ]; then
    error "Debes especificar el tipo de release: major, minor o patch"
    echo ""
    echo "Uso: ./scripts/release.sh [major|minor|patch]"
    echo ""
    echo "Ejemplos:"
    echo "  ./scripts/release.sh patch   # 4.3.0 → 4.3.1"
    echo "  ./scripts/release.sh minor   # 4.3.0 → 4.4.0"
    echo "  ./scripts/release.sh major   # 4.3.0 → 5.0.0"
    exit 1
fi

RELEASE_TYPE=$1

if [[ ! "$RELEASE_TYPE" =~ ^(major|minor|patch)$ ]]; then
    error "Tipo de release inválido: $RELEASE_TYPE"
    error "Debe ser: major, minor o patch"
    exit 1
fi

info "🚀 Iniciando proceso de release ($RELEASE_TYPE)"

# 1. Verificar que estamos en main
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
    error "Debes estar en la rama 'main' para hacer un release"
    error "Rama actual: $CURRENT_BRANCH"
    info "Ejecuta: git checkout main"
    exit 1
fi
success "Estás en la rama main"

# 2. Verificar que no hay cambios sin commitear
if [ -n "$(git status --porcelain)" ]; then
    error "Hay cambios sin commitear. Por favor, commitea o descarta los cambios primero."
    git status
    exit 1
fi
success "No hay cambios sin commitear"

# 3. Actualizar main desde remoto
info "Actualizando desde remoto..."
git pull origin main || {
    warning "No se pudo hacer pull. Continuando..."
}

# 4. Obtener versión actual
CURRENT_VERSION=$(node -p "require('./package.json').version")
info "Versión actual: v$CURRENT_VERSION"

# 5. Calcular nueva versión
IFS='.' read -ra VERSION_PARTS <<< "$CURRENT_VERSION"
MAJOR=${VERSION_PARTS[0]}
MINOR=${VERSION_PARTS[1]}
PATCH=${VERSION_PARTS[2]}

case $RELEASE_TYPE in
    major)
        MAJOR=$((MAJOR + 1))
        MINOR=0
        PATCH=0
        ;;
    minor)
        MINOR=$((MINOR + 1))
        PATCH=0
        ;;
    patch)
        PATCH=$((PATCH + 1))
        ;;
esac

NEW_VERSION="$MAJOR.$MINOR.$PATCH"
info "Nueva versión: v$NEW_VERSION"

# 6. Verificar que el tag no existe
if git rev-parse "v$NEW_VERSION" >/dev/null 2>&1; then
    error "El tag v$NEW_VERSION ya existe"
    exit 1
fi
success "El tag v$NEW_VERSION no existe"

# 7. Ejecutar tests (opcional pero recomendado)
info "¿Deseas ejecutar los tests antes del release? (s/n)"
read -r RUN_TESTS
if [[ "$RUN_TESTS" =~ ^[Ss]$ ]]; then
    info "Ejecutando tests..."
    npm test || {
        error "Los tests fallaron. ¿Deseas continuar de todas formas? (s/n)"
        read -r CONTINUE
        if [[ ! "$CONTINUE" =~ ^[Ss]$ ]]; then
            exit 1
        fi
    }
    success "Tests pasaron"
fi

# 8. Actualizar package.json
info "Actualizando package.json..."
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.version = '$NEW_VERSION';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"
success "package.json actualizado a v$NEW_VERSION"

# 9. Actualizar CHANGELOG.md
info "Actualizando CHANGELOG.md..."
if [ ! -f "CHANGELOG.md" ]; then
    warning "CHANGELOG.md no existe. Creándolo..."
    cat > CHANGELOG.md << 'EOF'
# Changelog

Todos los cambios notables de este proyecto serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/lang/es/).

## [Unreleased]

EOF
fi

# Añadir nueva sección al CHANGELOG
TODAY=$(date +%Y-%m-%d)
CHANGELOG_ENTRY="## [$NEW_VERSION] - $TODAY

### Added
- (Añade nuevas funcionalidades aquí)

### Changed
- (Añade cambios aquí)

### Fixed
- (Añade correcciones aquí)

"

# Insertar después de "## [Unreleased]"
if grep -q "## \[Unreleased\]" CHANGELOG.md; then
    sed -i "/## \[Unreleased\]/a\\n$CHANGELOG_ENTRY" CHANGELOG.md
else
    # Si no existe [Unreleased], añadir al principio
    echo -e "$CHANGELOG_ENTRY\n$(cat CHANGELOG.md)" > CHANGELOG.md
fi

success "CHANGELOG.md actualizado"

# 10. Mostrar resumen de cambios
info "Resumen de cambios desde último tag:"
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
if [ -n "$LAST_TAG" ]; then
    git log "$LAST_TAG"..HEAD --oneline
else
    git log --oneline -10
fi

echo ""
info "¿Deseas continuar con el release? (s/n)"
read -r CONFIRM
if [[ ! "$CONFIRM" =~ ^[Ss]$ ]]; then
    warning "Release cancelado"
    git restore package.json CHANGELOG.md 2>/dev/null || true
    exit 0
fi

# 11. Commit de release
info "Creando commit de release..."
git add package.json CHANGELOG.md
git commit -m "chore: release v$NEW_VERSION" || {
    error "No se pudo crear el commit"
    exit 1
}
success "Commit de release creado"

# 12. Crear tag
info "Creando tag v$NEW_VERSION..."
git tag -a "v$NEW_VERSION" -m "Release v$NEW_VERSION" || {
    error "No se pudo crear el tag"
    exit 1
}
success "Tag v$NEW_VERSION creado"

# 13. Push a GitHub
info "¿Deseas hacer push a GitHub ahora? (s/n)"
read -r PUSH_NOW
if [[ "$PUSH_NOW" =~ ^[Ss]$ ]]; then
    info "Haciendo push de main..."
    git push origin main || {
        error "No se pudo hacer push de main"
        exit 1
    }
    success "Push de main completado"
    
    info "Haciendo push del tag..."
    git push origin "v$NEW_VERSION" || {
        error "No se pudo hacer push del tag"
        exit 1
    }
    success "Push del tag completado"
    
    success "🎉 Release v$NEW_VERSION publicado en GitHub"
else
    warning "No se hizo push. Ejecuta manualmente:"
    echo "  git push origin main"
    echo "  git push origin v$NEW_VERSION"
fi

# 14. Resumen final
echo ""
success "════════════════════════════════════════"
success "🎉 Release v$NEW_VERSION completado"
success "════════════════════════════════════════"
echo ""
info "Próximos pasos:"
echo "  1. Revisa el CHANGELOG.md y completa los cambios"
echo "  2. Si no hiciste push, ejecuta:"
echo "     git push origin main"
echo "     git push origin v$NEW_VERSION"
echo "  3. En el servidor, deploya la nueva versión:"
echo "     git fetch --tags"
echo "     git checkout v$NEW_VERSION"
echo "     npm install"
echo "     npm run pm2:restart"
echo ""
info "Ver documentación completa en: VERSIONADO_Y_RELEASES.md"




















