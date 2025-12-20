# Mapa de Migración SQLite → PostgreSQL
## Diagnóstico Técnico Exhaustivo - AuriPortal v4.3.0

**Fecha de diagnóstico:** 2024  
**Versión del sistema:** 4.3.0  
**Estado:** Diagnóstico completo - Sin modificaciones de código

---

## Resumen Ejecutivo

### Situación Actual

AuriPortal v4.3.0 presenta un estado de **migración parcial** de SQLite a PostgreSQL:

- **PostgreSQL** es la fuente de verdad según `PRINCIPIOS_INMUTABLES_AURIPORTAL.md`
- **SQLite** está marcado como legacy y deprecado en `database/db.js` (stub que lanza errores)
- **Múltiples módulos legacy** aún intentan usar SQLite, lo que causará errores en runtime
- **Endpoints críticos** ya migraron a módulos v4 (PostgreSQL)
- **Endpoints administrativos y scripts** aún dependen de SQLite

### Riesgo Crítico

El archivo `database/db.js` es un **stub que lanza errores** cuando se llama a `getDatabase()`. Esto significa que:

1. **Cualquier código que importe `database/db.js` fallará en runtime**
2. Los módulos legacy (`streak.js`, `nivel.js`) están **rotos** pero pueden no ejecutarse si no se usan
3. Los endpoints administrativos (`admin-panel.js`, `sql-admin.js`) **fallarán** si se acceden
4. Los scripts de utilidad (`test-all-apis.js`, `generate-html-report.js`) **fallarán** si se ejecutan

### Violaciones de Principios Inmutables

1. **Principio 1 (PostgreSQL como única fuente de verdad):**
   - `streak.js` escribe en SQLite (líneas 88, 144, 174)
   - `nivel.js` escribe en SQLite (línea 108)
   - `typeform-webhook.js` escribe en SQLite (líneas 95, 141, 174)
   - `sync-clickup-sql.js` lee/escribe en SQLite (líneas 21, 117, 154)

2. **Principio 4 (Transacciones para operaciones multi-tabla):**
   - `streak.js` actualiza ClickUp y SQLite sin transacción (líneas 82-94, 138-150, 168-180)
   - `typeform-webhook.js` crea en ClickUp y SQLite sin transacción (líneas 94-111, 140-142, 173-175)

---

## Inventario Completo

### Tabla de Hallazgos

| Archivo | Función | Tipo de Uso | Dominio Afectado | Riesgo | ¿Existe v4 en PostgreSQL? |
|---------|---------|-------------|------------------|--------|---------------------------|
| `src/modules/streak.js` | `checkDailyStreak()` | Escritura | Streak, Prácticas | 🔴 ALTO | ✅ Sí (`streak-v4.js`) |
| `src/modules/nivel.js` | `actualizarNivelSiNecesario()` | Escritura | Nivel | 🔴 ALTO | ✅ Sí (`nivel-v4.js`) |
| `src/endpoints/admin-panel.js` | `renderAdminPanel()` | Lectura | Estadísticas | 🟡 MEDIO | ❌ No (solo admin) |
| `src/endpoints/admin-panel.js` | `adminPanelHandler()` POST `/admin/sql` | Lectura | Consultas SQL | 🟡 MEDIO | ❌ No (solo admin) |
| `src/endpoints/admin-panel.js` | `adminPanelHandler()` GET `/admin/logs` | Lectura | Logs | 🟡 MEDIO | ❌ No (solo admin) |
| `src/endpoints/sql-admin.js` | `getAllTables()` | Lectura | Metadatos | 🟡 MEDIO | ❌ No (solo admin) |
| `src/endpoints/sql-admin.js` | `getTableSchema()` | Lectura | Metadatos | 🟡 MEDIO | ❌ No (solo admin) |
| `src/endpoints/sql-admin.js` | `getTableData()` | Lectura | Estudiantes, Prácticas, Logs | 🟡 MEDIO | ❌ No (solo admin) |
| `src/endpoints/sql-admin.js` | `updateRecord()` | Escritura | Estudiantes, Prácticas | 🟡 MEDIO | ❌ No (solo admin) |
| `src/endpoints/sync-clickup-sql.js` | `sincronizarClickUpASQL()` | Lectura/Escritura | Estudiantes, Sincronización | 🟡 MEDIO | ❌ No (legacy sync) |
| `src/endpoints/sync-clickup-sql.js` | `sincronizarSQLAClickUp()` | Lectura | Estudiantes, Sincronización | 🟡 MEDIO | ❌ No (legacy sync) |
| `src/endpoints/typeform-webhook.js` | `typeformWebhookHandler()` | Escritura | Estudiantes, Onboarding | 🔴 ALTO | ✅ Sí (`typeform-webhook-v4.js`) |
| `src/endpoints/sync-all-clickup-sql.js` | `syncAllClickUpSQLHandler()` | Lectura/Escritura | Estudiantes, Sincronización masiva | 🟡 MEDIO | ❌ No (legacy sync) |
| `src/endpoints/limpieza-handler.js` | Usa `streak.js` | Escritura indirecta | Streak | 🔴 ALTO | ✅ Sí (`streak-v4.js`) |
| `scripts/test-all-apis.js` | `testSQLDatabase()` | Lectura | Testing | 🟢 BAJO | ❌ No (solo script) |
| `scripts/generate-html-report.js` | Lectura directa SQLite | Lectura | Reportes | 🟢 BAJO | ❌ No (solo script) |

