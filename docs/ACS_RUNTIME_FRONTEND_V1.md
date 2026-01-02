# ACS-R (Assembly Check Runtime Frontend) v1

**Versión:** 1.0.0  
**Fecha:** 2025-01-XX  
**Estado:** Especificación

---

## OBJETIVO

ACS-R v1 es un sistema de validación que se ejecuta en el **navegador** al cargar una UI admin para verificar que el runtime frontend está sano antes de permitir interacción.

**Principio fundamental:** Si el JS crítico falla, la UI debe mostrar un diagnóstico claro y bloquear interacción (FAIL-HARD visible).

---

## A) QUÉ ES ACS-R

### Definición

ACS-R es un set de checks que se ejecutan en el **NAVEGADOR** al cargar una UI admin:

1. **Verifica** que el runtime frontend está sano antes de permitir interacción
2. **Reporta** diagnóstico visible (y opcionalmente al servidor)
3. **Bloquea** la UI si hay errores críticos (FAIL-HARD)

### Diferencias con ACS Backend

| Aspecto | ACS Backend | ACS-R (Frontend) |
|---------|-------------|------------------|
| **Dónde se ejecuta** | Servidor (Node.js) | Navegador (JavaScript) |
| **Cuándo se ejecuta** | Server startup / Request-time | Al cargar la página |
| **Qué valida** | Estructura estática, sintaxis Node.js | Parseo JS real, handlers, endpoints |
| **Qué detecta** | Errores de ensamblaje | Errores de runtime frontend |

### Integración con ACS Backend

- ACS backend valida **estructura** (registry, handlers, contratos)
- ACS-R valida **runtime** (parseo JS, handlers presentes, endpoints respondiendo)
- Ambos son complementarios y necesarios

---

## B) INVARIANTES MÍNIMAS ACS-R v1 (OBLIGATORIAS)

### 1. BUILD STAMP visible

**Qué valida:**
- El HTML debe exponer `APP_VERSION` y `BUILD_ID` en `data-*` o `window.__BUILD__`
- El BUILD_ID del HTML debe coincidir con el BUILD_ID del servidor (vía `/__version`)

**Cómo se valida:**
```javascript
// Leer build stamp del HTML
const buildStamp = document.documentElement.dataset.buildId || window.__BUILD__?.buildId;
const appVersion = document.documentElement.dataset.appVersion || window.__BUILD__?.appVersion;

// Comparar con servidor
const serverVersion = await fetch('/__version').then(r => r.json());
if (buildStamp !== serverVersion.build_id) {
  // Mismatch: assets viejos en cache
  reportError('BUILD_STAMP_MISMATCH', { buildStamp, serverVersion });
}
```

**Qué detecta:**
- Assets viejos en cache del navegador
- Mismatch entre versión del servidor y versión de los assets cargados

**Acción si falla:**
- Bloquear UI y mostrar panel de diagnóstico
- Sugerir hard refresh (Ctrl+Shift+R)

---

### 2. JS crítico parseado

**Qué valida:**
- Si hay SyntaxError al parsear JavaScript, bloquear UI y mostrar panel de diagnóstico

**Cómo se valida:**
```javascript
// Instalar window.onerror + unhandledrejection
window.addEventListener('error', (event) => {
  if (event.error instanceof SyntaxError) {
    reportError('SYNTAX_ERROR', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    });
    blockUI();
  }
});

window.addEventListener('unhandledrejection', (event) => {
  if (event.reason instanceof SyntaxError) {
    reportError('SYNTAX_ERROR_PROMISE', {
      message: event.reason.message
    });
    blockUI();
  }
});
```

**Qué detecta:**
- SyntaxError en cualquier script cargado
- Errores de parseo JS en el navegador

**Acción si falla:**
- Bloquear UI inmediatamente
- Mostrar panel de diagnóstico con stacktrace

---

### 3. No HTML servido como JS

**Qué valida:**
- Si un script crítico cargado empieza con `<` (HTML), detectar y reportar

**Cómo se valida:**
```javascript
// Para scripts críticos declarados en contrato
async function validateScriptContent(scriptUrl) {
  const response = await fetch(scriptUrl);
  const text = await response.text();
  
  // Detectar HTML servido como JS
  if (text.trim().startsWith('<')) {
    reportError('HTML_SERVED_AS_JS', {
      scriptUrl,
      firstChars: text.substring(0, 100)
    });
    return false;
  }
  return true;
}
```

**Qué detecta:**
- HTML servido como JS (error 404 devuelve HTML, ruta mal configurada)

