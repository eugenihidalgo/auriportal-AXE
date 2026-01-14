// src/core/master/services/cleaning-state-seed-service.js
// Cleaning State Seed Service v1
//
// Materializa estados "NUNCA" en cleaning_item_state para items aplicables del catálogo.
// REGLA: Si un item aplica para un alumno pero no tiene estado, se crea con defaults (never).
//
// Idempotente: ON CONFLICT DO NOTHING
// Performance: Insert masivo (1 query, no loops)

import { query } from '../../../../database/pg.js';
import { getRequestId } from '../../observability/request-context.js';
import { logInfo, logWarn } from '../../observability/logger.js';
import { getStudentEffectiveLevel } from './cleaning-engine-service.js';

/**
 * Asegura que todos los items aplicables del catálogo tengan estado en cleaning_item_state
 * UUID-ONLY: Acepta student_uuid (UUID canónico)
 * 
 * @param {Object} options - Opciones
 * @param {string} options.student_uuid - UUID canónico del estudiante (OBLIGATORIO)
 * @param {string} [options.product_key='pde'] - Product key
 * @param {string} [options.domain_type='transmutation'] - Domain type
 * @param {number|null} [options.level_cap] - Cap de nivel (si null, usa nivel_efectivo)
 * @param {Object} [options.client] - Cliente de transacción (opcional)
 * @returns {Promise<Object>} { inserted, skipped, total_applicable }
 */
export async function ensureCleaningItemStateSeedForStudent(options = {}, client = null) {
  const traceId = getRequestId();
  const { 
    student_uuid, 
    product_key = 'pde', 
    domain_type = 'transmutation',
    level_cap = null
  } = options;
  
  if (!student_uuid) {
    throw new Error('student_uuid es requerido');
  }
  
  const queryFn = client ? client.query.bind(client) : query;
  
  try {
    // 1. Determinar cap de nivel
    // Si level_cap viene explícito, usarlo; si no, usar nivel_efectivo
    let nivelCap;
    if (level_cap !== null && level_cap !== undefined) {
      nivelCap = parseInt(level_cap, 10);
      if (isNaN(nivelCap) || nivelCap < 1) {
        nivelCap = 999; // Fallback a infinito si inválido
      }
    } else {
      // Usar nivel efectivo como default
      nivelCap = await getStudentEffectiveLevel(student_uuid);
    }
    
    logInfo('SEED_CLEAN_STATE', 'Iniciando seed de estados', {
      traceId,
      student_uuid,
      product_key,
      domain_type,
      level_cap: nivelCap,
      level_cap_provided: level_cap !== null
    });
    
    // 2. Insertar estados faltantes para items aplicables del catálogo
    // Filtros:
    // - Items activos (status='active' OR activo=true)
    // - Items con item_ref no null
    // - Items con nivel <= nivelCap (si nivel no es null)
    // - Items que NO tienen estado en cleaning_item_state
    // REGLA UNA_VEZ: Para items en listas tipo='una_vez', inicializar shared_remaining = COALESCE(veces_limpiar, 1)
    // REGLA RECURRENTE: Para items en listas tipo='recurrente', inicializar shared_remaining = 0
    const insertResult = await queryFn(`
      INSERT INTO cleaning_item_state (
        student_id,
        product_key,
        domain_type,
        item_ref,
        shared_last_cleaned_at,
        pde_last_cleaned_at,
        shared_clean_count,
        pde_clean_count,
        shared_completed,
        shared_remaining,
        pde_completed,
        meta,
        created_at,
        updated_at
      )
      SELECT 
        $1::uuid as student_id,
        $2::text as product_key,
        $3::text as domain_type,
        i.item_ref,
        NULL as shared_last_cleaned_at,
        NULL as pde_last_cleaned_at,
        0 as shared_clean_count,
        0 as pde_clean_count,
        -- shared_completed: para una_vez, es 0 si remaining > 0, 1 si remaining = 0
        -- Para recurrentes, siempre 0 en seed
        CASE 
          WHEN l.tipo = 'una_vez' AND COALESCE(i.veces_limpiar, 1) > 0 THEN 0
          WHEN l.tipo = 'una_vez' AND COALESCE(i.veces_limpiar, 1) = 0 THEN 1
          ELSE 0
        END as shared_completed,
        -- shared_remaining: para una_vez, usar veces_limpiar (fallback 1 si null)
        -- Para recurrentes, siempre 0
        CASE 
          WHEN l.tipo = 'una_vez' THEN GREATEST(COALESCE(i.veces_limpiar, 1), 0)
          ELSE 0
        END as shared_remaining,
        0 as pde_completed,
        jsonb_build_object(
          'lista_tipo', l.tipo,
          'veces_limpiar_catalog', i.veces_limpiar,
          'frecuencia_dias_catalog', i.frecuencia_dias
        ) as meta,
        now() as created_at,
        now() as updated_at
      FROM items_transmutaciones i
      JOIN listas_transmutaciones l ON l.id = i.lista_id
      WHERE (i.status = 'active' OR i.activo = true)
        AND (l.status = 'active' OR l.activo = true)
        AND i.item_ref IS NOT NULL
        AND (i.nivel IS NULL OR i.nivel <= $4::integer)
        AND NOT EXISTS (
          SELECT 1 
          FROM cleaning_item_state s
          WHERE s.student_id = $1::uuid
            AND s.product_key = $2::text
            AND s.domain_type = $3::text
            AND s.item_ref = i.item_ref
        )
      ON CONFLICT (student_id, product_key, domain_type, item_ref) DO NOTHING
    `, [student_uuid, product_key, domain_type, nivelCap]);
    
    const inserted = insertResult.rowCount || 0;
    
    // 3. Contar total de items aplicables (para métricas)
    const totalResult = await queryFn(`
      SELECT COUNT(*) as total
      FROM items_transmutaciones i
      WHERE (i.status = 'active' OR i.activo = true)
        AND i.item_ref IS NOT NULL
        AND (i.nivel IS NULL OR i.nivel <= $1::integer)
    `, [nivelCap]);
    
    const totalApplicable = parseInt(totalResult.rows[0]?.total || '0', 10);
    
    // 4. Contar estados existentes (para calcular skipped)
    const existingResult = await queryFn(`
      SELECT COUNT(*) as total
      FROM cleaning_item_state
      WHERE student_id = $1
        AND product_key = $2
        AND domain_type = $3
    `, [student_uuid, product_key, domain_type]);
    
    const existing = parseInt(existingResult.rows[0]?.total || '0', 10);
    const skipped = existing - (totalApplicable - inserted);
    
    logInfo('SEED_CLEAN_STATE', 'Seed completado', {
      traceId,
      student_uuid,
      product_key,
      domain_type,
      level_cap: nivelCap,
      level_cap_provided: level_cap !== null,
      inserted,
      skipped,
      total_applicable: totalApplicable,
      total_existing: existing
    });
    
    return {
      inserted,
      skipped,
      total_applicable: totalApplicable,
      total_existing: existing
    };
  } catch (error) {
    logWarn('SEED_CLEAN_STATE', 'Error en seed (fail-open)', {
      traceId,
      student_uuid,
      product_key,
      domain_type,
      error: error.message,
      code: error.code
    });
    // Fail-open: retornar 0 insertados pero no lanzar error
    return {
      inserted: 0,
      skipped: 0,
      total_applicable: 0,
      total_existing: 0,
      error: error.message
    };
  }
}
