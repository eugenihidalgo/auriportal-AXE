# AXE Stabilization Pack v0.6.9 - Runbook

Este documento describe las mejoras y fixes implementados en AXE v0.6.9 para estabilizar el editor de recorridos.

## Bugs Resueltos

### 1. GET /admin/api/recorridos/:id/canvas devolvía 400 en bucle

**Problema:** El endpoint GET devolvía 400 cuando había errores validando/derivando canvas, causando loops infinitos en el frontend.

**Solución:**
- Implementado **fail-open** estricto: GET nunca devuelve 400/500
- Si hay error derivando/validando, devuelve canvas mínimo válido con `source: "error-fallback"`
- Logs estructurados: `[AXE][GET_CANVAS]` con toda la información relevante
- `getEffectiveCanvasForDraft()` mejorado para no lanzar excepciones, siempre devolver canvas válido

**Cómo probar:**
```bash
# Debe devolver 200 siempre, incluso con canvas corrupto
curl http://localhost:3000/admin/api/recorridos/limpieza_energetica_diaria/canvas

# Verificar logs para detalles
pm2 logs aurelinportal | grep "AXE\[GET_CANVAS\]"
```

### 2. EndNodes inalcanzables en acciones semánticas

**Problema:** Después de `markAsStart`, `insertNodeAfter`, etc., aparecían errores "EndNodes inalcanzables".

**Solución:**
- `repairUnreachableEndNodes()` mejorado: ahora prefiere reconectar desde nodos "leaf" (sin outgoing) si existen
- Asegurado que se llama en TODAS las acciones semánticas: `markAsStart`, `markAsEnd`, `insertNodeAfter`, `duplicateSubgraph`
- Estrategia mejorada de reconexión: busca nodos alcanzables más profundos con edges salientes

**Cómo probar:**
- Abrir editor de recorrido
- Seleccionar un nodo del medio
- Ejecutar "Marcar como Inicio"
- El canvas debe validar correctamente sin errores de end inalcanzables

### 3. Endpoint Preview roto: /api/recorridos/:id/preview 404

**Problema:** El endpoint `/api/recorridos/:id/preview` no existía, causando errores 404.

**Solución:**
- Creado endpoint `GET /admin/api/recorridos/:id/preview`
- Preview harness HTML completo con:
  - Lista navegable de steps
  - Botón "Start Preview" para comenzar desde el entry_step
  - Aplicación de tema (dark-classic por defecto)
  - Integración con endpoint `/preview-step` existente

**Cómo probar:**
```bash
# Abrir en navegador (requiere autenticación admin)
http://localhost:3000/admin/api/recorridos/limpieza_energetica_diaria/preview
```

### 4. Export getScreenTemplateRegistry inexistente

**Problema:** Error reportado sobre export faltante (aunque ya existía).

**Estado:** El export ya existe en `src/core/registry/screen-template-registry.js` línea 601. No se requirieron cambios.

**Verificación:**
```javascript
import { getScreenTemplateRegistry } from '../../registry/screen-template-registry.js';
const registry = getScreenTemplateRegistry();
```

### 5. Endpoint Debug Canvas

**Nuevo:** `GET /admin/api/recorridos/:id/canvas/debug`

Devuelve información útil para diagnosticar problemas:
- `draft_id`: ID del draft actual
- `definition_json_size`: Tamaño en bytes
- `canvas_json_size`: Tamaño en bytes (null si no existe)
- `validation_error`: Primer error de validación (si aplica)
- `has_canvas_json`: Boolean

**Cómo usar:**
```bash
curl http://localhost:3000/admin/api/recorridos/limpieza_energetica_diaria/canvas/debug
```

## Cambios Técnicos

### Archivos Modificados

1. `src/endpoints/admin-recorridos-api.js`
   - `handleGetCanvas()`: Fail-open implementado
   - `handleDebugCanvas()`: Nuevo endpoint debug
   - `handlePreviewRecorrido()`: Nuevo endpoint preview

2. `src/core/canvas/canvas-storage.js`
   - `getEffectiveCanvasForDraft()`: Mejorado con validación permisiva y fail-open

3. `src/core/canvas/canvas-semantic-actions.js`
   - `repairUnreachableEndNodes()`: Estrategia mejorada (prefiere leaf nodes)
   - `markAsStart()`: Ahora llama a `repairUnreachableEndNodes()`
   - `markAsEnd()`: Ahora llama a `repairUnreachableEndNodes()`

## Próximos Pasos (Bugs Pendientes)

Los siguientes bugs aún requieren implementación:

- **Bug 3:** Implementar borrar nodos/pantallas en editor visual
- **Bug 3:** ✅ Implementado borrar nodos/pantallas en editor visual con confirmación (Delete/Backspace o botón)
- **Bug 5:** ✅ Aplicado Theme Resolver en previews del editor y agregado selector de tema (persiste en localStorage)
- **Bug 6:** ✅ Rehecho layout del panel contextual como sticky lateral (no causa scroll-jump)
- **Bug 7:** ⏳ Pendiente: Portar editor de navegación al motor visual

## Notas de Implementación

- Todos los cambios siguen el principio **fail-open**: nunca dejar pantallas en blanco
- Logs estructurados con prefijo `[AXE]` para fácil filtrado
- Validación permisiva en GET (`isPublish: false`) vs estricta en PUT/Publish
- Canvas mínimo válido siempre incluye: start → end con edge directo

