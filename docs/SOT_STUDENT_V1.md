# SOURCE OF TRUTH: ALUMNO v1
## Documento Constitucional del Alumno SOT

**Versión**: 1.0.0  
**Fecha**: 2025-01-XX  
**Estado**: VIGENTE  
**Alcance**: Sistema completo AuriPortal

---

## 1. ONTOLOGÍA: QUÉ ES EL ALUMNO

### 1.1 Definición

El **Alumno** es una entidad viva y soberana en AuriPortal que representa:

- **Identidad**: Email, nombre, apodo, datos personales
- **Estado global**: Suscripción, nivel, racha, progreso
- **Estado por dominio energético**: Proyectos, lugares, apadrinados, transmutaciones
- **Clasificaciones**: Niveles, logros, XP (si aplica)
- **Overrides del Master**: Modificaciones manuales autorizadas

### 1.2 Qué NO es el Alumno

- **NO es un simple registro** en una tabla
- **NO es un agregado estático** de datos
- **NO es una proyección** de ClickUp o Kajabi
- **NO es un caché** de sistemas externos

### 1.3 El Alumno como Agregado Vivo

El Alumno es un **agregado vivo** con:

- Estado global coherente
- Estado personal por dominio energético
- Progresión calculable y auditable
- Clasificaciones derivadas
- Capacidad de recibir overrides del Master
- Trazabilidad completa de mutaciones

---

## 2. SOBERANÍA: POSTGRESQL COMO ÚNICA AUTORIDAD

### 2.1 Principio de Soberanía Única

**PostgreSQL es el ÚNICO Source of Truth soberano del Alumno.**

La tabla `alumnos` en PostgreSQL contiene la autoridad soberana sobre:
- Identidad del alumno (email, nombre, apodo)
- Estado de suscripción
- Nivel actual
- Racha actual
- Fecha de última práctica
- Fecha de inscripción
- Todos los datos operativos del alumno

### 2.2 Sistemas Externos: Prohibiciones Absolutas

**ClickUp:**
- NO es fuente de verdad
- Actúa como sistema externo / operativo / CRM
- Nunca decide estado
- Puede recibir actualizaciones desde PostgreSQL como mirror
- No se consulta en runtime para decisiones de negocio

**Kajabi:**
- NO es fuente de verdad
- NO participa en runtime
- Puede, como máximo, emitir eventos externos históricos
- No bloquea acceso
- No participa en decisiones de negocio

**SQLite/Legacy:**
- NO es fuente de verdad
- Es legacy
- No se lee en runtime
- Existe solo para referencia histórica

### 2.3 Separación Identidad vs Producto

El Alumno se separa en dos capas:

1. **Identidad (student)**: Datos personales, email, nombre, apodo
2. **Producto (student_product_memberships)**: Suscripciones a productos (PDE ahora, futuro multi-producto)

Esta separación permite:
- Un alumno puede tener múltiples productos
- La identidad es única e inmutable
- Los productos tienen ciclos de vida independientes

---

## 3. ESTADOS POR DOMINIO ENERGÉTICO

### 3.1 Dominios Energéticos v1

Los dominios energéticos son categorías de ítems que el alumno puede gestionar:

- **transmutaciones_energeticas**: Transmutaciones del catálogo PDE
- **proyectos**: Proyectos del catálogo PDE (o personales)
- **lugares**: Lugares del catálogo PDE (o personales)
- **apadrinados**: Apadrinados del catálogo PDE (o personales)

### 3.2 Estado Personal por Ítem

Cada ítem del catálogo tiene **estado personal** del alumno:

- **is_active**: Si el ítem está activo para el alumno
- **is_clean**: Si el ítem está limpio (para limpiezas recurrentes)
- **clean_count**: Contador de limpiezas realizadas
- **last_cleaned_at**: Timestamp de última limpieza
- **recommended_recurrence_days**: Recurrencia recomendada del catálogo
- **student_recurrence_days**: Recurrencia personalizada por el alumno (editable)
- **meta**: Metadatos adicionales (JSONB, muy limitado)

### 3.3 Modelo de Datos

El estado se almacena en `student_item_state`:

```sql
student_item_state (
  id UUID PK,
  student_id INTEGER FK → alumnos(id),
  domain_key TEXT,  -- 'transmutaciones_energeticas', 'proyectos', etc.
  item_id INTEGER,   -- ID del ítem en el catálogo correspondiente
  is_active BOOLEAN,
  is_clean BOOLEAN,
  clean_count INTEGER,
  last_cleaned_at TIMESTAMPTZ,
  recommended_recurrence_days INTEGER,
  student_recurrence_days INTEGER,
  meta JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  UNIQUE(student_id, domain_key, item_id)
)
```

---

## 4. REGLAS DE ACTIVACIÓN GOBERNADAS

### 4.1 Límite por Dominio (Default)

**Por defecto, un alumno solo puede tener 1 ítem activo por dominio.**

Esta regla se gobierna mediante `student_domain_policies`:

```sql
student_domain_policies (
  id UUID PK,
  student_id INTEGER FK → alumnos(id),
  domain_key TEXT,
  active_limit_default INTEGER DEFAULT 1,
  active_limit_override INTEGER NULL,  -- Override del Master
  can_activate_multiple BOOLEAN,  -- Derivado de override > 1
  set_by TEXT,  -- 'master' | 'system'
  reason TEXT,
  created_at TIMESTAMPTZ
)
```

