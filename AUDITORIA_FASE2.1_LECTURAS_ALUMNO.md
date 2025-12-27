# AUDITORÍA FASE 2.1 - LECTURAS DE ESTADO DEL ALUMNO

**Fecha**: 2025-01-XX  
**Fase**: 2.1 - Certificación Operativa del Alumno como SOT  
**Estado**: COMPLETADA (Solo Documentación)

---

## RESUMEN EJECUTIVO

Se identificaron **múltiples puntos donde se lee estado del alumno desde fuentes NO soberanas** (ClickUp, SQLite). El sistema tiene una arquitectura dual:
- **v4 (PostgreSQL)**: `student-v4.js` - Lee correctamente desde PostgreSQL
- **Legacy (ClickUp/SQLite)**: `student.js`, `nivel.js`, `streak.js` - Aún leen desde ClickUp/SQLite

---

## 1. LECTURAS DE NIVEL

### 1.1 Desde ClickUp (LEGACY - PROHIBIDO)

#### `src/modules/student.js` - `normalizeStudent()`
- **Línea**: 48
- **Código**: `nivel: Number(getCustomFieldValue(task, CLICKUP.CF_NIVEL_AURELIN)) || 1`
- **Problema**: Lee nivel desde ClickUp custom field
- **Uso**: Usado por `findStudentByEmail()` legacy que consulta ClickUp

#### `src/modules/nivel.js` - `actualizarNivelSiNecesario()`
- **Línea**: 84-85
- **Código**: 
  ```javascript
  // El nivel actual siempre viene de ClickUp (fuente de verdad)
  const nivelActual = student.nivel || 1;
  ```
- **Problema**: Comentario dice "ClickUp es la fuente de verdad" - VIOLA CERTIFICACIÓN
- **Uso**: Llamado desde múltiples lugares para actualizar nivel

#### `src/endpoints/sync-clickup-sql.js` - `sincronizarClickUpASQL()`
- **Línea**: 25, 47-53
- **Código**: Lee `CF_NIVEL_AURELIN` desde ClickUp y sincroniza a SQLite
- **Problema**: Lee desde ClickUp para sincronizar
- **Estado**: Endpoint marcado como LEGACY pero aún funcional

#### `src/services/clickup-sync-listas.js` - `sincronizarListaPrincipalAurelin()`
- **Línea**: 136, 385-391
- **Código**: Lee y actualiza nivel en ClickUp
- **Problema**: Lee nivel desde ClickUp para sincronización
- **Uso**: Sincronización de listas ClickUp

### 1.2 Desde PostgreSQL (CORRECTO)

#### `src/modules/student-v4.js` - `normalizeAlumno()`
- **Línea**: 52
- **Código**: `nivel: alumno.nivel_manual || alumno.nivel_actual || 1`
- **Estado**: ✅ CORRECTO - Lee desde PostgreSQL
- **Uso**: Usado por `findStudentByEmail()` v4

#### `src/core/student-context.js` - `buildStudentContext()`
- **Línea**: 175
- **Código**: Usa `computeProgress()` que lee desde PostgreSQL
- **Estado**: ✅ CORRECTO - Usa motor canónico de progreso

---

## 2. LECTURAS DE RACHA

### 2.1 Desde ClickUp (LEGACY - PROHIBIDO)

#### `src/modules/student.js` - `normalizeStudent()`
- **Línea**: 51
- **Código**: `streak: Number(getCustomFieldValue(task, CLICKUP.CF_STREAK_GENERAL)) || 0`
- **Problema**: Lee racha desde ClickUp custom field

#### `src/modules/streak.js` - `checkDailyStreak()`
- **Línea**: 57-58
- **Código**: Lee `student.streak` y `student.lastPractice` que vienen de ClickUp
- **Problema**: Aunque lee del objeto student, ese objeto viene de ClickUp en código legacy
- **Uso**: Función principal de cálculo de racha

#### `src/endpoints/sync-clickup-sql.js` - `sincronizarClickUpASQL()`
- **Línea**: 27, 199-208
- **Código**: Lee `CF_STREAK_GENERAL` y `CF_LAST_PRACTICE_DATE` desde ClickUp
- **Problema**: Lee desde ClickUp para sincronizar

### 2.2 Desde SQLite (LEGACY - PROHIBIDO)

#### `src/modules/streak.js` - `checkDailyStreak()`
- **Línea**: 88-94, 144-150, 174-180
- **Código**: 
  ```javascript
  const db = getDatabase();
  db.prepare('UPDATE students SET racha_actual = ?, ultima_practica_date = ?...')
  ```
- **Problema**: Escribe en SQLite (legacy)
- **Estado**: ❌ PROHIBIDO - SQLite no debe usarse en runtime

### 2.3 Desde PostgreSQL (CORRECTO)

