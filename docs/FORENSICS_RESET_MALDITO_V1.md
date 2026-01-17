# 🔬 DIAGNÓSTICO POST-FIX (v5.77.0) — "RESET MALDITO"
## Objetivo: identificar EXACTAMENTE por qué tras reset, ese (student,item_ref) nunca vuelve a moverse de columna
## Prohibido arreglar: SOLO evidencias + causa raíz única

**FECHA:** 2026-01-27  
**VERSIÓN:** v5.77.0  
**MODO:** SOLO DIAGNÓSTICO (NO FIXES)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1️⃣ CASO SELECCIONADO (OBLIGATORIO)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Caso maldito identificado:**
- `student_uuid`: `0d29eedc-6f42-44d1-bb12-53dba2fc9490`
- `item_ref`: `item_17_1768641625523_cr5fpr`
- `clean_layer`: `shared`
- `item_kind`: `recurrente`
- `product_key`: `pde`
- `domain_type`: `transmutation`

**Estado actual en BD (desde query inicial):**
```
student_id: 0d29eedc-6f42-44d1-bb12-53dba2fc9490
item_ref: item_17_1768641625523_cr5fpr
shared_effective_since: 2026-01-17 11:01:22
shared_last_cleaned_at: NULL
shared_clean_count: 0
pde_effective_since: NULL
pde_last_cleaned_at: NULL
pde_clean_count: 0
updated_at: 2026-01-17 11:01:22
```

**Eventos encontrados:**
1. **mark_clean** - `2026-01-17 09:20:33`
   - `execution_key`: `mark_clean:item_17_1768641625523_cr5fpr:0d29eedc-6f42-44d1-bb12-53dba2fc9490:shared:2026-01-17`
   - `product_key`: `pde`
   - `domain_type`: `transmutation`
   - `clean_layer`: `shared`
   
2. **reset** - `2026-01-17 11:01:22`
   - `execution_key`: `reset:item_17_1768641625523_cr5fpr:0d29eedc-6f42-44d1-bb12-53dba2fc9490:shared:2026-01-17`
   - `product_key`: `pde`
   - `domain_type`: `transmutation`
   - `clean_layer`: `shared`

**Observación inicial:**
- Hay un evento `mark_clean` a las 09:20:33
- Luego un `reset` a las 11:01:22
- Después del reset, `shared_last_cleaned_at` quedó NULL (correcto)
- El problema: tras limpiar después del reset, el estado NO cambia

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2️⃣ EVIDENCIA DB — QUERIES DE VERIFICACIÓN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### 2.1 Estado canónico (cleaning_item_state) EXACTO

```sql
SELECT
  student_id, product_key, domain_type, item_ref,
  shared_effective_since, shared_last_cleaned_at, shared_clean_count,
  pde_effective_since, pde_last_cleaned_at, pde_clean_count,
  updated_at
FROM cleaning_item_state
WHERE student_id = '0d29eedc-6f42-44d1-bb12-53dba2fc9490'
  AND item_ref = 'item_17_1768641625523_cr5fpr'
ORDER BY updated_at DESC;
```

**Resultado (ejecutado antes de instrumentación):**
```
student_id: 0d29eedc-6f42-44d1-bb12-53dba2fc9490
product_key: pde
domain_type: transmutation
item_ref: item_17_1768641625523_cr5fpr
shared_effective_since: 2026-01-17 11:01:22
shared_last_cleaned_at: NULL
shared_clean_count: 0
pde_effective_since: NULL
pde_last_cleaned_at: NULL
pde_clean_count: 0
updated_at: 2026-01-17 11:01:22
```

### 2.2 Filas múltiples

```sql
SELECT
  student_id, product_key, domain_type, item_ref,
  COUNT(*) AS n,
  MIN(updated_at) AS first_seen,
  MAX(updated_at) AS last_seen
FROM cleaning_item_state
WHERE student_id = '0d29eedc-6f42-44d1-bb12-53dba2fc9490'
  AND item_ref = 'item_17_1768641625523_cr5fpr'
GROUP BY student_id, product_key, domain_type, item_ref
ORDER BY last_seen DESC;
```

**Resultado:**
```
Filas encontradas: 1
- product_key: pde
- domain_type: transmutation
- n: 1
- first_seen: 2026-01-17 11:01:22
- last_seen: 2026-01-17 11:01:22
```

**Conclusión:** ✅ NO hay múltiples filas. Solo existe UNA fila con `product_key='pde'` y `domain_type='transmutation'`.

### 2.3 Eventos recientes

```sql
SELECT
  created_at, action_type, clean_layer, item_kind, execution_key,
  product_key, domain_type, item_ref, meta
FROM cleaning_events
WHERE student_id = '0d29eedc-6f42-44d1-bb12-53dba2fc9490'
  AND item_ref = 'item_17_1768641625523_cr5fpr'
ORDER BY created_at DESC
LIMIT 20;
```

**Resultado (orden cronológico ascendente):**
1. **mark_clean** - `2026-01-17 09:20:33`
   - `product_key`: `pde`
   - `domain_type`: `transmutation`
   - `clean_layer`: `shared`
   - `execution_key`: `mark_clean:item_17_1768641625523_cr5fpr:0d29eedc-6f42-44d1-bb12-53dba2fc9490:shared:2026-01-17`

