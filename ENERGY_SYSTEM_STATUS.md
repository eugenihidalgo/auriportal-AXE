# Estado del Sistema Energético - AuriPortal

**Fecha de actualización:** 2024-12-19  
**Versión:** v5.0.3  
**Estado:** ✅ OPERATIVO PARA USO REAL

---

## 📋 Resumen Ejecutivo

El sistema energético está **cerrado y operativo** para uso real. Todos los eventos se registran en `energy_events` (fuente de verdad) y se proyectan automáticamente a `energy_subject_state` (read model).

---

## ✅ Qué Está Operativo HOY

### 1. **Sistema de Eventos (Event Sourcing)**
- ✅ Tabla `energy_events` como núcleo canónico
- ✅ Inserción idempotente por `request_id`
- ✅ Proyecciones automáticas a `energy_subject_state`
- ✅ Fail-open controlado (no rompe operaciones legacy)

### 2. **Tipos de Eventos Soportados**

#### **Cleaning (Limpieza)**
- ✅ Evento tipo: `'cleaning'`
- ✅ Actualiza `is_clean = true` en proyecciones
- ✅ Actualiza `clean_last_at` en proyecciones
- ✅ NO resetea `illumination_count` (BLOQUE 2)
- ✅ Permite idempotencia (múltiples limpiezas = OK)

#### **Illumination (Iluminación)**
- ✅ Evento tipo: `'illumination'` o `'illumination_*'`
- ✅ Incrementa `illumination_count` en proyecciones
- ✅ Actualiza `illumination_last_at` en proyecciones
- ✅ Permite iluminación sin limpieza previa (BLOQUE 2)
- ✅ Soporta `illumination_amount` (default: 1)

### 3. **Endpoints Admin Operativos**

#### **POST /admin/api/energy/clean**
Inserta evento de limpieza.

**Body:**
```json
{
  "subject_type": "aspecto" | "transmutacion_item" | "lugar" | "proyecto" | "apadrinado",
  "subject_id": "string",
  "alumno_id": number (opcional),
  "notes": "string" (opcional)
}
```

**Respuesta:**
```json
{
  "success": true,
  "event_id": 123,
  "duplicate": false,
  "was_clean_before": false,
  "is_clean_after": true,
  "request_id": "uuid"
}
```

**Validaciones:**
- ✅ `subject_type` requerido (string)
- ✅ `subject_id` requerido (string)
- ✅ Si `requires_clean_state=true` y ya está limpio → permite (idempotente)
- ✅ Genera `request_id` automáticamente
- ✅ Registra en `audit_events` si `actor=admin`

#### **POST /admin/api/energy/illuminate**
Inserta evento de iluminación.

**Body:**
```json
{
  "subject_type": "aspecto" | "transmutacion_item" | "lugar" | "proyecto" | "apadrinado",
  "subject_id": "string",
  "alumno_id": number (opcional),
  "amount": number (default: 1),
  "notes": "string" (opcional)
}
```

**Respuesta:**
```json
{
  "success": true,
  "event_id": 123,
  "duplicate": false,
  "illumination_amount": 1,
  "request_id": "uuid"
}
```

**Validaciones:**
- ✅ `subject_type` requerido (string)
- ✅ `subject_id` requerido (string)
- ✅ `amount` debe ser número positivo (default: 1)
- ✅ Siempre permitido (no requiere limpieza previa)
- ✅ Genera `request_id` automáticamente
- ✅ Registra en `audit_events` si `actor=admin`

### 4. **Proyecciones Automáticas**

#### **BLOQUE 1: Eventos → Proyecciones (OBLIGATORIO)**
- ✅ `insertEnergyEvent()` llama automáticamente a `applyEventToProjections()` después de insertar
- ✅ Si falla la proyección: log error crítico, NO rompe la inserción del evento
- ✅ Idempotencia también en proyección (no doble suma)

#### **Tabla: `energy_subject_state`**
Read model calculado desde `energy_events`:

| Campo | Descripción | Actualizado por |
|-------|-------------|-----------------|
| `subject_type` | Tipo de sujeto | - |
| `subject_id` | ID del sujeto | - |
| `alumno_id` | ID del alumno (nullable) | - |
| `is_clean` | Estado de limpieza | Eventos `cleaning` con `is_clean_after=true` |
| `clean_last_at` | Última limpieza | Eventos `cleaning` |
| `illumination_count` | Contador de iluminaciones | Eventos `illumination` o `illumination_*` |
| `illumination_last_at` | Última iluminación | Eventos `illumination` o `illumination_*` |
| `last_event_at` | Último evento | Cualquier evento |
| `last_event_id` | ID del último evento | Cualquier evento |