#### `src/core/student-context.js` - `buildStudentContext()`
- **Línea**: 153
- **Código**: `streakResult = await computeStreakFromPracticas(alumnoId)`
- **Estado**: ✅ CORRECTO - Usa motor canónico desde PostgreSQL

#### `src/modules/student-v4.js` - `normalizeAlumno()`
- **Línea**: 56
- **Código**: `streak: alumno.streak || 0`
- **Estado**: ✅ CORRECTO - Lee desde PostgreSQL

---

## 3. LECTURAS DE ESTADO DE SUSCRIPCIÓN

### 3.1 Desde ClickUp (LEGACY - PROHIBIDO)

#### `src/modules/student.js` - `normalizeStudent()`
- **Línea**: 25-42, 56
- **Código**: Lee `CF_SUSCRIPCION_ACTIVA` desde ClickUp
- **Problema**: Lee estado de suscripción desde ClickUp

### 3.2 Desde Kajabi (LEGACY - PROHIBIDO)

#### `src/modules/suscripcion.js` - `gestionarEstadoSuscripcion()`
- **Línea**: 14-22
- **Código**: Función deshabilitada (comentario dice "Sin integración con Kajabi")
- **Estado**: ✅ Ya deshabilitado - No consulta Kajabi
- **Nota**: Retorna siempre `{ pausada: false }` (hardcoded)

### 3.3 Desde PostgreSQL (CORRECTO)

#### `src/modules/suscripcion-v4.js` - `gestionarEstadoSuscripcion()`
- **Línea**: 30-107
- **Código**: Lee desde PostgreSQL tabla `alumnos.estado_suscripcion`
- **Estado**: ✅ CORRECTO - Lee desde PostgreSQL
- **Uso**: Usado por `buildStudentContext()` (línea 84)

#### `src/modules/student-v4.js` - `normalizeAlumno()`
- **Línea**: 58-59
- **Código**: 
  ```javascript
  suscripcionActiva: alumno.estado_suscripcion === 'activa',
  estado_suscripcion: alumno.estado_suscripcion || 'activa'
  ```
- **Estado**: ✅ CORRECTO - Lee desde PostgreSQL

---

## 4. LECTURAS DE FECHA DE ÚLTIMA PRÁCTICA

### 4.1 Desde ClickUp (LEGACY - PROHIBIDO)

#### `src/modules/student.js` - `normalizeStudent()`
- **Línea**: 50
- **Código**: `lastPractice: getCustomFieldValue(task, CLICKUP.CF_LAST_PRACTICE_DATE) || null`
- **Problema**: Lee desde ClickUp

#### `src/endpoints/sync-clickup-sql.js` - `sincronizarClickUpASQL()`
- **Línea**: 28, 206-208
- **Código**: Lee `CF_LAST_PRACTICE_DATE` desde ClickUp
- **Problema**: Lee desde ClickUp para sincronizar

### 4.2 Desde SQLite (LEGACY - PROHIBIDO)

#### `src/modules/streak.js` - `checkDailyStreak()`
- **Línea**: 88-94
- **Código**: Actualiza `ultima_practica_date` en SQLite
- **Problema**: Escribe en SQLite (legacy)

### 4.3 Desde PostgreSQL (CORRECTO)

#### `src/modules/student-v4.js` - `normalizeAlumno()`
- **Línea**: 55
- **Código**: `lastPractice: alumno.fecha_ultima_practica ? new Date(alumno.fecha_ultima_practica).toISOString().substring(0, 10) : null`
- **Estado**: ✅ CORRECTO - Lee desde PostgreSQL

#### `src/core/student-context.js` - `buildStudentContext()`
- **Línea**: 153
- **Código**: Usa `computeStreakFromPracticas()` que lee desde tabla `practicas` en PostgreSQL
- **Estado**: ✅ CORRECTO - Usa motor canónico

---

## 5. PUNTOS DE ENTRADA PRINCIPALES

### 5.1 Flujo Correcto (v4 - PostgreSQL)

1. **`src/core/auth-context.js`** - `requireStudentContext()`
   - Línea 88: `findStudentByEmail(env, emailCookie)` → `student-v4.js`
   - ✅ Lee desde PostgreSQL

2. **`src/core/student-context.js`** - `buildStudentContext()`
   - Línea 51: Usa `requireStudentContext()` → PostgreSQL
   - Línea 84: `gestionarEstadoSuscripcion()` → `suscripcion-v4.js` → PostgreSQL
   - Línea 153: `computeStreakFromPracticas()` → PostgreSQL
   - Línea 175: `computeProgress()` → PostgreSQL
   - ✅ Todo desde PostgreSQL

### 5.2 Flujo Legacy (ClickUp/SQLite - PROHIBIDO)

