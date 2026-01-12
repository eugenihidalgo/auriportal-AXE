# Cleaning Engine Extensibility

**Fecha**: 2026-01-12  
**Dominio**: MASTER  
**Sistema**: Alquimia / Cleaning Engine  
**Versión**: v1.0.0  
**Estado**: PREPARACIÓN FUTURA

---

## INTRODUCCIÓN

Este documento describe cómo extender el Cleaning Engine para soportar nuevas capas de limpieza: `group` y `pair`. Estas extensiones están preparadas pero NO activadas todavía.

**Principio**: Extender sin romper. Las nuevas capas deben seguir el mismo modelo canónico que `shared` y `pde`.

---

## CAPAS FUTURAS

### group (Grupo)

**Qué es**: Limpiezas realizadas a nivel de grupo (múltiples estudiantes).

**Características**:
- Se aplica a todos los estudiantes de un grupo
- Se registra en columnas `group_clean_count`, `group_last_cleaned_at`, etc.
- Requiere `scope_ref` para identificar el grupo

**Cuándo usar**:
- Limpiezas masivas a nivel de grupo
- Tracking de progreso grupal
- Automatizaciones que afectan grupos completos

### pair (Pareja)

**Qué es**: Limpiezas realizadas a nivel de pareja (dos estudiantes).

**Características**:
- Se aplica a una pareja específica de estudiantes
- Se registra en columnas `pair_clean_count`, `pair_last_cleaned_at`, etc.
- Requiere `scope_ref` para identificar la pareja

**Cuándo usar**:
- Limpiezas en parejas de trabajo
- Tracking de progreso de parejas
- Automatizaciones que afectan parejas

---

## SCOPE_REF: IDENTIFICADOR DE ALCANCE

### Concepto

`scope_ref` es un identificador que determina el alcance de una limpieza cuando `clean_layer` es `group` o `pair`.

**Para `clean_layer='shared'` o `clean_layer='pde'`**:
- `scope_ref` = `student_uuid` (implícito, no se envía)
- La limpieza se aplica a un estudiante individual

**Para `clean_layer='group'`**:
- `scope_ref` = `group_uuid` (obligatorio)
- La limpieza se aplica a todos los estudiantes del grupo

**Para `clean_layer='pair'`**:
- `scope_ref` = `pair_uuid` (obligatorio)
- La limpieza se aplica a la pareja identificada

### Estructura de scope_ref

```javascript
// Para student (implícito)
{
  clean_layer: 'shared',
  student_uuid: '44a51f8f-4ed5-4291-ad13-5f07a99c636b'
  // scope_ref no se envía (se infiere de student_uuid)
}

// Para group
{
  clean_layer: 'group',
  scope_ref: 'group-uuid-123',  // OBLIGATORIO
  // Se aplica a todos los estudiantes del grupo
}

// Para pair
{
  clean_layer: 'pair',
  scope_ref: 'pair-uuid-456',  // OBLIGATORIO
  // Se aplica a la pareja identificada
}
```

---

## CÓMO AÑADIR GROUP

### Paso 1: Actualizar Constantes

**Archivo**: `src/core/master/services/cleaning-layer-constants.js`

```javascript
// ANTES
export const ALLOWED_CLEAN_LAYERS = ['shared', 'pde'];

// DESPUÉS
export const ALLOWED_CLEAN_LAYERS = ['shared', 'pde', 'group'];
```

### Paso 2: Actualizar Schema de Base de Datos

**Archivo**: Migración SQL

```sql
-- Añadir columnas group_* a cleaning_item_state
ALTER TABLE cleaning_item_state
  ADD COLUMN group_clean_count INTEGER DEFAULT 0,
  ADD COLUMN group_remaining INTEGER,
  ADD COLUMN group_completed INTEGER DEFAULT 0,
  ADD COLUMN group_last_cleaned_at TIMESTAMP,
  ADD COLUMN scope_ref VARCHAR(255);  -- Para group_uuid o pair_uuid

-- Índice para búsquedas por scope_ref
CREATE INDEX idx_cleaning_item_state_scope_ref 
  ON cleaning_item_state(scope_ref);
```

### Paso 3: Actualizar Cleaning Engine Service

**Archivo**: `src/core/master/services/cleaning-engine-service.js`

