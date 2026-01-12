# 🔍 DIAGNÓSTICO FORENSE ESPECÍFICO — MOTOR DE ESTADOS RECURRENTES
**AuriPortal / Aurelín — DOMINIO MASTER**  
**Fecha:** 2026-01-13  
**Modo:** SOLO LECTURA — PROHIBIDO IMPLEMENTAR O MODIFICAR  
**Estado:** DIAGNÓSTICO COMPLETO

---

## A) ¿EXISTE MOTOR RECURRENTE BACKEND? (sí / no)

**SÍ.** Existe un motor backend que calcula estados recurrentes, pero está **DUPLICADO** en múltiples lugares y **PARCIALMENTE DESPLAZADO** a la UI.

---

## B) DÓNDE ESTÁ Y QUÉ HACE

### B.1 Motor Principal en Backend

**Archivo:** `src/services/alquimia-general-service.js`  
**Función:** `getStudentsForItem()` (líneas 462-747)  
**Sección específica:** Líneas 569-642 (bloque `if (tipo === 'recurrente')`)

**Estados que calcula:**
- `'never'` - Nunca limpiado (cuando `days_since_last_clean === null`)
- `'reviewed'` - Revisado (cuando `days_since_last_clean < threshold_days`)
- `'pending'` - Pendiente (cuando `threshold_days <= days_since_last_clean < criticalThreshold`)
- `'important'` - Importante revisar (cuando `days_since_last_clean >= criticalThreshold`)

**Parámetros que usa:**
- `item.frecuencia_dias` (default: 7 días) → `thresholdDays`
- `item.critical_multiplier` (default: 2.0) → `criticalMultiplier`
- `criticalThreshold = thresholdDays * criticalMultiplier`
- `sharedData.days_since_last_clean` o `student.days_since_last_clean` (compatibilidad legacy)

**Qué devuelve:**
- Enum de estado: `state: 'never' | 'reviewed' | 'pending' | 'important'`
- NO devuelve color (el frontend lo asigna)
- NO devuelve columna (el frontend agrupa)
- SÍ devuelve `threshold_days` y `critical_multiplier` en el DTO para que el frontend los use

**Lógica exacta (líneas 597-610):**
```javascript
let state;
if (daysSince === null) {
  state = 'never';
} else if (daysSince < thresholdDays) {
  state = 'reviewed';
} else if (daysSince < criticalThreshold) {
  state = 'pending';
} else {
  state = 'important';
}
```

### B.2 Motor Secundario en Backend (Alquimia Alumno)

**Archivo:** `src/core/master/services/alquimia-alumno-megalist-service.js`  
**Función:** `calculateItemState()` (líneas 28-99)

**Estados que calcula:**
- `'never'` - Nunca limpiado
- `'reviewed'` - Revisado
- `'pending'` - Pendiente
- `'important'` - Importante revisar

**Parámetros que usa:**
- `item.frecuencia_dias` (default: 7 días)
- `item.critical_multiplier` (default: 2.0)
- `state.shared_last_cleaned_at` (desde `cleaning_item_state`)

**Lógica exacta (líneas 44-61):**
```javascript
const daysSince = Math.floor((now - lastCleanedDate) / (1000 * 60 * 60 * 24));

if (daysSince < thresholdDays) {
  return 'reviewed';
} else if (daysSince < criticalThreshold) {
  return 'pending';
} else {
  return 'important';
}
```

**Diferencia con motor principal:**
- Este motor se usa para **Alquimia Alumno** (megalist)
- El motor principal se usa para **Alquimia General** (flotante)
- **AMBOS calculan lo mismo**, pero en contextos diferentes

### B.3 Repositorio (NO calcula estados)

**Archivo:** `src/infra/repos/master-student-transmutation-read-repo-pg.js`  
**Función:** `getStudentsForItemFromCleaningEngine()` (líneas 154-332)

**Comentario explícito (líneas 6, 83, 103-104):**
```javascript
// - MASTER NO calcula estados temporales (clean/pending/critical)
// Placeholder, no se calculan aquí
// NO calcular temporal_state aquí (pertenece a STUDENT)
// temporal_state: 'clean' | 'pending' | 'critical'
```

**Qué hace:**
- Calcula `days_since_last_clean` (líneas 242-250)
- **NO calcula estado** (solo datos crudos)
- Devuelve `days_since_last_clean` para que el servicio lo use

---

## C) QUÉ PARTE SE DUPLICÓ EN UI

