# FREEZE CONSTITUCIONAL: SISTEMA DE AUTOMATIZACIONES
## AuriPortal - Congelación Formal de Contratos

**Fecha de Freeze**: 2025-01-XX  
**Versión Congelada**: v1.0.0-canonic  
**Estado**: ✅ CONGELADO  
**Fase**: D.9 - Versionado y Freeze Constitucional

---

## PROPÓSITO DE ESTE DOCUMENTO

Este documento declara formalmente qué contratos, tests y archivos quedan **CONGELADOS** en el sistema de automatizaciones. Cualquier modificación que rompa estos contratos es **INCONSTITUCIONAL** y requiere nueva versión mayor.

---

## CONTRATOS CONGELADOS

### 1. Contrato de Retorno de Servicios Canónicos

#### ✅ `createAutomation(params, client = null)`

**Contrato Congelado**:
- Retorna directamente el objeto de definición creado (NO envuelto)
- Estructura: `{ id, automation_key, name, description, definition, version, status, created_at, updated_at, created_by, updated_by }`
- Siempre `status = 'draft'` y `version = 1`
- Lanza excepción (`throw Error`) en caso de error

**Prohibido**:
- ❌ Envolver retorno en `{ ok, automation }`
- ❌ Cambiar estructura de retorno
- ❌ Retornar `null` en caso de éxito
- ❌ Cambiar manejo de errores (de excepciones a objetos)

---

#### ✅ `updateAutomation(definitionId, params, client = null)`

**Contrato Congelado**:
- Retorna directamente el objeto de definición actualizado (NO envuelto)
- Estructura: `{ id, automation_key, name, description, definition, version, status, created_at, updated_at, created_by, updated_by }`
- Incrementa `version` automáticamente
- Valida `expectedVersion` en `params`
- Lanza excepción si conflicto de versión

**Prohibido**:
- ❌ Envolver retorno en `{ ok, automation }`
- ❌ Cambiar estructura de retorno
- ❌ Eliminar validación de versiones
- ❌ Cambiar manejo de errores

---

#### ✅ `activateAutomation(definitionId, params, client = null)`

**Contrato Congelado**:
- Parámetros: `params` debe contener `actor: { type: 'admin', id: string }`
- Retorna directamente el objeto de definición actualizado (NO envuelto)
- Cambia `status` a `'active'`
- Versión NO cambia
- Lanza excepción si status no permite activación

**Prohibido**:
- ❌ Envolver retorno en `{ ok, automation }`
- ❌ Cambiar estructura de retorno
- ❌ Permitir activar `broken` o `active`
- ❌ Cambiar manejo de errores

---

#### ✅ `deactivateAutomation(definitionId, params, client = null)`

**Contrato Congelado**:
- Parámetros: `params` debe contener `actor: { type: 'admin', id: string }`
- Retorna directamente el objeto de definición actualizado (NO envuelto)
- Cambia `status` de `'active'` a `'deprecated'`
- Lanza excepción si status no es `'active'`

**Prohibido**:
- ❌ Envolver retorno en `{ ok, automation }`
- ❌ Cambiar estructura de retorno
- ❌ Permitir desactivar status ≠ `'active'`
- ❌ Cambiar manejo de errores

---

#### ✅ `executeAutomation(definitionId, params)`

**Contrato Congelado**:
- Parámetros: `params` debe contener `{ mode: 'dry_run' | 'live_run', context: {}, actor: { type: 'admin', id: string } }`
- Retorna: `{ ok: true, mode, signal_id, signal_type, trace_id, automation_id, automation_key, dispatch_result, message }`
- Lanza excepción si status no es `'active'`
- Lanza excepción si `dispatchSignal()` falla

**Prohibido**:
- ❌ Cambiar estructura de retorno (debe mantener `ok: true`)
- ❌ Eliminar campos requeridos (`signal_id`, `trace_id`, `automation_key`)
- ❌ Cambiar manejo de errores (de excepciones a objetos)
- ❌ Ejecutar sin llamar `dispatchSignal()`

---

### 2. Contrato de Flujo Canónico

