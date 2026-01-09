# DIAGNÓSTICO CATÁLOGO ALQUIMIA v1
**Fecha:** 2026-01-XX  
**Objetivo:** Inventario completo y documentación de catálogos de transmutaciones (listas e items)

---

## 1. LISTAS DE TRANSMUTACIONES (`listas_transmutaciones`)

### 1.1. ¿Qué son conceptualmente?

Las **listas de transmutaciones** son contenedores de items energéticos que se organizan por tipo:
- **Tipo `recurrente`**: Items que deben limpiarse periódicamente (por tiempo)
- **Tipo `una_vez`**: Items que deben limpiarse un número fijo de veces (por contador)

**Semántica:** Una lista agrupa items relacionados conceptualmente (ej: "Transmutaciones Energéticas Generales", "Lugares", "Proyectos", etc.)

### 1.2. Campos Existentes (PostgreSQL)

**Tabla:** `listas_transmutaciones`

| Campo | Tipo | Descripción | Estado |
|-------|------|-------------|--------|
| `id` | SERIAL PRIMARY KEY | ID único de la lista | ✅ Canónico |
| `nombre` | VARCHAR(255) | Nombre de la lista | ✅ Canónico |
| `tipo` | VARCHAR(20) | `'recurrente'` o `'una_vez'` | ✅ Canónico (CHECK constraint) |
| `descripcion` | TEXT | Descripción opcional | ✅ Canónico |
| `orden` | INTEGER | Orden de visualización | ✅ Canónico (default: 0) |
| `status` | VARCHAR(20) | `'active'` o `'archived'` | ✅ Canónico (soft delete) |
| `activo` | BOOLEAN | **LEGACY** - Usar `status` | ❌ Legacy (deprecado pero existe) |
| `created_at` | TIMESTAMPTZ | Fecha de creación | ✅ Canónico |
| `updated_at` | TIMESTAMPTZ | Fecha de actualización | ✅ Canónico |

**Campos Legacy (deprecados pero existen):**
- `category_key` - **DEPRECADO** - Reemplazado por `transmutacion_lista_classifications` + `pde_classification_terms`
- `subtype_key` - **DEPRECADO** - Reemplazado por `transmutacion_lista_classifications` + `pde_classification_terms`
- `tags` (JSONB) - **DEPRECADO** - Reemplazado por `transmutacion_lista_classifications` + `pde_classification_terms`

### 1.3. Estado Actual

**Migración canónica:** `v5.34.0-transmutaciones-energeticas-sot-canonical.sql`
- ✅ `status` es el campo canónico para soft delete
- ❌ `activo` (BOOLEAN) es legacy pero todavía existe en la tabla
- ⚠️ **PROBLEMA DETECTADO:** Hay código que todavía usa `activo = true` además de `status = 'active'`

**Filtros actuales en código:**
- Algunos queries usan: `WHERE (status = 'active' OR activo = true)`
- Otros usan solo: `WHERE status = 'active'`
- **AMBIGÜEDAD:** No hay contrato claro de cuál usar

### 1.4. Dónde se Usan

**Lecturas:**
- `src/infra/repos/alquimia-catalog-repo-pg.js` - Listado de listas
- `src/services/alquimia-general-service.js` - Servicio de negocio
- `src/services/alquimia-alumno-service.js` - Servicio por alumno
- Endpoints MASTER: `/master/api/alquimia-general/*`

**Escrituras:**
- `src/infra/repos/alquimia-catalog-repo-pg.js` - Crear/actualizar/archivar listas
- Endpoints MASTER: `/master/api/alquimia-general/lists/*`

### 1.5. Dónde NO se Usan (pero podrían)

- **Legacy domains:** `transmutaciones-lugares.js`, `transmutaciones-proyectos.js`, `transmutaciones-apadrinados.js` usan tablas separadas (`transmutaciones_lugares`, `transmutaciones_proyectos`, etc.) en lugar de `listas_transmutaciones`

---

## 2. ÍTEMS DE TRANSMUTACIONES (`items_transmutaciones`)

### 2.1. ¿Qué son conceptualmente?

Los **items de transmutaciones** son elementos energéticos individuales dentro de una lista. Cada item representa algo que debe ser "limpiado" o "transmutado" por los estudiantes.

**Semántica:** Un item es un concepto energético específico (ej: "Eje divino", "Pobreza económica", etc.)

### 2.2. Campos Reales (PostgreSQL)

**Tabla:** `items_transmutaciones`

