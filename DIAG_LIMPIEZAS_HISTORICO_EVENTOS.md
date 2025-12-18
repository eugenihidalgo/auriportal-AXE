# Diagnóstico Histórico / Eventos: Sistema de Limpiezas

**Fecha**: 2025-01-15  
**Modo**: Solo lectura (análisis histórico)  
**Escrituras**: PROHIBIDAS  
**Migraciones**: PROHIBIDAS

---

## 1. INVENTARIO DE HISTÓRICOS

### Tablas Append-Only (Histórico Puro)

#### 1.1. `limpiezas_master_historial`

**Propósito**:**
- Registro de todas las limpiezas realizadas por el Master
- Incluye limpiezas de alumnos específicos y limpiezas globales

**Estructura:**
```sql
- id (PK)
- alumno_id (FK → alumnos.id, NULLABLE para limpiezas globales)
- tipo (VARCHAR 50) - Tipo de limpieza: 'anatomia', 'karmicos', 'indeseables', 'lugares', 'proyectos', 'apadrinados', 'limpieza_hogar', 'transmutacion_energetica'
- aspecto_id (INT) - ID del aspecto limpiado
- aspecto_nombre (VARCHAR 500) - Nombre del aspecto (snapshot)
- seccion (VARCHAR 100) - Sección a la que pertenece
- fecha_limpieza (TIMESTAMP) - Fecha/hora de la limpieza
- created_at (TIMESTAMP) - Fecha de creación del registro
```

**Qué evento representa:**
- Evento: "Limpieza realizada por el Master"
- Momento: Cuando se marca un aspecto como limpiado desde el panel Master

**Qué información guarda:**
- ✅ QUÉ se limpió (aspecto_id, aspecto_nombre, seccion)
- ✅ CUÁNDO se limpió (fecha_limpieza)
- ✅ QUIÉN fue limpiado (alumno_id, NULL si es global)
- ✅ TIPO de limpieza (tipo)
- ✅ Snapshot del nombre del aspecto (aspecto_nombre)

**Qué NO guarda:**
- ❌ QUIÉN realizó la limpieza (no hay campo actor_id o master_id)
- ❌ DESDE DÓNDE se realizó (no hay campo origen o contexto)
- ❌ TÉCNICA utilizada (no hay campo tecnica_id)
- ❌ Estado anterior del aspecto
- ❌ Valor anterior de veces_limpiado
- ❌ Notas o comentarios sobre la limpieza
- ❌ IP o user-agent del Master
- ❌ Request ID para correlación

**Estado actual:**
- 25 registros según diagnóstico DB-ONLY
- Tabla existe y está activa
- Se registra en `admin-master.js` líneas 2128-2131 y 2202-2206

---

#### 1.2. `aspectos_energeticos_registros`

**Propósito:**
- Histórico detallado de limpiezas de aspectos energéticos
- Diseñado para guardar información contextual de cada limpieza

**Estructura:**
```sql
- id (PK)
- alumno_id (FK → alumnos.id)
- aspecto_id (FK → aspectos_energeticos.id)
- fecha (TIMESTAMP) - Fecha de la limpieza
- modo_limpieza (TEXT) - Modo de limpieza utilizado
- origen (TEXT) - Origen del evento (ej: 'master', 'alumno', 'automation')
- notas (TEXT) - Notas adicionales
- metadata (JSONB) - Metadatos adicionales
```

**Qué evento representa:**
- Evento: "Limpieza de aspecto energético realizada"
- Momento: Cuando se marca un aspecto energético como limpiado

**Qué información guarda:**
- ✅ QUÉ se limpió (aspecto_id)
- ✅ CUÁNDO se limpió (fecha)
- ✅ QUIÉN fue limpiado (alumno_id)
- ✅ MODO de limpieza (modo_limpieza)
- ✅ ORIGEN del evento (origen)
- ✅ NOTAS (notas)
- ✅ METADATOS adicionales (metadata JSONB)

**Qué NO guarda:**
- ❌ QUIÉN realizó la limpieza (no hay campo actor_id)
- ❌ TÉCNICA específica utilizada (solo modo_limpieza genérico)
- ❌ Estado anterior del aspecto
- ❌ IP o user-agent

**Estado actual:**
- 0 registros según diagnóstico DB-ONLY
- Tabla existe pero NO se está utilizando
- Código de inserción existe en `aspectos-energeticos.js` línea 295, pero no se llama desde `admin-master.js`
- **RIESGO CRÍTICO**: Tabla diseñada pero no implementada

---

#### 1.3. `audit_events`

