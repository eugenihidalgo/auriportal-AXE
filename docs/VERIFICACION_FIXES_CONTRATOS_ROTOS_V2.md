# VERIFICACIÓN FIXES CONTRATOS ROTOS - Alquimia General v2

**Fecha**: 2025-01-XX  
**Versión**: v5.76.1  
**Objetivo**: Verificar que los fixes de contratos rotos funcionan correctamente

---

## 📋 RESUMEN EJECUTIVO

Después de aplicar los fixes, se debe verificar:

1. ✅ **UX ACTIONS**: Botones reset ALL solo aparecen en PROYECCIÓN + scope='all'
2. ✅ **RESET RECURRENTE**: Tras reset, `clean_all` funciona correctamente (alumnos pasan a `pending`)
3. ✅ **DTO FLOTANTE**: Contrato correcto (ya estaba bien, no requiere verificación)
4. ✅ **RUNTIME INTEGRITY**: Check se ejecuta después de scripts cargados

---

## 1️⃣ UX ACTIONS — VISIBILIDAD CORRECTA

### LOGS ESPERADOS (CONSOLA NAVEGADOR)

**ANTES DEL FIX**: Botones reset ALL aparecían en modo OPERATIVA (incorrecto)

**DESPUÉS DEL FIX**: 
- ❌ **NO** debe aparecer logs de botones reset ALL en modo OPERATIVA
- ✅ Botones reset ALL **SOLO** aparecen cuando:
  - `view_mode === 'proyeccion'`
  - `scope === 'all'`
  - `item_kind === 'recurrente'`

### COMPORTAMIENTO UI ESPERADO

#### Escenario 1: PROYECCIÓN + scope='all' + recurrente
- ✅ Botón "Reset ALL" visible en tabla de items
- ✅ Botón "Reset lista ALL" visible en header de proyección
- ✅ Ambos botones funcionales

#### Escenario 2: OPERATIVA + scope='all' + recurrente
- ❌ Botón "Reset ALL" **NO visible** en tabla de items
- ❌ Botón "Reset lista ALL" **NO visible** en header
- ✅ Botones de limpieza normales (Limpiar, Limpiar interno) siguen visibles

#### Escenario 3: PROYECCIÓN + scope='student' + recurrente
- ❌ Botón "Reset ALL" **NO visible** (solo reset por alumno)
- ❌ Botón "Reset lista ALL" **NO visible** (solo reset por alumno)
- ✅ Botones reset individuales (Reset progreso) siguen visibles

### VERIFICACIÓN MANUAL

1. Ir a `/master/templo-luz/alquimia-general`
2. Seleccionar lista con items `recurrente`
3. Cambiar a modo **OPERATIVA** (`view_mode = 'operativa'`, `scope = 'all'`)
4. Verificar que **NO** aparecen botones "Reset ALL" ni "Reset lista ALL"
5. Cambiar a modo **PROYECCIÓN** (`view_mode = 'proyeccion'`, `scope = 'all'`)
6. Verificar que **SÍ** aparecen botones "Reset ALL" y "Reset lista ALL"

---

## 2️⃣ RESET RECURRENTE — CONTADORES RESETEADOS

### LOGS ESPERADOS (BACKEND)

**ANTES DEL FIX**:
```
[CleaningItemStateRepo] [RESET][CANONICAL][CPM_V2] Reset aplicado (effective_since)
```
- Solo mostraba `effective_since_column`
- **NO** reseteaba `last_cleaned_at` ni `clean_count`

**DESPUÉS DEL FIX**:
```
[CleaningItemStateRepo] [RESET][CANONICAL][CPM_V2] Reset aplicado
{
  student_uuid: "...",
  item_ref: "...",
  clean_layer: "shared",
  item_kind: "recurrente",
  effective_since_column: "shared_effective_since",
  reset_counters: true,  // ✅ NUEVO
  independence_check: "SOLO SHARED columns"
}
```

### LOGS ESPERADOS (SQL)

