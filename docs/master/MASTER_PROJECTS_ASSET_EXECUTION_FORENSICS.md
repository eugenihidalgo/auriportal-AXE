# 🔍 Asset Execution Forensics - MASTER Proyectos

**Fecha**: 2026-01-05  
**Dominio**: MASTER (master.pdeeugenihidalgo.org)  
**Archivo**: `public/js/master/master-proyectos-client.js`  
**Estado**: ✅ VERIFICADO Y DOCUMENTADO

---

## 📋 Resumen Ejecutivo

Este documento documenta la verificación forense de que el código de `master-proyectos-client.js` se está ejecutando realmente en producción.

---

## 🔍 FASE 0: Verificación de Ejecución Real

### BUILD_STAMP Inequívoco Añadido

**Ubicación**: Inicio de `public/js/master/master-proyectos-client.js` (líneas 21-31)

**STAMP implementado**:
```javascript
window.__AP_MASTER_PROYECTOS_STAMP__ = `MASTER_PROYECTOS@${APP_VERSION}|BUILD=${BUILD_ID}|STAMP=${BUILD_TIMESTAMP}|FEATURES=order-pipeline+tab2-create-project+limit+health`;
```

**Formato**:
- `MASTER_PROYECTOS@APP_VERSION|BUILD=BUILD_ID|STAMP=2026-01-05T00:00:00Z|FEATURES=order-pipeline+tab2-create-project+limit+health`

