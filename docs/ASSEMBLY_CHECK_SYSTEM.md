# Assembly Check System (ACS) v1.0
## AuriPortal - Sistema Canónico de Verificación de Ensamblaje

**Versión**: v1.0.0  
**Fecha de Establecimiento**: 2025-01-XX  
**Estado**: ✅ LEY OPERATIVA DEL PROYECTO

---

## ⚠️ ATENCIÓN (AGENTES IA)

**El Assembly Check System (ACS) es el gate técnico obligatorio para declarar una feature Admin UI como DONE.**

**No se considera implementado nada si el ACS reporta estado BROKEN o WARN.**

Este documento es la **fuente canónica** para el sistema de verificación de ensamblaje y **referencia obligatoria** para agentes IA.

---

## 🎯 PROPÓSITO

El Assembly Check System (ACS) es un subsistema canónico de AuriPortal que:

- ✅ Verifica ensamblaje real de Admin UIs
- ✅ Detecta errores ANTES de que lleguen al usuario
- ✅ Persiste resultados en PostgreSQL
- ✅ Expone una UI visible en `/admin/system/assembly`
- ✅ Integra con el protocolo done-means-visible
- ✅ Elimina definitivamente ROUTER_ERROR por ensamblaje roto

---

## 📜 ARQUITECTURA

### Componentes Principales

1. **Base de Datos (PostgreSQL)**
   - `assembly_checks` - Definiciones de checks
   - `assembly_check_runs` - Ejecuciones de checks
   - `assembly_check_results` - Resultados individuales

2. **Repositorios**
   - `assembly-check-repo-pg.js` - Acceso a datos de checks
   - `assembly-check-run-repo-pg.js` - Acceso a datos de ejecuciones
   - `assembly-check-result-repo-pg.js` - Acceso a datos de resultados

3. **Engine**
   - `assembly-check-engine.js` - Motor de verificación

4. **API**
   - `admin-assembly-check-api.js` - Endpoints API
   - `GET /admin/api/assembly/status` - Estado actual
   - `POST /admin/api/assembly/run` - Ejecutar checks
   - `GET /admin/api/assembly/runs` - Listar ejecuciones
   - `GET /admin/api/assembly/runs/:run_id` - Detalle de ejecución
   - `POST /admin/api/assembly/initialize` - Inicializar checks

5. **UI**
   - `admin-assembly-check-ui.js` - UI visible en `/admin/system/assembly`

---

## 🔍 VERIFICACIONES REALIZADAS

Para cada Admin UI target, el ACS verifica:

1. **Ruta en Registry**
   - ✅ Ruta existe en `admin-route-registry.js`
   - ❌ Si no existe → `ACS_ROUTE_NOT_FOUND`

2. **Feature Flag (si aplica)**
   - ✅ Feature flag activo (si está configurado)
   - ⚠️ Si no está activo → `ACS_FEATURE_FLAG_INACTIVE` (WARN)

3. **Handler Importable**
   - ✅ Handler se puede importar sin errores
   - ❌ Si falla → `ACS_HANDLER_IMPORT_ERROR`

4. **Handler Ejecutable**
   - ✅ Handler se ejecuta sin errores
   - ❌ Si falla → `ACS_HANDLER_EXECUTION_ERROR`

5. **HTML No Vacío**
   - ✅ HTML tiene contenido
   - ❌ Si está vacío → `ACS_HTML_EMPTY`

6. **Placeholders Resueltos**
   - ✅ No hay placeholders sin resolver (ej: `{{PLACEHOLDER}}`)
   - ⚠️ Si hay placeholders → `ACS_PLACEHOLDER_UNRESOLVED` (WARN)

7. **Sidebar Presente (si aplica)**
   - ✅ Sidebar aparece en HTML (si `expected_sidebar = true`)
   - ⚠️ Si no aparece → `ACS_SIDEBAR_MISSING` (WARN)

---

## 📊 ESTADOS Y CÓDIGOS

### Estados

- **OK**: Todo correcto, ensamblaje perfecto
- **WARN**: Problemas menores que no impiden uso pero requieren atención
- **BROKEN**: Error crítico que impide el uso

### Códigos ACS

- `ACS_ROUTE_NOT_FOUND` - Ruta no encontrada en registry
- `ACS_FEATURE_FLAG_INACTIVE` - Feature flag no activo
- `ACS_HANDLER_NOT_FOUND` - Handler no encontrado
- `ACS_HANDLER_IMPORT_ERROR` - Error importando handler
- `ACS_HANDLER_EXECUTION_ERROR` - Error ejecutando handler
- `ACS_HTML_EMPTY` - HTML vacío
- `ACS_PLACEHOLDER_UNRESOLVED` - Placeholders sin resolver
- `ACS_SIDEBAR_MISSING` - Sidebar esperado pero no encontrado
- `ACS_INVALID_RESPONSE` - Handler no devolvió Response válida

---

## 🚀 USO

### Inicialización

La primera vez, es necesario inicializar los checks desde el Admin Route Registry:

```bash
POST /admin/api/assembly/initialize
```

Esto crea automáticamente checks para todas las rutas 'island' del registry.

### Ejecución Manual

Desde la UI en `/admin/system/assembly`, hacer clic en "Ejecutar Assembly Check".

O vía API:

```bash
POST /admin/api/assembly/run
```

### Verificación de Estado

Acceder a `/admin/system/assembly` para ver:
- Últimas ejecuciones
- Estado de cada check
- Detalles de resultados

---

## 🔗 INTEGRACIÓN CON DONE-MEANS-VISIBLE

El ACS es el **gate técnico obligatorio** para declarar una feature Admin UI como DONE.

**Regla absoluta**: Una feature NO está completada si el ACS reporta estado BROKEN o WARN.

Ver `docs/FEATURE_COMPLETION_PROTOCOL.md` para más detalles.

---

## 📋 MIGRACIÓN

La migración SQL está en:
- `database/migrations/v5.33.0-assembly-check-system.sql`

**IMPORTANTE**: Sin migración aplicada = sistema no existe.

Para aplicar la migración:
1. Verificar que PostgreSQL está corriendo
2. La migración se aplica automáticamente al arrancar el servidor (ver `database/pg.js`)

---

## 🎯 CONCLUSIÓN

**El Assembly Check System elimina definitivamente ROUTER_ERROR por ensamblaje roto.**

Una feature Admin UI debe:
1. Estar registrada en `admin-route-registry.js`
2. Tener handler mapeado en `admin-router-resolver.js`
3. Usar `renderAdminPage()`
4. **Pasar el Assembly Check System con estado OK**

Si no cumple estos requisitos, **NO está implementada**.

---

**Este sistema es LEY OPERATIVA del proyecto AuriPortal.**


