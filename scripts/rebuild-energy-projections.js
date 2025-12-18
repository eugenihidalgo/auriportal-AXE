// scripts/rebuild-energy-projections.js
// Script para reconstruir proyecciones energéticas desde energy_events
//
// OBJETIVO: Recalcular proyecciones (read models) desde la fuente de verdad (energy_events)
// PRINCIPIO: Procesa eventos en batches y actualiza proyecciones incrementalmente
//
// USO:
//   node scripts/rebuild-energy-projections.js --dry-run                    # Solo simula sin actualizar
//   node scripts/rebuild-energy-projections.js --apply                     # Aplica cambios
//   node scripts/rebuild-energy-projections.js --apply --from-event-id 100  # Desde evento específico
//   node scripts/rebuild-energy-projections.js --apply --to-event-id 1000   # Hasta evento específico
//   node scripts/rebuild-energy-projections.js --apply --batch-size 500    # Tamaño de batch personalizado

import dotenv from 'dotenv';
import { initPostgreSQL } from '../database/pg.js';
import { backfillProjections } from '../src/core/energy/energy-projection.js';

// Cargar variables de entorno
dotenv.config();

// Parsear argumentos
const args = process.argv.slice(2);
const applyMode = args.includes('--apply');
const dryRun = !applyMode;

// Validar que se especifique --dry-run o --apply
if (!args.includes('--dry-run') && !args.includes('--apply')) {
  console.error('❌ Error: Debes especificar --dry-run o --apply');
  console.error('   Uso: node scripts/rebuild-energy-projections.js --dry-run');
  console.error('   Uso: node scripts/rebuild-energy-projections.js --apply');
  process.exit(1);
}

// Parsear opciones adicionales
let fromEventId = null;
let toEventId = null;
let batchSize = 1000;

const fromEventIdIndex = args.indexOf('--from-event-id');
if (fromEventIdIndex !== -1 && args[fromEventIdIndex + 1]) {
  fromEventId = parseInt(args[fromEventIdIndex + 1], 10);
  if (isNaN(fromEventId)) {
    console.error('❌ Error: --from-event-id debe ser un número');
    process.exit(1);
  }
}

const toEventIdIndex = args.indexOf('--to-event-id');
if (toEventIdIndex !== -1 && args[toEventIdIndex + 1]) {
  toEventId = parseInt(args[toEventIdIndex + 1], 10);
  if (isNaN(toEventId)) {
    console.error('❌ Error: --to-event-id debe ser un número');
    process.exit(1);
  }
}

const batchSizeIndex = args.indexOf('--batch-size');
if (batchSizeIndex !== -1 && args[batchSizeIndex + 1]) {
  batchSize = parseInt(args[batchSizeIndex + 1], 10);
  if (isNaN(batchSize) || batchSize < 1) {
    console.error('❌ Error: --batch-size debe ser un número mayor que 0');
    process.exit(1);
  }
}

/**
 * Función principal
 */
async function main() {
  console.log('\n🔧 ========================================');
  console.log('🔧 REBUILD ENERGY PROJECTIONS');
  console.log('🔧 ========================================\n');

  console.log(`   📋 Configuración:`);
  console.log(`      - Modo: ${dryRun ? 'DRY-RUN (simulación)' : 'APPLY (aplicar cambios)'}`);
  console.log(`      - From Event ID: ${fromEventId || 'null (desde el principio)'}`);
  console.log(`      - To Event ID: ${toEventId || 'null (hasta el final)'}`);
  console.log(`      - Batch Size: ${batchSize}`);
  console.log('');

  try {
    // Inicializar PostgreSQL
    console.log('📦 Inicializando conexión a PostgreSQL...');
    initPostgreSQL();
    console.log('   ✅ PostgreSQL conectado\n');

    // Ejecutar backfill
    console.log('🔄 Iniciando backfill de proyecciones...\n');
    
    const startTime = Date.now();
    const result = await backfillProjections({
      fromEventId,
      toEventId,
      dryRun,
      batchSize
    });
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    // Mostrar resultados
    console.log('\n📊 ========================================');
    console.log('📊 RESULTADOS');
    console.log('📊 ========================================\n');

    if (result.success) {
      console.log(`   ✅ Backfill completado exitosamente`);
      console.log(`   ⏱️  Duración: ${duration}s`);
      console.log(`   📈 Eventos procesados: ${result.processed}`);
      console.log(`   ❌ Errores: ${result.errors}`);
      
      if (result.stats) {
        console.log('\n   📊 Estadísticas:');
        console.log(`      - Total eventos: ${result.stats.totalEvents}`);
        console.log(`      - Eventos con subject: ${result.stats.eventsWithSubject}`);
        console.log(`      - Eventos de iluminación: ${result.stats.illuminationEvents}`);
        console.log(`      - Eventos de limpieza: ${result.stats.cleaningEvents}`);
        console.log(`      - Proyecciones actualizadas: ${result.stats.projectionsUpdated}`);
      }

      if (result.lastEventId) {
        console.log(`\n   🔖 Último evento procesado: ${result.lastEventId}`);
      }

      if (dryRun) {
        console.log('\n   💡 Modo DRY-RUN: No se aplicaron cambios reales.');
        console.log('   💡 Ejecuta con --apply para aplicar los cambios.\n');
      } else {
        console.log('\n   ✅ Cambios aplicados exitosamente.\n');
      }
    } else {
      console.log(`   ❌ Backfill falló: ${result.error || 'Error desconocido'}`);
      console.log(`   📈 Eventos procesados antes del error: ${result.processed || 0}`);
      console.log(`   ❌ Errores: ${result.errors || 0}\n`);
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ ========================================');
    console.error('❌ ERROR CRÍTICO');
    console.error('❌ ========================================\n');
    console.error(`   Error: ${error.message}`);
    console.error(`   Stack: ${error.stack}\n`);
    process.exit(1);
  }
}

// Ejecutar si es el módulo principal
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  });
}

export { main };







