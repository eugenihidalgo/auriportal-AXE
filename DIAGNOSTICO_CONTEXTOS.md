# 📋 Diagnóstico Completo: Sistema de Contextos en AurelinPortal

## 📌 Resumen Ejecutivo

El sistema de **Contextos (Context System)** en aurelinportal es un mecanismo central que gestiona variables y parámetros dinámicos en toda la aplicación. Funciona con un principio **"fail-open"** (tolerancia a fallos sin bloqueos), combinando contextos del sistema con contextos personalizados almacenados en base de datos.

---

## 🏗️ Arquitectura General

### Componentes Principales

```
┌─────────────────────────────────────────────────────────────┐
│                      SISTEMA DE CONTEXTOS                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Registry (Source of Truth)                          │   │
│  │  📄 context-registry.js                              │   │
│  │  - SYSTEM_CONTEXT_DEFAULTS (defaults del sistema)    │   │
│  │  - normalizeContextDefinition()                       │   │
│  │  - validateContextDefinition()                        │   │
│  │  - mergeContextValues()                               │   │
│  └──────────────────────────────────────────────────────┘   │
│                           ▼                                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Service Layer                                       │   │
│  │  📄 pde-contexts-service.js                          │   │
│  │  - listContexts()    → DB + system defaults          │   │
│  │  - getContext()      → obtener un contexto           │   │
│  │  - createContext()   → crear nuevo                   │   │
│  │  - updateContext()   → actualizar existente          │   │
│  │  - deleteContext()   → soft-delete                   │   │
│  │  - getDefaultValue() → obtener default               │   │
│  └──────────────────────────────────────────────────────┘   │
│                           ▼                                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Repository (Data Access)                            │   │
│  │  📄 pde-contexts-repo-pg.js                          │   │
│  │  - Gestiona tabla `pde_contexts` en PostgreSQL        │   │
│  │  - CRUD operations                                   │   │
│  │  - Validaciones de combinaciones de campos           │   │
│  │  - Construcción de definition desde columnas         │   │
│  └──────────────────────────────────────────────────────┘   │
│                           ▼                                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Endpoints (API)                                     │   │
│  │  📄 admin-contexts-ui.js / admin-contexts-api.js     │   │
│  │  - GET /admin/contexts              (UI)             │   │
│  │  - GET /admin/pde/contexts          (API)            │   │
│  │  - POST /admin/pde/contexts         (crear)          │   │
│  │  - PATCH /admin/pde/contexts/:key   (actualizar)     │   │
│  │  - DELETE /admin/pde/contexts/:key  (eliminar)       │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 📂 Estructura de Carpetas

```
src/
├── core/
│   └── contexts/
│       └── context-registry.js          ← Registry canónico
├── services/
│   └── pde-contexts-service.js          ← Lógica de negocio
├── infra/
│   └── repos/
│       └── pde-contexts-repo-pg.js      ← Acceso a base de datos
├── endpoints/
│   ├── admin-contexts-ui.js             ← UI (HTML)
│   └── admin-contexts-api.js            ← REST API
└── core/
    └── context/
        └── resolve-context-visibility.js ← Resolución de visibilidad
