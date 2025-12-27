# 🔍 DIAGNÓSTICO PROFUNDO - MODO MASTER ADMIN AURIPORTAL

**Fecha:** 2024-12-19  
**Objetivo:** Diagnóstico completo del Modo Master sin romper funcionalidad existente  
**Estado:** ✅ Diagnóstico Completo - Listo para Plan Incremental

---

## 📋 RESUMEN EJECUTIVO

El **Modo Master** es una vista administrativa avanzada para gestionar alumnos con suscripción activa. Está implementado en `src/endpoints/admin-master.js` (2,480 líneas) y utiliza un sistema de pestañas (tabs) con carga lazy de datos.

**Nivel de riesgo general:** 🟡 **MEDIO**
- ✅ **Fortalezas:** Validación de suscripción activa, sistema modular de tabs, manejo robusto de errores
- ⚠️ **Problemas detectados:** Uso de `nivel_actual` en lugar de `nivel_efectivo`, streak desde campo `streak` en lugar de cálculo real, falta integración con sistema de pausas, no usa `computeProgress()` ni overrides
- 🔴 **Crítico:** No hay coherencia con Progreso V4, Apodo, Pausas, Overrides y Streak real

---

## 🗺️ PARTE A: MAPA DE RUTAS DEL MODO MASTER

### Entrypoint
**Archivo:** `src/endpoints/admin-panel-v4.js` (líneas 579-724)  
**Ruta base:** `/admin/master/:alumnoId`

### Rutas GET (Pantallas)

| Ruta | Handler | Archivo | Descripción |
|------|---------|---------|-------------|
| `GET /admin/master/:id` | `renderMaster()` | `admin-master.js:107` | Vista principal con tabs |
| `GET /admin/master/:id/data` | `getMasterData()` | `admin-master.js:528` | API JSON para poblar tabs |
| `GET /portal/master-view/:id` | `renderMasterView()` | `master-view.js:66` | Vista espejo del alumno |

### Rutas POST (Acciones Mutables)

| Ruta | Handler | Archivo | Validación | Auditoría | Reversible |
|------|---------|---------|------------|-----------|------------|
| `POST /admin/master/:id/apodo` | `handleApodo()` | `admin-master.js:1836` | ✅ Suscripción activa | ✅ Usa `updateStudentApodo()` | ✅ Sí |
| `POST /admin/master/:id/marcar-limpio` | `handleMarcarLimpio()` | `admin-master.js:1539` | ✅ Suscripción activa | ⚠️ Historial opcional | ✅ Sí (soft) |
| `POST /admin/master/:id/datos-nacimiento` | `handleDatosNacimiento()` | `admin-master.js:1890` | ✅ Suscripción activa | ❌ No | ✅ Sí |
| `POST /admin/master/:id/notas` | `handleNotas()` | `admin-master.js:1952` | ✅ Suscripción activa | ✅ Servicio notas | ✅ Sí |
| `POST /admin/master/:id/activar-lugar` | `handleActivarLugar()` | `admin-master.js:2003` | ✅ Lugar existe | ❌ No | ✅ Sí |
| `POST /admin/master/:id/desactivar-lugar` | `handleDesactivarLugar()` | `admin-master.js:2059` | ✅ Lugar existe | ❌ No | ✅ Sí |
| `POST /admin/master/:id/crear-lugar` | `handleCrearLugar()` | `admin-master.js:2201` | ✅ Nombre requerido | ❌ No | ✅ Sí (soft delete) |
| `POST /admin/master/:id/actualizar-lugar` | `handleActualizarLugar()` | `admin-master.js:2285` | ✅ Lugar existe | ❌ No | ✅ Sí |
| `POST /admin/master/:id/eliminar-lugar` | `handleEliminarLugar()` | `admin-master.js:2385` | ✅ Lugar existe | ❌ No | ❌ Hard delete |
| `POST /admin/master/:id/activar-proyecto` | `handleActivarProyecto()` | `admin-master.js:2102` | ✅ Proyecto existe | ❌ No | ✅ Sí |
| `POST /admin/master/:id/desactivar-proyecto` | `handleDesactivarProyecto()` | `admin-master.js:2158` | ✅ Proyecto existe | ❌ No | ✅ Sí |
| `POST /admin/master/:id/crear-proyecto` | `handleCrearProyecto()` | `admin-master.js:2243` | ✅ Nombre requerido | ❌ No | ✅ Sí (soft delete) |
| `POST /admin/master/:id/actualizar-proyecto` | `handleActualizarProyecto()` | `admin-master.js:2335` | ✅ Proyecto existe | ❌ No | ✅ Sí |
| `POST /admin/master/:id/eliminar-proyecto` | `handleEliminarProyecto()` | `admin-master.js:2434` | ✅ Proyecto existe | ❌ No | ❌ Hard delete |
| `POST /admin/master/:id/carta-astral/upload` | `uploadCartaAstral()` | `admin-master-upload.js` | ✅ Multipart | ❌ No | ✅ Sí |
| `POST /admin/master/:id/diseno-humano/upload` | `uploadDisenoHumano()` | `admin-master-upload.js` | ✅ Multipart | ❌ No | ✅ Sí |

