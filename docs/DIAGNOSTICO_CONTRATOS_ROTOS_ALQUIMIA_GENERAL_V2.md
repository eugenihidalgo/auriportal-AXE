# DIAGNÓSTICO CONTRATOS ROTOS - Alquimia General v2

**Fecha**: 2025-01-XX  
**Arquitecto**: Auto (Cursor)  
**Versión**: v5.76.0  
**Objetivo**: Auditar contratos rotos en Alquimia General SIN TOCAR CÓDIGO

---

## 📋 RESUMEN EJECUTIVO

Se identifican **4 problemas mayores** que rompen contratos constitucionales:

1. **UX ACTIONS**: Botones `reset.item.all` y `reset.list.all` aparecen en modo OPERATIVA (solo deben aparecer en PROYECCIÓN + scope='all')
2. **RESET RECURRENTE**: Tras reset, `clean_all` no incrementa y alumnos quedan en `pending` (no se resetea `last_cleaned_at`, solo `effective_since`)
3. **DTO FLOTANTE**: Contrato correcto (ya tiene `effective` calculado) ✅
4. **RUNTIME INTEGRITY**: Se ejecuta antes de que los scripts estén listos (no espera `AP_MASTER_SCRIPTS_READY`)

---

## 1️⃣ UX ACTIONS — VISIBILIDAD INCORRECTA

### PROBLEMA DETECTADO

Los botones **"Reset ALL"** y **"Reset lista ALL"** aparecen en modo **OPERATIVA** cuando deberían aparecer **SOLO en PROYECCIÓN + scope='all'**.

### UBICACIÓN DEL CÓDIGO

#### 1.1. Botón "Reset ALL" (por item)
**Archivo**: `public/js/master/master-alquimia-general-client.js`  
**Líneas**: `4647-4699`

```4647:4699:public/js/master/master-alquimia-general-client.js
        // ============================================================================
        // FIX MAJOR: Botón RESET ALL (solo para recurrente, scope='all')
        // ============================================================================
        if (state.projection.scope === 'all') {
          const btnResetAll = document.createElement('button');
          btnResetAll.textContent = 'Reset ALL';
          // ... resto del código ...
        }
```

**PROBLEMA**: Solo verifica `scope === 'all'`, **NO verifica `view_mode === 'proyeccion'`**.

**FUNCIÓN**: `createItemTableRow()` — se usa tanto en PROYECCIÓN como en OPERATIVA.

#### 1.2. Botón "Reset lista ALL"
**Archivo**: `public/js/master/master-alquimia-general-client.js`  
**Líneas**: `1686-1746`

```1686:1746:public/js/master/master-alquimia-general-client.js
    // ============================================================================
    // FIX MAJOR: Botón Reset Lista ALL (solo para recurrente, scope='all')
    // ============================================================================
    if (state.projection.scope === 'all' && state.listaActiva) {
      const itemKind = state.tipoActivo; // 'recurrente' | 'una_vez'
      if (itemKind === 'recurrente') {
        const resetListAllContainer = document.createElement('div');
        // ... resto del código ...
      }
    }
```

**PROBLEMA**: Solo verifica `scope === 'all'`, **NO verifica `view_mode === 'proyeccion'`**.

**FUNCIÓN**: `renderProjectionView()` — aunque el nombre sugiere "proyección", NO valida el `view_mode` explícitamente.

### CONTRATO ESPERADO

**REGLA CONSTITUCIONAL**: Las acciones `reset.item.all` y `reset.list.all` deben tener **visibilidad explícita** por:

- `surface_id`: `alquimia.list_projection` (SOLO en proyección)
- `view_mode`: `'proyeccion'` (OBLIGATORIO)
- `scope`: `'all'` (OBLIGATORIO)
- `item_kind`: `'recurrente'` (OBLIGATORIO)

**PROHIBIDO**: Mostrar estos botones en modo OPERATIVA (`view_mode === 'operativa'`).

### ACCIONES EN REGISTRY

**Archivo**: `public/js/master/ux/alquimia-actions-registry.v1.js`

- `alquimia.reset.item.all` (líneas 280-309): ✅ Valida `item_kind === 'recurrente'`, pero **NO declara visibilidad por `view_mode`**.
- `alquimia.reset.list.all` (líneas 314-343): ✅ Valida `item_kind === 'recurrente'`, pero **NO declara visibilidad por `view_mode`**.

### PROPUESTA DE CONTRATO

**AÑADIR al registro de acciones**:
```javascript
visibility: {
  surface_id: ['alquimia.list_projection'],
  view_mode: ['proyeccion'],
  scope: ['all'],
  item_kind: ['recurrente']
}
```

**VALIDAR en UI** antes de renderizar:
```javascript
if (state.projection.scope === 'all' && 
    state.projection.mode === 'proyeccion' && 
    itemKind === 'recurrente') {
  // Renderizar botón
}
```

