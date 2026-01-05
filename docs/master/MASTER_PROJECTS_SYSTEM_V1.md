# 📜 Sistema de Proyectos Canónico v1 - AuriPortal MASTER

**Fecha**: 2026-01-05  
**Dominio**: MASTER (master.pdeeugenihidalgo.org)  
**Estado**: ✅ CERRADO Y FUNCIONAL

---

## 📋 Resumen Ejecutivo

El Sistema de Proyectos es una columna vertebral canónica para gestionar proyectos asociados a alumnos. Permite:

- **Gestión de proyectos activos** con seguimiento de salud y limpieza
- **Configuración por alumno** con límites de activación y gestión individual
- **Clasificaciones canónicas** de tipos de proyectos
- **Preparado para UTEs, automatizaciones y paquetes**

---

## 🗄️ Modelo de Datos

### Tablas Principales

#### 1. `project_categories` - Clasificaciones de Proyectos

**Propósito**: Catálogo canónico de tipos de proyectos (proyecto principal, proyecto de sanación, etc.)

**Campos**:
- `id` (PK)
- `category_key` (string único) - Clave canónica
- `name` (string) - Nombre legible
- `default_recurrence_days` (int) - Días de recurrencia por defecto para limpieza
- `sort_order` (int) - Orden de visualización
- `is_active` (boolean) - Activa/inactiva
- `created_at`, `updated_at`, `deleted_at` (soft delete)

**Reglas**:
- No se puede borrar una categoría si hay proyectos que la usan
- Se pueden desactivar
- El orden es gobernado por `sort_order`

**Categorías por defecto**:
- `proyecto_principal` - Proyecto principal (30 días)
- `proyecto_secundario` - Proyecto secundario (45 días)
- `proyecto_familiar` - Proyecto familiar (60 días)
- `proyecto_trabajo` - Proyecto de trabajo (30 días)
- `proyecto_sanacion` - Proyecto de sanación (30 días)
- `otro` - Otro (30 días)

#### 2. `projects_catalog` - Catálogo de Proyectos

**Propósito**: Catálogo global de proyectos (sin personalización por alumno)

**Campos**:
- `id` (PK)
- `project_key` (string único) - Clave canónica
- `category_id` (FK → project_categories) - Clasificación
- `base_name` (string) - Nombre genérico
- `created_at`, `deleted_at` (soft delete)

**Nota**: El catálogo NO contiene nombre personalizado ni descripción (eso va en `student_project_state`)

#### 3. `student_project_state` - Estado Alumno-Proyecto

**Propósito**: Estado específico de un proyecto para un alumno (activación, limpieza, personalización)

**Campos**:
- `id` (PK)
- `student_id` (FK → alumnos)
- `project_id` (FK → projects_catalog)
- `is_active` (boolean) - Activo/inactivo
- `is_reviewed` (boolean) - Revisado/limpiado
- `custom_name` (string nullable) - Nombre personalizado
- `description` (string nullable) - Descripción específica
- `recurrence_days` (int) - Días de recurrencia (puede diferir del default de categoría)
- `last_cleaned_at` (timestamp nullable) - Última limpieza
- `created_at`, `updated_at`

**Constraints**:
- `UNIQUE(student_id, project_id)` - Un alumno solo puede tener un estado por proyecto

**Funciones SQL**:
- `calculate_days_since_clean(last_cleaned_at, recurrence_days)` → días desde última limpieza
- `calculate_health_status(days_since_clean, recurrence_days)` → 'green' | 'yellow' | 'red'

**Lógica de salud**:
- `green`: `days <= recurrence`
- `yellow`: `recurrence < days <= recurrence * 2`
- `red`: `days > recurrence * 2`

#### 4. `student_activation_limits` - Límites de Activación

**Propósito**: Límites de activación por dominio (places, projects) y alumno

**Campos**:
- `id` (PK)
- `student_id` (FK → alumnos)
- `domain` (enum: 'places', 'projects')
- `activation_limit` (int nullable) - NULL = infinito
- `source` (enum: 'default', 'master', 'automation')
- `created_at`, `updated_at`

**Reglas canónicas**:
- Si NO existe fila → usar default del sistema:
  - **Master**: Infinity (ilimitado)
  - **Alumnos**: 1 proyecto activo
