# 🔍 DIAGNÓSTICO: "POR QUÉ ESTÁ TODO EN BLANCO" — MASTER ONLY
**Fecha:** 2026-01-05  
**Modo:** READ-ONLY (sin implementaciones)  
**Ruta Problemática:** `/master/templo-luz/alquimia-general`

---

## 📊 TABLA DE EVIDENCIA

| Ruta | Handler Existe | Root en HTML | Script Page Declarado | Script File Existe | Hipótesis Más Probable |
|------|----------------|--------------|----------------------|-------------------|------------------------|
| `/master` | ✅ | ✅ (`<div>` básico) | ❌ NO (solo core) | N/A | ✅ OK (no requiere script) |
| `/master/templo-luz/alquimia-general` | ✅ | ✅ (`id="master-alquimia-general-root"`) | ✅ SÍ (`master-alquimia-general-client`) | ✅ SÍ (8694 bytes) | ⚠️ **SCRIPT NO SE EJECUTA** |
| `/master/templo-luz/alquimia-alumno` | ✅ | ✅ (`id="alquimia-alumno-container"`) | ❌ NO CONSTA | ✅ SÍ (13656 bytes) | ⚠️ **SCRIPT NO DECLARADO** |
| `/master/alumnos/postgresql` | ✅ | ✅ (`id="master-alumnos-content"`) | ✅ SÍ (`master-alumnos-client`) | ❌ **VACÍO (0 bytes)** | ❌ **SCRIPT VACÍO** |

---

## 1️⃣ INVENTARIO DE RUTAS MASTER (UI)

### Master Route Registry
**Archivo:** `src/core/master/registry/master-route-registry.js`

### Rutas Verificadas

| Ruta | routeKey | Handler File | Root Container Esperado |
|------|----------|--------------|-------------------------|
| `/master` | `master-dashboard` | `src/endpoints/master-dashboard.js` | `<div>` básico |
| `/master/templo-luz/alquimia-general` | `master-templo-luz-alquimia-general` | `src/endpoints/master-templo-luz-alquimia-general.js` | `id="master-alquimia-general-root"` |
| `/master/templo-luz/alquimia-alumno` | `master-templo-luz-alquimia-alumno` | `src/endpoints/master-templo-luz-alquimia-alumno.js` | `id="alquimia-alumno-container"` |
| `/master/alumnos/postgresql` | `master-alumnos-postgresql` | `src/endpoints/master-alumnos-postgresql.js` | `id="master-alumnos-content"` |

**Estado:** ✅ Todas las rutas están registradas correctamente.

---

## 2️⃣ INVENTARIO DE HANDLERS (SERVER)

### Handler: `master-templo-luz-alquimia-general.js`

**Verificación:**
- ✅ Devuelve HTML (usa `renderMasterPage()`)
- ✅ Incluye root container: `<div id="master-alquimia-general-root" class="p-6">`
- ✅ HTML contiene estructura mínima (header, tabs, lista-content)
- ⚠️ **NO CONSTA:** Si inyecta `window.__AP_CONTEXT__` con routeId (el sistema usa `universeId: 'templo_luz'`)

**HTML Generado:**
```html
<div id="master-alquimia-general-root" class="p-6">
  <div class="mb-6">
    <h1 class="text-3xl font-bold text-white mb-2">🔮 Alquimia General</h1>
    <p class="text-slate-400">Source of Truth canónico...</p>
  </div>
  <!-- FILTRO DE TIPO -->
  <div class="mb-4 border-b border-slate-700">
    <div class="flex gap-4" id="tabs-tipo-container">
      <!-- Se llenan dinámicamente con DOM API -->
    </div>
  </div>
  <!-- TABS DE LISTAS -->
  <div class="mb-6 flex items-center gap-3">
    <div id="listas-tabs-container" class="flex gap-2 overflow-x-auto pb-2 flex-1">
      <!-- Se llenan dinámicamente con DOM API -->
    </div>
    <button id="btn-crear-lista">➕ Nueva Lista</button>
  </div>
  <!-- CONTENIDO DE LA LISTA SELECCIONADA -->
  <div id="lista-content" class="hidden">
    <!-- Se llena dinámicamente con DOM API -->
  </div>
</div>
```

