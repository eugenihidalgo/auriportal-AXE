# REGLAS CANÓNICAS — PROYECCIÓN ALL (PEOR ESTADO) v1
## AuriPortal / Aurelín — Contrato Constitucional

**Versión:** 1.0  
**Fecha:** 2026-01-13  
**Dominio:** MASTER  
**Sistema:** Alquimia General  
**Estado:** CONSTITUCIONAL

---

## ⚠️ ADVERTENCIA CONSTITUCIONAL

**Estas reglas son CONSTITUCIONALES.**

Cualquier implementación futura del sistema de proyección ALL **DEBE** respetarlas sin excepción.

**Violar estas reglas es violar el contrato canónico del sistema.**

---

## 1. PRINCIPIO FUNDAMENTAL

### La proyección ALL no muestra lo que va bien. Muestra lo que FALTA por trabajar.

**Regla absoluta:**
- Si al menos un alumno no ha trabajado un ítem, ese es el estado que se refleja en ALL.
- La proyección ALL es una herramienta de **detección de trabajo pendiente**, no un resumen estadístico.
- El Master debe poder identificar inmediatamente qué trabajo queda pendiente en el grupo.

**Justificación:**
- El Master necesita saber qué falta por hacer, no qué ya está hecho.
- Un ítem con 9 alumnos DONE y 1 alumno NEVER debe mostrarse como NEVER en ALL.
- La proyección ALL es una herramienta de **gobierno**, no de optimismo visual.

---

## 2. DEFINICIÓN DE "PEOR ESTADO"

### 2.1 Ítems tipo `una_vez`

#### Estados posibles por alumno:
- **NEVER**: El alumno nunca ha trabajado el ítem
- **PARTIAL**: El alumno ha trabajado parcialmente (si aplica según `veces_limpiar`)
- **DONE**: El alumno ha completado el ítem según `veces_limpiar`

#### Orden de severidad (peor → mejor):
1. **NEVER** (peor absoluto)
2. **PARTIAL** (intermedio)
3. **DONE** (mejor)

#### Regla de estado ALL:
- **Se toma el estado MÍNIMO del conjunto de alumnos.**
- Si al menos un alumno está en NEVER, el estado ALL es NEVER.
- Si todos están en DONE o PARTIAL, pero al menos uno está en PARTIAL, el estado ALL es PARTIAL.
- Solo si TODOS están en DONE, el estado ALL es DONE.

#### Ejemplo práctico:
```
Escenario:
- 9 alumnos: DONE
- 1 alumno: NEVER

Estado ALL = NEVER ✅

Razón: Al menos un alumno no ha trabajado el ítem.
```

#### Ejemplo práctico 2:
```
Escenario:
- 8 alumnos: DONE
- 2 alumnos: PARTIAL

Estado ALL = PARTIAL ✅

Razón: Al menos un alumno no ha completado el ítem.
```

---

### 2.2 Ítems tipo `recurrente`

#### Estado por alumno:
- **days_since_last_clean**: Días transcurridos desde la última limpieza
- **NULL**: Nunca limpiado (prioridad máxima, peor absoluto)

#### Regla de peor alumno:
- El peor alumno es el que tenga:
  - **NULL** (nunca limpiado) → **prioridad máxima, peor absoluto**
  - O el **mayor days_since_last_clean** entre los que sí han limpiado

#### Regla de estado ALL:
- **Refleja SIEMPRE el peor alumno.**
- No se promedian estados.
- No se toma el mejor caso.
- No se usa MAX() de last_cleaned_at (eso tomaría el mejor estado).

#### Ejemplo práctico:
```
Escenario:
- 9 alumnos: limpiaron ayer (days_since_last_clean = 1)
- 1 alumno: nunca limpió (NULL)

Estado ALL = NUNCA (NULL) ✅

Razón: Al menos un alumno nunca ha limpiado el ítem.
```

#### Ejemplo práctico 2:
```
Escenario:
- 5 alumnos: limpiaron hace 2 días (days_since_last_clean = 2)
- 5 alumnos: limpiaron hace 10 días (days_since_last_clean = 10)

Estado ALL = days_since_last_clean = 10 ✅

Razón: Se toma el peor caso (mayor days_since_last_clean).
```

