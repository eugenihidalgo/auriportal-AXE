# MASTER ALQUIMIA UNA_VEZ ENGINE v1
**AuriPortal / Aurelín — Dominio MASTER**  
**Fecha:** 2026-01-08  
**Estado:** CANÓNICO

---

## RESUMEN

Engine canónico para manejo de items `tipo='una_vez'` en Alquimia del Alumno.

---

## COMPONENTES

### 1. Seed Service

**Ubicación:** `src/core/master/services/cleaning-state-seed-service.js`

**Función:** `ensureCleaningItemStateSeedForStudent()`

**Comportamiento:**
- Para items en listas `tipo='una_vez'`:
  - Inicializa `shared_remaining = COALESCE(veces_limpiar, 1)`
  - Inicializa `shared_completed = 0` si `remaining > 0`, `1` si `remaining = 0`
  - Inicializa `shared_clean_count = 0`
- Para items recurrentes:
  - Inicializa `shared_remaining = 0`
  - Inicializa `shared_completed = 0`
  - Inicializa `shared_clean_count = 0`

**Query SQL:**
```sql
SELECT 
  -- Para una_vez: shared_remaining = COALESCE(veces_limpiar, 1)
  CASE 
    WHEN l.tipo = 'una_vez' THEN GREATEST(COALESCE(i.veces_limpiar, 1), 0)
    ELSE 0
  END as shared_remaining,
  -- shared_completed calculado basado en remaining
  CASE 
    WHEN l.tipo = 'una_vez' AND COALESCE(i.veces_limpiar, 1) > 0 THEN 0
    WHEN l.tipo = 'una_vez' AND COALESCE(i.veces_limpiar, 1) = 0 THEN 1
    ELSE 0
  END as shared_completed
FROM items_transmutaciones i
JOIN listas_transmutaciones l ON l.id = i.lista_id
WHERE ...
```

---

### 2. Cálculo de Estado

**Ubicación:** `src/core/master/services/alquimia-alumno-megalist-service.js`

**Función:** `calculateItemState(state, item, tipo)`

**Lógica para `una_vez`:**
```javascript
if (listaTipo === 'una_vez') {
  const remaining = state?.shared_remaining ?? null;
  const cleanCount = state?.shared_clean_count ?? 0;
  const completed = state?.shared_completed ?? 0;
  
  if (remaining === null) {
    return 'never';
  }
  
  if (remaining <= 0 || completed > 0) {
    return 'reviewed';
  }
  
  if (cleanCount > 0 && remaining > 0) {
    return 'pending';
  }
  
  if (remaining > 0 && cleanCount === 0) {
    return 'never';
  }
  
  return 'pending';
}
```

**Estados posibles:**
- `'never'`: Nunca trabajado (`remaining > 0`, `clean_count = 0`)
- `'pending'`: Parcialmente trabajado (`remaining > 0`, `clean_count > 0`)
- `'reviewed'`: Completado (`remaining <= 0` o `completed > 0`)

---

### 3. Limpieza (Clean)

**Ubicación:** `src/core/master/services/cleaning-engine-service.js`

**Función:** `markCleanStudent()`

**Comportamiento para `una_vez`:**
1. Determina `item_kind` desde la lista (`'una_vez'` o `'recurrente'`)
2. Genera `execution_key` con formato diario: `mark_clean:{item_ref}:{student_id}:{YYYY-MM-DD}`
3. Inserta evento (idempotente)
4. Si `item_kind === 'una_vez'`:
   - Llama `upsertApplyOneTimeIncrementShared()` con `required_count = item.veces_limpiar || 1`

**Ubicación Repo:** `src/infra/repos/cleaning/cleaning-item-state-repo-pg.js`

**Función:** `upsertApplyOneTimeIncrementShared()`

**Query SQL:**
```sql
UPDATE cleaning_item_state
SET 
  shared_clean_count = shared_clean_count + 1,
  shared_remaining = GREATEST(0, shared_remaining - 1),
  shared_completed = CASE 
    WHEN GREATEST(0, shared_remaining - 1) <= 0 THEN 1 
    ELSE 0 
  END
WHERE ...
```

---

### 4. Progreso (Megalist Service)

**Ubicación:** `src/core/master/services/alquimia-alumno-megalist-service.js`

**Campos añadidos a `itemData`:**
```javascript
progress_realizadas: listaTipo === 'una_vez' ? (state.shared_clean_count || 0) : null,
progress_requeridas: listaTipo === 'una_vez' ? (item.veces_limpiar || 1) : null
```

---

## REGLAS DE NEGOCIO

1. **veces_limpiar >= 1**: Si `veces_limpiar` es `null`, usar `1` como fallback
2. **shared_remaining**: Calculado como `max(veces_limpiar - shared_clean_count, 0)`
3. **shared_completed**: Calculado como `(shared_remaining === 0 ? 1 : 0)`
4. **Limpiezas múltiples**: Permitidas sin límite diario (idempotencia por día previene duplicados)
5. **frecuencia_dias**: Ignorado para items `una_vez`

---

## IDEMPOTENCIA

**Execution Key:** `mark_clean:{item_ref}:{student_id}:{YYYY-MM-DD}`

**Comportamiento:**
- Si se intenta limpiar el mismo item dos veces en el mismo día, el segundo intento retorna el estado actual sin error
- NO bloquea limpiezas en días distintos
- Permite múltiples limpiezas del mismo item en días diferentes

---

## REFERENCIAS

- Constitución: `docs/CONSTITUTION_ALQUIMIA_UNA_VEZ_V1.md`
- Diagnóstico: `docs/DIAGNOSTICO_ALQUIMIA_UNA_VEZ_V1.md`

---

**FIN DEL DOCUMENTO**
