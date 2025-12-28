# THEME DEFINITION V1 — CONTRATO CANÓNICO
**AuriPortal · Definición Formal de Temas**

**Fecha**: 2025-01-XX  
**Versión**: 1.0.0  
**Estado**: Canónico

---

## RESUMEN EJECUTIVO

Este documento define el **contrato canónico ThemeDefinitionV1** para AuriPortal. Es la única fuente de verdad sobre qué es un tema, cómo se estructura y qué puede y no puede hacer.

**Principios**:
- Un tema es **presentación pura**, no lógica de negocio
- Los tokens son **primitivos** (valores CSS, no cálculos)
- Las variantes son **futuras** (no activas en v1)
- Los contextos son **opcionales** (para decisiones visuales futuras)
- El contrato es **estable** (backward-compatible)

---

## 1. DEFINICIÓN DE TEMA

### ¿Qué es un Tema?

Un **tema** es una definición completa de valores visuales (colores, gradientes, sombras, radios) que se aplican consistentemente a toda la interfaz de usuario de AuriPortal.

**Características esenciales**:
- ✅ Define valores CSS (variables CSS custom properties)
- ✅ Es inmutable una vez publicado (versionado)
- ✅ Es determinista (mismo input → mismo output)
- ✅ Es para presentación (no lógica de negocio)
- ✅ Puede consumir contextos (opcional, v1)

### ¿Qué NO es un Tema?

- ❌ NO es lógica de negocio
- ❌ NO calcula valores dinámicamente (excepto variantes futuras)
- ❌ NO accede a PostgreSQL directamente
- ❌ NO ejecuta código JavaScript
- ❌ NO modifica estado del sistema
- ❌ NO es un paquete PDE (aunque pueden relacionarse conceptualmente)

---

## 2. ESTRUCTURA CANÓNICA ThemeDefinitionV1

### Interface TypeScript/JSDoc

```typescript
/**
 * ThemeDefinitionV1 - Contrato canónico de un tema
 */
interface ThemeDefinitionV1 {
  // Campos requeridos
  id: string;              // ID único (ej: 'dark-classic', 'custom-theme-1')
  name: string;            // Nombre legible (ej: 'Dark Classic', 'Custom Theme 1')
  tokens: TokenMap;        // Mapa completo de variables CSS (TODAS las del contrato)
  
  // Campos opcionales
  description?: string;                    // Descripción del tema
  meta?: ThemeMeta;                        // Metadata opcional
  context_request?: ContextRequest;        // Request de contextos (opcional, v1)
  variants?: ThemeVariants;                // Variantes condicionales (opcional, FUTURO)
}

/**
 * TokenMap - Mapa de todas las variables CSS del contrato
 * Debe incluir TODAS las variables definidas en Theme Contract v1
 */
type TokenMap = {
  [key in ContractVariable]: string;
};

/**
 * ThemeMeta - Metadata del tema
 */
interface ThemeMeta {
  version?: string;           // Versión del tema (opcional)
  created_at?: string;        // Fecha de creación (ISO 8601)
  updated_at?: string;        // Fecha de actualización (ISO 8601)
  created_by?: string;        // ID/email del creador
  contract_version?: string;  // Versión del contrato usado (ej: 'v1')
  tags?: string[];            // Tags para categorización (opcional)
  [key: string]: any;         // Campos adicionales permitidos
}

/**
 * ContextRequest - Request de contextos (opcional)
 * Define qué contextos necesita el tema para decisiones visuales futuras
 */
interface ContextRequest {
  required?: string[];        // Contextos requeridos (ej: ['actor_type'])
  optional?: string[];        // Contextos opcionales (ej: ['nivel_efectivo'])
  include?: {
    snapshotPaths?: string[]; // Paths del snapshot a incluir
    flags?: boolean;          // Incluir flags
    pdeContexts?: boolean;    // Incluir PDE contexts persistentes
    derived?: boolean;        // Incluir contextos derivados
  };
}

/**
 * ThemeVariants - Variantes condicionales (FUTURO, no activo en v1)
 * Se define pero NO se implementa todavía
 */
interface ThemeVariants {
  // FUTURO: Variantes que aplican diferentes tokens según contextos
  // Por ahora, esta estructura está documentada pero no implementada
  [variantKey: string]: {
    when: { [contextKey: string]: any };  // Condición
    tokens: Partial<TokenMap>;            // Tokens a aplicar si se cumple
  };
}
```

