#!/usr/bin/env node
/**
 * Script de verificación: Integridad de datos entre sponsor_student_links y alumnos
 * 
 * Ejecuta las queries SQL solicitadas:
 * 1. ¿Qué student_id aparecen en sponsor_student_links?
 * 2. ¿Existen esos student_id en la tabla alumnos?
 * 3. ¿Cuántos alumnos devuelve la API MASTER realmente?
 */

import { query } from '../database/pg.js';

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('VERIFICACIÓN: Integridad sponsor_student_links ↔ alumnos');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // 1. ¿Qué student_id aparecen en sponsor_student_links?
    console.log('1️⃣  STUDENT_ID EN sponsor_student_links (activos):');
    console.log('─────────────────────────────────────────────────────────');
    const linksResult = await query(`
      SELECT DISTINCT student_id 
      FROM sponsor_student_links 
      WHERE deleted_at IS NULL 
      ORDER BY student_id
    `);
    
    const studentIds = linksResult.rows.map(r => r.student_id);
    console.log(`   Total de student_id únicos: ${studentIds.length}`);
    if (studentIds.length > 0) {
      console.log(`   IDs: ${studentIds.slice(0, 20).join(', ')}${studentIds.length > 20 ? '...' : ''}`);
    }
    console.log('');

    // 2. ¿Existen esos student_id en la tabla alumnos?
    console.log('2️⃣  VERIFICACIÓN: ¿Existen esos student_id en alumnos?');
    console.log('─────────────────────────────────────────────────────────');
    
    if (studentIds.length === 0) {
      console.log('   ⚠️  No hay student_id en sponsor_student_links para verificar');
    } else {
      const placeholders = studentIds.map((_, i) => `$${i + 1}`).join(', ');
      const alumnosResult = await query(`
        SELECT id, email, apodo 
        FROM alumnos
        WHERE id IN (${placeholders})
        ORDER BY id
      `, studentIds);
      
      const alumnosFound = alumnosResult.rows;
      console.log(`   ✅ Encontrados en alumnos: ${alumnosFound.length} de ${studentIds.length}`);
      
      if (alumnosFound.length < studentIds.length) {
        const foundIds = new Set(alumnosFound.map(a => a.id));
        const missingIds = studentIds.filter(id => !foundIds.has(id));
        console.log(`   ⚠️  IDs NO encontrados en alumnos: ${missingIds.join(', ')}`);
      }
      
      if (alumnosFound.length > 0) {
        console.log('\n   Ejemplos de alumnos encontrados:');
        alumnosFound.slice(0, 10).forEach(alumno => {
          console.log(`      - ID ${alumno.id}: ${alumno.email} (${alumno.apodo || 'sin apodo'})`);
        });
        if (alumnosFound.length > 10) {
          console.log(`      ... y ${alumnosFound.length - 10} más`);
        }
      }
    }
    console.log('');

    // 3. ¿Cuántos alumnos devuelve la API MASTER realmente?
    console.log('3️⃣  API MASTER: ¿Cuántos alumnos devuelve realmente?');
    console.log('─────────────────────────────────────────────────────────');
    
    // Query exacta de la API (sin búsqueda, sin límite)
    const apiResult = await query(`
      SELECT * FROM alumnos
      ORDER BY email
    `);
    
    const totalAlumnos = apiResult.rows.length;
    console.log(`   Total de alumnos en tabla alumnos: ${totalAlumnos}`);
    
    // Con límite 100 (como usa la UI)
    const apiResultLimited = await query(`
      SELECT * FROM alumnos
      ORDER BY email
      LIMIT 100
    `);
    
    console.log(`   Con límite 100: ${apiResultLimited.rows.length} alumnos`);
    
    // Con búsqueda vacía (como usa la UI por defecto)
    const apiResultSearch = await query(`
      SELECT * FROM alumnos
      WHERE (email ILIKE $1 OR apodo ILIKE $1)
      ORDER BY email
      LIMIT 100
    `, ['%%']);
    
    console.log(`   Con búsqueda vacía (%%): ${apiResultSearch.rows.length} alumnos`);
    
    // Comparación
    if (studentIds.length > 0) {
      const alumnosWithLinks = await query(`
        SELECT COUNT(DISTINCT id) as count
        FROM alumnos
        WHERE id IN (${studentIds.map((_, i) => `$${i + 1}`).join(', ')})
      `, studentIds);
      
      const countWithLinks = parseInt(alumnosWithLinks.rows[0]?.count || 0, 10);
      console.log(`\n   Alumnos con links en sponsor_student_links: ${countWithLinks}`);
      console.log(`   Porcentaje: ${((countWithLinks / totalAlumnos) * 100).toFixed(2)}% del total`);
    }
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('✅ Verificación completada');
    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error en verificación:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
