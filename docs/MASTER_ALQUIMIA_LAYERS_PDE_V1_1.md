# MASTER ALQUIMIA LAYERS PDE v1.1

**Versión**: v5.70.7  
**Fecha**: 2025-01-08  
**Dominio**: MASTER  
**Estado**: CANÓNICO

---

## 1. INVARIANTES CONSTITUCIONALES

### 1.1. MASTER Nunca Filtra por Nivel

**Regla Absoluta**: En dominio MASTER, las acciones de limpieza NUNCA filtran por nivel.

**Aplicación**:
- `markCleanAll`: Siempre pasa `skip_level_filter: true`
- `markCleanAllStudents`: Respeta `skip_level_filter` (si es `true`, no filtra)
- `markCleanStudent`: Bypass completo si `actor_type === 'master' && surface_key === 'master.alquimia_general'`

**Prohibido**:
- ❌ Filtrar estudiantes por `nivel_efectivo < item.nivel` en MASTER
- ❌ Contar como "omitido" a estudiantes por nivel insuficiente en MASTER
- ❌ Aplicar validación de nivel en `markCleanAll` desde `alquimia-general-service`

**Obligatorio**:
- ✅ `skip_level_filter: true` siempre en MASTER
- ✅ `isMasterSurface = true` implícito en `alquimia-general-service`
- ✅ Logs deben mostrar `skip_level_filter: true` en operaciones MASTER

### 1.2. item_kind y clean_layer Obligatorios

**Regla Absoluta**: `item_kind` y `clean_layer` son OBLIGATORIOS en TODAS las acciones de limpieza.

**Aplicación**:
- Endpoints: Validación explícita (400 si faltan)
- UI: Validación antes de fetch (toast error si faltan)
- Estado: `state.modal.itemKind` se guarda al abrir flotante

**Prohibido**:
- ❌ Defaults silenciosos para `item_kind` o `clean_layer`
- ❌ Inferir `item_kind` desde UI tabs o estado legacy
- ❌ Permitir `undefined` en payloads de acción

**Obligatorio**:
- ✅ Validación explícita en endpoints (devolver 400 si faltan)
- ✅ Validación en UI antes de fetch (toast + return si faltan)
- ✅ Logs temporales `[TEMP_REQ]` para debugging
- ✅ `item_kind` guardado en `state.modal.itemKind` al abrir flotante

**Prioridad de obtención de `item_kind`**:
1. `state.modal.itemKind` (guardado al abrir flotante)
2. `item.item_kind`
3. `item.tipo`
4. `state.listaActiva?.tipo`
5. `'recurrente'` (fallback solo si todo falla)

---

## 2. CONTRATOS DE ENDPOINTS

### 2.1. POST /master/api/alquimia-general/items/:item_ref/master/mark-clean-all

**Propósito**: Limpiar todos los estudiantes (recurrente o una_vez)

**Request Body (OBLIGATORIO)**:
```json
{
  "item_kind": "recurrente" | "una_vez",  // OBLIGATORIO
  "clean_layer": "shared" | "pde",        // OBLIGATORIO
  "execution_mode": "APPLY" | "CERTIFY"   // Opcional, default: "APPLY"
}
```

**Validaciones**:
- `item_kind`: Debe ser `'recurrente'` o `'una_vez'` (400 si falta o inválido)
- `clean_layer`: Debe ser `'shared'` o `'pde'` (400 si falta o inválido)
- `execution_mode`: Debe ser `'APPLY'` o `'CERTIFY'` (400 si inválido)

**Response**:
```json
{
  "ok": true,
  "updated": 10,
  "skipped": 2,
  "skipped_already_clean": 5,  // Separado de omitted
  "total": 12,
  "applied_layer": "shared" | "pde",
  "item_kind": "recurrente" | "una_vez",
  "skipped_breakdown": {
    "paused": 0,
    "not_applicable_level": 0,  // Siempre 0 en MASTER
    "already_clean": 5,
    "missing_item": 0,
    "no_change": 0,
    "error": 0,
    "other": 0
  },
  "trace_id": "uuid"
}
```

**Headers**:
- `X-AP-ALQ-LAYERS: v1.1-itemkind-master-nolevel`
- `X-Trace-Id: uuid`

**Logs Temporales**:
- `[TEMP_LAYER] mark-clean-all`: Log de entrada con `item_kind`, `clean_layer`, `execution_mode`

### 2.2. POST /master/api/alquimia-general/items/:item_ref/master/mark-clean-student