### 4.2 Override del Master

El Master puede permitir que un alumno tenga **múltiples ítems activos**:

- **active_limit_override**: Límite personalizado (ej: 3, 10, -1 para ilimitado)
- **can_activate_multiple**: Se calcula como `active_limit_override > 1 OR active_limit_override = -1`
- **set_by**: Siempre 'master' para overrides
- **reason**: Justificación del override

### 4.3 Enforcement en Servicio

La validación se hace en el servicio `student-domain-state-service`:

- Si `actor = 'student'`: No permitir activar más ítems que el límite
- Si `actor = 'master'`: Permitir hasta el override (o ilimitado si -1)
- Registrar auditoría SIEMPRE

---

## 5. PROYECCIÓN Y DERIVADOS

### 5.1 Nivel Base vs Overrides

El nivel del alumno se calcula como:

- **nivel_base**: Calculado desde fecha_inscripcion (si existe engine)
- **nivel_override**: Override manual del Master (opcional)
- **nivel_efectivo**: `nivel_override ?? nivel_base`

**Nota**: Si no existe engine de progresión, referenciar cuando se implemente.

### 5.2 Clasificaciones

Las clasificaciones (niveles, XP, logros) son derivadas y calculables:

- Se calculan desde señales y eventos
- Son observables y auditables
- No se almacenan como estado primario (se derivan)

---

## 6. AUDITORÍA

### 6.1 Auditoría Obligatoria

Toda mutación del alumno debe ser trazable:

- **Quién**: actor_type ('master', 'student', 'system')
- **Qué**: acción realizada (ACTIVATE, DEACTIVATE, CLEAN, SET_RECURRENCE, etc.)
- **Cuándo**: timestamp preciso
- **Por qué**: reason (opcional pero recomendado)
- **Estado antes/después**: JSONB con snapshot

### 6.2 Tabla de Auditoría

```sql
student_item_state_audit (
  id UUID PK,
  student_id INTEGER,
  domain_key TEXT,
  item_id INTEGER,
  action TEXT,  -- 'ACTIVATE', 'DEACTIVATE', 'CLEAN', 'SET_RECURRENCE', 'BULK_CLEAN', etc.
  actor_type TEXT,  -- 'master', 'student', 'system'
  actor_id TEXT NULL,  -- ID del actor (opcional)
  before JSONB,  -- Estado antes
  after JSONB,   -- Estado después
  trace_id TEXT,  -- Para correlación
  created_at TIMESTAMPTZ
)
```

### 6.3 Append-Only

La auditoría es **append-only**:
- No se modifica
- No se elimina
- Solo se consulta

---

## 7. OBSERVABILIDAD

### 7.1 Trace_ID Obligatorio

Todo código que modifique el alumno debe:
- Propagar `trace_id` desde el request
- Incluir `trace_id` en logs estructurados
- Registrar `trace_id` en auditoría

### 7.2 Logging Estructurado

Los logs deben incluir:
- `trace_id`: Para correlación
- `student_id`: ID del alumno
- `domain_key`: Dominio afectado
- `item_id`: Ítem afectado (si aplica)
- `action`: Acción realizada
- `actor`: Quién realizó la acción

### 7.3 Señales

Las señales solo se emiten si están **registradas** en el Registry canónico:

- NO emitir señales ad-hoc
- NO crear señales sin registro previo
- Consultar `pde_signals` o registry equivalente antes de emitir

---

## 8. CONTRATOS DE API MÍNIMOS

### 8.1 ListForConsumption

Toda API que liste ítems para consumo debe:

- Retornar JSON absoluto (nunca HTML)
- Incluir filtros canónicos
- Incluir paginación si aplica
- Incluir metadata (total, page, etc.)

### 8.2 Filtros Canónicos

Los filtros canónicos son:

- `domain_key`: Dominio energético
- `is_active`: Solo activos
- `is_clean`: Solo limpios (para limpiezas)
- `student_id`: ID del alumno

### 8.3 Estructura de Respuesta

```json
{
  "success": true,
  "data": [...],
  "meta": {
    "total": 10,
    "page": 1,
    "per_page": 20
  },
  "trace_id": "..."
}
```

---

## 9. INVARIANTES

### 9.1 Unicidad

- Un alumno solo puede tener un estado por (domain_key, item_id)
- Un alumno solo puede tener una política por domain_key
- El email del alumno es único

### 9.2 Consistencia

- El estado del alumno debe ser consistente con sus políticas
- Los contadores (clean_count) deben ser coherentes
- Las fechas (last_cleaned_at) deben ser válidas

### 9.3 No Legacy Runtime

- NO leer legacy en runtime
- NO usar SQLite en runtime
- NO consultar ClickUp/Kajabi para decisiones

### 9.4 Estados Explícitos

- Los estados deben ser explícitos (no implícitos)
- Los estados deben ser validables
- Los estados deben ser auditables

---

## 10. REFERENCIAS

- `CERTIFICACION_SOURCE_OF_TRUTH_FASE1.md`: Certificación constitucional SOT
- `docs/STUDENT_DOMAIN_STATE_V1.md`: Modelo de estado por dominio
- `docs/STUDENT_MASTER_MODE_V1.md`: Modo Master y gobierno

---

**Fin del Documento Constitucional del Alumno SOT v1**


