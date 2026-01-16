# UX GOVERNANCE - CLARIFICACIÓN CONSTITUCIONAL v1

**Fecha**: 2024  
**Estado**: CLARIFICACIÓN CANÓNICA  
**Contexto**: Post-cierre UX Governance / Capabilities v1

---

## 🎯 PRINCIPIO FUNDAMENTAL

**UX Action Registry ≠ Student Capability Registry**

Estos dos registries tienen propósitos **ONTOLÓGICAMENTE DIFERENTES** y **NO SE MEZCLAN**.

---

## 📋 UX ACTION REGISTRY v1

### Propósito
Registry canónico de **acciones UX** (mutaciones desde UI).

### Qué Registra
- **Acciones de mutación** desde UI (limpiar, resetear, crear, eliminar)
- **Contratos formales** de cada acción (endpoint, payload, refresh plan)
- **Validaciones de schema** (`allowed_item_kinds`, `allowed_layers`, `allowed_scopes`)

### Cuándo Se Usa
- **En runtime** cuando UI ejecuta mutaciones (`performAction()`)
- **Validación dura** de payload contra schema de acción
- **Validación de dominio** (master/god/admin_legacy)

### Ejemplo
```javascript
// Acción registrada
registerAction({
  action_id: 'alquimia.clean',
  domain: 'master',
  allowed_item_kinds: ['recurrente', 'una_vez'],
  allowed_layers: ['shared', 'pde'],
  allowed_scopes: ['student', 'all'],
  handler: { ... },
  refresh: buildRefreshPlan
});

// Uso en UI
await performAction({
  action_id: 'alquimia.clean',
  payload: {
    item_ref: 'item_123',
    item_kind: 'recurrente', // Validado contra allowed_item_kinds
    clean_layer: 'shared',   // Validado contra allowed_layers
    scope: 'student'         // Validado contra allowed_scopes
  }
});
```

### Validaciones
- ✅ `allowed_item_kinds`: Valida que `payload.item_kind` esté permitido
- ✅ `allowed_layers`: Valida que `payload.clean_layer` esté permitido
- ✅ `allowed_scopes`: Valida que `payload.scope` esté permitido
- ✅ `domain`: Valida que acción sea del dominio correcto (master/god/admin_legacy)

---

## 📋 STUDENT CAPABILITY REGISTRY v1

### Propósito
Registry canónico de **capabilities ontológicas** del estudiante (qué puede hacer el estudiante como entidad).

### Qué Registra
- **Capabilities ontológicas** del estudiante (can_progress, can_update_streaks, etc.)
- **Definiciones formales** de cada capability (descripción, default, categoría)
- **Estado de deprecación** de capabilities

### Cuándo Se Usa
- **En runtime** cuando se evalúa si un estudiante puede realizar una operación
- **Validación de capabilities** antes de ejecutar operaciones del dominio
- **NO se usa en performAction()** (no es validación de acción UX)

### Ejemplo
```javascript
// Capability registrada
STUDENT_CAPABILITY_REGISTRY = {
  can_progress: {
    key: 'can_progress',
    description: 'Permite que el alumno avance en progreso general',
    default: true,
    category: 'progress'
  },
  can_clean_domain_items: {
    key: 'can_clean_domain_items',
    description: 'Permite limpiar ítems de dominios',
    default: true,
    category: 'write'
  }
};

// Uso en dominio (NO en performAction)
if (!hasCapability(student, 'can_clean_domain_items')) {
  throw new Error('Estudiante no puede limpiar items');
}
```

### Validaciones
- ✅ `isValidCapability()`: Valida que capability existe y está activa
- ✅ `getCapabilityDefinition()`: Obtiene definición de capability
- ✅ **NO valida payload de acciones UX** (eso es UX Action Registry)

---

## 🔍 DIFERENCIAS CLAVE

### 1. Propósito Ontológico

| Aspecto | UX Action Registry | Student Capability Registry |
|---------|-------------------|---------------------------|
| **Qué registra** | Acciones UX (mutaciones) | Capabilities ontológicas del estudiante |
| **Cuándo se valida** | En `performAction()` (runtime de acción) | En dominio (runtime de operación) |
| **Qué valida** | Schema de payload (item_kind, layer, scope) | Si estudiante puede hacer operación |
| **Dónde se usa** | Frontend (UI) | Backend (dominio) |

### 2. Validaciones

