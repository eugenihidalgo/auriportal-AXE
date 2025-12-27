# Runtime Action Registry - FASE 2

**Version:** FASE 2 - Action Registry  
**Date:** Diciembre 2025  
**Status:** ✅ Implementado

---

## ¿Qué es una Acción?

Una **acción** es una operación atómica en el sistema que:
- Tiene un identificador único (`action_key` ej: `contexts.create`)
- Define exactamente qué input necesita (`input_schema`)
- Especifica qué permisos requiere (`permissions`)
- Se ejecuta mediante un `handler` registrado

### Ejemplo: `contexts.create`

```javascript
registerAction({
  action_key: 'contexts.create',
  description: 'Crear un nuevo contexto',
  input_schema: {
    required: ['label', 'type', 'scope', 'kind'],
    optional: ['context_key', 'description', 'allowed_values', ...],
    allowed: [...todos los campos...],
    validations: {
      type: (value) => {...},
      scope: (value) => {...}
    }
  },
  permissions: ['admin'],
  handler: async (input, context) => {
    // Ejecutar lógica (usa servicios existentes)
    const result = await createContext(input);
    return { ok: true, data: result };
  }
});
```

---

## Por qué esto importa

### Antes (Sin Action Registry):

```
Frontend (UI)
  ↓ (llamada directa)
  POST /admin/api/contexts
  ↓
Endpoint (handler)
  ↓ (lógica directa)
  - Validar permisos (¿dónde?)
  - Validar input (¿dónde?)
  - Llamar servicio
  ↓
Respuesta (¿incompleta?)
  ↓
UI (asume defaults)
  💥 BUGS
```

**Problemas:**
- ❌ No hay contrato claro de qué hace cada endpoint
- ❌ Validación dispersa en múltiples lugares
- ❌ Permisos no están centralizados
- ❌ Imposible saber qué acciones existen sin leer todo el código

### Ahora (Con Action Registry + Engine):

```
Frontend (UI)
  ↓ (llamada a executeAction)
  executeAction('contexts.create', input, context)
  ↓
Action Engine
  ├─ 1) Resolver acción del registry
  ├─ 2) Validar permisos del usuario
  ├─ 3) Validar input contra schema
  ├─ 4) Ejecutar handler
  └─ 5) Devolver resultado tipado
  ↓
Resultado estructurado
  { ok, data, warnings, error }
  ↓
UI (siempre sabe qué esperar)
  ✅ SEGURO
```

**Beneficios:**
- ✅ Una fuente de verdad para cada acción
- ✅ Validación SIEMPRE consistente
- ✅ Permisos centralizados
- ✅ Fácil extender a nuevas acciones
- ✅ Debugging simple: logs en un solo lugar

---

## Componentes

### 1. Action Registry (`action-registry.js`)

**Almacén centralizado** de acciones registradas.

**Funciones principales:**

```javascript
// Registrar una acción
registerAction({
  action_key: 'contexts.create',
  description: '...',
  input_schema: { required, optional, allowed, validations },
  permissions: ['admin'],
  handler: async (input, ctx) => { ... }
});

// Obtener una acción
const action = getAction('contexts.create');

// Listar todas las acciones
const allActions = listActions();

// Validar input contra schema
const validation = validateActionInput('contexts.create', input);

// Validar permisos
const perm = validateActionPermissions('contexts.create', context);
```

### 2. Action Engine (`action-engine.js`)

**Ejecutor** que valida y ejecuta acciones.

```javascript
// Ejecutar una acción con validaciones completas
const result = await executeAction(
  'contexts.create',           // action_key
  { label: 'Mi contexto', ... }, // input
  { user: { role: 'admin' } }  // context
);

// Resultado SIEMPRE tiene esta estructura:
{
  ok: true/false,
  data: {...} o null,
  warnings: [],
  error: 'mensaje si falló'
}
```

### 3. Context Actions (`context.actions.js`)

**Acciones específicas** para la gestión de contextos.

Acciones registradas:
- `contexts.create` - Crear un nuevo contexto
- `contexts.update` - Actualizar un contexto existente
- `contexts.archive` - Archivar un contexto
- `contexts.delete` - Eliminar un contexto
- `contexts.restore` - Restaurar un contexto archivado

**Cada acción:**
- Usa servicios existentes (NO duplica lógica)
- Define su `input_schema` explícitamente
- NO accede a `req`/`res` directamente
- Devuelve `{ ok, data, warnings, error }`

---

## Flujo de Ejecución

### Paso a Paso: `executeAction('contexts.create', input, context)`

