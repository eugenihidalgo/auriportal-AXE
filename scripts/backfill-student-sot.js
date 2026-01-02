#!/usr/bin/env node
// scripts/backfill-student-sot.js
// Backfill mínimo para Student SOT v1
//
// Uso:
//   node scripts/backfill-student-sot.js --dry-run --limit 20
//   node scripts/backfill-student-sot.js --apply --limit 20
//   node scripts/backfill-student-sot.js --apply --student_id 123

import 'dotenv/config';
import { query } from '../database/pg.js';
import { getDefaultStudentAuditRepo } from '../src/infra/repos/student-audit-repo-pg.js';
import { getDefaultStudentOntologicalRepo } from '../src/infra/repos/student-ontological-repo-pg.js';
import { getDefaultStudentOperationalStateRepo } from '../src/infra/repos/student-operational-state-repo-pg.js';

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run') || !args.includes('--apply');
const limit = args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1], 10) : null;
const studentId = args.includes('--student_id') ? parseInt(args[args.indexOf('--student_id') + 1], 10) : null;

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('BACKFILL STUDENT SOT v1');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Modo: ${isDryRun ? 'DRY-RUN (no aplicará cambios)' : 'APPLY (aplicará cambios)'}`);
  if (limit) console.log(`Límite: ${limit} alumnos`);
  if (studentId) console.log(`Alumno específico: ${studentId}`);
  console.log('');

  try {
    // Obtener alumnos de la tabla alumnos
    let alumnosQuery = 'SELECT id, email, apodo, estado_suscripcion, fecha_inscripcion FROM alumnos';
    const alumnosParams = [];
    
    if (studentId) {
      alumnosQuery += ' WHERE id = $1';
      alumnosParams.push(studentId);
    } else {
      alumnosQuery += ' ORDER BY id';
      if (limit) {
        alumnosQuery += ` LIMIT $1`;
        alumnosParams.push(limit);
      }
    }
    
    const alumnosResult = await query(alumnosQuery, alumnosParams);
    const alumnos = alumnosResult.rows || [];
    
    console.log(`📊 Alumnos encontrados: ${alumnos.length}`);
    console.log('');

    if (alumnos.length === 0) {
      console.log('✅ No hay alumnos para procesar');
      return;
    }

    // Verificar qué alumnos ya tienen registros en students
    const existingStudents = await query(
      'SELECT legacy_alumno_id FROM students WHERE legacy_alumno_id = ANY($1) AND deleted_at IS NULL',
      [alumnos.map(a => a.id)]
    );
    const existingStudentsMap = new Set(existingStudents.rows.map(s => s.legacy_alumno_id));

    // Verificar qué alumnos ya tienen product membership
    const existingMemberships = await query(
      'SELECT student_id, product_key FROM student_product_memberships WHERE student_id = ANY($1)',
      [alumnos.map(a => a.id)]
    );
    const existingMap = new Map();
    existingMemberships.rows.forEach(m => {
      if (!existingMap.has(m.student_id)) {
        existingMap.set(m.student_id, []);
      }
      existingMap.get(m.student_id).push(m.product_key);
    });

    // Verificar qué students ya tienen estado operativo
    const existingOperationalStates = await query(
      `SELECT s.legacy_alumno_id 
       FROM students s
       JOIN student_operational_state sos ON s.id = sos.student_id
       WHERE s.legacy_alumno_id = ANY($1) AND sos.ends_at IS NULL`,
      [alumnos.map(a => a.id)]
    );
    const existingOperationalStatesMap = new Set(existingOperationalStates.rows.map(s => s.legacy_alumno_id));

    let toInsertStudent = 0;
    let toInsertMembership = 0;
    let toInsertOperationalState = 0;
    let alreadyExists = 0;

    console.log('📋 Análisis de alumnos:');
    console.log('');

    for (const alumno of alumnos) {
      const hasStudent = existingStudentsMap.has(alumno.id);
      const hasPde = existingMap.get(alumno.id)?.includes('pde') || false;
      const hasOperationalState = existingOperationalStatesMap.has(alumno.id);
      
      const needs = [];
      if (!hasStudent) needs.push('student');
      if (!hasPde) needs.push('membership');
      if (!hasOperationalState) needs.push('operational_state');
      
      if (needs.length > 0) {
        console.log(`  [INSERTAR] ID: ${alumno.id} | Email: ${alumno.email || 'N/A'} | Necesita: ${needs.join(', ')}`);
        if (!hasStudent) toInsertStudent++;
        if (!hasPde) toInsertMembership++;
        if (!hasOperationalState) toInsertOperationalState++;
      } else {
        alreadyExists++;
        console.log(`  [EXISTE]   ID: ${alumno.id} | Email: ${alumno.email || 'N/A'}`);
      }
    }

    console.log('');
    console.log(`📊 Resumen:`);
    console.log(`  - Total alumnos: ${alumnos.length}`);
    console.log(`  - Ya completos: ${alreadyExists}`);
    console.log(`  - A insertar students: ${toInsertStudent}`);
    console.log(`  - A insertar memberships: ${toInsertMembership}`);
    console.log(`  - A insertar operational_states: ${toInsertOperationalState}`);
    console.log('');

    if (isDryRun) {
      console.log('✅ DRY-RUN completado. Usa --apply para aplicar cambios.');
      return;
    }

    // Aplicar cambios
    console.log('🔄 Aplicando cambios...');
    console.log('');

    const traceId = `backfill-${Date.now()}`;
    const auditRepo = getDefaultStudentAuditRepo();
    let inserted = 0;
    let errors = 0;

    for (const alumno of alumnos) {
      const hasPde = existingMap.get(alumno.id)?.includes('pde') || false;
      
      if (hasPde) {
        continue;
      }

      try {
        // Insertar product membership
        await query(
          `INSERT INTO student_product_memberships (student_id, product_key, status, joined_at)
           VALUES ($1, 'pde', $2, $3)
           ON CONFLICT (student_id, product_key) DO NOTHING`,
          [
            alumno.id,
            alumno.estado_suscripcion === 'activa' ? 'active' : 'paused',
            alumno.fecha_inscripcion || new Date()
          ]
        );

        // Registrar evento de auditoría (usando dominio genérico para eventos de sistema)
        // Nota: Para eventos de sistema como backfill, usamos un dominio especial
        try {
          await auditRepo.createAuditEvent({
            student_id: alumno.id,
            domain_key: 'system',
            item_id: 0,
            action: 'BACKFILLED',
            actor_type: 'system',
            actor_id: 'backfill-script',
            before: null,
            after: {
              product_key: 'pde',
              status: alumno.estado_suscripcion === 'activa' ? 'active' : 'paused'
            },
            trace_id: traceId
          });
        } catch (auditError) {
          // Si falla la auditoría, continuar (no es crítico para el backfill)
          console.warn(`  ⚠️  No se pudo registrar auditoría para ID ${alumno.id}: ${auditError.message}`);
        }

        inserted++;
        console.log(`  ✅ Insertado: ID ${alumno.id} (${alumno.email || 'N/A'})`);
      } catch (error) {
        errors++;
        console.error(`  ❌ Error en ID ${alumno.id}: ${error.message}`);
      }
    }

    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ BACKFILL COMPLETADO');
    console.log(`  - Students insertados: ${insertedStudent}`);
    console.log(`  - Memberships insertadas: ${insertedMembership}`);
    console.log(`  - Estados operativos insertados: ${insertedOperationalState}`);
    console.log(`  - Errores: ${errors}`);
    console.log(`  - Trace ID: ${traceId}`);
    console.log('═══════════════════════════════════════════════════════════');
  } catch (error) {
    console.error('❌ Error en backfill:', error);
    process.exit(1);
  }
}

main();

