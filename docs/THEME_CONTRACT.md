# Theme Contract v1 - AuriPortal

## Objetivo

Establecer un contrato canónico para el sistema de temas, garantizando que:
1. **NO se usen colores directos** en HTML/JS
2. **TODOS los colores** vengan de variables CSS
3. **Cambios de tema** se reflejen consistentemente
4. **Modo oscuro** funcione sin parpadeos

## Estructura de Archivos CSS

El sistema de temas está organizado en 3 archivos CSS que se cargan en este orden:

1. **`theme-contract.css`** - Contrato canónico (declara variables, sin valores)
2. **`theme-variables.css`** - Define valores de variables para tema claro/oscuro
3. **`theme-overrides.css`** - Aplica estilos específicos usando las variables

### Orden de Carga

```html
<link rel="stylesheet" href="/css/theme-contract.css" />
<link rel="stylesheet" href="/css/theme-variables.css" />
<link rel="stylesheet" href="/css/theme-overrides.css" />
```

Este orden es **crítico** y se aplica automáticamente por `applyTheme()`.

## Variables Canónicas

Todas las variables están documentadas en `public/css/theme-contract.css`. Están agrupadas por semántica:

- **Fondos**: `--bg-main`, `--bg-card`, `--bg-panel`, etc.
- **Textos**: `--text-primary`, `--text-secondary`, `--text-accent`, etc.
- **Bordes**: `--border-soft`, `--border-strong`, `--border-accent`, etc.
- **Acentos**: `--accent-primary`, `--accent-secondary`, `--accent-hover`, etc.
- **Sombras**: `--shadow-sm`, `--shadow-md`, `--shadow-lg`, etc.
- **Gradientes**: `--gradient-primary`, `--gradient-hover`, etc.
- **Radios**: `--radius-sm`, `--radius-md`, `--radius-lg`, etc.

## Reglas Absolutas

### ❌ PROHIBIDO

1. **Colores directos en HTML/JS:**
   ```html
   <!-- ❌ MAL -->
   <div style="background: #fff; color: black;">
   <div style="background: rgb(255, 255, 255);">
   ```

2. **Atributos `style` inline:**
   ```html
   <!-- ❌ MAL -->
   <div style="color: var(--text-primary);">
   ```

3. **Tags `<style>` en HTML:**
   ```html
   <!-- ❌ MAL -->
   <style>
     .mi-clase { color: #fff; }
   </style>
   ```

4. **Colores hardcodeados en JavaScript:**
   ```javascript
   // ❌ MAL
   element.style.backgroundColor = '#fff';
   element.style.color = 'black';
   ```

### ✅ PERMITIDO

1. **Variables CSS en HTML:**
   ```html
   <!-- ✅ BIEN -->
   <div style="background: var(--bg-card); color: var(--text-primary);">
   ```

2. **Clases CSS con variables:**
   ```css
   /* ✅ BIEN */
   .mi-clase {
     background: var(--bg-card);
     color: var(--text-primary);
   }
   ```

3. **Clases CSS en JavaScript:**
   ```javascript
   // ✅ BIEN
   element.classList.add('mi-clase');
   ```

## Excepciones (Whitelist)

Algunos casos están permitidos:

1. **Meta `theme-color`** (necesario para navegadores):
   ```html
   <meta name="theme-color" content="#ffd86b" />
   ```

2. **URLs de imágenes externas:**
   ```html
   <img src="https://example.com/image.jpg" />
   ```

3. **Comentarios en código:**
   ```html
   <!-- Este comentario puede tener #fff -->
   ```

## Linter de Hardcodes

Se incluye un linter para detectar violaciones:

```bash
# Modo CI (falla si encuentra violaciones)
node scripts/lint-theme-hardcodes.js

# Modo advertencia (no falla)
node scripts/lint-theme-hardcodes.js --warn
```

### Qué Detecta

