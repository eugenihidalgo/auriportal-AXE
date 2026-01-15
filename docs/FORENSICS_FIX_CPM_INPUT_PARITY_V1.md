# Forensics Fix: CPM Input Parity v1

**Fecha:** 2025-01-27  
**Versión:** 5.74.1  
**Estado:** IMPLEMENTADO  
**Dominio:** MASTER (AuriPortal)

---

## Síntoma

El estado que devuelve el CPM v2 NO era coherente entre superficies (list-projection, flotante, megalist) para los mismos alumnos e ítems.

**Ejemplo:**
- list-projection: `state='reviewed'` (con override threshold_days=10)
- flotante: `state='pending'` (sin override, threshold_days=7)
- Mismo alumno, mismo ítem, mismo view_layer

---

## Evidencia

**Referencia:** `docs/DIAGNOSTICO_FORENSE_CPM_V2_INCOHERENCIAS.md`

**Hallazgos:**
1. Flotante NO aplicaba overrides (línea 716 de `alquimia-general-service.js`)
2. `completed` preparado como boolean en list-projection (línea 383 de `list-projection-model.js`)
3. `critical_multiplier` inconsistente (línea 681 de `alquimia-general-service.js`)

**Confirmación:**
- El CPM v2 es correcto cuando recibe inputs idénticos
- Las incoherencias provenían de inputs diferentes entre superficies

---

## Causa Raíz

**Inputs diferentes al CPM v2:**

1. **Overrides no aplicados en flotante:**
   - list-projection: Aplicaba `resolveItemConfigForStudent()` → `effectiveConfig` con overrides
   - flotante: NO aplicaba overrides → `config` base sin personalizaciones
   - megalist: Aplicaba overrides → `effectiveConfig` con overrides

2. **completed inconsistente:**
   - list-projection: `completed || false` (boolean)
   - flotante: `completed || 0` (integer)
   - megalist: `completed || 0` (integer)

3. **critical_multiplier inconsistente:**
   - list-projection: `2.0` (hardcoded)
   - flotante: `item.critical_multiplier || 2.0` (leía de DB)
   - megalist: `2.0` (hardcoded)

---

## Fix Aplicado

### Fix 1: Overrides en Flotante

**Archivo:** `src/services/alquimia-general-service.js`

**Cambios:**
- Importar `resolveItemConfigForStudent`
- Crear `baseConfig` canónico (igual a list-projection/megalist)
- Crear cache de overrides por `student_uuid` (evitar lookups duplicados)
- Aplicar `resolveItemConfigForStudent()` antes de llamar al CPM para cada alumno
- Usar `effectiveConfig` en todas las llamadas al CPM

**Líneas modificadas:**
- Línea ~16: Importar `resolveItemConfigForStudent`
- Línea ~678-682: Crear `baseConfig` y cache
- Línea ~699: Cambiar `map` a `Promise.all(map(async ...))`
- Línea ~704-712: Aplicar overrides por alumno
- Línea ~716-720: Usar `effectiveConfig` en `computeVisualState`
- Línea ~747-755: Usar `effectiveConfig` en `stateByViewLayer`

**También aplicado en UNA_VEZ:**
- Línea ~821-829: Crear `baseConfigUnaVez` y cache
- Línea ~835: Cambiar `map` a `Promise.all(map(async ...))`
- Línea ~848-857: Aplicar overrides por alumno
- Línea ~868: Usar `effectiveConfigUnaVez` en `computeVisualState`
- Línea ~888-910: Usar `effectiveConfigUnaVez` en `stateByViewLayer`

---

### Fix 2: completed Siempre Integer

**Archivo:** `src/core/master/services/list-projection-model.js`

**Cambios:**
- Cambiar `completed: row.shared_completed || false` → `completed: Number(row.shared_completed || 0)`
- Cambiar `completed: row.pde_completed || false` → `completed: Number(row.pde_completed || 0)`

**Líneas modificadas:**
- Línea 383: `completed: Number(row.shared_completed || 0)`
- Línea 390: `completed: Number(row.pde_completed || 0)`

---

### Fix 3: critical_multiplier Canónico Único

**Archivo:** `src/services/alquimia-general-service.js`

**Cambios:**
- Cambiar `const criticalMultiplier = item.critical_multiplier || 2.0;` → `const criticalMultiplier = 2.0;`
- Incluir en `baseConfig` con valor canónico

