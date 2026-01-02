# VERSIÓN CANÓNICA: SISTEMA DE AUTOMATIZACIONES
## AuriPortal - Automatizaciones v1.0.0-canonic

**Fecha de Release**: 2025-01-XX  
**Estado**: ✅ CONGELADO CONSTITUCIONALMENTE  
**Tipo de Release**: Canónica (Contrato Estable)  
**Fase**: D.9 - Versionado y Freeze Constitucional

---

## NOMBRE DEL SISTEMA

**Sistema de Automatizaciones Canónicas de AuriPortal**

---

## VERSIÓN

**v1.0.0-canonic**

### Semántica de Versión

- **Major (1)**: Sistema completo, gobernado y protegido
- **Minor (0)**: Sin cambios menores desde la versión base
- **Patch (0)**: Sin parches desde la versión base
- **Sufijo (-canonic)**: Indica que es una versión canónica con contratos congelados

---

## QUÉ INCLUYE ESTA VERSIÓN

### ✅ Componentes Core

1. **Automation Engine v2** (`automation-engine-v2.js`)
   - Motor de ejecución canónico
   - Resolución de automatizaciones activas
   - Ejecución de steps secuenciales y paralelos
   - Manejo de errores y deduplicación
   - Registro de runs y steps

2. **Action Registry** (`action-registry.js`)
   - Registro centralizado de acciones disponibles
   - Validación de acciones en definiciones
   - Contrato canónico de acciones

3. **Signal Dispatcher** (`signal-dispatcher.js`)
   - Dispatcher de señales normalizadas
   - Integración con Automation Engine v2
   - Persistencia de emisiones de señales
   - Soporte para dry_run y live_run

4. **Automation Definition Validator** (`automation-definition-validator.js`)
   - Validación estricta de definiciones JSON
   - Validación de triggers, steps, action_keys
   - Validación de parallel_groups
   - Rechazo explícito de definiciones inválidas

5. **Automation Write Service** (`automation-write-service.js`)
   - Servicio canónico de escritura
   - Creación (siempre en `draft`)
   - Actualización con control de versiones
   - Activación/desactivación gobernada
   - Auditoría completa

6. **Automation Execution Service** (`automation-execution-service.js`)
   - Servicio canónico de ejecución manual
   - Generación de señales artificiales
   - Integración con dispatchSignal()
   - Soporte para dry_run y live_run

### ✅ Infraestructura de Datos

1. **PostgreSQL como Source of Truth**
   - Tabla `automation_definitions` (definiciones)
   - Tabla `automation_runs` (ejecuciones)
   - Tabla `automation_run_steps` (pasos de ejecución)
   - Tabla `automation_audit_log` (auditoría)
   - Tabla `pde_signal_emissions` (emisiones de señales)

2. **Repositorios Canónicos**
   - `automation-definitions-repo-pg.js`
   - `automation-runs-repo-pg.js`
   - `automation-audit-repo-pg.js`

### ✅ Admin UI

1. **UI de Lectura (Fase 6)**
   - Lista de definiciones (`/admin/automations`)
   - Detalle de definición (`/admin/automations/:id`)
   - Lista de ejecuciones (`/admin/automations/runs`)
   - Detalle de ejecución (`/admin/automations/runs/:id`)

2. **UI de Escritura (Fase 7)**
   - Crear automatización (`/admin/automations/new`)
   - Editar automatización (`/admin/automations/:id/edit`)
   - Activar/Desactivar automatizaciones
   - Ejecución manual (dry_run / live_run)

### ✅ API Endpoints

1. **Endpoints de Lectura**
   - `GET /admin/api/automations` (lista)
   - `GET /admin/api/automations/:id` (detalle)
   - `GET /admin/api/automation-runs` (lista de ejecuciones)
   - `GET /admin/api/automation-runs/:id` (detalle de ejecución)
   - `GET /admin/api/automation-runs/:id/steps` (pasos de ejecución)

2. **Endpoints de Escritura**
   - `POST /admin/api/automations` (crear)
   - `PUT /admin/api/automations/:id` (actualizar)
   - `POST /admin/api/automations/:id/activate` (activar)
   - `POST /admin/api/automations/:id/deactivate` (desactivar)

3. **Endpoints de Ejecución**
   - `POST /admin/api/automations/:id/execute/dry-run` (ejecución simulada)
   - `POST /admin/api/automations/:id/execute/live-run` (ejecución real)

### ✅ Tests Constitucionales

1. **14 Tests Constitucionales** (`tests/automations/automation-constitutional.test.js`)
   - Tests de escritura canónica
   - Tests de activación gobernada
   - Tests de ejecución manual
   - Tests de flujo canónico (protección anti-bypass)

### ✅ Documentación

1. **Contratos**
   - `CONTRATO_CANONICO_AUTOMATIZACIONES.md`
   - `ADMIN_AUTOMATIONS_READ_ONLY_CONTRACT.md`
   - `ADMIN_AUTOMATIONS_WRITE_EXECUTION_CONTRACT.md`

2. **Auditorías y Análisis**
   - `FASE_D_FASE7_RISK_AUDIT.md`
   - `RESUMEN_FASE_D_FASE8.1_AJUSTE_TESTS.md`

3. **Checklists**
   - `CHECKLIST_ADMIN_AUTOMATIONS_WRITE.md`

---

## QUÉ NO INCLUYE ESTA VERSIÓN

### ❌ Features No Incluidas

1. **Editor Visual Avanzado**
   - No hay editor drag-and-drop para crear automatizaciones
   - No hay preview visual de flujos
   - La creación/edición es mediante JSON editor

