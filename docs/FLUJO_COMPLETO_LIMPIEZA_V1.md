# Flujo Completo Limpieza Energética Diaria V1

## Resumen

Implementación del flujo completo del recorrido `limpieza_energetica_diaria` con handlers genéricos reutilizables.

**Fecha**: 2025-12-17
**Estado**: DRAFT (no publicado)

## Flujo de 9 Steps

```
seleccion_tipo_limpieza
       ↓
preparacion_seleccion        [selection_handler]
       ↓
preparacion_practica         [practice_timer_handler]
       ↓
protecciones_energeticas     [selection_handler]
       ↓
limpieza_energetica          [limpieza_energetica_handler] ← ÚNICO PUNTO DE RACHA
       ↓
transicion_racha
       ↓
post_limpieza_seleccion      [selection_handler]
       ↓
post_limpieza_practica       [practice_timer_handler]
       ↓
cierre
```

## Handlers Implementados

### 1. `selection_handler_v1`

**Ubicación**: `src/core/recorridos/step-handlers/selection-handler.js`

**Responsabilidades**:
- Recibir lista de ítems (inyectada por step.props o desde BD)
- Filtrar por nivel del alumno
- Renderizar checklist
- Capturar selección

**Input capturado**:
```json
{
  "selected_items": ["id_1", "id_2", ...]
}
```

**Steps que usa**:
- `preparacion_seleccion` → source: `preparacion`
- `protecciones_energeticas` → source: `protecciones` (carga de BD)
- `post_limpieza_seleccion` → source: `post_limpieza`

**Características**:
- NO decide flujo
- NO ejecuta lógica de dominio
- Fail-open si no hay ítems
- Soporta fuentes de datos async (BD)

### 2. `practice_timer_handler_v1`

**Ubicación**: `src/core/recorridos/step-handlers/practice-timer-handler.js`

**Responsabilidades**:
- Recibir lista de prácticas seleccionadas (del state del step anterior)
- Sumar `declared_duration_minutes`
- Renderizar reloj countdown
- Permitir play / pause
- Emitir input al finalizar

**Input capturado**:
```json
{
  "practice_completed": true,
  "duration_real_minutes": 5.5
}
```

**Steps que usa**:
- `preparacion_practica` → lee `preparacion_selected` del state
- `post_limpieza_practica` → lee `post_limpieza_selected` del state

**Características**:
- NO incrementa racha
- NO emite eventos de dominio
- Fail-open con duración por defecto (5 min)
- Catálogo de prácticas integrado

## Contratos de Datos

### State del Run

El state se va construyendo a medida que el alumno avanza:

```json
{
  "tipo_limpieza": "basica",
  
  "preparacion_selected": ["respiracion_consciente", "enraizamiento"],
  "preparacion_timestamp": "2025-12-17T13:00:00Z",
  
  "preparacion_practica_completed": true,
  "preparacion_practica_timestamp": "2025-12-17T13:05:00Z",
  "preparacion_duration_real_minutes": 5.0,
  
  "protecciones_selected": ["escudo_luz", "manto_protector"],
  "protecciones_timestamp": "2025-12-17T13:06:00Z",
  
  "limpieza_completada": true,
  "transmutations_done": ["transmutacion_1", "transmutacion_2"],
  "mode_id": "basica",
  "limpieza_timestamp": "2025-12-17T13:20:00Z",
  
  "streak_result": {
    "todayPracticed": true,
    "streak": 15,
    "motivationalPhrase": "¡15 días seguidos!"
  },
  
  "post_limpieza_selected": ["sellado_energetico", "agradecimiento"],
  "post_limpieza_timestamp": "2025-12-17T13:21:00Z",
  
  "post_limpieza_practica_completed": true,
  "post_limpieza_practica_timestamp": "2025-12-17T13:25:00Z",
  "post_limpieza_duration_real_minutes": 3.0
}
```

## Verificaciones

- [x] NO se crean tablas nuevas
- [x] NO se toca editor
- [x] NO se rompe publish (sigue en DRAFT)
- [x] Handlers reutilizables
- [x] Limpieza energética sigue siendo el único punto de racha
- [x] PM2 reiniciado

## Archivos Creados/Modificados

### Nuevos:
- `src/core/recorridos/step-handlers/selection-handler.js`
- `src/core/recorridos/step-handlers/practice-timer-handler.js`
- `scripts/update-draft-flujo-completo.js`

### Modificados:
- `src/core/recorridos/runtime/recorrido-runtime.js` (imports + hooks)

## Próximos Pasos

1. **UI de Selección**: Crear componente HTML que renderice `selection_items`
2. **UI de Timer**: Crear componente HTML con countdown y controles play/pause
3. **Publicar recorrido**: Cuando las UIs estén listas

## Notas Técnicas

- La función `buildRenderSpec` ahora es async para soportar handlers que cargan datos de BD
- Los handlers siguen el patrón fail-open: si fallan, el flujo continúa sin bloquear
- El handler de limpieza_energetica NO fue modificado; sigue siendo el único que ejecuta `checkDailyStreak`




