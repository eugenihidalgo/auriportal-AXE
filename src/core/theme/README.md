# Theme Resolver v1 - AuriPortal

## Objetivo

El **Theme Resolver v1** es el motor único, puro y determinista de resolución de temas en AuriPortal. Garantiza que **siempre** se resuelva un tema completo y válido, sin importar el estado del sistema.

## Principios Fundamentales

### 1. Single Source of Truth
**Solo el resolver decide el tema.** Ningún otro código debe determinar qué tema usar. El resolver es la única fuente de verdad.

### 2. Función Pura
**Mismo input → mismo output.** El resolver es determinista: para los mismos parámetros de entrada, siempre devuelve el mismo resultado.

### 3. Fail-Open Absoluto
**El cliente nunca se rompe.** Si TODO falla, el resolver devuelve valores seguros de emergencia (`CONTRACT_DEFAULT`) que garantizan que la UI sea funcional.

### 4. Implementación Mínima e Incremental
**Solo lo esencial.** El resolver v1 incluye solo lo necesario para resolver temas básicos. No incluye automatizaciones, overrides parciales, event sourcing, caché, ni editor UI.

## Estructura de Archivos

```
src/core/theme/
├── theme-defaults.js    # Valores por defecto seguros y temas base
├── theme-contract.js    # Contrato canónico y validación
├── theme-resolver.js    # Resolver principal (motor de resolución)
└── README.md            # Esta documentación
```

## API del Resolver

### `resolveTheme({ student, session, systemState })`

Función principal que resuelve el tema efectivo.

**Parámetros:**
- `student` (Object|null): Objeto estudiante con `tema_preferido` (opcional)
- `session` (Object|null): Datos de sesión (reservado para futuro)
- `systemState` (Object|null): Estado del sistema (reservado para futuro)

**Retorna:**
- `ThemeEffective` (Object): Objeto completo con TODAS las variables del Theme Contract v1

**Ejemplo:**
```javascript
import { resolveTheme } from './theme/theme-resolver.js';

// Resolver tema para un estudiante
const themeEffective = resolveTheme({ 
  student: { tema_preferido: 'dark' } 
});

// themeEffective contiene todas las variables:
// {
//   '--bg-main': '#0a0e1a',
//   '--text-primary': '#f1f5f9',
//   ... (todas las variables del contrato)
// }
```

### Lógica de Resolución

El resolver sigue esta lógica (en orden de prioridad):

1. **Si `student.tema_preferido` existe y es válido** → usarlo
   - Mapea temas legacy ('dark'/'light') a temas del sistema ('dark-classic'/'light-classic')
   - Si es un tema del sistema válido, usarlo directamente
   - Si es desconocido, usar `system_default`

2. **Si no** → usar `system_default` ('dark-classic')

3. **Validar** que el tema tiene TODAS las variables del contrato

4. **Si faltan variables** → rellenar desde `CONTRACT_DEFAULT`

5. **Si algo falla** → fallback completo a `CONTRACT_DEFAULT` (fail-open absoluto)

### Funciones Auxiliares

#### `getThemeId(themeEffective)`
Obtiene el ID del tema legacy ('dark' o 'light') a partir del `ThemeEffective`. Útil para compatibilidad con código existente.

```javascript
import { resolveTheme, getThemeId } from './theme/theme-resolver.js';

const themeEffective = resolveTheme({ student: { tema_preferido: 'dark' } });
const themeId = getThemeId(themeEffective); // 'dark'
```

#### `getSystemThemeName(themeEffective)`
Obtiene el nombre del tema del sistema ('dark-classic', 'light-classic', etc.) a partir del `ThemeEffective`.

```javascript
import { resolveTheme, getSystemThemeName } from './theme/theme-resolver.js';

const themeEffective = resolveTheme({ student: { tema_preferido: 'dark' } });
const systemName = getSystemThemeName(themeEffective); // 'dark-classic'
```

## Theme Contract v1

El resolver garantiza que el `ThemeEffective` devuelto contiene **TODAS** las variables definidas en el Theme Contract v1.

### Variables del Contrato

El contrato incluye variables agrupadas por semántica:

- **Fondos**: `--bg-main`, `--bg-card`, `--bg-panel`, etc.
- **Textos**: `--text-primary`, `--text-secondary`, `--text-accent`, etc.
- **Bordes**: `--border-soft`, `--border-strong`, `--border-accent`, etc.
- **Acentos**: `--accent-primary`, `--accent-secondary`, `--accent-hover`, etc.
- **Sombras**: `--shadow-sm`, `--shadow-md`, `--shadow-lg`, etc.
- **Gradientes**: `--gradient-primary`, `--gradient-header`, `--aura-gradient`, etc.
- **Badges**: `--badge-bg-active`, `--badge-text-active`, etc.
- **Inputs**: `--input-bg`, `--input-border`, `--input-text`, etc.
- **Radios**: `--radius-sm`, `--radius-md`, `--radius-lg`, etc.

Ver `theme-contract.js` para la lista completa.

### Validación