```

---

## 🔑 Archivos Clave

### 1. **context-registry.js** (Source of Truth)
**Ubicación:** `/var/www/aurelinportal/src/core/contexts/context-registry.js`

**Responsabilidades:**
- Define `SYSTEM_CONTEXT_DEFAULTS` (contextos predefinidos del sistema)
- Normaliza definiciones de contexto (rellenar defaults)
- Valida definiciones de contexto
- Proporciona funciones utilitarias para merge de valores

**Funciones Principales:**

| Función | Descripción |
|---------|-------------|
| `normalizeContextDefinition(def)` | Rellena fields faltantes con defaults seguros |
| `validateContextDefinition(def, opts)` | Valida estructura de contexto (warnings o errores) |
| `getDefaultValueForType(type)` | Retorna default según tipo (string, number, boolean, enum, json) |
| `mergeContextValues({registryDefs, packageDefs, runtimeValues})` | Combina contextos de múltiples fuentes (precedencia) |
| `isValidContextKey(contextKey)` | Valida que context_key sea un slug válido |

**Principios:**
- ✅ **Fail-open absoluto:** todo tiene default, nada bloquea
- ✅ **Centralizado:** única fuente de verdad
- ✅ **Tolerante a fallos:** si falta contexto, se crea virtual con default

---

### 2. **pde-contexts-service.js** (Service Layer)
**Ubicación:** `/var/www/aurelinportal/src/services/pde-contexts-service.js`

**Responsabilidades:**
- Combina contextos de DB + defaults del sistema
- Implementa CRUD de contextos
- Sincroniza context mappings
- Filtra contextos por visibilidad

**Funciones Principales:**

| Función | Descripción |
|---------|-------------|
| `listContexts(options)` | Lista todos (DB override) |
| `getContext(contextKey)` | Obtiene un contexto por clave |
| `createContext(definition)` | Crea nuevo contexto |
| `updateContext(contextKey, patch)` | Actualiza existente |
| `deleteContext(contextKey)` | Soft-delete |
| `getDefaultValue(contextKey)` | Obtiene default de un contexto |
| `archiveContext(contextKey)` | Archiva sin eliminar |

**Precedencia de Contextos:**
```
1. DB (custom overrides)
2. SYSTEM_CONTEXT_DEFAULTS (sistema)
3. Virtual (creado al vuelo si falta)
```

---

### 3. **pde-contexts-repo-pg.js** (Repository)
**Ubicación:** `/var/www/aurelinportal/src/infra/repos/pde-contexts-repo-pg.js`

**Responsabilidades:**
- CRUD en tabla `pde_contexts` (PostgreSQL)
- Validación de combinaciones de campos
- Construcción de `definition` desde columnas dedicadas
- Soft-delete policy

**Tabla PostgreSQL:**
```sql
CREATE TABLE pde_contexts (
  id                  SERIAL PRIMARY KEY,
  context_key         VARCHAR(255) UNIQUE NOT NULL,
  label               VARCHAR(255) NOT NULL,
  kind                VARCHAR(50) DEFAULT 'normal',
  type                VARCHAR(50) DEFAULT 'string',
  scope               VARCHAR(50) DEFAULT 'package',
  injected            BOOLEAN DEFAULT false,
  allowed_values      TEXT[],
  default_value       TEXT,
  description         TEXT,
  origin              VARCHAR(100),
  definition          JSONB,              -- DERIVADO (construido desde columnas)
  status              VARCHAR(50) DEFAULT 'active',
  archived_at         TIMESTAMP,
  deleted_at          TIMESTAMP,
  created_at          TIMESTAMP DEFAULT NOW(),
  updated_at          TIMESTAMP DEFAULT NOW()
);
```

**Métodos Principales:**

| Método | Descripción |
|--------|-------------|
| `getByKey(contextKey, includeDeleted)` | Obtiene por clave |
| `list(options)` | Lista con filtros |
| `create(data)` | Inserta nuevo |
| `update(contextKey, patch)` | Actualiza |
| `delete(contextKey)` | Soft-delete |
| `archive(contextKey)` | Archiva |
| `hardDelete(contextKey)` | Elimina permanentemente |

---

### 4. **admin-contexts-ui.js & admin-contexts-api.js** (Endpoints)
**Ubicación:** 
- `/var/www/aurelinportal/src/endpoints/admin-contexts-ui.js` (UI)
- `/var/www/aurelinportal/src/endpoints/admin-contexts-api.js` (API)

**Rutas:**

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/admin/contexts` | Renderiza gestor UI |
| GET | `/admin/pde/contexts` | Lista contextos (JSON) |
| POST | `/admin/pde/contexts` | Crea contexto |
| GET | `/admin/pde/contexts/:key` | Obtiene un contexto |
| PATCH | `/admin/pde/contexts/:key` | Actualiza contexto |
| DELETE | `/admin/pde/contexts/:key` | Elimina contexto |
| POST | `/admin/pde/contexts/:key/archive` | Archiva |

**Respuestas:**
```javascript
// Éxito
{ ok: true, context: {...}, warnings: [...] }

// Error
{ ok: false, error: 'mensaje', details: [...] }
```

---

## 🎯 Tipos de Contextos

### Tipos Soportados

