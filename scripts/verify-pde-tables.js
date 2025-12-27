#!/usr/bin/env node
/**
 * Script para verificar que todas las tablas obligatorias de PDE existen
 * 
 * TABLAS OBLIGATORIAS:
 * - pde_packages (tabla canónica de packages)
 * - pde_contexts (context registry)
 * - pde_signals (signals registry)
 * - pde_catalog_registry (catalog registry)
 */

import { query } from '../database/pg.js';
import { initPostgreSQL } from '../database/pg.js';

const REQUIRED_TABLES = [
  'pde_packages',
  'pde_contexts',
  'pde_signals',
  'pde_catalog_registry'
];

async function main() {
  console.log('🔍 Verificando existencia de tablas obligatorias de PDE...\n');
  
  // Inicializar PostgreSQL
  try {
    initPostgreSQL();
    console.log('✅ Conexión a PostgreSQL establecida\n');
  } catch (error) {
    console.error('❌ Error conectando a PostgreSQL:', error);
    process.exit(1);
  }

  const results = {
    found: [],
    missing: []
  };

  for (const tableName of REQUIRED_TABLES) {
    try {
      const result = await query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        ) as exists
      `, [tableName]);

      const exists = result.rows[0].exists;
      
      if (exists) {
        results.found.push(tableName);
        console.log(`✅ ${tableName} - EXISTE`);
      } else {
        results.missing.push(tableName);
        console.log(`❌ ${tableName} - NO EXISTE`);
      }
    } catch (error) {
      console.error(`❌ Error verificando ${tableName}:`, error.message);
      results.missing.push(tableName);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMEN:');
  console.log(`   ✅ Tablas encontradas: ${results.found.length}/${REQUIRED_TABLES.length}`);
  console.log(`   ❌ Tablas faltantes: ${results.missing.length}/${REQUIRED_TABLES.length}`);
  
  if (results.missing.length > 0) {
    console.log('\n⚠️  TABLAS FALTANTES:');
    results.missing.forEach(table => {
      console.log(`   - ${table}`);
    });
    console.log('\n❌ ERROR: Faltan tablas obligatorias. El editor NO puede funcionar.');
    console.log('   Ejecutar las migraciones correspondientes antes de continuar.');
    process.exit(1);
  } else {
    console.log('\n✅ TODAS LAS TABLAS OBLIGATORIAS EXISTEN');
    console.log('   El editor puede funcionar correctamente.');
    process.exit(0);
  }
}

main().catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});








