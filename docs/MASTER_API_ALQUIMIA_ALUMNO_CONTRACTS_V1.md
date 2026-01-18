# MASTER API ALQUIMIA ALUMNO CONTRACTS v1 - Documentación Canónica
**Versión:** v1.0  
**Fecha:** 2026-01-08  
**Estado:** ✅ Implementado

---

## 1. DEFINICIÓN

Contratos canónicos de los endpoints API MASTER para el Panel Alquimia del Alumno.

**Reglas constitucionales:**
- Todas las rutas registradas en `master-route-registry.js` con `type='api'`
- Todas las rutas mapeadas en `MASTER_HANDLER_MAP`
- Respuestas JSON siempre: `{ ok, data|error, trace_id }` incluso en 500
- Anti-cache headers obligatorios
- `trace_id` siempre presente

---

## 2. ENDPOINT: GET /master/api/students

**Propósito:** Listar alumnos para selector (reutilizado)

**Registro:**
- Key: `master-api-students`
- Path: `/master/api/students`
- Type: `api`
- Method: `GET`

**Handler:** `src/endpoints/master-api-students.js` → `listStudentsHandler`

**Query Parameters:**
- `limit` (opcional, default: 50, max: 200)
- `offset` (opcional, default: 0)
- `search` (opcional) - Búsqueda por email o apodo
- `include_columns` (opcional, default: false) - Incluir metadata de columnas

**Respuesta Exitosa (200):**
```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "id": 123,
        "student_id": 123,
        "email": "alumno@example.com",
        "name": "Nombre del Alumno",
        "apodo": "Apodo",
        "nombre_completo": "Nombre Completo"
      }
    ],
    "total": 150,
    "limit": 50,
    "offset": 0
  },
  "trace_id": "req_..."
}
```

**Respuesta Error (400/500):**
```json
{
  "ok": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Mensaje de error"
  },
  "trace_id": "req_..."
}
```

**Headers:**
- `Content-Type: application/json; charset=utf-8`
- `Cache-Control: no-store, no-cache, must-revalidate, max-age=0`
- `Pragma: no-cache`
- `Expires: 0`
- `X-Trace-Id: req_...`

**Fuente de datos:**
- Tabla: `alumnos` (PostgreSQL)
- Repositorio: `getDefaultStudentRepo()`

---

## 3. ENDPOINT: GET /master/api/alquimia-alumno/megalist

**Propósito:** Obtener megalista completa de un alumno

**Registro:**
- Key: `master-api-alquimia-alumno-megalist`
- Path: `/master/api/alquimia-alumno/megalist`
- Type: `api`
- Method: `GET`

**Handler:** `src/endpoints/master-api-alquimia-alumno.js` → handler principal

**Query Parameters:**
- `student_uuid` (requerido) - UUID canónico del alumno (UUID)
- `view_layer` (requerido) - Capa de vista: 'shared' | 'pde' | 'combo' (una_vez) | 'effective' (recurrente)
- `lista_tipo` (requerido) - Tipo de lista: 'recurrente' | 'una_vez'
- `levels_mode` (opcional) - Modo de niveles (por ahora solo aceptado, no usado)
- `level_cap` (opcional) - Cap de nivel (si null, usa nivel_efectivo)

