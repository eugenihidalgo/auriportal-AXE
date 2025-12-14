// src/services/transmutaciones-personas.js
// Servicio para gestión de personas de la plataforma (con suscripción activa) y sus apadrinados

import { query } from '../../database/pg.js';

/**
 * Lista todas las personas con suscripción activa y sus apadrinados
 */
export async function listarPersonasConApadrinados() {
  try {
    // Obtener todas las personas con suscripción activa
    const personasResult = await query(`
      SELECT 
        a.id,
        a.email,
        a.apodo,
        a.nombre_completo,
        a.nivel_actual,
        a.estado_suscripcion,
        a.fecha_inscripcion,
        COALESCE(a.streak, 0) as racha
      FROM alumnos a
      WHERE a.estado_suscripcion = 'activa'
      ORDER BY a.nombre_completo ASC, a.apodo ASC, a.email ASC
    `).catch((err) => {
      console.error('Error obteniendo personas activas:', err);
      console.error('Error completo:', err);
      return { rows: [] };
    });
    
    const personas = personasResult.rows || [];
    console.log(`[listarPersonasConApadrinados] Encontradas ${personas.length} personas con suscripción activa`);
    
    // Para cada persona, obtener sus apadrinados (solo los que están asignados a ella)
    const personasConApadrinados = await Promise.all(
      personas.map(async (persona) => {
        // Obtener apadrinados asignados a esta persona
        // Los apadrinados ahora vienen directamente de transmutaciones_apadrinados donde alumno_id es el padrino
        const apadrinadosResult = await query(`
          SELECT 
            ta.id,
            ta.nombre,
            ta.descripcion,
            ta.nivel_minimo,
            ta.frecuencia_dias,
            ta.prioridad,
            ta.orden,
            tae.ultima_limpieza,
            tae.veces_limpiado,
            tae.estado,
            CASE
              WHEN tae.ultima_limpieza IS NULL THEN NULL
              ELSE EXTRACT(DAY FROM (CURRENT_TIMESTAMP - tae.ultima_limpieza))::INT
            END as dias_desde_limpieza
          FROM transmutaciones_apadrinados ta
          LEFT JOIN transmutaciones_apadrinados_estado tae ON ta.id = tae.apadrinado_id AND tae.alumno_id = $1
          WHERE ta.alumno_id = $1
            AND ta.activo = true
          ORDER BY COALESCE(ta.orden, 0) ASC, ta.nombre ASC
        `, [persona.id]).catch((err) => {
          // Si las tablas no existen, retornar lista vacía
          if (err.message && err.message.includes('does not exist')) {
            console.warn(`⚠️ Tablas de transmutaciones_apadrinados no existen aún para persona ${persona.id}`);
            return { rows: [] };
          }
          console.error(`Error obteniendo apadrinados para persona ${persona.id}:`, err);
          return { rows: [] };
        });
        
        return {
          ...persona,
          apadrinados: apadrinadosResult.rows || []
        };
      })
    );
    
    return personasConApadrinados;
  } catch (error) {
    console.error('Error listando personas con apadrinados:', error);
    return [];
  }
}

/**
 * Obtiene una persona específica con sus apadrinados
 */
export async function getPersonaConApadrinados(personaId) {
  try {
    const personaResult = await query(`
      SELECT 
        a.id,
        a.email,
        a.apodo,
        a.nombre_completo,
        a.nivel_actual,
        a.estado_suscripcion,
        a.fecha_inscripcion,
        COALESCE(a.streak, 0) as racha
      FROM alumnos a
      WHERE a.id = $1 AND a.estado_suscripcion = 'activa'
    `, [personaId]);
    
    if (personaResult.rows.length === 0) {
      return null;
    }
    
    const persona = personaResult.rows[0];
    
    // Obtener apadrinados asignados a esta persona
    // Los apadrinados ahora vienen directamente de transmutaciones_apadrinados donde alumno_id es el padrino
    const apadrinadosResult = await query(`
      SELECT 
        ta.id,
        ta.nombre,
        ta.descripcion,
        ta.nivel_minimo,
        ta.frecuencia_dias,
        ta.prioridad,
        ta.orden,
        tae.ultima_limpieza,
        tae.veces_limpiado,
        tae.estado,
        CASE
          WHEN tae.ultima_limpieza IS NULL THEN NULL
          ELSE EXTRACT(DAY FROM (CURRENT_TIMESTAMP - tae.ultima_limpieza))::INT
        END as dias_desde_limpieza
      FROM transmutaciones_apadrinados ta
      LEFT JOIN transmutaciones_apadrinados_estado tae ON ta.id = tae.apadrinado_id AND tae.alumno_id = $1
      WHERE ta.alumno_id = $1
        AND ta.activo = true
      ORDER BY COALESCE(ta.orden, 0) ASC, ta.nombre ASC
    `, [personaId]).catch((err) => {
      // Si las tablas no existen, retornar lista vacía
      if (err.message && err.message.includes('does not exist')) {
        console.warn(`⚠️ Tablas de transmutaciones_apadrinados no existen aún para persona ${personaId}`);
        return { rows: [] };
      }
      console.error(`Error obteniendo apadrinados para persona ${personaId}:`, err);
      return { rows: [] };
    });
    
    return {
      ...persona,
      apadrinados: apadrinadosResult.rows || []
    };
  } catch (error) {
    console.error('Error obteniendo persona con apadrinados:', error);
    return null;
  }
}

