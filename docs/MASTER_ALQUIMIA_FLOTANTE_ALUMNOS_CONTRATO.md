# Master Alquimia Flotante Alumnos - Contrato

**Fecha:** 2026-01-09  
**Versión:** 1.0.0  
**Dominio:** MASTER

---

## Descripción

Contrato canónico para el flotante "VER" de alumnos en Alquimia General. Define de dónde salen los alumnos, qué campos incluyen, y por qué NO se filtran por nivel.

---

## Endpoint

**URL:** `GET /master/api/alquimia-general/items/:item_ref/students`

**Query Params:**
- `clean_layer` (opcional, default: `'shared'`): `'shared'` | `'pde'`
- `product_key` (opcional, default: `'pde'`): Clave del producto
- `limit` (opcional): Límite de resultados
- `offset` (opcional, default: `0`): Offset de paginación

**Ejemplo:**
```
GET /master/api/alquimia-general/items/item-ref-123/students?clean_layer=shared
```

---

## Respuesta

**Contrato JSON:**
```json
{
  "ok": true,
  "data": {
    "item_ref": "item-ref-123",
    "tipo": "recurrente",
    "students": [
      {
        "student_id": 4,
        "nombre": "Juan Pérez",
        "email": "juan@example.com",
        "nivel_efectivo": 3,
        "item_nivel": 2,
        "estado": "pending",
        "last_cleaned_at": "2026-01-08T10:00:00Z",
        "days_since": 5
      }
    ],
    "counts": {
      "reviewed": 10,
      "pending": 5,
      "important": 2,
      "never": 3
    },
    "total": 20,
    "threshold_days": 7,
    "critical_multiplier": 2.0
  },
  "warnings": [],
  "trace_id": "trace-123"
}
```

---

## Regla Constitucional: NO Filtrar por Nivel

### Requisito Canónico

**"En flotantes NO se filtra por nivel. Deben salir TODOS los alumnos siempre."**

### Justificación

El Master necesita poder limpiar cualquier item a cualquier alumno, incluso si el item es de nivel superior al nivel efectivo del alumno. Esto permite:

1. **Flexibilidad operativa**: Limpiar items avanzados a alumnos que aún no los tienen disponibles
2. **Gestión proactiva**: Preparar alumnos para niveles futuros
3. **Override manual**: Ajustar estados cuando sea necesario

### Implementación

**Endpoint:** `src/endpoints/master-api-alquimia-general.js`

```javascript
result = await getStudentsForItem(itemRef, tipo, productKey, { 
  clean_layer: cleanLayer,
  skip_level_filter: true, // REQUERIDO: Master puede limpiar cualquier item a cualquier alumno
  limit,
  offset
});
```

**Servicio:** `src/services/alquimia-general-service.js`

```javascript
// REGLA MASTER: Flotante Master NUNCA filtra alumnos por nivel (bypass si skip_level_filter=true)
const skipLevelFilter = options.skip_level_filter === true; // Para contexto Master

// ...

if (!skipLevelFilter && item.nivel && item.nivel > nivelEfectivo) {
  // No aplica por nivel (solo si NO es Master)
  studentsNoAplica.push({
    ...student,
    nivel_efectivo: nivelEfectivo,
    item_nivel: item.nivel,
    no_aplica: true
  });
  continue;
}
```

---

## Campos del Payload

### Student Object

**Campos mínimos requeridos:**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `student_id` | number | ID del alumno |
| `nombre` | string | Nombre/apodo del alumno |
| `email` | string | Email del alumno |
| `nivel_efectivo` | number | Nivel efectivo del alumno |
| `item_nivel` | number | Nivel requerido del item |

**Campos según tipo:**

#### Recurrente
- `estado`: `'never'` | `'pending'` | `'important'` | `'reviewed'`
- `last_cleaned_at`: ISO timestamp | null
- `days_since`: number | null
- `threshold_days`: number
- `critical_multiplier`: number

#### Una Vez
- `estado`: `'never'` | `'pending'` | `'reviewed'`
- `completed`: number (veces completadas)
- `remaining`: number (veces restantes)
- `required_count`: number (veces requeridas)

---

## Flujo de Datos

1. **Frontend**: `handleVerItem(item, cleanLayer)`
   - Hace `fetch` a `/master/api/alquimia-general/items/:item_ref/students?clean_layer=shared`
   - Normaliza payload con `normalizeStudentsPayload()`
   - Renderiza flotante con `showFlotanteVer(item, normalized)`

2. **Endpoint**: `GET /master/api/alquimia-general/items/:item_ref/students`
   - Obtiene item y lista del catálogo
   - Llama a `getStudentsForItem()` con `skip_level_filter: true`
   - Devuelve JSON canónico con shape estable

3. **Servicio**: `getStudentsForItem()`
   - Obtiene estudiantes desde Cleaning Engine o repositorio
   - **NO filtra por nivel** si `skip_level_filter: true`
   - Calcula estados según `tipo` (recurrente o una_vez)
   - Agrupa por estado (reviewed, pending, important, never)

4. **UI**: Flotante renderizado
   - Muestra TODOS los alumnos
   - Agrupa por estado (secciones colapsables)
   - Botón "Limpiar" en cada alumno
   - Refresh inmediato tras limpieza

---

## Fail-Open

El endpoint **NUNCA** devuelve 500. Siempre devuelve `ok: true` con shape estable:

**Item no encontrado:**
```json
{
  "ok": true,
  "data": {
    "item_ref": "item-ref-123",
    "tipo": null,
    "students": [],
    "counts": { "reviewed": 0, "pending": 0, "important": 0, "never": 0 },
    "total": 0
  },
  "warnings": ["Item no encontrado: item-ref-123"],
  "trace_id": "trace-123"
}
```

---

## Verificación

### Manual
1. Abrir Alquimia General
2. Hacer clic en "VER" en un item de nivel alto (ej: nivel 7)
3. Verificar que aparecen alumnos de nivel bajo (ej: nivel 3)
4. Limpiar alumno de nivel bajo
5. Verificar que se refleja inmediatamente

### Logs
- Buscar `skip_level_filter: true` en logs del endpoint
- Verificar que `studentsNoAplica` está vacío cuando es Master

---

## Referencias

- [Alquimia Cierre Total v5.65.2](./ALQUIMIA_CIERRE_TOTAL_V5_65_2.md)
- Endpoint: `src/endpoints/master-api-alquimia-general.js`
- Servicio: `src/services/alquimia-general-service.js`