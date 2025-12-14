// src/endpoints/admin-panel.js
// Panel de control administrativo para AuriPortal

import { getDatabase } from "../../database/db.js";
import { renderHtml } from '../core/html-response.js';

/**
 * Verifica si la solicitud viene de una IP autorizada o tiene password correcto
 */
function verificarAccesoAdmin(request, env) {
  // Opción 1: Verificar IP (si está configurada)
  const allowedIPs = env.ADMIN_ALLOWED_IPS ? env.ADMIN_ALLOWED_IPS.split(',') : [];
  const clientIP = request.headers.get('cf-connecting-ip') || 
                   request.headers.get('x-forwarded-for')?.split(',')[0] ||
                   request.headers.get('x-real-ip') ||
                   'unknown';
  
  if (allowedIPs.length > 0 && allowedIPs.includes(clientIP)) {
    return true;
  }
  
  // Opción 2: Verificar password en query string o header
  const password = request.url.includes('?password=') 
    ? new URL(request.url).searchParams.get('password')
    : request.headers.get('x-admin-password');
  
  const adminPassword = env.ADMIN_PASSWORD || 'kaketes7897'; // Password por defecto
  
  if (password === adminPassword) {
    return true;
  }
  
  // Si no hay restricciones configuradas, permitir acceso (solo en desarrollo)
  if (process.env.NODE_ENV !== 'production' && allowedIPs.length === 0) {
    return true;
  }
  
  return false;
}

/**
 * Renderiza el panel de administración
 */
