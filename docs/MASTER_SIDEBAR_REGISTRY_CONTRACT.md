# MASTER SIDEBAR REGISTRY - Contrato Canónico v1

## Objetivo

Este documento define el contrato canónico para el Registry del Sidebar Master, garantizando que los labels sean siempre texto humano visible, sin identificadores técnicos concatenados.

## Contrato: Label vs Icon

### Regla Absoluta

**`label`**: Texto humano visible en UI
- Debe ser legible por humanos
- Debe ser descriptivo y claro
- NO debe contener identificadores técnicos
- NO debe contener el valor de `icon` concatenado

**`icon`**: Identificador semántico interno
- Puede ser un id semántico (ej: `'work'`, `'alchemy'`, `'notes'`)
- Puede ser un emoji/símbolo Unicode
- NO se renderiza como texto visible si es id semántico
- Solo se renderiza si es emoji/símbolo

### Prohibiciones Absolutas

❌ **PROHIBIDO**: Concatenar `icon` al `label`
```javascript
// ❌ INCORRECTO
{
  label: 'workTrabajos PDE',  // icon "work" concatenado
  icon: 'work'
}

// ✅ CORRECTO
{
  label: 'Trabajos PDE',  // texto humano puro
  icon: 'work'  // id semántico interno
}
```

❌ **PROHIBIDO**: Incluir identificadores técnicos en `label`
```javascript
// ❌ INCORRECTO
{
  label: 'alchemyAlquimia General',
  icon: 'alchemy'
}

// ✅ CORRECTO
{
  label: 'Alquimia General',
  icon: 'alchemy'
}
```

❌ **PROHIBIDO**: Mutar `label` en runtime
- El `label` debe ser inmutable desde el registry
- El cliente JS renderiza `label` tal cual, sin procesamiento

### Obligaciones

✅ **OBLIGATORIO**: `label` es texto puro, legible por humanos
```javascript
{
  label: 'Trabajos PDE',  // ✅ Texto humano claro
  icon: 'work'
}
```

✅ **OBLIGATORIO**: `icon` es id semántico o emoji, nunca texto visible
```javascript
{
  label: 'Alquimia General',
  icon: 'alchemy'  // ✅ Id semántico interno
}
```

✅ **OBLIGATORIO**: `label` e `icon` son independientes
- El `label` no depende del `icon`
- El `icon` no afecta al `label`
- Son campos separados con propósitos distintos

✅ **OBLIGATORIO**: El cliente JS renderiza `label` tal cual
- Sin procesamiento
- Sin limpieza heurística
- Sin mutaciones

## Ejemplos Canónicos

### Transmutaciones Energéticas

```javascript
{
  id: 'master-templo-luz-trabajos',
  label: 'Trabajos PDE',  // ✅ Texto humano puro
  icon: 'work',  // ✅ Id semántico interno
  route: '/master/templo-luz/trabajos',
  section: 'Transmutaciones Energéticas',
  visible: true,
  order: 6,
  universe: 'templo_luz'
}
```

```javascript
{
  id: 'master-templo-luz-alquimia-general',
  label: 'Alquimia General',  // ✅ Texto humano puro
  icon: 'alchemy',  // ✅ Id semántico interno
  route: '/master/templo-luz/alquimia-general',
  section: 'Transmutaciones Energéticas',
  visible: true,
  order: 1,
  universe: 'templo_luz'
}
```

### Investigación

```javascript
{
  id: 'master-templo-luz-investigacion-notas',
  label: 'Notas (Source of Truth)',  // ✅ Texto humano puro
  icon: 'notes',  // ✅ Id semántico interno
  route: '/master/templo-luz/investigacion/notas',
  section: 'Investigación',
  visible: true,
  order: 1,
  universe: 'templo_luz'
}
```

## Verificación

### Checklist de Auditoría

Al añadir o modificar una entry en el registry, verificar:

- [ ] `label` es texto humano legible
- [ ] `label` NO contiene el valor de `icon` concatenado
- [ ] `label` NO contiene identificadores técnicos
- [ ] `icon` es id semántico o emoji
- [ ] `label` e `icon` son independientes

### Ejemplos de Verificación Visual

El sidebar debe mostrar SOLO:
- ✅ "Trabajos PDE"
- ✅ "Alquimia General"
- ✅ "Lugares"
- ✅ "Proyectos"
- ✅ "Apadrinados"
- ✅ "Notas (Source of Truth)"
- ✅ "Prácticas por desarrollar"
- ✅ "Hallazgos e ideas nuevas"
- ✅ "Diario de Ankhar"

El sidebar NO debe mostrar:
- ❌ "workTrabajos PDE"
- ❌ "alchemyAlquimia General"
- ❌ "placesLugares"
- ❌ "notesNotas (Source of Truth)"

## Referencias

- **Archivo del Registry**: `src/core/master/registry/master-sidebar-registry.js`
- **Cliente JS**: `public/js/master/master-sidebar-client.js`
- **Layout**: `src/core/master/layout/master-layout-v1.html`

## Versión

- **v1**: Contrato inicial canónico
- **Fecha**: 2024
- **Estado**: Activo
