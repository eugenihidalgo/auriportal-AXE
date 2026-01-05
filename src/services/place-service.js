// src/services/place-service.js
// Servicio Canónico de Lugares v1
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

import { getDefaultPlaceCatalogRepo } from '../infra/repos/place-catalog-repo-pg.js';
import { getDefaultStudentPlaceStateRepo } from '../infra/repos/student-place-state-repo-pg.js';
import { getDefaultStudentActivationLimitRepo } from '../infra/repos/student-activation-limit-repo-pg.js';
import { getDefaultStudentRepo } from '../infra/repos/student-repo-pg.js';
import { getDefaultPlaceCategoryRepo } from '../infra/repos/place-category-repo-pg.js';
import { dispatchSignal } from '../core/signals/signal-dispatcher.js';
import { logInfo, logWarn, logError } from '../core/observability/logger.js';
import { getRequestId } from '../core/observability/request-context.js';
import { query } from '../../database/pg.js';

const placeCatalogRepo = getDefaultPlaceCatalogRepo();
const placeStateRepo = getDefaultStudentPlaceStateRepo();
const activationLimitRepo = getDefaultStudentActivationLimitRepo();
const studentRepo = getDefaultStudentRepo();
const placeCategoryRepo = getDefaultPlaceCategoryRepo();

/**
 * Activa un lugar para un alumno
 * 
 * Reglas:
 * - Verifica existencia del lugar
 * - Verifica suscripción NO en pausa
 * - Obtiene activation_limit
 * - Si se supera el límite, desactiva automáticamente el más antiguo
 * - Emite señal place.activated
 */
export async function activatePlace(studentId, placeId, actor, options = {}) {
  const { traceId = null, authCtx = {} } = options;
  const finalTraceId = traceId || getRequestId();

    logInfo('PlaceService', '[PLACE][ACTIVATE] Iniciando activación', {
      student_id: studentId,
      place_id: placeId,
      actor,
      actor_is_master: actor === 'master',
      traceId: finalTraceId
    });

  try {
    // 1. Verificar existencia del lugar
    const place = await placeCatalogRepo.getById(placeId);
    if (!place) {
      throw new Error(`Lugar no encontrado: ${placeId}`);
    }

    // 2. Verificar alumno y suscripción
    const student = await studentRepo.getById(studentId);
    if (!student) {
      throw new Error(`Alumno no encontrado: ${studentId}`);
    }

    // Verificar suscripción NO en pausa
    if (student.estado_suscripcion === 'pausada') {
      throw new Error(`Alumno con suscripción pausada no puede activar lugares`);
    }

    // 3. Obtener activation_limit
    // REGLA CANÓNICA: El parámetro `actor` es la única fuente de verdad para distinguir Master vs alumno
    // - Si actor === 'master' → IGNORAR límites (siempre puede activar ilimitados)
    // - Si actor !== 'master' → Aplicar límites normales
    
    const limit = await activationLimitRepo.getByStudentAndDomain(studentId, 'places');
    
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
    const activeCount = await placeStateRepo.countActiveByStudent(studentId);

    // 5. Si se supera el límite, desactivar el más antiguo
    // REGLA: Solo aplicar límite si:
    // - El límite NO es Infinity
    // - El límite NO es null
    // - El actor NO es 'master' (ya que master tiene Infinity)
    // - El conteo activo >= límite
    if (actor !== 'master' && effectiveLimit !== null && effectiveLimit !== Infinity && activeCount >= effectiveLimit) {
      logInfo('PlaceService', '[PLACE][ACTIVATE] Límite alcanzado, desactivando más antiguo', {
        student_id: studentId,
        active_count: activeCount,
        limit: effectiveLimit,
        actor,
        traceId: finalTraceId
      });

      const oldestActive = await placeStateRepo.getOldestActiveByStudent(studentId);
      if (oldestActive) {
        await placeStateRepo.updateById(oldestActive.id, { is_active: false });
        
        // Emitir señal de desactivación automática
        await dispatchSignal({
          signal_key: 'place.deactivated',
          payload: {
            student_id: studentId,
            place_id: oldestActive.place_id,
            place_state_id: oldestActive.id,
            reason: 'activation_limit_reached',
            actor_type: 'system'
          },
          runtime: {
            student_id: studentId,
            trace_id: finalTraceId
          },
          context: {}
        }, { source: { type: 'place_service', id: 'auto_deactivate' }, traceId: finalTraceId, authCtx });
      }
    }

    // 6. Activar lugar (crear o actualizar estado)
    const existingState = await placeStateRepo.getByStudentAndPlace(studentId, placeId);
    let placeState;

    if (existingState) {
      placeState = await placeStateRepo.updateById(existingState.id, {
        is_active: true
      });
    } else {
      // Obtener recurrencia por defecto de la categoría
      const category = await query(
        'SELECT default_recurrence_days FROM place_categories WHERE id = (SELECT category_id FROM places_catalog WHERE id = $1)',
        [placeId]
      );
      const defaultRecurrence = category.rows[0]?.default_recurrence_days || 30;

      placeState = await placeStateRepo.create({
        student_id: studentId,
        place_id: placeId,
        is_active: true,
        is_reviewed: false,
        recurrence_days: defaultRecurrence
      });
    }

    // 7. Emitir señal
    await dispatchSignal({
      signal_key: 'place.activated',
      payload: {
        student_id: studentId,
        place_id: placeId,
        place_state_id: placeState.id,
        actor_type: actor
      },
      runtime: {
        student_id: studentId,
        trace_id: finalTraceId
      },
      context: {}
    }, { source: { type: 'place_service', id: 'activate' }, traceId: finalTraceId, authCtx });

    logInfo('PlaceService', '[PLACE][ACTIVATE] Lugar activado', {
      student_id: studentId,
      place_id: placeId,
      place_state_id: placeState.id,
      actor,
      effective_limit: effectiveLimit,
      traceId: finalTraceId
    });

    return placeState;
  } catch (error) {
    logError('PlaceService', '[PLACE][ACTIVATE] Error activando lugar', {
      student_id: studentId,
      place_id: placeId,
      error: error.message,
      traceId: finalTraceId
    });
    throw error;
  }
}

