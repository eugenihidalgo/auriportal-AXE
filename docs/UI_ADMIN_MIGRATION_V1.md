# AuriPortal — Migración de UIs Admin al Sistema Canónico v1

**Versión:** 1.0.0  
**Estado:** DRAFT  
**Fecha:** 2025-01-XX

---

## 1. Introducción

Este documento describe el proceso canónico de migración de pantallas Admin existentes al **Sistema Canónico UI Factory + UI Admin Registry**.

**Objetivo:** Migrar todas las pantallas Admin visibles en el sidebar al sistema canónico de forma reproducible, incremental y reversible.

**Principio fundamental:** La lista canónica de pantallas a migrar = **RUTAS ISLAND VISIBLES EN SIDEBAR**.

---

## 2. Fuentes de Verdad

### 2.1. Sidebar Registry

**Ubicación:** `src/core/admin/sidebar-registry.js`

**Qué contiene:**
- Lista canónica de todas las entradas del sidebar
- Propiedad `visible: true/false` controla visibilidad
- Propiedad `route` contiene la ruta de la pantalla

**Función clave:** `getVisibleSidebarItemsFlat()` devuelve todas las entradas visibles.

**Uso:** Esta es la **fuente de verdad** para determinar qué pantallas están visibles y deben migrarse.

### 2.2. Router Registry

**Ubicación:** `src/core/admin/admin-route-registry.js`

**Qué contiene:**
- Lista canónica de todas las rutas `/admin/*`
- Propiedad `key`: identificador único de la ruta
- Propiedad `path`: patrón de ruta (puede tener parámetros dinámicos)
- Propiedad `type`: `'api'`, `'island'`, o `'legacy'`

**Uso:** Esta es la **fuente de verdad** para obtener `routeKey` y `type` de cada ruta visible.

### 2.3. UI Admin Registry Runtime

**Ubicación:** `src/core/admin/ui-factory/ui-admin-registry.runtime.js`

**Qué contiene:**
- Entradas del UI Admin Registry (estado actual de la migración)
- Cada entrada describe una UI Admin con metadata completa
- Estado del ciclo de vida: `draft`, `active`, `deprecated`, `hidden`

**Uso:** Esta es la **fuente de verdad** del estado de migración de cada pantalla.

---

## 3. Proceso de Descubrimiento

### 3.1. Script de Descubrimiento

**Ubicación:** `scripts/discover-admin-screens.js`

**Qué hace:**
1. Obtiene lista de rutas visibles del Sidebar Registry
2. Filtra rutas API (`/admin/api/*`) - no deben estar en sidebar
3. Cruza cada ruta con Router Registry para obtener `routeKey` y `type`
4. Genera reporte con:
   - Rutas visibles en sidebar
   - Rutas island (a migrar)
   - Rutas no encontradas en Router Registry
   - Entradas sugeridas para UI Admin Registry Runtime

### 3.2. Uso del Script

#### Modo Reporte (Solo Visualización)

```bash
node scripts/discover-admin-screens.js
```

**Output:**
- Resumen de rutas visibles
- Rutas island encontradas
- Rutas no encontradas en Router Registry
- Entradas sugeridas (nuevas y actualizaciones)

#### Modo Aplicación (Actualizar Registry)

```bash
node scripts/discover-admin-screens.js --apply
```

**Qué hace:**
- Actualiza `ui-admin-registry.runtime.js`
- Añade entradas nuevas (status='draft')
- Actualiza entradas existentes (mantiene status, actualiza path si cambió)
- Mantiene IDs estables (no renombra entradas existentes)

#### Modo Ocultar Entradas Faltantes

```bash
node scripts/discover-admin-screens.js --apply --hide-missing
```

**Qué hace:**
- Todo lo de `--apply`
- Además: marca como `status='hidden'` las entradas que ya no están visibles en sidebar

**⚠️ ADVERTENCIA:** Solo usar `--hide-missing` si estás seguro de que las pantallas ya no deben estar visibles.

#### Modo JSON

```bash
node scripts/discover-admin-screens.js --json
```

**Output:** Reporte en formato JSON para procesamiento automático.

---

## 4. Convención de IDs Estables

### 4.1. Generación de IDs

**Formato:** `screen_<slug>`

**Reglas:**
- `/admin` → `admin_home`
- `/admin/dashboard` → `admin_dashboard`
- `/admin/foo/bar` → `admin_foo_bar`
- Reemplazar `/` por `_`
- Mantener IDs existentes (no renombrar)

### 4.2. Estabilidad de IDs

