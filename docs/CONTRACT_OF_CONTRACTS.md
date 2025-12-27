# Contract-of-Contracts - Documentación

## ¿Qué es el Contract-of-Contracts?

El **Contract-of-Contracts** es el registro canónico que indexa, clasifica y valida **TODOS** los contratos existentes en el sistema AuriPortal. Es la base constitucional del sistema y la base del futuro **Coherence Engine**.

### Principio Fundamental

> **Este registry es puramente DECLARATIVO.**
> - NO contiene lógica de negocio
> - NO modifica features existentes
> - SOLO indexa, clasifica y valida contratos

## Objetivo

El Contract-of-Contracts responde a las preguntas:
- **¿Qué contratos existen?**
- **¿Dónde viven?**
- **¿Qué garantizan?**
- **¿Cómo se relacionan entre sí?**

## Tipos de Contratos

### 1. Domain Contracts
Contratos de dominio que definen entidades de negocio y sus operaciones.

**Ejemplos**:
- `action.registry`: Registro centralizado de acciones del sistema
- `action.engine`: Motor de ejecución de acciones

### 2. Projection Contracts
Contratos de proyección que definen diferentes vistas de los mismos datos.

**Ejemplos**:
- `projection.context.list`: Proyección LIST para contextos
- `projection.context.edit`: Proyección EDIT para contextos
- `projection.context.runtime`: Proyección RUNTIME para contextos

### 3. Runtime Contracts
Contratos de runtime que garantizan comportamiento en tiempo de ejecución.

**Ejemplos**:
- `runtime.guard`: Garantiza respuestas JSON válidas

### 4. UI Contracts
Contratos de UI que definen estructuras de interfaz.

**Ejemplos**:
- `ui.theme.contract`: Contrato de variables CSS
- `ui.screen.template.contract`: Contrato de templates de pantalla

### 5. Entity Creation Contracts
Contratos que definen cómo se crean las "entidades vivas" que introducen hechos en el sistema.

**Ejemplos**:
- `entity.creation.canonical`: Contrato canónico de creación de entidades vivas (Alumno, Práctica)

**Documentación**: `CONTRATO_CANONICO_CREACION_ENTIDADES_VIVAS.md`

**Verificación**: Ejecutar `npm run verify:contract:entities`

### 6. Entity Mutation Contracts
Contratos que definen cómo se mutan las "entidades vivas" que modifican el estado del sistema.

**Ejemplos**:
- `entity.mutation.canonical`: Contrato canónico de mutación de entidades vivas (Alumno)

**Documentación**: `CONTRATO_CANONICO_MUTACION_ENTIDADES_VIVAS.md`

**Verificación**: Ejecutar `npm run verify:contract:mutations`

### 7. Entity Signals Contracts
Contratos que definen cómo se preparan y emiten las "señales" que describen hechos ocurridos.

**Ejemplos**:
- `entity.signals.canonical`: Contrato canónico de señales del sistema

**Documentación**: `CONTRATO_CANONICO_SENALES.md`

**Verificación**: Ejecutar `npm run verify:contract:signals`

### 8. Automation Contracts
Contratos que definen cómo funcionan las "automatizaciones" que consumen señales emitidas y ejecutan acciones registradas.

**Ejemplos**:
- `automation.canonical`: Contrato canónico de automatizaciones del sistema
- `automation.admin.ui.read-only`: Contrato de UI de solo lectura para automatizaciones (Fase 6)
- `automation.admin.ui.write-execution`: Contrato de UI de escritura y ejecución manual (Fase 7)

