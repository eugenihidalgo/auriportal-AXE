# MASTER ALQUIMIA ALUMNO PANEL v1 - Documentación Canónica
**Versión:** v1.0  
**Fecha:** 2026-01-08  
**Estado:** ✅ Implementado

---

## 1. DEFINICIÓN

El Panel "Alquimia del Alumno" es una **megalista operativa** que permite al Master visualizar y gestionar todas las limpiezas SHARED de un alumno específico, agrupadas por listas y ordenadas según estado de urgencia.

**Ruta:** `/master/templo-luz/alquimia-alumno`

**Dominio:** MASTER (`master.pdeeugenihidalgo.org`)

---

## 2. COMPORTAMIENTO CANÓNICO

### 2.1. Selector de Alumno (Componente Principal)

**Ubicación:** Arriba del todo, antes de cualquier contenido

**Funcionalidad:**
- Input de búsqueda por nombre, apodo o email
- Select dropdown con lista de alumnos
- Búsqueda en tiempo real (filtra mientras escribes)
- Al seleccionar un alumno:
  - Actualiza URL con `?student_id=...`
  - Carga megalista completa
  - Carga informe básico
  - Oculta empty state, muestra panel

**Deep-link:**
- Si la URL trae `?student_id=123`, autoselecciona y carga automáticamente
- Permite compartir enlaces directos a un alumno específico

**Empty State:**
- Si NO hay alumno seleccionado:
  - Muestra mensaje: "Selecciona un alumno para ver su Alquimia"
  - NO hace llamadas a APIs
  - Panel oculto

**Fuente de datos:**
- API: `GET /master/api/students?limit=200`
- Reutiliza endpoint existente de diagnóstico MASTER

---

### 2.2. Megalista por Listas

**Agrupación obligatoria:** Por listas (no por estado)

**Orden canónico fijo dentro de cada lista:**
1. **NUNCA** (gris) - Items sin limpieza SHARED
2. **IMPORTANTE** (rojo) - Items con `days_since >= threshold_days * critical_multiplier`
3. **PENDIENTE** (amarillo) - Items con `threshold_days <= days_since < critical_threshold`
4. **REVISADO** (verde) - Items con `days_since < threshold_days`

**Orden de listas:**
- Por `orden` de lista (si existe) o alfabético por nombre

**Colores canónicos:**
- NUNCA: `text-slate-400`, `bg-slate-900`
- IMPORTANTE: `text-red-400`, `bg-red-900 bg-opacity-30`
- PENDIENTE: `text-yellow-400`, `bg-yellow-900 bg-opacity-30`
- REVISADO: `text-green-400`, `bg-green-900 bg-opacity-30`

---

### 2.3. Revisados Separados por Actor

**Dos bloques al final de la página:**

1. **"Revisados por Alumno"**
   - Items limpiados por `actor_type='student'`
   - Agrupados por listas

2. **"Revisados por Master"**
   - Items limpiados por `actor_type='master'`
   - Agrupados por listas

**Fuente de actor:**
- Último evento en `cleaning_events` para cada item
- Campo `actor_type` del evento más reciente

---

### 2.4. Interacción: Limpieza Ítem-por-Ítem

**Botón "Limpiar (SHARED)":**
- Solo visible en items NUNCA/IMPORTANTE/PENDIENTE
- NO visible en REVISADOS
- Al pulsar:
  - Llama `POST /master/api/alquimia-alumno/clean`
  - Forza `clean_layer='shared'` y `actor_type='master'`
  - Delega a Cleaning Engine (`markCleanStudent`)
  - Refetch inmediato de megalista
  - Item cae a REVISADOS y baja visualmente

**Update instantáneo:**
- No espera confirmación
- Refetch completo después de limpiar
- Porcentaje de revisados se actualiza automáticamente

**Prohibiciones:**
- ❌ NO existe "limpiar todo"
- ❌ NO existe limpieza PDE (solo SHARED)
- ❌ NO se puede limpiar un item REVISADO

---

### 2.5. Historial por Ítem

**Botón "Historial":**
- Visible en TODOS los items (incluso REVISADOS)
- Al pulsar:
  - Llama `GET /master/api/alquimia-alumno/item-history`
  - Muestra modal simplificado con eventos
  - Orden: más reciente primero

**Contenido del historial:**
- Todos los eventos de `cleaning_events` para ese item
- Incluye: fecha, acción, actor, superficie, metadatos

---

### 2.6. Informe Básico v1

**Sección "Informe":**
- Carga automáticamente al seleccionar alumno
- Rango: últimos 30 días (configurable vía `?days=...`)

**Separación:**
- **Por Master:** Eventos con `actor_type='master'`
- **Por Alumno:** Eventos con `actor_type='student'`

**Contenido:**
- Fecha, item_ref, action_type, surface_key
- Orden: más reciente primero

**Limitaciones v1:**
- ❌ NO hay concepto de "sesión"
- ❌ NO hay agrupación por sesión
- ❌ Solo proyección por rango de fechas