```
1. VALIDAR PARÁMETROS BÁSICOS
   ↓ Si action_key no es string → Error

2. RESOLVER ACCIÓN
   ↓ getAction('contexts.create')
   ↓ Si no existe → Error

3. VALIDAR PERMISOS
   ↓ ¿user.role === 'admin'?
   ↓ ¿user.permissions incluye 'admin'?
   ↓ Si no → Error: "Permisos insuficientes"

4. VALIDAR INPUT
   ↓ validateActionInput('contexts.create', input)
   ├─ ¿Campos requeridos presentes?
   ├─ ¿Campos extra (no permitidos)?
   └─ ¿Validaciones específicas pasan?
   ↓ Si falla → Error con lista de campos faltantes

5. EJECUTAR HANDLER
   ↓ await action.handler(input, context)
   ↓ Handler usa servicios existentes
   ↓ Handler devuelve { ok, data, warnings, error }

6. DEVOLVER RESULTADO
   ↓ Asegurar estructura tipada
   { ok, data, warnings, error }
```

---

## Integración en Endpoints

### Antes:

```javascript
async function handleCreateContext(request, env) {
  const body = await request.json();
  
  // Validación directa
  if (!body.label) { /* error */ }
  if (!isValidContextKey(body.context_key)) { /* error */ }
  
  // Lógica directa
  const context = await createContext(body);
  
  // Respuesta
  return Response.json({ ok: true, context });
}
```

### Ahora:

```javascript
async function handleCreateContext(request, env, authCtx) {
  try {
    const body = await request.json();
    const normalized = normalizePayload(body);
    
    // ÚNICA línea nueva: usar Action Engine
    const actionResult = await executeAction(
      'contexts.create',
      normalized,
      { user: { role: 'admin', permissions: ['admin'] } }
    );

    if (!actionResult.ok) {
      return Response.json({ ok: false, error: actionResult.error }, { status: 500 });
    }

    return Response.json({ ok: true, context: actionResult.data }, { status: 201 });
  } catch (error) {
    // ...
  }
}
```

**Ventaja:** El endpoint ahora es un simple "wrapper" que:
- Normaliza request
- Llama a `executeAction()`
- Devuelve resultado

Todo lo demás (validación, permisos, lógica) está en el Action Registry.

---

## Cómo Extender con Nuevas Acciones

### Para agregar una acción de Packages:

**1. Crear archivo `src/core/actions/package.actions.js`:**

```javascript
import { registerAction } from './action-registry.js';
import { createPackage, updatePackage, ... } from '../services/...';

registerAction({
  action_key: 'packages.create',
  description: 'Crear un nuevo paquete',
  input_schema: {
    required: ['name', 'duration_days', ...],
    optional: ['description', ...],
    allowed: [...]
  },
  permissions: ['admin'],
  handler: async (input, context) => {
    try {
      const pkg = await createPackage(input);
      return { ok: true, data: pkg };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }
});
```

**2. Importar en el endpoint:**

```javascript
import '../core/actions/package.actions.js'; // ← Asegura registro
import { executeAction } from '../core/actions/action-engine.js';
```

**3. Usar en handler:**

```javascript
async function handleCreatePackage(request, env) {
  const actionResult = await executeAction('packages.create', input, context);
  // ... responder como antes
}
```

---

## Pre-flight Checks (Usar antes de mostrar botones)

```javascript
// En frontend: verificar si una acción puede ejecutarse SIN ejecutarla
import { canExecuteAction, getActionInfo } from '../core/actions/action-engine.js';

// ¿Puede el usuario ejecutar esta acción?
const { can_execute, reason } = canExecuteAction('contexts.delete', userContext);
if (!can_execute) {
  deleteButton.disabled = true;
  deleteButton.title = reason; // "Permisos insuficientes"
}

// Obtener info de una acción (para UI, help, etc)
const action = getActionInfo('contexts.create');
console.log(action.description); // "Crear un nuevo contexto"
console.log(action.input_schema); // { required, optional, allowed, ... }
```

---

## Logs y Debugging

### Logs automáticos:

```javascript
[ACTION_ENGINE] Ejecutando: contexts.create
[ACTION_ENGINE] Input validado ✅
[ACTION_ENGINE] Permisos validados ✅
[ACTION_ENGINE] Ejecutando handler...
[ACTION_ENGINE] ✅ contexts.create completada exitosamente
```

### Logs con diagnóstico:

```javascript
import { executeActionWithDiagnostics } from './action-engine.js';

const result = await executeActionWithDiagnostics('contexts.create', input, context);
// Más verbose: muestra input, output, tiempo, etc
```

### Si falla:

```javascript
[ACTION_ENGINE] Acción no registrada: contextos.creatr
[ACTION_ENGINE] Permisos insuficientes para contexts.delete: Requiere admin o otro
[ACTION_ENGINE] Input inválido para contexts.create: 
  Campos requeridos faltando: label, type
  Campos no permitidos: foo, bar
[ACTION_ENGINE] Error ejecutando contexts.create: Database error
```

---

## Relación con FASE 1 (Projection Contracts)

| Fase | Qué | Cómo |
|------|-----|------|
| **FASE 1** | Proyecciones consistentes | Validar que LIST ≠ EDIT ≠ RUNTIME |
| **FASE 2** | Acciones registradas | Registrar y ejecutar mediante engine |
| **FASE 3** | Coherencia global | Validar consistencia entre acciones |
| **FASE 4** | Event Bus | Comunicación entre sistemas |
| **FASE 5** | Screen Contracts | UI sabe qué datos mostrar |

**Cómo trabajan juntas:**

```
FASE 1 (Proyecciones):
  Asegura que los datos que fluyen tienen estructura correcta
  ✅ type, scope, kind siempre presentes en EDIT

FASE 2 (Acciones):
  Asegura que QUIÉN hace QUÉ está registrado
  ✅ Acción 'contexts.update' valida input contra schema
  ✅ Permisos verificados antes de ejecutar

JUNTAS:
  ✅ Datos correctos (FASE 1)
  ✅ Acciones explícitas (FASE 2)
  ✅ Imposible ejecutar con datos incompletos
```

---

## Estado Actual

### Implementado:

✅ Action Registry base  
✅ Action Engine (validación y ejecución)  
✅ 5 acciones para Contexts (create, update, archive, delete, restore)  
✅ Integración en endpoints (wrap pattern)  
✅ Frontend preparado con comentarios TODO  
✅ Documentación completa  

### Próximos pasos (FASE 3):

🔄 Frontend llamará directamente a `executeAction()` (no fetch)  
🔄 Coherence Engine (validar consistencia entre acciones)  
🔄 Action rollback (deshacer si algo falla)  
🔄 Más acciones para packages, signals, etc  

---

## Ejemplo Completo: Crear un Contexto

### Usuario hace clic "Guardar Contexto"

**Frontend (contexts-manager.html):**
```javascript
async function guardarContexto() {
  const input = {
    label: 'Mi contexto',
    type: 'enum',
    scope: 'package',
    kind: 'normal',
    allowed_values: ['a', 'b', 'c']
  };

  // FASE 2: Llamada a endpoint que usa executeAction
  const response = await fetch('/admin/api/contexts', {
    method: 'POST',
    body: JSON.stringify(input)
  });

  // En FASE 3: Será executeAction('contexts.create', input, context)
}
```

**Backend (admin-contexts-api.js):**
```javascript
async function handleCreateContext(request, env) {
  const body = await request.json();
  const normalized = normalizePayload(body);
  
  // FASE 2 RUNTIME: Usar Action Registry
  const actionResult = await executeAction(
    'contexts.create',
    normalized,
    { user: { role: 'admin', permissions: ['admin'] } }
  );

  if (!actionResult.ok) {
    return Response.json({ ok: false, error: actionResult.error }, { status: 500 });
  }

  return Response.json({ ok: true, context: actionResult.data }, { status: 201 });
}
```

**Action Engine hace:**

```
1. Resolver 'contexts.create' → encontrada ✅
2. Validar permisos → user.role=admin ✅
3. Validar input:
   - label presente? ✅
   - type='enum' válido? ✅
   - allowed_values es Array? ✅
4. Ejecutar handler:
   → createContext(input)  [servicio existente]
   → { ok: true, data: context }
5. Devolver resultado tipado
```

**UI recibe:**
```javascript
{
  ok: true,
  context: { context_key, label, type, allowed_values, ... },
  warnings: []
}
```

✅ **Contexto creado correctamente**

---

## Conclusión

La FASE 2 (Action Registry) transforma cómo el sistema ejecuta operaciones:

- **Antes:** Endpoints hacían TODO (validación, lógica, respuesta)
- **Ahora:** Acciones registradas, validadas por engine, endpoints como wrapper

Esto prepara la FASE 3 (Coherence Engine) donde validaremos consistencia entre acciones y servicios.

**Status:** ✅ COMPLETADO, LISTO PARA FASE 3
