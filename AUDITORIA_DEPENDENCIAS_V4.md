# AUDITORÍA DE DEPENDENCIAS - AURIPORTAL V4

**Versión:** 4.0  
**Fecha:** 2024  
**Arquitecto:** Auditoría Técnica  
**Objetivo:** Mapear dependencias, identificar riesgos y establecer reglas de cambio seguro

---

## RESUMEN EJECUTIVO

AuriPortal v4 implementa una arquitectura basada en dominios con separación clara entre:
- **Módulos de dominio** (`src/modules/*-v4.js`): Lógica de negocio
- **Repositorios** (`src/infra/repos/*-repo-pg.js`): Acceso a datos PostgreSQL
- **Endpoints** (`src/endpoints/*.js`): Controladores HTTP
- **Feature flags** (`src/core/flags/feature-flags.js`): Control de activación por entorno

**PostgreSQL es la ÚNICA fuente de verdad** para todos los datos de alumnos, prácticas, pausas y niveles.

### Estado Actual

- ✅ **6 módulos v4 activos** (student, practice, pausa, nivel, streak, suscripcion)
- ✅ **3 repositorios PostgreSQL** implementados (student, practice, pausa)
- ✅ **Observabilidad activa** (logs estructurados con request correlation)
- ✅ **Admin panel v4** operativo
- ⚠️ **Feature flags v4 desactivados** (progress_v4: off, admin_redesign_v4: off)
- ⚠️ **Módulos legacy coexisten** (student.js, nivel.js, streak.js, suscripcion.js)

### Riesgos Identificados

1. **CRÍTICO**: Módulos v4 modifican estado del alumno (nivel, streak, suscripción) sin feature flags activos
2. **ALTO**: Dependencias circulares potenciales entre módulos v4 (nivel-v4 → student-v4 → pausa-v4)
3. **MEDIO**: Coexistencia con módulos legacy puede causar inconsistencias
4. **BAJO**: Feature flags definidos pero no utilizados en código de producción

---

## MAPA DE DOMINIOS V4

### 1. STUDENT-V4 (`src/modules/student-v4.js`)

**Responsabilidad:** Gestión centralizada de alumnos en PostgreSQL

**Depende de:**
- `pausa-v4.js` → `getPausaActiva()`, `calcularDiasPausados()`, `calcularDiasPausadosHastaFecha()`
- `practice-v4.js` → `crearPractica()`
- `infra/repos/student-repo-pg.js` → Acceso a PostgreSQL
- `core/observability/logger.js` → Logging estructurado

**Usado por:**
- `enter.js` → `getOrCreateStudent()`, `findStudentByEmail()`
- `practicar.js` → `getOrCreateStudent()`, `findStudentByEmail()`
- `typeform-webhook-v4.js` → `updateStudentStreak()`, `updateStudentUltimaPractica()`, `findStudentByEmail()`
- `admin-panel-v4.js` → `createOrUpdateStudent()`, `findStudentByEmail()`
- `streak-v4.js` → `updateStudentStreak()`, `updateStudentUltimaPractica()`, `createStudentPractice()`
- `nivel-v4.js` → `findStudentByEmail()`, `updateStudentNivel()`
- `suscripcion-v4.js` → `updateStudentEstadoSuscripcion()`, `findStudentById()`, `findStudentByEmail()`
- `auth-context.js` → `findStudentByEmail()`, `getOrCreateStudent()`
- `admin-data.js` → (indirecto vía otros módulos)

**Funciones críticas:**
- `getDiasActivos()` → Calcula días activos considerando pausas (afecta nivel automático)
  - **PROTEGIDA POR FEATURE FLAG:** `dias_activos_v2` (estado: 'off')
  - Preparada para evolución segura sin deploy completo
  - Comportamiento actual intacto mientras flag está 'off'
- `updateStudentNivel()` → Modifica nivel_actual en PostgreSQL
- `updateStudentStreak()` → Modifica streak en PostgreSQL
- `updateStudentEstadoSuscripcion()` → Modifica estado_suscripcion en PostgreSQL

**Feature flags:**
- `dias_activos_v2`: 'off' (preparado pero no activo)

**Riesgo de cambio:** 🔴 **ALTO**
- Afecta cálculo de días activos (base para niveles)
- Modifica estado del alumno directamente
- Usado por TODOS los endpoints principales
- Cambios pueden romper cálculos de nivel, streak y suscripción

**Reglas:**
- ❌ **NUNCA modificar `getDiasActivos()` sin pruebas exhaustivas en BETA**
- ✅ **`getDiasActivos()` protegida por feature flag `dias_activos_v2`** (infraestructura lista para cambio futuro)
- ❌ **NUNCA cambiar la normalización de alumnos sin verificar compatibilidad**
- ✅ Cambios en logging son seguros
- ⚠️ Cambios en actualizaciones requieren verificar transacciones

---

### 2. PRACTICE-V4 (`src/modules/practice-v4.js`)

**Responsabilidad:** Gestión de prácticas en PostgreSQL

**Depende de:**
- `infra/repos/practice-repo-pg.js` → Acceso a PostgreSQL
- `core/observability/logger.js` → Logging estructurado

**Usado por:**
- `student-v4.js` → `crearPractica()` (helper para crear prácticas desde student)
- `typeform-webhook-v4.js` → `existsForDate()`, `crearPractica()`
- `admin-data.js` → `findByAlumnoId()` (listado de prácticas)
- `practica-registro.js` → `existsForDate()`, `crearPractica()`

**Funciones críticas:**
- `crearPractica()` → Inserta práctica en PostgreSQL
- `existsForDate()` → Verifica duplicados (previene prácticas duplicadas)
- `haPracticadoHoy()` → Helper para verificar práctica diaria

