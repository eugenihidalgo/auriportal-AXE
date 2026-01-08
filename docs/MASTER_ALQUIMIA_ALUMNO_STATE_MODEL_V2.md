# MASTER ALQUIMIA ALUMNO STATE MODEL v2
**Versión:** v2.0  
**Fecha:** 2026-01-08  
**Estado:** ✅ Implementado

---

## 1. DEFINICIÓN DE "NUNCA"

### 1.1. Estado "NUNCA" Materializado

**Regla fundamental:** El estado "NUNCA" está **materializado** en `cleaning_item_state`.

**Estructura:**
```sql
INSERT INTO cleaning_item_state (
  student_id,
  product_key,
  domain_type,
  item_ref,
  shared_last_cleaned_at,  -- NULL
  pde_last_cleaned_at,     -- NULL
  shared_clean_count,      -- 0
  pde_clean_count,          -- 0
  shared_completed,         -- 0
  shared_remaining,         -- 0
  pde_completed,           -- 0
  meta,                    -- '{}'
  created_at,
  updated_at
)
```

**Características:**
- `shared_last_cleaned_at = NULL` → nunca limpiado
- `shared_clean_count = 0` → sin limpiezas
- `shared_completed = 0` → sin completados (una_vez)
- `shared_remaining = 0` → sin restantes (una_vez)

---

### 1.2. Seed Automático

**Servicio:** `cleaning-state-seed-service.js`

**Función:** `ensureCleaningItemStateSeedForStudent()`

**Cuándo se ejecuta:**
- Antes de construir megalista (`GET /master/api/alquimia-alumno/megalist`)
- Antes de limpiar item si no existe estado (`POST /master/api/alquimia-alumno/clean`)

**Qué hace:**
1. Obtiene nivel efectivo del alumno
2. Filtra items aplicables del catálogo:
   - Items activos (`status='active' OR activo=true`)
   - Items con `item_ref` no null
   - Items con `nivel <= nivel_efectivo` (si nivel no es null)
3. Inserta estados faltantes con defaults (never)
4. Idempotente: `ON CONFLICT DO NOTHING`

**Performance:**
- Insert masivo (1 query, no loops)
- Usa `INSERT INTO ... SELECT ... WHERE NOT EXISTS`

---

## 2. SOURCE OF TRUTH

### 2.1. cleaning_item_state (Proyección Canónica)

**Tabla:** `cleaning_item_state`

**Propósito:** Proyección canónica del estado de limpieza por capa (shared/pde)

**Campos relevantes:**
- `student_id` - ID del alumno
- `product_key` - 'pde'
- `domain_type` - 'transmutation'
- `item_ref` - Referencia del item
- `shared_last_cleaned_at` - Última limpieza SHARED (NULL = nunca)
- `shared_clean_count` - Contador de limpiezas SHARED
- `shared_completed` - Completadas SHARED (una_vez)
- `shared_remaining` - Restantes SHARED (una_vez)

**Primary Key:** `(student_id, product_key, domain_type, item_ref)`

---

### 2.2. cleaning_events (Event Log Append-Only)

**Tabla:** `cleaning_events`

**Propósito:** Event log completo de todas las limpiezas (audit real)

**Características:**
- Append-only (no se modifica ni elimina)
- Idempotencia garantizada (`execution_key`)
- Trazabilidad completa (`trace_id`, `actor`, `surface_key`)

---

## 3. QUÉ SE SEED-EA Y CUÁNDO

### 3.1. Items Aplicables

**Criterios:**
1. Item activo: `status='active' OR activo=true`
2. Item con `item_ref` no null
3. Item con `nivel <= nivel_efectivo` (si nivel no es null)
4. Item que NO tiene estado en `cleaning_item_state`

**Cuándo:**
- Al cargar megalista (si falta estado)
- Al limpiar item (si falta estado, antes de limpiar)

---

### 3.2. Estados Creados

**Defaults:**
- `shared_last_cleaned_at = NULL` (nunca limpiado)
- `shared_clean_count = 0`
- `shared_completed = 0`
- `shared_remaining = 0`
- `pde_last_cleaned_at = NULL`
- `pde_clean_count = 0`
- `pde_completed = 0`
- `meta = '{}'`

---

## 4. CONTRATOS DE ENDPOINTS

### 4.1. GET /master/api/alquimia-alumno/megalist

**Flujo:**
1. Seed automático: `ensureCleaningItemStateSeedForStudent()`
2. Construir megalista SOLO desde `cleaning_item_state`
3. Resolver items desde catálogo (solo para nombre, descripción)
4. Retornar estructura canónica

**Respuesta:**
- `summary.total` = total de estados en `cleaning_item_state` (coherente)
- `lists[]` = solo listas que tienen items con estado
- `warnings[]` = si hay items no resueltos

---

### 4.2. POST /master/api/alquimia-alumno/clean

**Flujo:**
1. Validar que estado existe en `cleaning_item_state`
2. Si no existe:
   - Intentar seed automático
   - Verificar de nuevo
   - Si sigue sin existir: 400 `STATE_NOT_FOUND`
3. Llamar `markCleanStudent()` del Cleaning Engine
4. Retornar estado actualizado

**Errores semánticos:**
- `STATE_NOT_FOUND` (400): Item no tiene estado (no aplica o no seed-eado)

---

## 5. ERRORES SEMÁNTICOS

### 5.1. STATE_NOT_FOUND

**Código:** `STATE_NOT_FOUND`

**Cuándo:** Item no tiene estado en `cleaning_item_state` tras seed

**Razones posibles:**
- Item no es aplicable (nivel > nivel_efectivo)
- Item no existe en catálogo
- Error en seed (fail-open)

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

## 6. REGLAS DE NO-FANTASMAS

### 6.1. Prohibido

**Está prohibido:**
- ❌ Crear items "fantasma" sin contrato
- ❌ Mostrar items sin estado materializado
- ❌ Computar "NUNCA" en UI sin respaldo en BD
- ❌ Asumir que items existen sin verificar

---

### 6.2. Obligatorio

**Es obligatorio:**
- ✅ Seed automático antes de construir megalista
- ✅ Validar estado antes de limpiar
- ✅ Materializar "NUNCA" en `cleaning_item_state`
- ✅ Usar catálogo SOLO como resolver (nombre, descripción)

---

## 7. DIAGNÓSTICO REAL

### 7.1. Gap Identificado

**Para student_id=4:**
- Total items catálogo: 117
- Total estados: 5 (4.3%)
- Gap: 112 items sin estado (95.7%)

**Solución:** Seed automático materializa estados "NUNCA" para items aplicables

---

### 7.2. Resultados Esperados

**Tras seed:**
- Total estados ≈ total items aplicables (filtrados por nivel)
- Dashboard coherente: `summary.total` = estados reales
- Listas aparecen solo si tienen items con estado
- Botón "Marcar como revisado" funciona sin 500

---

## 8. REFERENCIAS

- **Diagnóstico:** `docs/DIAGNOSTICO_ALQUIMIA_ALUMNO_STATE_GAP_V1.md`
- **Servicio Seed:** `src/core/master/services/cleaning-state-seed-service.js`
- **Servicio Megalista:** `src/core/master/services/alquimia-alumno-megalist-service.js`
- **Endpoint:** `src/endpoints/master-api-alquimia-alumno.js`
- **Cleaning Engine:** `src/core/master/services/cleaning-engine-service.js`

---

**Estado:** ✅ Implementado

**Principio:** "NUNCA" es un estado real materializado, no computado
