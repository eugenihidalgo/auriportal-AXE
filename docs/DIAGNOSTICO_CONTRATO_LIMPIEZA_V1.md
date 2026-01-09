# DIAGNÓSTICO CONTRATO LIMPIEZA v1
**AuriPortal / Aurelín — Dominio MASTER**  
**Fecha:** 2026-01-09  
**Objetivo:** Diagnosticar inconsistencias de contrato en limpieza de ítems UNA_VEZ

---

## RESUMEN EJECUTIVO

**Hallazgo Principal:** Existen inconsistencias significativas entre las dos rutas de limpieza:
- **Alquimia Alumno** NO envía `item_kind` (se infiere en backend)
- **Alquimia General** SÍ envía `item_kind` explícitamente
- Ambos endpoints forzan campos (`actor_type`, `surface_key`) pero de forma diferente

**Campos faltantes en payloads:**
- Alquimia Alumno: NO envía `item_kind`, `actor_type`, `surface_key`
- Alquimia General: Envía todos los campos correctamente

**Inferencias legacy vivas:**
- Backend determina `item_kind` desde lista si no viene en options
- Esto funciona pero rompe el principio de "payload explícito"

---

## FASE 1 — MAPA DE SUPERFICIES

### Ruta 1: Alquimia Alumno

**Endpoint:** `POST /master/api/alquimia-alumno/clean`

**Handler Frontend:**
- **Ubicación:** `public/js/master/master-alquimia-alumno-client.js`
- **Función:** `handleCleanItem(item)` (línea 806)

**Handler Backend:**
- **Ubicación:** `src/endpoints/master-api-alquimia-alumno.js`
- **Línea:** 160-293

**Servicio Llamado:**
- `markCleanStudent(options)` desde `cleaning-engine-service.js`

---

### Ruta 2: Alquimia General (Flotante)

**Endpoint:** `POST /master/api/alquimia-general/items/:item_ref/master/mark-clean-student`

**Handler Frontend:**
- **Ubicación:** `public/js/master/master-alquimia-general-client.js`
- **Función:** `handleLimpiarEstudiante(student, item, cleanLayer, tipo)` (línea 1352)

**Handler Backend:**
- **Ubicación:** `src/endpoints/master-api-alquimia-general.js`
- **Línea:** 900-952

**Servicio Llamado:**
- `markCleanStudent(options)` desde `cleaning-engine-service.js`

---

## FASE 2 — CAPTURA DE PAYLOADS

### 2.1 Alquimia Alumno — Frontend

**Función:** `handleCleanItem(item)` (línea 806-886)

**Payload enviado:**
```javascript
{
  student_id: state.selectedStudentId,
  item_ref: item.item_ref,
  domain_type: 'transmutation',
  product_key: 'pde'
  // + level_cap (si state.levelCap !== null)
}
```

**Campos que NO se envían:**
- ❌ `item_kind` (disponible como `item.lista_tipo` pero NO se usa)
- ❌ `actor_type` (se fuerza en backend)
- ❌ `surface_key` (se fuerza en backend)
- ❌ `clean_layer` (se fuerza en backend como 'shared')
- ❌ `actor_ref` (no se envía)

**Nota:** El megalist service SÍ incluye `lista_tipo` en `itemData` (línea 461 de `alquimia-alumno-megalist-service.js`), por lo que `item.lista_tipo` está disponible en el frontend pero no se usa.

**Código:**
```javascript:827:843:public/js/master/master-alquimia-alumno-client.js
const body = {
  student_id: state.selectedStudentId,
  item_ref: item.item_ref,
  domain_type: 'transmutation',
  product_key: 'pde'
};

if (state.levelCap !== null) {
  body.level_cap = state.levelCap === 999 ? 'infinity' : state.levelCap;
}

const response = await fetch('/master/api/alquimia-alumno/clean', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(body)
});
```

---

### 2.2 Alquimia Alumno — Backend

**Endpoint:** `POST /master/api/alquimia-alumno/clean` (línea 160-293)

**Body recibido:**
```javascript
{
  student_id: number,
  item_ref: string,
  domain_type?: 'transmutation' (default),
  product_key?: 'pde' (default),
  level_cap?: number | 'infinity' | '∞',
  actor_ref?: null (opcional),
  surface_key?: null (opcional)
}
```

