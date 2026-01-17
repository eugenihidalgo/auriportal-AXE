# REPORTE DE EJECUCIÓN — SANITIZE RESET STUCK ITEMS v1

**FECHA:** 2026-01-27  
**DOMINIO:** MASTER  
**ESTADO:** Implementación completada, pendiente ejecución

---

## RESUMEN EJECUTIVO

**Objetivo:** Sanear estados encallados provocados por resets históricos mal ejecutados y blindar el reset para prevenir futuras inconsistencias.

**Implementación:**
- ✅ Script de saneamiento creado (`scripts/sanitize-reset-stuck-items.js`)
- ✅ Blindaje de idempotencia implementado (`cleaning-engine-service.js`)
- ✅ Modo DRY_RUN por defecto
- ✅ Logs forenses estructurados

---

## ARCHIVOS MODIFICADOS/CREADOS

### 1. Script de Saneamiento

**Archivo:** `scripts/sanitize-reset-stuck-items.js`

**Características:**
- Ejecutable manualmente
- Modo DRY_RUN por defecto
- Modo APPLY solo con flag `--apply`
- Logs forenses claros
- NO toca UI

**Uso:**
```bash
# Modo DRY_RUN (por defecto)
node scripts/sanitize-reset-stuck-items.js

# Modo APPLY (aplicar cambios reales)
node scripts/sanitize-reset-stuck-items.js --apply
```

**Funcionalidad:**
1. Ejecuta queries de diagnóstico (unificadas)
2. Obtiene lista de ítems encallados
3. Para cada ítem:
   - Obtiene todos los eventos
   - Deriva estado correcto desde eventos
   - Verifica si necesita evento histórico
   - Verifica si necesita actualización de estado
4. En modo APPLY:
   - Inserta evento histórico si falta (execution_key único)
   - Actualiza `cleaning_item_state` si es incoherente
   - Todo en transacción por ítem

### 2. Blindaje de Idempotencia

**Archivo:** `src/core/master/services/cleaning-engine-service.js`

**Modificación:** Líneas 1327-1370

**Cambio:**
- Antes: Verificaba solo si el evento existe → `skipped++`
- Ahora: Verifica coherencia del estado antes de omitir
  - Si evento existe pero estado incoherente → aplicar reset igualmente (idempotencia override)
  - Si evento existe y estado coherente → omitir correctamente

**Lógica de verificación:**
```javascript
// Verificar si el estado está coherente con el reset esperado
const isCoherent = currentEffective && 
  currentEffective >= eventCreatedAt &&
  currentState[lastCleanedColumn] === null &&
  currentState[countColumn] === 0;
```

**Logs:**
- `[RESET][IDEMPOTENCY_OVERRIDE]` cuando se fuerza reset por incoherencia
- `[RESET][IDEMPOTENCY]` cuando se omite correctamente

---

## TIPOS DE INCONSISTENCIAS DETECTADAS

El script detecta y sanea los siguientes tipos:

1. **RESET_SIN_EVENTO_SHARED**
   - Estado indica reset pero no existe evento
   - Solución: Insertar evento histórico

2. **EVENTO_RESET_SIN_ACTUALIZACION**
   - Evento existe pero estado no actualizado
   - Solución: Actualizar estado desde eventos

3. **FECHA_FUTURA_SHARED**
   - `effective_since` en el futuro (imposible)
   - Solución: Recalcular desde eventos

4. **CONTRADICCION_CLEAN_COUNT_SHARED**
   - `clean_count=0` pero `last_cleaned_at NOT NULL` (o viceversa)
   - Solución: Recalcular desde eventos

---

## PROCESO DE EJECUCIÓN

### Fase 1: DRY_RUN (OBLIGATORIO)

```bash
node scripts/sanitize-reset-stuck-items.js
```

**Resultado esperado:**
- Lista de ítems encallados
- Desglose por tipo de inconsistencia
- Cambios que se aplicarían (sin modificar DB)
- Resumen: nº ítems que serían saneados

### Fase 2: Revisión de Resultados

- Revisar cantidad de ítems afectados
- Verificar que los cambios propuestos son correctos
- Confirmar que no hay efectos secundarios

### Fase 3: Aplicación (SOLO TRAS REVISIÓN)

```bash
node scripts/sanitize-reset-stuck-items.js --apply
```

