#!/bin/bash
# Script para configurar SSL/HTTPS para AuriPortal
# Ejecutar después de configurar DNS

set -e

echo "🔒 Configurando SSL/HTTPS para AuriPortal"
echo ""

# Verificar que certbot esté instalado
if ! command -v certbot &> /dev/null; then
    echo "❌ Certbot no está instalado. Instalando..."
    apt-get update
    apt-get install -y certbot python3-certbot-nginx
fi

# Verificar que nginx esté corriendo
if ! systemctl is-active --quiet nginx; then
    echo "❌ Nginx no está corriendo. Iniciando..."
    systemctl start nginx
fi

# Verificar DNS antes de continuar
echo "🔍 Verificando DNS..."
DOMAINS=("pdeeugenihidalgo.org" "www.pdeeugenihidalgo.org" "portal.pdeeugenihidalgo.org")
SERVER_IP="88.99.173.249"
DNS_OK=true

for domain in "${DOMAINS[@]}"; do
    RESOLVED_IP=$(dig +short $domain | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' | head -1)
    if [ "$RESOLVED_IP" != "$SERVER_IP" ]; then
        echo "⚠️  $domain no apunta a $SERVER_IP (resuelve a: ${RESOLVED_IP:-ninguna})"
        DNS_OK=false
    else
        echo "✅ $domain → $RESOLVED_IP"
    fi
done

if [ "$DNS_OK" = false ]; then
    echo ""
    echo "❌ DNS no está configurado correctamente."
    echo "Por favor, configura estos registros DNS:"
    echo ""
    for domain in "${DOMAINS[@]}"; do
        echo "  $domain  A  $SERVER_IP"
    done
    echo ""
    echo "Espera a que DNS se propague (puede tardar minutos a horas) y ejecuta este script nuevamente."
    exit 1
fi

echo ""
echo "✅ DNS verificado correctamente"
echo ""

# Solicitar email
if [ -z "$1" ]; then
    echo "Por favor, proporciona un email para notificaciones de renovación:"
    echo "Uso: $0 tu-email@ejemplo.com"
    exit 1
fi

EMAIL="$1"

echo "📧 Email: $EMAIL"
echo "🌐 Dominios: ${DOMAINS[*]}"
echo ""
echo "Obteniendo certificados SSL..."
echo ""

# Obtener certificados
certbot --nginx \
    -d pdeeugenihidalgo.org \
    -d www.pdeeugenihidalgo.org \
    -d portal.pdeeugenihidalgo.org \
    --non-interactive \
    --agree-tos \
    --email "$EMAIL" \
    --redirect

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Certificados SSL obtenidos exitosamente!"
    echo ""
    echo "🔍 Verificando configuración..."
    nginx -t
    
    echo ""
    echo "🔄 Recargando Nginx..."
    systemctl reload nginx
    
    echo ""
    echo "✅ SSL configurado correctamente!"
    echo ""
    echo "📋 Verificar certificados:"
    echo "   sudo certbot certificates"
    echo ""
    echo "🌐 Probar HTTPS:"
    echo "   curl -I https://pdeeugenihidalgo.org"
    echo ""
    echo "🔄 La renovación automática está configurada."
else
    echo ""
    echo "❌ Error obteniendo certificados SSL"
    echo "Revisa los logs: /var/log/letsencrypt/letsencrypt.log"
    exit 1
fi