---

## 🔄 Flujo de Datos

```
1. Endpoint Admin → insertEnergyEvent()
   ↓
2. Insertar en energy_events (idempotente)
   ↓
3. applyEventToProjections() automáticamente
   ↓
4. Actualizar energy_subject_state (read model)
   ↓
5. Registrar en audit_events (si actor=admin)
```

---

## 📊 Qué Se Calcula Desde Eventos

### **Estado de Limpieza**
- Se calcula desde eventos `cleaning` con `is_clean_after=true`
- Se almacena en `energy_subject_state.is_clean`
- Última fecha en `energy_subject_state.clean_last_at`

### **Contador de Iluminaciones**
- Se calcula desde eventos `illumination` o `illumination_*`
- Se incrementa `energy_subject_state.illumination_count`
- Última fecha en `energy_subject_state.illumination_last_at`
- Soporta `illumination_amount` (default: 1)

### **Historial Completo**
- Todos los eventos en `energy_events` (fuente de verdad)
- Consultas históricas: `SELECT * FROM energy_events WHERE ...`

---

## ⚠️ Qué Sigue Siendo Legacy

### **Tablas Legacy (NO TOCAR)**
- `aspectos_energeticos_alumnos` - Legacy, no modificar
- `items_transmutaciones_alumnos` - Legacy, no modificar
- Otras tablas legacy - No modificar

### **Operaciones Legacy**
- Limpiezas desde portal alumno (siguen funcionando)
- Limpiezas desde admin panel master (siguen funcionando)
- Todas emiten eventos a `energy_events` como side-effect

---

## 🔐 Seguridad y Validaciones

### **Idempotencia**
- ✅ Por `request_id + event_type + subject_type + subject_id + alumno_id`
- ✅ Evita duplicados en reintentos
- ✅ Solo aplica si `request_id IS NOT NULL`

### **Validaciones de Cleaning**
- ✅ Si `requires_clean_state=true` y ya está limpio → permite (idempotente)
- ✅ Siempre setea `is_clean=true` después del evento
- ✅ NO resetea `illumination_count`

### **Validaciones de Illumination**
- ✅ Siempre permitido (no requiere limpieza previa)
- ✅ `requires_clean_state = false` permitido
- ✅ `amount` debe ser número positivo (default: 1)

### **Audit Trail**
- ✅ Todos los eventos admin se registran en `audit_events`
- ✅ Incluye `request_id`, `event_id`, `subject_type`, `subject_id`, `alumno_id`

---

## 🚀 Uso de los Endpoints

### **Ejemplo: Limpiar un Aspecto**
```bash
curl -X POST https://admin.pdeeugenihidalgo.org/admin/api/energy/clean \
  -H "Content-Type: application/json" \
  -H "X-Admin-Password: tu_password" \
  -d '{
    "subject_type": "aspecto",
    "subject_id": "123",
    "alumno_id": 456,
    "notes": "Limpieza manual desde admin"
  }'
```

### **Ejemplo: Iluminar un Item**
```bash
curl -X POST https://admin.pdeeugenihidalgo.org/admin/api/energy/illuminate \
  -H "Content-Type: application/json" \
  -H "X-Admin-Password: tu_password" \
  -d '{
    "subject_type": "transmutacion_item",
    "subject_id": "789",
    "alumno_id": 456,
    "amount": 2,
    "notes": "Doble iluminación"
  }'
```

---

## 📝 Notas Técnicas

### **Fail-Open Controlado**
- Si falla el insert del evento → NO rompe la operación, solo loguea
- Si falla la proyección → NO rompe la inserción del evento, solo loguea
- Errores se registran en logs y `audit_events` (si está disponible)

### **Performance**
- Proyecciones se actualizan incrementalmente (no recalcula todo)
- Idempotencia evita duplicados en reintentos
- Eventos se insertan en paralelo (no bloquean respuesta)

### **Migraciones**
- `v5.0.0`: Creación de `energy_events`
- `v5.0.1`: Constraint de idempotencia
- `v5.0.2`: Creación de `energy_subject_state` (proyecciones)
- `v5.0.3`: Integración automática eventos → proyecciones

---

## 🎯 Próximos Pasos (Opcional)

- [ ] Dashboard de eventos energéticos
- [ ] Consultas agregadas por alumno/subject
- [ ] Webhooks para notificaciones
- [ ] Exportación de eventos históricos

---

**Sistema cerrado y operativo para uso real.** ✅







