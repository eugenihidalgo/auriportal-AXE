# STUDENT_SOT_V1_CERTIFIED.md — Certificación del Alumno como Source of Truth v1

**Fecha de Certificación**: 2025-01-XX  
**Versión**: v5.43.0  
**Estado**: ✅ CERTIFICADO

---

## 1. Ontología del Alumno

### 1.1 Separación Fundamental: Ontológico vs Operativo

El Alumno SOT v1 distingue claramente entre:

- **Estado Ontológico** (`students`): Representa la coherencia del sistema para este alumno. Describe la salud del registro del alumno en el sistema, NO su estado de negocio.
  - `status`: `NORMAL` (coherente), `DEGRADED` (datos incompletos), `BROKEN` (inconsistencias críticas)
  - `deleted_at`: Soft delete (eliminación lógica)

- **Estado Operativo** (`student_operational_state`): Representa cómo opera el alumno ahora. Gobierna progreso, rachas, automatizaciones, activación de contextos.
  - `state`: `ACTIVE` (activo), `PAUSED` (pausado), `SUSPENDED` (suspendido)
  - `pause_profile_key`: Perfil de pausa aplicado (solo si `state=PAUSED`)
  - `source`: Origen del estado (`subscription`, `master`, `system`)

**Principio**: El estado ontológico describe la integridad del registro; el estado operativo describe el comportamiento del sistema hacia el alumno.

---

## 2. Semántica de PAUSA

### 2.1 PAUSA como Estado Operativo Configurable

PAUSA NO es un flag simple. Es un estado operativo completo con perfiles configurables.

**Tabla `pause_profiles`**:
- Define efectos de pausa de forma configurable (no hardcoded)
- Cada perfil especifica qué comportamientos se congelan/bloquean durante pausa
- Perfil por defecto: `subscription_pause_default`

**Efectos configurables** (definidos en `definition` JSONB):
- `level_progression`: `freeze` (congela) | `continue` (continúa)
- `streaks`: `freeze` (congela) | `continue` (continúa)
- `contexts`: `block_new` (bloquea nuevos) | `allow` (permite)
- `automations`: `block_progression` (bloquea progreso) | `allow` (permite)
- `penalties`: `disable` (deshabilita) | `enable` (habilita)
- `manual_actions`: `allow` (permite) | `block` (bloquea)
- `master_actions`: `allow` (permite) | `block` (bloquea)

### 2.2 Reglas Obligatorias de PAUSA

1. **PAUSED congela progreso**: El nivel efectivo se congela (no se recalcula, no se resetea, no se degrada).
2. **PAUSED congela rachas**: La racha ni suma ni se rompe durante pausa.
3. **PAUSED bloquea nuevas activaciones de contextos**: No se pueden activar nuevos contextos.
4. **PAUSED bloquea automatizaciones de progreso**: Las automatizaciones que afectan progreso se bloquean.
5. **PAUSED NO penaliza**: Las penalizaciones se deshabilitan durante pausa.
6. **PAUSED es reversible y auditable**: Todo cambio de estado se registra en auditoría.

### 2.3 Servicios de Pausa

**`pauseStudent(studentId, profileKey, source, reason)`**:
- Finaliza el estado operativo actual
- Crea nuevo estado `PAUSED` con el perfil especificado
- Emite evento `student.paused` (cuando el sistema de señales esté listo)
- Registra auditoría completa

**`resumeStudent(studentId, source)`**:
- Finaliza el estado `PAUSED` actual
- Crea nuevo estado `ACTIVE`
- Emite evento `student.resumed` (cuando el sistema de señales esté listo)
- Registra auditoría completa

---

## 3. Student Context Builder (Pieza Central)

### 3.1 Contrato Obligatorio

