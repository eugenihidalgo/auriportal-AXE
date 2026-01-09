# DIAGNÓSTICO CLASIFICACIONES ALQUIMIA v1
**Fecha:** 2026-01-XX  
**Objetivo:** Auditoría completa del sistema de clasificaciones, tags y subclasificaciones

---

## 1. SISTEMA CANÓNICO DE CLASIFICACIONES

### 1.1. Tabla SOT: `pde_classification_terms`

**Migración canónica:** `v5.36.0-classification-terms-canonical.sql`

**¿Qué es?** Source of Truth global para todos los términos de clasificación (keys, subkeys, tags) normalizados y reutilizables.

**Estructura:**

| Campo | Tipo | Descripción | Estado |
|-------|------|-------------|--------|
| `id` | UUID PRIMARY KEY | ID único del término | ✅ Canónico |
| `type` | TEXT NOT NULL | `'key'` (category), `'subkey'` (subtype), `'tag'` | ✅ Canónico (CHECK constraint) |
| `value` | TEXT NOT NULL | Valor original (ej: "Energía Indeseable") | ✅ Canónico |
| `normalized` | TEXT NOT NULL | Valor normalizado (lowercase + sin acentos) | ✅ Canónico |
| `status` | TEXT | `'active'` o `'deprecated'` | ✅ Canónico (default: 'active') |
| `created_at` | TIMESTAMPTZ | Fecha de creación | ✅ Canónico |
| `updated_at` | TIMESTAMPTZ | Fecha de actualización | ✅ Canónico |

**Constraint único:** `UNIQUE (type, normalized)` - Evita duplicados por tipo y valor normalizado

**Función de normalización:** `normalize_classification_term(input_text TEXT)`
- Convierte a lowercase
- Elimina acentos (á→a, é→e, í→i, ó→o, ú→u, ñ→n, ü→u)
- Elimina espacios extra y trim

**Función idempotente:** `ensure_classification_term(p_type TEXT, p_value TEXT)`
- Busca término existente por `type` y `normalized`
- Si existe, devuelve su ID
- Si no existe, lo crea y devuelve su ID

### 1.2. Tabla de Relación: `transmutacion_lista_classifications`

**¿Qué es?** Tabla many-to-many que asocia listas de transmutaciones con términos de clasificación canónicos.

**Estructura:**

| Campo | Tipo | Descripción | Estado |
|-------|------|-------------|--------|
| `lista_id` | INTEGER NOT NULL | FK a `listas_transmutaciones.id` | ✅ Canónico |
| `classification_term_id` | UUID NOT NULL | FK a `pde_classification_terms.id` | ✅ Canónico |
| `created_at` | TIMESTAMPTZ | Fecha de asociación | ✅ Canónico |

**Primary Key:** `(lista_id, classification_term_id)` - Evita duplicados

**Constraints:**
- `FOREIGN KEY (lista_id) REFERENCES listas_transmutaciones(id) ON DELETE CASCADE`
- `FOREIGN KEY (classification_term_id) REFERENCES pde_classification_terms(id) ON DELETE CASCADE`

**Índices:**
- `idx_transmutacion_lista_classifications_lista` - Por lista_id
- `idx_transmutacion_lista_classifications_term` - Por classification_term_id

### 1.3. Tipos de Clasificaciones

**Tipo `'key'` (Category):**
- Representa una categoría principal (ej: "Energía Indeseable", "Lugares", "Proyectos")
- Una lista puede tener **máximo una** categoría (por diseño, aunque técnicamente podría tener múltiples)
- **Semántica:** Clasificación de alto nivel

**Tipo `'subkey'` (Subtype):**
- Representa un subtipo dentro de una categoría (ej: "Interior", "Exterior")
- Una lista puede tener **máximo una** subclasificación (por diseño)
- **Semántica:** Clasificación de segundo nivel

**Tipo `'tag'`:**
- Representa etiquetas múltiples (ej: "urgente", "revisar", "completo")
- Una lista puede tener **múltiples** tags
- **Semántica:** Clasificación flexible y múltiple

---

## 2. LEGACY vs CANÓNICO

### 2.1. Campos Legacy en `listas_transmutaciones`

