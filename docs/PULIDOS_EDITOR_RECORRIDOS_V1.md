# Pulidos Mínimos del Editor de Recorridos v1

**Fecha:** 2025-12-17  
**Estado:** IDENTIFICADOS (para futuros sprints)

---

## 🎯 Contexto

Tras implementar el flujo canónico "Limpieza Energética Diaria v1", se identificaron los siguientes gaps del Editor de Recorridos que dificultan el authoring diario.

**IMPORTANTE:** Estos NO son bugs ni cambios urgentes. Son mejoras de calidad de vida para futuros sprints.

---

## 📋 Gaps Identificados

### 1. 🔀 Soporte para Branching por `tipo_limpieza`

**Problema:**  
El flujo de limpieza tiene diferentes comportamientos según el `tipo_limpieza` (rápida, básica, profunda, maestro), pero el editor no muestra visualmente cómo el tipo afecta a los steps posteriores.

**Estado actual:**  
- La lógica de "límites por modo" está hardcodeada en los handlers
- El editor no indica qué steps usan handlers específicos
- No hay forma de previsualizar el comportamiento dinámico

**Mejora propuesta:**  
1. Añadir campo `ui_metadata.dynamic_by` en steps:
   ```json
   {
     "preparacion_seleccion": {
       "ui_metadata": {
         "dynamic_by": "tipo_limpieza",
         "mode_limits": {
           "rapida": { "recommended": 2, "max": 3 },
           "basica": { "recommended": 4, "max": 6 },
           "profunda": { "recommended": 6, "max": 8 },
           "maestro": { "recommended": 8, "max": 10 }
         }
       }
     }
   }
   ```
2. Mostrar indicador visual en el editor: "⚡ Dinámico por: tipo_limpieza"

**Prioridad:** Media  
**Esfuerzo:** 2-3 días

---

### 2. 📊 Campos Declarativos para Límites por Modo

**Problema:**  
Los límites de items recomendados/máximos por modo están hardcodeados en `selection-handler.js`, no en la definición declarativa del recorrido.

**Estado actual:**
```javascript
// En selection-handler.js
const limits = {
  rapida: 2,
  basica: 4,
  profunda: 6,
  maestro: 8
};
```

**Mejora propuesta:**  
1. Mover límites a la definición del recorrido:
   ```json
   {
     "preparacion_seleccion": {
       "props": {
         "mode_config": {
           "rapida": { "limit": 2 },
           "basica": { "limit": 4 },
           "profunda": { "limit": 6 },
           "maestro": { "limit": 8 }
         }
       }
     }
   }
   ```
2. El handler lee de props en lugar de tener hardcoded
3. El editor muestra selector de límites por modo

**Prioridad:** Media  
**Esfuerzo:** 1-2 días

---

### 3. 👁️ Previsualización de Pantallas Plegables y Timer

**Problema:**  
No hay forma de previsualizar cómo se verá una pantalla de tipo `screen_toggle_resources` o `screen_practice_timer` con datos reales.

**Estado actual:**  
- El editor muestra los campos JSON
- No hay preview del resultado renderizado
- Los handlers enriquecen datos en runtime, no visibles en editor

**Mejora propuesta:**  
1. Añadir botón "Preview" en cada step
2. Llamar a `buildRenderSpec()` con datos de prueba
3. Mostrar en modal o panel lateral
4. Permitir seleccionar "modo simulado" (rápida/básica/profunda/maestro)

**Prioridad:** Alta  
**Esfuerzo:** 3-4 días

---

### 4. ⚠️ Vista de `publish_required` Clara

**Problema:**  
El editor no muestra claramente qué campos son obligatorios para publicar vs opcionales para draft.

**Estado actual:**  
- El validador conoce `publish_required` de cada template
- El editor no lo muestra visualmente
- El admin descubre errores al intentar publicar

**Mejora propuesta:**  
1. Marcar campos `publish_required` con asterisco rojo: `* Obligatorio para publicar`
2. Mostrar estado de completitud:
   - 🟢 Listo para publicar
   - 🟡 Draft válido, faltan campos para publish
   - 🔴 Draft inválido
3. Tooltip con mensaje específico al hover

