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

## 📐 CAMPOS OBLIGATORIOS DE ACCIÓN

### Schema Canónico Completo

```javascript
{
  // OBLIGATORIOS
  action_id: string,              // Formato: {domain}.{feature}.{action}
  domain: 'master' | 'god' | 'admin_legacy',
  description: string,            // Descripción clara de la acción
  handler: {
    method: 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    endpointBuilder: (context) => string,  // Construye endpoint dinámico
    buildPayload: (uiState, context) => Object,  // Construye payload validado
    headers?: Object              // Headers adicionales (opcional)
  },
  refresh: Function | Array,     // refresh_plan (función o array de surface_ids)
  
  // VALIDACIÓN (OBLIGATORIO para acciones que requieren validación)
  allowed_item_kinds?: Array,     // ['recurrente', 'una_vez'] o null si no aplica
  allowed_layers?: Array,         // ['shared', 'pde'] o null si no aplica
  allowed_scopes?: Array,         // ['student', 'all'] o null si no aplica
  
  // TELEMETRÍA (OPCIONAL, defaults: true)
  telemetry?: {
    log_input?: boolean,          // Loggear input (default: true)
    log_output?: boolean           // Loggear output (default: true)
  }
}
```

### allowed_item_kinds

**Valores permitidos**: `['recurrente', 'una_vez']` o `null` (si no aplica)

**Ejemplos**:
- `allowed_item_kinds: ['recurrente']` → Solo items recurrentes
- `allowed_item_kinds: ['recurrente', 'una_vez']` → Ambos tipos
- `allowed_item_kinds: null` → No aplica (ej: acciones de configuración)

**Validación**: `performAction()` valida que `payload.item_kind` esté en `allowed_item_kinds` (ERROR HARD si no)

### allowed_layers

**Valores permitidos**: `['shared', 'pde']` o `null` (si no aplica)

**Ejemplos**:
- `allowed_layers: ['shared']` → Solo capa shared
- `allowed_layers: ['shared', 'pde']` → Ambas capas
- `allowed_layers: null` → No aplica (ej: acciones sin capa)

**Validación**: `performAction()` valida que `payload.clean_layer` esté en `allowed_layers` (ERROR HARD si no)

### allowed_scopes

**REGLA CONSTITUCIONAL**: `allowed_scopes` SOLO puede contener scopes UX válidos. Está PROHIBIDO usar conceptos de dominio backend.

**Scopes UX válidos (lista cerrada)**:
- `'item'` - Acción sobre un item específico
- `'list'` - Acción sobre una lista específica
- `'all'` - Acción masiva (todos los estudiantes/items)
- `'student'` - Acción sobre un estudiante específico
- `'selection'` - Acción sobre selección múltiple
- `'context'` - Acción contextual

**PROHIBIDO ABSOLUTAMENTE**:
- ❌ `'ITEM_STUDENT'`, `'ITEM_ALL'`, `'LIST_STUDENT'`, `'LIST_ALL'` (conceptos de dominio backend)
- ❌ Cualquier valor que no esté en la lista cerrada de scopes UX válidos

**Separación UX Scope vs Dominio**:
- `allowed_scopes` = Scopes UX válidos (para validación de contrato UX)
- `payload.reset_scope` = Semántica rica de dominio (ITEM_STUDENT, ITEM_ALL, etc.)
- La semántica rica de dominio se expresa SOLO en el payload, NO en `allowed_scopes`

**Ejemplos correctos**:
```javascript
// ✅ CORRECTO: Scopes UX válidos
allowed_scopes: ['item', 'student']  // Reset item para estudiante
allowed_scopes: ['item', 'all']      // Reset item para todos
allowed_scopes: ['list', 'student']  // Reset lista para estudiante
allowed_scopes: ['list', 'all']      // Reset lista para todos
allowed_scopes: ['student', 'all']   // Limpiar para estudiante o todos
```

