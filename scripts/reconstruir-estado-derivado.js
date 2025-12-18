// scripts/reconstruir-estado-derivado.js
// Script maestro para reconstruir AUTOMÁTICAMENTE todo el estado derivado del alumno
//
// OBJETIVO: Reconstruir pausas, rachas, nivel y fase desde datos reales
// PRINCIPIO: No importar estados, solo derivarlos
//
// USO:
//   node scripts/reconstruir-estado-derivado.js --dry-run    # Solo muestra diferencias
//   node scripts/reconstruir-estado-derivado.js --apply      # Aplica cambios

import dotenv from 'dotenv';
import { initPostgreSQL, getPool } from '../database/pg.js';
import { getDefaultAuditRepo } from '../src/infra/repos/audit-repo-pg.js';
import { crearPausa, cerrarPausaActiva, getPausaActiva } from '../src/modules/pausa-v4.js';
import { findStudentByEmail, updateStudentStreak, updateStudentUltimaPractica } from '../src/modules/student-v4.js';
import { computeProgress } from '../src/core/progress-engine.js';

// Cargar variables de entorno
dotenv.config();

const args = process.argv.slice(2);
const applyMode = args.includes('--apply');
const dryRun = !applyMode;

const auditRepo = getDefaultAuditRepo();

/**
 * PASO 1: Reconstruir pausas de suscripción
 */
async function reconstruirPausas() {
  console.log('\n📋 PASO 1: Reconstruyendo pausas de suscripción...\n');
  
  const pool = getPool();
  const stats = {
    total: 0,
    con_pausa_legacy: 0,
    pausas_creadas: 0,
    pausas_cerradas: 0,
    errores: 0
  };

  try {
    // Obtener todos los alumnos con estado de suscripción
    const alumnosResult = await pool.query(`
      SELECT id, email, estado_suscripcion, fecha_inscripcion
      FROM alumnos
      ORDER BY id
    `);

    stats.total = alumnosResult.rows.length;
    console.log(`   📊 Encontrados ${stats.total} alumnos\n`);

    for (const alumno of alumnosResult.rows) {
      try {
        // Verificar si tiene pausa activa
        const pausaActiva = await getPausaActiva(alumno.id);
        
        // Si estado_suscripcion es 'pausada' pero no hay pausa canónica
        if (alumno.estado_suscripcion === 'pausada' && !pausaActiva) {
          stats.con_pausa_legacy++;
          
          console.log(`   ⏸️  ${alumno.email}: Estado legacy 'pausada' sin pausa canónica`);
          
          if (applyMode) {
            // Crear pausa canónica desde fecha_inscripcion o ahora
            const fechaInicio = alumno.fecha_inscripcion 
              ? new Date(alumno.fecha_inscripcion)
              : new Date();
            
            await crearPausa({
              alumno_id: alumno.id,
              inicio: fechaInicio,
              fin: null // Pausa activa
            });
            
            stats.pausas_creadas++;
            
            // Registrar evento (fail-open: no bloquear si falla)
            try {
              await auditRepo.recordEvent({
                eventType: 'PAUSA_MIGRATED',
                actorType: 'system',
                actorId: 'reconstruir-estado-derivado',
                severity: 'info',
                data: {
                  alumno_id: alumno.id,
                  email: alumno.email,
                  fecha_inicio: fechaInicio.toISOString(),
                  origen: 'estado_legacy'
                }
              });
            } catch (err) {
              console.warn(`⚠️  No se pudo registrar evento PAUSA_MIGRATED para ${alumno.email} (no crítico):`, err.message);
            }
            
            console.log(`      ✅ Pausa canónica creada`);
          }
        }
        
        // Si estado_suscripcion es 'activa' pero hay pausa activa
        if (alumno.estado_suscripcion === 'activa' && pausaActiva) {
          console.log(`   ▶️  ${alumno.email}: Estado 'activa' con pausa activa (inconsistencia)`);
          
          if (applyMode) {
            await cerrarPausaActiva(alumno.id, new Date());
            stats.pausas_cerradas++;
            console.log(`      ✅ Pausa cerrada`);
          }
        }
        
      } catch (err) {
        stats.errores++;
        console.error(`   ❌ Error procesando ${alumno.email}:`, err.message);
      }
    }

    console.log(`\n   ✅ Paso 1 completado:`);
    console.log(`      - Total: ${stats.total}`);
    console.log(`      - Con pausa legacy: ${stats.con_pausa_legacy}`);
    if (applyMode) {
      console.log(`      - Pausas creadas: ${stats.pausas_creadas}`);
      console.log(`      - Pausas cerradas: ${stats.pausas_cerradas}`);
    }
    console.log(`      - Errores: ${stats.errores}\n`);

    return stats;

  } catch (error) {
    console.error('❌ Error en reconstruirPausas:', error);
    throw error;
  }
}

