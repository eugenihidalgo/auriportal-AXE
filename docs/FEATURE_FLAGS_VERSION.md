# Feature Flags System v1.0.0 - AuriPortal

## Versión: 1.0.0
**Fecha de Release**: 2025-01-XX  
**Estado**: ✅ Implementado y Certificado

---

## Resumen Ejecutivo

Sistema canónico de Feature Flags para AuriPortal que permite controlar la visibilidad y ejecución de funcionalidades del sistema de forma gobernada y auditable.

**Principios Fundamentales:**
- PostgreSQL es el Source of Truth del estado (enabled/disabled)
- Registry canónico es el Source of Truth de las definiciones
- UI NO puede crear flags nuevos
- Todas las operaciones son auditables
- Flags NO ejecutan lógica, solo retornan booleanos

---

## Componentes Implementados

### 1. Registry Canónico
**Archivo**: `src/core/feature-flags/feature-flag-registry.js`

- Define todas las definiciones de flags
- Flags iniciales:
  - `admin.feature_flags.ui` - Controla visibilidad de UI de Feature Flags
  - `admin.automations.ui` - Controla visibilidad de UI de Automatizaciones
  - `admin.automations.execution` - Controla visibilidad de botones de ejecución
  - `engine.automations.enabled` - Controla ejecución del Automation Engine
  - `phase.D7.execution` - Marca fase D.7 como activa

### 2. Migración PostgreSQL
**Archivo**: `database/migrations/v5.30.0-feature-flags.sql`

- Tabla `feature_flags` con campos:
  - `flag_key` (TEXT PRIMARY KEY)
  - `enabled` (BOOLEAN NOT NULL)
  - `updated_by` (JSONB NOT NULL)
  - `updated_at` (TIMESTAMP NOT NULL)

### 3. Servicio Canónico
**Archivo**: `src/core/feature-flags/feature-flag-service.js`

- `getAllFlags()` - Obtiene todos los flags con estado
- `isEnabled(flagKey)` - Verifica si un flag está habilitado
- `setFlag(flagKey, enabled, actor)` - Establece estado de un flag
- `resetFlag(flagKey, actor)` - Resetea flag a default del registry

### 4. Endpoints Admin API
**Archivo**: `src/endpoints/admin-feature-flags-api.js`

- `GET /admin/api/feature-flags` - Lista todos los flags
- `POST /admin/api/feature-flags/:key/enable` - Habilita un flag
- `POST /admin/api/feature-flags/:key/disable` - Deshabilita un flag
- `POST /admin/api/feature-flags/:key/reset` - Resetea un flag

### 5. Admin UI
**Archivo**: `src/endpoints/admin-feature-flags-ui.js`

- Ruta: `/admin/feature-flags`
- Tabla con todos los flags
- Toggle ON/OFF
- Reset a default
- Confirmación para flags irreversibles

### 6. Integración con Sidebar
- Entrada en sidebar: "⚙️ System / Configuración → Feature Flags"
- Visible solo si `admin.feature_flags.ui === true`
- Integrado con `admin-page-renderer.js` para resolver flags en runtime

### 7. Integración con Automatizaciones
- Sidebar de Automatizaciones visible solo si `admin.automations.ui === true`
- Botones de ejecución visibles solo si `admin.automations.execution === true`

### 8. Tests Constitucionales
**Archivo**: `tests/feature-flags/feature-flags-constitutional.test.js`

- Tests de registry canónico
- Tests de PostgreSQL como SOT
- Tests de validación de actor
- Tests de reset
- Tests de prohibiciones constitucionales

---

## Reglas Constitucionales

### ✅ Permitido
- Consultar flags desde cualquier parte del sistema
- Modificar flags desde Admin UI (si flag está habilitado)
- Resetear flags reversibles a default
- Usar flags para controlar visibilidad de UI
- Usar flags para controlar ejecución de lógica

### ❌ Prohibido
- Crear flags desde UI (solo desde registry)
- Ejecutar lógica desde flags (solo retornan booleanos)
- Llamar servicios de negocio desde flags
- Resetear flags irreversibles
- Modificar flags sin actor válido

---

## Arquitectura

```
┌─────────────────────────────────────┐
│   Feature Flag Registry (Código)    │
│   - Definiciones de flags           │
│   - Defaults                        │
│   - Metadata                        │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   PostgreSQL (Source of Truth)     │
│   - Estado actual (enabled/disabled)│
│   - Auditoría (updated_by, updated_at)│
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   Feature Flag Service (Canónico)   │
│   - isEnabled()                     │
│   - setFlag()                       │
│   - resetFlag()                     │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   Admin UI / Runtime Code           │
│   - Consulta flags                  │
│   - Controla visibilidad/ejecución  │
└─────────────────────────────────────┘
```

---

## Próximos Pasos

1. Migrar flags existentes del sistema antiguo (`src/core/flags/feature-flags.js`) al nuevo sistema
2. Integrar `engine.automations.enabled` con Automation Engine v2
3. Añadir más flags según necesidades del sistema
4. Implementar auditoría detallada de cambios de flags

---

## Referencias

- **Contrato**: `docs/FEATURE_FLAGS_CONSTITUTIONAL_FREEZE.md`
- **Registry**: `src/core/feature-flags/feature-flag-registry.js`
- **Servicio**: `src/core/feature-flags/feature-flag-service.js`
- **Tests**: `tests/feature-flags/feature-flags-constitutional.test.js`