**Resultado esperado:**
- Ítems saneados exitosamente
- Eventos históricos insertados (si aplica)
- Estados actualizados coherentemente
- Logs estructurados por ítem

### Fase 4: Verificación Post-Saneamiento

```bash
# Re-ejecutar queries de diagnóstico
psql -d aurelinportal -f scripts/diagnostico-reset-queries.sql
```

**Resultado esperado:**
- 0 ítems encallados
- Reset ALL funciona correctamente

---

## REGLAS DE SEGURIDAD

**Implementadas:**

1. ✅ **NO modifica cleaning_events** (append-only)
   - Solo inserta eventos históricos si faltan
   - Execution key único histórico (no diario)

2. ✅ **Transacciones atómicas**
   - Cada ítem se procesa en su propia transacción
   - Si falla un ítem, rollback y continuar con el siguiente

3. ✅ **Logs forenses obligatorios**
   - Cada acción registrada con trace_id
   - Logs estructurados por ítem

4. ✅ **Modo DRY_RUN por defecto**
   - No se puede aplicar cambios sin flag explícito
   - Permite revisar cambios antes de aplicar

---

## BLINDAJE DEL RESET

**Implementado en:** `cleaning-engine-service.js`

**Comportamiento:**

1. **Idempotencia inteligente:**
   - Verifica coherencia antes de omitir
   - Si estado incoherente → fuerza reset (override)
   - Si estado coherente → omite correctamente

2. **Logs forenses:**
   - `[RESET][IDEMPOTENCY_OVERRIDE]` cuando se fuerza reset
   - `[RESET][IDEMPOTENCY]` cuando se omite correctamente

3. **Prevención:**
   - Evita que resets parciales queden inconsistentes
   - Detecta y corrige automáticamente estados incoherentes

---

## MÉTRICAS ESPERADAS

**Antes del saneamiento:**
- Nº ítems encallados: [PENDIENTE EJECUCIÓN]
- Tipos de inconsistencias: [PENDIENTE EJECUCIÓN]

**Después del saneamiento:**
- Nº ítems encallados: 0 (objetivo)
- Reset ALL funciona correctamente

---

## PRÓXIMOS PASOS

1. **Ejecutar DRY_RUN:**
   ```bash
   node scripts/sanitize-reset-stuck-items.js
   ```

2. **Revisar resultados:**
   - Verificar cantidad de ítems afectados
   - Confirmar que los cambios propuestos son correctos

3. **Aplicar saneamiento (si DRY_RUN OK):**
   ```bash
   node scripts/sanitize-reset-stuck-items.js --apply
   ```

4. **Verificar post-saneamiento:**
   ```bash
   psql -d aurelinportal -f scripts/diagnostico-reset-queries.sql
   ```

5. **Probar reset ALL:**
   - Ejecutar reset ITEM_ALL
   - Ejecutar reset LIST_ALL
   - Verificar que no devuelve "0 aplicados, X omitidos" incorrectamente

6. **Reiniciar servidor:**
   ```bash
   pm2 restart aurelinportal
   ```

---

## NOTAS TÉCNICAS

### Execution Key Histórico

Cuando se inserta un evento histórico, se usa:
```
reset:{item_ref}:{student_uuid}:{clean_layer}:historical:{timestamp}
```

**Razón:** No usar execution_key diario para evitar conflictos con idempotencia normal.

### Transacciones

Cada ítem se procesa en su propia transacción:
- Si falla → rollback y continuar con el siguiente
- Si éxito → commit y continuar

**Razón:** Aislar errores y permitir que el saneamiento continúe aunque falle un ítem.

### Verificación de Coherencia

La verificación compara:
- `effective_since` >= fecha del evento reset
- `last_cleaned_at` === NULL
- `clean_count` === 0

**Razón:** Estos son los valores esperados tras un reset canónico.

---

## CONCLUSIÓN

✅ **Implementación completada:**
- Script de saneamiento creado y listo para ejecutar
- Blindaje de idempotencia implementado
- Logs forenses estructurados
- Modo DRY_RUN por defecto

⏳ **Pendiente:**
- Ejecución de DRY_RUN
- Revisión de resultados
- Aplicación de saneamiento (si aprobado)
- Verificación post-saneamiento

🚫 **NO se implementaron cambios fuera del scope solicitado.**

---

**FIN DEL REPORTE**
