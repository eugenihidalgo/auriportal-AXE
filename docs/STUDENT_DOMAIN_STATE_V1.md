# ESTADO POR DOMINIO ENERGÉTICO: ALUMNO v1
## Documento Estructural del Modelo de Estado por Dominio

**Versión**: 1.0.0  
**Fecha**: 2025-01-XX  
**Estado**: VIGENTE  
**Alcance**: Sistema de estado personal del alumno por dominio energético

---

## 1. INTRODUCCIÓN

Este documento describe cómo se modela el **estado personal del alumno** para cada ítem de los catálogos energéticos (proyectos, lugares, apadrinados, transmutaciones).

El modelo permite:
- Tracking de estado por ítem y alumno
- Limpiezas recurrentes con contadores
- Recurrencias personalizables
- Auditoría completa
- Gobierno mediante políticas del Master

---

## 2. PATRÓN GENERAL

### 2.1 Estructura Base

El estado se modela mediante la tabla `student_item_state`:

```sql
student_item_state (
  id UUID PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES alumnos(id),
  domain_key TEXT NOT NULL,  -- 'transmutaciones_energeticas', 'proyectos', etc.
  item_id INTEGER NOT NULL,   -- ID del ítem en el catálogo
  is_active BOOLEAN DEFAULT FALSE,
  is_clean BOOLEAN DEFAULT FALSE,
  clean_count INTEGER DEFAULT 0,
  last_cleaned_at TIMESTAMPTZ,
  recommended_recurrence_days INTEGER,  -- Del catálogo
  student_recurrence_days INTEGER,      -- Editable por alumno
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, domain_key, item_id)
)
```

### 2.2 Claves Compuestas

La clave única es `(student_id, domain_key, item_id)`:
- Un alumno solo puede tener un estado por ítem
- Un ítem puede estar en múltiples dominios (si aplica)
- Un alumno puede tener múltiples ítems activos (si el Master lo permite)

---

## 3. QUÉ ES "LIMPIO/NO LIMPIO"

### 3.1 Definición

**is_clean** indica si un ítem está "limpio" (completado/revisado) según su tipo:

- **Para limpiezas recurrentes**: `is_clean = true` significa que se realizó la limpieza y está al día
- **Para limpiezas una vez**: `is_clean` puede no aplicarse (usar `is_complete` en su lugar)

### 3.2 Versionado

El estado "limpio" se versiona mediante:

- **last_cleaned_at**: Timestamp de última limpieza
- **clean_count**: Contador acumulativo de limpiezas
- **is_clean**: Estado actual (true si está limpio, false si necesita limpieza)

### 3.3 Cálculo de "Necesita Limpieza"

Un ítem necesita limpieza si:

```sql
is_clean = false OR
(last_cleaned_at IS NULL) OR
(last_cleaned_at + INTERVAL '1 day' * COALESCE(student_recurrence_days, recommended_recurrence_days, 30) < NOW())
```

---

## 4. CÓMO SE CALCULA "ACTIVOS"

### 4.1 Ítems Activos

Un ítem está activo si:

```sql
is_active = true
```

### 4.2 Límite de Activos

El número de ítems activos por dominio se gobierna mediante `student_domain_policies`:

```sql
SELECT COUNT(*) 
FROM student_item_state 
WHERE student_id = ? 
  AND domain_key = ? 
  AND is_active = true
```

Este conteo se compara con:
- `active_limit_override` (si existe override del Master)
- `active_limit_default` (si no hay override, default = 1)

### 4.3 Enforcement

El servicio `student-domain-state-service` valida antes de activar:

```javascript
const activeCount = await countActiveItems(student_id, domain_key);
const policy = await getDomainPolicy(student_id, domain_key);
const limit = policy.active_limit_override ?? policy.active_limit_default;

if (actor === 'student' && activeCount >= limit) {
  throw new Error(`Límite de ítems activos alcanzado: ${limit}`);
}
```

---

## 5. RECURRENCIAS

### 5.1 Recurrencia Recomendada

