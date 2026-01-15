# Forensics Fix: Refresh Wiring v1

**Fecha:** 2025-01-27  
**Versión:** 5.74.2  
**Estado:** IMPLEMENTADO  
**Dominio:** MASTER (AuriPortal)

---

## Síntoma

Tras limpiar un item desde el flotante en modo proyección, el estado seguía apareciendo como "never" aunque se había limpiado hace segundos.

**Ejemplo:**
- Usuario en modo proyección
- Abre flotante (VER)
- Limpia estudiante (shared)
- POST ejecutado correctamente
- **PROBLEMA:** Flotante NO se refresca
- Estado sigue mostrando "never" (datos antiguos)

---

## Evidencia

**Referencia:** `docs/AUDITORIA_REFRESH_WIRING_FASE1.md`

**Hallazgos:**
1. El flotante puede estar abierto en modo proyección
2. El adapter `refetch()` solo refrescaba flotante si `view_mode === 'operativa'` (línea 5988)
3. Mutaciones desde proyección NO refrescaban el flotante si estaba abierto

**Confirmación:**
- Logs mostraban POST ejecutado
- Logs mostraban `loadListProjection()` ejecutado
- Logs NO mostraban `handleVerItem()` ejecutado desde proyección
- El flotante seguía mostrando datos antiguos

---

## Causa Raíz

**Asunción incorrecta:**
- El adapter asumía que el flotante solo existe en modo operativa
- El refresh del flotante estaba dentro de `if (state.projection.mode === 'operativa')`
- Mutaciones desde proyección NO entraban en esa condición

**Código problemático:**
```javascript
// Línea 5988-6000 (ANTES)
if (state.projection.mode === 'operativa') {
  // ...
  if (state.modal?.item && context.item_ref && state.modal.item.item_ref === context.item_ref) {
    await handleVerItem(...);
  }
}
// ❌ Si view_mode === 'proyeccion', el flotante NO se refresca
```

**Impacto:**
- Si el usuario está en modo proyección y tiene el flotante abierto
- Hace cualquier mutación (clean, reset)
- El flotante NO se refresca
- El estado sigue mostrando datos antiguos

---

## Fix Aplicado

### Fix: Refresh Flotante Independiente del view_mode

**Archivo:** `public/js/master/master-alquimia-general-client.js`

**Cambios:**
- Extraer lógica de refresh de flotante fuera del `if (view_mode === 'operativa')`
- Crear variable `shouldRefreshFlotante` independiente del `view_mode`
- Ejecutar `handleVerItem()` si flotante abierto e `item_ref` coincide, independientemente del modo

**Líneas modificadas:**
- Línea ~5967: Crear `shouldRefreshFlotante` antes de los condicionales de `view_mode`
- Línea ~5970-6001: Refactorizar `refetch()` para refrescar flotante independientemente del `view_mode`
- Línea ~5988-6000: Mover refresh de flotante fuera del `if (view_mode === 'operativa')`

**Código después del fix:**
```javascript
// FIX CRÍTICO: Refrescar flotante SIEMPRE si está abierto (independiente del view_mode)
const shouldRefreshFlotante = state.modal?.item && 
                               context.item_ref && 
                               state.modal.item.item_ref === context.item_ref;

// Determinar qué refetch hacer según vista activa
if (state.projection.mode === 'proyeccion') {
  await loadListProjection();
} else if (state.projection.mode === 'operativa') {
  await loadItems(state.listaActiva.id);
}

// FIX CRÍTICO: Refrescar flotante SIEMPRE si está abierto (independiente del view_mode)
if (shouldRefreshFlotante) {
  await handleVerItem(state.modal.item, modalCleanLayer, modalViewLayer);
}
```

---

### Logs Forenses Añadidos

**Archivo:** `public/js/master/master-alquimia-general-client.js`

**Logs añadidos:**
- `[REFRESH][POST]` - Antes de cada POST (mark-clean-all, mark-clean-student, reset-item, reset-list)
- `[REFRESH][GET]` - Antes de cada GET (loadListProjection, loadItems, handleVerItem)

**Líneas modificadas:**
- Línea ~2128: Log `[REFRESH][POST] mark-clean-all`
- Línea ~3389: Log `[REFRESH][POST] mark-clean-student`
- Línea ~1434: Log `[REFRESH][GET] list-projection`
- Línea ~1062: Log `[REFRESH][GET] items`
- Línea ~1999: Log `[REFRESH][GET] flotante (students)`
- Línea ~5758: Log `[REFRESH][POST] reset-item`
- Línea ~5812: Log `[REFRESH][POST] reset-list`

---

## Cómo Verificar

### 1. Verificar Refresh de Flotante desde Proyección

**Pasos:**
1. Abrir `/master/templo-luz/alquimia-general`
2. Cambiar a modo "Proyección"
3. Seleccionar lista y scope "Alumno"
4. Abrir flotante (VER) de un item
5. Limpiar estudiante (shared) desde el flotante
6. Verificar en logs:
   - `[REFRESH][POST] mark-clean-student`
   - `[REFRESH][GET] list-projection`
   - `[REFRESH][GET] flotante (students)` ✅ (debe aparecer)
