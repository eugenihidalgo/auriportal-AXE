# MASTER ALQUIMIA PDE LAYERS v1

**Versión**: v5.70.6  
**Fecha**: 2025-01-08  
**Dominio**: MASTER  
**Estado**: CANÓNICO

---

## 1. DEFINICIÓN DE CAPAS

### 1.1. SHARED (Capa Compartida)

**Semántica**: Capa visible y compartible con el alumno (aunque actualmente solo estemos en MASTER, la semántica es futura).

**Características**:
- Estado visible al alumno (futuro)
- Contadores independientes: `shared_clean_count`, `shared_remaining`, `shared_completed`
- Para recurrentes: `shared_last_cleaned_at`
- NO se ve afectada por acciones PDE
- NO afecta a PDE

### 1.2. PDE (Capa Interna Master)

**Semántica**: "Limpieza en secreto" interna del Master, NO afecta SHARED.

**Características**:
- Estado interno del Master (no visible al alumno)
- Contadores independientes: `pde_clean_count`, `pde_remaining`, `pde_completed`
- Para recurrentes: `pde_last_cleaned_at`
- NO se ve afectada por acciones SHARED
- NO afecta a SHARED

### 1.3. Simetría Obligatoria

**Regla Constitucional**: SHARED y PDE son **simétricas y paralelas**.

- Misma lógica de cálculo
- Mismos campos (solo cambian los prefijos)
- Independencia total: ninguna capa toca los datos de la otra
- Mismo Cleaning Engine: ambas usan el mismo motor, solo cambia `clean_layer`

**Prohibido**:
- ❌ Tocar `shared_*` desde acciones PDE
- ❌ Tocar `pde_*` desde acciones SHARED
- ❌ Inferir estado de una capa desde la otra
- ❌ Reutilizar columnas entre capas

---

## 2. CONTRATO DE DATOS (DTO) DEL FLOTANTE

### 2.1. Estructura Canónica del Payload

**Endpoint**: `GET /master/api/alquimia-general/items/:item_ref/students`

**Estructura de respuesta**:

```json
{
  "ok": true,
  "data": {
    "item_ref": "item-ref-123",
    "item_kind": "una_vez" | "recurrente",
    "required_count": 3,  // Solo para UNA_VEZ
    "clean_layer": "shared",  // Legacy, para compatibilidad
    "students": [
      {
        "student_uuid": "uuid-canónico",
        "student_name": "Nombre del Alumno",
        "student_email": "email@ejemplo.com",
        "apodo": "Apodo",
        "nombre_completo": "Nombre Completo",
        "display_name": "Nombre para mostrar",
        
        // SHARED layer (simétrico)
        "shared": {
          "clean_count": 2,
          "remaining": 1,
          "completed": 0,
          "last_cleaned_at": "2025-01-08T10:30:00Z",  // Solo recurrente
          "days_since_last_clean": 3  // Solo recurrente
        },
        
        // PDE layer (simétrico)
        "pde": {
          "clean_count": 1,
          "remaining": 2,
          "completed": 0,
          "last_cleaned_at": "2025-01-07T15:20:00Z",  // Solo recurrente
          "days_since_last_clean": 4  // Solo recurrente
        },
        
        // Compatibilidad legacy (según clean_layer del request)
        "clean_count": 2,  // De shared o pde según clean_layer
        "remaining": 1,     // De shared o pde según clean_layer
        "completed": 0,    // De shared o pde según clean_layer
        "last_cleaned_at": "2025-01-08T10:30:00Z",  // Solo recurrente
        "days_since_last_clean": 3,  // Solo recurrente
        
        // Estados calculados (para agrupación)
        "state": "pending" | "completed" | "reviewed" | "important" | "never",
        "visual_state": "never" | "in_progress" | "completed" | "excellent"  // Solo UNA_VEZ
      }
    ],
    "counts": {
      // Para RECURRENTE
      "reviewed": 5,
      "pending": 3,
      "important": 2,
      "never": 1
      // O para UNA_VEZ
      "never": 2,
      "in_progress": 3,
      "completed": 4,
      "excellent": 1
    },
    "total": 10,
    "threshold_days": 7,  // Solo RECURRENTE
    "critical_multiplier": 2.0  // Solo RECURRENTE
  },
  "trace_id": "uuid-trace"
}
```

### 2.2. Ejemplo UNA_VEZ

