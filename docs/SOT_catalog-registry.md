# Source of Truth: Registro de Catálogos PDE

**Ruta Admin:** `/admin/pde/catalog-registry`  
**Fecha de Certificación:** 2025-01-XX  
**Fecha de Activación:** 2025-01-XX  
**Estado:** ✅ **ACTIVO EN PRODUCCIÓN** (Fase 1 completada)

---

## ✅ Estado de Activación

**ACTIVO:** Esta pantalla está completamente operativa y accesible en producción.

- ✅ Bloqueo legacy eliminado
- ✅ Handler moderno activo
- ✅ UI renderiza contenido real desde PostgreSQL
- ✅ Assembly Check verificado (OK)
- ✅ Sin dependencias de legacy o rutas externas

**Nota:** Esta es la primera pantalla Source of Truth PDE activa del sistema y sirve como plantilla maestra para las siguientes migraciones.

---

## Contrato Source of Truth

### PostgreSQL como Única Autoridad

- **Tabla:** `pde_catalog_registry`
- **Repositorio:** `src/infra/repos/pde-catalog-registry-repo-pg.js`
- **Servicio:** `src/services/pde-catalog-registry-service.js`
- **Endpoint:** `src/endpoints/admin-catalog-registry.js`

**Principio:** PostgreSQL es el **único** Source of Truth para metadata de catálogos PDE. No se consulta ninguna otra fuente (ClickUp, Kajabi, SQLite) para determinar estado, capacidades o disponibilidad de catálogos.

### Soft Delete Consistente

- **NO se usan DELETE físicos**
- Archivar catálogos: `UPDATE pde_catalog_registry SET status = 'archived'`
- Reactivar catálogos: `UPDATE pde_catalog_registry SET status = 'active'`
- Constraint en BD: `status IN ('active', 'archived')`

### Auditoría

- **created_at:** Timestamp automático al crear registro
- **updated_at:** Timestamp automático actualizado por trigger en cada UPDATE
- **Trigger:** `trigger_update_pde_catalog_registry_updated_at`

---

## Esquema de Base de Datos

```sql
CREATE TABLE pde_catalog_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_key VARCHAR(100) UNIQUE NOT NULL,
  label VARCHAR(255) NOT NULL,
  description TEXT,
  source_table VARCHAR(100) NOT NULL,
  source_endpoint VARCHAR(255),
  usable_for_motors BOOLEAN DEFAULT true,
  supports_level BOOLEAN DEFAULT false,
  supports_priority BOOLEAN DEFAULT false,
  supports_obligatory BOOLEAN DEFAULT false,
  supports_duration BOOLEAN DEFAULT false,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Campos Clave

- **catalog_key:** Clave canónica única (ej: `preparaciones_practica`)
- **source_table:** Nombre de la tabla PostgreSQL que contiene los datos
- **status:** Estado del registro (`active` | `archived`)
- **usable_for_motors:** Si el catálogo puede usarse en el Diseñador de Motores
- **supports_***:** Flags de capacidades soportadas

---

## Contrato de UI

### Renderizado

- ✅ Usa `renderAdminPage()` (contrato canónico)
- ✅ Sidebar correcto via `sidebar-registry.js`
- ✅ Active path: `/admin/pde/catalog-registry`

### Seguridad JavaScript

- ✅ **Sin onclick inline** - Usa data attributes + event delegation
- ✅ **Sin template strings en atributos HTML** - Usa `data-catalog-id` + `encodeURIComponent()`
- ✅ **JSON.parse/JSON.stringify** seguro para todas las comunicaciones API
- ✅ **DOM API preferida** - `addEventListener`, `querySelector`, `getElementById`
- ✅ **Escape HTML** correcto para prevenir XSS

### Ejemplo de Código Seguro

```javascript
// ❌ MAL: Template string en onclick
<button onclick="editarCatalog('${catalog.id}')">Editar</button>

