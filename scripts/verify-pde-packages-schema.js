#!/usr/bin/env node
/**
 * scripts/verify-pde-packages-schema.js
 * 
 * Script para verificar y crear las tablas canónicas de Packages V2.
 * 
 * Si alguna tabla no existe, se crea automáticamente.
 * Si el sistema no puede funcionar sin estas tablas, el script falla.
 */

import { query } from '../database/pg.js';

const PREFIX = '[VERIFY-SCHEMA]';

/**
 * Verificar si una tabla existe
 */
async function tableExists(tableName) {
  const result = await query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = $1
    )
  `, [tableName]);
  return result.rows[0].exists;
}

/**
 * Crear tabla pde_packages
 */
async function createPdePackagesTable() {
  console.log(`${PREFIX} Creando tabla pde_packages...`);
  
  await query(`
    CREATE TABLE IF NOT EXISTS pde_packages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      package_key TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'draft',
      definition JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT now(),
      updated_at TIMESTAMP DEFAULT now(),
      deleted_at TIMESTAMP,
      current_draft_id UUID,
      current_published_version INTEGER
    )
  `);

  // Crear índices
  await query(`
    CREATE INDEX IF NOT EXISTS idx_pde_packages_package_key ON pde_packages(package_key)
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_pde_packages_status ON pde_packages(status)
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_pde_packages_deleted_at ON pde_packages(deleted_at)
  `);

  console.log(`${PREFIX} ✅ Tabla pde_packages creada/verificada`);
}

/**
 * Crear tabla pde_contexts
 */
async function createPdeContextsTable() {
  console.log(`${PREFIX} Creando tabla pde_contexts...`);
  
  await query(`
    CREATE TABLE IF NOT EXISTS pde_contexts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      context_key TEXT UNIQUE NOT NULL,
      label TEXT NOT NULL,
      definition JSONB,
      status TEXT DEFAULT 'active',
      created_at TIMESTAMP DEFAULT now(),
      updated_at TIMESTAMP DEFAULT now(),
      archived_at TIMESTAMP
    )
  `);

  // Crear índices
  await query(`
    CREATE INDEX IF NOT EXISTS idx_pde_contexts_context_key ON pde_contexts(context_key)
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_pde_contexts_status ON pde_contexts(status)
  `);

  console.log(`${PREFIX} ✅ Tabla pde_contexts creada/verificada`);
}

/**
 * Crear tabla pde_signals
 */
async function createPdeSignalsTable() {
  console.log(`${PREFIX} Creando tabla pde_signals...`);
  
  await query(`
    CREATE TABLE IF NOT EXISTS pde_signals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      signal_key TEXT UNIQUE NOT NULL,
      label TEXT NOT NULL,
      definition JSONB,
      status TEXT DEFAULT 'active',
      created_at TIMESTAMP DEFAULT now(),
      updated_at TIMESTAMP DEFAULT now(),
      archived_at TIMESTAMP
    )
  `);

  // Crear índices
  await query(`
    CREATE INDEX IF NOT EXISTS idx_pde_signals_signal_key ON pde_signals(signal_key)
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_pde_signals_status ON pde_signals(status)
  `);

  console.log(`${PREFIX} ✅ Tabla pde_signals creada/verificada`);
}

/**
 * Crear tabla pde_catalog_registry
 */
async function createPdeCatalogRegistryTable() {
  console.log(`${PREFIX} Creando tabla pde_catalog_registry...`);
  
  await query(`
    CREATE TABLE IF NOT EXISTS pde_catalog_registry (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      catalog_key TEXT UNIQUE NOT NULL,
      label TEXT NOT NULL,
      description TEXT,
      active BOOLEAN DEFAULT true,
      definition JSONB,
      created_at TIMESTAMP DEFAULT now(),
      updated_at TIMESTAMP DEFAULT now()
    )
  `);

  // Crear índices
  await query(`
    CREATE INDEX IF NOT EXISTS idx_pde_catalog_registry_catalog_key ON pde_catalog_registry(catalog_key)
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_pde_catalog_registry_active ON pde_catalog_registry(active)
  `);

  console.log(`${PREFIX} ✅ Tabla pde_catalog_registry creada/verificada`);
}

/**
 * Verificar y crear todas las tablas
 */
async function verifySchema() {
  console.log(`${PREFIX} Iniciando verificación de esquema...`);

  try {
    // Verificar/Crear pde_packages
    const packagesExists = await tableExists('pde_packages');
    if (!packagesExists) {
      await createPdePackagesTable();
    } else {
      console.log(`${PREFIX} ✅ Tabla pde_packages existe`);
    }

    // Verificar/Crear pde_contexts
    const contextsExists = await tableExists('pde_contexts');
    if (!contextsExists) {
      await createPdeContextsTable();
    } else {
      console.log(`${PREFIX} ✅ Tabla pde_contexts existe`);
    }

    // Verificar/Crear pde_signals
    const signalsExists = await tableExists('pde_signals');
    if (!signalsExists) {
      await createPdeSignalsTable();
    } else {
      console.log(`${PREFIX} ✅ Tabla pde_signals existe`);
    }

    // Verificar/Crear pde_catalog_registry
    const catalogExists = await tableExists('pde_catalog_registry');
    if (!catalogExists) {
      await createPdeCatalogRegistryTable();
    } else {
      console.log(`${PREFIX} ✅ Tabla pde_catalog_registry existe`);
    }

    // Verificación final
    const allTables = [
      await tableExists('pde_packages'),
      await tableExists('pde_contexts'),
      await tableExists('pde_signals'),
      await tableExists('pde_catalog_registry')
    ];

    const allExist = allTables.every(exists => exists === true);

    if (!allExist) {
      throw new Error('❌ Algunas tablas no existen después de la verificación');
    }

    console.log(`${PREFIX} ✅ Todas las tablas canónicas existen`);
    console.log(`${PREFIX} ✅ Verificación completada exitosamente`);

  } catch (error) {
    console.error(`${PREFIX} ❌ Error en verificación:`, error);
    throw error;
  }
}

// Ejecutar
verifySchema()
  .then(() => {
    console.log(`${PREFIX} Script finalizado`);
    process.exit(0);
  })
  .catch(error => {
    console.error(`${PREFIX} Error fatal:`, error);
    process.exit(1);
  });








