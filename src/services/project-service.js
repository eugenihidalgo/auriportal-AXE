// src/services/project-service.js
// Servicio Canónico de Proyectos v1
//
// RESPONSABILIDADES:
// - Lógica de negocio pura (sin UI, sin repos directos)
// - Verificaciones de suscripción
// - Gestión de límites de activación
// - Emisión de señales
//
// PROHIBIDO:
// - Lógica de UI
// - Cálculos en frontend
// - Decisiones sin validación

import { getDefaultProjectsCatalogRepo } from '../infra/repos/projects-catalog-repo-pg.js';
import { getDefaultStudentProjectStateRepo } from '../infra/repos/student-project-state-repo-pg.js';
import { getDefaultStudentActivationLimitRepo } from '../infra/repos/student-activation-limit-repo-pg.js';
import { getDefaultStudentRepo } from '../infra/repos/student-repo-pg.js';
import { getDefaultProjectCategoryRepo } from '../infra/repos/project-categories-repo-pg.js';
import { dispatchSignal } from '../core/signals/signal-dispatcher.js';
import { logInfo, logWarn, logError } from '../core/observability/logger.js';
import { getRequestId } from '../core/observability/request-context.js';
import { query } from '../../database/pg.js';

const projectCatalogRepo = getDefaultProjectsCatalogRepo();
const projectStateRepo = getDefaultStudentProjectStateRepo();
const activationLimitRepo = getDefaultStudentActivationLimitRepo();
const studentRepo = getDefaultStudentRepo();
const projectCategoryRepo = getDefaultProjectCategoryRepo();

/**
 * Activa un proyecto para un alumno
 * 
 * Reglas:
 * - Verifica existencia del proyecto
 * - Verifica suscripción NO en pausa
 * - Obtiene activation_limit
 * - Si se supera el límite, desactiva automáticamente el más antiguo
 * - Emite señal project.activated
 */
