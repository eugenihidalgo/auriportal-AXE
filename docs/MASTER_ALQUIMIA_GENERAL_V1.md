# MASTER Alquimia General v1 - Documentación Canónica

## Estado: ✅ OPERATIVO

**Fecha de certificación**: 2025-01-XX  
**Versión**: v1.0  
**Dominio**: MASTER (`/master/api/alquimia-general/*`)

---

## 📋 Resumen Ejecutivo

MASTER Alquimia General es el sistema canónico para gestión de listas e items de transmutaciones energéticas en el dominio MASTER. Opera sobre PostgreSQL como Source of Truth único, sin dependencias de dominios STUDENT.

### Principios Canónicos

1. **PostgreSQL es Source of Truth**: Todas las listas e items residen en PostgreSQL
2. **Fail-Open Obligatorio**: Endpoints GET nunca devuelven 500, degradan a `[]` con warnings
3. **Soft Delete**: Usa `status='archived'` (no DELETE físico)
4. **Aislamiento MASTER**: No importa código de `src/student/**`
5. **Logging Estructurado**: Todos los logs incluyen `trace_id`

---

## 🗄️ Esquema de Base de Datos

### Tabla: `listas_transmutaciones`

**Columnas canónicas**:
- `id` (SERIAL PRIMARY KEY)
- `nombre` (VARCHAR(255) NOT NULL)
- `tipo` (VARCHAR(20) NOT NULL) - 'recurrente' | 'una_vez'
- `descripcion` (TEXT)
- `orden` (INTEGER DEFAULT 0)
- `status` (VARCHAR(20)) - 'active' | 'archived' (canónico)
- `activo` (BOOLEAN) - Legacy, mantenido por compatibilidad
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

**Índices**:
- `idx_listas_transmutaciones_tipo_status_orden` (tipo, status, orden) WHERE status = 'active'

### Tabla: `items_transmutaciones`

**Columnas canónicas**:
- `id` (SERIAL PRIMARY KEY)
- `lista_id` (INTEGER NOT NULL REFERENCES listas_transmutaciones(id))
- `nombre` (VARCHAR(255) NOT NULL)
- `descripcion` (TEXT)
- `nivel` (INTEGER NOT NULL DEFAULT 9)
- `frecuencia_dias` (INTEGER) - Para tipo 'recurrente'
- `veces_limpiar` (INTEGER) - Para tipo 'una_vez'
- `prioridad` (VARCHAR(10)) - 'alta' | 'media' | 'bajo'
- `item_ref` (TEXT NOT NULL UNIQUE) - Formato: 'te_item_<id>' (canónico v5.46.0+)
- `status` (VARCHAR(20)) - 'active' | 'archived'
- `activo` (BOOLEAN) - Legacy
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

**Índices**:
- `idx_items_transmutaciones_lista_status_nivel` (lista_id, status, nivel, created_at) WHERE status = 'active'
- `idx_items_transmutaciones_item_ref` (item_ref)

**LEY ABSOLUTA**: ORDER BY nivel ASC, created_at ASC

### Tabla: `student_item_state`

**Columnas relevantes para Alquimia General**:
- `student_id` (INTEGER NOT NULL)
- `product_key` (TEXT) - Default: 'pde'
- `domain_type` (TEXT) - 'transmutation'
- `item_ref` (TEXT) - Referencia al item (formato: 'te_item_<id>')
- `last_cleaned_at` (TIMESTAMPTZ) - Para tipo 'recurrente'
- `clean_count` (INTEGER) - Para tipo 'recurrente'
- `remaining` (INTEGER NOT NULL DEFAULT 0) - Para tipo 'una_vez' (v5.46.0+)
- `completed` (INTEGER NOT NULL DEFAULT 0) - Para tipo 'una_vez' (v5.46.0+)
- `is_active` (BOOLEAN) - Estado activo (NO usar 'status')
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

**Índices**:
- `idx_student_item_state_item_ref_domain` (item_ref, domain_type, product_key) WHERE is_active = true

---

## 🔌 Endpoints API

### GET `/master/api/alquimia-general/listas`

**Query params**:
- `tipo` (opcional): 'recurrente' | 'una_vez'

**Respuesta exitosa**:
```json
{
  "ok": true,
  "listas": [...],
  "trace_id": "req_..."
}
```

**Degradación fail-open** (error no crítico):
```json
{
  "ok": true,
  "listas": [],
  "warnings": ["Error al cargar listas: ..."],
  "trace_id": "req_..."
}
```

**Códigos**:
- `200`: Éxito o degradación fail-open
- `401`: No autorizado
- `500`: Solo para errores críticos (no debería ocurrir en GET)

### POST `/master/api/alquimia-general/listas`

**Body**:
```json
{
  "nombre": "Nombre de la lista",
  "tipo": "recurrente" | "una_vez",
  "descripcion": "Descripción opcional",
  "orden": 0
}
```

