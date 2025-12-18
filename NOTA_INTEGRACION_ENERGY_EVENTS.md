# Nota de Integración: Sistema de Eventos Energéticos

## 📋 Resumen

Se ha implementado un sistema de eventos energéticos en paralelo al sistema legacy, sin modificar la semántica de las tablas legacy existentes. Todos los eventos se registran en la tabla `energy_events` como side-effect de las operaciones de limpieza.

## 🎯 Principios de Diseño

1. **Fail-Open Controlado**: Si falla el insert del evento, NO rompe la limpieza legacy, pero se registra un log crítico y se intenta registrar en `audit_events` si existe.

2. **Idempotencia**: Todos los inserts son idempotentes por `request_id` + `event_type` + `subject_type` + `subject_id` + `alumno_id`, evitando duplicados.

3. **No Modificación Legacy**: Las tablas legacy (`aspectos_energeticos_alumnos`, `items_transmutaciones_alumnos`, etc.) siguen actualizándose exactamente igual que antes.

## 📁 Archivos Creados/Modificados

### Nuevos Archivos

1. **`src/core/energy/energy-events.js`**
   - Módulo principal para insertar eventos energéticos
   - Función `insertEnergyEvent()` con validación defensiva
   - Manejo de `request_id` automático (prioridad: params > ctx > request > AsyncLocalStorage > UUID v4)
   - Fail-open controlado con logging crítico

2. **`database/migrations/v5.0.1-add-energy-events-idempotency.sql`**
   - Constraint de idempotencia: `UNIQUE INDEX` sobre `(request_id, event_type, subject_type, subject_id, alumno_id)`
   - Solo aplica cuando `request_id IS NOT NULL`

3. **`tests/energy/energy-events.test.js`**
   - Tests mínimos:
     - Inserta evento OK
     - Idempotencia evita duplicado
     - Payload inválido no inserta y loguea
     - Genera request_id automáticamente
     - Maneja metadata correctamente

### Archivos Modificados

1. **`src/endpoints/limpieza-master.js`**
   - ✅ `limpiarAspectoIndividual()`: Emite evento tipo 'cleaning' con `is_clean_after=true`
   - ✅ `limpiarAspectoGlobal()`: Emite evento por cada alumno limpiado (fire-and-forget)

2. **`src/services/transmutaciones-energeticas.js`**
   - ✅ `limpiarItemParaTodos()`: Emite evento por cada alumno limpiado
   - ✅ `limpiarItemParaAlumno()`: Emite evento tipo 'cleaning' con `is_clean_after=true`

3. **`src/endpoints/limpieza-handler.js`**
   - ✅ `handleMarcarLimpio()`: Emite evento desde portal alumno con `actor_type='alumno'`

## 🔌 Endpoints que Ya Emiten Eventos

### Desde Panel Admin (Master)

1. **`POST /admin/master/limpiar-individual`**
   - Handler: `limpiarAspectoIndividual()`
   - Emite: evento 'cleaning' con `actor_type='master'`, `origin='admin_panel'`
   - Metadata incluye: `legacy_table_updated`, `tipo_aspecto`, `frecuencia_dias`, `tipo_limpieza`, `veces_limpiar`

2. **`POST /admin/master/limpiar-global`**
   - Handler: `limpiarAspectoGlobal()`
   - Emite: evento 'cleaning' por cada alumno (fire-and-forget)
   - Metadata incluye: `global_cleaning: true` + mismos campos que individual

3. **Limpieza de Items de Transmutación (desde admin)**
   - Handler: `limpiarItemParaTodos()` y `limpiarItemParaAlumno()`
   - Emite: evento 'cleaning' con `subject_type='transmutacion_item'`
   - Metadata incluye: `item_id`, `item_nombre`, `lista_id`, `lista_nombre`, `tipo_lista`, `frecuencia_dias`, `veces_limpiar`

### Desde Portal Alumno

4. **`POST /transmutaciones/limpiar/{itemId}`** (o similar)
   - Handler: `handleMarcarLimpio()`
   - Emite: evento 'cleaning' con `actor_type='alumno'`, `origin='web_portal'`
   - Metadata incluye: mismos campos que limpieza de items desde admin

## 📊 Estructura de Eventos Emitidos

Todos los eventos de limpieza tienen la siguiente estructura base:

```javascript
{
  event_type: 'cleaning',
  actor_type: 'master' | 'alumno' | 'system',
  actor_id: string | null,
  alumno_id: number,
  subject_type: 'aspecto' | 'transmutacion_item' | 'lugar' | 'proyecto' | 'apadrinado',
  subject_id: string,
  origin: 'admin_panel' | 'web_portal' | 'api' | 'cron',
  requires_clean_state: true,
  was_clean_before: boolean,
  is_clean_after: true,
  metadata: {
    legacy_table_updated: true,
    tipo_aspecto?: string,
    aspecto_id?: number,
    aspecto_nombre?: string,
    frecuencia_dias?: number,
    tipo_limpieza?: string,
    veces_limpiar?: number,
    item_id?: number,
    item_nombre?: string,
    lista_id?: number,
    lista_nombre?: string,
    tipo_lista?: string,
    global_cleaning?: boolean
  }
}
```

## 🔍 Logging

### Logs de Éxito
```
[EnergyEvents][INSERTED] event_id=123 event_type=cleaning subject_type=aspecto subject_id=456 alumno_id=789 request_id=req_1234567890_abc
```

### Logs de Idempotencia
```
[EnergyEvents][IDEMPOTENT] Duplicado evitado: event_type=cleaning subject_type=aspecto subject_id=456 alumno_id=789 request_id=req_1234567890_abc
```

### Logs de Error (Fail-Open)
```
[EnergyEvents][FAIL] request_id=req_1234567890_abc event_type=cleaning subject_type=aspecto subject_id=456 alumno_id=789 error=...
```

## ⚠️ Notas Importantes

1. **Migración v5.0.1**: Debe ejecutarse después de v5.0.0 para añadir el constraint de idempotencia.

2. **Fail-Open**: Si falla el insert del evento, la limpieza legacy continúa normalmente. El error se loguea críticamente y se intenta registrar en `audit_events`.

3. **Request ID**: Se obtiene automáticamente del contexto de request (AsyncLocalStorage) si está disponible. Si no, se genera un UUID v4.

4. **Idempotencia**: Solo aplica cuando `request_id IS NOT NULL`. Eventos sin `request_id` pueden duplicarse (legítimo para eventos de sistema).

5. **Performance**: Los eventos se insertan en paralelo (no bloquean la respuesta), especialmente en limpiezas globales que usan fire-and-forget.

## 🚀 Próximos Pasos (Opcional)

- Añadir hooks en limpieza de lugar/proyecto/apadrinado (cuando existan los endpoints)
- Implementar consultas para calcular estado desde eventos
- Añadir más tipos de eventos (iluminación, conexión, etc.)
- Dashboard de eventos energéticos