export async function activateProject(studentId, projectId, actor, options = {}) {
  const { traceId = null, authCtx = {} } = options;
  const finalTraceId = traceId || getRequestId();

  logInfo('ProjectService', '[PROJECT][ACTIVATE] Iniciando activación', {
    student_id: studentId,
    project_id: projectId,
    actor,
    actor_is_master: actor === 'master',
    traceId: finalTraceId
  });

  try {
    // 1. Verificar existencia del proyecto
    const project = await projectCatalogRepo.getById(projectId);
    if (!project) {
      throw new Error(`Proyecto no encontrado: ${projectId}`);
    }

    // 2. Verificar alumno y suscripción
    const student = await studentRepo.getById(studentId);
    if (!student) {
      throw new Error(`Alumno no encontrado: ${studentId}`);
    }

    // Verificar suscripción NO en pausa
    if (student.estado_suscripcion === 'pausada') {
      throw new Error(`Alumno con suscripción pausada no puede activar proyectos`);
    }

    // 3. Obtener activation_limit
    // REGLA CANÓNICA: El parámetro `actor` es la única fuente de verdad para distinguir Master vs alumno
    // - Si actor === 'master' → IGNORAR límites (siempre puede activar ilimitados)
    // - Si actor !== 'master' → Aplicar límites normales
    
    const limit = await activationLimitRepo.getByStudentAndDomain(studentId, 'projects');
    
    // Calcular límite efectivo:
    // - Si actor es 'master' → Infinity (ignorar límites)
    // - Si hay límite explícito en BD → usar ese (respeta Infinity explícito)
    // - Si no hay límite explícito → default = 1
    const effectiveLimit = actor === 'master' 
      ? Infinity
      : (limit?.activation_limit !== undefined 
          ? limit.activation_limit 
          : 1);

    // 4. Contar activos actuales
    const activeCount = await projectStateRepo.countActiveByStudent(studentId);

    // 5. Si se supera el límite, desactivar el más antiguo
    // REGLA: Solo aplicar límite si:
    // - El límite NO es Infinity
    // - El límite NO es null
    // - El actor NO es 'master' (ya que master tiene Infinity)
    // - El conteo activo >= límite
    if (actor !== 'master' && effectiveLimit !== null && effectiveLimit !== Infinity && activeCount >= effectiveLimit) {
      logInfo('ProjectService', '[PROJECT][ACTIVATE] Límite alcanzado, desactivando más antiguo', {
        student_id: studentId,
        active_count: activeCount,
        limit: effectiveLimit,
        actor,
        traceId: finalTraceId
      });

      const oldestActive = await projectStateRepo.getOldestActiveByStudent(studentId);
      if (oldestActive) {
        await projectStateRepo.updateById(oldestActive.id, { is_active: false });
        
        // Emitir señal de desactivación automática
        await dispatchSignal({
          signal_key: 'project.deactivated',
          payload: {
            student_id: studentId,
            project_id: oldestActive.project_id,
            project_state_id: oldestActive.id,
            reason: 'activation_limit_reached',
            actor_type: 'system'
          },
          runtime: {
            student_id: studentId,
            trace_id: finalTraceId
          },
          context: {}
        }, { source: { type: 'project_service', id: 'auto_deactivate' }, traceId: finalTraceId, authCtx });
      }
    }

    // 6. Activar proyecto (crear o actualizar estado)
    const existingState = await projectStateRepo.getByStudentAndProject(studentId, projectId);
    let projectState;

    if (existingState) {
      projectState = await projectStateRepo.updateById(existingState.id, {
        is_active: true
      });
    } else {
      // Obtener recurrencia por defecto de la categoría
      const category = await query(
        'SELECT default_recurrence_days FROM project_categories WHERE id = (SELECT category_id FROM projects_catalog WHERE id = $1)',
        [projectId]
      );
      const defaultRecurrence = category.rows[0]?.default_recurrence_days || 30;

      projectState = await projectStateRepo.create({
        student_id: studentId,
        project_id: projectId,
        is_active: true,
        is_reviewed: false,
        recurrence_days: defaultRecurrence
      });
    }

    // 7. Emitir señal
    await dispatchSignal({
      signal_key: 'project.activated',
      payload: {
        student_id: studentId,
        project_id: projectId,
        project_state_id: projectState.id,
        actor_type: actor
      },
      runtime: {
        student_id: studentId,
        trace_id: finalTraceId
      },
      context: {}
    }, { source: { type: 'project_service', id: 'activate' }, traceId: finalTraceId, authCtx });

    logInfo('ProjectService', '[PROJECT][ACTIVATE] Proyecto activado', {
      student_id: studentId,
      project_id: projectId,
      project_state_id: projectState.id,
      actor,
      effective_limit: effectiveLimit,
      traceId: finalTraceId
    });

    return projectState;
  } catch (error) {
    logError('ProjectService', '[PROJECT][ACTIVATE] Error activando proyecto', {
      student_id: studentId,
      project_id: projectId,
      error: error.message,
      traceId: finalTraceId
    });
    throw error;
  }
}

/**
 * Desactiva un proyecto para un alumno
 */
export async function deactivateProject(studentId, projectId, actor, options = {}) {
  const { traceId = null, authCtx = {} } = options;
  const finalTraceId = traceId || getRequestId();

  logInfo('ProjectService', '[PROJECT][DEACTIVATE] Iniciando desactivación', {
    student_id: studentId,
    project_id: projectId,
    actor,
    traceId: finalTraceId
  });

  try {
    const state = await projectStateRepo.getByStudentAndProject(studentId, projectId);
    if (!state) {
      throw new Error(`Estado no encontrado para alumno ${studentId} y proyecto ${projectId}`);
    }

    const updatedState = await projectStateRepo.updateById(state.id, {
      is_active: false
    });

    // Emitir señal
    await dispatchSignal({
      signal_key: 'project.deactivated',
      payload: {
        student_id: studentId,
        project_id: projectId,
        project_state_id: state.id,
        actor_type: actor
      },
      runtime: {
        student_id: studentId,
        trace_id: finalTraceId
      },
      context: {}
    }, { source: { type: 'project_service', id: 'deactivate' }, traceId: finalTraceId, authCtx });

    logInfo('ProjectService', '[PROJECT][DEACTIVATE] Proyecto desactivado', {
      student_id: studentId,
      project_id: projectId,
      traceId: finalTraceId
    });

    return updatedState;
  } catch (error) {
    logError('ProjectService', '[PROJECT][DEACTIVATE] Error desactivando proyecto', {
      student_id: studentId,
      project_id: projectId,
      error: error.message,
      traceId: finalTraceId
    });
    throw error;
  }
}

