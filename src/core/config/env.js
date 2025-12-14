// src/core/config/env.js
// Módulo de gestión segura de variables de entorno
// NO expone secretos en logs ni consola

import dotenv from 'dotenv';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '../../../');

/**
 * Carga el archivo .env si es necesario
 * @param {Object} options - Opciones de carga
 * @param {boolean} options.force - Forzar carga incluso en producción
 * @param {string} options.envFile - Ruta personalizada al archivo .env (por defecto: .env)
 * @returns {Object} Resultado de la carga { loaded: boolean, path: string }
 */
export function loadEnvIfNeeded(options = {}) {
  const { force = false, envFile = '.env' } = options;
  
  // En producción, PM2 normalmente carga las variables desde env_file
  // Solo cargar .env manualmente si:
  // 1. No estamos en producción, O
  // 2. Se fuerza con el flag force, O
  // 3. Las variables críticas no están ya cargadas
  const isProduction = process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'prod';
  
  // Si ya hay variables críticas cargadas, no necesitamos cargar .env
  const hasCriticalVars = process.env.CLICKUP_API_TOKEN || process.env.DATABASE_URL || process.env.PGUSER;
  
  if (isProduction && !force && hasCriticalVars) {
    // En producción con variables ya cargadas (probablemente por PM2), no cargar .env
    return { loaded: false, path: null, reason: 'Variables ya cargadas por PM2 o sistema' };
  }
  
  // Construir ruta al archivo .env
  const envPath = join(PROJECT_ROOT, envFile);
  
  if (!existsSync(envPath)) {
    return { loaded: false, path: envPath, reason: 'Archivo .env no encontrado' };
  }
  
  // Cargar .env
  const result = dotenv.config({ path: envPath });
  
  if (result.error) {
    console.error(`⚠️  Error cargando ${envFile}:`, result.error.message);
    return { loaded: false, path: envPath, error: result.error };
  }
  
  return { loaded: true, path: envPath };
}

/**
 * Valida que existan las variables de entorno requeridas
 * @param {string[]} requiredKeys - Array de nombres de variables requeridas
 * @throws {Error} Si faltan variables requeridas (sin exponer valores)
 */
export function getRequiredEnv(requiredKeys) {
  const missing = [];
  const present = [];
  
  for (const key of requiredKeys) {
    const value = process.env[key];
    if (!value || value.trim() === '' || value === `<${key}>` || value.startsWith('<')) {
      missing.push(key);
    } else {
      present.push(key);
    }
  }
  
  if (missing.length > 0) {
    const snapshot = redactedEnvSnapshot(requiredKeys);
    const error = new Error(
      `Faltan ${missing.length} variable(s) de entorno requerida(s): ${missing.join(', ')}\n` +
      `Estado de variables:\n${JSON.stringify(snapshot, null, 2)}\n` +
      `Verifica que el archivo .env existe y contiene todas las variables necesarias.\n` +
      `Consulta .env.example para ver la lista completa.`
    );
    error.missing = missing;
    error.present = present;
    error.snapshot = snapshot;
    throw error;
  }
  
  return true;
}

/**
 * Genera un snapshot de variables de entorno sin exponer valores reales
 * @param {string[]} keys - Array de nombres de variables a verificar
 * @returns {Object} Objeto con {KEY: '***' | '(missing)'}
 */
export function redactedEnvSnapshot(keys) {
  const snapshot = {};
  
  for (const key of keys) {
    const value = process.env[key];
    if (!value || value.trim() === '' || value === `<${key}>` || value.startsWith('<')) {
      snapshot[key] = '(missing)';
    } else {
      // Mostrar solo los últimos 4 caracteres si es un token/secreto largo
      if (value.length > 8) {
        snapshot[key] = '***' + value.slice(-4);
      } else {
        snapshot[key] = '***';
      }
    }
  }
  
  return snapshot;
}

/**
 * Verifica si el archivo .env existe
 * @param {string} envFile - Nombre del archivo .env (por defecto: .env)
 * @returns {boolean}
 */
export function envFileExists(envFile = '.env') {
  const envPath = join(PROJECT_ROOT, envFile);
  return existsSync(envPath);
}

/**
 * Obtiene la lista de variables de entorno requeridas según el contexto
 * @returns {string[]} Array de nombres de variables requeridas
 */
export function getRequiredEnvKeys() {
  // Variables obligatorias para que el servidor arranque correctamente
  const required = [
    // ClickUp (obligatorio - usado en múltiples endpoints)
    'CLICKUP_API_TOKEN',
    
    // PostgreSQL (obligatorio - puede ser DATABASE_URL o variables individuales)
    // Si existe DATABASE_URL, no se requieren las individuales
    // Si no existe DATABASE_URL, se requieren las individuales
    ...(process.env.DATABASE_URL ? [] : [
      'PGHOST',
      'PGDATABASE',
      'PGUSER',
      'PGPASSWORD'
    ]),
    
    // Google Worker (obligatorio según requerimientos - usado para transcripciones)
    'GOOGLE_WORKER_URL',
    'GOOGLE_WORKER_SECRET',
  ];
  
  // Nota: CLICKUP_FOLDER_ID, CLICKUP_TEAM_ID, CLICKUP_SPACE_ID tienen valores
  // por defecto en src/config/config.js, por lo que no son obligatorias aquí.
  // Si necesitas valores específicos, configúralos en .env
  
  return required.filter(Boolean);
}
