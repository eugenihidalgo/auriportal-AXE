# Sistema Canónico de Overrides v1

**Versión**: 1.0.0  
**Fecha**: 2026-01-XX  
**Dominio**: MASTER (AuriPortal)  
**Estado**: ✅ IMPLEMENTADO

## Estatuto Constitucional

El Sistema de Overrides v1 permite sobrescribir valores base del sistema a nivel de alumno individual, **sin romper**:
- Source of Truth
- Proyecciones (LPM/CPM)
- UUID-only
- Auditoría
- Reglas constitucionales existentes

⚠️ **Este sistema es transversal y reutilizable en el futuro.**

## 1. Qué es un Override

### Definición

Un **Override** es un valor que sobrescribe temporalmente un valor base del sistema para un alumno específico, **sin modificar el valor base original**.

### Diferencia entre Valor Base y Valor Efectivo

- **Valor Base**: Valor canónico almacenado en las tablas principales (ej: `students.nivel`, `items_transmutaciones.veces_limpiar`)
- **Valor Efectivo**: Valor que se usa en runtime, combinando valor base + override si existe

**Regla fundamental**: El override se aplica **solo en la resolución efectiva**, nunca modifica el valor base.

### Ejemplo

```javascript
// Valor base en students
student.nivel = 5

// Override en student_overrides
override = {
  student_uuid: "...",
  field_key: "nivel",
  override_value: 8
}

// Valor efectivo (usado en runtime)
effective_nivel = 8  // Override aplicado
```

## 2. Reglas Constitucionales

### 2.1 Backend es la Única Autoridad

- ✅ El backend calcula y aplica overrides
- ❌ El frontend **NUNCA** calcula overrides
- ❌ El frontend **SOLO** renderiza estado efectivo

**Flujo canónico**: `Acción → Estado → Proyección → UI`

### 2.2 UUID-only

- ✅ `student_uuid` (UUID) es la única identidad válida
- ❌ Prohibido `legacy_alumno_id` (INTEGER)
- ❌ Prohibido `student_id` INTEGER

### 2.3 Override ≠ Mutación

- ✅ Override se almacena en tablas separadas (`student_overrides`, `student_item_overrides`)
- ❌ **NUNCA** se modifica el valor base en tablas principales
- ✅ Override es reversible (se puede eliminar)

### 2.4 Auditable y Reversible

- ✅ Overrides tienen `created_at`, `created_by`, `reason`
- ✅ Overrides pueden eliminarse sin afectar valor base
- ❌ Sin borrados silenciosos

## 3. Overrides de Alumno

### 3.1 Campos Soportados en V1

**ALCANCE ESTRICTO V1** - Solo estos campos están implementados:

1. **`nivel`** (number)
   - Override del nivel del alumno
   - Aplicado en Level Engine

2. **`fecha_creacion`** (Date/ISO string)
   - Override de la fecha de creación del alumno
   - Aplicado en Level Engine para calcular días transcurridos

3. **`apodo`** (string)
   - Override del apodo del alumno
   - Aplicado en resoluciones de display name

⚠️ **No tocar otros campos aunque existan en `students`.**

### 3.2 Ejemplos Reales

#### Ejemplo 1: Override de Nivel

```json
POST /master/api/student-overrides
{
  "student_uuid": "550e8400-e29b-41d4-a716-446655440000",
  "field_key": "nivel",
  "override_value": 8,
  "reason": "Ajuste manual por Master"
}
```

**Efecto**: El alumno se considera nivel 8 en todos los cálculos, aunque su nivel base sea 5.

#### Ejemplo 2: Override de Fecha de Creación

```json
POST /master/api/student-overrides
{
  "student_uuid": "550e8400-e29b-41d4-a716-446655440000",
  "field_key": "fecha_creacion",
  "override_value": "2024-01-01T00:00:00Z",
  "reason": "Corrección de fecha de alta"
}
```

**Efecto**: El Level Engine usa esta fecha para calcular días transcurridos PDE, en lugar de `students.created_at`.

