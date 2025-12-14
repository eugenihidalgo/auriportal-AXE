/**
 * ============================================================================
 * UTILIDADES DE RESPUESTA
 * ============================================================================
 * 
 * Funciones helper para generar respuestas JSON consistentes.
 * Todas las respuestas siguen el mismo formato estándar.
 * 
 * NOTA: Google Apps Script Web Apps NO permite usar setStatusCode().
 * Los códigos HTTP deben manejarse en el cliente que consume la API.
 */

/**
 * Función base para enviar JSON
 * 
 * @param {Object} obj - Objeto a serializar como JSON
 * @returns {TextOutput} Respuesta JSON formateada
 */
function sendJson(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj, null, 2))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Envía una respuesta exitosa
 * 
 * @param {string} message - Mensaje descriptivo
 * @param {Object} data - Datos adicionales a incluir (opcional)
 * @returns {TextOutput} Respuesta JSON formateada
 * 
 * Formato:
 * {
 *   status: "ok",
 *   message: "...",
 *   data: { ... }
 * }
 */
function sendSuccess(message, data = {}) {
  const response = {
    status: "ok",
    message: message,
    data: data
  };
  
  return sendJson(response);
}

/**
 * Envía una respuesta de error
 * 
 * @param {string} message - Mensaje de error descriptivo
 * @param {Object} errorData - Datos adicionales del error (opcional)
 * @returns {TextOutput} Respuesta JSON formateada
 * 
 * Formato:
 * {
 *   status: "error",
 *   message: "...",
 *   data: { error: "...", ... }
 * }
 * 
 * NOTA: El código HTTP debe manejarse en el cliente.
 * Esta función siempre devuelve status: "error" en el JSON.
 */
function sendError(message, errorData = {}) {
  const response = {
    status: "error",
    message: message,
    data: {
      error: message,
      ...errorData
    }
  };
  
  return sendJson(response);
}

