# AUDITORÍA TÉCNICA EXHAUSTIVA – AURIPORTAL

**Fecha:** 2024-12-19  
**Auditor:** Bugbot (Análisis Estático)  
**Alcance:** Editor de Recorridos, Editor de Navegación, Persistencia, Fail-open, Código Muerto

---

## 1. HALLAZGOS CRÍTICOS

### 1.1. **Editor de Recorridos: Orden de Steps No Se Persiste Correctamente**

**Ubicación:** `src/core/html/admin/recorridos/recorridos-editor.html` (líneas 1691, 3857-3905)

**Problema:**
- El campo `order` en steps se modifica en memoria (drag & drop, líneas 1872-1943)
- Se envía al servidor en `guardarDraft()` (línea 3874)
- El servidor normaliza y guarda (líneas 342-357 en `admin-recorridos-api.js`)
- **PERO:** Al recargar, se carga `data.draft?.definition_json || data.published_version?.definition_json` (línea 1691)
- Si hay un draft, se carga el draft. Si no, se carga la versión publicada.
- **RIESGO:** Si el usuario hace cambios en el orden pero no guarda el draft, al recargar puede perder el orden si hay una versión publicada más antigua.

**Evidencia:**
```1691:1691:src/core/html/admin/recorridos/recorridos-editor.html
      editorState.definition = data.draft?.definition_json || data.published_version?.definition_json;
```

**Impacto:** Pérdida de trabajo del usuario, orden incorrecto de steps en producción.

---

### 1.2. **Editor de Navegación: Conflicto de Routing API vs HTML**

**Ubicación:** `src/router.js` (líneas 414-423, 496-505, 805-814)

**Problema:**
- El router intenta primero `admin-navigation-pages.js` (HTML)
- Si retorna `null`, usa `admin-navigation-api.js` (JSON)
- **PERO:** `admin-navigation-pages.js` solo retorna `null` si detecta rutas API (línea 140-144)
- La detección usa regex: `/\/admin\/navigation\/[^\/]+\/(draft|publish|validate|published|export|import)$/`
- **RIESGO:** Si un usuario navega a `/admin/navigation/algo/draft` desde el navegador (sin headers `Accept: application/json`), puede recibir JSON en lugar de HTML, mostrando JSON crudo en pantalla.

**Evidencia:**
```414:423:src/router.js
      if (path.startsWith("/admin/navigation")) {
        const adminNavigationPagesHandler = (await import("./endpoints/admin-navigation-pages.js")).default;
        const pagesResponse = await adminNavigationPagesHandler(request, env, ctx);
        if (pagesResponse !== null) {
          return pagesResponse;
        }
        // Si pages handler retorna null, usar API handler
        const adminNavigationApiHandler = (await import("./endpoints/admin-navigation-api.js")).default;
        return adminNavigationApiHandler(request, env, ctx);
      }
```

**Impacto:** UX rota, JSON visible en navegador, confusión del usuario.

---

### 1.3. **Editor de Recorridos: Autosave Puede Guardar Estado Inválido**

**Ubicación:** `src/core/html/admin/recorridos/recorridos-editor.html` (líneas 1549-1568, 3829-3946)

**Problema:**
- `tryScheduleSave()` verifica `editorState.valid` antes de guardar (línea 1557)
- **PERO:** `editorState.valid` se actualiza en `updateValidationState()` que NO se llama después de cada cambio
- Cambios como drag & drop (línea 1928) solo llaman `markDirty()` y `actualizarUI()`
- `actualizarUI()` NO llama a `updateValidationState()`
- **RIESGO:** El autosave puede dispararse con `editorState.valid = true` pero con datos que ya no son válidos (ej: step eliminado pero edges aún lo referencian).

**Evidencia:**
```1549:1568:src/core/html/admin/recorridos/recorridos-editor.html
  function tryScheduleSave() {
    // Cancelar timeout anterior si existe
    if (editorState.saveTimeout) {
      clearTimeout(editorState.saveTimeout);
      editorState.saveTimeout = null;
    }
    
    // Solo guardar si es válido
    if (!editorState.valid) {
      console.log('Draft no válido, no se guarda:', editorState.validationErrors);
      return false;
    }
    
    // Programar guardado con debounce de 2 segundos
    editorState.saveTimeout = setTimeout(() => {
      guardarDraft();
    }, 2000);
    
    return true;
  }
```

**Impacto:** Drafts inválidos guardados, errores al publicar, datos inconsistentes.

---

### 1.4. **Editor de Recorridos: Normalización Puede Perder Campos `order`**

**Ubicación:** `src/endpoints/admin-recorridos-api.js` (líneas 342-357)

