# DIAGNÓSTICO CANÓNICO: Capability Registry v1

**Fecha:** 2025-01-XX  
**Modo:** DIAGNÓSTICO (NO IMPLEMENTACIÓN)  
**Objetivo:** Determinar si existe un Capability Registry canónico para Sources of Truth

---

## 1. RESUMEN EJECUTIVO

**VEREDICTO:** ✅ **OPCIÓN A** — Existe un Capability Registry canónico, pero **incompleto**.

AuriPortal tiene un registry canónico ubicado en `src/core/packages/source-of-truth-registry.js` que declara capabilities explícitas para cada Source of Truth (has_video, has_text, has_audio, is_checklist_capable, is_capturable, supports_level, supports_priority, supports_duration).

**Estado actual:**
- ✅ Registry canónico existe y está documentado
- ✅ Declara 7 tipos de SOT con capabilities
- ✅ Servicio de consumo existe (`pde-source-of-truth-registry.js`)
- ⚠️ **NO declara modos de comportamiento** (recurrent vs one_time_count)
- ⚠️ **NO declara si es ejecutable/asignable** explícitamente
- ⚠️ **Capacidades duplicadas** en PostgreSQL (`pde_catalog_registry`)

---

## 2. TABLA DE HALLAZGOS

| Archivo | Qué Declara | Qué Consume | Qué Falta |
|---------|-------------|-------------|-----------|
| `src/core/packages/source-of-truth-registry.js` | **Registry canónico** con 7 SOT:<br>- transmutaciones_energeticas<br>- tecnicas_limpieza<br>- decretos<br>- preparaciones<br>- practicas_post<br>- recursos_tecnicos_musica<br>- recursos_tecnicos_tonos<br><br>**Capabilities declaradas:**<br>- has_video<br>- has_text<br>- has_audio<br>- is_checklist_capable<br>- is_capturable<br>- supports_level<br>- supports_priority<br>- supports_duration | Consumido por:<br>- `src/services/pde-source-of-truth-registry.js`<br>- `src/endpoints/admin-packages-ui.js`<br>- `src/core/packages/package-engine.js` | ❌ Modos de comportamiento (recurrent, one_time_count)<br>❌ Si es ejecutable/asignable<br>❌ Si es "recurrente" en sentido UTE |
| `src/services/pde-source-of-truth-registry.js` | Servicio que **consume** el registry canónico<br>Expone:<br>- `getSourceCapabilities(sourceKey)`<br>- `listAvailableSources()`<br>- `isValidSource(sourceKey)` | Consumido por:<br>- Package Engine<br>- Admin UI (Package Creator) | N/A (es consumidor, no declara) |
| `database/migrations/v5.12.0-create-pde-catalog-registry.sql` | Tabla PostgreSQL `pde_catalog_registry` con campos:<br>- `supports_level`<br>- `supports_priority`<br>- `supports_duration`<br>- `usable_for_motors`<br>- `supports_obligatory` | Consumido por:<br>- `src/endpoints/admin-catalog-registry.js`<br>- `src/services/pde-motors-service.js`<br>- `src/scripts/seed-pde-catalog-registry.js` | ⚠️ **DUPLICACIÓN** con registry canónico<br>⚠️ No tiene has_video, has_text, has_audio, is_checklist_capable, is_capturable |
| `src/core/registry/step-type-registry.js` | Registry de **tipos de pasos** en recorridos:<br>- experience<br>- decision<br>- practice<br>- reflection<br>- closure<br>- motor<br><br>**NO es para SOT**, es para steps de recorridos | Consumido por:<br>- `src/core/recorridos/validate-recorrido-definition.js`<br>- `src/endpoints/admin-registry.js` | N/A (diferente dominio) |
| `docs/UTE_CORE_V1.md` | UTE define modos:<br>- `recurrent` (threshold_days)<br>- `one_time_count` (required_count)<br><br>**NO depende de tipos de SOT** | Consumido por:<br>- `src/services/ute-core-service.js`<br>- `src/endpoints/master-api-ute.js` | N/A (UTE es independiente de SOT) |

