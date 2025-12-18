// src/services/pde-catalog-registry-service.js
// Servicio de negocio para Registro de Catálogos PDE
//
// Responsabilidades:
// - Devolver lista canónica de catálogos
// - Filtrar activos
// - Exponer capacidades (supports_*)
// - Validar que catálogos existan antes de usarlos en motores

import { getDefaultPdeCatalogRegistryRepo } from '../infra/repos/pde-catalog-registry-repo-pg.js';

/**
 * Lista todos los catálogos activos
 * 
 * @param {Object} options - Opciones de filtrado
 * @param {boolean} [options.usableForMotors] - Si filtrar solo usable_for_motors
 * @returns {Promise<Array>} Array de catálogos
 */
export async function listCatalogs(options = {}) {
  const repo = getDefaultPdeCatalogRegistryRepo();
  return await repo.listCatalogs({
    onlyActive: true,
    ...options
  });
}

/**
 * Obtiene un catálogo por catalog_key
 * 
 * @param {string} catalogKey - Clave canónica del catálogo
 * @returns {Promise<Object|null>} Catálogo o null si no existe
 */
export async function getCatalogByKey(catalogKey) {
  if (!catalogKey) return null;
  
  const repo = getDefaultPdeCatalogRegistryRepo();
  return await repo.getCatalogByKey(catalogKey);
}

/**
 * Obtiene un catálogo por ID
 * 
 * @param {string} id - UUID del catálogo
 * @returns {Promise<Object|null>} Catálogo o null si no existe
 */
export async function getCatalogById(id) {
  if (!id) return null;
  
  const repo = getDefaultPdeCatalogRegistryRepo();
  return await repo.getCatalogById(id);
}

/**
 * Lista catálogos disponibles para motores (usable_for_motors = true y active)
 * 
 * @returns {Promise<Array>} Array de catálogos usable para motores
 */
export async function listCatalogsForMotors() {
  return await listCatalogs({ usableForMotors: true });
}

/**
 * Actualiza metadata de un catálogo
 * 
 * @param {string} id - UUID del catálogo
 * @param {Object} patch - Campos a actualizar (parcial)
 * @returns {Promise<Object|null>} Catálogo actualizado o null si no existe
 */
export async function updateCatalogMeta(id, patch) {
  if (!id) return null;
  
  const repo = getDefaultPdeCatalogRegistryRepo();
  return await repo.updateCatalogMeta(id, patch);
}

/**
 * Crea un nuevo catálogo
 * 
 * @param {Object} catalogData - Datos del catálogo a crear
 * @returns {Promise<Object>} Catálogo creado
 * @throws {Error} Si catalog_key ya existe o hay error de validación
 */
export async function createCatalog(catalogData) {
  const repo = getDefaultPdeCatalogRegistryRepo();
  return await repo.createCatalog(catalogData);
}

/**
 * Valida que un catalog_key existe y es usable para motores
 * 
 * @param {string} catalogKey - Clave canónica del catálogo
 * @returns {Promise<boolean>} true si existe y es usable
 */
export async function isValidCatalogForMotors(catalogKey) {
  if (!catalogKey) return false;
  
  const catalog = await getCatalogByKey(catalogKey);
  return catalog !== null && 
         catalog.status === 'active' && 
         catalog.usable_for_motors === true;
}

