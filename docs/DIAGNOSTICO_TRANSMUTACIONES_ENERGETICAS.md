# 🔍 DIAGNÓSTICO FORENSE: Transmutaciones Energéticas
## Sistema Actual → Reconstrucción Canónica en MASTER

**Fecha:** 2025-01-XX  
**Objetivo:** Documentar exhaustivamente el sistema actual de Transmutaciones Energéticas para reconstruirlo canónicamente en dominio MASTER (sección "Alquimia General")

---

## 📋 ÍNDICE

1. [Inventario de UI](#1-inventario-de-ui)
2. [Modelo de Datos Implícito](#2-modelo-de-datos-implícito)
3. [Tablas y Storage Actual](#3-tablas-y-storage-actual)
4. [Endpoints y Flujos](#4-endpoints-y-flujos)
5. [Problemas Detectados](#5-problemas-detectados)
6. [Mapa para Reconstrucción](#6-mapa-para-reconstrucción)

---

## 1. INVENTARIO DE UI

### 1.1. Vista Principal: `/admin/pde/transmutaciones-energeticas`

**Ubicación:** `src/core/html/admin/transmutaciones-energeticas/transmutaciones-list.html`

#### Componentes Visuales

**A) Tabs de Tipo (Superiores)**
- **Recurrentes** (tipo: `recurrente`)
- **Una Sola Vez** (tipo: `una_vez`)
- Filtran las listas mostradas

**B) Tabs de Listas (Navegación Horizontal)**
- Botones horizontales compactos
- Cada botón representa una lista
- Se cargan dinámicamente según tipo activo
- Botón "➕ Nueva Lista" al final

**C) Header de Lista Seleccionada**
- **Nombre de lista** (editable inline)
- **Descripción** (editable inline)
- Botones:
  - ⚙️ **Editar** (muestra/oculta editor inline)
  - ❌ **Eliminar** (soft delete: `status='archived'`)
- **Panel de Clasificaciones** (plegable):
  - Category Key (autocomplete)
  - Subtype Key (autocomplete)
  - Tags (autocomplete + botón "➕ Agregar Tag")
  - Tags asociados actuales (con botón × para eliminar)

**D) Línea Rápida de Creación de Items**
- Formulario inline arriba de la tabla
- Campos:
  - **Nivel** (number, min=1)
  - **Nombre** (text, required)
  - **Descripción** (text, optional)
  - **Días / Veces** (number, min=1) - cambia según tipo:
    - `recurrente` → "Días" (campo: `frecuencia_dias`)
    - `una_vez` → "Veces" (campo: `veces_limpiar`)
- Botón "Crear (Enter)" - submit con Enter

**E) Tabla de Items**
- Columnas:
  - **Nivel** (editable inline, number)
  - **Nombre** (editable inline, text)
  - **Descripción** (editable inline, text)
  - **Días / Veces** (editable inline, number) - cambia según tipo
  - **Acciones**:
    - **Ver** (botón azul) → abre modal de alumnos
    - **Limpiar** (botón verde) → limpieza masiva
    - **❌** (botón rojo) → DELETE físico del item
- Orden: `ORDER BY nivel ASC, created_at ASC` (LEY ABSOLUTA)
- Edición inline con debounce (500ms)

**F) Modal de Alumnos** (`#modal-alumnos`)
- Se abre al hacer clic en "Ver" de un item
- Título: "Alumnos: X total"
- Tres secciones agrupadas:
  - **✅ Limpio (X)** - alumnos con estado `clean`
  - **⏳ Pendiente (X)** - alumnos con estado `pending`
  - **🚨 Crítico (X)** - alumnos con estado `critical`
- Cada alumno muestra:
  - Nombre completo
  - Días desde última limpieza (o "Nunca limpiado")
  - Botón "Marcar Limpio" (solo en Pendiente/Crítico)
- Cierre: ESC, click fuera, botón ❌

### 1.2. Acciones por Item

**A) Recurrentes (`tipo='recurrente'`)**
- **Ver alumnos:**
  - Endpoint: `GET /admin/api/transmutations/:item_ref/students?product_key=pde`
  - Muestra estado temporal: `clean`, `pending`, `critical`
  - Calcula días desde `last_cleaned_at`
- **Limpiar todos:**
  - Endpoint: `POST /admin/pde/transmutaciones-energeticas/api/items/:id/master/mark-clean-all`
  - Actualiza `student_te_recurrent_state` para todos los alumnos activos
- **Limpiar individual:**
  - Endpoint: `POST /admin/api/students/:id/domains/transmutation/items/:item_ref/clean?product_key=pde`
  - Marca limpio un alumno específico

**B) Una Vez (`tipo='una_vez'`)**
- **Ver alumnos:**
  - Endpoint: `GET /admin/api/transmutations/:item_ref/students?product_key=pde`
  - Muestra `remaining`, `completed`, `is_complete`