---

## 3. CAPACIDADES IMPLÍCITAS DETECTADAS

### 3.1. Lógica Condicional Basada en Tipo de SOT

**Archivo:** `src/services/tecnicas-limpieza-service.js`
```javascript
// Líneas 295-297
if (field === 'has_video' && condition.eq === true) {
  // Filtrado por has_video
} else if (field === 'has_audio' && condition.eq === true) {
  // Filtrado por has_audio
}
```
**Capacidad asumida:** `has_video` y `has_audio` existen como campos filtrables  
**Estado:** ✅ **Declarada** en `source-of-truth-registry.js`

---

### 3.2. Capacidades en PostgreSQL (Duplicación)

**Archivo:** `database/migrations/v5.12.0-create-pde-catalog-registry.sql`
```sql
supports_level BOOLEAN DEFAULT false,
supports_priority BOOLEAN DEFAULT false,
supports_duration BOOLEAN DEFAULT false,
```
**Capacidad asumida:** Estas capabilities existen en BD  
**Estado:** ⚠️ **DUPLICADA** — También está en `source-of-truth-registry.js`  
**Problema:** Dos fuentes de verdad para las mismas capabilities

---

### 3.3. Modos de Comportamiento (UTE)

**Archivo:** `src/services/ute-core-service.js`
```javascript
// Líneas 160-186
if (mode === 'recurrent') {
  // Lógica para recurrent
} else if (mode === 'one_time_count') {
  // Lógica para one_time_count
}
```
**Capacidad asumida:** UTE tiene modos `recurrent` y `one_time_count`  
**Estado:** ❌ **NO declarada** en `source-of-truth-registry.js`  
**Nota:** UTE es independiente de SOT, pero si un SOT fuera "ejecutable como UTE", necesitaría declarar su modo

---

### 3.4. Checklist Capable

**Archivo:** `src/core/packages/source-of-truth-registry.js`
```javascript
is_checklist_capable: true,  // Para transmutaciones_energeticas, tecnicas_limpieza, etc.
```
**Capacidad asumida:** Algunos SOT pueden usarse como checklist  
**Estado:** ✅ **Declarada** en registry canónico

---

### 3.5. Capturable

**Archivo:** `src/core/packages/source-of-truth-registry.js`
```javascript
is_capturable: true,  // Para transmutaciones_energeticas, tecnicas_limpieza, etc.
```
**Capacidad asumida:** Algunos SOT pueden marcarse como completados  
**Estado:** ✅ **Declarada** en registry canónico

---

## 4. ANÁLISIS DE UTE Y ENCARGOS

### 4.1. ¿UTE depende de algún tipo concreto de SOT?

**Respuesta:** ❌ **NO**

UTE es un sistema **independiente** de los tipos de SOT. UTE define sus propios modos (`recurrent`, `one_time_count`) que no están relacionados con si un SOT es "alchemy", "practice", "decree", etc.

**Evidencia:**
- `docs/UTE_CORE_V1.md` no menciona tipos de SOT
- `src/services/ute-core-service.js` no consulta `source-of-truth-registry.js`
- UTE trabaja con `ute_definitions` que son entidades propias, no SOT

---

### 4.2. ¿UTE asume capacidades implícitas?

**Respuesta:** ✅ **SÍ, pero propias de UTE**

UTE asume que:
- Un UTE puede ser `recurrent` (con `threshold_days`)
- Un UTE puede ser `one_time_count` (con `required_count`)
- Un UTE puede asignarse a `student`, `group`, `universe`, `all`

**Estado:** Estas capacidades están **declaradas** en:
- `database/migrations/v5.53.0-ute-core-v1.sql` (schema)
- `docs/UTE_CORE_V1.md` (documentación)

**NO están en `source-of-truth-registry.js`** porque UTE no es un SOT, es un sistema diferente.

---

### 4.3. ¿UTE podría consumir un Capability Registry sin cambios estructurales?

**Respuesta:** ⚠️ **PARCIALMENTE**

