# Separación HTML/JS en Admin - Reglas Constitucionales

## ⚠️ PRINCIPIO FUNDAMENTAL

**HTML estructural SOLO puede existir en SSR (Server-Side Rendering)**  
**JavaScript Admin SOLO puede leer/manipular DOM existente**

---

## ❌ PROHIBICIONES ABSOLUTAS

### 1. HTML dentro de JavaScript

**PROHIBIDO**:
```javascript
// ❌ NUNCA hacer esto
const html = `<div id="admin-sidebar-scroll">...</div>`;
container.innerHTML = html;
```

**CORRECTO**:
```javascript
// ✅ HTML generado en SSR, JS solo manipula DOM
const container = document.getElementById('admin-sidebar-scroll');
container.classList.add('active');
```

### 2. innerHTML con HTML complejo

**PROHIBIDO**:
```javascript
// ❌ NUNCA hacer esto
resultEl.innerHTML = '<h3>✅ Resultado:</h3>' + html;
```

**CORRECTO**:
```javascript
// ✅ Usar DOM API
const heading = document.createElement('h3');
heading.textContent = '✅ Resultado:';
resultEl.appendChild(heading);
resultEl.appendChild(document.createTextNode(data));
```

### 3. textContent/innerHTML en console.* sin sanitizar

**PROHIBIDO**:
```javascript
// ❌ NUNCA hacer esto - puede romper parser JS
const sidebarText = sidebarScroll.textContent || '';
console.warn('Sidebar:', {
  textPreview: sidebarText.substring(0, 200)  // ⚠️ PELIGROSO
});
```

**CORRECTO**:
```javascript
// ✅ Opción 1: Eliminar si no es necesario
console.warn('Sidebar:', {
  linkCount: sidebarLinks.length
});

// ✅ Opción 2: Sanitizar si es necesario
const sanitized = sidebarText.substring(0, 200)
  .replace(/\\/g, '\\\\')
  .replace(/"/g, '\\"')
  .replace(/'/g, "\\'")
  .replace(/\n/g, '\\n')
  .replace(/\r/g, '\\r')
  .replace(/\t/g, '\\t');
console.warn('Sidebar:', { textPreview: sanitized });
```

### 4. Template literals con HTML en JS

**PROHIBIDO**:
```javascript
// ❌ NUNCA hacer esto en código cliente
const sidebarHtml = `<div id="admin-sidebar-scroll">${items.map(...)}</div>`;
```

**CORRECTO**:
```javascript
// ✅ HTML generado en SSR (sidebar-registry.js)
// JS solo lee el DOM existente
const sidebar = document.getElementById('admin-sidebar-scroll');
```

---

## ✅ PATRONES CORRECTOS

### 1. Sidebar generado en SSR

**Archivo**: `src/core/admin/sidebar-registry.js`
```javascript
// ✅ CORRECTO: HTML generado en SSR
export function generateSidebarHTML(currentPath = '', userContext = {}) {
  // ... lógica de generación ...
  html = `<div id="admin-sidebar-scroll">${html}</div>`;
  return html;  // Se inyecta en {{SIDEBAR_MENU}} en SSR
}
```

**Archivo**: `src/core/admin/admin-page-renderer.js`
```javascript
// ✅ CORRECTO: Reemplazo en SSR
html = html.replace(/\{\{SIDEBAR_MENU\}\}/g, sidebarHtml);
```

### 2. JavaScript solo lee/manipula DOM

**Archivo**: `public/js/admin/sidebar-client.js`
```javascript
// ✅ CORRECTO: JS solo manipula DOM existente
function restoreSidebarState() {
  const sidebarElement = document.getElementById('admin-sidebar-scroll');
  if (!sidebarElement) return;
  
  // Leer estado, no generar HTML
  const state = getSidebarState();
  sidebarElement.scrollTop = state.scrollTop;
}
```

### 3. Validación sin pasar HTML a console

