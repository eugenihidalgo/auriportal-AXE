# 🧠 Diseñador de Motores PDE v1.0

## 📋 Resumen Ejecutivo

El **Diseñador de Motores PDE** es un sistema completo para crear, gestionar y versionar motores reutilizables que generan estructura AXE (steps, edges, captures) para recorridos pedagógicos.

**Estado:** ✅ **Operativo y Blindado**

**Versión de Migración:** `v5.10.0-create-pde-motors.sql`

---

## 🎯 ¿Qué es un Motor?

Un **Motor** es una plantilla reutilizable que:

1. **Acepta inputs** (parámetros configurables)
2. **Aplica reglas** (lógica declarativa)
3. **Genera estructura AXE** (steps, edges, captures)

Los motores permiten crear recorridos dinámicos sin duplicar código, centralizando la lógica de generación de estructura.

---

## 🗄️ Base de Datos

### Tabla: `pde_motors`

```sql
CREATE TABLE pde_motors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  motor_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft',
  definition JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP
);
```

### Campos Clave

- **`id`**: UUID único del motor
- **`motor_key`**: Clave canónica única e inmutable (ej: `motor_preparacion_practica`)
- **`name`**: Nombre descriptivo (ej: "Motor de Preparación para la Práctica")
- **`description`**: Descripción opcional
- **`category`**: Categoría del motor (ej: `preparacion`, `limpieza`)
- **`version`**: Versión del motor (se incrementa automáticamente al actualizar `definition`)
- **`status`**: Estado (`draft`, `published`, `archived`)
- **`definition`**: Definición JSONB completa del motor
- **`deleted_at`**: Soft delete (NULL si no eliminado)

### Índices

- `idx_pde_motors_motor_key` - Búsqueda rápida por clave
- `idx_pde_motors_status` - Filtrado por estado
- `idx_pde_motors_category` - Filtrado por categoría
- `idx_pde_motors_deleted_at` - Filtrado de eliminados

---

## 📦 Contrato JSON del Motor

### Estructura Mínima

```json
{
  "inputs": [
    {
      "key": "cleaning_type",
      "type": "enum",
      "required": true,
      "options": ["rapida", "basica", "profunda"]
    }
  ],
  "rules": {
    "description": "Reglas internas del motor",
    "logic": {}
  },
  "outputs": {
    "steps": [],
    "edges": [],
    "captures": []
  }
}
```

### Inputs

Cada input debe tener:

- **`key`** (string, requerido): Identificador único del input
- **`type`** (string, requerido): Tipo de input (`enum`, `number`, `string`, `boolean`)
- **`required`** (boolean, opcional): Si el input es obligatorio
- **`options`** (array, requerido si `type === 'enum'`): Opciones válidas para enum

### Rules

Las reglas son lógica declarativa que procesa los inputs y genera la estructura. Por ahora, es un objeto JSON libre que se almacena pero no se ejecuta (preparado para integración futura con AXE).

### Outputs

- **`steps`** (array): Array de steps AXE
- **`edges`** (array): Array de edges AXE
- **`captures`** (array): Array de captures AXE

---

## 🔄 Estados y Versionado

### Estados

1. **`draft`**: Motor en borrador (editable)
2. **`published`**: Motor publicado (no editable, solo duplicable)
3. **`archived`**: Motor archivado (no visible por defecto)

### Versionado

- La versión se incrementa automáticamente al actualizar `definition`
- Los motores `published` no se pueden editar (solo duplicar)
- Al duplicar, se crea un nuevo motor con versión 1 y estado `draft`

---

## 🛠️ Arquitectura

### Capas

1. **Repositorio** (`src/core/repos/pde-motors-repo.js`)
   - Contrato abstracto
   - Define la interfaz que debe implementar cualquier repositorio

2. **Implementación PostgreSQL** (`src/infra/repos/pde-motors-repo-pg.js`)
   - Implementación concreta
   - Encapsula todas las queries SQL
   - Retorna objetos raw de PostgreSQL