| Tipo | Default | Descripción |
|------|---------|-------------|
| `string` | `""` | Texto libre |
| `number` | `0` | Números |
| `boolean` | `false` | Verdadero/Falso |
| `enum` | `null` | Valores fijos |
| `json` | `{}` | Objetos/arrays |

### Propiedades de Definición

```javascript
{
  type:              'string|number|boolean|enum|json',
  scope:             'package|system|structural',
  kind:              'normal|level|signal',
  injected:          true|false,
  allowed_values:    [...],        // Solo si type='enum'
  default_value:     <any>,        // Según tipo
  description:       'descripción',
  origin:            'user_choice|system|package',
  usable_en_paquetes: true|false   // Solo si scope='system'
}
```

### Scopos

| Scope | Descripción |
|-------|-------------|
| `package` | Ámbito de paquete/recorrido |
| `system` | Sistema global (inyectable) |
| `structural` | Relacionado con niveles/estructura |

---

## 🔄 Flujos Principales

### Flujo 1: Obtener Contexto

```
Usuario solicita contexto "tipo_practica"
        ↓
Service: getContext("tipo_practica")
        ↓
¿Existe en DB? 
  → SÍ: retornar de DB
  ↓ NO
¿Existe en SYSTEM_CONTEXT_DEFAULTS?
  → SÍ: retornar default del sistema
  ↓ NO
¿Fue eliminado en DB?
  → SÍ: retornar null (no mostrar virtual)
  ↓ NO
  → Crear virtual con default por tipo
```

**Código:**
```javascript
export async function getContext(contextKey) {
  if (!contextKey) return null;

  // 1. Buscar en DB
  const dbCtx = await contextsRepo.getByKey(contextKey);
  if (dbCtx) return { ...dbCtx, is_system: false };

  // 2. Buscar en defaults del sistema
  const systemCtx = SYSTEM_CONTEXT_DEFAULTS.find(
    ctx => ctx.context_key === contextKey
  );
  if (systemCtx) return {
    context_key: systemCtx.context_key,
    label: systemCtx.label,
    definition: normalizeContextDefinition(systemCtx.definition),
    status: 'active',
    is_system: true
  };

  return null;
}
```

### Flujo 2: Crear Contexto

```
POST /admin/pde/contexts { context_key, label, definition }
        ↓
Validar context_key (slug válido)
        ↓
Validar definition
  - Normalizar
  - Validate (warnings en no-strict)
        ↓
¿Ya existe context_key?
  → SÍ: error 409 Conflict
        ↓ NO
Insertar en DB
        ↓
Retornar { ok: true, context, warnings }
```

**Validaciones:**
- `context_key` es slug: `[a-z0-9_-]+`
- `label` y `definition` requeridos
- Si `type='enum'`: `allowed_values` no vacío
- Si `default_value` definido: compatible con `type`

### Flujo 3: Listar Contextos (merge DB + sistema)

```
Service: listContexts()
        ↓
1. Obtener de DB (solo activos)
2. Obtener de SYSTEM_CONTEXT_DEFAULTS
3. Crear mapa: DB override por context_key
4. Mostrar:
   - Contextos de DB (activos)
   - Contextos de sistema (si NO están eliminados en DB)
        ↓
Retornar array ordenado + aplicar visibilidad
```

---

## 📊 Ejemplos de Contextos

### Ejemplo 1: Contexto String Simple
```javascript
{
  context_key: "idioma_preferido",
  label: "Idioma Preferido",
  definition: {
    type: "string",
    default_value: "es",
    scope: "package",
    origin: "user_choice",
    description: "Idioma preferido del usuario"
  }
}
```

### Ejemplo 2: Contexto Enum (valores fijos)
```javascript
{
  context_key: "tipo_meditacion",
  label: "Tipo de Meditación",
  definition: {
    type: "enum",
    allowed_values: ["guiada", "silenciosa", "musica"],
    default_value: "guiada",
    scope: "package",
    origin: "user_choice",
    description: "Tipo de meditación a practicar"
  }
}
```

