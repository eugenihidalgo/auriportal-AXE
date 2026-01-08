# MASTER ALQUIMIA ALUMNO FAIL-OPEN NOTES v1
**Versión:** v1.0  
**Fecha:** 2026-01-08  
**Estado:** ✅ Implementado

---

## 1. PROPÓSITO

El read-model del servicio `alquimia-alumno-megalist-service.js` está diseñado con **fail-open canónico**: nunca debe romper (500) por datos incompletos, catálogos faltantes, o estructuras inconsistentes.

**Principio:** Robustez > Perfección

---

## 2. FILOSOFÍA FAIL-OPEN

### 2.1. Regla Absoluta

**El endpoint `/master/api/alquimia-alumno/megalist` NUNCA debe lanzar 500 por:**
- Items no encontrados en catálogo
- Listas no encontradas
- Niveles null/undefined
- Estructuras incompletas
- Errores de cálculo de estado

**Siempre debe:**
- Retornar JSON válido con status 200
- Incluir `warnings[]` con todos los fallbacks aplicados
- Continuar renderizando la megalista (aunque algunos items salgan como "NO_RESUELTO")

---

### 2.2. Fallbacks Canónicos

**Cuando algo no se puede resolver:**

1. **Item no encontrado:**
   - `item_nombre: "NO_RESUELTO"`
   - `lista_id: "unknown"`
   - `lista_nombre: "Sin lista (NO_RESUELTO)"`
   - Warning: `ITEM_NOT_RESOLVED`

2. **Lista no encontrada:**
   - `lista_id: "unknown"`
   - `lista_nombre: "Sin lista (NO_RESUELTO)"`
   - Warning: `LIST_NOT_RESOLVED`

3. **Nivel no comparable:**
   - No filtrar el item (incluirlo en megalista)
   - Warning: `LEVEL_NOT_COMPARABLE`

4. **Error de cálculo de estado:**
   - Fallback a `state: "never"`
   - Warning: `STATE_CALCULATION_ERROR`

---

## 3. TIPOS DE WARNINGS

### 3.1. `ITEM_NOT_RESOLVED`

**Cuándo:** Item en `cleaning_item_state` no existe en catálogo

**Payload:**
```json
{
  "type": "ITEM_NOT_RESOLVED",
  "item_ref": "item_123",
  "domain_type": "transmutation",
  "message": "Item no encontrado en catálogo: item_123"
}
```

**Acción:** Item aparece como "NO_RESUELTO" en lista "unknown"

---

### 3.2. `LIST_NOT_RESOLVED`

**Cuándo:** `item.lista_id` no existe en catálogo de listas

**Payload:**
```json
{
  "type": "LIST_NOT_RESOLVED",
  "item_ref": "item_123",
  "lista_id": 999,
  "message": "Lista no encontrada: 999"
}
```

**Acción:** Item aparece en lista "unknown" con nombre "Sin lista (NO_RESUELTO)"

---

### 3.3. `LEVEL_NOT_COMPARABLE`

**Cuándo:** `item.nivel` o `nivel_efectivo` es null/undefined

**Payload:**
```json
{
  "type": "LEVEL_NOT_COMPARABLE",
  "item_ref": "item_123",
  "item_level": 5,
  "student_level": null,
  "message": "No se puede comparar nivel (uno es null)"
}
```

**Acción:** Item se incluye en megalista (no se filtra)

---

### 3.4. `STATE_CALCULATION_ERROR`

**Cuándo:** Error al calcular estado (fecha inválida, tipo desconocido, etc.)

**Payload:**
```json
{
  "type": "STATE_CALCULATION_ERROR",
  "item_ref": "item_123",
  "message": "Error calculando estado: Invalid date"
}
```

**Acción:** Estado fallback a `"never"`

---

### 3.5. `CATALOG_FETCH_ERROR`

**Cuándo:** Error al obtener catálogo completo (query falla)

