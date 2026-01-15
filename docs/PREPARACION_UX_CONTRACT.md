# Preparación UX Contract (Alquimia General)

**Fecha:** 2025-01-27  
**Versión:** 5.74.2  
**Estado:** DIAGNÓSTICO COMPLETO  
**Dominio:** MASTER (AuriPortal)

---

## Resumen Ejecutivo

Este documento identifica qué contratos faltan, qué campos deberían ser obligatorios, y qué estados no están formalizados para diseñar el UX Contract de Alquimia General.

**Total de contratos faltantes:** 8  
**Total de campos que deberían ser obligatorios:** 12  
**Total de estados no formalizados:** 3

---

## Contratos Faltantes

### 1. Contrato de Estados (State Contract)

**Problema:** Los estados no están formalizados en un contrato explícito.

**Estados actuales:**
- RECURRENTE: `never`, `reviewed`, `pending`, `important`
- UNA_VEZ: `never`, `in_progress`, `completed`, `empowered`
- EFFECTIVE: Proyección de shared+pde (no formalizado)

**Contrato necesario:**
```typescript
interface StateContract {
  // RECURRENTE
  never: {
    label: "Nunca",
    description: "Nunca se ha limpiado este item",
    color: "#cbd5e1",
    icon: "⚪",
    actions: ["limpiar"]
  };
  reviewed: {
    label: "Revisado",
    description: "Limpiado dentro del umbral (${threshold_days} días)",
    color: "#86efac",
    icon: "🟢",
    actions: [] // Idempotencia diaria
  };
  pending: {
    label: "Pendiente",
    description: "Limpiado hace ${days} días (entre ${threshold_days} y ${critical_threshold} días)",
    color: "#fde047",
    icon: "🟡",
    actions: ["limpiar"]
  };
  important: {
    label: "Importante Revisar",
    description: "Limpiado hace ${days} días (más de ${critical_threshold} días, umbral crítico)",
    color: "#fca5a5",
    icon: "🔴",
    actions: ["limpiar"]
  };
  
  // UNA_VEZ
  in_progress: {
    label: "En Proceso",
    description: "Completado ${combo_count}/${required_count} veces",
    color: "#fde047",
    icon: "🟡",
    actions: ["+1"]
  };
  completed: {
    label: "Completado",
    description: "Completado ${combo_count}/${required_count} veces (objetivo alcanzado)",
    color: "#86efac",
    icon: "✅",
    actions: ["+1"] // Infinito
  };
  empowered: {
    label: "Potenciado",
    description: "Completado ${combo_count} veces (${required_count * 10}+, excedente: ${excedente})",
    color: "#a78bfa",
    icon: "🟣",
    actions: ["+1"] // Infinito
  };
  
  // EFFECTIVE (RECURRENTE)
  effective: {
    label: "Effective",
    description: "Revisado si AMBAS capas (shared y pde) están revisadas",
    color: "#f59e0b",
    icon: "🟠",
    sources: {
      shared: boolean,
      pde: boolean
    },
    actions: ["limpiar_shared", "limpiar_pde", "limpiar_ambos"]
  };
}
```

**Campos requeridos:**
- `label`: Texto visible
- `description`: Explicación completa
- `color`: Color canónico
- `icon`: Emoji/icono canónico
- `actions`: Lista de acciones disponibles

---

### 2. Contrato de Acciones (Action Contract)

**Problema:** Las acciones no están formalizadas en un contrato explícito.

**Acciones actuales:**
- `limpiar_shared` (item/estudiante)
- `limpiar_pde` (item/estudiante)
- `limpiar_ambos` (estudiante)
- `increment_all` (item)
- `reset_item` (estudiante)
- `reset_list` (estudiante)

**Contrato necesario:**
```typescript
interface ActionContract {
  id: string;
  label: string;
  description: string;
  icon?: string;
  endpoint: string;
  method: "POST" | "DELETE" | "PUT";
  payload: {
    required: string[];
    optional: string[];
    defaults: Record<string, any>;
  };
  validations: {
    item_kind?: ("recurrente" | "una_vez")[];
    clean_layer?: ("shared" | "pde")[];
    view_layer?: ("shared" | "pde" | "combo" | "effective")[];
    scope?: ("all" | "student")[];
  };
  refresh: {
    surfaces: ("proyeccion" | "items" | "flotante")[];
    use_refresh_engine: boolean;
    mutation_type?: string;
  };
  feedback: {
    success: string;
    error: string;
    warning?: string;
  };
}
```

