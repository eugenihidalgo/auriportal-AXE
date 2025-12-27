# ⚡ Action Registry: Quick Reference

**Guía rápida para usar y extender el Action Registry de AuriPortal**

---

## 🚀 3 Patrones Principales

### 1️⃣ Ejecutar Acción Estándar
```javascript
import { executeAction } from './core/actions/action-engine.js';

const result = await executeAction('contexts.create', {
  label: 'Mi Contexto',
  type: 'string',
  scope: 'package',
  kind: 'mutable'
}, { user: { id: '123', role: 'admin' }, tenant_id: 'test' });

if (result.ok) {
  console.log('✓', result.data);
} else {
  console.log('✗', result.error);
}
```

### 2️⃣ Ejecutar Con Diagnósticos
```javascript
import { executeActionWithDiagnostics } from './core/actions/action-engine.js';

const result = await executeActionWithDiagnostics('contexts.create', input, context);
// Verás logs detallados + timing
```

### 3️⃣ Pre-flight Check
```javascript
import { canExecuteAction } from './core/actions/action-engine.js';

const { can_execute, reason } = canExecuteAction('contexts.create', context);
if (!can_execute) console.log('No puede:', reason);
```

---

## 📋 Acciones Disponibles (FASE 2)

```
✓ contexts.create  (req: label, type, scope, kind)
✓ contexts.update  (req: context_key)
✓ contexts.archive (req: context_key)
✓ contexts.delete  (req: context_key)
✓ contexts.restore (req: context_key)
```

---

## 🔍 Descubrir Acciones

```javascript
import { listActions } from './core/actions/action-registry.js';

const actions = listActions();
console.log(`Total: ${actions.length}`);
actions.forEach(a => console.log(`- ${a.action_key}`));
```

---

## 🏗️ Registrar Nueva Acción (Extensión)

**Archivo: `src/core/actions/packages.actions.js`**
```javascript
import { registerAction } from './action-registry.js';

registerAction({
  action_key: 'packages.create',
  description: 'Crea un nuevo paquete',
  
  input_schema: {
    required: ['package_name'],
    optional: ['description'],
    validations: {
      package_name: (val) => typeof val === 'string'
    }
  },
  
  permissions: ['admin'],
  
  handler: async (input, context) => {
    try {
      const result = await createPackageService(input);
      return { ok: true, data: result };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }
});
```

**En main app:**
```javascript
import './core/actions/packages.actions.js'; // Auto-registra
```

**Usar:**
```javascript
const result = await executeAction('packages.create', 
  { package_name: 'awesome-lib' }, 
  context
);
```

---

## ✅ Resultado Estructura

```javascript
{
  ok: true,                           // Boolean
  data: { context_key: 'ctx_123' },  // Dato resultado
  warnings: [],                       // Array de avisos
  error: null,                        // String o null
  
  // Extras si error:
  missingFields: ['label'],           // Si faltan requeridos
  extraFields: ['unknown_field']      // Si hay no permitidos
}
```

---

## 🔐 Validación Automática (En Action Engine)

```
1. ✓ Params validados (action_key string, input object, context object)
2. ✓ Acción existe (si no, error)
3. ✓ Usuario tiene permiso (role check)
4. ✓ Input válido (schema validation + custom validators)
5. ✓ Handler ejecutado
6. ✓ Resultado devuelto
```

---

## 🎯 Integración en Endpoint (Wrap Pattern)

**ANTES:**
```javascript
async function handleCreate(req, res, context) {
  // 50+ líneas validación manual
  // ...
  return res.json(result);
}
```

**AHORA:**
```javascript
async function handleCreate(req, res, context) {
  const result = await executeAction('contexts.create', req.body, context);
  if (!result.ok) return res.status(400).json({ error: result.error });
  return res.json(result.data);
}
```

---

## 📚 Input Schema Ejemplo

```javascript
input_schema: {
  required: ['label', 'type', 'scope', 'kind'],
  optional: ['description', 'allowed_values', 'default_value'],
  allowed: [
    'label', 'type', 'scope', 'kind',
    'description', 'allowed_values', 'default_value'
  ],
  validations: {
    label: (val) => typeof val === 'string' && val.length > 0,
    type: (val) => ['string', 'number', 'boolean', 'enum', 'json'].includes(val),
    scope: (val) => ['package', 'system', 'structural', 'personal'].includes(val),
    kind: (val) => ['mutable', 'immutable'].includes(val),
    allowed_values: (val) => Array.isArray(val)
  }
}
```

---

## 🐛 Debugging

