# AUDITORÍA DE OWNERSHIP - POSTGRESQL
## AuriPortal - Diagnóstico de Ownership Legacy

**Fecha de Auditoría**: 2025-12-26  
**Usuario PostgreSQL Actual**: `aurelinportal`  
**Database**: `aurelinportal`  
**Total de Tablas**: 185  
**Tablas con Ownership Incorrecto**: 98

---

## 📊 RESUMEN EJECUTIVO

### Usuario PostgreSQL Actual
- **current_user**: `aurelinportal`
- **current_database**: `aurelinportal`
- **session_user**: `aurelinportal`

### Estado de Ownership
- ✅ **Tablas con ownership correcto**: 87 (47%)
- ⚠️ **Tablas con ownership incorrecto**: 98 (53%)
  - **Owner actual**: `postgres`
  - **Owner esperado**: `aurelinportal`

### Problema Identificado
Las tablas con ownership `postgres` impiden que el usuario `aurelinportal` ejecute operaciones `ALTER TABLE` y `DROP TABLE` en migraciones, causando errores como:
```
error: must be owner of table protecciones_energeticas
```

---

## 📋 TABLAS CON OWNERSHIP INCORRECTO

### Clasificación: ACTIVAS vs LEGACY

#### 🔴 TABLAS ACTIVAS (SOT o Runtime) - REQUIEREN REMEDIACIÓN

Estas tablas son parte del Source of Truth o se usan en runtime y **DEBEN** tener ownership correcto:

| Tabla | Owner Actual | Owner Esperado | Uso Actual | Riesgo | Recomendación |
|-------|--------------|----------------|------------|--------|---------------|
| `protecciones_energeticas` | `postgres` | `aurelinportal` | Runtime (servicio activo) | 🔴 ALTO | **CAMBIAR OWNER** |
| `alumnos` | `postgres` | `aurelinportal` | SOT Principal | 🔴 CRÍTICO | **CAMBIAR OWNER** |
| `automation_jobs` | `postgres` | `aurelinportal` | Runtime (Automation Engine) | 🔴 ALTO | **CAMBIAR OWNER** |
| `automation_locks` | `postgres` | `aurelinportal` | Runtime (Automation Engine) | 🔴 ALTO | **CAMBIAR OWNER** |
| `automation_rules` | `postgres` | `aurelinportal` | Runtime (Automation Engine) | 🔴 ALTO | **CAMBIAR OWNER** |
| `automation_runs` | `postgres` | `aurelinportal` | Runtime (Automation Engine) | 🔴 ALTO | **CAMBIAR OWNER** |
| `signal_definitions` | `postgres` | `aurelinportal` | SOT (Señales Registry) | 🔴 CRÍTICO | **CAMBIAR OWNER** |
| `signal_aggregates` | `postgres` | `aurelinportal` | Runtime (Analytics) | 🔴 ALTO | **CAMBIAR OWNER** |
| `audit_events` | `postgres` | `aurelinportal` | SOT (Auditoría) | 🔴 CRÍTICO | **CAMBIAR OWNER** |
| `audit_log` | `postgres` | `aurelinportal` | SOT (Auditoría) | 🔴 CRÍTICO | **CAMBIAR OWNER** |
| `recorridos` | `postgres` | `aurelinportal` | Runtime (Recorridos PDE) | 🔴 ALTO | **CAMBIAR OWNER** |
| `recorrido_versions` | `postgres` | `aurelinportal` | Runtime (Recorridos PDE) | 🔴 ALTO | **CAMBIAR OWNER** |
| `recorrido_runs` | `postgres` | `aurelinportal` | Runtime (Recorridos PDE) | 🔴 ALTO | **CAMBIAR OWNER** |
| `recorrido_events` | `postgres` | `aurelinportal` | Runtime (Recorridos PDE) | 🔴 ALTO | **CAMBIAR OWNER** |
| `recorrido_step_results` | `postgres` | `aurelinportal` | Runtime (Recorridos PDE) | 🔴 ALTO | **CAMBIAR OWNER** |
| `recorrido_audit_log` | `postgres` | `aurelinportal` | SOT (Auditoría Recorridos) | 🔴 ALTO | **CAMBIAR OWNER** |
| `recorrido_drafts` | `postgres` | `aurelinportal` | Runtime (Editor Recorridos) | 🔴 ALTO | **CAMBIAR OWNER** |
| `pde_motors` | `postgres` | `aurelinportal` | Runtime (PDE Motors) | 🔴 ALTO | **CAMBIAR OWNER** |
| `navigation_definitions` | `postgres` | `aurelinportal` | Runtime (Navegación) | 🔴 ALTO | **CAMBIAR OWNER** |
| `navigation_versions` | `postgres` | `aurelinportal` | Runtime (Navegación) | 🔴 ALTO | **CAMBIAR OWNER** |
| `navigation_drafts` | `postgres` | `aurelinportal` | Runtime (Editor Navegación) | 🔴 ALTO | **CAMBIAR OWNER** |
| `navigation_audit_log` | `postgres` | `aurelinportal` | SOT (Auditoría Navegación) | 🔴 ALTO | **CAMBIAR OWNER** |
| `feature_flags` | `aurelinportal` | `aurelinportal` | ✅ SOT (Feature Flags) | ✅ OK | Ya correcto |
| `modulos_sistema` | `postgres` | `aurelinportal` | Runtime (Módulos Sistema) | 🔴 ALTO | **CAMBIAR OWNER** |
| `practice_signals` | `postgres` | `aurelinportal` | Runtime (Señales de Prácticas) | 🔴 ALTO | **CAMBIAR OWNER** |
| `reflexiones` | `postgres` | `aurelinportal` | Runtime (Reflexiones Alumnos) | 🔴 ALTO | **CAMBIAR OWNER** |
| `practicas_audio` | `postgres` | `aurelinportal` | Runtime (Audios Transcritos) | 🔴 ALTO | **CAMBIAR OWNER** |
| `analytics_events` | `postgres` | `aurelinportal` | Runtime (Analytics) | 🔴 ALTO | **CAMBIAR OWNER** |
| `energy_events` | `postgres` | `aurelinportal` | Runtime (Eventos Energéticos) | 🔴 ALTO | **CAMBIAR OWNER** |
| `energy_subject_state` | `postgres` | `aurelinportal` | Runtime (Estado Energético) | 🔴 ALTO | **CAMBIAR OWNER** |
| `energy_subject_stats_rolling` | `postgres` | `aurelinportal` | Runtime (Stats Energéticos) | 🔴 ALTO | **CAMBIAR OWNER** |