```json
{
  "ok": true,
  "data": {
    "item_ref": "limpieza-energetica-001",
    "item_kind": "una_vez",
    "required_count": 3,
    "students": [
      {
        "student_uuid": "550e8400-e29b-41d4-a716-446655440000",
        "display_name": "Juan Pérez",
        "shared": {
          "clean_count": 2,
          "remaining": 1,
          "completed": 0
        },
        "pde": {
          "clean_count": 1,
          "remaining": 2,
          "completed": 0
        },
        "state": "pending",
        "visual_state": "in_progress"
      }
    ],
    "counts": {
      "never": 0,
      "in_progress": 1,
      "completed": 0,
      "excellent": 0
    },
    "total": 1
  }
}
```

### 2.3. Ejemplo RECURRENTE

```json
{
  "ok": true,
  "data": {
    "item_ref": "meditacion-diaria-001",
    "item_kind": "recurrente",
    "students": [
      {
        "student_uuid": "550e8400-e29b-41d4-a716-446655440000",
        "display_name": "Juan Pérez",
        "shared": {
          "clean_count": 15,
          "last_cleaned_at": "2025-01-05T10:00:00Z",
          "days_since_last_clean": 3
        },
        "pde": {
          "clean_count": 12,
          "last_cleaned_at": "2025-01-04T15:00:00Z",
          "days_since_last_clean": 4
        },
        "state": "reviewed"
      }
    ],
    "counts": {
      "reviewed": 1,
      "pending": 0,
      "important": 0,
      "never": 0
    },
    "total": 1,
    "threshold_days": 7,
    "critical_multiplier": 2.0
  }
}
```

### 2.4. Campos Obligatorios

**Siempre presentes**:
- `item_kind`: `'una_vez'` | `'recurrente'` (OBLIGATORIO)
- `item_ref`: Referencia del item (OBLIGATORIO)
- `shared`: Objeto con datos SHARED (OBLIGATORIO)
- `pde`: Objeto con datos PDE (OBLIGATORIO)

**Condicionales**:
- `required_count`: Solo para `item_kind === 'una_vez'` (OBLIGATORIO en ese caso)
- `threshold_days`: Solo para `item_kind === 'recurrente'`
- `critical_multiplier`: Solo para `item_kind === 'recurrente'`

---

## 3. UI FLOTANTE

### 3.1. Selector de Vista

**Ubicación**: Header del flotante (junto al título del item)

**Opciones**:
- `[SHARED]`: Vista solo SHARED (default)
- `[PDE]`: Vista solo PDE
- `[COMBO]`: Vista combinada (muestra ambas capas)

**Persistencia**: `localStorage` key `ap_master_alquimia_float_layer`

**Comportamiento**:
- Click en botón cambia `state.modal.layerView`
- Re-renderiza SOLO el body del flotante (no recarga datos)
- Mantiene datos ya cargados (los datos vienen simétricos siempre)

### 3.2. Columnas Canónicas (4 siempre)

**Estructura fija**:
1. **Alumno**: Nombre/display_name
2. **Estado**: Depende de la vista seleccionada
3. **Restantes**: Depende de la vista seleccionada
4. **Acciones**: Botones según vista y `item_kind`

### 3.3. Contenido por Vista

#### Vista SHARED

**Estado**:
- UNA_VEZ: `"Nunca" | "En proceso" | "Completado" | "Excelente"`
- RECURRENTE: `"Nunca" | "Revisado" | "Pendiente" | "Importante"`

**Restantes**:
- UNA_VEZ: `remaining` de `shared.remaining`
- RECURRENTE: `"Xd"` (días desde `shared.last_cleaned_at`) o `"Nunca"`

**Acciones**:
- UNA_VEZ: Botón `[+1]` que ejecuta `clean_layer='shared'`
- RECURRENTE: Botón `[✓]` que ejecuta `clean_layer='shared'`

#### Vista PDE

**Estado**:
- UNA_VEZ: `"Nunca" | "En proceso" | "Completado" | "Excelente"` (desde `pde.*`)
- RECURRENTE: `"Nunca" | "Revisado" | "Pendiente" | "Importante"` (desde `pde.*`)

**Restantes**:
- UNA_VEZ: `remaining` de `pde.remaining`
- RECURRENTE: `"Xd"` (días desde `pde.last_cleaned_at`) o `"Nunca"`

