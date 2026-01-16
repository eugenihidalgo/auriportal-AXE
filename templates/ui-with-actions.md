# Plantilla Canónica de UI con UX Action Registry v1

**Versión**: 1.0.0  
**Fecha**: 2025-01-15  
**Estado**: PLANTILLA OBLIGATORIA

---

## 🎯 Propósito

Esta plantilla es **OBLIGATORIA** para crear cualquier UI nueva en AuriPortal que tenga botones que muten estado.

**Cursor DEBE usar esta plantilla por defecto** al crear nuevas UIs.

---

## 📋 Checklist Pre-Implementación

**ANTES** de empezar a escribir código:

- [ ] **Lista de Acciones**: Definir todas las acciones que la UI ejecutará
- [ ] **action_id Canónico**: Cada acción tiene `action_id` único (formato: `{domain}.{feature}.{action}`)
- [ ] **Schema de Validación**: Definir `allowed_item_kinds`, `allowed_layers`, `allowed_scopes` para cada acción
- [ ] **Registro en Registry**: Registrar todas las acciones en `src/core/ux/action-registry/{domain}-actions.js`
- [ ] **Refresh Plan**: Cada acción tiene `refresh_plan` declarativo (función o array)

---

## 🏗️ Estructura Canónica

### 1. Import de Dependencias

```javascript
// OBLIGATORIO: performAction debe estar disponible
// Se carga automáticamente desde master-layout-registry.v1.json
// Verificar que window.performAction existe antes de usar

(function() {
  'use strict';

  // Guard: Verificar que performAction está disponible
  if (typeof window === 'undefined' || typeof window.performAction !== 'function') {
    console.error('[UI] performAction no disponible. Asegúrate de que está cargado.');
    return;
  }

  // ... resto del código ...
})();
```

### 2. Handler Canónico de Botón

```javascript
/**
 * Handler canónico para botón que ejecuta acción
 * 
 * OBLIGATORIO:
 * - Usar performAction() con action_id explícito
 * - Pasar payload validado
 * - NO hacer refresh manual (refresh_plan lo hace)
 * 
 * PROHIBIDO:
 * - fetch() directo
 * - refresh manual (loadItems(), loadListProjection(), etc.)
 */
async function handleActionButton(item, context) {
  // Validar que performAction está disponible
  if (typeof window.performAction !== 'function') {
    console.error('[UI] performAction no disponible');
    return;
  }

  // Ejecutar acción vía performAction
  const result = await window.performAction({
    action_id: 'domain.feature.action', // OBLIGATORIO: action_id explícito
    payload: {
      // Payload validado según schema de la acción
      item_ref: item.item_ref,
      clean_layer: context.clean_layer || 'shared',
      item_kind: item.item_kind || 'recurrente'
    },
    context: {
      // Contexto adicional (opcional)
      list_id: context.list_id,
      student_uuid: context.student_uuid
    },
    uiState: {
      // Estado de UI (opcional)
      view_mode: context.view_mode || 'operativa',
      view_layer: context.view_layer || 'shared'
    }
  });

  // Verificar resultado
  if (!result.ok) {
    console.error('[UI] Acción falló:', result.error);
    // Mostrar error al usuario (toast, banner, etc.)
    return;
  }

  // ✅ Refresh automático vía refresh_plan (NO hacer refresh manual)
  // El Refresh Engine ejecuta el refresh_plan automáticamente
}
```

### 3. Botón con Event Listener

```javascript
/**
 * Crear botón y asociarlo a acción
 * 
 * OBLIGATORIO:
 * - Botón debe tener action_id explícito
 * - Usar performAction() en el handler
 */
function createActionButton(item, context) {
  const btn = document.createElement('button');
  btn.textContent = 'Ejecutar Acción';
  btn.className = 'btn btn-primary';
  
  // Event listener canónico
  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    
    // Deshabilitar botón durante ejecución
    btn.disabled = true;
    btn.textContent = 'Ejecutando...';
    
    try {
      // Ejecutar acción vía performAction
      await handleActionButton(item, context);
    } catch (error) {
      console.error('[UI] Error ejecutando acción:', error);
      // Mostrar error al usuario
    } finally {
      // Rehabilitar botón
      btn.disabled = false;
      btn.textContent = 'Ejecutar Acción';
    }
  });
  
  return btn;
}
```

---

## ✅ Ejemplo Completo

### Ejemplo: UI de Limpieza de Item

