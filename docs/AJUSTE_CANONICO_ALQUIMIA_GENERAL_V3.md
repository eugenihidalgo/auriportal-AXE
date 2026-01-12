# 🔧 AJUSTE CANÓNICO v5.68.3 — RECURRENTE PDE + UNA_VEZ MEZCLA CAPAS
**AuriPortal / Aurelín — DOMINIO MASTER**  
**Versión:** v5.68.3-alquimia-fix-pde-recurrente-una_vez-layer  
**Fecha:** 2026-01-13  
**Estado:** IMPLEMENTADO

---

## PROPÓSITO

Corregir 2 regresiones detectadas post v5.68.2:
1. **RECURRENTE PDE**: No funciona correctamente (filtro por nivel + estado no cambia)
2. **UNA_VEZ**: Al accionar PDE, "se marcan las dos" o falla recurrentemente

---

## SÍNTOMAS REPORTADOS

### A) RECURRENTE PDE
- **Síntoma**: En vista PDE "parece filtrar por nivel" y NO cae en la columna correcta (nivel 1 tampoco)
- **Síntoma**: PDE recurrente no cambia de estado/columna
- **Causa raíz**: Aunque el endpoint pasaba `skip_level_filter: true`, el código aún tenía lógica que podía filtrar estudiantes por nivel

### B) UNA_VEZ
- **Síntoma**: Al accionar PDE, "se marcan las dos" o falla recurrentemente
- **Síntoma**: Los botones/mecanismos SHARED/PDE no están estrictamente separados
- **Causa raíz**: Falta de validación explícita de `clean_layer` en frontend y backend

---

## FIXES APLICADOS

### FIX A — Eliminar cualquier filtro por nivel en RECURRENTE PDE

**Archivo:** `src/services/alquimia-general-service.js`  
**Líneas:** 526-566

**Cambio:**
- ❌ Antes: Aunque `skip_level_filter: true` se pasaba, el código aún podía excluir estudiantes si `skipLevelFilter` era false
- ✅ Después: **REGLA CONSTITUCIONAL**: En Master, NUNCA filtrar por nivel, incluso si `skipLevelFilter` es false
- ✅ Cambio: `studentsNoAplica` se usa solo para logging, pero NO se excluyen estudiantes en Master

**Impacto:** Master puede limpiar cualquier item a cualquier alumno, sin excepciones.

---

### FIX B — Validación explícita de clean_layer

**Archivo:** `public/js/master/master-alquimia-general-client.js`  
**Líneas:** 1699-1720

**Cambio:**
- ❌ Antes: `clean_layer` se pasaba sin validación explícita
- ✅ Después: Validación explícita antes de construir payload:
  ```javascript
  if (!cleanLayer || (cleanLayer !== 'shared' && cleanLayer !== 'pde')) {
    console.error('[MasterAlquimiaGeneral] ⚠️ clean_layer inválido o faltante:', cleanLayer);
    showToastError('Error: capa de limpieza inválida. Por favor, recarga la página.');
    return;
  }
  ```
- ✅ Logs forenses añadidos para verificar `clean_layer` correcto

**Archivo:** `src/core/master/services/cleaning-engine-service.js`  
**Líneas:** 189-193

**Cambio:**
- ❌ Antes: `clean_layer` tenía default `'shared'` pero no se validaba explícitamente
- ✅ Después: Validación obligatoria:
  ```javascript
  if (!clean_layer || (clean_layer !== 'shared' && clean_layer !== 'pde')) {
    throw new Error(`clean_layer es requerido y debe ser 'shared' o 'pde'. Valor recibido: ${clean_layer}`);
  }
  ```

**Impacto:** Garantiza que `clean_layer` es siempre 'shared' o 'pde', previniendo mezcla de capas.

---

### FIX C — Verificación de cálculo de pde.days_since_last_clean

**Verificación:**
- ✅ El repositorio `master-student-transmutation-read-repo-pg.js` ya calcula correctamente `pde.days_since_last_clean` (líneas 245-247)
- ✅ El DTO expone ambos `shared.days_since_last_clean` y `pde.days_since_last_clean` simétricamente
- ✅ El servicio `alquimia-general-service.js` usa el `clean_layer` correcto para calcular el estado (líneas 592-621)

**Resultado:** El cálculo de estado RECURRENTE PDE funciona correctamente cuando `clean_layer='pde'`.

---

### FIX D — Verificación de escritura independiente

**Verificación:**
- ✅ El repositorio `cleaning-item-state-repo-pg.js` ya escribe correctamente:
  - RECURRENTE PDE: Solo actualiza `pde_last_cleaned_at` y `pde_clean_count` (líneas 112-114)
  - UNA_VEZ PDE: Solo actualiza `pde_clean_count`, `pde_remaining`, `pde_completed` (líneas 336-356)
- ✅ El cleaning engine usa métodos separados según `clean_layer` (líneas 440-472)
- ✅ Logs forenses ya añadidos en v5.68.2 para verificar independencia

**Resultado:** Las acciones PDE escriben SOLO columnas PDE, sin tocar SHARED.

---

## VERIFICACIÓN

### Checklist Real

#### A) RECURRENTE
- ✅ Item con `frecuencia_dias = 20` (no 7)
- ✅ ✓ SHARED: cambia solo `shared_last_cleaned_at`, estado `reviewed` en SHARED
- ✅ ✓ PDE: cambia solo `pde_last_cleaned_at`, estado `reviewed` en PDE
- ✅ Confirmar que NO desaparecen alumnos por "nivel" en ninguna vista

#### B) UNA_VEZ
- ✅ +1 SHARED: sube SOLO `shared_clean_count`
- ✅ +1 PDE: sube SOLO `pde_clean_count`
- ✅ S+P: suben ambas por dos acciones
- ✅ Confirmar que no hay "doble escritura" en PDE

---

## ARCHIVOS MODIFICADOS

1. `src/services/alquimia-general-service.js`
   - Eliminado filtro por nivel en Master (regla constitucional)
   - `studentsNoAplica` solo para logging, NO excluye estudiantes

2. `public/js/master/master-alquimia-general-client.js`
   - Validación explícita de `clean_layer` antes de construir payload
   - Logs forenses añadidos

3. `src/core/master/services/cleaning-engine-service.js`
   - Validación obligatoria de `clean_layer` (debe ser 'shared' o 'pde')

---

## RESULTADO

- ✅ **RECURRENTE PDE funciona correctamente**: No filtra por nivel, estado cambia según `clean_layer`
- ✅ **UNA_VEZ no mezcla capas**: Validación explícita de `clean_layer` previene mezcla
- ✅ **Master puede limpiar cualquier item a cualquier alumno**: Regla constitucional aplicada
- ✅ **Logs forenses**: Verificación de `clean_layer` correcto en frontend y backend

---

## REFERENCIAS

- Ajuste anterior: `docs/AJUSTE_CANONICO_ALQUIMIA_GENERAL_V2.md`
- Documentación canónica: `docs/ALQUIMIA_CANONICA_V1.md`
- Contrato limpieza: `docs/CONTRATO_LIMPIEZA_V1.md`

---

**FIN DEL AJUSTE CANÓNICO v3**
