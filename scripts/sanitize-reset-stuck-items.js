#!/usr/bin/env node
/**
 * Script de Saneamiento - Reset Stuck Items v1
 * 
 * OBJETIVO: Sanear estados encallados provocados por resets históricos mal ejecutados
 * 
 * REGLAS:
 * - NO modifica cleaning_events (append-only)
 * - Recalcula cleaning_item_state desde eventos si es necesario
 * - Inserta evento RESET HISTÓRICO si falta (con execution_key único)
 * - Ajusta cleaning_item_state de forma consistente
 * 
 * USO:
 *   node scripts/sanitize-reset-stuck-items.js [--apply]
 * 
 * Por defecto ejecuta en modo DRY_RUN (no modifica DB)
 * Usar --apply para aplicar cambios reales
 */

import 'dotenv/config';
import { query, getPool, initPostgreSQL } from '../database/pg.js';
import { getDefaultCleaningEventsRepo } from '../src/infra/repos/cleaning/cleaning-events-repo-pg.js';
import { getDefaultCleaningItemStateRepo } from '../src/infra/repos/cleaning/cleaning-item-state-repo-pg.js';
import { logInfo, logError, logWarn } from '../src/core/observability/logger.js';

// Inicializar PostgreSQL
initPostgreSQL();

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

const DRY_RUN = !process.argv.includes('--apply');
const PRODUCT_KEY = 'pde';
const DOMAIN_TYPE = 'transmutation';

// ============================================================================
// QUERIES DE DIAGNÓSTICO (unificadas)
// ============================================================================

/**
 * Ejecuta queries de diagnóstico y unifica resultados
 */
