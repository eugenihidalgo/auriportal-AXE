# STUDENT_DOMAIN_INTEGRATION_V1.md — Integración Canónica de Dominios con Student SOT v1

**Versión**: v1  
**Fecha**: 2025-01-XX

---

## 1. Principio Fundamental

Student SOT v1 integra dominios (Transmutaciones, Proyectos, Lugares, Apadrinados) como overlay del catálogo SOT, respetando la semántica de PAUSA:
- **PAUSED congela progreso de nivel**, pero **permite limpiar siempre**
- **Proyectos** son repositorio personal editable con **1 activo**
- **Master** puede mutar todo, siempre, con auditoría

---

## 2. Modelo de Datos

### 2.1 Tabla `student_item_state`

Overlay del catálogo SOT con campos:

- `student_id`: ID del alumno (INTEGER, FK a `alumnos`)
- `product_key`: Clave del producto (TEXT, default: 'pde')
- `domain_type`: Tipo de dominio (TEXT: 'transmutation', 'project', 'place', 'sponsor')
- `item_ref_type`: Tipo de referencia (TEXT: 'catalog_id', 'uuid', 'custom')
- `item_ref`: Referencia del ítem (TEXT, flexible)
- `active_state`: Estado de activación (TEXT: 'active', 'inactive')
- `clean_state`: Estado de limpieza (TEXT: 'clean', 'unclean')
- `clean_count`: Contador de limpiezas (INTEGER)
- `last_cleaned_at`: Última limpieza (TIMESTAMPTZ)
- `per_item_config`: Configuración específica (JSONB)

**Constraint UNIQUE**: `(student_id, product_key, domain_type, item_ref)`

### 2.2 `per_item_config` para Proyectos

Para proyectos, `per_item_config` soporta:
- `name`: Nombre del proyecto
- `description`: Descripción del proyecto
- `assigned_person_name`: Nombre de persona asignada (solo Master)

---

## 3. Semántica de PAUSA

### 3.1 Reglas Obligatorias

- ✅ **PAUSED permite limpiar**: `can_clean_domain_items = true` siempre (ACTIVE o PAUSED)
- ❌ **PAUSED congela progreso**: `can_progress_level = false` si `operational_state = PAUSED`
- ✅ **PAUSED permite trabajar internamente**: El alumno puede limpiar y trabajar, solo no progresa nivel

### 3.2 Capabilities

- `can_clean_domain_items`: Siempre `true` (incluso en PAUSED)
- `can_progress_level`: Solo `true` si `operational_state = ACTIVE`
- `can_activate_project`: `true` (con enforcement de active_limit = 1)
- `can_edit_project_metadata`: `true` (alumno puede editar name, description)

---

## 4. Proyectos como Repositorio Personal

### 4.1 Características

- El alumno puede crear, editar nombre y descripción libremente
- Puede tener muchos proyectos
- Solo 1 puede estar ACTIVO a la vez (enforcement en servicio)
- Master puede asignar `assigned_person_name`

### 4.2 Operaciones

- `listProjects()`: Lista todos los proyectos del alumno
- `activateProject()`: Activa un proyecto (desactiva otros automáticamente)
- `cleanProject()`: Limpia un proyecto
- `updateProjectMetadata()`: Actualiza name, description (alumno) o assigned_person_name (Master)

---

## 5. Servicio Canónico

**`src/core/student/domains/student-domain-integration-service.js`**

### 5.1 Transmutaciones

- `listTransmutations(studentId, productKey)`: Lista transmutaciones
- `cleanTransmutation(studentId, itemRef, actorType, actorId, productKey)`: Limpia transmutación

### 5.2 Proyectos

- `listProjects(studentId, productKey)`: Lista proyectos
- `activateProject(studentId, projectRef, actorType, actorId, productKey)`: Activa proyecto (enforce: 1 activo)
- `cleanProject(studentId, projectRef, actorType, actorId, productKey)`: Limpia proyecto
- `updateProjectMetadata(studentId, projectRef, metadata, actorType, actorId, productKey)`: Actualiza metadatos

### 5.3 Reglas del Servicio

- Alumno solo muta sus proyectos
- Master puede mutar cualquiera (bypass capabilities)
- Cada mutación → auditoría + señal
- Transacciones atómicas

---

## 6. Endpoints

### 6.1 Alumno (`/api/me/domains/*`)

- `GET /api/me/domains/transmutation`: Lista transmutaciones
- `POST /api/me/domains/transmutation/items/:item_ref/clean`: Limpia transmutación
- `GET /api/me/domains/projects`: Lista proyectos
- `POST /api/me/domains/projects/items/:item_ref/activate`: Activa proyecto
- `POST /api/me/domains/projects/items/:item_ref/clean`: Limpia proyecto
- `PATCH /api/me/domains/projects/items/:item_ref`: Actualiza metadatos (name, description)

### 6.2 Admin (`/admin/api/students/:id/domains/*`)

- `GET /admin/api/students/:id/domains/transmutation`: Lista transmutaciones (Master)
- `POST /admin/api/students/:id/domains/transmutation/items/:item_ref/clean`: Limpia transmutación (Master)
- `GET /admin/api/students/:id/domains/projects`: Lista proyectos (Master)
- `POST /admin/api/students/:id/domains/projects/items/:item_ref/activate`: Activa proyecto (Master)
- `POST /admin/api/students/:id/domains/projects/items/:item_ref/clean`: Limpia proyecto (Master)
- `PATCH /admin/api/students/:id/domains/projects/items/:item_ref`: Actualiza metadatos (Master, incluye assigned_person_name)