3. **Servicio de Negocio** (`src/services/pde-motors-service.js`)
   - Validación de definiciones
   - Lógica de negocio (versionado, estados)
   - Bloqueo de edición de motores `published`

4. **Endpoints API** (`src/endpoints/admin-motors-api.js`)
   - REST API protegida con `requireAdminContext()`
   - Manejo de errores y validaciones

5. **UI Admin** (`src/endpoints/admin-motors.js`)
   - Listado de motores
   - Editor con 4 pestañas

---

## 🔌 Endpoints API

### GET `/admin/pde/motors`

Lista todos los motores.

**Query Params:**
- `status` (opcional): Filtrar por estado
- `category` (opcional): Filtrar por categoría
- `includeDeleted` (opcional): Incluir eliminados (default: false)

**Respuesta:**
```json
{
  "success": true,
  "motors": [...]
}
```

### GET `/admin/pde/motors/:id`

Obtiene un motor por ID.

**Respuesta:**
```json
{
  "success": true,
  "motor": {...}
}
```

### POST `/admin/pde/motors`

Crea un nuevo motor.

**Body:**
```json
{
  "motor_key": "motor_preparacion_practica",
  "name": "Motor de Preparación para la Práctica",
  "description": "Genera estructura para preparación",
  "category": "preparacion",
  "definition": {...}
}
```

**Respuesta:**
```json
{
  "success": true,
  "motor": {...}
}
```

### PUT `/admin/pde/motors/:id`

Actualiza un motor existente.

**Body:** (parcial, solo campos a actualizar)
```json
{
  "name": "Nuevo nombre",
  "definition": {...}
}
```

**Nota:** No permite editar motores `published`.

### DELETE `/admin/pde/motors/:id`

Elimina un motor (soft delete).

**Respuesta:**
```json
{
  "success": true,
  "message": "Motor eliminado correctamente"
}
```

### POST `/admin/pde/motors/:id/duplicate`

Duplica un motor (crea una nueva versión).

**Respuesta:**
```json
{
  "success": true,
  "motor": {...}
}
```

### POST `/admin/pde/motors/:id/publish`

Publica un motor (cambia status a `published`).

**Nota:** Valida la definición antes de publicar.

**Respuesta:**
```json
{
  "success": true,
  "motor": {...}
}
```

### POST `/admin/pde/motors/:id/generate`

Genera estructura AXE para un motor con inputs dados.

**Body:**
```json
{
  "inputs": {
    "cleaning_type": "rapida"
  }
}
```

**Respuesta:**
```json
{
  "success": true,
  "structure": {
    "steps": [...],
    "edges": [...],
    "captures": [...]
  }
}
```

---

## 🎨 UI Admin

### Listado (`/admin/motors`)

- Tabla con todos los motores
- Filtros por estado y categoría
- Acciones: Editar, Duplicar, Publicar, Eliminar

### Editor (`/admin/motors/editar/:id` o `/admin/motors/editar/nuevo`)

**4 Pestañas:**

1. **Identidad**
   - Motor Key (readonly tras crear)
   - Nombre
   - Descripción
   - Categoría
   - Versión (readonly)
   - Estado

2. **Inputs**
   - Editor visual de inputs
   - Agregar/Eliminar inputs
   - Configurar tipo, opciones, requerido

3. **Reglas**
   - Editor JSON de reglas
   - Validación de JSON

4. **Output Estructural**
   - Editor JSON de steps, edges, captures
   - Validación de estructura

**Validaciones:**
- Validación en tiempo real
- Bloqueo de guardado si hay errores
- Mensajes de error claros

---

## ✅ Validaciones

### Validación de Definición

La función `validateMotorDefinition()` valida:

1. **Estructura básica**: Debe ser un objeto
2. **Inputs**: Debe ser un array
   - Cada input debe tener `key` y `type`
   - Tipos válidos: `enum`, `number`, `string`, `boolean`
   - Inputs `enum` deben tener `options` no vacío
3. **Rules**: Debe ser un objeto (si existe)
4. **Outputs**: Debe ser un objeto con:
   - `steps` (array)
   - `edges` (array)
   - `captures` (array)

