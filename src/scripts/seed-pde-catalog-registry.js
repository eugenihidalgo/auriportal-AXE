// src/scripts/seed-pde-catalog-registry.js
// Script idempotente para insertar catálogos canónicos PDE
// 
// Este script inserta los 9 catálogos canónicos en pde_catalog_registry
// como Source of Truth para Motores y AXE.
//
// REGLAS:
// - Usa catalog_key como clave única
// - Si existe, NO inserta (idempotente)
// - Si no existe, inserta
// - No borra nada existente
// - Log claro por consola

import { query } from '../../database/pg.js';
import { initPostgreSQL } from '../../database/pg.js';
import { loadEnvIfNeeded } from '../core/config/env.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de entorno
loadEnvIfNeeded({ force: true });

// Inicializar PostgreSQL
initPostgreSQL();

/**
 * Ejecuta la migración v5.12.0 si la tabla no existe
 */
async function ensureTableExists() {
  try {
    // Verificar si la tabla existe
    const checkResult = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'pde_catalog_registry'
      );
    `);
    
    if (checkResult.rows[0].exists) {
      console.log('✅ Tabla pde_catalog_registry ya existe');
      return;
    }
    
    // Ejecutar migración
    console.log('📦 Ejecutando migración v5.12.0 para crear tabla...');
    const migrationPath = join(__dirname, '../../database/migrations/v5.12.0-create-pde-catalog-registry.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    await query(migrationSQL);
    console.log('✅ Tabla pde_catalog_registry creada');
  } catch (error) {
    // Si la tabla ya existe (error de constraint), es OK
    if (error.message && (
      error.message.includes('already exists') ||
      error.message.includes('duplicate')
    )) {
      console.log('ℹ️  Tabla pde_catalog_registry ya existe');
      return;
    }
    throw error;
  }
}

// Catálogos canónicos (Source of Truth)
const CANONICAL_CATALOGS = [
  {
    catalog_key: 'preparaciones_practica',
    label: 'Preparaciones para la práctica',
    description: 'Catálogo de preparaciones que se pueden realizar antes de la práctica',
    source_table: 'preparaciones_practica',
    source_endpoint: '/api/preparaciones-practica',
    usable_for_motors: true,
    supports_level: true,
    supports_priority: true,
    supports_obligatory: true,
    supports_duration: true
  },
  {
    catalog_key: 'tecnicas_limpieza',
    label: 'Técnicas de limpieza',
    description: 'Catálogo de técnicas de transmutación energética (limpieza)',
    source_table: 'tecnicas_limpieza',
    source_endpoint: '/api/tecnicas-limpieza',
    usable_for_motors: true,
    supports_level: true,
    supports_priority: true,
    supports_obligatory: true,
    supports_duration: false
  },
  {
    catalog_key: 'tecnicas_post_practica',
    label: 'Técnicas post-práctica',
    description: 'Catálogo de técnicas que se realizan después de la práctica',
    source_table: 'tecnicas_post_practica',
    source_endpoint: '/api/tecnicas-post-practica',
    usable_for_motors: true,
    supports_level: true,
    supports_priority: true,
    supports_obligatory: true,
    supports_duration: true
  },
  {
    catalog_key: 'protecciones_energeticas',
    label: 'Protecciones energéticas',
    description: 'Catálogo de protecciones energéticas',
    source_table: 'protecciones_energeticas',
    source_endpoint: '/api/protecciones-energeticas',
    usable_for_motors: true,
    supports_level: true, // nivel_minimo
    supports_priority: true,
    supports_obligatory: true,
    supports_duration: false
  },
  {
    catalog_key: 'transmutaciones_energeticas',
    label: 'Transmutaciones energéticas',
    description: 'Catálogo de transmutaciones energéticas (personas, lugares, proyectos)',
    source_table: 'items_transmutaciones',
    source_endpoint: '/api/transmutaciones/items',
    usable_for_motors: true,
    supports_level: true,
    supports_priority: true,
    supports_obligatory: false,
    supports_duration: false
  },
  {
    catalog_key: 'decretos',
    label: 'Decretos',
    description: 'Biblioteca de decretos PDE',
    source_table: 'decretos',
    source_endpoint: '/api/decretos',
    usable_for_motors: true,
    supports_level: true, // nivel_minimo
    supports_priority: false,
    supports_obligatory: true,
    supports_duration: false
  },
  {
    catalog_key: 'frases_pde',
    label: 'Frases PDE',
    description: 'Catálogo de frases personalizadas PDE',
    source_table: 'pde_frases_personalizadas',
    source_endpoint: '/api/frases-pde',
    usable_for_motors: false,
    supports_level: true,
    supports_priority: false,
    supports_obligatory: false,
    supports_duration: false
  },
  {
    catalog_key: 'musicas_meditacion',
    label: 'Músicas de meditación',
    description: 'Catálogo de músicas para meditación',
    source_table: 'musicas_meditacion',
    source_endpoint: '/api/musicas-meditacion',
    usable_for_motors: true,
    supports_level: false,
    supports_priority: false,
    supports_obligatory: false,
    supports_duration: true
  },
  {
    catalog_key: 'tonos_meditacion',
    label: 'Tonos de meditación',
    description: 'Catálogo de tonos para meditación',
    source_table: 'tonos_meditacion',
    source_endpoint: '/api/tonos-meditacion',
    usable_for_motors: true,
    supports_level: false,
    supports_priority: false,
    supports_obligatory: false,
    supports_duration: true
  }
];

/**
 * Inserta un catálogo si no existe (idempotente)
 */
async function insertCatalogIfNotExists(catalog) {
  try {
    // Verificar si existe
    const checkResult = await query(
      'SELECT id FROM pde_catalog_registry WHERE catalog_key = $1',
      [catalog.catalog_key]
    );

    if (checkResult.rows.length > 0) {
      console.log(`⏭️  Catálogo "${catalog.catalog_key}" ya existe, omitiendo...`);
      return { inserted: false, catalog_key: catalog.catalog_key };
    }

    // Insertar
    const insertResult = await query(
      `INSERT INTO pde_catalog_registry (
        catalog_key, label, description, source_table, source_endpoint,
        usable_for_motors, supports_level, supports_priority,
        supports_obligatory, supports_duration, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, catalog_key, label`,
      [
        catalog.catalog_key,
        catalog.label,
        catalog.description,
        catalog.source_table,
        catalog.source_endpoint,
        catalog.usable_for_motors,
        catalog.supports_level,
        catalog.supports_priority,
        catalog.supports_obligatory,
        catalog.supports_duration,
        'active'
      ]
    );

    const inserted = insertResult.rows[0];
    console.log(`✅ Insertado: ${inserted.catalog_key} - ${inserted.label}`);
    return { inserted: true, catalog_key: catalog.catalog_key, id: inserted.id };
  } catch (error) {
    console.error(`❌ Error insertando "${catalog.catalog_key}":`, error.message);
    throw error;
  }
}

/**
 * Función principal
 */
async function main() {
  console.log('🌱 Iniciando seed de catálogos canónicos PDE...\n');
  
  // Asegurar que la tabla existe
  await ensureTableExists();
  console.log('');

  let inserted = 0;
  let skipped = 0;
  const errors = [];

  for (const catalog of CANONICAL_CATALOGS) {
    try {
      const result = await insertCatalogIfNotExists(catalog);
      if (result.inserted) {
        inserted++;
      } else {
        skipped++;
      }
    } catch (error) {
      errors.push({ catalog_key: catalog.catalog_key, error: error.message });
    }
  }

  console.log('\n📊 Resumen:');
  console.log(`   ✅ Insertados: ${inserted}`);
  console.log(`   ⏭️  Omitidos (ya existían): ${skipped}`);
  console.log(`   ❌ Errores: ${errors.length}`);

  if (errors.length > 0) {
    console.log('\n❌ Errores encontrados:');
    errors.forEach(({ catalog_key, error }) => {
      console.log(`   - ${catalog_key}: ${error}`);
    });
    process.exit(1);
  }

  // Verificación final
  const countResult = await query('SELECT COUNT(*) as total FROM pde_catalog_registry');
  const total = parseInt(countResult.rows[0].total);
  console.log(`\n✅ Total de catálogos en registro: ${total}`);

  if (total >= CANONICAL_CATALOGS.length) {
    console.log('✅ Seed completado exitosamente');
    process.exit(0);
  } else {
    console.log(`⚠️  Advertencia: Se esperaban al menos ${CANONICAL_CATALOGS.length} catálogos`);
    process.exit(0);
  }
}

// Ejecutar
main().catch((error) => {
  console.error('❌ Error fatal en seed:', error);
  process.exit(1);
});

