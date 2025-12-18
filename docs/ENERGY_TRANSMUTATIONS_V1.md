# Transmutaciones Energéticas v1

Sistema de catálogo y resolución de bundles de transmutaciones energéticas para AuriPortal.

## Visión General

El sistema permite gestionar un catálogo de transmutaciones energéticas que pueden ser consumidas por diferentes modos de limpieza, filtrando según el nivel del alumno.

### Modos de Limpieza

| Modo | Label | Máx. Transmutaciones | Descripción |
|------|-------|---------------------|-------------|
| `rapida` | Limpieza Rápida | 5 | Limpieza express para días ocupados |
| `basica` | Limpieza Básica | 10 | Limpieza equilibrada para práctica diaria |
| `profunda` | Limpieza Profunda | 25 | Limpieza completa para transformación intensa |
| `maestro` | Modo Maestro | 50 | Limpieza total para practicantes avanzados |

## Arquitectura v1

### Decisión: JSON vs Base de Datos

**v1 usa archivo JSON como fuente canónica:**

```
config/energy/transmutations.catalog.v1.json
```

**Razones para v1 con JSON:**

1. **Simplicidad de implementación**: No requiere migraciones de base de datos
2. **Versionado directo**: El archivo puede versionarse con Git
3. **Fail-open seguro**: Si el archivo falla, devolvemos bundle vacío
4. **Sin dependencias de BD**: El sistema funciona aunque la BD tenga problemas
5. **Portabilidad**: Fácil de copiar entre entornos

**Trade-offs:**

- No permite edición dinámica desde admin (pospuesto a v2)
- Cambios requieren deploy
- Sin historial de cambios en BD

### Componentes

```
src/core/energy/transmutations/
├── catalog-validator.js   # Validación estricta del contrato JSON
├── catalog-loader.js      # Carga + cache in-memory
└── bundle-resolver.js     # Resolución de bundles por modo/nivel

src/endpoints/
└── api-energy-transmutations.js  # Endpoint REST

config/energy/
└── transmutations.catalog.v1.json  # Fuente canónica
```

### Flujo de Datos

```
[JSON Catálogo] 
    ↓ 
[catalog-loader.js] ──→ cache in-memory
    ↓
[catalog-validator.js] ──→ validación
    ↓
[bundle-resolver.js]
    ↓
{ mode, transmutations[], techniques[], meta }
```

## API Endpoint

### GET /api/energy/transmutations/bundle

Obtiene un bundle de transmutaciones para el modo especificado.

**URL:** `GET /api/energy/transmutations/bundle?mode_id={mode_id}`

**Autenticación:** Cookie de sesión del alumno (requireStudentContext)

**Feature Flag:** `energy_transmutations_v1` debe estar `on` o `beta`

#### Parámetros

| Param | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `mode_id` | string | Sí | Modo de limpieza (rapida, basica, profunda, maestro) |

#### Respuesta Exitosa (200)

```json
{
  "ok": true,
  "bundle": {
    "mode": {
      "mode_id": "basica",
      "label": "Limpieza Básica",
      "description": "Limpieza equilibrada para práctica diaria",
      "max_transmutations": 10
    },
    "transmutations": [
      {
        "transmutation_id": "trans_001",
        "slug": "miedo-valor",
        "name": "Miedo → Valor",
        "description": "Transforma el miedo paralizante en coraje para actuar",
        "category": "emocional",
        "min_level": 1
      }
    ],
    "techniques": [
      {
        "technique_id": "tech_001",
        "slug": "respiracion-transmutadora",
        "name": "Respiración Transmutadora",
        "description": "Técnica de respiración profunda",
        "instructions": "Inhala profundamente...",
        "duration_seconds": 60,
        "category": "respiracion",
        "min_level": 1
      }
    ],
    "meta": {
      "resolved_at": "2025-12-17T12:00:00.000Z",
      "student_level": 3,
      "catalog_version": "1.0.0",
      "transmutations_selected": 10,
      "techniques_selected": 5
    }
  }
}
```

#### Respuesta Fail-Open (200)