**Documentación**: 
- `CONTRATO_CANONICO_AUTOMATIZACIONES.md`
- `ADMIN_AUTOMATIONS_READ_ONLY_CONTRACT.md`
- `ADMIN_AUTOMATIONS_WRITE_EXECUTION_CONTRACT.md`
- `FASE_D_FASE6_ADMIN_UI_SCOPE.md`
- `FASE_D_FASE7_RISK_AUDIT.md`
- `AUTOMATIONS_VERSION.md` (v1.0.0-canonic)
- `AUTOMATIONS_CONSTITUTIONAL_FREEZE.md` (Freeze constitucional)
- `AUTOMATIONS_EVOLUTION_GUIDE.md` (Guía de evolución)
- `RESUMEN_FASE_D_RELEASE.md` (Release oficial)

**Verificación**: Ejecutar `npm run verify:contract:automations`

### 9. Feature Flags Contracts
Contratos que definen cómo funcionan los "feature flags" que controlan la visibilidad y ejecución de funcionalidades del sistema.

**Ejemplos**:
- `feature.flags.canonical`: Contrato canónico de feature flags del sistema

**Documentación**: 
- `FEATURE_FLAGS_VERSION.md` (v1.0.0)
- `FEATURE_FLAGS_CONSTITUTIONAL_FREEZE.md` (Freeze constitucional)

**Verificación**: Ejecutar `npm run verify:contract:feature-flags`

### 10. Feature Completion Protocol
Protocolo canónico que define qué significa "completado" en AuriPortal. Establece que una feature no visible se considera INEXISTENTE.

**Ejemplos**:
- `feature.completion.protocol`: Protocolo canónico de finalización de features

**Documentación**: 
- `FEATURE_COMPLETION_PROTOCOL.md` (v1.0.0-canonic)

**Principios**:
- Visible = Implementado
- No visible = No implementado
- ENSAMBLAJE es fase obligatoria
- Verificación práctica es requerida

**Referencia**: `.cursor/rules/contratos.mdc` - Regla `done-means-visible`

### 5. Integration Contracts
Contratos de integración con APIs externas.

**Ejemplos**:
- `integration.kajabi.api`: Contrato de Kajabi API
- `integration.clickup.api`: Contrato de ClickUp API
- `integration.typeform.api`: Contrato de Typeform API

### 6. Route Contracts
Contratos de rutas y endpoints.

**Ejemplos**:
- `route.admin.registry`: Registro de rutas del admin

## Estructura de un Contrato

```javascript
{
  id: 'projection.context.list',           // Identificador único
  name: 'Context Projection - LIST',       // Nombre legible
  type: 'projection',                       // Tipo de contrato
  version: 'v1',                           // Versión
  location: 'src/core/contracts/...',       // Ubicación del archivo
  description: 'Descripción del contrato', // Descripción
  dependencies: ['other.contract.id'],     // Dependencias (opcional)
  status: 'active',                        // Estado: active | degraded | broken
  metadata: {                              // Metadata adicional (opcional)
    // Información específica del contrato
  }
}
```

## Estados de Contratos

### `active`
Contrato activo y funcionando correctamente.

### `degraded`
Contrato activo pero con problemas menores que no impiden su funcionamiento.

### `broken`
Contrato roto o no funcional. Requiere atención inmediata.

## Uso del Contract Registry

### Obtener Todos los Contratos

```javascript
import { getAllContracts } from './src/core/contracts/contract-registry.js';

const contracts = getAllContracts();
console.log(`Total de contratos: ${contracts.length}`);
```

### Obtener Contratos por Tipo

```javascript
import { getContractsByType } from './src/core/contracts/contract-registry.js';

const projectionContracts = getContractsByType('projection');
const runtimeContracts = getContractsByType('runtime');
```

### Obtener un Contrato Específico

```javascript
import { getContractById } from './src/core/contracts/contract-registry.js';

const contract = getContractById('projection.context.list');
console.log(contract.description);
```

### Obtener Dependencias

```javascript
import { getDependencies, getDependents } from './src/core/contracts/contract-registry.js';

// Contratos de los que depende
const deps = getDependencies('projection.context.edit');

// Contratos que dependen de este
const dependents = getDependents('projection.context.list');
```

### Validar el Registry

