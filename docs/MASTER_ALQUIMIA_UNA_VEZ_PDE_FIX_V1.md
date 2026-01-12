# MASTER ALQUIMIA UNA_VEZ PDE FIX v1
**AuriPortal / Aurelín — Dominio MASTER**  
**Versión:** 1.0.0  
**Fecha:** 2026-01-12  
**Estado:** CANÓNICO  
**Commit:** vX.Y.Z-master-alquimia-unavez-multi-pde-fix

---

## PROPÓSITO

Documentación canónica del fix implementado para:
1. Eliminar límite diario en MASTER para UNA_VEZ (permitir múltiples incrementos en la misma sesión)
2. Corregir botón PDE para que ejecute correctamente "shared + pde" en UNA_VEZ

Este documento refleja **EXACTAMENTE** la solución implementada y es la referencia definitiva para:
- Entender por qué se eliminó el límite diario en MASTER
- Verificar el comportamiento correcto del botón PDE
- Prevenir regresiones futuras
- Mantener coherencia con el diseño canónico

**OBLIGATORIO:** Cualquier cambio relacionado con límites diarios o comportamiento PDE debe consultar este documento.

---

## 1) PROBLEMA REAL OBSERVADO

### 1.1 UNA_VEZ No Acumulaba Más de Una Vez

**Síntoma:**
- Al marcar/limpiar un item UNA_VEZ más de una vez en el mismo día, el segundo intento no acumulaba
- El contador `clean_count` no incrementaba
- El campo `remaining` no decrementaba

**Causa Raíz:**
- El sistema de idempotencia usaba `execution_key` basado en día: `{action_type}:{item_ref}:{student_uuid}:{YYYY-MM-DD}`
- En modo `APPLY` (por defecto), el mismo `execution_key` en el mismo día generaba idempotencia
- El repositorio `cleaning-events-repo-pg.js` detectaba duplicados con `ON CONFLICT (execution_key, student_uuid)` y retornaba `already_executed: true`
- El Cleaning Engine interpretaba `already_executed` como "no hacer nada" y retornaba el estado actual sin cambios

**Evidencia:**
- Logs mostraban: `Evento ya aplicado (idempotencia)` con el mismo `execution_key`
- El segundo intento de limpieza no generaba nuevo evento en `cleaning_events`
- El estado en `cleaning_item_state` no cambiaba

**Impacto:**
- MASTER no podía corregir/avanzar múltiples veces en una sesión
- Limitaba la capacidad de ajuste manual en Alquimia General
- Violaba el principio de que MASTER debe poder operar sin restricciones de frecuencia

### 1.2 Botón PDE No Hacía Nada

**Síntoma:**
- Al pulsar el botón "PDE" en un item UNA_VEZ, no se observaba ningún cambio
- El flotante no se rehidrataba
- No aparecía el efecto "shared + pde" esperado

**Causa Raíz:**
- El botón PDE llamaba a `/master/api/alquimia-general/items/:item_ref/master/increment-all` con `clean_layer: 'pde'`
- Este endpoint ejecutaba `incrementAll()` que delegaba a `incrementAllStudents()` del Cleaning Engine
- El servicio ejecutaba correctamente la limpieza en capa PDE
- **PERO:** Solo ejecutaba en capa PDE, no en shared
- El comportamiento esperado "shared + pde" (doble efecto) no se implementaba

**Evidencia:**
- Network tab mostraba llamada exitosa a `increment-all` con `clean_layer: 'pde'`
- Respuesta JSON mostraba `ok: true` y `updated > 0`
- Sin embargo, el contador visible en UI (shared) no cambiaba
- El flotante no se rehidrataba automáticamente

**Impacto:**
- PDE no cumplía su función canónica de registrar en ambas capas
- La UI no reflejaba el cambio porque mostraba capa shared por defecto
- Confusión sobre qué capa se estaba modificando

---

## 2) DECISIÓN CANÓNICA

### 2.1 Eliminación de Límite Diario en MASTER para UNA_VEZ

**Decisión:**
En dominio MASTER, los items UNA_VEZ NO tienen límite diario. Pueden incrementarse múltiples veces en la misma sesión sin restricción.