**Principio:** Los IDs son **inmutables** una vez asignados.

**Razón:** Permite referencias estables desde otros sistemas (Router Registry, Sidebar Registry, Assembly Check).

**Ejemplo:**
- Si una entrada ya tiene `id: 'admin-dashboard'`, se mantiene aunque el path cambie
- Si no existe, se genera `id: 'admin_dashboard'` desde el path

---

## 5. Proceso de Migración

### 5.1. Fase 1: Descubrimiento

**Objetivo:** Identificar todas las pantallas a migrar.

**Pasos:**
1. Ejecutar `node scripts/discover-admin-screens.js`
2. Revisar reporte:
   - Verificar que todas las rutas island visibles están listadas
   - Verificar que no hay rutas API en sidebar (error estructural)
   - Verificar que todas las rutas están en Router Registry

**Criterio de éxito:** Todas las rutas island visibles tienen `routeKey` y `type='island'`.

### 5.2. Fase 2: Sincronización Inicial

**Objetivo:** Crear entradas en UI Admin Registry Runtime.

**Pasos:**
1. Ejecutar `node scripts/discover-admin-screens.js --apply`
2. Verificar que el archivo `ui-admin-registry.runtime.js` se actualizó
3. Verificar que todas las entradas tienen `status='draft'`

**Criterio de éxito:** Todas las rutas island visibles tienen entrada en el registry (status='draft').

### 5.3. Fase 3: Validación

**Objetivo:** Verificar que las entradas cumplen schemas.

**Pasos:**
1. Ejecutar `node scripts/admin-ui-assembly-check.js --ui-factory`
2. Revisar warnings:
   - Entradas inválidas contra Registry Schema
   - Rutas island visibles sin entry en registry
3. Corregir errores encontrados

**Criterio de éxito:** Assembly Check pasa sin errores (warnings OK en modo normal).

### 5.4. Fase 4: Activación Gradual

**Objetivo:** Activar pantallas una a una (draft → active).

**Pasos:**
1. Seleccionar una pantalla para activar
2. Verificar que cumple todos los requisitos:
   - Pasa validación de Registry Schema
   - Tiene `screenDef` si está activa (opcional inicialmente)
   - Flags de activación se cumplen
3. Cambiar `status: 'draft'` → `status: 'active'` en el registry
4. Verificar que la pantalla funciona correctamente
5. Repetir para siguiente pantalla

**Criterio de éxito:** Cada pantalla activada funciona correctamente y pasa validación.

---

## 6. Qué Significa "Migrada"

Una pantalla Admin está **migrada** cuando:

1. ✅ Tiene entrada en UI Admin Registry Runtime
2. ✅ La entrada cumple UI Admin Registry Schema v1
3. ✅ La entrada tiene `status='active'` (o `'deprecated'` si se retira)
4. ✅ La entrada pasa validación en Assembly Check
5. ✅ La Factory puede validarla (shadow mode) o renderizarla (enforced mode)

**NO significa:**
- ❌ Que la UI haya sido refactorizada
- ❌ Que el código del handler haya cambiado
- ❌ Que se haya añadido `screenDef` (opcional)
- ❌ Que esté en enforced mode (shadow es suficiente)

---

## 7. Qué NO Hacer

### 7.1. No Activar Enforced Mode Todavía

**Razón:** Enforced mode bloquea renderizado si no cumple contratos. Solo activar cuando todas las pantallas estén migradas y validadas.

**Cuándo activar:**
- Todas las pantallas visibles tienen entrada en registry
- Todas las entradas pasan validación de schemas
- Se ha probado en producción en shadow mode sin problemas

### 7.2. No Refactorizar UI de Producto

**Razón:** La migración es sobre **gobierno y validación**, no sobre refactorización de UI.

**Qué hacer:**
- Añadir entradas al registry
- Validar que cumplen schemas
- Activar gradualmente

**Qué NO hacer:**
- Cambiar HTML de las pantallas
- Modificar handlers existentes
- Refactorizar código de negocio

### 7.3. No Inventar Pantallas Nuevas

**Razón:** Solo migramos pantallas **existentes y visibles**.

**Qué hacer:**
- Migrar pantallas que ya existen y están visibles en sidebar
- Descubrir automáticamente desde Sidebar Registry

**Qué NO hacer:**
- Crear entradas para pantallas que no existen
- Añadir rutas al sidebar sin crear handlers
- Migrar pantallas que no están visibles (a menos que se activen)

### 7.4. No Borrar Entradas Automáticamente

**Razón:** Las entradas pueden estar ocultas temporalmente o en proceso de migración.