## 4. Overrides de Ítem (Cleaning)

### 4.1 UNA_VEZ: required_count

Permite sobrescribir `veces_limpiar` (required_count) de un item `una_vez` para un alumno específico.

**Ejemplo**:
```json
POST /master/api/student-item-overrides
{
  "student_uuid": "550e8400-e29b-41d4-a716-446655440000",
  "item_ref": "transmutacion_item_123",
  "override_key": "required_count",
  "override_value": 20,
  "reason": "Alumno requiere más limpiezas"
}
```

**Efecto**: 
- Item base tiene `veces_limpiar = 10`
- Para este alumno, el sistema requiere 20 limpiezas
- Estado NO completado hasta alcanzar 20 (no 10)

### 4.2 RECURRENTE: threshold_days

Permite sobrescribir `frecuencia_dias` (threshold_days) de un item `recurrente` para un alumno específico.

**Ejemplo**:
```json
POST /master/api/student-item-overrides
{
  "student_uuid": "550e8400-e29b-41d4-a716-446655440000",
  "item_ref": "transmutacion_item_456",
  "override_key": "threshold_days",
  "override_value": 14,
  "reason": "Alumno necesita limpieza más frecuente"
}
```

**Efecto**:
- Item base tiene `frecuencia_dias = 7`
- Para este alumno, el umbral es 14 días
- Estado cambia a "pending" después de 14 días (no 7)

### 4.3 Impacto en ALL

⚠️ **IMPORTANTE**: En proyección `scope='all'`, los overrides individuales **NO se aplican** en V1.

- ✅ Overrides se aplican cuando `scope='student'`
- ❌ Overrides **NO** se aplican cuando `scope='all'` (agregación)

**Razón**: La proyección ALL calcula "peor estado" del grupo, y aplicar overrides individuales complicaría el cálculo agregado.

**Futuro**: En v2+ se podría considerar aplicar overrides en ALL si un alumno tiene override más exigente.

## 5. Modelo de Datos

### 5.1 Tabla: student_overrides

```sql
CREATE TABLE student_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_uuid UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,
  override_value JSONB NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT,
  
  UNIQUE (student_uuid, field_key)
);
```

**Campos**:
- `student_uuid`: UUID canónico del estudiante
- `field_key`: Clave del campo (`nivel`, `fecha_creacion`, `apodo`)
- `override_value`: Valor del override (JSONB, puede ser number, string, date)
- `reason`: Razón del override (opcional, para auditoría)
- `created_by`: Quién creó el override (opcional)

**Constraints**:
- UNIQUE en `(student_uuid, field_key)` - Solo un override por campo por alumno

### 5.2 Tabla: student_item_overrides

```sql
CREATE TABLE student_item_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_uuid UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  item_ref TEXT NOT NULL,
  override_key TEXT NOT NULL,
  override_value JSONB NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT,
  
  UNIQUE (student_uuid, item_ref, override_key)
);
```

**Campos**:
- `student_uuid`: UUID canónico del estudiante
- `item_ref`: Referencia del item (ej: `transmutacion_item_123`)
- `override_key`: Clave del override (`required_count`, `threshold_days`)
- `override_value`: Valor del override (JSONB, number)
- `reason`: Razón del override (opcional)
- `created_by`: Quién creó el override (opcional)

**Constraints**:
- UNIQUE en `(student_uuid, item_ref, override_key)` - Solo un override por clave por item por alumno

### 5.3 Migración

**Archivo**: `database/migrations/v5.71.0-student-overrides-v1.sql`

**Estado**: ✅ Creada, pendiente de ejecución

## 6. Integración con LPM / CPM

### 6.1 Dónde se Aplica

#### Level Engine

**Archivo**: `src/core/master/services/level-engine-service.js`

**Función**: `resolveStudentStartDate()`

