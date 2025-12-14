/**
 * ============================================================================
 * ACCIONES ESPECÍFICAS DE AURIELIN
 * ============================================================================
 * 
 * Funciones especializadas para automatizar procesos específicos de AuriPortal.
 */

/**
 * Acción: crear_estructura_alumno
 * 
 * Crea automáticamente la estructura de carpetas para un alumno:
 * /Alumnos/{ID}/Eventos
 * /Alumnos/{ID}/Informes
 * /Alumnos/{ID}/Materiales
 * 
 * PARÁMETROS RECIBIDOS:
 * @param {string} alumno_id - ID único del alumno
 * @param {string} carpeta_alumnos_id - ID de la carpeta base "Alumnos" (opcional, se buscará si no se proporciona)
 * 
 * RESPUESTA:
 * {
 *   status: "ok",
 *   message: "Estructura de alumno creada exitosamente",
 *   data: {
 *     carpeta_alumno: {
 *       id: "xxx",
 *       url: "https://drive.google.com/drive/folders/xxx",
 *       nombre: "12345"
 *     },
 *     subcarpetas: {
 *       eventos: { id: "xxx", url: "..." },
 *       informes: { id: "xxx", url: "..." },
 *       materiales: { id: "xxx", url: "..." }
 *     }
 *   }
 * }
 * 
 * CÓMO LO LLAMA EL SERVIDOR:
 * {
 *   "token": "SECRET_TOKEN",
 *   "accion": "crear_estructura_alumno",
 *   "alumno_id": "12345",
 *   "carpeta_alumnos_id": "1abc123..." (opcional)
 * }
 */
function accionCrearEstructuraAlumno(requestData) {
  try {
    // Validar parámetros requeridos
    const validation = validateRequired(requestData, ['alumno_id']);
    if (!validation.valid) {
      return sendError(`Faltan parámetros requeridos: ${validation.missing.join(', ')}`);
    }
    
    const alumnoId = requestData.alumno_id;
    const carpetaAlumnosId = requestData.carpeta_alumnos_id || null;
    
    // Obtener o crear la carpeta base "Alumnos"
    let carpetaAlumnos;
    if (carpetaAlumnosId) {
      try {
        carpetaAlumnos = DriveApp.getFolderById(carpetaAlumnosId);
      } catch (e) {
        return sendError(`La carpeta Alumnos con ID '${carpetaAlumnosId}' no existe o no tienes acceso`);
      }
    } else {
      // Buscar carpeta "Alumnos" en la raíz
      const carpetas = DriveApp.getRootFolder().getFoldersByName('Alumnos');
      if (carpetas.hasNext()) {
        carpetaAlumnos = carpetas.next();
      } else {
        // Crear carpeta Alumnos si no existe
        carpetaAlumnos = DriveApp.getRootFolder().createFolder('Alumnos');
      }
    }
    
    // Crear o obtener carpeta del alumno
    let carpetaAlumno;
    const carpetasAlumno = carpetaAlumnos.getFoldersByName(alumnoId);
    if (carpetasAlumno.hasNext()) {
      carpetaAlumno = carpetasAlumno.next();
    } else {
      carpetaAlumno = carpetaAlumnos.createFolder(alumnoId);
    }
    
    // Crear subcarpetas: Eventos, Informes, Materiales
    const subcarpetas = {
      eventos: obtenerOCrearCarpeta('Eventos', carpetaAlumno.getId()),
      informes: obtenerOCrearCarpeta('Informes', carpetaAlumno.getId()),
      materiales: obtenerOCrearCarpeta('Materiales', carpetaAlumno.getId())
    };
    
    return sendSuccess("Estructura de alumno creada exitosamente", {
      carpeta_alumno: {
        id: carpetaAlumno.getId(),
        url: `https://drive.google.com/drive/folders/${carpetaAlumno.getId()}`,
        nombre: carpetaAlumno.getName()
      },
      subcarpetas: {
        eventos: {
          id: subcarpetas.eventos.getId(),
          url: `https://drive.google.com/drive/folders/${subcarpetas.eventos.getId()}`,
          nombre: subcarpetas.eventos.getName()
        },
        informes: {
          id: subcarpetas.informes.getId(),
          url: `https://drive.google.com/drive/folders/${subcarpetas.informes.getId()}`,
          nombre: subcarpetas.informes.getName()
        },
        materiales: {
          id: subcarpetas.materiales.getId(),
          url: `https://drive.google.com/drive/folders/${subcarpetas.materiales.getId()}`,
          nombre: subcarpetas.materiales.getName()
        }
      }
    });
    
  } catch (error) {
    return sendError(`Error al crear estructura de alumno: ${error.toString()}`);
  }
}

/**
 * Acción: crear_informe_aurielin
 * 
 * Crea un informe completo con formato bonito, lo convierte a PDF y lo guarda
 * en la carpeta de informes del alumno.
 * 
 * PARÁMETROS RECIBIDOS:
 * @param {string} alumno_id - ID del alumno
 * @param {string} titulo - Título del informe
 * @param {Object} contenido - Objeto con el contenido del informe generado por IA
 *   Estructura esperada:
 *   {
 *     introduccion: "...",
 *     secciones: [
 *       { titulo: "...", contenido: "..." },
 *       ...
 *     ],
 *     conclusion: "..."
 *   }
 * @param {string} carpeta_informes_id - ID de la carpeta Informes del alumno (opcional, se buscará si no se proporciona)
 * 
 * RESPUESTA:
 * {
 *   status: "ok",
 *   message: "Informe creado exitosamente",
 *   data: {
 *     documento: { id: "xxx", url: "..." },
 *     pdf: { id: "xxx", url: "..." }
 *   }
 * }
 * 
 * CÓMO LO LLAMA EL SERVIDOR:
 * {
 *   "token": "SECRET_TOKEN",
 *   "accion": "crear_informe_aurielin",
 *   "alumno_id": "12345",
 *   "titulo": "Informe de Progreso - Enero 2024",
 *   "contenido": {
 *     "introduccion": "Este informe detalla...",
 *     "secciones": [
 *       { "titulo": "Progreso General", "contenido": "El alumno ha mostrado..." },
 *       { "titulo": "Áreas de Mejora", "contenido": "Se recomienda..." }
 *     ],
 *     "conclusion": "En conclusión..."
 *   },
 *   "carpeta_informes_id": "1abc123..." (opcional)
 * }
 */