**Acción si falla:**
- Bloquear UI y mostrar panel de diagnóstico
- Indicar script afectado

---

### 4. Handlers críticos presentes

**Qué valida:**
- Lista de funciones esperadas por pantalla (capability/handler registry)
- Si falta una, diagnóstico: "MissingHandler: cerrarModalEditarProyecto"

**Cómo se valida:**
```javascript
// Contrato por pantalla declara required_globals
const contract = {
  ui_key: 'transmutaciones-proyectos',
  required_globals: [
    'cerrarModalEditarProyecto',
    'abrirModalEditarProyecto',
    'guardarProyecto'
  ]
};

// Validar presencia
for (const globalName of contract.required_globals) {
  if (typeof window[globalName] !== 'function') {
    reportError('MISSING_HANDLER', {
      handler: globalName,
      ui_key: contract.ui_key
    });
  }
}
```

**Qué detecta:**
- Funciones/handlers faltantes en runtime
- Modales rotos, funciones undefined

**Acción si falla:**
- Bloquear UI y mostrar panel de diagnóstico
- Listar handlers faltantes

---

### 5. Endpoints críticos responden

**Qué valida:**
- Health-check ligero (HEAD/GET) a endpoints declarados por pantalla
- Opcional en v1, pero preferible

**Cómo se valida:**
```javascript
// Contrato declara required_endpoints
const contract = {
  required_endpoints: [
    '/admin/api/transmutaciones/proyectos',
    '/admin/api/transmutaciones/energeticas'
  ]
};

// Validar que responden
for (const endpoint of contract.required_endpoints) {
  try {
    const response = await fetch(endpoint, { method: 'HEAD' });
    if (!response.ok) {
      reportError('ENDPOINT_ERROR', {
        endpoint,
        status: response.status
      });
    }
  } catch (error) {
    reportError('ENDPOINT_NETWORK_ERROR', {
      endpoint,
      error: error.message
    });
  }
}
```

**Qué detecta:**
- Endpoints que devuelven 500
- Endpoints no disponibles (network error)

**Acción si falla:**
- Mostrar warning en panel de diagnóstico (no bloquear UI si es opcional)
- Si es crítico, bloquear UI

---

### 6. No legacy endpoint sin wrapper

**Qué valida:**
- Si la pantalla intenta llamar a un endpoint legacy que da 500, mostrar error y sugerir sustitución canónica

**Cómo se valida:**
```javascript
// Interceptar fetch a endpoints legacy conocidos
const legacyEndpoints = [
  '/admin/legacy/endpoint1',
  '/admin/legacy/endpoint2'
];

const originalFetch = window.fetch;
window.fetch = async function(...args) {
  const url = args[0];
  
  for (const legacy of legacyEndpoints) {
    if (url.includes(legacy)) {
      const response = await originalFetch(...args);
      if (!response.ok) {
        reportError('LEGACY_ENDPOINT_500', {
          endpoint: url,
          status: response.status,
          suggestion: 'Usar /admin/api/canonical/endpoint en su lugar'
        });
      }
      return response;
    }
  }
  
  return originalFetch(...args);
};
```

**Qué detecta:**
- Llamadas a endpoints legacy que devuelven 500
- Uso de endpoints deprecados

**Acción si falla:**
- Mostrar warning con sugerencia de endpoint canónico

---

## C) CONTRATO POR PANTALLA (Screen Runtime Contract)

### Definición

Cada UI admin debe declarar un contrato que especifica:

- `ui_key`: Identificador único de la pantalla
- `required_globals`: Funciones/objetos requeridos en `window`
- `required_endpoints`: Lista de endpoints críticos
- `required_assets`: Assets JS críticos (si aplica)
- `strict_mode`: `true` para admin (bloquear UI si falla)

### Formato del Contrato

```javascript
const screenRuntimeContract = {
  ui_key: 'transmutaciones-proyectos',
  required_globals: [
    'cerrarModalEditarProyecto',
    'abrirModalEditarProyecto',
    'guardarProyecto'
  ],
  required_endpoints: [
    '/admin/api/transmutaciones/proyectos',
    '/admin/api/transmutaciones/energeticas'
  ],
  required_assets: [
    '/js/admin/transmutaciones-proyectos.js'
  ],
  strict_mode: true
};
```

### Dónde se declara

**OPCIÓN 1 (Recomendada):** JSON embebido como `application/json` en `<script type="application/json" id="acs-r-contract">`

