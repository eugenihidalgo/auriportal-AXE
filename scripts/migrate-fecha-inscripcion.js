// scripts/migrate-fecha-inscripcion.js
// Script de migración de fecha_inscripcion canónica
//
// OBJETIVO:
// - Recorrer todos los alumnos
// - Detectar fecha legacy válida (created_at, fecha_alta, etc.)
// - Asignarla a fecha_inscripcion canónica si está vacía
// - NO sobrescribir fechas ya válidas
// - Soportar --dry-run y --apply
// - Log claro por alumno
//
// PRINCIPIOS:
// - fecha_inscripcion es el campo canónico
// - Si ya tiene fecha_inscripcion válida, NO se toca
// - Si no tiene, se busca en created_at como fallback
// - Todo auditable y reversible

import dotenv from 'dotenv';
dotenv.config();

import { getPool, initPostgreSQL } from '../database/pg.js';
import getDefaultAuditRepo from '../src/infra/repos/audit-repo-pg.js';

// Parsear argumentos de línea de comandos
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isApply = args.includes('--apply');

if (!isDryRun && !isApply) {
  console.error('❌ Error: Debes especificar --dry-run o --apply');
  console.error('   Uso: node scripts/migrate-fecha-inscripcion.js --dry-run');
  console.error('   Uso: node scripts/migrate-fecha-inscripcion.js --apply');
  process.exit(1);
}

/**
 * Obtiene todos los alumnos de PostgreSQL
 */
async function getAllAlumnos() {
  const pool = getPool();
  const result = await pool.query(`
    SELECT id, email, apodo, fecha_inscripcion, created_at
    FROM alumnos
    ORDER BY id
  `);
  return result.rows;
}

/**
 * Registra evento de auditoría
 */
async function registrarAuditoria(alumnoId, email, accion, datos) {
  try {
    const auditRepo = getDefaultAuditRepo();
    await auditRepo.logEvent({
      event_type: 'FECHA_INSCRIPCION_MIGRATED',
      actor_type: 'system',
      actor_id: 'migration-script',
      metadata: {
        alumno_id: alumnoId,
        email: email,
        accion: accion,
        ...datos
      }
    });
  } catch (err) {
    console.warn(`⚠️  No se pudo registrar auditoría para ${email}:`, err.message);
  }
}

/**
 * Procesa un alumno individual
 */
async function procesarAlumno(alumno) {
  const resultado = {
    alumno_id: alumno.id,
    email: alumno.email,
    apodo: alumno.apodo || null,
    exito: false,
    accion: null,
    fecha_anterior: null,
    fecha_nueva: null,
    error: null
  };

  try {
    // Verificar si fecha_inscripcion ya tiene valor válido
    const fechaInscripcionActual = alumno.fecha_inscripcion 
      ? new Date(alumno.fecha_inscripcion)
      : null;

    if (fechaInscripcionActual && !isNaN(fechaInscripcionActual.getTime())) {
      // Ya tiene fecha válida, no hacer nada
      resultado.exito = true;
      resultado.accion = 'sin_cambios';
      resultado.fecha_anterior = fechaInscripcionActual.toISOString();
      resultado.fecha_nueva = fechaInscripcionActual.toISOString();
      return resultado;
    }

    // Buscar fecha legacy en created_at
    const fechaCreatedAt = alumno.created_at 
      ? new Date(alumno.created_at)
      : null;

    if (!fechaCreatedAt || isNaN(fechaCreatedAt.getTime())) {
      // No hay fecha legacy disponible
      resultado.exito = false;
      resultado.accion = 'sin_fecha_disponible';
      resultado.error = 'No hay fecha_inscripcion ni created_at válida';
      return resultado;
    }

    // Usar created_at como fecha_inscripcion
    resultado.fecha_anterior = fechaInscripcionActual 
      ? fechaInscripcionActual.toISOString() 
      : null;
    resultado.fecha_nueva = fechaCreatedAt.toISOString();
    resultado.accion = 'migrado_desde_created_at';

    // Aplicar cambio si no es dry-run
    if (isApply) {
      const pool = getPool();
      await pool.query(
        'UPDATE alumnos SET fecha_inscripcion = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [fechaCreatedAt, alumno.id]
      );

      // Registrar auditoría
      await registrarAuditoria(alumno.id, alumno.email, 'migrado', {
        fecha_anterior: resultado.fecha_anterior,
        fecha_nueva: resultado.fecha_nueva,
        fuente: 'created_at'
      });
    }

    resultado.exito = true;
    return resultado;

  } catch (error) {
    resultado.exito = false;
    resultado.error = error.message;
    return resultado;
  }
}

