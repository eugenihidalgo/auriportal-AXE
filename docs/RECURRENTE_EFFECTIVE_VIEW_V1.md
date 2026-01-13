# RECURRENTE EFFECTIVE VIEW v1

## Definición Canónica

`effective` es una nueva `view_layer` exclusiva para items RECURRENTES que representa **el estado total efectivo resultante de combinar**:
- lo limpiado por el alumno (`shared`)
- lo limpiado por la PDE (`pde`)

### Características

- **Tipo**: `view_layer` (NO es `clean_layer`)
- **Ámbito**: EXCLUSIVO de `item_kind = 'recurrente'`
- **Naturaleza**: Proyección calculada (NO escribe nada, NO modifica estado)
- **Semántica**: "Estado efectivo total teniendo en cuenta alumno + PDE"

### Importante

- `combo` **NO SE TOCA**
- `combo` sigue siendo exclusivo de `item_kind = 'una_vez'`
- `effective` **NO sustituye ni renombra** a `combo`

---

## Matriz Canónica de Validez

| item_kind   | view_layer válidas          |
|------------|-----------------------------|
| recurrente | shared · pde · effective     |
| una_vez    | shared · pde · combo         |

Cualquier otra combinación es **ERROR CONSTITUCIONAL** (HTTP 400).

**Nota:** `effective` está disponible en:
- Flotante de Alquimia General para items RECURRENTES
- Tabs de Alquimia del Alumno (junto a Shared y PDE) para items RECURRENTES

---

## Regla de Cálculo

Para RECURRENTE con `view_layer = 'effective'`:

1. Calcular estado de `shared`:
   - `days_since_last_clean` desde `shared`
   - Estado: `never` | `reviewed` | `pending` | `important`

2. Calcular estado de `pde`:
   - `days_since_last_clean` desde `pde`
   - Estado: `never` | `reviewed` | `pending` | `important`

3. Calcular `effective` (mejor estado resultante):
   - Si `shared` o `pde` está `reviewed` → `effective = reviewed`
   - Si ambos están `pending` → `effective = pending`
   - Si ambos están `important` → `effective = important`
   - Si ambos están `never` → `effective = never`

4. `days_since_last_clean` para `effective`:
   - Mínimo entre `shared_days_since` y `pde_days_since` (mejor caso)

### Ejemplo

```
shared: days_since = 3  → state = 'reviewed'
pde:    days_since = 10 → state = 'pending'
effective: state = 'reviewed' (mejor estado), days_since = 3 (mínimo)
```

---

## Implementación Backend

### Validación

- `validateViewLayerItemKindCoherence(viewLayer, itemKind)` valida:
  - `effective` solo si `itemKind === 'recurrente'`
  - `combo` solo si `itemKind === 'una_vez'`

### Cálculo

- `computeVisualState()` calcula `effective` cuando:
  - `view_layer === 'effective'`
  - `item_kind === 'recurrente'`

### Proyección

- `alquimia-alumno-megalist-service.js` incluye `state_by_view_layer.effective` para items recurrentes
- `state_by_view_layer.effective` contiene:
  - `state`: estado efectivo calculado
  - `visual_state`: igual a `state` (RECURRENTE)
  - `effective_sources`: metadata de composición `{ shared: boolean, pde: boolean }`
  - `computed_state`: metadatos (shared_state, pde_state, days_since, etc.)

---

## Implementación Frontend

### Selector de Vista

En el tab "Recurrente" de Alquimia del Alumno:

- Tabs de vista con 3 opciones:
  - **Shared**: vista del trabajo del alumno
  - **PDE**: vista del trabajo de la PDE
  - **Effective**: vista agregada (alumno + PDE) - muestra estado combinado

### Comportamiento

- El selector **SOLO cambia** `state.viewLayer`
- Dispara `loadMegalist()` automáticamente
- **NO calcula nada** (todo viene del backend)
- **NO guarda estado** (solo durante la sesión)

### PDUI Estricto

- El frontend consume EXCLUSIVAMENTE `state_by_view_layer[view_layer]`
- No distingue si es `shared` / `pde` / `effective`
- No contiene lógica condicional por vista
- Refetch completo tras mutaciones preservando `view_layer` activa

---

## Interpretación Visual (S / P)

### Metadata `effective_sources`

Cuando `view_layer === 'effective'`, el CPM expone metadata `effective_sources` que indica de qué capas proviene el estado effective:

```javascript
{
  state: 'reviewed',
  visual_state: 'reviewed',
  effective_sources: {
    shared: true,  // shared_state === 'reviewed' (estado limpio)
    pde: false     // pde_state !== 'reviewed' (no está limpio)
  }
}
```

### Visualización en Flotante Alquimia General

En el flotante de Alquimia General, cuando `view_layer === 'effective'`, se muestran indicadores informativos por cada alumno:

- **[S] Shared**: Verde si `effective_sources.shared === true`, gris si `false`
- **[P] PDE**: Verde si `effective_sources.pde === true`, gris si `false`

**Reglas:**
- Ambos activos (verde): Ambas capas están en estado limpio (`reviewed`)
- Solo S activo: Solo Shared está limpio
- Solo P activo: Solo PDE está limpio
- Ninguno activo: Ninguna capa está limpia

**Características:**
- Son puramente informativos (NO son botones de acción)
- NO disparan eventos
- Permiten entender la composición del estado effective

### Ejemplo Visual

