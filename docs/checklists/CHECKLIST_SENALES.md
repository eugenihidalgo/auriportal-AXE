# CHECKLIST: Señales Canónicas
## Verificación Obligatoria para PRs y Cambios

**Referencia**: `CONTRATO_CANONICO_SENALES.md`

---

## ✅ CHECKLIST OBLIGATORIA

### 1. Preparación de Señales

- [ ] ¿Se prepara en servicio canónico (StudentMutationService)?
- [ ] ¿NO se prepara en endpoint?
- [ ] ¿NO se prepara en módulo de negocio?
- [ ] ¿NO se prepara en repositorio?

**Si alguna respuesta es NO → VIOLACIÓN DEL CONTRATO**

---

### 2. Estructura Canónica

- [ ] ¿Tiene `signalType` (string)?
- [ ] ¿Tiene `payload` (object)?
- [ ] ¿Tiene `metadata` (object)?
- [ ] ¿El `payload` incluye entidad afectada?
- [ ] ¿El `payload` incluye `oldState` o `newState` según corresponda?
- [ ] ¿El `metadata` incluye `version`?

**Si alguna respuesta es NO → VIOLACIÓN DEL CONTRATO**

---

### 3. Emisión

- [ ] ¿NO se emite durante preparación?
- [ ] ¿La señal solo se prepara, no se emite?
- [ ] ¿La emisión pertenece a otra fase del sistema?

**Si alguna respuesta es NO → VIOLACIÓN DEL CONTRATO**

---

### 4. Separación de Responsabilidades

- [ ] ¿NO ejecuta automatizaciones?
- [ ] ¿NO muta estado?
- [ ] ¿NO llama sistemas externos?
- [ ] ¿NO se usa como control de flujo?

**Si alguna respuesta es NO → VIOLACIÓN DEL CONTRATO**

---

### 5. Inmutabilidad

- [ ] ¿La señal es inmutable después de prepararse?
- [ ] ¿NO se modifica con información adicional?
- [ ] ¿Si se necesita más información, se prepara nueva señal?

**Si alguna respuesta es NO → VIOLACIÓN DEL CONTRATO**

---

### 6. Versionado

- [ ] ¿Tiene versión explícita en `metadata.version`?
- [ ] ¿La versión es compatible con versiones anteriores?
- [ ] ¿Cambios breaking incrementan versión?

**Si alguna respuesta es NO → VIOLACIÓN DEL CONTRATO**

---

### 7. Relación con Contratos A y B

- [ ] ¿Si es creación: se prepara señal? (Contrato A)
- [ ] ¿Si es mutación: se prepara señal? (Contrato B)
- [ ] ¿La señal NO se emite durante create/update?

**Si alguna respuesta es NO → VIOLACIÓN DEL CONTRATO**

---

### 8. Documentación (Solo para nuevas señales)

- [ ] ¿Se actualizó `CONTRATO_CANONICO_SENALES.md`?
- [ ] ¿Se documentó la nueva señal en la sección 11?
- [ ] ¿Se añadió preparación en servicio canónico?

**Si es nueva señal y alguna respuesta es NO → INCOMPLETO**

---

### 9. Tests (Recomendado)

- [ ] ¿Se añadieron tests mínimos si se tocó preparación de señales?
- [ ] ¿Los tests verifican estructura canónica?
- [ ] ¿Los tests verifican que no se emite durante preparación?

**Recomendado pero no obligatorio para cambios menores**

---

## 🚨 VIOLACIONES COMUNES

### Violación 1: Emitir señal desde servicio canónico
```javascript
// ❌ PROHIBIDO
async updateNivel(email, nivel, actor, client) {
  const alumno = await this.repo.updateNivel(email, nivel, client);
  const signalData = this._prepareSignal('student.level_changed', {...});
  await emitSignal(signalData); // VIOLACIÓN: emite durante preparación
}

// ✅ CORRECTO
async updateNivel(email, nivel, actor, client) {
  const alumno = await this.repo.updateNivel(email, nivel, client);
  const signalData = this._prepareSignal('student.level_changed', {...});
  // signalData disponible para emisión posterior, no se emite aquí
}
```

### Violación 2: Ejecutar automatización al preparar señal
```javascript
// ❌ PROHIBIDO
async updateNivel(email, nivel, actor, client) {
  const alumno = await this.repo.updateNivel(email, nivel, client);
  const signalData = this._prepareSignal('student.level_changed', {...});
  await triggerAutomation(signalData); // VIOLACIÓN: ejecuta automatización
}

// ✅ CORRECTO
async updateNivel(email, nivel, actor, client) {
  const alumno = await this.repo.updateNivel(email, nivel, client);
  const signalData = this._prepareSignal('student.level_changed', {...});
  // La automatización se ejecuta después, cuando se emite la señal
}
```

### Violación 3: Mutar estado desde señal
```javascript
// ❌ PROHIBIDO
_prepareSignal(signalType, student, oldState, newState) {
  // Mutar estado durante preparación
  await this.repo.updateStreak(student.id, newState.streak + 1); // VIOLACIÓN
  return { signalType, payload: {...} };
}

// ✅ CORRECTO
_prepareSignal(signalType, student, oldState, newState) {
  // Solo preparar dato, no mutar
  return { signalType, payload: {...} };
}
```

### Violación 4: Llamar sistema externo desde señal
```javascript
// ❌ PROHIBIDO
_prepareSignal(signalType, student, oldState, newState) {
  // Llamar API externa durante preparación
  await clickupApi.updateTask(student.id, newState); // VIOLACIÓN
  return { signalType, payload: {...} };
}

// ✅ CORRECTO
_prepareSignal(signalType, student, oldState, newState) {
  // Solo preparar dato, no llamar externos
  return { signalType, payload: {...} };
}
```

### Violación 5: Señal sin estructura canónica
```javascript
// ❌ PROHIBIDO
_prepareSignal(signalType, student, oldState, newState) {
  return {
    type: signalType, // Falta estructura canónica
    data: newState    // Falta payload y metadata
  };
}

// ✅ CORRECTO
_prepareSignal(signalType, student, oldState, newState) {
  return {
    signalType,
    payload: {
      entity: student,
      oldState,
      newState,
      timestamp: new Date().toISOString()
    },
    metadata: {
      version: '1.0',
      preparedAt: new Date().toISOString(),
      source: 'StudentMutationService'
    }
  };
}
```

---

## 📋 CÓMO USAR ESTA CHECKLIST

1. **Antes de crear PR**: Revisar todos los items
2. **Si cambias preparación de señales**: Verificar items 1-7
3. **Si añades nueva señal**: Verificar items 1-8
4. **Si detectas violación**: Corregir antes de mergear

---

## 🔍 VERIFICACIÓN AUTOMÁTICA

Ejecutar verificación estática:
```bash
npm run verify:contract:signals
```

O manualmente:
```bash
node scripts/verify-signals-contract.js
```

---

**Última actualización**: 2025-01-XX  
**Versión del contrato**: 1.0