/**
 * Desactiva un lugar para un alumno
 */
export async function deactivatePlace(studentId, placeId, actor, options = {}) {
  const { traceId = null, authCtx = {} } = options;
  const finalTraceId = traceId || getRequestId();

  logInfo('PlaceService', '[PLACE][DEACTIVATE] Iniciando desactivación', {
    student_id: studentId,
    place_id: placeId,
    actor,
    traceId: finalTraceId
  });

  try {
    const state = await placeStateRepo.getByStudentAndPlace(studentId, placeId);
    if (!state) {
      throw new Error(`Estado no encontrado para alumno ${studentId} y lugar ${placeId}`);
    }

    const updatedState = await placeStateRepo.updateById(state.id, {
      is_active: false
    });

    // Emitir señal
    await dispatchSignal({
      signal_key: 'place.deactivated',
      payload: {
        student_id: studentId,
        place_id: placeId,
        place_state_id: state.id,
        actor_type: actor
      },
      runtime: {
        student_id: studentId,
        trace_id: finalTraceId
      },
      context: {}
    }, { source: { type: 'place_service', id: 'deactivate' }, traceId: finalTraceId, authCtx });

    logInfo('PlaceService', '[PLACE][DEACTIVATE] Lugar desactivado', {
      student_id: studentId,
      place_id: placeId,
      traceId: finalTraceId
    });

    return updatedState;
  } catch (error) {
    logError('PlaceService', '[PLACE][DEACTIVATE] Error desactivando lugar', {
      student_id: studentId,
      place_id: placeId,
      error: error.message,
      traceId: finalTraceId
    });
    throw error;
  }
}

/**
 * Limpia un lugar (marca como revisado)
 */
export async function cleanPlace(studentId, placeId, actor, options = {}) {
  const { traceId = null, authCtx = {} } = options;
  const finalTraceId = traceId || getRequestId();

  logInfo('PlaceService', '[PLACE][CLEAN] Iniciando limpieza', {
    student_id: studentId,
    place_id: placeId,
    actor,
    traceId: finalTraceId
  });

  try {
    const state = await placeStateRepo.getByStudentAndPlace(studentId, placeId);
    if (!state) {
      throw new Error(`Estado no encontrado para alumno ${studentId} y lugar ${placeId}`);
    }

    const updatedState = await placeStateRepo.updateById(state.id, {
      is_reviewed: true,
      last_cleaned_at: new Date()
    });

    // Mantener activo
    if (!updatedState.is_active) {
      await placeStateRepo.updateById(state.id, { is_active: true });
    }

    // Emitir señal
    await dispatchSignal({
      signal_key: 'place.cleaned',
      payload: {
        student_id: studentId,
        place_id: placeId,
        place_state_id: state.id,
        actor_type: actor
      },
      runtime: {
        student_id: studentId,
        trace_id: finalTraceId
      },
      context: {}
    }, { source: { type: 'place_service', id: 'clean' }, traceId: finalTraceId, authCtx });

    logInfo('PlaceService', '[PLACE][CLEAN] Lugar limpiado', {
      student_id: studentId,
      place_id: placeId,
      traceId: finalTraceId
    });

    return updatedState;
  } catch (error) {
    logError('PlaceService', '[PLACE][CLEAN] Error limpiando lugar', {
      student_id: studentId,
      place_id: placeId,
      error: error.message,
      traceId: finalTraceId
    });
    throw error;
  }
}

