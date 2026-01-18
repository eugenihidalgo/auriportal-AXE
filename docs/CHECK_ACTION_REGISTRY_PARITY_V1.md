# CHECK_ACTION_REGISTRY_PARITY_V1

**Fecha:** 2026-01-18  
**Estado:** Canónico

---

## 1. Qué valida

El script **check-action-registry-parity** comprueba que las **acciones críticas de Alquimia** usadas por la UI MASTER existan en el archivo que el navegador carga:

- `public/js/core/ux/action-registry/alquimia-actions.js`

Ese archivo es el que importa `ux-action-registry-loader.js`; **no** se usa `src/core/ux/action-registry/alquimia-actions.js` en el browser.

### Acciones requeridas

| action_id | Rol |
|-----------|-----|
| `alquimia.reset` | Reset de ciclo (canónico) |
| `alquimia.clean` | Limpiar ítem (estudiante o todos) |
| `alquimia.clean_all` | Limpiar ítem para todos |
| `alquimia.restore_defaults` | Restaurar valores por defecto (canónico) |
| `alquimia.reset_overrides` | Alias DEPRECATED de `alquimia.restore_defaults` |

Si falta **alguna** de estas, el check **falla** (exit 1).

---

## 2. Cómo se ejecuta

```bash
npm run check:action-registry-parity
```

Implementación: `scripts/check-action-registry-parity.js`.  
El script lee el contenido de `public/js/core/ux/action-registry/alquimia-actions.js` y busca, mediante expresiones regulares, la presencia de `action_id: 'alquimia.xxx'` (o con comillas dobles) para cada id de la lista. Si falta uno, se imprime el listado de faltantes y se devuelve código de salida 1.

---

## 3. Qué errores detecta

### 3.1 Acción ausente en public

**Caso real (histórico):** `alquimia.reset_overrides` existía **solo** en `src/core/ux/action-registry/alquimia-actions.js` y **no** en `public/.../alquimia-actions.js`. La UI llamaba `performAction({ action_id: 'alquimia.reset_overrides', ... })` y el registry en el browser no tenía esa acción → **"action_id not registered"** en MASTER.

El check detecta este desajuste: si se elimina `alquimia.reset_overrides` de `public/` (o cualquier otra de la lista), el script falla y lista las acciones faltantes.

### 3.2 Archivo inexistente o ilegible

Si `public/js/core/ux/action-registry/alquimia-actions.js` no existe o no se puede leer, el script escribe el error y termina con exit 1.

---

## 4. Integración

- **Invariante:** ACTION_REGISTRY_PUBLIC_PARITY_V1 (`docs/INVARIANTES_CONSTITUCIONALES.md`).
- Se recomienda ejecutar `check:action-registry-parity` en el pipeline de checks antes de merge (junto con `check:forbid-legacy-reset-delete`, `check:master-ui`, etc.), según la configuración del proyecto.

---

**Referencias:**

- `docs/RESET_AND_DEFAULTS_CONTRACT_V2.md`
- `docs/INVARIANTES_CONSTITUCIONALES.md` (Invariante 24)
- `scripts/check-action-registry-parity.js`
- `public/js/core/ux/action-registry/ux-action-registry-loader.js`