### Dependencias por Ruta

**Repositorios/Servicios utilizados:**
- `notas-master.js`: `validarSuscripcionActiva()`, `obtenerNotasAlumno()`, `crearNota()`
- `transmutaciones-energeticas.js`: `obtenerTransmutacionesPorAlumno()`, `limpiarItemParaAlumno()`
- `secciones-limpieza.js`: `listarSecciones()`
- `student-v4.js`: `updateStudentApodo()` (con auditoría)

**Tablas de Base de Datos tocadas:**
- `alumnos`: `apodo`, `nivel_actual`, `estado_suscripcion`, `streak`, `fecha_ultima_practica`, `fecha_nacimiento`, `hora_nacimiento`, `lugar_nacimiento`
- `aspectos_energeticos_alumnos`, `aspectos_karmicos_alumnos`, `aspectos_indeseables_alumnos`: `estado`, `ultima_limpieza`, `proxima_limpieza`, `veces_limpiado`
- `limpiezas_master_historial`: Registro de limpiezas (opcional, si existe)
- `alumnos_lugares`, `alumnos_proyectos`: CRUD completo
- `notas_master`: CRUD de notas
- `transmutaciones_*`: Varias tablas de transmutaciones

---

## 📦 PARTE B: INVENTARIO DE SECCIONES/BLOCKS DEL MASTER UI

### Tab 1: Información General (`tab-info`)
**Renderizado por:** `renderInfoGeneral()` en `admin-master.js` (línea ~380)  
**Datos utilizados:**
- `alumno`: `id`, `email`, `apodo`, `nombre_completo`, `nivel`, `fase`, `racha`, `estado_suscripcion`
- `carta_astral`, `disenohumano`, `ajustes`, `disponibilidad`, `sinergias`
- `superprioritarios`

**Estado actual:**
- ✅ Muestra apodo correctamente (identificador principal)
- ⚠️ Muestra `nivel_actual` en lugar de `nivel_efectivo` (debería usar overrides)
- ⚠️ Muestra `streak` desde campo DB en lugar de cálculo real desde `practicas`
- ❌ No muestra información de pausas (solo `estado_suscripcion`)
- ❌ No muestra overrides de nivel

**Fuente de verdad esperada:**
- **Identidad:** `apodo` (✅ correcto)
- **Progreso:** `computeProgress()` con overrides → `nivel_efectivo` (❌ no implementado)
- **Pausas:** Tabla `pausas` + `estado_suscripcion` (❌ no implementado)
- **Streak:** Cálculo desde tabla `practicas` (❌ usa campo `streak`)

### Tab 2: Transmutaciones PDE (`tab-transmutaciones`)
**Renderizado por:** `renderTransmutaciones()` en `admin-master.js` (línea ~390)  
**Datos utilizados:**
- `alumnos_lugares`, `alumnos_proyectos`
- `transmutaciones_apadrinados`
- `transmutaciones_energeticas` (nuevo sistema)

**Estado actual:**
- ✅ Funcional, muestra transmutaciones correctamente
- ✅ Soporta CRUD completo de lugares/proyectos
- ⚠️ No valida nivel mínimo del alumno antes de mostrar transmutaciones

**Fuente de verdad esperada:**
- **Nivel:** Debería usar `nivel_efectivo` para filtrar transmutaciones disponibles (⚠️ usa `nivel_actual`)

