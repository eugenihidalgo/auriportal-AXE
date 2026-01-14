# ALQUIMIA FLOTANTE VER v1 - Sistema Canónico de Visualización de Alumnos

**Versión:** v1.1  
**Fecha:** 2025-01-XX (v1.0), 2026-01-13 (v1.1 - persistencia tamaño)  
**Estado:** ✅ Implementado

---

## 1. DEFINICIÓN

El flotante "VER" es el sistema canónico para visualizar el estado de todos los alumnos respecto a un ítem específico de Alquimia General. Permite al Master ver la distribución de alumnos por estado y realizar limpiezas individuales.

---

## 2. COMPORTAMIENTO CANÓNICO

### 2.1. Botón "VER"

- **Ubicación:** Cada fila de ítem en la tabla de Alquimia General
- **Acción:** Abre un flotante/modal que muestra TODOS los alumnos
- **NO navega:** El flotante se abre sobre la página actual

### 2.2. Botón "LIMPIAR" (Verde)

- **Ubicación:** Cada fila de ítem recurrente
- **Acción:** Limpieza GLOBAL para TODOS los alumnos
- **Comportamiento:**
  - Registra ejecución para cada alumno
  - Marca como REVISADO
  - Reinicia contador desde fecha actual
  - Emite señales `origin.executed` y `origin.completed`
  - Queda auditado (quién / cuándo)
  - Es idempotente
  - NO pisa ejecuciones posteriores del alumno

---

## 3. COLUMNAS DEL FLOTANTE (REGLA DURA)

El flotante agrupa alumnos en tres columnas según su estado:

### 🟢 REVISADO
- **Condición:** Última ejecución < `threshold_days`
- **Fondo:** Suave verde (`bg-green-900 bg-opacity-30`)
- **Botón:** NO muestra botón (ya está limpio)

### 🟡 PENDIENTE
- **Condición:** 
  - Última ejecución ≥ `threshold_days`
  - Y < `threshold_days * critical_multiplier`
- **Fondo:** Amarillo (`bg-yellow-900 bg-opacity-30`)
- **Botón:** Muestra botón "✓" para limpieza individual

### 🔴 IMPORTANTE REVISAR
- **Condición:** Última ejecución ≥ `threshold_days * critical_multiplier`
- **Fondo:** Rojo (`bg-red-900 bg-opacity-30`)
- **Botón:** Muestra botón "✓" para limpieza individual

**⚠️ Si un alumno nunca lo ha trabajado**, aparece directamente como **PENDIENTE**.

---

## 4. BOTÓN INDIVIDUAL POR ALUMNO

En cada fila de alumno dentro del flotante (excepto REVISADO):
- **Botón:** "✓" (pequeño, verde)
- **Acción al pulsar:**
  - Registra limpieza SOLO para ese alumno
  - Se mueve inmediatamente a **REVISADO**
  - Emite señales `origin.executed` y `origin.completed`
  - Queda auditado
  - Recarga el flotante automáticamente

**Permite trabajar:**
- Master (limpieza global o individual)
- Alumno (auto-limpieza)
- Sin solaparse (siempre cuenta la fecha más reciente)

---

## 5. TIPOS DE LISTAS

### 6.1. Recurrentes
- **Usa:** `threshold_days` y `critical_multiplier`
- **Lógica temporal:** Descrita arriba
- **Campo "Días":** Corresponde a `frecuencia_dias` del ítem → `threshold_days`

### 6.2. Una sola vez (one_time_count)
- **Usa:** `required_count`
- **Comportamiento:** El alumno pasa a "COMPLETADO" cuando alcanza el total
- **NO vuelve a aparecer** como pendiente una vez completado
- **Campo "Días":** Contexto informativo (no usado para cálculo)

### 6.3. NUNCA (categoría colapsable)
- **Existe como categoría visible**
- **Colapsable por defecto**
- **Indica:** Ítems sin obligación activa
- **NO se incluyen** en cálculos automáticos
- **SÍ se pueden limpiar** manualmente
- **⚠️ DEBE existir** aunque esté vacía

---

## 6. CORRELACIÓN DE DÍAS (REGLA CRÍTICA)

- **El valor "Días" visible en la UI:**
  - ES la fuente para `threshold_days`
  - Corresponde a `frecuencia_dias` del ítem
- **En listas de una sola vez:**
  - El mismo campo se interpreta como contexto informativo
- **NO duplicar valores**
- **NO hardcodear**

---

## 7. NOMBRES DE ALUMNOS (NO AMBIGÜEDAD)

**Problema real:** Dos alumnos pueden llamarse igual (ej: "Judit")

**Solución CANÓNICA:**

Para cada alumno mostrar `display_name` calculado con esta prioridad:

1. **Si existe `apodo_master`** → usarlo
2. **Si no:**
   - Si el nombre es único → nombre (`apodo` o `nombre_completo`)
   - Si hay duplicados → nombre completo (`nombre_completo`)

**Helper canónico:** `src/core/helpers/student-display-name-helper.js`

- `calculateStudentDisplayName(student, allStudents)` - Para un alumno
- `calculateStudentDisplayNames(students)` - Para batch (optimizado)