1. **`src/modules/student.js`** - `findStudentByEmail()`
   - Línea 66-68: Consulta ClickUp API
   - Línea 23-60: `normalizeStudent()` lee campos desde ClickUp
   - ❌ PROHIBIDO - Debe eliminarse o deshabilitarse

2. **`src/modules/nivel.js`** - `actualizarNivelSiNecesario()`
   - Línea 84: Lee nivel desde `student.nivel` (que viene de ClickUp)
   - Línea 101-103: Actualiza ClickUp
   - Línea 108-114: Escribe en SQLite
   - ❌ PROHIBIDO - Múltiples violaciones

3. **`src/modules/streak.js`** - `checkDailyStreak()`
   - Línea 57-58: Lee desde `student` (ClickUp)
   - Línea 82-83: Actualiza ClickUp
   - Línea 88-94: Escribe en SQLite
   - ❌ PROHIBIDO - Múltiples violaciones

---

## 6. ARCHIVOS QUE USAN LEGACY

### 6.1 Importan `student.js` (ClickUp)

- `src/core/automations/action-registry.js` (línea 239)
- `src/services/clickup-sync-listas.js` (línea 7)
- `src/endpoints/sync-all.js` (línea 7)
- `scripts/test-all-apis.js` (línea 7)

### 6.2 Usan `nivel.js` (ClickUp)

- `src/modules/nivel.js` - Se auto-usa
- `src/endpoints/sync-clickup-sql.js` - Importa y usa
- `src/services/clickup-sync-listas.js` - Usa funciones

### 6.3 Usan `streak.js` (ClickUp + SQLite)

- `src/core/student-context.js` - Importa `checkDailyStreak` (línea 11)
- `src/modules/streak.js` - Se auto-usa

---

## 7. ARCHIVOS QUE USAN v4 (CORRECTO)

### 7.1 Importan `student-v4.js` (PostgreSQL)

- `src/core/auth-context.js` (línea 8)
- `src/core/student-context.js` (línea 94 - import dinámico)
- `src/endpoints/enter.js` (línea 14)
- `src/endpoints/practicar.js` (línea 5)
- `src/endpoints/app/recorridos-runtime.js` (línea 12)
- `src/modules/suscripcion-v4.js` (línea 13)
- Múltiples scripts y tests

---

## 8. RESUMEN DE VIOLACIONES

### 8.1 Lecturas desde ClickUp (PROHIBIDO)

| Archivo | Función | Campo | Línea |
|---------|---------|-------|-------|
| `student.js` | `normalizeStudent()` | nivel | 48 |
| `student.js` | `normalizeStudent()` | streak | 51 |
| `student.js` | `normalizeStudent()` | lastPractice | 50 |
| `student.js` | `normalizeStudent()` | suscripcionActiva | 25-42 |
| `nivel.js` | `actualizarNivelSiNecesario()` | nivel | 84-85 |
| `sync-clickup-sql.js` | `sincronizarClickUpASQL()` | nivel, streak, lastPractice | 25-28 |
| `clickup-sync-listas.js` | `sincronizarListaPrincipalAurelin()` | nivel | 136, 385-391 |

### 8.2 Escrituras en ClickUp (PROHIBIDO como autoridad)

| Archivo | Función | Campo | Línea |
|---------|---------|-------|-------|
| `nivel.js` | `actualizarNivelSiNecesario()` | nivel | 101-103 |
| `streak.js` | `checkDailyStreak()` | streak, lastPractice | 82-83, 138-139, 168-169 |

### 8.3 Lecturas/Escrituras en SQLite (PROHIBIDO)

| Archivo | Función | Operación | Línea |
|---------|---------|-----------|-------|
| `streak.js` | `checkDailyStreak()` | UPDATE | 88-94, 144-150, 174-180 |
| `nivel.js` | `actualizarNivelSiNecesario()` | UPDATE | 108-114 |
| `sync-clickup-sql.js` | `sincronizarClickUpASQL()` | READ/WRITE | 19-20, 115 |

---

## 9. CONCLUSIÓN

### 9.1 Estado Actual

- ✅ **Flujo principal (v4)**: Usa PostgreSQL correctamente
- ❌ **Flujo legacy**: Aún lee desde ClickUp y escribe en SQLite
- ⚠️ **Coexistencia peligrosa**: Ambos flujos existen simultáneamente

### 9.2 Acciones Requeridas (Fase 2.1)

1. **Deshabilitar lecturas desde ClickUp** en runtime
2. **Deshabilitar escrituras en ClickUp** como autoridad
3. **Deshabilitar lecturas/escrituras en SQLite** en runtime
4. **Asegurar que solo PostgreSQL se consulta** para estado del alumno
5. **Aislar código legacy** (marcar como deprecated, hacer fallar explícitamente)

---

**FIN DE AUDITORÍA**

Este documento es la base para el corte de autoridad externa en runtime (Tarea 2).