**Respuesta**:
- `201`: Lista creada
- `400`: Error de validación
- `401`: No autorizado
- `500`: Error interno

### GET `/master/api/alquimia-general/listas/:id`

Obtiene una lista por ID.

### PUT `/master/api/alquimia-general/listas/:id`

Actualiza metadata de una lista.

### DELETE `/master/api/alquimia-general/listas/:id`

Soft delete (archiva): `status='archived'`

---

## 🔧 Migraciones Aplicadas

### v5.34.0: Transmutaciones Energéticas SOT Canónico
- Añade columna `status` (VARCHAR) a `listas_transmutaciones` e `items_transmutaciones`
- Migra datos de `activo` (boolean) → `status` (VARCHAR)
- Crea triggers para `updated_at`

### v5.35.0: Transmutaciones Energéticas Student State
- Crea tablas `student_te_recurrent_state` y `student_te_one_time_state`
- (Nota: MASTER usa `student_item_state` directamente, no estas tablas)

### v5.46.0: Master Alquimia General
- Añade `item_ref` a `items_transmutaciones` (formato: 'te_item_<id>')
- Añade `remaining` y `completed` a `student_item_state` (para tipo 'una_vez')
- Crea índices de rendimiento
- Backfill determinista de `item_ref`

---

## 📝 Logging Estructurado

Todos los logs incluyen:
- `trace_id`: Identificador único de request
- `method`: Método HTTP
- `path`: Ruta solicitada
- `error.message`: Mensaje de error
- `error.code`: Código de error PostgreSQL (si aplica)
- `error.stack`: Stack trace (solo en errores)

**Prefijos canónicos**:
- `[MasterApiAlquimiaGeneral]`: Handler de endpoints
- `[AlquimiaGeneralService]`: Servicio de negocio
- `[AlquimiaCatalogRepo]`: Repositorio PostgreSQL

---

## 🚨 Degradación Fail-Open

**Regla absoluta**: GET `/master/api/alquimia-general/listas` NUNCA debe devolver 500.

**Implementación**:
```javascript
if (path === '/master/api/alquimia-general/listas' && method === 'GET') {
  try {
    // ... lógica normal
  } catch (error) {
    // Degradación fail-open
    return jsonSuccess({ 
      listas: [],
      warnings: [`Error al cargar listas: ${error.message}`]
    }, traceId);
  }
}
```

**Logs**: Error se registra con nivel ERROR pero respuesta es 200 con `[]`.

---

## 🔄 Script de Migración Legacy

**Ubicación**: `scripts/migrate-legacy-alquimia-general.js`

**Uso**:
```bash
# Dry-run (por defecto)
node scripts/migrate-legacy-alquimia-general.js

# Aplicar cambios
node scripts/migrate-legacy-alquimia-general.js --apply
```

**Características**:
- Idempotente (puede ejecutarse múltiples veces)
- No duplica: upsert por `nombre` (clave estable)
- Logs detallados por lote
- Resumen final (creadas, actualizadas, saltadas)

---

## ✅ Checklist de Verificación

- [x] Tablas existen en PostgreSQL
- [x] Columnas canónicas presentes (`status`, `item_ref`, `remaining`, `completed`)
- [x] Migraciones v5.34.0, v5.35.0, v5.46.0 aplicadas
- [x] Logging estructurado con `trace_id` implementado
- [x] Degradación fail-open implementada en GET `/listas`
- [x] Script de migración legacy creado
- [x] Endpoints devuelven JSON válido
- [x] Sin dependencias de `src/student/**`

---

## 🔍 Troubleshooting

### Error: "column status does not exist"
**Solución**: Aplicar migración v5.34.0:
```bash
# Verificar que la migración se ejecutó
pm2 logs aurelinportal | grep "v5.34.0"
```

### Error: "column item_ref does not exist"
**Solución**: Aplicar migración v5.46.0:
```bash
# Verificar que la migración se ejecutó
pm2 logs aurelinportal | grep "v5.46.0"
```

### Endpoint devuelve 500
**Verificar**:
1. Logs con `trace_id` del request
2. Verificar que las tablas existen: `node scripts/check-alquimia-tables.js`
3. Verificar que las migraciones se aplicaron

### Endpoint devuelve 401
**Normal**: Requiere autenticación de admin. Verificar sesión en `/admin/login`.

---

## 📚 Referencias

- **Migraciones**: `database/migrations/v5.34.0-*.sql`, `v5.35.0-*.sql`, `v5.46.0-*.sql`
- **Handler**: `src/endpoints/master-api-alquimia-general.js`
- **Servicio**: `src/services/alquimia-general-service.js`
- **Repositorio**: `src/infra/repos/alquimia-catalog-repo-pg.js`
- **Script verificación**: `scripts/check-alquimia-tables.js`
- **Script migración**: `scripts/migrate-legacy-alquimia-general.js`

---

**Última actualización**: 2025-01-XX  
**Mantenido por**: Sistema MASTER v1