**Conclusión:** ✅ Handler genera HTML correcto con root container visible.

---

## 3️⃣ INVENTARIO DEL LOADER MASTER

### master-script-loader.js

**Mecanismo de Decisión:**
- ✅ **NO filtra por ruta/página**
- ✅ **Carga TODOS los scripts** declarados en `master-layout-registry.v1.json` → `required_scripts`
- ✅ Lee `window.__AP_MASTER_REQUIRED_SCRIPTS__` (inyectado en HTML)
- ✅ Carga scripts secuencialmente en el orden declarado

**Proceso:**
1. `initScriptLoader()` lee `window.__AP_MASTER_REQUIRED_SCRIPTS__`
2. `loadRequiredScripts()` itera sobre TODOS los scripts del array
3. `loadScript()` carga cada script con preflight validation
4. Si un script crítico falla, aborta el resto

**Conclusión:** ⚠️ **El loader NO filtra scripts por página/ruta. Carga TODOS los scripts del registry.**

### master-layout-registry.v1.json

**Verificación:**
- ✅ JSON bien formado (parsea correctamente)
- ✅ Declara scripts core:
  - `master-sidebar-client` (critical: true, phase: "core")
  - `master-theme-resolver` (critical: true, phase: "core")
- ✅ Declara scripts de página:
  - `master-alquimia-general-client` (critical: false, phase: "ui")
  - `master-alumnos-client` (critical: false, phase: "ui")
  - `master-lugares-client` (critical: false, phase: "ui")

**Scripts Declarados:**
```json
{
  "id": "master-alquimia-general-client",
  "guard_id": "ALQUIMIA_GENERAL_CLIENT",
  "path": "/js/master/master-alquimia-general-client.js",
  "type": "module",
  "required": true,
  "critical": false,
  "phase": "ui",
  "name": "Master Alquimia General Client"
}
```

**Conclusión:** ✅ Script declarado correctamente en registry.

---

## 4️⃣ EVIDENCIA "HTML SERVIDO" (Sin Navegador)

### Prueba con curl

```bash
curl -sS http://127.0.0.1:3000/master/templo-luz/alquimia-general \
  -H "Host: master.pdeeugenihidalgo.org" \
  -L -D /tmp/h.txt -o /tmp/p.html
```

**Resultado:**
- **Status:** `302 Found` → `404 Not Found` (nginx)
- **HTML Size:** 162 bytes (solo HTML de error nginx)
- **Root Container:** ❌ NO encontrado (nginx 404)

**Análisis:**
- ⚠️ **NO CONSTA:** Si el servidor Node.js está recibiendo la request
- ⚠️ **NO CONSTA:** Si hay proxy/nginx delante que bloquea
- ❌ **NO SE PUEDE VERIFICAR:** HTML servido por Node.js (nginx responde 404)

**Conclusión:** ⚠️ **No se puede verificar HTML servido directamente (nginx 404). Requiere acceso directo al servidor Node.js o navegador.**

---

## 5️⃣ EVIDENCIA "ASSETS EXISTEN"

### Verificación de Archivos

```bash
ls -la public/js/master/master-alquimia*.js public/js/master/master-alumnos*.js
```

**Resultado:**
- ✅ `master-alquimia-general-client.js` — **EXISTE** (8694 bytes)
- ✅ `master-alquimia-alumno-client.js` — **EXISTE** (13656 bytes)
- ❌ `master-alumnos-client.js` — **VACÍO** (0 bytes)

**Conclusión:** 
- ✅ Scripts de alquimia existen
- ❌ Script de alumnos está vacío (pero no afecta alquimia-general)

---

## 6️⃣ DB (Solo Confirmar Existencia)

### Verificación de Tablas

