# MASTER SIDEBAR CSS - Contrato Canónico v1

## Objetivo

Este documento define el contrato canónico para el CSS del Sidebar Master, garantizando que CSS NUNCA inyecte contenido textual desde data-attributes o identificadores internos.

## Contrato: CSS NO Inyecta Contenido Textual

### Regla Absoluta

**CSS NO introduce contenido textual en el sidebar**
- CSS solo define estilos visuales (colores, espaciados, layout)
- CSS NO usa `content: attr()` para leer data-attributes
- CSS NO renderiza identificadores internos como texto visible
- CSS NO concatena icon ids con labels

### Prohibiciones Absolutas

❌ **PROHIBIDO**: Usar `content: attr()` para inyectar texto
```css
/* ❌ INCORRECTO */
.master-sidebar-icon::before {
  content: attr(data-icon-id);  /* NUNCA hacer esto */
}
```

❌ **PROHIBIDO**: Inyectar texto desde data-attributes
```css
/* ❌ INCORRECTO */
.master-sidebar-item::before {
  content: attr(data-icon);  /* NUNCA hacer esto */
}
```

❌ **PROHIBO**: Renderizar icon ids como texto
```css
/* ❌ INCORRECTO */
.master-sidebar-icon {
  content: attr(data-icon-id);  /* NUNCA hacer esto */
}
```

### Obligaciones

✅ **OBLIGATORIO**: CSS solo define estilos visuales
```css
/* ✅ CORRECTO */
.master-sidebar-icon {
  margin-right: 0.875rem;
  width: 1.375rem;
  text-align: center;
  font-size: 1.125rem;
  flex-shrink: 0;
}
```

✅ **OBLIGATORIO**: Pseudo-elementos solo para decoración visual
```css
/* ✅ CORRECTO - Decoración visual, NO texto */
.master-sidebar-header::after {
  content: '';  /* Línea decorativa, NO texto */
  position: absolute;
  height: 1px;
  background: linear-gradient(...);
}
```

✅ **OBLIGATORIO**: Iconos ocultos deben permanecer ocultos
```css
/* ✅ CORRECTO */
.master-sidebar-icon[style*="display: none"] {
  display: none !important;
}
```

✅ **OBLIGATORIO**: Prevenir inyección de contenido en pseudo-elementos
```css
/* ✅ CORRECTO */
.master-sidebar-icon::before,
.master-sidebar-icon::after {
  content: none !important;
}
```

## Reglas CSS Canónicas

### Icon Container

```css
/* CONTRATO CSS: Icon solo renderiza contenido explícito del DOM
 * PROHIBIDO: CSS NO inyecta texto desde data-attributes
 * PROHIBIDO: CSS NO usa content: attr() para iconos
 * OBLIGATORIO: Icon solo muestra texto si JS lo crea explícitamente
 */
.master-sidebar-icon {
  margin-right: 0.875rem;
  width: 1.375rem;
  text-align: center;
  font-size: 1.125rem;
  flex-shrink: 0;
}

/* Asegurar que iconos ocultos NO se muestren */
.master-sidebar-icon[style*="display: none"],
.master-sidebar-icon[style*="display:none"] {
  display: none !important;
}

/* PROHIBIDO: CSS NO inyecta contenido textual en iconos */
.master-sidebar-icon::before,
.master-sidebar-icon::after {
  content: none !important;
}

/* PROHIBIDO: CSS NO lee data-attributes para renderizar texto */
.master-sidebar-icon[data-icon-id]::before,
.master-sidebar-icon[data-icon-id]::after {
  content: none !important;
}
```

### Pseudo-elementos Decorativos

Los únicos pseudo-elementos permitidos son decorativos (líneas, barras visuales):

```css
/* Línea decorativa bajo header - NO inyecta texto */
.master-sidebar-header::after {
  content: '';  /* Vacío, solo decoración visual */
  position: absolute;
  height: 1px;
  background: linear-gradient(...);
}

/* Barra lateral dorada para items activos - NO inyecta texto */
.master-sidebar-item.active::before {
  content: '';  /* Vacío, solo decoración visual */
  position: absolute;
  width: 3px;
  background: #fbbf24;
}
```

## Fuentes de Contenido Textual

### ÚNICAS Fuentes Válidas

1. **DOM explícito creado por JS**
   - El cliente JS (`master-sidebar-client.js`) crea nodos DOM
   - `label.textContent = entry.label` (texto del registry)
   - `icon.textContent = entry.icon` (solo si es emoji/símbolo)

2. **Registry como Source of Truth**
   - `entry.label` es el único texto visible
   - `entry.icon` es identificador interno, no visible si es texto plano

### PROHIBIDO

- CSS usando `content: attr(data-*)`
- CSS usando `content: "texto"`
- CSS concatenando valores de data-attributes
- CSS renderizando icon ids como texto

## Verificación

### Checklist de Auditoría CSS

Al añadir o modificar CSS del sidebar, verificar:

- [ ] NO hay `content: attr(...)` en reglas del sidebar
- [ ] NO hay `content: "texto"` en reglas del sidebar
- [ ] Pseudo-elementos solo usan `content: ''` (decoración)
- [ ] Iconos ocultos tienen `display: none !important`
- [ ] Pseudo-elementos de iconos tienen `content: none !important`

### Búsqueda de Patrones Prohibidos

```bash
# Buscar uso de attr() en CSS
grep -r "attr(" src/core/master/

# Buscar content con texto
grep -r 'content:.*"' src/core/master/

# Buscar data-attributes en CSS
grep -r "data-icon" src/core/master/
```

## Ejemplos de Verificación Visual

El sidebar debe mostrar SOLO:
- ✅ "Trabajos PDE"
- ✅ "Alquimia General"
- ✅ "Lugares"
- ✅ "Notas (Source of Truth)"

El sidebar NO debe mostrar:
- ❌ "workTrabajos PDE" (icon id concatenado)
- ❌ "alchemyAlquimia General" (icon id concatenado)
- ❌ "placesLugares" (icon id concatenado)

## Referencias

- **Layout**: `src/core/master/layout/master-layout-v1.html`
- **Cliente JS**: `public/js/master/master-sidebar-client.js`
- **Registry**: `src/core/master/registry/master-sidebar-registry.js`
- **Contrato Registry**: `docs/MASTER_SIDEBAR_REGISTRY_CONTRACT.md`

## Versión

- **v1**: Contrato inicial canónico
- **Fecha**: 2024
- **Estado**: Activo
