# Integración Transmutaciones Energéticas v1 en Step limpieza_energetica

## Resumen Ejecutivo

Esta documentación describe la integración del sistema de Transmutaciones Energéticas v1 
en el step `limpieza_energetica` del recorrido `limpieza_energetica_diaria`.

**Fecha de implementación:** 2025-12-17  
**Feature flag:** `energy_transmutations_v1` = `on`  
**Estado del recorrido:** DRAFT (no publicado)

---

## Arquitectura de la Integración

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FLUJO DEL RECORRIDO                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  seleccion_tipo_limpieza → preparacion_seleccion → preparacion      │
│                                                                     │
│  → limpieza_energetica → transicion_racha → post_limpieza           │
│        ▲                       ▲                                    │
│        │                       │                                    │
│   [Handler v1]           [Muestra racha]                            │
│   - Resolver bundle                                                 │
│   - Checklist UI                                                    │
│   - checkDailyStreak()                                              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Componentes Implementados

### 1. Step Handler: `limpieza-energetica-handler.js`

```
src/core/recorridos/step-handlers/limpieza-energetica-handler.js
```

Responsabilidades:
- `enhanceRenderSpec()`: Añade bundle de transmutaciones al renderSpec
- `validateInput()`: Valida input del alumno (limpieza_completada, transmutations_done)
- `handlePostSubmit()`: Ejecuta `checkDailyStreak()` si aplica

**Principios:**
- Fail-open: Si el bundle no se puede resolver, permite continuar
- Solo llama a `checkDailyStreak()` cuando `limpieza_completada === true`
- No crea tablas ni modifica lógica legacy

### 2. Modificación al Runtime: `recorrido-runtime.js`

```
src/core/recorridos/runtime/recorrido-runtime.js
```

Cambios mínimos:
- Import del handler
- Hook en `buildRenderSpec()` para enriquecer con transmutaciones
- Hook en `submitStep()` para ejecutar lógica post-submit

### 3. Template UI: `transmutation-checklist.html`

```
src/core/html/components/transmutation-checklist.html
```

HTML + CSS + JS mínimo para renderizar:
- Checklist de transmutaciones con checkboxes
- Contador visual "X / N completados"
- Botón "Hecho" con validación

### 4. Script de Actualización del Draft

```
scripts/update-step-limpieza-energetica.js
```

Actualiza el step en el draft con:
- Props para la UI de checklist
- Capture correcto (limpieza_completada, transmutations_done, mode_id)

---

## Flujo de Datos

### 1. Al cargar el step (GET /api/recorridos/runs/:run_id)

```javascript
// Runtime
const run = await runRepo.getRunById(run_id);
const mode_id = run.state_json.tipo_limpieza || 'basica';

// Handler enriquece renderSpec
renderSpec.props.transmutation_bundle = resolveTransmutationBundle(studentCtx, mode_id);
// Bundle contiene: { mode, transmutations[], techniques[], meta }
```

### 2. Al completar el step (POST .../submit)

```javascript
// Input del cliente
{
  "limpieza_completada": true,
  "transmutations_done": ["trans_001", "trans_002", "trans_003"],
  "mode_id": "basica"
}

// Handler valida y ejecuta lógica legacy
if (input.limpieza_completada && input.transmutations_done.length > 0) {
  await checkDailyStreak(student, env, { forcePractice: true });
}

// State actualizado para siguiente step
state.limpieza_completada = true;
state.transmutations_done = [...];
state.streak_result = { streak: N, todayPracticed: true, ... };
```

---

## Modos de Limpieza

| mode_id | Label | Máx. Transmutaciones |
|---------|-------|---------------------|
| `rapida` | Limpieza Rápida | 5 |
| `basica` | Limpieza Básica | 10 |
| `profunda` | Limpieza Profunda | 25 |
| `maestro` | Modo Maestro | 50 |

Las transmutaciones se filtran por:
- `is_active === true`
- `min_level <= nivel_alumno`
- Ordenadas por `weight` descendente

---

## Reglas de Negocio

1. **Incremento de racha:**
   - SOLO se ejecuta `checkDailyStreak()` cuando:
     - `step_id === 'limpieza_energetica'`
     - `input.limpieza_completada === true`
     - `input.transmutations_done.length >= 1`

2. **Validación de input:**
   - Si no hay transmutaciones marcadas → `limpieza_completada = false`
   - El alumno NO puede avanzar sin marcar al menos 1 (UI lo bloquea)

3. **Fail-open:**
   - Si el bundle no se puede resolver → mostrar fallback text
   - Si `checkDailyStreak()` falla → continuar sin bloquear

---

## Verificaciones Obligatorias

- [x] NO se crearon tablas nuevas
- [x] NO se tocaron otros steps
- [x] NO se modificó el editor
- [x] Feature flag respetado (`energy_transmutations_v1`)
- [x] Fail-open activo si resolver falla
- [x] El recorrido sigue en DRAFT
- [x] Publish sigue bloqueado por campos obligatorios faltantes

---

## Archivos Modificados/Creados

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `src/core/recorridos/step-handlers/limpieza-energetica-handler.js` | Nuevo | Handler específico del step |
| `src/core/recorridos/runtime/recorrido-runtime.js` | Modificado | Hooks para handler |
| `src/endpoints/recorridos-runtime.js` | Modificado | Pasar env al ctx |
| `src/core/html/components/transmutation-checklist.html` | Nuevo | Template UI |
| `scripts/update-step-limpieza-energetica.js` | Nuevo | Actualizar draft |
| `docs/INTEGRACION_TRANSMUTACIONES_V1.md` | Nuevo | Esta documentación |

---

## Uso

### Ejecutar el script de actualización del draft

```bash
node scripts/update-step-limpieza-energetica.js
```

### Verificar el endpoint

```bash
# Iniciar un run
curl -X POST http://localhost:3000/api/recorridos/limpieza_energetica_diaria/start \
  -H "Cookie: auri_user=..." \
  -H "Content-Type: application/json"

# Obtener step actual (después de llegar a limpieza_energetica)
curl http://localhost:3000/api/recorridos/runs/{run_id} \
  -H "Cookie: auri_user=..."

# La respuesta incluirá:
# step.props.transmutation_bundle
# step.props.ui_config.render_mode = "transmutation_checklist"
```

---

## No Implementado (Pospuesto)

- [ ] Animaciones
- [ ] Modo juego
- [ ] Editor visual nuevo
- [ ] Cambios en navegación
- [ ] Persistencia avanzada por ítem
- [ ] A/B testing de transmutaciones

---

## Siguiente Paso: Step transicion_racha

El step `transicion_racha` ya existe y usa los datos calculados:

```javascript
// En el step transicion_racha
const streakResult = state.streak_result;
// { streak: N, todayPracticed: true, motivationalPhrase: "..." }
```

Este step SOLO muestra información, NO ejecuta lógica de racha.

---

**Autor:** Sistema  
**Versión:** 1.0














