# 🔍 DIAGNÓSTICO EXHAUSTIVO: Sistema de Contextos PDE

**Fecha**: 2025-01-XX  
**Versión del Sistema**: v5.30.0  
**Objetivo**: Identificar problemas estructurales en el Gestor de Contextos PDE

---

## 📊 RESUMEN EJECUTIVO

### Estado Actual de la Base de Datos

- **Total de registros**: 10
- **Registros activos**: 2 (20%)
- **Registros eliminados (soft-delete)**: 8 (80%)
- **Duplicados activos**: 0
- **Duplicados totales**: 0
- **Registros con NULLs indebidos**: 0
- **Combinaciones ilegales**: 0
- **Inconsistencias en definiciones**: 0

### Contextos Activos Actuales

1. `nivel_efectivo_pde` - scope: package, kind: normal, type: number
2. `tipo_limpieza_diariav2` - scope: package, kind: normal, type: enum

### Contextos Eliminados (Soft-Delete)

1. `asdfa` - eliminado 2025-12-20 20:23:29
2. `nivel_efectivo` - eliminado 2025-12-20 19:03:12
3. `test_contexto_verificacion` - eliminado 2025-12-20 17:26:22
4. `test_contexto_verificacion_1766251626214` - eliminado 2025-12-20 17:27:06
5. `test_contexto_verificacion_1766251653096` - eliminado 2025-12-20 17:27:33
6. `tipo_limpieza` - eliminado 2025-12-20 19:03:12
7. `tipo_limpieza_diaria` - eliminado 2025-12-20 19:43:36
8. `tipo_practica` - eliminado 2025-12-20 19:03:12

---

## 🔴 PROBLEMAS CRÍTICOS DETECTADOS

### 1. COLISIÓN CON SOFT-DELETE EN CREATE

**Ubicación**: `src/infra/repos/pde-contexts-repo-pg.js:214`

**Problema**:
```javascript
// Línea 214: Verifica si existe (incluyendo eliminados)
const existing = await this.getByKey(context_key, true);
if (existing) {
  throw new Error(`El contexto '${context_key}' ya existe`);
}
```

**Análisis**:
- El método `getByKey` con `includeDeleted=true` puede encontrar un contexto soft-deleted
- Si existe un contexto eliminado, el CREATE falla con error "ya existe"
- **PERO**: La constraint UNIQUE en PostgreSQL permite múltiples registros con el mismo `context_key` si uno está eliminado (porque `deleted_at` no está en la constraint)
- Esto crea una **inconsistencia lógica**: el código dice "ya existe" pero la BD permite insertarlo

**Impacto**:
- Usuario intenta crear un contexto con un `context_key` que fue eliminado
- El sistema dice "ya existe" aunque esté eliminado
- El usuario no puede recrear el contexto sin cambiar el `context_key`
- **Esto explica por qué "cambiar el context_key arregla cosas"**

**Causa Raíz**:
- No hay política clara sobre qué hacer con contextos soft-deleted
- El repositorio no diferencia entre "existe activo" y "existe eliminado"
- La constraint UNIQUE no considera `deleted_at`

---

### 2. PÉRDIDA DE CAMPOS EN UPDATE

**Ubicación**: `src/infra/repos/pde-contexts-repo-pg.js:347-480`

**Problema**:
```javascript
// Líneas 356-406: Solo actualiza campos que están !== undefined
if (patch.label !== undefined) {
  updates.push(`label = $${paramIndex++}`);
  params.push(patch.label);
}
// ... más campos
```

**Análisis**:
- El UPDATE solo modifica campos que están explícitamente en el `patch` y son `!== undefined`
- Si el frontend envía `undefined` explícitamente, esos campos NO se actualizan
- Si el frontend NO envía un campo, ese campo NO se actualiza
- **PERO**: Si el frontend envía `null`, el campo SÍ se actualiza a NULL

**Impacto**:
- Usuario edita un contexto y no envía todos los campos
- Los campos no enviados mantienen su valor anterior (correcto)
- **PERO**: Si el frontend envía `undefined` por error, esos campos no se actualizan
- Si el frontend envía `null` cuando debería ser un valor, se pierde el valor

**Causa Raíz**:
- No hay validación explícita de qué campos son obligatorios en UPDATE
- El frontend puede enviar `undefined` en lugar de omitir el campo
- No hay normalización del payload antes del UPDATE

---

### 3. DESINCRONIZACIÓN ENTRE DEFINITION Y COLUMNAS DEDICADAS

