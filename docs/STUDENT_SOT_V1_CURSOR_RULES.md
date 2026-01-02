# STUDENT_SOT_V1_CURSOR_RULES.md — Reglas Constitucionales para Cursor

**Versión**: v1  
**Fecha**: 2025-01-XX

---

## Reglas Constitucionales Añadidas

Estas reglas deben añadirse al archivo de reglas constitucionales de Cursor (`.cursorrules` o equivalente).

---

### 1. student-sot-first

```yaml
- id: student-sot-first
  title: Student SOT como única fuente de verdad
  content: >
    Toda funcionalidad que dependa del alumno debe consumir SIEMPRE buildStudentContext() (Student Context Contract v1).
    Prohibido leer tablas de alumno directamente desde endpoints/UI/automatizaciones.
    El Student Context Builder es la única forma canónica de obtener datos del alumno.
```

---

### 2. student-capabilities-gate

```yaml
- id: student-capabilities-gate
  title: Capabilities como gate obligatorio
  content: >
    Cualquier acción (progreso, rachas, automatizaciones, activación de contextos, resolvers) debe estar gateada por capabilities.
    Prohibido usar ifs ad-hoc; usar Student Capability Registry/Resolver.
    Verificar capabilities ANTES de ejecutar acciones, no después.
```

---

### 3. student-operational-state-pause

```yaml
- id: student-operational-state-pause
  title: PAUSED como estado operativo configurable
  content: >
    PAUSED es estado operativo derivado de suscripción y se configura vía pause_profiles.
    En PAUSED se congela el progreso/nivel efectivo y rachas según effects.
    Prohibido hardcodear "paused = no hacer X" fuera del resolver de capabilities.
    Usar pause_profiles para definir efectos, no lógica ad-hoc.
```

---

### 4. student-coherence-required

```yaml
- id: student-coherence-required
  title: Coherencia obligatoria en Student Context
  content: >
    buildStudentContext debe incluir coherence.status y issues. Si DEGRADED/BROKEN, el sistema debe degradar conscientemente (fail-open seguro).
    Verificar coherence.status ANTES de permitir escrituras peligrosas.
    DEGRADED permite lectura pero bloquea escrituras. BROKEN bloquea casi todo excepto acciones del Master.
```

---

### 5. student-signals-registered

```yaml
- id: student-signals-registered
  title: Solo señales registradas
  content: >
    Solo se emiten señales registradas en Student Signal Registry v1; las automatizaciones deben consumir señales registradas.
    Prohibido emitir señales ad-hoc. Prohibido consumir señales no registradas.
    Usar emitStudentSignal() del Student Signal Emitter.
```

---

### 6. student-extension-slots-only

```yaml
- id: student-extension-slots-only
  title: Extension slots solo para metadatos
  content: >
    Los extension slots (meta, feature_flags, experiments) NO contienen lógica core.
    Solo inputs para capabilities/automatizaciones.
    Prohibido usar extension slots para estados críticos o lógica de negocio.
```

---

## Checklist Constitucional Actualizado

El checklist constitucional debe exigir:

1. ✅ Migración aplicada y verificada
2. ✅ Repos con contratos implementados
3. ✅ Servicios con lógica de negocio
4. ✅ Endpoints que consumen buildStudentContext
5. ✅ Capabilities verificadas antes de acciones
6. ✅ Coherencia verificada antes de escrituras
7. ✅ Señales registradas y emitidas correctamente
8. ✅ UI solo cuando toque (no en fase core)

---

## Referencias

- `docs/STUDENT_SOT_V1_CERTIFIED.md`
- `docs/STUDENT_CAPABILITY_REGISTRY_V1.md`
- `docs/STUDENT_SIGNAL_REGISTRY_V1.md`
- `docs/STUDENT_COHERENCE_CHECKER_V1.md`
- `docs/STUDENT_CONTEXT_CONTRACT_V1.md`
- `docs/STUDENT_EXTENSION_SLOTS_V1.md`


