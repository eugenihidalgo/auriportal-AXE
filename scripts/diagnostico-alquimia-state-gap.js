// Script temporal para diagnóstico de gap entre catálogo y cleaning_item_state
import { query } from '../database/pg.js';

async function diagnostico() {
  console.log('=== DIAGNÓSTICO ALQUIMIA ALUMNO STATE GAP ===\n');
  
  try {
    // 1. Estados en cleaning_item_state (student_id=4 y 6)
    console.log('1. Estados en cleaning_item_state (student_id=4 y 6):');
    const statesResult = await query(`
      SELECT 
        student_id,
        COUNT(*) as total_states,
        COUNT(CASE WHEN shared_last_cleaned_at IS NOT NULL THEN 1 END) as states_with_cleaned,
        COUNT(CASE WHEN shared_last_cleaned_at IS NULL THEN 1 END) as states_never_cleaned
      FROM cleaning_item_state
      WHERE student_id IN (4, 6)
        AND product_key = 'pde'
        AND domain_type = 'transmutation'
      GROUP BY student_id
      ORDER BY student_id
    `);
    console.log(JSON.stringify(statesResult.rows, null, 2));
    console.log('');
    
    // 2. Eventos en cleaning_events (student_id=4 y 6)
    console.log('2. Eventos en cleaning_events (student_id=4 y 6):');
    const eventsResult = await query(`
      SELECT 
        student_id,
        COUNT(*) as total_events,
        COUNT(DISTINCT item_ref) as unique_items_with_events
      FROM cleaning_events
      WHERE student_id IN (4, 6)
        AND product_key = 'pde'
        AND domain_type = 'transmutation'
      GROUP BY student_id
      ORDER BY student_id
    `);
    console.log(JSON.stringify(eventsResult.rows, null, 2));
    console.log('');
    
    // 3. Catálogo - Items activos
    console.log('3. Catálogo - Items activos:');
    const catalogItemsResult = await query(`
      SELECT 
        COUNT(*) as total_items_activos,
        COUNT(DISTINCT lista_id) as unique_listas,
        COUNT(CASE WHEN item_ref IS NOT NULL THEN 1 END) as items_with_ref,
        COUNT(CASE WHEN lista_id IS NOT NULL THEN 1 END) as items_with_lista
      FROM items_transmutaciones
      WHERE (status = 'active' OR activo = true)
    `);
    console.log(JSON.stringify(catalogItemsResult.rows, null, 2));
    console.log('');
    
    // 4. Catálogo - Listas activas
    console.log('4. Catálogo - Listas activas:');
    const catalogListasResult = await query(`
      SELECT 
        COUNT(*) as total_listas_activas
      FROM listas_transmutaciones
      WHERE (status = 'active' OR activo = true)
    `);
    console.log(JSON.stringify(catalogListasResult.rows, null, 2));
    console.log('');
    
    // 5. GAP - Items del catálogo sin estado (student_id=4)
    console.log('5. GAP - Items del catálogo sin estado (student_id=4):');
    const gapItemsResult = await query(`
      SELECT 
        COUNT(*) as items_catalogo_sin_estado
      FROM items_transmutaciones i
      WHERE (i.status = 'active' OR i.activo = true)
        AND i.item_ref IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 
          FROM cleaning_item_state s
          WHERE s.student_id = 4
            AND s.product_key = 'pde'
            AND s.domain_type = 'transmutation'
            AND s.item_ref = i.item_ref
        )
    `);
    console.log(JSON.stringify(gapItemsResult.rows, null, 2));
    console.log('');
    
    // 6. GAP - States con item_ref inexistente (student_id=4)
    console.log('6. GAP - States con item_ref inexistente (student_id=4):');
    const gapStatesResult = await query(`
      SELECT 
        COUNT(*) as states_con_item_ref_inexistente
      FROM cleaning_item_state s
      WHERE s.student_id = 4
        AND s.product_key = 'pde'
        AND s.domain_type = 'transmutation'
        AND NOT EXISTS (
          SELECT 1 
          FROM items_transmutaciones i
          WHERE (i.status = 'active' OR i.activo = true)
            AND i.item_ref = s.item_ref
        )
    `);
    console.log(JSON.stringify(gapStatesResult.rows, null, 2));
    console.log('');
    
    // 7. Ejemplo items sin estado (student_id=4, primeros 10)
    console.log('7. Ejemplo items sin estado (student_id=4, primeros 10):');
    const exampleItemsResult = await query(`
      SELECT 
        i.item_ref,
        i.nombre,
        i.lista_id,
        i.nivel
      FROM items_transmutaciones i
      WHERE (i.status = 'active' OR i.activo = true)
        AND i.item_ref IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 
          FROM cleaning_item_state s
          WHERE s.student_id = 4
            AND s.product_key = 'pde'
            AND s.domain_type = 'transmutation'
            AND s.item_ref = i.item_ref
        )
      LIMIT 10
    `);
    console.log(JSON.stringify(exampleItemsResult.rows, null, 2));
    console.log('');
    
    // 8. Nivel efectivo del alumno 4
    console.log('8. Nivel efectivo del alumno 4:');
    const studentResult = await query(`
      SELECT 
        id,
        email,
        nivel_actual
      FROM alumnos
      WHERE id = 4
    `);
    console.log(JSON.stringify(studentResult.rows, null, 2));
    console.log('');
    
    console.log('=== DIAGNÓSTICO COMPLETADO ===');
    process.exit(0);
  } catch (error) {
    console.error('Error en diagnóstico:', error);
    process.exit(1);
  }
}

diagnostico();