**ANTES DEL FIX** (ejemplo):
```sql
UPDATE cleaning_item_state
SET 
  shared_effective_since = NOW(),
  updated_at = CURRENT_TIMESTAMP
WHERE ...
```
- ❌ `shared_last_cleaned_at` **NO se actualizaba** (quedaba con fecha anterior)
- ❌ `shared_clean_count` **NO se actualizaba** (quedaba con contador anterior)

**DESPUÉS DEL FIX** (ejemplo para recurrente):
```sql
INSERT INTO cleaning_item_state (
  student_id, product_key, domain_type, item_ref,
  shared_effective_since, shared_last_cleaned_at, shared_clean_count
) VALUES (
  $1, $2, $3, $4, NOW(), NULL, 0
)
ON CONFLICT (...) 
DO UPDATE SET
  shared_effective_since = NOW(),
  shared_last_cleaned_at = NULL,  -- ✅ RESET
  shared_clean_count = 0,          -- ✅ RESET
  updated_at = CURRENT_TIMESTAMP
```
- ✅ `shared_last_cleaned_at = NULL` (reseteado)
- ✅ `shared_clean_count = 0` (reseteado)

### COMPORTAMIENTO ESPERADO

#### Escenario 1: Reset item recurrente
1. Item tiene `last_cleaned_at = '2025-01-10'` y `clean_count = 5`
2. Ejecutar reset (scope='student' o scope='all')
3. **DESPUÉS DEL FIX**:
   - ✅ `effective_since = NOW()` (punto de partida)
   - ✅ `last_cleaned_at = NULL` (reseteado)
   - ✅ `clean_count = 0` (reseteado)
4. Ejecutar `clean_all` (o limpieza individual)
5. **VERIFICAR**: Item pasa a estado `pending` correctamente
6. **VERIFICAR**: `clean_all` **SÍ incrementa** el contador (antes NO funcionaba)

#### Escenario 2: Reset item una_vez
1. Item tiene `last_cleaned_at = '2025-01-10'` y `completed = 3`
2. Ejecutar reset (solo scope='student', no existe reset ALL para una_vez)
3. **DESPUÉS DEL FIX**:
   - ✅ `effective_since = NOW()` (punto de partida)
   - ✅ `last_cleaned_at` **NO se resetea** (solo se resetea si `item_kind === 'recurrente'`)
   - ✅ `completed` **NO se resetea** (una_vez mantiene contador)

### VERIFICACIÓN MANUAL

1. Seleccionar item `recurrente` con estado `reviewed` (limpio recientemente)
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
5. Ejecutar `clean_all` (botón "Limpiar" o "Limpiar interno")
6. **VERIFICAR**: Item pasa a estado `pending` correctamente
7. **VERIFICAR**: `clean_all` incrementa `clean_count` (antes NO funcionaba)

---

## 3️⃣ DTO FLOTANTE — CONTRATO CORRECTO ✅

### VERIFICACIÓN

**ESTADO**: Ya estaba correcto, no requiere verificación adicional.

El DTO del flotante calcula `state_by_view_layer.effective` correctamente para items `recurrente` (línea 779 de `alquimia-general-service.js`).

---

## 4️⃣ RUNTIME INTEGRITY — ORDEN DE EJECUCIÓN CORRECTO

### LOGS ESPERADOS (CONSOLA NAVEGADOR)

**ANTES DEL FIX**:
```
[RuntimeIntegrityCheck] start
[RuntimeIntegrityCheck] ✅ Integridad verificada - todos los componentes críticos disponibles
```
- Se ejecutaba inmediatamente (IIFE)
- Podía fallar si scripts aún no estaban cargados

**DESPUÉS DEL FIX**:
```
[RuntimeIntegrityCheck] start (esperando DOMContentLoaded)
[RuntimeIntegrityCheck] ✅ Integridad verificada - todos los componentes críticos disponibles
```
- Se ejecuta **DESPUÉS** de `DOMContentLoaded`
- Si DOM ya está cargado, ejecuta inmediatamente (sin mensaje de espera)

### COMPORTAMIENTO ESPERADO

