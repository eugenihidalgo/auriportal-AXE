// database/theme-repository.js
// Repositorio para gestión de definiciones de temas
// FASE 1: Solo persistencia, NO aplicación de temas

import { query } from './pg.js';

/**
 * Repositorio de temas personalizados
 * 
 * REGLAS ABSOLUTAS:
 * 1. Guardar un tema NO lo aplica a nadie
 * 2. Los temas 'system' son read-only
 * 3. Fail-open en todos los puntos
 */
export const themeRepository = {
  /**
   * Obtiene todos los temas
   * @param {object} filters - Filtros opcionales
   * @param {string} filters.source - Filtrar por source ('system', 'custom', 'ai')
   * @param {string} filters.status - Filtrar por status ('active', 'archived', 'draft')
   * @returns {Promise<Array>} Array de temas
   */
  async findAll(filters = {}) {
    try {
      let sql = 'SELECT * FROM theme_definitions WHERE 1=1';
      const params = [];
      let paramIndex = 1;

      if (filters.source) {
        sql += ` AND source = $${paramIndex}`;
        params.push(filters.source);
        paramIndex++;
      }

      if (filters.status) {
        sql += ` AND status = $${paramIndex}`;
        params.push(filters.status);
        paramIndex++;
      }

      sql += ' ORDER BY created_at DESC';

      const result = await query(sql, params);
      return result.rows;
    } catch (error) {
      console.error('[ThemeRepository] Error obteniendo temas:', error);
      return []; // Fail-open
    }
  },

  /**
   * Obtiene un tema por ID
   * @param {number} id - ID del tema
   * @returns {Promise<object|null>} Tema o null
   */
  async findById(id) {
    try {
      const result = await query(
        'SELECT * FROM theme_definitions WHERE id = $1',
        [id]
      );
      return result.rows[0] || null;
    } catch (error) {
      console.error('[ThemeRepository] Error obteniendo tema por ID:', error);
      return null; // Fail-open
    }
  },

  /**
   * Obtiene un tema por key
   * @param {string} key - Clave del tema
   * @returns {Promise<object|null>} Tema o null
   */
  async findByKey(key) {
    try {
      const result = await query(
        'SELECT * FROM theme_definitions WHERE key = $1',
        [key]
      );
      return result.rows[0] || null;
    } catch (error) {
      console.error('[ThemeRepository] Error obteniendo tema por key:', error);
      return null; // Fail-open
    }
  },

  /**
   * Crea un nuevo tema
   * @param {object} themeData - Datos del tema
   * @param {string} themeData.key - Clave única
   * @param {string} themeData.name - Nombre
   * @param {string} [themeData.description] - Descripción
   * @param {string} [themeData.contractVersion='v1'] - Versión del contrato
   * @param {object} themeData.values - Valores CSS (JSONB)
   * @param {string} [themeData.source='custom'] - Origen ('custom', 'ai')
   * @param {object} [themeData.meta={}] - Metadata
   * @param {string} [themeData.status='active'] - Estado
   * @returns {Promise<object>} Tema creado
   */
  async create(themeData) {
    try {
      const {
        key,
        name,
        description = null,
        contractVersion = 'v1',
        values = {},
        source = 'custom',
        meta = {},
        status = 'active'
      } = themeData;

      // Validar que no sea 'system' (solo read-only)
      if (source === 'system') {
        throw new Error('No se pueden crear temas con source="system"');
      }

      const result = await query(
        `INSERT INTO theme_definitions 
         (key, name, description, contract_version, values, source, meta, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [key, name, description, contractVersion, JSON.stringify(values), source, JSON.stringify(meta), status]
      );

      return result.rows[0];
    } catch (error) {
      console.error('[ThemeRepository] Error creando tema:', error);
      throw error;
    }
  },

  /**
   * Actualiza un tema existente
   * @param {number} id - ID del tema
   * @param {object} updates - Campos a actualizar
   * @returns {Promise<object|null>} Tema actualizado o null
   */
  async update(id, updates) {
    try {
      // Verificar que el tema existe y no es 'system'
      const existing = await this.findById(id);
      if (!existing) {
        return null;
      }

      if (existing.source === 'system') {
        throw new Error('No se pueden modificar temas del sistema');
      }

      // Construir query dinámica
      const fields = [];
      const values = [];
      let paramIndex = 1;

      if (updates.name !== undefined) {
        fields.push(`name = $${paramIndex}`);
        values.push(updates.name);
        paramIndex++;
      }

      if (updates.description !== undefined) {
        fields.push(`description = $${paramIndex}`);
        values.push(updates.description);
        paramIndex++;
      }

      if (updates.values !== undefined) {
        fields.push(`values = $${paramIndex}`);
        values.push(JSON.stringify(updates.values));
        paramIndex++;
      }

      if (updates.meta !== undefined) {
        fields.push(`meta = $${paramIndex}`);
        values.push(JSON.stringify(updates.meta));
        paramIndex++;
      }

      if (updates.status !== undefined) {
        fields.push(`status = $${paramIndex}`);
        values.push(updates.status);
        paramIndex++;
      }

      if (fields.length === 0) {
        return existing; // No hay cambios
      }

      // Añadir updated_at
      fields.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(id);

      const sql = `
        UPDATE theme_definitions 
        SET ${fields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await query(sql, values);
      return result.rows[0] || null;
    } catch (error) {
      console.error('[ThemeRepository] Error actualizando tema:', error);
      throw error;
    }
  },

  /**
   * Archiva un tema (cambia status a 'archived')
   * @param {number} id - ID del tema
   * @returns {Promise<boolean>} true si se archivó, false si no existe o es system
   */
  async archive(id) {
    try {
      const existing = await this.findById(id);
      if (!existing || existing.source === 'system') {
        return false;
      }

      await query(
        'UPDATE theme_definitions SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        ['archived', id]
      );

      return true;
    } catch (error) {
      console.error('[ThemeRepository] Error archivando tema:', error);
      return false; // Fail-open
    }
  },

  /**
   * Elimina un tema (solo custom/ai, nunca system)
   * @param {number} id - ID del tema
   * @returns {Promise<boolean>} true si se eliminó, false si no existe o es system
   */
  async delete(id) {
    try {
      const existing = await this.findById(id);
      if (!existing || existing.source === 'system') {
        return false;
      }

      await query('DELETE FROM theme_definitions WHERE id = $1', [id]);
      return true;
    } catch (error) {
      console.error('[ThemeRepository] Error eliminando tema:', error);
      return false; // Fail-open
    }
  }
};










