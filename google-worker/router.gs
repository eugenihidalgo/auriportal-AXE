/**
 * ============================================================================
 * ROUTER - Enrutador de Acciones
 * ============================================================================
 * 
 * Enruta las peticiones según el parámetro "accion" recibido.
 * Cada acción llama a su respectiva función en el módulo correspondiente.
 * 
 * ACCIONES DISPONIBLES:
 * - ping: Test de conectividad
 * - crear_carpeta: Crear carpeta en Drive
 * - crear_documento: Crear Google Docs
 * - generar_pdf: Convertir Docs a PDF
 * - enviar_email: Enviar email con Gmail
 * - crear_evento_calendar: Crear evento en Calendar
 * - mover_archivo: Mover archivo entre carpetas
 * - crear_estructura_alumno: Crear estructura de carpetas para alumno
 * - crear_informe_aurielin: Crear informe completo con formato
 * - registrar_log: Registrar acción en hoja de cálculo
 * 
 * @param {Object} requestData - Datos de la petición
 * @param {string} requestData.accion - Acción a ejecutar
 * @returns {Object} Respuesta JSON
 */
function router(requestData) {
  const accion = requestData.accion;
  
  try {
    switch(accion) {
      case 'ping':
        return sendSuccess("Google Worker AuriPortal activo", {
          timestamp: new Date().toISOString(),
          version: "8.0"
        });
        
      case 'crear_carpeta':
        return accionCrearCarpeta(requestData);
        
      case 'crear_documento':
        return accionCrearDocumento(requestData);
        
      case 'generar_pdf':
        return accionGenerarPDF(requestData);
        
      case 'enviar_email':
        return accionEnviarEmail(requestData);
        
      case 'crear_evento_calendar':
        return accionCrearEventoCalendar(requestData);
        
      case 'mover_archivo':
        return accionMoverArchivo(requestData);
        
      case 'crear_estructura_alumno':
        return accionCrearEstructuraAlumno(requestData);
        
      case 'crear_informe_aurielin':
        return accionCrearInformeAurielin(requestData);
        
      case 'registrar_log':
        return accionRegistrarLog(requestData);
        
      default:
        return sendError(`Acción '${accion}' no reconocida. Acciones disponibles: ping, crear_carpeta, crear_documento, generar_pdf, enviar_email, crear_evento_calendar, mover_archivo, crear_estructura_alumno, crear_informe_aurielin, registrar_log`);
    }
  } catch (error) {
    return sendError(`Error ejecutando acción '${accion}': ${error.toString()}`);
  }
}

