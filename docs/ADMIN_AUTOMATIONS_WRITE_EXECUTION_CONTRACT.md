# CONTRATO: ADMIN UI AUTOMATIZACIONES (ESCRITURA Y EJECUCIÓN)
## AuriPortal - Fase D - Fase 7

**Versión**: 1.0  
**Fecha de Certificación**: 2025-01-XX  
**Estado**: ✅ CERTIFICADO  
**Alcance**: Contrato de UI de escritura y ejecución manual para automatizaciones

---

## PROPÓSITO DEL CONTRATO

Este contrato define, de forma explícita y no negociable, cómo funciona la **Admin UI de Automatizaciones** para escritura y ejecución manual en la Fase 7.

### Qué Protege

- **Integridad del Sistema**: Garantiza que toda escritura y ejecución pasa por contratos canónicos
- **Auditabilidad**: Asegura que todas las operaciones son rastreables y reversibles
- **Separación de Responsabilidades**: Impide que la UI ejecute directamente servicios o acciones
- **Seguridad**: Previene ejecuciones accidentales o no autorizadas
- **Consistencia**: Mantiene el flujo canónico incluso en ejecuciones manuales

### Por Qué Existe

Sin este contrato, la UI podría:
- Crear automatizaciones sin validación
- Ejecutar acciones directamente sin pasar por el engine
- Ejecutar automatizaciones sin auditoría
- Saltarse el flujo canónico de señales
- Mutar estado sin pasar por servicios canónicos

Este contrato elimina estas violaciones mediante reglas duras y prohibiciones explícitas.

---

## OPERACIONES PERMITIDAS

### 1. Crear Automatización

**Endpoint**: `POST /admin/api/automations`

**Requisitos**:
- `automation_key`: Clave única (slug)
- `name`: Nombre legible
- `definition`: JSON con estructura válida (trigger, steps)
- `description`: Opcional
- `status`: **SIEMPRE `'draft'` al crear** (no negociable)

**Validaciones OBLIGATORIAS**:
- `automation_key` único (no duplicado)
- `definition` estructura válida (trigger, steps)
- Todos los `action_key` en steps existen en Action Registry
- Schema JSON válido
- `status` debe ser `'draft'` (rechazar si no)

**Auditoría**:
- Registrar en audit log: `action: 'create'`
- `actor: { type: 'admin', id: admin_id }`
- `before: null`
- `after: definition creada`

---

### 2. Editar Automatización

**Endpoint**: `PUT /admin/api/automations/:id`

**Requisitos**:
- Solo campos permitidos pueden actualizarse
- `version` debe incrementarse
- Validar conflicto de versiones (rechazar si versión en BD != versión enviada)

**Validaciones OBLIGATORIAS**:
- Automatización existe
- Versión coincide (prevenir conflictos)
- `definition` estructura válida (si se actualiza)
- Todos los `action_key` existen en Action Registry (si se actualiza definition)
- `status` puede cambiar solo mediante operaciones explícitas (activate/deactivate)

**Auditoría**:
- Registrar en audit log: `action: 'update'`
- `actor: { type: 'admin', id: admin_id }`
- `before: definition anterior`
- `after: definition actualizada`

---

### 3. Activar Automatización

**Endpoint**: `POST /admin/api/automations/:id/activate`

**Requisitos**:
- Automatización debe existir
- `status` debe ser `'draft'` o `'deprecated'`
- Validar que `definition` es válida antes de activar

**Validaciones OBLIGATORIAS**:
- Automatización existe
- Status actual permite activación (no `'broken'`)
- `definition` válida
- Todos los `action_key` existen en Action Registry

**Auditoría**:
- Registrar en audit log: `action: 'activate'`
- `actor: { type: 'admin', id: admin_id }`
- `before: { status: 'draft' }`
- `after: { status: 'active' }`

---

### 4. Desactivar Automatización

**Endpoint**: `POST /admin/api/automations/:id/deactivate`

**Requisitos**:
- Automatización debe existir
- `status` debe ser `'active'`

**Validaciones OBLIGATORIAS**:
- Automatización existe
- Status actual es `'active'`

**Auditoría**:
- Registrar en audit log: `action: 'deactivate'`
- `actor: { type: 'admin', id: admin_id }`
- `before: { status: 'active' }`
- `after: { status: 'deprecated' }`

---

### 5. Ejecutar Automatización Manualmente

**Endpoint**: `POST /admin/api/automations/:id/execute`

**Body**:
```json
{
  "mode": "dry_run" | "live_run",
  "context": {} // Opcional
}
```

