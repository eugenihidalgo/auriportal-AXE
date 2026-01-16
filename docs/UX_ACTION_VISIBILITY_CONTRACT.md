# UX ACTION VISIBILITY CONTRACT v1

**Versión**: 1.0.0  
**Fecha**: 2025-01-XX  
**Dominio**: MASTER  
**Componente**: Alquimia General

---

## 📋 RESUMEN EJECUTIVO

Este contrato define las reglas de visibilidad para acciones UX en Alquimia General. Las acciones deben tener visibilidad explícita por `surface_id`, `view_mode`, `scope` e `item_kind`.

---

## 🎯 REGLAS CONSTITUCIONALES

### Regla 1: Visibilidad Declarativa

**TODA acción UX debe declarar explícitamente su visibilidad** por:

- `surface_id`: Superficie donde se renderiza (`alquimia.list_projection`, `alquimia.items`, etc.)
- `view_mode`: Modo de vista (`'proyeccion'` | `'operativa'`)
- `scope`: Contexto de la proyección (`'all'` | `'student'`)
- `item_kind`: Tipo de item (`'recurrente'` | `'una_vez'`)

**PROHIBIDO**: Mostrar acciones sin validar visibilidad explícita.

### Regla 2: Validación en UI

**TODA UI que renderiza acciones debe validar visibilidad** antes de mostrar botones:

```javascript
// ✅ CORRECTO
if (state.projection.scope === 'all' && 
    state.projection.mode === 'proyeccion' && 
    itemKind === 'recurrente') {
  // Renderizar botón
}

// ❌ INCORRECTO
if (state.projection.scope === 'all') {
  // Renderizar botón (falta validar view_mode e item_kind)
}
```

---

## 📐 CONTRATOS POR ACCIÓN

### Acción: `alquimia.reset.item.all`

**Visibilidad**:
- `surface_id`: `['alquimia.list_projection']`
- `view_mode`: `['proyeccion']`
- `scope`: `['all']`
- `item_kind`: `['recurrente']`

**Descripción**: Resetear progreso de item para TODOS los estudiantes (solo recurrente, solo en proyección).

**Validación en UI**:
```javascript
if (state.projection.scope === 'all' && 
    state.projection.mode === 'proyeccion' && 
    itemKind === 'recurrente') {
  // Renderizar botón "Reset ALL"
}
```

### Acción: `alquimia.reset.list.all`

**Visibilidad**:
- `surface_id`: `['alquimia.list_projection']`
- `view_mode`: `['proyeccion']`
- `scope`: `['all']`
- `item_kind`: `['recurrente']`

**Descripción**: Resetear progreso de lista completa para TODOS los estudiantes (solo recurrente, solo en proyección).

**Validación en UI**:
```javascript
if (state.projection.scope === 'all' && 
    state.projection.mode === 'proyeccion' && 
    itemKind === 'recurrente') {
  // Renderizar botón "Reset lista ALL"
}
```

### Acción: `alquimia.reset.item` (scope='student')

**Visibilidad**:
- `surface_id`: `['alquimia.items', 'alquimia.megalist']`
- `view_mode`: `['proyeccion', 'operativa']`
- `scope`: `['student']`
- `item_kind`: `['recurrente']`

**Descripción**: Resetear progreso de item para un estudiante específico (solo recurrente).

**Validación en UI**:
```javascript
if (state.projection.scope === 'student' && 
    itemKind === 'recurrente') {
  // Renderizar botón "Reset progreso"
}
```

---

## 🚫 PROHIBICIONES

### Prohibido 1: Mostrar reset ALL en OPERATIVA

**REGLA**: Reset ALL (`reset.item.all`, `reset.list.all`) **NUNCA** debe aparecer en modo OPERATIVA.

**RAZÓN**: Reset ALL es una acción masiva que solo tiene sentido en PROYECCIÓN (vista agregada).

### Prohibido 2: Mostrar reset ALL en scope='student'

**REGLA**: Reset ALL **NUNCA** debe aparecer cuando `scope='student'`.

**RAZÓN**: Reset ALL es para TODOS los estudiantes, no para un estudiante específico.

### Prohibido 3: Mostrar reset ALL en una_vez

**REGLA**: Reset ALL **NUNCA** debe aparecer cuando `item_kind='una_vez'`.

**RAZÓN**: Reset ALL solo aplica a items `recurrente` (según contrato canónico).

---

## ✅ VERIFICACIÓN

### Assembly Check

```bash
# Verificar que no hay acciones sin visibilidad explícita
npm run check:ux-action-registry
```

### Tests Manuales

1. Cambiar a modo OPERATIVA + scope='all' + recurrente
2. **VERIFICAR**: Botones reset ALL **NO** aparecen
3. Cambiar a modo PROYECCIÓN + scope='all' + recurrente
4. **VERIFICAR**: Botones reset ALL **SÍ** aparecen

---

## 📚 REFERENCIAS

- `docs/DIAGNOSTICO_CONTRATOS_ROTOS_ALQUIMIA_GENERAL_V2.md` (diagnóstico inicial)
- `public/js/master/ux/alquimia-actions-registry.v1.js` (registro de acciones)
- `public/js/master/master-alquimia-general-client.js` (UI que renderiza acciones)

---

**FIN DEL CONTRATO**
