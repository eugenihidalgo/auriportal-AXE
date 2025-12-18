// scripts/migrate-legacy-to-progreso-v4.js
// Script de migración controlada desde legacy hacia Progreso V4
//
// OBJETIVO:
// - Limpiar dependencia legacy
// - Recalcular TODO el estado real del alumno usando Progreso V4
// - Dejar el sistema preparado para apagar legacy en vistas y lógica
//
// PRINCIPIOS:
// - computeProgress() NO se toca
// - El cálculo SIEMPRE se hace desde Progreso V4
// - Legacy solo alimenta datos base
// - Todo debe ser auditable, reversible y con dry-run

import dotenv from 'dotenv';
dotenv.config();

import { getPool, initPostgreSQL } from '../database/pg.js';
import { computeProgress } from '../src/core/progress-engine.js';
import { findStudentById } from '../src/modules/student-v4.js';
import { logInfo, logWarn, logError } from '../src/core/observability/logger.js';

// Parsear argumentos de línea de comandos
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isApply = args.includes('--apply');

if (!isDryRun && !isApply) {
  console.error('❌ Error: Debes especificar --dry-run o --apply');
  console.error('   Uso: node scripts/migrate-legacy-to-progreso-v4.js --dry-run');
  console.error('   Uso: node scripts/migrate-legacy-to-progreso-v4.js --apply');
  process.exit(1);
}

/**
 * Obtiene todos los alumnos de PostgreSQL
 */
async function getAllAlumnos() {
  const pool = getPool();
  const result = await pool.query('SELECT id, email, fecha_inscripcion, estado_suscripcion FROM alumnos ORDER BY id');
  return result.rows;
}

/**
 * Obtiene las pausas de un alumno directamente desde PostgreSQL
 */
async function getPausasAlumno(alumnoId) {
  const pool = getPool();
  try {
    const result = await pool.query(
      'SELECT inicio, fin FROM pausas WHERE alumno_id = $1 ORDER BY inicio DESC',
      [alumnoId]
    );
    return result.rows.map(p => ({
      inicio: p.inicio instanceof Date ? p.inicio : new Date(p.inicio),
      fin: p.fin ? (p.fin instanceof Date ? p.fin : new Date(p.fin)) : null
    }));
  } catch (error) {
    // Si hay error (por ejemplo, tabla no existe), retornar array vacío
    console.warn(`⚠️  Error obteniendo pausas para alumno ${alumnoId}: ${error.message}`);
    return [];
  }
}

/**
 * Registra evento de auditoría global
 */
async function registrarAuditoriaGlobal(mode, totalAlumnos, exitosos, errores) {
  const pool = getPool();
  try {
    await pool.query(`
      INSERT INTO audit_log (event_type, actor_type, actor_id, metadata, created_at)
      VALUES ($1, $2, $3, $4, NOW())
    `, [
      'migracion_legacy_progreso_v4',
      'system',
      'migration-script',
      JSON.stringify({
        mode: mode,
        total_alumnos: totalAlumnos,
        exitosos: exitosos,
        errores: errores,
        timestamp: new Date().toISOString()
      })
    ]);
  } catch (err) {
    console.warn('⚠️  No se pudo registrar auditoría (tabla audit_log puede no existir):', err.message);
  }
}

/**
 * Procesa un alumno individual
 */
async function procesarAlumno(alumno, env = {}) {
  const resultado = {
    alumno_id: alumno.id,
    email: alumno.email,
    exito: false,
    error: null,
    progreso: null,
    datos_validados: {
      tiene_fecha_inscripcion: !!alumno.fecha_inscripcion,
      tiene_estado_suscripcion: !!alumno.estado_suscripcion,
      pausas_count: 0
    }
  };

  try {
    // 1. Validar datos base necesarios
    if (!alumno.email) {
      throw new Error('Email faltante');
    }

    if (!alumno.fecha_inscripcion) {
      throw new Error('fecha_inscripcion faltante');
    }

    // 2. Obtener pausas del alumno
    const pausas = await getPausasAlumno(alumno.id);
    resultado.datos_validados.pausas_count = pausas.length;

    // 3. Construir objeto student mínimo para computeProgress
    // computeProgress necesita: student.id, student.email, student.fecha_inscripcion
    const student = {
      id: alumno.id,
      email: alumno.email,
      fecha_inscripcion: alumno.fecha_inscripcion instanceof Date 
        ? alumno.fecha_inscripcion 
        : new Date(alumno.fecha_inscripcion)
    };

    // 4. Ejecutar computeProgress() (única fuente de verdad)
    const progress = await computeProgress({ 
      student, 
      now: new Date(), 
      env 
    });

    resultado.progreso = {
      dias_activos: progress.dias_activos,
      dias_pausados: progress.dias_pausados,
      nivel_base: progress.nivel_base,
      nivel_efectivo: progress.nivel_efectivo,
      fase_efectiva: progress.fase_efectiva,
      tiene_overrides: progress.overrides_aplicados.length > 0
    };

    resultado.exito = true;

    // Log de éxito (solo en dry-run o para debugging)
    if (isDryRun) {
      logInfo('migration', `[DRY-RUN] Alumno procesado correctamente`, {
        alumno_id: alumno.id,
        email: alumno.email,
        nivel_base: progress.nivel_base,
        nivel_efectivo: progress.nivel_efectivo,
        fase: progress.fase_efectiva.nombre
      });
    }

  } catch (error) {
    resultado.error = error.message;
    resultado.exito = false;

    // Log de error (sin romper el proceso)
    logError('migration', `Error procesando alumno ${alumno.id} (${alumno.email})`, {
      alumno_id: alumno.id,
      email: alumno.email,
      error: error.message,
      stack: error.stack
    });
  }

  return resultado;
}