**Propósito:**
- Sistema de auditoría general del sistema
- Registra eventos de diferentes tipos (no solo limpiezas)

**Estructura:**
```sql
- id (PK)
- actor_type (VARCHAR) - Tipo de actor: 'admin', 'master', 'system'
- actor_id (INT) - ID del actor (opcional)
- alumno_id (INT) - ID del alumno afectado
- action (VARCHAR) - Nombre de la acción
- entity_type (VARCHAR) - Tipo de entidad afectada
- entity_id (VARCHAR) - ID de la entidad
- payload (JSONB) - Datos adicionales del evento
- ip (VARCHAR) - IP del request
- user_agent (TEXT) - User-agent del request
- request_id (VARCHAR) - Correlation ID
- created_at (TIMESTAMP)
- is_deleted (BOOLEAN)
```

**Qué evento representa:**
- Evento: "Cualquier acción del sistema que requiere auditoría"
- Incluye limpiezas pero también otros eventos (cambios de apodo, pausas, etc.)

**Qué información guarda:**
- ✅ QUIÉN realizó la acción (actor_type, actor_id)
- ✅ QUÉ acción se realizó (action)
- ✅ SOBRE QUÉ entidad (entity_type, entity_id)
- ✅ CUÁNDO (created_at)
- ✅ DESDE DÓNDE (ip, user_agent)
- ✅ CONTEXTO (payload JSONB)
- ✅ CORRELACIÓN (request_id)

**Qué NO guarda específicamente para limpiezas:**
- ❌ Nombre del aspecto limpiado (solo entity_id)
- ❌ Sección del aspecto
- ❌ Técnica utilizada (a menos que esté en payload)
- ❌ Estado anterior

**Estado actual:**
- Sistema activo y funcionando
- Se registra en `admin-master.js` línea 2218 para limpiezas
- Payload puede contener información adicional pero no está estandarizado

---

### Tablas de Estado (Sobrescribibles)

#### 1.4. `aspectos_energeticos_alumnos`

**Propósito:**
- Estado actual de cada aspecto para cada alumno
- Se actualiza (sobrescribe) en cada limpieza

**Campos críticos:**
```sql
- ultima_limpieza (TIMESTAMP) - Se SOBRESCRIBE en cada limpieza
- veces_limpiado (INT) - Se INCREMENTA, valor anterior se pierde
- estado (TEXT) - Se SOBRESCRIBE ('pendiente', 'al_dia', 'muy_pendiente')
- proxima_limpieza (TIMESTAMP) - Se SOBRESCRIBE
```

**Riesgo:**
- ❌ No se guarda el valor anterior de `ultima_limpieza`
- ❌ No se guarda el valor anterior de `veces_limpiado` (solo se incrementa)
- ❌ No se guarda el estado anterior

**Similar para:**
- `aspectos_karmicos_alumnos`
- `aspectos_indeseables_alumnos`
- `transmutaciones_lugares_estado`
- `transmutaciones_proyectos_estado`
- `transmutaciones_apadrinados_estado`
- `limpieza_hogar_alumnos`
- `items_transmutaciones_alumnos`

---

## 2. TRAZABILIDAD REAL

### 2.1. ¿Puedo saber CUÁNDO se limpió un aspecto concreto?

**Respuesta: SÍ, con limitaciones**

**Ejemplo real:**
```sql
-- Buscar todas las limpiezas de un aspecto específico para un alumno
SELECT 
  fecha_limpieza,
  aspecto_nombre,
  seccion,
  tipo
FROM limpiezas_master_historial
WHERE alumno_id = 123
  AND aspecto_id = 45
ORDER BY fecha_limpieza DESC;
```

**Limitaciones:**
- ✅ Funciona para limpiezas del Master
- ❌ NO funciona para limpiezas automáticas o de otros orígenes (si existen)
- ❌ NO funciona si la tabla `aspectos_energeticos_registros` estuviera activa (está vacía)
- ⚠️ Solo muestra la última limpieza en `aspectos_energeticos_alumnos.ultima_limpieza`, no el historial completo

---

### 2.2. ¿Puedo saber QUIÉN lo limpió?

**Respuesta: PARCIALMENTE**

**Para limpiezas del Master:**
- ❌ NO directamente en `limpiezas_master_historial` (no hay campo actor_id)
- ✅ SÍ indirectamente en `audit_events` (si se registró correctamente)

