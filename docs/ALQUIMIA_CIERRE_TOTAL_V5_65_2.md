# Alquimia Cierre Total v5.65.2

**Fecha:** 2026-01-09  
**Versión:** 5.65.2  
**Dominio:** MASTER

---

## Objetivo

Cerrar completamente la implementación funcional del CONTRATO LIMPIEZA v1, corrigiendo flujos pendientes y eliminando fricción UX legacy. Este cierre incluye:

1. **Flotante de alumnos sin filtro por nivel** (Master puede limpiar cualquier item a cualquier alumno)
2. **Refresh determinista de UI** tras acciones de limpieza
3. **Toast común unificado** eliminando duplicación
4. **Garantías contractuales** en rutas masivas
5. **Smoke tests** para endpoints críticos

---

## Invariantes Canónicas

### 1. Payload Explícito
- **REQUERIDO**: Todos los campos del CONTRATO LIMPIEZA v1 deben venir explícitamente en el payload
- **PROHIBIDO**: Inferencias en backend (excepto fallback legacy con warning fuerte)
- **Campos obligatorios**: `item_kind`, `actor_type`, `surface_key`, `clean_layer`

### 2. `item_kind` Requerido
- **REQUERIDO** en `markCleanStudent` y `markCleanAllStudents`
- **Validación estricta**: Debe ser `'recurrente'` o `'una_vez'`
- **Sin inferencia**: No se infiere desde `lista.tipo` (solo validación de coherencia)

### 3. Flotante Alumnos = ALL Siempre
- **REQUERIDO**: `skip_level_filter: true` en endpoint de flotante
- **PROHIBIDO**: Filtrar alumnos por nivel en flotante Master
- **Regla**: Master puede limpiar cualquier item a cualquier alumno

### 4. UX: Toasts No Bloqueantes
- **PROHIBIDO**: `confirm()` y `alert()` en funciones de limpieza
- **REQUERIDO**: Sistema de toasts con auto-dismiss
- **Helper común**: `/js/master/ui/toast.js` (sin duplicación)

### 5. Refresh Determinista Post-Acción
- **REQUERIDO**: Tras cualquier acción de limpieza exitosa, refresh inmediato de UI
- **Opción 1**: Optimistic patch (estado local)
- **Opción 2**: Re-fetch inmediato del estado afectado
- **Implementado**: Re-fetch determinista (más robusto)

---

## Flujos Cubiertos

### Alquimia Alumno - Limpiar Item

**Endpoint:** `POST /master/api/alquimia-alumno/clean`

**Payload:**
```json
{
  "student_id": 4,
  "item_ref": "item-ref-123",
  "item_kind": "recurrente",
  "domain_type": "transmutation",
  "product_key": "pde",
  "actor_type": "master",
  "surface_key": "master.alquimia_alumno",
  "clean_layer": "shared"
}
```

**Flujo:**
1. Usuario hace clic en "Limpiar" en item
2. Frontend envía payload completo
3. Backend valida campos requeridos
4. Cleaning Engine ejecuta limpieza
5. **Refresh**: Re-fetch inmediato de megalist
6. **Toast**: `showToastSuccess()` verde, 2s

---

### Alquimia General - Limpiar Alumno en Flotante

**Endpoint:** `POST /master/api/alquimia-general/items/:item_ref/master/mark-clean-student`

**Payload:**
```json
{
  "student_id": 4,
  "item_ref": "item-ref-123",
  "item_kind": "recurrente",
  "domain_type": "transmutation",
  "clean_layer": "shared",
  "actor_type": "master",
  "surface_key": "master.alquimia_general"
}
```

**Flujo:**
1. Usuario abre flotante "VER" de un item
2. Flotante muestra **TODOS los alumnos** (sin filtro por nivel)
3. Usuario hace clic en "Limpiar" en alumno
4. Frontend envía payload completo
5. Backend valida campos requeridos
6. Cleaning Engine ejecuta limpieza
7. **Refresh**: Re-fetch inmediato del flotante con mismo `clean_layer`
8. **Toast**: `showToastSuccess()` verde, 2s

---

### Alquimia General - +1 para Todos (UNA_VEZ)

**Endpoint:** `POST /master/api/alquimia-general/items/:item_ref/master/increment-all`

**Payload:**
```json
{
  "clean_layer": "shared"
}
```