**Requisitos**:
- Automatización debe existir
- `status` debe ser `'active'` (rechazar si no)
- `mode` debe ser `'dry_run'` o `'live_run'`

**Validaciones OBLIGATORIAS**:
- Automatización existe
- `status = 'active'` (rechazar si no)
- `mode` válido
- Contexto validado si se proporciona

**Auditoría**:
- Registrar en audit log: `action: 'execute_manual'`
- `actor: { type: 'admin', id: admin_id }`
- `mode: 'dry_run' | 'live_run'`
- Run generado (automation_runs)

---

## MODOS DE EJECUCIÓN

### dry_run

**Descripción**: Ejecución de prueba que no modifica el sistema real.

**Comportamiento**:
- Ejecuta los steps
- NO modifica estado del sistema
- NO registra runs en BD (o los marca como dry_run)
- Devuelve resultados simulados
- Útil para probar antes de ejecutar en vivo

**Uso**: Validar que una automatización funciona antes de ejecutarla en vivo.

---

### live_run

**Descripción**: Ejecución real que modifica el sistema.

**Comportamiento**:
- Ejecuta los steps
- **SÍ modifica estado del sistema** (a través de acciones)
- Registra runs y steps en BD
- Genera señal artificial
- Pasa por dedupe
- Auditable completamente

**Uso**: Ejecutar una automatización en el sistema real.

---

## REGLAS DURAS

### Regla 1: Toda Ejecución Pasa por Automation Engine v2

**Declaración**: Toda ejecución (manual o automática) DEBE pasar por `runAutomationsForSignal()`.

**Implicaciones**:
- ❌ PROHIBIDO: Llamar servicios canónicos directamente
- ❌ PROHIBIDO: Llamar Action Registry directamente
- ❌ PROHIBIDO: Ejecutar steps directamente
- ✅ PERMITIDO: Solo ejecutar vía `runAutomationsForSignal()`

**Razón**: Garantiza consistencia, auditoría y cumplimiento del Contrato D.

---

### Regla 2: Toda Ejecución Genera Señal

**Declaración**: Toda ejecución manual DEBE generar una señal artificial que pasa por el flujo normal.

**Implicaciones**:
- Generar `signal_id` único
- Generar señal artificial con metadata `{ source: { type: 'manual', actor: 'admin:id' } }`
- Pasar señal a `dispatchSignal()` o equivalente
- Señal debe estar claramente marcada como manual

**Razón**: Mantiene consistencia, permite dedupe y auditoría completa.

---

### Regla 3: Toda Ejecución Registra Run y Steps

**Declaración**: Toda ejecución (incluso manual) DEBE registrar `automation_runs` y `automation_run_steps`.

**Implicaciones**:
- Crear registro en `automation_runs`
- Crear registros en `automation_run_steps` por cada step
- Registrar status, input, output, error
- Auditable completamente

**Razón**: Garantiza trazabilidad completa de todas las ejecuciones.

---

### Regla 4: Toda Ejecución Tiene Actor Admin

**Declaración**: Toda ejecución manual DEBE tener `actor: { type: 'admin', id: admin_id }`.

**Implicaciones**:
- Obtener `admin_id` de `requireAdminContext()`
- Pasar actor en metadata de señal
- Registrar actor en audit log
- Registrar actor en runs si aplica

**Razón**: Permite saber quién ejecutó cada automatización.

---

### Regla 5: Nunca Se Ejecutan Acciones Sueltas

**Declaración**: NO se pueden ejecutar acciones individuales sin automatización completa.

**Implicaciones**:
- ❌ PROHIBIDO: Ejecutar `student.updateNivel` directamente
- ✅ PERMITIDO: Ejecutar automatización completa que incluye `student.updateNivel`
- Razón: Mantiene consistencia y auditoría

---

### Regla 6: Nunca Se Salta Dedupe

**Declaración**: Toda ejecución (incluso manual) DEBE pasar por dedupe.

**Implicaciones**:
- Usar `automation_dedup` table
- `dedup_key = signal_id + automation_key`
- Si ya existe → skip (no ejecutar)
- Si no existe → ejecutar y registrar

**Razón**: Previene ejecuciones duplicadas.

---

### Regla 7: Nunca Se Ejecutan Draft/Broken

**Declaración**: SOLO se pueden ejecutar automatizaciones con `status = 'active'`.

**Implicaciones**:
- Validar `status = 'active'` antes de ejecutar
- Rechazar si `status != 'active'`
- Error explícito: "Solo se pueden ejecutar automatizaciones activas"

