# THEME VARIANTS V1 — VARIANTES CONDICIONALES DE TEMAS
**AuriPortal · Sistema de Variantes Basadas en Contextos**

**Fecha**: 2025-01-XX  
**Versión**: 1.0.0  
**Estado**: Implementado (Runtime)

---

## RESUMEN EJECUTIVO

Las **Theme Variants v1** permiten que un tema aplique diferentes valores de tokens CSS según los contextos resueltos por el Context Resolver v1.

**Características**:
- ✅ Variantes condicionales basadas en contextos
- ✅ DSL de condiciones seguro (sin eval/Function)
- ✅ Fail-open absoluto (si falla → ignora variante, mantiene base)
- ✅ Determinismo (mismo input → mismo output)
- ✅ Compatibilidad legacy (sin variants → comportamiento igual)

---

## 1. DEFINICIÓN

### ¿Qué es una Variante?

Una **variante** es una regla condicional que aplica overrides de tokens CSS cuando se cumplen ciertas condiciones basadas en contextos resueltos.

**Características**:
- Define condiciones (`when`) basadas en contextos
- Define overrides de tokens (`tokens`) a aplicar si se cumple la condición
- Se evalúan en orden (primera que cumple se aplica)
- Pueden combinarse (varias variantes pueden aplicarse secuencialmente)

### ¿Qué NO es una Variante?

- ❌ NO es lógica de negocio
- ❌ NO ejecuta código JavaScript (sin eval/Function)
- ❌ NO accede a PostgreSQL directamente
- ❌ NO modifica estado del sistema
- ❌ NO permite expresiones arbitrarias

---

## 2. ESTRUCTURA CANÓNICA

### Interface TypeScript/JSDoc

```typescript
/**
 * ThemeVariants - Variantes condicionales del tema
 */
type ThemeVariants = ThemeVariant[];

/**
 * ThemeVariant - Una variante individual
 */
interface ThemeVariant {
  // Campos requeridos
  when: ThemeVariantCondition;    // Condición que debe cumplirse
  tokens: Partial<TokenMap>;       // Tokens a aplicar si se cumple (partial = solo overrides)
  
  // Campos opcionales
  name?: string;                   // Nombre descriptivo de la variante (para debug)
  order?: number;                  // Orden de evaluación (opcional, por defecto: índice en array)
}

/**
 * ThemeVariantCondition - Condición de la variante
 * DSL seguro sin eval/Function
 */
type ThemeVariantCondition =
  | SimpleCondition                    // Condición simple: { key: value }
  | ComparisonCondition                // Comparación: { key: { op: value } }
  | ExistsCondition                    // Existe: { key: { exists: true } }
  | LogicalCondition;                  // Lógica: { all: [...] } | { any: [...] } | { not: {...} }

/**
 * SimpleCondition - Comparación de igualdad
 */
interface SimpleCondition {
  [contextKey: string]: any;  // contextKey == value
}

/**
 * ComparisonCondition - Comparación con operadores
 */
interface ComparisonCondition {
  [contextKey: string]: {
    '=='?: any;
    '!='?: any;
    '>'?: number;
    '>='?: number;
    '<'?: number;
    '<='?: number;
    exists?: boolean;
  };
}

/**
 * LogicalCondition - Operadores lógicos
 */
interface LogicalCondition {
  all?: ThemeVariantCondition[];  // Todas las condiciones deben cumplirse
  any?: ThemeVariantCondition[];  // Al menos una condición debe cumplirse
  not?: ThemeVariantCondition;    // La condición NO debe cumplirse
}
```

### Ejemplo Completo