7. Verificar en UI:
   - Flotante muestra estado actualizado (no "never")
   - Proyección muestra estado actualizado

**Logs esperados:**
```
[REFRESH][POST] mark-clean-student { endpoint: '...', payload: {...}, timestamp: '...' }
[REFRESH_ENGINE][ALQG][REFETCH] Iniciando { ... }
[REFRESH][GET] list-projection { endpoint: '...', params: {...}, timestamp: '...' }
[REFRESH][GET] flotante (students) { endpoint: '...', params: {...}, timestamp: '...' }
[CPM_V2][INPUT] { ... last_cleaned_at: '2025-01-27T...' }  // ✅ Debe mostrar fecha nueva
```

---

### 2. Verificar Refresh de Flotante después de Reset

**Pasos:**
1. Abrir `/master/templo-luz/alquimia-general`
2. Cambiar a modo "Proyección"
3. Seleccionar lista y scope "Alumno"
4. Abrir flotante (VER) de un item
5. Hacer reset del item desde proyección
6. Verificar en logs:
   - `[REFRESH][POST] reset-item`
   - `[REFRESH][GET] list-projection`
   - `[REFRESH][GET] flotante (students)` ✅ (debe aparecer)
7. Verificar en UI:
   - Flotante muestra estado "pending" (post-reset)
   - Proyección muestra estado actualizado

---

### 3. Verificar Coherencia POST → GET → CPM

**Comandos:**
```bash
# Buscar secuencia POST → GET en logs
grep -r "\[REFRESH\]\[POST\]" logs/ | head -5
# Para cada POST, buscar el GET correspondiente
grep -r "\[REFRESH\]\[GET\]" logs/ | grep "flotante\|list-projection" | head -10

# Verificar que CPM ve datos nuevos
grep -r "\[CPM_V2\]\[INPUT\]" logs/ | grep "last_cleaned_at" | tail -5
```

**Verificación:**
- Cada `[REFRESH][POST]` debe tener al menos un `[REFRESH][GET]` correspondiente
- Si flotante está abierto, debe haber `[REFRESH][GET] flotante`
- `[CPM_V2][INPUT]` después del POST debe mostrar `last_cleaned_at` nuevo (no null)

---

## Prevención (Rules de Cursor)

**Actualizado:** `.cursorrules` (sección CONSTITUCIÓN CLEANING ENGINE v1)

**Nueva regla:**
- "Refresh de flotante es independiente del view_mode"
- "Toda mutación debe tener refetch explícito de sus vistas dependientes"

**Verificación automática:**
- Assembly check: Verificar que `shouldRefreshFlotante` no depende de `view_mode`
- Logs forenses: `[REFRESH][POST]` seguido de `[REFRESH][GET]` con mismo `item_ref`

---

## Archivos Modificados

1. `public/js/master/master-alquimia-general-client.js`
   - Fix: Refresh flotante independiente del `view_mode`
   - Logs forenses: `[REFRESH][POST]` y `[REFRESH][GET]`

2. `docs/ALQUIMIA_GENERAL_REFRESH_MODEL.md`
   - Nuevo documento canónico

3. `docs/INVARIANTES_CONSTITUCIONALES.md`
   - Invariante 14 añadido

4. `docs/FORENSICS_REFRESH_FIX_V1.md`
   - Este documento

5. `docs/AUDITORIA_REFRESH_WIRING_FASE1.md`
   - Auditoría completa del wiring

---

## Commit

```
v5.74.2 master: fix refresh wiring - flotante independiente de view_mode

Archivos modificados:
- public/js/master/master-alquimia-general-client.js (refresh flotante + logs forenses)

Problema corregido:
- Flotante NO se refrescaba desde modo proyección
- Mutaciones desde proyección no actualizaban el flotante si estaba abierto

Fix aplicado:
- Refresh de flotante ahora es independiente del view_mode
- shouldRefreshFlotante se evalúa antes de los condicionales de view_mode
- Logs forenses [REFRESH][POST] y [REFRESH][GET] añadidos

Verificación:
- Logs muestran [REFRESH][GET] flotante después de mutaciones desde proyección
- Flotante muestra estado actualizado sin recargar página
- CPM v2 recibe datos frescos (last_cleaned_at nuevo)
```

---

## Referencias

- **Auditoría:** `docs/AUDITORIA_REFRESH_WIRING_FASE1.md`
- **Refresh Model:** `docs/ALQUIMIA_GENERAL_REFRESH_MODEL.md`
- **Invariantes:** `docs/INVARIANTES_CONSTITUCIONALES.md` (invariante 14)
- **Refresh Engine:** `public/js/master/master-refresh-engine-v1.js`

---

**FIN DE DOCUMENTACIÓN FORENSICS FIX**
