# AUDITORÍA DE RIESGOS: FASE 7
## Escritura y Ejecución Gobernada de Automatizaciones

**Fecha**: 2025-01-XX  
**Fase**: D.7  
**Alcance**: Análisis de riesgos antes de implementar escritura y ejecución manual

---

## PROPÓSITO

Este documento identifica y documenta los riesgos críticos de permitir escritura y ejecución manual de automatizaciones en AuriPortal, antes de implementar la Fase 7.

**IMPORTANTE**: Esta auditoría es OBLIGATORIA antes de escribir código. Identifica decisiones irreversibles y anti-patrones que deben evitarse.

---

## RIESGOS DE PERMITIR ESCRITURA

### Riesgo 1: JSON Inválido en Definition

**Descripción**: Un usuario puede crear una automatización con `definition` JSON malformado o que no cumple el schema esperado.

**Impacto**:
- El Automation Engine v2 falla al ejecutar
- Runs quedan en estado `failed`
- Errores silenciosos si no se validan correctamente

**Mitigación OBLIGATORIA**:
- Validación de schema JSON antes de guardar
- Validación de estructura mínima (trigger, steps)
- Validación de action_keys contra Action Registry
- Rechazar automáticamente definiciones inválidas

**Decisión**: ✅ Validación dura en backend (no solo frontend)

---

### Riesgo 2: Sobrescritura Silenciosa de Automatizaciones

**Descripción**: Editar una automatización puede sobrescribir cambios concurrentes sin advertir al usuario.

**Impacto**:
- Pérdida de cambios
- Conflicto de versiones
- Auditoría incompleta

**Mitigación OBLIGATORIA**:
- Versionado explícito (campo `version`)
- Verificación de versión antes de actualizar
- Rechazar si la versión en BD no coincide con la enviada
- Auditoría completa de cambios

**Decisión**: ✅ Versionado obligatorio con validación de conflicto

---

### Riesgo 3: Automatizaciones en Estado Inválido

**Descripción**: Un usuario puede crear automatizaciones con `status = 'active'` directamente, saltándose el flujo de draft → active.

**Impacto**:
- Automatizaciones sin probar se ejecutan automáticamente
- Bugs en producción inmediatos
- Difícil de revertir si ya se ejecutaron

**Mitigación OBLIGATORIA**:
- Solo permitir crear con `status = 'draft'`
- Activar es una operación separada y explícita
- Requerir confirmación para activar
- Logging explícito de cambios de status

**Decisión**: ✅ Creación solo en `draft`, activación separada

---

### Riesgo 4: Referencias a Acciones Inexistentes

**Descripción**: Una automatización puede referenciar `action_key` que no existe en el Action Registry.

**Impacto**:
- Fallo en runtime cuando se ejecuta
- Errores difíciles de diagnosticar
- Runs fallidos sin causa clara

**Mitigación OBLIGATORIA**:
- Validar que todos los `action_key` existen en Action Registry
- Validar antes de guardar (no solo al ejecutar)
- Rechazar automáticamente si hay acciones inválidas

**Decisión**: ✅ Validación contra Action Registry antes de guardar

---

### Riesgo 5: Loops Infinitos o Recursivos

**Descripción**: Una automatización puede generar señales que disparan otras automatizaciones que vuelven a generar la misma señal.

**Impacto**:
- Ejecuciones infinitas
- Carga excesiva en BD y sistema
- Runs que nunca terminan

**Mitigación OBLIGATORIA**:
- Dedupe por `signal_id + automation_key` (YA IMPLEMENTADO)
- Límites de profundidad de ejecución (si es necesario)
- Timeouts en ejecuciones
- Monitoreo de runs largos

**Decisión**: ✅ El dedupe existente es suficiente, pero monitorear

---

## RIESGOS DE PERMITIR EJECUCIÓN MANUAL

### Riesgo 6: Ejecución Sin Señal Real

**Descripción**: Ejecutar manualmente crea una señal artificial que puede no corresponder a un evento real del sistema.

**Impacto**:
- Ejecuciones que no deberían haber ocurrido
- Estado inconsistente con eventos reales
- Auditoría confusa (¿fue automático o manual?)

**Mitigación OBLIGATORIA**:
- Señal artificial claramente marcada en metadata
- `source: { type: 'manual', actor: 'admin:id' }`
- Logging explícito de ejecución manual
- Separación visual en UI entre runs manuales y automáticos

**Decisión**: ✅ Señales artificiales permitidas pero explícitamente marcadas

---

### Riesgo 7: Ejecución Directa Sin Engine

**Descripción**: La UI podría llamar directamente a servicios canónicos, saltándose el Automation Engine v2.

**Impacto**:
- No se registran runs
- No se registran steps
- No hay dedupe
- No hay auditoría
- Viola Contrato D

**Mitigación OBLIGATORIA**:
- **PROHIBICIÓN ABSOLUTA**: UI nunca llama servicios canónicos directamente
- Ejecución manual SOLO a través de `runAutomationsForSignal()`
- Validación en código (no solo documentación)
- Tests que detectan llamadas directas