Cuando el feature flag está desactivado o hay error de catálogo:

```json
{
  "ok": false,
  "bundle": {
    "mode_id": "basica",
    "transmutations": [],
    "techniques": [],
    "meta": {
      "reason": "feature_flag_disabled",
      "resolved_at": "2025-12-17T12:00:00.000Z"
    }
  }
}
```

#### Errores

| Status | Código | Descripción |
|--------|--------|-------------|
| 401 | `AUTH_REQUIRED` | No autenticado |
| 400 | `INVALID_MODE_ID` | mode_id inválido |
| 405 | - | Método no permitido |

### GET /api/energy/transmutations/modes

Lista los modos disponibles.

**Respuesta:**

```json
{
  "ok": true,
  "modes": [
    { "mode_id": "rapida", "label": "Limpieza Rápida", "max_transmutations": 5 },
    { "mode_id": "basica", "label": "Limpieza Básica", "max_transmutations": 10 },
    { "mode_id": "profunda", "label": "Limpieza Profunda", "max_transmutations": 25 },
    { "mode_id": "maestro", "label": "Modo Maestro", "max_transmutations": 50 }
  ]
}
```

## Feature Flag

El sistema está controlado por el feature flag `energy_transmutations_v1`:

| Estado | Comportamiento |
|--------|----------------|
| `off` | Endpoint devuelve bundle vacío con reason `feature_flag_disabled` |
| `beta` | Activo solo en entornos dev/beta |
| `on` | Activo en todos los entornos |

**Estado actual:** `beta`

## Integración con Recorridos

El sistema está diseñado para integrarse con el workflow `limpieza_energetica_diaria`.

### Uso desde un Step

```javascript
// En el renderer/step de limpieza energética
const mode_id = state.tipo_limpieza || 'basica'; // rapida, basica, profunda, maestro

// Opción 1: Llamar al endpoint
const response = await fetch(`/api/energy/transmutations/bundle?mode_id=${mode_id}`);
const { ok, bundle } = await response.json();

// Opción 2: Usar el resolver directamente (server-side)
import { resolveTransmutationBundle } from '../core/energy/transmutations/bundle-resolver.js';
const bundle = resolveTransmutationBundle(studentCtx, mode_id);

// Renderizar las transmutaciones
for (const trans of bundle.transmutations) {
  // Mostrar trans.name, trans.description, etc.
}
```

### Mapeo tipo_limpieza → mode_id

| state.tipo_limpieza | mode_id |
|---------------------|---------|
| `rapida` | `rapida` |
| `basica` | `basica` |
| `profunda` | `profunda` |
| `total` / `maestro` | `maestro` |

## Contrato del Catálogo JSON

### Estructura Principal

```json
{
  "catalog_id": "energy_transmutations",
  "version": "1.0.0",
  "status": "published",
  "modes": [...],
  "transmutations": [...],
  "techniques": [...]
}
```

### Validaciones

| Campo | Regla |
|-------|-------|
| `catalog_id` | Requerido, string |
| `version` | Requerido, string (semver) |
| `status` | Requerido, string (`published` = activo) |
| `modes[].mode_id` | Únicos, formato slug |
| `modes[].max_transmutations` | 1-100 |
| `modes[].selection_strategy` | `ordered`, `random`, `weighted` |
| `transmutations[].transmutation_id` | Únicos |
| `transmutations[].slug` | Únicos, formato slug |
| `transmutations[].min_level` | 1-10 |
| `transmutations[].is_active` | boolean |
| `techniques[].technique_id` | Únicos |
| `techniques[].slug` | Únicos, formato slug |

### Formato de Slug

- Solo minúsculas, números y guiones
- No puede empezar ni terminar con guión
- Ejemplos válidos: `miedo-valor`, `ansiedad-serenidad`, `a1-b2`
- Ejemplos inválidos: `Miedo_Valor`, `-miedo`, `valor-`

## Tests

```bash
# Ejecutar tests del validador
npm test -- tests/energy/transmutations-validator.test.js

# Ejecutar tests del resolver
npm test -- tests/energy/transmutations-resolver.test.js

# Ejecutar todos los tests de energy
npm test -- tests/energy/
```

