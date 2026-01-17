# DIAGNÓSTICO TÉCNICO FINAL — CLEANING STATE SEED
## Análisis Completo Antes de Refactor Canónico

**Fecha:** 2026-01-13  
**Objetivo:** Inventario total de ejecuciones del Seed y análisis de dependencias antes de refactor canónico  
**Estado:** Diagnóstico (NO implementación)

---

## FASE 0 — INVENTARIO TOTAL

### Ejecuciones del Seed Localizadas

#### Ejecución #1: GET /master/api/alquimia-alumno/megalist

**Archivo:** `src/endpoints/master-api-alquimia-alumno.js:178`

**Línea exacta:** 178

**Tipo de invocación:** GET (lectura)

**Contexto de invocación:**
```javascript
// GET /master/api/alquimia-alumno/megalist
// Parámetros: student_uuid, view_layer, lista_tipo, level_cap (opcional)
const seedResult = await ensureCleaningItemStateSeedForStudent({
  student_uuid: studentUuid,
  product_key: 'pde',
  domain_type: 'transmutation',
  level_cap: levelCap  // Puede ser null o valor explícito
});
```

**Propósito aparente:**
- Asegurar que todos los items aplicables tengan estado materializado antes de construir megalist
- Comentario en código: "CRÍTICO: Seed estados 'NUNCA' antes de construir megalista"

**Parámetros recibidos:**
- `student_uuid`: UUID canónico (desde query params, OBLIGATORIO)
- `level_cap`: number | null (desde query params, opcional)
  - Si `null`: Seed usa `nivel_efectivo` del estudiante (default)
  - Si viene explícito: Seed usa ese valor
- `product_key`: 'pde' (hardcodeado)
- `domain_type`: 'transmutation' (hardcodeado)

**Cuándo se ejecuta:**
- SIEMPRE que se llama GET /megalist
- ANTES de llamar `getMegalistForStudent()`
- No hay opción para saltarlo
- No hay guard que evite ejecución

**Problema detectado:**
- ⚠️ Seed se ejecuta AUTOMÁTICAMENTE en GET (operación de lectura)
- ⚠️ NO es compatible con SEED_CONTRACT_V1.md (prohibido en GET genérico sin flag)

---

#### Ejecución #2: POST /master/api/alquimia-alumno/clean

**Archivo:** `src/endpoints/master-api-alquimia-alumno.js:311`

**Línea exacta:** 311

**Tipo de invocación:** POST (escritura)

**Contexto de invocación:**
```javascript
// POST /master/api/alquimia-alumno/clean
// Parámetros: student_uuid, item_ref, level_cap_override (opcional)

// Verificar que el estado existe
const stateCheck = await query(`
  SELECT 1 
  FROM cleaning_item_state
  WHERE student_id = $1 AND product_key = $2 AND domain_type = $3 AND item_ref = $4
`, [student_uuid, product_key, domain_type, item_ref]);

if (!stateCheck.rows || stateCheck.rows.length === 0) {
  // Si no existe, intentar seed primero (puede ser item nuevo)
  await ensureCleaningItemStateSeedForStudent({
    student_uuid: student_uuid,
    product_key,
    domain_type,
    level_cap: levelCapOverride  // Puede ser null
  });
  
  // Verificar de nuevo
  const stateCheck2 = await query(...);
  if (!stateCheck2.rows || stateCheck2.rows.length === 0) {
    return jsonError('Estado no encontrado...', 'STATE_NOT_FOUND', 400);
  }
}
```

**Propósito aparente:**
- Asegurar que el estado existe antes de intentar limpiar
- Evitar error 400 si el item es nuevo y no tiene estado

**Parámetros recibidos:**
- `student_uuid`: UUID canónico (desde body, OBLIGATORIO)
- `level_cap_override`: number | null (desde body, opcional)
  - Si `null`: Seed usa `nivel_efectivo` del estudiante (default)
  - Si viene explícito: Seed usa ese valor
- `product_key`: 'pde' (hardcodeado)
- `domain_type`: 'transmutation' (hardcodeado)

**Cuándo se ejecuta:**
- Solo si estado NO existe para el `item_ref` específico
- ANTES de intentar limpiar (validación preventiva)
- Condicional (no siempre se ejecuta)

**Problema detectado:**
- ⚠️ Seed se ejecuta CONDICIONALMENTE en POST (correcto según contrato)
- ✅ Es compatible con SEED_CONTRACT_V1.md (permitido antes de mutación crítica)

---

### Resumen de Ejecuciones

**Total de ejecuciones encontradas:** 2

**Desglose:**
- GET requests: 1 ejecución (automática, siempre)
- POST requests: 1 ejecución (condicional, solo si estado falta)
- Ejecuciones internas: 0
- Helpers que disparan seed: 0

**Llamadas directas:**
- ✅ Todas las ejecuciones son llamadas directas a `ensureCleaningItemStateSeedForStudent()`
- ✅ No hay wrappers ni helpers intermedios

---

## FASE 1 — CONTEXTO DE EJECUCIÓN

### Ejecución #1: GET /master/api/alquimia-alumno/megalist

**Endpoint:** `GET /master/api/alquimia-alumno/megalist`

**Handler:** `src/endpoints/master-api-alquimia-alumno.js:70-206`

