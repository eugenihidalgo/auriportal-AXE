# ALQUIMIA ALUMNO CONTRACT v1

## Contrato API: Alquimia del Alumno

Este documento define el contrato canónico de los endpoints de Alquimia del Alumno en dominio MASTER.

---

## GET /master/api/alquimia-alumno/megalist

### Parámetros

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `student_uuid` | UUID | ✅ Sí | UUID canónico del estudiante |
| `view_layer` | string | ✅ Sí | Capa de vista: `'shared'`, `'pde'`, o `'combo'` |
| `levels_mode` | string | ❌ No | Modo de niveles (default: `null`) |
| `level_cap` | number | ❌ No | Límite de nivel (default: `null`, `'infinity'` o `'∞'` = 999) |

### Validación

- Si `view_layer` falta → **400 Bad Request** con error `MISSING_VIEW_LAYER`
- Si `view_layer` no es `'shared'`, `'pde'`, o `'combo'` → **400 Bad Request** con error `INVALID_VIEW_LAYER`

### Respuesta

```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "item_id": 123,
        "item_ref": "transmutation:lista:123:item:456",
        "item_nombre": "Nombre del item",
        "item_descripcion": "Descripción...",
        "item_nivel": 5,
        "item_frecuencia_dias": 7,
        "item_veces_limpiar": 1,
        "lista_id": 123,
        "lista_nombre": "Nombre de la lista",
        "lista_tipo": "recurrente" | "una_vez",
        "state_by_view_layer": {
          "shared": {
            "state": "never" | "important" | "pending" | "reviewed",
            "visual_state": "never" | "in_progress" | "completed" | "empowered",
            "computed_state": {
              "view_layer": "shared",
              "clean_count": 0,
              "required_count": 1,
              "days_since_last_clean": null,
              "remaining": null
            }
          },
          "pde": { /* mismo formato */ },
          "combo": { /* solo si lista_tipo === 'una_vez' */ }
        },
        "state": "never", // Compatibilidad: state_by_view_layer[view_layer].state
        "visual_state": "never", // Compatibilidad: state_by_view_layer[view_layer].visual_state
        "shared": { /* datos raw */ },
        "pde": { /* datos raw */ },
        "combo": { /* solo si lista_tipo === 'una_vez' */ },
        "last_actor": { /* metadata */ }
      }
    ],
    "listas": [
      {
        "id": 123,
        "nombre": "Nombre de la lista",
        "items": [ /* items planos, NO agrupados */ ]
      }
    ],
    "metrics_by_layer": {
      "shared": {
        "total": 10,
        "never": 2,
        "important": 1,
        "pending": 3,
        "reviewed": 4,
        "inProgress": 0,
        "completed": 0,
        "empowered": 0,
        "percent_reviewed": 40
      },
      "pde": { /* mismo formato */ },
      "combo": { /* mismo formato, solo para una_vez */ }
    },
    "context": {
      "view_layer": "shared", // view_layer solicitado
      "levels_mode": null,
      "level_cap": null,
      "level_cap_provided": false
    }
  },
  "trace_id": "abc123..."
}
```

### Reglas

1. **Items planos**: Los items NO vienen agrupados por estado. El frontend agrupa desde `state_by_view_layer[view_layer]`.

2. **state_by_view_layer obligatorio**: Cada item incluye `state_by_view_layer.shared`, `.pde`, y `.combo` (si `lista_tipo === 'una_vez'`).

3. **context.view_layer**: Siempre presente, igual al `view_layer` solicitado.

4. **context.clean_layer**: **NO debe existir** en GET (solo en POST).

---

## GET /master/api/alquimia-alumno/item-history

### Parámetros

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `student_uuid` | UUID | ✅ Sí | UUID canónico del estudiante |
| `item_ref` | string | ✅ Sí | Referencia del item |
| `domain_type` | string | ❌ No | Tipo de dominio (default: `'transmutation'`) |
| `limit` | number | ❌ No | Límite de eventos (default: 50, max: 200) |

### Respuesta

```json
{
  "ok": true,
  "data": {
    "technical_panel": {
      "visible": false,
      "events": [ /* eventos técnicos */ ]
    },
    "human_panel": {
      "visible": true,
      "events": [ /* eventos con nombres resueltos */ ]
    },
    "context": {
      "view_layer": null, // Este endpoint NO calcula estado
      "does_not_compute_state": true
    }
  },
  "trace_id": "abc123..."
}
```

### Reglas

1. **No calcula estado**: Este endpoint solo devuelve eventos históricos.
2. **context.view_layer = null**: Explícito, indica que no calcula estado.
3. **context.does_not_compute_state = true**: Flag explícito.