**Justificación:**
1. **MASTER es contexto de gobierno:** MASTER debe poder corregir, ajustar y avanzar sin restricciones de frecuencia
2. **Necesidad operativa:** En una sesión de trabajo, MASTER puede necesitar aplicar múltiples incrementos para corregir errores o avanzar progreso
3. **Separación de contextos:** El límite diario (si existe) debe aplicarse solo en contexto ALUMNO/GOD, no en MASTER
4. **Coherencia con CERTIFY:** El modo CERTIFY ya existe para acciones MASTER explícitas que siempre ejecutan

**Implementación:**
- **Condición:** `actor_type === 'master' && surface_key === 'master.alquimia_general'`
- **Acción:** Si es MASTER y UNA_VEZ, usar `execution_mode: 'CERTIFY'` automáticamente
- **Efecto:** `execution_key` incluye timestamp completo, permitiendo múltiples ejecuciones

**Código Canónico:**
```javascript
// En markCleanStudent y incrementAllStudents
const isMasterDomain = actor_type === 'master' && surface_key === 'master.alquimia_general';
const effectiveExecutionMode = (isMasterDomain && itemKind === 'una_vez' && execution_mode === 'APPLY') 
  ? 'CERTIFY' 
  : execution_mode;
```

**Regla Constitucional:**
- ✅ **MASTER UNA_VEZ:** Siempre usa CERTIFY (sin límite diario)
- ✅ **ALUMNO/GOD UNA_VEZ:** Mantiene APPLY (idempotente, límite diario si aplica)
- ✅ **MASTER RECURRENTE:** Mantiene APPLY (idempotente, comportamiento normal)

### 2.2 Comportamiento PDE "shared + pde"

**Decisión:**
El botón PDE en UNA_VEZ debe ejecutar dos acciones explícitas:
1. Incrementar en capa `shared`
2. Incrementar en capa `pde`

**Justificación:**
1. **Doble registro canónico:** PDE debe registrar en ambas capas para auditoría completa
2. **Efecto visible:** El usuario debe ver el cambio en la capa shared (efecto principal)
3. **Auditoría completa:** La capa PDE queda registrada para seguimiento MASTER

**Implementación:**
- **UI:** `handlePdeIncrementAllItem()` ejecuta dos llamadas secuenciales:
  1. `POST /master/api/alquimia-general/items/:item_ref/master/increment-all` con `clean_layer: 'shared'`
  2. `POST /master/api/alquimia-general/items/:item_ref/master/increment-all` con `clean_layer: 'pde'`
- **Rehidratación:** Después de ambas acciones, rehidrata el flotante con vista `shared` (efecto principal visible)

**Código Canónico:**
```javascript
// En handlePdeIncrementAllItem
// 1) Incrementar en shared
const responseShared = await fetch(`/master/api/alquimia-general/items/${item.item_ref}/master/increment-all`, {
  method: 'POST',
  body: JSON.stringify({ clean_layer: 'shared' })
});

// 2) Incrementar en pde
const responsePde = await fetch(`/master/api/alquimia-general/items/${item.item_ref}/master/increment-all`, {
  method: 'POST',
  body: JSON.stringify({ clean_layer: 'pde' })
});

// 3) Rehidratar con vista shared
await handleVerItem(item, 'shared');
```

---

## 3) CONTRATO PDE

### 3.1 Endpoint Usado

**Ruta:** `POST /master/api/alquimia-general/items/:item_ref/master/increment-all`

**Parámetros:**
- `item_ref` (path): Referencia del item UNA_VEZ
- `product_key` (query, opcional): Clave del producto (default: 'pde')
- `clean_layer` (body, requerido): Capa de limpieza ('shared' | 'pde')

**Payload Esperado:**
```json
{
  "clean_layer": "shared" | "pde"
}
```

**Nota:** `item_kind` NO se envía en el body porque el servicio `incrementAll()` lo infiere como 'una_vez' automáticamente (según contrato canónico).

### 3.2 Significado de "shared + pde"

**"shared + pde"** significa que se ejecutan **dos efectos explícitos y separados**:

1. **Efecto SHARED:**
   - Incrementa `shared_clean_count` en `cleaning_item_state`
   - Decrementa `shared_remaining` (si aplica)
   - Actualiza `shared_completed` (si aplica)
   - Genera evento en `cleaning_events` con `clean_layer='shared'`
   - Emite señal `clean.executed` con scope='shared'

2. **Efecto PDE:**
   - Incrementa `pde_clean_count` en `cleaning_item_state` (si existe proyección PDE)
   - Genera evento en `cleaning_events` con `clean_layer='pde'`
   - Emite señal `clean.executed` con scope='pde'
   - Registra en `pde_daily_item_clean_log` (si aplica)

**Implementación:**
- **NO es una sola acción con dos efectos:** Son dos llamadas API separadas
- **NO es inferido:** Cada capa se ejecuta explícitamente
- **NO es transaccional:** Si una falla, la otra puede haber ejecutado (fail-open)

**Auditoría:**
- Cada efecto genera su propio evento en `cleaning_events`
- Cada efecto tiene su propio `execution_key` (con CERTIFY, ambos son únicos)
- Los logs muestran ambas ejecuciones por separado

---

## 4) VERIFICACIÓN

### 4.1 Pasos Manuales Reproducibles

#### Test 1: UNA_VEZ Múltiples Incrementos

1. Abrir `/master/templo-luz/alquimia-general`
2. Seleccionar una lista con items UNA_VEZ
3. Hacer clic en "VER" en un item UNA_VEZ
4. Observar contador inicial (ej. `Restantes: 3`)
5. Hacer clic en "+1" (botón en la lista principal)
6. **Verificar:** El contador debe cambiar (ej. `Restantes: 2`)
7. Hacer clic en "+1" nuevamente (mismo día, misma sesión)
8. **Verificar:** El contador debe cambiar nuevamente (ej. `Restantes: 1`)
9. **Verificar:** No debe aparecer mensaje de "ya aplicado" o "idempotencia"

#### Test 2: Botón PDE Ejecuta shared + pde

1. Abrir `/master/templo-luz/alquimia-general`
2. Seleccionar una lista con items UNA_VEZ
3. Hacer clic en "VER" en un item UNA_VEZ
4. Observar contador inicial (ej. `Restantes: 3`)
5. Hacer clic en "PDE" (botón en la lista principal)
6. **Verificar:** Toast muestra "PDE (shared + pde): X shared, Y pde"
7. **Verificar:** El flotante se rehidrata automáticamente
8. **Verificar:** El contador cambia (ej. `Restantes: 2`)
9. **Verificar:** El flotante muestra vista "shared" (no "pde")

#### Test 3: Verificación en Logs

1. Ejecutar `pm2 logs aurelinportal | grep -E "(incrementAll|PDE|CERTIFY)"`
2. **Verificar:** Logs muestran `execution_mode: CERTIFY` para MASTER UNA_VEZ
3. **Verificar:** Logs muestran dos ejecuciones separadas para PDE (shared + pde)
4. **Verificar:** No aparecen logs de "Evento ya aplicado (idempotencia)" para MASTER UNA_VEZ con CERTIFY

### 4.2 Evidencia en Logs (sin [TEMP])

**Logs Esperados para +1 UNA_VEZ (MASTER):**
```
[CleaningEngine] MASTER UNA_VEZ: usando CERTIFY para permitir múltiples incrementos
[CleaningEngine] execution_key generado: certify:item-ref:student-uuid:2026-01-12T10-30-45-123Z
[CleaningEngine] evento insertado: { execution_key: '...', already_executed: false }
```

**Logs Esperados para PDE UNA_VEZ:**
```
[AlquimiaGeneralService] incrementAll entrada: { cleanLayer: 'shared' }
[CleaningEngine] incrementAllStudents entrada: { execution_mode: 'CERTIFY' }
[AlquimiaGeneralService] incrementAll resultado: { updated: 10 }
[AlquimiaGeneralService] incrementAll entrada: { cleanLayer: 'pde' }
[CleaningEngine] incrementAllStudents entrada: { execution_mode: 'CERTIFY' }
[AlquimiaGeneralService] incrementAll resultado: { updated: 10 }
```