**Feature flags:** Ninguno (siempre activo)

**Riesgo de cambio:** 🟡 **MEDIO**
- Afecta registro de prácticas (base para streak y estadísticas)
- Cambios en `existsForDate()` pueden permitir duplicados
- Cambios en `crearPractica()` pueden romper integridad de datos

**Reglas:**
- ❌ **NUNCA modificar `existsForDate()` sin verificar lógica de duplicados**
- ⚠️ Cambios en `crearPractica()` requieren verificar constraints de BD
- ✅ Cambios en logging son seguros
- ✅ Agregar nuevos campos opcionales es seguro

---

### 3. PAUSA-V4 (`src/modules/pausa-v4.js`)

**Responsabilidad:** Gestión de pausas de suscripción en PostgreSQL

**Depende de:**
- `infra/repos/pausa-repo-pg.js` → Acceso a PostgreSQL
- `core/observability/logger.js` → Logging estructurado

**Usado por:**
- `student-v4.js` → `getPausaActiva()`, `calcularDiasPausados()`, `calcularDiasPausadosHastaFecha()` (para cálculo de días activos)
- `suscripcion-v4.js` → `findByAlumnoId()`, `getPausaActiva()`, `crearPausa()`, `cerrarPausa()`
- `admin-panel-v4.js` → `getPausaActiva()`, `crearPausa()`, `cerrarPausa()`, `calcularDiasPausados()`
- `admin-data.js` → `calcularDiasPausados()`, `findByAlumnoId()`

**Funciones críticas:**
- `getPausaActiva()` → Detecta pausas sin fin (afecta cálculo de días activos)
- `calcularDiasPausados()` → Calcula total de días pausados (afecta días activos y niveles)
- `calcularDiasPausadosHastaFecha()` → Calcula días pausados hasta fecha específica (usado en días activos congelados)
- `crearPausa()` → Crea nueva pausa (modifica estado del alumno)
- `cerrarPausa()` → Cierra pausa activa (modifica estado del alumno)

**Feature flags:** Ninguno (siempre activo)

**Riesgo de cambio:** 🔴 **ALTO**
- Afecta cálculo de días activos (base para niveles automáticos)
- Modifica estado de suscripción del alumno
- Cambios en cálculo de días pausados pueden romper niveles
- Lógica de pausas activas es crítica para congelar días activos

**Reglas:**
- ❌ **NUNCA modificar `calcularDiasPausados()` sin pruebas exhaustivas en BETA**
- ❌ **NUNCA modificar `getPausaActiva()` sin verificar impacto en días activos**
- ❌ **NUNCA cambiar lógica de pausas activas sin feature flag**
- ⚠️ Cambios en creación/cierre de pausas requieren verificar sincronización con `estado_suscripcion`
- ✅ Cambios en logging son seguros

---

### 4. NIVEL-V4 (`src/modules/nivel-v4.js`)

**Responsabilidad:** Sistema de niveles automático basado en días activos

**Depende de:**
- `student-v4.js` → `findStudentByEmail()`, `updateStudentNivel()`, `getDiasActivos()` (import dinámico)
- `database/pg.js` → `nivelesFases.getFasePorNivel()` (legacy, debería migrarse)

**Usado por:**
- `enter.js` → `actualizarNivelSiCorresponde()`, `getNivelInfo()`
- `practicar.js` → `getNivelInfo()`
- `aprender.js` → `getNivelInfo()`
- `onboarding-complete.js` → `actualizarNivelSiCorresponde()`, `getNivelInfo()`
- `typeform-webhook-v4.js` → `calcularNivelAutomatico()`, `getNivelInfo()`
- `admin-panel-v4.js` → `actualizarNivelSiCorresponde()`, `getNivelPorDiasActivos()`, `recalcularNivelesTodosAlumnos()`
- `admin-data.js` → `getFasePorNivel()`
- `template-engine.js` → `getFasePorNivel()`
- `scheduler.js` → `recalcularNivelesTodosAlumnos()` (cron job)

**Funciones críticas:**
- `actualizarNivelSiCorresponde()` → **MODIFICA nivel_actual en PostgreSQL** (solo si nivel automático > nivel actual)
  - **PROTEGIDA POR FEATURE FLAG:** `nivel_calculo_v2` (estado: 'off')
  - Preparada para evolución segura sin deploy completo
  - Comportamiento actual intacto mientras flag está 'off'
- `getNivelPorDiasActivos()` → Calcula nivel según días activos (usa `getDiasActivos()` de student-v4)
- `recalcularNivelesTodosAlumnos()` → Recalcula niveles masivamente (usado en cron jobs)
- `getNivelInfo()` → Retorna información completa del nivel (lectura, no modifica)

**Feature flags:**
- `nivel_calculo_v2`: 'off' (preparado pero no activo)

**Riesgo de cambio:** 🔴 **ALTO**
- **MODIFICA nivel_actual directamente en PostgreSQL**
- Afecta progresión de alumnos (niveles determinan acceso a contenido)
- Cambios en thresholds pueden cambiar niveles de TODOS los alumnos
- `recalcularNivelesTodosAlumnos()` puede ejecutarse en producción sin control

**Reglas:**
- ❌ **NUNCA modificar `NIVEL_THRESHOLDS` sin feature flag y pruebas en BETA**
- ✅ **`actualizarNivelSiCorresponde()` protegida por feature flag `nivel_calculo_v2`** (infraestructura lista para cambio futuro)
- ❌ **NUNCA ejecutar `recalcularNivelesTodosAlumnos()` en producción sin backup**
- ⚠️ Cambios en cálculo de nivel requieren verificar impacto en días activos
- ✅ Cambios en `getNivelInfo()` (solo lectura) son relativamente seguros
- ✅ Agregar nuevas funciones de consulta es seguro

