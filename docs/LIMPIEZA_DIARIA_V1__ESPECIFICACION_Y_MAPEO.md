# Limpieza Energética Diaria v1 - Especificación y Mapeo

**Versión:** 1.0.0  
**Fecha:** 2025-12-17  
**Estado:** ESPECIFICACIÓN PARA IMPLEMENTAR

---

## 🎯 Objetivo

Definir el primer flujo completo **canónico** del recorrido "Limpieza Energética Diaria" usando los handlers existentes y sin crear nuevas tablas.

---

## 📊 Diagrama de Flujo (9 Steps)

```
┌─────────────────────────────────────────────────────────────────┐
│                      LIMPIEZA ENERGÉTICA DIARIA v1              │
└─────────────────────────────────────────────────────────────────┘

     ┌─────────────────────────┐
     │  STEP 1                 │
     │  seleccion_tipo_limpieza│  ← screen_choice
     │  (Rápida/Básica/        │     Guarda: tipo_limpieza
     │   Profunda/Maestro)     │
     └───────────┬─────────────┘
                 │
     ┌───────────▼─────────────┐
     │  STEP 2                 │
     │  preparacion_seleccion  │  ← selection_handler_v1
     │  (Checklist de          │     Fuente: catálogo preparations
     │   preparaciones)        │     Guarda: preparacion_selected[]
     └───────────┬─────────────┘
                 │
     ┌───────────▼─────────────┐
     │  STEP 3                 │
     │  preparacion_practica   │  ← practice_timer_handler_v1
     │  (Timer con prácticas   │     Lee: preparacion_selected[]
     │   seleccionadas)        │     Guarda: preparacion_practica_completed
     └───────────┬─────────────┘
                 │
     ┌───────────▼─────────────┐
     │  STEP 4                 │
     │  protecciones_energetica│  ← selection_handler_v1
     │  (Checklist de          │     Fuente: catálogo protections
     │   protecciones)         │     Guarda: protecciones_selected[]
     └───────────┬─────────────┘
                 │
     ┌───────────▼─────────────┐
     │  STEP 5                 │
     │  limpieza_energetica    │  ← limpieza_energetica_handler
     │  ⚡ ÚNICO PUNTO RACHA   │     Lee: tipo_limpieza
     │  (Transmutaciones +     │     Ejecuta: checkDailyStreak()
     │   Técnicas)             │     Guarda: streak_result
     └───────────┬─────────────┘
                 │
     ┌───────────▼─────────────┐
     │  STEP 6                 │
     │  transicion_racha       │  ← screen_text
     │  (Muestra racha         │     Lee: streak_result
     │   actualizada)          │
     └───────────┬─────────────┘
                 │
     ┌───────────▼─────────────┐
     │  STEP 7                 │
     │  post_limpieza_seleccion│  ← selection_handler_v1
     │  (Checklist post-       │     Fuente: catálogo post_practices
     │   práctica)             │     Guarda: post_limpieza_selected[]
     └───────────┬─────────────┘
                 │
     ┌───────────▼─────────────┐
     │  STEP 8                 │
     │  post_limpieza_practica │  ← practice_timer_handler_v1
     │  (Timer con prácticas   │     Lee: post_limpieza_selected[]
     │   post seleccionadas)   │     Guarda: post_limpieza_practica_completed
     └───────────┬─────────────┘
                 │
     ┌───────────▼─────────────┐
     │  STEP 9                 │
     │  cierre                 │  ← screen_outro_summary
     │  (Felicidades +         │     Botón: Volver al inicio
     │   Volver al inicio)     │
     └─────────────────────────┘
```

---

## 📋 Mapa Detallado de Steps

### STEP 1: `seleccion_tipo_limpieza`

| Atributo | Valor |
|----------|-------|
| **ID** | `seleccion_tipo_limpieza` |
| **Template** | `screen_choice` |
| **Handler** | Ninguno (capture declarativo) |
| **step_type** | `decision` |

