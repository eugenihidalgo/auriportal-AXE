// execution-context-builders.js
// Builders para ExecutionContext
//
// Responsabilidades:
// - Construir ExecutionContext para paquetes
// - Construir ExecutionContext para temas

import { randomUUID } from 'crypto';
import { getRequestId } from '../observability/request-context.js';

/**
 * Construye ExecutionContext para un paquete PDE
 * 
 * @param {Object} options - Opciones
 * @param {Object} options.packageDefinition - Definición del paquete
 * @param {Object} options.inputs - Inputs explícitos del usuario
 * @param {Object} options.snapshot - Context Snapshot v1
 * @param {string} [options.requestId] - Request ID
 * @returns {Object} ExecutionContext
 */
export function buildExecutionContextForPackage({
  packageDefinition,
  inputs = {},
  snapshot,
  requestId = null
}) {
  if (!packageDefinition || !packageDefinition.package_key) {
    throw new Error('buildExecutionContextForPackage: packageDefinition.package_key is required');
  }

  if (!snapshot) {
    throw new Error('buildExecutionContextForPackage: snapshot is required');
  }

  const executionId = `exec-${Date.now()}-${randomUUID().substring(0, 8)}`;
  const reqId = requestId || snapshot.identity?.requestId || getRequestId() || `req-${Date.now()}`;

  // Determinar actor desde snapshot
  const actorType = snapshot.identity?.actorType || 'anonymous';
  const actorId = snapshot.identity?.actorType === 'student' ? snapshot.identity?.actorId : null;
  const actorEmail = snapshot.identity?.actorType === 'student' ? snapshot.identity?.email : null;

  return {
    executionType: 'package_run',
    executionId,
    requestId: reqId,
    actor: {
      type: actorType,
      id: actorId,
      email: actorEmail
    },
    target: {
      type: 'package',
      key: packageDefinition.package_key,
      definition: packageDefinition
    },
    inputs,
    snapshot,
    env: {
      app_env: snapshot.environment?.env || (process.env.APP_ENV || 'prod')
    },
    flags: snapshot.flags || {},
    time: {
      now: snapshot.time?.now || new Date(),
      dayKey: snapshot.time?.dayKey || new Date().toISOString().substring(0, 10),
      timestamp: snapshot.time?.timestamp || Date.now()
    },
    meta: {
      createdAt: new Date(),
      purpose: 'package'
    }
  };
}

/**
 * Construye ExecutionContext para un tema (Theme)
 * 
 * @param {Object} options - Opciones
 * @param {Object} options.themeDefinition - Definición del tema
 * @param {Object} options.snapshot - Context Snapshot v1
 * @param {string} [options.requestId] - Request ID
 * @returns {Object} ExecutionContext
 */
export function buildExecutionContextForTheme({
  themeDefinition,
  snapshot,
  requestId = null
}) {
  if (!themeDefinition || (!themeDefinition.theme_key && !themeDefinition.id)) {
    throw new Error('buildExecutionContextForTheme: themeDefinition.theme_key or themeDefinition.id is required');
  }

  if (!snapshot) {
    throw new Error('buildExecutionContextForTheme: snapshot is required');
  }

  const executionId = `exec-${Date.now()}-${randomUUID().substring(0, 8)}`;
  const reqId = requestId || snapshot.identity?.requestId || getRequestId() || `req-${Date.now()}`;

  // Determinar actor desde snapshot
  const actorType = snapshot.identity?.actorType || 'anonymous';
  const actorId = snapshot.identity?.actorType === 'student' ? snapshot.identity?.actorId : null;
  const actorEmail = snapshot.identity?.actorType === 'student' ? snapshot.identity?.email : null;

  return {
    executionType: 'theme_render',
    executionId,
    requestId: reqId,
    actor: {
      type: actorType,
      id: actorId,
      email: actorEmail
    },
    target: {
      type: 'theme',
      key: themeDefinition.theme_key || themeDefinition.id,
      definition: themeDefinition
    },
    inputs: {}, // Los temas no tienen inputs explícitos por ahora
    snapshot,
    env: {
      app_env: snapshot.environment?.env || (process.env.APP_ENV || 'prod')
    },
    flags: snapshot.flags || {},
    time: {
      now: snapshot.time?.now || new Date(),
      dayKey: snapshot.time?.dayKey || new Date().toISOString().substring(0, 10),
      timestamp: snapshot.time?.timestamp || Date.now()
    },
    meta: {
      createdAt: new Date(),
      purpose: 'theme'
    }
  };
}

