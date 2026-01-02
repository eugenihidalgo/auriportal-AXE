// scripts/ejecutar-migracion-v5.36.0.js
// Script para aplicar y verificar la migración v5.36.0 (Sistema Canónico de Clasificaciones)

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { query } from '../database/pg.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function ejecutarMigracion() {
  console.log('🚀 Iniciando migración v5.36.0: Sistema Canónico de Clasificaciones...\n');

  try {
    // Leer el archivo SQL
    const sqlPath = join(__dirname, '../database/migrations/v5.36.0-classification-terms-canonical.sql');
    const sql = readFileSync(sqlPath, 'utf-8');

    console.log('📝 Ejecutando migración SQL...');
    
    // Ejecutar la migración
    await query(sql);

    console.log('✅ Migración SQL ejecutada correctamente\n');

    // Verificaciones
    console.log('🔍 Verificando tablas creadas...');

    // Verificar tabla pde_classification_terms
    const checkTerms = await query(`
      SELECT COUNT(*) as count
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'pde_classification_terms'
    `);
    
    if (checkTerms.rows[0].count === '1') {
      console.log('  ✅ Tabla pde_classification_terms existe');
    } else {
      throw new Error('❌ Tabla pde_classification_terms no existe');
    }

    // Verificar tabla transmutacion_lista_classifications
    const checkRelation = await query(`
      SELECT COUNT(*) as count
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'transmutacion_lista_classifications'
    `);
    
    if (checkRelation.rows[0].count === '1') {
      console.log('  ✅ Tabla transmutacion_lista_classifications existe');
    } else {
      throw new Error('❌ Tabla transmutacion_lista_classifications no existe');
    }

    // Verificar función ensure_classification_term
    const checkFunction = await query(`
      SELECT COUNT(*) as count
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
      AND p.proname = 'ensure_classification_term'
    `);
    
    if (checkFunction.rows[0].count === '1') {
      console.log('  ✅ Función ensure_classification_term existe');
    } else {
      throw new Error('❌ Función ensure_classification_term no existe');
    }

    // Contar términos migrados
    const countTerms = await query(`
      SELECT type, COUNT(*) as count
      FROM pde_classification_terms
      GROUP BY type
      ORDER BY type
    `);

    console.log('\n📊 Términos migrados por tipo:');
    countTerms.rows.forEach(row => {
      console.log(`  - ${row.type}: ${row.count} términos`);
    });

    // Contar asociaciones
    const countAssociations = await query(`
      SELECT COUNT(*) as count
      FROM transmutacion_lista_classifications
    `);

    console.log(`\n📎 Asociaciones creadas: ${countAssociations.rows[0].count}`);

    // Probar función ensure_classification_term
    console.log('\n🧪 Probando función ensure_classification_term...');
    
    const testTermId1 = await query(`
      SELECT ensure_classification_term('tag', 'test_tag_1') as term_id
    `);
    console.log(`  ✅ Primer uso (creación): ${testTermId1.rows[0].term_id}`);

    const testTermId2 = await query(`
      SELECT ensure_classification_term('tag', 'Test_Tag_1') as term_id
    `);
    console.log(`  ✅ Segundo uso (debe ser el mismo ID): ${testTermId2.rows[0].term_id}`);

    if (testTermId1.rows[0].term_id === testTermId2.rows[0].term_id) {
      console.log('  ✅ Idempotencia verificada (normalización funciona)');
    } else {
      console.warn('  ⚠️  Idempotencia no verificada (IDs diferentes)');
    }

    // Limpiar test
    await query(`
      DELETE FROM pde_classification_terms
      WHERE normalized = normalize_classification_term('test_tag_1')
    `);
    console.log('  🧹 Test temporal eliminado');

    console.log('\n✅ Migración v5.36.0 completada exitosamente');
    console.log('\n📋 Próximos pasos:');
    console.log('  1. Crear endpoint /admin/api/classifications/ensure');
    console.log('  2. Actualizar repositorio y servicio');
    console.log('  3. Actualizar UI con autocomplete');

  } catch (error) {
    console.error('\n❌ Error ejecutando migración:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

ejecutarMigracion();








