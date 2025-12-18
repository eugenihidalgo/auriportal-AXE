# 🔄 MAPEO LEGACY → EVENTOS: Sistema de Limpiezas y Transmutaciones

**Fecha:** 2024  
**Objetivo:** Mapear exhaustivamente todas las operaciones legacy que marcan "limpio" o actualizan estados/counters hacia el sistema de eventos `energy_events`  
**Modo:** READ-ONLY (análisis, sin modificaciones)

---

## 📋 ÍNDICE

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Mapeo por Tipo de Sujeto](#mapeo-por-tipo-de-sujeto)
3. [Endpoints y Handlers](#endpoints-y-handlers)
4. [Inconsistencias Identificadas](#inconsistencias-identificadas)
5. [Recomendaciones de Metadata](#recomendaciones-de-metadata)

---

## 📊 RESUMEN EJECUTIVO

### Operaciones Legacy Identificadas

| Categoría | Cantidad | Archivos |
|-----------|----------|----------|
| **Endpoints Admin** | 2 | `admin-master.js`, `limpieza-master.js` |
| **Endpoints Portal Alumno** | 2 | `limpieza-handler.js`, `transmutaciones-cliente.js` |
| **Services Individuales** | 8 | `aspectos-energeticos.js`, `aspectos-karmicos.js`, `aspectos-indeseables.js`, `transmutaciones-energeticas.js`, `transmutaciones-lugares.js`, `transmutaciones-proyectos.js`, `transmutaciones-apadrinados.js`, `limpieza.js` |
| **Operaciones Globales** | 6 | Funciones `marcarTodosAlumnosLimpios*` |
| **Tipos de Sujetos** | 8 | aspecto, karmico, indeseable, hogar, item_transmutacion, lugar, proyecto, apadrinado |

### Tipos de Eventos Propuestos

- `cleaning` - Limpieza estándar (recurrente)
- `cleaning_completed` - Limpieza de una vez completada
- `illumination` - Iluminación/transmutación
- `batch_cleaning` - Limpieza masiva (admin para todos)

---

## 🗺️ MAPEO POR TIPO DE SUJETO

### 1. ASPECTOS ENERGÉTICOS (Anatomía)

#### 1.1. Limpieza Individual (Alumno o Admin)

**Legacy Operation:**
- **Archivo:** `src/endpoints/admin-master.js`
- **Función:** `handleMarcarLimpio()` (líneas 1935-2256)
- **Endpoint:** `POST /admin/master/:alumnoId/marcar-limpio`
- **Body:** `{ tipo: 'anatomia', aspecto_id: number }`

**Mapeo a Evento:**

| Campo | Valor |
|-------|-------|
| `subject_type` | `'aspecto'` |
| `subject_id` | `aspecto_id` (del body) |
| `alumno_id` | `alumnoId` (del path param) |
| `event_type` | `'cleaning'` (si `tipo_limpieza = 'regular'`) o `'cleaning_completed'` (si `tipo_limpieza = 'una_vez'`) |
| `requires_clean_state` | `true` |
| `is_clean_after` | `true` |
| `illumination_amount` | `NULL` |
| `origin` | `'admin'` (si viene de admin) o `'student'` (si viene de portal) |
| `actor_type` | `'admin'` o `'student'` |
| `actor_id` | ID del admin o del alumno |
| `request_id` | Generar UUID único por request |
| `metadata` | `{ tipo_aspecto: 'anatomia', seccion_id: number | null, seccion_nombre: string | null, frecuencia_dias: number, tipo_limpieza: 'regular' | 'una_vez', cantidad_completada: number (si una_vez), cantidad_requerida: number (si una_vez), completado_permanentemente: boolean (si una_vez) }` |

**Source de Datos:**
- `aspecto_id` → del body
- `alumno_id` → del path param `:alumnoId`
- `seccion_id` → calcular desde `aspectos_energeticos.seccion_id`
- `seccion_nombre` → JOIN con `secciones_limpieza.nombre`
- `frecuencia_dias` → `aspectos_energeticos.frecuencia_dias`
- `tipo_limpieza` → `aspectos_energeticos.tipo_limpieza`
- `cantidad_completada` → `aspectos_energeticos_alumnos.cantidad_completada` (si existe)
- `cantidad_requerida` → `aspectos_energeticos.cantidad_minima` o `aspectos_energeticos_alumnos.cantidad_requerida`

**Legacy Operation Alternativa:**
- **Archivo:** `src/modules/limpieza.js`
- **Función:** `marcarAspectoLimpio()` (líneas 225-319)
- **Uso:** Portal del alumno

**Mapeo:** Similar al anterior, pero `origin = 'student'` y `actor_type = 'student'`

---

#### 1.2. Limpieza Global (Admin para Todos)

**Legacy Operation:**
- **Archivo:** `src/services/aspectos-energeticos.js`
- **Función:** `marcarTodosAlumnosLimpiosPorAspecto()` (líneas 453-538)
- **Endpoint:** Llamado desde admin panel

**Mapeo a Evento:**

| Campo | Valor |
|-------|-------|
| `subject_type` | `'aspecto'` |
| `subject_id` | `aspectoId` (parámetro) |
| `alumno_id` | `NULL` (indica que es para todos) |
| `event_type` | `'batch_cleaning'` |
| `requires_clean_state` | `true` |
| `is_clean_after` | `true` |
| `illumination_amount` | `NULL` |
| `origin` | `'admin'` |
| `actor_type` | `'admin'` |
| `actor_id` | ID del admin que ejecuta |
| `request_id` | Generar UUID único |
| `metadata` | `{ tipo_aspecto: 'anatomia', seccion: 'Anatomía Energética', frecuencia_dias: number, alumnos_afectados: number (contador), tipo_limpieza: 'regular' }` |

**Nota:** Este evento se crea UNA VEZ con `alumno_id = NULL`. Los eventos individuales para cada alumno se crearán en un proceso separado o se derivarán de este evento batch.

---

### 2. ASPECTOS KÁRMICOS

#### 2.1. Limpieza Individual

**Legacy Operation:**
- **Archivo:** `src/endpoints/admin-master.js`
- **Función:** `handleMarcarLimpio()` (líneas 2028-2032)
- **Endpoint:** `POST /admin/master/:alumnoId/marcar-limpio`
- **Body:** `{ tipo: 'karmicos', aspecto_id: number }`

**Mapeo a Evento:**

| Campo | Valor |
|-------|-------|
| `subject_type` | `'karmico'` |
| `subject_id` | `aspecto_id` |
| `alumno_id` | `alumnoId` |
| `event_type` | `'cleaning'` |
| `requires_clean_state` | `true` |
| `is_clean_after` | `true` |
| `illumination_amount` | `NULL` |
| `origin` | `'admin'` o `'student'` |
| `actor_type` | `'admin'` o `'student'` |
| `actor_id` | ID correspondiente |
| `request_id` | UUID único |
| `metadata` | `{ tipo_aspecto: 'karmicos', frecuencia_dias: number, seccion: 'Aspectos Kármicos' }` |

**Legacy Operation Global:**
- **Archivo:** `src/services/aspectos-karmicos.js`
- **Función:** `marcarTodosAlumnosLimpiosPorAspectoKarmico()` (línea 330+)
- **Mapeo:** Similar a 1.2, con `subject_type = 'karmico'` y `metadata.tipo_aspecto = 'karmicos'`

---

### 3. ENERGÍAS INDESEABLES

#### 3.1. Limpieza Individual

**Legacy Operation:**
- **Archivo:** `src/endpoints/admin-master.js`
- **Función:** `handleMarcarLimpio()` (líneas 2033-2037)
- **Endpoint:** `POST /admin/master/:alumnoId/marcar-limpio`
- **Body:** `{ tipo: 'indeseables', aspecto_id: number }`

**Mapeo a Evento:**

| Campo | Valor |
|-------|-------|
| `subject_type` | `'indeseable'` |
| `subject_id` | `aspecto_id` |
| `alumno_id` | `alumnoId` |
| `event_type` | `'cleaning'` |
| `requires_clean_state` | `true` |
| `is_clean_after` | `true` |
| `illumination_amount` | `NULL` |
| `origin` | `'admin'` o `'student'` |
| `actor_type` | `'admin'` o `'student'` |
| `actor_id` | ID correspondiente |
| `request_id` | UUID único |
| `metadata` | `{ tipo_aspecto: 'indeseables', frecuencia_dias: number, seccion: 'Energías Indeseables' }` |

**Legacy Operation Global:**
- **Archivo:** `src/services/aspectos-indeseables.js`
- **Función:** `marcarTodosAlumnosLimpiosPorAspectoIndeseable()` (línea 355+)
- **Mapeo:** Similar a 1.2, con `subject_type = 'indeseable'`

---

### 4. LIMPIEZA DE HOGAR

#### 4.1. Limpieza Individual

**Legacy Operation:**
- **Archivo:** `src/endpoints/admin-master.js`
- **Función:** `handleMarcarLimpio()` (líneas 2053-2057)
- **Endpoint:** `POST /admin/master/:alumnoId/marcar-limpio`
- **Body:** `{ tipo: 'limpieza_hogar', aspecto_id: number }`

**Mapeo a Evento:**

| Campo | Valor |
|-------|-------|
| `subject_type` | `'hogar'` |
| `subject_id` | `aspecto_id` |
| `alumno_id` | `alumnoId` |
| `event_type` | `'cleaning'` |
| `requires_clean_state` | `true` |
| `is_clean_after` | `true` |
| `illumination_amount` | `NULL` |
| `origin` | `'admin'` o `'student'` |
| `actor_type` | `'admin'` o `'student'` |
| `actor_id` | ID correspondiente |
| `request_id` | UUID único |
| `metadata` | `{ tipo_aspecto: 'limpieza_hogar', frecuencia_dias: number, seccion: 'Limpieza de Hogar', nombre_hogar: string }` |

---

### 5. ITEMS DE TRANSMUTACIONES ENERGÉTICAS

#### 5.1. Limpieza Individual (Portal Alumno)

**Legacy Operation:**
- **Archivo:** `src/endpoints/limpieza-handler.js`
- **Función:** `handleMarcarLimpio()` (líneas 358-395)
- **Endpoint:** `POST /limpieza/marcar`
- **Body:** `{ aspecto_id: number }`

**Legacy Operation Alternativa:**
- **Archivo:** `src/services/transmutaciones-energeticas.js`
- **Función:** `limpiarItemParaAlumno()` (líneas 601-628)
- **Uso:** Llamado desde handlers

**Mapeo a Evento:**

| Campo | Valor |
|-------|-------|
| `subject_type` | `'item_transmutacion'` |
| `subject_id` | `itemId` (parámetro) |
| `alumno_id` | `alumnoId` (parámetro) |
| `event_type` | `'illumination'` (si lista tipo = 'recurrente') o `'illumination_completed'` (si lista tipo = 'una_vez') |
| `requires_clean_state` | `true` |
| `is_clean_after` | `true` |
| `illumination_amount` | `veces_completadas` (si tipo = 'una_vez') o `NULL` |
| `origin` | `'student'` |
| `actor_type` | `'student'` |
| `actor_id` | `alumnoId` |
| `request_id` | UUID único |
| `metadata` | `{ lista_id: number, lista_nombre: string, lista_tipo: 'recurrente' | 'una_vez', frecuencia_dias: number (si recurrente), veces_limpiar: number (si una_vez), veces_completadas: number (si una_vez), nivel: number, prioridad: string }` |

**Source de Datos:**
- `itemId` → del body o parámetro
- `lista_id` → `items_transmutaciones.lista_id`
- `lista_nombre` → JOIN con `listas_transmutaciones.nombre`
- `lista_tipo` → `listas_transmutaciones.tipo`
- `frecuencia_dias` → `items_transmutaciones.frecuencia_dias`
- `veces_limpiar` → `items_transmutaciones.veces_limpiar`
- `veces_completadas` → `items_transmutaciones_alumnos.veces_completadas` (después del incremento)

---

#### 5.2. Limpieza Individual (Admin)

**Legacy Operation:**
- **Archivo:** `src/endpoints/admin-master.js`
- **Función:** `handleMarcarLimpio()` (líneas 2100-2154)
- **Endpoint:** `POST /admin/master/:alumnoId/marcar-limpio`
- **Body:** `{ tipo: 'transmutacion_X', aspecto_id: number }` (donde X = lista_id)

**Mapeo:** Similar a 5.1, pero `origin = 'admin'` y `actor_type = 'admin'`

---

#### 5.3. Limpieza Global (Admin para Todos)

**Legacy Operation:**
- **Archivo:** `src/services/transmutaciones-energeticas.js`
- **Función:** `limpiarItemParaTodos()` (líneas 507-545)
- **Endpoint:** Llamado desde admin panel

**Mapeo a Evento:**

| Campo | Valor |
|-------|-------|
| `subject_type` | `'item_transmutacion'` |
| `subject_id` | `itemId` |
| `alumno_id` | `NULL` (para todos) |
| `event_type` | `'batch_illumination'` |
| `requires_clean_state` | `true` |
| `is_clean_after` | `true` |
| `illumination_amount` | `NULL` o promedio si aplica |
| `origin` | `'admin'` |
| `actor_type` | `'admin'` |
| `actor_id` | ID del admin |
| `request_id` | UUID único |
| `metadata` | `{ lista_id: number, lista_nombre: string, lista_tipo: 'recurrente' | 'una_vez', alumnos_afectados: number }` |

---

### 6. TRANSMUTACIONES LUGARES

#### 6.1. Limpieza Individual

**Legacy Operation:**
- **Archivo:** `src/endpoints/admin-master.js`
- **Función:** `handleMarcarLimpio()` (líneas 2038-2042)
- **Endpoint:** `POST /admin/master/:alumnoId/marcar-limpio`
- **Body:** `{ tipo: 'lugares', aspecto_id: number }`

**Mapeo a Evento:**

| Campo | Valor |
|-------|-------|
| `subject_type` | `'lugar'` |
| `subject_id` | `aspecto_id` (es el lugar_id) |
| `alumno_id` | `alumnoId` |
| `event_type` | `'illumination'` |
| `requires_clean_state` | `true` |
| `is_clean_after` | `true` |
| `illumination_amount` | `NULL` |
| `origin` | `'admin'` o `'student'` |
| `actor_type` | `'admin'` o `'student'` |
| `actor_id` | ID correspondiente |
| `request_id` | UUID único |
| `metadata` | `{ tipo_transmutacion: 'lugares', frecuencia_dias: number, seccion: 'Transmutaciones PDE - Lugares', nombre_lugar: string }` |

**Legacy Operation Global:**
- **Archivo:** `src/services/transmutaciones-lugares.js`
- **Función:** `marcarTodosAlumnosLimpiosPorLugar()` (líneas 389-487)
- **Mapeo:** Similar a 1.2, con `subject_type = 'lugar'` y `event_type = 'batch_illumination'`

---

### 7. TRANSMUTACIONES PROYECTOS

#### 7.1. Limpieza Individual

**Legacy Operation:**
- **Archivo:** `src/endpoints/admin-master.js`
- **Función:** `handleMarcarLimpio()` (líneas 2043-2047)
- **Endpoint:** `POST /admin/master/:alumnoId/marcar-limpio`
- **Body:** `{ tipo: 'proyectos', aspecto_id: number }`

**Mapeo a Evento:**

| Campo | Valor |
|-------|-------|
| `subject_type` | `'proyecto'` |
| `subject_id` | `aspecto_id` (es el proyecto_id) |
| `alumno_id` | `alumnoId` |
| `event_type` | `'illumination'` |
| `requires_clean_state` | `true` |
| `is_clean_after` | `true` |
| `illumination_amount` | `NULL` |
| `origin` | `'admin'` o `'student'` |
| `actor_type` | `'admin'` o `'student'` |
| `actor_id` | ID correspondiente |
| `request_id` | UUID único |
| `metadata` | `{ tipo_transmutacion: 'proyectos', frecuencia_dias: number, seccion: 'Transmutaciones PDE - Proyectos', nombre_proyecto: string }` |

**Legacy Operation Global:**
- **Archivo:** `src/services/transmutaciones-proyectos.js`
- **Función:** `marcarTodosAlumnosLimpiosPorProyecto()` (líneas 397-495)
- **Mapeo:** Similar a 1.2, con `subject_type = 'proyecto'`

---

### 8. TRANSMUTACIONES APADRINADOS

#### 8.1. Limpieza Individual

**Legacy Operation:**
- **Archivo:** `src/endpoints/admin-master.js`
- **Función:** `handleMarcarLimpio()` (líneas 2048-2052)
- **Endpoint:** `POST /admin/master/:alumnoId/marcar-limpio`
- **Body:** `{ tipo: 'apadrinados', aspecto_id: number }`

**Mapeo a Evento:**

| Campo | Valor |
|-------|-------|
| `subject_type` | `'apadrinado'` |
| `subject_id` | `aspecto_id` (es el apadrinado_id) |
| `alumno_id` | `alumnoId` |
| `event_type` | `'illumination'` |
| `requires_clean_state` | `true` |
| `is_clean_after` | `true` |
| `illumination_amount` | `NULL` |
| `origin` | `'admin'` o `'student'` |
| `actor_type` | `'admin'` o `'student'` |
| `actor_id` | ID correspondiente |
| `request_id` | UUID único |
| `metadata` | `{ tipo_transmutacion: 'apadrinados', frecuencia_dias: number | null, seccion: 'Transmutaciones PDE - Apadrinados', nombre_apadrinado: string, padrino_id: number | null }` |

**Legacy Operation Global:**
- **Archivo:** `src/services/transmutaciones-apadrinados.js`
- **Función:** `marcarTodosAlumnosLimpiosPorApadrinado()` (si existe)
- **Mapeo:** Similar a 1.2, con `subject_type = 'apadrinado'`

---

## 🔍 ENDPOINTS Y HANDLERS

### Endpoints Admin

| Endpoint | Handler | Archivo | Función |
|----------|---------|---------|---------|
| `POST /admin/master/:alumnoId/marcar-limpio` | `handleMarcarLimpio()` | `admin-master.js:1935` | Maneja TODOS los tipos (anatomia, karmicos, indeseables, lugares, proyectos, apadrinados, limpieza_hogar, transmutacion_X) |
| `POST /limpieza/master/individual` | `limpiarAspectoIndividual()` | `limpieza-master.js:11` | Limpieza individual (legacy alternativo) |
| `POST /limpieza/master/global` | `limpiarAspectoGlobal()` | `limpieza-master.js:151` | Limpieza global (legacy alternativo) |

### Endpoints Portal Alumno

| Endpoint | Handler | Archivo | Función |
|----------|---------|---------|---------|
| `POST /limpieza/marcar` | `handleMarcarLimpio()` | `limpieza-handler.js:358` | Solo para items_transmutaciones (nuevo sistema) |
| `POST /transmutaciones/limpiar` | Handler en `transmutaciones-cliente.js` | `transmutaciones-cliente.js:110` | Limpieza de transmutaciones (alternativo) |

---

## ⚠️ INCONSISTENCIAS IDENTIFICADAS

### 1. Nomenclatura de Estados Inconsistente

**Problema:**
- Aspectos energéticos usan: `'al_dia'`, `'pendiente'`, `'muy_pendiente'`
- Aspectos kármicos/indeseables usan: `'limpio'`, `'pendiente'`
- Transmutaciones usan: `'limpio'`, `'pendiente'`, `'pasado'`
- Limpieza hogar usa: `'limpio'`

**Impacto en Eventos:**
- El evento debe normalizar esto. Usar `is_clean_after = true` para todos los casos donde se marca como limpio, independientemente de la nomenclatura legacy.

**Recomendación:**
- Crear función helper que mapee estados legacy a `is_clean_after`:
  - `'al_dia'` → `true`
  - `'limpio'` → `true`
  - `'pendiente'` → `false`
  - `'muy_pendiente'` → `false`
  - `'pasado'` → `false`

---

### 2. Items Transmutaciones Sin Historial

**Problema:**
- `items_transmutaciones_alumnos` no tiene tabla de historial separada
- Solo se actualiza `ultima_limpieza` y `veces_completadas`
- No hay registro histórico de cuándo se limpió cada vez

**Impacto en Eventos:**
- Cada llamada a `limpiarItemParaAlumno()` debe generar un evento
- El evento es la única fuente de verdad histórica

**Recomendación:**
- Generar evento en cada limpieza, incluso si es recurrente
- El evento debe capturar el snapshot de `veces_completadas` en ese momento

---

### 3. Alumno Limpia Sin Historial

**Problema:**
- Cuando un alumno limpia desde el portal, no siempre se registra en `limpiezas_master_historial`
- Solo se registra si la tabla existe (try-catch con fallback silencioso)

**Impacto en Eventos:**
- Los eventos deben ser OBLIGATORIOS, no opcionales
- No debe haber fallback silencioso

**Recomendación:**
- El evento debe crearse ANTES de actualizar el estado legacy
- Si falla el evento, fallar toda la operación (fail-fast)

---

### 4. Estados Calculados vs Almacenados

**Problema:**
- Algunas tablas almacenan `estado` (ej: `aspectos_energeticos_alumnos.estado`)
- Otras calculan el estado on-demand (ej: transmutaciones)
- Inconsistencia entre almacenar vs calcular

**Impacto en Eventos:**
- El evento debe capturar el estado ANTES y DESPUÉS si es posible
- O al menos capturar el estado DESPUÉS en `is_clean_after`

**Recomendación:**
- Agregar a metadata: `estado_anterior` y `estado_nuevo` cuando sea posible
- Para estados calculados, calcular antes de crear el evento

---

### 5. Frecuencia Días Variable

**Problema:**
- `frecuencia_dias` puede cambiar en el aspecto base
- Si cambia, el historial legacy no refleja qué frecuencia tenía cuando se limpió

**Impacto en Eventos:**
- El evento debe capturar el snapshot de `frecuencia_dias` en el momento de la limpieza

**Recomendación:**
- Incluir `frecuencia_dias` en metadata del evento (snapshot del momento)

---

### 6. Operaciones Batch Sin Trazabilidad Individual

**Problema:**
- `marcarTodosAlumnosLimpiosPorAspecto()` crea un registro en historial con `alumno_id = NULL`
- No hay eventos individuales para cada alumno afectado

**Impacto en Eventos:**
- Necesitamos dos estrategias:
  1. Evento batch con `alumno_id = NULL` + lista de alumnos en metadata
  2. Eventos individuales para cada alumno (más granular)

**Recomendación:**
- Crear evento batch PRIMERO (con `alumno_id = NULL`)
- Luego crear eventos individuales para cada alumno (referenciando el batch en metadata)
- O usar solo eventos individuales (más simple, más eventos)

---

## 📝 RECOMENDACIONES DE METADATA

### Metadata Mínimo Recomendado por Tipo

#### Para Aspectos Energéticos (Anatomía)

```json
{
  "tipo_aspecto": "anatomia",
  "seccion_id": 1,
  "seccion_nombre": "Chakras",
  "frecuencia_dias": 14,
  "tipo_limpieza": "regular",
  "estado_anterior": "pendiente",
  "estado_nuevo": "al_dia",
  "dias_desde_ultima_limpieza": 15,
  "veces_limpiado_total": 5
}
```

#### Para Aspectos de Una Vez

```json
{
  "tipo_aspecto": "anatomia",
  "tipo_limpieza": "una_vez",
  "cantidad_completada": 3,
  "cantidad_requerida": 5,
  "completado_permanentemente": false,
  "veces_limpiado_total": 3
}
```

#### Para Items Transmutaciones

```json
{
  "lista_id": 1,
  "lista_nombre": "Limpieza de Energías",
  "lista_tipo": "recurrente",
  "frecuencia_dias": 20,
  "nivel": 9,
  "prioridad": "alta",
  "veces_completadas": 1,
  "dias_desde_ultima_limpieza": null
}
```

#### Para Transmutaciones (Lugares, Proyectos, Apadrinados)

```json
{
  "tipo_transmutacion": "lugares",
  "frecuencia_dias": 30,
  "seccion": "Transmutaciones PDE - Lugares",
  "nombre_lugar": "Casa",
  "nivel_minimo": 1
}
```

#### Para Operaciones Batch

```json
{
  "tipo_operacion": "batch_cleaning",
  "tipo_aspecto": "anatomia",
  "alumnos_afectados": 150,
  "frecuencia_dias": 14,
  "seccion": "Anatomía Energética"
}
```

---

## 🔗 CORRELACIÓN CON AUDIT_EVENTS

**Problema Actual:**
- `audit_events` registra acciones del admin (línea 2216-2237 en `admin-master.js`)
- `limpiezas_master_historial` registra limpiezas (opcional)
- No hay correlación directa

**Recomendación:**
- Usar el mismo `request_id` para:
  - `audit_events` (si es admin)
  - `energy_events` (siempre)
  - `limpiezas_master_historial` (legacy, mientras exista)

Esto permite correlacionar:
```sql
SELECT * FROM energy_events ee
JOIN audit_events ae ON ee.request_id = ae.request_id
WHERE ee.subject_id = 123;
```

---

## 📊 TABLA RESUMEN DE MAPEO

| Legacy Operation | subject_type | event_type | origin | requires_clean_state | is_clean_after |
|------------------|--------------|------------|--------|---------------------|----------------|
| `handleMarcarLimpio(anatomia)` | `aspecto` | `cleaning` o `cleaning_completed` | `admin`/`student` | `true` | `true` |
| `handleMarcarLimpio(karmicos)` | `karmico` | `cleaning` | `admin`/`student` | `true` | `true` |
| `handleMarcarLimpio(indeseables)` | `indeseable` | `cleaning` | `admin`/`student` | `true` | `true` |
| `handleMarcarLimpio(limpieza_hogar)` | `hogar` | `cleaning` | `admin`/`student` | `true` | `true` |
| `handleMarcarLimpio(lugares)` | `lugar` | `illumination` | `admin`/`student` | `true` | `true` |
| `handleMarcarLimpio(proyectos)` | `proyecto` | `illumination` | `admin`/`student` | `true` | `true` |
| `handleMarcarLimpio(apadrinados)` | `apadrinado` | `illumination` | `admin`/`student` | `true` | `true` |
| `handleMarcarLimpio(transmutacion_X)` | `item_transmutacion` | `illumination` o `illumination_completed` | `admin`/`student` | `true` | `true` |
| `limpiarItemParaAlumno()` | `item_transmutacion` | `illumination` o `illumination_completed` | `student` | `true` | `true` |
| `marcarTodosAlumnosLimpiosPorAspecto()` | `aspecto` | `batch_cleaning` | `admin` | `true` | `true` |
| `limpiarItemParaTodos()` | `item_transmutacion` | `batch_illumination` | `admin` | `true` | `true` |

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

- [ ] Crear función helper para normalizar estados legacy → `is_clean_after`
- [ ] Crear función helper para generar `request_id` (UUID)
- [ ] Crear función helper para extraer metadata según `subject_type`
- [ ] Modificar `handleMarcarLimpio()` para crear evento ANTES de actualizar estado
- [ ] Modificar `limpiarItemParaAlumno()` para crear evento
- [ ] Modificar todas las funciones `marcarTodosAlumnosLimpios*` para crear eventos batch
- [ ] Agregar validación: si falla creación de evento, fallar toda la operación
- [ ] Correlacionar `request_id` con `audit_events` cuando aplique
- [ ] Documentar cómo calcular estado desde eventos (para queries futuras)

---

## 🎯 PRÓXIMOS PASOS

1. **Fase 1:** Implementar creación de eventos en paralelo con operaciones legacy (dual-write)
2. **Fase 2:** Validar que eventos se crean correctamente para todas las operaciones
3. **Fase 3:** Crear queries que calculen estado desde eventos (read-side)
4. **Fase 4:** Migrar lecturas a usar eventos (eventual consistency)
5. **Fase 5:** Eliminar actualizaciones directas de estado (solo eventos)

---

**FIN DEL DOCUMENTO**