**Qué hacer:**
- Mantener entradas existentes
- Actualizar si cambian (path, routeKey, etc.)
- Ocultar con `--hide-missing` solo si es intencional

**Qué NO hacer:**
- Borrar entradas que no están en sidebar
- Renombrar IDs existentes
- Cambiar status sin justificación

---

## 8. Validación en Assembly Check

### 8.1. Validación de Schemas

**Check:** `UI_FACTORY_REGISTRY_ENTRY_VALID`

**Qué valida:**
- Cada entrada cumple UI Admin Registry Schema v1
- Si tiene `screenDef` y está activa, cumple UI Admin Schema v1

**Modo normal:** Warnings si falla
**Modo estricto:** Error (bloquea) si falla

### 8.2. Validación de Coherencia Sidebar ↔ Registry

**Check:** `UI_FACTORY_SIDEBAR_MISSING_ENTRIES`

**Qué valida:**
- Todas las rutas island visibles en sidebar tienen entry en UI Admin Registry Runtime

**Modo normal:** Warning si faltan entradas
**Modo estricto:** Error (bloquea) si faltan entradas

**Cómo corregir:**
```bash
node scripts/discover-admin-screens.js --apply
```

---

## 9. Comandos de Verificación

### 9.1. Verificar Sidebar

```bash
npm run audit:sidebar
```

**Qué hace:** Audita rutas visibles en sidebar contra Router Registry.

### 9.2. Descubrir Pantallas

```bash
node scripts/discover-admin-screens.js
```

**Qué hace:** Genera reporte de pantallas a migrar.

### 9.3. Aplicar Descubrimiento

```bash
node scripts/discover-admin-screens.js --apply
```

**Qué hace:** Actualiza UI Admin Registry Runtime con entradas sugeridas.

### 9.4. Validar Registry

```bash
node scripts/admin-ui-assembly-check.js --ui-factory
```

**Qué hace:** Valida que todas las entradas cumplen schemas y coherencia sidebar ↔ registry.

### 9.5. Validar en Modo Estricto

```bash
node scripts/admin-ui-assembly-check.js --ui-factory --strict
```

**Qué hace:** Mismo que anterior, pero bloquea si hay errores.

**Criterio:** Debe pasar sin errores antes de activar enforced mode.

### 9.6. Probar Rutas en Shadow Mode

```bash
curl -i http://localhost:3000/admin
curl -i http://localhost:3000/admin/theme-studio-canon
curl -i http://localhost:3000/admin/contexts
```

**Qué verificar:**
- Headers `X-UI-FACTORY: shadow` presentes
- Headers `X-UI-Factory-Entry-Id` presentes (si está registrada)
- Pantallas se renderizan correctamente
- No hay errores en logs

---

## 10. Ejemplo de Migración Completa

### Paso 1: Descubrir

```bash
$ node scripts/discover-admin-screens.js

[DISCOVER] Iniciando descubrimiento de pantallas Admin...

[DISCOVER] Encontradas 25 rutas visibles en sidebar

[DISCOVER] ════════════════════════════════════════
[DISCOVER] RESUMEN:
[DISCOVER]   Total rutas visibles en sidebar: 25
[DISCOVER]   Rutas island: 20
[DISCOVER]   Rutas no-island: 0
[DISCOVER]   Rutas no encontradas en Router: 0
[DISCOVER]   Entradas actuales en registry: 5
[DISCOVER]   Entradas nuevas sugeridas: 15
[DISCOVER]   Entradas a actualizar: 0
[DISCOVER] ════════════════════════════════════════

📋 ENTRADAS SUGERIDAS:
  [NUEVA] admin_dashboard (admin-dashboard) -> /admin
  [NUEVA] admin_theme_studio_canon (theme-studio-canon) -> /admin/theme-studio-canon
  ...
```

### Paso 2: Aplicar

```bash
$ node scripts/discover-admin-screens.js --apply

[DISCOVER] Aplicando cambios al registry runtime...

[DISCOVER] ✅ Añadida: admin_dashboard
[DISCOVER] ✅ Añadida: admin_theme_studio_canon
...

[DISCOVER] ✅ Registry runtime actualizado: src/core/admin/ui-factory/ui-admin-registry.runtime.js
[DISCOVER]   Total entradas: 20
```

### Paso 3: Validar

