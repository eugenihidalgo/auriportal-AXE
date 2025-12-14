// src/modules/admin-data.js
// Helpers para obtener datos del Admin Panel desde PostgreSQL
//
// REFACTOR: Usa pausa-v4.js en lugar de importar directamente database/pg.js para pausas

import { alumnos, frases, nivelesFases, rachaFases, query } from '../../database/pg.js';
import { calcularDiasPausados, findByAlumnoId } from './pausa-v4.js';
import { findByAlumnoId as findPracticasByAlumnoId } from './practice-v4.js';
import { getFasePorNivel } from './nivel-v4.js';
// Integración con Kajabi eliminada

/**
 * Obtiene estadísticas globales para el dashboard
 */
export async function getDashboardStats() {
  try {
    // Total de alumnos
    const totalAlumnos = await query('SELECT COUNT(*) as total FROM alumnos');
    const total = parseInt(totalAlumnos.rows[0].total);

    // Alumnos por estado
    const alumnosPorEstado = await query(`
      SELECT estado_suscripcion, COUNT(*) as count
      FROM alumnos
      GROUP BY estado_suscripcion
    `);
    const estados = {};
    alumnosPorEstado.rows.forEach(row => {
      estados[row.estado_suscripcion || 'activa'] = parseInt(row.count);
    });

    // Alumnos por fase
    const alumnosPorFase = await query(`
      SELECT 
        CASE
          WHEN nivel_actual BETWEEN 1 AND 6 THEN 'sanación'
          WHEN nivel_actual BETWEEN 7 AND 9 THEN 'sanación avanzada'
          WHEN nivel_actual BETWEEN 10 AND 15 THEN 'canalización'
          WHEN nivel_actual > 15 THEN 'creación'
          ELSE 'sanación'
        END as fase,
        COUNT(*) as count
      FROM alumnos
      GROUP BY fase
    `);
    const fases = {};
    alumnosPorFase.rows.forEach(row => {
      fases[row.fase] = parseInt(row.count);
    });

    // Últimas 10 prácticas
    const ultimasPracticas = await query(`
      SELECT 
        p.fecha,
        p.tipo,
        p.origen,
        p.duracion,
        a.email
      FROM practicas p
      JOIN alumnos a ON p.alumno_id = a.id
      ORDER BY p.fecha DESC
      LIMIT 10
    `);

    // Últimos 10 alumnos creados
    const ultimosAlumnos = await query(`
      SELECT 
        email,
        apodo,
        fecha_inscripcion,
        nivel_actual
      FROM alumnos
      ORDER BY created_at DESC
      LIMIT 10
    `);

    return {
      totalAlumnos: total,
      alumnosPorEstado: estados,
      alumnosPorFase: fases,
      ultimasPracticas: ultimasPracticas.rows,
      ultimosAlumnos: ultimosAlumnos.rows
    };
  } catch (error) {
    console.error('Error obteniendo estadísticas del dashboard:', error);
    throw error;
  }
}

/**
 * Obtiene lista de alumnos con filtros y ordenamiento
 */
