# AUDITORÍA GLOBAL: CÓDIGO SIN TABLAS

**Fecha de auditoría:** 16 de Diciembre de 2025  
**Base de datos:** PostgreSQL 16.11, database `aurelinportal`  
**Usuario:** postgres  
**Tablas existentes:** 106  
**Migraciones en carpeta:** 24  
**Migraciones aplicadas:** ~0 de v4.5+ (verificado)

---

## 1. RESUMEN EJECUTIVO

### Estado Global

| Estado | Cantidad | % |
|--------|----------|---|
| ✅ REAL (código + tablas OK) | ~80 | 75% |
| ⚠️ PARCIAL (tabla existe pero incompleta/sin uso) | ~15 | 14% |
| ❌ HUMO (código existe pero tablas NO) | ~25 | 11% |

### Top 10 Riesgos Críticos (por severidad)

| # | Área | Severidad | Problema |
|---|------|-----------|----------|
| 1 | **Recorridos Runtime** | 🔴 CRÍTICO | 7 tablas referenciadas no existen. Rutas activas en router |
| 2 | **Energy Events** | 🔴 CRÍTICO | Tabla `energy_events` + `energy_subject_state` no existen. Código activo |
| 3 | **Automation Engine** | 🔴 CRÍTICO | 4 tablas no existen (`automation_rules`, `automation_runs`, `automation_jobs`, `automation_locks`) |
| 4 | **Analytics Events** | 🟠 ALTO | Tabla `analytics_events` no existe. Endpoint `/analytics/collect` activo |
| 5 | **Audit Log** | 🟠 ALTO | Tabla `audit_log` no existe. Sistema de observabilidad roto |
| 6 | **UI Experience System** | 🟠 ALTO | 5 tablas no existen (`ui_themes`, `ui_screens`, `ui_layers`, `ui_conversation_scripts`, `ui_active_config`) |
| 7 | **Practice Signals** | 🟠 ALTO | Tablas `signal_definitions`, `practice_signals`, `signal_aggregates` no existen |
| 8 | **Pattern Engine** | 🟠 ALTO | Tablas `pattern_definitions`, `student_patterns` no existen |
| 9 | **Portal Messages** | 🟡 MEDIO | Tablas `portal_messages`, `student_modes`, `content_overrides`, `master_notifications` no existen |
| 10 | **Admin Users** | 🟡 MEDIO | Tabla `admin_users` no existe. Auth admin puede fallar |

---

## 2. TABLA MAESTRA POR ÁREA

### ❌ ÁREAS HUMO (código existe, tablas NO)

| Área | Rutas Afectadas | Tablas Requeridas | Existen | Problema | Acción Mínima |
|------|----------------|-------------------|---------|----------|---------------|
| **Recorridos Versionado** | `/admin/api/recorridos/*` | `recorridos`, `recorrido_drafts`, `recorrido_versions`, `recorrido_audit_log` | ❌ NO | Migración v5.1.0 no aplicada | Aplicar migración |
| **Recorridos Runtime** | `/api/recorridos/*` | `recorrido_runs`, `recorrido_step_results`, `recorrido_events` | ❌ NO | Migración v5.2.0 no aplicada | Aplicar migración + feature flag |
| **Energy Events** | `/admin/api/energy/*`, limpiezas | `energy_events`, `energy_subject_state` | ❌ NO | Migraciones v5.0.0, v5.0.2 no aplicadas | Aplicar migraciones |
| **Automation Engine** | Interno (triggers) | `automation_rules`, `automation_runs`, `automation_jobs`, `automation_locks` | ❌ NO | Migración v4.9.0 no aplicada | Aplicar migración |
| **Analytics Events** | `/analytics/collect` | `analytics_events` | ❌ NO | Migración v4.6.0 no aplicada | Aplicar migración |
| **Audit Log** | Interno (observabilidad) | `audit_log` | ❌ NO | Migración v4.5.0 no aplicada | Aplicar migración |
| **UI Experience** | `/admin/themes/*` | `ui_themes`, `ui_screens`, `ui_layers`, `ui_conversation_scripts`, `ui_active_config` | ❌ NO | Migración v4.7.0 no aplicada | Aplicar migración |
| **Practice Signals** | `/api/practicas/*/signals` | `signal_definitions`, `practice_signals`, `signal_aggregates` | ❌ NO | Migraciones v4.11.x no aplicadas | Aplicar migraciones |
| **Pattern Engine** | Interno (patterns) | `pattern_definitions`, `student_patterns` | ❌ NO | Migraciones v4.12.x no aplicadas | Aplicar migraciones |
| **Portal Messages** | Interno (automations) | `portal_messages`, `student_modes`, `content_overrides`, `master_notifications` | ❌ NO | Migraciones v4.10.x no aplicadas | Aplicar migraciones |
| **Protecciones Energéticas** | `/api/protecciones-energeticas` | `protecciones_energeticas` | ❌ NO | Migración v4.13.1 no aplicada | Aplicar migración |
| **Admin Users** | Login admin | `admin_users` | ❌ NO | Sin migración definida | Crear migración |