- NULL = ilimitado (solo para Master)
- El Master no requiere fila explícita (se trata como ilimitado)

---

## 🔧 Servicios Canónicos

### `activateProject(studentId, projectId, actor, options)`

**Responsabilidad**: Activa un proyecto para un alumno, respetando límites

**Lógica**:
1. Verifica existencia del proyecto
2. Verifica alumno y suscripción NO en pausa
3. Obtiene `activation_limit`:
   - Si `actor === 'master'` → Infinity (ignorar límites)
   - Si hay límite explícito en BD → usar ese
   - Si no es Master → default = 1
4. Cuenta activos actuales
5. Si se supera el límite → desactiva automáticamente el proyecto activo MÁS ANTIGUO (por `created_at`)
6. Activa proyecto (crea o actualiza `student_project_state`)
7. Emite señal `project.activated`

**Señal emitida**: `project.activated`

### `deactivateProject(studentId, projectId, actor, options)`

**Responsabilidad**: Desactiva un proyecto

**Lógica**:
1. Marca `is_active = false`
2. NO borra el estado (se mantiene para historial)
3. Emite señal `project.deactivated`

**Señal emitida**: `project.deactivated`

### `cleanProject(studentId, projectId, actor, options)`

**Responsabilidad**: Marca un proyecto como limpiado

**Lógica**:
1. Marca `is_reviewed = true`
2. Actualiza `last_cleaned_at = now()`
3. Mantiene `is_active = true` (no desactiva)
4. Emite señal `project.cleaned`

**Señal emitida**: `project.cleaned`

### `cleanSelectedProjects(projectStateIds[], actor, options)`

**Responsabilidad**: Limpieza masiva de proyectos seleccionados

**Lógica**:
1. Limpia todos los `project_state_ids` proporcionados
2. Emite señal `project.cleaned.bulk`

**Señal emitida**: `project.cleaned.bulk`

### `cleanAllActiveProjects(actor, options)`

**Responsabilidad**: Limpieza de TODOS los proyectos activos

**Lógica**:
1. Limpia todos los proyectos activos del sistema
2. Emite señal `project.cleaned.all`

**Señal emitida**: `project.cleaned.all`

### `handleSubscriptionPauseProjects(studentId, options)`

**Responsabilidad**: Desactiva todos los proyectos cuando se pausa la suscripción

**Lógica**:
1. Desactiva TODOS los proyectos activos del alumno
2. NO toca `is_reviewed` ni fechas
3. Emite señal `project.deactivated.all`

**Señal emitida**: `project.deactivated.all`

### `updateActivationLimit(studentId, domain='projects', value, source, options)`

**Responsabilidad**: Actualiza el límite de activación de un alumno

**Lógica**:
1. Crea o actualiza fila en `student_activation_limits`
2. `value` puede ser número (1-5) o `null` (infinito)
3. Normaliza inputs: "∞", "", "infinity" => null; num string => parseInt; número => valida >=1
4. `source` debe ser 'default', 'master' o 'automation'
5. Emite señal `project.activation_limit.updated`

**Señal emitida**: `project.activation_limit.updated`

### `createProjectForStudent(studentId, categoryId, name, description, actor, options)`

**Responsabilidad**: Crea un proyecto nuevo en catálogo y lo activa para el alumno

**Lógica**:
1. Verifica alumno y categoría activa
2. Genera `project_key` único (slug de nombre + timestamp)
3. Crea entrada en `projects_catalog`
4. Crea `student_project_state` activo (si `actor === 'master'`, sin límites)
5. Emite señal `project.activated`

**Señal emitida**: `project.activated`

---

## 📡 Señales Registradas

Todas las señales están registradas en `src/core/student/signals/student-signal-registry.js`:

### Señales de Proyectos

- `project.activated` - Proyecto activado
- `project.deactivated` - Proyecto desactivado
- `project.cleaned` - Proyecto limpiado
- `project.cleaned.bulk` - Limpieza masiva seleccionada
- `project.cleaned.all` - Limpieza de todos los activos
- `project.deactivated.all` - Desactivación masiva (pausa)

### Señales de Categorías

- `project.category.created` - Categoría creada
- `project.category.updated` - Categoría actualizada
- `project.category.reordered` - Categorías reordenadas
- `project.category.deactivated` - Categoría desactivada

### Señales de Límites

- `project.activation_limit.updated` - Límite de activación actualizado