**Acciones**:
- UNA_VEZ: Botón `[+1]` que ejecuta `clean_layer='pde'`
- RECURRENTE: Botón `[✓]` que ejecuta `clean_layer='pde'`

#### Vista COMBO

**Estado**:
- Formato: `"S: <estado_shared> | P: <estado_pde>"`
- Ejemplo: `"S: En proceso | P: Completado"`

**Restantes**:
- Formato: `"S:<n> | P:<n>"`
- Ejemplo: `"S:1 | P:0"`

**Acciones**:
- UNA_VEZ: 3 botones `[S +1] [P +1] [S+P]`
- RECURRENTE: 3 botones `[S ✓] [P ✓] [S+P]`
- `S+P` ejecuta ambas acciones secuencialmente:
  1. `clean_layer='shared'`
  2. `clean_layer='pde'` (solo si la primera fue exitosa)

### 3.4. Rehidratación

**Regla**: Rehidratación full reemplazo (no mutación).

**Proceso**:
1. Destruir flotante existente (`overlay.remove()`)
2. Fetch completo del endpoint students
3. Recrear flotante desde cero con datos frescos
4. Restaurar `layerView` desde `state.modal.layerView` o `localStorage`

**Cuándo se rehidrata**:
- Después de cualquier acción de limpieza (individual o global)
- Al cambiar de vista (SHARED ↔ PDE ↔ COMBO) si se requiere recarga
- Al abrir flotante por primera vez

**Mantiene**:
- `layerView` actual (no se pierde al rehidratar)
- Estado del modal (`state.modal.item`, `state.modal.layerView`)

---

## 4. ENDPOINTS AFECTADOS

### 4.1. GET /master/api/alquimia-general/items/:item_ref/students

**Propósito**: Obtener lista de estudiantes para el flotante

**Query params**:
- `clean_layer`: `'shared'` | `'pde'` (legacy, para compatibilidad)
- `product_key`: `'pde'` (default)
- `limit`: Opcional
- `offset`: Opcional

**Respuesta**: Ver sección 2.1 (DTO canónico)

**Headers**:
- `X-AP-FLOAT-DTO: v1_layers` (forensics)
- `Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate`
- `Pragma: no-cache`
- `Expires: 0`

**Logs temporales**:
- `[TEMP_FLOAT_DTO]`: Verifica que llegan `shared` y `pde` en el payload

### 4.2. POST /master/api/alquimia-general/items/:item_ref/master/mark-clean-student

**Propósito**: Limpiar un estudiante individual

**Body obligatorio**:
```json
{
  "student_uuid": "uuid-canónico",
  "item_kind": "una_vez" | "recurrente",
  "clean_layer": "shared" | "pde",
  "actor_type": "master",
  "surface_key": "master.alquimia_general"
}
```

**Validaciones**:
- `student_uuid`: UUID válido (OBLIGATORIO)
- `item_kind`: `'recurrente'` o `'una_vez'` (OBLIGATORIO)
- `clean_layer`: `'shared'` o `'pde'` (OBLIGATORIO, sin default)
- `actor_type`: `'master'` (OBLIGATORIO)
- `surface_key`: `'master.alquimia_general'` (OBLIGATORIO)

**Respuesta**:
```json
{
  "ok": true,
  "state": { /* estado actualizado */ },
  "applied_layer": "shared" | "pde",
  "item_kind": "una_vez" | "recurrente",
  "student": {
    "student_uuid": "uuid",
    "display_name": "Nombre"
  },
  "trace_id": "uuid"
}
```

### 4.3. POST /master/api/alquimia-general/items/:item_ref/master/mark-clean-all

**Propósito**: Limpiar todos los estudiantes (recurrente o una_vez)

**Body obligatorio**:
```json
{
  "item_kind": "una_vez" | "recurrente",
  "clean_layer": "shared" | "pde",
  "execution_mode": "APPLY" | "CERTIFY"  // Opcional, default: APPLY
}
```

**Validaciones**:
- `item_kind`: `'recurrente'` o `'una_vez'` (OBLIGATORIO)
- `clean_layer`: `'shared'` o `'pde'` (OBLIGATORIO, sin default)

**Respuesta**:
```json
{
  "ok": true,
  "updated": 10,
  "skipped": 2,
  "total": 12,
  "applied_layer": "shared" | "pde",
  "item_kind": "una_vez" | "recurrente",
  "skipped_breakdown": {
    "paused": 1,
    "not_applicable_level": 0,
    "already_clean": 1,
    "no_change": 0,
    "error": 0
  },
  "trace_id": "uuid"
}
```

