# UX CONTRACT v1 - AuriPortal

**Versión:** 1.0.0  
**Fecha:** 2025-01-15  
**Dominio:** MASTER (iniciando por Alquimia General)  
**Estado:** CANÓNICO

---

## 1. ¿Qué es una UX Action?

Una **UX Action** es una mutación de estado del sistema que se ejecuta desde la interfaz de usuario y que **DEBE** estar formalizada mediante un contrato explícito.

### Principio Constitucional

> **Toda mutación UI debe pasar por un wrapper canónico (`performAction()`) y estar registrada en el UX Action Registry.**

### Schema Canónico

```javascript
{
  action_id: string,           // ID único canónico (ej: 'alquimia.clean.student')
  domain: 'master' | 'god' | 'admin_legacy',
  description: string,          // Descripción legible de la acción
  request: {
    method: 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    endpointBuilder: (context) => string,  // Construye endpoint dinámicamente
    buildPayload: (uiState, context) => Object,  // Construye payload
    headers?: Object            // Headers adicionales (opcional)
  },
  refresh_plan: Function | Array<string>,  // Plan declarativo de refresh
  telemetry: {
    log_input?: boolean,         // Loggear input (default: true)
    log_output?: boolean         // Loggear output (default: true)
  }
}
```

### Campos Obligatorios

- **`action_id`**: Identificador único canónico. Formato: `{domain}.{feature}.{action}` (ej: `alquimia.clean.student`)
- **`domain`**: Dominio de la acción (`master`, `god`, `admin_legacy`)
- **`description`**: Descripción legible para debugging y documentación
- **`request.method`**: Método HTTP (`POST`, `PUT`, `DELETE`, `PATCH`)
- **`request.endpointBuilder`**: Función que construye el endpoint desde el contexto
- **`request.buildPayload`**: Función que construye el payload desde `uiState` y `context`
- **`refresh_plan`**: Función que retorna array de `surface_id`s o array directo

---

## 2. Ejemplos Reales

### Ejemplo 1: Limpiar Item para Todos (Alquimia)

```javascript
registry.registerUxAction({
  action_id: 'alquimia.clean.all',
  domain: 'master',
  description: 'Limpiar item para todos los estudiantes (shared o pde)',
  request: {
    method: 'POST',
    endpointBuilder: (context) => {
      if (!context.item_ref) {
        throw new Error('item_ref es obligatorio para alquimia.clean.all');
      }
      return `/master/api/alquimia-general/items/${context.item_ref}/master/mark-clean-all`;
    },
    buildPayload: (uiState, context) => {
      if (!context.item_kind) {
        throw new Error('item_kind es obligatorio para alquimia.clean.all');
      }
      if (!context.clean_layer || (context.clean_layer !== 'shared' && context.clean_layer !== 'pde')) {
        throw new Error('clean_layer debe ser "shared" o "pde"');
      }
      return {
        clean_layer: context.clean_layer,
        item_kind: context.item_kind
      };
    }
  },
  refresh_plan: buildRefreshPlan,  // Función que retorna surfaces
  telemetry: {
    log_input: true,
    log_output: true
  }
});
```

### Ejemplo 2: Limpiar Item para Estudiante Específico

```javascript
registry.registerUxAction({
  action_id: 'alquimia.clean.student',
  domain: 'master',
  description: 'Limpiar item para un estudiante específico (shared o pde)',
  request: {
    method: 'POST',
    endpointBuilder: (context) => {
      if (!context.item_ref) {
        throw new Error('item_ref es obligatorio para alquimia.clean.student');
      }
      return `/master/api/alquimia-general/items/${context.item_ref}/master/mark-clean-student`;
    },
    buildPayload: (uiState, context) => {
      // Validaciones obligatorias
      if (!context.student_uuid) {
        throw new Error('student_uuid es obligatorio para alquimia.clean.student');
      }
      if (!context.item_kind) {
        throw new Error('item_kind es obligatorio para alquimia.clean.student');
      }
      if (!context.clean_layer || (context.clean_layer !== 'shared' && context.clean_layer !== 'pde')) {
        throw new Error('clean_layer debe ser "shared" o "pde"');
      }
      return {
        student_uuid: context.student_uuid,
        item_ref: context.item_ref,
        item_kind: context.item_kind,
        domain_type: 'transmutation',
        clean_layer: context.clean_layer,
        actor_type: 'master',
        surface_key: 'master.alquimia_general'
      };
    }
  },
  refresh_plan: buildRefreshPlan,
  telemetry: {
    log_input: true,
    log_output: true
  }
});
```

---

## 3. Reglas Constitucionales

### PROHIBIDO

1. **`fetch()` POST directo fuera de `performAction()`**
   - ❌ `await fetch('/master/api/...', { method: 'POST', ... })`
   - ✅ `await window.performAction({ action_id: 'alquimia.clean.all', ... })`

2. **Acciones sin registro en UX Action Registry**
   - ❌ Crear nueva acción sin `registerUxAction()`
   - ✅ Registrar en `alquimia-actions-registry.v1.js` (o equivalente)

3. **Acciones sin `refresh_plan`**
   - ❌ `refresh_plan: null` o omitido
   - ✅ `refresh_plan: buildRefreshPlan` o array de `surface_id`s

4. **Refresh manual post-mutation**
   - ❌ `await fetch(...); await loadItems(...);`
   - ✅ El `refresh_plan` se ejecuta automáticamente vía Refresh Engine

### OBLIGATORIO

