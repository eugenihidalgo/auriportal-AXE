# Capability Registry v1 - Editor de Recorridos

## 📋 Resumen

Sistema "registry" (catálogo de capacidades) para que el Admin Editor pueda descubrir y validar:
- **ScreenTemplates** (UI templates) con JSON Schema de props
- **StepTypes** (acto pedagógico) con compatibilidad de templates + validaciones extra
- **ConditionTypes** (condiciones declarativas) con schema de params + evaluación determinista
- **EventTypes** (analíticas + dominio) con schema de payload + políticas
- **PDE Resources registry** (resource_id existentes + metadata mínima)

## 🏗️ Arquitectura

- **Node.js + PostgreSQL**: Siguiendo la columna vertebral del proyecto
- **NO DB direct access**: Los registries son puros (sin acceso a DB)
- **Autenticación central**: `requireAdminContext()` para endpoints admin
- **Cambios incrementales**: Feature flags para control de visibilidad
- **Fail-open controlado**: Runtime permite warnings, pero publish valida duro

## 📁 Archivos Creados/Modificados

### Registries (src/core/registry/)
- `screen-template-registry.js` - 8 ScreenTemplates v1
- `step-type-registry.js` - 5 StepTypes v1
- `condition-registry.js` - 3 ConditionTypes v1
- `event-registry.js` - 7 EventTypes v1
- `pde-resource-registry.js` - Stub inicial de recursos PDE

### Validador (src/core/recorridos/)
- `validate-recorrido-definition.js` - Validador completo de RecorridoDefinition

### Endpoint Admin (src/endpoints/)
- `admin-registry.js` - GET /admin/api/registry

### Tests (tests/recorridos/)
- `validate-recorrido-definition.test.js` - Tests del validador
- `registry.test.js` - Tests de los registries

### Fixtures (tests/fixtures/)
- `recorrido-limpieza-diaria.json` - Ejemplo de RecorridoDefinition válido

### Configuración
- `src/core/flags/feature-flags.js` - Añadidos flags `recorridos_registry_v1` y `recorridos_editor_v1`
- `src/router.js` - Añadida ruta `/admin/api/registry`
- `package.json` - Añadidas dependencias `ajv` y `ajv-formats`

## 🚀 Cómo Probar el Endpoint

### 1. Verificar Feature Flag

El registry está activo cuando `recorridos_registry_v1` está en `'beta'` o `'on'` (por defecto: `'beta'`).

```bash
# Verificar en código
grep "recorridos_registry_v1" src/core/flags/feature-flags.js
```

### 2. Autenticarse como Admin

El endpoint requiere autenticación admin. Usa el sistema de autenticación existente:

```bash
# Opción 1: Password en query string
curl "http://localhost:3000/admin/api/registry?password=tu_password_admin"

# Opción 2: Header
curl -H "X-Admin-Password: tu_password_admin" \
     "http://localhost:3000/admin/api/registry"
```

### 3. Obtener el Registry

```bash
curl -H "X-Admin-Password: tu_password_admin" \
     "http://localhost:3000/admin/api/registry" | jq
```

**Respuesta esperada:**
```json
{
  "version": "v1",
  "timestamp": "2025-01-XX...",
  "screenTemplates": [...],
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

### Ejecutar todos los tests de recorridos:
```bash
npm test -- tests/recorridos/
```

### Ejecutar tests específicos:
```bash
# Tests del validador
npm test -- tests/recorridos/validate-recorrido-definition.test.js

# Tests de los registries
npm test -- tests/recorridos/registry.test.js
```

### Ejecutar con cobertura:
```bash
npm run test:coverage -- tests/recorridos/
```

## 📝 Ejemplo de RecorridoDefinition Válido

Ver archivo completo: `tests/fixtures/recorrido-limpieza-diaria.json`

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
        "title": "Bienvenido",
        "subtitle": "Dedica unos minutos..."
      }
    }
  },
  "edges": [
    {
      "from_step_id": "step_intro",
      "to_step_id": "step_eleccion",
      "condition": {
        "type": "always"
      }
    }
  ]
}
```