---

### 5. STREAK-V4 (`src/modules/streak-v4.js`)

**Responsabilidad:** Gestión de racha diaria de prácticas

**Depende de:**
- `student-v4.js` → `updateStudentStreak()`, `updateStudentUltimaPractica()`, `createStudentPractice()`
- `suscripcion-v4.js` → `puedePracticarHoy()` (verifica si suscripción está pausada)
- `config/milestones.js` → `MILESTONES` (array de hitos: 25, 50, 75...)
- `core/observability/logger.js` → Logging estructurado

**Usado por:**
- `enter.js` → `checkDailyStreak()`, `detectMilestone()`
- `practicar.js` → `checkDailyStreak()`

**Funciones críticas:**
- `checkDailyStreak()` → **MODIFICA streak y fecha_ultima_practica en PostgreSQL**
  - **PROTEGIDA POR FEATURE FLAG:** `streak_calculo_v2` (estado: 'off')
  - Preparada para evolución segura sin deploy completo
  - Comportamiento actual intacto mientras flag está 'off'
- `detectMilestone()` → Detecta si streak es un hito (25, 50, 75...)

**Feature flags:**
- `streak_calculo_v2`: 'off' (preparado pero no activo)

**Riesgo de cambio:** 🔴 **ALTO**
- **MODIFICA streak directamente en PostgreSQL**
- Afecta motivación y gamificación del alumno
- Cambios en lógica de racha pueden resetear rachas incorrectamente
- Integración con `puedePracticarHoy()` es crítica (bloquea streak si está pausado)

**Reglas:**
- ✅ **`checkDailyStreak()` protegida por feature flag `streak_calculo_v2`** (infraestructura lista para cambio futuro)
- ❌ **NUNCA modificar lógica de `checkDailyStreak()` sin feature flag y pruebas en BETA**
- ❌ **NUNCA cambiar cálculo de diferencia de días sin verificar timezone (horario España)**
- ⚠️ Cambios en `forcePractice` requieren verificar impacto en suscripciones pausadas
- ✅ Cambios en frases motivacionales son seguros
- ✅ Agregar nuevos milestones es seguro

---

### 6. SUSCRIPCION-V4 (`src/modules/suscripcion-v4.js`)

**Responsabilidad:** Gestión de pausa/reactivación de suscripciones

**Depende de:**
- `pausa-v4.js` → `findByAlumnoId()`, `getPausaActiva()`, `crearPausa()`, `cerrarPausa()`
- `student-v4.js` → `updateStudentEstadoSuscripcion()`, `findStudentById()`, `findStudentByEmail()`

**Usado por:**
- `enter.js` → `gestionarEstadoSuscripcion()` (verifica si puede practicar)
- `streak-v4.js` → `puedePracticarHoy()` (bloquea streak si está pausado)

**Funciones críticas:**
- `gestionarEstadoSuscripcion()` → Verifica y actualiza estado de suscripción
  - **PROTEGIDA POR FEATURE FLAG:** `suscripcion_control_v2` (estado: 'off')
  - Preparada para evolución segura sin deploy completo
  - Comportamiento actual intacto mientras flag está 'off'
- `puedePracticarHoy()` → Verifica si puede practicar (bloquea acceso si pausada)
  - **PROTEGIDA POR FEATURE FLAG:** `suscripcion_control_v2` (estado: 'off')
  - Preparada para evolución segura sin deploy completo
  - Comportamiento actual intacto mientras flag está 'off'
- `pausarSuscripcion()` → Crea pausa y actualiza estado (privada, usada internamente)
- `reactivarSuscripcion()` → Cierra pausa y actualiza estado (privada, usada internamente)

**Feature flags:**
- `suscripcion_control_v2`: 'off' (preparado pero no activo)

**Riesgo de cambio:** 🔴 **ALTO**
- **MODIFICA estado_suscripcion directamente en PostgreSQL**
- Bloquea acceso a prácticas si está pausada
- Afecta cálculo de días activos (congela días si está pausada)
- Cambios pueden permitir acceso no autorizado o bloquear acceso legítimo

**Reglas:**
- ✅ **`puedePracticarHoy()` protegida por feature flag `suscripcion_control_v2`** (infraestructura lista para cambio futuro)
- ✅ **`gestionarEstadoSuscripcion()` protegida por feature flag `suscripcion_control_v2`** (infraestructura lista para cambio futuro)
- ❌ **NUNCA modificar lógica de pausa/reactivación sin feature flag**
- ⚠️ Cambios en sincronización con pausas requieren verificar integridad de datos
- ✅ Cambios en logging son seguros

---

## TABLA DE RIESGOS POR MÓDULO

| Módulo | Riesgo | Razón | Feature Flags | Requiere BETA |
|--------|--------|-------|---------------|---------------|
| **student-v4** | 🔴 ALTO | Modifica estado del alumno, base para cálculos | ✅ `dias_activos_v2` | ✅ Sí |
| **practice-v4** | 🟡 MEDIO | Afecta registro de prácticas, puede permitir duplicados | ❌ Ninguno | ⚠️ Recomendado |
| **pausa-v4** | 🔴 ALTO | Afecta días activos y niveles, modifica estado | ❌ Ninguno | ✅ Sí |
| **nivel-v4** | 🔴 ALTO | Modifica nivel_actual, afecta progresión | ✅ `nivel_calculo_v2` | ✅ Sí |
| **streak-v4** | 🔴 ALTO | Modifica streak, afecta gamificación | ✅ `streak_calculo_v2` | ✅ Sí |
| **suscripcion-v4** | 🔴 ALTO | Bloquea acceso, modifica estado_suscripcion | ✅ `suscripcion_control_v2` | ✅ Sí |