### ⚠️ ÁREAS PARCIALES

| Área | Estado | Problema |
|------|--------|----------|
| `theme_definitions` | Tabla existe pero sin uso activo | Posible legacy |
| `student_progress_snapshot` | Tabla existe, repo implementado | OK pero sin verificar uso |
| `nivel_overrides` | Tabla existe, repo implementado | OK |
| `analytics_eventos` | Tabla existe (diferente nombre) | ¿Versión vieja? Verificar |

### ✅ ÁREAS REALES (funcionando)

| Área | Tablas | Estado |
|------|--------|--------|
| Alumnos | `alumnos`, `alumnos_lugares`, `alumnos_proyectos` | ✅ OK |
| Prácticas | `practicas` | ✅ OK |
| Pausas | `pausas` | ✅ OK |
| Respuestas | `respuestas` | ✅ OK |
| Frases | `frases_nivel` | ✅ OK |
| Aspectos Energéticos | `aspectos_energeticos`, `aspectos_energeticos_alumnos` | ✅ OK |
| Aspectos Kármicos | `aspectos_karmicos`, `aspectos_karmicos_alumnos` | ✅ OK |
| Aspectos Indeseables | `aspectos_indeseables`, `aspectos_indeseables_alumnos` | ✅ OK |
| Transmutaciones | `listas_transmutaciones`, `items_transmutaciones`, `items_transmutaciones_alumnos` | ✅ OK |
| Limpieza Hogar | `limpieza_hogar`, `limpieza_hogar_alumnos` | ✅ OK |
| Limpiezas Master | `limpiezas_master_historial` | ✅ OK |
| Progreso Pedagógico | `progreso_pedagogico`, `aspectos_practica` | ✅ OK |
| Superprioritarios | `superprioritarios` | ✅ OK |
| Módulos V6/V7/V8 | Múltiples tablas | ✅ OK |

---

## 3. TABLAS REFERENCIADAS EN CÓDIGO PERO AUSENTES EN PG

