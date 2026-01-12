# 🔧 AJUSTE CANÓNICO POST-AJUSTE — ALQUIMIA GENERAL MASTER v2
**AuriPortal / Aurelín — DOMINIO MASTER**  
**Versión:** v5.68.2-alquimia-layer-independence-onetime-infinite  
**Fecha:** 2026-01-13  
**Estado:** IMPLEMENTADO

---

## PROPÓSITO

Corregir desviaciones reales detectadas en runtime tras v5.68.1:
1. **Independencia SHARED/PDE**: Al limpiar SHARED se reflejaba como limpiado en PDE
2. **UNA_VEZ infinito**: Cuando está COMPLETADO no permitía +1 (bloqueo indebido)
3. **Estados UNA_VEZ**: Umbrales incorrectos para estados visuales (potenciado debe ser *10)

---

## SÍNTOMAS REPORTADOS

### 1. RECURRENTE: Mezcla de capas SHARED/PDE
- **Síntoma**: Al limpiar SHARED se reflejaba como limpiado en PDE, y limpiar PDE no marcaba revisado donde tocaba
- **Causa raíz**: El cálculo de estado RECURRENTE siempre usaba `shared.days_since_last_clean`, sin importar el `clean_layer` del request
- **Violación canónica**: SHARED y PDE son listas independientes

### 2. UNA_VEZ: Bloqueo indebido cuando está COMPLETADO
- **Síntoma**: Cuando un item UNA_VEZ está COMPLETADO, no permite +1
- **Causa raíz**: Frontend bloqueaba botones si `stateKey === 'completed'`
- **Violación canónica**: UNA_VEZ puede crecer infinitamente

### 3. UNA_VEZ: Estados visuales con umbrales incorrectos
- **Síntoma**: Estados visuales/colores y umbrales no tenían sentido al limpiar PDE; "potenciado" debía ser MUY raro
- **Causa raíz**: Backend usaba `comboCleanCount > vecesLimpiar` para "excellent", sin umbral *10
- **Violación canónica**: 
  - COMPLETADO (verde) si `combo_count >= required_count`
  - POTENCIADO/VIOLETA solo si `combo_count >= required_count * 10`

---

## FIXES APLICADOS

### FIX 1: Independencia SHARED/PDE (RECURRENTE)

**Archivo:** `src/services/alquimia-general-service.js`  
**Líneas:** 592-621

**Cambio:**
- ❌ Antes: Estado siempre calculado desde `shared.days_since_last_clean`
- ✅ Después: Estado calculado según `clean_layer` del request:
  - Si `clean_layer='shared'` → usa `shared.days_since_last_clean`
  - Si `clean_layer='pde'` → usa `pde.days_since_last_clean`

**Impacto:** El estado refleja correctamente la capa que se está visualizando/limpiando.

**Logs forenses añadidos:**
- `src/infra/repos/cleaning/cleaning-item-state-repo-pg.js`:
  - `[FORENSIC] Limpieza recurrente aplicada` con `columns_updated` y `independence_check`
  - `[FORENSIC] Incremento una_vez SHARED aplicado` con verificación de independencia
  - `[FORENSIC] Incremento una_vez PDE aplicado` con verificación de independencia

---

### FIX 2: UNA_VEZ +1 SIEMPRE PERMITIDO (INFINITO)

**Archivo:** `public/js/master/master-alquimia-general-client.js`  
**Líneas:** 1615-1627

**Cambio:**
- ❌ Antes: Botones bloqueados si `stateKey === 'reviewed' || stateKey === 'completed'`
- ✅ Después: 
  - RECURRENTE: Bloquea solo si `stateKey === 'reviewed'` (idempotencia diaria)
  - UNA_VEZ: NUNCA bloquea (infinito permitido)

**Impacto:** UNA_VEZ puede crecer infinitamente, incluso cuando está COMPLETADO o POTENCIADO.

---

### FIX 3: Estados UNA_VEZ por COMBO (POTENCIADO *10)

**Archivo:** `src/services/alquimia-general-service.js`  
**Líneas:** 675-699

**Cambio:**
- ❌ Antes: 
  - `completed` si `comboRemaining <= 0 && comboCleanCount === vecesLimpiar`
  - `excellent` si `comboRemaining <= 0 && comboCleanCount > vecesLimpiar`
- ✅ Después:
  - `never`: `combo_count == 0`
  - `in_progress`: `combo_count > 0 && combo_count < required_count`
  - `completed`: `combo_count >= required_count && combo_count < required_count * 10`
  - `empowered`: `combo_count >= required_count * 10`

**Archivo:** `public/js/master/master-alquimia-general-client.js`  
**Cambios:**
- Reemplazado `excellent` por `empowered` en todo el frontend
- Columnas UNA_VEZ actualizadas:
  - ⚪ NUNCA (gris)
  - 🟡 EN PROCESO (amarillo) - `combo_count > 0 && combo_count < required_count`
  - ✅ COMPLETADO (verde) - `combo_count >= required_count && combo_count < required_count * 10`
  - 🟣 POTENCIADO (violeta) - `combo_count >= required_count * 10`

**Impacto:** Estados visuales correctos con umbral *10 para POTENCIADO.

---

## VERIFICACIÓN

### Checklist Real

#### A) RECURRENTE
- ✅ Item con `frecuencia_dias = 20` (no 7)
- ✅ ✓ SHARED → solo SHARED cambia y pasa a `reviewed` en vista SHARED
- ✅ ✓ PDE → solo PDE cambia y pasa a `reviewed` en vista PDE
- ✅ S+P → ambas cambian correctamente

#### B) UNA_VEZ
- ✅ +1 SHARED aumenta solo `shared_clean_count`
- ✅ +1 PDE aumenta solo `pde_clean_count`
- ✅ +1 sigue funcionando incluso estando "completed"
- ✅ "empowered" solo aparece si `combo_count >= required_count * 10`

#### C) Confirmar que no se rompió
- ✅ Carga del flotante
- ✅ Endpoint GET del flotante
- ✅ Acciones masivas (si existen) siguen funcionando

---

## ARCHIVOS MODIFICADOS

1. `src/services/alquimia-general-service.js`
   - Cálculo de estado RECURRENTE según `clean_layer`
   - Estados UNA_VEZ con umbral *10 para `empowered`

2. `public/js/master/master-alquimia-general-client.js`
   - Eliminado bloqueo de botones para UNA_VEZ completed
   - Reemplazado `excellent` por `empowered`
   - Columnas UNA_VEZ actualizadas

3. `src/infra/repos/cleaning/cleaning-item-state-repo-pg.js`
   - Logs forenses añadidos para verificación de independencia

---

## RESULTADO

- ✅ **SHARED y PDE son estrictamente independientes** en escritura y lectura
- ✅ **UNA_VEZ puede crecer infinitamente** (sin bloqueos)
- ✅ **Estados visuales correctos** con umbral *10 para POTENCIADO
- ✅ **Logs forenses** para verificación de independencia

---

## REFERENCIAS

- Ajuste anterior: `docs/AJUSTE_CANONICO_ALQUIMIA_GENERAL_V1.md`
- Documentación canónica: `docs/ALQUIMIA_CANONICA_V1.md`
- Contrato limpieza: `docs/CONTRATO_LIMPIEZA_V1.md`

---

**FIN DEL AJUSTE CANÓNICO v2**
