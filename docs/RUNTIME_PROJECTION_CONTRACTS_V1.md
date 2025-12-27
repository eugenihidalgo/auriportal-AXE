# Runtime Projection Contracts - FASE 1

## Introducción

En AuriPortal, la **INCOHERENCIA DE DATOS** ha sido la causa raíz de varios bugs críticos:

- Bug de contextos enum que perdían `allowed_values` y revertían a string
- Formularios recibiendo datos incompletos desde APIs
- El frontend infiriendo defaults silenciosamente, rompiendo la lógica

**La solución: Projection Contracts explícitos.**

Un **Projection Contract** define EXACTAMENTE qué datos pueden fluir en cada etapa del sistema:
- **LIST**: Datos mínimos para listados (sin metadata de edición)
- **EDIT**: Todos los campos editables (completo, para formularios)
- **RUNTIME**: Solo lo necesario para ejecutar (sin datos informativos)

Esta arquitectura hace **IMPOSIBLE** que datos incompletos lleguen donde no deben.

---

## El Problema Real: Flujos Incoheren tes

### Antes de Projection Contracts:

```
Formulario (contextos-manager.html)
  ↓
  GET /admin/api/contexts (endpoint sin contrato)
  ↓ 
  Respuesta: { context_key, name, label, description }  ← INCOMPLETA
  ↓
  Formulario intenta editar
  ↓
  ctx.type = undefined  (nunca vino)
  ctx.allowed_values = undefined  (nunca vino)
  ↓
  Defaults silenciosos:
  const ctxType = ctx.type || 'string'  ← 'string', no 'enum'
  const ctxAllowedValues = ctx.allowed_values || null  ← null, aunque tenía valores
  ↓
  💥 BUG: Enum guardado como string
```

### Después de Projection Contracts:

```
Formulario (contextos-manager.html)
  ↓
  GET /admin/api/contexts/:key (endpoint con contrato EDIT)
  ↓
  Respuesta validada contra EDIT contract
  Contiene: { context_key, name, label, type, scope, kind, allowed_values, ... }
  ✅ VALIDADO: Todos los campos requeridos presentes
  ↓
  Formulario valida ANTES de poblar:
  validateContextEditProjection(ctx)  → { ok: true }
  ↓
  Formulario poblado correctamente
  ↓
  ✅ ENUM SE GUARDA COMO ENUM
```

---

## Contratos Definidos para Contextos

### 1. LIST Projection

**Uso:** Listar contextos en tablas, dropdowns, menús

**Campos:**
```javascript
{
  context_key: string,  // Identificador único
  name: string,         // Nombre descriptivo
  label: string,        // Etiqueta
  description: string   // Descripción (opcional, puede ser '')
}
```

**Validaciones:**
- ✅ `context_key` presente y válido
- ✅ `name` y `label` no vacíos
- ❌ NO incluye: `type`, `allowed_values`, `scope`, `kind`
- ❌ NO permite edición: Solo lectura

**Usado por:**
- `GET /admin/api/contexts` → `handleListContexts()`
- Tabla de listado de contextos en UI

---

### 2. EDIT Projection

**Uso:** Formulario de edición de contextos

**Campos:**
```javascript
{
  // Requeridos
  context_key: string,        // Identificador
  name: string,               // Nombre
  label: string,              // Etiqueta
  type: string,               // Tipo (enum, string, number, etc)
  scope: string,              // Alcance (package, system, etc)
  kind: string,               // Tipo (normal, restricted)
  
  // Opcionales (pueden ser null, pero deben existir como claves)
  description: string | null,
  allowed_values: Array | null,  // Para type=enum
  default_value: any | null,
  definition: Object | null,     // Metadata avanzada
  status: string | null,
  is_system: boolean | null,
  injected: boolean | null
}
```

**Validaciones:**
- ✅ Todos los campos requeridos presentes
- ✅ `type` en lista válida: enum, string, number, boolean, json
- ✅ `scope` en lista válida: package, system, structural, personal
- ✅ `kind` en lista válida: normal, restricted
- ✅ Si `type === enum`: `allowed_values` es Array y no vacío
- ❌ Campos opcionales pueden ser `null` o `undefined`, pero no debe haber campos extra