```bash
$ node scripts/admin-ui-assembly-check.js --ui-factory

[ASSEMBLY_CHECK] Verificando UI Admin Registry Runtime...
[ASSEMBLY_CHECK] Validadas 20 entradas del registry
[ASSEMBLY_CHECK] Verificando coherencia sidebar ↔ registry...
[ASSEMBLY_CHECK] ════════════════════════════════════════
[ASSEMBLY_CHECK] Resumen:
[ASSEMBLY_CHECK]   ✅ OK: 45
[ASSEMBLY_CHECK]   ⚠️  Warnings: 2
[ASSEMBLY_CHECK]   ❌ Errors: 0
```

### Paso 4: Activar una Pantalla

Editar `ui-admin-registry.runtime.js`:

```javascript
{
  id: 'admin_dashboard',
  routeKey: 'admin-dashboard',
  status: 'active', // Cambiar de 'draft' a 'active'
  ...
}
```

Validar:

```bash
$ node scripts/admin-ui-assembly-check.js --ui-factory --strict
# Debe pasar sin errores
```

---

## 11. Troubleshooting

### 11.1. Ruta No Encontrada en Router Registry

**Síntoma:** `missing_in_router` tiene entradas.

**Causa:** La ruta está en sidebar pero no en Router Registry.

**Solución:**
1. Verificar que la ruta existe en `admin-route-registry.js`
2. Si no existe, añadirla al Router Registry primero
3. Re-ejecutar discover

### 11.2. Ruta API en Sidebar

**Síntoma:** `sidebar_visible_api` tiene entradas.

**Causa:** Rutas `/admin/api/*` están visibles en sidebar (error estructural).

**Solución:**
1. Remover rutas API del sidebar (no deben estar visibles)
2. Las APIs no son UIs Admin, no se migran

### 11.3. Entry Inválida en Assembly Check

**Síntoma:** `UI_FACTORY_REGISTRY_ENTRY_INVALID` en assembly check.

**Causa:** La entrada no cumple UI Admin Registry Schema v1.

**Solución:**
1. Revisar errores de validación en el reporte
2. Corregir la entrada según el schema
3. Re-ejecutar assembly check

### 11.4. Entrada Faltante en Registry

**Síntoma:** `UI_FACTORY_SIDEBAR_MISSING_ENTRIES` en assembly check.

**Causa:** Ruta island visible en sidebar no tiene entry en registry.

**Solución:**
```bash
node scripts/discover-admin-screens.js --apply
```

---

## 12. Conclusión

El proceso de migración es **reproducible, incremental y reversible**:

1. **Descubrimiento automático** desde Sidebar Registry
2. **Sincronización opcional** al UI Admin Registry Runtime
3. **Validación continua** en Assembly Check
4. **Activación gradual** una pantalla a la vez

**Principio fundamental:** Solo migramos pantallas **existentes y visibles**. No inventamos, no refactorizamos, solo gobernamos.

---

## 13. Retirada Canónica de Pantallas

### 13.1. Proceso de Retirada

Cuando una pantalla Admin debe ser eliminada del sistema, se debe seguir este proceso canónico:

1. **Eliminar del UI Admin Registry Runtime**
   - Remover la entrada completa del registry
   - O marcar `status: "deprecated"` con `deprecatedReason` y `deprecatedAt`

2. **Eliminar del Sidebar Registry**
   - Remover la entrada del sidebar para que no aparezca en navegación

3. **Eliminar del Router Registry**
   - Remover la ruta del `admin-route-registry.js`
   - Esto previene que la ruta sea accesible

4. **Eliminar Handler (opcional)**
   - Si el handler ya no es usado, puede eliminarse
   - Verificar que no hay otras referencias antes de eliminar

5. **Documentar la Retirada**
   - Añadir nota en este documento explicando:
     - Motivo de retirada
     - Fecha de retirada
     - Funcionalidad alternativa (si existe)

### 13.2. Ejemplo: Retirada de `/admin/system/diagnostics`

**Fecha:** 2025-12-29  
**Motivo:** Pantalla obsoleta, problemas visuales, funcionalidad absorbida por Assembly Check + Observability canónicas.

**Acciones realizadas:**
- ✅ Eliminada entrada `system-diagnostics` del UI Admin Registry Runtime
- ✅ Eliminada entrada del Sidebar Registry
- ✅ Eliminada ruta `system-diagnostics-page` del Router Registry
- ✅ Funcionalidad de diagnóstico disponible en `/admin/system/assembly` (Assembly Check)

**Verificación:**
- ✅ Assembly Check pasa sin errores
- ✅ No hay rutas huérfanas
- ✅ No hay enlaces rotos en sidebar

---

**Fin del documento: Migración de UIs Admin al Sistema Canónico v1**

