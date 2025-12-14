// src/services/zoom-api.js
// Servicio para gestionar la API de Zoom Workplace

import fetch from 'node-fetch';

const ZOOM_API_BASE = 'https://api.zoom.us/v2';
const ZOOM_TOKEN_URL = 'https://zoom.us/oauth/token';

// Cache para el access token
let accessTokenCache = {
  token: null,
  expiresAt: null
};

/**
 * Obtener access token usando Server-to-Server OAuth
 */
async function obtenerAccessToken() {
  const accountId = process.env.ZOOM_ACCOUNT_ID;
  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;

  if (!accountId || !clientId || !clientSecret) {
    throw new Error('ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID y ZOOM_CLIENT_SECRET deben estar configurados');
  }

  // Verificar si tenemos un token válido en cache
  if (accessTokenCache.token && accessTokenCache.expiresAt && Date.now() < accessTokenCache.expiresAt) {
    return accessTokenCache.token;
  }

  try {
    // Generar el Basic Auth header
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const response = await fetch(`${ZOOM_TOKEN_URL}?grant_type=account_credentials&account_id=${accountId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error obteniendo access token: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    // Cachear el token (expira 1 hora antes de lo real para estar seguros)
    accessTokenCache.token = data.access_token;
    accessTokenCache.expiresAt = Date.now() + ((data.expires_in - 3600) * 1000);

    return data.access_token;
  } catch (error) {
    console.error('Error obteniendo access token de Zoom:', error);
    throw error;
  }
}

/**
 * Realizar petición autenticada a la API de Zoom
 */
async function requestZoomAPI(endpoint, options = {}) {
  try {
    const accessToken = await obtenerAccessToken();
    const url = endpoint.startsWith('http') ? endpoint : `${ZOOM_API_BASE}${endpoint}`;

    const defaultHeaders = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    };

    const response = await fetch(url, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers
      }
    });

    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }

    if (!response.ok) {
      throw new Error(`Error en API de Zoom: ${response.status} - ${data.message || data.error || text}`);
    }

    return {
      success: true,
      data: data
    };
  } catch (error) {
    console.error(`Error en petición a Zoom API (${endpoint}):`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

// ============================================================================
// USUARIOS
// ============================================================================

/**
 * Listar todos los usuarios
 */
export async function listarUsuarios(status = 'active', pageSize = 30, roleId = null) {
  let endpoint = `/users?status=${status}&page_size=${pageSize}`;
  if (roleId) {
    endpoint += `&role_id=${roleId}`;
  }
  return await requestZoomAPI(endpoint);
}

/**
 * Obtener información de un usuario específico
 */
export async function obtenerUsuario(userId) {
  return await requestZoomAPI(`/users/${userId}`);
}

/**
 * Crear un nuevo usuario
 */
export async function crearUsuario(email, firstName, lastName, type = 1, password = null) {
  const body = {
    action: 'create',
    user_info: {
      email,
      first_name: firstName,
      last_name: lastName,
      type, // 1 = Basic, 2 = Licensed, 3 = On-prem
      password
    }
  };

  return await requestZoomAPI('/users', {
    method: 'POST',
    body: JSON.stringify(body)
  });
}

/**
 * Actualizar un usuario
 */
export async function actualizarUsuario(userId, updates) {
  return await requestZoomAPI(`/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates)
  });
}

/**
 * Eliminar un usuario
 */
export async function eliminarUsuario(userId, action = 'delete') {
  return await requestZoomAPI(`/users/${userId}?action=${action}`, {
    method: 'DELETE'
  });
}

// ============================================================================
// REUNIONES
// ============================================================================

/**
 * Listar reuniones de un usuario
 */
export async function listarReuniones(userId, type = 'live', pageSize = 30) {
  return await requestZoomAPI(`/users/${userId}/meetings?type=${type}&page_size=${pageSize}`);
}

/**
 * Obtener información de una reunión
 */
export async function obtenerReunion(meetingId) {
  return await requestZoomAPI(`/meetings/${meetingId}`);
}

/**
 * Crear una reunión
 */
export async function crearReunion(userId, meetingData) {
  const defaultData = {
    topic: 'Nueva Reunión',
    type: 2, // Scheduled meeting
    start_time: new Date(Date.now() + 3600000).toISOString(), // 1 hora desde ahora
    duration: 60,
    timezone: 'UTC',
    settings: {
      host_video: true,
      participant_video: true,
      join_before_host: false,
      mute_upon_entry: false,
      watermark: false,
      use_pmi: false
    }
  };

  const body = {
    ...defaultData,
    ...meetingData
  };

  return await requestZoomAPI(`/users/${userId}/meetings`, {
    method: 'POST',
    body: JSON.stringify(body)
  });
}

/**
 * Actualizar una reunión
 */
