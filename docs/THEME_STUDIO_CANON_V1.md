# THEME STUDIO CANON V1 — EDITOR CANÓNICO DE TEMAS
**AuriPortal · Editor Definitivo Basado en ThemeDefinitionV1 + Variants + Context Resolver**

**Fecha**: 2025-01-XX  
**Versión**: 1.0.0  
**Estado**: Implementado

---

## RESUMEN EJECUTIVO

**Theme Studio Canon v1** es el editor canónico y definitivo de temas para AuriPortal, gobernado por:
- ThemeDefinitionV1 (contrato canónico)
- Theme Variants v1 (variantes condicionales)
- Context Resolver v1 (resolución de contextos)

**Características**:
- ✅ Editor completo de tokens CSS
- ✅ Editor de variantes condicionales (DSL seguro)
- ✅ Preview con snapshot simulado
- ✅ Debug visible (contextos resueltos, variantes aplicadas)
- ✅ Validación en tiempo real
- ✅ Draft/Publish workflow
- ✅ Compatibilidad con system themes + DB themes

---

## 1. PROPÓSITO Y ALCANCE

### Objetivo

Permitir a los administradores crear y editar temas completos (tokens + variantes) de forma visual y segura, con preview inmediato y validación constante.

### Alcance v1

**Incluye**:
- ✅ Editor de tokens (todas las variables del Theme Contract v1)
- ✅ Editor de variantes (condiciones + overrides)
- ✅ Preview con snapshot simulado
- ✅ Debug visible (resolvedContexts, variantsDebug)
- ✅ Validación soft (warnings, no hard fail)
- ✅ Guardar draft
- ✅ Publicar versión

**Excluye** (v1):
- ❌ Editor visual de condiciones complejas (v1: formularios simples)
- ❌ Preview en tiempo real mientras editas (v1: botón Preview)
- ❌ Versionado avanzado (v1: básico)
- ❌ Temas compartidos/colaborativos (v1: single editor)

---

## 2. ENTIDADES

### ThemeDefinitionV1

**Contrato**: `docs/THEME_DEFINITION_V1.md`

**Estructura**:
- `id`: string (slug)
- `name`: string
- `tokens`: TokenMap (todas las variables del contrato)
- `variants?`: ThemeVariants (array de variantes)
- `meta?`: ThemeMeta
- `context_request?`: ContextRequest

### ThemeVariantCondition DSL

**Contrato**: `docs/THEME_VARIANTS_V1.md`

**Operadores permitidos**:
- `==`, `!=`: Igualdad
- `>`, `>=`, `<`, `<=`: Comparaciones numéricas
- `exists`: Existencia
- `all`, `any`, `not`: Lógica

### ThemeEffective Debug

**Metadata no-enumerable**:
- `_resolvedContexts`: Contextos resueltos
- `_variantsDebug`: { appliedVariants, warnings, evaluatedCount }

---

## 3. UX: FLUJO COMPLETO

### 3.1. Listado de Temas

**Panel izquierdo**:
- Búsqueda
- Lista de temas:
  - System themes (dark-classic, light-classic, auri-classic)
  - DB themes (drafts + published)
  - Badges: source (system/db), status (draft/published)
- Botón "Nuevo tema"

### 3.2. Editor de Tokens

**Tab "Tokens"**:
- Grid editable: variable → input
- Grupo por categorías:
  - Fondos principales
  - Fondos semánticos
  - Textos
  - Bordes
  - Acentos
  - Sombras
  - Gradientes
  - Badges
  - Inputs
  - Radios
- Botón "Reset a defaults"
- Warnings inline (si token inválido)

### 3.3. Editor de Variantes

**Tab "Variantes"**:
- Lista de variantes (drag-drop simple para orden)
- Cada variante:
  - Nombre (input)
  - Condición (editor visual):
    - Selector contexto
    - Operador (==, !=, >, >=, <, <=, exists)
    - Valor (input)
    - Bloques all/any/not (v1: 1 nivel)
  - Tokens override (solo partial)
- Botón "Añadir variante"
- Botón "Eliminar variante"

### 3.4. Editor de Meta

**Tab "Meta"**:
- `name`: input
- `description`: textarea
- `tags`: input (separado por comas)

### 3.5. Debug

**Tab "Debug"**:
- `resolvedContexts`: JSON view (read-only)
- `appliedVariants`: lista de variantes aplicadas
- `warnings`: lista de warnings
- Solo visible si hay preview ejecutado

### 3.6. Preview

**Panel derecho**:
- Selector escenario (chips):
  - Admin
  - Student Nivel 3
  - Student Nivel 10
  - Anonymous
  - Custom...
- Formulario snapshot sim (editable):
  - `identity.actorType`: select
  - `identity.actorId`: input
  - `student.nivelEfectivo`: input (number)
  - `environment.screen`: input
  - etc.
- Botón "Preview"
- Mini panel tokens clave:
  - `--bg-main`
  - `--text-primary`
  - `--accent-primary`
  - etc.
- Debug visible (si hay warnings/variantes aplicadas)

### 3.7. Acciones

**Footer**:
- Botón "Guardar draft"
- Botón "Validar"
- Botón "Publicar" (solo si validate ok)

---

## 4. COMPATIBILIDAD

### System Themes

- ✅ Se pueden visualizar (read-only)
- ✅ Se pueden duplicar como nuevo tema
- ❌ No se pueden editar directamente

### DB Themes

- ✅ Drafts: editables
- ✅ Published: read-only (pero se puede crear nueva versión)

---

## 5. FAIL-OPEN Y GUARDARRILES

### Fail-Open Absoluto

- ❌ NUNCA romper el admin
- ✅ Si algo falla → warning + fallback
- ✅ Validación soft (warnings, no hard fail)

### Guardarraíles

- ✅ Validación antes de guardar (soft)
- ✅ Validación antes de publicar (hard)
- ✅ No permitir publicar si hay errores críticos
- ✅ Permitir guardar draft con warnings

---

## 6. INTEGRACIÓN CON RUNTIME

### Sin Cambios Visuales por Defecto

- ✅ `admin-classic` no cambia
- ✅ Temas del sistema no cambian
- ✅ Solo nuevos temas o nuevas versiones afectan runtime

### Preview Local

- ✅ Preview usa snapshot simulado (no afecta runtime)
- ✅ (Opcional) "Apply in editor only" (localStorage) para admin

---

## 7. REFERENCIAS

### Documentos Relacionados

- **Theme Definition v1**: `docs/THEME_DEFINITION_V1.md`
- **Theme Variants v1**: `docs/THEME_VARIANTS_V1.md`
- **Context Resolver v1**: `docs/CONTEXT_RESOLVER_V1.md`
- **Theme Context Integration v1**: `docs/THEME_CONTEXT_INTEGRATION_V1.md`

### Código Relacionado

- **Theme Resolver**: `src/core/theme/theme-resolver.js`
- **Theme Variants Engine**: `src/core/theme/theme-variants-engine.js`
- **Theme Contract**: `src/core/theme/theme-contract.js`

---

**FIN DEL DOCUMENTO**