**Reglas:**
- Es de presentación (NO modifica datos base)
- Debe estar centralizado (helper reutilizable)
- Nunca mostrar dos alumnos con el mismo texto visible

---

## 8. ARQUITECTURA

### 8.1. Source of Truth
- **PostgreSQL es soberano**
- No usar memoria temporal como verdad

### 8.2. Origen de la lógica
- Usar **Origin Contract v1**
- Cada ítem se resuelve como Origin
- Bridge automático a UTE si aplica

### 8.3. Estados
- **NO guardar estado calculado**
- **Estado = función de:**
  - Últimas ejecuciones (`last_cleaned_at`)
  - `execution.mode`
  - Fechas
  - Contadores
  - `threshold_days` y `critical_multiplier` del ítem

### 8.4. Señales
- **Al ejecutar limpieza (global o individual):**
  - `origin.executed` - Se ejecutó la limpieza
  - `origin.completed` - Se completó la limpieza (marcado como revisado)
- **Emitidas vía:** `src/services/pde-signal-emitter.js`
- **Fail-open:** Si las señales fallan, la limpieza NO falla

---

## 9. ENDPOINTS API

### 9.1. GET `/master/api/alquimia-general/items/:item_ref/students`
- **Retorna:** Lista de alumnos con estados calculados
- **Parámetros:**
  - `product_key` (default: 'pde')
  - `limit`, `offset` (opcionales)
- **Respuesta:**
  ```json
  {
    "ok": true,
    "data": {
      "item_ref": "...",
      "tipo": "recurrente",
      "students": [
        {
          "student_id": 123,
          "display_name": "Judit García",
          "student_email": "...",
          "state": "reviewed|pending|important",
          "days_since_last_clean": 5,
          "threshold_days": 7,
          "critical_multiplier": 2.0
        }
      ],
      "counts": {
        "reviewed": 10,
        "pending": 5,
        "important": 2
      },
      "total": 17
    }
  }
  ```

### 9.2. POST `/master/api/alquimia-general/items/:item_ref/master/mark-clean-all`
- **Acción:** Limpieza global (todos los alumnos)
- **Retorna:** `{ updated: number }`
- **Emite señales:** `origin.executed`, `origin.completed`

### 9.3. POST `/master/api/alquimia-general/items/:item_ref/master/mark-clean-student`
- **Acción:** Limpieza individual (un alumno)
- **Body:** `{ student_id: number }`
- **Retorna:** Estado actualizado del alumno
- **Emite señales:** `origin.executed`, `origin.completed`

---

## 10. UI / UX

### 10.1. Flotante
- **Scroll independiente:** `max-h-[80vh] overflow-y-auto`
- **Columnas claras:** Agrupadas por estado
- **Reacción inmediata:** Al hacer click, se actualiza y recarga
- **Cerrar:** ESC, click fuera, o botón ❌

### 10.2. Colores
- **REVISADO:** Verde suave (`bg-green-900 bg-opacity-30`)
- **PENDIENTE:** Amarillo (`bg-yellow-900 bg-opacity-30`)
- **IMPORTANTE REVISAR:** Rojo (`bg-red-900 bg-opacity-30`)

### 10.3. DOM API
- **Prohibido:** `innerHTML` dinámico
- **Obligatorio:** DOM API explícita (`createElement`, `appendChild`, etc.)

---

## 11. COMPATIBILIDAD TOTAL

Debe funcionar:
- ✅ Con listas existentes
- ✅ Con listas futuras
- ✅ Sin migraciones destructivas
- ✅ Sin añadir botones nuevos (reutiliza botones existentes)

---

## 12. ARCHIVOS IMPLEMENTADOS

### Backend
- `src/core/helpers/student-display-name-helper.js` - Helper de nombres
- `src/services/alquimia-general-service.js` - Servicio con cálculo de estados y señales
- `src/infra/repos/master-student-transmutation-read-repo-pg.js` - Repo con `apodo_master`

### Frontend
- `public/js/master/master-alquimia-general-client.js` - Cliente JS con flotante completo

### API
- `src/endpoints/master-api-alquimia-general.js` - Endpoints actualizados

---

## 13. VERIFICACIÓN

### Checks obligatorios
- ✅ `npm run check:master-api`
- ✅ Assembly checks
- ✅ Sin errores de linting

### Pruebas manuales
1. Abrir `/master/templo-luz/alquimia-general`
2. Seleccionar lista recurrente
3. Pulsar "VER" en un ítem
4. Verificar columnas: REVISADO, PENDIENTE, IMPORTANTE REVISAR
5. Pulsar "✓" en un alumno pendiente
6. Verificar que se mueve a REVISADO
7. Pulsar "LIMPIAR" en un ítem
8. Verificar que todos los alumnos se marcan como limpios

---

## 14. NOTAS

- **Sin UI todavía:** El flotante está implementado, pero puede mejorarse visualmente
- **Extensible:** El sistema permite agregar más estados sin romper compatibilidad
- **Auditable:** Todas las operaciones quedan registradas
- **Reversible:** Soft delete permite reversión

---

**Estado:** ✅ Implementado y funcional
