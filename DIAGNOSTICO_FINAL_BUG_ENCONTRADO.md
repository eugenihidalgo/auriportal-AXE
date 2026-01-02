# 🔴 BUG IDENTIFICADO: HTML servido como JavaScript

## 🎯 CAUSA RAÍZ ENCONTRADA

### **Problema:**
En el HTML final servido (línea 2335), hay un `<script src="` **SIN CERRAR** que captura todo el contenido siguiente como parte de su atributo `src`, incluyendo el script inline de `loadQuickDiagnostics()`.

### **HTML Roto (líneas 2334-2361):**

```html
<script src="/js/admin/sidebar-client.js"></script>
<script src="
  <script>
    async function loadQuickDiagnostics() {
      try {
        const response = await fetch('/admin/api/system/diagnostics');
        ...
      }
    }
    loadQuickDiagnostics();
  </script>
"></script>
<script src="/js/admin/robustness-diagnostics.js"></script>
```

### **Problema específico:**
- Línea 2335: `<script src="` - **TAG ABIERTO SIN CERRAR**
- Líneas 2336-2359: Script inline `loadQuickDiagnostics()` - **CAPTURADO DENTRO DEL ATRIBUTO src**
- Línea 2361: `"></script>` - **CIERRE DEL TAG MALFORMADO**

## 🔍 INVESTIGACIÓN NECESARIA

Necesito encontrar:
1. **Dónde se está inyectando ese `<script src="` malformado**
2. **Si viene de `extraScripts` en `admin-dashboard-v1.js`**
3. **Si hay algún problema en el código que procesa `extraScripts` en `admin-page-renderer.js`**

## 📋 PRÓXIMOS PASOS

1. Verificar `admin-dashboard-v1.js` para ver qué se pasa en `extraScripts`
2. Revisar la lógica de inyección de scripts en `admin-page-renderer.js` líneas 303-316
3. Identificar por qué un script se está inyectando mal formado




