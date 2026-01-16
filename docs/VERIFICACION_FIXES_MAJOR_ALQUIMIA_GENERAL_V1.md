# Verificación de Fixes Major Alquimia General v1

**Fecha**: 2024-12-19  
**Fase**: 3 - VERIFICACIÓN  
**Versión**: v1.0.0

## Objetivo

Verificar que los fixes implementados en FASE 2 resuelven los problemas diagnosticados y no introducen regresiones.

---

## ✅ FIX 1: EFFECTIVE (RECURRENTE) — CRÍTICO

### Verificación Backend

#### 1.1 Flotante Students - Endpoint GET
**Endpoint**: `GET /master/api/alquimia-general/items/:item_ref/students?view_layer=effective`

**Logs esperados**:
```
[GET_STUDENTS] Iniciando getStudentsForItem
[GET_STUDENTS] item_kind=recurrente, view_layer=effective
[CPM_V2][INPUT] Calculando estado effective
[CPM_V2][OUTPUT] state_by_view_layer.effective presente
```

**Respuesta esperada**:
```json
{
  "ok": true,
  "students": [
    {
      "student_uuid": "...",
      "state_by_view_layer": {
        "shared": { "state": "...", "visual_state": "..." },
        "pde": { "state": "...", "visual_state": "..." },
        "effective": { "state": "...", "visual_state": "..." }  // ✅ DEBE EXISTIR
      },
      "available_layers": ["shared", "pde", "effective"]
    }
  ]
}
```

**Verificación**:
- [ ] `state_by_view_layer.effective` está presente en TODOS los estudiantes
- [ ] `effective` está en `available_layers`
- [ ] NO hay logs `[BUG-011] state_by_view_layer no disponible - BLOQUEANDO render`

#### 1.2 Flotante Students - UI
**Comportamiento esperado**:
- [ ] Botón "EFFECTIVE" está habilitado para items recurrentes
- [ ] Al hacer clic en "EFFECTIVE", el flotante se renderiza correctamente
- [ ] NO aparece mensaje de bloqueo `[BUG-011]`
- [ ] Los estudiantes muestran estado correcto en columna EFFECTIVE

**Logs esperados en consola**:
```
[UI][FLOTANTE] Cambiando layerView a effective
[UI][GET] GET /master/api/alquimia-general/items/.../students?view_layer=effective
[UI][FLOTANTE] Renderizando estudiantes con state_by_view_layer.effective
```

---

## ✅ FIX 2: RESET ALL (RECURRENTE)

### Verificación Backend

#### 2.1 Reset Item ALL - Endpoint POST
**Endpoint**: `POST /master/api/alquimia-general/reset-item-all`

**Payload**:
```json
{
  "item_ref": "transmutacion:lista:1:item:1",
  "item_kind": "recurrente",
  "scope": "all",
  "clean_layer": "pde"
}
```

**Logs esperados**:
```
[RESET][ITEM][ALL][CANONICAL] resetAllStudentsItemProgress entrada
[RESET][ALL] Estudiantes activos obtenidos (total_students: N)
[RESET][CANONICAL] Reset aplicado a capa (clean_layer: pde)
[RESET][ALL][CANONICAL] Reset ALL completado (applied: X, skipped: Y, total: N)
```

**Respuesta esperada**:
```json
{
  "ok": true,
  "reset": true,
  "item_ref": "...",
  "item_kind": "recurrente",
  "applied": 10,
  "skipped": 2,
  "total": 12,
  "skipped_breakdown": {
    "paused": 1,
    "error": 0,
    "other": 1
  },
  "layers_affected": ["pde"],
  "mode": "event"
}
```

**Verificación**:
- [ ] Endpoint devuelve `200 OK`
- [ ] `applied` + `skipped` = `total`
- [ ] Solo afecta capa `pde` (no `shared`)
- [ ] Estudiantes pausados están en `skipped_breakdown.paused`

#### 2.2 Reset List ALL - Endpoint POST
**Endpoint**: `POST /master/api/alquimia-general/reset-list-all`

**Payload**:
```json
{
  "list_id": "1",
  "item_kind": "recurrente",
  "scope": "all",
  "clean_layer": "pde"
}
```

**Logs esperados**:
```
[RESET][LIST][ALL][CANONICAL] POST /reset-list-all iniciado
[RESET][ALL] Estudiantes activos obtenidos
[RESET][ALL][CANONICAL] Reset ALL completado (applied: X, skipped: Y)
[RESET][LIST][ALL][CANONICAL] POST /reset-list-all completado
```

**Respuesta esperada**:
```json
{
  "ok": true,
  "reset": true,
  "list_id": "1",
  "item_kind": "recurrente",
  "applied": 50,
  "skipped": 5,
  "total_items": 5,
  "layers_affected": ["pde"],
  "per_item_results": [...]
}
```

