# 📐 MASTER LAYOUT V1 - Contrato Canónico

**Versión**: 1.0.0  
**Dominio**: `/master`  
**Estado**: Canónico

---

## 🎯 PROPÓSITO

Master Layout v1 es la **infraestructura canónica** para todas las pantallas del dominio Master en AuriPortal. No es "una pantalla": es el sistema completo de renderizado, routing, sidebar, scripts y validación.

---

## 📋 INVARIANTES (OBLIGATORIOS)

### 1. **Dominio Canónico**
- ✅ Todas las rutas Master empiezan con `/master`
- ✅ Rutas API: `/master/api/*` → JSON absoluto (Content-Type: application/json)
- ✅ Rutas UI: `/master/*` → HTML vía renderMasterPage()

### 2. **Render Contract**
- ✅ TODAS las pantallas Master usan `renderMasterPage()`
- ✅ TODAS las pantallas usan `master-layout-v1.html`
- ❌ PROHIBIDO: renderizar HTML directamente en handlers
- ❌ PROHIBIDO: usar `base.html` de Admin
- ❌ PROHIBIDO: usar `renderAdminPage()`

### 3. **Router Contract**
- ✅ Toda request `/master/*` pasa por `master-router-resolver.js`
- ✅ Handler mapping explícito (sin inferencia)
- ✅ Guards constitucionales: API vs UI separación

### 4. **Sidebar Contract**
- ✅ DOM API only (sin HTML en strings JS)
- ✅ Datos desde `master-sidebar-registry.js` (JSON puro)
- ✅ Active state por `activePath`
- ✅ Búsqueda global funcional
- ✅ Bookmarks persistentes

### 5. **Scripts Contract**
- ✅ Guards idempotentes obligatorios
- ✅ Scripts se cargan una sola vez
- ✅ Sin inline JS en templates
- ✅ Sin HTML en strings JavaScript
- ✅ Entry gate canónico (`inject_master.js`)
- ✅ Loader por contrato (`master-script-loader.js`)
- ✅ Guard sincronizado por evento (`master-acs-runtime-guard.js`)
- ✅ `inject_main.js` NO se ejecuta en Master (aislamiento constitucional)

### 6. **Layout Slots**
- ✅ `sidebar`: Contenedor del sidebar Master
- ✅ `main`: Contenido principal de la pantalla
- ✅ `notes_panel`: Panel de notas persistente
- ✅ `diagnostics_panel`: Panel de diagnósticos (opcional)
- ✅ `overlays`: Overlays modales (opcional)

---

## 🏗️ ARQUITECTURA

### Componentes Principales

```
src/core/master/
├── router/
│   └── master-router-resolver.js    # Resolución de rutas /master/*
├── layout/
│   ├── master-layout-v1.html        # Template único
│   └── master-page-renderer.js      # renderMasterPage()
├── registry/
│   ├── master-route-registry.js     # Rutas canónicas
│   ├── master-layout-registry.v1.json # Layouts/universos
│   └── master-sidebar-registry.js   # Datos del sidebar
├── sidebar/
│   └── master-sidebar-client.js     # Renderizado DOM API
└── ui-factory/
    └── master-ui-factory.js         # Factory y Assembly Check
```

### Scripts Frontend

```
public/js/master/
├── inject_master.js                 # Entry Gate canónico (verifica contexto)
├── master-script-loader.js          # Loader canónico (carga desde contrato)
├── master-sidebar-client.js         # Sidebar (DOM API)
├── master-theme-resolver.js         # Resolución de temas
├── master-acs-runtime-guard.js     # Guard de runtime (valida tras evento)
└── master-notes-panel.js            # Panel de notas
```

### Runtime Flow (Canónico)

El flujo de ejecución de scripts Master sigue este orden estricto:

1. **Backend decide contexto** (`master-page-renderer.js`)
   - Inyecta `window.__AP_CONTEXT__ = 'MASTER'` en HTML
   - Inyecta contrato `required_scripts` desde registry

2. **HTML expone contexto y contrato**
   - `window.__AP_CONTEXT__` disponible antes de cualquier script
   - `window.__AP_MASTER_REQUIRED_SCRIPTS__` disponible antes del loader

3. **Entry Gate valida dominio** (`inject_master.js`)
   - Verifica: `if (window.__AP_CONTEXT__ !== 'MASTER') return;`
   - Delega únicamente a: `import('/js/master/master-script-loader.js')`

