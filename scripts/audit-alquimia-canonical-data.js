#!/usr/bin/env node
/**
 * AUDITORÍA DE DATOS CANÓNICOS DE ARRANQUE - Alquimia General
 * 
 * Ejecuta las mismas queries que los endpoints:
 * - GET /master/api/alquimia-general/listas?tipo=recurrente
 * - GET /master/api/alquimia-general/classifications
 * - GET /master/api/alquimia-general/item-groups
 * 
 * OBJETIVO:
 * - Distinguir entre ERROR DE QUERY (bug) vs BASE DE DATOS VACÍA (estado válido)
 * - Documentar qué datos mínimos necesita Alquimia General para arrancar
 */

import 'dotenv/config';
import { query } from '../database/pg.js';

const traceId = `audit_${Date.now()}`;

// ============================================================================
// HELPER: Ejecutar query con manejo de errores
// ============================================================================
async function executeQuery(name, sql, params = []) {
  try {
    console.log(`\n[${name}] Ejecutando query...`);
    console.log(`SQL: ${sql}`);
    if (params.length > 0) {
      console.log(`Params: ${JSON.stringify(params)}`);
    }
    
    const result = await query(sql, params);
    return {
      success: true,
      rowCount: result.rows?.length || 0,
      rows: result.rows || [],
      error: null
    };
  } catch (error) {
    return {
      success: false,
      rowCount: 0,
      rows: [],
      error: {
        message: error.message,
        code: error.code,
        stack: error.stack
      }
    };
  }
}

// ============================================================================
// AUDITORÍA 1: Listas Recurrentes
// ============================================================================
async function auditListasRecurrentes() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('AUDITORÍA 1: GET /master/api/alquimia-general/listas?tipo=recurrente');
  console.log('═══════════════════════════════════════════════════════════');
  
  // Verificar si existe columna status
  const statusCheck = await executeQuery(
    'STATUS_COLUMN_CHECK',
    `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = $1 AND column_name = 'status'
    `,
    ['listas_transmutaciones']
  );
  
  const hasStatusColumn = statusCheck.success && statusCheck.rowCount > 0;
  console.log(`\n[STATUS_CHECK] Columna 'status' existe: ${hasStatusColumn}`);
  
  // Query exacta que ejecuta listListas({ onlyActive: true, tipo: 'recurrente' })
  let sql = 'SELECT * FROM listas_transmutaciones';
  const conditions = [];
  const params = [];
  
  // Filtros aplicados (igual que repo.listListas)
  conditions.push('deleted_at IS NULL');
  
  if (hasStatusColumn) {
    conditions.push(`status = 'active'`);
  } else {
    conditions.push(`activo = true`);
  }
  
  conditions.push(`tipo = $${params.length + 1}`);
  params.push('recurrente');
  
  sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY orden ASC, nombre ASC';
  
  const result = await executeQuery('LISTAS_RECURRENTES', sql, params);
  
  console.log(`\n[RESULTADO]`);
  console.log(`- Éxito: ${result.success}`);
  console.log(`- Filas encontradas: ${result.rowCount}`);
  
  if (!result.success) {
    console.log(`- ❌ ERROR DE QUERY (BUG):`);
    console.log(`  Mensaje: ${result.error.message}`);
    console.log(`  Código: ${result.error.code}`);
    return {
      endpoint: '/master/api/alquimia-general/listas?tipo=recurrente',
      status: 'ERROR_QUERY',
      error: result.error
    };
  }
  
  if (result.rowCount === 0) {
    console.log(`- ⚠️  BASE DE DATOS VACÍA (estado válido)`);
    console.log(`  No hay listas recurrentes activas en la base de datos`);
    return {
      endpoint: '/master/api/alquimia-general/listas?tipo=recurrente',
      status: 'EMPTY_DATABASE',
      rowCount: 0
    };
  }
  
  console.log(`- ✅ Datos encontrados:`);
  result.rows.forEach((row, idx) => {
    console.log(`  ${idx + 1}. ID: ${row.id}, Nombre: ${row.nombre}, Tipo: ${row.tipo}, Status: ${row.status || 'N/A'}`);
  });
  
  return {
    endpoint: '/master/api/alquimia-general/listas?tipo=recurrente',
    status: 'OK',
    rowCount: result.rowCount,
    rows: result.rows
  };
}

