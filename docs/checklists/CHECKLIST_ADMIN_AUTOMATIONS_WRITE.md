# CHECKLIST: Admin UI Automatizaciones (Escritura y Ejecución)
## Verificación Obligatoria para PRs y Cambios (Fase 7)

**Referencia**: `ADMIN_AUTOMATIONS_WRITE_EXECUTION_CONTRACT.md` y `FASE_D_FASE7_RISK_AUDIT.md`

---

## ✅ CHECKLIST OBLIGATORIA

### 1. Creación de Automatizaciones

- [ ] ¿Solo se permite crear con `status = 'draft'`?
- [ ] ¿Se valida que `automation_key` sea único?
- [ ] ¿Se valida la estructura de `definition` (trigger, steps)?
- [ ] ¿Se validan que todos los `action_key` existen en Action Registry?
- [ ] ¿Se registra en audit log con `action: 'create'`?
- [ ] ¿Se incluye `actor: { type: 'admin', id: admin_id }`?

**Si alguna respuesta es NO → VIOLACIÓN DEL CONTRATO**

---

### 2. Edición de Automatizaciones

- [ ] ¿Se valida la versión antes de actualizar (prevenir conflictos)?
- [ ] ¿Se incrementa `version` al actualizar?
- [ ] ¿Se valida `definition` si se actualiza?
- [ ] ¿Se validan `action_key` si se actualiza definition?
- [ ] ¿Se registra en audit log con `action: 'update'`?
- [ ] ¿Se incluye `before` y `after` en audit log?

**Si alguna respuesta es NO → VIOLACIÓN DEL CONTRATO**

---

### 3. Activación de Automatizaciones

- [ ] ¿Solo se permite activar si `status = 'draft'` o `'deprecated'`?
- [ ] ¿Se valida que `definition` es válida antes de activar?
- [ ] ¿Se validan que todos los `action_key` existen?
- [ ] ¿Se registra en audit log con `action: 'activate'`?
- [ ] ¿Se cambia `status` a `'active'`?

**Si alguna respuesta es NO → VIOLACIÓN DEL CONTRATO**

---

### 4. Desactivación de Automatizaciones

- [ ] ¿Solo se permite desactivar si `status = 'active'`?
- [ ] ¿Se registra en audit log con `action: 'deactivate'`?
- [ ] ¿Se cambia `status` a `'deprecated'`?

**Si alguna respuesta es NO → VIOLACIÓN DEL CONTRATO**

---

### 5. Ejecución Manual

- [ ] ¿Solo se ejecuta si `status = 'active'`?
- [ ] ¿Se valida `mode` (`'dry_run'` o `'live_run'`)?
- [ ] ¿Se genera señal artificial?
- [ ] ¿La señal tiene `source: { type: 'manual', actor: {...} }`?
- [ ] ¿Toda ejecución pasa por `runAutomationsForSignal()`?
- [ ] ¿NO se llama servicios canónicos directamente?
- [ ] ¿NO se llama Action Registry directamente?
- [ ] ¿Se registra run y steps en BD?
- [ ] ¿Se pasa por dedupe?

**Si alguna respuesta es NO → VIOLACIÓN DEL CONTRATO**

---

### 6. Ejecución Solo Vía Engine

- [ ] ¿NO se llama `studentMutationService` directamente desde UI o endpoints?
- [ ] ¿NO se llama `getAction()` directamente desde UI o endpoints?
- [ ] ¿NO se ejecutan steps directamente?
- [ ] ¿Toda ejecución pasa por `runAutomationsForSignal()`?

**Si alguna respuesta es NO → VIOLACIÓN DEL CONTRATO**

---

### 7. Validaciones de Schema

- [ ] ¿Se valida estructura de `definition` en backend?
- [ ] ¿Se valida que `trigger` existe?
- [ ] ¿Se valida que `steps` existe y es array no vacío?
- [ ] ¿Se valida que todos los `action_key` existen en Action Registry?

**Si alguna respuesta es NO → VIOLACIÓN DEL CONTRATO**

---

### 8. Versionado

- [ ] ¿Se incrementa `version` al actualizar?
- [ ] ¿Se valida conflicto de versiones antes de actualizar?
- [ ] ¿Se rechaza si versión en BD != versión enviada?

**Si alguna respuesta es NO → VIOLACIÓN DEL CONTRATO**

---

### 9. Auditoría