/**
 * Limpia lugares seleccionados (bulk)
 */
export async function cleanSelectedPlaces(placeStateIds, actor, options = {}) {
  const { traceId = null, authCtx = {} } = options;
  const finalTraceId = traceId || getRequestId();

  logInfo('PlaceService', '[PLACE][CLEAN_BULK] Iniciando limpieza masiva', {
    place_state_ids: placeStateIds,
    count: placeStateIds.length,
    actor,
    traceId: finalTraceId
  });

  try {
    const cleaned = [];
    for (const stateId of placeStateIds) {
      const state = await placeStateRepo.getById(stateId);
      if (state) {
        await placeStateRepo.updateById(stateId, {
          is_reviewed: true,
          last_cleaned_at: new Date()
        });
        cleaned.push(state);
      }
    }

    // Emitir señal bulk
    await dispatchSignal({
      signal_key: 'place.cleaned.bulk',
      payload: {
        place_state_ids: placeStateIds,
        items_count: cleaned.length,
        actor_type: actor
      },
      runtime: {
        trace_id: finalTraceId
      },
      context: {}
    }, { source: { type: 'place_service', id: 'clean_bulk' }, traceId: finalTraceId, authCtx });

    logInfo('PlaceService', '[PLACE][CLEAN_BULK] Limpieza masiva completada', {
      cleaned_count: cleaned.length,
      traceId: finalTraceId
    });

    return cleaned;
  } catch (error) {
    logError('PlaceService', '[PLACE][CLEAN_BULK] Error en limpieza masiva', {
      error: error.message,
      traceId: finalTraceId
    });
    throw error;
  }
}

/**
 * Limpia TODOS los lugares activos
 */
export async function cleanAllActivePlaces(actor, options = {}) {
  const { traceId = null, authCtx = {} } = options;
  const finalTraceId = traceId || getRequestId();

  logInfo('PlaceService', '[PLACE][CLEAN_ALL] Iniciando limpieza de todos los activos', {
    actor,
    traceId: finalTraceId
  });

  try {
    const allActive = await placeStateRepo.listAllActive();
    const placeStateIds = allActive.map(s => s.id);

    const cleaned = await cleanSelectedPlaces(placeStateIds, actor, { traceId: finalTraceId, authCtx });

    // Emitir señal específica para "todos"
    await dispatchSignal({
      signal_key: 'place.cleaned.all',
      payload: {
        items_count: cleaned.length,
        actor_type: actor
      },
      runtime: {
        trace_id: finalTraceId
      },
      context: {}
    }, { source: { type: 'place_service', id: 'clean_all' }, traceId: finalTraceId, authCtx });

    logInfo('PlaceService', '[PLACE][CLEAN_ALL] Limpieza de todos completada', {
      cleaned_count: cleaned.length,
      traceId: finalTraceId
    });

    return cleaned;
  } catch (error) {
    logError('PlaceService', '[PLACE][CLEAN_ALL] Error limpiando todos', {
      error: error.message,
      traceId: finalTraceId
    });
    throw error;
  }
}

/**
 * Maneja pausa de suscripción: desactiva TODOS los lugares activos
 */