**Propósito**: Limpiar un estudiante individual

**Request Body (OBLIGATORIO)**:
```json
{
  "student_uuid": "uuid-canónico",        // OBLIGATORIO
  "item_kind": "recurrente" | "una_vez",  // OBLIGATORIO
  "clean_layer": "shared" | "pde",        // OBLIGATORIO
  "actor_type": "master",                 // OBLIGATORIO
  "surface_key": "master.alquimia_general", // OBLIGATORIO
  "domain_type": "transmutation",         // Opcional, default: "transmutation"
  "actor_ref": null,                      // Opcional
  "meta": {}                              // Opcional
}
```

**Validaciones**:
- `student_uuid`: UUID válido (400 si falta o inválido)
- `item_kind`: Debe ser `'recurrente'` o `'una_vez'` (400 si falta o inválido)
- `clean_layer`: Debe ser `'shared'` o `'pde'` (400 si falta o inválido)
- `actor_type`: Debe ser `'master'` (400 si falta)
- `surface_key`: Debe ser `'master.alquimia_general'` (400 si falta)

**Response**:
```json
{
  "ok": true,
  "state": {
    "shared_clean_count": 2,
    "shared_remaining": 1,
    "shared_completed": 0,
    "pde_clean_count": 1,
    "pde_remaining": 2,
    "pde_completed": 0
  },
  "applied_layer": "shared" | "pde",
  "item_kind": "recurrente" | "una_vez",
  "student": {
    "student_uuid": "uuid",
    "display_name": "Nombre"
  },
  "trace_id": "uuid"
}
```

**Logs Temporales**:
- `[TEMP_LAYER] mark-clean-student`: Log de entrada con `item_kind`, `clean_layer`, `student_uuid`

### 2.3. POST /master/api/alquimia-general/items/:item_ref/master/increment-all

**Propósito**: Incrementar +1 todos los estudiantes (solo UNA_VEZ)

**Request Body (OBLIGATORIO)**:
```json
{
  "item_kind": "una_vez",           // OBLIGATORIO (debe ser "una_vez")
  "clean_layer": "shared" | "pde"   // OBLIGATORIO
}
```

**Validaciones**:
- `item_kind`: Debe ser `'una_vez'` (400 si falta o no es `'una_vez'`)
- `clean_layer`: Debe ser `'shared'` o `'pde'` (400 si falta o inválido)

**Response**:
```json
{
  "ok": true,
  "updated": 8,
  "skipped": 1,
  "skipped_already_clean": 0,  // No aplica para UNA_VEZ
  "applied_layer": "shared" | "pde",
  "item_kind": "una_vez",
  "trace_id": "uuid"
}
```

**Logs Temporales**:
- `[TEMP_LAYER] increment-all`: Log de entrada con `item_kind`, `clean_layer`

### 2.4. GET /master/api/alquimia-general/items/:item_ref/students

**Propósito**: Obtener lista de estudiantes para el flotante

**Query Params**:
- `clean_layer`: `'shared'` | `'pde'` (legacy, para compatibilidad)
- `product_key`: `'pde'` (default)
- `limit`: Opcional
- `offset`: Opcional

**Response**: Ver `docs/MASTER_ALQUIMIA_PDE_LAYERS_V1.md` sección 2.1 (DTO simétrico)

**Headers**:
- `X-AP-FLOAT-DTO: v1_layers`
- `X-AP-ALQ-LAYERS: v1.1-itemkind-master-nolevel`

---

## 3. UI FLOTANTE POR CAPAS

### 3.1. Selector de Vista (layerView)

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

### 3.2. Vista COMBO: Acciones Secuenciales

**Botón `[S+P]`**:
- **UNA_VEZ**: Ejecuta dos requests secuenciales:
  1. `POST mark-clean-student` con `clean_layer='shared'`
  2. `POST mark-clean-student` con `clean_layer='pde'` (solo si la primera fue exitosa)
- **RECURRENTE**: Ejecuta dos requests secuenciales:
  1. `POST mark-clean-student` con `clean_layer='shared'`
  2. `POST mark-clean-student` con `clean_layer='pde'` (solo si la primera fue exitosa)

**Manejo de Errores**:
- Si SHARED falla → PDE no se ejecuta, toast: `"❌ SHARED falló: <mensaje>. PDE no ejecutado."`
- Si SHARED OK pero PDE falla → toast: `"✓ SHARED aplicado, pero PDE falló: <mensaje>"`
- Si ambas OK → toast: `"✓ SHARED y PDE aplicados"`

