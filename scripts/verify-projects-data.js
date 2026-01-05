// scripts/verify-projects-data.js
// Verificación de datos en tablas de proyectos

import { query, initPostgreSQL } from '../database/pg.js';

async function verifyData() {
  try {
    initPostgreSQL();
    
    console.log('📊 VERIFICACIÓN DE DATOS - Sistema de Proyectos v1\n');
    
    // Categorías
    const categories = await query(`
      SELECT id, category_key, name, default_recurrence_days, sort_order, is_active, created_at
      FROM project_categories
      WHERE deleted_at IS NULL
      ORDER BY sort_order
    `);
    console.log(`\n📋 Categorías de proyectos: ${categories.rows.length}`);
    categories.rows.forEach(cat => {
      console.log(`   - ${cat.category_key}: ${cat.name} (${cat.default_recurrence_days} días, orden: ${cat.sort_order}, activa: ${cat.is_active})`);
    });
    
    // Catálogo
    const catalog = await query(`
      SELECT COUNT(*) as count FROM projects_catalog WHERE deleted_at IS NULL
    `);
    console.log(`\n📋 Proyectos en catálogo: ${catalog.rows[0].count}`);
    
    // Estados de alumnos
    const states = await query(`
      SELECT COUNT(*) as count FROM student_project_state
    `);
    console.log(`\n📋 Estados alumno-proyecto: ${states.rows[0].count}`);
    
    // Límites de activación
    const limits = await query(`
      SELECT domain, COUNT(*) as count
      FROM student_activation_limits
      GROUP BY domain
    `);
    console.log(`\n📋 Límites de activación por dominio:`);
    limits.rows.forEach(l => {
      console.log(`   - ${l.domain}: ${l.count} filas`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

verifyData();