**Archivo**: `src/core/html/admin/base.html`
```javascript
// ✅ CORRECTO: Validación sin pasar HTML
const sidebarScroll = document.getElementById('admin-sidebar-scroll');
if (sidebarScroll) {
  const sidebarLinks = sidebarScroll.querySelectorAll('a');
  const sidebarText = sidebarScroll.textContent || '';
  
  if (sidebarText.includes('{{SIDEBAR_MENU}}')) {
    console.error('[SIDEBAR_FIX] ❌ Placeholder sin reemplazar');
  } else if (sidebarLinks.length < 2) {
    // ✅ Solo pasar datos simples, no HTML
    console.warn('[SIDEBAR_FIX] ⚠️ Sidebar tiene menos de 2 items', {
      linkCount: sidebarLinks.length
    });
  }
}
```

---

## 🔍 DETECCIÓN DE VIOLACIONES

### Script de Auditoría

Ejecutar:
```bash
npm run audit:js-assets
```

El script detecta:
- ✅ `</script>` huérfanos
- ✅ Scripts desbalanceados
- ✅ HTML servido como JS
- ✅ **textContent/innerHTML en console.* sin sanitizar** (NUEVO)

### Patrones a Buscar

Si encuentras estos patrones, **REVISAR INMEDIATAMENTE**:

```bash
# Buscar textContent/innerHTML en console.*
grep -r "console\.(log|warn|error).*textContent" src/
grep -r "console\.(log|warn|error).*innerHTML" src/

# Buscar template literals con HTML en JS
grep -r "`.*<div.*id.*admin-sidebar" src/endpoints/
```

---

## 🛡️ GUARDRAILS ACTIVOS

### 1. Router protege contra HTML en JS

**Archivo**: `src/router.js` líneas 269-293

El router verifica que archivos `.js` no contengan HTML:
```javascript
if (isJsFile) {
  const firstBytes = readFileSync(fullPath, { encoding: 'utf-8', start: 0, end: 300 });
  if (firstBytes.trim().startsWith('<!DOCTYPE') || firstBytes.trim().startsWith('<html')) {
    // Retorna error 500
  }
}
```

### 2. Assembly Check valida estructura

**Archivo**: `scripts/admin-ui-assembly-check.js`

Valida que:
- Sidebar se genera en SSR
- No hay HTML hardcodeado en handlers
- Placeholders se reemplazan correctamente

### 3. Audit JS Assets

**Archivo**: `scripts/audit-admin-js-assets.js`

Detecta:
- Scripts desbalanceados
- HTML en archivos JS
- **textContent/innerHTML sin sanitizar en console.*** (NUEVO)

---

## 📋 CHECKLIST ANTES DE COMMIT

- [ ] ¿Hay HTML generado en JavaScript cliente?
- [ ] ¿Hay `innerHTML` con HTML complejo?
- [ ] ¿Hay `textContent`/`innerHTML` en `console.*` sin sanitizar?
- [ ] ¿El sidebar se genera en SSR?
- [ ] ¿JS solo lee/manipula DOM existente?
- [ ] ¿`npm run audit:js-assets` pasa sin errores?

---

## 🎯 POR QUÉ ES CRÍTICO

### Problema Real Encontrado

En `base.html` línea 364 (ANTES del fix):
```javascript
console.warn('Sidebar:', {
  textPreview: sidebarText.substring(0, 200)  // ⚠️
});
```

**Problema**: Si `sidebarText` contiene caracteres especiales, comillas, o saltos de línea, al serializarse en el objeto que se pasa a `console.warn`, puede romper el parser JavaScript, generando:

```
Uncaught SyntaxError: Invalid or unexpected token
```

**Solución**: Eliminar `textPreview` o sanitizarlo antes de pasarlo a `console.*`.

---

## 📚 REFERENCIAS

- **Sidebar SSR**: `src/core/admin/sidebar-registry.js`
- **Page Renderer**: `src/core/admin/admin-page-renderer.js`
- **Base Template**: `src/core/html/admin/base.html`
- **Sidebar Client**: `public/js/admin/sidebar-client.js`
- **Audit Script**: `scripts/audit-admin-js-assets.js`

---

**Última actualización**: 2024-12-19  
**Versión**: 1.0.0




