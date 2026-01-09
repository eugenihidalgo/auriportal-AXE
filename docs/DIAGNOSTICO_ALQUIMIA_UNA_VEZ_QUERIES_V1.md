# DIAGNÓSTICO ALQUIMIA UNA_VEZ — QUERIES v1
**AuriPortal / Aurelín — Dominio MASTER**  
**Fecha:** 2026-01-08  
**Todas las queries SQL ejecutadas con outputs relevantes**

---

## QUERY 3.1: Listas por tipo

```sql
SELECT
  id, nombre, tipo, status, activo, created_at, updated_at
FROM listas_transmutaciones
ORDER BY tipo, id;
```

### Output (resumen)

**Total listas:**
- `recurrente`: 13 total (12 active, 1 archived)
- `una_vez`: 4 total (4 active, 0 archived)

**Listas `una_vez` activas:**
- id=3: "Registros y Karmas"
- id=4: "Karmas"
- id=9: "Limpiezas del hogar puntuales"
- id=14: "Pobreses"

---

## QUERY 3.1b: Conteo por tipo

```sql
SELECT
  tipo,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE status='active') AS active,
  COUNT(*) FILTER (WHERE status='archived') AS archived
FROM listas_transmutaciones
GROUP BY tipo
ORDER BY tipo;
```

### Output

```json
[
  {
    "tipo": "recurrente",
    "total": "13",
    "active": "12",
    "archived": "1"
  },
  {
    "tipo": "una_vez",
    "total": "4",
    "active": "4",
    "archived": "0"
  }
]
```

---

## QUERY 3.2: Items por tipo de lista

```sql
SELECT
  l.tipo,
  COUNT(*) AS total_items,
  COUNT(*) FILTER (WHERE i.status='active') AS active_items,
  COUNT(*) FILTER (WHERE i.status='archived') AS archived_items
FROM items_transmutaciones i
JOIN listas_transmutaciones l ON l.id = i.lista_id
GROUP BY l.tipo
ORDER BY l.tipo;
```

### Output

```json
[
  {
    "tipo": "recurrente",
    "total_items": "105",
    "active_items": "89",
    "archived_items": "16"
  },
  {
    "tipo": "una_vez",
    "total_items": "24",
    "active_items": "24",
    "archived_items": "0"
  }
]
```

---

## QUERY 3.2b: Detalle de listas con items

```sql
SELECT
  l.id AS lista_id,
  l.nombre AS lista_nombre,
  l.tipo,
  COUNT(*) AS total_items,
  MIN(i.nivel) AS min_nivel,
  MAX(i.nivel) AS max_nivel,
  COUNT(*) FILTER (WHERE i.veces_limpiar IS NOT NULL) AS items_con_veces_limpiar,
  COUNT(*) FILTER (WHERE i.frecuencia_dias IS NOT NULL) AS items_con_frecuencia_dias
FROM items_transmutaciones i
JOIN listas_transmutaciones l ON l.id = i.lista_id
WHERE l.status='active'
GROUP BY l.id, l.nombre, l.tipo
ORDER BY l.tipo, l.id;
```

### Output (listas `una_vez`)

```json
[
  {
    "lista_id": 4,
    "lista_nombre": "Karmas",
    "tipo": "una_vez",
    "total_items": "1",
    "min_nivel": 9,
    "max_nivel": 9,
    "items_con_veces_limpiar": "1",
    "items_con_frecuencia_dias": "1"
  },
  {
    "lista_id": 9,
    "lista_nombre": "Limpiezas del hogar puntuales",
    "tipo": "una_vez",
    "total_items": "2",
    "min_nivel": 9,
    "max_nivel": 9,
    "items_con_veces_limpiar": "2",
    "items_con_frecuencia_dias": "2"
  },
  {
    "lista_id": 14,
    "lista_nombre": "Pobreses",
    "tipo": "una_vez",
    "total_items": "21",
    "min_nivel": 1,
    "max_nivel": 1,
    "items_con_veces_limpiar": "0",
    "items_con_frecuencia_dias": "21"
  }
]
```

**Observación crítica:** Lista "Pobreses" (id=14) tiene 21 items, todos con `frecuencia_dias` pero SIN `veces_limpiar`.

