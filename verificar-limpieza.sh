#!/bin/bash
# Script de verificación del sistema de limpieza

echo "🔍 Verificando sistema de limpieza energética..."
echo ""

# 1. Verificar archivos
echo "📁 Verificando archivos..."
files=(
  "src/endpoints/limpieza-handler.js"
  "src/endpoints/limpieza-master.js"
  "src/modules/limpieza.js"
  "src/services/secciones-limpieza.js"
  "src/services/ver-por-alumno.js"
  "src/core/html/limpieza-principal.html"
  "src/core/html/limpieza-tipo.html"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "  ✅ $file"
  else
    echo "  ❌ $file (NO EXISTE)"
  fi
done

echo ""

# 2. Verificar rutas en router
echo "🔗 Verificando rutas en router..."
if grep -q "limpieza" src/router.js; then
  echo "  ✅ Rutas de limpieza encontradas en router.js"
else
  echo "  ❌ No se encontraron rutas de limpieza en router.js"
fi


echo ""

# 4. Verificar estado del servidor
echo "🖥️  Verificando estado del servidor..."
if pm2 list | grep -q "aurelinportal.*online"; then
  echo "  ✅ Servidor aurelinportal está online"
else
  echo "  ❌ Servidor aurelinportal NO está online"
fi

echo ""

# 5. Verificar sintaxis de archivos principales
echo "🔍 Verificando sintaxis..."
if node -c src/endpoints/limpieza-handler.js 2>/dev/null; then
  echo "  ✅ limpieza-handler.js - Sintaxis correcta"
else
  echo "  ❌ limpieza-handler.js - Error de sintaxis"
fi


echo ""
echo "✅ Verificación completada"
echo ""
echo "📝 URLs para probar:"
echo "  - Público: https://pdeeugenihidalgo.org/limpieza"
echo "  - Limpiezas globales: https://admin.pdeeugenihidalgo.org/admin/limpiezas-master?filtro=hoy"
echo ""
echo "💡 Si no ves los cambios:"
echo "  1. Limpia la caché del navegador (Ctrl+Shift+R o Cmd+Shift+R)"
echo "  2. Verifica que estés accediendo a la URL correcta"
echo "  3. Revisa la consola del navegador (F12) para errores"