**Fase del request:**
1. Validar parámetros (student_uuid, view_layer, lista_tipo)
2. Normalizar level_cap (infinity/∞ → 999)
3. **EJECUTAR SEED** (línea 178) ← AQUÍ
4. Construir megalist (línea 197)
5. Retornar JSON

**Tipo de operación:** READ (lectura de megalist)

**Dentro de transacción:** NO (seed ejecuta query independiente)

**Transacción compartida:** NO (no hay `client` pasado)

**Orden relativo:**
- Seed se ejecuta ANTES de leer estados
- Seed se ejecuta ANTES de construir megalist
- Seed se ejecuta SIEMPRE (no hay guard)

**⚠️ PROBLEMA:**
- Seed ejecuta WRITE en contexto de GET (operación de lectura)
- Viola principio "GET no debe modificar estado"
- No hay guard que evite ejecución automática

---

### Ejecución #2: POST /master/api/alquimia-alumno/clean

**Endpoint:** `POST /master/api/alquimia-alumno/clean`

**Handler:** `src/endpoints/master-api-alquimia-alumno.js:208-360`

**Fase del request:**
1. Validar parámetros (student_uuid, item_ref, item_kind, clean_layer, etc.)
2. Validar level_cap_override (si viene)
3. Verificar si estado existe (línea 299-306)
4. **SI NO EXISTE → EJECUTAR SEED** (línea 311) ← AQUÍ
5. Verificar de nuevo si estado existe (línea 319-326)
6. Si sigue sin existir → Error 400
7. Ejecutar limpieza (línea 340)
8. Retornar JSON

**Tipo de operación:** WRITE (escritura de limpieza)

**Dentro de transacción:** NO (seed ejecuta query independiente)

**Transacción compartida:** NO (no hay `client` pasado)

**Orden relativo:**
- Seed se ejecuta CONDICIONALMENTE (solo si estado falta)
- Seed se ejecuta ANTES de intentar limpiar
- Seed se ejecuta dentro de validación preventiva

**✅ CORRECTO:**
- Seed se ejecuta ANTES de mutación crítica (compatible con contrato)
- Seed es condicional (solo si es necesario)
- Seed no bloquea si ya existe (idempotente)

---

## FASE 2 — DEPENDENCIAS DE DATOS

### Datos que usa el Seed para decidir qué insertar

#### 1. level_cap (OBSERVADO o DERIVADO)

**Origen:**
- `level_cap` puede venir explícito (desde query params o body)
- Si `null`: Seed deriva `nivel_efectivo` del estudiante (línea 54)

**Código real:**
```javascript
if (level_cap !== null && level_cap !== undefined) {
  nivelCap = parseInt(level_cap, 10);
  if (isNaN(nivelCap) || nivelCap < 1) {
    nivelCap = 999; // Fallback
  }
} else {
  // ⚠️ PROBLEMA: Usar nivel efectivo como default
  nivelCap = await getStudentEffectiveLevel(student_uuid);
}
```

**Uso en SQL:**
```sql
WHERE (i.nivel IS NULL OR i.nivel <= $4::integer)
```

**Tipo de dependencia:**
- **ESTRUCTURAL:** Si `level_cap` viene explícito (observado en el momento)
- **MUTABLE (PROBLEMÁTICO):** Si `level_cap = null` y se deriva `nivel_efectivo`

**Problemas:**
1. **level_cap puede cambiar entre ejecuciones:**
   - Primera ejecución: `level_cap = 5` → seedea items nivel 1-5
   - Segunda ejecución: `level_cap = 10` → NO seedea items nivel 6-10 (conflict idempotente)
   - **Resultado:** Items nivel 6-10 quedan sin seed

2. **nivel_efectivo puede cambiar:**
   - Si `nivel_efectivo` sube de 5 a 10, seed NO se re-ejecuta automáticamente
   - Items nivel 6-10 quedan sin seed hasta ejecución explícita

---

#### 2. Catálogo Completo vs Parcial

**Origen:**
- Seed lee desde `items_transmutaciones` (catálogo completo)
- Seed lee desde `listas_transmutaciones` (catálogo completo)

**Código real:**
```sql
FROM items_transmutaciones i
JOIN listas_transmutaciones l ON l.id = i.lista_id
WHERE (i.status = 'active' OR i.activo = true)
  AND (l.status = 'active' OR l.activo = true)
  AND i.item_ref IS NOT NULL
  AND (i.nivel IS NULL OR i.nivel <= $4::integer)
```

**Filtros aplicados:**
- Items activos (status='active' OR activo=true)
- Listas activas (status='active' OR activo=true)
- Items con item_ref no null
- Items con nivel <= level_cap (o nivel IS NULL)

**Tipo de dependencia:**
- **ESTRUCTURAL:** Filtros por status (items/listas activos)
- **MUTABLE (PROBLEMÁTICO):** Filtro por nivel (depende de level_cap mutable)

**Problemas:**
1. **Items sin nivel siempre aplicables:**
   - Items con `nivel IS NULL` SIEMPRE se seedean (incluso si `level_cap = 1`)
   - **Resultado:** Seed innecesario de items no aplicables

2. **Seed seedea TODOS los items aplicables:**
   - GET /megalist seedea TODOS los items aplicables (no solo los mostrados)
   - No filtra por `lista_tipo` solicitada
   - **Resultado:** Seed masivo aunque megalist solo muestre una lista_tipo

