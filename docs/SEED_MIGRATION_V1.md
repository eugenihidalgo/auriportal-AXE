# MIGRACIÓN CANÓNICA — CLEANING STATE SEED v1
## Refactor Canónico alineado con SEED_CONTRACT_V1.md

**Fecha:** 2026-01-13  
**Versión:** v1 (Canónico)  
**Objetivo:** Eliminar comportamientos reactivos, implícitos o automáticos, alineando Seed con contrato canónico

---

## RESUMEN EJECUTIVO

### Cambios Realizados

1. **✅ Endpoint explícito de inicialización creado:**
   - `POST /master/api/alquimia-alumno/initialize`
   - Acción WRITE explícita para inicializar estados
   - Requiere `level_cap` obligatorio
   - Soporta `lista_tipo` opcional para filtrar

2. **✅ Guards constitucionales agregados:**
   - Seed REJECTA ejecución sin `allow_structural_seed: true`
   - Seed REJECTA `level_cap = null`
   - Seed elimina fallback a `nivel_efectivo`

3. **✅ Seed eliminado de GET /megalist:**
   - GET es READ puro (no ejecuta WRITE)
   - Megalist construye desde estados existentes
   - Usuario debe inicializar explícitamente si estados faltan

4. **✅ Mejoras estructurales:**
   - Filtro por `lista_tipo` opcional
   - Respeto de `level_cap` incluso si `nivel IS NULL` (usando `COALESCE`)
   - Cálculo de `skipped` corregido (nunca negativo)

5. **✅ Tests obligatorios creados:**
   - Guards constitucionales
   - Idempotencia
   - Validaciones
   - Filtros

---

## QUÉ SE ELIMINÓ

### 1. Seed Automático en GET /megalist

**ANTES (DEPRECATED):**
```javascript
// GET /master/api/alquimia-alumno/megalist
const seedResult = await ensureCleaningItemStateSeedForStudent({
  student_uuid: studentUuid,
  level_cap: levelCap  // Puede ser null
});
const result = await getMegalistForStudent({...});
```

**DESPUÉS (CANÓNICO):**
```javascript
// GET /master/api/alquimia-alumno/megalist
// REGLA CONSTITUCIONAL: GET es READ puro, NO ejecuta Seed automáticamente
const result = await getMegalistForStudent({...});
```

**Razón:** Violaba principio "GET no debe modificar estado". Seed debe ser explícito.

---

### 2. Fallback a nivel_efectivo

**ANTES (DEPRECATED):**
```javascript
if (level_cap === null || level_cap === undefined) {
  nivelCap = await getStudentEffectiveLevel(student_uuid);
}
```

**DESPUÉS (CANÓNICO):**
```javascript
if (level_cap === null || level_cap === undefined) {
  throw new Error('level_cap es requerido (no puede ser null)');
}
```

**Razón:** `level_cap` debe ser observado explícito, no derivado de estado mutable.

---

### 3. Import de getStudentEffectiveLevel

**ANTES (DEPRECATED):**
```javascript
import { getStudentEffectiveLevel } from './cleaning-engine-service.js';
```

**DESPUÉS (CANÓNICO):**
```javascript
// Import eliminado (no se usa más)
```

**Razón:** Seed ya no depende de `nivel_efectivo` mutable.

---

## QUÉ SE AÑADIÓ

### 1. Endpoint POST /master/api/alquimia-alumno/initialize

**NUEVO:**
```javascript
// POST /master/api/alquimia-alumno/initialize
// Body: { student_uuid, level_cap, lista_tipo? }
const seedResult = await ensureCleaningItemStateSeedForStudent({
  student_uuid,
  level_cap,  // OBLIGATORIO
  lista_tipo,  // OPCIONAL
  allow_structural_seed: true
});
```

**Propósito:** Inicialización explícita de estados antes de usar megalist.

**Registro en Master Route Registry:**
```javascript
{
  key: 'master-api-alquimia-alumno-initialize',
  path: '/master/api/alquimia-alumno/initialize',
  type: 'api',
  method: 'POST'
}
```

---

### 2. Guards Constitucionales en Seed

**NUEVO:**
```javascript
// GUARD #1: allow_structural_seed debe ser true
if (allow_structural_seed !== true) {
  throw new Error('Seed solo puede ejecutarse con allow_structural_seed=true');
}

// GUARD #2: level_cap es OBLIGATORIO
if (level_cap === null || level_cap === undefined) {
  throw new Error('level_cap es requerido (no puede ser null)');
}

// GUARD #3: level_cap >= 1
if (isNaN(nivelCap) || nivelCap < 1) {
  throw new Error('level_cap debe ser un número >= 1');
}
```

**Propósito:** Proteger invariantes constitucionales del Seed.

---

### 3. Filtro por lista_tipo (opcional)