**Líneas modificadas:**
- Línea ~681: Eliminada lectura de `item.critical_multiplier`
- Línea ~682: `criticalMultiplier = 2.0` (hardcoded canónico)
- Línea ~684: `baseConfig.critical_multiplier = 2.0`

---

## Cómo Verificar

### 1. Verificar Overrides en Flotante

**Logs:**
```bash
# Buscar logs con has_override
grep -r "has_override.*true" logs/ | grep "AlquimiaGeneralService"
```

**Curl:**
```bash
# Obtener flotante para alumno con override
curl -i "http://localhost:3000/master/api/alquimia-general/items/te_item_66/students?view_layer=shared&clean_layer=shared" \
  -H "Cookie: session=..."

# Verificar que threshold_days en logs CPM input coincide con override
```

### 2. Verificar completed Integer

**Logs:**
```bash
# Buscar logs CPM input con completed
grep -r "\[CPM_V2\]\[INPUT\]" logs/ | grep "completed" | head -5

# Verificar que completed es número (no boolean)
```

**Curl:**
```bash
# Obtener list-projection para lista una_vez
curl -i "http://localhost:3000/master/api/alquimia-general/list-projection?list_id=1&item_kind=una_vez&view_layer=combo&scope=student&student_uuid=<UUID>" \
  -H "Cookie: session=..."

# Verificar que completed en JSON es número
```

### 3. Verificar critical_multiplier Canónico

**Logs:**
```bash
# Buscar logs CPM input con critical_multiplier
grep -r "\[CPM_V2\]\[INPUT\]" logs/ | grep "critical_multiplier" | head -5

# Verificar que critical_multiplier=2.0 en todas las superficies
```

**Código:**
```bash
# Verificar que no se lee de item.critical_multiplier
grep -r "item\.critical_multiplier" src/
# Debe devolver 0 resultados
```

---

## Prevención (Rules de Cursor)

**Actualizado:** `.cursorrules` (sección CONSTITUCIÓN CLEANING ENGINE v1)

**Nuevas reglas:**
- "Overrides se aplican en toda lectura por alumno (incluye flotante)"
- "completed SIEMPRE es integer (0..n), nunca boolean"
- "critical_multiplier canónico único (2.0) mientras no exista fuente canónica configurada"

**Verificación automática:**
- Assembly check: `npm run check:master-ui` verifica paridad de inputs
- Logs forenses: `has_override` en logs de todas las superficies

---

## Archivos Modificados

1. `src/services/alquimia-general-service.js`
   - Fix 1: Overrides en flotante (RECURRENTE y UNA_VEZ)
   - Fix 3: critical_multiplier canónico

2. `src/core/master/services/list-projection-model.js`
   - Fix 2: completed siempre integer

3. `package.json`
   - Versión: 5.74.0 → 5.74.1

4. `docs/ALQUIMIA_GENERAL_READ_MODEL.md`
   - Añadida sección "Paridad de Inputs CPM v2 entre Superficies"

5. `docs/INVARIANTES_CONSTITUCIONALES.md`
   - Añadidos invariantes 11, 12, 13

6. `docs/FORENSICS_FIX_CPM_INPUT_PARITY_V1.md`
   - Este documento

---

## Commit

```
v5.74.1 master: fix CPM v2 input parity (overrides in flotante + completed int + critical_multiplier canonical)

Archivos modificados:
- src/services/alquimia-general-service.js (overrides + critical_multiplier)
- src/core/master/services/list-projection-model.js (completed integer)

Incoherencias corregidas:
1. Flotante ahora aplica overrides igual que list-projection/megalist
2. completed siempre integer (no boolean) en todas las superficies
3. critical_multiplier canónico único (2.0) en todas las superficies

Verificación:
- Logs [CPM_V2][INPUT] muestran effectiveConfig con overrides en flotante
- Logs incluyen has_override: true/false
- completed es Number() en todas las superficies
- critical_multiplier=2.0 en todas las superficies
```

---

## Referencias

- **Diagnóstico:** `docs/DIAGNOSTICO_FORENSE_CPM_V2_INCOHERENCIAS.md`
- **CPM v2:** `docs/CPM_V2_CANONICAL_MODEL.md`
- **Read Model:** `docs/ALQUIMIA_GENERAL_READ_MODEL.md`
- **Invariantes:** `docs/INVARIANTES_CONSTITUCIONALES.md`

---

**FIN DE DOCUMENTACIÓN FORENSICS FIX**