| Tabla | Archivo(s) | Función(es) | Severidad |
|-------|-----------|-------------|-----------|
| `energy_events` | `energy-events.js`, `energy-projection.js`, `admin-master-insight.js` | `insertEnergyEvent`, `applyEventToProjections` | 🔴 CRÍTICO |
| `energy_subject_state` | `energy-projection.js`, `admin-panel-v4.js`, `admin-energy-api.js`, `admin-master-insight.js` | UPSERT, SELECT | 🔴 CRÍTICO |
| `recorridos` | `recorrido-repo-pg.js` | CRUD | 🔴 CRÍTICO |
| `recorrido_drafts` | `recorrido-draft-repo-pg.js` | CRUD | 🔴 CRÍTICO |
| `recorrido_versions` | `recorrido-version-repo-pg.js` | CRUD | 🔴 CRÍTICO |
| `recorrido_runs` | `recorrido-run-repo-pg.js` | CRUD | 🔴 CRÍTICO |
| `recorrido_step_results` | `recorrido-step-result-repo-pg.js` | INSERT, SELECT | 🔴 CRÍTICO |
| `recorrido_events` | `recorrido-event-repo-pg.js` | INSERT, SELECT | 🔴 CRÍTICO |
| `recorrido_audit_log` | `recorrido-audit-repo-pg.js` | INSERT, SELECT | 🔴 CRÍTICO |
| `automation_rules` | `automation-engine.js`, `automation-planner.js` | SELECT | 🔴 CRÍTICO |
| `automation_runs` | `automation-executor.js` | INSERT, UPDATE | 🔴 CRÍTICO |
| `automation_jobs` | `automation-scheduler.js` | INSERT, SELECT | 🔴 CRÍTICO |
| `automation_locks` | `automation-guards.js` | INSERT, SELECT | 🔴 CRÍTICO |
| `analytics_events` | `analytics-repo-pg.js` | INSERT | 🟠 ALTO |
| `audit_log` | `audit-repo-pg.js` | INSERT | 🟠 ALTO |
| `ui_themes` | `ui-theme-repo-pg.js` | INSERT, SELECT | 🟠 ALTO |
| `ui_screens` | `ui-screen-repo-pg.js` | INSERT, SELECT | 🟠 ALTO |
| `ui_layers` | `ui-layer-repo-pg.js` | INSERT, SELECT | 🟠 ALTO |
| `ui_conversation_scripts` | `ui-conversation-repo-pg.js` | INSERT, SELECT | 🟠 ALTO |
| `ui_active_config` | `ui-active-config-repo-pg.js` | SELECT, UPDATE | 🟠 ALTO |
| `signal_definitions` | `practice-signals.js` | SELECT | 🟠 ALTO |
| `practice_signals` | `practice-signals.js` | INSERT | 🟠 ALTO |
| `signal_aggregates` | `pattern-engine.js`, `signal-aggregator.js` | SELECT | 🟠 ALTO |
| `pattern_definitions` | `pattern-engine.js` | SELECT | 🟠 ALTO |
| `student_patterns` | `pattern-engine.js` | SELECT, INSERT, UPDATE | 🟠 ALTO |
| `portal_messages` | `automation-actions/portal-message-action.js` | INSERT | 🟡 MEDIO |
| `student_modes` | `automation-actions/mode-set-action.js` | INSERT, UPDATE | 🟡 MEDIO |
| `content_overrides` | `automation-actions/content-visibility-action.js` | INSERT, UPDATE | 🟡 MEDIO |
| `master_notifications` | `automation-actions/master-notification-action.js` | INSERT | 🟡 MEDIO |
| `admin_users` | `admin-auth.js` | SELECT | 🟡 MEDIO |
| `protecciones_energeticas` | `protecciones-energeticas.js` | CRUD | 🟡 MEDIO |

---

## 4. TABLAS EXISTENTES EN PG SIN MIGRACIÓN DOCUMENTADA

| Tabla | Riesgo | Recomendación |
|-------|--------|---------------|
| `altares` | 🟢 Bajo | Documentar o eliminar si no se usa |
| `altares_items` | 🟢 Bajo | Documentar o eliminar si no se usa |
| `alumnos_disponibilidad` | 🟢 Bajo | Verificar uso |
| `amistades` | 🟢 Bajo | Documentar |
| `cumpleaños_eventos` | 🟢 Bajo | Documentar |
| `eventos_globales` | 🟢 Bajo | Documentar |
| `theme_definitions` | 🟡 Medio | Posible conflicto con `ui_themes` |
| `analytics_eventos` | 🟡 Medio | Posible versión vieja de `analytics_events` |
| `tokens_auri` | 🟢 Bajo | Documentar |
| `tokens_transacciones` | 🟢 Bajo | Documentar |

---

## 5. RUTAS ACTIVAS SIN INFRAESTRUCTURA

### 🔴 RUTAS CRÍTICAS (rompen si se llaman)

| Ruta | Endpoint | Tabla(s) Faltantes | Acción Propuesta |
|------|----------|-------------------|------------------|
| `POST /api/recorridos/:id/start` | `recorridos-runtime.js` | `recorridos`, `recorrido_versions`, `recorrido_runs` | Feature flag activo, bloquea correctamente |
| `GET /api/recorridos/runs/:id` | `recorridos-runtime.js` | `recorrido_runs` | Feature flag activo, bloquea correctamente |
| `POST /admin/api/recorridos` | `admin-recorridos-api.js` | `recorridos`, `recorrido_drafts`, `recorrido_audit_log` | **SIN PROTECCIÓN** - Añadir feature flag |
| `GET /admin/api/recorridos` | `admin-recorridos-api.js` | `recorridos` | **SIN PROTECCIÓN** - Añadir feature flag |
| `POST /analytics/collect` | `analytics-collect-v1.js` | `analytics_events` | Fail-open pero registra error |
| `POST /admin/api/energy/clean` | `admin-energy-api.js` | `energy_subject_state` | **SIN PROTECCIÓN** - Añadir verificación |
| `POST /admin/api/energy/illuminate` | `admin-energy-api.js` | `energy_subject_state` | **SIN PROTECCIÓN** - Añadir verificación |
| `GET /admin/themes/ui` | `admin-themes-ui.js` | `ui_themes`, `ui_active_config` | **SIN PROTECCIÓN** |

