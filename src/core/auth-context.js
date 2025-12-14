// src/core/auth-context.js
// Módulo centralizado de contexto de autenticación
// 
// REGLA EXPLÍCITA: Los endpoints no gestionan autenticación; solo consumen contexto.
// Este módulo centraliza toda la lógica de autenticación y validación de sesiones.

import { getCookieData, clearCookie } from './cookies.js';
import { findStudentByEmail, getOrCreateStudent } from '../modules/student-v4.js';
import { validateAdminSession } from '../modules/admin-auth.js';
import { renderPantalla0 } from './responses.js';
import { renderHtml } from './html-response.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar template de login admin
const loginTemplate = readFileSync(join(__dirname, '../core/html/admin/login.html'), 'utf-8');

/**
 * Reemplaza placeholders en templates
 */
function replace(html, placeholders) {
  let output = html;
  for (const key in placeholders) {
    const value = placeholders[key] ?? "";
    const regex = new RegExp(`{{${key}}}`, "g");
    output = output.replace(regex, value);
  }
  return output;
}

/**
 * Renderiza la pantalla de login de admin
 */
function renderAdminLogin() {
  const html = replace(loginTemplate, {
    ERROR_MESSAGE: ''
  });
  return renderHtml(html);
}

/**
 * Requiere contexto de estudiante autenticado
 * 
 * Si no hay cookie o el estudiante no existe, devuelve directamente
 * una respuesta HTML (pantalla0) usando renderHtml().
 * 
 * Si el estudiante existe, devuelve un objeto ctx con:
 * - user: objeto estudiante
 * - isAdmin: false
 * - isAuthenticated: true
 * - request: el request original
 * 
 * @param {Request} request - Request object
 * @param {object} env - Variables de entorno
 * @returns {object|Response} Contexto de autenticación o Response HTML
 */
export async function requireStudentContext(request, env) {
  // Leer cookie usando core/cookies.js
  const cookie = getCookieData(request);
  
  if (!cookie || !cookie.email) {
    // Si no hay cookie → Pantalla 0 (recuperar sesión con email)
    console.log(`⚠️  [auth-context] No hay cookie válida, mostrando pantalla 0`);
    return renderPantalla0();
  }
  
  // Normalizar email de la cookie
  const emailCookie = cookie.email.toLowerCase().trim();
  console.log(`✅ [auth-context] Cookie válida encontrada para: "${emailCookie}"`);
  
  // Verificar que existe en PostgreSQL (fuente de verdad)
  console.log(`🔍 [auth-context] Verificando si ${emailCookie} existe en PostgreSQL...`);
  let student = await findStudentByEmail(env, emailCookie);
  
  if (!student) {
    // Si no existe en PostgreSQL, limpiar cookie y mostrar pantalla de inscripción
    console.log(`⚠️  [auth-context] ${emailCookie} no existe en PostgreSQL, limpiando cookie`);
    const response = renderPantalla0();
    // Clonar response para poder modificar headers
    const newHeaders = new Headers(response.headers);
    newHeaders.set("Set-Cookie", clearCookie(request));
    return new Response(response.body, {
      status: 403,
      headers: newHeaders
    });
  }
  
  // Si existe, usar getOrCreateStudent para asegurar datos actualizados
  student = await getOrCreateStudent(emailCookie, env);
  
  // Devolver contexto de autenticación
  return {
    user: student,
    isAdmin: false,
    isAuthenticated: true,
    request
  };
}

/**
 * Requiere contexto de admin autenticado
 * 
 * Si no hay sesión admin válida, devuelve directamente
 * una respuesta HTML (login admin) usando renderHtml().
 * 
 * Si la sesión es válida, devuelve un objeto ctx con:
 * - user: objeto admin (simplificado, solo indicador de admin)
 * - isAdmin: true
 * - isAuthenticated: true
 * - request: el request original
 * 
 * @param {Request} request - Request object
 * @param {object} env - Variables de entorno
 * @returns {object|Response} Contexto de autenticación o Response HTML
 */
export async function requireAdminContext(request, env) {
  // Validar sesión admin usando admin-auth.js
  const isValidSession = validateAdminSession(request);
  
  if (!isValidSession) {
    // Si no hay sesión válida → pantalla de login admin
    console.log(`⚠️  [auth-context] No hay sesión admin válida, mostrando login`);
    return renderAdminLogin();
  }
  
  // Devolver contexto de autenticación admin
  return {
    user: { isAdmin: true }, // Objeto admin simplificado
    isAdmin: true,
    isAuthenticated: true,
    request
  };
}


