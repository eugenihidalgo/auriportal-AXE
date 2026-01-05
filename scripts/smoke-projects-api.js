// scripts/smoke-projects-api.js
// Smoke tests mínimos para endpoints de Projects API

import { query, initPostgreSQL } from '../database/pg.js';
import { getDefaultStudentProjectStateRepo } from '../src/infra/repos/student-project-state-repo-pg.js';

async function smokeTests() {
  try {
    console.log('🔥 SMOKE TESTS - Projects API\n');
    console.log('='.repeat(60));
    
    initPostgreSQL();
    const projectStateRepo = getDefaultStudentProjectStateRepo();
    
    // Test 1: listAllActive (no debe explotar aunque esté vacío)
    console.log('\n📋 Test 1: listAllActive()');
    try {
      const activeProjects = await projectStateRepo.listAllActive();
      console.log(`   ✅ listAllActive() OK (${activeProjects.length} proyectos activos)`);
    } catch (error) {
      console.error(`   ❌ listAllActive() FAILED: ${error.message}`);
      throw error;
    }
    
    // Test 2: listByStudent con student_id existente (aunque tenga 0 proyectos)
    console.log('\n📋 Test 2: listByStudent(student_id=4)');
    try {
      // Verificar que el alumno existe
      const studentCheck = await query('SELECT id FROM alumnos WHERE id = $1', [4]);
      if (studentCheck.rows.length === 0) {
        console.log('   ⚠️  Alumno 4 no existe, usando primer alumno disponible...');
        const firstStudent = await query('SELECT id FROM alumnos LIMIT 1');
        if (firstStudent.rows.length === 0) {
          console.log('   ⚠️  No hay alumnos en BD, saltando test');
        } else {
          const studentId = firstStudent.rows[0].id;
          const projects = await projectStateRepo.listByStudent(studentId);
          console.log(`   ✅ listByStudent(${studentId}) OK (${projects.length} proyectos)`);
        }
      } else {
        const projects = await projectStateRepo.listByStudent(4);
        console.log(`   ✅ listByStudent(4) OK (${projects.length} proyectos)`);
      }
    } catch (error) {
      console.error(`   ❌ listByStudent() FAILED: ${error.message}`);
      throw error;
    }
    
    // Test 3: Verificar que la función SQL funciona con TIMESTAMPTZ
    console.log('\n📋 Test 3: calculate_days_since_clean con TIMESTAMPTZ');
    try {
      const result = await query(`
        SELECT calculate_days_since_clean(NOW() - INTERVAL '5 days', 30) as days
      `);
      console.log(`   ✅ calculate_days_since_clean(TIMESTAMPTZ) OK (${result.rows[0].days} días)`);
    } catch (error) {
      console.error(`   ❌ calculate_days_since_clean(TIMESTAMPTZ) FAILED: ${error.message}`);
      throw error;
    }
    
    // Test 4: Verificar que la función SQL funciona con TIMESTAMP (compatibilidad)
    console.log('\n📋 Test 4: calculate_days_since_clean con TIMESTAMP (compatibilidad)');
    try {
      const result = await query(`
        SELECT calculate_days_since_clean((NOW() - INTERVAL '5 days')::TIMESTAMP, 30) as days
      `);
      console.log(`   ✅ calculate_days_since_clean(TIMESTAMP) OK (${result.rows[0].days} días)`);
    } catch (error) {
      console.error(`   ❌ calculate_days_since_clean(TIMESTAMP) FAILED: ${error.message}`);
      throw error;
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Todos los smoke tests pasaron\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Smoke test falló:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

smokeTests();
