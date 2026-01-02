# 🔍 MASTER ALQUIMIA GENERAL - ESTADO AS-IS
## Verificación Real de Tablas, Endpoints y Compatibilidad

**Fecha:** 2025-01-XX  
**Objetivo:** Documentar el estado real del sistema antes de implementar Alquimia General en MASTER

---

## 1. TABLAS REALES EN POSTGRESQL

### 1.1. Catálogo PDE

#### `listas_transmutaciones`
**Esquema actual (según `database/pg.js` y migración v5.34.0):**
```sql
CREATE TABLE listas_transmutaciones (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  tipo VARCHAR(20) NOT NULL DEFAULT 'recurrente',
  descripcion TEXT,
  activo BOOLEAN DEFAULT TRUE,  -- LEGACY (deprecado)
  orden INTEGER DEFAULT 0,
  category_key TEXT,  -- nullable
  subtype_key TEXT,  -- nullable
  tags JSONB,  -- nullable
  status VARCHAR(20) DEFAULT 'active',  -- CANÓNICO (v5.34.0)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT check_tipo_lista CHECK (tipo IN ('recurrente', 'una_vez'))
);
```

**Índices:**
- `idx_listas_transmutaciones_tipo`
- `idx_listas_transmutaciones_activo` (LEGACY)
- `idx_listas_transmutaciones_orden`
- `idx_listas_transmutaciones_status` (WHERE status='active')

**Campos problemáticos:**
- `activo` (BOOLEAN) vs `status` (VARCHAR) - duplicación
- Falta `deleted_at` (soft delete canónico)
- Falta `item_ref` (no aplica a listas, solo items)