### Validación de Motor Key

- Debe ser único
- No se puede cambiar tras crear (readonly)

### Validación de Estado

- Motores `published` no se pueden editar
- Solo se pueden duplicar

---

## 🔗 Integración con AXE

### Función `generateAxeStructure()`

```javascript
const structure = await generateAxeStructure(motorId, inputs);
```

**Parámetros:**
- `motorId`: UUID del motor
- `inputs`: Objeto con valores de inputs

**Retorna:**
```javascript
{
  steps: [...],
  edges: [...],
  captures: [...]
}
```

**Nota:** Por ahora, retorna la estructura base del motor. En el futuro, aplicará la lógica de las `rules` para generar la estructura dinámicamente.

---

## 📝 Ejemplo Mínimo Válido

```json
{
  "motor_key": "motor_ejemplo",
  "name": "Motor de Ejemplo",
  "description": "Motor de ejemplo para pruebas",
  "category": "ejemplo",
  "definition": {
    "inputs": [
      {
        "key": "tipo",
        "type": "enum",
        "required": true,
        "options": ["opcion1", "opcion2"]
      }
    ],
    "rules": {
      "description": "Reglas de ejemplo"
    },
    "outputs": {
      "steps": [
        {
          "id": "step1",
          "type": "screen",
          "content": "Contenido del step"
        }
      ],
      "edges": [
        {
          "from": "step1",
          "to": "step2"
        }
      ],
      "captures": []
    }
  }
}
```

---

## 🔒 Seguridad

- Todos los endpoints están protegidos con `requireAdminContext()`
- Validación de definiciones antes de guardar/publicar
- Soft delete normalizado
- No se permite editar motores `published`

---

## 🚀 Migración

### Aplicar Migración

```bash
cd /var/www/aurelinportal
psql -U postgres -d aurelinportal -f database/migrations/v5.10.0-create-pde-motors.sql
```

### Verificar Migración

```sql
-- Verificar que la tabla existe
SELECT * FROM information_schema.tables WHERE table_name = 'pde_motors';

-- Verificar estructura
\d pde_motors

-- Verificar índices
SELECT indexname FROM pg_indexes WHERE tablename = 'pde_motors';
```

---

## 📚 Archivos Relacionados

### Backend
- `src/core/repos/pde-motors-repo.js` - Contrato del repositorio
- `src/infra/repos/pde-motors-repo-pg.js` - Implementación PostgreSQL
- `src/services/pde-motors-service.js` - Servicio de negocio
- `src/endpoints/admin-motors-api.js` - Endpoints API
- `src/endpoints/admin-motors.js` - UI Admin

### Frontend
- `src/core/html/admin/motors/motors-listado.html` - Listado
- `src/core/html/admin/motors/motors-editar.html` - Editor

### Base de Datos
- `database/migrations/v5.10.0-create-pde-motors.sql` - Migración

---

## 🔮 Futuro

### Integración con AXE

Cuando se implemente la integración completa:

1. El Editor de Recorridos podrá consumir motores
2. Los motores generarán estructura AXE dinámicamente según inputs
3. Las `rules` se ejecutarán para procesar inputs y generar outputs

### Mejoras Futuras

- Editor visual de reglas (no solo JSON)
- Preview de estructura generada
- Historial de versiones
- Exportar/Importar motores
- Tests automatizados de motores

---

## ✅ Checklist de Verificación

- [x] Migración SQL creada y aplicada
- [x] Tabla `pde_motors` existe en PostgreSQL
- [x] Repositorio implementado y funcionando
- [x] Servicio de negocio con validaciones
- [x] Endpoints API montados y protegidos
- [x] UI Admin funcional (listado + editor)
- [x] Sidebar integrado en Contenido PDE
- [x] Validaciones de definición funcionando
- [x] Soft delete normalizado
- [x] Versionado automático
- [x] Bloqueo de edición de motores `published`
- [x] Documentación completa

---

**Versión:** 1.0  
**Última actualización:** 2024-12-XX  
**Estado:** ✅ Operativo y Blindado