export async function getAlumnosList(filters = {}, page = 1, limit = 50) {
  try {
    let whereConditions = [];
    let params = [];
    let paramIndex = 1;

    // Filtro por estado
    if (filters.estado) {
      whereConditions.push(`estado_suscripcion = $${paramIndex}`);
      params.push(filters.estado);
      paramIndex++;
    }

    // Filtro por nivel
    if (filters.nivel) {
      const nivel = parseInt(filters.nivel);
      if (!isNaN(nivel)) {
        whereConditions.push(`nivel_actual = $${paramIndex}`);
        params.push(nivel);
        paramIndex++;
      }
    }

    // Filtro por email/apodo (búsqueda)
    if (filters.search) {
      whereConditions.push(`(email ILIKE $${paramIndex} OR apodo ILIKE $${paramIndex})`);
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    // Contar total
    const countResult = await query(
      `SELECT COUNT(*) as total FROM alumnos ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);

    // Ordenamiento
    let orderBy = 'created_at DESC';
    const validSortFields = {
      'email': 'email',
      'apodo': 'apodo',
      'nivel': 'nivel_actual',
      'streak': 'streak',
      'estado': 'estado_suscripcion',
      'fecha_inscripcion': 'fecha_inscripcion',
      'fecha_ultima_practica': 'fecha_ultima_practica',
      'created_at': 'created_at'
    };
    
    if (filters.sortBy && validSortFields[filters.sortBy]) {
      const sortField = validSortFields[filters.sortBy];
      const sortOrder = filters.sortOrder === 'asc' ? 'ASC' : 'DESC';
      orderBy = `${sortField} ${sortOrder}`;
    }

    // Validar página y limit para evitar NaN
    const pageNum = (typeof page === 'number' && !isNaN(page) && page > 0) ? page : 1;
    const limitNum = (typeof limit === 'number' && !isNaN(limit) && limit > 0) ? limit : 50;
    
    // Obtener alumnos con paginación
    const offset = (pageNum - 1) * limitNum;
    const countParams = [...params];
    params.push(limitNum, offset);
    
    const alumnosResult = await query(`
      SELECT 
        id,
        email,
        apodo,
        nivel_actual,
        nivel_manual,
        streak,
        estado_suscripcion,
        fecha_inscripcion,
        fecha_ultima_practica,
        created_at
      FROM alumnos
      ${whereClause}
      ORDER BY ${orderBy}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, params);

    // Calcular fase de nivel y fase de racha para cada alumno
    const alumnosConFase = await Promise.all(
      alumnosResult.rows.map(async (alumno) => {
        const nivel = alumno.nivel_manual || alumno.nivel_actual || 1;
        const faseInfo = await getFasePorNivel(nivel);
        const fase = faseInfo ? faseInfo.fase : 'sin fase';
        
        // Calcular fase de racha basada en streak
        const streak = alumno.streak || 0;
        const faseRachaInfo = await rachaFases.getFasePorDias(streak);
        const fase_racha = faseRachaInfo ? faseRachaInfo.fase : 'sin fase';
        
        return { ...alumno, fase, fase_racha };
      })
    );

    // Filtrar por fase si se especifica
    let alumnosFiltrados = alumnosConFase;
    if (filters.fase) {
      alumnosFiltrados = alumnosConFase.filter(a => a.fase === filters.fase);
    }

    return {
      alumnos: alumnosFiltrados,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum)
    };
  } catch (error) {
    console.error('Error obteniendo lista de alumnos:', error);
    throw error;
  }
}

/**
 * Obtiene detalles completos de un alumno
 */
export async function getAlumnoDetails(alumnoId, env = null) {
  try {
    // Datos básicos
    const alumnoResult = await query(
      'SELECT * FROM alumnos WHERE id = $1',
      [alumnoId]
    );

    if (alumnoResult.rows.length === 0) {
      return null;
    }

    const alumno = alumnoResult.rows[0];

    // Calcular fase
    const nivel = alumno.nivel_manual || alumno.nivel_actual || 1;
    const fase = await getFasePorNivel(nivel);

    // Calcular días activos (días desde inscripción menos pausas)
    const diasActivos = await calcularDiasActivos(alumno.id);

    // Calcular días transcurridos en la PDE (días totales desde inscripción)
    const diasPDE = await calcularDiasPDE(alumno.id);

    // Calcular días en pausa
    const diasPausa = await calcularDiasPausados(alumno.id);

    // Prácticas recientes
    const practicasResult = await findPracticasByAlumnoId(alumno.id, 20);

    // Pausas
    const pausasResult = await findByAlumnoId(alumno.id);

    // Integración con Kajabi eliminada - datosKajabi siempre null
    const datosKajabi = null;

    return {
      ...alumno,
      fase,
      diasActivos,
      diasPDE,
      diasPausa,
      practicas: practicasResult,
      pausas: pausasResult,
      datosKajabi
    };
  } catch (error) {
    console.error('Error obteniendo detalles de alumno:', error);
    throw error;
  }
}

/**
 * Calcula días activos de un alumno
 */