1. **Toda mutación UI debe usar `performAction()`**
   ```javascript
   const result = await window.performAction({
     action_id: 'alquimia.clean.all',
     context: {
       item_ref: item.item_ref,
       clean_layer: 'shared',
       item_kind: 'recurrente'
     },
     uiState: {
       view_mode: state.projection.mode,
       view_layer: state.projection.view_layer,
       list_id: state.listaActiva?.id
     }
   });
   ```

2. **Toda acción debe estar registrada ANTES de usarse**
   - Los registries se cargan en fase `core` (antes de `ui`)
   - Verificar en `master-layout-registry.v1.json`

3. **Validaciones explícitas en `buildPayload()`**
   - No inferir valores desde `uiState`
   - Lanzar errores explícitos si faltan campos obligatorios

---

## 4. Forensics: Logs Obligatorios

### Logs Estructurados

Toda acción genera logs forenses estructurados:

```javascript
// Inicio de acción
[UX][ACTION][START] {
  action_id: 'alquimia.clean.all',
  trace_id: 'ux_action_1234567890_abc123',
  endpoint: '/master/api/alquimia-general/items/...',
  method: 'POST',
  payload: { clean_layer: 'shared', item_kind: 'recurrente' },
  context: { item_ref: '...', ... },
  uiState: { view_mode: 'operativa', ... },
  timestamp: '2025-01-15T19:30:00.000Z'
}

// Fin de acción (éxito)
[UX][ACTION][END] {
  action_id: 'alquimia.clean.all',
  trace_id: 'ux_action_1234567890_abc123',
  status: 200,
  ok: true,
  duration_ms: 145,
  has_data: true,
  error: null,
  timestamp: '2025-01-15T19:30:00.145Z'
}

// Error
[UX][ACTION][ERROR] {
  action_id: 'alquimia.clean.all',
  trace_id: 'ux_action_1234567890_abc123',
  endpoint: '/master/api/...',
  error: 'Error message',
  stack: '...',
  timestamp: '2025-01-15T19:30:00.200Z'
}
```

### Trace ID

- **Formato**: `ux_action_{timestamp}_{random}`
- **Propósito**: Correlacionar logs de acción → refresh → render
- **Propagación**: Se pasa a Refresh Engine y surfaces

---

## 5. Versionado

### Versión Actual: v1

- **Registry**: `ux-action-registry.v1.js`
- **Wrapper**: `perform-action.v1.js`
- **Contrato**: Este documento

### Futuras Versiones

Cuando se requiera una versión v2:

1. **Crear nuevos archivos**:
   - `ux-action-registry.v2.js`
   - `perform-action.v2.js`

2. **Mantener compatibilidad**:
   - v1 sigue funcionando
   - v2 se activa por feature flag o migración explícita

3. **Actualizar documentación**:
   - Crear `UX_CONTRACT_V2.md`
   - Documentar breaking changes

### Migración v1 → v2

- **No automática**: Requiere migración explícita por dominio
- **Incremental**: Dominios pueden migrar independientemente
- **Auditable**: Logs de versión en cada acción

---

## 6. Assembly Check

### Script de Verificación

```bash
npm run check:ux-refresh
```

### Qué Detecta

1. **`fetch()` POST fuera de `performAction()`**
   - Error si no está marcado como `[LEGACY_REFRESH_CALL]`
   - Warning si está marcado como legacy

2. **Llamadas a `loadItems/loadListProjection/handleVerItem` en handlers POST**
   - Deben estar en `refresh_plan`, no en el handler

3. **Action IDs sin registro**
   - Verifica que cada `action_id` usado existe en registry

4. **Acciones sin `refresh_plan`**
   - Verifica que todas las acciones registradas tienen `refresh_plan`

### Criterio de Éxito

- **0 errors** = Sistema correcto
- **Warnings** = Legacy marcado (aceptable temporalmente)

---

## 7. Escalabilidad a TODO AuriPortal

### Dominios Actuales

- ✅ **MASTER**: Alquimia General (completado)
- ⏳ **MASTER**: Otros módulos (pendiente)
- ⏳ **GOD**: Pendiente
- ⏳ **ADMIN_LEGACY**: Pendiente (marcado como legacy)

### Patrón de Expansión

1. **Crear registry específico del dominio**:
   - `{domain}-actions-registry.v1.js`
   - `{domain}-surfaces-registry.v1.js`

2. **Registrar en layout registry**:
   - Añadir scripts en `master-layout-registry.v1.json` (o equivalente)

3. **Migrar handlers**:
   - Reemplazar `fetch()` POST por `performAction()`
   - Registrar acciones en registry

4. **Verificar con assembly check**:
   - `npm run check:ux-refresh` debe pasar

### Regla de Autoridad de Vista

> **El backend es la única autoridad de estado. El frontend NO calcula estados.**

El UX Contract v1 **respeta** esta regla:
- `performAction()` ejecuta POST → backend calcula estado
- `refresh_plan` ejecuta GETs → frontend consume estado calculado
- **NO** hay cálculo de estado en frontend

---

## 8. Referencias

- **Implementación**: `src/core/ux/ux-action-registry.v1.js`
- **Wrapper**: `public/js/master/ux/perform-action.v1.js`
- **Ejemplos**: `public/js/master/ux/alquimia-actions-registry.v1.js`
- **Assembly Check**: `scripts/check-ux-refresh-wiring.js`
- **Refresh Contract**: `docs/REFRESH_CONTRACT_V1.md`
- **Invariantes**: `docs/INVARIANTES_CONSTITUCIONALES.md`

---

**Última actualización**: 2025-01-15  
**Mantenido por**: Sistema AuriPortal  
**Estado**: CANÓNICO ✅