### 4.4. POST /master/api/alquimia-general/items/:item_ref/master/increment-all

**Propósito**: Incrementar +1 todos los estudiantes (solo UNA_VEZ)

**Body obligatorio**:
```json
{
  "item_kind": "una_vez",
  "clean_layer": "shared" | "pde"
}
```

**Validaciones**:
- `item_kind`: Debe ser `'una_vez'` (OBLIGATORIO)
- `clean_layer`: `'shared'` o `'pde'` (OBLIGATORIO, sin default)

**Respuesta**:
```json
{
  "ok": true,
  "updated": 8,
  "skipped": 1,
  "applied_layer": "shared" | "pde",
  "item_kind": "una_vez",
  "trace_id": "uuid"
}
```

### 4.5. POST /master/api/alquimia-general/items/:item_ref/master/mark-pde-clean-all

**Propósito**: Limpieza PDE global (recurrente o una_vez)

**Body obligatorio**:
```json
{
  "item_kind": "una_vez" | "recurrente",
  "execution_mode": "APPLY" | "CERTIFY"  // Opcional
}
```

**Nota**: Este endpoint siempre usa `clean_layer='pde'` (implícito en el nombre del endpoint).

**Validaciones**:
- `item_kind`: `'recurrente'` o `'una_vez'` (OBLIGATORIO)

---

## 5. FORENSICS

### 5.1. SERVER_SENTINEL / BUILD_STAMP

**Cliente JavaScript** (`master-alquimia-general-client.js`):

```javascript
const APP_VERSION = window.__AP_APP_VERSION__ || 'unknown';
const BUILD_ID = window.__AP_BUILD_ID__ || 'unknown';
const BUILD_TIMESTAMP = Date.now();
window.__AP_MASTER_ALQUIMIA_GENERAL_STAMP__ = 
  `MASTER_ALQUIMIA_GENERAL@${APP_VERSION}|BUILD=${BUILD_ID}|STAMP=${BUILD_TIMESTAMP}|FEATURES=float-layers-shared-pde-combo+simetric-dto`;

console.info('[MASTER][ALQ_FLOAT] build', APP_VERSION, BUILD_ID, 'layers: shared/pde/combo enabled');
```

**Verificación**:
- Abrir consola del navegador
- Verificar que aparece `[MASTER][ALQ_FLOAT] build` con versión
- Verificar que `window.__AP_MASTER_ALQUIMIA_GENERAL_STAMP__` existe

### 5.2. Header X-AP-FLOAT-DTO

**Endpoint**: `GET /master/api/alquimia-general/items/:item_ref/students`

**Header**:
```
X-AP-FLOAT-DTO: v1_layers
```

**Propósito**: Indicar que el endpoint devuelve DTO con capas simétricas

**Verificación**:
```bash
curl -i "http://localhost:3000/master/api/alquimia-general/items/ITEM_REF/students?clean_layer=shared" \
  -H "Cookie: auriportal_session=..." | grep X-AP-FLOAT-DTO
```

### 5.3. Logs Temporales

**Logs activos** (eliminar tras validación):

1. **`[TEMP_FLOAT_DTO]`** en `master-api-alquimia-general.js`:
   - Verifica que el payload incluye `shared` y `pde`
   - Muestra keys del primer estudiante
   - Ubicación: Handler GET students

2. **`[TEMP_PDE_SYMM]`** en `cleaning-engine-service.js`:
   - Verifica simetría en proyección
   - Muestra valores antes/después de ambas capas
   - Ubicación: `markCleanStudent` y `markCleanAllStudents`

**Procedimiento de verificación**:
1. Abrir flotante de un item
2. Buscar en logs del servidor: `[TEMP_FLOAT_DTO]`
3. Verificar que `has_shared: true` y `has_pde: true`
4. Verificar que `shared_keys` y `pde_keys` contienen los campos esperados
5. Ejecutar acción de limpieza
6. Buscar en logs: `[TEMP_PDE_SYMM]`
7. Verificar que muestra valores de ambas capas

**Eliminación**:
- Una vez validado el flujo completo, eliminar todos los logs `[TEMP_*]`

---

## 6. CASOS LÍMITE

### 6.1. required_count undefined