4. **Loader carga scripts desde contrato** (`master-script-loader.js`)
   - Lee `required_scripts` del contrato
   - Carga scripts secuencialmente (DOM API)
   - Emite evento: `AP_MASTER_SCRIPTS_READY` cuando termina

5. **Scripts se autodeclaran** (guards idempotentes)
   - Cada script marca: `window.__AP_MASTER_{GUARD_ID}_LOADED__ = true`

6. **Guard valida tras señal explícita** (`master-acs-runtime-guard.js`)
   - Escucha evento: `AP_MASTER_SCRIPTS_READY`
   - Verifica guards vs contrato
   - Si faltan → error visible (no silenciar)

7. **Assembly Check impide desviaciones**
   - Verifica entry gate presente
   - Verifica inject_main.js aislado
   - Verifica contexto inyectado

**Principio Constitucional**: Nada se ejecuta "porque sí". Todo está gobernado por contrato.

---

## 🔧 USO

### Renderizar una Pantalla Master

```javascript
import { renderMasterPage } from '../core/master/layout/master-page-renderer.js';

export default async function myHandler(request, env, ctx) {
  const url = new URL(request.url);
  const activePath = url.pathname;
  
  return renderMasterPage({
    title: 'Mi Pantalla',
    contentHtml: '<div>Contenido...</div>',
    activePath,
    universeId: 'systema'
  });
}
```

### Registrar una Ruta

1. Añadir entrada en `master-route-registry.js`:
```javascript
{
  key: 'master-mi-pantalla',
  path: '/master/mi-pantalla',
  type: 'island'
}
```

2. Añadir handler en `MASTER_HANDLER_MAP`:
```javascript
'master-mi-pantalla': () => import('../../../endpoints/master-mi-pantalla.js')
```

3. Crear handler en `src/endpoints/master-mi-pantalla.js`

---

## ✅ VALIDACIÓN

### Assembly Check

Ejecutar validación completa:
```bash
npm run check:master-ui
```

Verifica:
- ✅ Rutas API devuelven JSON
- ✅ Rutas UI usan renderMasterPage
- ✅ Layout tiene slots requeridos
- ✅ Sidebar no usa innerHTML
- ✅ Scripts tienen guards idempotentes
- ✅ Registry válido
- ✅ Entry Gate presente (`inject_master.js`)
- ✅ `inject_main.js` aislado (no se ejecuta en Master)
- ✅ Contexto de dominio inyectado correctamente
- ✅ Public Assets Gate funcional

### Endpoints de Diagnóstico

- `GET /master/api/health` → Estado del subsistema
- `GET /master/api/diagnostics` → Invariants y stats

---

## 🚫 PROHIBICIONES ABSOLUTAS

1. ❌ HTML en strings JavaScript
2. ❌ innerHTML dinámico
3. ❌ Reutilizar `base.html` de Admin
4. ❌ Reutilizar `renderAdminPage()`
5. ❌ Inferencia de handlers
6. ❌ Scripts sin guards idempotentes
7. ❌ Rutas API devolviendo HTML
8. ❌ Rutas UI sin pasar por resolver
9. ❌ Ejecutar `inject_main.js` en Master
10. ❌ Inferir contexto por URL en scripts
11. ❌ Cambiar contexto en runtime
12. ❌ Cargar scripts sin contrato
13. ❌ Timeouts arbitrarios en guards
14. ❌ Polling para verificar scripts

---

## 📚 REFERENCIAS

- `docs/AUDITORIA_MASTER_LAYOUT_V1.md` - Auditoría completa
- `docs/DOMAIN_CONTEXT_CONTRACT.md` - Contrato de contexto de dominio
- `src/core/master/registry/master-layout-registry.v1.json` - Registry canónico
- `scripts/master-ui-assembly-check.js` - Script de validación

---

## 🔒 CONSTITUCIONALIZACIÓN

Este sistema está **CONGELADO** como ley del sistema:

- ✅ Contexto soberano por dominio
- ✅ Entry gate canónico Master
- ✅ Loader por contrato
- ✅ Aislamiento total de `inject_main.js`
- ✅ Guard sincronizado por evento
- ✅ Assembly Check impide desviaciones

**Cualquier cambio requiere decisión constitucional explícita.**

---

**Última actualización**: 2025-01-XX