**Ubicación**: `src/infra/repos/pde-contexts-repo-pg.js:194-328` (CREATE) y `347-480` (UPDATE)

**Problema**:
- La tabla tiene DOS fuentes de verdad:
  1. Columna `definition` (JSONB) - contiene type, scope, kind, allowed_values, default_value
  2. Columnas dedicadas: `scope`, `kind`, `type`, `allowed_values`, `default_value`

**Análisis**:
- En CREATE (líneas 219-249): Se extraen campos de `definition` si existe, pero luego se construye un `finalDefinition` que puede no coincidir
- En UPDATE (líneas 366-401): Se actualiza `definition` Y las columnas dedicadas por separado
- **NO hay garantía de sincronización** entre ambas fuentes

**Impacto**:
- Un contexto puede tener `scope='package'` en la columna pero `scope='system'` en `definition`
- El sistema puede leer de una fuente u otra según el código
- Inconsistencias silenciosas que causan comportamiento errático

**Causa Raíz**:
- Migración v5.25.0 añadió columnas dedicadas pero mantuvo `definition` como legacy
- No hay trigger o constraint que sincronice ambas fuentes
- El código actualiza ambas pero no garantiza coherencia

---

### 4. FRONTEND ENVÍA CAMPOS COMO `undefined`

**Ubicación**: `src/core/html/admin/contexts/contexts-manager.html:1026-1049`

**Problema**:
```javascript
// Línea 1026-1049: Construcción del payload
const payload = {
  context_key: contextKey,
  label,
  definition,
  scope,
  kind,
  type,
  injected
};

// Añadir allowed_values solo si está definido
if (allowedValues !== undefined && allowedValues.length > 0) {
  payload.allowed_values = allowedValues;
}

// Añadir default_value solo si está definido
if (defaultValue !== undefined) {
  payload.default_value = defaultValue;
}
```

**Análisis**:
- El frontend construye el payload con campos que pueden ser `undefined`
- Si `allowedValues` es `undefined` o array vacío, NO se añade al payload (correcto)
- Si `defaultValue` es `undefined`, NO se añade al payload (correcto)
- **PERO**: Si `description` es `undefined`, se envía como `undefined` en el payload (línea 1037-1039)
- El backend puede recibir `undefined` y tratarlo como "no actualizar" en UPDATE

**Impacto**:
- En CREATE: Si `description` es `undefined`, se envía como `undefined` y el backend puede fallar
- En UPDATE: Si `description` es `undefined`, no se actualiza (puede ser deseado o no)
- Inconsistencia: algunos campos se omiten si son `undefined`, otros se envían

**Causa Raíz**:
- No hay normalización consistente del payload en el frontend
- Algunos campos se omiten, otros se envían como `undefined`
- El backend no normaliza el payload antes de procesarlo

---

### 5. RESOLVER DE VISIBILIDAD OCULTA CONTEXTOS ELIMINADOS

**Ubicación**: `src/core/context/resolve-context-visibility.js:19-56`

**Problema**:
```javascript
// Línea 26: Si deleted_at != null, el contexto no es visible
if (context.deleted_at != null) {
  return false;
}
```

**Análisis**:
- El resolver de visibilidad oculta correctamente contextos con `deleted_at != null`
- **PERO**: El servicio `listContexts` ya filtra por `deleted_at IS NULL` en la query SQL
- Hay **doble filtrado**: SQL + resolver
- Si un contexto eliminado pasa el filtro SQL (bug), el resolver lo oculta (correcto)

**Impacto**:
- Contextos eliminados NO aparecen en la UI (correcto)
- **PERO**: Si hay un bug en el filtro SQL, el resolver actúa como defensa en profundidad
- Puede ocultar contextos válidos si `deleted_at` tiene un valor inesperado

**Causa Raíz**:
- Defensa en profundidad es buena, pero indica que hay falta de confianza en el filtro SQL
- No hay validación explícita de que `deleted_at` sea NULL o un timestamp válido

---

### 6. DEFINITION SE PIERDE EN ALGÚN PUNTO

**Ubicación**: Múltiples (repositorio, servicio, endpoints)

**Problema**:
- El campo `definition` es JSONB y obligatorio (NOT NULL)
- **PERO**: En algunos flujos, `definition` puede no construirse correctamente
- Si `definition` es NULL o inválido, el INSERT falla

