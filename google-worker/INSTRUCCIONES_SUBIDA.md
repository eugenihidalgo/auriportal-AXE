# 📤 Instrucciones para Subir Archivos a Google Apps Script

Hay varias formas de subir los archivos `.gs` a Google Apps Script. Elige la que prefieras:

## Opción 1: Usar el Script Automático (Recomendado)

El script `upload-to-apps-script.js` intentará subir los archivos automáticamente usando la API.

**Requisitos:**
- Habilitar Google Apps Script API en Google Cloud Console
- Tener credenciales configuradas (Service Account u OAuth2)

**Ejecutar:**
```bash
cd /var/www/aurelinportal/google-worker
node upload-to-apps-script.js
```

**Para actualizar un proyecto existente:**
```bash
node upload-to-apps-script.js SCRIPT_ID_AQUI
```

## Opción 2: Usar clasp (Herramienta Oficial de Google)

### Instalación:
```bash
npm install -g @google/clasp
clasp login
```

### Inicializar proyecto:
```bash
cd /var/www/aurelinportal/google-worker
clasp create --type standalone --title "AuriPortal Google Worker" --rootDir .
```

O si ya tienes un proyecto:
```bash
clasp clone SCRIPT_ID_AQUI --rootDir .
```

### Subir archivos:
```bash
clasp push
```

## Opción 3: Copia Manual (Más Segura)

1. Ve a [script.google.com](https://script.google.com)
2. Crea un nuevo proyecto o abre uno existente
3. Elimina el archivo `Code.gs` por defecto si existe
4. Para cada archivo:
   - Clic en "Archivo" → "Nuevo" → "Script" (o usa el ícono +)
   - Para archivos en carpetas (utils/, actions/), usa el formato `carpeta/archivo.gs` como nombre
   - Pega el contenido del archivo correspondiente

### Orden de creación recomendado:

1. `Code.gs` (principal)
2. `router.gs`
3. `utils/response.gs`
4. `utils/validation.gs`
5. `actions/drive.gs`
6. `actions/docs.gs`
7. `actions/email.gs`
8. `actions/calendar.gs`
9. `actions/aurielin.gs`
10. `actions/logs.gs`

**Nota:** En Apps Script, las "carpetas" se crean usando el formato `carpeta/archivo.gs` en el nombre del archivo.

## Opción 4: Usar el Navegador Automáticamente (Experimental)

Puedo intentar usar el navegador para copiar los archivos automáticamente. ¿Quieres que lo intente?

---

## ✅ Después de Subir

1. **Configurar SCRIPT_SECRET:**
   - En Apps Script: "Proyecto" → "Configuración del proyecto" → "Script properties"
   - Añadir propiedad: `SCRIPT_SECRET` = `tu_token_secreto`

2. **Desplegar como Web App:**
   - "Implementar" → "Nueva implementación" → "Aplicación web"
   - Ejecutar como: "Yo"
   - Acceso: "Cualquiera"
   - Copiar la URL

3. **Probar:**
   ```bash
   curl -X POST https://script.google.com/macros/s/SCRIPT_ID/exec \
     -H "Content-Type: application/json" \
     -d '{"token":"tu_token","accion":"ping"}'
   ```


























