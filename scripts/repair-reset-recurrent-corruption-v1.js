// scripts/repair-reset-recurrent-corruption-v1.js
// Script one-shot para reparar corrupción legacy en reset recurrente
// REPARA: effective_since IS NOT NULL pero last_cleaned_at < effective_since y clean_count > 0
//
// USAGE:
//   # Dry-run (por defecto, no aplica cambios)
//   node scripts/repair-reset-recurrent-corruption-v1.js
//
//   # Aplicar reparación
//   node scripts/repair-reset-recurrent-corruption-v1.js --apply
//
//   # Filtrar por estudiante
//   node scripts/repair-reset-recurrent-corruption-v1.js --student-uuid <uuid>
//
//   # Filtrar por capa
//   node scripts/repair-reset-recurrent-corruption-v1.js --layer pde|shared|both
//
// REFERENCIAS:
//   - docs/RESET_RECURRENTE_V1_CLOSURE_REPORT.md
//   - docs/DIAGNOSTICO_RESET_RECURRENTE_DB_V1.md

import dotenv from 'dotenv';
dotenv.config();

import { query } from '../database/pg.js';

const DEFAULT_DRY_RUN = true;

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    dryRun: DEFAULT_DRY_RUN,
    layer: 'both', // pde | shared | both
    studentUuid: null
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--apply') {
      options.dryRun = false;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--layer' && args[i + 1]) {
      options.layer = args[i + 1];
      i++;
    } else if (arg === '--student-uuid' && args[i + 1]) {
      options.studentUuid = args[i + 1];
      i++;
    }
  }

  if (options.layer !== 'pde' && options.layer !== 'shared' && options.layer !== 'both') {
    console.error('[REPAIR][RESET_RECURRENTE_V1] ❌ --layer debe ser: pde, shared, o both');
    process.exit(1);
  }

  return options;
}