function renderAdminPanel(env) {
  const db = getDatabase();
  
  // Obtener estadísticas de la base de datos
  let stats = {
    students: 0,
    practices: 0,
    syncLogs: 0,
    studentsWithStreak: 0
  };
  
  try {
    const stmtStudents = db.prepare('SELECT COUNT(*) as count FROM students');
    stats.students = stmtStudents.get().count;
    
    const stmtPractices = db.prepare('SELECT COUNT(*) as count FROM practices');
    stats.practices = stmtPractices.get().count;
    
    const stmtLogs = db.prepare('SELECT COUNT(*) as count FROM sync_log');
    stats.syncLogs = stmtLogs.get().count;
    
    const stmtStreak = db.prepare('SELECT COUNT(*) as count FROM students WHERE racha_actual > 0');
    stats.studentsWithStreak = stmtStreak.get().count;
  } catch (err) {
    console.error('Error obteniendo estadísticas:', err);
  }
  
  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes">
  <meta name="theme-color" content="#667eea">
  <meta name="description" content="Panel de administración de AuriPortal">
  <title>Panel de Control - AuriPortal</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }
    
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    
    .header {
      background: white;
      border-radius: 12px;
      padding: 30px;
      margin-bottom: 30px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    
    .header h1 {
      color: #333;
      margin-bottom: 10px;
      font-size: 2rem;
    }
    
    .header p {
      color: #666;
      font-size: 0.9rem;
    }
    
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    
    .stat-card {
      background: white;
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      text-align: center;
    }
    
    .stat-card .number {
      font-size: 2.5rem;
      font-weight: bold;
      color: #667eea;
      margin-bottom: 10px;
    }
    
    .stat-card .label {
      color: #666;
      font-size: 0.9rem;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    
    .actions-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    
    .action-card {
      background: white;
      border-radius: 12px;
      padding: 25px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    
    .action-card h2 {
      color: #333;
      margin-bottom: 15px;
      font-size: 1.3rem;
    }
    
    .action-card p {
      color: #666;
      margin-bottom: 20px;
      font-size: 0.9rem;
      line-height: 1.6;
    }
    
    .btn {
      display: inline-block;
      padding: 12px 24px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
      text-decoration: none;
      width: 100%;
      text-align: center;
      touch-action: manipulation;
    }
    
    .btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 12px rgba(102, 126, 234, 0.4);
    }
    
    .btn:active {
      transform: translateY(0);
    }
    
    .btn-danger {
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    }
    
    .btn-success {
      background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
    }
    
    .btn-warning {
      background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
    }
    
    .loading {
      display: none;
      text-align: center;
      padding: 20px;
      color: #667eea;
    }
    
    .loading.active {
      display: block;
    }
    
    .result {
      display: none;
      margin-top: 20px;
      padding: 15px;
      border-radius: 8px;
      background: #f8f9fa;
      border-left: 4px solid #667eea;
      word-wrap: break-word;
      overflow-x: auto;
    }
    
    .result.active {
      display: block;
    }
    
    .result.success {
      border-left-color: #22c55e;
      background: #f0fdf4;
    }
    
    .result.error {
      border-left-color: #ef4444;
      background: #fef2f2;
    }
    
    .footer {
      background: white;
      border-radius: 12px;
      padding: 20px;
      text-align: center;
      color: #666;
      font-size: 0.9rem;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    
    .info-badge {
      display: inline-block;
      padding: 4px 8px;
      background: #e0e7ff;
      color: #667eea;
      border-radius: 4px;
      font-size: 0.8rem;
      margin-left: 10px;
    }
    
    /* Responsive para móvil */
    @media (max-width: 768px) {
      body {
        padding: 10px;
      }
      
      .header {
        padding: 20px;
        margin-bottom: 20px;
      }
      
      .header h1 {
        font-size: 1.5rem;
      }
      
      .stats-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 10px;
        margin-bottom: 20px;
      }
      
      .stat-card {
        padding: 15px;
      }
      
      .stat-card .number {
        font-size: 2rem;
      }
      
      .stat-card .label {
        font-size: 0.75rem;
      }
      
      .actions-grid {
        grid-template-columns: 1fr;
        gap: 15px;
        margin-bottom: 20px;
      }
      
      .action-card {
        padding: 20px;
      }
      
      .action-card h2 {
        font-size: 1.1rem;
      }
      
      .action-card p {
        font-size: 0.85rem;
      }
      
      .btn {
        padding: 14px 20px;
        font-size: 0.95rem;
      }
      
      .footer {
        padding: 15px;
        font-size: 0.8rem;
      }
      
      #sql-query {
        font-size: 16px; /* Evita zoom en iOS */
      }
    }
    
    @media (max-width: 480px) {
      .stats-grid {
        grid-template-columns: 1fr;
      }
      
      .header h1 {
        font-size: 1.3rem;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎛️ Panel de Control AuriPortal</h1>
      <p>Gestión y sincronización de datos</p>
    </div>
    
    <div class="stats-grid">
      <div class="stat-card">
        <div class="number">${stats.students}</div>
        <div class="label">Estudiantes</div>
      </div>
      <div class="stat-card">
        <div class="number">${stats.practices}</div>
        <div class="label">Prácticas</div>
      </div>
      <div class="stat-card">
        <div class="number">${stats.studentsWithStreak}</div>
        <div class="label">Con Racha Activa</div>
      </div>
      <div class="stat-card">
        <div class="number">${stats.syncLogs}</div>
        <div class="label">Sincronizaciones</div>
      </div>
    </div>
    
    <div class="actions-grid">
      <div class="action-card">
        <h2>🔄 Sincronizar ClickUp ↔ SQL</h2>
        <p>Sincroniza datos bidireccionalmente entre ClickUp y SQL. Actualiza email, apodo, fecha inscripción, nivel, racha y última práctica.</p>
        <button class="btn btn-success" onclick="ejecutarAccion('sync-clickup-sql')">
          Ejecutar Sincronización
        </button>
        <div class="loading" id="loading-sync-clickup-sql">⏳ Sincronizando...</div>
        <div class="result" id="result-sync-clickup-sql"></div>
      </div>
      
      <div class="action-card">
        <h2>📊 Ver Base de Datos SQL</h2>
        <p>Accede al panel SQL para ver y editar los datos de estudiantes directamente en la base de datos.</p>
        <a href="/sql-admin" class="btn btn-success" target="_blank">
          Abrir Panel SQL
        </a>
      </div>
      
      <div class="action-card">
        <h2>📊 Ver Estadísticas</h2>
        <p>Actualiza las estadísticas mostradas arriba con los datos más recientes de la base de datos.</p>
        <button class="btn" onclick="recargarEstadisticas()">
          Actualizar Estadísticas
        </button>
      </div>
      
      <div class="action-card">
        <h2>🗄️ Consultas SQL</h2>
        <p>Ejecuta consultas SQL directamente en la base de datos (solo lectura recomendado).</p>
        <input type="text" id="sql-query" placeholder="SELECT COUNT(*) FROM students" 
               style="width: 100%; padding: 10px; margin-bottom: 10px; border: 1px solid #ddd; border-radius: 4px;">
        <button class="btn" onclick="ejecutarSQL()">
          Ejecutar Consulta
        </button>
        <div class="result" id="result-sql"></div>
      </div>
      
      <div class="action-card">
        <h2>📋 Ver Últimos Logs</h2>
        <p>Muestra los últimos registros de sincronización de la base de datos.</p>
        <button class="btn" onclick="verLogs()">
          Ver Logs
        </button>
        <div class="result" id="result-logs"></div>
      </div>
    </div>
    
    <div class="footer">
      <p>Panel de Control AuriPortal v3.2 | Última actualización: ${new Date().toLocaleString('es-ES')}</p>
    </div>
  </div>
  
  <script>
    async function ejecutarAccion(accion) {
      const loadingEl = document.getElementById('loading-' + accion);
      const resultEl = document.getElementById('result-' + accion);
      
      loadingEl.classList.add('active');
      resultEl.classList.remove('active');
      
      try {
        const response = await fetch('/' + accion, {
          method: 'GET',
          headers: {
            'X-Admin-Panel': 'true'
          }
        });
        
        if (response.ok) {
          const html = await response.text();
          resultEl.innerHTML = '<h3>✅ Resultado:</h3>' + html;
          resultEl.classList.add('active', 'success');
        } else {
          const text = await response.text();
          resultEl.innerHTML = '<h3>❌ Error:</h3><pre>' + text + '</pre>';
          resultEl.classList.add('active', 'error');
        }
      } catch (error) {
        resultEl.innerHTML = '<h3>❌ Error:</h3><pre>' + error.message + '</pre>';
        resultEl.classList.add('active', 'error');
      } finally {
        loadingEl.classList.remove('active');
        // Recargar estadísticas después de la acción
        setTimeout(recargarEstadisticas, 2000);
      }
    }
    
    async function recargarEstadisticas() {
      // Recargar la página para actualizar estadísticas
      window.location.reload();
    }
    
    async function ejecutarSQL() {
      const query = document.getElementById('sql-query').value;
      if (!query) {
        alert('Por favor, ingresa una consulta SQL');
        return;
      }
      
      const resultEl = document.getElementById('result-sql');
      resultEl.classList.remove('active');
      
      try {
        const response = await fetch('/admin/sql', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Admin-Panel': 'true'
          },
          body: JSON.stringify({ query })
        });
        
        const data = await response.json();
        
        if (data.success) {
          resultEl.innerHTML = '<h3>✅ Resultado:</h3><pre>' + JSON.stringify(data.result, null, 2) + '</pre>';
          resultEl.classList.add('active', 'success');
        } else {
          resultEl.innerHTML = '<h3>❌ Error:</h3><pre>' + data.error + '</pre>';
          resultEl.classList.add('active', 'error');
        }
      } catch (error) {
        resultEl.innerHTML = '<h3>❌ Error:</h3><pre>' + error.message + '</pre>';
        resultEl.classList.add('active', 'error');
      }
    }
    
    async function verLogs() {
      const resultEl = document.getElementById('result-logs');
      resultEl.classList.remove('active');
      
      try {
        const response = await fetch('/admin/logs', {
          method: 'GET',
          headers: {
            'X-Admin-Panel': 'true'
          }
        });
        
        const data = await response.json();
        
        if (data.success) {
          let html = '<h3>📋 Últimos Logs:</h3><table style="width:100%; border-collapse: collapse;">';
          html += '<tr style="background:#f0f0f0;"><th style="padding:8px; text-align:left;">Fecha</th><th style="padding:8px; text-align:left;">Acción</th><th style="padding:8px; text-align:left;">Email</th><th style="padding:8px; text-align:left;">Estado</th></tr>';
          
          data.logs.forEach(log => {
            html += '<tr style="border-bottom:1px solid #ddd;">';
            html += '<td style="padding:8px;">' + new Date(log.synced_at).toLocaleString('es-ES') + '</td>';
            html += '<td style="padding:8px;">' + log.action + '</td>';
            html += '<td style="padding:8px;">' + (log.contact_email || 'N/A') + '</td>';
            html += '<td style="padding:8px;">' + (log.success ? '✅' : '❌') + '</td>';
            html += '</tr>';
          });
          
          html += '</table>';
          resultEl.innerHTML = html;
          resultEl.classList.add('active', 'success');
        } else {
          resultEl.innerHTML = '<h3>❌ Error:</h3><pre>' + data.error + '</pre>';
          resultEl.classList.add('active', 'error');
        }
      } catch (error) {
        resultEl.innerHTML = '<h3>❌ Error:</h3><pre>' + error.message + '</pre>';
        resultEl.classList.add('active', 'error');
      }
    }
  </script>
  
  <!-- Script para suprimir errores de extensiones del navegador -->
  <script src="/js/error-handler.js"></script>
  
    
  </script>
</body>
</html>
  `;
  
  return html;
}

export default async function adminPanelHandler(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;
  
  // Verificar acceso
  if (!verificarAccesoAdmin(request, env)) {
    return new Response(
      `<!DOCTYPE html>
<html>
<head><title>Acceso Denegado</title></head>
<body style="font-family: sans-serif; text-align: center; padding: 50px;">
  <h1>🔒 Acceso Denegado</h1>
  <p>No tienes permiso para acceder a este panel.</p>
  <p style="color: #666; font-size: 0.9rem;">Si crees que esto es un error, contacta al administrador.</p>
</body>
</html>`,
      {
        status: 403,
        headers: { "Content-Type": "text/html; charset=UTF-8" }
      }
    );
  }
  
  // Si es POST para ejecutar SQL
  if (request.method === "POST" && path === "/admin/sql") {
    try {
      const { query } = await request.json();
      
      // Solo permitir SELECT por seguridad
      if (!query.trim().toUpperCase().startsWith('SELECT')) {
        return new Response(
          JSON.stringify({ success: false, error: "Solo se permiten consultas SELECT" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" }
          }
        );
      }
      
      const db = getDatabase();
      const stmt = db.prepare(query);
      const result = stmt.all();
      
      return new Response(
        JSON.stringify({ success: true, result }),
        {
          headers: { "Content-Type": "application/json" }
        }
      );
    } catch (err) {
      return new Response(
        JSON.stringify({ success: false, error: err.message }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" }
        }
      );
    }
  }
  
  // Si es GET para ver logs
  if (request.method === "GET" && path === "/admin/logs") {
    try {
      const db = getDatabase();
      const stmt = db.prepare(`
        SELECT * FROM sync_log 
        ORDER BY synced_at DESC 
        LIMIT 50
      `);
      const logs = stmt.all();
      
      return new Response(
        JSON.stringify({ success: true, logs }),
        {
          headers: { "Content-Type": "application/json" }
        }
      );
    } catch (err) {
      return new Response(
        JSON.stringify({ success: false, error: err.message }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" }
        }
      );
    }
  }
  
  // Renderizar panel principal
  const html = renderAdminPanel(env);
  // Usar renderHtml centralizado (aplica headers anti-cache automáticamente)
  return renderHtml(html);
}