/**
 * Función principal
 */
async function migrateFechaInscripcion() {
  const horaInicio = new Date().toISOString();
  
  console.log(`\n🔄 [${horaInicio}] Iniciando migración de fecha_inscripcion...`);
  console.log(`   Modo: ${isDryRun ? 'DRY-RUN (solo mostrar cambios)' : 'APLICAR CAMBIOS'}\n`);

  try {
    // Inicializar PostgreSQL
    await initPostgreSQL();

    // Obtener todos los alumnos
    const alumnos = await getAllAlumnos();
    console.log(`📊 Encontrados ${alumnos.length} alumnos\n`);

    const estadisticas = {
      total: alumnos.length,
      procesados: 0,
      sin_cambios: 0,
      migrados: 0,
      errores: 0,
      sin_fecha: 0
    };

    // Procesar cada alumno
    for (let i = 0; i < alumnos.length; i++) {
      const alumno = alumnos[i];
      const resultado = await procesarAlumno(alumno);

      estadisticas.procesados++;

      // Mostrar resultado según tipo
      if (resultado.accion === 'sin_cambios') {
        estadisticas.sin_cambios++;
        // No mostrar en consola para no saturar
      } else if (resultado.accion === 'migrado_desde_created_at') {
        estadisticas.migrados++;
        const icono = isDryRun ? '🔍' : '✅';
        console.log(`   ${icono} ${alumno.email}${alumno.apodo ? ` (${alumno.apodo})` : ''}:`);
        console.log(`      ${isDryRun ? 'Se migraría' : 'Migrado'} desde created_at`);
        console.log(`      Fecha: ${resultado.fecha_nueva}`);
        if (isDryRun) {
          console.log(`      [DRY-RUN] No se aplicó el cambio`);
        }
        console.log('');
      } else if (resultado.accion === 'sin_fecha_disponible') {
        estadisticas.sin_fecha++;
        console.log(`   ⚠️  ${alumno.email}${alumno.apodo ? ` (${alumno.apodo})` : ''}: Sin fecha disponible`);
        console.log('');
      } else if (!resultado.exito) {
        estadisticas.errores++;
        console.error(`   ❌ ${alumno.email}${alumno.apodo ? ` (${alumno.apodo})` : ''}: ${resultado.error}`);
        console.log('');
      }

      // Log de progreso cada 50 alumnos
      if ((i + 1) % 50 === 0) {
        console.log(`   📊 Progreso: ${i + 1}/${alumnos.length} alumnos procesados\n`);
      }
    }

    // Resumen final
    const horaFin = new Date().toISOString();
    console.log(`\n✅ [${horaFin}] Migración completada:`);
    console.log(`   - Total: ${estadisticas.total}`);
    console.log(`   - Procesados: ${estadisticas.procesados}`);
    console.log(`   - Sin cambios (ya tenían fecha): ${estadisticas.sin_cambios}`);
    console.log(`   - Migrados: ${estadisticas.migrados}`);
    console.log(`   - Sin fecha disponible: ${estadisticas.sin_fecha}`);
    console.log(`   - Errores: ${estadisticas.errores}`);
    if (isDryRun) {
      console.log(`\n   💡 Usa --apply para aplicar los cambios mostrados\n`);
    } else {
      console.log(`\n   ✅ Cambios aplicados correctamente\n`);
    }

    process.exit(0);

  } catch (error) {
    console.error(`\n❌ [${new Date().toISOString()}] Error en migración:`, error);
    console.error(`   Stack:`, error.stack);
    process.exit(1);
  }
}

// Ejecutar
migrateFechaInscripcion().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});












