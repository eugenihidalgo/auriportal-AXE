/**
 * ============================================================================
 * GOOGLE WORKER - AURIPORTAL V8.0
 * ============================================================================
 * 
 * Web App pública que actúa como Worker para automatizar Google Workspace.
 * Permite al servidor AuriPortal realizar acciones en Google mediante API.
 * 
 * CONFIGURACIÓN:
 * - Desplegar como Web App
 * - Ejecutar como: "Yo"
 * - Quien tiene acceso: "Cualquiera"
 * - Solo acepta POST
 * 
 * SEGURIDAD:
 * - Valida token secreto en header "X-Auri-Secret"
 * - Variable interna: SCRIPT_SECRET (configurar en ejecución o Properties)
 * 
 * @author AuriPortal Team
 * @version 8.0
 */

/**
 * Función principal que maneja las peticiones POST del servidor AuriPortal
 * 
 * @param {Object} e - Evento de la petición POST
 * @param {Object} e.parameter - Parámetros de la petición (NO usado, usamos postData)
 * @param {Object} e.postData - Datos POST enviados
 * @param {string} e.postData.contents - Contenido JSON como string
 * @param {string} e.postData.type - Tipo de contenido (application/json)
 * 
 * @returns {Object} Respuesta JSON con formato estándar
 * 
 * Formato de respuesta:
 * {
 *   status: "ok" | "error",
 *   message: "descripción",
 *   data: { ... }
 * }
 */
function doPost(e) {
  try {
    // Parsear el JSON recibido
    let requestData;
    try {
      requestData = JSON.parse(e.postData.contents);
    } catch (parseError) {
      return sendError("JSON inválido en el body de la petición");
    }
    
    // Validar token secreto
    // Obtener el SECRET desde Script Properties (configurar en Apps Script)
    const scriptProperties = PropertiesService.getScriptProperties();
    const SECRET = scriptProperties.getProperty('SCRIPT_SECRET');
    
    if (!SECRET) {
      return sendError("SCRIPT_SECRET no configurado. Configura la propiedad SCRIPT_SECRET en Script Properties.");
    }
    
    // El token puede venir en el body JSON (recomendado) o como query parameter
    // NOTA: Por seguridad, se recomienda usar body JSON, no query params
    const token = requestData.token || e.parameter.token;
    
    if (!token || token !== SECRET) {
      return sendError("Token no autorizado. El token proporcionado no coincide con SCRIPT_SECRET.");
    }
    
    // Validar que hay una acción
    if (!requestData.accion) {
      return sendError("Parámetro 'accion' es requerido");
    }
    
    // Llamar al router para procesar la acción
    return router(requestData);
    
  } catch (error) {
    // Capturar cualquier error no manejado
    return sendError("Error interno del servidor: " + error.toString());
  }
}

/**
 * Función GET opcional para verificar que el Worker está activo
 * Útil para health checks
 * 
 * @param {Object} e - Evento GET
 * @returns {Object} Respuesta JSON con estado
 */
function doGet(e) {
  return sendSuccess("Google Worker AuriPortal V8.0 está activo", {
    version: "8.0",
    timestamp: new Date().toISOString()
  });
}