---

## GET /master/api/alquimia-alumno/report

### Parámetros

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `student_uuid` | UUID | ✅ Sí | UUID canónico del estudiante |
| `days` | number | ❌ No | Días hacia atrás (default: 30, max: 365) |

### Respuesta

```json
{
  "ok": true,
  "data": {
    "technical_panel": { /* agregaciones técnicas */ },
    "human_panel": { /* agregaciones humanas */ },
    "context": {
      "view_layer": null, // Este endpoint NO calcula estado
      "does_not_compute_state": true
    }
  },
  "trace_id": "abc123..."
}
```

### Reglas

1. **No calcula estado**: Este endpoint solo devuelve agregaciones de eventos históricos.
2. **context.view_layer = null**: Explícito, indica que no calcula estado.
3. **context.does_not_compute_state = true**: Flag explícito.

---

## POST /master/api/alquimia-alumno/clean

### Body

```json
{
  "student_uuid": "uuid...",
  "item_ref": "transmutation:lista:123:item:456",
  "clean_layer": "shared" | "pde", // OBLIGATORIO, nunca "combo"
  "item_kind": "recurrente" | "una_vez", // OBLIGATORIO
  "execution_mode": "APPLY" | "CERTIFY", // Opcional, default: "APPLY"
  "domain_type": "transmutation",
  "actor_type": "master",
  "actor_ref": "master:user:123",
  "surface_key": null
}
```

### Respuesta

```json
{
  "ok": true,
  "data": {
    "applied": true,
    "state": { /* estado actualizado */ }
  },
  "trace_id": "abc123..."
}
```

### Reglas

1. **clean_layer obligatorio**: Debe ser `'shared'` o `'pde'`, **nunca** `'combo'`.
2. **item_kind obligatorio**: Debe ser `'recurrente'` o `'una_vez'`.
3. **No incluye context.view_layer**: POST no usa `view_layer` (solo GET).

---

## Semántica: clean_layer vs view_layer

### clean_layer (POST)

- **Decide QUÉ COLUMNAS se escriben** en `cleaning_item_state`.
- Valores permitidos: `'shared'`, `'pde'`.
- **Nunca** `'combo'` (combo es solo view_layer).

### view_layer (GET)

- **Decide QUÉ ESTADO se calcula** y **QUÉ COLUMNA UI se muestra**.
- Valores permitidos: `'shared'`, `'pde'`, `'combo'`.
- `'combo'` solo aplica a items `una_vez` (suma shared + pde).

---

## state_by_view_layer

### Estructura

Para cada `view_layer` (`'shared'`, `'pde'`, `'combo'`), el backend calcula:

```json
{
  "state": "never" | "important" | "pending" | "reviewed", // Solo para recurrente
  "visual_state": "never" | "in_progress" | "completed" | "empowered", // Solo para una_vez
  "computed_state": {
    "view_layer": "shared",
    "clean_count": 0,
    "required_count": 1,
    "days_since_last_clean": null,
    "remaining": null
  }
}
```

### Reglas

1. **Backend calcula todo**: El frontend NO calcula estados.
2. **Todos los view_layers**: El backend calcula para `shared`, `pde`, y `combo` (si aplica).
3. **Frontend consume**: El frontend agrupa items desde `state_by_view_layer[view_layer]`.

---

## Reglas de combo (solo una_vez)

1. **combo = shared + pde**: Para items `una_vez`, `combo` suma `clean_count` de `shared` y `pde`.
2. **combo solo view_layer**: `combo` **nunca** es `clean_layer` (solo se lee, no se escribe).
3. **state_by_view_layer.combo**: Solo existe si `lista_tipo === 'una_vez'`.

---

## Compatibilidad Futura GOD

### Contrato Explícito

GOD consumirá estos endpoints con el mismo contrato:

1. **GET megalist**: Requiere `view_layer`, devuelve `state_by_view_layer`.
2. **POST clean**: Requiere `clean_layer`, no usa `view_layer`.
3. **Context explícito**: `context.view_layer` siempre presente (string o null).

### GOD NO Calcula Estados

GOD solo consume proyecciones del backend MASTER:

- **NO** calcula estados localmente.
- **NO** infiere `view_layer` desde contexto.
- **SÍ** consume `state_by_view_layer[view_layer]` directamente.

---

## Referencias

- `docs/CONSTITUTION_VIEW_AUTHORITY_V1.md` - Regla constitucional
- `docs/REFACTOR_ALQUIMIA_ALUMNO_AUTORIDAD_VISTA_V1.md` - Refactor implementado
- `src/core/master/services/cleaning-layer-constants.js` - Constantes canónicas
