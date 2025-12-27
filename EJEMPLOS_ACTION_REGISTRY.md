# Action Registry: Guía de Uso y Ejemplos

---

## 1. Obtener Lista de Acciones

```javascript
import { listActions } from './src/core/actions/action-registry.js';

const actions = listActions();
console.log(`Total acciones: ${actions.length}`);

actions.forEach(action => {
  console.log(`- ${action.action_key}`);
});
```

**Salida:**
```
Total acciones: 5
- contexts.create
- contexts.update
- contexts.archive
- contexts.delete
- contexts.restore
```

---

## 2. Obtener Detalles de una Acción

```javascript
import { getAction } from './src/core/actions/action-registry.js';

const action = getAction('contexts.create');

console.log(`Action: ${action.action_key}`);
console.log(`Description: ${action.description}`);
console.log(`Required fields: ${action.input_schema.required.join(', ')}`);
console.log(`Permissions: ${action.permissions.join(', ')}`);
```

**Salida:**
```
Action: contexts.create
Description: Crea un nuevo contexto del sistema
Required fields: label, type, scope, kind
Permissions: admin
```

---

## 3. Ejecutar una Acción (Caso Exitoso)

```javascript
import { executeAction } from './src/core/actions/action-engine.js';

const context = {
  user: { id: 'user_123', role: 'admin' },
  tenant_id: 'tenant_001'
};

const result = await executeAction('contexts.create', {
  label: 'Mi Contexto',
  type: 'string',
  scope: 'package',
  kind: 'mutable'
}, context);

if (result.ok) {
  console.log('✓ Contexto creado:', result.data.context_key);
  console.log('  Data:', result.data);
} else {
  console.log('✗ Error:', result.error);
}
```

**Salida (éxito):**
```
✓ Contexto creado: ctx_new_string_001
  Data: {
    context_key: 'ctx_new_string_001',
    label: 'Mi Contexto',
    type: 'string',
    scope: 'package',
    kind: 'mutable',
    created_at: '2025-01-01T12:00:00Z',
    created_by: 'user_123'
  }
```

---

## 4. Ejecutar una Acción (Validación Fallida)

```javascript
const result = await executeAction('contexts.create', {
  // Faltan campos requeridos
  label: 'Contexto sin tipo'
}, context);

if (!result.ok) {
  console.log('Error:', result.error);
  console.log('Missing fields:', result.missingFields);
}
```

**Salida:**
```
Error: Campos requeridos faltando: type, scope, kind
Missing fields: ['type', 'scope', 'kind']
```

---

## 5. Ejecutar con Diagnósticos

```javascript
import { executeActionWithDiagnostics } from './src/core/actions/action-engine.js';

const result = await executeActionWithDiagnostics('contexts.create', {
  label: 'Test',
  type: 'string',
  scope: 'package',
  kind: 'mutable'
}, context);

console.log(result);
```

**Salida (con timing):**
```
[ACTION_DIAGNOSTICS] Iniciando ejecución de: contexts.create
[ACTION_DIAGNOSTICS] Input: { label: 'Test', type: 'string', scope: 'package', kind: 'mutable' }
[ACTION_DIAGNOSTICS] Context user: { id: 'user_123', role: 'admin' }
[ACTION_ENGINE] Ejecutando: contexts.create
[ACTION_DIAGNOSTICS] Resultado: { ok: true, data: {...}, warnings: [], error: null }
[ACTION_DIAGNOSTICS] Tiempo: 45ms
```

---

## 6. Pre-flight Check (Verificar si Puede Ejecutar)

```javascript
import { canExecuteAction } from './src/core/actions/action-engine.js';

const { can_execute, reason } = canExecuteAction('contexts.create', context);

if (can_execute) {
  console.log('✓ Usuario puede crear contextos');
} else {
  console.log('✗ Usuario NO puede crear contextos:', reason);
}
```

**Salida (user es admin):**
```
✓ Usuario puede crear contextos
```

**Salida (user es guest):**
```
✗ Usuario NO puede crear contextos: Permiso requerido: admin (usuario tiene: guest)
```

---

## 7. Obtener Información de Acción (para UI)

```javascript
import { getActionInfo } from './src/core/actions/action-engine.js';

const info = getActionInfo('contexts.create');

console.log(`Action: ${info.action_key}`);
console.log(`Description: ${info.description}`);
console.log(`Permisos requeridos: ${info.permissions.join(', ')}`);
console.log(`Schema input:`, info.input_schema);
```

**Uso en UI:**
```javascript
// Mostrar input form basado en schema
const schema = getActionInfo('contexts.create').input_schema;
schema.required.forEach(field => {
  createRequiredInputField(field);
});
```

---

## 8. Validar Input Manual

```javascript
import { validateActionInput } from './src/core/actions/action-registry.js';

const isValid = validateActionInput('contexts.create', {
  label: 'Test',
  type: 'string',
  scope: 'package',
  kind: 'mutable'
});

console.log('Input válido?', isValid);
```

---

## 9. Validar Permisos Manual

```javascript
import { validateActionPermissions } from './src/core/actions/action-registry.js';

const context = {
  user: { id: '123', role: 'admin' },
  tenant_id: 'test'
};

const hasPermission = validateActionPermissions('contexts.create', context);
console.log('Tiene permiso?', hasPermission);
```

---

## 10. Registrar Nueva Acción (Extensibilidad)