**NUEVO:**
```sql
-- Filtrar por lista_tipo si viene
AND ($5::text IS NULL OR l.tipo = $5::text)
```

**Propósito:** Seed más eficiente (solo seedea items necesarios).

**Uso:**
```javascript
await ensureCleaningItemStateSeedForStudent({
  student_uuid,
  level_cap: 10,
  lista_tipo: 'recurrente',  // OPCIONAL
  allow_structural_seed: true
});
```

---

### 4. Respeto de level_cap incluso si nivel IS NULL

**ANTES (PROBLEMÁTICO):**
```sql
AND (i.nivel IS NULL OR i.nivel <= $4::integer)
```

**DESPUÉS (CANÓNICO):**
```sql
AND COALESCE(i.nivel, 0) <= $4::integer
```

**Propósito:** Items sin nivel (nivel IS NULL) se tratan como nivel 0, respetando `level_cap`.

**Nota:** Items sin nivel siempre aplicables si `level_cap >= 1` (comportamiento esperado).

---

### 5. Cálculo de skipped corregido

**ANTES (PROBLEMÁTICO):**
```javascript
const skipped = existing - (total_applicable - inserted);
// skipped puede ser negativo si total_applicable cambia
```

**DESPUÉS (CANÓNICO):**
```javascript
const skipped = Math.max(0, existing - (total_applicable - inserted));
// skipped NUNCA es negativo
```

**Propósito:** Métrica robusta incluso si catálogo cambia entre ejecuciones.

---

### 6. Tests Constitucionales

**NUEVO ARCHIVO:** `tests/seed/seed-constitutional.test.js`

**Tests incluidos:**
1. Guard `allow_structural_seed` (debe ser true)
2. Guard `level_cap` obligatorio (no null)
3. Invariante idempotencia (inserted=0 en segunda ejecución)
4. Invariante no modificación (estados existentes NO cambian)
5. Invariante skipped nunca negativo
6. Filtro por `lista_tipo` (opcional)
7. Validación UUID
8. Validación `level_cap` con infinity/∞

---

## CÓMO INICIALIZAR AHORA

### Opción 1: Endpoint Explícito (Recomendado)

**Frontend llama POST /initialize antes de GET /megalist:**

```javascript
// 1. Inicializar estados
const initResponse = await fetch('/master/api/alquimia-alumno/initialize', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    student_uuid: studentUuid,
    level_cap: levelCap,  // OBLIGATORIO
    lista_tipo: listaTipo  // OPCIONAL
  })
});

// 2. Construir megalist
const megalistResponse = await fetch(`/master/api/alquimia-alumno/megalist?student_uuid=${studentUuid}&view_layer=${viewLayer}&lista_tipo=${listaTipo}`);
```

---

### Opción 2: POST /clean (Condicional)

**POST /clean ejecuta Seed condicionalmente si estado falta:**

```javascript
// POST /master/api/alquimia-alumno/clean
// Si estado NO existe, Seed se ejecuta automáticamente antes de limpiar
const cleanResponse = await fetch('/master/api/alquimia-alumno/clean', {
  method: 'POST',
  body: JSON.stringify({
    student_uuid,
    item_ref,
    level_cap_override: levelCap  // Si null, usa 999 (infinito)
  })
});
```

**Nota:** POST /clean mantiene comportamiento correcto según contrato (permitido antes de mutación crítica).

---

## COMPORTAMIENTOS DEPRECATED

### 1. Seed Automático en GET (DEPRECATED)

**DEPRECATED:**
- ❌ GET /megalist ejecuta Seed automáticamente
- ❌ GET es READ puro, NO debe ejecutar WRITE

**CANÓNICO:**
- ✅ GET /megalist es READ puro (no ejecuta Seed)
- ✅ Usuario debe inicializar explícitamente si estados faltan

---

### 2. level_cap = null (DEPRECATED)

**DEPRECATED:**
- ❌ `level_cap = null` deriva a `nivel_efectivo`
- ❌ Depende de estado mutable

**CANÓNICO:**
- ✅ `level_cap` es OBLIGATORIO (no null)
- ✅ `level_cap` debe ser observado explícito

---

### 3. Seed Masivo sin Filtro (DEPRECATED)

**DEPRECATED:**
- ❌ Seed seedea TODOS los items aplicables
- ❌ No filtra por `lista_tipo`

**CANÓNICO:**
- ✅ Seed puede filtrar por `lista_tipo` si viene
- ✅ Seed más eficiente (solo items necesarios)

---

## MIGRACIÓN DE CÓDIGO EXISTENTE

### Frontend: Llamar initialize antes de megalist

**ANTES (DEPRECATED):**
```javascript
// GET /megalist ejecuta Seed automáticamente
const megalist = await fetch(`/master/api/alquimia-alumno/megalist?student_uuid=${uuid}`);
```