**Ejemplo real:**
```sql
-- Buscar quién realizó una limpieza específica
SELECT 
  ae.actor_type,
  ae.actor_id,
  ae.action,
  ae.created_at,
  ae.payload
FROM audit_events ae
WHERE ae.alumno_id = 123
  AND ae.action = 'marcar-limpio'
  AND ae.entity_type = 'aspecto_energetico'
  AND ae.entity_id = '45'
ORDER BY ae.created_at DESC
LIMIT 1;
```

**Limitaciones:**
- ⚠️ Requiere correlación entre `limpiezas_master_historial` y `audit_events` por fecha
- ⚠️ Si `audit_events` falla (fail-open), no hay registro
- ❌ No hay garantía de que ambos eventos tengan la misma fecha exacta

---

### 2.3. ¿Puedo saber DESDE DÓNDE (global, alumno, evento)?

**Respuesta: SÍ, con limitaciones**

**Para limpiezas globales:**
```sql
-- Limpiezas globales (sin alumno específico)
SELECT *
FROM limpiezas_master_historial
WHERE alumno_id IS NULL
ORDER BY fecha_limpieza DESC;
```

**Para limpiezas de alumno específico:**
```sql
-- Limpiezas de un alumno específico
SELECT *
FROM limpiezas_master_historial
WHERE alumno_id = 123
ORDER BY fecha_limpieza DESC;
```

**Limitaciones:**
- ✅ Funciona correctamente (alumno_id NULL = global)
- ❌ No hay campo que indique el "contexto" de la limpieza (ej: "desde panel master", "desde evento específico")
- ❌ No hay campo que indique si fue limpieza masiva o individual

---

### 2.4. ¿Puedo saber con qué técnica / contexto?

**Respuesta: NO, en la mayoría de casos**

**Para `limpiezas_master_historial`:**
- ❌ NO hay campo `tecnica_id`
- ❌ NO hay campo `modo_limpieza`
- ❌ NO hay información sobre la técnica utilizada

**Para `aspectos_energeticos_registros`:**
- ✅ SÍ hay campo `modo_limpieza` (pero la tabla está vacía, no se usa)
- ✅ SÍ hay campo `origen` (pero la tabla está vacía, no se usa)
- ✅ SÍ hay campo `notas` (pero la tabla está vacía, no se usa)

**Para `audit_events`:**
- ⚠️ Podría estar en `payload` JSONB, pero no está estandarizado
- ❌ No hay garantía de que contenga información de técnica

**Conclusión:**
- ❌ **NO es posible** saber qué técnica se utilizó para limpiezas históricas
- ❌ **NO es posible** saber el contexto completo de la limpieza

---

## 3. RIESGOS DE PÉRDIDA DE HISTORIA

### 3.1. Estados Sobrescritos Sin Log

**Riesgo: ALTO**

**Problema:**
Cuando se actualiza `aspectos_energeticos_alumnos.ultima_limpieza`, el valor anterior se pierde.

**Ejemplo:**
```sql
-- Estado inicial
ultima_limpieza = '2025-01-10 10:00:00'
veces_limpiado = 5

-- Limpieza nueva (2025-01-15 14:00:00)
UPDATE aspectos_energeticos_alumnos
SET ultima_limpieza = '2025-01-15 14:00:00',
    veces_limpiado = 6
WHERE alumno_id = 123 AND aspecto_id = 45;

-- ❌ PERDIDO: No sabemos que la limpieza anterior fue el 2025-01-10
-- ✅ PRESERVADO: En limpiezas_master_historial (si se registró)
```

**Impacto:**
- ✅ Mitigado parcialmente por `limpiezas_master_historial`
- ❌ Si `limpiezas_master_historial` falla, se pierde completamente
- ❌ No hay forma de reconstruir el estado intermedio

---

### 3.2. Contadores que Pierden Información

**Riesgo: MEDIO**

**Problema:**
El campo `veces_limpiado` se incrementa, pero no se guarda el valor anterior.

**Ejemplo:**
```sql
-- Estado inicial
veces_limpiado = 10

-- Limpieza nueva
UPDATE aspectos_energeticos_alumnos
SET veces_limpiado = veces_limpiado + 1  -- Ahora es 11
WHERE alumno_id = 123 AND aspecto_id = 45;

-- ❌ PERDIDO: No sabemos que antes era 10
-- ❌ Si hay un error y se ejecuta dos veces, sería 12 en lugar de 11
```

**Impacto:**
- ⚠️ Si hay un bug que ejecuta la limpieza dos veces, el contador se incrementa incorrectamente
- ❌ No hay forma de detectar o corregir este error después
- ❌ No se puede reconstruir el valor correcto del contador

