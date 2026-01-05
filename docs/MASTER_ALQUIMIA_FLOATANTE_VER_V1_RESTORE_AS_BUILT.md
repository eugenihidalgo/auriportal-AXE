# MASTER Alquimia Flotante VER v1 - As-Built (Restauración + Fix Payload)

**Versión:** v1.0.0 (Restauración) + v1.0.1 (Fix Payload)  
**Fecha:** 2025-01-05  
**Estado:** ✅ OPERATIVO

---

## 📋 Resumen Ejecutivo

Este documento describe la implementación as-built del flotante VER en Alquimia General MASTER, incluyendo la restauración inicial (v1.0.0) y el fix crítico del payload students undefined (v1.0.1).

---

## 🔧 Fix Payload Students Undefined (v1.0.1)

### Problema Identificado

**Síntoma:** Crash en flotante VER al hacer click en botón "VER" de un item:
```
TypeError: Cannot read properties of undefined (reading 'students')
showFlotanteVer() en public/js/master/master-alquimia-general-client.js
```

**Causa raíz:**
1. El endpoint `GET /master/api/alquimia-general/items/:item_ref/students` devolvía shape inconsistente:
   - A veces: `{ ok: true, item_ref: "...", students: [...] }` (sin wrapper `data`)
   - A veces: `{ ok: false, error: "..." }` (sin `data`)
   - El cliente asumía `result.data.students` y crashaba

2. El endpoint no tenía fail-open: errores internos devolvían 500 en lugar de shape vacío

3. El cliente no tenía normalizador para manejar diferentes shapes posibles

### Solución Implementada

#### A) Backend - Shape Estable + Fail-Open

**Endpoint:** `GET /master/api/alquimia-general/items/:item_ref/students`

**Shape final garantizado:**
```json
{
  "ok": true,
  "data": {
    "item_ref": "te_item_123",
    "tipo": "recurrente|una_vez",
    "students": [],
    "counts": {
      "reviewed": 0,
      "pending": 0,
      "important": 0,
      "never": 0
    },
    "total": 0,
    "threshold_days": 7,
    "critical_multiplier": 2.0
  },
  "warnings": [],
  "trace_id": "req_..."
}
```

**Política fail-open:**
- ✅ Item no encontrado → `ok:true` con `students=[]` + `warnings=["Item no encontrado: ..."]`
- ✅ Lista no encontrada → `ok:true` con `students=[]` + `warnings=["Lista no encontrada: ..."]`
- ✅ Error en servicio → `ok:true` con `students=[]` + `warnings=["Error al cargar estudiantes: ..."]`
- ✅ Error crítico no capturado → `ok:true` con `students=[]` + `warnings=["Error crítico: ..."]`

**Regla absoluta:** Este endpoint NUNCA devuelve 500. Siempre `ok:true` con shape estable.

**Ubicación:** `src/endpoints/master-api-alquimia-general.js` (líneas ~650-750)

#### B) Frontend - Normalizador + Error Visible

**Función normalizadora:**
```javascript
function normalizeStudentsPayload(json) {
  const traceId = json?.trace_id || json?.data?.trace_id || null;
  const base = json?.data ?? json ?? {};
  const data = base?.data ?? base;
  const students = Array.isArray(data?.students) ? data.students : [];
  const counts = data?.counts || { reviewed: 0, pending: 0, important: 0, never: 0 };
  const total = Number.isFinite(data?.total) ? data.total : students.length;
  const warnings = json?.warnings || data?.warnings || [];
  const ok = json?.ok === true;
  
  return { 
    ok, traceId, students, counts, total, warnings, raw: json,
    item_ref: data?.item_ref || json?.item_ref || null,
    tipo: data?.tipo || json?.tipo || null,
    threshold_days: data?.threshold_days || null,
    critical_multiplier: data?.critical_multiplier || 2.0
  };
}
```

**Comportamiento ante errores:**
1. **ok:false** → Log warning en consola + mostrar warning amarillo en flotante (no crash)
2. **students undefined/null** → Normalizador convierte a `[]` (no crash)
3. **Content-type no-JSON** → Detección + error visible en UI (sin innerHTML)
4. **Item sin item_ref** → Error visible en UI (no crash silencioso)

**Log forense:**
```javascript
console.log('[MasterAlquimiaGeneral] flotante payload', { 
  itemRef: item.item_ref, 
  keys: Object.keys(result || {}), 
  traceId: result?.trace_id,
  hasData: !!result?.data,
  hasStudents: !!result?.data?.students
});
```

**Ubicación:** `public/js/master/master-alquimia-general-client.js` (función `normalizeStudentsPayload` y `handleVerItem`)

---

## ✅ Checklist de Verificación

### Backend
- [x] Endpoint devuelve shape estable con `data` wrapper siempre
- [x] Fail-open implementado (nunca 500)
- [x] Warnings incluidos cuando hay problemas
- [x] `never` siempre presente en `counts`
- [x] Logging estructurado con `trace_id`

### Frontend
- [x] Normalizador maneja diferentes shapes posibles
- [x] Warnings visibles en flotante (amarillo)
- [x] Error visible si item sin `item_ref`
- [x] Detección de content-type no-JSON
- [x] Log forense al abrir flotante
- [x] No crash si `students` undefined/null

### Pruebas Manuales
- [x] Click VER en item → Modal abre (aunque `students=[]`)
- [x] Item no encontrado → Warning amarillo visible, no crash
- [x] Error de red → Error visible en UI, no crash
- [x] Respuesta no-JSON → Error visible, no crash
- [x] Item sin `item_ref` → Error visible, no crash

---

## 📚 Referencias

- **Endpoint:** `src/endpoints/master-api-alquimia-general.js`
- **Cliente:** `public/js/master/master-alquimia-general-client.js`
- **Servicio:** `src/services/alquimia-general-service.js`
- **Doc original:** `docs/ALQUIMIA_FLOTANTE_VER_V1.md`

---

## 🔄 Historial de Versiones

- **v1.0.0** (2025-01-05): Restauración inicial del flotante VER
- **v1.0.1** (2025-01-05): Fix payload students undefined + fail-open

---

**Última actualización:** 2025-01-05  
**Mantenido por:** Sistema MASTER v1