async function repairCorruption(options) {
  console.log('[REPAIR][RESET_RECURRENTE_V1] ========================================');
  console.log('[REPAIR][RESET_RECURRENTE_V1] REPARACIÓN DE CORRUPCIÓN LEGACY');
  console.log('[REPAIR][RESET_RECURRENTE_V1] ========================================');
  console.log(`[REPAIR][RESET_RECURRENTE_V1] Modo: ${options.dryRun ? 'DRY-RUN (no aplica cambios)' : 'APPLY (aplica cambios)'}`);
  console.log(`[REPAIR][RESET_RECURRENTE_V1] Layer: ${options.layer}`);
  console.log(`[REPAIR][RESET_RECURRENTE_V1] Student UUID: ${options.studentUuid || 'todos'}\n`);

  const layers = options.layer === 'both' ? ['pde', 'shared'] : [options.layer];
  const totalAffected = { pde: 0, shared: 0 };
  const byStudent = {};

  for (const layer of layers) {
    const effectiveSinceColumn = `${layer}_effective_since`;
    const lastCleanedColumn = `${layer}_last_cleaned_at`;
    const countColumn = `${layer}_clean_count`;

    // Buscar filas corruptas
    let whereClause = `
      ${effectiveSinceColumn} IS NOT NULL
      AND ${lastCleanedColumn} IS NOT NULL
      AND ${lastCleanedColumn} < ${effectiveSinceColumn}
      AND ${countColumn} > 0
    `;

    const params = [];
    if (options.studentUuid) {
      whereClause += ` AND student_id = $${params.length + 1}`;
      params.push(options.studentUuid);
    }

    const selectQuery = `
      SELECT 
        student_id,
        item_ref,
        ${effectiveSinceColumn} as effective_since,
        ${lastCleanedColumn} as last_cleaned_at,
        ${countColumn} as clean_count
      FROM cleaning_item_state
      WHERE ${whereClause}
      ORDER BY student_id, item_ref
    `;

    console.log(`[REPAIR][RESET_RECURRENTE_V1] Buscando corrupción en layer: ${layer.toUpperCase()}...`);
    const result = await query(selectQuery, params);
    
    totalAffected[layer] = result.rows.length;
    console.log(`[REPAIR][RESET_RECURRENTE_V1] Filas corruptas encontradas (${layer.toUpperCase()}): ${result.rows.length}\n`);

    // Agrupar por student_uuid
    result.rows.forEach(row => {
      if (!byStudent[row.student_id]) {
        byStudent[row.student_id] = { pde: 0, shared: 0, items: [] };
      }
      byStudent[row.student_id][layer]++;
      if (!byStudent[row.student_id].items.includes(row.item_ref)) {
        byStudent[row.student_id].items.push(row.item_ref);
      }
    });

    // Si hay filas y NO es dry-run, aplicar reparación
    if (result.rows.length > 0 && !options.dryRun) {
      console.log(`[REPAIR][RESET_RECURRENTE_V1] Aplicando reparación en layer: ${layer.toUpperCase()}...`);
      
      const updateQuery = `
        UPDATE cleaning_item_state
        SET 
          ${lastCleanedColumn} = NULL,
          ${countColumn} = 0,
          updated_at = CURRENT_TIMESTAMP
        WHERE ${whereClause}
      `;

      await query('BEGIN');
      try {
        const updateResult = await query(updateQuery, params);
        await query('COMMIT');
        console.log(`[REPAIR][RESET_RECURRENTE_V1] ✅ Reparación aplicada (${layer.toUpperCase()}): ${updateResult.rowCount} filas actualizadas\n`);
      } catch (error) {
        await query('ROLLBACK');
        console.error(`[REPAIR][RESET_RECURRENTE_V1] ❌ Error aplicando reparación (${layer.toUpperCase()}):`, error.message);
        throw error;
      }
    } else if (result.rows.length > 0 && options.dryRun) {
      console.log(`[REPAIR][RESET_RECURRENTE_V1] [DRY-RUN] Se repararían ${result.rows.length} filas (${layer.toUpperCase()})\n`);
    }

    // Mostrar sample (primeras 5 filas)
    if (result.rows.length > 0) {
      console.log(`[REPAIR][RESET_RECURRENTE_V1] Sample de filas corruptas (${layer.toUpperCase()}):`);
      result.rows.slice(0, 5).forEach((row, idx) => {
        console.log(`  ${idx + 1}. student_id: ${row.student_id}, item_ref: ${row.item_ref}`);
        console.log(`     effective_since: ${row.effective_since}`);
        console.log(`     last_cleaned_at: ${row.last_cleaned_at}`);
        console.log(`     clean_count: ${row.clean_count}`);
      });
      if (result.rows.length > 5) {
        console.log(`  ... y ${result.rows.length - 5} filas más`);
      }
      console.log('');
    }
  }

  // Resumen final
  console.log('[REPAIR][RESET_RECURRENTE_V1] ========================================');
  console.log('[REPAIR][RESET_RECURRENTE_V1] RESUMEN');
  console.log('[REPAIR][RESET_RECURRENTE_V1] ========================================');
  console.log(`[REPAIR][RESET_RECURRENTE_V1] Total filas corruptas (PDE): ${totalAffected.pde}`);
  console.log(`[REPAIR][RESET_RECURRENTE_V1] Total filas corruptas (SHARED): ${totalAffected.shared}`);
  console.log(`[REPAIR][RESET_RECURRENTE_V1] Total estudiantes afectados: ${Object.keys(byStudent).length}\n`);

  if (Object.keys(byStudent).length > 0) {
    console.log('[REPAIR][RESET_RECURRENTE_V1] Top 10 estudiantes afectados:');
    const sortedStudents = Object.entries(byStudent)
      .sort((a, b) => (b[1].pde + b[1].shared) - (a[1].pde + a[1].shared))
      .slice(0, 10);
    
    sortedStudents.forEach(([studentId, counts]) => {
      const total = counts.pde + counts.shared;
      console.log(`  ${studentId}: ${total} filas (PDE: ${counts.pde}, SHARED: ${counts.shared}, items: ${counts.items.length})`);
    });
    console.log('');
  }

  if (options.dryRun) {
    console.log('[REPAIR][RESET_RECURRENTE_V1] ⚠️  Modo DRY-RUN: no se aplicaron cambios');
    console.log('[REPAIR][RESET_RECURRENTE_V1] Para aplicar cambios, ejecuta con: --apply\n');
  } else {
    console.log('[REPAIR][RESET_RECURRENTE_V1] ✅ Reparación completada\n');
  }

  return {
    totalAffected,
    byStudent,
    repaired: !options.dryRun
  };
}

async function main() {
  try {
    const options = parseArgs();
    await repairCorruption(options);
    process.exit(0);
  } catch (error) {
    console.error('[REPAIR][RESET_RECURRENTE_V1] ❌ ERROR FATAL:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
