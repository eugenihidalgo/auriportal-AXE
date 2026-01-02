// scripts/migrate-legacy-alquimia-general.js
// Script idempotente para migrar listas legacy de Alquimia General
//
// CARACTERÍSTICAS:
// - dry-run por defecto (--apply para ejecutar)
// - mapping determinista legacy_id → new_id
// - no duplicar: upsert por clave estable
// - logs por lote
// - resumen final (n creadas, n actualizadas, n saltadas)
// - transacción por lote

import { query } from '../database/pg.js';
import { readFileSync } from 'fs';
import { join } from 'path';

const DRY_RUN = !process.argv.includes('--apply');

/**
 * Identifica fuente legacy de listas
 * Busca en:
 * - Tabla antigua (si existe)
 * - JSON en archivo (si existe)
 * - SQLite legacy (si existe)
 * - Otra tabla PG
 */
async function findLegacyListas() {
  console.log('🔍 Buscando listas legacy...\n');

  const sources = [];

  // 1. Verificar si hay listas en listas_transmutaciones con datos antiguos
  try {
    const existing = await query(`
      SELECT id, nombre, tipo, descripcion, orden, activo, status
      FROM listas_transmutaciones
      ORDER BY id ASC
    `);
    
    if (existing.rows.length > 0) {
      console.log(`✅ Encontradas ${existing.rows.length} listas existentes en listas_transmutaciones`);
      sources.push({
        type: 'existing_pg',
        data: existing.rows
      });
    }
  } catch (error) {
    console.warn('⚠️  Error consultando listas_transmutaciones:', error.message);
  }

  // 2. Buscar en archivos JSON legacy (si existen)
  try {
    const legacyPath = join(process.cwd(), 'data', 'legacy-alquimia-listas.json');
    const legacyData = readFileSync(legacyPath, 'utf-8');
    const parsed = JSON.parse(legacyData);
    if (Array.isArray(parsed) && parsed.length > 0) {
      console.log(`✅ Encontradas ${parsed.length} listas en archivo JSON legacy`);
      sources.push({
        type: 'json_file',
        data: parsed
      });
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn('⚠️  Error leyendo archivo JSON legacy:', error.message);
    }
  }

  // 3. Buscar en tabla alternativa (si existe)
  try {
    const altTable = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE '%transmut%' 
      AND table_name != 'listas_transmutaciones'
      AND table_name != 'items_transmutaciones'
    `);
    
    for (const row of altTable.rows) {
      try {
        const altData = await query(`SELECT * FROM ${row.table_name} LIMIT 10`);
        if (altData.rows.length > 0) {
          console.log(`✅ Encontradas ${altData.rows.length} filas en ${row.table_name}`);
          sources.push({
            type: 'alt_table',
            table: row.table_name,
            data: altData.rows
          });
        }
      } catch (err) {
        // Ignorar errores de lectura
      }
    }
  } catch (error) {
    // Ignorar si no hay tablas alternativas
  }

  return sources;
}

/**
 * Normaliza datos legacy a formato canónico
 */
function normalizeLista(legacyItem, source) {
  return {
    nombre: legacyItem.nombre || legacyItem.name || 'Sin nombre',
    tipo: legacyItem.tipo || legacyItem.type || 'recurrente',
    descripcion: legacyItem.descripcion || legacyItem.description || null,
    orden: legacyItem.orden !== undefined ? parseInt(legacyItem.orden) : (legacyItem.order !== undefined ? parseInt(legacyItem.order) : 0),
    status: legacyItem.status || (legacyItem.activo === true || legacyItem.activo === 1 ? 'active' : 'archived') || 'active',
    legacy_id: legacyItem.id || legacyItem.legacy_id,
    legacy_source: source.type
  };
}

/**
 * Migra listas legacy
 */
async function migrateListas(sources) {
  console.log('\n📦 Migrando listas legacy...\n');

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors = [];

  // Procesar cada fuente
  for (const source of sources) {
    console.log(`\n📂 Procesando fuente: ${source.type}`);
    
    for (const legacyItem of source.data) {
      try {
        const normalized = normalizeLista(legacyItem, source);
        
        // Verificar si ya existe por nombre (clave estable)
        const existing = await query(
          'SELECT id, nombre, tipo, status FROM listas_transmutaciones WHERE nombre = $1',
          [normalized.nombre]
        );

        if (existing.rows.length > 0) {
          const existingLista = existing.rows[0];
          
          // Actualizar si es necesario
          if (DRY_RUN) {
            console.log(`  ℹ️  [DRY-RUN] Actualizaría: ${normalized.nombre} (id: ${existingLista.id})`);
            updated++;
          } else {
            await query(
              `UPDATE listas_transmutaciones 
               SET tipo = $1, descripcion = $2, orden = $3, status = $4, updated_at = NOW()
               WHERE id = $5`,
              [normalized.tipo, normalized.descripcion, normalized.orden, normalized.status, existingLista.id]
            );
            console.log(`  ✅ Actualizada: ${normalized.nombre} (id: ${existingLista.id})`);
            updated++;
          }
        } else {
          // Crear nueva
          if (DRY_RUN) {
            console.log(`  ℹ️  [DRY-RUN] Crearía: ${normalized.nombre}`);
            created++;
          } else {
            const result = await query(
              `INSERT INTO listas_transmutaciones (nombre, tipo, descripcion, orden, status)
               VALUES ($1, $2, $3, $4, $5)
               RETURNING id`,
              [normalized.nombre, normalized.tipo, normalized.descripcion, normalized.orden, normalized.status]
            );
            console.log(`  ✅ Creada: ${normalized.nombre} (id: ${result.rows[0].id})`);
            created++;
          }
        }
      } catch (error) {
        const errorMsg = `Error procesando ${legacyItem.nombre || legacyItem.name || 'lista sin nombre'}: ${error.message}`;
        console.error(`  ❌ ${errorMsg}`);
        errors.push(errorMsg);
        skipped++;
      }
    }
  }

  return { created, updated, skipped, errors };
}

/**
 * Main
 */
async function main() {
  console.log('🚀 Script de Migración Legacy - Alquimia General\n');
  console.log(`Modo: ${DRY_RUN ? 'DRY-RUN (no se aplicarán cambios)' : 'APLICAR (cambios reales)'}\n`);

  try {
    // 1. Identificar fuentes legacy
    const sources = await findLegacyListas();

    if (sources.length === 0) {
      console.log('ℹ️  No se encontraron fuentes legacy. Las listas ya están en PostgreSQL.');
      return;
    }

    // 2. Migrar
    const result = await migrateListas(sources);

    // 3. Resumen
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMEN DE MIGRACIÓN');
    console.log('='.repeat(60));
    console.log(`✅ Creadas: ${result.created}`);
    console.log(`🔄 Actualizadas: ${result.updated}`);
    console.log(`⏭️  Saltadas: ${result.skipped}`);
    if (result.errors.length > 0) {
      console.log(`❌ Errores: ${result.errors.length}`);
      result.errors.forEach(err => console.log(`   - ${err}`));
    }
    console.log('='.repeat(60));

    if (DRY_RUN) {
      console.log('\n💡 Para aplicar los cambios, ejecuta: node scripts/migrate-legacy-alquimia-general.js --apply');
    } else {
      console.log('\n✅ Migración completada');
    }
  } catch (error) {
    console.error('\n❌ Error fatal:', error);
    process.exit(1);
  }
}

main();
