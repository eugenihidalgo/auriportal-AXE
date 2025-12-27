# CONTRATO CANÓNICO DE AUTOMATIZACIONES DEL SISTEMA
## AuriPortal - Fase D Certificada

**Versión**: 1.0  
**Fecha de Certificación**: 2025-01-XX  
**Estado**: ✅ IMPLEMENTADO Y CERTIFICADO  
**Alcance**: Automatizaciones canónicas en AuriPortal

---

## 1. PROPÓSITO DEL CONTRATO

Este contrato define, de forma explícita y no negociable, cómo funcionan las "automatizaciones" en AuriPortal.

### Qué Protege

- **Separación de Responsabilidades**: Garantiza que automatizaciones consumen señales emitidas, no preparadas.
- **Integridad del Flujo**: Impide que automatizaciones muten estado directamente, deben usar servicios canónicos (Contrato B).
- **Idempotencia**: Asegura que automatizaciones no se ejecutan dos veces para la misma señal.
- **Auditabilidad**: Garantiza que todas las ejecuciones son rastreables y reversibles.
- **Extensibilidad Controlada**: Permite añadir nuevas automatizaciones sin violar principios constitucionales.

### Por Qué Existe

Antes de este contrato, las automatizaciones podían:
- Ejecutarse desde señales preparadas (no emitidas)
- Mutar estado directamente sin pasar por servicios canónicos
- Ejecutarse múltiples veces para la misma señal
- No ser auditables ni reversibles

Este contrato elimina estas violaciones mediante principios constitucionales claros.

### Qué Problemas Evita

- Automatizaciones que consumen señales preparadas (no emitidas)
- Automatizaciones que mutan estado directamente
- Automatizaciones que ejecutan acciones no registradas
- Automatizaciones sin dedupe/idempotencia
- Automatizaciones sin auditoría
- Automatizaciones que no respetan feature flags

---

## 2. DEFINICIÓN FORMAL DE AUTOMATIZACIÓN

### Automatización

Una **Automatización** es una regla que reacciona a señales emitidas y ejecuta acciones registradas.

Una automatización:
- Consume señales emitidas (no preparadas)
- Ejecuta acciones desde Action Registry
- NO muta estado directamente
- Es idempotente (no se ejecuta dos veces)
- Es auditable (runs + steps registrados)
- Respeta feature flags

### Diferencia con Señal

**Automatización**:
- Reacciona a señales emitidas
- Ejecuta acciones
- Modifica el sistema (a través de acciones)

**Señal**:
- Describe un hecho ocurrido
- Es un dato, no una ejecución
- No modifica el sistema

### Diferencia con Acción

**Automatización**:
- Es una regla (trigger → steps)
- Se ejecuta cuando se emite señal
- Orquesta múltiples acciones

**Acción**:
- Es una operación atómica
- Se ejecuta desde Action Registry
- Modifica el sistema (usando servicios canónicos)

---

## 3. SEPARACIÓN DE RESPONSABILIDADES

### Consumir Señal Emitida ≠ Consumir Señal Preparada

**Declaración**: Las automatizaciones consumen señales emitidas, no preparadas.

**Señal Emitida**:
- Fue enviada a consumidores
- Tiene signal_id único
- Está persistida en `pde_signal_emissions`
- Puede ser consumida por automatizaciones

**Señal Preparada**:
- Solo está estructurada, no emitida
- No tiene signal_id
- No está persistida
- NO puede ser consumida por automatizaciones

### Ejecutar Acción ≠ Mutar Estado Directo

**Declaración**: Las automatizaciones ejecutan acciones, no mutan estado directamente.

**Ejecutar Acción**:
- Llama a Action Registry
- La acción usa servicios canónicos (Contrato B)
- El servicio canónico muta estado
- Todo es auditable y reversible

**Mutar Estado Directo**:
- Escribe directamente en PostgreSQL
- Bypasa servicios canónicos
- Viola Contrato B
- No es auditable ni reversible

### Automatización ≠ Servicio Canónico

**Declaración**: Las automatizaciones NO son servicios canónicos de creación/mutación.

