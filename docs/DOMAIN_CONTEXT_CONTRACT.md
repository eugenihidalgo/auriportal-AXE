# Domain Context Contract v1

## Propósito

Define el contrato canónico para determinar el contexto de dominio en AuriPortal.

## Valores Válidos

- `MASTER` - Dominio Master (/master/*)
- `ADMIN` - Dominio Admin legacy (/admin/*)
- `CLIENT` - Dominio Cliente (portal del alumno)
- `UNKNOWN` - Contexto no determinado (fallback)

## Reglas Constitucionales

### 1. Determinación del Contexto

- El contexto se determina en **render (backend)**
- Se expone como `window.__AP_CONTEXT__`
- **PROHIBIDO**: Ningún script global puede inferir contexto por URL
- **PROHIBIDO**: Ningún script puede cambiar el contexto en runtime

### 2. Inyección del Contexto

- El contexto se inyecta **ANTES** de cualquier script
- Se inyecta como:
  ```html
  <script>
    window.__AP_CONTEXT__ = 'MASTER';
  </script>
  ```
- **PROHIBIDO**: Usar data-attributes
- **PROHIBIDO**: Usar inferencias
- **PROHIBIDO**: Reutilizar lógica entre dominios

### 3. Separación de Dominios

- **MASTER** es un dominio soberano
- **MASTER** NO ejecuta lógica legacy (inject_main.js)
- **MASTER** tiene su propio entry gate (inject_master.js)
- Ningún script global puede ejecutarse en Master sin contrato

### 4. Entry Gates

Cada dominio tiene su propio entry gate:

- **MASTER**: `inject_master.js`
- **ADMIN/CLIENT**: `inject_main.js` (legacy global)

Los entry gates verifican el contexto antes de ejecutar.

## Ejemplo de Uso

### En Master Layout

```html
<script>
  window.__AP_CONTEXT__ = 'MASTER';
</script>
<script type="module" src="/js/master/inject_master.js"></script>
```

### En inject_master.js

```javascript
if (window.__AP_CONTEXT__ !== 'MASTER') {
  return;
}
// Lógica Master
```

### En inject_main.js

```javascript
if (window.__AP_CONTEXT__ === 'MASTER') {
  return; // NO ejecutar en Master
}
// Lógica legacy
```

## Invariantes

1. El contexto se establece UNA vez en render
2. El contexto NO cambia en runtime
3. Los scripts verifican el contexto antes de ejecutar
4. Master NO ejecuta inject_main.js
5. Admin/Cliente NO ejecuta inject_master.js

## Violaciones Constitucionales

- Inferir contexto por URL en scripts
- Cambiar contexto en runtime
- Ejecutar inject_main.js en Master
- Ejecutar inject_master.js fuera de Master
- Usar data-attributes para contexto
- Reutilizar lógica entre dominios sin contrato