**Problema:**
- El servidor normaliza la definición con `normalizeRecorridoDefinition()` (línea 342)
- Se pasan opciones `removeInvalidEdges: true, cleanEmptyProps: true`
- **RIESGO:** Si `normalizeRecorridoDefinition()` no preserva explícitamente el campo `order`, puede perderse durante la normalización.
- Los logs muestran que se recibe `order` antes de normalizar (líneas 329-339) y después (líneas 347-357), pero no hay garantía de que se preserve.

**Evidencia:**
```342:357:src/endpoints/admin-recorridos-api.js
    // BLINDAJE v2: Normalizar definición antes de guardar
    const normalizedDefinition = normalizeRecorridoDefinition(definition_json, {
      removeInvalidEdges: true,
      cleanEmptyProps: true
    });

    // LOG TEMPORAL: Mostrar order guardado después de normalizar
    const stepsNormalized = normalizedDefinition?.steps || {};
    const orderSaved = Object.keys(stepsNormalized).reduce((acc, stepId) => {
      const step = stepsNormalized[stepId];
      acc[stepId] = typeof step?.order === 'number' ? step.order : 'undefined';
      return acc;
    }, {});
    logInfo('RecorridosAPI', 'Order guardado en draft (después de normalizar)', {
      recorrido_id: recorridoId,
      steps_order: orderSaved
    });
```

**Impacto:** Pérdida de orden de steps, necesidad de reordenar manualmente.

---

## 2. HALLAZGOS IMPORTANTES

### 2.1. **Editor de Navegación: Carga de Draft vs Published Inconsistente**

**Ubicación:** `src/core/html/admin/navigation/navigation-editor.html` (líneas 356-399)

**Problema:**
- `cargarNavegacion()` intenta cargar draft primero (líneas 362-372)
- Si no hay draft, carga published (líneas 374-388)
- **PERO:** Si hay draft, NO se muestra información de la versión publicada (nombre, versión, etc.)
- El usuario no sabe si está editando sobre un draft nuevo o sobre una copia de la versión publicada.

**Evidencia:**
```356:399:src/core/html/admin/navigation/navigation-editor.html
  // Cargar navegación
  async function cargarNavegacion() {
    try {
      const encodedId = encodeURIComponent(editorState.navigationId);
      
      // Intentar cargar draft primero
      let response = await fetch(`/admin/navigation/${encodedId}/draft`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.ok && data.data && data.data.draft_json) {
          editorState.definition = data.data.draft_json;
        }
      }
      
      // Si no hay draft, intentar obtener published para referencia
      if (!editorState.definition) {
        response = await fetch(`/admin/navigation/${encodedId}/published`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.ok && data.data && data.data.definition_json) {
            // Copiar como draft
            editorState.definition = JSON.parse(JSON.stringify(data.data.definition_json));
          }
        }
      }
```

**Impacto:** Confusión del usuario, no sabe qué versión está editando.

---

### 2.2. **Editor de Recorridos: Estado `dirty` No Se Resetea Correctamente**

**Ubicación:** `src/core/html/admin/recorridos/recorridos-editor.html` (líneas 3898, 3903-3905)

**Problema:**
- `guardarDraft()` marca `editorState.dirty = false` después de guardar exitosamente (línea 3898)
- **PERO:** También actualiza `editorState.definition` con la versión normalizada del servidor (líneas 3903-3905)
- Si la normalización cambia algo (ej: orden de campos en JSON), el estado local puede diferir del servidor
- **RIESGO:** El usuario puede ver cambios que no hizo, o el estado puede quedar inconsistente.

**Evidencia:**
```3898:3905:src/core/html/admin/recorridos/recorridos-editor.html
      // Actualizar estado
      editorState.dirty = false;
      editorState.lastSavedAt = new Date();
      editorState.validationErrors = [];
      
      // Actualizar definition con la versión normalizada del servidor
      if (data.draft?.definition_json) {
        editorState.definition = data.draft.definition_json;
      }
```

**Impacto:** Estado inconsistente, cambios inesperados en la UI.

---

### 2.3. **Editor de Navegación: Publicar No Valida Antes de Guardar Draft**

**Ubicación:** `src/core/html/admin/navigation/navigation-editor.html` (líneas 830-868)

**Problema:**
- `publicarNavegacion()` llama a `guardarNavegacion()` primero (línea 838)
- **PERO:** `guardarNavegacion()` NO valida antes de guardar (líneas 722-763)
- Solo envía el draft al servidor sin validación local
- El servidor valida al publicar, pero si el draft es inválido, el usuario ya lo guardó.