**Total de tablas ACTIVAS a remediar**: ~30-35 (estimado, requiere verificación de uso en código)

#### 🟡 TABLAS LEGACY AISLADAS - NO REQUIEREN REMEDIACIÓN INMEDIATA

Estas tablas no se usan en runtime o son legacy. Pueden mantenerse con ownership `postgres` hasta migración futura:

| Tabla | Owner Actual | Uso Actual | Riesgo | Recomendación |
|-------|--------------|------------|--------|---------------|
| `altares` | `postgres` | Legacy / Desconocido | 🟡 BAJO | **DECLARAR LEGACY** |
| `altares_items` | `postgres` | Legacy / Desconocido | 🟡 BAJO | **DECLARAR LEGACY** |
| `amistades` | `postgres` | Legacy / Desconocido | 🟡 BAJO | **DECLARAR LEGACY** |
| `arquetipos` | `postgres` | Legacy / Desconocido | 🟡 BAJO | **DECLARAR LEGACY** |
| `arquetipos_alumnos` | `postgres` | Legacy / Desconocido | 🟡 BAJO | **DECLARAR LEGACY** |
| `aspectos_energeticos` | `postgres` | Posiblemente activo | 🟡 MEDIO | **VERIFICAR USO** |
| `aspectos_energeticos_alumnos` | `postgres` | Posiblemente activo | 🟡 MEDIO | **VERIFICAR USO** |
| `aspectos_energeticos_registros` | `postgres` | Posiblemente activo | 🟡 MEDIO | **VERIFICAR USO** |
| `auribosses` | `postgres` | Legacy / Desconocido | 🟡 BAJO | **DECLARAR LEGACY** |
| `auribosses_alumnos` | `postgres` | Legacy / Desconocido | 🟡 BAJO | **DECLARAR LEGACY** |
| `auriclock_registro` | `postgres` | Legacy / Desconocido | 🟡 BAJO | **DECLARAR LEGACY** |
| `aurimapa_alumnos` | `postgres` | Legacy / Desconocido | 🟡 BAJO | **DECLARAR LEGACY** |
| `aurimapa_nodos` | `postgres` | Legacy / Desconocido | 🟡 BAJO | **DECLARAR LEGACY** |
| `avatar_alumnos` | `postgres` | Legacy / Desconocido | 🟡 BAJO | **DECLARAR LEGACY** |
| `avatar_estados` | `postgres` | Legacy / Desconocido | 🟡 BAJO | **DECLARAR LEGACY** |
| `carta_astral` | `postgres` | Legacy / Desconocido | 🟡 BAJO | **DECLARAR LEGACY** |
| `circulos_auri` | `postgres` | Legacy / Desconocido | 🟡 BAJO | **DECLARAR LEGACY** |
| `circulos_auri_metricas` | `postgres` | Legacy / Desconocido | 🟡 BAJO | **DECLARAR LEGACY** |
| `circulos_auri_miembros` | `postgres` | Legacy / Desconocido | 🟡 BAJO | **DECLARAR LEGACY** |
| `content_overrides` | `postgres` | Posiblemente activo | 🟡 MEDIO | **VERIFICAR USO** |
| `creacion_objetivos` | `postgres` | Legacy / Desconocido | 🟡 BAJO | **DECLARAR LEGACY** |
| `creacion_problemas_iniciales` | `postgres` | Legacy / Desconocido | 🟡 BAJO | **DECLARAR LEGACY** |
| `creacion_version_futura` | `postgres` | Legacy / Desconocido | 🟡 BAJO | **DECLARAR LEGACY** |
| `cumpleaños_eventos` | `postgres` | Legacy / Desconocido | 🟡 BAJO | **DECLARAR LEGACY** |
| `diario_practicas` | `postgres` | Legacy / Desconocido | 🟡 BAJO | **DECLARAR LEGACY** |
| `disenohumano` | `postgres` | Legacy / Desconocido | 🟡 BAJO | **DECLARAR LEGACY** |
| `emocional_ano` | `postgres` | Legacy / Desconocido | 🟡 BAJO | **DECLARAR LEGACY** |
| `eventos_globales` | `postgres` | Legacy / Desconocido | 🟡 BAJO | **DECLARAR LEGACY** |
| `historias` | `postgres` | Legacy / Desconocido | 🟡 BAJO | **DECLARAR LEGACY** |
| `historias_alumnos` | `postgres` | Legacy / Desconocido | 🟡 BAJO | **DECLARAR LEGACY** |
| `ideas_practicas` | `postgres` | Legacy / Desconocido | 🟡 BAJO | **DECLARAR LEGACY** |
| `informes_semanales` | `postgres` | Legacy / Desconocido | 🟡 BAJO | **DECLARAR LEGACY** |
| `logros` | `postgres` | Legacy / Desconocido | 🟡 BAJO | **DECLARAR LEGACY** |
| `logros_definicion` | `postgres` | Legacy / Desconocido | 🟡 BAJO | **DECLARAR LEGACY** |
| `maestro_conversaciones` | `postgres` | Legacy / Desconocido | 🟡 BAJO | **DECLARAR LEGACY** |
| `maestro_insights` | `postgres` | Legacy / Desconocido | 🟡 BAJO | **DECLARAR LEGACY** |
| `master_notifications` | `postgres` | Legacy / Desconocido | 🟡 BAJO | **DECLARAR LEGOS** |
| `mensajes_especiales` | `postgres` | Legacy / Desconocido | 🟡 BAJO | **DECLARAR LEGACY** |
| `misiones` | `postgres` | Legacy / Desconocido | 🟡 BAJO | **DECLARAR LEGACY** |
| `misiones_alumnos` | `postgres` | Legacy / Desconocido | 🟡 BAJO | **DECLARAR LEGACY** |
| `notificaciones_preferencias` | `postgres` | Legacy / Desconocido | 🟡 BAJO | **DECLARAR LEGACY** |
| `pattern_definitions` | `postgres` | Legacy / Desconocido | 🟡 BAJO | **DECLARAR LEGACY** |
| `pde_packages_backup_before_legacy_delete` | `postgres` | Backup Legacy | 🟡 BAJO | **DECLARAR LEGACY** |
| `portal_messages` | `postgres` | Legacy / Desconocido | 🟡 BAJO | **DECLARAR LEGACY** |
| `post_practice_flows` | `postgres` | Legacy / Desconocido | 🟡 BAJO | **DECLARAR LEGACY** |
| `practicas_compasion` | `postgres` | Legacy / Desconocido | 🟡 BAJO | **DECLARAR LEGACY** |
| `practicas_conjuntas` | `postgres` | Legacy / Desconocido | 🟡 BAJO | **DECLARAR LEGACY** |
| `practicas_horario` | `postgres` | Legacy / Desconocido | 🟡 BAJO | **DECLARAR LEGACY** |
| `quests` | `postgres` | Legacy / Desconocido | 🟡 BAJO | **DECLARAR LEGACY** |
| `quests_alumnos` | `postgres` | Legacy / Desconocido | 🟡 BAJO | **DECLARAR LEGACY** |
| `sellos_alumnos` | `postgres` | Legacy / Desconocido | 🟡 BAJO | **DECLARAR LEGACY** |
| `sellos_ascension` | `postgres` | Legacy / Desconocido | 🟡 BAJO | **DECLARAR LEGACY** |
| `skilltree_nodos` | `postgres` | Legacy / Desconocido | 🟡 BAJO | **DECLARAR LEGACY** |
| `skilltree_progreso` | `postgres` | Legacy / Desconocido | 🟡 BAJO | **DECLARAR LEGACY** |
| `sorpresas` | `postgres` | Legacy / Desconocido | 🟡 BAJO | **DECLARAR LEGACY** |
| `sorpresas_alumnos` | `postgres` | Legacy / Desconocido | 🟡 BAJO | **DECLARAR LEGACY** |
| `student_modes` | `postgres` | Legacy / Desconocido | 🟡 BAJO | **DECLARAR LEGACY** |
| `student_patterns` | `postgres` | Legacy / Desconocido | 🟡 BAJO | **DECLARAR LEGACY** |
| `tarot_cartas` | `postgres` | Legacy / Desconocido | 🟡 BAJO | **DECLARAR LEGACY** |
| `tarot_interpretaciones` | `postgres` | Legacy / Desconocido | 🟡 BAJO | **DECLARAR LEGACY** |
| `tarot_sesiones` | `postgres` | Legacy / Desconocido | 🟡 BAJO | **DECLARAR LEGACY** |
| `tokens_auri` | `postgres` | Legacy / Desconocido | 🟡 BAJO | **DECLARAR LEGACY** |
| `tokens_transacciones` | `postgres` | Legacy / Desconocido | 🟡 BAJO | **DECLARAR LEGACY** |
| `ui_active_config` | `postgres` | Legacy / Desconocido | 🟡 BAJO | **DECLARAR LEGACY** |
| `ui_conversation_scripts` | `postgres` | Legacy / Desconocido | 🟡 BAJO | **DECLARAR LEGACY** |
| `ui_layers` | `postgres` | Legacy / Desconocido | 🟡 BAJO | **DECLARAR LEGACY** |
| `ui_screens` | `postgres` | Legacy / Desconocido | 🟡 BAJO | **DECLARAR LEGACY** |
| `ui_themes` | `postgres` | Legacy / Desconocido | 🟡 BAJO | **DECLARAR LEGACY** |
| `alumnos_disponibilidad` | `postgres` | Posiblemente activo | 🟡 MEDIO | **VERIFICAR USO** |

**Total de tablas LEGACY**: ~60-65 (estimado)

---

## 🎯 RECOMENDACIONES

### Fase Inmediata (Remediación Crítica)
1. **Cambiar ownership de tablas ACTIVAS identificadas** (prioridad alta)
2. **Verificar uso en código** de tablas marcadas como "Posiblemente activo"
3. **Documentar tablas LEGACY** para futura migración o eliminación

### Fase Futura (Limpieza)
1. **Auditar tablas LEGACY** para determinar si deben eliminarse
2. **Migrar datos útiles** de tablas legacy a tablas activas
3. **Eliminar tablas legacy** no utilizadas

---

## ⚠️ ADVERTENCIAS

- **NO cambiar ownership de tablas LEGACY** sin verificación explícita
- **NO ejecutar migraciones como postgres/root** para evitar problemas
- **NO ignorar errores** sin documentación
- **PostgreSQL sigue siendo Source of Truth soberano**

---

**Próximo Paso**: Crear migración canónica para remediar ownership de tablas ACTIVAS únicamente.









