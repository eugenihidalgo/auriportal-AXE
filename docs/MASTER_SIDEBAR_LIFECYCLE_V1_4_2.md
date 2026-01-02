# Master Sidebar Lifecycle v1.4.2 - Cierre Canónico del Estado

## ⚠️ ESTADO: CANÓNICO / CONSTITUCIONAL v1.4.2

**Fecha de implementación**: 2024-12-XX
**Versión**: v1.4.2
**Estado**: ✅ OPERATIVO

---

## Objetivo

Cerrar de forma canónica el ciclo de vida del estado del sidebar MASTER para eliminar comportamientos inconsistentes (resize/fold intermitente, caché, incógnito, timing).

**Problema resuelto**: Estado persistente + caché + timing causaban comportamientos inconsistentes.

---

## ¿Qué se ha Cambiado?

### Versionado del Estado (v1.4.2)

**Clave canónica**: `ap_master_sidebar_state_version`

**Valor**: `${APP_VERSION}.${BUILD_ID}`

**Ejemplo**: `4.0.0.abc123`

### Reset Canónico Controlado

**Comportamiento**:
1. Al inicializar, se lee la versión guardada
2. Se compara con la versión actual (`APP_VERSION.BUILD_ID`)
3. Si NO coincide:
   - Se eliminan explícitamente todas las claves de estado:
     - `ap_master_sidebar_width_v1`
     - `ap_master_sidebar_folded_v1`
     - `ap_master_sidebar_collapsed_v1`
   - Se guarda la nueva versión
4. El reset es:
   - Silencioso (sin logs de error)
   - Determinista (siempre el mismo resultado)

### Orden de Inicialización

**Uso de `requestAnimationFrame`**:
- Garantiza que el `<aside class="master-sidebar-container">` exista
- Garantiza que el layout flex esté aplicado
- Asegura que el resize handler y la restauración de width/fold se ejecuten DESPUÉS de que el DOM esté listo

**Flujo**:
```
1. Verificar contexto MASTER
2. Resetear estado si cambió versión
3. requestAnimationFrame(() => {
     - Seleccionar contenedor
     - Renderizar sidebar
     - Inicializar resize/fold
     - Log informativo
   })
```

### Log Informativo Único

**Log añadido**:
```
[MasterSidebar] State initialized (version X.Y)
```

**Características**:
- Único log informativo (no debug)
- Muestra la versión actual del estado
- Se ejecuta después de la inicialización completa

---

## Funciones Implementadas

### `getCurrentSidebarStateVersion()`

Obtiene la versión actual del estado:
```javascript
const appVersion = window.__AP_APP_VERSION__ || 'unknown';
const buildId = window.__AP_BUILD_ID__ || 'unknown';
return `${appVersion}.${buildId}`;
```

### `loadSidebarStateVersion()`

Carga la versión guardada desde localStorage:
```javascript
return localStorage.getItem('ap_master_sidebar_state_version');
```

### `saveSidebarStateVersion(version)`

Guarda la versión actual en localStorage:
```javascript
localStorage.setItem('ap_master_sidebar_state_version', version);
```

### `resetSidebarStateIfVersionChanged()`

Resetea el estado si cambió la versión:
```javascript
const currentVersion = getCurrentSidebarStateVersion();
const savedVersion = loadSidebarStateVersion();

if (savedVersion === currentVersion) {
  return false; // No se hizo reset
}

// Eliminar todas las claves de estado
localStorage.removeItem('ap_master_sidebar_width_v1');
localStorage.removeItem('ap_master_sidebar_folded_v1');
localStorage.removeItem('ap_master_sidebar_collapsed_v1');

// Guardar nueva versión
saveSidebarStateVersion(currentVersion);

return true; // Se hizo reset
```

---

## Claves de localStorage

### Nuevas (v1.4.2)

- `ap_master_sidebar_state_version`: Versión del estado (formato: `APP_VERSION.BUILD_ID`)

### Existentes (Mantenidas)

- `ap_master_sidebar_width_v1`: Ancho del sidebar (píxeles)
- `ap_master_sidebar_folded_v1`: Estado plegado (`"true"` o `"false"`)
- `ap_master_sidebar_collapsed_v1`: Secciones colapsadas (JSON array)

---

## Flujo de Inicialización

### Orden Canónico

1. **Verificar contexto MASTER**
   - Si no es MASTER → abortar

2. **Resetear estado si cambió versión**
   - Comparar versión guardada vs actual
   - Si difieren → eliminar claves de estado
   - Guardar nueva versión

3. **requestAnimationFrame** (garantizar orden)
   - Seleccionar contenedor flex (`<aside>`)
   - Seleccionar contenedor nav interno (`<nav>`)
   - Parsear datos del sidebar
   - Renderizar sidebar
   - Inicializar resize handler
   - Restaurar width/fold
   - Inicializar búsqueda
   - Log informativo

### Garantías

- ✅ El `<aside>` existe antes de seleccionarlo
- ✅ El layout flex está aplicado antes de restaurar width
- ✅ El resize handler se crea después de que el contenedor exista
- ✅ La restauración de width/fold ocurre después del render

---

## Qué NO se ha Tocado

### Arquitectura
- ✅ Registry (`master-sidebar-registry.js`) - **NO modificado**
- ✅ Layout renderer (`master-page-renderer.js`) - **NO modificado**
- ✅ Loaders - **NO modificados**
- ✅ Contratos existentes - **NO modificados**

### CSS
- ✅ Estilos visuales - **NO modificados**
- ✅ Variables CSS - **NO modificadas**

### Lógica de Funcionalidad
- ✅ Resize JS - **NO modificado** (solo orden de inicialización)
- ✅ Fold JS - **NO modificado** (solo orden de inicialización)
- ✅ Persistencia JS - **NO modificada** (solo añadido reset)

---

## Compatibilidad

### Versiones Anteriores

- ✅ **v1.1** (Theme-Ready): Compatible
- ✅ **v1.2** (Fold/Unfold): Compatible
- ✅ **v1.3** (Luminosidad Arcana): Compatible
- ✅ **v1.4** (Resize): Compatible
- ✅ **v1.4.1** (Layout Contract): Compatible
- ✅ **v1.4.2** (Lifecycle): Nueva versión

### Migración Automática

**Primera carga después del deploy**:
- Versión guardada: `null` o versión antigua
- Versión actual: `4.0.0.abc123`
- **Acción**: Reset automático silencioso
- **Resultado**: Estado limpio, sidebar usa defaults

**Cargas posteriores**:
- Versión guardada: `4.0.0.abc123`
- Versión actual: `4.0.0.abc123`
- **Acción**: No reset, usar estado guardado
- **Resultado**: Persistencia funciona normalmente

---

## Referencias

- Cliente: `public/js/master/master-sidebar-client.js`
- Layout: `src/core/master/layout/master-layout-v1.html`
- Registry: `src/core/master/registry/master-sidebar-registry.js`

---

## Estado Final

✅ **VERSIONADO IMPLEMENTADO**
✅ **RESET CANÓNICO IMPLEMENTADO**
✅ **ORDEN DE INICIALIZACIÓN GARANTIZADO**
✅ **LOG INFORMATIVO AÑADIDO**
✅ **DOCUMENTACIÓN COMPLETA**

**Sistema operativo y listo para producción.**

---

**Última actualización**: 2024-12-XX
**Versión del sistema**: v1.4.2 (CANÓNICO)
