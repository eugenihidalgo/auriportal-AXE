# IDENTIDAD DE ALUMNOS CANÓNICA v1
**AuriPortal / Aurelín — Dominio MASTER**  
**Versión:** 1.0.0  
**Fecha:** 2026-01-13  
**Estado:** CANÓNICO  
**Commit:** 4967588 (v5.68.2-students-endpoint-uuid)

---

## PROPÓSITO

Documentación canónica de la identidad de alumnos en AuriPortal.

Este documento refleja **EXACTAMENTE** la implementación canónica después de la migración UUID-first v5.68.2. Es la referencia definitiva para:
- Entender la identidad canónica de alumnos (UUID-first)
- Implementar nuevos módulos relacionados con alumnos
- Mantener coherencia con el diseño canónico
- Verificar que no se usa legacy en runtime

**OBLIGATORIO:** Cualquier cambio relacionado con identidad de alumnos debe respetar este documento.

---

## 1) ESTADO FINAL DE LA MIGRACIÓN

### 1.1 Source of Truth Canónico

**`students.id` (UUID)** es el **ÚNICO Source of Truth ontológico** para identidad de alumnos en dominio MASTER.

- **Tabla canónica:** `students` (PostgreSQL)
- **Identificador primario:** `id` (UUID, tipo `uuid`)
- **Legacy mapping:** `legacy_alumno_id` (INTEGER, FK a `alumnos.id`)
- **Estado:** `deleted_at` (TIMESTAMP, soft delete)

### 1.2 Módulos Migrados a UUID-Only

1. **Alquimia General** (`/master/templo-luz/alquimia-general`)
   - Endpoints: `/master/api/alquimia-general/*`
   - UI: `public/js/master/master-alquimia-general-client.js`
   - **Estado:** ✅ UUID-only

2. **Alquimia Alumno** (`/master/templo-luz/alquimia-alumno`)
   - Endpoints: `/master/api/alquimia-alumno/*`
   - UI: `public/js/master/master-alquimia-alumno-client.js`
   - **Estado:** ✅ UUID-only

3. **Endpoint `/master/api/students`**
   - Handler: `src/endpoints/master-api-students.js`
   - **Estado:** ✅ UUID-only

### 1.3 Resolución de Identidad

**`StudentIdentityRepo`** (`src/core/student/student-identity-repo.js`) es el repositorio canónico para resolución entre UUID y legacy.

- **Implementación:** `src/infra/repos/student-identity-repo-pg.js`
- **Métodos:**
  - `resolveLegacyId(student_uuid)` → `legacy_alumno_id | null`
  - `resolveUuid(legacy_alumno_id)` → `student_uuid | null`
- **Fail-open:** Retorna `null` si no se encuentra (no lanza error)

**REGLA:** La resolución legacy es **SOLO INTERNA** y **ENCAPSULADA** en repositorios. Nunca se expone `legacy_alumno_id` en responses de API.

---

## 2) CONTRATO DEL ENDPOINT /master/api/students

### 2.1 Identificador Primario

**`student_uuid`** (UUID string) es el único identificador primario expuesto.

**PROHIBIDO:**
- Exponer `alumnos.id` (INTEGER legacy)
- Exponer `legacy_alumno_id`
- Usar `student_id` (ambiguo, puede confundirse con INTEGER)

**OBLIGATORIO:**
- Response siempre incluye `student_uuid` (UUID canónico)

### 2.2 Contrato de Response

**Endpoint:** `GET /master/api/students?limit=200&offset=0&search=...`

**Response canónico:**
```json
{
  "ok": true,
  "data": {
    "students": [
      {
        "student_uuid": "550e8400-e29b-41d4-a716-446655440000",
        "display_name": "Nombre del Alumno",
        "email": "alumno@example.com",
        "paused": false
      }
    ],
    "total": 100,
    "limit": 200,
    "offset": 0
  },
  "trace_id": "..."
}
```

**Campos:**
- `student_uuid` (UUID string, **requerido**): Identificador canónico
- `display_name` (string, **requerido**): Nombre calculado canónicamente (helper `calculateStudentDisplayNames`)
- `email` (string | null): Email del alumno (si existe)
- `paused` (boolean, **requerido**): Estado de pausa del alumno