**Payload construido para `markCleanStudent`:**
```javascript
{
  student_id,
  item_ref,
  clean_layer: 'shared', // ← FORZADO
  product_key,
  domain_type,
  actor_type: 'master', // ← FORZADO
  actor_ref,
  surface_key: surface_key || 'master.alquimia_alumno', // ← FORZADO
  level_cap_override: levelCapOverride // Normalizado
  // ❌ item_kind NO se pasa (se infiere en markCleanStudent)
}
```

**Código:**
```javascript:270:280:src/endpoints/master-api-alquimia-alumno.js
const result = await markCleanStudent({
  student_id,
  item_ref,
  clean_layer: 'shared', // Siempre SHARED en este panel
  product_key,
  domain_type,
  actor_type: 'master',
  actor_ref,
  surface_key: surface_key || 'master.alquimia_alumno',
  level_cap_override: levelCapOverride
});
```

---

### 2.3 Alquimia General — Frontend

**Función:** `handleLimpiarEstudiante(student, item, cleanLayer, tipo)` (línea 1352-1397)

**Payload enviado:**
```javascript
{
  student_id: student.student_id,
  item_ref: item.item_ref,
  item_kind: tipo, // 'recurrente' | 'una_vez' - REQUERIDO ✅
  domain_type: 'transmutation',
  clean_layer: cleanLayer, // 'shared' | 'pde'
  actor_type: 'master', // ✅
  surface_key: 'master.alquimia_general' // ✅
}
```

**Campos enviados correctamente:**
- ✅ `item_kind` (viene del parámetro `tipo`)
- ✅ `actor_type` (hardcodeado 'master')
- ✅ `surface_key` (hardcodeado 'master.alquimia_general')
- ✅ `clean_layer` (viene del parámetro)
- ✅ `domain_type` (hardcodeado 'transmutation')

**Código:**
```javascript:1363:1371:public/js/master/master-alquimia-general-client.js
const payload = {
  student_id: student.student_id,
  item_ref: item.item_ref,
  item_kind: tipo, // 'recurrente' | 'una_vez' - REQUERIDO
  domain_type: 'transmutation',
  clean_layer: cleanLayer,
  actor_type: 'master',
  surface_key: 'master.alquimia_general'
};
```

---

### 2.4 Alquimia General — Backend

**Endpoint:** `POST /master/api/alquimia-general/items/:item_ref/master/mark-clean-student` (línea 900-952)

**Body recibido:**
```javascript
{
  student_id: number,
  item_ref: string, // También viene en URL path
  item_kind?: 'recurrente' | 'una_vez', // ✅ Viene del frontend
  domain_type?: 'transmutation' (default),
  clean_layer?: 'shared' | 'pde' (default: 'shared'),
  actor_type?: 'master' (default),
  actor_ref?: null (opcional),
  surface_key?: 'master.alquimia_general' (default)
}
```

**Payload construido para `markCleanStudent`:**
```javascript
{
  student_id: studentId,
  item_ref: itemRef,
  product_key: productKey,
  domain_type: body.domain_type || 'transmutation',
  clean_layer: cleanLayer,
  actor_type: body.actor_type || 'master', // ← Default si no viene
  actor_ref: body.actor_ref || null,
  surface_key: body.surface_key || 'master.alquimia_general', // ← Default si no viene
  item_kind: body.item_kind || null // ← Si no viene, se determina desde lista
}
```

**Código:**
```javascript:928:940:src/endpoints/master-api-alquimia-general.js
const options = {
  student_id: studentId,
  item_ref: itemRef,
  product_key: productKey,
  domain_type: body.domain_type || 'transmutation',
  clean_layer: cleanLayer,
  actor_type: body.actor_type || 'master',
  actor_ref: body.actor_ref || null,
  surface_key: body.surface_key || 'master.alquimia_general',
  item_kind: body.item_kind || null, // Si viene del frontend, usarlo; si no, se determina desde lista
  meta: body.meta || {}
};
```

---

## FASE 3 — CONTRATO BACKEND

### 3.1 Servicio `markCleanStudent`

**Ubicación:** `src/core/master/services/cleaning-engine-service.js`

**Firma:**
```javascript
export async function markCleanStudent(options = {}, client = null)
```

**Campos requeridos en `options`:**
- ✅ `student_id` (REQUERIDO) - Valida: `if (!student_id || !item_ref || !actor_type) throw Error`
- ✅ `item_ref` (REQUERIDO) - Valida: `if (!student_id || !item_ref || !actor_type) throw Error`
- ✅ `actor_type` (REQUERIDO) - Valida: `if (!student_id || !item_ref || !actor_type) throw Error`

