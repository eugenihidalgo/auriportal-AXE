# 🔍 Diagnóstico: Sistema de Proyectos MASTER

**Fecha**: 2026-01-05  
**Objetivo**: Identificar qué existe y qué NO existe sobre proyectos en el repositorio  
**Estado**: ✅ COMPLETADO

---

## 📋 Resumen Ejecutivo

**Conclusión**: No existe un sistema canónico de Proyectos en MASTER. Existe:
- ✅ Ruta placeholder `/master/templo-luz/proyectos` (solo HTML básico)
- ✅ Soporte en `student_activation_limits` para `domain='projects'`
- ❌ NO existen tablas canónicas: `project_categories`, `projects_catalog`, `student_project_state`
- ❌ NO existen endpoints `/master/api/projects/**`
- ❌ NO existe servicio `project-service.js`
- ❌ NO existen repositorios de proyectos
- ❌ NO existen señales `project.*` registradas
- ❌ NO existe UI funcional (solo placeholder)

**Recomendación**: Crear sistema canónico nuevo en paralelo, espejo de Lugares MASTER.

---

## 🔎 Qué EXISTE

### 1. Ruta MASTER (Placeholder)

**Archivo**: `src/endpoints/master-templo-luz-proyectos.js`

**Estado**: Existe pero solo contiene HTML placeholder básico.

**Contenido actual**:
```javascript
export default async function masterTemploLuzProyectosHandler(request, env, ctx) {
  return renderMasterPage({
    title: 'Proyectos Activados - Templo de Luz',
    contentHtml: `
      <div style="padding: 2rem;">
        <h1>Proyectos Activados</h1>
        <p>Este espacio formará parte del Templo de Luz.</p>
        <p>Infraestructura lista. Contenido en fase posterior.</p>
      </div>
    `,
    activePath: '/master/templo-luz/proyectos',
    universeId: 'templo_luz'
  });
}
```

**Registro**:
- ✅ Registrado en `master-route-registry.js` (key: `master-templo-luz-proyectos`, type: `island`)
- ✅ Registrado en `master-sidebar-registry.js` (label: "Proyectos", icon: 📜)
- ✅ Mapeado en `master-router-resolver.js`

**Conclusión**: Ruta existe pero NO tiene funcionalidad.

---

### 2. Soporte en `student_activation_limits`

**Tabla**: `student_activation_limits` (creada en migración v5.54.0)

**Estado**: ✅ Ya soporta `domain='projects'`

**Evidencia**:
```sql
-- De v5.54.0-places-system-v1.sql
CREATE TABLE IF NOT EXISTS student_activation_limits (
  ...
  domain VARCHAR(50) NOT NULL CHECK (domain IN ('places', 'projects')),
  ...
);
```

**Conclusión**: La tabla ya está preparada para proyectos. NO requiere cambios.

---

### 3. Referencias en Código Legacy

**Archivos encontrados** (legacy, NO canónico):

1. **`src/endpoints/admin-transmutaciones-proyectos-api.js`**
   - Endpoints legacy en Admin (`/admin/api/transmutaciones/proyectos/*`)
   - NO es canónico, NO es MASTER
   - Usa tablas legacy eliminadas en v5.54.0

2. **`src/endpoints/admin-api-student-domains.js`**
   - Endpoints legacy: `api-students-domains-projects*`
   - NO es canónico, NO es MASTER

3. **`database/pg.js`**
   - Referencias a tablas legacy eliminadas:
     - `transmutaciones_proyectos` (eliminada en v5.54.0)
     - `transmutaciones_proyectos_estado` (eliminada en v5.54.0)
     - `alumnos_proyectos` (eliminada en v5.54.0)

**Conclusión**: Código legacy existe pero usa tablas eliminadas. NO es funcional.

---

### 4. Señales (Parcial)

**Archivo**: `src/core/student/signals/student-signal-registry.js`

**Estado**: Existen referencias a `project.*` en el registry pero NO están registradas completamente.

**Evidencia**:
```javascript
// Línea 171: Referencia a project_ref en payload
project_ref: 'Referencia del proyecto activado',

// Línea 371: Referencia a domain='projects'
domain: 'Dominio (places, projects)',
```

**Conclusión**: Preparado para señales pero NO implementadas.

---

## ❌ Qué NO EXISTE

### 1. Tablas Canónicas

**Tablas requeridas** (NO existen):
- ❌ `project_categories` - Clasificaciones de proyectos
- ❌ `projects_catalog` - Catálogo de proyectos
- ❌ `student_project_state` - Estado alumno-proyecto

**Nota**: Las tablas legacy fueron eliminadas en migración v5.54.0:
```sql
DROP TABLE IF EXISTS transmutaciones_proyectos_estado CASCADE;
DROP TABLE IF EXISTS transmutaciones_proyectos CASCADE;
DROP TABLE IF EXISTS alumnos_proyectos CASCADE;
```

**Conclusión**: NO hay tablas canónicas. Se deben crear desde cero.

---

### 2. Funciones SQL

