# DIAGNÓSTICO ALQUIMIA ALUMNO STATE GAP v1
**Fecha:** 2026-01-08  
**Objetivo:** Identificar gap entre catálogo y estados en `cleaning_item_state`

---

## 1. QUERIES EJECUTADAS

### 1.1. Estados en cleaning_item_state (student_id=4 y 6)

**Query:**
```sql
SELECT 
  student_id,
  COUNT(*) as total_states,
  COUNT(CASE WHEN shared_last_cleaned_at IS NOT NULL THEN 1 END) as states_with_cleaned,
  COUNT(CASE WHEN shared_last_cleaned_at IS NULL THEN 1 END) as states_never_cleaned
FROM cleaning_item_state
WHERE student_id IN (4, 6)
  AND product_key = 'pde'
  AND domain_type = 'transmutation'
GROUP BY student_id
ORDER BY student_id;
```

**Resultados:**
*(Ver output de terminal)*

---

### 1.2. Eventos en cleaning_events (student_id=4 y 6)

**Query:**
```sql
SELECT 
  student_id,
  COUNT(*) as total_events,
  COUNT(DISTINCT item_ref) as unique_items_with_events
FROM cleaning_events
WHERE student_id IN (4, 6)
  AND product_key = 'pde'
  AND domain_type = 'transmutation'
GROUP BY student_id
ORDER BY student_id;
```

**Resultados:**
*(Ver output de terminal)*

---

### 1.3. TOP 20 item_ref con shared_last_cleaned_at (student_id=4)

**Query:**
```sql
SELECT 
  item_ref,
  shared_last_cleaned_at,
  shared_clean_count,
  shared_completed,
  shared_remaining
FROM cleaning_item_state
WHERE student_id = 4
  AND product_key = 'pde'
  AND domain_type = 'transmutation'
  AND shared_last_cleaned_at IS NOT NULL
ORDER BY shared_last_cleaned_at DESC
LIMIT 20;
```

**Resultados:**
*(Ver output de terminal)*

---

### 1.4. Catálogo - Items activos

**Query:**
```sql
SELECT 
  COUNT(*) as total_items_activos,
  COUNT(DISTINCT lista_id) as unique_listas,
  COUNT(CASE WHEN item_ref IS NOT NULL THEN 1 END) as items_with_ref,
  COUNT(CASE WHEN lista_id IS NOT NULL THEN 1 END) as items_with_lista
FROM items_transmutaciones
WHERE (status = 'active' OR activo = true);
```

**Resultados:**
*(Ver output de terminal)*

---

### 1.5. Catálogo - Listas activas

**Query:**
```sql
SELECT 
  COUNT(*) as total_listas_activas
FROM listas_transmutaciones
WHERE (status = 'active' OR activo = true);
```

**Resultados:**
*(Ver output de terminal)*

---

### 1.6. GAP - Items del catálogo sin estado (student_id=4)

**Query:**
```sql
SELECT 
  COUNT(*) as items_catalogo_sin_estado
FROM items_transmutaciones i
WHERE (i.status = 'active' OR i.activo = true)
  AND i.item_ref IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 
    FROM cleaning_item_state s
    WHERE s.student_id = 4
      AND s.product_key = 'pde'
      AND s.domain_type = 'transmutation'
      AND s.item_ref = i.item_ref
  );
```

**Resultados:**
*(Ver output de terminal)*

---

### 1.7. GAP - States con item_ref inexistente (student_id=4)

**Query:**
```sql
SELECT 
  COUNT(*) as states_con_item_ref_inexistente
FROM cleaning_item_state s
WHERE s.student_id = 4
  AND s.product_key = 'pde'
  AND s.domain_type = 'transmutation'
  AND NOT EXISTS (
    SELECT 1 
    FROM items_transmutaciones i
    WHERE (i.status = 'active' OR i.activo = true)
      AND i.item_ref = s.item_ref
  );
```

