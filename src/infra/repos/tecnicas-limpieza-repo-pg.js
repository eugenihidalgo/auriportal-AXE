// src/infra/repos/tecnicas-limpieza-repo-pg.js
// Implementación PostgreSQL del Repositorio de Técnicas de Limpieza
//
// Esta es la implementación concreta que encapsula TODAS las queries
// relacionadas con tecnicas_limpieza en PostgreSQL.
// 
// REGLAS:
// - Este es el ÚNICO lugar donde se importa database/pg.js para técnicas de limpieza
// - Retorna objetos raw de PostgreSQL (sin transformación)
// - Todos los métodos aceptan client opcional para transacciones
// - Usa status ('active'/'archived') NO activo (boolean)
// - Ordenamiento canónico: level ASC, created_at ASC

import { query } from '../../../database/pg.js';
import { TecnicasLimpiezaRepo } from '../../core/repos/tecnicas-limpieza-repo.js';

// Singleton para evitar múltiples instancias
let defaultRepo = null;

/**
 * Repositorio de Técnicas de Limpieza - Implementación PostgreSQL
 * 
 * Encapsula todas las operaciones de base de datos relacionadas con técnicas de limpieza.
 * Retorna objetos raw de PostgreSQL (sin transformación).
 * 
 * Todos los métodos aceptan un parámetro opcional `client` para transacciones.
 * Si se proporciona, usa ese client; si no, usa el pool por defecto.
 */
export class TecnicasLimpiezaRepoPg extends TecnicasLimpiezaRepo {
  /**
   * Lista técnicas con filtros
   */
  async list(filters = {}, client = null) {
    const { onlyActive = true, nivel, nivelMax, aplica_energias_indeseables, aplica_limpiezas_recurrentes } = filters;
    const queryFn = client ? client.query.bind(client) : query;

    let sql = 'SELECT * FROM tecnicas_limpieza';
    const params = [];
    const conditions = [];

    if (onlyActive) {
      conditions.push(`status = 'active'`);
    }

    if (nivel !== undefined) {
      conditions.push(`nivel = $${params.length + 1}`);
      params.push(nivel);
    }

    if (nivelMax !== undefined) {
      conditions.push(`nivel <= $${params.length + 1}`);
      params.push(nivelMax);
    }

    if (aplica_energias_indeseables !== undefined) {
      conditions.push(`aplica_energias_indeseables = $${params.length + 1}`);
      params.push(aplica_energias_indeseables);
    }

    if (aplica_limpiezas_recurrentes !== undefined) {
      conditions.push(`aplica_limpiezas_recurrentes = $${params.length + 1}`);
      params.push(aplica_limpiezas_recurrentes);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    // Ordenamiento canónico: level ASC, created_at ASC
    sql += ' ORDER BY nivel ASC, created_at ASC';

    const result = await queryFn(sql, params);
    return result.rows || [];
  }

  /**
   * Obtiene una técnica por ID
   */
  async getById(id, client = null) {
    if (!id) return null;

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      'SELECT * FROM tecnicas_limpieza WHERE id = $1',
      [id]
    );

    return result.rows[0] || null;
  }

  /**
   * Crea una nueva técnica
   */
  async create(tecnicaData, client = null) {
    if (!tecnicaData.nombre) {
      throw new Error('nombre es requerido');
    }
    if (tecnicaData.nivel === undefined || tecnicaData.nivel === null) {
      throw new Error('nivel es requerido');
    }

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `INSERT INTO tecnicas_limpieza (
        nombre, nivel, descripcion, estimated_duration,
        aplica_energias_indeseables, aplica_limpiezas_recurrentes,
        prioridad, is_obligatoria, status,
        video_resource_id, audio_resource_id, image_resource_id, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        tecnicaData.nombre,
        tecnicaData.nivel,
        tecnicaData.descripcion || null,
        tecnicaData.estimated_duration || null,
        tecnicaData.aplica_energias_indeseables || false,
        tecnicaData.aplica_limpiezas_recurrentes || false,
        tecnicaData.prioridad || 'media',
        tecnicaData.is_obligatoria || false,
        tecnicaData.status || 'active',
        tecnicaData.video_resource_id || null,
        tecnicaData.audio_resource_id || null,
        tecnicaData.image_resource_id || null,
        tecnicaData.metadata ? JSON.stringify(tecnicaData.metadata) : '{}'
      ]
    );

    return result.rows[0];
  }

  /**
   * Actualiza una técnica
   */
  async update(id, patch, client = null) {
    if (!id) {
      throw new Error('id es requerido');
    }

    const queryFn = client ? client.query.bind(client) : query;

    // Construir SET dinámicamente
    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (patch.nombre !== undefined) {
      updates.push(`nombre = $${paramIndex++}`);
      params.push(patch.nombre);
    }
    if (patch.nivel !== undefined) {
      updates.push(`nivel = $${paramIndex++}`);
      params.push(patch.nivel);
    }
    if (patch.descripcion !== undefined) {
      updates.push(`descripcion = $${paramIndex++}`);
      params.push(patch.descripcion);
    }
    if (patch.estimated_duration !== undefined) {
      updates.push(`estimated_duration = $${paramIndex++}`);
      params.push(patch.estimated_duration);
    }
    if (patch.aplica_energias_indeseables !== undefined) {
      updates.push(`aplica_energias_indeseables = $${paramIndex++}`);
      params.push(patch.aplica_energias_indeseables);
    }
    if (patch.aplica_limpiezas_recurrentes !== undefined) {
      updates.push(`aplica_limpiezas_recurrentes = $${paramIndex++}`);
      params.push(patch.aplica_limpiezas_recurrentes);
    }
    if (patch.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      params.push(patch.status);
    }
    if (patch.prioridad !== undefined) {
      updates.push(`prioridad = $${paramIndex++}`);
      params.push(patch.prioridad);
    }
    if (patch.is_obligatoria !== undefined) {
      updates.push(`is_obligatoria = $${paramIndex++}`);
      params.push(patch.is_obligatoria);
    }
    if (patch.video_resource_id !== undefined) {
      updates.push(`video_resource_id = $${paramIndex++}`);
      params.push(patch.video_resource_id || null);
    }
    if (patch.audio_resource_id !== undefined) {
      updates.push(`audio_resource_id = $${paramIndex++}`);
      params.push(patch.audio_resource_id || null);
    }
    if (patch.image_resource_id !== undefined) {
      updates.push(`image_resource_id = $${paramIndex++}`);
      params.push(patch.image_resource_id || null);
    }
    if (patch.metadata !== undefined) {
      updates.push(`metadata = $${paramIndex++}::jsonb`);
      params.push(patch.metadata ? JSON.stringify(patch.metadata) : '{}');
    }

    if (updates.length === 0) {
      // No hay nada que actualizar, retornar la técnica actual
      return await this.getById(id, client);
    }

    params.push(id);
    const sql = `
      UPDATE tecnicas_limpieza 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await queryFn(sql, params);
    return result.rows[0] || null;
  }