#### ✅ Flujo: Señal → Engine → Runs → Steps

**Contrato Congelado**:
1. Toda ejecución debe generar una señal (artificial o real)
2. La señal debe pasar por `dispatchSignal()`
3. `dispatchSignal()` debe llamar `runAutomationsForSignal()`
4. El engine debe ejecutar automatizaciones activas
5. Se deben registrar runs y steps en PostgreSQL
6. Se debe aplicar deduplicación

**Prohibido**:
- ❌ Ejecutar acciones directamente sin señal
- ❌ Saltarse `dispatchSignal()`
- ❌ Saltarse `runAutomationsForSignal()`
- ❌ Ejecutar sin registrar runs/steps
- ❌ Ejecutar sin deduplicación

---

### 3. Contrato de Separación Escritura / Ejecución

#### ✅ Escritura Separada de Ejecución

**Contrato Congelado**:
- Escritura: `automation-write-service.js` (NO ejecuta)
- Ejecución: `automation-execution-service.js` (NO escribe)
- UI de escritura: NO puede ejecutar directamente
- UI de ejecución: NO puede escribir directamente

**Prohibido**:
- ❌ Mezclar escritura y ejecución en un solo servicio
- ❌ Permitir que UI ejecute directamente
- ❌ Permitir que UI escriba directamente sin validación

---

### 4. Contrato de Validación de Definiciones

#### ✅ Validación Estricta Antes de Guardar

**Contrato Congelado**:
- `automation-definition-validator.js` valida ANTES de guardar
- Debe validar: JSON válido, trigger, steps, action_keys, onError, parallel_groups
- Debe rechazar explícitamente (lanzar excepción) si inválido
- NO puede retornar booleanos silenciosos

**Prohibido**:
- ❌ Guardar sin validar
- ❌ Validar solo en frontend
- ❌ Retornar `false` silenciosamente
- ❌ Permitir definiciones inválidas

---

### 5. Contrato de Uso Obligatorio de dispatchSignal()

#### ✅ Toda Ejecución Pasa por dispatchSignal()

**Contrato Congelado**:
- `executeAutomation()` DEBE llamar `dispatchSignal()`
- NO puede ejecutar acciones directamente
- NO puede llamar `runAutomationsForSignal()` directamente
- NO puede mutar estado directamente

**Prohibido**:
- ❌ Ejecutar acciones sueltas
- ❌ Llamar Action Registry directamente para ejecutar
- ❌ Mutar estado sin pasar por señales
- ❌ Bypass del flujo canónico

---

## TESTS CONGELADOS (GUARDIANES CONSTITUCIONALES)

### ✅ Archivo: `tests/automations/automation-constitutional.test.js`

**14 Tests Constitucionales Congelados**:

1. ✅ `debe crear automatización SIEMPRE en status draft`
2. ✅ `debe rechazar creación con status active explícito`
3. ✅ `debe rechazar definición con schema inválido`
4. ✅ `debe detectar conflicto de versiones en actualización`
5. ✅ `debe activar automatización en draft válido`
6. ✅ `debe rechazar activar automatización broken`
7. ✅ `debe rechazar activar automatización dos veces`
8. ✅ `debe rechazar ejecutar automatización en draft`
9. ✅ `debe rechazar ejecutar automatización deprecated`
10. ✅ `debe ejecutar automatización active en modo dry_run`
11. ✅ `debe ejecutar automatización active en modo live_run`
12. ✅ `debe generar signal_id y trace_id en ejecución`
13. ✅ `executeAutomation debe estar definido y NO importar action-registry directamente`
14. ✅ `executeAutomation debe llamar dispatchSignal (no ejecutar acciones directamente)`

**Prohibido**:
- ❌ Eliminar tests constitucionales
- ❌ Relajar validaciones en tests
- ❌ Añadir bypasses en tests
- ❌ Modificar tests para "hacer pasar" código que rompe contratos

---

## ARCHIVOS CONGELADOS (NO MODIFICAR SIN VERSIÓN MAYOR)

### ✅ Servicios Canónicos

