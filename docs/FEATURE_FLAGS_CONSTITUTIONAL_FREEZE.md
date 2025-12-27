# Feature Flags System - Constitutional Freeze v1.0.0

**Fecha de Freeze**: 2025-01-XX  
**Versión**: 1.0.0-canonic  
**Estado**: ✅ CONGELADO

---

## ⚠️ FREEZE CONSTITUCIONAL

Este documento declara el **FREEZE CONSTITUCIONAL** del Sistema de Feature Flags v1.0.0-canonic.

**REGLA ABSOLUTA**: Ningún cambio que afecte a la arquitectura, contratos o prohibiciones de este sistema puede realizarse sin:
1. Actualizar este documento
2. Incrementar la versión
3. Certificar tests constitucionales
4. Actualizar `CONTRACT_OF_CONTRACTS.md`

---

## Arquitectura Congelada

### Componentes Core (NO MODIFICAR SIN FREEZE)

1. **Registry Canónico** (`src/core/feature-flags/feature-flag-registry.js`)
   - Estructura de definiciones: `{ key, description, type, scope, default, irreversible }`
   - Funciones: `getFlagDefinition()`, `flagExists()`, `getAllFlagDefinitions()`
   - **PROHIBIDO**: Modificar estructura sin freeze

2. **Servicio Canónico** (`src/core/feature-flags/feature-flag-service.js`)
   - Funciones: `getAllFlags()`, `isEnabled()`, `setFlag()`, `resetFlag()`
   - Validaciones: flag existe en registry, actor válido, irreversibilidad
   - **PROHIBIDO**: Bypass de validaciones, ejecución de lógica

3. **Repositorio PostgreSQL** (`src/infra/repos/feature-flags-repo-pg.js`)
   - Operaciones: `getFlagState()`, `getAllFlagStates()`, `setFlagState()`, `deleteFlagState()`
   - **PROHIBIDO**: Lógica de negocio en repositorio

4. **Migración PostgreSQL** (`database/migrations/v5.30.0-feature-flags.sql`)
   - Tabla `feature_flags` con estructura fija
   - **PROHIBIDO**: Modificar estructura sin migración nueva

---

## Contratos Congelados

### Contrato de Retorno

**`isEnabled(flagKey)`**:
- Retorna: `Promise<boolean>`
- Si flag no existe en BD → retorna `default` del registry
- Si flag existe en BD → retorna `enabled` de BD
- **PROHIBIDO**: Retornar valores no booleanos

**`setFlag(flagKey, enabled, actor)`**:
- Retorna: `Promise<{ flag_key, enabled, updated_by, updated_at }>`
- Valida: flag existe en registry, actor válido
- **PROHIBIDO**: Establecer flags inexistentes, sin actor

**`resetFlag(flagKey, actor)`**:
- Retorna: `Promise<{ flag_key, enabled, reset, message }>`
- Valida: flag existe, no es irreversible
- **PROHIBIDO**: Resetear flags irreversibles

### Contrato de Actor

**Actor válido**:
```javascript
{ type: 'admin' | 'system', id: string }
```

**PROHIBIDO**:
- `type` diferente de 'admin' o 'system'
- `id` vacío o undefined
- Actor `null` o `undefined`

---

## Prohibiciones Absolutas (Congeladas)

### ❌ PROHIBIDO ABSOLUTAMENTE

1. **Crear flags desde UI**
   - Los flags SOLO se crean en el registry canónico
   - `setFlag()` valida existencia en registry
   - **NO HAY EXCEPCIONES**

2. **Ejecutar lógica desde flags**
   - Los flags SOLO retornan booleanos
   - NO ejecutan código
   - NO llaman servicios
   - **NO HAY EXCEPCIONES**

3. **Bypass del servicio canónico**
   - TODAS las operaciones pasan por `feature-flag-service.js`
   - NO escribir directo en repositorio desde endpoints
   - NO consultar BD directo desde UI
   - **NO HAY EXCEPCIONES**

4. **Modificar estructura de BD sin migración**
   - TODOS los cambios requieren migración nueva
   - NO modificar `v5.30.0-feature-flags.sql`
   - **NO HAY EXCEPCIONES**

5. **Resetear flags irreversibles**
   - `resetFlag()` valida `irreversible === false`
   - **NO HAY EXCEPCIONES**

---

## Tests Constitucionales (Congelados)

**Archivo**: `tests/feature-flags/feature-flags-constitutional.test.js`

**Tests obligatorios** (NO eliminar):
1. ✅ Registry canónico: verificar existencia antes de usar
2. ✅ PostgreSQL como SOT: retornar default si no existe en BD
3. ✅ Validación de actor: rechazar actor inválido
4. ✅ Reset: resetear flag reversible, rechazar irreversible
5. ✅ Prohibiciones: NO crear desde UI, NO ejecutar lógica

**PROHIBIDO**: Eliminar o debilitar estos tests sin freeze nuevo.

---

## Integraciones Congeladas

### Sidebar
- Entrada: "⚙️ System / Configuración → Feature Flags"
- Visibilidad: controlada por `admin.feature_flags.ui`
- **PROHIBIDO**: Modificar lógica de visibilidad sin freeze

### Automatizaciones
- Sidebar: controlado por `admin.automations.ui`
- Ejecución: controlada por `admin.automations.execution`
- **PROHIBIDO**: Modificar integración sin freeze

---

## Versionado

**Versión actual**: `1.0.0-canonic`

**Formato**: `MAJOR.MINOR.PATCH-suffix`

- `MAJOR`: Cambio arquitectónico incompatible
- `MINOR`: Nueva funcionalidad compatible
- `PATCH`: Corrección de bugs
- `suffix`: `canonic` = versión congelada

**Para cambiar versión**:
1. Actualizar este documento
2. Actualizar `FEATURE_FLAGS_VERSION.md`
3. Actualizar `CONTRACT_OF_CONTRACTS.md`
4. Certificar tests

---

## Referencias

- **Versión**: `docs/FEATURE_FLAGS_VERSION.md`
- **Contrato de Contratos**: `docs/CONTRACT_OF_CONTRACTS.md`
- **Registry**: `src/core/feature-flags/feature-flag-registry.js`
- **Servicio**: `src/core/feature-flags/feature-flag-service.js`
- **Tests**: `tests/feature-flags/feature-flags-constitutional.test.js`

---

**FIN DEL FREEZE CONSTITUCIONAL**