### Clasificación por Estado de Migración

#### ✅ 100% Migrado a PostgreSQL (Módulos v4)

**Módulos:**
- `src/modules/student-v4.js` → Usa `infra/repos/student-repo-pg.js`
- `src/modules/streak-v4.js` → Usa `student-v4.js` y transacciones PostgreSQL
- `src/modules/nivel-v4.js` → Usa `student-v4.js` y transacciones PostgreSQL
- `src/modules/suscripcion-v4.js` → Usa `student-v4.js` y transacciones PostgreSQL
- `src/modules/practice-v4.js` → Usa `infra/repos/practice-repo-pg.js`
- `src/modules/pausa-v4.js` → Usa `infra/repos/pausa-repo-pg.js`

**Endpoints que usan v4:**
- `src/endpoints/enter.js` → Usa `student-v4`, `streak-v4`, `nivel-v4`, `suscripcion-v4`
- `src/endpoints/practicar.js` → Usa `student-v4`, `streak-v4`, `nivel-v4`
- `src/endpoints/aprender.js` → Usa `student-v4`, `nivel-v4`
- `src/endpoints/onboarding-complete.js` → Usa `student-v4`, `nivel-v4`
- `src/endpoints/typeform-webhook-v4.js` → Usa `student-v4`, `nivel-v4`
- `src/endpoints/topic-list.js` → Usa `student-v4`
- `src/endpoints/topic-screen.js` → Usa `student-v4`
- `src/endpoints/tecnica-post-practica-handler.js` → Usa `student-v4`
- `src/endpoints/preparacion-practica-handler.js` → Usa `student-v4`
- `src/endpoints/transmutaciones-cliente.js` → Usa `student-v4`
- `src/endpoints/admin-panel-v4.js` → Usa `student-v4`, `nivel-v4`

**Estado:** ✅ Funcional y operativo. Estos endpoints NO dependen de SQLite.

#### ⚠️ Mezclado (PostgreSQL + SQLite)

**No hay módulos mezclados.** Los módulos legacy usan SOLO SQLite, y los v4 usan SOLO PostgreSQL.

**Endpoints que usan legacy:**
- `src/endpoints/sync-all.js` → Usa `nivel.js` (legacy) y `student.js` (legacy)
- `src/endpoints/limpieza-handler.js` → Usa `streak.js` (legacy)

**Estado:** ⚠️ Estos endpoints pueden fallar si se ejecutan, ya que `database/db.js` lanza errores.

#### 🔴 Completamente Legacy (Solo SQLite)

**Módulos legacy:**
- `src/modules/streak.js` → Escribe en SQLite (3 ubicaciones: líneas 88, 144, 174)
- `src/modules/nivel.js` → Escribe en SQLite (1 ubicación: línea 108)