**Payload:**
```json
{
  "type": "CATALOG_FETCH_ERROR",
  "message": "Error obteniendo catálogo: connection timeout"
}
```

**Acción:** Continuar con arrays vacíos, megalista puede estar incompleta

---

### 3.6. `STATE_MISSING_ITEM_REF`

**Cuándo:** Estado en `cleaning_item_state` sin `item_ref`

**Payload:**
```json
{
  "type": "STATE_MISSING_ITEM_REF",
  "state_id": "uuid-...",
  "message": "Estado sin item_ref, saltando"
}
```

**Acción:** Estado se omite (no aparece en megalista)

---

### 3.7. `ITEM_MISSING_REF`

**Cuándo:** Item del catálogo sin `item_ref`

**Payload:**
```json
{
  "type": "ITEM_MISSING_REF",
  "item_id": 123,
  "message": "Item sin item_ref, saltando"
}
```

**Acción:** Item se omite (no aparece en megalista)

---

## 4. QUÉ SIGNIFICA VER "NO_RESUELTO" EN UI

### 4.1. Item con nombre "NO_RESUELTO"

**Significa:**
- El item existe en `cleaning_item_state` (tiene estado de limpieza)
- Pero NO existe en `items_transmutaciones` (catálogo)
- O el catálogo no se pudo cargar

**Acción recomendada:**
- Revisar `warnings[]` en respuesta JSON
- Verificar que el item existe en catálogo
- Si el item fue eliminado del catálogo, el estado puede quedar huérfano

---

### 4.2. Lista "Sin lista (NO_RESUELTO)"

**Significa:**
- El item tiene `lista_id` que no existe en `listas_transmutaciones`
- O `lista_id` es null/undefined

**Acción recomendada:**
- Revisar `warnings[]` en respuesta JSON
- Verificar que la lista existe en catálogo
- Si la lista fue eliminada, los items quedan huérfanos

---

### 4.3. Lista "unknown"

**Significa:**
- Lista fallback creada para items no resueltos
- Siempre tiene `lista_id: "unknown"`

**Acción recomendada:**
- Revisar `warnings[]` para identificar items problemáticos
- Corregir datos en catálogo o `cleaning_item_state`

---

## 5. POR QUÉ ES CANÓNICO

### 5.1. Robustez > Perfección

**Principio:**
- Es mejor mostrar una megalista incompleta que un error 500
- El Master puede ver qué items tienen problemas (warnings)
- La UI sigue siendo funcional aunque algunos items no se resuelvan

---

### 5.2. Diagnóstico Visible

**Ventajas:**
- `warnings[]` permite identificar problemas de datos
- No se ocultan errores (todo queda registrado)
- Permite corregir datos sin romper el sistema

---

### 5.3. Tolerancia a Fallos

**Escenarios cubiertos:**
- Catálogo parcialmente corrupto
- Items huérfanos en `cleaning_item_state`
- Listas eliminadas con items asociados
- Niveles null/undefined
- Errores de cálculo de fechas

---

## 6. IMPLEMENTACIÓN TÉCNICA

### 6.1. Puntos de Fail-Open

**1. Obtención de catálogo:**
```javascript
try {
  allItems = await query(...);
} catch (error) {
  // Fail-open: continuar con array vacío
  allItems = [];
  warnings.push({ type: 'CATALOG_FETCH_ERROR', ... });
}
```

**2. Resolución de item:**
```javascript
const item = itemsByRef[state.item_ref];
if (!item) {
  // Fail-open: usar fallback
  warnings.push({ type: 'ITEM_NOT_RESOLVED', ... });
  // Continuar con item fallback
}
```

**3. Resolución de lista:**
```javascript
const lista = listasById[item.lista_id];
if (!lista) {
  // Fail-open: usar lista "unknown"
  lista = { id: 'unknown', nombre: 'Sin lista (NO_RESUELTO)', ... };
  warnings.push({ type: 'LIST_NOT_RESOLVED', ... });
}
```

