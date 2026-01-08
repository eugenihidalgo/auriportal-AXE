# MASTER ALQUIMIA ALUMNO LEVEL CAP AND MASTER OVERRIDE v1
**Versión:** v1.0  
**Fecha:** 2026-01-08  
**Estado:** ✅ Implementado

---

## 1. PROBLEMA RESUELTO

### 1.1. Listas Faltantes

**Causa raíz:**
- Level Engine sin estado → `nivel_efectivo = 1` (default)
- Seed filtra por `nivel_efectivo` → solo materializa items nivel <= 1
- Listas desaparecen si todos sus items son nivel > 1

**Evidencia:**
- `student_id=4`: nivel_actual=15, nivel_efectivo_calculado=1
- Catálogo aplicable con cap=1: 45 items en 4 listas
- Catálogo aplicable con cap=∞: 129 items en 14 listas
- **Gap:** 84 items perdidos (65% del catálogo)

---

## 2. LEVEL CAP (MOSTRAR HASTA NIVEL)

### 2.1. Definición

**Level Cap:** Control que permite al Master elegir hasta qué nivel mostrar items en el panel.

**Valores:**
- `null` (Auto): Usa `nivel_efectivo` del alumno (comportamiento por defecto)
- `1..9`: Cap explícito (solo items con nivel <= cap)
- `999` (∞): Todos los items aplicables (sin filtro de nivel)

---

### 2.2. API

**Endpoint:** `GET /master/api/alquimia-alumno/megalist`

**Query Param:** `level_cap` (opcional)
- Si no viene: usa `nivel_efectivo` (default)
- Si viene: usa `level_cap` (Master puede elegir hasta 999)

**Ejemplos:**
```
GET /master/api/alquimia-alumno/megalist?student_id=4
GET /master/api/alquimia-alumno/megalist?student_id=4&level_cap=5
GET /master/api/alquimia-alumno/megalist?student_id=4&level_cap=infinity
```

---

### 2.3. Seed con Level Cap

**Servicio:** `cleaning-state-seed-service.js`

**Función:** `ensureCleaningItemStateSeedForStudent()`

**Parámetro:** `level_cap` (opcional)

**Comportamiento:**
- Si `level_cap` viene: materializa estados para items `nivel <= level_cap`
- Si `level_cap` es null: usa `nivel_efectivo` (comportamiento actual)

**Ejemplo:**
```javascript
await ensureCleaningItemStateSeedForStudent({
  student_id: 4,
  product_key: 'pde',
  domain_type: 'transmutation',
  level_cap: 999 // Materializa todos los items aplicables
});
```

---

### 2.4. Megalista con Level Cap

**Servicio:** `alquimia-alumno-megalist-service.js`

**Función:** `getMegalistForStudent()`

**Parámetro:** `level_cap` (opcional)

**Comportamiento:**
- Filtra estados por `level_cap` (solo items con nivel <= cap)
- JOIN con `items_transmutaciones` para filtrar por nivel
- Retorna solo items aplicables bajo el cap

**Query SQL:**
```sql
SELECT s.*, i.nivel as item_nivel
FROM cleaning_item_state s
LEFT JOIN items_transmutaciones i ON i.item_ref = s.item_ref
WHERE s.student_id = $1
  AND s.product_key = 'pde'
  AND s.domain_type = 'transmutation'
  AND (i.nivel IS NULL OR i.nivel <= $2::integer)
ORDER BY s.item_ref
```

---

### 2.5. UI

**Selector:** "Mostrar hasta nivel"

**Opciones:**
- Auto (nivel efectivo)
- 1, 2, 3, 4, 5, 6, 7, 8, 9
- ∞ (Todos)

**Persistencia:**
- localStorage key: `ap_master_alquimia_alumno_level_cap_v1:{student_id}`
- Se carga automáticamente al seleccionar alumno
- Cada cambio recarga megalist

**Ubicación:** Arriba del dashboard (antes del resumen)

---

## 3. MASTER OVERRIDE (LIMPIAR NIVELES SUPERIORES)

### 3.1. Definición

**Master Override:** Permite al Master limpiar items de nivel superior al `nivel_efectivo` del alumno.

**Guards Estrictos:**
- `actor_type === 'master'`
- `surface_key === 'master.alquimia_alumno'`
- `level_cap_override is not null`

**Solo aplica en:** Panel Alquimia del Alumno (no en otros contextos)

---

### 3.2. Cleaning Engine

**Función:** `markCleanStudent()`

**Parámetro:** `level_cap_override` (opcional)

**Comportamiento:**
1. Si se cumplen guards estrictos:
   - Usa `level_cap_override` en vez de `nivel_efectivo`
   - Valida contra `level_cap_override`
   - Guarda en `cleaning_events.meta`:
     ```json
     {
       "level_cap_override_applied": true,
       "level_cap_override": <cap>
     }
     ```
2. Si no se cumplen guards:
   - Comportamiento actual (valida contra `nivel_efectivo`)

**Código:**
```javascript
// Guards estrictos para Master Override
if (level_cap_override !== null && 
    actor_type === 'master' && 
    surface_key === 'master.alquimia_alumno') {
  nivelCapAplicar = parseInt(level_cap_override, 10);
  overrideAplicado = true;
}
```

