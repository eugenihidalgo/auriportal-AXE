# REMEDIACIÓN DE OWNERSHIP - POSTGRESQL
## AuriPortal - Saneamiento Canónico de Ownership Legacy

**Fecha de Remediation**: 2025-12-26  
**Migración Creada**: `database/migrations/v5.31.0-fix-table-ownership.sql`  
**Estado**: ⚠️ REQUIERE EJECUCIÓN MANUAL CON PERMISOS ELEVADOS

---

## 🔐 AUTENTICACIÓN POSTGRESQL Y PEER AUTHENTICATION

### ¿Qué es Peer Authentication?

**Peer authentication** es un método de autenticación de PostgreSQL que permite conexiones locales usando el sistema operativo para verificar la identidad del usuario. Es el método **más seguro** para conexiones locales.

**Cómo funciona**:
- PostgreSQL verifica que el usuario del sistema operativo coincida con el usuario de la base de datos
- No requiere contraseña (usa identidad del SO)
- Solo funciona para conexiones locales (socket Unix)
- Es la configuración **por defecto y recomendada** en PostgreSQL

### ¿Por qué aparece "Peer authentication failed for user postgres"?

Este error es **NORMAL y ESPERADO** cuando:
- Intentas conectarte como usuario `postgres` desde un usuario del sistema diferente
- El usuario actual del sistema no coincide con el usuario de PostgreSQL

**Esto NO es un bug**. Es el comportamiento correcto de seguridad de PostgreSQL.

### ⚠️ PROHIBICIONES ABSOLUTAS

**ESTÁ PROHIBIDO**:
- ❌ Editar `pg_hba.conf` para cambiar `peer` → `md5`
- ❌ Cambiar autenticación a contraseña para "arreglar" el error
- ❌ Poner contraseña al usuario `postgres` por conveniencia
- ❌ Ejecutar migraciones administrativas desde la aplicación
- ❌ Bajar seguridad para "arreglar" migraciones

**Por qué está prohibido**:
- Peer authentication es más seguro que contraseñas
- Cambiar autenticación introduce vulnerabilidades
- Las migraciones administrativas deben ejecutarse manualmente
- El sistema debe mantener el máximo nivel de seguridad

---

## 📊 RESUMEN EJECUTIVO

### Problema Identificado
- **98 tablas** tienen ownership `postgres` en lugar de `aurelinportal`
- Esto impide que el usuario de la aplicación ejecute `ALTER TABLE` en migraciones
- Error recurrente: `must be owner of table <tabla>`

### Solución Implementada
- **Migración creada**: `v5.31.0-fix-table-ownership.sql`
- **Tablas remediadas**: ~45 tablas ACTIVAS (SOT y Runtime)
- **Tablas NO tocadas**: ~53 tablas LEGACY (mantienen ownership `postgres`)

### Estado Actual
- ⚠️ **Migración NO aplicada automáticamente** (requiere permisos de superusuario)
- ✅ **Migración lista para ejecución manual**
- ✅ **Documentación completa generada**

---

## 🔧 EJECUCIÓN DE LA REMEDIACIÓN

### Procedimiento Correcto (ÚNICO MÉTODO VÁLIDO)

La migración debe ejecutarse **una sola vez** con permisos de superusuario usando **peer authentication**:

```bash
# 1. Cambiar a usuario postgres del sistema (peer authentication)
sudo -i -u postgres

# 2. Ejecutar migración desde el directorio del proyecto
cd /var/www/aurelinportal
psql -d aurelinportal -f database/migrations/v5.31.0-fix-table-ownership.sql

# 3. Verificar que se aplicó correctamente
psql -d aurelinportal -c "
SELECT tablename, tableowner 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('alumnos', 'protecciones_energeticas', 'automation_rules', 'signal_definitions', 'audit_events')
ORDER BY tablename;
"

# 4. Salir del usuario postgres
exit
```

### ¿Por qué este procedimiento?

1. **`sudo -i -u postgres`**: Cambia al usuario `postgres` del sistema operativo
2. **Peer authentication funciona**: El usuario del SO coincide con el usuario de PostgreSQL
3. **Sin contraseñas**: Usa identidad del sistema operativo (más seguro)
4. **Permisos correctos**: El usuario `postgres` puede cambiar ownership de tablas

### ⚠️ MÉTODOS PROHIBIDOS

**NO usar estos métodos**:

```bash
# ❌ PROHIBIDO: Intentar con contraseña
psql -U postgres -W -d aurelinportal  # Falla con peer authentication

# ❌ PROHIBIDO: Desde aplicación
node scripts/apply-migration.js  # Usuario aurelinportal no tiene permisos

# ❌ PROHIBIDO: Modificar pg_hba.conf
# Cambiar peer → md5 para "arreglar" el error
```

