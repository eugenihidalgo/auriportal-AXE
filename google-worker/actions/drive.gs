/**
 * ============================================================================
 * ACCIONES DE GOOGLE DRIVE
 * ============================================================================
 * 
 * Funciones para gestionar carpetas y archivos en Google Drive.
 */

/**
 * Acción: crear_carpeta
 * 
 * Crea una carpeta nueva dentro de una carpeta padre en Google Drive.
 * 
 * PARÁMETROS RECIBIDOS (en requestData):
 * @param {string} nombre - Nombre de la carpeta a crear
 * @param {string} padre_id - ID de la carpeta padre (opcional, si no se proporciona se crea en raíz)
 * 
 * RESPUESTA:
 * {
 *   status: "ok",
 *   message: "Carpeta creada exitosamente",
 *   data: {
 *     id: "xxx",
 *     url: "https://drive.google.com/drive/folders/xxx",
 *     nombre: "..."
 *   }
 * }
 * 
 * CÓMO LO LLAMA EL SERVIDOR:
 * POST al Web App URL
 * {
 *   "token": "SECRET_TOKEN",
 *   "accion": "crear_carpeta",
 *   "nombre": "Mi Carpeta",
 *   "padre_id": "1abc123..." (opcional)
 * }
 */
function accionCrearCarpeta(requestData) {
  try {
    // Validar parámetros requeridos
    const validation = validateRequired(requestData, ['nombre']);
    if (!validation.valid) {
      return sendError(`Faltan parámetros requeridos: ${validation.missing.join(', ')}`);
    }
    
    const nombre = requestData.nombre;
    const padreId = requestData.padre_id || null;
    
    // Crear la carpeta
    let folder;
    if (padreId) {
      // Validar que el padre existe
      try {
        const padre = DriveApp.getFolderById(padreId);
        folder = padre.createFolder(nombre);
      } catch (e) {
        return sendError(`La carpeta padre con ID '${padreId}' no existe o no tienes acceso`);
      }
    } else {
      // Crear en la raíz de Drive
      folder = DriveApp.createFolder(nombre);
    }
    
    return sendSuccess("Carpeta creada exitosamente", {
      id: folder.getId(),
      url: `https://drive.google.com/drive/folders/${folder.getId()}`,
      nombre: folder.getName()
    });
    
  } catch (error) {
    return sendError(`Error al crear carpeta: ${error.toString()}`);
  }
}

/**
 * Acción: mover_archivo
 * 
 * Mueve un archivo desde una ubicación a otra en Google Drive.
 * 
 * PARÁMETROS RECIBIDOS:
 * @param {string} archivo_id - ID del archivo a mover
 * @param {string} destino_id - ID de la carpeta destino
 * @param {boolean} eliminar_original - Si eliminar de la ubicación original (default: true)
 * 
 * RESPUESTA:
 * {
 *   status: "ok",
 *   message: "Archivo movido exitosamente",
 *   data: {
 *     id: "xxx",
 *     url: "https://drive.google.com/file/d/xxx",
 *     destino_url: "https://drive.google.com/drive/folders/xxx"
 *   }
 * }
 * 
 * CÓMO LO LLAMA EL SERVIDOR:
 * {
 *   "token": "SECRET_TOKEN",
 *   "accion": "mover_archivo",
 *   "archivo_id": "1abc123...",
 *   "destino_id": "1xyz789...",
 *   "eliminar_original": true
 *   }
 */
function accionMoverArchivo(requestData) {
  try {
    // Validar parámetros requeridos
    const validation = validateRequired(requestData, ['archivo_id', 'destino_id']);
    if (!validation.valid) {
      return sendError(`Faltan parámetros requeridos: ${validation.missing.join(', ')}`);
    }
    
    const archivoId = requestData.archivo_id;
    const destinoId = requestData.destino_id;
    const eliminarOriginal = requestData.eliminar_original !== false; // default: true
    
    // Obtener el archivo
    let archivo;
    try {
      archivo = DriveApp.getFileById(archivoId);
    } catch (e) {
      return sendError(`El archivo con ID '${archivoId}' no existe o no tienes acceso`);
    }
    
    // Obtener la carpeta destino
    let carpetaDestino;
    try {
      carpetaDestino = DriveApp.getFolderById(destinoId);
    } catch (e) {
      return sendError(`La carpeta destino con ID '${destinoId}' no existe o no tienes acceso`);
    }
    
    // Obtener las carpetas actuales del archivo
    const carpetasActuales = archivo.getParents();
    
    // Añadir a la nueva carpeta
    carpetaDestino.addFile(archivo);
    
    // Eliminar de las carpetas originales si se solicita
    if (eliminarOriginal) {
      while (carpetasActuales.hasNext()) {
        const carpetaActual = carpetasActuales.next();
        carpetaActual.removeFile(archivo);
      }
    }
    
    return sendSuccess("Archivo movido exitosamente", {
      id: archivo.getId(),
      url: `https://drive.google.com/file/d/${archivo.getId()}`,
      destino_url: `https://drive.google.com/drive/folders/${destinoId}`,
      nombre: archivo.getName()
    });
    
  } catch (error) {
    return sendError(`Error al mover archivo: ${error.toString()}`);
  }
}

/**
 * Helper: Obtener o crear carpeta por nombre en una carpeta padre
 * Útil para operaciones internas
 * 
 * @param {string} nombreCarpeta - Nombre de la carpeta
 * @param {string} padreId - ID de la carpeta padre
 * @returns {Folder} Carpeta encontrada o creada
 */
function obtenerOCrearCarpeta(nombreCarpeta, padreId) {
  const padre = DriveApp.getFolderById(padreId);
  const carpetas = padre.getFoldersByName(nombreCarpeta);
  
  if (carpetas.hasNext()) {
    return carpetas.next();
  } else {
    return padre.createFolder(nombreCarpeta);
  }
}

