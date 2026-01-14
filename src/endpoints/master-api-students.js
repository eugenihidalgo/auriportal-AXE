/**
 * MASTER API STUDENTS v1 - AuriPortal Master
 * 
 * Endpoints read-only para diagnóstico de alumnos (tabla técnica).
 * 
 * Endpoints:
 * - GET /master/api/students?limit=50&offset=0&search=&include_columns=true
 * - GET /master/api/students/:id
 * 
 * REGLAS:
 * - PostgreSQL es el único Source of Truth (tabla `alumnos`)
 * - Solo lectura (read-only)
 * - Incluye metadata de columnas para diagnóstico
 * - Fail-open: si metadata falla, devuelve items igualmente
 */

import { getRequestId } from '../core/observability/request-context.js';
import { logError, logInfo, logWarn } from '../core/observability/logger.js';
import { requireAdminContext } from '../core/auth-context.js';
import { query } from '../../database/pg.js';
import { getDefaultStudentRepo } from '../infra/repos/student-repo-pg.js';
import { calculateStudentDisplayNames } from '../core/helpers/student-display-name-helper.js';

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
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
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
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
      'X-Trace-Id': traceId || getRequestId()
    }
  });
}

/**
 * Obtiene metadata de columnas de la tabla alumnos
 * @param {string} tableName - Nombre de la tabla (default: 'alumnos')
 * @returns {Promise<Array>} Array de objetos con metadata de columnas
 */
async function getTableColumnsMetadata(tableName = 'alumnos') {
  try {
    const result = await query(`
      SELECT 
        column_name,
        data_type,
        character_maximum_length,
        is_nullable,
        column_default,
        ordinal_position
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `, [tableName]);
    
    return result.rows.map(row => ({
      name: row.column_name,
      type: row.data_type,
      max_length: row.character_maximum_length,
      nullable: row.is_nullable === 'YES',
      default: row.column_default,
      position: row.ordinal_position
    }));
  } catch (error) {
    logError('MasterAPIStudents', 'Error obteniendo metadata de columnas', {
      tableName,
      error: error.message
    });
    return [];
  }
}

/**
 * A) GET /master/api/students
 * Lista estudiantes con paginación
 * CAMBIADO: Usa students (UUID) como SOT, LEFT JOIN con alumnos solo para display_name
 */