**Ejemplos incorrectos**:
```javascript
// ❌ INCORRECTO: Conceptos de dominio backend
allowed_scopes: ['ITEM_STUDENT', 'ITEM_ALL']  // PROHIBIDO
allowed_scopes: ['LIST_STUDENT', 'LIST_ALL']  // PROHIBIDO
allowed_scopes: ['reset:item:student']         // PROHIBIDO
```

**Ejemplo completo (reset)**:
```javascript
// ✅ CORRECTO
registerAction({
  action_id: 'alquimia.reset',
  allowed_scopes: ['item', 'list', 'all', 'student'], // UX scopes válidos
  handler: {
    buildPayload: (uiState, context) => ({
      reset_scope: context.reset_scope, // 'ITEM_STUDENT' | 'ITEM_ALL' | etc. (dominio)
      clean_layer: context.clean_layer,
      // ...
    })
  }
});

// ❌ INCORRECTO
registerAction({
  action_id: 'alquimia.reset',
  allowed_scopes: ['ITEM_STUDENT', 'ITEM_ALL'], // PROHIBIDO: conceptos de dominio
  // ...
});
```

**Validación**: `performAction()` valida que `payload.scope` (si existe) esté en `allowed_scopes` (ERROR HARD si no). La validación de `reset_scope` (dominio) se hace en `buildPayload`, no en `allowed_scopes`.

---

## 🎨 CONTRATO DE CREACIÓN DE UI

### Checklist Obligatorio para Nueva UI

**ANTES** de implementar cualquier UI con botones:

- [ ] **Lista de Acciones**: Definir todas las acciones que la UI ejecutará
- [ ] **action_id Canónico**: Cada acción tiene `action_id` único (formato: `{domain}.{feature}.{action}`)
- [ ] **Schema de Validación**: Definir `allowed_item_kinds`, `allowed_layers`, `allowed_scopes` para cada acción
- [ ] **Registro en Registry**: Registrar todas las acciones en `src/core/ux/action-registry/{domain}-actions.js`
- [ ] **Refresh Plan**: Cada acción tiene `refresh_plan` declarativo (función o array)
- [ ] **Verificación**: `npm run check:ux-action-registry` pasa (0 errors)

**DURANTE** la implementación:

- [ ] **Import de Registry**: Importar o asegurar que `performAction()` está disponible
- [ ] **Botones con action_id**: Cada botón usa `performAction({ action_id, payload })`
- [ ] **Sin fetch() directo**: NO hay `fetch()` POST/PUT/DELETE fuera de `performAction()`
- [ ] **Sin refresh manual**: NO hay llamadas a `loadItems()`, `loadListProjection()`, etc. en handlers

**DESPUÉS** de implementar:

- [ ] **Assembly Check**: `npm run check:ux-action-registry` pasa
- [ ] **Logs Forenses**: Verificar que aparecen logs `[UX][ACTION][START]` y `[UX][ACTION][END]`
- [ ] **Refresh Funciona**: Verificar que surfaces se refrescan automáticamente

### Si NO se Cumple el Contrato

**UI inválida por contrato**. Cursor NO debe dar el trabajo por terminado hasta que:

1. Todas las acciones estén registradas
2. Todos los botones usen `performAction()`
3. Assembly check pase (0 errors)

---

## 🚫 ANTI-PATRONES PROHIBIDOS (DETALLADO)

### Anti-patrón 1: Fetch Directo con Construcción Manual de URL

```javascript
// ❌ PROHIBIDO
async function handleAction(item) {
  const endpoint = `/master/api/alquimia-general/items/${item.item_ref}/master/mark-clean-all`;
  const payload = {
    clean_layer: 'shared',
    item_kind: item.item_kind
  };
  await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}
```

**Problema**: Construcción manual de endpoint y payload, sin validación, sin refresh plan.

**Fix**: Usar `performAction()` con acción registrada.

### Anti-patrón 2: Handler que Decide Refresh Basándose en Estado Local

