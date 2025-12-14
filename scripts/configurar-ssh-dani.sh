#!/bin/bash
# Script para configurar SSH con el servidor "dani" vía Tailscale

echo "🔐 Configurando SSH para servidor 'dani' vía Tailscale..."
echo ""

# Verificar que Tailscale está funcionando
if ! ping -c 1 DESKTOP-ON51NHF &>/dev/null; then
    echo "⚠️  No se puede hacer ping a DESKTOP-ON51NHF"
    echo "   Verifica que Tailscale esté funcionando: tailscale status"
    exit 1
fi

echo "✅ Tailscale conectado a DESKTOP-ON51NHF"
echo ""

# Verificar si existe clave SSH
if [ -f ~/.ssh/id_rsa_eugeni ]; then
    echo "📋 Clave SSH encontrada: ~/.ssh/id_rsa_eugeni"
    echo ""
    echo "🔑 Clave pública (cópiala y agrégala al servidor dani):"
    echo "---"
    cat ~/.ssh/id_rsa_eugeni.pub
    echo "---"
    echo ""
    echo "📝 Para agregar esta clave al servidor dani:"
    echo "   1. Conéctate al servidor dani: ssh usuari@DESKTOP-ON51NHF"
    echo "   2. Ejecuta: mkdir -p ~/.ssh && chmod 700 ~/.ssh"
    echo "   3. Agrega la clave pública a: ~/.ssh/authorized_keys"
    echo "   4. O usa: ssh-copy-id -i ~/.ssh/id_rsa_eugeni.pub usuari@DESKTOP-ON51NHF"
    echo ""
    echo "🔧 Variables a agregar en .env:"
    echo "   SSH_DANI_TAILSCALE_HOST=DESKTOP-ON51NHF"
    echo "   SSH_DANI_KEY_PATH=/root/.ssh/id_rsa_eugeni"
    echo "   SSH_DANI_USER=usuari"
    echo "   SSH_DANI_PORT=22"
else
    echo "⚠️  No se encontró clave SSH. Generando nueva..."
    ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_dani -N "" -C "clave-para-dani-$(date +%Y%m%d)"
    chmod 600 ~/.ssh/id_ed25519_dani
    chmod 644 ~/.ssh/id_ed25519_dani.pub
    echo ""
    echo "✅ Clave generada: ~/.ssh/id_ed25519_dani"
    echo ""
    echo "🔑 Clave pública (cópiala y agrégala al servidor dani):"
    echo "---"
    cat ~/.ssh/id_ed25519_dani.pub
    echo "---"
    echo ""
    echo "🔧 Variables a agregar en .env:"
    echo "   SSH_DANI_TAILSCALE_HOST=DESKTOP-ON51NHF"
    echo "   SSH_DANI_KEY_PATH=/root/.ssh/id_ed25519_dani"
    echo "   SSH_DANI_USER=usuari"
    echo "   SSH_DANI_PORT=22"
fi

echo ""
echo "📋 Después de agregar la clave al servidor dani, prueba:"
echo "   ssh -i ~/.ssh/id_rsa_eugeni usuari@DESKTOP-ON51NHF 'echo OK'"