## 🔍 Validación de RecorridoDefinition

### Uso básico:
```javascript
import { validateRecorridoDefinition } from './src/core/recorridos/validate-recorrido-definition.js';

const result = validateRecorridoDefinition(definition, { isPublish: false });

if (result.valid) {
  console.log('✅ Válido');
  if (result.warnings.length > 0) {
    console.log('⚠️ Warnings:', result.warnings);
  }
} else {
  console.error('❌ Errores:', result.errors);
}
```

### Validación para Publish (bloquea con errores):
```javascript
const result = validateRecorridoDefinition(definition, { isPublish: true });

if (!result.valid) {
  // No se puede publicar con errores
  throw new Error(`No se puede publicar: ${result.errors.join(', ')}`);
}
```

## 📊 ScreenTemplates Disponibles

1. `screen_intro_centered` - Pantalla de introducción centrada
2. `screen_choice_cards` - Tarjetas de elección
3. `screen_scale_1_5` - Escala de valoración 1-5
4. `screen_input_short` - Campo de texto corto
5. `screen_practice_timer` - Práctica con temporizador
6. `screen_toggle_resources` - Toggle de recursos PDE
7. `screen_outro_summary` - Resumen final
8. `screen_media_embed` - Media embed (beta)

## 📊 StepTypes Disponibles

1. `experience` - Experiencia inmersiva o práctica guiada
2. `decision` - Paso que requiere decisión del usuario
3. `practice` - Práctica activa con temporizador
4. `reflection` - Reflexión o input del usuario
5. `closure` - Cierre o resumen

## 📊 ConditionTypes Disponibles

1. `always` - Siempre se cumple
2. `field_equals` - Campo igual a valor
3. `field_exists` - Campo existe y no es null/undefined

## 📊 EventTypes Disponibles

1. `recorrido_started` - Recorrido iniciado
2. `step_viewed` - Paso visualizado
3. `step_completed` - Paso completado
4. `recorrido_completed` - Recorrido completado
5. `recorrido_abandoned` - Recorrido abandonado
6. `practice_completed` - Práctica completada
7. `resource_used` - Recurso PDE utilizado

## 🔧 Feature Flags

- `recorridos_registry_v1`: Estado `'beta'` (disponible en dev/beta)
- `recorridos_editor_v1`: Estado `'off'` (UI aún no implementada)

## 📝 Observabilidad

Los logs usan el prefijo `[Registry]` y `[RecorridoValidator]`:

```
ℹ️ [REGISTRY] Screen templates obtenidos: 8
ℹ️ [RECORRIDOVALIDATOR] Validación exitosa sin warnings
⚠️ [REGISTRY] Screen template no encontrado: template_inexistente
```

## 🚨 Errores Comunes

### Template inexistente:
```
Error: Step "step_1": screen_template_id "template_inexistente" no existe en el registry
```

### Props inválidas:
```
Error: Step "step_1": props.title debe ser string (requerido)
```

### Edge a step inexistente:
```
Error: Edge: to_step_id "step_inexistente" no existe en steps
```

### Condition params inválidos:
```
Error: Edge (step_1 → step_2): condition.params.value es requerido pero no está presente
```

### Event payload inválido:
```
Error: Step "step_1": emit[].event_type "event_inexistente" no existe en el registry
```

### Resource_id inexistente:
```
Error: Step "step_1": resource_id "resource_inexistente" no existe en el registry PDE
```

## 🔄 Próximos Pasos (Sprint 2+)

- [ ] Implementar UI del editor de recorridos
- [ ] Expandir PDE Resource Registry con consulta a DB
- [ ] Añadir más ScreenTemplates según necesidades
- [ ] Implementar evaluación de condiciones en runtime
- [ ] Sistema de versionado de RecorridoDefinitions
- [ ] Persistencia de recorridos en PostgreSQL

## 📚 Referencias

- JSON Schema: https://json-schema.org/
- Ajv: https://ajv.js.org/
- Feature Flags: `src/core/flags/feature-flags.js`
- Auth Context: `src/core/auth-context.js`