**Prioridad:** Alta  
**Esfuerzo:** 1 día

---

### 5. 🔍 Detección de Orphans/Ciclos del Flujo

**Problema:**  
El validador no detecta steps "huérfanos" (sin edges entrantes excepto entry_step_id) ni ciclos infinitos.

**Estado actual:**  
- Se valida que `from_step_id` y `to_step_id` existan
- No se valida que todos los steps sean alcanzables
- No se detectan ciclos

**Mejora propuesta:**  
1. Añadir validación de conectividad:
   ```javascript
   function validateConnectivity(definition) {
     const reachable = new Set([definition.entry_step_id]);
     // BFS desde entry_step_id
     // Advertir si hay steps no alcanzables
   }
   ```
2. Añadir detección de ciclos:
   ```javascript
   function detectCycles(definition) {
     // DFS con marcado de estados
     // Error si hay ciclo sin salida
   }
   ```
3. Mostrar warnings en el editor:
   - "⚠️ Step 'xxx' no es alcanzable desde el inicio"
   - "⚠️ Posible ciclo detectado: A → B → A"

**Prioridad:** Media  
**Esfuerzo:** 2 días

---

### 6. 📦 Export/Import Estable

**Problema:**  
El export/import actual es básico y no maneja bien casos edge.

**Estado actual:**  
- Export incluye draft y última versión publicada
- Import usa estrategia "safe" (crea nuevo draft)
- No hay validación de versión de schema
- No hay merge de definiciones

**Mejora propuesta:**  
1. Añadir campo `schema_version` en bundle
2. Validar compatibilidad al importar
3. Opción de merge selectivo:
   - "Reemplazar todo"
   - "Solo steps nuevos"
   - "Merge edges"
4. Preview de cambios antes de importar

**Prioridad:** Baja  
**Esfuerzo:** 2-3 días

---

### 7. 🏷️ Indicador de Handlers Especiales

**Problema:**  
El editor no muestra qué steps usan handlers específicos (selection, timer, limpieza).

**Estado actual:**  
- Los handlers se registran por `step_id` en el runtime
- El editor no conoce esta asociación
- El admin no sabe qué steps tienen lógica especial

**Mejora propuesta:**  
1. Añadir metadata en el registry de handlers:
   ```javascript
   export const HANDLER_INFO = {
     selection_handler_v1: {
       step_ids: ['preparacion_seleccion', 'protecciones_energeticas', 'post_limpieza_seleccion'],
       label: 'Selección de Items',
       icon: '☑️',
       description: 'Carga items de catálogos PDE'
     }
   };
   ```
2. Mostrar badge en el editor: "☑️ selection_handler_v1"
3. Tooltip con descripción del handler

**Prioridad:** Media  
**Esfuerzo:** 1 día

---

## 📊 Resumen de Prioridades

| # | Gap | Prioridad | Esfuerzo | Impacto |
|---|-----|-----------|----------|---------|
| 4 | Vista publish_required clara | Alta | 1 día | Alto |
| 3 | Preview de pantallas | Alta | 3-4 días | Alto |
| 7 | Indicador de handlers | Media | 1 día | Medio |
| 1 | Branching visual | Media | 2-3 días | Medio |
| 2 | Límites declarativos | Media | 1-2 días | Medio |
| 5 | Detección orphans/ciclos | Media | 2 días | Medio |
| 6 | Export/Import mejorado | Baja | 2-3 días | Bajo |

---

## 🎯 Recomendación de Orden

**Sprint inmediato (si se decide abordar):**
1. Vista publish_required clara (1 día)
2. Indicador de handlers (1 día)

**Sprint siguiente:**
3. Preview de pantallas (3-4 días)
4. Detección orphans/ciclos (2 días)

**Sprint futuro:**
5. Branching visual + Límites declarativos (3-4 días)
6. Export/Import mejorado (2-3 días)

---

## 🔒 Restricciones

- **NO** refactorizar el editor existente
- **NO** romper UIs admin actuales
- **NO** cambiar contratos de handlers
- **SÍ** añadir de forma aditiva y compatible
- **SÍ** mantener fail-open en todas las validaciones nuevas

---

**Documento generado:** 2025-12-17  
**Autor:** Sistema AuriPortal