**Mitigación parcial:**
- Se puede contar registros en `limpiezas_master_historial`:
```sql
SELECT COUNT(*) as veces_limpiado_real
FROM limpiezas_master_historial
WHERE alumno_id = 123 AND aspecto_id = 45;
```
- ⚠️ Pero solo funciona si TODAS las limpiezas se registraron en historial
- ❌ Si alguna limpieza no se registró, el contador será incorrecto

---

### 3.3. Datos Imposibles de Reconstruir

**Riesgo: CRÍTICO**

**Escenarios donde se pierde información:**

1. **Limpieza sin registro en historial:**
   - Si `limpiezas_master_historial` falla (try-catch con warn, no crítico)
   - Si `audit_events` falla (fail-open)
   - **Resultado**: Limpieza realizada pero sin registro histórico

2. **Limpieza antes de crear tabla de historial:**
   - Si la tabla `limpiezas_master_historial` se creó después de algunas limpiezas
   - **Resultado**: Historial incompleto desde el inicio

3. **Limpieza de aspecto eliminado:**
   - Si un aspecto se elimina de `aspectos_energeticos`
   - El historial tiene `aspecto_id` pero el aspecto ya no existe
   - **Resultado**: No se puede saber qué aspecto fue (solo el ID)

4. **Limpieza sin nombre de aspecto:**
   - Si falla la consulta para obtener `aspecto_nombre` (línea 2164-2191 de admin-master.js)
   - Se registra con `aspecto_nombre = NULL`
   - **Resultado**: No se puede saber qué aspecto fue limpiado

---

### 3.4. Ambigüedades Semánticas

**Riesgo: MEDIO**

**Problemas detectados:**

1. **Campo `tipo` en `limpiezas_master_historial`:**
   - Valores posibles: 'anatomia', 'karmicos', 'indeseables', 'lugares', 'proyectos', 'apadrinados', 'limpieza_hogar', 'transmutacion_energetica'
   - ⚠️ 'anatomia' es genérico, no indica la sección específica
   - ⚠️ 'transmutacion_energetica' no indica la lista específica

2. **Campo `seccion` en `limpiezas_master_historial`:**
   - Se obtiene dinámicamente (línea 2167, 2171, etc.)
   - ⚠️ Si cambia el nombre de la sección, el historial tiene nombres antiguos
   - ⚠️ No hay normalización de nombres de sección

3. **Falta de relación con técnicas:**
   - No hay FK a `tecnicas_limpieza`
   - No se sabe qué técnica se utilizó
   - ⚠️ Imposible analizar efectividad de técnicas

---

## 4. SOPORTE PARA ANALYTICS FUTUROS

### 4.1. Rankings de Limpieza

**¿Es posible hoy? SÍ, con limitaciones**

**Ejemplo:**
```sql
-- Ranking de aspectos más limpiados
SELECT 
  aspecto_id,
  aspecto_nombre,
  COUNT(*) as veces_limpiado
FROM limpiezas_master_historial
WHERE alumno_id IS NOT NULL  -- Solo limpiezas de alumnos
GROUP BY aspecto_id, aspecto_nombre
ORDER BY veces_limpiado DESC;
```

**Limitaciones:**
- ✅ Funciona para limpiezas del Master
- ❌ NO incluye limpiezas que no se registraron en historial
- ❌ NO incluye limpiezas automáticas (si existen)
- ⚠️ Solo cuenta registros en historial, no el contador `veces_limpiado` de la tabla de estado

---

### 4.2. Evolución Temporal

**¿Es posible hoy? SÍ, con limitaciones**

**Ejemplo:**
```sql
-- Evolución de limpiezas por mes
SELECT 
  DATE_TRUNC('month', fecha_limpieza) as mes,
  COUNT(*) as total_limpiezas,
  COUNT(DISTINCT alumno_id) as alumnos_unicos,
  COUNT(DISTINCT aspecto_id) as aspectos_unicos
FROM limpiezas_master_historial
WHERE fecha_limpieza >= '2024-01-01'
GROUP BY DATE_TRUNC('month', fecha_limpieza)
ORDER BY mes DESC;
```

**Limitaciones:**
- ✅ Funciona para limpiezas del Master
- ❌ NO incluye limpiezas que no se registraron
- ⚠️ Solo muestra limpiezas registradas, no el estado real de los aspectos

---

### 4.3. Comparativas Entre Alumnos

**¿Es posible hoy? SÍ, con limitaciones**