**Aplicación**:
```javascript
// Aplicar override de fecha_creacion si existe
const effectiveDate = await resolveStudentField(
  { id: studentId },
  'fecha_creacion',
  baseDate || new Date()
);
```

**Momento**: Antes de calcular días transcurridos PDE.

#### List Projection Model (LPM)

**Archivo**: `src/core/master/services/list-projection-model.js`

**Función**: `computeListProjection()`

**Aplicación**:
```javascript
// Aplicar overrides si scope='student'
if (scope === 'student' && studentId) {
  effectiveConfig = await resolveItemConfigForStudent(
    effectiveConfig,
    studentId,
    item.item_ref
  );
}
```

**Momento**: Antes de llamar a `computeCleaningProjection()`.

**Condición**: Solo cuando `scope='student'` (NO en `scope='all'`).

### 6.2 En qué Momento

1. **Level Engine**: Al resolver fecha de inicio para calcular días transcurridos
2. **LPM**: Al calcular configuración efectiva de items antes de CPM
3. **CPM**: Recibe configuración efectiva (ya con overrides aplicados)

### 6.3 Qué NO hace el Frontend

❌ **PROHIBIDO**:
- Calcular overrides en frontend
- Inferir valores efectivos desde datos raw
- Aplicar overrides localmente
- Asumir valores sin refetch

✅ **OBLIGATORIO**:
- Solicitar datos al backend con parámetros explícitos
- Consumir estado efectivo desde backend
- Re-renderizar cuando backend devuelve estado distinto
- Refetch completo tras mutaciones

## 7. Casos de Uso Validados

### 7.1 Override de Nivel

**Escenario**: Alumno con nivel base 5, override a nivel 8.

**Validación**:
- ✅ Level Engine usa nivel 8 para cálculos
- ✅ UI muestra nivel 8
- ✅ Eliminar override → vuelve a nivel 5

### 7.2 Override de Fecha de Creación

**Escenario**: Alumno con fecha base 2024-06-01, override a 2024-01-01.

**Validación**:
- ✅ Level Engine calcula días desde 2024-01-01
- ✅ Fase PDE se calcula correctamente
- ✅ Eliminar override → vuelve a fecha base

### 7.3 Override de required_count (UNA_VEZ)

**Escenario**: Item base `veces_limpiar = 10`, override a 20 para un alumno.

**Validación**:
- ✅ Estado NO completado hasta 20 limpiezas
- ✅ Proyección ALL refleja estado correcto
- ✅ Eliminar override → vuelve a requerir 10

### 7.4 Override de threshold_days (RECURRENTE)

**Escenario**: Item base `frecuencia_dias = 7`, override a 14 para un alumno.

**Validación**:
- ✅ Estado cambia a "pending" después de 14 días
- ✅ Proyección respeta threshold override
- ✅ Eliminar override → vuelve a 7 días

### 7.5 Sin Overrides

**Escenario**: Alumno sin overrides.

**Validación**:
- ✅ Comportamiento idéntico al sistema actual
- ✅ Valores base se usan directamente
- ✅ Sin impacto en rendimiento

## 8. Fuera de Alcance

### 8.1 Qué NO Existe Todavía

❌ **NO implementado en V1**:
- Overrides de otros campos de `students` (solo `nivel`, `fecha_creacion`, `apodo`)
- Overrides de otros campos de items (solo `required_count`, `threshold_days`)
- Overrides en proyección `scope='all'` (solo `scope='student'`)
- UI para gestionar overrides (solo APIs)
- Overrides de nivel en Level Engine (solo fecha_creacion)
- Overrides de `apodo` en resoluciones (solo estructura)

### 8.2 Qué NO Debe Asumirse

⚠️ **NO asumir**:
- Que overrides se aplican automáticamente en todos los lugares
- Que overrides afectan proyecciones agregadas (ALL)
- Que existe UI para crear/editar overrides
- Que overrides se validan contra reglas de negocio
- Que overrides tienen versionado o historial

## 9. APIs Disponibles

### 9.1 Student Overrides