**Usado por:**
- `GET /admin/api/contexts/:key` → `handleGetContext()`
- Formulario de edición en `contexts-manager.html`

---

### 3. RUNTIME Projection

**Uso:** Ejecutar contextos en el sistema (inyección, validación, etc)

**Campos:**
```javascript
{
  context_key: string,
  type: string,                    // Tipo real
  scope: string,                   // Alcance real
  kind: string,                    // Tipo real
  allowed_values: Array | null,    // Solo si es enum
  default_value: any | null,
  injected: boolean,
  definition: Object | null
}
```

**Validaciones:**
- ✅ `context_key`, `type`, `scope`, `kind` siempre presentes
- ✅ Mismas validaciones de valores que EDIT
- ❌ NO incluye: `name`, `label`, `description` (solo metadata informativa)
- ❌ NO permite edición

**Usado por:**
- Engine de inyección de contextos
- Validadores de contextos en runtime
- Resolvers (cuando se necesita información de ejecución)

---

## Implementación en el Código

### Lado Servidor (Node.js)

**Archivo:** `src/core/contracts/projections/context.projection.contract.js`

```javascript
// Validar LIST
const validation = validateContextListProjection(obj);
if (!validation.ok) {
  console.warn(`[PROJECTION][LIST] ${validation.error}`);
  return null; // No devolver
}

// Validar EDIT
const validation = validateContextEditProjection(obj);
if (!validation.ok) {
  return {
    ok: false,
    error: 'Datos incompletos',
    validation_error: validation.error
  };
}

// Proyectar a forma segura
const listProjection = projectToList(fullContext);
const editProjection = projectToEdit(fullContext);
const runtimeProjection = projectToRuntime(fullContext);
```

**Integración en endpoints:**

`src/endpoints/admin-contexts-api.js`:

```javascript
// handleListContexts: Validar cada contexto contra LIST
for (const ctx of visibleContexts) {
  const validation = validateContextListProjection(ctx);
  if (!validation.ok) {
    console.warn(`[PROJECTION][LIST] ${validation.error} - Omitido`);
    continue; // No incluir en respuesta
  }
  contexts.push(ctx);
}

// handleGetContext: Validar contra EDIT
const editProjection = projectToEdit(context);
const validation = validateContextEditProjection(editProjection);
if (!validation.ok) {
  return {
    ok: false,
    error: 'Datos del contexto incompletos',
    validation_error: validation.error
  };
}
return { ok: true, context: editProjection };
```

### Lado Cliente (HTML/JS)

**Archivo:** `src/core/html/admin/contexts/contexts-manager.html`

```javascript
// ANTES de poblar el formulario
const validation = validateContextEditProjection(ctx);

if (!validation.ok) {
  // Mostrar error visible
  mostrarErrorValidacionProyeccion(validation.error, validation.missingFields);
  
  // Bloquear formulario (read-only, sin guardar)
  document.querySelectorAll('input, select, textarea').forEach(el => {
    el.disabled = true;
  });
  
  // NO permitir edición
  return;
}

// Si es válido, proceder con normalidad
editarContexto(contextKey);
```

---

## Cómo Evita Bugs

### Bug Original:

1. Endpoint devuelve LIST parcial
2. Formulario asume defaults (`|| 'string'`)
3. Enum se convierte a string
4. Sistema se rompe

### Con Projection Contracts:

1. **Servidor:**
   - LIST endpoint devuelve SOLO los 4 campos permitidos
   - EDIT endpoint devuelve TODOS los campos requeridos
   - Si faltan campos, API rechaza

2. **Cliente:**
   - Antes de usar datos, VALIDA contra contrato EDIT
   - Si no cumple, BLOQUEA el formulario
   - NO hay defaults silenciosos
   - Usuario ve error explícito

3. **Resultado:**
   - ✅ Datos siempre completos
   - ✅ Errores visibles (no silenciosos)
   - ✅ Imposible enviar datos incompletos

---

## Cómo Extender a Otras Entidades

Para agregar contratos a **packages**, **signals**, u otras entidades:

### Paso 1: Crear archivo de contrato