**Respuesta Exitosa (200):**
```json
{
  "ok": true,
  "data": {
    "student": {
      "id": 123,
      "student_id": 123,
      "email": "alumno@example.com",
      "apodo": "Apodo",
      "nombre_completo": "Nombre Completo",
      "nivel_efectivo": 5
    },
    "summary": {
      "total": 50,
      "never": 10,
      "important": 5,
      "pending": 15,
      "reviewed": 20,
      "reviewed_by_student": 8,
      "reviewed_by_master": 12,
      "percent_reviewed": 40
    },
    "lists": [
      {
        "lista_id": 1,
        "lista_nombre": "Lista Principal",
        "lista_tipo": "recurrente",
        "never": [
          {
            "item_id": 1,
            "item_ref": "item_123",
            "item_nombre": "Item Nombre",
            "item_nivel": 3,
            "lista_id": 1,
            "lista_nombre": "Lista Principal",
            "lista_tipo": "recurrente",
            "state": "never",
            "shared_last_cleaned_at": null,
            "shared_clean_count": 0,
            "shared_completed": 0,
            "shared_remaining": null,
            "last_actor": null
          }
        ],
        "important": [],
        "pending": [],
        "reviewed_by_student": [],
        "reviewed_by_master": []
      }
    ],
    "reviewed": {
      "by_student": [
        {
          "lista_id": 1,
          "lista_nombre": "Lista Principal",
          "items": [...]
        }
      ],
      "by_master": [
        {
          "lista_id": 1,
          "lista_nombre": "Lista Principal",
          "items": [...]
        }
      ]
    },
    "warnings": [
      {
        "type": "item_not_found",
        "item_ref": "item_unknown",
        "message": "Item no encontrado en catálogo: item_unknown"
      }
    ],
    "context": {
      "view_layer": "shared",
      "lista_tipo": "recurrente",
      "levels_mode": null,
      "level_cap": 10,
      "level_cap_provided": true
    },
    "seed_metrics": {
      "total_applicable_items": 42,
      "total_items_with_state": 38,
      "missing_state_count": 4,
      "needs_initialize": true,
      "sample_missing_item_refs": ["item_ref_1", "item_ref_2", "item_ref_3"]
    }
  },
  "trace_id": "req_..."
}
```

**Respuesta Error (400/404/500):**
```json
{
  "ok": false,
  "error": {
    "code": "INVALID_STUDENT_ID" | "STUDENT_NOT_FOUND" | "INTERNAL_ERROR",
    "message": "Mensaje de error"
  },
  "trace_id": "req_..."
}
```

**Headers:**
- `Content-Type: application/json; charset=utf-8`
- `Cache-Control: no-store, no-cache, must-revalidate, max-age=0`
- `Pragma: no-cache`
- `Expires: 0`
- `X-Trace-Id: req_...`

**Fuente de datos:**
- Servicio: `getMegalistForStudent()` → `alquimia-alumno-megalist-service.js`
- Métricas: `calculateSeedReadinessMetrics()` → `seed-readiness-metrics-service.js`
- Tablas: `cleaning_item_state`, `cleaning_events`, `items_transmutaciones`, `listas_transmutaciones`

**✅ Megalist es vista de estado efectivo (Sistema cerrado v5.79.7)**
- **Megalist aplica overrides** igual que flotante y list-projection (scope='student')
- **GET /megalist devuelve estado con overrides aplicados** (orden invariante: Estado persistido → Item base → Override → Effective Config → CPM)
- Cualquier campo overrideable (`threshold_days`, `required_count`, `nivel`, `descripcion`) afecta la proyección final
- No existe distinción entre "estado base" y "estado overrideado" en la respuesta (por diseño)
- Overrides NO mutan estado persistido (solo afectan cálculo de estado proyectado)
- Overrides NO bloquean seed/reset/clean (son independientes de WRITE operations)
- **Estado:** Sistema cerrado y alineado en READ pipeline (v5.79.7)
- **Referencia:** `docs/contracts/OVERRIDES_CONTRACT_V1.md` (sección "Cierre operativo del sistema de Overrides")

**⚠️ PREPARACIÓN FUTURA: Metadata de Overrides (NO IMPLEMENTADO)**
- Megalist está preparada para exponer metadatos de override en respuestas futuras
- Estructura preparada: `override_metadata: { has_override, override_keys, override_scope }`
- **Estado:** Solo documentado como preparación, NO implementado todavía, NO obligatorio
- **Referencia:** `docs/contracts/OVERRIDES_CONTRACT_V1.md` (sección "Preparación Futura: Metadata de Overrides")