**Endpoints legacy:**
- `src/endpoints/admin-panel.js` → Lee de SQLite (3 ubicaciones: líneas 45, 591, 615)
- `src/endpoints/sql-admin.js` → Lee/Escribe en SQLite (5 ubicaciones: líneas 29, 51, 65, 137, 158)
- `src/endpoints/sync-clickup-sql.js` → Lee/Escribe en SQLite (3 ubicaciones: líneas 21, 117, 154)
- `src/endpoints/typeform-webhook.js` → Escribe en SQLite (3 ubicaciones: líneas 95, 141, 174)
- `src/endpoints/sync-all-clickup-sql.js` → Usa `sync-clickup-sql.js` (indirecto)

**Scripts legacy:**
- `scripts/test-all-apis.js` → Usa SQLite (líneas 8-9, 130, 134, 139)
- `scripts/generate-html-report.js` → Usa SQLite directamente con `better-sqlite3` (línea 5)

**Estado:** 🔴 **ROTO** - Todos estos archivos fallarán en runtime porque `database/db.js` lanza errores.

---

## Análisis Detallado por Dominio

### 1. Dominio: Streak (Racha de Práctica)

#### Módulo Legacy: `src/modules/streak.js`

**Ubicaciones de uso de SQLite:**
- Línea 88: Primera práctica → `UPDATE students SET racha_actual = 1, ultima_practica_date = ?`
- Línea 144: Incrementar racha → `UPDATE students SET racha_actual = ?, ultima_practica_date = ?`
- Línea 174: Resetear racha → `UPDATE students SET racha_actual = 1, ultima_practica_date = ?`

**Tipo de operación:** Escritura directa en SQLite

**Violaciones:**
- ❌ Viola Principio 1: PostgreSQL es la única fuente de verdad
- ❌ Viola Principio 4: Actualiza ClickUp y SQLite sin transacción

**Módulo v4 equivalente:** `src/modules/streak-v4.js`
- ✅ Usa `student-v4.js` → `updateStudentStreak()`
- ✅ Usa transacciones PostgreSQL
- ✅ Cumple todos los principios inmutables

**Endpoints que usan legacy:**
- `src/endpoints/limpieza-handler.js` → Importa `streak.js` (línea 10)

**Endpoints que usan v4:**
- `src/endpoints/enter.js` → Importa `streak-v4.js` (línea 16)
- `src/endpoints/practicar.js` → Importa `streak-v4.js` (línea 7)

**Riesgo:** 🔴 ALTO - El módulo legacy está roto y puede causar inconsistencias si se ejecuta.

---

### 2. Dominio: Nivel

#### Módulo Legacy: `src/modules/nivel.js`

**Ubicaciones de uso de SQLite:**
- Línea 108: Actualizar nivel → `UPDATE students SET nivel = ?, updated_at = CURRENT_TIMESTAMP`

**Tipo de operación:** Escritura directa en SQLite

**Violaciones:**
- ❌ Viola Principio 1: PostgreSQL es la única fuente de verdad

**Módulo v4 equivalente:** `src/modules/nivel-v4.js`
- ✅ Usa `student-v4.js` → `updateStudentNivel()`
- ✅ Usa transacciones PostgreSQL
- ✅ Cumple todos los principios inmutables

**Endpoints que usan legacy:**
- `src/endpoints/sync-clickup-sql.js` → Importa `nivel.js` (línea 8)
- `src/endpoints/typeform-webhook.js` → Importa `nivel.js` (línea 8)
- `src/endpoints/sync-all.js` → Importa `nivel.js` (línea 6)

**Endpoints que usan v4:**
- `src/endpoints/enter.js` → Importa `nivel-v4.js` (línea 18)
- `src/endpoints/practicar.js` → Importa `nivel-v4.js` (línea 6)
- `src/endpoints/aprender.js` → Importa `nivel-v4.js` (línea 6)
- `src/endpoints/onboarding-complete.js` → Importa `nivel-v4.js` (línea 6)
- `src/endpoints/typeform-webhook-v4.js` → Importa `nivel-v4.js` (línea 8)

**Riesgo:** 🔴 ALTO - El módulo legacy está roto y puede causar inconsistencias si se ejecuta.

---

### 3. Dominio: Estudiantes (Onboarding)

#### Endpoint Legacy: `src/endpoints/typeform-webhook.js`