**Backend:**
- `incrementAll` servicio envía `item_kind: 'una_vez'` explícitamente
- `incrementAllStudents` valida que `item_kind` viene (warning fuerte si no)
- `markCleanAllStudents` valida `item_kind` como requerido

**Flujo:**
1. Usuario hace clic en botón "+1" en item `una_vez`
2. Frontend envía `clean_layer`
3. Backend añade `item_kind: 'una_vez'` explícitamente
4. Cleaning Engine ejecuta increment-all para todos los alumnos activos
5. **Refresh**: Re-fetch de items y flotante si está abierto
6. **Toast**: `showToastSuccess()` verde con número de alumnos actualizados

---

## Riesgos Evitados / Anti-Regresiones

### 1. Inferencias de `item_kind`
- **Riesgo**: Backend infiere `item_kind` desde `lista.tipo` → inconsistencias
- **Solución**: Validación estricta, payload explícito, warning fuerte en fallback legacy

### 2. Filtrado por Nivel en Flotante
- **Riesgo**: Flotante no muestra todos los alumnos → Master no puede limpiar items avanzados
- **Solución**: `skip_level_filter: true` explícito en endpoint, comentario canónico

### 3. UI No Se Refresca
- **Riesgo**: Estado local desincronizado tras acciones → confusión
- **Solución**: Refresh determinista tras cada acción exitosa

### 4. Duplicación de Código Toast
- **Riesgo**: Múltiples implementaciones de toast → inconsistencias
- **Solución**: Helper común `/js/master/ui/toast.js` cargado en fase "core"

### 5. Confirmaciones Bloqueantes
- **Riesgo**: `confirm()` interrumpe flujo de trabajo → fricción UX
- **Solución**: Toasts no bloqueantes, sin confirmaciones

---

## Archivos Modificados

### Backend
- `src/endpoints/master-api-alquimia-general.js`: Añadido `skip_level_filter: true` en GET students
- `src/core/master/services/cleaning-engine-service.js`: Warning fuerte en `incrementAllStudents` si falta `item_kind`

### Frontend
- `public/js/master/master-alquimia-general-client.js`:
  - Eliminadas funciones toast duplicadas
  - Refresh determinista en `handleIncrementAllItem` y `handleLimpiarEstudiante`
  - Reemplazados `alert()` restantes por `showToastError()`
- `public/js/master/ui/toast.js`: Helper común creado

### Registry
- `src/core/master/registry/master-layout-registry.v1.json`: Añadido script `master-ui-toast` en fase "core"

### Tests
- `scripts/test-alquimia-smoke.js`: Smoke tests para endpoints críticos

---

## Verificación Manual

### Alquimia General
1. Crear item UNA_VEZ
2. Ejecutar "+1 para todos" varias veces
3. ✅ Contador cambia inmediatamente
4. ✅ Toast verde sin confirm()
5. ✅ Tras recargar, estado persiste correcto
6. Abrir flotante "VER"
7. ✅ Muestra TODOS los alumnos (verificar alumno de nivel bajo/alto)
8. Limpiar alumno desde flotante
9. ✅ Toast verde
10. ✅ Flotante se refresca inmediatamente
11. ✅ Tras recargar, estado persiste

### Alquimia Alumno
1. Limpiar item recurrente
2. ✅ Toast verde
3. ✅ UI cambia inmediatamente (item se mueve a "Revisados")
4. ✅ Tras recargar, estado persiste
5. Limpiar item una_vez
6. ✅ Progreso se actualiza (X/Y veces)
7. ✅ Toast verde
8. ✅ UI cambia inmediatamente

### Consola
- ✅ Cero errores JavaScript
- ✅ Cero 500 en Network

### Logs PM2
- ✅ `trace_id` de acción muestra `item_kind` recibido
- ✅ No hay warnings de inferencia

---

## Referencias

- [CONTRATO LIMPIEZA v1](./CONTRATO_LIMPIEZA_V1.md)
- [MASTER UI TOAST v1](./MASTER_UI_TOAST_V1.md)
- [MASTER ALQUIMIA FLOTANTE ALUMNOS CONTRATO](./MASTER_ALQUIMIA_FLOTANTE_ALUMNOS_CONTRATO.md)
- [SMOKE TESTS ALQUIMIA v1](./SMOKE_TESTS_ALQUIMIA_V1.md)