```javascript
import { validateRegistry } from './src/core/contracts/contract-registry.js';

const validation = validateRegistry();
if (!validation.valid) {
  console.error('Errores:', validation.errors);
}
if (validation.warnings.length > 0) {
  console.warn('Advertencias:', validation.warnings);
}
```

### Obtener Estadísticas

```javascript
import { getRegistryStats } from './src/core/contracts/contract-registry.js';

const stats = getRegistryStats();
console.log(`Total: ${stats.total}`);
console.log(`Por tipo:`, stats.by_type);
console.log(`Por estado:`, stats.by_status);
```

## Validaciones Realizadas

El Contract Registry valida:

1. **Contratos Duplicados**: No puede haber dos contratos con el mismo ID
2. **Dependencias No Resueltas**: Todas las dependencias deben existir
3. **Tipos Válidos**: Solo tipos permitidos (domain, projection, runtime, ui, integration, route)
4. **Estados Válidos**: Solo estados permitidos (active, degraded, broken)
5. **Campos Requeridos**: Todos los campos requeridos deben estar presentes

## Contratos Actuales

### Projection Contracts (3)
- `projection.context.list`
- `projection.context.edit`
- `projection.context.runtime`

### Action Contracts (2)
- `action.registry`
- `action.engine`

### Runtime Contracts (1)
- `runtime.guard`

### Route Contracts (1)
- `route.admin.registry`

### UI Contracts (2)
- `ui.theme.contract`
- `ui.screen.template.contract`

### Integration Contracts (3)
- `integration.kajabi.api`
- `integration.clickup.api`
- `integration.typeform.api`

### Feature Flags Contracts (1)
- `feature.flags.canonical`

### Feature Completion Protocol (1)
- `feature.completion.protocol`

**Total**: 14 contratos indexados

## Extensión del Registry

Para añadir un nuevo contrato:

1. **Añadir entrada al registry**:
   ```javascript
   {
     id: 'nuevo.contrato.id',
     name: 'Nombre del Contrato',
     type: 'domain', // o projection, runtime, ui, integration, route
     version: 'v1',
     location: 'src/path/to/contract.js',
     description: 'Descripción del contrato',
     dependencies: [], // IDs de contratos de los que depende
     status: 'active',
     metadata: {
       // Metadata específica
     }
   }
   ```

2. **Validar el registry**:
   ```javascript
   const validation = validateRegistry();
   if (!validation.valid) {
     throw new Error(`Registry inválido: ${validation.errors.join(', ')}`);
   }
   ```

## Futuro: Coherence Engine

El Contract-of-Contracts es la base para el futuro **Coherence Engine**, que:

1. **Validará coherencia entre contratos**: Verificará que los contratos no se contradicen
2. **Detectará inconsistencias**: Encontrará discrepancias entre contratos relacionados
3. **Sugerirá mejoras**: Propondrá optimizaciones basadas en el análisis de contratos
4. **Generará documentación**: Creará documentación automática de contratos

## Reglas de Oro

1. **NO modificar features existentes**: El registry solo indexa, no cambia comportamiento
2. **NO añadir lógica de negocio**: El registry es puramente declarativo
3. **Mantener actualizado**: Cuando se crea un nuevo contrato, añadirlo al registry
4. **Validar siempre**: Ejecutar `validateRegistry()` antes de commit

## Archivos Relacionados

- `src/core/contracts/contract-registry.js`: Registry principal
- `src/core/contracts/projections/context.projection.contract.js`: Projection contracts
- `src/core/actions/action-registry.js`: Action registry
- `src/core/runtime-guard.js`: Runtime guard
- `src/core/admin/admin-route-registry.js`: Route registry
- `src/core/theme/theme-contract.js`: Theme contract
- `src/core/screen-template/screen-template-definition-contract.js`: Screen template contract

---

**Versión**: 1.0.0  
**Fecha**: 2025-01-20  
**Autor**: Sistema AuriPortal

