# CLEANING REPORT AUTOMATION READY NOTES v1
**Versión:** v1.0  
**Fecha:** 2026-01-08  
**Estado:** ✅ Preparado para automatización (concepto de sesión pendiente)

---

## 1. RESUMEN EJECUTIVO

El sistema actual de limpiezas está **preparado para automatización de informes**, pero requiere añadir el concepto de "sesión" para agrupar eventos por sesión de limpieza.

**Estado actual:**
- ✅ SOT completo en `cleaning_events` (append-only)
- ✅ Informe básico v1 por rango de fechas
- ✅ Separación por actor (master vs student)
- ❌ Concepto de "sesión" NO existe todavía

---

## 2. SOURCE OF TRUTH ACTUAL

### 2.1. Tabla `cleaning_events` (SOT Canónico)

**Características:**
- ✅ Append-only (no se modifica ni elimina)
- ✅ Idempotencia garantizada (execution_key)
- ✅ Trazabilidad completa (trace_id, actor, surface_key)
- ✅ Todos los campos necesarios para informes

**Estructura:**
```sql
CREATE TABLE cleaning_events (
  id UUID PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL,
  trace_id TEXT NOT NULL,
  execution_key TEXT NOT NULL,
  student_id INTEGER NOT NULL,
  product_key TEXT NOT NULL DEFAULT 'pde',
  domain_type TEXT NOT NULL,
  item_ref TEXT NOT NULL,
  clean_layer TEXT NOT NULL,
  item_kind TEXT NOT NULL,
  action_type TEXT NOT NULL,
  delta_completed INTEGER NULL,
  set_remaining INTEGER NULL,
  actor_type TEXT NOT NULL,
  actor_ref TEXT NULL,
  surface_key TEXT NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb
);
```

**Lo que SÍ permite:**
- ✅ Listar todos los eventos de un alumno por rango de fechas
- ✅ Filtrar por actor (master/student/automation)
- ✅ Filtrar por item, dominio, capa
- ✅ Agrupar por día (usando `created_at`)
- ✅ Contar eventos por tipo de acción

**Lo que NO permite (sin sesión):**
- ❌ Agrupar eventos por "sesión de limpieza"
- ❌ Identificar qué eventos pertenecen a la misma sesión
- ❌ Generar informe automático "al final de sesión"

---

## 3. INFORME BÁSICO V1 (ACTUAL)

### 3.1. Endpoint Actual

**Ruta:** `GET /master/api/alquimia-alumno/report?student_id=...&days=...`

**Funcionalidad:**
- Filtra eventos por `student_id` y rango de fechas
- Separa por `actor_type` (master vs student)
- Ordena por `created_at DESC`

**Limitaciones:**
- ❌ No agrupa por sesión
- ❌ No identifica "inicio/fin de sesión"
- ❌ Solo proyección por rango de fechas

---

### 3.2. Estructura de Respuesta Actual

```json
{
  "ok": true,
  "data": {
    "days": 30,
    "since_date": "2025-12-09T10:00:00Z",
    "master_events": [...],
    "student_events": [...],
    "total": 25
  }
}
```

**Campos disponibles:**
- `created_at` - Timestamp del evento
- `item_ref` - Item limpiado
- `action_type` - Tipo de acción
- `actor_type` - Quién ejecutó
- `surface_key` - Superficie de origen (ej: 'master.alquimia_alumno')

---

## 4. PREPARACIÓN PARA AUTOMATIZACIÓN

### 4.1. Lo que YA está listo

**SOT completo:**
- ✅ Todos los eventos registrados en `cleaning_events`
- ✅ Trazabilidad completa (trace_id, actor, surface_key)
- ✅ Metadatos disponibles (meta JSONB)

**Separación por actor:**
- ✅ `actor_type` permite distinguir master vs student
- ✅ `surface_key` permite identificar origen (ej: 'master.alquimia_alumno')

**Rango de fechas:**
- ✅ `created_at` permite filtrar por período
- ✅ Query eficiente con índices

---

### 4.2. Lo que FALTA para automatización completa

**Concepto de sesión:**
- ❌ NO existe campo `session_id` en `cleaning_events`
- ❌ NO existe tabla `cleaning_sessions`
- ❌ NO hay forma de agrupar eventos por sesión

**Implicaciones:**
- No se puede generar informe automático "al final de sesión"
- No se puede identificar qué eventos pertenecen a la misma sesión
- No se puede contar "sesiones de limpieza" vs "eventos individuales"

---

## 5. DISEÑO FUTURO: SISTEMA DE SESIONES

### 5.1. Tabla `cleaning_sessions` (Propuesta)

**Estructura propuesta:**
```sql
CREATE TABLE cleaning_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  student_id INTEGER NOT NULL REFERENCES alumnos(id),
  session_type TEXT NOT NULL CHECK (session_type IN ('master', 'student', 'automation')),
  surface_key TEXT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ NULL,
  items_cleaned_count INTEGER NOT NULL DEFAULT 0,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb
);
```

**Propósito:**
- Agrupar eventos por sesión
- Identificar inicio/fin de sesión
- Contar items limpiados por sesión

---

### 5.2. Campo `session_id` en `cleaning_events` (Propuesta)

**Modificación:**
```sql
ALTER TABLE cleaning_events
ADD COLUMN session_id UUID REFERENCES cleaning_sessions(id);
```

**Propósito:**
- Vincular eventos a sesiones
- Permitir agrupación por sesión
- Mantener trazabilidad completa

---

### 5.3. Flujo de Automatización (Propuesta)

**1. Inicio de sesión:**
- Master abre panel → crea `cleaning_sessions` con `started_at`
- `session_id` se almacena en estado de UI