---

#### 3. Estados Existentes

**Origen:**
- Seed verifica estados existentes en `cleaning_item_state`

**Código real:**
```sql
AND NOT EXISTS (
  SELECT 1 
  FROM cleaning_item_state s
  WHERE s.student_id = $1::uuid
    AND s.product_key = $2::text
    AND s.domain_type = $3::text
    AND s.item_ref = i.item_ref
)
ON CONFLICT (student_id, product_key, domain_type, item_ref) DO NOTHING
```

**Tipo de dependencia:**
- **ESTRUCTURAL:** Verificación de existencia (idempotencia)

**✅ CORRECTO:**
- Seed solo inserta estados faltantes
- Idempotencia estricta garantizada

---

#### 4. lista_tipo (NO se filtra)

**Origen:**
- Seed NO recibe `lista_tipo` como parámetro
- Seed seedea items de TODAS las listas (recurrente + una_vez)

**Código real:**
```sql
FROM items_transmutaciones i
JOIN listas_transmutaciones l ON l.id = i.lista_id
-- NO hay filtro WHERE l.tipo = ?
```

**Tipo de dependencia:**
- **ESTRUCTURAL (pero incompleto):** Seed debería filtrar por lista_tipo si viene

**Problemas:**
1. **Seed seedea items no mostrados:**
   - GET /megalist con `lista_tipo='recurrente'` seedea TAMBIÉN items `una_vez`
   - **Resultado:** Seed innecesario de items no mostrados en megalist

---

### Resumen de Dependencias

**Dependencias ESTRUCTURALES (permitidas):**
- ✅ Filtro por status (items/listas activos)
- ✅ Verificación de existencia (idempotencia)
- ✅ Items con item_ref no null

**Dependencias MUTABLES (problemáticas):**
- ❌ `level_cap` puede cambiar entre ejecuciones
- ❌ `nivel_efectivo` puede cambiar (si `level_cap = null`)
- ❌ Items sin nivel siempre aplicables (no respeta level_cap)
- ❌ No filtra por `lista_tipo` (seedea items no mostrados)

---

## FASE 3 — DEPENDENCIAS FUNCIONALES

### Servicios que Asumen que Estado Existe

#### 1. Alquimia Alumno Megalist Service

**Archivo:** `src/core/master/services/alquimia-alumno-megalist-service.js:103`

**Código real:**
```javascript
// Leer estados desde cleaning_item_state
const statesResult = await query(`
  SELECT s.*, i.nivel as item_nivel
  FROM cleaning_item_state s
  LEFT JOIN items_transmutaciones i ON i.item_ref = s.item_ref
  WHERE s.student_id = $1
    AND s.product_key = 'pde'
    AND s.domain_type = 'transmutation'
    AND (i.nivel IS NULL OR i.nivel <= $2::integer)
`, [student_uuid, nivelCap]);
```

**Asunción implícita:**
- Megalist lee desde `cleaning_item_state`
- Si estado NO existe, item NO aparece en megalist
- **NO falla:** Simplemente no muestra el item (fail-silent)

**¿Qué fallaría si Seed NO se ejecuta en GET?**
- ❌ Items nuevos NO aparecerían en megalist (hasta que se ejecute POST /clean)
- ❌ Megalist podría estar incompleta (sin items sin estado)
- ⚠️ **Impacto:** Usuario no ve items aplicables hasta que se ejecute POST /clean

**Dependencia:**
- ⚠️ Megalist DEPENDE indirectamente del Seed en GET
- Sin Seed en GET, megalist estaría incompleta
- Seed en GET actúa como "inicialización silenciosa"

---

#### 2. List Projection Model

**Archivo:** `src/core/master/services/list-projection-model.js:682`

**Código real (scope='student'):**
```javascript
// Leer estados desde cleaning_item_state
const result = await query(`
  SELECT 
    cis.*
  FROM cleaning_item_state cis
  WHERE cis.student_id = $1
    AND cis.product_key = 'pde'
    AND cis.domain_type = 'transmutation'
    AND cis.item_ref = ANY($2::text[])
`, [studentId, itemRefs]);
```

**Código real (scope='all'):**
```javascript
// CROSS JOIN + LEFT JOIN para traer TODOS los estudiantes aunque no tengan fila
const result = await query(`
  FROM item_refs ir
  CROSS JOIN active_students s
  LEFT JOIN cleaning_item_state cis
    ON cis.student_id = s.student_uuid
   AND cis.item_ref = ir.item_ref
   AND cis.product_key = 'pde'
   AND cis.domain_type = 'transmutation'
`, [itemRefs]);
```

**Asunción implícita:**
- LPM lee desde `cleaning_item_state`
- Si estado NO existe:
  - `scope='student'`: Item NO aparece en proyección (NULL)
  - `scope='all'`: Item cuenta como NULL y empeora agregado

**¿Qué fallaría si Seed NO se ejecuta?**
- ❌ Items sin estado NO aparecerían en proyección `scope='student'`
- ❌ Items sin estado contarían como NULL en `scope='all'` (empeora agregado)
- ⚠️ **Impacto:** Proyecciones incompletas o incorrectas