**Escenario**: Item `una_vez` sin `veces_limpiar` definido

**Comportamiento**:
- Default: `required_count = 1`
- Cálculo: `remaining = max(1 - clean_count, 0)`
- Log: Warning si `required_count` no viene en el payload

**Código**:
```javascript
const requiredCount = normalized.required_count || normalized.veces_limpiar || item.veces_limpiar || 1;
```

### 6.2. Student sin estado previo

**Escenario**: Estudiante que nunca ha limpiado el item

**Comportamiento**:
- `shared.clean_count = 0`
- `shared.remaining = required_count` (para UNA_VEZ) o `null` (para RECURRENTE)
- `shared.completed = 0`
- `pde.clean_count = 0`
- `pde.remaining = required_count` (para UNA_VEZ) o `null` (para RECURRENTE)
- `pde.completed = 0`

**UI**:
- Estado: `"Nunca"` (gris)
- Restantes: `required_count` (UNA_VEZ) o `"Nunca"` (RECURRENTE)

### 6.3. Combo con acciones secuenciales y fallos parciales

**Escenario**: Vista COMBO, botón `[S+P]`, primera acción (SHARED) exitosa, segunda (PDE) falla

**Comportamiento**:
- **Fail-soft**: Si SHARED falla, no ejecutar PDE
- **Fail-soft**: Si SHARED OK pero PDE falla, mostrar toast explicando qué capa falló
- **Rehidratación**: Siempre rehidratar después de acciones (incluso si hay fallos parciales)

**Código**:
```javascript
btnSP.addEventListener('click', async () => {
  try {
    // Ejecutar SHARED primero
    await handleLimpiarEstudiante(student, item, 'shared', itemKind);
    // Si SHARED OK, ejecutar PDE
    try {
      await handleLimpiarEstudiante(student, item, 'pde', itemKind);
    } catch (pdeError) {
      showToastError(`SHARED OK, pero PDE falló: ${pdeError.message}`);
    }
  } catch (sharedError) {
    showToastError(`SHARED falló: ${sharedError.message}. PDE no ejecutado.`);
  }
});
```

**Toast messages**:
- `"✓ SHARED y PDE aplicados"` (ambas OK)
- `"✓ SHARED aplicado, pero PDE falló: <mensaje>"` (SHARED OK, PDE falla)
- `"❌ SHARED falló: <mensaje>. PDE no ejecutado."` (SHARED falla)

**Rehidratación**:
- Siempre rehidratar después de `[S+P]`, incluso si hay fallos parciales
- El flotante mostrará el estado real después de las acciones exitosas

---

## 7. CHECKLIST CONSTITUCIONAL "HECHO"

### 7.1. Migraciones

- [x] Migración `v5.60.0-pde-symmetric-v1.sql` creada
- [x] Migración aplicada en PostgreSQL
- [x] Columna `pde_remaining` verificada en `cleaning_item_state`
- [x] Comentarios añadidos a columnas

**Verificación**:
```sql
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'cleaning_item_state' 
AND column_name IN ('pde_remaining', 'shared_remaining');
```

### 7.2. Repositorios / Engine

- [x] `cleaning-item-state-repo-pg.js`: Método `upsertApplyOneTimeIncrementPde` simétrico a SHARED
- [x] `master-student-transmutation-read-repo-pg.js`: Query SQL selecciona todas las columnas `shared_*` y `pde_*`
- [x] `cleaning-engine-service.js`: Maneja `clean_layer` correctamente para UNA_VEZ y RECURRENTE
- [x] Logs `[TEMP_PDE_SYMM]` añadidos en puntos clave

**Verificación**:
- Ejecutar limpieza SHARED → verificar que solo `shared_*` cambia
- Ejecutar limpieza PDE → verificar que solo `pde_*` cambia
- Verificar logs `[TEMP_PDE_SYMM]` con valores de ambas capas

### 7.3. API DTO

- [x] Endpoint GET students devuelve estructura simétrica `{ shared: {...}, pde: {...} }`
- [x] Endpoint incluye `item_kind` y `required_count` en payload
- [x] Header `X-AP-FLOAT-DTO: v1_layers` añadido
- [x] Headers anti-cache añadidos
- [x] Log `[TEMP_FLOAT_DTO]` añadido

**Verificación**:
```bash
curl -i "http://localhost:3000/master/api/alquimia-general/items/ITEM_REF/students?clean_layer=shared" \
  -H "Cookie: auriportal_session=..." | jq '.data.students[0] | {shared, pde}'
```