**Campos NO expuestos:**
- `alumnos.id`
- `legacy_alumno_id`
- `student_id` (ambiguo)
- Cualquier identificador INTEGER

### 2.3 Implementación Técnica

**Query base:**
```sql
SELECT 
  s.id as student_uuid,
  a.email,
  a.apodo,
  a.nombre_completo,
  CASE WHEN p.id IS NOT NULL THEN true ELSE false END as paused
FROM students s
LEFT JOIN alumnos a ON s.legacy_alumno_id = a.id
LEFT JOIN pausas p ON p.alumno_id = a.id AND p.fin IS NULL
WHERE s.deleted_at IS NULL
ORDER BY COALESCE(a.email, s.id::text) ASC
```

**Lógica:**
1. **SOT:** `students` (UUID) como tabla base
2. **Display name:** LEFT JOIN con `alumnos` solo para `display_name` (apodo, nombre_completo, email)
3. **Pausa:** LEFT JOIN con `pausas` para verificar estado
4. **Helper canónico:** `calculateStudentDisplayNames` para calcular `display_name` sin ambigüedad

**Observabilidad:**
- Warning log cuando se accede a `alumnos` (legacy) para `display_name`
- `trace_id` en todas las responses
- Logs estructurados con contexto completo

### 2.4 Seguridad para Selectores UI

El endpoint está **seguro para usar en selectores UI** porque:
- ✅ Devuelve solo UUIDs (sin INTEGER legacy)
- ✅ `display_name` siempre presente y canónico
- ✅ `paused` siempre presente (permite filtrar en UI si es necesario)
- ✅ Sin exposición de datos legacy

---

## 3) ESTATUTO DEL LEGACY

### 3.1 Tabla `alumnos` (Legacy)

**Estado:** **LEGACY OPERATIVO** (no SOT en runtime)

**Uso permitido:**
- ✅ LEFT JOIN con `students` **SOLO** para `display_name` (encapsulado)
- ✅ Lectura histórica en repositorios legacy explícitos
- ❌ **PROHIBIDO:** Consultar `alumnos` como SOT en runtime
- ❌ **PROHIBIDO:** Exponer `alumnos.id` en responses de API
- ❌ **PROHIBIDO:** Usar `alumnos.id` como identificador primario

**Warnings de observabilidad:**
- Log warning cuando se detecta acceso directo a `alumnos` (fuera de repositorios legacy)
- No bloquea ejecución (fail-open), solo observabilidad

### 3.2 Alumnos Legacy sin UUID

**Regla:** Alumnos que existen en `alumnos` pero **NO** tienen entrada en `students` (sin UUID) son **EXCLUIDOS del selector** por defecto.

**Lógica:**
- Query usa `FROM students` (SOT canónico)
- LEFT JOIN con `alumnos` solo si existe `legacy_alumno_id`
- Si no hay entrada en `students`, el alumno no aparece en resultados

**Observabilidad:**
- Log de warning si se detecta `alumno_id` sin `student_uuid` (no bloquea)

**Futuro:**
- Migración automática o manual de alumnos legacy a `students` cuando sea necesario
- Por ahora, solo alumnos con UUID aparecen en selectores

---

## 4) IMPACTO EN UI MASTER

### 4.1 Selectores Funcionan Solo con UUID

**Selectores actualizados:**
- ✅ Alquimia Alumno: Usa `student_uuid` en selector y llamadas API
- ✅ Alquimia General: Usa `student_uuid` en flotantes y acciones

**Formato esperado:**
```javascript
// ✅ CORRECTO: UI espera UUID
const students = result.data.students || result.data.items || [];
students.forEach(student => {
  option.value = student.student_uuid || student.id; // UUID canónico
  option.textContent = student.display_name || 'Sin nombre';
});
```

### 4.2 Deep-Links Coherentes

**Formato canónico:**
- `?student_uuid=550e8400-e29b-41d4-a716-446655440000` (UUID)
- ❌ **PROHIBIDO:** `?student_id=123` (INTEGER legacy)

**Validación:**
```javascript
// ✅ CORRECTO: Validar UUID
if (studentUuidParam.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
  selectStudent(studentUuidParam);
}
```

### 4.3 Sin Dependencia de INTEGER IDs