#### `items_transmutaciones`
**Esquema actual:**
```sql
CREATE TABLE items_transmutaciones (
  id SERIAL PRIMARY KEY,
  lista_id INTEGER NOT NULL REFERENCES listas_transmutaciones(id) ON DELETE CASCADE,
  nombre VARCHAR(255) NOT NULL,
  descripcion TEXT,
  nivel INTEGER NOT NULL DEFAULT 9,
  frecuencia_dias INTEGER,  -- nullable, solo recurrente
  veces_limpiar INTEGER,  -- nullable, solo una_vez
  prioridad VARCHAR(10) DEFAULT 'media' CHECK (prioridad IN ('alta', 'media', 'bajo')),
  orden INTEGER DEFAULT 0,
  activo BOOLEAN DEFAULT TRUE,  -- LEGACY (deprecado)
  status VARCHAR(20) DEFAULT 'active',  -- CANÓNICO (v5.34.0)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Índices:**
- `idx_items_transmutaciones_lista`
- `idx_items_transmutaciones_nivel`
- `idx_items_transmutaciones_activo` (LEGACY)
- `idx_items_transmutaciones_orden`
- `idx_items_transmutaciones_prioridad`
- `idx_items_transmutaciones_status` (WHERE status='active')

**Campos problemáticos:**
- `activo` (BOOLEAN) vs `status` (VARCHAR) - duplicación
- Falta `deleted_at` (soft delete canónico)
- **FALTA `item_ref` TEXT UNIQUE** - necesario para Student SOT v1

### 1.2. Estado Alumno (Student SOT)

#### `student_item_state`
**Esquema actual (según migraciones v5.42.0 y v5.45.0):**
```sql
CREATE TABLE student_item_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
  
  -- Campos legacy (v5.42.0)
  domain_key TEXT NOT NULL,  -- 'transmutaciones_energeticas', etc.
  item_id INTEGER NOT NULL,  -- ID del ítem en el catálogo
  
  -- Campos nuevos (v5.45.0)
  product_key TEXT DEFAULT 'pde',
  domain_type TEXT,  -- alias de domain_key
  item_ref_type TEXT DEFAULT 'catalog_id',
  item_ref TEXT,  -- alias de item_id (flexible)
  
  -- Estados (v5.42.0)
  is_active BOOLEAN NOT NULL DEFAULT FALSE,  -- LEGACY
  is_clean BOOLEAN NOT NULL DEFAULT FALSE,  -- LEGACY
  clean_count INTEGER NOT NULL DEFAULT 0,
  last_cleaned_at TIMESTAMPTZ,
  recommended_recurrence_days INTEGER,
  student_recurrence_days INTEGER,
  meta JSONB DEFAULT '{}'::jsonb,  -- LEGACY
  
  -- Estados nuevos (v5.45.0)
  active_state TEXT DEFAULT 'inactive',  -- reemplazo de is_active
  clean_state TEXT DEFAULT 'unclean',  -- reemplazo de is_clean
  counters JSONB DEFAULT '{}'::jsonb,  -- extensible
  per_item_config JSONB DEFAULT '{}'::jsonb,  -- para proyectos
  
  -- Auditoría
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Constraint único (v5.45.0)
  UNIQUE(student_id, product_key, domain_type, item_ref)
);
```

**Índices:**
- `idx_student_item_state_student_id`
- `idx_student_item_state_domain_key` (LEGACY)
- `idx_student_item_state_item_id` (LEGACY)
- `idx_student_item_state_student_domain`
- `idx_student_item_state_active` (WHERE is_active=TRUE) (LEGACY)
- `idx_student_item_state_clean` (WHERE is_clean=FALSE) (LEGACY)
- `idx_student_item_state_domain_active` (WHERE active_state='active') (v5.45.0)
- `idx_student_item_state_domain_clean` (WHERE clean_state='unclean') (v5.45.0)
- `idx_student_item_state_per_item_config_gin` (GIN) (v5.45.0)
- `idx_student_item_state_item_ref` (v5.45.0)

**Campos para transmutaciones:**
- ✅ `last_cleaned_at` - existe
- ✅ `clean_count` - existe
- ✅ `recommended_recurrence_days` - existe
- ✅ `student_recurrence_days` - existe
- ✅ `per_item_config` - existe (JSONB, puede almacenar `recurrence_days` por item)
- ❌ **FALTA `remaining` INTEGER** - necesario para tipo `una_vez`
- ❌ **FALTA `completed` INTEGER** - necesario para tipo `una_vez`
- ✅ `is_complete` puede derivarse de `remaining <= 0` (no necesita campo)

**Conclusión:** `student_item_state` tiene campos suficientes para `recurrente` pero **FALTA `remaining` y `completed` para `una_vez`**.

### 1.3. Tablas Legacy (a migrar/eliminar)

#### `student_te_recurrent_state`
**Estado:** Existe, activa, pero debe migrarse a `student_item_state`
**Esquema:**
```sql
CREATE TABLE student_te_recurrent_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_email TEXT NOT NULL,  -- FK implícita (problema)
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

