// src/endpoints/oauth-callback.js
// Endpoint para recibir el callback de OAuth de Google

import { intercambiarCodigoPorTokens } from '../services/email-gmail.js';

/**
 * Handler para el callback de OAuth de Google
 * 
 * Este endpoint recibe el código de autorización y lo intercambia por tokens
 */
export default async function oauthCallbackHandler(request, env, ctx) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  const scope = url.searchParams.get('scope');

  if (error) {
    return new Response(`Error de autorización: ${error}`, {
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

  // Detectar si es una llamada de Apps Script API (por el scope)
  if (scope && scope.includes('script.projects')) {
    // Redirigir al handler de Apps Script
    const oauthAppsScriptHandler = (await import('./oauth-apps-script.js')).default;
    return oauthAppsScriptHandler(request, env, ctx);
  }

  try {
    const tokens = await intercambiarCodigoPorTokens(code);
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Autorización Exitosa</title>
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
    }
    .warning {
      background: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 15px;
      margin: 20px 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>✅ Autorización Exitosa</h1>
    <p>Has autorizado correctamente el acceso a Gmail API.</p>
    
    <h2>Tokens Obtenidos:</h2>
    <p><strong>Access Token:</strong></p>
    <div class="token">${tokens.access_token ? tokens.access_token.substring(0, 50) + '...' : 'No disponible'}</div>
    
    <p><strong>Refresh Token:</strong></p>
    <div class="token">${tokens.refresh_token || 'No disponible'}</div>
    
    <div class="warning">
      <strong>⚠️ Importante:</strong> Guarda el <strong>refresh_token</strong> en tu archivo <code>.env</code>:
      <br><br>
      <code>GOOGLE_REFRESH_TOKEN=${tokens.refresh_token || 'TU_REFRESH_TOKEN_AQUI'}</code>
    </div>
    
    <p>El access token expirará en 1 hora. El refresh token es permanente y se usa para obtener nuevos access tokens.</p>
    
    <p><a href="/">← Volver al inicio</a></p>
  </div>
</body>
</html>
    `;

    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });

  } catch (error) {
    console.error('❌ Error en callback de OAuth:', error);
    
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
    h1 {
      color: #ea4335;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>❌ Error de Autorización</h1>
    <p>Hubo un error al autorizar el acceso a Gmail API:</p>
    <p><strong>${error.message}</strong></p>
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