---

## 3. FUENTES DE DATOS REALES

### 3.1. Estado Actual

**Tabla:** `cleaning_item_state`

**Capa:** SHARED únicamente (este panel solo SHARED)

**Columnas usadas:**
- `shared_last_cleaned_at` - Para calcular días transcurridos
- `shared_clean_count` - Contador de limpiezas
- `shared_completed` - Para items una_vez
- `shared_remaining` - Para items una_vez

**Query:**
```sql
SELECT * FROM cleaning_item_state
WHERE student_id = $1
  AND product_key = 'pde'
  AND domain_type = 'transmutation'
ORDER BY item_ref
```

**NO se usa:**
- ❌ `student_item_state` (puede estar desincronizado)
- ❌ `pde_last_cleaned_at` (solo SHARED)

---

### 3.2. Historial

**Tabla:** `cleaning_events` (append-only)

**Query:**
```sql
SELECT * FROM cleaning_events
WHERE student_id = $1
  AND product_key = 'pde'
  AND domain_type = 'transmutation'
  AND item_ref = $2
ORDER BY created_at DESC
LIMIT $3
```

**Campos relevantes:**
- `created_at` - Timestamp del evento
- `action_type` - 'mark_clean' | 'set_remaining'
- `actor_type` - 'master' | 'student' | 'automation'
- `actor_ref` - Referencia del actor
- `surface_key` - Superficie de origen
- `meta` - Metadatos adicionales

---

### 3.3. Catálogos

**Resolución de items:**
- `item_ref` → `items_transmutaciones` (catálogo)
- `lista_id` → `listas_transmutaciones` (catálogo)

**Campos usados del catálogo:**
- `item.nombre` - Nombre del item
- `item.nivel` - Nivel requerido
- `item.frecuencia_dias` - Threshold para recurrentes
- `item.critical_multiplier` - Multiplicador crítico
- `lista.nombre` - Nombre de la lista
- `lista.tipo` - 'recurrente' | 'una_vez'
- `lista.orden` - Orden de la lista

**Fail-open:**
- Si item no encontrado: `item_nombre="NO_RESUELTO"`, `warnings[]` añadido
- Si lista no encontrada: `lista_nombre="Sin lista (NO_RESUELTO)"`, `warnings[]` añadido

---

## 4. CÁLCULO DE ESTADOS (NO INVENTAR)

### 4.1. Items Recurrentes

**Lógica determinista:**
```javascript
const lastCleaned = state.shared_last_cleaned_at;
const thresholdDays = item.frecuencia_dias || 7;
const criticalMultiplier = item.critical_multiplier || 2.0;
const criticalThreshold = thresholdDays * criticalMultiplier;

if (!lastCleaned) {
  return 'never';
}

const daysSince = Math.floor((now - lastCleaned) / (1000 * 60 * 60 * 24));

if (daysSince < thresholdDays) {
  return 'reviewed';
} else if (daysSince < criticalThreshold) {
  return 'pending';
} else {
  return 'important';
}
```

**Fuente de umbrales:**
- `threshold_days` = `item.frecuencia_dias` (del catálogo)
- `critical_multiplier` = `item.critical_multiplier` (del catálogo)
- NO se inventan valores

---

### 4.2. Items Una Vez

**Lógica determinista:**
```javascript
const remaining = state.shared_remaining ?? null;
const completed = state.shared_completed ?? 0;

if (remaining === null && completed === 0) {
  return 'never';
}

if (remaining !== null && remaining <= 0) {
  return 'reviewed';
}

return 'pending';
```

**NO existe "important" para una_vez:**
- Solo: never, pending, reviewed

---

### 4.3. Verificación de Nivel

**Lógica:**
- Si `item.nivel > nivel_efectivo` del alumno → NO APLICA
- Items no aplicables NO aparecen en megalista
- `nivel_efectivo` obtenido desde Level Engine v1

---

## 5. WARNINGS Y FAIL-OPEN

### 5.1. Warnings en Respuesta

**Campo `warnings[]` en megalist:**
- Solo presente si hay warnings
- Tipos:
  - `item_not_found` - Item no encontrado en catálogo
  - `lista_not_found` - Lista no encontrada en catálogo

**Fail-open:**
- Si item no encontrado: continúa, marca como "NO_RESUELTO"
- Si lista no encontrada: continúa, marca como "Sin lista (NO_RESUELTO)"
- NO falla la megalista completa

---

### 5.2. Alumno en Pausa

**Comportamiento:**
- Cleaning Engine excluye automáticamente alumnos pausados
- Si se intenta limpiar un alumno pausado: retorna `null` (no error)
- Megalista puede mostrar alumno pausado (pero no se puede limpiar)

---

## 6. ACCIONES PERMITIDAS

### 6.1. Limpieza SHARED

**Solo SHARED:**
- Este panel SOLO permite limpiezas SHARED
- NO existe opción para limpieza PDE
- `clean_layer='shared'` forzado en backend