```
Alumno: Juan Pérez [S] [P]
         └─ verde  └─ gris
```

Indica que el estado effective de Juan proviene de Shared (está limpio), pero PDE no está limpio.

---

## Logs Forenses

### Backend

```
[ALQUIMIA_ALUMNO][STATE][RECURRENTE][EFFECTIVE] Estado effective calculado
{
  shared_state: 'reviewed',
  pde_state: 'pending',
  effective_state: 'reviewed',
  shared_days_since: 3,
  pde_days_since: 10,
  effective_days_since: 3
}
```

### Frontend

```
[UI][VIEW_LAYER_CHANGE] Cambio de vista
{
  from: 'shared',
  to: 'effective',
  item_kind: 'recurrente',
  student_uuid: '...'
}
```

---

## Relación con View Authority v1

`effective` cumple con **View Authority v1**:

- ✅ Backend es única autoridad de estado
- ✅ Frontend NO calcula estados
- ✅ `view_layer` obligatorio en GET
- ✅ `state_by_view_layer` presente en respuestas
- ✅ Refetch tras mutaciones

---

## Casos de Uso

### Master

- Ver estado total efectivo de un alumno (alumno + PDE)
- Identificar items que necesitan atención (mejor estado entre ambos)
- Contextos de grupo (futuro): ver estado agregado de múltiples alumnos

### Contextos Futuros

- Grupos: estado efectivo del grupo
- Pares: estado efectivo del par
- Clases: estado efectivo de la clase

---

## Diferencias con `combo`

| Aspecto | `combo` (UNA_VEZ) | `effective` (RECURRENTE) |
|---------|-------------------|---------------------------|
| `item_kind` | `una_vez` | `recurrente` |
| Cálculo | Suma `clean_count` (shared + pde) | Mejor estado (shared o pde) |
| Estado | `never` \| `in_progress` \| `completed` \| `empowered` | `never` \| `reviewed` \| `pending` \| `important` |
| Métrica | `clean_count`, `remaining` | `days_since_last_clean` |
| Propósito | Ver progreso total hacia `veces_limpiar` | Ver estado total efectivo de limpieza |

---

## Reglas Constitucionales

1. `effective` solo permitido en `recurrente`
2. `combo` solo permitido en `una_vez`
3. Prohibido inferir vistas en frontend
4. Toda vista debe venir del backend
5. `effective` NO escribe nada (solo proyección)
6. `effective` NO modifica contadores
7. `effective` NO afecta `clean_layer`

---

## Acciones WRITE en Vista Effective

### Limpieza por Capa

En el flotante de Alquimia General, cuando `view_layer === 'effective'` y `item_kind === 'recurrente'`, se muestran botones de acción por capa:

- **Botón S (Shared)**: Limpia solo la capa Shared
  - Disabled si `effective_sources.shared === true` (ya está revisado)
  - Acción: `clean_layer='shared'`

- **Botón P (PDE)**: Limpia solo la capa PDE
  - Disabled si `effective_sources.pde === true` (ya está revisado)
  - Acción: `clean_layer='pde'`

- **Botón S+P (Ambos)**: Limpia ambas capas secuencialmente
  - Disabled si ambas `effective_sources.shared === true` y `effective_sources.pde === true`
  - Acción: Ejecuta `clean_layer='shared'` y luego `clean_layer='pde'`

### Reglas de Visibilidad

Los botones solo se muestran si:
- `view_layer === 'effective'`
- `item_kind === 'recurrente'`
- `state_by_view_layer.effective.state !== 'reviewed'`

Si el estado effective es `'reviewed'`, se muestra texto "✓ Revisado" en lugar de botones.

### Refetch Obligatorio

Tras cualquier acción de limpieza:
- Se ejecuta refetch completo del flotante
- Se preserva `view_layer='effective'`
- NO se actualiza estado localmente
- El backend recalcula `state_by_view_layer.effective` y `effective_sources`

### Relación con effective_sources

Los botones se habilitan/deshabilitan según `effective_sources`:
- Si `effective_sources.shared === true` → Botón S disabled
- Si `effective_sources.pde === true` → Botón P disabled
- Si ambos `true` → Botón S+P disabled

Esto permite al usuario ver qué capas ya están limpias y cuáles necesitan limpieza.

### Logs Forenses

**Frontend:**
```
[ALQUIMIA_GENERAL][FLOTANTE][EFFECTIVE_ACTION] Limpiando Shared
{
  student_uuid: '...',
  item_ref: '...',
  action: 'clean_shared' | 'clean_pde' | 'clean_both'
}
```

**Backend:**
Los logs del Cleaning Engine ya cubren las acciones de limpieza (no duplicar).

---

## Verificación

Checklist obligatorio:

- [ ] RECURRENTE muestra shared / pde / effective
- [ ] effective suma correctamente shared + pde (mejor estado)
- [ ] UNA_VEZ sigue usando combo sin cambios
- [ ] Ninguna mutación escribe en effective
- [ ] Assembly checks pasan
- [ ] Logs forenses presentes

---

## Referencias

- `docs/CONSTITUTION_VIEW_AUTHORITY_V1.md`
- `docs/ALQUIMIA_CANONICA_V1.md`
- `src/core/master/services/cleaning-layer-constants.js`
- `src/services/alquimia-general-service.js` (computeVisualState)
- `src/core/master/services/alquimia-alumno-megalist-service.js`

---

**Versión**: v1  
**Fecha**: 2024  
**Estado**: CANÓNICO