**Razón**: Previene ejecución de código no probado o roto.

---

## PROHIBICIONES CONSTITUCIONALES

### Prohibición 1: Ejecutar Desde Frontend Directo

**PROHIBIDO**:
```javascript
// ❌ NUNCA HACER ESTO
const action = getAction('student.updateNivel');
await action.handler({ email, nivel });
```

**CORRECTO**:
```javascript
// ✅ CORRECTO
// Frontend → Endpoint → Genera señal → Engine ejecuta
```

**Razón**: Viola Contrato D. Las acciones solo se ejecutan desde el engine.

---

### Prohibición 2: Llamar Servicios Canónicos Desde UI

**PROHIBIDO**:
```javascript
// ❌ NUNCA HACER ESTO
await studentMutationService.updateNivel(email, nivel, { type: 'admin' });
```

**CORRECTO**:
```javascript
// ✅ CORRECTO
// UI llama endpoint → endpoint genera señal → engine ejecuta
```

**Razón**: Viola Contrato B. Las mutaciones solo pasan por servicios canónicos desde el engine.

---

### Prohibición 3: Mutar Estado Fuera de Action Registry

**PROHIBIDO**:
```javascript
// ❌ NUNCA HACER ESTO
await query('UPDATE students SET nivel = $1 WHERE email = $2', [nivel, email]);
```

**CORRECTO**:
```javascript
// ✅ CORRECTO
// Usar acciones registradas en Action Registry
```

**Razón**: Viola Contrato D. Toda mutación pasa por Action Registry.

---

### Prohibición 4: Ejecutar Sin Auditoría

**PROHIBIDO**:
```javascript
// ❌ NUNCA HACER ESTO
await runSteps(steps); // Sin registrar runs/steps
```

**CORRECTO**:
```javascript
// ✅ CORRECTO
// Registrar run y steps antes de ejecutar
```

**Razón**: Viola principio de auditabilidad.

---

### Prohibición 5: Crear Con Status != 'draft'

**PROHIBIDO**:
```javascript
// ❌ NUNCA HACER ESTO
await createAutomation({
  automation_key: 'test',
  status: 'active' // ❌ PROHIBIDO
});
```

**CORRECTO**:
```javascript
// ✅ CORRECTO
await createAutomation({
  automation_key: 'test',
  status: 'draft' // ✅ SIEMPRE draft al crear
});

// Luego, activar separadamente
await activateAutomation('test');
```

**Razón**: Previene activación accidental de código sin probar.

---

### Prohibición 6: Ejecutar Sin Validar Status

