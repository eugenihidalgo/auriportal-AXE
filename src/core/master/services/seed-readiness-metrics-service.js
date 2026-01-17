// src/core/master/services/seed-readiness-metrics-service.js
// Seed Readiness Metrics Service v1
//
// Calcula métricas de estado de seed SIN ejecutar seed.
// Estas métricas indican si un alumno necesita seed para items aplicables.
//
// CONSTITUCIONAL: Este servicio NO ejecuta seed, solo calcula métricas observables.

import { query } from '../../../../database/pg.js';
import { getRequestId } from '../../observability/request-context.js';
import { logInfo } from '../../observability/logger.js';

/**
 * Calcula métricas de estado de seed para un alumno
 * 
 * NO ejecuta seed, solo calcula métricas observables.
 * 
 * @param {Object} options - Opciones
 * @param {string} options.student_uuid - UUID canónico del estudiante (OBLIGATORIO)
 * @param {string} [options.product_key='pde'] - Product key
 * @param {string} [options.domain_type='transmutation'] - Domain type
 * @param {number} options.level_cap - Cap de nivel OBSERVADO (OBLIGATORIO, no null)
 * @param {string} [options.lista_tipo] - Filtrar por tipo de lista (opcional: 'recurrente' | 'una_vez')
 * @param {Object} [options.client] - Cliente de transacción (opcional)
 * @returns {Promise<Object>} { total_applicable_items, total_items_with_state, missing_state_count, needs_initialize, sample_missing_item_refs }
 */
export async function calculateSeedReadinessMetrics(options = {}, client = null) {
  const traceId = getRequestId();
  const {
    student_uuid,
    product_key = 'pde',
    domain_type = 'transmutation',
    level_cap,
    lista_tipo = null
  } = options;

  // Validar campos requeridos
  if (!student_uuid) {
    throw new Error('student_uuid es requerido');
  }

  // Validar formato UUID
  if (typeof student_uuid !== 'string' || !student_uuid.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    throw new Error('student_uuid debe ser un UUID válido');
  }

  // Validar level_cap (OBLIGATORIO)
  if (level_cap === null || level_cap === undefined) {
    throw new Error('level_cap es requerido (no puede ser null). Debe ser observado explícito.');
  }

  // Validar y normalizar level_cap
  let nivelCap;
  if (level_cap === 'infinity' || level_cap === '∞') {
    nivelCap = 999;
  } else {
    nivelCap = parseInt(level_cap, 10);
    if (isNaN(nivelCap) || nivelCap < 1) {
      throw new Error(`level_cap debe ser un número >= 1, recibido: ${level_cap}`);
    }
  }

  const queryFn = client ? client.query.bind(client) : query;

  try {
    // 1. Contar total de items aplicables (mismos criterios que seed)
    // Filtros:
    // - Items activos (status='active' OR activo=true)
    // - Items con item_ref no null
    // - Items con nivel <= nivelCap (usando COALESCE para NULL)
    // - Items de lista_tipo si viene (opcional)
    const totalApplicableResult = await queryFn(`
      SELECT COUNT(*) as total
      FROM items_transmutaciones i
      JOIN listas_transmutaciones l ON l.id = i.lista_id
      WHERE (i.status = 'active' OR i.activo = true)
        AND (l.status = 'active' OR l.activo = true)
        AND i.item_ref IS NOT NULL
        AND COALESCE(i.nivel, 0) <= $1::integer
        AND ($2::text IS NULL OR l.tipo = $2::text)
    `, [nivelCap, lista_tipo]);

    const totalApplicableItems = parseInt(totalApplicableResult.rows[0]?.total || '0', 10);

    // 2. Contar items con estado existente en cleaning_item_state
    // Mismos criterios de aplicabilidad, pero solo items que tienen estado
    const totalWithStateResult = await queryFn(`
      SELECT COUNT(DISTINCT i.item_ref) as total
      FROM items_transmutaciones i
      JOIN listas_transmutaciones l ON l.id = i.lista_id
      INNER JOIN cleaning_item_state s ON s.item_ref = i.item_ref
      WHERE (i.status = 'active' OR i.activo = true)
        AND (l.status = 'active' OR l.activo = true)
        AND i.item_ref IS NOT NULL
        AND COALESCE(i.nivel, 0) <= $1::integer
        AND ($2::text IS NULL OR l.tipo = $2::text)
        AND s.student_id = $3::uuid
        AND s.product_key = $4::text
        AND s.domain_type = $5::text
    `, [nivelCap, lista_tipo, student_uuid, product_key, domain_type]);

    const totalItemsWithState = parseInt(totalWithStateResult.rows[0]?.total || '0', 10);

    // 3. Calcular missing_state_count
    const missingStateCount = Math.max(0, totalApplicableItems - totalItemsWithState);

    // 4. Obtener sample de item_refs faltantes (máximo 10) - solo si es barato
    // Solo obtener sample si hay items faltantes y es relativamente barato
    let sampleMissingItemRefs = [];
    if (missingStateCount > 0 && missingStateCount <= 50) {
      // Solo obtener sample si hay menos de 50 items faltantes (para no encarecer)
      const sampleResult = await queryFn(`
        SELECT DISTINCT i.item_ref
        FROM items_transmutaciones i
        JOIN listas_transmutaciones l ON l.id = i.lista_id
        WHERE (i.status = 'active' OR i.activo = true)
          AND (l.status = 'active' OR l.activo = true)
          AND i.item_ref IS NOT NULL
          AND COALESCE(i.nivel, 0) <= $1::integer
          AND ($2::text IS NULL OR l.tipo = $2::text)
          AND NOT EXISTS (
            SELECT 1 
            FROM cleaning_item_state s
            WHERE s.student_id = $3::uuid
              AND s.product_key = $4::text
              AND s.domain_type = $5::text
              AND s.item_ref = i.item_ref
          )
        ORDER BY i.item_ref
        LIMIT 10
      `, [nivelCap, lista_tipo, student_uuid, product_key, domain_type]);

      sampleMissingItemRefs = sampleResult.rows.map(row => row.item_ref);
    }

    const metrics = {
      total_applicable_items: totalApplicableItems,
      total_items_with_state: totalItemsWithState,
      missing_state_count: missingStateCount,
      needs_initialize: missingStateCount > 0,
      ...(sampleMissingItemRefs.length > 0 ? { sample_missing_item_refs: sampleMissingItemRefs } : {})
    };

    logInfo('SEED_READINESS_METRICS', 'Métricas calculadas', {
      traceId,
      student_uuid,
      product_key,
      domain_type,
      level_cap: nivelCap,
      lista_tipo,
      ...metrics
    });

    return metrics;
  } catch (error) {
    // Fail-open: retornar métricas en 0 si falla
    logInfo('SEED_READINESS_METRICS', 'Error calculando métricas (fail-open)', {
      traceId,
      student_uuid,
      product_key,
      domain_type,
      level_cap: nivelCap,
      error: error.message
    });
    
    return {
      total_applicable_items: 0,
      total_items_with_state: 0,
      missing_state_count: 0,
      needs_initialize: false
    };
  }
}