**Props:**
```json
{
  "title": "Limpieza Energética Diaria",
  "question": "¿Qué tipo de limpieza quieres hacer hoy?",
  "choices": [
    {
      "choice_id": "rapida",
      "label": "🌀 Limpieza Rápida",
      "description": "5-10 minutos. Ideal para días ocupados.",
      "estimated_minutes": 5
    },
    {
      "choice_id": "basica",
      "label": "✨ Limpieza Básica",
      "description": "15-20 minutos. Práctica diaria recomendada.",
      "estimated_minutes": 15
    },
    {
      "choice_id": "profunda",
      "label": "🔮 Limpieza Profunda",
      "description": "30-45 minutos. Para días con más tiempo.",
      "estimated_minutes": 30
    },
    {
      "choice_id": "maestro",
      "label": "👑 Limpieza Maestro",
      "description": "60+ minutos. Sesión completa de sanación.",
      "estimated_minutes": 60
    }
  ]
}
```

**Capture:**
```json
{
  "tipo_limpieza": "choice_id"
}
```

**State después:** `{ tipo_limpieza: "basica" }`

---

### STEP 2: `preparacion_seleccion`

| Atributo | Valor |
|----------|-------|
| **ID** | `preparacion_seleccion` |
| **Template** | `screen_toggle_resources` |
| **Handler** | `selection_handler_v1` |
| **step_type** | `selection` |

**Props (desde handler):**
```json
{
  "title": "Preparación para la Práctica",
  "selection_source": "preparacion",
  "selection_label": "Recursos de Preparación",
  "selection_description": "Selecciona las prácticas preparatorias",
  "ui_hints": {
    "show_checklist": true,
    "allow_multi_select": true,
    "show_duration": true
  }
}
```

**Límites sugeridos por tipo:**
| tipo_limpieza | Recomendados | Máximo |
|---------------|--------------|--------|
| rapida | 2 | 3 |
| basica | 4 | 6 |
| profunda | 6 | 8 |
| maestro | 8 | 10 |

**Input esperado:**
```json
{
  "selected_items": ["respiracion_consciente", "enraizamiento"],
  "selection_source": "preparacion"
}
```

**State después:**
```json
{
  "tipo_limpieza": "basica",
  "preparacion_selected": ["respiracion_consciente", "enraizamiento"],
  "preparacion_timestamp": "2025-12-17T13:00:00Z"
}
```

---

### STEP 3: `preparacion_practica`

| Atributo | Valor |
|----------|-------|
| **ID** | `preparacion_practica` |
| **Template** | `screen_practice_timer` |
| **Handler** | `practice_timer_handler_v1` |
| **step_type** | `practice` |

**Props (enriquecidas por handler):**
```json
{
  "title": "Prácticas de Preparación",
  "instructions": "Realiza las siguientes prácticas:\n• Respiración consciente\n• Enraizamiento",
  "duration_seconds": 300,
  "declared_duration_minutes": 5,
  "practices": [
    { "id": "respiracion_consciente", "label": "Respiración consciente", "duration_minutes": 3 },
    { "id": "enraizamiento", "label": "Enraizamiento", "duration_minutes": 2 }
  ],
  "show_progress": true,
  "allow_pause": true,
  "ui_hints": {
    "show_timer": true,
    "show_practice_list": true,
    "timer_style": "countdown",
    "allow_early_complete": true
  }
}
```

**Input esperado:**
```json
{
  "practice_completed": true,
  "duration_real_minutes": 4.5
}
```

**State después:**
```json
{
  "...estado anterior...",
  "preparacion_practica_completed": true,
  "preparacion_practica_timestamp": "2025-12-17T13:05:00Z",
  "preparacion_duration_real_minutes": 4.5
}
```

---

### STEP 4: `protecciones_energeticas`

| Atributo | Valor |
|----------|-------|
| **ID** | `protecciones_energeticas` |
| **Template** | `screen_toggle_resources` |
| **Handler** | `selection_handler_v1` |
| **step_type** | `selection` |

**Props (desde handler):**
```json
{
  "title": "Protecciones Energéticas",
  "selection_source": "protecciones",
  "selection_label": "Protecciones Energéticas",
  "selection_description": "Activa las protecciones que desees",
  "ui_hints": {
    "show_checklist": true,
    "allow_multi_select": true
  }
}
```

**Por defecto:** Se muestran las 3 primeras protecciones marcadas como default.

