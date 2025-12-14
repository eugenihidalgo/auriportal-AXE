// src/services/google-workspace.js
// Servicio completo para integración con Google Workspace APIs
// Incluye: Gmail, Drive, Calendar, Sheets, Docs, Admin SDK, Groups

import { google } from 'googleapis';

// Cliente OAuth2 global
let oauth2Client = null;
let serviceAccountClient = null;

// Clientes de APIs (se inicializan bajo demanda)
const apiClients = {
  gmail: null,
  drive: null,
  calendar: null,
  sheets: null,
  docs: null,
  admin: null,
  groups: null
};

/**
 * Inicializa el cliente de autenticación de Google
 * Soporta OAuth2 y Service Account
 */
function inicializarClienteGoogle(env) {
  // Opción 1: Service Account (recomendado para servidores)
  if (env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    try {
      const serviceAccountKey = typeof env.GOOGLE_SERVICE_ACCOUNT_KEY === 'string' 
        ? JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_KEY)
        : env.GOOGLE_SERVICE_ACCOUNT_KEY;

      if (!serviceAccountClient) {
        const scopes = [
          'https://www.googleapis.com/auth/gmail.send',
          'https://www.googleapis.com/auth/gmail.readonly',
          'https://www.googleapis.com/auth/drive',
          'https://www.googleapis.com/auth/drive.file',
          'https://www.googleapis.com/auth/drive.readonly'
        ];
        
        serviceAccountClient = new google.auth.JWT(
          serviceAccountKey.client_email,
          null,
          serviceAccountKey.private_key,
          scopes,
          env.GOOGLE_SERVICE_ACCOUNT_IMPERSONATE || null // Usuario a impersonar
        );
      }
      return serviceAccountClient;
    } catch (error) {
      console.error('❌ Error inicializando Service Account:', error);
      throw error;
    }
  }

  // Opción 2: OAuth2 (para aplicaciones con usuarios)
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    if (!oauth2Client) {
      oauth2Client = new google.auth.OAuth2(
        env.GOOGLE_CLIENT_ID,
        env.GOOGLE_CLIENT_SECRET,
        env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/oauth/callback'
      );

      // Configurar refresh token si está disponible
      if (env.GOOGLE_REFRESH_TOKEN) {
        oauth2Client.setCredentials({
          refresh_token: env.GOOGLE_REFRESH_TOKEN
        });
      }
    }
    return oauth2Client;
  }

  throw new Error('Google Workspace no está configurado. Necesitas GOOGLE_SERVICE_ACCOUNT_KEY o (GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET)');
}

/**
 * Obtiene el cliente de autenticación
 */
function obtenerClienteAuth(env) {
  return inicializarClienteGoogle(env);
}

/**
 * Obtiene el cliente de Gmail API
 */
export function obtenerClienteGmail(env) {
  if (!apiClients.gmail) {
    const auth = obtenerClienteAuth(env);
    apiClients.gmail = google.gmail({ version: 'v1', auth });
  }
  return apiClients.gmail;
}

/**
 * Obtiene el cliente de Drive API
 */
export function obtenerClienteDrive(env) {
  if (!apiClients.drive) {
    const auth = obtenerClienteAuth(env);
    apiClients.drive = google.drive({ version: 'v3', auth });
  }
  return apiClients.drive;
}

/**
 * Obtiene el cliente de Calendar API
 */
export function obtenerClienteCalendar(env) {
  if (!apiClients.calendar) {
    const auth = obtenerClienteAuth(env);
    apiClients.calendar = google.calendar({ version: 'v3', auth });
  }
  return apiClients.calendar;
}

/**
 * Obtiene el cliente de Sheets API
 */
export function obtenerClienteSheets(env) {
  if (!apiClients.sheets) {
    const auth = obtenerClienteAuth(env);
    apiClients.sheets = google.sheets({ version: 'v4', auth });
  }
  return apiClients.sheets;
}

/**
 * Obtiene el cliente de Docs API
 */
export function obtenerClienteDocs(env) {
  if (!apiClients.docs) {
    const auth = obtenerClienteAuth(env);
    apiClients.docs = google.docs({ version: 'v1', auth });
  }
  return apiClients.docs;
}

