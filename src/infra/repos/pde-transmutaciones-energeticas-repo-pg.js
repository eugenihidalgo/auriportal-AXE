// src/infra/repos/pde-transmutaciones-energeticas-repo-pg.js
// Implementación PostgreSQL del Repositorio de Transmutaciones Energéticas PDE
//
// Esta es la implementación concreta que encapsula TODAS las queries
// relacionadas con listas_transmutaciones e items_transmutaciones en PostgreSQL.
// 
// REGLAS:
// - Este es el ÚNICO lugar donde se importa database/pg.js para transmutaciones
// - Retorna objetos raw de PostgreSQL (sin normalización)
// - Todos los métodos aceptan client opcional para transacciones
// - Usa status ('active'/'archived') NO activo (boolean)

import { query } from '../../../database/pg.js';
import { PdeTransmutacionesEnergeticasRepo } from '../../core/repos/pde-transmutaciones-energeticas-repo.js';

// Singleton para evitar múltiples instancias
let defaultRepo = null;

/**
 * Repositorio de Transmutaciones Energéticas PDE - Implementación PostgreSQL
 * 
 * Encapsula todas las operaciones de base de datos relacionadas con transmutaciones.
 * Retorna objetos raw de PostgreSQL (sin transformación).
 * 
 * Todos los métodos aceptan un parámetro opcional `client` para transacciones.
 * Si se proporciona, usa ese client; si no, usa el pool por defecto.
 */
export class PdeTransmutacionesEnergeticasRepoPg extends PdeTransmutacionesEnergeticasRepo {
  /**
   * Lista todas las listas de transmutaciones
   */
  async listListas(options = {}, client = null) {
    const { onlyActive = true, tipo } = options;
    const queryFn = client ? client.query.bind(client) : query;

    let sql = 'SELECT * FROM listas_transmutaciones';
    const params = [];
    const conditions = [];

    if (onlyActive) {
      conditions.push(`status = 'active'`);
    }

    if (tipo) {
      conditions.push(`tipo = $${params.length + 1}`);
      params.push(tipo);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY orden ASC, nombre ASC';

    const result = await queryFn(sql, params);
    return result.rows || [];
  }

  /**
   * Obtiene una lista por ID
   */
  async getListaById(id, client = null) {
    if (!id) return null;

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      'SELECT * FROM listas_transmutaciones WHERE id = $1',
      [id]
    );

    return result.rows[0] || null;
  }

  /**
   * Crea una nueva lista
   */
  async createLista(listaData, client = null) {
    if (!listaData.nombre) {
      throw new Error('nombre es requerido');
    }

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `INSERT INTO listas_transmutaciones (
        nombre, tipo, descripcion, orden, 
        category_key, subtype_key, tags, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        listaData.nombre,
        listaData.tipo || 'recurrente',
        listaData.descripcion || null,
        listaData.orden !== undefined ? listaData.orden : 0,
        listaData.category_key || null,
        listaData.subtype_key || null,
        listaData.tags ? JSON.stringify(listaData.tags) : null,
        listaData.status || 'active'
      ]
    );

    return result.rows[0];
  }

  /**
   * Actualiza metadata de una lista
   */
  async updateListaMeta(id, patch, client = null) {
    if (!id) return null;

    const campos = [];
    const valores = [];
    let paramIndex = 1;

    // Campos permitidos para actualización
    const allowedFields = [
      'nombre', 'tipo', 'descripcion', 'orden',
      'category_key', 'subtype_key', 'tags', 'status'
    ];

    for (const field of allowedFields) {
      if (patch[field] !== undefined) {
        if (field === 'tags' && Array.isArray(patch[field])) {
          // Convertir array a JSONB
          campos.push(`${field} = $${paramIndex++}`);
          valores.push(JSON.stringify(patch[field]));
        } else {
          campos.push(`${field} = $${paramIndex++}`);
          valores.push(patch[field]);
        }
      }
    }

    if (campos.length === 0) {
      // No hay campos para actualizar, retornar la lista actual
      return await this.getListaById(id, client);
    }

    // Agregar id al final para el WHERE
    valores.push(id);

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `UPDATE listas_transmutaciones 
       SET ${campos.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      valores
    );

    return result.rows[0] || null;
  }

  /**
   * Archiva una lista (soft delete)
   */
  async archiveLista(id, client = null) {
    return await this.updateListaMeta(id, { status: 'archived' }, client);
  }

  /**
   * Lista todos los items de una lista
   */
  async listItems(listaId, options = {}, client = null) {
    if (!listaId) return [];

    const { onlyActive = true } = options;
    const queryFn = client ? client.query.bind(client) : query;

    let sql = 'SELECT * FROM items_transmutaciones WHERE lista_id = $1';
    const params = [listaId];

    if (onlyActive) {
      sql += ` AND status = 'active'`;
    }

    // LEY ABSOLUTA: ORDER BY nivel ASC
    // ❌ PROHIBIDO ordenar por nombre
    // ❌ PROHIBIDO ordenar por created_at
    // NOTA: nivel puede ser NULL en items antiguos, usar NULLS LAST
    sql += ' ORDER BY nivel ASC NULLS LAST';

    const result = await queryFn(sql, params);
    return result.rows || [];
  }

