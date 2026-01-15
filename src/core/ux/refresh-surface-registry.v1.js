/**
 * REFRESH SURFACE REGISTRY v1 - AuriPortal
 * 
 * Registry canónico de superficies de refresh con adapters.
 * 
 * PRINCIPIO CONSTITUCIONAL:
 * - Toda superficie de refresh debe estar registrada aquí
 * - Cada superficie tiene adapter con refetch canónico
 * - Prohibido refetch ad-hoc fuera de surfaces
 * 
 * CONTRATO:
 * - surface_id: Identificador único canónico (ej: 'alquimia.list_projection')
 * - buildKey: Función que genera clave estable para la superficie
 * - refetch: Función que ejecuta el refetch (delega a funciones existentes)
 * - forensicsLabel: Etiqueta para logs forenses
 */

const surfaces = new Map();

/**
 * Registra una superficie de refresh
 * @param {Object} surfaceDef - Definición de la superficie
 * @param {string} surfaceDef.surface_id - ID único canónico
 * @param {Function} surfaceDef.buildKey - (context) => string (clave estable)
 * @param {Function} surfaceDef.refetch - (context, uiState) => Promise<void>
 * @param {string} surfaceDef.forensicsLabel - Etiqueta para logs
 */
export function registerRefreshSurface(surfaceDef) {
  const { surface_id, buildKey, refetch, forensicsLabel } = surfaceDef;

  // Validaciones obligatorias
  if (!surface_id || typeof surface_id !== 'string') {
    throw new Error('[REFRESH_SURFACE_REGISTRY] surface_id es obligatorio y debe ser string');
  }

  if (typeof buildKey !== 'function') {
    throw new Error('[REFRESH_SURFACE_REGISTRY] buildKey debe ser función');
  }

  if (typeof refetch !== 'function') {
    throw new Error('[REFRESH_SURFACE_REGISTRY] refetch debe ser función');
  }

  if (!forensicsLabel || typeof forensicsLabel !== 'string') {
    throw new Error('[REFRESH_SURFACE_REGISTRY] forensicsLabel es obligatorio y debe ser string');
  }

  // Validar que no esté duplicado
  if (surfaces.has(surface_id)) {
    console.warn(`[REFRESH_SURFACE_REGISTRY] Superficie ${surface_id} ya registrada, sobrescribiendo`);
  }

  surfaces.set(surface_id, {
    surface_id,
    buildKey,
    refetch,
    forensicsLabel
  });

  console.log(`[REFRESH_SURFACE_REGISTRY] Superficie registrada: ${surface_id}`);
}

/**
 * Obtiene una superficie registrada
 * @param {string} surface_id - ID de la superficie
 * @returns {Object|null} Definición de la superficie o null si no existe
 */
export function getRefreshSurface(surface_id) {
  if (!surface_id || typeof surface_id !== 'string') {
    return null;
  }
  return surfaces.get(surface_id) || null;
}

/**
 * Lista todas las superficies registradas
 * @returns {Array} Lista de surface_ids
 */
export function listRefreshSurfaces() {
  return Array.from(surfaces.keys());
}

/**
 * Valida que una superficie esté registrada
 * @param {string} surface_id - ID de la superficie
 * @returns {boolean} true si está registrada
 */
export function hasRefreshSurface(surface_id) {
  return surfaces.has(surface_id);
}

/**
 * Ejecuta refetch de una superficie
 * @param {string} surface_id - ID de la superficie
 * @param {Object} context - Contexto de la mutación
 * @param {Object} uiState - Estado de la UI
 * @returns {Promise<void>}
 */
export async function refetchSurface(surface_id, context, uiState) {
  const surface = getRefreshSurface(surface_id);
  if (!surface) {
    console.error(`[REFRESH_SURFACE_REGISTRY] Superficie ${surface_id} no registrada`);
    return;
  }

  const key = surface.buildKey(context, uiState);
  const startTime = Date.now();

  console.log(`[REFRESH][GET] ${surface.forensicsLabel}`, {
    surface_id,
    key,
    timestamp: new Date().toISOString()
  });

  try {
    await surface.refetch(context, uiState);
    const duration = Date.now() - startTime;
    console.log(`[REFRESH][GET] ${surface.forensicsLabel} ok`, {
      surface_id,
      key,
      duration_ms: duration,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[REFRESH][GET] ${surface.forensicsLabel} err`, {
      surface_id,
      key,
      duration_ms: duration,
      error: error.message,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
}

/**
 * Obtiene información del registry (útil para debugging)
 * @returns {Object} Información del registry
 */
export function getRegistryInfo() {
  return {
    total_surfaces: surfaces.size,
    surfaces: Array.from(surfaces.keys())
  };
}

// Exportar para uso en frontend (si se necesita)
if (typeof window !== 'undefined') {
  window.__AP_REFRESH_SURFACE_REGISTRY__ = {
    get: getRefreshSurface,
    list: listRefreshSurfaces,
    has: hasRefreshSurface,
    refetch: refetchSurface,
    info: getRegistryInfo,
    registerRefreshSurface: registerRefreshSurface // Exponer para registro desde frontend
  };
}