#### Ejemplo práctico 3:
```
Escenario:
- 8 alumnos: limpiaron hoy (days_since_last_clean = 0)
- 1 alumno: limpió hace 30 días (days_since_last_clean = 30)
- 1 alumno: nunca limpió (NULL)

Estado ALL = NUNCA (NULL) ✅

Razón: NULL tiene prioridad máxima sobre cualquier days_since_last_clean.
```

---

## 3. CAPAS (view_layer)

### 3.1 Evaluación independiente por capa

Las capas se evalúan de forma **independiente**:
- **shared**: Capa compartida (visible para estudiantes)
- **pde**: Capa PDE (solo Master)

**Regla:**
- El peor estado se calcula **por capa**.
- Cada capa tiene su propio cálculo de peor estado.
- No se mezclan estados entre capas en el cálculo.

### 3.2 Capas derivadas (combo / effective)

#### combo (solo para `una_vez`):
- **NO inventa estados.**
- Hereda el peor estado entre `shared` y `pde`.
- Si `shared = NEVER` y `pde = DONE`, entonces `combo = NEVER`.

#### effective (solo para `recurrente`):
- **NO inventa estados.**
- Hereda el peor estado entre `shared` y `pde`.
- Si `shared = NULL` (nunca) y `pde = OK`, entonces `effective = NULL` (nunca).

### 3.3 Ejemplo práctico:

```
Escenario para ítem una_vez:
- shared: 9 alumnos DONE, 1 alumno NEVER → shared = NEVER
- pde: 10 alumnos DONE → pde = DONE

combo = NEVER ✅

Razón: Se toma el peor estado entre shared y pde.
```

```
Escenario para ítem recurrente:
- shared: 9 alumnos OK (days=1), 1 alumno NULL → shared = NULL
- pde: 10 alumnos OK (days=0) → pde = OK

effective = NULL ✅

Razón: Se toma el peor estado entre shared y pde.
```

---

## 4. DIFERENCIACIÓN SCOPE

### 4.1 scope=student

**Comportamiento:**
- Muestra el estado **real** de un único alumno.
- No hay agregación.
- No hay cálculo de peor estado.
- Es el estado literal del alumno seleccionado.

**Uso:**
- Visualización individual.
- Detalle de progreso de un alumno específico.

### 4.2 scope=all

**Comportamiento:**
- Muestra el estado **mínimo** del conjunto de alumnos.
- Se calcula el peor estado entre todos los alumnos activos.
- No se promedian estados.
- No se suavizan estados.
- No se toma el mejor caso.

**Uso:**
- Herramienta de gobierno.
- Detección de trabajo pendiente.
- Identificación de cuellos de botella.

### 4.3 Regla de separación

**PROHIBIDO:**
- Mezclar lógica entre scope=student y scope=all.
- Suavizar estados en scope=all.
- Mostrar promedios en scope=all.
- Tomar el mejor caso en scope=all.

**OBLIGATORIO:**
- scope=student → estado literal.
- scope=all → estado mínimo (peor estado).

---

## 5. ERRORES PROHIBIDOS

### 5.1 Uso de MAX() para proyección ALL

**PROHIBIDO:**
```sql
-- ❌ INCORRECTO
MAX(shared_last_cleaned_at) as shared_last_cleaned_at
```

**Razón:**
- MAX() toma el **mejor** estado (más reciente).
- La proyección ALL debe tomar el **peor** estado.

**CORRECTO:**
- Usar lógica que identifique el peor estado.
- Para `recurrente`: tomar NULL si existe, o MIN(last_cleaned_at) si todos han limpiado.
- Para `una_vez`: tomar NEVER si existe, o el estado mínimo.

### 5.2 Mostrar DONE si algún alumno está NEVER

**PROHIBIDO:**
- Mostrar estado DONE en ALL si al menos un alumno está en NEVER.
- Decir "9 de 10 alumnos han completado" y mostrar DONE.

**CORRECTO:**
- Si al menos un alumno está en NEVER, el estado ALL es NEVER.
- El Master debe ver inmediatamente que falta trabajo.

### 5.3 Promedios

**PROHIBIDO:**
- Calcular promedios de días.
- Mostrar "promedio de días desde última limpieza".
- Suavizar estados con promedios.

**CORRECTO:**
- Mostrar el peor caso.
- Si un alumno nunca limpió, mostrar NUNCA.
- Si un alumno limpió hace 30 días, mostrar 30 días (no el promedio).

### 5.4 "Alguien lo ha hecho"

**PROHIBIDO:**
- Mostrar DONE porque "alguien lo ha hecho".
- Mostrar OK porque "la mayoría lo ha hecho".
- Optimismo visual.

