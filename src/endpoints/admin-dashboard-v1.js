// src/endpoints/admin-dashboard-v1.js
// Admin Dashboard v1 - Centro de mando del AuriPortal (POST-LEGACY)

import { requireAdminContext } from '../core/auth-context.js';
import { renderAdminPage } from '../core/admin/admin-page-renderer.js';
import { getSystemMode, getSystemModeInfo, getSystemModeDescription } from '../core/system/system-modes.js';
import { ADMIN_ROUTES } from '../core/admin/admin-route-registry.js';

/**
 * Handler para GET /admin y GET /admin/dashboard
 * 
 * Dashboard completamente nuevo, sin herencia del legacy.
 * Centro de mando del AuriPortal con diagnóstico, control y progreso de migración.
 * 
 * @param {Request} request - Request object
 * @param {Object} env - Environment variables
 * @param {Object} ctx - Context object
 * @returns {Promise<Response>} HTML response con dashboard admin
 */
export default async function adminDashboardV1Handler(request, env, ctx) {
  // Verificar acceso admin
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return authCtx;
  }

  // Extraer activePath de la request
  const url = new URL(request.url);
  const activePath = url.pathname;

  // Obtener estado del sistema
  const systemMode = getSystemMode();
  const systemModeInfo = getSystemModeInfo();
  const systemModeDescription = getSystemModeDescription();

  // Calcular estado de migración
  const totalRoutes = ADMIN_ROUTES.length;
  const activeRoutes = ADMIN_ROUTES.filter(r => !r.disabled).length;
  const disabledRoutes = ADMIN_ROUTES.filter(r => r.disabled === true).length;
  const migrationProgress = totalRoutes > 0 
    ? Math.round((activeRoutes / totalRoutes) * 100) 
    : 0;

  // Rutas núcleo disponibles (solo si no están disabled)
  const coreRoutes = [
    { key: 'contexts-manager', path: '/admin/contexts', label: 'Contextos & Mappings', icon: '🗺️' },
    { key: 'packages-creator-v2', path: '/admin/pde/packages-v2', label: 'Paquetes', icon: '📦' },
    { key: 'navigation', path: '/admin/navigation', label: 'Navegaciones', icon: '🧭' },
    { key: 'motors', path: '/admin/motors', label: 'Motors', icon: '⚙️' },
    { key: 'themes-studio-v3', path: '/admin/themes/studio-v3', label: 'Theme Studio', icon: '🎨' }
  ].filter(route => {
    const registryRoute = ADMIN_ROUTES.find(r => r.key === route.key);
    return registryRoute && !registryRoute.disabled;
  });

  // Estilos específicos del dashboard
  const extraStyles = [`
  <style>
    .dashboard-container {
      padding: 2rem;
      max-width: 1400px;
      margin: 0 auto;
    }
    
    .dashboard-header {
      margin-bottom: 2rem;
    }
    
    .dashboard-header h1 {
      font-size: 2rem;
      font-weight: 700;
      color: #1e293b;
      margin-bottom: 0.5rem;
    }
    
    .dashboard-header p {
      color: #64748b;
      font-size: 1rem;
    }
    
    .dashboard-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    }
    
    .dashboard-card {
      background: white;
      border-radius: 12px;
      padding: 1.5rem;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      border: 1px solid #e2e8f0;
    }
    
    .dashboard-card h2 {
      font-size: 1.25rem;
      font-weight: 600;
      color: #1e293b;
      margin-bottom: 1rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    
    .system-status {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1rem;
    }
    
    .status-badge {
      display: inline-flex;
      align-items: center;
      padding: 0.5rem 1rem;
      border-radius: 8px;
      font-weight: 600;
      font-size: 0.875rem;
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
    
    .status-description {
      color: #64748b;
      font-size: 0.875rem;
      line-height: 1.5;
    }
    
    .diagnostics-summary {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1rem;
      margin-bottom: 1rem;
    }
    
    .diagnostic-stat {
      text-align: center;
      padding: 1rem;
      background: #f8fafc;
      border-radius: 8px;
    }
    
    .diagnostic-stat .number {
      font-size: 2rem;
      font-weight: 700;
      color: #1e293b;
      margin-bottom: 0.25rem;
    }
    
    .diagnostic-stat .label {
      font-size: 0.75rem;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    
    .diagnostics-link {
      display: inline-block;
      margin-top: 0.5rem;
      color: #3b82f6;
      text-decoration: none;
      font-size: 0.875rem;
      font-weight: 500;
    }
    
    .diagnostics-link:hover {
      text-decoration: underline;
    }
    
    .core-routes-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    
    .core-routes-list li {
      margin-bottom: 0.75rem;
    }
    
    .core-route-link {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem;
      background: #f8fafc;
      border-radius: 8px;
      text-decoration: none;
      color: #1e293b;
      transition: all 0.2s;
    }
    
    .core-route-link:hover {
      background: #e2e8f0;
      transform: translateX(4px);
    }
    
    .core-route-link .icon {
      font-size: 1.25rem;
    }
    
    .migration-progress {
      margin-bottom: 1rem;
    }
    
    .progress-bar {
      width: 100%;
      height: 8px;
      background: #e2e8f0;
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 0.5rem;
    }
    
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #3b82f6 0%, #8b5cf6 100%);
      transition: width 0.3s ease;
    }
    
    .migration-stats {
      display: flex;
      justify-content: space-between;
      font-size: 0.875rem;
      color: #64748b;
    }
    
    .master-zone {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 1.5rem;
      border-radius: 12px;
      text-align: center;
    }
    
    .master-zone h3 {
      font-size: 1.125rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
    }
    
    .master-zone p {
      font-size: 0.875rem;
      opacity: 0.9;
    }
    
    .loading {
      text-align: center;
      padding: 2rem;
      color: #64748b;
    }
  </style>
  `];

  // Contenido HTML del dashboard
  const contentHtml = `
  <div class="dashboard-container">
    <div class="dashboard-header">
      <h1>🚀 AuriPortal · Admin</h1>
      <p>Centro de mando del sistema</p>
    </div>
    
    <div class="dashboard-grid">
      <!-- Estado del Sistema -->
      <div class="dashboard-card">
        <h2>⚙️ Estado del Sistema</h2>
        <div class="system-status">
          <span class="status-badge ${systemMode.toLowerCase()}">${systemMode}</span>
        </div>
        <p class="status-description">${systemModeDescription}</p>
        <div style="margin-top: 1rem; font-size: 0.75rem; color: #94a3b8;">
          <div>Total contratos: ${systemModeInfo.stats?.total || 0}</div>
          <div>Activos: ${systemModeInfo.stats?.active || 0} | Degradados: ${systemModeInfo.stats?.degraded || 0} | Rotos: ${systemModeInfo.stats?.broken || 0}</div>
        </div>
      </div>
      
      <!-- Diagnóstico Rápido -->
      <div class="dashboard-card">
        <h2>🔍 Diagnóstico Rápido</h2>
        <div class="diagnostics-summary">
          <div class="diagnostic-stat">
            <div class="number" id="diag-total">-</div>
            <div class="label">Total</div>
          </div>
          <div class="diagnostic-stat">
            <div class="number" id="diag-active">-</div>
            <div class="label">Activos</div>
          </div>
          <div class="diagnostic-stat">
            <div class="number" id="diag-degraded">-</div>
            <div class="label">Degradados</div>
          </div>
          <div class="diagnostic-stat">
            <div class="number" id="diag-broken">-</div>
            <div class="label">Rotos</div>
          </div>
        </div>
        <a href="/admin/system/diagnostics" class="diagnostics-link">Ver diagnóstico completo →</a>
      </div>
      
      <!-- Accesos Núcleo -->
      <div class="dashboard-card">
        <h2>🎯 Accesos Núcleo</h2>
        <ul class="core-routes-list">
          ${coreRoutes.map(route => `
            <li>
              <a href="${route.path}" class="core-route-link">
                <span class="icon">${route.icon}</span>
                <span>${route.label}</span>
              </a>
            </li>
          `).join('')}
        </ul>
      </div>
      
      <!-- Estado de Migración -->
      <div class="dashboard-card">
        <h2>📊 Estado de Migración</h2>
        <div class="migration-progress">
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${migrationProgress}%"></div>
          </div>
          <div class="migration-stats">
            <span>${activeRoutes} activas</span>
            <span>${disabledRoutes} legacy</span>
          </div>
        </div>
        <p style="font-size: 0.875rem; color: #64748b; margin-top: 0.5rem;">
          Progreso: ${migrationProgress}% migrado
        </p>
      </div>
      
      <!-- Zona Master -->
      <div class="dashboard-card">
        <div class="master-zone">
          <h3>👑 Modo Master</h3>
          <p>Modo Master activo. Sistema bajo control.</p>
        </div>
      </div>
    </div>
  </div>
  `;

  // Script para cargar diagnóstico rápido
  const extraScripts = [`
  <script>
    async function loadQuickDiagnostics() {
      try {
        const response = await fetch('/admin/api/system/diagnostics');
        if (!response.ok) {
          throw new Error(\`HTTP \${response.status}\`);
        }
        
        const data = await response.json();
        if (data.ok && data.data) {
          const stats = data.data.stats;
          document.getElementById('diag-total').textContent = stats.total || 0;
          document.getElementById('diag-active').textContent = stats.active || 0;
          document.getElementById('diag-degraded').textContent = stats.degraded || 0;
          document.getElementById('diag-broken').textContent = stats.broken || 0;
        }
      } catch (error) {
        console.error('[DASHBOARD] Error cargando diagnóstico rápido:', error);
        // No mostrar error, solo dejar los guiones
      }
    }
    
    // Cargar diagnóstico al iniciar
    loadQuickDiagnostics();
  </script>
  `];

  // Renderizar usando el contrato canónico
  return renderAdminPage({
    title: 'AuriPortal · Admin',
    contentHtml,
    activePath,
    extraStyles,
    extraScripts,
    userContext: { isAdmin: true }
  });
}




