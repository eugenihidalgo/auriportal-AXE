# MASTER ALQUIMIA ALUMNO PANEL v1.1 - Documentación Canónica
**Versión:** v1.1  
**Fecha:** 2026-01-08  
**Estado:** ✅ Cerrado funcionalmente

---

## 1. PROPÓSITO DEL PANEL

### 1.1. Dashboard Espiritual Operativo

El Panel "Alquimia del Alumno" es una **herramienta de diagnóstico + intervención** diseñada para uso previo a tutorías.

**Uso principal:**
- Master revisa estado completo de limpiezas SHARED de un alumno
- Identifica items pendientes, importantes o nunca trabajados
- Interviene inmediatamente marcando items como revisados
- Prepara información para tutoría con datos frescos

**No es:**
- ❌ Navegación o exploración
- ❌ Panel de estadísticas pasivas
- ❌ Herramienta de solo lectura

**Es:**
- ✅ Herramienta operativa de intervención
- ✅ Diagnóstico + reparación en una sola pantalla
- ✅ Preparación para tutorías

---

## 2. MODELO MENTAL

### 2.1. Lista = Estructura

**Regla absoluta:** Las listas son **estructura base**, no dependen de items.

**Implicaciones:**
- TODAS las listas canónicas se muestran SIEMPRE
- Una lista vacía sigue siendo visible (muestra "Lista vacía")
- Las listas vienen del catálogo (`listas_transmutaciones`)
- El orden de listas es canónico (por `orden` o alfabético)

**Fuente:**
- Tabla: `listas_transmutaciones`
- Filtro: `status = 'active'` o `activo = true`

---

### 2.2. Ítem = Contenido

**Regla:** Los items son **contenido** asociado a listas.

**Implicaciones:**
- Items se resuelven desde catálogo (`items_transmutaciones`)
- Items se asocian a listas por `lista_id`
- Si un item no tiene lista → aparece en lista "unknown"
- Si un item no existe en catálogo → aparece como "NO_RESUELTO"

**Fuente:**
- Tabla: `items_transmutaciones`
- Relación: `item.lista_id` → `lista.id`

---

### 2.3. Estado = Proyección SHARED

**Regla:** El estado de cada item es una **proyección** desde `cleaning_item_state` (capa SHARED).

**Implicaciones:**
- Estado se calcula desde `shared_last_cleaned_at`, `shared_clean_count`, etc.
- Estados posibles: `never`, `important`, `pending`, `reviewed`
- El estado NO se calcula en UI (viene del backend)
- Si no hay estado → `never`

**Fuente:**
- Tabla: `cleaning_item_state`
- Filtro: `product_key = 'pde'`, `domain_type = 'transmutation'`, `student_id = X`
- Capa: `SHARED` únicamente (este panel no usa PDE)

---

### 2.4. Historial = cleaning_events (append-only)

**Regla:** El historial es el **event log** completo de limpiezas.

**Implicaciones:**
- Historial es append-only (no se modifica)
- Cada evento tiene `actor_type` (master/student/automation)
- Historial permite ver quién limpió qué y cuándo
- Último evento determina "revisado por alumno" vs "revisado por master"

**Fuente:**
- Tabla: `cleaning_events`
- Orden: `created_at DESC`
- Filtro: `student_id`, `item_ref`, `product_key`, `domain_type`

---

## 3. MEGALISTA

### 3.1. Qué es

La megalista es una **vista operativa completa** de todos los items de alquimia de un alumno, agrupados por listas y ordenados por urgencia.

**Características:**
- Agrupación obligatoria por listas
- Orden canónico global dentro de cada lista
- Separación de revisados por actor
- Acciones inmediatas por item

---

### 3.2. Por qué NO es Navegación

**Diferencia clave:**
- Navegación = explorar, buscar, filtrar
- Megalista = ver TODO, intervenir, diagnosticar

**Razón:**
- El Master necesita ver el estado completo antes de tutoría
- No hay tiempo para navegar o buscar
- La megalista muestra TODO de una vez
- Permite intervención inmediata sin cambiar de pantalla

---

### 3.3. Orden Canónico Global

**Dentro de cada lista, el orden SIEMPRE es:**

1. **NUNCA** (gris) - Items sin limpieza SHARED
2. **IMPORTANTE** (rojo) - Items con `days_since >= threshold_days * critical_multiplier`
3. **PENDIENTE** (amarillo) - Items con `threshold_days <= days_since < critical_threshold`
4. **REVISADO** (verde) - Items con `days_since < threshold_days` o `remaining <= 0`

**Orden de listas:**
- Por `orden` de lista (si existe)
- O alfabético por nombre

---

### 3.4. Separación Revisados (Alumno / Master)

**Al final de la megalista, dos bloques separados:**

1. **"Revisados por Alumno"**
   - Items limpiados por `actor_type='student'`
   - Agrupados por listas

