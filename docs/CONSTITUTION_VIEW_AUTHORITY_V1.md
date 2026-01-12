# Constitución: Regla de Autoridad de Vista v1

**Versión**: 1.0.0  
**Fecha**: 2025-01-27  
**Dominio**: TODO AuriPortal (MASTER, GOD, futuros dominios)  
**Estado**: CONSTITUCIONAL

## Estatuto Constitucional

Esta regla tiene **estatus constitucional** y aplica a **TODO AuriPortal**, incluyendo:
- MASTER
- GOD
- Cualquier dominio futuro

## Principios Fundamentales

### 1. Autoridad de Estado

**El backend es la ÚNICA autoridad de estado.**

Todo estado visible en UI debe venir **calculado desde backend**.

**PROHIBIDO:**
- Calcular estados en frontend
- Inferir estados desde datos raw
- Combinar estados localmente
- Reutilizar estados previos sin refetch

**OBLIGATORIO:**
- Solicitar datos al backend con `view_layer` explícita
- Consumir proyecciones calculadas (`state_by_view_layer[view_layer]`)
- Re-renderizar cuando el backend devuelve un estado distinto

### 2. View Layer Obligatoria

**Todo cálculo de estado debe hacerse SIEMPRE en función de una `view_layer` explícita.**

Nunca se calcula estado sin saber desde qué vista se está mirando.

**Ejemplos de view_layer:**
- `view_layer='shared'` - Vista compartida (estudiantes)
- `view_layer='pde'` - Vista PDE (master)
- `view_layer='combo'` - Vista combinada (shared + pde)
- Futuras: `'group'`, `'pair'`, etc.

**PROHIBIDO:**
- Calcular estado sin `view_layer`
- Usar defaults implícitos para `view_layer`
- Asumir `view_layer` desde contexto sin validar

**OBLIGATORIO:**
- `view_layer` explícita en todas las peticiones GET
- Validación de `view_layer` en backend
- Error explícito si `view_layer` falta o es inválida

### 3. Separación Absoluta de Responsabilidades

#### clean_layer (POST - Acciones)

**Propósito:** Decide qué columnas se escriben (shared, pde, etc.)

**Uso:** SOLO en acciones (POST, PUT, DELETE)

**Ejemplos:**
- `clean_layer='shared'` → Escribe en `shared_*` columns
- `clean_layer='pde'` → Escribe en `pde_*` columns

**PROHIBIDO:**
- Usar `clean_layer` para calcular estado
- Usar `clean_layer` en peticiones GET
- Inferir `clean_layer` desde contexto

#### view_layer (GET - Proyección)

**Propósito:** Decide cómo se calcula el estado y en qué columna cae el alumno

**Uso:** SOLO en lectura / proyección (GET)

**Ejemplos:**
- `view_layer='shared'` → Calcula estado desde `shared_*` columns
- `view_layer='pde'` → Calcula estado desde `pde_*` columns
- `view_layer='combo'` → Calcula estado combinando `shared_*` y `pde_*`

**PROHIBIDO:**
- Usar `view_layer` en acciones (POST)
- Mezclar `view_layer` con `clean_layer`
- Calcular estado sin `view_layer`

### 4. Prohibiciones Explícitas en Frontend

El frontend **NO puede:**

- ❌ **Inferir estados** - No puede deducir estado desde datos raw
- ❌ **Calcular estados** - No puede calcular `state`, `visual_state`, `days_since_last_clean`
- ❌ **Decidir columnas** - No puede decidir en qué columna va un alumno
- ❌ **Combinar capas** - No puede combinar `shared` y `pde` localmente
- ❌ **Reutilizar estados previos** - No puede asumir que un estado sigue siendo válido

**Ejemplo de violación:**
```javascript
// ❌ PROHIBIDO: Calcular estado en frontend
const state = student.shared_last_cleaned_at 
  ? (daysSince(student.shared_last_cleaned_at) > 7 ? 'pending' : 'reviewed')
  : 'never';

// ✅ CORRECTO: Consumir estado calculado por backend
const stateData = student.state_by_view_layer?.[activeViewLayer];
const state = stateData?.state || 'never';
```

