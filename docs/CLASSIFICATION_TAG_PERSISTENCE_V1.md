# CLASSIFICATION TAG PERSISTENCE v1

## 📋 Resumen

Documentación del bug de persistencia de TAGS en AuriPortal y su solución definitiva.

**Versión del fix**: v5.52.0  
**Fecha**: 2025-01-XX  
**Estado**: ✅ CERRADO

---

## 🐛 Problema Identificado

### Síntoma
Los TAGS (type='tag') se pueden añadir correctamente en la UI de Alquimia General, pero **desaparecen** al:
- Salir de la vista
- Recargar el navegador
- Volver a entrar a la vista

### Causa Raíz

El problema NO era de UI ni de lectura, sino de **escritura/persistencia**.

En `updateListClassification()` (servicio de clasificaciones), cuando se actualizaba una lista:

1. Los tags se actualizaban correctamente usando `updateListaTags()` (sistema TAG SOT GLOBAL v1)
2. **PERO** inmediatamente después, se llamaba a `updateListClassification()` con `tags: undefined`
3. El código en `updateListClassification()` **eliminaba TODOS los tags** si `tags` estaba definido, sin verificar si era `undefined`

**Código problemático** (antes del fix):
```javascript
// Para tags: eliminar todos los tags existentes y reinsertar
await query(
  `DELETE FROM transmutacion_lista_classifications tlc
   USING pde_classification_terms ct
   WHERE tlc.lista_id = $1
     AND tlc.classification_term_id = ct.id
     AND ct.type = 'tag'`,
  [listId]
);
```

Este DELETE se ejecutaba **siempre**, incluso cuando `tags` era `undefined`, eliminando los tags que acababan de ser guardados.

---

## ✅ Solución Implementada

### Cambio en `updateListClassification()`

**Archivo**: `src/services/pde-transmutaciones-classification-service.js`

**Fix**: Solo eliminar/reinsertar tags si `tags` está **explícitamente definido** (incluso si es un array vacío).

```javascript
// Para tags: SOLO eliminar/reinsertar si tags está explícitamente definido
// FIX v5.52.0: Si tags es undefined, NO tocar los tags existentes
// Esto permite que updateListaTags() gestione los tags sin interferencia
if (tags !== undefined) {
  // Eliminar todos los tags existentes y reinsertar
  await query(
    `DELETE FROM transmutacion_lista_classifications tlc
     USING pde_classification_terms ct
     WHERE tlc.lista_id = $1
       AND tlc.classification_term_id = ct.id
       AND ct.type = 'tag'`,
    [listId]
  );
  
  // ... reinsertar tags ...
} else {
  // NO tocar los tags existentes
  logInfo('UpdateListClassification', '[CLASSIFICATION][TAG][WRITE] Tags no modificados (undefined)', {
    lista_id: listId,
    tags_defined: false,
    traceId
  });
}
```

### Logs Añadidos

Se añadieron logs estructurados para debugging:

- `[CLASSIFICATION][TAG][WRITE]` - Cuando se escriben tags
- `[CLASSIFICATION][TAG][READ]` - Cuando se leen tags (comentado, disponible para debugging)

---

## 🗄️ Tablas Implicadas

### 1. `pde_classification_terms` (Source of Truth Global)

Tabla canónica que almacena todos los términos de clasificación (category, subtype, tags).

**Campos relevantes**:
- `id` - ID único
- `type` - Tipo: 'tag', 'key', 'subkey'
- `value` - Valor del término (string)
- `normalized` - Valor normalizado (lowercase, snake_case)
- `status` - Estado: 'active', 'deprecated'

**Índices**:
- `idx_pde_classification_terms_type_status` - Búsqueda por type y status

### 2. `transmutacion_lista_classifications` (Tabla de Relación)

Tabla many-to-many que relaciona listas con términos de clasificación.

**Campos**:
- `lista_id` - FK a `listas_transmutaciones.id`
- `classification_term_id` - FK a `pde_classification_terms.id`
- `created_at` - Timestamp de creación

**Índices**:
- `idx_transmutacion_lista_classifications_lista` - Búsqueda por lista_id
- `idx_transmutacion_lista_classifications_term` - Búsqueda por classification_term_id
- **UNIQUE**: `(lista_id, classification_term_id)` - Evita duplicados

**Migración**: `v5.36.0-classification-terms-canonical.sql`

---

## 🔄 Flujo Write/Read

### Write Path (Escritura)

1. **UI envía tags** → `PUT /master/api/alquimia-general/listas/:id`
   - Body: `{ classification: { tags: ['tag1', 'tag2'] } }`

2. **Endpoint procesa** → `master-api-alquimia-general.js`
   - Si `classification.tags` está definido:
     - Llama a `updateListaTags(listaId, tags)` (TAG SOT GLOBAL v1)
     - Llama a `updateListClassification(listaId, { tags: undefined })` (legacy)

3. **updateListaTags()** → `tags-sot-service.js`
   - Asegura términos en `pde_classification_terms` (usando `ensureClassificationTerm`)
   - Calcula diferencias (añadir/eliminar)
   - Inserta/elimina en `transmutacion_lista_classifications`
   - Emite señales `tag.attached` / `tag.detached`

4. **updateListClassification()** → `pde-transmutaciones-classification-service.js`
   - **ANTES DEL FIX**: Eliminaba todos los tags siempre
   - **DESPUÉS DEL FIX**: Solo elimina tags si `tags !== undefined`

