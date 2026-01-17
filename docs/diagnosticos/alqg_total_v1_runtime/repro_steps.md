# 🔍 REPRO STEPS - Auditoría Runtime READ-ONLY
## Alquimia General MASTER - Diagnóstico Forense Definitivo

**Fecha:** 2025-01-27  
**Dominio:** MASTER (`https://master.pdeeugenihidalgo.org`)  
**UI:** `/master/templo-luz/alquimia-general`  
**Lista fija:** Abundancia (`list_id=11`)  
**Item fijo:** `te_item_63`  
**Alumno fijo:** `student_uuid=44a51f8f-4ed5-4291-ad13-5f07a99c636b`  

**Modo:** READ-ONLY (0 edits, solo evidencia)

---

## A) CONFIRMACIÓN MODO READ-ONLY

✅ **MODO OPERATIVO:** READ-ONLY
- PROHIBIDO cambiar código
- PROHIBIDO refactors
- PROHIBIDO "arreglar" nada
- SOLO evidencia ejecutada: requests reales, respuestas reales, logs reales, dumps DB reales
- Si detecto algo roto: documento punto exacto de rotura (archivo+línea) pero NO lo toco

---

## B) INVENTARIO RUNTIME

### B1) Versiones
- `package.json` version: `5.77.7`
- `master/__version`: (pendiente curl)
- `__version` root: (pendiente curl)
- BUILD_STAMP: (pendiente capturar desde browser)

### B2) Scripts cargados en MASTER
- (pendiente verificar HTML de `/master/templo-luz/alquimia-general`)
- Confirmar que NO ejecuta `inject_main.js` en MASTER

---

## C) REQUESTS HTTP EJECUTADOS

### C1) GET LISTAS
- **Timestamp:** (pendiente ejecutar)
- **URL:** `https://master.pdeeugenihidalgo.org/master/api/alquimia-general/listas`
- **Response:** `responses/get_listas.json`

### C2) GET ITEMS lista 11
- **Timestamp:** (pendiente ejecutar)
- **URL:** `https://master.pdeeugenihidalgo.org/master/api/alquimia-general/listas/11/items`
- **Response:** `responses/get_list_11_items.json`

### C3) GET LIST PROJECTION (CRÍTICO BUG-001)
- **view_layer=shared:** `responses/get_list_projection_shared.json`
- **view_layer=pde:** `responses/get_list_projection_pde.json`
- **view_layer=effective:** `responses/get_list_projection_effective.json`
- **view_layer=combo:** `responses/get_list_projection_combo.json`

---

## D) ACCIONES UI EJECUTADAS (MANUAL)

### D1) Reset ITEM_STUDENT (shared)
- **Timestamp:** (pendiente)
- **Payload:** `payloads/reset_item_student_shared_<timestamp>.json`
- **Response:** `responses/reset_item_student_shared_<timestamp>.json`
- **Trace ID:** (pendiente)
- **Logs consola:** (pendiente copiar)

### D2) Clean ITEM_STUDENT (shared)
- **Timestamp:** (pendiente)
- **Payload:** `payloads/clean_item_student_shared_<timestamp>.json`
- **Response:** `responses/clean_item_student_shared_<timestamp>.json`
- **Trace ID:** (pendiente)
- **Logs consola:** (pendiente copiar)

### D3) Reset Overrides ITEM_STUDENT
- **Timestamp:** (pendiente)
- **Payload:** `payloads/reset_overrides_item_student_<timestamp>.json`
- **Response:** `responses/reset_overrides_item_student_<timestamp>.json`
- **Trace ID:** (pendiente)
- **Logs consola:** (pendiente copiar)

---

## E) LOGS PM2 CORRELADOS

Para cada acción con trace_id/ux_action_id:
- `logs/pm2_grep_<ID>.log`

---

## F) EVIDENCIA DB

### F1) Script forense
- `db_dumps/diagnostico_reset_clean_te_item_63.txt`

### F2) Queries directas (solo lectura)
- `db_dumps/queries_cleaning_state_<timestamp>.sql.txt`
- `db_dumps/queries_cleaning_events_<timestamp>.sql.txt`
- `db_dumps/queries_overrides_<timestamp>.sql.txt`

---

**NOTA:** Este documento se completa durante la ejecución de la auditoría.