**Ejemplo:**
```typescript
const limpiarSharedEstudiante: ActionContract = {
  id: "limpiar_shared_estudiante",
  label: "Limpiar Shared",
  description: "Marca este item como limpiado en la capa Shared para este estudiante",
  icon: "✓",
  endpoint: "/master/api/alquimia-general/items/${item_ref}/master/mark-clean-student",
  method: "POST",
  payload: {
    required: ["student_uuid", "item_ref", "item_kind", "clean_layer"],
    optional: ["actor_type", "surface_key"],
    defaults: {
      clean_layer: "shared",
      actor_type: "master",
      surface_key: "master.alquimia_general"
    }
  },
  validations: {
    item_kind: ["recurrente", "una_vez"],
    clean_layer: ["shared"]
  },
  refresh: {
    surfaces: ["proyeccion", "items", "flotante"],
    use_refresh_engine: true,
    mutation_type: "alquimia.clean.student"
  },
  feedback: {
    success: "✓ ${displayName} limpiado",
    error: "ERROR: ${error.message} (trace_id=${trace_id})"
  }
};
```

---

### 3. Contrato de Textos (Text Contract)

**Problema:** Los textos no están centralizados ni formalizados.

**Textos actuales:** Dispersos en el código (líneas 3307-3320, 1707, etc.)

**Contrato necesario:**
```typescript
interface TextContract {
  states: {
    [stateKey: string]: {
      label: string;
      description: string;
      short: string; // Para tooltips
    };
  };
  metrics: {
    reviewed_pct: string;
    by_state_counts: string;
  };
  remaining: {
    never: string;
    faltan: string;
    completado: string;
    excedente: string;
  };
  actions: {
    [actionId: string]: {
      label: string;
      description: string;
      tooltip: string;
    };
  };
  feedback: {
    success: {
      [actionId: string]: string;
    };
    error: {
      [errorCode: string]: string;
    };
    warning: {
      [warningCode: string]: string;
    };
  };
}
```

**Ejemplo:**
```typescript
const textContract: TextContract = {
  states: {
    never: {
      label: "Nunca",
      description: "Nunca se ha limpiado este item",
      short: "Nunca limpiado"
    },
    reviewed: {
      label: "Revisado",
      description: "Limpiado dentro del umbral",
      short: "Revisado"
    },
    // ...
  },
  remaining: {
    never: "Nunca",
    faltan: "Faltan ${faltan} para completar (requerido: ${requiredCount})",
    completado: "Completado: ${cleanCount}/${requiredCount}",
    excedente: "Excedente: ${excedente} sobre ${requiredCount} requerido"
  },
  // ...
};
```

---

### 4. Contrato de Validaciones (Validation Contract)

**Problema:** Las validaciones no están centralizadas ni formalizadas.

**Validaciones actuales:** Dispersas en handlers (líneas 2095-2115, 3330-3370, etc.)

**Contrato necesario:**
```typescript
interface ValidationContract {
  item_ref: {
    required: true;
    type: "string";
    pattern?: RegExp;
    error: "ERROR: Item sin item_ref. Acción bloqueada.";
  };
  item_kind: {
    required: true;
    type: "enum";
    values: ["recurrente", "una_vez"];
    error: "ERROR: item_kind no definido. Acción bloqueada.";
  };
  clean_layer: {
    required: true;
    type: "enum";
    values: ["shared", "pde"];
    error: "ERROR: clean_layer no definido. Acción bloqueada.";
  };
  student_uuid: {
    required: true;
    type: "uuid";
    pattern?: RegExp;
    error: "ERROR: Datos incompletos. Acción bloqueada.";
  };
  // ...
}
```

---

### 5. Contrato de Refresh (Refresh Contract)

**Problema:** El refresh no está formalizado en un contrato explícito.

**Refresh actual:** Adapter manual (líneas 5978-6109)

**Contrato necesario:**
```typescript
interface RefreshContract {
  mutation_type: string;
  surfaces_affected: ("proyeccion" | "items" | "flotante")[];
  get_endpoints: {
    proyeccion?: string;
    items?: string;
    flotante?: string;
  };
  invalidate: {
    proyeccion?: boolean;
    items?: boolean;
    flotante?: boolean;
  };
  preserve_state: {
    view_layer?: boolean;
    layerView?: boolean;
    scope?: boolean;
  };
}
```

---

### 6. Contrato de Overrides (Override Contract)

**Problema:** Los overrides no están formalizados en un contrato explícito.

**Overrides actuales:** Dispersos en handlers (líneas 3868-4430)