### 6.3 Características Comunes

- Todas las respuestas son JSON
- Todas incluyen `trace_id`
- Verificación de capabilities (excepto Master que bypass)
- Auditoría automática
- Emisión de señales

---

## 7. Señales Emitidas

- `student.domain.item.cleaned`: Al limpiar ítem
- `student.domain.item.activated`: Al activar ítem
- `student.domain.item.deactivated`: Al desactivar ítem (implícito en activateProject)
- `student.domain.item.metadata_updated`: Al actualizar metadatos
- `student.project.active_changed`: Al cambiar proyecto activo

---

## 8. Mapping Catálogo → item_ref

### 8.1 Transmutaciones

- `item_ref_type`: 'catalog_id'
- `item_ref`: ID del catálogo de transmutaciones (TEXT)

### 8.2 Proyectos

- `item_ref_type`: 'custom'
- `item_ref`: UUID o ID personalizado generado por el sistema

---

## 9. Permisos Alumno vs Master

### 9.1 Alumno

- Puede limpiar sus transmutaciones (siempre, incluso PAUSED)
- Puede activar/limpiar sus proyectos
- Puede editar name/description de sus proyectos
- NO puede editar assigned_person_name

### 9.2 Master

- Puede mutar cualquier alumno (bypass capabilities)
- Puede editar assigned_person_name
- Todas las acciones se registran con `actor_type = 'master'`

---

## 10. Backfill

**`scripts/backfill-student-domain-items-v1.js`**

- Inicializa `student_item_state` desde catálogos
- No marca activos por defecto
- Idempotente
- Soporta `--dry-run` y `--apply`
- Soporta `--limit` y `--student_id`

---

## 11. Tests Críticos

- ✅ Alumno PAUSED puede limpiar
- ✅ Alumno PAUSED NO incrementa nivel
- ✅ Alumno puede editar nombre/desc de proyecto
- ✅ Solo 1 proyecto activo (enforcement)
- ✅ Master puede mutar cualquier alumno

---

## 12. Estados Temporales (Limpio / Pendiente / Crítico)

### 12.1 Función Canónica

**`src/core/student/domains/resolve-temporal-state.js`**

Función única y canónica para resolver el estado temporal de ítems de dominio:

```javascript
resolveTemporalState({
  last_cleaned_at: Date | string | null,
  recurrence_days: number | null,
  now?: Date
}) => 'clean' | 'pending' | 'critical'
```

**Regla Obligatoria**:
- `D` = días desde `last_cleaned_at`
- `R` = `recurrence_days`
- `D ≤ R` → `'clean'`
- `R < D ≤ 2R` → `'pending'`
- `D > 2R` → `'critical'`

**Helper adicional**: `formatDaysAgo(lastCleanedAt)` formatea "Hace X días" de forma humana ("Hoy", "Hace 3 días", etc.).

### 12.2 Uso en UIs

- **Transmutaciones**: Modal flotante muestra alumnos agrupados por estado temporal (limpio/pendiente/crítico).
- **Proyectos**: Tabla muestra columna "Hace X días" y badge de estado temporal.

---

## 13. Vista Master por Ítem (Transmutaciones)

### 13.1 Endpoint Agregado

**`GET /admin/api/transmutations/:item_ref/students`**

Lista todos los alumnos con su estado respecto a un ítem de transmutación específico.

**Respuesta**:
```json
{
  "ok": true,
  "item_ref": "fuerza_espiritual",
  "recurrence_days": 20,
  "students": [
    {
      "student_id": 123,
      "student_name": "Ana",
      "days_since_last_clean": 7,
      "temporal_state": "clean"
    }
  ]
}
```

### 13.2 Integración con UI

El modal flotante de transmutaciones se conecta a este endpoint y muestra:
- Alumnos agrupados por estado temporal
- Botones para marcar como limpio (individual)
- Iconos/colores según estado

---

## 14. Edición de Proyectos desde Lista

### 14.1 Columnas Añadidas

- **"Hace X días"**: Derivado de `last_cleaned_at` usando `formatDaysAgo()`.
- **"Estado"**: Badge visual (limpio/pendiente/crítico) usando `resolveTemporalState()`.

### 14.2 Modal de Edición

Al pulsar "Editar" en una fila:
- Abre modal con formulario
- Permite editar:
  - `name` (nombre)
  - `description` (descripción)
  - `assigned_person_name` (alumno asignado, solo Master)
  - `recurrence_days` (recurrencia, default 30 días)
- Guarda vía `PATCH /admin/api/students/:id/domains/projects/items/:item_ref`
- Campos persistidos en `student_item_state.per_item_config`

### 14.3 Características del Modal

- Botón ❌ funcional
- Se cierra con ESC
- Se cierra al hacer click fuera (backdrop)
- No bloquea el fondo

---

## 15. Referencias

- `docs/STUDENT_SOT_V1_CERTIFIED.md`
- `docs/STUDENT_CAPABILITY_REGISTRY_V1.md`
- `docs/STUDENT_SIGNAL_REGISTRY_V1.md`
- `database/migrations/v5.45.0-student-domain-integration-v1.sql`

