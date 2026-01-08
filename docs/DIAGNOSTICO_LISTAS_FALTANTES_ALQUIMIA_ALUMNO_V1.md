# DIAGNÓSTICO: LISTAS FALTANTES ALQUIMIA ALUMNO v1
**Fecha:** 2026-01-08  
**Estado:** ✅ Diagnóstico completado

---

## 1. PROBLEMA IDENTIFICADO

El panel `/master/templo-luz/alquimia-alumno` no muestra todas las listas porque:

1. **Nivel efectivo calculado = 1** (aunque `nivel_actual = 15`)
   - Level Engine no tiene estado para estos alumnos
   - Devuelve nivel 1 por defecto (fail-open)

2. **Seed filtra por `nivel_efectivo`** (actualmente 1)
   - Solo materializa estados para items con `nivel <= 1`
   - Items de nivel > 1 no se seed-ean

3. **Listas desaparecen** si todos sus items son de nivel > 1

---

## 2. EVIDENCIAS REALES

### 2.1. Nivel Efectivo

**Alumnos:**
- `student_id=4`: `nivel_actual=15`, `nivel_efectivo_calculado=1`
- `student_id=6`: `nivel_actual=15`, `nivel_efectivo_calculado=1`

**Causa:** Level Engine no tiene estado → devuelve 1 por defecto

---

### 2.2. Estados ANTES de llamar /megalist

```json
[
  { "student_id": 4, "total_states": "33" },
  { "student_id": 6, "total_states": "3" }
]
```

**Observación:** Ya hay algunos estados (probablemente de limpiezas previas)

---

### 2.3. Catálogo Aplicable (nivel_efectivo=1)

**Items aplicables:** 45 items en 4 listas:
- Lista 14: 21 items
- Lista 17: 12 items
- Lista 11: 11 items
- Lista 13: 1 item

**Total:** 45 items (todos nivel 1)

---

### 2.4. States por Lista (student_id=4, tras seed)

**States existentes:** 33 states en 3 listas:
- Lista 14: 21 states ✅
- Lista 11: 11 states ✅
- Lista 13: 1 state ✅
- **Lista 17: 0 states** ❌ (GAP)

**Gap identificado:** Lista 17 tiene 12 items aplicables pero 0 states

---

### 2.5. Catálogo con cap=∞ (999)

**Items aplicables:** 129 items en 14 listas:
- Lista 1: 36 items
- Lista 14: 21 items
- Lista 11: 16 items
- Lista 5: 14 items
- Lista 17: 12 items
- Lista 10: 7 items
- Lista 2: 6 items
- Lista 6: 5 items
- Lista 12: 4 items
- Lista 7: 3 items
- Lista 9: 2 items
- Lista 13: 1 item
- Lista 8: 1 item
- Lista 4: 1 item

**Total:** 129 items (vs 45 con cap=1)

**Gap:** 84 items perdidos (65% del catálogo)

---

### 2.6. Items Perdidos (nivel > 1)

**Distribución:**
- Nivel 2: 10 items (listas 1, 5)
- Nivel 3: 1 item (lista 5)
- Nivel 4: 18 items (listas 1, 6)
- Nivel 5: 16 items (lista 1)
- Nivel 6: 4 items (lista 5)
- Nivel 9: 7 items (listas 1, 2)
- ... (más niveles)

**Total perdidos:** 84 items

---

## 3. CAUSA RAÍZ

1. **Level Engine sin estado** → `nivel_efectivo = 1` (default)
2. **Seed filtra por `nivel_efectivo`** → solo materializa items nivel <= 1
3. **UI no permite override** → Master no puede ver/limpiar niveles superiores
4. **Listas desaparecen** → si todos sus items son nivel > 1

---

## 4. SOLUCIÓN CANÓNICA

### 4.1. Level Cap (Mostrar hasta nivel)

**API:**
- Nuevo query param: `level_cap` (integer | null)
- Si no viene: usar `nivel_efectivo` (comportamiento actual)
- Si viene: usar `level_cap` (Master puede elegir hasta 999)

**Seed:**
- Usar `level_cap` en vez de solo `nivel_efectivo`
- Materializar estados para items `nivel <= level_cap`

**UI:**
- Selector "Mostrar hasta nivel": [Auto, 1..9, ∞]
- Persistencia localStorage: `ap_master_alquimia_alumno_level_cap_v1:{student_id}`
- Cada cambio recarga megalist

---

### 4.2. Master Override (Limpiar niveles superiores)

**Cleaning Engine:**
- Nuevo param: `level_cap_override` (integer | null)
- Guards estrictos:
  - `actor_type === 'master'`
  - `surface_key === 'master.alquimia_alumno'`
  - `level_cap_override is not null`
- Validar contra `level_cap_override` en vez de `nivel_efectivo`
- Guardar en `cleaning_events.meta`:
  ```json
  {
    "level_cap_override_applied": true,
    "level_cap_override": <cap>
  }
  ```

**Endpoint /clean:**
- Pasar `level_cap_override` desde UI
- Si `item.nivel > level_cap_override` → 400 `ITEM_LEVEL_EXCEEDS_CAP`

---

## 5. RESULTADOS ESPERADOS

**Con cap=1 (Auto):**
- 45 items en 4 listas (comportamiento actual)

**Con cap=∞:**
- 129 items en 14 listas (todos los items aplicables)

**Con cap=9:**
- Items hasta nivel 9 (intermedio)

**Master puede:**
- Ver items de nivel superior
- Limpiar items de nivel superior (con override)
- Dashboard coherente con cap seleccionado

---

## 6. VERIFICACIÓN POST-FIX

1. **Estados tras seed con cap=∞:**
   - `student_id=4` debe tener ~129 states (vs 33 actuales)

2. **Listas visibles:**
   - Con cap=1: 4 listas
   - Con cap=∞: 14 listas

3. **Limpieza de nivel superior:**
   - Item nivel 5 con cap=∞ → debe funcionar
   - `cleaning_event.meta.level_cap_override_applied = true`

---

**Estado:** ✅ Diagnóstico completado, listo para implementación
