# Diagnóstico Alquimia: Ensamblaje Unificado v1

**Versión**: 1.0.0  
**Fecha**: 2025-01-27  
**Tipo**: Diagnóstico Estructural

## Ensamblaje Final: "Catálogo → Seed → Estado → Render → Report"

### Flujo Canónico

```
1. CATÁLOGO (Source of Truth)
   ↓
   - listas_transmutaciones (status='active')
   - items_transmutaciones (item_ref, nivel, frecuencia_dias, veces_limpiar)
   ↓
2. SEED (Materialización)
   ↓
   - cleaning_item_state (estados "NUNCA" para items aplicables)
   - Filtrado por nivel_efectivo del alumno
   - Idempotente (ON CONFLICT DO NOTHING)
   ↓
3. ESTADO (Proyección)
   ↓
   - cleaning_item_state (estado actualizado)
   - cleaning_events (event log append-only)
   ↓
4. RENDER (UI)
   ↓
   - Megalist por alumno (agrupada por listas)
   - Estados calculados (never/important/pending/reviewed)
   - Filtrado por nivel (items no aplicables ocultos o marcados)
   ↓
5. REPORT (Analíticas)
   ↓
   - Panel técnico (eventos raw, execution_keys)
   - Panel humano (nombres resueltos, clasificaciones, agrupación)
```

## Legacy Detectado y Plan de Deprecación

### Campos Legacy

| Campo | Tabla | Estado | Plan |
|-------|-------|--------|------|
| `activo` (boolean) | `listas_transmutaciones`, `items_transmutaciones` | ⚠️ Existe pero DEPRECATED | Usar `status='active'|'archived'` |
| `category_key` | `listas_transmutaciones` | ⚠️ Existe pero DEPRECATED | Usar `pde_classification_terms` + `transmutacion_lista_classifications` |
| `subtype_key` | `listas_transmutaciones` | ⚠️ Existe pero DEPRECATED | Usar `pde_classification_terms` + `transmutacion_lista_classifications` |
| `tags` (JSONB) | `listas_transmutaciones` | ⚠️ Existe pero DEPRECATED | Usar `pde_classification_terms` (type='tag') |
| `orden` | `items_transmutaciones` | ⚠️ Existe pero DEPRECATED | Usar `priority` para items |

### Comportamiento Actual

**Repositorio** (`alquimia-catalog-repo-pg.js`):
- Verifica si existe columna `status`
- Si existe: usa `status='active'`
- Si no existe: fallback a `activo=true` (compatibilidad)

**Recomendación**: Migrar datos para que `status` refleje la realidad, luego eliminar `activo`.

### critical_multiplier

**Estado**: ❌ NO EXISTE en schema pero se usa en código

**Decisión**: Usar default 2.0 en código (no requiere migración)

**Ubicaciones**:
- `src/services/alquimia-general-service.js`
- `src/services/alquimia-alumno-service.js`
- `src/core/master/services/alquimia-alumno-megalist-service.js`

## Performance

### Batch Resolution (CRÍTICO)

**Problema Detectado**: Evitar loops N para resolver nombres/clasificaciones

**Solución Implementada**:
- `resolveItemsFromCatalog(itemRefs)`: 1 query batch
- `resolveListasFromCatalog(listaIds)`: 1 query batch
- `resolveListasClassificationsBatch(listaIds)`: 1 query batch

**Prohibido**:
- ❌ `getLastCleanActor()` en loop N items
- ❌ Resolver item por item en historiales/reportes

**Implementado**:
- ✅ Batch queries para items
- ✅ Batch queries para listas
- ✅ Batch queries para clasificaciones

## Puntos Canónicos

✅ **Canónico**:
- Contratos definidos y registrados
- Seed idempotente y masivo
- Endpoints con dos paneles (técnico + humano)
- Batch resolution implementado
- Ordenamiento canónico documentado

⚠️ **Legacy (compatible pero deprecated)**:
- Campos `activo`, `category_key`, `subtype_key`, `tags JSONB`
- Fallback en repos para compatibilidad

❌ **No Implementado (preparado)**:
- UTEs específicas
- Contextos de alquimia
- Paquetes de alquimia

---

**Referencias**:
- Contratos: `src/core/contracts/alquimia-contracts.js`
- Diagnósticos previos: `docs/DIAGNOSTICO_*.md`
