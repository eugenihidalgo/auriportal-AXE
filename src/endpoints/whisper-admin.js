// src/endpoints/whisper-admin.js
// Portal de administración para transcripciones Whisper

import {
  getControlTranscripciones,
  actualizarControlTranscripciones,
  getHistorialTranscripciones,
  procesarTranscripcionesManual
} from '../services/whisper-transcripciones.js';
import { agregarRegistroDNS } from '../services/cloudflare-dns.js';
import { query } from '../../database/pg.js';

export default async function whisperAdminHandler(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;
  const action = url.searchParams.get('action');
  
  // API endpoints
  if (path.includes('/api/')) {
    return handleAPI(request, env, url);
  }
  
  // Página principal
  return renderAdminPanel(env, url);
}

/**
 * Maneja requests de API
 */
async function handleAPI(request, env, url) {
  const path = url.pathname;
  
  // GET /api/control - Obtener estado del control
  if (path.includes('/api/control')) {
    const control = await getControlTranscripciones();
    return new Response(JSON.stringify(control), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // POST /api/control - Actualizar estado
  if (path.includes('/api/control') && request.method === 'POST') {
    const body = await request.json();
    const resultado = await actualizarControlTranscripciones({ activo: body.activo });
    return new Response(JSON.stringify(resultado), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // GET /api/historial - Obtener historial
  if (path.includes('/api/historial')) {
    const limit = parseInt(url.searchParams.get('limit')) || 50;
    const offset = parseInt(url.searchParams.get('offset')) || 0;
    const historial = await getHistorialTranscripciones(limit, offset);
    return new Response(JSON.stringify(historial), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // POST /api/procesar - Procesar transcripciones manualmente
  if (path.includes('/api/procesar') && request.method === 'POST') {
    const resultado = await procesarTranscripcionesManual(env);
    return new Response(JSON.stringify(resultado), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // POST /api/configurar-dns - Configurar subdominio en Cloudflare
  if (path.includes('/api/configurar-dns') && request.method === 'POST') {
    try {
      // Obtener IP del servidor (puedes configurarla en .env)
      const serverIP = env.SERVER_IP || '88.99.173.249'; // IP por defecto, ajustar si es necesario
      const resultado = await agregarRegistroDNS(
        'eugenihidalgo.work',
        'A',
        'whispertranscripciones',
        serverIP,
        null,
        'auto',
        true // Activar proxy de Cloudflare para SSL automático
      );
      return new Response(JSON.stringify(resultado), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
  
  return new Response(JSON.stringify({ error: 'Endpoint no encontrado' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Renderiza el panel de administración
 */
async function renderAdminPanel(env, url) {
  const control = await getControlTranscripciones();
  const historial = await getHistorialTranscripciones(20, 0);
  
  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Whisper Transcripciones - Panel de Control</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🎤</text></svg>">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: #e0e0e0;
      min-height: 100vh;
      padding: 20px;
      line-height: 1.6;
    }
    
    .container {
      max-width: 1400px;
      margin: 0 auto;
    }
    
    header {
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(10px);
      border-radius: 16px;
      padding: 30px;
      margin-bottom: 30px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    }
    
    h1 {
      font-size: 2.5rem;
      color: #64b5f6;
      margin-bottom: 10px;
      font-weight: 600;
    }
    
    .subtitle {
      color: #b0bec5;
      font-size: 1.1rem;
    }
    
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    
    .stat-card {
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(10px);
      border-radius: 12px;
      padding: 25px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      transition: all 0.3s ease;
    }
    
    .stat-card:hover {
      background: rgba(255, 255, 255, 0.08);
      transform: translateY(-2px);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
    }
    
    .stat-label {
      color: #90a4ae;
      font-size: 0.9rem;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .stat-value {
      color: #64b5f6;
      font-size: 2rem;
      font-weight: 600;
    }
    
    .control-panel {
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(10px);
      border-radius: 16px;
      padding: 30px;
      margin-bottom: 30px;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .control-title {
      font-size: 1.5rem;
      color: #81c784;
      margin-bottom: 20px;
      font-weight: 600;
    }
    
    .button-group {
      display: flex;
      gap: 15px;
      flex-wrap: wrap;
      margin-bottom: 20px;
    }
    
    .btn {
      padding: 12px 24px;
      border: none;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.3s ease;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    
    .btn-primary {
      background: linear-gradient(135deg, #64b5f6 0%, #42a5f5 100%);
      color: white;
    }
    
    .btn-primary:hover {
      background: linear-gradient(135deg, #42a5f5 0%, #2196f3 100%);
      transform: translateY(-2px);
      box-shadow: 0 4px 15px rgba(100, 181, 246, 0.4);
    }
    
    .btn-success {
      background: linear-gradient(135deg, #81c784 0%, #66bb6a 100%);
      color: white;
    }
    
    .btn-success:hover {
      background: linear-gradient(135deg, #66bb6a 0%, #4caf50 100%);
      transform: translateY(-2px);
      box-shadow: 0 4px 15px rgba(129, 199, 132, 0.4);
    }
    
    .btn-warning {
      background: linear-gradient(135deg, #ffb74d 0%, #ffa726 100%);
      color: white;
    }
    
    .btn-warning:hover {
      background: linear-gradient(135deg, #ffa726 0%, #ff9800 100%);
      transform: translateY(-2px);
      box-shadow: 0 4px 15px rgba(255, 183, 77, 0.4);
    }
    
    .btn-danger {
      background: linear-gradient(135deg, #e57373 0%, #ef5350 100%);
      color: white;
    }
    
    .btn-danger:hover {
      background: linear-gradient(135deg, #ef5350 0%, #f44336 100%);
      transform: translateY(-2px);
      box-shadow: 0 4px 15px rgba(229, 115, 115, 0.4);
    }
    
    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none !important;
    }
    
    .status-badge {
      display: inline-block;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 0.85rem;
      font-weight: 500;
    }
    
    .status-active {
      background: rgba(129, 199, 132, 0.2);
      color: #81c784;
      border: 1px solid rgba(129, 199, 132, 0.3);
    }
    
    .status-paused {
      background: rgba(255, 183, 77, 0.2);
      color: #ffb74d;
      border: 1px solid rgba(255, 183, 77, 0.3);
    }
    
    .historial-section {
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(10px);
      border-radius: 16px;
      padding: 30px;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .historial-title {
      font-size: 1.5rem;
      color: #81c784;
      margin-bottom: 20px;
      font-weight: 600;
    }
    
    .table-container {
      overflow-x: auto;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
    }
    
    th {
      background: rgba(255, 255, 255, 0.05);
      color: #90a4ae;
      padding: 15px;
      text-align: left;
      font-weight: 600;
      text-transform: uppercase;
      font-size: 0.85rem;
      letter-spacing: 0.5px;
      border-bottom: 2px solid rgba(255, 255, 255, 0.1);
    }
    
    td {
      padding: 15px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }
    
    tr:hover {
      background: rgba(255, 255, 255, 0.03);
    }
    
    .estado-badge {
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 0.8rem;
      font-weight: 500;
    }
    
    .estado-completado {
      background: rgba(129, 199, 132, 0.2);
      color: #81c784;
    }
    
    .estado-procesando {
      background: rgba(100, 181, 246, 0.2);
      color: #64b5f6;
    }
    
    .estado-error {
      background: rgba(229, 115, 115, 0.2);
      color: #e57373;
    }
    
    .estado-pendiente {
      background: rgba(255, 183, 77, 0.2);
      color: #ffb74d;
    }
    
    .estado-pausado {
      background: rgba(158, 158, 158, 0.2);
      color: #9e9e9e;
    }
    
    .loading {
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: #64b5f6;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    
    .message {
      padding: 15px 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      display: none;
    }
    
    .message-success {
      background: rgba(129, 199, 132, 0.2);
      border: 1px solid rgba(129, 199, 132, 0.3);
      color: #81c784;
    }
    
    .message-error {
      background: rgba(229, 115, 115, 0.2);
      border: 1px solid rgba(229, 115, 115, 0.3);
      color: #e57373;
    }
    
    .message.show {
      display: block;
    }
    
    .info-text {
      color: #90a4ae;
      font-size: 0.9rem;
      margin-top: 10px;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🎤 Whisper Transcripciones</h1>
      <p class="subtitle">Panel de Control y Administración</p>
    </header>
    
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Estado</div>
        <div class="stat-value" id="estado-activo">
          <span class="status-badge ${control.activo ? 'status-active' : 'status-paused'}">
            ${control.activo ? '🟢 Activo' : '⏸️ Pausado'}
          </span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Procesados</div>
        <div class="stat-value">${control.total_procesados || 0}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Exitosos</div>
        <div class="stat-value" style="color: #81c784;">${control.total_exitosos || 0}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Fallidos</div>
        <div class="stat-value" style="color: #e57373;">${control.total_fallidos || 0}</div>
      </div>
    </div>
    
    <div class="control-panel">
      <h2 class="control-title">Control de Transcripciones</h2>
      
      <div id="message" class="message"></div>
      
      <div class="button-group">
        <button class="btn btn-success" onclick="activarTranscripciones()" ${control.activo ? 'disabled' : ''}>
          ▶️ Activar Transcripciones
        </button>
        <button class="btn btn-warning" onclick="pausarTranscripciones()" ${!control.activo ? 'disabled' : ''}>
          ⏸️ Pausar Transcripciones
        </button>
        <button class="btn btn-primary" onclick="procesarManual()" id="btn-procesar">
          🚀 Procesar Ahora
        </button>
        <button class="btn btn-primary" onclick="configurarDNS()" id="btn-dns">
          🌐 Configurar DNS
        </button>
      </div>
      
      <div class="info-text">
        <p>• Las transcripciones se ejecutan automáticamente a las 2:00 AM</p>
        <p>• Puedes pausar/activar en cualquier momento</p>
        <p>• El procesamiento manual procesa todos los archivos pendientes</p>
      </div>
    </div>
    
    <div class="historial-section">
      <h2 class="historial-title">Historial de Transcripciones</h2>
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Archivo</th>
              <th>Modelo</th>
              <th>Estado</th>
              <th>Tamaño</th>
              <th>Duración</th>
              <th>Fecha</th>
            </tr>
          </thead>
          <tbody id="historial-tbody">
            ${renderHistorial(historial.transcripciones || [])}
          </tbody>
        </table>
      </div>
      <div style="margin-top: 20px; text-align: center;">
        <button class="btn btn-primary" onclick="cargarMasHistorial()">Cargar Más</button>
      </div>
    </div>
  </div>
  
  <script>
    let historialOffset = 20;
    
    async function activarTranscripciones() {
      await actualizarEstado(true);
    }
    
    async function pausarTranscripciones() {
      await actualizarEstado(false);
    }
    
    async function actualizarEstado(activo) {
      try {
        const response = await fetch('/api/control', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ activo })
        });
        
        const resultado = await response.json();
        
        if (resultado.success) {
          mostrarMensaje('Estado actualizado correctamente', 'success');
          setTimeout(() => location.reload(), 1000);
        } else {
          mostrarMensaje('Error actualizando estado: ' + (resultado.error || 'Error desconocido'), 'error');
        }
      } catch (error) {
        mostrarMensaje('Error de conexión: ' + error.message, 'error');
      }
    }
    
    async function procesarManual() {
      const btn = document.getElementById('btn-procesar');
      const originalText = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span class="loading"></span> Procesando...';
      
      try {
        const response = await fetch('/api/procesar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        
        const resultado = await response.json();
        
        if (resultado.success) {
          mostrarMensaje(\`Procesamiento iniciado: \${resultado.procesados || 0} archivos\`, 'success');
          setTimeout(() => location.reload(), 2000);
        } else {
          mostrarMensaje('Error: ' + (resultado.error || 'Error desconocido'), 'error');
        }
      } catch (error) {
        mostrarMensaje('Error de conexión: ' + error.message, 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
      }
    }
    
    async function configurarDNS() {
      const btn = document.getElementById('btn-dns');
      const originalText = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span class="loading"></span> Configurando...';
      
      try {
        const response = await fetch('/api/configurar-dns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        
        const resultado = await response.json();
        
        if (resultado.success) {
          mostrarMensaje('DNS configurado correctamente. El subdominio estará disponible en unos minutos.', 'success');
        } else {
          mostrarMensaje('Error: ' + (resultado.error || 'Error desconocido'), 'error');
        }
      } catch (error) {
        mostrarMensaje('Error de conexión: ' + error.message, 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
      }
    }
    
    async function cargarMasHistorial() {
      try {
        const response = await fetch(\`/api/historial?limit=20&offset=\${historialOffset}\`);
        const resultado = await response.json();
        
        if (resultado.success && resultado.transcripciones.length > 0) {
          const tbody = document.getElementById('historial-tbody');
          resultado.transcripciones.forEach(t => {
            tbody.innerHTML += renderFilaHistorial(t);
          });
          historialOffset += 20;
        } else {
          mostrarMensaje('No hay más transcripciones', 'info');
        }
      } catch (error) {
        mostrarMensaje('Error cargando historial: ' + error.message, 'error');
      }
    }
    
    function renderFilaHistorial(t) {
      const fecha = new Date(t.fecha_inicio).toLocaleString('es-ES');
      const estadoClass = 'estado-' + t.estado;
      return \`
        <tr>
          <td>\${t.archivo_nombre}</td>
          <td><span style="color: #64b5f6;">\${t.modelo_usado.toUpperCase()}</span></td>
          <td><span class="estado-badge \${estadoClass}">\${t.estado}</span></td>
          <td>\${t.tamaño_archivo_mb ? t.tamaño_archivo_mb + ' MB' : '-'}</td>
          <td>\${t.duracion_segundos ? t.duracion_segundos + 's' : '-'}</td>
          <td>\${fecha}</td>
        </tr>
      \`;
    }
    
    function mostrarMensaje(texto, tipo) {
      const message = document.getElementById('message');
      message.textContent = texto;
      message.className = \`message message-\${tipo} show\`;
      setTimeout(() => {
        message.classList.remove('show');
      }, 5000);
    }
    
    // Auto-refresh cada 30 segundos
    setInterval(async () => {
      try {
        const response = await fetch('/api/control');
        const control = await response.json();
        const estadoElement = document.getElementById('estado-activo');
        estadoElement.innerHTML = \`
          <span class="status-badge \${control.activo ? 'status-active' : 'status-paused'}">
            \${control.activo ? '🟢 Activo' : '⏸️ Pausado'}
          </span>
        \`;
      } catch (error) {
        console.error('Error actualizando estado:', error);
      }
    }, 30000);
  </script>
</body>
</html>
  `;
  
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

function renderHistorial(transcripciones) {
  if (transcripciones.length === 0) {
    return '<tr><td colspan="6" style="text-align: center; color: #90a4ae; padding: 40px;">No hay transcripciones aún</td></tr>';
  }
  
  return transcripciones.map(t => {
    const fecha = new Date(t.fecha_inicio).toLocaleString('es-ES');
    const estadoClass = 'estado-' + t.estado;
    return `
      <tr>
        <td>${t.archivo_nombre}</td>
        <td><span style="color: #64b5f6;">${t.modelo_usado.toUpperCase()}</span></td>
        <td><span class="estado-badge ${estadoClass}">${t.estado}</span></td>
        <td>${t.tamaño_archivo_mb ? t.tamaño_archivo_mb + ' MB' : '-'}</td>
        <td>${t.duracion_segundos ? t.duracion_segundos + 's' : '-'}</td>
        <td>${fecha}</td>
      </tr>
    `;
  }).join('');
}