async function getStuckItems() {
  const stuckItems = [];

  // Query 2: Reset sin evento
  const resetSinEvento = await query(`
    SELECT 
      cis.student_id AS student_uuid,
      cis.item_ref,
      'shared' AS clean_layer,
      'RESET_SIN_EVENTO_SHARED' AS tipo_inconsistencia
    FROM cleaning_item_state cis
    WHERE cis.product_key = $1
      AND cis.domain_type = $2
      AND cis.shared_effective_since IS NOT NULL
      AND cis.shared_last_cleaned_at IS NULL
      AND cis.shared_clean_count = 0
      AND NOT EXISTS (
        SELECT 1 
        FROM cleaning_events ce 
        WHERE ce.student_id = cis.student_id 
          AND ce.item_ref = cis.item_ref 
          AND ce.clean_layer = 'shared' 
          AND ce.action_type = 'reset'
      )
  `, [PRODUCT_KEY, DOMAIN_TYPE]);

  for (const row of resetSinEvento.rows) {
    stuckItems.push({
      student_uuid: row.student_uuid,
      item_ref: row.item_ref,
      clean_layer: row.clean_layer,
      tipo_inconsistencia: row.tipo_inconsistencia
    });
  }

  // Query 3: Evento reset sin actualización
  const eventoResetSinActualizacion = await query(`
    SELECT 
      ce.student_id AS student_uuid,
      ce.item_ref,
      ce.clean_layer,
      'EVENTO_RESET_SIN_ACTUALIZACION' AS tipo_inconsistencia
    FROM cleaning_events ce
    LEFT JOIN cleaning_item_state cis ON (
      ce.student_id = cis.student_id 
      AND ce.item_ref = cis.item_ref 
      AND ce.product_key = cis.product_key 
      AND ce.domain_type = cis.domain_type
    )
    WHERE ce.action_type = 'reset'
      AND ce.product_key = $1
      AND ce.domain_type = $2
      AND (
        cis.shared_effective_since IS NULL
        OR (ce.clean_layer = 'shared' AND (
          cis.shared_effective_since < ce.created_at
          OR cis.shared_last_cleaned_at IS NOT NULL
          OR cis.shared_clean_count != 0
        ))
        OR (ce.clean_layer = 'pde' AND (
          cis.pde_effective_since IS NULL
          OR cis.pde_effective_since < ce.created_at
          OR cis.pde_last_cleaned_at IS NOT NULL
          OR cis.pde_clean_count != 0
        ))
      )
  `, [PRODUCT_KEY, DOMAIN_TYPE]);

  for (const row of eventoResetSinActualizacion.rows) {
    stuckItems.push({
      student_uuid: row.student_uuid,
      item_ref: row.item_ref,
      clean_layer: row.clean_layer,
      tipo_inconsistencia: row.tipo_inconsistencia
    });
  }

  // Query 4: Fecha futura
  const fechaFutura = await query(`
    SELECT 
      cis.student_id AS student_uuid,
      cis.item_ref,
      'shared' AS clean_layer,
      'FECHA_FUTURA_SHARED' AS tipo_inconsistencia
    FROM cleaning_item_state cis
    WHERE cis.product_key = $1
      AND cis.domain_type = $2
      AND cis.shared_effective_since > NOW()
  `, [PRODUCT_KEY, DOMAIN_TYPE]);

  for (const row of fechaFutura.rows) {
    stuckItems.push({
      student_uuid: row.student_uuid,
      item_ref: row.item_ref,
      clean_layer: row.clean_layer,
      tipo_inconsistencia: row.tipo_inconsistencia
    });
  }

  // Query 5: Contradicción clean_count
  const contradiccion = await query(`
    SELECT 
      cis.student_id AS student_uuid,
      cis.item_ref,
      'shared' AS clean_layer,
      'CONTRADICCION_CLEAN_COUNT_SHARED' AS tipo_inconsistencia
    FROM cleaning_item_state cis
    WHERE cis.product_key = $1
      AND cis.domain_type = $2
      AND (
        (cis.shared_clean_count = 0 AND cis.shared_last_cleaned_at IS NOT NULL)
        OR (cis.shared_clean_count > 0 AND cis.shared_last_cleaned_at IS NULL)
      )
  `, [PRODUCT_KEY, DOMAIN_TYPE]);

  for (const row of contradiccion.rows) {
    stuckItems.push({
      student_uuid: row.student_uuid,
      item_ref: row.item_ref,
      clean_layer: row.clean_layer,
      tipo_inconsistencia: row.tipo_inconsistencia
    });
  }

  // Eliminar duplicados (mismo student_uuid + item_ref + clean_layer)
  const uniqueItems = [];
  const seen = new Set();
  
  for (const item of stuckItems) {
    const key = `${item.student_uuid}:${item.item_ref}:${item.clean_layer}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueItems.push(item);
    }
  }

  return uniqueItems;
}

// ============================================================================
// LÓGICA DE SANEAMIENTO
// ============================================================================

/**
 * Obtiene todos los eventos de limpieza para un item+student+layer
 */
async function getEventsForItem(studentUuid, itemRef, cleanLayer) {
  const eventsRepo = getDefaultCleaningEventsRepo();
  const events = await eventsRepo.listEventsForStudentItem({
    student_uuid: studentUuid,
    item_ref: itemRef,
    product_key: PRODUCT_KEY,
    domain_type: DOMAIN_TYPE
  });

  // Filtrar por clean_layer
  return events.filter(e => e.clean_layer === cleanLayer);
}

/**
 * Deriva estado correcto desde eventos
 */
function deriveCorrectState(events, cleanLayer) {
  // Obtener último reset
  const resets = events
    .filter(e => e.action_type === 'reset')
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  
  const lastReset = resets[0];
  
  if (!lastReset) {
    return null; // No hay reset, no se puede derivar estado
  }

  // Obtener limpiezas post-reset
  const cleansAfterReset = events
    .filter(e => 
      e.action_type === 'mark_clean' 
      && new Date(e.created_at) > new Date(lastReset.created_at)
    )
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return {
    effective_since: new Date(lastReset.created_at),
    last_cleaned_at: cleansAfterReset[0] ? new Date(cleansAfterReset[0].created_at) : null,
    clean_count: cleansAfterReset.length
  };
}

/**
 * Verifica si el estado actual es coherente con el estado derivado
 */
function isStateCoherent(currentState, derivedState, cleanLayer) {
  if (!derivedState) {
    return true; // No hay reset, no se puede verificar
  }

  const effectiveColumn = cleanLayer === 'shared' ? 'shared_effective_since' : 'pde_effective_since';
  const lastCleanedColumn = cleanLayer === 'shared' ? 'shared_last_cleaned_at' : 'pde_last_cleaned_at';
  const countColumn = cleanLayer === 'shared' ? 'shared_clean_count' : 'pde_clean_count';

  const currentEffective = currentState?.[effectiveColumn] ? new Date(currentState[effectiveColumn]) : null;
  const currentLastCleaned = currentState?.[lastCleanedColumn] ? new Date(currentState[lastCleanedColumn]) : null;
  const currentCount = currentState?.[countColumn] || 0;

  // Verificar coherencia (con tolerancia de 1 segundo para timestamps)
  const effectiveDiff = currentEffective && derivedState.effective_since
    ? Math.abs(currentEffective.getTime() - derivedState.effective_since.getTime())
    : (currentEffective === null && derivedState.effective_since === null ? 0 : Infinity);

  const lastCleanedDiff = currentLastCleaned && derivedState.last_cleaned_at
    ? Math.abs(currentLastCleaned.getTime() - derivedState.last_cleaned_at.getTime())
    : (currentLastCleaned === null && derivedState.last_cleaned_at === null ? 0 : Infinity);

  return effectiveDiff < 1000 && lastCleanedDiff < 1000 && currentCount === derivedState.clean_count;
}

/**
 * Sanea un ítem encallado
 */
async function sanitizeItem(item, dryRun = true) {
  const { student_uuid, item_ref, clean_layer, tipo_inconsistencia } = item;
  
  logInfo('SANITIZE', `[${dryRun ? 'DRY_RUN' : 'APPLY'}] Procesando ítem`, {
    student_uuid,
    item_ref,
    clean_layer,
    tipo_inconsistencia
  });

  try {
    // 1. Obtener eventos
    const events = await getEventsForItem(student_uuid, item_ref, clean_layer);
    
    // 2. Obtener estado actual
    const stateRepo = getDefaultCleaningItemStateRepo();
    const currentState = await stateRepo.getState({
      student_uuid,
      item_ref,
      product_key: PRODUCT_KEY,
      domain_type: DOMAIN_TYPE
    });

    // 3. Derivar estado correcto
    const derivedState = deriveCorrectState(events, clean_layer);

    // 4. Verificar si necesita evento histórico
    const needsHistoricalEvent = tipo_inconsistencia === 'RESET_SIN_EVENTO_SHARED' && !events.some(e => e.action_type === 'reset');

    // 5. Verificar si necesita actualización de estado
    const needsStateUpdate = !isStateCoherent(currentState, derivedState, clean_layer);

    if (!needsHistoricalEvent && !needsStateUpdate) {
      logInfo('SANITIZE', 'Ítem ya coherente, saltando', {
        student_uuid,
        item_ref,
        clean_layer
      });
      return { sanitized: false, reason: 'already_coherent' };
    }

    if (dryRun) {
      logInfo('SANITIZE', '[DRY_RUN] Cambios que se aplicarían', {
        student_uuid,
        item_ref,
        clean_layer,
        needs_historical_event: needsHistoricalEvent,
        needs_state_update: needsStateUpdate,
        current_state: currentState,
        derived_state: derivedState
      });
      return { sanitized: true, dry_run: true };
    }

    // 6. Aplicar cambios (en transacción)
    const { getPool } = await import('../database/pg.js');
    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 6.1 Insertar evento histórico si falta
      if (needsHistoricalEvent) {
        const eventsRepo = getDefaultCleaningEventsRepo();
        const historicalExecutionKey = `reset:${item_ref}:${student_uuid}:${clean_layer}:historical:${Date.now()}`;
        
        await eventsRepo.insertEvent({
          trace_id: `sanitize-${Date.now()}`,
          execution_key: historicalExecutionKey,
          student_uuid,
          product_key: PRODUCT_KEY,
          domain_type: DOMAIN_TYPE,
          item_ref,
          clean_layer,
          item_kind: 'recurrente',
          action_type: 'reset',
          delta_completed: null,
          set_remaining: null,
          actor_type: 'master',
          actor_ref: 'sanitize-script',
          surface_key: 'master.sanitize',
          meta: {
            sanitize_reason: tipo_inconsistencia,
            sanitize_timestamp: new Date().toISOString()
          }
        }, client);

        logInfo('SANITIZE', 'Evento histórico insertado', {
          student_uuid,
          item_ref,
          clean_layer,
          execution_key: historicalExecutionKey
        });
      }

      // 6.2 Actualizar estado si es necesario
      if (needsStateUpdate && derivedState) {
        // Usar upsertApplyReset para establecer effective_since y resetear contadores
        await stateRepo.upsertApplyReset({
          student_uuid,
          item_ref,
          clean_layer,
          item_kind: 'recurrente',
          product_key: PRODUCT_KEY,
          domain_type: DOMAIN_TYPE
        }, client);

        // Si hay limpiezas post-reset, actualizar last_cleaned_at y clean_count manualmente
        if (derivedState.last_cleaned_at || derivedState.clean_count > 0) {
          const lastCleanedColumn = clean_layer === 'shared' ? 'shared_last_cleaned_at' : 'pde_last_cleaned_at';
          const countColumn = clean_layer === 'shared' ? 'shared_clean_count' : 'pde_clean_count';

          await client.query(`
            UPDATE cleaning_item_state
            SET ${lastCleanedColumn} = $1,
                ${countColumn} = $2,
                updated_at = CURRENT_TIMESTAMP
            WHERE student_id = $3
              AND product_key = $4
              AND domain_type = $5
              AND item_ref = $6
          `, [
            derivedState.last_cleaned_at,
            derivedState.clean_count,
            student_uuid,
            PRODUCT_KEY,
            DOMAIN_TYPE,
            item_ref
          ]);
        }

        logInfo('SANITIZE', 'Estado actualizado', {
          student_uuid,
          item_ref,
          clean_layer,
          derived_state: derivedState
        });
      }

      await client.query('COMMIT');
      
      logInfo('SANITIZE', 'Ítem saneado exitosamente', {
        student_uuid,
        item_ref,
        clean_layer
      });

      return { sanitized: true, dry_run: false };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    logError('SANITIZE', 'Error saneando ítem', {
      student_uuid,
      item_ref,
      clean_layer,
      error: error.message,
      stack: error.stack
    });
    return { sanitized: false, error: error.message };
  }
}

// ============================================================================
// EJECUCIÓN PRINCIPAL
// ============================================================================

async function main() {
  console.log('='.repeat(80));
  console.log(`SANITIZE RESET STUCK ITEMS v1 - ${DRY_RUN ? 'DRY_RUN' : 'APPLY'}`);
  console.log('='.repeat(80));
  console.log('');

  try {
    // 1. Obtener ítems encallados
    console.log('📊 Obteniendo ítems encallados...');
    const stuckItems = await getStuckItems();
    console.log(`✅ Encontrados ${stuckItems.length} ítems encallados`);
    console.log('');

    // 2. Agrupar por tipo de inconsistencia
    const byType = {};
    for (const item of stuckItems) {
      if (!byType[item.tipo_inconsistencia]) {
        byType[item.tipo_inconsistencia] = [];
      }
      byType[item.tipo_inconsistencia].push(item);
    }

    console.log('📋 Desglose por tipo de inconsistencia:');
    for (const [tipo, items] of Object.entries(byType)) {
      console.log(`  - ${tipo}: ${items.length} ítems`);
    }
    console.log('');

    if (stuckItems.length === 0) {
      console.log('✅ No hay ítems encallados. Sistema coherente.');
      return;
    }

    // 3. Procesar cada ítem
    console.log(`${DRY_RUN ? '🔍 [DRY_RUN]' : '🔧 [APPLY]'} Procesando ítems...`);
    console.log('');

    const results = {
      sanitized: 0,
      skipped: 0,
      errors: 0,
      by_type: {}
    };

    for (const item of stuckItems) {
      const result = await sanitizeItem(item, DRY_RUN);
      
      if (result.sanitized) {
        results.sanitized++;
        if (!results.by_type[item.tipo_inconsistencia]) {
          results.by_type[item.tipo_inconsistencia] = { sanitized: 0, skipped: 0, errors: 0 };
        }
        results.by_type[item.tipo_inconsistencia].sanitized++;
      } else if (result.reason === 'already_coherent') {
        results.skipped++;
        if (!results.by_type[item.tipo_inconsistencia]) {
          results.by_type[item.tipo_inconsistencia] = { sanitized: 0, skipped: 0, errors: 0 };
        }
        results.by_type[item.tipo_inconsistencia].skipped++;
      } else if (result.error) {
        results.errors++;
        if (!results.by_type[item.tipo_inconsistencia]) {
          results.by_type[item.tipo_inconsistencia] = { sanitized: 0, skipped: 0, errors: 0 };
        }
        results.by_type[item.tipo_inconsistencia].errors++;
      }
    }

    // 4. Resumen final
    console.log('');
    console.log('='.repeat(80));
    console.log('RESUMEN FINAL');
    console.log('='.repeat(80));
    console.log(`Total ítems analizados: ${stuckItems.length}`);
    console.log(`✅ Saneados: ${results.sanitized}`);
    console.log(`⏭️  Saltados (ya coherentes): ${results.skipped}`);
    console.log(`❌ Errores: ${results.errors}`);
    console.log('');

    if (Object.keys(results.by_type).length > 0) {
      console.log('Desglose por tipo:');
      for (const [tipo, stats] of Object.entries(results.by_type)) {
        console.log(`  ${tipo}:`);
        console.log(`    - Saneados: ${stats.sanitized}`);
        console.log(`    - Saltados: ${stats.skipped}`);
        console.log(`    - Errores: ${stats.errors}`);
      }
      console.log('');
    }

    if (DRY_RUN) {
      console.log('⚠️  MODO DRY_RUN: No se modificó la base de datos');
      console.log('💡 Para aplicar cambios, ejecutar con flag --apply');
    } else {
      console.log('✅ Cambios aplicados exitosamente');
    }

  } catch (error) {
    console.error('❌ Error fatal:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Ejecutar
main().catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});
