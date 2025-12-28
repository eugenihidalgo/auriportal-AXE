-- ============================================================================
-- Migración v5.31.0: Saneamiento Canónico de Ownership Legacy
-- ============================================================================
-- Fecha: 2025-12-26
-- Descripción: Corrige el ownership de tablas ACTIVAS (SOT y Runtime)
--              que tienen ownership 'postgres' en lugar de 'aurelinportal'
--
-- PRINCIPIOS:
-- 1. Solo se cambia ownership de tablas ACTIVAS (SOT o Runtime)
-- 2. NO se tocan tablas LEGACY (mantienen ownership 'postgres')
-- 3. Migración idempotente (puede ejecutarse múltiples veces)
-- 4. Sin efectos colaterales (solo cambia ownership, no datos)
--
-- REFERENCIA:
-- - docs/DB_OWNERSHIP_AUDIT.md (auditoría completa)
-- ============================================================================

-- ============================================================================
-- TABLAS SOT PRINCIPALES (CRÍTICAS)
-- ============================================================================

-- Alumnos (SOT Principal)
ALTER TABLE IF EXISTS alumnos OWNER TO aurelinportal;

-- Auditoría (SOT)
ALTER TABLE IF EXISTS audit_events OWNER TO aurelinportal;
ALTER TABLE IF EXISTS audit_log OWNER TO aurelinportal;

-- Señales (SOT)
ALTER TABLE IF EXISTS signal_definitions OWNER TO aurelinportal;
ALTER TABLE IF EXISTS signal_aggregates OWNER TO aurelinportal;

-- Feature Flags (SOT) - Ya debería estar correcto, pero por seguridad
ALTER TABLE IF EXISTS feature_flags OWNER TO aurelinportal;

-- ============================================================================
-- AUTOMATION ENGINE (RUNTIME CRÍTICO)
-- ============================================================================

ALTER TABLE IF EXISTS automation_jobs OWNER TO aurelinportal;
ALTER TABLE IF EXISTS automation_locks OWNER TO aurelinportal;
ALTER TABLE IF EXISTS automation_rules OWNER TO aurelinportal;
ALTER TABLE IF EXISTS automation_runs OWNER TO aurelinportal;

-- ============================================================================
-- RECORRIDOS PDE (RUNTIME)
-- ============================================================================

ALTER TABLE IF EXISTS recorridos OWNER TO aurelinportal;
ALTER TABLE IF EXISTS recorrido_versions OWNER TO aurelinportal;
ALTER TABLE IF EXISTS recorrido_runs OWNER TO aurelinportal;
ALTER TABLE IF EXISTS recorrido_events OWNER TO aurelinportal;
ALTER TABLE IF EXISTS recorrido_step_results OWNER TO aurelinportal;
ALTER TABLE IF EXISTS recorrido_audit_log OWNER TO aurelinportal;
ALTER TABLE IF EXISTS recorrido_drafts OWNER TO aurelinportal;

-- ============================================================================
-- NAVEGACIÓN (RUNTIME)
-- ============================================================================

ALTER TABLE IF EXISTS navigation_definitions OWNER TO aurelinportal;
ALTER TABLE IF EXISTS navigation_versions OWNER TO aurelinportal;
ALTER TABLE IF EXISTS navigation_drafts OWNER TO aurelinportal;
ALTER TABLE IF EXISTS navigation_audit_log OWNER TO aurelinportal;

-- ============================================================================
-- PDE MOTORS Y CATÁLOGOS (RUNTIME)
-- ============================================================================

ALTER TABLE IF EXISTS pde_motors OWNER TO aurelinportal;
ALTER TABLE IF EXISTS pde_packages OWNER TO aurelinportal;
ALTER TABLE IF EXISTS pde_contexts OWNER TO aurelinportal;
ALTER TABLE IF EXISTS pde_resolvers OWNER TO aurelinportal;
ALTER TABLE IF EXISTS pde_widgets OWNER TO aurelinportal;
ALTER TABLE IF EXISTS pde_catalog_registry OWNER TO aurelinportal;

-- ============================================================================
-- PROTECCIONES ENERGÉTICAS (RUNTIME - Servicio Activo)
-- ============================================================================

ALTER TABLE IF EXISTS protecciones_energeticas OWNER TO aurelinportal;

-- ============================================================================
-- ASPECTOS ENERGÉTICOS (RUNTIME)
-- ============================================================================

ALTER TABLE IF EXISTS aspectos_energeticos OWNER TO aurelinportal;
ALTER TABLE IF EXISTS aspectos_energeticos_alumnos OWNER TO aurelinportal;
ALTER TABLE IF EXISTS aspectos_energeticos_registros OWNER TO aurelinportal;
ALTER TABLE IF EXISTS aspectos_karmicos OWNER TO aurelinportal;
ALTER TABLE IF EXISTS aspectos_indeseables OWNER TO aurelinportal;

-- ============================================================================
-- TRANSMUTACIONES (RUNTIME)
-- ============================================================================

ALTER TABLE IF EXISTS transmutaciones_lugares OWNER TO aurelinportal;
ALTER TABLE IF EXISTS transmutaciones_proyectos OWNER TO aurelinportal;
ALTER TABLE IF EXISTS transmutaciones_apadrinados OWNER TO aurelinportal;
ALTER TABLE IF EXISTS transmutaciones_personas OWNER TO aurelinportal;

-- ============================================================================
-- PREPARACIONES Y PRÁCTICAS (RUNTIME)
-- ============================================================================

ALTER TABLE IF EXISTS preparaciones_practica OWNER TO aurelinportal;
ALTER TABLE IF EXISTS reflexiones OWNER TO aurelinportal;
ALTER TABLE IF EXISTS practicas_audio OWNER TO aurelinportal;
ALTER TABLE IF EXISTS practice_signals OWNER TO aurelinportal;

-- ============================================================================
-- ANALYTICS Y EVENTOS ENERGÉTICOS (RUNTIME)
-- ============================================================================

ALTER TABLE IF EXISTS analytics_events OWNER TO aurelinportal;
ALTER TABLE IF EXISTS energy_events OWNER TO aurelinportal;
ALTER TABLE IF EXISTS energy_subject_state OWNER TO aurelinportal;
ALTER TABLE IF EXISTS energy_subject_stats_rolling OWNER TO aurelinportal;

-- ============================================================================
-- MÓDULOS Y TEMAS (RUNTIME)
-- ============================================================================

ALTER TABLE IF EXISTS modulos_sistema OWNER TO aurelinportal;
ALTER TABLE IF EXISTS theme_definitions OWNER TO aurelinportal;

-- ============================================================================
-- COMENTARIOS
-- ============================================================================

COMMENT ON TABLE alumnos IS 'SOT Principal - Ownership corregido a aurelinportal (v5.31.0)';
COMMENT ON TABLE protecciones_energeticas IS 'Runtime - Ownership corregido a aurelinportal (v5.31.0)';
COMMENT ON TABLE automation_rules IS 'Runtime - Ownership corregido a aurelinportal (v5.31.0)';
COMMENT ON TABLE signal_definitions IS 'SOT - Ownership corregido a aurelinportal (v5.31.0)';
COMMENT ON TABLE audit_events IS 'SOT - Ownership corregido a aurelinportal (v5.31.0)';

-- ============================================================================
-- NOTA IMPORTANTE
-- ============================================================================
-- Esta migración NO cambia ownership de tablas LEGACY.
-- Las tablas legacy mantienen ownership 'postgres' hasta futura migración
-- o eliminación. Ver docs/DB_OWNERSHIP_AUDIT.md para clasificación completa.
-- ============================================================================