**Actor:**
- `actor_type='master'` forzado en backend
- `surface_key='master.alquimia_alumno'` (fijo)

---

### 6.2. Limpieza Ítem-por-Ítem

**Solo individual:**
- NO existe "limpiar todo"
- NO existe "limpiar lista"
- Solo item individual

---

## 7. LÍMITES EXPLÍCITOS

### 7.1. Sin Sesiones

**Concepto de sesión:**
- ❌ NO existe `session_id` en `cleaning_events`
- ❌ NO existe tabla `cleaning_sessions`
- ❌ NO hay agrupación por sesión

**Implicaciones:**
- Informe v1 solo por rango de fechas
- No se puede agrupar eventos por "sesión de limpieza"
- Preparación para automatización futura (ver `CLEANING_REPORT_AUTOMATION_READY_NOTES_V1.md`)

---

### 7.2. Sin Limpiar Todo

**Prohibido:**
- ❌ NO existe botón "limpiar todo"
- ❌ NO existe "limpiar lista"
- Solo item individual

---

### 7.3. Sin PDE

**Solo SHARED:**
- ❌ NO existe opción para limpieza PDE
- ❌ NO se muestra estado PDE
- Solo capa SHARED

---

## 8. RESUMEN Y PORCENTAJES

### 8.1. Resumen Superior

**Contadores:**
- Total
- Nunca
- Importante
- Pendiente
- Revisado (total)
- Revisado por Alumno
- Revisado por Master

**Porcentaje:**
- `percent_reviewed = (reviewed / total) * 100`
- Barra de progreso visual
- Actualización automática tras limpieza

---

## 9. ARQUITECTURA

### 9.1. Servicio Megalista

**Archivo:** `src/core/master/services/alquimia-alumno-megalist-service.js`

**Responsabilidades:**
- Leer `cleaning_item_state` (SHARED)
- Resolver items desde catálogo
- Calcular estados determinísticos
- Agrupar por listas
- Separar revisados por actor
- Retornar estructura canónica

**NO calcula:**
- NO calcula estados en UI
- NO duplica lógica de Cleaning Engine
- Solo lee y proyecta

---

### 9.2. Cliente JS

**Archivo:** `public/js/master/master-alquimia-alumno-client.js`

**Reglas:**
- DOM API only (sin innerHTML)
- No lógica de negocio
- Refetch después de mutaciones
- Bootstrap autoejecutable con guards

**Estado:**
- `students[]` - Lista de alumnos
- `selectedStudentId` - Alumno seleccionado
- `megalistData` - Datos de megalista
- `loading` - Estado de carga

---

### 9.3. Handler UI

**Archivo:** `src/endpoints/master-templo-luz-alquimia-alumno.js`

**Responsabilidades:**
- Renderizar página MASTER canónica
- Pasar `activePath` para sidebar
- Contenedor HTML mínimo (cliente JS construye todo)

---

## 10. INTEGRACIÓN CON CLEANING ENGINE

### 10.1. Delegación

**Limpieza:**
- `POST /master/api/alquimia-alumno/clean` → `markCleanStudent()` del Cleaning Engine
- Cleaning Engine es el único decisor
- UI solo muestra y orquesta

---

### 10.2. Validaciones

**Cleaning Engine valida:**
- Alumno en pausa (excluye automáticamente)
- Nivel efectivo (items no aplicables)
- Idempotencia (execution_key)
- Item existe en catálogo

**UI NO valida:**
- UI confía en Cleaning Engine
- Si Cleaning Engine retorna `null`, UI muestra estado actual

---

## 11. VERIFICACIÓN

### 11.1. Checks Obligatorios

- ✅ `npm run check:master-ui` (si existe)
- ✅ Assembly checks
- ✅ Sin errores de linting

### 11.2. Pruebas Manuales

1. Abrir `/master/templo-luz/alquimia-alumno`
2. Verificar empty state sin selección
3. Seleccionar alumno desde dropdown
4. Verificar deep-link: `?student_id=123` autoselecciona
5. Verificar orden: never → important → pending → reviewed
6. Verificar revisados separados (alumno/master)
7. Limpiar un item pendiente
8. Verificar que cae a revisados y % cambia
9. Abrir historial de un item
10. Verificar informe básico (Master vs Alumno)

---

## 12. NOTAS

- **Sin UI de sesiones todavía:** El informe v1 no agrupa por sesión
- **Extensible:** El sistema permite agregar más estados sin romper compatibilidad
- **Auditable:** Todas las operaciones quedan registradas en `cleaning_events`
- **Reversible:** Soft delete permite reversión (aunque no implementado en UI)

---

**Estado:** ✅ Implementado y funcional

**Referencias:**
- Diagnóstico: `docs/DIAGNOSTICO_REALIDAD_CLEANING_V1.md`
- Contratos API: `docs/MASTER_API_ALQUIMIA_ALUMNO_CONTRACTS_V1.md`
- Notas automatización: `docs/CLEANING_REPORT_AUTOMATION_READY_NOTES_V1.md`