**Logs Prohibidos:**
- ❌ `Evento ya aplicado (idempotencia)` para MASTER UNA_VEZ con CERTIFY
- ❌ `execution_key` duplicado en el mismo segundo (imposible con CERTIFY)
- ❌ `skipped > 0` en CERTIFY (debe ser siempre 0)

### 4.3 Comportamiento Visible en UI

**Antes del Fix:**
- ❌ Segundo +1 no cambiaba contador
- ❌ PDE no cambiaba contador visible
- ❌ Flotante no se rehidrataba tras PDE

**Después del Fix:**
- ✅ Segundo +1 cambia contador inmediatamente
- ✅ PDE cambia contador visible (shared)
- ✅ Flotante se rehidrata automáticamente tras PDE
- ✅ Toast muestra ambos resultados (shared + pde)

---

## 5) PREVENCIÓN

### 5.1 Guards y Validaciones

**Guard 1: Verificación de Execution Mode en MASTER UNA_VEZ**
```javascript
// En markCleanStudent e incrementAllStudents
const isMasterDomain = actor_type === 'master' && surface_key === 'master.alquimia_general';
if (isMasterDomain && itemKind === 'una_vez' && execution_mode === 'APPLY') {
  // Debe usar CERTIFY automáticamente
  effectiveExecutionMode = 'CERTIFY';
}
```

**Guard 2: Verificación de item_kind en PDE**
```javascript
// En handlePdeIncrementAllItem (UI)
// El servicio incrementAll() valida que item_kind === 'una_vez'
// Si no es UNA_VEZ, debe fallar con error explícito
```

**Guard 3: Verificación de Doble Ejecución en PDE**
```javascript
// En handlePdeIncrementAllItem (UI)
// Debe ejecutar DOS llamadas: shared + pde
// Si solo ejecuta una, es un bug
```

### 5.2 Logs de No-Op Prohibidos

**Regla:** En MASTER UNA_VEZ con CERTIFY, NO debe aparecer:
- `Evento ya aplicado (idempotencia)`
- `already_executed: true`
- `skipped > 0` (debe ser siempre 0)

**Log de Alerta:**
```javascript
if (eventResult === 'already_applied' || (eventResult && eventResult.already_executed === true)) {
  if (isMasterDomain && itemKind === 'una_vez' && effectiveExecutionMode === 'CERTIFY') {
    logWarn('CleaningEngine', '⚠️ CERTIFY retornó already_executed - esto NO debería pasar', {
      traceId,
      execution_key: executionKey,
      execution_mode: effectiveExecutionMode
    });
  }
}
```

### 5.3 Tests Mínimos (si existe harness)

**Test 1: MASTER UNA_VEZ Múltiples Incrementos**
```javascript
// Ejecutar markCleanStudent dos veces seguidas (mismo día)
// Verificar: ambas ejecutan (updated > 0 en ambas)
// Verificar: execution_key diferentes (CERTIFY)
```

**Test 2: PDE Ejecuta shared + pde**
```javascript
// Ejecutar handlePdeIncrementAllItem
// Verificar: dos llamadas API (shared + pde)
// Verificar: ambas retornan ok: true
// Verificar: ambas tienen updated > 0
```

**Test 3: item_kind Obligatorio**
```javascript
// Intentar incrementAll sin item_kind
// Verificar: error explícito (no fallback silencioso)
```

### 5.4 Documentación de Reglas

**Reglas Constitucionales:**
1. ✅ MASTER UNA_VEZ siempre usa CERTIFY (sin límite diario)
2. ✅ PDE ejecuta shared + pde (dos efectos explícitos)
3. ✅ item_kind es obligatorio en todas las rutas de limpieza
4. ✅ No hay fallback silencioso para item_kind

**Referencias:**
- `docs/ALQUIMIA_EXECUTION_MODE_V1.md` - Documentación de execution_mode
- `docs/ALQUIMIA_UNA_VEZ_V1.md` - Documentación de UNA_VEZ
- `docs/ALQUIMIA_CANONICA_V1.md` - Documentación general de Alquimia