**Verificación**:
- [ ] Endpoint devuelve `200 OK`
- [ ] `per_item_results` contiene resultado por item
- [ ] Solo afecta capa `pde`

#### 2.3 Reset ALL - Validaciones
**Errores esperados** (deben seguir bloqueando):

1. **item_kind != 'recurrente'**:
```json
{
  "ok": false,
  "error": "Reset ALL solo disponible para item_kind=\"recurrente\"",
  "code": "ITEM_KIND_ERROR",
  "status": 400
}
```

2. **scope != 'all'**:
```json
{
  "ok": false,
  "error": "Reset ALL solo disponible en scope=all",
  "code": "SCOPE_ERROR",
  "status": 400
}
```

3. **item_kind='una_vez'**:
```json
{
  "ok": false,
  "error": "Reset está PROHIBIDO para item_kind=\"una_vez\"",
  "code": "RESET_UNA_VEZ_FORBIDDEN",
  "status": 400
}
```

### Verificación UI

#### 2.4 Botón "Reset ALL" (scope='all', recurrente)
**Comportamiento esperado**:
- [ ] Botón "Reset ALL" aparece SOLO cuando:
  - `scope === 'all'`
  - `item_kind === 'recurrente'`
- [ ] Botón NO aparece cuando:
  - `scope === 'student'`
  - `item_kind === 'una_vez'`
- [ ] Al hacer clic, muestra toast: `"Reset ALL completado (X aplicados, Y omitidos de Z estudiantes)"`
- [ ] La proyección ALL se refresca automáticamente
- [ ] Los items pasan a estado `pending` (amarillo) después del reset

**Logs esperados en consola**:
```
[UI][RESET][ALL] Botón Reset ALL pulsado
[MasterAlquimiaGeneral] [RESET][ALL] Reset ALL completado
[REFRESH][PLAN] Refresh plan construido (surfaces: ["alquimia.list_projection"])
[REFRESH][GET] Refrescando alquimia.list_projection
```

#### 2.5 Botón "Reset lista ALL"
**Comportamiento esperado**:
- [ ] Botón "Reset lista ALL" aparece SOLO cuando:
  - `scope === 'all'`
  - `item_kind === 'recurrente'`
- [ ] Al hacer clic, muestra toast: `"Reset lista ALL completado (X aplicados, Y omitidos en Z items)"`
- [ ] La proyección ALL se refresca automáticamente
- [ ] TODOS los items de la lista pasan a `pending` (amarillo)

**Prioridad visual ALL (recurrente)**:
- [ ] `never` (gris) > `important` (rojo) > `pending` (amarillo) > `reviewed` (verde)
- [ ] `reviewed` SOLO si TODOS los estudiantes están en `reviewed`

---

## ✅ FIX 3: UNA_VEZ — BOTONES INCORRECTOS

### Verificación UI

#### 3.1 Proyección Alumno (scope='student', una_vez)
**Botones esperados**:
- [ ] **+1 SHARED** (verde)
- [ ] **+1 PDE** / "Limpiar interno" (morado)
- [ ] ❌ NO aparece "Reset progreso"
- [ ] ❌ NO aparece "Reset lista"
- [ ] ❌ NO aparece "Limpiar" (bulk)

**Comportamiento esperado**:
- [ ] Solo 2 botones de acción (+1 SHARED y +1 PDE)
- [ ] Los botones incrementan contadores correctamente
- [ ] NO se muestra ningún botón de reset

#### 3.2 Proyección ALL (scope='all', una_vez)
**Botones esperados**:
- [ ] **+1** (verde, increment-all shared)
- [ ] **Limpiar interno** (morado, increment-all pde)
- [ ] ❌ NO aparece "Reset ALL"
- [ ] ❌ NO aparece "Reset lista ALL"

**Verificación**:
- [ ] Código valida `item_kind === 'una_vez'` antes de renderizar reset
- [ ] Backend rechaza reset para `una_vez` con error `RESET_UNA_VEZ_FORBIDDEN`

---

## ✅ FIX 4: REFRESH ENGINE — CONTEXTO COMPLETO

### Verificación Logs

#### 4.1 buildRefreshPlan - Logs Forenses
**Logs esperados después de cada acción**:
```
[AlquimiaActionsRegistry][buildRefreshPlan] Refresh plan construido
{
  surfaces: ["alquimia.list_projection", "alquimia.flotante_students"],
  context: {
    list_id: "1",
    item_ref: "transmutacion:lista:1:item:1",
    view_layer: "shared",
    scope: "all",
    view_mode: "proyeccion"
  }
}
```

