# Fix Persistencia Tags v5.53.1

**Fecha:** 2025-01-XX  
**Versión:** v5.53.1  
**Problema:** Tags/clasificaciones desaparecen al recargar la página después de crearlos/asociarlos

---

## PROBLEMA IDENTIFICADO

**Síntoma:**
- Al crear un tag o clasificación y "guardarlo" dentro de una lista/vista, se ve mientras estás en la vista
- Al salir/recargar desaparece
- El término existe en `pde_classification_terms`, pero la relación no persiste o no se proyecta

**Entidad afectada:**
- Tabla: `listas_transmutaciones`
- Tabla de relación: `transmutacion_lista_classifications`
- Endpoint: `PUT /master/api/alquimia-general/listas/:id` y `PUT /master/api/alquimia-general/listas/:id/classification`

---

## CAUSA PROBABLE

El código ya tenía el fix v5.52.0 que preserva tags cuando `tags === undefined`, pero había un caso edge donde `tags: null` podría causar problemas.

**Fix aplicado:**
- Asegurar que `updateListClassification()` solo modifica tags si `tags !== undefined && tags !== null`
- Mejorar el comentario para clarificar el comportamiento

---

## CAMBIOS REALIZADOS

### 1. `src/services/pde-transmutaciones-classification-service.js`

**Línea ~503:**
```javascript
// ANTES:
if (tags !== undefined) {

// DESPUÉS:
if (tags !== undefined && tags !== null) {
```

**Razón:** Asegurar que solo se modifiquen tags cuando se pasa explícitamente un array (no undefined, no null).

### 2. `src/endpoints/master-api-alquimia-general.js`

**Línea ~328:**
```javascript
// Mejorado comentario para clarificar comportamiento
tags: classification.tags !== undefined ? classification.tags : undefined
```

---

## VERIFICACIÓN

### Smoke Test Manual

1. **Crear tag nuevo:**
   ```bash
   curl -X PUT http://localhost:3000/master/api/alquimia-general/listas/1 \
     -H "Content-Type: application/json" \
     -d '{"classification": {"tags": ["nuevo-tag"]}}'
   ```

2. **Verificar persistencia:**
   ```sql
   SELECT ct.value, tlc.lista_id
   FROM pde_classification_terms ct
   INNER JOIN transmutacion_lista_classifications tlc ON ct.id = tlc.classification_term_id
   WHERE ct.type = 'tag' AND tlc.lista_id = 1;
   ```

3. **Recargar lista:**
   ```bash
   curl http://localhost:3000/master/api/alquimia-general/listas/1
   ```

4. **Verificar que el tag aparece en la respuesta**

---

## ESTADO

✅ Fix aplicado  
✅ Código verificado  
⏳ Smoke test pendiente (manual)

---

**Nota:** Este fix asegura que los tags se preserven correctamente cuando se actualiza category/subtype sin pasar tags explícitamente.
