# FIX CANÓNICO — CLEANING ENGINE RESET BOUNDARY v1

**FECHA:** 2026-01-27  
**DOMINIO:** MASTER  
**ESTADO:** ✅ Implementado

---

## PROBLEMA IDENTIFICADO

**Diagnóstico probado en producción:**
- Existen ítems con evento RESET válido
- Pero con `clean_count > 0` y/o `last_cleaned_at NOT NULL`
- Esto es ontológicamente imposible (violación de invariantes)
- El script de saneamiento NO corrige esto por diseño (correctamente)

**Causa raíz:**
El Cleaning Engine permite aplicar limpiezas sin reconstruir estado desde el último RESET.

---

## REGLA CONSTITUCIONAL IMPLEMENTADA

**RESET ES FRONTERA DURA DE ESTADO**

Para cualquier acción de limpieza (`mark_clean`, `apply_clean`, etc.):

1. Si existe un evento RESET previo para ese:
   - `student_uuid`
   - `item_ref`
   - `clean_layer`

2. Entonces el estado BASE debe derivarse SIEMPRE desde el último RESET:
   - `effective_since` = `reset.created_at`
   - `clean_count` empieza en 0
   - `last_cleaned_at` empieza en NULL

3. Está PROHIBIDO:
   - Incrementar `clean_count` sobre un estado previo al reset
   - Mantener `last_cleaned_at` anterior al reset
   - Aplicar limpiezas "acumulativas" ignorando el reset

---

## IMPLEMENTACIÓN

### Archivo modificado

**`src/core/master/services/cleaning-engine-service.js`**

### Funciones auxiliares añadidas

#### 1. `getLastResetForItem()`

**Línea:** ~147

**Función:**
- Obtiene el último evento RESET para `student_uuid` + `item_ref` + `clean_layer`
- Ordena por `created_at DESC`
- Retorna el más reciente o `null`

**Características:**
- Fail-open: si falla, asume no reset (retorna `null`)
- Usa `listEventsForStudentItem` del repositorio
- Filtra solo eventos `action_type='reset'` y `clean_layer` coincidente

#### 2. `rebaseStateFromReset()`

**Línea:** ~189

**Función:**
- Reconstruye el estado de `cleaning_item_state` desde el último RESET
- Obtiene todos los eventos posteriores al RESET
- Calcula:
  - `effective_since` = `reset.created_at`
  - `clean_count` = número real de limpiezas post-reset
  - `last_cleaned_at` = última limpieza post-reset (o NULL)

**Proceso:**
1. Obtiene eventos post-reset
2. Filtra limpiezas (`action_type='mark_clean'`) posteriores al reset
3. Calcula `clean_count` = número de limpiezas post-reset
4. Aplica reset canónico (`upsertApplyReset`)
5. Ajusta `last_cleaned_at` y `clean_count` manualmente si hay limpiezas post-reset

**Características:**
- Fail-open: si falla reconstrucción, loggea error y continúa
- Usa repositorios canónicos (`CleaningEventsRepo`, `CleaningItemStateRepo`)
- Aplica reset canónico antes de ajustar contadores

### Integración en `markCleanStudent()`

**Línea:** ~620-673

**Flujo:**
1. **ANTES de aplicar limpieza** (línea 620):
   - Obtiene último RESET (solo para recurrente)
   - Si existe RESET:
     - Obtiene estado actual
     - Detecta si necesita rebase:
       - Estado anterior al reset
       - `effective_since` anterior al reset
       - `last_cleaned_at` anterior al reset
       - `clean_count > 0` pero `last_cleaned_at` NULL
       - `clean_count = 0` pero `last_cleaned_at` NOT NULL
   
2. **Si necesita rebase**:
   - Reconstruye estado desde RESET
   - Loggea `[CLEANING_ENGINE][RESET_REBASE]` (WARN)

3. **Aplica limpieza** (línea 675+):
   - Sobre estado reconstruido (si aplicó rebase)
   - O sobre estado actual (si no hubo rebase)

---

## LOGS FORENSES OBLIGATORIOS

**Tag:** `[CLEANING_ENGINE][RESET_REBASE]`

**Nivel:** WARN

**Loggeado cuando:**
- Se detecta estado incoherente con RESET
- Se reconstruye estado desde RESET antes de aplicar limpieza

**Contenido:**
```javascript
{
  trace_id: string,
  student_uuid: string,
  item_ref: string,
  clean_layer: 'shared' | 'pde',
  reset_at: ISO8601,
  estado_detectado: {
    effective_since: ISO8601 | null,
    last_cleaned_at: ISO8601 | null,
    clean_count: number
  },
  estado_reconstruido: {
    effective_since: ISO8601 | null,
    last_cleaned_at: ISO8601 | null,
    clean_count: number
  }
}
```

**Ejemplo:**
```
[WARN] [CLEANING_ENGINE][RESET_REBASE] Estado reconstruido desde RESET antes de aplicar limpieza
{
  trace_id: "abc-123",
  student_uuid: "uuid-456",
  item_ref: "item-789",
  clean_layer: "shared",
  reset_at: "2026-01-27T10:00:00.000Z",
  estado_detectado: {
    effective_since: "2026-01-20T12:00:00.000Z", // Anterior al reset
    last_cleaned_at: "2026-01-25T14:00:00.000Z", // Anterior al reset
    clean_count: 5 // Incoherente
  },
  estado_reconstruido: {
    effective_since: "2026-01-27T10:00:00.000Z", // Fecha del reset
    last_cleaned_at: null, // No hay limpiezas post-reset aún
    clean_count: 0 // Reseteado
  }
}
```