---

## DEPENDENCIAS ENTRE MÓDULOS

### Gráfico de Dependencias

```
student-v4 (CORE)
  ├── pausa-v4 (usa para días activos)
  ├── practice-v4 (usa para crear prácticas)
  └── [usado por todos los demás módulos]

nivel-v4
  ├── student-v4 (usa getDiasActivos, updateStudentNivel)
  └── database/pg.js (legacy: nivelesFases)

streak-v4
  ├── student-v4 (usa updateStudentStreak, updateStudentUltimaPractica)
  └── suscripcion-v4 (usa puedePracticarHoy)

suscripcion-v4
  ├── pausa-v4 (usa getPausaActiva, crearPausa, cerrarPausa)
  └── student-v4 (usa updateStudentEstadoSuscripcion)

practice-v4
  └── [independiente, solo usa repositorio]

pausa-v4
  └── [independiente, solo usa repositorio]
```

### Dependencias Circulares Potenciales

⚠️ **POTENCIAL CIRCULAR:**
- `student-v4` → `pausa-v4` → (indirecto) → `student-v4`
- `nivel-v4` → `student-v4` → `pausa-v4` → (indirecto) → `nivel-v4`

**Estado actual:** ✅ **NO hay dependencias circulares directas** (se usan imports dinámicos cuando es necesario)

**Riesgo:** 🟡 **MEDIO** - Si se agregan dependencias directas, puede romperse

---

## ENDPOINTS QUE USAN MÓDULOS V4

### Endpoints Principales (Flujo de Usuario)

| Endpoint | Módulos Usados | Riesgo si Falla |
|----------|----------------|-----------------|
| `/enter` | student-v4, streak-v4, nivel-v4, suscripcion-v4 | 🔴 CRÍTICO - Bloquea acceso |
| `/practicar` | student-v4, nivel-v4, streak-v4 | 🔴 CRÍTICO - Bloquea práctica |
| `/aprender` | student-v4, nivel-v4 | 🟡 ALTO - Afecta experiencia |
| `/onboarding-complete` | student-v4, nivel-v4 | 🟡 ALTO - Afecta onboarding |

### Endpoints de Webhooks

| Endpoint | Módulos Usados | Riesgo si Falla |
|----------|----------------|-----------------|
| `/typeform-webhook-v4` | student-v4, practice-v4, nivel-v4 | 🔴 CRÍTICO - No registra prácticas |
| `/clickup-webhook` | (no usa módulos v4 directamente) | 🟢 BAJO |

### Endpoints de Admin

| Endpoint | Módulos Usados | Riesgo si Falla |
|----------|----------------|-----------------|
| `/admin/*` | student-v4, nivel-v4, pausa-v4, practice-v4 | 🟡 ALTO - Afecta gestión |

---

## SIMULADORES ADMIN READ-ONLY

**Versión:** 4.3.0  
**Fecha:** 2024  
**Objetivo:** Herramientas de diagnóstico para predecir cambios sin modificar datos

### Descripción

Los simuladores admin son herramientas de diagnóstico que ejecutan la lógica crítica del sistema **SIN escribir en PostgreSQL**. Permiten comparar resultados actuales vs resultados simulados para validar cambios antes de implementarlos.

**PRINCIPIO ABSOLUTO:** Los simuladores **NUNCA** ejecutan operaciones de escritura (INSERT/UPDATE/DELETE).

### Rutas de Simuladores

| Ruta | Descripción | Módulos Usados | Riesgo |
|------|-------------|----------------|--------|
| `/admin/simulations/nivel` | Simula cálculo de nivel | `nivel-simulator-v4.js`, `student-v4.js`, `nivel-v4.js` | 🟢 BAJO - Solo lectura |
| `/admin/simulations/streak` | Simula cálculo de streak | `streak-simulator-v4.js`, `student-v4.js`, `suscripcion-v4.js` | 🟢 BAJO - Solo lectura |
| `/admin/simulations/dias-activos` | Simula cálculo de días activos | `dias-activos-simulator-v4.js`, `student-v4.js`, `pausa-v4.js` | 🟢 BAJO - Solo lectura |

### Módulos de Simulación

#### 1. NIVEL-SIMULATOR-V4 (`src/modules/nivel-simulator-v4.js`)

**Responsabilidad:** Simular cálculo de nivel sin modificar datos

**Depende de:**
- `student-v4.js` → `getDiasActivos()` (solo lectura)
- `nivel-v4.js` → `getNivelPorDiasActivos()`, `getNombreNivel()`, `getFasePorNivel()`, `calcularNivelPorDiasActivos()` (funciones puras)

**Usado por:**
- `admin-panel-v4.js` → `renderSimulacionNivel()`

**GARANTÍAS:**
- ❌ NO llama a `updateStudentNivel()`
- ❌ NO ejecuta UPDATE en PostgreSQL
- ✅ SOLO calcula y compara resultados
- ✅ Usa `runSimulation()` para logs estructurados con request_id

**Riesgo de cambio:** 🟢 **BAJO** (solo lectura)

---

#### 2. STREAK-SIMULATOR-V4 (`src/modules/streak-simulator-v4.js`)

**Responsabilidad:** Simular cálculo de streak sin modificar datos

**Depende de:**
- `suscripcion-v4.js` → `puedePracticarHoy()` (solo lectura)
- `student-v4.js` → Acceso a propiedades normalizadas (solo lectura)

**Usado por:**
- `admin-panel-v4.js` → `renderSimulacionStreak()`