**CORRECTO:**
- Mostrar el peor estado.
- Si falta trabajo, mostrarlo claramente.
- La proyección ALL es para detectar problemas, no para celebrar éxitos.

### 5.5 Optimismo visual

**PROHIBIDO:**
- Mostrar estados "mejorados" artificialmente.
- Ocultar problemas con promedios.
- Suavizar estados para "no asustar".

**CORRECTO:**
- Mostrar la realidad cruda.
- Si hay un problema, mostrarlo.
- El Master necesita ver la verdad para gobernar.

---

## 6. CONSECUENCIA ARQUITECTÓNICA

### 6.1 La proyección ALL es una herramienta de gobierno

**Propósito:**
- Permitir al Master detectar inmediatamente qué trabajo queda pendiente en el grupo.
- Identificar cuellos de botella.
- Priorizar acciones correctivas.

**NO es:**
- Un resumen estadístico.
- Un dashboard de éxitos.
- Una herramienta de optimismo.

### 6.2 Implementación requerida

**Algoritmo canónico para scope='all':**

1. **Para cada ítem:**
   - Obtener estados de todos los alumnos activos.
   - Calcular el peor estado según tipo de ítem.
   - Asignar el peor estado como estado ALL.

2. **Para ítems `una_vez`:**
   - Si al menos un alumno está en NEVER → ALL = NEVER.
   - Si todos están en DONE o PARTIAL, pero al menos uno está en PARTIAL → ALL = PARTIAL.
   - Solo si TODOS están en DONE → ALL = DONE.

3. **Para ítems `recurrente`:**
   - Si al menos un alumno tiene NULL → ALL = NULL (nunca).
   - Si todos han limpiado, tomar el mayor days_since_last_clean.
   - Aplicar CPM (Cleaning Projection Model) con el peor estado.

4. **Por capa (view_layer):**
   - Calcular peor estado independientemente para shared y pde.
   - Para combo/effective, tomar el peor entre shared y pde.

### 6.3 Verificación canónica

**Checklist obligatorio para implementación:**
- [ ] ¿Se usa MAX() para proyección ALL? → **PROHIBIDO**
- [ ] ¿Se muestra DONE si algún alumno está NEVER? → **PROHIBIDO**
- [ ] ¿Se calculan promedios? → **PROHIBIDO**
- [ ] ¿Se toma el mejor caso? → **PROHIBIDO**
- [ ] ¿Se muestra el peor estado? → **OBLIGATORIO**
- [ ] ¿Se respeta NULL como peor absoluto? → **OBLIGATORIO**
- [ ] ¿Se calcula por capa independientemente? → **OBLIGATORIO**

---

## 7. REFERENCIAS CRUZADAS

### Documentación relacionada:
- **List Projection Model:** `docs/LIST_PROJECTION_MODEL_V1.md`
- **Cleaning Projection Model:** `docs/CLEANING_PROJECTION_MODEL_V1.md`
- **View Authority:** `docs/CONSTITUTION_VIEW_AUTHORITY_V1.md`
- **Diagnóstico completo:** `DIAGNOSTICO_CANONICO_COMPLETO_ALQUIMIA_GENERAL.md`

### Archivos relacionados:
- `src/core/master/services/list-projection-model.js` (implementación actual)
- `src/core/master/services/cleaning-projection-model.js` (CPM)

### Estado actual:
- ⚠️ **IMPLEMENTACIÓN ACTUAL INCORRECTA:** Usa MAX() en lugar de lógica de peor estado
- 📋 **PENDIENTE:** Rediseño canónico del algoritmo según estas reglas

---

## 8. VERSIONADO

**Versión 1.0 (2026-01-13):**
- Definición inicial de reglas canónicas.
- Formalización constitucional del criterio de "peor estado".
- Prohibición explícita de errores comunes.

**Futuras versiones:**
- Se añadirán ejemplos de implementación canónica.
- Se documentarán casos edge específicos.
- Se añadirán tests de verificación.

---

## 9. CONCLUSIÓN

**Estas reglas son CONSTITUCIONALES.**

Cualquier implementación del sistema de proyección ALL **DEBE** respetarlas sin excepción.

**La proyección ALL muestra lo que falta por trabajar, no lo que ya está hecho.**

**El Master necesita ver la verdad para gobernar.**

---

**Fin del documento canónico.**