### Ejemplo Completo

```json
{
  "id": "dark-classic",
  "name": "Dark Classic",
  "description": "Tema oscuro clásico de AuriPortal",
  "tokens": {
    "--bg-main": "#0a0e1a",
    "--bg-primary": "#0a0e1a",
    "--bg-panel": "#0f1422",
    "--bg-card": "#141827",
    "--text-primary": "#f1f5f9",
    "--text-secondary": "#cbd5e1",
    "--accent-primary": "#7c3aed",
    "--accent-secondary": "#6366f1",
    "--shadow-sm": "rgba(0, 0, 0, 0.4)",
    "--gradient-primary": "linear-gradient(135deg, #7c3aed, #6366f1)",
    // ... TODAS las variables del contrato (ver Theme Contract v1)
  },
  "meta": {
    "contract_version": "v1",
    "created_at": "2025-01-01T00:00:00Z",
    "tags": ["dark", "classic", "system"]
  },
  "context_request": {
    "required": ["actor_type"],
    "optional": ["nivel_efectivo"],
    "include": {
      "snapshotPaths": ["identity.*", "environment.*"],
      "flags": true
    }
  }
}
```

---

## 3. CAMPOS REQUERIDOS

### `id` (string, requerido)

- **Formato**: Slug válido (solo letras, números, guiones, guiones bajos)
- **Regla**: `^[a-z0-9_-]+$`
- **Ejemplos válidos**: `dark-classic`, `light-classic`, `custom-theme-1`
- **Ejemplos inválidos**: `dark classic`, `dark.classic`, `dark/classic`
- **Unicidad**: Debe ser único en el sistema (BD o sistema)

### `name` (string, requerido)

- **Descripción**: Nombre legible para mostrar en UI
- **Ejemplos**: `"Dark Classic"`, `"Light Classic"`, `"Custom Theme 1"`
- **No tiene restricciones de formato** (puede contener espacios, mayúsculas, etc.)

### `tokens` (TokenMap, requerido)

- **Descripción**: Mapa completo de TODAS las variables CSS del Theme Contract v1
- **Requiere**: TODAS las variables definidas en `CONTRACT_VARIABLES`
- **Validación**: Se valida contra `validateThemeValues()` del Theme Contract
- **Relleno automático**: Si falta alguna variable, se rellena desde `CONTRACT_DEFAULT`

**Variables requeridas** (ver `src/core/theme/theme-contract.js`):
- Fondos principales: `--bg-main`, `--bg-primary`, `--bg-panel`, `--bg-card`, etc.
- Textos: `--text-primary`, `--text-secondary`, `--text-muted`, etc.
- Bordes: `--border-soft`, `--border-strong`, `--border-color`, etc.
- Acentos: `--accent-primary`, `--accent-secondary`, `--accent-hover`, etc.
- Sombras: `--shadow-sm`, `--shadow-md`, `--shadow-lg`, etc.
- Gradientes: `--gradient-primary`, `--gradient-hover`, `--aura-gradient`, etc.
- Badges: `--badge-bg-active`, `--badge-text-active`, etc.
- Inputs: `--input-bg`, `--input-border`, `--input-text`, etc.
- Radios: `--radius-sm`, `--radius-md`, `--radius-lg`, etc.
- Y más... (ver contrato completo)

---

## 4. CAMPOS OPCIONALES

### `description` (string, opcional)

- **Descripción**: Descripción humana del tema
- **Ejemplo**: `"Tema oscuro clásico con acentos púrpuras"`

### `meta` (ThemeMeta, opcional)

- **Descripción**: Metadata adicional del tema
- **Campos comunes**:
  - `contract_version`: Versión del contrato usado (ej: `'v1'`)
  - `created_at`: Fecha de creación (ISO 8601)
  - `updated_at`: Fecha de actualización (ISO 8601)
  - `created_by`: ID/email del creador
  - `tags`: Array de tags para categorización
- **Extensible**: Puede contener campos adicionales (no se valida estrictamente)

### `context_request` (ContextRequest, opcional)

- **Descripción**: Define qué contextos necesita el tema (para decisiones visuales futuras)
- **Estado**: Se resuelve mediante Context Resolver v1, pero **NO se aplica a tokens todavía**
- **Uso actual**: Los contextos resueltos están disponibles en `_resolvedContexts` pero no afectan el render
- **Uso futuro**: Se usará para variantes condicionales (Fase 2)