**Dependencia:**
- ⚠️ LPM DEPENDE indirectamente del Seed
- Sin Seed, proyecciones estarían incompletas
- Seed garantiza que estados existan para proyección correcta

---

#### 3. Cleaning Engine (markCleanStudent)

**Archivo:** `src/core/master/services/cleaning-engine-service.js:586`

**Código real:**
```javascript
// Cleaning Engine asume que estado existe
const state = await stateRepo.getState({
  student_uuid,
  product_key,
  domain_type,
  item_ref
}, client);

// Si estado no existe, Cleaning Engine puede fallar
```

**Asunción implícita:**
- Cleaning Engine asume que estado existe
- Si estado NO existe, puede fallar o comportarse incorrectamente

**¿Qué fallaría si Seed NO se ejecuta?**
- ❌ POST /clean podría fallar si estado no existe
- ✅ **MITIGACIÓN:** POST /clean ejecuta Seed condicionalmente ANTES de limpiar (línea 311)

**Dependencia:**
- ✅ POST /clean NO depende de Seed en GET (tiene su propia validación)
- ✅ POST /clean ejecuta Seed si estado falta (correcto según contrato)

---

#### 4. Endpoint POST /master/api/alquimia-alumno/clean

**Archivo:** `src/endpoints/master-api-alquimia-alumno.js:299`

**Código real:**
```javascript
// Validar que el estado existe
const stateCheck = await query(`
  SELECT 1 
  FROM cleaning_item_state
  WHERE student_id = $1 AND product_key = $2 AND domain_type = $3 AND item_ref = $4
`, [student_uuid, product_key, domain_type, item_ref]);

if (!stateCheck.rows || stateCheck.rows.length === 0) {
  // Si no existe, intentar seed primero
  await ensureCleaningItemStateSeedForStudent({...});
  
  // Verificar de nuevo
  const stateCheck2 = await query(...);
  if (!stateCheck2.rows || stateCheck2.rows.length === 0) {
    return jsonError('Estado no encontrado...', 'STATE_NOT_FOUND', 400);
  }
}
```

**Dependencia:**
- ✅ POST /clean NO depende de Seed en GET
- ✅ POST /clean ejecuta Seed condicionalmente si estado falta
- ✅ POST /clean es autosuficiente (correcto según contrato)

---

### Pantallas/UI que Dependen Indirectamente del Seed

#### 1. Pantalla Alquimia Alumno (Megalist)

**Endpoint:** `GET /master/api/alquimia-alumno/megalist`

**Dependencia:**
- Pantalla lee megalist desde GET /megalist
- GET /megalist ejecuta Seed automáticamente
- **Si Seed NO se ejecuta en GET:**
  - ⚠️ Pantalla mostraría megalist incompleta (items sin estado NO aparecen)
  - ⚠️ Usuario no vería items aplicables hasta que se ejecute POST /clean

**Impacto:**
- ⚠️ **ALTO:** Pantalla depende de Seed en GET para mostrar items completos

---

#### 2. Pantalla Alquimia General (List Projection)

**Endpoint:** `GET /master/api/alquimia-general/lists/:id/projection`

**Dependencia:**
- Pantalla lee proyección desde `computeListProjection()`
- `computeListProjection()` lee desde `cleaning_item_state`
- **Si Seed NO se ejecuta:**
  - ⚠️ Items sin estado NO aparecerían en proyección `scope='student'`
  - ⚠️ Items sin estado contarían como NULL en `scope='all'` (empeora agregado)

**Impacto:**
- ⚠️ **MEDIO:** Pantalla depende de Seed para proyecciones correctas

**Nota:** Alquimia General NO ejecuta Seed explícitamente. Depende de Seed previo en GET /megalist o POST /clean.

---

### Resumen de Dependencias Funcionales

**Dependencias DIRECTAS (Seed se ejecuta explícitamente):**
- ✅ POST /clean → Ejecuta Seed condicionalmente (compatible con contrato)

**Dependencias INDIRECTAS (asumen que estado existe):**
- ⚠️ GET /megalist → Ejecuta Seed automáticamente (NO compatible con contrato)
- ⚠️ GET /list-projection → NO ejecuta Seed (depende de Seed previo)
- ⚠️ Pantalla Alquimia Alumno → Depende de Seed en GET /megalist
- ⚠️ Pantalla Alquimia General → Depende de Seed previo (no explícito)

**Riesgos al apagar Seed en GET:**
- ❌ Megalist estaría incompleta (items sin estado NO aparecen)
- ❌ Proyecciones estarían incompletas o incorrectas
- ❌ Usuario no vería items aplicables hasta POST /clean
- ⚠️ **Impacto:** UX degradada (items "ocultos" hasta primera acción)

---

## FASE 4 — MATRIZ DE MIGRACIÓN

### Tabla de Análisis de Puntos de Seed

| Punto de Seed Actual | Motivo Original | Tipo | ¿Compatible con SEED_CONTRACT_V1? | Acción Futura Sugerida |
|---------------------|-----------------|------|-----------------------------------|------------------------|
| **GET /megalist** (línea 178) | Asegurar estados completos antes de mostrar megalist | **Reactivo** (reacciona a lectura) | ❌ **NO** (prohibido en GET genérico) | **ELIMINAR** de GET, **MOVER** a inicialización controlada o **CONVERTIR** en validación explícita |
| **POST /clean** (línea 311) | Asegurar que estado existe antes de limpiar | **Estructural** (permite mutación crítica) | ✅ **SÍ** (permitido antes de mutación crítica) | **MANTENER** (ya correcto según contrato) |