**Por qué están prohibidos**:
- Bajan el nivel de seguridad
- Introducen vulnerabilidades
- No resuelven el problema real (ownership)
- Violan principios constitucionales del sistema

---

## ✅ VERIFICACIÓN POST-REMEDIACIÓN

### Tablas Críticas a Verificar

```sql
-- Verificar ownership de tablas SOT principales
SELECT tablename, tableowner 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN (
    'alumnos',
    'protecciones_energeticas',
    'automation_rules',
    'automation_jobs',
    'automation_locks',
    'automation_runs',
    'signal_definitions',
    'signal_aggregates',
    'audit_events',
    'audit_log',
    'recorridos',
    'navigation_definitions',
    'pde_motors',
    'feature_flags'
  )
ORDER BY tablename;
```

**Resultado Esperado**: Todas las tablas deben tener `tableowner = 'aurelinportal'`

### Verificar que NO Aparecen Más Errores

Después de aplicar la migración, verificar que las migraciones futuras no fallan con:
```
error: must be owner of table <tabla>
```

---

## 📋 TABLAS REMEDIADAS

### SOT Principales (Críticas)
- ✅ `alumnos`
- ✅ `audit_events`
- ✅ `audit_log`
- ✅ `signal_definitions`
- ✅ `signal_aggregates`
- ✅ `feature_flags`

### Automation Engine
- ✅ `automation_jobs`
- ✅ `automation_locks`
- ✅ `automation_rules`
- ✅ `automation_runs`

### Recorridos PDE
- ✅ `recorridos`
- ✅ `recorrido_versions`
- ✅ `recorrido_runs`
- ✅ `recorrido_events`
- ✅ `recorrido_step_results`
- ✅ `recorrido_audit_log`
- ✅ `recorrido_drafts`

### Navegación
- ✅ `navigation_definitions`
- ✅ `navigation_versions`
- ✅ `navigation_drafts`
- ✅ `navigation_audit_log`

### PDE Motors y Catálogos
- ✅ `pde_motors`
- ✅ `pde_packages`
- ✅ `pde_contexts`
- ✅ `pde_resolvers`
- ✅ `pde_widgets`
- ✅ `pde_catalog_registry`

### Protecciones y Aspectos
- ✅ `protecciones_energeticas`
- ✅ `aspectos_energeticos`
- ✅ `aspectos_energeticos_alumnos`
- ✅ `aspectos_energeticos_registros`
- ✅ `aspectos_karmicos`
- ✅ `aspectos_indeseables`

### Transmutaciones
- ✅ `transmutaciones_lugares`
- ✅ `transmutaciones_proyectos`
- ✅ `transmutaciones_apadrinados`
- ✅ `transmutaciones_personas`

### Prácticas y Analytics
- ✅ `preparaciones_practica`
- ✅ `reflexiones`
- ✅ `practicas_audio`
- ✅ `practice_signals`
- ✅ `analytics_events`
- ✅ `energy_events`
- ✅ `energy_subject_state`
- ✅ `energy_subject_stats_rolling`

### Módulos y Temas
- ✅ `modulos_sistema`
- ✅ `theme_definitions`

**Total**: ~45 tablas ACTIVAS remediadas

---

## 🟡 TABLAS LEGACY (NO REMEDIADAS)

Las siguientes tablas mantienen ownership `postgres` porque son LEGACY o no se usan en runtime:

- `altares`, `altares_items`
- `amistades`
- `arquetipos`, `arquetipos_alumnos`
- `auribosses`, `auribosses_alumnos`
- `auriclock_registro`
- `aurimapa_alumnos`, `aurimapa_nodos`
- `avatar_alumnos`, `avatar_estados`
- `carta_astral`
- `circulos_auri`, `circulos_auri_metricas`, `circulos_auri_miembros`
- `content_overrides`
- `creacion_*` (varias tablas)
- `cumpleaños_eventos`
- `diario_practicas`
- `disenohumano`
- `emocional_ano`
- `eventos_globales`
- `historias`, `historias_alumnos`
- `ideas_practicas`
- `informes_semanales`
- `logros`, `logros_definicion`
- `maestro_conversaciones`, `maestro_insights`
- `master_notifications`
- `mensajes_especiales`
- `misiones`, `misiones_alumnos`
- `notificaciones_preferencias`
- `pattern_definitions`
- `pde_packages_backup_before_legacy_delete`
- `portal_messages`
- `post_practice_flows`
- `practicas_compasion`, `practicas_conjuntas`, `practicas_horario`
- `quests`, `quests_alumnos`
- `sellos_alumnos`, `sellos_ascension`
- `skilltree_nodos`, `skilltree_progreso`
- `sorpresas`, `sorpresas_alumnos`
- `student_modes`, `student_patterns`
- `tarot_cartas`, `tarot_interpretaciones`, `tarot_sesiones`
- `tokens_auri`, `tokens_transacciones`
- `ui_active_config`, `ui_conversation_scripts`, `ui_layers`, `ui_screens`, `ui_themes`
- `alumnos_disponibilidad`