### Tab 3: Limpieza Energética (`tab-energetico`)
**Renderizado por:** `renderProgresoEnergetico()` en `admin-master.js`  
**Datos utilizados:**
- `aspectos_energeticos`, `aspectos_energeticos_alumnos`
- `aspectos_karmicos`, `aspectos_karmicos_alumnos`
- `aspectos_indeseables`, `aspectos_indeseables_alumnos`
- `limpieza_hogar`, `limpieza_hogar_alumnos`
- `secciones_limpieza` (dinámicas)

**Estado actual:**
- ✅ Funcional, muestra aspectos correctamente
- ✅ Filtra por `nivel_minimo` (usa `nivel_actual` del alumno)
- ✅ Soporta marcar como limpiado con historial
- ⚠️ Usa `nivel_actual` en lugar de `nivel_efectivo` para filtrado

**Fuente de verdad esperada:**
- **Nivel:** Debería usar `nivel_efectivo` para filtrar aspectos disponibles (⚠️ usa `nivel_actual`)

### Tab 4: Progreso Gamificado (`tab-gamificado`)
**Renderizado por:** `renderProgresoGamificado()` en `admin-master.js` (línea 2575)  
**Datos utilizados:**
- `misiones`, `logros`, `skilltree`, `arquetipos`, `auribosses`, `tokens`

**Estado actual:**
- ✅ Funcional, muestra datos correctamente
- ⚠️ Solo muestra datos, no calcula progreso real
- ❌ No integra con `computeProgress()` ni `progress-engine`
- ❌ No muestra overrides de nivel/progreso

**Fuente de verdad esperada:**
- **Progreso:** Debería usar `computeProgress()` para calcular progreso real con overrides (❌ no implementado)

### Tab 5: Prácticas y Reflexiones (`tab-practicas`)
**Renderizado por:** `renderPracticasReflexiones()` en `admin-master.js`  
**Datos utilizados:**
- `practicas` (últimas 50)
- `reflexiones` (últimas 30)
- `audios` (últimos 20)

**Estado actual:**
- ✅ Funcional, muestra prácticas correctamente
- ⚠️ No calcula streak real desde `practicas` (usa campo `streak`)

**Fuente de verdad esperada:**
- **Streak:** Debería calcular desde tabla `practicas` usando `getCurrentStreak()` o equivalente (❌ usa campo `streak`)

### Tab 6: Creación (`tab-creacion`)
**Renderizado por:** `renderCreacion()` en `admin-master.js`  
**Datos utilizados:**
- `objetivos`, `problemas`, `version_futura`

**Estado actual:**
- ✅ Funcional, muestra datos correctamente
- ✅ No requiere cambios (solo visualización)

### Tab 7: Cooperación con otros (`tab-cooperacion`)
**Renderizado por:** `renderCooperacion()` en `admin-master.js`  
**Datos utilizados:**
- `sinergias` (prácticas conjuntas)

**Estado actual:**
- ✅ Funcional, muestra sinergias correctamente
- ✅ No requiere cambios (solo visualización)

### Tab 8: Área Emocional (`tab-emocional`)
**Renderizado por:** `renderAreaEmocional()` en `admin-master.js`  
**Datos utilizados:**
- `emocional` (último registro anual)

**Estado actual:**
- ✅ Funcional, muestra datos correctamente
- ✅ No requiere cambios (solo visualización)

### Tab 9: Notas del Master (`tab-notas`)
**Renderizado por:** `renderNotas()` en `admin-master.js`  
**Datos utilizados:**
- `notas` (desde servicio `notas-master.js`)

**Estado actual:**
- ✅ Funcional, CRUD completo
- ✅ Usa servicio con validación
- ✅ No requiere cambios

---

## ⚠️ PARTE C: CLASIFICACIÓN DE RIESGO POR SECCIÓN

### 🔴 ALTO RIESGO

1. **Cabecera del Alumno (Nivel y Streak)**
   - **Problema:** Muestra `nivel_actual` y `streak` desde DB en lugar de cálculos reales
   - **Impacto:** Información incorrecta si hay overrides o pausas
   - **Ubicación:** `admin-master.js:206` (línea 206 muestra nivel), `admin-master.js:210` (línea 210 muestra racha)
   - **Evidencia:** 
     ```javascript
     // Línea 74: SELECT nivel_actual, streak as racha
     // Línea 206: <span>⭐ Nivel ${alumno.nivel_actual || 1}</span>
     // Línea 210: <span>🔥 Racha: ${alumno.racha || 0} días</span>
     ```

