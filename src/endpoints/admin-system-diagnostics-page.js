// src/endpoints/admin-system-diagnostics-page.js
// Runtime Diagnostics UI - Muestra el estado real del sistema

import { requireAdminContext } from '../core/auth-context.js';
import { renderAdminPage } from '../core/admin/admin-page-renderer.js';

/**
 * Handler para GET /admin/system/diagnostics
 * 
 * Renderiza la UI de diagnóstico del sistema.
 * Consume el endpoint /admin/api/system/diagnostics para obtener datos.
 * 
 * @param {Request} request - Request object
 * @param {Object} env - Environment variables
 * @param {Object} ctx - Context object
 * @returns {Promise<Response>} HTML response con UI de diagnóstico
 */
export default async function adminSystemDiagnosticsPageHandler(request, env, ctx) {
  // Verificar acceso admin
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return authCtx;
  }

  // Extraer activePath de la request
  const url = new URL(request.url);
  const activePath = url.pathname;

  // Estilos específicos de la página
  const extraStyles = [`
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
      max-width: 1400px;
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
    
    .status-banner {
      background: white;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 30px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    
    .status-banner.normal {
      border-left: 4px solid #22c55e;
    }
    
    .status-banner.degraded {
      border-left: 4px solid #f59e0b;
    }
    
    .status-banner.broken {
      border-left: 4px solid #ef4444;
    }
    
    .status-banner h2 {
      color: #333;
      margin-bottom: 10px;
      font-size: 1.5rem;
    }
    
    .status-badge {
      display: inline-block;
      padding: 6px 12px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 0.9rem;
      margin-left: 10px;
    }
    
    .status-badge.normal {
      background: #dcfce7;
      color: #166534;
    }
    
    .status-badge.degraded {
      background: #fef3c7;
      color: #92400e;
    }
    
    .status-badge.broken {
      background: #fee2e2;
      color: #991b1b;
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
    
    .contracts-section {
      background: white;
      border-radius: 12px;
      padding: 30px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    
    .contracts-section h2 {
      color: #333;
      margin-bottom: 20px;
      font-size: 1.5rem;
    }
    
    .contracts-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
    }
    
    .contracts-table th {
      background: #f8f9fa;
      padding: 12px;
      text-align: left;
      font-weight: 600;
      color: #333;
      border-bottom: 2px solid #e5e7eb;
    }
    
    .contracts-table td {
      padding: 12px;
      border-bottom: 1px solid #e5e7eb;
      color: #666;
    }
    
    .contracts-table tr:hover {
      background: #f8f9fa;
    }
    
    .status-cell {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 0.85rem;
      font-weight: 500;
    }
    
    .status-cell.active {
      background: #dcfce7;
      color: #166534;
    }
    
    .status-cell.degraded {
      background: #fef3c7;
      color: #92400e;
    }
    
    .status-cell.broken {
      background: #fee2e2;
      color: #991b1b;
    }
    
    .reason-cell {
      font-size: 0.85rem;
      color: #666;
      max-width: 400px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .dependencies-cell {
      font-size: 0.85rem;
      color: #667eea;
    }
    
    .loading {
      text-align: center;
      padding: 40px;
      color: #667eea;
      font-size: 1.1rem;
    }
    
    .error {
      background: #fee2e2;
      border: 1px solid #ef4444;
      border-radius: 8px;
      padding: 20px;
      color: #991b1b;
      margin: 20px 0;
    }
    
    .refresh-btn {
      display: inline-block;
      padding: 10px 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
      margin-top: 20px;
      transition: transform 0.2s;
    }
    
    .refresh-btn:hover {
      transform: translateY(-2px);
    }
    
    @media (max-width: 768px) {
      .container {
        padding: 10px;
      }
      
      .header {
        padding: 20px;
      }
      
      .contracts-table {
        font-size: 0.85rem;
      }
      
      .contracts-table th,
      .contracts-table td {
        padding: 8px;
      }
    }
  </style>
  `];

  // Contenido HTML de la página (solo el contenido, sin <html>, <head>, <body>)
  const contentHtml = `
  <div class="container">
    <div class="header">
      <h1>🔍 Runtime Diagnostics</h1>
      <p>Estado real del sistema derivado del Coherence Engine</p>
    </div>
    
    <div id="loading" class="loading">
      ⏳ Cargando diagnóstico del sistema...
    </div>
    
    <div id="error" class="error" style="display: none;"></div>
    
    <div id="content" style="display: none;">
      <!-- Status Banner -->
      <div id="status-banner" class="status-banner">
        <h2>
          Estado del Sistema
          <span id="status-badge" class="status-badge"></span>
        </h2>
        <p id="status-description"></p>
      </div>
      
      <!-- Stats Grid -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="number" id="stat-total">-</div>
          <div class="label">Total Contratos</div>
        </div>
        <div class="stat-card">
          <div class="number" id="stat-active">-</div>
          <div class="label">Activos</div>
        </div>
        <div class="stat-card">
          <div class="number" id="stat-degraded">-</div>
          <div class="label">Degradados</div>
        </div>
        <div class="stat-card">
          <div class="number" id="stat-broken">-</div>
          <div class="label">Rotos</div>
        </div>
      </div>
      
      <!-- Contracts Table -->
      <div class="contracts-section">
        <h2>Contratos del Sistema</h2>
        <table class="contracts-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Estado Declarado</th>
              <th>Estado Efectivo</th>
              <th>Razón</th>
              <th>Dependencias</th>
            </tr>
          </thead>
          <tbody id="contracts-tbody">
          </tbody>
        </table>
        <button class="refresh-btn" onclick="loadDiagnostics()">🔄 Actualizar</button>
      </div>
    </div>
  </div>
  `;

  // Script específico de la página
  const extraScripts = [`
  <script>
    async function loadDiagnostics() {
      const loadingEl = document.getElementById('loading');
      const errorEl = document.getElementById('error');
      const contentEl = document.getElementById('content');
      
      loadingEl.style.display = 'block';
      errorEl.style.display = 'none';
      contentEl.style.display = 'none';
      
      try {
        const response = await fetch('/admin/api/system/diagnostics');
        
        if (!response.ok) {
          throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
        }
        
        const data = await response.json();
        
        if (!data.ok || !data.data) {
          throw new Error('Respuesta inválida del servidor');
        }
        
        const diagnostics = data.data;
        
        // Actualizar status banner
        const statusBanner = document.getElementById('status-banner');
        const statusBadge = document.getElementById('status-badge');
        const statusDescription = document.getElementById('status-description');
        
        const systemState = diagnostics.system_state;
        statusBanner.className = \`status-banner \${systemState}\`;
        statusBadge.className = \`status-badge \${systemState}\`;
        statusBadge.textContent = systemState.toUpperCase();
        
        const descriptions = {
          'active': 'Sistema completamente operativo. Todas las funcionalidades disponibles.',
          'degraded': 'Sistema operativo con limitaciones. Algunos contratos están degradados.',
          'broken': 'Sistema no operativo. Contratos críticos están rotos. Solo lectura disponible.'
        };
        statusDescription.textContent = descriptions[systemState] || 'Estado desconocido';
        
        // Actualizar estadísticas
        document.getElementById('stat-total').textContent = diagnostics.stats.total;
        document.getElementById('stat-active').textContent = diagnostics.stats.active;
        document.getElementById('stat-degraded').textContent = diagnostics.stats.degraded;
        document.getElementById('stat-broken').textContent = diagnostics.stats.broken;
        
        // Actualizar tabla de contratos
        const tbody = document.getElementById('contracts-tbody');
        tbody.innerHTML = '';
        
        diagnostics.contracts.forEach(contract => {
          const row = document.createElement('tr');
          
          const idCell = document.createElement('td');
          idCell.textContent = contract.id;
          row.appendChild(idCell);
          
          const declaredCell = document.createElement('td');
          const declaredBadge = document.createElement('span');
          declaredBadge.className = \`status-cell \${contract.declared_status}\`;
          declaredBadge.textContent = contract.declared_status;
          declaredCell.appendChild(declaredBadge);
          row.appendChild(declaredCell);
          
          const effectiveCell = document.createElement('td');
          const effectiveBadge = document.createElement('span');
          effectiveBadge.className = \`status-cell \${contract.effective_status}\`;
          effectiveBadge.textContent = contract.effective_status;
          effectiveCell.appendChild(effectiveBadge);
          row.appendChild(effectiveCell);
          
          const reasonCell = document.createElement('td');
          reasonCell.className = 'reason-cell';
          reasonCell.textContent = contract.reason || '-';
          reasonCell.title = contract.reason || '';
          row.appendChild(reasonCell);
          
          const depsCell = document.createElement('td');
          depsCell.className = 'dependencies-cell';
          if (contract.dependencies && contract.dependencies.length > 0) {
            depsCell.textContent = contract.dependencies.join(', ');
          } else {
            depsCell.textContent = '-';
          }
          row.appendChild(depsCell);
          
          tbody.appendChild(row);
        });
        
        loadingEl.style.display = 'none';
        contentEl.style.display = 'block';
        
      } catch (error) {
        console.error('[DIAGNOSTICS_UI] Error cargando diagnóstico:', error);
        loadingEl.style.display = 'none';
        errorEl.style.display = 'block';
        errorEl.textContent = \`Error cargando diagnóstico: \${error.message}\`;
      }
    }
    
    // Cargar al iniciar
    loadDiagnostics();
    
    // Auto-refresh cada 30 segundos
    setInterval(loadDiagnostics, 30000);
  </script>
  `];

  // Renderizar usando el contrato canónico
  return renderAdminPage({
    title: 'Runtime Diagnostics',
    contentHtml,
    activePath,
    extraStyles,
    extraScripts,
    userContext: { isAdmin: true }
  });
}