/**
 * Limpia un proyecto (marca como revisado)
 */
export async function cleanProject(studentId, projectId, actor, options = {}) {
  const { traceId = null, authCtx = {} } = options;
  const finalTraceId = traceId || getRequestId();

  logInfo('ProjectService', '[PROJECT][CLEAN] Iniciando limpieza', {
    student_id: studentId,
    project_id: projectId,
    actor,
    traceId: finalTraceId
  });

  try {
    const state = await projectStateRepo.getByStudentAndProject(studentId, projectId);
    if (!state) {
      throw new Error(`Estado no encontrado para alumno ${studentId} y proyecto ${projectId}`);
    }

    const updatedState = await projectStateRepo.updateById(state.id, {
      is_reviewed: true,
      last_cleaned_at: new Date()
    });

    // Mantener activo
    if (!updatedState.is_active) {
      await projectStateRepo.updateById(state.id, { is_active: true });
    }

    // Emitir señal
    await dispatchSignal({
      signal_key: 'project.cleaned',
      payload: {
        student_id: studentId,
        project_id: projectId,
        project_state_id: state.id,
        actor_type: actor
      },
      runtime: {
        student_id: studentId,
        trace_id: finalTraceId
      },
      context: {}
    }, { source: { type: 'project_service', id: 'clean' }, traceId: finalTraceId, authCtx });

    logInfo('ProjectService', '[PROJECT][CLEAN] Proyecto limpiado', {
      student_id: studentId,
      project_id: projectId,
      traceId: finalTraceId
    });

    return updatedState;
  } catch (error) {
    logError('ProjectService', '[PROJECT][CLEAN] Error limpiando proyecto', {
      student_id: studentId,
      project_id: projectId,
      error: error.message,
      traceId: finalTraceId
    });
    throw error;
  }
}

/**
 * Limpia proyectos seleccionados (bulk)
 */
export async function cleanSelectedProjects(projectStateIds, actor, options = {}) {
  const { traceId = null, authCtx = {} } = options;
  const finalTraceId = traceId || getRequestId();

  logInfo('ProjectService', '[PROJECT][CLEAN_BULK] Iniciando limpieza masiva', {
    project_state_ids: projectStateIds,
    count: projectStateIds.length,
    actor,
    traceId: finalTraceId
  });

  try {
    const cleaned = [];
    for (const stateId of projectStateIds) {
      const state = await projectStateRepo.getById(stateId);
      if (state) {
        await projectStateRepo.updateById(stateId, {
          is_reviewed: true,
          last_cleaned_at: new Date()
        });
        cleaned.push(state);
      }
    }

    // Emitir señal bulk
    await dispatchSignal({
      signal_key: 'project.cleaned.bulk',
      payload: {
        project_state_ids: projectStateIds,
        items_count: cleaned.length,
        actor_type: actor
      },
      runtime: {
        trace_id: finalTraceId
      },
      context: {}
    }, { source: { type: 'project_service', id: 'clean_bulk' }, traceId: finalTraceId, authCtx });

    logInfo('ProjectService', '[PROJECT][CLEAN_BULK] Limpieza masiva completada', {
      cleaned_count: cleaned.length,
      traceId: finalTraceId
    });

    return cleaned;
  } catch (error) {
    logError('ProjectService', '[PROJECT][CLEAN_BULK] Error en limpieza masiva', {
      error: error.message,
      traceId: finalTraceId
    });
    throw error;
  }
}

/**
 * Limpia TODOS los proyectos activos
 */
export async function cleanAllActiveProjects(actor, options = {}) {
  const { traceId = null, authCtx = {} } = options;
  const finalTraceId = traceId || getRequestId();

  logInfo('ProjectService', '[PROJECT][CLEAN_ALL] Iniciando limpieza de todos los activos', {
    actor,
    traceId: finalTraceId
  });

  try {
    const allActive = await projectStateRepo.listAllActive();
    const projectStateIds = allActive.map(s => s.id);

    const cleaned = await cleanSelectedProjects(projectStateIds, actor, { traceId: finalTraceId, authCtx });

    // Emitir señal específica para "todos"
    await dispatchSignal({
      signal_key: 'project.cleaned.all',
      payload: {
        items_count: cleaned.length,
        actor_type: actor
      },
      runtime: {
        trace_id: finalTraceId
      },
      context: {}
    }, { source: { type: 'project_service', id: 'clean_all' }, traceId: finalTraceId, authCtx });

    logInfo('ProjectService', '[PROJECT][CLEAN_ALL] Limpieza de todos completada', {
      cleaned_count: cleaned.length,
      traceId: finalTraceId
    });

    return cleaned;
  } catch (error) {
    logError('ProjectService', '[PROJECT][CLEAN_ALL] Error limpiando todos', {
      error: error.message,
      traceId: finalTraceId
    });
    throw error;
  }
}

