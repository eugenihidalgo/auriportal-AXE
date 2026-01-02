# STUDENT_CONTEXT_CONTRACT_V1.md — Contrato Estable del Contexto del Alumno

**Versión del Contrato**: v1  
**Fecha**: 2025-01-XX

---

## 1. Principio Fundamental

El Student Context Contract v1 define el **shape estable** que `buildStudentContext()` debe devolver.

**REGLA CONSTITUCIONAL**: Contextos, Automatizaciones y UIs futuras solo pueden depender de campos del contrato. Prohibido depender de repos/DB directamente.

---

## 2. Shape del Contrato v1

```typescript
{
  contract_version: "v1",
  student: {
    id: string,              // UUID del student
    status: "NORMAL" | "DEGRADED" | "BROKEN",
    created_at: string,      // ISO timestamp
    updated_at: string,      // ISO timestamp
    legacy_alumno_id: number | null
  },
  operational_state: {
    state: "ACTIVE" | "PAUSED" | "SUSPENDED",
    pause_profile: {
      key: string,
      definition: {
        level_progression?: "freeze" | "continue",
        streaks?: "freeze" | "continue",
        contexts?: "block_new" | "allow",
        automations?: "block_progression" | "allow",
        penalties?: "disable" | "enable",
        manual_actions?: "allow" | "block",
        master_actions?: "allow" | "block"
      }
    } | null,
    reason: string | null,
    source: "subscription" | "master" | "system",
    started_at: string       // ISO timestamp
  } | null,
  membership: {
    product_key: string,
    status: "active" | "paused" | "archived",
    joined_at: string        // ISO timestamp
  } | null,
  domains: {
    [domainKey: string]: {
      active_limit: number,
      active_limit_override: number | null,
      can_activate_multiple: boolean,
      active_count: number,
      active_items: Array<{
        item_id: string,
        is_clean: boolean,
        clean_count: number,
        last_cleaned_at: string | null
      }>,
      all_items_count: number
    }
  },
  streaks: {
    current: number,
    longest: number,
    frozen: boolean
  },
  capabilities: {
    can_progress: boolean,
    can_compute_level: boolean,
    can_update_streaks: boolean,
    can_trigger_automations: boolean,
    can_activate_contexts: boolean,
    can_run_resolvers: boolean,
    can_access_student_portal: boolean,
    can_write_domain_state: boolean,
    can_master_override: boolean,
    can_receive_notifications: boolean,
    has_active_membership: boolean
  },
  coherence: {
    status: "NORMAL" | "DEGRADED" | "BROKEN",
    warnings: Array<string>,
    issues: Array<{
      code: string,
      severity: "warning" | "error" | "critical",
      message: string,
      meta: Object
    }>
  }
}
```

---

## 3. Campos Obligatorios

Todos los campos del contrato deben estar presentes, incluso si son `null` o valores por defecto.

---

## 4. Versionado

El campo `contract_version` permite evolución del contrato sin romper consumidores existentes.

**Regla**: Si se añaden campos nuevos, incrementar versión. Consumidores deben verificar versión antes de usar campos nuevos.

---

## 5. Consumidores del Contrato

### 5.1 Contextos PDE
- Leen `capabilities` para decidir qué mostrar/permitir
- Leen `operational_state` para ajustar comportamiento
- Leen `domains` para mostrar estado de dominios

### 5.2 Automatizaciones
- Verifican `capabilities.can_trigger_automations` antes de ejecutar
- Verifican `coherence.status` para decidir si proceder
- Leen `operational_state` para ajustar lógica

### 5.3 UIs (Futuras)
- Consumen todo el contexto para renderizar estado completo
- Verifican `coherence.status` para mostrar warnings/errores

---

## 6. Fail-Open Consciente

El contrato siempre se devuelve, incluso si:
- `coherence.status = DEGRADED`: Se devuelve con warnings
- `coherence.status = BROKEN`: Se devuelve con issues críticos
- Faltan datos: Se devuelve con valores por defecto y warnings

Los consumidores deben verificar `coherence.status` antes de confiar en los datos.

---

## 7. Extensión del Contrato

Para añadir campos nuevos:
1. Incrementar `contract_version` (ej. `v2`)
2. Añadir campos nuevos como opcionales inicialmente
3. Documentar en este archivo
4. Actualizar `buildStudentContext` para incluir nuevos campos
5. Migrar consumidores gradualmente

---

## 8. Prohibiciones

- **Prohibido**: Consumidores que leen repos/DB directamente
- **Prohibido**: Consumidores que dependen de campos no documentados en el contrato
- **Prohibido**: Modificar campos existentes sin incrementar versión

---

## 9. Ejemplo de Uso

```javascript
import { getDefaultStudentContextBuilder } from '../core/student/student-context-builder.js';

const builder = getDefaultStudentContextBuilder();
const context = await builder.buildStudentContext(studentId, 'pde');

// Verificar versión del contrato
if (context.contract_version !== 'v1') {
  throw new Error(`Contrato no soportado: ${context.contract_version}`);
}

// Usar capabilities
if (context.capabilities.can_progress) {
  // Permitir progreso
}

// Verificar coherencia
if (context.coherence.status === 'BROKEN') {
  // Bloquear escrituras peligrosas
}
```


