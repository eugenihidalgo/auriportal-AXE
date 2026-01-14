# ALQUIMIA ITEM OVERRIDES v1
**AuriPortal / Aurelín — Dominio MASTER**  
**Versión:** 1.0.0  
**Fecha:** 2026-01-13  
**Estado:** CANÓNICO  
**Commit:** c12bc04 (feat: add per-item student clean buttons)

---

## PROPÓSITO

Documentación canónica del sistema de acciones individuales por ítem en Alquimia General, específicamente para la vista de proyección ALUMNO.

Este documento refleja **EXACTAMENTE** la implementación canónica de:
- Botones de limpieza individual por ítem (solo vista ALUMNO)
- Persistencia del tamaño del flotante (expanded/collapsed)

**OBLIGATORIO:** Cualquier cambio en estas funcionalidades debe actualizar este documento.

---

## 1) OBJETIVO Y ALCANCE

### 1.1 Objetivo

Permitir al Master realizar acciones de limpieza individuales por ítem directamente desde la vista de proyección ALUMNO, sin necesidad de abrir el flotante de detalles.

### 1.2 Alcance

- **Dominio:** Listas/Ítems (Alquimia General)
- **Vista:** Solo Proyección ALUMNO (scope='student')
- **Acciones:** Limpieza SHARED y PDE por ítem individual
- **Persistencia:** Tamaño del flotante (expanded/collapsed)

**NOTA:** Este sistema NO es "override global de todo AuriPortal", pero es extensible por patrón para futuras funcionalidades.

---

## 2) REGLAS CONSTITUCIONALES APLICADAS

### 2.1 Backend como Autoridad

- El backend es la **ÚNICA autoridad** de estado
- El frontend NO calcula estados
- Toda acción requiere refetch completo desde backend

### 2.2 Acción → Estado → Proyección → UI

**Pipeline canónico:**
1. Usuario pulsa botón → Acción (POST)
2. Backend actualiza estado → Cleaning Engine
3. Backend recalcula proyección → LPM
4. Frontend refetch → Re-render desde datos frescos

### 2.3 UUID-only

- Todas las acciones usan `student_uuid` (UUID)
- PROHIBIDO: `legacy_alumno_id`, `student_id INTEGER`
- Identidad canónica: `students.id` (UUID)

### 2.4 No Frontend Inference

- El frontend NO infiere estados desde datos raw
- Consume EXCLUSIVAMENTE `state_by_view_layer[view_layer]`
- Refetch obligatorio tras mutaciones

### 2.5 ALL = Worst-of-Students

- En proyección ALL, cada ítem refleja el **peor estado** del grupo
- Si un estudiante no tiene fila → cuenta como NULL (nunca trabajado)
- Estado agregado = mínimo común denominador

---

## 3) MODELO DE DATOS

### 3.1 Tablas Existentes (No Overrides)

**IMPORTANTE:** El sistema de "overrides" de `threshold_days` o `required_count` **NO está implementado** en esta versión.

Las tablas actuales son:

#### cleaning_item_state (Proyección Materializada)

```sql
CREATE TABLE cleaning_item_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id),
  product_key VARCHAR(50) NOT NULL DEFAULT 'pde',
  domain_type VARCHAR(50) NOT NULL DEFAULT 'transmutation',
  item_ref VARCHAR(255) NOT NULL,
  
  -- Recurrente
  shared_last_cleaned_at TIMESTAMP,
  pde_last_cleaned_at TIMESTAMP,
  shared_days_since_last_clean INTEGER,
  pde_days_since_last_clean INTEGER,
  
  -- Una_vez
  shared_clean_count INTEGER DEFAULT 0,
  pde_clean_count INTEGER DEFAULT 0,
  shared_remaining INTEGER,
  pde_remaining INTEGER,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(student_id, product_key, domain_type, item_ref)
);
```

#### cleaning_events (Event Log)

```sql
CREATE TABLE cleaning_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP DEFAULT NOW(),
  trace_id VARCHAR(255),
  execution_key VARCHAR(255) NOT NULL,
  student_id UUID NOT NULL REFERENCES students(id),
  product_key VARCHAR(50) NOT NULL DEFAULT 'pde',
  domain_type VARCHAR(50) NOT NULL DEFAULT 'transmutation',
  item_ref VARCHAR(255) NOT NULL,
  clean_layer VARCHAR(50) NOT NULL, -- 'shared' | 'pde'
  item_kind VARCHAR(50) NOT NULL, -- 'recurrente' | 'una_vez'
  action_type VARCHAR(50) NOT NULL,
  delta_completed INTEGER,
  set_remaining INTEGER,
  actor_type VARCHAR(50),
  actor_ref VARCHAR(255),
  surface_key VARCHAR(255),
  meta JSONB,
  
  UNIQUE(execution_key, student_id)
);
```