---

### Análisis Detallado por Punto

#### Punto #1: GET /master/api/alquimia-alumno/megalist

**Motivo original:**
- Asegurar que todos los items aplicables tengan estado materializado antes de construir megalist
- Comentario: "CRÍTICO: Seed estados 'NUNCA' antes de construir megalista"

**Tipo:**
- ❌ **REACTIVO** (reacciona a lectura)
- Seed se ejecuta automáticamente en GET (no es acción explícita)
- Seed garantiza que megalist esté "completa" sin intervención del usuario

**¿Compatible con SEED_CONTRACT_V1.md?**
- ❌ **NO**

**Razones de incompatibilidad:**
1. Seed se ejecuta en GET (operación de lectura)
2. SEED_CONTRACT_V1.md prohíbe ejecución automática en GET genérico
3. Seed debería requerir flag `allow_structural_seed: true` explícito

**Acción futura sugerida:**

**Opción A: ELIMINAR de GET + Inicialización Controlada**
- Eliminar Seed de GET /megalist
- Crear endpoint POST `/master/api/alquimia-alumno/initialize` que ejecute Seed explícitamente
- UI llama a initialize ANTES de mostrar megalist (una vez por sesión/alumno)

**Opción B: CONVERTIR en Validación Explícita**
- Eliminar Seed de GET /megalist
- GET /megalist retorna error 400 si estados faltan
- UI maneja error y muestra mensaje "Inicializando estados..." con llamada a initialize

**Opción C: DEPRECATED sin Reemplazo Inmediato**
- Marcar Seed en GET como DEPRECATED (log WARN)
- Mantener comportamiento actual con advertencia
- Planificar migración futura

**Recomendación:** **Opción A** (inicialización controlada)

**Riesgos de eliminar:**
- ⚠️ Megalist estaría incompleta hasta inicialización explícita
- ⚠️ UX degradada (items "ocultos" hasta primera acción)

**Mitigación:**
- Crear endpoint POST `/master/api/alquimia-alumno/initialize` que ejecute Seed
- UI llama a initialize automáticamente al cargar pantalla (una vez)
- Seed se ejecuta ANTES de primera lectura de megalist

---

#### Punto #2: POST /master/api/alquimia-alumno/clean

**Motivo original:**
- Asegurar que el estado existe antes de intentar limpiar
- Evitar error 400 si el item es nuevo y no tiene estado

**Tipo:**
- ✅ **ESTRUCTURAL** (permite mutación crítica)
- Seed se ejecuta CONDICIONALMENTE (solo si estado falta)
- Seed garantiza que mutación pueda ejecutarse

**¿Compatible con SEED_CONTRACT_V1.md?**
- ✅ **SÍ**

**Razones de compatibilidad:**
1. Seed se ejecuta ANTES de mutación crítica (permitido según contrato)
2. Seed es condicional (solo si estado falta)
3. Seed no bloquea si ya existe (idempotente)

**Acción futura sugerida:**
- ✅ **MANTENER** (ya correcto según contrato)

**Sin cambios necesarios:**
- Comportamiento actual es compatible con SEED_CONTRACT_V1.md
- Seed se ejecuta antes de mutación crítica (correcto)
- Seed es condicional (eficiente)

---

### Dependencias de Datos - Matriz de Mutabilidad

| Dependencia | Origen | Tipo | ¿Problemático? | Acción Sugerida |
|-------------|--------|------|----------------|-----------------|
| **level_cap** (explícito) | Query params / Body | **Observado** | ✅ No (estructural) | Mantener (correcto) |
| **nivel_efectivo** (derivado) | Calculado dinámicamente | **Mutable** | ❌ Sí (reactivo) | **ELIMINAR** default, requerir level_cap explícito |
| **status='active'** | Catálogo (items/listas) | **Estructural** | ✅ No | Mantener (correcto) |
| **item_ref IS NOT NULL** | Catálogo | **Estructural** | ✅ No | Mantener (correcto) |
| **nivel <= level_cap** | Catálogo + level_cap | **Dependiente** | ⚠️ Si level_cap mutable | **FIX:** Requerir level_cap explícito |
| **nivel IS NULL** | Catálogo | **Estructural** | ⚠️ Sí (siempre aplicable) | **FIX:** Respetar level_cap incluso si nivel IS NULL |
| **lista_tipo** | NO se filtra | **Falta** | ⚠️ Sí (seedea más de lo necesario) | **FIX:** Filtrar por lista_tipo si viene |

---

## RESUMEN EJECUTIVO

### Riesgos al Apagar Seed en GET

**Riesgo #1: Megalist Incompleta**
- **Gravedad:** ALTA
- **Impacto:** Usuario no vería items aplicables hasta POST /clean
- **Mitigación:** Crear endpoint POST `/initialize` y llamarlo automáticamente al cargar pantalla

**Riesgo #2: Proyecciones Incorrectas**
- **Gravedad:** MEDIA
- **Impacto:** Items sin estado contarían como NULL en `scope='all'` (empeora agregado)
- **Mitigación:** LPM maneja NULL correctamente (pero estado incompleto)

