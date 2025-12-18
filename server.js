// server.js
// Servidor Node.js para AuriPortal v3.1
// Migrado desde Cloudflare Workers para funcionar en VPS

import http from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';

// Cargar y validar variables de entorno (sin exponer secretos)
import { loadEnvIfNeeded, getRequiredEnv, getRequiredEnvKeys } from './src/core/config/env.js';

// Cargar variables de entorno si es necesario
// Verificar primero si faltan variables críticas
const needsEnvLoad = !process.env.ADMIN_USER || !process.env.ADMIN_PASS || 
                     !process.env.PGHOST || !process.env.PGUSER || !process.env.PGPASSWORD;
const envLoadResult = loadEnvIfNeeded({ force: needsEnvLoad });
if (envLoadResult.loaded) {
  console.log(`📁 Variables de entorno cargadas desde: ${envLoadResult.path}`);
} else if (envLoadResult.reason) {
  console.log(`ℹ️  ${envLoadResult.reason}`);
  // Si faltan variables críticas, intentar forzar carga
  if (needsEnvLoad) {
    console.log('⚠️  Variables críticas faltantes, forzando carga de .env...');
    const forcedResult = loadEnvIfNeeded({ force: true });
    if (forcedResult.loaded) {
      console.log(`✅ Variables de entorno cargadas forzadamente desde: ${forcedResult.path}`);
    } else {
      console.error(`❌ No se pudo cargar .env: ${forcedResult.reason || forcedResult.error?.message}`);
    }
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================================
// BLINDAJE DE VARIABLES DE ENTORNO - Inicializadas al arranque del servidor
// ============================================================================
// Estas variables se establecen UNA SOLA VEZ al inicio y NO cambian durante
// la ejecución del servidor, garantizando consistencia en cache busting

// APP_VERSION: Desde package.json (versión del proyecto)
let APP_VERSION;
try {
  const packageJsonPath = join(__dirname, 'package.json');
  if (existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    APP_VERSION = packageJson.version || '4.0.0';
  } else {
    APP_VERSION = '4.0.0';
  }
} catch (error) {
  console.warn('⚠️  No se pudo leer package.json, usando versión por defecto');
  APP_VERSION = '4.0.0';
}

// BUILD_ID: Git commit hash (si está disponible) o timestamp del arranque
let BUILD_ID;
try {
  // Intentar obtener commit hash de git
  BUILD_ID = execSync('git rev-parse --short HEAD', { encoding: 'utf-8', cwd: __dirname, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
} catch (error) {
  // Si no hay git o falla, usar timestamp del arranque
  BUILD_ID = Date.now().toString();
}

// SERVER_START_TIME: Timestamp del arranque del servidor
const SERVER_START_TIME = Date.now();

// APP_ENV: Entorno de ejecución (dev | beta | prod)
// Si no está definido, intentar inferirlo de NODE_ENV o usar 'prod' por defecto
let APP_ENV = process.env.APP_ENV;
if (!APP_ENV) {
  if (process.env.NODE_ENV === 'development') {
    APP_ENV = 'dev';
  } else {
    APP_ENV = 'prod'; // Por defecto producción
  }
}

// Establecer variables de entorno inmutables (sobrescriben cualquier valor previo)
process.env.APP_VERSION = APP_VERSION;
process.env.BUILD_ID = BUILD_ID;
process.env.SERVER_START_TIME = SERVER_START_TIME.toString();
process.env.APP_ENV = APP_ENV; // Asegurar que APP_ENV está establecido

// Banner de inicio con información del entorno
console.log('');
console.log('═══════════════════════════════════════════════════════════════');
console.log(`🚀 AuriPortal Server - Entorno: ${APP_ENV.toUpperCase()}`);
console.log('═══════════════════════════════════════════════════════════════');
console.log(`📦 Versión de aplicación: ${APP_VERSION}`);
console.log(`🔨 Build ID: ${BUILD_ID}`);
console.log(`🌍 Entorno: ${APP_ENV}`);
console.log(`⏰ Servidor iniciado: ${new Date(SERVER_START_TIME).toISOString()}`);
console.log('═══════════════════════════════════════════════════════════════');
console.log('');

// ============================================================================
// FASE 1 - VERIFICACIÓN DE ENTORNO (OBLIGATORIA)
// ============================================================================
console.log('[ENV CHECK]', {
  ADMIN_USER: !!process.env.ADMIN_USER,
  ADMIN_PASS: !!process.env.ADMIN_PASS,
  PGHOST: !!process.env.PGHOST,
  PGDATABASE: !!process.env.PGDATABASE,
  PGUSER: !!process.env.PGUSER,
  PGPASSWORD_TYPE: typeof process.env.PGPASSWORD,
  NODE_ENV: process.env.NODE_ENV,
  APP_ENV: process.env.APP_ENV
});

if (!process.env.ADMIN_USER || !process.env.ADMIN_PASS) {
  console.log('[ENV CHECK] ERROR: ADMIN_USER / ADMIN_PASS no están configurados');
}
// ============================================================================

// Importar router y validación
import { router } from './src/router.js';
import { initPostgreSQL } from './database/pg.js';
import { validateEnvironmentVariables } from './src/config/validate.js';
import { iniciarScheduler } from './src/services/scheduler.js';
import { initRequestContext } from './src/core/observability/request-context.js';

// Validar variables de entorno requeridas al inicio (falla temprano si faltan)
console.log('🔍 Validando variables de entorno requeridas...');
try {
  const requiredKeys = getRequiredEnvKeys();
  getRequiredEnv(requiredKeys);
  console.log('✅ Todas las variables requeridas están configuradas');
} catch (error) {
  console.error('❌ ERROR: Variables de entorno requeridas faltantes');
  console.error(error.message);
  console.error('\n⚠️  El servidor no puede iniciar sin estas variables.');
  console.error('   Ejecuta: node scripts/verify-env.js para más detalles.\n');
  process.exit(1);
}

// Inicializar base de datos PostgreSQL (única fuente de verdad v4)
initPostgreSQL();

// Inicializar UI & Experience System v1 (auto-registra layers)
import('./src/core/ui-experience/init.js')
  .then(() => {
    console.log('✅ UI & Experience System v1 inicializado (layers auto-registrados)');
  })
  .catch((error) => {
    console.warn('⚠️  Error inicializando UI & Experience System:', error.message);
    // No fallar el servidor si el sistema UI no se puede inicializar (fail-open)
  });

// Inicializar Motor de Automatizaciones (AUTO-1)
import('./src/core/automations/automation-scheduler.js')
  .then((schedulerModule) => {
    const intervalSeconds = parseInt(process.env.AUTOMATION_SCHEDULER_INTERVAL || '30', 10);
    schedulerModule.startScheduler(env, intervalSeconds);
    console.log(`✅ Motor de Automatizaciones (AUTO-1) iniciado (intervalo: ${intervalSeconds}s)`);
  })
  .catch((error) => {
    console.warn('⚠️  Error inicializando Motor de Automatizaciones:', error.message);
    // No fallar el servidor si el motor no se puede inicializar (fail-open)
  });

// Validar configuración adicional al inicio
console.log('🔍 Validando configuración adicional...');
const env = {
  CLICKUP_API_TOKEN: process.env.CLICKUP_API_TOKEN,
  KAJABI_CLIENT_ID: process.env.KAJABI_CLIENT_ID,
  KAJABI_CLIENT_SECRET: process.env.KAJABI_CLIENT_SECRET,
  TYPEFORM_API_TOKEN: process.env.TYPEFORM_API_TOKEN,
  CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN,
  CLOUDFLARE_EMAIL: process.env.CLOUDFLARE_EMAIL,
  CLOUDFLARE_API_KEY: process.env.CLOUDFLARE_API_KEY,
  // Google Workspace
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_REFRESH_TOKEN: process.env.GOOGLE_REFRESH_TOKEN,
  GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI,
  GOOGLE_SERVICE_ACCOUNT_KEY: process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
  GOOGLE_SERVICE_ACCOUNT_IMPERSONATE: process.env.GOOGLE_SERVICE_ACCOUNT_IMPERSONATE,
  GOOGLE_PROJECT_ID: process.env.GOOGLE_PROJECT_ID,
  GOOGLE_WORKSPACE_DOMAIN: process.env.GOOGLE_WORKSPACE_DOMAIN,
  EMAIL_FROM: process.env.EMAIL_FROM,
  COOKIE_SECRET: process.env.COOKIE_SECRET || 'default-secret-change-in-production'
};

const validation = validateEnvironmentVariables(env);

if (!validation.valid) {
  console.error('❌ ERRORES DE CONFIGURACIÓN:');
  validation.errors.forEach(err => console.error(`   - ${err}`));
  console.error('\n⚠️  El servidor puede no funcionar correctamente.');
  console.error('   Visita /health-check para más detalles.\n');
} else {
  console.log('✅ Configuración válida');
}

if (validation.warnings.length > 0) {
  console.warn('⚠️  ADVERTENCIAS:');
  validation.warnings.forEach(warn => console.warn(`   - ${warn}`));
  console.log('');
}

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// ============================================================================
// LOGS FORENSES - Captura global de excepciones no manejadas
// ============================================================================
const DEBUG_FORENSIC = process.env.DEBUG_FORENSIC === '1';

// Handler global para excepciones no capturadas
process.on('uncaughtException', (error) => {
  const marker = `[FORENSIC-UNCAUGHT]`;
  console.error(`${marker} ========================================`);
  console.error(`${marker} EXCEPCIÓN NO CAPTURADA DETECTADA`);
  console.error(`${marker} ========================================`);
  console.error(`${marker} Error:`, error.message);
  console.error(`${marker} Stack:`, error.stack);
  console.error(`${marker} Timestamp:`, new Date().toISOString());
  console.error(`${marker} ========================================`);
  // NO hacer process.exit() aquí - dejar que el servidor continúe
  // para poder capturar más información
});

// Handler global para promesas rechazadas no manejadas
process.on('unhandledRejection', (reason, promise) => {
  const marker = `[FORENSIC-UNHANDLED]`;
  console.error(`${marker} ========================================`);
  console.error(`${marker} PROMESA RECHAZADA NO MANEJADA`);
  console.error(`${marker} ========================================`);
  console.error(`${marker} Reason:`, reason);
  if (reason instanceof Error) {
    console.error(`${marker} Error message:`, reason.message);
    console.error(`${marker} Stack:`, reason.stack);
  }
  console.error(`${marker} Promise:`, promise);
  console.error(`${marker} Timestamp:`, new Date().toISOString());
  console.error(`${marker} ========================================`);
});

// ============================================================================

// Crear servidor HTTP
const server = http.createServer(async (req, res) => {
  // Procesar request dentro del contexto de request_id
  // Esto garantiza que todos los logs del flujo tengan el mismo request_id
  await initRequestContext(async () => {
    // Obtener request_id para logs forenses
    const { getRequestId } = await import('./src/core/observability/request-context.js');
    let requestId = 'no-id';
    let traceMarker = '';
    try {
      requestId = getRequestId() || 'no-id';
      traceMarker = DEBUG_FORENSIC ? `[TRACE-${requestId}]` : '';
    } catch (e) {
      // Si falla obtener requestId, continuar sin él
      traceMarker = DEBUG_FORENSIC ? '[TRACE-no-id]' : '';
    }
    
    try {
      // TRACE A: Inicio del request
      if (DEBUG_FORENSIC) {
        console.log(`${traceMarker} A - Inicio request: ${req.method} ${req.url}`);
        console.log(`${traceMarker} A - Host: ${req.headers.host || 'NO HOST'}`);
        console.log(`${traceMarker} A - Headers keys: ${Object.keys(req.headers).join(', ')}`);
      }
      
      // Validar que req.url esté disponible (crítico para construir request)
      if (!req.url) {
        console.error('❌ [Server] req.url no está disponible');
        res.statusCode = 400;
        res.setHeader('Content-Type', 'text/plain');
        // Headers defensivos para evitar caché de errores 400
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.end('Bad Request: URL no disponible');
        return;
      }

      // Crear objeto Headers compatible con Workers
      // IMPORTANTE: Normalizar headers de Node.js (minúsculas) a Headers Web API (case-insensitive)
      // CRÍTICO: Asegurar que 'cookie' (minúscula de Node.js) se mapee correctamente
      // El objeto Headers Web API es case-insensitive, pero debemos asegurar que funcione
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (Array.isArray(value)) {
          value.forEach(v => headers.append(key, v));
        } else if (value) {
          headers.set(key, value);
        }
      }
      
      // Validación: Asegurar que las cookies se puedan leer correctamente
      // Si req.headers tiene 'cookie' (minúscula), debe ser accesible como 'Cookie' (mayúscula)
      const cookieFromReq = req.headers.cookie;
      const cookieFromHeaders = headers.get('Cookie');
      if (cookieFromReq && !cookieFromHeaders) {
        // Si hay cookie en req.headers pero no en headers, forzar el set
        console.warn('⚠️ [Server] Cookie presente en req.headers pero no accesible en headers, corrigiendo...');
        headers.set('Cookie', cookieFromReq);
      }

      // Construir URL completa desde el request
      // Asegurar que siempre tengamos una URL válida
      const protocol = req.headers['x-forwarded-proto'] || (req.socket.encrypted ? 'https' : 'http');
      const host = req.headers.host || `${HOST}:${PORT}`;
      const url = new URL(req.url, `${protocol}://${host}`);

      // CRÍTICO: En Node.js, el stream del request solo puede leerse UNA VEZ
      // Leer el body una sola vez y reutilizarlo para todos los métodos
      let bodyCache = null;
      let bodyPromise = null;
      
      const readBodyOnce = () => {
        if (bodyPromise) return bodyPromise;
        
        bodyPromise = new Promise((resolve, reject) => {
          // Solo leer body si hay contenido (POST, PUT, PATCH, etc.)
          if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'DELETE') {
            resolve('');
            return;
          }
          
          let body = '';
          req.on('data', chunk => {
            body += chunk.toString();
          });
          req.on('end', () => {
            bodyCache = body;
            resolve(body);
          });
          req.on('error', (err) => {
            reject(err);
          });
        });
        
        return bodyPromise;
      };

      // Crear objeto Request compatible con Workers
      // CRÍTICO: Asegurar que request.url y request.headers estén siempre definidos
      // Esto garantiza que auth-context y cookies.js puedan leer correctamente
      const request = {
        method: req.method || 'GET',
        url: url.toString(),
        headers: headers,
        body: null,
        json: async () => {
          const body = await readBodyOnce();
          try {
            return JSON.parse(body);
          } catch (e) {
            throw new Error(`Invalid JSON: ${e.message}`);
          }
        },
        text: async () => {
          return await readBodyOnce();
        },
        formData: async () => {
          const body = await readBodyOnce();
          // Crear FormData desde URLSearchParams
          const params = new URLSearchParams(body);
          const formData = new FormData();
          for (const [key, value] of params.entries()) {
            formData.append(key, value);
          }
          return formData;
        }
      };

      // Crear objeto env con variables de entorno
      const env = {
        CLICKUP_API_TOKEN: process.env.CLICKUP_API_TOKEN,
        KAJABI_CLIENT_ID: process.env.KAJABI_CLIENT_ID,
        KAJABI_CLIENT_SECRET: process.env.KAJABI_CLIENT_SECRET,
        TYPEFORM_API_TOKEN: process.env.TYPEFORM_API_TOKEN,
        CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN,
        CLOUDFLARE_EMAIL: process.env.CLOUDFLARE_EMAIL,
        CLOUDFLARE_API_KEY: process.env.CLOUDFLARE_API_KEY,
        // Google Workspace
        GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
        GOOGLE_REFRESH_TOKEN: process.env.GOOGLE_REFRESH_TOKEN,
        GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI,
        GOOGLE_SERVICE_ACCOUNT_KEY: process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
        GOOGLE_SERVICE_ACCOUNT_IMPERSONATE: process.env.GOOGLE_SERVICE_ACCOUNT_IMPERSONATE,
        GOOGLE_PROJECT_ID: process.env.GOOGLE_PROJECT_ID,
        GOOGLE_WORKSPACE_DOMAIN: process.env.GOOGLE_WORKSPACE_DOMAIN,
        EMAIL_FROM: process.env.EMAIL_FROM,
        COOKIE_SECRET: process.env.COOKIE_SECRET || 'default-secret-change-in-production',
        // SSH Servidor "dani" (Whisper)
        SSH_DANI_HOST: process.env.SSH_DANI_HOST,
        SSH_DANI_TAILSCALE_HOST: process.env.SSH_DANI_TAILSCALE_HOST,
        SSH_DANI_PORT: process.env.SSH_DANI_PORT,
        SSH_DANI_USER: process.env.SSH_DANI_USER,
        SSH_DANI_KEY_PATH: process.env.SSH_DANI_KEY_PATH,
        SSH_DANI_INPUT_PATH: process.env.SSH_DANI_INPUT_PATH,
        SSH_DANI_OUTPUT_PATH: process.env.SSH_DANI_OUTPUT_PATH,
        SSH_DANI_PROYECTO_PATH: process.env.SSH_DANI_PROYECTO_PATH,
        SSH_DANI_ENTORNO_VIRTUAL: process.env.SSH_DANI_ENTORNO_VIRTUAL,
        SSH_DANI_MODELO_WHISPER: process.env.SSH_DANI_MODELO_WHISPER,
        SSH_DANI_IDIOMA: process.env.SSH_DANI_IDIOMA,
        SSH_DANI_FORMATO: process.env.SSH_DANI_FORMATO,
        // Google Drive - Transcripciones
        GOOGLE_DRIVE_AUDIOS_FOLDER_ID: process.env.GOOGLE_DRIVE_AUDIOS_FOLDER_ID,
        GOOGLE_DRIVE_TRANSCRIPCIONES_FOLDER_ID: process.env.GOOGLE_DRIVE_TRANSCRIPCIONES_FOLDER_ID,
        GOOGLE_DRIVE_CANALIZACIONES_FOLDER: process.env.GOOGLE_DRIVE_CANALIZACIONES_FOLDER,
        DRIVE_MONITOR_INTERVAL: process.env.DRIVE_MONITOR_INTERVAL,
        DRIVE_WEBHOOK_AUTO_SETUP: process.env.DRIVE_WEBHOOK_AUTO_SETUP,
        WEBHOOK_BASE_URL: process.env.WEBHOOK_BASE_URL,
        SERVER_URL: process.env.SERVER_URL,
        // Admin
        ADMIN_PASSWORD: process.env.ADMIN_PASSWORD
      };

      // TRACE B: Request construido
      if (DEBUG_FORENSIC) {
        console.log(`${traceMarker} B - Request construido: ${request.method} ${request.url}`);
        console.log(`${traceMarker} B - Headers construidos: ${request.headers ? 'OK' : 'FALLO'}`);
      }
      
      // Validar que el objeto request esté completo antes de pasarlo al router
      // CRÍTICO: request.url y request.headers deben estar siempre definidos
      // para que auth-context y cookies.js funcionen correctamente
      if (!request.url || !request.headers) {
        console.error(`${traceMarker} ❌ [Server] Objeto request incompleto:`, {
          hasUrl: !!request.url,
          hasHeaders: !!request.headers,
          method: request.method
        });
        res.statusCode = 500;
        res.setHeader('Content-Type', 'text/plain');
        // Headers defensivos para evitar caché de errores 500
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.end('Error interno: objeto request incompleto');
        return;
      }

      // Crear contexto (vacío para Node.js)
      const ctx = {};

      // TRACE C: Llamar router.fetch
      if (DEBUG_FORENSIC) {
        console.log(`${traceMarker} C - Llamando router.fetch...`);
      }
      
      // Procesar request con el router
      // El request_id se propaga automáticamente a todos los logs gracias a AsyncLocalStorage
      let response;
      try {
        response = await router.fetch(request, env, ctx);
        
        // TRACE D: router.fetch devuelve response
        if (DEBUG_FORENSIC) {
          console.log(`${traceMarker} D - router.fetch devolvió response:`, {
            status: response?.status,
            hasHeaders: !!response?.headers,
            isResponse: response instanceof Response
          });
        }
      } catch (routerError) {
        // CRÍTICO: Si el router lanza una excepción no capturada, nunca propagarla
        console.error(`${traceMarker} ❌ Error en router.fetch:`, routerError);
        console.error(`${traceMarker} ❌ Stack:`, routerError.stack);
        console.error(`${traceMarker} ❌ Request:`, { method: request.method, url: request.url });
        res.statusCode = 500;
        res.setHeader('Content-Type', 'text/plain');
        // Headers defensivos para evitar caché de errores 500
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.end('Error interno del servidor');
        return;
      }

      // Verificar que response sea válido
      if (!response || !(response instanceof Response)) {
        console.error(`${traceMarker} ❌ Router devolvió respuesta inválida:`, response);
        console.error(`${traceMarker} ❌ Tipo de response:`, typeof response);
        console.error(`${traceMarker} ❌ Es Response?:`, response instanceof Response);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'text/plain');
        // Headers defensivos para evitar caché de errores 500
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.end('Error interno del servidor: respuesta inválida');
        return;
      }

      // TRACE E: Enviar respuesta - copiar status y headers
      if (DEBUG_FORENSIC) {
        console.log(`${traceMarker} E - Enviando respuesta: status=${response.status}`);
      }
      
      // Enviar respuesta
      res.statusCode = response.status;
      
      // Copiar headers (verificar que existan)
      if (response.headers && typeof response.headers.entries === 'function') {
        try {
          for (const [key, value] of response.headers.entries()) {
            res.setHeader(key, value);
          }
          if (DEBUG_FORENSIC) {
            console.log(`${traceMarker} E - Headers copiados correctamente`);
          }
        } catch (headersError) {
          console.error(`${traceMarker} ❌ Error copiando headers:`, headersError.message);
          console.error(`${traceMarker} ❌ Stack:`, headersError.stack);
          // Continuar sin headers adicionales
        }
      } else {
        if (DEBUG_FORENSIC) {
          console.log(`${traceMarker} E - No hay headers para copiar`);
        }
      }

      // TRACE F: Leer body
      if (DEBUG_FORENSIC) {
        console.log(`${traceMarker} F - Leyendo body de response...`);
      }
      
      // Enviar body
      // CRÍTICO: Manejar casos donde response.text() puede fallar
      // (ej: body ya consumido, null, o Response sin body)
      try {
        // Verificar que response tenga método text() antes de llamarlo
        if (response && typeof response.text === 'function') {
          const body = await response.text();
          if (DEBUG_FORENSIC) {
            console.log(`${traceMarker} F - Body leído: ${body ? body.length + ' bytes' : 'vacío'}`);
          }
          res.end(body || '');
          
          // TRACE G: res.end completado
          if (DEBUG_FORENSIC) {
            console.log(`${traceMarker} G - res.end completado OK`);
          }
        } else {
          // Response sin body o método text() no disponible
          if (DEBUG_FORENSIC) {
            console.log(`${traceMarker} F - Response sin método text(), enviando body vacío`);
          }
          res.end('');
        }
      } catch (bodyError) {
        // Si falla response.text(), nunca propagar el error
        // Loggear y enviar respuesta vacía para evitar 500
        console.error(`${traceMarker} ❌ Error leyendo body de respuesta:`, bodyError.message);
        console.error(`${traceMarker} ❌ Stack:`, bodyError.stack);
        console.error(`${traceMarker} ❌ Status: ${response.status}, URL: ${req.url}`);
        console.error(`${traceMarker} ❌ Response type:`, typeof response);
        console.error(`${traceMarker} ❌ Response tiene text?:`, typeof response?.text);
        res.end('');
      }

    } catch (error) {
      // CRÍTICO: Capturar TODOS los errores no manejados en el servidor
      const requestId = getRequestId() || 'no-id';
      const traceMarker = DEBUG_FORENSIC ? `[TRACE-${requestId}]` : '';
      
      console.error(`${traceMarker} ❌ [Server] Error procesando request:`, error);
      console.error(`${traceMarker} ❌ [Server] Stack:`, error.stack);
      console.error(`${traceMarker} ❌ [Server] URL:`, req.url);
      console.error(`${traceMarker} ❌ [Server] Method:`, req.method);
      console.error(`${traceMarker} ❌ [Server] Host:`, req.headers.host);
      console.error(`${traceMarker} ❌ [Server] Headers:`, JSON.stringify(req.headers, null, 2));
      
      // Intentar enviar respuesta de error
      try {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'text/plain');
        // CRÍTICO: Headers para evitar que Cloudflare cachee errores
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.end('Error interno del servidor');
      } catch (resError) {
        // Si incluso res.end falla, loggear pero no propagar
        console.error(`${traceMarker} ❌ [Server] Error enviando respuesta de error:`, resError.message);
        console.error(`${traceMarker} ❌ [Server] resError stack:`, resError.stack);
      }
    }
    // El contexto se limpia automáticamente al salir de initRequestContext
  }, req);
});

// Iniciar servidor
server.listen(PORT, HOST, () => {
  console.log(`✅ Servidor AuriPortal iniciado correctamente`);
  console.log(`📍 Escuchando en http://${HOST}:${PORT}`);
  console.log(`🌍 Entorno: ${APP_ENV.toUpperCase()}`);
  console.log(`🔍 Verifica la configuración en: http://localhost:${PORT}/health-check`);
  console.log(`📊 Información de versión en: http://localhost:${PORT}/__version`);
  console.log('');
  
  // Inicializar tareas programadas
  iniciarScheduler(env);
});

// Manejo de errores
server.on('error', (error) => {
  console.error('❌ Error del servidor:', error);
  process.exit(1);
});

// Manejo de cierre graceful
process.on('SIGTERM', () => {
  console.log('🛑 Recibida señal SIGTERM, cerrando servidor...');
  server.close(() => {
    console.log('✅ Servidor cerrado correctamente');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 Recibida señal SIGINT, cerrando servidor...');
  server.close(() => {
    console.log('✅ Servidor cerrado correctamente');
    process.exit(0);
  });
});