```json
{
  "id": "dynamic-theme",
  "name": "Dynamic Theme",
  "tokens": {
    "--bg-main": "#faf7f2",
    "--accent-primary": "#ffd86b"
  },
  "variants": [
    {
      "name": "Admin mode",
      "when": {
        "actor_type": "admin"
      },
      "tokens": {
        "--accent-primary": "#7c3aed",
        "--text-primary": "#f1f5f9"
      }
    },
    {
      "name": "High level student",
      "when": {
        "nivel_efectivo": {
          ">=": 10
        }
      },
      "tokens": {
        "--accent-primary": "#10b981",
        "--accent-secondary": "#059669"
      }
    },
    {
      "name": "Student with sidebar context",
      "when": {
        "all": [
          { "actor_type": "student" },
          { "sidebar_context": { "exists": true } }
        ]
      },
      "tokens": {
        "--bg-card": "#fff9e6"
      }
    }
  ]
}
```

---

## 3. DSL DE CONDICIONES

### 3.1. Simple Condition (Igualdad)

**Formato**: `{ key: value }`

**Significado**: El contexto `key` debe ser igual a `value`.

**Ejemplo**:
```json
{
  "when": {
    "actor_type": "admin"
  }
}
```

**Valores permitidos**:
- String, number, boolean, null
- NO arrays, NO objetos complejos

### 3.2. Comparison Condition (Comparaciones)

**Formato**: `{ key: { op: value } }`

**Operadores permitidos**:
- `==`: Igual (equivalente a simple condition)
- `!=`: Diferente
- `>`: Mayor que (solo números)
- `>=`: Mayor o igual (solo números)
- `<`: Menor que (solo números)
- `<=`: Menor o igual (solo números)
- `exists`: Existe (valor: `true` para existe, `false` para no existe)

**Ejemplos**:
```json
{
  "when": {
    "nivel_efectivo": {
      ">=": 10
    }
  }
}
```

```json
{
  "when": {
    "sidebar_context": {
      "exists": true
    }
  }
}
```

```json
{
  "when": {
    "actor_type": {
      "!=": "anonymous"
    }
  }
}
```

### 3.3. Logical Conditions (Lógica)

#### `all` - Todas las condiciones deben cumplirse

```json
{
  "when": {
    "all": [
      { "actor_type": "student" },
      { "nivel_efectivo": { ">=": 5 } }
    ]
  }
}
```

#### `any` - Al menos una condición debe cumplirse

```json
{
  "when": {
    "any": [
      { "actor_type": "admin" },
      { "actor_type": "system" }
    ]
  }
}
```

#### `not` - La condición NO debe cumplirse

```json
{
  "when": {
    "not": {
      "actor_type": "anonymous"
    }
  }
}
```

**Anidación**: `all`, `any`, `not` pueden anidarse:

```json
{
  "when": {
    "all": [
      { "actor_type": "student" },
      {
        "any": [
          { "nivel_efectivo": { ">=": 10 } },
          { "sidebar_context": "advanced" }
        ]
      }
    ]
  }
}
```

---

## 4. REGLAS DE EVALUACIÓN

### 4.1. Orden de Evaluación

Las variantes se evalúan **en orden** (según el array):

1. Se evalúa la primera variante
2. Si cumple la condición → se aplican sus tokens (override)
3. Se evalúa la segunda variante
4. Si cumple la condición → se aplican sus tokens (override sobre los anteriores)
5. Y así sucesivamente...

**Consecuencia**: La última variante que cumple tiene prioridad sobre las anteriores.

**Ejemplo**:
```json
{
  "variants": [
    {
      "when": { "actor_type": "admin" },
      "tokens": { "--accent-primary": "#7c3aed" }
    },
    {
      "when": { "nivel_efectivo": { ">=": 10 } },
      "tokens": { "--accent-primary": "#10b981" }
    }
  ]
}
```

Si `actor_type == "admin"` Y `nivel_efectivo >= 10`:
- Primera variante aplica: `--accent-primary: #7c3aed`
- Segunda variante aplica: `--accent-primary: #10b981` (sobrescribe)

Resultado final: `--accent-primary: #10b981`

### 4.2. Fail-Open Absoluto

**Regla**: Si una variante falla, se ignora y se continúa con la siguiente.

**Casos de fallo**:
- Condición inválida (formato incorrecto)
- Contexto inexistente (referencia a contexto que no está en `resolvedContexts`)
- Error interno del motor (excepción inesperada)