### 3.2 Tabla Futura: student_item_overrides (NO IMPLEMENTADA)

**NOTA:** Esta tabla NO existe actualmente. Se documenta aquí como patrón para futuras implementaciones.

```sql
-- FUTURA: Tabla de overrides por estudiante/ítem
CREATE TABLE student_item_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id),
  item_ref VARCHAR(255) NOT NULL,
  product_key VARCHAR(50) NOT NULL DEFAULT 'pde',
  domain_type VARCHAR(50) NOT NULL DEFAULT 'transmutation',
  
  -- Tipos de override
  override_type VARCHAR(50) NOT NULL, -- 'threshold_days' | 'required_count'
  override_value INTEGER NOT NULL,
  
  -- Metadata
  actor_type VARCHAR(50) NOT NULL, -- 'master' | 'automation'
  actor_ref VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP,
  
  UNIQUE(student_id, item_ref, product_key, domain_type, override_type)
);

CREATE INDEX idx_student_item_overrides_student_item 
  ON student_item_overrides(student_id, item_ref, product_key, domain_type) 
  WHERE deleted_at IS NULL;
```

**Semántica por item_kind:**
- **recurrente:** `override_type='threshold_days'` → Override de `frecuencia_dias` del ítem
- **una_vez:** `override_type='required_count'` → Override de `veces_limpiar` del ítem

---

## 4) CONTRATOS API

### 4.1 Endpoints de Limpieza Individual (IMPLEMENTADOS)

#### POST /master/api/alquimia-general/items/:item_ref/students/:student_uuid/mark-clean-student

**Descripción:** Limpia un ítem individual para un estudiante específico.

**Parámetros de ruta:**
- `item_ref` (string): Referencia del ítem
- `student_uuid` (UUID): UUID del estudiante

**Body (JSON):**
```json
{
  "clean_layer": "shared" | "pde",
  "item_kind": "recurrente" | "una_vez",
  "actor_type": "master",
  "surface_key": "master.alquimia_general"
}
```

**Response (200 OK):**
```json
{
  "ok": true,
  "data": {
    "student_uuid": "uuid-del-estudiante",
    "item_ref": "item-ref-123",
    "clean_layer": "shared",
    "state": {
      "shared_last_cleaned_at": "2026-01-13T10:00:00Z",
      "shared_days_since_last_clean": 0
    }
  },
  "trace_id": "trace-123"
}
```

**Ejemplo de uso desde frontend:**
```javascript
await handleLimpiarEstudiante(
  { student_uuid: 'uuid' },
  { item_ref: 'item-ref-123' },
  'shared',
  'recurrente'
);
```

### 4.2 Endpoints Futuros: Overrides (NO IMPLEMENTADOS)

**NOTA:** Estos endpoints NO existen actualmente. Se documentan como patrón para futuras implementaciones.

#### POST /master/api/alquimia-general/items/:item_ref/students/:student_uuid/override

**Descripción:** Crea o actualiza un override para un estudiante/ítem.

**Body (JSON):**
```json
{
  "override_type": "threshold_days" | "required_count",
  "override_value": 20,
  "actor_type": "master"
}
```

#### DELETE /master/api/alquimia-general/items/:item_ref/students/:student_uuid/override

**Descripción:** Elimina un override (soft delete).

#### POST /master/api/alquimia-general/items/:item_ref/reset-pending-all

**Descripción:** Resetea estado "pending" para todos los estudiantes (recurrente).

#### POST /master/api/alquimia-general/items/:item_ref/clear-overrides

**Descripción:** Elimina todos los overrides de `required_count` para un ítem (una_vez).

---

## 5) LPM/CPM: APLICACIÓN DE OVERRIDES

### 5.1 Estado Actual (Sin Overrides)

**Cleaning Projection Model (CPM):**
- Calcula estado desde `cleaning_item_state` directamente
- Usa `frecuencia_dias` del ítem (recurrente)
- Usa `veces_limpiar` del ítem (una_vez)

**List Projection Model (LPM):**
- Agrega estados por `scope` ('all' | 'student')
- En `scope='all'`: calcula worst-of-students
- En `scope='student'`: devuelve estado individual

### 5.2 Futuro: Aplicación de Overrides (NO IMPLEMENTADO)

**Patrón propuesto:**

```javascript
// En CPM: computeStateForLayer()
const thresholdDays = item.frecuencia_dias; // Base
const override = await getOverride(student_uuid, item_ref, 'threshold_days');
const effectiveThreshold = override?.override_value || thresholdDays;

// Calcular estado con effectiveThreshold
if (daysSinceLastClean > effectiveThreshold) {
  state = 'important';
}
```

**Ejemplo: required_count override:**

