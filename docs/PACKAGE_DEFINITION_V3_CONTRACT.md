# 📦 Contrato Canónico PackageDefinition v3

## 🎯 Propósito

**PackageDefinition** es el contrato canónico, determinista y READONLY que define un paquete PDE. Este JSON es:

- ✅ **READONLY**: No se edita manualmente
- ✅ **Determinista**: Mismo input siempre produce mismo output
- ✅ **Sin lógica**: Solo ensambla piezas, no decide nada
- ✅ **Correcto por diseño**: No necesita validación posterior
- ✅ **Single Source of Truth**: Es la entrada directa del futuro Resolver v1

## 📋 Estructura del Contrato

```json
{
  "package_key": "string",
  "label": "string",
  "description": "string",
  "sources": [
    {
      "source_type": "decretos | transmutaciones | frases | protecciones | ...",
      "source_key": "string",
      "options": {
        "allow_video": true,
        "allow_text": true,
        "allow_audio": false
      }
    }
  ],
  "contexts": [
    {
      "context_key": "string",
      "type": "number | enum | string",
      "default": null
    }
  ],
  "mappings": {
    "context_key": {
      "enum_value": {
        "label": "string",
        "description": "string"
      }
    }
  },
  "outputs": [
    {
      "key": "string",
      "description": "string"
    }
  ],
  "signals": [
    "signal_key"
  ],
  "meta": {
    "version": 1,
    "created_at": "iso-date"
  }
}
```

## 📝 Descripción de Campos

### `package_key` (string, obligatorio)
Clave única del paquete. Debe ser única en el sistema.

### `label` (string, obligatorio)
Nombre legible del paquete para mostrar en la UI.

### `description` (string, opcional)
Descripción del propósito del paquete.

### `sources` (array, obligatorio)
Array de Sources of Truth seleccionados. Cada source incluye:
- `source_type`: Tipo semántico del source (ej: "transmutaciones", "decretos")
- `source_key`: Clave única del source (debe existir en el Catálogo Registry)
- `options`: Opciones de formato permitidas (video, text, audio)

### `contexts` (array, obligatorio)
Array de contextos seleccionados (solo `scope=package`). Cada contexto incluye:
- `context_key`: Clave única del contexto (debe existir en Context Registry)
- `type`: Tipo del contexto ("string", "number", "enum")
- `default`: Valor por defecto (null si no hay default)

**IMPORTANTE**: Los contextos con `scope=system` o `scope=structural` NO se incluyen aquí. Están implícitos en runtime futuro.

### `mappings` (object, opcional)
Objeto que mapea `context_key` a sus mappings disponibles. Estructura:
```json
{
  "context_key": {
    "enum_value_1": {
      "label": "Label del valor",
      "description": "Descripción del valor"
    },
    "enum_value_2": {
      ...
    }
  }
}
```

Los mappings se obtienen automáticamente desde el Context Mappings Service.

### `outputs` (array, opcional)
Array de outputs que el paquete puede producir. Cada output incluye:
- `key`: Clave única del output
- `description`: Descripción del output

### `signals` (array, opcional)
Array de signal_keys que el paquete emite cuando se ejecuta.

### `meta` (object, obligatorio)
Metadatos del PackageDefinition:
- `version`: Versión del contrato (actualmente 1)
- `created_at`: Fecha/hora ISO de creación

## 🚫 Lo que NO contiene

El PackageDefinition **NO contiene**:
- ❌ Lógica condicional
- ❌ Reglas ejecutables
- ❌ Máximos o límites
- ❌ Filtros por nivel (eso lo hace el Resolver)
- ❌ Validaciones
- ❌ GPT prompts
- ❌ Código ejecutable

## 🔧 Construcción

El PackageDefinition se construye usando `buildPackageDefinition()` en `src/core/packages/package-engine.js`.

Esta función:
1. Ensambla sources desde el Catálogo Registry
2. Ensambla contexts (solo scope=package) desde el Context Registry
3. Ensambla mappings desde el Context Mappings Service
4. Ensambla outputs y signals tal como se proporcionan
5. Genera metadata (version, created_at)

**PRINCIPIO**: La función solo ensambla, NO decide, NO filtra, NO valida lógica.

## 📊 Flujo de Uso

```
1. Usuario selecciona sources, contexts, outputs, signals en la UI
2. UI llama a /admin/api/packages/build-definition
3. Backend ejecuta buildPackageDefinition()
4. Se genera PackageDefinition canónico
5. Se guarda en draft.package_definition
6. Al publicar, se guarda en version.package_definition
7. Resolver v1 (futuro) consume PackageDefinition directamente
```

## 🔄 Migración desde v2

El sistema v2 usaba "Package Prompt Context" que incluía:
- `context_contract` con inputs/outputs
- `context_rules` con reglas ejecutables
- `sources_of_truth` como array de strings
- `signals_emitted` como array de strings

La migración a v3:
- `context_contract.inputs` → `contexts` (estructura simplificada)
- `context_contract.outputs` → `outputs` (mismo formato)
- `sources_of_truth` → `sources` (estructura extendida con options)
- `signals_emitted` → `signals` (mismo formato)
- `context_rules` → **ELIMINADO** (será parte del Resolver v1)
- `assembled_json` → **ELIMINADO** (ya no se usa GPT)

## ✅ Validación

El PackageDefinition es válido si:
1. Tiene `package_key` (string no vacío)
2. Tiene `label` (string no vacío)
3. Tiene `sources` (array, puede estar vacío)
4. Tiene `contexts` (array, puede estar vacío)
5. Tiene `meta.version` = 1
6. Todos los `source_key` existen en el Catálogo Registry
7. Todos los `context_key` existen en el Context Registry (y son scope=package)

**NOTA**: La validación es estructural, NO lógica. No se valida si el paquete "tiene sentido" o si las combinaciones son válidas. Eso lo hará el Resolver v1.

## 📚 Referencias

- `src/core/packages/package-engine.js` → `buildPackageDefinition()`
- `src/endpoints/admin-packages-api.js` → `handleBuildPackageDefinition()`
- `src/infra/repos/pde-packages-repo-pg.js` → Repositorio que guarda PackageDefinition
- `database/migrations/v5.27.0-refactor-packages-to-package-definition.sql` → Migración SQL

