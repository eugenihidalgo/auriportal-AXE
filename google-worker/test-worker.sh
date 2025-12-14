#!/bin/bash

URL="https://script.google.com/a/macros/eugenihidalgo.org/s/AKfycbzUvuOn_CVsSeCXRm8DhE-SASZ1bSWCJ2vCYLpk0qMIvXK2ztcgWz2B1i9-5L2xO1bF/exec"

echo "🧪 Probando Google Worker..."
echo ""
echo "📋 URL: $URL"
echo ""

# Test de ping (necesitas el token, pero primero probamos la URL)
echo "⚠️  NOTA: Necesitas configurar SCRIPT_SECRET en Script Properties primero"
echo ""
echo "Para probar, ejecuta:"
echo ""
echo "curl -X POST '$URL' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"token\":\"TU_SCRIPT_SECRET_AQUI\",\"accion\":\"ping\"}'"
echo ""

