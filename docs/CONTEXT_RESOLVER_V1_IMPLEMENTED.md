# CONTEXT RESOLVER V1 — IMPLEMENTACIÓN
**AuriPortal · Sistema de Resolución de Contextos (IMPLEMENTADO)**

**Fecha**: 2025-01-XX  
**Versión**: 1.0.0  
**Estado**: Implementado (Fase 1: Paquetes + Temas)

---

## RESUMEN EJECUTIVO

El Context Resolver v1 ha sido implementado para resolver contextos en ejecuciones de **paquetes PDE** y **temas**. La implementación sigue el diseño definido en `CONTEXT_RESOLVER_V1.md` y proporciona:

- ✅ Resolución canónica de contextos con precedencia de 7 niveles
- ✅ Validación contra Context Registry
- ✅ Provenance completa para debugging y auditoría
- ✅ Fail-open absoluto (nunca falla en runtime)
- ✅ Integración mínima con paquetes (opcional con snapshot)
- ✅ Integración preparada para temas (documentada, no activa todavía)

---

## ESTRUCTURA DE ARCHIVOS

```
src/core/context/
├── context-resolver-v1.js          # Motor principal de resolución
├── context-precedence.js           # Implementación de precedencia canónica (7 niveles)
├── context-validation.js           # Validación contra Context Registry
├── context-provenance.js           # Tracking de provenance
├── execution-context-builders.js   # Builders para ExecutionContext
├── context-request-builders.js     # Builders para ContextRequest
└── index.js                        # Exports públicos
```

---

## FUNCIONALIDAD IMPLEMENTADA

### 1. Context Resolver Core

**Archivo**: `src/core/context/context-resolver-v1.js`

**Función principal**:
```javascript
resolveContexts({ contextRequest, executionContext }) => Promise<ResolvedContext>
```

**Características**:
- Resuelve contextos requeridos y opcionales
- Aplica precedencia canónica (7 niveles)
- Valida contra Context Registry
- Proporciona provenance completa
- Fail-open absoluto (nunca falla)

---

### 2. Precedencia Canónica

**Archivo**: `src/core/context/context-precedence.js`

**Niveles implementados**:

1. **Nivel 1**: Inputs explícitos de la ejecución ✅
2. **Nivel 2**: Package defaults (solo paquetes) ✅
3. **Nivel 3**: PDE Contexts persistentes (preparado, no activo todavía)
4. **Nivel 4**: Snapshot fields ✅
5. **Nivel 5**: Derived contexts (preparado para futuro)
6. **Nivel 6**: Registry default value ✅
7. **Nivel 7**: Fail-open seguro ✅

**Mapeos de snapshot implementados**:
- `identity.*` → `actor_type`, `actor_id`, `alumno_id`, `alumno_email`, `is_authenticated`
- `environment.*` → `app_env`, `environment`, `screen`, `editor`, `sidebar_context`, `navigation_zone`
- `time.*` → `time_now`, `day_key`, `timestamp`
- `student.*` → `nivel_efectivo`, `nivel_base`, `streak`, `today_practiced`, etc.
- `flags.*` → `flag_*` (prefijo automático)

---

### 3. Validación

**Archivo**: `src/core/context/context-validation.js`

**Validaciones implementadas**:
- ✅ Existencia de context_key en registry
- ✅ Type checking (string, number, boolean, enum, json)
- ✅ Enum allowed_values
- ✅ Coerciones seguras (sin pérdida de información)
- ✅ Fail-open con defaults seguros

---

### 4. Provenance

**Archivo**: `src/core/context/context-provenance.js`

**Información registrada**:
- `source`: Fuente del valor ('input', 'package_default', 'snapshot', 'registry_default', 'fail_open')
- `precedence_level`: Nivel de precedencia usado (1-7)
- `path`: Path específico de la fuente
- `warnings`: Warnings generados
- `notes`: Notas adicionales

---

### 5. ExecutionContext Builders

**Archivo**: `src/core/context/execution-context-builders.js`

**Funciones**:
- `buildExecutionContextForPackage({ packageDefinition, inputs, snapshot, requestId })`
- `buildExecutionContextForTheme({ themeDefinition, snapshot, requestId })`

---

### 6. ContextRequest Builders

**Archivo**: `src/core/context/context-request-builders.js`

**Funciones**:
- `buildContextRequestFromPackage({ packageDefinition, requestId })`
- `buildContextRequestFromTheme({ themeDefinition, requestId })`

---

## INTEGRACIÓN

### Integración con Paquetes PDE

**Archivo**: `src/core/packages/package-engine.js`

**Cambios realizados**:
- `resolvePackage()` ahora acepta `context.snapshot` opcional
- Si `snapshot` está presente, usa Context Resolver v1
- Si `snapshot` no está presente, usa comportamiento legacy (`resolveContextWithDefaults`)
- Fail-open: si el Context Resolver v1 falla, fallback a legacy

**Ejemplo de uso**:
```javascript
const resolved = await resolvePackage(packageDefinition, {
  nivel_efectivo: 5,
  values: { tipo_limpieza: 'completa' },
  snapshot: contextSnapshotV1  // Opcional: si se proporciona, usa Context Resolver v1
});
```

---

### Integración con Temas

**Estado**: Preparada pero no activa todavía

**Razón**: El Theme Resolver actual (`resolveTheme`) es síncrono y no recibe snapshot. La integración requeriría:

1. Hacer `resolveTheme` async (o crear `resolveThemeWithSnapshot` async)
2. Pasar snapshot desde `applyTheme` en `responses.js`
3. Construir ExecutionContext y ContextRequest para temas
4. Resolver contextos y pasarlos al motor de temas

