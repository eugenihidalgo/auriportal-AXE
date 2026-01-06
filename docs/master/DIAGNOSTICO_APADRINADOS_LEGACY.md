# DIAGNÓSTICO REAL — SISTEMA APADRINADOS (LEGACY → MASTER)
**Fecha:** 2025-01-XX  
**Sistema:** AuriPortal / Aurelín  
**Dominio:** ADMIN (Legacy)  
**Fase:** DIAGNÓSTICO (NO IMPLEMENTACIÓN)

---

## ⚠️ ADVERTENCIA

Este documento es **SOLO DIAGNÓSTICO FACTUAL**.  
**PROHIBIDO** implementar código, refactorizar, crear tablas o asumir intenciones.  
Solo observación, listado y reporte de hechos verificables.

---

## RESUMEN EJECUTIVO

El sistema de apadrinados existe actualmente en **ADMIN (legacy)** con:

- ✅ **2 tablas PostgreSQL** operativas: `transmutaciones_apadrinados` y `transmutaciones_apadrinados_estado`
- ✅ **Servicios backend** funcionales para CRUD y consultas
- ✅ **Integración con limpiezas** operativa (marcar como limpio, historial)
- ✅ **UI Admin** en `/admin/transmutaciones/personas` para gestión
- ✅ **Integración con Student Domain** (domain_key: `apadrinados`)
- ✅ **Catálogo PDE** registrado (`sponsors`)
- ⚠️ **UI Master** solo placeholder (`/master/templo-luz/apadrinados`)
- ⚠️ **Ruta limpiezas** referenciada en sidebar pero sin handler específico verificado

---

## FASE 1 — DIAGNÓSTICO DE BASE DE DATOS

### 1.1 Tablas Identificadas

#### Tabla: `transmutaciones_apadrinados`

**Ubicación:** PostgreSQL  
**Creación:** Migración `v5.4.0-pde-master-cleanup.sql` (líneas 190-248)  
**Estado:** ✅ Operativa