#### Escenario 1: Scripts cargan normalmente
1. Página carga, scripts se cargan en orden
2. `runtime-integrity-check.v1.js` se carga
3. **VERIFICAR**: Check espera a `DOMContentLoaded` (si aún no ocurrió)
4. **VERIFICAR**: Check ejecuta verificaciones después de scripts cargados
5. **VERIFICAR**: Runtime marca como `ready` correctamente

#### Escenario 2: Scripts cargan lentamente
1. Página carga, algunos scripts aún cargando
2. `runtime-integrity-check.v1.js` se carga
3. **VERIFICAR**: Check espera a `DOMContentLoaded` (si aún no ocurrió)
4. **VERIFICAR**: Check **NO** ejecuta verificaciones antes de tiempo
5. **VERIFICAR**: Runtime marca como `ready` solo después de verificaciones exitosas

### VERIFICACIÓN MANUAL

1. Abrir `/master/*` (cualquier ruta Master)
2. Abrir consola del navegador
3. Verificar orden de logs:
   - `[RuntimeIntegrityCheck] start` debe aparecer **ANTES** de `[RuntimeIntegrityCheck] ✅`
   - `[RuntimeIntegrityCheck] ✅` debe aparecer **DESPUÉS** de `DOMContentLoaded` (si aplica)
4. Verificar que runtime está `ready`:
   ```javascript
   window.__AP_RUNTIME_READY__.state() // Debe ser 'ready'
   ```

---

## 📊 TABLA RESUMEN DE VERIFICACIÓN

| # | Fix | Logs Esperados | Comportamiento UI | Verificación Manual |
|---|-----|----------------|-------------------|---------------------|
| 1 | UX ACTIONS | ❌ No logs en OPERATIVA | ✅ Botones solo en PROYECCIÓN | Cambiar view_mode y verificar |
| 2 | RESET CONTADORES | ✅ `reset_counters: true` | ✅ clean_all funciona tras reset | Reset + clean_all y verificar estado |
| 3 | DTO FLOTANTE | ✅ N/A (ya correcto) | ✅ N/A (ya correcto) | N/A |
| 4 | RUNTIME INTEGRITY | ✅ Ejecuta después de DOMContentLoaded | ✅ Runtime ready correctamente | Verificar orden de logs |

---

## 🎯 CHECKS QUE DEBEN PASAR

### Assembly Checks

```bash
# Verificar que no hay errores de sintaxis
npm run check:master-ui

# Verificar que no hay errores de runtime
npm run check:runtime-core
```

### Tests Manuales

1. ✅ Botones reset ALL **NO** aparecen en OPERATIVA
2. ✅ Botones reset ALL **SÍ** aparecen en PROYECCIÓN + scope='all'
3. ✅ Tras reset, `clean_all` funciona correctamente
4. ✅ Runtime integrity check se ejecuta después de scripts cargados

---

## 🚨 ERRORES QUE DEBEN DESAPARECER

### Antes del Fix

1. ❌ Botones reset ALL aparecían incorrectamente en OPERATIVA
2. ❌ Tras reset, `clean_all` no incrementaba (alumnos quedaban en `pending`)
3. ❌ Runtime integrity check podía fallar si scripts no estaban cargados

### Después del Fix

1. ✅ Botones reset ALL solo aparecen en PROYECCIÓN + scope='all'
2. ✅ Tras reset, `clean_all` funciona correctamente (alumnos pasan a `pending`)
3. ✅ Runtime integrity check espera a scripts cargados

---

## ✅ ESTADO FINAL ESPERADO

Después de aplicar todos los fixes:

- ✅ **UX ACTIONS**: Visibilidad correcta por `view_mode`, `scope`, `item_kind`
- ✅ **RESET RECURRENTE**: Contadores reseteados correctamente (`last_cleaned_at = NULL`, `clean_count = 0`)
- ✅ **DTO FLOTANTE**: Contrato correcto (ya estaba bien)
- ✅ **RUNTIME INTEGRITY**: Check ejecuta después de scripts cargados

**FIN DE VERIFICACIÓN**
