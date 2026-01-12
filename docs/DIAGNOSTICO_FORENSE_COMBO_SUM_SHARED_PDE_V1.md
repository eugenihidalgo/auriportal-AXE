# DIAGNÓSTICO FORENSE COMBO SUM SHARED+PDE v1

**Fecha**: 2026-01-12  
**Dominio**: MASTER  
**Sistema**: Alquimia General / Flotante  
**Modo**: SOLO LECTURA / FORENSICS  
**Objetivo**: Detectar por qué COMBO (UNA_VEZ) NO suma SHARED+PDE y por qué acciones PDE parecen "ok" pero no afectan estado real.

---

## CASO CONTROLADO

- **Item**: `te_item_6` (Karmas angélicos)
- **Tipo**: `una_vez`
- **Required Count**: 15 (`veces_limpiar`)
- **Student UUID**: `44a51f8f-4ed5-4291-ad13-5f07a99c636b`
- **Legacy Student ID**: 20
- **Product Key**: `pde`
- **Domain Type**: `transmutation`

---

## FASE 1 — BASELINE DB (ANTES DE TOCAR NADA)

### Estado inicial en `cleaning_item_state`:

```json
{
  "student_id": 20,
  "product_key": "pde",
  "domain_type": "transmutation",
  "item_ref": "te_item_6",
  "shared_clean_count": 0,
  "pde_clean_count": 0,
  "shared_remaining": 15,
  "pde_remaining": 0,
  "shared_completed": 0,
  "pde_completed": 0,
  "shared_last_cleaned_at": null,
  "pde_last_cleaned_at": null,
  "updated_at": "2026-01-12T08:39:33.042Z"
}
```

**Observación**: Estado inicial limpio. `pde_remaining = 0` es correcto (no hay limpiezas PDE previas).

---

## FASE 2 — BASELINE GET (LO QUE EL FLOTANTE CREE)

### GET con `clean_layer=shared`:

```json
{
  "student_uuid": "44a51f8f-4ed5-4291-ad13-5f07a99c636b",
  "display_name": "Eugeni el Magnànim",
  "shared": {
    "clean_count": 0,
    "remaining": 15,
    "completed": 0
  },
  "pde": {
    "clean_count": 0,
    "remaining": 0,
    "completed": 0
  },
  "combo": {
    "clean_count": 0,
    "remaining": 15,
    "completed": 0
  },
  "clean_count": 0,
  "remaining": 15,
  "completed": 0,
  "visual_state": "never",
  "state": "pending"
}
```

### GET con `clean_layer=pde`:

```json
{
  "student_uuid": "44a51f8f-4ed5-4291-ad13-5f07a99c636b",
  "display_name": "Eugeni el Magnànim",
  "shared": {
    "clean_count": 0,
    "remaining": 15,
    "completed": 0
  },
  "pde": {
    "clean_count": 0,
    "remaining": 0,
    "completed": 0
  },
  "combo": {
    "clean_count": 0,
    "remaining": 15,
    "completed": 0
  },
  "clean_count": 0,
  "remaining": 15,
  "completed": 0,
  "visual_state": "never",
  "state": "pending"
}
```

**Observación**: Ambos GET devuelven datos simétricos (shared y pde siempre presentes). COMBO calculado correctamente: `0 + 0 = 0`.

---

## FASE 3 — ACCIÓN CONTROLADA: +1 PDE UNA_VEZ

### Payload enviado:

```json
{
  "student_uuid": "44a51f8f-4ed5-4291-ad13-5f07a99c636b",
  "item_ref": "te_item_6",
  "item_kind": "una_vez",
  "clean_layer": "pde",
  "product_key": "pde",
  "domain_type": "transmutation",
  "actor_type": "master",
  "surface_key": "master.alquimia_general"
}
```

### Respuesta del servicio:

```json
{
  "student_id": 20,
  "product_key": "pde",
  "domain_type": "transmutation",
  "item_ref": "te_item_6",
  "shared_last_cleaned_at": null,
  "pde_last_cleaned_at": null,
  "shared_clean_count": 0,
  "pde_clean_count": 1,
  "shared_completed": 0,
  "shared_remaining": 15,
  "pde_completed": 0,
  "meta": {
    "lista_tipo": "una_vez",
    "veces_limpiar_catalog": 15,
    "frecuencia_dias_catalog": 20
  },
  "created_at": "2026-01-12T08:39:33.042Z",
  "updated_at": "2026-01-12T16:35:42.318Z",
  "pde_remaining": 14
}
```

**Observación**: ✅ Acción PDE ejecutada correctamente. `pde_clean_count` aumentó de 0 a 1. `shared_clean_count` NO cambió (correcto).

### Evento en `cleaning_events`:

```
action_type: mark_clean
clean_layer: pde
item_kind: una_vez
execution_key: certify:te_item_6:44a51f8f-4ed5-4291-ad13-5f07a99c636b:2026-01-12T16-35-42-313Z
delta_completed: 1
set_remaining: null
created_at: 2026-01-12T16:35:42.318Z
```

---

## FASE 4 — VERIFICACIÓN DB (DESPUÉS DE ACCIÓN PDE)

### Estado después de acción PDE:

```json
{
  "student_id": 20,
  "product_key": "pde",
  "domain_type": "transmutation",
  "item_ref": "te_item_6",
  "shared_clean_count": 0,
  "pde_clean_count": 1,
  "shared_remaining": 15,
  "pde_remaining": 14,
  "shared_completed": 0,
  "pde_completed": 0,
  "shared_last_cleaned_at": null,
  "pde_last_cleaned_at": null,
  "updated_at": "2026-01-12T16:35:42.318Z"
}
```

### Comparación BEFORE/AFTER:

| Campo | Antes | Después | Cambio |
|-------|-------|---------|--------|
| `shared_clean_count` | 0 | 0 | ✅ NO cambió (correcto) |
| `pde_clean_count` | 0 | 1 | ✅ AUMENTÓ (correcto) |
| `shared_remaining` | 15 | 15 | ✅ NO cambió (correcto) |
| `pde_remaining` | 0 | 14 | ✅ Recalculado (15 - 1 = 14) |

**Conclusión FASE 4**: ✅ La acción PDE escribió correctamente SOLO en columnas `pde_*`. No hubo contaminación de columnas `shared_*`.

---

## FASE 5 — VERIFICACIÓN GET (DESPUÉS DE ACCIÓN PDE)

### GET con `clean_layer=shared` (después):

```json
{
  "shared": {
    "clean_count": 0,
    "remaining": 15,
    "completed": 0
  },
  "pde": {
    "clean_count": 1,
    "remaining": 14,
    "completed": 0
  },
  "combo": {
    "clean_count": 1,
    "remaining": 14,
    "completed": 0
  }
}
```

### GET con `clean_layer=pde` (después):

```json
{
  "shared": {
    "clean_count": 0,
    "remaining": 15,
    "completed": 0
  },
  "pde": {
    "clean_count": 1,
    "remaining": 14,
    "completed": 0
  },
  "combo": {
    "clean_count": 1,
    "remaining": 14,
    "completed": 0
  }
}
```

**Verificación COMBO**:
- `shared.clean_count`: 0
- `pde.clean_count`: 1
- `combo.clean_count` (backend): 1
- `combo.clean_count` esperado (shared + pde): 0 + 1 = 1
- **¿Coinciden?**: ✅ SÍ

**Conclusión FASE 5**: ✅ El GET refleja correctamente el cambio. COMBO calculado correctamente: `0 + 1 = 1`.

---

## FASE 6 — ACCIÓN CONTROLADA: +1 SHARED UNA_VEZ

### Payload enviado:

```json
{
  "student_uuid": "44a51f8f-4ed5-4291-ad13-5f07a99c636b",
  "item_ref": "te_item_6",
  "item_kind": "una_vez",
  "clean_layer": "shared",
  "product_key": "pde",
  "domain_type": "transmutation",
  "actor_type": "master",
  "surface_key": "master.alquimia_general"
}
```

### Respuesta del servicio:

