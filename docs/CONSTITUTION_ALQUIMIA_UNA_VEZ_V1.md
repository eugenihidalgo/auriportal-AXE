# CONSTITUCIÓN ALQUIMIA UNA_VEZ v1
**AuriPortal / Aurelín — Dominio MASTER**  
**Fecha:** 2026-01-08  
**Estado:** CANÓNICO

---

## REGLAS CONSTITUCIONALES

### 1. Seed de Estados

**REGLA:** Para items en listas `tipo='una_vez'`, el seed debe inicializar:
- `shared_remaining = COALESCE(veces_limpiar, 1)` (nunca 0)
- `shared_completed = 0` si `remaining > 0`, `1` si `remaining = 0`
- `shared_clean_count = 0`

**Para items recurrentes:**
- `shared_remaining = 0` (siempre)
- `shared_completed = 0`
- `shared_clean_count = 0`

**Ubicación:** `src/core/master/services/cleaning-state-seed-service.js`

---

### 2. Cálculo de Estado

**REGLA:** El estado de un item `una_vez` se calcula como:
- `'never'`: `remaining > 0` y `clean_count = 0` (nunca trabajado)
- `'pending'`: `remaining > 0` y `clean_count > 0` (parcialmente trabajado)
- `'reviewed'`: `remaining <= 0` o `completed > 0` (completado)

**Ubicación:** `src/core/master/services/alquimia-alumno-megalist-service.js` (función `calculateItemState`)

---

### 3. Limpiezas Múltiples

**REGLA:** Los items `una_vez` permiten limpiezas múltiples sin límite diario.

- No hay restricción "una vez por día" en el engine base
- La idempotencia vía `execution_key` previene duplicados en el mismo día, pero NO bloquea limpiezas en días distintos
- Cada limpieza incrementa `clean_count` y decrementa `remaining`
- `remaining` puede llegar a 0 (completado) o negativo (más de lo requerido)

**Ubicación:** `src/core/master/services/cleaning-engine-service.js` (función `markCleanStudent`)

---

### 4. Actualización de Estado

**REGLA:** Al limpiar un item `una_vez`:
- Incrementar `shared_clean_count`
- Decrementar `shared_remaining` (clamp a 0)
- Recalcular `shared_completed = (shared_remaining <= 0 ? 1 : 0)`

**Ubicación:** `src/infra/repos/cleaning/cleaning-item-state-repo-pg.js` (función `upsertApplyOneTimeIncrementShared`)

---

### 5. UI - Botón Limpiar

**REGLA:** Para items `una_vez`, el botón "Limpiar" está SIEMPRE visible y activo, incluso si el item ya está trabajado.

**Para items recurrentes:**
- Botón solo visible si `state !== 'reviewed'`

**Ubicación:** `public/js/master/master-alquimia-alumno-client.js` (función `renderItem`)

---

### 6. UI - Progreso

**REGLA:** Para items `una_vez`, mostrar progreso como `realizadas / requeridas`:
- `realizadas = shared_clean_count`
- `requeridas = veces_limpiar || 1`

**Marca visual:** Si `realizadas > 0`, mostrar "✓ Trabajado" (sin ocultar el item).

**Ubicación:** `public/js/master/master-alquimia-alumno-client.js` (función `renderItem`)

---

### 7. frecuencia_dias en una_vez

**REGLA:** Para items en listas `tipo='una_vez'`, `frecuencia_dias` debe ignorarse.

- Solo se usa `veces_limpiar` para determinar `shared_remaining`
- Si `veces_limpiar = null`, usar `1` como fallback
- `frecuencia_dias` puede existir en el catálogo por compatibilidad, pero NO se usa en el cálculo

---

### 8. Historial y Reportes

**REGLA:** Historial y reportes funcionan igual para items `una_vez` y recurrentes:
- Panel técnico: colapsado por defecto, muestra eventos raw
- Panel humano: visible por defecto, agrupado por listas, muestra nombres legibles

**Exclusión de archivados:** Items/listas con `status='archived'` NO aparecen en panel humano (solo en técnico si tienen eventos históricos).

---

### 9. Legacy veces_limpiar null

**REGLA:** Si un item `una_vez` tiene `veces_limpiar = null`, usar `1` como valor por defecto.

**Impacto:** El seed inicializará `shared_remaining = 1` en lugar de `0`.

---

### 10. Rol Master en Alquimia General

**REGLA:** Master puede limpiar cualquier item a cualquier alumno, sin validación de nivel.

**Flotante de alumnos:**
- SIEMPRE muestra todos los alumnos (nunca filtra por nivel)
- Master puede limpiar items de cualquier nivel a cualquier alumno
- No hay restricción de aplicabilidad por nivel

**Limpieza desde flotante:**
- Payload debe incluir: `item_kind`, `domain_type`, `actor_type='master'`, `surface_key='master.alquimia_general'`
- Backend bypassa validación de nivel si `actor_type === 'master'` y `surface_key === 'master.alquimia_general'`

**Ubicación:**
- Frontend: `public/js/master/master-alquimia-general-client.js` (función `handleLimpiarEstudiante`)
- Backend: `src/core/master/services/cleaning-engine-service.js` (función `markCleanStudent`)
- Servicio: `src/services/alquimia-general-service.js` (función `getStudentsForItem` con `skip_level_filter=true`)

---

## PROHIBICIONES

1. **Prohibido:** Inicializar `shared_remaining = 0` para items `una_vez` en el seed
2. **Prohibido:** Ocultar botón "Limpiar" para items `una_vez` trabajados
3. **Prohibido:** Usar `frecuencia_dias` para calcular estado de items `una_vez`
4. **Prohibido:** Introducir límite diario de limpiezas en el engine base (la idempotencia por día es suficiente)

---

## REFERENCIAS

- Diagnóstico: `docs/DIAGNOSTICO_ALQUIMIA_UNA_VEZ_V1.md`
- Engine: `src/core/master/services/cleaning-state-seed-service.js`
- Cálculo: `src/core/master/services/alquimia-alumno-megalist-service.js`
- UI: `public/js/master/master-alquimia-alumno-client.js`

---

**FIN DE CONSTITUCIÓN**