async function calcularDiasActivos(alumnoId) {
  try {
    const result = await query(`
      SELECT 
        fecha_inscripcion,
        (SELECT COALESCE(SUM(
          EXTRACT(EPOCH FROM (COALESCE(fin, CURRENT_TIMESTAMP) - inicio)) / 86400
        ), 0)::INTEGER
        FROM pausas
        WHERE alumno_id = $1) as dias_pausados
      FROM alumnos
      WHERE id = $1
    `, [alumnoId]);

    if (result.rows.length === 0) {
      return 0;
    }

    const { fecha_inscripcion, dias_pausados } = result.rows[0];
    if (!fecha_inscripcion) {
      return 0;
    }

    const hoy = new Date();
    const inscripcion = new Date(fecha_inscripcion);
    const diasTotales = Math.floor((hoy - inscripcion) / (1000 * 60 * 60 * 24));
    
    return Math.max(0, diasTotales - dias_pausados);
  } catch (error) {
    console.error('Error calculando días activos:', error);
    return 0;
  }
}

/**
 * Calcula días transcurridos en la PDE (días totales desde inscripción, sin restar pausas)
 */
export async function calcularDiasPDE(alumnoId) {
  try {
    const result = await query(`
      SELECT fecha_inscripcion
      FROM alumnos
      WHERE id = $1
    `, [alumnoId]);

    if (result.rows.length === 0 || !result.rows[0].fecha_inscripcion) {
      return 0;
    }

    const fechaInscripcion = new Date(result.rows[0].fecha_inscripcion);
    const hoy = new Date();
    const diasTotales = Math.floor((hoy - fechaInscripcion) / (1000 * 60 * 60 * 24));
    
    return Math.max(0, diasTotales);
  } catch (error) {
    console.error('Error calculando días PDE:', error);
    return 0;
  }
}

/**
 * Obtiene lista de prácticas con filtros
 */
