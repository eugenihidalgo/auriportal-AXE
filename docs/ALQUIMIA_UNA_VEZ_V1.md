# ALQUIMIA UNA_VEZ v1
**AuriPortal / Aurelín — Dominio MASTER**  
**Versión:** 1.0.0  
**Fecha:** 2026-01-13  
**Estado:** CANÓNICO  
**Commit:** v5.68.0-alquimia-una-vez-v1

---

## PROPÓSITO

Documentación canónica del sistema de Alquimia UNA_VEZ en AuriPortal.

Este documento refleja **EXACTAMENTE** la implementación canónica de UNA_VEZ v1. Es la referencia definitiva para:
- Entender cómo funciona UNA_VEZ
- Implementar nuevas funcionalidades relacionadas
- Mantener coherencia con el diseño canónico
- Verificar comportamientos esperados

**OBLIGATORIO:** Cualquier cambio en UNA_VEZ debe actualizar este documento.

---

## 1) DEFINICIÓN ONTOLÓGICA

**UNA_VEZ** es un tipo de item de Alquimia que se trabaja un número determinado de veces (`veces_limpiar`).

### Características Principales

1. **Contador acumulativo:** `shared_clean_count` siempre incrementa (+1 por cada limpieza)
2. **Sin bloqueo:** Puede seguir incrementando aunque `remaining = 0`
3. **Recomendado:** `veces_limpiar` es el número recomendado de veces a trabajar
4. **Restantes:** `shared_remaining = max(veces_limpiar - clean_count, 0)` (clamp a 0)
5. **Completado:** `shared_completed = 1` si `remaining <= 0`, `0` si `remaining > 0`

### Diferencias con RECURRENTES

| Aspecto | RECURRENTES | UNA_VEZ |
|---------|-------------|---------|
| **Concepto** | Limpieza periódica (cada X días) | Limpieza acumulativa (X veces) |
| **Contador** | `shared_clean_count` (veces limpiado) | `shared_clean_count` (veces trabajado) |
| **Estado** | Basado en `last_cleaned_at` + `threshold_days` | Basado en `clean_count` vs `veces_limpiar` |
| **Bloqueo** | NO (siempre puede limpiar) | NO (puede seguir incrementando) |
| **Proyección** | `shared_last_cleaned_at`, `shared_clean_count` | `shared_clean_count`, `shared_remaining`, `shared_completed` |

---

## 2) CLEANING ENGINE Y PROYECCIÓN

### 2.1 markCleanStudent / markCleanAllStudents

**REGLA ABSOLUTA:** `markCleanStudent()` y `markCleanAllStudents()` **SIEMPRE** suman +1 en UNA_VEZ.

- No hay validación que bloquee ejecución por estado
- No hay validación que bloquee ejecución por `remaining = 0`
- `shared_clean_count` siempre incrementa
- `shared_remaining` se recalcula: `max(veces_limpiar - clean_count, 0)`
- `shared_completed` se recalcula: `1` si `remaining <= 0`, `0` si `remaining > 0`

### 2.2 Proyección (cleaning_item_state)

**Campos relevantes:**
- `shared_clean_count`: Contador de veces trabajado (siempre incrementa, nunca NULL, seed=0)
- `shared_remaining`: Restantes (clamp a 0, puede ser NULL si nunca inicializado)
- `shared_completed`: 1 si `remaining <= 0`, 0 si `remaining > 0`

**SQL de proyección:**
```sql
-- INSERT (primera vez)
INSERT INTO cleaning_item_state (
  student_id, product_key, domain_type, item_ref,
  shared_clean_count, shared_remaining, shared_completed
) VALUES (
  $1, $2, $3, $4, 1, GREATEST(0, $5 - 1), 
  CASE WHEN $5 - 1 <= 0 THEN 1 ELSE 0 END
)

-- UPDATE (incremento)
ON CONFLICT (student_id, product_key, domain_type, item_ref)
DO UPDATE SET
  shared_clean_count = cleaning_item_state.shared_clean_count + 1,
  shared_remaining = GREATEST(0, $5 - (cleaning_item_state.shared_clean_count + 1)),
  shared_completed = CASE 
    WHEN GREATEST(0, $5 - (cleaning_item_state.shared_clean_count + 1)) <= 0 THEN 1 
    ELSE 0 
  END
```

**REGLA:** `clean_count` puede superar `veces_limpiar` (sin bloqueo).

### 2.3 Seed Inicial

**REGLA:** Si un estudiante nunca ha trabajado un item UNA_VEZ:
- `shared_clean_count = 0` (nunca NULL)
- `shared_remaining = NULL` (se calcula dinámicamente como `veces_limpiar`)
- `shared_completed = 0`

**Lectura:** Si `shared_clean_count IS NULL`, se trata como `0`.

---

## 3) ESTADOS VISUALES CANÓNICOS

### 3.1 Orden Canónico

Los estados visuales se ordenan según este orden canónico:

1. **⚪ NUNCA** (gris) - `clean_count = 0`
2. **🟡 EN PROCESO** (amarillo) - `clean_count > 0` pero `remaining > 0`
3. **✅ COMPLETADO** (verde) - `clean_count >= veces_limpiar`, `remaining = 0`
4. **🟣 MUY BIEN TRABAJADO** (dorado) - `clean_count > veces_limpiar`, `remaining = 0`

### 3.2 Cálculo de Estados

**Cálculo dinámico en servicio:**
```javascript
if (cleanCount === 0) {
  visualState = 'never';
} else if (remaining !== null && remaining > 0) {
  visualState = 'in_progress';
} else if (remaining !== null && remaining <= 0 && cleanCount === vecesLimpiar) {
  visualState = 'completed';
} else if (remaining !== null && remaining <= 0 && cleanCount > vecesLimpiar) {
  visualState = 'excellent';
}
```

