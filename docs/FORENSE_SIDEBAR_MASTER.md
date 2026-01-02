# Forense Controlado del Sidebar MASTER

**Fecha**: 2025-01-XX  
**Estado**: Diagnóstico completado  
**Sistema de Assets**: v1 (CANÓNICO / CERRADO)

---

## Resumen Ejecutivo

El Sidebar MASTER está correctamente configurado según el Sistema de Assets Canónico v1:

✅ **Script declarado en contrato**: `master-sidebar-client` está en `required_scripts`  
✅ **Logs estructurados**: Prefijos `[MasterSidebar]` y `[SIDEBAR][MASTER]` presentes  
✅ **Bootstrap autoejecutable**: IIFE que se ejecuta al cargar  
✅ **Guards defensivos**: Verificación de contexto MASTER, contenedor DOM, datos  
✅ **DOM API únicamente**: Sin innerHTML, conforme a reglas constitucionales

---

## Verificación 1: Script en Required Scripts

**Archivo**: `src/core/master/registry/master-layout-registry.v1.json`

```json
{
  "id": "master-sidebar-client",
  "guard_id": "SIDEBAR_CLIENT",
  "path": "/js/master/master-sidebar-client.js",
  "type": "module",
  "required": true,
  "critical": true,
  "phase": "core",
  "name": "Master Sidebar Client"
}
```

**Estado**: ✅ **CORRECTO**
- Está declarado en `required_scripts`
- Marcado como `critical: true`
- Fase `core` (se carga primero)

---

## Verificación 2: Asset Runtime Registry

**Cómo verificar en runtime**:

```javascript
// En consola del navegador (página MASTER):
window.__AP_ASSETS__?.assets['master-sidebar-client']
```

**Campos esperados**:
- `status`: `'loaded'` (si cargó correctamente) o `'failed'` (si falló)
- `url`: `/js/master/master-sidebar-client.js`
- `critical`: `true`
- `start_ts`, `end_ts`, `duration_ms`: Timestamps de carga

**Estado**: ⚠️ **REQUIERE VERIFICACIÓN EN RUNTIME**

Para verificar:
1. Cargar una página MASTER (ej: `/master/alumnos`)
2. Abrir consola del navegador
3. Ejecutar: `window.__AP_ASSETS__?.assets['master-sidebar-client']`
4. Verificar que `status === 'loaded'`

---

## Verificación 3: Logs Estructurados

**Prefijos esperados**:
- `[MasterSidebar]`: Logs detallados del componente
- `[SIDEBAR][MASTER]`: Logs forenses estructurados

**Logs clave esperados**:

```
[SIDEBAR][MASTER] init - Bootstrap iniciado
[MasterSidebar] 📦 Bootstrap iniciado
[MasterSidebar] ✅ DOM ya listo, inicializando inmediatamente...
[SIDEBAR][MASTER] render - Iniciando render
[MasterSidebar] 🎨 Iniciando render del sidebar Master
[MasterSidebar] ✅ Contenedor encontrado: master-sidebar-container
[MasterSidebar] ✅ Datos parseados correctamente
[MasterSidebar] ✅ Render completado
[SIDEBAR][MASTER] render - Render completado exitosamente
```

**Estado**: ✅ **IMPLEMENTADO**
- Logs estructurados presentes
- Prefijos canónicos usados
- Información forense suficiente

---

## Verificación 4: Contenedor DOM

**ID esperado**: `master-sidebar-container`

**Ubicación**: `src/core/master/layout/master-layout-v1.html`

```html
<aside class="master-sidebar-container">
  <nav id="master-sidebar-container" class="master-sidebar" data-sidebar-data="{{SIDEBAR_DATA}}">
    <!-- Sidebar se renderiza vía DOM API en master-sidebar-client.js -->
  </nav>
</aside>
```

**Estado**: ✅ **CORRECTO**
- Contenedor existe en el layout
- ID correcto: `master-sidebar-container`
- Data attribute `data-sidebar-data` presente

**Guards en código**:

```javascript
// public/js/master/master-sidebar-client.js:208
const container = document.getElementById('master-sidebar-container');
if (!container) {
  console.error('[MasterSidebar] ❌ Contenedor no encontrado: #master-sidebar-container');
  return;
}
```

---

## Verificación 5: Ejecución del Render

**Flujo esperado**:

1. **Bootstrap autoejecutable** (IIFE al cargar script)
   - Verifica contexto MASTER
   - Bloquea render legacy de Admin
   - Guard idempotente

