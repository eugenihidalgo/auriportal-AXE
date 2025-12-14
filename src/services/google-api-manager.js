// src/services/google-api-manager.js
// Gestor de APIs de Google Cloud - Permite habilitar y gestionar todas las APIs desde el servidor

import { google } from 'googleapis';

/**
 * Obtiene el cliente de autenticación (reutiliza la lógica de google-workspace)
 */
function obtenerClienteAuth(env) {
  // Reutilizar la lógica de google-workspace.js
  if (env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    try {
      const serviceAccountKey = typeof env.GOOGLE_SERVICE_ACCOUNT_KEY === 'string' 
        ? JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_KEY)
        : env.GOOGLE_SERVICE_ACCOUNT_KEY;

      return new google.auth.JWT(
        serviceAccountKey.client_email,
        null,
        serviceAccountKey.private_key,
        [
          'https://www.googleapis.com/auth/cloud-platform',
          'https://www.googleapis.com/auth/service.management'
        ],
        env.GOOGLE_SERVICE_ACCOUNT_IMPERSONATE || null
      );
    } catch (error) {
      throw new Error(`Error inicializando Service Account: ${error.message}`);
    }
  }

  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    const oauth2Client = new google.auth.OAuth2(
      env.GOOGLE_CLIENT_ID,
      env.GOOGLE_CLIENT_SECRET,
      env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/oauth/callback'
    );

    if (env.GOOGLE_REFRESH_TOKEN) {
      oauth2Client.setCredentials({
        refresh_token: env.GOOGLE_REFRESH_TOKEN
      });
    }

    return oauth2Client;
  }

  throw new Error('Google Workspace no está configurado');
}

/**
 * Obtiene el cliente de Service Usage API para gestionar APIs
 */
function obtenerClienteServiceUsage(env) {
  const auth = obtenerClienteAuth(env);
  return google.serviceusage({ version: 'v1', auth });
}

/**
 * Lista de todas las APIs de Google Workspace que queremos habilitar
 */
export const APIS_GOOGLE_WORKSPACE = [
  // Gmail
  'gmail.googleapis.com',
  
  // Drive
  'drive.googleapis.com',
  'driveactivity.googleapis.com',
  
  // Calendar
  'calendar-json.googleapis.com',
  
  // Sheets
  'sheets.googleapis.com',
  
  // Docs
  'docs.googleapis.com',
  
  // Slides
  'slides.googleapis.com',
  
  // Forms
  'forms.googleapis.com',
  
  // Admin SDK
  'admin.googleapis.com',
  
  // Groups
  'groupssettings.googleapis.com',
  
  // Contacts
  'people.googleapis.com',
  'contacts.googleapis.com',
  
  // Tasks
  'tasks.googleapis.com',
  
  // Keep
  'keep.googleapis.com',
  
  // Cloud Storage (si lo necesitas)
  'storage-component.googleapis.com',
  'storage-api.googleapis.com',
  
  // Cloud Functions (para automatizaciones)
  'cloudfunctions.googleapis.com',
  
  // Pub/Sub (para webhooks)
  'pubsub.googleapis.com',
  
  // Cloud Resource Manager (para gestión de proyectos)
  'cloudresourcemanager.googleapis.com',
  
  // Service Usage (para gestionar APIs)
  'serviceusage.googleapis.com',
  
  // IAM (para gestión de permisos)
  'iam.googleapis.com',
  
  // Cloud Monitoring (para logs y métricas)
  'monitoring.googleapis.com',
  'logging.googleapis.com'
];

/**
 * Obtiene el Project ID desde las credenciales
 */
function obtenerProjectId(env) {
  if (env.GOOGLE_PROJECT_ID) {
    return env.GOOGLE_PROJECT_ID;
  }

  if (env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    try {
      const serviceAccountKey = typeof env.GOOGLE_SERVICE_ACCOUNT_KEY === 'string' 
        ? JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_KEY)
        : env.GOOGLE_SERVICE_ACCOUNT_KEY;
      return serviceAccountKey.project_id;
    } catch (error) {
      console.error('Error obteniendo project_id:', error);
    }
  }

  throw new Error('GOOGLE_PROJECT_ID no está configurado y no se puede obtener desde Service Account');
}

/**
 * Lista todas las APIs habilitadas en el proyecto
 */
