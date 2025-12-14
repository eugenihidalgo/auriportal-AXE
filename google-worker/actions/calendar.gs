/**
 * ============================================================================
 * ACCIONES DE GOOGLE CALENDAR
 * ============================================================================
 * 
 * Funciones para crear eventos en Google Calendar.
 */

/**
 * Acción: crear_evento_calendar
 * 
 * Crea un evento en Google Calendar con invitados y ubicación (Zoom).
 * 
 * PARÁMETROS RECIBIDOS:
 * @param {string} titulo - Título del evento
 * @param {string} descripcion - Descripción del evento
 * @param {string} fecha_inicio - Fecha y hora de inicio (ISO 8601: "2024-01-15T10:00:00")
 * @param {string} fecha_fin - Fecha y hora de fin (ISO 8601: "2024-01-15T11:00:00")
 * @param {string} ubicacion - Ubicación del evento (URL de Zoom, dirección, etc.)
 * @param {Array<string>} invitados - Array de emails de invitados (opcional)
 * @param {string} calendar_id - ID del calendario específico (opcional, usa el predeterminado si no se especifica)
 * 
 * RESPUESTA:
 * {
 *   status: "ok",
 *   message: "Evento creado exitosamente",
 *   data: {
 *     eventId: "xxx",
 *     htmlLink: "https://www.google.com/calendar/event?eid=xxx",
 *     titulo: "...",
 *     fecha_inicio: "...",
 *     fecha_fin: "..."
 *   }
 * }
 * 
 * CÓMO LO LLAMA EL SERVIDOR:
 * {
 *   "token": "SECRET_TOKEN",
 *   "accion": "crear_evento_calendar",
 *   "titulo": "Sesión de Meditación",
 *   "descripcion": "Sesión guiada de meditación",
 *   "fecha_inicio": "2024-01-15T10:00:00",
 *   "fecha_fin": "2024-01-15T11:00:00",
 *   "ubicacion": "https://zoom.us/j/123456789",
 *   "invitados": ["alumno@ejemplo.com", "instructor@ejemplo.com"],
 *   "calendar_id": "primary" (opcional)
 * }
 */
function accionCrearEventoCalendar(requestData) {
  try {
    // Validar parámetros requeridos
    const validation = validateRequired(requestData, ['titulo', 'fecha_inicio', 'fecha_fin']);
    if (!validation.valid) {
      return sendError(`Faltan parámetros requeridos: ${validation.missing.join(', ')}`);
    }
    
    const titulo = requestData.titulo;
    const descripcion = requestData.descripcion || '';
    const fechaInicio = new Date(requestData.fecha_inicio);
    const fechaFin = new Date(requestData.fecha_fin);
    const ubicacion = requestData.ubicacion || '';
    const invitados = requestData.invitados || [];
    const calendarId = requestData.calendar_id || 'primary';
    
    // Validar fechas
    if (isNaN(fechaInicio.getTime())) {
      return sendError("Fecha de inicio inválida. Usa formato ISO 8601: '2024-01-15T10:00:00'");
    }
    
    if (isNaN(fechaFin.getTime())) {
      return sendError("Fecha de fin inválida. Usa formato ISO 8601: '2024-01-15T11:00:00'");
    }
    
    if (fechaFin <= fechaInicio) {
      return sendError("La fecha de fin debe ser posterior a la fecha de inicio");
    }
    
    // Validar emails de invitados
    for (const email of invitados) {
      if (!isValidEmail(email)) {
        return sendError(`Email de invitado inválido: ${email}`);
      }
    }
    
    // Obtener el calendario
    let calendar;
    try {
      calendar = CalendarApp.getCalendarById(calendarId);
    } catch (e) {
      // Si no se puede obtener por ID, intentar con el calendario principal
      if (calendarId === 'primary') {
        calendar = CalendarApp.getDefaultCalendar();
      } else {
        return sendError(`No se pudo acceder al calendario con ID '${calendarId}': ${e.toString()}`);
      }
    }
    
    // Crear el evento
    const evento = calendar.createEvent(titulo, fechaInicio, fechaFin, {
      description: descripcion,
      location: ubicacion,
      guests: invitados.join(','),
      sendInvites: invitados.length > 0 // Enviar invitaciones solo si hay invitados
    });
    
    return sendSuccess("Evento creado exitosamente", {
      eventId: evento.getId(),
      htmlLink: evento.getHtmlLink(),
      titulo: evento.getTitle(),
      fecha_inicio: evento.getStartTime().toISOString(),
      fecha_fin: evento.getEndTime().toISOString(),
      ubicacion: evento.getLocation(),
      invitados: invitados
    });
    
  } catch (error) {
    return sendError(`Error al crear evento: ${error.toString()}`);
  }
}