**Contrato necesario:**
```typescript
interface OverrideContract {
  keys: ("nivel" | "nombre" | "descripcion" | "threshold_days" | "required_count" | "veces_limpiar")[];
  validations: {
    nivel: {
      min: 1;
      max: 9;
      error: "nivel debe ser entre 1 y 9";
    };
    threshold_days: {
      min: 1;
      error: "threshold_days debe ser >= 1";
    };
    required_count: {
      min: 0;
      error: "required_count debe ser >= 0";
    };
    veces_limpiar: {
      min: 0;
      error: "veces_limpiar debe ser >= 0";
    };
  };
  endpoint: string;
  refresh: {
    surfaces: ("flotante")[];
    preserve_layerView: boolean;
  };
}
```

---

### 7. Contrato de Navegación (Navigation Contract)

**Problema:** La navegación no está formalizada en un contrato explícito.

**Navegación actual:** Cambios directos de estado (líneas 1511, 1534, 998)

**Contrato necesario:**
```typescript
interface NavigationContract {
  view_layer: {
    values: ("shared" | "pde" | "combo" | "effective")[];
    default: "shared";
    depends_on: {
      item_kind: {
        recurrente: ("shared" | "pde" | "effective")[];
        una_vez: ("shared" | "pde" | "combo")[];
      };
    };
    refresh: {
      endpoint: string;
      surfaces: ("proyeccion" | "flotante")[];
    };
  };
  scope: {
    values: ("all" | "student")[];
    default: "all";
    depends_on: {
      view_mode: {
        proyeccion: ("all" | "student")[];
        operativa: ("all")[];
      };
    };
    refresh: {
      endpoint: string;
      surfaces: ("proyeccion")[];
    };
  };
  // ...
}
```

---

### 8. Contrato de Feedback (Feedback Contract)

**Problema:** El feedback no está formalizado en un contrato explícito.

**Feedback actual:** Toasts dispersos (líneas 3478, 2153, etc.)

**Contrato necesario:**
```typescript
interface FeedbackContract {
  type: "toast" | "warning" | "error" | "modal";
  position?: "top" | "bottom" | "center";
  duration?: number;
  dismissible?: boolean;
  actions?: {
    label: string;
    action: () => void;
  }[];
  templates: {
    [key: string]: string;
  };
}
```

---

## Campos que Deberían Ser Obligatorios

### Backend → Frontend

1. **`item_kind`** (obligatorio)
   - **Ubicación:** Todos los endpoints que devuelven items
   - **Tipo:** `"recurrente" | "una_vez"`
   - **Validación:** Debe estar presente, no puede ser `null` o `undefined`

2. **`state_by_view_layer`** (obligatorio)
   - **Ubicación:** Todos los endpoints que devuelven estudiantes
   - **Tipo:** `Record<view_layer, StateData>`
   - **Validación:** Debe incluir al menos `shared` y `pde` (y `combo`/`effective` si aplica)

3. **`display_name`** (obligatorio)
   - **Ubicación:** Todos los endpoints que devuelven estudiantes
   - **Tipo:** `string`
   - **Validación:** No puede ser `null`, `undefined` o vacío

4. **`clean_count`** (obligatorio)
   - **Ubicación:** `state_by_view_layer[view_layer].clean_count`
   - **Tipo:** `number`
   - **Validación:** Debe ser `>= 0`, no puede ser `null` o `undefined`

5. **`remaining`** (obligatorio)
   - **Ubicación:** `state_by_view_layer[view_layer].remaining`
   - **Tipo:** `number | null`
   - **Validación:** Debe ser `>= 0` o `null` explícito, no puede ser `undefined`

6. **`days_since_last_clean`** (obligatorio para RECURRENTE)
   - **Ubicación:** `state_by_view_layer[view_layer].days_since_last_clean`
   - **Tipo:** `number | null`
   - **Validación:** Debe ser `>= 0` o `null` explícito, no puede ser `undefined`

7. **`state`** (obligatorio para RECURRENTE)
   - **Ubicación:** `state_by_view_layer[view_layer].state`
   - **Tipo:** `"never" | "reviewed" | "pending" | "important"`
   - **Validación:** Debe estar presente, no puede ser `null` o `undefined`

8. **`visual_state`** (obligatorio para UNA_VEZ)
   - **Ubicación:** `state_by_view_layer[view_layer].visual_state`
   - **Tipo:** `"never" | "in_progress" | "completed" | "empowered"`
   - **Validación:** Debe estar presente, no puede ser `null` o `undefined`

9. **`effective_sources`** (obligatorio para EFFECTIVE)
   - **Ubicación:** `state_by_view_layer.effective.effective_sources`
   - **Tipo:** `{ shared: boolean, pde: boolean }`
   - **Validación:** Debe estar presente, no puede ser `null` o `undefined`