- **Incrementar todos:**
  - Endpoint: `POST /admin/pde/transmutaciones-energeticas/api/items/:id/master/increment-all`
  - Decrementa `remaining` en 1 para todos (mínimo 0)
- **Ajustar remaining individual:**
  - Endpoint: `POST /admin/pde/transmutaciones-energeticas/api/items/:id/master/adjust-remaining`
  - Body: `{ student_email, remaining }`
  - Ajusta manualmente el contador

### 1.3. Acciones Masivas

- **Crear lista:** `POST /admin/pde/transmutaciones-energeticas`
- **Archivar lista:** `DELETE /admin/pde/transmutaciones-energeticas/:id` (soft delete)
- **Crear item:** `POST /admin/pde/transmutaciones-energeticas/api/items`
- **Eliminar item:** `DELETE /admin/pde/transmutaciones-energeticas/api/items/:id` (DELETE físico)

### 1.4. Estados Visibles

**En UI:**
- Listas: `active` / `archived` (filtro: solo `active`)
- Items: `active` / `archived` (filtro: solo `active`)
- Alumnos (recurrentes): `clean` / `pending` / `critical` (temporal)
- Alumnos (una_vez): `remaining`, `completed`, `is_complete`

**En Base de Datos:**
- `listas_transmutaciones.status`: `'active'` | `'archived'`
- `items_transmutaciones.status`: `'active'` | `'archived'`
- `student_te_recurrent_state.status`: `'active'` | `'archived'`
- `student_te_one_time_state.status`: `'active'` | `'archived'`

---

## 2. MODELO DE DATOS IMPLÍCITO

### 2.1. Datos del Alumno Involucrados

**A) Estado Recurrente (`student_te_recurrent_state`)**
- **Campos:**
  - `student_email` (TEXT, FK implícito a `alumnos.email`)
  - `item_id` (INTEGER, FK a `items_transmutaciones.id`)
  - `last_cleaned_at` (TIMESTAMPTZ)
  - `days_since_last_clean` (INTEGER, calculado)
  - `is_clean` (BOOLEAN)
  - `is_critical` (BOOLEAN)
  - `notes` (TEXT, opcional)
  - `status` (`'active'` | `'archived'`)
- **Cardinalidad:** 1:1 (UNIQUE(student_email, item_id))
- **Cálculo de estado temporal:**
  - `clean`: `is_clean = TRUE` OR `days_since_last_clean < frecuencia_dias`
  - `pending`: `frecuencia_dias <= days_since_last_clean < frecuencia_dias * 1.5`
  - `critical`: `days_since_last_clean >= frecuencia_dias * 1.5`

**B) Estado Una Vez (`student_te_one_time_state`)**
- **Campos:**
  - `student_email` (TEXT, FK implícito a `alumnos.email`)
  - `item_id` (INTEGER, FK a `items_transmutaciones.id`)
  - `remaining` (INTEGER, default 0)
  - `completed` (INTEGER, default 0)
  - `is_complete` (BOOLEAN, calculado: `remaining <= 0`)
  - `notes` (TEXT, opcional)
  - `status` (`'active'` | `'archived'`)
- **Cardinalidad:** 1:1 (UNIQUE(student_email, item_id))
- **Lógica:**
  - `remaining` = veces restantes a limpiar
  - `completed` = veces ya limpiadas
  - `is_complete` = `remaining <= 0`

**C) Integración con Student SOT v1**
- **Tabla:** `student_item_state` (nueva, canónica)
- **Campos relevantes:**
  - `student_id` (FK a `alumnos.id`)
  - `product_key` (`'pde'`)
  - `domain_type` (`'transmutation'`)
  - `item_ref` (TEXT, referencia al item)
  - `last_cleaned_at` (TIMESTAMPTZ)
  - `clean_count` (INTEGER)
  - `recommended_recurrence_days` (INTEGER)
  - `student_recurrence_days` (INTEGER, override del alumno)
  - `per_item_config` (JSONB, override por item)
- **Endpoint canónico:** `GET /admin/api/transmutations/:item_ref/students`
- **Endpoint limpieza:** `POST /admin/api/students/:id/domains/transmutation/items/:item_ref/clean`

### 2.2. Listas PDE

**A) Tabla: `listas_transmutaciones`**
- **Campos:**
  - `id` (SERIAL PRIMARY KEY)
  - `nombre` (VARCHAR(255), NOT NULL)
  - `tipo` (`'recurrente'` | `'una_vez'`)
  - `descripcion` (TEXT, nullable)
  - `orden` (INTEGER, default 0)
  - `category_key` (TEXT, nullable) - clasificación
  - `subtype_key` (TEXT, nullable) - clasificación
  - `tags` (JSONB, nullable) - array de tags
  - `status` (`'active'` | `'archived'`)
  - `activo` (BOOLEAN, **LEGACY** - no usar)
  - `created_at` (TIMESTAMPTZ)
  - `updated_at` (TIMESTAMPTZ, trigger automático)
