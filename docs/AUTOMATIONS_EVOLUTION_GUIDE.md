# GUÍA DE EVOLUCIÓN: SISTEMA DE AUTOMATIZACIONES
## AuriPortal - Cómo Evolucionar Sin Romper

**Versión Base**: v1.0.0-canonic  
**Fecha**: 2025-01-XX  
**Estado**: ✅ ACTIVA  
**Propósito**: Guía para evolucionar el sistema sin romper contratos congelados

---

## PROPÓSITO DE ESTA GUÍA

Esta guía documenta **cómo evolucionar** el sistema de automatizaciones **SIN romper** los contratos congelados en `AUTOMATIONS_CONSTITUTIONAL_FREEZE.md`.

**Audiencia**: Desarrolladores futuros (incluyendo el tú del futuro) que necesiten:
- Añadir features sin romper contratos
- Entender qué cambios requieren nueva versión mayor
- Saber qué cambios son seguros

---

## PRINCIPIOS DE EVOLUCIÓN

### ✅ Principio 1: Extensión, No Modificación

**Regla**: Extiende funcionalidad, no modifiques contratos existentes.

**Ejemplo Correcto**:
```javascript
// ✅ Añadir nuevo método (extensión)
export async function createAutomationWithTemplate(params, client = null) {
  // Nueva funcionalidad que usa createAutomation internamente
  return await createAutomation({...params, ...template}, client);
}
```

**Ejemplo Incorrecto**:
```javascript
// ❌ Modificar contrato existente (BREAKING)
export async function createAutomation(params, client = null) {
  // Cambiar estructura de retorno
  return { ok: true, automation: created }; // ❌ BREAKING
}
```

---

### ✅ Principio 2: Validación Adicional, No Eliminación

**Regla**: Añade validaciones, no elimines las existentes.

**Ejemplo Correcto**:
```javascript
// ✅ Añadir validación adicional
export function validateAutomationDefinition(definition) {
  // Validaciones existentes (NO TOCAR)
  validateTrigger(definition.trigger);
  validateSteps(definition.steps);
  
  // Nueva validación (extensión)
  validateCustomFields(definition.custom_fields); // ✅ NUEVO
}
```

**Ejemplo Incorrecto**:
```javascript
// ❌ Eliminar validación existente (BREAKING)
export function validateAutomationDefinition(definition) {
  // validateTrigger(definition.trigger); // ❌ ELIMINADO
  validateSteps(definition.steps);
}
```

---

### ✅ Principio 3: Nuevos Endpoints, No Modificación de Existentes

**Regla**: Crea nuevos endpoints para nuevas funcionalidades, no modifiques los existentes.

**Ejemplo Correcto**:
```javascript
// ✅ Nuevo endpoint (extensión)
POST /admin/api/automations/:id/duplicate
POST /admin/api/automations/:id/export
```

**Ejemplo Incorrecto**:
```javascript
// ❌ Modificar endpoint existente (BREAKING)
PUT /admin/api/automations/:id
// Cambiar estructura de body o respuesta
```

---

## CAMBIOS PERMITIDOS SIN VERSIÓN MAYOR

### ✅ v1.1.0+ (Minor - Features No Breaking)

#### 1. Añadir Nuevas Acciones al Action Registry

**Permitido**: ✅  
**Impacto**: Ninguno en contratos existentes

**Ejemplo**:
```javascript
// src/core/automations/automation-actions/new-action.js
export const newAction = {
  key: 'student.newAction',
  handler: async (input, context) => {
    // Nueva acción
  }
};

// src/core/automations/action-registry.js
registerAction(newAction); // ✅ Añadir
```

**Validación**: Los tests constitucionales deben seguir pasando.

---

#### 2. Añadir Nuevos Campos Opcionales a Definiciones

**Permitido**: ✅ (si son opcionales y no rompen validación)

**Ejemplo**:
```javascript
// ✅ Añadir campo opcional
{
  "trigger": {...},
  "steps": [...],
  "metadata": { // ✅ NUEVO, opcional
    "tags": ["important"],
    "priority": "high"
  }
}
```

**Requisitos**:
- Campo debe ser opcional (no requerido)
- No debe romper validación existente
- No debe cambiar estructura de retorno

---

#### 3. Mejoras de UI/UX

**Permitido**: ✅  
**Impacto**: Solo frontend, no toca contratos de backend

**Ejemplos**:
- Editor visual drag-and-drop
- Preview de automatizaciones
- Mejoras de diseño
- Nuevas vistas/filtros

