# STUDENT SOT AUDIT v1 - AuriPortal Master

**Fecha:** 2025-01-XX  
**Versión:** v5.51.0-master-students-layout-diagnostic  
**Objetivo:** Identificar el Source of Truth canónico de alumnos en PostgreSQL

---

## 📊 RESUMEN EJECUTIVO

**Tabla Canónica:** `alumnos` (PostgreSQL, schema `public`)  
**Repositorio Canónico:** `src/infra/repos/student-repo-pg.js` (clase `StudentRepoPg`)  
**Servicio Canónico:** `src/services/student-sot-service.js`  
**Estado:** ✅ Tabla existe y está operativa

---

## 🔍 AUDITORÍA DE CÓDIGO

### Tabla PostgreSQL: `alumnos`

**Ubicación del Schema:**
- `database/pg.js` líneas 129-151 (CREATE TABLE)
- Schema: `public`
- Engine: PostgreSQL

**Columnas Identificadas:**
```sql
id SERIAL PRIMARY KEY
email VARCHAR(255) UNIQUE NOT NULL
apodo VARCHAR(255)
fecha_inscripcion TIMESTAMP NOT NULL
fecha_ultima_practica TIMESTAMP
nivel_actual INTEGER DEFAULT 1
nivel_manual INTEGER
streak INTEGER DEFAULT 0
estado_suscripcion VARCHAR(50) DEFAULT 'activa'
fecha_reactivacion TIMESTAMP
energia_emocional INTEGER DEFAULT 5
tono_meditacion_id INTEGER REFERENCES tonos_meditacion(id)
tema_preferido VARCHAR(20) DEFAULT 'light'
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

**Índices:**
- `idx_alumnos_email` (email)
- `idx_alumnos_nivel_actual` (nivel_actual)
- `idx_alumnos_fecha_inscripcion` (fecha_inscripcion)
- `idx_alumnos_estado_suscripcion` (estado_suscripcion)

### Repositorio: `StudentRepoPg`

**Archivo:** `src/infra/repos/student-repo-pg.js`  
**Clase:** `StudentRepoPg`  
**Métodos disponibles:**
- `getByEmail(email, client?)` → SELECT * FROM alumnos WHERE email = $1
- `getById(id, client?)` → SELECT * FROM alumnos WHERE id = $1
- `create(data, client?)` → INSERT INTO alumnos ...
- `updateById(id, patch, client?)` → UPDATE alumnos ...
- `upsertByEmail(email, data, client?)` → INSERT ... ON CONFLICT DO UPDATE
- `updateNivel(email, nivel, client?)`
- `updateStreak(email, streak, client?)`
- `updateUltimaPractica(email, fecha, client?)`
- `updateEstadoSuscripcion(email, estado, fechaReactivacion, client?)`
- `updateApodo(email, apodo, client?)`
- `updateApodoById(id, apodo, client?)`

**Contrato:** `src/core/repos/student-repo.js` (interfaz/documentación)

### Servicio: `student-sot-service.js`

**Archivo:** `src/services/student-sot-service.js`  
**Funciones disponibles:**
- `getStudent(studentId)` → usa `studentRepo.getById()`
- `getStudentByEmail(email)` → usa `studentRepo.getByEmail()`
- `listStudents(filter)` → SELECT con filtros (search, status, paginación)
- `ensureStudentExists(email, data)` → usa `studentRepo.upsertByEmail()`

**Nota:** `listStudents()` devuelve un subset de columnas, no SELECT *:
```sql
SELECT id, email, apodo as display_name, estado_suscripcion, nivel_actual, streak, fecha_inscripcion
FROM alumnos
```

---

## 🔗 TABLAS RELACIONADAS (Foreign Keys)

### Tablas que referencian `alumnos.id`:

1. **`pausas`**
   - FK: `alumno_id INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE`
   - Ubicación: `database/pg.js` líneas 184-197

2. **`practicas`**
   - FK: `alumno_id INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE`
   - Ubicación: `database/pg.js` líneas 199-215

3. **`student_product_memberships`**
   - FK: `student_id` (referencia `alumnos.id`)
   - Usado en: `src/endpoints/admin-api-students.js` línea 153

4. **`student_domain_policies`**
   - FK: `student_id` (referencia `alumnos.id`)
   - Usado en: servicios de dominio (transmutaciones, proyectos, etc.)

5. **`student_item_states`**
   - FK: `student_id` (referencia `alumnos.id`)
   - Usado en: servicios de dominio

6. **`student_audit_events`**
   - FK: `student_id` (referencia `alumnos.id`)
   - Usado en: auditoría de cambios

### Otras tablas relacionadas (por nombre):

- `alumnos_lugares` (referencia `alumnos.id`)
- `alumnos_proyectos` (referencia `alumnos.id`)
- `alumnos_apadrinados` (referencia `alumnos.id`)
- `misiones_alumnos` (referencia `alumnos.id`)
- `limpieza_hogar_alumnos` (referencia `alumnos.id`)
- `aspectos_karmicos_alumnos` (referencia `alumnos.id`)
- `aspectos_indeseables_alumnos` (referencia `alumnos.id`)
- `items_transmutaciones_alumnos` (referencia `alumnos.id`)
- ... (más tablas según migraciones)

---

## 📝 TABLAS LEGACY (NO USAR)

### Tabla SQLite: `students` (LEGACY)
**Archivo:** `database/schema.sql` (SQLite legacy)  
**Estado:** ❌ LEGACY - NO USAR  
**Nota:** Esquema antiguo de SQLite, no se usa en runtime.

---

## ✅ CONCLUSIÓN

**Source of Truth Canónico:**
- **Tabla:** `alumnos` (PostgreSQL, schema `public`)
- **Repositorio:** `StudentRepoPg` (`src/infra/repos/student-repo-pg.js`)
- **Servicio:** `student-sot-service.js` (`src/services/student-sot-service.js`)

**Acción para UI Diagnóstica:**
- Usar tabla `alumnos` directamente para introspección
- Usar `information_schema.columns` para metadata de columnas
- Usar `listStudents()` del servicio como base, pero extender para incluir todas las columnas
- Detectar tablas relacionadas usando `information_schema.table_constraints` y `information_schema.key_column_usage`

**No requiere migraciones nuevas** - La tabla ya existe y está operativa.

---

## ✅ VALIDACIÓN FINAL

**Estado de la Tabla:**
- ✅ Tabla `alumnos` existe en PostgreSQL
- ✅ Columnas identificadas y documentadas
- ✅ Repositorio `StudentRepoPg` implementado y funcional
- ✅ Servicio `student-sot-service.js` disponible

**Conclusión:**
No se requieren migraciones. La tabla canónica existe y está lista para uso.

---

## 🔧 PRÓXIMOS PASOS

1. ✅ Tabla canónica identificada: `alumnos`
2. ✅ Repositorio identificado: `StudentRepoPg`
3. ✅ Servicio identificado: `student-sot-service.js`
4. ⏳ Crear endpoints MASTER API para introspección
5. ⏳ Crear UI diagnóstica con tabla técnica
6. ⏳ Añadir al sidebar MASTER