| Campo | Tipo | Descripción | Estado | ¿Afecta Runtime? |
|-------|------|-------------|--------|------------------|
| `id` | SERIAL PRIMARY KEY | ID único del item | ✅ Canónico | ✅ Sí (FK) |
| `lista_id` | INTEGER NOT NULL | FK a `listas_transmutaciones.id` | ✅ Canónico | ✅ Sí (agrupación) |
| `item_ref` | TEXT UNIQUE NOT NULL | Referencia canónica (ej: `te_item_119`) | ✅ Canónico | ✅ Sí (usado en `cleaning_item_state`) |
| `nombre` | VARCHAR(255) | Nombre del item | ✅ Canónico | ✅ Sí (display) |
| `descripcion` | TEXT | Descripción opcional | ✅ Canónico | ⚠️ Decorativo (no usado en lógica) |
| `nivel` | INTEGER | Nivel mínimo requerido | ✅ Canónico | ✅ Sí (filtrado por `nivel_efectivo`) |
| `frecuencia_dias` | INTEGER | Días para limpieza recurrente (default: 20) | ✅ Canónico | ✅ Sí (threshold para `reviewed`/`pending`) |
| `veces_limpiar` | INTEGER | Veces a limpiar para `una_vez` | ✅ Canónico | ✅ Sí (`required_count` en Cleaning Engine) |
| `prioridad` | INTEGER | Prioridad (1 = máxima, default: 10) | ✅ Canónico | ✅ Sí (ORDER BY priority ASC) |
| `grupo` | TEXT | Grupo opcional para agrupación | ✅ Canónico | ⚠️ Decorativo (solo visual) |
| `orden` | INTEGER | Orden dentro de la lista | ✅ Canónico | ⚠️ No usado (se usa `priority` o `nivel, created_at`) |
| `status` | VARCHAR(20) | `'active'` o `'archived'` | ✅ Canónico | ✅ Sí (filtrado) |
| `activo` | BOOLEAN | **LEGACY** - Usar `status` | ❌ Legacy | ❌ No (legacy) |
| `created_at` | TIMESTAMPTZ | Fecha de creación | ✅ Canónico | ✅ Sí (ORDER BY created_at ASC) |
| `updated_at` | TIMESTAMPTZ | Fecha de actualización | ✅ Canónico | ⚠️ Auditoría (no lógica) |

**Campos adicionales detectados en código (pero no en schema visible):**
- `critical_multiplier` - Detectado en `alquimia-general-service.js:552` como `item.critical_multiplier || 2.0` - **⚠️ NO EXISTE EN SCHEMA** (probablemente metadata JSONB o campo no migrado)

### 2.3. Campos que Afectan Runtime

**Campos críticos para lógica:**
1. `item_ref` - Usado como clave en `cleaning_item_state` (PK parcial)
2. `nivel` - Filtrado: `item.nivel > nivel_efectivo` → NO APLICA
3. `frecuencia_dias` - Threshold para estados `reviewed`/`pending`/`important` (recurrente)
4. `veces_limpiar` - `required_count` para cálculo de `remaining` (una_vez)
5. `status` - Filtrado: solo `status = 'active'`
6. `lista_id` - Agrupación y tipo (`recurrente` vs `una_vez`)

**Campos decorativos (no afectan lógica):**
- `descripcion` - Solo display
- `grupo` - Solo agrupación visual
- `orden` - No usado (se usa `priority` o `nivel, created_at`)

### 2.4. Relación con Listas

**Cardinalidad:** Many-to-One (muchos items → una lista)

**Constraint:** `lista_id INTEGER NOT NULL REFERENCES listas_transmutaciones(id) ON DELETE CASCADE`

**Suposiciones implícitas:**
- ✅ Un item siempre pertenece a una lista
- ✅ Si se elimina una lista, se eliminan sus items (CASCADE)
- ⚠️ **NO HAY CONTRATO EXPLÍCITO:** No hay verificación de que el `tipo` del item coincida con el `tipo` de la lista

### 2.5. Relación con Niveles

**Filtrado por nivel:**
- Items con `nivel > nivel_efectivo` del estudiante → **NO APLICAN**
- Sección colapsable en UI: "NO APLICA (nivel)"
- **Fuente de verdad:** `nivel_efectivo` viene de Level Engine PDE v1 (`getStudentEffectiveLevel()`)

**Ordenamiento:**
- **LEY ABSOLUTA:** `ORDER BY nivel ASC, created_at ASC` (según comentario en `alquimia-general-service.js:142`)

---

## 3. RELACIÓN LISTAS ↔ ÍTEMS

### 3.1. Cardinalidad

- **Una lista** tiene **muchos items** (1:N)
- **Un item** pertenece a **una lista** (N:1)

**Constraint:** `items_transmutaciones.lista_id → listas_transmutaciones.id` (CASCADE)

### 3.2. Suposiciones Implícitas

**✅ Explícitas:**
- Si se elimina una lista, se eliminan sus items (CASCADE)

**❌ No explícitas (suposiciones implícitas):**
1. **Tipo:** No hay constraint que verifique que el `tipo` del item sea consistente con el `tipo` de la lista
   - Ejemplo: Una lista `tipo='recurrente'` podría tener items con `veces_limpiar` (que es para `una_vez`)
2. **Estado:** No hay constraint que verifique que si una lista está `archived`, sus items también deberían estar
3. **Orden:** El campo `orden` en items no se usa realmente (se usa `priority` o `nivel, created_at`)

### 3.3. Contratos Inexistentes

**Contratos que deberían existir pero no existen:**