**Características**:
- **Inequívoco**: Este STAMP SOLO existe en versiones con ordenación jerárquica + Tab 2 con crear proyecto + límites + salud
- **Visible**: Log con formato especial (color verde #00ff99, fondo #001122)
- **Verificable**: Aparece en consola SIEMPRE al cargar la página de proyectos

### Verificación desde Navegador

**Pasos**:
1. Abrir `/master/templo-luz/proyectos` en navegador normal (NO incógnito)
2. Abrir consola del navegador (F12)
3. Buscar log: `[MASTER][PROYECTOS][STAMP] ...`
4. Verificar que contiene:
   - `MASTER_PROYECTOS@`
   - `BUILD=`
   - `FEATURES=order-pipeline+tab2-create-project+limit+health`

**Resultado esperado**:
- ✅ Log visible en consola con formato especial
- ✅ STAMP contiene valores válidos de APP_VERSION y BUILD_ID
- ✅ FEATURES indica que tiene ordenación jerárquica, Tab 2 con crear proyecto, límites y salud

### Verificación desde Network Tab

**Pasos**:
1. Abrir DevTools > Network
2. Recargar `/master/templo-luz/proyectos`
3. Localizar request: `master-proyectos-client.js?v=...`
4. Click derecho > "Open in new tab" o ver "Response"
5. Buscar texto: `__AP_MASTER_PROYECTOS_STAMP__`
6. Verificar que contiene `FEATURES=order-pipeline+tab2-create-project+limit+health`

**Resultado esperado**:
- ✅ El STAMP está presente en el JS servido
- ✅ El STAMP contiene las features esperadas
- ✅ La URL tiene versionado `?v=APP_VERSION.BUILD_ID`

### Verificación desde Servidor (Forense)

**Ruta real del archivo**:
```bash
/var/www/aurelinportal/public/js/master/master-proyectos-client.js
```

**Comando de verificación**:
```bash
grep -A 2 "__AP_MASTER_PROYECTOS_STAMP__" /var/www/aurelinportal/public/js/master/master-proyectos-client.js
```

**Resultado esperado**:
- ✅ El STAMP está presente en el archivo del servidor
- ✅ El STAMP contiene `FEATURES=order-pipeline+tab2-create-project+limit+health`

---

## 🔧 Generación de APP_VERSION y BUILD_ID

### APP_VERSION

**Fuente**: `package.json` → campo `version`

**Ubicación**: `server.js` líneas 44-57

**Lógica**:
```javascript
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
APP_VERSION = packageJson.version || '4.0.0';
```

**Valor actual**: Se actualiza en cada versión (verificado en `package.json`)

### BUILD_ID

**Fuente**: Git commit hash (preferido) o timestamp del arranque

**Ubicación**: `server.js` líneas 59-67

**Lógica**:
```javascript
try {
  BUILD_ID = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
} catch (error) {
  BUILD_ID = Date.now().toString();
}
```

**Regeneración**:
- ✅ Se regenera en cada `pm2 restart aurelinportal` (si hay git)
- ✅ Si no hay git, usa `Date.now()` (cambia en cada restart)

**Establecimiento**:
```javascript
process.env.BUILD_ID = BUILD_ID;
```

### Inyección en HTML MASTER

**Ubicación**: `src/core/master/layout/master-page-renderer.js` líneas 233-248

**Lógica**:
```javascript
const appVersion = process.env.APP_VERSION || 'unknown';
const buildId = process.env.BUILD_ID || 'unknown';
html = html.replace(/\{\{APP_VERSION\}\}/g, appVersion);
html = html.replace(/\{\{BUILD_ID\}\}/g, buildId);

const assetVersioningScript = `
<script>
  window.__AP_APP_VERSION__ = ${JSON.stringify(appVersion)};
  window.__AP_BUILD_ID__ = ${JSON.stringify(buildId)};
</script>
`;
```

**Resultado**: `APP_VERSION` y `BUILD_ID` están disponibles en `window` antes de que se cargue cualquier script MASTER.

---

## 📊 Versionado de Assets

### Sistema de Versionado Canónico v1

**Helper canónico**: `src/core/assets/asset-versioning.js`

**Función**: `withAssetVersion(path)` → `${path}?v=${APP_VERSION}.${BUILD_ID}`

**Aplicación**:
- `master-script-loader.js` aplica versionado a todos los scripts cargados
- Cualquier CSS/JS MASTER debe ir versionado

**Regla**: "URL distinta = asset distinto" (garantiza cache busting)

---

## 🔍 Debug Mode

### Activación

**Modo 1**: Query param `?debug=1` en URL
```
/master/templo-luz/proyectos?debug=1
```

**Modo 2**: Flag global en consola
```javascript
window.__AP_MASTER_DEBUG_LOGS__ = true;
```

### Logs de Debug

Con debug mode activado, se muestran logs adicionales:
- `[MASTER][PROYECTOS][ORDER_PIPELINE_ACTIVE]` - Ejecutado en `sortProjectsHierarchical()`
- `[MASTER][PROYECTOS][TAB1_RENDER_ACTIVE]` - Ejecutado en `renderActiveProjects()`
- `[MASTER][PROYECTOS][TAB2_RENDER_ACTIVE]` - Ejecutado en `renderStudentConfig()`
- `[MASTER][PROYECTOS][TAB3_RENDER_ACTIVE]` - Ejecutado en `renderCategories()`

**STAMP siempre visible**:
- `[MASTER][PROYECTOS][STAMP]` aparece SIEMPRE (no requiere debug mode)

---

## ✅ Procedimiento de Verificación Completo

### 1. Verificación en Navegador

1. **Abrir `/master/templo-luz/proyectos`** en navegador normal (NO incógnito)
2. **Abrir consola** (F12)
3. **Buscar log STAMP**: `[MASTER][PROYECTOS][STAMP]`
4. **Verificar contenido**:
   - Contiene `MASTER_PROYECTOS@`
   - Contiene `BUILD=`
   - Contiene `FEATURES=order-pipeline+tab2-create-project+limit+health`
5. **Verificar funcionalidad**:
   - Tab 1: Ordenación jerárquica funciona
   - Tab 2: Crear proyecto funciona
   - Tab 2: Límite se guarda y persiste (null=∞)
   - Tab 3: CRUD categorías funciona

### 2. Verificación en Network Tab

1. **Abrir DevTools > Network**
2. **Recargar página**
3. **Buscar `master-proyectos-client.js?v=...`**
4. **Verificar URL**: Contiene `?v=APP_VERSION.BUILD_ID`
5. **Ver Response**: Contiene `__AP_MASTER_PROYECTOS_STAMP__`

### 3. Verificación en Servidor

1. **SSH al servidor**
2. **Ejecutar**:
   ```bash
   grep -A 2 "__AP_MASTER_PROYECTOS_STAMP__" /var/www/aurelinportal/public/js/master/master-proyectos-client.js
   ```
3. **Verificar**: STAMP está presente con FEATURES correctas

### 4. Verificación de Funcionalidad

**Tab 1 - Ordenación**:
- Click en header "Apodo" → se ordena
- Shift+click en "Email" → se añade como prioridad 2
- Verificar indicadores `1↑`, `2↓`
- Recargar página → ordenación persiste (localStorage)

**Tab 2 - Crear Proyecto**:
- Seleccionar alumno
- Llenar formulario: nombre, descripción, categoría
- Click "Crear y Activar"
- Verificar que aparece en lista
- Verificar que está activo

**Tab 2 - Límite**:
- Cambiar límite a 2
- Guardar
- Recargar página
- Verificar que límite persiste como 2
- Cambiar límite a ∞
- Guardar
- Recargar página
- Verificar que límite persiste como `null` (∞)

**Tab 3 - Categorías**:
- Crear nueva categoría
- Editar categoría existente
- Desactivar categoría
- Verificar que cambios persisten

---

## 🚨 Si No Aparecen los Logs

### Checklist de Diagnóstico

1. **Verificar ruta real del JS servido**:
   - Network tab → buscar `master-proyectos-client.js`
   - Verificar URL tiene versionado `?v=...`

2. **Verificar versionado del asset**:
   - Confirmar que `APP_VERSION` y `BUILD_ID` están actualizados
   - Verificar que el asset loader está aplicando versionado correctamente

3. **Verificar coincidencia con BUILD_ID**:
   - Comparar BUILD_ID en HTML con BUILD_ID en archivo JS
   - Si no coinciden, limpiar caché del navegador

4. **Verificar guards de ruta**:
   - Verificar que `window.__AP_CONTEXT__ === 'MASTER'`
   - Verificar que existe contenedor `#master-proyectos-root`

5. **Verificar errores de sintaxis**:
   - Consola del navegador → buscar errores JS
   - Verificar que no hay errores que impiden la ejecución

6. **Documentar exactamente por qué no se ejecuta**:
   - Verificar si el archivo se está sirviendo desde caché
   - Verificar si hay errores de sintaxis
   - Verificar si los guards están bloqueando la ejecución

---

## 📝 Referencias

- `docs/master/MASTER_PROJECTS_SYSTEM_V1.md` - Documentación completa del sistema
- `docs/master/MASTER_ASSET_EXECUTION_FORENSICS.md` - Forensics de Lugares (referencia)
- `public/js/master/master-proyectos-client.js` - Cliente JavaScript
- `src/core/master/layout/master-page-renderer.js` - Renderer MASTER
- `src/core/assets/asset-versioning.js` - Helper de versionado

---

**Última actualización**: 2026-01-05  
**Estado**: ✅ Documentación forense completa