2. **Filtrado de Aspectos por Nivel**
   - **Problema:** Filtra aspectos usando `nivel_actual` en lugar de `nivel_efectivo`
   - **Impacto:** Puede mostrar/ocultar aspectos incorrectamente si hay overrides
   - **Ubicación:** Múltiples queries en `getMasterData()` (líneas 672, 770, 894, 1179, 1404)
   - **Evidencia:**
     ```javascript
     // Línea 672: AND (COALESCE(ae.nivel_minimo, 1) <= (SELECT nivel_actual FROM alumnos WHERE id = $1 LIMIT 1))
     ```

3. **Progreso Gamificado sin computeProgress()**
   - **Problema:** No integra con `computeProgress()` ni `progress-engine`
   - **Impacto:** Progreso mostrado puede no reflejar overrides ni estado real
   - **Ubicación:** `admin-master.js:2575` (renderProgresoGamificado)
   - **Evidencia:** Solo muestra datos raw, no calcula progreso

### 🟡 MEDIO RIESGO

4. **Pausas no integradas**
   - **Problema:** Solo verifica `estado_suscripcion = 'activa'`, no consulta tabla `pausas`
   - **Impacto:** Puede mostrar información incorrecta si hay pausas activas
   - **Ubicación:** `admin-master.js:71` (validarYobtenerAlumno)
   - **Evidencia:**
     ```javascript
     // Línea 78: WHERE id = $1 AND estado_suscripcion = 'activa'
     // No consulta tabla pausas
     ```

5. **Streak desde campo DB**
   - **Problema:** Usa campo `streak` en lugar de calcular desde tabla `practicas`
   - **Impacto:** Streak puede estar desactualizado
   - **Ubicación:** `admin-master.js:75` (SELECT streak as racha)
   - **Evidencia:** No hay cálculo de streak real desde `practicas`

6. **Falta de auditoría en algunas acciones**
   - **Problema:** Algunas acciones POST no registran auditoría
   - **Impacto:** No hay trazabilidad completa
   - **Ubicación:** Múltiples handlers POST (lugares, proyectos, datos-nacimiento)

### 🟢 BAJO RIESGO

7. **Tabs de solo lectura (Creación, Cooperación, Emocional)**
   - **Estado:** Funcionales, solo visualización
   - **Acción:** Ninguna requerida

8. **Notas del Master**
   - **Estado:** Funcional, usa servicio con validación
   - **Acción:** Ninguna requerida

---

## 📊 PARTE D: CONTRATO "FUENTE DE VERDAD" POR BLOQUE

### Identidad (Apodo/Email)
**Estado:** ✅ **CORRECTO**
- **Fuente:** Campo `apodo` de tabla `alumnos`
- **Implementación:** `admin-master.js:169` usa `alumno.apodo || alumno.nombre_completo || alumno.email`
- **Edición:** `handleApodo()` usa `updateStudentApodo()` con auditoría (✅ correcto)
- **Problema:** Ninguno

### Progreso (computeProgress + overrides)
**Estado:** ❌ **NO IMPLEMENTADO**
- **Fuente esperada:** `computeProgress()` desde `progress-engine.js` con overrides
- **Implementación actual:** Usa `nivel_actual` directamente desde DB
- **Problema:** No calcula `nivel_efectivo` considerando overrides
- **Evidencia:**
  ```javascript
  // admin-master.js:74
  SELECT nivel_actual  // ❌ Debería calcular nivel_efectivo
  ```
- **Acción requerida:** Integrar `computeProgress()` o `getNivelEfectivo()` con overrides

### Pausas (tabla pausas + suscripción)
**Estado:** ⚠️ **PARCIAL**
- **Fuente esperada:** Tabla `pausas` + campo `estado_suscripcion`
- **Implementación actual:** Solo verifica `estado_suscripcion = 'activa'`
- **Problema:** No consulta tabla `pausas` para verificar pausas activas
- **Evidencia:**
  ```javascript
  // admin-master.js:78
  WHERE id = $1 AND estado_suscripcion = 'activa'
  // ❌ No consulta tabla pausas
  ```
