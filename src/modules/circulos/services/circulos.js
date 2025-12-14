// src/modules/circulos/services/circulos.js
// Servicio para Círculos Auri - Energía Grupal Compartida

import { query } from '../../../../database/pg.js';
import { analytics } from '../../../services/analytics.js';

/**
 * Crea un nuevo círculo Auri
 * @param {Object} circuloData 
 * @returns {Promise<Object|null>}
 */
export async function crearCirculo(circuloData) {
  try {
    const { codigo, nombre, descripcion, aspecto_principal, fecha_inicio, fecha_fin } = circuloData;
    
    const result = await query(`
      INSERT INTO circulos_auri (codigo, nombre, descripcion, aspecto_principal, fecha_inicio, fecha_fin, activo)
      VALUES ($1, $2, $3, $4, $5, $6, true)
      RETURNING *
    `, [codigo, nombre, descripcion, aspecto_principal, fecha_inicio, fecha_fin]);

    await analytics.registrarEvento({
      tipo_evento: 'circulo_auri_creado',
      metadata: { circulo_id: result.rows[0].id, codigo }
    });

    return result.rows[0];
  } catch (error) {
    console.error('Error creando círculo Auri:', error);
    return null;
  }
}

/**
 * Añade un alumno a un círculo
 * @param {number} circuloId 
 * @param {number} alumnoId 
 * @param {string} rol 
 * @returns {Promise<boolean>}
 */
export async function añadirMiembro(circuloId, alumnoId, rol = 'miembro') {
  try {
    await query(`
      INSERT INTO circulos_auri_miembros (circulo_id, alumno_id, rol)
      VALUES ($1, $2, $3)
      ON CONFLICT (circulo_id, alumno_id) DO UPDATE SET rol = EXCLUDED.rol
    `, [circuloId, alumnoId, rol]);

    await analytics.registrarEvento({
      alumno_id: alumnoId,
      tipo_evento: 'circulo_miembro_añadido',
      metadata: { circulo_id: circuloId, rol }
    });

    return true;
  } catch (error) {
    console.error('Error añadiendo miembro:', error);
    return false;
  }
}

/**
 * Registra una práctica en un círculo
 * @param {number} practicaId 
 * @param {number} alumnoId 
 * @param {string} aspecto 
 * @returns {Promise<boolean>}
 */
export async function registrarPracticaEnCirculo(practicaId, alumnoId, aspecto) {
  try {
    // Buscar círculos activos del aspecto
    const circulos = await query(`
      SELECT id FROM circulos_auri
      WHERE activo = true 
        AND aspecto_principal = $1
        AND (fecha_inicio IS NULL OR fecha_inicio <= NOW())
        AND (fecha_fin IS NULL OR fecha_fin >= NOW())
    `, [aspecto]);

    // Verificar si el alumno es miembro
    for (const circulo of circulos.rows) {
      const esMiembro = await query(`
        SELECT 1 FROM circulos_auri_miembros
        WHERE circulo_id = $1 AND alumno_id = $2
      `, [circulo.id, alumnoId]);

      if (esMiembro.rows.length > 0) {
        // Actualizar métricas del día
        await query(`
          INSERT INTO circulos_auri_metricas (circulo_id, fecha, practicas_totales)
          VALUES ($1, CURRENT_DATE, 1)
          ON CONFLICT (circulo_id, fecha) DO UPDATE
          SET practicas_totales = circulos_auri_metricas.practicas_totales + 1
        `, [circulo.id]);

        await analytics.registrarEvento({
          alumno_id: alumnoId,
          tipo_evento: 'circulo_practica_registrada',
          metadata: { circulo_id: circulo.id, practica_id: practicaId }
        });
      }
    }

    return true;
  } catch (error) {
    console.error('Error registrando práctica en círculo:', error);
    return false;
  }
}

/**
 * Obtiene métricas de un círculo
 * @param {number} circuloId 
 * @param {number} dias 
 * @returns {Promise<Object>}
 */
export async function getMetricasCirculo(circuloId, dias = 30) {
  try {
    const result = await query(`
      SELECT 
        SUM(practicas_totales) as total_practicas,
        AVG(energia_media) as energia_promedio,
        COUNT(*) as dias_activos
      FROM circulos_auri_metricas
      WHERE circulo_id = $1
        AND fecha >= CURRENT_DATE - INTERVAL '${dias} days'
    `, [circuloId]);

    const miembros = await query(`
      SELECT COUNT(*) as total_miembros
      FROM circulos_auri_miembros
      WHERE circulo_id = $1
    `, [circuloId]);

    return {
      practicas_totales: parseInt(result.rows[0].total_practicas) || 0,
      energia_promedio: parseFloat(result.rows[0].energia_promedio) || 0,
      dias_activos: parseInt(result.rows[0].dias_activos) || 0,
      total_miembros: parseInt(miembros.rows[0].total_miembros) || 0
    };
  } catch (error) {
    console.error('Error obteniendo métricas:', error);
    return { practicas_totales: 0, energia_promedio: 0, dias_activos: 0, total_miembros: 0 };
  }
}

/**
 * Obtiene círculos activos
 * @returns {Promise<Array>}
 */
export async function getCirculosActivos() {
  try {
    const result = await query(`
      SELECT c.*, 
        COUNT(DISTINCT m.alumno_id) as total_miembros
      FROM circulos_auri c
      LEFT JOIN circulos_auri_miembros m ON c.id = m.circulo_id
      WHERE c.activo = true
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `);

    return result.rows;
  } catch (error) {
    console.error('Error obteniendo círculos activos:', error);
    return [];
  }
}