**Rehidratación**:
- Siempre rehidratar después de `[S+P]` (incluso si hay fallos parciales)
- Mantener `layerView='combo'` después de rehidratar
- Fetch completo del endpoint students

**Logs Temporales**:
- `[TEMP_COMBO]`: Log de cada paso (`shared`/`pde`) con status (`ok`/`error`)

### 3.3. Rehidratación Total

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
- `itemKind` en `state.modal.itemKind` (no se pierde al rehidratar)

### 3.4. Guardado de item_kind

**Al abrir flotante** (`handleVerItem`):
```javascript
const itemKind = normalized.item_kind || item.item_kind || item.tipo || state.listaActiva?.tipo || 'recurrente';
if (itemKind !== 'recurrente' && itemKind !== 'una_vez') {
  showToastError('Error: tipo de item inválido');
  return;
}
state.modal.itemKind = itemKind; // Guardar para todas las acciones
```

**En acciones**:
```javascript
const itemKind = state.modal?.itemKind || item.item_kind || item.tipo || state.listaActiva?.tipo || 'recurrente';
if (!itemKind || (itemKind !== 'recurrente' && itemKind !== 'una_vez')) {
  showToastError('Error: tipo de item inválido o faltante. Por favor, recarga la página.');
  return;
}
```

---

## 4. RECURRENTE: DEFINICIÓN DE "YA LIMPIO"

### 4.1. Semántica de skipped_already_clean

**Regla**: `skipped_already_clean` NO es "omitido", es "ya estaba limpio hoy".

**Definición**:
- Para **RECURRENTE**: Estudiante ya tiene `last_cleaned_at` del mismo día (mismo año, mes, día)
- Para **UNA_VEZ**: No aplica (siempre se puede incrementar)

**Verificación**:
```javascript
// En markCleanAllStudents, antes de llamar a markCleanStudent:
if (itemKind === 'recurrente') {
  const currentState = await stateRepo.getState({ student_uuid, product_key, domain_type, item_ref });
  if (currentState) {
    const lastCleanedAt = clean_layer === 'shared' 
      ? currentState.shared_last_cleaned_at 
      : currentState.pde_last_cleaned_at;
    
    if (lastCleanedAt) {
      const lastCleanedDate = new Date(lastCleanedAt);
      const today = new Date();
      const isSameDay = lastCleanedDate.getFullYear() === today.getFullYear() &&
                       lastCleanedDate.getMonth() === today.getMonth() &&
                       lastCleanedDate.getDate() === today.getDate();
      
      if (isSameDay) {
        skippedAlreadyClean++; // NO es omitted
        continue; // No llamar a markCleanStudent
      }
    }
  }
}
```

### 4.2. Separación de skipped_already_clean y omitted

**Response Structure**:
```json
{
  "updated": 10,              // Aplicados exitosamente
  "skipped": 2,               // Omitidos (no aplicables, errores, etc.)
  "skipped_already_clean": 5, // Ya estaban limpios hoy (NO es omitted)
  "skipped_breakdown": {
    "paused": 0,
    "not_applicable_level": 0,  // Siempre 0 en MASTER
    "already_clean": 5,         // Mismo que skipped_already_clean
    "missing_item": 0,
    "no_change": 0,
    "error": 0,
    "other": 0
  }
}
```

**UI Toast Messages**:
- `"✅ Item limpiado para 10 alumnos (5 ya estaban limpios hoy)"`
- `"⚠️ 0 actualizados; 2 pausados; 5 ya limpios hoy"`

**Prohibido**:
- ❌ Llamar "omitidos" a los `skipped_already_clean`
- ❌ Contar `skipped_already_clean` en `skipped` total
- ❌ Mostrar `skipped_already_clean` como error

**Obligatorio**:
- ✅ Mostrar `skipped_already_clean` por separado en toasts
- ✅ Incluir `skipped_already_clean` en response
- ✅ Logs deben diferenciar `skipped_already_clean` de `omitted`

---

## 5. CHECKLIST DE VERIFICACIÓN

### 5.1. Verificación Manual Obligatoria

**1. Recurrente**:
- [ ] Abrir flotante → layerView PDE → ✓ → debe cambiar `pde_last_cleaned_at` y NO tocar `shared`
- [ ] Limpiar todo PDE → `applied_count > 0` o `skipped_already_clean > 0`, `omitted 0` (por nivel)
- [ ] Verificar que `skipped_already_clean` se muestra por separado en toast

