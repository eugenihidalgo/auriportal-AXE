// src/endpoints/transmutaciones-admin.js
// Vista de administración para gestionar transmutaciones energéticas

import { verificarAccesoAdmin } from './transmutaciones-api.js';
import { obtenerListas, obtenerItemsPorLista } from '../services/transmutaciones-energeticas.js';

export default async function transmutacionesAdminHandler(request, env, ctx) {
  // Verificar acceso admin
  if (!(await verificarAccesoAdmin(request, env))) {
    return new Response('Acceso denegado', { status: 403 });
  }

  const url = new URL(request.url);
  const path = url.pathname;
  
  // Normalizar path - para el subdominio transmutaciones.eugenihidalgo.work, cualquier path va al panel
  let normalizedPath = path;
  if (normalizedPath.startsWith('/admin/transmutaciones')) {
    normalizedPath = normalizedPath.replace('/admin/transmutaciones', '') || '/';
  }
  if (normalizedPath.startsWith('/transmutaciones-admin')) {
    normalizedPath = normalizedPath.replace('/transmutaciones-admin', '') || '/';
  }
  
  // Si el path es solo "/" o está vacío, mostrar el panel principal
  if (normalizedPath === '/' || normalizedPath === '') {
    normalizedPath = '/';
  }

  try {
    const listas = await obtenerListas();
    
    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Transmutaciones Energéticas - Admin</title>
    <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: #0f172a; /* slate-900 */
      padding: 20px;
      color: #cbd5e1; /* slate-200 */
      min-height: 100vh;
    }
    
    .container {
      max-width: 1600px;
      margin: 0 auto;
      background: #1e293b; /* slate-800 */
      border-radius: 12px;
      box-shadow: 0 8px 16px rgba(0,0,0,0.4);
      padding: 24px;
      border: 1px solid #334155; /* slate-700 */
    }
    
    h1 {
      color: #ffffff; /* white */
      margin-bottom: 24px;
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -0.5px;
    }
    
    .header-actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 30px;
      flex-wrap: wrap;
      gap: 15px;
    }
    
    .btn {
      padding: 10px 20px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.2s;
      text-decoration: none;
      display: inline-block;
    }
    
    .btn-primary {
      background: #4f46e5; /* indigo-600 */
      color: white;
    }
    
    .btn-primary:hover {
      background: #4338ca; /* indigo-700 */
    }
    
    .btn-success {
      background: #10b981; /* emerald-500 */
      color: white;
    }
    
    .btn-success:hover {
      background: #059669; /* emerald-600 */
    }
    
    .btn-danger {
      background: #ef4444; /* red-500 */
      color: white;
    }
    
    .btn-danger:hover {
      background: #dc2626; /* red-600 */
    }
    
    .btn {
      background: #475569; /* slate-600 */
      color: white;
    }
    
    .btn:hover {
      background: #64748b; /* slate-500 */
    }
    
    .btn-small {
      padding: 5px 10px;
      font-size: 11px;
      border-radius: 4px;
    }
    
    .btn-small:hover {
      transform: translateY(-1px);
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    }
    
    .listas-container {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    
    .lista-card {
      border: 1px solid #334155; /* slate-700 */
      border-radius: 8px;
      padding: 20px;
      background: #0f172a; /* slate-900 */
      transition: all 0.2s;
    }
    
    .lista-card:hover {
      border-color: #4f46e5; /* indigo-600 */
      box-shadow: 0 4px 12px rgba(79, 70, 229, 0.2);
    }
    
    .lista-card.recurrente {
      border-left: 4px solid #3b82f6; /* blue-500 */
    }
    
    .lista-card.una_vez {
      border-left: 4px solid #a855f7; /* purple-500 */
    }
    
    .lista-header {
      display: flex;
      justify-content: space-between;
      align-items: start;
      margin-bottom: 15px;
    }
    
    .lista-nombre {
      font-size: 18px;
      font-weight: 600;
      color: #ffffff; /* white */
      margin-bottom: 5px;
    }
    
    .lista-tipo {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
    }
    
    .lista-tipo.recurrente {
      background: #1e3a8a; /* blue-900 */
      color: #93c5fd; /* blue-300 */
    }
    
    .lista-tipo.una_vez {
      background: #581c87; /* purple-900 */
      color: #c4b5fd; /* purple-300 */
    }
    
    .lista-descripcion {
      color: #94a3b8; /* slate-400 */
      font-size: 14px;
      margin-bottom: 15px;
      min-height: 40px;
    }
    
    .lista-actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }
    
    .items-container {
      margin-top: 20px;
    }
    
    .items-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 2px solid #334155; /* slate-700 */
    }
    
    .items-header h3 {
      color: #ffffff; /* white */
    }
    
    .items-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    
    .item-card {
      background: #0f172a; /* slate-900 */
      border: 1px solid #334155; /* slate-700 */
      border-radius: 6px;
      padding: 8px 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      transition: all 0.2s;
      margin-bottom: 6px;
    }
    
    .item-card:hover {
      box-shadow: 0 2px 8px rgba(79, 70, 229, 0.2);
      border-color: #4f46e5; /* indigo-600 */
      background: #1e293b; /* slate-800 */
    }
    
    .item-card-new {
      background: #1e293b !important;
      border: 2px dashed #475569 !important;
    }
    
    .item-card-new:hover {
      border-color: #64748b !important;
      background: #1e293b !important;
    }
    
    .item-field {
      transition: border-color 0.2s;
      font-size: 13px;
      padding: 5px 8px;
    }
    
    .item-field:focus {
      border-color: #4f46e5;
      outline: none;
      box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.15);
    }
    
    .item-field:hover {
      border-color: #475569;
    }
    
    .item-info {
      flex: 1;
    }
    
    .item-nombre {
      font-weight: 600;
      color: #ffffff; /* white */
      margin-bottom: 5px;
    }
    
    .item-details {
      display: flex;
      gap: 15px;
      font-size: 12px;
      color: #94a3b8; /* slate-400 */
    }
    
    .item-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      background: #1e293b; /* slate-800 */
      color: #cbd5e1; /* slate-200 */
    }
    
    .item-actions {
      display: flex;
      gap: 8px;
    }
    
    .modal {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.7);
      z-index: 1000;
      align-items: center;
      justify-content: center;
    }
    
    .modal.active {
      display: flex;
    }
    
    .modal-content {
      background: #1e293b; /* slate-800 */
      border: 1px solid #334155; /* slate-700 */
      border-radius: 8px;
      padding: 30px;
      max-width: 600px;
      width: 90%;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
    }
    
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    
    .modal-title {
      font-size: 24px;
      font-weight: 600;
      color: #ffffff; /* white */
    }
    
    .close-modal {
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: #94a3b8; /* slate-400 */
    }
    
    .close-modal:hover {
      color: #ffffff; /* white */
    }
    
    .form-group {
      margin-bottom: 20px;
    }
    
    .form-label {
      display: block;
      margin-bottom: 8px;
      font-weight: 500;
      color: #cbd5e1; /* slate-200 */
    }
    
    .form-input,
    .form-select,
    .form-textarea {
      width: 100%;
      padding: 10px;
      border: 1px solid #334155; /* slate-700 */
      border-radius: 6px;
      font-size: 14px;
      font-family: inherit;
      background: #0f172a; /* slate-900 */
      color: #ffffff; /* white */
    }
    
    .form-input:focus,
    .form-select:focus,
    .form-textarea:focus {
      outline: none;
      border-color: #4f46e5; /* indigo-600 */
      box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
    }
    
    .form-textarea {
      min-height: 100px;
      resize: vertical;
    }
    
    .form-actions {
      display: flex;
      gap: 10px;
      justify-content: flex-end;
      margin-top: 30px;
    }
    
    .loading {
      text-align: center;
      padding: 20px;
      color: #94a3b8; /* slate-400 */
    }
    
    .empty-state {
      text-align: center;
      padding: 40px;
      color: #64748b; /* slate-500 */
    }
    
    .empty-state p {
      color: #64748b; /* slate-500 */
    }
    
    .empty-state-icon {
      font-size: 48px;
      margin-bottom: 15px;
    }
    
    /* Tabs principales */
    .main-tabs {
      display: flex;
      gap: 10px;
      margin-bottom: 20px;
      border-bottom: 2px solid #334155;
      padding-bottom: 0;
    }
    
    .main-tab {
      padding: 12px 24px;
      background: transparent;
      border: none;
      border-bottom: 3px solid transparent;
      color: #94a3b8;
      font-size: 16px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      position: relative;
      top: 2px;
    }
    
    .main-tab:hover {
      color: #cbd5e1;
    }
    
    .main-tab.active {
      color: #ffffff;
      border-bottom-color: #4f46e5;
    }
    
    .main-tab-content {
      display: none;
    }
    
    .main-tab-content.active {
      display: block;
    }
    
    /* Subtabs (listas) */
    .sub-tabs {
      display: flex;
      gap: 8px;
      margin-bottom: 20px;
      flex-wrap: wrap;
      border-bottom: 1px solid #334155;
      padding-bottom: 10px;
    }
    
    .sub-tab {
      padding: 8px 16px;
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 6px 6px 0 0;
      color: #94a3b8;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s;
      position: relative;
      bottom: -1px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    
    .sub-tab:hover {
      background: #1e293b;
      color: #cbd5e1;
      border-color: #475569;
    }
    
    .sub-tab.active {
      background: #1e293b;
      color: #ffffff;
      border-color: #4f46e5;
      border-bottom-color: #1e293b;
    }
    
    .sub-tab-close {
      background: transparent;
      border: none;
      color: #64748b;
      cursor: pointer;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 16px;
      line-height: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
      opacity: 0.6;
    }
    
    .sub-tab-close:hover {
      background: rgba(239, 68, 68, 0.2);
      color: #ef4444;
      opacity: 1;
    }
    
    .sub-tab-content {
      display: none;
    }
    
    .sub-tab-content.active {
      display: block;
    }
    
    .sub-tab-actions {
      display: flex;
      gap: 10px;
      align-items: center;
      margin-left: auto;
    }
    
    .sub-tab-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    
    .items-section {
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 8px;
      padding: 16px;
    }
    
    .items-header {
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid #334155;
    }
    
    .items-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔮 Transmutaciones Energéticas</h1>
    
    <!-- Tabs principales -->
    <div class="main-tabs">
      <button class="main-tab active" onclick="cambiarTabPrincipal('recurrente', this)">
        🔄 Limpiezas Recurrentes
      </button>
      <button class="main-tab" onclick="cambiarTabPrincipal('una_vez', this)">
        ⚡ Limpiezas de Una Sola Vez
      </button>
    </div>
    
    <!-- Contenido Tab Recurrente -->
    <div id="tabRecurrente" class="main-tab-content active">
      <div class="sub-tab-header">
        <div class="sub-tabs" id="subTabsRecurrente">
          <!-- Se llenará dinámicamente -->
        </div>
        <div class="sub-tab-actions">
          <button class="btn btn-primary btn-small" onclick="abrirModalCrearLista('recurrente')">
            ➕ Nueva Lista
          </button>
        </div>
      </div>
      <div id="contenidoRecurrente">
        <!-- Se llenará dinámicamente -->
      </div>
    </div>
    
    <!-- Contenido Tab Una Sola Vez -->
    <div id="tabUnaVez" class="main-tab-content">
      <div class="sub-tab-header">
        <div class="sub-tabs" id="subTabsUnaVez">
          <!-- Se llenará dinámicamente -->
        </div>
        <div class="sub-tab-actions">
          <button class="btn btn-primary btn-small" onclick="abrirModalCrearLista('una_vez')">
            ➕ Nueva Lista
          </button>
        </div>
      </div>
      <div id="contenidoUnaVez">
        <!-- Se llenará dinámicamente -->
      </div>
    </div>
  </div>
  
  <!-- Modal Crear/Editar Lista -->
  <div class="modal" id="modalLista">
    <div class="modal-content">
      <div class="modal-header">
        <h2 class="modal-title" id="modalListaTitulo">Crear Lista</h2>
        <button class="close-modal" onclick="cerrarModal('modalLista')">&times;</button>
      </div>
      <form id="formLista" onsubmit="guardarLista(event)">
        <div class="form-group">
          <label class="form-label">Nombre *</label>
          <input type="text" class="form-input" name="nombre" required>
        </div>
        <div class="form-group">
          <label class="form-label">Tipo *</label>
          <select class="form-select" name="tipo" required>
            <option value="recurrente">Recurrente</option>
            <option value="una_vez">Una Sola Vez</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Descripción</label>
          <textarea class="form-textarea" name="descripcion"></textarea>
        </div>
        <input type="hidden" name="id" id="listaId">
        <div class="form-actions">
          <button type="button" class="btn" onclick="cerrarModal('modalLista')">Cancelar</button>
          <button type="submit" class="btn btn-primary">Guardar</button>
        </div>
      </form>
    </div>
  </div>
  
  <!-- Modal Crear/Editar Ítem -->
  <div class="modal" id="modalItem">
    <div class="modal-content">
      <div class="modal-header">
        <h2 class="modal-title" id="modalItemTitulo">Crear Ítem</h2>
        <button class="close-modal" onclick="cerrarModal('modalItem')">&times;</button>
      </div>
      <form id="formItem" onsubmit="guardarItem(event)">
        <div class="form-group">
          <label class="form-label">Nombre *</label>
          <input type="text" class="form-input" name="nombre" required>
        </div>
        <div class="form-group">
          <label class="form-label">Descripción</label>
          <textarea class="form-textarea" name="descripcion"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Nivel</label>
          <input type="number" class="form-input" name="nivel" value="9" min="1">
        </div>
        <div class="form-group" id="frecuenciaGroup">
          <label class="form-label">Frecuencia (días)</label>
          <input type="number" class="form-input" name="frecuencia_dias" value="20" min="1">
        </div>
        <div class="form-group" id="vecesGroup" style="display: none;">
          <label class="form-label">Veces que hay que limpiar</label>
          <input type="number" class="form-input" name="veces_limpiar" value="15" min="1">
        </div>
        <input type="hidden" name="lista_id" id="itemListaId">
        <input type="hidden" name="id" id="itemId">
        <div class="form-actions">
          <button type="button" class="btn" onclick="cerrarModal('modalItem')">Cancelar</button>
          <button type="submit" class="btn btn-primary">Guardar</button>
        </div>
      </form>
    </div>
  </div>
  
  <!-- Modal Ver por Alumnos -->
  <div class="modal" id="modalAlumnos">
    <div class="modal-content" style="max-width: 900px;">
      <div class="modal-header">
        <h2 class="modal-title" id="modalAlumnosTitulo">Estado por Alumnos</h2>
        <button class="close-modal" onclick="cerrarModal('modalAlumnos')">&times;</button>
      </div>
      <div id="alumnosContent">
        <div class="loading">Cargando...</div>
      </div>
    </div>
  </div>
  
  <script>
    // Silenciar errores de extensiones del navegador
    window.addEventListener('error', function(e) {
      if (e.message && (
        e.message.includes('message channel closed') ||
        e.message.includes('asynchronous response') ||
        e.message.includes('Extension context invalidated')
      )) {
        e.preventDefault();
        return true;
      }
    });
    
    window.addEventListener('unhandledrejection', function(e) {
      if (e.reason && (
        (typeof e.reason === 'string' && (
          e.reason.includes('message channel closed') ||
          e.reason.includes('asynchronous response') ||
          e.reason.includes('Extension context invalidated')
        )) ||
        (e.reason && e.reason.message && (
          e.reason.message.includes('message channel closed') ||
          e.reason.message.includes('asynchronous response') ||
          e.reason.message.includes('Extension context invalidated')
        ))
      )) {
        e.preventDefault();
        return true;
      }
    });
    
    const API_BASE = '/api/transmutaciones';
    let listasData = [];
    
    // Obtener password de la URL
    const urlParams = new URLSearchParams(window.location.search);
    let password = urlParams.get('password') || '';
    
    // Si no hay password en la URL, intentar obtenerlo del hash
    if (!password) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const hashPassword = hashParams.get('password');
      if (hashPassword) {
        window.location.search = '?password=' + encodeURIComponent(hashPassword);
        // No hacer return aquí, dejar que la página se recargue
      }
    }
    
    // Función helper para hacer fetch con autenticación
    async function fetchWithAuth(url, options = {}) {
      try {
        // Construir URL completa usando URL API
        let urlObj;
        if (url.startsWith('http://') || url.startsWith('https://')) {
          urlObj = new URL(url);
        } else {
          urlObj = new URL(url, window.location.origin);
        }
        
        // Agregar password a la URL si no está ya presente
        if (password && !urlObj.searchParams.has('password')) {
          urlObj.searchParams.set('password', password);
        }
        
        // Debug: mostrar URL en consola (solo en desarrollo)
        if (window.location.hostname === 'localhost' || window.location.hostname.includes('localhost')) {
          console.log('🔐 Fetch con auth:', urlObj.toString().replace(/password=[^&]*/, 'password=***'));
        }
        
        // Headers por defecto
        const headers = {
          'Content-Type': 'application/json',
          ...(options.headers || {})
        };
        
        return fetch(urlObj.toString(), {
          ...options,
          credentials: 'include', // Incluir cookies para autenticación
          headers
        });
      } catch (error) {
        console.error('Error en fetchWithAuth:', error);
        // Fallback: construir URL manualmente
        let fullUrl = url.startsWith('/') ? url : '/' + url;
        const separator = fullUrl.includes('?') ? '&' : '?';
        if (password) {
          fullUrl = fullUrl + separator + 'password=' + encodeURIComponent(password);
        }
        
        const headers = {
          'Content-Type': 'application/json',
          ...(options.headers || {})
        };
        
        return fetch(fullUrl, {
          ...options,
          headers
        });
      }
    }
    
    // Cargar listas al iniciar
    document.addEventListener('DOMContentLoaded', () => {
      cargarListas();
      
      // Actualizar campos según tipo de lista
      document.querySelector('#modalLista select[name="tipo"]').addEventListener('change', (e) => {
        const tipo = e.target.value;
        const frecuenciaGroup = document.getElementById('frecuenciaGroup');
        const vecesGroup = document.getElementById('vecesGroup');
        
        if (tipo === 'recurrente') {
          frecuenciaGroup.style.display = 'block';
          vecesGroup.style.display = 'none';
        } else {
          frecuenciaGroup.style.display = 'none';
          vecesGroup.style.display = 'block';
        }
      });
    });
    
    async function cargarListas() {
      try {
        const response = await fetchWithAuth(API_BASE + '/listas');
        const data = await response.json();
        
        if (data.success) {
          listasData = data.data.listas;
          renderListas();
        } else {
          mostrarError('Error cargando listas: ' + data.error);
        }
      } catch (error) {
        mostrarError('Error: ' + error.message);
      }
    }
    
    let tabPrincipalActual = 'recurrente';
    let listaActivaRecurrente = null;
    let listaActivaUnaVez = null;
    
    async function renderListas() {
      // Separar listas por tipo
      const listasRecurrentes = listasData.filter(l => l.tipo === 'recurrente');
      const listasUnaVez = listasData.filter(l => l.tipo === 'una_vez');
      
      // Renderizar subtabs y contenido para recurrentes
      renderSubTabs('recurrente', listasRecurrentes);
      renderContenidoLista('recurrente', listasRecurrentes);
      
      // Renderizar subtabs y contenido para una vez
      renderSubTabs('una_vez', listasUnaVez);
      renderContenidoLista('una_vez', listasUnaVez);
    }
    
    function renderSubTabs(tipo, listas) {
      const container = document.getElementById(\`subTabs\${tipo === 'recurrente' ? 'Recurrente' : 'UnaVez'}\`);
      if (!container) return;
      
      if (listas.length === 0) {
        container.innerHTML = '';
        return;
      }
      
      let html = '';
      const listaActiva = tipo === 'recurrente' ? listaActivaRecurrente : listaActivaUnaVez;
      const primeraLista = listas[0];
      const listaSeleccionada = listaActiva || primeraLista?.id;
      
      for (const lista of listas) {
        const isActive = lista.id === listaSeleccionada;
        html += \`
          <button class="sub-tab \${isActive ? 'active' : ''}" onclick="cambiarSubTab(\${lista.id}, '\${tipo}')">
            <span>\${lista.nombre}</span>
            <button class="sub-tab-close" onclick="event.stopPropagation(); eliminarLista(\${lista.id})" title="Eliminar lista">✕</button>
          </button>
        \`;
      }
      
      container.innerHTML = html;
      
      // Si no hay lista activa, activar la primera
      if (!listaActiva && listas.length > 0) {
        cambiarSubTab(primeraLista.id, tipo);
      }
    }
    
    function renderContenidoLista(tipo, listas) {
      const container = document.getElementById(\`contenido\${tipo === 'recurrente' ? 'Recurrente' : 'UnaVez'}\`);
      if (!container) return;
      
      const listaActiva = tipo === 'recurrente' ? listaActivaRecurrente : listaActivaUnaVez;
      
      if (listas.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📋</div><p>No hay listas creadas aún. Crea una nueva lista para comenzar.</p></div>';
        return;
      }
      
      if (!listaActiva) {
        container.innerHTML = '<div class="empty-state"><p>Selecciona una lista</p></div>';
        return;
      }
      
      const lista = listas.find(l => l.id === listaActiva);
      if (!lista) {
        container.innerHTML = '<div class="empty-state"><p>Lista no encontrada</p></div>';
        return;
      }
      
      let html = \`
        <div class="items-section">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #334155;">
            <div>
              <h2 style="color: #ffffff; margin-bottom: 4px; font-size: 18px; font-weight: 600;">\${lista.nombre}</h2>
              <p style="color: #64748b; font-size: 12px;">\${lista.descripcion || 'Sin descripción'}</p>
            </div>
            <div style="display: flex; gap: 8px;">
              <button class="btn btn-small btn-primary" onclick="abrirModalEditarLista(\${lista.id})" style="padding: 6px 12px; font-size: 12px;">✏️ Editar</button>
            </div>
          </div>
          <div id="items-\${lista.id}">
            <div class="loading">Cargando ítems...</div>
          </div>
        </div>
      \`;
      
      container.innerHTML = html;
      
      // Esperar a que el DOM se actualice antes de cargar ítems
      setTimeout(() => {
        const itemsContainer = document.getElementById(\`items-\${lista.id}\`);
        if (itemsContainer) {
          verItems(lista.id);
        }
      }, 50);
    }
    
    function cambiarTabPrincipal(tipo, eventElement) {
      tabPrincipalActual = tipo;
      
      // Actualizar tabs principales
      document.querySelectorAll('.main-tab').forEach(tab => tab.classList.remove('active'));
      if (eventElement) {
        eventElement.classList.add('active');
      } else {
        // Si no se pasa el elemento, buscar por tipo
        document.querySelectorAll('.main-tab').forEach(tab => {
          if ((tipo === 'recurrente' && tab.textContent.includes('Recurrentes')) ||
              (tipo === 'una_vez' && tab.textContent.includes('Una Sola Vez'))) {
            tab.classList.add('active');
          }
        });
      }
      
      // Mostrar/ocultar contenido
      document.getElementById('tabRecurrente').classList.toggle('active', tipo === 'recurrente');
      document.getElementById('tabUnaVez').classList.toggle('active', tipo === 'una_vez');
      
      // Si no hay lista activa en el tab, activar la primera
      const listas = tipo === 'recurrente' 
        ? listasData.filter(l => l.tipo === 'recurrente')
        : listasData.filter(l => l.tipo === 'una_vez');
      
      if (listas.length > 0) {
        const listaActiva = tipo === 'recurrente' ? listaActivaRecurrente : listaActivaUnaVez;
        if (!listaActiva) {
          cambiarSubTab(listas[0].id, tipo);
        } else {
          renderContenidoLista(tipo, listas);
        }
      } else {
        renderContenidoLista(tipo, listas);
      }
    }
    
    function cambiarSubTab(listaId, tipo) {
      if (tipo === 'recurrente') {
        listaActivaRecurrente = listaId;
      } else {
        listaActivaUnaVez = listaId;
      }
      
      // Actualizar subtabs
      const container = document.getElementById(\`subTabs\${tipo === 'recurrente' ? 'Recurrente' : 'UnaVez'}\`);
      if (container) {
        container.querySelectorAll('.sub-tab').forEach(tab => {
          tab.classList.remove('active');
          if (tab.textContent.includes(listasData.find(l => l.id === listaId)?.nombre || '')) {
            tab.classList.add('active');
          }
        });
      }
      
      // Renderizar contenido
      const listas = tipo === 'recurrente' 
        ? listasData.filter(l => l.tipo === 'recurrente')
        : listasData.filter(l => l.tipo === 'una_vez');
      
      renderContenidoLista(tipo, listas);
    }
    
    async function verItems(listaId) {
      const container = document.getElementById(\`items-\${listaId}\`);
      if (!container) {
        console.warn('Contenedor no encontrado para lista:', listaId, '- Esperando...');
        // Reintentar después de un breve delay
        setTimeout(() => {
          const retryContainer = document.getElementById(\`items-\${listaId}\`);
          if (retryContainer) {
            verItems(listaId);
          }
        }, 100);
        return;
      }
      
      try {
        const response = await fetchWithAuth(API_BASE + \`/listas/\${listaId}/items\`);
        const data = await response.json();
        
        if (data.success && data.data && data.data.items) {
          renderItems(listaId, data.data.items);
        } else {
          container.innerHTML = '<div class="empty-state">Error cargando ítems: ' + (data.error || 'Datos inválidos') + '</div>';
        }
      } catch (error) {
        container.innerHTML = '<div class="empty-state">Error: ' + error.message + '</div>';
      }
    }
    
    function renderItems(listaId, items) {
      const container = document.getElementById(\`items-\${listaId}\`);
      
      if (!container) {
        console.error('Contenedor no encontrado para lista:', listaId);
        return;
      }
      
      const lista = listasData.find(l => l.id === listaId);
      const tipoLista = lista?.tipo || 'recurrente';
      
      let html = '<div class="items-header"><h3>Ítems (ordenados por nivel)</h3></div>';
      
      // Ordenar items por nivel (si hay items)
      let itemsOrdenados = [];
      if (items && Array.isArray(items) && items.length > 0) {
        itemsOrdenados = [...items].sort((a, b) => {
          if (a.nivel !== b.nivel) {
            return a.nivel - b.nivel;
          }
          return a.nombre.localeCompare(b.nombre);
        });
      }
      
      // Formulario inline para crear nuevo ítem
      html += \`
        <div class="item-card item-card-new" style="margin-bottom: 10px;">
          <div class="item-info" style="flex: 1; display: grid; grid-template-columns: 70px 1fr 1fr 120px; gap: 10px; align-items: center;">
            <!-- Nivel -->
            <div>
              <label style="display: block; font-size: 10px; color: #64748b; margin-bottom: 3px; text-transform: uppercase; letter-spacing: 0.5px;">Nivel</label>
              <input type="number" 
                     id="newItemNivel"
                     class="form-input item-field" 
                     value="9" 
                     min="1" 
                     style="width: 55px; padding: 4px 6px; font-size: 12px;">
            </div>
            
            <!-- Nombre -->
            <div>
              <label style="display: block; font-size: 10px; color: #64748b; margin-bottom: 3px; text-transform: uppercase; letter-spacing: 0.5px;">Nombre *</label>
              <input type="text" 
                     id="newItemNombre"
                     class="form-input item-field" 
                     style="width: 100%; padding: 4px 6px; font-size: 12px;"
                     placeholder="Nombre del ítem"
                     onkeydown="if(event.key === 'Enter') { event.preventDefault(); crearItemRapido(\${listaId}); }">
            </div>
            
            <!-- Descripción -->
            <div>
              <label style="display: block; font-size: 10px; color: #64748b; margin-bottom: 3px; text-transform: uppercase; letter-spacing: 0.5px;">Descripción</label>
              <input type="text" 
                     id="newItemDescripcion"
                     class="form-input item-field" 
                     style="width: 100%; padding: 4px 6px; font-size: 12px;"
                     placeholder="Descripción"
                     onkeydown="if(event.key === 'Enter') { event.preventDefault(); crearItemRapido(\${listaId}); }">
            </div>
            
            <!-- Frecuencia o Veces -->
            <div>
              <label style="display: block; font-size: 10px; color: #64748b; margin-bottom: 3px; text-transform: uppercase; letter-spacing: 0.5px;">
                \${tipoLista === 'recurrente' ? 'Frecuencia' : 'Veces'}
              </label>
              <input type="number" 
                     id="newItemFrecuencia"
                     class="form-input item-field" 
                     value="\${tipoLista === 'recurrente' ? '20' : '15'}" 
                     min="1" 
                     style="width: 100%; padding: 4px 6px; font-size: 12px;"
                     onkeydown="if(event.key === 'Enter') { event.preventDefault(); crearItemRapido(\${listaId}); }">
            </div>
          </div>
          <div class="item-actions" style="display: flex; gap: 6px; align-items: center;">
            <button class="btn btn-small btn-primary" onclick="crearItemRapido(\${listaId})" title="Crear ítem" style="padding: 6px 12px; font-size: 12px;">➕</button>
          </div>
        </div>
      \`;
      
      html += '<div class="items-list">';
      
      // Mostrar items si hay
      if (itemsOrdenados.length > 0) {
        for (const item of itemsOrdenados) {
        html += \`
          <div class="item-card" data-item-id="\${item.id}">
            <div class="item-info" style="flex: 1; display: grid; grid-template-columns: 70px 1fr 1fr 120px; gap: 10px; align-items: center;">
              <!-- Nivel -->
              <div>
                <label style="display: block; font-size: 10px; color: #64748b; margin-bottom: 3px; text-transform: uppercase; letter-spacing: 0.5px;">Nivel</label>
                <input type="number" 
                       class="form-input item-field" 
                       data-field="nivel" 
                       data-item-id="\${item.id}"
                       value="\${item.nivel}" 
                       min="1" 
                       style="width: 55px; padding: 4px 6px; font-size: 12px;"
                       onchange="guardarCampoItem(\${item.id}, 'nivel', this.value)">
              </div>
              
              <!-- Nombre -->
              <div>
                <label style="display: block; font-size: 10px; color: #64748b; margin-bottom: 3px; text-transform: uppercase; letter-spacing: 0.5px;">Nombre</label>
                <input type="text" 
                       class="form-input item-field" 
                       data-field="nombre" 
                       data-item-id="\${item.id}"
                       value="\${item.nombre || ''}" 
                       style="width: 100%; padding: 4px 6px; font-size: 12px;"
                       onblur="guardarCampoItem(\${item.id}, 'nombre', this.value)">
              </div>
              
              <!-- Descripción -->
              <div>
                <label style="display: block; font-size: 10px; color: #64748b; margin-bottom: 3px; text-transform: uppercase; letter-spacing: 0.5px;">Descripción</label>
                <input type="text" 
                       class="form-input item-field" 
                       data-field="descripcion" 
                       data-item-id="\${item.id}"
                       value="\${item.descripcion || ''}" 
                       style="width: 100%; padding: 4px 6px; font-size: 12px;"
                       onblur="guardarCampoItem(\${item.id}, 'descripcion', this.value)">
              </div>
              
              <!-- Frecuencia o Veces -->
              <div>
                <label style="display: block; font-size: 10px; color: #64748b; margin-bottom: 3px; text-transform: uppercase; letter-spacing: 0.5px;">
                  \${tipoLista === 'recurrente' ? 'Frecuencia' : 'Veces'}
                </label>
                <input type="number" 
                       class="form-input item-field" 
                       data-field="\${tipoLista === 'recurrente' ? 'frecuencia_dias' : 'veces_limpiar'}" 
                       data-item-id="\${item.id}"
                       value="\${tipoLista === 'recurrente' ? (item.frecuencia_dias || 20) : (item.veces_limpiar || 15)}" 
                       min="1" 
                       style="width: 100%; padding: 4px 6px; font-size: 12px;"
                       onchange="guardarCampoItem(\${item.id}, '\${tipoLista === 'recurrente' ? 'frecuencia_dias' : 'veces_limpiar'}', this.value)">
              </div>
            </div>
            <div class="item-actions" style="display: flex; gap: 6px; align-items: center;">
              <button class="btn btn-small btn-success" onclick="limpiarParaTodos(\${item.id})" title="Limpiar para todos" style="padding: 5px 10px; font-size: 11px;">✨</button>
              <button class="btn btn-small" onclick="verPorAlumnos(\${item.id})" title="Ver alumnos" style="padding: 5px 10px; font-size: 11px;">👥</button>
              <button class="btn btn-small btn-danger" onclick="eliminarItem(\${item.id})" title="Eliminar" style="padding: 5px 10px; font-size: 11px;">🗑️</button>
            </div>
          </div>
        \`;
        }
      } else {
        // Si no hay items, mostrar mensaje
        html += '<div class="empty-state" style="padding: 20px; text-align: center; color: #64748b;"><p>Crea tu primer ítem arriba 👆</p></div>';
      }
      
      html += '</div>';
      container.innerHTML = html;
    }
    
    async function crearItemRapido(listaId) {
      // Buscar los campos en el contenedor correcto
      const container = document.getElementById(\`items-\${listaId}\`);
      if (!container) {
        console.error('Contenedor no encontrado para lista:', listaId);
        alert('Error: No se pudo encontrar el formulario. Por favor, recarga la página.');
        return;
      }
      
      const nombreInput = container.querySelector('#newItemNombre');
      const descripcionInput = container.querySelector('#newItemDescripcion');
      const nivelInput = container.querySelector('#newItemNivel');
      const frecuenciaInput = container.querySelector('#newItemFrecuencia');
      
      if (!nombreInput || !nivelInput || !frecuenciaInput) {
        alert('Error: Campos del formulario no encontrados');
        return;
      }
      
      const nombre = nombreInput.value?.trim();
      const descripcion = descripcionInput?.value?.trim() || '';
      const nivel = parseInt(nivelInput.value) || 9;
      const frecuencia = parseInt(frecuenciaInput.value) || 20;
      
      if (!nombre || nombre.length === 0) {
        alert('El nombre es requerido');
        nombreInput.focus();
        return;
      }
      
      const lista = listasData.find(l => l.id === listaId);
      if (!lista) {
        alert('Lista no encontrada');
        return;
      }
      
      const datos = {
        lista_id: listaId,
        nombre: nombre,
        descripcion: descripcion,
        nivel: nivel
      };
      
      if (lista.tipo === 'recurrente') {
        datos.frecuencia_dias = frecuencia;
      } else {
        datos.veces_limpiar = frecuencia;
      }
      
      // Deshabilitar el formulario mientras se guarda
      nombreInput.disabled = true;
      if (descripcionInput) descripcionInput.disabled = true;
      nivelInput.disabled = true;
      frecuenciaInput.disabled = true;
      
      try {
        const response = await fetchWithAuth(\`\${API_BASE}/items\`, {
          method: 'POST',
          body: JSON.stringify(datos)
        });
        
        const data = await response.json();
        
        if (data.success) {
          // Limpiar formulario
          nombreInput.value = '';
          if (descripcionInput) descripcionInput.value = '';
          nivelInput.value = '9';
          frecuenciaInput.value = lista.tipo === 'recurrente' ? '20' : '15';
          
          // Habilitar el formulario
          nombreInput.disabled = false;
          if (descripcionInput) descripcionInput.disabled = false;
          nivelInput.disabled = false;
          frecuenciaInput.disabled = false;
          
          // Recargar ítems de forma asíncrona sin bloquear
          verItems(listaId).then(() => {
            // Enfocar en el campo nombre para crear otro rápidamente
            requestAnimationFrame(() => {
              const newContainer = document.getElementById(\`items-\${listaId}\`);
              if (newContainer) {
                const newNombreInput = newContainer.querySelector('#newItemNombre');
                if (newNombreInput) {
                  newNombreInput.focus();
                }
              }
            });
          });
        } else {
          alert('Error: ' + data.error);
          // Rehabilitar el formulario en caso de error
          nombreInput.disabled = false;
          if (descripcionInput) descripcionInput.disabled = false;
          nivelInput.disabled = false;
          frecuenciaInput.disabled = false;
        }
      } catch (error) {
        alert('Error: ' + error.message);
        // Rehabilitar el formulario en caso de error
        nombreInput.disabled = false;
        if (descripcionInput) descripcionInput.disabled = false;
        nivelInput.disabled = false;
        frecuenciaInput.disabled = false;
      }
    }
    
    async function guardarCampoItem(itemId, campo, valor) {
      try {
        // Obtener el item actual
        const response = await fetchWithAuth(\`\${API_BASE}/items/\${itemId}\`);
        const data = await response.json();
        
        if (!data.success || !data.data.item) {
          alert('Error obteniendo datos del ítem');
          return;
        }
        
        const item = data.data.item;
        
        // Preparar datos para actualizar
        const datos = {
          nombre: item.nombre,
          descripcion: item.descripcion,
          nivel: item.nivel,
          frecuencia_dias: item.frecuencia_dias,
          veces_limpiar: item.veces_limpiar
        };
        
        // Actualizar el campo modificado
        if (campo === 'nivel') {
          datos.nivel = parseInt(valor) || 9;
        } else if (campo === 'nombre') {
          datos.nombre = valor.trim();
        } else if (campo === 'descripcion') {
          datos.descripcion = valor.trim();
        } else if (campo === 'frecuencia_dias') {
          datos.frecuencia_dias = parseInt(valor) || 20;
        } else if (campo === 'veces_limpiar') {
          datos.veces_limpiar = parseInt(valor) || 15;
        }
        
        // Guardar cambios
        const updateResponse = await fetchWithAuth(\`\${API_BASE}/items/\${itemId}\`, {
          method: 'PUT',
          body: JSON.stringify(datos)
        });
        
        const updateData = await updateResponse.json();
        
        if (updateData.success) {
          // Si cambió el nivel, reordenar los items
          if (campo === 'nivel') {
            const listaId = item.lista_id;
            verItems(listaId);
          } else {
            // Mostrar feedback visual
            const input = document.querySelector(\`[data-item-id="\${itemId}"][data-field="\${campo}"]\`);
            if (input) {
              input.style.borderColor = '#10b981';
              setTimeout(() => {
                input.style.borderColor = '#334155';
              }, 500);
            }
          }
        } else {
          alert('Error guardando: ' + updateData.error);
          // Recargar para restaurar valor original
          const listaId = item.lista_id;
          verItems(listaId);
        }
      } catch (error) {
        alert('Error: ' + error.message);
      }
    }
    
    function abrirModalCrearLista(tipo = null) {
      document.getElementById('modalListaTitulo').textContent = 'Crear Lista';
      document.getElementById('formLista').reset();
      document.getElementById('listaId').value = '';
      
      // Si se especifica un tipo, establecerlo
      if (tipo) {
        document.querySelector('#formLista select[name="tipo"]').value = tipo;
      }
      
      document.getElementById('modalLista').classList.add('active');
    }
    
    function abrirModalEditarLista(id) {
      const lista = listasData.find(l => l.id === id);
      if (!lista) return;
      
      document.getElementById('modalListaTitulo').textContent = 'Editar Lista';
      document.querySelector('#formLista input[name="nombre"]').value = lista.nombre;
      document.querySelector('#formLista select[name="tipo"]').value = lista.tipo;
      document.querySelector('#formLista textarea[name="descripcion"]').value = lista.descripcion || '';
      document.getElementById('listaId').value = id;
      document.getElementById('modalLista').classList.add('active');
    }
    
    async function guardarLista(event) {
      event.preventDefault();
      const form = event.target;
      const formData = new FormData(form);
      const datos = Object.fromEntries(formData);
      const id = datos.id;
      
      const url = id ? \`\${API_BASE}/listas/\${id}\` : \`\${API_BASE}/listas\`;
      const method = id ? 'PUT' : 'POST';
      
      try {
        const response = await fetchWithAuth(url, {
          method,
          body: JSON.stringify(datos)
        });
        
        const data = await response.json();
        
        if (data.success) {
          cerrarModal('modalLista');
          await cargarListas();
          
          // Activar el tab correspondiente y la nueva lista
          const nuevaLista = data.data.lista;
          if (nuevaLista.tipo === 'recurrente') {
            cambiarTabPrincipal('recurrente', null);
            cambiarSubTab(nuevaLista.id, 'recurrente');
          } else {
            cambiarTabPrincipal('una_vez', null);
            cambiarSubTab(nuevaLista.id, 'una_vez');
          }
        } else {
          alert('Error: ' + data.error);
        }
      } catch (error) {
        alert('Error: ' + error.message);
      }
    }
    
    async function eliminarLista(id) {
      if (!confirm('¿Estás seguro de eliminar esta lista? Se eliminarán todos sus ítems.')) return;
      
      // Obtener el tipo de la lista antes de eliminarla
      const lista = listasData.find(l => l.id === id);
      const tipo = lista?.tipo;
      
      try {
        const response = await fetchWithAuth(\`\${API_BASE}/listas/\${id}\`, { method: 'DELETE' });
        const data = await response.json();
        
        if (data.success) {
          // Limpiar lista activa si se eliminó
          if (tipo === 'recurrente' && listaActivaRecurrente === id) {
            listaActivaRecurrente = null;
          } else if (tipo === 'una_vez' && listaActivaUnaVez === id) {
            listaActivaUnaVez = null;
          }
          
          await cargarListas();
          
          // Si se eliminó la lista activa, activar otra o mostrar empty state
          if (tipo) {
            const listas = listasData.filter(l => l.tipo === tipo);
            if (listas.length > 0) {
              cambiarSubTab(listas[0].id, tipo);
            } else {
              renderContenidoLista(tipo, []);
            }
          }
        } else {
          alert('Error: ' + data.error);
        }
      } catch (error) {
        alert('Error: ' + error.message);
      }
    }
    
    function abrirModalCrearItem(listaId) {
      const lista = listasData.find(l => l.id === listaId);
      if (!lista) return;
      
      document.getElementById('modalItemTitulo').textContent = 'Crear Ítem';
      document.getElementById('formItem').reset();
      document.getElementById('itemId').value = '';
      document.getElementById('itemListaId').value = listaId;
      document.querySelector('#formItem input[name="nivel"]').value = 9;
      document.querySelector('#formItem input[name="frecuencia_dias"]').value = 20;
      document.querySelector('#formItem input[name="veces_limpiar"]').value = 15;
      
      const frecuenciaGroup = document.getElementById('frecuenciaGroup');
      const vecesGroup = document.getElementById('vecesGroup');
      if (lista.tipo === 'recurrente') {
        frecuenciaGroup.style.display = 'block';
        vecesGroup.style.display = 'none';
      } else {
        frecuenciaGroup.style.display = 'none';
        vecesGroup.style.display = 'block';
      }
      
      document.getElementById('modalItem').classList.add('active');
    }
    
    async function abrirModalEditarItem(itemId, listaId) {
      try {
        const response = await fetchWithAuth(\`\${API_BASE}/items/\${itemId}\`);
        const data = await response.json();
        
        if (data.success) {
          const item = data.data.item;
          const lista = listasData.find(l => l.id === listaId);
          
          document.getElementById('modalItemTitulo').textContent = 'Editar Ítem';
          document.querySelector('#formItem input[name="nombre"]').value = item.nombre;
          document.querySelector('#formItem textarea[name="descripcion"]').value = item.descripcion || '';
          document.querySelector('#formItem input[name="nivel"]').value = item.nivel;
          document.querySelector('#formItem input[name="frecuencia_dias"]').value = item.frecuencia_dias || 20;
          document.querySelector('#formItem input[name="veces_limpiar"]').value = item.veces_limpiar || 15;
          document.getElementById('itemId').value = itemId;
          document.getElementById('itemListaId').value = listaId;
          
          const frecuenciaGroup = document.getElementById('frecuenciaGroup');
          const vecesGroup = document.getElementById('vecesGroup');
          if (lista?.tipo === 'recurrente') {
            frecuenciaGroup.style.display = 'block';
            vecesGroup.style.display = 'none';
          } else {
            frecuenciaGroup.style.display = 'none';
            vecesGroup.style.display = 'block';
          }
          
          document.getElementById('modalItem').classList.add('active');
        } else {
          alert('Error cargando ítem: ' + data.error);
        }
      } catch (error) {
        alert('Error: ' + error.message);
      }
    }
    
    async function guardarItem(event) {
      event.preventDefault();
      const form = event.target;
      const formData = new FormData(form);
      const datos = Object.fromEntries(formData);
      const id = datos.id;
      const listaId = datos.lista_id;
      
      // Convertir números
      if (datos.nivel) datos.nivel = parseInt(datos.nivel);
      if (datos.frecuencia_dias) datos.frecuencia_dias = parseInt(datos.frecuencia_dias);
      if (datos.veces_limpiar) datos.veces_limpiar = parseInt(datos.veces_limpiar);
      
      const url = id ? \`\${API_BASE}/items/\${id}\` : \`\${API_BASE}/items\`;
      const method = id ? 'PUT' : 'POST';
      
      try {
        const response = await fetchWithAuth(url, {
          method,
          body: JSON.stringify(datos)
        });
        
        const data = await response.json();
        
        if (data.success) {
          cerrarModal('modalItem');
          // Recargar los ítems de la lista
          verItems(listaId);
        } else {
          alert('Error: ' + data.error);
        }
      } catch (error) {
        alert('Error: ' + error.message);
      }
    }
    
    async function eliminarItem(id) {
      if (!confirm('¿Estás seguro de eliminar este ítem?')) return;
      
      try {
        const response = await fetchWithAuth(\`\${API_BASE}/items/\${id}\`, { method: 'DELETE' });
        const data = await response.json();
        
        if (data.success) {
          await cargarListas();
          
          // Si se eliminó la lista activa, activar otra o mostrar empty state
          const tipo = listasData.find(l => l.id === id)?.tipo;
          if (tipo) {
            const listas = listasData.filter(l => l.tipo === tipo);
            if (listas.length > 0) {
              cambiarSubTab(listas[0].id, tipo);
            } else {
              renderContenidoLista(tipo, []);
            }
          }
        } else {
          alert('Error: ' + data.error);
        }
      } catch (error) {
        alert('Error: ' + error.message);
      }
    }
    
    async function limpiarParaTodos(itemId) {
      if (!confirm('¿Limpiar este ítem para TODOS los suscriptores activos?')) return;
      
      try {
        const response = await fetchWithAuth(\`\${API_BASE}/items/\${itemId}/limpiar-todos\`, { method: 'POST' });
        const data = await response.json();
        
        if (data.success) {
          alert(\`✅ Ítem limpiado para \${data.data.limpiado} alumnos\`);
        } else {
          alert('Error: ' + data.error);
        }
      } catch (error) {
        alert('Error: ' + error.message);
      }
    }
    
    async function verPorAlumnos(itemId) {
      try {
        const response = await fetchWithAuth(\`\${API_BASE}/items/\${itemId}/por-alumnos\`);
        const data = await response.json();
        
        if (data.success && data.data) {
          const estados = data.data;
          const container = document.getElementById('alumnosContent');
          
          // Asegurar que las propiedades existan
          const limpio = estados.limpio || [];
          const pendiente = estados.pendiente || [];
          const pasado = estados.pasado || [];
          
          let html = '<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;">';
          
          // Columna Limpio
          html += '<div><h3 style="color: #10b981; margin-bottom: 15px;">✅ Limpio</h3>';
          if (limpio.length === 0) {
            html += '<p style="color: #64748b;">No hay alumnos</p>';
          } else {
            html += '<ul style="list-style: none; padding: 0;">';
            limpio.forEach(alumno => {
              html += \`<li style="padding: 8px; border-bottom: 1px solid #334155;">
                <strong style="color: #ffffff;">\${alumno.nombre || 'Sin nombre'}</strong><br>
                <small style="color: #94a3b8;">\${alumno.email || ''} - Nivel \${alumno.nivel || 'N/A'}</small>
              </li>\`;
            });
            html += '</ul>';
          }
          html += '</div>';
          
          // Columna Pendiente
          html += '<div><h3 style="color: #f59e0b; margin-bottom: 15px;">⚠️ Pendiente</h3>';
          if (pendiente.length === 0) {
            html += '<p style="color: #64748b;">No hay alumnos</p>';
          } else {
            html += '<ul style="list-style: none; padding: 0;">';
            pendiente.forEach(alumno => {
              html += \`<li style="padding: 8px; border-bottom: 1px solid #334155;">
                <strong style="color: #ffffff;">\${alumno.nombre || 'Sin nombre'}</strong><br>
                <small style="color: #94a3b8;">\${alumno.email || ''} - Nivel \${alumno.nivel || 'N/A'}</small>
              </li>\`;
            });
            html += '</ul>';
          }
          html += '</div>';
          
          // Columna Pasado
          html += '<div><h3 style="color: #ef4444; margin-bottom: 15px;">❌ Pasado</h3>';
          if (pasado.length === 0) {
            html += '<p style="color: #64748b;">No hay alumnos</p>';
          } else {
            html += '<ul style="list-style: none; padding: 0;">';
            pasado.forEach(alumno => {
              html += \`<li style="padding: 8px; border-bottom: 1px solid #334155;">
                <strong style="color: #ffffff;">\${alumno.nombre || 'Sin nombre'}</strong><br>
                <small style="color: #94a3b8;">\${alumno.email || ''} - Nivel \${alumno.nivel || 'N/A'}</small>
              </li>\`;
            });
            html += '</ul>';
          }
          html += '</div>';
          
          html += '</div>';
          container.innerHTML = html;
          document.getElementById('modalAlumnos').classList.add('active');
        } else {
          alert('Error: ' + (data.error || 'No se pudieron obtener los datos de los alumnos'));
        }
      } catch (error) {
        console.error('Error en verPorAlumnos:', error);
        alert('Error: ' + error.message);
      }
    }
    
    function cerrarModal(modalId) {
      document.getElementById(modalId).classList.remove('active');
    }
    
    function mostrarError(mensaje) {
      alert(mensaje);
    }
  </script>
</body>
</html>
    `;
    
    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=UTF-8' }
    });
  } catch (error) {
    console.error('Error en transmutaciones-admin:', error);
    return new Response('Error: ' + error.message, { status: 500 });
  }
}