```html
<script type="application/json" id="acs-r-contract">
{
  "ui_key": "transmutaciones-proyectos",
  "required_globals": ["cerrarModalEditarProyecto"],
  "required_endpoints": ["/admin/api/transmutaciones/proyectos"],
  "strict_mode": true
}
</script>
```

**OPCIÓN 2:** Inline object seguro en `<script>` (NO template literal dentro de `<script>`)

```html
<script>
window.__ACS_R_CONTRACT__ = {
  ui_key: 'transmutaciones-proyectos',
  required_globals: ['cerrarModalEditarProyecto'],
  required_endpoints: ['/admin/api/transmutaciones/proyectos'],
  strict_mode: true
};
</script>
```

**PROHIBIDO:**
- ❌ JSON en template literal dentro de `<script>` (riesgo de XSS)
- ❌ `innerHTML` dinámico para inyectar contrato

---

## D) ARQUITECTURA

### Componentes

1. **acs-runtime-guard.js**: Guard base que ejecuta checks
2. **Panel de diagnóstico**: Overlay visible cuando falla
3. **Endpoint de reporte**: `/admin/api/acs/runtime-report` (opcional)

### Flujo de Ejecución

```
1. HTML carga → acs-runtime-guard.js se ejecuta
2. Leer build stamp del HTML
3. Instalar window.onerror + unhandledrejection
4. Leer contrato por pantalla (JSON o window.__ACS_R_CONTRACT__)
5. Ejecutar checks:
   - BUILD_STAMP visible y coherente
   - JS crítico parseado (ya capturado por listeners)
   - Handlers críticos presentes
   - Endpoints críticos responden
6. Si hay errores:
   - Bloquear UI (strict_mode: true)
   - Mostrar panel de diagnóstico
   - (Opcional) Reportar al servidor
7. Si todo OK:
   - Permitir interacción normal
```

---

## E) PANEL DE DIAGNÓSTICO

### Qué muestra

- `ui_key`: Identificador de la pantalla
- `APP_VERSION` / `BUILD_ID`: Versión y build ID
- `error type`: Tipo de error (SyntaxError/MissingHandler/Endpoint500)
- `stacktrace`: Stacktrace limitado (primeras 10 líneas)
- `trace_id`: Si existe
- `acciones`: "Copiar diagnóstico", "Hard Refresh"

### Estilo

- Overlay modal que bloquea toda la UI
- Fondo semitransparente
- Panel central con diagnóstico
- Botones de acción
- Sin `innerHTML` dinámico (DOM API obligatoria)

---

## F) INTEGRACIÓN CON ASSEMBLY CHECK SYSTEM EXISTENTE

### ACS Backend puede incluir check nuevo

ACS backend puede validar que:
- `acs-runtime-guard.js` está presente en el HTML
- Contrato por pantalla está declarado
- Build stamp está presente

**Pero:** El runtime guard vive en el navegador, no en el servidor.

### Separación de responsabilidades

- **ACS Backend:** Valida estructura estática (server startup)
- **ACS-R:** Valida runtime frontend (navegador, al cargar página)

---

## G) VERSIONADO Y EVOLUCIÓN

### v1.0.0 (Actual)

- Build stamp visible y coherente
- JS crítico parseado (SyntaxError)
- Handlers críticos presentes
- Endpoints críticos responden (opcional)
- Panel de diagnóstico visible

### Futuro (v2.0.0)

- Validación de dependencias entre scripts
- Validación de orden de carga
- Métricas de performance
- Integración con observabilidad backend

---

## H) REGLAS CONSTITUCIONALES

1. **Prohibido `innerHTML` dinámico**: Usar DOM API obligatoria
2. **Prohibido JSON embebido en `<script>`**: Usar `application/json` o inline object seguro
3. **FAIL-HARD visible**: Si el JS crítico falla, mostrar diagnóstico y bloquear UI
4. **No "parece que"**: Todo debe ser verificable con pruebas reproducibles
5. **Preferir FAIL-HARD en admin**: Cuando haya corrupción de assets/JS, bloquear interacción

---

## I) PRUEBAS OBLIGATORIAS

Ver `docs/ACS_RUNTIME_FRONTEND_V1_TESTS.md` para checklist completo.

Casos mínimos:
1. Introducir SyntaxError deliberadamente → debe bloquear UI
2. Simular missing handler → panel indica MissingHandler
3. Simular endpoint 500 → panel lo detecta
4. Verificar build stamp coherente
5. Verificar que no se duplica overlay ni listeners

---

**Próximo paso:** Ver implementación en `src/core/admin/runtime/acs-runtime-guard.js`