**Análisis**:
- En CREATE (líneas 238-249): Se construye `finalDefinition` con defaults si no se proporciona
- **PERO**: Si `definition` viene del frontend y es inválido, puede fallar
- En UPDATE (línea 368): Se actualiza `definition` con `JSON.stringify(patch.definition)`
- Si `patch.definition` es `undefined`, NO se actualiza (correcto)
- **PERO**: Si `patch.definition` es `null`, se actualiza a `null` (incorrecto, debería ser error)

**Impacto**:
- Si `definition` se pierde o se corrompe, el contexto queda inválido
- El sistema puede fallar al leer contextos con `definition` inválido
- No hay validación de que `definition` sea un JSON válido antes de guardar

**Causa Raíz**:
- No hay validación explícita de `definition` antes de INSERT/UPDATE
- El código asume que `definition` siempre es válido
- No hay fallback si `definition` es inválido

---

## ⚠️ PROBLEMAS MENORES DETECTADOS

### 7. Normalización de Scope Legacy

**Ubicación**: `src/core/contexts/context-registry.js:49`

**Problema**:
- El default de `scope` es `'recorrido'` (legacy)
- Se mapea a `'package'` en algunos lugares, pero no consistentemente

**Impacto**:
- Inconsistencia en el valor de `scope` según dónde se lea
- Contextos legacy pueden tener `scope='recorrido'` en `definition` pero `scope='package'` en columna

---

### 8. Falta de Validación de Combinaciones

**Ubicación**: `src/endpoints/admin-contexts-api.js:249-405`

**Problema**:
- No hay validación explícita de combinaciones válidas:
  - `kind='level'` debe tener `scope='structural'`
  - `scope='system'` normalmente debe tener `injected=true`
  - `scope='structural'` normalmente debe tener `injected=true`

**Impacto**:
- Se pueden crear contextos con combinaciones inválidas
- El sistema puede comportarse de forma errática con combinaciones no soportadas

---

## 📋 MODELO REAL DETECTADO

### Estructura de la Tabla `pde_contexts`

```sql
CREATE TABLE pde_contexts (
  id UUID PRIMARY KEY,
  context_key TEXT UNIQUE NOT NULL,  -- ⚠️ UNIQUE pero no considera deleted_at
  label TEXT NOT NULL,
  description TEXT,
  definition JSONB NOT NULL,         -- ⚠️ Fuente de verdad #1
  scope context_scope NOT NULL,      -- ⚠️ Fuente de verdad #2
  kind context_kind NOT NULL,        -- ⚠️ Fuente de verdad #2
  injected BOOLEAN NOT NULL,
  type context_type,                 -- ⚠️ Fuente de verdad #2
  allowed_values JSONB,              -- ⚠️ Fuente de verdad #2
  default_value JSONB,               -- ⚠️ Fuente de verdad #2
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  deleted_at TIMESTAMPTZ             -- ⚠️ Soft delete
);
```

### Contrato de Negocio (Reconstruido)

#### Scope
- `system`: Contextos globales del sistema (ej: temporada)
- `structural`: Estado estructural del alumno (ej: nivel_pde)
- `personal`: Estado personal variable del alumno
- `package`: Definidos por experiencias concretas (aparecen en selector de paquetes)

#### Kind
- `normal`: Contexto estándar
- `level`: Contexto de nivel (debe tener `scope='structural'`)

#### Type
- `string`: Texto
- `number`: Número
- `boolean`: Verdadero/falso
- `enum`: Lista de valores (requiere `allowed_values`)
- `json`: Objeto JSON

#### Combinaciones Válidas
- `kind='level'` → `scope='structural'` (obligatorio)
- `scope='system'` → `injected=true` (recomendado)
- `scope='structural'` → `injected=true` (recomendado)
- `scope='package'` → `injected=false` (normalmente)
- `type='enum'` → `allowed_values` no vacío (obligatorio)

---

## 🔍 CAUSA RAÍZ (ROOT CAUSE)

### Problema Estructural Principal

**El sistema tiene múltiples fuentes de verdad que pueden desincronizarse:**

1. **Columna `definition` (JSONB)** vs **Columnas dedicadas** (scope, kind, type, etc.)
2. **Filtro SQL** (`deleted_at IS NULL`) vs **Resolver de visibilidad** (`deleted_at != null`)
3. **Frontend payload** (puede tener `undefined`) vs **Backend esperado** (campos opcionales)

### Flujo Problemático Típico

