# Master UI Toast v1

**Fecha:** 2026-01-09  
**Versión:** 1.0.0  
**Dominio:** MASTER

---

## Descripción

Helper común para mostrar toasts no bloqueantes en la UI de MASTER. Elimina duplicación de código y asegura consistencia visual y de comportamiento.

---

## Ubicación

**Archivo:** `public/js/master/ui/toast.js`

**Registry:** `src/core/master/registry/master-layout-registry.v1.json`
- **ID:** `master-ui-toast`
- **Fase:** `core` (se carga antes de los clients UI)
- **Tipo:** `module`
- **Requerido:** `true`

---

## API

### `showToastSuccess(message)`

Muestra un toast de éxito (verde).

**Parámetros:**
- `message` (string): Mensaje a mostrar

**Comportamiento:**
- Color: Verde (`#10b981`)
- Duración: 2 segundos auto-dismiss
- Posición: Bottom-right
- Animación: Fade in/out suave

**Ejemplo:**
```javascript
showToastSuccess('✓ Item limpiado exitosamente');
```

---

### `showToastError(message)`

Muestra un toast de error (rojo).

**Parámetros:**
- `message` (string): Mensaje a mostrar

**Comportamiento:**
- Color: Rojo (`#ef4444`)
- Duración: 3 segundos auto-dismiss
- Posición: Bottom-right
- Animación: Fade in/out suave

**Ejemplo:**
```javascript
showToastError('Error limpiando item: ' + error.message);
```

---

## Reglas Canónicas

### 1. DOM API Only
- **PROHIBIDO**: `innerHTML` dinámico
- **PROHIBIDO**: Template literals con HTML
- **REQUERIDO**: `document.createElement`, `textContent`, `appendChild`

### 2. Queue Simple
- **Comportamiento**: Stacking vertical si hay múltiples toasts
- **Container**: `#ap-toast-container` (se crea al primer uso)
- **Z-index**: 10000 (siempre visible)

### 3. Auto-Dismiss
- **Success**: 2 segundos
- **Error**: 3 segundos
- **Fade out**: 300ms

### 4. Posición
- **Fixed**: `bottom: 1rem; right: 1rem`
- **Max-width**: 400px
- **Gap**: 0.5rem entre toasts

---

## Uso en Clients

### Alquimia General

**Archivo:** `public/js/master/master-alquimia-general-client.js`

```javascript
// Las funciones toast están disponibles globalmente
// No necesitan import (se cargan antes del client)

showToastSuccess(`Item incrementado para ${count} alumnos`);
showToastError(`Error: ${error.message}`);
```

### Alquimia Alumno

**Archivo:** `public/js/master/master-alquimia-alumno-client.js`

```javascript
// Las funciones toast están disponibles globalmente
// No necesitan import (se cargan antes del client)

showToastSuccess(`✓ ${item.item_nombre} marcado como revisado`);
showToastError('Error limpiando item: ' + error.message);
```

---

## Estilos CSS

Los estilos están inline (no CSS externo) para mantener el helper auto-contenido:

```css
/* Container */
position: fixed;
bottom: 1rem;
right: 1rem;
z-index: 10000;
display: flex;
flex-direction: column;
gap: 0.5rem;
max-width: 400px;
pointer-events: none;

/* Toast Success */
background: #10b981;
color: #fff;
padding: 0.75rem 1rem;
border-radius: 0.5rem;
box-shadow: 0 4px 6px rgba(0,0,0,0.1);
font-size: 0.875rem;
font-weight: 500;
pointer-events: auto;
opacity: 0;
transition: opacity 0.2s ease-in;

/* Toast Error */
background: #ef4444;
color: #fff;
padding: 0.75rem 1rem;
border-radius: 0.5rem;
box-shadow: 0 4px 6px rgba(0,0,0,0.1);
font-size: 0.875rem;
font-weight: 500;
pointer-events: auto;
opacity: 0;
transition: opacity 0.2s ease-in;
```

---

## Inicialización

El helper se inicializa automáticamente al cargar el script:

1. Verifica contexto MASTER (`window.__AP_CONTEXT__ === 'MASTER'`)
2. Log de inicialización: `[MASTER][UI][TOAST] Helper inicializado`
3. Container se crea lazy (al primer uso)

---

## Verificación

### Tests
- **Test**: `scripts/test-contrato-limpieza-v1.js` verifica ausencia de `confirm()` y `alert()` en funciones de limpieza

### Manual
1. Abrir consola del navegador
2. Verificar log: `[MASTER][UI][TOAST] Helper inicializado`
3. Ejecutar acción de limpieza
4. Verificar toast aparece en bottom-right
5. Verificar auto-dismiss después de 2-3 segundos

---

## Referencias

- [Alquimia Cierre Total v5.65.2](./ALQUIMIA_CIERRE_TOTAL_V5_65_2.md)
- Master Layout Registry: `src/core/master/registry/master-layout-registry.v1.json`