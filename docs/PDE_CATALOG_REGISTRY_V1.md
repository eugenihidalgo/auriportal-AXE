# 📚 Registro Canónico de Catálogos PDE v1.0

**Fecha:** 2025-01-XX  
**Versión:** v1.0.0  
**Estado:** ✅ Implementado

---

## 🎯 OBJETIVO

El **Registro Canónico de Catálogos PDE** es el Source of Truth (fuente de verdad) centralizado para metadata de todos los catálogos PDE existentes en AuriPortal. Permite:

- ✅ Gestionar qué catálogos están disponibles para el Diseñador de Motores
- ✅ Exponer las capacidades de cada catálogo (supports_level, supports_priority, etc.)
- ✅ Integrar catálogos con el Diseñador de Motores mediante dropdowns dinámicos
- ✅ Validar que los catálogos usados en motores sean válidos y activos

---

## 🏗️ ARQUITECTURA

### Tabla Principal

**Tabla:** `pde_catalog_registry`

```sql
CREATE TABLE pde_catalog_registry (
  id UUID PRIMARY KEY,
  catalog_key VARCHAR(100) UNIQUE NOT NULL,
  label VARCHAR(255) NOT NULL,
  description TEXT,
  source_table VARCHAR(100) NOT NULL,
  source_endpoint VARCHAR(255),
  usable_for_motors BOOLEAN DEFAULT true,
  supports_level BOOLEAN DEFAULT false,
  supports_priority BOOLEAN DEFAULT false,
  supports_obligatory BOOLEAN DEFAULT false,
  supports_duration BOOLEAN DEFAULT false,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Campos Clave

| Campo | Descripción |
|-------|-------------|
| `catalog_key` | Clave canónica única (ej: `preparaciones_practica`, `tecnicas_limpieza`) |
| `label` | Etiqueta legible para UI (ej: "Preparaciones para la Práctica") |
| `source_table` | Nombre de la tabla PostgreSQL que contiene los datos reales |
| `usable_for_motors` | Si el catálogo puede ser usado en el Diseñador de Motores |
| `supports_*` | Flags que indican qué capacidades soporta el catálogo |
| `status` | Estado: `active` o `archived` |

---

## 📋 CATÁLOGOS REGISTRADOS

Basados en la auditoría realizada en `PDE_CATALOGS_FOR_MOTORS_V1.md`, se registraron inicialmente:

1. **preparaciones_practica** - Preparaciones para la Práctica
2. **tecnicas_limpieza** - Técnicas de Limpieza Energética
3. **tecnicas_post_practica** - Técnicas Post-Práctica
4. **transmutaciones_energeticas** - Transmutaciones Energéticas
5. **protecciones_energeticas** - Protecciones Energéticas
6. **decretos** - Biblioteca de Decretos
7. **frases** - Frases PDE
8. **musicas** - Músicas de Meditación
9. **tonos** - Tonos de Meditación

---

## 🔌 INTEGRACIÓN CON DISEÑADOR DE MOTORES

### Nuevo Tipo de Input: `select`

El Diseñador de Motores ahora soporta inputs de tipo `select` que se conectan al registro de catálogos.

### Definición de Input con Catálogo

```json
{
  "key": "catalogo_seleccionado",
  "type": "select",
  "options_source": {
    "source": "pde_catalog_registry",
    "value_field": "catalog_key",
    "label_field": "label",
    "filter": { "usable_for_motors": true },
    "catalog_key": "tecnicas_limpieza"
  },
  "required": true
}
```

### Estructura de `options_source`

| Campo | Descripción |
|-------|-------------|
| `source` | Siempre `"pde_catalog_registry"` para catálogos |
| `value_field` | Campo a usar como valor (típicamente `"catalog_key"`) |
| `label_field` | Campo a usar como etiqueta (típicamente `"label"`) |
| `filter` | Filtros aplicados (ej: `{ "usable_for_motors": true }`) |
| `catalog_key` | Catálogo específico seleccionado (opcional, si se especifica uno) |

### Uso en el Diseñador de Motores

1. **Crear un nuevo input** en el Diseñador de Motores
2. **Seleccionar tipo `select`** en el dropdown de tipos
3. **Seleccionar un catálogo** del dropdown "Fuente del Catálogo"
4. El sistema guardará automáticamente el `options_source` con la configuración correcta

---

## 🔧 ENDPOINTS API

### GET /admin/pde/catalog-registry

Lista todos los catálogos registrados (HTML).

### GET /admin/pde/catalog-registry?format=json&usable_for_motors=true

Lista catálogos en formato JSON (para dropdowns).

**Respuesta:**
```json
{
  "success": true,
  "catalogs": [
    {
      "id": "uuid",
      "catalog_key": "tecnicas_limpieza",
      "label": "Técnicas de Limpieza Energética",
      "usable_for_motors": true,
      "supports_priority": true,
      "supports_obligatory": true,
      ...
    }
  ]
}
```

### GET /admin/pde/catalog-registry/:id

Obtiene un catálogo específico por ID.

### PUT /admin/pde/catalog-registry/:id

Actualiza metadata de un catálogo (no permite cambiar `catalog_key` ni `source_table`).

**Body:**
```json
{
  "label": "Nueva etiqueta",
  "usable_for_motors": true,
  "supports_level": true,
  "status": "active"
}
```

---

## 🎨 UI ADMIN

### Registro de Catálogos

**Ruta:** `/admin/pde/catalog-registry`

Vista tipo tabla que muestra:
- Etiqueta del catálogo
- Catalog Key (readonly)
- Tabla Origen (readonly)
- Usable para Motores (toggle)
- Capacidades (badges: Nivel, Prioridad, Obligatorio, Duración)
- Estado (Activo/Archivado)
- Botón Editar

### Edición de Catálogo

Modal que permite editar:
- Etiqueta
- Descripción
- Endpoint API
- Usable para Motores (checkbox)
- Capacidades (checkboxes)
- Estado (dropdown)

**Restricciones:**
- `catalog_key` y `source_table` son readonly (no se pueden cambiar)

---

## 🔗 RELACIÓN CON MOTORES Y AXE

### Flujo Completo

```
Registro de Catálogos (Source of Truth)
    ↓
