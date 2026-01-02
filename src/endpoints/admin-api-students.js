// src/endpoints/admin-api-students.js
// Handlers API para Modo Master - Student SOT v1
//
// Endpoints:
// - GET /admin/api/students/search?q=
// - GET /admin/api/students/:student_id/universe?product_key=PDE
// - POST /admin/api/students/:student_id/overrides
// - DELETE /admin/api/students/:student_id/overrides/:override_id
// - POST /admin/api/students/:student_id/domains/:domain_type/items/:item_id/activate
// - POST /admin/api/students/:student_id/domains/:domain_type/items/:item_id/clean

import { requireAdminContext } from '../core/auth-context.js';
import { getRequestId } from '../core/observability/request-context.js';
import { logError, logInfo } from '../core/observability/logger.js';
import { getStudent, getStudentByEmail, listStudents } from '../services/student-sot-service.js';
import { listDomainItemsForStudent, setActive, cleanItem, setStudentRecurrence } from '../services/student-domain-state-service.js';
import { getDefaultStudentDomainPolicyRepo } from '../infra/repos/student-domain-policy-repo-pg.js';
import { getDefaultStudentItemStateRepo } from '../infra/repos/student-item-state-repo-pg.js';
import { getDefaultStudentAuditRepo } from '../infra/repos/student-audit-repo-pg.js';
import { query } from '../../database/pg.js';

/**
 * Helper: Extrae parámetros de ruta
 */
function extractRouteParams(path, pattern) {
  const pathParts = path.split('/').filter(p => p);
  const patternParts = pattern.split('/').filter(p => p);
  const params = {};
  
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) {
      const paramName = patternParts[i].slice(1);
      params[paramName] = pathParts[i];
    }
  }
  
  return params;
}

/**
 * Helper: Respuesta JSON de error
 */
function jsonError(message, code, status = 400, traceId = null) {
  return new Response(JSON.stringify({
    ok: false,
    error: message,
    code: code || 'ERROR',
    trace_id: traceId || getRequestId()
  }), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Trace-Id': traceId || getRequestId()
    }
  });
}

/**
 * Helper: Respuesta JSON de éxito
 */
function jsonSuccess(data, traceId = null) {
  return new Response(JSON.stringify({
    ok: true,
    ...data,
    trace_id: traceId || getRequestId()
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Trace-Id': traceId || getRequestId()
    }
  });
}

/**
 * A) GET /admin/api/students/search?q=
 * Busca alumnos por nombre/email
 */
export async function searchStudentsHandler(request, env) {
  const traceId = getRequestId();
  
  try {
    const authCtx = await requireAdminContext(request, env);
    if (authCtx instanceof Response) {
      return authCtx;
    }
    
    const url = new URL(request.url);
    const q = url.searchParams.get('q') || '';
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);
    
    if (!q || q.length < 2) {
      return jsonSuccess({ students: [], total: 0 }, traceId);
    }
    
    const result = await listStudents({
      search: q,
      page: 1,
      per_page: limit
    });
    
    return jsonSuccess({
      students: result.data.map(s => ({
        id: s.id,
        email: s.email,
        display_name: s.display_name,
        estado_suscripcion: s.estado_suscripcion,
        nivel_actual: s.nivel_actual,
        streak: s.streak
      })),
      total: result.meta.total
    }, traceId);
  } catch (error) {
    logError('AdminStudentsAPI', 'Error en searchStudentsHandler', {
      error: error.message,
      traceId
    });
    
    return jsonError('Error interno del servidor', 'INTERNAL_ERROR', 500, traceId);
  }
}

/**
 * B) GET /admin/api/students/:student_id/universe?product_key=PDE
 * Devuelve el universo completo del alumno
 */
