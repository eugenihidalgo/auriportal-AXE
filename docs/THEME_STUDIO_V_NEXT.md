# Theme Studio vNext - Registry-Driven Architecture

**Fecha**: 2025-01-XX  
**Versión**: 1.0.0  
**Estado**: Implementado

---

## RESUMEN EJECUTIVO

Theme Studio vNext es una reestructuración completa del Theme Studio Canon para que sea **extensible, vivo y controlado por registry**, capaz de soportar nuevas funcionalidades (widgets, componentes, capacidades visuales) sin modificar el editor manualmente.

**Principio Constitucional Fundamental**:
> Un tema NO conoce widgets concretos.  
> Un tema conoce **CAPACIDADES VISUALES** registradas.

---

## ARQUITECTURA

### 1. Theme Capability Registry

El **Theme Capability Registry** (`src/core/theme/theme-capability-registry.js`) es la fuente de verdad sobre qué tokens existen y cómo se usan.

#### Estructura de una Capability

```javascript
{
  capability_key: 'buttons',           // ID único
  version: '1.0.0',                    // Versión semver
  category: 'inputs',                  // Categoría (base-ui, inputs, widgets, etc.)
  name: 'Botones',                     // Nombre legible
  description: 'Estilos para botones', // Descripción
  tokens: [                            // Lista de tokens
    {
      key: '--ap-btn-primary-bg',      // Clave CSS
      type: 'color',                   // Tipo (color, size, spacing, shadow)
      default: 'var(--ap-accent-primary)', // Valor por defecto
      description: 'Fondo del botón primario',
      aliases: ['--btn-primary-bg']    // Aliases opcionales
    }
  ],
  preview: null                         // Función de preview (opcional)
}
```

#### Capabilities Iniciales

1. **base-ui**: Fundamentos visuales (colores base, tipografía, espacios)
2. **accent-colors**: Colores de acento (primary, secondary, success, warning, danger, info)
3. **buttons**: Estilos para botones
4. **inputs**: Campos de entrada
5. **cards**: Tarjetas y paneles

#### API del Registry

```javascript
// Obtener todas las capabilities
getThemeCapabilities()

// Obtener por categoría
getThemeCapabilitiesByCategory('inputs')

// Obtener capability específica
getThemeCapability('buttons')

// Obtener todos los tokens (resuelve aliases)
getAllThemeTokens()

// Validar ThemeDefinition contra registry
validateThemeDefinitionRegistry(themeDefinition)

// Registrar nueva capability (extensión dinámica)
registerThemeCapability(newCapability)

// Obtener schema JSON (para IA)
getThemeDefinitionSchema()
```

### 2. Theme Studio UI Dinámica

El Theme Studio genera la UI **completamente desde el registry**. No hay hardcoding.

#### Flujo de Renderizado

1. **Carga del Registry**: `loadCapabilities()` carga el registry al inicializar
2. **Renderizado por Capability**: `renderTokensTab()` agrupa tokens por capability
3. **Inputs Dinámicos**: Genera inputs según tipo (color picker + text para colores)
4. **Hot Reload**: Cambios en tokens actualizan iframe en tiempo real

#### Características

- **Secciones agrupadas**: Cada capability tiene su propia sección
- **Headers informativos**: Nombre y descripción de cada capability
- **Inputs según tipo**: 
  - `color`: Color picker + input de texto sincronizados
  - `text`: Input de texto normal
  - `size`: Input de texto (validación opcional)
- **Descripciones visibles**: Cada token muestra su descripción
- **Fallback compatible**: Si el registry no carga, renderiza tokens existentes

### 3. Playground con Iframe Aislado

El playground usa un **iframe aislado con sandbox** para renderizar componentes con tokens CSS.

#### Características

- **Aislamiento**: Sandbox `allow-same-origin allow-scripts`
- **Inyección de CSS Variables**: Tokens aplicados como `:root { --token: value; }`
- **Render por Capability**: Componentes renderizados según capabilities
- **Hot Reload**: Actualización de CSS variables sin re-renderizar completo
- **Fail-Open**: Si iframe falla, usa playground antiguo como fallback

#### HTML Generado

El iframe contiene:
- CSS variables en `:root` desde tokens
- Estilos base para componentes
- Componentes renderizados por capability
- Estructura semántica y accesible

### 4. Hot Reload

**Principio**: Cambios en tokens actualizan el preview **en tiempo real** sin re-renderizar completo.

#### Implementación

```javascript
// Actualización en tiempo real (hot reload)
updatePlaygroundTokens(iframe, tokens);

// Re-renderizado completo (fallback)
renderPlaygroundIframe(iframe, tokens, capabilities);
```

#### Flujo

1. Usuario edita token → `input.onchange`
2. Token actualizado en `currentThemeDraft.tokens`
3. Si estamos en tab Preview → `updatePlaygroundTokensHot()`
4. Actualiza CSS variables en iframe → Cambio visual inmediato