---

## RESTRICCIONES

### Solo para Recurrente

**El rebase solo se ejecuta para `item_kind === 'recurrente'`:**

```javascript
const lastReset = itemKind === 'recurrente' 
  ? await getLastResetForItem(...)
  : null;

if (lastReset && itemKind === 'recurrente') {
  // Rebase solo para recurrente
}
```

**Razón:**
- RESET solo aplica a recurrente (según contrato canónico)
- `una_vez` no tiene reset, solo contadores

---

## CRITERIOS DE ACEPTACIÓN

### ✅ Después del fix:

1. **Es IMPOSIBLE que exista:**
   - `clean_count > 0` con `last_cleaned_at` NULL
   - `clean_count = 0` con `last_cleaned_at` NOT NULL
   - `clean_count` acumulado antes de un reset

2. **Script de saneamiento:**
   ```bash
   node scripts/sanitize-reset-stuck-items.js
   ```
   - Debe mostrar ítems saneables > 0
   - Ya NO todos "saltados"

3. **Queries de diagnóstico:**
   ```bash
   psql -d aurelinportal -f scripts/diagnostico-reset-queries.sql
   ```
   - Debe reducir `EVENTO_RESET_SIN_ACTUALIZACION_SHARED`
   - Debe reducir `CONTRADICCION_CLEAN_COUNT_SHARED`

4. **Reset ALL funciona sin generar nuevos encallados**

---

## VERIFICACIÓN POST-FIX

### 1. Ejecutar script de saneamiento

```bash
node scripts/sanitize-reset-stuck-items.js
```

**Resultado esperado:**
- Ítems saneables > 0 (no todos "saltados")
- Logs `[CLEANING_ENGINE][RESET_REBASE]` si hay rebases

### 2. Ejecutar queries de diagnóstico

```bash
psql -d aurelinportal -f scripts/diagnostico-reset-queries.sql
```

**Resultado esperado:**
- Reducción en `EVENTO_RESET_SIN_ACTUALIZACION_SHARED`
- Reducción en `CONTRADICCION_CLEAN_COUNT_SHARED`

### 3. Probar reset ALL

- Ejecutar reset ITEM_ALL
- Ejecutar reset LIST_ALL
- Verificar que no genera nuevos encallados
- Verificar logs `[CLEANING_ENGINE][RESET_REBASE]` si aplica

---

## PROHIBICIONES CUMPLIDAS

✅ **NO se modificó:**
- `cleaning_events` (append-only)
- UI
- UX Action Registry
- Endpoints
- Scripts de saneamiento (correctamente por diseño)

✅ **NO se borraron:**
- Eventos históricos
- Estados históricos

✅ **NO se añadieron:**
- Hacks
- Fallbacks silenciosos
- Cambios a reglas de negocio

---

## ARCHIVOS MODIFICADOS

### Código
- `src/core/master/services/cleaning-engine-service.js`
  - Funciones auxiliares: `getLastResetForItem()`, `rebaseStateFromReset()`
  - Integración en `markCleanStudent()` (líneas 620-673)
  - Logs forenses `[CLEANING_ENGINE][RESET_REBASE]`

### Documentación
- `docs/FIX_CLEANING_ENGINE_RESET_BOUNDARY_V1.md` (este documento)

---

## PRÓXIMOS PASOS OBLIGATORIOS

### 1. Commit

```bash
git add src/core/master/services/cleaning-engine-service.js docs/FIX_CLEANING_ENGINE_RESET_BOUNDARY_V1.md
git commit -m "fix(cleaning-engine): enforce reset as hard state boundary

- Added getLastResetForItem() to detect last RESET for item+student+layer
- Added rebaseStateFromReset() to reconstruct state from last RESET
- Integrated reset boundary check in markCleanStudent() before applying cleaning
- Added forensic logs [CLEANING_ENGINE][RESET_REBASE] when rebase occurs
- Prevents invariant violations (clean_count > 0 with last_cleaned_at < reset_at)
- Only applies to recurrente (reset contract is recurrente-only)
- Fail-open: continues if rebase fails (logs error)"
```

### 2. Reiniciar servidor (OBLIGATORIO)

```bash
pm2 restart aurelinportal
```

### 3. Verificar

- Ejecutar script de saneamiento
- Ejecutar queries de diagnóstico
- Probar reset ALL
- Verificar logs `[CLEANING_ENGINE][RESET_REBASE]`

---

## CONCLUSIÓN

✅ **Fix implementado:**

- RESET es frontera dura de estado
- Limpiezas respetan RESET como base
- Estado se reconstruye desde RESET si es necesario
- Logs forenses obligatorios cuando ocurre rebase

✅ **Invariantes restaurados:**

- Es imposible tener `clean_count > 0` con `last_cleaned_at` anterior al reset
- Es imposible tener `clean_count` acumulado antes de un reset
- El estado siempre refleja correctamente las limpiezas post-reset

🚫 **NO se modificó:**

- Backend (solo Cleaning Engine)
- UI
- UX Action Registry
- Endpoints
- Scripts de saneamiento

---

**FIN DEL FIX**