export async function getStudentUniverseHandler(request, env) {
  const traceId = getRequestId();
  const url = new URL(request.url);
  const path = url.pathname;
  
  try {
    const authCtx = await requireAdminContext(request, env);
    if (authCtx instanceof Response) {
      return authCtx;
    }
    
    const params = extractRouteParams(path, '/admin/api/students/:student_id/universe');
    const studentId = parseInt(params.student_id, 10);
    const productKey = url.searchParams.get('product_key') || 'pde';
    
    if (isNaN(studentId)) {
      return jsonError('ID de alumno inválido', 'INVALID_STUDENT_ID', 400, traceId);
    }
    
    // Obtener alumno
    const student = await getStudent(studentId);
    if (!student) {
      return jsonError('Alumno no encontrado', 'STUDENT_NOT_FOUND', 404, traceId);
    }
    
    // Obtener product memberships
    const productMembershipsResult = await query(
      'SELECT * FROM student_product_memberships WHERE student_id = $1 AND product_key = $2',
      [studentId, productKey]
    );
    const products = productMembershipsResult.rows || [];
    
    // Obtener políticas y estados por dominio
    const domains = {};
    const domainKeys = ['transmutaciones_energeticas', 'proyectos', 'lugares', 'apadrinados'];
    
    const policyRepo = getDefaultStudentDomainPolicyRepo();
    const stateRepo = getDefaultStudentItemStateRepo();
    
    for (const domainKey of domainKeys) {
      const policy = await policyRepo.getPolicy(studentId, domainKey);
      const activeItems = await stateRepo.listStates(studentId, domainKey, { isActive: true });
      const allItems = await stateRepo.listStates(studentId, domainKey);
      const activeCount = await stateRepo.countActiveItems(studentId, domainKey);
      
      const limit = policy?.active_limit_override ?? policy?.active_limit_default ?? 1;
      
      domains[domainKey] = {
        active_limit: limit,
        active_limit_override: policy?.active_limit_override,
        can_activate_multiple: policy?.can_activate_multiple || false,
        active_count: activeCount,
        active_items: activeItems.map(item => ({
          item_id: item.item_id,
          is_clean: item.is_clean,
          clean_count: item.clean_count,
          last_cleaned_at: item.last_cleaned_at,
          student_recurrence_days: item.student_recurrence_days
        })),
        all_items: allItems.map(item => ({
          item_id: item.item_id,
          is_active: item.is_active,
          is_clean: item.is_clean,
          clean_count: item.clean_count,
          last_cleaned_at: item.last_cleaned_at
        })),
        warnings: activeCount > limit ? [`Límite excedido: ${activeCount} > ${limit}`] : []
      };
    }
    
    // Obtener overrides (políticas con override)
    const allPolicies = await policyRepo.listPolicies(studentId);
    const overrides = allPolicies
      .filter(p => p.active_limit_override !== null)
      .map(p => ({
        id: p.id,
        domain_key: p.domain_key,
        active_limit_override: p.active_limit_override,
        set_by: p.set_by,
        reason: p.reason,
        created_at: p.created_at
      }));
    
    // Obtener auditoría reciente (últimos 10 eventos)
    const auditRepo = getDefaultStudentAuditRepo();
    const auditRecent = await auditRepo.listAuditEvents(studentId, {
      limit: 10,
      offset: 0
    });
    
    return jsonSuccess({
      student: {
        id: student.id,
        email: student.email,
        display_name: student.apodo || student.email,
        estado_suscripcion: student.estado_suscripcion,
        nivel_actual: student.nivel_actual,
        streak: student.streak,
        fecha_inscripcion: student.fecha_inscripcion
      },
      products: products.map(p => ({
        product_key: p.product_key,
        status: p.status,
        joined_at: p.joined_at
      })),
      domains,
      overrides,
      audit_recent: auditRecent.map(a => ({
        id: a.id,
        domain_key: a.domain_key,
        item_id: a.item_id,
        action: a.action,
        actor_type: a.actor_type,
        created_at: a.created_at
      })),
      coherence: {
        status: 'normal', // TODO: integrar con System Modes cuando esté disponible
        invariants: []
      }
    }, traceId);
  } catch (error) {
    logError('AdminStudentsAPI', 'Error en getStudentUniverseHandler', {
      studentId: params?.student_id,
      error: error.message,
      traceId
    });
    
    return jsonError('Error interno del servidor', 'INTERNAL_ERROR', 500, traceId);
  }
}

/**
 * C) POST /admin/api/students/:student_id/overrides
 * Crea un override del Master
 */