#### `student_te_one_time_state`
**Estado:** Existe, activa, pero debe migrarse a `student_item_state`
**Esquema:**
```sql
CREATE TABLE student_te_one_time_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_email TEXT NOT NULL,  -- FK implícita (problema)
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

#### `items_transmutaciones_alumnos`
**Estado:** Existe, pero posiblemente no se usa (verificar)
**Esquema:**
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

---

## 2. AUTH MASTER

### 2.1. Función de Auth Actual

**NO existe `requireMasterContext()`**

**Funciones disponibles:**
- `requireAdminContext(request, env)` - en `src/core/auth-context.js`
- `requireStudentContext(request, env)` - en `src/core/auth-context.js`

**Conclusión:** MASTER probablemente usa `requireAdminContext()` (mismo sistema de sesión que Admin).

**Verificación:** Revisar handlers MASTER existentes para confirmar patrón.

### 2.2. Patrón de Auth en MASTER

Según `master-router-resolver.js`, los handlers MASTER se resuelven pero **no se verifica auth en el resolver**.

**Decisión:** Implementar `requireMasterContext()` que sea alias de `requireAdminContext()` o crear guard específico si es necesario.

**Recomendación:** Usar `requireAdminContext()` directamente (mismo sistema de sesión).

---

## 3. ENDPOINTS EXISTENTES RELEVANTES

### 3.1. Endpoints Admin (Legacy)

**Ruta base:** `/admin/pde/transmutaciones-energeticas`

**Endpoints:**
- `GET /admin/pde/transmutaciones-energeticas` - HTML
- `GET /admin/pde/transmutaciones-energeticas/api/listas?tipo=...` - JSON
- `POST /admin/pde/transmutaciones-energeticas` - Crear lista
- `GET /admin/pde/transmutaciones-energeticas/:id` - Obtener lista
- `PUT /admin/pde/transmutaciones-energeticas/:id` - Actualizar lista
- `DELETE /admin/pde/transmutaciones-energeticas/:id` - Archivar lista
- `GET /admin/pde/transmutaciones-energeticas/api/listas/:id/items` - Listar items
- `POST /admin/pde/transmutaciones-energeticas/api/items` - Crear item
- `PUT /admin/pde/transmutaciones-energeticas/api/items/:id` - Actualizar item
- `DELETE /admin/pde/transmutaciones-energeticas/api/items/:id` - **DELETE físico** (problema)
- `GET /admin/pde/transmutaciones-energeticas/api/items/:id/master/students-recurrent` - Estado alumnos (recurrente)
- `POST /admin/pde/transmutaciones-energeticas/api/items/:id/master/mark-clean-all` - Limpiar todos (recurrente)
- `POST /admin/pde/transmutaciones-energeticas/api/items/:id/master/mark-clean-student` - Limpiar alumno (recurrente)
- `GET /admin/pde/transmutaciones-energeticas/api/items/:id/master/students-one-time` - Estado alumnos (una_vez)
- `POST /admin/pde/transmutaciones-energeticas/api/items/:id/master/increment-all` - Incrementar todos (una_vez)
- `POST /admin/pde/transmutaciones-energeticas/api/items/:id/master/adjust-remaining` - Ajustar remaining (una_vez)

### 3.2. Endpoints Canónicos (Student SOT v1)

**Ruta base:** `/admin/api/transmutations/*` y `/admin/api/students/:id/domains/transmutation/*`

**Endpoints:**
- `GET /admin/api/transmutations/:item_ref/students?product_key=pde` - Lista alumnos con estado
- `GET /admin/api/students/:id/domains/transmutation?product_key=pde` - Lista transmutaciones de alumno
- `POST /admin/api/students/:id/domains/transmutation/items/:item_ref/clean?product_key=pde` - Limpiar transmutación

### 3.3. Endpoints MASTER (Nuevos - a crear)

**Ruta base:** `/master/api/alquimia-general/*`

**Endpoints a crear:**
- `GET /master/api/alquimia-general/listas?tipo=recurrente|una_vez`
- `POST /master/api/alquimia-general/listas`
- `GET /master/api/alquimia-general/listas/:id`
- `PUT /master/api/alquimia-general/listas/:id`
- `DELETE /master/api/alquimia-general/listas/:id` (soft)
- `GET /master/api/alquimia-general/listas/:id/items`
- `POST /master/api/alquimia-general/items`
- `GET /master/api/alquimia-general/items/:id`
- `PUT /master/api/alquimia-general/items/:id`
- `DELETE /master/api/alquimia-general/items/:id` (soft)
- `GET /master/api/alquimia-general/items/:item_ref/students` (modal)
- `POST /master/api/alquimia-general/items/:item_ref/master/mark-clean-all` (recurrente)
- `POST /master/api/alquimia-general/items/:item_ref/master/mark-clean-student` (recurrente)
- `POST /master/api/alquimia-general/items/:item_ref/master/increment-all` (una_vez)
- `POST /master/api/alquimia-general/items/:item_ref/master/adjust-remaining` (una_vez)

---

## 4. HANDLER MASTER EXISTENTE

### 4.1. Handler Mapeado

**En `master-router-resolver.js` línea 49:**
```javascript
'master-templo-luz-alquimia-general': () => import('../../../endpoints/master-templo-luz-alquimia-general.js'),
```

**Verificación:** Buscar si existe el archivo.

**Conclusión:** Si existe, revisar su contenido. Si no existe, crearlo.

---

## 5. CONCLUSIONES DE COMPATIBILIDAD

### 5.1. Tablas

**✅ Compatible:**
- `listas_transmutaciones` - estructura correcta, solo falta `deleted_at` y limpiar `activo`
- `items_transmutaciones` - estructura correcta, falta `item_ref` y `deleted_at`
- `student_item_state` - estructura correcta para `recurrente`, falta `remaining` y `completed` para `una_vez`

**❌ Incompatible:**
- `student_te_recurrent_state` - debe migrarse
- `student_te_one_time_state` - debe migrarse
- `items_transmutaciones_alumnos` - verificar si se usa, eliminar si no

### 5.2. Auth

**✅ Compatible:**
- Usar `requireAdminContext()` directamente (mismo sistema de sesión)

**❌ No existe:**
- `requireMasterContext()` - no necesario, usar `requireAdminContext()`

### 5.3. Endpoints

**✅ Compatible:**
- Endpoints canónicos existen (`/admin/api/transmutations/*`)
- Pueden reutilizarse o crear nuevos en `/master/api/alquimia-general/*`

**❌ Problemas:**
- Endpoints legacy usan DELETE físico (prohibido)
- Endpoints legacy usan `item_id` en lugar de `item_ref`

### 5.4. Migraciones Necesarias

**OBLIGATORIAS:**
1. Añadir `item_ref TEXT UNIQUE` a `items_transmutaciones`
2. Backfill `item_ref` para items existentes
3. Añadir `remaining INTEGER` y `completed INTEGER` a `student_item_state` (para `una_vez`)
4. Añadir `deleted_at TIMESTAMPTZ NULL` a `listas_transmutaciones` e `items_transmutaciones` (opcional, puede usar `status='archived'`)

**OPCIONALES:**
5. Migrar datos de `student_te_recurrent_state` y `student_te_one_time_state` a `student_item_state`
6. Deprecar campos `activo` (no eliminar aún)

---

## 6. DECISIONES TOMADAS

### 6.1. Soft Delete

**Decisión:** Usar `status='archived'` (ya existe) en lugar de `deleted_at` para mantener compatibilidad.

**Razón:** `status` ya está implementado y funciona. `deleted_at` sería más canónico pero requiere más cambios.

### 6.2. Auth MASTER

**Decisión:** Usar `requireAdminContext()` directamente.

**Razón:** Mismo sistema de sesión, no necesita función separada.

### 6.3. Campos `remaining` y `completed`

**Decisión:** Añadir a `student_item_state` en migración.

**Razón:** Necesarios para tipo `una_vez`, no pueden derivarse de otros campos.

### 6.4. `item_ref`

**Decisión:** Añadir a `items_transmutaciones` y hacer backfill.

**Razón:** Necesario para Student SOT v1 (usa `item_ref` en lugar de `item_id`).

---

## 7. PLAN DE ACCIÓN

### FASE 1: Migraciones SQL
1. Crear migración `vX.Y.Z-master-alquimia-general.sql`
2. Añadir `item_ref` a `items_transmutaciones`
3. Backfill `item_ref`
4. Añadir `remaining` y `completed` a `student_item_state`
5. Añadir índices necesarios
6. Aplicar migración

### FASE 2: Repositorios
1. Crear repos catálogo
2. Crear repos estado alumno
3. Temporal state resolver

### FASE 3: Endpoints
1. Crear endpoints MASTER
2. Integrar con Student SOT v1

### FASE 4: UI
1. Crear handler MASTER
2. Crear UI con DOM API
3. Integrar con sidebar MASTER

---

**FIN DEL DOCUMENTO AS-IS**