**REGLA:** Estados se calculan dinámicamente, NO se persisten.

---

## 4) UI FLOTANTE (ALQUIMIA GENERAL)

### 4.1 Columnas de Estado

**Orden canónico en UI:**
1. ⚪ NUNCA (colapsable)
2. 🟡 EN PROCESO
3. ✅ COMPLETADO
4. 🟣 MUY BIEN TRABAJADO

### 4.2 Información Mostrada

Cada fila de estudiante muestra:
- **Nombre del estudiante**
- **Contador:** `clean_count` (veces trabajado)
- **Recomendado:** `veces_limpiar` (del item)
- **Restantes:** `remaining` (o `veces_limpiar` si `clean_count = 0`)

### 4.3 Botones

- **+1:** Siempre disponible (no se bloquea)
- **PDE:** Disponible para limpieza PDE
- **Historial:** Disponible para ver historial

---

## 5) EXECUTION MODES

### 5.1 APPLY (Idempotente)

- **Execution key:** `mark_clean:{item_ref}:{student_uuid}:{YYYY-MM-DD}`
- **Comportamiento:** Idempotente por día (mismo día = mismo execution_key)
- **Proyección:** Incrementa `clean_count` siempre

### 5.2 CERTIFY (No Idempotente)

- **Execution key:** `certify:{item_ref}:{student_uuid}:{timestamp}`
- **Comportamiento:** Siempre ejecuta (no idempotente)
- **Proyección:** Incrementa `clean_count` siempre

**REGLA:** Ambos modos incrementan `clean_count` de la misma forma. La diferencia está en la idempotencia de eventos.

---

## 6) PDE Y SHARED

### 6.1 Limpieza PDE

- **PDE suma a contador:** `pde_clean_count` incrementa
- **PDE NO completa SHARED:** `shared_completed` NO se afecta por limpiezas PDE
- **PDE solo auditoría:** `pde_completed` es solo para auditoría

### 6.2 Limpieza SHARED

- **SHARED suma a contador:** `shared_clean_count` incrementa
- **SHARED recalcula remaining:** `shared_remaining = max(veces_limpiar - clean_count, 0)`
- **SHARED recalcula completed:** `shared_completed = 1` si `remaining <= 0`

---

## 7) HISTORIAL

### 7.1 Eventos (cleaning_events)

**Campos relevantes:**
- `delta_completed`: 1 (para UNA_VEZ)
- `item_kind`: 'una_vez'
- `action_type`: 'mark_clean'
- `clean_layer`: 'shared' | 'pde'

### 7.2 Visualización

El historial muestra:
- **Total de veces trabajado:** `clean_count`
- **Eventos individuales:** Cada limpieza (SHARED o PDE)
- **Diferenciación SHARED/PDE:** Visible en cada evento

**REGLA:** No se borran ni ocultan eventos antiguos.

---

## 8) CAMBIOS DE RECOMENDADO (veces_limpiar)

### 8.1 Recalculo Automático

**REGLA:** Si `veces_limpiar` cambia:
- `shared_remaining` se recalcula: `max(nuevo_veces_limpiar - clean_count, 0)`
- `shared_completed` se recalcula: `1` si `remaining <= 0`, `0` si `remaining > 0`
- Estados visuales se recalculan dinámicamente

**REGLA:** El recálculo es **eager** (al guardar el item), no lazy (al leer).

---

## 9) REGLAS CONSTITUCIONALES

### 9.1 Prohibiciones

- ❌ **NO bloquear +1** cuando `remaining = 0`
- ❌ **NO borrar historial** (eventos son append-only)
- ❌ **NO introducir frecuencia_dias** (solo para recurrentes)
- ❌ **NO refactorizar recurrentes** fuera de lo necesario
- ❌ **NO cambiar contratos existentes** sin versionar

### 9.2 Obligaciones

- ✅ **SIEMPRE sumar +1** en `markCleanStudent` / `markCleanAllStudents`
- ✅ **Seed = 0** para contadores nuevos (nunca NULL)
- ✅ **Calcular estados dinámicamente** (no persistir)
- ✅ **Aplicar orden canónico** en UI
- ✅ **Mantener historial intacto**

---

## 10) VERIFICACIÓN

### 10.1 Checklist Obligatorio

- [ ] +1 siempre suma (incluso si `remaining = 0`)
- [ ] Superar recomendado pasa a dorado (`excellent`)
- [ ] Cambiar recomendado recalcula estados
- [ ] PDE suma pero no completa SHARED
- [ ] Historial intacto (no se borran eventos)
- [ ] Recurrentes siguen funcionando igual

### 10.2 Pruebas Manuales

1. **Limpiar item UNA_VEZ:** Verificar que `clean_count` incrementa
2. **Superar recomendado:** Verificar que pasa a estado dorado
3. **Cambiar recomendado:** Verificar que estados se recalculan
4. **Limpieza PDE:** Verificar que suma pero no completa SHARED
5. **Historial:** Verificar que muestra todos los eventos

---

## REFERENCIAS

- `docs/ALQUIMIA_CANONICA_V1.md` - Documentación canónica general de Alquimia
- `docs/DIAGNOSTICO_PROFUNDO_UNA_VEZ_V1.md` - Diagnóstico del sistema UNA_VEZ
- `src/core/master/services/cleaning-engine-service.js` - Cleaning Engine v1
- `src/infra/repos/cleaning/cleaning-item-state-repo-pg.js` - Repositorio de proyección
- `src/services/alquimia-general-service.js` - Servicio de Alquimia General

---

**DOCUMENTO CANÓNICO v1.0.0 - UNA_VEZ v1**
