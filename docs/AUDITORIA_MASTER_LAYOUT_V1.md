# 🔍 AUDITORÍA MASTER LAYOUT V1 - AuriPortal

**Fecha**: 2025-01-XX  
**Objetivo**: Consolidar y certificar Master Layout v1 bajo dominio /master

---

## 📋 COMPONENTES ENCONTRADOS

### ✅ Infraestructura Existente (Canónica)

1. **Router & Resolver**
   - `src/core/master/router/master-router-resolver.js` ✅
   - Resuelve rutas /master/* usando Master Route Registry
   - Guards constitucionales: API vs UI separación
   - Handler mapping explícito (sin inferencia)

2. **Layout & Renderer**
   - `src/core/master/layout/master-layout-v1.html` ✅
   - `src/core/master/layout/master-page-renderer.js` ✅
   - Usa renderMasterPage() con contexto obligatorio
   - Template único master-layout-v1.html

3. **Registries**
   - `src/core/master/registry/master-route-registry.js` ✅
   - `src/core/master/registry/master-layout-registry.v1.json` ✅
   - `src/core/master/registry/master-sidebar-registry.js` ✅
   - Validación al arrancar servidor

4. **Sidebar**
   - `src/core/master/sidebar/master-sidebar-client.js` ✅ (DOM API only)
   - `public/js/master/master-sidebar-client.js` ⚠️ (DUPLICADO)

5. **UI Factory**
   - `src/core/master/ui-factory/master-ui-factory.js` ✅
   - Assembly check básico implementado

---

## ❌ VIOLACIONES DETECTADAS

### 1. **HTML en Strings JS (CRÍTICO)**

**Archivo**: `src/core/master/layout/master-page-renderer.js`  
**Líneas**: 162, 164, 170

```javascript
// VIOLACIÓN: Template literals con HTML
const scriptsHtml = extraScripts.map(src => 
  `<script src="${src}" type="module"></script>`
).join('\n');
html = html.replace('</body>', `${scriptsHtml}\n</body>`);
```

**Impacto**: Violación constitucional "no HTML in JS strings"  
**Solución**: Usar DOM API o construir strings de forma segura sin HTML

---

### 2. **Duplicación de Sidebar Client**

**Archivos**:
- `src/core/master/sidebar/master-sidebar-client.js` (source)
- `public/js/master/master-sidebar-client.js` (duplicado)

**Impacto**: Mantenimiento duplicado, posible desincronización  
**Solución**: Un solo archivo fuente, copiar a public/ en build o servir desde src/

---

### 3. **Scripts Faltantes en public/js/master**

**Faltan**:
- `master-theme-resolver.js` (referenciado en layout pero no existe)
- `master-acs-runtime-guard.js` (referenciado en layout pero no existe)

**Impacto**: Scripts 404, funcionalidad rota  
**Solución**: Crear stubs funcionales mínimos

---

### 4. **Guards Idempotentes Faltantes**

**Problema**: No hay guards explícitos para scripts Master  
**Ejemplo esperado**:
```javascript
if (window.__AP_MASTER_SIDEBAR_LOADED__) return;
window.__AP_MASTER_SIDEBAR_LOADED__ = true;
```

**Impacto**: Posible carga duplicada de scripts  
**Solución**: Añadir guards idempotentes en todos los scripts Master

---

### 5. **Notes Panel No Implementado**

**Estado**: Placeholder en layout, pero sin funcionalidad  
**Faltan**:
- Botón flotante
- Panel abrir/cerrar
- Persistencia localStorage
- Script de inicialización

**Impacto**: Feature incompleta  
**Solución**: Implementar notes panel completo

---

### 6. **Endpoint /master/api/diagnostics Faltante**

**Estado**: Referenciado pero no implementado  
**Esperado**: JSON con invariants, registry stats, últimos checks

**Impacto**: Endpoint 404  
**Solución**: Crear endpoint funcional

---

### 7. **Documentación Faltante**

**Faltan**:
- `docs/MASTER_LAYOUT_V1.md` (contrato del layout)
- Assembly check script independiente (`scripts/master-ui-assembly-check.js`)

**Impacto**: Falta de documentación canónica  
**Solución**: Crear documentación y script de validación

---

### 8. **API Health Endpoint Básico**

**Estado**: Existe pero falta información (version, build_id, subsystem)  
**Archivo**: `src/endpoints/master-api-health.js`

**Mejora necesaria**: Añadir más metadata

---

## ✅ COMPONENTES CORRECTOS

1. ✅ Router separa API vs UI correctamente
2. ✅ renderMasterPage() tiene guard de contexto
3. ✅ Sidebar usa DOM API only (sin innerHTML)
4. ✅ Layout registry tiene constraints correctos
5. ✅ Route registry valida al arrancar
6. ✅ No hay dependencias de base.html Admin
7. ✅ No hay reutilización de renderAdminPage()

---

## 📝 PLAN DE CORRECCIÓN

### Fase 1: Violaciones Críticas
1. ✅ Corregir HTML en strings JS (master-page-renderer.js)
2. ✅ Resolver duplicación sidebar client
3. ✅ Crear scripts faltantes (theme-resolver, acs-guard)

### Fase 2: Features Faltantes
4. ✅ Implementar notes panel persistente
5. ✅ Crear endpoint /master/api/diagnostics
6. ✅ Mejorar endpoint /master/api/health

### Fase 3: Documentación y Validación
7. ✅ Crear docs/MASTER_LAYOUT_V1.md
8. ✅ Crear scripts/master-ui-assembly-check.js
9. ✅ Añadir guards idempotentes

### Fase 4: Verificación
10. ✅ Ejecutar assembly checks
11. ✅ Verificar curls
12. ✅ Verificar UI navegable

---

## 🎯 ESTADO ACTUAL

**Completitud**: ~70%  
**Violaciones críticas**: 1 (HTML en strings)  
**Features faltantes**: 3 (notes panel, diagnostics endpoint, guards)  
**Documentación**: 0% (faltante)

**Próximos pasos**: Corregir violaciones y completar features faltantes.


