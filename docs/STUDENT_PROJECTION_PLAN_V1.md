# STUDENT_PROJECTION_PLAN_V1.md — Plan de Proyecciones del Alumno

**Versión**: v1  
**Fecha**: 2025-01-XX

---

## 1. Propósito

El Student Projection Plan v1 define qué proyecciones podrían existir más adelante para optimizar consultas frecuentes del contexto del alumno.

**NOTA**: Este es un plan de diseño. No se implementa aún salvo que sea trivial y útil.

---

## 2. Proyecciones Propuestas

### 2.1 `student_summary_projection`

**Propósito**: Vista rápida del estado del alumno para UI/Admin

**Campos**:
- `student_id`: UUID
- `email`: Email
- `display_name`: Nombre
- `lifecycle_state`: Estado del ciclo de vida
- `operational_state`: Estado operativo
- `active_memberships_count`: Número de membresías activas
- `last_activity_at`: Última actividad
- `coherence_status`: Estado de coherencia
- `updated_at`: Última actualización

**Uso**: Listados de alumnos, dashboards admin

**Recálculo**: Batch rebuild diario o trigger-based

**Invalidación**: Al cambiar `operational_state`, membresías, o actividad

---

### 2.2 `streaks_projection`

**Propósito**: Rachas calculadas y cacheadas

**Campos**:
- `student_id`: UUID
- `product_key`: Clave del producto
- `current_streak`: Racha actual
- `longest_streak`: Racha más larga
- `last_practice_at`: Última práctica
- `frozen`: Si está congelada (PAUSED)
- `computed_at`: Cuándo se calculó
- `invalidated_at`: Cuándo se invalidó

**Uso**: Mostrar rachas en UI sin recalcular desde audit

**Recálculo**: Batch rebuild diario o trigger-based (al limpiar ítem)

**Invalidación**: Al limpiar ítem, al pausar/reanudar, al cambiar membresía

---

### 2.3 `domain_summary_projection`

**Propósito**: Resumen de estado por dominio

**Campos**:
- `student_id`: UUID
- `domain_key`: Clave del dominio
- `active_count`: Número de ítems activos
- `clean_count`: Número de ítems limpios
- `total_count`: Total de ítems
- `last_cleaned_at`: Última limpieza
- `computed_at`: Cuándo se calculó
- `invalidated_at`: Cuándo se invalidó

**Uso**: Mostrar resumen de dominios en UI sin consultar todos los ítems

**Recálculo**: Batch rebuild diario o trigger-based

**Invalidación**: Al activar/desactivar/limpiar ítem en dominio

---

## 3. Estrategia de Rebuild

### 3.1 Batch Rebuild

**Frecuencia**: Diaria (nocturna)

**Proceso**:
1. Recalcular todas las proyecciones para todos los alumnos
2. Actualizar tablas de proyección
3. Registrar métricas de tiempo de ejecución

**Ventajas**: Simple, predecible

**Desventajas**: Puede ser lento con muchos alumnos

---

### 3.2 Trigger-Based Rebuild

**Proceso**:
1. Triggers en tablas fuente (ej. `student_item_state_audit`)
2. Invalidar proyección afectada
3. Recalcular en background job

**Ventajas**: Actualización casi en tiempo real

**Desventajas**: Más complejo, puede saturar con alta frecuencia

---

### 3.3 Híbrido

**Estrategia**:
- Batch rebuild diario para todas las proyecciones
- Trigger-based para invalidación inmediata
- Rebuild incremental solo de proyecciones invalidadas

---

## 4. Versionado

Las proyecciones deben versionarse:
- `projection_version`: Versión del schema de la proyección
- `computed_at`: Cuándo se calculó
- `invalidated_at`: Cuándo se invalidó

---

## 5. Implementación Futura

### 5.1 Tablas de Proyección

```sql
CREATE TABLE student_summary_projection (
  student_id UUID PRIMARY KEY REFERENCES students(id),
  -- campos de proyección
  projection_version VARCHAR(10) DEFAULT 'v1',
  computed_at TIMESTAMPTZ NOT NULL,
  invalidated_at TIMESTAMPTZ
);

CREATE TABLE streaks_projection (
  student_id UUID,
  product_key TEXT,
  -- campos de proyección
  projection_version VARCHAR(10) DEFAULT 'v1',
  computed_at TIMESTAMPTZ NOT NULL,
  invalidated_at TIMESTAMPTZ,
  PRIMARY KEY (student_id, product_key)
);

CREATE TABLE domain_summary_projection (
  student_id UUID,
  domain_key TEXT,
  -- campos de proyección
  projection_version VARCHAR(10) DEFAULT 'v1',
  computed_at TIMESTAMPTZ NOT NULL,
  invalidated_at TIMESTAMPTZ,
  PRIMARY KEY (student_id, domain_key)
);
```

### 5.2 Servicios de Rebuild

```javascript
// src/services/student-projection-rebuild.js
export async function rebuildStudentSummaryProjection(studentId) { }
export async function rebuildStreaksProjection(studentId, productKey) { }
export async function rebuildDomainSummaryProjection(studentId, domainKey) { }
export async function rebuildAllProjections(studentId) { }
```

### 5.3 Invalidación

```javascript
// src/services/student-projection-invalidation.js
export async function invalidateStudentSummary(studentId) { }
export async function invalidateStreaks(studentId, productKey) { }
export async function invalidateDomainSummary(studentId, domainKey) { }
```

---

## 6. Cuándo Implementar

Implementar proyecciones cuando:
- Las consultas de `buildStudentContext` sean lentas (>500ms)
- Haya necesidad de listados rápidos de alumnos
- Las rachas se consulten frecuentemente sin necesidad de recálculo en tiempo real

---

## 7. Alternativas

Antes de implementar proyecciones, considerar:
- Optimización de índices en tablas fuente
- Caché en memoria (Redis) para consultas frecuentes
- Materialized views de PostgreSQL