export async function actualizarReunion(meetingId, updates) {
  return await requestZoomAPI(`/meetings/${meetingId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates)
  });
}

/**
 * Eliminar una reunión
 */
export async function eliminarReunion(meetingId, occurrenceId = null) {
  let endpoint = `/meetings/${meetingId}`;
  if (occurrenceId) {
    endpoint += `?occurrence_id=${occurrenceId}`;
  }
  return await requestZoomAPI(endpoint, {
    method: 'DELETE'
  });
}

/**
 * Obtener participantes de una reunión pasada
 */
export async function obtenerParticipantesReunion(meetingId, occurrenceId = null) {
  let endpoint = `/past_meetings/${meetingId}/participants`;
  if (occurrenceId) {
    endpoint += `?occurrence_id=${occurrenceId}`;
  }
  return await requestZoomAPI(endpoint);
}

/**
 * Obtener estadísticas de una reunión pasada
 */
export async function obtenerEstadisticasReunion(meetingId) {
  return await requestZoomAPI(`/past_meetings/${meetingId}/instances`);
}

// ============================================================================
// WEBINARS
// ============================================================================

/**
 * Listar webinars de un usuario
 */
export async function listarWebinars(userId, pageSize = 30) {
  return await requestZoomAPI(`/users/${userId}/webinars?page_size=${pageSize}`);
}

/**
 * Obtener información de un webinar
 */
export async function obtenerWebinar(webinarId) {
  return await requestZoomAPI(`/webinars/${webinarId}`);
}

/**
 * Crear un webinar
 */
export async function crearWebinar(userId, webinarData) {
  const defaultData = {
    topic: 'Nuevo Webinar',
    type: 5, // Scheduled webinar
    start_time: new Date(Date.now() + 3600000).toISOString(),
    duration: 60,
    timezone: 'UTC',
    settings: {
      host_video: true,
      panelists_video: true,
      practice_session: false,
      on_demand: false
    }
  };

  const body = {
    ...defaultData,
    ...webinarData
  };

  return await requestZoomAPI(`/users/${userId}/webinars`, {
    method: 'POST',
    body: JSON.stringify(body)
  });
}

/**
 * Actualizar un webinar
 */
export async function actualizarWebinar(webinarId, updates) {
  return await requestZoomAPI(`/webinars/${webinarId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates)
  });
}

/**
 * Eliminar un webinar
 */
export async function eliminarWebinar(webinarId, occurrenceId = null) {
  let endpoint = `/webinars/${webinarId}`;
  if (occurrenceId) {
    endpoint += `?occurrence_id=${occurrenceId}`;
  }
  return await requestZoomAPI(endpoint, {
    method: 'DELETE'
  });
}

// ============================================================================
// REPORTES
// ============================================================================

/**
 * Obtener reporte de uso diario
 */
export async function obtenerReporteDiario(year, month) {
  return await requestZoomAPI(`/report/daily?year=${year}&month=${month}`);
}

/**
 * Obtener reporte de usuarios
 */
export async function obtenerReporteUsuarios(startDate, endDate) {
  return await requestZoomAPI(`/report/users?from=${startDate}&to=${endDate}`);
}

/**
 * Obtener reporte de reuniones del usuario
 */
export async function obtenerReporteReunionesUsuario(userId, startDate, endDate) {
  return await requestZoomAPI(`/report/users/${userId}/meetings?from=${startDate}&to=${endDate}`);
}

// ============================================================================
// ROOMS
// ============================================================================

/**
 * Listar todas las Zoom Rooms
 */
export async function listarRooms(pageSize = 30) {
  return await requestZoomAPI(`/rooms?page_size=${pageSize}`);
}

/**
 * Obtener información de una Zoom Room
 */
export async function obtenerRoom(roomId) {
  return await requestZoomAPI(`/rooms/${roomId}`);
}

// ============================================================================
// GRABACIONES
// ============================================================================

/**
 * Listar grabaciones de un usuario
 */
export async function listarGrabaciones(userId, from, to, pageSize = 30) {
  let endpoint = `/users/${userId}/recordings?from=${from}&to=${to}&page_size=${pageSize}`;
  return await requestZoomAPI(endpoint);
}

/**
 * Obtener información de una grabación específica
 */
export async function obtenerGrabacion(meetingId) {
  return await requestZoomAPI(`/meetings/${meetingId}/recordings`);
}

/**
 * Eliminar una grabación
 */
export async function eliminarGrabacion(meetingId, action = 'trash') {
  return await requestZoomAPI(`/meetings/${meetingId}/recordings?action=${action}`, {
    method: 'DELETE'
  });
}

// ============================================================================
// FUNCIONES DE UTILIDAD
// ============================================================================

/**
 * Verificar conexión con Zoom
 */
export async function verificarConexion() {
  try {
    const result = await listarUsuarios('active', 1);
    return {
      success: result.success,
      message: result.success ? 'Conexión exitosa con Zoom API' : result.error,
      error: result.error || null
    };
  } catch (error) {
    return {
      success: false,
      message: 'Error de conexión',
      error: error.message
    };
  }
}

/**
 * Limpiar cache del access token (útil para testing)
 */
export function limpiarCacheToken() {
  accessTokenCache = {
    token: null,
    expiresAt: null
  };
}






