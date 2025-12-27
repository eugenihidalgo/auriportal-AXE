# Diagnóstico: Canvas No Persistido

**Fecha**: 2025-12-18  
**Objetivo**: Diagnosticar por qué el editor muestra "Canvas no persistido; se muestra derivado desde definition_json"

## Resultados del Diagnóstico

### 1. Base de Datos Real Usada por AuriPortal

**Base de datos**: `aurelinportal`  
**Usuario**: `aurelinportal`  
**Host**: `localhost` (::1)  
**Puerto**: `5432`  
**Schema**: `public`

**⚠️ IMPORTANTE**: La base de datos es `aurelinportal`, NO `postgres`. Cualquier inspección manual debe usar esta base.

### 2. Tabla y Schema Correctos

**Tabla**: `public.recorrido_drafts`  
**Schema**: `public`  
**Columnas relevantes**:
- `draft_id` (uuid) - Primary key
- `recorrido_id` (text) - ID del recorrido
- `canvas_json` (jsonb) - Canvas persistido
- `canvas_updated_at` (timestamp) - Última actualización del canvas
- `definition_json` (jsonb) - Definition persistida

### 3. Estado Actual del Canvas

**Recorrido ID**: `limpieza_energetica_diaria`  
**Draft ID**: `93814ba0-72a5-4ad7-ae04-081d9020d138`

**Resultado de verificación**:
```sql
SELECT 
  draft_id,
  recorrido_id,
  canvas_json IS NOT NULL AS has_canvas,
  canvas_updated_at,
  definition_json IS NOT NULL AS has_definition
FROM public.recorrido_drafts
WHERE recorrido_id = 'limpieza_energetica_diaria';
```

**Resultado**:
- ✅ `has_definition`: `true` (la definition está guardada)
- ❌ `has_canvas`: `false` (el canvas NO está guardado)
- `canvas_updated_at`: `NULL`

### 4. CONCLUSIÓN: CASO B

**CASO B**: El canvas NO está guardado en la base de datos.

**Evidencia**:
1. La tabla `recorrido_drafts` existe y es accesible
2. El draft existe para `limpieza_energetica_diaria`
3. `canvas_json` es `NULL` en la base de datos
4. `canvas_updated_at` es `NULL`

**Implicaciones**:
- El autosave NO se ha disparado exitosamente, o
- El autosave está fallando silenciosamente, o
- El endpoint PUT /canvas está devolviendo 200 pero NO está persistiendo realmente

### 5. Análisis del Código

#### Backend (PUT /canvas)

**Endpoint**: `PUT /admin/api/recorridos/:id/canvas`

**Flujo**:
1. Llama a `saveCanvasToDraft(recorridoId, canvas, options)`
2. `saveCanvasToDraft` llama a `draftRepo.updateCanvas(draft.draft_id, normalized, updated_by)`
3. `updateCanvas` ejecuta:
   ```sql
   UPDATE recorrido_drafts
   SET canvas_json = $1,
       canvas_updated_at = CURRENT_TIMESTAMP,
       updated_at = CURRENT_TIMESTAMP,
       updated_by = $2
   WHERE draft_id = $3
   RETURNING *
   ```
4. Siempre devuelve `source: 'persisted'` en la respuesta (línea 1611 de admin-recorridos-api.js)

**Problema potencial**: El endpoint asume que el guardado fue exitoso y siempre devuelve `source: 'persisted'`, pero si el UPDATE falla o no afecta ninguna fila, no se detecta el error.

#### Frontend (Editor)

**Estado del canvas**:
- `canvasViewState.source`: `'persisted'` | `'derived'` | `null`
- `canvasViewState.dirty`: `boolean`
- Se actualiza en GET /canvas (línea 5189)
- Se actualiza en botón "Guardar" manual (línea 7094)
- **NO se actualiza** en autosave (línea 6504)

**Problema**: El autosave no actualiza `canvasViewState.source` después de guardar, por lo que aunque el backend devuelva `source: 'persisted'`, el frontend no lo refleja hasta que se recarga el canvas (GET).

### 6. Siguientes Pasos Recomendados

#### A. Verificar si el autosave se está ejecutando

1. Agregar logs temporales en `autoSaveCanvas()` para verificar:
   - ¿Se está llamando la función?
   - ¿La respuesta del PUT es exitosa?
   - ¿Qué devuelve el backend?

2. Verificar en consola del navegador si hay errores de red o JavaScript.

#### B. Verificar si el UPDATE está funcionando

1. Agregar log temporal en `updateCanvas()` para verificar:
   - ¿Se está ejecutando el UPDATE?
   - ¿`result.rows[0]` existe después del UPDATE?
   - ¿Hay algún error silencioso?

2. Verificar en logs del servidor (PM2) si hay errores de PostgreSQL.

#### C. Proponer Fix de UI (si es necesario)

Si el canvas SÍ se está guardando pero el frontend no lo refleja:

1. **Actualizar `canvasViewState.source` después del autosave**:
   ```javascript
   if (response.ok) {
     const data = await response.json();
     if (data.ok || data.saved) {
       canvasViewState.canvas = data.canvas_normalized || data.canvas;
       canvasViewState.source = 'persisted'; // AÑADIR ESTA LÍNEA
       canvasViewState.dirty = false;
       canvasViewState.lastSavedCanvas = JSON.stringify(data.canvas_normalized || data.canvas, null, 2);
       actualizarCanvasStateBadge();
     }
   }
   ```

2. **Mejorar manejo de errores**:
   - Verificar que `data.saved === true` antes de asumir que se guardó
   - Mostrar error si `data.ok === false` (aunque el guardado sea fail-open)

#### D. Si el canvas NO se está guardando

1. Verificar si hay errores en los logs del servidor
2. Verificar si el draft_id es correcto
3. Verificar permisos de la base de datos
4. Verificar si hay transacciones que no se están commitando

---

## Comandos Útiles

### Ejecutar diagnóstico completo
```bash
cd /var/www/aurelinportal
node scripts/diagnostico-db-canvas.js
```

### Verificar canvas en PostgreSQL (manual)
```bash
psql -U aurelinportal -d aurelinportal -c "
SELECT 
  draft_id,
  recorrido_id,
  canvas_json IS NOT NULL AS has_canvas,
  canvas_updated_at
FROM public.recorrido_drafts
WHERE recorrido_id = 'limpieza_energetica_diaria';
"
```

### Ver logs del servidor
```bash
pm2 logs aurelinportal-prod --lines 100 | grep -i "canvas\|PUT_CANVAS"
```

---

**Estado**: ✅ Diagnóstico completado  
**Conclusión**: CASO B - Canvas no está persistido en la base de datos