function accionCrearInformeAurielin(requestData) {
  try {
    // Validar parámetros requeridos
    const validation = validateRequired(requestData, ['alumno_id', 'titulo', 'contenido']);
    if (!validation.valid) {
      return sendError(`Faltan parámetros requeridos: ${validation.missing.join(', ')}`);
    }
    
    const alumnoId = requestData.alumno_id;
    const titulo = requestData.titulo;
    const contenido = requestData.contenido;
    const carpetaInformesId = requestData.carpeta_informes_id || null;
    
    // Obtener carpeta de informes
    let carpetaInformes;
    if (carpetaInformesId) {
      try {
        carpetaInformes = DriveApp.getFolderById(carpetaInformesId);
      } catch (e) {
        return sendError(`La carpeta Informes con ID '${carpetaInformesId}' no existe o no tienes acceso`);
      }
    } else {
      // Buscar automáticamente la carpeta de informes del alumno
      // Asumimos estructura: /Alumnos/{alumno_id}/Informes
      const carpetaAlumnos = DriveApp.getRootFolder().getFoldersByName('Alumnos').next();
      if (!carpetaAlumnos) {
        return sendError("No se encontró la carpeta 'Alumnos'. Usa 'crear_estructura_alumno' primero o proporciona 'carpeta_informes_id'");
      }
      
      const carpetaAlumno = carpetaAlumnos.getFoldersByName(alumnoId).next();
      if (!carpetaAlumno) {
        return sendError(`No se encontró la carpeta del alumno '${alumnoId}'. Usa 'crear_estructura_alumno' primero o proporciona 'carpeta_informes_id'`);
      }
      
      carpetaInformes = carpetaAlumno.getFoldersByName('Informes').next();
      if (!carpetaInformes) {
        return sendError(`No se encontró la carpeta 'Informes' del alumno. Usa 'crear_estructura_alumno' primero o proporciona 'carpeta_informes_id'`);
      }
    }
    
    // Crear el documento con formato bonito
    const nombreDocumento = `${titulo} - ${alumnoId}`;
    const doc = DocumentApp.create(nombreDocumento);
    const body = doc.getBody();
    
    // Limpiar el body
    body.clear();
    
    // Establecer estilo de título principal
    const tituloPar = body.appendParagraph(titulo);
    tituloPar.setHeading(DocumentApp.ParagraphHeading.TITLE);
    tituloPar.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    
    // Añadir fecha
    const fecha = new Date().toLocaleDateString('es-ES', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    const fechaPar = body.appendParagraph(`Fecha: ${fecha}`);
    fechaPar.setHeading(DocumentApp.ParagraphHeading.NORMAL);
    body.appendParagraph(''); // Línea en blanco
    
    // Introducción
    if (contenido.introduccion) {
      const introPar = body.appendParagraph('Introducción');
      introPar.setHeading(DocumentApp.ParagraphHeading.HEADING1);
      body.appendParagraph(contenido.introduccion);
      body.appendParagraph(''); // Línea en blanco
    }
    
    // Secciones
    if (contenido.secciones && Array.isArray(contenido.secciones)) {
      for (const seccion of contenido.secciones) {
        if (seccion.titulo) {
          const seccionPar = body.appendParagraph(seccion.titulo);
          seccionPar.setHeading(DocumentApp.ParagraphHeading.HEADING2);
        }
        if (seccion.contenido) {
          body.appendParagraph(seccion.contenido);
        }
        body.appendParagraph(''); // Línea en blanco
      }
    }
    
    // Conclusión
    if (contenido.conclusion) {
      const conclPar = body.appendParagraph('Conclusión');
      conclPar.setHeading(DocumentApp.ParagraphHeading.HEADING1);
      body.appendParagraph(contenido.conclusion);
    }
    
    // Guardar y cerrar
    doc.saveAndClose();
    
    // Mover documento a carpeta de informes
    const archivoDoc = DriveApp.getFileById(doc.getId());
    const carpetasActuales = archivoDoc.getParents();
    while (carpetasActuales.hasNext()) {
      const carpetaActual = carpetasActuales.next();
      carpetaActual.removeFile(archivoDoc);
    }
    carpetaInformes.addFile(archivoDoc);
    
    // Generar PDF
    const nombrePdf = `${titulo} - ${alumnoId}`;
    const blob = archivoDoc.getAs(MimeType.PDF);
    blob.setName(nombrePdf + '.pdf');
    const pdfFile = carpetaInformes.createFile(blob);
    
    return sendSuccess("Informe creado exitosamente", {
      documento: {
        id: doc.getId(),
        url: `https://docs.google.com/document/d/${doc.getId()}`,
        nombre: doc.getName()
      },
      pdf: {
        id: pdfFile.getId(),
        url: `https://drive.google.com/file/d/${pdfFile.getId()}`,
        nombre: pdfFile.getName()
      }
    });
    
  } catch (error) {
    return sendError(`Error al crear informe: ${error.toString()}`);
  }
}

