# CAMBIOS FASE 2.1 - CORTE DE AUTORIDAD EXTERNA

**Fecha**: 2025-01-XX  
**Fase**: 2.1 - Certificación Operativa del Alumno como SOT  
**Estado**: EN PROGRESO

---

## RESUMEN

Se han deshabilitado las funciones legacy que violan `CERTIFICACION_SOURCE_OF_TRUTH_FASE1.md`:
- Lecturas desde ClickUp (prohibido)
- Escrituras en ClickUp como autoridad (prohibido)
- Lecturas/Escrituras en SQLite (prohibido)

---

## ARCHIVOS MODIFICADOS

### 1. `src/modules/nivel.js`

#### `actualizarNivelSiNecesario()` - DESHABILITADA
- **Antes**: Leía nivel desde ClickUp, actualizaba ClickUp y SQLite
- **Después**: Lanza error explícito con mensaje de migración
- **Alternativa**: `src/modules/nivel-v4.js → actualizarNivelSiCorresponde()`

#### `getNivelInfo()` - DESHABILITADA
- **Antes**: Asumía que `student.nivel` venía de ClickUp
- **Después**: Lanza error explícito con mensaje de migración
- **Alternativa**: `src/core/progress-engine.js → computeProgress()`

---

### 2. `src/modules/streak.js`

#### `checkDailyStreak()` - DESHABILITADA
- **Antes**: Leía desde ClickUp, escribía en ClickUp y SQLite
- **Después**: Lanza error explícito con mensaje de migración
- **Alternativas**:
  - Lectura: `src/core/streak-engine.js → computeStreakFromPracticas()`
  - Mutación: `src/modules/student-v4.js → createStudentPractice() + updateStudentStreak()`

**Nota**: `src/core/student-context.js` ya maneja el error con try-catch, así que no rompe el flujo principal. La mutación cuando `forcePractice=true` necesita migración futura.

---

### 3. `src/modules/student.js`

#### `findStudentByEmail()` - DESHABILITADA
- **Antes**: Consultaba ClickUp API
- **Después**: Lanza error explícito con mensaje de migración
- **Alternativa**: `src/modules/student-v4.js → findStudentByEmail()`

#### `getOrCreateStudent()` - DESHABILITADA
- **Antes**: Usaba `findStudentByEmail()` y `createStudent()` (ClickUp)
- **Después**: Lanza error explícito con mensaje de migración
- **Alternativa**: `src/modules/student-v4.js → getOrCreateStudent()`

---

## IMPACTO EN RUNTIME

### Flujos que YA usan v4 (NO afectados)

1. **`src/core/auth-context.js`** → `requireStudentContext()`
   - ✅ Usa `student-v4.js → findStudentByEmail()`
   - ✅ Lee desde PostgreSQL

2. **`src/core/student-context.js`** → `buildStudentContext()`
   - ✅ Usa `student-v4.js` indirectamente
   - ✅ Usa `computeStreakFromPracticas()` para lectura canónica
   - ✅ Usa `computeProgress()` para nivel canónico
   - ⚠️ `checkDailyStreak()` falla silenciosamente (capturado por try-catch)
   - **Nota**: Mutación cuando `forcePractice=true` necesita migración

3. **`src/endpoints/enter.js`**
   - ✅ Usa `student-v4.js → findStudentByEmail()`
   - ✅ Usa `nivel-v4.js → actualizarNivelSiCorresponde()`

### Flujos que usan legacy (AFECTADOS - fallarán explícitamente)

1. **`src/core/automations/action-registry.js`**
   - ❌ Importa dinámicamente `student.js` y `streak.js`
   - **Acción requerida**: Migrar a v4

2. **`src/endpoints/limpieza-handler.js`**
   - ❌ Importa `streak.js → checkDailyStreak()`
   - **Acción requerida**: Migrar a v4

3. **`src/endpoints/practicar.js`**
   - ❌ Importa `streak.js → checkDailyStreak()`
   - **Acción requerida**: Migrar a v4

4. **`src/services/clickup-sync-listas.js`**
   - ❌ Importa `student.js → findStudentByEmail()`
   - **Nota**: Este es un servicio de sincronización, no runtime crítico
   - **Acción requerida**: Migrar o deshabilitar

5. **`src/endpoints/sync-all.js`**
   - ❌ Importa `nivel.js` y `student.js`
   - **Nota**: Endpoint de sincronización, no runtime crítico
   - **Acción requerida**: Migrar o deshabilitar

---

## COMPORTAMIENTO ESPERADO

### Escenario 1: Flujo principal (v4) - FUNCIONA
- Usuario accede a `/enter`
- `auth-context.js` → `student-v4.js` → PostgreSQL ✅
- `buildStudentContext()` → `computeStreakFromPracticas()` → PostgreSQL ✅
- `buildStudentContext()` → `computeProgress()` → PostgreSQL ✅
- **Resultado**: ✅ Funciona correctamente

### Escenario 2: Flujo legacy - FALLA EXPLÍCITAMENTE
- Código intenta usar `student.js → findStudentByEmail()`
- **Resultado**: ❌ Error con código `LEGACY_DISABLED` y mensaje de migración

### Escenario 3: Mutación de práctica (forcePractice=true) - FALLA SILENCIOSAMENTE
- `buildStudentContext()` con `opts.forcePractice=true`
- `checkDailyStreak()` lanza error
- Error capturado por try-catch
- Sistema continúa con lectura canónica
- **Resultado**: ⚠️ Lectura funciona, mutación no se ejecuta (necesita migración)

---

## PRÓXIMOS PASOS

1. ✅ **Corte de autoridad externa** - COMPLETADO
2. ⏳ **Centralización de lectura** - En progreso (ya está centralizado en v4)
3. ⏳ **Escrituras controladas** - Pendiente (mutación de práctica necesita migración)
4. ⏳ **Preparación para señales** - Pendiente
5. ⏳ **Legacy aislado** - Pendiente (algunos endpoints aún usan legacy)
6. ⏳ **Verificación final** - Pendiente

---

**FIN DE DOCUMENTACIÓN**