// ============================================================================
// AUDITORÍA 2: Classifications
// ============================================================================
async function auditClassifications() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('AUDITORÍA 2: GET /master/api/alquimia-general/classifications');
  console.log('═══════════════════════════════════════════════════════════');
  
  // Queries exactas que ejecuta getAllClassifications()
  // repo.listCategories({ includeDeleted: false })
  // NOTA: Usa pde_transmutation_categories (tabla específica, NO pde_classification_terms)
  const categoriesResult = await executeQuery(
    'CATEGORIES',
    `
      SELECT 
        id,
        category_key,
        label,
        description,
        sort_order,
        is_active,
        deleted_at,
        created_at,
        updated_at
      FROM pde_transmutation_categories
      WHERE deleted_at IS NULL
      ORDER BY sort_order ASC, label ASC
    `
  );
  
  // repo.listSubtypes({ includeDeleted: false })
  const subtypesResult = await executeQuery(
    'SUBTYPES',
    `
      SELECT 
        id,
        subtype_key,
        label,
        description,
        sort_order,
        is_active,
        deleted_at,
        created_at,
        updated_at
      FROM pde_transmutation_subtypes
      WHERE deleted_at IS NULL
      ORDER BY sort_order ASC, label ASC
    `
  );
  
  // repo.listTags({ includeDeleted: false })
  const tagsResult = await executeQuery(
    'TAGS',
    `
      SELECT 
        id,
        tag_key,
        label,
        description,
        sort_order,
        is_active,
        deleted_at,
        created_at,
        updated_at
      FROM pde_transmutation_tags
      WHERE deleted_at IS NULL
      ORDER BY sort_order ASC, label ASC
    `
  );
  
  const totalCount = categoriesResult.rowCount + subtypesResult.rowCount + tagsResult.rowCount;
  
  console.log(`\n[RESULTADO]`);
  console.log(`- Categorías: ${categoriesResult.rowCount}`);
  console.log(`- Subtipos: ${subtypesResult.rowCount}`);
  console.log(`- Tags: ${tagsResult.rowCount}`);
  console.log(`- Total: ${totalCount}`);
  
  // Verificar errores de query
  const hasQueryError = !categoriesResult.success || !subtypesResult.success || !tagsResult.success;
  
  if (hasQueryError) {
    const errors = [
      !categoriesResult.success && categoriesResult.error,
      !subtypesResult.success && subtypesResult.error,
      !tagsResult.success && tagsResult.error
    ].filter(Boolean);
    
    console.log(`- ❌ ERROR DE QUERY (BUG):`);
    errors.forEach(err => {
      console.log(`  - ${err.message} (${err.code})`);
    });
    
    return {
      endpoint: '/master/api/alquimia-general/classifications',
      status: 'ERROR_QUERY',
      errors
    };
  }
  
  if (totalCount === 0) {
    console.log(`- ⚠️  BASE DE DATOS VACÍA (estado válido)`);
    console.log(`  No hay clasificaciones en la base de datos`);
    return {
      endpoint: '/master/api/alquimia-general/classifications',
      status: 'EMPTY_DATABASE',
      categories: 0,
      subtypes: 0,
      tags: 0
    };
  }
  
  console.log(`- ✅ Datos encontrados`);
  if (categoriesResult.rowCount > 0) {
    console.log(`  Categorías: ${categoriesResult.rows.map(r => r.term_key).join(', ')}`);
  }
  if (subtypesResult.rowCount > 0) {
    console.log(`  Subtipos: ${subtypesResult.rows.map(r => r.term_key).join(', ')}`);
  }
  if (tagsResult.rowCount > 0) {
    console.log(`  Tags: ${tagsResult.rows.slice(0, 10).map(r => r.term_key).join(', ')}${tagsResult.rowCount > 10 ? '...' : ''}`);
  }
  
  return {
    endpoint: '/master/api/alquimia-general/classifications',
    status: 'OK',
    categories: categoriesResult.rowCount,
    subtypes: subtypesResult.rowCount,
    tags: tagsResult.rowCount
  };
}