```json
{
  "shared_clean_count": 1,
  "pde_clean_count": 1,
  "shared_remaining": 14,
  "pde_remaining": 14,
  "shared_completed": 0,
  "pde_completed": 0
}
```

**Observación**: ✅ Acción SHARED ejecutada correctamente. `shared_clean_count` aumentó de 0 a 1. `pde_clean_count` se mantuvo en 1 (correcto).

### Estado final en DB:

```json
{
  "shared_clean_count": 1,
  "pde_clean_count": 1,
  "shared_remaining": 14,
  "pde_remaining": 14,
  "shared_completed": 0,
  "pde_completed": 0
}
```

---

## FASE 7 — VERIFICACIÓN GET FINAL (DESPUÉS DE SHARED+PDE)

### GET después de ambas acciones:

```json
{
  "shared": {
    "clean_count": 1,
    "remaining": 14
  },
  "pde": {
    "clean_count": 1,
    "remaining": 14
  },
  "combo": {
    "clean_count": 2,
    "remaining": 13,
    "completed": 0
  },
  "visual_state": "in_progress",
  "required_count": 15
}
```

**Verificación COMBO**:
- `shared.clean_count`: 1
- `pde.clean_count`: 1
- `combo.clean_count` (backend): 2
- `combo.clean_count` esperado (shared + pde): 1 + 1 = 2
- **¿Coinciden?**: ✅ SÍ

**Verificación remaining**:
- `combo.remaining` (backend): 13
- `combo.remaining` esperado (15 - 2 = 13): 13
- **¿Coinciden?**: ✅ SÍ

**Conclusión FASE 7**: ✅ COMBO suma correctamente SHARED+PDE. El cálculo de `remaining` es correcto.

---

## FASE 8 — AUDITORÍA DE CLAVES

### Claves usadas en escritura (PDE):

- `student_id`: 20 (legacy, resuelto desde UUID)
- `product_key`: `pde`
- `domain_type`: `transmutation`
- `item_ref`: `te_item_6`

### Claves usadas en lectura (GET):

- `student_id`: 20 (legay, resuelto desde UUID)
- `product_key`: `pde`
- `domain_type`: `transmutation`
- `item_ref`: `te_item_6`

**Conclusión FASE 8**: ✅ Las claves coinciden EXACTAMENTE entre escritura y lectura. No hay mismatch de claves.

---

## FASE 9 — AUDITORÍA UI (SOLO LECTURA)

### Código de renderizado COMBO UNA_VEZ:

**Archivo**: `public/js/master/master-alquimia-general-client.js`  
**Líneas**: 1556-1575

```javascript
if (layerView === 'combo' && itemKind === 'una_vez') {
  // COMBO UNA_VEZ: mostrar faltan/excedente según combo_count vs required_count
  const comboCleanCount = student.combo?.clean_count ?? 0;
  const requiredCount = normalized.required_count || normalized.veces_limpiar || 1;
  const sharedRemaining = student.shared?.remaining ?? 0;
  const pdeRemaining = student.pde?.remaining ?? 0;
  
  if (comboCleanCount < requiredCount) {
    // Antes de completar: mostrar faltan
    const faltan = requiredCount - comboCleanCount;
    remainingDiv.textContent = `Faltan: ${faltan} (S:${sharedRemaining} P:${pdeRemaining})`;
  } else {
    // Completado o potenciado: mostrar excedente
    const excedente = comboCleanCount - requiredCount;
    if (excedente > 0) {
      remainingDiv.textContent = `De más: ${excedente} (S:${sharedRemaining} P:${pdeRemaining})`;
    } else {
      remainingDiv.textContent = `Completado (S:${sharedRemaining} P:${pdeRemaining})`;
    }
  }
}
```

**Observación**: ✅ La UI usa `student.combo?.clean_count` (proyección backend). NO calcula en frontend. NO usa campos legacy top-level (`clean_count`, `remaining`) para decisiones visuales.

### Código de cálculo de estado visual:

**Archivo**: `src/services/alquimia-general-service.js`  
**Líneas**: 677-732

