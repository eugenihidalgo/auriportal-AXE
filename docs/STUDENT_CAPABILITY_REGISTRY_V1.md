# STUDENT_CAPABILITY_REGISTRY_V1.md — Registry Canónico de Capabilities del Alumno

**Versión**: v1  
**Fecha**: 2025-01-XX

---

## 1. Principio Fundamental

El Student Capability Registry v1 es la **única fuente de verdad** para qué capabilities existen en el sistema y cómo se comportan.

**REGLA CONSTITUCIONAL**: Solo se pueden usar capabilities registradas. Prohibido crear capabilities ad-hoc en el código.

---

## 2. Arquitectura

### 2.1 Registry (`student-capability-registry.js`)

Define todas las capabilities permitidas con:
- `key`: Clave única
- `description`: Qué permite esta capability
- `default`: Valor por defecto (si no hay restricciones)
- `version`: Versión de la definición
- `deprecated`: Versión en que fue deprecada (null si activa)
- `category`: Categoría semántica

### 2.2 Resolver (`student-capability-resolver.js`)

Calcula las capabilities SOLO desde inputs de `buildStudentContext`:
- `student.status` (NORMAL/DEGRADED/BROKEN)
- `operational_state` (ACTIVE/PAUSED/SUSPENDED)
- `pause_profile.effects`
- `product membership`
- `coherence issues`

---

## 3. Capabilities Registradas v1

### 3.1 Progress & Level
- `can_progress`: Permite avanzar en progreso general
- `can_compute_level`: Permite calcular/actualizar nivel efectivo

### 3.2 Streaks
- `can_update_streaks`: Permite actualizar rachas

### 3.3 Automations
- `can_trigger_automations`: Permite ejecutar automatizaciones

### 3.4 Contexts
- `can_activate_contexts`: Permite activar nuevos contextos
- `can_run_resolvers`: Permite ejecutar resolvers

### 3.5 Access
- `can_access_student_portal`: Permite acceso al portal del alumno
- `can_receive_notifications`: Permite enviar notificaciones

### 3.6 Write Operations
- `can_write_domain_state`: Permite modificar estado en dominios

### 3.7 Admin/Master
- `can_master_override`: Permite overrides del Master

---

## 4. Reglas de Resolución

### 4.1 PAUSED
- Si `pause_profile.effects.level_progression === 'freeze'` → `can_progress = false`, `can_compute_level = false`
- Si `pause_profile.effects.streaks === 'freeze'` → `can_update_streaks = false`
- Si `pause_profile.effects.contexts === 'block_new'` → `can_activate_contexts = false`
- Si `pause_profile.effects.automations === 'block_progression'` → `can_trigger_automations = false`

### 4.2 SUSPENDED
- Bloquea todo excepto lectura y notificaciones

### 4.3 DEGRADED
- Bloquea escrituras peligrosas (fail-open seguro: permite lectura)

### 4.4 BROKEN
- Bloquea casi todo excepto acciones del Master

### 4.5 Sin Membresía Activa
- Bloquea acceso al portal y escrituras

---

## 5. Uso en el Sistema

### 5.1 En Automatizaciones
```javascript
const context = await buildStudentContext(studentId, productKey);
if (!hasCapability(context, 'can_trigger_automations')) {
  return; // No ejecutar automatización
}
```

### 5.2 En Contextos
```javascript
const context = await buildStudentContext(studentId, productKey);
if (!hasCapability(context, 'can_activate_contexts')) {
  throw new Error('No se pueden activar nuevos contextos');
}
```

### 5.3 En Motor de Progreso
```javascript
const context = await buildStudentContext(studentId, productKey);
if (!hasCapability(context, 'can_progress')) {
  return; // Congelar progreso
}
```

---

## 6. Versionado y Deprecación

- Las capabilities se versionan con `version: 'v1'`
- Para deprecar: `deprecated: 'v2'` (cuando se deprecó)
- El resolver ignora capabilities deprecadas

---

## 7. Extensión

Para añadir nuevas capabilities:
1. Añadir entrada en `STUDENT_CAPABILITY_REGISTRY`
2. Definir `default` apropiado
3. Ajustar `resolveStudentCapabilities` si necesita lógica especial
4. Documentar en este archivo