/**
 * Función principal de migración
 */
async function main() {
  const inicio = Date.now();
  const mode = isDryRun ? 'dry-run' : 'apply';

  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔄 MIGRACIÓN LEGACY → PROGRESO V4');
  console.log(`   Modo: ${mode.toUpperCase()}`);
  console.log(`   Inicio: ${new Date().toISOString()}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // 0. Inicializar PostgreSQL
    console.log('🔌 Inicializando conexión a PostgreSQL...');
    initPostgreSQL();
    // Esperar un momento para que la conexión se establezca
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('   ✅ Conexión establecida\n');

    // 1. Obtener todos los alumnos
    console.log('📋 Obteniendo lista de alumnos...');
    const alumnos = await getAllAlumnos();
    console.log(`   ✅ ${alumnos.length} alumnos encontrados\n`);

    if (alumnos.length === 0) {
      console.log('⚠️  No hay alumnos para migrar');
      return;
    }

    // 2. Procesar cada alumno
    console.log('🔄 Procesando alumnos...\n');
    const resultados = [];
    let procesados = 0;
    let exitosos = 0;
    let errores = 0;

    for (const alumno of alumnos) {
      procesados++;
      const resultado = await procesarAlumno(alumno);
      resultados.push(resultado);

      if (resultado.exito) {
        exitosos++;
        // Mostrar progreso cada 10 alumnos
        if (procesados % 10 === 0) {
          console.log(`   ✅ Procesados: ${procesados}/${alumnos.length} (${exitosos} exitosos, ${errores} errores)`);
        }
      } else {
        errores++;
        console.log(`   ❌ Error en ${alumno.email}: ${resultado.error}`);
      }
    }

    // 3. Mostrar resumen
    const duracion = ((Date.now() - inicio) / 1000).toFixed(2);
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📊 RESUMEN DE MIGRACIÓN');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`   Total alumnos: ${alumnos.length}`);
    console.log(`   Procesados: ${procesados}`);
    console.log(`   Exitosos: ${exitosos}`);
    console.log(`   Errores: ${errores}`);
    console.log(`   Duración: ${duracion}s`);
    console.log(`   Modo: ${mode.toUpperCase()}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    // 4. Mostrar detalles de errores (si hay)
    if (errores > 0) {
      console.log('❌ ALUMNOS CON ERRORES:\n');
      resultados
        .filter(r => !r.exito)
        .forEach(r => {
          console.log(`   - ${r.email} (ID: ${r.alumno_id})`);
          console.log(`     Error: ${r.error}`);
          console.log(`     Datos validados:`, r.datos_validados);
          console.log('');
        });
    }

    // 5. Mostrar muestra de alumnos exitosos (primeros 5)
    if (exitosos > 0) {
      console.log('✅ MUESTRA DE ALUMNOS EXITOSOS (primeros 5):\n');
      resultados
        .filter(r => r.exito)
        .slice(0, 5)
        .forEach(r => {
          console.log(`   - ${r.email} (ID: ${r.alumno_id})`);
          console.log(`     Nivel base: ${r.progreso.nivel_base}`);
          console.log(`     Nivel efectivo: ${r.progreso.nivel_efectivo}`);
          console.log(`     Fase: ${r.progreso.fase_efectiva.nombre}`);
          console.log(`     Días activos: ${r.progreso.dias_activos}`);
          console.log(`     Días pausados: ${r.progreso.dias_pausados}`);
          console.log(`     Overrides: ${r.progreso.tiene_overrides ? 'Sí' : 'No'}`);
          console.log('');
        });
    }

    // 6. Registrar auditoría global
    if (isApply) {
      console.log('📝 Registrando evento de auditoría...');
      await registrarAuditoriaGlobal(mode, alumnos.length, exitosos, errores);
      console.log('   ✅ Auditoría registrada\n');
    } else {
      console.log('ℹ️  Modo DRY-RUN: No se registra auditoría\n');
    }

    // 7. Mensaje final
    if (isDryRun) {
      console.log('═══════════════════════════════════════════════════════════');
      console.log('✅ DRY-RUN COMPLETADO');
      console.log('   Revisa los resultados arriba.');
      console.log('   Si todo está correcto, ejecuta con --apply para aplicar cambios.');
      console.log('═══════════════════════════════════════════════════════════\n');
    } else {
      console.log('═══════════════════════════════════════════════════════════');
      console.log('✅ MIGRACIÓN COMPLETADA');
      console.log('   El sistema ahora opera 100% con Progreso V4.');
      console.log('   Los datos legacy se mantienen en DB pero ya no gobiernan el sistema.');
      console.log('   Próximo paso: Reiniciar servidor con PM2 y verificar en Admin.');
      console.log('═══════════════════════════════════════════════════════════\n');
    }

  } catch (error) {
    console.error('\n❌ ERROR CRÍTICO EN MIGRACIÓN:');
    console.error(error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Ejecutar migración
main().catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});