```javascript
// Añadir validación de scope_ref para group
if (clean_layer === 'group') {
  if (!options.scope_ref) {
    throw new Error('scope_ref is required when clean_layer is "group"');
  }
  // Validar que scope_ref es un group_uuid válido
  // (implementar validación según tu sistema de grupos)
}

// Añadir lógica de escritura para group
if (clean_layer === 'group') {
  // Escribir en group_clean_count, group_last_cleaned_at, etc.
  // Aplicar a todos los estudiantes del grupo identificado por scope_ref
}
```

### Paso 4: Actualizar Repositorio

**Archivo**: `src/infra/repos/cleaning/cleaning-item-state-repo-pg.js`

```javascript
// Añadir métodos para group
async upsertApplyRecurrentGroup({ student_uuid, item_ref, scope_ref, cleaned_at }) {
  // Escribir en group_* columns
}

async upsertApplyOneTimeIncrementGroup({ student_uuid, item_ref, scope_ref, required_count }) {
  // Escribir en group_* columns
}
```

### Paso 5: Actualizar Servicio de Alquimia

**Archivo**: `src/services/alquimia-general-service.js`

```javascript
// Añadir group a computeVisualState()
computeVisualState({ shared, pde, group, combo, item_kind, view_layer, config }) {
  if (view_layer === 'group') {
    // Calcular estado desde group.days_since_last_clean o group.clean_count
  }
}
```

### Paso 6: Actualizar Endpoints

**Archivo**: `src/endpoints/master-api-alquimia-general.js`

```javascript
// Añadir validación de scope_ref en POST
if (cleanLayer === 'group' && !body.scope_ref) {
  return jsonError('scope_ref is required when clean_layer is "group"', 'SCOPE_REF_REQUIRED', 400);
}
```

### Paso 7: Actualizar UI

**Archivo**: `public/js/master/master-alquimia-general-client.js`

```javascript
// Añadir columna GROUP
async function loadGroupColumn(itemRef) {
  const response = await fetch(
    `/master/api/alquimia-general/items/${itemRef}/students?view_layer=group`
  );
  // Renderizar columna GROUP
}
```

---

## CÓMO AÑADIR PAIR

Sigue los mismos pasos que para `group`, pero:

1. Usa `pair_*` en lugar de `group_*` en nombres de columnas
2. Valida que `scope_ref` es un `pair_uuid` válido
3. Aplica la limpieza solo a los dos estudiantes de la pareja

---

## QUÉ NO DEBE HACERSE

### ❌ NO crear nuevas capas sin seguir el modelo canónico

**Error**:
```javascript
// Crear capa "custom" sin seguir el modelo
if (clean_layer === 'custom') {
  // Lógica ad-hoc sin validaciones
}
```

**Por qué está prohibido**:
- Rompe la consistencia del sistema
- Introduce bugs sutiles
- Dificulta el mantenimiento

**Qué hacer**:
- Seguir el modelo canónico (shared/pde/group/pair)
- Si necesitas algo diferente, documentar por qué y cómo

### ❌ NO usar scope_ref para shared o pde

**Error**:
```javascript
// Enviar scope_ref para shared (innecesario)
{
  clean_layer: 'shared',
  scope_ref: 'student-uuid-123'  // ❌ Redundante
}
```

**Por qué está prohibido**:
- `shared` y `pde` ya tienen `student_uuid` como identificador
- `scope_ref` es solo para `group` y `pair`
- Añadir `scope_ref` para `shared`/`pde` confunde el modelo

**Qué hacer**:
- `scope_ref` solo se envía cuando `clean_layer` es `group` o `pair`
- Para `shared`/`pde`, usar `student_uuid` directamente

### ❌ NO inferir scope_ref desde contexto

**Error**:
```javascript
// Inferir scope_ref desde grupo del estudiante
const scopeRef = student.group_uuid;  // ❌ Inferencia
```

**Por qué está prohibido**:
- La inferencia introduce bugs sutiles
- El scope debe ser explícito en el payload
- Puede haber ambigüedad (estudiante en múltiples grupos)

**Qué hacer**:
- `scope_ref` debe venir explícitamente en el payload
- Validar que `scope_ref` es válido antes de usar

### ❌ NO mezclar capas en una sola operación