/**
 * Obtiene el cliente de Admin SDK
 */
export function obtenerClienteAdmin(env) {
  if (!apiClients.admin) {
    const auth = obtenerClienteAuth(env);
    apiClients.admin = google.admin({ version: 'directory_v1', auth });
  }
  return apiClients.admin;
}

/**
 * Obtiene el cliente de Groups API (a través de Admin SDK)
 */
export function obtenerClienteGroups(env) {
  // Groups API usa Admin SDK
  return obtenerClienteAdmin(env);
}

// ============================================
// GMAIL API
// ============================================

/**
 * Envía un email usando Gmail API
 */
export async function enviarEmailGmail(env, destinatario, asunto, texto, html = null, remitente = 'me') {
  try {
    const gmail = obtenerClienteGmail(env);
    
    // Codificar el asunto en UTF-8 con formato RFC 2047
    const encodeSubject = (subject) => {
      // Si el asunto contiene caracteres no ASCII, codificarlo
      if (/[^\x00-\x7F]/.test(subject)) {
        const encoded = Buffer.from(subject, 'utf-8').toString('base64');
        return `=?UTF-8?B?${encoded}?=`;
      }
      return subject;
    };
    
    // Preparar el contenido HTML/texto con codificación UTF-8 correcta
    const contenido = html || texto.replace(/\n/g, '<br>');
    
    // Construir el email completo con codificación UTF-8
    // Gmail API requiere que el email completo esté en base64, pero el contenido debe estar en UTF-8
    const email = [
      `To: ${destinatario}`,
      `From: ${remitente === 'me' ? env.EMAIL_FROM || 'me' : remitente}`,
      `Subject: ${encodeSubject(asunto)}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/html; charset=UTF-8`,
      `Content-Transfer-Encoding: 8bit`,
      '',
      contenido
    ].join('\n');

    // Codificar todo el email en base64 (Gmail API requiere esto)
    const encodedEmail = Buffer.from(email, 'utf-8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const response = await gmail.users.messages.send({
      userId: remitente,
      requestBody: { raw: encodedEmail }
    });

    console.log(`✅ [Gmail] Email enviado a ${destinatario} (ID: ${response.data.id})`);
    return { success: true, messageId: response.data.id, threadId: response.data.threadId };
  } catch (error) {
    console.error('❌ [Gmail] Error enviando email:', error);
    throw error;
  }
}

/**
 * Lista emails de la bandeja de entrada
 */
export async function listarEmailsGmail(env, userId = 'me', maxResults = 10, query = null) {
  try {
    const gmail = obtenerClienteGmail(env);
    const params = { userId, maxResults };
    if (query) params.q = query;
    const response = await gmail.users.messages.list(params);
    return response.data.messages || [];
  } catch (error) {
    console.error('❌ [Gmail] Error listando emails:', error);
    throw error;
  }
}

/**
 * Obtiene un email completo por su ID
 */
export async function obtenerEmailGmail(env, messageId, userId = 'me') {
  try {
    const gmail = obtenerClienteGmail(env);
    const response = await gmail.users.messages.get({
      userId,
      id: messageId,
      format: 'full'
    });
    return response.data;
  } catch (error) {
    console.error('❌ [Gmail] Error obteniendo email:', error);
    throw error;
  }
}

// ============================================
// DRIVE API
// ============================================

/**
 * Lista archivos en Google Drive
 */
export async function listarArchivosDrive(env, query = null, maxResults = 100) {
  try {
    const drive = obtenerClienteDrive(env);
    const params = { pageSize: maxResults };
    if (query) params.q = query;
    const response = await drive.files.list(params);
    return response.data.files || [];
  } catch (error) {
    console.error('❌ [Drive] Error listando archivos:', error);
    throw error;
  }
}

/**
 * Obtiene un archivo de Drive por ID
 */
export async function obtenerArchivoDrive(env, fileId) {
  try {
    const drive = obtenerClienteDrive(env);
    const response = await drive.files.get({ fileId });
    return response.data;
  } catch (error) {
    console.error('❌ [Drive] Error obteniendo archivo:', error);
    throw error;
  }
}