**Decisión**: ✅ Ejecución manual SOLO vía Automation Engine v2

---

### Riesgo 8: Ejecución de Automatizaciones Inactivas

**Descripción**: Un usuario podría intentar ejecutar automatizaciones con `status != 'active'` (draft, deprecated, broken).

**Impacto**:
- Ejecución de código no probado (draft)
- Ejecución de código obsoleto (deprecated)
- Ejecución de código roto (broken)

**Mitigación OBLIGATORIA**:
- Validar que `status = 'active'` antes de ejecutar
- Rechazar ejecución si status no es active
- Error explícito: "Solo se pueden ejecutar automatizaciones activas"

**Decisión**: ✅ Solo ejecutar automatizaciones con `status = 'active'`

---

### Riesgo 9: Ejecución Sin Contexto

**Descripción**: Ejecutar manualmente puede no tener el contexto necesario (student_id, trace_id, etc.) que las señales reales sí tienen.

**Impacto**:
- Steps fallan por falta de contexto
- Payloads de acciones incompletos
- Errores difíciles de diagnosticar

**Mitigación OBLIGATORIA**:
- Permitir contexto opcional en ejecución manual
- Validar que el contexto mínimo está presente
- Documentar qué contexto se necesita para cada automatización
- Fallar explícitamente si falta contexto crítico

**Decisión**: ✅ Contexto opcional pero validado si se proporciona

---

### Riesgo 10: Ejecución Sin Límites

**Descripción**: Un usuario podría ejecutar manualmente múltiples veces seguidas, causando ejecuciones duplicadas o carga excesiva.

**Impacto**:
- Carga en sistema
- Ejecuciones redundantes
- Confusión en auditoría

**Mitigación OBLIGATORIA**:
- El dedupe existente previene duplicados (por signal_id)
- Rate limiting opcional si es necesario
- Confirmación explícita antes de ejecutar

**Decisión**: ✅ El dedupe es suficiente, pero añadir confirmación en UI

---

## DECISIONES IRREVERSIBLES

### Decisión 1: Ejecución Manual Genera Señal Artificial

**Descripción**: Las ejecuciones manuales deben generar señales artificiales que pasan por el mismo flujo que señales reales.

**Razón**: Mantiene consistencia, auditoría y permite que el dedupe funcione igual.

**Irreversible porque**: Cambiar esto requeriría reescribir el sistema de señales.

**Aceptación**: ✅ ACEPTADO

---

### Decisión 2: Toda Ejecución Pasa por Automation Engine v2

**Descripción**: No hay bypass del engine. Toda ejecución (manual o automática) pasa por `runAutomationsForSignal()`.

**Razón**: Garantiza consistencia, auditoría y cumplimiento del Contrato D.

**Irreversible porque**: Crear bypass violaría la arquitectura constitucional.

**Aceptación**: ✅ ACEPTADO

---

### Decisión 3: Versionado Obligatorio

**Descripción**: Toda actualización de automatización requiere incrementar `version` y validar conflicto.

**Razón**: Previene sobrescritura de cambios concurrentes.

**Irreversible porque**: Cambiar el modelo de versionado rompería la auditoría histórica.

**Aceptación**: ✅ ACEPTADO

---

## ANTI-PATRONES EXPLÍCITOS

### Anti-Patrón 1: Ejecutar desde Frontend Directo

**PROHIBIDO**:
```javascript
// ❌ NUNCA HACER ESTO
await studentMutationService.updateNivel(email, nivel, { type: 'admin' });
```

**CORRECTO**:
```javascript
// ✅ CORRECTO
await dispatchSignal({
  signal_key: 'student.level_changed',
  payload: { email, nivel },
  runtime: { trace_id, day_key },
  context: {}
});
```

**Razón**: Viola Contrato D. La ejecución debe pasar por el engine.

---

### Anti-Patrón 2: Llamar Action Registry Desde UI

**PROHIBIDO**:
```javascript
// ❌ NUNCA HACER ESTO
const action = getAction('student.updateNivel');
await action.handler({ email, nivel });
```

**CORRECTO**:
```javascript
// ✅ CORRECTO
// UI llama endpoint → endpoint genera señal → engine ejecuta
```

**Razón**: Viola Contrato D. Las acciones solo se ejecutan desde el engine.

---

### Anti-Patrón 3: Validación Solo en Frontend

**PROHIBIDO**:
```javascript
// ❌ NUNCA CONFIAR SOLO EN ESTO
if (!definition.trigger || !definition.steps) {
  alert('Definición inválida');
}
```

**CORRECTO**:
```javascript
// ✅ CORRECTO
// Validar en backend también, rechazar si es inválido
if (!isValidDefinition(definition)) {
  return { ok: false, error: 'Definición inválida' };
}
```

**Razón**: El frontend puede ser manipulado. La validación real debe estar en backend.

---

### Anti-Patrón 4: Permitir Activar Directamente en Creación

**PROHIBIDO**:
```javascript
// ❌ NUNCA PERMITIR ESTO
await createAutomation({
  automation_key: 'test',
  definition: {...},
  status: 'active' // ❌ PROHIBIDO
});
```