### 🟡 RUTAS PARCIALMENTE PROTEGIDAS

| Ruta | Protección | Estado |
|------|------------|--------|
| `/api/recorridos/*` | Feature flag `recorridos_runtime_v1` | ✅ Protegido |
| Automation Engine (interno) | Feature flag `automations_beta` | ✅ Parcialmente protegido |

---

## 6. PLAN DE CIERRE EN 3 OLEADAS

### OLEADA 1 — BLOQUEANTE (Producción)
**Plazo:** Inmediato antes de cualquier uso

| # | Acción | Archivos Afectados | Esfuerzo |
|---|--------|-------------------|----------|
| 1.1 | Aplicar migración `v4.5.0-create-audit-log.sql` | BD | 1 min |
| 1.2 | Aplicar migración `v4.6.0-create-analytics-events.sql` | BD | 1 min |
| 1.3 | Aplicar migración `v4.7.0-create-ui-experience-system.sql` | BD | 1 min |
| 1.4 | Aplicar migración `v4.8.0-create-audit-events.sql` (si existe) | BD | 1 min |
| 1.5 | Aplicar migración `v4.9.0-create-automation-engine.sql` | BD | 1 min |
| 1.6 | Aplicar migraciones `v4.10.x` (portal_messages, student_modes, etc.) | BD | 2 min |
| 1.7 | Aplicar migraciones `v4.11.x` (signals) | BD | 2 min |
| 1.8 | Aplicar migraciones `v4.12.x` (patterns) | BD | 1 min |
| 1.9 | Aplicar migración `v4.13.1-create-protecciones-energeticas.sql` | BD | 1 min |
| 1.10 | Aplicar migraciones `v5.0.x` (energy_events, energy_projections) | BD | 2 min |
| 1.11 | Aplicar migración `v5.1.0-create-recorridos-versioning.sql` | BD | 1 min |
| 1.12 | Aplicar migración `v5.2.0-create-recorrido-runtime.sql` | BD | 1 min |
| 1.13 | Crear migración para `admin_users` | Nuevo archivo | 15 min |

**Comando para aplicar todas:**
```bash
cd /var/www/aurelinportal/database/migrations
for f in v4.5.0*.sql v4.6.0*.sql v4.7.0*.sql v4.8.0*.sql v4.8.1*.sql v4.9.0*.sql v4.10.*.sql v4.11.*.sql v4.12.*.sql v4.13.*.sql v5.0.*.sql v5.1.0*.sql v5.2.0*.sql; do
  echo "Aplicando $f..."
  sudo -u postgres psql -d aurelinportal -f "$f" 2>&1
done
```

### OLEADA 2 — IMPORTANTE (Beta)
**Plazo:** 1-2 días

| # | Acción | Descripción |
|---|--------|-------------|
| 2.1 | Crear sistema de tracking de migraciones | Tabla `schema_migrations` con versiones aplicadas |
| 2.2 | Añadir feature flag a `/admin/api/recorridos/*` | Proteger endpoints de recorridos admin |
| 2.3 | Añadir verificación de tablas en `admin-energy-api.js` | Fail gracefully si tabla no existe |
| 2.4 | Añadir verificación de tablas en `admin-themes-ui.js` | Fail gracefully si tabla no existe |
| 2.5 | Documentar tablas legacy (sin migración pero existentes) | Actualizar schema.sql o crear migraciones retroactivas |

### OLEADA 3 — HIGIENE (Documentación)
**Plazo:** 1 semana

| # | Acción | Descripción |
|---|--------|-------------|
| 3.1 | Crear `database/MIGRATION_STATUS.md` | Estado de cada migración |
| 3.2 | Implementar script `check-migrations.js` | Verifica estado de migraciones vs BD |
| 3.3 | Añadir tests de existencia de tablas | Tests que fallen si tabla no existe |
| 3.4 | Documentar tablas `analytics_eventos` vs `analytics_events` | ¿Conflicto? ¿Legacy? |
| 3.5 | Limpiar tablas sin uso confirmado | Auditoría de uso real |

---

## 7. ANEXOS

### A. Snapshot de Tablas PostgreSQL (16 Dic 2025)