**Escenario A:** Si UTE fuera un "tipo de SOT ejecutable"
- Necesitaría: `mode: 'recurrent' | 'one_time_count'` en el registry
- Necesitaría: `is_ute_capable: true` en el registry
- **Cambio requerido:** Añadir capabilities de UTE al registry

**Escenario B:** Si UTE sigue siendo independiente (estado actual)
- **NO necesita** consumir el Capability Registry
- UTE tiene su propio sistema de modos y estados

**Conclusión:** UTE **NO necesita** el Capability Registry actual porque es un sistema diferente. Si en el futuro un SOT pudiera "ejecutarse como UTE", entonces sí necesitaría capabilities adicionales.

---

## 5. VEREDICTO FINAL

### ✅ OPCIÓN A: Existe un Capability Registry canónico (parcial)

**Ubicación exacta:**
- `src/core/packages/source-of-truth-registry.js` (registry canónico)
- `src/services/pde-source-of-truth-registry.js` (servicio consumidor)

**Qué declara:**
- ✅ 7 tipos de SOT con sus capabilities
- ✅ has_video, has_text, has_audio
- ✅ is_checklist_capable, is_capturable
- ✅ supports_level, supports_priority, supports_duration

**Qué le falta para cubrir el diseño actual:**

1. **❌ Modos de comportamiento:**
   - `mode: 'recurrent' | 'one_time_count' | null`
   - Si un SOT puede ejecutarse como UTE, necesita declarar su modo

2. **❌ Capacidades de ejecución/asignación:**
   - `is_ute_capable: boolean` — Si puede ejecutarse como UTE
   - `is_assignable: boolean` — Si puede asignarse a alumnos/grupos
   - `is_executable: boolean` — Si puede ejecutarse directamente

3. **❌ Superficies adicionales:**
   - `has_image: boolean` — Si puede tener imágenes
   - `has_document: boolean` — Si puede tener documentos
   - `has_interactive: boolean` — Si puede tener contenido interactivo

4. **⚠️ Duplicación con PostgreSQL:**
   - `pde_catalog_registry` tiene `supports_level`, `supports_priority`, `supports_duration`
   - Debería haber una sola fuente de verdad (el registry canónico)

---

## 6. PIEZAS PARCIALES EXISTENTES

### 6.1. Registry Canónico (Completo para su alcance actual)
- **Ubicación:** `src/core/packages/source-of-truth-registry.js`
- **Estado:** ✅ Funcional y consumido
- **Cobertura:** 7 SOT con 8 capabilities cada uno

### 6.2. Servicio Consumidor
- **Ubicación:** `src/services/pde-source-of-truth-registry.js`
- **Estado:** ✅ Funcional
- **Función:** Expone el registry a otros módulos

### 6.3. PostgreSQL (Duplicación)
- **Ubicación:** `pde_catalog_registry` table
- **Estado:** ⚠️ Duplica `supports_level`, `supports_priority`, `supports_duration`
- **Problema:** Dos fuentes de verdad para las mismas capabilities

### 6.4. UTE (Sistema Independiente)
- **Ubicación:** `src/services/ute-core-service.js`
- **Estado:** ✅ Funcional pero independiente
- **Nota:** NO consume el Capability Registry porque es un sistema diferente

---

## 7. CONCLUSIÓN

**VEREDICTO:** ✅ **OPCIÓN A** — Existe un Capability Registry canónico.

**Estado:**
- ✅ Registry canónico existe y funciona
- ✅ Declara capabilities explícitas para 7 SOT
- ⚠️ **Incompleto** — No declara modos de comportamiento ni capacidades de ejecución/asignación
- ⚠️ **Duplicación** — PostgreSQL tiene algunas capabilities duplicadas

**Recomendación (NO IMPLEMENTAR):**
1. El registry actual es suficiente para su propósito actual (Package Creator)
2. Si se necesita integrar UTE con SOT, añadir capabilities de modos
3. Resolver duplicación con PostgreSQL (registry canónico como única fuente de verdad)
4. Documentar qué capabilities son para qué propósito (UI, ejecución, asignación)

---

**FIN DEL DIAGNÓSTICO**