**Evidencia:**
```830:868:src/core/html/admin/navigation/navigation-editor.html
  // Publicar navegación
  async function publicarNavegacion() {
    if (!editorState.definition || !editorState.navigationId) return;
    
    if (!confirm('¿Publicar esta versión de la navegación? Esto creará una nueva versión publicada.')) {
      return;
    }
    
    // Primero guardar el draft
    await guardarNavegacion();
    
    try {
      const encodedId = encodeURIComponent(editorState.navigationId);
      const response = await fetch(`/admin/navigation/${encodedId}/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
```

**Impacto:** Drafts inválidos guardados, tiempo perdido del usuario.

---

### 2.4. **Editor de Recorridos: Drag & Drop No Persiste Inmediatamente**

**Ubicación:** `src/core/html/admin/recorridos/recorridos-editor.html` (líneas 1872-1943)

**Problema:**
- `handleDrop()` recalcula el orden y marca `dirty` (línea 1928)
- Llama a `actualizarUI()` pero NO llama a `tryScheduleSave()` directamente
- **PERO:** `actualizarUI()` NO programa un guardado
- El guardado solo ocurre si hay otro cambio que dispare `tryScheduleSave()`
- **RIESGO:** Si el usuario reordena steps y cierra el navegador, el orden se pierde.

**Evidencia:**
```1927:1932:src/core/html/admin/recorridos/recorridos-editor.html
      // Marcar como dirty
      markDirty();
      
      // Re-renderizar
      actualizarUI();
```

**Impacto:** Pérdida de trabajo, orden incorrecto.

---

### 2.5. **Router: Prioridad de Rutas Puede Causar Confusión**

**Ubicación:** `src/router.js` (líneas 816-826)

**Problema:**
- Las rutas API (`/admin/api/recorridos`) se manejan ANTES que las rutas UI (`/admin/recorridos`)
- **PERO:** Si hay un error en la ruta API (ej: 404), el router continúa y puede llegar a la ruta UI
- Esto puede causar que una petición API errónea devuelva HTML en lugar de JSON.

**Evidencia:**
```816:826:src/router.js
  // Endpoints API de Recorridos (Admin)
  if (path.startsWith("/admin/api/recorridos")) {
    const adminRecorridosApiHandler = (await import("./endpoints/admin-recorridos-api.js")).default;
    return adminRecorridosApiHandler(request, env, ctx);
  }

  // Endpoints UI de Recorridos (Admin)
  if (path.startsWith("/admin/recorridos")) {
    const adminRecorridosHandler = (await import("./endpoints/admin-recorridos.js")).default;
    return adminRecorridosHandler(request, env, ctx);
  }
