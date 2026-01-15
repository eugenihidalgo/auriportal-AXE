# UX ACTION REGISTRY CONTRACT v1 - AuriPortal

**Versión**: 1.0.0  
**Fecha**: 2024  
**Estado**: CONTRATO CANÓNICO (IRREVERSIBLE)

---

## 🎯 PRINCIPIO CONSTITUCIONAL

El **UX Action Registry v1** es la **ÚNICA puerta de intención de usuario** en AuriPortal.

**REGLA ABSOLUTA**:
- Ninguna UI nueva puede existir sin UX Action Registry
- Ninguna mutación puede hacerse fuera de `performAction()`
- El Action Registry es la **ÚNICA** forma válida de declarar intención de usuario

Este contrato es **IRREVERSIBLE** y **BLOQUEA** cualquier implementación que lo viole.

---

## 📋 PRINCIPIOS FUNDAMENTALES

### 1. UI No Muta Estado

La UI **NO** muta estado directamente. La UI **declara intención** a través del Action Registry.

**PROHIBIDO**:
- Llamar `fetch()` directamente desde handlers de botones
- Llamar `axios()`, `XMLHttpRequest`, o cualquier biblioteca HTTP desde UI
- Ejecutar lógica de limpieza/reset/mutación fuera del registry

**OBLIGATORIO**:
- Usar `performAction(action_id, payload)` para **TODAS** las mutaciones
- Registrar acciones **ANTES** de implementar UI
- Declarar schema de validación para cada acción

### 2. UI No Decide Refresh

La UI **NO** decide qué refrescar. El Action Registry declara `refresh_plan` para cada acción.

**PROHIBIDO**:
- Llamar `loadItems()`, `loadListProjection()`, `handleVerItem()` directamente en handlers
- Decidir qué superficie refrescar basándose en estado local
- Ejecutar refresh manual después de mutaciones

**OBLIGATORIO**:
- Declarar `refresh_plan` en la definición de acción
- Confiar en Refresh Engine para ejecutar el plan
- Refrescar solo vía surfaces registradas

### 3. UI No Llama APIs

La UI **NO** llama APIs directamente. El Action Registry construye endpoints y payloads.

**PROHIBIDO**:
- Llamar `fetch('/master/api/*')` o `fetch('/god/api/*')` directamente
- Construir URLs de endpoints manualmente
- Construir payloads sin validación de schema

**OBLIGATORIO**:
- Usar `performAction()` que resuelve endpoint y payload desde el registry
- Validar payload contra schema antes de enviar
- Confiar en `handler.endpointBuilder` y `handler.buildPayload`

### 4. UI Declara Intención, El Sistema Decide

La UI **solo declara intención**. El sistema (Action Registry + Backend + Refresh Engine) decide qué hacer.

**FLUJO CANÓNICO**:
```
UI → performAction(action_id, payload) →
  Action Registry → 
    Validación dura (schema) →
      Backend (endpoint, payload) →
        Refresh Engine (refresh_plan) →
          View re-render
```

---

## 🔒 OBLIGACIONES CONSTITUCIONALES

### Para Toda Acción UI

1. **Registro Previo**
   - La acción **DEBE** estar registrada en UX Action Registry **ANTES** de implementar UI
   - `action_id` debe ser canónico: `{domain}.{feature}.{action}`
   - Schema de validación debe estar definido (`allowed_item_kinds`, `allowed_layers`, `allowed_scopes`)

2. **Validación Dura**
   - `performAction()` valida que `action_id` existe (ERROR HARD si no)
   - Payload se valida contra schema (ERROR HARD si inválido)
   - Restricciones (`item_kind`, `layer`, `scope`) se validan en runtime

3. **Refresh Plan Declarativo**
   - Cada acción **DEBE** tener `refresh_plan` (función o array de `surface_ids`)
   - Refresh Engine ejecuta el plan automáticamente
   - UI **NO** decide qué refrescar

### Para Toda UI Nueva

1. **Diseño Previo con Contrato**
   - **ANTES** de implementar UI, diseñar:
     * Lista de acciones necesarias
     * `action_id` canónico para cada acción
     * Schema de validación (qué campos, qué valores permitidos)
   - **NO** se acepta implementación sin contrato previo

2. **Registro de Acciones**
   - Registrar acciones en `src/core/ux/action-registry/{domain}-actions.js`
   - Exponer funciones en `window` si es necesario (compatibilidad)
   - Verificar que `npm run check:ux-action-registry` pasa

3. **Uso de performAction()**
   - **TODAS** las mutaciones deben usar `performAction(action_id, payload)`
   - **PROHIBIDO** `fetch()` directo (excepto legacy marcado)
   - **PROHIBIDO** handlers que llamen endpoints directamente

---

## ⛔ PROHIBICIONES ABSOLUTAS

### 1. Llamadas Directas a APIs (PROHIBIDO)

