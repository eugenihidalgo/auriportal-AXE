# RESUMEN EJECUTIVO - DIAGNÓSTICO ALQUIMIA v1
**Fecha:** 2026-01-XX  
**Objetivo:** Radiografía completa del sistema de Alquimia (catálogos, clasificaciones, niveles, Cleaning Engine, render)

---

## 📋 RESUMEN EJECUTIVO

Este diagnóstico mapea la realidad actual del sistema de Alquimia sin proponer implementaciones. Se identificaron puntos canónicos, legacy, ambigüedades y decisiones futuras requeridas.

---

## ✅ QUÉ ESTÁ BIEN (CANÓNICO Y ESTABLE)

### 1. Catálogos de Transmutaciones
- ✅ `listas_transmutaciones` y `items_transmutaciones` estructuradas y con constraints
- ✅ `item_ref` como puente canónico a `cleaning_item_state`
- ✅ `status` ('active'/'archived') como soft delete canónico
- ✅ Campos críticos (`nivel`, `frecuencia_dias`, `veces_limpiar`, `priority`) definidos

### 2. Sistema de Clasificaciones
- ✅ `pde_classification_terms` como SOT global normalizado
- ✅ `transmutacion_lista_classifications` como tabla de relación canónica
- ✅ Helper idempotente `ensureClassificationTerm()` centralizado
- ✅ Proyección canónica desde términos hacia listas

### 3. Cleaning Engine v1
- ✅ `cleaning_events` como event log append-only
- ✅ `cleaning_item_state` como proyección canónica
- ✅ Dos capas claras (SHARED vs PDE)
- ✅ Idempotencia vía `execution_key`

### 4. Niveles y Filtrado
- ✅ `nivel_efectivo` viene de Level Engine PDE v1 (canónico)
- ✅ Filtrado por nivel funciona: `item.nivel > nivel_efectivo` → NO APLICA
- ✅ `getStudentEffectiveLevel()` como función canónica única

---

## ❌ QUÉ NO ES CANÓNICO (LEGACY Y AMBIGÜEDADES)

### 1. Campos Legacy Duplicados
- ❌ `activo` (BOOLEAN) vs `status` (VARCHAR) - ambos existen, código usa `WHERE (status = 'active' OR activo = true)`
- ❌ `category_key`, `subtype_key`, `tags` (JSONB) en `listas_transmutaciones` - deprecados pero se mantienen por compatibilidad
- ❌ `orden` en items no se usa (se usa `priority` o `nivel, created_at`)

### 2. Repositorio Legacy Desconectado
- ❌ `PdeTransmutationClassificationRepoPg` usa tablas legacy (`pde_transmutation_categories`, etc.) - **no se usa** en código actual
- ⚠️ **AMBIGÜEDAD:** No está claro si se usa en otro lugar o es código muerto

### 3. Contrato de Ordenamiento Ambiguo
- ⚠️ Documentado: `ORDER BY nivel ASC, created_at ASC`
- ⚠️ Existe: `priority` (migración v5.47.0)
- ❌ **NO HAY CONTRATO CLARO** de cuál se usa realmente

### 4. Campo `critical_multiplier` No Existe en Schema
- ⚠️ Detectado en código: `item.critical_multiplier || 2.0`
- ❌ **NO EXISTE** en migraciones ni schema visible
- Probablemente metadata JSONB o campo no migrado

---

## ⚠️ QUÉ ESTÁ MEZCLADO (SIN SEPARACIÓN CLARA)

### 1. Catálogo vs Estado
- ⚠️ **Gap masivo:** 95.7% de items sin estado en `cleaning_item_state` (112 de 117 items para student_id=4)
- ⚠️ Seed de estados no se ejecuta automáticamente
- ⚠️ No hay contrato de cuándo se debe seedear estados

### 2. Clasificaciones vs Lógica
- ⚠️ Clasificaciones son solo **metadata** (no afectan lógica de limpieza)
- ⚠️ Tags emiten señales pero **no hay automatizaciones** que las consuman
- ⚠️ Alquimia Alumno **no usa clasificaciones** (solo filtra por nivel)