---

## 2️⃣ RESET RECURRENTE — CONTADORES NO SE RESETEAN

### PROBLEMA DETECTADO

Tras ejecutar `reset` en un item recurrente:
- ✅ `effective_since` se establece correctamente (vía `upsertApplyReset`)
- ❌ `last_cleaned_at` **NO se resetea** (queda con fecha anterior)
- ❌ `completed` **NO se resetea** (queda con contador anterior)
- **CONSECUENCIA**: `clean_all` no incrementa porque el sistema piensa que ya está limpio (según `last_cleaned_at`).

### UBICACIÓN DEL CÓDIGO

#### 2.1. Función de Reset (Cleaning Engine)
**Archivo**: `src/core/master/services/cleaning-engine-service.js`  
**Líneas**: `1395-1402`

```1395:1402:src/core/master/services/cleaning-engine-service.js
        // Aplicar reset a proyección (establecer effective_since)
        await stateRepo.upsertApplyReset({
          student_uuid,
          product_key,
          domain_type,
          item_ref,
          clean_layer: layer
        }, client);
```

**PROBLEMA**: Solo llama a `upsertApplyReset`, que **NO resetea `last_cleaned_at` ni `completed`**.

#### 2.2. Repositorio `upsertApplyReset`
**Archivo**: `src/infra/repos/cleaning/cleaning-item-state-repo-pg.js`  
**Líneas**: `338-385`

**PROBLEMA DETECTADO**: La función `upsertApplyReset` solo actualiza:
- `effective_since = NOW()` (resetea el "punto de partida" para calcular días)
- **NO actualiza** `last_cleaned_at` (queda con fecha anterior)
- **NO actualiza** `completed` (queda con contador anterior)

**CONSECUENCIA**: Cuando se calcula el estado visual después del reset:
- `days_since_last_clean` se calcula desde `last_cleaned_at` anterior (NO desde `effective_since`)
- Si `last_cleaned_at` es reciente, el item aparece como `reviewed` en lugar de `pending`
- `clean_all` no incrementa porque `last_cleaned_at` ya está actualizado

### CONTRATO ESPERADO

**REGLA CONSTITUCIONAL**: Un `reset` en item recurrente debe:

1. ✅ Establecer `effective_since = NOW()` (punto de partida para cálculo de días)
2. ✅ **Establecer `last_cleaned_at = NULL`** (forzar recálculo desde `effective_since`)
3. ✅ **Establecer `completed = 0`** (resetear contador de limpiezas)
4. ✅ Mantener `remaining = required_count` (si aplica)

**CONTRATO ACTUAL** (incorrecto):
- `effective_since = NOW()` ✅
- `last_cleaned_at` = **NO SE RESETEA** ❌
- `completed` = **NO SE RESETEA** ❌

### PROPUESTA DE FIX

**MODIFICAR `upsertApplyReset`** para que además de `effective_since`, resetea:
```sql
UPDATE cleaning_item_state
SET 
  effective_since = NOW(),
  last_cleaned_at = NULL,  -- RESET obligatorio
  completed = 0,            -- RESET obligatorio (si es recurrente)
  updated_at = NOW()
WHERE ...
```

**VALIDAR `item_kind`**: Solo resetear `completed` si `item_kind === 'recurrente'` (una_vez no tiene `completed`).

---

## 3️⃣ DTO FLOTANTE — CONTRATO CORRECTO ✅

### VERIFICACIÓN

**Archivo**: `src/services/alquimia-general-service.js`  
**Líneas**: `760-788`

```779:788:src/services/alquimia-general-service.js
          // FIX MAJOR: EFFECTIVE es OBLIGATORIO para recurrente (composición determinista de SHARED + PDE)
          effective: computeVisualState({
            shared: sharedData,
            pde: pdeData,
            combo: null,
            item_kind: 'recurrente',
            view_layer: 'effective',
            config: effectiveConfig
          })
```

**ESTADO**: ✅ **CORRECTO**

El DTO del flotante **SÍ calcula `effective`** para items `recurrente`, cumpliendo el contrato canónico.

**CONTRATO MÍNIMO CUMPLIDO**:
- ✅ `state_by_view_layer.shared` (presente)
- ✅ `state_by_view_layer.pde` (presente)
- ✅ `state_by_view_layer.effective` (presente para `recurrente`)

**NO SE REQUIERE FIX** en este punto.

---

## 4️⃣ RUNTIME INTEGRITY — ORDEN DE EJECUCIÓN INCORRECTO

### PROBLEMA DETECTADO

El `runtime-integrity-check.v1.js` se ejecuta **INMEDIATAMENTE** (IIFE autoejecutable), **ANTES** de que todos los scripts estén cargados.

**CONSECUENCIA**: El check puede fallar si se ejecuta antes de que `ux-action-registry-loader.js` o `ux-action-schema.js` terminen de cargar.