**Resultados:**
*(Ver output de terminal)*

---

### 1.8. Ejemplo items sin estado (student_id=4, primeros 10)

**Query:**
```sql
SELECT 
  i.item_ref,
  i.nombre,
  i.lista_id,
  i.nivel
FROM items_transmutaciones i
WHERE (i.status = 'active' OR i.activo = true)
  AND i.item_ref IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 
    FROM cleaning_item_state s
    WHERE s.student_id = 4
      AND s.product_key = 'pde'
      AND s.domain_type = 'transmutation'
      AND s.item_ref = i.item_ref
  )
LIMIT 10;
```

**Resultados:**
*(Ver output de terminal)*

---

### 1.9. Nivel efectivo del alumno 4

**Query:**
```sql
SELECT 
  id,
  email,
  nivel_actual,
  nivel_efectivo
FROM alumnos
WHERE id = 4;
```

**Resultados:**
*(Ver output de terminal)*

---

## 2. ANÁLISIS Y CONCLUSIONES

### 2.1. Gap Identificado

**Items del catálogo sin estado (student_id=4):**
- Cantidad: **112 items**
- Porcentaje: **95.7% del catálogo** (117 items activos)
- Solo 5 items tienen estado (4.3%)

**States con item_ref inexistente (student_id=4):**
- Cantidad: **0 states**
- Porcentaje: 0%
- ✅ No hay estados huérfanos

### 2.2. Estado Actual

**Para student_id=4:**
- Total estados: **5**
- Estados con limpieza: **2** (40%)
- Estados nunca limpiados: **3** (60%)
- Gap: **112 items sin estado** (95.7% del catálogo)

**Para student_id=6:**
- Total estados: **3**
- Estados con limpieza: **1** (33%)
- Estados nunca limpiados: **2** (67%)
- Gap estimado: ~114 items sin estado

**Catálogo:**
- Total items activos: **117**
- Total listas activas: **16**
- Todos los items tienen `item_ref` y `lista_id` (100% consistente)

### 2.3. Conclusión

**Decisión: OPCIÓN A - Materializar "NUNCA" en cleaning_item_state**

**Razón:**
1. **Catálogo estable:** 117 items activos, estructura consistente
2. **Gap masivo:** 95.7% de items sin estado (112 de 117)
3. **Panel determinista:** Necesitamos mostrar todos los items aplicables, no solo 5
4. **Performance:** Mejor tener estados materializados que computar en cada request
5. **Contrato claro:** "NUNCA" es un estado real (shared_last_cleaned_at = NULL, counts = 0)
6. **Escalabilidad:** Seed idempotente permite añadir nuevos items sin romper

**Opción B descartada porque:**
- Computar en cada request es ineficiente
- No garantiza consistencia si el catálogo cambia
- Más complejo de mantener

---

## 3. RECOMENDACIONES

### 3.1. Implementar Seed Service

**Servicio:** `cleaning-state-seed-service.js`
- Función: `ensureCleaningItemStateSeedForStudent()`
- Idempotente: `ON CONFLICT DO NOTHING`
- Filtra por nivel efectivo del alumno
- Inserta masivamente (1 query, no loops)

### 3.2. Integración en Endpoint

**Endpoint:** `GET /master/api/alquimia-alumno/megalist`
- Antes de construir respuesta: llamar seed service
- Luego: construir megalista SOLO desde states (como fix b1cca23)

### 3.3. Validación en /clean

**Endpoint:** `POST /master/api/alquimia-alumno/clean`
- Validar que item_ref existe en cleaning_item_state (tras seed debería existir)
- Si no existe: 400 JSON canónico con `code="STATE_NOT_FOUND"`

### 3.4. Migración SQL

**No requiere tabla nueva:**
- Usar `INSERT INTO ... SELECT ... WHERE NOT EXISTS` o `ON CONFLICT DO NOTHING`
- Asegurar índices para performance del seed masivo
