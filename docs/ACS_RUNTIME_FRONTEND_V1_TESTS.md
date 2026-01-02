# Checklist de Pruebas ACS-R v1

**Versión:** 1.0.0  
**Fecha:** 2025-01-XX

---

## CASOS OBLIGATORIOS

### 1. SyntaxError deliberado → debe bloquear UI

**Objetivo:** Verificar que un SyntaxError en JavaScript bloquea la UI y muestra panel de diagnóstico.

**Pasos:**
1. Abrir una pantalla admin con ACS-R integrado (ej: `/admin/system/assembly`)
2. Abrir DevTools → Console
3. Inyectar un SyntaxError deliberado:
   ```javascript
   // En la consola del navegador
   eval('function test() { var x = ; }'); // SyntaxError
   ```
4. O modificar temporalmente un script JS cargado para introducir un error de sintaxis

**Resultado esperado:**
- ✅ Panel de diagnóstico aparece bloqueando la UI
- ✅ Error tipo `SYNTAX_ERROR` visible
- ✅ Stacktrace limitado mostrado
- ✅ Botones "Copiar diagnóstico" y "Hard Refresh" funcionan

**Nota:** Si el error se captura antes de que el guard esté listo, puede no aparecer el panel. En ese caso, introducir el error después de que la página cargue completamente.

---

### 2. Missing handler → panel indica MissingHandler

**Objetivo:** Verificar que handlers faltantes se detectan y reportan.

**Pasos:**
1. Abrir una pantalla admin con contrato ACS-R que declare `required_globals`
2. Abrir DevTools → Console
3. Eliminar temporalmente una función requerida:
   ```javascript
   // Si el contrato requiere 'cerrarModalEditarProyecto'
   delete window.cerrarModalEditarProyecto;
   ```
4. Recargar la página o forzar validación:
   ```javascript
   window.acsRuntimeGuard.runRuntimeChecks();
   ```

**Resultado esperado:**
- ✅ Panel de diagnóstico aparece (si `strict_mode: true`)
- ✅ Error tipo `MISSING_HANDLER` visible
- ✅ Nombre del handler faltante mostrado
- ✅ UI bloqueada si `strict_mode: true`

---

### 3. Endpoint 500 → panel lo detecta

**Objetivo:** Verificar que endpoints críticos que devuelven 500 se detectan.

**Pasos:**
1. Abrir una pantalla admin con contrato ACS-R que declare `required_endpoints`
2. Simular un endpoint que devuelve 500 (modificar temporalmente el handler del endpoint)
3. Recargar la página

**Resultado esperado:**
- ✅ Error tipo `ENDPOINT_ERROR` visible en panel (si es crítico)
- ✅ Status code 500 mostrado
- ✅ Endpoint afectado identificado
- ⚠️ UI puede no bloquearse si el endpoint no es crítico (solo warning)

---

### 4. Build stamp coherente con /__version

**Objetivo:** Verificar que el BUILD_ID del HTML coincide con el del servidor.

**Pasos:**
1. Abrir una pantalla admin
2. Abrir DevTools → Console
3. Verificar build stamp:
   ```javascript
   // Leer del HTML
   const htmlBuildId = document.documentElement.dataset.buildId || window.__BUILD__?.buildId;
   console.log('HTML Build ID:', htmlBuildId);
   
   // Leer del servidor
   fetch('/__version').then(r => r.json()).then(v => {
     console.log('Server Build ID:', v.build_id);
     console.log('Match:', htmlBuildId === v.build_id);
   });
   ```

**Resultado esperado:**
- ✅ BUILD_ID del HTML coincide con el del servidor
- ✅ Si hay mismatch, panel de diagnóstico aparece
- ✅ Mensaje indica "posible cache viejo"

**Simulación de mismatch:**
- Modificar temporalmente `data-build-id` en el HTML servido para simular cache viejo

---

### 5. No se duplica overlay ni listeners

**Objetivo:** Verificar que el guard no crea múltiples overlays ni listeners duplicados.

**Pasos:**
1. Abrir una pantalla admin
2. Abrir DevTools → Console
3. Forzar múltiples ejecuciones:
   ```javascript
   window.acsRuntimeGuard.runRuntimeChecks();
   window.acsRuntimeGuard.runRuntimeChecks();
   window.acsRuntimeGuard.runRuntimeChecks();
   ```
4. Verificar que solo hay un overlay:
   ```javascript
   document.querySelectorAll('#acs-r-overlay').length; // Debe ser 0 o 1
   ```
5. Verificar listeners:
   ```javascript
   // Contar listeners de error
   // (no hay API directa, pero verificar que no hay múltiples paneles)
   ```