**recommended_recurrence_days**: Valor del catálogo (ej: transmutación tiene `frecuencia_dias = 30`)

Este valor se copia desde el catálogo cuando se activa el ítem.

### 5.2 Recurrencia Personalizada

**student_recurrence_days**: Valor editable por el alumno

- El alumno puede personalizar la recurrencia
- Si es NULL, se usa `recommended_recurrence_days`
- Si ambos son NULL, se usa un default (ej: 30 días)

### 5.3 Cálculo de Próxima Limpieza

```sql
last_cleaned_at + INTERVAL '1 day' * COALESCE(
  student_recurrence_days, 
  recommended_recurrence_days, 
  30
)
```

---

## 6. METADATOS (meta JSONB)

### 6.1 Uso Limitado

El campo `meta` es JSONB pero debe usarse con **mucha moderación**:

- Solo para datos que no caben en el esquema normalizado
- No para duplicar datos que ya existen en otras tablas
- No para lógica de negocio

### 6.2 Ejemplos Válidos

```json
{
  "notes": "Notas personales del alumno",
  "tags": ["urgente", "importante"],
  "custom_field": "valor personalizado"
}
```

### 6.3 Ejemplos Inválidos

```json
{
  "item_name": "...",  // Ya existe en el catálogo
  "student_email": "...",  // Ya existe en alumnos
  "last_cleaned_at": "...",  // Ya existe como columna
  "business_logic": {...}  // No lógica de negocio
}
```

---

## 7. INTEGRACIÓN CON CATÁLOGOS

### 7.1 Referencias a Catálogos

El `item_id` referencia al catálogo correspondiente:

- **transmutaciones_energeticas**: `item_id` → `items_transmutaciones.id`
- **proyectos**: `item_id` → `items_proyectos.id` (si existe catálogo) o proyecto personal
- **lugares**: `item_id` → `items_lugares.id` (si existe catálogo) o lugar personal
- **apadrinados**: `item_id` → `items_apadrinados.id` (si existe catálogo) o apadrinado personal

### 7.2 Ítems Personales vs Catálogo

- Si el ítem es **personal** (creado por el alumno), `item_id` puede referenciar una tabla de ítems personales
- Si el ítem es del **catálogo**, `item_id` referencia el catálogo PDE

**Nota**: Para v1, asumimos que proyectos/lugares/apadrinados pueden ser personales o del catálogo. La migración debe considerar ambos casos.

---

## 8. OPERACIONES COMUNES

### 8.1 Activar Ítem

```javascript
await setActive(student_id, domain_key, item_id, true, { type: 'student', id: student_id });
```

### 8.2 Desactivar Ítem

```javascript
await setActive(student_id, domain_key, item_id, false, { type: 'student', id: student_id });
```

### 8.3 Marcar como Limpio

```javascript
await cleanItem(student_id, domain_key, item_id, { type: 'student', id: student_id });
```

### 8.4 Limpieza Masiva

```javascript
await bulkClean(student_id, domain_key, item_ids, { type: 'master', id: master_id });
// O limpiar todos los activos:
await bulkClean(student_id, domain_key, { allActive: true }, { type: 'master', id: master_id });
```

### 8.5 Establecer Recurrencia

```javascript
await setStudentRecurrence(student_id, domain_key, item_id, 45, { type: 'student', id: student_id });
```

---

## 9. AUDITORÍA

Todas las operaciones se auditan en `student_item_state_audit`:

- **ACTIVATE**: Cuando se activa un ítem
- **DEACTIVATE**: Cuando se desactiva un ítem
- **CLEAN**: Cuando se marca como limpio
- **BULK_CLEAN**: Cuando se limpian múltiples ítems
- **SET_RECURRENCE**: Cuando se cambia la recurrencia

---

## 10. REFERENCIAS

- `docs/SOT_STUDENT_V1.md`: Documento constitucional del Alumno SOT
- `docs/STUDENT_MASTER_MODE_V1.md`: Modo Master y gobierno

---

**Fin del Documento Estructural de Estado por Dominio v1**


