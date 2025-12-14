# 🔍 Diagnóstico de Sincronización Kajabi

## ✅ Mejoras Implementadas

1. **Soporte para Site ID en .env:**
   - Puedes especificar `KAJABI_SITE_ID` directamente en `.env`
   - Si no está, intenta buscarlo por nombre

2. **Mejor Logging:**
   - Muestra todos los sitios disponibles si no encuentra el site_id
   - Prueba obtener contactos sin filtro para diagnóstico
   - Logs detallados de cada paso

3. **Manejo de Errores Mejorado:**
   - Si falla con site_id, intenta sin filtro
   - Muestra mensajes de error más claros
   - Diagnóstico automático

---

## 🔧 Configuración

### Opción 1: Especificar Site ID directamente

Añade en `.env`:
```env
KAJABI_SITE_ID=tu_site_id_aqui
```

### Opción 2: Dejar que lo busque automáticamente

El sistema buscará el sitio con nombre que contenga:
```
"Plataforma de desarrollo espiritual Eugeni Hidalgo"
```

---

## 🐛 Si No Funciona

### Paso 1: Revisar Logs

```bash
pm2 logs aurelinportal --lines 50
```

Busca:
- `✅ Site ID obtenido:` - Confirma que encontró el site_id
- `📋 Sitios encontrados en Kajabi:` - Lista todos los sitios disponibles
- `📄 Página X/Y:` - Muestra cuántos contactos encuentra

### Paso 2: Verificar Site ID

Si los logs muestran los sitios disponibles, copia el ID correcto y añádelo a `.env`:

```env
KAJABI_SITE_ID=el_id_que_aparece_en_los_logs
```

### Paso 3: Probar Sin Filtro

El código ahora intenta obtener contactos sin filtro de site_id si falla con el filtro. Esto ayuda a diagnosticar si el problema es el site_id o la API en general.

---

## 📊 Qué Esperar en los Logs

### ✅ Sincronización Exitosa:
```
🔄 Iniciando sincronización masiva...
🔑 Obteniendo access token...
✅ Access token obtenido
✅ Site ID obtenido: 12345
📥 Obteniendo lista de contactos...
   📄 Página 1/5: 100 contactos encontrados
   📄 Página 2/5: 100 contactos encontrados
✅ Total de emails obtenidos: 250
🔄 Sincronizando 250 contactos...
   📊 Progreso: 10/250 (4%)
```

### ❌ Error de Site ID:
```
⚠️  [Kajabi] No se encontró sitio con nombre que contenga "Plataforma..."
🔍 Intentando obtener lista de sitios para diagnóstico...
📋 Sitios encontrados en Kajabi: 2
   1. "Mi Sitio" (ID: 12345)
   2. "Otro Sitio" (ID: 67890)
```

### ❌ Sin Contactos:
```
✅ Site ID obtenido: 12345
📥 Obteniendo lista de contactos...
   📄 Página 1/1: 0 contactos encontrados
⚠️  Página vacía, finalizando
✅ Total de emails obtenidos: 0
```

---

## 🔄 Reiniciar Servidor

Después de cambiar `.env`:

```bash
pm2 restart aurelinportal --update-env
```

---

## 📝 Notas

- El sistema intenta obtener contactos sin filtro si falla con site_id
- Los logs muestran todos los sitios disponibles si no encuentra el site_id
- Puedes especificar el site_id directamente en `.env` para evitar búsquedas
- El límite actual es de 1000 contactos (puede aumentarse)

---

*Documento generado: $(date)*