**Campos opcionales con defaults:**
- `clean_layer = 'shared'` (default)
- `product_key = 'pde'` (default)
- `domain_type = 'transmutation'` (default)
- `actor_ref = null` (default)
- `surface_key = null` (default)
- `level_cap_override = null` (default)
- `meta = {}` (default)
- `item_kind = undefined` (NO tiene default, se determina desde lista)

**Dónde se usa `item_kind` / `lista_tipo`:**

1. **Línea 278-279:** Determina `itemKind` desde `options.item_kind` o `lista.tipo`:
   ```javascript
   const itemKind = options.item_kind || lista.tipo; // 'recurrente' o 'una_vez'
   ```

2. **Línea 294:** Se usa en `eventData.item_kind`:
   ```javascript
   item_kind: itemKind, // Usar itemKind (definido arriba)
   ```

3. **Línea 296:** Se usa para determinar `delta_completed`:
   ```javascript
   delta_completed: itemKind === 'una_vez' ? 1 : null,
   ```

4. **Línea 322-342:** Se usa para decidir si aplicar lógica recurrente o una_vez:
   ```javascript
   if (itemKind === 'recurrente') {
     // Recurrente: actualizar last_cleaned_at y clean_count
     state = await stateRepo.upsertApplyRecurrent({...});
   } else {
     // Una vez: incrementar completed y decrementar remaining
     state = await stateRepo.upsertApplyOneTimeIncrementShared({...});
   }
   ```

5. **Línea 363:** Se pasa a `syncToStudentItemState`:
   ```javascript
   item_kind: itemKind, // Usar variable local itemKind (camelCase)
   ```

**¿Qué pasa si `item_kind` NO viene?**
- Se determina desde la lista: `lista.tipo` (línea 279)
- Se consulta la BD para obtener la lista del item (línea 273-276)
- Funciona pero es una inferencia (no explícito)

**Throws explícitos:**
- Línea 194: `throw new Error('student_id, item_ref y actor_type son requeridos')` si faltan campos requeridos
- Línea 214: `throw new Error(\`Item no encontrado: ${item_ref}\`)` si item no existe
- Línea 275: `throw new Error(\`Lista no encontrada para item: ${item_ref}\`)` si lista no existe

**Ramas implícitas:**
- Si `item_kind` no viene en options, se consulta lista desde BD (implícito)
- Si `actor_type === 'master' && surface_key === 'master.alquimia_general'`, bypass de validación de nivel (implícito)
- Si `actor_type === 'master' && surface_key === 'master.alquimia_alumno' && level_cap_override !== null`, override de nivel (implícito)

---

## FASE 4 — MATRIZ DE INCONSISTENCIAS

| UI | Tipo Item | Payload Frontend Enviado | Backend Espera (markCleanStudent) | Backend Construye | Resultado | Inconsistencia |
|----|-----------|-------------------------|----------------------------------|-------------------|-----------|----------------|
| **Alquimia Alumno** | Recurrente | `{student_id, item_ref, domain_type, product_key, level_cap?}` | `{student_id, item_ref, actor_type, ...}` | `{...actor_type: 'master', surface_key: 'master.alquimia_alumno', clean_layer: 'shared'}` | ✅ Funciona (backend fuerza campos) | **ALTA**: Frontend NO envía `item_kind`, `actor_type`, `surface_key` |
| **Alquimia Alumno** | Una_vez | `{student_id, item_ref, domain_type, product_key, level_cap?}` | `{student_id, item_ref, actor_type, ...}` | `{...actor_type: 'master', surface_key: 'master.alquimia_alumno', clean_layer: 'shared'}` | ✅ Funciona (backend infiere `item_kind` desde lista) | **ALTA**: Frontend NO envía `item_kind` (se infiere) |
| **Alquimia General** | Recurrente | `{student_id, item_ref, item_kind: 'recurrente', domain_type, clean_layer, actor_type: 'master', surface_key: 'master.alquimia_general'}` | `{student_id, item_ref, actor_type, ...}` | `{...item_kind: body.item_kind || null}` | ✅ Funciona (frontend envía completo) | **NINGUNA**: Payload completo y explícito |
| **Alquimia General** | Una_vez | `{student_id, item_ref, item_kind: 'una_vez', domain_type, clean_layer, actor_type: 'master', surface_key: 'master.alquimia_general'}` | `{student_id, item_ref, actor_type, ...}` | `{...item_kind: body.item_kind || null}` | ✅ Funciona (frontend envía completo) | **NINGUNA**: Payload completo y explícito |