/**
 * Crea un archivo en Drive
 */
export async function crearArchivoDrive(env, nombre, contenido, mimeType = 'text/plain') {
  try {
    const drive = obtenerClienteDrive(env);
    const fileMetadata = { name: nombre };
    const media = { mimeType, body: contenido };
    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media
    });
    console.log(`✅ [Drive] Archivo creado: ${nombre} (ID: ${response.data.id})`);
    return response.data;
  } catch (error) {
    console.error('❌ [Drive] Error creando archivo:', error);
    throw error;
  }
}

/**
 * Descarga un archivo de Drive por ID
 */
export async function descargarArchivoDrive(env, fileId, rutaDestino = null) {
  try {
    const drive = obtenerClienteDrive(env);
    
    // Obtener información del archivo
    const fileInfo = await drive.files.get({ fileId });
    const nombreArchivo = fileInfo.data.name;
    
    // Descargar el archivo
    const response = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'stream' }
    );
    
    // Si se especifica ruta destino, guardar el archivo
    if (rutaDestino) {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      // Asegurar que el directorio existe
      const dir = path.dirname(rutaDestino);
      await fs.mkdir(dir, { recursive: true });
      
      // Guardar el archivo
      const writeStream = (await import('fs')).createWriteStream(rutaDestino);
      response.data.pipe(writeStream);
      
      await new Promise((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });
      
      console.log(`✅ [Drive] Archivo descargado: ${nombreArchivo} → ${rutaDestino}`);
      return { success: true, nombreArchivo, rutaDestino };
    }
    
    // Retornar el stream si no se especifica destino
    return { success: true, nombreArchivo, stream: response.data };
  } catch (error) {
    console.error('❌ [Drive] Error descargando archivo:', error);
    throw error;
  }
}

/**
 * Busca una carpeta por nombre en Google Drive
 */