- **Acción requerida:** Consultar tabla `pausas` para verificar pausas activas

### Streak (prácticas - racha real)
**Estado:** ❌ **NO IMPLEMENTADO**
- **Fuente esperada:** Cálculo desde tabla `practicas` usando `getCurrentStreak()` o equivalente
- **Implementación actual:** Usa campo `streak` directamente desde DB
- **Problema:** Streak puede estar desactualizado
- **Evidencia:**
  ```javascript
  // admin-master.js:75
  SELECT streak as racha  // ❌ Debería calcular desde practicas
  ```
- **Acción requerida:** Calcular streak real desde tabla `practicas`

### Legacy (solo referencia si existe)
**Estado:** ✅ **CORRECTO**
- **Fuente:** Datos legacy se muestran pero no se usan como fuente de verdad
- **Implementación:** Correcta, solo referencia

---

## 🐛 PARTE E: LISTA DE "ROTURAS" DETECTADAS

### Bug 1: Nivel no considera overrides
**Severidad:** 🔴 **ALTA**  
**Ubicación:** `admin-master.js:74, 206, 672, 770, 894, 1179, 1404`  
**Descripción:** Usa `nivel_actual` en lugar de `nivel_efectivo` (con overrides)  
**Evidencia:**
```javascript
// Línea 74
SELECT nivel_actual  // ❌ Debería calcular nivel_efectivo

// Línea 206
<span>⭐ Nivel ${alumno.nivel_actual || 1}</span>  // ❌ Debería usar nivel_efectivo

// Línea 672 (filtrado de aspectos)
AND (COALESCE(ae.nivel_minimo, 1) <= (SELECT nivel_actual FROM alumnos WHERE id = $1 LIMIT 1))
// ❌ Debería usar nivel_efectivo
```
**Impacto:** Puede mostrar/ocultar aspectos incorrectamente si hay overrides de nivel

### Bug 2: Streak no se calcula desde prácticas
**Severidad:** 🟡 **MEDIA**  
**Ubicación:** `admin-master.js:75, 210`  
**Descripción:** Usa campo `streak` en lugar de calcular desde tabla `practicas`  
**Evidencia:**
```javascript
// Línea 75
SELECT streak as racha  // ❌ Debería calcular desde practicas

// Línea 210
<span>🔥 Racha: ${alumno.racha || 0} días</span>  // ❌ Usa campo DB, no cálculo real
```
**Impacto:** Streak puede estar desactualizado si no se sincroniza correctamente

### Bug 3: Pausas no se consultan
**Severidad:** 🟡 **MEDIA**  
**Ubicación:** `admin-master.js:71-102` (validarYobtenerAlumno)  
**Descripción:** Solo verifica `estado_suscripcion = 'activa'`, no consulta tabla `pausas`  
**Evidencia:**
```javascript
// Línea 78
WHERE id = $1 AND estado_suscripcion = 'activa'
// ❌ No consulta tabla pausas para verificar pausas activas
```
**Impacto:** Puede mostrar información incorrecta si hay pausas activas en tabla `pausas`

### Bug 4: Progreso Gamificado no usa computeProgress()
**Severidad:** 🟡 **MEDIA**  
**Ubicación:** `admin-master.js:2575` (renderProgresoGamificado)  
**Descripción:** Solo muestra datos raw, no calcula progreso con `computeProgress()`  
**Evidencia:**
```javascript
// Línea 2575
function renderProgresoGamificado(data) {
  // Solo muestra misiones, logros, etc. raw
  // ❌ No calcula progreso usando computeProgress()
}
```
**Impacto:** Progreso mostrado puede no reflejar overrides ni estado real

### Bug 5: Falta auditoría en algunas acciones
**Severidad:** 🟢 **BAJA**  
**Ubicación:** Múltiples handlers POST (lugares, proyectos, datos-nacimiento)  
**Descripción:** Algunas acciones POST no registran auditoría  
**Evidencia:**
- `handleDatosNacimiento()`: No registra auditoría
- `handleCrearLugar()`, `handleActualizarLugar()`, `handleEliminarLugar()`: No registran auditoría
- `handleCrearProyecto()`, `handleActualizarProyecto()`, `handleEliminarProyecto()`: No registran auditoría
**Impacto:** No hay trazabilidad completa de cambios

