#!/bin/bash
# Script per configurar Zoho Mail via SMTP

echo "📧 Configuració de Zoho Mail per a AurelinPortal"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "Aquest script configurarà Zoho Mail per enviar emails."
echo ""
echo "Requisits:"
echo "  1. Compte de Zoho Mail creat"
echo "  2. Domini afegit a Zoho Mail"
echo "  3. Email creat (ex: eugeni@pdeeugenihidalgo.org)"
echo "  4. Contrasenya d'aplicació generada"
echo ""

read -p "Vols continuar? (s/n): " continuar
if [ "$continuar" != "s" ] && [ "$continuar" != "S" ]; then
    echo "Operació cancel·lada."
    exit 0
fi

echo ""
echo "Introdueix les dades de Zoho Mail:"
echo ""

read -p "Email de Zoho (ex: eugeni@pdeeugenihidalgo.org): " zoho_email
read -sp "Contrasenya d'aplicació de Zoho: " zoho_pass
echo ""

if [ -z "$zoho_email" ] || [ -z "$zoho_pass" ]; then
    echo "❌ Error: Email i contrasenya són obligatoris"
    exit 1
fi

# Actualitzar .env
ENV_FILE="/var/www/aurelinportal/.env"

if [ ! -f "$ENV_FILE" ]; then
    echo "❌ Error: Fitxer .env no trobat"
    exit 1
fi

# Actualitzar variables SMTP
sed -i "s|^SMTP_HOST=.*|SMTP_HOST=smtp.zoho.com|" "$ENV_FILE"
sed -i "s|^SMTP_PORT=.*|SMTP_PORT=587|" "$ENV_FILE"
sed -i "s|^SMTP_SECURE=.*|SMTP_SECURE=false|" "$ENV_FILE"
sed -i "s|^SMTP_USER=.*|SMTP_USER=$zoho_email|" "$ENV_FILE"
sed -i "s|^SMTP_PASS=.*|SMTP_PASS=$zoho_pass|" "$ENV_FILE"
sed -i "s|^SMTP_FROM=.*|SMTP_FROM=$zoho_email|" "$ENV_FILE"

echo ""
echo -e "${GREEN}✅ Configuració actualitzada!${NC}"
echo ""
echo "Configuració SMTP:"
echo "  Host: smtp.zoho.com"
echo "  Port: 587"
echo "  User: $zoho_email"
echo ""
echo "Per provar l'enviament, utilitza el servei de email des del teu codi."
echo ""






