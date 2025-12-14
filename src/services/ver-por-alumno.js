// src/services/ver-por-alumno.js
// Servicio para la funcionalidad "Ver por cada alumno" del Master

import { query } from '../../database/pg.js';

/**
 * Obtiene el estado de un aspecto para todos los alumnos
 * @param {number} aspectoId
 * @param {string} tipoAspecto - 'anatomia', 'karmicos', 'indeseables', 'limpieza_hogar'
 * @returns {Promise<Object>}
 */
export async function obtenerEstadoAspectoPorAlumnos(aspectoId, tipoAspecto = 'anatomia') {
  try {
    // Obtener información del aspecto
    let aspectoInfo;
    let tablaEstado;
    let campoAspectoId;
    let campoFrecuencia;
    
    switch (tipoAspecto) {
      case 'anatomia':
        try {
          // Intentar obtener con todas las columnas
          aspectoInfo = await query(`
            SELECT nombre, COALESCE(frecuencia_dias, 14) as frecuencia_dias, 
                   COALESCE(tipo_limpieza, 'regular') as tipo_limpieza, 
                   cantidad_minima
            FROM aspectos_energeticos
            WHERE id = $1
          `, [aspectoId]);
        } catch (error) {
          // Si falla, intentar sin columnas que pueden no existir
          aspectoInfo = await query(`
            SELECT nombre, 14 as frecuencia_dias, 'regular' as tipo_limpieza, NULL as cantidad_minima
            FROM aspectos_energeticos
            WHERE id = $1
          `, [aspectoId]);
        }
        tablaEstado = 'aspectos_energeticos_alumnos';
        campoAspectoId = 'aspecto_id';
        campoFrecuencia = 'frecuencia_dias';
        break;
      case 'karmicos':
        aspectoInfo = await query(`
          SELECT nombre, frecuencia_dias, tipo_limpieza, cantidad_minima
          FROM aspectos_karmicos
          WHERE id = $1
        `, [aspectoId]);
        tablaEstado = 'aspectos_karmicos_alumnos';
        campoAspectoId = 'aspecto_id';
        campoFrecuencia = 'frecuencia_dias';
        break;
      case 'indeseables':
        aspectoInfo = await query(`
          SELECT nombre, frecuencia_dias, tipo_limpieza, cantidad_minima
          FROM aspectos_indeseables
          WHERE id = $1
        `, [aspectoId]);
        tablaEstado = 'aspectos_indeseables_alumnos';
        campoAspectoId = 'aspecto_id';
        campoFrecuencia = 'frecuencia_dias';
        break;
      case 'limpieza_hogar':
        aspectoInfo = await query(`
          SELECT nombre, frecuencia_dias
          FROM limpieza_hogar
          WHERE id = $1
        `, [aspectoId]);
        tablaEstado = 'limpieza_hogar_alumnos';
        campoAspectoId = 'aspecto_id';
        campoFrecuencia = 'frecuencia_dias';
        break;
      default:
        return { limpios: [], pendientes: [], olvidados: [] };
    }
    
    if (!aspectoInfo || aspectoInfo.rows.length === 0) {
      return { 
        aspecto: { id: aspectoId, nombre: 'Aspecto no encontrado', tipo_limpieza: 'regular', frecuencia_dias: 14, cantidad_minima: 1 },
        limpios: [], 
        pendientes: [], 
        olvidados: [] 
      };
    }
    
    const aspecto = aspectoInfo.rows[0];
    if (!aspecto || !aspecto.nombre) {
      return { 
        aspecto: { id: aspectoId, nombre: 'Aspecto sin nombre', tipo_limpieza: 'regular', frecuencia_dias: 14, cantidad_minima: 1 },
        limpios: [], 
        pendientes: [], 
        olvidados: [] 
      };
    }
    
    const frecuenciaDias = aspecto.frecuencia_dias || 14;
    const tipoLimpieza = aspecto.tipo_limpieza || 'regular';
    
    // Obtener todos los alumnos con suscripción activa
    const alumnos = await query(`
      SELECT id, email, apodo, nombre_completo, nivel_actual
      FROM alumnos
      WHERE estado_suscripcion = 'activa'
      ORDER BY nombre_completo, apodo, email
    `);
    
    const limpios = [];
    const pendientes = [];
    const olvidados = [];
    
    for (const alumno of alumnos.rows) {
      // Obtener estado del aspecto para este alumno
      let estado;
      try {
        if (tipoAspecto === 'anatomia') {
          try {
            // Intentar con todas las columnas
            estado = await query(`
              SELECT 
                ultima_limpieza,
                COALESCE(estado, 'pendiente') as estado,
                COALESCE(cantidad_completada, 0) as cantidad_completada,
                COALESCE(cantidad_requerida, ${aspecto.cantidad_minima || 1}) as cantidad_requerida,
                COALESCE(completado_permanentemente, false) as completado_permanentemente,
                CASE
                  WHEN ultima_limpieza IS NULL THEN NULL
                  ELSE EXTRACT(DAY FROM (CURRENT_TIMESTAMP - ultima_limpieza))::INT
                END as dias_desde_limpieza
              FROM aspectos_energeticos_alumnos
              WHERE alumno_id = $1 AND aspecto_id = $2
            `, [alumno.id, aspectoId]);
          } catch (error) {
            // Si falla, intentar sin columnas que pueden no existir
            estado = await query(`
              SELECT 
                ultima_limpieza,
                'pendiente' as estado,
                0 as cantidad_completada,
                ${aspecto.cantidad_minima || 1} as cantidad_requerida,
                false as completado_permanentemente,
                CASE
                  WHEN ultima_limpieza IS NULL THEN NULL
                  ELSE EXTRACT(DAY FROM (CURRENT_TIMESTAMP - ultima_limpieza))::INT
                END as dias_desde_limpieza
              FROM aspectos_energeticos_alumnos
              WHERE alumno_id = $1 AND aspecto_id = $2
            `, [alumno.id, aspectoId]);
          }
        } else {
          estado = await query(`
            SELECT 
              ultima_limpieza,
              estado,
              CASE
                WHEN ultima_limpieza IS NULL THEN NULL
                ELSE EXTRACT(DAY FROM (CURRENT_TIMESTAMP - ultima_limpieza))::INT
              END as dias_desde_limpieza
            FROM ${tablaEstado}
            WHERE alumno_id = $1 AND ${campoAspectoId} = $2
          `, [alumno.id, aspectoId]);
        }
      } catch (err) {
        console.warn(`Error obteniendo estado para alumno ${alumno.id}:`, err.message);
        continue;
      }
      
      const estadoData = estado.rows[0];
      const nombreAlumno = alumno.nombre_completo || alumno.apodo || alumno.email;
      
      if (tipoLimpieza === 'una_vez') {
        // Para limpiezas de una vez
        const completado = estadoData?.completado_permanentemente || false;
        const cantidadCompletada = estadoData?.cantidad_completada || 0;
        const cantidadRequerida = estadoData?.cantidad_requerida || aspecto.cantidad_minima || 1;
        
        if (completado || cantidadCompletada >= cantidadRequerida) {
          limpios.push({
            id: alumno.id,
            nombre: nombreAlumno,
            email: alumno.email,
            nivel: alumno.nivel_actual,
            cantidad_completada: cantidadCompletada,
            cantidad_requerida: cantidadRequerida
          });
        } else {
          pendientes.push({
            id: alumno.id,
            nombre: nombreAlumno,
            email: alumno.email,
            nivel: alumno.nivel_actual,
            cantidad_completada: cantidadCompletada,
            cantidad_requerida: cantidadRequerida
          });
        }
      } else {
        // Para limpiezas regulares
        if (!estadoData || !estadoData.ultima_limpieza) {
          olvidados.push({
            id: alumno.id,
            nombre: nombreAlumno,
            email: alumno.email,
            nivel: alumno.nivel_actual,
            dias_desde_limpieza: null
          });
        } else {
          const dias = estadoData.dias_desde_limpieza || 0;
          
          if (dias <= frecuenciaDias) {
            limpios.push({
              id: alumno.id,
              nombre: nombreAlumno,
              email: alumno.email,
              nivel: alumno.nivel_actual,
              dias_desde_limpieza: dias,
              ultima_limpieza: estadoData.ultima_limpieza
            });
          } else if (dias <= frecuenciaDias * 2) {
            pendientes.push({
              id: alumno.id,
              nombre: nombreAlumno,
              email: alumno.email,
              nivel: alumno.nivel_actual,
              dias_desde_limpieza: dias,
              ultima_limpieza: estadoData.ultima_limpieza
            });
          } else {
            olvidados.push({
              id: alumno.id,
              nombre: nombreAlumno,
              email: alumno.email,
              nivel: alumno.nivel_actual,
              dias_desde_limpieza: dias,
              ultima_limpieza: estadoData.ultima_limpieza
            });
          }
        }
      }
    }
    
    return {
      aspecto: {
        id: aspectoId,
        nombre: aspecto.nombre,
        tipo_limpieza: tipoLimpieza,
        frecuencia_dias: frecuenciaDias,
        cantidad_minima: aspecto.cantidad_minima
      },
      limpios,
      pendientes,
      olvidados
    };
  } catch (error) {
    console.error('Error obteniendo estado por alumnos:', error);
    return { limpios: [], pendientes: [], olvidados: [] };
  }
}

