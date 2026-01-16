# RECURRENTE RESET CONTRACT v1

**Versión**: 1.0.0  
**Fecha**: 2025-01-XX  
**Dominio**: MASTER  
**Componente**: Cleaning Engine

---

## 📋 RESUMEN EJECUTIVO

Este contrato define cómo debe funcionar el reset de items `recurrente` en el Cleaning Engine. Un reset debe establecer `effective_since` y resetear contadores (`last_cleaned_at`, `clean_count`) para que `clean_all` funcione correctamente después del reset.

---

## 🎯 REGLAS CONSTITUCIONALES

### Regla 1: Reset Completo para Recurrente

**TODA reset de item `recurrente` debe**:

1. ✅ Establecer `effective_since = NOW()` (punto de partida para cálculo de días)
2. ✅ **Establecer `last_cleaned_at = NULL`** (forzar recálculo desde `effective_since`)
3. ✅ **Establecer `clean_count = 0`** (resetear contador de limpiezas)
4. ✅ Mantener `remaining = required_count` (si aplica)

**PROHIBIDO**: Resetear solo `effective_since` sin resetear contadores.

### Regla 2: Reset Parcial para Una_vez

**TODA reset de item `una_vez` debe**:

1. ✅ Establecer `effective_since = NOW()` (punto de partida)
2. ✅ **NO resetear `last_cleaned_at`** (una_vez mantiene historial)
3. ✅ **NO resetear `completed`** (una_vez mantiene contador)

**RAZÓN**: `una_vez` tiene contadores distintos (`completed`, `remaining`) que no se resetean.

---

## 🔧 IMPLEMENTACIÓN

### Función: `upsertApplyReset`

**Archivo**: `src/infra/repos/cleaning/cleaning-item-state-repo-pg.js`

**Parámetros**:
- `options.student_uuid` (OBLIGATORIO)
- `options.item_ref` (OBLIGATORIO)
- `options.clean_layer` (OBLIGATORIO: `'shared'` | `'pde'`)
- `options.item_kind` (OPCIONAL: `'recurrente'` | `'una_vez'`)

**Comportamiento**:

```javascript
// Si item_kind === 'recurrente'
INSERT INTO cleaning_item_state (
  student_id, product_key, domain_type, item_ref,
  ${effectiveSinceColumn}, ${lastCleanedColumn}, ${countColumn}
) VALUES (
  $1, $2, $3, $4, NOW(), NULL, 0
)
ON CONFLICT (...) 
DO UPDATE SET
  ${effectiveSinceColumn} = NOW(),
  ${lastCleanedColumn} = NULL,  -- ✅ RESET
  ${countColumn} = 0,            -- ✅ RESET
  updated_at = CURRENT_TIMESTAMP

// Si item_kind !== 'recurrente' (o no se especifica)
INSERT INTO cleaning_item_state (
  student_id, product_key, domain_type, item_ref,
  ${effectiveSinceColumn}
) VALUES (
  $1, $2, $3, $4, NOW()
)
ON CONFLICT (...) 
DO UPDATE SET
  ${effectiveSinceColumn} = NOW(),
  updated_at = CURRENT_TIMESTAMP
```

### Columnas por `clean_layer`

**`clean_layer = 'shared'`**:
- `effectiveSinceColumn = 'shared_effective_since'`
- `lastCleanedColumn = 'shared_last_cleaned_at'`
- `countColumn = 'shared_clean_count'`

**`clean_layer = 'pde'`**:
- `effectiveSinceColumn = 'pde_effective_since'`
- `lastCleanedColumn = 'pde_last_cleaned_at'`
- `countColumn = 'pde_clean_count'`

---

## 🔍 FLUJO DE RESET

### Paso 1: Validación

1. Verificar que `item_ref` existe
2. Verificar que `item_kind === 'recurrente'` (si se especifica)
3. Verificar que `clean_layer` es válido (`'shared'` | `'pde'`)

### Paso 2: Reset de Proyección

1. Insertar evento en `cleaning_events` (idempotente)
2. Llamar a `upsertApplyReset` con `item_kind`
3. Si `item_kind === 'recurrente'`, resetear contadores
4. Si `item_kind !== 'recurrente'`, solo resetear `effective_since`

### Paso 3: Verificación

1. Verificar que `effective_since = NOW()`
2. Si `item_kind === 'recurrente'`, verificar que `last_cleaned_at = NULL` y `clean_count = 0`
3. Ejecutar `clean_all` y verificar que funciona correctamente

---

## 📊 CASOS DE USO

### Caso 1: Reset Item Recurrente (scope='student')

**Input**:
- `item_ref = 'item_123'`
- `student_uuid = 'uuid_456'`
- `item_kind = 'recurrente'`
- `clean_layer = 'shared'`

**Resultado Esperado**:
- `shared_effective_since = NOW()`
- `shared_last_cleaned_at = NULL` ✅
- `shared_clean_count = 0` ✅

**Verificación**:
- Ejecutar `clean_all` después del reset
- **VERIFICAR**: Item pasa a estado `pending` correctamente
- **VERIFICAR**: `clean_all` incrementa `clean_count` (antes NO funcionaba)

### Caso 2: Reset Item Una_vez (scope='student')

**Input**:
- `item_ref = 'item_789'`
- `student_uuid = 'uuid_456'`
- `item_kind = 'una_vez'`
- `clean_layer = 'shared'`

**Resultado Esperado**:
- `shared_effective_since = NOW()`
- `shared_last_cleaned_at` **NO se resetea** (mantiene valor anterior)
- `completed` **NO se resetea** (mantiene valor anterior)

**Verificación**:
- Ejecutar increment después del reset
- **VERIFICAR**: Contadores se incrementan correctamente

---

## 🚫 PROHIBICIONES

### Prohibido 1: Resetear contadores en una_vez

**REGLA**: `una_vez` **NUNCA** debe resetear `completed` o `remaining` durante un reset.

**RAZÓN**: `una_vez` mantiene contadores de progreso que no se resetean.

### Prohibido 2: Resetear solo `effective_since` en recurrente

**REGLA**: `recurrente` **NUNCA** debe resetear solo `effective_since` sin resetear contadores.

**RAZÓN**: Si `last_cleaned_at` no se resetea, `clean_all` no funciona correctamente (alumnos quedan en `pending`).

---

## ✅ VERIFICACIÓN

### Assembly Check

```bash
# Verificar que no hay errores de sintaxis
npm run check:master-ui
```

### Tests Manuales

1. Seleccionar item `recurrente` con estado `reviewed`
2. Ejecutar reset (botón "Reset progreso" o "Reset ALL")
3. Verificar en base de datos:
   ```sql
   SELECT 
     shared_effective_since, 
     shared_last_cleaned_at, 
     shared_clean_count
   FROM cleaning_item_state
   WHERE item_ref = '...' AND student_id = '...'
   ```
4. **VERIFICAR**: `shared_last_cleaned_at = NULL` y `shared_clean_count = 0`
5. Ejecutar `clean_all`
6. **VERIFICAR**: Item pasa a estado `pending` correctamente
7. **VERIFICAR**: `clean_all` incrementa `clean_count` (antes NO funcionaba)

---

## 📚 REFERENCIAS

- `docs/DIAGNOSTICO_CONTRATOS_ROTOS_ALQUIMIA_GENERAL_V2.md` (diagnóstico inicial)
- `src/core/master/services/cleaning-engine-service.js` (lógica de reset)
- `src/infra/repos/cleaning/cleaning-item-state-repo-pg.js` (implementación SQL)

---

**FIN DEL CONTRATO**