export async function getPracticasList(filters = {}, page = 1, limit = 50) {
  try {
    let whereConditions = ['1=1'];
    let params = [];
    let paramIndex = 1;

    // Filtro por fecha desde
    if (filters.fechaDesde) {
      whereConditions.push(`p.fecha >= $${paramIndex}`);
      params.push(filters.fechaDesde);
      paramIndex++;
    }

    // Filtro por fecha hasta
    if (filters.fechaHasta) {
      whereConditions.push(`p.fecha <= $${paramIndex}`);
      params.push(filters.fechaHasta);
      paramIndex++;
    }

    // Filtro por tipo
    if (filters.tipo) {
      whereConditions.push(`p.tipo = $${paramIndex}`);
      params.push(filters.tipo);
      paramIndex++;
    }

    // Filtro por email
    if (filters.email) {
      whereConditions.push(`a.email ILIKE $${paramIndex}`);
      params.push(`%${filters.email}%`);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    // Contar total
    const countResult = await query(`
      SELECT COUNT(*) as total
      FROM practicas p
      JOIN alumnos a ON p.alumno_id = a.id
      WHERE ${whereClause}
    `, params);
    const total = parseInt(countResult.rows[0].total);

    // Ordenamiento
    let orderBy = 'p.fecha DESC';
    const validSortFields = {
      'fecha': 'p.fecha',
      'tipo': 'p.tipo',
      'origen': 'p.origen',
      'duracion': 'p.duracion',
      'email': 'a.email'
    };
    
    if (filters.sortBy && validSortFields[filters.sortBy]) {
      const sortField = validSortFields[filters.sortBy];
      const sortOrder = filters.sortOrder === 'asc' ? 'ASC' : 'DESC';
      orderBy = `${sortField} ${sortOrder}`;
    }

    // Validar página y limit para evitar NaN
    const pageNum = (typeof page === 'number' && !isNaN(page) && page > 0) ? page : 1;
    const limitNum = (typeof limit === 'number' && !isNaN(limit) && limit > 0) ? limit : 50;
    
    // Obtener prácticas con paginación
    const offset = (pageNum - 1) * limitNum;
    params.push(limitNum, offset);
    
    const practicasResult = await query(`
      SELECT 
        p.id,
        p.fecha,
        p.tipo,
        p.origen,
        p.duracion,
        a.email
      FROM practicas p
      JOIN alumnos a ON p.alumno_id = a.id
      WHERE ${whereClause}
      ORDER BY ${orderBy}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, params);

    return {
      practicas: practicasResult.rows,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum)
    };
  } catch (error) {
    console.error('Error obteniendo lista de prácticas:', error);
    throw error;
  }
}

/**
 * Obtiene lista de frases
 */
export async function getFrasesList(filters = {}) {
  try {
    let whereConditions = [];
    let params = [];
    let paramIndex = 1;

    // Filtro por nivel
    if (filters.nivel) {
      const nivel = parseInt(filters.nivel);
      if (!isNaN(nivel)) {
        whereConditions.push(`nivel = $${paramIndex}`);
        params.push(nivel);
        paramIndex++;
      }
    }

    // Búsqueda por texto
    if (filters.search) {
      whereConditions.push(`frase ILIKE $${paramIndex}`);
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    // Ordenamiento
    let orderBy = 'nivel ASC, created_at DESC';
    const validSortFields = {
      'nivel': 'nivel',
      'frase': 'frase',
      'created_at': 'created_at',
      'clickup_task_id': 'clickup_task_id'
    };
    
    if (filters.sortBy && validSortFields[filters.sortBy]) {
      const sortField = validSortFields[filters.sortBy];
      const sortOrder = filters.sortOrder === 'asc' ? 'ASC' : 'DESC';
      orderBy = `${sortField} ${sortOrder}`;
    }

    const frasesResult = await query(`
      SELECT *
      FROM frases_nivel
      ${whereClause}
      ORDER BY ${orderBy}
    `, params);

    return frasesResult.rows;
  } catch (error) {
    console.error('Error obteniendo lista de frases:', error);
    throw error;
  }
}

/**
 * Elimina un alumno y todos sus datos relacionados
 */
export async function deleteAlumno(alumnoId) {
  try {
    const deleted = await alumnos.deleteById(alumnoId);
    if (!deleted) {
      throw new Error('Alumno no encontrado');
    }
    return { success: true, deleted };
  } catch (error) {
    console.error('Error eliminando alumno:', error);
    throw error;
  }
}

/**
 * Actualiza datos de un alumno
 */
export async function updateAlumno(alumnoId, updates) {
  try {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (updates.apodo !== undefined) {
      fields.push(`apodo = $${paramIndex}`);
      values.push(updates.apodo);
      paramIndex++;
    }

    if (updates.nivel_actual !== undefined) {
      fields.push(`nivel_actual = $${paramIndex}`);
      values.push(parseInt(updates.nivel_actual));
      paramIndex++;
    }

    if (updates.nivel_manual !== undefined) {
      fields.push(`nivel_manual = $${paramIndex}`);
      values.push(updates.nivel_manual ? parseInt(updates.nivel_manual) : null);
      paramIndex++;
    }

    if (updates.estado_suscripcion !== undefined) {
      fields.push(`estado_suscripcion = $${paramIndex}`);
      values.push(updates.estado_suscripcion);
      paramIndex++;
    }

    if (updates.streak !== undefined) {
      fields.push(`streak = $${paramIndex}`);
      values.push(parseInt(updates.streak) || 0);
      paramIndex++;
    }

    if (updates.fecha_inscripcion !== undefined) {
      fields.push(`fecha_inscripcion = $${paramIndex}`);
      values.push(updates.fecha_inscripcion ? new Date(updates.fecha_inscripcion).toISOString() : null);
      paramIndex++;
    }

    if (updates.fecha_ultima_practica !== undefined) {
      fields.push(`fecha_ultima_practica = $${paramIndex}`);
      values.push(updates.fecha_ultima_practica ? new Date(updates.fecha_ultima_practica).toISOString() : null);
      paramIndex++;
    }

    if (fields.length === 0) {
      throw new Error('No hay campos para actualizar');
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(alumnoId);

    await query(`
      UPDATE alumnos
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
    `, values);

    // Si se actualizó fecha_inscripcion o se eliminó nivel_manual, recalcular nivel automático
    if (updates.fecha_inscripcion !== undefined || (updates.nivel_manual !== undefined && !updates.nivel_manual)) {
      const { getNivelPorDiasActivos } = await import('./nivel-v4.js');
      const nivelAutomatico = await getNivelPorDiasActivos(alumnoId);
      
      // Solo actualizar si no hay nivel_manual o si se eliminó
      const alumnoActualizado = await query('SELECT nivel_manual FROM alumnos WHERE id = $1', [alumnoId]);
      if (!alumnoActualizado.rows[0]?.nivel_manual) {
        await query('UPDATE alumnos SET nivel_actual = $1 WHERE id = $2', [nivelAutomatico, alumnoId]);
        console.log(`✅ Nivel automático recalculado para alumno ${alumnoId}: ${nivelAutomatico}`);
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Error actualizando alumno:', error);
    throw error;
  }
}