```javascript
// ❌ PROHIBIDO
async function handleCleanItem(item) {
  await performAction({ action_id: 'alquimia.clean_all', payload: { ... } });
  
  // Decidir refresh basándose en estado local (PROHIBIDO)
  if (window.__AP_ALQUIMIA_STATE__?.view_mode === 'operativa') {
    await loadItems();
  } else {
    await loadListProjection();
  }
}
```

**Problema**: UI decide qué refrescar. El `refresh_plan` de la acción debe decidir.

**Fix**: Declarar `refresh_plan` en la acción que evalúe `view_mode` y retorne surfaces correctos.

### Anti-patrón 3: Botón Sin action_id Explícito

```javascript
// ❌ PROHIBIDO
const btn = document.createElement('button');
btn.textContent = 'Limpiar';
btn.onclick = async () => {
  // Lógica inline sin action_id
  const response = await fetch('/master/api/...', { method: 'POST', ... });
  if (response.ok) {
    await loadItems(); // Refresh manual
  }
};
```

**Problema**: No hay `action_id`, no hay registro, no hay validación, no hay refresh plan.

**Fix**: Usar `performAction({ action_id: 'alquimia.clean_all', payload: { ... } })`.

### Anti-patrón 4: Acción Registrada Sin Validación

```javascript
// ❌ PROHIBIDO
registerAction({
  action_id: 'alquimia.clean_all',
  domain: 'master',
  description: 'Limpiar item',
  handler: { ... },
  refresh: buildRefreshPlan
  // ❌ FALTA: allowed_item_kinds, allowed_layers, allowed_scopes
});
```

**Problema**: Acción sin validación. Cualquier `item_kind` o `layer` inválido pasará.

**Fix**: Añadir validación explícita:
```javascript
allowed_item_kinds: ['recurrente', 'una_vez'],
allowed_layers: ['shared', 'pde'],
allowed_scopes: ['all']
```

### Anti-patrón 5: Refresh Plan Vacío o Manual

```javascript
// ❌ PROHIBIDO
registerAction({
  action_id: 'alquimia.clean_all',
  // ...
  refresh: () => []  // ❌ Plan vacío (no refresca nada)
});

// ❌ PROHIBIDO
async function handleCleanItem(item) {
  await performAction({ action_id: 'alquimia.clean_all', payload: { ... } });
  // Refresh manual después (PROHIBIDO)
  await loadItems();
}
```

**Problema**: No hay refresh automático o refresh manual fuera del plan.

**Fix**: Declarar `refresh_plan` que retorne surfaces correctos.

---

## 📚 REFERENCIAS

- **Registry Core**: `src/core/ux/action-registry/ux-action-registry.js`
- **Registry v1**: `src/core/ux/ux-action-registry.v1.js`
- **Perform Action**: `public/js/master/ux/perform-action.v1.js`
- **Acciones Alquimia**: `src/core/ux/action-registry/alquimia-actions.js`
- **Assembly Check**: `scripts/check-ux-action-registry.js`
- **Refresh Check**: `scripts/check-ux-refresh-wiring.js`
- **UX Contract v1**: `docs/UX_CONTRACT_V1.md`
- **Refresh Contract v1**: `docs/REFRESH_CONTRACT_V1.md`
- **Plantilla UI**: `templates/ui-with-actions.md`

---

## 🚫 REGLA CONSTITUCIONAL FINAL

**A partir de este contrato**:

- 🛑 **Ninguna UI nueva puede existir sin UX Action Registry**
- 🛑 **Ninguna mutación puede hacerse fuera de `performAction()`**
- 🛑 **Ningún botón puede existir sin acción registrada**
- 🛑 **Ningún refresh puede ser manual**

**El Action Registry es la ÚNICA puerta de intención de usuario.**

**Este contrato blinda el sistema. NO se puede violar.**

**Aplicable a**: MASTER, ADMIN, CLIENT, GOD MODE, Automatizaciones, UIs futuras

---

**FIN DEL CONTRATO**