export async function createOverrideHandler(request, env) {
  const traceId = getRequestId();
  const url = new URL(request.url);
  const path = url.pathname;
  
  try {
    const authCtx = await requireAdminContext(request, env);
    if (authCtx instanceof Response) {
      return authCtx;
    }
    
    const params = extractRouteParams(path, '/admin/api/students/:student_id/overrides');
    const studentId = parseInt(params.student_id, 10);
    
    if (isNaN(studentId)) {
      return jsonError('ID de alumno inválido', 'INVALID_STUDENT_ID', 400, traceId);
    }
    
    const body = await request.json();
    const { domain_key, active_limit_override, reason } = body;
    
    if (!domain_key) {
      return jsonError('domain_key es requerido', 'MISSING_DOMAIN_KEY', 400, traceId);
    }
    
    if (active_limit_override === undefined || active_limit_override === null) {
      return jsonError('active_limit_override es requerido', 'MISSING_LIMIT', 400, traceId);
    }
    
    // Verificar que el alumno existe
    const student = await getStudent(studentId);
    if (!student) {
      return jsonError('Alumno no encontrado', 'STUDENT_NOT_FOUND', 404, traceId);
    }
    
    // Crear/actualizar política
    const policyRepo = getDefaultStudentDomainPolicyRepo();
    const policy = await policyRepo.upsertPolicy(studentId, domain_key, {
      active_limit_default: 1,
      active_limit_override: active_limit_override === -1 ? null : active_limit_override, // -1 = ilimitado, pero usamos NULL para simplificar
      set_by: 'master',
      reason: reason || 'Override del Master'
    });
    
    // Registrar evento de auditoría
    const auditRepo = getDefaultStudentAuditRepo();
    await auditRepo.createAuditEvent({
      student_id: studentId,
      domain_key: domain_key,
      item_id: 0, // No aplica para políticas
      action: 'SET_OVERRIDE',
      actor_type: 'master',
      actor_id: authCtx.user?.email || 'master',
      before: null,
      after: {
        active_limit_override: active_limit_override,
        reason: reason
      },
      trace_id: traceId
    });
    
    return jsonSuccess({
      override: {
        id: policy.id,
        domain_key: policy.domain_key,
        active_limit_override: policy.active_limit_override,
        can_activate_multiple: policy.can_activate_multiple,
        set_by: policy.set_by,
        reason: policy.reason
      }
    }, traceId);
  } catch (error) {
    logError('AdminStudentsAPI', 'Error en createOverrideHandler', {
      studentId: params?.student_id,
      error: error.message,
      traceId
    });
    
    return jsonError('Error interno del servidor', 'INTERNAL_ERROR', 500, traceId);
  }
}

/**
 * D) DELETE /admin/api/students/:student_id/overrides/:override_id
 * Soft delete de override (restaurar a default)
 */
export async function deleteOverrideHandler(request, env) {
  const traceId = getRequestId();
  const url = new URL(request.url);
  const path = url.pathname;
  
  try {
    const authCtx = await requireAdminContext(request, env);
    if (authCtx instanceof Response) {
      return authCtx;
    }
    
    const params = extractRouteParams(path, '/admin/api/students/:student_id/overrides/:override_id');
    const studentId = parseInt(params.student_id, 10);
    const overrideId = params.override_id;
    
    if (isNaN(studentId)) {
      return jsonError('ID de alumno inválido', 'INVALID_STUDENT_ID', 400, traceId);
    }
    
    // Obtener política
    const policyRepo = getDefaultStudentDomainPolicyRepo();
    const allPolicies = await policyRepo.listPolicies(studentId);
    const policy = allPolicies.find(p => p.id === overrideId);
    
    if (!policy) {
      return jsonError('Override no encontrado', 'OVERRIDE_NOT_FOUND', 404, traceId);
    }
    
    // Restaurar a default (eliminar override)
    await policyRepo.upsertPolicy(studentId, policy.domain_key, {
      active_limit_default: 1,
      active_limit_override: null,
      set_by: 'system',
      reason: 'Override retirado por Master'
    });
    
    // Registrar evento de auditoría
    const auditRepo = getDefaultStudentAuditRepo();
    await auditRepo.createAuditEvent({
      student_id: studentId,
      domain_key: policy.domain_key,
      item_id: 0,
      action: 'REMOVE_OVERRIDE',
      actor_type: 'master',
      actor_id: authCtx.user?.email || 'master',
      before: {
        active_limit_override: policy.active_limit_override
      },
      after: {
        active_limit_override: null
      },
      trace_id: traceId
    });
    
    return jsonSuccess({
      message: 'Override eliminado correctamente'
    }, traceId);
  } catch (error) {
    logError('AdminStudentsAPI', 'Error en deleteOverrideHandler', {
      studentId: params?.student_id,
      overrideId: params?.override_id,
      error: error.message,
      traceId
    });
    
    return jsonError('Error interno del servidor', 'INTERNAL_ERROR', 500, traceId);
  }
}