  /**
   * Archiva una técnica (soft delete)
   */
  async archive(id, client = null) {
    if (!id) {
      throw new Error('id es requerido');
    }

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `UPDATE tecnicas_limpieza 
       SET status = 'archived'
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    return result.rows[0] || null;
  }

  /**
   * Elimina físicamente una técnica (delete físico)
   */
  async delete(id, client = null) {
    if (!id) {
      throw new Error('id es requerido');
    }

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `DELETE FROM tecnicas_limpieza 
       WHERE id = $1
       RETURNING id`,
      [id]
    );

    return result.rows.length > 0;
  }

  /**
   * Obtiene las clasificaciones de una técnica
   */
  async getClasificaciones(tecnicaId, client = null) {
    if (!tecnicaId) {
      return [];
    }

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      'SELECT * FROM get_tecnicas_limpieza_classifications($1)',
      [tecnicaId]
    );

    return result.rows || [];
  }

  /**
   * Establece las clasificaciones de una técnica (reemplaza todas)
   */
  async setClasificaciones(tecnicaId, clasificaciones, client = null) {
    if (!tecnicaId) {
      throw new Error('tecnicaId es requerido');
    }

    const queryFn = client ? client.query.bind(client) : query;

    // Iniciar transacción si no se proporciona client
    const useTransaction = !client;
    if (useTransaction) {
      client = await query('BEGIN');
    }

    try {
      // 1. Eliminar todas las clasificaciones existentes
      await queryFn(
        'DELETE FROM tecnicas_limpieza_classifications WHERE tecnica_id = $1',
        [tecnicaId]
      );

      // 2. Para cada clasificación, asegurar que existe y asociarla
      for (const nombreClasificacion of clasificaciones) {
        if (!nombreClasificacion || !nombreClasificacion.trim()) {
          continue;
        }

        // Usar ensure_classification_term para crear/obtener el término (tipo 'tag')
        const termResult = await queryFn(
          'SELECT ensure_classification_term($1, $2) as term_id',
          ['tag', nombreClasificacion.trim()]
        );

        const termId = termResult.rows[0].term_id;

        // Asociar término a la técnica
        await queryFn(
          `INSERT INTO tecnicas_limpieza_classifications (tecnica_id, classification_term_id)
           VALUES ($1, $2)
           ON CONFLICT (tecnica_id, classification_term_id) DO NOTHING`,
          [tecnicaId, termId]
        );
      }

      if (useTransaction) {
        await queryFn('COMMIT');
      }

      // Retornar las clasificaciones actualizadas
      return await this.getClasificaciones(tecnicaId, client);
    } catch (error) {
      if (useTransaction) {
        await queryFn('ROLLBACK');
      }
      throw error;
    }
  }

  /**
   * Lista todas las clasificaciones disponibles
   */
  async listClasificacionesDisponibles(client = null) {
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      'SELECT * FROM list_tecnicas_limpieza_classifications_available()'
    );

    return result.rows || [];
  }
}

/**
 * Obtiene o crea la instancia singleton del repositorio
 */
export function getTecnicasLimpiezaRepo() {
  if (!defaultRepo) {
    defaultRepo = new TecnicasLimpiezaRepoPg();
  }
  return defaultRepo;
}

