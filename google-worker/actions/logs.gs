/**
 * ============================================================================
 * SISTEMA DE LOGS
 * ============================================================================
 * 
 * Registra todas las acciones en una hoja de cálculo de Google Sheets.
 */

/**
 * Acción: registrar_log
 * 
 * Registra una acción en la hoja de cálculo "Logs_AuriPortal".
 * Si la hoja no existe, la crea automáticamente.
 * 
 * PARÁMETROS RECIBIDOS:
 * @param {string} accion - Nombre de la acción realizada
 * @param {string} usuario - ID o email del usuario que realizó la acción
 * @param {Object} payload - Datos adicionales de la acción (se serializa a JSON)
 * @param {string} spreadsheet_id - ID de la hoja de cálculo (opcional, se buscará "Logs_AuriPortal")
 * 
 * RESPUESTA:
 * {
 *   status: "ok",
 *   message: "Log registrado exitosamente",
 *   data: {
 *     fila: 123,
 *     fecha: "2024-01-15T10:00:00Z"
 *   }
 * }
 * 
 * CÓMO LO LLAMA EL SERVIDOR:
 * {
 *   "token": "SECRET_TOKEN",
 *   "accion": "registrar_log",
 *   "accion": "crear_informe",
 *   "usuario": "alumno@ejemplo.com",
 *   "payload": { "alumno_id": "12345", "informe_id": "abc123" },
 *   "spreadsheet_id": "1abc123..." (opcional)
 * }
 * 
 * NOTA: También se puede llamar internamente desde otras acciones para logging automático.
 */
function accionRegistrarLog(requestData) {
  try {
    // Validar parámetros requeridos
    // NOTA: No validamos token aquí porque ya se validó en Code.gs
    const validation = validateRequired(requestData, ['accion', 'usuario']);
    if (!validation.valid) {
      return sendError(`Faltan parámetros requeridos: ${validation.missing.join(', ')}`);
    }
    
    const accion = requestData.accion;
    const usuario = requestData.usuario;
    const payload = requestData.payload || {};
    const spreadsheetId = requestData.spreadsheet_id || null;
    
    // Obtener o crear la hoja de cálculo
    let spreadsheet;
    if (spreadsheetId) {
      try {
        spreadsheet = SpreadsheetApp.openById(spreadsheetId);
      } catch (e) {
        return sendError(`La hoja de cálculo con ID '${spreadsheetId}' no existe o no tienes acceso`);
      }
    } else {
      spreadsheet = obtenerOCrearSpreadsheetLogs();
    }
    
    // Obtener la hoja activa
    const sheet = spreadsheet.getActiveSheet();
    
    // Preparar datos para insertar
    const fecha = new Date();
    const fechaStr = Utilities.formatDate(fecha, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    const horaStr = Utilities.formatDate(fecha, Session.getScriptTimeZone(), 'HH:mm:ss');
    const payloadStr = JSON.stringify(payload);
    
    // Añadir fila
    sheet.appendRow([fechaStr, horaStr, accion, usuario, payloadStr]);
    
    // Obtener el número de fila insertada
    const ultimaFila = sheet.getLastRow();
    
    return sendSuccess("Log registrado exitosamente", {
      fila: ultimaFila,
      fecha: fecha.toISOString(),
      spreadsheet_id: spreadsheet.getId(),
      spreadsheet_url: spreadsheet.getUrl()
    });
    
  } catch (error) {
    return sendError(`Error al registrar log: ${error.toString()}`);
  }
}

/**
 * Función helper para registrar logs internamente
 * Útil para logging automático desde otras acciones
 * 
 * @param {string} accion - Nombre de la acción
 * @param {string} usuario - ID o email del usuario
 * @param {Object} payload - Datos adicionales
 */
/**
 * Función helper para registrar logs internamente desde otras acciones
 * Esta función NO valida token ya que se llama internamente
 * 
 * @param {string} accion - Nombre de la acción
 * @param {string} usuario - ID o email del usuario
 * @param {Object} payload - Datos adicionales
 */
function registrarLogInterno(accion, usuario, payload = {}) {
  try {
    // Llamar directamente a la lógica sin pasar por validación de token
    const spreadsheet = obtenerOCrearSpreadsheetLogs();
    const sheet = spreadsheet.getActiveSheet();
    
    const fecha = new Date();
    const fechaStr = Utilities.formatDate(fecha, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    const horaStr = Utilities.formatDate(fecha, Session.getScriptTimeZone(), 'HH:mm:ss');
    const payloadStr = JSON.stringify(payload);
    
    sheet.appendRow([fechaStr, horaStr, accion, usuario, payloadStr]);
  } catch (e) {
    // No fallar la operación principal si falla el logging
    console.log('Error al registrar log interno:', e.toString());
  }
}

/**
 * Obtiene o crea la hoja de cálculo de logs
 * Helper interno para reutilizar en registrarLogInterno
 * 
 * @returns {Spreadsheet} Hoja de cálculo de logs
 */
function obtenerOCrearSpreadsheetLogs() {
  const archivos = DriveApp.getFilesByName('Logs_AuriPortal');
  if (archivos.hasNext()) {
    const archivo = archivos.next();
    return SpreadsheetApp.openById(archivo.getId());
  } else {
    // Crear nueva hoja de cálculo
    const spreadsheet = SpreadsheetApp.create('Logs_AuriPortal');
    const sheet = spreadsheet.getActiveSheet();
    
    // Añadir encabezados
    sheet.appendRow(['Fecha', 'Hora', 'Acción', 'Usuario', 'Payload']);
    
    // Formatear encabezados
    const headerRange = sheet.getRange(1, 1, 1, 5);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#4285f4');
    headerRange.setFontColor('#ffffff');
    
    // Congelar primera fila
    sheet.setFrozenRows(1);
    
    return spreadsheet;
  }
}