**Automatización**:
- Reacciona a señales
- Ejecuta acciones
- Orquesta flujos

**Servicio Canónico**:
- Crea o muta entidades vivas
- Registra auditoría
- Prepara señales
- NO ejecuta automatizaciones

---

## 4. PRINCIPIOS CONSTITUCIONALES

### Principio 1: Consumir Señal Emitida

**Declaración**: Las automatizaciones SOLO consumen señales emitidas.

**Implicaciones**:
- No consumen señales preparadas
- Requieren signal_id único
- La señal debe estar persistida
- La señal debe haber sido emitida por signal-dispatcher

### Principio 2: Ejecutar Acciones Registradas

**Declaración**: Las automatizaciones SOLO ejecutan acciones registradas en Action Registry.

**Implicaciones**:
- No ejecutan acciones ad-hoc
- No ejecutan código inline
- Todas las acciones están registradas
- Las acciones tienen schema y validación

### Principio 3: NO Mutar Estado Directo

**Declaración**: Las automatizaciones NO mutan estado directamente.

**Implicaciones**:
- No escriben directamente en PostgreSQL
- No llaman repositorios directamente
- Usan servicios canónicos (Contrato B)
- Respetan separación de responsabilidades

### Principio 4: Idempotencia Obligatoria

**Declaración**: Toda automatización DEBE ser idempotente.

**Implicaciones**:
- Dedupe por `signal_id:automation_key`
- No se ejecuta dos veces para la misma señal
- Tabla `automation_dedup` garantiza unicidad
- Fail-safe si dedupe falla

### Principio 5: Auditoría Obligatoria

**Declaración**: Toda ejecución de automatización DEBE ser auditable.

**Implicaciones**:
- Registro en `automation_runs`
- Registro de cada paso en `automation_run_steps`
- Estado, timestamps, inputs, outputs
- Errores registrados explícitamente

### Principio 6: Feature Flag Obligatorio

**Declaración**: El motor de automatizaciones DEBE respetar feature flags.

**Implicaciones**:
- Feature flag: `AUTOMATIONS_ENGINE_ENABLED`
- Estados: `OFF` → `BETA` → `ON`
- Si flag OFF: no ejecuta automatizaciones
- Si flag BETA: solo en dev/beta
- Si flag ON: todos los entornos

### Principio 7: Fail-Open vs Fail-Closed

**Declaración**: Las automatizaciones tienen estrategias de manejo de errores configurables.

**Implicaciones**:
- Por defecto: si step falla → run failed (fail-closed)
- Si `onError: 'continue'` → step failed pero run continúa
- Si `onError: 'skip'` → step skipped
- Configurable por step en definición

### Principio 8: PostgreSQL es Única Autoridad

**Declaración**: PostgreSQL es el ÚNICO Source of Truth para automatizaciones.

**Implicaciones**:
- Definiciones en `automation_definitions`
- Ejecuciones en `automation_runs` y `automation_run_steps`
- Dedupe en `automation_dedup`
- Sin migración aplicada = no existe

---

## 5. ESTRUCTURA CANÓNICA DE UNA AUTOMATIZACIÓN

### Formato Obligatorio

```javascript
{
  automation_key: string,      // Clave única (slug)
  name: string,               // Nombre legible
  description: string,        // Descripción opcional
  definition: {
    trigger: {
      signalType: string      // Tipo de señal que dispara (ej: 'student.practice_registered')
    },
    steps: [
      {
        actionKey: string,    // Clave de acción registrada (ej: 'student.updateStreak')
        inputTemplate: {     // Template para input (puede usar variables de señal)
          email: '{{payload.entity.email}}',
          streak: '{{payload.newState.streak}}'
        },
        onError: 'fail' | 'continue' | 'skip'  // Estrategia de error
      }
    ],
    parallel_groups: []       // (Opcional) Grupos de steps paralelos
  },
  version: number,            // Versión de la definición
  status: 'draft' | 'active' | 'deprecated' | 'broken'
}
```

### Campos Obligatorios