- **Identificación:** Por `id` (INTEGER)
- **Metadatos:** Clasificaciones vía sistema canónico (`/admin/api/classifications/lista/:id`)

**B) Clasificaciones Automáticas**
- Al crear lista, se asigna automáticamente:
  - `tipo='recurrente'` → `category_key='Limpiezas recurrentes'`
  - `tipo='una_vez'` → `category_key='Una vez'`
- Sistema de clasificaciones: `/admin/api/classifications/*`

### 2.3. Items PDE

**A) Tabla: `items_transmutaciones`**
- **Campos:**
  - `id` (SERIAL PRIMARY KEY)
  - `lista_id` (INTEGER, FK a `listas_transmutaciones.id`)
  - `nombre` (VARCHAR(255), NOT NULL)
  - `descripcion` (TEXT, nullable)
  - `nivel` (INTEGER, default 9, nullable)
  - `frecuencia_dias` (INTEGER, nullable) - solo para `recurrente`
  - `veces_limpiar` (INTEGER, nullable) - solo para `una_vez`
  - `prioridad` (`'alta'` | `'media'` | `'bajo'`, default `'media'`)
  - `orden` (INTEGER, default 0)
  - `status` (`'active'` | `'archived'`)
  - `activo` (BOOLEAN, **LEGACY** - no usar)
  - `created_at` (TIMESTAMPTZ)
  - `updated_at` (TIMESTAMPTZ, trigger automático)
- **Orden canónico:** `ORDER BY nivel ASC, created_at ASC` (LEY ABSOLUTA)
- **Identificación:** Por `id` (INTEGER) o `item_ref` (TEXT en Student SOT)

### 2.4. Relación Alumno ↔ Transmutación

**A) Cardinalidad**
- **Lista → Items:** 1:N
- **Item → Alumnos:** N:M (vía `student_te_recurrent_state` o `student_te_one_time_state`)
- **Alumno → Items:** N:M

**B) Estados por Item**
- **Recurrentes:**
  - Estado inicial: No existe registro (se crea al marcar limpio)
  - Estado limpio: `last_cleaned_at = NOW()`, `is_clean = TRUE`
  - Estado pendiente: `days_since_last_clean >= frecuencia_dias`
  - Estado crítico: `days_since_last_clean >= frecuencia_dias * 1.5`
- **Una Vez:**
  - Estado inicial: No existe registro (se crea al ajustar)
  - Estado incompleto: `remaining > 0`, `is_complete = FALSE`
  - Estado completo: `remaining <= 0`, `is_complete = TRUE`

**C) Persistencia Actual**
- **Tablas legacy:**
  - `student_te_recurrent_state` (PostgreSQL)
  - `student_te_one_time_state` (PostgreSQL)
- **Tabla canónica (nueva):**
  - `student_item_state` (PostgreSQL, Student SOT v1)
- **Problema:** Duplicación de lógica entre tablas legacy y canónica

---

## 3. TABLAS Y STORAGE ACTUAL

### 3.1. Tablas PostgreSQL Reales

**A) `listas_transmutaciones`**
```sql
CREATE TABLE listas_transmutaciones (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  tipo VARCHAR(20) NOT NULL DEFAULT 'recurrente',
  descripcion TEXT,
  activo BOOLEAN DEFAULT TRUE,  -- LEGACY
  orden INTEGER DEFAULT 0,
  category_key TEXT,  -- nullable
  subtype_key TEXT,  -- nullable
  tags JSONB,  -- nullable
  status VARCHAR(20) DEFAULT 'active',  -- CANÓNICO
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```
- **Índices:**
  - `idx_listas_transmutaciones_tipo`
  - `idx_listas_transmutaciones_activo` (LEGACY)
  - `idx_listas_transmutaciones_orden`
  - `idx_listas_transmutaciones_status` (WHERE status='active')
- **Constraints:**
  - `CHECK (tipo IN ('recurrente', 'una_vez'))`
  - `CHECK (status IN ('active', 'archived'))`

**B) `items_transmutaciones`**
```sql
CREATE TABLE items_transmutaciones (
  id SERIAL PRIMARY KEY,
  lista_id INTEGER NOT NULL REFERENCES listas_transmutaciones(id) ON DELETE CASCADE,
  nombre VARCHAR(255) NOT NULL,
  descripcion TEXT,
  nivel INTEGER NOT NULL DEFAULT 9,
  frecuencia_dias INTEGER,  -- nullable, solo recurrente
  veces_limpiar INTEGER,  -- nullable, solo una_vez
  prioridad VARCHAR(10) DEFAULT 'media',
  orden INTEGER DEFAULT 0,
  activo BOOLEAN DEFAULT TRUE,  -- LEGACY
  status VARCHAR(20) DEFAULT 'active',  -- CANÓNICO
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```
- **Índices:**
  - `idx_items_transmutaciones_lista`
  - `idx_items_transmutaciones_nivel`
  - `idx_items_transmutaciones_activo` (LEGACY)
  - `idx_items_transmutaciones_orden`
  - `idx_items_transmutaciones_prioridad`
  - `idx_items_transmutaciones_status` (WHERE status='active')