**Ubicaciones de uso de SQLite:**
- Línea 95: Crear/actualizar estudiante → `students.upsert()`
- Línea 141: Actualizar `clickup_task_id` → `UPDATE students SET clickup_task_id = ?`
- Línea 174: Actualizar `clickup_task_id` → `UPDATE students SET clickup_task_id = ?`

**Tipo de operación:** Escritura directa en SQLite

**Violaciones:**
- ❌ Viola Principio 1: PostgreSQL es la única fuente de verdad
- ❌ Viola Principio 4: Crea en ClickUp y SQLite sin transacción

**Endpoint v4 equivalente:** `src/endpoints/typeform-webhook-v4.js`
- ✅ Usa `student-v4.js` → `createOrUpdateStudent()`
- ✅ Usa transacciones PostgreSQL
- ✅ Cumple todos los principios inmutables

**Riesgo:** 🔴 ALTO - El endpoint legacy está roto. Si Typeform envía webhooks a este endpoint, fallará.

**Recomendación:** Verificar qué URL de webhook está configurada en Typeform. Si apunta a `/typeform-webhook`, debe cambiarse a `/typeform-webhook-v4`.

---

### 4. Dominio: Sincronización ClickUp ↔ SQL

#### Endpoints Legacy: `sync-clickup-sql.js` y `sync-all-clickup-sql.js`

**Ubicaciones de uso de SQLite:**
- `sync-clickup-sql.js` línea 21: `getDatabase()` para leer estudiantes
- `sync-clickup-sql.js` línea 117: `UPDATE students SET ...` para sincronizar desde ClickUp
- `sync-clickup-sql.js` línea 154: `students.findByEmail()` para leer desde SQLite

**Tipo de operación:** Lectura/Escritura bidireccional

**Violaciones:**
- ❌ Viola Principio 1: PostgreSQL es la única fuente de verdad
- ⚠️ Estos endpoints están diseñados para sincronizar ClickUp con SQLite (legacy)

**Estado:** 🟡 MEDIO - Estos endpoints son herramientas administrativas. Si no se usan, no afectan el flujo principal.

**Riesgo:** 🟡 MEDIO - Solo afecta si se ejecutan manualmente desde el panel admin.

---

### 5. Dominio: Panel Administrativo

#### Endpoints Legacy: `admin-panel.js` y `sql-admin.js`

**Ubicaciones de uso de SQLite:**
- `admin-panel.js` línea 45: Estadísticas → `SELECT COUNT(*) FROM students`
- `admin-panel.js` línea 591: Consultas SQL → `db.prepare(query)`
- `admin-panel.js` línea 615: Logs → `SELECT * FROM sync_log`
- `sql-admin.js` múltiples: CRUD completo de tablas SQLite

**Tipo de operación:** Lectura/Escritura para administración

**Violaciones:**
- ❌ Viola Principio 1: PostgreSQL es la única fuente de verdad
- ⚠️ Estos endpoints están diseñados para administrar SQLite (legacy)

**Estado:** 🟡 MEDIO - Herramientas administrativas. Si no se usan, no afectan el flujo principal.

**Riesgo:** 🟡 MEDIO - Solo afecta si se accede al panel admin.

**Alternativa v4:** `src/endpoints/admin-panel-v4.js` existe pero no tiene todas las funcionalidades del panel legacy.

---

### 6. Dominio: Scripts de Utilidad

#### Scripts Legacy: `test-all-apis.js` y `generate-html-report.js`

**Ubicaciones de uso de SQLite:**
- `test-all-apis.js` líneas 8-9: Importa `getDatabase`, `students`, `initDatabase`
- `test-all-apis.js` línea 130: `initDatabase()`
- `test-all-apis.js` línea 134: `SELECT COUNT(*) FROM students`
- `generate-html-report.js` línea 5: Importa `better-sqlite3` directamente

**Tipo de operación:** Lectura para testing/reportes

**Estado:** 🟢 BAJO - Scripts de desarrollo/testing. No afectan producción.

**Riesgo:** 🟢 BAJO - Solo afecta si se ejecutan manualmente.

---

## Operaciones Sin Transacciones (Violación Principio 4)

### 1. `src/modules/streak.js` → `checkDailyStreak()`