**Campo `seed_metrics`:**
- **Propósito:** Observabilidad del estado de seed (diagnóstico SIN ejecutar seed)
- **Cuándo aparece:** Siempre presente en respuesta exitosa
- **Interpretación:**
  - `needs_initialize = true` → Faltan items sin estado, ejecutar `POST /master/api/alquimia-alumno/initialize`
  - `needs_initialize = false` → Todos los items aplicables tienen estado
- **Nota forense:** Si faltan items en megalist, consultar `seed_metrics.missing_state_count`
- **Solución operativa:** Ejecutar `POST /master/api/alquimia-alumno/initialize` con `level_cap` correcto
- **Referencia:** `docs/contracts/SEED_CONTRACT_V1.md` (sección "SeedReadinessMetrics v1")

---

## 4. ENDPOINT: POST /master/api/alquimia-alumno/clean

**Propósito:** Limpiar un item específico (SHARED, ítem-por-ítem)

**Registro:**
- Key: `master-api-alquimia-alumno-clean`
- Path: `/master/api/alquimia-alumno/clean`
- Type: `api`
- Method: `POST`

**Handler:** `src/endpoints/master-api-alquimia-alumno.js` → handler principal

**Body (JSON):**
```json
{
  "student_id": 123,
  "item_ref": "item_123",
  "domain_type": "transmutation",
  "product_key": "pde",
  "actor_ref": null,
  "surface_key": null
}
```

**Parámetros forzados internamente:**
- `actor_type='master'` (siempre)
- `clean_layer='shared'` (siempre)
- `surface_key='master.alquimia_alumno'` (si no viene)

**Respuesta Exitosa (200):**
```json
{
  "ok": true,
  "data": {
    "applied": true,
    "state": {
      "student_id": 123,
      "product_key": "pde",
      "domain_type": "transmutation",
      "item_ref": "item_123",
      "shared_last_cleaned_at": "2026-01-08T10:00:00Z",
      "shared_clean_count": 1,
      "shared_completed": 0,
      "shared_remaining": null
    }
  },
  "trace_id": "req_..."
}
```

**Respuesta No Aplicada (200):**
```json
{
  "ok": true,
  "data": {
    "applied": false,
    "reason": "Alumno en pausa o item no aplica"
  },
  "trace_id": "req_..."
}
```

**Respuesta Error (400/500):**
```json
{
  "ok": false,
  "error": {
    "code": "MISSING_PARAMS" | "INTERNAL_ERROR",
    "message": "Mensaje de error"
  },
  "trace_id": "req_..."
}
```

**Headers:**
- `Content-Type: application/json; charset=utf-8`
- `Cache-Control: no-store, no-cache, must-revalidate, max-age=0`
- `Pragma: no-cache`
- `Expires: 0`
- `X-Trace-Id: req_...`

**Fuente de datos:**
- Servicio: `markCleanStudent()` → `cleaning-engine-service.js`
- Tablas: `cleaning_events`, `cleaning_item_state`

---

## 5. ENDPOINT: GET /master/api/alquimia-alumno/item-history

**Propósito:** Obtener historial completo de un item para un alumno

**Registro:**
- Key: `master-api-alquimia-alumno-item-history`
- Path: `/master/api/alquimia-alumno/item-history`
- Type: `api`
- Method: `GET`

**Handler:** `src/endpoints/master-api-alquimia-alumno.js` → handler principal

**Query Parameters:**
- `student_id` (requerido) - ID del alumno
- `domain_type` (opcional, default: 'transmutation')
- `item_ref` (requerido) - Referencia del item
- `limit` (opcional, default: 50, max: 200)

**Respuesta Exitosa (200):**
```json
{
  "ok": true,
  "data": {
    "events": [
      {
        "id": "uuid-...",
        "created_at": "2026-01-08T10:00:00Z",
        "action_type": "mark_clean",
        "clean_layer": "shared",
        "actor_type": "master",
        "actor_ref": null,
        "surface_key": "master.alquimia_alumno",
        "meta": {
          "item_id": 1,
          "lista_id": 1,
          "item_nivel": 3,
          "nivel_efectivo": 5
        }
      }
    ]
  },
  "trace_id": "req_..."
}
```