```javascript
// PROYECCIÓN COMBO: calcular total (shared + pde) como proyección backend
const sharedCount = sharedData.clean_count !== null && sharedData.clean_count !== undefined ? parseInt(sharedData.clean_count, 10) : 0;
const pdeCount = pdeData.clean_count !== null && pdeData.clean_count !== undefined ? parseInt(pdeData.clean_count, 10) : 0;
const comboCleanCount = sharedCount + pdeCount;

// COMBO remaining: max(veces_limpiar - combo_clean_count, 0)
const comboRemaining = Math.max(0, vecesLimpiar - comboCleanCount);
const comboCompleted = comboRemaining <= 0 ? 1 : 0;

// Calcular estado visual basado en COMBO (proyección backend)
let visualState;
let state;

if (comboCleanCount === 0) {
  visualState = 'never';
  state = 'pending';
} else if (comboCleanCount < vecesLimpiar) {
  visualState = 'in_progress';
  state = 'pending';
} else if (comboCleanCount >= vecesLimpiar && comboCleanCount < (vecesLimpiar * 10)) {
  visualState = 'completed';
  state = 'completed';
} else {
  visualState = 'empowered';
  state = 'completed';
}
```

**Observación**: ✅ El backend calcula COMBO correctamente como `sharedCount + pdeCount`. El estado visual se calcula basado en COMBO (no en shared o pde individualmente).

**Conclusión FASE 9**: ✅ La UI usa correctamente `student.combo?.clean_count` (proyección backend). NO hay cálculos en frontend. NO hay uso de campos legacy para decisiones visuales.

---

## EVALUACIÓN DE HIPÓTESIS

### H1 (WRITE): El botón PDE no está escribiendo realmente en `pde_clean_count`

**Estado**: ❌ **DESCARTADA**

**Evidencia**:
- ✅ `pde_clean_count` aumentó de 0 a 1 después de acción PDE
- ✅ `shared_clean_count` NO cambió (correcto)
- ✅ Evento registrado en `cleaning_events` con `clean_layer='pde'`
- ✅ Query SQL en `upsertApplyOneTimeIncrementPde` actualiza SOLO columnas `pde_*`

**Conclusión**: El botón PDE SÍ escribe correctamente en `pde_clean_count`. No hay bug de mapeo de `clean_layer`.

---

### H2 (READ/DTO): El GET del flotante devuelve COMBO calculado usando solo shared

**Estado**: ❌ **DESCARTADA**

**Evidencia**:
- ✅ GET devuelve `combo.clean_count = 2` después de SHARED+PDE
- ✅ `shared.clean_count = 1`, `pde.clean_count = 1`
- ✅ Cálculo backend: `comboCleanCount = sharedCount + pdeCount` (línea 680 de `alquimia-general-service.js`)
- ✅ Verificación: `2 = 1 + 1` ✅

**Conclusión**: El GET devuelve COMBO calculado correctamente como `shared + pde`. No hay uso de solo shared.

---

### H3 (REFRESH): Tras acción PDE, el refetch está pidiendo `clean_layer` incorrecto

**Estado**: ❌ **DESCARTADA**

**Evidencia**:
- ✅ GET después de acción PDE refleja correctamente el cambio (`pde.clean_count: 0 → 1`)
- ✅ GET devuelve datos simétricos (shared y pde siempre presentes, independientemente de `clean_layer`)
- ✅ Código de refresh en `handleLimpiarEstudiante` llama `handleVerItem(item, state.modal.cleanLayer)` (línea ~1400)

**Conclusión**: El refetch refleja correctamente los cambios. No hay problema de `clean_layer` incorrecto.

---

### H4 (ITEM_KIND mismatch): Se está ejecutando acción con `item_kind` erróneo

**Estado**: ❌ **DESCARTADA**

**Evidencia**:
- ✅ Payload enviado: `item_kind='una_vez'`
- ✅ Item real: `tipo='una_vez'` (confirmado en DB)
- ✅ Lista real: `tipo='una_vez'` (confirmado en DB)
- ✅ No hay errores de validación en logs