/**
 * PASO 2: Reconstruir racha diaria desde prácticas reales
 */
async function reconstruirRacha() {
  console.log('\n🔥 PASO 2: Reconstruyendo racha diaria desde prácticas reales...\n');
  
  const pool = getPool();
  const stats = {
    total: 0,
    con_practicas: 0,
    rachas_recalculadas: 0,
    errores: 0
  };

  try {
    // Obtener todos los alumnos
    const alumnosResult = await pool.query(`
      SELECT id, email, fecha_inscripcion
      FROM alumnos
      ORDER BY id
    `);

    stats.total = alumnosResult.rows.length;
    console.log(`   📊 Encontrados ${stats.total} alumnos\n`);

    for (const alumno of alumnosResult.rows) {
      try {
        // Obtener todas las prácticas ordenadas por fecha
        const practicasResult = await pool.query(`
          SELECT DISTINCT DATE(fecha) as fecha_practica
          FROM practicas
          WHERE alumno_id = $1
          ORDER BY fecha_practica DESC
        `, [alumno.id]);

        if (practicasResult.rows.length === 0) {
          // Sin prácticas, racha = 0
          if (applyMode) {
            await updateStudentStreak(alumno.email, 0);
          }
          continue;
        }

        stats.con_practicas++;

        // Calcular racha actual desde prácticas
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        
        let racha = 0;
        let ultimaPractica = null;
        let fechaEsperada = new Date(hoy);
        
        // Verificar si hay pausa activa
        const pausaActiva = await getPausaActiva(alumno.id);
        
        // Si hay pausa activa, la racha se congela (no se recalcula)
        if (pausaActiva) {
          // Obtener racha actual de la BD (se mantiene congelada)
          const alumnoActual = await pool.query('SELECT streak FROM alumnos WHERE id = $1', [alumno.id]);
          racha = alumnoActual.rows[0]?.streak || 0;
          console.log(`   ⏸️  ${alumno.email}: Pausa activa, racha congelada en ${racha}`);
          continue;
        }

        // Reconstruir racha desde prácticas
        for (let i = 0; i < practicasResult.rows.length; i++) {
          const practicaFecha = new Date(practicasResult.rows[i].fecha_practica);
          practicaFecha.setHours(0, 0, 0, 0);
          
          if (i === 0) {
            // Primera práctica (más reciente)
            ultimaPractica = practicaFecha;
            
            // Si es hoy o ayer, empezar racha
            const diffDias = Math.floor((hoy - practicaFecha) / (1000 * 60 * 60 * 24));
            
            if (diffDias === 0 || diffDias === 1) {
              racha = 1;
              fechaEsperada = new Date(practicaFecha);
              fechaEsperada.setDate(fechaEsperada.getDate() - 1);
            } else {
              // Racha rota
              break;
            }
          } else {
            // Verificar si la práctica anterior es consecutiva
            const fechaAnterior = new Date(practicasResult.rows[i - 1].fecha_practica);
            fechaAnterior.setHours(0, 0, 0, 0);
            
            const diffDias = Math.floor((fechaAnterior - practicaFecha) / (1000 * 60 * 60 * 24));
            
            if (diffDias === 1) {
              racha++;
              fechaEsperada = new Date(practicaFecha);
              fechaEsperada.setDate(fechaEsperada.getDate() - 1);
            } else {
              // Racha rota
              break;
            }
          }
        }

        // Actualizar racha y última práctica
        if (applyMode) {
          await updateStudentStreak(alumno.email, racha);
          if (ultimaPractica) {
            await updateStudentUltimaPractica(alumno.email, ultimaPractica);
          }
          
          stats.rachas_recalculadas++;
          
          // Registrar evento (fail-open: no bloquear si falla)
          try {
            await auditRepo.recordEvent({
              eventType: 'STREAK_REBUILT',
              actorType: 'system',
              actorId: 'reconstruir-estado-derivado',
              severity: 'info',
              data: {
                alumno_id: alumno.id,
                email: alumno.email,
                racha_calculada: racha,
                ultima_practica: ultimaPractica ? ultimaPractica.toISOString() : null
              }
            });
          } catch (err) {
            console.warn(`⚠️  No se pudo registrar evento STREAK_REBUILT para ${alumno.email} (no crítico):`, err.message);
          }
        }
        
        console.log(`   🔥 ${alumno.email}: Racha = ${racha} (última práctica: ${ultimaPractica ? ultimaPractica.toISOString().substring(0, 10) : 'N/A'})`);

      } catch (err) {
        stats.errores++;
        console.error(`   ❌ Error procesando ${alumno.email}:`, err.message);
      }
    }

    console.log(`\n   ✅ Paso 2 completado:`);
    console.log(`      - Total: ${stats.total}`);
    console.log(`      - Con prácticas: ${stats.con_practicas}`);
    if (applyMode) {
      console.log(`      - Rachas recalculadas: ${stats.rachas_recalculadas}`);
    }
    console.log(`      - Errores: ${stats.errores}\n`);

    return stats;

  } catch (error) {
    console.error('❌ Error en reconstruirRacha:', error);
    throw error;
  }
}