**GARANTÍAS:**
- ❌ NO llama a `updateStudentStreak()`
- ❌ NO llama a `updateStudentUltimaPractica()`
- ❌ NO llama a `createStudentPractice()`
- ❌ NO ejecuta UPDATE/INSERT en PostgreSQL
- ✅ SOLO calcula y compara resultados
- ✅ Replica lógica de decisión de `checkDailyStreak_LogicaActual()` sin escrituras
- ✅ Usa `runSimulation()` para logs estructurados con request_id

**Funciones exportadas:**
- `simulateStreakCambio({ student, fechaActual?, forcePractice?, env? })` → Resultado de simulación

**Riesgo de cambio:** 🟢 **BAJO** (solo lectura)

---

#### 3. DIAS-ACTIVOS-SIMULATOR-V4 (`src/modules/dias-activos-simulator-v4.js`)

**Responsabilidad:** Simular cálculo de días activos sin modificar datos

**Depende de:**
- `student-v4.js` → `getDiasActivos()` (solo lectura)
- `pausa-v4.js` → `calcularDiasPausados()`, `calcularDiasPausadosHastaFecha()`, `getPausaActiva()` (solo lectura)
- `infra/repos/student-repo-pg.js` → `getById()` (solo lectura)

**Usado por:**
- `admin-panel-v4.js` → `renderSimulacionDiasActivos()`

**GARANTÍAS:**
- ❌ NO ejecuta UPDATE/INSERT/DELETE en PostgreSQL
- ✅ SOLO llama a funciones de lectura
- ✅ SOLO calcula y compara resultados
- ✅ Replica lógica de `getDiasActivos()` sin escrituras
- ✅ Usa `runSimulation()` para logs estructurados con request_id

**Funciones exportadas:**
- `simulateDiasActivos({ student, fechaHasta?, modo? })` → Resultado de simulación

**Riesgo de cambio:** 🟢 **BAJO** (solo lectura)

---

### Reglas Críticas para Simuladores

1. ❌ **NUNCA escribir en DB desde simuladores** (ni directa ni indirectamente)
2. ❌ **NUNCA llamar funciones de escritura** (`updateStudentStreak`, `updateStudentNivel`, `createStudentPractice`, etc.)
3. ✅ **SOLO usar funciones de lectura** (`getDiasActivos`, `calcularDiasPausados`, `getPausaActiva`, etc.)
4. ✅ **Usar `runSimulation()` para logs estructurados** con request_id
5. ✅ **Endpoints SOLO GET, SOLO ADMIN** (protegidos por `requireAdminContext`)
6. ✅ **UI debe mostrar aviso claro:** "NO SE HA MODIFICADO NINGÚN DATO"

### Verificación de Seguridad

Para verificar que un simulador no escribe en DB:

```bash
# Buscar operaciones de escritura en simuladores
grep -r "UPDATE\|INSERT\|DELETE\|updateStudent\|createStudent\|updateStudent" src/modules/*-simulator-v4.js
# Debe retornar 0 resultados (solo comentarios o strings)
```

### Beneficios

- **Diagnóstico seguro:** Predecir cambios sin riesgo
- **Validación de lógica:** Comparar resultados actuales vs simulados
- **Debugging:** Entender comportamiento sin afectar datos
- **Testing:** Validar cambios antes de implementar

---

## FEATURE FLAGS

### Estado Actual

```javascript
FEATURE_FLAGS = {
  progress_v4: 'off',           // ❌ Desactivado
  admin_redesign_v4: 'off',     // ❌ Desactivado
  observability_extended: 'on', // ✅ Activado
  dias_activos_v2: 'off',       // ❌ Desactivado (protege getDiasActivos)
  nivel_calculo_v2: 'off',      // ❌ Desactivado (protege actualizarNivelSiCorresponde)
  streak_calculo_v2: 'off',      // ❌ Desactivado (protege checkDailyStreak)
  suscripcion_control_v2: 'off' // ❌ Desactivado (protege puedePracticarHoy y gestionarEstadoSuscripcion)
}
```

### Análisis

- ⚠️ **`progress_v4: 'off'`** → No se usa en código (definido pero no consultado)
- ⚠️ **`admin_redesign_v4: 'off'`** → No se usa en código (definido pero no consultado)
- ✅ **`observability_extended: 'on'`** → Activado y en uso (logging estructurado)
- ✅ **`dias_activos_v2: 'off'`** → Protege `getDiasActivos()` en student-v4.js (infraestructura lista)
- ✅ **`nivel_calculo_v2: 'off'`** → Protege `actualizarNivelSiCorresponde()` en nivel-v4.js (infraestructura lista)
- ✅ **`streak_calculo_v2: 'off'`** → Protege `checkDailyStreak()` en streak-v4.js (infraestructura lista)
- ✅ **`suscripcion_control_v2: 'off'`** → Protege `puedePracticarHoy()` y `gestionarEstadoSuscripcion()` en suscripcion-v4.js (infraestructura lista)

### Problema Identificado

**Los módulos v4 están SIEMPRE ACTIVOS** sin feature flags. Esto significa:
- ❌ No hay forma de desactivar módulos v4 sin modificar código
- ❌ No hay rollback seguro si hay problemas
- ❌ Cambios requieren deploy completo

**Recomendación:** Implementar feature flags para módulos críticos (nivel-v4, streak-v4, suscripcion-v4)

---

## REPOSITORIOS

### Arquitectura de Repositorios

```
src/core/repos/          → Contratos/Interfaces (documentación)
src/infra/repos/        → Implementaciones PostgreSQL
```

### Repositorios Implementados

