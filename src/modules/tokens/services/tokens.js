// src/modules/tokens/services/tokens.js
// Servicio para Token AURI (Sistema de tokens en beta)

import { query } from '../../../../database/pg.js';
import { analytics } from '../../../services/analytics.js';

/**
 * Obtiene el balance de tokens de un alumno
 * @param {number} alumnoId 
 * @returns {Promise<Object>}
 */
export async function getBalanceTokens(alumnoId) {
  try {
    const result = await query(`
      SELECT * FROM tokens_auri WHERE alumno_id = $1
    `, [alumnoId]);

    if (result.rows.length === 0) {
      // Crear balance inicial
      await query(`
        INSERT INTO tokens_auri (alumno_id, balance, total_ganados, total_gastados)
        VALUES ($1, 0, 0, 0)
      `, [alumnoId]);

      return { balance: 0, total_ganados: 0, total_gastados: 0 };
    }

    return result.rows[0];
  } catch (error) {
    console.error('Error obteniendo balance de tokens:', error);
    return { balance: 0, total_ganados: 0, total_gastados: 0 };
  }
}

/**
 * Añade tokens a un alumno
 * @param {number} alumnoId 
 * @param {number} cantidad 
 * @param {string} concepto 
 * @returns {Promise<boolean>}
 */
export async function añadirTokens(alumnoId, cantidad, concepto = 'Sin concepto') {
  try {
    // Actualizar balance
    await query(`
      INSERT INTO tokens_auri (alumno_id, balance, total_ganados)
      VALUES ($1, $2, $2)
      ON CONFLICT (alumno_id) DO UPDATE
      SET balance = tokens_auri.balance + $2,
          total_ganados = tokens_auri.total_ganados + $2,
          updated_at = CURRENT_TIMESTAMP
    `, [alumnoId, cantidad]);

    // Registrar transacción
    await query(`
      INSERT INTO tokens_transacciones (alumno_id, tipo, cantidad, concepto)
      VALUES ($1, 'ganado', $2, $3)
    `, [alumnoId, cantidad, concepto]);

    await analytics.registrarEvento({
      alumno_id: alumnoId,
      tipo_evento: 'tokens_ganados',
      metadata: { cantidad, concepto }
    });

    return true;
  } catch (error) {
    console.error('Error añadiendo tokens:', error);
    return false;
  }
}

/**
 * Gasta tokens de un alumno
 * @param {number} alumnoId 
 * @param {number} cantidad 
 * @param {string} concepto 
 * @returns {Promise<boolean>}
 */
export async function gastarTokens(alumnoId, cantidad, concepto = 'Compra') {
  try {
    const balance = await getBalanceTokens(alumnoId);

    if (balance.balance < cantidad) {
      throw new Error('Balance insuficiente');
    }

    // Actualizar balance
    await query(`
      UPDATE tokens_auri
      SET balance = balance - $2,
          total_gastados = total_gastados + $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE alumno_id = $1
    `, [alumnoId, cantidad]);

    // Registrar transacción
    await query(`
      INSERT INTO tokens_transacciones (alumno_id, tipo, cantidad, concepto)
      VALUES ($1, 'gastado', $2, $3)
    `, [alumnoId, cantidad, concepto]);

    await analytics.registrarEvento({
      alumno_id: alumnoId,
      tipo_evento: 'tokens_gastados',
      metadata: { cantidad, concepto }
    });

    return true;
  } catch (error) {
    console.error('Error gastando tokens:', error);
    return false;
  }
}

/**
 * Obtiene el historial de transacciones de un alumno
 * @param {number} alumnoId 
 * @param {number} limit 
 * @returns {Promise<Array>}
 */
export async function getHistorialTransacciones(alumnoId, limit = 50) {
  try {
    const result = await query(`
      SELECT * FROM tokens_transacciones
      WHERE alumno_id = $1
      ORDER BY fecha DESC
      LIMIT $2
    `, [alumnoId, limit]);

    return result.rows;
  } catch (error) {
    console.error('Error obteniendo historial transacciones:', error);
    return [];
  }
}