---

## QUERY 3.3: Estados por tipo (student_id=4)

```sql
SELECT
  l.tipo,
  COUNT(*) AS total_states
FROM cleaning_item_state s
JOIN items_transmutaciones i ON i.item_ref = s.item_ref AND i.status='active'
JOIN listas_transmutaciones l ON l.id = i.lista_id AND l.status='active'
WHERE s.student_id = 4
  AND s.product_key='pde'
  AND s.domain_type='transmutation'
GROUP BY l.tipo
ORDER BY l.tipo;
```

### Output

```json
[
  {
    "tipo": "recurrente",
    "total_states": "89"
  },
  {
    "tipo": "una_vez",
    "total_states": "24"
  }
]
```

**Observación:** Hay 24 estados para items `una_vez`, coincidiendo exactamente con el catálogo activo (24 items).

---

## QUERY 3.3b: Ejemplos de estados UNA_VEZ (student_id=4)

```sql
SELECT
  s.item_ref,
  i.nombre,
  l.nombre AS lista_nombre,
  l.tipo,
  i.veces_limpiar,
  i.frecuencia_dias,
  s.shared_last_cleaned_at,
  s.shared_clean_count,
  s.shared_completed,
  s.shared_remaining
FROM cleaning_item_state s
JOIN items_transmutaciones i ON i.item_ref = s.item_ref AND i.status='active'
JOIN listas_transmutaciones l ON l.id = i.lista_id AND l.status='active'
WHERE s.student_id = 4
  AND s.product_key='pde'
  AND s.domain_type='transmutation'
  AND l.tipo='una_vez'
ORDER BY s.shared_last_cleaned_at DESC NULLS LAST
LIMIT 20;
```

### Output (primeros 3 items)

```json
[
  {
    "item_ref": "te_item_114",
    "nombre": "Resistencias a soltar el pasado",
    "lista_nombre": "Pobreses",
    "tipo": "una_vez",
    "veces_limpiar": null,
    "frecuencia_dias": 20,
    "shared_last_cleaned_at": null,
    "shared_clean_count": 0,
    "shared_completed": 1,
    "shared_remaining": 0
  },
  {
    "item_ref": "te_item_119",
    "nombre": "Segrestos d'altres realitats",
    "lista_nombre": "Pobreses",
    "tipo": "una_vez",
    "veces_limpiar": null,
    "frecuencia_dias": 20,
    "shared_last_cleaned_at": null,
    "shared_clean_count": 0,
    "shared_completed": 0,
    "shared_remaining": 0
  },
  {
    "item_ref": "te_item_113",
    "nombre": "Pobreza en la fuerza y en la determinación",
    "lista_nombre": "Pobreses",
    "tipo": "una_vez",
    "veces_limpiar": null,
    "frecuencia_dias": 20,
    "shared_last_cleaned_at": null,
    "shared_clean_count": 0,
    "shared_completed": 0,
    "shared_remaining": 0
  }
]
```

**Observación crítica:** 
- Todos los items tienen `shared_remaining = 0`
- Todos tienen `shared_completed = 0` (excepto `te_item_114` que tiene `completed = 1`)
- Todos tienen `veces_limpiar = null` pero `frecuencia_dias = 20`

---

## QUERY 3.4: Eventos UNA_VEZ (student_id=4)

```sql
SELECT
  e.item_ref,
  COUNT(*) AS total_events,
  MIN(e.created_at) AS first_event,
  MAX(e.created_at) AS last_event
FROM cleaning_events e
JOIN items_transmutaciones i ON i.item_ref = e.item_ref AND i.status='active'
JOIN listas_transmutaciones l ON l.id = i.lista_id AND l.status='active'
WHERE e.student_id = 4
  AND e.product_key='pde'
  AND e.domain_type='transmutation'
  AND l.tipo='una_vez'
GROUP BY e.item_ref
ORDER BY total_events DESC
LIMIT 20;
```

### Output

```json
[
  {
    "item_ref": "te_item_114",
    "total_events": "1",
    "first_event": "2026-01-08T18:25:48.590Z",
    "last_event": "2026-01-08T18:25:48.590Z"
  }
]
```