**Comportamiento**:
1. Se registra warning
2. Se ignora la variante
3. Se continúa con la siguiente variante
4. Si todas fallan → se mantiene tema base

### 4.3. Validación de Tokens

**Regla**: Solo se aplican tokens que están en el Theme Contract v1.

**Comportamiento**:
- Si un token no está en el contrato → warning + ignorado
- Si un token es null/undefined → warning + ignorado
- Solo tokens válidos se aplican

---

## 5. EJEMPLOS VÁLIDOS

### Ejemplo 1: Variante Simple

```json
{
  "variants": [
    {
      "name": "Admin accent",
      "when": {
        "actor_type": "admin"
      },
      "tokens": {
        "--accent-primary": "#7c3aed",
        "--accent-secondary": "#6366f1"
      }
    }
  ]
}
```

### Ejemplo 2: Variante con Comparación Numérica

```json
{
  "variants": [
    {
      "name": "High level colors",
      "when": {
        "nivel_efectivo": {
          ">=": 10
        }
      },
      "tokens": {
        "--accent-primary": "#10b981",
        "--text-accent": "#059669"
      }
    }
  ]
}
```

### Ejemplo 3: Variante con Exists

```json
{
  "variants": [
    {
      "name": "With sidebar",
      "when": {
        "sidebar_context": {
          "exists": true
        }
      },
      "tokens": {
        "--bg-card": "#fff9e6"
      }
    }
  ]
}
```

### Ejemplo 4: Variante con All

```json
{
  "variants": [
    {
      "name": "Advanced student",
      "when": {
        "all": [
          { "actor_type": "student" },
          { "nivel_efectivo": { ">=": 10 } }
        ]
      },
      "tokens": {
        "--accent-primary": "#10b981",
        "--bg-elevated": "#f0fdf4"
      }
    }
  ]
}
```

### Ejemplo 5: Variante con Any

```json
{
  "variants": [
    {
      "name": "Privileged users",
      "when": {
        "any": [
          { "actor_type": "admin" },
          { "actor_type": "system" }
        ]
      },
      "tokens": {
        "--accent-primary": "#7c3aed"
      }
    }
  ]
}
```

### Ejemplo 6: Variante con Not

```json
{
  "variants": [
    {
      "name": "Authenticated users",
      "when": {
        "not": {
          "actor_type": "anonymous"
        }
      },
      "tokens": {
        "--bg-main": "#faf7f2"
      }
    }
  ]
}
```

### Ejemplo 7: Múltiples Variantes (Orden Importante)

```json
{
  "variants": [
    {
      "name": "Base admin",
      "when": { "actor_type": "admin" },
      "tokens": { "--accent-primary": "#7c3aed" }
    },
    {
      "name": "High level override",
      "when": { "nivel_efectivo": { ">=": 10 } },
      "tokens": { "--accent-primary": "#10b981" }
    }
  ]
}
```

---

## 6. EJEMPLOS PROHIBIDOS

### ❌ Prohibido: Eval o Function

```json
{
  "variants": [
    {
      "when": "eval('actor_type === \"admin\"')",  // ❌ NO permitido
      "tokens": {}
    }
  ]
}
```

### ❌ Prohibido: Expresiones JavaScript

```json
{
  "variants": [
    {
      "when": {
        "nivel_efectivo": "> 10 && < 20"  // ❌ NO permitido
      },
      "tokens": {}
    }
  ]
}
```

### ❌ Prohibido: Tokens Fuera del Contrato

```json
{
  "variants": [
    {
      "when": { "actor_type": "admin" },
      "tokens": {
        "--custom-token": "#ffffff"  // ❌ NO permitido (no está en Theme Contract)
      }
    }
  ]
}
```

**Comportamiento**: Se ignora `--custom-token` con warning, pero la variante se aplica normalmente si la condición cumple.

### ❌ Prohibido: Condición con Estructura Inválida

```json
{
  "variants": [
    {
      "when": {
        "nivel_efectivo": {
          "invalid-op": 10  // ❌ Operador no reconocido
        }
      },
      "tokens": {}
    }
  ]
}
```