### 7.4. Endpoints de Acción

- [x] `mark-clean-student`: Valida `clean_layer` y `item_kind` (OBLIGATORIOS)
- [x] `mark-clean-all`: Valida `clean_layer` y `item_kind` (OBLIGATORIOS)
- [x] `increment-all`: Valida `clean_layer` y `item_kind` (OBLIGATORIOS)
- [x] Respuestas incluyen `applied_layer` y `item_kind` (forensics)

**Verificación**:
- Intentar llamar sin `clean_layer` → debe devolver 400
- Intentar llamar sin `item_kind` → debe devolver 400
- Verificar que `applied_layer` en respuesta coincide con el enviado

### 7.5. UI Visible

- [x] Selector de vista `[SHARED] [PDE] [COMBO]` visible en header del flotante
- [x] Vista SHARED muestra solo datos `shared.*`
- [x] Vista PDE muestra solo datos `pde.*`
- [x] Vista COMBO muestra ambos `S: <estado> | P: <estado>`
- [x] Acciones correctas según vista (1 botón en SHARED/PDE, 3 botones en COMBO)
- [x] Rehidratación mantiene `layerView` actual
- [x] Persistencia en `localStorage`

**Verificación manual**:
1. Abrir flotante de un item `una_vez`
2. Verificar selector de vista visible
3. Cambiar a PDE → verificar que muestra datos PDE
4. Cambiar a COMBO → verificar que muestra ambos
5. Pulsar `[S+P]` → verificar que ambas acciones se ejecutan
6. Verificar que `layerView` se mantiene tras rehidratación

### 7.6. Documentación

- [x] Documento `MASTER_ALQUIMIA_PDE_LAYERS_V1.md` creado
- [x] Todas las secciones requeridas incluidas
- [x] Ejemplos de payload incluidos
- [x] Casos límite documentados

### 7.7. Commit + Reinicio

- [x] Versión actualizada: `5.70.6`
- [x] Commit realizado con mensaje canónico
- [x] `pm2 restart aurelinportal` ejecutado
- [x] Servidor online (versión 5.70.6)

---

## 8. ARQUITECTURA TÉCNICA

### 8.1. Flujo de Datos

```
1. UI: handleVerItem(item, 'shared')
   ↓
2. Fetch: GET /master/api/alquimia-general/items/:item_ref/students?clean_layer=shared
   ↓
3. Handler: master-api-alquimia-general.js
   ↓
4. Servicio: getStudentsForItem(itemRef, tipo, productKey, { clean_layer })
   ↓
5. Repositorio: getStudentsForItemFromCleaningEngine(itemRef, tipo, cleanLayer, ...)
   ↓
6. SQL: SELECT shared_*, pde_* FROM cleaning_item_state ...
   ↓
7. DTO: Construir { shared: {...}, pde: {...} }
   ↓
8. UI: showFlotanteVer(item, normalized)
   ↓
9. Render: Según layerView (shared/pde/combo)
```

### 8.2. Flujo de Acción

```
1. UI: Botón acción (ej: [P +1])
   ↓
2. handleLimpiarEstudiante(student, item, 'pde', 'una_vez')
   ↓
3. Fetch: POST /master/api/.../mark-clean-student
   Body: { student_uuid, item_kind: 'una_vez', clean_layer: 'pde', ... }
   ↓
4. Handler: Valida clean_layer y item_kind (OBLIGATORIOS)
   ↓
5. Cleaning Engine: markCleanStudent({ clean_layer: 'pde', item_kind: 'una_vez', ... })
   ↓
6. Repositorio: upsertApplyOneTimeIncrementPde({ required_count })
   ↓
7. SQL: UPDATE cleaning_item_state SET pde_clean_count = ..., pde_remaining = ...
   ↓
8. Respuesta: { applied_layer: 'pde', state: {...} }
   ↓
9. UI: Rehidratación completa manteniendo layerView
```

### 8.3. Independencia de Capas

**Garantía**: Cada capa opera SOLO sobre sus columnas.

**SQL Example** (UNA_VEZ PDE):
```sql
UPDATE cleaning_item_state
SET 
  pde_clean_count = pde_clean_count + 1,
  pde_remaining = GREATEST(0, required_count - (pde_clean_count + 1)),
  pde_completed = CASE WHEN GREATEST(0, required_count - (pde_clean_count + 1)) <= 0 THEN 1 ELSE 0 END
WHERE student_id = ? AND item_ref = ?
-- NO toca shared_*
```

