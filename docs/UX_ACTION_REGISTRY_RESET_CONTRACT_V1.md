# UX ACTION REGISTRY — RESET CONTRACT v1

**Versión**: 1.0.0  
**Fecha**: 2026-01-27  
**Estado**: CONTRATO CANÓNICO (IRREVERSIBLE)

---

## 🎯 PRINCIPIO CONSTITUCIONAL

**Separación absoluta entre UX Scopes y Domain Scopes:**

- `allowed_scopes` = Scopes UX válidos (para validación de contrato UX)
- `payload.reset_scope` = Semántica rica de dominio (para backend)

**REGLA ABSOLUTA:**
- `allowed_scopes` SOLO puede contener scopes UX válidos
- Está PROHIBIDO usar conceptos de dominio backend en `allowed_scopes`
- La semántica rica de reset se expresa EXCLUSIVAMENTE en `payload.reset_scope`

---

## 📋 SCOPES UX VÁLIDOS (LISTA CERRADA)

**Scopes UX permitidos en `allowed_scopes`:**

- `'item'` - Acción sobre un item específico
- `'list'` - Acción sobre una lista específica
- `'all'` - Acción masiva (todos los estudiantes/items)
- `'student'` - Acción sobre un estudiante específico
- `'selection'` - Acción sobre selección múltiple
- `'context'` - Acción contextual

**PROHIBIDO ABSOLUTAMENTE:**
- ❌ `'ITEM_STUDENT'`, `'ITEM_ALL'`, `'LIST_STUDENT'`, `'LIST_ALL'` (conceptos de dominio backend)
- ❌ Cualquier valor que no esté en la lista cerrada de scopes UX válidos

---

## 🔒 DOMAIN SCOPES (SOLO EN PAYLOAD)

**Valores de dominio para `payload.reset_scope`:**

- `'ITEM_STUDENT'` - Reset item para estudiante específico
- `'ITEM_ALL'` - Reset item para todos los estudiantes
- `'LIST_STUDENT'` - Reset lista para estudiante específico
- `'LIST_ALL'` - Reset lista para todos los estudiantes

**REGLA:**
- Estos valores SOLO existen en `payload.reset_scope`
- NUNCA deben aparecer en `allowed_scopes`
- Se validan en `buildPayload`, NO en el registry

---

## ✅ EJEMPLO CORRECTO

```javascript
// ✅ CORRECTO: allowed_scopes con scopes UX válidos
registerAction({
  action_id: 'alquimia.reset',
  domain: 'master',
  description: 'Resetear progreso de item o lista (SOLO recurrente)',
  allowed_item_kinds: ['recurrente'],
  allowed_layers: ['shared', 'pde'],
  allowed_scopes: ['item', 'list', 'all', 'student'], // ✅ UX scopes válidos
  handler: {
    method: 'POST',
    endpointBuilder: buildResetEndpoint,
    buildPayload: (uiState, context) => {
      // ✅ reset_scope es dominio, va en payload
      const payload = {
        reset_scope: context.reset_scope, // 'ITEM_STUDENT' | 'ITEM_ALL' | etc.
        clean_layer: context.clean_layer,
        // ...
      };
      
      // Validaciones de dominio (NO en allowed_scopes)
      if (reset_scope === 'ITEM_STUDENT') {
        if (!student_uuid) {
          throw new Error('student_uuid es obligatorio para reset_scope="ITEM_STUDENT"');
        }
      }
      // ...
      
      return payload;
    }
  },
  refresh: buildRefreshPlan
});
```

**Uso en UI:**
```javascript
// ✅ CORRECTO: reset_scope en payload (dominio)
await performAction({
  action_id: 'alquimia.reset',
  payload: {
    reset_scope: 'ITEM_STUDENT', // ✅ Dominio en payload
    item_ref: 'item-123',
    student_uuid: 'uuid-456',
    clean_layer: 'shared',
    item_kind: 'recurrente'
  }
});
```

---

## ❌ EJEMPLO INCORRECTO

```javascript
// ❌ INCORRECTO: allowed_scopes con conceptos de dominio
registerAction({
  action_id: 'alquimia.reset',
  domain: 'master',
  allowed_scopes: ['ITEM_STUDENT', 'ITEM_ALL', 'LIST_STUDENT', 'LIST_ALL'], // ❌ PROHIBIDO
  // ...
});
```