- [ ] ¿Toda creación registra en audit log?
- [ ] ¿Toda edición registra en audit log?
- [ ] ¿Toda activación registra en audit log?
- [ ] ¿Toda ejecución manual registra run y steps?
- [ ] ¿Todas las operaciones incluyen `actor`?

**Si alguna respuesta es NO → VIOLACIÓN DEL CONTRATO**

---

### 10. Prohibiciones Constitucionales

- [ ] ¿NO se ejecuta desde frontend directo?
- [ ] ¿NO se llama servicios canónicos desde UI?
- [ ] ¿NO se muta estado fuera de Action Registry?
- [ ] ¿NO se ejecuta sin auditoría?
- [ ] ¿NO se crea con `status != 'draft'`?
- [ ] ¿NO se ejecuta si `status != 'active'`?

**Si alguna respuesta es NO → VIOLACIÓN DEL CONTRATO**

---

## 🚨 VIOLACIONES COMUNES

### Violación 1: Ejecutar Desde Frontend Directo
```javascript
// ❌ PROHIBIDO
async function executeAction() {
  const action = getAction('student.updateNivel');
  await action.handler({ email, nivel });
}

// ✅ CORRECTO
async function executeAutomation(automationId, mode) {
  const response = await fetch(`/admin/api/automations/${automationId}/execute`, {
    method: 'POST',
    body: JSON.stringify({ mode })
  });
  // Endpoint genera señal → engine ejecuta
}
```

### Violación 2: Crear Con Status Active
```javascript
// ❌ PROHIBIDO
await createAutomation({
  automation_key: 'test',
  status: 'active' // ❌ PROHIBIDO
});

// ✅ CORRECTO
await createAutomation({
  automation_key: 'test',
  status: 'draft' // ✅ SIEMPRE draft al crear
});
```

### Violación 3: Ejecutar Sin Validar Status
```javascript
// ❌ PROHIBIDO
async function executeAutomation(id) {
  await runAutomationsForSignal({...}); // Sin validar status
}

// ✅ CORRECTO
async function executeAutomation(id) {
  const automation = await getAutomation(id);
  if (automation.status !== 'active') {
    throw new Error('Solo se pueden ejecutar automatizaciones activas');
  }
  await runAutomationsForSignal({...});
}
```

### Violación 4: Llamar Servicios Canónicos Directamente
```javascript
// ❌ PROHIBIDO
async function executeStep(actionKey, input) {
  const action = getAction(actionKey);
  await action.handler(input); // Llamada directa
}

// ✅ CORRECTO
async function executeAutomation(automationId) {
  // Generar señal artificial
  const signal = generateArtificialSignal(...);
  // Pasar al engine (que ejecutará las acciones)
  await runAutomationsForSignal(signal);
}
```

### Violación 5: Ejecutar Sin Señal
```javascript
// ❌ PROHIBIDO
async function executeSteps(steps) {
  for (const step of steps) {
    await executeAction(step.action_key, step.input);
  }
}

// ✅ CORRECTO
async function executeAutomation(automationId) {
  const signal = generateArtificialSignal(...);
  await dispatchSignal(signal); // Genera señal → engine ejecuta
}
```

### Violación 6: Actualizar Sin Validar Versión
```javascript
// ❌ PROHIBIDO
async function updateAutomation(id, updates) {
  await query('UPDATE automation_definitions SET ... WHERE id = $1', [id]);
}

// ✅ CORRECTO
async function updateAutomation(id, updates, currentVersion) {
  const result = await query(`
    UPDATE automation_definitions 
    SET ... 
    WHERE id = $1 AND version = $2
    RETURNING *
  `, [id, currentVersion]);
  
  if (result.rows.length === 0) {
    throw new Error('Conflicto de versión');
  }
}
```

---

## 📋 CÓMO USAR ESTA CHECKLIST

1. **Antes de crear PR**: Revisar todos los items
2. **Si cambias UI de automatizaciones**: Verificar items 1-10
3. **Si añades endpoint de escritura**: Verificar items 1-5, 9-10
4. **Si añades endpoint de ejecución**: Verificar items 5-6, 9-10
5. **Si detectas violación**: Corregir antes de mergear

---

## 🔍 VERIFICACIÓN AUTOMÁTICA

Ejecutar verificación estática:
```bash
npm run verify:contract:automations
```

O manualmente:
```bash
node scripts/verify-automations-contract.js
```

**NOTA**: Los scripts de verificación pueden no detectar todas las violaciones. Esta checklist es complementaria.

---

**Última actualización**: 2025-01-XX  
**Versión del contrato**: 1.0










