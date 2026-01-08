# Cleaning Engine v1 - Documentación Operativa

## Resumen Ejecutivo

El **Cleaning Engine v1** es el sistema canónico de gestión de limpiezas en AuriPortal. Actúa como **single decider** (único decisor) para todos los estados de limpieza, garantizando consistencia, auditabilidad y separación entre capas SHARED (visible para estudiantes) y PDE (solo master).

## Arquitectura

### Componentes Principales

1. **CleaningEngineService** (`src/core/master/services/cleaning-engine-service.js`)
   - Servicio central que actúa como único decisor
   - Valida, excluye estudiantes pausados, inserta eventos, actualiza proyecciones
   - Emite señales para automatizaciones

2. **Repositorios**
   - `CleaningEventsRepo`: Event log append-only
   - `CleaningItemStateRepo`: Proyección canónica para lecturas rápidas

3. **Tablas PostgreSQL**
   - `cleaning_events`: Event log con idempotencia por `execution_key`
   - `cleaning_item_state`: Estado actual proyectado por estudiante/item/capa

### Dos Capas de Limpieza

- **SHARED**: Visible para estudiantes, sincroniza con `student_item_state`
- **PDE**: Solo master, no afecta `student_item_state` (solo auditoría)

### Actores

- `master`: Acciones desde UI Master
- `student`: Acciones desde UI Cliente (futuro)
- `automation`: Acciones desde automatizaciones

## Uso del Servicio

### Marcar Item como Limpiado (Recurrente)

```javascript
import { cleaningEngineService } from '../core/master/services/cleaning-engine-service.js';

await cleaningEngineService.markClean({
  student_id: studentUuid,
  item_ref: 'item_123',
  clean_layer: 'shared', // o 'pde'
  item_kind: 'recurrente',
  actor_type: 'master',
  actor_id: 'admin_user_id',
  surface_key: 'alquimia_general',
  product_key: 'pde',
  trace_id: generateTraceId(),
  meta: { source: 'ui' }
});
```

### Marcar Limpieza para Todos los Estudiantes

```javascript
await cleaningEngineService.markCleanAllStudents({
  item_ref: 'item_123',
  clean_layer: 'shared',
  item_kind: 'recurrente',
  actor_type: 'master',
  actor_id: 'admin_user_id',
  surface_key: 'alquimia_general',
  product_key: 'pde',
  trace_id: generateTraceId()
});
```

### Incrementar Item "Una vez"

```javascript
await cleaningEngineService.incrementOneTimeItem({
  student_id: studentUuid,
  item_ref: 'item_123',
  actor_type: 'master',
  actor_id: 'admin_user_id',
  surface_key: 'alquimia_general',
  product_key: 'pde',
  trace_id: generateTraceId()
});
```

### Ajustar Remaining de Item "Una vez"

```javascript
await cleaningEngineService.setOneTimeItemRemaining({
  student_id: studentUuid,
  item_ref: 'item_123',
  remaining: 5,
  actor_type: 'master',
  actor_id: 'admin_user_id',
  surface_key: 'alquimia_general',
  product_key: 'pde',
  trace_id: generateTraceId()
});
```

### Obtener Estado de Limpieza

```javascript
const state = await cleaningEngineService.getStudentCleaningState({
  student_id: studentUuid,
  item_ref: 'item_123',
  clean_layer: 'shared',
  item_kind: 'recurrente',
  product_key: 'pde',
  trace_id: generateTraceId()
});

// Retorna:
// {
//   shared_last_cleaned_at: '2025-01-15T10:00:00Z',
//   shared_clean_count: 3,
//   shared_completed: 0,
//   shared_remaining: 0,
//   pde_last_cleaned_at: null,
//   pde_clean_count: 0,
//   pde_completed: 0
// }
```

### Obtener Estados de Múltiples Estudiantes

```javascript
const states = await cleaningEngineService.getStudentsCleaningStates({
  item_ref: 'item_123',
  item_kind: 'recurrente',
  clean_layer: 'shared',
  product_key: 'pde',
  trace_id: generateTraceId(),
  options: {
    excludePaused: true, // Excluir estudiantes pausados (por defecto)
    minLevel: 5, // Filtrar por nivel mínimo
    limit: 100
  }
});
```

## Reglas Constitucionales

1. **Single Decider**: Toda lógica de estado de limpieza reside SOLO en Cleaning Engine
2. **Exclusión de Pausados**: Estudiantes pausados son excluidos automáticamente
3. **Idempotencia**: `execution_key` garantiza que acciones duplicadas no se procesen dos veces
4. **Sincronización SHARED**: Limpiezas SHARED se sincronizan con `student_item_state`
5. **NO APLICA (nivel)**: Items con `nivel > nivel_efectivo` del estudiante no aplican
6. **Auditoría Completa**: Todos los eventos quedan registrados en `cleaning_events`

## Integración con Alquimia General

El servicio `alquimia-general-service.js` delega todas las operaciones de escritura al Cleaning Engine:

- `markCleanStudent` → `cleaningEngine.markClean`
- `markCleanAll` → `cleaningEngine.markCleanAllStudents`
- `incrementAll` → `cleaningEngine.incrementOneTimeItemAllStudents`
- `adjustRemaining` → `cleaningEngine.setOneTimeItemRemaining`
- `markPdeCleanAll` → `cleaningEngine.markCleanAllStudents` con `clean_layer: 'pde'`

## APIs MASTER

Todos los endpoints de Alquimia General aceptan `clean_layer` opcional:

- `POST /master/api/alquimia-general/items/:item_ref/master/mark-clean-all`
- `POST /master/api/alquimia-general/items/:item_ref/master/mark-clean-student`
- `POST /master/api/alquimia-general/items/:item_ref/master/increment-all`
- `POST /master/api/alquimia-general/items/:item_ref/master/adjust-remaining`
- `GET /master/api/alquimia-general/items/:item_ref/students`