```javascript
/**
 * UI de Limpieza de Item - Ejemplo Canónico
 * 
 * Esta UI permite limpiar un item para todos los estudiantes.
 * Usa UX Action Registry v1 con performAction().
 */

(function() {
  'use strict';

  // Guard: Verificar que performAction está disponible
  if (typeof window === 'undefined' || typeof window.performAction !== 'function') {
    console.error('[LimpiezaUI] performAction no disponible. Asegúrate de que está cargado.');
    return;
  }

  /**
   * Handler para limpiar item (todos los estudiantes)
   */
  async function handleLimpiarItem(item, cleanLayer) {
    // Validar inputs
    if (!item || !item.item_ref) {
      console.error('[LimpiezaUI] item o item_ref faltante');
      return;
    }

    // Ejecutar acción vía performAction
    const result = await window.performAction({
      action_id: 'alquimia.clean_all', // action_id canónico
      payload: {
        item_ref: item.item_ref,
        clean_layer: cleanLayer || 'shared',
        item_kind: item.item_kind || 'recurrente'
      },
      uiState: {
        view_mode: window.__AP_ALQUIMIA_STATE__?.view_mode || 'operativa',
        view_layer: window.__AP_ALQUIMIA_STATE__?.view_layer || 'shared',
        list_id: window.__AP_ALQUIMIA_STATE__?.list_id || null
      }
    });

    // Verificar resultado
    if (!result.ok) {
      console.error('[LimpiezaUI] Acción falló:', result.error);
      // Mostrar error (toast, banner, etc.)
      if (window.showToastError) {
        window.showToastError(`Error: ${result.error}`);
      }
      return;
    }

    // ✅ Refresh automático vía refresh_plan
    // NO hacer refresh manual aquí
  }

  /**
   * Crear botón de limpieza
   */
  function createLimpiezaButton(item, cleanLayer) {
    const btn = document.createElement('button');
    btn.textContent = `Limpiar (${cleanLayer})`;
    btn.className = 'btn btn-primary';
    
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      
      // Deshabilitar durante ejecución
      btn.disabled = true;
      const originalText = btn.textContent;
      btn.textContent = 'Limpiando...';
      
      try {
        await handleLimpiarItem(item, cleanLayer);
      } catch (error) {
        console.error('[LimpiezaUI] Error:', error);
        if (window.showToastError) {
          window.showToastError(`Error: ${error.message}`);
        }
      } finally {
        // Rehabilitar
        btn.disabled = false;
        btn.textContent = originalText;
      }
    });
    
    return btn;
  }

  // Exportar funciones si es necesario
  if (typeof window !== 'undefined') {
    window.handleLimpiarItem = handleLimpiarItem;
    window.createLimpiezaButton = createLimpiezaButton;
  }
})();
```

---

## ❌ Anti-Patrones Prohibidos

### ❌ Anti-Patrón 1: Fetch Directo

```javascript
// ❌ PROHIBIDO
async function handleAction(item) {
  const response = await fetch('/master/api/alquimia-general/items/...', {
    method: 'POST',
    body: JSON.stringify({ ... })
  });
}
```

**Fix**: Usar `performAction({ action_id: '...', payload: { ... } })`

### ❌ Anti-Patrón 2: Refresh Manual

```javascript
// ❌ PROHIBIDO
async function handleAction(item) {
  await performAction({ action_id: '...', payload: { ... } });
  // Refresh manual (PROHIBIDO)
  await loadItems();
}
```

**Fix**: Declarar `refresh_plan` en la acción. El Refresh Engine ejecuta automáticamente.

### ❌ Anti-Patrón 3: Botón Sin action_id

```javascript
// ❌ PROHIBIDO
btn.addEventListener('click', async () => {
  await fetch('/master/api/...', { method: 'POST', ... });
});
```

**Fix**: Usar `performAction({ action_id: '...', payload: { ... } })`

---

## 🔍 Verificación Post-Implementación

**DESPUÉS** de implementar la UI:

- [ ] **Assembly Check**: `npm run check:ux-action-registry` pasa (0 errors)
- [ ] **Logs Forenses**: Verificar que aparecen logs `[UX][ACTION][START]` y `[UX][ACTION][END]`
- [ ] **Refresh Funciona**: Verificar que surfaces se refrescan automáticamente después de acciones
- [ ] **Sin fetch() directo**: No hay `fetch()` POST/PUT/DELETE fuera de `performAction()`
- [ ] **Sin refresh manual**: No hay llamadas a `loadItems()`, `loadListProjection()`, etc. en handlers

---

## 📚 Referencias

- **Contrato Canónico**: `docs/UX_ACTION_REGISTRY_CONTRACT_V1.md`
- **Refresh Contract**: `docs/REFRESH_CONTRACT_V1.md`
- **Registry Core**: `src/core/ux/ux-action-registry.v1.js`
- **Perform Action**: `public/js/master/ux/perform-action.v1.js`
- **Assembly Check**: `scripts/check-ux-action-registry.js`

---

**Última actualización**: 2025-01-15  
**Mantenido por**: Sistema AuriPortal  
**Estado**: PLANTILLA OBLIGATORIA ✅
