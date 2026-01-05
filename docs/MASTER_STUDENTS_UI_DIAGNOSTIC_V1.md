# MASTER STUDENTS UI DIAGNOSTIC v1 - AuriPortal Master

**Fecha:** 2025-01-XX  
**Versión:** v5.51.0-master-students-layout-diagnostic  
**Objetivo:** Layout "Alumnos" en MASTER con tabla técnica diagnóstica (ventana técnica del sistema)

---

## 📊 RESUMEN EJECUTIVO

**Layout:** `/master/alumnos`  
**Tipo:** Vista técnica diagnóstica (read-only)  
**Tabla Canónica:** `alumnos` (PostgreSQL)  
**Propósito:** Inspección real del sistema - ver cuántos alumnos hay, qué campos existen y qué tablas/relaciones están vivas

---

## 🎯 FUNCIONALIDADES

### 1. Tabla Técnica de Alumnos

**Endpoint:** `GET /master/api/students?limit=50&offset=0&search=&include_columns=true`

**Características:**
- Listado paginado de TODOS los alumnos (SELECT * FROM alumnos)
- Muestra TODAS las columnas reales de PostgreSQL (no subset limitado)
- Metadata de columnas (nombre, tipo, nullable, default, posición)
- Búsqueda por email o apodo (opcional)
- Paginación simple (Anterior/Siguiente)

**Response JSON:**
```json
{
  "ok": true,
  "data": {
    "items": [...],  // Array de objetos alumno completos (todas las columnas)
    "total": 150,
    "limit": 50,
    "offset": 0,
    "table": "alumnos",
    "columns": [
      {
        "name": "id",
        "type": "integer",
        "nullable": false,
        "default": "nextval('alumnos_id_seq'::regclass)",
        "position": 1
      },
      ...
    ]
  },
  "trace_id": "..."
}
```

### 2. Detalle de Alumno

**Endpoint:** `GET /master/api/students/:id`

**Características:**
- Obtiene un alumno completo por ID
- Detecta tablas relacionadas que referencian `alumnos.id`
- Cuenta registros en cada tabla relacionada (fail-open si falla)

**Response JSON:**
```json
{
  "ok": true,
  "data": {
    "student": {...},  // Objeto alumno completo
    "related": {
      "pausas": {
        "column": "alumno_id",
        "count": 2
      },
      "practicas": {
        "column": "alumno_id",
        "count": 45
      },
      ...
    }
  },
  "trace_id": "..."
}
```

---

## 🖥️ UI CLIENT

### Archivo: `public/js/master/master-alumnos-client.js`

**Características:**
- ✅ DOM API exclusivamente (prohibido innerHTML)
- ✅ Bootstrap autoejecutable con guards
- ✅ Renderiza tabla técnica con todas las columnas
- ✅ Panel de metadata de columnas (sección inferior)
- ✅ Click en fila → modal JSON con registro completo
- ✅ Paginación simple (botones Anterior/Siguiente)
- ✅ Fail-open: si metadata falla, sigue mostrando items

**Contenedor HTML:**
```html
<div id="master-alumnos-content" style="padding: 2rem;">
  <h1>Alumnos - Tabla Técnica Diagnóstica</h1>
  <p>Vista técnica del sistema...</p>
  <!-- JS client renderiza aquí -->
</div>
```

**Estructura Renderizada:**
1. **Info Header**: Total alumnos, rango mostrado, nombre de tabla
2. **Tabla de Alumnos**: Todas las columnas (o primeras 15 si hay muchas)
3. **Paginación**: Botones Anterior/Siguiente (si aplica)
4. **Metadata de Columnas**: Tabla con información de cada columna
5. **Modal de Detalle**: Se abre al hacer click en una fila (JSON completo)

---

## 📍 RUTAS REGISTRADAS

### MASTER API Routes

**Registry:** `src/core/master/registry/master-route-registry.js`

```javascript
{
  key: 'master-api-students',
  path: '/master/api/students',
  type: 'api',
  method: 'GET'
},
{
  key: 'master-api-students-id',
  path: '/master/api/students/:id',
  type: 'api',
  method: 'GET'
}
```

**Handlers:** `src/endpoints/master-api-students.js`

**Resolver:** `src/core/master/router/master-router-resolver.js` (MASTER_HANDLER_MAP)

### MASTER UI Route

**Registry:** `src/core/master/registry/master-route-registry.js`

```javascript
{
  key: 'master-alumnos',
  path: '/master/alumnos',
  type: 'island'
}
```

**Handler:** `src/endpoints/master-alumnos.js`

---

## 🔗 SIDEBAR

**Entrada en Sidebar:** Sección "Otros Layouts" (footer)

**Registry:** `src/core/master/registry/master-sidebar-registry.js`

```javascript
footer: {
  title: 'Otros Layouts',
  items: [
    {
      id: 'master-alumnos',
      label: 'Alumnos',
      icon: 'students',
      route: '/master/alumnos'
    },
    {
      id: 'master-templo',
      label: 'Modo Master',
      icon: 'templo',
      route: '/master/templo-luz/alquimia-general'
    },
    {
      id: 'master-alumnos-info',
      label: 'Información espiritual del alumno',
      icon: 'info',
      route: '/master/alumnos/info'  // Placeholder
    },
    ...
  ]
}
```

