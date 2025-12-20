# 🔍 Diagnóstico: Biblioteca de Decretos - Admin

**Fecha:** 2024-12-19  
**Objetivo:** Analizar el estado actual del sistema de gestión de decretos en el admin para implementar editor WYSIWYG

---

## 📋 RESUMEN EJECUTIVO

### ✅ Lo que FUNCIONA actualmente:
- ✅ Tabla `decretos` existe en PostgreSQL con estructura básica
- ✅ Endpoints CRUD básicos implementados (crear, actualizar, eliminar)
- ✅ UI de listado funcional (`/admin/decretos`)
- ✅ UI de edición funcional (`/admin/decretos/editar/:id`)
- ✅ Servicio de decretos (`decretos-service.js`) con funciones CRUD
- ✅ Integración con PDE: resolver de decretos (`decrees-resolver.js`)
- ✅ Renderizado de decretos en cliente (`decreto.html`)

### ❌ Lo que NO FUNCIONA o FALTA:
- ❌ **Editor WYSIWYG**: Actualmente solo hay un `<textarea>` para HTML manual
- ❌ **Sanitización de HTML**: No hay sanitización server-side del contenido
- ❌ **Campos faltantes en BD**: 
  - `content_delta` (JSONB) - para guardar formato del editor
  - `content_text` (TEXT) - para búsquedas/previews
  - `descripcion` (TEXT) - descripción opcional del decreto
  - `deleted_at` (TIMESTAMP) - soft delete normalizado (actualmente usa `activo = false`)
- ❌ **Endpoints API RESTful**: Actualmente usa `/api/decretos/crear` en lugar de `/api/pde/decretos` (POST)
- ❌ **Repositorio estructurado**: El servicio accede directamente a DB (no hay capa de repositorio)
- ❌ **Vista previa**: No hay botón de vista previa en el editor
- ❌ **Búsqueda**: No hay búsqueda en el listado

---

## 🗄️ ESTRUCTURA ACTUAL DE BASE DE DATOS

### Tabla: `decretos`

**Ubicación:** Definida en `database/pg.js` (líneas 1726-1741)

**Columnas actuales:**
```sql
CREATE TABLE IF NOT EXISTS decretos (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  contenido_html TEXT NOT NULL,
  nivel_minimo INT DEFAULT 1,
  posicion VARCHAR(20) DEFAULT 'inicio',
  obligatoria_global BOOLEAN DEFAULT false,
  obligatoria_por_nivel JSONB DEFAULT '{}',
  orden INT DEFAULT 0,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Índices:**
- `idx_decretos_nivel_minimo` en `nivel_minimo`
- `idx_decretos_activo` en `activo`

**Gaps identificados:**
1. ❌ Falta `content_delta` (JSONB) - para guardar formato del editor WYSIWYG
2. ❌ Falta `content_text` (TEXT) - para búsquedas y previews
3. ❌ Falta `descripcion` (TEXT) - descripción opcional
4. ❌ Falta `deleted_at` (TIMESTAMP) - soft delete normalizado (actualmente usa `activo = false`)
5. ⚠️ `contenido_html` no tiene sanitización garantizada

---

## 🔌 ENDPOINTS ACTUALES

### UI Endpoints (HTML)

| Ruta | Método | Handler | Estado |
|------|--------|---------|--------|
| `/admin/decretos` | GET | `renderListadoDecretos` | ✅ Funcional |
| `/admin/decretos/editar/:id` | GET | `renderEditarDecreto` | ✅ Funcional |

**Registro:** `src/endpoints/admin-panel-v4.js` (líneas 1382-1390)

### API Endpoints (JSON)

| Ruta | Método | Handler | Estado | Problema |
|------|--------|---------|--------|----------|
| `/api/decretos/crear` | POST | `apiCrearDecreto` | ✅ Funcional | ❌ No RESTful (debería ser `/api/pde/decretos`) |
| `/api/decretos/actualizar` | POST | `apiActualizarDecreto` | ✅ Funcional | ❌ No RESTful (debería ser `PUT /api/pde/decretos/:id`) |
| `/api/decretos/eliminar` | POST | `apiEliminarDecreto` | ✅ Funcional | ❌ No RESTful (debería ser `DELETE /api/pde/decretos/:id`) |
| `/api/decretos/sync` | POST | `apiSincronizarDecretos` | ⚠️ Stub | ❌ No implementado |

**Registro:** `src/endpoints/admin-panel-v4.js` (líneas 1392-1408)

**Endpoints faltantes:**
- ❌ `GET /api/pde/decretos` - Listar decretos (JSON)
- ❌ `GET /api/pde/decretos/:id` - Obtener un decreto
- ❌ `POST /api/pde/decretos/:id/restore` - Restaurar decreto eliminado

---

## 📁 ESTRUCTURA DE ARCHIVOS

### Backend

```
src/
├── endpoints/
│   └── admin-decretos.js          ✅ Existe - Handlers UI + API
├── services/
│   └── decretos-service.js        ✅ Existe - CRUD directo a DB
└── core/
    ├── pde/
    │   └── catalogs/
    │       └── decrees-resolver.js ✅ Existe - Resolver PDE
    └── html/
        └── admin/
            └── decretos/
                ├── decretos-listado.html  ✅ Existe
                └── decretos-editar.html   ✅ Existe (textarea simple)