**Funciones requeridas** (NO existen para proyectos):
- ❌ `calculate_days_since_clean()` - Ya existe para lugares, se puede reutilizar
- ❌ `calculate_health_status()` - Ya existe para lugares, se puede reutilizar

**Conclusión**: Las funciones existen para lugares. Se pueden reutilizar (son genéricas).

---

### 3. Repositorios

**Repositorios requeridos** (NO existen):
- ❌ `src/core/repos/project-categories-repo.js` (contrato)
- ❌ `src/infra/repos/project-categories-repo-pg.js` (implementación)
- ❌ `src/core/repos/projects-catalog-repo.js` (contrato)
- ❌ `src/infra/repos/projects-catalog-repo-pg.js` (implementación)
- ❌ `src/core/repos/student-project-state-repo.js` (contrato)
- ❌ `src/infra/repos/student-project-state-repo-pg.js` (implementación)

**Referencia**: Lugares tiene:
- ✅ `place-category-repo-pg.js`
- ✅ `place-catalog-repo-pg.js`
- ✅ `student-place-state-repo-pg.js`

**Conclusión**: NO existen repositorios. Se deben crear espejo de Lugares.

---

### 4. Servicio Canónico

**Servicio requerido** (NO existe):
- ❌ `src/services/project-service.js`

**Referencia**: Lugares tiene:
- ✅ `src/services/place-service.js` (completo, con todas las funciones)

**Conclusión**: NO existe servicio. Se debe crear espejo de `place-service.js`.

---

### 5. Endpoints MASTER API

**Endpoints requeridos** (NO existen):
- ❌ `GET /master/api/projects/active`
- ❌ `POST /master/api/projects/clean`
- ❌ `POST /master/api/projects/clean-bulk`
- ❌ `POST /master/api/projects/clean-all`
- ❌ `GET /master/api/projects/student/:student_id`
- ❌ `POST /master/api/projects/activate`
- ❌ `POST /master/api/projects/deactivate`
- ❌ `PATCH /master/api/projects/state/:id`
- ❌ `POST /master/api/projects/limit`
- ❌ `POST /master/api/projects/create-for-student`
- ❌ `GET /master/api/projects-catalog`
- ❌ `POST /master/api/projects-catalog`
- ❌ `PATCH /master/api/projects-catalog/:id`
- ❌ `DELETE /master/api/projects-catalog/:id`
- ❌ `GET /master/api/project-categories`
- ❌ `POST /master/api/project-categories`
- ❌ `PATCH /master/api/project-categories/:id`
- ❌ `DELETE /master/api/project-categories/:id`
- ❌ `POST /master/api/project-categories/reorder` (opcional)

**Referencia**: Lugares tiene:
- ✅ `src/endpoints/master-api-places.js` (completo, todos los endpoints)

**Conclusión**: NO existen endpoints. Se deben crear espejo de `master-api-places.js`.

---

### 6. Registro de Rutas

**Estado**: Las rutas `/master/api/projects/**` NO están registradas en:
- ❌ `master-route-registry.js`
- ❌ `MASTER_HANDLER_MAP` en `master-router-resolver.js`

**Conclusión**: NO están registradas. Se deben registrar con `type: 'api'`.

---

### 7. Señales Registradas

**Señales requeridas** (NO registradas):
- ❌ `project.activated`
- ❌ `project.deactivated`
- ❌ `project.cleaned`
- ❌ `project.cleaned.bulk`
- ❌ `project.cleaned.all`
- ❌ `project.deactivated.all`
- ❌ `project.category.created`
- ❌ `project.category.updated`
- ❌ `project.category.reordered`
- ❌ `project.category.deactivated`
- ❌ `project.activation_limit.updated`

**Referencia**: Lugares tiene todas estas señales registradas en `student-signal-registry.js`.

**Conclusión**: NO están registradas. Se deben registrar.

---

### 8. UI Cliente JavaScript

**Cliente requerido** (NO existe):
- ❌ `public/js/master/master-proyectos-client.js`

**Referencia**: Lugares tiene:
- ✅ `public/js/master/master-lugares-client.js` (completo, 3 tabs, order pipeline)

**Conclusión**: NO existe cliente. Se debe crear espejo de `master-lugares-client.js`.

---

### 9. Documentación

**Documentación requerida** (NO existe):
- ❌ `docs/master/MASTER_PROJECTS_SYSTEM_V1.md`
- ❌ `docs/master/MASTER_PROJECTS_ASSET_EXECUTION_FORENSICS.md`

**Referencia**: Lugares tiene:
- ✅ `docs/master/MASTER_PLACES_SYSTEM_V1.md` (completo)
- ✅ `docs/master/MASTER_ASSET_EXECUTION_FORENSICS.md` (completo)

**Conclusión**: NO existe documentación. Se debe crear.

---

## 🗄️ Estado de Base de Datos

### Tablas Existentes (PostgreSQL)

**Tablas canónicas de Lugares** (existen, creadas en v5.54.0):
- ✅ `place_categories`
- ✅ `places_catalog`
- ✅ `student_place_state`
- ✅ `student_activation_limits` (soporta `domain='places'` y `domain='projects'`)

