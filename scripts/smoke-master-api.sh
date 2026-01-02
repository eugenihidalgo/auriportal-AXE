#!/bin/bash
#
# Smoke Test - MASTER API v1
#
# Script mínimo de smoke test para verificar que las rutas MASTER API básicas
# responden correctamente con JSON válido.
#
# USO:
#   bash scripts/smoke-master-api.sh
#   npm run smoke:master-api (si se añade a package.json)
#
# EXIT CODES:
#   0 = todas las pruebas pasaron
#   1 = alguna prueba falló
#

set -e

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RESET='\033[0m'

# Configuración (ajustar según entorno)
BASE_URL="${BASE_URL:-http://localhost:3000}"

echo ""
echo "🔥 Smoke Test - MASTER API v1"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Base URL: $BASE_URL"
echo ""

ERRORS=0

# Función helper para test
test_endpoint() {
    local method=$1
    local path=$2
    local description=$3
    
    echo "📋 $description"
    echo "   $method $path"
    
    # Realizar request
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "$BASE_URL$path" 2>&1) || {
            echo -e "${RED}   ❌ Error de conexión${RESET}"
            ERRORS=$((ERRORS + 1))
            return
        }
    else
        echo -e "${YELLOW}   ⚠️  Método $method no implementado en smoke test${RESET}"
        return
    fi
    
    # Separar body y status code
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    # Verificar status code
    if [ "$http_code" != "200" ]; then
        echo -e "${RED}   ❌ Status code: $http_code (esperado: 200)${RESET}"
        ERRORS=$((ERRORS + 1))
        return
    fi
    
    # Verificar que es JSON válido (y tiene ok: true)
    if echo "$body" | grep -q '"ok"\s*:\s*true'; then
        echo -e "${GREEN}   ✅ Status 200, JSON válido con ok=true${RESET}"
    elif echo "$body" | python3 -m json.tool > /dev/null 2>&1; then
        echo -e "${YELLOW}   ⚠️  Status 200, JSON válido pero sin 'ok: true'${RESET}"
    else
        echo -e "${RED}   ❌ Response no es JSON válido${RESET}"
        ERRORS=$((ERRORS + 1))
        return
    fi
    
    echo ""
}

# Tests
test_endpoint "GET" "/master/api/tags?status=active&limit=10" "GET /master/api/tags (lista de tags activos)"
test_endpoint "GET" "/master/api/classifications?type=key&status=active&limit=10" "GET /master/api/classifications (lista de categorías activas)"

# Resumen
echo "═══════════════════════════════════════════════════════════"
echo ""
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ TODAS LAS PRUEBAS PASARON${RESET}"
    echo ""
    exit 0
else
    echo -e "${RED}❌ $ERRORS PRUEBA(S) FALLARON${RESET}"
    echo ""
    exit 1
fi