```

### Frontend

```
public/
└── js/
    └── admin-decretos.js          ✅ Existe - JS básico (guardar/eliminar)
```

### Cliente PDE

```
src/core/html/practicas/
└── decreto.html                   ✅ Existe - Template de renderizado
```

---

## 🔧 SERVICIO ACTUAL (`decretos-service.js`)

### Funciones implementadas:

1. ✅ `listarDecretos(soloActivos = false)` - Lista decretos
2. ✅ `obtenerDecreto(id)` - Obtiene un decreto por ID
3. ✅ `crearDecreto(datos)` - Crea nuevo decreto
4. ✅ `actualizarDecreto(id, datos)` - Actualiza decreto
5. ✅ `eliminarDecreto(id)` - Soft delete (pone `activo = false`)

### Problemas identificados:

1. ❌ **Acceso directo a DB**: No usa capa de repositorio (viola regla arquitectónica)
2. ❌ **Sin sanitización**: No sanitiza `contenido_html` antes de guardar
3. ❌ **Soft delete inconsistente**: Usa `activo = false` en lugar de `deleted_at`
4. ❌ **Sin validación**: No valida datos de entrada
5. ⚠️ **Manejo de errores básico**: Solo loguea errores, no estructura

---

## 🎨 UI ACTUAL

### Listado (`decretos-listado.html`)

**Funcionalidades:**
- ✅ Tabla con: Nombre, Nivel mínimo, Posición, Obligatoria, Activo, Acciones
- ✅ Botón "Nuevo decreto"
- ✅ Botón "Sincronizar con Drive + ClickUp" (stub)
- ✅ Acciones: Editar, Eliminar

**Falta:**
- ❌ Búsqueda por nombre
- ❌ Filtros (por nivel, posición, activo)
- ❌ Preview rápido (modal o panel lateral)
- ❌ Paginación (si hay muchos decretos)

### Editor (`decretos-editar.html`)

**Funcionalidades:**
- ✅ Campo: Nombre (obligatorio)
- ✅ Campo: Nivel mínimo (select 1-9)
- ✅ Campo: Posición (select: inicio/fin)
- ✅ Campo: Obligatoria Global (checkbox)
- ✅ Campo: Obligatoria por Nivel (textarea JSON)
- ✅ Campo: Contenido HTML (textarea simple) ⚠️ **AQUÍ ESTÁ EL PROBLEMA**

**Problemas:**
- ❌ **Editor HTML manual**: Solo hay un `<textarea>` - muy incómodo
- ❌ **Sin vista previa**: No hay botón para ver cómo se renderiza
- ❌ **Sin validación visual**: No muestra errores de formato
- ❌ **Sin autosave**: No hay guardado automático
- ❌ **Sin descripción**: No hay campo para descripción opcional

**Mensaje actual en UI:**
```html
<p class="text-slate-400 text-xs mt-1">
  Editor visual aún no implementado. Usa HTML directamente.