  /**
   * Lista items ordenados por nivel ASC, created_at ASC (LEY ABSOLUTA)
   */
  async listItemsOrdered(listaId, options = {}, client = null) {
    return await this.listItems(listaId, options, client);
  }

  /**
   * Obtiene un item por ID
   */
  async getItemById(id, client = null) {
    if (!id) return null;

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      'SELECT * FROM items_transmutaciones WHERE id = $1',
      [id]
    );

    return result.rows[0] || null;
  }

  /**
   * Crea un nuevo item
   */
  async createItem(itemData, client = null) {
    if (!itemData.lista_id || !itemData.nombre) {
      throw new Error('lista_id y nombre son requeridos');
    }

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `INSERT INTO items_transmutaciones (
        lista_id, nombre, descripcion, nivel, prioridad,
        frecuencia_dias, veces_limpiar, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        itemData.lista_id,
        itemData.nombre,
        itemData.descripcion || null,
        itemData.nivel !== undefined ? itemData.nivel : null,
        itemData.prioridad || null,
        itemData.frecuencia_dias !== undefined ? itemData.frecuencia_dias : null,
        itemData.veces_limpiar !== undefined ? itemData.veces_limpiar : null,
        itemData.status || 'active'
      ]
    );

    return result.rows[0];
  }

  /**
   * Actualiza un item
   */
  async updateItem(id, patch, client = null) {
    if (!id) return null;

    const campos = [];
    const valores = [];
    let paramIndex = 1;

    // Campos permitidos para actualización
    const allowedFields = [
      'nombre', 'descripcion', 'nivel', 'prioridad',
      'frecuencia_dias', 'veces_limpiar', 'status'
    ];

    for (const field of allowedFields) {
      if (patch[field] !== undefined) {
        campos.push(`${field} = $${paramIndex++}`);
        valores.push(patch[field]);
      }
    }

    if (campos.length === 0) {
      // No hay campos para actualizar, retornar el item actual
      return await this.getItemById(id, client);
    }

    // Agregar id al final para el WHERE
    valores.push(id);

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `UPDATE items_transmutaciones 
       SET ${campos.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      valores
    );

    return result.rows[0] || null;
  }

  /**
   * Archiva un item (soft delete)
   */
  async archiveItem(id, client = null) {
    return await this.updateItem(id, { status: 'archived' }, client);
  }

  /**
   * OPERACIONES MASTER - Estado de Alumnos Recurrentes
   */

  /**
   * Obtiene estado de alumnos para un item recurrente
   * Retorna 3 grupos: limpio, pendiente, crítico
   */
  async getRecurrentStateForItem(itemId, client = null) {
    if (!itemId) return { limpio: [], pendiente: [], critico: [] };

    const queryFn = client ? client.query.bind(client) : query;
    
    // Obtener el item para conocer frecuencia_dias
    const item = await this.getItemById(itemId, client);
    if (!item || !item.frecuencia_dias) {
      return { limpio: [], pendiente: [], critico: [] };
    }

    // Obtener todos los estados
    const result = await queryFn(
      `SELECT s.*, 
              COALESCE(
                EXTRACT(EPOCH FROM (NOW() - s.last_cleaned_at)) / 86400,
                999
              )::INTEGER as days_since
       FROM student_te_recurrent_state s
       WHERE s.item_id = $1 AND s.status = 'active'
       ORDER BY s.student_email ASC`,
      [itemId]
    );

    const estados = result.rows || [];
    const frecuencia = item.frecuencia_dias;

    // Clasificar en 3 grupos
    const limpio = [];
    const pendiente = [];
    const critico = [];

    for (const estado of estados) {
      const daysSince = estado.days_since || 999;
      const stateObj = {
        student_email: estado.student_email,
        last_cleaned_at: estado.last_cleaned_at,
        days_since_last_clean: daysSince,
        is_clean: estado.is_clean,
        is_critical: estado.is_critical,
        notes: estado.notes
      };

      if (estado.is_clean || daysSince < frecuencia) {
        limpio.push(stateObj);
      } else if (daysSince >= frecuencia * 1.5) {
        critico.push(stateObj);
      } else {
        pendiente.push(stateObj);
      }
    }

    return { limpio, pendiente, critico };
  }

  /**
   * Marca limpio para todos los alumnos (item recurrente)
   */
  async markCleanForAllRecurrent(itemId, client = null) {
    if (!itemId) return { updated: 0 };

    const queryFn = client ? client.query.bind(client) : query;

    const result = await queryFn(
      `UPDATE student_te_recurrent_state
       SET last_cleaned_at = NOW(),
           days_since_last_clean = 0,
           is_clean = TRUE,
           is_critical = FALSE,
           updated_at = NOW()
       WHERE item_id = $1 AND status = 'active'`,
      [itemId]
    );

    return { updated: result.rowCount || 0 };
  }

  /**
   * Marca limpio para un alumno específico (item recurrente)
   */
  async markCleanForStudentRecurrent(itemId, studentEmail, client = null) {
    if (!itemId || !studentEmail) return null;

    const queryFn = client ? client.query.bind(client) : query;

    // Upsert: crear si no existe, actualizar si existe
    const result = await queryFn(
      `INSERT INTO student_te_recurrent_state 
       (student_email, item_id, last_cleaned_at, days_since_last_clean, is_clean, is_critical, status)
       VALUES ($1, $2, NOW(), 0, TRUE, FALSE, 'active')
       ON CONFLICT (student_email, item_id)
       DO UPDATE SET
         last_cleaned_at = NOW(),
         days_since_last_clean = 0,
         is_clean = TRUE,
         is_critical = FALSE,
         updated_at = NOW()
       RETURNING *`,
      [studentEmail, itemId]
    );

    return result.rows[0] || null;
  }

  /**
   * OPERACIONES MASTER - Estado de Alumnos Una Vez
   */

  /**
   * Obtiene estado de alumnos para un item una_vez
   */
  async getOneTimeStateForItem(itemId, client = null) {
    if (!itemId) return [];

    const queryFn = client ? client.query.bind(client) : query;

    const result = await queryFn(
      `SELECT * FROM student_te_one_time_state
       WHERE item_id = $1 AND status = 'active'
       ORDER BY student_email ASC`,
      [itemId]
    );

    return result.rows || [];
  }

  /**
   * Limpieza +1 para todos los alumnos (item una_vez)
   * remaining = max(remaining - 1, 0)
   */
  async incrementCleanForAllOneTime(itemId, client = null) {
    if (!itemId) return { updated: 0 };

    const queryFn = client ? client.query.bind(client) : query;

    const result = await queryFn(
      `UPDATE student_te_one_time_state
       SET remaining = GREATEST(remaining - 1, 0),
           completed = completed + 1,
           is_complete = CASE WHEN GREATEST(remaining - 1, 0) = 0 THEN TRUE ELSE FALSE END,
           updated_at = NOW()
       WHERE item_id = $1 AND status = 'active' AND remaining > 0`,
      [itemId]
    );

    return { updated: result.rowCount || 0 };
  }

  /**
   * Ajusta remaining manualmente para un alumno (item una_vez)
   */
  async adjustRemainingForStudent(itemId, studentEmail, newRemaining, client = null) {
    if (!itemId || !studentEmail || newRemaining === undefined) return null;

    const queryFn = client ? client.query.bind(client) : query;

    // Obtener item para conocer veces_limpiar
    const item = await this.getItemById(itemId, client);
    if (!item) return null;

    const totalRequerido = item.veces_limpiar || 0;
    const completed = totalRequerido - Math.max(newRemaining, 0);
    const isComplete = newRemaining <= 0;

    // Upsert
    const result = await queryFn(
      `INSERT INTO student_te_one_time_state 
       (student_email, item_id, remaining, completed, is_complete, status)
       VALUES ($1, $2, $3, $4, $5, 'active')
       ON CONFLICT (student_email, item_id)
       DO UPDATE SET
         remaining = $3,
         completed = $4,
         is_complete = $5,
         updated_at = NOW()
       RETURNING *`,
      [studentEmail, itemId, Math.max(newRemaining, 0), completed, isComplete]
    );

    return result.rows[0] || null;
  }

  /**
   * Obtiene lista de todos los estudiantes (emails)
   */
  async listAllStudents(client = null) {
    const queryFn = client ? client.query.bind(client) : query;

    // Buscar en tabla students (PostgreSQL) - ajustar según esquema real
    try {
      const result = await queryFn(
        `SELECT email, nombre, apodo 
         FROM students 
         WHERE email IS NOT NULL 
         ORDER BY email ASC`
      );
      return result.rows || [];
    } catch (error) {
      // Si la tabla students no existe o tiene otro esquema, retornar array vacío
      console.warn('Error obteniendo estudiantes:', error.message);
      return [];
    }
  }
}

/**
 * Obtiene una instancia singleton del repositorio
 * 
 * @returns {PdeTransmutacionesEnergeticasRepoPg} Instancia del repositorio
 */
export function getDefaultPdeTransmutacionesEnergeticasRepo() {
  if (!defaultRepo) {
    defaultRepo = new PdeTransmutacionesEnergeticasRepoPg();
  }
  return defaultRepo;
}