- **Constraints:**
  - `CHECK (prioridad IN ('alta', 'media', 'bajo'))`
  - `CHECK (status IN ('active', 'archived'))`

**C) `student_te_recurrent_state`** (LEGACY, pero activa)
```sql
CREATE TABLE student_te_recurrent_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_email TEXT NOT NULL,
  item_id INTEGER NOT NULL REFERENCES items_transmutaciones(id) ON DELETE CASCADE,
  last_cleaned_at TIMESTAMPTZ,
  days_since_last_clean INTEGER DEFAULT 0,
  is_clean BOOLEAN DEFAULT FALSE,
  is_critical BOOLEAN DEFAULT FALSE,
  notes TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_email, item_id)
);
```
- **Índices:**
  - `idx_student_te_recurrent_student`
  - `idx_student_te_recurrent_item`
  - `idx_student_te_recurrent_status` (WHERE status='active')
  - `idx_student_te_recurrent_critical` (WHERE is_critical=TRUE)
  - `idx_student_te_recurrent_clean` (WHERE is_clean=FALSE)

**D) `student_te_one_time_state`** (LEGACY, pero activa)
```sql
CREATE TABLE student_te_one_time_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_email TEXT NOT NULL,
  item_id INTEGER NOT NULL REFERENCES items_transmutaciones(id) ON DELETE CASCADE,
  remaining INTEGER NOT NULL DEFAULT 0,
  completed INTEGER NOT NULL DEFAULT 0,
  is_complete BOOLEAN DEFAULT FALSE,
  notes TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_email, item_id)
);
```
- **Índices:**
  - `idx_student_te_one_time_student`
  - `idx_student_te_one_time_item`
  - `idx_student_te_one_time_status` (WHERE status='active')
  - `idx_student_te_one_time_complete` (WHERE is_complete=FALSE)

**E) `student_item_state`** (CANÓNICA, Student SOT v1)
```sql
-- Estructura aproximada (verificar en código real)
CREATE TABLE student_item_state (
  id UUID PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES alumnos(id),
  product_key VARCHAR(50) NOT NULL,
  domain_type VARCHAR(50) NOT NULL,  -- 'transmutation', 'project', etc.
  item_ref TEXT NOT NULL,
  last_cleaned_at TIMESTAMPTZ,
  clean_count INTEGER DEFAULT 0,
  recommended_recurrence_days INTEGER,
  student_recurrence_days INTEGER,
  per_item_config JSONB,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(student_id, product_key, domain_type, item_ref)
);
```

**F) `items_transmutaciones_alumnos`** (LEGACY, posiblemente no usada)
```sql
CREATE TABLE items_transmutaciones_alumnos (
  id SERIAL PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES items_transmutaciones(id) ON DELETE CASCADE,
  alumno_id INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
  ultima_limpieza TIMESTAMP,
  veces_completadas INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (item_id, alumno_id)
);
```
- **Estado:** Posiblemente legacy, verificar si se usa

### 3.2. Campos Problemáticos

**A) Duplicación de Estado**
- `activo` (BOOLEAN) vs `status` (VARCHAR) en `listas_transmutaciones` e `items_transmutaciones`
- **Solución:** Usar solo `status` (canónico)

**B) FK Implícita**
- `student_te_recurrent_state.student_email` y `student_te_one_time_state.student_email` no tienen FK explícita
- **Riesgo:** Integridad referencial no garantizada
- **Solución:** Migrar a `student_item_state` con FK a `alumnos.id`

**C) Campos Legacy No Usados**
- `items_transmutaciones_alumnos` posiblemente no se usa
- **Verificar:** Query de uso real

### 3.3. Duplicidades o Acoplamientos Incorrectos

**A) Dos Sistemas de Estado**
- **Legacy:** `student_te_recurrent_state` + `student_te_one_time_state`
- **Canónico:** `student_item_state` (Student SOT v1)
- **Problema:** Lógica duplicada, posible inconsistencia

**B) Endpoints Duplicados**
- **Legacy:** `/admin/pde/transmutaciones-energeticas/api/items/:id/master/*`
- **Canónico:** `/admin/api/transmutations/:item_ref/students` y `/admin/api/students/:id/domains/transmutation/*`
- **Problema:** Dos formas de hacer lo mismo