**Total**: ~53 tablas LEGACY (no remediadas intencionalmente)

---

## ⚠️ ADVERTENCIAS

1. **NO ejecutar migración desde aplicación**: Requiere permisos de superusuario
2. **NO cambiar ownership de tablas LEGACY**: Mantienen ownership `postgres` hasta futura migración
3. **NO modificar migraciones antiguas**: Esta es una migración NUEVA, no modifica migraciones existentes
4. **Ejecutar UNA SOLA VEZ**: La migración es idempotente, pero no es necesario ejecutarla múltiples veces

---

## 📝 PRÓXIMOS PASOS

### Inmediato
1. ✅ Ejecutar migración manualmente con permisos de superusuario
2. ✅ Verificar que ownership se corrigió correctamente
3. ✅ Confirmar que migraciones futuras no fallan con errores de ownership

### Futuro
1. **Auditar tablas LEGACY**: Determinar si deben eliminarse o migrarse
2. **Mejorar sistema de migraciones**: Distinguir entre tablas activas y legacy
3. **Documentar política de ownership**: Establecer reglas para nuevas tablas

---

## 🎯 RECOMENDACIONES CONSTITUCIONALES

### Para el Sistema de Migraciones

**Problema Detectado**: El sistema de migraciones reintenta migraciones fallidas legacy, causando errores repetidos de ownership.

**Recomendación** (NO implementar aún):
1. **Clasificar migraciones**: Marcar migraciones como "legacy" o "activa"
2. **Skip migraciones legacy**: No reintentar migraciones legacy que fallan por ownership
3. **Logging mejorado**: Registrar claramente cuando una migración se salta por ser legacy
4. **Registry de tablas**: Mantener un registry de tablas activas vs legacy

**Implementación Futura**:
- Crear `database/migration-registry.json` con clasificación de migraciones
- Modificar `database/pg.js` para respetar el registry
- Documentar política de ownership para nuevas tablas

---

**Estado Final**: ✅ Migración creada y documentada. Requiere ejecución manual con permisos de superusuario.

---

## 🔄 UNIFICACIÓN TOTAL DE OWNERSHIP (v5.32.0)

### Decisión Constitucional

**Fecha**: 2025-12-26  
**Migración**: `v5.32.0-unify-all-table-ownership.sql`  
**Estado**: ✅ DECISIÓN CONSTITUCIONAL IRREVERSIBLE

### Cambio de Política

La política transitoria de ownership ("tablas activas" vs "legacy") queda **SUPERADA**.

**Nueva política constitucional**:
- **TODAS** las tablas del schema `public` → `owner = aurelinportal`
- NO existe distinción ACTIVA / LEGACY en ownership
- PostgreSQL (usuario `postgres`) queda EXCLUSIVAMENTE como rol administrativo

### Ejecución de la Unificación

**Procedimiento EXACTO**:

```bash
# 1. Cambiar a usuario postgres del sistema (peer authentication)
sudo -i -u postgres

# 2. Ejecutar migración desde el directorio del proyecto
cd /var/www/aurelinportal
psql -d aurelinportal -f database/migrations/v5.32.0-unify-all-table-ownership.sql

# 3. Verificar que se aplicó correctamente
psql -d aurelinportal -c "
SELECT tablename, tableowner
FROM pg_tables
WHERE schemaname = 'public'
  AND tableowner != 'aurelinportal';
"

# 4. Resultado esperado: 0 filas (todas las tablas tienen owner = aurelinportal)

# 5. Salir del usuario postgres
exit
```

### Verificación Oficial

**Query de verificación estándar**:

```sql
SELECT tablename, tableowner
FROM pg_tables
WHERE schemaname = 'public'
  AND tableowner != 'aurelinportal';
```

**Resultado esperado**: **0 filas**

Si el resultado es 0 filas, la unificación se aplicó correctamente.

### Impacto

- ✅ Eliminación definitiva del error "must be owner of table"
- ✅ Ownership homogéneo para todas las tablas
- ✅ Simplificación de gobernanza
- ✅ Coherencia con PostgreSQL como SOT

---

**Referencias**:
- `docs/DB_OWNERSHIP_AUDIT.md` (auditoría completa)
- `docs/DB_OWNERSHIP_POLICY.md` (política canónica actualizada)
- `database/migrations/v5.31.0-fix-table-ownership.sql` (migración parcial - superada)
- `database/migrations/v5.32.0-unify-all-table-ownership.sql` (migración unificada - ACTUAL)