- Colores hex (`#fff`, `#ffffff`)
- Colores RGB/RGBA (`rgb(255, 255, 255)`)
- Colores HSL/HSLA (`hsl(0, 0%, 100%)`)
- Nombres de color (`white`, `black`, `red`, etc.)
- Atributos `style` inline
- Tags `<style>` en HTML

### Archivos Escaneados

- `src/core/html/**/*.html`
- `src/endpoints/**/*.js`
- `public/js/**/*.js`

### Archivos Excluidos

- `node_modules/**`
- `**/*.db`
- `logs/**`
- `**/*.md`
- `public/css/theme-variables.css` (este archivo SÍ puede tener colores)
- `public/css/theme-overrides.css` (este archivo SÍ puede tener colores)

## Aplicación de Tema

El tema se aplica automáticamente por `applyTheme()` en `src/core/responses.js`:

```javascript
import { applyTheme } from './responses.js';

// Aplicar tema a HTML
const htmlConTema = applyTheme(html, student);
```

### Qué Hace `applyTheme()`

1. **Determina el tema** del estudiante (o usa 'dark' por defecto)
2. **Añade `data-theme`** al tag `<html>`
3. **Añade clase `theme-dark`** al `<body>` si es tema oscuro
4. **Inyecta CSS** en orden correcto si no existen:
   - `theme-contract.css`
   - `theme-variables.css`
   - `theme-overrides.css`
5. **Añade script inline** para evitar parpadeo de tema

### Render Único

**TODAS las pantallas cliente deben pasar por `renderHtml()`:**

```javascript
import { renderHtml } from './html-response.js';

// ✅ BIEN
return renderHtml(html, { student });

// ❌ MAL (bypass de renderHtml)
return new Response(html, { headers: {...} });
```

## Modo Oscuro

El modo oscuro se activa con la clase `theme-dark` en el `<body>`:

```html
<body class="theme-dark">
```

Las variables CSS se redefinen en `theme-variables.css`:

```css
body.theme-dark {
  --bg-main: #0a0e1a;
  --text-primary: #f1f5f9;
  /* ... */
}
```

## Migración Incremental

Si encuentras hardcodes existentes:

1. **Identificar** el color usado
2. **Buscar** variable equivalente en `theme-contract.css`
3. **Reemplazar** hardcode por variable
4. **Verificar** que funciona en modo claro y oscuro
5. **Ejecutar linter** para confirmar

### Ejemplo de Migración

```html
<!-- ANTES -->
<div style="background: #fff; color: #333;">

<!-- DESPUÉS -->
<div style="background: var(--bg-card); color: var(--text-primary);">
```

O mejor aún, usar clases CSS:

```html
<!-- MEJOR -->
<div class="card">
```

```css
.card {
  background: var(--bg-card);
  color: var(--text-primary);
}
```

## Testing

### Verificación Manual

1. **Cambiar una variable** en `theme-contract.css` o `theme-variables.css`
2. **Verificar** que cambia en 3 pantallas clave:
   - Pantalla 1 (racha)
   - Pantalla 2 (práctica)
   - Ejecución de práctica
3. **Cambiar a modo oscuro** y verificar sin parpadeo
4. **Ejecutar linter** y verificar que detecta hardcodes

### Checklist de Verificación

- [ ] Cambiar `--bg-card` y ver que cambia en todas las cards
- [ ] Cambiar `--text-primary` y ver que cambia en todos los textos
- [ ] Activar modo oscuro y verificar sin parpadeo
- [ ] Ejecutar `node scripts/lint-theme-hardcodes.js` y verificar que no hay violaciones
- [ ] Añadir un `#fff` en un template y verificar que el linter lo detecta

## Referencias

- `public/css/theme-contract.css` - Contrato canónico
- `public/css/theme-variables.css` - Valores de variables
- `public/css/theme-overrides.css` - Estilos específicos
- `src/core/responses.js` - Función `applyTheme()`
- `src/core/html-response.js` - Función `renderHtml()`
- `scripts/lint-theme-hardcodes.js` - Linter de hardcodes