// ✅ BIEN: Data attribute + event delegation
<button class="btn-editar-catalog" data-catalog-id="${idEscapado}">Editar</button>

document.addEventListener('click', function(event) {
  const editBtn = event.target.closest('.btn-editar-catalog');
  if (editBtn) {
    const catalogId = editBtn.getAttribute('data-catalog-id');
    editarCatalog(catalogId);
  }
});
```

---

## API Endpoints

### GET /admin/pde/catalog-registry
**Descripción:** Lista todos los catálogos (incluyendo archived)  
**Autenticación:** Requerida (Admin)  
**Respuesta:** HTML renderizado con tabla de catálogos

### GET /admin/pde/catalog-registry?format=json
**Descripción:** Lista catálogos en formato JSON (para dropdowns)  
**Query params:**
- `usable_for_motors=true` - Filtrar solo usable para motores
**Autenticación:** Requerida (Admin)  
**Respuesta:** `{ success: true, catalogs: [...] }`

### GET /admin/pde/catalog-registry/:id
**Descripción:** Obtiene un catálogo por ID  
**Autenticación:** Requerida (Admin)  
**Respuesta:** `{ success: true, catalog: {...} }`

### POST /admin/pde/catalog-registry
**Descripción:** Crea un nuevo catálogo  
**Autenticación:** Requerida (Admin)  
**Body:** 
```json
{
  "catalog_key": "preparaciones_practica",
  "label": "Preparaciones para la Práctica",
  "description": "...",
  "source_table": "preparaciones_practica",
  "source_endpoint": "/api/preparaciones-practica",
  "usable_for_motors": true,
  "supports_level": false,
  "supports_priority": true,
  "supports_obligatory": false,
  "supports_duration": false,
  "status": "active"
}
```
**Validación:**
- `catalog_key` requerido, formato: `^[a-z0-9_]+$`
- `label` requerido
- `source_table` requerido
- Error 409 si `catalog_key` ya existe

### PUT /admin/pde/catalog-registry/:id
**Descripción:** Actualiza metadata de un catálogo  
**Autenticación:** Requerida (Admin)  
**Body:** Campos parciales permitidos:
- `label`, `description`, `source_endpoint`
- `usable_for_motors`, `supports_level`, `supports_priority`, `supports_obligatory`, `supports_duration`
- `status` (`active` | `archived`)
**Restricciones:**
- `catalog_key` NO puede modificarse
- `source_table` NO puede modificarse

---

## Servicio de Negocio

### listCatalogs(options)
```javascript
const catalogs = await listCatalogs({ 
  onlyActive: false,  // true = solo activos, false = todos
  usableForMotors: true  // opcional: filtrar usable para motores
});
```

### getCatalogByKey(catalogKey)
```javascript
const catalog = await getCatalogByKey('preparaciones_practica');
```

### getCatalogById(id)
```javascript
const catalog = await getCatalogById('uuid-here');
```

### createCatalog(catalogData)
```javascript
const newCatalog = await createCatalog({
  catalog_key: 'nuevo_catalogo',
  label: 'Nuevo Catálogo',
  source_table: 'tabla_origen',
  // ... otros campos
});
```

### updateCatalogMeta(id, patch)
```javascript
const updated = await updateCatalogMeta(id, {
  label: 'Nuevo Label',
  status: 'archived'
});
```

---

## Validaciones

### catalog_key
- Formato: Solo letras minúsculas, números y guiones bajos (`^[a-z0-9_]+$`)
- Único: No puede duplicarse
- Inmutable: No puede modificarse después de crear

### status
- Valores permitidos: `active`, `archived`
- Default: `active`
- Constraint en BD garantiza valores válidos

### source_table
- Requerido al crear
- Inmutable: No puede modificarse después de crear

---

## Integración con Diseñador de Motores

El registro de catálogos es usado por el Diseñador de Motores para:
- Dropdowns dinámicos de catálogos disponibles
- Validación de `catalog_key` antes de crear motores
- Filtrado por capacidades (supports_level, supports_priority, etc.)

**Endpoint para motores:**
```
GET /admin/pde/catalog-registry?format=json&usable_for_motors=true
```

---

## Decisiones de Diseño

### ¿Por qué soft delete?
- **Auditoría:** Mantener historial de catálogos archivados
- **Referencias:** Evitar romper relaciones con motores existentes
- **Trazabilidad:** Saber qué catálogos existieron aunque ya no estén activos

### ¿Por qué catalog_key inmutable?
- **Estabilidad:** El catalog_key puede estar referenciado en código/configuración
- **Integridad:** Evitar romper relaciones al cambiar la clave
- **Simplicidad:** Si se necesita cambiar, mejor crear nuevo catálogo

### ¿Por qué source_table inmutable?
- **Consistencia:** La tabla origen no debería cambiar después de crear
- **Integridad:** Evitar confusiones sobre qué tabla contiene los datos
- **Simplicidad:** Si la tabla cambia, mejor crear nuevo catálogo

---

## Verificación de Certificación

### ✅ Criterios Cumplidos

1. **PostgreSQL como única autoridad:** ✅
   - No se consulta ClickUp/Kajabi/SQLite
   - Todas las operaciones van a PostgreSQL

2. **Soft delete consistente:** ✅
   - No hay DELETE físicos
   - Usa status='archived'

3. **Auditoría respetada:** ✅
   - created_at y updated_at presentes
   - Trigger actualiza updated_at automáticamente

4. **Renderizado Admin moderno:** ✅
   - Usa renderAdminPage()
   - Sidebar correcto

5. **JavaScript seguro:** ✅
   - Sin onclick inline
   - Sin template strings en atributos
   - JSON.parse/stringify seguro
   - DOM API preferida

6. **Contrato API claro:** ✅
   - Endpoints documentados
   - Validaciones explícitas
   - Errores canónicos

7. **Activación en producción:** ✅
   - Bloqueo legacy eliminado (whitelist PDE_MODERN_ROUTES en router.js)
   - Handler moderno activo y funcionando
   - UI renderiza contenido real desde PostgreSQL
   - Ruta accesible: `/admin/pde/catalog-registry`

### 🟢 Assembly Check Status

**Estado actual:** OK (verificado después de correcciones)

**Correcciones aplicadas:**
- Actualizado `assembly-check-engine.js` para detectar `id="admin-sidebar-scroll"` correctamente
- Verificado que el HTML renderizado contiene todos los indicadores de sidebar requeridos

**Cómo verificar:**
1. Ejecutar: `POST /admin/api/assembly/initialize` (si no se ha inicializado)
2. Ejecutar: `POST /admin/api/assembly/run`
3. Verificar: `GET /admin/api/assembly/status`
4. Confirmar: `catalog-registry` aparece con estado `OK`

---

## Próximos Pasos (Fuera de Fase 1)

Estas mejoras quedan para fases futuras:
- [ ] Filtros avanzados en UI (por status, capacidades)
- [ ] Búsqueda por texto en catálogos
- [ ] Historial de cambios (audit log)
- [ ] Export/import de registros
- [ ] Validación de existencia de source_table en BD

---

## Referencias

- **Migración BD:** `database/migrations/v5.12.0-create-pde-catalog-registry.sql`
- **Documentación original:** `docs/PDE_CATALOG_REGISTRY_V1.md`
- **Repositorio:** `src/infra/repos/pde-catalog-registry-repo-pg.js`
- **Servicio:** `src/services/pde-catalog-registry-service.js`
- **Endpoint:** `src/endpoints/admin-catalog-registry.js`
- **Template HTML:** `src/core/html/admin/catalog-registry/catalog-list.html`

---

# Patrón Canónico para Pantallas Source of Truth PDE

**⚠️ REFERENCIA OBLIGATORIA:** Este patrón debe seguirse para TODAS las pantallas Source of Truth PDE futuras.

## Estructura de Ruta

### Convención de Nombres
- **Path:** `/admin/pde/<entity-name>`
- **Key en Registry:** `<entity-name>` (kebab-case)
- **Tipo:** `island` (handler específico antes del catch-all)

### Registro en Admin Route Registry

```javascript
// src/core/admin/admin-route-registry.js
{
  key: '<entity-name>',  // ej: 'catalog-registry'
  path: '/admin/pde/<entity-name>',  // ej: '/admin/pde/catalog-registry'
  type: 'island'
}
```

### Handler Mapping

```javascript
// src/core/admin/admin-router-resolver.js
const HANDLER_MAP = {
  '<entity-name>': () => import('../../endpoints/admin-<entity-name>.js'),
  // ej: 'catalog-registry': () => import('../../endpoints/admin-catalog-registry.js'),
};
```

---

## Reglas de Servicio (PostgreSQL único SOT)

### Arquitectura de Capas

```
Handler (endpoint)
    ↓
