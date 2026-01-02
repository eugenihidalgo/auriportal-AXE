// src/infra/repos/master-student-transmutation-read-repo-pg.js
// Repositorio MASTER para lectura/escritura básica de estado de alumnos en transmutaciones
//
// REGLAS CONSTITUCIONALES:
// - MASTER NO puede depender de dominios STUDENT
// - MASTER NO calcula estados temporales (clean/pending/critical)
// - MASTER solo lee/escribe datos raw de student_item_state
// - El cálculo de estados temporales pertenece a STUDENT/RUNTIME
//
// Este repo es específico para operaciones MASTER:
// - Lectura básica de datos de alumnos y su estado
// - Escritura de limpiezas (last_cleaned_at)
// - Incremento de contadores
// - Ajuste de remaining
//
// NO incluye:
// - Cálculo de estados temporales
// - Lógica de dominio STUDENT
// - Dependencias de resolve-temporal-state.js

import { query } from '../../../database/pg.js';

// Singleton para evitar múltiples instancias
let defaultRepo = null;

/**
 * Repositorio MASTER para lectura/escritura básica de estado de alumnos
 * 
 * Este repositorio NO calcula estados temporales.
 * Solo lee/escribe datos raw de student_item_state.
 */
export class MasterStudentTransmutationReadRepoPg {
  /**
   * Obtiene datos básicos de alumnos para un item (SIN cálculo de estados temporales)
   * Retorna datos raw de student_item_state
   */
  async getStudentsForItemRaw(itemRef, tipo, productKey = 'pde', options = {}, client = null) {
    if (!itemRef || !tipo) {
      return { students: [], counts: {}, total: 0 };
    }

    const { limit, offset = 0 } = options;
    const queryFn = client ? client.query.bind(client) : query;

    // Obtener TODOS los alumnos activos, con su estado si existe
    // LEFT JOIN para incluir alumnos sin estado aún
    let sql = `
      SELECT 
        a.id as student_id,
        COALESCE(a.nombre_completo, a.apodo, a.email) as student_name,
        a.email as student_email,
        s.last_cleaned_at,
        s.clean_count,
        s.recommended_recurrence_days,
        s.student_recurrence_days,
        s.per_item_config->>'recurrence_days' as per_item_recurrence_days,
        s.remaining,
        s.completed,
        s.counters
      FROM alumnos a
      LEFT JOIN student_item_state s ON s.student_id = a.id
        AND s.product_key = $1
        AND s.domain_type = 'transmutation'
        AND s.item_ref = $2
        AND s.status = 'active'
      WHERE a.status = 'active'
      ORDER BY a.nombre_completo ASC, a.email ASC
    `;

    const params = [productKey, itemRef];

    if (limit) {
      sql += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);
    }

    const result = await queryFn(sql, params);

    const students = [];
    const counts = tipo === 'recurrente' 
      ? { clean: 0, pending: 0, critical: 0 } // Placeholder, no se calculan aquí
      : { incomplete: 0, complete: 0 };

    for (const row of result.rows) {
      if (tipo === 'recurrente') {
        // Retornar datos raw sin calcular estado temporal
        // El frontend o STUDENT calculará el estado si es necesario
        const daysSinceLastClean = row.last_cleaned_at 
          ? Math.floor((new Date().getTime() - new Date(row.last_cleaned_at).getTime()) / (1000 * 60 * 60 * 24))
          : null;

        students.push({
          student_id: row.student_id,
          student_name: row.student_name || row.student_email || 'Sin nombre',
          student_email: row.student_email,
          days_since_last_clean: daysSinceLastClean,
          last_cleaned_at: row.last_cleaned_at,
          clean_count: row.clean_count || 0,
          // NO calcular temporal_state aquí (pertenece a STUDENT)
          // temporal_state: 'clean' | 'pending' | 'critical'
        });
      } else {
        // una_vez
        const remaining = row.remaining !== null ? parseInt(row.remaining, 10) : null;
        const completed = row.completed !== null ? parseInt(row.completed, 10) : 0;
        const isComplete = remaining !== null && remaining <= 0;

        if (isComplete) {
          counts.complete++;
        } else {
          counts.incomplete++;
        }

        students.push({
          student_id: row.student_id,
          student_name: row.student_name || row.student_email || 'Sin nombre',
          student_email: row.student_email,
          remaining,
          completed,
          is_complete: isComplete
        });
      }
    }

    // Obtener total (sin limit/offset)
    const totalResult = await queryFn(
      'SELECT COUNT(*) as total FROM alumnos WHERE status = \'active\'',
      []
    );
    const total = parseInt(totalResult.rows[0]?.total || '0', 10);