---

### Inconsistencias Detectadas

#### Inconsistencia #1: Alquimia Alumno NO envía `item_kind`

**Severidad:** ALTA

**Descripción:**
- Frontend SÍ tiene acceso a `item.lista_tipo` en el objeto `item` del megalist (incluido en `itemData` por megalist service)
- Frontend NO lo usa en el payload de limpieza
- Backend infiere `item_kind` consultando la lista desde BD
- Esto funciona pero rompe el principio de "payload explícito"

**Ubicación Frontend:** `public/js/master/master-alquimia-alumno-client.js:827-843`

**Ubicación Backend:** `src/core/master/services/cleaning-engine-service.js:278-279`

**Impacto:**
- Query adicional a BD para obtener lista (ineficiencia)
- Dependencia implícita de que la lista exista
- Si la lista está archivada o no existe, puede fallar

---

#### Inconsistencia #2: Alquimia Alumno NO envía `actor_type` ni `surface_key`

**Severidad:** MEDIA

**Descripción:**
- Frontend no envía estos campos
- Backend los fuerza siempre:
  - `actor_type: 'master'`
  - `surface_key: 'master.alquimia_alumno'`

**Ubicación Backend:** `src/endpoints/master-api-alquimia-alumno.js:270-280`

**Impacto:**
- Funciona correctamente (backend fuerza valores correctos)
- Pero es inconsistente con Alquimia General (que sí los envía)

---

#### Inconsistencia #3: Backend acepta `item_kind` pero tiene fallback implícito

**Severidad:** MEDIA

**Descripción:**
- Backend acepta `item_kind` en options pero no lo requiere
- Si no viene, lo determina desde la lista
- Esto crea dos flujos diferentes:
  1. Explícito: `item_kind` viene en payload → se usa directamente
  2. Implícito: `item_kind` no viene → se consulta lista desde BD

**Ubicación Backend:** `src/core/master/services/cleaning-engine-service.js:278-279`

**Impacto:**
- Funciona en ambos casos
- Pero introduce ambigüedad en el contrato

---

## FASE 5 — CONCLUSIÓN CANÓNICA

### 1. ¿Qué rutas NO cumplen contrato?

**Alquimia Alumno (`/master/api/alquimia-alumno/clean`):**
- ❌ NO envía `item_kind` (se infiere en backend)
- ❌ NO envía `actor_type` (se fuerza en backend)
- ❌ NO envía `surface_key` (se fuerza en backend)
- ✅ Funciona pero viola principio de "payload explícito"

**Alquimia General (`/master/api/alquimia-general/items/:item_ref/master/mark-clean-student`):**
- ✅ Envía todos los campos explícitamente
- ✅ Cumple contrato canónico

---

### 2. ¿Qué campos faltan?

**En Alquimia Alumno:**
- `item_kind`: NO viene del frontend (backend lo infiere)
- `actor_type`: NO viene del frontend (backend lo fuerza)
- `surface_key`: NO viene del frontend (backend lo fuerza)

**En Alquimia General:**
- Todos los campos vienen explícitamente ✅

---

### 3. ¿Qué inferencias legacy siguen vivas?

**Inferencia #1: `item_kind` desde lista**
- **Ubicación:** `cleaning-engine-service.js:278-279`
- **Código:** `const itemKind = options.item_kind || lista.tipo;`
- **Problema:** Si `item_kind` no viene, se consulta BD para obtener lista
- **Impacto:** Query adicional, dependencia implícita

**Inferencia #2: `actor_type` y `surface_key` forzados en endpoint**
- **Ubicación:** `master-api-alquimia-alumno.js:270-280`
- **Problema:** Frontend no los envía, backend los fuerza
- **Impacto:** Inconsistencia entre rutas

**Inferencia #3: `clean_layer` forzado a 'shared'**
- **Ubicación:** `master-api-alquimia-alumno.js:273`
- **Problema:** Frontend no envía, backend fuerza 'shared'
- **Impacto:** Alquimia Alumno siempre usa SHARED (no puede usar PDE)

---

### 4. ¿Qué contrato único debe existir?

**Contrato Canónico Propuesto:**

