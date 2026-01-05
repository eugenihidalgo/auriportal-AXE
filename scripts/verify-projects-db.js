// scripts/verify-projects-db.js
// Verificación forense de tablas y funciones de Proyectos en BD real

import { query, initPostgreSQL } from '../database/pg.js';

async function verifyDatabase() {
  try {
    console.log('🔍 VERIFICACIÓN FORENSE - Sistema de Proyectos v1\n');
    console.log('=' .repeat(60));
    
    // Inicializar PostgreSQL
    initPostgreSQL();
    
    // 1. Verificar BD actual
    const dbResult = await query('SELECT current_database() as db_name');
    const dbName = dbResult.rows[0].db_name;
    console.log(`\n📊 Base de datos actual: ${dbName}`);
    
    // 2. Verificar tablas de proyectos
    console.log('\n📋 TABLAS DE PROYECTOS:');
    const projectTables = ['project_categories', 'projects_catalog', 'student_project_state'];
    for (const table of projectTables) {
      try {
        const result = await query(`
          SELECT COUNT(*) as count 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        `, [table]);
        const exists = result.rows[0].count === '1';
        if (exists) {
          const data = await query(`SELECT COUNT(*) as count FROM ${table}`);
          console.log(`   ✅ ${table}: EXISTE (${data.rows[0].count} filas)`);
        } else {
          console.log(`   ❌ ${table}: NO EXISTE`);
        }
      } catch (error) {
        console.log(`   ❌ ${table}: ERROR - ${error.message}`);
      }
    }
    
    // 3. Verificar tablas de lugares (control)
    console.log('\n📋 TABLAS DE LUGARES (control):');
    const placeTables = ['place_categories', 'places_catalog', 'student_place_state'];
    for (const table of placeTables) {
      try {
        const result = await query(`
          SELECT COUNT(*) as count 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        `, [table]);
        const exists = result.rows[0].count === '1';
        if (exists) {
          const data = await query(`SELECT COUNT(*) as count FROM ${table}`);
          console.log(`   ✅ ${table}: EXISTE (${data.rows[0].count} filas)`);
        } else {
          console.log(`   ❌ ${table}: NO EXISTE`);
        }
      } catch (error) {
        console.log(`   ❌ ${table}: ERROR - ${error.message}`);
      }
    }
    
    // 4. Verificar student_activation_limits
    console.log('\n📋 TABLA student_activation_limits:');
    try {
      const result = await query(`
        SELECT COUNT(*) as count 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'student_activation_limits'
      `);
      const exists = result.rows[0].count === '1';
      if (exists) {
        const data = await query(`SELECT COUNT(*) as count FROM student_activation_limits`);
        console.log(`   ✅ student_activation_limits: EXISTE (${data.rows[0].count} filas)`);
        
        // Verificar constraint de domain
        const constraintResult = await query(`
          SELECT constraint_name, constraint_type
          FROM information_schema.table_constraints
          WHERE table_name = 'student_activation_limits'
          AND constraint_type = 'CHECK'
        `);
        if (constraintResult.rows.length > 0) {
          console.log(`   📝 Constraints CHECK encontrados: ${constraintResult.rows.length}`);
          constraintResult.rows.forEach(c => {
            console.log(`      - ${c.constraint_name} (${c.constraint_type})`);
          });
        }
        
        // Verificar si domain='projects' está permitido
        const domainCheck = await query(`
          SELECT domain, COUNT(*) as count
          FROM student_activation_limits
          WHERE domain = 'projects'
          GROUP BY domain
        `);
        if (domainCheck.rows.length > 0) {
          console.log(`   ✅ domain='projects' permitido (${domainCheck.rows[0].count} filas con domain='projects')`);
        } else {
          console.log(`   ⚠️  No hay filas con domain='projects' (puede ser normal si no se ha usado aún)`);
        }
      } else {
        console.log(`   ❌ student_activation_limits: NO EXISTE`);
      }
    } catch (error) {
      console.log(`   ❌ student_activation_limits: ERROR - ${error.message}`);
    }
    
    // 5. Verificar funciones SQL
    console.log('\n📋 FUNCIONES SQL:');
    const functions = ['calculate_days_since_clean', 'calculate_health_status'];
    for (const funcName of functions) {
      try {
        const result = await query(`
          SELECT COUNT(*) as count
          FROM information_schema.routines
          WHERE routine_schema = 'public'
          AND routine_name = $1
        `, [funcName]);
        const exists = result.rows[0].count === '1';
        if (exists) {
          console.log(`   ✅ ${funcName}(): EXISTE`);
        } else {
          console.log(`   ❌ ${funcName}(): NO EXISTE`);
        }
      } catch (error) {
        console.log(`   ❌ ${funcName}(): ERROR - ${error.message}`);
      }
    }
    
    // 6. Verificar constraints de student_project_state
    console.log('\n📋 CONSTRAINTS DE student_project_state:');
    try {
      const result = await query(`
        SELECT COUNT(*) as count 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'student_project_state'
      `);
      if (result.rows[0].count === '1') {
        const constraints = await query(`
          SELECT constraint_name, constraint_type
          FROM information_schema.table_constraints
          WHERE table_name = 'student_project_state'
          ORDER BY constraint_type, constraint_name
        `);
        if (constraints.rows.length > 0) {
          console.log(`   📝 Constraints encontrados: ${constraints.rows.length}`);
          constraints.rows.forEach(c => {
            console.log(`      - ${c.constraint_name} (${c.constraint_type})`);
          });
        } else {
          console.log(`   ⚠️  No se encontraron constraints`);
        }
      } else {
        console.log(`   ⚠️  Tabla no existe, no se pueden verificar constraints`);
      }
    } catch (error) {
      console.log(`   ❌ Error verificando constraints: ${error.message}`);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Verificación completada\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error en verificación:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

verifyDatabase();