**Respuesta Error (400/500):**
```json
{
  "ok": false,
  "error": {
    "code": "INVALID_STUDENT_ID" | "MISSING_ITEM_REF" | "INTERNAL_ERROR",
    "message": "Mensaje de error"
  },
  "trace_id": "req_..."
}
```

**Headers:**
- `Content-Type: application/json; charset=utf-8`
- `Cache-Control: no-store, no-cache, must-revalidate, max-age=0`
- `Pragma: no-cache`
- `Expires: 0`
- `X-Trace-Id: req_...`

**Fuente de datos:**
- Repositorio: `getDefaultCleaningEventsRepo()` → `listEventsForStudentItem()`
- Tabla: `cleaning_events` (append-only)

---

## 6. ENDPOINT: GET /master/api/alquimia-alumno/report

**Propósito:** Obtener informe básico por rango de días (sin sesiones)

**Registro:**
- Key: `master-api-alquimia-alumno-report`
- Path: `/master/api/alquimia-alumno/report`
- Type: `api`
- Method: `GET`

**Handler:** `src/endpoints/master-api-alquimia-alumno.js` → handler principal

**Query Parameters:**
- `student_id` (requerido) - ID del alumno
- `days` (opcional, default: 30, max: 365) - Días hacia atrás

**Respuesta Exitosa (200):**
```json
{
  "ok": true,
  "data": {
    "days": 30,
    "since_date": "2025-12-09T10:00:00Z",
    "master_events": [
      {
        "id": "uuid-...",
        "created_at": "2026-01-08T10:00:00Z",
        "item_ref": "item_123",
        "domain_type": "transmutation",
        "action_type": "mark_clean",
        "clean_layer": "shared",
        "actor_type": "master",
        "actor_ref": null,
        "surface_key": "master.alquimia_alumno",
        "meta": {}
      }
    ],
    "student_events": [
      {
        "id": "uuid-...",
        "created_at": "2026-01-07T15:00:00Z",
        "item_ref": "item_456",
        "domain_type": "transmutation",
        "action_type": "mark_clean",
        "clean_layer": "shared",
        "actor_type": "student",
        "actor_ref": null,
        "surface_key": null,
        "meta": {}
      }
    ],
    "total": 25
  },
  "trace_id": "req_..."
}
```

**Respuesta Error (400/500):**
```json
{
  "ok": false,
  "error": {
    "code": "INVALID_STUDENT_ID" | "INTERNAL_ERROR",
    "message": "Mensaje de error"
  },
  "trace_id": "req_..."
}
```

**Headers:**
- `Content-Type: application/json; charset=utf-8`
- `Cache-Control: no-store, no-cache, must-revalidate, max-age=0`
- `Pragma: no-cache`
- `Expires: 0`
- `X-Trace-Id: req_...`

**Fuente de datos:**
- Query directa a `cleaning_events` filtrando por `student_id` y fecha
- Separación por `actor_type` en aplicación

---

## 7. DOBLE REGISTRO OBLIGATORIO

### 7.1. Registry

**Archivo:** `src/core/master/registry/master-route-registry.js`

**Formato:**
```javascript
{
  key: 'master-api-alquimia-alumno-megalist',
  path: '/master/api/alquimia-alumno/megalist',
  type: 'api',
  method: 'GET'
}
```

**Reglas:**
- `type` DEBE ser `'api'` (nunca `'island'`)
- `key` único y canónico
- `path` exacto (con parámetros dinámicos si aplica)

---

### 7.2. Handler Map

**Archivo:** `src/core/master/router/master-router-resolver.js`

**Formato:**
```javascript
'master-api-alquimia-alumno-megalist': () => import('../../../endpoints/master-api-alquimia-alumno.js'),
```

**Reglas:**
- Key debe coincidir con `key` del registry
- Handler debe exportar función por defecto
- Lazy import (no eager)