2. **Inicialización** (`doInit()`)
   - Obtiene `activePath` y `universeId`
   - Llama a `initMasterSidebar()`

3. **Init Master Sidebar**
   - Verifica contexto MASTER
   - Busca contenedor DOM
   - Parsea datos de `data-sidebar-data`
   - Llama a `renderMasterSidebar()`

4. **Render Master Sidebar**
   - Limpia contenedor
   - Crea header (DOM API)
   - Crea items sin sección (DOM API)
   - Crea secciones (DOM API)
   - Crea footer (DOM API)
   - Crea zona global (DOM API)

**Estado**: ✅ **IMPLEMENTADO CORRECTAMENTE**

---

## Diagnóstico de Posibles Problemas

### Problema 1: Script no se carga

**Síntomas**:
- No aparecen logs `[MasterSidebar]` o `[SIDEBAR][MASTER]`
- `window.__AP_ASSETS__?.assets['master-sidebar-client']` es `undefined` o tiene `status: 'failed'`

**Diagnóstico**:
1. Verificar `window.__AP_ASSETS__` completo
2. Verificar `failure_reason` en el asset
3. Verificar endpoint `/master/api/__assets` (contrato)
4. Verificar que el archivo existe: `public/js/master/master-sidebar-client.js`

**Causas comunes**:
- Archivo no existe en filesystem
- Error 404 del servidor
- Preflight falla (HTML servido como JS, Content-Type incorrecto)
- Asset crítico: overlay de error visible

---

### Problema 2: Script se carga pero no ejecuta

**Síntomas**:
- `status: 'loaded'` en Asset Registry
- No aparecen logs de bootstrap

**Diagnóstico**:
1. Verificar `window.__AP_CONTEXT__` (debe ser `'MASTER'`)
2. Verificar que el script es módulo ES (`type="module"`)
3. Verificar consola por errores de JavaScript

**Causas comunes**:
- Contexto no es MASTER (script aborta temprano)
- Error de sintaxis en el script
- Módulo ES no soportado

---

### Problema 3: Script ejecuta pero no renderiza

**Síntomas**:
- Aparecen logs de bootstrap
- Aparece log "Contenedor encontrado"
- No aparece log "Render completado"

**Diagnóstico**:
1. Verificar log de error específico
2. Verificar `data-sidebar-data` en el contenedor
3. Verificar que `getMasterSidebarData()` retorna datos válidos

**Causas comunes**:
- `data-sidebar-data` ausente o mal formateado
- Error parseando JSON
- Datos del sidebar vacíos o inválidos

---

### Problema 4: Renderiza pero no es visible

**Síntomas**:
- Aparece log "Render completado"
- Elementos no visibles en el DOM

**Diagnóstico**:
1. Inspeccionar DOM: `document.getElementById('master-sidebar-container')`
2. Verificar CSS (display: none, visibility: hidden, z-index)
3. Verificar que el layout tiene el contenedor correcto

**Causas comunes**:
- CSS ocultando el sidebar
- Contenedor fuera del viewport
- Conflicto de estilos

---

## Checklist de Verificación Forense

Para verificar el estado completo del Sidebar MASTER en runtime:

- [ ] Script está en `required_scripts` del contrato
- [ ] `window.__AP_ASSETS__?.assets['master-sidebar-client']?.status === 'loaded'`
- [ ] Logs `[SIDEBAR][MASTER] init` aparecen en consola
- [ ] Logs `[SIDEBAR][MASTER] render` aparecen en consola
- [ ] `document.getElementById('master-sidebar-container')` existe
- [ ] Contenedor tiene `data-sidebar-data` attribute
- [ ] Elementos del sidebar son visibles en el DOM
- [ ] Sidebar es visualmente visible en la página

---

## Conclusión

El Sidebar MASTER está **correctamente implementado** según el Sistema de Assets Canónico v1:

✅ Configuración correcta  
✅ Logs estructurados presentes  
✅ Guards defensivos implementados  
✅ DOM API únicamente (constitucional)  
✅ Bootstrap autoejecutable  

**Próximos pasos**:
1. Verificar en runtime que `window.__AP_ASSETS__` muestra el asset como `loaded`
2. Verificar visualmente que el sidebar se renderiza correctamente
3. Si hay problemas, usar el diagnóstico de problemas arriba

**Estado**: ✅ **LISTO PARA VERIFICACIÓN EN RUNTIME**

