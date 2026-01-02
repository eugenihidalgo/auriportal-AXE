# UI Admin Schema v1 - Guía de Validación

## Descripción

El **UI Admin Schema v1** es un JSON Schema (Draft 2020-12) que valida que una UI Admin cumple el **Contrato Canónico v1** de AuriPortal.

**Archivo:** `docs/UI_ADMIN_SCHEMA_V1.json`

## Propósito

Este schema garantiza que **TODA UI Admin** (creada a mano, por editor visual o por IA) cumple:
- Los **28 invariantes constitucionales** (INV-001 a INV-028)
- Las **29 garantías del sistema** (GAR-001 a GAR-029)
- Las **capacidades [CORE] y [READY]** definidas en el contrato

## Estructura del Schema

El schema valida una entidad llamada `AdminUIScreen` con los siguientes bloques obligatorios:

1. **meta** - Metadata (id, name, status, version)
2. **route** - Configuración de routing (key, path, type)
3. **context** - Contexto requerido (user, systemMode, featureFlags)
4. **permissions** - Permisos requeridos (read, write)
5. **capabilities** - Capacidades declaradas (IDs formato PREFIJO-NNN)
6. **data** - Contratos de datos (para capacidades [READY])
7. **actions** - Acciones disponibles (mutations, queries, navigation)
8. **layout** - Configuración de layout (template, placeholders, scripts, styles)
9. **navigation** - Configuración de navegación (sidebar desde registry)
10. **observability** - Observabilidad (traceId, logging, signals)
11. **diagnostics** - Diagnóstico (errorContract, correlation)
12. **lifecycle** - Ciclo de vida (render, degradation)

## Validaciones Clave

### INV-002: Separación API / UI
- `route.type` **SOLO** puede ser `"island"` para UIs Admin
- `route.path` **NO puede** empezar con `/admin/api/`
- Las rutas `/admin/api/*` son `type='api'` y no son UIs Admin

### INV-004: Contexto de renderAdminPage
- `lifecycle.render.method` debe ser `"renderAdminPage"`
- `lifecycle.render.contextRequired` debe ser `true`

### INV-008: Servicios Canónicos
- Todas las mutaciones deben tener `service` (servicio canónico)
- No se permiten escrituras directas a PostgreSQL

### INV-009: Auditoría Obligatoria
- Todas las mutaciones deben tener `auditable: true`

### INV-012: Señales Registradas
- Solo se pueden emitir señales registradas
- `observability.signals.onlyRegistered` debe ser `true`

### INV-014: Template Base
- `layout.template` debe ser `"base"`

### INV-019: Sidebar Gobernado
- `navigation.sidebar.source` debe ser `"registry"`

### INV-021: Capability-First
- `layout.capabilities` debe declarar capabilities semánticas (no hardcodeo visual)

## Cómo Validar

### Opción 1: Usando Ajv (Node.js)

```bash
npm install ajv ajv-formats
```

```javascript
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import schema from './docs/UI_ADMIN_SCHEMA_V1.json' assert { type: 'json' };
import uiAdminScreen from './path/to/ui-admin-screen.json' assert { type: 'json' };

const ajv = new Ajv({ strict: true, allErrors: true });
addFormats(ajv);

const validate = ajv.compile(schema);
const valid = validate(uiAdminScreen);

if (!valid) {
  console.error('Errores de validación:');
  console.error(validate.errors);
} else {
  console.log('✅ UI Admin válida');
}
```

### Opción 2: Usando Assembly Check

El sistema de Assembly Check de AuriPortal puede usar este schema:

```bash
node scripts/admin-ui-assembly-check.js --schema docs/UI_ADMIN_SCHEMA_V1.json --strict
```

### Opción 3: Validación en Editor Visual

Un editor visual futuro puede usar este schema para:
- Validar UIs Admin mientras se crean
- Sugerir correcciones
- Prevenir violaciones de invariantes

### Opción 4: CI/CD

En el pipeline de CI/CD:

```bash
# Validar todas las UIs Admin antes de desplegar
for ui in src/ui-admin/*.json; do
  ajv validate -s docs/UI_ADMIN_SCHEMA_V1.json -d "$ui" || exit 1
done
```