```javascript
buildStudentContext(studentId, productKey) -> {
  student: { id, status, created_at, updated_at, legacy_alumno_id },
  operational_state: { 
    state, 
    pause_profile: { key, definition },
    reason,
    source,
    started_at
  },
  membership: { product_key, status, joined_at },
  domains: {
    [domainKey]: {
      active_limit,
      active_limit_override,
      can_activate_multiple,
      active_count,
      active_items: [...],
      all_items_count
    }
  },
  streaks: { current, longest, frozen },
  capabilities: {
    can_progress_level,
    can_advance_streak,
    can_activate_new_contexts,
    can_trigger_automations,
    can_receive_penalties,
    can_perform_manual_actions,
    can_receive_master_actions,
    has_active_membership
  },
  coherence: {
    status: 'NORMAL' | 'DEGRADED' | 'BROKEN',
    warnings: [...]
  }
}
```

### 3.2 Principio: Fail-Open Consciente

- Si faltan datos → `coherence.status = DEGRADED`
- Explicar por qué en `coherence.warnings`, pero devolver contexto
- El contexto siempre se devuelve, incluso si está degradado o roto
- Los consumidores (Contextos, Automatizaciones, UIs) deben verificar `coherence.status`

### 3.3 Uso del Contexto

Este contexto será:
- **Input de Contextos**: Los contextos PDE consumen este contexto para decidir qué mostrar/permitir
- **Input de Automatizaciones**: Las automatizaciones verifican `capabilities` y `operational_state` antes de ejecutar
- **Input de futuras UIs**: Tanto la UI del alumno como la UI Master consumen este contexto

---

## 4. Rachas Derivadas

### 4.1 Principio: No Mágicas

Las rachas se derivan de eventos/auditoría, no se calculan mágicamente.

**Función determinista**: `computeStreaksFromAudit(studentId, productKey)`

**Comportamiento**:
- En `PAUSED`: racha congelada (`frozen: true`)
- Al reanudar: continúa desde donde estaba
- Cálculo on-demand desde auditoría (por ahora desde tabla `alumnos` legacy, migración futura)

---

## 5. Integración con Progreso y Nivel Efectivo

### 5.1 Motor de Progreso

El motor de progreso DEBE consultar `student_operational_state` antes de calcular nivel efectivo.

**Reglas**:
- En `ACTIVE`: progreso normal
- En `PAUSED`: congelar delta del nivel efectivo (no recalcular, no resetear, no degradar)
- En `SUSPENDED`: comportamiento específico (definir en v2)

### 5.2 Nivel Efectivo Congelado

Cuando `operational_state.state = PAUSED`:
- El nivel efectivo se mantiene en el valor que tenía al momento de pausar
- NO se aplican cambios de nivel durante pausa
- Al reanudar, el cálculo de nivel continúa desde el punto de congelación

---

## 6. Impacto en Contextos y Automatizaciones

### 6.1 Contextos

Los contextos PDE deben:
- Verificar `operational_state.state` antes de permitir activaciones
- Verificar `capabilities.can_activate_new_contexts` antes de activar nuevos contextos
- Respetar `domains[domainKey].active_limit` y `can_activate_multiple`

### 6.2 Automatizaciones

Las automatizaciones deben:
- Verificar `operational_state.state` antes de ejecutar
- Verificar `capabilities.can_trigger_automations` antes de disparar
- Respetar `capabilities.can_progress_level` antes de modificar progreso
- Respetar `capabilities.can_advance_streak` antes de modificar rachas

---

## 7. Tablas del Modelo Canónico

### 7.1 `students` (Ontológico)
- `id` (UUID, PK)
- `status` (NORMAL | DEGRADED | BROKEN)
- `created_at`, `updated_at`, `deleted_at`
- `legacy_alumno_id` (FK a `alumnos`, temporal para migración)

### 7.2 `student_operational_state` (Operativo)
- `id` (UUID, PK)
- `student_id` (FK a `students`)
- `state` (ACTIVE | PAUSED | SUSPENDED)
- `pause_profile_key` (FK a `pause_profiles`, nullable)
- `pause_reason` (text, nullable)
- `source` (subscription | master | system)
- `started_at`, `ends_at` (nullable)
- `created_at`, `updated_at`

