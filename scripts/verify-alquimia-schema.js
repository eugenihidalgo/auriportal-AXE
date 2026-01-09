// scripts/verify-alquimia-schema.js
// Script de verificación del schema de Alquimia (Preflight D0)

import { query } from '../database/pg.js';

async function verifySchema() {
  console.log('═══════════════════════════════════════════════');
  console.log('VERIFICACIÓN SCHEMA ALQUIMIA - PREFLIGHT D0');
  console.log('═══════════════════════════════════════════════\n');

  const report = {
    tables: {},
    errors: [],
    warnings: []
  };

  try {
    // 1. Verificar listas_transmutaciones
    console.log('1. Verificando listas_transmutaciones...');
    try {
      const columns = await query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'listas_transmutaciones'
        ORDER BY ordinal_position
      `);
      
      report.tables.listas_transmutaciones = {
        exists: true,
        columns: columns.rows,
        has_status: columns.rows.some(c => c.column_name === 'status'),
        has_activo: columns.rows.some(c => c.column_name === 'activo'),
        has_category_key: columns.rows.some(c => c.column_name === 'category_key'),
        has_subtype_key: columns.rows.some(c => c.column_name === 'subtype_key'),
        has_tags: columns.rows.some(c => c.column_name === 'tags')
      };
      
      console.log(`   ✅ Tabla existe con ${columns.rows.length} columnas`);
      console.log(`   - status: ${report.tables.listas_transmutaciones.has_status ? '✅' : '❌'}`);
      console.log(`   - activo (legacy): ${report.tables.listas_transmutaciones.has_activo ? '⚠️  EXISTE' : '✅ No existe'}`);
      console.log(`   - category_key (legacy): ${report.tables.listas_transmutaciones.has_category_key ? '⚠️  EXISTE' : '✅ No existe'}`);
      
      // Contar registros
      const count = await query('SELECT COUNT(*) as count FROM listas_transmutaciones');
      console.log(`   - Registros totales: ${count.rows[0].count}`);
      
      const activeCount = await query("SELECT COUNT(*) as count FROM listas_transmutaciones WHERE status = 'active'");
      console.log(`   - Registros activos (status='active'): ${activeCount.rows[0].count}`);
    } catch (error) {
      report.errors.push(`listas_transmutaciones: ${error.message}`);
      console.log(`   ❌ Error: ${error.message}`);
    }

    // 2. Verificar items_transmutaciones
    console.log('\n2. Verificando items_transmutaciones...');
    try {
      const columns = await query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'items_transmutaciones'
        ORDER BY ordinal_position
      `);
      
      report.tables.items_transmutaciones = {
        exists: true,
        columns: columns.rows.map(c => c.column_name),
        has_item_ref: columns.rows.some(c => c.column_name === 'item_ref'),
        has_status: columns.rows.some(c => c.column_name === 'status'),
        has_activo: columns.rows.some(c => c.column_name === 'activo'),
        has_priority: columns.rows.some(c => c.column_name === 'priority'),
        has_orden: columns.rows.some(c => c.column_name === 'orden'),
        has_frecuencia_dias: columns.rows.some(c => c.column_name === 'frecuencia_dias'),
        has_veces_limpiar: columns.rows.some(c => c.column_name === 'veces_limpiar'),
        has_nivel: columns.rows.some(c => c.column_name === 'nivel'),
        has_grupo: columns.rows.some(c => c.column_name === 'grupo'),
        has_critical_multiplier: columns.rows.some(c => c.column_name === 'critical_multiplier')
      };
      
      console.log(`   ✅ Tabla existe con ${columns.rows.length} columnas`);
      console.log(`   - item_ref: ${report.tables.items_transmutaciones.has_item_ref ? '✅' : '❌ FALTA'}`);
      console.log(`   - status: ${report.tables.items_transmutaciones.has_status ? '✅' : '❌ FALTA'}`);
      console.log(`   - activo (legacy): ${report.tables.items_transmutaciones.has_activo ? '⚠️  EXISTE' : '✅ No existe'}`);
      console.log(`   - priority: ${report.tables.items_transmutaciones.has_priority ? '✅' : '❌ FALTA'}`);
      console.log(`   - orden: ${report.tables.items_transmutaciones.has_orden ? '⚠️  EXISTE (legacy?)' : '✅ No existe'}`);
      console.log(`   - frecuencia_dias: ${report.tables.items_transmutaciones.has_frecuencia_dias ? '✅' : '❌ FALTA'}`);
      console.log(`   - veces_limpiar: ${report.tables.items_transmutaciones.has_veces_limpiar ? '✅' : '❌ FALTA'}`);
      console.log(`   - nivel: ${report.tables.items_transmutaciones.has_nivel ? '✅' : '❌ FALTA'}`);
      console.log(`   - grupo: ${report.tables.items_transmutaciones.has_grupo ? '✅' : '⚠️  No existe'}`);
      console.log(`   - critical_multiplier: ${report.tables.items_transmutaciones.has_critical_multiplier ? '✅ EXISTE' : '❌ NO EXISTE (usado en código)'}`);
      
      if (!report.tables.items_transmutaciones.has_critical_multiplier) {
        report.warnings.push('critical_multiplier no existe en schema pero se usa en código (default: 2.0)');
      }
      
      // Contar registros
      const count = await query('SELECT COUNT(*) as count FROM items_transmutaciones');
      console.log(`   - Registros totales: ${count.rows[0].count}`);
      
      const activeCount = await query("SELECT COUNT(*) as count FROM items_transmutaciones WHERE status = 'active'");
      console.log(`   - Registros activos (status='active'): ${activeCount.rows[0].count}`);
      
      // Verificar item_ref
      const itemsSinRef = await query("SELECT COUNT(*) as count FROM items_transmutaciones WHERE item_ref IS NULL OR item_ref = ''");
      if (parseInt(itemsSinRef.rows[0].count) > 0) {
        report.warnings.push(`items_transmutaciones: ${itemsSinRef.rows[0].count} items sin item_ref`);
      }
    } catch (error) {
      report.errors.push(`items_transmutaciones: ${error.message}`);
      console.log(`   ❌ Error: ${error.message}`);
    }

    // 3. Verificar pde_classification_terms
    console.log('\n3. Verificando pde_classification_terms...');
    try {
      const exists = await query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_name = 'pde_classification_terms'
        ) as exists
      `);
      
      if (exists.rows[0].exists) {
        const count = await query('SELECT COUNT(*) as count FROM pde_classification_terms');
        const activeCount = await query("SELECT COUNT(*) as count FROM pde_classification_terms WHERE status = 'active'");
        console.log(`   ✅ Tabla existe`);
        console.log(`   - Términos totales: ${count.rows[0].count}`);
        console.log(`   - Términos activos: ${activeCount.rows[0].count}`);
        
        // Por tipo
        const byType = await query(`
          SELECT type, COUNT(*) as count 
          FROM pde_classification_terms 
          WHERE status = 'active'
          GROUP BY type
        `);
        byType.rows.forEach(row => {
          console.log(`   - ${row.type}: ${row.count}`);
        });
        
        report.tables.pde_classification_terms = { exists: true, count: parseInt(count.rows[0].count) };
      } else {
        report.errors.push('pde_classification_terms: Tabla no existe');
        console.log(`   ❌ Tabla no existe`);
      }
    } catch (error) {
      report.errors.push(`pde_classification_terms: ${error.message}`);
      console.log(`   ❌ Error: ${error.message}`);
    }

    // 4. Verificar transmutacion_lista_classifications
    console.log('\n4. Verificando transmutacion_lista_classifications...');
    try {
      const exists = await query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_name = 'transmutacion_lista_classifications'
        ) as exists
      `);
      
      if (exists.rows[0].exists) {
        const count = await query('SELECT COUNT(*) as count FROM transmutacion_lista_classifications');
        console.log(`   ✅ Tabla existe`);
        console.log(`   - Asociaciones totales: ${count.rows[0].count}`);
        
        report.tables.transmutacion_lista_classifications = { exists: true, count: parseInt(count.rows[0].count) };
      } else {
        report.errors.push('transmutacion_lista_classifications: Tabla no existe');
        console.log(`   ❌ Tabla no existe`);
      }
    } catch (error) {
      report.errors.push(`transmutacion_lista_classifications: ${error.message}`);
      console.log(`   ❌ Error: ${error.message}`);
    }

    // 5. Verificar cleaning_events
    console.log('\n5. Verificando cleaning_events...');
    try {
      const exists = await query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_name = 'cleaning_events'
        ) as exists
      `);
      
      if (exists.rows[0].exists) {
        const count = await query('SELECT COUNT(*) as count FROM cleaning_events');
        console.log(`   ✅ Tabla existe`);
        console.log(`   - Eventos totales: ${count.rows[0].count}`);
        
        report.tables.cleaning_events = { exists: true, count: parseInt(count.rows[0].count) };
      } else {
        report.errors.push('cleaning_events: Tabla no existe');
        console.log(`   ❌ Tabla no existe`);
      }
    } catch (error) {
      report.errors.push(`cleaning_events: ${error.message}`);
      console.log(`   ❌ Error: ${error.message}`);
    }

    // 6. Verificar cleaning_item_state
    console.log('\n6. Verificando cleaning_item_state...');
    try {
      const exists = await query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_name = 'cleaning_item_state'
        ) as exists
      `);
      
      if (exists.rows[0].exists) {
        const count = await query('SELECT COUNT(*) as count FROM cleaning_item_state');
        const byStudent = await query(`
          SELECT student_id, COUNT(*) as count 
          FROM cleaning_item_state 
          WHERE product_key = 'pde' AND domain_type = 'transmutation'
          GROUP BY student_id 
          ORDER BY count DESC 
          LIMIT 5
        `);
        console.log(`   ✅ Tabla existe`);
        console.log(`   - Estados totales: ${count.rows[0].count}`);
        console.log(`   - Top 5 estudiantes por cantidad de estados:`);
        byStudent.rows.forEach(row => {
          console.log(`     - student_id=${row.student_id}: ${row.count} estados`);
        });
        
        report.tables.cleaning_item_state = { exists: true, count: parseInt(count.rows[0].count) };
      } else {
        report.errors.push('cleaning_item_state: Tabla no existe');
        console.log(`   ❌ Tabla no existe`);
      }
    } catch (error) {
      report.errors.push(`cleaning_item_state: ${error.message}`);
      console.log(`   ❌ Error: ${error.message}`);
    }

    // 7. Verificar alumnos
    console.log('\n7. Verificando alumnos...');
    try {
      const exists = await query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_name = 'alumnos'
        ) as exists
      `);
      
      if (exists.rows[0].exists) {
        const count = await query('SELECT COUNT(*) as count FROM alumnos');
        const withNivelEfectivo = await query("SELECT COUNT(*) as count FROM alumnos WHERE nivel_efectivo IS NOT NULL");
        console.log(`   ✅ Tabla existe`);
        console.log(`   - Alumnos totales: ${count.rows[0].count}`);
        console.log(`   - Con nivel_efectivo: ${withNivelEfectivo.rows[0].count}`);
        
        report.tables.alumnos = { exists: true, count: parseInt(count.rows[0].count) };
      } else {
        report.errors.push('alumnos: Tabla no existe');
        console.log(`   ❌ Tabla no existe`);
      }
    } catch (error) {
      report.errors.push(`alumnos: ${error.message}`);
      console.log(`   ❌ Error: ${error.message}`);
    }

    // 8. Verificar índices críticos
    console.log('\n8. Verificando índices críticos...');
    try {
      const indexes = await query(`
        SELECT 
          tablename, 
          indexname, 
          indexdef
        FROM pg_indexes
        WHERE tablename IN (
          'listas_transmutaciones',
          'items_transmutaciones',
          'cleaning_item_state',
          'cleaning_events',
          'transmutacion_lista_classifications'
        )
        ORDER BY tablename, indexname
      `);
      
      console.log(`   ✅ Encontrados ${indexes.rows.length} índices`);
      
      const criticalIndexes = [
        'idx_items_transmutaciones_item_ref',
        'idx_cleaning_item_state_item_ref',
        'idx_cleaning_events_student_item',
        'idx_cleaning_events_execution_student'
      ];
      
      const foundIndexes = indexes.rows.map(i => i.indexname);
      criticalIndexes.forEach(idx => {
        if (foundIndexes.includes(idx)) {
          console.log(`   ✅ ${idx}`);
        } else {
          report.warnings.push(`Índice crítico faltante: ${idx}`);
          console.log(`   ⚠️  FALTA: ${idx}`);
        }
      });
      
      report.indexes = indexes.rows;
    } catch (error) {
      report.errors.push(`Índices: ${error.message}`);
      console.log(`   ❌ Error: ${error.message}`);
    }

    // Resumen
    console.log('\n═══════════════════════════════════════════════');
    console.log('RESUMEN');
    console.log('═══════════════════════════════════════════════');
    console.log(`Errores: ${report.errors.length}`);
    console.log(`Advertencias: ${report.warnings.length}`);
    
    if (report.errors.length > 0) {
      console.log('\n❌ ERRORES:');
      report.errors.forEach(e => console.log(`   - ${e}`));
    }
    
    if (report.warnings.length > 0) {
      console.log('\n⚠️  ADVERTENCIAS:');
      report.warnings.forEach(w => console.log(`   - ${w}`));
    }
    
    if (report.errors.length === 0 && report.warnings.length === 0) {
      console.log('\n✅ Schema verificado correctamente');
    }
    
    return report;
  } catch (error) {
    console.error('\n❌ Error fatal:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

verifySchema();
