# THEME CONTEXT INTEGRATION V1 — INTEGRACIÓN DE CONTEXTOS EN TEMAS
**AuriPortal · Temas como Consumidores del Context Resolver v1**

**Fecha**: 2025-01-XX  
**Versión**: 1.0.0  
**Estado**: Implementado

---

## RESUMEN EJECUTIVO

Los **temas** ahora pueden consumir contextos resueltos mediante el **Context Resolver v1**. Los temas pueden declarar qué contextos necesitan y recibir valores resueltos que pueden usar para decisiones visuales (tokens, variantes).

**Características**:
- ✅ Temas pueden declarar `context_request` en su definición
- ✅ Context Resolver v1 resuelve contextos antes de aplicar tokens
- ✅ Resolución async (no bloquea el render)
- ✅ Fail-open absoluto (si falla, usa comportamiento legacy)
- ✅ Compatibilidad legacy mantenida (funciona sin snapshot)

---

## FLUJO COMPLETO

### 1. Definición del Tema

Un tema puede declarar qué contextos necesita en su `definition_json`:

```json
{
  "id": "dark-classic",
  "name": "Dark Classic",
  "tokens": {
    "--bg-main": "#1a1a1a",
    "--text-primary": "#ffffff",
    // ... más tokens
  },
  "context_request": {
    "required": ["actor_type"],
    "optional": ["nivel_efectivo", "sidebar_context"],
    "include": {
      "snapshotPaths": ["identity.*", "environment.*", "student.nivelEfectivo"],
      "flags": true
    }
  }
}
```

### 2. Resolución del Tema

Cuando se aplica un tema (mediante `applyTheme` o `renderHtml`):

1. **Si hay snapshot**: Se usa `resolveThemeWithContext` (async)
   - Construye `ExecutionContext` para el tema
   - Construye `ContextRequest` desde `context_request` del tema
   - Resuelve contextos usando Context Resolver v1
   - Aplica tokens del tema (los contextos resueltos están disponibles en `_resolvedContexts`)

2. **Si NO hay snapshot**: Se usa `resolveTheme` (síncrono, legacy)
   - Comportamiento legacy mantenido
   - No resuelve contextos

### 3. Uso de Contextos Resueltos

Los contextos resueltos están disponibles en el `ThemeEffective` como propiedad no-enumerable:

```javascript
const themeEffective = await resolveThemeWithContext({ student, theme_id, snapshot });

// Contextos resueltos están en:
const resolvedContexts = themeEffective._resolvedContexts;
// {
//   actor_type: 'student',
//   nivel_efectivo: 5,
//   sidebar_context: 'home'
// }
```

**NOTA**: Por ahora, los contextos se resuelven pero **no se aplican directamente a los tokens**. Esto se implementará en fases futuras cuando se añada lógica de variantes condicionales.

---

## FUNCIONES IMPLEMENTADAS

### `resolveThemeWithContext()`

**Archivo**: `src/core/theme/theme-resolver.js`

**Función**:
```javascript
async function resolveThemeWithContext({ student, session, systemState, theme_id, snapshot })
```

**Características**:
- Resuelve tema usando Context Resolver v1 si hay snapshot
- Si no hay snapshot, delega a `resolveThemeAsync`
- Fail-open: si falla, usa resolver legacy

---

### `applyTheme()` (Modificada)

**Archivo**: `src/core/responses.js`

**Cambios**:
- Ahora es **async**
- Acepta `snapshot` opcional (4to parámetro)
- Si hay snapshot, usa `resolveThemeWithContext`
- Si no hay snapshot, usa `resolveTheme` (legacy)

**Firma**:
```javascript
async function applyTheme(html, student = null, theme_id = null, snapshot = null)
```

---

### `renderHtml()` (Modificada)

**Archivo**: `src/core/html-response.js`

**Cambios**:
- Ahora es **async**
- Acepta `snapshot` en `options.snapshot`
- Pasa snapshot a `applyTheme`

**Firma**:
```javascript
async function renderHtml(html, options = {})
// options puede incluir: { student, theme_id, snapshot, headers, status }
```

---

### Funciones `renderPantalla*` (Modificadas)

**Archivo**: `src/core/responses.js`

**Cambios**:
- Todas las funciones `renderPantalla*` ahora son **async**
- `renderPantalla0`, `renderPantalla1`, `renderPantalla2`, `renderPantalla3`, `renderPantalla4`, `renderPantalla21`, `renderPantalla2Practicar`

**Razón**: Como llaman a `renderHtml` que ahora es async, deben ser async también.

**NOTA**: Las llamadas a estas funciones deben usar `await` en código async. El código existente que no use `await` seguirá funcionando (devuelve Promise), pero es recomendable actualizar las llamadas para usar `await`.

---

## EJEMPLO DE USO

