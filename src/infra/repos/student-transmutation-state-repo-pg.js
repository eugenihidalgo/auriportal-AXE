// src/infra/repos/student-transmutation-state-repo-pg.js
// Implementación PostgreSQL del Repositorio de Estado de Alumnos para Transmutaciones
//
// Esta es la implementación concreta que encapsula TODAS las queries
// relacionadas con estado de alumnos en transmutaciones usando student_item_state.
// 
// REGLAS:
// - Usa student_item_state (Student SOT v1) como única fuente de verdad
// - NO usa tablas legacy (student_te_recurrent_state, student_te_one_time_state)
// - Retorna objetos raw de PostgreSQL (sin normalización)
// - Todos los métodos aceptan client opcional para transacciones
// - Usa resolveTemporalState() canónico para estado temporal

import { query } from '../../../database/pg.js';
import { StudentTransmutationStateRepo } from '../../core/repos/student-transmutation-state-repo.js';
import { resolveTemporalState } from '../../student/domains/resolve-temporal-state.js';

// Singleton para evitar múltiples instancias
let defaultRepo = null;

/**
 * Repositorio de Estado de Alumnos para Transmutaciones - Implementación PostgreSQL
 * 
 * Encapsula todas las operaciones de base de datos relacionadas con estado de alumnos.
 * Retorna objetos raw de PostgreSQL (sin transformación).
 * 
 * Todos los métodos aceptan un parámetro opcional `client` para transacciones.
 * Si se proporciona, usa ese client; si no, usa el pool por defecto.
 */