**DESPUÉS (CANÓNICO):**
```javascript
// 1. Inicializar estados (una vez por sesión/alumno)
await fetch('/master/api/alquimia-alumno/initialize', {
  method: 'POST',
  body: JSON.stringify({
    student_uuid: uuid,
    level_cap: levelCap  // OBLIGATORIO
  })
});

// 2. Construir megalist (READ puro)
const megalist = await fetch(`/master/api/alquimia-alumno/megalist?student_uuid=${uuid}`);
```

---

### Backend: Actualizar llamadas a Seed

**ANTES (DEPRECATED):**
```javascript
await ensureCleaningItemStateSeedForStudent({
  student_uuid,
  level_cap: null  // ❌ Null deriva a nivel_efectivo
});
```

**DESPUÉS (CANÓNICO):**
```javascript
await ensureCleaningItemStateSeedForStudent({
  student_uuid,
  level_cap: 10,  // ✅ OBLIGATORIO (no null)
  allow_structural_seed: true,  // ✅ Flag explícito
  lista_tipo: 'recurrente'  // ✅ OPCIONAL
});
```

---

## VERIFICACIÓN POST-MIGRACIÓN

### Checklist Obligatorio

- [ ] ✅ GET /megalist NO ejecuta Seed (verificar logs)
- [ ] ✅ POST /initialize funciona correctamente
- [ ] ✅ POST /clean mantiene Seed condicional
- [ ] ✅ Seed REJECTA sin `allow_structural_seed: true`
- [ ] ✅ Seed REJECTA `level_cap = null`
- [ ] ✅ Tests pasan (npm test)
- [ ] ✅ UX intacta (usuario puede inicializar explícitamente)

---

### Comandos de Verificación

```bash
# 1. Ejecutar tests
npm test -- tests/seed/seed-constitutional.test.js

# 2. Verificar GET /megalist no escribe
curl -i "http://localhost:3000/master/api/alquimia-alumno/megalist?student_uuid=...&view_layer=shared&lista_tipo=recurrente"
# Verificar que NO hay logs de Seed

# 3. Verificar POST /initialize funciona
curl -X POST "http://localhost:3000/master/api/alquimia-alumno/initialize" \
  -H "Content-Type: application/json" \
  -d '{"student_uuid":"...","level_cap":10}'
# Verificar que Seed se ejecuta correctamente

# 4. Verificar POST /clean mantiene Seed condicional
curl -X POST "http://localhost:3000/master/api/alquimia-alumno/clean" \
  -H "Content-Type: application/json" \
  -d '{"student_uuid":"...","item_ref":"...","item_kind":"recurrente"}'
# Verificar que Seed se ejecuta si estado falta
```

---

## IMPACTO EN OTROS SISTEMAS

### Sistemas NO Afectados

1. **Cleaning Engine:** NO afectado (mantiene Seed condicional en POST /clean)
2. **CPM (Cleaning Projection Model):** NO afectado (solo lee estados)
3. **LPM (List Projection Model):** NO afectado (solo lee estados)
4. **Reset:** NO afectado (independiente de Seed)

---

### Sistemas que Deben Actualizar

1. **Frontend (master-alquimia-general-client.js):**
   - Debe llamar POST /initialize antes de GET /megalist
   - O asumir que POST /clean inicializa si es necesario

2. **Pantallas que dependen de megalist:**
   - Deben inicializar explícitamente si estados faltan
   - O mostrar mensaje claro si megalist está incompleta

---

## REFERENCIAS

### Documentos Relacionados

- **Contrato Canónico:** `docs/contracts/SEED_CONTRACT_V1.md`
- **Diagnóstico Técnico:** `docs/DIAGNOSTICO_SEED_MIGRATION_FASE1.md`
- **Tests:** `tests/seed/seed-constitutional.test.js`

### Código Modificado

- `src/core/master/services/cleaning-state-seed-service.js` (guards, mejoras)
- `src/endpoints/master-api-alquimia-alumno.js` (eliminado Seed de GET, agregado POST /initialize)
- `src/core/master/registry/master-route-registry.js` (registrado POST /initialize)
- `src/core/master/router/master-router-resolver.js` (mapeado POST /initialize)

---

## VERSIONADO

**Versión del cambio:** v5.79.1 (PATCH)

**Motivo:** Refactor canónico (no breaking change si se migra frontend correctamente)

**Breaking Changes:**
- ❌ GET /megalist ya NO ejecuta Seed automáticamente
- ⚠️ Frontend debe llamar POST /initialize explícitamente
- ⚠️ Seed requiere `allow_structural_seed: true`
- ⚠️ Seed requiere `level_cap` obligatorio (no null)

---

**FIN DE LA DOCUMENTACIÓN DE MIGRACIÓN**