### Ejemplo 3: Contexto System (inyectable)
```javascript
{
  context_key: "sesion_id",
  label: "ID de Sesión",
  definition: {
    type: "string",
    scope: "system",
    kind: "normal",
    injected: true,
    origin: "system",
    description: "ID único de sesión"
  }
}
```

### Ejemplo 4: Contexto Structural (nivel)
```javascript
{
  context_key: "nivel_actual",
  label: "Nivel Actual",
  definition: {
    type: "string",
    scope: "structural",
    kind: "level",
    injected: true,
    default_value: "principiante",
    origin: "system",
    description: "Nivel de progresión actual"
  }
}
```

---

## 🔍 Diagnóstico Actual

### Estado del Sistema

✅ **Operativo**: El sistema de contextos está completamente funcional.

#### Contextos del Sistema Activos

Actualmente el archivo `SYSTEM_CONTEXT_DEFAULTS` está **vacío** (comentado):
```javascript
export const SYSTEM_CONTEXT_DEFAULTS = [
  // Contextos del sistema eliminados:
  // - nivel_efectivo (ya no existe, eliminado)
  // - tipo_limpieza (ya no existe, eliminado)
  // - tipo_practica (ya no existe, eliminado)
];
```

**Esto significa:**
- ✅ Contextos personalizados en DB funcionan normalmente
- ✅ No hay "defaults" del sistema por defecto
- ⚠️ Si se necesitan contextos predefinidos, deben crearse explícitamente en la DB

### Validaciones Activas

| Validación | Strict=false | Strict=true |
|------------|--------------|------------|
| Type inválido | ⚠️ Warning | ❌ Error |
| Enum sin allowed_values | ⚠️ Warning | ❌ Error |
| default_value fuera de allowed_values | ⚠️ Warning | ❌ Error |
| Tipo mismatch en default_value | ⚠️ Warning | ❌ Error |
| Scope/kind incompatibles | ⚠️ Warning | ❌ Error |

### Principio Fail-Open

El sistema **nunca bloquea** por falta de contexto:

```javascript
// Si falta un contexto, se retorna:
- null (si no existe en DB ni en sistema)
- default del tipo (en merge de contextos)
- {} para type='json'
- 0 para type='number'
- false para type='boolean'
- '' para type='string'
```

---

## 🚀 Casos de Uso

### Caso 1: Almacenar preferencia del usuario
```javascript
// Crear contexto
POST /admin/pde/contexts
{
  "context_key": "color_tema",
  "label": "Color de Tema",
  "definition": {
    "type": "enum",
    "allowed_values": ["claro", "oscuro", "auto"],
    "default_value": "auto"
  }
}

// Usar en paquete/recorrido
{
  context: { color_tema: "oscuro" }
}
```

### Caso 2: Contextos inyectados por sistema
```javascript
// Sistema define (ya en DB o SYSTEM_CONTEXT_DEFAULTS)
{
  context_key: "timestamp_inicio",
  definition: {
    type: "string",
    scope: "system",
    injected: true
  }
}

// Sistema inyecta automáticamente en runtime
contexts = {
  ...contexts,
  timestamp_inicio: "2025-12-21T10:30:00Z"
}
```

### Caso 3: Contextos de estructura (niveles)
```javascript
{
  context_key: "nivel_1",
  label: "Nivel 1: Principiante",
  definition: {
    type: "string",
    scope: "structural",
    kind: "level",
    injected: true
  }
}
```

---

## 🛠️ Operaciones Comunes

### Ver todos los contextos
```bash
curl http://localhost:3000/admin/pde/contexts \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Crear contexto
```bash
curl -X POST http://localhost:3000/admin/pde/contexts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "context_key": "mi_contexto",
    "label": "Mi Contexto",
    "definition": {
      "type": "string",
      "default_value": "valor",
      "scope": "package"
    }
  }'
```

### Obtener contexto específico
```bash
curl http://localhost:3000/admin/pde/contexts/mi_contexto \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Actualizar contexto
```bash
curl -X PATCH http://localhost:3000/admin/pde/contexts/mi_contexto \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "label": "Etiqueta Actualizada",
    "definition": { ... }
  }'
```

### Eliminar contexto
```bash
curl -X DELETE http://localhost:3000/admin/pde/contexts/mi_contexto \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Archivar contexto (soft-delete sin eliminar)
```bash
curl -X POST http://localhost:3000/admin/pde/contexts/mi_contexto/archive \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 📈 Integración con Paquetes