**Riesgo #3: UX Degradada**
- **Gravedad:** MEDIA
- **Impacto:** Items "ocultos" hasta primera acción de limpieza
- **Mitigación:** Inicialización automática al cargar pantalla (transparente para usuario)

---

### Puntos Críticos a Migrar

#### Punto Crítico #1: GET /megalist ejecuta Seed automáticamente

**Gravedad:** ALTA

**Motivo:**
- Viola SEED_CONTRACT_V1.md (prohibido en GET genérico)
- Seed ejecuta WRITE en contexto de READ
- No hay guard que evite ejecución

**Acción sugerida:**
1. **ELIMINAR** Seed de GET /megalist
2. **CREAR** endpoint POST `/master/api/alquimia-alumno/initialize`
3. **MODIFICAR** UI para llamar initialize automáticamente al cargar pantalla
4. **AGREGAR** guard en Seed que rechace ejecución en GET sin flag

**Orden sugerido:**
1. Crear endpoint POST `/initialize` (con flag `allow_structural_seed: true`)
2. Modificar UI para llamar initialize automáticamente
3. Eliminar Seed de GET /megalist
4. Agregar guard en Seed que rechace GET sin flag

---

#### Punto Crítico #2: Seed depende de nivel_efectivo mutable

**Gravedad:** MEDIA

**Motivo:**
- Si `level_cap = null`, Seed deriva `nivel_efectivo` (mutable)
- Si `nivel_efectivo` cambia, Seed no se re-ejecuta automáticamente
- Items nuevos niveles quedan sin seed

**Acción sugerida:**
1. **REQUERIR** `level_cap` explícito (no permitir null)
2. **ELIMINAR** fallback a `nivel_efectivo`
3. **AGREGAR** validación que rechace `level_cap = null`

**Orden sugerido:**
1. Modificar Seed para requerir `level_cap` explícito
2. Eliminar fallback a `nivel_efectivo`
3. Agregar validación que rechace null
4. Actualizar llamadas para pasar `level_cap` explícito

---

#### Punto Crítico #3: Seed seedea más de lo necesario

**Gravedad:** BAJA

**Motivo:**
- Seed seedea TODOS los items aplicables (no filtra por lista_tipo)
- Items sin nivel siempre aplicables (no respeta level_cap)

**Acción sugerida:**
1. **AGREGAR** filtro por `lista_tipo` si viene (opcional)
2. **RESPETAR** level_cap incluso si nivel IS NULL

**Orden sugerido:**
1. Agregar parámetro `lista_tipo` opcional a Seed
2. Modificar SQL para filtrar por lista_tipo si viene
3. Modificar SQL para respetar level_cap incluso si nivel IS NULL

---

### Orden Sugerido de Refactor

**FASE 1: Preparación (Sin Cambios Funcionales)**
1. ✅ Crear contrato SEED_CONTRACT_V1.md (YA COMPLETADO)
2. ✅ Crear diagnóstico completo (ESTE DOCUMENTO)
3. ✅ Crear endpoint POST `/master/api/alquimia-alumno/initialize`
4. ✅ Agregar guard en Seed que rechace GET sin flag (con WARN)

**FASE 2: Migración de Dependencias (Con Cambios Funcionales)**
5. Modificar UI para llamar initialize automáticamente al cargar pantalla
6. Verificar que initialize funciona correctamente
7. Eliminar Seed de GET /megalist
8. Verificar que megalist funciona correctamente sin Seed en GET

**FASE 3: Mejoras de Datos (Sin Cambios Funcionales)**
9. Modificar Seed para requerir `level_cap` explícito
10. Eliminar fallback a `nivel_efectivo`
11. Agregar filtro por `lista_tipo` opcional
12. Respetar level_cap incluso si nivel IS NULL

**FASE 4: Limpieza (Sin Cambios Funcionales)**
13. Eliminar código legacy de Seed en GET
14. Actualizar documentación
15. Ejecutar tests completos
16. Commit final con versión

---

## ANÁLISIS ADICIONAL

### Problemas Técnicos Detectados

#### Problema #1: Cálculo de `skipped` puede ser negativo

**Código real:**
```javascript
const skipped = existing - (total_applicable - inserted);
```

**Problema:**
- Si `total_applicable` cambia entre ejecuciones (items nuevos en catálogo)
- `skipped` puede ser negativo (no tiene sentido semántico)

**Ejemplo:**
- Primera ejecución: `existing = 50`, `total_applicable = 100`, `inserted = 50` → `skipped = 0` ✅
- Segunda ejecución (nuevos items): `existing = 50`, `total_applicable = 150`, `inserted = 0` → `skipped = -100` ❌

**Solución sugerida:**
```javascript
const skipped = Math.max(0, existing - (total_applicable - inserted));
```

---

#### Problema #2: Items sin nivel siempre aplicables

**Código real:**
```sql
AND (i.nivel IS NULL OR i.nivel <= $4::integer)
```

**Problema:**
- Items con `nivel IS NULL` SIEMPRE se seedean (incluso si `level_cap = 1`)
- No respeta level_cap para items sin nivel

