// scripts/progress/recompute-all.js
// Script para recalcular progreso (nivel + fase) de todos los alumnos
//
// USO:
//   node scripts/progress/recompute-all.js          # Solo muestra diferencias (dry-run)
//   node scripts/progress/recompute-all.js --apply  # Aplica cambios (persiste en DB)
//
// Este script recorre todos los alumnos y:
// 1. Calcula nivel_base usando computeProgress()
// 2. Compara con nivel_actual en DB
// 3. Muestra diferencias (nivel_base, nivel_efectivo, fase)
// 4. Si --apply: persiste solo lo necesario (nivel_actual si cambió)

import { getPool, initPostgreSQL } from '../../database/pg.js';
import { computeProgress } from '../../src/core/progress-engine.js';
import { findStudentByEmail } from '../../src/modules/student-v4.js';

const args = process.argv.slice(2);
const applyMode = args.includes('--apply');

async function recomputeAll() {
  const horaInicio = new Date().toISOString();
  
  console.log(`\n🔄 [${horaInicio}] Iniciando recálculo de progreso de todos los alumnos...`);
  console.log(`   Modo: ${applyMode ? 'APLICAR CAMBIOS' : 'DRY-RUN (solo mostrar diferencias)'}\n`);

  try {
    // Inicializar PostgreSQL
    await initPostgreSQL();
    
    const pool = getPool();
    
    // Obtener todos los alumnos
    const alumnosResult = await pool.query(`
      SELECT id, email, nivel_actual, nivel_manual, estado_suscripcion, fecha_inscripcion
      FROM alumnos
      ORDER BY id
    `);

    const totalAlumnos = alumnosResult.rows.length;
    console.log(`📊 Encontrados ${totalAlumnos} alumnos\n`);

    const estadisticas = {
      total: totalAlumnos,
      procesados: 0,
      con_diferencias: 0,
      actualizados: 0,
      errores: 0,
      con_overrides: 0
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
          continue;
        }

        // Calcular progreso usando motor único
        const progress = await computeProgress({ 
          student, 
          now: new Date(), 
          env: process.env 
        });

        // Comparar con valores actuales en DB
        const nivelActualDB = alumno.nivel_actual || 1;
        const nivelEfectivo = progress.nivel_efectivo;
        const nivelBase = progress.nivel_base;
        const tieneOverrides = progress.overrides_aplicados.length > 0;

        if (tieneOverrides) {
          estadisticas.con_overrides++;
        }

        // Detectar diferencias
        const hayDiferencia = nivelEfectivo !== nivelActualDB;
        
        if (hayDiferencia || tieneOverrides) {
          estadisticas.con_diferencias++;
          
          console.log(`   📊 ${alumno.email}:`);
          console.log(`      DB actual: nivel=${nivelActualDB}`);
          console.log(`      Calculado: nivel_base=${nivelBase}, nivel_efectivo=${nivelEfectivo}, fase=${progress.fase_efectiva}`);
          
          if (tieneOverrides) {
            const override = progress.overrides_aplicados[0];
            console.log(`      ⚡ Override activo: ${override.type} +${override.value} (${override.reason})`);
          }
          
          if (hayDiferencia) {
            console.log(`      🔄 Diferencia: ${nivelActualDB} → ${nivelEfectivo}`);
            
            // Si hay nivel_manual, respetarlo (no actualizar automáticamente)
            if (alumno.nivel_manual) {
              console.log(`      🔒 Nivel manual establecido (${alumno.nivel_manual}), no se actualizará automáticamente`);
            } else if (applyMode) {
              // Solo actualizar si no hay nivel_manual y estamos en modo apply
              await pool.query(
                'UPDATE alumnos SET nivel_actual = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                [nivelEfectivo, alumno.id]
              );
              estadisticas.actualizados++;
              console.log(`      ✅ Actualizado en DB`);
            }
          }
          console.log('');
        }

        estadisticas.procesados++;

        // Log de progreso cada 50 alumnos
        if ((i + 1) % 50 === 0) {
          console.log(`   📊 Progreso: ${i + 1}/${totalAlumnos} alumnos procesados\n`);
        }

        // Pequeño delay para no saturar la base de datos
        if (i < alumnosResult.rows.length - 1 && (i + 1) % 50 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

      } catch (err) {
        estadisticas.errores++;
        console.error(`   ❌ Error procesando ${alumno.email}:`, err.message);
        if (err.stack) {
          console.error(`      Stack: ${err.stack.split('\n')[0]}`);
        }
      }
    }

    // Resumen final
    const horaFin = new Date().toISOString();
    console.log(`\n✅ [${horaFin}] Recálculo completado:`);
    console.log(`   - Total: ${estadisticas.total}`);
    console.log(`   - Procesados: ${estadisticas.procesados}`);
    console.log(`   - Con diferencias: ${estadisticas.con_diferencias}`);
    console.log(`   - Con overrides: ${estadisticas.con_overrides}`);
    if (applyMode) {
      console.log(`   - Actualizados: ${estadisticas.actualizados}`);
    } else {
      console.log(`   - Modo: DRY-RUN (usar --apply para aplicar cambios)`);
    }
    console.log(`   - Errores: ${estadisticas.errores}\n`);

    process.exit(0);

  } catch (error) {
    console.error(`\n❌ [${new Date().toISOString()}] Error en recálculo masivo:`, error);
    console.error(`   Stack:`, error.stack);
    process.exit(1);
  }
}

// Ejecutar
recomputeAll().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});