**2. Durante sesión:**
- Cada limpieza incluye `session_id` en `cleaning_events`
- Contador `items_cleaned_count` se incrementa

**3. Fin de sesión:**
- Master cierra panel → actualiza `cleaning_sessions` con `ended_at`
- Genera informe automático de la sesión
- Emite señal `cleaning.session.completed` (si se implementa)

---

## 6. INFORME AUTOMÁTICO POR SESIÓN (FUTURO)

### 6.1. Estructura Propuesta

```json
{
  "ok": true,
  "data": {
    "session": {
      "id": "uuid-...",
      "session_type": "master",
      "surface_key": "master.alquimia_alumno",
      "started_at": "2026-01-08T10:00:00Z",
      "ended_at": "2026-01-08T10:30:00Z",
      "duration_minutes": 30,
      "items_cleaned_count": 15
    },
    "events": [
      {
        "id": "uuid-...",
        "created_at": "2026-01-08T10:05:00Z",
        "item_ref": "item_123",
        "action_type": "mark_clean",
        "clean_layer": "shared"
      }
    ],
    "summary": {
      "total_items": 15,
      "by_list": {
        "lista_1": 5,
        "lista_2": 10
      },
      "by_state": {
        "never": 3,
        "important": 7,
        "pending": 5
      }
    }
  }
}
```

---

### 6.2. Endpoint Propuesto

**Ruta:** `GET /master/api/alquimia-alumno/session/:session_id/report`

**Funcionalidad:**
- Obtiene sesión desde `cleaning_sessions`
- Agrupa eventos por `session_id`
- Calcula resumen de la sesión

---

## 7. SEÑALES PARA AUTOMATIZACIÓN (FUTURO)

### 7.1. Señal Propuesta

**Nombre:** `cleaning.session.completed`

**Payload propuesto:**
```json
{
  "signal": "cleaning.session.completed",
  "scope": "student",
  "student_id": 123,
  "session_id": "uuid-...",
  "session_type": "master",
  "surface_key": "master.alquimia_alumno",
  "items_cleaned_count": 15,
  "started_at": "2026-01-08T10:00:00Z",
  "ended_at": "2026-01-08T10:30:00Z",
  "trace_id": "req_..."
}
```

**Consumidores potenciales:**
- Automatización de informe por email
- Notificación al Master
- Analytics de sesiones

---

## 8. MIGRACIÓN FUTURA

### 8.1. Pasos Requeridos

1. **Crear tabla `cleaning_sessions`:**
   - Migración SQL
   - Índices apropiados
   - Constraints

2. **Añadir `session_id` a `cleaning_events`:**
   - Migración SQL (ALTER TABLE)
   - Índice en `session_id`
   - FK a `cleaning_sessions`

3. **Modificar Cleaning Engine:**
   - Aceptar `session_id` opcional
   - Incluir en eventos si viene

4. **Modificar UI:**
   - Crear sesión al abrir panel
   - Pasar `session_id` en limpiezas
   - Cerrar sesión al cerrar panel

5. **Modificar endpoints:**
   - Añadir `session_id` a respuestas
   - Endpoint de informe por sesión

---

## 9. WORKAROUND ACTUAL (SIN SESIONES)

### 9.1. Agrupación por `surface_key` + `created_at`

**Limitación:**
- `surface_key` puede indicar origen (ej: 'master.alquimia_alumno')
- `created_at` permite agrupar por día/hora
- Pero NO identifica sesiones distintas del mismo día

**Uso:**
- Agrupar eventos por `surface_key` y día
- Asumir que eventos del mismo día y superficie son de la misma "sesión"
- ⚠️ Puede agrupar sesiones distintas si hay múltiples sesiones el mismo día

---

### 9.2. Agrupación por `trace_id`

**Limitación:**
- `trace_id` identifica una request HTTP
- Múltiples limpiezas en la misma request comparten `trace_id`
- Pero NO identifica sesiones que abarcan múltiples requests

**Uso:**
- Agrupar eventos por `trace_id`
- Asumir que eventos con mismo `trace_id` son de la misma "operación"
- ⚠️ No identifica sesiones que abarcan múltiples requests

---

## 10. RECOMENDACIONES

### 10.1. Para Automatización Inmediata

**Usar informe básico v1:**
- Agrupar por día usando `created_at`
- Separar por `actor_type` (master vs student)
- Filtrar por `surface_key` si se quiere identificar origen

**Limitaciones aceptadas:**
- No se puede identificar sesiones distintas del mismo día
- No se puede generar informe "al final de sesión" automáticamente

---

### 10.2. Para Automatización Completa

**Implementar sistema de sesiones:**
1. Crear tabla `cleaning_sessions`
2. Añadir `session_id` a `cleaning_events`
3. Modificar UI para crear/cerrar sesiones
4. Modificar endpoints para incluir `session_id`
5. Implementar informe por sesión
6. Emitir señal `cleaning.session.completed`

---

## 11. REFERENCIAS

- **Diagnóstico:** `docs/DIAGNOSTICO_REALIDAD_CLEANING_V1.md`
- **Panel UI:** `docs/MASTER_ALQUIMIA_ALUMNO_PANEL_V1.md`
- **Contratos API:** `docs/MASTER_API_ALQUIMIA_ALUMNO_CONTRACTS_V1.md`
- **Cleaning Engine:** `docs/master/MASTER_CLEANING_ENGINE_V1.md`
- **Tabla SOT:** `database/migrations/v5.59.0-cleaning-engine-v1.sql`

---

**Estado:** ✅ Preparado para automatización (concepto de sesión pendiente)

**Próximos pasos:** Implementar sistema de sesiones cuando se requiera automatización completa
