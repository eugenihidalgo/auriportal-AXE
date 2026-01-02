# MODO MASTER: GOBIERNO DEL ALUMNO v1
## Documento de Modo Master y Gobierno del Alumno

**Versión**: 1.0.0  
**Fecha**: 2025-01-XX  
**Estado**: VIGENTE  
**Alcance**: Sistema de gobierno del alumno desde Admin

---

## 1. QUÉ ES "MODO MASTER"

### 1.1 Definición

El **Modo Master** es la capacidad del administrador (Master) de:

- **Inspeccionar** el universo completo del alumno
- **Modificar** estados, políticas y overrides
- **Auditar** cambios y decisiones
- **Gobernar** límites y activaciones

### 1.2 Principio Fundamental

El Master tiene **autoridad absoluta** sobre el alumno:

- Puede activar/desactivar ítems sin límites
- Puede establecer overrides de políticas
- Puede limpiar masivamente
- Puede modificar recurrencias
- Todo queda auditado

---

## 2. VISTAS REQUERIDAS

### 2.1 Vista Resumen

**Ruta**: `/admin/students/:id`

Muestra:
- Identidad del alumno (email, nombre, apodo)
- Estado global (suscripción, nivel, racha)
- Product memberships (PDE ahora, futuro multi-producto)
- Resumen por dominio (cantidad de activos, pendientes de limpieza)

### 2.2 Vista Dominios

**Ruta**: `/admin/students/:id/domains/:domain_key`

Muestra:
- Lista de ítems del dominio
- Estado de cada ítem (activo, limpio, contadores)
- Política del dominio (límites, overrides)
- Acciones disponibles (activar, limpiar, cambiar recurrencia)

### 2.3 Vista Auditoría

**Ruta**: `/admin/students/:id/audit`

Muestra:
- Historial completo de cambios
- Filtros por dominio, acción, actor
- Correlación por trace_id
- Exportación (futuro)

### 2.4 Vista Overrides

**Ruta**: `/admin/students/:id/overrides`

Muestra:
- Políticas por dominio
- Overrides activos
- Historial de cambios de políticas
- Capacidad de crear/modificar overrides

---

## 3. ENDPOINTS ADMIN REQUERIDOS

### 3.1 Listado de Alumnos

```
GET /admin/api/students
```

**Query params**:
- `page`: Página (default: 1)
- `per_page`: Items por página (default: 20)
- `search`: Búsqueda por email/nombre
- `status`: Filtrar por estado de suscripción

**Respuesta**:
```json
{
  "success": true,
  "data": [
    {
      "id": 123,
      "email": "alumno@example.com",
      "display_name": "Nombre Alumno",
      "estado_suscripcion": "activa",
      "nivel_actual": 5,
      "streak": 10
    }
  ],
  "meta": {
    "total": 100,
    "page": 1,
    "per_page": 20
  }
}
```

### 3.2 Detalle de Alumno

```
GET /admin/api/students/:id
```

**Respuesta**:
```json
{
  "success": true,
  "data": {
    "id": 123,
    "email": "alumno@example.com",
    "display_name": "Nombre Alumno",
    "apodo": "Apodo",
    "estado_suscripcion": "activa",
    "nivel_actual": 5,
    "streak": 10,
    "fecha_inscripcion": "2024-01-01T00:00:00Z",
    "product_memberships": [
      {
        "product_key": "pde",
        "status": "active",
        "joined_at": "2024-01-01T00:00:00Z"
      }
    ],
    "domain_summary": {
      "transmutaciones_energeticas": {
        "active_count": 1,
        "pending_clean": 3
      },
      "proyectos": {
        "active_count": 2,
        "pending_clean": 1
      }
    }
  }
}
```

### 3.3 Ítems por Dominio

```
GET /admin/api/students/:id/domains/:domain_key/items
```

**Query params**:
- `is_active`: Filtrar solo activos
- `is_clean`: Filtrar solo limpios/no limpios

**Respuesta**:
```json
{
  "success": true,
  "data": [
    {
      "item_id": 456,
      "item_name": "Nombre del ítem",
      "is_active": true,
      "is_clean": false,
      "clean_count": 5,
      "last_cleaned_at": "2025-01-15T10:00:00Z",
      "recommended_recurrence_days": 30,
      "student_recurrence_days": 45
    }
  ]
}
```

### 3.4 Limpiar Ítem

```
POST /admin/api/students/:id/domains/:domain_key/items/:item_id/clean
```

**Body** (opcional):
```json
{
  "reason": "Limpieza manual del Master"
}
```

