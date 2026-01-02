# AuriPortal — Assembly Check System v1.0

**Objetivo:** Sistema de verificación automática para prevenir regresiones en UIs Admin

---

## QUÉ VERIFICA

El Assembly Check System verifica 5 aspectos críticos:

1. **API_ROUTE_AS_ISLAND:** No existen rutas `/admin/api/*` que resuelvan como `island`
2. **RENDER_ADMIN_PAGE_USAGE:** Todas las rutas `island` usan `renderAdminPage()`
3. **SIDEBAR_PLACEHOLDER:** El placeholder `{{SIDEBAR_MENU}}` nunca aparece literal en HTML final
4. **GLOBAL_SCRIPTS_GUARD:** Scripts globales no se duplican (guard `window.__AP_*_LOADED__`)
5. **CAPABILITIES_DECLARED:** (Opcional) Cada nueva UI declara capabilities mínimas

---

## USO

### Ejecutar check:

```bash
# Modo texto (default)
node scripts/admin-ui-assembly-check.js

# Modo JSON (para integración CI/CD)
node scripts/admin-ui-assembly-check.js --json
```

### Integrar en CI/CD:

```yaml
# .github/workflows/assembly-check.yml
name: Assembly Check
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: node scripts/admin-ui-assembly-check.js
```

---

## OUTPUT

### Modo texto:

```
[ASSEMBLY_CHECK] Iniciando verificación (trace_id: assembly-check-1234567890)...

[ASSEMBLY_CHECK] Verificando rutas API...
[ASSEMBLY_CHECK] Verificando uso de renderAdminPage...
[ASSEMBLY_CHECK] Verificando sidebar placeholder...
[ASSEMBLY_CHECK] Verificando scripts globales...
[ASSEMBLY_CHECK] Verificando capabilities...

[ASSEMBLY_CHECK] ════════════════════════════════════════
[ASSEMBLY_CHECK] Resumen:
[ASSEMBLY_CHECK]   ✅ OK: 15
[ASSEMBLY_CHECK]   ⚠️  Warnings: 2
[ASSEMBLY_CHECK]   ❌ Errors: 0
[ASSEMBLY_CHECK] ════════════════════════════════════════

⚠️  WARNINGS:
  - [RENDER_ADMIN_PAGE_USAGE] Handler de /admin/mi-ruta no está mapeado explícitamente
  - [GLOBAL_SCRIPTS_GUARD] 1 handlers cargan scripts sin guard de carga única
```

### Modo JSON:

```json
{
  "ok": [
    {
      "check": "API_ROUTE_AS_ISLAND",
      "message": "Todas las rutas /admin/api/* tienen type: api"
    }
  ],
  "errors": [],
  "warnings": [
    {
      "check": "RENDER_ADMIN_PAGE_USAGE",
      "route": "/admin/mi-ruta",
      "message": "Handler no está mapeado explícitamente"
    }
  ],
  "timestamp": "2025-01-XXT...",
  "trace_id": "assembly-check-1234567890"
}
```

---

## EXIT CODES

- `0`: Todos los checks pasaron (puede haber warnings)
- `1`: Hay errores que deben corregirse

---

## CHECKS DETALLADOS

### 1. API_ROUTE_AS_ISLAND

**Qué verifica:**
- Busca en `admin-route-registry.js` rutas que:
  - Empiecen con `/admin/api/`
  - Tengan `type: 'island'`

**Error si:**
- Encuentra alguna ruta que cumpla ambas condiciones

**Solución:**
- Cambiar `type: 'api'` en el registry

---

### 2. RENDER_ADMIN_PAGE_USAGE

**Qué verifica:**
- Para cada ruta `island` en el registry:
  - Busca el handler en `HANDLER_MAP`
  - Verifica que el handler existe
  - Verifica que el handler usa `renderAdminPage()`

**Error si:**
- Handler no encontrado
- Handler no usa `renderAdminPage()`

**Warning si:**
- Handler no está mapeado explícitamente (usa inferencia)

**Solución:**
- Añadir handler a `HANDLER_MAP`
- Asegurar que el handler llama `renderAdminPage()`

---

### 3. SIDEBAR_PLACEHOLDER

**Qué verifica:**
- `base.html` contiene `{{SIDEBAR_MENU}}`
- `admin-page-renderer.js` reemplaza `{{SIDEBAR_MENU}}`

**Error si:**
- Placeholder no está en `base.html`
- `renderAdminPage()` no reemplaza el placeholder

**Solución:**
- Verificar que `base.html` tiene el placeholder
- Verificar que `renderAdminPage()` hace el reemplazo

---

### 4. GLOBAL_SCRIPTS_GUARD

**Qué verifica:**
- Busca handlers que cargan scripts en `extraScripts`
- Verifica que los scripts tienen guard `window.__AP_*_LOADED__`

**Warning si:**
- Scripts cargados sin guard de carga única

**Solución:**
- Añadir guard en el script:
  ```javascript
  if (!window.__AP_MI_SCRIPT_LOADED__) {
    window.__AP_MI_SCRIPT_LOADED__ = true;
    // código del script
  }
  ```

---

### 5. CAPABILITIES_DECLARED

**Qué verifica:**
- (Opcional) Verifica que UIs nuevas declaran capabilities

**Estado:** No implementado (placeholder para futuro)

---

## INTEGRACIÓN

### Pre-commit hook:

```bash
#!/bin/bash
# .git/hooks/pre-commit

node scripts/admin-ui-assembly-check.js
if [ $? -ne 0 ]; then
  echo "❌ Assembly check falló. Corrige los errores antes de commitear."
  exit 1
fi
```

### PM2 script:

```json
{
  "scripts": {
    "assembly-check": "node scripts/admin-ui-assembly-check.js"
  }
}
```

---

## MANTENIMIENTO

### Añadir nuevo check:

1. Crear función `checkNuevoCheck()` en `admin-ui-assembly-check.js`
2. Llamar en `runAllChecks()`
3. Documentar en este archivo

### Actualizar checks existentes:

1. Modificar función del check
2. Actualizar documentación
3. Probar con `node scripts/admin-ui-assembly-check.js`

---

**Última actualización:** 2025-01-XX