**Requisitos**:
- No modificar endpoints existentes
- No cambiar estructura de datos
- No tocar servicios canónicos

---

#### 4. Añadir Nuevas Validaciones

**Permitido**: ✅ (si no elimina validaciones existentes)

**Ejemplo**:
```javascript
// ✅ Añadir validación adicional
function validateAutomationDefinition(definition) {
  // Validaciones existentes (mantener)
  validateTrigger(definition.trigger);
  validateSteps(definition.steps);
  
  // Nueva validación (añadir)
  if (definition.steps.length > 100) {
    throw new Error('Máximo 100 steps permitidos');
  }
}
```

**Requisitos**:
- No eliminar validaciones existentes
- No relajar reglas
- Solo añadir protección adicional

---

#### 5. Mejoras de Performance

**Permitido**: ✅ (si no cambia contratos)

**Ejemplos**:
- Optimización de queries SQL
- Caching de resultados
- Paralelización de operaciones

**Requisitos**:
- No cambiar estructura de retorno
- No cambiar flujo canónico
- No modificar contratos

---

#### 6. Añadir Nuevos Endpoints

**Permitido**: ✅ (si no modifican existentes)

**Ejemplos**:
- `POST /admin/api/automations/:id/duplicate` (duplicar)
- `POST /admin/api/automations/:id/export` (exportar)
- `GET /admin/api/automations/:id/history` (historial)

**Requisitos**:
- No modificar endpoints existentes
- No cambiar estructura de datos
- No tocar servicios canónicos

---

#### 7. Añadir Analytics y Métricas

**Permitido**: ✅ (si no modifica contratos)

**Ejemplos**:
- Dashboard de analytics
- Métricas de performance
- Alertas de errores

**Requisitos**:
- Solo lectura (no modifica datos)
- No toca servicios canónicos
- No cambia contratos

---

## CAMBIOS QUE REQUIEREN VERSIÓN MINOR (v1.1.0+)

### ⚠️ Cambios que Extienden Sin Romper

Estos cambios requieren nueva versión minor pero NO rompen contratos:

1. **Añadir Nuevos Modos de Ejecución**
   - Ejemplo: `test_run` además de `dry_run` y `live_run`
   - Requiere: Nueva versión minor (v1.1.0)
   - No rompe: Contratos existentes

2. **Añadir Nuevos Status**
   - Ejemplo: `archived` además de `draft`, `active`, `deprecated`, `broken`
   - Requiere: Nueva versión minor (v1.1.0)
   - No rompe: Status existentes siguen funcionando

3. **Añadir Nuevos Campos Requeridos (con Migración)**
   - Ejemplo: Campo `category` requerido en nuevas automatizaciones
   - Requiere: Nueva versión minor (v1.1.0)
   - No rompe: Automatizaciones existentes siguen funcionando

---

## CAMBIOS QUE REQUIEREN VERSIÓN MAYOR (v2.0.0)

### 🚨 Breaking Changes (Inconstitucionales)

Estos cambios **ROMPEN** contratos congelados y requieren nueva versión mayor:

#### 1. Cambio de Contrato de Retorno

**Ejemplo Incorrecto**:
```javascript
// ❌ BREAKING: Cambiar estructura de retorno
export async function createAutomation(params, client = null) {
  const created = await createDefinition(...);
  return { ok: true, automation: created }; // ❌ BREAKING
}
```

**Impacto**: Todos los tests y código que usan `createAutomation()` se rompen.

**Solución**: Nueva versión mayor (v2.0.0) con migración guiada.

---

#### 2. Cambio de Flujo Canónico

**Ejemplo Incorrecto**:
```javascript
// ❌ BREAKING: Saltarse dispatchSignal()
export async function executeAutomation(definitionId, params) {
  // Ejecutar directamente sin señal
  await runAutomationsForSignal(...); // ❌ BREAKING
}
```

**Impacto**: Rompe el flujo canónico y tests constitucionales.

**Solución**: Nueva versión mayor (v2.0.0) con revisión constitucional completa.

---

#### 3. Eliminación de Prohibiciones

**Ejemplo Incorrecto**:
```javascript
// ❌ BREAKING: Permitir ejecución directa
export async function executeActionDirectly(actionKey, input) {
  const action = getAction(actionKey);
  return await action.handler(input); // ❌ BREAKING
}
```

**Impacto**: Rompe prohibiciones constitucionales y tests.

**Solución**: Nueva versión mayor (v2.0.0) con justificación explícita.

---

#### 4. Modificación de Tests Constitucionales

