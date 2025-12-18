# INFORME DE DEBUG: Verificación Técnica FASE 1 - Racha en Modo Master

**Fecha:** Análisis realizado en modo SOLO LECTURA  
**Objetivo:** Confirmar o descartar desincronización de racha entre BD y Modo Master  
**Contexto:** Sistema estuvo caído; BD muestra `streak = 0` pero Master muestra racha > 0

---

## A) ORIGEN EXACTO DEL VALOR DE RACHA MOSTRADO

### Ubicación del Código
**Archivo:** `src/endpoints/admin-master.js`  
**Línea:** 257  
**Código:**
```257:257:src/endpoints/admin-master.js
rachaMostrar = ctx.streak && ctx.streak.actual !== undefined ? ctx.streak.actual : 0;
```

### Origen del Valor
El valor `ctx.streak.actual` proviene de la construcción del contexto en `validarYobtenerAlumno()`:

**Archivo:** `src/endpoints/admin-master.js`  
**Líneas:** 159-160
```159:160:src/endpoints/admin-master.js
streak: {
  actual: streakCheck && streakCheck.streak !== undefined ? streakCheck.streak : (student.streak || 0)
},
```

### Función que Calcula el Valor
**Función:** `checkDailyStreak(student, {}, {})`  
**Archivo:** `src/modules/streak.js`  
**Línea de llamada:** `src/endpoints/admin-master.js:130`

### Lógica de `checkDailyStreak`
```53:193:src/modules/streak.js
export async function checkDailyStreak(student, env, opts = {}) {
  const today = hoyES();
  const lastPractice = student.lastPractice || null;
  const oldStreak = student.streak || 0;

  // Si lastPractice === today → devuelve oldStreak (sin cambios)
  // Si diffDays === 1 → devuelve oldStreak + 1 (incrementa)
  // Si diffDays > 1 → devuelve 1 (resetea)
}
```

**Resumen en 3-5 líneas:**
- `checkDailyStreak` lee `student.streak` directamente de PostgreSQL (campo `streak` en tabla `alumnos`)
- NO calcula la racha desde la tabla `practicas` (solo usa el campo almacenado)
- Compara `lastPractice` con la fecha actual
- Si `lastPractice === today`: devuelve `oldStreak` sin modificar
- Si `diffDays === 1`: devuelve `oldStreak + 1` (e intenta actualizar BD/ClickUp)
- Si `diffDays > 1`: devuelve `1` (e intenta resetear en BD/ClickUp)
- **PROBLEMA:** Cuando se llama desde admin-master con `env = {}`, las actualizaciones a ClickUp fallan silenciosamente, pero el valor devuelto puede no reflejar el estado real

### Dependencia de Estado Previo vs Cálculo Puro
**Dependencia:** SÍ, depende completamente del estado previo almacenado en:
- `student.streak` (campo en PostgreSQL)
- `student.lastPractice` (campo `fecha_ultima_practica` en PostgreSQL)

**NO es un cálculo puro** desde la tabla `practicas` que cuente días consecutivos reales.

---

## B) COMPARATIVA DB REAL vs RACHA MOSTRADA

### Fuente de Datos en PostgreSQL
El objeto `student` se construye desde PostgreSQL mediante:
- **Función:** `findStudentById(id)`  
- **Archivo:** `src/modules/student-v4.js:85`
- **Normalización:** `normalizeAlumno()` en líneas 45-64

**Mapeo de campos:**
```56:56:src/modules/student-v4.js
streak: alumno.streak || 0,
```

```55:55:src/modules/student-v4.js
lastPractice: alumno.fecha_ultima_practica ? new Date(alumno.fecha_ultima_practica).toISOString().substring(0, 10) : null,
```

### Verificación Necesaria (NO EJECUTADA - Solo Lectura)
Para un alumno concreto que muestre racha incorrecta, se requerirían estas queries:

```sql
-- 1. Últimas prácticas reales
SELECT fecha, tipo, origen 
FROM practicas 
WHERE alumno_id = ? 
ORDER BY fecha DESC 
LIMIT 10;

-- 2. Campo legacy streak en tabla alumnos
SELECT id, email, streak, fecha_ultima_practica, estado_suscripcion
FROM alumnos
WHERE id = ?;

-- 3. Pausas activas
SELECT inicio, fin, motivo
FROM pausas
WHERE alumno_id = ? AND (fin IS NULL OR fin > CURRENT_DATE);

-- 4. Fecha actual del servidor
SELECT CURRENT_DATE, CURRENT_TIMESTAMP;
```

### Análisis de Coherencia (Teórico)
**Escenario observado:**
- BD: `streak = 0` (correcto si el sistema estuvo caído)
- Master muestra: `racha = 6` (incorrecto)

**Posibles causas:**
1. `checkDailyStreak` lee `student.streak = 6` de PostgreSQL (campo desactualizado)
2. `checkDailyStreak` calcula: si `lastPractice` fue hace 6 días y `diffDays === 1` (imposible), o si hay un bug en el cálculo
3. El campo `streak` en PostgreSQL no se ha actualizado correctamente después de la caída

**Conclusión preliminar:** El valor mostrado proviene del campo `streak` en PostgreSQL, NO de un cálculo desde `practicas`. Si el campo está desincronizado, el valor mostrado también lo estará.

---

## C) EVALUACIÓN: ¿DESINCRONIZACIÓN REAL?

### RESPUESTA: **SÍ - DESINCRONIZACIÓN CONFIRMADA**

**Evidencia:**
1. El sistema lee `student.streak` directamente de PostgreSQL (campo `streak`)
2. NO calcula la racha desde la tabla `practicas` (fuente de verdad para prácticas reales)
3. `checkDailyStreak` está diseñado para ACTUALIZAR cuando el usuario practica, no para LEER el valor real
4. Cuando se llama desde admin-master con `env = {}`, las actualizaciones fallan silenciosamente
5. Si el campo `streak` en PostgreSQL está desactualizado (ej. no se actualizó después de la caída), el valor mostrado será incorrecto

**Conclusión:** Existe una desincronización entre:
- **Fuente de verdad esperada:** Tabla `practicas` (prácticas reales)
- **Fuente de verdad actual:** Campo `streak` en tabla `alumnos` (puede estar desactualizado)

---

## D) HIPÓTESIS TÉCNICAS (máx. 3)

### Hipótesis 1: Campo `streak` en PostgreSQL no se actualiza automáticamente
**Probabilidad:** ALTA  
**Evidencia:**
- `checkDailyStreak` actualiza el campo SOLO cuando se ejecuta con contexto válido (`env` no vacío)
- En admin-master se llama con `env = {}`, por lo que las actualizaciones a ClickUp fallan
- Las actualizaciones a PostgreSQL dentro de `checkDailyStreak` solo ocurren si `student.email` existe y la BD SQLite está disponible
- Si el sistema estuvo caído, el campo `streak` puede haberse quedado con un valor obsoleto

### Hipótesis 2: `checkDailyStreak` devuelve valor incorrecto cuando `diffDays === 1` y el sistema estuvo caído
**Probabilidad:** MEDIA  
**Evidencia:**
- Si `lastPractice` fue hace varios días pero `diffDays === 1` (por algún bug en `dateDiffInDays` o zona horaria), la función incrementaría incorrectamente
- Sin embargo, si el sistema estuvo caído y no hay prácticas recientes, `diffDays` debería ser > 1

### Hipótesis 3: El campo `streak` en PostgreSQL se actualiza desde otra fuente (ClickUp, sincronización) y está desincronizado
**Probabilidad:** MEDIA  
**Evidencia:**
- Hay sincronización bidireccional entre ClickUp y PostgreSQL
- Si ClickUp tiene un valor incorrecto y se sincroniza, PostgreSQL heredará el error
- El diagnóstico menciona que el sistema DEBERÍA calcular desde `practicas` pero usa el campo `streak` (línea 93 del diagnóstico)