**Verificación**:
- [ ] `list_id` siempre presente (o warning si falta)
- [ ] `item_ref` presente cuando aplica
- [ ] `view_layer` siempre presente (default: 'shared')
- [ ] `scope` siempre presente (default: 'all')
- [ ] NO hay surfaces con key `unknown`

#### 4.2 Refresh Surfaces
**Surfaces esperadas**:
- [ ] `alquimia.list_projection` (cuando `view_mode === 'proyeccion'` y hay `list_id`)
- [ ] `alquimia.items` (cuando `view_mode === 'operativa'` y hay `list_id`)
- [ ] `alquimia.flotante_students` (cuando hay `item_ref`)

**Verificación**:
- [ ] NO hay surfaces `unknown`
- [ ] Todas las surfaces tienen `list_id` disponible
- [ ] Refresh Engine ejecuta correctamente para cada surface

---

## ✅ CHECKLIST GENERAL

### Backend
- [ ] Todos los endpoints devuelven JSON válido
- [ ] Validaciones de `item_kind` funcionan correctamente
- [ ] Reset ALL solo afecta capa `pde` (no `shared`)
- [ ] Estudiantes pausados son excluidos automáticamente
- [ ] `state_by_view_layer.effective` siempre presente para recurrente

### Frontend
- [ ] Botones renderizados correctamente según `item_kind` y `scope`
- [ ] Flotante EFFECTIVE renderiza sin errores
- [ ] Refresh Engine ejecuta correctamente después de mutaciones
- [ ] Toasts muestran información correcta
- [ ] NO aparecen errores `[BUG-011]` ni `[BUG-016]`

### Integración
- [ ] Actions registry tiene 7 acciones registradas (5 originales + 2 nuevas)
- [ ] `performAction()` funciona correctamente para nuevas acciones
- [ ] Refresh plan incluye contexto completo
- [ ] NO hay errores de consola críticos

---

## ❌ ERRORES QUE DEBEN DESAPARECER

1. ❌ `[BUG-011] state_by_view_layer no disponible - BLOQUEANDO render`
2. ❌ `[BUG-016] view_layer fallback incorrecto`
3. ❌ Surfaces con key `unknown` en logs de refresh
4. ❌ `list_id` no disponible en algunas surfaces
5. ❌ Botones reset apareciendo para `una_vez`

---

## ⚠️ ERRORES QUE DEBEN SEGUIR BLOQUEANDO

1. ✅ Reset para `una_vez` → `RESET_UNA_VEZ_FORBIDDEN`
2. ✅ Reset ALL con `scope != 'all'` → `SCOPE_ERROR`
3. ✅ Reset ALL con `item_kind != 'recurrente'` → `ITEM_KIND_ERROR`
4. ✅ Falta `state_by_view_layer.effective` para recurrente (ya no debería ocurrir, pero si ocurre, debe bloquear)

---

## 📋 COMANDOS DE VERIFICACIÓN

### 1. Verificar logs de reset ALL
```bash
# Buscar logs de reset ALL
grep -r "RESET.*ALL.*CANONICAL" logs/ | tail -20

# Verificar que no hay errores
grep -r "RESET_UNA_VEZ_FORBIDDEN\|SCOPE_ERROR\|ITEM_KIND_ERROR" logs/ | tail -10
```

### 2. Verificar efectivo en flotante
```bash
# Buscar logs de effective
grep -r "CPM_V2.*effective\|BUG-011" logs/ | tail -20
```

### 3. Verificar refresh plan
```bash
# Buscar logs de refresh plan
grep -r "buildRefreshPlan.*Refresh plan construido" logs/ | tail -20

# Verificar que no hay surfaces unknown
grep -r "surface.*unknown" logs/ | wc -l  # Debe ser 0
```

---

## 🎯 CRITERIOS DE ÉXITO

1. ✅ EFFECTIVE renderiza correctamente en flotante (sin bloqueos)
2. ✅ Reset ALL funciona correctamente (solo PDE, solo recurrente)
3. ✅ Botones UNA_VEZ solo muestran +1 SHARED y +1 PDE
4. ✅ Refresh Engine incluye contexto completo (no hay `unknown` surfaces)
5. ✅ NO hay errores críticos en consola del navegador
6. ✅ Todas las validaciones funcionan correctamente (errores esperados bloquean)

---

## 📝 NOTAS

- Los logs forenses son críticos para debugging
- Si algún error esperado no bloquea, es un bug
- Si algún error no esperado aparece, documentar como nuevo issue
- Verificar en diferentes escenarios: scope='all', scope='student', recurrente, una_vez

---

**Estado**: ✅ LISTO PARA VERIFICACIÓN EN PRODUCCIÓN
