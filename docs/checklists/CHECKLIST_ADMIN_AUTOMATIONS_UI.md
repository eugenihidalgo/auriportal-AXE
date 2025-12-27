# CHECKLIST: Admin UI Automatizaciones (Read-Only)
## Verificación Obligatoria para PRs y Cambios

**Referencia**: `ADMIN_AUTOMATIONS_READ_ONLY_CONTRACT.md` y `FASE_D_FASE6_ADMIN_UI_SCOPE.md`

---

## ✅ CHECKLIST OBLIGATORIA

### 1. Operaciones de Lectura

- [ ] ¿Solo se usan queries SELECT?
- [ ] ¿No hay INSERT en ninguna tabla?
- [ ] ¿No hay UPDATE en ninguna tabla?
- [ ] ¿No hay DELETE en ninguna tabla?

**Si alguna respuesta es NO → VIOLACIÓN DEL CONTRATO**

---

### 2. Endpoints

- [ ] ¿Solo se usan métodos GET?
- [ ] ¿No hay POST, PUT, DELETE, PATCH?
- [ ] ¿Todos los endpoints están protegidos con `requireAdminContext()`?
- [ ] ¿Se validan parámetros (IDs, filtros, ordenamiento)?

**Si alguna respuesta es NO → VIOLACIÓN DEL CONTRATO**

---

### 3. UI (Pantallas)

- [ ] ¿No hay botones de "Crear"?
- [ ] ¿No hay botones de "Editar"?
- [ ] ¿No hay botones de "Activar"?
- [ ] ¿No hay botones de "Ejecutar"?
- [ ] ¿Solo se muestra información (texto, tablas, JSON viewers)?
- [ ] ¿No hay formularios de edición?
- [ ] ¿No hay inputs de escritura?

**Si alguna respuesta es NO → VIOLACIÓN DEL CONTRATO**

---

### 4. Ejecución de Automatizaciones

- [ ] ¿No se llama `runAutomationsForSignal()`?
- [ ] ¿No se llama `dispatchSignal()`?
- [ ] ¿No se emiten señales artificiales?
- [ ] ¿No se fuerza ejecución de automatizaciones?

**Si alguna respuesta es NO → VIOLACIÓN DEL CONTRATO**

---

### 5. Modificación de Estado

- [ ] ¿No se cambia `status` de definitions?
- [ ] ¿No se cambia `status` de runs?
- [ ] ¿No se cambia `status` de steps?
- [ ] ¿No se modifican feature flags?

**Si alguna respuesta es NO → VIOLACIÓN DEL CONTRATO**

---

### 6. Feature Flags

- [ ] ¿No se activa `AUTOMATIONS_ENGINE_ENABLED` desde UI?
- [ ] ¿No se modifica ningún flag desde UI?
- [ ] ¿No se cambia configuración de flags?

**Si alguna respuesta es NO → VIOLACIÓN DEL CONTRATO**

---

### 7. Entidades

- [ ] ¿Solo se lee `automation_definitions`?
- [ ] ¿Solo se lee `automation_runs`?
- [ ] ¿Solo se lee `automation_run_steps`?
- [ ] ¿Solo se lee `automation_dedup`?
- [ ] ¿No se escribe en ninguna de estas tablas?

**Si alguna respuesta es NO → VIOLACIÓN DEL CONTRATO**

---

### 8. Estados

- [ ] ¿Se respeta que solo `status = 'active'` se ejecuta?
- [ ] ¿UI NO fuerza ejecución de automatizaciones con `status != 'active'`?
- [ ] ¿UI NO puede saltarse el status?

**Si alguna respuesta es NO → VIOLACIÓN DEL CONTRATO**

---

### 9. Relación con Contratos

- [ ] ¿UI NO crea automatizaciones (Contrato A)?
- [ ] ¿UI NO muta automatizaciones (Contrato B)?
- [ ] ¿UI NO emite señales (Contrato C)?
- [ ] ¿UI solo inspecciona estado (Contrato D)?

**Si alguna respuesta es NO → VIOLACIÓN DEL CONTRATO**

---

## 🚨 VIOLACIONES COMUNES

### Violación 1: Crear desde UI
```javascript
// ❌ PROHIBIDO
async function createAutomation(req, res) {
  await query('INSERT INTO automation_definitions ...');
}

// ✅ CORRECTO (Fase 6)
async function listAutomations(req, res) {
  const result = await query('SELECT * FROM automation_definitions WHERE deleted_at IS NULL');
  res.json(result.rows);
}
```

### Violación 2: Ejecutar desde UI
```javascript
// ❌ PROHIBIDO
async function executeAutomation(req, res) {
  await runAutomationsForSignal({...});
}

// ✅ CORRECTO (Fase 6)
async function getAutomationRun(req, res) {
  const result = await query('SELECT * FROM automation_runs WHERE id = $1', [req.params.id]);
  res.json(result.rows[0]);
}
```

### Violación 3: Cambiar Status desde UI
```javascript
// ❌ PROHIBIDO
async function activateAutomation(req, res) {
  await query('UPDATE automation_definitions SET status = $1 WHERE id = $2', ['active', req.params.id]);
}

// ✅ CORRECTO (Fase 6)
async function getAutomation(req, res) {
  const result = await query('SELECT * FROM automation_definitions WHERE id = $1', [req.params.id]);
  res.json(result.rows[0]); // Solo lectura
}
```

### Violación 4: Emitir Señal desde UI
```javascript
// ❌ PROHIBIDO
async function triggerAutomation(req, res) {
  await dispatchSignal({ signal_key: 'student.practice_registered', ... });
}

// ✅ CORRECTO (Fase 6)
async function getAutomationRuns(req, res) {
  const result = await query('SELECT * FROM automation_runs WHERE automation_key = $1', [req.query.automation_key]);
  res.json(result.rows);
}
```

### Violación 5: Modificar Run desde UI
```javascript
// ❌ PROHIBIDO
async function retryRun(req, res) {
  await query('UPDATE automation_runs SET status = $1 WHERE id = $2', ['running', req.params.id]);
}

// ✅ CORRECTO (Fase 6)
async function getAutomationRun(req, res) {
  const result = await query('SELECT * FROM automation_runs WHERE id = $1', [req.params.id]);
  res.json(result.rows[0]); // Solo lectura
}
```

---

## 📋 CÓMO USAR ESTA CHECKLIST

1. **Antes de crear PR**: Revisar todos los items
2. **Si cambias UI de automatizaciones**: Verificar items 1-9
3. **Si añades endpoint**: Verificar items 2, 4, 5
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




