#!/bin/bash
# Script de verificación de implementación Sprint 2B: Runtime de Recorridos

echo "🔍 Verificando implementación Sprint 2B: Runtime de Recorridos"
echo ""

# Verificar archivos creados
echo "📁 Verificando archivos creados..."

MIGRATION_FILE="database/migrations/v5.2.0-create-recorrido-runtime.sql"
if [ -f "$MIGRATION_FILE" ]; then
    echo "  ✅ Migración: $MIGRATION_FILE"
else
    echo "  ❌ FALTA: $MIGRATION_FILE"
fi

RUNTIME_FILE="src/core/recorridos/runtime/recorrido-runtime.js"
if [ -f "$RUNTIME_FILE" ]; then
    echo "  ✅ Motor Runtime: $RUNTIME_FILE"
else
    echo "  ❌ FALTA: $RUNTIME_FILE"
fi

ENDPOINT_FILE="src/endpoints/recorridos-runtime.js"
if [ -f "$ENDPOINT_FILE" ]; then
    echo "  ✅ Endpoints: $ENDPOINT_FILE"
else
    echo "  ❌ FALTA: $ENDPOINT_FILE"
fi

# Verificar repositorios
REPO_FILES=(
    "src/core/repos/recorrido-run-repo.js"
    "src/core/repos/recorrido-step-result-repo.js"
    "src/core/repos/recorrido-event-repo.js"
    "src/infra/repos/recorrido-run-repo-pg.js"
    "src/infra/repos/recorrido-step-result-repo-pg.js"
    "src/infra/repos/recorrido-event-repo-pg.js"
)

echo ""
echo "📦 Verificando repositorios..."
for file in "${REPO_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✅ $(basename $file)"
    else
        echo "  ❌ FALTA: $file"
    fi
done

# Verificar feature flag
echo ""
echo "🚩 Verificando feature flag..."
if grep -q "recorridos_runtime_v1" src/core/flags/feature-flags.js; then
    echo "  ✅ Feature flag 'recorridos_runtime_v1' encontrado"
    grep "recorridos_runtime_v1" src/core/flags/feature-flags.js | head -1
else
    echo "  ❌ Feature flag no encontrado"
fi

# Verificar rutas en router
echo ""
echo "🛣️  Verificando rutas en router..."
if grep -q "/api/recorridos" src/router.js; then
    echo "  ✅ Ruta /api/recorridos/* encontrada en router"
else
    echo "  ❌ Ruta no encontrada en router"
fi

# Verificar tests
echo ""
echo "🧪 Verificando tests..."
if [ -f "tests/recorridos/runtime.test.js" ]; then
    echo "  ✅ Tests: tests/recorridos/runtime.test.js"
else
    echo "  ❌ FALTA: tests/recorridos/runtime.test.js"
fi

# Verificar documentación
echo ""
echo "📚 Verificando documentación..."
if [ -f "docs/SPRINT_2B_RUNTIME_RECORRIDOS.md" ]; then
    echo "  ✅ Documentación: docs/SPRINT_2B_RUNTIME_RECORRIDOS.md"
else
    echo "  ❌ FALTA: docs/SPRINT_2B_RUNTIME_RECORRIDOS.md"
fi

# Verificar sintaxis JavaScript
echo ""
echo "🔧 Verificando sintaxis JavaScript..."
if node -c src/core/recorridos/runtime/recorrido-runtime.js 2>/dev/null; then
    echo "  ✅ Sintaxis correcta: recorrido-runtime.js"
else
    echo "  ❌ Error de sintaxis en recorrido-runtime.js"
fi

if node -c src/endpoints/recorridos-runtime.js 2>/dev/null; then
    echo "  ✅ Sintaxis correcta: recorridos-runtime.js"
else
    echo "  ❌ Error de sintaxis en recorridos-runtime.js"
fi

# Verificar migración en sistema automático
echo ""
echo "🔄 Verificando migración en sistema automático..."
if grep -q "v5.2.0-create-recorrido-runtime" database/pg.js; then
    echo "  ✅ Migración v5.2.0 añadida al sistema automático"
else
    echo "  ❌ Migración no añadida al sistema automático"
fi

echo ""
echo "✅ Verificación completada"
echo ""
echo "📝 Próximos pasos:"
echo "  1. Reiniciar el servidor (la migración se aplicará automáticamente)"
echo "  2. Verificar tablas en PostgreSQL: \\dt recorrido_*"
echo "  3. Probar endpoints con curl (ver docs/SPRINT_2B_RUNTIME_RECORRIDOS.md)"





