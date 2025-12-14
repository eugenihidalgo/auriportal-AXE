// src/endpoints/oauth-apps-script.js
// Endpoint específico para OAuth callback de Google Apps Script API

import { google } from 'googleapis';

// Credenciales específicas de Apps Script
const APPS_SCRIPT_CLIENT_ID = '79274918274-hnn9dup01e6h48dickoi1shf7n4t5dlq.apps.googleusercontent.com';
const APPS_SCRIPT_CLIENT_SECRET = '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';

/**
 * Handler para el callback de OAuth de Google Apps Script API
 */
export default async function oauthAppsScriptHandler(request, env, ctx) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  const scope = url.searchParams.get('scope');

  if (error) {
    const errorHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Error de Autorización</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 600px;
      margin: 50px auto;
      padding: 20px;
      background: #f5f5f5;
    }
    .container {
      background: white;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    h1 { color: #ea4335; }
  </style>
</head>
<body>
  <div class="container">
    <h1>❌ Error de Autorización</h1>
    <p>Error: ${error}</p>
    <p><a href="/">← Volver al inicio</a></p>
  </div>
</body>
</html>
    `;
    
    return new Response(errorHtml, {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }

  if (!code) {
    return new Response('Código de autorización no proporcionado', {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }

  try {
    // Crear cliente OAuth2 para Apps Script
    // Usar la URL completa de donde viene (puede ser /oauth/callback o /oauth/apps-script)
    const redirectUri = url.origin + (url.pathname.includes('/apps-script') ? url.pathname : '/oauth/callback');
    
    const oauth2Client = new google.auth.OAuth2(
      APPS_SCRIPT_CLIENT_ID,
      APPS_SCRIPT_CLIENT_SECRET,
      redirectUri
    );
    
    // Intercambiar código por tokens
    const { tokens } = await oauth2Client.getToken(code);
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Autorización Apps Script Exitosa</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 700px;
      margin: 50px auto;
      padding: 20px;
      background: #f5f5f5;
    }
    .container {
      background: white;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    h1 {
      color: #34a853;
    }
    .token {
      background: #f8f9fa;
      padding: 15px;
      border-radius: 4px;
      font-family: monospace;
      word-break: break-all;
      margin: 10px 0;
      border: 1px solid #dee2e6;
    }
    .warning {
      background: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 15px;
      margin: 20px 0;
    }
    .success {
      background: #d4edda;
      border-left: 4px solid #28a745;
      padding: 15px;
      margin: 20px 0;
    }
    code {
      background: #f8f9fa;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: monospace;
    }
    .button {
      display: inline-block;
      background: #4285f4;
      color: white;
      padding: 10px 20px;
      border-radius: 4px;
      text-decoration: none;
      margin: 10px 5px 10px 0;
    }
    .button:hover {
      background: #357ae8;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>✅ Autorización Apps Script Exitosa</h1>
    <p>Has autorizado correctamente el acceso a Google Apps Script API.</p>
    
    <div class="success">
      <strong>✅ Tokens obtenidos exitosamente</strong>
    </div>
    
    <h2>Refresh Token (IMPORTANTE):</h2>
    <div class="token">${tokens.refresh_token || 'No disponible (puede que ya tengas uno activo)'}</div>
    
    ${tokens.refresh_token ? `
    <div class="warning">
      <strong>⚠️ Importante:</strong> Guarda este <strong>refresh_token</strong> en tu archivo <code>.env</code>:
      <br><br>
      <code>GOOGLE_APPS_SCRIPT_REFRESH_TOKEN=${tokens.refresh_token}</code>
      <br><br>
      <strong>Luego ejecuta:</strong>
      <br>
      <code>cd /var/www/aurelinportal/google-worker && node subir-archivos.js</code>
    </div>
    ` : `
    <div class="warning">
      <strong>⚠️ Nota:</strong> No se obtuvo un nuevo refresh_token. Esto puede pasar si ya autorizaste antes.
      Si necesitas uno nuevo, revoca los permisos y autoriza de nuevo.
    </div>
    `}
    
    ${tokens.access_token ? `
    <details>
      <summary><strong>Access Token (temporal, expira en 1 hora)</strong></summary>
      <div class="token" style="margin-top: 10px;">${tokens.access_token.substring(0, 50)}...</div>
    </details>
    ` : ''}
    
    <h2>Próximos pasos:</h2>
    <ol>
      <li>Añade el refresh_token a tu archivo <code>.env</code></li>
      <li>Ejecuta: <code>cd /var/www/aurelinportal/google-worker && node subir-archivos.js</code></li>
      <li>Los archivos .gs se subirán automáticamente a Google Apps Script</li>
    </ol>
    
    <p><a href="/" class="button">← Volver al inicio</a></p>
  </div>
</body>
</html>
    `;

    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });

  } catch (error) {
    console.error('❌ Error en callback de OAuth Apps Script:', error);
    
    const errorHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Error de Autorización</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 600px;
      margin: 50px auto;
      padding: 20px;
      background: #f5f5f5;
    }
    .container {
      background: white;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    h1 { color: #ea4335; }
    .error-details {
      background: #f8f9fa;
      padding: 15px;
      border-radius: 4px;
      margin: 10px 0;
      font-family: monospace;
      font-size: 0.9em;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>❌ Error de Autorización</h1>
    <p>Hubo un error al autorizar el acceso a Google Apps Script API:</p>
    <div class="error-details">${error.message}</div>
    <p><a href="/">← Volver al inicio</a></p>
  </div>
</body>
</html>
    `;

    return new Response(errorHtml, {
      status: 500,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
}

