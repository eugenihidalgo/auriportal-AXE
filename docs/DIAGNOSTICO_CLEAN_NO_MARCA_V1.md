# 🔍 DIAGNÓSTICO: CLEAN No Marca Como Limpio (RESET → CLEAN)

**Fecha:** 2026-01-17  
**Versión:** 5.78.1  
**Estado:** EN INVESTIGACIÓN

---

## 📋 PROBLEMA

Después de ejecutar RESET (shared) en `te_item_111` para alumno `44a51f8f-4ed5-4291-ad13-5f07a99c636b`, al ejecutar CLEAN (shared) **no se marca como limpio**.

**Estado Esperado:**
- `state: 'reseteado'` → `state: 'reviewed'`
- `last_cleaned_at: null` → `last_cleaned_at: <timestamp>`

**Estado Real:**
- `state: 'reseteado'` (no cambia)
- `last_cleaned_at: null` (no cambia)

---

## 🔍 EVIDENCIA EN LOGS

### RESET Ejecutado Correctamente
```
Timestamp: 2026-01-17T13:43:45.284Z
Action: reset_item_recurrente
Item: te_item_111
Student: 44a51f8f-4ed5-4291-ad13-5f07a99c636b
Execution Key: reset:te_item_111:44a51f8f-4ed5-4291-ad13-5f07a99c636b:shared:2026-01-17
Layers Affected: ["shared"]
```

### Estado Actual (Último GET)
```javascript
{
  state: 'reseteado',
  last_cleaned_at: null,
  effective_since: '2026-01-17T13:43:45.281Z',
  state_by_view_layer: {
    shared: { state: 'reseteado', visual_state: 'reseteado' },
    pde: { state: 'reviewed', visual_state: 'reviewed' },
    effective: { state: 'reviewed', visual_state: 'reviewed' }
  }
}
```

### ❌ NO HAY LOGS DE CLEAN
**No se encuentra:**
- `[CLEAN][WRITE]` logs del cleaning engine
- `POST /master/api/alquimia-general/items/.../mark-clean-student` en logs
- `markCleanStudent` ejecutándose

---

## 🔎 HIPÓTESIS

### Hipótesis 1: POST No Llega al Servidor
**Causa posible:**
- Error en `performAction()` frontend
- Error de routing (ruta no registrada)
- Error de autenticación/autorización

**Verificación necesaria:**
- Revisar logs de `POST /master/api/alquimia-general/items/.../mark-clean-student`
- Revisar errores en consola del navegador
- Verificar que la ruta esté registrada en `master-route-registry.js`

### Hipótesis 2: Idempotencia Bloquea Actualización
**Causa posible:**
- `execution_key` duplicado (ya existe evento con mismo key)
- `already_applied: true` retorna estado sin actualizar
- `[CLEAN][IDEMPOTENCY_OK]` log aparece pero no actualiza

**Verificación necesaria:**
- Revisar logs `[CLEAN][IDEMPOTENCY]`
- Revisar `execution_key` generado vs eventos existentes
- Verificar si `currentState` se retorna sin actualizar (línea 771)

### Hipótesis 3: Error Silencioso en markCleanStudent
**Causa posible:**
- Error capturado en try/catch pero no logueado
- `state` retorna `null` o `undefined`
- Excepción que interrumpe el flujo sin log

**Verificación necesaria:**
- Revisar logs `[CLEAN][ERROR]` o `Error en markCleanStudent`
- Verificar que el endpoint retorne error 400/500 si falla

---

## 🧪 PASOS PARA REPRODUCIR

1. **RESET ejecutado:** ✅ `te_item_111` para `44a51f8f-4ed5-4291-ad13-5f07a99c636b` (shared)
2. **Estado verificado:** ✅ `state: 'reseteado'`, `last_cleaned_at: null`
3. **CLEAN ejecutado:** ❓ Click en "marcar revisado" (shared)
4. **Estado verificado:** ❌ `state: 'reseteado'` (debería ser `'reviewed'`)

---

## 🔧 ACCIONES DE DIAGNÓSTICO

### 1. Verificar si POST llega al servidor
```bash
pm2 logs aurelinportal --lines 0 | grep -E "POST.*mark-clean-student|req_.*44a51f8f"
```

### 2. Verificar execution_key generado
Revisar código:
```javascript
// src/core/master/services/cleaning-engine-service.js línea ~598
execution_key: `mark_clean:${item_ref}:${student_uuid}:${clean_layer}:${date}`
```

### 3. Verificar idempotencia
Revisar si existe evento con mismo execution_key:
```sql
SELECT * FROM cleaning_events 
WHERE execution_key = 'mark_clean:te_item_111:44a51f8f-4ed5-4291-ad13-5f07a99c636b:shared:2026-01-17'
AND action_type = 'mark_clean'
AND clean_layer = 'shared';
```

### 4. Verificar estado actual en DB
```sql
SELECT * FROM cleaning_item_state
WHERE student_uuid = '44a51f8f-4ed5-4291-ad13-5f07a99c636b'
AND item_ref = 'te_item_111';
```

---

## 📝 NOTAS

- **Versión:** 5.78.1 (hotfix aplicado)
- **Bug-C fix aplicado:** Comparación `>=` en CPM para igualdad de timestamps
- **Monitoreo activo:** Comando en background capturando logs nuevos

---

**SIGUIENTE PASO:** Esperar click del usuario en "marcar revisado" y analizar logs nuevos.
