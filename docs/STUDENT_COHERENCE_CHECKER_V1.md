# STUDENT_COHERENCE_CHECKER_V1.md — Verificador de Coherencia del Alumno SOT

**Versión**: v1  
**Fecha**: 2025-01-XX

---

## 1. Propósito

El Student Coherence Checker v1 verifica invariantes del Student SOT y clasifica el estado de coherencia:
- **NORMAL**: Todo coherente, sistema opera normalmente
- **DEGRADED**: Problemas menores, sistema puede operar con precaución (fail-open seguro)
- **BROKEN**: Problemas críticos, sistema debe bloquear escrituras peligrosas

---

## 2. Invariantes Verificadas v1

### 2.1 Invariantes Críticas (BROKEN si fallan)

#### STUDENT_MISSING
- **Código**: `STUDENT_MISSING`
- **Severidad**: `critical`
- **Descripción**: No existe registro en `students` para el `student_id`
- **Impacto**: El alumno no tiene identidad ontológica

#### OPERATIONAL_STATE_MISMATCH
- **Código**: `OPERATIONAL_STATE_MISMATCH`
- **Severidad**: `critical`
- **Descripción**: `operational_state.student_id` no coincide con `student.id`
- **Impacto**: Referencia rota entre tablas

### 2.2 Invariantes de Error (DEGRADED si fallan)

#### OPERATIONAL_STATE_MISSING
- **Código**: `OPERATIONAL_STATE_MISSING`
- **Severidad**: `error`
- **Descripción**: No existe estado operativo para el student
- **Impacto**: No se puede determinar cómo opera el alumno

#### PAUSED_WITHOUT_PROFILE
- **Código**: `PAUSED_WITHOUT_PROFILE`
- **Severidad**: `error`
- **Descripción**: Estado PAUSED sin perfil de pausa asociado
- **Impacto**: No se pueden determinar efectos de pausa

#### PAUSED_PROFILE_INVALID
- **Código**: `PAUSED_PROFILE_INVALID`
- **Severidad**: `error`
- **Descripción**: Perfil de pausa sin `definition` válida
- **Impacto**: No se pueden aplicar efectos de pausa

#### INVALID_ONTOLOGICAL_STATUS
- **Código**: `INVALID_ONTOLOGICAL_STATUS`
- **Severidad**: `error`
- **Descripción**: Estado ontológico inválido (no es NORMAL/DEGRADED/BROKEN)
- **Impacto**: Estado del sistema inconsistente

#### INVALID_OPERATIONAL_STATE
- **Código**: `INVALID_OPERATIONAL_STATE`
- **Severidad**: `error`
- **Descripción**: Estado operativo inválido (no es ACTIVE/PAUSED/SUSPENDED)
- **Impacto**: No se puede determinar comportamiento

#### PAUSED_WITHOUT_PROFILE_KEY
- **Código**: `PAUSED_WITHOUT_PROFILE_KEY`
- **Severidad**: `error`
- **Descripción**: Estado PAUSED sin `pause_profile_key`
- **Impacto**: No se puede aplicar perfil de pausa

### 2.3 Invariantes de Warning (DEGRADED si hay varios)

#### NO_ACTIVE_MEMBERSHIP
- **Código**: `NO_ACTIVE_MEMBERSHIP`
- **Severidad**: `warning`
- **Descripción**: No hay membresía activa para ningún producto
- **Impacto**: El alumno no tiene acceso activo

#### NO_MEMBERSHIPS
- **Código**: `NO_MEMBERSHIPS`
- **Severidad**: `warning`
- **Descripción**: No hay membresías de producto registradas
- **Impacto**: El alumno no está inscrito a ningún producto

#### ACTIVE_LIMIT_EXCEEDED
- **Código**: `ACTIVE_LIMIT_EXCEEDED`
- **Severidad**: `warning`
- **Descripción**: Dominio tiene más ítems activos que el límite permitido
- **Impacto**: Violación de política de dominio

---

## 3. Clasificación de Status

### 3.1 NORMAL
- No hay issues o solo warnings menores
- Sistema opera normalmente

### 3.2 DEGRADED
- Hay issues de severidad `error` o múltiples `warning`
- Sistema puede operar con precaución (fail-open seguro)
- Bloquea escrituras peligrosas

### 3.3 BROKEN
- Hay issues de severidad `critical`
- Sistema debe bloquear escrituras peligrosas
- Solo permite lectura y acciones del Master

---

## 4. Señales Emitidas

El checker emite señales automáticamente:
- `student.coherence.degraded`: Cuando status = DEGRADED
- `student.coherence.broken`: Cuando status = BROKEN
- `student.sot.invariant_violation_detected`: Por cada issue crítico o error

---

## 5. Uso

```javascript
import { checkStudentCoherence } from '../core/student/coherence/student-coherence-checker.js';

const result = await checkStudentCoherence({
  student,
  operational_state,
  memberships,
  policies,
  item_state_summary,
  audit_summary
});

if (result.status === 'BROKEN') {
  // Bloquear escrituras peligrosas
}
```

---

## 6. Extensión

Para añadir nuevos invariantes:
1. Añadir verificación en `checkStudentCoherence`
2. Añadir issue con código único
3. Documentar en este archivo
4. Ajustar clasificación de status si es necesario