| Repositorio | Módulo que lo Usa | Estado |
|-------------|-------------------|--------|
| `student-repo-pg.js` | student-v4 | ✅ Completo |
| `practice-repo-pg.js` | practice-v4 | ✅ Completo |
| `pausa-repo-pg.js` | pausa-v4 | ✅ Completo |

### Reglas de Repositorios

- ✅ **ÚNICO punto de acceso a PostgreSQL** para cada dominio
- ✅ **Retornan objetos raw de PostgreSQL** (sin normalización)
- ✅ **Normalización se hace en módulos de dominio** (student-v4, practice-v4, etc.)
- ✅ **Inyectables para tests** (permite mocks)

**Riesgo de cambio:** 🟡 **MEDIO**
- Cambios en repositorios afectan todos los módulos que los usan
- Cambios en queries SQL pueden romper lógica de negocio
- Agregar nuevos métodos es seguro si se mantiene compatibilidad

---

## REGLAS DE ORO DEL SISTEMA

### 1. ✅ Cálculo de días activos protegido por feature flag

**Módulo:** `student-v4.js` → `getDiasActivos()`

**Estado actual:**
- ✅ **Feature flag `dias_activos_v2` creado** (estado: 'off')
- ✅ Infraestructura lista para cambio futuro seguro
- ✅ Comportamiento actual intacto (100% idéntico)

**Razón de protección:** 
- Base para cálculo de niveles automáticos
- Afecta progresión de TODOS los alumnos
- Cambios pueden cambiar niveles masivamente

**Proceso para activar nueva lógica:**
1. ✅ Feature flag `dias_activos_v2` ya existe
2. Implementar nueva lógica en el bloque del flag
3. Probar en BETA con datos reales (activar flag en 'beta')
4. Activar en producción gradualmente (cambiar flag a 'on')

---

### 2. ✅ Cálculo automático de niveles protegido por feature flag

**Módulo:** `nivel-v4.js` → `actualizarNivelSiCorresponde()`

**Estado actual:**
- ✅ **Feature flag `nivel_calculo_v2` creado** (estado: 'off')
- ✅ Infraestructura lista para cambio futuro seguro
- ✅ Comportamiento actual intacto (100% idéntico)

**Razón de protección:** 
- Modifica nivel_actual directamente en PostgreSQL
- Afecta progresión de alumnos y acceso a contenido
- Cambios pueden afectar negocio y experiencia del usuario

**Proceso para activar nueva lógica:**
1. ✅ Feature flag `nivel_calculo_v2` ya existe
2. Implementar nueva lógica en el bloque del flag
3. Probar en BETA con datos reales (activar flag en 'beta')
4. Activar en producción gradualmente (cambiar flag a 'on')

---

### 3. ❌ NUNCA modificar thresholds de niveles sin feature flag

**Módulo:** `nivel-v4.js` → `NIVEL_THRESHOLDS`

**Razón:**
- Cambios afectan niveles de TODOS los alumnos
- Puede causar regresiones masivas
- Afecta acceso a contenido por nivel

**Proceso requerido:**
1. Crear feature flag (ej: `niveles_v2`)
2. Implementar nuevos thresholds con flag
3. Probar en BETA con datos reales
4. Activar en producción gradualmente

**Nota:** La función `actualizarNivelSiCorresponde()` ya está protegida por `nivel_calculo_v2`, pero los thresholds requieren protección adicional si se modifican.

---

### 4. ✅ Cálculo de racha diaria protegido por feature flag

**Módulo:** `streak-v4.js` → `checkDailyStreak()`

**Estado actual:**
- ✅ **Feature flag `streak_calculo_v2` creado** (estado: 'off')
- ✅ Infraestructura lista para cambio futuro seguro
- ✅ Comportamiento actual intacto (100% idéntico)

**Razón de protección:** 
- Modifica streak y fecha_ultima_practica directamente en PostgreSQL
- Afecta gamificación y motivación del alumno
- Cambios pueden resetear rachas incorrectamente
- Integración crítica con suscripciones pausadas

**Proceso para activar nueva lógica:**
1. ✅ Feature flag `streak_calculo_v2` ya existe
2. Implementar nueva lógica en el bloque del flag
3. Probar en BETA con datos reales (activar flag en 'beta')
4. Activar en producción gradualmente (cambiar flag a 'on')

---

### 5. ✅ Control de suscripción protegido por feature flag

**Módulo:** `suscripcion-v4.js` → `puedePracticarHoy()` y `gestionarEstadoSuscripcion()`

**Estado actual:**
- ✅ **Feature flag `suscripcion_control_v2` creado** (estado: 'off')
- ✅ Infraestructura lista para cambio futuro seguro
- ✅ Comportamiento actual intacto (100% idéntico)

**Razón de protección:** 
- Bloquea o permite acceso a prácticas según estado de suscripción
- Modifica estado_suscripcion directamente en PostgreSQL
- Gestiona creación/cierre de pausas (afecta días activos y niveles)
- Cambios pueden permitir acceso no autorizado o bloquear acceso legítimo

**Proceso para activar nueva lógica:**
1. ✅ Feature flag `suscripcion_control_v2` ya existe
2. Implementar nueva lógica en el bloque del flag
3. Probar en BETA con datos reales (activar flag en 'beta')
4. Activar en producción gradualmente (cambiar flag a 'on')

---

### 6. ⚠️ Cambios en módulos que modifican estado requieren observabilidad activa

**Módulos:** student-v4, nivel-v4, streak-v4, suscripcion-v4

**Razón:**
- Modifican datos críticos en PostgreSQL
- Errores pueden causar inconsistencias
- Necesario rastrear cambios para debugging

**Proceso requerido:**
1. Verificar que `observability_extended: 'on'` está activo
2. Agregar logs estructurados con `logInfo()` / `logWarn()`
3. Incluir `extractStudentMeta()` en logs
4. Verificar que request correlation funciona