**Input esperado:**
```json
{
  "selected_items": ["escudo_luz", "manto_protector", "cierre_campo"],
  "selection_source": "protecciones"
}
```

**State después:**
```json
{
  "...estado anterior...",
  "protecciones_selected": ["escudo_luz", "manto_protector", "cierre_campo"],
  "protecciones_timestamp": "2025-12-17T13:06:00Z"
}
```

---

### STEP 5: `limpieza_energetica` ⚡ ÚNICO PUNTO DE RACHA

| Atributo | Valor |
|----------|-------|
| **ID** | `limpieza_energetica` |
| **Template** | `screen_toggle_resources` (o custom) |
| **Handler** | `limpieza_energetica_handler` |
| **step_type** | `practice` |

**Props (enriquecidas por handler):**
```json
{
  "title": "Limpieza Energética",
  "mode_id": "basica",
  "mode_label": "Limpieza Básica",
  "transmutation_bundle": {
    "mode": { "id": "basica", "label": "Limpieza Básica" },
    "transmutations": [
      { "id": "trans_1", "label": "Transmutación 1", "category": "emocional" },
      { "id": "trans_2", "label": "Transmutación 2", "category": "mental" }
    ],
    "techniques": [
      { "id": "tecnica_1", "name": "Técnica A", "description": "..." }
    ]
  },
  "total_transmutations": 10,
  "ui_hints": {
    "show_checklist": true,
    "show_counter": true,
    "allow_partial_completion": false,
    "show_techniques": true
  }
}
```

**Cantidad de transmutaciones por tipo:**
| tipo_limpieza | Transmutaciones |
|---------------|-----------------|
| rapida | 5 |
| basica | 10 |
| profunda | 20 |
| maestro | 40 |

**Input esperado:**
```json
{
  "limpieza_completada": true,
  "transmutations_done": ["trans_1", "trans_2", "..."],
  "mode_id": "basica"
}
```

**Validación:**
- `limpieza_completada` === `true`
- `transmutations_done.length` >= 1

**Lógica especial:**
```javascript
// SOLO si limpieza_completada === true Y hay transmutaciones:
await checkDailyStreak(student, env, { forcePractice: true });
```

**State después:**
```json
{
  "...estado anterior...",
  "limpieza_completada": true,
  "transmutations_done": ["trans_1", "trans_2", "..."],
  "mode_id": "basica",
  "limpieza_timestamp": "2025-12-17T13:20:00Z",
  "streak_result": {
    "todayPracticed": true,
    "streak": 15,
    "motivationalPhrase": "¡15 días seguidos! 🔥"
  }
}
```

---

### STEP 6: `transicion_racha`

| Atributo | Valor |
|----------|-------|
| **ID** | `transicion_racha` |
| **Template** | `screen_text` |
| **Handler** | Ninguno |
| **step_type** | `experience` |

**Props:**
```json
{
  "title": "¡Limpieza Completada!",
  "subtitle": "Tu racha sigue creciendo",
  "body": "Has completado {{state.streak_result.streak}} días consecutivos de práctica.\n\n{{state.streak_result.motivationalPhrase}}"
}
```

**Nota:** El runtime resuelve `{{state.xxx}}` automáticamente.

**State:** No modifica state.

---

### STEP 7: `post_limpieza_seleccion`

| Atributo | Valor |
|----------|-------|
| **ID** | `post_limpieza_seleccion` |
| **Template** | `screen_toggle_resources` |
| **Handler** | `selection_handler_v1` |
| **step_type** | `selection` |

**Props (desde handler):**
```json
{
  "title": "Prácticas de Integración",
  "selection_source": "post_limpieza",
  "selection_label": "Prácticas de Integración",
  "selection_description": "Selecciona las prácticas de cierre"
}
```

**Input esperado:**
```json
{
  "selected_items": ["sellado_energetico", "agradecimiento"],
  "selection_source": "post_limpieza"
}
```

**State después:**
```json
{
  "...estado anterior...",
  "post_limpieza_selected": ["sellado_energetico", "agradecimiento"],
  "post_limpieza_timestamp": "2025-12-17T13:21:00Z"
}
```

---

### STEP 8: `post_limpieza_practica`

