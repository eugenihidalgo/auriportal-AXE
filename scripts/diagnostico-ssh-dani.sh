#!/bin/bash
# Script de diagnóstico para conexión SSH con servidor "dani"

echo "🔍 ============================================"
echo "🔍 DIAGNÓSTICO SSH - SERVIDOR DANI"
echo "🔍 ============================================"
echo ""

# 1. Verificar Tailscale
echo "1️⃣ Verificando Tailscale..."
if ping -c 1 DESKTOP-ON51NHF &>/dev/null; then
    echo "   ✅ Tailscale: DESKTOP-ON51NHF es alcanzable"
    ping -c 1 DESKTOP-ON51NHF | head -2
else
    echo "   ❌ Tailscale: No se puede hacer ping a DESKTOP-ON51NHF"
    echo "   💡 Verifica: tailscale status"
fi
echo ""

# 2. Verificar clave SSH
echo "2️⃣ Verificando clave SSH..."
if [ -f /root/.ssh/id_rsa_eugeni ]; then
    echo "   ✅ Clave privada encontrada: /root/.ssh/id_rsa_eugeni"
    ls -lh /root/.ssh/id_rsa_eugeni
    echo ""
    echo "   📋 Clave pública:"
    cat /root/.ssh/id_rsa_eugeni.pub
    echo ""
    echo "   🔑 Fingerprint de la clave:"
    ssh-keygen -lf /root/.ssh/id_rsa_eugeni.pub
else
    echo "   ❌ Clave privada NO encontrada: /root/.ssh/id_rsa_eugeni"
fi
echo ""

# 3. Intentar conexión SSH con verbosidad
echo "3️⃣ Intentando conexión SSH (modo verbose)..."
echo "   Comando: ssh -v -i /root/.ssh/id_rsa_eugeni -o StrictHostKeyChecking=no usuari@DESKTOP-ON51NHF 'echo OK'"
echo ""
ssh -v -i /root/.ssh/id_rsa_eugeni -o StrictHostKeyChecking=no -o ConnectTimeout=10 usuari@DESKTOP-ON51NHF "echo '✅ Conexión exitosa'" 2>&1 | grep -E "(Offering|Authentications|Permission|Connection|OK|✅)" | head -10
echo ""

# 4. Verificar si hay otras claves
echo "4️⃣ Otras claves SSH disponibles:"
ls -la /root/.ssh/ | grep -E "^-.*id_" | awk '{print "   "$9" ("$5" bytes)"}'
echo ""

# 5. Verificar configuración en .env
echo "5️⃣ Variables SSH en .env:"
if [ -f /var/www/aurelinportal/.env ]; then
    grep -E "SSH_DANI|TAILSCALE" /var/www/aurelinportal/.env | sed 's/^/   /'
else
    echo "   ⚠️  Archivo .env no encontrado"
fi
echo ""

echo "📝 ============================================"
echo "📝 INSTRUCCIONES PARA EL SERVIDOR DANI"
echo "📝 ============================================"
echo ""
echo "En el servidor dani (DESKTOP-ON51NHF), ejecuta:"
echo ""
echo "1. Verificar que la clave pública esté en authorized_keys:"
echo "   cat ~/.ssh/authorized_keys | grep 'aurelinportal-to-eugeni'"
echo ""
echo "2. Si no está, agregarla:"
echo "   mkdir -p ~/.ssh"
echo "   chmod 700 ~/.ssh"
echo "   echo '$(cat /root/.ssh/id_rsa_eugeni.pub)' >> ~/.ssh/authorized_keys"
echo "   chmod 600 ~/.ssh/authorized_keys"
echo ""
echo "3. Verificar permisos:"
echo "   ls -la ~/.ssh/"
echo "   # Debe mostrar:"
echo "   # drwx------ .ssh"
echo "   # -rw------- authorized_keys"
echo ""
echo "4. Verificar logs de SSH (en el servidor dani):"
echo "   sudo tail -f /var/log/auth.log"
echo "   # O en algunos sistemas:"
echo "   sudo journalctl -u ssh -f"
echo ""

