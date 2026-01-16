// scripts/verify-reset-recurrent-invariants-v1.js
// Script de verificación de invariantes para reset recurrente
// FALLA (exit 1) si existen filas corruptas
//
// USAGE:
//   node scripts/verify-reset-recurrent-invariants-v1.js
//
// RESULTADO:
//   - Exit 0: todas las invariantes cumplidas
//   - Exit 1: violaciones encontradas (ejecutar repair script)
//
// REFERENCIAS:
//   - docs/RESET_RECURRENTE_V1_CLOSURE_REPORT.md
//   - docs/DIAGNOSTICO_RESET_RECURRENTE_DB_V1.md
//   - docs/INVARIANTES_CONSTITUCIONALES.md (Invariante 12)

import dotenv from 'dotenv';
dotenv.config();

import { query } from '../database/pg.js';

async function verifyInvariants() {
  console.log('[VERIFY][RESET_RECURRENTE_V1] ========================================');
  console.log('[VERIFY][RESET_RECURRENTE_V1] VERIFICACIÓN DE INVARIANTES');
  console.log('[VERIFY][RESET_RECURRENTE_V1] ========================================\n');

  let hasViolations = false;

  // Verificar PDE
  const pdeViolations = await query(`
    SELECT COUNT(*) as count
    FROM cleaning_item_state
    WHERE pde_effective_since IS NOT NULL
      AND pde_last_cleaned_at IS NOT NULL
      AND pde_last_cleaned_at < pde_effective_since
      AND pde_clean_count > 0
  `);

  const pdeCount = parseInt(pdeViolations.rows[0]?.count || '0', 10);
  if (pdeCount > 0) {
    hasViolations = true;
    console.error(`[VERIFY][RESET_RECURRENTE_V1] ❌ VIOLACIÓN INVARIANTE (PDE): ${pdeCount} filas corruptas`);
    console.error(`[VERIFY][RESET_RECURRENTE_V1] Patrón: pde_effective_since IS NOT NULL pero pde_last_cleaned_at < pde_effective_since y pde_clean_count > 0\n`);
  } else {
    console.log(`[VERIFY][RESET_RECURRENTE_V1] ✅ Invariante PDE: OK (0 violaciones)\n`);
  }

  // Verificar SHARED
  const sharedViolations = await query(`
    SELECT COUNT(*) as count
    FROM cleaning_item_state
    WHERE shared_effective_since IS NOT NULL
      AND shared_last_cleaned_at IS NOT NULL
      AND shared_last_cleaned_at < shared_effective_since
      AND shared_clean_count > 0
  `);

  const sharedCount = parseInt(sharedViolations.rows[0]?.count || '0', 10);
  if (sharedCount > 0) {
    hasViolations = true;
    console.error(`[VERIFY][RESET_RECURRENTE_V1] ❌ VIOLACIÓN INVARIANTE (SHARED): ${sharedCount} filas corruptas`);
    console.error(`[VERIFY][RESET_RECURRENTE_V1] Patrón: shared_effective_since IS NOT NULL pero shared_last_cleaned_at < shared_effective_since y shared_clean_count > 0\n`);
  } else {
    console.log(`[VERIFY][RESET_RECURRENTE_V1] ✅ Invariante SHARED: OK (0 violaciones)\n`);
  }

  // Resumen
  console.log('[VERIFY][RESET_RECURRENTE_V1] ========================================');
  if (hasViolations) {
    console.error(`[VERIFY][RESET_RECURRENTE_V1] ❌ VERIFICACIÓN FALLÓ: ${pdeCount + sharedCount} violaciones encontradas`);
    console.error(`[VERIFY][RESET_RECURRENTE_V1] Ejecuta: node scripts/repair-reset-recurrent-corruption-v1.js --dry-run\n`);
    process.exit(1);
  } else {
    console.log('[VERIFY][RESET_RECURRENTE_V1] ✅ VERIFICACIÓN EXITOSA: todas las invariantes cumplidas\n');
    process.exit(0);
  }
}

verifyInvariants().catch(error => {
  console.error('[VERIFY][RESET_RECURRENTE_V1] ❌ ERROR FATAL:', error);
  console.error(error.stack);
  process.exit(1);
});