---

## 📦 SCRIPTS REGISTRADOS

**Registry:** `src/core/master/registry/master-layout-registry.v1.json`

```json
{
  "id": "master-alumnos-client",
  "guard_id": "ALUMNOS_CLIENT",
  "path": "/js/master/master-alumnos-client.js",
  "type": "module",
  "required": true,
  "critical": false,
  "phase": "ui",
  "name": "Master Alumnos Client"
}
```

**Loader:** Cargado automáticamente por `master-page-renderer.js` desde `master-layout-registry.v1.json`

---

## 🎨 DISEÑO

**Filosofía:** "Ventana técnica del sistema"

- ✅ No embellecer - diseño mínimo y funcional
- ✅ Mostrar datos crudos de PostgreSQL
- ✅ Metadata técnica visible
- ✅ Sin edición (read-only)
- ✅ Click en fila para ver JSON completo

**Estilos:**
- Inline styles mínimos (sin CSS externo adicional)
- Tabla HTML estándar con bordes
- Colores neutros (grises, blancos)
- Modal overlay simple para detalle

---

## 🔍 DIAGNÓSTICO Y AUDITORÍA

### Detección Automática

**Tabla Canónica:**
- Detectada automáticamente: `alumnos` (PostgreSQL)
- Validada contra `information_schema.columns`
- No requiere configuración manual

**Tablas Relacionadas:**
- Detectadas automáticamente usando `information_schema.table_constraints` y `information_schema.key_column_usage`
- Cuenta registros por alumno (fail-open si falla)

### Metadata de Columnas

**Fuente:** `information_schema.columns`  
**Información Mostrada:**
- Nombre de columna
- Tipo de dato
- Nullable (YES/NO)
- Valor por defecto
- Posición ordinal

---

## 🚫 RESTRICCIONES

**Read-Only:**
- ❌ No edición de datos
- ❌ No creación de alumnos
- ❌ No eliminación
- ✅ Solo lectura y visualización

**No Embellecer:**
- ❌ No añadir estilos complejos
- ❌ No añadir animaciones
- ❌ No añadir gráficos o visualizaciones
- ✅ Mantener diseño técnico y funcional

**Dominio MASTER:**
- ❌ Prohibido usar `/admin/api/**`
- ✅ Solo `/master/api/**`
- ✅ Solo endpoints MASTER registrados

---

## 📝 CONTRATOS

### Endpoint: GET /master/api/students

**Query Params:**
- `limit` (opcional, default: 50, max: 200)
- `offset` (opcional, default: 0)
- `search` (opcional, búsqueda por email/apodo)
- `include_columns` (opcional, default: false, 'true' para incluir metadata)

**Response:**
- `ok: true/false`
- `data.items`: Array de alumnos (SELECT * FROM alumnos)
- `data.total`: Total de alumnos
- `data.columns`: Metadata de columnas (solo si include_columns=true)
- `trace_id`: ID de trazabilidad

### Endpoint: GET /master/api/students/:id

**Path Params:**
- `:id`: ID numérico del alumno

**Response:**
- `ok: true/false`
- `data.student`: Objeto alumno completo
- `data.related`: Objeto con tablas relacionadas y conteos (opcional)
- `trace_id`: ID de trazabilidad

---

## ✅ VALIDACIÓN

**Assembly Checks:**
- ✅ Rutas registradas en `master-route-registry.js`
- ✅ Handlers mapeados en `master-router-resolver.js`
- ✅ Script registrado en `master-layout-registry.v1.json`
- ✅ Sidebar entry en `master-sidebar-registry.js`

**Tests Manuales:**
1. Navegar a `/master/alumnos`
2. Verificar que se carga la tabla
3. Verificar que se muestran todos los campos
4. Click en una fila → verificar modal JSON
5. Verificar metadata de columnas (si include_columns=true)
6. Verificar paginación (si hay más de 50 alumnos)

---

## 🔄 PRÓXIMOS PASOS (FUTURO)

**Placeholders:**
- `/master/alumnos/info` - "Información espiritual del alumno" (sin implementar todavía)

**Mejoras Futuras (NO en v1):**
- Filtros avanzados
- Exportar datos (CSV, JSON)
- Edición de datos (si se requiere)
- Visualizaciones estadísticas

---

## 📚 REFERENCIAS

- **Auditoría SOT:** `docs/STUDENT_SOT_AUDIT_V1.md`
- **Tabla Canónica:** `alumnos` (PostgreSQL)
- **Repositorio:** `src/infra/repos/student-repo-pg.js`
- **Servicio:** `src/services/student-sot-service.js`
- **Master Route Registry:** `src/core/master/registry/master-route-registry.js`
- **Master Sidebar Registry:** `src/core/master/registry/master-sidebar-registry.js`
