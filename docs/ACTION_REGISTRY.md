# ACTION REGISTRY CANÓNICO
## AuriPortal - Fase D - Fase 3

**Versión**: 1.0  
**Fecha**: 2025-01-XX  
**Estado**: ✅ IMPLEMENTADO  
**Archivo**: `src/core/actions/automation-action-registry.js`

---

## QUÉ ES EL ACTION REGISTRY

El **Action Registry** es un registro canónico de todas las acciones que pueden ser ejecutadas por automatizaciones.

### Definición

Un **Action Registry** es:
- Un catálogo centralizado de acciones disponibles
- Un punto de validación de inputs antes de ejecutar
- Un contrato entre automatizaciones y servicios canónicos
- Una capa de seguridad que impide ejecutar código no registrado

### Propósito

El Action Registry:
- **Registra** acciones con schema y handler
- **Valida** inputs antes de ejecutar
- **Ejecuta** acciones usando servicios canónicos (Contrato B)
- **Prohíbe** ejecutar código inline o no registrado

---

## QUÉ NO ES EL ACTION REGISTRY

### No es un Motor de Automatizaciones

El Action Registry:
- ❌ NO ejecuta automatizaciones
- ❌ NO consume señales
- ❌ NO decide qué acciones ejecutar
- ❌ NO orquesta flujos

El Action Registry:
- ✅ SOLO registra acciones
- ✅ SOLO valida inputs
- ✅ SOLO ejecuta acciones cuando se le solicita

### No es un Servicio de Negocio

El Action Registry:
- ❌ NO calcula reglas de progresión
- ❌ NO decide políticas del sistema
- ❌ NO muta estado directamente

El Action Registry:
- ✅ SOLO delega a servicios canónicos (Contrato B)
- ✅ SOLO coordina la ejecución
- ✅ SOLO valida inputs

---

## LISTA DE ACCIONES REGISTRADAS

### Acciones Mínimas Requeridas

Las siguientes acciones están registradas y usan `StudentMutationService` (Contrato B):

#### 1. `student.updateNivel`

**Descripción**: Actualiza el nivel de un alumno

**Schema**:
```javascript
{
  email: 'string',
  nivel: 'number'
}
```

**Handler**: Usa `StudentMutationService.updateNivel()`

**Actor**: `{ type: 'system' }`

**Side Effects**: `mutates_state`

---

#### 2. `student.updateStreak`

**Descripción**: Actualiza la racha diaria de un alumno

**Schema**:
```javascript
{
  email: 'string',
  streak: 'number'
}
```

**Handler**: Usa `StudentMutationService.updateStreak()`

**Actor**: `{ type: 'system' }`

**Side Effects**: `mutates_state`

---

#### 3. `student.updateUltimaPractica`

**Descripción**: Actualiza la fecha de última práctica de un alumno

**Schema**:
```javascript
{
  email: 'string',
  fecha: 'string'
}
```

**Handler**: Usa `StudentMutationService.updateUltimaPractica()`

**Actor**: `{ type: 'system' }`

**Side Effects**: `mutates_state`

---

#### 4. `student.updateEstadoSuscripcion`

**Descripción**: Actualiza el estado de suscripción de un alumno

**Schema**:
```javascript
{
  email: 'string',
  estado: 'string',
  fechaReactivacion: 'string'  // Opcional
}
```

**Handler**: Usa `StudentMutationService.updateEstadoSuscripcion()`

**Actor**: `{ type: 'system' }`

**Side Effects**: `mutates_state`

---

#### 5. `student.updateApodo`

**Descripción**: Actualiza el apodo de un alumno

**Schema**:
```javascript
{
  email: 'string',
  apodo: 'string'
}
```

**Handler**: Usa `StudentMutationService.updateApodo()`

**Actor**: `{ type: 'system' }`

**Side Effects**: `mutates_state`

---

## RELACIÓN CON CONTRATOS B Y D

### Contrato B: Mutación de Entidades Vivas

**Obligación**:
- Toda mutación DEBE usar servicios canónicos
- Toda mutación DEBE preparar señal
- Toda mutación DEBE auditar

**Relación con Action Registry**:
- Las acciones registradas DEBEN usar servicios canónicos (Contrato B)
- No se puede mutar estado directamente desde acciones
- Las acciones son wrappers que llaman a servicios canónicos