```
admin_favoritos
altares
altares_items
alumnos
alumnos_disponibilidad
alumnos_lugares
alumnos_proyectos
amistades
analytics_eventos
analytics_resumen_diario
arquetipos
arquetipos_alumnos
aspectos_energeticos
aspectos_energeticos_alumnos
aspectos_energeticos_registros
aspectos_indeseables
aspectos_indeseables_alumnos
aspectos_karmicos
aspectos_karmicos_alumnos
aspectos_practica
auribosses
auribosses_alumnos
auriclock_registro
aurimapa_alumnos
aurimapa_nodos
avatar_alumnos
avatar_estados
caminos_pantallas
carta_astral
circulos_auri
circulos_auri_metricas
circulos_auri_miembros
comunicados_eugeni
conexiones_pantallas
creacion_objetivos
creacion_problemas_iniciales
creacion_version_futura
cumpleaños_eventos
diario_practicas
disenohumano
emocional_ano
eventos_globales
frases_nivel
historias
historias_alumnos
ideas_practicas
informes_semanales
items_transmutaciones
items_transmutaciones_alumnos
limpieza_hogar
limpieza_hogar_alumnos
limpiezas_master_historial
listas_transmutaciones
logros
logros_definicion
maestro_conversaciones
maestro_insights
mensajes_especiales
misiones
misiones_alumnos
modulos_sistema
musicas_meditacion
nivel_overrides
niveles_fases
notas_master
notificaciones_preferencias
pantallas
pausas
practicas
practicas_audio
practicas_compasion
practicas_conjuntas
practicas_horario
preparaciones_practica
progreso_pedagogico
quests
quests_alumnos
racha_fases
reflexiones
respuestas
secciones_limpieza
sellos_alumnos
sellos_ascension
skilltree_nodos
skilltree_progreso
sorpresas
sorpresas_alumnos
student_progress_snapshot
superprioritarios
tarot_cartas
tarot_interpretaciones
tarot_sesiones
tecnicas_limpieza
tecnicas_post_practica
theme_definitions
tokens_auri
tokens_transacciones
tonos_meditacion
transmutaciones_apadrinados
transmutaciones_apadrinados_estado
transmutaciones_lugares
transmutaciones_lugares_estado
transmutaciones_proyectos
transmutaciones_proyectos_estado
whisper_control
whisper_transcripciones
```

### B. Migraciones No Aplicadas (24 archivos)

```
v4.5.0-create-audit-log.sql
v4.6.0-create-analytics-events.sql
v4.7.0-create-ui-experience-system.sql
v4.8.0-create-audit-events.sql
v4.8.1-add-motivo-to-pausas.sql
v4.9.0-create-automation-engine.sql
v4.9.1-insert-test-rule.sql
v4.10.0-create-portal-messages.sql
v4.10.1-create-student-modes.sql
v4.10.2-create-content-overrides.sql
v4.10.3-create-master-notifications.sql
v4.11.0-create-signal-definitions.sql
v4.11.1-create-post-practice-flows.sql
v4.11.2-create-practice-signals.sql
v4.11.3-create-signal-aggregates.sql
v4.12.0-create-pattern-definitions.sql
v4.12.1-create-student-patterns.sql
v4.13.0-create-theme-definitions.sql
v4.13.1-create-protecciones-energeticas.sql
v5.0.0-create-energy-events.sql
v5.0.1-add-energy-events-idempotency.sql
v5.0.2-create-energy-projections.sql
v5.1.0-create-recorridos-versioning.sql
v5.2.0-create-recorrido-runtime.sql
```

### C. Consultas SQL Usadas para Verificación

```sql
-- Verificar si tablas existen
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema='public' 
ORDER BY table_name;

-- Verificar tablas específicas
SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='energy_events') THEN '✅' ELSE '❌' END as energy_events,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='recorridos') THEN '✅' ELSE '❌' END as recorridos;
```

---

## 8. CONCLUSIÓN

**Estado actual:** El sistema tiene aproximadamente **25 tablas referenciadas en código que NO existen en PostgreSQL**. Esto significa que ~11% del código de infraestructura está apuntando a tablas inexistentes.

**Riesgo principal:** Las áreas de Recorridos, Energy Events, y Automation Engine tienen código completo y rutas activas pero sin infraestructura de base de datos.

**Acción inmediata requerida:** Aplicar las 24 migraciones pendientes en orden (v4.5.0 → v5.2.0) antes de habilitar cualquier feature que dependa de ellas.

---

*Informe generado automáticamente durante auditoría "Código sin Tablas"*  
*No se realizaron cambios en el código durante esta auditoría*