| Atributo | Valor |
|----------|-------|
| **ID** | `post_limpieza_practica` |
| **Template** | `screen_practice_timer` |
| **Handler** | `practice_timer_handler_v1` |
| **step_type** | `practice` |

**Props (enriquecidas por handler):**
```json
{
  "title": "Prácticas de Integración",
  "instructions": "Realiza las siguientes prácticas:\n• Sellado energético\n• Agradecimiento",
  "duration_seconds": 180,
  "practices": [
    { "id": "sellado_energetico", "label": "Sellado energético", "duration_minutes": 2 },
    { "id": "agradecimiento", "label": "Agradecimiento", "duration_minutes": 1 }
  ]
}
```

**Input esperado:**
```json
{
  "practice_completed": true,
  "duration_real_minutes": 3.0
}
```

**State después:**
```json
{
  "...estado anterior...",
  "post_limpieza_practica_completed": true,
  "post_limpieza_practica_timestamp": "2025-12-17T13:25:00Z",
  "post_limpieza_duration_real_minutes": 3.0
}
```

---

### STEP 9: `cierre`

| Atributo | Valor |
|----------|-------|
| **ID** | `cierre` |
| **Template** | `screen_outro_summary` |
| **Handler** | Ninguno |
| **step_type** | `closure` |

**Props:**
```json
{
  "title": "¡Felicidades! 🎉",
  "summary_text": "Has completado tu Limpieza Energética Diaria.\n\nRacha actual: {{state.streak_result.streak}} días\n\nRecuerda que esta práctica diaria te ayuda a mantener tu campo energético limpio y tu vibración elevada.",
  "show_completion_badge": true,
  "next_action_text": "Volver al inicio"
}
```

**Eventos emitidos:**
```json
{
  "emit": [
    {
      "event_type": "recorrido_completed",
      "payload_template": {
        "recorrido_id": "{{recorrido_id}}",
        "user_id": "{{user_id}}",
        "tipo_limpieza": "{{state.tipo_limpieza}}",
        "streak": "{{state.streak_result.streak}}"
      }
    }
  ]
}
```

---

## 📐 Edges (Transiciones)

```json
{
  "edges": [
    {
      "from_step_id": "seleccion_tipo_limpieza",
      "to_step_id": "preparacion_seleccion",
      "condition": { "type": "always" }
    },
    {
      "from_step_id": "preparacion_seleccion",
      "to_step_id": "preparacion_practica",
      "condition": { "type": "always" }
    },
    {
      "from_step_id": "preparacion_practica",
      "to_step_id": "protecciones_energeticas",
      "condition": { "type": "always" }
    },
    {
      "from_step_id": "protecciones_energeticas",
      "to_step_id": "limpieza_energetica",
      "condition": { "type": "always" }
    },
    {
      "from_step_id": "limpieza_energetica",
      "to_step_id": "transicion_racha",
      "condition": { "type": "always" }
    },
    {
      "from_step_id": "transicion_racha",
      "to_step_id": "post_limpieza_seleccion",
      "condition": { "type": "always" }
    },
    {
      "from_step_id": "post_limpieza_seleccion",
      "to_step_id": "post_limpieza_practica",
      "condition": { "type": "always" }
    },
    {
      "from_step_id": "post_limpieza_practica",
      "to_step_id": "cierre",
      "condition": { "type": "always" }
    }
  ]
}
```

**Nota:** Este flujo es lineal (sin branching). El branching por `tipo_limpieza` se maneja en los handlers, no en edges.

---

## 🔢 Resumen de State Final

Al completar el recorrido, el `state_json` contiene:

```json
{
  "tipo_limpieza": "basica",
  
  "preparacion_selected": ["respiracion_consciente", "enraizamiento"],
  "preparacion_timestamp": "2025-12-17T13:00:00Z",
  
  "preparacion_practica_completed": true,
  "preparacion_practica_timestamp": "2025-12-17T13:05:00Z",
  "preparacion_duration_real_minutes": 4.5,
  
  "protecciones_selected": ["escudo_luz", "manto_protector"],
  "protecciones_timestamp": "2025-12-17T13:06:00Z",
  
  "limpieza_completada": true,
  "transmutations_done": ["trans_1", "trans_2", "..."],
  "mode_id": "basica",
  "limpieza_timestamp": "2025-12-17T13:20:00Z",
  
  "streak_result": {
    "todayPracticed": true,
    "streak": 15,
    "motivationalPhrase": "¡15 días seguidos! 🔥"
  },
  
  "post_limpieza_selected": ["sellado_energetico", "agradecimiento"],
  "post_limpieza_timestamp": "2025-12-17T13:21:00Z",
  
  "post_limpieza_practica_completed": true,
  "post_limpieza_practica_timestamp": "2025-12-17T13:25:00Z",
  "post_limpieza_duration_real_minutes": 3.0
}
```

