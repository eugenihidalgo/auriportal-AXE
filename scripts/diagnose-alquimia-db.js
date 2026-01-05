#!/usr/bin/env node
// scripts/diagnose-alquimia-db.js
// Diagnóstico real de tablas de Alquimia General en PostgreSQL

import { query } from '../database/pg.js';
import { logInfo, logError } from '../src/core/observability/logger.js';

async function diagnoseAlquimiaDB() {
  const results = {
    timestamp: new Date().toISOString(),
    tables: {},
    errors: []
  };

  try {
    // 1. Verificar listas_transmutaciones
    try {
      const listasCount = await query('SELECT COUNT(*) as count FROM listas_transmutaciones');
      const listasActive = await query("SELECT COUNT(*) as count FROM listas_transmutaciones WHERE status = 'active'");
      const listasSample = await query('SELECT id, nombre, tipo, status FROM listas_transmutaciones LIMIT 5');
      
      results.tables.listas_transmutaciones = {
        exists: true,
        total_count: parseInt(listasCount.rows[0].count),
        active_count: parseInt(listasActive.rows[0].count),
        sample: listasSample.rows
      };
    } catch (error) {
      results.tables.listas_transmutaciones = {
        exists: false,
        error: error.message
      };
      results.errors.push(`listas_transmutaciones: ${error.message}`);
    }

    // 2. Verificar items_transmutaciones
    try {
      const itemsCount = await query('SELECT COUNT(*) as count FROM items_transmutaciones');
      const itemsActive = await query("SELECT COUNT(*) as count FROM items_transmutaciones WHERE status = 'active'");
      const itemsSample = await query('SELECT id, lista_id, nombre, item_ref, status FROM items_transmutaciones LIMIT 5');
      
      results.tables.items_transmutaciones = {
        exists: true,
        total_count: parseInt(itemsCount.rows[0].count),
        active_count: parseInt(itemsActive.rows[0].count),
        sample: itemsSample.rows
      };
    } catch (error) {
      results.tables.items_transmutaciones = {
        exists: false,
        error: error.message
      };
      results.errors.push(`items_transmutaciones: ${error.message}`);
    }

    // 3. Verificar pde_classification_terms
    try {
      const classificationsCount = await query('SELECT COUNT(*) as count FROM pde_classification_terms');
      const classificationsActive = await query("SELECT COUNT(*) as count FROM pde_classification_terms WHERE status = 'active'");
      const classificationsByType = await query(`
        SELECT type, COUNT(*) as count 
        FROM pde_classification_terms 
        WHERE status = 'active'
        GROUP BY type
      `);
      
      results.tables.pde_classification_terms = {
        exists: true,
        total_count: parseInt(classificationsCount.rows[0].count),
        active_count: parseInt(classificationsActive.rows[0].count),
        by_type: classificationsByType.rows.reduce((acc, row) => {
          acc[row.type] = parseInt(row.count);
          return acc;
        }, {})
      };
    } catch (error) {
      results.tables.pde_classification_terms = {
        exists: false,
        error: error.message
      };
      results.errors.push(`pde_classification_terms: ${error.message}`);
    }

    // 4. Verificar transmutacion_lista_classifications
    try {
      const listaClassificationsCount = await query('SELECT COUNT(*) as count FROM transmutacion_lista_classifications');
      const listaClassificationsSample = await query(`
        SELECT tlc.lista_id, ct.type, ct.value
        FROM transmutacion_lista_classifications tlc
        INNER JOIN pde_classification_terms ct ON tlc.classification_term_id = ct.id
        LIMIT 5
      `);
      
      results.tables.transmutacion_lista_classifications = {
        exists: true,
        total_count: parseInt(listaClassificationsCount.rows[0].count),
        sample: listaClassificationsSample.rows
      };
    } catch (error) {
      results.tables.transmutacion_lista_classifications = {
        exists: false,
        error: error.message
      };
      results.errors.push(`transmutacion_lista_classifications: ${error.message}`);
    }

    // 5. Verificar estructura de columnas críticas
    try {
      const listasColumns = await query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'listas_transmutaciones'
        ORDER BY ordinal_position
      `);
      
      const itemsColumns = await query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'items_transmutaciones'
        ORDER BY ordinal_position
      `);

      results.tables.schema = {
        listas_transmutaciones: listasColumns.rows,
        items_transmutaciones: itemsColumns.rows
      };
    } catch (error) {
      results.errors.push(`Schema check: ${error.message}`);
    }

    // Imprimir resultados
    console.log(JSON.stringify(results, null, 2));

    // Resumen
    console.error('\n=== RESUMEN ===');
    console.error(`Listas totales: ${results.tables.listas_transmutaciones?.total_count || 0}`);
    console.error(`Listas activas: ${results.tables.listas_transmutaciones?.active_count || 0}`);
    console.error(`Items totales: ${results.tables.items_transmutaciones?.total_count || 0}`);
    console.error(`Items activos: ${results.tables.items_transmutaciones?.active_count || 0}`);
    console.error(`Classifications totales: ${results.tables.pde_classification_terms?.total_count || 0}`);
    console.error(`Classifications activas: ${results.tables.pde_classification_terms?.active_count || 0}`);
    console.error(`Relaciones lista-classification: ${results.tables.transmutacion_lista_classifications?.total_count || 0}`);
    
    if (results.errors.length > 0) {
      console.error('\n=== ERRORES ===');
      results.errors.forEach(err => console.error(`- ${err}`));
      process.exit(1);
    }

    process.exit(0);
  } catch (error) {
    console.error('Error fatal en diagnóstico:', error);
    console.error(JSON.stringify({
      error: error.message,
      stack: error.stack
    }, null, 2));
    process.exit(1);
  }
}

diagnoseAlquimiaDB();
