#!/bin/bash
# Script per configurar tots els emails de Zoho Mail

echo "📧 Configuració Completa de Zoho Mail"
echo "======================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

ENV_FILE="/var/www/aurelinportal/.env"

if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}❌ Error: Fitxer .env no trobat a $ENV_FILE${NC}"
    exit 1
fi

echo "Aquest script configurarà Zoho Mail per a 4 emails:"
echo "  1. master@vegasquestfantasticworld.win"
echo "  2. eugeni@eugenihidalgo.org"
echo "  3. elcalordelalma@eugenihidalgo.org"
echo "  4. bennascut@eugenihidalgo.org"
echo ""
echo "Requisits:"
echo "  - Comptes creats a Zoho Mail"
echo "  - Contrasenyes d'aplicació generades"
echo ""

read -p "Vols continuar? (s/n): " continuar
if [ "$continuar" != "s" ] && [ "$continuar" != "S" ]; then
    echo "Operació cancel·lada."
    exit 0
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Configuració SMTP Zoho"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Configuració SMTP base
sed -i "s|^SMTP_HOST=.*|SMTP_HOST=smtp.zoho.com|" "$ENV_FILE"
sed -i "s|^SMTP_PORT=.*|SMTP_PORT=587|" "$ENV_FILE"
sed -i "s|^SMTP_SECURE=.*|SMTP_SECURE=false|" "$ENV_FILE"

echo "Introdueix les contrasenyes d'aplicació de Zoho:"
echo ""

# Email principal (eugeni)
read -sp "Contrasenya d'aplicació per eugeni@eugenihidalgo.org: " pass_eugeni
echo ""
if [ -z "$pass_eugeni" ]; then
    echo -e "${RED}❌ Error: Contrasenya obligatòria${NC}"
    exit 1
fi

sed -i "s|^SMTP_USER=.*|SMTP_USER=eugeni@eugenihidalgo.org|" "$ENV_FILE"
sed -i "s|^SMTP_PASS=.*|SMTP_PASS=$pass_eugeni|" "$ENV_FILE"
sed -i "s|^SMTP_FROM=.*|SMTP_FROM=eugeni@eugenihidalgo.org|" "$ENV_FILE"

# Altres emails
read -sp "Contrasenya d'aplicació per master@vegasquestfantasticworld.win: " pass_master
echo ""
read -sp "Contrasenya d'aplicació per elcalordelalma@eugenihidalgo.org: " pass_elcalor
echo ""
read -sp "Contrasenya d'aplicació per bennascut@eugenihidalgo.org: " pass_bennascut
echo ""

# Afegir variables per altres emails (si no existeixen)
if ! grep -q "^ZOHO_MASTER_EMAIL=" "$ENV_FILE"; then
    echo "" >> "$ENV_FILE"
    echo "# Altres emails Zoho" >> "$ENV_FILE"
fi

# Actualitzar o afegir variables
if grep -q "^ZOHO_MASTER_EMAIL=" "$ENV_FILE"; then
    sed -i "s|^ZOHO_MASTER_EMAIL=.*|ZOHO_MASTER_EMAIL=master@vegasquestfantasticworld.win|" "$ENV_FILE"
else
    echo "ZOHO_MASTER_EMAIL=master@vegasquestfantasticworld.win" >> "$ENV_FILE"
fi

if grep -q "^ZOHO_MASTER_PASS=" "$ENV_FILE"; then
    sed -i "s|^ZOHO_MASTER_PASS=.*|ZOHO_MASTER_PASS=$pass_master|" "$ENV_FILE"
else
    echo "ZOHO_MASTER_PASS=$pass_master" >> "$ENV_FILE"
fi

if grep -q "^ZOHO_ELCALOR_EMAIL=" "$ENV_FILE"; then
    sed -i "s|^ZOHO_ELCALOR_EMAIL=.*|ZOHO_ELCALOR_EMAIL=elcalordelalma@eugenihidalgo.org|" "$ENV_FILE"
else
    echo "ZOHO_ELCALOR_EMAIL=elcalordelalma@eugenihidalgo.org" >> "$ENV_FILE"
fi

if grep -q "^ZOHO_ELCALOR_PASS=" "$ENV_FILE"; then
    sed -i "s|^ZOHO_ELCALOR_PASS=.*|ZOHO_ELCALOR_PASS=$pass_elcalor|" "$ENV_FILE"
else
    echo "ZOHO_ELCALOR_PASS=$pass_elcalor" >> "$ENV_FILE"
fi

if grep -q "^ZOHO_BENNASCUT_EMAIL=" "$ENV_FILE"; then
    sed -i "s|^ZOHO_BENNASCUT_EMAIL=.*|ZOHO_BENNASCUT_EMAIL=bennascut@eugenihidalgo.org|" "$ENV_FILE"
else
    echo "ZOHO_BENNASCUT_EMAIL=bennascut@eugenihidalgo.org" >> "$ENV_FILE"
fi

if grep -q "^ZOHO_BENNASCUT_PASS=" "$ENV_FILE"; then
    sed -i "s|^ZOHO_BENNASCUT_PASS=.*|ZOHO_BENNASCUT_PASS=$pass_bennascut|" "$ENV_FILE"
else
    echo "ZOHO_BENNASCUT_PASS=$pass_bennascut" >> "$ENV_FILE"
fi

echo ""
echo -e "${GREEN}✅ Configuració completada!${NC}"
echo ""
echo "Configuració SMTP:"
echo "  Host: smtp.zoho.com"
echo "  Port: 587"
echo "  User principal: eugeni@eugenihidalgo.org"
echo ""
echo "Emails configurats:"
echo "  ✅ master@vegasquestfantasticworld.win"
echo "  ✅ eugeni@eugenihidalgo.org"
echo "  ✅ elcalordelalma@eugenihidalgo.org"
echo "  ✅ bennascut@eugenihidalgo.org"
echo ""
echo "Per provar l'enviament, utilitza el servei de email des del teu codi."
echo ""
echo -e "${YELLOW}⚠️  Recorda: Assegura't que els dominis estan configurats a Zoho Mail i DNS a Cloudflare${NC}"
echo ""