2. **"Revisados por Master"**
   - Items limpiados por `actor_type='master'`
   - Agrupados por listas

**Razón:**
- Permite ver qué ha hecho el alumno vs qué ha hecho el Master
- Útil para diagnóstico y preparación de tutoría
- Último evento determina el actor (desde `cleaning_events`)

---

## 4. ACCIONES

### 4.1. Limpiar Ítem (SHARED)

**Botón:** "Marcar como revisado"

**Ubicación:**
- Visible en items con estado: `never`, `important`, `pending`
- NO visible en items `reviewed`

**Acción:**
- Llama `POST /master/api/alquimia-alumno/clean`
- Body: `{ student_id, item_ref, domain_type, product_key }`
- Backend fuerza: `clean_layer='shared'`, `actor_type='master'`

**Efectos inmediatos:**
1. Item se marca como limpiado en `cleaning_events`
2. Estado se actualiza en `cleaning_item_state`
3. Megalista se refresca automáticamente
4. Item se mueve a sección "Revisados por Master"
5. Porcentaje de revisados se actualiza
6. Resumen se actualiza

**Confirmación:**
- Dialog de confirmación antes de limpiar
- Mensaje de éxito visible (2 segundos)
- Refetch automático tras éxito

---

### 4.2. Reordenación Automática

**Tras limpiar un item:**
- Item desaparece de su grupo original (never/important/pending)
- Item aparece en "Revisados por Master"
- Orden se mantiene canónico
- UI se actualiza sin recargar página

---

### 4.3. Visibilidad para el Alumno (Configurable Futura)

**Estado actual:**
- Limpiezas SHARED son visibles para el alumno
- `cleaning_item_state.shared_*` se sincroniza con `student_item_state`

**Futuro:**
- Configuración de visibilidad por item/lista
- Control granular de qué ve el alumno

---

## 5. FAIL-OPEN

### 5.1. Qué Significa

**Fail-open = Robustez > Perfección**

El panel **NUNCA** debe romper (500) por:
- Items no encontrados en catálogo
- Listas no encontradas
- Niveles null/undefined
- Estructuras incompletas
- Errores de cálculo

**Siempre:**
- Retorna JSON válido (status 200)
- Incluye `warnings[]` con problemas
- Renderiza items "NO_RESUELTO" correctamente
- Continúa funcionando aunque haya datos inconsistentes

---

### 5.2. Qué es NO_RESUELTO

**Item con nombre "NO_RESUELTO":**
- Item existe en `cleaning_item_state` (tiene estado)
- Pero NO existe en `items_transmutaciones` (catálogo)
- O el catálogo no se pudo cargar

**Lista "Sin lista (NO_RESUELTO)":**
- Item tiene `lista_id` que no existe en catálogo
- O `lista_id` es null/undefined

**Acción:**
- Revisar `warnings[]` en respuesta JSON
- Corregir datos en catálogo o `cleaning_item_state`
- Warnings desaparecerán en próxima carga

---

### 5.3. Por qué NO se Rompe Nunca el Panel

**Implementación:**
- Guards en todos los puntos críticos
- Fallbacks canónicos para datos faltantes
- Try/catch con warnings estructurados
- Query directa con fail-open

**Ventajas:**
- Panel siempre funcional
- Diagnóstico visible (warnings)
- Permite corregir datos sin romper sistema

---

## 6. ENDPOINTS INVOLUCRADOS

### 6.1. GET /master/api/alquimia-alumno/megalist

**Propósito:** Obtener megalista completa

**Query params:**
- `student_id` (requerido)
- `levels_mode` (opcional)

**Respuesta:**
- `student` - Datos del alumno
- `summary` - Resumen (total, never, important, pending, reviewed)
- `lists[]` - Listas con items agrupados
- `reviewed` - Revisados separados por actor
- `warnings[]` - Warnings si hay problemas

---

### 6.2. POST /master/api/alquimia-alumno/clean

**Propósito:** Limpiar un item (SHARED)

**Body:**
- `student_id` (requerido)
- `item_ref` (requerido)
- `domain_type` (requerido)
- `product_key` (requerido)

**Respuesta:**
- `applied` - true/false
- `reason` - Razón si no aplicado
- `state` - Estado actualizado si aplicado

---

### 6.3. GET /master/api/alquimia-alumno/item-history

**Propósito:** Obtener historial de un item

**Query params:**
- `student_id` (requerido)
- `item_ref` (requerido)
- `domain_type` (opcional, default: 'transmutation')
- `limit` (opcional, default: 50)

**Respuesta:**
- `events[]` - Eventos ordenados por fecha DESC

---

### 6.4. GET /master/api/alquimia-alumno/report

**Propósito:** Obtener informe básico por días

