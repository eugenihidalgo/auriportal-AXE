# STUDENT_LIFECYCLE_MAP_V1.md — Mapa del Ciclo de Vida del Alumno

**Versión**: v1  
**Fecha**: 2025-01-XX

---

## 1. Propósito

El Student Lifecycle Map v1 documenta los estados y transiciones del ciclo de vida del alumno en AuriPortal.

---

## 2. Estados del Ciclo de Vida

### 2.1 `created`
- **Descripción**: Registro creado en `students` (ontológico)
- **Condición**: Existe registro en `students` pero no hay membresía ni estado operativo

### 2.2 `enrolled`
- **Descripción**: Alumno inscrito a un producto
- **Condición**: Existe `student_product_memberships` pero no hay estado operativo ACTIVE

### 2.3 `active`
- **Descripción**: Alumno activo y operando normalmente
- **Condición**: `operational_state.state = ACTIVE` y existe membresía

### 2.4 `paused`
- **Descripción**: Alumno en pausa (suscripción pausada, etc.)
- **Condición**: `operational_state.state = PAUSED`

### 2.5 `resumed`
- **Descripción**: Alumno reanudado (transición de PAUSED a ACTIVE)
- **Condición**: Transición intermedia, luego pasa a `active`

### 2.6 `suspended`
- **Descripción**: Alumno suspendido (por Master o sistema)
- **Condición**: `operational_state.state = SUSPENDED`

### 2.7 `archived` (Futuro)
- **Descripción**: Alumno archivado (soft delete)
- **Condición**: `students.deleted_at IS NOT NULL`

---

## 3. Transiciones Permitidas

### 3.1 Creación
- `null` → `created`: Al crear registro en `students`

### 3.2 Inscripción
- `created` → `enrolled`: Al crear `student_product_memberships`

### 3.3 Activación
- `enrolled` → `active`: Al establecer `operational_state = ACTIVE`
- `resumed` → `active`: Automático al establecer `operational_state = ACTIVE`

### 3.4 Pausa
- `active` → `paused`: Al llamar `pauseStudent()`

### 3.5 Reanudación
- `paused` → `resumed`: Al llamar `resumeStudent()`
- `resumed` → `active`: Automático

### 3.6 Suspensión
- `active` → `suspended`: Al establecer `operational_state = SUSPENDED`
- `paused` → `suspended`: Al establecer `operational_state = SUSPENDED`

### 3.7 Reactivación desde Suspensión
- `suspended` → `active`: Al establecer `operational_state = ACTIVE` (solo Master)

### 3.8 Archivado (Futuro)
- `active` → `archived`: Al establecer `deleted_at`
- `paused` → `archived`: Al establecer `deleted_at`
- `suspended` → `archived`: Al establecer `deleted_at`

---

## 4. Reglas de Transición

### 4.1 Validación
- Las transiciones deben ser validadas antes de aplicarse
- Usar `isValidTransition(fromState, toState)` para verificar

### 4.2 Auditoría
- Todas las transiciones deben registrarse en auditoría
- Emitir señal `student.lifecycle.transition` (futuro)

---

## 5. Uso

```javascript
import { getLifecycleState, isValidTransition } from '../core/student/lifecycle/student-lifecycle.js';

const context = await buildStudentContext(studentId, productKey);
const currentState = getLifecycleState(context);

// Verificar transición
if (isValidTransition(currentState, 'paused')) {
  await pauseStudent(studentId, 'subscription_pause_default', 'subscription');
}
```

---

## 6. Extensión

Para añadir nuevos estados o transiciones:
1. Añadir estado a `STUDENT_LIFECYCLE_STATES`
2. Añadir transición a `STUDENT_LIFECYCLE_TRANSITIONS`
3. Actualizar `getLifecycleState()` si es necesario
4. Documentar en este archivo