export async function buscarCarpetaDrive(env, nombreCarpeta, parentId = null) {
  try {
    const drive = obtenerClienteDrive(env);
    
    let query = `name='${nombreCarpeta}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    
    if (parentId) {
      query += ` and '${parentId}' in parents`;
    }
    
    const response = await drive.files.list({
      q: query,
      fields: 'files(id, name, parents)',
      pageSize: 10
    });
    
    if (response.data.files && response.data.files.length > 0) {
      return response.data.files[0]; // Retorna la primera carpeta encontrada
    }
    
    return null;
  } catch (error) {
    console.error('❌ [Drive] Error buscando carpeta:', error);
    throw error;
  }
}

/**
 * Crea una carpeta en Google Drive
 */
export async function crearCarpetaDrive(env, nombreCarpeta, parentId = null) {
  try {
    const drive = obtenerClienteDrive(env);
    
    const fileMetadata = {
      name: nombreCarpeta,
      mimeType: 'application/vnd.google-apps.folder'
    };
    
    if (parentId) {
      fileMetadata.parents = [parentId];
    }
    
    const response = await drive.files.create({
      requestBody: fileMetadata
    });
    
    console.log(`✅ [Drive] Carpeta creada: ${nombreCarpeta} (ID: ${response.data.id})`);
    return response.data;
  } catch (error) {
    console.error('❌ [Drive] Error creando carpeta:', error);
    throw error;
  }
}

/**
 * Lista archivos en una carpeta específica de Drive
 */
export async function listarArchivosEnCarpeta(env, folderId, maxResults = 100) {
  try {
    const drive = obtenerClienteDrive(env);
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      pageSize: maxResults,
      fields: 'files(id, name, mimeType, size, createdTime, modifiedTime)',
      orderBy: 'modifiedTime desc'
    });
    return response.data.files || [];
  } catch (error) {
    console.error('❌ [Drive] Error listando archivos en carpeta:', error);
    throw error;
  }
}

/**
 * Sube un archivo local a Google Drive
 */
export async function subirArchivoDrive(env, rutaLocal, nombreArchivo, carpetaId = null) {
  try {
    const drive = obtenerClienteDrive(env);
    const fs = await import('fs');
    
    const fileMetadata = {
      name: nombreArchivo
    };
    
    if (carpetaId) {
      fileMetadata.parents = [carpetaId];
    }
    
    // Crear un stream del archivo en lugar de leerlo todo en memoria
    const media = {
      mimeType: 'text/plain',
      body: fs.createReadStream(rutaLocal)
    };
    
    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media
    });
    
    console.log(`✅ [Drive] Archivo subido: ${nombreArchivo} (ID: ${response.data.id})`);
    return {
      success: true,
      archivoId: response.data.id,
      archivo: response.data
    };
  } catch (error) {
    console.error('❌ [Drive] Error subiendo archivo:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Mueve un archivo a otra carpeta en Google Drive
 * IMPORTANTE: Elimina el archivo de todas las carpetas anteriores y lo coloca solo en la nueva
 */
export async function moverArchivoDrive(env, fileId, nuevaCarpetaId) {
  try {
    const drive = obtenerClienteDrive(env);
    
    // Obtener archivo actual para saber sus padres y nombre
    const archivo = await drive.files.get({
      fileId: fileId,
      fields: 'id, name, parents'
    });
    
    const padresAnteriores = archivo.data.parents || [];
    const nombreArchivo = archivo.data.name || fileId;
    
    console.log(`📦 [Drive] Moviendo archivo: ${nombreArchivo}`);
    console.log(`   ID: ${fileId}`);
    console.log(`   Carpetas anteriores: ${padresAnteriores.length}`);
    console.log(`   Nueva carpeta: ${nuevaCarpetaId}`);
    
    // Si no hay padres anteriores, solo agregar a la nueva carpeta
    if (padresAnteriores.length === 0) {
      await drive.files.update({
        fileId: fileId,
        addParents: nuevaCarpetaId,
        fields: 'id, parents'
      });
      console.log(`✅ [Drive] Archivo agregado a carpeta: ${nombreArchivo} → ${nuevaCarpetaId}`);
    } else {
      // Mover archivo: agregar a nueva carpeta y eliminar de todas las anteriores
      await drive.files.update({
        fileId: fileId,
        addParents: nuevaCarpetaId,
        removeParents: padresAnteriores.join(','),
        fields: 'id, parents'
      });
      console.log(`✅ [Drive] Archivo movido: ${nombreArchivo} → carpeta ${nuevaCarpetaId}`);
      console.log(`   Eliminado de ${padresAnteriores.length} carpeta(s) anterior(es)`);
    }
    
    // Verificar que el movimiento fue exitoso
    const archivoVerificado = await drive.files.get({
      fileId: fileId,
      fields: 'id, name, parents'
    });
    
    const padresActuales = archivoVerificado.data.parents || [];
    const estaEnNuevaCarpeta = padresActuales.includes(nuevaCarpetaId);
    const yaNoEstaEnAnteriores = padresAnteriores.every(p => !padresActuales.includes(p));
    
    if (estaEnNuevaCarpeta && yaNoEstaEnAnteriores) {
      console.log(`✅ [Drive] Verificación exitosa: archivo está en la carpeta correcta`);
      return {
        success: true,
        archivoId: fileId,
        nombreArchivo: nombreArchivo,
        carpetaAnterior: padresAnteriores[0] || null,
        carpetaNueva: nuevaCarpetaId
      };
    } else {
      console.warn(`⚠️ [Drive] El archivo puede estar en múltiples carpetas. Verificar manualmente.`);
      return {
        success: true,
        warning: 'Archivo puede estar en múltiples carpetas',
        archivoId: fileId,
        nombreArchivo: nombreArchivo,
        carpetaAnterior: padresAnteriores[0] || null,
        carpetaNueva: nuevaCarpetaId
      };
    }
  } catch (error) {
    console.error('❌ [Drive] Error moviendo archivo:', error);
    console.error(`   File ID: ${fileId}`);
    console.error(`   Nueva carpeta: ${nuevaCarpetaId}`);
    console.error(`   Error completo:`, error.message);
    return {
      success: false,
      error: error.message,
      fileId: fileId
    };
  }
}

// ============================================
// CALENDAR API
// ============================================

/**
 * Lista eventos del calendario
 */
export async function listarEventosCalendar(env, calendarId = 'primary', maxResults = 10) {
  try {
    const calendar = obtenerClienteCalendar(env);
    const response = await calendar.events.list({
      calendarId,
      maxResults,
      timeMin: new Date().toISOString()
    });
    return response.data.items || [];
  } catch (error) {
    console.error('❌ [Calendar] Error listando eventos:', error);
    throw error;
  }
}

/**
 * Crea un evento en el calendario
 */
export async function crearEventoCalendar(env, resumen, descripcion, inicio, fin, calendarId = 'primary') {
  try {
    const calendar = obtenerClienteCalendar(env);
    const evento = {
      summary: resumen,
      description: descripcion,
      start: { dateTime: inicio, timeZone: 'Europe/Madrid' },
      end: { dateTime: fin, timeZone: 'Europe/Madrid' }
    };
    const response = await calendar.events.insert({
      calendarId,
      requestBody: evento
    });
    console.log(`✅ [Calendar] Evento creado: ${resumen} (ID: ${response.data.id})`);
    return response.data;
  } catch (error) {
    console.error('❌ [Calendar] Error creando evento:', error);
    throw error;
  }
}

// ============================================
// SHEETS API
// ============================================

/**
 * Lee datos de una hoja de cálculo
 */
export async function leerDatosSheets(env, spreadsheetId, rango) {
  try {
    const sheets = obtenerClienteSheets(env);
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: rango
    });
    return response.data.values || [];
  } catch (error) {
    console.error('❌ [Sheets] Error leyendo datos:', error);
    throw error;
  }
}

/**
 * Escribe datos en una hoja de cálculo
 */
export async function escribirDatosSheets(env, spreadsheetId, rango, valores) {
  try {
    const sheets = obtenerClienteSheets(env);
    const response = await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: rango,
      valueInputOption: 'RAW',
      requestBody: { values: valores }
    });
    console.log(`✅ [Sheets] Datos escritos en ${rango}`);
    return response.data;
  } catch (error) {
    console.error('❌ [Sheets] Error escribiendo datos:', error);
    throw error;
  }
}

// ============================================
// DOCS API
// ============================================

/**
 * Obtiene un documento de Google Docs
 */
export async function obtenerDocumentoDocs(env, documentId) {
  try {
    const docs = obtenerClienteDocs(env);
    const response = await docs.documents.get({ documentId });
    return response.data;
  } catch (error) {
    console.error('❌ [Docs] Error obteniendo documento:', error);
    throw error;
  }
}

/**
 * Crea un nuevo documento de Google Docs
 */
export async function crearDocumentoDocs(env, titulo) {
  try {
    const docs = obtenerClienteDocs(env);
    const response = await docs.documents.create({
      requestBody: { title: titulo }
    });
    console.log(`✅ [Docs] Documento creado: ${titulo} (ID: ${response.data.documentId})`);
    return response.data;
  } catch (error) {
    console.error('❌ [Docs] Error creando documento:', error);
    throw error;
  }
}

// ============================================
// ADMIN SDK - USUARIOS
// ============================================

/**
 * Lista usuarios de Google Workspace
 */
export async function listarUsuariosAdmin(env, dominio = null, maxResults = 100) {
  try {
    const admin = obtenerClienteAdmin(env);
    const params = { maxResults };
    if (dominio) params.domain = dominio;
    const response = await admin.users.list(params);
    return response.data.users || [];
  } catch (error) {
    console.error('❌ [Admin] Error listando usuarios:', error);
    throw error;
  }
}

/**
 * Obtiene un usuario por email
 */
export async function obtenerUsuarioAdmin(env, emailUsuario) {
  try {
    const admin = obtenerClienteAdmin(env);
    const response = await admin.users.get({ userKey: emailUsuario });
    return response.data;
  } catch (error) {
    console.error('❌ [Admin] Error obteniendo usuario:', error);
    throw error;
  }
}

/**
 * Crea un nuevo usuario en Google Workspace
 */
export async function crearUsuarioAdmin(env, emailUsuario, nombre, apellido, password) {
  try {
    const admin = obtenerClienteAdmin(env);
    const usuario = {
      primaryEmail: emailUsuario,
      name: { givenName: nombre, familyName: apellido },
      password: password
    };
    const response = await admin.users.insert({ requestBody: usuario });
    console.log(`✅ [Admin] Usuario creado: ${emailUsuario}`);
    return response.data;
  } catch (error) {
    console.error('❌ [Admin] Error creando usuario:', error);
    throw error;
  }
}

// ============================================
// ADMIN SDK - GRUPOS
// ============================================

/**
 * Lista grupos de Google Workspace
 */
export async function listarGruposAdmin(env, dominio = null, maxResults = 100) {
  try {
    const admin = obtenerClienteGroups(env);
    const params = { maxResults };
    if (dominio) params.domain = dominio;
    const response = await admin.groups.list(params);
    return response.data.groups || [];
  } catch (error) {
    console.error('❌ [Groups] Error listando grupos:', error);
    throw error;
  }
}

/**
 * Obtiene un grupo por email
 */
export async function obtenerGrupoAdmin(env, emailGrupo) {
  try {
    const admin = obtenerClienteGroups(env);
    const response = await admin.groups.get({ groupKey: emailGrupo });
    return response.data;
  } catch (error) {
    console.error('❌ [Groups] Error obteniendo grupo:', error);
    throw error;
  }
}

/**
 * Lista miembros de un grupo
 */
export async function listarMiembrosGrupo(env, emailGrupo) {
  try {
    const admin = obtenerClienteGroups(env);
    const response = await admin.members.list({ groupKey: emailGrupo });
    return response.data.members || [];
  } catch (error) {
    console.error('❌ [Groups] Error listando miembros:', error);
    throw error;
  }
}

/**
 * Agrega un miembro a un grupo
 */
export async function agregarMiembroGrupo(env, emailGrupo, emailMiembro, rol = 'MEMBER') {
  try {
    const admin = obtenerClienteGroups(env);
    const response = await admin.members.insert({
      groupKey: emailGrupo,
      requestBody: { email: emailMiembro, role: rol }
    });
    console.log(`✅ [Groups] Miembro agregado: ${emailMiembro} a ${emailGrupo}`);
    return response.data;
  } catch (error) {
    console.error('❌ [Groups] Error agregando miembro:', error);
    throw error;
  }
}

// ============================================
// UTILIDADES
// ============================================

/**
 * Obtiene URL de autorización OAuth (solo para OAuth2, no Service Account)
 */
export function obtenerUrlAutorizacion(env) {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new Error('GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET son requeridos para OAuth');
  }

  const oauth2Client = new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/oauth/callback'
  );

  const scopes = [
    'https://www.googleapis.com/auth/gmail',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/documents',
    'https://www.googleapis.com/auth/admin.directory.user',
    'https://www.googleapis.com/auth/admin.directory.group'
  ];

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent'
  });
}

/**
 * Intercambia código de autorización por tokens (solo para OAuth2)
 */
export async function intercambiarCodigoPorTokens(env, code) {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new Error('GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET son requeridos para OAuth');
  }

  const oauth2Client = new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/oauth/callback'
  );

  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

/**
 * Verifica la conexión con Google Workspace
 */
export async function verificarConexionGoogle(env) {
  try {
    const auth = obtenerClienteAuth(env);
    
    // Intentar obtener información básica usando Gmail API
    const gmail = obtenerClienteGmail(env);
    const response = await gmail.users.getProfile({ userId: 'me' });
    
    return {
      success: true,
      email: response.data.emailAddress,
      messagesTotal: response.data.messagesTotal,
      threadsTotal: response.data.threadsTotal
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Resetea todos los clientes (útil para reiniciar conexiones)
 */
export function resetearClientes() {
  oauth2Client = null;
  serviceAccountClient = null;
  Object.keys(apiClients).forEach(key => {
    apiClients[key] = null;
  });
  console.log('🔄 Clientes de Google Workspace reseteados');
}

