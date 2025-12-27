# Sistema Canónico de Contextos y Mappings

## 📋 Índice

1. [¿Qué es un Contexto?](#qué-es-un-contexto)
2. [¿Qué es un Mapping?](#qué-es-un-mapping)
3. [¿Qué decide un Package?](#qué-decide-un-package)
4. [Ejemplos Reales](#ejemplos-reales)
5. [Arquitectura Técnica](#arquitectura-técnica)
6. [Orden de Resolución](#orden-de-resolución)

---

## ¿Qué es un Contexto?

Un **contexto** es una variable semántica que representa un estado o valor que puede usarse en Packages, Widgets, Automatizaciones y GPTs.

### Propiedades Canónicas

Cada contexto tiene las siguientes propiedades obligatorias:

- **`context_key`** (string, único): Clave única del contexto (ej: `nivel_pde`, `tipo_limpieza`)
- **`label`** (string): Nombre legible para humanos (ej: "Nivel PDE", "Tipo de Limpieza")
- **`description`** (string, opcional): Descripción del contexto
- **`type`** (enum): Tipo de dato: `string`, `number`, `boolean`, `enum`, `json`
- **`allowed_values`** (array, nullable): Valores permitidos (solo para `type=enum`)
- **`default_value`** (any, opcional): Valor por defecto
- **`scope`** (enum, obligatorio): Alcance del contexto
  - `system`: Contextos globales del sistema (ej: `temporada`)
  - `structural`: Estado estructural del alumno (ej: `nivel_pde`)
  - `personal`: Estado personal variable del alumno
  - `package`: Definido por una experiencia concreta (ej: `tipo_limpieza`)
- **`kind`** (enum): Tipo de contexto
  - `normal`: Contexto estándar
  - `level`: Contexto de nivel (estructural o local)
- **`injected`** (boolean): Si `true`, el runtime lo inyecta automáticamente

### Ejemplos de Contextos

```javascript
// Contexto de sistema (inyectado automáticamente)
{
  context_key: 'temporada',
  label: 'Temporada',
  type: 'string',
  scope: 'system',
  kind: 'normal',
  injected: true,
  default_value: 'invierno'
}

// Contexto estructural (inyectado automáticamente)
{
  context_key: 'nivel_pde',
  label: 'Nivel PDE',
  type: 'number',
  scope: 'structural',
  kind: 'level',
  injected: true,
  default_value: 1
}

// Contexto de package (no inyectado, definido por experiencia)
{
  context_key: 'tipo_limpieza',
  label: 'Tipo de Limpieza',
  type: 'enum',
  allowed_values: ['rapida', 'basica', 'profunda', 'maestro'],
  scope: 'package',
  kind: 'normal',
  injected: false,
  default_value: 'basica'
}
```

---

## ¿Qué es un Mapping?

Un **mapping** es una traducción de un valor de enum en parámetros derivados reutilizables.

### Propiedades

- **`context_key`** (string): Clave del contexto (debe ser enum)
- **`mapping_key`** (string): Valor del enum (ej: `rapida`, `completa`)
- **`label`** (string, humano): Etiqueta legible (ej: "Rápida", "Completa")
- **`description`** (string, opcional): Descripción del mapping
- **`mapping_data`** (JSONB): Parámetros derivados (ej: `{"max_aspects": 5, "minutes": 10}`)
- **`sort_order`** (number): Orden de visualización
- **`active`** (boolean): Estado activo/inactivo

### Principios

1. **Solo semántica, NO lógica**: `mapping_data` contiene parámetros, no condiciones ni decisiones
2. **Fail-open**: Si falta un mapping, se usa el valor por defecto
3. **Auto-sincronización**: Al crear/editar un contexto enum, se crean mappings automáticamente

### Ejemplo de Mapping

```javascript
// Para contexto 'tipo_limpieza' con valor 'rapida'
{
  context_key: 'tipo_limpieza',
  mapping_key: 'rapida',
  label: 'Limpieza Rápida',
  description: 'Limpieza energética rápida (10 minutos)',
  mapping_data: {
    max_aspects: 3,
    minutes: 10,
    intensity: 'light'
  },
  sort_order: 1,
  active: true
}
```

---

## ¿Qué decide un Package?

Un **package** declara qué contextos necesita y cómo los usa.

### Contextos Seleccionables

En el creador de packages, **solo se pueden seleccionar** contextos con:
- `scope = package`
- `kind = normal` o `kind = level` (si es nivel local)

### Contextos Implícitos

Aunque no se seleccionen, los siguientes contextos están disponibles implícitamente:
- Contextos con `scope = system` (ej: `temporada`)
- Contextos con `scope = structural` (ej: `nivel_pde`)

Estos contextos pueden usarse en:
- `context_rules` (reglas condicionales)
- Runtime (resolución de valores)
- Widgets (visualización)

### Ejemplo de Package

```json
{
  "package_key": "limpieza_navidad",
  "package_name": "Limpieza de Navidad",
  "context_contract": {
    "inputs": [
      {
        "context_key": "tipo_limpieza",
        "type": "enum",
        "allowed_values": ["rapida", "basica", "profunda"]
      }
    ]
  },
  "context_rules": [
    {
      "when": { "nivel_pde": { "gte": 5 } },
      "then": { "tipo_limpieza": "profunda" }
    }
  ]
}
```

**Nota**: `nivel_pde` no está en `inputs`, pero está disponible implícitamente en `context_rules`.

---

## Ejemplos Reales

### Ejemplo 1: Limpiezas Energéticas

**Contexto:**
```javascript
{
  context_key: 'tipo_limpieza',
  label: 'Tipo de Limpieza',
  type: 'enum',
  allowed_values: ['rapida', 'basica', 'profunda', 'maestro'],
  scope: 'package',
  kind: 'normal',
  injected: false
}
```

**Mappings:**
```javascript
[
  {
    mapping_key: 'rapida',
    label: 'Limpieza Rápida',
    description: 'Limpieza energética rápida (10 minutos)',
    mapping_data: { max_aspects: 3, minutes: 10 }
  },
  {
    mapping_key: 'basica',
    label: 'Limpieza Básica',
    description: 'Limpieza energética básica (20 minutos)',
    mapping_data: { max_aspects: 5, minutes: 20 }
  },
  {
    mapping_key: 'profunda',
    label: 'Limpieza Profunda',
    description: 'Limpieza energética profunda (45 minutos)',
    mapping_data: { max_aspects: 10, minutes: 45 }
  }
]
```

### Ejemplo 2: Navidad

**Contexto:**
```javascript
{
  context_key: 'temporada',
  label: 'Temporada',
  type: 'string',
  scope: 'system',
  kind: 'normal',
  injected: true,
  default_value: 'invierno'
}
```

**Uso en Package:**
```json
{
  "context_rules": [
    {
      "when": { "temporada": "navidad" },
      "then": { "tema_especial": "limpieza_navidad" }
    }
  ]
}
```

### Ejemplo 3: Nivel PDE

**Contexto:**
```javascript
{
  context_key: 'nivel_pde',
  label: 'Nivel PDE',
  type: 'number',
  scope: 'structural',
  kind: 'level',
  injected: true,
  default_value: 1
}
```

**Uso en Package:**
```json
{
  "context_rules": [
    {
      "when": { "nivel_pde": { "gte": 5 } },
      "then": { "acceso_avanzado": true }
    }
  ]
}
```

---

## Arquitectura Técnica

### Base de Datos

**Tabla: `pde_contexts`**
- Campos canónicos: `scope`, `kind`, `injected`, `type`, `allowed_values`, `default_value`
- Índices: `scope`, `kind`, `scope+kind`

**Tabla: `context_mappings`**
- Campos: `label`, `description`, `mapping_data`, `sort_order`, `active`
- Constraint único: `(context_key, mapping_key)` donde `deleted_at IS NULL`

### Sincronización Automática

La función `syncContextMappings()` se ejecuta automáticamente:
- Al crear un contexto enum
- Al editar `allowed_values` de un contexto enum

**Comportamiento:**
- Crea mappings para cada `allowed_value` si no existen
- Mantiene `mapping_data` existente
- Desactiva (soft delete) mappings obsoletos
- Nunca borra físicamente

### API Endpoints

- `GET /admin/api/contexts` - Lista contextos
- `GET /admin/api/contexts/:key` - Obtiene un contexto
- `POST /admin/api/contexts` - Crea un contexto
- `PUT /admin/api/contexts/:key` - Actualiza un contexto
- `GET /admin/api/context-mappings?context_key=` - Lista mappings
- `POST /admin/api/context-mappings` - Crea/actualiza mapping

---

## Orden de Resolución

El runtime resuelve contextos en el siguiente orden (de mayor a menor prioridad):

1. **Overrides / Automatizaciones**: Valores forzados por automatizaciones
2. **Contextos del Package**: Valores definidos en el package
3. **Contextos Personales**: Estado personal variable del alumno
4. **Contextos Estructurales**: Estado estructural (ej: `nivel_pde`)
5. **Contextos de Sistema**: Contextos globales (ej: `temporada`)

### Ejemplo de Resolución

```javascript
// Contexto: tipo_limpieza
// Orden de resolución:

// 1. Override (si existe)
override = { tipo_limpieza: 'profunda' }

// 2. Package (si está en inputs)
package = { tipo_limpieza: 'basica' }

// 3. Personal (si existe)
personal = null

// 4. Estructural (no aplica, es package)
structural = null

// 5. Sistema (no aplica, es package)
system = null

// Resultado final: 'profunda' (override tiene prioridad)
```

### Fail-Open

Si un contexto no existe o no se puede resolver:
- Se usa el `default_value` del contexto
- Si no hay `default_value`, se usa el valor por defecto según `type`
- **Nunca se rompe el runtime**

---

## Reglas de Validación

### Contextos

1. **`context_key`**: Solo letras minúsculas, números, guiones bajos y guiones
2. **`scope`**: Obligatorio, debe ser uno de: `system`, `structural`, `personal`, `package`
3. **`kind`**: Obligatorio, debe ser: `normal` o `level`
4. **`type=enum`**: Requiere `allowed_values` no vacío
5. **`nivel_pde`**: DEBE tener `scope=structural`, `kind=level`, `injected=true`

### Mappings

1. Solo para contextos con `type=enum`
2. `mapping_key` debe estar en `allowed_values` del contexto
3. `label` es obligatorio
4. `mapping_data` debe ser un objeto JSON válido

---

## UI de Administración

### Gestor de Contextos (`/admin/contexts`)

**Pestañas por Scope:**
- 🧠 Sistema: Contextos globales
- 🏗️ Estructurales: Estado estructural del alumno
- 👤 Personales: Estado personal variable
- 📦 Package: Contextos definidos por experiencias
- 🗺️ Mappings: Editor de mappings

**Formulario:**
- Campos canónicos visibles: `scope`, `kind`, `injected`
- Validaciones visuales claras
- Bloqueo de combinaciones inválidas

### Editor de Mappings

**Campos principales:**
- `label` (humano, obligatorio)
- `description` (opcional)

**Modo avanzado (colapsable):**
- `mapping_data` (JSON)

**Características:**
- Auto-save al perder foco
- Orden editable
- Feedback visual (toast)

---

## Integración en Package Creator

### Filtrado

El creador de packages (`/admin/pde/packages-v2`) solo muestra contextos con:
- `scope = package`
- `kind = normal` o `kind = level` (niveles locales)

### JSON Generado

El Package Prompt Context JSON incluye:
- Definición completa del contexto
- Mappings completos (`label` + `mapping_data`)

**Ejemplo:**
```json
{
  "context_contract": {
    "inputs": [
      {
        "context_key": "tipo_limpieza",
        "type": "enum",
        "allowed_values": ["rapida", "basica", "profunda"],
        "description": "Tipo de limpieza energética"
      }
    ]
  },
  "mappings": {
    "tipo_limpieza": {
      "rapida": {
        "label": "Limpieza Rápida",
        "description": "Limpieza energética rápida (10 minutos)",
        "mapping_data": { "max_aspects": 3, "minutes": 10 }
      },
      "basica": {
        "label": "Limpieza Básica",
        "description": "Limpieza energética básica (20 minutos)",
        "mapping_data": { "max_aspects": 5, "minutes": 20 }
      }
    }
  }
}
```

---

## Conclusión

El sistema de contextos y mappings es la **columna vertebral** de AuriPortal para:
- Packages (experiencias personalizables)
- Widgets (componentes reutilizables)
- Automatizaciones (reglas condicionales)
- GPTs (generación de contenido)

**Principios fundamentales:**
- PostgreSQL es la única fuente de verdad
- Fail-open siempre
- Sincronización automática
- UI clara y validada
- Sin innerHTML dinámico

---

**Versión:** v5.27.0  
**Fecha:** 2025-01-XX  
**Autor:** Sistema AuriPortal