**Comportamiento**: Se ignora la variante con warning.

---

## 7. INTEGRACIÓN CON CONTEXT RESOLVER V1

### Flujo Completo

1. **Context Resolver v1** resuelve contextos → `resolvedContexts`
2. **Theme Variants Engine** evalúa condiciones usando `resolvedContexts`
3. **Theme Resolver** aplica overrides de tokens según variantes que cumplieron

### Ejemplo de Integración

```javascript
// En theme-resolver.js (después de resolver contextos)

const resolvedContexts = {
  actor_type: 'admin',
  nivel_efectivo: 12,
  sidebar_context: 'home'
};

// Si el tema tiene variants
if (themeDefinition.variants && resolvedContexts) {
  const result = applyThemeVariants({
    baseTokens: themeDefinition.values,
    variants: themeDefinition.variants,
    ctx: resolvedContexts,
    contract: CONTRACT_VARIABLES
  });
  
  // result.tokens = tokens con overrides aplicados
  // result.appliedVariants = ['variant-1', 'variant-2'] (nombres de variantes aplicadas)
  // result.warnings = [] (warnings si hubo)
}
```

---

## 8. REGLAS CONSTITUCIONALES

### 8.1. Presentación Pura

**Regla**: Las variantes son SOLO para presentación visual, NO para lógica de negocio.

**Prohibido**:
- ❌ Calcular valores desde PostgreSQL
- ❌ Ejecutar código JavaScript arbitrario
- ❌ Modificar estado del sistema
- ❌ Tomar decisiones de negocio (solo visuales)

**Permitido**:
- ✅ Evaluar condiciones basadas en contextos
- ✅ Aplicar overrides de tokens CSS
- ✅ Combinar condiciones con operadores lógicos

### 8.2. Fail-Open Absoluto

**Regla**: Si algo falla, se ignora y se continúa.

**Comportamiento**:
- Si condición inválida → warning + ignorar variante
- Si contexto inexistente → warning + condición false
- Si token inválido → warning + ignorar token
- Si error interno → warning + fallback a tokens base

**Nunca**:
- ❌ Lanzar excepción hacia arriba
- ❌ Romper el render
- ❌ Dejar tokens incompletos

### 8.3. Determinismo

**Regla**: Mismo input → mismo output.

**Garantías**:
- Orden de evaluación es estable (array order)
- Condiciones son deterministas (no hay random, no hay time)
- Overrides son deterministas (última variante gana)

### 8.4. Compatibilidad Legacy

**Regla**: Sin variants → comportamiento igual que antes.

**Comportamiento**:
- Si `variants` es undefined/null → no se evalúan variantes
- Si `resolvedContexts` es vacío → no se evalúan variantes
- Si no hay variantes aplicables → tokens base se mantienen

---

## 9. DEBUG Y OBSERVABILIDAD

### Metadata No-Enumerable

El `ThemeEffective` incluye metadata de debug (no-enumerable):

```javascript
Object.defineProperty(themeEffective, '_variantsDebug', {
  value: {
    appliedVariants: ['variant-1', 'variant-2'],  // Nombres de variantes aplicadas
    warnings: ['Context "x" not found'],            // Warnings generados
    evaluatedCount: 3                               // Número de variantes evaluadas
  },
  enumerable: false
});
```

**Uso**:
- Para debugging en desarrollo
- Para observabilidad en producción
- Para UI futura de Theme Studio

---

## 10. REFERENCIAS

### Documentos Relacionados

- **Theme Definition v1**: `docs/THEME_DEFINITION_V1.md`
- **Context Resolver v1**: `docs/CONTEXT_RESOLVER_V1.md`
- **Theme Context Integration v1**: `docs/THEME_CONTEXT_INTEGRATION_V1.md`

### Código Relacionado

- **Theme Variants Engine**: `src/core/theme/theme-variants-engine.js`
- **Theme Resolver**: `src/core/theme/theme-resolver.js`
- **Theme Contract**: `src/core/theme/theme-contract.js`

---

**FIN DEL DOCUMENTO**