**Ejemplo Incorrecto**:
```javascript
// ❌ BREAKING: Eliminar test constitucional
// it('debe crear automatización SIEMPRE en status draft', ...) // ❌ ELIMINADO
```

**Impacto**: Elimina protección constitucional.

**Solución**: Nueva versión mayor (v2.0.0) con justificación y nuevos tests.

---

#### 5. Cambio de Estructura de Datos

**Ejemplo Incorrecto**:
```javascript
// ❌ BREAKING: Cambiar estructura de definition
{
  "trigger": {...},
  "actions": [...] // ❌ Cambió de "steps" a "actions"
}
```

**Impacto**: Rompe todas las automatizaciones existentes.

**Solución**: Nueva versión mayor (v2.0.0) con migración de datos.

---

## PROCESO DE EVOLUCIÓN SEGURA

### Paso 1: Evaluar Tipo de Cambio

1. ¿Es extensión o modificación?
2. ¿Rompe contratos congelados?
3. ¿Requiere nueva versión mayor o minor?

### Paso 2: Verificar Tests Constitucionales

```bash
npm test -- tests/automations/automation-constitutional.test.js
```

**Requisito**: Todos los tests deben seguir pasando.

### Paso 3: Documentar Cambio

1. Actualizar `AUTOMATIONS_VERSION.md` si es necesario
2. Actualizar `AUTOMATIONS_EVOLUTION_GUIDE.md` con el nuevo cambio
3. Documentar breaking changes si aplica

### Paso 4: Crear PR con Justificación

1. Explicar por qué el cambio es necesario
2. Demostrar que no rompe contratos (o justificar breaking change)
3. Incluir tests adicionales si es necesario

### Paso 5: Revisión Constitucional

1. Verificar que no rompe contratos congelados
2. Verificar que tests constitucionales pasan
3. Aprobar o rechazar según impacto

---

## EJEMPLOS CONCRETOS DE EVOLUCIÓN

### ✅ Ejemplo 1: Añadir Editor Visual

**Tipo**: Extensión (v1.1.0+)

**Cambios**:
- Nuevo componente UI: `automation-visual-editor.js`
- Nuevo endpoint: `POST /admin/api/automations/validate-preview`
- No modifica servicios canónicos

**Validación**:
- Tests constitucionales pasan ✅
- No rompe contratos ✅

---

### ✅ Ejemplo 2: Añadir Nueva Acción

**Tipo**: Extensión (v1.1.0+)

**Cambios**:
- Nuevo archivo: `automation-actions/student-send-email.js`
- Registro en `action-registry.js`
- No modifica servicios canónicos

**Validación**:
- Tests constitucionales pasan ✅
- No rompe contratos ✅

---

### ❌ Ejemplo 3: Cambiar Contrato de Retorno

**Tipo**: Breaking Change (v2.0.0)

**Cambios**:
- Modificar `createAutomation()` para retornar `{ ok, automation }`
- Rompe todos los tests y código existente

**Validación**:
- Tests constitucionales fallan ❌
- Rompe contratos ❌

**Solución**: Nueva versión mayor con migración guiada.

---

### ❌ Ejemplo 4: Ejecutar Acciones Directamente

**Tipo**: Breaking Change (v2.0.0)

**Cambios**:
- Permitir ejecutar acciones sin pasar por `dispatchSignal()`
- Rompe flujo canónico y tests constitucionales

**Validación**:
- Tests constitucionales fallan ❌
- Rompe prohibiciones constitucionales ❌

**Solución**: Nueva versión mayor con justificación explícita.

---

## CHECKLIST DE EVOLUCIÓN SEGURA

Antes de hacer cualquier cambio, verifica:

- [ ] ¿Es extensión o modificación?
- [ ] ¿Rompe contratos congelados?
- [ ] ¿Requiere nueva versión mayor o minor?
- [ ] ¿Los tests constitucionales siguen pasando?
- [ ] ¿Se documentó el cambio?
- [ ] ¿Se justificó el cambio si es breaking?

---

## CONCLUSIÓN

Esta guía permite evolucionar el sistema de automatizaciones de forma segura:

- ✅ **Extensión**: Añade features sin romper contratos
- ✅ **Protección**: Tests constitucionales protegen el diseño
- ✅ **Claridad**: Guía explícita de qué cambios son seguros
- ✅ **Evolución Controlada**: Proceso claro para breaking changes

**El sistema puede evolucionar sin romperse, siempre que se respeten los contratos congelados.**

---

**FIN DE LA GUÍA DE EVOLUCIÓN**