### Ejemplo 1: Aplicar Tema con Context Snapshot

```javascript
import { applyTheme } from '../core/responses.js';

// Context Snapshot v1 (construido previamente)
const snapshot = {
  identity: {
    actorType: 'student',
    actorId: '550e8400-e29b-41d4-a716-446655440000',
    email: 'alumno@ejemplo.com',
    isAuthenticated: true,
    requestId: 'req-123'
  },
  environment: {
    env: 'prod',
    context: 'student',
    screen: '/enter',
    sidebarContext: 'home'
  },
  student: {
    nivelEfectivo: 5,
    streak: 42
  },
  // ... más snapshot
};

// HTML sin tema
const html = '<html>...</html>';

// Aplicar tema con snapshot (async)
const htmlWithTheme = await applyTheme(html, student, null, snapshot);
```

### Ejemplo 2: Renderizar HTML con Tema y Snapshot

```javascript
import { renderHtml } from '../core/html-response.js';

const html = '<html>...</html>';

// Renderizar con tema y snapshot
const response = await renderHtml(html, {
  student: student,
  snapshot: contextSnapshotV1,
  status: 200
});
```

### Ejemplo 3: Tema que Declara Context Request

```json
{
  "id": "dynamic-theme",
  "name": "Dynamic Theme",
  "tokens": {
    "--bg-main": "#1a1a1a",
    "--text-primary": "#ffffff"
  },
  "context_request": {
    "required": ["actor_type"],
    "optional": ["nivel_efectivo"],
    "include": {
      "snapshotPaths": ["identity.*", "student.nivelEfectivo"],
      "flags": false
    }
  }
}
```

Cuando se resuelve este tema con snapshot:
- Se construye `ExecutionContext` para el tema
- Se construye `ContextRequest` desde `context_request`
- Context Resolver v1 resuelve `actor_type` y `nivel_efectivo`
- Los valores resueltos están en `themeEffective._resolvedContexts`
- Los tokens se aplican normalmente

---

## COMPATIBILIDAD LEGACY

**Compatibilidad total mantenida**:

1. **Sin snapshot**: Si no se proporciona snapshot, se usa `resolveTheme` (síncrono, legacy)
2. **Funciones async**: Las funciones ahora son async, pero se pueden llamar con `await` o sin él (devuelven Promise)
3. **Fallback automático**: Si `resolveThemeWithContext` falla, fallback a `resolveTheme`

**Migración gradual**:
- Código existente sigue funcionando (devuelve Promise si no se hace await)
- Para usar Context Resolver v1, simplemente pasar `snapshot` como parámetro
- No se requiere refactor masivo

---

## LIMITACIONES ACTUALES

### 1. Contextos Resueltos No Se Aplican a Tokens Todavía

Los contextos se resuelven y están disponibles en `_resolvedContexts`, pero **no se aplican directamente a los tokens del tema**.

**Razón**: Esto requiere lógica de variantes condicionales que se implementará en fases futuras.

**Solución temporal**: Los contextos están disponibles para inspección y debugging, pero no afectan el render actual.

### 2. Solo Funciona con Snapshot

Para que el Context Resolver v1 funcione, se debe proporcionar un Context Snapshot v1.

**Razón**: El snapshot es necesario para construir `ExecutionContext`.

**Solución**: Si no hay snapshot, se usa comportamiento legacy (sin contextos).

---

## QUÉ PUEDE Y QUÉ NO PUEDE HACER UN TEMA

### ✅ PUEDE

- Declarar qué contextos necesita (`context_request`)
- Recibir contextos resueltos (en `_resolvedContexts`)
- Usar contextos para decisiones visuales futuras (variantes condicionales)

### ❌ NO PUEDE

- Usar contextos para lógica de negocio (solo para presentación)
- Modificar estado del sistema
- Acceder directamente a PostgreSQL
- Ejecutar código arbitrario

**Principio**: Los temas son para **presentación**, no para lógica de negocio.

---

## PRÓXIMAS FASES

### Fase 2 (Futuro)

1. **Variantes Condicionales**: Aplicar diferentes tokens según contextos resueltos
2. **Tokens Dinámicos**: Calcular valores de tokens desde contextos
3. **UI de Debug**: Mostrar contextos resueltos en Theme Studio

---

## REFERENCIAS

- **Context Resolver v1**: `docs/CONTEXT_RESOLVER_V1.md`
- **Context Resolver Implementado**: `docs/CONTEXT_RESOLVER_V1_IMPLEMENTED.md`
- **Context Snapshot v1**: `docs/CONTEXT_SNAPSHOT_V1.md`
- **Código**: 
  - `src/core/theme/theme-resolver.js`
  - `src/core/responses.js`
  - `src/core/html-response.js`

---

**FIN DE LA INTEGRACIÓN**