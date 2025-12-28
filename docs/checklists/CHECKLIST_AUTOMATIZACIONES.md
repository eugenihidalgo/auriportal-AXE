# CHECKLIST: Automatizaciones Canónicas
## Verificación Obligatoria para PRs y Cambios

**Referencia**: `CONTRATO_CANONICO_AUTOMATIZACIONES.md`

---

## ✅ CHECKLIST OBLIGATORIA

### 1. Consumo de Señales

- [ ] ¿Consume señales emitidas (no preparadas)?
- [ ] ¿Requiere signal_id único?
- [ ] ¿La señal está persistida en pde_signal_emissions?
- [ ] ¿NO consume señales preparadas?

**Si alguna respuesta es NO → VIOLACIÓN DEL CONTRATO**

---

### 2. Ejecución de Acciones

- [ ] ¿Ejecuta acciones registradas en Action Registry?
- [ ] ¿NO ejecuta código inline?
- [ ] ¿NO ejecuta funciones ad-hoc?
- [ ] ¿Todas las acciones están registradas?

**Si alguna respuesta es NO → VIOLACIÓN DEL CONTRATO**

---

### 3. Mutación de Estado

- [ ] ¿NO muta estado directamente?
- [ ] ¿Las acciones usan servicios canónicos (Contrato B)?
- [ ] ¿NO escribe directamente en PostgreSQL?
- [ ] ¿NO llama repositorios directamente?

**Si alguna respuesta es NO → VIOLACIÓN DEL CONTRATO**

---

### 4. Idempotencia

- [ ] ¿Verifica dedupe antes de ejecutar?
- [ ] ¿Usa dedup_key = `${signal_id}:${automation_key}`?
- [ ] ¿Registra en tabla automation_dedup?
- [ ] ¿NO se ejecuta dos veces para la misma señal?

**Si alguna respuesta es NO → VIOLACIÓN DEL CONTRATO**

---

### 5. Auditoría

- [ ] ¿Registra ejecución en automation_runs?
- [ ] ¿Registra cada paso en automation_run_steps?
- [ ] ¿Registra estado, timestamps, inputs, outputs?
- [ ] ¿Registra errores explícitamente?

**Si alguna respuesta es NO → VIOLACIÓN DEL CONTRATO**

---

### 6. Feature Flag

- [ ] ¿Respeta feature flag AUTOMATIONS_ENGINE_ENABLED?
- [ ] ¿Si flag OFF: no ejecuta?
- [ ] ¿Si flag BETA: solo dev/beta?
- [ ] ¿Si flag ON: todos los entornos?

**Si alguna respuesta es NO → VIOLACIÓN DEL CONTRATO**

---

### 7. Estructura Canónica

- [ ] ¿Tiene automation_key (único)?
- [ ] ¿Tiene name?
- [ ] ¿Tiene definition.trigger.signalType?
- [ ] ¿Tiene definition.steps[] (mínimo 1)?
- [ ] ¿Cada step tiene actionKey?
- [ ] ¿Cada step tiene inputTemplate?
- [ ] ¿Tiene status ('draft' | 'active' | 'deprecated' | 'broken')?

**Si alguna respuesta es NO → VIOLACIÓN DEL CONTRATO**

---

### 8. Estado de Ejecución

- [ ] ¿Solo automatizaciones con status 'active' se ejecutan?
- [ ] ¿Status 'draft' no se ejecuta?
- [ ] ¿Status 'deprecated' no se ejecuta?
- [ ] ¿Status 'broken' no se ejecuta?

**Si alguna respuesta es NO → VIOLACIÓN DEL CONTRATO**

---

### 9. Migración

- [ ] ¿Migración aplicada en PostgreSQL?
- [ ] ¿Tablas existen (automation_definitions, automation_runs, automation_run_steps, automation_dedup)?
- [ ] ¿Verificado que tablas existen?

**Si alguna respuesta es NO → VIOLACIÓN DEL CONTRATO**

---

### 10. Relación con Contratos A/B/C

- [ ] ¿NO se ejecuta desde servicios canónicos (Contrato A/B)?
- [ ] ¿Consume señales emitidas (Contrato C)?
- [ ] ¿Las acciones usan servicios canónicos (Contrato B)?

**Si alguna respuesta es NO → VIOLACIÓN DEL CONTRATO**

---

### 11. Documentación (Solo para nuevas automatizaciones)

