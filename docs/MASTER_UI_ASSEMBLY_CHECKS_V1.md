# Master UI Assembly Checks v1

## Estado
EN EXPANSIÓN · CANÓNICO

## Objetivo

Declarar el marco canónico para la familia de checks "UI Projection Integrity Checks" que verifican el cumplimiento del modelo PDUI (Projection-Driven UI) en AuriPortal.

---

## Familia de Checks: UI Projection Integrity Checks

### Propósito

Detectar violaciones del modelo PDUI mediante análisis estático y verificación de contratos en tiempo de desarrollo.

### Objetivos Específicos

Los checks deben detectar:

1. **Cálculos de estado en frontend**
   - Funciones que calculan estados visuales
   - Comparaciones de fechas para decidir estados
   - Cálculos de días o progresos
   - Inferencias de columnas desde datos raw

2. **Comparaciones temporales en frontend**
   - Comparación de `last_cleaned_at` con `now()`
   - Cálculo de `days_since_last_clean`
   - Comparación de fechas para decidir en qué columna va un item

3. **Combinaciones de capas en frontend**
   - Combinación de `shared` + `pde` para crear estados
   - Agrupación por campos legacy (`student.state`, `visual_state`) si existe `state_by_view_layer`
   - Reutilización de estados previos para decisiones

4. **Agrupaciones no derivadas de proyección**
   - Agrupación de items por estado calculado localmente
   - Decisión de columna sin usar `state_by_view_layer[view_layer]`
   - Fallbacks a campos legacy sin warning DEPRECATED

---

## Estado Actual

**Estado:** EN EXPANSIÓN

### Checks Implementados

- `check:view-authority` (scripts/check-view-authority.js)
  - Detecta violaciones básicas de View Authority
  - Escanea frontend y backend para cálculos de estado
  - Verifica presencia de `state_by_view_layer` en respuestas

### Checks Pendientes

Los siguientes checks están declarados pero aún no implementados:

1. **check:ui-projection-integrity** (futuro)
   - Análisis profundo de violaciones PDUI
   - Detección de comparaciones temporales
   - Detección de combinaciones de capas
   - Verificación de agrupaciones no derivadas

2. **check:frontend-state-calculation** (futuro)
   - Detección específica de cálculos de estado en frontend
   - Análisis de funciones que calculan estados visuales
   - Verificación de inferencias de columnas

3. **check:backend-projection-completeness** (futuro)
   - Verificación de que endpoints devuelven proyecciones completas
   - Validación de presencia de `context` en respuestas
   - Verificación de parámetros explícitos en GET

---

## Relación con PDUI

Este sistema de checks es la implementación técnica del modelo PDUI declarado en:

- `docs/UI_PROJECTION_MODEL_V1.md` (documento canónico)

Los checks garantizan que:

1. El backend es la única autoridad de estado
2. El frontend solo consume proyecciones
3. No hay cálculos de estado en frontend
4. No hay inferencias ni combinaciones de capas

---

## Integración con Assembly Check System

Los checks de UI Projection Integrity se integran con el sistema general de Assembly Checks:

- `npm run check:view-authority` (implementado)
- `npm run check:master-constitution` (incluye check:view-authority)
- Futuros checks se añadirán al pipeline

---

## Cómo Arreglar Violaciones

Si un check detecta una violación:

1. **Identificar la violación**
   - Revisar el mensaje del check
   - Localizar el archivo y línea indicados

2. **Refactorizar según PDUI**
   - Mover cálculo de estado al backend
   - Añadir parámetros explícitos al GET
   - Consumir `state_by_view_layer[view_layer]` en frontend
   - Eliminar cálculos temporales en frontend

3. **Verificar**
   - Ejecutar el check nuevamente
   - Confirmar que la violación desapareció

---

## Versionado

Versión: v1
Estado: EN EXPANSIÓN
Fecha de declaración: 2026-01

---

## Referencias

- `docs/UI_PROJECTION_MODEL_V1.md` - Modelo PDUI canónico
- `docs/CONSTITUTION_VIEW_AUTHORITY_V1.md` - Regla de Autoridad de Vista
- `scripts/check-view-authority.js` - Check implementado