**Regla**: Las señales SOLO se emiten desde servicios, NUNCA desde UI.

---

## 🌐 Endpoints API MASTER

### Proyectos

#### `GET /master/api/projects/active`
Lista todos los proyectos activos con salud y días desde limpieza.

**Respuesta**:
```json
{
  "ok": true,
  "projects": [
    {
      "id": 1,
      "student_id": 123,
      "student_email": "alumno@example.com",
      "student_apodo": "Alumno",
      "project_id": 456,
      "project_key": "proyecto_123",
      "base_name": "Proyecto Principal",
      "custom_name": "Mi proyecto",
      "category_name": "Proyecto Principal",
      "is_active": true,
      "is_reviewed": true,
      "last_cleaned_at": "2026-01-01T10:00:00Z",
      "recurrence_days": 30,
      "days_since_clean": 2,
      "health_status": "green"
    }
  ],
  "trace_id": "..."
}
```

**Headers anti-cache**: `Cache-Control: no-store, no-cache, must-revalidate, max-age=0`

**Orden canónico**:
1. Salud (rojo → amarillo → verde)
2. Categoría (según `sort_order`)
3. Última limpieza (más antigua primero)

#### `POST /master/api/projects/clean`
Limpia un proyecto específico.

**Body**:
```json
{
  "student_id": 123,
  "project_id": 456
}
```

#### `POST /master/api/projects/clean-bulk`
Limpieza masiva de proyectos seleccionados.

**Body**:
```json
{
  "project_state_ids": [1, 2, 3]
}
```

#### `POST /master/api/projects/clean-all`
Limpia TODOS los proyectos activos.

#### `GET /master/api/projects/student/:student_id`
Obtiene proyectos de un alumno específico.

**Respuesta**:
```json
{
  "ok": true,
  "projects": [...],
  "active_projects": [...],
  "activation_limit": 1,
  "limit_source": "default"
}
```

**Headers anti-cache**: `Cache-Control: no-store, no-cache, must-revalidate, max-age=0`

#### `POST /master/api/projects/activate`
Activa un proyecto (respeta límites).

**Body**:
```json
{
  "student_id": 123,
  "project_id": 456
}
```

#### `POST /master/api/projects/deactivate`
Desactiva un proyecto.

**Body**:
```json
{
  "student_id": 123,
  "project_id": 456
}
```

#### `PATCH /master/api/projects/state/:id`
Actualiza estado de proyecto (nombre, descripción, recurrencia).

**Body**:
```json
{
  "custom_name": "Nuevo nombre",
  "description": "Nueva descripción",
  "recurrence_days": 45
}
```

#### `POST /master/api/projects/limit`
Actualiza límite de activación.

**Body**:
```json
{
  "student_id": 123,
  "domain": "projects",
  "activation_limit": 2,
  "source": "master"
}
```

**Nota**: `activation_limit` puede ser número (1-5) o `null` (infinito). Se normaliza: "∞", "", "infinity" => null.

#### `POST /master/api/projects/create-for-student`
Crea un proyecto nuevo en catálogo y lo activa para el alumno.

**Body**:
```json
{
  "student_id": 123,
  "category_id": 1,
  "name": "Mi Proyecto",
  "description": "Descripción del proyecto"
}
```

### Catálogo de Proyectos

#### `GET /master/api/projects-catalog`
Lista proyectos del catálogo.

#### `POST /master/api/projects-catalog`
Crea nuevo proyecto en catálogo.

**Body**:
```json
{
  "project_key": "proyecto_123",
  "category_id": 1,
  "base_name": "Proyecto"
}
```

#### `GET /master/api/projects-catalog/:id`
Obtiene un proyecto del catálogo.

#### `PATCH /master/api/projects-catalog/:id`
Actualiza un proyecto del catálogo.

#### `DELETE /master/api/projects-catalog/:id`
Borra un proyecto del catálogo (soft delete, solo si no está en uso).

### Categorías

#### `GET /master/api/project-categories`
Lista categorías.

#### `POST /master/api/project-categories`
Crea nueva categoría.

**Body**:
```json
{
  "category_key": "nueva_categoria",
  "name": "Nueva Categoría",
  "default_recurrence_days": 30,
  "sort_order": 10
}
```

#### `GET /master/api/project-categories/:id`
Obtiene una categoría.