**UX Action Registry valida**:
- ✅ `allowed_item_kinds`: ¿Este tipo de acción permite este `item_kind`?
- ✅ `allowed_layers`: ¿Este tipo de acción permite este `clean_layer`?
- ✅ `allowed_scopes`: ¿Este tipo de acción permite este `scope`?
- ✅ `domain`: ¿Esta acción es del dominio correcto?

**Student Capability Registry valida**:
- ✅ `can_progress`: ¿Este estudiante puede avanzar en progreso?
- ✅ `can_clean_domain_items`: ¿Este estudiante puede limpiar items?
- ✅ `can_write_domain_state`: ¿Este estudiante puede modificar estado?

### 3. Nivel de Abstracción

**UX Action Registry**:
- Nivel: **Acción específica** (alquimia.clean, alquimia.reset)
- Granularidad: **Por acción UX**
- Ejemplo: "¿La acción `alquimia.clean` permite `item_kind='una_vez'`?"

**Student Capability Registry**:
- Nivel: **Capability ontológica** (can_progress, can_clean_domain_items)
- Granularidad: **Por capacidad del estudiante**
- Ejemplo: "¿Este estudiante puede limpiar items de dominios?"

---

## ⚠️ PROHIBICIONES ABSOLUTAS

### ❌ PROHIBIDO: Mezclar Validaciones

```javascript
// ❌ PROHIBIDO: Validar capabilities en performAction()
async function performAction({ action_id, payload }) {
  // ❌ NO hacer esto
  if (!hasCapability(student, 'can_clean_domain_items')) {
    throw new Error('Estudiante no puede limpiar');
  }
  // ...
}
```

**Razón**: `performAction()` valida **schema de acción**, no **capabilities del estudiante**. Las capabilities se validan en el **dominio**, no en la UI.

### ❌ PROHIBIDO: Usar allowed_* como Capabilities

```javascript
// ❌ PROHIBIDO: Interpretar allowed_item_kinds como capability
if (!action.allowed_item_kinds.includes('recurrente')) {
  // Esto NO es validación de capability, es validación de schema
}
```

**Razón**: `allowed_item_kinds` es **validación de schema**, no **capability del estudiante**. Valida que el payload sea correcto para la acción, no que el estudiante pueda hacerlo.

### ❌ PROHIBIDO: Validar Capabilities en Action Registry

```javascript
// ❌ PROHIBIDO: Añadir required_capabilities en Action Registry
registerAction({
  action_id: 'alquimia.clean',
  required_capabilities: ['can_clean_domain_items'], // ❌ NO
  // ...
});
```

**Razón**: Las capabilities se validan en el **dominio**, no en el **Action Registry**. El Action Registry solo valida **schema de payload**.

---

## ✅ USO CORRECTO

### Ejemplo 1: Validación de Schema (UX Action Registry)

```javascript
// ✅ CORRECTO: Validar schema en performAction()
async function performAction({ action_id, payload }) {
  const actionDef = getAction(action_id);
  
  // Validar allowed_item_kinds (schema)
  if (actionDef.allowed_item_kinds && !actionDef.allowed_item_kinds.includes(payload.item_kind)) {
    throw new Error(`item_kind "${payload.item_kind}" no permitido`);
  }
  
  // Validar allowed_layers (schema)
  if (actionDef.allowed_layers && !actionDef.allowed_layers.includes(payload.clean_layer)) {
    throw new Error(`clean_layer "${payload.clean_layer}" no permitido`);
  }
  
  // Ejecutar acción
  await fetch(endpoint, { method: 'POST', body: JSON.stringify(payload) });
}
```

### Ejemplo 2: Validación de Capability (Student Capability Registry)

```javascript
// ✅ CORRECTO: Validar capability en dominio
async function markCleanStudent(student_uuid, item_ref, clean_layer) {
  // Validar capability del estudiante
  const student = await getStudent(student_uuid);
  if (!hasCapability(student, 'can_clean_domain_items')) {
    throw new Error('Estudiante no puede limpiar items');
  }
  
  // Ejecutar limpieza
  await cleaningEngine.markClean(student_uuid, item_ref, clean_layer);
}
```

---

## 📐 REGLA CONSTITUCIONAL FINAL

**UX Action Registry valida SCHEMA de acciones UX.  
Student Capability Registry valida CAPABILITIES ontológicas del estudiante.**

**NO SE MEZCLAN. NO SE SUSTITUYEN. SON COMPLEMENTARIOS.**

---

**FIN DE LA CLARIFICACIÓN**