### 5. Fail-Open y Compatibilidad

#### Fail-Open Absoluto

- **Registry no carga**: UI funciona con fallback (tokens existentes)
- **Capability no existe**: Se ignora sin romper
- **Iframe falla**: Usa playground antiguo
- **Hot reload falla**: Re-renderiza completamente
- **Temas antiguos**: Funcionan sin registry

#### Compatibilidad

- **Temas sin registry**: Se renderizan normalmente
- **Tokens desconocidos**: Warning pero no error
- **Aliases**: Se resuelven automáticamente
- **Valores faltantes**: Se usan defaults del registry

---

## EXTENSIBILIDAD

### Añadir Nueva Capability

**Sin modificar el editor**:

```javascript
import { registerThemeCapability } from '../core/theme/theme-capability-registry.js';

registerThemeCapability({
  capability_key: 'reloj',
  version: '1.0.0',
  category: 'widgets',
  name: 'Reloj',
  description: 'Estilos para componente reloj',
  tokens: [
    {
      key: '--ap-clock-bg',
      type: 'color',
      default: '#ffffff',
      description: 'Fondo del reloj'
    }
  ]
});
```

El editor **automáticamente**:
- Carga la nueva capability
- Crea sección "Reloj" en la UI
- Genera inputs para `--ap-clock-bg`
- Renderiza preview en playground

### Añadir Nuevo Tipo de Input

Modificar `renderTokensTab()` para detectar el nuevo tipo y generar el input apropiado.

---

## API ENDPOINTS

### GET /admin/api/theme-studio-canon/capabilities

Devuelve el registry completo.

**Response**:
```json
{
  "ok": true,
  "capabilities": [...],
  "allTokens": [...],
  "schema": {...}
}
```

---

## VALIDACIÓN

### validateThemeDefinitionRegistry()

Valida una ThemeDefinition contra el registry.

**Reglas**:
- Tokens desconocidos → **Warning** (no error)
- Valores inválidos por tipo → **Warning**
- Estructura básica → **Error** si falta

**Resultado**:
```javascript
{
  valid: boolean,
  errors: Array<string>,
  warnings: Array<string>
}
```

---

## SCHEMA JSON PARA IA

### getThemeDefinitionSchema()

Genera schema JSON canónico compatible con JSON Schema v7.

**Uso**: Preparado para generación automática de temas por IA.

---

## CASOS DE USO

### 1. Usuario Edita Token

1. Usuario cambia `--ap-accent-primary` en input
2. `input.onchange` → `updatePlaygroundTokensHot()`
3. CSS variable actualizada en iframe
4. Botones cambian de color **inmediatamente**

### 2. Usuario Crea Nuevo Tema

1. Usuario crea tema sin tokens
2. Registry se carga
3. UI muestra todas las capabilities con defaults
4. Usuario edita tokens
5. Preview actualiza en tiempo real

### 3. Añadir Widget "Reloj"

1. Desarrollador registra capability "reloj"
2. Editor detecta automáticamente
3. Nueva sección "Reloj" aparece en UI
4. Preview renderiza componente reloj
5. **Sin modificar el editor**

---

## PRINCIPIOS DE DISEÑO

1. **Nada hardcodeado**: Todo viene del registry
2. **Extensible**: Nuevas capabilities sin cambios en editor
3. **Fail-open**: Errores no rompen el sistema
4. **Compatible**: Temas antiguos funcionan
5. **Vivo**: Cambios en tiempo real
6. **Preparado para IA**: Schema JSON disponible

---

## MIGRACIÓN

### Temas Existentes

Los temas existentes **funcionan sin cambios**:
- Tokens sin `--ap-` prefix funcionan (aliases)
- Tokens desconocidos generan warnings (no errores)
- Valores faltantes usan defaults del registry

### Desarrolladores

Para añadir nuevas capabilities:
1. Registrar en registry (o usar `registerThemeCapability()`)
2. El editor las detecta automáticamente
3. No requiere cambios en UI

---

## PRÓXIMOS PASOS

1. **Más Capabilities**: Añadir más capabilities (widgets, layouts, etc.)
2. **Preview Personalizado**: Permitir preview functions por capability
3. **Validación de Tipos**: Validación estricta de valores por tipo
4. **Generación por IA**: Integrar con IA para generar temas
5. **Export/Import**: Exportar/importar temas como JSON

---

## REFERENCIAS

- `src/core/theme/theme-capability-registry.js` - Registry canónico
- `src/endpoints/admin-theme-studio-canon-api.js` - API endpoints
- `public/js/admin/theme-studio-canon.js` - UI del editor
- `public/js/admin/theme-playground-iframe.js` - Playground con iframe
- `docs/THEME_DEFINITION_V1.md` - Contrato de temas
- `docs/THEME_STUDIO_CANON_V1.md` - Documentación del editor

---

**Última actualización**: 2025-01-XX  
**Versión**: 1.0.0

