# CONTRATO DE IDENTIDAD DE ESTUDIANTE v1

**Versión**: 1.0  
**Fecha**: 2026-01-11  
**Estado**: CANÓNICO

---

## STUDENTREF UUID

UUID es la identidad canónica de estudiantes en runtime.

**Contrato**:
- Servicios nuevos aceptan UUID como entrada principal
- Legacy INTEGER (`alumno_id`) solo en borde (si existe)
- Prohibido: nuevos usos de `alumno_id` en servicios nuevos

---

## LEGACY RESOLUTION

Si un servicio necesita resolver legacy INTEGER a UUID:

**Regla**: Solo en borde (entry point), no en servicios internos.

**Ejemplo**:
```javascript
// ✅ CORRECTO: Resolución en borde
export default async function handler(req) {
  const { student_id } = req.params; // Puede ser UUID o legacy integer
  
  // Resolver legacy si es necesario
  let studentUuid = student_id;
  if (!isUUID(student_id)) {
    const student = await query(
      'SELECT id FROM students WHERE legacy_alumno_id = $1',
      [student_id]
    );
    if (!student.rows[0]) {
      return sendJsonError({ message: 'Student not found', code: 'NOT_FOUND' }, 404);
    }
    studentUuid = student.rows[0].id;
  }
  
  // Llamar servicio con UUID
  return await serviceMethod(studentUuid, ...);
}

// ❌ INCORRECTO: Resolución en servicio interno
export async function serviceMethod(studentId) {
  // NO hacer esto aquí
  if (!isUUID(studentId)) {
    // ... resolver legacy
  }
}
```

---

## PROHIBICIONES EXPLÍCITAS

### ❌ PROHIBIDO

1. **Nuevos servicios con `alumno_id` en parámetros**
   ```javascript
   // ❌ INCORRECTO
   export async function activatePlace(alumno_id, placeId) {
     // ...
   }
   ```

2. **Uso directo de `alumno_id` sin documentar legacy**
   ```javascript
   // ❌ INCORRECTO (sin documentar)
   const result = await query('SELECT * FROM ... WHERE alumno_id = $1', [id]);
   ```

3. **Asumir que `student_id` es siempre INTEGER**
   ```javascript
   // ❌ INCORRECTO
   const studentId = parseInt(studentId); // Asume INTEGER
   ```

### ✅ PERMITIDO

1. **UUID como entrada principal**
   ```javascript
   // ✅ CORRECTO
   export async function activatePlace(studentUuid, placeId) {
     // studentUuid es UUID
   }
   ```

2. **Legacy resolution en borde documentado**
   ```javascript
   // ✅ CORRECTO (con documentación)
   // LEGACY RESOLUTION: Resolver alumno_id a UUID solo en borde
   const studentUuid = await resolveStudentId(studentId);
   ```

3. **Queries con `legacy_alumno_id` explícito**
   ```javascript
   // ✅ CORRECTO
   const result = await query(
     'SELECT id FROM students WHERE legacy_alumno_id = $1',
     [legacyId]
   );
   ```

---

## VERIFICACIÓN

**Check**:
```bash
npm run check:student-identity
```

**Qué verifica**:
- Servicios críticos no usan `alumno_id` en parámetros exportados
- Uso de `alumno_id` en SQL está documentado como legacy resolution

**Warnings**:
- Servicios que usan `alumno_id` directamente (migrar a UUID)
- Queries SQL con `alumno_id` sin mención de legacy

---

## PREPARACIÓN UUID-ONLY

**Capa 1 (Actual)**:
- Preparación para UUID-only
- Legacy resolution permitido en borde
- Warnings en servicios que usan `alumno_id`

**Sprint 2 (Futuro)**:
- UUID-only obligatorio en runtime
- Eliminación de legacy resolution
- Fail-hard en servicios que usan `alumno_id`

---

## EJEMPLOS REALES

### Cleaning Engine
```javascript
// ✅ CORRECTO: Acepta UUID
export async function markCleanStudent(studentId, itemRef, options) {
  // studentId es UUID (o legacy resuelto en borde)
  // ...
}
```

### Place Service
```javascript
// ✅ CORRECTO: Acepta UUID
export async function activatePlace(studentId, placeId, actor, options) {
  // studentId es UUID
  // ...
}
```

---

## REFERENCIAS

- `src/core/student/repos/students-repo.js`: Repositorio canónico
- `src/infra/repos/students-repo-pg.js`: Implementación PostgreSQL
- `docs/CONSTITUTION_PLATFORM_LAYER1.md`: Capa 1 completa

---

**ESTADO**: ✅ CONTRATO CERRADO (2026-01-11)
