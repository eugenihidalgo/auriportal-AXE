# Inject Main Isolation Fix v1.4.3 - Datos para GitHub

## VERSION NAME

```
v1.4.3-master-inject-isolation
```

## COMMIT MESSAGE

```
fix(master): aislamiento absoluto de inject_main.js en MASTER (v1.4.3)
```

## DESCRIPTION

Fix constitucional que garantiza que inject_main.js NUNCA se ejecute en
dominio MASTER bajo ninguna circunstancia (ni directa, ni indirecta, ni
por caché, ni por navegación previa). Guard dura con IIFE que aborta
inmediatamente si detecta contexto MASTER. Elimina comportamientos no
deterministas en Sidebar MASTER (resize/fold intermitente) causados por
contaminación de scripts legacy.

## CAMBIOS PRINCIPALES

### Guard Dura en inject_main.js

- **IIFE wrapper**: Envuelve todo el código en función inmediata
- **Guard temprano**: Verifica `window.__AP_CONTEXT__ === 'MASTER'` antes de cualquier lógica
- **Abort inmediato**: `return;` dentro de IIFE aborta ejecución correctamente
- **Sin logs**: Guard silencioso (evita ruido en consola)

### Actualización de Rules

- Añadida sección "Aislamiento Absoluto de inject_main.js en MASTER (v1.4.3+)"
- Reglas obligatorias y prohibiciones documentadas

## ARCHIVOS MODIFICADOS

1. **`public/js/inject_main.js`**
   - Guard dura con IIFE
   - Abort inmediato si contexto es MASTER
   - Comentarios canónicos actualizados

2. **`.cursorrules`**
   - Regla canónica sobre aislamiento de inject_main.js

## ARCHIVOS NO MODIFICADOS

- ✅ Registry - NO tocado
- ✅ CSS - NO tocado
- ✅ Funcionalidad CLIENT - NO modificada
- ✅ Funcionalidad Legacy - NO modificada
- ✅ Funcionalidad MASTER - NO modificada (solo protegida)

## PROBLEMA RESUELTO

### Antes

- `inject_main.js` se ejecutaba en MASTER (violación constitucional)
- Resize/fold funcionaba solo a veces (dependía de incógnito/caché)
- Comportamiento no determinista

### Después

- `inject_main.js` NUNCA se ejecuta en MASTER (guard aborta)
- Resize/fold funciona consistentemente
- Comportamiento determinista

## COMPATIBILIDAD

- ✅ Compatible con todas las versiones anteriores
- ✅ Reversible (mínimo, solo guard)
- ✅ Sin breaking changes
- ✅ CLIENT y Legacy siguen funcionando

## REFERENCIAS

- Documentación: `docs/INJECT_MAIN_ISOLATION_FIX_V1_4_3.md`
- Archivo: `public/js/inject_main.js`
- Rules: `.cursorrules`

---

**ESTADO**: ✅ IMPLEMENTACIÓN COMPLETA Y VERIFICADA