Diseñador de Motores (selecciona catálogo)
    ↓
Input con options_source
    ↓
Motor genera estructura AXE
    ↓
Runtime obtiene opciones del catálogo real
```

### Validación

Cuando un motor se guarda, el sistema valida que:
- Si `options_source.source === 'pde_catalog_registry'`
- El `catalog_key` especificado existe en el registro
- El catálogo tiene `status = 'active'`
- El catálogo tiene `usable_for_motors = true`

---

## 📝 EJEMPLOS DE USO

### Ejemplo 1: Motor de Preparación que usa Técnicas de Limpieza

```json
{
  "inputs": [
    {
      "key": "tecnica_limpieza",
      "type": "select",
      "options_source": {
        "source": "pde_catalog_registry",
        "value_field": "catalog_key",
        "label_field": "label",
        "filter": { "usable_for_motors": true },
        "catalog_key": "tecnicas_limpieza"
      },
      "required": true
    }
  ],
  "rules": { ... },
  "outputs": { ... }
}
```

### Ejemplo 2: Motor que usa Protecciones Energéticas

```json
{
  "inputs": [
    {
      "key": "proteccion",
      "type": "select",
      "options_source": {
        "source": "pde_catalog_registry",
        "value_field": "catalog_key",
        "label_field": "label",
        "filter": { "usable_for_motors": true },
        "catalog_key": "protecciones_energeticas"
      },
      "required": true
    }
  ],
  ...
}
```

---

## 🚀 MIGRACIÓN

**Archivo:** `database/migrations/v5.12.0-create-pde-catalog-registry.sql`

**Aplicar:**
```bash
psql -d aurelinportal -f database/migrations/v5.12.0-create-pde-catalog-registry.sql
```

---

## ✅ VERIFICACIÓN

### Checklist de Verificación

- [x] Migración aplicada
- [x] Tabla `pde_catalog_registry` creada
- [x] Registros iniciales insertados
- [x] Endpoint `/admin/pde/catalog-registry` funcionando
- [x] Sidebar actualizado con "Registro de Catálogos"
- [x] Dropdown de catálogos funcionando en Diseñador de Motores
- [x] Input tipo `select` guardando `options_source` correctamente
- [x] Validación de catálogos en motores

---

## 🔮 FUTURAS MEJORAS

### Posibles Extensiones

1. **Filtrado avanzado:** Permitir filtros más complejos en `options_source.filter`
2. **Catálogos dinámicos:** Soporte para catálogos que se generan dinámicamente
3. **Cache de opciones:** Cachear opciones de catálogos para mejor rendimiento
4. **Validación en runtime:** Validar que las opciones seleccionadas existen en el catálogo real
5. **Sincronización automática:** Detectar cambios en catálogos y actualizar registro automáticamente

---

## 📚 REFERENCIAS

- `docs/PDE_CATALOGS_FOR_MOTORS_V1.md` - Auditoría completa de catálogos
- `docs/PDE_MOTORS_DESIGNER_V1.md` - Documentación del Diseñador de Motores
- `src/services/pde-catalog-registry-service.js` - Servicio de negocio
- `src/core/repos/pde-catalog-registry-repo.js` - Contrato del repositorio
- `src/infra/repos/pde-catalog-registry-repo-pg.js` - Implementación PostgreSQL

---

**Registro Canónico de Catálogos PDE v1.0** ✅  
*Source of Truth para metadata de catálogos PDE*