**C) Cálculo de Estado Temporal**
- **Legacy:** En `getRecurrentStateForItem()` (repo)
- **Canónico:** En `resolveTemporalState()` (core/student/domains)
- **Problema:** Lógica duplicada

---

## 4. ENDPOINTS Y FLUJOS

### 4.1. Endpoints de Listas

**A) GET `/admin/pde/transmutaciones-energeticas`**
- **Handler:** `admin-transmutaciones-energeticas.js` → `renderTransmutacionesList()`
- **Acción:** Renderiza HTML con template
- **Datos lee:** Ninguno (se cargan vía API en frontend)
- **Datos escribe:** Ninguno
- **Side-effects:** Ninguno

**B) GET `/admin/pde/transmutaciones-energeticas/api/listas?tipo=...`**
- **Handler:** `admin-transmutaciones-energeticas.js`
- **Acción:** Lista listas activas (filtro opcional por tipo)
- **Datos lee:** `listas_transmutaciones` (WHERE status='active')
- **Datos escribe:** Ninguno
- **Side-effects:** Ninguno

**C) POST `/admin/pde/transmutaciones-energeticas`**
- **Handler:** `admin-transmutaciones-energeticas.js`
- **Acción:** Crea nueva lista
- **Datos lee:** Body JSON (`nombre`, `tipo`, `descripcion`, etc.)
- **Datos escribe:** `listas_transmutaciones` (INSERT)
- **Side-effects:** 
  - Asigna `category_key` automático según tipo
  - Crea clasificación vía `/admin/api/classifications/ensure`

**D) GET `/admin/pde/transmutaciones-energeticas/:id`**
- **Handler:** `admin-transmutaciones-energeticas.js`
- **Acción:** Obtiene lista por ID
- **Datos lee:** `listas_transmutaciones` (WHERE id=:id)
- **Datos escribe:** Ninguno
- **Side-effects:** Ninguno

**E) PUT `/admin/pde/transmutaciones-energeticas/:id`**
- **Handler:** `admin-transmutaciones-energeticas.js`
- **Acción:** Actualiza metadata de lista
- **Datos lee:** Body JSON (parcial)
- **Datos escribe:** `listas_transmutaciones` (UPDATE)
- **Side-effects:** Trigger actualiza `updated_at`

**F) DELETE `/admin/pde/transmutaciones-energeticas/:id`**
- **Handler:** `admin-transmutaciones-energeticas.js`
- **Acción:** Archiva lista (soft delete)
- **Datos lee:** Ninguno
- **Datos escribe:** `listas_transmutaciones` (UPDATE SET status='archived')
- **Side-effects:** Ninguno

### 4.2. Endpoints de Items

**A) GET `/admin/pde/transmutaciones-energeticas/api/listas/:id/items`**
- **Handler:** `admin-transmutaciones-energeticas.js`
- **Acción:** Lista items de una lista (ordenados por nivel ASC)
- **Datos lee:** `items_transmutaciones` (WHERE lista_id=:id AND status='active')
- **Datos escribe:** Ninguno
- **Side-effects:** Ninguno

**B) POST `/admin/pde/transmutaciones-energeticas/api/items`**
- **Handler:** `admin-transmutaciones-energeticas.js`
- **Acción:** Crea nuevo item
- **Datos lee:** Body JSON (`lista_id`, `nombre`, `nivel`, `frecuencia_dias`/`veces_limpiar`)
- **Datos escribe:** `items_transmutaciones` (INSERT)
- **Side-effects:** Trigger actualiza `updated_at`

**C) PUT `/admin/pde/transmutaciones-energeticas/api/items/:id`**
- **Handler:** `admin-transmutaciones-energeticas.js`
- **Acción:** Actualiza item (edición inline)
- **Datos lee:** Body JSON (parcial)
- **Datos escribe:** `items_transmutaciones` (UPDATE)
- **Side-effects:** Trigger actualiza `updated_at`

**D) DELETE `/admin/pde/transmutaciones-energeticas/api/items/:id`**
- **Handler:** `admin-transmutaciones-energeticas.js`
- **Acción:** DELETE físico del item
- **Datos lee:** Ninguno
- **Datos escribe:** `items_transmutaciones` (DELETE)
- **Side-effects:** 
  - CASCADE elimina `student_te_recurrent_state` y `student_te_one_time_state`
  - ⚠️ **PROBLEMA:** DELETE físico (viola soft delete)

### 4.3. Endpoints Master (Legacy)

**A) GET `/admin/pde/transmutaciones-energeticas/api/items/:id/master/students-recurrent`**
- **Handler:** `admin-transmutaciones-energeticas.js`
- **Acción:** Obtiene estado de alumnos (recurrente)
- **Datos lee:** 
  - `items_transmutaciones` (WHERE id=:id)
  - `student_te_recurrent_state` (WHERE item_id=:id AND status='active')
- **Datos escribe:** Ninguno
- **Side-effects:** Ninguno

