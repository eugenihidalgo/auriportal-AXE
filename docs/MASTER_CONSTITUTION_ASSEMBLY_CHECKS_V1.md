# MASTER CONSTITUTION ASSEMBLY CHECKS v1

## Objetivo

Este documento describe los assembly checks automáticos que verifican el cumplimiento de las reglas constitucionales de MASTER, específicamente la **Regla Constitucional de Autoridad de Vista**.

## Checks Disponibles

### `check:view-authority`

**Comando**: `npm run check:view-authority`

**Script**: `scripts/check-view-authority.js`

**Qué detecta**:

#### A) Frontend (`public/js/master/**`)

1. **Cálculo de estados prohibido**:
   - Uso de `calculateItemState()` (prohibido)
   - Cálculo de `days_since_last_clean` en frontend
   - Uso directo de `shared_last_cleaned_at` o `pde_last_cleaned_at` para decidir estado
   - Uso directo de `item.state` o `item.visual_state` sin `state_by_view_layer`

2. **Agrupación por campos legacy**:
   - Agrupación por `.state` directamente sin usar `state_by_view_layer[view_layer]`

#### B) Backend (`src/**/master/**`)

1. **GET sin view_layer**:
   - `GET /master/api/alquimia-alumno/megalist` debe requerir y validar `view_layer`

2. **Respuesta sin state_by_view_layer**:
   - Servicios megalist deben calcular `state_by_view_layer` usando `computeVisualState`

**Salida**:
- `✅ OK`: No se encontraron violaciones
- `❌ FAIL`: Lista de violaciones con archivo:línea y contexto
- `⚠️ WARN`: Advertencias (no bloquean, pero deben revisarse)

### `check:master-constitution`

**Comando**: `npm run check:master-constitution`

**Alias**: Ejecuta `check:view-authority` (puede expandirse en el futuro)

## Integración en Pipeline

### Local

```bash
npm run check:view-authority
```

### CI/CD

El check se ejecuta como parte de `check:all`:

```bash
npm run check:all
```

## Qué Significa un FAIL

Un FAIL indica que se detectó una **violación constitucional** de la Regla de Autoridad de Vista:

1. **Backend calcula estado**: El backend es la única autoridad de estado
2. **Frontend consume proyecciones**: El frontend NO calcula estados
3. **view_layer explícita**: Todo cálculo de estado usa `view_layer` explícita
4. **state_by_view_layer obligatorio**: Respuestas que calculan estado incluyen `state_by_view_layer`

### Cómo Arreglar

1. **Si es frontend**:
   - Eliminar cálculos de estado
   - Consumir `state_by_view_layer[view_layer]` del backend
   - Agrupar items desde `state_by_view_layer[view_layer]`

2. **Si es backend**:
   - Añadir validación de `view_layer` en GET
   - Calcular `state_by_view_layer` usando `computeVisualState`
   - Incluir `context.view_layer` en respuesta

## Referencias

- `docs/CONSTITUTION_VIEW_AUTHORITY_V1.md` - Regla constitucional completa
- `docs/REFACTOR_ALQUIMIA_ALUMNO_AUTORIDAD_VISTA_V1.md` - Refactor implementado
- `scripts/check-view-authority.js` - Código del check
