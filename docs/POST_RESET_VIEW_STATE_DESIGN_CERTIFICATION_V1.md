# Certificación de diseño canónico — POST-RESET VIEW STATE

**Versión:** 1.0  
**Fecha:** 2026-01-13  
**Estado:** CERTIFICADO  
**Dominio:** MASTER · Alquimia General

---

## 1. Objetivo

Fijar como **diseño canónico** el comportamiento POST-RESET del estado de vista en Alquimia General (MASTER), para eliminar inconsistencias al hacer CLEAN después de un RESET en caliente, sin depender de `BUILD_ID`, `client-state-reset.js` ni recarga de página.

---

## 2. Contexto

- **Backend RESET y CLEAN:** canónicos y correctos (RESET_CONTRACT_V1, CLEAN_AFTER_RESET_CONTRACT_V1).
- **Origen del bug:** Tras un RESET exitoso, el estado de vista del frontend (proyecciones, items, caches en memoria) queda obsoleto y no se invalida de forma explícita.
- **client-state-reset.js:** Depende de `BUILD_ID`; solo actúa cuando cambia el build. No sirve para RESET en caliente dentro de la misma sesión.

---

## 3. Principio constitucional nuevo

> **RESET implica cambio de época.**  
> Todo estado de vista previo al RESET es inválido.

---

## 4. Regla absoluta

> Toda acción RESET **exitosa** (item, list, list ALL) **invalida** el estado de vista del cliente e **invoca rehidratación** desde el backend.

---

## 5. Invalidación de vista

- Se **descarta** todo el estado de vista en memoria relativo a Alquimia General que pueda estar obsoleto:
  - `state.items`
  - `state.projection.data`
  - `state.groups` (derivado de items)
  - Cualquier read-model o caché de proyección local.
- **No** se intenta reparar ni reutilizar el estado previo.
- **No** se recarga la página.
- **No** se modifica estado global de la app (auth, sidebar, otras pantallas, `__AP_CONTEXT__`).
- **No** se usa `localStorage.clear()`. Solo se pueden limpiar claves específicas de Alquimia General si existen (actualmente no se usan en el cliente).

---

## 6. Rehidratación determinista

Después de invalidar:

- El frontend **vuelve a pedir** proyecciones y datos al backend (list-projection, items, flotante si aplica).
- El **backend es la única autoridad** de estado; el frontend no calcula ni infiere estados.
- Se reconstruye el estado de vista desde las respuestas (p. ej. recurrente: `never`, `clean_count = 0` donde corresponda).
- El **render** se hace a partir de datos nuevos, no de estado en caché.

---

## 7. Alcance

**Se afecta solo:**

- Estado de vista y caches de **Alquimia General** en el cliente (items, proyección, grupos, caches de superficies).

**No se afecta:**

- Auth, sesión, cookies.
- Sidebar.
- Otras pantallas (Alumno, Lugares, Proyectos, etc.).
- Contexto MASTER global (`__AP_CONTEXT__`, `__AP_APP_VERSION__`, etc.).

---

## 8. Objetivo funcional

La secuencia **RESET → CLEAN** debe ser siempre coherente: tras RESET, un CLEAN debe reflejar el estado reseteado (p. ej. `clean_count = 1` tras el primer CLEAN), sin depender de:

- `BUILD_ID`
- `client-state-reset.js`
- Reload o hard refresh

---

## 9. Comprobación de invariantes existentes

| Invariante / regla | ¿Contradice el diseño? | Notas |
|--------------------|-------------------------|-------|
| View Authority: backend es autoridad de estado | **NO** | La rehidratación se hace pidiendo datos al backend; el frontend no calcula estados. |
| Refetch obligatorio tras mutaciones | **NO** | La rehidratación es un refetch explícito y determinista. |
| Consumo de `state_by_view_layer[view_layer]` | **NO** | Tras rehidratar, el frontend sigue consumiendo solo lo que devuelve el backend. |
| CPM como única autoridad de proyección | **NO** | No se toca el CPM; el backend sigue siendo quien proyecta. |
| Reset recurrente: `last_cleaned_at = NULL`, `clean_count = 0` en capa reseteada | **NO** | Es regla de backend; el diseño solo invalida vista y rehidrata. |
| `client-state-reset` no debe tocarse para este flujo | **NO** | El diseño no usa `client-state-reset`; es independiente de `BUILD_ID`. |
| PROHIBIDO `localStorage.clear()` | **NO** | Solo se contemplan claves concretas de Alquimia General, si en el futuro se usan. |

**Conclusión:** El diseño **no contradice** ninguna invariante constitucional ni contrato existente.

---

## 10. Elementos que quedarán en implementación

1. **Invalidación:** Función (p. ej. `invalidateAlquimiaViewState()`) que limpie en memoria: `state.items`, `state.projection.data`, `state.groups` y marque como obsoletos los read-models/caches de Alquimia General.
2. **Rehidratación:** Función (p. ej. `rehydrateAlquimiaViewState()`) que, tras invalidar, llame a `loadListProjection()` y/o `loadItems()` (y `handleVerItem` si el flotante está abierto) según `view_mode` y `list_id`, y luego `renderView()`.
3. **Hook post-RESET:** Tras cada RESET exitoso (item, list, list ALL), ejecutar: invalidar → rehidratar → render. Debe encajarse con el flujo actual de `performAction` y `refresh_plan` (por ejemplo, la rehidratación puede cumplir o complementar el `refresh_plan` para RESET).
4. **Logs forenses:** `[POST_RESET][INVALIDATE_VIEW]` y `[POST_RESET][REHYDRATE_VIEW]` para verificación.

---

## 11. Certificación

Este diseño se certifica como **canónico** para POST-RESET VIEW STATE en MASTER · Alquimia General.

- No contradice invariantes ni contratos actuales.
- Es compatible con View Authority, CPM, refetch tras mutaciones y RESET/CLEAN en backend.
- Deja listo el terreno para la implementación y la documentación (contrato, invariante, reglas, forense).

---

**FIN DE LA CERTIFICACIÓN**
