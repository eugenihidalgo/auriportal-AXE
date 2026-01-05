// src/infra/repos/pde-transmutation-item-groups-repo-pg.js
// Repositorio para pde_transmutation_item_groups (SOT de grupos de items)

import { query } from '../../../database/pg.js';
import { logInfo, logError } from '../../core/observability/logger.js';
import { getRequestId } from '../../core/observability/request-context.js';

// Singleton
let defaultRepo = null;

export class PdeTransmutationItemGroupsRepoPg {
  /**
   * Lista grupos activos
   * 
   * @returns {Promise<Array<{value: string}>>} Array de grupos activos
   */
  async listActiveGroups() {
    const traceId = getRequestId();
    
    try {
      const result = await query(`
        SELECT value
        FROM pde_transmutation_item_groups
        WHERE status = 'active'
        ORDER BY value ASC
      `);
      
      const groups = result.rows.map(row => ({ value: row.value }));
      
      logInfo('PdeTransmutationItemGroupsRepo', 'listActiveGroups completado', {
        traceId,
        count: groups.length
      });
      
      return groups;
    } catch (error) {
      logError('PdeTransmutationItemGroupsRepo', 'Error en listActiveGroups', {
        traceId,
        error: error.message,
        code: error.code,
        stack: error.stack
      });
      return [];
    }
  }

  /**
   * Asegura que un grupo existe (idempotente)
   * Si no existe, lo crea con status='active'
   * 
   * @param {string} value - Valor del grupo
   * @returns {Promise<{value: string}>} Grupo creado o existente
   */
  async ensureGroup(value) {
    if (!value || typeof value !== 'string' || value.trim() === '') {
      throw new Error('value debe ser un string no vacío');
    }

    const traceId = getRequestId();
    const trimmedValue = value.trim();
    
    try {
      // INSERT ... ON CONFLICT DO NOTHING (idempotente)
      const result = await query(`
        INSERT INTO pde_transmutation_item_groups (value, status)
        VALUES ($1, 'active')
        ON CONFLICT (value) DO NOTHING
        RETURNING value
      `, [trimmedValue]);

      if (result.rows.length > 0) {
        // Se creó nuevo
        logInfo('PdeTransmutationItemGroupsRepo', 'Grupo creado', {
          traceId,
          value: trimmedValue
        });
      } else {
        // Ya existía, verificar que esté active
        const existing = await query(`
          SELECT value, status
          FROM pde_transmutation_item_groups
          WHERE value = $1
        `, [trimmedValue]);
        
        if (existing.rows.length > 0 && existing.rows[0].status !== 'active') {
          // Reactivar si estaba deprecated
          await query(`
            UPDATE pde_transmutation_item_groups
            SET status = 'active', updated_at = now()
            WHERE value = $1
          `, [trimmedValue]);
          
          logInfo('PdeTransmutationItemGroupsRepo', 'Grupo reactivado', {
            traceId,
            value: trimmedValue
          });
        }
      }

      return { value: trimmedValue };
    } catch (error) {
      logError('PdeTransmutationItemGroupsRepo', 'Error en ensureGroup', {
        traceId,
        error: error.message,
        code: error.code,
        stack: error.stack,
        value: trimmedValue
      });
      throw error;
    }
  }

  /**
   * Depreca un grupo (opcional, no necesario para esta fase)
   * 
   * @param {string} value - Valor del grupo
   * @returns {Promise<boolean>} true si se deprecó, false si no existía
   */
  async deprecateGroup(value) {
    if (!value || typeof value !== 'string' || value.trim() === '') {
      return false;
    }

    const traceId = getRequestId();
    const trimmedValue = value.trim();
    
    try {
      const result = await query(`
        UPDATE pde_transmutation_item_groups
        SET status = 'deprecated', updated_at = now()
        WHERE value = $1 AND status = 'active'
      `, [trimmedValue]);

      const updated = result.rowCount > 0;
      
      if (updated) {
        logInfo('PdeTransmutationItemGroupsRepo', 'Grupo deprecado', {
          traceId,
          value: trimmedValue
        });
      }

      return updated;
    } catch (error) {
      logError('PdeTransmutationItemGroupsRepo', 'Error en deprecateGroup', {
        traceId,
        error: error.message,
        value: trimmedValue
      });
      return false;
    }
  }
}

/**
 * Obtiene instancia singleton del repo
 */
export function getDefaultPdeTransmutationItemGroupsRepo() {
  if (!defaultRepo) {
    defaultRepo = new PdeTransmutationItemGroupsRepoPg();
  }
  return defaultRepo;
}