---

### 7. ✅ Módulos de solo lectura son seguros para iterar

**Módulos:** 
- `practice-v4.js` → Funciones de consulta (`findByAlumnoId()`, `countByAlumnoId()`)
- `pausa-v4.js` → Funciones de consulta (`findByAlumnoId()`, `getPausaActiva()`)
- `nivel-v4.js` → `getNivelInfo()` (solo lectura)

**Razón:**
- No modifican estado
- Cambios solo afectan formato de datos retornados
- Fáciles de revertir

**Proceso:**
- ✅ Cambios directos en producción son aceptables
- ⚠️ Cambios grandes requieren pruebas básicas

---

### 8. ⚠️ Cambios en repositorios requieren verificar integridad de datos

**Módulos:** `infra/repos/*-repo-pg.js`

**Razón:**
- Único punto de acceso a PostgreSQL
- Cambios en queries pueden romper constraints
- Errores pueden causar pérdida de datos

**Proceso requerido:**
1. Verificar constraints de PostgreSQL
2. Probar queries en BETA con datos reales
3. Verificar transacciones si es necesario
4. Agregar validaciones de datos

---

### 9. ❌ NUNCA ejecutar recálculos masivos en producción sin backup

**Módulo:** `nivel-v4.js` → `recalcularNivelesTodosAlumnos()`

**Razón:**
- Modifica niveles de TODOS los alumnos
- Puede ejecutarse en cron jobs
- Errores pueden causar cambios masivos incorrectos

**Proceso requerido:**
1. Backup de base de datos antes de ejecutar
2. Ejecutar en BETA primero
3. Verificar resultados antes de producción
4. Considerar feature flag para desactivar cron job

---

## MÓDULOS LEGACY

### Coexistencia con Módulos V4

| Módulo Legacy | Módulo V4 | Estado | Riesgo |
|---------------|-----------|--------|--------|
| `student.js` | `student-v4.js` | ⚠️ Coexisten | 🟡 ALTO - Puede causar inconsistencias |
| `nivel.js` | `nivel-v4.js` | ⚠️ Coexisten | 🟡 ALTO - Puede causar inconsistencias |
| `streak.js` | `streak-v4.js` | ⚠️ Coexisten | 🟡 ALTO - Puede causar inconsistencias |
| `suscripcion.js` | `suscripcion-v4.js` | ⚠️ Coexisten | 🟡 ALTO - Puede causar inconsistencias |

### Análisis

- ⚠️ **Módulos legacy aún existen** pero no se usan en endpoints principales
- ⚠️ **Riesgo de importación accidental** de módulos legacy
- ✅ **Endpoints principales usan módulos v4** (enter.js, practicar.js, etc.)

**Recomendación:** 
- Marcar módulos legacy como `@deprecated`
- Eliminar gradualmente cuando no haya referencias
- Verificar que ningún endpoint use módulos legacy

---

## PUNTOS CRÍTICOS

### Módulos protegidos por feature flags

1. **`student-v4.js` → `getDiasActivos()`** ✅ **PROTEGIDO**
   - Base para niveles automáticos
   - Afecta progresión de todos los alumnos
   - **Feature flag:** `dias_activos_v2` (estado: 'off', preparado para evolución futura)

2. **`nivel-v4.js` → `actualizarNivelSiCorresponde()`** ✅ **PROTEGIDO**
   - Modifica nivel_actual directamente
   - Afecta acceso a contenido
   - **Feature flag:** `nivel_calculo_v2` (estado: 'off', preparado para evolución futura)

3. **`nivel-v4.js` → `NIVEL_THRESHOLDS`**
   - Define rangos de días por nivel
   - Cambios afectan todos los alumnos
   - **Requiere:** Feature flag + pruebas en BETA

4. **`streak-v4.js` → `checkDailyStreak()`** ✅ **PROTEGIDO**
   - Modifica streak y fecha_ultima_practica directamente
   - Afecta gamificación y motivación
   - **Feature flag:** `streak_calculo_v2` (estado: 'off', preparado para evolución futura)

5. **`pausa-v4.js` → `calcularDiasPausados()`**
   - Afecta cálculo de días activos
   - Base para niveles automáticos
   - **Requiere:** Feature flag + pruebas en BETA

6. **`suscripcion-v4.js` → `puedePracticarHoy()`** ✅ **PROTEGIDO**
   - Bloquea acceso a prácticas
   - Afecta experiencia del usuario
   - **Feature flag:** `suscripcion_control_v2` (estado: 'off', preparado para evolución futura)

7. **`suscripcion-v4.js` → `gestionarEstadoSuscripcion()`** ✅ **PROTEGIDO**
   - Gestiona pausa/reactivación de suscripciones
   - Modifica estado_suscripcion del alumno
   - **Feature flag:** `suscripcion_control_v2` (estado: 'off', preparado para evolución futura)

---

### Módulos que requieren pruebas en BETA

**Todos los módulos v4 que modifican estado:**
- student-v4 (actualizaciones)
- nivel-v4 (actualizaciones)
- streak-v4 (actualizaciones)
- suscripcion-v4 (actualizaciones)
- pausa-v4 (creación/cierre)

**Proceso recomendado:**
1. Cambios en BETA primero
2. Verificar logs y métricas
3. Probar con datos reales
4. Activar en producción gradualmente

---

### Módulos seguros para experimentar

1. **`practice-v4.js` → Funciones de consulta**
   - `findByAlumnoId()` (solo lectura)
   - `countByAlumnoId()` (solo lectura)
   - `existsForDate()` (solo lectura)

