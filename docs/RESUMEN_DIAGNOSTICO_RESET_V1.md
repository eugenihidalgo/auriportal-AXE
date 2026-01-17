# RESUMEN EJECUTIVO — DIAGNÓSTICO RESET v1

**FECHA:** 2026-01-27  
**ESTADO:** Diagnóstico completado, pendiente ejecución de queries

---

## PROBLEMA IDENTIFICADO

**Síntoma:** Reset ALL devuelve "0 aplicados, X omitidos" cuando debería resetear ítems.

**Causa raíz:** Idempotencia por `execution_key` diario que NO verifica coherencia de estado.

---

## CAUSA RAÍZ TÉCNICA

### 1. Execution Key Diario

```javascript
// Formato: reset:{item_ref}:{student_uuid}:{clean_layer}:{YYYY-MM-DD}
execution_key = `reset:${itemRef}:${studentUuid}:${cleanLayer}:${day}`;
```

**Problema:** Si un reset se ejecutó el mismo día, el segundo intento será omitido por idempotencia, incluso si el primer reset falló parcialmente.

### 2. Idempotencia Sin Verificación de Coherencia

```javascript
// cleaning-engine-service.js:1327-1340
const eventResult = await eventsRepo.insertEvent(eventData, client);

if (eventResult.already_executed === true) {
  skipped++;  // ⚠️ NO verifica si cleaning_item_state está actualizado
  continue;
}
```

**Problema:** La lógica solo verifica si el evento existe, NO si `cleaning_item_state` está actualizado.

### 3. Resets Parciales

Si un reset ALL falla a mitad de ejecución:
- Los eventos SÍ se insertaron para algunos estudiantes
- El siguiente reset del mismo día será omitido por idempotencia
- El estado queda inconsistente permanentemente

---

## TIPOS DE INCONSISTENCIAS DETECTADAS

1. **RESET_SIN_EVENTO**: Estado indica reset pero no existe evento
2. **EVENTO_RESET_SIN_ACTUALIZACION**: Evento existe pero estado no actualizado
3. **FECHA_FUTURA**: `effective_since` en el futuro (imposible)
4. **CONTRADICCION_CLEAN_COUNT**: `clean_count=0` pero `last_cleaned_at NOT NULL`
5. **RESET_ANTIGUO_SIN_LIMPIEZA**: Reset >7 días sin limpieza post-reset
6. **RESETS_DUPLICADOS**: Múltiples intentos el mismo día

---

## QUERIES DE DIAGNÓSTICO

**Archivo:** `scripts/diagnostico-reset-queries.sql`

**Contenido:**
- Query 1: Estados base tras reset (vista general)
- Query 2-6: Anti-estados (inconsistencias específicas)
- Query 7: Resets duplicados
- Query 8: Reset ALL omitidos (eventos del día actual)
- Resumen: Contar inconsistencias por tipo

**Ejecutar en orden** para obtener diagnóstico completo.

---

## PLAN DE SANEAMIENTO (DISEÑO)

**Objetivo:** Recalcular estado base coherente sin falsear historia.

**Reglas:**
- ✅ NO modifica `cleaning_events` (append-only)
- ✅ Recalcula `cleaning_item_state` desde eventos si es necesario
- ✅ Inserta evento RESET HISTÓRICO si falta (con execution_key único)
- ✅ Ajusta `cleaning_item_state` de forma consistente

**Función diseñada:** Ver `docs/DIAGNOSTICO_RESET_COMPLETO_V1.md` (FASE 5)

**Estado:** Diseño completado, pendiente aprobación para implementación

---

## PRÓXIMOS PASOS

### Fase 1: Ejecución de Queries (INMEDIATO)

```bash
# Conectar a PostgreSQL
psql -d aurelinportal

# Ejecutar queries de diagnóstico
\i scripts/diagnostico-reset-queries.sql
```

**Resultado esperado:** Lista de ítems encallados por tipo de inconsistencia.

### Fase 2: Revisión de Resultados

- Revisar cantidad de ítems afectados
- Identificar patrones (¿afecta a todos los estudiantes? ¿solo algunos items?)
- Determinar si el problema es masivo o puntual

### Fase 3: Aprobación de Saneamiento

- Revisar plan de saneamiento (FASE 5 del diagnóstico completo)
- Aprobar o modificar según resultados de Fase 2
- Definir ventana de mantenimiento si es necesario

### Fase 4: Ejecución de Saneamiento (PENDIENTE APROBACIÓN)

- Implementar función de saneamiento
- Ejecutar en modo dry-run primero
- Verificar resultados
- Ejecutar saneamiento real si dry-run es exitoso

### Fase 5: Verificación Post-Saneamiento

- Re-ejecutar queries de diagnóstico
- Verificar que no quedan ítems encallados
- Verificar que reset ALL funciona correctamente

### Fase 6: Prevención (IMPLEMENTACIÓN FUTURA)

- Implementar verificación de coherencia en idempotencia
- Implementar transacciones atómicas
- Implementar logs forenses obligatorios
- Implementar verificación post-reset

---

## REGLAS PARA PREVENIR EL PROBLEMA

**Reglas constitucionales (futuras):**

1. **Verificación de coherencia en idempotencia:**
   - Antes de omitir un reset por idempotencia, verificar que `cleaning_item_state` está actualizado
   - Si el evento existe pero el estado no está actualizado, forzar actualización

2. **Transacciones atómicas:**
   - Reset debe ser atómico: evento + actualización de estado en la misma transacción
   - Si falla la actualización de estado, rollback del evento

3. **Logs forenses obligatorios:**
   - Registrar cuando un reset es omitido por idempotencia
   - Registrar cuando un reset falla parcialmente
   - Incluir `trace_id` para correlación

4. **Verificación post-reset:**
   - Después de ejecutar reset ALL, verificar que todos los estudiantes fueron procesados correctamente
   - Si hay inconsistencias, reportarlas inmediatamente

---

## DOCUMENTOS RELACIONADOS

- **Diagnóstico completo:** `docs/DIAGNOSTICO_RESET_COMPLETO_V1.md`
- **Queries SQL:** `scripts/diagnostico-reset-queries.sql`
- **Diagnóstico anterior (reset shared recurrente):** `docs/DIAGNOSTICO_RESET_SHARED_RECURRENTE_V1.md`

---

## CONCLUSIÓN

✅ **Diagnóstico completado:** Tipos de reset mapeados, lógica de idempotencia entendida, queries creadas, causa raíz identificada, plan de saneamiento diseñado.

⏳ **Pendiente:** Ejecución de queries en base de datos real, revisión de resultados, aprobación de saneamiento.

🚫 **NO se implementarán fixes sin validación explícita del usuario.**

---

**FIN DEL RESUMEN**