**Error resultante:**
```
⚠️ RUNTIME BROKEN: [UX_ACTION_REGISTRY] allowed_scopes contiene valor inválido: ITEM_STUDENT
```

---

## 🔍 POR QUÉ ESTA SEPARACIÓN

### 1. Contrato UX vs Contrato Dominio

- **UX Contract**: `allowed_scopes` valida intención de usuario (item, list, all, student)
- **Domain Contract**: `reset_scope` valida semántica de negocio (ITEM_STUDENT, ITEM_ALL, etc.)

### 2. Validación en Capas Correctas

- **Registry (UX)**: Valida que el scope UX es válido (`'item'`, `'list'`, etc.)
- **Payload Builder (Dominio)**: Valida que `reset_scope` es válido (`'ITEM_STUDENT'`, etc.)

### 3. Flexibilidad y Extensibilidad

- Si se añaden nuevos scopes UX, solo se actualiza la lista cerrada
- Si se añaden nuevos reset_scope de dominio, solo se actualiza `buildPayload`
- No hay acoplamiento entre capas

---

## 📐 VALIDACIONES OBLIGATORIAS

### En Registry (UX)

```javascript
// Validación de allowed_scopes (UX)
const validUXScopes = ['item', 'list', 'all', 'student', 'selection', 'context'];
if (!validUXScopes.includes(scope)) {
  throw new Error(`allowed_scopes contiene valor inválido: ${scope}`);
}
```

### En Payload Builder (Dominio)

```javascript
// Validación de reset_scope (Dominio)
const validDomainScopes = ['ITEM_STUDENT', 'ITEM_ALL', 'LIST_STUDENT', 'LIST_ALL'];
if (!validDomainScopes.includes(reset_scope)) {
  throw new Error(`reset_scope inválido: "${reset_scope}"`);
}

// Validaciones condicionales por reset_scope
if (reset_scope === 'ITEM_STUDENT') {
  if (!student_uuid) {
    throw new Error('student_uuid es obligatorio para reset_scope="ITEM_STUDENT"');
  }
}
// ...
```

---

## 🚫 PROHIBICIONES ABSOLUTAS

### 1. NO usar Domain Scopes en allowed_scopes

```javascript
// ❌ PROHIBIDO
allowed_scopes: ['ITEM_STUDENT', 'ITEM_ALL'] // Conceptos de dominio
```

### 2. NO mapear automáticamente

```javascript
// ❌ PROHIBIDO: Mapeo automático de dominio a UX
function mapDomainToUX(domainScope) {
  return domainScope.toLowerCase(); // NO hacer esto
}
```

### 3. NO relajar validaciones

```javascript
// ❌ PROHIBIDO: Fallback silencioso
if (!validUXScopes.includes(scope)) {
  console.warn('Scope inválido, usando default'); // NO hacer esto
  scope = 'item'; // NO hacer esto
}
```

---

## ✅ CHECKLIST OBLIGATORIO

Al crear o modificar una acción de reset:

- [ ] `allowed_scopes` contiene SOLO scopes UX válidos (`'item'`, `'list'`, `'all'`, `'student'`)
- [ ] `payload.reset_scope` contiene valores de dominio (`'ITEM_STUDENT'`, `'ITEM_ALL'`, etc.)
- [ ] Validaciones de dominio están en `buildPayload`, NO en `allowed_scopes`
- [ ] No hay mapeo automático entre dominio y UX
- [ ] No hay fallbacks silenciosos
- [ ] El runtime valida correctamente (no entra en estado BROKEN)

---

## 🔗 REFERENCIAS

- **UX Action Registry Contract**: `docs/UX_ACTION_REGISTRY_CONTRACT_V1.md`
- **Reset Canónico v1**: `docs/ALQUIMIA_RESET_CANONICAL_V1.md`
- **Fix Aplicado**: `docs/FIX_UX_ACTION_REGISTRY_SCOPES_V1.md`

---

## 🚫 REGLA CONSTITUCIONAL FINAL

**A partir de este contrato**:

- 🛑 **`allowed_scopes` SOLO puede contener scopes UX válidos**
- 🛑 **Domain scopes (ITEM_STUDENT, etc.) SOLO existen en `payload.reset_scope`**
- 🛑 **El runtime debe FAIL-LOUD si `allowed_scopes` contiene valores fuera del set UX**

**Este contrato blinda el sistema. NO se puede violar.**

---

**FIN DEL CONTRATO**