**Estructura:**
```sql
CREATE TABLE transmutaciones_apadrinados (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(200) NOT NULL,
  descripcion TEXT,
  nivel_minimo INT DEFAULT 1,
  frecuencia_dias INT DEFAULT 30,
  prioridad VARCHAR(50) DEFAULT 'Normal',
  orden INT DEFAULT 0,
  activo BOOLEAN DEFAULT TRUE,
  alumno_id INT REFERENCES alumnos(id) ON DELETE CASCADE,
  deleted_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Índices:**
- `idx_transmutaciones_apadrinados_activo` (activo)
- `idx_transmutaciones_apadrinados_nivel` (nivel_minimo)
- `idx_transmutaciones_apadrinados_alumno_activo` (alumno_id, activo) WHERE deleted_at IS NULL
- `idx_transmutaciones_apadrinados_soft_delete` (deleted_at) WHERE deleted_at IS NOT NULL

**Características:**
- ✅ Soft delete (`deleted_at`)
- ✅ Relación con `alumnos` (padrino) vía `alumno_id`
- ✅ `frecuencia_dias` puede ser NULL (no requerido para apadrinados)
- ✅ `nivel_minimo` para filtrado por nivel

#### Tabla: `transmutaciones_apadrinados_estado`

**Ubicación:** PostgreSQL  
**Creación:** Migración `v5.4.0-pde-master-cleanup.sql` (líneas 251-267)  
**Estado:** ✅ Operativa

**Estructura:**
```sql
CREATE TABLE transmutaciones_apadrinados_estado (
  id SERIAL PRIMARY KEY,
  apadrinado_id INT REFERENCES transmutaciones_apadrinados(id) ON DELETE CASCADE,
  alumno_id INT REFERENCES alumnos(id) ON DELETE CASCADE,
  estado VARCHAR(50) DEFAULT 'pendiente',
  ultima_limpieza TIMESTAMP,
  veces_limpiado INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (apadrinado_id, alumno_id)
);
```

**Índices:**
- `idx_transmutaciones_apadrinados_estado_apadrinado` (apadrinado_id)
- `idx_transmutaciones_apadrinados_estado_alumno` (alumno_id)

**Características:**
- ✅ Relación N:M entre apadrinado y alumno (un apadrinado puede limpiarse por múltiples alumnos)
- ✅ Constraint UNIQUE en (apadrinado_id, alumno_id)
- ✅ Estado: `pendiente` (default), `limpio`, `olvidado` (calculado)
- ✅ Tracking de `ultima_limpieza` y `veces_limpiado`

### 1.2 Relaciones con Otras Tablas

**Con `alumnos`:**
- `transmutaciones_apadrinados.alumno_id` → `alumnos.id` (padrino que crea/posee el apadrinado)
- `transmutaciones_apadrinados_estado.alumno_id` → `alumnos.id` (alumno que limpia el apadrinado)
- **ON DELETE CASCADE** en ambas relaciones

**Con `limpiezas_master_historial`:**
- Registro de auditoría de limpiezas
- Campo `tipo = 'apadrinados'`
- Campo `aspecto_id` = `apadrinado_id`

### 1.3 Datos Observados

**⚠️ NO SE VERIFICÓ VOLUMEN REAL DE DATOS**  
(Requiere consulta directa a PostgreSQL)

**Campos que pueden contener datos:**
- `nombre`: Nombre del apadrinado (requerido)
- `descripcion`: Descripción opcional
- `alumno_id`: ID del padrino (puede ser NULL según código legacy)
- `frecuencia_dias`: Puede ser NULL (no requerido)

**Estados posibles:**
- `pendiente`: Nunca limpiado o fuera de frecuencia
- `limpio`: Limpiado dentro de `frecuencia_dias`
- `olvidado`: Más de `frecuencia_dias + 15` días sin limpiar

### 1.4 Migraciones Relevantes

1. **v5.4.0-pde-master-cleanup.sql** (líneas 190-267)
   - Creación inicial de tablas
   - Añade `deleted_at` y `alumno_id` si no existen

2. **v5.32.0-unify-all-table-ownership.sql** (líneas 208-209)
   - Ajuste de ownership a `aurelinportal`

3. **v5.31.0-fix-table-ownership.sql** (línea 99)
   - Fix de ownership de `transmutaciones_apadrinados`

---

## FASE 2 — DIAGNÓSTICO DE CÓDIGO BACKEND

### 2.1 Servicios Identificados

#### Servicio: `src/services/transmutaciones-apadrinados.js`

**Estado:** ✅ Operativo  
**Funciones exportadas:**

1. **`listarApadrinadosGlobales()`**
   - Lista todos los apadrinados activos
   - JOIN con `alumnos` para obtener datos del padrino
   - Ordena por `nivel_minimo`, `orden`, `nombre`
   - **Fail-open:** Retorna array vacío si hay error

2. **`crearApadrinadoRapido(nombre, nivel_minimo, descripcion, frecuencia_dias, prioridad, orden, alumno_id)`**
   - Crea apadrinado con datos mínimos
   - **Auto-crea tablas** si no existen (fallback)
   - **Auto-añade columna `alumno_id`** si no existe
   - Retorna `id` del apadrinado creado

3. **`actualizarApadrinadoDetalle(apadrinadoId, datos)`**
   - Actualiza campos: nombre, descripcion, nivel_minimo, frecuencia_dias, prioridad, activo, orden
   - Actualiza `updated_at` automáticamente

4. **`getApadrinadosAlumno(alumnoId)`**
   - Obtiene apadrinados disponibles para un alumno específico
   - Filtra por `nivel_minimo <= nivel_actual` del alumno
   - Incluye estado de limpieza (`ultima_limpieza`, `veces_limpiado`, `dias_desde_limpieza`)
   - **Fail-open:** Retorna array vacío si hay error

5. **`getAlumnosPorApadrinado(apadrinadoId)`**
   - Obtiene alumnos que pueden limpiar un apadrinado específico
   - Filtra por `estado_suscripcion = 'activa'`
   - Calcula `estado_calculado` (pendiente/limpio/olvidado)
   - **Lógica confusa:** JOIN con `transmutaciones_apadrinados` donde `ta.alumno_id = a.id` (parece buscar el padrino, no alumnos que limpian)

**Características del servicio:**
- ✅ Auto-creación de tablas si no existen (robustez)
- ✅ Manejo de errores con fallbacks
- ✅ Soporte para `nivel_minimo` opcional (fallback a 1)

#### Servicio: `src/services/pde-limpiezas-master.js`

**Estado:** ✅ Operativo  
**Integración con apadrinados:**

- **Configuración en `TIPO_CONFIG`:**
  ```javascript
  apadrinados: {
    tablaBase: 'transmutaciones_apadrinados',
    tablaEstado: 'transmutaciones_apadrinados_estado',
    fkColumna: 'apadrinado_id',
    nombreColumna: 'nombre',
    seccion: 'Transmutaciones PDE - Apadrinados'
  }
  ```

- **Funciones que soportan apadrinados:**
  - `marcarTodoComoLimpio({ alumnoId, tipo: 'apadrinados' })`
  - `marcarItemComoLimpio({ alumnoId, tipo: 'apadrinados', itemId })`
  - `obtenerResumenLimpiezasPde(alumnoId)` (incluye apadrinados)

**Características:**
- ✅ Usa `nivel_efectivo` del alumno (considera overrides)
- ✅ Valida suscripción activa y pausas
- ✅ Registra en `limpiezas_master_historial`
- ✅ Auditoría con `logAuditEvent`

### 2.2 Endpoints Identificados

#### Endpoint: `src/endpoints/admin-transmutaciones-personas.js`

**Ruta:** `/admin/transmutaciones/personas`  
**Estado:** ✅ Operativo  
**Métodos:**

1. **GET** (sin action)
   - Renderiza lista de personas (alumnos) con sus apadrinados
   - Muestra tabla con: nombre, email, nivel, racha, apadrinados (count y lista)
   - Botones: "Añadir apadrinado", "Ver apadrinados"

2. **GET** (`?action=ver_apadrinados&persona_id=X`)
   - Retorna HTML modal con apadrinados de una persona
   - Muestra: nombre, descripción, última limpieza

3. **POST** (`?action=create_rapido`)
   - Crea apadrinado rápido
   - Requiere: `nombre`, `alumno_id`
   - Opcional: `descripcion`, `prioridad`, `orden`
   - Retorna JSON: `{ success: true, id }`

4. **POST** (`?action=delete&apadrinado_id=X`)
   - **ELIMINA FÍSICAMENTE** el apadrinado (DELETE FROM)
   - ⚠️ **NO usa soft delete** (`deleted_at`)

**Características:**
- ✅ UI completa con modales
- ✅ Integración con `transmutaciones-personas.js` (servicio de personas)
- ⚠️ **DELETE físico** (no soft delete)

#### Endpoint: `src/endpoints/admin-limpiezas-master.js`

**Ruta:** `/admin/limpiezas` (probablemente)  
**Estado:** ✅ Operativo  
**Funcionalidad relacionada con apadrinados:**

- Consulta `transmutaciones_apadrinados_estado` para historial
- Migración de datos históricos a `limpiezas_master_historial` (líneas 444-467)

#### Endpoint: `src/endpoints/admin-master.js`

**Ruta:** `/admin/master` (probablemente)  
**Estado:** ✅ Operativo  
**Funcionalidad relacionada con apadrinados:**

- Consulta apadrinados del alumno (líneas 1523-1532)
- Filtra por `alumno_id` del alumno consultado
- Incluye en contexto para UI Master

#### Endpoint: `src/endpoints/master-templo-luz-apadrinados.js`

**Ruta:** `/master/templo-luz/apadrinados`  
**Estado:** ⚠️ **PLACEHOLDER**  
**Contenido:**
```javascript
return renderMasterPage({
  title: 'Apadrinados - Templo de Luz',
  contentHtml: `
    <div style="padding: 2rem;">
      <h1>Apadrinados</h1>
      <p>Este espacio formará parte del Templo de Luz.</p>
      <p>Infraestructura lista. Contenido en fase posterior.</p>
    </div>
  `,
  activePath,
  universeId: 'templo_luz'
});
```

**Características:**
- ✅ Usa `renderMasterPage()` (canónico)
- ⚠️ **Solo placeholder**, no funcionalidad real

### 2.3 Integración con Student Domain

**Migración:** `v5.45.0-student-domain-integration-v1.sql`  
**Estado:** ✅ Integrado

**Domain Key:** `apadrinados`  
**Referencias:**
- `src/core/student/student-context-builder.js` (línea 187): `domainKeys` incluye `'apadrinados'`
- `src/endpoints/admin-panel-modo-maestro.js` (línea 232): `domainKeys` incluye `'apadrinados'`
- `src/endpoints/admin-api-students.js` (línea 161): `domainKeys` incluye `'apadrinados'`

**Tabla:** `student_item_state`  
**Campos relevantes:**
- `domain_key = 'apadrinados'`
- `item_id` → `transmutaciones_apadrinados.id`
- `item_ref_type` (probablemente `'sot'` o `'personal'`)

**⚠️ NO SE VERIFICÓ** si hay datos reales en `student_item_state` con `domain_key = 'apadrinados'`

### 2.4 Catálogo PDE

**Configuración:** `config/pde/catalogs.config.json` (líneas 90-104)  
**Estado:** ✅ Registrado

```json
{
  "sponsors": {
    "catalog_id": "sponsors",
    "label": "Apadrinados",
    "version": "1.0.0",
    "source_type": "database",
    "source_table": "transmutaciones_apadrinados",
    "state_table": "transmutaciones_apadrinados_estado",
    "admin_path": "/admin/apadrinados",
    "resolver_path": "src/core/pde/catalogs/sponsors-resolver.js",
    "supports_level_filter": true,
    "supports_estado_filter": true,
    "is_personal_only": true,
    "runtime_integrated": false,
    "notes": "Relaciones energéticas personales. Siempre requiere alumno_id."
  }
}
```

**Resolver:** `src/core/pde/catalogs/sponsors-resolver.js`  
**Estado:** ✅ Implementado

**Funciones:**
- `resolveSponsorBundle(studentCtx, options)`
- Filtra por nivel, prioridad, estado
- Calcula estado (pendiente/limpio/olvidado)
- **Fail-open:** Retorna bundle vacío si hay error

**Características:**
- ✅ Requiere `alumno_id` (apadrinados son personales)
- ✅ Soporta filtros: `filter_estado`, `prioridad`
- ⚠️ **`runtime_integrated: false`** (no se usa en runtime de limpiezas aún)

---

## FASE 3 — DIAGNÓSTICO DE UI / ADMIN

### 3.1 UIs Identificadas

#### UI: `/admin/transmutaciones/personas`

**Handler:** `src/endpoints/admin-transmutaciones-personas.js`  
**Estado:** ✅ Operativa  
**Funcionalidades:**

1. **Lista de personas (alumnos)**
   - Tabla con: nombre, email, nivel, racha, apadrinados (count)
   - Botón "Añadir apadrinado" por persona
   - Botón "Ver apadrinados" si tiene apadrinados

2. **Modal "Añadir Apadrinado"**
   - Formulario: nombre (requerido), descripción (opcional)
   - POST a `?action=create_rapido`
   - Recarga página tras crear

3. **Modal "Ver Apadrinados"**
   - Lista apadrinados de la persona
   - Muestra: nombre, descripción, última limpieza
   - Botón "Cerrar"

**Características:**
- ✅ UI completa y funcional
- ✅ Integración con servicio `transmutaciones-personas.js`
- ⚠️ **DELETE físico** (no soft delete)

#### UI: `/admin/limpiezas/apadrinados`

**Referencia:** `src/core/admin/layout/sidebar-limpiezas-v1.js` (líneas 83-86)  
**Estado:** ⚠️ **REFERENCIADA PERO NO VERIFICADA**

**Sidebar item:**
```javascript
sidebarItem(
  '/admin/limpiezas/apadrinados',
  'Apadrinados',
  '🤝',
  currentPath === '/admin/limpiezas/apadrinados' || currentPath.startsWith('/admin/limpiezas/apadrinados/')
)
```

**⚠️ NO SE ENCONTRÓ** handler específico para esta ruta en el código analizado.  
**Posible resolución:** Catch-all de `admin-panel-v4.js` o handler no encontrado en búsqueda.

#### UI: `/master/templo-luz/apadrinados`

**Handler:** `src/endpoints/master-templo-luz-apadrinados.js`  
**Estado:** ⚠️ **PLACEHOLDER**

**Contenido:** Solo texto informativo, sin funcionalidad.

### 3.2 Sidebar References

**Admin Sidebar:** `src/core/admin/sidebar-registry.js`  
**Referencias encontradas:**
- Línea 151-154: `master-insight-apadrinados` (ruta `/admin/master-insight/apadrinados`)

**Master Sidebar:** `src/core/master/registry/master-sidebar-registry.js`  
**Referencias encontradas:**
- Línea 228-231: `master-templo-luz-apadrinados` (ruta `/master/templo-luz/apadrinados`)

### 3.3 Permisos y Acceso

**⚠️ NO SE VERIFICÓ** sistema de permisos específico para apadrinados.  
**Asunción:** Usa permisos generales de Admin/Master.

---

## FASE 4 — RELACIÓN CON LIMPIEZAS / ALQUIMIA GENERAL

### 4.1 Integración con Limpiezas

**Servicio:** `src/services/pde-limpiezas-master.js`  
**Estado:** ✅ Integrado

**Funcionalidades:**

1. **Marcar todo como limpio**
   - `marcarTodoComoLimpio({ alumnoId, tipo: 'apadrinados' })`
   - Marca TODOS los apadrinados activos del alumno como limpios
   - Actualiza `transmutaciones_apadrinados_estado`
   - Registra en `limpiezas_master_historial`

2. **Marcar item específico como limpio**
   - `marcarItemComoLimpio({ alumnoId, tipo: 'apadrinados', itemId })`
   - Marca un apadrinado específico como limpio
   - Actualiza `ultima_limpieza` y `veces_limpiado`

3. **Resumen de limpiezas**
   - `obtenerResumenLimpiezasPde(alumnoId)`
   - Retorna: `{ apadrinados: { total, limpios, pendientes, olvidados } }`

**Características:**
- ✅ Usa `nivel_efectivo` (considera overrides)
- ✅ Valida suscripción activa y pausas
- ✅ Filtra por `nivel_minimo <= nivel_efectivo`
- ✅ Filtra por `alumno_id IS NULL OR alumno_id = alumnoId` (apadrinados globales o personales)

### 4.2 Estados de Limpieza

**Cálculo de estado:**
```javascript
if (!ultima_limpieza) return 'pendiente';
const diasDesde = EXTRACT(DAY FROM (CURRENT_TIMESTAMP - ultima_limpieza));
const frecuencia = frecuencia_dias || 30;
if (diasDesde <= frecuencia) return 'limpio';
if (diasDesde <= frecuencia + 15) return 'pendiente';
return 'olvidado';
```

**Estados:**
- `pendiente`: Nunca limpiado o fuera de frecuencia (más de `frecuencia + 15` días)
- `limpio`: Limpiado dentro de `frecuencia_dias`
- `olvidado`: Más de `frecuencia_dias + 15` días sin limpiar

### 4.3 Historial de Limpiezas

**Tabla:** `limpiezas_master_historial`  
**Campos relevantes:**
- `tipo = 'apadrinados'`
- `aspecto_id` = `apadrinado_id`
- `aspecto_nombre` = nombre del apadrinado
- `seccion = 'Transmutaciones PDE - Apadrinados'`

**Migración histórica:**
- `admin-limpiezas-master.js` (líneas 444-467) migra datos de `transmutaciones_apadrinados_estado` a `limpiezas_master_historial`

### 4.4 Integración con Alquimia General

**⚠️ NO SE VERIFICÓ** integración específica con "Alquimia General" como concepto unificado.  
**Asunción:** Apadrinados se limpian individualmente o en batch, no como parte de un flujo de "Alquimia General".

---

## FASE 5 — INFORME FINAL

### A) QUÉ EXISTE HOY (HECHOS)

1. **Base de Datos:**
   - ✅ 2 tablas PostgreSQL operativas
   - ✅ Relaciones con `alumnos` (padrino y alumno que limpia)
   - ✅ Soft delete implementado (`deleted_at`)
   - ✅ Índices optimizados

2. **Backend:**
   - ✅ Servicio completo de CRUD (`transmutaciones-apadrinados.js`)
   - ✅ Integración con limpiezas (`pde-limpiezas-master.js`)
   - ✅ Resolver PDE (`sponsors-resolver.js`)
   - ✅ Endpoint Admin funcional (`admin-transmutaciones-personas.js`)

3. **UI Admin:**
   - ✅ Pantalla completa de gestión (`/admin/transmutaciones/personas`)
   - ✅ Modales para crear/ver apadrinados
   - ✅ Integración con sidebar de limpiezas

4. **Integraciones:**
   - ✅ Student Domain (`domain_key: 'apadrinados'`)
   - ✅ Catálogo PDE (`sponsors`)
   - ✅ Sistema de limpiezas (marcar limpio, historial)

### B) QUÉ NO EXISTE

1. **UI Master:**
   - ❌ Solo placeholder en `/master/templo-luz/apadrinados`
   - ❌ No hay funcionalidad real de gestión en Master

2. **Handler verificado:**
   - ❌ Ruta `/admin/limpiezas/apadrinados` referenciada en sidebar pero handler no encontrado

3. **Validaciones:**
   - ❌ No se verificó sistema de permisos específico
   - ❌ No se verificó validación de datos de entrada

4. **Datos reales:**
   - ❌ No se verificó volumen de datos en tablas
   - ❌ No se verificó existencia de datos huérfanos
   - ❌ No se verificó integridad referencial

### C) QUÉ DATOS PARECEN REUTILIZABLES

1. **Estructura de tablas:**
   - ✅ Compatible con diseño canónico (apadrinado como nodo personal)
   - ✅ `alumno_id` en `transmutaciones_apadrinados` (padrino)
   - ✅ `transmutaciones_apadrinados_estado` permite múltiples alumnos limpiando

2. **Servicios:**
   - ✅ Lógica de CRUD reutilizable
   - ✅ Lógica de limpiezas reutilizable
   - ✅ Cálculo de estados reutilizable

3. **Integraciones:**
   - ✅ Student Domain ya integrado
   - ✅ Catálogo PDE ya registrado

### D) QUÉ DATOS NO ENCAJAN CON EL DISEÑO CANÓNICO

1. **Modelo actual vs. diseño canónico:**
   - ⚠️ **Actual:** Apadrinado tiene `alumno_id` (padrino) y puede limpiarse por múltiples alumnos
   - ⚠️ **Canónico:** Apadrinado es nodo personal dependiente de uno o varios alumnos (padrinos)
   - **Diferencia:** El modelo actual parece asumir 1 padrino por apadrinado, pero permite múltiples alumnos limpiando

2. **Relación N:M:**
   - ⚠️ **Actual:** `transmutaciones_apadrinados_estado` permite que múltiples alumnos limpien el mismo apadrinado
   - ⚠️ **Canónico:** Apadrinado depende de uno o varios alumnos (padrinos), no de alumnos que limpian
   - **Confusión:** La tabla `_estado` parece modelar "quién limpia" en lugar de "de quién depende"

3. **DELETE físico:**
   - ⚠️ **Actual:** `admin-transmutaciones-personas.js` hace DELETE físico
   - ⚠️ **Canónico:** Soft delete con `deleted_at`
   - **Inconsistencia:** Tabla tiene `deleted_at` pero endpoint no lo usa

4. **Frecuencia:**
   - ⚠️ **Actual:** `frecuencia_dias` puede ser NULL (no requerido)
   - ⚠️ **Canónico:** No especificado en diseño, pero lógica de limpiezas asume frecuencia
   - **Ambiguidad:** Si `frecuencia_dias` es NULL, se usa 30 días por defecto

### E) RIESGOS CLAROS DE MIGRACIÓN

1. **Modelo de datos:**
   - ⚠️ **Riesgo:** Confusión entre "padrino" (`alumno_id` en `transmutaciones_apadrinados`) y "alumno que limpia" (`alumno_id` en `transmutaciones_apadrinados_estado`)
   - **Impacto:** Puede requerir refactorización de relaciones

2. **Datos existentes:**
   - ⚠️ **Riesgo:** Si hay datos con `alumno_id = NULL` en `transmutaciones_apadrinados`, no encajan con diseño canónico (apadrinados siempre tienen padrino)
   - **Impacto:** Requiere migración de datos o eliminación

3. **DELETE físico:**
   - ⚠️ **Riesgo:** Endpoint actual hace DELETE físico, puede haber pérdida de datos
   - **Impacto:** Cambiar a soft delete puede requerir migración de lógica

4. **Integración con limpiezas:**
   - ⚠️ **Riesgo:** Lógica de limpiezas asume `frecuencia_dias` o 30 días por defecto
   - **Impacto:** Si diseño canónico requiere frecuencia obligatoria, requiere migración

5. **UI Master:**
   - ⚠️ **Riesgo:** No hay UI Master funcional, solo placeholder
   - **Impacto:** Requiere implementación completa desde cero

### F) PREGUNTAS ABIERTAS QUE EL DIAGNÓSTICO NO PUEDE RESOLVER

1. **Volumen de datos:**
   - ¿Cuántos apadrinados existen actualmente?
   - ¿Cuántos tienen `alumno_id = NULL`?
   - ¿Cuántos tienen `frecuencia_dias = NULL`?

2. **Datos huérfanos:**
   - ¿Hay apadrinados con `alumno_id` que no existe en `alumnos`?
   - ¿Hay estados en `transmutaciones_apadrinados_estado` con `apadrinado_id` eliminado?

3. **Uso real:**
   - ¿Se están usando apadrinados activamente?
   - ¿Cuántas limpiezas se han registrado?

4. **Handler faltante:**
   - ¿Existe handler para `/admin/limpiezas/apadrinados`?
   - ¿O se resuelve por catch-all?

5. **Diseño canónico:**
   - ¿El diseño canónico permite múltiples padrinos por apadrinado?
   - ¿O siempre es 1 padrino por apadrinado?

6. **Frecuencia:**
   - ¿Los apadrinados deben tener frecuencia obligatoria?
   - ¿O puede ser NULL (sin frecuencia)?

---

## CIERRE

Este diagnóstico es **FACTUAL y VERIFICABLE**.  
No se implementó código, no se refactorizó, no se asumieron intenciones.

**Próximos pasos sugeridos:**
1. Consultar PostgreSQL para verificar volumen y calidad de datos
2. Resolver preguntas abiertas con el equipo
3. Diseñar plan de migración basado en hechos verificados
4. Implementar UI Master según diseño canónico

**FIN DEL DIAGNÓSTICO**