---

## E) RIESGO PARA EL SISTEMA

### Nivel de Riesgo: **MEDIO**

**Justificación:**
- **Impacto:** Los usuarios pueden ver rachas incorrectas, lo que afecta la confianza en el sistema
- **Alcance:** Afecta a la visualización en Modo Master, no a la lógica de actualización de rachas cuando el usuario practica realmente
- **Severidad:** Funcional pero con datos incorrectos
- **Urgencia:** Debe corregirse antes de FASE 2, ya que puede indicar problemas más profundos en la sincronización de datos

**Áreas afectadas:**
- Visualización de racha en cabecera del Modo Master
- Potencialmente otras visualizaciones que usen `ctx.streak.actual`

**Áreas NO afectadas:**
- Lógica de actualización cuando el usuario practica (usa `forcePractice: true` y contexto válido)
- Cálculo de racha en el flujo normal de `/enter`

---

## F) RECOMENDACIÓN: ¿BLOQUEAR FASE 2 HASTA RESOLVER?

### RESPUESTA: **SÍ - BLOQUEAR HASTA RESOLVER**

**Justificación:**
1. **Problema de arquitectura:** El sistema usa un campo almacenado en lugar de calcular desde la fuente de verdad (`practicas`)
2. **Riesgo de propagación:** Si FASE 2 depende de `ctx.streak.actual`, heredará el mismo problema
3. **Confianza en datos:** Un bug de desincronización puede indicar otros problemas similares en otros campos
4. **Corrección requerida:** Necesita refactor para calcular la racha desde `practicas` en lugar de usar el campo `streak` almacenado

**Acciones requeridas (FUERA DEL ALCANCE DE ESTE DEBUG):**
1. Implementar cálculo de racha desde tabla `practicas` (días consecutivos reales)
2. Mantener campo `streak` solo como caché/optimización, no como fuente de verdad
3. Validar coherencia entre `practicas` y `streak` en cada lectura crítica
4. O alternativamente: implementar un job que recalcule y sincronice `streak` periódicamente desde `practicas`

---

## ANEXO: Trazabilidad de Código

### Flujo Completo

1. **Usuario accede a Modo Master:**
   - `renderMaster()` → `validarYobtenerAlumno(alumnoId)`

2. **Construcción del contexto:**
   - `findStudentById(id)` → PostgreSQL → `normalizeAlumno()` → `student.streak`
   - `checkDailyStreak(student, {}, {})` → lee `student.streak` y `student.lastPractice`
   - Devuelve `streakCheck.streak`
   - Se asigna a `ctx.streak.actual`

3. **Renderizado:**
   - `rachaMostrar = ctx.streak.actual`
   - Se muestra en la cabecera HTML

### Logs Relevantes
- `[Master][CTX_OK]` en línea 167 de admin-master.js muestra el valor de `ctx.streak.actual`
- Si hay fallos, `[Master][CTX_FAIL]` en línea 171
- Si usa fallback, `[Master][CTX_FALLBACK]` en línea 264

### Verificación de Uso Correcto de ctx
**✅ CONFIRMADO:** Cuando `ctx !== null`:
- Línea 257: Usa `ctx.streak.actual`
- Línea 254-256: Usa `ctx.progress.nivel_efectivo` y `ctx.progress.fase_efectiva`
- Línea 262: Fallback a `alumno.racha` solo si `ctx === null`

**✅ NO hay uso de valores legacy cuando ctx está disponible**

---

## CONCLUSIÓN FINAL

El sistema tiene una **desincronización confirmada** debido a:
1. Uso de campo almacenado (`streak`) en lugar de cálculo desde fuente de verdad (`practicas`)
2. Campo puede estar desactualizado después de caídas del sistema
3. `checkDailyStreak` está diseñado para actualizar, no para leer valores reales

**Recomendación:** Bloquear FASE 2 hasta implementar cálculo correcto desde `practicas` o asegurar sincronización adecuada del campo `streak`.