export async function listarAPIsHabilitadas(env) {
  try {
    const serviceUsage = obtenerClienteServiceUsage(env);
    const projectId = obtenerProjectId(env);
    const projectName = `projects/${projectId}`;

    const response = await serviceUsage.services.list({
      parent: projectName,
      filter: 'state:ENABLED'
    });

    const apis = (response.data.services || []).map(service => ({
      name: service.name,
      config: service.config,
      state: service.state
    }));

    return {
      success: true,
      projectId,
      total: apis.length,
      apis
    };
  } catch (error) {
    console.error('Error listando APIs habilitadas:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Verifica si una API específica está habilitada
 */
export async function verificarAPIHabilitada(env, apiName) {
  try {
    const serviceUsage = obtenerClienteServiceUsage(env);
    const projectId = obtenerProjectId(env);
    const serviceName = `projects/${projectId}/services/${apiName}`;

    const response = await serviceUsage.services.get({
      name: serviceName
    });

    return {
      success: true,
      enabled: response.data.state === 'ENABLED',
      api: response.data.config?.title || apiName,
      state: response.data.state
    };
  } catch (error) {
    if (error.code === 404) {
      return {
        success: true,
        enabled: false,
        api: apiName,
        state: 'NOT_FOUND'
      };
    }
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Habilita una API específica
 */
export async function habilitarAPI(env, apiName) {
  try {
    const serviceUsage = obtenerClienteServiceUsage(env);
    const projectId = obtenerProjectId(env);
    const serviceName = `projects/${projectId}/services/${apiName}`;

    // Verificar si ya está habilitada
    const verificacion = await verificarAPIHabilitada(env, apiName);
    if (verificacion.enabled) {
      return {
        success: true,
        alreadyEnabled: true,
        message: `La API ${apiName} ya está habilitada`,
        api: apiName
      };
    }

    // Habilitar la API
    const response = await serviceUsage.services.enable({
      name: serviceName
    });

    // Esperar a que se complete la operación
    let operation = response.data;
    if (operation.name) {
      // La operación es asíncrona, esperar a que complete
      const operations = google.serviceusage({ version: 'v1', auth: obtenerClienteAuth(env) });
      let attempts = 0;
      const maxAttempts = 30; // 30 segundos máximo

      while (attempts < maxAttempts && operation.done !== true) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const opResponse = await operations.operations.get({ name: operation.name });
        operation = opResponse.data;
        attempts++;
      }
    }

    return {
      success: true,
      enabled: true,
      message: `API ${apiName} habilitada exitosamente`,
      api: apiName
    };
  } catch (error) {
    console.error(`Error habilitando API ${apiName}:`, error);
    return {
      success: false,
      error: error.message,
      api: apiName
    };
  }
}

/**
 * Habilita múltiples APIs a la vez
 */
export async function habilitarMultiplesAPIs(env, apiNames) {
  const resultados = [];
  
  for (const apiName of apiNames) {
    console.log(`🔄 Habilitando ${apiName}...`);
    const resultado = await habilitarAPI(env, apiName);
    resultados.push(resultado);
    
    // Pequeña pausa entre APIs para evitar rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  const exitosas = resultados.filter(r => r.success && r.enabled);
  const fallidas = resultados.filter(r => !r.success);
  const yaHabilitadas = resultados.filter(r => r.success && r.alreadyEnabled);

  return {
    success: fallidas.length === 0,
    total: apiNames.length,
    exitosas: exitosas.length,
    fallidas: fallidas.length,
    yaHabilitadas: yaHabilitadas.length,
    resultados
  };
}

/**
 * Habilita TODAS las APIs de Google Workspace recomendadas
 */
export async function habilitarTodasLasAPIs(env) {
  console.log(`🚀 Habilitando ${APIS_GOOGLE_WORKSPACE.length} APIs de Google Workspace...`);
  return await habilitarMultiplesAPIs(env, APIS_GOOGLE_WORKSPACE);
}

/**
 * Obtiene información del proyecto
 */
export async function obtenerInfoProyecto(env) {
  try {
    const auth = obtenerClienteAuth(env);
    const projectId = obtenerProjectId(env);
    
    // Intentar obtener información del proyecto
    const resourceManager = google.cloudresourcemanager({ version: 'v1', auth });
    
    try {
      const response = await resourceManager.projects.get({
        projectId: projectId
      });
      
      return {
        success: true,
        projectId: response.data.projectId,
        name: response.data.name,
        projectNumber: response.data.projectNumber,
        lifecycleState: response.data.lifecycleState
      };
    } catch (error) {
      // Si no tiene permisos para obtener detalles, devolver solo el ID
      return {
        success: true,
        projectId: projectId,
        note: 'Permisos limitados - solo se puede acceder al project ID'
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Verifica el estado de todas las APIs recomendadas
 */
export async function verificarEstadoTodasLasAPIs(env) {
  const estados = [];
  
  for (const apiName of APIS_GOOGLE_WORKSPACE) {
    const estado = await verificarAPIHabilitada(env, apiName);
    estados.push({
      api: apiName,
      enabled: estado.enabled,
      state: estado.state
    });
    
    // Pequeña pausa para evitar rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  const habilitadas = estados.filter(e => e.enabled);
  const deshabilitadas = estados.filter(e => !e.enabled);

  return {
    total: APIS_GOOGLE_WORKSPACE.length,
    habilitadas: habilitadas.length,
    deshabilitadas: deshabilitadas.length,
    estados
  };
}