**Ejemplo:**
```sql
-- Comparativa de limpiezas entre alumnos
SELECT 
  a.id as alumno_id,
  a.apodo,
  COUNT(lmh.id) as total_limpiezas,
  COUNT(DISTINCT lmh.aspecto_id) as aspectos_unicos_limpiados
FROM alumnos a
LEFT JOIN limpiezas_master_historial lmh ON lmh.alumno_id = a.id
WHERE a.estado_suscripcion = 'activa'
GROUP BY a.id, a.apodo
ORDER BY total_limpiezas DESC;
```

**Limitaciones:**
- ✅ Funciona para limpiezas del Master
- ❌ NO incluye limpiezas que no se registraron
- ⚠️ Solo cuenta registros en historial, no el estado real

---

### 4.4. Métricas de Recurrencia Real

**¿Es posible hoy? PARCIALMENTE**

**Ejemplo:**
```sql
-- Calcular días entre limpiezas del mismo aspecto para un alumno
WITH limpiezas_ordenadas AS (
  SELECT 
    alumno_id,
    aspecto_id,
    fecha_limpieza,
    LAG(fecha_limpieza) OVER (
      PARTITION BY alumno_id, aspecto_id 
      ORDER BY fecha_limpieza
    ) as limpieza_anterior
  FROM limpiezas_master_historial
  WHERE alumno_id = 123
)
SELECT 
  aspecto_id,
  fecha_limpieza,
  limpieza_anterior,
  fecha_limpieza - limpieza_anterior as dias_entre_limpiezas
FROM limpiezas_ordenadas
WHERE limpieza_anterior IS NOT NULL
ORDER BY fecha_limpieza DESC;
```

**Limitaciones:**
- ✅ Funciona para limpiezas del Master
- ❌ NO incluye limpiezas que no se registraron (crea gaps artificiales)
- ⚠️ Si falta una limpieza en el historial, el cálculo de días será incorrecto
- ❌ No se puede comparar con `frecuencia_dias` esperada si hay limpiezas faltantes

---

## 5. RESUMEN EJECUTIVO

### Fortalezas

1. ✅ **Tabla `limpiezas_master_historial` activa y funcionando**
   - Registra limpiezas del Master
   - Incluye información básica (qué, cuándo, quién)
   - Soporta limpiezas globales (alumno_id NULL)

2. ✅ **Sistema de auditoría (`audit_events`) implementado**
   - Registra quién realizó la acción
   - Incluye IP y user-agent
   - Permite correlación con otros eventos

3. ✅ **Estructura de `aspectos_energeticos_registros` bien diseñada**
   - Campos para modo_limpieza, origen, notas
   - Metadata JSONB para extensibilidad

### Debilidades Críticas

1. ❌ **`aspectos_energeticos_registros` NO se está utilizando**
   - Tabla diseñada pero vacía
   - Código de inserción existe pero no se llama
   - **RIESGO**: Información contextual perdida

2. ❌ **Estados sobrescritos sin histórico completo**
   - `ultima_limpieza` se sobrescribe
   - `veces_limpiado` se incrementa sin guardar valor anterior
   - Dependencia total de `limpiezas_master_historial` (que puede fallar)

3. ❌ **Falta de información de técnica**
   - No hay FK a `tecnicas_limpieza`
   - No se puede analizar efectividad de técnicas
   - No se puede recomendar técnicas basadas en historial

4. ❌ **Falta de información de actor en historial**
   - `limpiezas_master_historial` no tiene `actor_id`
   - Dependencia de `audit_events` para correlación
   - Si `audit_events` falla, se pierde información de quién

5. ⚠️ **Fail-open en registro de historial**
   - Si `limpiezas_master_historial` falla, solo se loguea warning
   - La limpieza se realiza pero no se registra
   - **RIESGO**: Historial incompleto sin detección

### Recomendaciones Prioritarias

1. **URGENTE: Activar `aspectos_energeticos_registros`**
   - Llamar a la inserción desde `admin-master.js`
   - Registrar modo_limpieza, origen, notas
   - Permite análisis contextual futuro

2. **IMPORTANTE: Agregar `actor_id` a `limpiezas_master_historial`**
   - No depender de correlación con `audit_events`
   - Garantizar trazabilidad directa

3. **IMPORTANTE: Agregar `tecnica_id` a `limpiezas_master_historial`**
   - Permitir análisis de efectividad
   - Recomendaciones basadas en historial

4. **MEJORA: Normalizar nombres de sección**
   - Tabla de secciones con ID
   - FK en lugar de VARCHAR
   - Evitar ambigüedades por cambios de nombre

5. **MEJORA: Fail-safe en registro de historial**
   - Si falla `limpiezas_master_historial`, no permitir la limpieza
   - O al menos registrar en log crítico
   - Evitar pérdida silenciosa de historial

---

**Fin del diagnóstico**










