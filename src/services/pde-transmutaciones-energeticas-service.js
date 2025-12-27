// src/services/pde-transmutaciones-energeticas-service.js
// Servicio de negocio para Transmutaciones Energéticas PDE
//
// Responsabilidades:
// - Devolver listas e items canónicos
// - Filtrar por status='active'
// - PostgreSQL como única autoridad
// - Soft delete vía status='archived'

import { getDefaultPdeTransmutacionesEnergeticasRepo } from '../infra/repos/pde-transmutaciones-energeticas-repo-pg.js';

/**
 * Lista listas de transmutaciones según filtros
 * 
 * @param {Object} options - Opciones de filtrado
 * @param {boolean} [options.onlyActive=true] - Si filtrar solo activos (default: true)
 * @param {string} [options.tipo] - Filtrar por tipo ('recurrente' o 'una_vez')
 * @returns {Promise<Array>} Array de listas
 */
export async function listListas(options = {}) {
  const repo = getDefaultPdeTransmutacionesEnergeticasRepo();
  return await repo.listListas({
    onlyActive: options.onlyActive !== undefined ? options.onlyActive : true,
    tipo: options.tipo
  });
}

/**
 * Obtiene una lista por ID
 * 
 * @param {string|number} id - ID de la lista
 * @returns {Promise<Object|null>} Lista o null si no existe
 */
export async function getListaById(id) {
  if (!id) return null;
  
  const repo = getDefaultPdeTransmutacionesEnergeticasRepo();
  return await repo.getListaById(id);
}

/**
 * Crea una nueva lista
 * 
 * @param {Object} listaData - Datos de la lista a crear
 * @returns {Promise<Object>} Lista creada
 * @throws {Error} Si hay error de validación
 */
export async function createLista(listaData) {
  const repo = getDefaultPdeTransmutacionesEnergeticasRepo();
  return await repo.createLista(listaData);
}

/**
 * Actualiza metadata de una lista
 * 
 * @param {string|number} id - ID de la lista
 * @param {Object} patch - Campos a actualizar (parcial)
 * @returns {Promise<Object|null>} Lista actualizada o null si no existe
 */
export async function updateListaMeta(id, patch) {
  if (!id) return null;
  
  const repo = getDefaultPdeTransmutacionesEnergeticasRepo();
  return await repo.updateListaMeta(id, patch);
}

/**
 * Archiva una lista (soft delete)
 * 
 * @param {string|number} id - ID de la lista
 * @returns {Promise<Object|null>} Lista archivada o null si no existe
 */
export async function archiveLista(id) {
  if (!id) return null;
  
  const repo = getDefaultPdeTransmutacionesEnergeticasRepo();
  return await repo.archiveLista(id);
}

/**
 * Lista todos los items de una lista
 * NOTA: Usa listItemsOrdered para garantizar orden canónico
 * 
 * @param {string|number} listaId - ID de la lista
 * @param {Object} options - Opciones de filtrado
 * @param {boolean} [options.onlyActive=true] - Si filtrar solo activos
 * @returns {Promise<Array>} Array de items (ordenados por nivel ASC, created_at ASC)
 */
export async function listItems(listaId, options = {}) {
  if (!listaId) return [];
  
  // Usar listItemsOrdered para garantizar orden canónico
  return await listItemsOrdered(listaId, options);
}

/**
 * Obtiene un item por ID
 * 
 * @param {string|number} id - ID del item
 * @returns {Promise<Object|null>} Item o null si no existe
 */
export async function getItemById(id) {
  if (!id) return null;
  
  const repo = getDefaultPdeTransmutacionesEnergeticasRepo();
  return await repo.getItemById(id);
}

/**
 * Crea un nuevo item
 * 
 * @param {Object} itemData - Datos del item a crear
 * @returns {Promise<Object>} Item creado
 */
export async function createItem(itemData) {
  const repo = getDefaultPdeTransmutacionesEnergeticasRepo();
  return await repo.createItem(itemData);
}

/**
 * Actualiza un item
 * 
 * @param {string|number} id - ID del item
 * @param {Object} patch - Campos a actualizar (parcial)
 * @returns {Promise<Object|null>} Item actualizado o null si no existe
 */
export async function updateItem(id, patch) {
  if (!id) return null;
  
  const repo = getDefaultPdeTransmutacionesEnergeticasRepo();
  return await repo.updateItem(id, patch);
}

/**
 * Archiva un item (soft delete)
 * 
 * @param {string|number} id - ID del item
 * @returns {Promise<Object|null>} Item archivado o null si no existe
 */
export async function archiveItem(id) {
  if (!id) return null;
  
  const repo = getDefaultPdeTransmutacionesEnergeticasRepo();
  return await repo.archiveItem(id);
}

/**
 * Lista items ordenados por nivel ASC, created_at ASC (LEY ABSOLUTA)
 */
export async function listItemsOrdered(listaId, options = {}) {
  if (!listaId) return [];
  
  const repo = getDefaultPdeTransmutacionesEnergeticasRepo();
  return await repo.listItemsOrdered(listaId, options);
}

/**
 * OPERACIONES MASTER - Recurrentes
 */

/**
 * Obtiene estado de alumnos para un item recurrente
 * Retorna 3 grupos: limpio, pendiente, crítico
 */
export async function getRecurrentStateForItem(itemId) {
  if (!itemId) return { limpio: [], pendiente: [], critico: [] };
  
  const repo = getDefaultPdeTransmutacionesEnergeticasRepo();
  return await repo.getRecurrentStateForItem(itemId);
}

/**
 * Marca limpio para todos los alumnos (item recurrente)
 */
export async function markCleanForAllRecurrent(itemId) {
  if (!itemId) return { updated: 0 };
  
  const repo = getDefaultPdeTransmutacionesEnergeticasRepo();
  return await repo.markCleanForAllRecurrent(itemId);
}

/**
 * Marca limpio para un alumno específico (item recurrente)
 */
export async function markCleanForStudentRecurrent(itemId, studentEmail) {
  if (!itemId || !studentEmail) return null;
  
  const repo = getDefaultPdeTransmutacionesEnergeticasRepo();
  return await repo.markCleanForStudentRecurrent(itemId, studentEmail);
}

/**
 * OPERACIONES MASTER - Una Vez
 */

/**
 * Obtiene estado de alumnos para un item una_vez
 */
export async function getOneTimeStateForItem(itemId) {
  if (!itemId) return [];
  
  const repo = getDefaultPdeTransmutacionesEnergeticasRepo();
  return await repo.getOneTimeStateForItem(itemId);
}

/**
 * Limpieza +1 para todos los alumnos (item una_vez)
 */
export async function incrementCleanForAllOneTime(itemId) {
  if (!itemId) return { updated: 0 };
  
  const repo = getDefaultPdeTransmutacionesEnergeticasRepo();
  return await repo.incrementCleanForAllOneTime(itemId);
}

/**
 * Ajusta remaining manualmente para un alumno (item una_vez)
 */
export async function adjustRemainingForStudent(itemId, studentEmail, newRemaining) {
  if (!itemId || !studentEmail || newRemaining === undefined) return null;
  
  const repo = getDefaultPdeTransmutacionesEnergeticasRepo();
  return await repo.adjustRemainingForStudent(itemId, studentEmail, newRemaining);
}

/**
 * Obtiene lista de todos los estudiantes (emails)
 */
export async function listAllStudents() {
  const repo = getDefaultPdeTransmutacionesEnergeticasRepo();
  return await repo.listAllStudents();
}

