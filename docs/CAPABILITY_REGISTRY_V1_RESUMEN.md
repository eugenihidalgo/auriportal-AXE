# 📦 Capability Registry v1 - Resumen de Implementación

## ✅ Entregables Completados

### 1. Módulo Core: `src/core/registry/`
- ✅ `screen-template-registry.js` - 8 ScreenTemplates con JSON Schema
- ✅ `step-type-registry.js` - 5 StepTypes con compatibilidad de templates
- ✅ `condition-registry.js` - 3 ConditionTypes con schema de params
- ✅ `event-registry.js` - 7 EventTypes con schema de payload + políticas
- ✅ `pde-resource-registry.js` - Stub inicial de recursos PDE

### 2. Endpoint Admin: `GET /admin/api/registry`
- ✅ Protegido por `requireAdminContext()`
- ✅ Devuelve registry completo filtrado por feature flags
- ✅ Respuesta JSON estructurada con metadata

### 3. Validador: `src/core/recorridos/validate-recorrido-definition.js`
- ✅ Valida estructura base (ids, entry_step_id, steps, edges)
- ✅ Valida screen_template_id y props contra JSON Schema
- ✅ Valida compatibilidad step_type + template
- ✅ Valida edges con conditions y params
- ✅ Valida emit[] con event types y payload
- ✅ Valida resource_id en PDE registry
- ✅ Modo draft (warnings) vs publish (bloquea errores)

### 4. Tests Mínimos Críticos (Jest)
- ✅ Tests de registries (15 tests, todos pasan)
- ✅ Tests del validador (15 tests, todos pasan)
- ✅ Ejemplo completo: "Limpieza Energética Diaria"

### 5. Observabilidad
- ✅ Logs estructurados con prefijo `[Registry]` y `[RecorridoValidator]`
- ✅ Sin spam: solo errores/warnings relevantes

## 📁 Archivos Creados/Modificados

### Nuevos Archivos
```
src/core/registry/
  ├── screen-template-registry.js
  ├── step-type-registry.js
  ├── condition-registry.js
  ├── event-registry.js
  └── pde-resource-registry.js

src/core/recorridos/
  └── validate-recorrido-definition.js

src/endpoints/
  └── admin-registry.js

tests/recorridos/
  ├── registry.test.js
  └── validate-recorrido-definition.test.js

tests/fixtures/
  └── recorrido-limpieza-diaria.json

docs/
  ├── CAPABILITY_REGISTRY_V1.md
  └── CAPABILITY_REGISTRY_V1_RESUMEN.md
```

### Archivos Modificados
```
src/core/flags/feature-flags.js        # Añadidos flags recorridos_registry_v1 y recorridos_editor_v1
src/router.js                           # Añadida ruta /admin/api/registry
package.json                            # Añadidas dependencias ajv y ajv-formats
jest.config.js                          # Corregido coverageThreshold
tests/setup.js                          # Corregido para ES modules
```

## 🚀 Cómo Probar el Endpoint

### 1. Verificar que el servidor está corriendo
```bash
npm start
# o
npm run dev
```

### 2. Autenticarse como Admin y obtener el registry
```bash
# Opción 1: Password en query string
curl "http://localhost:3000/admin/api/registry?password=tu_password_admin" | jq

# Opción 2: Header
curl -H "X-Admin-Password: tu_password_admin" \
     "http://localhost:3000/admin/api/registry" | jq
```

### 3. Respuesta esperada
```json
{
  "version": "v1",
  "timestamp": "2025-01-XX...",
  "screenTemplates": [
    {
      "id": "screen_intro_centered",
      "name": "Pantalla Intro Centrada",
      "description": "...",
      "feature_flag": "on",
      "props_schema": {...}
    },
    ...
  ],
  "stepTypes": [...],
  "conditions": [...],
  "events": [...],
  "pdeResources": [...],
  "metadata": {
    "screenTemplates_count": 8,
    "stepTypes_count": 5,
    "conditions_count": 3,
    "events_count": 7,
    "pdeResources_count": 3
  }
}
```

## 🧪 Cómo Ejecutar Tests

### Todos los tests de recorridos:
```bash
npm test -- tests/recorridos/
```

### Tests específicos:
```bash
# Tests del validador
npm test -- tests/recorridos/validate-recorrido-definition.test.js

# Tests de los registries
npm test -- tests/recorridos/registry.test.js
```

### Resultado esperado:
```
✓ 15 tests pasan (registry.test.js)
✓ 15 tests pasan (validate-recorrido-definition.test.js)
```

## 📝 Ejemplo de RecorridoDefinition Válido

**Archivo completo:** `tests/fixtures/recorrido-limpieza-diaria.json`