```javascript
// En CPM: computeStateForLayer() (una_vez)
const requiredCount = item.veces_limpiar; // Base: 10
const override = await getOverride(student_uuid, item_ref, 'required_count');
const effectiveRequired = override?.override_value || requiredCount; // Override: 20

// Calcular remaining
const remaining = Math.max(effectiveRequired - cleanCount, 0);
```

**Impacto en ALL projection:**
- Si un estudiante tiene `required_count=20` (override) y otro tiene `required_count=10` (base):
- El estado agregado en ALL debe reflejar el **peor estado** (mayor remaining)
- Ejemplo: Estudiante A tiene `remaining=5` (de 20), Estudiante B tiene `remaining=0` (de 10)
- ALL debe mostrar `remaining=5` (worst-of-students)

---

## 6) UI: BOTONES Y PERSISTENCIA

### 6.1 Botones de Limpieza Individual (Vista ALUMNO)

**Ubicación:** Solo en Proyección ALUMNO (scope='student')

**Condición de visibilidad (REGLA DURA):**
```javascript
const isProjectionStudent = 
  state.projection.scope === 'student' && 
  !!state.projection.student_uuid;
```

**Botones por ítem:**
1. **"Limpiar"** (verde, #10b981)
   - Acción: `action_clean_layer: 'shared'`
   - Llama: `handleLimpiarEstudiante(student, item, 'shared', itemKind)`

2. **"Limpiar PDE"** (morado, #8b5cf6)
   - Acción: `action_clean_layer: 'pde'`
   - Llama: `handleLimpiarEstudiante(student, item, 'pde', itemKind)`

**Implementación:**
```javascript
// En createItemTableRow(item, isCreateRow, isProjectionStudent)
if (isProjectionStudent && state.projection.scope === 'student' && state.projection.student_uuid) {
  // Botón "Limpiar" (SHARED)
  const btnLimpiarShared = document.createElement('button');
  btnLimpiarShared.textContent = 'Limpiar';
  btnLimpiarShared.addEventListener('click', async () => {
    await handleLimpiarEstudiante(studentForAction, item, 'shared', itemKind);
    await loadListProjection(); // Refetch
    renderView(); // Re-render
  });
  
  // Botón "Limpiar PDE"
  const btnLimpiarPde = document.createElement('button');
  btnLimpiarPde.textContent = 'Limpiar PDE';
  btnLimpiarPde.addEventListener('click', async () => {
    await handleLimpiarEstudiante(studentForAction, item, 'pde', itemKind);
    await loadListProjection(); // Refetch
    renderView(); // Re-render
  });
}
```

**Comportamiento:**
- Tras acción exitosa: refetch de proyección + re-render
- El estudiante se reubica automáticamente en la columna correcta
- Respeta Regla Acción → Proyección → Ubicación

### 6.2 Persistencia del Tamaño del Flotante

**Clave localStorage:**
```javascript
const SIZE_STORAGE_KEY = 'master_alquimia_flotante_size';
```

**Valores permitidos:**
- `'expanded'`: 1800px × 1000px
- `'collapsed'`: 800px × 500px
- `null`: Usa tamaño por defecto (1000px × 600px)

**Escritura:**
- Solo por acción directa del usuario (botones "⛶ Expandir" / "⊟ Reducir")
- Ubicación: Header del flotante, junto a botones de vista

**Lectura:**
- Al abrir flotante: `localStorage.getItem(SIZE_STORAGE_KEY)`
- Aplicación automática del tamaño guardado
- Si no hay valor guardado: mantiene tamaño por defecto

**Reaplicación automática:**
- Al abrir flotante
- Al cambiar de vista (SHARED/PDE/EFFECTIVE/COMBO)
- Al cambiar de lista
- Tras acciones (limpieza, marcar, etc.)
- Al recargar página

**Implementación:**
```javascript
// En showFlotanteVer()
const savedSize = localStorage.getItem(SIZE_STORAGE_KEY);
const isExpanded = savedSize === 'expanded';
const isCollapsed = savedSize === 'collapsed';

if (isExpanded) {
  modal.style.width = '1800px';
  modal.style.height = '1000px';
} else if (isCollapsed) {
  modal.style.width = '800px';
  modal.style.height = '500px';
}

// Botones de control
const changeSize = (newSize) => {
  applySize(newSize);
  localStorage.setItem(SIZE_STORAGE_KEY, newSize);
};
```

### 6.3 Botones Futuros: Reset Overrides (NO IMPLEMENTADOS)

**NOTA:** Estos botones NO existen actualmente. Se documentan como patrón para futuras implementaciones.

**Botón "Resetear todo" (solo Proyección):**
- **recurrente:** Resetea estado "pending" para todos los estudiantes
- **una_vez:** Elimina todos los overrides de `required_count` para el ítem

**Semántica distinta por tipo:**
- **recurrente:** `reset-pending-all` → Marca como "never" todos los estudiantes con estado "pending"
- **una_vez:** `clear-overrides` → Elimina overrides, vuelve a `required_count` base del ítem

---

## 7) VERIFICACIÓN

### 7.1 Checklist de Pruebas Manuales

#### Botones de Limpieza Individual

- [ ] **Vista ALL:** NO hay botones de limpieza individual
- [ ] **Vista OPERATIVA:** NO hay botones de limpieza individual
- [ ] **Vista ALUMNO:**
  - [ ] Cada ítem muestra dos botones: "Limpiar" y "Limpiar PDE"
  - [ ] Pulsar "Limpiar" → limpia SHARED
  - [ ] Pulsar "Limpiar PDE" → limpia PDE
  - [ ] Tras acción: proyección se refresca automáticamente
  - [ ] El estudiante se reubica correctamente en columnas
  - [ ] Logs en consola: `[UI][PROJECTION][STUDENT][CLEAN]`

#### Persistencia del Tamaño del Flotante

- [ ] **Expandir flotante:**
  - [ ] Pulsar "⛶ Expandir" → flotante se expande a 1800×1000
  - [ ] Cambiar de vista → tamaño se mantiene
  - [ ] Cambiar de lista → tamaño se mantiene
  - [ ] Ejecutar limpieza → tamaño se mantiene
  - [ ] Cerrar y reabrir flotante → tamaño se mantiene
  - [ ] Recargar página → tamaño se mantiene

- [ ] **Reducir flotante:**
  - [ ] Pulsar "⊟ Reducir" → flotante se reduce a 800×500
  - [ ] Cambiar de vista → tamaño se mantiene
  - [ ] Cambiar de lista → tamaño se mantiene
  - [ ] Ejecutar limpieza → tamaño se mantiene
  - [ ] Cerrar y reabrir flotante → tamaño se mantiene
  - [ ] Recargar página → tamaño se mantiene

- [ ] **Verificación localStorage:**
  - [ ] `localStorage.getItem('master_alquimia_flotante_size')` devuelve valor correcto
  - [ ] Valor persiste entre sesiones

### 7.2 Known Limitations

1. **Overrides NO implementados:**
   - No existe sistema de overrides de `threshold_days` o `required_count`
   - No hay endpoints de override
   - No hay tabla `student_item_overrides`

2. **Botones solo en vista ALUMNO:**
   - Los botones de limpieza individual NO aparecen en vista ALL
   - Los botones de limpieza individual NO aparecen en vista OPERATIVA
   - Esto es por diseño (regla dura)

3. **Tamaño del flotante:**
   - Solo dos tamaños: expanded (1800×1000) y collapsed (800×500)
   - No hay tamaño intermedio
   - No hay redimensionamiento manual (solo botones)

---

## 8) CAMBIOS LOG

### 8.1 Commits Relacionados

- **c12bc04** (2026-01-13): `feat(master-alquimia): add per-item student clean buttons (shared/pde)`
  - Añadidos botones de limpieza individual en vista ALUMNO
  - Implementada persistencia del tamaño del flotante

- **8aabf2f** (2026-01-13): `feat(master-ui): persist flotante size in localStorage`
  - Persistencia del tamaño del flotante (expanded/collapsed)

- **85d542e** (2026-01-13): `feat(master-ui): increase expanded flotante size`
  - Tamaño expandido aumentado: 1400×800 → 1800×1000

### 8.2 Migraciones

**Ninguna migración requerida** (esta versión no introduce nuevas tablas).

### 8.3 Versión

- **Versión del documento:** 1.0.0
- **Versión de la app:** 5.70.9
- **Fecha:** 2026-01-13

---

## 9) REFERENCIAS

### 9.1 Documentación Relacionada

- `docs/ALQUIMIA_CANONICA_V1.md` - Documentación canónica de Alquimia
- `docs/ALQUIMIA_UX_RULES_V1.md` - Reglas de UX de Alquimia
- `docs/ALQUIMIA_FLOTANTE_VER_V1.md` - Contrato del flotante VER
- `docs/CONSTITUTION_VIEW_AUTHORITY_V1.md` - Regla de autoridad de vista
- `docs/LPM_ALL_WORST_STATE_V1.md` - Proyección ALL worst-state
- `docs/CLEANING_PROJECTION_MODEL_V1.md` - Modelo de proyección de limpieza

### 9.2 Código Fuente

- `public/js/master/master-alquimia-general-client.js` - Cliente JavaScript
- `src/core/master/services/cleaning-engine-service.js` - Cleaning Engine
- `src/core/master/services/list-projection-model.js` - List Projection Model
- `src/core/master/services/cleaning-projection-model.js` - Cleaning Projection Model

---

**FIN DEL DOCUMENTO**
