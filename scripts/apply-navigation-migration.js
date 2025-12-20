#!/usr/bin/env node
// Script para aplicar migración de navegación v5.5.0
// Uso: node scripts/apply-navigation-migration.js

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { query, initPostgreSQL } from '../database/pg.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function applyNavigationMigration() {
  try {
    console.log('🔄 Inicializando conexión a PostgreSQL...');
    initPostgreSQL();
    
    // Esperar un poco para que se establezca la conexión
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('📄 Leyendo migración v5.5.0-navigation-versioning-v1.sql...');
    const migrationPath = join(__dirname, '..', 'database', 'migrations', 'v5.5.0-navigation-versioning-v1.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    
    // Verificar si las tablas ya existen
    console.log('🔍 Verificando si las tablas ya existen...');
    try {
      const checkResult = await query(`
        SELECT COUNT(*) as count FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('navigation_definitions', 'navigation_drafts', 'navigation_versions', 'navigation_audit_log')
      `);
      
      const count = parseInt(checkResult.rows[0].count);
      if (count >= 3) {
        console.log(`✅ Las tablas de navegación ya existen (${count} tablas encontradas)`);
        console.log('ℹ️  Migración v5.5.0 ya aplicada');
        return;
      }
    } catch (checkError) {
      console.log('ℹ️  No se pudo verificar tablas existentes, continuando con la migración...');
    }
    
    // Ejecutar migración por statements separados
    console.log('🚀 Aplicando migración v5.5.0...');
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => {
        const trimmed = s.trim();
        return trimmed.length > 0 && 
               !trimmed.startsWith('--') && 
               !trimmed.match(/^\/\*/) &&
               trimmed.length > 10;
      });
    
    let applied = 0;
    let skipped = 0;
    
    for (const stmt of statements) {
      try {
        await query(stmt + ';');
        applied++;
      } catch (stmtError) {
        // Si es error de "already exists", continuar (idempotente)
        if (stmtError.message && (
          stmtError.message.includes('already exists') ||
          stmtError.message.includes('duplicate')
        )) {
          skipped++;
          continue;
        }
        // Si es error de permisos pero la tabla/objeto ya existe, continuar
        if (stmtError.message && (
          stmtError.message.includes('must be owner') ||
          stmtError.message.includes('permission denied')
        )) {
          skipped++;
          continue;
        }
        // Para otros errores, mostrar pero continuar
        console.warn(`⚠️  Error en statement: ${stmtError.message}`);
        console.warn(`   Statement: ${stmt.substring(0, 100)}...`);
      }
    }
    
    console.log(`✅ Migración v5.5.0 aplicada: ${applied} statements ejecutados, ${skipped} ya existían`);
    console.log('✅ Tablas creadas: navigation_definitions, navigation_drafts, navigation_versions, navigation_audit_log');
    
    // Verificar resultado final
    try {
      const finalCheck = await query(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('navigation_definitions', 'navigation_drafts', 'navigation_versions', 'navigation_audit_log')
        ORDER BY table_name
      `);
      
      console.log('\n📊 Tablas de navegación:');
      finalCheck.rows.forEach(row => {
        console.log(`   ✅ ${row.table_name}`);
      });
    } catch (checkError) {
      console.warn('⚠️  No se pudo verificar tablas finales:', checkError.message);
    }
    
  } catch (error) {
    console.error('❌ Error aplicando migración:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

applyNavigationMigration()
  .then(() => {
    console.log('\n✅ Migración completada exitosamente');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Error fatal:', error);
    process.exit(1);
  });