**Campos deprecados (pero todavía existen):**
- `category_key` (VARCHAR) - **DEPRECADO** - Reemplazado por `transmutacion_lista_classifications` + `pde_classification_terms` (type='key')
- `subtype_key` (VARCHAR) - **DEPRECADO** - Reemplazado por `transmutacion_lista_classifications` + `pde_classification_terms` (type='subkey')
- `tags` (JSONB array) - **DEPRECADO** - Reemplazado por `transmutacion_lista_classifications` + `pde_classification_terms` (type='tag')

**Estado actual:**
- ✅ Migración `v5.36.0` migró datos existentes a sistema canónico
- ⚠️ **Compatibilidad:** Código mantiene actualización de campos legacy por compatibilidad (ver `pde-transmutaciones-classification-service.js:548-571`)
- ❌ **Sin contrato claro:** No hay documentación de cuándo se eliminarán estos campos

### 2.2. Servicio Legacy: `PdeTransmutationClassificationRepoPg`

**Ubicación:** `src/infra/repos/pde-transmutation-classification-repo-pg.js`

**¿Qué es?** Repositorio que **NO usa** el sistema canónico, sino tablas legacy:
- `pde_transmutation_categories` - **LEGACY** (no es `pde_classification_terms`)
- `pde_transmutation_subtypes` - **LEGACY** (no es `pde_classification_terms`)
- `pde_transmutation_tags` - **LEGACY** (no es `pde_classification_terms`)

**Estado:**
- ❌ **NO SE USA** en código actual de Alquimia
- ⚠️ **Existe pero está desconectado** del flujo principal
- 🔴 **AMBIGÜEDAD:** No está claro si se usa en otro lugar o si es código muerto

---

## 3. CONSUMO REAL DE CLASIFICACIONES

### 3.1. Dónde se Consumen (Alquimia General/Alumno)

**Lecturas:**

1. **`src/infra/repos/pde-transmutation-classification-repo-pg.js:379-425`**
   - Función: `getListWithClassification(listaId)`
   - **Proyección canónica:** JOIN con `transmutacion_lista_classifications` y `pde_classification_terms`
   - Filtra por `ct.status = 'active'`
   - Proyecta: `category_key`, `subtype_key`, `tags[]` (desde términos canónicos)

2. **`src/services/tags-sot-service.js:250-278`**
   - Función: `getListaTags(listaId)`
   - Lee desde `transmutacion_lista_classifications` + `pde_classification_terms` (type='tag')
   - Filtra por `ct.status = 'active'`
   - Devuelve array de valores de tags

3. **Endpoints MASTER:**
   - `/master/api/alquimia-general/lists/:id` - Devuelve lista con clasificaciones
   - `/master/api/classifications/*` - Gestión de clasificaciones

**Escrituras:**

1. **`src/services/pde-transmutaciones-classification-service.js:325-571`**
   - Función: `updateListClassification(listId, classification)`
   - **PASO 1:** Asegura términos en `pde_classification_terms` (idempotente)
   - **PASO 2:** Actualiza `transmutacion_lista_classifications` (elimina y reinserta)
   - **PASO 3:** Mantiene compatibilidad con columnas legacy (`category_key`, `subtype_key`, `tags`)

2. **`src/services/tags-sot-service.js:22-243`**
   - Función: `updateListaTags(listaId, tagValues)`
   - Gestiona **solo tags** (no category/subtype)
   - Detecta cambios (añadir/eliminar)
   - Emite señales: `tag.attached`, `tag.detached`

### 3.2. Dónde NO se Consumen (pero podrían)

**Legacy domains:**
- `transmutaciones-lugares.js`, `transmutaciones-proyectos.js`, `transmutaciones-apadrinados.js`
- Usan tablas separadas, no usan sistema de clasificaciones canónico

**Otros sistemas:**
- `tecnicas-limpieza` tiene su propio sistema de clasificaciones (separado)
- `sponsors` podría tener clasificaciones propias

---

## 4. SI LISTAS = CLASIFICACIONES O NO

### 4.1. Análisis Conceptual

**NO, las listas NO son clasificaciones.**

**Listas:**
- Son **contenedores** de items
- Tienen `tipo` (`recurrente` o `una_vez`) que define comportamiento
- Se agrupan por concepto funcional (ej: "Transmutaciones Energéticas Generales")