1. **Contrato de Tipo:**
   - Si `lista.tipo = 'recurrente'` → Items usan `frecuencia_dias`, NO `veces_limpiar`
   - Si `lista.tipo = 'una_vez'` → Items usan `veces_limpiar`, NO `frecuencia_dias`
   - **Estado actual:** No hay constraint ni validación

2. **Contrato de Estado:**
   - Si `lista.status = 'archived'` → Todos los items deberían estar `archived` también
   - **Estado actual:** No hay constraint ni trigger

3. **Contrato de Orden:**
   - **LEY ABSOLUTA documentada:** `ORDER BY nivel ASC, created_at ASC`
   - Pero también existe `priority` (migración v5.47.0)
   - **AMBIGÜEDAD:** ¿Qué se usa realmente? `priority` o `nivel, created_at`?

---

## 4. ESTADO ACTUAL DEL CATÁLOGO

### 4.1. Datos Reales (según diagnóstico anterior)

**Del documento `DIAGNOSTICO_ALQUIMIA_ALUMNO_STATE_GAP_V1.md`:**
- Total items activos: **117**
- Total listas activas: **16**
- Todos los items tienen `item_ref` y `lista_id` (100% consistente)
- Gap: **112 items sin estado** en `cleaning_item_state` para student_id=4 (95.7% del catálogo)

### 4.2. Índices Existentes

**`listas_transmutaciones`:**
- `idx_listas_transmutaciones_tipo` - Por tipo
- `idx_listas_transmutaciones_activo` - **LEGACY** (por `activo`)
- `idx_listas_transmutaciones_orden` - Por orden
- `idx_listas_transmutaciones_tipo_status_orden` - Compuesto (tipo, status, orden) WHERE status='active'

**`items_transmutaciones`:**
- `idx_items_transmutaciones_lista` - Por lista_id
- `idx_items_transmutaciones_nivel` - Por nivel
- `idx_items_transmutaciones_activo` - **LEGACY** (por `activo`)
- `idx_items_transmutaciones_orden` - Por orden
- `idx_items_transmutaciones_item_ref` - Por item_ref (UNIQUE)
- `idx_items_transmutaciones_prioridad` - Por priority
- `idx_items_transmutaciones_lista_priority` - Compuesto (lista_id, priority, nivel, created_at) WHERE status='active'
- `idx_items_transmutaciones_lista_status_nivel` - Compuesto (lista_id, status, nivel, created_at) WHERE status='active'

### 4.3. Problemas Detectados

1. **Legacy `activo` todavía existe:**
   - Tablas tienen tanto `status` como `activo`
   - Código usa `WHERE (status = 'active' OR activo = true)`
   - **Sin contrato claro** de cuál usar

2. **Campos decorativos no usados:**
   - `orden` en items no se usa (se usa `priority` o `nivel, created_at`)
   - `descripcion` no afecta lógica
   - `grupo` solo visual

3. **Contrato de ordenamiento ambiguo:**
   - Documentado: `ORDER BY nivel ASC, created_at ASC`
   - Existe: `priority` (migración v5.47.0)
   - **No hay contrato claro** de cuál se usa realmente

4. **Campo `critical_multiplier` no existe en schema:**
   - Detectado en código: `item.critical_multiplier || 2.0`
   - **No existe en migraciones** ni schema visible
   - Probablemente metadata JSONB o campo no migrado

---

## 5. CONCLUSIONES

### 5.1. Qué es Canónico

✅ **Canónico y estable:**
- `status` ('active'/'archived') - Soft delete canónico
- `item_ref` - Referencia canónica para `cleaning_item_state`
- `nivel` - Filtrado por nivel efectivo
- `frecuencia_dias` - Threshold para recurrentes (default: 20)
- `veces_limpiar` - Required count para una_vez
- `priority` - Ordenamiento (1 = máxima, default: 10)

### 5.2. Qué es Legacy

❌ **Legacy (deprecado pero existe):**
- `activo` (BOOLEAN) - Reemplazado por `status`
- `category_key`, `subtype_key`, `tags` (JSONB) - Reemplazados por sistema de clasificaciones canónico

### 5.3. Qué Requiere Decisión Futura

⚠️ **Pendiente de decisión:**
1. **Eliminar `activo`** - Requiere migración y actualización de código
2. **Contrato de ordenamiento** - ¿`priority` o `nivel, created_at`? Documentar y estandarizar
3. **Campo `critical_multiplier`** - ¿Existe en metadata JSONB? ¿Migrar a columna?
4. **Contratos de tipo** - Añadir constraints para verificar consistencia `lista.tipo` ↔ campos de item
5. **Contratos de estado** - Añadir triggers para archivar items cuando se archiva lista

### 5.4. Puntos Sin Contrato

🔴 **Sin contrato formal:**
- Tipo de item vs tipo de lista (no hay validación)
- Estado de items vs estado de lista (no hay sincronización)
- Ordenamiento (prioridad vs nivel+created_at)
- Campos decorativos vs campos lógicos (no hay separación clara)

---

**Fin del diagnóstico FASE A**
