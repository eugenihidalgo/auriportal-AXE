#!/bin/bash
# Script per obtenir refresh token manualment

echo "🔐 Obtenir Refresh Token de Zoho (Mètode Manual)"
echo "=================================================="
echo ""

CLIENT_ID="1000.NOSOBATKRVURJKM2O5YOQ1IZSTNV3R"
CLIENT_SECRET="cd49fff0d2715fa7facb4053fdc4334c36ffa7f8c4"
# URI configurada a Zoho
REDIRECT_URI="http://localhost:3001/oauth/callback"

echo "⚠️  IMPORTANT: Abans de continuar, afegeix aquesta URI a Zoho API Console:"
echo "   URI: ${REDIRECT_URI}"
echo ""
echo "   Passos:"
echo "   1. Anar a https://api-console.zoho.com/"
echo "   2. Clicar a la teva aplicació 'AurelinPortal Email'"
echo "   3. Buscar 'Authorized Redirect URIs'"
echo "   4. Afegir: ${REDIRECT_URI}"
echo "   5. Guardar"
echo ""
read -p "Prem Enter quan hagis afegit l'URI a Zoho..."
echo ""
echo "1. Obre aquesta URL al teu navegador:"
echo ""
echo "https://accounts.zoho.com/oauth/v2/auth?client_id=${CLIENT_ID}&response_type=code&access_type=offline&redirect_uri=${REDIRECT_URI}&scope=ZohoMail.accounts.READ&prompt=consent"
echo ""
echo "2. Autoritza l'aplicació"
echo "3. Després d'autoritzar, Zoho et mostrarà el CODE directament a la pàgina"
echo "   (No et redirigirà, el code apareixerà a la pantalla)"
echo ""
echo "4. Copia el 'code' que et mostra Zoho"
echo ""
read -p "Introdueix el code que has copiat: " CODE

if [ -z "$CODE" ]; then
    echo "❌ Error: Code no pot estar buit"
    exit 1
fi

echo ""
echo "🔄 Intercanviant code per refresh token..."
echo ""

RESPONSE=$(curl -s -X POST https://accounts.zoho.com/oauth/v2/token \
  -d "grant_type=authorization_code" \
  -d "client_id=${CLIENT_ID}" \
  -d "client_secret=${CLIENT_SECRET}" \
  -d "redirect_uri=${REDIRECT_URI}" \
  -d "code=${CODE}")

# Verificar si hi ha error
if echo "$RESPONSE" | grep -q '"error"'; then
    echo "❌ Error obtingut:"
    echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
    exit 1
fi

# Extreure refresh_token
REFRESH_TOKEN=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('refresh_token', ''))" 2>/dev/null)

if [ -z "$REFRESH_TOKEN" ]; then
    echo "❌ No s'ha pogut obtenir refresh_token. Resposta completa:"
    echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
    exit 1
fi

echo "✅ Refresh Token obtingut!"
echo ""
echo "Afegeix aquesta línia al .env:"
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
fi

echo ""
echo "✅ Completat!"