---

## 8. VERIFICACIÓN

### 8.1. Assembly Check

**Comando (si existe):**
```bash
npm run check:master-api
```

**Verifica:**
- Todas las rutas `/master/api/**` registradas
- Todas las rutas mapeadas en handler map
- Todas las rutas con `type='api'`

---

### 8.2. Smoke Tests

**Comandos curl:**
```bash
# Listar alumnos
curl -i "http://localhost:3000/master/api/students?limit=5"

# Obtener megalista
curl -i "http://localhost:3000/master/api/alquimia-alumno/megalist?student_id=123"

# Limpiar item
curl -i -X POST "http://localhost:3000/master/api/alquimia-alumno/clean" \
  -H "Content-Type: application/json" \
  -d '{"student_id":123,"item_ref":"item_123","domain_type":"transmutation"}'

# Historial
curl -i "http://localhost:3000/master/api/alquimia-alumno/item-history?student_id=123&item_ref=item_123&limit=10"

# Informe
curl -i "http://localhost:3000/master/api/alquimia-alumno/report?student_id=123&days=30"
```

**Verificar:**
- Status 200 OK (o 401 si no autenticado)
- `Content-Type: application/json`
- `trace_id` presente
- Headers anti-cache presentes
- JSON válido (incluso en errores)

---

## 9. AUTENTICACIÓN

**Sistema:** `requireAdminContext()` (mismo que Admin)

**Comportamiento:**
- Si no autenticado: devuelve JSON 401 (no redirect HTML)
- Si autenticado: continúa con handler

**Headers de autenticación:**
- Cookies de sesión (mismo sistema que Admin/MASTER)

---

## 10. ERROR HANDLING

### 10.1. Errores Estructurados

**Formato canónico:**
```json
{
  "ok": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Mensaje legible"
  },
  "trace_id": "req_..."
}
```

**Códigos comunes:**
- `UNAUTHORIZED` - No autenticado
- `INVALID_STUDENT_ID` - student_id inválido
- `MISSING_PARAMS` - Parámetros requeridos faltantes
- `STUDENT_NOT_FOUND` - Alumno no encontrado
- `INTERNAL_ERROR` - Error interno del servidor

---

### 10.2. Logs Estructurados

**Prefijos canónicos:**
- `[MasterAlquimiaAlumno]` - Logs del handler
- `[AlquimiaAlumnoMegalist]` - Logs del servicio

**Campos obligatorios:**
- `traceId` - Trace ID de la request
- `student_id` - ID del alumno (si aplica)
- `item_ref` - Referencia del item (si aplica)
- `error` - Mensaje de error (si aplica)

---

## 11. REFERENCIAS

- **Panel UI:** `docs/MASTER_ALQUIMIA_ALUMNO_PANEL_V1.md`
- **Notas automatización:** `docs/CLEANING_REPORT_AUTOMATION_READY_NOTES_V1.md`
- **Diagnóstico:** `docs/DIAGNOSTICO_REALIDAD_CLEANING_V1.md`
- **Registry:** `src/core/master/registry/master-route-registry.js`
- **Handler Map:** `src/core/master/router/master-router-resolver.js`
- **Handler:** `src/endpoints/master-api-alquimia-alumno.js`
- **Servicio:** `src/core/master/services/alquimia-alumno-megalist-service.js`
- **Servicio métricas:** `src/core/master/services/seed-readiness-metrics-service.js`
- **Script verificación:** `scripts/verify-seed-readiness-metrics.js`

**Nota forense - Si faltan items:**
- Consultar `data.seed_metrics.missing_state_count` en la respuesta
- Si `missing_state_count > 0` → Faltan estados materializados
- Solución: Ejecutar `POST /master/api/alquimia-alumno/initialize` con `level_cap` correcto
- Referencia: `docs/contracts/SEED_CONTRACT_V1.md` (SeedReadinessMetrics v1)

---

**Estado:** ✅ Implementado y documentado