---

## ⚡ Punto de Éxito (Racha)

**ÚNICO LUGAR DONDE SE INCREMENTA LA RACHA:**

```
STEP 5: limpieza_energetica
└── limpieza_energetica_handler.handlePostSubmit()
    └── checkDailyStreak(student, env, { forcePractice: true })
```

**Condiciones para incrementar racha:**
1. `input.limpieza_completada === true`
2. `input.transmutations_done.length >= 1`

**Si no se cumplen:** El recorrido continúa pero NO se incrementa la racha.

---

## 🧪 Verificación Manual

### Validar Draft

```bash
curl -X POST http://localhost:3000/admin/api/recorridos/limpieza_energetica_diaria_v1/validate \
  -H "Content-Type: application/json" \
  -H "Cookie: auriportal_session=ADMIN_COOKIE"
```

### Publicar

```bash
curl -X POST http://localhost:3000/admin/api/recorridos/limpieza_energetica_diaria_v1/publish \
  -H "Content-Type: application/json" \
  -H "Cookie: auriportal_session=ADMIN_COOKIE" \
  -d '{"release_notes": "Versión 1.0 - Flujo completo de 9 steps"}'
```

### Probar Flujo (Alumno)

```bash
# 1. Iniciar run
curl -X POST http://localhost:3000/api/recorridos/limpieza_energetica_diaria_v1/start \
  -H "Cookie: auriportal_session=ALUMNO_COOKIE"

# 2. Obtener step actual
curl http://localhost:3000/api/recorridos/run/{run_id}/current \
  -H "Cookie: auriportal_session=ALUMNO_COOKIE"

# 3. Completar step
curl -X POST http://localhost:3000/api/recorridos/run/{run_id}/submit \
  -H "Content-Type: application/json" \
  -H "Cookie: auriportal_session=ALUMNO_COOKIE" \
  -d '{"step_id": "seleccion_tipo_limpieza", "input": {"choice_id": "basica"}}'
```

---

## 📁 Archivos Relacionados

| Archivo | Propósito |
|---------|-----------|
| `src/core/recorridos/step-handlers/selection-handler.js` | Handler selección |
| `src/core/recorridos/step-handlers/practice-timer-handler.js` | Handler timer |
| `src/core/recorridos/step-handlers/limpieza-energetica-handler.js` | Handler racha |
| `src/core/pde/catalogs/preparations-resolver.js` | Catálogo preparaciones |
| `src/core/pde/catalogs/post-practices-resolver.js` | Catálogo post-práctica |
| `src/core/pde/catalogs/protections-resolver.js` | Catálogo protecciones |
| `src/core/energy/transmutations/bundle-resolver.js` | Catálogo transmutaciones |
| `src/modules/streak.js` | Lógica de racha |

---

## 🔮 Gaps Identificados para el Editor

Para soportar cómodamente este flujo en el editor:

1. **UI de selección de `tipo_limpieza`**: El editor necesita mostrar cómo el `tipo_limpieza` afecta a steps posteriores (sin hardcodear).

2. **Límites por modo**: Los límites de items recomendados (rápida=2, básica=4, etc.) están en handlers, no en definición declarativa.

3. **Preview de timer**: No hay forma de previsualizar cómo se verá el timer con las prácticas seleccionadas.

4. **Visualización de flujo**: El editor muestra árbol de edges pero no indica qué steps usan handlers especiales.

5. **Detección de orphans**: No hay validación que detecte steps sin edges entrantes (excepto entry_step_id).

---

**Documento generado:** 2025-12-17  
**Autor:** Sistema AuriPortal




