# ⏳ EVIDENCIA RUNTIME PENDIENTE - Auditoría READ-ONLY
## Requiere autenticación para completar

**Fecha:** 2025-01-27

---

## REQUESTS HTTP PENDIENTES (requieren autenticación)

Los siguientes requests requieren cookie de sesión válida:

### C1) GET LIST PROJECTION (4 variantes)
```bash
curl -s "https://master.pdeeugenihidalgo.org/master/api/alquimia-general/listas/11/list-projection?list_id=11&item_kind=recurrente&view_layer=shared&scope=all" \
  -H "Cookie: <COOKIE_VALIDA>" | jq > responses/get_list_projection_shared.json

curl -s "https://master.pdeeugenihidalgo.org/master/api/alquimia-general/listas/11/list-projection?list_id=11&item_kind=recurrente&view_layer=pde&scope=all" \
  -H "Cookie: <COOKIE_VALIDA>" | jq > responses/get_list_projection_pde.json

curl -s "https://master.pdeeugenihidalgo.org/master/api/alquimia-general/listas/11/list-projection?list_id=11&item_kind=recurrente&view_layer=effective&scope=all" \
  -H "Cookie: <COOKIE_VALIDA>" | jq > responses/get_list_projection_effective.json

curl -s "https://master.pdeeugenihidalgo.org/master/api/alquimia-general/listas/11/list-projection?list_id=11&item_kind=recurrente&view_layer=shared&scope=student&student_uuid=44a51f8f-4ed5-4291-ad13-5f07a99c636b" \
  -H "Cookie: <COOKIE_VALIDA>" | jq > responses/get_list_projection_shared_student.json
```

### C2) GET FLOTANTE STUDENTS
```bash
curl -s "https://master.pdeeugenihidalgo.org/master/api/alquimia-general/items/te_item_63/students?view_layer=shared" \
  -H "Cookie: <COOKIE_VALIDA>" | jq > responses/get_flotante_students_shared.json
```

---

## VERIFICACIONES REQUERIDAS EN JSON REAL

### Para BUG-001:
1. **GET list-projection (scope='all'):**
   - Buscar primer item en `data.items[]`
   - Verificar: `item.state_by_view_layer` existe
   - Verificar: `item.state_by_view_layer.shared.state` existe
   - Verificar: `item.state_by_view_layer.pde.state` existe
   - Verificar: `item.state_by_view_layer.effective.state` existe (si item_kind='recurrente')

2. **GET list-projection (scope='student'):**
   - Buscar primer item en `data.items[]`
   - Verificar: `item.state_by_view_layer` existe
   - **NOTA:** En scope='student', los items NO tienen students dentro, solo `state_by_view_layer` por item

3. **GET flotante students:**
   - Buscar primer student en `data.students[]`
   - Verificar: `student.state_by_view_layer` existe
   - Verificar: `student.state_by_view_layer[view_layer].state` existe

---

## ACCIONES UI PENDIENTES (requieren ejecución manual en browser)

### D1) Reset ITEM_STUDENT (shared)
1. Abrir `/master/templo-luz/alquimia-general`
2. Seleccionar lista Abundancia (11)
3. Modo proyección → scope student → seleccionar alumno fijo
4. Abrir item `te_item_63` (flotante)
5. Click "RESET" → "SHARED" (ITEM_STUDENT)
6. **Capturar:**
   - Payload desde Network tab
   - Response JSON desde Network tab
   - Trace ID / ux_action_id desde console logs
   - Logs de consola: `[REFRESH_ENGINE]`, `[LEGACY_REFRESH]`, `[INVARIANT_BROKEN]`

### D2) Clean ITEM_STUDENT (shared)
- Similar a D1, pero click "Limpiar SHARED" después del reset
- Verificar que el alumno se mueve de columna `reseteado` a `reviewed`

### D3) Reset Overrides ITEM_STUDENT
- Similar, pero click "Reset Overrides" desde flotante

---

## LOGS PM2 PENDIENTES

Para cada acción con trace_id:
```bash
pm2 logs aurelinportal --lines 600 | grep -E "trace_id|ux_action|ALQG|SURFACES|LEGACY_REFRESH|list-projection|RESET|CLEAN|OVERRIDE|INVARIANT_BROKEN|CPM_V2" > logs/pm2_grep_<trace_id>.log
```

---

## SCRIPT FORENSE DB PENDIENTE

```bash
node scripts/diagnostico-reset-clean-forense.js 44a51f8f-4ed5-4291-ad13-5f07a99c636b te_item_63 > db_dumps/diagnostico_reset_clean_te_item_63.txt
```

---

## NOTA IMPORTANTE

**Esta auditoría READ-ONLY se completa en dos fases:**
1. **Fase 1 (COMPLETADA):** Análisis estático de código - confirma que el código SÍ incluye `state_by_view_layer`
2. **Fase 2 (PENDIENTE):** Verificación runtime real - requiere autenticación para ejecutar requests y capturar JSON real

**Conclusión preliminar:** El código backend SÍ asigna `state_by_view_layer` correctamente. Si BUG-001 ocurre en runtime, puede deberse a:
- Error en runtime que no se ve en código estático
- Condiciones edge que no están cubiertas
- Cache o condiciones de timing