```javascript
import { registerAction } from './src/core/actions/action-registry.js';

// En src/core/actions/my-custom.actions.js

registerAction({
  action_key: 'packages.publish',
  description: 'Publica un paquete para usuarios',
  
  input_schema: {
    required: ['package_key', 'version'],
    optional: ['changelog', 'notes'],
    allowed: ['package_key', 'version', 'changelog', 'notes'],
    validations: {
      package_key: (val) => typeof val === 'string' && val.startsWith('pkg_'),
      version: (val) => /^\d+\.\d+\.\d+$/.test(val)
    }
  },
  
  permissions: ['admin', 'maintainer'],
  
  handler: async (input, context) => {
    try {
      const result = await publishPackageService(input);
      return {
        ok: true,
        data: result,
        warnings: []
      };
    } catch (error) {
      return {
        ok: false,
        error: error.message
      };
    }
  }
});
```

Luego usarla:
```javascript
const result = await executeAction('packages.publish', {
  package_key: 'pkg_awesome_lib',
  version: '1.0.0',
  changelog: 'Initial release'
}, context);
```

---

## 11. Diagnóstico del Registry

```javascript
import { diagnoseRegistry } from './src/core/actions/action-registry.js';

const diagnosis = diagnoseRegistry();
console.log(diagnosis);
```

**Salida:**
```
=== ACTION REGISTRY DIAGNOSIS ===
Total acciones registradas: 5

1. contexts.create
   - Required: label, type, scope, kind
   - Optional: context_key, description, ...
   - Permissions: admin
   - Validations: 4 custom validators

2. contexts.update
   - Required: context_key
   - Optional: label, type, scope, ...
   - Permissions: admin
   - Validations: 3 custom validators

3. contexts.archive
   - Required: context_key
   - Optional: none
   - Permissions: admin
   - Validations: 1 custom validator

... (total 5 acciones)
```

---

## 12. Integración en Endpoints (Wrap Pattern)

**Antes (sin Action Registry):**
```javascript
async function handleCreateContext(req, res, context) {
  const { body } = req;
  
  // Validación manual
  if (!body.label) {
    return res.status(400).json({ error: 'label requerido' });
  }
  if (!body.type) {
    return res.status(400).json({ error: 'type requerido' });
  }
  
  // Logging manual
  console.log(`[CREATE_CONTEXT] label=${body.label}, user=${context.user.id}`);
  
  // Ejecución
  try {
    const result = await createContext(body);
    return res.json(result);
  } catch (error) {
    console.error(`[ERROR] No se pudo crear contexto: ${error.message}`);
    return res.status(500).json({ error: error.message });
  }
}
```

**Después (con Action Registry):**
```javascript
async function handleCreateContext(req, res, context) {
  const { body } = req;
  
  // Una línea: executeAction maneja toda la validación
  const result = await executeAction('contexts.create', body, context);
  
  // Manejar resultado tipado
  if (!result.ok) {
    return res.status(400).json({ error: result.error });
  }
  
  return res.json(result.data);
}
```

---

## 13. Estructura de Resultado Consistente

```javascript
// Todos los resultados tienen esta estructura:
{
  ok: boolean,                    // true si se ejecutó correctamente
  data: any,                      // Datos del resultado (null si error)
  warnings: string[],             // Avisos durante ejecución
  error: string | null,           // Mensaje de error (null si ok)
  
  // Adicionales para debug:
  missingFields?: string[],       // Si faltan campos requeridos
  extraFields?: string[],         // Si hay campos no permitidos
  timestamp?: string              // Cuándo se ejecutó
}
```

---

## 14. Manejo de Errores en Handler

```javascript
const handler = async (input, context) => {
  try {
    // Lógica de negocio
    const result = await myService.operation(input);
    
    return {
      ok: true,
      data: result,
      warnings: []
    };
  } catch (error) {
    // El error es atrapado automáticamente por Action Engine
    // Pero el handler DEBE devolver estructura correcta
    return {
      ok: false,
      error: error.message
    };
  }
};
```

---

## 15. Logging y Auditoría

```javascript
// El Action Engine registra automáticamente:
// 1. Qué acción se ejecutó
// 2. Quién la ejecutó (user_id)
// 3. Cuándo (timestamp)
// 4. Con qué input
// 5. Qué resultado (ok/error)

// Ejemplo de log:
[ACTION_ENGINE] 2025-01-01T12:30:45Z - admin@user - contexts.create
  Input: { label: "Test", type: "string", scope: "package", kind: "mutable" }
  Result: OK (context_key: ctx_123)
```

Para auditoría completa, se pueden agregar en FASE 3:
- Event bus que capture todas las acciones
- Tabla de auditoría en base de datos
- Webhook notifications

---

## Resumen: 3 Patrones Principales

### 1. Simple Execution
```javascript
const result = await executeAction('contexts.create', input, context);
if (result.ok) { /* usar result.data */ }
```

### 2. With Diagnostics
```javascript
const result = await executeActionWithDiagnostics('contexts.create', input, context);
// Mostrará logs de cada paso + timing
```

### 3. Pre-flight Check
```javascript
const { can_execute } = canExecuteAction('contexts.create', context);
if (can_execute) { /* mostrar botón */ }
```

---

**Próximas Fases:**
- FASE 3: Frontend llamará `executeAction()` directamente (no endpoints)
- FASE 4: Event bus para acciones
- FASE 5: Screen contracts para visibilidad de acciones