El contrato valida que:
1. **Todas las variables requeridas existan** en el tema
2. **Ninguna variable sea null, undefined o vacía**

Si falta alguna variable, el resolver la rellena automáticamente desde `CONTRACT_DEFAULT`.

## Temas del Sistema

### Temas Base Disponibles

- **`light-classic`**: Tema claro (valores de `:root` en `theme-variables.css`)
- **`dark-classic`**: Tema oscuro (valores de `body.theme-dark` en `theme-variables.css`)

### Mapeo Legacy

Para compatibilidad con código existente, los temas legacy se mapean automáticamente:

- `'dark'` → `'dark-classic'`
- `'light'` → `'light-classic'`

## Valores por Defecto

### `CONTRACT_DEFAULT`

Valores mínimos seguros de emergencia. Se usan cuando TODO falla. Garantizan que la UI sea funcional incluso en el peor escenario.

Basados en tema claro con colores seguros y contrastados.

### `SYSTEM_DEFAULT`

Temas base predefinidos del sistema. Valores extraídos de `public/css/theme-variables.css`.

## Integración con `applyTheme()`

El resolver se integra con `applyTheme()` en `src/core/responses.js`:

```javascript
// applyTheme() usa internamente el resolver
export function applyTheme(html, student = null) {
  // Resolver tema efectivo
  const themeEffective = resolveTheme({ student });
  
  // Obtener ID legacy para compatibilidad
  const tema = getThemeId(themeEffective);
  
  // Aplicar tema al HTML (lógica existente)
  // ...
}
```

**Compatibilidad total:** `applyTheme()` mantiene la misma interfaz externa, pero internamente usa el resolver para garantizar resolución determinista.

## Casos de Uso

### Caso 1: Estudiante con tema preferido
```javascript
const student = { tema_preferido: 'dark' };
const themeEffective = resolveTheme({ student });
// Devuelve tema 'dark-classic' completo
```

### Caso 2: Estudiante sin tema preferido
```javascript
const student = { email: 'test@example.com' };
const themeEffective = resolveTheme({ student });
// Devuelve tema 'dark-classic' (system_default)
```

### Caso 3: Estudiante null
```javascript
const themeEffective = resolveTheme({ student: null });
// Devuelve tema 'dark-classic' (system_default)
```

### Caso 4: Tema desconocido
```javascript
const student = { tema_preferido: 'unknown-theme' };
const themeEffective = resolveTheme({ student });
// Devuelve tema 'dark-classic' (fallback a system_default)
```

### Caso 5: Error crítico
```javascript
// Si TODO falla (error en el resolver)
const themeEffective = resolveTheme({ student: null });
// Devuelve CONTRACT_DEFAULT (fail-open absoluto)
```

## Alcance del Resolver v1

### ✅ INCLUYE

- Resolver tema a partir de `student.tema_preferido`
- Fallback a `system_default` si no hay tema preferido
- Validación de que el tema tiene TODAS las variables
- Relleno automático de variables faltantes
- Fail-open absoluto con `CONTRACT_DEFAULT`
- Compatibilidad con temas legacy ('dark'/'light')
- Devolver `ThemeEffective` completo

### ❌ EXCLUYE (v1)

- Overrides parciales
- Automatizaciones
- Event sourcing
- Caché
- Editor UI
- ClickUp / SQLite
- Sistema de temas en BD (vendrá después)

## Testing

### Tests Mínimos Requeridos

1. **Resolver con `student.tema_preferido = 'dark'`**
   - Debe devolver tema 'dark-classic' completo

2. **Resolver con `student.tema_preferido = 'light'`**
   - Debe devolver tema 'light-classic' completo

3. **Resolver con `student.tema_preferido = null`**
   - Debe devolver tema 'dark-classic' (system_default)

4. **Resolver con `student = null`**
   - Debe devolver tema 'dark-classic' (system_default)

5. **Simular tema incompleto**
   - Debe rellenar variables faltantes desde `CONTRACT_DEFAULT`

6. **Simular error crítico**
   - Debe devolver `CONTRACT_DEFAULT` completo (fail-open)

## Reglas Absolutas

1. **No romper `renderHtml()`** - El resolver debe integrarse sin cambiar la UX actual
2. **No cambiar HTML** - Solo resuelve el tema, no modifica templates
3. **No tocar CSS** - Solo lee valores, no modifica archivos CSS
4. **No lanzar excepciones no capturadas** - Todo error debe manejarse con fail-open

## Referencias

- `public/css/theme-contract.css` - Contrato canónico de variables CSS
- `public/css/theme-variables.css` - Valores de variables para temas claro/oscuro
- `src/core/responses.js` - Función `applyTheme()` que usa el resolver
- `docs/THEME_CONTRACT.md` - Documentación del Theme Contract v1

## Evolución Futura

El resolver v1 es la base mínima. En el futuro se podrán añadir:

- Sistema de temas en BD
- Overrides parciales
- Automatizaciones
- Caché
- Editor UI

Pero el resolver v1 **siempre** será el motor de resolución base, garantizando que el sistema nunca se rompa.










