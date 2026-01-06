/**
 * VERIFICACIÓN DE ESTRUCTURA DB - SPONSORS v1
 * 
 * Verifica que las tablas, columnas, constraints e índices
 * del sistema de sponsors v1 existen correctamente.
 */

import { query } from '../database/pg.js';

const REQUIRED_TABLES = [
  'sponsors_catalog',
  'sponsor_student_links',
  'sponsor_special_care',
  'sponsor_special_care_lists'
];

const REQUIRED_COLUMNS = {
  'sponsors_catalog': [
    'id', 'display_name', 'description', 'status', 'meta', 
    'created_at', 'updated_at', 'deleted_at'
  ],
  'sponsor_student_links': [
    'id', 'sponsor_id', 'student_id', 'role', 
    'created_at', 'deleted_at'
  ],
  'sponsor_special_care': [
    'id', 'sponsor_id', 'category_term_id', 'starts_at', 'ends_at',
    'priority', 'notes', 'created_at', 'updated_at', 'deleted_at'
  ],
  'sponsor_special_care_lists': [
    'care_id', 'transmutation_list_id', 'created_at'
  ]
};

const REQUIRED_INDEXES = [
  'idx_sponsor_links_unique_active',
  'idx_sponsor_care_unique_active'
];

async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log('VERIFICACIÓN DE ESTRUCTURA DB - SPONSORS v1');
  console.log(`${'='.repeat(60)}\n`);

  const errors = [];
  const warnings = [];

  try {
    // Verificar tablas
    console.log('📋 Verificando tablas...');
    for (const table of REQUIRED_TABLES) {
      const result = await query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      `, [table]);

      if (result.rows.length === 0) {
        errors.push(`❌ Tabla ${table} NO EXISTE`);
      } else {
        console.log(`  ✅ Tabla ${table} existe`);
      }
    }

    // Verificar columnas
    console.log('\n📋 Verificando columnas...');
    for (const [table, columns] of Object.entries(REQUIRED_COLUMNS)) {
      for (const column of columns) {
        const result = await query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = $1 
          AND column_name = $2
        `, [table, column]);

        if (result.rows.length === 0) {
          errors.push(`❌ Columna ${table}.${column} NO EXISTE`);
        } else {
          console.log(`  ✅ Columna ${table}.${column} existe`);
        }
      }
    }

    // Verificar índices
    console.log('\n📋 Verificando índices...');
    for (const index of REQUIRED_INDEXES) {
      const result = await query(`
        SELECT indexname 
        FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND indexname = $1
      `, [index]);

      if (result.rows.length === 0) {
        warnings.push(`⚠️  Índice ${index} NO EXISTE`);
      } else {
        console.log(`  ✅ Índice ${index} existe`);
      }
    }

    // Verificar foreign keys
    console.log('\n📋 Verificando foreign keys...');
    const fkChecks = [
      { table: 'sponsor_student_links', column: 'sponsor_id', ref_table: 'sponsors_catalog' },
      { table: 'sponsor_student_links', column: 'student_id', ref_table: 'alumnos' },
      { table: 'sponsor_special_care', column: 'sponsor_id', ref_table: 'sponsors_catalog' },
      { table: 'sponsor_special_care', column: 'category_term_id', ref_table: 'pde_classification_terms' },
      { table: 'sponsor_special_care_lists', column: 'care_id', ref_table: 'sponsor_special_care' },
      { table: 'sponsor_special_care_lists', column: 'transmutation_list_id', ref_table: 'listas_transmutaciones' }
    ];

    for (const fk of fkChecks) {
      const result = await query(`
        SELECT 
          tc.constraint_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = $1
        AND kcu.column_name = $2
      `, [fk.table, fk.column]);

      if (result.rows.length === 0) {
        warnings.push(`⚠️  FK ${fk.table}.${fk.column} → ${fk.ref_table} NO EXISTE`);
      } else {
        console.log(`  ✅ FK ${fk.table}.${fk.column} → ${fk.ref_table} existe`);
      }
    }

    // Verificar extensión pgcrypto
    console.log('\n📋 Verificando extensión pgcrypto...');
    const extResult = await query(`
      SELECT extname 
      FROM pg_extension 
      WHERE extname = 'pgcrypto'
    `);

    if (extResult.rows.length === 0) {
      errors.push('❌ Extensión pgcrypto NO EXISTE (necesaria para UUIDs)');
    } else {
      console.log('  ✅ Extensión pgcrypto existe');
    }

    // Resumen
    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 RESUMEN DE VERIFICACIÓN');
    console.log(`${'='.repeat(60)}`);
    
    if (errors.length === 0 && warnings.length === 0) {
      console.log('✅ TODAS LAS VERIFICACIONES PASARON');
    } else {
      if (errors.length > 0) {
        console.log(`\n❌ ERRORES (${errors.length}):`);
        errors.forEach(e => console.log(`   ${e}`));
      }
      if (warnings.length > 0) {
        console.log(`\n⚠️  ADVERTENCIAS (${warnings.length}):`);
        warnings.forEach(w => console.log(`   ${w}`));
      }
    }

    console.log(`\n${'='.repeat(60)}\n`);

    if (errors.length > 0) {
      process.exit(1);
    }

  } catch (error) {
    console.error(`\n❌ ERROR FATAL EN VERIFICACIÓN:`, error);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Error fatal:', error);
  process.exit(1);
});