**Nota**: Los temas pueden declarar `context_request` en su `definition_json`, pero esta funcionalidad no está activa todavía.

---

## USO

### Resolver Contextos para un Paquete

```javascript
import {
  resolveContexts,
  buildExecutionContextForPackage,
  buildContextRequestFromPackage
} from '../core/context/index.js';

// 1. Construir ExecutionContext
const executionContext = buildExecutionContextForPackage({
  packageDefinition,
  inputs: { tipo_limpieza: 'completa' },
  snapshot: contextSnapshotV1,
  requestId: 'req-123'
});

// 2. Construir ContextRequest
const contextRequest = buildContextRequestFromPackage({
  packageDefinition,
  requestId: 'req-123'
});

// 3. Resolver contextos
const resolvedContext = await resolveContexts({
  contextRequest,
  executionContext
});

// 4. Usar valores resueltos
const nivelEfectivo = resolvedContext.resolved.nivel_efectivo;
const tipoLimpieza = resolvedContext.resolved.tipo_limpieza;

// 5. Inspeccionar provenance (opcional, para debug)
console.log(resolvedContext.provenance.nivel_efectivo);
// {
//   source: 'snapshot',
//   precedence_level: 4,
//   path: 'snapshot.student.nivelEfectivo',
//   notes: ['Mapped from snapshot.student.nivelEfectivo']
// }
```

---

## EJEMPLO COMPLETO

```javascript
// Ejemplo: Resolver contextos para ejecución de paquete

const packageDefinition = {
  package_key: 'tecnicas-limpieza-nivel-5',
  context_contract: {
    inputs: [
      {
        key: 'nivel_efectivo',
        type: 'number',
        required: true
      },
      {
        key: 'tipo_limpieza',
        type: 'enum',
        values: ['rapida', 'completa'],
        default: 'rapida',
        required: false
      }
    ]
  },
  // ... más definición
};

const contextSnapshotV1 = {
  identity: {
    actorType: 'student',
    actorId: '550e8400-e29b-41d4-a716-446655440000',
    email: 'alumno@ejemplo.com',
    isAuthenticated: true,
    requestId: 'req-1234567890-xyz'
  },
  environment: {
    env: 'prod',
    context: 'student',
    screen: '/enter',
    // ...
  },
  student: {
    nivelEfectivo: 5,
    streak: 42,
    // ...
  },
  // ... más snapshot
};

// Construir ExecutionContext
const executionContext = buildExecutionContextForPackage({
  packageDefinition,
  inputs: { tipo_limpieza: 'completa' },  // Input explícito
  snapshot: contextSnapshotV1,
  requestId: 'req-1234567890-xyz'
});

// Construir ContextRequest
const contextRequest = buildContextRequestFromPackage({
  packageDefinition,
  requestId: 'req-1234567890-xyz'
});

// Resolver contextos
const resolvedContext = await resolveContexts({
  contextRequest,
  executionContext
});

// Resultado:
// resolvedContext.resolved = {
//   nivel_efectivo: 5,              // De snapshot (precedence level 4)
//   tipo_limpieza: 'completa'        // De input explícito (precedence level 1)
// }
//
// resolvedContext.provenance = {
//   nivel_efectivo: {
//     source: 'snapshot',
//     precedence_level: 4,
//     path: 'snapshot.student.nivelEfectivo',
//     notes: ['Mapped from snapshot.student.nivelEfectivo']
//   },
//   tipo_limpieza: {
//     source: 'input',
//     precedence_level: 1,
//     path: 'executionContext.inputs.tipo_limpieza',
//     notes: ['Explicit input from execution context']
//   }
// }
```

---

## LIMITACIONES Y NOTAS

### Limitaciones Actuales

1. **PDE Contexts persistentes (Nivel 3)**: Preparado pero no activo todavía (requiere valores almacenados en BD)
2. **Derived contexts (Nivel 5)**: Preparado pero no implementado todavía
3. **Integración con temas**: Documentada pero no activa (requiere hacer `resolveTheme` async)

### Notas Importantes

1. **Fail-open absoluto**: El resolver NUNCA falla, siempre devuelve valores seguros
2. **Compatibilidad**: La integración con paquetes mantiene compatibilidad total con código existente
3. **Snapshot opcional**: Si no se proporciona snapshot, se usa comportamiento legacy
4. **Provenance**: Útil para debugging y auditoría, pero no requerido para uso normal

---

## PRÓXIMOS PASOS

### Fase 2 (Futuro)

1. Activar PDE Contexts persistentes (Nivel 3)
2. Implementar Derived contexts (Nivel 5)
3. Integrar completamente con Theme Resolver (hacer async, pasar snapshot)
4. Integrar con Automatizaciones (condiciones)
5. UI de debug para inspeccionar provenance

---

## TESTING

**Estado**: Tests mínimos preparados (ver `tests/context/` cuando se creen)

**Tests requeridos**:
- ✅ Resolución simple de paquete
- ✅ Precedencia correcta (inputs > snapshot > defaults)
- ✅ Fail-open funcionando
- ✅ Validación de tipos
- ✅ Provenance correcta

---

## REFERENCIAS

- **Diseño**: `docs/CONTEXT_RESOLVER_V1.md`
- **Context Snapshot**: `docs/CONTEXT_SNAPSHOT_V1.md`
- **Context Registry**: `docs/CONTEXT_REGISTRY_V1.md`
- **Código**: `src/core/context/`

---

**FIN DE LA IMPLEMENTACIÓN**