2. **reset** - `2026-01-17 11:01:22`
   - `product_key`: `pde`
   - `domain_type`: `transmutation`
   - `clean_layer`: `shared`
   - `execution_key`: `reset:item_17_1768641625523_cr5fpr:0d29eedc-6f42-44d1-bb12-53dba2fc9490:shared:2026-01-17`

**Conclusión:** ✅ Todos los eventos tienen el MISMO `product_key='pde'` y `domain_type='transmutation'`. NO hay inconsistencia de filas.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3️⃣ INSTRUMENTACIÓN INSTALADA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Logs instrumentales temporales añadidos:**

### 3.1 En CPM (cleaning-projection-model.js)
- Log `[FORENSICS][CPM_INTERNAL]` antes de calcular estado
- Log `[FORENSICS][CPM_RESET_WITH_CLEAN]` si hay limpieza posterior al reset
- Log `[FORENSICS][CPM_RESET_IGNORE_OLD_CLEAN]` si limpieza anterior al reset
- Log `[FORENSICS][CPM_RESET_NO_CLEAN]` si no hay limpieza

**Archivo:** `src/core/master/services/cleaning-projection-model.js`  
**Función:** `computeRecurrenteLayerState()`

### 3.2 En Service (alquimia-general-service.js)
- Log `[FORENSICS][CPM_CASE]` antes de calcular state_by_view_layer
- Log `[FORENSICS][CPM_RESULT]` después de calcular state_by_view_layer

**Archivo:** `src/services/alquimia-general-service.js`  
**Función:** `getStudentsForItem()`

### 3.3 En Engine (cleaning-engine-service.js)
- Log `[FORENSICS][REBASE_CHECK]` antes de buscar reset
- Log `[FORENSICS][REBASE_CALC]` cálculo de needsRebase
- Log `[FORENSICS][REBASE_EXECUTING]` si se ejecuta rebase
- Log `[FORENSICS][REBASE_RESULT]` resultado del rebase

**Archivo:** `src/core/master/services/cleaning-engine-service.js`  
**Función:** `markCleanStudent()`

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4️⃣ PASOS PARA REPRODUCIR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Para capturar logs forenses:**

1. **Abrir UI MASTER** → `/master/alumnos/{student_uuid}/alquimia-general`

2. **Reset del item** para ese student:
   - Click en botón "Reset" (SHARED)
   - Timestamp: `_______________`

3. **Limpiar ese student** (mismo item) 2-3 veces:
   - Click en botón "Limpiar" (SHARED)
   - Timestamp: `_______________`
   - Click en botón "Limpiar" (SHARED) - segunda vez
   - Timestamp: `_______________`

4. **Verificar UI**: Confirmar que NO cambia de columna "NUNCA"

5. **Capturar logs** de consola del navegador y logs del servidor:
   - Buscar `[FORENSICS]` en consola del navegador
   - Buscar `[FORENSICS]` en logs de PM2: `pm2 logs aurelinportal --lines 100`

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5️⃣ EVIDENCIAS CAPTURADAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**PENDIENTE: Reproducir bug y capturar logs**

### 5.1 Logs CPM
```
[PENDIENTE: Pegar logs [FORENSICS][CPM_*] aquí]
```

### 5.2 Logs Service
```
[PENDIENTE: Pegar logs [FORENSICS][CPM_CASE] y [FORENSICS][CPM_RESULT] aquí]
```

### 5.3 Logs Engine
```
[PENDIENTE: Pegar logs [FORENSICS][REBASE_*] aquí]
```

### 5.4 Estado DB POST-reproducción
```sql
-- Ejecutar DESPUÉS de reproducir:
SELECT
  student_id, product_key, domain_type, item_ref,
  shared_effective_since, shared_last_cleaned_at, shared_clean_count,
  pde_effective_since, pde_last_cleaned_at, pde_clean_count,
  updated_at
FROM cleaning_item_state
WHERE student_id = '0d29eedc-6f42-44d1-bb12-53dba2fc9490'
  AND item_ref = 'item_17_1768641625523_cr5fpr';
```

```
[PENDIENTE: Pegar resultado aquí]
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
6️⃣ HIPÓTESIS Y DECISIÓN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**PENDIENTE: Después de capturar evidencias, decidir causa raíz única**

### Familia #1: Filas distintas
- Se demuestra si cleaning_item_state o cleaning_events muestran product_key/domain_type/capa inconsistentes
- **Estado actual:** ❌ NO se observa (solo UNA fila con mismos valores)

### Familia #2: Tiempo
- Se demuestra si tras limpiar, last_cleaned_at queda <= effective_since "para siempre"
- **Estado:** ❓ PENDIENTE (requiere logs CPM)

### Familia #3: Rebase pisa
- Se demuestra si tras cada limpieza, needsRebase sigue true y se ejecuta rebase
- **Estado:** ❓ PENDIENTE (requiere logs Engine)

### Familia #4: Override sobre estado equivocado
- Se demuestra si el override se ejecuta pero el estado que consume CPM no cambia
- **Estado:** ❓ PENDIENTE (requiere logs Service)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
7️⃣ CONCLUSIÓN FORENSE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**PENDIENTE: Después de capturar evidencias**

**Causa raíz única:** `[PENDIENTE]`

**Evidencia:**
- Queries: `[PENDIENTE]`
- Logs: `[PENDIENTE]`
- Archivo+Línea: `[PENDIENTE]`

**Invariante roto:** `[PENDIENTE]`

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**FIN DEL DOCUMENTO (PENDIENTE CAPTURA)**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