**Clasificaciones:**
- Son **etiquetas/metadata** sobre las listas
- Permiten filtrar/buscar listas por categoría, subtipo o tags
- Son **información adicional**, no estructura funcional

**Relación:**
- Una lista **puede tener** clasificaciones (category, subtype, tags)
- Pero la lista **existe independientemente** de sus clasificaciones
- Las clasificaciones son **metadata opcional**

### 4.2. Ejemplo Real

**Lista:** "Transmutaciones Energéticas Generales"
- `tipo: 'recurrente'` - **Funcional** (define comportamiento)
- `category_key: 'Energía Indeseable'` - **Clasificación** (metadata)
- `subtype_key: 'Interior'` - **Clasificación** (metadata)
- `tags: ['urgente', 'revisar']` - **Clasificación** (metadata)

**Conclusión:** Lista y clasificaciones son conceptos separados.

---

## 5. SI TAGS AFECTAN ALGO O SON SOLO METADATA

### 5.1. Análisis de Uso

**Tags son principalmente METADATA (no afectan lógica):**

1. **Display/UI:** Tags se muestran en UI para facilitar búsqueda/filtrado
2. **Señales:** Tags emiten señales (`tag.attached`, `tag.detached`) pero no afectan lógica de negocio
3. **Filtrado:** Tags **podrían** usarse para filtrar listas en UI, pero **no se usa en lógica de limpieza**

**Tags NO afectan:**
- ❌ Cálculo de estados de limpieza
- ❌ Filtrado por nivel
- ❌ Cálculo de `reviewed`/`pending`/`important`
- ❌ Lógica de `remaining`/`completed`
- ❌ Seed de `cleaning_item_state`

**Tags SÍ afectan (solo UI/metadata):**
- ✅ Búsqueda/filtrado en UI de listas
- ✅ Organización visual
- ✅ Señales para automatizaciones futuras (si se implementan)

### 5.2. Señales Emitidas

**Señales canónicas:**
- `tag.attached` - Se emite cuando se asocia un tag a una lista
- `tag.detached` - Se emite cuando se desasocia un tag de una lista

**Consumidores actuales:**
- ⚠️ **Ninguno conocido** - Las señales se emiten pero no hay automatizaciones que las consuman actualmente

---

## 6. QUÉ PARTES DEL SISTEMA LAS USAN (O NO)

### 6.1. Sistemas que SÍ Usan Clasificaciones Canónicas

✅ **Alquimia General:**
- Listado de listas con clasificaciones
- Actualización de clasificaciones (category, subtype, tags)
- Proyección de listas con clasificaciones en endpoints

✅ **Tags SOT Service:**
- Gestión dedicada de tags (añadir/eliminar)
- Emisión de señales

✅ **Endpoints MASTER:**
- `/master/api/alquimia-general/lists/:id` - Lee clasificaciones
- `/master/api/alquimia-general/lists/:id/classifications` - Actualiza clasificaciones
- `/master/api/tags/*` - Gestión de tags

### 6.2. Sistemas que NO Usan Clasificaciones Canónicas

❌ **Alquimia Alumno:**
- No lee ni usa clasificaciones
- Solo usa `nivel` del item para filtrar
- No filtra por category/subtype/tags

❌ **Cleaning Engine:**
- No usa clasificaciones para calcular estados
- Solo usa `nivel`, `frecuencia_dias`, `veces_limpiar`
- No filtra por category/subtype/tags

❌ **Legacy domains:**
- `transmutaciones-lugares`, `transmutaciones-proyectos`, `transmutaciones-apadrinados`
- Usan tablas separadas, no sistema de clasificaciones

❌ **UI de Alumno:**
- No muestra ni usa clasificaciones
- Solo muestra listas e items filtrados por nivel

---

## 7. ESTADO ACTUAL DEL SISTEMA DE CLASIFICACIONES

### 7.1. Migración de Datos

**Migración `v5.36.0` migró datos existentes:**
- ✅ `category_key` → `pde_classification_terms` (type='key')
- ✅ `subtype_key` → `pde_classification_terms` (type='subkey')
- ✅ `tags` (JSONB) → `pde_classification_terms` (type='tag')
- ✅ Asociaciones → `transmutacion_lista_classifications`