1. **`src/core/automations/automation-write-service.js`**
   - Contratos de retorno congelados
   - Estructura de métodos congelada
   - Manejo de errores congelado

2. **`src/core/automations/automation-execution-service.js`**
   - Contrato de retorno congelado
   - Flujo canónico congelado (debe llamar `dispatchSignal()`)
   - Manejo de errores congelado

3. **`src/core/automations/automation-definition-validator.js`**
   - Reglas de validación congeladas
   - Estructura de validación congelada
   - Mensajes de error congelados

### ✅ Engine y Dispatcher

4. **`src/core/automations/automation-engine-v2.js`**
   - Flujo canónico congelado
   - Estructura de ejecución congelada
   - Integración con señales congelada

5. **`src/core/signals/signal-dispatcher.js`**
   - Integración con engine congelada
   - Estructura de retorno congelada
   - Flujo de señales congelado

### ✅ Tests Constitucionales

6. **`tests/automations/automation-constitutional.test.js`**
   - Tests congelados (14 tests)
   - Validaciones congeladas
   - Protecciones congeladas

---

## TIPO DE CAMBIOS QUE REQUIEREN NUEVA VERSIÓN MAYOR

### 🚨 Breaking Changes (v2.0.0)

1. **Cambio de Contrato de Retorno**
   - Envolver retornos en nuevas estructuras
   - Cambiar estructura de objetos retornados
   - Cambiar manejo de errores (de excepciones a objetos)

2. **Cambio de Flujo Canónico**
   - Saltarse `dispatchSignal()`
   - Ejecutar acciones directamente
   - Mutar estado sin señales

3. **Eliminación de Prohibiciones**
   - Permitir ejecución directa
   - Permitir escritura sin validación
   - Permitir bypass del engine

4. **Modificación de Tests Constitucionales**
   - Eliminar tests
   - Relajar validaciones
   - Añadir bypasses

5. **Cambio de Estructura de Datos**
   - Cambiar schema de `automation_definitions`
   - Cambiar estructura de `definition` JSON
   - Cambiar estructura de runs/steps

---

## DECLARACIÓN DE FREEZE

**A partir de esta fecha (2025-01-XX), los contratos, tests y archivos documentados en este freeze están CONGELADOS.**

Cualquier modificación que:
- ❌ Rompa contratos de retorno
- ❌ Rompa flujo canónico
- ❌ Elimine prohibiciones constitucionales
- ❌ Modifique tests constitucionales
- ❌ Bypasee el engine o dispatcher

Es **INCONSTITUCIONAL** y requiere:
- Nueva versión mayor (v2.0.0)
- Actualización de este documento de freeze
- Revisión constitucional completa

---

## EXCEPCIONES (CAMBIOS PERMITIDOS SIN VERSIÓN MAYOR)

### ✅ Cambios Permitidos (v1.1.0+)

1. **Añadir Nuevas Acciones al Action Registry**
   - No rompe contratos existentes
   - No modifica servicios canónicos
   - Solo extiende funcionalidad

2. **Mejoras de UI/UX**
   - No toca contratos de backend
   - No modifica servicios canónicos
   - Solo mejora experiencia de usuario

3. **Mejoras de Performance**
   - No cambia contratos
   - No modifica estructura de retorno
   - Solo optimiza implementación

4. **Añadir Nuevas Validaciones**
   - No elimina validaciones existentes
   - No relaja reglas
   - Solo añade protección adicional

5. **Mejoras de Documentación**
   - No modifica código
   - Solo clarifica o extiende documentación

---

## CONCLUSIÓN

Este freeze constitucional sella el sistema de automatizaciones como:
- ✅ **Completo**: Funcionalidad completa implementada
- ✅ **Gobernado**: Contratos explícitos y documentados
- ✅ **Protegido**: Tests constitucionales como guardianes
- ✅ **Congelado**: Contratos estables y no negociables
- ✅ **Evolucionable**: Guía clara para cambios futuros

**El pasado queda sellado. El futuro queda gobernado.**

---

**FIN DEL DOCUMENTO DE FREEZE CONSTITUCIONAL**