### 5. Responsabilidad Única del Frontend

El frontend **SOLO puede:**

- ✅ **Solicitar datos** al backend con `view_layer` explícita
- ✅ **Renderizar proyecciones** recibidas desde backend
- ✅ **Re-renderizar** cuando el backend devuelve un estado distinto

**Ejemplo correcto:**
```javascript
// ✅ CORRECTO: Solicitar datos con view_layer explícita
const response = await fetch(`/master/api/alquimia-general/items/${itemRef}/students?view_layer=${activeViewLayer}`);

// ✅ CORRECTO: Consumir proyección calculada
const students = await response.json();
students.forEach(student => {
  const stateData = student.state_by_view_layer[activeViewLayer];
  renderStudentInColumn(stateData.state, stateData.visual_state);
});
```

### 6. Fuente Única de Columnas

**La asignación de columnas en cualquier UI debe depender EXCLUSIVAMENTE de un campo calculado en backend.**

**Contrato canónico:**
```javascript
// Backend calcula state_by_view_layer para cada view_layer
student.state_by_view_layer = {
  'shared': { state: 'pending', visual_state: 'in_progress', ... },
  'pde': { state: 'reviewed', visual_state: 'completed', ... },
  'combo': { state: 'pending', visual_state: 'in_progress', ... }
};

// Frontend consume EXCLUSIVAMENTE state_by_view_layer[view_layer]
const stateData = student.state_by_view_layer[activeViewLayer];
const column = determineColumnFromState(stateData.state, stateData.visual_state);
```

**Regla absoluta:**
Si un alumno no cambia de columna tras una acción, el sistema está **canónicamente roto**, aunque la base de datos sea correcta.

**Causa raíz:** El backend no está calculando correctamente `state_by_view_layer[view_layer]` o el frontend no está consumiendo la proyección correcta.

### 7. Ámbito de Aplicación

Esta regla **NO es solo para Alquimia**.

Aplica a:
- ✅ **Alquimia** (MASTER / Alumno)
- ✅ **Progreso** (niveles, fases, días)
- ✅ **Señales** (eventos, automatizaciones)
- ✅ **Widgets** (componentes reutilizables)
- ✅ **Grupos** (futuro)
- ✅ **Parejas** (futuro)
- ✅ **Cualquier UI futura**

**Cualquier implementación que viole esta regla debe considerarse incorrecta y rehacerse.**

## Contrato Backend

### GET Endpoints

**OBLIGATORIO:**
- Aceptar parámetro `view_layer` explícito
- Validar `view_layer` (debe ser uno de los valores permitidos)
- Calcular `state_by_view_layer[view_layer]` para cada estudiante
- Devolver proyección completa en respuesta

**Ejemplo de contrato:**
```javascript
GET /master/api/alquimia-general/items/:itemRef/students?view_layer=shared

Response:
{
  "students": [
    {
      "student_uuid": "...",
      "state_by_view_layer": {
        "shared": {
          "state": "pending",
          "visual_state": "in_progress",
          "days_since_last_clean": 5,
          "last_cleaned_at": "2025-01-22T10:00:00Z"
        },
        "pde": {
          "state": "reviewed",
          "visual_state": "completed",
          "days_since_last_clean": 2,
          "last_cleaned_at": "2025-01-25T10:00:00Z"
        },
        "combo": {
          "state": "pending",
          "visual_state": "in_progress",
          "days_since_last_clean": 5,
          "last_cleaned_at": "2025-01-22T10:00:00Z"
        }
      }
    }
  ]
}
```

### POST Endpoints

**OBLIGATORIO:**
- Aceptar parámetro `clean_layer` explícito
- Validar `clean_layer` (debe ser 'shared' o 'pde', nunca 'combo')
- Escribir en columnas correspondientes (`shared_*` o `pde_*`)
- NO usar `clean_layer` para calcular estado