**B) POST `/admin/pde/transmutaciones-energeticas/api/items/:id/master/mark-clean-all`**
- **Handler:** `admin-transmutaciones-energeticas.js`
- **Acción:** Marca limpio todos los alumnos (recurrente)
- **Datos lee:** `items_transmutaciones` (WHERE id=:id)
- **Datos escribe:** `student_te_recurrent_state` (UPDATE SET last_cleaned_at=NOW(), is_clean=TRUE)
- **Side-effects:** Actualiza múltiples registros

**C) POST `/admin/pde/transmutaciones-energeticas/api/items/:id/master/mark-clean-student`**
- **Handler:** `admin-transmutaciones-energeticas.js`
- **Acción:** Marca limpio un alumno específico (recurrente)
- **Datos lee:** Body JSON (`student_email`)
- **Datos escribe:** `student_te_recurrent_state` (UPSERT)
- **Side-effects:** Crea registro si no existe

**D) GET `/admin/pde/transmutaciones-energeticas/api/items/:id/master/students-one-time`**
- **Handler:** `admin-transmutaciones-energeticas.js`
- **Acción:** Obtiene estado de alumnos (una_vez)
- **Datos lee:** 
  - `items_transmutaciones` (WHERE id=:id)
  - `student_te_one_time_state` (WHERE item_id=:id AND status='active')
- **Datos escribe:** Ninguno
- **Side-effects:** Ninguno

**E) POST `/admin/pde/transmutaciones-energeticas/api/items/:id/master/increment-all`**
- **Handler:** `admin-transmutaciones-energeticas.js`
- **Acción:** Incrementa +1 todos los alumnos (una_vez)
- **Datos lee:** `items_transmutaciones` (WHERE id=:id)
- **Datos escribe:** `student_te_one_time_state` (UPDATE SET remaining=GREATEST(remaining-1, 0))
- **Side-effects:** Actualiza múltiples registros

**F) POST `/admin/pde/transmutaciones-energeticas/api/items/:id/master/adjust-remaining`**
- **Handler:** `admin-transmutaciones-energeticas.js`
- **Acción:** Ajusta remaining manualmente (una_vez)
- **Datos lee:** Body JSON (`student_email`, `remaining`)
- **Datos escribe:** `student_te_one_time_state` (UPSERT)
- **Side-effects:** Crea registro si no existe

### 4.4. Endpoints Canónicos (Student SOT v1)

**A) GET `/admin/api/transmutations/:item_ref/students?product_key=pde`**
- **Handler:** `admin-api-transmutations-item-students.js`
- **Acción:** Lista TODOS los alumnos con estado respecto a un item
- **Datos lee:**
  - `alumnos` (WHERE status='active')
  - `student_item_state` (LEFT JOIN, WHERE product_key='pde' AND domain_type='transmutation' AND item_ref=:item_ref)
- **Datos escribe:** Ninguno
- **Side-effects:** Calcula estado temporal vía `resolveTemporalState()`

**B) GET `/admin/api/students/:id/domains/transmutation?product_key=pde`**
- **Handler:** `admin-api-student-domains.js`
- **Acción:** Lista transmutaciones de un alumno
- **Datos lee:**
  - `alumnos` (WHERE id=:id)
  - `student_item_state` (WHERE student_id=:id AND product_key='pde' AND domain_type='transmutation')
- **Datos escribe:** Ninguno
- **Side-effects:** Ninguno

**C) POST `/admin/api/students/:id/domains/transmutation/items/:item_ref/clean?product_key=pde`**
- **Handler:** `admin-api-student-domains.js`
- **Acción:** Limpia transmutación (Master)
- **Datos lee:**
  - `alumnos` (WHERE id=:id)
  - `items_transmutaciones` (WHERE id=:item_ref o item_ref)
- **Datos escribe:** `student_item_state` (UPSERT, actualiza `last_cleaned_at`)
- **Side-effects:** 
  - Actualiza `clean_count`
  - Puede emitir señales (verificar)

### 4.5. Endpoints de Clasificaciones

**A) GET `/admin/api/classifications/lista/:id`**
- **Handler:** Sistema de clasificaciones canónico
- **Acción:** Obtiene clasificaciones asociadas a una lista
- **Datos lee:** Tablas de clasificaciones (verificar estructura)
- **Datos escribe:** Ninguno
- **Side-effects:** Ninguno

**B) POST `/admin/api/classifications/ensure`**
- **Handler:** Sistema de clasificaciones canónico
- **Acción:** Crea o obtiene término de clasificación
- **Datos lee:** Body JSON (`type`, `value`)
- **Datos escribe:** Tablas de clasificaciones (INSERT o SELECT)
- **Side-effects:** Crea término si no existe