**Operaciones:**
1. Actualiza ClickUp (líneas 82-83, 138-139, 168-169)
2. Actualiza SQLite (líneas 88-90, 144-146, 174-176)

**Problema:** Si ClickUp se actualiza pero SQLite falla (o viceversa), hay inconsistencia.

**Ubicaciones:**
- Primera práctica: líneas 82-94
- Incrementar racha: líneas 138-150
- Resetear racha: líneas 168-180

**Riesgo:** 🔴 ALTO - Operación crítica sin atomicidad.

---

### 2. `src/endpoints/typeform-webhook.js` → `typeformWebhookHandler()`

**Operaciones:**
1. Crea/actualiza en SQLite (líneas 95-106)
2. Crea/actualiza en ClickUp (líneas 116-191)
3. Actualiza `clickup_task_id` en SQLite (líneas 141-142, 174-175)

**Problema:** Si ClickUp se crea pero SQLite falla (o viceversa), hay inconsistencia.

**Ubicaciones:**
- Crear estudiante: líneas 94-111
- Actualizar estudiante: líneas 140-142, 173-175

**Riesgo:** 🔴 ALTO - Operación crítica sin atomicidad.

---

## Módulos 100% en PostgreSQL

### ✅ Módulos v4 Completos

1. **`src/modules/student-v4.js`**
   - Usa: `infra/repos/student-repo-pg.js`
   - Funciones: `getOrCreateStudent()`, `findStudentByEmail()`, `updateStudentStreak()`, etc.
   - Estado: ✅ Completo y funcional

2. **`src/modules/streak-v4.js`**
   - Usa: `student-v4.js` + transacciones PostgreSQL
   - Funciones: `checkDailyStreak()` con atomicidad
   - Estado: ✅ Completo y funcional

3. **`src/modules/nivel-v4.js`**
   - Usa: `student-v4.js` + transacciones PostgreSQL
   - Funciones: `actualizarNivelSiCorresponde()`, `getNivelInfo()`
   - Estado: ✅ Completo y funcional

4. **`src/modules/suscripcion-v4.js`**
   - Usa: `student-v4.js` + transacciones PostgreSQL
   - Funciones: `puedePracticarHoy()`, `gestionarEstadoSuscripcion()`
   - Estado: ✅ Completo y funcional

5. **`src/modules/practice-v4.js`**
   - Usa: `infra/repos/practice-repo-pg.js`
   - Funciones: `crearPractica()`
   - Estado: ✅ Completo y funcional

6. **`src/modules/pausa-v4.js`**
   - Usa: `infra/repos/pausa-repo-pg.js`
   - Funciones: `getPausaActiva()`, `crearPausa()`, `cerrarPausa()`
   - Estado: ✅ Completo y funcional

---

## Riesgos Actuales

### 🔴 Riesgos Críticos

1. **Código Legacy Roto**
   - `database/db.js` lanza errores cuando se llama a `getDatabase()`
   - Cualquier endpoint/script que use SQLite fallará inmediatamente
   - **Impacto:** Endpoints administrativos y scripts no funcionan

2. **Inconsistencias de Datos**
   - Si algún código legacy se ejecuta (aunque falle), puede dejar datos inconsistentes
   - ClickUp puede tener datos que PostgreSQL no tiene (o viceversa)
   - **Impacto:** Pérdida de integridad de datos

3. **Webhook Typeform Legacy**
   - Si Typeform está configurado para usar `/typeform-webhook` (legacy), fallará
   - Nuevos estudiantes no se crearán correctamente
   - **Impacto:** Onboarding roto para nuevos estudiantes

### 🟡 Riesgos Medios

1. **Panel Administrativo Roto**
   - `admin-panel.js` y `sql-admin.js` no funcionan
   - No se pueden ver estadísticas ni editar datos desde el panel
   - **Impacto:** Pérdida de herramientas administrativas

2. **Sincronización Legacy Rota**
   - `sync-clickup-sql.js` no funciona
   - No se puede sincronizar manualmente ClickUp ↔ SQLite
   - **Impacto:** Herramientas de sincronización no disponibles (pero no crítico si no se usan)

### 🟢 Riesgos Bajos