**SQL Example** (UNA_VEZ SHARED):
```sql
UPDATE cleaning_item_state
SET 
  shared_clean_count = shared_clean_count + 1,
  shared_remaining = GREATEST(0, required_count - (shared_clean_count + 1)),
  shared_completed = CASE WHEN GREATEST(0, required_count - (shared_clean_count + 1)) <= 0 THEN 1 ELSE 0 END
WHERE student_id = ? AND item_ref = ?
-- NO toca pde_*
```

---

## 9. REGLAS CONSTITUCIONALES

### 9.1. Prohibiciones Absolutas

- ❌ **NUNCA** tocar `shared_*` desde acciones con `clean_layer='pde'`
- ❌ **NUNCA** tocar `pde_*` desde acciones con `clean_layer='shared'`
- ❌ **NUNCA** inferir estado de una capa desde la otra
- ❌ **NUNCA** usar default para `clean_layer` en endpoints de acción
- ❌ **NUNCA** usar default para `item_kind` en endpoints de acción
- ❌ **NUNCA** mutar arrays de estudiantes en UI (solo rehidratación completa)

### 9.2. Obligaciones

- ✅ **SIEMPRE** seleccionar todas las columnas `shared_*` y `pde_*` en el query SQL
- ✅ **SIEMPRE** devolver estructura simétrica `{ shared: {...}, pde: {...} }`
- ✅ **SIEMPRE** validar `clean_layer` y `item_kind` en endpoints de acción
- ✅ **SIEMPRE** rehidratar completamente tras acciones (no mutar)
- ✅ **SIEMPRE** mantener `layerView` tras rehidratación
- ✅ **SIEMPRE** usar DOM API (prohibido innerHTML)

---

## 10. HISTORIAL DE VERSIONES

### v5.70.6 (2025-01-08)

**Cambios**:
- Migración `v5.60.0-pde-symmetric-v1.sql`: Añade `pde_remaining` para simetría completa
- DTO simétrico: Endpoint students devuelve `{ shared: {...}, pde: {...} }` siempre
- UI flotante: Selector de vista (SHARED/PDE/COMBO) con persistencia localStorage
- UI flotante: Columnas Estado/Restantes/Acciones según vista seleccionada
- UI flotante: Acciones COMBO ejecutan shared+pde secuencialmente
- Endpoints: Validación obligatoria de `clean_layer` y `item_kind` (sin defaults)
- Forensics: BUILD_STAMP, header `X-AP-FLOAT-DTO: v1_layers`, logs temporales
- Repositorio: Query SQL selecciona todas las columnas de ambas capas siempre
- Cleaning Engine: Método `upsertApplyOneTimeIncrementPde` simétrico a SHARED

**Archivos modificados**:
- `database/migrations/v5.60.0-pde-symmetric-v1.sql` (nuevo)
- `database/migrations/v5.59.0-cleaning-engine-v1.sql` (comentario)
- `src/infra/repos/cleaning/cleaning-item-state-repo-pg.js`
- `src/infra/repos/master-student-transmutation-read-repo-pg.js`
- `src/core/master/services/cleaning-engine-service.js`
- `src/core/repos/cleaning/cleaning-item-state-repo.js`
- `src/services/alquimia-general-service.js`
- `src/endpoints/master-api-alquimia-general.js`
- `public/js/master/master-alquimia-general-client.js`
- `package.json` (versión 5.70.6)

**Commit**: `104ccde` - "MASTER: flotante alquimia por capas (shared/pde/combo) + DTO simétrico"

---

## REFERENCIAS

- **Cleaning Engine v1**: `docs/ALQUIMIA_CANONICA_V1.md`
- **Execution Mode**: `docs/ALQUIMIA_EXECUTION_MODE_V1.md`
- **UNA_VEZ v1**: `docs/ALQUIMIA_UNA_VEZ_V1.md`
- **Migración**: `database/migrations/v5.60.0-pde-symmetric-v1.sql`
- **Repositorio**: `src/infra/repos/cleaning/cleaning-item-state-repo-pg.js`
- **Cliente UI**: `public/js/master/master-alquimia-general-client.js`

---

**FIN DEL DOCUMENTO**
