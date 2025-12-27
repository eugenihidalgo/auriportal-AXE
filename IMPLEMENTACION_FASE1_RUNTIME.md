# ✅ IMPLEMENTACIÓN: FASE 1 - Projection Contracts

**Fecha:** 25 Diciembre 2025  
**Status:** ✅ COMPLETADO  
**Tiempo:** ~2 horas  
**Commits:** Cambios mínimos, sin refactorización

---

## Resumen Ejecutivo

Se implementó la **FASE 1 del Runtime de AuriPortal**: Projection Contracts explícitos que evitan incoherencias de datos entre LIST, EDIT y RUNTIME.

### El Problema que Resuelve

El bug reciente donde contextos enum perdían `allowed_values` reveló un problema arquitectónico:
- **Causa raíz:** El API endpoint devolvía datos **incompletos**
- **Síntoma:** El formulario no tenía `type`, `allowed_values`, `scope`, etc.
- **Resultado:** El frontend infería defaults (`type = 'string'` en lugar de `'enum'`)

**Solución:** Definir contratos explícitos de datos para cada etapa (LIST ≠ EDIT ≠ RUNTIME), validar siempre, bloquear si falla.

---

## Archivos Creados

### 1. `src/core/contracts/projections/context.projection.contract.js` (268 líneas)

**Qué es:** Módulo central que define y valida las 3 proyecciones de Contexto

**Contiene:**
- `CONTEXT_PROJECTION_CONTRACTS` - Definición de contratos
  - `LIST`: 4 campos (context_key, name, label, description)
  - `EDIT`: 13 campos (requeridos + opcionales)
  - `RUNTIME`: 8 campos (solo lo necesario para ejecutar)

- Validadores:
  - `validateContextListProjection(obj)` → { ok, error, missingFields }
  - `validateContextEditProjection(obj)` → { ok, error, missingFields }
  - `validateContextRuntimeProjection(obj)` → { ok, error, missingFields }
  - `validateProjection(obj, type)` - Validador genérico

- Proyectores (helpers para transformar datos):
  - `projectToList(fullContext)` - Proyecta a LIST
  - `projectToEdit(fullContext)` - Proyecta a EDIT
  - `projectToRuntime(fullContext)` - Proyecta a RUNTIME

**Validaciones incluidas:**
- ✅ Campos requeridos presentes
- ✅ Sin campos extra
- ✅ Valores válidos (type, scope, kind)
- ✅ Validación específica para enums (allowed_values debe ser Array)

---

## Archivos Modificados

### 2. `src/endpoints/admin-contexts-api.js` (changes: ~60 líneas)

**Import añadido:**
```javascript
import {
  validateContextListProjection,
  validateContextEditProjection,
  projectToList,
  projectToEdit
} from '../core/contracts/projections/context.projection.contract.js';
```

**Cambios en `handleListContexts()`:**
- ANTES: Devolvía contextos sin validación
- DESPUÉS: 
  - Valida CADA contexto contra contrato LIST
  - Si NO cumple: OMITE el contexto, loguea warning
  - Respuesta incluye `validation_warnings` si hubo problemas

**Cambios en `handleGetContext()`:**
- ANTES: Devolvía contexto sin proyectar
- DESPUÉS:
  - Proyecta a EDIT antes de validar
  - Valida contra contrato EDIT
  - Si NO cumple: Devuelve error explícito (no datos parciales)
  - Respuesta incluye `projection_type: 'EDIT'` para diagnosticar

---

### 3. `src/core/html/admin/contexts/contexts-manager.html` (changes: ~170 líneas)

**Nuevas funciones validadoras en cliente:**

1. `validateContextEditProjection(ctx)` - Espejo del validador servidor
   - Validación de campos requeridos
   - Validación de valores (type, scope, kind)
   - Validación específica de enums

2. `mostrarErrorValidacionProyeccion(error, missingFields)` - UI de error
   - Crea div rojo con mensaje de error
   - Bloquea formulario (disabled + read-only)
   - Desactiva botón "Guardar"

3. `limpiarErroresValidacion()` - Limpia errores previos
   - Remueve div de error
   - Re-habilita formulario

4. `actualizarDiagnosticoProyeccion(ctx, validationResult)` - Diagnóstico visible
   - Muestra verde si ✅ OK
   - Muestra rojo si ⚠️ ERROR
   - Contiene: tipo, campos, resultado validación

**Cambios en `editarContexto()`:**
1. Limpia errores previos
2. VALIDA contexto contra contrato EDIT ANTES de hacer nada
3. Si NO cumple:
   - Muestra error visible
   - Actualiza diagnóstico
   - Bloquea formulario
   - **RETORNA (no procede)**
4. Si cumple:
   - Procede normalmente (mismo código anterior)
   - Actualiza diagnóstico con verde

**HTML añadido en modal:**
```html
<!-- Diagnóstico de Proyección (solo admin) -->
<div id="projection-diagnostic" class="mb-3 p-2 bg-slate-700/50 border border-slate-600 rounded text-xs text-slate-400">
  <span id="projection-diagnostic-text">Cargando...</span>
</div>
```

---

### 4. `docs/RUNTIME_PROJECTION_CONTRACTS_V1.md` (NEW - 380 líneas)

Documentación completa que explica:
- **Por qué** LIST ≠ EDIT ≠ RUNTIME (evita bugs)
- **Cómo** está implementado (servidor + cliente)
- **Cómo** extender a otras entidades (packages, signals, etc)
- **Principios** de Projection Contracts
- **Debugging** (qué buscar en logs)
- **Roadmap** futuro (FASE 2, 3, 4, 5)