export class StudentTransmutationStateRepoPg extends StudentTransmutationStateRepo {
  /**
   * Obtiene estado de alumnos para un item
   * Retorna estado derivado según tipo (recurrente o una_vez)
   */
  async getStudentsForItem(itemRef, tipo, productKey = 'pde', options = {}, client = null) {
    if (!itemRef || !tipo) {
      return { students: [], counts: {}, total: 0 };
    }

    const { limit, offset = 0 } = options;
    const queryFn = client ? client.query.bind(client) : query;

    // Obtener el item del catálogo para conocer frecuencia_dias o veces_limpiar
    const itemResult = await queryFn(
      'SELECT frecuencia_dias, veces_limpiar FROM items_transmutaciones WHERE item_ref = $1',
      [itemRef]
    );

    if (itemResult.rows.length === 0) {
      return { students: [], counts: {}, total: 0 };
    }

    const item = itemResult.rows[0];

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

    const now = new Date();
    const students = [];
    const counts = tipo === 'recurrente' 
      ? { clean: 0, pending: 0, critical: 0 }
      : { incomplete: 0, complete: 0 };

    for (const row of result.rows) {
      if (tipo === 'recurrente') {
        // Calcular recurrencia efectiva
        const perItemRecurrence = row.per_item_recurrence_days 
          ? parseInt(row.per_item_recurrence_days, 10) 
          : null;
        const effectiveRecurrence = perItemRecurrence 
          || row.student_recurrence_days 
          || row.recommended_recurrence_days 
          || item.frecuencia_dias 
          || 30;

        // Calcular estado temporal
        const temporalState = resolveTemporalState({
          last_cleaned_at: row.last_cleaned_at,
          recurrence_days: effectiveRecurrence,
          now
        });

        // Calcular días desde última limpieza
        let daysSinceLastClean = null;
        if (row.last_cleaned_at) {
          const lastCleaned = new Date(row.last_cleaned_at);
          const diffMs = now.getTime() - lastCleaned.getTime();
          daysSinceLastClean = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        }

        counts[temporalState]++;

        students.push({
          student_id: row.student_id,
          student_name: row.student_name || row.student_email || 'Sin nombre',
          student_email: row.student_email,
          days_since_last_clean: daysSinceLastClean,
          temporal_state: temporalState,
          clean_count: row.clean_count || 0,
          last_cleaned_at: row.last_cleaned_at,
          recurrence_days: effectiveRecurrence
        });
      } else {
        // Tipo una_vez
        const remaining = row.remaining !== null ? row.remaining : (item.veces_limpiar || 0);
        const completed = row.completed !== null ? row.completed : 0;
        const isComplete = remaining <= 0;

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
         VALUES ($1, $2, 'transmutation', $3, NOW(), 1, $4, 'active')
         ON CONFLICT (student_id, product_key, domain_type, item_ref)
         DO UPDATE SET
           last_cleaned_at = NOW(),
           clean_count = student_item_state.clean_count + 1,
           recommended_recurrence_days = $4,
           updated_at = NOW()`,
        [alumno.id, productKey, itemRef, frecuenciaDias]
      );
      updated += result.rowCount || 0;
    }

    return { updated };
  }

  /**
   * Incrementa +1 todos los alumnos (una_vez)
   * Decrementa remaining hasta 0, incrementa completed
   */
  async incrementAll(itemRef, productKey = 'pde', client = null) {
    if (!itemRef) return { updated: 0 };

    const queryFn = client ? client.query.bind(client) : query;

    // Obtener item para conocer veces_limpiar
    const itemResult = await queryFn(
      'SELECT veces_limpiar FROM items_transmutaciones WHERE item_ref = $1',
      [itemRef]
    );

    if (itemResult.rows.length === 0) {
      return { updated: 0 };
    }

    const vecesLimpiar = itemResult.rows[0].veces_limpiar || 0;

    // Obtener todos los alumnos activos
    const alumnosResult = await queryFn(
      'SELECT id FROM alumnos WHERE status = \'active\'',
      []
    );

    let updated = 0;

    // UPSERT para cada alumno
    for (const alumno of alumnosResult.rows) {
      // Obtener estado actual
      const currentResult = await queryFn(
        `SELECT remaining, completed FROM student_item_state
         WHERE student_id = $1 AND product_key = $2 AND domain_type = 'transmutation' AND item_ref = $3`,
        [alumno.id, productKey, itemRef]
      );

      const current = currentResult.rows[0];
      const currentRemaining = current ? (current.remaining !== null ? current.remaining : vecesLimpiar) : vecesLimpiar;
      const currentCompleted = current ? (current.completed || 0) : 0;

      const newRemaining = Math.max(0, currentRemaining - 1);
      const newCompleted = currentCompleted + 1;

      const result = await queryFn(
        `INSERT INTO student_item_state 
         (student_id, product_key, domain_type, item_ref, remaining, completed, status)
         VALUES ($1, $2, 'transmutation', $3, $4, $5, 'active')
         ON CONFLICT (student_id, product_key, domain_type, item_ref)
         DO UPDATE SET
           remaining = GREATEST(remaining - 1, 0),
           completed = completed + 1,
           updated_at = NOW()`,
        [alumno.id, productKey, itemRef, newRemaining, newCompleted]
      );
      updated += result.rowCount || 0;
    }

    return { updated };
  }

  /**
   * Ajusta remaining manualmente para un alumno (una_vez)
   */
  async adjustRemaining(studentId, itemRef, remaining, productKey = 'pde', client = null) {
    if (!studentId || !itemRef || remaining === undefined) return null;

    const queryFn = client ? client.query.bind(client) : query;

    // Obtener item para conocer veces_limpiar
    const itemResult = await queryFn(
      'SELECT veces_limpiar FROM items_transmutaciones WHERE item_ref = $1',
      [itemRef]
    );

    if (itemResult.rows.length === 0) {
      return null;
    }

    const vecesLimpiar = itemResult.rows[0].veces_limpiar || 0;
    const newRemaining = Math.max(0, remaining);
    const newCompleted = Math.max(0, vecesLimpiar - newRemaining);

    // UPSERT
    const result = await queryFn(
      `INSERT INTO student_item_state 
       (student_id, product_key, domain_type, item_ref, remaining, completed, status)
       VALUES ($1, $2, 'transmutation', $3, $4, $5, 'active')
       ON CONFLICT (student_id, product_key, domain_type, item_ref)
       DO UPDATE SET
         remaining = $4,
         completed = $5,
         updated_at = NOW()
       RETURNING *`,
      [studentId, productKey, itemRef, newRemaining, newCompleted]
    );

    return result.rows[0] || null;
  }
}

/**
 * Obtiene una instancia singleton del repositorio
 * 
 * @returns {StudentTransmutationStateRepoPg} Instancia del repositorio
 */
export function getDefaultStudentTransmutationStateRepo() {
  if (!defaultRepo) {
    defaultRepo = new StudentTransmutationStateRepoPg();
  }
  return defaultRepo;
}