#### `PATCH /master/api/project-categories/:id`
Actualiza una categoría.

#### `DELETE /master/api/project-categories/:id`
Borra una categoría (soft delete, solo si no está en uso).

#### `POST /master/api/project-categories/reorder`
Reordena categorías.

**Body**:
```json
{
  "category_ids": [1, 2, 3, 4]
}
```

---

## 🖥️ UI MASTER

### Ruta
`/master/templo-luz/proyectos`

### Tabs

#### TAB 1: Proyectos Activos

**Propósito**: Vista global para el Master (limpiezas)

**Funcionalidades**:
- Lista global de proyectos activos
- **Ordenación jerárquica por prioridades** (máximo 3 criterios)
- Campos visibles:
  - Checkbox selección
  - Apodo (clickable → Tab 2, sorteable)
  - Email (clickable → Tab 2, sorteable)
  - Categoría (sorteable)
  - Nombre (editable inline, sorteable)
  - Descripción (editable inline)
  - Salud (verde/amarillo/rojo, sorteable)
  - Días desde limpieza (sorteable)
  - Última limpieza (sorteable, formateada o "Nunca")
  - Recurrencia (editable, solo Master)
  - Botón LIMPIAR
- Botones:
  - "Limpiar Seleccionados"
  - "Limpiar Todos"

**Ordenación jerárquica**:
- **Columnas sorteables**: `health_status`, `category_name`, `last_cleaned_at`, `days_since_clean`, `name`, `student_apodo`, `student_email`
- **Click en header**: 
  - Si ya es prioridad 1: toggle asc/desc
  - Si existe en lista: mover a prioridad 1 manteniendo dirección
  - Si es nueva: insertarla como prioridad 1 (push down las demás)
- **Indicadores visuales**: `1↑`, `2↓`, `3↑` (prioridad + dirección)
- **Orden por defecto**: Salud (asc) → Categoría (asc) → Última limpieza (desc)
- **Persistencia**: `localStorage` key `ap_master_projects_orderBy_v1`

**Contrato**: La UI NO calcula salud ni días. Todo viene del backend. La ordenación es frontend (preparada para backend futuro).

#### TAB 2: Configuración por Alumno

**Propósito**: Gestión individual de proyectos por alumno

**Funcionalidades**:
- Selector de alumno con buscador (usa `/master/api/students` con anti-cache)
- Límite de activación para `domain='projects'`:
  - Selector 1-5 y ∞
  - Manejo correcto de `null` como ∞ (NO convertir a 1 en GET)
  - Tras guardar, actualizar state local y refetch
- **Lista completa de proyectos del alumno** (información detallada):
  - **Nombre** (editable inline)
  - **Descripción** (textarea editable)
  - **Tipo/Categoría** (read-only)
  - **Estado de salud** (badge verde/amarillo/rojo)
  - **Última limpieza** (fecha formateada o "Nunca")
  - **Días desde limpieza** (número de días)
  - **Estado activo/inactivo** (badge visual)
  - **Botón LIMPIAR** (verde, solo si está activo)
  - **Botón Activar / Desactivar** (según estado)
  - **Botón Borrar** (del catálogo, solo si no está en uso)
- **Crear nuevo proyecto**:
  - Formulario inline con:
    - Nombre (requerido)
    - Descripción (opcional)
    - Tipo/Categoría (select desde `/master/api/project-categories` activos, requerido)
  - Botón "Crear y Activar" (verde)
  - Botón "Limpiar" (reset form)
  - Backend: `POST /master/api/projects/create-for-student`

**Botón LIMPIAR individual**:
- **Funcionalidad**: Llama a `/master/api/projects/clean`
- **Efecto**: Marca como revisado, actualiza fecha, NO cambia activación
- **Refresco**: UI se actualiza inmediatamente tras éxito (refetch completo)
- **Fall-open**: Si hay error, muestra mensaje pequeño sin spam de consola

**Mensaje cuando no hay proyectos**: "Este alumno no tiene proyectos configurados"

#### TAB 3: Clasificaciones

**Propósito**: CRUD de categorías de proyectos

**Funcionalidades**:
- Lista de categorías existentes
- Crear nueva categoría:
  - Nombre
  - Clave (opcional, auto-generada)
  - Recurrencia por defecto
  - Orden
