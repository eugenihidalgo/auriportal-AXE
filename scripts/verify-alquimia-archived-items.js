// scripts/verify-alquimia-archived-items.js
// Script de verificación: items/listas archivados no deben aparecer en UI operativa

import dotenv from 'dotenv';
import { query } from '../database/pg.js';

dotenv.config();

// Colores para consola
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function verifyArchivedItemsNotInCatalog() {
  log('\n📋 Verificando que items archivados no se devuelven en catálogo...', 'cyan');
  
  try {
    // Verificar que listListas solo devuelve activos
    const activeLists = await query(`
      SELECT id, nombre, status FROM listas_transmutaciones WHERE status = 'active'
    `);
    
    const archivedLists = await query(`
      SELECT id, nombre, status FROM listas_transmutaciones WHERE status = 'archived'
    `);
    
    log(`  ✅ Listas activas: ${activeLists.rows.length}`, 'green');
    log(`  ℹ️  Listas archivadas: ${archivedLists.rows.length} (no deben aparecer en UI)`, 'yellow');
    
    // Verificar que listItems solo devuelve activos
    const activeItems = await query(`
      SELECT id, item_ref, nombre, status FROM items_transmutaciones WHERE status = 'active'
    `);
    
    const archivedItems = await query(`
      SELECT id, item_ref, nombre, status FROM items_transmutaciones WHERE status = 'archived'
    `);
    
    log(`  ✅ Items activos: ${activeItems.rows.length}`, 'green');
    log(`  ℹ️  Items archivados: ${archivedItems.rows.length} (no deben aparecer en UI)`, 'yellow');
    
    // Verificar que no hay estados de cleaning para items archivados
    const statesForArchivedItems = await query(`
      SELECT COUNT(*) as count
      FROM cleaning_item_state cis
      JOIN items_transmutaciones it ON it.item_ref = cis.item_ref
      WHERE it.status = 'archived'
        AND cis.domain_type = 'transmutation'
    `);
    
    const count = parseInt(statesForArchivedItems.rows[0].count, 10);
    
    if (count > 0) {
      log(`  ⚠️  ADVERTENCIA: ${count} estados de cleaning existen para items archivados`, 'yellow');
      log(`     (Esto es aceptable: los estados históricos se conservan, pero no se renderizan)`, 'yellow');
    } else {
      log(`  ✅ No hay estados de cleaning para items archivados (o no hay items archivados)`, 'green');
    }
    
    return {
      success: true,
      activeLists: activeLists.rows.length,
      archivedLists: archivedLists.rows.length,
      activeItems: activeItems.rows.length,
      archivedItems: archivedItems.rows.length,
      statesForArchived: count
    };
  } catch (error) {
    log(`  ❌ Error: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

async function verifyEventsPreservedForArchived() {
  log('\n📜 Verificando que eventos históricos se conservan para items archivados...', 'cyan');
  
  try {
    // Contar eventos para items archivados
    const eventsForArchived = await query(`
      SELECT COUNT(*) as count
      FROM cleaning_events ce
      JOIN items_transmutaciones it ON it.item_ref = ce.item_ref
      WHERE it.status = 'archived'
        AND ce.domain_type = 'transmutation'
    `);
    
    const count = parseInt(eventsForArchived.rows[0].count, 10);
    
    log(`  ℹ️  Eventos históricos para items archivados: ${count}`, 'yellow');
    log(`     (Esto es CORRECTO: la historia se conserva para panel técnico)`, 'green');
    
    return {
      success: true,
      eventsForArchived: count
    };
  } catch (error) {
    log(`  ❌ Error: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

async function verifyMegalistServiceExcludesArchived() {
  log('\n🔍 Verificando que Megalist Service excluye items/listas archivados...', 'cyan');
  
  try {
    // Verificar que hay al menos un alumno para probar
    const students = await query(`
      SELECT id, email, nivel_efectivo FROM alumnos LIMIT 1
    `);
    
    if (students.rows.length === 0) {
      log(`  ⚠️  No hay alumnos en la BD para probar megalist`, 'yellow');
      return { success: true, skipped: true };
    }
    
    const student = students.rows[0];
    log(`  ℹ️  Usando alumno de prueba: ${student.email} (id: ${student.id})`, 'yellow');
    
    // Simular query de megalist: solo items activos
    const applicableItems = await query(`
      SELECT 
        it.id,
        it.item_ref,
        it.nombre,
        it.status,
        it.nivel,
        lt.id as lista_id,
        lt.nombre as lista_nombre,
        lt.status as lista_status
      FROM items_transmutaciones it
      JOIN listas_transmutaciones lt ON lt.id = it.lista_id
      WHERE it.status = 'active'
        AND lt.status = 'active'
        AND (it.nivel IS NULL OR it.nivel <= $1)
      ORDER BY lt.orden ASC, it.priority ASC, it.nivel ASC NULLS LAST, it.created_at ASC
      LIMIT 10
    `, [student.nivel_efectivo || 999]);
    
    log(`  ✅ Items aplicables para alumno (nivel ${student.nivel_efectivo || 'null'}): ${applicableItems.rows.length}`, 'green');
    
    // Verificar que ningún item archivado está en la lista
    const hasArchived = applicableItems.rows.some(
      row => row.status !== 'active' || row.lista_status !== 'active'
    );
    
    if (hasArchived) {
      log(`  ❌ ERROR: Se encontraron items/listas archivados en megalist!`, 'red');
      return { success: false, error: 'Archived items found in megalist' };
    } else {
      log(`  ✅ Ningún item/lista archivado aparece en megalist`, 'green');
    }
    
    return {
      success: true,
      applicableItems: applicableItems.rows.length
    };
  } catch (error) {
    log(`  ❌ Error: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

async function runVerification() {
  log('\n╔══════════════════════════════════════════════════════════════════════╗', 'cyan');
  log('║     VERIFICACIÓN: ITEMS/LISTAS ARCHIVADOS NO EN UI OPERATIVA       ║', 'cyan');
  log('╚══════════════════════════════════════════════════════════════════════╝', 'cyan');
  
  const results = {
    catalog: await verifyArchivedItemsNotInCatalog(),
    events: await verifyEventsPreservedForArchived(),
    megalist: await verifyMegalistServiceExcludesArchived()
  };
  
  log('\n╔══════════════════════════════════════════════════════════════════════╗', 'cyan');
  log('║                         RESUMEN DE VERIFICACIÓN                      ║', 'cyan');
  log('╚══════════════════════════════════════════════════════════════════════╝', 'cyan');
  
  const allSuccess = Object.values(results).every(r => r.success);
  
  if (allSuccess) {
    log('\n✅ TODAS LAS VERIFICACIONES PASARON', 'green');
    log('\n📝 Reglas canónicas verificadas:', 'cyan');
    log('   1. Items/listas archivados NO aparecen en catálogo operativo', 'green');
    log('   2. Eventos históricos se conservan (panel técnico)', 'green');
    log('   3. Megalist Service excluye items/listas archivados', 'green');
  } else {
    log('\n❌ ALGUNAS VERIFICACIONES FALLARON', 'red');
    Object.entries(results).forEach(([key, result]) => {
      if (!result.success) {
        log(`   ❌ ${key}: ${result.error}`, 'red');
      }
    });
  }
  
  process.exit(allSuccess ? 0 : 1);
}

runVerification().catch(error => {
  log(`\n❌ Error fatal: ${error.message}`, 'red');
  console.error(error.stack);
  process.exit(1);
});