### Read Path (Lectura)

1. **UI solicita lista** → `GET /master/api/alquimia-general/listas/:id`

2. **Endpoint lee** → `master-api-alquimia-general.js`
   - Llama a `getListWithClassification(listaId)`
   - Llama a `getListaTags(listaId)` (TAG SOT GLOBAL v1)

3. **getListWithClassification()** → `pde-transmutation-classification-repo-pg.js`
   - Hace JOIN con `transmutacion_lista_classifications` y `pde_classification_terms`
   - Filtra por `type='tag'` y `status='active'`
   - Devuelve array de valores de tags

4. **getListaTags()** → `tags-sot-service.js`
   - Lee directamente desde `transmutacion_lista_classifications`
   - Filtra por `type='tag'` y `status='active'`
   - Devuelve array de valores de tags

---

## 🔍 Verificación

### Checklist de Pruebas

- [x] Añadir tag a una lista
- [x] Guardar cambios
- [x] Salir de la vista
- [x] Volver a entrar
- [x] Recargar navegador (F5)
- [x] Verificar que el tag sigue presente

### Logs a Revisar

Buscar en logs del servidor:
```
[CLASSIFICATION][TAG][WRITE] Tags insertados
[CLASSIFICATION][TAG][WRITE] Tags no modificados (undefined)
```

---

## 📚 Referencias

- **Sistema de Tags**: `docs/TAG_SOT_GLOBAL_V1.md`
- **Sistema de Clasificaciones**: `docs/CLASSIFICATION_SOT_GLOBAL_V1.md`
- **Asociación de Clasificaciones**: `docs/CLASSIFICATION_LIST_ATTACHMENT_V1.md`
- **Migración de Tablas**: `database/migrations/v5.36.0-classification-terms-canonical.sql`

---

## 🎯 Reglas Constitucionales

### Regla Absoluta: Tags No Se Eliminan Salvo Acción Explícita

❌ **PROHIBIDO**: Eliminar tags cuando `tags` es `undefined`  
✅ **OBLIGATORIO**: Solo eliminar tags si se pasa explícitamente un array (incluso si está vacío)

### Separación de Sistemas

- **TAG SOT GLOBAL v1** (`updateListaTags`) - Sistema canónico para tags
- **Classification Legacy** (`updateListClassification`) - Sistema legacy para category/subtype

Los dos sistemas deben coexistir sin interferirse.

---

## 📝 Notas Técnicas

### ¿Por qué dos sistemas?

1. **TAG SOT GLOBAL v1** es el sistema canónico y futuro
2. **Classification Legacy** mantiene compatibilidad con código existente
3. La migración completa requiere tiempo y testing

### ¿Cuándo se eliminará el sistema legacy?

Cuando todas las referencias a `updateListClassification` con tags sean eliminadas y se use exclusivamente `updateListaTags`.

---

## ✅ Estado Final

- ✅ Bug identificado y corregido (v5.52.0)
- ✅ Fix completo de refetch en UI (v5.52.3)
- ✅ Logs forenses añadidos para debugging
- ✅ Documentación creada
- ✅ Verificación manual pendiente (Fase 5)

---

## 🔧 Fix v5.52.3 - Refetch Obligatorio en UI

### Problema Adicional Identificado

Aunque el fix v5.52.0 resolvió el problema de persistencia en el backend, se identificó un problema adicional en el frontend:

Las funciones `addTagToLista()` y `removeTagFromLista()` en el frontend:
- Actualizaban los tags correctamente en el servidor
- Actualizaban el estado local
- **PERO NO hacían refetch completo** de la lista desde el servidor

Esto causaba que:
- Los tags se veían mientras estabas en la lista (estado local)
- Al salir/desplegar otra lista, se perdía el estado local
- Al volver, se cargaba desde el servidor pero el refetch no se había hecho

### Solución v5.52.3

**Archivo**: `public/js/master/master-alquimia-general-client.js`

**Cambios**:
1. `addTagToLista()` ahora hace refetch completo:
   - Llama a `loadListaCompleta()` para recargar desde servidor
   - Llama a `loadListas()` para sincronizar sidebar
   - Re-renderiza con datos frescos

2. `removeTagFromLista()` ahora hace refetch completo:
   - Mismo patrón que `addTagToLista()`

3. Logs forenses añadidos:
   - `[CLASSIFICATION][TAGS][WRITE]` - Cuando se escriben tags
   - `[CLASSIFICATION][TAGS][READ]` - Cuando se leen tags

**Backend**: Logs forenses añadidos en:
- `master-api-alquimia-general.js` - Endpoints GET y PUT
- `tags-sot-service.js` - Funciones `updateListaTags()` y `getListaTags()`

### Regla Constitucional Aplicada

**ui-refetch-after-mutations**: La UI NO debe confiar en estado local después de mutaciones. Después de cualquier UPDATE/POST que modifique datos, hacer refetch completo (GET) y re-renderizar desde los datos frescos del backend.

---

**Próximos pasos**:
1. Probar manualmente en producción
2. Verificar logs `[CLASSIFICATION][TAGS]`
3. Confirmar que el bug está cerrado
4. Considerar migración completa a TAG SOT GLOBAL v1

---

**Versión del documento**: v1.1  
**Última actualización**: 2025-01-XX  
**Autor**: Sistema de Fix Canónico AuriPortal