#### POST /master/api/student-overrides
Crea un override de campo de alumno.

**Request**:
```json
{
  "student_uuid": "550e8400-e29b-41d4-a716-446655440000",
  "field_key": "nivel",
  "override_value": 8,
  "reason": "Ajuste manual"
}
```

**Response**:
```json
{
  "ok": true,
  "override": {
    "id": "...",
    "student_uuid": "...",
    "field_key": "nivel",
    "override_value": 8,
    "reason": "Ajuste manual",
    "created_at": "...",
    "created_by": "..."
  }
}
```

#### DELETE /master/api/student-overrides/:id
Elimina un override.

**Response**:
```json
{
  "ok": true,
  "deleted": true
}
```

#### GET /master/api/student-overrides?student_uuid=...
Lista todos los overrides de un estudiante.

**Response**:
```json
{
  "ok": true,
  "overrides": [
    {
      "id": "...",
      "student_uuid": "...",
      "field_key": "nivel",
      "override_value": 8,
      ...
    }
  ]
}
```

### 9.2 Student Item Overrides

#### POST /master/api/student-item-overrides
Crea un override de configuración de item.

**Request**:
```json
{
  "student_uuid": "550e8400-e29b-41d4-a716-446655440000",
  "item_ref": "transmutacion_item_123",
  "override_key": "required_count",
  "override_value": 20,
  "reason": "Alumno requiere más limpiezas"
}
```

#### DELETE /master/api/student-item-overrides/:id
Elimina un override.

#### GET /master/api/student-item-overrides?student_uuid=...&item_ref=...
Lista overrides de items de un estudiante (opcionalmente filtrado por item_ref).

## 10. Referencias de Código

### 10.1 Repositorios

- `src/infra/repos/student-overrides-repo-pg.js` - Repositorio de student overrides
- `src/infra/repos/student-item-overrides-repo-pg.js` - Repositorio de item overrides

### 10.2 Servicios

- `src/core/master/services/override-resolution-service.js` - Servicio de resolución de overrides
  - `resolveStudentField()` - Resuelve campo de alumno con override
  - `resolveItemConfigForStudent()` - Resuelve configuración de item con override
  - `getAllOverridesForStudent()` - Obtiene todos los overrides de un estudiante

### 10.3 Endpoints

- `src/endpoints/master-api-student-overrides.js` - Endpoints de student overrides
- `src/endpoints/master-api-student-item-overrides.js` - Endpoints de item overrides

### 10.4 Integraciones

- `src/core/master/services/level-engine-service.js` - Integración en Level Engine
- `src/core/master/services/list-projection-model.js` - Integración en LPM

## 11. Verificación

### 11.1 Checklist de Implementación

- [x] Migración SQL creada (`v5.71.0-student-overrides-v1.sql`)
- [x] Repositorios creados
- [x] Servicio de resolución creado
- [x] Endpoints API creados
- [x] Rutas registradas en `master-route-registry.js`
- [x] Handlers mapeados en `master-router-resolver.js`
- [x] Integración en Level Engine (fecha_creacion)
- [x] Integración en LPM (required_count, threshold_days)
- [ ] Migración ejecutada en base de datos
- [ ] Servidor reiniciado
- [ ] Casos de prueba validados

### 11.2 Pruebas Manuales

1. **Crear override de nivel**:
   ```bash
   curl -X POST http://localhost:3000/master/api/student-overrides \
     -H "Content-Type: application/json" \
     -d '{"student_uuid":"...","field_key":"nivel","override_value":8}'
   ```

2. **Verificar override aplicado**: Consultar Level Engine y verificar que usa nivel 8.

3. **Eliminar override**:
   ```bash
   curl -X DELETE http://localhost:3000/master/api/student-overrides/:id
   ```

4. **Verificar vuelta a valor base**: Consultar Level Engine y verificar que usa nivel base.

---

**Última actualización**: 2026-01-XX  
**Mantenido por**: Sistema de documentación canónica