```javascript
// ❌ PROHIBIDO
async function handleCleanItem(item) {
  const response = await fetch('/master/api/alquimia-general/items/...', {
    method: 'POST',
    body: JSON.stringify({ ... })
  });
}

// ✅ OBLIGATORIO
async function handleCleanItem(item) {
  await performAction({
    action_id: 'alquimia.clean_all',
    payload: {
      item_ref: item.item_ref,
      clean_layer: 'shared',
      item_kind: 'recurrente'
    }
  });
}
```

### 2. Handlers Sin performAction (PROHIBIDO)

```javascript
// ❌ PROHIBIDO
async function handleResetProgress(student_uuid, item_ref) {
  await fetch('/master/api/alquimia-general/reset-item', {
    method: 'POST',
    body: JSON.stringify({ student_uuid, item_ref })
  });
  // Refresh manual (PROHIBIDO)
  await loadItems();
}

// ✅ OBLIGATORIO
async function handleResetProgress(student_uuid, item_ref) {
  await performAction({
    action_id: 'alquimia.reset',
    payload: {
      student_uuid,
      item_ref,
      item_kind: 'recurrente'
    }
  });
  // Refresh automático vía refresh_plan
}
```

### 3. Botones Sin action_id (PROHIBIDO)

```javascript
// ❌ PROHIBIDO
const btn = document.createElement('button');
btn.addEventListener('click', async () => {
  await fetch('/master/api/...', { method: 'POST', ... });
});

// ✅ OBLIGATORIO
const btn = document.createElement('button');
btn.addEventListener('click', async () => {
  await performAction({
    action_id: 'alquimia.clean_all', // action_id explícito
    payload: { ... }
  });
});
```

### 4. Bibliotecas HTTP Alternativas (PROHIBIDO)

```javascript
// ❌ PROHIBIDO
import axios from 'axios';
await axios.post('/master/api/...', { ... });

// ❌ PROHIBIDO
const xhr = new XMLHttpRequest();
xhr.open('POST', '/master/api/...');
xhr.send(JSON.stringify({ ... }));

// ✅ OBLIGATORIO
await performAction({ action_id: '...', payload: { ... } });
```

---

## ⚠️ LEGACY (Aceptable Temporalmente)

Código legacy está **PERMITIDO** solo si:

1. **Marcado Explícitamente**
   ```javascript
   // LEGACY: handleCrearLista usa fetch() directo (acción de creación, no limpieza)
   // TODO: Migrar a performAction() cuando se registre acción de creación
   console.warn('[LEGACY_REFRESH_CALL] handleCrearLista usando fetch() directo. Debe migrarse a performAction()');
   ```

2. **Justificado en Comentario**
   - Explicar **por qué** es legacy (ej: "acción de creación, no limpieza")
   - Indicar **cuándo** se migrará (ej: "cuando se registre acción de creación")

3. **Listado en Auditoría**
   - `npm run check:ux-action-registry` lo detecta y lo marca como WARNING
   - Aparece en auditoría para migración futura

**REGLA**: Legacy **NO** puede crecer. Solo puede decrecer.

---

## 🔄 RELACIÓN CON OTROS SISTEMAS

### Cleaning Engine

El Action Registry **orquesta** llamadas al Cleaning Engine:

- `alquimia.clean` → Cleaning Engine (`markCleanStudent` / `markCleanAll`)
- `alquimia.reset` → Cleaning Engine (`resetItem` / `resetList`)
- `performAction()` valida payload antes de llamar al Cleaning Engine

### CPM / LPM

El Action Registry **NO** calcula estados (eso es CPM). El Action Registry **solo** ejecuta acciones.

- CPM calcula `state_by_view_layer` (READ)
- Action Registry ejecuta mutaciones vía Cleaning Engine (WRITE)
- Refresh Engine actualiza UI después de mutaciones

### Refresh Engine

El Action Registry **declara** qué refrescar (`refresh_plan`). El Refresh Engine **ejecuta** el refresh.

- `refresh_plan` es declarativo (función o array de `surface_ids`)
- Refresh Engine lee el plan y ejecuta refetch de surfaces
- UI **NO** ejecuta refresh manual

### GOD Mode Futuro

El Action Registry escala a GOD mode:

- `domain: 'god'` para acciones GOD
- `domain: 'master'` para acciones MASTER
- Mismo contrato, diferentes dominios

---

## ✅ EJEMPLOS VÁLIDOS

### Ejemplo 1: Acción de Limpieza