**Ejemplo**:
```json
{
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

### `variants` (ThemeVariants, opcional, FUTURO)

- **Descripción**: Variantes condicionales que aplican diferentes tokens según contextos
- **Estado**: Documentado pero **NO implementado en v1**
- **Uso futuro**: Permitirá temas dinámicos que cambian según contextos resueltos

**Ejemplo futuro** (NO activo todavía):
```json
{
  "variants": {
    "high-level": {
      "when": { "nivel_efectivo": { ">=": 10 } },
      "tokens": {
        "--accent-primary": "#ff6b6b",
        "--text-accent": "#ff8787"
      }
    }
  }
}
```

---

## 5. PRINCIPIOS CONSTITUCIONALES

### 5.1. Presentación Pura

**Regla**: Un tema es SOLO para presentación visual, NO para lógica de negocio.

**Prohibido**:
- ❌ Calcular valores desde PostgreSQL
- ❌ Ejecutar código JavaScript arbitrario
- ❌ Modificar estado del sistema
- ❌ Tomar decisiones de negocio (solo visuales)

**Permitido**:
- ✅ Definir valores CSS (colores, gradientes, sombras)
- ✅ Usar contextos para decisiones visuales (futuro, variantes)
- ✅ Ser versionado e inmutable

### 5.2. Tokens Son Primitivos

**Regla**: Los tokens son valores CSS primitivos, NO cálculos.

**Formato válido**:
- ✅ Colores hex: `#ffd86b`
- ✅ Colores RGB/RGBA: `rgba(255, 193, 7, 0.1)`
- ✅ Gradientes CSS: `linear-gradient(135deg, #ffd86b, #ffcd4a)`
- ✅ Valores CSS estándar: `12px`, `9999px`, etc.

**Formato inválido**:
- ❌ Expresiones JavaScript: `calculateColor(...)`
- ❌ Referencias a otras variables: `var(--other-var)`
- ❌ Funciones personalizadas: `darken(#ffd86b, 20%)`

**Razón**: Los tokens deben ser aplicables directamente como CSS, sin procesamiento adicional.

### 5.3. Variantes Son Futuras

**Regla**: Las variantes condicionales están documentadas pero NO implementadas en v1.

**Estado actual**:
- ✅ `context_request` se resuelve (Context Resolver v1)
- ✅ Contextos resueltos están disponibles en `_resolvedContexts`
- ❌ Las variantes NO se evalúan
- ❌ Los tokens NO cambian según contextos

**Razón**: Mantener v1 simple y estable. Las variantes se implementarán en Fase 2.

### 5.4. Compatibilidad Legacy

**Regla**: El contrato debe ser compatible con temas existentes (admin-classic, dark-classic, light-classic).

**Mapeo legacy**:
- `key` (en código) → `id` (en contrato)
- `values` (en código) → `tokens` (en contrato)
- `definition_json` (en BD) → Estructura completa `ThemeDefinitionV1`

**Compatibilidad**:
- ✅ Temas del sistema funcionan sin cambios
- ✅ Temas de BD funcionan con `definition_json`
- ✅ Validación es opcional (solo para publicación)

### 5.5. Inmutabilidad Post-Publicación

**Regla**: Una vez publicado, un tema es inmutable (versionado).

**Implementación**:
- Versiones se almacenan en `theme_versions` (PostgreSQL)
- Cada versión es inmutable
- Nueva versión = nuevo número de versión

**Razón**: Garantizar reproducibilidad y evitar cambios inesperados.

---

## 6. EJEMPLOS VÁLIDOS

### Ejemplo 1: Tema del Sistema (dark-classic)

```json
{
  "id": "dark-classic",
  "name": "Dark Classic",
  "tokens": {
    "--bg-main": "#0a0e1a",
    "--bg-primary": "#0a0e1a",
    "--text-primary": "#f1f5f9",
    "--accent-primary": "#7c3aed",
    // ... todas las variables del contrato
  },
  "meta": {
    "contract_version": "v1",
    "tags": ["dark", "classic", "system"]
  }
}
```

### Ejemplo 2: Tema Personalizado con Context Request

