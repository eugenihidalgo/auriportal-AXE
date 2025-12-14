// src/modules/admin-auth.js
// Autenticación simple para Admin Panel AuriPortal v4

import crypto from 'crypto';

const ADMIN_USER = process.env.ADMIN_USER || 'eugeni';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';
const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || 'change-this-secret-in-production';
const SESSION_DURATION = 12 * 60 * 60 * 1000; // 12 horas en milisegundos
const REMEMBER_ME_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 días en milisegundos

// Almacenamiento simple de sesiones en memoria (para producción usar Redis o similar)
const activeSessions = new Map();

/**
 * Crea un token de sesión firmado
 * @param {boolean} rememberMe - Si es true, la sesión dura 30 días, si no, 12 horas
 */
function createSessionToken(rememberMe = false) {
  const token = crypto.randomBytes(32).toString('hex');
  const duration = rememberMe ? REMEMBER_ME_DURATION : SESSION_DURATION;
  const expires = Date.now() + duration;
  const signature = crypto
    .createHmac('sha256', ADMIN_SESSION_SECRET)
    .update(`${token}:${expires}`)
    .digest('hex');
  
  return `${token}:${expires}:${signature}`;
}

/**
 * Valida un token de sesión
 */
function validateSessionToken(tokenString) {
  try {
    const [token, expires, signature] = tokenString.split(':');
    
    if (!token || !expires || !signature) {
      return false;
    }
    
    // Verificar expiración
    if (Date.now() > parseInt(expires)) {
      return false;
    }
    
    // Verificar firma
    const expectedSignature = crypto
      .createHmac('sha256', ADMIN_SESSION_SECRET)
      .update(`${token}:${expires}`)
      .digest('hex');
    
    if (signature !== expectedSignature) {
      return false;
    }
    
    // Verificar que la sesión esté activa
    if (!activeSessions.has(token)) {
      return false;
    }
    
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Valida credenciales de admin
 */
export function validateAdminCredentials(username, password) {
  return username === ADMIN_USER && password === ADMIN_PASS;
}

/**
 * Crea una sesión admin y devuelve el token
 * @param {boolean} rememberMe - Si es true, la sesión dura 30 días, si no, 12 horas
 */
export function createAdminSession(rememberMe = false) {
  const token = createSessionToken(rememberMe);
  const sessionId = token.split(':')[0];
  const duration = rememberMe ? REMEMBER_ME_DURATION : SESSION_DURATION;
  
  activeSessions.set(sessionId, {
    createdAt: Date.now(),
    expiresAt: Date.now() + duration
  });
  
  // Limpiar sesiones expiradas periódicamente
  if (activeSessions.size > 100) {
    cleanupExpiredSessions();
  }
  
  return { token, rememberMe };
}

/**
 * Valida si hay una sesión admin activa desde la cookie
 */
export function validateAdminSession(request) {
  const cookies = request.headers.get('Cookie') || '';
  const cookieMatch = cookies.match(/admin_session=([^;]+)/);
  
  if (!cookieMatch) {
    return false;
  }
  
  const token = decodeURIComponent(cookieMatch[1]);
  return validateSessionToken(token);
}

/**
 * Cierra una sesión admin
 */
export function destroyAdminSession(request) {
  const cookies = request.headers.get('Cookie') || '';
  const cookieMatch = cookies.match(/admin_session=([^;]+)/);
  
  if (cookieMatch) {
    const token = decodeURIComponent(cookieMatch[1]);
    const sessionId = token.split(':')[0];
    activeSessions.delete(sessionId);
  }
}

/**
 * Limpia sesiones expiradas
 */
function cleanupExpiredSessions() {
  const now = Date.now();
  for (const [sessionId, session] of activeSessions.entries()) {
    if (now > session.expiresAt) {
      activeSessions.delete(sessionId);
    }
  }
}

/**
 * Middleware: Requiere autenticación admin
 */
export function requireAdminAuth(request) {
  if (!validateAdminSession(request)) {
    return {
      requiresAuth: true,
      redirect: '/admin/login'
    };
  }
  return { requiresAuth: false };
}

