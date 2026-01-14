# ALQUIMIA OVERRIDES UI v1 - Documentación Canónica

**Fecha de creación:** 2026-01-XX  
**Estado:** ✅ IMPLEMENTADO  
**Alcance:** UI de overrides en Alquimia General (proyección de alumno)

---

## 1. PROPÓSITO

Permitir editar valores de configuración de items a nivel de alumno individual en la proyección de Alquimia General, aplicando overrides que modifican el comportamiento efectivo sin alterar los valores base del catálogo.

**Principio fundamental:** Los overrides son personalizaciones por alumno que solo afectan la vista de proyección `scope='student'`, nunca la vista agregada `scope='all'`.

---

## 2. ALCANCE

### Campos Soportados

La UI de overrides permite editar los siguientes campos cuando `scope === 'student'`:

1. **`threshold_days`** (items RECURRENTE)
   - Campo base: `item.frecuencia_dias`
   - Override key: `threshold_days`
   - Tipo: number (≥ 1)

2. **`required_count`** (items UNA_VEZ)
   - Campo base: `item.veces_limpiar`
   - Override key: `required_count`
   - Tipo: number (≥ 0)

3. **`nivel`** (todos los items)
   - Campo base: `item.nivel`
   - Override key: `nivel`
   - Tipo: number (1-9)

4. **`descripcion`** (todos los items)
   - Campo base: `item.descripcion`
   - Override key: `descripcion`
   - Tipo: string

### Fuera de Alcance

- Overrides de campos no listados arriba
- UI de edición de overrides fuera de proyección de alumno
- Overrides en modo operativa
- Overrides en proyección `scope='all'`

---

## 3. REGLA CONSTITUCIONAL DEL OVERRIDE

**REGLA ABSOLUTA:** Overrides SOLO en `scope='student'`, NUNCA en `scope='all'`

- Los overrides son personalizaciones individuales por alumno
- La proyección `scope='all'` muestra estado agregado sin personalizaciones
- Los valores base del catálogo nunca se modifican (Override ≠ Mutación)

**Implementación:**
```javascript
const isOverrideEditable = !isCreateRow && 
  state.projection.scope === 'student' && 
  !!state.projection.student_uuid;
```

---

## 4. CAMPOS EDITABLES

### 4.1 threshold_days (RECURRENTE)

- **Ubicación:** Columna "DÍAS RECURRENCIA" en tabla de items
- **Editable cuando:** `scope === 'student' && student_uuid != null`
- **Valor mostrado:** Valor efectivo (override si existe, base si no)
- **Placeholder:** Valor base del item
- **Validación:** Debe ser ≥ 1

### 4.2 required_count (UNA_VEZ)

- **Ubicación:** Columna "VECES LIMPIAR" en tabla de items
- **Editable cuando:** `scope === 'student' && student_uuid != null`
- **Valor mostrado:** Valor efectivo (override si existe, base si no)
- **Placeholder:** Valor base del item
- **Validación:** Debe ser ≥ 0

### 4.3 nivel

- **Ubicación:** Columna "NIVEL" en tabla de items
- **Editable cuando:** `scope === 'student' && student_uuid != null`
- **Valor mostrado:** Valor efectivo (override si existe, base si no)
- **Validación:** Debe ser entre 1 y 9

### 4.4 descripcion

- **Ubicación:** Columna "DESCRIPCIÓN" en tabla de items
- **Editable cuando:** `scope === 'student' && student_uuid != null`
- **Valor mostrado:** Valor efectivo (override si existe, base si no)
- **Placeholder:** Valor base del item (si existe)

---

## 5. CONDICIÓN DE VISIBILIDAD

### Campos Editables

Los campos son editables **SOLO** cuando se cumplen todas estas condiciones:

1. `scope === 'student'`
2. `student_uuid != null`
3. No es fila de creación (`!isCreateRow`)

### Campos Deshabilitados

En los siguientes casos, los campos están **deshabilitados** (opacity: 0.6, cursor: not-allowed):

- `scope === 'all'`
- Modo operativa (no proyección)
- `student_uuid == null` en proyección de alumno

**Implementación:**
```javascript
if (!isOverrideEditable && !isCreateRow) {
  input.disabled = true;
  input.style.cssText += 'opacity: 0.6; cursor: not-allowed;';
}
```

---

## 6. INDICADORES VISUALES

### Borde Rojo

Cuando un campo tiene un override activo (valor efectivo ≠ valor base), se muestra un **borde rojo** alrededor del contenedor del campo:

```javascript
if (hasOverrideActive) {
  container.style.cssText += 'border: 2px solid #ef4444; border-radius: 0.25rem; padding: 2px;';
}
```

**Detección de override:**
```javascript
const hasOverrideActive = isOverrideEditable && 
  hasOverride(effectiveValue, baseValue);
```

La función `hasOverride()` compara valores estrictamente:
- Comparación numérica para números
- Comparación de strings para strings
- Comparación con null/undefined

**NO se usa lógica inferida ni caché en frontend.** La comparación se hace en cada render.

---

## 7. EDICIÓN DE CAMPOS

### Flujo de Edición

1. Usuario modifica valor en campo editable
2. Se dispara evento `change` del input
3. Se valida el nuevo valor (tipo y rango)
4. Se compara con valor base:
   - Si `newValue === baseValue`: eliminar override (si existe)
   - Si `newValue !== baseValue`: crear o actualizar override
5. Se envía petición al backend
6. Se refresca proyección automáticamente
7. Se muestra toast de éxito/error

### Endpoint Utilizado

**POST `/master/api/student-item-overrides`**