/**
 * Maneja pausa de suscripción: desactiva TODOS los proyectos activos
 */
export async function handleSubscriptionPauseProjects(studentId, options = {}) {
  const { traceId = null, authCtx = {} } = options;
  const finalTraceId = traceId || getRequestId();

  logInfo('ProjectService', '[PROJECT][PAUSE] Desactivando todos los proyectos por pausa', {
    student_id: studentId,
    traceId: finalTraceId
  });

  try {
    const activeProjects = await projectStateRepo.listActiveByStudent(studentId);
    
    for (const projectState of activeProjects) {
      await projectStateRepo.updateById(projectState.id, {
        is_active: false
      });
    }

    // Emitir señal
    await dispatchSignal({
      signal_key: 'project.deactivated.all',
      payload: {
        student_id: studentId,
        items_count: activeProjects.length,
        reason: 'subscription_paused'
      },
      runtime: {
        student_id: studentId,
        trace_id: finalTraceId
      },
      context: {}
    }, { source: { type: 'project_service', id: 'pause' }, traceId: finalTraceId, authCtx });

    logInfo('ProjectService', '[PROJECT][PAUSE] Todos los proyectos desactivados', {
      student_id: studentId,
      deactivated_count: activeProjects.length,
      traceId: finalTraceId
    });

    return activeProjects;
  } catch (error) {
    logError('ProjectService', '[PROJECT][PAUSE] Error desactivando proyectos por pausa', {
      student_id: studentId,
      error: error.message,
      traceId: finalTraceId
    });
    throw error;
  }
}

/**
 * Actualiza límite de activación
 */
export async function updateActivationLimit(studentId, domain = 'projects', value, source, options = {}) {
  const { traceId = null, authCtx = {} } = options;
  const finalTraceId = traceId || getRequestId();

  // Normalizar value
  let normalizedValue = value;
  
  // Si es string "∞" o "" → convertir a null
  if (value === '∞' || value === '' || value === 'infinity') {
    normalizedValue = null;
  }
  // Si es string numérico → convertir a número
  else if (typeof value === 'string' && /^\d+$/.test(value)) {
    normalizedValue = parseInt(value, 10);
  }
  // Si es número → validar rango
  else if (typeof value === 'number') {
    if (value < 1) {
      throw new Error('activation_limit debe ser >= 1 o null (infinito)');
    }
    normalizedValue = value;
  }
  // Si es null → OK (infinito)
  else if (value === null || value === undefined) {
    normalizedValue = null;
  }
  else {
    throw new Error(`activation_limit inválido: ${value} (debe ser número >= 1 o null)`);
  }

  // Validar domain
  if (domain !== 'places' && domain !== 'projects') {
    throw new Error(`domain inválido: ${domain} (debe ser 'places' o 'projects')`);
  }

  logInfo('ProjectService', '[PROJECT][LIMIT] Actualizando límite de activación', {
    student_id: studentId,
    domain,
    value_original: value,
    value_normalized: normalizedValue,
    source,
    traceId: finalTraceId
  });

  try {
    const limit = await activationLimitRepo.upsert({
      student_id: studentId,
      domain,
      activation_limit: normalizedValue,
      source
    });

    // Emitir señal
    await dispatchSignal({
      signal_key: 'project.activation_limit.updated',
      payload: {
        student_id: studentId,
        domain,
        activation_limit: value,
        source
      },
      runtime: {
        student_id: studentId,
        trace_id: finalTraceId
      },
      context: {}
    }, { source: { type: 'project_service', id: 'update_limit' }, traceId: finalTraceId, authCtx });

    logInfo('ProjectService', '[PROJECT][LIMIT] Límite actualizado', {
      student_id: studentId,
      domain,
      activation_limit: normalizedValue,
      source,
      traceId: finalTraceId
    });

    return limit;
  } catch (error) {
    logError('ProjectService', '[PROJECT][LIMIT] Error actualizando límite', {
      student_id: studentId,
      domain,
      error: error.message,
      traceId: finalTraceId
    });
    throw error;
  }
}

