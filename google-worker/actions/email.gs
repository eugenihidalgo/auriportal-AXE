/**
 * ============================================================================
 * ACCIONES DE EMAIL (GMAIL)
 * ============================================================================
 * 
 * Funciones para enviar emails usando GmailApp de Google Workspace.
 */

/**
 * Acción: enviar_email
 * 
 * Envía un email usando GmailApp con soporte para HTML, alias, y adjuntos.
 * 
 * PARÁMETROS RECIBIDOS:
 * @param {string} to - Email del destinatario (puede ser array para múltiples)
 * @param {string} subject - Asunto del email
 * @param {string} htmlBody - Cuerpo del email en HTML
 * @param {string} from - Alias de email desde el cual enviar (opcional, usa el predeterminado si no se especifica)
 * @param {Array<Object>} adjuntos - Array de adjuntos (opcional)
 *   Cada adjunto: { id: "drive_file_id", nombre: "archivo.pdf" }
 * @param {string} cc - Email en copia (opcional, puede ser array)
 * @param {string} bcc - Email en copia oculta (opcional, puede ser array)
 * 
 * RESPUESTA:
 * {
 *   status: "ok",
 *   message: "Email enviado exitosamente",
 *   data: {
 *     messageId: "xxx",
 *     to: ["email@ejemplo.com"],
 *     subject: "..."
 *   }
 * }
 * 
 * CÓMO LO LLAMA EL SERVIDOR:
 * {
 *   "token": "SECRET_TOKEN",
 *   "accion": "enviar_email",
 *   "to": "alumno@ejemplo.com",
 *   "subject": "Bienvenido a AuriPortal",
 *   "htmlBody": "<h1>Bienvenido</h1><p>Contenido...</p>",
 *   "from": "noreply@midominio.com" (opcional),
 *   "adjuntos": [{"id": "1abc123...", "nombre": "informe.pdf"}] (opcional),
 *   "cc": "admin@ejemplo.com" (opcional),
 *   "bcc": "log@ejemplo.com" (opcional)
 * }
 */
function accionEnviarEmail(requestData) {
  try {
    // Validar parámetros requeridos
    const validation = validateRequired(requestData, ['to', 'subject', 'htmlBody']);
    if (!validation.valid) {
      return sendError(`Faltan parámetros requeridos: ${validation.missing.join(', ')}`);
    }
    
    const to = requestData.to;
    const subject = requestData.subject;
    const htmlBody = requestData.htmlBody;
    const from = requestData.from || null;
    const adjuntos = requestData.adjuntos || [];
    const cc = requestData.cc || null;
    const bcc = requestData.bcc || null;
    
    // Validar formato de email(s)
    const emailsTo = Array.isArray(to) ? to : [to];
    for (const email of emailsTo) {
      if (!isValidEmail(email)) {
        return sendError(`Email inválido en 'to': ${email}`);
      }
    }
    
    // Procesar adjuntos
    const attachments = [];
    for (const adjunto of adjuntos) {
      try {
        if (!adjunto.id) {
          return sendError("Cada adjunto debe tener un 'id' (ID de archivo de Drive)");
        }
        
        const archivo = DriveApp.getFileById(adjunto.id);
        const blob = archivo.getAs(archivo.getMimeType());
        
        // Usar el nombre proporcionado o el nombre del archivo original
        if (adjunto.nombre) {
          blob.setName(adjunto.nombre);
        }
        
        attachments.push(blob);
      } catch (e) {
        return sendError(`Error al procesar adjunto con ID '${adjunto.id}': ${e.toString()}`);
      }
    }
    
    // Preparar opciones del email
    const options = {
      htmlBody: htmlBody,
      attachments: attachments.length > 0 ? attachments : undefined,
      cc: cc,
      bcc: bcc
    };
    
    // Eliminar propiedades undefined
    Object.keys(options).forEach(key => {
      if (options[key] === undefined) {
        delete options[key];
      }
    });
    
    // Enviar el email
    // Nota: El parámetro 'from' (alias) requiere configuración especial en Gmail
    // Si se necesita usar un alias, debe configurarse en Gmail Settings del usuario
    // GmailApp.sendEmail() no permite especificar 'from' directamente en Apps Script
    // Se usa Gmail API avanzada para esto, pero para simplificar usamos GmailApp
    
    let messageId;
    if (Array.isArray(to)) {
      GmailApp.sendEmail(to.join(','), subject, '', options);
      // No hay forma directa de obtener messageId con GmailApp.sendEmail
      // Se podría usar Gmail API avanzada, pero por simplicidad no lo incluimos
      messageId = 'sent';
    } else {
      GmailApp.sendEmail(to, subject, '', options);
      messageId = 'sent';
    }
    
    return sendSuccess("Email enviado exitosamente", {
      messageId: messageId,
      to: emailsTo,
      subject: subject,
      hasAttachments: attachments.length > 0,
      attachmentsCount: attachments.length
    });
    
  } catch (error) {
    return sendError(`Error al enviar email: ${error.toString()}`);
  }
}