- [ ] ¿Se actualizó CONTRATO_CANONICO_AUTOMATIZACIONES.md?
- [ ] ¿Se documentó la nueva automatización?
- [ ] ¿Se registró la acción en Action Registry?

**Si es nueva automatización y alguna respuesta es NO → INCOMPLETO**

---

### 12. Tests (Recomendado)

- [ ] ¿Se añadieron tests mínimos si se tocó automatización?
- [ ] ¿Los tests verifican dedupe?
- [ ] ¿Los tests verifican auditoría?
- [ ] ¿Los tests verifican feature flag?

**Recomendado pero no obligatorio para cambios menores**

---

## 🚨 VIOLACIONES COMUNES

### Violación 1: Ejecutar desde servicio canónico
```javascript
// ❌ PROHIBIDO
async createStudent(env, data, actor, client) {
  const alumno = await this.repo.create(data, client);
  const signalData = this._prepareSignal('student.created', {...});
  await runAutomations(signalData); // VIOLACIÓN: ejecuta desde servicio canónico
}

// ✅ CORRECTO
async createStudent(env, data, actor, client) {
  const alumno = await this.repo.create(data, client);
  const signalData = this._prepareSignal('student.created', {...});
  // La señal se emite después, y entonces se ejecutan automatizaciones
}
```

### Violación 2: Consumir señal preparada
```javascript
// ❌ PROHIBIDO
async handlePreparedSignal(signalData) {
  // signalData no tiene signal_id, no está emitida
  await runAutomations(signalData); // VIOLACIÓN: señal preparada
}

// ✅ CORRECTO
async handleEmittedSignal(signalEnvelope) {
  // signalEnvelope tiene signal_id, está emitida
  await runAutomations(signalEnvelope); // CORRECTO: señal emitida
}
```

### Violación 3: Mutar estado directamente
```javascript
// ❌ PROHIBIDO
async executeAction(actionKey, input) {
  // Mutar directamente
  await query('UPDATE alumnos SET streak = streak + 1 WHERE id = $1', [input.id]);
}

// ✅ CORRECTO
async executeAction(actionKey, input) {
  // Usar servicio canónico
  const service = getStudentMutationService();
  await service.updateStreak(input.email, input.streak, { type: 'system' });
}
```

### Violación 4: Ejecutar acción no registrada
```javascript
// ❌ PROHIBIDO
async executeStep(step) {
  // Ejecutar código inline
  await someFunction(step.input); // VIOLACIÓN: acción no registrada
}

// ✅ CORRECTO
async executeStep(step) {
  // Ejecutar desde Action Registry
  const action = getAction(step.actionKey);
  await action.handler(step.input);
}
```

### Violación 5: Omitir dedupe
```javascript
// ❌ PROHIBIDO
async runAutomation(automation, signal) {
  // Ejecutar sin verificar dedupe
  await executeSteps(automation.steps); // VIOLACIÓN: no verifica dedupe
}

// ✅ CORRECTO
async runAutomation(automation, signal) {
  // Verificar dedupe primero
  const dedupKey = `${signal.signal_id}:${automation.automation_key}`;
  if (await existsDedup(dedupKey)) {
    return { skipped: true, reason: 'dedupe' };
  }
  await insertDedup(dedupKey);
  await executeSteps(automation.steps);
}
```

### Violación 6: Omitir auditoría
```javascript
// ❌ PROHIBIDO
async runAutomation(automation, signal) {
  // Ejecutar sin registrar
  await executeSteps(automation.steps); // VIOLACIÓN: no registra auditoría
}

// ✅ CORRECTO
async runAutomation(automation, signal) {
  // Registrar run
  const run = await createRun(automation, signal);
  // Ejecutar y registrar steps
  for (const step of automation.steps) {
    const stepRecord = await createStep(run.id, step);
    await executeStep(step);
    await updateStep(stepRecord.id, { status: 'success', output: result });
  }
  await updateRun(run.id, { status: 'success' });
}
```

---

## 📋 CÓMO USAR ESTA CHECKLIST

1. **Antes de crear PR**: Revisar todos los items
2. **Si cambias automatización existente**: Verificar items 1-10
3. **Si añades nueva automatización**: Verificar items 1-11
4. **Si detectas violación**: Corregir antes de mergear

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

---

**Última actualización**: 2025-01-XX  
**Versión del contrato**: 1.0