**Ejemplo de contrato:**
```javascript
POST /master/api/alquimia-general/items/:itemRef/clean
{
  "student_uuid": "...",
  "clean_layer": "shared",  // OBLIGATORIO: explícito
  "item_kind": "recurrente"
}

Response:
{
  "success": true,
  "execution_key": "...",
  "trace_id": "..."
}
```

## Contrato Frontend

### Solicitud de Datos

**OBLIGATORIO:**
- Incluir `view_layer` explícita en todas las peticiones GET
- No inferir `view_layer` desde contexto sin validar
- Manejar errores si `view_layer` falta o es inválida

**Ejemplo:**
```javascript
// ✅ CORRECTO: view_layer explícita
const activeViewLayer = state.modal.layerView || 'shared';
const url = `/master/api/alquimia-general/items/${itemRef}/students?view_layer=${activeViewLayer}`;
const response = await fetch(url);

// ❌ PROHIBIDO: view_layer implícita o inferida
const url = `/master/api/alquimia-general/items/${itemRef}/students`; // Falta view_layer
```

### Consumo de Proyecciones

**OBLIGATORIO:**
- Consumir EXCLUSIVAMENTE `state_by_view_layer[view_layer]`
- No calcular estado desde campos raw (`shared_last_cleaned_at`, etc.)
- No combinar capas localmente

**Ejemplo:**
```javascript
// ✅ CORRECTO: Consumir proyección calculada
const stateData = student.state_by_view_layer?.[activeViewLayer];
if (!stateData) {
  console.warn('state_by_view_layer no disponible para view_layer:', activeViewLayer);
  return; // Fallback seguro
}

const state = stateData.state;
const visualState = stateData.visual_state;
const column = determineColumnFromState(state, visualState);

// ❌ PROHIBIDO: Calcular estado desde campos raw
const daysSince = calculateDaysSince(student.shared_last_cleaned_at);
const state = daysSince > 7 ? 'pending' : 'reviewed'; // Cálculo en frontend
```

### Re-renderizado Post-Acción

**OBLIGATORIO:**
- Refetch completo después de cualquier acción (POST)
- Usar `view_layer` activa para refetch
- Re-renderizar desde datos frescos del backend

**Ejemplo:**
```javascript
// ✅ CORRECTO: Refetch con view_layer activa
async function handleLimpiarItem(item, cleanLayer) {
  const activeViewLayer = state.modal.layerView || 'shared';
  
  // POST: Acción con clean_layer
  await fetch(`/master/api/alquimia-general/items/${itemRef}/clean`, {
    method: 'POST',
    body: JSON.stringify({ clean_layer: cleanLayer, ... })
  });
  
  // GET: Refetch con view_layer activa
  const response = await fetch(`/master/api/alquimia-general/items/${itemRef}/students?view_layer=${activeViewLayer}`);
  const { students } = await response.json();
  
  // Re-renderizar desde datos frescos
  renderStudents(students, activeViewLayer);
}

// ❌ PROHIBIDO: Asumir estado local sin refetch
async function handleLimpiarItem(item, cleanLayer) {
  await fetch(`/master/api/alquimia-general/items/${itemRef}/clean`, {
    method: 'POST',
    body: JSON.stringify({ clean_layer: cleanLayer, ... })
  });
  
  // ❌ Asumir que el estado cambió sin verificar
  updateLocalState(student, { state: 'reviewed' }); // PROHIBIDO
}
```

## Integración con Reglas Constitucionales Existentes

### Source of Truth

Esta regla refuerza el principio de que **PostgreSQL es el único Source of Truth**:

- El backend calcula estados desde PostgreSQL usando `view_layer`
- El frontend NO puede calcular estados desde datos raw
- Toda proyección viene del backend

**Referencia:** `CERTIFICACION_SOURCE_OF_TRUTH_FASE1.md`

### Cleaning Engine

Esta regla se integra con el **Cleaning Engine v1**:

- `clean_layer` se usa SOLO en acciones (Cleaning Engine)
- `view_layer` se usa SOLO en proyecciones (lectura)
- Estados se calculan desde `cleaning_item_state` usando `view_layer`