/**
 * PASO 3: Recalcular progreso completo (nivel + fase)
 */
async function recalcularProgreso() {
  console.log('\n📊 PASO 3: Recalculando progreso completo (nivel + fase)...\n');
  
  const pool = getPool();
  const stats = {
    total: 0,
    procesados: 0,
    con_diferencias: 0,
    actualizados: 0,
    errores: 0
  };

  try {
    // Obtener todos los alumnos
    const alumnosResult = await pool.query(`
      SELECT id, email, nivel_actual, nivel_manual, fecha_inscripcion
      FROM alumnos
      ORDER BY id
    `);

    stats.total = alumnosResult.rows.length;
    console.log(`   📊 Encontrados ${stats.total} alumnos\n`);

    for (const alumno of alumnosResult.rows) {
      try {
        // Obtener student completo
        const student = await findStudentByEmail(null, alumno.email);
        if (!student) {
          console.log(`   ⚠️  ${alumno.email}: No se encontró student completo, saltando...`);
          stats.errores++;
          continue;
        }

        // Calcular progreso usando motor único
        const progress = await computeProgress({
          student,
          now: new Date(),
          env: process.env
        });

        // Comparar con valores actuales
        const nivelActualDB = alumno.nivel_actual || 1;
        const nivelEfectivo = progress.nivel_efectivo;
        const nivelBase = progress.nivel_base;
        const tieneOverrides = progress.overrides_aplicados.length > 0;

        // Detectar diferencias
        const hayDiferencia = nivelEfectivo !== nivelActualDB;

        if (hayDiferencia || tieneOverrides) {
          stats.con_diferencias++;

          console.log(`   📊 ${alumno.email}:`);
          console.log(`      DB actual: nivel=${nivelActualDB}`);
          console.log(`      Calculado: nivel_base=${nivelBase}, nivel_efectivo=${nivelEfectivo}, fase=${progress.fase_efectiva.nombre}`);

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
              stats.actualizados++;
              console.log(`      ✅ Actualizado en DB`);
            }
          }
          console.log('');
        }

        stats.procesados++;

        // Log de progreso cada 50 alumnos
        if (stats.procesados % 50 === 0) {
          console.log(`   📊 Progreso: ${stats.procesados}/${stats.total} alumnos procesados\n`);
        }

      } catch (err) {
        stats.errores++;
        console.error(`   ❌ Error procesando ${alumno.email}:`, err.message);
      }
    }

    // Registrar evento de recálculo masivo (fail-open: no bloquear si falla)
    if (applyMode && stats.actualizados > 0) {
      try {
        await auditRepo.recordEvent({
          eventType: 'PROGRESO_RECALCULATED',
          actorType: 'system',
          actorId: 'reconstruir-estado-derivado',
          severity: 'info',
          data: {
            total_alumnos: stats.total,
            procesados: stats.procesados,
            con_diferencias: stats.con_diferencias,
            actualizados: stats.actualizados,
            errores: stats.errores
          }
        });
      } catch (err) {
        console.warn('⚠️  No se pudo registrar evento de auditoría (no crítico):', err.message);
      }
    }

    console.log(`\n   ✅ Paso 3 completado:`);
    console.log(`      - Total: ${stats.total}`);
    console.log(`      - Procesados: ${stats.procesados}`);
    console.log(`      - Con diferencias: ${stats.con_diferencias}`);
    if (applyMode) {
      console.log(`      - Actualizados: ${stats.actualizados}`);
    } else {
      console.log(`      - Modo: DRY-RUN (usar --apply para aplicar cambios)`);
    }
    console.log(`      - Errores: ${stats.errores}\n`);

    return stats;

  } catch (error) {
    console.error('❌ Error en recalcularProgreso:', error);
    throw error;
  }
}