### 3. Alquimia General vs Alumno
- ⚠️ Comparten catálogo pero **filtran distinto**:
  - Alquimia General: Filtra por `status='active'` + nivel + `clean_layer`
  - Alquimia Alumno: Filtra por `nivel_efectivo` + usa `student_item_state` (legacy) o `cleaning_item_state`
- ⚠️ **Duplicación:** Ambos calculan estados (`reviewed`/`pending`/`important`) con lógica similar pero separada

### 4. Cleaning Engine vs student_item_state
- ⚠️ Cleaning Engine v1 usa `cleaning_item_state` (canónico)
- ⚠️ Alquimia Alumno todavía lee desde `student_item_state` (legacy)
- ⚠️ **Compatibilidad mantenida:** Cleaning Engine sincroniza a `student_item_state` si `clean_layer='shared'`

---

## 🔴 QUÉ REQUIERE DECISIÓN FUTURA

### 1. Eliminación de Legacy
- **Campos:** ¿Cuándo eliminar `activo`, `category_key`, `subtype_key`, `tags` (JSONB)?
- **Repositorio:** ¿Eliminar `PdeTransmutationClassificationRepoPg` o migrarlo?
- **Contrato:** ¿Documentar plan de eliminación con fecha?

### 2. Contrato de Ordenamiento
- **Decisión:** ¿`priority` o `nivel, created_at`? Documentar y estandarizar.
- **Migración:** Si se usa `priority`, eliminar ordenamiento por `nivel, created_at`.

### 3. Campo `critical_multiplier`
- **Investigación:** ¿Existe en metadata JSONB? ¿Migrar a columna?
- **Decisión:** Si no existe, añadir a schema o usar default 2.0.

### 4. Seed de Estados
- **Decisión:** ¿Cuándo se ejecuta seed? ¿Automático en endpoint? ¿Manual?
- **Contrato:** Documentar cuándo/cómo se seedean estados faltantes.

### 5. Clasificaciones en Lógica
- **Decisión:** ¿Deberían afectar filtrado en Cleaning Engine/Alquimia Alumno?
- **Ejemplo:** ¿Filtrar por category/subtype en UI de limpieza?

### 6. Automatizaciones con Tags
- **Decisión:** ¿Implementar automatizaciones que consuman señales `tag.attached`/`tag.detached`?
- **Plan:** Si sí, documentar casos de uso.

### 7. Contratos de Tipo y Estado
- **Decisión:** ¿Añadir constraints para verificar consistencia `lista.tipo` ↔ campos de item?
- **Decisión:** ¿Añadir triggers para archivar items cuando se archiva lista?

---

## 📊 MAPA DE ENSAMBLAJE

### Flujo Canónico: Catálogo → Estado → Render

```
┌─────────────────────────────────────────────────────────────┐
│ 1. CATÁLOGO (Source of Truth)                               │
│    - listas_transmutaciones (tipo, status='active')         │
│    - items_transmutaciones (nivel, frecuencia_dias, etc.)   │
│    - pde_classification_terms (metadata)                    │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. FILTRADO POR NIVEL                                        │
│    - nivel_efectivo (Level Engine PDE v1)                   │
│    - item.nivel > nivel_efectivo → NO APLICA                │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. ESTADO (Cleaning Engine v1)                              │
│    - cleaning_item_state (proyección)                       │
│    - cleaning_events (event log)                            │
│    - Seed faltante → gap masivo (95.7%)                     │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. CÁLCULO DE ESTADOS                                       │
│    - recurrente: reviewed/pending/important (threshold_days)│
│    - una_vez: completed/pending (remaining)                 │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. RENDER (UI)                                              │
│    - Alquimia General: Listas + Items + Estudiantes         │
│    - Alquimia Alumno: Megalista filtrada por alumno         │
│    - Theme Resolver: Capabilities semánticas                │
└─────────────────────────────────────────────────────────────┘
```

### Puntos de Ambiguidad (sin contrato)

1. **Seed de estados:** ¿Cuándo se ejecuta?
2. **Ordenamiento:** ¿`priority` o `nivel, created_at`?
3. **Legacy:** ¿Cuándo eliminar campos deprecados?
4. **Clasificaciones:** ¿Afectan lógica o solo metadata?
5. **Alquimia General vs Alumno:** ¿Unificar lógica de cálculo de estados?

