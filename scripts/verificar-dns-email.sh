#!/bin/bash
# Script per verificar la configuració SPF i DKIM dels dominis

echo "🔍 Verificant configuració DNS per a emails..."
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Funció per verificar SPF
verificar_spf() {
    local dominio=$1
    echo "📧 Verificant SPF per a $dominio..."
    resultado=$(dig TXT $dominio +short 2>/dev/null | grep -i "spf")
    if [ -z "$resultado" ]; then
        echo -e "${RED}❌ SPF no trobat per a $dominio${NC}"
        return 1
    else
        echo -e "${GREEN}✅ SPF trobat:${NC}"
        echo "   $resultado"
        return 0
    fi
}

# Funció per verificar DKIM
verificar_dkim() {
    local dominio=$1
    echo "🔐 Verificant DKIM per a $dominio..."
    resultado=$(dig TXT default._domainkey.$dominio +short 2>/dev/null | grep -i "dkim")
    if [ -z "$resultado" ]; then
        echo -e "${YELLOW}⚠️  DKIM no trobat per a $dominio${NC}"
        echo "   (Pot ser que el nom del registre sigui diferent)"
        return 1
    else
        echo -e "${GREEN}✅ DKIM trobat per a $dominio${NC}"
        echo "   (Clau DKIM configurada)"
        return 0
    fi
}

# Funció per verificar DMARC
verificar_dmarc() {
    local dominio=$1
    echo "🛡️  Verificant DMARC per a $dominio..."
    resultado=$(dig TXT _dmarc.$dominio +short 2>/dev/null | grep -i "dmarc")
    if [ -z "$resultado" ]; then
        echo -e "${YELLOW}⚠️  DMARC no trobat per a $dominio${NC}"
        return 1
    else
        echo -e "${GREEN}✅ DMARC trobat:${NC}"
        echo "   $resultado"
        return 0
    fi
}

# Verificar eugenihidalgo.org (domini principal per emails)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📧 Verificant: eugenihidalgo.org (Principal)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
verificar_spf "eugenihidalgo.org"
echo ""
verificar_dkim "eugenihidalgo.org"
echo ""
verificar_dmarc "eugenihidalgo.org"
echo ""

# Verificar pdeeugenihidalgo.org
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌐 Verificant: pdeeugenihidalgo.org"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
verificar_spf "pdeeugenihidalgo.org"
echo ""
verificar_dkim "pdeeugenihidalgo.org"
echo ""
verificar_dmarc "pdeeugenihidalgo.org"
echo ""

# Verificar vegasquestfantasticworld.win
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎮 Verificant: vegasquestfantasticworld.win"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
verificar_spf "vegasquestfantasticworld.win"
echo ""
verificar_dkim "vegasquestfantasticworld.win"
echo ""
verificar_dmarc "vegasquestfantasticworld.win"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Verificació completada"
echo ""
echo "💡 Si algun registre no apareix, espera 5-15 minuts per la propagació DNS"
echo "💡 Pots verificar també amb: https://mxtoolbox.com/spf.aspx"