Los contextos se integran en paquetes/recorridos así:

```javascript
// En definición de paquete
{
  package_key: "meditacion_matutina",
  contexts: {
    tipo_meditacion: "guiada",
    duracion_minutos: 10,
    lenguaje: "es"
  }
}

// En runtime, se resuelve:
const resolved = mergeContextValues({
  registryDefs: registryContexts,      // De DB + sistema
  packageDefs: package.contexts,       // Overrides del paquete
  runtimeValues: userContexts          // Overrides en runtime
});
```

---

## ⚙️ Configuración y Parámetros

### Validación Estricta (strict mode)

**strict=false** (default):
- Warnings pero no bloquea
- Permite creación con issues menores
- Fail-open absoluto

**strict=true**:
- Lanza errores si hay problemas
- Rechaza creación si hay combinaciones inválidas
- Usado en APIs de admin

### Filtros en List

```javascript
listContexts({
  includeArchived: false,      // No incluir archivados
  onlyActive: true,            // Solo activos
  includeDeleted: false        // No incluir eliminados
})
```

---

## 🔐 Seguridad

- **Autenticación:** Requiere token de admin en endpoints `/admin/*`
- **Validación de keys:** Solo slugs válidos (`[a-z0-9_-]+`)
- **Soft-delete:** Nunca elimina datos, solo marca como deleted_at
- **Historiales:** Tabla tiene created_at/updated_at/deleted_at

---

## 📝 Recomendaciones

### ✅ Buenas Prácticas

1. **Usar context_key descriptivos:** `usuario_idioma`, no `u_i`
2. **Definir scopes correctamente:** 
   - `package` para contextos de paquete
   - `system` para contextos globales inyectables
   - `structural` para niveles/estructura
3. **Validar definitions:** Incluir `description` siempre
4. **Usar enums para valores fijos:** Mejor que strings libres
5. **Centralizar defaults:** En SYSTEM_CONTEXT_DEFAULTS o DB

### ⚠️ Evitar

1. ❌ Cambiar `definition` después de crear (mejor crear nuevo)
2. ❌ Usar context_keys con espacios o mayúsculas
3. ❌ Deixar `allowed_values` vacío en type='enum'
4. ❌ Tipos incompatibles con default_value
5. ❌ Hard-delete en producción (usar soft-delete)

### 🔍 Debugging

**Ver logs de contextos:**
```bash
# En terminal de la app
grep "CONTEXTS" logs/*.log

# O en real-time
tail -f logs/app.log | grep -i context
```

**Validar definición:**
```javascript
import { validateContextDefinition } from './context-registry.js';

const validation = validateContextDefinition(def, { strict: true });
console.log(validation);
// { valid: bool, warnings: [...], errors: [...] }
```

---

## 📚 Referencias Rápidas

| Archivo | Línea | Descripción |
|---------|-------|-------------|
| context-registry.js | 35-70 | normalizeContextDefinition() |
| context-registry.js | 115-230 | validateContextDefinition() |
| pde-contexts-service.js | 25-120 | listContexts() |
| pde-contexts-service.js | 92-140 | getContext() |
| pde-contexts-repo-pg.js | 114-175 | create() |
| admin-contexts-api.js | 180-250 | handleCreateContext() |

---

## 🎓 Conclusión

El **sistema de contextos** es una arquitectura **robusta, tolerante a fallos y centrada en datos**:

✅ **Fail-open:** Nunca bloquea, siempre tiene default
✅ **Centralizado:** Registry única fuente de verdad
✅ **Flexible:** Soporta DB + sistema + runtime
✅ **Seguro:** Validaciones en múltiples niveles
✅ **Documentado:** Código con comentarios exhaustivos

**Próximos pasos:**
- Poplar `SYSTEM_CONTEXT_DEFAULTS` si se necesitan defaults del sistema
- Crear contextos personalizados en la interfaz admin
- Integrar contextos en paquetes/recorridos
- Monitorear logs para warnings de contextos

---

*Diagnóstico generado: 2025-12-21*
*Versión: 1.0*