**4. Comparación de nivel:**
```javascript
if (itemNivel !== null && nivelEfectivoNum !== null) {
  if (itemNivel > nivelEfectivoNum) continue;
} else {
  // Fail-open: no filtrar si no se puede comparar
  warnings.push({ type: 'LEVEL_NOT_COMPARABLE', ... });
}
```

**5. Cálculo de estado:**
```javascript
try {
  itemState = calculateItemState(state, item, listaTipo);
} catch (error) {
  // Fail-open: usar 'never' como fallback
  itemState = 'never';
  warnings.push({ type: 'STATE_CALCULATION_ERROR', ... });
}
```

**6. Agrupación:**
```javascript
// Asegurar que listsMap[lista.id] existe
if (!listsMap[lista.id]) {
  listsMap[lista.id] = { never: [], important: [], ... };
}

// Asegurar que el grupo de estado existe
if (!listsMap[lista.id][itemState]) {
  listsMap[lista.id][itemState] = [];
}
```

---

### 6.2. Query Directa para Items

**Problema original:**
- `catalogRepo.listItems()` requiere `listaId` (obligatorio)
- No hay método para obtener todos los items

**Solución:**
- Query directa a `items_transmutaciones`
- Fail-open si la query falla

```javascript
const itemsResult = await query(`
  SELECT * FROM items_transmutaciones
  WHERE (status = 'active' OR activo = true)
  ORDER BY priority ASC, nivel ASC NULLS LAST, created_at ASC
`);
```

---

## 7. VERIFICACIÓN

### 7.1. Checklist de Fail-Open

- ✅ Endpoint nunca lanza 500 por datos incompletos
- ✅ Todos los warnings están estructurados
- ✅ Fallbacks canónicos aplicados
- ✅ UI renderiza items "NO_RESUELTO" correctamente
- ✅ `warnings[]` presente cuando hay problemas

---

### 7.2. Pruebas Recomendadas

1. **Item no encontrado:**
   - Crear estado en `cleaning_item_state` con `item_ref` inexistente
   - Verificar que aparece como "NO_RESUELTO" con warning

2. **Lista no encontrada:**
   - Crear item con `lista_id` inexistente
   - Verificar que aparece en lista "unknown"

3. **Nivel null:**
   - Item con `nivel = null`
   - Verificar que no se filtra y aparece warning

4. **Catálogo falla:**
   - Simular error en query de catálogo
   - Verificar que megalista se construye con arrays vacíos

---

## 8. NOTAS IMPORTANTES

### 8.1. Warnings NO son Errores

**Importante:**
- `warnings[]` es diagnóstico, no error
- El sistema funciona correctamente con warnings
- Warnings indican datos inconsistentes, no bugs del código

---

### 8.2. Corrección de Datos

**Si aparecen warnings:**
1. Revisar `warnings[]` en respuesta JSON
2. Identificar items/listas problemáticos
3. Corregir datos en catálogo o `cleaning_item_state`
4. Warnings desaparecerán en próxima carga

---

### 8.3. Performance

**Consideraciones:**
- Fail-open puede generar más warnings de lo necesario
- Pero garantiza que el sistema nunca rompe
- Performance no se ve afectada (solo añade checks null)

---

## 9. REFERENCIAS

- **Servicio:** `src/core/master/services/alquimia-alumno-megalist-service.js`
- **Panel UI:** `docs/MASTER_ALQUIMIA_ALUMNO_PANEL_V1.md`
- **Contratos API:** `docs/MASTER_API_ALQUIMIA_ALUMNO_CONTRACTS_V1.md`
- **Diagnóstico:** `docs/DIAGNOSTICO_REALIDAD_CLEANING_V1.md`

---

**Estado:** ✅ Implementado y documentado

**Principio:** Robustez > Perfección
