// src/endpoints/google-api-manager.js
// Endpoint para gestionar y habilitar APIs de Google Workspace desde el servidor

import {
  listarAPIsHabilitadas,
  verificarEstadoTodasLasAPIs,
  habilitarTodasLasAPIs,
  habilitarAPI,
  obtenerInfoProyecto,
  APIS_GOOGLE_WORKSPACE
} from '../services/google-api-manager.js';

/**
 * Handler principal para gestión de APIs de Google
 */
export default async function googleApiManagerHandler(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // Verificar que Google Workspace esté configurado
  if (!env.GOOGLE_SERVICE_ACCOUNT_KEY && !(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET)) {
    return new Response(JSON.stringify({
      error: 'Google Workspace no está configurado',
      message: 'Necesitas configurar GOOGLE_SERVICE_ACCOUNT_KEY o credenciales OAuth2',
      help: 'Consulta QUÉ_INFORMACIÓN_GOOGLE_WORKSPACE.md para más información'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Endpoint: GET /google-apis/info - Información del proyecto
  if (path === '/google-apis/info' && method === 'GET') {
    try {
      const info = await obtenerInfoProyecto(env);
      return new Response(JSON.stringify(info, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({
        error: error.message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // Endpoint: GET /google-apis/list - Listar APIs habilitadas
  if (path === '/google-apis/list' && method === 'GET') {
    try {
      const resultado = await listarAPIsHabilitadas(env);
      return new Response(JSON.stringify(resultado, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({
        error: error.message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // Endpoint: GET /google-apis/status - Estado de todas las APIs recomendadas
  if (path === '/google-apis/status' && method === 'GET') {
    try {
      const estado = await verificarEstadoTodasLasAPIs(env);
      return new Response(JSON.stringify(estado, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({
        error: error.message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // Endpoint: POST /google-apis/enable-all - Habilitar TODAS las APIs recomendadas
  if (path === '/google-apis/enable-all' && method === 'POST') {
    try {
      const resultado = await habilitarTodasLasAPIs(env);
      return new Response(JSON.stringify({
        message: 'Proceso de habilitación completado',
        ...resultado
      }, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({
        error: error.message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // Endpoint: POST /google-apis/enable - Habilitar una API específica
  if (path === '/google-apis/enable' && method === 'POST') {
    try {
      const body = await request.json();
      const { apiName } = body;

      if (!apiName) {
        return new Response(JSON.stringify({
          error: 'apiName es requerido'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const resultado = await habilitarAPI(env, apiName);
      return new Response(JSON.stringify(resultado, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({
        error: error.message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // Endpoint: GET /google-apis/apis-list - Lista de todas las APIs recomendadas
  if (path === '/google-apis/apis-list' && method === 'GET') {
    return new Response(JSON.stringify({
      total: APIS_GOOGLE_WORKSPACE.length,
      apis: APIS_GOOGLE_WORKSPACE.map(api => ({
        name: api,
        description: obtenerDescripcionAPI(api)
      }))
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Panel web HTML (GET /google-apis o /google-apis/)
  if ((path === '/google-apis' || path === '/google-apis/') && method === 'GET') {
    return new Response(generarHTMLPanel(), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }

  // 404 para rutas no encontradas
  return new Response(JSON.stringify({
    error: 'Endpoint no encontrado',
    availableEndpoints: [
      'GET /google-apis - Panel web',
      'GET /google-apis/info - Información del proyecto',
      'GET /google-apis/list - Listar APIs habilitadas',
      'GET /google-apis/status - Estado de todas las APIs',
      'GET /google-apis/apis-list - Lista de APIs recomendadas',
      'POST /google-apis/enable-all - Habilitar todas las APIs',
      'POST /google-apis/enable - Habilitar una API específica'
    ]
  }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Obtiene descripción de una API
 */
function obtenerDescripcionAPI(apiName) {
  const descripciones = {
    'gmail.googleapis.com': 'Gmail API - Enviar y gestionar emails',
    'drive.googleapis.com': 'Google Drive API - Gestionar archivos',
    'calendar.googleapis.com': 'Google Calendar API - Gestionar eventos',
    'sheets.googleapis.com': 'Google Sheets API - Gestionar hojas de cálculo',
    'docs.googleapis.com': 'Google Docs API - Gestionar documentos',
    'admin.googleapis.com': 'Admin SDK - Gestionar usuarios y grupos',
    'people.googleapis.com': 'People API - Gestionar contactos',
    'pubsub.googleapis.com': 'Pub/Sub API - Webhooks y notificaciones',
    'serviceusage.googleapis.com': 'Service Usage API - Gestionar APIs',
    'cloudresourcemanager.googleapis.com': 'Cloud Resource Manager - Gestionar proyectos'
  };

  return descripciones[apiName] || 'API de Google Workspace';
}

/**
 * Genera el HTML del panel de gestión
 */
function generarHTMLPanel() {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Gestión de APIs de Google Workspace - AuriPortal</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      text-align: center;
    }
    .header h1 {
      font-size: 28px;
      margin-bottom: 10px;
    }
    .header p {
      opacity: 0.9;
    }
    .content {
      padding: 30px;
    }
    .section {
      margin-bottom: 30px;
      padding: 20px;
      background: #f8f9fa;
      border-radius: 8px;
    }
    .section h2 {
      color: #333;
      margin-bottom: 15px;
      font-size: 20px;
    }
    .button {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 16px;
      font-weight: 600;
      transition: transform 0.2s, box-shadow 0.2s;
      margin: 5px;
    }
    .button:hover {
      transform: translateY(-2px);
      box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
    }
    .button:active {
      transform: translateY(0);
    }
    .button.secondary {
      background: #6c757d;
    }
    .button.danger {
      background: #dc3545;
    }
    .status {
      padding: 15px;
      border-radius: 6px;
      margin: 10px 0;
    }
    .status.success {
      background: #d4edda;
      color: #155724;
      border: 1px solid #c3e6cb;
    }
    .status.error {
      background: #f8d7da;
      color: #721c24;
      border: 1px solid #f5c6cb;
    }
    .status.info {
      background: #d1ecf1;
      color: #0c5460;
      border: 1px solid #bee5eb;
    }
    .loading {
      display: inline-block;
      width: 20px;
      height: 20px;
      border: 3px solid rgba(255,255,255,.3);
      border-radius: 50%;
      border-top-color: #fff;
      animation: spin 1s ease-in-out infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .api-list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 10px;
      margin-top: 15px;
    }
    .api-item {
      padding: 10px;
      background: white;
      border-radius: 6px;
      border: 1px solid #dee2e6;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .api-item.enabled {
      border-color: #28a745;
      background: #f0fff4;
    }
    .api-item.disabled {
      border-color: #dc3545;
      background: #fff5f5;
    }
    .badge {
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
    }
    .badge.enabled {
      background: #28a745;
      color: white;
    }
    .badge.disabled {
      background: #dc3545;
      color: white;
    }
    pre {
      background: #f8f9fa;
      padding: 15px;
      border-radius: 6px;
      overflow-x: auto;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🚀 Gestión de APIs de Google Workspace</h1>
      <p>Habilita y gestiona todas las APIs desde el servidor</p>
    </div>
    <div class="content">
      <div class="section">
        <h2>📊 Información del Proyecto</h2>
        <button class="button" onclick="cargarInfo()">Cargar Información</button>
        <div id="info"></div>
      </div>

      <div class="section">
        <h2>✅ Estado de las APIs</h2>
        <button class="button" onclick="verificarEstado()">Verificar Estado</button>
        <div id="estado"></div>
      </div>

      <div class="section">
        <h2>🚀 Habilitar APIs</h2>
        <button class="button" onclick="habilitarTodas()">Habilitar TODAS las APIs</button>
        <button class="button secondary" onclick="listarHabilitadas()">Listar APIs Habilitadas</button>
        <div id="resultado"></div>
      </div>
    </div>
  </div>

  <script>
    async function cargarInfo() {
      const infoDiv = document.getElementById('info');
      infoDiv.innerHTML = '<div class="status info">Cargando información...</div>';
      
      try {
        const response = await fetch('/google-apis/info');
        const data = await response.json();
        infoDiv.innerHTML = \`<div class="status success">
          <pre>\${JSON.stringify(data, null, 2)}</pre>
        </div>\`;
      } catch (error) {
        infoDiv.innerHTML = \`<div class="status error">Error: \${error.message}</div>\`;
      }
    }

    async function verificarEstado() {
      const estadoDiv = document.getElementById('estado');
      estadoDiv.innerHTML = '<div class="status info">Verificando estado...</div>';
      
      try {
        const response = await fetch('/google-apis/status');
        const data = await response.json();
        
        let html = \`<div class="status info">
          <strong>Total:</strong> \${data.total} APIs<br>
          <strong>Habilitadas:</strong> \${data.habilitadas}<br>
          <strong>Deshabilitadas:</strong> \${data.deshabilitadas}
        </div>\`;
        
        html += '<div class="api-list">';
        data.estados.forEach(estado => {
          const enabled = estado.enabled;
          html += \`
            <div class="api-item \${enabled ? 'enabled' : 'disabled'}">
              <span>\${estado.api}</span>
              <span class="badge \${enabled ? 'enabled' : 'disabled'}">
                \${enabled ? 'Habilitada' : 'Deshabilitada'}
              </span>
            </div>
          \`;
        });
        html += '</div>';
        
        estadoDiv.innerHTML = html;
      } catch (error) {
        estadoDiv.innerHTML = \`<div class="status error">Error: \${error.message}</div>\`;
      }
    }

    async function habilitarTodas() {
      const resultadoDiv = document.getElementById('resultado');
      resultadoDiv.innerHTML = '<div class="status info">Habilitando todas las APIs... Esto puede tardar varios minutos.</div>';
      
      try {
        const response = await fetch('/google-apis/enable-all', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();
        
        resultadoDiv.innerHTML = \`<div class="status success">
          <pre>\${JSON.stringify(data, null, 2)}</pre>
        </div>\`;
      } catch (error) {
        resultadoDiv.innerHTML = \`<div class="status error">Error: \${error.message}</div>\`;
      }
    }

    async function listarHabilitadas() {
      const resultadoDiv = document.getElementById('resultado');
      resultadoDiv.innerHTML = '<div class="status info">Cargando...</div>';
      
      try {
        const response = await fetch('/google-apis/list');
        const data = await response.json();
        
        resultadoDiv.innerHTML = \`<div class="status success">
          <strong>Total habilitadas:</strong> \${data.total}<br>
          <pre>\${JSON.stringify(data, null, 2)}</pre>
        </div>\`;
      } catch (error) {
        resultadoDiv.innerHTML = \`<div class="status error">Error: \${error.message}</div>\`;
      }
    }

    // Cargar información al iniciar
    window.addEventListener('load', () => {
      cargarInfo();
      verificarEstado();
    });
  </script>
</body>
</html>`;
}