/**
 * E) POST /admin/api/students/:student_id/domains/:domain_type/items/:item_id/activate
 * Activa un ítem (con enforcement de límites)
 */
export async function activateItemHandler(request, env) {
  const traceId = getRequestId();
  const url = new URL(request.url);
  const path = url.pathname;
  
  try {
    const authCtx = await requireAdminContext(request, env);
    if (authCtx instanceof Response) {
      return authCtx;
    }
    
    const params = extractRouteParams(path, '/admin/api/students/:student_id/domains/:domain_type/items/:item_id/activate');
    const studentId = parseInt(params.student_id, 10);
    const domainKey = params.domain_type;
    const itemId = parseInt(params.item_id, 10);
    
    if (isNaN(studentId) || isNaN(itemId)) {
      return jsonError('IDs inválidos', 'INVALID_IDS', 400, traceId);
    }
    
    if (!domainKey) {
      return jsonError('domain_type es requerido', 'MISSING_DOMAIN', 400, traceId);
    }
    
    // Activar ítem (Master puede activar sin límites)
    const updatedState = await setActive(
      studentId,
      domainKey,
      itemId,
      true,
      { type: 'master', id: authCtx.user?.email || 'master' },
      traceId
    );
    
    return jsonSuccess({
      item_id: itemId,
      is_active: updatedState.is_active
    }, traceId);
  } catch (error) {
    logError('AdminStudentsAPI', 'Error en activateItemHandler', {
      studentId: params?.student_id,
      domainKey: params?.domain_type,
      itemId: params?.item_id,
      error: error.message,
      traceId
    });
    
    return jsonError(error.message || 'Error interno del servidor', 'INTERNAL_ERROR', 500, traceId);
  }
}

/**
 * F) POST /admin/api/students/:student_id/domains/:domain_type/items/:item_id/clean
 * Marca un ítem como limpio
 */
export async function cleanItemHandler(request, env) {
  const traceId = getRequestId();
  const url = new URL(request.url);
  const path = url.pathname;
  
  try {
    const authCtx = await requireAdminContext(request, env);
    if (authCtx instanceof Response) {
      return authCtx;
    }
    
    const params = extractRouteParams(path, '/admin/api/students/:student_id/domains/:domain_type/items/:item_id/clean');
    const studentId = parseInt(params.student_id, 10);
    const domainKey = params.domain_type;
    const itemId = parseInt(params.item_id, 10);
    
    if (isNaN(studentId) || isNaN(itemId)) {
      return jsonError('IDs inválidos', 'INVALID_IDS', 400, traceId);
    }
    
    if (!domainKey) {
      return jsonError('domain_type es requerido', 'MISSING_DOMAIN', 400, traceId);
    }
    
    // Limpiar ítem
    const updatedState = await cleanItem(
      studentId,
      domainKey,
      itemId,
      { type: 'master', id: authCtx.user?.email || 'master' },
      traceId
    );
    
    if (!updatedState) {
      return jsonError('Ítem no encontrado', 'ITEM_NOT_FOUND', 404, traceId);
    }
    
    return jsonSuccess({
      item_id: itemId,
      is_clean: updatedState.is_clean,
      clean_count: updatedState.clean_count,
      last_cleaned_at: updatedState.last_cleaned_at
    }, traceId);
  } catch (error) {
    logError('AdminStudentsAPI', 'Error en cleanItemHandler', {
      studentId: params?.student_id,
      domainKey: params?.domain_type,
      itemId: params?.item_id,
      error: error.message,
      traceId
    });
    
    return jsonError('Error interno del servidor', 'INTERNAL_ERROR', 500, traceId);
  }
}