**Tablas canónicas de Proyectos** (NO existen):
- ❌ `project_categories`
- ❌ `projects_catalog`
- ❌ `student_project_state`

**Funciones SQL** (existen, genéricas):
- ✅ `calculate_days_since_clean(p_last_cleaned_at, p_recurrence_days)`
- ✅ `calculate_health_status(p_days_since_clean, p_recurrence_days)`

**Conclusión**: Las funciones SQL son genéricas y se pueden reutilizar. Las tablas de proyectos NO existen.

---

## 🔗 Dependencias y Referencias

### Código que Referencia Proyectos (Legacy)

1. **`src/endpoints/admin-transmutaciones-proyectos-api.js`**
   - Usa tablas legacy eliminadas
   - NO funcional
   - NO es canónico

2. **`src/endpoints/admin-api-student-domains.js`**
   - Endpoints legacy para proyectos
   - NO funcional
   - NO es canónico

3. **`database/pg.js`**
   - Código de inicialización que creaba tablas legacy
   - Las tablas fueron eliminadas en v5.54.0
   - El código puede tener referencias obsoletas

**Conclusión**: Código legacy existe pero NO es funcional. NO se debe usar como referencia.

---

## 📊 Comparación: Lugares vs Proyectos

| Componente | Lugares | Proyectos |
|------------|---------|-----------|
| **Tablas canónicas** | ✅ Existen | ❌ NO existen |
| **Repositorios** | ✅ Existen | ❌ NO existen |
| **Servicio canónico** | ✅ Existe | ❌ NO existe |
| **Endpoints MASTER** | ✅ Existen | ❌ NO existen |
| **Rutas registradas** | ✅ Registradas | ❌ NO registradas |
| **Señales registradas** | ✅ Registradas | ❌ NO registradas |
| **UI cliente JS** | ✅ Existe | ❌ NO existe |
| **Documentación** | ✅ Existe | ❌ NO existe |
| **Ruta placeholder** | ✅ Funcional | ⚠️ Solo placeholder |

---

## 🎯 Recomendación Final

### Crear Sistema Canónico Nuevo

**Estrategia**: Crear sistema canónico nuevo en paralelo, espejo de Lugares MASTER.

**Ventajas**:
1. ✅ Reutiliza patrones probados de Lugares
2. ✅ No rompe código legacy (aislado)
3. ✅ Sistema canónico desde el inicio
4. ✅ Preparado para UTEs, automatizaciones y paquetes

**Riesgos**:
1. ⚠️ Código legacy puede tener referencias obsoletas (no funcional)
2. ⚠️ Necesita migración SQL nueva
3. ⚠️ Necesita implementación completa (repos, servicio, endpoints, UI)

**Plan de Acción**:
1. Crear migración SQL (tablas canónicas)
2. Crear repositorios (contrato + PostgreSQL)
3. Crear servicio canónico (espejo de `place-service.js`)
4. Registrar señales en registry
5. Crear endpoints MASTER y registrar rutas
6. Crear UI cliente JavaScript (3 tabs)
7. Crear documentación canónica

---

## ✅ Checklist de Verificación Post-Implementación

### Base de Datos
- [ ] Tablas `project_categories`, `projects_catalog`, `student_project_state` existen
- [ ] Constraint `student_activation_limits.domain` incluye `'projects'`
- [ ] Funciones SQL `calculate_days_since_clean` y `calculate_health_status` existen (reutilizadas)

### Código
- [ ] Repositorios creados (contrato + PostgreSQL)
- [ ] Servicio `project-service.js` creado
- [ ] Señales `project.*` registradas en registry
- [ ] Endpoints `/master/api/projects/**` creados
- [ ] Rutas registradas en `master-route-registry.js` con `type: 'api'`
- [ ] Rutas mapeadas en `MASTER_HANDLER_MAP`
- [ ] UI cliente JavaScript creado (3 tabs)
- [ ] Handler `master-templo-luz-proyectos.js` actualizado

### Documentación
- [ ] `MASTER_PROJECTS_SYSTEM_V1.md` creado
- [ ] `MASTER_PROJECTS_ASSET_EXECUTION_FORENSICS.md` creado
- [ ] `MASTER_DOCS_INDEX.md` actualizado

---

## 📝 Notas Técnicas

### Reutilización de Código

**Funciones SQL**: Las funciones `calculate_days_since_clean` y `calculate_health_status` son genéricas y se pueden reutilizar sin cambios.

**Patrón de Lugares**: El sistema de Lugares es el modelo canónico. Proyectos debe ser espejo exacto, adaptando nombres:
- `place_*` → `project_*`
- `places_*` → `projects_*`
- `Place*` → `Project*`

### Aislamiento de Legacy

**Regla**: NO tocar código legacy. El sistema nuevo debe ser completamente independiente.

**Legacy aislado**:
- `admin-transmutaciones-proyectos-api.js` (NO tocar)
- `admin-api-student-domains.js` (NO tocar)
- Referencias en `database/pg.js` (NO tocar)

---

**Última actualización**: 2026-01-05  
**Estado**: ✅ Diagnóstico completado, listo para FASE 1
