# STUDENT_EXTENSION_SLOTS_V1.md — Slots Extensibles del Alumno

**Versión**: v1  
**Fecha**: 2025-01-XX

---

## 1. Propósito

Los Student Extension Slots v1 permiten añadir metadatos, flags y experimentos al alumno **sin refactor destructivo**.

**PRINCIPIO**: Extension slots NO contienen lógica core. Solo inputs para capabilities/automatizaciones.

---

## 2. Slots Disponibles

### 2.1 `meta` (JSONB)

Metadatos generales extensibles:
- Uso libre para almacenar información adicional
- No afecta lógica core
- Ejemplo: `{ "custom_field": "value", "notes": "..." }`

### 2.2 `feature_flags` (JSONB)

Flags de funcionalidad:
- Control de features por alumno
- No afecta lógica core
- Ejemplo: `{ "new_ui_enabled": true, "beta_features": false }`

### 2.3 `experiments` (JSONB)

Experimentos A/B:
- Asignación de variantes de experimentos
- No afecta lógica core
- Ejemplo: `{ "experiment_variant_a": true, "experiment_variant_b": false }`

---

## 3. Uso en Repositorio

```javascript
import { getDefaultStudentOntologicalRepo } from '../infra/repos/student-ontological-repo-pg.js';

const repo = getDefaultStudentOntologicalRepo();

// Obtener meta
const meta = await repo.getMeta(studentId);
// { custom_field: "value" }

// Establecer meta (merge)
await repo.setMeta(studentId, { new_field: "new_value" });
// meta ahora es { custom_field: "value", new_field: "new_value" }

// Obtener feature flags
const flags = await repo.getFeatureFlags(studentId);
// { new_ui_enabled: true }

// Establecer feature flags (merge)
await repo.setFeatureFlags(studentId, { beta_features: true });
// flags ahora es { new_ui_enabled: true, beta_features: true }

// Obtener experiments
const experiments = await repo.getExperiments(studentId);
// { experiment_variant_a: true }

// Establecer experiments (merge)
await repo.setExperiments(studentId, { experiment_variant_b: true });
// experiments ahora es { experiment_variant_a: true, experiment_variant_b: true }
```

---

## 4. Índices

Se crean índices GIN para búsquedas eficientes en JSONB:
- `idx_students_meta_gin`
- `idx_students_feature_flags_gin`
- `idx_students_experiments_gin`

---

## 5. Reglas

### 5.1 No Lógica Core

Los extension slots NO deben contener:
- Lógica de negocio crítica
- Estados que afecten el comportamiento core
- Datos que deban estar en tablas dedicadas

### 5.2 Solo Inputs

Los extension slots son inputs para:
- Capabilities (p.ej., `feature_flags.new_ui_enabled` puede afectar `can_access_student_portal`)
- Automatizaciones (p.ej., `experiments.variant_a` puede afectar qué automatización se ejecuta)
- UIs (p.ej., `meta.custom_field` puede mostrarse en la UI)

---

## 6. Migración

La migración `v5.44.0-student-extension-slots.sql` añade las columnas si no existen (idempotente).

---

## 7. Extensión

Para añadir nuevos slots:
1. Crear migración SQL
2. Añadir métodos al contrato del repo
3. Implementar en repo PostgreSQL
4. Documentar en este archivo