**Query params:**
- `student_id` (requerido)
- `days` (opcional, default: 30)

**Respuesta:**
- `master_events[]` - Eventos del Master
- `student_events[]` - Eventos del Alumno
- `total` - Total de eventos

---

## 7. COSAS EXPLÍCITAMENTE FUERA DE SCOPE

### 7.1. PDE

**No incluido:**
- ❌ Limpiezas PDE (solo SHARED)
- ❌ Estado PDE
- ❌ Historial PDE

**Razón:**
- Este panel es para intervención SHARED
- PDE es capa separada (solo Master, no visible para alumno)

---

### 7.2. Limpiar Todo

**No incluido:**
- ❌ Botón "limpiar todo"
- ❌ Limpieza masiva
- ❌ Limpieza por lista

**Razón:**
- Intervención debe ser consciente y específica
- Cada item requiere decisión individual
- Evita limpiezas accidentales masivas

---

### 7.3. Bloqueos (Capability Engine)

**No incluido:**
- ❌ Bloqueos por nivel
- ❌ Bloqueos por permisos
- ❌ Bloqueos por estado de suscripción

**Razón:**
- Panel es diagnóstico + intervención
- Bloqueos se manejan en otros sistemas
- Este panel muestra TODO (incluso no aplicables)

---

### 7.4. Apadrinados (Pendiente)

**No incluido:**
- ❌ Vista de apadrinados
- ❌ Limpiezas de apadrinados
- ❌ Agregación por apadrinados

**Razón:**
- Feature futura
- Requiere diseño adicional
- No bloquea funcionalidad actual

---

## 8. ESTADO FINAL

### 8.1. Panel Cerrado a Nivel Funcional

**Características:**
- ✅ Todas las listas canónicas siempre visibles
- ✅ Items asociados correctamente
- ✅ Estados calculados determinísticamente
- ✅ Acciones operativas funcionales
- ✅ Fail-open completo
- ✅ Historial accesible
- ✅ Informe básico disponible

---

### 8.2. Escalable

**Preparado para:**
- Más listas (sin límite)
- Más items (sin límite)
- Más alumnos (sin límite)
- Más estados (extensible)

**Arquitectura:**
- Servicio separado (read-model)
- Endpoints canónicos
- UI desacoplada
- Fail-open robusto

---

### 8.3. Preparado para Automatizaciones Futuras

**Conceptos listos:**
- ✅ SOT completo (`cleaning_events`)
- ✅ Estados proyectados (`cleaning_item_state`)
- ✅ Señales emitidas (`clean.executed`)
- ✅ Historial completo

**Futuro:**
- Informes automáticos post-sesión
- Agrupación por sesiones (cuando se implemente)
- Notificaciones automáticas
- Analytics avanzados

---

## 9. VERIFICACIÓN

### 9.1. Checklist Funcional

- ✅ Todas las listas canónicas visibles (incluso vacías)
- ✅ Items asociados correctamente a listas
- ✅ Orden canónico respetado (never → important → pending → reviewed)
- ✅ Revisados separados por actor (alumno/master)
- ✅ Botón "Marcar como revisado" funcional
- ✅ Botón "Historial" funcional
- ✅ Refetch automático tras limpieza
- ✅ UI se actualiza en caliente
- ✅ No hay 500 por datos inconsistentes
- ✅ Warnings visibles en JSON

---

### 9.2. Pruebas Recomendadas

1. **Alumno con muchos items:**
   - Verificar que todas las listas aparecen
   - Verificar orden canónico
   - Limpiar un item importante
   - Verificar que se mueve a revisados

2. **Alumno con pocos items:**
   - Verificar que listas vacías aparecen
   - Verificar mensaje "Lista vacía"

3. **Alumno con items rotos:**
   - Verificar que aparecen como "NO_RESUELTO"
   - Verificar warnings en JSON
   - Verificar que panel no rompe

---

## 10. REFERENCIAS

- **Panel v1.0:** `docs/MASTER_ALQUIMIA_ALUMNO_PANEL_V1.md`
- **Contratos API:** `docs/MASTER_API_ALQUIMIA_ALUMNO_CONTRACTS_V1.md`
- **Fail-open:** `docs/MASTER_ALQUIMIA_ALUMNO_FAIL_OPEN_NOTES_V1.md`
- **Notas automatización:** `docs/CLEANING_REPORT_AUTOMATION_READY_NOTES_V1.md`
- **Diagnóstico:** `docs/DIAGNOSTICO_REALIDAD_CLEANING_V1.md`
- **Servicio:** `src/core/master/services/alquimia-alumno-megalist-service.js`
- **Cliente:** `public/js/master/master-alquimia-alumno-client.js`

---

**Estado:** ✅ Cerrado funcionalmente

**Versión:** v1.1

**Principio:** Listas = Estructura, Items = Contenido, Acciones = Intervención