2. **`pausa-v4.js` → Funciones de consulta**
   - `findByAlumnoId()` (solo lectura)
   - `getPausaActiva()` (solo lectura)

3. **`nivel-v4.js` → Funciones de consulta**
   - `getNivelInfo()` (solo lectura)
   - `getNombreNivel()` (solo lectura)
   - `getCategoriaNivel()` (solo lectura)

4. **Logging y observabilidad**
   - Agregar logs estructurados
   - Mejorar mensajes de log
   - Agregar métricas

---

## RECOMENDACIONES FUTURAS

### 1. Implementar Feature Flags para Módulos Críticos

**Prioridad:** 🔴 ALTA

**Acción:**
- Crear feature flags para: `nivel_v4_calculo`, `streak_v4_calculo`, `dias_activos_v4`
- Implementar checks en funciones críticas
- Permitir rollback seguro sin deploy

**Beneficio:**
- Rollback seguro en caso de problemas
- Activación gradual de cambios
- Mejor control de riesgos

---

### 2. Migrar `nivelesFases` a Repositorio

**Prioridad:** 🟡 MEDIA

**Problema actual:**
- `nivel-v4.js` importa directamente `database/pg.js` → `nivelesFases`
- Viola principio de repositorio único

**Acción:**
- Crear `nivel-repo-pg.js` en `infra/repos/`
- Migrar `nivelesFases.getFasePorNivel()` al repositorio
- Actualizar `nivel-v4.js` para usar repositorio

**Beneficio:**
- Consistencia arquitectónica
- Mejor testabilidad
- Separación de responsabilidades

---

### 3. Eliminar Módulos Legacy

**Prioridad:** 🟡 MEDIA

**Acción:**
1. Buscar todas las referencias a módulos legacy
2. Verificar que ningún endpoint los use
3. Marcar como `@deprecated`
4. Eliminar gradualmente

**Beneficio:**
- Reduce confusión
- Evita importaciones accidentales
- Simplifica código base

---

### 4. Agregar Tests Unitarios para Módulos Críticos

**Prioridad:** 🟡 MEDIA

**Módulos prioritarios:**
- `student-v4.js` → `getDiasActivos()`
- `nivel-v4.js` → `actualizarNivelSiCorresponde()`
- `streak-v4.js` → `checkDailyStreak()`
- `pausa-v4.js` → `calcularDiasPausados()`

**Beneficio:**
- Detectar regresiones antes de producción
- Documentar comportamiento esperado
- Facilitar refactorizaciones

---

### 5. Documentar Dependencias Circulares Potenciales

**Prioridad:** 🟢 BAJA

**Acción:**
- Documentar dependencias indirectas
- Agregar comentarios en código sobre imports dinámicos
- Crear diagrama de dependencias actualizado

**Beneficio:**
- Evitar dependencias circulares accidentales
- Mejor comprensión del sistema
- Facilita mantenimiento

---

### 6. Implementar Transacciones para Operaciones Críticas

**Prioridad:** 🟡 MEDIA

**Operaciones candidatas:**
- `streak-v4.js` → Actualizar streak + última práctica + crear práctica (debe ser atómico)
- `suscripcion-v4.js` → Crear pausa + actualizar estado (debe ser atómico)
- `nivel-v4.js` → Actualizar nivel (debe ser atómico)

**Beneficio:**
- Garantiza consistencia de datos
- Evita estados inconsistentes
- Mejor integridad de datos

---

### 7. Agregar Validaciones de Datos en Repositorios

**Prioridad:** 🟢 BAJA

**Acción:**
- Validar datos antes de insertar/actualizar
- Retornar errores descriptivos
- Agregar constraints en PostgreSQL si es necesario

**Beneficio:**
- Detecta errores antes de llegar a BD
- Mejor debugging
- Previene datos inválidos

---

## CONCLUSIÓN

AuriPortal v4 implementa una arquitectura basada en dominios con separación clara de responsabilidades. **Las funciones críticas están protegidas por feature flags**, permitiendo evolución segura y rollback inmediato.

### Resumen de Riesgos

- 🔴 **6 módulos de ALTO riesgo** (modifican estado del alumno)
- 🟡 **1 módulo de MEDIO riesgo** (practice-v4, puede permitir duplicados)
- ✅ **Observabilidad activa** (facilita debugging)
- ⚠️ **Feature flags definidos pero no utilizados** (no hay rollback seguro)

### Reglas Críticas

1. ❌ **NUNCA modificar cálculo de días activos sin feature flag** ✅ **PROTEGIDO: `dias_activos_v2`**
2. ❌ **NUNCA modificar cálculo automático de niveles sin feature flag** ✅ **PROTEGIDO: `nivel_calculo_v2`**
3. ❌ **NUNCA modificar thresholds de niveles sin feature flag**
4. ❌ **NUNCA modificar lógica de streak sin feature flag** ✅ **PROTEGIDO: `streak_calculo_v2`**
5. ❌ **NUNCA modificar control de suscripción sin feature flag** ✅ **PROTEGIDO: `suscripcion_control_v2`**
6. ⚠️ **Cambios en módulos que modifican estado requieren observabilidad activa**
7. ✅ **Módulos de solo lectura son seguros para iterar**
8. ⚠️ **Cambios en repositorios requieren verificar integridad de datos**
9. ❌ **NUNCA ejecutar recálculos masivos en producción sin backup**

### Próximos Pasos Recomendados

1. Implementar feature flags para módulos críticos
2. Migrar `nivelesFases` a repositorio
3. Eliminar módulos legacy
4. Agregar tests unitarios para funciones críticas

---

**Documento generado por:** Auditoría Técnica AuriPortal v4  
**Última actualización:** 2024  
**Versión del documento:** 1.0












