# RESET_CLEAN_TIMESTAMP_INVARIANT_V1

**Fecha:** 2026-01-18  
**Estado:** Canónico

---

## Regla

Tras aplicar **CLEAN** para una capa (`shared` o `pde`):

> **last_cleaned_at** debe quedar **siempre** `>=` **effective_since** de esa capa, cuando `effective_since` no es NULL.

Si `effective_since` es NULL (nunca hubo RESET en esa capa), `last_cleaned_at` queda en el valor que corresponda (p. ej. `NOW()` o `created_at` del evento).

---

## Motivación

Tras un **RESET** se establece `effective_since = reset_at` (p. ej. `created_at` del evento reset). El ciclo anterior queda invalidado para el cálculo de estado: CPM y proyecciones solo consideran limpiezas **posteriores o iguales** a `effective_since`.

Si un **CLEAN** se ejecuta inmediatamente después del RESET (misma transacción, mismo segundo, o con pequeña diferencia de reloj/truncación), puede darse:

- `last_cleaned_at` < `effective_since` (p. ej. por microsegundos o por el orden de escritura)
- CPM interpreta `last_cleaned_at < effective_since` como “limpieza anterior al reset” → la ignora → estado sigue `reseteado`
- La UI no ve cambio de columna aunque el POST devolvió 200 OK

El invariante evita eso: **nunca** se persiste un `last_cleaned_at` estrictamente menor que `effective_since` cuando hay RESET.

---

## Implementación

### 1. `upsertApplyRecurrent` (cleaning-item-state-repo-pg.js)

En el `DO UPDATE SET` de `INSERT ... ON CONFLICT`:

```sql
${lastCleanedColumn} = GREATEST($5, COALESCE(cleaning_item_state.${effectiveSinceColumn}, $5))
```

- `$5` = `cleaned_at` (timestamp del CLEAN)
- `effectiveSinceColumn` = `shared_effective_since` o `pde_effective_since` según capa
- Si `effective_since` es NULL → `COALESCE(..., $5) = $5` → `GREATEST($5, $5) = $5` (comportamiento habitual)
- Si `effective_since` no es NULL y `cleaned_at` < `effective_since` → se usa `effective_since` → `last_cleaned_at >= effective_since`

### 2. `rebaseStateFromReset` (cleaning-engine-service.js)

En el `UPDATE` que aplica el rebase desde RESET:

```sql
${lastCleanedColumn} = GREATEST($2, $1)
```

- `$1` = `effectiveSince` (reset)
- `$2` = `lastCleanedAt` (último evento de limpieza post-reset, o NULL si no hay)
- Si `$2` es NULL → `GREATEST(null, $1)` = NULL en PostgreSQL (correcto: no hay clean en el nuevo ciclo)
- Si `$2` no es NULL → `last_cleaned_at >= effective_since`

---

## Cálculo de estado (CPM)

En **cleaning-projection-model.js** se usa:

- `last_cleaned_at >= effective_since` para considerar la limpieza “válida” en el ciclo actual (>=, no >).
- Si `last_cleaned_at < effective_since` → CPM ignora esa limpieza (ciclo anterior) → estado `reseteado` con `days_since = 0`.

No se cambia CPM; el invariante en escritura hace que los datos que le llegan ya cumplan `last_cleaned_at >= effective_since` cuando hay reset.

---

## Qué fallos quedan imposibles por diseño

- `last_cleaned_at` persistido **estrictamente menor** que `effective_since` tras un CLEAN en esa capa.
- Estado `reseteado` que no pase a `reviewed` (o al menos a un estado distinto) tras un CLEAN exitoso en la misma capa, por culpa de timestamps.

---

## Referencias

- `docs/contracts/CLEAN_AFTER_RESET_CONTRACT_V1.md`
- `docs/ALQUIMIA_RESET_OVERRIDE_POSTMORTEM_V1.md` (fix v5.77.6)
- `database/migrations/v5.73.0-reset-canonical-v1.sql` (effective_since por capa)
