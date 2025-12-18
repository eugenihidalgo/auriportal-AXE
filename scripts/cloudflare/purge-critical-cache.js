// scripts/cloudflare/purge-critical-cache.js
// Purga inmediata de caché crítico de Cloudflare
// Purga SOLO las URLs críticas: /, /enter, /js/inject_main.js

import { loadEnvIfNeeded } from '../../src/core/config/env.js';

// Cargar variables de entorno
loadEnvIfNeeded();

const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CLOUDFLARE_ZONE_ID = process.env.CLOUDFLARE_ZONE_ID;

// URLs críticas a purgar
const CRITICAL_URLS = [
  '/',
  '/enter',
  '/js/inject_main.js'
];

/**
 * Obtiene headers de autenticación para Cloudflare API
 */
function getCloudflareHeaders() {
  if (!CLOUDFLARE_API_TOKEN) {
    throw new Error('CLOUDFLARE_API_TOKEN no está configurado');
  }
  
  return {
    'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
    'Content-Type': 'application/json'
  };
}

/**
 * Purga URLs específicas en Cloudflare
 */
async function purgeUrls(urls) {
  if (!CLOUDFLARE_ZONE_ID) {
    throw new Error('CLOUDFLARE_ZONE_ID no está configurado');
  }

  const headers = getCloudflareHeaders();
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/purge_cache`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        files: urls
      })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Cloudflare API error: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

/**
 * Función principal de purga
 */
async function purgeCriticalCache() {
  const timestamp = new Date().toISOString();
  console.log(`\n🔄 [${timestamp}] Iniciando purga de caché crítico de Cloudflare...`);
  console.log(`   URLs a purgar: ${CRITICAL_URLS.join(', ')}`);

  try {
    // Validar credenciales
    if (!CLOUDFLARE_API_TOKEN) {
      console.warn('⚠️  CLOUDFLARE_API_TOKEN no configurado - saltando purga');
      return { success: false, reason: 'TOKEN_NO_CONFIGURADO' };
    }

    if (!CLOUDFLARE_ZONE_ID) {
      console.warn('⚠️  CLOUDFLARE_ZONE_ID no configurado - saltando purga');
      return { success: false, reason: 'ZONE_ID_NO_CONFIGURADO' };
    }

    // Ejecutar purga
    const result = await purgeUrls(CRITICAL_URLS);
    
    const timestampEnd = new Date().toISOString();
    console.log(`✅ [${timestampEnd}] Purga completada exitosamente`);
    console.log(`   URLs purgadas: ${CRITICAL_URLS.length}`);
    console.log(`   Resultado: ${JSON.stringify(result, null, 2)}`);

    // Log estructurado
    console.log(JSON.stringify({
      source: 'cloudflare',
      action: 'purge',
      urls: CRITICAL_URLS,
      reason: 'manual',
      success: true,
      timestamp: timestampEnd
    }));

    return {
      success: true,
      urls: CRITICAL_URLS,
      result
    };

  } catch (error) {
    const timestampEnd = new Date().toISOString();
    console.error(`❌ [${timestampEnd}] Error en purga de caché:`, error.message);
    
    // Log estructurado de error
    console.error(JSON.stringify({
      source: 'cloudflare',
      action: 'purge',
      urls: CRITICAL_URLS,
      reason: 'error',
      success: false,
      error: error.message,
      timestamp: timestampEnd
    }));

    // Fail-open: no lanzar error, solo loguear
    return {
      success: false,
      error: error.message,
      urls: CRITICAL_URLS
    };
  }
}

// Si se ejecuta directamente (no como módulo)
// Verificar si el módulo se está ejecutando directamente
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMainModule) {
  purgeCriticalCache()
    .then(result => {
      if (result.success) {
        process.exit(0);
      } else {
        // Fail-open: salir con código 0 incluso si falla
        // (no queremos romper procesos que dependan de esto)
        process.exit(0);
      }
    })
    .catch(error => {
      console.error('Error fatal:', error);
      // Fail-open: salir con código 0
      process.exit(0);
    });
}

// Exportar para uso como módulo
export { purgeCriticalCache };