export async function handleSubscriptionPause(studentId, options = {}) {
  const { traceId = null, authCtx = {} } = options;
  const finalTraceId = traceId || getRequestId();

  logInfo('PlaceService', '[PLACE][PAUSE] Desactivando todos los lugares por pausa', {
    student_id: studentId,
    traceId: finalTraceId
  });

  try {
    const activePlaces = await placeStateRepo.listActiveByStudent(studentId);
    
    for (const placeState of activePlaces) {
      await placeStateRepo.updateById(placeState.id, {
        is_active: false
      });
    }

    // Emitir señal
    await dispatchSignal({
      signal_key: 'place.deactivated.all',
      payload: {
        student_id: studentId,
        items_count: activePlaces.length,
        reason: 'subscription_paused'
      },
      runtime: {
        student_id: studentId,
        trace_id: finalTraceId
      },
      context: {}
    }, { source: { type: 'place_service', id: 'pause' }, traceId: finalTraceId, authCtx });

    logInfo('PlaceService', '[PLACE][PAUSE] Todos los lugares desactivados', {
      student_id: studentId,
      deactivated_count: activePlaces.length,
      traceId: finalTraceId
    });

    return activePlaces;
  } catch (error) {
    logError('PlaceService', '[PLACE][PAUSE] Error desactivando lugares por pausa', {
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
export async function updateActivationLimit(studentId, domain, value, source, options = {}) {
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

  logInfo('PlaceService', '[PLACE][LIMIT] Actualizando límite de activación', {
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
      signal_key: 'place.activation_limit.updated',
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
    }, { source: { type: 'place_service', id: 'update_limit' }, traceId: finalTraceId, authCtx });

    logInfo('PlaceService', '[PLACE][LIMIT] Límite actualizado', {
      student_id: studentId,
      domain,
      activation_limit: normalizedValue,
      source,
      traceId: finalTraceId
    });

    return limit;
  } catch (error) {
    logError('PlaceService', '[PLACE][LIMIT] Error actualizando límite', {
      student_id: studentId,
      domain,
      error: error.message,
      traceId: finalTraceId
    });
    throw error;
  }
}

/**
 * Crea un lugar para un alumno (catálogo + estado + activación)
 * 
 * Lógica canónica:
 * 1. Verifica alumno existe
 * 2. Verifica categoría existe y está activa
 * 3. Genera place_key único
 * 4. Crea en places_catalog
 * 5. Crea student_place_state activo
 * 6. Respeta límites (si actor != 'master')
 * 7. Emite señal place.activated
 */
export async function createPlaceForStudent({ studentId, name, description, categoryId, actor, options = {} }) {
  const { traceId = null, authCtx = {} } = options;
  const finalTraceId = traceId || getRequestId();

  logInfo('PlaceService', '[PLACE][CREATE_FOR_STUDENT] Iniciando creación', {
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
      throw new Error(`Alumno con suscripción pausada no puede crear lugares`);
    }

    // 2. Verificar categoría existe y está activa
    const category = await placeCategoryRepo.getById(categoryId);
    if (!category) {
      throw new Error(`Categoría no encontrada: ${categoryId}`);
    }
    if (!category.is_active) {
      throw new Error(`Categoría no está activa: ${categoryId}`);
    }

    // 3. Generar place_key único
    const timestamp = Date.now();
    const slug = name.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);
    const placeKey = `${slug}-${timestamp}`;

    // 4. Crear en places_catalog
    const place = await placeCatalogRepo.create({
      place_key: placeKey,
      category_id: categoryId,
      base_name: name
    });

    logInfo('PlaceService', '[PLACE][CREATE_FOR_STUDENT] Lugar creado en catálogo', {
      place_id: place.id,
      place_key: placeKey,
      traceId: finalTraceId
    });

    // 5. Crear student_place_state activo
    // Si actor='master', no hay límites; si no, aplicar lógica de overflow
    let placeState;
    
    if (actor === 'master') {
      // Master: crear directamente activo
      placeState = await placeStateRepo.create({
        student_id: studentId,
        place_id: place.id,
        is_active: true,
        is_reviewed: false,
        custom_name: name,
        description: description || null,
        recurrence_days: category.default_recurrence_days || 30
      });
      
      // Emitir señal
      await dispatchSignal({
        signal_key: 'place.activated',
        payload: {
          student_id: studentId,
          place_id: place.id,
          place_state_id: placeState.id,
          actor_type: actor
        },
        runtime: {
          student_id: studentId,
          trace_id: finalTraceId
        },
        context: {}
      }, { source: { type: 'place_service', id: 'create_for_student' }, traceId: finalTraceId, authCtx });
    } else {
      // No-master: usar activatePlace para respetar límites
      placeState = await activatePlace(studentId, place.id, actor, { traceId: finalTraceId, authCtx });
      
      // Actualizar custom_name y description si difieren
      if (placeState.custom_name !== name || placeState.description !== (description || null)) {
        placeState = await placeStateRepo.updateById(placeState.id, {
          custom_name: name,
          description: description || null
        });
      }
    }

    logInfo('PlaceService', '[PLACE][CREATE_FOR_STUDENT] Lugar creado y activado', {
      student_id: studentId,
      place_id: place.id,
      place_state_id: placeState.id,
      actor,
      traceId: finalTraceId
    });

    return {
      place_id: place.id,
      place_state_id: placeState.id,
      place
    };
  } catch (error) {
    logError('PlaceService', '[PLACE][CREATE_FOR_STUDENT] Error creando lugar', {
      student_id: studentId,
      name,
      category_id: categoryId,
      error: error.message,
      traceId: finalTraceId
    });
    throw error;
  }
}