Payload:
```json
{
  "student_uuid": "uuid-del-alumno",
  "item_ref": "ref-del-item",
  "override_key": "threshold_days|required_count|nivel|descripcion",
  "override_value": valor,
  "reason": "Override de {override_key} para {item_ref}"
}
```

### Eliminación de Override

Si el nuevo valor es igual al base, se busca y elimina el override existente:

```javascript
if (newValue === baseValue) {
  const overrides = await getItemOverrides(student_uuid, item_ref);
  const override = overrides.find(o => o.override_key === override_key);
  if (override) {
    await deleteItemOverride(override.id);
  }
}
```

**Endpoint utilizado:** `DELETE /master/api/student-item-overrides/:id`

---

## 8. ELIMINACIÓN AUTOMÁTICA

Cuando el usuario modifica un campo y el nuevo valor es igual al valor base:

1. Se detecta que `newValue === baseValue`
2. Se busca el override existente para ese campo
3. Si existe, se elimina automáticamente
4. Se muestra toast: "Override eliminado (valor vuelve al base)"
5. Se refresca la proyección

**NO se requiere acción manual del usuario.** La eliminación es automática e inmediata.

---

## 9. BOTÓN RESET OVERRIDES

### Visibilidad

El botón "Reset Overrides" es visible **solo** si:
- `scope === 'student' && student_uuid != null`
- El item tiene ≥1 override activo

**Verificación asíncrona:**
```javascript
(async () => {
  const overrides = await getItemOverrides(student_uuid, item_ref);
  if (overrides.length > 0) {
    // Renderizar botón
  }
})();
```

### Ubicación

El botón se ubica al final de la fila del item, en la columna de acciones, antes de los botones de limpieza individual.

### Acción

Al hacer clic:
1. Se muestra confirmación: "¿Eliminar todos los overrides de este item para este alumno?"
2. Si se confirma, se eliminan todos los overrides del item para ese alumno
3. Se muestra toast con número de overrides eliminados
4. Se refresca la proyección automáticamente

**NO afecta:**
- Cleaning (estado de limpieza)
- Estado energético
- Valores base del catálogo

---

## 10. DIFERENCIAS RECURRENTE / UNA_VEZ

### RECURRENTE

- **Campo override:** `threshold_days`
- **Campo base:** `item.frecuencia_dias`
- **Columna UI:** "DÍAS RECURRENCIA"
- **Validación:** ≥ 1

### UNA_VEZ

- **Campo override:** `required_count`
- **Campo base:** `item.veces_limpiar`
- **Columna UI:** "VECES LIMPIAR"
- **Validación:** ≥ 0

**La UI es idéntica en ambos casos.** La lógica backend ya existe y se reutiliza.

---

## 11. BACKEND COMO AUTORIDAD

### Valores Efectivos desde LPM

El backend (LPM) es la **única autoridad** de valores efectivos. El frontend NO calcula overrides.

**LPM incluye en items retornados:**
- `threshold_days`: Valor efectivo (override si existe, base si no)
- `required_count`: Valor efectivo (override si existe, base si no)
- `nivel`: Valor efectivo (override si existe, base si no)
- `descripcion`: Valor efectivo (override si existe, base si no)

**Implementación en LPM:**
```javascript
const effectiveItem = {
  ...item,
  nivel: effectiveConfig.nivel !== undefined ? effectiveConfig.nivel : item.nivel,
  descripcion: effectiveConfig.descripcion !== undefined ? effectiveConfig.descripcion : item.descripcion,
  threshold_days: effectiveConfig.threshold_days !== undefined ? effectiveConfig.threshold_days : (item.frecuencia_dias || 7),
  required_count: effectiveConfig.required_count !== undefined ? effectiveConfig.required_count : (item.veces_limpiar || 1),
  // ...
};
```

### Frontend Solo Renderiza

El frontend:
- **NO calcula** valores efectivos
- **NO infiere** overrides desde datos raw
- **Solo renderiza** valores efectivos recibidos del backend
- **Compara** valores efectivos vs base para mostrar borde rojo

---

## 12. FUERA DE ALCANCE

### No Implementado

- UI de edición de overrides fuera de proyección de alumno
- Overrides en modo operativa
- Overrides en proyección `scope='all'`
- Overrides de campos no listados (nombre, grupo, etc.)
- UI de gestión masiva de overrides
- Historial de cambios de overrides
- Comparación visual de valores base vs efectivos (más allá del borde rojo)

### No Documentado Aquí

- Sistema de overrides backend (ver `docs/OVERRIDES_SYSTEM_V1.md`)
- Endpoints API de overrides (ver `docs/OVERRIDES_SYSTEM_V1.md`)
- Integración con LPM/CPM (ver `docs/OVERRIDES_SYSTEM_V1.md`)

---

## 13. ESTADO DEL DOCUMENTO

**Versión:** 1.0.0  
**Fecha:** 2026-01-XX  
**Estado:** ✅ IMPLEMENTADO Y DOCUMENTADO

### Referencias

- **Código frontend:** `public/js/master/master-alquimia-general-client.js`
- **Código backend (LPM):** `src/core/master/services/list-projection-model.js`
- **Sistema de overrides:** `docs/OVERRIDES_SYSTEM_V1.md`
- **Endpoints API:** `src/endpoints/master-api-student-item-overrides.js`

### Verificación

- ✅ Campos editables solo en `scope='student'`
- ✅ Borde rojo cuando hay override activo
- ✅ Edición envía override al backend
- ✅ Eliminación automática cuando valor vuelve al base
- ✅ Botón Reset Overrides visible solo con overrides activos
- ✅ Backend es única autoridad (valores efectivos desde LPM)

---

**Última actualización:** 2026-01-XX  
**Mantenido por:** Sistema de documentación canónica