**Solución sugerida:**
```sql
-- Opción A: Excluir items sin nivel si level_cap es bajo
AND (i.nivel IS NOT NULL AND i.nivel <= $4::integer)

-- Opción B: Tratar items sin nivel como nivel 0 (siempre aplicables)
AND (COALESCE(i.nivel, 0) <= $4::integer)
```

**Recomendación:** Opción B (items sin nivel siempre aplicables, pero respetando level_cap si viene explícito)

---

#### Problema #3: No hay filtro por lista_tipo

**Problema:**
- Seed seedea items de TODAS las listas (recurrente + una_vez)
- GET /megalist solo muestra una lista_tipo específica
- Seed innecesario de items no mostrados

**Solución sugerida:**
- Agregar parámetro `lista_tipo` opcional a Seed
- Filtrar por `lista_tipo` si viene:
```sql
AND ($5::text IS NULL OR l.tipo = $5::text)
```

---

## DEPENDENCIAS FUNCIONALES - ANÁLISIS DETALLADO

### ¿Qué fallaría si Seed NO se ejecuta en GET?

#### Escenario #1: Usuario nuevo accede a Pantalla Alquimia Alumno

**Flujo actual:**
1. GET /megalist → Ejecuta Seed automáticamente
2. Seed crea estados para items aplicables
3. Megalist construye desde estados (completa)

**Flujo sin Seed en GET:**
1. GET /megalist → NO ejecuta Seed
2. Megalist construye desde estados (incompleta - solo estados existentes)
3. Usuario NO ve items aplicables sin estado
4. Usuario intenta limpiar item → POST /clean ejecuta Seed condicionalmente
5. Estado se crea, item aparece en siguiente GET /megalist

**Impacto:**
- ⚠️ **UX degradada:** Items "ocultos" hasta primera acción
- ⚠️ **Inconsistencia:** Megalist incompleta en primera carga

---

#### Escenario #2: Usuario sube de nivel

**Flujo actual:**
1. GET /megalist con `level_cap = 5` → Seed seedea items nivel 1-5
2. Usuario sube a nivel 10
3. GET /megalist con `level_cap = 10` → Seed NO seedea items nivel 6-10 (conflict idempotente)
4. Items nivel 6-10 NO aparecen en megalist

**Flujo sin Seed en GET:**
1. GET /megalist → NO ejecuta Seed
2. Items nivel 6-10 NO aparecen (no tienen estado)
3. Usuario intenta limpiar item nivel 8 → POST /clean ejecuta Seed condicionalmente
4. Estado se crea, item aparece en siguiente GET /megalist

**Impacto:**
- ⚠️ **Mismo problema:** Items nuevos niveles "ocultos" hasta primera acción

---

#### Escenario #3: Item nuevo se añade al catálogo

**Flujo actual:**
1. Item nuevo se añade al catálogo (nivel 3, lista recurrente)
2. Usuario con nivel 10 hace GET /megalist → Seed seedea item nuevo
3. Item aparece en megalist

**Flujo sin Seed en GET:**
1. Item nuevo se añade al catálogo
2. Usuario hace GET /megalist → NO ejecuta Seed
3. Item NO aparece en megalist (no tiene estado)
4. Usuario intenta limpiar item → POST /clean ejecuta Seed condicionalmente
5. Estado se crea, item aparece en siguiente GET /megalist

**Impacto:**
- ⚠️ **UX degradada:** Items nuevos "ocultos" hasta primera acción

---

### Servicios que NO Fallan pero Asumen Estado Existe

#### 1. CPM (Cleaning Projection Model)

**Archivo:** `src/core/master/services/cleaning-projection-model.js:40`

**Código real:**
```javascript
export function computeEffectiveState({ item_kind, view_layer, item_config, cleaning_state, overrides = {} }) {
  // CPM recibe cleaning_state como parámetro
  // Si cleaning_state es null/undefined, CPM puede fallar o retornar estado 'never'
}
```

**Asunción:**
- CPM espera `cleaning_state` como parámetro
- Si `cleaning_state` es null/undefined, CPM calcula estado 'never'

**¿Qué pasa si estado NO existe?**
- ✅ CPM NO falla (maneja null/undefined)
- ✅ CPM retorna estado 'never' si cleaning_state es null
- ✅ **Comportamiento seguro:** No rompe, pero estado es 'never'

---

#### 2. LPM (List Projection Model)

**Archivo:** `src/core/master/services/list-projection-model.js:418`

**Código real (scope='student'):**
```javascript
const result = await query(`
  SELECT cis.*
  FROM cleaning_item_state cis
  WHERE cis.student_id = $1 AND cis.item_ref = ANY($2::text[])
`, [studentId, itemRefs]);

// Si estado NO existe, result.rows no incluye ese item
// statesMap[itemRef] será undefined
```

**Código real (scope='all'):**
```javascript
LEFT JOIN cleaning_item_state cis
  ON cis.student_id = s.student_uuid
 AND cis.item_ref = ir.item_ref

// Si estado NO existe, cis.* es NULL
// LPM trata NULL como "peor estado" (empeora agregado)
```

**¿Qué pasa si estado NO existe?**
- `scope='student'`: Item NO aparece en proyección (undefined en statesMap)
- `scope='all'`: Item cuenta como NULL y empeora agregado (correcto semánticamente)
- ✅ **Comportamiento seguro:** No rompe, pero proyección incompleta o incorrecta