</p>
```

---

## 🔗 INTEGRACIÓN CON PDE

### Resolver de Decretos (`decrees-resolver.js`)

**Estado:** ✅ Funcional y bien estructurado

**Funciones:**
- `resolveDecreeBundle(studentCtx, options)` - Resuelve bundle de decretos
- `resolveDecreeById(decretoId, studentCtx)` - Resuelve un decreto por ID

**Características:**
- ✅ Filtrado por nivel del estudiante
- ✅ Filtrado por posición
- ✅ Filtrado por obligatorias
- ✅ Inyección de `contenido_html` en el bundle
- ✅ Fail-open: devuelve bundle vacío si hay error

**Compatibilidad:**
- ✅ Usa `contenido_html` de la tabla
- ✅ Compatible con estructura actual
- ⚠️ No usa `content_delta` (no existe aún)

### Renderizado Cliente (`decreto.html`)

**Estado:** ✅ Funcional

**Características:**
- ✅ Template HTML con estilos PDE
- ✅ Renderiza `{{CONTENIDO_HTML}}` directamente
- ✅ Responsive y accesible

**Compatibilidad:**
- ✅ Funciona con HTML sanitizado
- ⚠️ No tiene fallback si `contenido_html` está vacío

---

## 📊 ANÁLISIS DE GAPS

### Gaps Críticos (Bloquean funcionalidad)

1. **Editor WYSIWYG ausente**
   - Impacto: ALTO - Usuarios deben escribir HTML manual
   - Prioridad: CRÍTICA

2. **Sanitización de HTML faltante**
   - Impacto: ALTO - Riesgo de seguridad (XSS)
   - Prioridad: CRÍTICA

3. **Campos BD faltantes**
   - Impacto: MEDIO - Limita funcionalidad futura
   - Prioridad: ALTA

### Gaps de Mejora (No bloquean)

4. **Endpoints no RESTful**
   - Impacto: BAJO - Funciona pero no sigue estándares
   - Prioridad: MEDIA

5. **Sin capa de repositorio**
   - Impacto: MEDIO - Violación arquitectónica
   - Prioridad: MEDIA

6. **Soft delete inconsistente**
   - Impacto: BAJO - Funciona pero no normalizado
   - Prioridad: BAJA

7. **Sin búsqueda/filtros en listado**
   - Impacto: BAJO - UX mejorable
   - Prioridad: BAJA

---

## 🎯 DECISIONES TÉCNICAS NECESARIAS

### 1. Librería WYSIWYG

**Opciones:**
- **Quill** (recomendado): Ligero, sin bundler, fácil integración
- **TinyMCE Community**: Más pesado, más features
- **TipTap**: Requiere bundler (descartado)

**Decisión v1:** Quill (assets locales en `/public/vendor/quill/`)

### 2. Estructura de Datos

**Guardar:**
- `content_html` (TEXT) - HTML renderizado (siempre)
- `content_delta` (JSONB) - Delta de Quill (opcional, para edición futura)
- `content_text` (TEXT) - Texto plano (opcional, para búsquedas)

### 3. Sanitización

**Librería:** `DOMPurify` (client-side) + sanitización server-side básica

**Allowlist:**
- Elementos: `p`, `br`, `strong`, `em`, `u`, `h1`, `h2`, `h3`, `ul`, `ol`, `li`, `blockquote`, `a`, `span`
- Atributos: `href` (en `a`), `style` limitado (en `span`)

### 4. Endpoints API

**Decisión:** Mantener compatibilidad con endpoints actuales + añadir RESTful

**Rutas nuevas:**
- `GET /api/pde/decretos` - Listar
- `GET /api/pde/decretos/:id` - Obtener
- `POST /api/pde/decretos` - Crear
- `PUT /api/pde/decretos/:id` - Actualizar
- `DELETE /api/pde/decretos/:id` - Eliminar
- `POST /api/pde/decretos/:id/restore` - Restaurar

**Rutas legacy (mantener):**
- `POST /api/decretos/crear` → Redirige a nuevo endpoint
- `POST /api/decretos/actualizar` → Redirige a nuevo endpoint
- `POST /api/decretos/eliminar` → Redirige a nuevo endpoint

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

### FASE 1: Migraciones
- [ ] Crear migración `vX.X.X-decretos-editor-v1.sql`
- [ ] Añadir columnas: `content_delta`, `content_text`, `descripcion`, `deleted_at`
- [ ] Aplicar migración y verificar

### FASE 2: Repositorio
- [ ] Crear `src/infra/repos/decretos-repo-pg.js`
- [ ] Implementar: `list()`, `getById()`, `create()`, `update()`, `softDelete()`, `restore()`
- [ ] Añadir sanitización server-side
- [ ] Actualizar `decretos-service.js` para usar repo

### FASE 3: Endpoints API
- [ ] Crear endpoints RESTful `/api/pde/decretos/*`
- [ ] Mantener compatibilidad con endpoints legacy
- [ ] Añadir `requireAdminContext()` en todos

### FASE 4: UI Admin
- [ ] Integrar Quill en `decretos-editar.html`
- [ ] Añadir campo Descripción
- [ ] Añadir botón "Vista previa"
- [ ] Añadir feedback de guardado
- [ ] Mejorar listado: búsqueda, preview rápido

### FASE 5: Integración PDE
- [ ] Verificar que `decrees-resolver.js` sigue funcionando
- [ ] Añadir fallback si `contenido_html` está vacío
- [ ] Probar renderizado en cliente

### FASE 6: Tests + Docs
- [ ] Tests básicos repo CRUD
- [ ] Documentación final

---

## 📝 NOTAS ADICIONALES

1. **Compatibilidad:** El sistema actual funciona, así que los cambios deben ser incrementales y reversibles.

2. **No romper:** 
   - `renderHtml/applyTheme` debe seguir funcionando
   - Admin layout no debe cambiar
   - Cliente PDE debe seguir renderizando decretos

3. **Fail-open:** Si el editor falla, permitir fallback a textarea básico.

4. **Assets:** Quill debe estar en `/public/vendor/quill/` (local, no CDN) para robustez.

---

**Fin del Diagnóstico**