### Bug 6: Hard delete en lugares/proyectos
**Severidad:** 🟢 **BAJA**  
**Ubicación:** `admin-master.js:2385` (handleEliminarLugar), `admin-master.js:2434` (handleEliminarProyecto)  
**Descripción:** Usa `DELETE` en lugar de soft delete  
**Evidencia:**
```javascript
// Línea 2405
DELETE FROM alumnos_lugares WHERE id = $1 AND alumno_id = $2
// ❌ Debería usar soft delete (UPDATE activo = FALSE)
```
**Impacto:** Pérdida de datos históricos

---

## 📋 PARTE F: PLAN INCREMENTAL DE ESTABILIZACIÓN

### FASE 1: NO ROTO (Prioridad: CRÍTICA)
**Objetivo:** Asegurar que lo que funciona hoy siga funcionando

#### Paso 1.1: Instrumentación y Logs
- [ ] Añadir logs estructurados en `getMasterData()` para rastrear queries
- [ ] Añadir logs en `renderMaster()` para rastrear renderizado
- [ ] Añadir logs en handlers POST para rastrear acciones
- [ ] **No rompe nada, solo añade observabilidad**

#### Paso 1.2: Validación de Datos Existentes
- [ ] Verificar que todos los alumnos con suscripción activa tienen `nivel_actual` válido
- [ ] Verificar que todos los alumnos tienen `streak` sincronizado
- [ ] Verificar que no hay inconsistencias en `estado_suscripcion`
- [ ] **No rompe nada, solo diagnóstico**

#### Paso 1.3: Protección de Rutas POST
- [ ] Añadir validación de inputs en todos los handlers POST
- [ ] Añadir manejo de errores robusto en todos los handlers
- [ ] Añadir timeouts en queries largas
- [ ] **No rompe nada, solo añade seguridad**

### FASE 2: COHERENTE (Prioridad: ALTA)
**Objetivo:** Alinear con Progreso V4, Apodo, Pausas, Overrides y Streak real

#### Paso 2.1: Integrar Apodo (Ya está correcto)
- [x] ✅ Apodo ya usa `updateStudentApodo()` con auditoría
- [x] ✅ Apodo se muestra como identificador principal
- **Estado:** ✅ COMPLETO

#### Paso 2.2: Integrar computeProgress() y nivel_efectivo
- [ ] Crear función helper `getNivelEfectivo(alumnoId)` que:
  - Obtiene `nivel_actual` desde DB
  - Consulta tabla `overrides` (si existe) para obtener override de nivel
  - Retorna `nivel_efectivo = override || nivel_actual`
- [ ] Reemplazar todas las referencias a `nivel_actual` por `nivel_efectivo` en:
  - `validarYobtenerAlumno()` (línea 74)
  - `renderMaster()` (línea 206)
  - `getMasterData()` (queries en líneas 672, 770, 894, 1179, 1404)
- [ ] **Riesgo:** MEDIO - Requiere testing exhaustivo
- [ ] **Reversibilidad:** Sí, se puede revertir fácilmente

#### Paso 2.3: Integrar Pausas
- [ ] Crear función helper `verificarPausasActivas(alumnoId)` que:
  - Consulta tabla `pausas` para verificar pausas activas
  - Retorna `{ pausada: boolean, razon: string }`
- [ ] Modificar `validarYobtenerAlumno()` para:
  - Verificar `estado_suscripcion = 'activa'` (actual)
  - Verificar que no hay pausas activas en tabla `pausas` (nuevo)
- [ ] Mostrar información de pausas en cabecera del alumno (si aplica)
- [ ] **Riesgo:** MEDIO - Requiere testing exhaustivo
- [ ] **Reversibilidad:** Sí, se puede revertir fácilmente

#### Paso 2.4: Integrar Streak Real
- [ ] Crear función helper `getCurrentStreak(alumnoId)` que:
  - Consulta tabla `practicas` para obtener prácticas del alumno
  - Calcula streak real desde prácticas (días consecutivos)
  - Retorna `{ streak: number, fecha_ultima_practica: date }`
- [ ] Reemplazar uso de campo `streak` por cálculo real en:
  - `validarYobtenerAlumno()` (línea 75)
  - `renderMaster()` (línea 210)
  - `getMasterData()` (línea 1464)