- `automation_key`: Identificador único
- `name`: Nombre legible
- `definition.trigger.signalType`: Tipo de señal que dispara
- `definition.steps[]`: Array de pasos (mínimo 1)
- `definition.steps[].actionKey`: Clave de acción registrada
- `definition.steps[].inputTemplate`: Template para input
- `status`: Estado de la automatización

### Campos Opcionales

- `description`: Descripción
- `definition.steps[].onError`: Estrategia de error (default: 'fail')
- `definition.parallel_groups`: Grupos paralelos

---

## 6. DÓNDE SE EJECUTAN AUTOMATIZACIONES

### Automation Engine

**Declaración**: Las automatizaciones se ejecutan en el Automation Engine.

**Estado Actual**: `src/core/automation/automation-engine.js`

**Flujo**:
1. Señal emitida → `signal-dispatcher.js`
2. Dispatcher → `automation-engine.js`
3. Engine busca automatizaciones activas para `signalType`
4. Para cada automatización:
   - Verifica dedupe
   - Crea `automation_run`
   - Ejecuta steps
   - Registra `automation_run_steps`
   - Finaliza run

### Integración con Emisión de Señales

**Declaración**: Las automatizaciones se ejecutan cuando se emite una señal.

**Punto de Integración**: `signal-dispatcher.js` llama a `automation-engine.js`

**Protección**: Feature flag `AUTOMATIONS_ENGINE_ENABLED`

---

## 7. DÓNDE ESTÁ PROHIBIDO EJECUTAR AUTOMATIZACIONES

### Prohibiciones Absolutas

1. **Está PROHIBIDO ejecutar automatizaciones desde servicios canónicos de creación/mutación**
   - Los servicios canónicos solo preparan señales, no las emiten
   - Las automatizaciones se ejecutan cuando se emite la señal
   - No se ejecutan durante create* ni update*

2. **Está PROHIBIDO ejecutar automatizaciones desde señales preparadas**
   - Las automatizaciones consumen señales emitidas
   - Las señales preparadas no tienen signal_id
   - Las señales preparadas no están persistidas

3. **Está PROHIBIDO mutar estado directamente desde automatizaciones**
   - Las automatizaciones ejecutan acciones
   - Las acciones usan servicios canónicos (Contrato B)
   - No se escribe directamente en PostgreSQL

4. **Está PROHIBIDO ejecutar acciones no registradas**
   - Todas las acciones deben estar en Action Registry
   - No se ejecuta código inline
   - No se ejecutan funciones ad-hoc

5. **Está PROHIBIDO omitir dedupe/idempotencia**
   - Toda automatización debe verificar dedupe
   - No se ejecuta dos veces para la misma señal
   - Tabla `automation_dedup` es obligatoria

6. **Está PROHIBIDO omitir auditoría**
   - Toda ejecución debe registrarse en `automation_runs`
   - Todo paso debe registrarse en `automation_run_steps`
   - Errores deben registrarse explícitamente

7. **Está PROHIBIDO ejecutar sin feature flag**
   - El motor debe verificar `AUTOMATIONS_ENGINE_ENABLED`
   - Si flag OFF: no ejecuta
   - Si flag BETA: solo dev/beta
   - Si flag ON: todos los entornos

---

## 8. RELACIÓN CON CONTRATOS A, B Y C

### Contrato A: Creación de Entidades Vivas

**Obligación**:
- Toda creación DEBE preparar señal
- La señal NO se emite durante la creación

**Relación con Automatizaciones**:
- Cuando se emite la señal (después de creación), automatizaciones pueden reaccionar
- Las automatizaciones NO se ejecutan durante la creación

### Contrato B: Mutación de Entidades Vivas

**Obligación**:
- Toda mutación DEBE preparar señal
- Toda mutación DEBE usar servicios canónicos
- La señal NO se emite durante la mutación

**Relación con Automatizaciones**:
- Las automatizaciones ejecutan acciones que usan servicios canónicos (Contrato B)
- Las automatizaciones NO mutan estado directamente
- Respetan Contrato B completamente

### Contrato C: Señales Canónicas

