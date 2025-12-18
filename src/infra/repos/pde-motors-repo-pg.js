// src/infra/repos/pde-motors-repo-pg.js
// Implementación PostgreSQL del Repositorio de Motores PDE
//
// Esta es la implementación concreta que encapsula TODAS las queries
// relacionadas con motores en PostgreSQL.
// 
// REGLAS:
// - Este es el ÚNICO lugar donde se importa database/pg.js para motores
// - Retorna objetos raw de PostgreSQL (sin normalización)
// - Soft delete normalizado usando deleted_at

import { query } from '../../../database/pg.js';
import { PdeMotorsRepo } from '../../core/repos/pde-motors-repo.js';

/**
 * Repositorio de Motores PDE - Implementación PostgreSQL
 * 
 * Encapsula todas las operaciones de base de datos relacionadas con motores.
 * Retorna objetos raw de PostgreSQL (sin transformación).
 * 
 * Todos los métodos aceptan un parámetro opcional `client` para transacciones.
 * Si se proporciona, usa ese client; si no, usa el pool por defecto.
 */
export class PdeMotorsRepoPg extends PdeMotorsRepo {
  /**
   * Crea un nuevo motor
   * 
   * @param {Object} motorData - Datos del motor
   * @param {string} motorData.motor_key - Clave canónica del motor (única)
   * @param {string} motorData.name - Nombre del motor
   * @param {string} [motorData.description] - Descripción opcional
   * @param {string} motorData.category - Categoría del motor
   * @param {Object} motorData.definition - Definición JSONB completa del motor
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object>} Motor creado
   */
  async createMotor(motorData, client = null) {
    const {
      motor_key,
      name,
      description = null,
      category,
      definition,
      version = 1,
      status = 'draft'
    } = motorData;

    if (!motor_key || !name || !category || !definition) {
      throw new Error('motor_key, name, category y definition son obligatorios');
    }

    // Convertir definition a JSONB si es objeto
    const definitionJson = typeof definition === 'string'
      ? definition
      : JSON.stringify(definition);

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      INSERT INTO pde_motors (
        motor_key,
        name,
        description,
        category,
        version,
        status,
        definition,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NOW(), NOW())
      RETURNING *
    `, [
      motor_key,
      name,
      description,
      category,
      version,
      status,
      definitionJson
    ]);

    return result.rows[0];
  }

  /**
   * Actualiza un motor existente
   * 
   * @param {string} id - UUID del motor
   * @param {Object} patch - Campos a actualizar (parcial)
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Motor actualizado o null si no existe
   */
  async updateMotor(id, patch, client = null) {
    if (!id) return null;

    const campos = [];
    const valores = [];
    let paramIndex = 1;

    // Construir SET dinámico
    if (patch.name !== undefined) {
      campos.push(`name = $${paramIndex++}`);
      valores.push(patch.name);
    }

    if (patch.description !== undefined) {
      campos.push(`description = $${paramIndex++}`);
      valores.push(patch.description);
    }

    if (patch.category !== undefined) {
      campos.push(`category = $${paramIndex++}`);
      valores.push(patch.category);
    }

    if (patch.version !== undefined) {
      campos.push(`version = $${paramIndex++}`);
      valores.push(patch.version);
    }

    if (patch.status !== undefined) {
      campos.push(`status = $${paramIndex++}`);
      valores.push(patch.status);
    }

    if (patch.definition !== undefined) {
      const definitionJson = typeof patch.definition === 'string'
        ? patch.definition
        : JSON.stringify(patch.definition);
      campos.push(`definition = $${paramIndex++}::jsonb`);
      valores.push(definitionJson);
    }

    if (campos.length === 0) {
      // No hay campos para actualizar, retornar el motor actual
      return await this.getMotorById(id, client);
    }

    // Siempre actualizar updated_at
    campos.push(`updated_at = NOW()`);
    
    // Agregar id al final para el WHERE
    valores.push(id);

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `UPDATE pde_motors 
       SET ${campos.join(', ')}
       WHERE id = $${paramIndex} AND deleted_at IS NULL
       RETURNING *`,
      valores
    );

    return result.rows[0] || null;
  }

  /**
   * Lista todos los motores
   * 
   * @param {Object} options - Opciones de filtrado
   * @param {boolean} [options.includeDeleted=false] - Si incluir eliminados
   * @param {string} [options.status] - Filtrar por status (draft, published, archived)
   * @param {string} [options.category] - Filtrar por categoría
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Array>} Array de motores
   */
  async listMotors(options = {}, client = null) {
    const { includeDeleted = false, status, category } = options;
    const queryFn = client ? client.query.bind(client) : query;

    let sql = 'SELECT * FROM pde_motors';
    const params = [];
    const conditions = [];

    if (!includeDeleted) {
      conditions.push('deleted_at IS NULL');
    }

    if (status) {
      conditions.push(`status = $${params.length + 1}`);
      params.push(status);
    }

    if (category) {
      conditions.push(`category = $${params.length + 1}`);
      params.push(category);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY created_at DESC';

    const result = await queryFn(sql, params);
    return result.rows || [];
  }

  /**
   * Obtiene un motor por ID
   * 
   * @param {string} id - UUID del motor
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Motor o null si no existe
   */
  async getMotorById(id, client = null) {
    if (!id) return null;

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      'SELECT * FROM pde_motors WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Obtiene un motor por motor_key
   * 
   * @param {string} motorKey - Clave canónica del motor
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Motor o null si no existe
   */
  async getMotorByKey(motorKey, client = null) {
    if (!motorKey) return null;

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      'SELECT * FROM pde_motors WHERE motor_key = $1 AND deleted_at IS NULL',
      [motorKey]
    );
    return result.rows[0] || null;
  }

  /**
   * Elimina un motor (soft delete)
   * 
   * @param {string} id - UUID del motor
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<boolean>} true si se eliminó correctamente
   */
  async softDeleteMotor(id, client = null) {
    if (!id) return false;

    const queryFn = client ? client.query.bind(client) : query;
    await queryFn(
      `UPDATE pde_motors 
       SET deleted_at = NOW(), updated_at = NOW() 
       WHERE id = $1`,
      [id]
    );

    return true;
  }

  /**
   * Duplica un motor (crea una nueva versión)
   * 
   * @param {string} id - UUID del motor a duplicar
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Motor duplicado o null si no existe el original
   */
  async duplicateMotor(id, client = null) {
    if (!id) return null;

    const original = await this.getMotorById(id, client);
    if (!original) return null;

    // Crear nuevo motor con datos del original
    const newMotorData = {
      motor_key: `${original.motor_key}_copy_${Date.now()}`,
      name: `${original.name} (Copia)`,
      description: original.description,
      category: original.category,
      definition: original.definition,
      version: 1,
      status: 'draft'
    };

    return await this.createMotor(newMotorData, client);
  }
}

// Exportar instancia singleton por defecto
let defaultInstance = null;

/**
 * Obtiene la instancia por defecto del repositorio
 * 
 * @returns {PdeMotorsRepoPg} Instancia del repositorio
 */
export function getDefaultPdeMotorsRepo() {
  if (!defaultInstance) {
    defaultInstance = new PdeMotorsRepoPg();
  }
  return defaultInstance;
}

// Exportar también la clase para permitir crear instancias personalizadas
export default getDefaultPdeMotorsRepo();