2. **Branching Complejo**
   - No hay soporte para condiciones complejas en triggers
   - No hay soporte para loops o iteraciones
   - No hay soporte para sub-automatizaciones

3. **Scheduling Avanzado**
   - No hay scheduling basado en cron expressions
   - No hay scheduling condicional
   - El scheduling es básico (basado en señales)

4. **Versionado de Definiciones**
   - No hay historial de versiones navegable
   - No hay rollback automático
   - El versionado es incremental pero no histórico

5. **Testing Avanzado**
   - No hay test suite integrado para automatizaciones
   - No hay simulación de señales históricas
   - Los tests son constitucionales, no funcionales completos

6. **Analytics Avanzadas**
   - No hay dashboard de analytics de automatizaciones
   - No hay métricas de performance
   - No hay alertas automáticas de errores

7. **Multi-tenancy**
   - No hay soporte para múltiples organizaciones
   - No hay aislamiento de datos por tenant
   - El sistema es single-tenant

8. **Feature Flags por Automatización**
   - No hay activación/desactivación por feature flag
   - No hay A/B testing de automatizaciones
   - El control es manual (activate/deactivate)

---

## PROHIBICIONES CONSTITUCIONALES

### 🚫 Prohibiciones Absolutas (No Negociables)

1. **Ejecución Directa de Acciones**
   - ❌ Prohibido ejecutar acciones fuera del Automation Engine v2
   - ❌ Prohibido llamar Action Registry directamente desde UI
   - ❌ Prohibido mutar estado sin pasar por servicios canónicos

2. **Bypass del Flujo Canónico**
   - ❌ Prohibido saltarse `dispatchSignal()`
   - ❌ Prohibido saltarse `runAutomationsForSignal()`
   - ❌ Prohibido ejecutar automatizaciones sin generar señal

3. **Escritura Sin Validación**
   - ❌ Prohibido guardar definiciones sin validar
   - ❌ Prohibido crear automatizaciones en status ≠ `draft`
   - ❌ Prohibido referenciar acciones inexistentes

4. **Ejecución Sin Auditoría**
   - ❌ Prohibido ejecutar sin registrar runs
   - ❌ Prohibido ejecutar sin registrar steps
   - ❌ Prohibido ejecutar sin deduplicación

5. **Modificación de Contratos de Retorno**
   - ❌ Prohibido cambiar estructura de retorno de servicios canónicos
   - ❌ Prohibido envolver retornos en estructuras nuevas sin versión mayor
   - ❌ Prohibido cambiar manejo de errores (de excepciones a objetos)

6. **Modificación de Tests Constitucionales**
   - ❌ Prohibido eliminar tests constitucionales
   - ❌ Prohibido relajar validaciones en tests
   - ❌ Prohibido añadir bypasses en tests

---

## GARANTÍAS DE ESTA VERSIÓN

### ✅ Garantías Arquitectónicas

1. **Source of Truth Único**
   - PostgreSQL es el único Source of Truth
   - No hay duplicación de lógica
   - No hay estados inconsistentes

2. **Flujo Canónico Obligatorio**
   - Toda ejecución pasa por: Señal → Engine → Runs → Steps
   - No hay atajos ni bypasses
   - Todo es rastreable y auditable

3. **Separación de Responsabilidades**
   - Escritura separada de ejecución
   - Validación separada de ejecución
   - UI separada de lógica de negocio

4. **Versionado y Control de Versiones**
   - Control de versiones en actualizaciones
   - Prevención de sobrescritura silenciosa
   - Auditoría completa de cambios

5. **Protección Anti-Bypass**
   - Tests constitucionales protegen el diseño
   - Contratos explícitos documentados
   - Prohibiciones claramente definidas

---

## ESTABILIDAD Y EVOLUCIÓN

### Estabilidad

Esta versión es **estable** en el sentido de que:
- Los contratos están congelados
- Los tests constitucionales protegen el diseño
- Las prohibiciones están documentadas

### No Es Estabilidad Eterna

Esta versión **NO** implica:
- Que el sistema nunca cambiará
- Que no se pueden añadir features
- Que no se pueden mejorar componentes

### Es Contrato Estable

Esta versión **SÍ** implica:
- Que los contratos actuales son estables
- Que cualquier cambio que los rompa requiere nueva versión mayor
- Que la evolución debe seguir la guía de evolución documentada

---

## PRÓXIMAS VERSIONES (NO INCLUIDAS)

### v1.1.0 (Minor - Features No Breaking)

Posibles mejoras sin romper contratos:
- Editor visual básico
- Analytics básicas
- Mejoras de UI/UX
- Nuevas acciones en Action Registry

### v2.0.0 (Major - Breaking Changes)

Cambios que requieren nueva versión mayor:
- Cambio de contrato de retorno de servicios
- Cambio de estructura de definiciones
- Cambio de flujo canónico
- Eliminación de prohibiciones constitucionales

---

## DECLARACIÓN FINAL

**A partir de esta versión (v1.0.0-canonic), cualquier cambio que rompa los contratos documentados, las prohibiciones constitucionales o los tests constitucionales es INCONSTITUCIONAL y requiere nueva versión mayor.**

Esta versión sella el sistema de automatizaciones como:
- ✅ Completo funcionalmente
- ✅ Gobernado arquitectónicamente
- ✅ Protegido por tests constitucionales
- ✅ Documentado exhaustivamente
- ✅ Listo para evolución controlada

---

**FIN DEL DOCUMENTO DE VERSIÓN**