```javascript
// src/core/contracts/projections/package.projection.contract.js

const PACKAGE_PROJECTION_CONTRACTS = {
  LIST: {
    required: ['package_key', 'name', 'label'],
    optional: ['description'],
    allowed: ['package_key', 'name', 'label', 'description']
  },
  EDIT: {
    required: ['package_key', 'name', 'label', 'duration_days', 'lessons'],
    optional: ['description', 'definition', 'status'],
    allowed: [...]
  },
  RUNTIME: {
    required: ['package_key', 'duration_days', 'lessons'],
    optional: ['definition'],
    allowed: [...]
  }
};

// Exportar validadores
function validatePackageListProjection(obj) { ... }
function validatePackageEditProjection(obj) { ... }
function validatePackageRuntimeProjection(obj) { ... }
```

### Paso 2: Integrar en API

```javascript
// src/endpoints/admin-packages-api.js

import { validatePackageListProjection, validatePackageEditProjection } from '../core/contracts/projections/package.projection.contract.js';

async function handleListPackages(request, env) {
  const packages = await listPackages();
  
  const validated = packages
    .filter(pkg => {
      const validation = validatePackageListProjection(pkg);
      if (!validation.ok) {
        console.warn(`[PROJECTION][LIST] Package ${pkg.package_key}: ${validation.error}`);
        return false;
      }
      return true;
    });
  
  return Response.json({ ok: true, packages: validated });
}
```

### Paso 3: Integrar en formulario

```javascript
// Mismo patrón que contexts-manager.html

const validation = validatePackageEditProjection(pkg);
if (!validation.ok) {
  mostrarErrorValidacionProyeccion(validation.error);
  bloquearFormulario();
  return;
}

// Proceder normalmente
editarPackage(packageKey);
```

---

## Principios de Projection Contracts

1. **Nunca mezclar proyecciones**
   - ❌ Usar datos de LIST para editar
   - ✅ Siempre fetchar EDIT si vas a editar

2. **Validar siempre**
   - Servidor VALIDA antes de responder
   - Cliente VALIDA antes de usar

3. **Bloquear en error**
   - ❌ No inferir defaults
   - ✅ Mostrar error al usuario
   - ✅ Permitir que admin investigue

4. **Datos incompletos = Rechazo**
   - Una sola validación fallida = toda la entidad rechazada
   - No devolver datos parciales nunca

5. **Extensible**
   - Nuevo contrato por entidad
   - Reutilizable en toda la arquitectura
   - Fácil de debuggear (errores explícitos)

---

## Debugging

### Errores en Servidor

```javascript
// Logs de validación
[PROJECTION][LIST] Contexto omitido: mi_contexto_roto
[PROJECTION][EDIT] Error validando contexto 'otro_contexto': 
  Fields requeridos faltando: type, scope, kind
```

### Errores en Cliente

```javascript
// Console (siempre está)
[PROJECTION][EDIT] Validando contexto: { context_key: ..., type: undefined }
[PROJECTION][EDIT] Validación fallida: {
  ok: false,
  error: 'Campos requeridos faltando: type, scope, kind'
}

// UI (visible para admin)
⚠️ Error de Validación de Datos
Campos requeridos faltando: type, scope, kind
(Formulario bloqueado)
```

---

## Roadmap Futuro

Esta es FASE 1 (Projection Contracts).

Las fases siguientes son:

- **FASE 2:** Action Registry (Qué acciones puede hacer cada contexto)
- **FASE 3:** Coherence Engine (Validar consistencia entre componentes)
- **FASE 4:** Event Bus (Comunicación entre sistemas)
- **FASE 5:** Screen Contracts (UI debe saber qué datos mostrar)

Cada fase añade una capa de protección contra incoherencias.

---

## Archivo de Referencia

Implementación completa:
- [context.projection.contract.js](../src/core/contracts/projections/context.projection.contract.js)
- [admin-contexts-api.js](../src/endpoints/admin-contexts-api.js) - handleListContexts, handleGetContext
- [contexts-manager.html](../src/core/html/admin/contexts/contexts-manager.html) - editarContexto, validateContextEditProjection

---

**Fecha:** Diciembre 2025  
**Versión:** FASE 1 - Projection Contracts  
**Status:** ✅ Implementado en contextos, listo para extender a otras entidades