### UBICACIÓN DEL CÓDIGO

**Archivo**: `public/js/core/runtime/runtime-integrity-check.v1.js`  
**Líneas**: `21-100`

```21:100:public/js/core/runtime/runtime-integrity-check.v1.js
(function() {
  'use strict';

  console.log('[RuntimeIntegrityCheck] start');

  // Verificar que Runtime Ready Gate existe
  if (!window.__AP_RUNTIME_READY__) {
    // ...
    return;
  }

  // Verificar que el estado es 'booting' (no debe estar ready o broken antes del check)
  const currentState = window.__AP_RUNTIME_READY__.state();
  if (currentState !== 'booting') {
    // ...
    return;
  }

  // ... verificaciones de integridad ...

  // Si todo está ok, marcar como ready
  console.log('[RuntimeIntegrityCheck] ✅ Integridad verificada - todos los componentes críticos disponibles');
  window.__AP_RUNTIME_READY__.resolveReady();
})();
```

**PROBLEMA**: El IIFE se ejecuta **inmediatamente** al cargar el script, sin esperar a:
- `AP_MASTER_SCRIPTS_READY` (evento de scripts cargados)
- Validación contra `required_scripts` del contrato (`master-layout-registry.v1.json`)

### CONTRATO ESPERADO

**REGLA CONSTITUCIONAL**: El `runtime-integrity-check` debe:

1. ✅ Ejecutarse **DESPUÉS** de que todos los `required_scripts` estén cargados
2. ✅ Validar contra el contrato (`master-layout-registry.v1.json` → `required_scripts`)
3. ✅ Esperar a `AP_MASTER_SCRIPTS_READY` (evento) si existe
4. ✅ O usar `DOMContentLoaded` / `window.addEventListener('load')` como fallback

**CONTRATO ACTUAL** (incorrecto):
- ❌ Se ejecuta inmediatamente (IIFE)
- ❌ No espera a `AP_MASTER_SCRIPTS_READY`
- ❌ No valida contra `required_scripts`

### PROPUESTA DE FIX

**OPCIÓN A**: Esperar a `AP_MASTER_SCRIPTS_READY`:
```javascript
if (window.AP_MASTER_SCRIPTS_READY) {
  window.addEventListener('AP_MASTER_SCRIPTS_READY', () => {
    runIntegrityCheck();
  });
} else {
  // Fallback: esperar a DOMContentLoaded
  document.addEventListener('DOMContentLoaded', () => {
    runIntegrityCheck();
  });
}
```

**OPCIÓN B**: Validar contra `required_scripts` del contrato:
```javascript
// Leer master-layout-registry.v1.json
const registry = await fetch('/master/api/__layout-registry').then(r => r.json());
const requiredScripts = registry.required_scripts || [];

// Verificar que todos los scripts están cargados
const allLoaded = requiredScripts.every(script => {
  return window.__AP_ASSETS__?.[script.id]?.status === 'loaded';
});

if (allLoaded) {
  runIntegrityCheck();
} else {
  console.warn('[RuntimeIntegrityCheck] Esperando a que todos los scripts se carguen...');
}
```

---

## 📊 TABLA RESUMEN

| # | Problema | Severidad | Ubicación | Estado |
|---|----------|-----------|-----------|--------|
| 1 | UX ACTIONS visibilidad | **CRÍTICO** | `master-alquimia-general-client.js:4647, 1686` | ❌ ROTO |
| 2 | RESET no resetea contadores | **CRÍTICO** | `cleaning-engine-service.js:1396` + `cleaning-item-state-repo-pg.js:338` | ❌ ROTO |
| 3 | DTO FLOTANTE contrato | **OK** | `alquimia-general-service.js:779` | ✅ CORRECTO |
| 4 | RUNTIME INTEGRITY orden | **ALTO** | `runtime-integrity-check.v1.js:21` | ❌ ROTO |

---

## 🎯 PRÓXIMOS PASOS

**FASE 2 — FIXES CONTROLADOS**:
1. Añadir validación `view_mode === 'proyeccion'` en botones reset ALL
2. Modificar `upsertApplyReset` para resetear `last_cleaned_at` y `completed`
3. Modificar `runtime-integrity-check` para esperar a scripts cargados

**FASE 3 — VERIFICACIÓN**:
- Logs esperados tras fixes
- Comportamiento UI esperado
- Estados que deben transicionar

**FASE 4 — DOCUMENTACIÓN**:
- `UX_ACTION_VISIBILITY_CONTRACT.md`
- `RECURRENTE_RESET_CONTRACT.md`
- `RUNTIME_INTEGRITY_ORDER_V1.md`

---

**FIN DEL DIAGNÓSTICO**  
✅ **NO SE HA MODIFICADO CÓDIGO** — Solo auditoría y documentación