1. **Scripts de Testing Rotos**
   - `test-all-apis.js` y `generate-html-report.js` no funcionan
   - **Impacto:** Solo afecta desarrollo/testing, no producción

---

## Orden Recomendado de Migración

### Fase 1: Eliminar Dependencias Críticas (Prioridad Alta)

**Objetivo:** Asegurar que ningún flujo crítico use SQLite.

#### Paso 1.1: Verificar y Migrar Webhook Typeform
- [ ] Verificar URL de webhook en Typeform
- [ ] Si apunta a `/typeform-webhook`, cambiar a `/typeform-webhook-v4`
- [ ] Probar webhook con estudiante de prueba
- [ ] **Riesgo:** Bajo (solo cambio de configuración)

#### Paso 1.2: Eliminar Uso de `streak.js` Legacy
- [ ] Verificar que `limpieza-handler.js` no se use en producción
- [ ] Si se usa, migrar a `streak-v4.js`
- [ ] Eliminar import de `streak.js` en `limpieza-handler.js`
- [ ] **Riesgo:** Medio (requiere testing)

#### Paso 1.3: Eliminar Uso de `nivel.js` Legacy
- [ ] Verificar que `sync-all.js` no se use en producción
- [ ] Si se usa, migrar a `nivel-v4.js`
- [ ] Eliminar import de `nivel.js` en `sync-all.js`
- [ ] **Riesgo:** Medio (requiere testing)

---

### Fase 2: Migrar Endpoints Administrativos (Prioridad Media)

**Objetivo:** Restaurar funcionalidad administrativa usando PostgreSQL.

#### Paso 2.1: Migrar `admin-panel.js`
- [ ] Crear funciones de estadísticas en PostgreSQL
- [ ] Migrar consultas SQL a PostgreSQL
- [ ] Migrar logs a PostgreSQL (o eliminar si no son críticos)
- [ ] **Riesgo:** Medio (herramienta administrativa)

#### Paso 2.2: Migrar `sql-admin.js`
- [ ] Evaluar si se necesita panel SQL para PostgreSQL
- [ ] Si se necesita, crear `sql-admin-v4.js` usando PostgreSQL
- [ ] Si no se necesita, documentar deprecación
- [ ] **Riesgo:** Bajo (herramienta administrativa opcional)

#### Paso 2.3: Migrar `sync-clickup-sql.js`
- [ ] Evaluar si se necesita sincronización ClickUp ↔ PostgreSQL
- [ ] Si se necesita, crear `sync-clickup-pg.js` usando PostgreSQL
- [ ] Si no se necesita, documentar deprecación
- [ ] **Riesgo:** Bajo (herramienta administrativa opcional)

---

### Fase 3: Limpiar Código Legacy (Prioridad Baja)

**Objetivo:** Eliminar código legacy no utilizado.

#### Paso 3.1: Eliminar Módulos Legacy
- [ ] Eliminar `src/modules/streak.js` (después de verificar que no se usa)
- [ ] Eliminar `src/modules/nivel.js` (después de verificar que no se usa)
- [ ] Eliminar `src/modules/student.js` (si existe y no se usa)
- [ ] Eliminar `src/modules/suscripcion.js` (si existe y no se usa)
- [ ] **Riesgo:** Bajo (solo limpieza)

#### Paso 3.2: Eliminar Endpoints Legacy
- [ ] Eliminar `src/endpoints/typeform-webhook.js` (después de migrar webhook)
- [ ] Eliminar `src/endpoints/admin-panel.js` (después de migrar a v4)
- [ ] Eliminar `src/endpoints/sql-admin.js` (después de migrar a v4)
- [ ] Eliminar `src/endpoints/sync-clickup-sql.js` (después de migrar a v4)
- [ ] Eliminar `src/endpoints/sync-all-clickup-sql.js` (después de migrar a v4)
- [ ] **Riesgo:** Bajo (solo limpieza)

#### Paso 3.3: Eliminar Scripts Legacy
- [ ] Migrar `scripts/test-all-apis.js` a PostgreSQL (si se necesita)
- [ ] Migrar `scripts/generate-html-report.js` a PostgreSQL (si se necesita)
- [ ] O eliminar scripts si no se usan
- [ ] **Riesgo:** Bajo (solo scripts de desarrollo)

