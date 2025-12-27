# CONTRATO: ADMIN UI AUTOMATIZACIONES (READ-ONLY)
## AuriPortal - Fase D - Fase 6

**Versión**: 1.0  
**Fecha de Certificación**: 2025-01-XX  
**Estado**: ✅ CERTIFICADO  
**Alcance**: Contrato de UI de solo lectura para automatizaciones

---

## PROPÓSITO DEL CONTRATO

Este contrato define, de forma explícita y no negociable, cómo funciona la **Admin UI de Automatizaciones** en la Fase 6.

### Qué Protege

- **Integridad del Sistema**: Impide que la UI modifique automatizaciones sin pasar por contratos canónicos
- **Separación de Responsabilidades**: Garantiza que la UI solo inspecciona, no ejecuta
- **Seguridad**: Previene ejecuciones accidentales o no autorizadas
- **Auditabilidad**: Asegura que todas las modificaciones pasan por procesos canónicos

### Por Qué Existe

Sin este contrato, la UI podría:
- Crear automatizaciones sin validación
- Activar automatizaciones sin pasar por feature flags
- Ejecutar automatizaciones manualmente
- Modificar runs/steps sin auditoría

Este contrato elimina estas violaciones mediante prohibiciones explícitas.

---

## DEFINICIÓN DE UI READ-ONLY

### UI Read-Only

Una **UI Read-Only** es una interfaz que:
- SOLO lee datos de PostgreSQL
- NO escribe en PostgreSQL
- NO ejecuta operaciones
- NO modifica estado del sistema

### Diferencia con UI de Escritura

**UI Read-Only (Fase 6)**:
- Solo lectura
- Solo inspección
- No modifica nada
- No ejecuta nada

**UI de Escritura (Fase 7+)**:
- Permite crear/editar
- Permite activar/desactivar
- Pasa por validaciones canónicas
- Registra auditoría

---

## PRINCIPIOS CONSTITUCIONALES

### Principio 1: Solo Lectura

**Declaración**: La UI de Fase 6 SOLO lee datos, nunca escribe.

**Implicaciones**:
- No INSERT en ninguna tabla
- No UPDATE en ninguna tabla
- No DELETE en ninguna tabla
- Solo SELECT

### Principio 2: No Ejecución

**Declaración**: La UI de Fase 6 NO ejecuta automatizaciones.

**Implicaciones**:
- No llama `runAutomationsForSignal()`
- No llama `dispatchSignal()`
- No emite señales
- No fuerza ejecuciones

### Principio 3: No Modificación de Estado

**Declaración**: La UI de Fase 6 NO modifica el estado de automatizaciones.

**Implicaciones**:
- No cambia `status` de definitions
- No cambia `status` de runs
- No cambia `status` de steps
- No modifica feature flags

### Principio 4: Solo Inspección

**Declaración**: La UI de Fase 6 SOLO inspecciona el estado actual del sistema.

**Implicaciones**:
- Lee definitions
- Lee runs
- Lee steps
- Lee dedupe
- Muestra errores
- No modifica nada

---

## OPERACIONES PERMITIDAS

### ✅ PERMITIDO

1. **Listar Definitions**:
   - Query: `SELECT * FROM automation_definitions WHERE deleted_at IS NULL`
   - Filtros: status, automation_key
   - Ordenamiento: nombre, fecha, status

2. **Leer Definition**:
   - Query: `SELECT * FROM automation_definitions WHERE id = $1`
   - Mostrar: JSON completo de definition
   - Mostrar: metadata (name, description, version, status)

3. **Listar Runs**:
   - Query: `SELECT * FROM automation_runs WHERE ...`
   - Filtros: automation_key, signal_type, status
   - Ordenamiento: fecha (más recientes primero)

4. **Leer Run**:
   - Query: `SELECT * FROM automation_runs WHERE id = $1`
   - Mostrar: status, timestamps, error, meta

5. **Listar Steps**:
   - Query: `SELECT * FROM automation_run_steps WHERE run_id = $1`
   - Mostrar: action_key, status, input, output, error

6. **Leer Step**:
   - Query: `SELECT * FROM automation_run_steps WHERE id = $1`
   - Mostrar: input, output, error, timestamps

7. **Ver Dedupe**:
   - Query: `SELECT * FROM automation_dedup WHERE ...`
   - Mostrar: dedup_key, created_at

---

## OPERACIONES PROHIBIDAS

### ❌ PROHIBIDO

1. **Crear Definitions**:
   - ❌ `INSERT INTO automation_definitions`
   - ❌ Llamar repositorios de creación
   - ❌ Validar JSON de definiciones

2. **Editar Definitions**:
   - ❌ `UPDATE automation_definitions`
   - ❌ Modificar JSON de definiciones
   - ❌ Cambiar metadata

3. **Cambiar Status**:
   - ❌ `UPDATE automation_definitions SET status = ...`
   - ❌ Activar automatizaciones
   - ❌ Desactivar automatizaciones

4. **Ejecutar Automatizaciones**:
   - ❌ Llamar `runAutomationsForSignal()`
   - ❌ Llamar `dispatchSignal()`
   - ❌ Emitir señales artificiales

5. **Modificar Runs/Steps**:
   - ❌ `UPDATE automation_runs`
   - ❌ `UPDATE automation_run_steps`
   - ❌ Modificar errores o outputs

6. **Modificar Dedupe**:
   - ❌ `DELETE FROM automation_dedup`
   - ❌ Modificar dedupe keys

7. **Tocar Feature Flags**:
   - ❌ Activar `AUTOMATIONS_ENGINE_ENABLED`
   - ❌ Modificar flags desde UI

---

## ENDPOINTS PERMITIDOS (Fase 6)

### Solo GET (Read-Only)