---

### 3.3. Endpoint /clean

**Endpoint:** `POST /master/api/alquimia-alumno/clean`

**Body:**
```json
{
  "student_id": 4,
  "item_ref": "te_item_123",
  "domain_type": "transmutation",
  "product_key": "pde",
  "level_cap": 999
}
```

**Validaciones:**
1. Si `level_cap` viene: validar que `item.nivel <= level_cap`
2. Si `item.nivel > level_cap`: 400 `ITEM_LEVEL_EXCEEDS_CAP`
3. Si estado no existe: intentar seed con `level_cap`
4. Si sigue sin existir: 400 `STATE_NOT_FOUND`

**Errores Semánticos:**
- `ITEM_LEVEL_EXCEEDS_CAP` (400): Item nivel X excede el cap seleccionado
- `STATE_NOT_FOUND` (400): Estado no encontrado (item no aplica)

---

## 4. CONTRATOS DE ERRORES SEMÁNTICOS

### 4.1. ITEM_LEVEL_EXCEEDS_CAP

**Código:** `ITEM_LEVEL_EXCEEDS_CAP`

**Cuándo:** Item nivel > `level_cap_override`

**Respuesta:**
```json
{
  "ok": false,
  "error": {
    "code": "ITEM_LEVEL_EXCEEDS_CAP",
    "message": "Item nivel 5 excede el cap seleccionado (3)"
  },
  "trace_id": "..."
}
```

---

### 4.2. STATE_NOT_FOUND

**Código:** `STATE_NOT_FOUND`

**Cuándo:** Estado no encontrado tras seed

**Respuesta:**
```json
{
  "ok": false,
  "error": {
    "code": "STATE_NOT_FOUND",
    "message": "Estado no encontrado para item_ref: ... El item puede no ser aplicable para este alumno."
  },
  "trace_id": "..."
}
```

---

## 5. EJEMPLOS DE USO

### 5.1. Ver Items de Nivel Superior

**Escenario:** Master quiere ver items de nivel 5 aunque el alumno tenga nivel_efectivo=1

**Acción:**
1. Seleccionar alumno
2. Cambiar "Mostrar hasta nivel" a `5`
3. Panel muestra items nivel <= 5

**Resultado:**
- Seed materializa estados para items nivel <= 5
- Megalista muestra items nivel <= 5
- Dashboard coherente con cap seleccionado

---

### 5.2. Limpiar Item de Nivel Superior

**Escenario:** Master quiere limpiar un item nivel 5 con cap=5

**Acción:**
1. Seleccionar cap=5
2. Hacer click "Marcar como revisado" en item nivel 5
3. Item se limpia y se mueve a "Revisados"

**Resultado:**
- `cleaning_event` creado con `meta.level_cap_override_applied = true`
- Item movido a "Revisados por Master"
- Dashboard actualizado

---

### 5.3. Ver Todos los Items (cap=∞)

**Escenario:** Master quiere ver todos los items aplicables

**Acción:**
1. Seleccionar cap=∞
2. Panel muestra todos los items (129 items en 14 listas)

**Resultado:**
- Seed materializa estados para todos los items aplicables
- Megalista muestra todas las listas
- Dashboard completo

---

## 6. VERIFICACIÓN

### 6.1. Queries de Verificación

**Estados tras seed con cap=∞:**
```sql
SELECT student_id, COUNT(*) total_states
FROM cleaning_item_state
WHERE student_id = 4
  AND product_key = 'pde'
  AND domain_type = 'transmutation'
GROUP BY student_id;
-- Esperado: ~129 states (vs 33 con cap=1)
```

**Listas visibles:**
```sql
SELECT i.lista_id, COUNT(*) cnt
FROM cleaning_item_state s
JOIN items_transmutaciones i ON i.item_ref = s.item_ref
WHERE s.student_id = 4
  AND s.product_key = 'pde'
  AND s.domain_type = 'transmutation'
GROUP BY i.lista_id
ORDER BY cnt DESC;
-- Esperado: 14 listas (vs 4 con cap=1)
```

**Override aplicado:**
```sql
SELECT meta->>'level_cap_override_applied', COUNT(*)
FROM cleaning_events
WHERE student_id = 4
  AND surface_key = 'master.alquimia_alumno'
  AND meta->>'level_cap_override_applied' = 'true'
GROUP BY meta->>'level_cap_override_applied';
-- Esperado: eventos con override aplicado
```

---

## 7. REFERENCIAS

- **Diagnóstico:** `docs/DIAGNOSTICO_LISTAS_FALTANTES_ALQUIMIA_ALUMNO_V1.md`
- **Seed Service:** `src/core/master/services/cleaning-state-seed-service.js`
- **Megalist Service:** `src/core/master/services/alquimia-alumno-megalist-service.js`
- **Cleaning Engine:** `src/core/master/services/cleaning-engine-service.js`
- **Endpoint:** `src/endpoints/master-api-alquimia-alumno.js`
- **UI Client:** `public/js/master/master-alquimia-alumno-client.js`

---

**Estado:** ✅ Implementado

**Principio:** Master puede ver y limpiar niveles superiores con guards estrictos y override explícito