```json
{
  "id": "custom-theme-1",
  "name": "Custom Theme 1",
  "description": "Tema personalizado con variaciones según nivel",
  "tokens": {
    "--bg-main": "#faf7f2",
    "--bg-primary": "#faf7f2",
    "--text-primary": "#333333",
    "--accent-primary": "#ffd86b",
    // ... todas las variables del contrato
  },
  "meta": {
    "contract_version": "v1",
    "created_at": "2025-01-15T10:00:00Z",
    "created_by": "admin@example.com",
    "tags": ["light", "custom"]
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

### Ejemplo 3: Tema Mínimo (solo campos requeridos)

```json
{
  "id": "minimal-theme",
  "name": "Minimal Theme",
  "tokens": {
    "--bg-main": "#ffffff",
    "--bg-primary": "#ffffff",
    // ... TODAS las variables del contrato (no se puede omitir ninguna)
  }
}
```

---

## 7. EJEMPLOS PROHIBIDOS

### ❌ Prohibido: Tokens Calculados

```json
{
  "id": "invalid-theme",
  "name": "Invalid Theme",
  "tokens": {
    "--bg-main": "calculateColor('#ffffff', 0.1)",  // ❌ NO permitido
    "--accent-primary": "var(--other-var)"          // ❌ NO permitido
  }
}
```

### ❌ Prohibido: Lógica de Negocio

```json
{
  "id": "invalid-theme",
  "name": "Invalid Theme",
  "tokens": { /* ... */ },
  "logic": {  // ❌ NO permitido
    "if": { "nivel_efectivo": "> 10" },
    "then": { "read_from_postgres": true }
  }
}
```

### ❌ Prohibido: Tokens Faltantes (sin rellenar)

```json
{
  "id": "incomplete-theme",
  "name": "Incomplete Theme",
  "tokens": {
    "--bg-main": "#ffffff"
    // ❌ Faltan TODAS las demás variables del contrato
  }
}
```

**Nota**: El sistema rellena automáticamente las faltantes desde `CONTRACT_DEFAULT`, pero el contrato requiere que todas estén presentes (o al menos que se validen al publicar).

### ❌ Prohibido: ID Inválido

```json
{
  "id": "dark classic",  // ❌ Espacios no permitidos
  "name": "Dark Classic",
  "tokens": { /* ... */ }
}
```

---

## 8. DECISIONES DE DISEÑO

### 8.1. Por Qué Variantes NO Se Activan Aún

**Decisión**: Las variantes condicionales están documentadas pero NO implementadas en v1.

**Razones**:
1. **Simplicidad**: v1 debe ser estable y simple
2. **Validación**: Necesitamos experiencia con contextos antes de variantes
3. **Implementación**: Requiere motor de evaluación de condiciones (no trivial)

**Estado**:
- ✅ `context_request` se resuelve
- ✅ Contextos están disponibles en `_resolvedContexts`
- ❌ Variantes NO se evalúan
- ❌ Tokens NO cambian según contextos

**Futuro**: Se implementará en Fase 2 cuando tengamos experiencia con contextos.

### 8.2. Por Qué Tokens Son Primitivos

**Decisión**: Los tokens son valores CSS primitivos, NO cálculos ni expresiones.

**Razones**:
1. **Aplicabilidad directa**: Se pueden inyectar directamente como CSS
2. **Performance**: No requiere procesamiento adicional
3. **Simplicidad**: Fácil de validar y entender
4. **Debugging**: Fácil de inspeccionar y modificar

**Consecuencia**: Si un tema necesita valores dinámicos, debe usar variantes (futuro), no cálculos en tokens.

### 8.3. Por Qué Context Request Existe Pero No Se Usa Todavía

**Decisión**: `context_request` se resuelve pero los contextos NO se aplican a tokens todavía.

**Razones**:
1. **Preparación**: Preparar el sistema para variantes futuras
2. **Debugging**: Permitir inspeccionar contextos resueltos
3. **Validación**: Validar que el sistema de contextos funciona

**Estado**:
- ✅ `context_request` se define en el tema
- ✅ Context Resolver v1 resuelve contextos
- ✅ Contextos están en `_resolvedContexts`
- ❌ Tokens NO usan contextos todavía

**Futuro**: Cuando se implementen variantes, se usarán los contextos resueltos.

### 8.4. Rol Futuro de IA

**Decisión**: El contrato se diseñó pensando en generación de temas por IA (futuro).

**Capacidades futuras**:
- IA puede generar `ThemeDefinitionV1` completo
- IA puede validar contra el contrato
- IA puede sugerir variantes basadas en contextos
- IA puede optimizar tokens para accesibilidad

**Preparación**:
- Contrato es explícito y validable
- Estructura es predecible
- Metadata permite etiquetado para IA

**Estado**: No implementado todavía, pero el contrato está preparado.

---

## 9. VALIDACIÓN

### Validación en Publicación

Cuando un tema se publica, se valida contra `validateThemeDefinition()`:

1. ✅ Estructura básica (id, name, tokens)
2. ✅ Formato de id (slug válido)
3. ✅ Tokens completos (todas las variables del contrato)
4. ✅ Valores válidos (no null/undefined/vacío)
5. ⚠️ Warnings: campos opcionales mal formados

### Validación en Draft

En modo draft, se usa `validateThemeDefinitionDraft()`:

1. ✅ Solo errores críticos (estructura básica)
2. ⚠️ Warnings permitidos (campos opcionales)

### Relleno Automático

Si faltan tokens, se rellenan desde `CONTRACT_DEFAULT`:

1. Se detectan tokens faltantes
2. Se rellenan desde `CONTRACT_DEFAULT`
3. Se loguean warnings
4. El tema queda completo y válido

---

## 10. COMPATIBILIDAD LEGACY

### Mapeo de Campos

**Código existente** → **ThemeDefinitionV1**:

| Código | Contrato | Notas |
|--------|----------|-------|
| `key` | `id` | Mismo concepto, nombre diferente |
| `values` | `tokens` | Mismo concepto, nombre diferente |
| `definition_json` | Estructura completa | BD almacena `definition_json` completo |
| `meta.contractVersion` | `meta.contract_version` | Compatible (se normaliza) |

### Temas del Sistema

Los temas del sistema (`dark-classic`, `light-classic`, `admin-classic`) funcionan sin cambios:

- ✅ Se mapean a `ThemeDefinitionV1` internamente
- ✅ Se validan contra el contrato
- ✅ Se pueden usar con Context Resolver v1

### Temas de BD

Los temas almacenados en PostgreSQL funcionan:

- ✅ `definition_json` se valida contra `ThemeDefinitionV1`
- ✅ Se normaliza a estructura canónica
- ✅ Se puede publicar como versión

---

## 11. INTEGRACIÓN CON OTROS SISTEMAS

### Context Resolver v1

- **Input**: `context_request` del tema (opcional)
- **Output**: Contextos resueltos en `_resolvedContexts`
- **Estado**: Resuelto pero no aplicado todavía (Fase 2)

### Theme Resolver v1

- **Input**: `ThemeDefinitionV1` (o equivalente legacy)
- **Output**: `ThemeEffective` con tokens aplicados
- **Validación**: Valida tokens contra Theme Contract

### Theme Registry v1

- **Almacenamiento**: Temas del sistema + temas de BD
- **Formato**: `ThemeDefinitionV1` (o equivalente)
- **Cache**: Cache en memoria para performance

### Theme Studio v1

- **Creación**: UI para crear `ThemeDefinitionV1`
- **Validación**: Valida contra contrato antes de publicar
- **Preview**: Muestra tema antes de publicar

---

## 12. FUERA DE SCOPE

### NO Cubierto en v1

- ❌ Variantes condicionales (Fase 2)
- ❌ Tokens calculados (solo primitivos)
- ❌ Generación por IA (futuro)
- ❌ Temas dinámicos (solo estáticos)
- ❌ Herencia de temas (solo independientes)

### Cubierto en v1

- ✅ Estructura canónica
- ✅ Validación de tokens
- ✅ Context request (resuelto, no aplicado)
- ✅ Metadata opcional
- ✅ Compatibilidad legacy

---

## 13. REFERENCIAS

### Documentos Relacionados

- **Theme Contract v1**: `src/core/theme/theme-contract.js` (define variables CSS)
- **Theme Resolver v1**: `docs/THEME_CONTEXT_INTEGRATION_V1.md`
- **Context Resolver v1**: `docs/CONTEXT_RESOLVER_V1.md`
- **Context Snapshot v1**: `docs/CONTEXT_SNAPSHOT_V1.md`

### Código Relacionado

- **Validación**: `src/core/theme/theme-definition-contract.js`
- **Temas del Sistema**: `src/core/theme/system-themes.js`
- **Theme Registry**: `src/core/theme/theme-registry.js`
- **Theme Resolver**: `src/core/theme/theme-resolver.js`

---

**FIN DEL CONTRATO**