### C.1 Cálculo de Estado en Frontend

**Archivo:** `public/js/master/master-alquimia-general-client.js`  
**Función:** `calculateStudentState()` (líneas 1615-1640)

**Estados que calcula:**
- `'never'` - Nunca limpiado
- `'reviewed'` - Revisado
- `'pending'` - Pendiente
- `'important'` - Importante revisar

**Parámetros que usa:**
- `normalized?.threshold_days` (del DTO del backend, default: 7)
- `normalized?.critical_multiplier` (del DTO del backend, default: 2.0)
- `layerData.days_since_last_clean` (del DTO del backend)

**Lógica exacta (líneas 1619-1629):**
```javascript
if (itemKind === 'recurrente') {
  const days = layerData.days_since_last_clean;
  if (days === null || days === undefined) return 'never';
  const thresholdDays = normalized?.threshold_days || 7;
  const criticalMultiplier = normalized?.critical_multiplier || 2.0;
  const criticalThreshold = thresholdDays * criticalMultiplier;
  
  if (days < thresholdDays) return 'reviewed';
  if (days < criticalThreshold) return 'pending';
  return 'important';
}
```

**Cuándo se usa:**
- Para agrupar estudiantes en columnas del flotante (línea 1217)
- Para calcular estado cuando `layerView` cambia (SHARED vs PDE)

### C.2 Cálculo de Estado Visual (Display) en Frontend

**Archivo:** `public/js/master/master-alquimia-general-client.js`  
**Función:** `getStudentState()` (líneas 1645-1665)

**Estados que calcula:**
- `'Nunca'` - Texto para display
- `'Revisado'` - Texto para display
- `'Pendiente'` - Texto para display
- `'Importante'` - Texto para display

**Parámetros que usa:**
- **HARDCODEADO:** `days < 7` → 'Revisado' (línea 1652)
- **HARDCODEADO:** `days < 14` → 'Pendiente' (línea 1653)
- **HARDCODEADO:** `days >= 14` → 'Importante' (línea 1654)

**❌ PROBLEMA CRÍTICO:**
- Esta función **IGNORA** `threshold_days` y `critical_multiplier` del backend
- Usa valores hardcodeados (7 y 14) que pueden no coincidir con los del item
- Si un item tiene `frecuencia_dias = 20`, el frontend seguirá usando 7/14

**Lógica exacta (líneas 1649-1654):**
```javascript
if (tipo === 'recurrente') {
  const days = layerData.days_since_last_clean;
  if (days === null) return 'Nunca';
  if (days < 7) return 'Revisado';      // ❌ HARDCODEADO
  if (days < 14) return 'Pendiente';    // ❌ HARDCODEADO
  return 'Importante';
}
```

---

## D) QUÉ PARTE SIGUE SIENDO VÁLIDA

### D.1 Motor Backend Principal

**Estado:** ✅ **VÁLIDO Y OPERATIVO**

**Ubicación:** `src/services/alquimia-general-service.js::getStudentsForItem()` (líneas 569-642)

**Qué hace bien:**
- Calcula estados usando `threshold_days` y `critical_multiplier` del item
- Devuelve enum de estado (`'never' | 'reviewed' | 'pending' | 'important'`)
- Devuelve `threshold_days` y `critical_multiplier` en el DTO
- Devuelve `counts` por estado (líneas 625-630)

**Qué devuelve en DTO:**
```javascript
{
  students: [
    {
      state: 'reviewed',  // ✅ Calculado por backend
      threshold_days: 7,
      critical_multiplier: 2.0,
      days_since_last_clean: 3
    }
  ],
  counts: {
    reviewed: 5,
    pending: 3,
    important: 2,
    never: 1
  },
  threshold_days: 7,
  critical_multiplier: 2.0
}
```

### D.2 Motor Backend Secundario (Alquimia Alumno)

**Estado:** ✅ **VÁLIDO Y OPERATIVO**

**Ubicación:** `src/core/master/services/alquimia-alumno-megalist-service.js::calculateItemState()` (líneas 28-99)

**Qué hace bien:**
- Calcula estados para megalist de Alquimia Alumno
- Usa misma lógica que motor principal
- Respeta `threshold_days` y `critical_multiplier` del item

### D.3 Repositorio (Datos Crudos)

**Estado:** ✅ **VÁLIDO Y OPERATIVO**

**Ubicación:** `src/infra/repos/master-student-transmutation-read-repo-pg.js::getStudentsForItemFromCleaningEngine()` (líneas 154-332)