**2. UNA_VEZ**:
- [ ] Vista PDE → +1 dos veces → `pde_clean_count` sube y `pde_remaining` baja
- [ ] Vista SHARED → +1 → `shared` cambia, `pde` no
- [ ] COMBO S+P → ambos suben (dos requests secuenciales)
- [ ] Verificar que `item_kind` está presente en todos los requests

**3. COMBO**:
- [ ] Botón `[S+P]` ejecuta dos requests secuenciales
- [ ] Si SHARED falla, PDE no se ejecuta
- [ ] Si SHARED OK pero PDE falla, toast explica qué capa falló
- [ ] Rehidratación mantiene `layerView='combo'`

**4. MASTER No Filtra por Nivel**:
- [ ] Limpiar todo en MASTER → `not_applicable_level: 0` en breakdown
- [ ] Logs muestran `skip_level_filter: true`
- [ ] Estudiantes con nivel bajo pueden limpiarse

**5. Logs**:
```bash
pm2 logs aurelinportal | grep TEMP_LAYER
```
- [ ] Debe verse `item_kind` y `clean_layer` correctos
- [ ] Debe verse `skip_level_filter: true` en operaciones MASTER
- [ ] Debe verse `skipped_already_clean` separado de `omitted`

### 5.2. Forensics Headers

**Endpoints que devuelven headers forenses**:
- `GET /master/api/alquimia-general/items/:item_ref/students`:
  - `X-AP-FLOAT-DTO: v1_layers`
  - `X-AP-ALQ-LAYERS: v1.1-itemkind-master-nolevel`
- `POST /master/api/alquimia-general/items/:item_ref/master/*`:
  - `X-AP-ALQ-LAYERS: v1.1-itemkind-master-nolevel`
  - `X-Trace-Id: uuid`

**Verificación**:
```bash
curl -i "http://localhost:3000/master/api/alquimia-general/items/ITEM_REF/students?clean_layer=shared" \
  -H "Cookie: auriportal_session=..." | grep X-AP-ALQ-LAYERS
```

### 5.3. Logs Temporales (Eliminar Después de Validar)

**Logs activos**:
- `[TEMP_LAYER]`: En endpoints de acción (mark-clean-all, mark-clean-student, increment-all)
- `[TEMP_LAYER_ENGINE]`: En cleaning engine (markCleanAllStudents)
- `[TEMP_COMBO]`: En acciones COMBO (S+P)
- `[TEMP_REQ]`: En UI antes de fetch (solo en modo debug)

**Procedimiento de eliminación**:
1. Validar que todos los logs muestran valores correctos
2. Buscar todos los `[TEMP_*]` en el código
3. Eliminar logs temporales (mantener logs estructurados permanentes)
4. Commit con mensaje: "cleanup: eliminar logs temporales [TEMP_*]"

---

## 6. ARQUITECTURA TÉCNICA

### 6.1. Flujo de Acción con item_kind

```
1. UI: handleLimpiarEstudiante(student, item, 'pde', itemKind)
   ↓
2. Validar itemKind: state.modal.itemKind || item.item_kind || ...
   ↓
3. Si falta → toast error + return
   ↓
4. Fetch: POST /master/api/.../mark-clean-student
   Body: { student_uuid, item_kind, clean_layer, actor_type, surface_key, ... }
   ↓
5. Endpoint: Validar item_kind (400 si falta)
   ↓
6. Cleaning Engine: markCleanStudent({ item_kind, clean_layer, ... })
   ↓
7. Repositorio: Operar sobre shared_* o pde_* según clean_layer
   ↓
8. Respuesta: { applied_layer, item_kind, state: {...} }
   ↓
9. UI: Rehidratación completa manteniendo layerView
```

### 6.2. Flujo de No Filtro por Nivel

```
1. UI: handleLimpiarItem(item) → POST mark-clean-all
   ↓
2. alquimia-general-service: markCleanAll(...)
   ↓
3. Siempre pasa: skip_level_filter: true
   ↓
4. cleaning-engine-service: markCleanAllStudents({ skip_level_filter: true, ... })
   ↓
5. Verificación nivel: if (!skip_level_filter && itemKind === 'recurrente') { ... }
   ↓
6. Como skip_level_filter=true → NO filtra por nivel
   ↓
7. Todos los estudiantes activos (no pausados) se procesan
   ↓
8. Response: not_applicable_level: 0 (siempre en MASTER)
```

### 6.3. Flujo de skipped_already_clean