**C) POST `/admin/api/classifications/lista/:id/associate`**
- **Handler:** Sistema de clasificaciones canónico
- **Acción:** Asocia término a lista
- **Datos lee:** Body JSON (`term_id`)
- **Datos escribe:** Tabla de asociaciones (INSERT)
- **Side-effects:** Ninguno

**D) DELETE `/admin/api/classifications/lista/:id/dissociate/:term_id`**
- **Handler:** Sistema de clasificaciones canónico
- **Acción:** Desasocia término de lista
- **Datos lee:** Ninguno
- **Datos escribe:** Tabla de asociaciones (DELETE)
- **Side-effects:** Ninguno

---

## 5. PROBLEMAS DETECTADOS

### 5.1. Problemas de Arquitectura

**A) Duplicación de Sistemas de Estado**
- **Problema:** Dos sistemas paralelos:
  - Legacy: `student_te_recurrent_state` + `student_te_one_time_state`
  - Canónico: `student_item_state` (Student SOT v1)
- **Impacto:** Lógica duplicada, posible inconsistencia, mantenimiento complejo
- **Severidad:** ALTA

**B) Endpoints Duplicados**
- **Problema:** Dos formas de hacer lo mismo:
  - Legacy: `/admin/pde/transmutaciones-energeticas/api/items/:id/master/*`
  - Canónico: `/admin/api/transmutations/:item_ref/students` y `/admin/api/students/:id/domains/transmutation/*`
- **Impacto:** Confusión, código duplicado, posibles bugs
- **Severidad:** MEDIA

**C) DELETE Físico de Items**
- **Problema:** `DELETE /admin/pde/transmutaciones-energeticas/api/items/:id` hace DELETE físico
- **Impacto:** Violación de soft delete, pérdida de datos, CASCADE elimina estados de alumnos
- **Severidad:** ALTA

**D) FK Implícita en Estados Legacy**
- **Problema:** `student_te_recurrent_state.student_email` y `student_te_one_time_state.student_email` no tienen FK explícita
- **Impacto:** Integridad referencial no garantizada, posibles orfandades
- **Severidad:** MEDIA

### 5.2. Problemas de Source of Truth

**A) Campos Legacy (`activo`) vs Canónicos (`status`)**
- **Problema:** Tablas tienen ambos campos, código usa ambos
- **Impacto:** Confusión, posible inconsistencia
- **Severidad:** MEDIA

**B) Cálculo de Estado Temporal Duplicado**
- **Problema:** Lógica en dos lugares:
  - Legacy: `getRecurrentStateForItem()` (repo)
  - Canónico: `resolveTemporalState()` (core/student/domains)
- **Impacto:** Posible divergencia de resultados
- **Severidad:** MEDIA

**C) Tabla Legacy No Verificada**
- **Problema:** `items_transmutaciones_alumnos` posiblemente no se usa
- **Impacto:** Confusión, posible código muerto
- **Severidad:** BAJA

### 5.3. Problemas de Acoplamiento UI ↔ Lógica

**A) HTML Inline en JavaScript**
- **Problema:** Template HTML grande en `transmutaciones-list.html` (1695 líneas)
- **Impacto:** Mantenimiento difícil, violación de separación de concerns
- **Severidad:** MEDIA

**B) Lógica de Negocio en Handler**
- **Problema:** Handler `admin-transmutaciones-energeticas.js` tiene lógica de negocio mezclada
- **Impacto:** Difícil testear, violación de capas
- **Severidad:** MEDIA

**C) Clasificaciones Automáticas en Frontend**
- **Problema:** Frontend asigna `category_key` automático al crear lista
- **Impacto:** Lógica de negocio en frontend, posible inconsistencia
- **Severidad:** BAJA

### 5.4. Problemas de Dominio (Admin vs Master vs Alumno)

**A) Dominio Admin vs Master**
- **Problema:** Sistema actual está en `/admin/pde/*` pero debe migrar a `/master/*`
- **Impacto:** Violación de separación de dominios
- **Severidad:** ALTA

**B) Falta de Vista Alumno**
- **Problema:** No hay vista para que alumnos vean sus transmutaciones
- **Impacto:** Solo Master puede gestionar, alumnos no tienen visibilidad
- **Severidad:** MEDIA

**C) Integración con Student SOT Parcial**
- **Problema:** Endpoints canónicos existen pero UI aún usa endpoints legacy
- **Impacto:** Migración incompleta, posible inconsistencia
- **Severidad:** MEDIA

---

## 6. MAPA PARA RECONSTRUCCIÓN

### 6.1. Entidades Canónicas Necesarias

**A) Catálogo PDE (Source of Truth)**
- **Tabla:** `listas_transmutaciones` (mantener, limpiar)
- **Tabla:** `items_transmutaciones` (mantener, limpiar)
- **Responsabilidad:** Definir qué transmutaciones existen
- **Separación:** NO contiene estado de alumnos