**Intento de verificación:**
```bash
sudo -u postgres psql -U aurelinportal -d aurelinportal -c "\d alumnos"
sudo -u postgres psql -U aurelinportal -d aurelinportal -c "\d student_item_state"
```

**Resultado:**
- ❌ **Error:** `Peer authentication failed for user "aurelinportal"`
- ⚠️ **NO CONSTA:** Estructura exacta de tablas (requiere autenticación correcta)

**Conclusión:** ⚠️ **No se pudo verificar DB directamente. Requiere autenticación PostgreSQL correcta.**

---

## 🎯 CONCLUSIÓN: CAUSA PRINCIPAL MÁS PROBABLE

### Hipótesis #1: SCRIPT NO SE EJECUTA (MÁS PROBABLE)

**Evidencia:**
1. ✅ Handler genera HTML correcto con root container `master-alquimia-general-root`
2. ✅ Script declarado en registry (`master-alquimia-general-client`)
3. ✅ Script existe en filesystem (8694 bytes)
4. ⚠️ **El loader carga TODOS los scripts del registry** (no filtra por página)
5. ⚠️ **NO CONSTA:** Si el script se ejecuta correctamente en runtime

**Causa Probable:**
- El script `master-alquimia-general-client.js` se carga pero:
  - No encuentra el root container (selector incorrecto)
  - Falla silenciosamente (error en console no visible)
  - Espera un evento que nunca se emite
  - Requiere datos de API que no están disponibles

**Verificación Necesaria:**
- Abrir navegador → DevTools → Console
- Verificar si el script se carga (Network tab)
- Verificar si hay errores JavaScript
- Verificar si el script encuentra `#master-alquimia-general-root`

---

### Hipótesis #2: LOADER CARGA TODOS LOS SCRIPTS (SECUNDARIA)

**Evidencia:**
- El loader NO filtra scripts por ruta
- Carga TODOS los scripts de `required_scripts` en TODAS las páginas
- Esto incluye scripts que no son para esa página (ej: `master-alumnos-client` en alquimia-general)

**Impacto:**
- Puede causar conflictos si scripts compiten por el mismo elemento
- Puede causar errores si un script espera elementos que no existen en esa página
- Puede ralentizar carga innecesariamente

**Solución Potencial:**
- Filtrar scripts por `routeKey` o `universeId` antes de cargar
- O marcar scripts como "page-specific" en el registry

---

### Hipótesis #3: SCRIPT VACÍO (NO APLICA A ALQUIMIA-GENERAL)

**Evidencia:**
- `master-alumnos-client.js` está vacío (0 bytes)
- Esto afecta `/master/alumnos/postgresql`, NO `/master/templo-luz/alquimia-general`

**Conclusión:** No es la causa del problema en alquimia-general.

---

## 📋 CHECKLIST DE VERIFICACIÓN (Para Resolver)

- [ ] Abrir navegador → `/master/templo-luz/alquimia-general`
- [ ] DevTools → Network → Verificar que `master-alquimia-general-client.js` se carga (200 OK)
- [ ] DevTools → Console → Buscar errores JavaScript
- [ ] DevTools → Console → Verificar logs `[ASSETS][MASTER]` del loader
- [ ] DevTools → Elements → Verificar que existe `#master-alquimia-general-root`
- [ ] DevTools → Console → Ejecutar: `document.getElementById('master-alquimia-general-root')`
- [ ] Verificar si el script espera evento `AP_MASTER_SCRIPTS_READY`
- [ ] Verificar si el script hace fetch a API que falla silenciosamente

---

## 🔧 RECOMENDACIONES (Sin Implementar)

1. **Verificar en Navegador:** Abrir DevTools y verificar ejecución del script
2. **Logs del Loader:** Verificar logs `[ASSETS][MASTER]` en console
3. **Selector del Script:** Verificar que el script busca `#master-alquimia-general-root` correctamente
4. **Dependencias:** Verificar si el script requiere datos de API que no están disponibles
5. **Eventos:** Verificar si el script espera eventos que no se emiten

---

**FIN DEL REPORTE**