- [ ] **Riesgo:** MEDIO - Requiere testing exhaustivo
- [ ] **Reversibilidad:** Sí, se puede revertir fácilmente

### FASE 3: OPERATIVO (Prioridad: MEDIA)
**Objetivo:** Mejorar funcionalidad y UX

#### Paso 3.1: Integrar computeProgress() en Progreso Gamificado
- [ ] Importar `computeProgress()` desde `progress-engine.js`
- [ ] Modificar `renderProgresoGamificado()` para:
  - Calcular progreso usando `computeProgress()`
  - Mostrar progreso con overrides aplicados
  - Mostrar indicadores de progreso real
- [ ] **Riesgo:** BAJO - Solo afecta visualización
- [ ] **Reversibilidad:** Sí, se puede revertir fácilmente

#### Paso 3.2: Añadir Auditoría en Acciones POST
- [ ] Crear función helper `registrarAuditoria(alumnoId, accion, datos)` que:
  - Registra acción en tabla de auditoría (si existe)
  - Incluye timestamp, usuario, acción, datos
- [ ] Añadir auditoría en:
  - `handleDatosNacimiento()`
  - `handleCrearLugar()`, `handleActualizarLugar()`, `handleEliminarLugar()`
  - `handleCrearProyecto()`, `handleActualizarProyecto()`, `handleEliminarProyecto()`
- [ ] **Riesgo:** BAJO - Solo añade funcionalidad
- [ ] **Reversibilidad:** Sí, se puede revertir fácilmente

#### Paso 3.3: Soft Delete en Lugares/Proyectos
- [ ] Modificar `handleEliminarLugar()` para usar soft delete:
  - `UPDATE alumnos_lugares SET activo = FALSE, deleted_at = CURRENT_TIMESTAMP WHERE id = $1`
- [ ] Modificar `handleEliminarProyecto()` para usar soft delete:
  - `UPDATE alumnos_proyectos SET activo = FALSE, deleted_at = CURRENT_TIMESTAMP WHERE id = $1`
- [ ] Añadir columna `deleted_at` si no existe (migración)
- [ ] **Riesgo:** MEDIO - Requiere migración de DB
- [ ] **Reversibilidad:** Sí, se puede revertir fácilmente

### FASE 4: UX (Prioridad: BAJA)
**Objetivo:** Mejorar experiencia de usuario

#### Paso 4.1: Mejorar Visualización de Pausas
- [ ] Mostrar banner de pausa activa en cabecera del alumno
- [ ] Mostrar fecha de inicio/fin de pausa
- [ ] Mostrar razón de pausa
- [ ] **Riesgo:** BAJO - Solo afecta visualización
- [ ] **Reversibilidad:** Sí, se puede revertir fácilmente

#### Paso 4.2: Mejorar Visualización de Overrides
- [ ] Mostrar indicador de override de nivel en cabecera
- [ ] Mostrar nivel base vs nivel efectivo
- [ ] Mostrar razón del override (si existe)
- [ ] **Riesgo:** BAJO - Solo afecta visualización
- [ ] **Reversibilidad:** Sí, se puede revertir fácilmente

#### Paso 4.3: Mejorar Visualización de Streak
- [ ] Mostrar cálculo de streak en tiempo real
- [ ] Mostrar fecha de última práctica
- [ ] Mostrar indicador de streak activo/pausado
- [ ] **Riesgo:** BAJO - Solo afecta visualización
- [ ] **Reversibilidad:** Sí, se puede revertir fácilmente

---

## 🧪 SMOKE TESTS

### Test 1: Acceso a Modo Master
**URL:** `GET /admin/master/:alumnoId`  
**Acción:** Abrir en navegador con alumno con suscripción activa  
**Esperado:** 
- ✅ Página carga correctamente
- ✅ Muestra apodo del alumno
- ✅ Muestra nivel (actualmente `nivel_actual`, debería ser `nivel_efectivo`)
- ✅ Muestra racha (actualmente campo `streak`, debería ser cálculo real)
- ✅ Muestra todas las pestañas

**Logs a revisar:**
```bash
pm2 logs aurelinportal --lines 50 | grep "renderMaster\|getMasterData"
```