**B) Estado de Alumnos (Student SOT)**
- **Tabla:** `student_item_state` (usar, migrar desde legacy)
- **Responsabilidad:** Estado de cada alumno respecto a cada item
- **Separación:** NO contiene definición de items

**C) Clasificaciones (Sistema Canónico)**
- **Sistema:** `/admin/api/classifications/*` (mantener)
- **Responsabilidad:** Clasificar listas e items
- **Separación:** Independiente de transmutaciones

### 6.2. Separaciones Obligatorias

**A) Catálogo vs Estado**
- **Catálogo:** `listas_transmutaciones` + `items_transmutaciones` (qué existe)
- **Estado:** `student_item_state` (qué ha hecho cada alumno)
- **Regla:** Catálogo NO debe tener campos de estado de alumnos

**B) Admin vs Master vs Alumno**
- **Admin:** Gestión de catálogo (crear/editar listas e items)
- **Master:** Gestión de estado de alumnos (marcar limpio, ajustar)
- **Alumno:** Visualización de su propio estado (futuro)
- **Regla:** Cada dominio tiene sus propios endpoints y permisos

**C) Legacy vs Canónico**
- **Legacy:** `student_te_recurrent_state` + `student_te_one_time_state` (eliminar)
- **Canónico:** `student_item_state` (usar)
- **Regla:** Migrar datos y eliminar tablas legacy

### 6.3. Cosas que se Pueden Reaprovechar

**A) Estructura de Tablas**
- `listas_transmutaciones` y `items_transmutaciones` están bien diseñadas
- Solo limpiar campos legacy (`activo`)

**B) Lógica de Negocio**
- Cálculo de estado temporal (`resolveTemporalState()`) está bien
- Operaciones Master (marcar limpio, ajustar) están bien diseñadas

**C) Sistema de Clasificaciones**
- Sistema canónico funciona bien
- Mantener integración

**D) UI/UX**
- Flujo de tabs, edición inline, modal de alumnos está bien
- Reaprovechar estructura visual

### 6.4. Qué Debe Eliminarse

**A) Tablas Legacy**
- `student_te_recurrent_state` (migrar a `student_item_state`)
- `student_te_one_time_state` (migrar a `student_item_state`)
- `items_transmutaciones_alumnos` (verificar si se usa, eliminar si no)

**B) Campos Legacy**
- `activo` (BOOLEAN) en `listas_transmutaciones` e `items_transmutaciones`
- Usar solo `status` (VARCHAR)

**C) Endpoints Legacy**
- `/admin/pde/transmutaciones-energeticas/api/items/:id/master/*` (todos)
- Usar solo endpoints canónicos `/admin/api/transmutations/*` y `/admin/api/students/:id/domains/transmutation/*`

**D) Código Duplicado**
- `getRecurrentStateForItem()` y `getOneTimeStateForItem()` en repo
- Usar solo `resolveTemporalState()` canónico

### 6.5. Estructura Propuesta para MASTER

**A) Rutas MASTER**
- `/master/templo-luz/alquimia-general` (vista principal)
- `/master/api/alquimia-general/listas` (API de listas)
- `/master/api/alquimia-general/items` (API de items)
- `/master/api/alquimia-general/students/:id/state` (API de estado de alumno)

**B) Separación de Responsabilidades**
- **Catálogo:** Endpoints de lectura (listas, items)
- **Estado:** Endpoints de escritura (marcar limpio, ajustar)
- **Clasificaciones:** Sistema canónico existente

**C) Integración con Student SOT**
- Usar `student_item_state` como única fuente de verdad
- Endpoints canónicos: `/admin/api/students/:id/domains/transmutation/*`
- Eliminar dependencia de tablas legacy

**D) UI MASTER**
- Registry-driven (UI Master Factory v1)
- Theme-ready (variables CSS)
- DOM API únicamente (sin innerHTML)
- Integración con sidebar MASTER

---

## 📝 NOTAS FINALES

### Estado Actual
- Sistema funcional pero con duplicación y legacy
- Endpoints canónicos existen pero UI aún usa legacy
- Migración parcial a Student SOT v1

### Prioridades para Reconstrucción
1. **ALTA:** Migrar estado de alumnos a `student_item_state` (eliminar legacy)
2. **ALTA:** Migrar UI a dominio MASTER
3. **MEDIA:** Eliminar endpoints legacy
4. **MEDIA:** Limpiar campos legacy (`activo`)
5. **BAJA:** Verificar y eliminar `items_transmutaciones_alumnos` si no se usa

### Principios a Respetar
- PostgreSQL como Source of Truth único
- Separación catálogo vs estado
- Soft delete siempre (nunca DELETE físico)
- Contratos explícitos
- Integración limpia con Student SOT v1
- UI MASTER canónica (registry, theme, DOM API)

---

**FIN DEL DIAGNÓSTICO**