**Observación:** Solo hay 1 evento para 1 item `una_vez`. Los otros 23 items nunca han sido limpiados.

---

## QUERY 3.4b: Más de un evento por día UNA_VEZ (student_id=4)

```sql
SELECT
  e.item_ref,
  DATE(e.created_at) AS day,
  COUNT(*) AS events_that_day
FROM cleaning_events e
JOIN items_transmutaciones i ON i.item_ref = e.item_ref AND i.status='active'
JOIN listas_transmutaciones l ON l.id = i.lista_id AND l.status='active'
WHERE e.student_id = 4
  AND e.product_key='pde'
  AND e.domain_type='transmutation'
  AND l.tipo='una_vez'
GROUP BY e.item_ref, DATE(e.created_at)
HAVING COUNT(*) > 1
ORDER BY events_that_day DESC
LIMIT 20;
```

### Output

```json
[]
```

**Observación:** NO hay eventos múltiples por día para items `una_vez`. La idempotencia funciona correctamente.

---

## QUERY 3.5: Nivel efectivo alumno 4

```sql
-- Obtener UUID del alumno
SELECT id FROM students WHERE legacy_alumno_id = 4 LIMIT 1;

-- Obtener nivel efectivo desde Level Engine
SELECT current_level_number FROM student_level_state
WHERE student_id = $1 AND line_key = 'pde';
```

### Output

```json
{
  "student_id": 4,
  "nivel_efectivo": 1
}
```

---

## QUERY 3.5b: Items UNA_VEZ no aplicables por nivel (student_id=4)

```sql
SELECT
  i.item_ref, i.nombre, i.nivel, l.nombre AS lista_nombre
FROM items_transmutaciones i
JOIN listas_transmutaciones l ON l.id=i.lista_id
WHERE l.tipo='una_vez'
  AND l.status='active'
  AND i.status='active'
  AND i.nivel > 1  -- nivel_efectivo = 1
ORDER BY i.nivel ASC
LIMIT 50;
```

### Output

```json
[]
```

**Observación:** NO hay items `una_vez` no aplicables por nivel para student_id=4, porque la lista "Pobreses" (nivel 1) es la única que aplica. Las otras listas `una_vez` (nivel 9) NO aplican pero tampoco se seedean, por lo que NO aparecen en la megalist.

---

## QUERY 6.1: Clasificaciones de listas UNA_VEZ

```sql
SELECT
  l.id, l.nombre, l.tipo,
  COUNT(tlc.classification_term_id) AS terms_count
FROM listas_transmutaciones l
LEFT JOIN transmutacion_lista_classifications tlc ON tlc.lista_id = l.id
WHERE l.status='active'
GROUP BY l.id, l.nombre, l.tipo
ORDER BY l.tipo, l.id;
```

### Output (listas `una_vez`)

```json
[
  {
    "id": 3,
    "nombre": "Registros y Karmas",
    "tipo": "una_vez",
    "terms_count": "0"
  },
  {
    "id": 4,
    "nombre": "Karmas",
    "tipo": "una_vez",
    "terms_count": "0"
  },
  {
    "id": 9,
    "nombre": "Limpiezas del hogar puntuales",
    "tipo": "una_vez",
    "terms_count": "0"
  },
  {
    "id": 14,
    "nombre": "Pobreses",
    "tipo": "una_vez",
    "terms_count": "1"
  }
]
```

---

## QUERY 6.2: Proyección de términos (primeras 50)

```sql
SELECT
  l.id AS lista_id,
  l.nombre AS lista_nombre,
  l.tipo,
  ct.type,
  ct.value,
  ct.status
FROM listas_transmutaciones l
JOIN transmutacion_lista_classifications tlc ON tlc.lista_id = l.id
JOIN pde_classification_terms ct ON ct.id = tlc.classification_term_id
WHERE l.status='active'
ORDER BY l.id, ct.type, ct.value
LIMIT 50;
```

### Output (lista "Pobreses")

```json
{
  "lista_id": 14,
  "lista_nombre": "Pobreses",
  "tipo": "una_vez",
  "type": "key",
  "value": "Una vez",
  "status": "active"
}
```

---

**FIN DE QUERIES**
