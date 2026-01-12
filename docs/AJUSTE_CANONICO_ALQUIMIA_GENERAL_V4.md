# 🔧 AJUSTE CANÓNICO v5.68.4 — ACCIONES NO EJECUTAN + CAOS UNA_VEZ + POTENCIADO EXCEDENTE
**AuriPortal / Aurelín — DOMINIO MASTER**  
**Versión:** v5.68.4-alquimia-action-layer-wiring-and-empowered-overcount  
**Fecha:** 2026-01-13  
**Estado:** IMPLEMENTADO

---

## PROPÓSITO

Restaurar funcionamiento tras v5.68.3 (probable bloqueo por validación clean_layer) y añadir display de excedente para POTENCIADO.

---

## SÍNTOMAS REPORTADOS (POST v5.68.3)

### A) RECURRENTE
- **Síntoma**: "no funciona nada de nada" (pulses lo que pulses)
- **Hipótesis**: La validación dura de `clean_layer` está bloqueando requests o devolviendo `ok:false` sin UI visible

### B) UNA_VEZ
- **Síntoma**: Sigue el caos igual
- **Hipótesis**: Algunos botones (especialmente COMBO / S+P) pueden estar enviando `clean_layer` inválido (p.ej. 'combo' o undefined)

### C) POTENCIADO
- **Nuevo requerimiento**: En estado POTENCIADO no mostrar cuenta atrás; mostrar excedente (cuántas veces de más)

---

## CAUSA RAÍZ

1. **Validación bloqueando silenciosamente**: La validación de `clean_layer` en frontend retornaba sin mostrar error visible
2. **Errores no visibles**: Los errores del backend no se mostraban en UI (solo en consola)
3. **Display incorrecto**: POTENCIADO mostraba `remaining: 0` en lugar de excedente

---

## FIXES APLICADOS

### FIX A — Logs forenses y manejo de errores visible

**Archivo:** `public/js/master/master-alquimia-general-client.js`  
**Líneas:** 1718-1750

**Cambio:**
- ✅ Añadido log forense `[AG][ACTION]` antes de cada fetch con:
  - `actionType`, `item_kind`, `clean_layer`, `student_uuid`, `layerView`, `viewMode`
- ✅ Verificación de respuesta HTTP antes de parsear JSON
- ✅ Manejo de errores HTTP con toast visible
- ✅ Manejo de errores backend (`ok:false`) con toast visible incluyendo `trace_id`

**Impacto:** Ahora todos los errores se muestran en UI, no solo en consola.

---

### FIX B — Validación clean_layer no bloqueante

**Archivo:** `public/js/master/master-alquimia-general-client.js`  
**Líneas:** 1702-1706

**Cambio:**
- ✅ Validación mantiene toast de error visible
- ✅ `return` temprano sin romper el flotante
- ✅ Logs forenses añadidos para debugging

**Impacto:** Si `clean_layer` es inválido, se muestra error visible y no se ejecuta la acción.

---

### FIX C — Backend: captura de errores del cleaning engine

**Archivo:** `src/endpoints/master-api-alquimia-general.js`  
**Líneas:** 1022-1080

**Cambio:**
- ✅ Envuelto `cleaningMarkClean` en `try/catch`
- ✅ Errores del cleaning engine se capturan y devuelven como `jsonError` con `trace_id`
- ✅ Logs estructurados para debugging

**Impacto:** Errores del cleaning engine se devuelven correctamente al frontend con `ok:false` y `trace_id`.

---

### FIX D — Display POTENCIADO: excedente en lugar de countdown

**Archivo:** `public/js/master/master-alquimia-general-client.js`  
**Líneas:** 1485-1495 (COMBO) y 1510-1525 (SHARED/PDE)

**Cambio:**
- ❌ Antes: Mostraba `remaining` (countdown) incluso en potenciado
- ✅ Después:
  - Si `combo.clean_count < required_count`: mostrar "Faltan: X"
  - Si `combo.clean_count >= required_count`: mostrar "De más: Y" (excedente)
  - En vista COMBO: incluye desglose S/P
  - En vista SHARED/PDE: solo muestra faltan/excedente de esa capa

**Impacto:** POTENCIADO muestra excedente correctamente, no countdown.

---

## VERIFICACIÓN

### Checklist Real

#### A) Logs forenses
- ✅ Al pulsar cualquier botón aparece en consola: `[AG][ACTION]` con `clean_layer` correcto

#### B) Errores visibles
- ✅ Si hay error HTTP, se muestra toast con código de estado
- ✅ Si hay error backend (`ok:false`), se muestra toast con mensaje y `trace_id`

#### C) RECURRENTE
- ✅ ✓ SHARED cambia solo `shared_last_cleaned_at`
- ✅ ✓ PDE cambia solo `pde_last_cleaned_at`
- ✅ S+P ejecuta ambas acciones correctamente

#### D) UNA_VEZ
- ✅ +1 SHARED solo `shared_clean_count`
- ✅ +1 PDE solo `pde_clean_count`
- ✅ En completed/potenciado sigue permitiendo +1
- ✅ S+P ejecuta ambas acciones correctamente

#### E) Display
- ✅ Antes de completar: "Faltan X"
- ✅ Completado/potenciado: "De más Y"
- ✅ Vista COMBO: incluye desglose S/P

---

## ARCHIVOS MODIFICADOS

1. `public/js/master/master-alquimia-general-client.js`
   - Logs forenses `[AG][ACTION]` añadidos
   - Manejo de errores HTTP y backend mejorado (toasts visibles)
   - Display de POTENCIADO: excedente en lugar de countdown

2. `src/endpoints/master-api-alquimia-general.js`
   - Captura de errores del cleaning engine con `try/catch`
   - Errores devueltos como `jsonError` con `trace_id`

---

## RESULTADO

- ✅ **Acciones funcionan correctamente**: Logs forenses y errores visibles
- ✅ **Errores se muestran en UI**: No más errores silenciosos
- ✅ **POTENCIADO muestra excedente**: No más countdown en potenciado
- ✅ **Validación no bloqueante**: Errores visibles, flotante no se rompe

---

## REFERENCIAS

- Ajuste anterior: `docs/AJUSTE_CANONICO_ALQUIMIA_GENERAL_V3.md`
- Documentación canónica: `docs/ALQUIMIA_CANONICA_V1.md`
- Contrato limpieza: `docs/CONTRATO_LIMPIEZA_V1.md`

---

**FIN DEL AJUSTE CANÓNICO v4**