1. Usuario crea contexto `tipo_limpieza` → Se guarda correctamente
2. Usuario elimina contexto `tipo_limpieza` → Soft delete (`deleted_at` = timestamp)
3. Usuario intenta crear `tipo_limpieza` de nuevo → **FALLA**: "ya existe" (aunque esté eliminado)
4. Usuario cambia `context_key` a `tipo_limpieza_v2` → Se guarda correctamente
5. **Problema**: Ahora hay dos contextos con funcionalidad similar pero keys diferentes

### Por Qué "Cambiar el context_key Arregla Cosas"

- El sistema no permite recrear un contexto con un `context_key` que fue eliminado
- Cambiar el `context_key` evita la colisión con el soft-deleted
- **PERO**: Esto crea fragmentación (múltiples contextos similares con keys diferentes)

---

## 📝 LISTA EXPLÍCITA DE COSAS QUE NO ESTÁN BIEN

1. ❌ **CREATE puede colisionar con soft-deleted**: No hay política clara sobre recrear contextos eliminados
2. ❌ **UPDATE puede perder campos**: Si el frontend envía `undefined`, esos campos no se actualizan
3. ❌ **Dos fuentes de verdad desincronizadas**: `definition` JSONB vs columnas dedicadas
4. ❌ **Frontend envía `undefined`**: Inconsistencia en qué campos se omiten vs se envían
5. ❌ **No hay validación de combinaciones**: Se pueden crear contextos con combinaciones inválidas
6. ❌ **No hay validación explícita de `definition`**: Puede ser NULL o inválido
7. ❌ **Constraint UNIQUE no considera `deleted_at`**: Permite duplicados si uno está eliminado
8. ❌ **Normalización inconsistente de scope legacy**: `'recorrido'` vs `'package'`
9. ❌ **Doble filtrado de visibilidad**: SQL + resolver (indica falta de confianza)
10. ❌ **No hay logs estructurados**: Difícil rastrear qué pasa en CREATE/UPDATE

---

## 🎯 RECOMENDACIONES PARA FASE 2 (CORRECCIÓN)

### Prioridad CRÍTICA

1. **Definir política clara para soft-delete**:
   - Opción A: Permitir recrear contextos eliminados (restaurar o crear nuevo)
   - Opción B: Bloquear recreación y forzar cambio de `context_key`
   - Opción C: Hard delete después de X días

2. **Sincronizar `definition` y columnas dedicadas**:
   - Hacer que `definition` sea la fuente de verdad
   - Actualizar columnas dedicadas desde `definition` (trigger o código)
   - O viceversa: hacer columnas dedicadas la fuente de verdad y construir `definition` desde ellas

3. **Normalizar payload del frontend**:
   - Eliminar campos `undefined` antes de enviar
   - Validar que campos obligatorios estén presentes
   - Asegurar tipos correctos (number, boolean, etc.)

4. **Validar `definition` antes de INSERT/UPDATE**:
   - Asegurar que `definition` sea un objeto válido
   - Validar que campos obligatorios estén presentes
   - Fallar temprano con mensajes claros

### Prioridad ALTA

5. **Añadir validación de combinaciones**:
   - `kind='level'` → `scope='structural'` (obligatorio)
   - `scope='system'` → `injected=true` (recomendado, warning si no)
   - `type='enum'` → `allowed_values` no vacío (obligatorio)

6. **Mejorar manejo de UPDATE**:
   - Distinguir entre "no enviado" y "enviado como null"
   - Validar que campos obligatorios no se borren
   - Asegurar que `definition` siempre sea válido

### Prioridad MEDIA

7. **Añadir logs estructurados**:
   - Log antes de CREATE/UPDATE con payload completo
   - Log después de CREATE/UPDATE con resultado
   - Log de errores con contexto completo

8. **Unificar filtrado de visibilidad**:
   - Confiar en el filtro SQL y eliminar doble filtrado
   - O confiar en el resolver y eliminar filtro SQL
   - No ambos (redundante)

---

## 📊 MÉTRICAS DE ÉXITO

Después de las correcciones, el sistema debe cumplir:

- ✅ CREATE permite recrear contextos eliminados (o bloquea explícitamente)
- ✅ UPDATE no pierde campos no enviados
- ✅ `definition` y columnas dedicadas están siempre sincronizadas
- ✅ Frontend nunca envía `undefined` en el payload
- ✅ No se pueden crear contextos con combinaciones inválidas
- ✅ `definition` siempre es válido antes de guardar
- ✅ Logs estructurados permiten rastrear problemas

---

**FIN DEL DIAGNÓSTICO**





