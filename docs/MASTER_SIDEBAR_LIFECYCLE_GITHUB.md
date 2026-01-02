# Master Sidebar Lifecycle v1.4.2 - Datos para GitHub

## VERSION NAME

```
v1.4.2-master-sidebar-lifecycle
```

## COMMIT MESSAGE

```
feat(master): sidebar lifecycle v1.4.2 (state versioning + reset)

```

## DESCRIPTION

Cierre canónico del ciclo de vida del estado del Sidebar MASTER:
versionado del estado con APP_VERSION.BUILD_ID, reset automático
cuando cambia la versión, orden de inicialización garantizado con
requestAnimationFrame y log informativo único. Elimina comportamientos
inconsistentes (resize/fold intermitente, caché, incógnito, timing).

## CAMBIOS PRINCIPALES

### Versionado del Estado

- **Clave canónica**: `ap_master_sidebar_state_version`
- **Valor**: `${APP_VERSION}.${BUILD_ID}`
- **Funciones**: `getCurrentSidebarStateVersion()`, `loadSidebarStateVersion()`, `saveSidebarStateVersion()`

### Reset Canónico Controlado

- **Función**: `resetSidebarStateIfVersionChanged()`
- **Comportamiento**: Compara versión guardada vs actual, elimina claves de estado si difieren
- **Claves eliminadas**: `ap_master_sidebar_width_v1`, `ap_master_sidebar_folded_v1`, `ap_master_sidebar_collapsed_v1`
- **Reset**: Silencioso, determinista, sin logs de error

### Orden de Inicialización

- **requestAnimationFrame**: Garantiza que el `<aside>` exista y el layout flex esté aplicado
- **Flujo**: Verificar contexto → Resetear estado → requestAnimationFrame → Renderizar → Inicializar

### Log Informativo

- **Único log**: `[MasterSidebar] State initialized (version X.Y)`
- **Características**: Informativo (no debug), muestra versión actual

## ARCHIVOS MODIFICADOS

1. **`public/js/master/master-sidebar-client.js`**
   - Funciones de versionado del estado
   - Función de reset canónico
   - Orden de inicialización con requestAnimationFrame
   - Log informativo único

## ARCHIVOS NO MODIFICADOS

- ✅ Registry - NO tocado
- ✅ CSS - NO tocado
- ✅ Variables - NO tocadas
- ✅ Lógica de resize/fold - NO modificada (solo orden)

## COMPATIBILIDAD

- ✅ Compatible con v1.1, v1.2, v1.3, v1.4, v1.4.1
- ✅ Migración automática en primera carga
- ✅ Sin breaking changes

## REFERENCIAS

- Documentación: `docs/MASTER_SIDEBAR_LIFECYCLE_V1_4_2.md`
- Cliente: `public/js/master/master-sidebar-client.js`

---

**ESTADO**: ✅ IMPLEMENTACIÓN COMPLETA Y VERIFICADA