**Qué hace bien:**
- Calcula `days_since_last_clean` correctamente
- **NO calcula estado** (correcto: solo datos crudos)
- Devuelve datos simétricos SHARED/PDE

---

## E) QUÉ PARTE FUE DESPLAZADA O TAPADA

### E.1 Sistema Legacy `temporal_state` (Código Muerto)

**Evidencia de sistema anterior:**

**Archivo:** `src/infra/repos/master-student-transmutation-read-repo-pg.js`  
**Líneas 6, 83, 103-104:**
```javascript
// - MASTER NO calcula estados temporales (clean/pending/critical)
// Placeholder, no se calculan aquí
// NO calcular temporal_state aquí (pertenece a STUDENT)
// temporal_state: 'clean' | 'pending' | 'critical'
```

**Análisis:**
- Existía un sistema anterior con estados `'clean' | 'pending' | 'critical'`
- Fue desplazado a dominio STUDENT (no MASTER)
- El repositorio explícitamente **NO calcula** estos estados
- El sistema actual usa `'never' | 'reviewed' | 'pending' | 'important'` (nomenclatura diferente)

**Archivo:** `src/infra/repos/student-transmutation-state-repo-pg.js`  
**Línea 129:**
```javascript
temporal_state: temporalState,
```

**Análisis:**
- El repositorio STUDENT aún calcula `temporal_state`
- Esto confirma que el sistema legacy fue desplazado a STUDENT, no eliminado

### E.2 Cálculo de Estado Duplicado en UI

**Estado:** ❌ **DESPLAZADO INCORRECTAMENTE**

**Ubicación:** `public/js/master/master-alquimia-general-client.js::calculateStudentState()` (líneas 1615-1640)

**Problema:**
- El backend **YA calcula** el estado y lo devuelve en `student.state`
- El frontend **VUELVE A CALCULAR** el mismo estado
- Esto es duplicación innecesaria

**Evidencia:**
- Backend devuelve `student.state = 'reviewed'` (línea 618 de `alquimia-general-service.js`)
- Frontend recalcula `state = calculateStudentState(...)` (línea 1217 de `master-alquimia-general-client.js`)
- Ambos usan la misma lógica, pero el frontend ignora el estado del backend

### E.3 Valores Hardcodeados en UI

**Estado:** ❌ **TAPADO POR HARDCODE**

**Ubicación:** `public/js/master/master-alquimia-general-client.js::getStudentState()` (líneas 1645-1665)

**Problema:**
- El backend devuelve `threshold_days` y `critical_multiplier` en el DTO
- El frontend **IGNORA** estos valores y usa hardcode (7 y 14)
- Esto tapa la configuración del item

**Evidencia:**
- Backend devuelve `threshold_days: 20` (si item tiene `frecuencia_dias = 20`)
- Frontend usa `days < 7` (hardcode, ignora el 20)
- Resultado: estados incorrectos para items con `frecuencia_dias != 7`

---

## F) CONCLUSIÓN

### F.1 Estado Real del Motor

El motor de estados recurrentes **EXISTE Y ESTÁ OPERATIVO** en el backend, pero está **DUPLICADO** en la UI y **PARCIALMENTE TAPADO** por valores hardcodeados.

**Motor Backend Principal:**
- ✅ Calcula estados correctamente usando `threshold_days` y `critical_multiplier`
- ✅ Devuelve enum de estado en DTO
- ✅ Devuelve parámetros en DTO para que el frontend los use
- ✅ Operativo en Alquimia General (flotante)

**Motor Backend Secundario:**
- ✅ Calcula estados correctamente para Alquimia Alumno (megalist)
- ✅ Usa misma lógica que motor principal
- ✅ Operativo en Alquimia Alumno

**Motor Frontend:**
- ❌ Duplica lógica del backend innecesariamente
- ❌ Ignora estado calculado por backend (`student.state`)
- ❌ Usa valores hardcodeados (7, 14) que tapan configuración del item
- ⚠️ Solo se usa para agrupación en columnas, no para display de texto

### F.2 Historia del Sistema

Existió un sistema anterior con estados `'clean' | 'pending' | 'critical'` que fue desplazado a dominio STUDENT. El sistema actual usa `'never' | 'reviewed' | 'pending' | 'important'` y está implementado en backend, pero la UI lo recalcula y usa valores hardcodeados que lo tapan parcialmente.

**FIN DEL DIAGNÓSTICO**