```typescript
interface CleanItemPayload {
  // REQUERIDOS
  student_id: number;
  item_ref: string;
  item_kind: 'recurrente' | 'una_vez'; // REQUERIDO (no inferir)
  actor_type: 'master' | 'student' | 'automation'; // REQUERIDO (no forzar)
  surface_key: string; // REQUERIDO (no forzar)
  
  // OPCIONALES con defaults
  domain_type?: 'transmutation' (default: 'transmutation');
  product_key?: string (default: 'pde');
  clean_layer?: 'shared' | 'pde' (default: 'shared');
  actor_ref?: string | null (default: null);
  level_cap_override?: number | null (default: null);
  meta?: object (default: {});
}
```

**Principios:**
1. **Payload explícito**: Todos los campos críticos deben venir del frontend
2. **Sin inferencias**: NO consultar BD para determinar `item_kind`
3. **Consistencia entre rutas**: Mismo contrato para todas las rutas de limpieza
4. **Frontend tiene responsabilidad**: Frontend debe conocer `item_kind` y enviarlo

---

### 5. Cambios necesarios (no implementar, solo documentar)

**Para cumplir contrato canónico:**

1. **Alquimia Alumno Frontend:**
   - Usar `item.lista_tipo` que ya viene en el objeto `item` (megalist service ya lo incluye)
   - Enviar `item_kind: item.lista_tipo` en payload
   - Enviar `actor_type: 'master'` explícitamente
   - Enviar `surface_key: 'master.alquimia_alumno'` explícitamente
   - Enviar `clean_layer: 'shared'` explícitamente (o permitir selector)

2. **Backend `markCleanStudent`:**
   - Hacer `item_kind` REQUERIDO (no opcional)
   - Eliminar fallback `options.item_kind || lista.tipo`
   - Lanzar error si `item_kind` no viene

3. **Endpoints:**
   - NO forzar campos que deben venir del frontend
   - Validar que todos los campos requeridos vienen en payload
   - Retornar error 400 si faltan campos requeridos

---

## EVIDENCIA DE CÓDIGO

### Ejemplo 1: Alquimia Alumno Frontend (payload incompleto)

```javascript:827:843:public/js/master/master-alquimia-alumno-client.js
const body = {
  student_id: state.selectedStudentId,
  item_ref: item.item_ref,
  domain_type: 'transmutation',
  product_key: 'pde'
};
// ❌ Falta: item_kind, actor_type, surface_key, clean_layer
```

### Ejemplo 2: Alquimia General Frontend (payload completo)

```javascript:1363:1371:public/js/master/master-alquimia-general-client.js
const payload = {
  student_id: student.student_id,
  item_ref: item.item_ref,
  item_kind: tipo, // ✅ Incluido
  domain_type: 'transmutation',
  clean_layer: cleanLayer, // ✅ Incluido
  actor_type: 'master', // ✅ Incluido
  surface_key: 'master.alquimia_general' // ✅ Incluido
};
```

### Ejemplo 3: Backend Infiere item_kind

```javascript:278:279:src/core/master/services/cleaning-engine-service.js
// Si item_kind viene en options, usarlo; si no, determinarlo desde la lista
const itemKind = options.item_kind || lista.tipo; // ← INFERENCIA
```

### Ejemplo 4: Backend Fuerza Campos (Alquimia Alumno)

```javascript:270:280:src/endpoints/master-api-alquimia-alumno.js
const result = await markCleanStudent({
  student_id,
  item_ref,
  clean_layer: 'shared', // ← FORZADO
  product_key,
  domain_type,
  actor_type: 'master', // ← FORZADO
  actor_ref,
  surface_key: surface_key || 'master.alquimia_alumno', // ← FORZADO
  level_cap_override: levelCapOverride
  // ❌ item_kind NO se pasa
});
```

---

## CONCLUSIÓN FINAL

**Estado Actual:**
- ✅ Ambas rutas funcionan correctamente
- ❌ Contrato inconsistente entre rutas
- ❌ Alquimia Alumno depende de inferencias en backend
- ❌ Alquimia General cumple contrato canónico

**Riesgo:**
- Bajo: Funciona pero es frágil
- Si se elimina la inferencia sin actualizar frontend, Alquimia Alumno dejaría de funcionar
- Si se cambia la estructura de datos (ej: lista archivada), la inferencia puede fallar

**Recomendación:**
- Unificar contrato: ambas rutas deben enviar payload explícito
- Hacer `item_kind` REQUERIDO en backend
- Eliminar inferencias y fuerzas de campos en endpoints

---

**FIN DEL DIAGNÓSTICO**