## Ejemplo de UI Admin Válida

```json
{
  "meta": {
    "id": "admin-dashboard",
    "name": "Dashboard Administrativo",
    "status": "active",
    "version": "1.0.0"
  },
  "route": {
    "key": "admin-dashboard",
    "path": "/admin/dashboard",
    "type": "island"
  },
  "context": {
    "user": { "required": true },
    "systemMode": { "required": true, "blockWritesInBroken": true },
    "featureFlags": { "required": true }
  },
  "permissions": {
    "read": ["admin:read"],
    "write": ["admin:write"]
  },
  "capabilities": {
    "declared": ["CTX-001", "OBS-002", "ACT-001", "NAV-001", "LAY-001"]
  },
  "data": {
    "contracts": [
      {
        "entity": "alumno",
        "operation": "read"
      }
    ]
  },
  "actions": {
    "mutations": [
      {
        "id": "update-alumno",
        "type": "update",
        "entity": "alumno",
        "permission": "admin:write",
        "service": "alumno-service",
        "auditable": true
      }
    ],
    "queries": [
      {
        "id": "list-alumnos",
        "entity": "alumno",
        "permission": "admin:read",
        "service": "alumno-service"
      }
    ]
  },
  "layout": {
    "template": "base",
    "placeholders": {
      "title": "Dashboard",
      "content": "<div>Contenido del dashboard</div>",
      "sidebar": "auto"
    },
    "capabilities": ["primary-action", "warning-badge"],
    "theme": {
      "resolve": true
    }
  },
  "navigation": {
    "sidebar": {
      "source": "registry"
    },
    "filterByPermissions": true
  },
  "observability": {
    "traceId": {
      "propagate": true,
      "required": true
    },
    "logging": {
      "structured": true,
      "includeMetadata": true
    },
    "signals": {
      "onlyRegistered": true,
      "emitted": []
    }
  },
  "diagnostics": {
    "errorContract": {
      "version": "v1",
      "includeDiagnosis": true
    },
    "correlation": {
      "byTraceId": true
    }
  },
  "lifecycle": {
    "render": {
      "method": "renderAdminPage",
      "contextRequired": true
    }
  }
}
```

## Ejemplo de UI Admin Inválida

```json
{
  "meta": {
    "id": "invalid-ui",
    "name": "UI Inválida",
    "status": "active"
    // ❌ Falta "version" (requerido si status='active')
  },
  "route": {
    "key": "invalid-route",
    "path": "/admin/api/invalid",
    "type": "island"
    // ❌ INV-002 violado: Rutas /admin/api/* no pueden ser type='island'
  }
  // ❌ Faltan bloques obligatorios: context, permissions, capabilities, etc.
}
```

## Integración con Garantías

Este schema es usado por las siguientes garantías:

- **GAR-003 / GAR-004:** Assembly Check (modo normal y estricto)
- **GAR-005:** Guard de renderAdminPage
- **GAR-026:** Validación Pre-Despliegue en CI/CD
- **GAR-024 / GAR-025:** Validación en Editor de Pantallas (READY)

## Notas Importantes

1. **additionalProperties: false** - El schema es estricto, no permite propiedades desconocidas
2. **Solo capacidades [CORE] y [READY]** - Las capacidades [PRODUCT] y [FUTURE] no están en el schema
3. **Referencias a invariantes** - Cada validación referencia explícitamente el invariante que protege
4. **Machine-validatable** - El schema puede validarse automáticamente sin interpretación humana

## Soporte

Para preguntas o problemas con el schema, consultar:
- `docs/ADMIN_UI_CONTRACT_V1.md` - Contrato Canónico completo
- `docs/ADMIN_UI_CREATION_DIAGNOSTIC.md` - Diagnóstico de creación de UIs Admin
- `scripts/admin-ui-assembly-check.js` - Script de validación

---

**Versión del Schema:** 1.0.0  
**Compatible con:** Contrato Canónico v1 (Secciones 1-6)  
**Última actualización:** 2025-01-XX