---

## Flujo Ahora

### Lado Servidor:

```
GET /admin/api/contexts (LIST)
  ↓
listContexts() → BD
  ↓
Para cada contexto:
  ↓
  validateContextListProjection(ctx)
  ├─ OK: Incluir en respuesta
  └─ ERROR: Omitir, loggear warning
  ↓
Respuesta JSON: { ok: true, contexts: [...], validation_warnings?: [...] }
```

```
GET /admin/api/contexts/:key (EDIT)
  ↓
getContext(key) → BD
  ↓
projectToEdit(context)
  ↓
validateContextEditProjection(projection)
├─ OK: { ok: true, context: {...}, projection_type: 'EDIT', validation: { ok: true } }
└─ ERROR: { ok: false, error: '...', validation_error: '...', missingFields: [...] }
```

### Lado Cliente:

```
Usuario hace clic "Editar" contexto
  ↓
editarContexto(contextKey)
  ↓
validateContextEditProjection(ctx)
├─ ERROR:
│   ↓
│   mostrarErrorValidacionProyeccion()
│   actualizarDiagnosticoProyeccion()
│   Bloquear formulario
│   RETURN
│
└─ OK:
    ↓
    Proceder normalmente
    actualizarDiagnosticoProyeccion() con verde
    Permitir edición
```

---

## Beneficios Inmediatos

✅ **Imposible enviar datos incompletos**
- Servidor valida siempre
- Cliente valida antes de usar
- Si falla: error explícito, no default silencioso

✅ **Errores visibles**
- Admin ve en UI: "⚠️ Error - Contexto Inválido"
- Console logs detallados para debugging
- Campos faltando listados explícitamente

✅ **Protección de incoherencia**
- LIST y EDIT nunca se mezclan
- Imposible que LIST incompleto llegue a formulario
- RUNTIME solo contiene lo necesario

✅ **Extensible**
- Patrón claro para agregar contratos a packages, signals, etc
- Mismo código en cliente y servidor (espejo)
- Fácil de debuggear

---

## Testing Manual

### Escenario 1: Enum válido funciona

```
1. Crear contexto:
   - Type: enum
   - Allowed values: a, b, c
   
2. Editar contexto:
   - Diagnostico: ✅ Verde
   - Formulario: Habilitado
   - Type: Sigue siendo enum ✅
   - Allowed values: Se poblaron correctamente ✅
```

### Escenario 2: Enum con datos faltantes se bloquea

```
1. Corromper datos en BD (eliminar allowed_values):
   update pde_contexts set allowed_values = NULL 
   where type = 'enum' and context_key = 'test_enum';
   
2. Editar contexto:
   - Diagnostico: ⚠️ Rojo
   - Formulario: BLOQUEADO (disabled)
   - Mensaje: "allowed_values no puede estar vacío para type=enum"
   - Botón Guardar: Desactivado
```

### Escenario 3: LIST omite contextos inválidos

```
1. GET /admin/api/contexts
   ↓
2. Si hay contextos sin type/scope/kind:
   - No aparecen en lista
   - Log: [PROJECTION][LIST] Contexto omitido: ...
   - validation_warnings en respuesta (si hay)
   
3. Usuario no ve contextos rotos
```

---

## Logs Esperados

### Éxito:
```
[PROJECTION][EDIT] Validando contexto: { context_key: 'mi_enum', type: 'enum', allowed_values: [...] }
[PROJECTION][EDIT] ✅ Validación OK
```

### Error en servidor:
```
[PROJECTION][LIST] [PROJECTION LIST] Contexto omitido: mi_contexto_roto
[PROJECTION][EDIT] Error validando contexto 'otro_contexto': Campos requeridos faltando: type, scope, kind
```

### Error en cliente:
```
[PROJECTION][EDIT] Validando contexto: { context_key: 'test', type: undefined }
[PROJECTION][EDIT] Validación fallida: { ok: false, error: 'Campos requeridos faltando: type, scope, kind', missingFields: [...] }
```

---

## Estado de la App

✅ PM2 Status: **online**  
✅ No hay errores en logs  
✅ No regresiones funcionales  
✅ Imports correctos  
✅ Sintaxis validada  

---

## Integración Futura

Para extender Projection Contracts a otras entidades:

1. **Packages:** `src/core/contracts/projections/package.projection.contract.js`
2. **Signals:** `src/core/contracts/projections/signal.projection.contract.js`
3. **Events:** `src/core/contracts/projections/event.projection.contract.js`
4. **Etc.**

Mismo patrón: 3 validadores (LIST, EDIT, RUNTIME), 3 proyectores.

---

## Roadmap del Runtime (Futuro)

- ✅ **FASE 1:** Projection Contracts (HECHO)
- 🔄 **FASE 2:** Action Registry (Qué acciones puede hacer cada contexto)
- 📋 **FASE 3:** Coherence Engine (Validar consistencia entre componentes)
- 📡 **FASE 4:** Event Bus (Comunicación entre sistemas)
- 🎨 **FASE 5:** Screen Contracts (UI sabe qué datos mostrar)

---

## Conclusión

Se implementó con éxito el **contrato explícito de datos** para contextos, evitando que incompletos o incoherentes lleguen a formularios o runtime. La arquitectura es extensible y lista para aplicar a otras entidades.

El bug de enum que perdía `allowed_values` ahora es **imposible** de ocurrir, porque:
1. Servidor VALIDA contra contrato
2. Cliente VALIDA antes de usar
3. Si falta algo: error visible, no default silencioso

**FASE 1 del Runtime:** ✅ COMPLETADA