/**
 * Crea un proyecto para un alumno (catálogo + estado + activación)
 * 
 * Lógica canónica:
 * 1. Verifica alumno existe
 * 2. Verifica categoría existe y está activa
 * 3. Genera project_key único
 * 4. Crea en projects_catalog
 * 5. Crea student_project_state activo
 * 6. Respeta límites (si actor != 'master')
 * 7. Emite señal project.activated
 */
export async function createProjectForStudent({ studentId, name, description, categoryId, actor, options = {} }) {
  const { traceId = null, authCtx = {} } = options;
  const finalTraceId = traceId || getRequestId();

  logInfo('ProjectService', '[PROJECT][CREATE_FOR_STUDENT] Iniciando creación', {
    student_id: studentId,
    name,
    category_id: categoryId,
    actor,
    traceId: finalTraceId
  });

  try {
    // 1. Verificar alumno existe
    const student = await studentRepo.getById(studentId);
    if (!student) {
      throw new Error(`Alumno no encontrado: ${studentId}`);
    }

    // Verificar suscripción NO en pausa
    if (student.estado_suscripcion === 'pausada') {
      throw new Error(`Alumno con suscripción pausada no puede crear proyectos`);
    }

    // 2. Verificar categoría existe y está activa
    const category = await projectCategoryRepo.getById(categoryId);
    if (!category) {
      throw new Error(`Categoría no encontrada: ${categoryId}`);
    }
    if (!category.is_active) {
      throw new Error(`Categoría no está activa: ${categoryId}`);
    }

    // 3. Generar project_key único
    const timestamp = Date.now();
    const slug = name.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);
    const projectKey = `${slug}-${timestamp}`;

    // 4. Crear en projects_catalog
    const project = await projectCatalogRepo.create({
      project_key: projectKey,
      category_id: categoryId,
      base_name: name
    });

    logInfo('ProjectService', '[PROJECT][CREATE_FOR_STUDENT] Proyecto creado en catálogo', {
      project_id: project.id,
      project_key: projectKey,
      traceId: finalTraceId
    });

    // 5. Crear student_project_state activo
    // Si actor='master', no hay límites; si no, aplicar lógica de overflow
    let projectState;
    
    if (actor === 'master') {
      // Master: crear directamente activo
      projectState = await projectStateRepo.create({
        student_id: studentId,
        project_id: project.id,
        is_active: true,
        is_reviewed: false,
        custom_name: name,
        description: description || null,
        recurrence_days: category.default_recurrence_days || 30
      });
      
      // Emitir señal
      await dispatchSignal({
        signal_key: 'project.activated',
        payload: {
          student_id: studentId,
          project_id: project.id,
          project_state_id: projectState.id,
          actor_type: actor
        },
        runtime: {
          student_id: studentId,
          trace_id: finalTraceId
        },
        context: {}
      }, { source: { type: 'project_service', id: 'create_for_student' }, traceId: finalTraceId, authCtx });
    } else {
      // No-master: usar activateProject para respetar límites
      projectState = await activateProject(studentId, project.id, actor, { traceId: finalTraceId, authCtx });
      
      // Actualizar custom_name y description si difieren
      if (projectState.custom_name !== name || projectState.description !== (description || null)) {
        projectState = await projectStateRepo.updateById(projectState.id, {
          custom_name: name,
          description: description || null
        });
      }
    }

    logInfo('ProjectService', '[PROJECT][CREATE_FOR_STUDENT] Proyecto creado y activado', {
      student_id: studentId,
      project_id: project.id,
      project_state_id: projectState.id,
      actor,
      traceId: finalTraceId
    });

    return {
      project_id: project.id,
      project_state_id: projectState.id,
      project
    };
  } catch (error) {
    logError('ProjectService', '[PROJECT][CREATE_FOR_STUDENT] Error creando proyecto', {
      student_id: studentId,
      name,
      category_id: categoryId,
      error: error.message,
      traceId: finalTraceId
    });
    throw error;
  }
}