```javascript
// 1. Registrar acción en alquimia-actions.js
registerAction({
  action_id: 'alquimia.clean_all',
  domain: 'master',
  description: 'Limpiar item para todos los estudiantes',
  allowed_item_kinds: ['recurrente', 'una_vez'],
  allowed_layers: ['shared', 'pde'],
  allowed_scopes: ['all'],
  handler: {
    method: 'POST',
    endpointBuilder: (context) => `/master/api/alquimia-general/items/${context.item_ref}/master/mark-clean-all`,
    buildPayload: (uiState, context) => ({
      clean_layer: context.clean_layer,
      item_kind: context.item_kind
    })
  },
  refresh: buildRefreshPlan // función declarativa
});

// 2. Usar en UI
async function handleLimpiarItem(item, cleanLayer) {
  await performAction({
    action_id: 'alquimia.clean_all',
    payload: {
      item_ref: item.item_ref,
      clean_layer: cleanLayer,
      item_kind: item.item_kind
    }
  });
  // Refresh automático vía refresh_plan
}
```

### Ejemplo 2: Acción de Reset

```javascript
// 1. Registrar acción
registerAction({
  action_id: 'alquimia.reset',
  domain: 'master',
  description: 'Resetear progreso (SOLO recurrente)',
  allowed_item_kinds: ['recurrente'], // ❗ SOLO recurrente
  handler: { ... },
  refresh: buildRefreshPlan
});

// 2. Usar en UI
async function handleReset(student_uuid, item_ref) {
  await performAction({
    action_id: 'alquimia.reset',
    payload: {
      student_uuid,
      item_ref,
      item_kind: 'recurrente' // Validado: solo recurrente permitido
    }
  });
  // Si item_kind='una_vez' → ERROR HARD: "reset NO permitido para item_kind='una_vez'"
}
```

---

## ❌ EJEMPLOS DE VIOLACIÓN

### Violación 1: Fetch Directo

```javascript
// ❌ VIOLACIÓN CONSTITUCIONAL
async function handleCleanItem(item) {
  const response = await fetch('/master/api/alquimia-general/items/...', {
    method: 'POST',
    body: JSON.stringify({ ... })
  });
}
```

**Detectado por**: `npm run check:ux-action-registry` → ERROR  
**Fix**: Usar `performAction({ action_id: 'alquimia.clean_all', ... })`

### Violación 2: Handler Sin action_id

```javascript
// ❌ VIOLACIÓN CONSTITUCIONAL
const btn = document.createElement('button');
btn.addEventListener('click', async () => {
  await fetch('/master/api/...', { ... });
  await loadItems(); // Refresh manual (PROHIBIDO)
});
```

**Detectado por**: `npm run check:ux-action-registry` → ERROR  
**Fix**: Usar `performAction()` con `action_id` explícito

### Violación 3: Acción No Registrada

```javascript
// ❌ VIOLACIÓN CONSTITUCIONAL
await performAction({
  action_id: 'alquimia.clean_fake', // No existe en registry
  payload: { ... }
});
```

**Detectado por**: Runtime error: "Acción 'alquimia.clean_fake' no registrada"  
**Fix**: Registrar acción en `alquimia-actions.js` primero

---

## 🔍 VERIFICACIÓN Y AUDITORÍA

### Assembly Check Obligatorio

```bash
npm run check:ux-action-registry
```

**Detecta**:
- ❌ `fetch()` directo fuera de `performAction()`
- ❌ Handlers sin `action_id` explícito
- ❌ Acciones no registradas
- ⚠️ Legacy marcado (WARNING aceptable)

**Resultado**:
- `0 ERRORS` = ✅ PASÓ (sin violaciones constitucionales)
- `> 0 ERRORS` = ❌ FALLÓ (bloquea build, EXIT CODE 1)

### Logs Forenses

Toda acción ejecutada emite logs estructurados:

```
[UX][ACTION][START] { action_id, trace_id, endpoint, payload, ... }
[UX][ACTION][END] { action_id, trace_id, ok, duration_ms, ... }
[REFRESH][PLAN] { action_id, trace_id, surfaces: [...] }
[REFRESH][GET] { surface_id, key, ok, ms, bytes }
[REFRESH][DONE] { action_id, trace_id }
```

**Violaciones** emiten:

```
[UX_CONTRACT_VIOLATION] { action_id, violation, context, timestamp, stack }
```

---

## 📚 REFERENCIAS

- **Registry Core**: `src/core/ux/action-registry/ux-action-registry.js`
- **Perform Action**: `public/js/core/ux/action-registry/perform-action.js`
- **Acciones Alquimia**: `src/core/ux/action-registry/alquimia-actions.js`
- **Assembly Check**: `scripts/check-ux-action-registry.js`
- **UX Contract v1**: `docs/UX_CONTRACT_V1.md`
- **Refresh Contract v1**: `docs/REFRESH_CONTRACT_V1.md`

---

## 🚫 REGLA CONSTITUCIONAL FINAL

**A partir de este contrato**:

- Ninguna UI nueva puede existir sin UX Action Registry
- Ninguna mutación puede hacerse fuera de `performAction()`
- El Action Registry es la **ÚNICA** puerta de intención de usuario

**Este contrato blinda el sistema. NO se puede violar.**

---

**FIN DEL CONTRATO**
