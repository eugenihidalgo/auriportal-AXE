// src/services/analytics.js
// Servicio de Analytics Centralizado para AuriPortal

import { query } from '../../database/pg.js';
import { alumnos } from '../../database/pg.js';

export const analytics = {
  /**
   * Registrar un evento de analytics
   * @param {Object} params - Parámetros del evento
   * @param {number} params.alumno_id - ID del alumno (opcional)
   * @param {string} params.tipo_evento - Tipo de evento
   * @param {Date} params.fecha - Fecha del evento (opcional, por defecto ahora)
   * @param {Object} params.metadata - Metadatos adicionales (opcional)
   */
  async registrarEvento({ alumno_id, tipo_evento, fecha, metadata = {} }) {
    try {
      await query(
        `INSERT INTO analytics_eventos (alumno_id, tipo_evento, fecha, metadata)
         VALUES ($1, $2, $3, $4)`,
        [
          alumno_id || null,
          tipo_evento,
          fecha || new Date(),
          JSON.stringify(metadata)
        ]
      );
      
      console.log(`📊 Evento registrado: ${tipo_evento}${alumno_id ? ` (alumno ${alumno_id})` : ''}`);
    } catch (error) {
      console.error('❌ Error registrando evento de analytics:', error);
      // No lanzar error para no romper el flujo principal
    }
  },

  /**
   * Obtener eventos de un alumno
   * @param {number} alumnoId - ID del alumno
   * @param {string} tipoEvento - Tipo de evento a filtrar (opcional)
   * @param {Date} fechaDesde - Fecha desde (opcional)
   * @param {Date} fechaHasta - Fecha hasta (opcional)
   * @param {number} limit - Límite de resultados (opcional, por defecto 100)
   */
  async getEventosAlumno(alumnoId, tipoEvento = null, fechaDesde = null, fechaHasta = null, limit = 100) {
    try {
      let where = ['alumno_id = $1'];
      let params = [alumnoId];
      let paramIndex = 2;

      if (tipoEvento) {
        where.push(`tipo_evento = $${paramIndex}`);
        params.push(tipoEvento);
        paramIndex++;
      }

      if (fechaDesde) {
        where.push(`fecha >= $${paramIndex}`);
        params.push(fechaDesde);
        paramIndex++;
      }

      if (fechaHasta) {
        where.push(`fecha <= $${paramIndex}`);
        params.push(fechaHasta);
        paramIndex++;
      }

      params.push(limit);

      const result = await query(
        `SELECT * FROM analytics_eventos 
         WHERE ${where.join(' AND ')} 
         ORDER BY fecha DESC 
         LIMIT $${paramIndex}`,
        params
      );

      return result.rows.map(row => ({
        ...row,
        metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata
      }));
    } catch (error) {
      console.error('❌ Error obteniendo eventos de alumno:', error);
      return [];
    }
  },

  /**
   * Obtener eventos por tipo
   * @param {string} tipoEvento - Tipo de evento
   * @param {Date} fechaDesde - Fecha desde (opcional)
   * @param {Date} fechaHasta - Fecha hasta (opcional)
   * @param {number} limit - Límite de resultados (opcional)
   */
  async getEventosPorTipo(tipoEvento, fechaDesde = null, fechaHasta = null, limit = 1000) {
    try {
      let where = ['tipo_evento = $1'];
      let params = [tipoEvento];
      let paramIndex = 2;

      if (fechaDesde) {
        where.push(`fecha >= $${paramIndex}`);
        params.push(fechaDesde);
        paramIndex++;
      }

      if (fechaHasta) {
        where.push(`fecha <= $${paramIndex}`);
        params.push(fechaHasta);
        paramIndex++;
      }

      params.push(limit);

      const result = await query(
        `SELECT * FROM analytics_eventos 
         WHERE ${where.join(' AND ')} 
         ORDER BY fecha DESC 
         LIMIT $${paramIndex}`,
        params
      );

      return result.rows.map(row => ({
        ...row,
        metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata
      }));
    } catch (error) {
      console.error('❌ Error obteniendo eventos por tipo:', error);
      return [];
    }
  },

  /**
   * Calcular y guardar resumen diario
   * @param {Date} fecha - Fecha para calcular (opcional, por defecto hoy)
   */
  async calcularResumenDiario(fecha = new Date()) {
    try {
      const fechaStr = fecha.toISOString().split('T')[0];
      
      // Alumnos activos (con práctica en el día)
      const alumnosActivosResult = await query(
        `SELECT COUNT(DISTINCT alumno_id) as total
         FROM practicas
         WHERE DATE(fecha) = $1`,
        [fechaStr]
      );
      const alumnosActivos = parseInt(alumnosActivosResult.rows[0]?.total || 0);

      // Prácticas totales
      const practicasTotalesResult = await query(
        `SELECT COUNT(*) as total
         FROM practicas
         WHERE DATE(fecha) = $1`,
        [fechaStr]
      );
      const practicasTotales = parseInt(practicasTotalesResult.rows[0]?.total || 0);

      // Energía media (si existe el campo, por ahora será 0)
      const energiaMedia = 0; // Se implementará cuando se añada el campo

      // Nivel promedio
      const nivelPromedioResult = await query(
        `SELECT AVG(nivel_actual) as promedio
         FROM alumnos
         WHERE estado_suscripcion = 'activa'`,
        []
      );
      const nivelPromedio = parseFloat(nivelPromedioResult.rows[0]?.promedio || 0);

      // Fase predominante
      const fasePredominanteResult = await query(
        `SELECT 
           CASE
             WHEN nivel_actual BETWEEN 1 AND 6 THEN 'sanación'
             WHEN nivel_actual BETWEEN 7 AND 9 THEN 'sanación avanzada'
             WHEN nivel_actual BETWEEN 10 AND 15 THEN 'canalización'
             WHEN nivel_actual > 15 THEN 'creación'
             ELSE 'sanación'
           END as fase,
           COUNT(*) as count
         FROM alumnos
         WHERE estado_suscripcion = 'activa'
         GROUP BY fase
         ORDER BY count DESC
         LIMIT 1`,
        []
      );
      const fasePredominante = fasePredominanteResult.rows[0]?.fase || null;

      // Upsert resumen
      await query(
        `INSERT INTO analytics_resumen_diario 
         (fecha, alumnos_activos, practicas_totales, energia_media, nivel_promedio, fase_predominante)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (fecha) DO UPDATE SET
           alumnos_activos = EXCLUDED.alumnos_activos,
           practicas_totales = EXCLUDED.practicas_totales,
           energia_media = EXCLUDED.energia_media,
           nivel_promedio = EXCLUDED.nivel_promedio,
           fase_predominante = EXCLUDED.fase_predominante,
           updated_at = CURRENT_TIMESTAMP`,
        [
          fechaStr,
          alumnosActivos,
          practicasTotales,
          energiaMedia,
          nivelPromedio,
          fasePredominante
        ]
      );

      console.log(`✅ Resumen diario calculado para ${fechaStr}`);
    } catch (error) {
      console.error('❌ Error calculando resumen diario:', error);
    }
  },

  /**
   * Obtener resumen diario
   * @param {Date} fechaDesde - Fecha desde
   * @param {Date} fechaHasta - Fecha hasta
   */
  async getResumenDiario(fechaDesde, fechaHasta) {
    try {
      const result = await query(
        `SELECT * FROM analytics_resumen_diario
         WHERE fecha >= $1 AND fecha <= $2
         ORDER BY fecha DESC`,
        [fechaDesde.toISOString().split('T')[0], fechaHasta.toISOString().split('T')[0]]
      );

      return result.rows.map(row => ({
        ...row,
        metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata
      }));
    } catch (error) {
      console.error('❌ Error obteniendo resumen diario:', error);
      return [];
    }
  },

  /**
   * Obtener estadísticas generales
   */
  async getEstadisticasGenerales() {
    try {
      // Total de eventos
      const totalEventos = await query(
        `SELECT COUNT(*) as total FROM analytics_eventos`
      );

      // Eventos por tipo
      const eventosPorTipo = await query(
        `SELECT tipo_evento, COUNT(*) as total
         FROM analytics_eventos
         GROUP BY tipo_evento
         ORDER BY total DESC`
      );

      // Eventos últimos 7 días
      const eventosUltimos7Dias = await query(
        `SELECT COUNT(*) as total
         FROM analytics_eventos
         WHERE fecha >= NOW() - INTERVAL '7 days'`
      );

      // Eventos últimos 30 días
      const eventosUltimos30Dias = await query(
        `SELECT COUNT(*) as total
         FROM analytics_eventos
         WHERE fecha >= NOW() - INTERVAL '30 days'`
      );

      return {
        total_eventos: parseInt(totalEventos.rows[0]?.total || 0),
        eventos_por_tipo: eventosPorTipo.rows,
        eventos_ultimos_7_dias: parseInt(eventosUltimos7Dias.rows[0]?.total || 0),
        eventos_ultimos_30_dias: parseInt(eventosUltimos30Dias.rows[0]?.total || 0)
      };
    } catch (error) {
      console.error('❌ Error obteniendo estadísticas generales:', error);
      return {
        total_eventos: 0,
        eventos_por_tipo: [],
        eventos_ultimos_7_dias: 0,
        eventos_ultimos_30_dias: 0
      };
    }
  }
};