Servicio (lógica de negocio)
    ↓
Repositorio PostgreSQL (acceso a BD)
    ↓
PostgreSQL (Source of Truth único)
```

### Estructura de Archivos

1. **Repositorio:** `src/infra/repos/<entity>-repo-pg.js`
   - Extiende clase base abstracta si existe
   - Usa `database/pg.js` para queries
   - Retorna objetos raw de PostgreSQL (sin normalización)
   - Métodos: `list*()`, `getById()`, `getByKey()`, `create()`, `update()`

2. **Servicio:** `src/services/<entity>-service.js`
   - Lógica de negocio (validaciones, transformaciones)
   - Usa repositorio para acceso a BD
   - No importa `database/pg.js` directamente

3. **Endpoint:** `src/endpoints/admin-<entity>.js`
   - Handler HTTP (GET, POST, PUT)
   - Usa servicio para operaciones
   - Renderiza UI o retorna JSON según ruta

### Principios SOT

1. **PostgreSQL es ÚNICA autoridad**
   - ❌ NO consultar ClickUp
   - ❌ NO consultar Kajabi
   - ❌ NO consultar SQLite
   - ✅ TODO va a PostgreSQL

2. **Sin lógica en UI**
   - ❌ NO calcular estados en JavaScript
   - ❌ NO duplicar validaciones en frontend
   - ✅ UI solo muestra lo que viene del servidor

3. **Soft delete consistente**
   - ❌ NO usar DELETE físicos
   - ✅ Usar campo `status` con valores `'active'` | `'archived'`
   - ✅ Constraint CHECK en BD: `status IN ('active', 'archived')`

4. **Auditoría obligatoria**
   - ✅ Campo `created_at TIMESTAMPTZ DEFAULT now()`
   - ✅ Campo `updated_at TIMESTAMPTZ DEFAULT now()`
   - ✅ Trigger automático para actualizar `updated_at`

---

## Soft Delete y Auditoría

### Migración SQL

```sql
CREATE TABLE <entity> (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- ... campos específicos ...
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_<entity>_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_<entity>_updated_at
  BEFORE UPDATE ON <entity>
  FOR EACH ROW
  EXECUTE FUNCTION update_<entity>_updated_at();
```

### Operaciones

- **Archivar:** `UPDATE <entity> SET status = 'archived' WHERE id = $1`
- **Reactivar:** `UPDATE <entity> SET status = 'active' WHERE id = $1`
- **Listar activos:** `SELECT * FROM <entity> WHERE status = 'active'`
- **Listar todos:** `SELECT * FROM <entity>` (sin filtro de status)

---

## Reglas de UI (renderAdminPage, sidebar registry)

### Renderizado Obligatorio

```javascript
// src/endpoints/admin-<entity>.js
import { renderAdminPage } from '../core/admin/admin-page-renderer.js';

export async function renderEntityList(request, env) {
  // ... obtener datos ...
  
  return renderAdminPage({
    title: 'Nombre de la Entidad',
    contentHtml: htmlTemplate,
    activePath: '/admin/pde/<entity-name>',
    userContext: { isAdmin: true }
  });
}
```

### Sidebar Registry

```javascript
// src/core/admin/sidebar-registry.js
{
  id: '<entity-id>',
  label: 'Etiqueta Legible',
  icon: '📚',
  route: '/admin/pde/<entity-name>',
  section: '🌟 Transmutación energética de la PDE',  // o sección apropiada
  visible: true,
  order: <número>
}
```

### Template HTML

- **Ubicación:** `src/core/html/admin/<entity>/<entity>-list.html`
- **Uso:** Leer con `readFileSync` y reemplazar placeholders
- **Estructura:** Tabla, modales, formularios según necesidad

---

## Reglas de JavaScript Seguro

### ❌ PROHIBIDO

```javascript
// ❌ Template strings en atributos HTML
<button onclick="editarItem('${item.id}')">Editar</button>

// ❌ innerHTML con contenido no sanitizado
element.innerHTML = userInput;

// ❌ JSON.parse sin try/catch
const data = JSON.parse(responseText);
```

### ✅ OBLIGATORIO

```javascript
// ✅ Data attributes + event delegation
<button class="btn-editar-item" data-item-id="${idEscapado}">Editar</button>

document.addEventListener('click', function(event) {
  const btn = event.target.closest('.btn-editar-item');
  if (btn) {
    const id = btn.getAttribute('data-item-id');
    editarItem(id);
  }
});

// ✅ JSON.parse/stringify con manejo de errores
try {
  const data = await response.json();
  // usar data
} catch (error) {
  console.error('Error parsing JSON:', error);
  alert('Error al procesar respuesta');
}

// ✅ DOM API preferida
const element = document.getElementById('id');
element.value = 'value';
element.checked = true;
```

### Escape HTML

```javascript
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Usar en templates
const labelEscapado = escapeHtml(item.label);
const idEscapado = escapeHtml(item.id);
```

### URL Encoding

```javascript
// ✅ Para parámetros en URLs
const encodedId = encodeURIComponent(String(id));
const response = await fetch(`/admin/pde/<entity>/${encodedId}`);

// ✅ Para atributos data-*
const idEscapado = String(id).replace(/"/g, '&quot;');
<button data-item-id="${idEscapado}">...</button>
```

---

## Reglas de Ensamblaje Verificadas por ACS

### Assembly Check System (ACS)

El ACS verifica automáticamente:

1. **Ruta registrada:** La ruta existe en `admin-route-registry.js`
2. **Handler importable:** El handler se puede importar sin errores
3. **Handler ejecutable:** El handler ejecuta y retorna Response válida
4. **HTML no vacío:** El HTML renderizado tiene contenido
5. **Placeholders resueltos:** No quedan `{{PLACEHOLDER}}` sin resolver
6. **Sidebar presente:** Si `expected_sidebar=true`, el HTML contiene indicadores de sidebar

### Indicadores de Sidebar

El ACS busca en el HTML renderizado:
- `id="sidebar"`
- `id="admin-sidebar"`
- `id="admin-sidebar-scroll"` ⭐ **Actualizado para usar este**
- `{{SIDEBAR_MENU}}` (solo antes de render)
- `sidebar-registry`
- `sidebar-client.js`

### Inicializar Check en ACS

```sql
-- El check se crea automáticamente al inicializar desde registry
-- O manualmente:
INSERT INTO assembly_checks (
  ui_key,
  route_path,
  display_name,
  feature_flag_key,
  expected_sidebar,
  enabled
) VALUES (
  '<entity-name>',
  '/admin/pde/<entity-name>',
  'Nombre Legible',
  NULL,  -- o feature flag si aplica
  true,
  true
);
```

### Estado Esperado en ACS

- **OK:** ✅ Todos los checks pasan
- **WARN:** ⚠️ Problemas menores (placeholders sin resolver, sidebar con formato diferente)
- **BROKEN:** ❌ Errores críticos (handler no encontrado, HTML vacío)

**Objetivo:** Toda pantalla Source of Truth debe aparecer como 🟢 **OK** en ACS.

---

## Checklist de Certificación Final

Antes de declarar una pantalla Source of Truth como **certificada**, verificar:

### A) Diagnóstico
- [ ] Ruta registrada en `admin-route-registry.js` como tipo `island`
- [ ] Handler mapeado en `admin-router-resolver.js`
- [ ] Sidebar entry agregada en `sidebar-registry.js`
- [ ] Sin errores de sintaxis (`node --check` pasa)

### B) Alineación Source of Truth
- [ ] PostgreSQL como única autoridad (no consulta ClickUp/Kajabi/SQLite)
- [ ] Soft delete usando `status='archived'` (sin DELETE físicos)
- [ ] Auditoría con `created_at` y `updated_at` + trigger automático
- [ ] Constraint CHECK en BD para `status`
- [ ] Repositorio en `src/infra/repos/<entity>-repo-pg.js`
- [ ] Servicio en `src/services/<entity>-service.js`

### C) Ensamblaje Admin Moderno
- [ ] Usa `renderAdminPage()` para renderizado
- [ ] Sidebar correcto via `sidebar-registry.js`
- [ ] Template HTML en ubicación canónica
- [ ] Sin `onclick` inline - usa data attributes + event delegation
- [ ] Sin template strings en atributos HTML
- [ ] JSON.parse/stringify seguro con try/catch
- [ ] DOM API preferida (no innerHTML inseguro)
- [ ] Escape HTML correcto para prevenir XSS
- [ ] URL encoding para parámetros

### D) Verificación
- [ ] `node --check` pasa sin errores
- [ ] Assembly Check muestra estado **OK** (no WARN ni BROKEN)
- [ ] UI carga en navegador sin errores
- [ ] Sin errores en consola del navegador
- [ ] Modales/funcionalidades JavaScript funcionan correctamente

### E) Documentación
- [ ] Documentación creada en `docs/SOT_<entity>.md`
- [ ] Incluye contrato Source of Truth
- [ ] Incluye esquema de BD
- [ ] Incluye API endpoints documentados
- [ ] Incluye decisiones de diseño justificadas
- [ ] Incluye checklist de certificación (este mismo)

### F) Bloqueo de Desviaciones
- [ ] NO hay rutas legacy activas para la misma entidad
- [ ] NO se reutilizan handlers antiguos
- [ ] NO hay rutas duplicadas
- [ ] NO se consulta ningún sistema externo en runtime

---

## Orden de Implementación

1. **Migración BD:** Crear tabla con soft delete y auditoría
2. **Repositorio:** Implementar acceso a PostgreSQL
3. **Servicio:** Implementar lógica de negocio
4. **Endpoint:** Implementar handler HTTP
5. **Template:** Crear HTML con JavaScript seguro
6. **Registry:** Registrar ruta y sidebar
7. **ACS:** Inicializar check y verificar OK
8. **Documentación:** Crear `docs/SOT_<entity>.md`

**NO avanzar al siguiente paso hasta que el anterior esté completo y verificado.**

---

## Ejemplo Completo: Catalog Registry

Esta pantalla (`/admin/pde/catalog-registry`) es el **ejemplo de referencia** que sigue este patrón al 100%.

**Archivos:**
- BD: `database/migrations/v5.12.0-create-pde-catalog-registry.sql`
- Repositorio: `src/infra/repos/pde-catalog-registry-repo-pg.js`
- Servicio: `src/services/pde-catalog-registry-service.js`
- Endpoint: `src/endpoints/admin-catalog-registry.js`
- Template: `src/core/html/admin/catalog-registry/catalog-list.html`
- Documentación: `docs/SOT_catalog-registry.md` (este archivo)

**Estado ACS:** ✅ OK (después de correcciones)

**Usar como plantilla para futuras migraciones.**