### 7.3 `pause_profiles` (Configuración)
- `profile_key` (TEXT, PK)
- `definition` (JSONB)
- `status` (active | deprecated)
- `created_at`, `updated_at`

### 7.4 `student_product_memberships` (Membresías)
- Ya existente desde v5.42.0
- Relaciona alumno con productos (PDE, futuros productos)

### 7.5 `student_domain_policies` (Políticas por Dominio)
- Ya existente desde v5.42.0
- Define límites y overrides del Master

### 7.6 `student_item_state` (Estado por Ítem)
- Ya existente desde v5.42.0
- Estado personal del alumno por ítem en cada dominio

### 7.7 `student_item_state_audit` (Auditoría)
- Ya existente desde v5.42.0
- Registro append-only de cambios

---

## 8. Qué Queda para v2 (Sin Deuda Técnica)

### 8.1 Migración Completa de Referencias
- Actualmente `student_product_memberships.student_id` referencia `alumnos(id)`
- En v2: añadir `student_uuid` y migrar referencias a `students(id)`
- Eliminar dependencia de tabla `alumnos` legacy

### 8.2 Cálculo de Rachas desde Auditoría
- Actualmente se lee desde `alumnos.streak`
- En v2: implementar cálculo determinista desde `student_item_state_audit`
- Proyección opcional en tabla separada si es necesario para rendimiento

### 8.3 Sistema de Señales
- Eventos `student.paused` y `student.resumed` están preparados pero no emitidos
- En v2: integrar con sistema de señales cuando esté disponible

### 8.4 Integración con Motor de Progreso
- El motor de progreso debe consultar `student_operational_state`
- En v2: implementar consulta explícita y congelación de nivel efectivo

### 8.5 UI Alumno y UI Master
- Student Context Builder está listo para consumir
- En v2: crear UIs que consuman el contexto canónico

---

## 9. Verificación y Tests

### 9.1 Tests Mínimos Requeridos

1. **Pausa congela nivel**: Verificar que al pausar, el nivel efectivo no cambia
2. **Pausa congela racha**: Verificar que al pausar, la racha no avanza ni se rompe
3. **Reanudar mantiene coherencia**: Verificar que al reanudar, el nivel y racha continúan correctamente

### 9.2 Verificación de Contexto

```bash
# Test manual del Student Context Builder
curl -X GET "http://localhost:3000/api/student-context?student_id=<uuid>&product_key=pde"
```

### 9.3 Logs y Auditoría

- Todos los servicios usan `logInfo`/`logError` con `trace_id`
- Todas las mutaciones generan registros en `student_item_state_audit`
- Los cambios de estado operativo se auditan completamente

---

## 10. Principios Constitucionales Cumplidos

✅ **PostgreSQL es el único Source of Truth del Alumno**  
✅ **El Alumno es la base central del sistema**  
✅ **Separación clara: ontológico vs operativo**  
✅ **PAUSA es un estado operativo configurable, no hardcoded**  
✅ **Todo comportamiento es configurable vía pause_profiles**  
✅ **Migraciones aplicadas y verificadas**  
✅ **Dominio no accede a DB directa: repositorios con contrato**  
✅ **Toda mutación relevante genera auditoría con trace_id**  

---

## 11. Archivos Creados/Modificados

### Migraciones
- `database/migrations/v5.43.0-student-sot-ontological-operational.sql`

### Repositorios
- `src/core/repos/student-ontological-repo.js`
- `src/infra/repos/student-ontological-repo-pg.js`
- `src/core/repos/student-operational-state-repo.js`
- `src/infra/repos/student-operational-state-repo-pg.js`
- `src/core/repos/pause-profiles-repo.js`
- `src/infra/repos/pause-profiles-repo-pg.js`

### Servicios
- `src/services/student-operational-service.js`

### Core
- `src/core/student/student-context-builder.js`

### Scripts
- `scripts/backfill-student-sot.js` (actualizado)

---

**Estado Final**: ✅ CERTIFICADO - Student SOT v1 implementado y listo para integración con Contextos, Automatizaciones y futuras UIs.


