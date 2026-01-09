# Master Alquimia del Alumno Contracts v2

**Versión**: 2.0.0  
**Fecha**: 2025-01-27  
**Scope**: MASTER  
**Estado**: CANÓNICO

## Contratos de Endpoints

### GET /master/api/alquimia-alumno/megalist

Obtiene la megalist completa para un alumno.

**Query Params**:
- `student_id` (required): ID del alumno
- `levels_mode` (optional): Modo de niveles
- `level_cap` (optional): Cap de nivel (si null, usa nivel_efectivo)

**Seed Automático**: Ejecuta seed de estados "NUNCA" antes de construir respuesta.

**Respuesta**:
```json
{
  "ok": true,
  "data": {
    "student": {
      "id": 4,
      "student_id": 4,
      "email": "...",
      "nivel_efectivo": 3,
      "level_cap": 3
    },
    "summary": {
      "total": 100,
      "never": 50,
      "important": 10,
      "pending": 30,
      "reviewed": 10,
      "percent_reviewed": 10,
      "reviewed_by_student": 5,
      "reviewed_by_master": 5
    },
    "lists": [
      {
        "lista_id": 1,
        "lista_nombre": "Lista ejemplo",
        "lista_tipo": "recurrente",
        "never": [...],
        "important": [...],
        "pending": [...],
        "reviewed_by_student": [...],
        "reviewed_by_master": [...]
      }
    ],
    "warnings": [...]
  },
  "trace_id": "..."
}
```

### POST /master/api/alquimia-alumno/clean

Limpia un item para un alumno.

**Body**:
```json
{
  "student_id": 4,
  "item_ref": "te_item_123",
  "product_key": "pde",
  "domain_type": "transmutation",
  "actor_ref": null,
  "surface_key": "master.alquimia_alumno",
  "level_cap": null
}
```

**Validaciones**:
- `student_id` válido
- `item_ref` válido y aplicable (existe en catálogo y nivel <= nivel_efectivo)
- Estado existe (seed si falta)

**Respuesta**:
```json
{
  "ok": true,
  "data": {
    "applied": true,
    "state": {
      "shared_last_cleaned_at": "...",
      "shared_clean_count": 1,
      ...
    }
  },
  "trace_id": "..."
}
```

**Códigos de Error**:
- `400 STATE_NOT_FOUND`: Estado no encontrado
- `400 ITEM_NOT_APPLICABLE`: Item no aplicable (nivel > nivel_efectivo)
- `404 ITEM_NOT_FOUND`: Item no encontrado en catálogo
- `409 DUPLICATE_EXECUTION`: Ejecución duplicada (execution_key)

### GET /master/api/alquimia-alumno/item-history

Obtiene historial de un item (dos paneles: técnico + humano).

**Query Params**:
- `student_id` (required): ID del alumno
- `item_ref` (required): Referencia del item
- `domain_type` (optional, default: 'transmutation')
- `limit` (optional, default: 50, max: 200)

**Respuesta**:
```json
{
  "ok": true,
  "data": {
    "technical_panel": {
      "visible": false,
      "events": [
        {
          "id": "...",
          "created_at": "...",
          "item_ref": "...",
          "action_type": "mark_clean",
          "clean_layer": "shared",
          "actor_type": "master",
          "execution_key": "...",
          "meta": {}
        }
      ]
    },
    "human_panel": {
      "item": {
        "item_ref": "...",
        "item_nombre": "Nombre legible",
        "lista_id": 1,
        "lista_nombre": "Lista legible",
        "descripcion": "...",
        "nivel": 2,
        "clasificaciones": {
          "category": "Categoría",
          "subcategory": "Subcategoría",
          "tags": ["tag1", "tag2"]
        }
      },
      "events": [
        {
          "id": "...",
          "created_at": "...",
          "item_nombre": "Nombre legible",
          "lista_nombre": "Lista legible",
          "action_type": "mark_clean",
          "actor_type": "master",
          "clasificaciones": {...}
        }
      ]
    }
  },
  "trace_id": "..."
}
```

### GET /master/api/alquimia-alumno/report

Obtiene reporte completo del alumno (dos paneles: técnico + humano).

**Query Params**:
- `student_id` (required): ID del alumno
- `days` (optional, default: 30, max: 365): Días hacia atrás

**Respuesta**:
```json
{
  "ok": true,
  "data": {
    "technical_panel": {
      "visible": false,
      "totals": {
        "total_events": 100,
        "master_events": 80,
        "student_events": 20
      },
      "events_by_day": {
        "2025-01-27": 10,
        "2025-01-26": 15
      },
      "top_items_by_events": [
        {
          "item_ref": "...",
          "events_count": 20
        }
      ],
      "dataset": {
        "events": [...],
        "execution_keys": [...]
      }
    },
    "human_panel": {
      "visible": true,
      "grouped_by_lista": [
        {
          "lista_id": 1,
          "lista_nombre": "Lista legible",
          "items": [
            {
              "item_ref": "...",
              "item_nombre": "Item legible",
              "events_count": 10,
              "last_cleaned_at": "...",
              "clasificaciones": {...}
            }
          ]
        }
      ],
      "grouped_by_classification": [
        {
          "category": "Categoría",
          "subcategory": "Subcategoría",
          "tags": ["tag1"],
          "items": [...]
        }
      ],
      "filters": {
        "category": null,
        "date_range": {
          "days": 30,
          "since_date": "..."
        }
      }
    },
    "metadata": {
      "days": 30,
      "since_date": "...",
      "student_id": 4,
      "total_items": 50,
      "total_listas": 10
    }
  },
  "trace_id": "..."
}
```

## Regla Canónica: Archivado (Soft Delete)

**REGLAS OBLIGATORIAS**:
1. Solo items/listas con `status='active'` aparecen en megalist
2. Items/listas archivados NO se renderizan en:
   - Megalist principal
   - Panel humano del report/historial
3. Panel técnico del report/historial:
   - Conserva eventos históricos de items archivados
   - Marca explícitamente `item_archived: true` en eventos
   - Marca `archived: true` en metadata del item

**IMPLEMENTACIÓN**:
- `ensureCleaningItemStateSeedForStudent()` solo materializa estados para items activos
- Megalist Service verifica `status='active'` antes de renderizar
- Report Service excluye items archivados del panel humano
- History Resolver marca items archivados en panel técnico

## Seed Canónico

**Contrato**: CleaningSeed v1

**Ejecución**:
- Automática antes de GET megalist
- Manual si se requiere

**Parámetros**:
- `student_id` (required)
- `product_key` (default: 'pde')
- `domain_type` (default: 'transmutation')
- `level_cap` (optional, default: nivel_efectivo)

**Respuesta**:
```json
{
  "inserted": 50,
  "skipped": 0,
  "total_applicable": 50,
  "total_existing": 50
}
```

---

**Referencias**: 
- `src/core/contracts/alquimia-contracts.js` - AlquimiaAlumnoMegalistV2, CleanItemV1, ItemHistoryV1, AlquimiaAlumnoReportV1, CleaningSeedV1
- `src/core/master/services/cleaning-state-seed-service.js`