**Ejemplo**:
```javascript
// Acción registrada
registerAction({
  key: 'student.updateStreak',
  handler: async (input) => {
    // Usa servicio canónico (Contrato B)
    const service = getStudentMutationService();
    return await service.updateStreak(
      input.email,
      input.streak,
      { type: 'system' } // Actor: sistema (automatización)
    );
  }
});
```

### Contrato D: Automatizaciones Canónicas

**Obligación**:
- Las automatizaciones SOLO ejecutan acciones registradas
- No se puede ejecutar código inline
- No se puede ejecutar funciones ad-hoc

**Relación con Action Registry**:
- El Action Registry es el ÚNICO punto de ejecución de acciones
- Las automatizaciones buscan acciones en el registry
- Si una acción no está registrada, la automatización falla explícitamente

**Ejemplo**:
```javascript
// Automatización ejecuta acción registrada
const action = getAction('student.updateStreak');
if (!action) {
  throw new Error('Action not registered: student.updateStreak');
}
await action.handler(resolvedInput);
```

---

## API DEL ACTION REGISTRY

### `registerAction(definition)`

Registra una nueva acción en el registry.

**Parámetros**:
- `key` (string): Clave única de la acción
- `description` (string): Descripción human-readable
- `schema` (object): Schema de validación (ej: `{ email: 'string', nivel: 'number' }`)
- `handler` (function): Handler async que ejecuta la acción
- `sideEffectsLevel` (string): Nivel de efectos secundarios (`mutates_state`, `reads_only`, `external`)

**Ejemplo**:
```javascript
registerAction({
  key: 'student.updateNivel',
  description: 'Actualiza el nivel de un alumno',
  schema: {
    email: 'string',
    nivel: 'number'
  },
  handler: async (input) => {
    const service = getStudentMutationService();
    return await service.updateNivel(input.email, input.nivel, { type: 'system' });
  },
  sideEffectsLevel: 'mutates_state'
});
```

---

### `getAction(key)`

Obtiene una acción registrada por su clave.

**Parámetros**:
- `key` (string): Clave de la acción

**Retorna**: Definición de la acción o `null` si no existe

**Ejemplo**:
```javascript
const action = getAction('student.updateNivel');
if (!action) {
  throw new Error('Action not registered');
}
```

---

### `validateActionInput(key, input)`

Valida un input contra el schema de una acción.

**Parámetros**:
- `key` (string): Clave de la acción
- `input` (object): Input a validar

**Retorna**: `{ valid: boolean, errors?: string[] }`

**Ejemplo**:
```javascript
const validation = validateActionInput('student.updateNivel', {
  email: 'test@example.com',
  nivel: 5
});

if (!validation.valid) {
  throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
}
```

---

### `getAllActions()`

Lista todas las acciones registradas.

**Retorna**: Array de definiciones de acciones

**Ejemplo**:
```javascript
const actions = getAllActions();
console.log(`Total de acciones: ${actions.length}`);
```

---

## PROHIBICIONES EXPLÍCITAS

### Está PROHIBIDO

1. ❌ Ejecutar código inline desde acciones
2. ❌ Mutar estado directamente desde acciones
3. ❌ Llamar repositorios directamente desde acciones
4. ❌ Emitir señales desde acciones
5. ❌ Ejecutar automatizaciones desde acciones
6. ❌ Registrar acciones que no usan servicios canónicos (Contrato B)

### Está PERMITIDO

1. ✅ Registrar acciones que usan servicios canónicos
2. ✅ Validar inputs con schema
3. ✅ Documentar acciones registradas
4. ✅ Preparar estructura para Automation Engine (Fase 4)

---

## ESTADO ACTUAL

**Fase 3 (Action Registry)**: ✅ **IMPLEMENTADO**

**Acciones Registradas**: 5 acciones mínimas

**Servicios Canónicos Usados**: `StudentMutationService` (Contrato B)

**Próximo Paso**: Fase 4 (Automation Engine)

---

## CONCLUSIÓN

El Action Registry canónico está implementado y listo para ser usado por el Automation Engine (Fase 4).

Todas las acciones registradas cumplen con:
- ✅ Contrato B (usan servicios canónicos)
- ✅ Contrato D (están registradas, no son código inline)
- ✅ Validación de inputs
- ✅ Actor `{ type: 'system' }` para automatizaciones

---

**FIN DEL DOCUMENTO**