**PROHIBIDO en UI:**
- ❌ `parseInt(student_id, 10)` para seleccionar alumno
- ❌ Comparar `student.id` con INTEGER
- ❌ Usar `student_id` como identificador (ambiguo)

**OBLIGATORIO en UI:**
- ✅ Usar `student_uuid` (UUID string) como identificador
- ✅ Validar formato UUID antes de usar
- ✅ Usar `display_name` para mostrar (no calcular en UI)

---

## 5) CHECKLIST DE NO-REGRESIÓN

### 5.1 Endpoint `/master/api/students`

- [x] ¿El endpoint devuelve `student_uuid` (UUID) como identificador primario?
- [x] ¿El endpoint NO expone `alumnos.id` ni `legacy_alumno_id`?
- [x] ¿El endpoint devuelve `display_name` calculado canónicamente?
- [x] ¿El endpoint devuelve `paused` (boolean) para cada estudiante?
- [x] ¿El endpoint usa `students` (UUID) como SOT?
- [x] ¿El endpoint tiene `trace_id` en responses?
- [x] ¿El endpoint loguea warnings cuando accede a `alumnos` (legacy)?

### 5.2 UI MASTER

- [x] ¿La UI NO usa `student_id` (ambiguo, puede confundirse con INTEGER)?
- [x] ¿La UI usa `student_uuid` (UUID string) en selectores?
- [x] ¿La UI usa `display_name` del endpoint (no calcula en cliente)?
- [x] ¿La UI valida formato UUID antes de usar?
- [x] ¿Los deep-links usan `?student_uuid=` (no `?student_id=`)?

### 5.3 Observabilidad

- [x] ¿Hay `trace_id` en todas las responses?
- [x] ¿Hay warnings cuando se accede a `alumnos` (legacy)?
- [x] ¿Los logs son estructurados con contexto completo?

---

## 6) CIERRE CANÓNICO

### 6.1 Declaración de Cierre

**Migración de identidad de alumnos en dominio MASTER: COMPLETADA**

Fecha de cierre: 2026-01-13  
Versión: v5.68.2  
Commit: 4967588

**Alcance completado:**
- ✅ Alquimia General: UUID-only
- ✅ Alquimia Alumno: UUID-only
- ✅ Endpoint `/master/api/students`: UUID-only

**SOT canónico:**
- `students.id` (UUID) es el único identificador ontológico
- `alumnos.id` (INTEGER) es legacy (solo para display_name encapsulado)

### 6.2 Regla para Nuevos Módulos

**CUALQUIER NUEVO MÓDULO EN DOMINIO MASTER DEBE:**
- ✅ Asumir UUID-first (usar `student_uuid` como identificador primario)
- ✅ Usar `StudentIdentityRepo` si necesita resolver legacy (solo interno)
- ✅ NO exponer `legacy_alumno_id` en responses
- ✅ NO usar `alumnos.id` como SOT
- ✅ Usar `display_name` del endpoint (no calcular en cliente)

**PROHIBIDO:**
- ❌ Nuevos usos de `student_id` (ambiguo)
- ❌ Nuevos usos de `alumnos.id` como identificador primario
- ❌ Exponer `legacy_alumno_id` en responses
- ❌ Calcular `display_name` en cliente (usar endpoint)

### 6.3 Referencia Obligatoria

**Este documento es referencia obligatoria** para:
- Implementar nuevos módulos relacionados con alumnos
- Mantener coherencia con el diseño canónico
- Verificar que no se introduce regresión
- Entender el estado actual de la identidad de alumnos

**OBLIGATORIO:** Cualquier cambio relacionado con identidad de alumnos debe respetar este documento y actualizarlo si es necesario.

---

## REFERENCIAS

- **Commit v5.68.1:** `5bca549` - "feat(alquimia): migración Alquimia Alumno a student_uuid"
- **Commit v5.68.2:** `4967588` - "feat(students): endpoint /master/api/students UUID-first"
- **Documentación Alquimia:** `docs/ALQUIMIA_CANONICA_V1.md`
- **Contrato Identidad:** `docs/STUDENT_IDENTITY_CONTRACT_V1.md`
- **Helper Display Name:** `src/core/helpers/student-display-name-helper.js`
- **Repositorio Identidad:** `src/infra/repos/student-identity-repo-pg.js`