- ✅ `GET /admin/api/automations` - Listar definitions
- ✅ `GET /admin/api/automations/:id` - Obtener definition
- ✅ `GET /admin/api/automation-runs` - Listar runs
- ✅ `GET /admin/api/automation-runs/:id` - Obtener run
- ✅ `GET /admin/api/automation-runs/:id/steps` - Listar steps
- ✅ `GET /admin/api/automation-runs/:runId/steps/:stepId` - Obtener step

### Prohibidos en Fase 6

- ❌ `POST /admin/api/automations` - Crear (Fase 7+)
- ❌ `PUT /admin/api/automations/:id` - Actualizar (Fase 7+)
- ❌ `POST /admin/api/automations/:id/activate` - Activar (Fase 7+)
- ❌ `POST /admin/api/automations/:id/deactivate` - Desactivar (Fase 7+)
- ❌ `POST /admin/api/automations/:id/execute` - Ejecutar (PROHIBIDO SIEMPRE)

---

## VALIDACIONES OBLIGATORIAS

### En Endpoints

1. **Verificar que es GET**:
   - Solo métodos GET permitidos
   - Rechazar POST, PUT, DELETE, PATCH

2. **Verificar permisos**:
   - Requerir `requireAdminContext()`
   - Verificar que el usuario es admin

3. **Validar parámetros**:
   - Validar IDs (UUIDs válidos)
   - Validar filtros (status válidos)
   - Validar ordenamiento

### En UI

1. **No mostrar botones de escritura**:
   - No botón "Crear"
   - No botón "Editar"
   - No botón "Activar"
   - No botón "Ejecutar"

2. **Mostrar solo información**:
   - Solo texto, tablas, JSON viewers
   - No formularios de edición
   - No inputs de escritura

---

## RELACIÓN CON CONTRATOS A, B, C Y D

### Contrato A (Creación de Entidades Vivas)

**Obligación**:
- Toda creación pasa por servicios canónicos
- Toda creación audita

**Relación con Fase 6**:
- UI NO crea automatizaciones (Fase 7+)
- UI solo lee definitions existentes

### Contrato B (Mutación de Entidades Vivas)

**Obligación**:
- Toda mutación pasa por servicios canónicos
- Toda mutación audita

**Relación con Fase 6**:
- UI NO muta automatizaciones (Fase 7+)
- UI solo lee estado actual

### Contrato C (Señales Canónicas)

**Obligación**:
- Las señales se emiten desde signal-dispatcher
- Las señales NO se emiten desde servicios canónicos

**Relación con Fase 6**:
- UI NO emite señales
- UI solo ve señales que ya fueron emitidas (en runs)

### Contrato D (Automatizaciones Canónicas)

**Obligación**:
- Las automatizaciones consumen señales emitidas
- Solo automatizaciones con status 'active' se ejecutan

**Relación con Fase 6**:
- UI NO crea automatizaciones (Fase 7+)
- UI NO activa automatizaciones (Fase 7+)
- UI solo INSPECCIONA el estado actual

---

## REGLAS NO NEGOCIABLES

### Prohibiciones Absolutas

1. **Está PROHIBIDO crear automatizaciones desde UI en Fase 6**
   - Las automatizaciones se crean manualmente en PostgreSQL
   - Futuro: Fase 7+ permitirá creación desde UI

2. **Está PROHIBIDO editar automatizaciones desde UI en Fase 6**
   - Las automatizaciones se editan manualmente en PostgreSQL
   - Futuro: Fase 7+ permitirá edición desde UI

3. **Está PROHIBIDO activar/desactivar automatizaciones desde UI en Fase 6**
   - El status se cambia manualmente en PostgreSQL
   - Futuro: Fase 7+ permitirá cambio de status desde UI

4. **Está PROHIBIDO ejecutar automatizaciones desde UI**
   - Las automatizaciones se ejecutan automáticamente cuando se emiten señales
   - NO hay ejecución manual (ni en Fase 6 ni en Fase 7+)

5. **Está PROHIBIDO emitir señales desde UI**
   - Las señales se emiten desde signal-dispatcher
   - UI NO puede emitir señales artificiales

6. **Está PROHIBIDO tocar feature flags desde UI**
   - Los flags se cambian en código y requieren deploy
   - UI NO puede modificar flags

7. **Está PROHIBIDO modificar runs/steps desde UI**
   - Los runs/steps son inmutables (solo Automation Engine los modifica)
   - UI solo puede leerlos

8. **Está PROHIBIDO modificar dedupe desde UI**
   - El dedupe es gestionado por Automation Engine
   - UI solo puede leerlo

---

## ESTADO DEL SISTEMA

### Declaración de Certificación

**Este contrato YA está implementado y certificado para**:
- ✅ UI de solo lectura (Fase 6)
- ✅ Prohibiciones explícitas
- ✅ Operaciones permitidas documentadas

### El Documento Certifica, No Promete

**Declaración**: Este documento NO es una promesa de implementación futura. Es una certificación de lo que DEBE existir en la Fase 6.

**Implicaciones**:
- El contrato está activo y operativo
- La UI de Fase 6 debe cumplir el contrato
- Futuras fases (7+) pueden extender el contrato

---

## CONCLUSIÓN

Este contrato define el estándar obligatorio para la Admin UI de Automatizaciones en la Fase 6.

**Estado**: ✅ CERTIFICADO

**Alcance**: UI de solo lectura para inspección de automatizaciones

**Extensibilidad**: Futuras fases (7+) pueden añadir operaciones de escritura, pero deben cumplir los Contratos A, B, C y D.

**Vigencia**: Este contrato es constitucional y no negociable. Cualquier violación es una regresión arquitectónica.

---

**FIN DEL CONTRATO**





