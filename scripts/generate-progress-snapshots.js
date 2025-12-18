// scripts/generate-progress-snapshots.js
// Script batch para generar snapshots de progreso de todos los alumnos
//
// USO:
//   node scripts/generate-progress-snapshots.js          # Solo muestra lo que haría (dry-run)
//   node scripts/generate-progress-snapshots.js --apply # Genera snapshots (persiste en DB)
//
// Este script recorre todos los alumnos y:
// 1. Calcula progreso usando computeProgress()
// 2. Genera snapshot con los datos calculados
// 3. NO modifica el cálculo ni los overrides
// 4. Maneja errores por alumno sin romper el proceso

import { getPool } from '../database/pg.js';
import { computeProgress } from '../src/core/progress-engine.js';
import { findStudentByEmail } from '../src/modules/student-v4.js';
import { generateProgressSnapshot } from '../src/core/progress-snapshot.js';
import { logInfo } from '../src/core/observability/logger.js';

const args = process.argv.slice(2);
const applyMode = args.includes('--apply');
const dryRun = !applyMode;

async function generateSnapshots() {
  const pool = getPool();
  const horaInicio = new Date().toISOString();
  
  console.log(`\n📸 [${horaInicio}] Iniciando generación de snapshots de progreso...`);
  console.log(`   Modo: ${dryRun ? 'DRY-RUN (solo mostrar lo que haría)' : 'APLICAR (generar snapshots)'}\n`);

  try {
    // Obtener todos los alumnos
    const alumnosResult = await pool.query(`
      SELECT id, email, fecha_inscripcion
      FROM alumnos
      ORDER BY id
    `);

    const totalAlumnos = alumnosResult.rows.length;
    console.log(`📊 Encontrados ${totalAlumnos} alumnos\n`);

    const estadisticas = {
      total: totalAlumnos,
      procesados: 0,
      generados: 0,
      errores: 0,
      errores_detalle: []
    };

    // Procesar cada alumno
    for (let i = 0; i < alumnosResult.rows.length; i++) {
      const alumno = alumnosResult.rows[i];
      
      try {
        // Obtener student completo (necesario para computeProgress)
        const student = await findStudentByEmail(null, alumno.email);
        if (!student) {
          console.log(`   ⚠️  ${alumno.email}: No se encontró student completo, saltando...`);
          estadisticas.errores++;
          estadisticas.errores_detalle.push({
            email: alumno.email,
            error: 'Student no encontrado'
          });
          continue;
        }

        // Calcular progreso usando motor único
        const progress = await computeProgress({ 
          student, 
          now: new Date(), 
          env: process.env 
        });

        if (dryRun) {
          // Solo mostrar lo que haría
          console.log(`   📸 ${alumno.email}:`);
          console.log(`      Nivel Base: ${progress.nivel_base}`);
          console.log(`      Nivel Efectivo: ${progress.nivel_efectivo}`);
          console.log(`      Fase: ${progress.fase_efectiva?.nombre || 'N/A'}`);
          console.log(`      Días Activos: ${progress.dias_activos}`);
          console.log(`      Días Pausados: ${progress.dias_pausados}`);
          console.log(`      → Se generaría snapshot`);
          estadisticas.procesados++;
        } else {
          // Generar snapshot
          const snapshot = await generateProgressSnapshot(student.id, {
            student,
            env: process.env
          });

          console.log(`   ✅ ${alumno.email}: Snapshot generado (ID: ${snapshot.id})`);
          console.log(`      Nivel Efectivo: ${snapshot.nivel_efectivo}, Fase: ${snapshot.fase_nombre}`);
          
          estadisticas.procesados++;
          estadisticas.generados++;
        }

      } catch (error) {
        // Error por alumno: registrar pero continuar
        console.error(`   ❌ ${alumno.email}: Error generando snapshot - ${error.message}`);
        estadisticas.errores++;
        estadisticas.errores_detalle.push({
          email: alumno.email,
          error: error.message
        });
        // Continuar con el siguiente alumno
      }
    }

    // Resumen final
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 RESUMEN FINAL`);
    console.log(`${'='.repeat(60)}`);
    console.log(`Total alumnos: ${estadisticas.total}`);
    console.log(`Procesados: ${estadisticas.procesados}`);
    if (!dryRun) {
      console.log(`Snapshots generados: ${estadisticas.generados}`);
    }
    console.log(`Errores: ${estadisticas.errores}`);
    
    if (estadisticas.errores_detalle.length > 0) {
      console.log(`\n⚠️  Detalle de errores:`);
      estadisticas.errores_detalle.forEach((err, idx) => {
        console.log(`   ${idx + 1}. ${err.email}: ${err.error}`);
      });
    }

    const horaFin = new Date().toISOString();
    console.log(`\n✅ Proceso completado: ${horaInicio} → ${horaFin}\n`);

    // Log de auditoría (solo si se aplicaron cambios)
    if (!dryRun && estadisticas.generados > 0) {
      logInfo('progress_snapshot', 'Batch de snapshots completado', {
        total_alumnos: estadisticas.total,
        snapshots_generados: estadisticas.generados,
        errores: estadisticas.errores,
        hora_inicio: horaInicio,
        hora_fin: horaFin
      });
    }

  } catch (error) {
    console.error(`\n❌ Error fatal en el proceso:`, error);
    console.error(`Stack:`, error.stack);
    process.exit(1);
  }
}

// Ejecutar
generateSnapshots()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error no manejado:', error);
    process.exit(1);
  });










