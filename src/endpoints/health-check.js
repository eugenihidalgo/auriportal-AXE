// src/endpoints/health-check.js
// Endpoint para verificar el estado de configuración y conectividad de APIs

import { validateEnvironmentVariables, testAPIConnections } from "../config/validate.js";
import { renderHtml } from '../core/html-response.js';

export default async function healthCheckHandler(request, env, ctx) {
  // Solo permitir GET
  if (request.method !== "GET") {
    return new Response(
      `Método no permitido. Este endpoint solo acepta GET. Método recibido: ${request.method}`,
      { 
        status: 405,
        headers: { "Content-Type": "text/plain" }
      }
    );
  }

  try {
    // Validar variables de entorno
    const validation = validateEnvironmentVariables(env);
    
    // Probar conexiones con APIs (solo si se solicita con ?test=true)
    const url = new URL(request.url, `http://${request.headers.get('host') || 'localhost'}`);
    const testConnections = url.searchParams.get('test') === 'true';
    
    let apiTests = null;
    if (testConnections) {
      apiTests = await testAPIConnections(env);
    }

    // Generar respuesta HTML
    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Estado de Configuración - AuriPortal</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
      color: #333;
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
      font-size: 2em;
      margin-bottom: 10px;
    }
    .content {
      padding: 30px;
    }
    .section {
      margin-bottom: 30px;
      padding: 20px;
      background: #f8f9fa;
      border-radius: 8px;
      border-left: 4px solid #667eea;
    }
    .section h2 {
      color: #667eea;
      margin-bottom: 15px;
      font-size: 1.5em;
    }
    .status-badge {
      display: inline-block;
      padding: 5px 15px;
      border-radius: 20px;
      font-weight: bold;
      font-size: 0.9em;
      margin-left: 10px;
    }
    .status-ok { background: #28a745; color: white; }
    .status-error { background: #dc3545; color: white; }
    .status-warning { background: #ffc107; color: #333; }
    .status-unknown { background: #6c757d; color: white; }
    .status-not-configured { background: #6c757d; color: white; }
    .config-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px;
      margin: 5px 0;
      background: white;
      border-radius: 5px;
      border: 1px solid #dee2e6;
    }
    .config-item label {
      font-weight: 600;
      color: #495057;
    }
    .config-item value {
      font-family: monospace;
      color: #6c757d;
    }
    .error-list, .warning-list {
      list-style: none;
      padding: 0;
    }
    .error-list li {
      padding: 10px;
      margin: 5px 0;
      background: #f8d7da;
      border-left: 4px solid #dc3545;
      border-radius: 4px;
      color: #721c24;
    }
    .warning-list li {
      padding: 10px;
      margin: 5px 0;
      background: #fff3cd;
      border-left: 4px solid #ffc107;
      border-radius: 4px;
      color: #856404;
    }
    .api-test {
      margin: 15px 0;
      padding: 15px;
      background: white;
      border-radius: 5px;
      border: 1px solid #dee2e6;
    }
    .api-test h3 {
      margin-bottom: 10px;
      color: #495057;
    }
    .api-test .message {
      color: #6c757d;
      font-size: 0.9em;
      margin-top: 5px;
    }
    .api-test .error {
      color: #dc3545;
      font-size: 0.85em;
      margin-top: 5px;
      font-family: monospace;
      background: #f8d7da;
      padding: 5px;
      border-radius: 3px;
    }
    .btn {
      display: inline-block;
      padding: 10px 20px;
      background: #667eea;
      color: white;
      text-decoration: none;
      border-radius: 5px;
      margin-top: 10px;
      transition: background 0.3s;
    }
    .btn:hover {
      background: #5568d3;
    }
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin-bottom: 30px;
    }
    .summary-card {
      padding: 20px;
      background: white;
      border-radius: 8px;
      text-align: center;
      border: 2px solid #dee2e6;
    }
    .summary-card h3 {
      font-size: 2em;
      margin-bottom: 10px;
    }
    .summary-card.ok { border-color: #28a745; }
    .summary-card.error { border-color: #dc3545; }
    .summary-card.warning { border-color: #ffc107; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔍 Estado de Configuración</h1>
      <p>AuriPortal v3.1 - Verificación de Tokens y APIs</p>
    </div>
    <div class="content">
      <div class="summary">
        <div class="summary-card ${validation.valid ? 'ok' : 'error'}">
          <h3>${validation.valid ? '✅' : '❌'}</h3>
          <p><strong>Configuración</strong></p>
          <p>${validation.valid ? 'Válida' : 'Con Errores'}</p>
        </div>
        <div class="summary-card ${validation.errors.length === 0 ? 'ok' : 'error'}">
          <h3>${validation.errors.length}</h3>
          <p><strong>Errores</strong></p>
        </div>
        <div class="summary-card ${validation.warnings.length === 0 ? 'ok' : 'warning'}">
          <h3>${validation.warnings.length}</h3>
          <p><strong>Advertencias</strong></p>
        </div>
      </div>

      <div class="section">
        <h2>📋 Variables de Entorno</h2>
        <div class="config-item">
          <label>ClickUp API Token:</label>
          <value>${validation.config.clickup.configured ? validation.config.clickup.token : '❌ No configurado'}</value>
          <span class="status-badge ${validation.config.clickup.configured ? 'status-ok' : 'status-error'}">
            ${validation.config.clickup.configured ? 'Configurado' : 'Falta'}
          </span>
        </div>
        <div class="config-item">
          <label>Kajabi Client ID:</label>
          <value>${validation.config.kajabi.configured ? validation.config.kajabi.clientId : '❌ No configurado'}</value>
          <span class="status-badge ${validation.config.kajabi.configured ? 'status-ok' : 'status-error'}">
            ${validation.config.kajabi.configured ? 'Configurado' : 'Falta'}
          </span>
        </div>
        <div class="config-item">
          <label>Kajabi Client Secret:</label>
          <value>${validation.config.kajabi.configured ? validation.config.kajabi.clientSecret : '❌ No configurado'}</value>
          <span class="status-badge ${validation.config.kajabi.configured ? 'status-ok' : 'status-error'}">
            ${validation.config.kajabi.configured ? 'Configurado' : 'Falta'}
          </span>
        </div>
        <div class="config-item">
          <label>Typeform API Token:</label>
          <value>${validation.config.typeform.configured ? validation.config.typeform.token : '⚠️ No configurado (opcional)'}</value>
          <span class="status-badge ${validation.config.typeform.configured ? 'status-ok' : 'status-warning'}">
            ${validation.config.typeform.configured ? 'Configurado' : 'Opcional'}
          </span>
        </div>
        <div class="config-item">
          <label>Cloudflare:</label>
          <value>${validation.config.cloudflare?.configured ? '✅ Configurado' : '⚠️ No configurado (opcional)'}</value>
          <span class="status-badge ${validation.config.cloudflare?.configured ? 'status-ok' : 'status-warning'}">
            ${validation.config.cloudflare?.configured ? 'Configurado' : 'Opcional'}
          </span>
        </div>
        <div class="config-item">
          <label>Zoom Workplace:</label>
          <value>${validation.config.zoom?.configured ? '✅ Configurado' : '⚠️ No configurado (opcional)'}</value>
          <span class="status-badge ${validation.config.zoom?.configured ? 'status-ok' : 'status-warning'}">
            ${validation.config.zoom?.configured ? 'Configurado' : 'Opcional'}
          </span>
        </div>
        <div class="config-item">
          <label>Cookie Secret:</label>
          <value>${validation.config.cookie.configured ? '✅ Configurado' : '⚠️ Usando valor por defecto'}</value>
          <span class="status-badge ${validation.config.cookie.configured ? 'status-ok' : 'status-warning'}">
            ${validation.config.cookie.configured ? 'Configurado' : 'Advertencia'}
          </span>
        </div>
      </div>

      ${validation.errors.length > 0 ? `
      <div class="section">
        <h2>❌ Errores de Configuración</h2>
        <ul class="error-list">
          ${validation.errors.map(err => `<li>${err}</li>`).join('')}
        </ul>
      </div>
      ` : ''}

      ${validation.warnings.length > 0 ? `
      <div class="section">
        <h2>⚠️ Advertencias</h2>
        <ul class="warning-list">
          ${validation.warnings.map(warn => `<li>${warn}</li>`).join('')}
        </ul>
      </div>
      ` : ''}

      ${testConnections && apiTests ? `
      <div class="section">
        <h2>🔌 Pruebas de Conectividad con APIs</h2>
        
        <div class="api-test">
          <h3>ClickUp <span class="status-badge status-${apiTests.clickup.status}">${apiTests.clickup.status}</span></h3>
          <div class="message">${apiTests.clickup.message}</div>
          ${apiTests.clickup.error ? `<div class="error">${apiTests.clickup.error}</div>` : ''}
        </div>

        <div class="api-test">
          <h3>Kajabi <span class="status-badge status-${apiTests.kajabi.status}">${apiTests.kajabi.status}</span></h3>
          <div class="message">${apiTests.kajabi.message}</div>
          ${apiTests.kajabi.error ? `<div class="error">${apiTests.kajabi.error}</div>` : ''}
        </div>

        <div class="api-test">
          <h3>Typeform <span class="status-badge status-${apiTests.typeform.status}">${apiTests.typeform.status}</span></h3>
          <div class="message">${apiTests.typeform.message}</div>
          ${apiTests.typeform.error ? `<div class="error">${apiTests.typeform.error}</div>` : ''}
        </div>

        <div class="api-test">
          <h3>Cloudflare <span class="status-badge status-${apiTests.cloudflare.status}">${apiTests.cloudflare.status}</span></h3>
          <div class="message">${apiTests.cloudflare.message}</div>
          ${apiTests.cloudflare.error ? `<div class="error">${apiTests.cloudflare.error}</div>` : ''}
        </div>

        <div class="api-test">
          <h3>Zoom Workplace <span class="status-badge status-${apiTests.zoom.status}">${apiTests.zoom.status}</span></h3>
          <div class="message">${apiTests.zoom.message}</div>
          ${apiTests.zoom.error ? `<div class="error">${apiTests.zoom.error}</div>` : ''}
        </div>
      </div>
      ` : `
      <div class="section">
        <h2>🔌 Pruebas de Conectividad</h2>
        <p>Para probar la conectividad con las APIs, agrega <code>?test=true</code> a la URL.</p>
        <a href="?test=true" class="btn">Probar Conexiones</a>
      </div>
      `}
    </div>
  </div>
</body>
</html>
    `;

    // Usar renderHtml centralizado (aplica headers anti-cache automáticamente)
    return renderHtml(html);

  } catch (error) {
    console.error("Error en health check:", error);
    return new Response(JSON.stringify({ 
      error: "Error verificando configuración", 
      details: error.message 
    }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}