**Respuesta**:
```json
{
  "success": true,
  "data": {
    "item_id": 456,
    "is_clean": true,
    "clean_count": 6,
    "last_cleaned_at": "2025-01-20T10:00:00Z"
  },
  "trace_id": "..."
}
```

### 3.5 Limpieza Masiva

```
POST /admin/api/students/:id/domains/:domain_key/items/bulk-clean
```

**Body**:
```json
{
  "item_ids": [456, 789, 101],
  "reason": "Limpieza masiva programada"
}
```

O limpiar todos los activos:
```json
{
  "allActive": true,
  "reason": "Limpieza masiva de todos los activos"
}
```

### 3.6 Establecer Política

```
PATCH /admin/api/students/:id/domains/:domain_key/policy
```

**Body**:
```json
{
  "active_limit_override": 5,
  "reason": "Permitir múltiples proyectos activos"
}
```

**Respuesta**:
```json
{
  "success": true,
  "data": {
    "domain_key": "proyectos",
    "active_limit_default": 1,
    "active_limit_override": 5,
    "can_activate_multiple": true,
    "set_by": "master",
    "reason": "Permitir múltiples proyectos activos"
  }
}
```

### 3.7 Establecer Recurrencia

```
PATCH /admin/api/students/:id/domains/:domain_key/items/:item_id/recurrence
```

**Body**:
```json
{
  "days": 45,
  "reason": "Ajuste de recurrencia personalizada"
}
```

---

## 4. UI ADMIN REQUERIDA

### 4.1 Pantalla Principal

**Ruta**: `/admin/students/:id`

**Componentes**:
- Header con identidad del alumno
- Tabs por dominio (transmutaciones, proyectos, lugares, apadrinados)
- Resumen de estado global
- Acciones rápidas (limpiar masivo, establecer política)

### 4.2 Tabla por Dominio

**Componentes**:
- Lista de ítems con estado
- Filtros (activos, pendientes de limpieza)
- Acciones por ítem (activar, limpiar, cambiar recurrencia)
- Indicadores visuales (limpio/no limpio, activo/inactivo)

### 4.3 Formulario de Política

**Componentes**:
- Input para `active_limit_override`
- Campo de razón (reason)
- Preview del efecto (ej: "Permitirá 5 ítems activos")
- Botón de guardar

### 4.4 Vista de Auditoría

**Componentes**:
- Tabla de eventos
- Filtros (dominio, acción, actor, fecha)
- Detalles expandibles (before/after)
- Búsqueda por trace_id

---

## 5. SEGURIDAD Y PERMISOS

### 5.1 Autenticación

Todas las rutas `/admin/api/*` requieren:
- Autenticación de Master
- Verificación de permisos `admin:write`

### 5.2 Validación

- Validar que el alumno existe
- Validar que el dominio es válido
- Validar que el ítem existe en el catálogo
- Validar límites antes de activar (si actor = student)

### 5.3 Auditoría Obligatoria

Todas las acciones del Master deben:
- Registrar en `student_item_state_audit`
- Incluir `trace_id`
- Incluir `reason` (opcional pero recomendado)
- Incluir `before` y `after` (snapshot completo)

---

## 6. OBSERVABILIDAD

### 6.1 Logs Estructurados

Todos los endpoints deben loguear:
- `trace_id`
- `student_id`
- `domain_key`
- `item_id` (si aplica)
- `action`
- `actor` (siempre 'master' para estas rutas)

### 6.2 Señales

Si hay señales registradas para cambios de estado, emitirlas:
- Solo si están registradas en el Registry
- Con trace_id para correlación
- Con metadata completa

---

## 7. REFERENCIAS

- `docs/SOT_STUDENT_V1.md`: Documento constitucional del Alumno SOT
- `docs/STUDENT_DOMAIN_STATE_V1.md`: Modelo de estado por dominio
- `docs/ADMIN_UI_CONTRACT_V1.md`: Contrato canónico de UI Admin

---

## 8. NOTAS DE IMPLEMENTACIÓN

### 8.1 Stub Inicial

Para v1, la UI puede ser un **stub mínimo**:
- Lista básica de ítems
- Acciones básicas (activar, limpiar)
- Sin diseño final (solo funcional)

### 8.2 Migración Gradual

- Empezar con pantalla en `status='draft'` en UI Admin Registry
- Validar con Assembly Check
- Activar cuando pase validación
- Mejorar UX gradualmente

---

**Fin del Documento de Modo Master v1**


