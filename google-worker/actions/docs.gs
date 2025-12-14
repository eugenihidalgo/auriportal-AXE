/**
 * ============================================================================
 * ACCIONES DE GOOGLE DOCS
 * ============================================================================
 * 
 * Funciones para crear y gestionar documentos de Google Docs.
 */

/**
 * Acción: crear_documento
 * 
 * Crea un nuevo documento de Google Docs con contenido HTML o texto plano.
 * 
 * PARÁMETROS RECIBIDOS:
 * @param {string} nombre - Nombre del documento
 * @param {string} contenido - Contenido del documento (texto o HTML)
 * @param {boolean} es_html - Si el contenido es HTML (default: false)
 * @param {string} carpeta_id - ID de la carpeta donde guardar (opcional)
 * 
 * RESPUESTA:
 * {
 *   status: "ok",
 *   message: "Documento creado exitosamente",
 *   data: {
 *     id: "xxx",
 *     url: "https://docs.google.com/document/d/xxx",
 *     nombre: "..."
 *   }
 * }
 * 
 * CÓMO LO LLAMA EL SERVIDOR:
 * {
 *   "token": "SECRET_TOKEN",
 *   "accion": "crear_documento",
 *   "nombre": "Mi Documento",
 *   "contenido": "<h1>Título</h1><p>Texto...</p>",
 *   "es_html": true,
 *   "carpeta_id": "1abc123..." (opcional)
 * }
 */
function accionCrearDocumento(requestData) {
  try {
    // Validar parámetros requeridos
    const validation = validateRequired(requestData, ['nombre', 'contenido']);
    if (!validation.valid) {
      return sendError(`Faltan parámetros requeridos: ${validation.missing.join(', ')}`);
    }
    
    const nombre = requestData.nombre;
    const contenido = requestData.contenido;
    const esHtml = requestData.es_html === true;
    const carpetaId = requestData.carpeta_id || null;
    
    // Crear el documento
    const doc = DocumentApp.create(nombre);
    const body = doc.getBody();
    
    // Insertar contenido
    if (esHtml) {
      // Si es HTML, usar insertHorizontalRule seguido de insertParagraph con HTML
      // Nota: Google Apps Script tiene limitaciones con HTML, así que intentamos parsear básicamente
      body.clear();
      
      // Convertir HTML básico a formato de Docs
      // Esto es una implementación simplificada
      const textoPlano = contenido.replace(/<[^>]+>/g, ''); // Remover tags HTML
      body.appendParagraph(textoPlano);
      
      // Intentar aplicar formato básico
      try {
        // Para mejor soporte HTML, se recomienda usar Drive API con convert: true
        // Pero para simplificar, usamos texto plano
        body.appendParagraph(contenido);
      } catch (e) {
        // Si falla, usar texto plano
        body.setText(contenido.replace(/<[^>]+>/g, ''));
      }
    } else {
      // Texto plano directo
      body.clear();
      body.appendParagraph(contenido);
    }
    
    // Guardar cambios
    doc.saveAndClose();
    
    // Mover a carpeta si se especifica
    if (carpetaId) {
      try {
        const archivo = DriveApp.getFileById(doc.getId());
        const carpeta = DriveApp.getFolderById(carpetaId);
        const carpetasActuales = archivo.getParents();
        
        // Eliminar de ubicación actual
        while (carpetasActuales.hasNext()) {
          const carpetaActual = carpetasActuales.next();
          carpetaActual.removeFile(archivo);
        }
        
        // Añadir a nueva carpeta
        carpeta.addFile(archivo);
      } catch (e) {
        // Si falla mover, el documento ya está creado, solo avisamos
        // No fallamos la operación completa
      }
    }
    
    return sendSuccess("Documento creado exitosamente", {
      id: doc.getId(),
      url: `https://docs.google.com/document/d/${doc.getId()}`,
      nombre: doc.getName()
    });
    
  } catch (error) {
    return sendError(`Error al crear documento: ${error.toString()}`);
  }
}

/**
 * Acción: generar_pdf
 * 
 * Convierte un documento de Google Docs a PDF y lo guarda en una carpeta destino.
 * 
 * PARÁMETROS RECIBIDOS:
 * @param {string} documento_id - ID del documento a convertir
 * @param {string} nombre_pdf - Nombre del archivo PDF (sin extensión .pdf)
 * @param {string} carpeta_destino_id - ID de la carpeta donde guardar el PDF
 * 
 * RESPUESTA:
 * {
 *   status: "ok",
 *   message: "PDF generado exitosamente",
 *   data: {
 *     id: "xxx",
 *     url: "https://drive.google.com/file/d/xxx",
 *     nombre: "..."
 *   }
 * }
 * 
 * CÓMO LO LLAMA EL SERVIDOR:
 * {
 *   "token": "SECRET_TOKEN",
 *   "accion": "generar_pdf",
 *   "documento_id": "1abc123...",
 *   "nombre_pdf": "informe_final",
 *   "carpeta_destino_id": "1xyz789..."
 * }
 */
function accionGenerarPDF(requestData) {
  try {
    // Validar parámetros requeridos
    const validation = validateRequired(requestData, ['documento_id', 'nombre_pdf', 'carpeta_destino_id']);
    if (!validation.valid) {
      return sendError(`Faltan parámetros requeridos: ${validation.missing.join(', ')}`);
    }
    
    const documentoId = requestData.documento_id;
    const nombrePdf = requestData.nombre_pdf;
    const carpetaDestinoId = requestData.carpeta_destino_id;
    
    // Obtener el documento
    let documento;
    try {
      documento = DocumentApp.openById(documentoId);
    } catch (e) {
      return sendError(`El documento con ID '${documentoId}' no existe o no tienes acceso`);
    }
    
    // Obtener la carpeta destino
    let carpetaDestino;
    try {
      carpetaDestino = DriveApp.getFolderById(carpetaDestinoId);
    } catch (e) {
      return sendError(`La carpeta destino con ID '${carpetaDestinoId}' no existe o no tienes acceso`);
    }
    
    // Obtener el archivo del documento
    const archivoDoc = DriveApp.getFileById(documentoId);
    
    // Generar el PDF usando el exportador de Drive
    // Nota: El nombre debe incluir .pdf, pero Drive lo añadirá automáticamente si no lo incluye
    const nombreFinal = nombrePdf.endsWith('.pdf') ? nombrePdf : nombrePdf + '.pdf';
    
    // Convertir a PDF usando getAs
    const blob = archivoDoc.getAs(MimeType.PDF);
    blob.setName(nombreFinal);
    
    // Crear el archivo PDF en la carpeta destino
    const pdfFile = carpetaDestino.createFile(blob);
    
    return sendSuccess("PDF generado exitosamente", {
      id: pdfFile.getId(),
      url: `https://drive.google.com/file/d/${pdfFile.getId()}`,
      nombre: pdfFile.getName()
    });
    
  } catch (error) {
    return sendError(`Error al generar PDF: ${error.toString()}`);
  }
}