#### Paso 3.4: Eliminar `database/db.js`
- [ ] Después de eliminar todas las dependencias, eliminar `database/db.js`
- [ ] Eliminar `database/schema.sql` (schema SQLite legacy)
- [ ] **Riesgo:** Bajo (solo limpieza final)

---

## Qué NO Debe Tocarse Todavía

### ⚠️ Archivos que NO deben modificarse (por ahora)

1. **`database/db.js`**
   - Aunque es un stub, mantenerlo temporalmente para evitar errores de import
   - Eliminar solo después de eliminar todas las dependencias

2. **Módulos v4**
   - `src/modules/student-v4.js` → ✅ NO TOCAR
   - `src/modules/streak-v4.js` → ✅ NO TOCAR
   - `src/modules/nivel-v4.js` → ✅ NO TOCAR
   - `src/modules/suscripcion-v4.js` → ✅ NO TOCAR
   - Estos módulos están funcionando correctamente

3. **Endpoints v4**
   - Todos los endpoints que usan módulos v4 → ✅ NO TOCAR
   - Estos endpoints están funcionando correctamente

4. **Repositorios PostgreSQL**
   - `src/infra/repos/*-repo-pg.js` → ✅ NO TOCAR
   - Estos repositorios están funcionando correctamente

5. **`database/pg.js`**
   - ✅ NO TOCAR
   - Este archivo gestiona PostgreSQL correctamente

---

## Recomendaciones Inmediatas

### 🔴 Acciones Críticas (Hacer Ahora)

1. **Verificar Webhook Typeform**
   ```bash
   # Verificar en Typeform qué URL está configurada
   # Si es /typeform-webhook, cambiar a /typeform-webhook-v4
   ```

2. **Verificar Endpoints en Producción**
   ```bash
   # Buscar en logs si algún endpoint legacy se está ejecutando
   grep -r "typeform-webhook" /var/log/
   grep -r "sync-clickup-sql" /var/log/
   grep -r "admin-panel" /var/log/
   ```

3. **Documentar Estado Actual**
   - Este documento ya está creado ✅
   - Compartir con equipo para conocimiento

### 🟡 Acciones Recomendadas (Hacer Pronto)

1. **Migrar Panel Administrativo**
   - Priorizar si se usa frecuentemente
   - Crear `admin-panel-v4.js` completo con funcionalidades de PostgreSQL

2. **Eliminar Imports Legacy**
   - Buscar y eliminar imports de `database/db.js` en código no usado
   - Usar `grep -r "database/db.js" src/` para encontrar todos

### 🟢 Acciones Opcionales (Hacer Después)

1. **Limpiar Scripts**
   - Migrar o eliminar scripts de testing si no se usan

2. **Documentación**
   - Actualizar README para reflejar que SQLite está deprecado
   - Documentar proceso de migración completado

---

## Conclusión

### Estado General

AuriPortal v4.3.0 tiene una **arquitectura sólida en PostgreSQL** para los flujos críticos:

- ✅ **Flujos principales** (enter, practicar, aprender) usan módulos v4
- ✅ **Módulos v4** cumplen todos los principios inmutables
- ✅ **PostgreSQL** es la fuente de verdad para datos críticos

Sin embargo, existe **código legacy roto** que:

- 🔴 **Puede causar errores** si se ejecuta
- 🔴 **Viola principios inmutables** (SQLite como fuente de verdad)
- 🟡 **Afecta herramientas administrativas** (no crítico)

### Prioridad de Acción

1. **🔴 CRÍTICO:** Verificar y migrar webhook Typeform
2. **🟡 MEDIO:** Migrar panel administrativo si se usa
3. **🟢 BAJO:** Limpiar código legacy no utilizado

### Riesgo de No Actuar

- **Bajo riesgo** si los endpoints legacy no se ejecutan
- **Alto riesgo** si Typeform usa webhook legacy (onboarding roto)
- **Medio riesgo** si se necesita panel administrativo

---

**Documento generado por:** Auditoría técnica exhaustiva  
**Método:** Análisis estático de código + búsqueda semántica  
**Sin modificaciones de código:** Solo observación y documentación