**PROHIBIDO**:
```javascript
// ❌ NUNCA HACER ESTO
await executeAutomation(automationKey); // Sin validar status
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

## VALIDACIONES OBLIGATORIAS

### En Creación

1. **Validar `automation_key` único**:
   - Consultar BD si existe
   - Rechazar si existe

2. **Validar `definition` estructura**:
   - `trigger` presente
   - `steps` presente y array no vacío
   - Schema JSON válido

3. **Validar `action_key` en steps**:
   - Todos los `action_key` existen en Action Registry
   - Rechazar si alguno no existe

4. **Validar `status = 'draft'`**:
   - Rechazar si `status != 'draft'`

---

### En Edición

1. **Validar automatización existe**

2. **Validar versión**:
   - Comparar `version` en BD con `version` enviada
   - Rechazar si no coinciden (conflicto)

3. **Validar `definition`** (si se actualiza):
   - Mismas validaciones que en creación

4. **Validar `action_key`** (si se actualiza definition):
   - Todos existen en Action Registry

---

### En Activación

1. **Validar automatización existe**

2. **Validar `status` permite activación**:
   - Rechazar si `status = 'broken'`

3. **Validar `definition` válida**:
   - Estructura válida
   - `action_key` existen

---

### En Ejecución Manual

1. **Validar automatización existe**

2. **Validar `status = 'active'`**:
   - Rechazar si `status != 'active'`

3. **Validar `mode`**:
   - Debe ser `'dry_run'` o `'live_run'`

4. **Validar contexto** (si se proporciona):
   - Validar estructura mínima si es necesario

---

## FLUJO DE EJECUCIÓN MANUAL

### Paso 1: Validación

1. Validar automatización existe
2. Validar `status = 'active'`
3. Validar `mode` válido
4. Validar contexto si se proporciona

---

### Paso 2: Generar Señal Artificial

1. Generar `signal_id` único (UUID)
2. Construir señal artificial:
   ```javascript
   {
     signal_id: uuid,
     signal_type: automation.definition.trigger.signalType,
     payload: context || {},
     metadata: {
       source: { type: 'manual', actor: { type: 'admin', id: admin_id } },
       trace_id: uuid,
       day_key: today,
       executed_at: now()
     }
   }
   ```

---

### Paso 3: Emitir Señal

1. Si `mode = 'dry_run'`:
   - Llamar `runAutomationsForSignal()` con flag `dryRun: true`
   - NO persistir señal en BD
   - NO modificar estado del sistema

2. Si `mode = 'live_run'`:
   - Persistir señal en `pde_signal_emissions`
   - Llamar `runAutomationsForSignal()` (normal)
   - SÍ modifica estado del sistema

---

### Paso 4: Ejecutar Engine

1. `runAutomationsForSignal()` se ejecuta
2. Resuelve automatizaciones activas
3. Verifica dedupe
4. Crea `automation_runs`
5. Ejecuta steps
6. Crea `automation_run_steps`
7. Registra resultados

---

### Paso 5: Retornar Resultado

1. Retornar resultado de ejecución
2. Incluir `run_id`
3. Incluir `steps` con status
4. Incluir errores si hay

---

## RELACIÓN CON CONTRATOS EXISTENTES

### Contrato A (Creación de Entidades Vivas)

**Relación**: Las automatizaciones no son "entidades vivas" en el sentido del Contrato A. Son reglas de configuración. Este contrato NO aplica directamente.

---

### Contrato B (Mutación de Entidades Vivas)

**Relación**: Las automatizaciones NO mutan directamente. Mutan a través de acciones que usan servicios canónicos. Este contrato se cumple indirectamente.

---

### Contrato C (Señales Canónicas)

**Relación**: Las ejecuciones manuales generan señales artificiales que pasan por el mismo flujo que señales reales. Se cumple el Contrato C.

---

### Contrato D (Automatizaciones Canónicas)

**Relación**: Este contrato EXTRAE las reglas del Contrato D para escritura y ejecución manual. Todas las reglas del Contrato D se mantienen.

---

## REGLAS NO NEGOCIABLES

### Regla 1: Ejecución Solo Vía Engine

**Está PROHIBIDO ejecutar automatizaciones sin pasar por Automation Engine v2**.

**Razón**: Garantiza consistencia, auditoría y cumplimiento del Contrato D.

---

### Regla 2: Ejecución Solo de Automatizaciones Activas

**Está PROHIBIDO ejecutar automatizaciones con `status != 'active'`**.

**Razón**: Previene ejecución de código no probado o roto.

---

### Regla 3: Creación Solo en Draft

**Está PROHIBIDO crear automatizaciones con `status != 'draft'`**.

**Razón**: Previene activación accidental de código sin probar.

---

### Regla 4: Versionado Obligatorio

**Está PROHIBIDO actualizar automatizaciones sin incrementar `version` y validar conflicto**.

**Razón**: Previene sobrescritura de cambios concurrentes.

---

### Regla 5: Validación de Action Keys

**Está PROHIBIDO guardar automatizaciones con `action_key` que no existen en Action Registry**.

**Razón**: Previene fallos en runtime.

---

### Regla 6: Auditoría Obligatoria

**Está PROHIBIDO crear, editar o ejecutar sin registrar en audit log**.

**Razón**: Garantiza trazabilidad completa.

---

## ESTADO DEL SISTEMA

### Declaración de Certificación

**Este contrato CERTIFICA lo que DEBE existir en la Fase 7**.

**Estado**: ⏳ A IMPLEMENTAR

### El Documento Certifica, No Promete

**Declaración**: Este documento NO es una promesa de implementación futura. Es una certificación de lo que DEBE existir cuando se implemente la Fase 7.

**Implicaciones**:
- El contrato está activo y operativo (cuando se implemente)
- La UI de Fase 7 debe cumplir el contrato
- Futuras fases pueden extender el contrato, pero deben mantener estas reglas

---

## CONCLUSIÓN

Este contrato define el estándar obligatorio para la Admin UI de Automatizaciones en la Fase 7 (Escritura y Ejecución).

**Estado**: ✅ CERTIFICADO

**Alcance**: UI de escritura y ejecución manual para automatizaciones

**Extensibilidad**: Futuras fases pueden añadir operaciones adicionales, pero deben cumplir las reglas duras de este contrato.

**Vigencia**: Este contrato es constitucional y no negociable. Cualquier violación es una regresión arquitectónica.

---

**FIN DEL CONTRATO**