## Verificación

Ejecutar scripts de verificación:

```bash
npm run verify:cleaning-engine
```

Esto ejecuta:
- `scripts/verify-cleaning-engine-db.js`: Verifica estructura de BD
- `scripts/verify-cleaning-engine-sample.js`: Verifica funcionalidad con datos de ejemplo

## Incidentes y Hotfixes

### Incidente v5.59.4: PDE clean-all no se reflejaba en vista PDE

**Síntoma:**
- Al pulsar botón PDE en Alquimia General, la limpieza se ejecutaba pero no se reflejaba en el modal "VER" cuando se cambiaba a vista PDE
- El modal seguía mostrando estado "nunca limpio" incluso después de ejecutar PDE clean-all
- SHARED funcionaba correctamente

**Causa Raíz:**
- El código de escritura y lectura estaba correcto (Cleaning Engine escribe en `pde_last_cleaned_at` y `pde_clean_count`, y el repo lee correctamente según `clean_layer`)
- El problema era que el modal no se refrescaba correctamente después de PDE clean-all
- El estado del modal (`state.modal.cleanLayer`) no se actualizaba explícitamente antes de refrescar

**Fix Canónico:**
- Añadido `state.modal.cleanLayer = 'pde'` antes de refrescar el modal después de PDE clean-all
- Añadidos logs estructurados en `getStudentsForItem` y `markPdeCleanAll` para debugging:
  - `[GET_STUDENTS]` logs cuando se lee desde Cleaning Engine con `clean_layer`
  - `[PDE_CLEAN_ALL]` logs con `item_id`, `lista_tipo`, `clean_layer`, `skipped_breakdown`
- Añadido log en Cleaning Engine con `item_kind`, `item_id`, `item_nivel` en `markCleanAllStudents`
- Creado script de verificación `scripts/verify-cleaning-engine-pde.js` para validar escritura/lectura PDE

**Verificación:**
- `npm run verify:cleaning-engine-pde` valida que PDE se escribe y lee correctamente
- Logs estructurados permiten rastrear el flujo completo con `trace_id`
- Modal se refresca automáticamente con `clean_layer='pde'` después de PDE clean-all

**Prevención:**
- Script de verificación PDE añadido a `package.json` (`verify:cleaning-engine-pde`)
- Logs estructurados con prefijos canónicos (`[PDE_CLEAN_ALL]`, `[GET_STUDENTS]`) para debugging
- Estado del modal (`state.modal.cleanLayer`) se actualiza explícitamente antes de refrescar

### Incidente v5.59.2: Import Roto en cleaning-engine-service.js + Modal State

**Síntoma:**
- Modal "VER" mostraba error: "Cannot find module '/var/www/aurelinportal/src/database/pg.js'"
- Modal no se refrescaba después de limpiar
- `clean_layer` no se pasaba correctamente en requests

**Causa Raíz:**
- `cleaning-engine-service.js` usaba `../../../database/pg.js` (3 niveles) cuando debería ser `../../../../database/pg.js` (4 niveles desde `src/core/master/services/`)
- Estado del modal (`state.modal`) no estaba inicializado
- Cliente no pasaba `clean_layer` en body de `mark-clean-all`

**Fix Canónico:**
- Corregido import a `../../../../database/pg.js` en líneas 73 y 420
- Añadido `state.modal = { item: null, cleanLayer: 'shared' }` al estado global
- Cliente ahora envía `clean_layer` en body de `mark-clean-all`
- Modal se refresca automáticamente después de limpiar manteniendo `clean_layer` activo
- Estado del modal se limpia correctamente al cerrar (click fuera, ESC, botón cerrar)

**Verificación:**
- `node -e "import('./src/core/master/services/cleaning-engine-service.js')"` → ✅ Import OK
- `npm run verify:cleaning-engine` → ✅ Todas las verificaciones pasan

### Incidente v5.59.0: Import Roto pg.js

### Síntoma
- Modal "VER" en Alquimia General mostraba error: "Cannot find module '/var/www/aurelinportal/src/database/pg.js'"
- "Limpiar a todos" fallaba con el mismo error
- Contadores aparecían en 0 y no se cargaban estudiantes

### Causa Raíz
Los repositorios de cleaning (`cleaning-events-repo-pg.js` y `cleaning-item-state-repo-pg.js`) importaban desde `../../../database/pg.js`, que desde `src/infra/repos/cleaning/` intentaba acceder a `src/database/pg.js` (inexistente). El módulo real está en `database/pg.js` (raíz del proyecto).

### Fix Canónico
- Cambiado import a `../../../../database/pg.js` (4 niveles arriba desde `src/infra/repos/cleaning/`)
- Corregido import de logger a `../../../core/observability/logger.js`
- Verificado con `node -e "import('./src/infra/repos/cleaning/cleaning-events-repo-pg.js')"`

### Prevención
Añadida regla constitucional `infra-repos-pg-import-canonical` en `.cursorrules`:
- Obliga a verificar paths de imports antes de crear repos nuevos
- Requiere copiar el patrón de imports de repos existentes que funcionen
- Prohíbe inventar rutas sin verificación previa

## Referencias

- **Diseño completo**: `docs/master/MASTER_CLEANING_ENGINE_V1_DESIGN.md`
- **Migración SQL**: `database/migrations/v5.59.0-cleaning-engine-v1.sql`
- **Servicio**: `src/core/master/services/cleaning-engine-service.js`
- **Repositorios**: `src/core/repos/cleaning/` y `src/infra/repos/cleaning/`
