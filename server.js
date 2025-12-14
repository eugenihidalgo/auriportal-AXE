// server.js
// Servidor Node.js para AuriPortal v3.1
// Migrado desde Cloudflare Workers para funcionar en VPS

import http from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

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

// Importar router y validación
import { router } from './src/router.js';
import { initPostgreSQL } from './database/pg.js';
import { validateEnvironmentVariables } from './src/config/validate.js';
import { iniciarScheduler } from './src/services/scheduler.js';
import { initRequestContext } from './src/core/observability/request-context.js';

// Inicializar base de datos PostgreSQL (única fuente de verdad v4)
initPostgreSQL();

// Validar configuración al inicio
console.log('🔍 Validando configuración...');
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

// Crear servidor HTTP
const server = http.createServer(async (req, res) => {
  // Procesar request dentro del contexto de request_id
  // Esto garantiza que todos los logs del flujo tengan el mismo request_id
  await initRequestContext(async () => {
    try {
        // Crear objeto Headers compatible con Workers
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (Array.isArray(value)) {
          value.forEach(v => headers.append(key, v));
        } else if (value) {
          headers.set(key, value);
        }
      }

      // Crear objeto Request compatible con Workers
      const request = {
        method: req.method,
        url: url.toString(),
        headers: headers,
        body: null,
        json: async () => {
          return new Promise((resolve, reject) => {
            let body = '';
            req.on('data', chunk => {
              body += chunk.toString();
            });
            req.on('end', () => {
              try {
                resolve(JSON.parse(body));
              } catch (e) {
                reject(e);
              }
            });
          });
        },
        text: async () => {
          return new Promise((resolve) => {
            let body = '';
            req.on('data', chunk => {
              body += chunk.toString();
            });
            req.on('end', () => {
              resolve(body);
            });
          });
        },
        formData: async () => {
          return new Promise((resolve) => {
            let body = '';
            req.on('data', chunk => {
              body += chunk.toString();
            });
            req.on('end', () => {
              // Crear FormData desde URLSearchParams
              const params = new URLSearchParams(body);
              const formData = new FormData();
              for (const [key, value] of params.entries()) {
                formData.append(key, value);
              }
              resolve(formData);
            });
          });
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

      // Crear contexto (vacío para Node.js)
      const ctx = {};

      // Procesar request con el router
      // El request_id se propaga automáticamente a todos los logs gracias a AsyncLocalStorage
      const response = await router.fetch(request, env, ctx);

      // Verificar que response sea válido
      if (!response || !(response instanceof Response)) {
        console.error('❌ Router devolvió respuesta inválida:', response);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'text/plain');
        res.end('Error interno del servidor: respuesta inválida');
        return;
      }

      // Enviar respuesta
      res.statusCode = response.status;
      
      // Copiar headers (verificar que existan)
      if (response.headers && typeof response.headers.entries === 'function') {
        for (const [key, value] of response.headers.entries()) {
          res.setHeader(key, value);
        }
      }

      // Enviar body
      const body = await response.text();
      res.end(body);

    } catch (error) {
      console.error('Error procesando request:', error);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'text/plain');
      res.end('Error interno del servidor');
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