- Editar categoría (inline):
  - Nombre
  - Recurrencia
  - Orden
  - Activar/Desactivar
- Reordenar categorías (preparado)

**Regla**: No se puede borrar una categoría si está en uso.

---

## 🔒 Reglas Canónicas

### Límites de Activación

1. **Default explícito**:
   - Master: Infinity (ilimitado) si `actor === 'master'`
   - Alumnos: 1 proyecto activo

2. **Lógica de límite efectivo**:
   ```javascript
   effectiveLimit = actor === 'master' 
     ? Infinity
     : (limit?.activation_limit !== undefined 
         ? limit.activation_limit 
         : 1)
   ```

3. **Auto-desactivación**:
   - Si se supera el límite → desactiva el proyecto activo MÁS ANTIGUO (por `created_at` del state)
   - Se emite señal `project.deactivated` con `reason: 'activation_limit_reached'`

4. **Normalización de límites**:
   - "∞", "", "infinity" => `null` (infinito)
   - num string => `parseInt`
   - número => valida >=1
   - `null` en BD = infinito (NO convertir a 1 en GET)

### Salud y Limpieza

1. **Cálculo backend**:
   - `days_since_clean` → función SQL `calculate_days_since_clean()`
   - `health_status` → función SQL `calculate_health_status()`
   - La UI NO calcula, solo muestra

2. **Limpieza**:
   - Marca `is_reviewed = true`
   - Actualiza `last_cleaned_at = now()`
   - NO desactiva el proyecto

3. **Recurrencia**:
   - Por defecto: `default_recurrence_days` de la categoría
   - Personalizable: `recurrence_days` en `student_project_state`
   - Solo Master puede editar recurrencia en Tab 1

### Suscripción Pausada

1. **Al pausar**:
   - `handleSubscriptionPauseProjects()` desactiva TODOS los proyectos activos
   - NO toca `is_reviewed` ni fechas
   - Emite `project.deactivated.all`

2. **Al reactivar**:
   - Los proyectos NO se reactivan automáticamente
   - El alumno debe reactivarlos manualmente

---

## 🧪 Casos Límite

### Overflow de Límite

**Escenario**: Alumno con límite 1 intenta activar segundo proyecto

**Comportamiento**:
1. Se cuenta activos actuales: 1
2. Se verifica límite: 1
3. Se detecta overflow: `activeCount >= limit`
4. Se busca proyecto activo más antiguo (por `created_at`)
5. Se desactiva automáticamente
6. Se emite señal `project.deactivated` con `reason: 'activation_limit_reached'`
7. Se activa el nuevo proyecto
8. Se emite señal `project.activated`

### Master con Infinitos

**Escenario**: Master activa múltiples proyectos

**Comportamiento**:
1. Se detecta que `actor === 'master'`
2. `effectiveLimit = Infinity`
3. NO se verifica límite (`Infinity` no tiene límite)
4. Se activa sin restricciones

### Categoría en Uso

**Escenario**: Intentar borrar categoría que tiene proyectos asociados

**Comportamiento**:
1. Se verifica uso: `SELECT COUNT(*) FROM projects_catalog WHERE category_id = ? AND deleted_at IS NULL`
2. Si `count > 0` → error: "No se puede borrar una categoría que está en uso"
3. Si `count = 0` → soft delete permitido

### Proyecto en Uso

**Escenario**: Intentar borrar proyecto del catálogo que tiene estados asociados

**Comportamiento**:
1. Se verifica uso: `SELECT COUNT(*) FROM student_project_state WHERE project_id = ?`
2. Si `count > 0` → error: "No se puede borrar un proyecto que está en uso"
3. Si `count = 0` → soft delete permitido

---

## ✅ Checklist de Validación

### Backend

- [ ] Tablas creadas en PostgreSQL
- [ ] Funciones SQL (`calculate_days_since_clean`, `calculate_health_status`) reutilizadas
- [ ] Triggers para `updated_at`
- [ ] Repositorios implementados (contrato + PostgreSQL)
- [ ] Servicios canónicos implementados
- [ ] Señales registradas en registry
- [ ] Endpoints API MASTER creados
- [ ] Lógica de límites corregida (1 para alumnos, Infinity para Master)
- [ ] Auto-desactivación cuando se supera límite
- [ ] Rutas registradas en `master-route-registry.js` con `type: 'api'`
- [ ] Rutas mapeadas en `MASTER_HANDLER_MAP`

