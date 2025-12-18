// src/core/energy/transmutations/catalog-loader.js
// Loader y cache del catálogo de transmutaciones energéticas v1
//
// RESPONSABILIDAD:
// - Cargar JSON desde config/energy/transmutations.catalog.v1.json
// - Cache in-memory para evitar lecturas repetidas de disco
// - Fail-open: si falla la carga, devolver catálogo vacío + logWarn
// - Invalidar cache manualmente si es necesario (para tests)
//
// PRINCIPIOS:
// - Nunca lanzar excepciones (siempre devolver algo válido)
// - Logs estructurados con domain 'EnergyTransmutations'
// - Cache simple (no TTL en v1, el catálogo es estático)

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { validateTransmutationsCatalog, EMPTY_CATALOG } from './catalog-validator.js';
import { logInfo, logWarn, logError } from '../../observability/logger.js';

const DOMAIN = 'EnergyTransmutations';

// Obtener path absoluto al catálogo
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CATALOG_PATH = join(__dirname, '../../../../config/energy/transmutations.catalog.v1.json');

// Cache in-memory
let cachedCatalog = null;
let cacheLoadedAt = null;

/**
 * Carga el catálogo desde disco (sin cache)
 * 
 * @returns {{ catalog: Object, fromCache: boolean, error?: string }}
 * @private
 */
function loadFromDisk() {
  try {
    // 1. Verificar que el archivo existe
    if (!existsSync(CATALOG_PATH)) {
      logWarn(DOMAIN, 'Archivo de catálogo no encontrado', {
        path: CATALOG_PATH
      });
      return {
        catalog: EMPTY_CATALOG,
        fromCache: false,
        error: 'Archivo no encontrado'
      };
    }

    // 2. Leer y parsear JSON
    const rawContent = readFileSync(CATALOG_PATH, 'utf-8');
    let rawCatalog;
    
    try {
      rawCatalog = JSON.parse(rawContent);
    } catch (parseError) {
      logError(DOMAIN, 'Error parseando JSON del catálogo', {
        path: CATALOG_PATH,
        error: parseError.message
      });
      return {
        catalog: EMPTY_CATALOG,
        fromCache: false,
        error: `Error de parsing: ${parseError.message}`
      };
    }

    // 3. Validar estructura
    const validationResult = validateTransmutationsCatalog(rawCatalog);

    if (!validationResult.valid) {
      logWarn(DOMAIN, 'Catálogo inválido, usando fallback vacío', {
        path: CATALOG_PATH,
        errors_count: validationResult.errors?.length || 0
      });
      return {
        catalog: EMPTY_CATALOG,
        fromCache: false,
        error: `Validación fallida: ${validationResult.errors?.[0] || 'unknown'}`
      };
    }

    // 4. Catálogo válido
    logInfo(DOMAIN, 'Catálogo cargado desde disco', {
      catalog_id: rawCatalog.catalog_id,
      version: rawCatalog.version,
      transmutations_count: rawCatalog.transmutations?.length || 0,
      techniques_count: rawCatalog.techniques?.length || 0
    }, true);

    return {
      catalog: validationResult.data,
      fromCache: false
    };

  } catch (error) {
    // Error inesperado (fail-open)
    logError(DOMAIN, 'Error inesperado cargando catálogo', {
      path: CATALOG_PATH,
      error: error.message,
      stack: error.stack
    });
    return {
      catalog: EMPTY_CATALOG,
      fromCache: false,
      error: `Error inesperado: ${error.message}`
    };
  }
}

/**
 * Obtiene el catálogo de transmutaciones (con cache)
 * 
 * @param {{ forceReload?: boolean }} options - Opciones
 * @returns {{ catalog: Object, fromCache: boolean, loadedAt?: Date, error?: string }}
 * 
 * @example
 * const { catalog, fromCache } = getTransmutationsCatalog();
 * console.log(`Loaded ${catalog.transmutations.length} transmutations (cached: ${fromCache})`);
 */
export function getTransmutationsCatalog({ forceReload = false } = {}) {
  // Si hay cache y no se fuerza recarga
  if (cachedCatalog && !forceReload) {
    return {
      catalog: cachedCatalog,
      fromCache: true,
      loadedAt: cacheLoadedAt
    };
  }

  // Cargar desde disco
  const result = loadFromDisk();

  // Actualizar cache si carga exitosa
  if (!result.error) {
    cachedCatalog = result.catalog;
    cacheLoadedAt = new Date();
  }

  return {
    ...result,
    loadedAt: cacheLoadedAt
  };
}

/**
 * Invalida el cache forzando recarga en próxima llamada
 * Útil para tests o recargas manuales
 */
export function invalidateCatalogCache() {
  const hadCache = cachedCatalog !== null;
  cachedCatalog = null;
  cacheLoadedAt = null;

  logInfo(DOMAIN, 'Cache de catálogo invalidado', {
    had_cache: hadCache
  }, true);
}

/**
 * Obtiene información del estado del cache
 * 
 * @returns {{ isCached: boolean, loadedAt?: Date, catalogVersion?: string }}
 */
export function getCatalogCacheStatus() {
  return {
    isCached: cachedCatalog !== null,
    loadedAt: cacheLoadedAt,
    catalogVersion: cachedCatalog?.version || null,
    catalogId: cachedCatalog?.catalog_id || null
  };
}

/**
 * Obtiene el path al archivo del catálogo (para debug/tests)
 * 
 * @returns {string} Path absoluto al catálogo
 */
export function getCatalogPath() {
  return CATALOG_PATH;
}

// Re-exportar EMPTY_CATALOG desde validator
export { EMPTY_CATALOG } from './catalog-validator.js';

export default {
  getTransmutationsCatalog,
  invalidateCatalogCache,
  getCatalogCacheStatus,
  getCatalogPath
};