    return { students, counts, total };
  }

  /**
   * Marca limpio un alumno específico (recurrente)
   */
  async markCleanStudent(studentId, itemRef, productKey = 'pde', client = null) {
    if (!studentId || !itemRef) return null;

    const queryFn = client ? client.query.bind(client) : query;

    // Obtener item para conocer frecuencia_dias
    const itemResult = await queryFn(
      'SELECT frecuencia_dias FROM items_transmutaciones WHERE item_ref = $1',
      [itemRef]
    );

    if (itemResult.rows.length === 0) {
      return null;
    }

    const frecuenciaDias = itemResult.rows[0].frecuencia_dias || 30;

    // UPSERT en student_item_state
    const result = await queryFn(
      `INSERT INTO student_item_state 
       (student_id, product_key, domain_type, item_ref, last_cleaned_at, clean_count, recommended_recurrence_days, status)
       VALUES ($1, $2, 'transmutation', $3, NOW(), COALESCE(
         (SELECT clean_count FROM student_item_state 
          WHERE student_id = $1 AND product_key = $2 AND domain_type = 'transmutation' AND item_ref = $3), 0
       ) + 1, $4, 'active')
       ON CONFLICT (student_id, product_key, domain_type, item_ref)
       DO UPDATE SET
         last_cleaned_at = NOW(),
         clean_count = student_item_state.clean_count + 1,
         recommended_recurrence_days = $4,
         updated_at = NOW()
       RETURNING *`,
      [studentId, productKey, itemRef, frecuenciaDias]
    );

    return result.rows[0] || null;
  }

  /**
   * Marca limpio todos los alumnos (recurrente)
   */
  async markCleanAll(itemRef, productKey = 'pde', client = null) {
    if (!itemRef) return { updated: 0 };

    const queryFn = client ? client.query.bind(client) : query;

    // Obtener item para conocer frecuencia_dias
    const itemResult = await queryFn(
      'SELECT frecuencia_dias FROM items_transmutaciones WHERE item_ref = $1',
      [itemRef]
    );

    if (itemResult.rows.length === 0) {
      return { updated: 0 };
    }

    const frecuenciaDias = itemResult.rows[0].frecuencia_dias || 30;

    // Obtener todos los alumnos activos
    const alumnosResult = await queryFn(
      'SELECT id FROM alumnos WHERE status = \'active\'',
      []
    );

    let updated = 0;

    // UPSERT para cada alumno
    for (const alumno of alumnosResult.rows) {
      const result = await queryFn(
        `INSERT INTO student_item_state 
         (student_id, product_key, domain_type, item_ref, last_cleaned_at, clean_count, recommended_recurrence_days, status)
         VALUES ($1, $2, 'transmutation', $3, NOW(), COALESCE(
           (SELECT clean_count FROM student_item_state 
            WHERE student_id = $1 AND product_key = $2 AND domain_type = 'transmutation' AND item_ref = $3), 0
         ) + 1, $4, 'active')
         ON CONFLICT (student_id, product_key, domain_type, item_ref)
         DO UPDATE SET
           last_cleaned_at = NOW(),
           clean_count = student_item_state.clean_count + 1,
           recommended_recurrence_days = $4,
           updated_at = NOW()
         RETURNING *`,
        [alumno.id, productKey, itemRef, frecuenciaDias]
      );

      if (result.rows.length > 0) {
        updated++;
      }
    }

    return { updated };
  }

  /**
   * Incrementa +1 todos los alumnos (una_vez)
   */
  async incrementAll(itemRef, productKey = 'pde', client = null) {
    if (!itemRef) return { updated: 0 };

    const queryFn = client ? client.query.bind(client) : query;

    // Obtener todos los alumnos activos
    const alumnosResult = await queryFn(
      'SELECT id FROM alumnos WHERE status = \'active\'',
      []
    );

    let updated = 0;

    // UPSERT para cada alumno: decrementar remaining, incrementar completed
    for (const alumno of alumnosResult.rows) {
      const result = await queryFn(
        `INSERT INTO student_item_state 
         (student_id, product_key, domain_type, item_ref, remaining, completed, status)
         VALUES ($1, $2, 'transmutation', $3, 
           GREATEST(0, COALESCE(
             (SELECT remaining FROM student_item_state 
              WHERE student_id = $1 AND product_key = $2 AND domain_type = 'transmutation' AND item_ref = $3), 0
           ) - 1),
           COALESCE(
             (SELECT completed FROM student_item_state 
              WHERE student_id = $1 AND product_key = $2 AND domain_type = 'transmutation' AND item_ref = $3), 0
           ) + 1,
           'active')
         ON CONFLICT (student_id, product_key, domain_type, item_ref)
         DO UPDATE SET
           remaining = GREATEST(0, student_item_state.remaining - 1),
           completed = student_item_state.completed + 1,
           updated_at = NOW()
         RETURNING *`,
        [alumno.id, productKey, itemRef]
      );

      if (result.rows.length > 0) {
        updated++;
      }
    }

    return { updated };
  }

  /**
   * Ajusta remaining manualmente para un alumno (una_vez)
   */
  async adjustRemaining(studentId, itemRef, remaining, productKey = 'pde', client = null) {
    if (!studentId || !itemRef || remaining === undefined) return null;

    const queryFn = client ? client.query.bind(client) : query;

    // UPSERT en student_item_state
    const result = await queryFn(
      `INSERT INTO student_item_state 
       (student_id, product_key, domain_type, item_ref, remaining, status)
       VALUES ($1, $2, 'transmutation', $3, $4, 'active')
       ON CONFLICT (student_id, product_key, domain_type, item_ref)
       DO UPDATE SET
         remaining = $4,
         updated_at = NOW()
       RETURNING *`,
      [studentId, productKey, itemRef, remaining]
    );

    return result.rows[0] || null;
  }
}

/**
 * Obtiene una instancia singleton del repositorio
 * 
 * @returns {MasterStudentTransmutationReadRepoPg} Instancia del repositorio
 */
export function getDefaultMasterStudentTransmutationReadRepo() {
  if (!defaultRepo) {
    defaultRepo = new MasterStudentTransmutationReadRepoPg();
  }
  return defaultRepo;
}
