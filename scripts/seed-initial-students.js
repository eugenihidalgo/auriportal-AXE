#!/usr/bin/env node
/**
 * SEED INITIAL STUDENTS v1 - AuriPortal
 * 
 * Script idempotente para crear/asegurar los 2 students iniciales del mundo nuevo UUID-only.
 * 
 * OBJETIVO:
 * - Crear 2 students nuevos canónicos (Eugeni y Carla)
 * - Idempotente: si ya existen, no los crea de nuevo
 * - Dry-run por defecto, --apply para ejecutar
 * 
 * USO:
 *   node scripts/seed-initial-students.js          # Dry-run (solo muestra lo que haría)
 *   node scripts/seed-initial-students.js --apply  # Ejecuta la creación
 */

import { query } from '../database/pg.js';
import { getRequestId } from '../src/core/observability/request-context.js';
import { logInfo, logWarn, logError } from '../src/core/observability/logger.js';

const INITIAL_STUDENTS = [
  {
    email: 'bennascut@eugenihidalgo.org',
    apodo: 'Eugeni'
  },
  {
    email: 'carlaviveslleixa@gmail.com',
    apodo: 'Carla'
  }
];

/**
 * Verifica si un student existe por email
 */
async function studentExists(email) {
  try {
    const result = await query(
      'SELECT id, email, apodo FROM students WHERE LOWER(email) = LOWER($1) AND deleted_at IS NULL',
      [email]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error(`[SEED] Error verificando student: ${email}`, error.message);
    throw error;
  }
}

/**
 * Crea un student
 */
async function createStudent(email, apodo) {
  try {
    const result = await query(`
      INSERT INTO students (email, apodo, status, created_at, updated_at)
      VALUES (LOWER(TRIM($1)), $2, 'NORMAL', now(), now())
      RETURNING id, email, apodo
    `, [email, apodo]);
    
    return result.rows[0];
  } catch (error) {
    // Si es error de unicidad, el student ya existe (idempotencia)
    if (error.code === '23505') {
      const existing = await studentExists(email);
      return existing;
    }
    throw error;
  }
}

/**
 * Ejecuta el seed (dry-run o apply)
 */
async function runSeed(apply = false) {
  const traceId = getRequestId() || `seed-${Date.now()}`;
  
  console.log(`[SEED] ════════════════════════════════════════`);
  console.log(`[SEED] Seed Initial Students v1`);
  console.log(`[SEED] Modo: ${apply ? 'APPLY' : 'DRY-RUN'}`);
  console.log(`[SEED] Trace ID: ${traceId}`);
  console.log(`[SEED] ════════════════════════════════════════\n`);
  
  const results = [];
  
  for (const studentData of INITIAL_STUDENTS) {
    const { email, apodo } = studentData;
    
    console.log(`[SEED] Verificando: ${email} (${apodo})`);
    
    try {
      const existing = await studentExists(email);
      
      if (existing) {
        console.log(`[SEED] ✅ Ya existe: ${email} (ID: ${existing.id}, apodo: ${existing.apodo || 'N/A'})`);
        results.push({
          email,
          apodo,
          status: 'exists',
          student_id: existing.id
        });
      } else {
        if (apply) {
          console.log(`[SEED] 📝 Creando: ${email} (${apodo})`);
          const created = await createStudent(email, apodo);
          console.log(`[SEED] ✅ Creado: ${email} (ID: ${created.id})`);
          results.push({
            email,
            apodo,
            status: 'created',
            student_id: created.id
          });
        } else {
          console.log(`[SEED] 📝 [DRY-RUN] Crearía: ${email} (${apodo})`);
          results.push({
            email,
            apodo,
            status: 'would_create'
          });
        }
      }
    } catch (error) {
      console.error(`[SEED] ❌ Error procesando ${email}:`, error.message);
      results.push({
        email,
        apodo,
        status: 'error',
        error: error.message
      });
    }
    
    console.log('');
  }
  
  console.log(`[SEED] ════════════════════════════════════════`);
  console.log(`[SEED] Resumen:`);
  console.log(`[SEED] - Total: ${results.length}`);
  console.log(`[SEED] - Existentes: ${results.filter(r => r.status === 'exists').length}`);
  console.log(`[SEED] - ${apply ? 'Creados' : 'A crear'}: ${results.filter(r => r.status === (apply ? 'created' : 'would_create')).length}`);
  console.log(`[SEED] - Errores: ${results.filter(r => r.status === 'error').length}`);
  console.log(`[SEED] ════════════════════════════════════════\n`);
  
  if (!apply) {
    console.log(`[SEED] 💡 Ejecuta con --apply para crear los students\n`);
  }
  
  return results;
}

// Ejecutar
const apply = process.argv.includes('--apply');
runSeed(apply)
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('[SEED] ❌ Error fatal:', error.message);
    console.error(error.stack);
    process.exit(1);
  });