export async function listStudentsHandler(request, env, ctx) {
  const traceId = getRequestId();
  
  // Auth: usar requireAdminContext (mismo sistema de sesión que MASTER)
  // Para APIs MASTER, requireAdminContext puede devolver Response (redirect) o contexto
  // Si devuelve Response, convertir a JSON 401 (contrato API MASTER)
  let authCtx;
  try {
    authCtx = await requireAdminContext(request, env);
    if (authCtx instanceof Response) {
      // requireAdminContext devolvió redirect (no autenticado)
      // Para APIs MASTER, devolver JSON 401 en lugar de redirect
      return jsonError('No autorizado', 'UNAUTHORIZED', 401, traceId);
    }
  } catch (authError) {
    logError('MasterAPIStudents', 'Error en requireAdminContext', {
      error: authError.message,
      traceId
    });
    return jsonError('Error de autenticación', 'AUTH_ERROR', 401, traceId);
  }
  
  try {
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200); // Max 200
    const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10), 0);
    const search = url.searchParams.get('search') || '';
    
    logInfo('MasterAPIStudents', 'Listando estudiantes (UUID-first)', {
      limit,
      offset,
      search,
      traceId
    });
    
    // WARNING: Acceso a tabla alumnos (legacy) para display_name
    logWarn('MasterAPIStudents', 'Acceso a tabla alumnos (legacy) para display_name', {
      traceId,
      method: 'listStudentsHandler',
      note: 'Se mantiene para compatibilidad de display_name, pero la SOT es students'
    });
    
    // Construir query base desde students (UUID) como SOT
    // LEFT JOIN con alumnos solo para display_name
    // LEFT JOIN con pausas para verificar pausa
    const conditions = [];
    const params = [];
    let paramIndex = 1;
    
    // Filtrar estudiantes eliminados
    conditions.push('s.deleted_at IS NULL');
    
    if (search) {
      // Búsqueda en email, apodo, nombre_completo (desde alumnos)
      conditions.push(`(a.email ILIKE $${paramIndex} OR a.apodo ILIKE $${paramIndex} OR a.nombre_completo ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    // Contar total (solo estudiantes no eliminados)
    const countResult = await query(
      `SELECT COUNT(*) as total 
       FROM students s
       ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0]?.total || 0, 10);
    
    // Obtener estudiantes desde students (UUID) como SOT
    // UUID-ONLY: display_name ahora está en students (apodo, nombre_completo, email)
    // LEFT JOIN con pausas para verificar pausa (pausas.student_id ahora es UUID)
    const itemsResult = await query(
      `SELECT 
         s.id as student_uuid,
         s.email,
         s.apodo,
         s.nombre_completo,
         CASE WHEN p.id IS NOT NULL THEN true ELSE false END as paused
       FROM students s
       LEFT JOIN pausas p ON p.student_id = s.id AND p.fin IS NULL
       ${whereClause}
       ORDER BY COALESCE(s.email, s.id::text) ASC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );
    
    const rawItems = itemsResult.rows || [];
    
    // Calcular display_name usando helper canónico
    // El helper espera objetos con: id, apodo, nombre_completo, email
    const studentsForDisplay = rawItems.map(row => ({
      id: row.student_uuid, // Usar UUID como id para el helper
      apodo: row.apodo || null,
      nombre_completo: row.nombre_completo || null,
      email: row.email || null
    }));
    
    const studentsWithDisplay = await calculateStudentDisplayNames(studentsForDisplay);
    
    // Construir response canónico: solo student_uuid, display_name, email, paused
    const students = rawItems.map((row, index) => {
      const displayData = studentsWithDisplay[index];
      return {
        student_uuid: row.student_uuid,
        display_name: displayData?.display_name || row.email || 'Sin nombre',
        email: row.email || null,
        paused: row.paused || false
      };
    });
    
    logInfo('MasterAPIStudents', 'Estudiantes listados (UUID-first)', {
      traceId,
      count: students.length,
      total
    });
    
    // Contrato JSON canónico para /master/api/students
    // Formato: { ok: true, data: { students: [...] }, trace_id: string }
    return jsonSuccess({
      data: {
        students,
        total,
        limit,
        offset
      }
    }, traceId);
  } catch (error) {
    logError('MasterAPIStudents', 'Error en listStudentsHandler', {
      error: error.message,
      traceId,
      stack: error.stack
    });
    
    return jsonError('Error interno del servidor', 'INTERNAL_ERROR', 500, traceId);
  }
}

/**
 * Obtiene tablas relacionadas que referencian alumnos.id
 * @param {number} studentId - ID del alumno
 * @returns {Promise<Object>} Objeto con información de tablas relacionadas
 */
async function getRelatedTables(studentId) {
  try {
    // Buscar tablas que tienen foreign keys a alumnos.id
    const fkResult = await query(`
      SELECT 
        tc.table_name,
        kcu.column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE 
        tc.constraint_type = 'FOREIGN KEY'
        AND ccu.table_name = 'alumnos'
        AND ccu.column_name = 'id'
        AND tc.table_schema = 'public'
      ORDER BY tc.table_name
    `);
    
    const relatedTables = {};
    
    // Para cada tabla relacionada, contar registros del alumno
    for (const row of fkResult.rows) {
      const tableName = row.table_name;
      const columnName = row.column_name;
      
      try {
        const countResult = await query(
          `SELECT COUNT(*) as count FROM ${tableName} WHERE ${columnName} = $1`,
          [studentId]
        );
        const count = parseInt(countResult.rows[0]?.count || 0, 10);
        
        relatedTables[tableName] = {
          column: columnName,
          count
        };
      } catch (err) {
        // Fail-open: si no se puede contar, omitir la tabla
        logError('MasterAPIStudents', 'Error contando registros en tabla relacionada', {
          tableName,
          columnName,
          studentId,
          error: err.message
        });
      }
    }
    
    return relatedTables;
  } catch (error) {
    logError('MasterAPIStudents', 'Error obteniendo tablas relacionadas', {
      studentId,
      error: error.message
    });
    return {};
  }
}

/**
 * B) GET /master/api/students/:id
 * Obtiene un alumno por ID con información relacionada
 */
export async function getStudentByIdHandler(request, env, ctx) {
  const traceId = getRequestId();
  const url = new URL(request.url);
  const path = url.pathname;
  
  // Auth: usar requireAdminContext (mismo sistema de sesión que MASTER)
  // Para APIs MASTER, requireAdminContext puede devolver Response (redirect) o contexto
  // Si devuelve Response, convertir a JSON 401 (contrato API MASTER)
  let authCtx;
  try {
    authCtx = await requireAdminContext(request, env);
    if (authCtx instanceof Response) {
      // requireAdminContext devolvió redirect (no autenticado)
      // Para APIs MASTER, devolver JSON 401 en lugar de redirect
      return jsonError('No autorizado', 'UNAUTHORIZED', 401, traceId);
    }
  } catch (authError) {
    logError('MasterAPIStudents', 'Error en requireAdminContext', {
      error: authError.message,
      traceId
    });
    return jsonError('Error de autenticación', 'AUTH_ERROR', 401, traceId);
  }
  
  try {
    // Extraer ID del path (formato: /master/api/students/123)
    const pathParts = path.split('/').filter(p => p);
    const studentIdIndex = pathParts.indexOf('students');
    
    if (studentIdIndex === -1 || studentIdIndex >= pathParts.length - 1) {
      return jsonError('ID de alumno no proporcionado', 'MISSING_STUDENT_ID', 400, traceId);
    }
    
    const studentId = parseInt(pathParts[studentIdIndex + 1], 10);
    
    if (isNaN(studentId)) {
      return jsonError('ID de alumno inválido', 'INVALID_STUDENT_ID', 400, traceId);
    }
    
    logInfo('MasterAPIStudents', 'Obteniendo alumno por ID', {
      studentId,
      traceId
    });
    
    // Obtener alumno
    const repo = getDefaultStudentRepo();
    const student = await repo.getById(studentId);
    
    if (!student) {
      return jsonError('Alumno no encontrado', 'STUDENT_NOT_FOUND', 404, traceId);
    }
    
    // Obtener tablas relacionadas (fail-open: si falla, continuar sin related)
    const related = await getRelatedTables(studentId);
    
    return jsonSuccess({
      data: {
        student,
        related: Object.keys(related).length > 0 ? related : undefined
      }
    }, traceId);
  } catch (error) {
    logError('MasterAPIStudents', 'Error en getStudentByIdHandler', {
      error: error.message,
      traceId,
      stack: error.stack
    });
    
    return jsonError('Error interno del servidor', 'INTERNAL_ERROR', 500, traceId);
  }
}

/**
 * Handler POST /master/api/students (Crear alumno canónico)
 */
async function createStudentHandler(request, env, ctx) {
  const traceId = getRequestId();
  
  try {
    logInfo('MasterAPIStudents', 'POST /master/api/students - Crear alumno', {
      traceId
    });
    
    // Parsear body JSON
    let body;
    try {
      body = await request.json();
    } catch (jsonError) {
      return jsonError('Body JSON inválido', 'INVALID_JSON', 400, traceId);
    }
    
    const { email, apodo = null, nombre_completo = null } = body;
    
    // Validar email (obligatorio)
    if (!email || typeof email !== 'string' || !email.trim()) {
      return jsonError('Email es obligatorio', 'EMAIL_REQUIRED', 400, traceId);
    }
    
    const normalizedEmail = email.toLowerCase().trim();
    
    // Validar formato de email básico
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return jsonError('Email inválido', 'INVALID_EMAIL', 400, traceId);
    }
    
    logInfo('MasterAPIStudents', 'Creando alumno canónico', {
      traceId,
      email: normalizedEmail,
      apodo,
      nombre_completo
    });
    
    // Llamar al servicio canónico de creación
    const { createStudentCanonical } = await import('../core/master/services/student-creation-service.js');
    const result = await createStudentCanonical({
      email: normalizedEmail,
      apodo: apodo || null,
      nombre_completo: nombre_completo || null
    });
    
    logInfo('MasterAPIStudents', 'Alumno creado exitosamente', {
      traceId,
      student_uuid: result.student_uuid,
      email: result.email,
      display_name: result.display_name
    });
    
    return jsonSuccess({
      student_uuid: result.student_uuid,
      display_name: result.display_name,
      email: result.email
    }, traceId);
    
  } catch (error) {
    logError('MasterAPIStudents', 'Error creando alumno', {
      traceId,
      error: error.message,
      stack: error.stack
    });
    
    // Si es error de unicidad (email duplicado), retornar error amigable
    if (error.message?.includes('ya existe') || error.code === '23505') {
      return jsonError('Email ya existe', 'EMAIL_EXISTS', 409, traceId);
    }
    
    return jsonError('Error interno del servidor', 'INTERNAL_ERROR', 500, traceId);
  }
}

/**
 * Handler principal (despacha según método HTTP)
 */
export default async function masterApiStudentsHandler(request, env, ctx) {
  const method = request.method;
  const url = new URL(request.url);
  const path = url.pathname;
  
  // Detectar si es GET /master/api/students/:id o GET /master/api/students
  const pathParts = path.split('/').filter(p => p);
  const studentsIndex = pathParts.indexOf('students');
  
  if (studentsIndex !== -1 && studentsIndex < pathParts.length - 1) {
    // Hay algo después de "students" → es GET /master/api/students/:id
    if (method === 'GET') {
      return await getStudentByIdHandler(request, env, ctx);
    }
  } else if (path === '/master/api/students/list') {
    // GET /master/api/students/list → Lista simple (UUID + nombre)
    if (method === 'GET') {
      return await listStudentsSimpleHandler(request, env, ctx);
    }
  } else {
    // No hay nada después de "students" → es GET /master/api/students o POST /master/api/students
    if (method === 'GET') {
      return await listStudentsHandler(request, env, ctx);
    } else if (method === 'POST') {
      return await createStudentHandler(request, env, ctx);
    }
  }
  
  // Método no soportado
  return jsonError('Método no permitido', 'METHOD_NOT_ALLOWED', 405, getRequestId());
}