/**
 * Función principal
 */
async function main() {
  const horaInicio = new Date().toISOString();
  
  console.log(`\n🔄 [${horaInicio}] Iniciando reconstrucción de estado derivado...`);
  console.log(`   Modo: ${applyMode ? 'APLICAR CAMBIOS' : 'DRY-RUN (solo mostrar diferencias)'}\n`);

  try {
    // Inicializar PostgreSQL
    await initPostgreSQL();

    // Ejecutar pasos
    const statsPausas = await reconstruirPausas();
    const statsRacha = await reconstruirRacha();
    const statsProgreso = await recalcularProgreso();

    // Resumen final
    const horaFin = new Date().toISOString();
    console.log(`\n✅ [${horaFin}] Reconstrucción completada:`);
    console.log(`\n   📋 PASO 1 - Pausas:`);
    console.log(`      - Total: ${statsPausas.total}`);
    console.log(`      - Con pausa legacy: ${statsPausas.con_pausa_legacy}`);
    if (applyMode) {
      console.log(`      - Pausas creadas: ${statsPausas.pausas_creadas}`);
      console.log(`      - Pausas cerradas: ${statsPausas.pausas_cerradas}`);
    }
    console.log(`      - Errores: ${statsPausas.errores}`);
    
    console.log(`\n   🔥 PASO 2 - Racha:`);
    console.log(`      - Total: ${statsRacha.total}`);
    console.log(`      - Con prácticas: ${statsRacha.con_practicas}`);
    if (applyMode) {
      console.log(`      - Rachas recalculadas: ${statsRacha.rachas_recalculadas}`);
    }
    console.log(`      - Errores: ${statsRacha.errores}`);
    
    console.log(`\n   📊 PASO 3 - Progreso:`);
    console.log(`      - Total: ${statsProgreso.total}`);
    console.log(`      - Procesados: ${statsProgreso.procesados}`);
    console.log(`      - Con diferencias: ${statsProgreso.con_diferencias}`);
    if (applyMode) {
      console.log(`      - Actualizados: ${statsProgreso.actualizados}`);
    }
    console.log(`      - Errores: ${statsProgreso.errores}\n`);

    if (!applyMode) {
      console.log(`\n⚠️  MODO DRY-RUN: No se aplicaron cambios.`);
      console.log(`   Ejecuta con --apply para aplicar los cambios.\n`);
    } else {
      console.log(`\n✅ Cambios aplicados correctamente.\n`);
    }

    process.exit(0);

  } catch (error) {
    console.error(`\n❌ [${new Date().toISOString()}] Error en reconstrucción:`, error);
    console.error(`   Stack:`, error.stack);
    process.exit(1);
  }
}

// Ejecutar
main().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});

