# DIAGNÓSTICO UNA_VEZ AS_IS v1
**AuriPortal / Aurelín — Dominio MASTER**  
**Fecha:** 2026-01-08  
**Tipo:** Diagnóstico automático estado actual

---

## RESUMEN EJECUTIVO

Diagnóstico automático del estado actual del sistema para items `tipo='una_vez'`:
- **Estado del catálogo:** 4 listas activas, 24 items activos
- **Estado del seed:** Inicializa `shared_remaining = 0` incorrectamente para items `una_vez`
- **Estado del cálculo:** Usa `remaining <= 0` para determinar `'reviewed'`, causando que items nunca trabajados aparezcan como completados
- **Estado de la UI:** Items `una_vez` no aparecen como limpiables porque quedan en estado `'reviewed'`

---

## 1. CLEANING_ITEM_STATE

### Campos relevantes para `una_vez`
- `shared_remaining`: Debe inicializarse con `veces_limpiar` del catálogo (actualmente se inicializa en 0)
- `shared_completed`: Debe ser calculado como `(shared_remaining === 0)` (actualmente se inicializa en 0)
- `shared_clean_count`: Número de veces que se ha limpiado (actualmente se inicializa en 0)

### Estado actual (query ejecutada: 2026-01-08)
- **Total estados `una_vez` para student_id=4:** 24
- **Items con `shared_remaining = 0`:** 24/24 (100%)
- **Items con `shared_completed = 0`:** 23/24
- **Items con `shared_completed = 1`:** 1/24 (te_item_114)

**Conclusión:** El seed inicializa incorrectamente todos los items `una_vez` con `remaining = 0`.

---

## 2. CLEANING_EVENTS

### Eventos para `una_vez` (student_id=4)
- **Total eventos:** 1 (solo para `te_item_114`)
- **Eventos múltiples por día:** 0 (idempotencia funciona correctamente)

**Conclusión:** La idempotencia vía `execution_key` funciona correctamente. No hay eventos duplicados.

---

## 3. ITEMS/LISTAS UNA_VEZ

### Listas activas
- id=3: "Registros y Karmas" (no aparece en detalle de items)
- id=4: "Karmas" (1 item, nivel 9, `veces_limpiar = 1`)
- id=9: "Limpiezas del hogar puntuales" (2 items, nivel 9, `veces_limpiar = 2`)
- id=14: "Pobreses" (21 items, nivel 1, `veces_limpiar = null`, `frecuencia_dias = 20`)

### Items activos
- **Total:** 24 items
- **Con `veces_limpiar` definido:** 3 items (listas 4 y 9)
- **Con `veces_limpiar = null`:** 21 items (lista 14)

**Conclusión:** Existe inconsistencia en datos: lista "Pobreses" tiene items con `frecuencia_dias = 20` pero `veces_limpiar = null`.

---

## 4. USO DE FRECUENCIA_DIAS EN UNA_VEZ

### Estado actual
- **Items `una_vez` con `frecuencia_dias`:** 21 items (lista "Pobreses")
- **Uso en código:** El código de `calculateItemState()` NO usa `frecuencia_dias` para items `una_vez`, solo para recurrentes.

**Conclusión:** `frecuencia_dias` debe ignorarse para items `una_vez`. El sistema actual lo ignora correctamente en el cálculo de estado, pero los datos del catálogo son inconsistentes.

---

## 5. RENDER ACTUAL DE ALQUIMIA ALUMNO

### Código actual (`master-alquimia-alumno-client.js`)
- **Línea 687:** `if (item.state !== 'reviewed')` → Renderiza botón "Limpiar"
- **Problema:** Items `una_vez` quedan con `state = 'reviewed'` porque `remaining = 0`
- **Resultado:** NO se renderiza botón "Limpiar"

**Conclusión:** La UI está correcta, pero el estado calculado es incorrecto debido al seed.

---

## 6. HISTORIAL Y REPORTES

### Historial (item-history endpoint)
- **Estado:** Funciona correctamente para items `una_vez` que tienen eventos
- **Paneles:** Técnico (colapsado) + Humano (visible)

### Reportes (report endpoint)
- **Estado:** Funciona correctamente
- **Paneles:** Técnico (colapsado) + Humano (visible, agrupado por listas)

**Conclusión:** Historial y reportes funcionan correctamente. No requieren cambios.

---

## CONCLUSIONES

1. **Seed incorrecto:** Inicializa `remaining = 0` para todos los items. Debe inicializar `remaining = veces_limpiar || 1` para items `una_vez`.
2. **Cálculo de estado:** Funciona correctamente, pero recibe datos incorrectos del seed.
3. **UI:** Funciona correctamente, pero no muestra items porque el estado calculado es incorrecto.
4. **Historial/Reportes:** Funcionan correctamente, no requieren cambios.
5. **Datos del catálogo:** Inconsistencia en lista "Pobreses" (tiene `frecuencia_dias` pero no `veces_limpiar`).

---

**FIN DEL DIAGNÓSTICO AS_IS**