// ============================================================================
// AUDITORÍA 3: Item Groups
// ============================================================================
async function auditItemGroups() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('AUDITORÍA 3: GET /master/api/alquimia-general/item-groups');
  console.log('═══════════════════════════════════════════════════════════');
  
  // Query exacta que ejecuta listItemGroups()
  // groupsRepo.listActiveGroups()
  const result = await executeQuery(
    'ITEM_GROUPS',
    `
      SELECT value
      FROM pde_transmutation_item_groups
      WHERE status = 'active'
      ORDER BY value ASC
    `
  );
  
  console.log(`\n[RESULTADO]`);
  console.log(`- Éxito: ${result.success}`);
  console.log(`- Filas encontradas: ${result.rowCount}`);
  
  if (!result.success) {
    console.log(`- ❌ ERROR DE QUERY (BUG):`);
    console.log(`  Mensaje: ${result.error.message}`);
    console.log(`  Código: ${result.error.code}`);
    
    // Verificar si la tabla existe
    const tableCheck = await executeQuery(
      'TABLE_CHECK',
      `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_name = 'pde_transmutation_item_groups'
      `
    );
    
    if (!tableCheck.success || tableCheck.rowCount === 0) {
      console.log(`  ⚠️  Tabla 'pde_transmutation_item_groups' NO EXISTE`);
    }
    
    return {
      endpoint: '/master/api/alquimia-general/item-groups',
      status: 'ERROR_QUERY',
      error: result.error,
      tableExists: tableCheck.success && tableCheck.rowCount > 0
    };
  }
  
  if (result.rowCount === 0) {
    console.log(`- ⚠️  BASE DE DATOS VACÍA (estado válido)`);
    console.log(`  No hay item_groups activos en la base de datos`);
    return {
      endpoint: '/master/api/alquimia-general/item-groups',
      status: 'EMPTY_DATABASE',
      rowCount: 0
    };
  }
  
  console.log(`- ✅ Datos encontrados:`);
  result.rows.forEach((row, idx) => {
    console.log(`  ${idx + 1}. ${row.value}`);
  });
  
  return {
    endpoint: '/master/api/alquimia-general/item-groups',
    status: 'OK',
    rowCount: result.rowCount,
    groups: result.rows.map(r => r.value)
  };
}

// ============================================================================
// MAIN
// ============================================================================
async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('AUDITORÍA DE DATOS CANÓNICOS DE ARRANQUE - Alquimia General');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Trace ID: ${traceId}`);
  console.log(`Fecha: ${new Date().toISOString()}`);
  
  const results = [];
  
  try {
    // Auditoría 1: Listas Recurrentes
    const listasResult = await auditListasRecurrentes();
    results.push(listasResult);
    
    // Auditoría 2: Classifications
    const classificationsResult = await auditClassifications();
    results.push(classificationsResult);
    
    // Auditoría 3: Item Groups
    const itemGroupsResult = await auditItemGroups();
    results.push(itemGroupsResult);
    
    // Resumen final
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('RESUMEN FINAL');
    console.log('═══════════════════════════════════════════════════════════');
    
    const errorQueries = results.filter(r => r.status === 'ERROR_QUERY');
    const emptyDatabases = results.filter(r => r.status === 'EMPTY_DATABASE');
    const okResults = results.filter(r => r.status === 'OK');
    
    console.log(`\n✅ Endpoints OK: ${okResults.length}`);
    okResults.forEach(r => {
      console.log(`  - ${r.endpoint}: ${r.rowCount || (r.categories || 0) + (r.subtypes || 0) + (r.tags || 0)} registros`);
    });
    
    console.log(`\n⚠️  Base de datos vacía: ${emptyDatabases.length}`);
    emptyDatabases.forEach(r => {
      console.log(`  - ${r.endpoint}: Sin datos (estado válido, necesita seed)`);
    });
    
    console.log(`\n❌ Errores de query (BUGS): ${errorQueries.length}`);
    errorQueries.forEach(r => {
      console.log(`  - ${r.endpoint}: ${r.error?.message || JSON.stringify(r.errors)}`);
    });
    
    // Conclusión
    console.log(`\n═══════════════════════════════════════════════════════════`);
    console.log('CONCLUSIÓN');
    console.log('═══════════════════════════════════════════════════════════');
    
    if (errorQueries.length > 0) {
      console.log(`\n❌ HAY BUGS DE QUERY. Los endpoints fallan por errores SQL, no por datos vacíos.`);
      console.log(`   Se requiere corrección de queries/handlers.`);
      process.exit(1);
    }
    
    if (emptyDatabases.length > 0) {
      console.log(`\n⚠️  BASE DE DATOS VACÍA. Los endpoints funcionan correctamente pero no hay datos.`);
      console.log(`   Se requiere ejecutar seed canónico para poblar datos base.`);
      console.log(`\n   Datos mínimos necesarios para arranque:`);
      emptyDatabases.forEach(r => {
        console.log(`   - ${r.endpoint}`);
      });
      process.exit(0);
    }
    
    console.log(`\n✅ TODO OK. Los endpoints tienen datos y funcionan correctamente.`);
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ ERROR FATAL en auditoría:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