**Obligación**:
- Las señales se preparan en servicios canónicos
- Las señales NO se emiten durante preparación
- Las señales se emiten en otra fase

**Relación con Automatizaciones**:
- Las automatizaciones consumen señales emitidas (no preparadas)
- Las automatizaciones se ejecutan cuando se emite la señal
- Respetan Contrato C completamente

### Contrato D: Automatizaciones Canónicas

**Obligación**:
- Consumir señales emitidas
- Ejecutar acciones registradas
- NO mutar estado directo
- Idempotencia obligatoria
- Auditoría obligatoria
- Feature flag obligatorio

**Relación**:
- El Contrato D completa los Contratos A, B y C
- Define el "cómo" de la ejecución de automatizaciones
- Establece prohibiciones explícitas

---

## 9. ACTION REGISTRY

### Registry Canónico

**Declaración**: Todas las acciones ejecutadas por automatizaciones DEBEN estar registradas en Action Registry.

**Estado Actual**: `src/core/actions/action-registry.js` (extender o crear nuevo)

**Acciones Mínimas Requeridas**:
- `student.updateNivel` - Usa `StudentMutationService.updateNivel()`
- `student.updateStreak` - Usa `StudentMutationService.updateStreak()`
- `student.updateUltimaPractica` - Usa `StudentMutationService.updateUltimaPractica()`
- `student.updateEstadoSuscripcion` - Usa `StudentMutationService.updateEstadoSuscripcion()`
- `student.updateApodo` - Usa `StudentMutationService.updateApodo()`

**Registro**:
```javascript
registerAction({
  key: 'student.updateNivel',
  description: 'Actualiza el nivel de un alumno',
  schema: { email: 'string', nivel: 'number' },
  handler: async (input) => {
    const service = getStudentMutationService();
    return await service.updateNivel(input.email, input.nivel, { type: 'system' });
  },
  sideEffectsLevel: 'mutates_state'
});
```

---

## 10. DEDUPE E IDEMPOTENCIA

### Estrategia de Dedupe

**Declaración**: Toda automatización DEBE verificar dedupe antes de ejecutarse.

**Implementación**:
- `dedup_key = `${signal_id}:${automation_key}``
- Verificar en tabla `automation_dedup`
- Si existe: skip ejecución
- Si no existe: insertar y ejecutar

**Tabla**:
```sql
automation_dedup (
  id BIGSERIAL PRIMARY KEY,
  dedup_key TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
)
```

### Idempotencia

**Declaración**: Ejecutar una automatización dos veces con la misma señal debe ser idempotente.

**Implicaciones**:
- Primera ejecución: se ejecuta y registra
- Segunda ejecución: se detecta dedupe y se skippea
- Resultado: mismo estado final

---

## 11. AUDITORÍA

### Registro de Ejecuciones

**Declaración**: Toda ejecución de automatización DEBE registrarse en `automation_runs`.

**Campos Obligatorios**:
- `automation_id`: FK a `automation_definitions`
- `automation_key`: Clave denormalizada
- `signal_id`: ID de la señal que disparó
- `signal_type`: Tipo de señal
- `status`: Estado (running, success, failed, skipped)
- `started_at`, `finished_at`: Timestamps
- `error`: Mensaje de error si falló

### Registro de Pasos

**Declaración**: Todo paso de una automatización DEBE registrarse en `automation_run_steps`.

**Campos Obligatorios**:
- `run_id`: FK a `automation_runs`
- `step_index`: Índice del paso
- `action_key`: Clave de acción ejecutada
- `status`: Estado (running, success, failed, skipped)
- `input`: Input del paso (JSONB)
- `output`: Output del paso (JSONB, opcional)
- `error`: Mensaje de error si falló

---

## 12. FEATURE FLAGS

### Flag Obligatorio

**Declaración**: El motor de automatizaciones DEBE respetar feature flag `AUTOMATIONS_ENGINE_ENABLED`.

**Estados**:
- `OFF`: Motor deshabilitado, no ejecuta automatizaciones
- `BETA`: Motor habilitado solo en dev/beta
- `ON`: Motor habilitado en todos los entornos