---

## 6) ARCHIVOS MODIFICADOS

### Backend

1. **`src/core/master/services/cleaning-engine-service.js`**
   - `markCleanStudent()`: Lógica para usar CERTIFY en MASTER UNA_VEZ
   - `incrementAllStudents()`: Lógica para usar CERTIFY en MASTER UNA_VEZ
   - Logs temporales `[TEMP]` añadidos para diagnóstico

2. **`src/services/alquimia-general-service.js`**
   - `incrementAll()`: Pasa `execution_mode: 'CERTIFY'` explícitamente
   - Logs temporales `[TEMP]` añadidos para diagnóstico

3. **`src/endpoints/master-api-alquimia-general.js`**
   - Endpoint `increment-all`: Log temporal `[TEMP]` añadido

### Frontend

4. **`public/js/master/master-alquimia-general-client.js`**
   - `handlePdeIncrementAllItem()`: Implementa ejecución "shared + pde" (dos llamadas)
   - Rehidratación del flotante con vista `shared` tras PDE

---

## 7) VERSIÓN Y DEPLOYMENT

**Versión:** vX.Y.Z-master-alquimia-unavez-multi-pde-fix  
**Commit:** (pendiente de commit)  
**Fecha:** 2026-01-12  
**Autor:** (pendiente)

**Deployment:**
```bash
pm2 restart aurelinportal
```

**Verificación Post-Deployment:**
1. ✅ Probar +1 UNA_VEZ dos veces seguidas (debe acumular)
2. ✅ Probar PDE UNA_VEZ (debe ejecutar shared + pde y rehidratar)
3. ✅ Verificar logs sin errores `[TEMP]` (eliminar logs temporales después de verificación)
4. ✅ Verificar que no aparecen logs de "Evento ya aplicado" para MASTER UNA_VEZ con CERTIFY

---

## 8) NOTAS TÉCNICAS

### 8.1 Execution Key con CERTIFY

**Formato:** `certify:{item_ref}:{student_uuid}:{timestamp}`

**Ejemplo:** `certify:limpieza-chakras:550e8400-e29b-41d4-a716-446655440000:2026-01-12T10-30-45-123Z`

**Unicidad:** Garantizada por timestamp completo (incluye milisegundos)

### 8.2 Idempotencia en CERTIFY

**CERTIFY NO es idempotente:**
- Cada ejecución genera un `execution_key` único
- El repositorio puede insertar múltiples eventos con diferentes `execution_key`
- No hay detección de duplicados por diseño

**Aplicación:**
- MASTER UNA_VEZ: Siempre ejecuta (sin límite diario)
- Acciones MASTER explícitas: Siempre ejecutan (botones "Marcar como hecho AHORA")

### 8.3 Logs Temporales

**Logs `[TEMP]` añadidos para diagnóstico:**
- `[TEMP] markCleanStudent entrada`
- `[TEMP] MASTER UNA_VEZ: usando CERTIFY`
- `[TEMP] execution_key generado`
- `[TEMP] evento insertado`
- `[TEMP] incrementAllStudents entrada`
- `[TEMP] incrementAll entrada`
- `[TEMP] incrementAll resultado`

**Acción Post-Verificación:**
- Eliminar todos los logs `[TEMP]` después de confirmar que funciona correctamente
- Mantener solo logs canónicos sin prefijo `[TEMP]`

---

## 9) REFERENCIAS

- **Execution Mode:** `docs/ALQUIMIA_EXECUTION_MODE_V1.md`
- **UNA_VEZ:** `docs/ALQUIMIA_UNA_VEZ_V1.md`
- **Alquimia Canónica:** `docs/ALQUIMIA_CANONICA_V1.md`
- **Cleaning Engine:** `src/core/master/services/cleaning-engine-service.js`
- **Alquimia General Service:** `src/services/alquimia-general-service.js`
- **API MASTER:** `src/endpoints/master-api-alquimia-general.js`
- **UI Client:** `public/js/master/master-alquimia-general-client.js`

---

**FIN DEL DOCUMENTO**