### Test 2: Editar Apodo
**URL:** `POST /admin/master/:alumnoId/apodo`  
**Acción:** 
1. Click en "✏️ Editar Apodo"
2. Ingresar nuevo apodo
3. Guardar
**Esperado:**
- ✅ Apodo se actualiza correctamente
- ✅ Se registra auditoría (verificar tabla de auditoría)
- ✅ Página se actualiza con nuevo apodo

**Logs a revisar:**
```bash
pm2 logs aurelinportal --lines 50 | grep "handleApodo\|updateStudentApodo"
```

### Test 3: Marcar Aspecto como Limpiado
**URL:** `POST /admin/master/:alumnoId/marcar-limpio`  
**Acción:**
1. Ir a pestaña "Limpieza Energética"
2. Click en "Marcar como limpiado" en un aspecto
3. Verificar que se marca como limpiado
**Esperado:**
- ✅ Aspecto se marca como limpiado
- ✅ Se registra en historial (si existe tabla `limpiezas_master_historial`)
- ✅ Se actualiza `ultima_limpieza` y `proxima_limpieza`

**Logs a revisar:**
```bash
pm2 logs aurelinportal --lines 50 | grep "handleMarcarLimpio"
```

### Test 4: Verificar Nivel Efectivo (Después de Paso 2.2)
**URL:** `GET /admin/master/:alumnoId/data`  
**Acción:** 
1. Crear override de nivel para un alumno
2. Abrir Modo Master
3. Verificar que muestra `nivel_efectivo` (override) en lugar de `nivel_actual`
**Esperado:**
- ✅ Muestra `nivel_efectivo` (override) en cabecera
- ✅ Filtra aspectos usando `nivel_efectivo`
- ✅ Muestra indicador de override activo

**Logs a revisar:**
```bash
pm2 logs aurelinportal --lines 50 | grep "getNivelEfectivo\|nivel_efectivo"
```

### Test 5: Verificar Pausas (Después de Paso 2.3)
**URL:** `GET /admin/master/:alumnoId`  
**Acción:**
1. Crear pausa activa para un alumno
2. Abrir Modo Master
3. Verificar que muestra información de pausa
**Esperado:**
- ✅ Muestra banner de pausa activa
- ✅ Muestra fecha de inicio/fin de pausa
- ✅ Muestra razón de pausa

**Logs a revisar:**
```bash
pm2 logs aurelinportal --lines 50 | grep "verificarPausasActivas\|pausa"
```

### Test 6: Verificar Streak Real (Después de Paso 2.4)
**URL:** `GET /admin/master/:alumnoId/data`  
**Acción:**
1. Crear prácticas consecutivas para un alumno
2. Abrir Modo Master
3. Verificar que muestra streak calculado desde prácticas
**Esperado:**
- ✅ Muestra streak calculado desde tabla `practicas`
- ✅ Muestra fecha de última práctica
- ✅ Streak coincide con prácticas reales

**Logs a revisar:**
```bash
pm2 logs aurelinportal --lines 50 | grep "getCurrentStreak\|streak"
```

---

## 📝 NOTAS FINALES

### Archivos Modificados (Potenciales)
- `src/endpoints/admin-master.js`: Principal (2,480 líneas)
- `public/js/admin-master.js`: Frontend (3,465 líneas)
- `src/endpoints/master-view.js`: Vista espejo (523 líneas)

### Archivos a Crear (Nuevos Helpers)
- `src/services/master-helpers.js`: Helpers para nivel_efectivo, pausas, streak
- `src/core/audit-master.js`: Sistema de auditoría para Master

### Dependencias Nuevas
- `progress-engine.js`: Para `computeProgress()`
- `nivel-v4.js`: Para `getNivelEfectivo()` (si existe)
- Tabla `pausas`: Para verificar pausas activas
- Tabla `overrides`: Para obtener overrides de nivel (si existe)

### Riesgos de Implementación
- **ALTO:** Cambios en queries de nivel pueden afectar filtrado de aspectos
- **MEDIO:** Cambios en cálculo de streak pueden afectar visualización
- **BAJO:** Cambios en visualización de pausas/overrides solo afectan UX

### Reversibilidad
- ✅ Todos los cambios son reversibles
- ✅ Se puede mantener código legacy como fallback
- ✅ Se puede usar feature flags para activar/desactivar funcionalidad

---

**FIN DEL DIAGNÓSTICO**




