### UI

- [ ] Tab 1: Proyectos activos funcional
- [ ] Tab 2: Configuración por alumno funcional
  - [ ] Selector de alumno
  - [ ] Crear proyecto
  - [ ] Activar/Desactivar
  - [ ] Borrar proyecto
  - [ ] Actualizar límite (con manejo correcto de null=∞)
- [ ] Tab 3: Clasificaciones funcional
  - [ ] CRUD completo
  - [ ] Reordenar (preparado)
- [ ] DOM API only (sin innerHTML)
- [ ] Todos los botones tienen handlers
- [ ] Mensajes de error/success visibles
- [ ] BUILD_STAMP inequívoco implementado

### Señales

- [ ] `project.activated` emitida
- [ ] `project.deactivated` emitida
- [ ] `project.cleaned` emitida
- [ ] `project.cleaned.bulk` emitida
- [ ] `project.cleaned.all` emitida
- [ ] `project.deactivated.all` emitida
- [ ] `project.category.created` emitida
- [ ] `project.category.updated` emitida
- [ ] `project.category.reordered` emitida
- [ ] `project.category.deactivated` emitida
- [ ] `project.activation_limit.updated` emitida

### Documentación

- [ ] Documentación completa creada
- [ ] Modelo de datos documentado
- [ ] Servicios documentados
- [ ] Endpoints documentados
- [ ] Reglas canónicas documentadas
- [ ] Casos límite documentados

---

## 🚀 Preparado para

### UTEs
- Estructura extensible con señales
- Estados auditables
- Lógica canónica en servicios

### Automatizaciones
- Señales emitidas en todas las acciones
- Payloads consistentes y auditables
- Integración con sistema de señales

### Paquetes
- Modelo canónico de proyectos
- Estados personalizables por alumno
- Clasificaciones gobernables

### Contextos
- Integración futura con contextos
- Estados rastreables por `trace_id`
- Señales con contexto completo

---

## 📝 Notas Técnicas

### Detección de Master

La detección de Master se hace por parámetro `actor`:
- Si `actor === 'master'` → Infinity (ignorar límites)
- NO usar heurística por email/apodo (ya corregido en Lugares)

### Soft Delete

Todas las tablas usan soft delete (`deleted_at`):
- `project_categories`
- `projects_catalog`
- NO `student_project_state` (se mantiene para historial)
- NO `student_activation_limits` (se actualiza, no se borra)

### Orden Canónico

El orden canónico en Tab 1 es:
1. Salud (rojo → amarillo → verde)
2. Categoría (según `sort_order`)
3. Última limpieza (más antigua primero)

Esto se calcula en el backend, no en la UI.

### Order Pipeline

**Estructura interna**:
```javascript
orderBy: [
  { key: 'health_status', direction: 'asc' },      // Prioridad 1
  { key: 'category_name', direction: 'asc' },      // Prioridad 2
  { key: 'last_cleaned_at', direction: 'desc' }    // Prioridad 3
]
```

**Persistencia**: `localStorage` key `ap_master_projects_orderBy_v1`

**Columnas sorteables**: `health_status`, `category_name`, `last_cleaned_at`, `days_since_clean`, `name`, `student_apodo`, `student_email`

---

## 🔄 Migraciones

### v5.33.3-projects-system-v1.sql

**Contenido**:
- Creación de tablas canónicas (`project_categories`, `projects_catalog`, `student_project_state`)
- Funciones SQL (reutilizadas de Lugares si son genéricas)
- Triggers
- Datos iniciales (categorías por defecto)

**Aplicación**:
```bash
node scripts/apply-projects-migration.js
```

---

## 🎯 Estado Final

**El sistema está CERRADO Y FUNCIONAL**:

- ✅ Backend completo y robusto
- ✅ UI completa con 3 tabs funcionales
- ✅ Señales emitidas correctamente
- ✅ Límites corregidos (1 para alumnos, Infinity para Master)
- ✅ Documentación completa
- ✅ Preparado para UTEs, automatizaciones y paquetes

**El sistema es canónico, contractual y extensible.**

---

**Última actualización**: 2026-01-05  
**Referencia**: Sistema espejo de `MASTER_PLACES_SYSTEM_V1.md`
