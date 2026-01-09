# Master Alquimia General Contracts v1

**Versión**: 1.0.0  
**Fecha**: 2025-01-27  
**Scope**: MASTER  
**Estado**: CANÓNICO

## Contratos de Endpoints

### GET /master/api/alquimia-general/listas

Lista todas las listas activas del catálogo.

**Query Params**:
- `onlyActive` (boolean, default: true): Solo listas activas
- `tipo` (string, optional): Filtrar por tipo ('recurrente' | 'una_vez')

**Respuesta**:
```json
{
  "ok": true,
  "data": [
    {
      "id": 1,
      "nombre": "Lista ejemplo",
      "tipo": "recurrente",
      "descripcion": "...",
      "orden": 0,
      "status": "active",
      "created_at": "...",
      "updated_at": "..."
    }
  ],
  "trace_id": "..."
}
```

### POST /master/api/alquimia-general/listas

Crea una nueva lista.

**Body**:
```json
{
  "nombre": "Nueva lista",
  "tipo": "recurrente",
  "descripcion": "...",
  "orden": 0
}
```

**Respuesta**: Lista creada con `id` y `item_ref` generado.

### Campos Canónicos

**Listas**:
- `id` (required): ID único
- `nombre` (required): Nombre de la lista
- `tipo` (required): 'recurrente' | 'una_vez'
- `status` (required): 'active' | 'archived'
- `orden` (optional): Orden de visualización
- `descripcion` (optional): Descripción

**Items**:
- `id` (required): ID único
- `lista_id` (required): ID de la lista padre
- `item_ref` (required): Identidad externa (generado automáticamente)
- `nombre` (required): Nombre del item
- `nivel` (required): Nivel requerido
- `status` (required): 'active' | 'archived'
- `frecuencia_dias` (optional): Para listas recurrentes
- `veces_limpiar` (optional): Para listas una_vez
- `prioridad` (optional): Prioridad (1 = máxima)
- `descripcion` (optional): Descripción

## Ordenamiento Canónico

**Listas**:
```sql
ORDER BY orden ASC, nombre ASC
```

**Items**:
```sql
ORDER BY priority ASC, nivel ASC NULLS LAST, created_at ASC
```

## Clasificaciones

**SOT Global**:
- `pde_classification_terms`: Términos canónicos (key/subkey/tag)
- `transmutacion_lista_classifications`: Relación many-to-many

**Endpoints**:
- `GET /master/api/alquimia-general/listas/:id/classification`: Obtener clasificaciones
- `PUT /master/api/alquimia-general/listas/:id/classification`: Actualizar clasificaciones

**Tipos**:
- `category` (key): Máximo 1 por lista
- `subcategory` (subkey): Máximo 1 por lista
- `tags` (tag): Múltiples por lista

**Normalización**:
- Función PostgreSQL: `normalize_classification_term`
- Lowercase, sin acentos, trim

---

**Referencias**: `src/core/contracts/alquimia-contracts.js` - AlquimiaCatalogV1