**Referencia:** `docs/ALQUIMIA_CANONICA_V1.md`

### UI Refetch Obligatorio

Esta regla refuerza la regla de **UI refetch obligatorio tras mutaciones**:

- Después de cualquier POST, hacer refetch completo con `view_layer` activa
- Re-renderizar desde datos frescos del backend
- NUNCA asumir que "ya está" sin verificar con GET

**Referencia:** Regla constitucional `ui-refetch-after-mutations`

## Verificación y Validación

### Assembly Check

**OBLIGATORIO:**
- Verificar que todos los endpoints GET aceptan `view_layer`
- Verificar que todos los endpoints POST aceptan `clean_layer`
- Verificar que el frontend consume `state_by_view_layer[view_layer]`
- Verificar que no hay cálculos de estado en frontend

### Logs Estructurados

**OBLIGATORIO:**
- Log `view_layer` en todas las peticiones GET
- Log `clean_layer` en todas las peticiones POST
- Log `state_by_view_layer` en respuestas del backend
- Log warnings si el frontend intenta calcular estado

**Ejemplo:**
```javascript
console.log('[VIEW_AUTHORITY] GET request', {
  view_layer: activeViewLayer,
  item_ref: itemRef,
  trace_id: traceId
});

console.log('[VIEW_AUTHORITY] Response', {
  students_count: students.length,
  state_by_view_layer_present: students.every(s => s.state_by_view_layer),
  trace_id: traceId
});
```

## Casos de Uso

### Caso 1: Alquimia General - Flotante de Alumnos

**Escenario:** Master abre flotante de alumnos para un item RECURRENTE

**Flujo correcto:**
1. Frontend determina `view_layer` activa (ej: `'shared'`)
2. Frontend solicita: `GET /master/api/.../students?view_layer=shared`
3. Backend calcula `state_by_view_layer['shared']` para cada estudiante
4. Backend devuelve proyección completa
5. Frontend consume `state_by_view_layer['shared']` y renderiza en columnas

**Violación:**
- Frontend calcula estado desde `shared_last_cleaned_at` → ❌ PROHIBIDO

### Caso 2: Alquimia General - Limpieza de Item

**Escenario:** Master limpia un item para un estudiante

**Flujo correcto:**
1. Frontend determina `clean_layer` (ej: `'shared'`)
2. Frontend envía: `POST /master/api/.../clean { clean_layer: 'shared' }`
3. Backend escribe en `shared_*` columns
4. Frontend hace refetch: `GET /master/api/.../students?view_layer=shared`
5. Backend calcula nuevo `state_by_view_layer['shared']`
6. Frontend re-renderiza desde datos frescos

**Violación:**
- Frontend asume que el estado cambió sin refetch → ❌ PROHIBIDO

### Caso 3: Cambio de Vista (SHARED → PDE)

**Escenario:** Master cambia de vista SHARED a PDE

**Flujo correcto:**
1. Frontend actualiza `activeViewLayer = 'pde'`
2. Frontend solicita: `GET /master/api/.../students?view_layer=pde`
3. Backend calcula `state_by_view_layer['pde']` para cada estudiante
4. Backend devuelve proyección completa
5. Frontend consume `state_by_view_layer['pde']` y re-renderiza columnas

**Violación:**
- Frontend reutiliza `state_by_view_layer['shared'] para PDE → ❌ PROHIBIDO

## Referencias

- `CERTIFICACION_SOURCE_OF_TRUTH_FASE1.md` - Source of Truth canónico
- `docs/ALQUIMIA_CANONICA_V1.md` - Sistema de Alquimia canónico
- `docs/CONSTITUTION_ALQUIMIA_AND_CLASSIFICATIONS_V1.md` - Constitución Alquimia
- `PRINCIPIOS_INMUTABLES_AURIPORTAL.md` - Principios inmutables

## Historial de Versiones

- **v1.0.0** (2025-01-27): Versión inicial constitucional

---

**Fin del Documento Constitucional**
