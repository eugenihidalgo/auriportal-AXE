# RESUMEN EJECUTIVO — DIAGNÓSTICO ALQUIMIA UNA_VEZ v1
**AuriPortal / Aurelín — Dominio MASTER**  
**Fecha:** 2026-01-08

---

## HALLAZGOS CRÍTICOS (Top 3)

### 1. Seed inicializa `shared_remaining = 0` universalmente

**Ubicación:** `src/core/master/services/cleaning-state-seed-service.js` (línea 97)

**Problema:** El seed inicializa `shared_remaining = 0` para TODOS los items (recurrentes y `una_vez`), sin considerar:
- Si el item es `una_vez` o `recurrente`
- El valor de `veces_limpiar` del catálogo

**Impacto:** Items `una_vez` recién seedeados quedan con `remaining = 0`, lo que hace que `calculateItemState()` retorne `'reviewed'` (no limpiable). La UI no renderiza botón "Limpiar" porque `item.state === 'reviewed'`.

**Evidencia:**
- Query 3.3b: Todos los items `una_vez` tienen `shared_remaining = 0` y `shared_completed = 0`
- Código: `calculateItemState()` retorna `'reviewed'` si `remaining <= 0`

**Severidad:** CRÍTICO (impide uso)

---

### 2. Inconsistencia datos catálogo: `veces_limpiar = null` pero `frecuencia_dias = 20`

**Ubicación:** Tabla `items_transmutaciones` (lista "Pobreses", id=14)

**Problema:** 21 items en lista `una_vez` tienen:
- `veces_limpiar: null`
- `frecuencia_dias: 20`

Esto sugiere que estos items deberían ser recurrentes, pero están en una lista `una_vez`.

**Impacto:** El sistema no puede determinar correctamente si un item es "una vez" o "recurrente" basándose solo en el catálogo. Cuando `veces_limpiar = null`, el cleaning engine usa `required_count = 1` por defecto.

**Evidencia:**
- Query 3.2b: Lista "Pobreses" tiene 21 items, todos con `frecuencia_dias` pero sin `veces_limpiar`
- Código: `markCleanStudent()` usa `item.veces_limpiar || 1` como `required_count`

**Severidad:** ALTO (rompe semántica)

---

### 3. Lógica de cálculo de estado no distingue seed inicial vs completado

**Ubicación:** `src/core/master/services/alquimia-alumno-megalist-service.js` (función `calculateItemState`, líneas 66-80)

**Problema:** `calculateItemState()` no distingue entre:
- `remaining = 0` porque está completado (trabajado `veces_limpiar` veces)
- `remaining = 0` porque fue seedeado así (nunca trabajado)

**Impacto:** Items nunca trabajados aparecen como completados en la UI, ocultando el botón "Limpiar".

**Evidencia:**
- Código: `if (remaining <= 0) return 'reviewed'`
- No hay campo adicional que indique "nunca trabajado" vs "completado"

**Severidad:** MEDIO (UX)

---

## QUÉ FALTA PARA PODER REDACTAR ESTATUTO SIN RIESGOS

### 1. Definir semántica canónica de `veces_limpiar`

**Pregunta abierta:**
- ¿`veces_limpiar` significa "veces totales" o "veces por día/período"?
- ¿Si `veces_limpiar = null`, qué valor por defecto usar? (actualmente: 1)
- ¿Cómo se relaciona `veces_limpiar` con el modelo deseado de "pasado trabajado hoy, mañana disponible"?

**Acción requerida:** Decisión del Master sobre semántica canónica.

---

### 2. Normalizar datos del catálogo

**Pregunta abierta:**
- ¿Items en listas `una_vez` deben tener `frecuencia_dias = null`?
- ¿Items en listas `una_vez` deben tener `veces_limpiar` siempre definido?
- ¿Cómo migrar datos existentes (lista "Pobreses" con `frecuencia_dias = 20`)?

**Acción requerida:** Plan de migración de datos o decisión sobre normalización.

---

### 3. Definir comportamiento "reset diario"

**Pregunta abierta:**
- ¿El modelo deseado requiere que `remaining` se resetee automáticamente cada día?
- ¿O el reset es manual (cuando se trabaja el item)?
- ¿Cómo se relaciona esto con la idempotencia por día (vía `execution_key`)?

**Acción requerida:** Decisión del Master sobre comportamiento de reset.

---

### 4. Verificar si existe "override por alumno"

**Pregunta abierta:**
- ¿Existe tabla/metadata para overrides de `veces_limpiar` por alumno?
- ¿O esta funcionalidad debe implementarse desde cero?

**Acción requerida:** Auditar base de datos y código para verificar existencia de overrides.

---

### 5. Validar migración de estados existentes

**Pregunta abierta:**
- ¿Cómo migrar estados existentes con `remaining = 0` y `completed = 0`?
- ¿Deberían resetearse a `remaining = veces_limpiar || 1`?
- ¿O solo se aplica a estados futuros (seed)?

**Acción requerida:** Decisión sobre estrategia de migración.

---

## GAPS DETECTADOS (Resumen)

| Gap | Severidad | Ubicación | Impacto |
|-----|-----------|-----------|---------|
| Seed inicializa `remaining = 0` universalmente | CRÍTICO | `cleaning-state-seed-service.js:97` | Items `una_vez` no aparecen limpiables |
| Inconsistencia datos: `veces_limpiar = null`, `frecuencia_dias = 20` | ALTO | `items_transmutaciones` (lista 14) | Semántica ambigua |
| Lógica no distingue seed inicial vs completado | MEDIO | `alquimia-alumno-megalist-service.js:66-80` | UX confusa |
| No hay reset diario explícito | BAJO | N/A | UX podría ser más clara |

---

## RIESGOS IDENTIFICADOS

1. **Doble limpieza en un día:** Mitigado por idempotencia vía `execution_key` (formato diario)
2. **Estados inconsistentes:** Si se cambia seed, hay que migrar estados existentes
3. **Overrides no guardados:** NO CONSTA si existe funcionalidad de overrides

---

## SOLUCIONES PROPUESTAS (High-Level)

1. **Modificar seed:** Inicializar `remaining = veces_limpiar || 1` para items `una_vez`
2. **Migración de datos:** Actualizar estados existentes con `completed = 0` y `remaining = 0` → `remaining = veces_limpiar || 1`
3. **Normalizar catálogo:** Decidir si items `una_vez` deben tener `frecuencia_dias = null` o `veces_limpiar` siempre definido
4. **Documentar semántica:** Definir canónicamente qué significa `veces_limpiar` y cómo se relaciona con el modelo deseado

---

**FIN DEL RESUMEN EJECUTIVO**
