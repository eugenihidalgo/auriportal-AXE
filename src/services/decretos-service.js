// src/services/decretos-service.js
// Servicio para gestionar decretos en la base de datos
//
// NOTA: Este servicio ahora usa el repositorio decretos-repo-pg.js
// que encapsula todas las operaciones de base de datos y sanitización.

import { getDefaultDecretosRepo } from '../infra/repos/decretos-repo-pg.js';

const repo = getDefaultDecretosRepo();

/**
 * Lista todos los decretos (incluye inactivos para el admin)
 * @param {boolean} soloActivos - Si es true, solo muestra decretos activos (no eliminados)
 * @returns {Promise<Array>} Lista de decretos
 */
export async function listarDecretos(soloActivos = false) {
  try {
    return await repo.list({ includeDeleted: !soloActivos });
  } catch (error) {
    console.error('Error al listar decretos:', error);
    return [];
  }
}

/**
 * Obtiene un decreto por ID
 * @param {number} id - ID del decreto
 * @returns {Promise<Object|null>} Decreto o null
 */
export async function obtenerDecreto(id) {
  try {
    return await repo.getById(id);
  } catch (error) {
    console.error('Error al obtener decreto:', error);
    return null;
  }
}

/**
 * Crea un nuevo decreto
 * @param {Object} datos - Datos del decreto
 * @param {string} datos.nombre - Nombre del decreto
 * @param {string} datos.contenido_html - Contenido HTML del decreto (será sanitizado)
 * @param {string} [datos.content_delta] - Delta JSON del editor (opcional)
 * @param {string} [datos.content_text] - Texto plano (opcional)
 * @param {string} [datos.descripcion] - Descripción opcional
 * @param {number} [datos.nivel_minimo] - Nivel mínimo requerido (default: 1)
 * @param {string} [datos.posicion] - Posición (default: 'inicio')
 * @param {boolean} [datos.obligatoria_global] - Obligatoria global (default: false)
 * @param {Object} [datos.obligatoria_por_nivel] - Obligatoriedad por nivel (default: {})
 * @param {number} [datos.orden] - Orden (default: 0)
 * @returns {Promise<Object>} Decreto creado
 */
export async function crearDecreto(datos) {
  try {
    return await repo.create({
      nombre: datos.nombre || 'Decreto sin nombre',
      contenido_html: datos.contenido_html || '',
      content_delta: datos.content_delta,
      content_text: datos.content_text,
      descripcion: datos.descripcion,
      nivel_minimo: datos.nivel_minimo || 1,
      posicion: datos.posicion || 'inicio',
      obligatoria_global: datos.obligatoria_global || false,
      obligatoria_por_nivel: datos.obligatoria_por_nivel || {},
      orden: datos.orden || 0
    });
  } catch (error) {
    console.error('Error al crear decreto:', error);
    throw error;
  }
}

/**
 * Actualiza un decreto existente
 * @param {number} id - ID del decreto
 * @param {Object} datos - Datos a actualizar (parcial)
 * @returns {Promise<Object>} Decreto actualizado
 */
export async function actualizarDecreto(id, datos) {
  try {
    const resultado = await repo.update(id, datos);
    if (!resultado) {
      throw new Error(`Decreto con ID ${id} no encontrado`);
    }
    return resultado;
  } catch (error) {
    console.error('Error al actualizar decreto:', error);
    throw error;
  }
}

/**
 * Elimina un decreto (soft delete)
 * @param {number} id - ID del decreto
 * @returns {Promise<boolean>} true si se eliminó correctamente
 */
export async function eliminarDecreto(id) {
  try {
    return await repo.softDelete(id);
  } catch (error) {
    console.error('Error al eliminar decreto:', error);
    throw error;
  }
}

/**
 * Restaura un decreto eliminado (soft delete)
 * @param {number} id - ID del decreto
 * @returns {Promise<Object|null>} Decreto restaurado o null si no existe
 */
export async function restaurarDecreto(id) {
  try {
    return await repo.restore(id);
  } catch (error) {
    console.error('Error al restaurar decreto:', error);
    throw error;
  }
}

/**
 * Sincroniza decretos desde Google Drive (stub)
 * @returns {Promise<Object>} Resultado de la sincronización
 */
export async function sincronizarDesdeDrive() {
  // Lógica aún no implementada
  return {
    success: false,
    message: 'Sincronización con Drive aún no implementada'
  };
}

/**
 * Sincroniza decretos con ClickUp (stub)
 * @returns {Promise<Object>} Resultado de la sincronización
 */
export async function sincronizarConClickUp() {
  // Lógica aún no implementada
  return {
    success: false,
    message: 'Sincronización con ClickUp aún no implementada'
  };
}