10. **`effective.state`** (obligatorio para EFFECTIVE)
    - **Ubicación:** `state_by_view_layer.effective.state`
    - **Tipo:** `"never" | "reviewed" | "pending" | "important"`
    - **Validación:** Debe estar presente, no puede ser `null` o `undefined`

11. **`item_ref`** (obligatorio)
    - **Ubicación:** Todos los endpoints que devuelven items
    - **Tipo:** `string`
    - **Validación:** Debe estar presente, no puede ser `null`, `undefined` o vacío

12. **`required_count`** (obligatorio para UNA_VEZ)
    - **Ubicación:** `normalized.required_count` o `item.veces_limpiar`
    - **Tipo:** `number`
    - **Validación:** Debe ser `>= 0`, no puede ser `null` o `undefined`

---

## Estados No Formalizados

### 1. `effective` (RECURRENTE)

**Estado actual:** Proyección calculada en frontend (línea 2980-2996)

**Problema:** No está formalizado como estado canónico.

**Formalización necesaria:**
```typescript
interface EffectiveState {
  state: "never" | "reviewed" | "pending" | "important";
  effective_sources: {
    shared: boolean;
    pde: boolean;
  };
  computed_state: {
    shared_days: number | null;
    pde_days: number | null;
    shared_state: "never" | "reviewed" | "pending" | "important";
    pde_state: "never" | "reviewed" | "pending" | "important";
  };
}
```

**Regla:** Backend debe calcular y devolver `state_by_view_layer.effective` completo.

---

### 2. `empowered` (UNA_VEZ)

**Estado actual:** Calculado desde `combo_count >= required_count * 10`

**Problema:** El umbral `* 10` está hardcoded, no está formalizado.

**Formalización necesaria:**
```typescript
interface EmpoweredState {
  state: "empowered";
  combo_count: number;
  required_count: number;
  empowered_threshold: number; // required_count * empowered_multiplier
  empowered_multiplier: number; // Configurable, default 10
  excedente: number; // combo_count - required_count
}
```

**Regla:** Backend debe devolver `empowered_threshold` y `empowered_multiplier` desde configuración.

---

### 3. `no_aplica` (Nivel)

**Estado actual:** Sección colapsable en flotante (línea 2757)

**Problema:** No está formalizado como estado canónico.

**Formalización necesaria:**
```typescript
interface NoAplicaState {
  reason: "nivel" | "pausado" | "archivado";
  nivel_efectivo: number;
  item_nivel: number;
  message: string; // "nivel ${nivel_efectivo} < item nivel ${item_nivel}"
}
```

**Regla:** Backend debe devolver `students_no_aplica` con estructura formalizada.

---

## Checklist para UX Contract

### Contratos a Crear

- [ ] State Contract (estados formales)
- [ ] Action Contract (acciones formales)
- [ ] Text Contract (textos centralizados)
- [ ] Validation Contract (validaciones centralizadas)
- [ ] Refresh Contract (refresh formalizado)
- [ ] Override Contract (overrides formales)
- [ ] Navigation Contract (navegación formalizada)
- [ ] Feedback Contract (feedback formalizado)

### Campos Obligatorios a Validar

- [ ] `item_kind` siempre presente
- [ ] `state_by_view_layer` siempre presente
- [ ] `display_name` siempre presente
- [ ] `clean_count` siempre presente (no `undefined`)
- [ ] `remaining` siempre presente (no `undefined`)
- [ ] `days_since_last_clean` siempre presente (no `undefined`)
- [ ] `state` siempre presente (RECURRENTE)
- [ ] `visual_state` siempre presente (UNA_VEZ)
- [ ] `effective_sources` siempre presente (EFFECTIVE)
- [ ] `effective.state` siempre presente (EFFECTIVE)
- [ ] `item_ref` siempre presente
- [ ] `required_count` siempre presente (UNA_VEZ)

### Estados a Formalizar

- [ ] `effective` (RECURRENTE) - Backend debe calcular
- [ ] `empowered` (UNA_VEZ) - Umbral configurable
- [ ] `no_aplica` (Nivel) - Estructura formalizada

---

## Priorización

### Fase 1 (Crítico)
1. Validar campos obligatorios en backend
2. Formalizar estados `effective`, `empowered`, `no_aplica`
3. Crear State Contract

### Fase 2 (Importante)
4. Crear Action Contract
5. Crear Text Contract
6. Crear Validation Contract

### Fase 3 (Mejora)
7. Crear Refresh Contract
8. Crear Override Contract
9. Crear Navigation Contract
10. Crear Feedback Contract

---

**FIN DE PREPARACIÓN UX CONTRACT**