**Estructura mínima:**
```json
{
  "id": "limpieza_energetica_diaria",
  "name": "Limpieza Energética Diaria",
  "entry_step_id": "step_intro",
  "steps": {
    "step_intro": {
      "screen_template_id": "screen_intro_centered",
      "step_type": "experience",
      "props": {
        "title": "Bienvenido a tu Limpieza Energética Diaria",
        "subtitle": "Dedica unos minutos a limpiar tu campo energético",
        "button_text": "Comenzar"
      }
    },
    "step_eleccion": {
      "screen_template_id": "screen_choice_cards",
      "step_type": "decision",
      "props": {
        "title": "¿Qué área quieres limpiar hoy?",
        "choices": [
          { "id": "emocional", "label": "Emocional", "description": "..." },
          { "id": "mental", "label": "Mental", "description": "..." },
          { "id": "fisico", "label": "Físico", "description": "..." }
        ]
      }
    },
    "step_practica": {
      "screen_template_id": "screen_practice_timer",
      "step_type": "practice",
      "props": {
        "title": "Practica de Limpieza",
        "instructions": "Respira profundamente...",
        "duration_seconds": 300,
        "show_progress": true
      },
      "emit": [
        {
          "event_type": "practice_completed",
          "payload_template": {
            "recorrido_id": "limpieza_energetica_diaria",
            "step_id": "step_practica",
            "user_id": "{{user_id}}",
            "duration_seconds": 300
          }
        }
      ]
    },
    "step_reflexion": {
      "screen_template_id": "screen_input_short",
      "step_type": "reflection",
      "props": {
        "title": "¿Cómo te sientes ahora?",
        "placeholder": "Describe brevemente...",
        "max_length": 200,
        "required": false
      }
    },
    "step_cierre": {
      "screen_template_id": "screen_outro_summary",
      "step_type": "closure",
      "props": {
        "title": "¡Limpieza completada!",
        "summary_text": "Has dedicado tiempo...",
        "show_completion_badge": true
      }
    }
  },
  "edges": [
    {
      "from_step_id": "step_intro",
      "to_step_id": "step_eleccion",
      "condition": { "type": "always" }
    },
    {
      "from_step_id": "step_eleccion",
      "to_step_id": "step_practica",
      "condition": {
        "type": "field_exists",
        "params": { "field": "choice_id" }
      }
    },
    {
      "from_step_id": "step_practica",
      "to_step_id": "step_reflexion",
      "condition": { "type": "always" }
    },
    {
      "from_step_id": "step_reflexion",
      "to_step_id": "step_cierre",
      "condition": { "type": "always" }
    }
  ]
}
```

## 🔍 Uso del Validador

```javascript
import { validateRecorridoDefinition } from './src/core/recorridos/validate-recorrido-definition.js';

// Modo draft (permite warnings)
const result = validateRecorridoDefinition(definition, { isPublish: false });

if (result.valid) {
  console.log('✅ Válido');
  if (result.warnings.length > 0) {
    console.log('⚠️ Warnings:', result.warnings);
  }
} else {
  console.error('❌ Errores:', result.errors);
}

// Modo publish (bloquea con errores)
const publishResult = validateRecorridoDefinition(definition, { isPublish: true });

if (!publishResult.valid) {
  throw new Error(`No se puede publicar: ${publishResult.errors.join(', ')}`);
}
```

## 📊 Capabilities Disponibles

### ScreenTemplates (8)
1. `screen_intro_centered` - Pantalla intro centrada
2. `screen_choice_cards` - Tarjetas de elección
3. `screen_scale_1_5` - Escala 1-5
4. `screen_input_short` - Input corto
5. `screen_practice_timer` - Práctica con temporizador
6. `screen_toggle_resources` - Toggle de recursos
7. `screen_outro_summary` - Resumen final
8. `screen_media_embed` - Media embed (beta)

### StepTypes (5)
1. `experience` - Experiencia inmersiva
2. `decision` - Decisión del usuario
3. `practice` - Práctica activa
4. `reflection` - Reflexión/input
5. `closure` - Cierre/resumen

### ConditionTypes (3)
1. `always` - Siempre se cumple
2. `field_equals` - Campo igual a valor
3. `field_exists` - Campo existe

### EventTypes (7)
1. `recorrido_started` - Recorrido iniciado
2. `step_viewed` - Paso visualizado
3. `step_completed` - Paso completado
4. `recorrido_completed` - Recorrido completado
5. `recorrido_abandoned` - Recorrido abandonado
6. `practice_completed` - Práctica completada
7. `resource_used` - Recurso utilizado

## 🔧 Feature Flags

- `recorridos_registry_v1`: `'beta'` (disponible en dev/beta)
- `recorridos_editor_v1`: `'off'` (UI aún no implementada)

## ✅ Checklist de Validación

El validador verifica:
- ✅ Estructura base (id, entry_step_id, steps, edges)
- ✅ screen_template_id existe en registry
- ✅ props cumple JSON Schema del template
- ✅ step_type existe y es compatible con template
- ✅ edges usan conditionType existente
- ✅ condition params válidos según schema
- ✅ emit[] usa eventType existente
- ✅ resource_id existe en PDE registry (si aplica)
- ✅ entry_step_id existe en steps

## 🚨 Errores Típicos Detectados

1. **Template inexistente**: `screen_template_id "X" no existe`
2. **Props inválidas**: `props.title debe ser string (requerido)`
3. **Edge a step inexistente**: `to_step_id "X" no existe en steps`
4. **Condition params inválidos**: `condition.params.value es requerido`
5. **Event payload inválido**: `event_type "X" no existe`
6. **Resource_id inexistente**: `resource_id "X" no existe en PDE registry`

## 📚 Documentación Completa

Ver `docs/CAPABILITY_REGISTRY_V1.md` para documentación detallada.

---

**Implementación completada el:** 2025-01-XX
**Estado:** ✅ Todos los tests pasan
**Feature Flag:** `recorridos_registry_v1: 'beta'`