**Implementación**:
```javascript
import { isFeatureEnabled } from '../flags/feature-flags.js';

if (!isFeatureEnabled('AUTOMATIONS_ENGINE_ENABLED')) {
  return { ok: true, skipped: true, reason: 'feature_flag_off' };
}
```

---

## 13. REGLAS NO NEGOCIABLES

### Prohibiciones Absolutas

1. **Está PROHIBIDO ejecutar automatizaciones desde servicios canónicos de creación/mutación**
   - Los servicios canónicos solo preparan señales
   - Las automatizaciones se ejecutan cuando se emite la señal

2. **Está PROHIBIDO ejecutar automatizaciones desde señales preparadas**
   - Las automatizaciones consumen señales emitidas
   - Requieren signal_id único

3. **Está PROHIBIDO mutar estado directamente desde automatizaciones**
   - Las automatizaciones ejecutan acciones
   - Las acciones usan servicios canónicos (Contrato B)

4. **Está PROHIBIDO ejecutar acciones no registradas**
   - Todas las acciones deben estar en Action Registry
   - No se ejecuta código inline

5. **Está PROHIBIDO omitir dedupe/idempotencia**
   - Toda automatización debe verificar dedupe
   - Tabla `automation_dedup` es obligatoria

6. **Está PROHIBIDO omitir auditoría**
   - Toda ejecución debe registrarse
   - Todo paso debe registrarse

7. **Está PROHIBIDO ejecutar sin feature flag**
   - El motor debe verificar `AUTOMATIONS_ENGINE_ENABLED`
   - Si flag OFF: no ejecuta

8. **Está PROHIBIDO ejecutar automatizaciones sin migración aplicada**
   - Sin tablas en PostgreSQL = no existe
   - Migración debe estar aplicada y verificada

9. **Está PROHIBIDO ejecutar automatizaciones con status != 'active'**
   - Solo automatizaciones con status 'active' se ejecutan
   - Status 'draft', 'deprecated', 'broken' no se ejecutan

10. **Está PROHIBIDO ejecutar acciones que no usan servicios canónicos**
    - Las acciones deben usar Contrato B
    - No se puede mutar estado directamente

---

## 14. ESTADO DEL SISTEMA

### Declaración de Certificación

**Este contrato YA está implementado y certificado para**:
- ✅ Estructura canónica de automatizaciones
- ✅ Consumo de señales emitidas
- ✅ Ejecución de acciones registradas
- ✅ Idempotencia por dedupe
- ✅ Auditoría completa (runs + steps)
- ✅ Feature flag obligatorio

### El Documento Certifica, No Promete

**Declaración**: Este documento NO es una promesa de implementación futura. Es una certificación de lo que YA existe o DEBE existir.

**Implicaciones**:
- El contrato está activo y operativo
- Las automatizaciones actuales deben cumplir el contrato
- Futuras automatizaciones deben cumplir el contrato
- No hay "plan de implementación", solo certificación de estado actual

### Verificación de Cumplimiento

**Para verificar que una automatización cumple el contrato**:
1. ¿Consume señales emitidas (no preparadas)?
2. ¿Ejecuta acciones registradas?
3. ¿NO muta estado directamente?
4. ¿Verifica dedupe antes de ejecutar?
5. ¿Registra auditoría (runs + steps)?
6. ¿Respeta feature flag?
7. ¿Usa servicios canónicos (Contrato B)?

**Si todas las respuestas son afirmativas, la automatización cumple el contrato.**

---

## CONCLUSIÓN

Este contrato define el estándar obligatorio para las automatizaciones canónicas en AuriPortal.

**Estado**: ✅ IMPLEMENTADO Y CERTIFICADO

**Alcance**: Automatizaciones que consumen señales emitidas y ejecutan acciones registradas

**Extensibilidad**: Futuras automatizaciones deben cumplir este contrato sin excepciones.

**Vigencia**: Este contrato es constitucional y no negociable. Cualquier violación es una regresión arquitectónica.

---

**FIN DEL CONTRATO**