## Evolución a v2 (Diseño Futuro)

### Base de Datos

Cuando se migre a BD, la estructura sería:

```sql
-- Tabla de catálogos (versionado)
CREATE TABLE energy_transmutations_catalog (
  id SERIAL PRIMARY KEY,
  catalog_id VARCHAR(50) NOT NULL,
  version VARCHAR(20) NOT NULL,
  status VARCHAR(20) DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT NOW(),
  published_at TIMESTAMP,
  UNIQUE(catalog_id, version)
);

-- Tabla de modos
CREATE TABLE energy_transmutations_mode (
  id SERIAL PRIMARY KEY,
  catalog_id INTEGER REFERENCES energy_transmutations_catalog(id),
  mode_id VARCHAR(50) NOT NULL,
  label VARCHAR(100) NOT NULL,
  max_transmutations INTEGER NOT NULL,
  selection_strategy VARCHAR(20) DEFAULT 'ordered',
  filters JSONB DEFAULT '{}',
  UNIQUE(catalog_id, mode_id)
);

-- Tabla de transmutaciones
CREATE TABLE energy_transmutation (
  id SERIAL PRIMARY KEY,
  catalog_id INTEGER REFERENCES energy_transmutations_catalog(id),
  transmutation_id VARCHAR(50) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  min_level INTEGER DEFAULT 1,
  weight INTEGER DEFAULT 50,
  category VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  UNIQUE(catalog_id, transmutation_id),
  UNIQUE(catalog_id, slug)
);

-- Tabla de técnicas
CREATE TABLE energy_technique (
  id SERIAL PRIMARY KEY,
  catalog_id INTEGER REFERENCES energy_transmutations_catalog(id),
  technique_id VARCHAR(50) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  instructions TEXT,
  duration_seconds INTEGER,
  min_level INTEGER DEFAULT 1,
  category VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  UNIQUE(catalog_id, technique_id),
  UNIQUE(catalog_id, slug)
);
```

### Migración v1 → v2

1. Crear tablas con migraciones
2. Importar JSON a tablas
3. Crear loader alternativo para BD
4. Feature flag para switch (v1 JSON vs v2 BD)
5. UI admin para edición (Studio)

### Funcionalidades v2

- [ ] Editor visual (Studio)
- [ ] Versionado de catálogos
- [ ] A/B testing de transmutaciones
- [ ] Analytics de uso
- [ ] Estrategia `random` con seed

## Checklist de Verificación

- [ ] Feature flag `energy_transmutations_v1` en `on` o `beta`
- [ ] `GET /api/energy/transmutations/bundle?mode_id=rapida` devuelve 5 items
- [ ] `GET /api/energy/transmutations/bundle?mode_id=basica` devuelve 10 items
- [ ] `GET /api/energy/transmutations/bundle?mode_id=profunda` devuelve 25 items
- [ ] `GET /api/energy/transmutations/bundle?mode_id=maestro` devuelve hasta 50 items
- [ ] Para alumno nivel 1, solo transmutaciones `min_level <= 1`
- [ ] Fail-open funciona si JSON corrupto (bundle vacío + logWarn)
- [ ] Tests pasan: `npm test -- tests/energy/transmutations-*.test.js`

## Archivos Relacionados

| Archivo | Descripción |
|---------|-------------|
| `config/energy/transmutations.catalog.v1.json` | Catálogo canónico |
| `src/core/energy/transmutations/catalog-validator.js` | Validador |
| `src/core/energy/transmutations/catalog-loader.js` | Loader + cache |
| `src/core/energy/transmutations/bundle-resolver.js` | Resolver |
| `src/endpoints/api-energy-transmutations.js` | Endpoint REST |
| `src/core/flags/feature-flags.js` | Feature flags |
| `tests/energy/transmutations-validator.test.js` | Tests validador |
| `tests/energy/transmutations-resolver.test.js` | Tests resolver |

---

**Fecha de implementación:** 2025-12-17  
**Versión:** v1  
**Autor:** Sistema