**Compatibilidad mantenida:**
- ⚠️ Código actualiza columnas legacy (`category_key`, `subtype_key`, `tags`) por compatibilidad
- ⚠️ **Sin contrato claro** de cuándo se eliminará esta compatibilidad

### 7.2. Helper Canónico

**`ensureClassificationTerm({ type, value }, options)`**
- **Ubicación:** `src/core/classification/ensure-classification-term.js`
- **Propósito:** Único punto de creación/idempotencia de classification terms
- **Validación:** Type debe ser 'tag', 'key', o 'subkey'
- **Idempotencia:** Si existe, devuelve; si no, crea
- **Normalización:** Usa función PostgreSQL `normalize_classification_term()`

### 7.3. Proyección Canónica

**`getListWithClassification(listaId)`**
- **Ubicación:** `src/infra/repos/pde-transmutation-classification-repo-pg.js:379-425`
- **Query:** JOIN `listas_transmutaciones` + `transmutacion_lista_classifications` + `pde_classification_terms`
- **Filtrado:** Solo términos con `status = 'active'`
- **Resultado:** Lista con `category_key`, `subtype_key`, `tags[]` proyectados desde términos canónicos

---

## 8. PROBLEMAS DETECTADOS

### 8.1. Campos Legacy Todavía Existen

**Problema:**
- `listas_transmutaciones` tiene `category_key`, `subtype_key`, `tags` (JSONB)
- Código mantiene compatibilidad actualizando ambos (canónico + legacy)
- **Sin contrato claro** de cuándo se eliminarán

**Impacto:**
- Duplicación de datos
- Posible inconsistencia si se actualiza solo uno
- Confusión sobre cuál es la fuente de verdad

### 8.2. Repositorio Legacy Desconectado

**Problema:**
- `PdeTransmutationClassificationRepoPg` usa tablas legacy (`pde_transmutation_categories`, etc.)
- **No se usa** en código actual de Alquimia
- ⚠️ **AMBIGÜEDAD:** No está claro si se usa en otro lugar o es código muerto

### 8.3. Clasificaciones No Afectan Lógica

**Problema:**
- Clasificaciones son solo metadata
- No se usan para filtrar en lógica de limpieza
- Tags emiten señales pero no hay automatizaciones que las consuman

**Pregunta abierta:**
- ¿Deberían afectar lógica? (ej: filtrar por category en Cleaning Engine)
- ¿O son solo metadata para UI/búsqueda?

### 8.4. Alquimia Alumno No Usa Clasificaciones

**Problema:**
- Alquimia Alumno no lee ni usa clasificaciones
- Solo filtra por `nivel` del item
- **Oportunidad perdida:** Podría filtrar por category/subtype/tags en UI

---

## 9. CONCLUSIONES

### 9.1. Qué es Canónico

✅ **Sistema canónico estable:**
- `pde_classification_terms` - SOT global
- `transmutacion_lista_classifications` - Tabla de relación
- `ensureClassificationTerm()` - Helper idempotente
- Proyección canónica desde términos

### 9.2. Qué es Legacy

❌ **Legacy (deprecado pero existe):**
- `listas_transmutaciones.category_key`, `subtype_key`, `tags` (JSONB)
- `PdeTransmutationClassificationRepoPg` (tablas legacy desconectadas)

### 9.3. Qué Requiere Decisión Futura

⚠️ **Pendiente de decisión:**
1. **Eliminar campos legacy** - Requiere migración y actualización de código
2. **Eliminar repositorio legacy** - Verificar si se usa en otro lugar antes de eliminar
3. **Clasificaciones en lógica** - ¿Deberían afectar filtrado en Cleaning Engine/Alquimia Alumno?
4. **Automatizaciones con tags** - ¿Implementar automatizaciones que consuman señales `tag.attached`/`tag.detached`?

### 9.4. Puntos Sin Contrato

🔴 **Sin contrato formal:**
- Eliminación de campos legacy (sin fecha ni plan)
- Uso de clasificaciones en lógica (sin contrato de cuándo/cómo)
- Consumo de señales de tags (sin automatizaciones implementadas)

---

**Fin del diagnóstico FASE B**
