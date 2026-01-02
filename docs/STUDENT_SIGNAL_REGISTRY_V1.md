# STUDENT_SIGNAL_REGISTRY_V1.md — Registry Canónico de Señales del Alumno

**Versión**: v1  
**Fecha**: 2025-01-XX

---

## 1. Principio Fundamental

El Student Signal Registry v1 es la **única fuente de verdad** para qué señales del dominio Alumno existen y cómo se emiten.

**REGLA CONSTITUCIONAL**: Solo se pueden emitir señales registradas. Prohibido emitir señales ad-hoc.

---

## 2. Categorías de Señales

### 2.1 Domain Signals (Dominio Alumno)

Señales que representan eventos del dominio de negocio:
- `student.created`: Creación de registro ontológico
- `student.enrolled`: Inscripción a producto
- `student.operational.paused`: Entrada en estado PAUSED
- `student.operational.resumed`: Salida de PAUSED a ACTIVE
- `student.domain.item.activated`: Activación de ítem en dominio
- `student.domain.item.deactivated`: Desactivación de ítem
- `student.domain.item.cleaned`: Limpieza de ítem
- `student.domain.bulk_cleaned`: Limpieza masiva
- `student.capability.changed`: Cambio en capabilities

### 2.2 Observability Signals (Observabilidad)

Señales para diagnóstico y monitoreo:
- `student.coherence.degraded`: Estado de coherencia degradado
- `student.coherence.broken`: Estado de coherencia roto
- `student.sot.invariant_violation_detected`: Violación de invariante
- `student.sot.backfill.applied`: Backfill aplicado

---

## 3. Payload Esperado

Cada señal tiene un payload documentado en el registry. Ejemplo:

```javascript
{
  signal_key: 'student.operational.paused',
  category: 'domain',
  payload: {
    student_id: 'uuid',
    pause_profile_key: 'subscription_pause_default',
    source: 'subscription',
    reason: 'Suscripción pausada',
    trace_id: 'trace-id'
  }
}
```

---

## 4. Cuándo se Emite

### 4.1 Domain Signals

- `student.created`: Al crear registro en `students`
- `student.enrolled`: Al crear `student_product_memberships`
- `student.operational.paused`: Al llamar `pauseStudent()`
- `student.operational.resumed`: Al llamar `resumeStudent()`
- `student.domain.item.activated`: Al activar ítem en dominio
- `student.domain.item.deactivated`: Al desactivar ítem
- `student.domain.item.cleaned`: Al limpiar ítem
- `student.domain.bulk_cleaned`: Al limpiar múltiples ítems
- `student.capability.changed`: Cuando cambian capabilities (p.ej., por pausa)

### 4.2 Observability Signals

- `student.coherence.degraded`: Al detectar estado DEGRADED
- `student.coherence.broken`: Al detectar estado BROKEN
- `student.sot.invariant_violation_detected`: Al detectar violación de invariante
- `student.sot.backfill.applied`: Al aplicar backfill

---

## 5. Consumidores Futuros

### 5.1 Automatizaciones

Las automatizaciones pueden suscribirse a señales para:
- Reaccionar a cambios de estado operativo
- Detectar eventos de dominio
- Monitorear coherencia

### 5.2 Analíticas

Las señales pueden alimentar:
- Dashboards de monitoreo
- Alertas de coherencia
- Métricas de uso

### 5.3 Integración con Sistema General

Cuando exista infraestructura general de señales (2 carriles), se integrará con ella.

---

## 6. Uso en el Código

```javascript
import { emitStudentSignal } from '../core/student/signals/student-signal-emitter.js';

// Emitir señal
await emitStudentSignal('student.operational.paused', {
  student_id: studentId,
  pause_profile_key: profileKey,
  source: 'subscription',
  reason: 'Suscripción pausada',
  trace_id: traceId
});
```

---

## 7. Versionado y Deprecación

- Las señales se versionan con `version: 'v1'`
- Para deprecar: `deprecated: 'v2'` (cuando se deprecó)
- El emitter ignora señales deprecadas

---

## 8. Extensión

Para añadir nuevas señales:
1. Añadir entrada en `STUDENT_SIGNAL_REGISTRY`
2. Documentar payload esperado
3. Actualizar este documento
4. Integrar emisión en el código correspondiente


