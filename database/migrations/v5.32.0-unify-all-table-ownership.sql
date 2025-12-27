-- ============================================================================
-- Migración v5.32.0: Unificación total de ownership PostgreSQL
-- Tipo: ADMINISTRATIVA (ejecución manual)
-- Requiere: superusuario postgres
-- Resultado: TODAS las tablas -> owner aurelinportal
-- Prohibido ejecutar desde la aplicación
-- ============================================================================
-- Fecha: 2025-12-26
-- Descripción: Unifica el ownership de TODAS las tablas del schema public
--              al usuario de aplicación (aurelinportal).
--
-- DECISIÓN CONSTITUCIONAL:
-- - NO existe distinción ACTIVA / LEGACY en ownership
-- - TODAS las tablas deben tener owner = aurelinportal
-- - PostgreSQL (usuario postgres) queda EXCLUSIVAMENTE como rol administrativo
--
-- PROCEDIMIENTO DE EJECUCIÓN:
-- sudo -i -u postgres
-- psql -d aurelinportal -f database/migrations/v5.32.0-unify-all-table-ownership.sql
--
-- VERIFICACIÓN POST-MIGRACIÓN:
-- SELECT tablename, tableowner
-- FROM pg_tables
-- WHERE schemaname = 'public'
--   AND tableowner != 'aurelinportal';
-- Resultado esperado: 0 filas
-- ============================================================================

-- ============================================================================
-- UNIFICACIÓN TOTAL DE OWNERSHIP
-- ============================================================================
-- Cambiar ownership de TODAS las tablas del schema public a aurelinportal
-- SIN excepciones, SIN distinción legacy, SIN lógica dinámica opaca
-- ============================================================================

ALTER TABLE IF EXISTS public.admin_favoritos OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.altares OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.altares_items OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.alumnos OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.alumnos_apadrinados OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.alumnos_disponibilidad OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.alumnos_lugares OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.alumnos_proyectos OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.amistades OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.analytics_eventos OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.analytics_events OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.analytics_resumen_diario OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.arquetipos OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.arquetipos_alumnos OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.aspectos_energeticos OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.aspectos_energeticos_alumnos OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.aspectos_energeticos_registros OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.aspectos_indeseables OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.aspectos_indeseables_alumnos OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.aspectos_karmicos OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.aspectos_karmicos_alumnos OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.aspectos_practica OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.audit_events OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.audit_log OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.auribosses OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.auribosses_alumnos OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.auriclock_registro OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.aurimapa_alumnos OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.aurimapa_nodos OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.automation_dedup OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.automation_definitions OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.automation_jobs OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.automation_locks OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.automation_rules OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.automation_run_steps OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.automation_runs OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.avatar_alumnos OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.avatar_estados OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.caminos_pantallas OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.carta_astral OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.circulos_auri OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.circulos_auri_metricas OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.circulos_auri_miembros OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.comunicados_eugeni OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.conexiones_pantallas OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.content_overrides OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.context_mappings OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.creacion_objetivos OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.creacion_problemas_iniciales OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.creacion_version_futura OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.cumpleaños_eventos OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.decretos OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.diario_practicas OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.disenohumano OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.emocional_ano OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.energy_events OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.energy_subject_state OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.energy_subject_stats_rolling OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.eventos_globales OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.feature_flags OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.frases_nivel OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.historias OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.historias_alumnos OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.ideas_practicas OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.informes_semanales OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.items_transmutaciones OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.items_transmutaciones_alumnos OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.limpieza_hogar OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.limpieza_hogar_alumnos OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.limpiezas_master_historial OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.listas_transmutaciones OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.logros OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.logros_definicion OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.maestro_conversaciones OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.maestro_insights OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.master_notifications OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.mensajes_especiales OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.misiones OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.misiones_alumnos OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.modulos_sistema OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.musicas_meditacion OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.navigation_audit_log OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.navigation_definitions OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.navigation_drafts OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.navigation_versions OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.nivel_overrides OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.niveles_fases OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.notas_master OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.notificaciones_preferencias OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.pantallas OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.pattern_definitions OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.pausas OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.pde_automation_audit_log OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.pde_automation_executions OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.pde_automations OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.pde_catalog_registry OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.pde_context_audit_log OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.pde_contexts OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.pde_motors OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.pde_package_audit_log OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.pde_package_drafts OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.pde_package_versions OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.pde_packages OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.pde_packages_backup_before_legacy_delete OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.pde_resolver_audit_log OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.pde_resolvers OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.pde_signal_audit_log OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.pde_signal_emissions OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.pde_signals OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.pde_source_templates OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.pde_transmutation_categories OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.pde_transmutation_subtypes OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.pde_transmutation_tags OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.pde_widget_audit_log OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.pde_widget_drafts OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.pde_widget_versions OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.pde_widgets OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.portal_messages OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.post_practice_flows OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.practicas OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.practicas_audio OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.practicas_compasion OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.practicas_conjuntas OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.practicas_horario OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.practice_signals OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.preparaciones_practica OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.progreso_pedagogico OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.protecciones_energeticas OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.quests OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.quests_alumnos OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.racha_fases OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.recorrido_audit_log OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.recorrido_drafts OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.recorrido_events OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.recorrido_runs OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.recorrido_step_results OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.recorrido_versions OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.recorridos OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.reflexiones OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.respuestas OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.schema_migrations OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.screen_template_audit_log OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.screen_template_drafts OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.screen_template_versions OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.screen_templates OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.secciones_limpieza OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.sellos_alumnos OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.sellos_ascension OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.signal_aggregates OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.signal_definitions OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.skilltree_nodos OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.skilltree_progreso OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.sorpresas OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.sorpresas_alumnos OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.student_modes OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.student_patterns OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.student_progress_snapshot OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.superprioritarios OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.tarot_cartas OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.tarot_interpretaciones OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.tarot_sesiones OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.tecnicas_limpieza OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.tecnicas_post_practica OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.theme_audit_log OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.theme_definitions OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.theme_drafts OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.theme_rules OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.theme_versions OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.themes OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.tokens_auri OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.tokens_transacciones OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.tonos_meditacion OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.transmutaciones_apadrinados OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.transmutaciones_apadrinados_estado OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.transmutaciones_lugares OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.transmutaciones_lugares_estado OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.transmutaciones_proyectos OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.transmutaciones_proyectos_estado OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.ui_active_config OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.ui_conversation_scripts OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.ui_layers OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.ui_screens OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.ui_themes OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.whisper_control OWNER TO aurelinportal;
ALTER TABLE IF EXISTS public.whisper_transcripciones OWNER TO aurelinportal;

-- ============================================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- ============================================================================
-- Ejecutar después de aplicar la migración:
--
-- SELECT tablename, tableowner
-- FROM pg_tables
-- WHERE schemaname = 'public'
--   AND tableowner != 'aurelinportal';
--
-- Resultado esperado: 0 filas (todas las tablas tienen owner = aurelinportal)
-- ============================================================================

-- ============================================================================
-- COMENTARIOS FINALES
-- ============================================================================
-- Esta migración unifica el ownership de TODAS las tablas del schema public.
-- NO existe distinción ACTIVA / LEGACY en ownership.
-- PostgreSQL (usuario postgres) queda EXCLUSIVAMENTE como rol administrativo.
--
-- Esta decisión es:
-- - explícita
-- - irreversible (salvo nueva versión constitucional)
-- - coherente con PostgreSQL como SOT
-- - necesaria para eliminar definitivamente errores de migración
-- ============================================================================




