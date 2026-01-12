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

    // Obtener TODOS los alumnos, con su estado si existe
    // LEFT JOIN para incluir alumnos sin estado aún
    // NO filtrar por status - datos RAW
    let sql = `
      SELECT 
        a.id as student_id,
        COALESCE(a.nombre_completo, a.apodo, a.email) as student_name,
        a.email as student_email,
        a.apodo,
        a.nombre_completo,
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
        AND s.is_active = true
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
          apodo: row.apodo,
          nombre_completo: row.nombre_completo,
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
          apodo: row.apodo,
          nombre_completo: row.nombre_completo,
          remaining,
          completed,
          is_complete: isComplete
        });
      }
    }

    // Obtener total (sin limit/offset)
    // NO filtrar por status - datos RAW
    const totalResult = await queryFn(
      'SELECT COUNT(*) as total FROM alumnos',
      []
    );
    const total = parseInt(totalResult.rows[0]?.total || '0', 10);

    return { students, counts, total };
  }

  /**
   * Obtiene datos básicos de alumnos para un item desde cleaning_item_state (Cleaning Engine v1)
   * Retorna datos raw de cleaning_item_state según clean_layer
   * 
   * @param {string} itemRef - item_ref del item
   * @param {string} tipo - Tipo del item ('recurrente' o 'una_vez')
   * @param {string} cleanLayer - Capa de limpieza ('shared' | 'pde')
   * @param {string} productKey - Clave del producto
   * @param {Object} options - Opciones adicionales (limit, offset)
   * @param {Object} client - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object>} Objeto con students, counts, total
   */
  async getStudentsForItemFromCleaningEngine(itemRef, tipo, cleanLayer, productKey = 'pde', options = {}, client = null) {
    if (!itemRef || !tipo || !cleanLayer) {
      return { students: [], counts: {}, total: 0 };
    }

    const { limit, offset = 0 } = options;
    const queryFn = client ? client.query.bind(client) : query;
    const domainType = 'transmutation';

    // UUID-ONLY: Obtener estudiantes desde students (UUID canónico)
    // JOIN con cleaning_item_state usando legacy_alumno_id resuelto internamente
    // NO hacer JOIN con alumnos directamente
    let sql = `
      SELECT 
        s.id as student_uuid,
        s.legacy_alumno_id as legacy_student_id,
        c.${cleanLayer === 'shared' ? 'shared_last_cleaned_at' : 'pde_last_cleaned_at'} as last_cleaned_at,
        c.${cleanLayer === 'shared' ? 'shared_clean_count' : 'pde_clean_count'} as clean_count,
        c.shared_remaining,
        c.shared_completed,
        c.pde_completed
      FROM students s
      LEFT JOIN cleaning_item_state c ON c.student_id = s.legacy_alumno_id
        AND c.product_key = $1
        AND c.domain_type = $2
        AND c.item_ref = $3
      LEFT JOIN pausas p ON p.alumno_id = s.legacy_alumno_id AND p.fin IS NULL
      WHERE s.deleted_at IS NULL
        AND p.id IS NULL  -- Excluir estudiantes en pausa
      ORDER BY s.id ASC
    `;

    const params = [productKey, domainType, itemRef];

    if (limit) {
      sql += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);
    }

    const result = await queryFn(sql, params);

    const students = [];
    const counts = tipo === 'recurrente' 
      ? { reviewed: 0, pending: 0, important: 0, never: 0 }
      : { incomplete: 0, complete: 0 };

    // UUID-ONLY: Obtener display_name desde alumnos solo si es necesario (para compatibilidad)
    // En el futuro, esto debería venir de students directamente
    for (const row of result.rows) {
      // Resolver display_name desde alumnos (solo para compatibilidad, no decisor)
      let studentName = null;
      let studentEmail = null;
      let apodo = null;
      let nombreCompleto = null;
      
      if (row.legacy_student_id) {
        try {
          const alumnoResult = await queryFn(
            'SELECT email, apodo, nombre_completo FROM alumnos WHERE id = $1 LIMIT 1',
            [row.legacy_student_id]
          );
          if (alumnoResult.rows[0]) {
            const alumno = alumnoResult.rows[0];
            studentEmail = alumno.email;
            apodo = alumno.apodo;
            nombreCompleto = alumno.nombre_completo;
            studentName = alumno.nombre_completo || alumno.apodo || alumno.email || 'Sin nombre';
          }
        } catch (error) {
          // Fail-open: si no se puede obtener, usar valores por defecto
          studentName = 'Sin nombre';
        }
      }
      
      if (tipo === 'recurrente') {
        const daysSinceLastClean = row.last_cleaned_at 
          ? Math.floor((new Date().getTime() - new Date(row.last_cleaned_at).getTime()) / (1000 * 60 * 60 * 24))
          : null;

        students.push({
          student_uuid: row.student_uuid, // UUID canónico
          student_name: studentName || 'Sin nombre',
          student_email: studentEmail,
          apodo: apodo,
          nombre_completo: nombreCompleto,
          days_since_last_clean: daysSinceLastClean,
          last_cleaned_at: row.last_cleaned_at,
          clean_count: row.clean_count || 0
        });
      } else {
        // una_vez - solo SHARED tiene remaining/completed
        const remaining = cleanLayer === 'shared' 
          ? (row.shared_remaining !== null ? parseInt(row.shared_remaining, 10) : null)
          : null;
        const completed = cleanLayer === 'shared'
          ? (row.shared_completed !== null ? parseInt(row.shared_completed, 10) : 0)
          : (row.pde_completed !== null ? parseInt(row.pde_completed, 10) : 0);
        const isComplete = remaining !== null && remaining <= 0;

        if (isComplete) {
          counts.complete++;
        } else {
          counts.incomplete++;
        }

        students.push({
          student_uuid: row.student_uuid, // UUID canónico
          student_name: studentName || 'Sin nombre',
          student_email: studentEmail,
          apodo: apodo,
          nombre_completo: nombreCompleto,
          remaining,
          completed,
          is_complete: isComplete
        });
      }
    }

    // UUID-ONLY: Obtener total desde students (excluyendo pausados)
    const totalResult = await queryFn(
      `SELECT COUNT(*) as total 
       FROM students s
       LEFT JOIN pausas p ON p.alumno_id = s.legacy_alumno_id AND p.fin IS NULL
       WHERE s.deleted_at IS NULL
         AND p.id IS NULL`,
      []
    );
    const total = parseInt(totalResult.rows[0]?.total || '0', 10);

    return { students, counts, total };
  }

  /**
   * Marca limpio un alumno específico (recurrente)
   * @param {number} studentId - ID del alumno
   * @param {number} itemId - ID numérico del item (PK de items_transmutaciones)
   * @param {string} productKey - Clave del producto
   * @param {string} domainKey - Clave del dominio
   * @param {Object} client - Cliente de transacción (opcional)
   */
  async markCleanStudent(studentId, itemId, productKey = 'pde', domainKey = 'transmutaciones_energeticas', client = null) {
    if (!studentId || !itemId) return null;

    const queryFn = client ? client.query.bind(client) : query;

    // Obtener item para conocer frecuencia_dias y item_ref
    const itemResult = await queryFn(
      'SELECT id, frecuencia_dias, item_ref FROM items_transmutaciones WHERE id = $1',
      [itemId]
    );

    if (itemResult.rows.length === 0) {
      return null;
    }

    const frecuenciaDias = itemResult.rows[0].frecuencia_dias || 30;
    const itemRef = itemResult.rows[0].item_ref;

    // UPSERT en student_item_state (item_id es NOT NULL, obligatorio)
    // Constraint UNIQUE actual: (student_id, product_key, domain_type, item_ref)
    // Pero item_id también es NOT NULL, así que lo incluimos
    // Placeholders SQL estrictamente secuenciales: $1, $2, $3, $4, $5, $6
    const result = await queryFn(
      `INSERT INTO student_item_state 
       (student_id, product_key, domain_key, domain_type, item_id, item_ref, last_cleaned_at, clean_count, recommended_recurrence_days, is_active)
       VALUES ($1, $2, $3, 'transmutation', $4, $5, NOW(), COALESCE(
         (SELECT clean_count FROM student_item_state 
          WHERE student_id = $1 AND product_key = $2 AND domain_type = 'transmutation' AND item_id = $4), 0
       ) + 1, $6, true)
       ON CONFLICT (student_id, product_key, domain_type, item_ref)
       DO UPDATE SET
         item_id = $4,
         domain_key = $3,
         last_cleaned_at = GREATEST(student_item_state.last_cleaned_at, NOW()),
         clean_count = CASE 
           WHEN student_item_state.last_cleaned_at < NOW() THEN student_item_state.clean_count + 1
           ELSE student_item_state.clean_count
         END,
         recommended_recurrence_days = $6,
         is_active = true,
         updated_at = NOW()
       RETURNING *`,
      [studentId, productKey, domainKey, itemId, itemRef, frecuenciaDias]
    );

    return result.rows[0] || null;
  }

  /**
   * Marca limpio todos los alumnos (recurrente)
   * @param {number} itemId - ID numérico del item (PK de items_transmutaciones)
   * @param {string} productKey - Clave del producto
   * @param {string} domainKey - Clave del dominio
   * @param {Object} client - Cliente de transacción (opcional)
   */
  async markCleanAll(itemId, productKey = 'pde', domainKey = 'transmutaciones_energeticas', client = null) {
    if (!itemId) return { updated: 0 };

    const queryFn = client ? client.query.bind(client) : query;

    // Obtener item para conocer frecuencia_dias y item_ref
    const itemResult = await queryFn(
      'SELECT id, frecuencia_dias, item_ref FROM items_transmutaciones WHERE id = $1',
      [itemId]
    );

    if (itemResult.rows.length === 0) {
      return { updated: 0 };
    }

    const frecuenciaDias = itemResult.rows[0].frecuencia_dias || 30;
    const itemRef = itemResult.rows[0].item_ref;

    // Obtener todos los alumnos (no filtrar por status - el dominio decide estados)
    const alumnosResult = await queryFn(
      'SELECT id FROM alumnos',
      []
    );

    let updated = 0;

    // UPSERT para cada alumno (item_id es NOT NULL, obligatorio)
    // Constraint UNIQUE actual: (student_id, product_key, domain_type, item_ref)
    // Placeholders SQL estrictamente secuenciales: $1, $2, $3, $4, $5, $6
    for (const alumno of alumnosResult.rows) {
      const result = await queryFn(
        `INSERT INTO student_item_state 
         (student_id, product_key, domain_key, domain_type, item_id, item_ref, last_cleaned_at, clean_count, recommended_recurrence_days, is_active)
         VALUES ($1, $2, $3, 'transmutation', $4, $5, NOW(), COALESCE(
           (SELECT clean_count FROM student_item_state 
            WHERE student_id = $1 AND product_key = $2 AND domain_type = 'transmutation' AND item_id = $4), 0
         ) + 1, $6, true)
         ON CONFLICT (student_id, product_key, domain_type, item_ref)
         DO UPDATE SET
           item_id = $4,
           domain_key = $3,
           last_cleaned_at = GREATEST(student_item_state.last_cleaned_at, NOW()),
           clean_count = CASE 
             WHEN student_item_state.last_cleaned_at < NOW() THEN student_item_state.clean_count + 1
             ELSE student_item_state.clean_count
           END,
           recommended_recurrence_days = $6,
           is_active = true,
           updated_at = NOW()
         RETURNING *`,
        [alumno.id, productKey, domainKey, itemId, itemRef, frecuenciaDias]
      );

      if (result.rows.length > 0) {
        updated++;
      }
    }

    return { updated };
  }

  /**
   * Incrementa +1 todos los alumnos (una_vez)
   * @param {number} itemId - ID numérico del item (PK de items_transmutaciones)
   * @param {string} productKey - Clave del producto
   * @param {string} domainKey - Clave del dominio
   * @param {Object} client - Cliente de transacción (opcional)
   */
  async incrementAll(itemId, productKey = 'pde', domainKey = 'transmutaciones_energeticas', client = null) {
    if (!itemId) return { updated: 0 };

    const queryFn = client ? client.query.bind(client) : query;

    // Obtener item_ref del item
    const itemResult = await queryFn(
      'SELECT item_ref FROM items_transmutaciones WHERE id = $1',
      [itemId]
    );

    if (itemResult.rows.length === 0) {
      return { updated: 0 };
    }

    const itemRef = itemResult.rows[0].item_ref;

    // Obtener todos los alumnos (no filtrar por status - el dominio decide estados)
    const alumnosResult = await queryFn(
      'SELECT id FROM alumnos',
      []
    );

    let updated = 0;

    // UPSERT para cada alumno: decrementar remaining, incrementar completed (item_id es NOT NULL, obligatorio)
    // Constraint UNIQUE actual: (student_id, product_key, domain_type, item_ref)
    // Placeholders SQL estrictamente secuenciales: $1, $2, $3, $4, $5
    for (const alumno of alumnosResult.rows) {
      const result = await queryFn(
        `INSERT INTO student_item_state 
         (student_id, product_key, domain_key, domain_type, item_id, item_ref, remaining, completed, is_active)
         VALUES ($1, $2, $3, 'transmutation', $4, $5, 
           GREATEST(0, COALESCE(
             (SELECT remaining FROM student_item_state 
              WHERE student_id = $1 AND product_key = $2 AND domain_type = 'transmutation' AND item_id = $4), 0
           ) - 1),
           COALESCE(
             (SELECT completed FROM student_item_state 
              WHERE student_id = $1 AND product_key = $2 AND domain_type = 'transmutation' AND item_id = $4), 0
           ) + 1,
           true)
         ON CONFLICT (student_id, product_key, domain_type, item_ref)
         DO UPDATE SET
           item_id = $4,
           domain_key = $3,
           remaining = GREATEST(0, student_item_state.remaining - 1),
           completed = student_item_state.completed + 1,
           is_active = true,
           updated_at = NOW()
         RETURNING *`,
        [alumno.id, productKey, domainKey, itemId, itemRef]
      );

      if (result.rows.length > 0) {
        updated++;
      }
    }

    return { updated };
  }

  /**
   * Ajusta remaining manualmente para un alumno (una_vez)
   * @param {number} studentId - ID del alumno
   * @param {number} itemId - ID numérico del item (PK de items_transmutaciones)
   * @param {number} remaining - Nuevo valor de remaining
   * @param {string} productKey - Clave del producto
   * @param {string} domainKey - Clave del dominio
   * @param {Object} client - Cliente de transacción (opcional)
   */
  async adjustRemaining(studentId, itemId, remaining, productKey = 'pde', domainKey = 'transmutaciones_energeticas', client = null) {
    if (!studentId || !itemId || remaining === undefined) return null;

    const queryFn = client ? client.query.bind(client) : query;

    // Obtener item_ref del item
    const itemResult = await queryFn(
      'SELECT item_ref FROM items_transmutaciones WHERE id = $1',
      [itemId]
    );

    if (itemResult.rows.length === 0) {
      return null;
    }

    const itemRef = itemResult.rows[0].item_ref;

    // UPSERT en student_item_state (item_id es NOT NULL, obligatorio)
    // Constraint UNIQUE actual: (student_id, product_key, domain_type, item_ref)
    // Placeholders SQL estrictamente secuenciales: $1, $2, $3, $4, $5, $6
    const result = await queryFn(
      `INSERT INTO student_item_state 
       (student_id, product_key, domain_key, domain_type, item_id, item_ref, remaining, is_active)
       VALUES ($1, $2, $3, 'transmutation', $4, $5, $6, true)
       ON CONFLICT (student_id, product_key, domain_type, item_ref)
       DO UPDATE SET
         item_id = $4,
         domain_key = $3,
         remaining = $6,
         is_active = true,
         updated_at = NOW()
       RETURNING *`,
      [studentId, productKey, domainKey, itemId, itemRef, remaining]
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
