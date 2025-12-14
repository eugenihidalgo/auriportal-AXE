#!/bin/bash
# Script para verificar que la clave SSH coincide exactamente

echo "🔍 Verificación de Clave SSH"
echo "=============================="
echo ""

echo "1️⃣ Clave pública local (Hetzner):"
echo "-----------------------------------"
cat /root/.ssh/id_rsa_eugeni.pub
echo ""

echo "2️⃣ Fingerprint de la clave local:"
echo "-----------------------------------"
ssh-keygen -lf /root/.ssh/id_rsa_eugeni.pub
echo ""

echo "3️⃣ Longitud de la clave (debe ser 758 caracteres):"
echo "-----------------------------------"
cat /root/.ssh/id_rsa_eugeni.pub | wc -c
echo ""

echo "4️⃣ Verificar formato (sin espacios extra):"
echo "-----------------------------------"
cat /root/.ssh/id_rsa_eugeni.pub | cat -A
echo ""

echo "📋 INSTRUCCIONES:"
echo "================"
echo ""
echo "En el servidor dani, ejecuta estos comandos para verificar:"
echo ""
echo "1. Ver la clave en authorized_keys:"
echo "   cat ~/.ssh/authorized_keys | grep 'aurelinportal-to-eugeni'"
echo ""
echo "2. Verificar el fingerprint:"
echo "   ssh-keygen -lf ~/.ssh/authorized_keys | grep 'edqNBQ6bDuNFwZ592rLmM8eScl7G6+2sWr8/GBzjHxI'"
echo ""
echo "3. Verificar que está en una sola línea (sin saltos de línea):"
echo "   cat ~/.ssh/authorized_keys | grep 'aurelinportal' | wc -l"
echo "   # Debe mostrar: 1"
echo ""
echo "4. Verificar formato exacto (sin espacios extra):"
echo "   cat ~/.ssh/authorized_keys | grep 'aurelinportal' | cat -A"
echo "   # No debe haber espacios al inicio o final"
echo ""

