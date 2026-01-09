# CONTRATO LIMPIEZA v1
**AuriPortal / Aurelín — Dominio MASTER**  
**Versión:** 1.0.0  
**Fecha:** 2026-01-09  
**Estado:** CANÓNICO

---

## PROPÓSITO

Contrato canónico para la operación de limpieza de items de transmutaciones energéticas.

Este contrato garantiza:
- Payload explícito (sin inferencias)
- Consistencia entre rutas
- Validación estricta en backend
- Frontend responsable de enviar todos los campos requeridos

---

## INTERFAZ DEL CONTRATO

### Request Payload

```typescript
interface CleanItemPayload {
  // REQUERIDOS
  student_id: number;
  item_ref: string;
  item_kind: 'recurrente' | 'una_vez'; // REQUERIDO (no inferir)
  actor_type: 'master' | 'student' | 'automation'; // REQUERIDO (no forzar)
  surface_key: string; // REQUERIDO (no forzar)
  
  // OPCIONALES con defaults
  domain_type?: 'transmutation' (default: 'transmutation');
  product_key?: string (default: 'pde');
  clean_layer?: 'shared' | 'pde' (default: 'shared');
  actor_ref?: string | null (default: null);
  level_cap_override?: number | null (default: null);
  meta?: object (default: {});
}
```

---

## RUTAS CANÓNICAS

### Ruta 1: Alquimia Alumno

**Endpoint:** `POST /master/api/alquimia-alumno/clean`

**Frontend:**
- Handler: `handleCleanItem(item)` en `master-alquimia-alumno-client.js`
- Debe enviar: `item_kind: item.lista_tipo`, `actor_type: 'master'`, `surface_key: 'master.alquimia_alumno'`

**Backend:**
- Endpoint: `master-api-alquimia-alumno.js`
- Servicio: `markCleanStudent(options)`

---

### Ruta 2: Alquimia General (Flotante)

**Endpoint:** `POST /master/api/alquimia-general/items/:item_ref/master/mark-clean-student`

**Frontend:**
- Handler: `handleLimpiarEstudiante(student, item, cleanLayer, tipo)` en `master-alquimia-general-client.js`
- Debe enviar: `item_kind: tipo`, `actor_type: 'master'`, `surface_key: 'master.alquimia_general'`

**Backend:**
- Endpoint: `master-api-alquimia-general.js`
- Servicio: `markCleanStudent(options)`

---

## VALIDACIONES

### Backend (`markCleanStudent`)

**Campos requeridos:**
- `student_id`: Debe ser número válido > 0
- `item_ref`: Debe ser string no vacío
- `item_kind`: Debe ser 'recurrente' o 'una_vez'
- `actor_type`: Debe ser 'master', 'student' o 'automation'
- `surface_key`: Debe ser string no vacío

**Validación de coherencia:**
- Si `item_kind` no coincide con `lista.tipo`, se logea warning pero se usa el proporcionado (fail-open)

**Errores:**
- `400 BAD_REQUEST`: Si falta cualquier campo requerido
- Mensaje de error específico para cada campo faltante

---

## REGLAS CONSTITUCIONALES

1. **Payload explícito**: Todos los campos críticos deben venir del frontend
2. **Sin inferencias**: NO consultar BD para determinar `item_kind`
3. **Sin forzado en endpoints**: Endpoints NO deben forzar campos que deben venir del frontend
4. **Consistencia entre rutas**: Mismo contrato para todas las rutas de limpieza
5. **Frontend tiene responsabilidad**: Frontend debe conocer `item_kind` y enviarlo

---

## PROHIBICIONES

**Está PROHIBIDO:**
- Inferir `item_kind` desde `lista.tipo` en backend
- Forzar `actor_type` o `surface_key` en endpoints
- Usar defaults para campos requeridos sin validar
- Consultar BD para determinar campos que deberían venir del frontend

---

## IMPLEMENTACIÓN

### Backend

**Ubicación:** `src/core/master/services/cleaning-engine-service.js`

**Validación:**
```javascript
if (!student_id || !item_ref || !actor_type || !options.item_kind || !options.surface_key) {
  throw new Error(`Campos requeridos faltantes: ${missing.join(', ')}`);
}

if (!options.item_kind || (options.item_kind !== 'recurrente' && options.item_kind !== 'una_vez')) {
  throw new Error('item_kind es requerido y debe ser "recurrente" o "una_vez"');
}
```

### Frontend Alquimia Alumno

**Ubicación:** `public/js/master/master-alquimia-alumno-client.js`

**Payload:**
```javascript
const body = {
  student_id: state.selectedStudentId,
  item_ref: item.item_ref,
  item_kind: item.lista_tipo || 'recurrente', // REQUERIDO
  actor_type: 'master', // REQUERIDO
  surface_key: 'master.alquimia_alumno', // REQUERIDO
  clean_layer: 'shared', // REQUERIDO
  domain_type: 'transmutation',
  product_key: 'pde'
};
```

### Frontend Alquimia General

**Ubicación:** `public/js/master/master-alquimia-general-client.js`

**Payload:**
```javascript
const payload = {
  student_id: student.student_id,
  item_ref: item.item_ref,
  item_kind: tipo, // REQUERIDO
  domain_type: 'transmutation',
  clean_layer: cleanLayer,
  actor_type: 'master', // REQUERIDO
  surface_key: 'master.alquimia_general' // REQUERIDO
};
```

---

## TESTS

**Script:** `scripts/test-contrato-limpieza-v1.js`

**Comando:** `npm run test:contrato-limpieza`

**Verifica:**
1. Backend valida `item_kind` como requerido
2. Backend NO tiene fallback `lista.tipo`
3. Frontend Alquimia Alumno envía `item_kind`
4. Endpoints validan campos requeridos
5. Endpoints NO fuerzan campos
6. Consistencia entre rutas

---

## REFERENCIAS

- **Diagnóstico:** `docs/DIAGNOSTICO_CONTRATO_LIMPIEZA_V1.md`
- **Constitución UNA_VEZ:** `docs/CONSTITUTION_ALQUIMIA_UNA_VEZ_V1.md`
- **Alquimia Alumno Contracts:** `docs/MASTER_ALQUIMIA_ALUMNO_CONTRACTS_V2.md`

---

**ESTATUTO APROBADO: 2026-01-09**
