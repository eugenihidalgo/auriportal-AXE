#!/bin/bash
# Script per obtenir refresh token quan ja tens el code

CLIENT_ID="1000.NOSOBATKRVURJKM2O5YOQ1IZSTNV3R"
CLIENT_SECRET="cd49fff0d2715fa7facb4053fdc4334c36ffa7f8c4"
REDIRECT_URI="http://localhost:3001/oauth/callback"

if [ -z "$1" ]; then
    echo "❌ Error: Has de proporcionar el code com a argument"
    echo ""
    echo "Ús: $0 EL_CODE_OBTINGUT"
    echo ""
    echo "Exemple:"
    echo "  $0 1000.xxxxx.xxxxx.xxxxx"
    exit 1
fi

CODE="$1"

echo "🔄 Intercanviant code per refresh token..."
echo ""

# Usar endpoint EU si el compte és europeu
ZOHO_ENDPOINT="https://accounts.zoho.eu/oauth/v2/token"

RESPONSE=$(curl -s -X POST "${ZOHO_ENDPOINT}" \
  -d "grant_type=authorization_code" \
  -d "client_id=${CLIENT_ID}" \
  -d "client_secret=${CLIENT_SECRET}" \
  -d "redirect_uri=${REDIRECT_URI}" \
  -d "code=${CODE}")

# Mostrar resposta completa per debug
echo "Resposta de Zoho:"
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
echo ""

# Verificar si hi ha error
if echo "$RESPONSE" | grep -q '"error"'; then
    echo "❌ Error obtingut de Zoho"
    exit 1
fi

# Extreure refresh_token
REFRESH_TOKEN=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('refresh_token', ''))" 2>/dev/null)

if [ -z "$REFRESH_TOKEN" ]; then
    echo "❌ No s'ha pogut obtenir refresh_token de la resposta"
    exit 1
fi

echo "✅ Refresh Token obtingut!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Afegeix aquesta línia al .env:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "ZOHO_REFRESH_TOKEN=${REFRESH_TOKEN}"
echo ""

# Preguntar si vol afegir-lo automàticament
read -p "Vols afegir-lo automàticament al .env? (s/n): " afegir

if [ "$afegir" = "s" ] || [ "$afegir" = "S" ]; then
    ENV_FILE="/var/www/aurelinportal/.env"
    
    # Actualitzar o afegir
    if grep -q "^ZOHO_REFRESH_TOKEN=" "$ENV_FILE"; then
        sed -i "s|^ZOHO_REFRESH_TOKEN=.*|ZOHO_REFRESH_TOKEN=${REFRESH_TOKEN}|" "$ENV_FILE"
        echo "✅ Actualitzat al .env"
    else
        echo "ZOHO_REFRESH_TOKEN=${REFRESH_TOKEN}" >> "$ENV_FILE"
        echo "✅ Afegit al .env"
    fi
    
    echo ""
    echo "Verificació:"
    grep "^ZOHO_REFRESH_TOKEN=" "$ENV_FILE"
fi

echo ""
echo "✅ Completat!"

