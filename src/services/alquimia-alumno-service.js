// src/services/alquimia-alumno-service.js
// Servicio de negocio para Alquimia por Alumno (MASTER)
//
// Responsabilidades:
// - Obtener nivel_efectivo del alumno
// - Obtener items de alquimia relevantes para ese nivel
// - Separar pendientes / revisados
// - Calcular summary (porcentaje limpiado)

import { getDefaultAlquimiaCatalogRepo } from '../infra/repos/alquimia-catalog-repo-pg.js';
import { getDefaultStudentRepo } from '../infra/repos/student-repo-pg.js';
import { computeProgress } from '../core/progress-engine.js';
import { query } from '../../database/pg.js';
import { getRequestId } from '../core/observability/request-context.js';
import { logError, logInfo } from '../core/observability/logger.js';

/**
 * Obtiene todos los items de alquimia de un alumno agrupados por listas
 * 
 * @param {number} studentId - ID del alumno
 * @param {string} [productKey='pde'] - Clave del producto
 * @returns {Promise<Object>} Objeto con student, summary, listas
 */
export async function getAlquimiaByStudent(studentId, productKey = 'pde') {
  const traceId = getRequestId();
  
  try {
    logInfo('AlquimiaAlumnoService', 'getAlquimiaByStudent iniciado', { 
      traceId, 
      studentId, 
      productKey 
    });
    
    // 1. Obtener alumno y nivel_efectivo
    const studentRepo = getDefaultStudentRepo();
    const student = await studentRepo.getById(studentId);
    
    if (!student) {
      logError('AlquimiaAlumnoService', 'Alumno no encontrado', {
        traceId,
        studentId
      });
      throw new Error(`Alumno no encontrado: ${studentId}`);
    }
    
    // Calcular nivel_efectivo
    const progress = await computeProgress({ student });
    const nivelEfectivo = progress.nivel_efectivo || 1;
    
    logInfo('AlquimiaAlumnoService', 'Nivel efectivo calculado', {
      traceId,
      studentId,
      nivel_efectivo: nivelEfectivo
    });
    
    // 2. Obtener todas las listas activas
    const catalogRepo = getDefaultAlquimiaCatalogRepo();
    const listas = await catalogRepo.listListas({ onlyActive: true });
    
    logInfo('AlquimiaAlumnoService', 'Listas obtenidas', {
      traceId,
      studentId,
      listas_count: listas.length
    });
    
    // 3. Obtener items de cada lista (filtrados por nivel)
    const listasConItems = [];
    
    let totalItemsRelevantes = 0;
    let totalRevisados = 0;
    let totalPendientes = 0;
    
    for (const lista of listas) {
      // Obtener items de la lista (solo activos, filtrados por nivel)
      const items = await catalogRepo.listItems(lista.id, { onlyActive: true });
      
      // Filtrar por nivel_efectivo
      const itemsRelevantes = items.filter(item => 
        item.nivel !== null && item.nivel !== undefined && item.nivel <= nivelEfectivo
      );
      
      if (itemsRelevantes.length === 0) {
        continue; // Saltar listas sin items relevantes
      }
      
      // Separar pendientes y revisados
      const pendientes = [];
      const revisados = [];
      
      for (const item of itemsRelevantes) {
        // Obtener estado del alumno para este item (consulta directa)
        const estadoResult = await query(`
          SELECT 
            last_cleaned_at,
            clean_count,
            remaining,
            completed
          FROM student_item_state
          WHERE student_id = $1
            AND product_key = $2
            AND domain_type = 'transmutation'
            AND item_ref = $3
            AND is_active = true
          LIMIT 1
        `, [studentId, productKey, item.item_ref]);
        
        const estadoAlumno = estadoResult.rows[0] || null;
        
        if (item.tipo === 'recurrente') {
          // Recurrente: pendiente si nunca limpiado o si pasó el threshold
          const lastCleanedAt = estadoAlumno?.last_cleaned_at;
          const daysSince = lastCleanedAt 
            ? Math.floor((new Date().getTime() - new Date(lastCleanedAt).getTime()) / (1000 * 60 * 60 * 24))
            : null;
          const thresholdDays = item.frecuencia_dias || 7;
          const criticalMultiplier = item.critical_multiplier || 2.0;
          const criticalThreshold = thresholdDays * criticalMultiplier;
          
          if (daysSince === null) {
            // Nunca limpiado → PENDIENTE
            pendientes.push({
              item_id: item.id,
              item_ref: item.item_ref,
              name: item.nombre,
              status: 'normal'
            });
          } else if (daysSince < thresholdDays) {
            // Última ejecución < threshold_days → REVISADO
            revisados.push({
              item_id: item.id,
              item_ref: item.item_ref,
              name: item.nombre,
              cleaned_at: lastCleanedAt
            });
          } else if (daysSince < criticalThreshold) {
            // threshold_days <= días < threshold_days * critical_multiplier → PENDIENTE
            pendientes.push({
              item_id: item.id,
              item_ref: item.item_ref,
              name: item.nombre,
              status: 'normal'
            });
          } else {
            // días >= threshold_days * critical_multiplier → IMPORTANTE
            pendientes.push({
              item_id: item.id,
              item_ref: item.item_ref,
              name: item.nombre,
              status: 'important'
            });
          }
        } else {
          // una_vez: pendiente si remaining > 0
          const remaining = estadoAlumno?.remaining !== null && estadoAlumno?.remaining !== undefined
            ? parseInt(estadoAlumno.remaining, 10)
            : null;
          
          if (remaining === null || remaining > 0) {
            pendientes.push({
              item_id: item.id,
              item_ref: item.item_ref,
              name: item.nombre,
              status: 'normal'
            });
          } else {
            revisados.push({
              item_id: item.id,
              item_ref: item.item_ref,
              name: item.nombre,
              cleaned_at: estadoAlumno?.last_cleaned_at || null
            });
          }
        }
      }
      
      // Ordenar pendientes: importantes primero
      pendientes.sort((a, b) => {
        if (a.status === 'important' && b.status !== 'important') return -1;
        if (a.status !== 'important' && b.status === 'important') return 1;
        return 0;
      });
      
      totalItemsRelevantes += itemsRelevantes.length;
      totalRevisados += revisados.length;
      totalPendientes += pendientes.length;
      
      listasConItems.push({
        list_id: lista.id,
        list_name: lista.nombre,
        items: {
          pendientes,
          revisados
        }
      });
    }
    
    // 4. Calcular porcentaje limpiado
    const porcentajeLimpio = totalItemsRelevantes > 0
      ? Math.round((totalRevisados / totalItemsRelevantes) * 100)
      : 0;
    
    logInfo('AlquimiaAlumnoService', 'getAlquimiaByStudent completado', {
      traceId,
      studentId,
      total_items_relevantes: totalItemsRelevantes,
      revisados: totalRevisados,
      pendientes: totalPendientes,
      porcentaje_limpio: porcentajeLimpio
    });
    
    return {
      student: {
        id: student.id,
        name: student.nombre_completo || student.apodo || student.email,
        nivel_efectivo: nivelEfectivo
      },
      summary: {
        nivel_referencia: nivelEfectivo,
        total_items_relevantes: totalItemsRelevantes,
        revisados: totalRevisados,
        pendientes: totalPendientes,
        porcentaje_limpio: porcentajeLimpio
      },
      listas: listasConItems
    };
  } catch (error) {
    logError('AlquimiaAlumnoService', 'Error en getAlquimiaByStudent', {
      traceId,
      error: error.message,
      code: error.code,
      stack: error.stack,
      studentId
    });
    throw error;
  }
}
