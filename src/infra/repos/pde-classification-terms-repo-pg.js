// src/infra/repos/pde-classification-terms-repo-pg.js
// Implementación PostgreSQL del Repositorio de Términos de Clasificación Canónicos

import { query } from '../../../database/pg.js';
import { PdeClassificationTermsRepo } from '../../core/repos/pde-classification-terms-repo.js';

/**
 * Repositorio de Términos de Clasificación Canónicos - Implementación PostgreSQL
 */
export class PdeClassificationTermsRepoPg extends PdeClassificationTermsRepo {
  /**
   * Asegura que existe un término de clasificación (idempotente)
   */
  async ensureTerm(type, value, options = {}) {
    const { client } = options;
    const queryFn = client ? client.query.bind(client) : query;

    if (!type || !['key', 'subkey', 'tag'].includes(type)) {
      throw new Error(`Tipo inválido: ${type}. Debe ser 'key', 'subkey' o 'tag'`);
    }

    if (!value || typeof value !== 'string' || value.trim() === '') {
      throw new Error('Value debe ser una cadena no vacía');
    }

    const result = await queryFn(
      `SELECT ensure_classification_term($1, $2) as term_id`,
      [type, value.trim()]
    );

    return result.rows[0].term_id;
  }

  /**
   * Busca términos por tipo con autocomplete
   */
  async searchTerms(type, search = '', options = {}) {
    const { client } = options;
    const queryFn = client ? client.query.bind(client) : query;

    if (!type || !['key', 'subkey', 'tag'].includes(type)) {
      throw new Error(`Tipo inválido: ${type}`);
    }

    let sql = `
      SELECT id, type, value, normalized, created_at
      FROM pde_classification_terms
      WHERE type = $1
    `;
    const params = [type];

    if (search && search.trim()) {
      const normalizedSearch = search.trim().toLowerCase()
        .replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i')
        .replace(/ó/g, 'o').replace(/ú/g, 'u').replace(/ñ/g, 'n')
        .replace(/ü/g, 'u');
      
      sql += ` AND normalized LIKE $2`;
      params.push(`%${normalizedSearch}%`);
    }

    sql += ` ORDER BY value ASC LIMIT 50`;

    const result = await queryFn(sql, params);
    return result.rows;
  }

  /**
   * Obtiene un término por ID
   */
  async getTermById(termId) {
    if (!termId) return null;

    const result = await query(
      `SELECT id, type, value, normalized, created_at
       FROM pde_classification_terms
       WHERE id = $1`,
      [termId]
    );

    return result.rows[0] || null;
  }

  /**
   * Asocia un término a una lista
   */
  async associateTermToLista(listaId, termId) {
    if (!listaId || !termId) {
      throw new Error('listaId y termId son requeridos');
    }

    try {
      await query(
        `INSERT INTO transmutacion_lista_classifications (lista_id, classification_term_id)
         VALUES ($1, $2)
         ON CONFLICT (lista_id, classification_term_id) DO NOTHING`,
        [listaId, termId]
      );

      // Verificar si se insertó
      const check = await query(
        `SELECT 1 FROM transmutacion_lista_classifications
         WHERE lista_id = $1 AND classification_term_id = $2`,
        [listaId, termId]
      );

      return check.rows.length > 0;
    } catch (error) {
      // Si es foreign key constraint, el término o lista no existe
      if (error.code === '23503') {
        throw new Error('Término o lista no existe');
      }
      throw error;
    }
  }

  /**
   * Desasocia un término de una lista
   */
  async dissociateTermFromLista(listaId, termId) {
    if (!listaId || !termId) {
      throw new Error('listaId y termId son requeridos');
    }

    const result = await query(
      `DELETE FROM transmutacion_lista_classifications
       WHERE lista_id = $1 AND classification_term_id = $2`,
      [listaId, termId]
    );

    return result.rowCount > 0;
  }

  /**
   * Obtiene todos los términos asociados a una lista
   */
  async getTermsByLista(listaId) {
    if (!listaId) {
      throw new Error('listaId es requerido');
    }

    const result = await query(
      `SELECT ct.id, ct.type, ct.value, ct.normalized, ct.created_at
       FROM pde_classification_terms ct
       INNER JOIN transmutacion_lista_classifications tlc
         ON ct.id = tlc.classification_term_id
       WHERE tlc.lista_id = $1
       ORDER BY ct.type, ct.value ASC`,
      [listaId]
    );

    // Agrupar por tipo
    const grouped = {
      key: [],
      subkey: [],
      tag: []
    };

    result.rows.forEach(row => {
      if (grouped[row.type]) {
        grouped[row.type].push(row);
      }
    });

    return grouped;
  }
}