---

### Resumen de Dependencias Funcionales

**Dependencias CRÍTICAS (rompen funcionalidad):**
- ❌ Ninguna (todos los servicios manejan falta de estado)

**Dependencias FUNCIONALES (degradan UX):**
- ⚠️ GET /megalist → Megalist incompleta si Seed NO se ejecuta
- ⚠️ GET /list-projection → Proyección incompleta o incorrecta si Seed NO se ejecuta
- ⚠️ Pantalla Alquimia Alumno → Items "ocultos" hasta primera acción
- ⚠️ Pantalla Alquimia General → Items sin estado cuentan como NULL en agregado

**Conclusión:**
- ✅ Sistema NO rompe si Seed NO se ejecuta (fail-safe)
- ⚠️ UX se degrada significativamente (items "ocultos")
- ⚠️ Megalist y proyecciones estarían incompletas

---

## MATRIZ DE MIGRACIÓN COMPLETA

| Punto de Seed Actual | Archivo | Línea | Tipo de Invocación | Motivo Original | Tipo (estructural/correctivo/reactivo) | ¿Compatible con SEED_CONTRACT_V1? | Acción Futura Sugerida | Prioridad |
|---------------------|---------|-------|-------------------|-----------------|----------------------------------------|-----------------------------------|------------------------|-----------|
| **GET /megalist** | `src/endpoints/master-api-alquimia-alumno.js` | 178 | GET (lectura) | Asegurar estados completos antes de mostrar | **Reactivo** | ❌ NO | **ELIMINAR** de GET, **CREAR** POST `/initialize`, **MODIFICAR** UI | **ALTA** |
| **POST /clean** | `src/endpoints/master-api-alquimia-alumno.js` | 311 | POST (escritura) | Asegurar que estado existe antes de limpiar | **Estructural** | ✅ SÍ | **MANTENER** (ya correcto) | - |

---

## CONCLUSIONES Y RECOMENDACIONES

### Conclusiones Principales

1. **Seed se ejecuta en 2 lugares:**
   - GET /megalist (automático, siempre) → ❌ NO compatible con contrato
   - POST /clean (condicional, solo si falta) → ✅ Compatible con contrato

2. **Dependencias de datos problemáticas:**
   - Seed depende de `nivel_efectivo` mutable (si `level_cap = null`)
   - Seed seedea más de lo necesario (no filtra por lista_tipo)
   - Items sin nivel siempre aplicables (no respeta level_cap)

3. **Dependencias funcionales:**
   - Megalist depende indirectamente del Seed en GET
   - Proyecciones dependen indirectamente del Seed
   - Sistema NO rompe sin Seed, pero UX se degrada

---

### Recomendaciones Finales

#### Recomendación #1: Eliminar Seed de GET /megalist

**Prioridad:** ALTA

**Acción:**
1. Crear endpoint POST `/master/api/alquimia-alumno/initialize`
2. Modificar UI para llamar initialize automáticamente al cargar pantalla
3. Eliminar Seed de GET /megalist
4. Agregar guard en Seed que rechace GET sin flag

**Beneficios:**
- ✅ Compatible con SEED_CONTRACT_V1.md
- ✅ Separación clara entre READ y WRITE
- ✅ Seed explícito (no automático)

**Riesgos:**
- ⚠️ Megalist incompleta hasta initialize (mitigado con initialize automático)

---

#### Recomendación #2: Requerir level_cap explícito

**Prioridad:** MEDIA

**Acción:**
1. Modificar Seed para requerir `level_cap` explícito (no permitir null)
2. Eliminar fallback a `nivel_efectivo`
3. Agregar validación que rechace `level_cap = null`

**Beneficios:**
- ✅ Seed no depende de estado mutable
- ✅ Seed es predecible (level_cap observado)
- ✅ Compatible con SEED_CONTRACT_V1.md

**Riesgos:**
- ⚠️ Requiere actualizar todas las llamadas para pasar `level_cap` explícito

---

#### Recomendación #3: Filtrar por lista_tipo

**Prioridad:** BAJA

**Acción:**
1. Agregar parámetro `lista_tipo` opcional a Seed
2. Modificar SQL para filtrar por lista_tipo si viene
3. Actualizar llamadas para pasar lista_tipo cuando aplique

**Beneficios:**
- ✅ Seed más eficiente (solo seedea items necesarios)
- ✅ Reducción de carga innecesaria

**Riesgos:**
- ⚠️ Mínimo (mejora, no cambio crítico)

---

### Orden de Refactor Sugerido

**1. Preparación (Sin Cambios Funcionales)**
- ✅ Contrato creado
- ✅ Diagnóstico completado
- Crear endpoint POST `/initialize`
- Agregar guard en Seed

**2. Migración Funcional (Con Cambios)**
- Modificar UI para initialize automático
- Eliminar Seed de GET /megalist
- Verificar funcionalidad

**3. Mejoras de Datos**
- Requerir level_cap explícito
- Agregar filtro por lista_tipo
- Respetar level_cap incluso si nivel IS NULL

**4. Limpieza Final**
- Eliminar código legacy
- Actualizar documentación
- Tests completos

---

**FIN DEL DIAGNÓSTICO TÉCNICO FINAL**