**Error**:
```javascript
// Intentar limpiar shared Y pde en una sola operación
{
  clean_layer: 'shared_and_pde',  // ❌ No existe
  // o
  clean_layers: ['shared', 'pde']  // ❌ No soportado
}
```

**Por qué está prohibido**:
- El modelo canónico requiere una sola `clean_layer` por operación
- Mezclar capas complica la lógica y la auditoría

**Qué hacer**:
- Hacer múltiples POST separados (uno por `clean_layer`)
- Si necesitas afectar múltiples capas, orquestar desde el frontend

### ❌ NO crear view_layer sin clean_layer correspondiente

**Error**:
```javascript
// Crear view_layer='group' sin tener clean_layer='group' implementado
if (view_layer === 'group') {
  // Calcular estado desde group_* (pero group_* no existe en DB)
}
```

**Por qué está prohibido**:
- `view_layer` requiere que la capa correspondiente esté implementada
- No puedes "ver" algo que no existe

**Qué hacer**:
- Implementar `clean_layer` primero
- Luego implementar `view_layer` correspondiente
- Mantener sincronización entre capas

---

## ORDEN DE IMPLEMENTACIÓN

Para añadir una nueva capa (ej: `group`), seguir este orden:

1. **Constantes**: Añadir a `ALLOWED_CLEAN_LAYERS`
2. **Schema DB**: Añadir columnas `group_*`
3. **Cleaning Engine**: Añadir lógica de escritura
4. **Repositorio**: Añadir métodos de escritura
5. **Servicio**: Añadir a `computeVisualState()`
6. **Endpoints**: Añadir validaciones
7. **UI**: Añadir columna correspondiente

**Regla**: No saltarse pasos. Cada paso depende del anterior.

---

## VALIDACIÓN DE SCOPE_REF

### Para group

```javascript
async function validateGroupScopeRef(scopeRef) {
  // Verificar que scopeRef es un group_uuid válido
  const group = await getGroupByUuid(scopeRef);
  if (!group) {
    throw new Error(`Group not found: ${scopeRef}`);
  }
  return true;
}
```

### Para pair

```javascript
async function validatePairScopeRef(scopeRef) {
  // Verificar que scopeRef es un pair_uuid válido
  const pair = await getPairByUuid(scopeRef);
  if (!pair) {
    throw new Error(`Pair not found: ${scopeRef}`);
  }
  return true;
}
```

---

## EJEMPLO COMPLETO: AÑADIR GROUP

### Payload POST

```json
POST /master/api/alquimia-general/items/te_item_6/master/mark-clean-all
{
  "item_ref": "te_item_6",
  "item_kind": "recurrente",
  "clean_layer": "group",  // Nueva capa
  "scope_ref": "group-uuid-123",  // OBLIGATORIO para group
  "actor_type": "master",
  "surface_key": "master.alquimia_general"
}
```

### Estado en DB (después de POST)

```sql
SELECT 
  shared_clean_count, 
  pde_clean_count,
  group_clean_count,  -- Nueva columna
  scope_ref
FROM cleaning_item_state 
WHERE item_ref = 'te_item_6' AND scope_ref = 'group-uuid-123';

-- Resultado:
-- shared_clean_count: 5 (no cambió)
-- pde_clean_count: 2 (no cambió)
-- group_clean_count: 1 (aumentó)
-- scope_ref: 'group-uuid-123'
```

### Proyección GET

```
GET /master/api/alquimia-general/items/te_item_6/students?view_layer=group
```

**Respuesta**:
```json
{
  "student_uuid": "...",
  "shared": { "clean_count": 5 },
  "pde": { "clean_count": 2 },
  "group": {  // Nueva capa
    "clean_count": 1,
    "days_since_last_clean": 0
  },
  "state_by_view_layer": {
    "shared": { "state": "pending" },
    "pde": { "state": "pending" },
    "group": {  // Nueva capa
      "state": "reviewed",
      "visual_state": "reviewed"
    }
  }
}
```

---

## REFERENCIAS

- `docs/CLEANING_ENGINE_CANONICAL_MODEL_V1.md` - Modelo canónico base
- `src/core/master/services/cleaning-layer-constants.js` - Constantes
- `src/core/master/services/cleaning-engine-service.js` - Motor de limpieza

---

**FIN DEL DOCUMENTO**