**Ver qué se valida:**
```javascript
import { validateActionInput } from './core/actions/action-registry.js';
const valid = validateActionInput('contexts.create', input);
```

**Ver quién puede ejecutar:**
```javascript
import { validateActionPermissions } from './core/actions/action-registry.js';
const hasPermission = validateActionPermissions('contexts.create', context);
```

**Ver metadatos:**
```javascript
import { getActionInfo } from './core/actions/action-engine.js';
const info = getActionInfo('contexts.create');
console.log(info.input_schema);
console.log(info.permissions);
```

**Ver diagnóstico completo:**
```javascript
import { diagnoseRegistry } from './core/actions/action-registry.js';
console.log(diagnoseRegistry());
```

---

## 🎬 Ejemplo Completo: Crear Contexto

```javascript
// 1. Importar
import { executeAction } from './core/actions/action-engine.js';
import './core/actions/context.actions.js'; // Asegurar registro

// 2. Preparar datos
const formData = {
  label: 'Tipo de Producto',
  type: 'enum',
  scope: 'package',
  kind: 'immutable',
  allowed_values: ['A', 'B', 'C']
};

// 3. Contexto del usuario
const context = {
  user: { id: 'user_123', role: 'admin' },
  tenant_id: 'company_001'
};

// 4. Ejecutar acción
const result = await executeAction('contexts.create', formData, context);

// 5. Manejar resultado
if (result.ok) {
  console.log('✓ Contexto creado:', result.data.context_key);
  // UI: mostrar éxito, recargar lista
} else {
  console.log('✗ Error:', result.error);
  // UI: mostrar error
}
```

---

## 🚀 Extensibilidad: Agregar Signals

```javascript
// src/core/actions/signal.actions.js
import { registerAction } from './action-registry.js';

registerAction({
  action_key: 'signals.send',
  input_schema: {
    required: ['signal_name', 'target_user'],
    validations: {
      signal_name: (val) => /^[a-z_]+$/.test(val),
      target_user: (val) => typeof val === 'string'
    }
  },
  permissions: ['admin', 'moderator'],
  handler: async (input, context) => {
    // Tu lógica aquí
    return { ok: true, data: { signal_id: '...' } };
  }
});
```

---

## 🎓 Archivos a Revisar

| Archivo | Propósito | Líneas |
|---------|-----------|--------|
| `src/core/actions/action-registry.js` | Base del sistema | 287 |
| `src/core/actions/action-engine.js` | Ejecución | 164 |
| `src/core/actions/context.actions.js` | Acciones de contexto | 180 |
| `docs/RUNTIME_ACTION_REGISTRY_V1.md` | Arquitectura | 380 |

---

## ❓ Preguntas Frecuentes

**P: ¿Dónde agrego una nueva acción?**  
R: Crea `src/core/actions/[entity].actions.js` y llama `registerAction()`. Importa en main app.

**P: ¿Cómo cambio permisos de una acción?**  
R: Modifica `permissions: ['admin']` en `registerAction()` de esa acción.

**P: ¿Qué pasa si falta un campo requerido?**  
R: Action Engine devuelve `{ ok: false, error: "Campos faltando: ...", missingFields: [...] }`

**P: ¿Puedo ejecutar sin permiso?**  
R: No. Action Engine verifica permisos en paso 3/6, antes de ejecutar.

**P: ¿Qué diferencia hay con FASE 1?**  
R: FASE 1 valida qué datos se MUESTRAN. FASE 2 valida qué ACCIONES existen.

**P: ¿Cuándo viene FASE 3?**  
R: Cuando UI llame `executeAction()` directamente en lugar de endpoints.

---

## 🔗 Enlaces Útiles

- **Arquitectura**: [docs/RUNTIME_ACTION_REGISTRY_V1.md](docs/RUNTIME_ACTION_REGISTRY_V1.md)
- **Ejemplos**: [EJEMPLOS_ACTION_REGISTRY.md](EJEMPLOS_ACTION_REGISTRY.md)
- **Antes/Después**: [ANTES_DESPUES_FASE2.md](ANTES_DESPUES_FASE2.md)
- **Inventario**: [INVENTARIO_FASE2.md](INVENTARIO_FASE2.md)
- **Resumen**: [RESUMEN_FASE2.md](RESUMEN_FASE2.md)
- **Implementación**: [IMPLEMENTACION_FASE2_RUNTIME.md](IMPLEMENTACION_FASE2_RUNTIME.md)

---

**¿Necesitas ayuda? Revisa [EJEMPLOS_ACTION_REGISTRY.md](EJEMPLOS_ACTION_REGISTRY.md) para 15 ejemplos prácticos.**
