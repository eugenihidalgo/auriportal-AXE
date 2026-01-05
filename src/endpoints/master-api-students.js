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
import { logError, logInfo } from '../core/observability/logger.js';
import { requireAdminContext } from '../core/auth-context.js';
import { query } from '../../database/pg.js';
import { getDefaultStudentRepo } from '../infra/repos/student-repo-pg.js';

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
 * Lista alumnos con paginación y opcionalmente metadata de columnas
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
    const includeColumns = url.searchParams.get('include_columns') === 'true';
    
    logInfo('MasterAPIStudents', 'Listando alumnos', {
      limit,
      offset,
      search,
      includeColumns,
      traceId
    });
    
    // Construir query base
    const conditions = [];
    const params = [];
    let paramIndex = 1;
    
    if (search) {
      conditions.push(`(email ILIKE $${paramIndex} OR apodo ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    // Contar total
    const countResult = await query(
      `SELECT COUNT(*) as total FROM alumnos ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0]?.total || 0, 10);
    
    // Obtener items (SELECT * para obtener TODAS las columnas)
    const itemsResult = await query(
      `SELECT * FROM alumnos ${whereClause}
       ORDER BY email
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );
    
    const items = itemsResult.rows || [];
    
    // Obtener metadata de columnas (fail-open: si falla, continuar sin metadata)
    let columns = null;
    if (includeColumns) {
      columns = await getTableColumnsMetadata('alumnos');
    }
    
    // Contrato JSON canónico para /master/api/students
    // Formato: { ok: true, data: { items: [...] }, trace_id: string }
    return jsonSuccess({
      data: {
        items: items.map(s => ({
          id: s.id,
          student_id: s.id, // Alias para compatibilidad
          email: s.email,
          name: s.apodo || s.email,
          apodo: s.apodo || null
        })),
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
  } else {
    // No hay nada después de "students" → es GET /master/api/students
    if (method === 'GET') {
      return await listStudentsHandler(request, env, ctx);
    }
  }
  
  // Método no soportado
  return jsonError('Método no permitido', 'METHOD_NOT_ALLOWED', 405, getRequestId());
}