---

## 🎯 HALLAZGOS CRÍTICOS

### 1. Gap Masivo de Estados
- **95.7% de items sin estado** en `cleaning_item_state` (112 de 117 items)
- **Impacto:** Panel Alquimia Alumno muestra solo 5 items en lugar de todos los aplicables
- **Causa:** Seed no se ejecuta automáticamente
- **Recomendación:** Implementar seed automático o documentar cuándo ejecutarlo

### 2. Campos Legacy Duplicados
- `status` vs `activo` - ambos existen, código usa ambos
- `category_key`, `subtype_key`, `tags` (JSONB) - deprecados pero mantenidos
- **Impacto:** Confusión sobre cuál es fuente de verdad
- **Recomendación:** Documentar plan de eliminación o eliminar ahora

### 3. Contrato de Ordenamiento Ambiguo
- Documentado: `ORDER BY nivel ASC, created_at ASC`
- Existe: `priority` (migración v5.47.0)
- **Impacto:** Incertidumbre sobre qué se usa realmente
- **Recomendación:** Decidir y estandarizar

### 4. Clasificaciones No Afectan Lógica
- Tags emiten señales pero no hay automatizaciones
- Alquimia Alumno no usa clasificaciones
- **Pregunta:** ¿Deberían afectar lógica o son solo metadata?

---

## 📚 DOCUMENTOS CREADOS

1. **`DIAGNOSTICO_CATALOGO_ALQUIMIA_V1.md`** - FASE A completada
2. **`DIAGNOSTICO_CLASIFICACIONES_ALQUIMIA_V1.md`** - FASE B completada
3. **`RESUMEN_DIAGNOSTICO_ALQUIMIA_V1.md`** - Este documento (consolidado)

---

## 🔄 FASES PENDIENTES (Resumen Consolidado)

### FASE C - Niveles y Alumnos
**Hallazgos principales:**
- `nivel_efectivo` viene de Level Engine PDE v1 (canónico)
- Filtrado: `item.nivel > nivel_efectivo` → NO APLICA
- `getStudentEffectiveLevel()` es función canónica única
- `nivel_actual` es legacy (no usar)

### FASE D - Cleaning Engine
**Hallazgos principales:**
- `cleaning_events` es event log append-only (SOT histórico)
- `cleaning_item_state` es proyección canónica (lectura rápida)
- Dos capas: SHARED (visible alumno) vs PDE (master-only)
- Gap masivo: 95.7% items sin estado (seed faltante)

### FASE E - Alquimia General vs Alumno
**Hallazgos principales:**
- Comparten catálogo pero filtran distinto
- Alquimia General: `clean_layer` (shared/pde), múltiples estudiantes
- Alquimia Alumno: un estudiante, usa `student_item_state` (legacy) o `cleaning_item_state`
- Duplicación de lógica de cálculo de estados

### FASE F - Render y Theme Resolver
**Hallazgos principales:**
- Theme Resolver v1 resuelve capabilities semánticas
- UI es capability-first (no hardcodea estilos)
- `applyTheme()` usa Theme Resolver para tokens CSS
- Render canónico: `renderMasterPage()` para MASTER

### FASE G - Mapa de Ensamblaje
**Hallazgos principales:**
- Flujo: Catálogo → Filtrado por nivel → Estado → Cálculo → Render
- Puntos de ambigüedad: seed, ordenamiento, legacy, clasificaciones
- Sin contratos formales en varios puntos críticos

---

## ✅ CONCLUSIÓN

El sistema tiene una base canónica sólida (catálogos, clasificaciones, Cleaning Engine, niveles) pero presenta ambigüedades y legacy que requieren decisiones futuras. El gap más crítico es la falta de seed automático de estados (95.7% items sin estado).

**Próximos pasos recomendados (NO IMPLEMENTADOS):**
1. Documentar contratos formales para puntos ambiguos
2. Decidir plan de eliminación de legacy
3. Implementar seed automático de estados o documentar cuándo ejecutarlo
4. Estandarizar ordenamiento (priority vs nivel+created_at)
5. Decidir si clasificaciones afectan lógica o son solo metadata

---

**Fin del diagnóstico completo**