```
1. markCleanAllStudents: Para cada estudiante activo
   ↓
2. Si itemKind === 'recurrente':
   ↓
3. Verificar estado actual: getState({ student_uuid, item_ref })
   ↓
4. Obtener last_cleaned_at según clean_layer (shared_* o pde_*)
   ↓
5. Comparar fecha: ¿mismo día que hoy?
   ↓
6. Si mismo día:
   - skippedAlreadyClean++
   - skippedBreakdown.already_clean++
   - continue (NO llamar a markCleanStudent)
   ↓
7. Si no mismo día:
   - Llamar a markCleanStudent normalmente
   ↓
8. Response: { updated, skipped, skipped_already_clean, ... }
```

---

## 7. REGLAS CONSTITUCIONALES

### 7.1. Prohibiciones Absolutas

- ❌ **NUNCA** filtrar por nivel en MASTER (skip_level_filter siempre true)
- ❌ **NUNCA** permitir `item_kind` o `clean_layer` undefined en acciones
- ❌ **NUNCA** llamar "omitidos" a los `skipped_already_clean`
- ❌ **NUNCA** ejecutar PDE si SHARED falla en COMBO
- ❌ **NUNCA** mutar arrays de estudiantes en UI (solo rehidratación completa)

### 7.2. Obligaciones

- ✅ **SIEMPRE** validar `item_kind` y `clean_layer` en endpoints (400 si faltan)
- ✅ **SIEMPRE** validar `item_kind` en UI antes de fetch (toast + return si falta)
- ✅ **SIEMPRE** pasar `skip_level_filter: true` en MASTER
- ✅ **SIEMPRE** separar `skipped_already_clean` de `omitted` en responses
- ✅ **SIEMPRE** rehidratar completamente tras acciones (no mutar)
- ✅ **SIEMPRE** mantener `layerView` tras rehidratación
- ✅ **SIEMPRE** usar DOM API (prohibido innerHTML)

---

## 8. HISTORIAL DE VERSIONES

### v5.70.7 (2025-01-08) - master-alquimia-pde-itemkind-master-nolevel-fix

**Cambios**:
- **FASE 2**: `item_kind` siempre presente en UI (guardado en `state.modal.itemKind`, validación antes de fetch)
- **FASE 3**: Eliminado filtro por nivel en MASTER (`skip_level_filter: true` siempre)
- **FASE 4**: Separado `skipped_already_clean` de `omitted` en respuestas recurrentes
- **FASE 5**: COMBO aplica SHARED+PDE realmente (dos requests secuenciales con manejo de errores)
- **FASE 6**: Botón PDE global cambia `layerView` a 'pde' y rehidrata correctamente
- **FASE 7**: Forensics añadidos (logs temporales `[TEMP_LAYER]`, `[TEMP_COMBO]`, header `X-AP-ALQ-LAYERS`)

**Archivos modificados**:
- `public/js/master/master-alquimia-general-client.js` - UI fixes (item_kind, COMBO, toasts)
- `src/core/master/services/cleaning-engine-service.js` - skip_level_filter, skipped_already_clean
- `src/services/alquimia-general-service.js` - skip_level_filter en markCleanAll
- `src/endpoints/master-api-alquimia-general.js` - validaciones, logs temporales, header
- `package.json` - versión 5.70.7

**Commit**: `64a2a22` - "MASTER: fix item_kind + no level filter + combo shared+pde real + recurrente skipped"

**Problemas resueltos**:
- ✅ Error "item_kind requerido" eliminado
- ✅ "PDE por capas" funciona correctamente
- ✅ COMBO aplica SHARED+PDE realmente (no solo visual)
- ✅ "Ya limpio" no se cuenta como "omitido"
- ✅ MASTER no filtra por nivel (puede limpiar cualquier item)

---

## REFERENCIAS

- **PDE Layers v1**: `docs/MASTER_ALQUIMIA_PDE_LAYERS_V1.md` (versión base)
- **Cleaning Engine v1**: `docs/ALQUIMIA_CANONICA_V1.md`
- **Execution Mode**: `docs/ALQUIMIA_EXECUTION_MODE_V1.md`
- **UNA_VEZ v1**: `docs/ALQUIMIA_UNA_VEZ_V1.md`
- **Repositorio**: `src/infra/repos/cleaning/cleaning-item-state-repo-pg.js`
- **Cliente UI**: `public/js/master/master-alquimia-general-client.js`
- **Cleaning Engine**: `src/core/master/services/cleaning-engine-service.js`

---

**FIN DEL DOCUMENTO**
