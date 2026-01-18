# Informe: fix RESET+CLEAN no cambia estado (v5.82.1)

**Fecha:** 2026-01-18

---

## Causa raíz

**CR2 (parcial) + CR1 (en lectura):** Tras RESET, `effective_since` se fija al `created_at` del evento reset. Al hacer CLEAN justo después, `last_cleaned_at` se escribía con el `created_at` del evento de limpieza o con `NOW()`. En ventanas muy pequeñas (mismo segundo, truncación, o orden de escritura) podía quedar `last_cleaned_at` &lt; `effective_since`. El CPM ya usa `>=` para considerar “clean válido post-reset”, pero si en BD se guardaba un valor anterior a `effective_since`, la proyección seguía en `reseteado` y la UI no cambiaba de columna.

---

## Fix aplicado

### 1. `src/infra/repos/cleaning/cleaning-item-state-repo-pg.js` — `upsertApplyRecurrent`

En el `DO UPDATE SET`:

```sql
${lastCleanedColumn} = GREATEST($5, COALESCE(cleaning_item_state.${effectiveSinceColumn}, $5))
```

- `$5` = `cleaned_at`
- `effectiveSinceColumn` = `shared_effective_since` o `pde_effective_since` según `clean_layer`
- Si `effective_since` es NULL, se mantiene `last_cleaned_at = $5`
- Si `effective_since` no es NULL y `$5` &lt; `effective_since`, se usa `effective_since` → se cumple `last_cleaned_at >= effective_since`

### 2. `src/core/master/services/cleaning-engine-service.js` — `rebaseStateFromReset`

En el `UPDATE` de `cleaning_item_state` dentro del rebase:

```sql
${lastCleanedColumn} = GREATEST($2, $1)
```

- `$1` = `effectiveSince`, `$2` = `lastCleanedAt` (último clean post-reset o NULL)
- Si `$2` es NULL → `GREATEST` da NULL (correcto)
- Si `$2` no es NULL → `last_cleaned_at >= effective_since`

---

## Verificación

### SQL (ejecutar en BD `aurelinportal`)

Antes de RESET+CLEAN (estado y últimos eventos):

```sql
-- Estado
SELECT student_id, item_ref,
  shared_effective_since, shared_last_cleaned_at,
  pde_effective_since, pde_last_cleaned_at,
  shared_clean_count, pde_clean_count, updated_at
FROM cleaning_item_state
WHERE student_id = '44a51f8f-4ed5-4291-ad13-5f07a99c636b' AND item_ref = 'te_item_108';

-- Últimos eventos
SELECT id, action_type, clean_layer, created_at, execution_key
FROM cleaning_events
WHERE student_uuid = '44a51f8f-4ed5-4291-ad13-5f07a99c636b' AND item_ref = 'te_item_108'
ORDER BY created_at DESC
LIMIT 20;
```

Después de 1 ronda RESET + CLEAN (shared):

- Debe existir 1 evento `reset` y 1 `mark_clean` en `shared` con `created_at` crecientes.
- `cleaning_item_state.shared_last_cleaned_at >= shared_effective_since` (tras el CLEAN).

### curl (GET proyección)

```bash
curl -s -b "COOKIE" "http://localhost:3000/master/api/alquimia-general/items/te_item_108/students?clean_layer=shared&view_layer=shared" | jq '.data.students[0].state_by_view_layer.shared'
```

Tras CLEAN, `state` debe ser `reviewed` (o al menos distinto de `reseteado` si ya pasaron días).

### Casos que no deben romperse

- Limpiar **sin** reset: `effective_since` NULL → `COALESCE(..., $5)=$5` → `last_cleaned_at = $5`.
- Reset **sin** limpiar: solo cambia `effective_since`; `last_cleaned_at` puede quedar null o anterior (CPM ya lo trata).
- CLEAN en **pde**: misma lógica con `pde_effective_since` y `pde_last_cleaned_at`.

---

## Documentación

- `docs/RESET_CLEAN_TIMESTAMP_INVARIANT_V1.md` — regla e implementación del invariante.