**Conclusión**: `item_kind` es correcto. No hay mismatch.

---

### H5 (PRODUCT/DOMAIN mismatch): El write usa claves distintas a las del read

**Estado**: ❌ **DESCARTADA**

**Evidencia**:
- ✅ Escritura: `student_id=20, product_key='pde', domain_type='transmutation', item_ref='te_item_6'`
- ✅ Lectura: `student_id=20, product_key='pde', domain_type='transmutation', item_ref='te_item_6'`
- ✅ Claves coinciden EXACTAMENTE

**Conclusión**: No hay mismatch de claves. La misma fila se lee y escribe.

---

## CONCLUSIÓN GENERAL

### ✅ El sistema funciona correctamente

**Evidencias**:
1. ✅ Acciones PDE escriben correctamente en `pde_clean_count` (no contaminan `shared_*`)
2. ✅ Acciones SHARED escriben correctamente en `shared_clean_count` (no contaminan `pde_*`)
3. ✅ GET devuelve COMBO calculado correctamente como `shared + pde`
4. ✅ UI usa `student.combo?.clean_count` (proyección backend, no cálculo frontend)
5. ✅ Estado visual se calcula basado en COMBO (no en shared o pde individualmente)
6. ✅ Claves de escritura/lectura coinciden exactamente
7. ✅ `item_kind` es correcto en todas las acciones

### ❌ No se encontraron problemas

**Todas las hipótesis fueron descartadas**. El sistema funciona según el diseño canónico:
- COMBO es una **proyección NO persistida** calculada en backend
- COMBO suma correctamente `shared.clean_count + pde.clean_count`
- Las acciones PDE afectan correctamente el estado real
- La UI renderiza correctamente usando datos del backend

---

## OBSERVACIONES ADICIONALES

### 1. Error de señal (no crítico)

**Log**:
```
Error emitiendo señales (fail-open): Cannot find module '/var/www/aurelinportal/src/core/services/pde-signal-emitter.js'
```

**Impacto**: No crítico (fail-open). Las acciones se ejecutan correctamente, pero las señales no se emiten.

**Recomendación**: Corregir path del módulo `pde-signal-emitter.js` o crear el archivo si falta.

---

### 2. Dominio no canónico (warning)

**Log**:
```
⚠️ Dominio no canónico usado: "CleaningEngine". Dominios canónicos: ADMIN, MASTER, CLIENT, ...
```

**Impacto**: No crítico (solo warning). El sistema funciona correctamente.

**Recomendación**: Cambiar dominio a `MASTER` en `cleaning-engine-service.js`.

---

## NEXT FIXES (SOLO TÍTULOS, SIN IMPLEMENTAR)

1. **Fix señal emitter**: Corregir path de `pde-signal-emitter.js` o crear el archivo
2. **Fix dominio canónico**: Cambiar dominio de `CleaningEngine` a `MASTER` en logs
3. **Verificación adicional**: Ejecutar diagnóstico con más casos (diferentes items, diferentes alumnos)

---

## ARCHIVOS REVISADOS

- `src/core/master/services/cleaning-engine-service.js` (motor de limpieza)
- `src/infra/repos/cleaning/cleaning-item-state-repo-pg.js` (repositorio de estado)
- `src/services/alquimia-general-service.js` (servicio de alquimia general)
- `src/infra/repos/master-student-transmutation-read-repo-pg.js` (repositorio de lectura)
- `public/js/master/master-alquimia-general-client.js` (UI frontend)
- `database/pg.js` (conexión PostgreSQL)

---

## MÉTODO DE VERIFICACIÓN

1. ✅ Script de diagnóstico E2E (`scripts/diagnostico-combo-forense.js`)
2. ✅ Consultas SQL directas a `cleaning_item_state`
3. ✅ Consultas SQL directas a `cleaning_events`
4. ✅ Llamadas directas a servicios (`getStudentsForItem`, `markCleanStudent`)
5. ✅ Revisión de código fuente (repositorios, servicios, UI)

---

**FIN DEL DIAGNÓSTICO**