```

**Impacto:** Respuestas inconsistentes, errores confusos.

---

## 3. HALLAZGOS MENORES

### 3.1. **Editor de Recorridos: Logs Temporales No Removidos**

**Ubicación:** `src/core/html/admin/recorridos/recorridos-editor.html` (líneas 1693-1702, 3857-3864, 3888-3895)  
**Ubicación:** `src/endpoints/admin-recorridos-api.js` (líneas 329-339, 347-357, 396-407)

**Problema:**
- Hay múltiples `console.log` y `logInfo` marcados como "LOG TEMPORAL" que siguen en el código
- Estos logs pueden impactar performance y llenar los logs del servidor.

**Impacto:** Logs innecesarios, posible impacto en performance.

---

### 3.2. **Editor de Navegación: Falta Indicador de Versión Publicada**

**Ubicación:** `src/core/html/admin/navigation/navigation-editor.html` (líneas 402-429)

**Problema:**
- `actualizarUI()` actualiza el nombre pero NO muestra la versión publicada actual
- El usuario no sabe qué versión está editando o si hay una versión publicada.

**Impacto:** UX confusa, falta de contexto.

---

### 3.3. **Editor de Recorridos: Validación No Se Actualiza en Tiempo Real**

**Ubicación:** `src/core/html/admin/recorridos/recorridos-editor.html` (líneas 1549-1568)

**Problema:**
- `tryScheduleSave()` verifica `editorState.valid` pero este solo se actualiza en `updateValidationState()`
- `updateValidationState()` NO se llama después de cada cambio
- El usuario puede ver un estado "válido" cuando en realidad hay errores.

**Impacto:** UX confusa, validación desactualizada.

---

### 3.4. **Editor de Navegación: No Hay Confirmación al Eliminar Nodo**

**Ubicación:** `src/core/html/admin/navigation/navigation-editor.html` (líneas 696-719)

**Problema:**
- `eliminarNodo()` tiene `confirm()` (línea 697)
- **PERO:** No muestra información sobre qué edges se eliminarán o qué impacto tendrá.

**Impacto:** UX mejorable, falta de información.

---

## 4. COSAS BIEN HECHAS

### 4.1. **Editor de Recorridos: Validación Antes de Guardar Draft**

**Ubicación:** `src/core/html/admin/recorridos/recorridos-editor.html` (líneas 3829-3846)

**Bien hecho:**
- `guardarDraft()` valida con `validateDefinitionForDraft()` ANTES de enviar al servidor
- Rechaza drafts inválidos con mensajes claros
- Evita guardar basura en la base de datos

---

### 4.2. **Editor de Recorridos: Normalización en Servidor**

**Ubicación:** `src/endpoints/admin-recorridos-api.js` (líneas 314-327, 342-357)

**Bien hecho:**
- El servidor valida Y normaliza antes de guardar
- Elimina campos inválidos y limpia la estructura
- Garantiza consistencia en la base de datos

---

### 4.3. **Editor de Navegación: Separación Clara API vs Pages**

**Ubicación:** `src/endpoints/admin-navigation-pages.js` (líneas 138-145)

**Bien hecho:**
- `admin-navigation-pages.js` detecta rutas API y retorna `null` para delegar
- Separación clara de responsabilidades
- Router maneja correctamente la prioridad

---

### 4.4. **Editor de Recorridos: Bloqueo de Guardados Concurrentes**

**Ubicación:** `src/core/html/admin/recorridos/recorridos-editor.html` (líneas 3848-3852)

**Bien hecho:**
- `guardarDraft()` verifica `editorState.isSaving` para evitar guardados concurrentes
- Previene race conditions y estados inconsistentes

---

### 4.5. **Editor de Navegación: Manejo de Errores Estructurado**

**Ubicación:** `src/endpoints/admin-navigation-api.js` (líneas 59-71)

**Bien hecho:**
- Respuestas de error consistentes con estructura `{ ok: false, error: {...} }`
- Facilita debugging y manejo en frontend

---

## 5. MAPA DE RIESGO

### 🔴 **ALTA PRIORIDAD - Tocar PRIMERO**

1. **Editor de Recorridos: Orden de Steps** (1.1)
   - **Por qué:** Pérdida de trabajo del usuario, datos incorrectos en producción
   - **Acción:** Verificar que `order` se persiste y se carga correctamente
   - **Verificar:** `normalizeRecorridoDefinition()` preserva `order`

2. **Editor de Navegación: Routing API vs HTML** (1.2)
   - **Por qué:** UX rota, JSON visible en navegador
   - **Acción:** Verificar headers `Accept` antes de servir JSON
   - **Verificar:** `admin-navigation-api.js` verifica `Accept: application/json`

3. **Editor de Recorridos: Autosave Inválido** (1.3)
   - **Por qué:** Drafts inválidos guardados, errores al publicar
   - **Acción:** Llamar `updateValidationState()` después de cada cambio
   - **Verificar:** `actualizarUI()` actualiza validación

---

### 🟡 **MEDIA PRIORIDAD - Tocar DESPUÉS**

4. **Editor de Navegación: Carga Draft vs Published** (2.1)
   - **Por qué:** Confusión del usuario
   - **Acción:** Mostrar información de versión publicada en UI

5. **Editor de Recorridos: Estado Dirty** (2.2)
   - **Por qué:** Estado inconsistente
   - **Acción:** Verificar que normalización no cambia datos del usuario

6. **Editor de Navegación: Validación al Publicar** (2.3)
   - **Por qué:** Drafts inválidos guardados
   - **Acción:** Validar antes de guardar draft en `guardarNavegacion()`

---

### 🟢 **BAJA PRIORIDAD - Tocar ÚLTIMO**

7. **Logs Temporales** (3.1)
   - **Por qué:** Limpieza de código
   - **Acción:** Remover logs marcados como temporales

8. **Indicadores de Versión** (3.2, 3.3)
   - **Por qué:** Mejora de UX
   - **Acción:** Añadir indicadores visuales de versión

---

### ⚠️ **NO TOCAR AÚN**

- **Sistema de Validación:** Funciona correctamente, solo necesita actualización en tiempo real
- **Sistema de Normalización:** Funciona correctamente, solo verificar preservación de `order`
- **Sistema de Routing:** Funciona correctamente, solo necesita verificación de headers

---

## RESUMEN EJECUTIVO

**Total de Hallazgos:**
- **Críticos:** 4
- **Importantes:** 5
- **Menores:** 4
- **Bien Hechos:** 5

**Riesgos Principales:**
1. Pérdida de orden de steps en recorridos
2. JSON visible en navegador para navegación
3. Autosave guardando estados inválidos
4. Normalización perdiendo campos `order`

**Recomendación Inmediata:**
1. Verificar preservación de `order` en normalización
2. Añadir verificación de headers `Accept` en API de navegación
3. Actualizar validación en tiempo real en editor de recorridos
4. Añadir `tryScheduleSave()` después de drag & drop

---

**Fin del Informe**