**CORRECTO**:
```javascript
// ✅ CORRECTO
await createAutomation({
  automation_key: 'test',
  definition: {...},
  status: 'draft' // ✅ SIEMPRE draft al crear
});

// Luego, operación separada para activar
await activateAutomation('test');
```

**Razón**: Previene activación accidental de código sin probar.

---

### Anti-Patrón 5: Ejecutar Sin Validar Status

**PROHIBIDO**:
```javascript
// ❌ NUNCA HACER ESTO
await runAutomationsForSignal({
  signal_type: 'test',
  automation_key: 'my-automation'
  // No validar si está active
});
```

**CORRECTO**:
```javascript
// ✅ CORRECTO
const automation = await getAutomation(automationKey);
if (automation.status !== 'active') {
  throw new Error('Solo se pueden ejecutar automatizaciones activas');
}
```

**Razón**: Previene ejecución de código no probado o roto.

---

## QUÉ ESTÁ PROHIBIDO AUNQUE "SEA FÁCIL"

### Prohibición 1: Ejecutar Acciones Sueltas

**Por qué parece fácil**: "Solo necesito ejecutar `student.updateNivel`, no toda la automatización"

**Por qué está prohibido**:
- Viola Contrato D
- No genera auditoría completa
- No pasa por dedupe
- No es trazable

**Decisión**: ✅ PROHIBIDO. Toda ejecución debe ser una automatización completa.

---

### Prohibición 2: Bypass del Automation Engine

**Por qué parece fácil**: "Solo llamo directamente al servicio desde el endpoint"

**Por qué está prohibido**:
- Viola Contrato D
- No genera runs ni steps
- No hay auditoría
- Duplica lógica

**Decisión**: ✅ PROHIBIDO. Toda ejecución pasa por el engine.

---

### Prohibición 3: Ejecutar Draft/Broken

**Por qué parece fácil**: "Solo para probar, no pasa nada"

**Por qué está prohibido**:
- Puede causar efectos secundarios
- No está probado
- Puede romper el sistema
- Dificulta auditoría

**Decisión**: ✅ PROHIBITO. Solo se ejecutan automatizaciones activas.

---

### Prohibición 4: Ejecutar Sin Señal

**Por qué parece fácil**: "Solo ejecuto los steps directamente"

**Por qué está prohibido**:
- Viola el flujo canónico
- No genera señal artificial
- No pasa por dedupe
- No es trazable

**Decisión**: ✅ PROHIBIDO. Toda ejecución genera señal (aunque sea artificial).

---

## MITIGACIONES OBLIGATORIAS IMPLEMENTADAS

### Mitigación 1: Validación de Schema

**Estado**: ⏳ A IMPLEMENTAR en Fase 7

**Requisito**: Validar estructura mínima de `definition` antes de guardar.

---

### Mitigación 2: Versionado

**Estado**: ✅ YA IMPLEMENTADO (campo `version` existe en BD)

**Requisito**: Validar conflicto de versiones antes de actualizar.

---

### Mitigación 3: Status Draft por Defecto

**Estado**: ✅ YA IMPLEMENTADO (default 'draft' en BD)

**Requisito**: Forzar creación solo en draft.

---

### Mitigación 4: Validación de Action Keys

**Estado**: ⏳ A IMPLEMENTAR en Fase 7

**Requisito**: Validar contra Action Registry antes de guardar.

---

### Mitigación 5: Dedupe

**Estado**: ✅ YA IMPLEMENTADO (automation_dedup table)

**Requisito**: Usar siempre en ejecuciones manuales también.

---

### Mitigación 6: Ejecución Solo Vía Engine

**Estado**: ✅ YA IMPLEMENTADO (runAutomationsForSignal existe)

**Requisito**: Nunca bypass del engine.

---

### Mitigación 7: Validación de Status en Ejecución

**Estado**: ⏳ A IMPLEMENTAR en Fase 7

**Requisito**: Validar `status = 'active'` antes de ejecutar.

---

## CONCLUSIÓN

Esta auditoría identifica **10 riesgos críticos** y **5 anti-patrones** que deben evitarse en la Fase 7.

**Decisiones irreversibles**:
1. ✅ Ejecución manual genera señal artificial
2. ✅ Toda ejecución pasa por Automation Engine v2
3. ✅ Versionado obligatorio

**Prohibiciones constitucionales**:
1. ✅ Nunca ejecutar acciones sueltas
2. ✅ Nunca bypass del engine
3. ✅ Nunca ejecutar draft/broken
4. ✅ Nunca ejecutar sin señal

**Mitigaciones obligatorias**:
- Validación de schema (implementar)
- Versionado con conflicto (implementar validación)
- Status draft por defecto (ya existe)
- Validación de action keys (implementar)
- Dedupe (ya existe)
- Ejecución vía engine (ya existe)
- Validación de status (implementar)

---

**Este documento debe ser consultado ANTES de implementar cualquier funcionalidad de escritura o ejecución manual.**

---

**FIN DE AUDITORÍA**