**Resultado esperado:**
- ✅ Solo un overlay visible (o ninguno si no hay errores)
- ✅ No hay listeners duplicados (verificar en DevTools → Event Listeners)
- ✅ Guard se inicializa solo una vez (verificar logs en consola)

---

## CASOS ADICIONALES (OPCIONALES)

### 6. HTML servido como JS

**Objetivo:** Verificar detección de HTML servido como JS (si se implementa en v1).

**Pasos:**
1. Simular que un script crítico devuelve HTML (modificar temporalmente el servidor)
2. Recargar la página

**Resultado esperado:**
- ✅ Error tipo `HTML_SERVED_AS_JS` visible (si implementado)
- ✅ Script afectado identificado

**Nota:** Este check puede no estar implementado en v1.0.0.

---

### 7. Contrato por pantalla presente

**Objetivo:** Verificar que el contrato se lee correctamente.

**Pasos:**
1. Abrir una pantalla admin con contrato
2. Abrir DevTools → Console
3. Verificar contrato:
   ```javascript
   const contractScript = document.getElementById('acs-r-contract');
   if (contractScript) {
     console.log('Contrato JSON:', JSON.parse(contractScript.textContent));
   } else {
     console.log('Contrato window:', window.__ACS_R_CONTRACT__);
   }
   ```

**Resultado esperado:**
- ✅ Contrato presente (JSON o window.__ACS_R_CONTRACT__)
- ✅ `ui_key` definido
- ✅ `required_endpoints` o `required_globals` definidos (si aplica)

---

### 8. Endpoint de reporte funciona (opcional)

**Objetivo:** Verificar que el endpoint `/admin/api/acs/runtime-report` recibe reportes.

**Pasos:**
1. Abrir una pantalla admin
2. Simular un error que active el guard
3. Verificar en Network tab que se envía POST a `/admin/api/acs/runtime-report`
4. Verificar respuesta del servidor

**Resultado esperado:**
- ✅ POST se envía (si implementado)
- ✅ Respuesta 200 OK del servidor
- ✅ Log en servidor muestra el reporte

**Nota:** El endpoint es opcional y puede no estar implementado en v1.0.0.

---

## VERIFICACIÓN DE INTEGRACIÓN

### 9. Guard se carga en todas las pantallas admin

**Objetivo:** Verificar que el guard se carga automáticamente en todas las pantallas admin.

**Pasos:**
1. Abrir varias pantallas admin:
   - `/admin/system/assembly`
   - `/admin/pde/transmutaciones-energeticas`
   - `/admin/pde/transmutaciones-proyectos`
2. Verificar en cada una:
   ```javascript
   typeof window.acsRuntimeGuard; // Debe ser 'object'
   ```

**Resultado esperado:**
- ✅ `window.acsRuntimeGuard` presente en todas las pantallas
- ✅ Guard se ejecuta automáticamente al cargar

---

### 10. Build stamp presente en todas las pantallas

**Objetivo:** Verificar que el build stamp se inyecta en todas las pantallas admin.

**Pasos:**
1. Abrir varias pantallas admin
2. Verificar en cada una:
   ```javascript
   document.documentElement.dataset.buildId; // Debe existir
   window.__BUILD__; // Debe existir
   ```

**Resultado esperado:**
- ✅ `data-build-id` presente en `<html>` o `<body>`
- ✅ `window.__BUILD__` presente con `buildId` y `appVersion`

---

## RESUMEN DE CASOS

| # | Caso | Estado | Prioridad |
|---|------|--------|-----------|
| 1 | SyntaxError bloquea UI | ✅ Obligatorio | Crítica |
| 2 | Missing handler detectado | ✅ Obligatorio | Alta |
| 3 | Endpoint 500 detectado | ✅ Obligatorio | Media |
| 4 | Build stamp coherente | ✅ Obligatorio | Alta |
| 5 | No duplicación overlay/listeners | ✅ Obligatorio | Media |
| 6 | HTML servido como JS | ⚠️ Opcional | Baja |
| 7 | Contrato presente | ✅ Obligatorio | Media |
| 8 | Endpoint reporte funciona | ⚠️ Opcional | Baja |
| 9 | Guard en todas las pantallas | ✅ Obligatorio | Alta |
| 10 | Build stamp en todas | ✅ Obligatorio | Alta |

---

## NOTAS

- Todos los casos obligatorios deben pasar para considerar ACS-R v1 implementado
- Los casos opcionales pueden implementarse en versiones futuras
- Si un caso falla, documentar el comportamiento y decidir si es bug o feature faltante

---

**Próximo paso:** Ejecutar estos tests después de implementar ACS-R v1 y documentar resultados.


