// scripts/cloudflare/cache-auditor.js
// Auditor periódico de caché de Cloudflare
// Detecta errores cacheados y ejecuta purga automática

import { loadEnvIfNeeded } from '../../src/core/config/env.js';
import { purgeCriticalCache } from './purge-critical-cache.js';

// Cargar variables de entorno
loadEnvIfNeeded();

const SERVER_URL = process.env.SERVER_URL || process.env.WEBHOOK_BASE_URL || 'https://controlauriportal.eugenihidalgo.work';

// URLs críticas a auditar
const CRITICAL_URLS = [
  '/',
  '/enter',
  '/js/inject_main.js'
];

/**
 * Obtiene el dominio base desde SERVER_URL
 */
function getBaseDomain() {
  try {
    const url = new URL(SERVER_URL);
    return url.origin;
  } catch (error) {
    // Fallback si SERVER_URL no es válido
    return 'https://controlauriportal.eugenihidalgo.work';
  }
}

/**
 * Hace un fetch HEAD a una URL y analiza los headers
 */
async function auditUrl(url) {
  const baseDomain = getBaseDomain();
  const fullUrl = `${baseDomain}${url}`;
  
  try {
    const response = await fetch(fullUrl, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'AuriPortal-Cache-Auditor/1.0'
      }
    });

    const status = response.status;
    const cfCacheStatus = response.headers.get('cf-cache-status') || 'UNKNOWN';
    const cacheControl = response.headers.get('cache-control') || '';
    const expires = response.headers.get('expires') || '';
    const pragma = response.headers.get('pragma') || '';

    return {
      url,
      status,
      cfCacheStatus,
      cacheControl,
      expires,
      pragma,
      headers: Object.fromEntries(response.headers.entries())
    };
  } catch (error) {
    return {
      url,
      error: error.message,
      status: null,
      cfCacheStatus: 'ERROR'
    };
  }
}

/**
 * Detecta si hay un error cacheado
 * Retorna true si:
 * - status >= 500 Y cf-cache-status = HIT
 */
function isCachedError(auditResult) {
  if (!auditResult.status) {
    return false; // Error de red, no es error cacheado
  }

  const isError = auditResult.status >= 500;
  const isCached = auditResult.cfCacheStatus === 'HIT' || auditResult.cfCacheStatus === 'STALE';

  return isError && isCached;
}

/**
 * Función principal de auditoría
 */
async function auditCache() {
  const timestamp = new Date().toISOString();
  console.log(`\n🔍 [${timestamp}] Iniciando auditoría de caché de Cloudflare...`);

  try {
    const results = [];
    let errorsDetected = 0;

    // Auditar cada URL crítica
    for (const url of CRITICAL_URLS) {
      console.log(`   Auditing: ${url}`);
      const result = await auditUrl(url);
      results.push(result);

      // Analizar resultado
      if (isCachedError(result)) {
        errorsDetected++;
        console.warn(`   ⚠️  ERROR CACHEADO DETECTADO: ${url}`);
        console.warn(`      Status: ${result.status}`);
        console.warn(`      CF-Cache-Status: ${result.cfCacheStatus}`);
      } else if (result.status >= 500) {
        // Error pero no cacheado (o no hay cf-cache-status)
        console.warn(`   ⚠️  Error detectado (no cacheado): ${url} - Status: ${result.status}`);
      } else {
        console.log(`   ✅ OK: ${url} - Status: ${result.status}, Cache: ${result.cfCacheStatus}`);
      }

      // Pequeño delay entre requests
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const timestampEnd = new Date().toISOString();

    // Si se detectaron errores cacheados, ejecutar purga automática
    if (errorsDetected > 0) {
      console.warn(`\n⚠️  [${timestampEnd}] Se detectaron ${errorsDetected} error(es) cacheado(s) - ejecutando purga automática...`);
      
      // Log estructurado de detección
      console.warn(JSON.stringify({
        source: 'cloudflare',
        action: 'audit',
        urls: CRITICAL_URLS,
        reason: 'cached_error_detected',
        errorsDetected,
        results: results.map(r => ({
          url: r.url,
          status: r.status,
          cfCacheStatus: r.cfCacheStatus
        })),
        timestamp: timestampEnd
      }));

      // Ejecutar purga
      const purgeResult = await purgeCriticalCache();
      
      if (purgeResult.success) {
        console.log(`✅ [${timestampEnd}] Purga automática completada exitosamente`);
      } else {
        console.error(`❌ [${timestampEnd}] Error en purga automática:`, purgeResult.error);
      }

      return {
        success: true,
        errorsDetected,
        purgeExecuted: true,
        purgeResult,
        results
      };
    } else {
      console.log(`✅ [${timestampEnd}] Auditoría completada - no se detectaron errores cacheados`);

      // Log estructurado de éxito
      console.log(JSON.stringify({
        source: 'cloudflare',
        action: 'audit',
        urls: CRITICAL_URLS,
        reason: 'periodic_check',
        errorsDetected: 0,
        results: results.map(r => ({
          url: r.url,
          status: r.status,
          cfCacheStatus: r.cfCacheStatus
        })),
        timestamp: timestampEnd
      }));

      return {
        success: true,
        errorsDetected: 0,
        purgeExecuted: false,
        results
      };
    }

  } catch (error) {
    const timestampEnd = new Date().toISOString();
    console.error(`❌ [${timestampEnd}] Error en auditoría de caché:`, error.message);
    
    // Log estructurado de error
    console.error(JSON.stringify({
      source: 'cloudflare',
      action: 'audit',
      urls: CRITICAL_URLS,
      reason: 'error',
      success: false,
      error: error.message,
      timestamp: timestampEnd
    }));

    // Fail-open: retornar resultado de error pero no lanzar excepción
    return {
      success: false,
      error: error.message
    };
  }
}

// Si se ejecuta directamente (no como módulo)
// Verificar si el módulo se está ejecutando directamente
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMainModule) {
  auditCache()
    .then(result => {
      if (result.success) {
        process.exit(0);
      } else {
        // Fail-open: salir con código 0 incluso si falla
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
export { auditCache };

