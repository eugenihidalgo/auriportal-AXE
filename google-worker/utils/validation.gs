/**
 * ============================================================================
 * UTILIDADES DE VALIDACIÓN
 * ============================================================================
 * 
 * Funciones para validar parámetros requeridos y tipos de datos.
 */

/**
 * Valida que un objeto tenga las propiedades requeridas
 * 
 * @param {Object} obj - Objeto a validar
 * @param {Array<string>} requiredFields - Array de nombres de campos requeridos
 * @returns {Object} { valid: boolean, missing: Array<string> }
 * 
 * Ejemplo de uso:
 * const validation = validateRequired(params, ['nombre', 'email']);
 * if (!validation.valid) {
 *   return sendError(`Faltan campos: ${validation.missing.join(', ')}`);
 * }
 */
function validateRequired(obj, requiredFields) {
  const missing = [];
  
  for (const field of requiredFields) {
    if (obj[field] === undefined || obj[field] === null || obj[field] === '') {
      missing.push(field);
    }
  }
  
  return {
    valid: missing.length === 0,
    missing: missing
  };
}

/**
 * Valida que un ID de Google Drive tenga formato válido
 * 
 * @param {string} id - ID a validar
 * @returns {boolean} true si es válido
 */
function isValidDriveId(id) {
  return id && typeof id === 'string' && id.length > 0;
}

/**
 * Valida formato de email básico
 * 
 * @param {string} email - Email a validar
 * @returns {boolean} true si el formato es válido
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
















