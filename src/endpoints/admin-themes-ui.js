// src/endpoints/admin-themes-ui.js
// UI del editor de temas para el admin panel
// FASE 1: Solo UI, NO aplicación de temas

import { renderHtml } from '../core/html-response.js';
import { themeRepository } from '../../database/theme-repository.js';
import { getAllContractVariables } from '../core/theme/theme-contract.js';
import { requireAdminContext } from '../core/auth-context.js';

/**
 * Renderiza la UI del editor de temas
 * 
 * REGLA: Los endpoints no gestionan autenticación; solo consumen contexto.
 * Usa requireAdminContext para obtener el contexto de autenticación admin.
 */
export default async function adminThemesUIHandler(request, env, ctx) {
  // #region agent log
  fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin-themes-ui.js:16',message:'adminThemesUIHandler: inicio',data:{path:request.url},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
  // #endregion
  
  // Obtener contexto de autenticación admin (patrón estándar)
  // Si no está autenticado, requireAdminContext devuelve Response HTML (login)
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    // #region agent log
    fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin-themes-ui.js:20',message:'adminThemesUIHandler: no autenticado',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    // Si no está autenticado, requireAdminContext ya devolvió la respuesta HTML (login)
    return authCtx;
  }
  
  // Si llegamos aquí, el usuario está autenticado como admin
  // authCtx contiene: { user: { isAdmin: true }, isAdmin: true, isAuthenticated: true, request, requestId }

  // Obtener variables del contrato para el editor
  const contractVariables = getAllContractVariables();
  
  // #region agent log
  fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin-themes-ui.js:29',message:'adminThemesUIHandler: autenticado, obteniendo variables',data:{contractVarsCount:contractVariables.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
  // #endregion
  
  // Warm-up: precargar temas de BD en el registry para que estén disponibles para el resolver
  try {
    const { getThemeDefinitionAsync } = await import('../core/theme/theme-registry.js');
    // Precargar todos los temas activos de BD (async, no bloquea)
    // Path relativo desde src/endpoints/ hacia database/
    const { themeRepository } = await import('../../database/theme-repository.js');
    const dbThemes = await themeRepository.findAll({ status: 'active' });
    // #region agent log
    fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin-themes-ui.js:36',message:'adminThemesUIHandler: warm-up carga temas BD',data:{dbThemesCount:dbThemes.length,keys:dbThemes.map(t=>t.key)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    // Pre-cargar cada tema en el registry (esto cachea para el resolver)
    for (const dbTheme of dbThemes) {
      await getThemeDefinitionAsync(dbTheme.key);
    }
  } catch (error) {
    // Fail-open: si falla el warm-up, continuar igual
    console.warn('[AdminThemesUI] Error en warm-up de temas:', error.message);
    // #region agent log
    fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin-themes-ui.js:44',message:'adminThemesUIHandler: warm-up falló',data:{error:error.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
  }
  
  // Agrupar variables por categoría (basado en nombres)
  const variablesByCategory = {
    'Fondos': contractVariables.filter(v => v.startsWith('--bg-')),
    'Textos': contractVariables.filter(v => v.startsWith('--text-')),
    'Bordes': contractVariables.filter(v => v.startsWith('--border-')),
    'Acentos': contractVariables.filter(v => v.startsWith('--accent-')),
    'Sombras': contractVariables.filter(v => v.startsWith('--shadow-')),
    'Gradientes': contractVariables.filter(v => v.startsWith('--gradient-') || v.startsWith('--header-') || v.startsWith('--aura-')),
    'Badges': contractVariables.filter(v => v.startsWith('--badge-')),
    'Inputs': contractVariables.filter(v => v.startsWith('--input-')),
    'Botones': contractVariables.filter(v => v.startsWith('--button-')),
    'Radios': contractVariables.filter(v => v.startsWith('--radius-'))
  };

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Editor de Temas - AuriPortal Admin</title>
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
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .header h1 {
      color: #333;
      font-size: 2rem;
    }
    
    .header .actions {
      display: flex;
      gap: 10px;
    }
    
    .btn {
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
      display: inline-block;
    }
    
    .btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 12px rgba(102, 126, 234, 0.4);
    }
    
    .btn-secondary {
      background: #6c757d;
    }
    
    .btn-success {
      background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
    }
    
    .btn-danger {
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    }
    
    .main-content {
      display: grid;
      grid-template-columns: 400px 1fr;
      gap: 20px;
      min-height: calc(100vh - 200px);
    }
    
    .main-content.editor-mode {
      grid-template-columns: 450px 1fr;
    }
    
    .sidebar {
      background: white;
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      max-height: calc(100vh - 200px);
      overflow-y: auto;
    }
    
    .sidebar h2 {
      color: #333;
      margin-bottom: 15px;
      font-size: 1.3rem;
    }
    
    .theme-list {
      list-style: none;
    }
    
    .theme-item {
      padding: 12px;
      margin-bottom: 8px;
      border-radius: 8px;
      cursor: pointer;
      transition: background 0.2s;
      border: 2px solid transparent;
    }
    
    .theme-item:hover {
      background: #f8f9fa;
    }
    
    .theme-item.active {
      background: #e0e7ff;
      border-color: #667eea;
    }
    
    .theme-item .name {
      font-weight: 600;
      color: #333;
      margin-bottom: 4px;
    }
    
    .theme-item .meta {
      font-size: 0.85rem;
      color: #666;
    }
    
    .theme-item .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.75rem;
      margin-top: 4px;
    }
    
    .theme-item .badge.system {
      background: #e0e7ff;
      color: #667eea;
    }
    
    .theme-item .badge.custom {
      background: #d1fae5;
      color: #059669;
    }
    
    .theme-item .badge.ai {
      background: #fef3c7;
      color: #d97706;
    }
    
    .editor {
      background: white;
      border-radius: 12px;
      padding: 30px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    
    .editor-header {
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 2px solid #e5e7eb;
    }
    
    .editor-header h2 {
      color: #333;
      margin-bottom: 15px;
    }
    
    .form-group {
      margin-bottom: 20px;
    }
    
    .form-group label {
      display: block;
      margin-bottom: 8px;
      color: #333;
      font-weight: 600;
    }
    
    .form-group input,
    .form-group textarea {
      width: 100%;
      padding: 12px;
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      font-size: 1rem;
      font-family: inherit;
    }
    
    .form-group input:focus,
    .form-group textarea:focus {
      outline: none;
      border-color: #667eea;
    }
    
    .variables-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 15px;
      margin-top: 20px;
    }
    
    .variable-group {
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      padding: 15px;
    }
    
    .variable-group h3 {
      color: #667eea;
      margin-bottom: 15px;
      font-size: 1.1rem;
    }
    
    .variable-item {
      margin-bottom: 12px;
    }
    
    .variable-item label {
      display: block;
      font-size: 0.9rem;
      color: #666;
      margin-bottom: 4px;
      font-family: monospace;
    }
    
    .variable-item input {
      width: 100%;
      padding: 8px;
      border: 1px solid #d1d5db;
      border-radius: 4px;
      font-size: 0.9rem;
    }
    
    .ai-section {
      background: #fef3c7;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 30px;
    }
    
    .ai-section h3 {
      color: #d97706;
      margin-bottom: 15px;
    }
    
    .ai-section textarea {
      width: 100%;
      min-height: 100px;
      margin-bottom: 10px;
    }
    
    .proposals-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 15px;
      margin-top: 15px;
    }
    
    .proposal-card {
      background: white;
      border: 2px solid #fbbf24;
      border-radius: 8px;
      padding: 15px;
      cursor: pointer;
      transition: transform 0.2s;
    }
    
    .proposal-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(0,0,0,0.1);
    }
    
    .proposal-card h4 {
      color: #333;
      margin-bottom: 8px;
    }
    
    .proposal-card p {
      font-size: 0.85rem;
      color: #666;
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
    
    .message {
      display: none;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    
    .message.active {
      display: block;
    }
    
    .message.success {
      background: #d1fae5;
      color: #059669;
      border: 2px solid #10b981;
    }
    
    .message.error {
      background: #fee2e2;
      color: #dc2626;
      border: 2px solid #ef4444;
    }
    
    .read-only {
      opacity: 0.6;
      pointer-events: none;
    }
    
    .editor-container {
      display: grid;
      grid-template-columns: 1fr;
      gap: 20px;
    }
    
    .editor-container.has-preview {
      grid-template-columns: 1fr 1fr;
    }
    
    @media (max-width: 1400px) {
      .main-content.editor-mode {
        grid-template-columns: 1fr;
      }
      
      .editor-container.has-preview {
        grid-template-columns: 1fr;
      }
      
      .preview-container {
        min-height: 600px;
      }
    }
    
    @media (max-width: 1024px) {
      .main-content {
        grid-template-columns: 1fr;
      }
      
      .sidebar {
        max-height: 300px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎨 Editor de Temas</h1>
      <div class="actions">
        <a href="/admin" class="btn btn-secondary">← Volver al Admin</a>
        <button class="btn btn-success" onclick="crearNuevoTema()">+ Nuevo Tema</button>
      </div>
    </div>
    
    <div class="main-content">
      <div class="sidebar">
        <h2>Temas</h2>
        <ul class="theme-list" id="theme-list">
          <li>Cargando...</li>
        </ul>
      </div>
      
      <div class="editor-container">
        <div class="editor" id="editor">
          <div class="editor-header">
            <h2>Selecciona un tema para editar</h2>
            <p style="color: #666;">O crea uno nuevo desde cero o con IA</p>
          </div>
        </div>
        
        <div class="preview-container" id="preview-container" style="display: none;">
          <div class="preview-header">
            <h3>👁️ Preview en Vivo</h3>
            <button onclick="cerrarPreview()" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 6px 12px; border-radius: 4px; cursor: pointer;">✕</button>
          </div>
          <iframe id="themePreviewFrame" class="preview-iframe" sandbox="allow-same-origin allow-scripts"></iframe>
        </div>
      </div>
    </div>
  </div>
  
  <script>
    let currentTheme = null;
    let contractVariables = ${JSON.stringify(contractVariables)};
    let variablesByCategory = ${JSON.stringify(variablesByCategory)};
    
    // Cargar lista de temas al iniciar
    window.addEventListener('DOMContentLoaded', () => {
      cargarTemas();
    });
    
    async function cargarTemas() {
      try {
        const response = await fetch('/admin/themes');
        const data = await response.json();
        
        if (data.success) {
          renderThemeList(data.themes);
        } else {
          mostrarError('Error cargando temas: ' + data.error);
        }
      } catch (error) {
        mostrarError('Error cargando temas: ' + error.message);
      }
    }
    
    function renderThemeList(themes) {
      const list = document.getElementById('theme-list');
      list.innerHTML = '';
      
      if (themes.length === 0) {
        list.innerHTML = '<li style="color: #666; padding: 20px; text-align: center;">No hay temas aún</li>';
        return;
      }
      
      themes.forEach(theme => {
        const li = document.createElement('li');
        li.className = 'theme-item';
        li.onclick = () => cargarTema(theme);
        
        const badgeClass = theme.source === 'system' ? 'system' : 
                          theme.source === 'ai' ? 'ai' : 'custom';
        const badgeText = theme.source === 'system' ? 'Sistema' : 
                         theme.source === 'ai' ? 'IA' : 'Personalizado';
        
        li.innerHTML = \`
          <div class="name">\${theme.name}</div>
          <div class="meta">\${theme.description || 'Sin descripción'}</div>
          <span class="badge \${badgeClass}">\${badgeText}</span>
        \`;
        
        list.appendChild(li);
      });
    }
    
    async function cargarTema(theme) {
      currentTheme = theme;
      
      // Marcar tema activo en la lista
      document.querySelectorAll('.theme-item').forEach(item => {
        item.classList.remove('active');
      });
      event.currentTarget.classList.add('active');
      
      // Renderizar editor
      renderEditor(theme);
    }
    
    function renderEditor(theme) {
      const editor = document.getElementById('editor');
      const isReadOnly = theme.source === 'system';
      const isNew = !theme.id;
      
      let html = \`
        <div class="editor-header">
          <h2>\${theme.name || 'Nuevo Tema'}</h2>
          <p style="color: #666;">\${theme.description || 'Sin descripción'}</p>
        </div>
        
        <div class="message" id="message"></div>
        
        \${isNew ? \`
          <div class="ai-section">
            <h3>🤖 Generar con IA</h3>
            <p style="color: #666; margin-bottom: 15px;">Describe el tema que quieres crear y la IA generará propuestas completas</p>
            <textarea id="ai-prompt" placeholder="Ej: hazme un tema de navidad, tema calmado para sanación, tema luminoso y suave..." style="width: 100%; min-height: 80px; padding: 12px; border: 2px solid #fbbf24; border-radius: 8px; font-size: 1rem; margin-bottom: 10px;"></textarea>
            <div style="display: flex; gap: 10px; align-items: center;">
              <select id="ai-count" style="padding: 8px; border: 2px solid #fbbf24; border-radius: 4px;">
                <option value="1">1 propuesta</option>
                <option value="2">2 propuestas</option>
                <option value="3" selected>3 propuestas</option>
              </select>
              <button type="button" class="btn" onclick="generarConIA()" style="background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);">Generar Propuestas</button>
            </div>
            <div class="loading" id="ai-loading">⏳ Generando propuestas con IA...</div>
            <div id="ai-proposals" class="proposals-grid" style="display: none;"></div>
          </div>
        \` : ''}
        
        <form id="theme-form" class="\${isReadOnly ? 'read-only' : ''}">
          <div class="form-group">
            <label>Nombre del Tema</label>
            <input type="text" name="name" value="\${escapeHtml(theme.name || '')}" \${isReadOnly ? 'readonly' : ''} required>
          </div>
          
          <div class="form-group">
            <label>Descripción</label>
            <textarea name="description" \${isReadOnly ? 'readonly' : ''}>\${escapeHtml(theme.description || '')}</textarea>
          </div>
          
          <div class="form-group">
            <label>Clave (Key)</label>
            <input type="text" name="key" value="\${escapeHtml(theme.key || '')}" \${isReadOnly ? 'readonly' : ''} required>
            <small style="color: #666; font-size: 0.85rem;">Identificador único del tema</small>
          </div>
          
          <h3 style="margin: 30px 0 20px 0; color: #333;">Variables CSS</h3>
      \`;
      
      // Renderizar variables por categoría
      Object.keys(variablesByCategory).forEach(category => {
        const vars = variablesByCategory[category];
        if (vars.length === 0) return;
        
        html += \`
          <div class="variable-group">
            <h3>\${category}</h3>
        \`;
        
        vars.forEach(varName => {
          const value = theme.values[varName] || '';
          html += \`
            <div class="variable-item">
              <label>\${varName}</label>
              <input type="text" name="values[\${varName}]" value="\${escapeHtml(value)}" \${isReadOnly ? 'readonly' : ''}>
            </div>
          \`;
        });
        
        html += '</div>';
      });
      
      html += \`
          <div class="form-group" style="margin-top: 30px;">
            <label>Pantalla de Preview</label>
            <select id="preview-screen" style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 1rem; font-family: inherit;">
              <option value="pantalla1" selected>Pantalla 1 (Ritual Diario)</option>
              <option value="ejecucion">Ejecución (Práctica)</option>
              <option value="limpieza-basica">Limpieza Básica</option>
              <option value="limpieza-profunda">Limpieza Profunda</option>
            </select>
            <small style="color: #666; font-size: 0.85rem;">Selecciona qué pantalla cliente previsualizar</small>
          </div>
          
          <div style="margin-top: 20px; display: flex; gap: 10px; flex-wrap: wrap;">
            <button type="button" class="btn" onclick="previsualizarTema()" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
              👁️ Previsualizar
            </button>
            \${!isReadOnly ? \`
              <button type="submit" class="btn btn-success">Guardar Cambios</button>
              <button type="button" class="btn btn-danger" onclick="archivarTema(\${theme.id})">Archivar</button>
            \` : \`
              <p style="color: #666; font-style: italic;">Los temas del sistema son de solo lectura</p>
            \`}
          </div>
        </form>
      \`;
      
      editor.innerHTML = html;
      
      // Añadir event listener al form
      if (!isReadOnly) {
        document.getElementById('theme-form').addEventListener('submit', guardarTema);
      }
    }
    
    function crearNuevoTema() {
      const theme = {
        id: null,
        key: '',
        name: '',
        description: '',
        contractVersion: 'v1',
        values: {},
        source: 'custom',
        meta: {},
        status: 'draft'
      };
      
      // Inicializar valores vacíos para todas las variables
      contractVariables.forEach(varName => {
        theme.values[varName] = '';
      });
      
      currentTheme = theme;
      renderEditor(theme);
      
      // Scroll al editor
      document.getElementById('editor').scrollIntoView({ behavior: 'smooth' });
    }
    
    async function guardarTema(e) {
      e.preventDefault();
      
      if (!currentTheme) return;
      
      const formData = new FormData(e.target);
      const values = {};
      
      // Recopilar valores de variables
      contractVariables.forEach(varName => {
        const value = formData.get(\`values[\${varName}]\`);
        if (value) {
          values[varName] = value;
        }
      });
      
      const themeData = {
        key: formData.get('key'),
        name: formData.get('name'),
        description: formData.get('description'),
        contractVersion: 'v1',
        values: values,
        source: currentTheme.source || 'custom',
        meta: currentTheme.meta || {},
        status: currentTheme.status || 'active'
      };
      
      try {
        let response;
        if (currentTheme.id) {
          // Actualizar
          response = await fetch(\`/admin/themes/\${currentTheme.id}\`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(themeData)
          });
        } else {
          // Crear
          response = await fetch('/admin/themes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(themeData)
          });
        }
        
        const data = await response.json();
        
        if (data.success) {
          mostrarMensaje('Tema guardado correctamente', 'success');
          cargarTemas();
          if (data.theme) {
            currentTheme = data.theme;
            renderEditor(data.theme);
          }
        } else {
          mostrarError('Error guardando tema: ' + data.error);
        }
      } catch (error) {
        mostrarError('Error guardando tema: ' + error.message);
      }
    }
    
    async function archivarTema(id) {
      if (!confirm('¿Estás seguro de que quieres archivar este tema?')) {
        return;
      }
      
      try {
        const response = await fetch(\`/admin/themes/\${id}\`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'archived' })
        });
        
        const data = await response.json();
        
        if (data.success) {
          mostrarMensaje('Tema archivado correctamente', 'success');
          cargarTemas();
        } else {
          mostrarError('Error archivando tema: ' + data.error);
        }
      } catch (error) {
        mostrarError('Error archivando tema: ' + error.message);
      }
    }
    
    function mostrarMensaje(texto, tipo) {
      const message = document.getElementById('message');
      if (message) {
        message.textContent = texto;
        message.className = \`message active \${tipo}\`;
        setTimeout(() => {
          message.classList.remove('active');
        }, 3000);
      }
    }
    
    function mostrarError(texto) {
      mostrarMensaje(texto, 'error');
    }
    
    async function generarConIA() {
      const prompt = document.getElementById('ai-prompt').value.trim();
      const count = parseInt(document.getElementById('ai-count').value, 10);
      
      if (!prompt) {
        mostrarError('Por favor, describe el tema que quieres crear');
        return;
      }
      
      const loading = document.getElementById('ai-loading');
      const proposalsDiv = document.getElementById('ai-proposals');
      
      loading.classList.add('active');
      proposalsDiv.style.display = 'none';
      proposalsDiv.innerHTML = '';
      
      try {
        const response = await fetch('/admin/themes/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, count })
        });
        
        const data = await response.json();
        
        if (data.success && data.proposals && data.proposals.length > 0) {
          renderProposals(data.proposals);
        } else {
          mostrarError('No se pudieron generar propuestas. Ollama puede no estar disponible.');
        }
      } catch (error) {
        mostrarError('Error generando propuestas: ' + error.message);
      } finally {
        loading.classList.remove('active');
      }
    }
    
    function renderProposals(proposals) {
      const proposalsDiv = document.getElementById('ai-proposals');
      proposalsDiv.style.display = 'grid';
      proposalsDiv.innerHTML = '';
      
      proposals.forEach((proposal, index) => {
        const card = document.createElement('div');
        card.className = 'proposal-card';
        card.onclick = () => usarPropuesta(proposal);
        
        card.innerHTML = \`
          <h4>\${escapeHtml(proposal.name)}</h4>
          <p>\${escapeHtml(proposal.description || 'Sin descripción')}</p>
          <button class="btn" style="width: 100%; margin-top: 10px; padding: 8px; font-size: 0.9rem;" onclick="event.stopPropagation(); usarPropuesta(\${JSON.stringify(proposal).replace(/"/g, '&quot;')})">Usar esta propuesta</button>
        \`;
        
        proposalsDiv.appendChild(card);
      });
    }
    
    function usarPropuesta(proposal) {
      // Crear tema desde propuesta
      const theme = {
        id: null,
        key: proposal.key,
        name: proposal.name,
        description: proposal.description,
        contractVersion: proposal.contractVersion || 'v1',
        values: proposal.values || {},
        source: 'ai',
        meta: proposal.meta || {},
        status: 'draft'
      };
      
      // Asegurar que todas las variables estén presentes
      contractVariables.forEach(varName => {
        if (!theme.values[varName]) {
          theme.values[varName] = '';
        }
      });
      
      currentTheme = theme;
      renderEditor(theme);
      
      // Scroll al editor
      document.getElementById('editor').scrollIntoView({ behavior: 'smooth' });
      
      // Ocultar propuestas
      document.getElementById('ai-proposals').style.display = 'none';
      document.getElementById('ai-prompt').value = '';
      
      mostrarMensaje('Propuesta cargada. Revisa y edita los valores antes de guardar.', 'success');
    }
    
    function escapeHtml(text) {
      if (text === null || text === undefined) return '';
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
    
    // PREVIEW v1: Sistema aislado de preview de temas
    function previsualizarTema() {
      if (!currentTheme) {
        mostrarError('No hay tema seleccionado para previsualizar');
        return;
      }
      
      // Obtener pantalla seleccionada (fallback a pantalla1)
      const screenSelect = document.getElementById('preview-screen');
      const selectedScreen = screenSelect ? screenSelect.value : 'pantalla1';
      
      // Construir URL de preview
      let previewUrl = '/admin/themes/preview?';
      
      if (currentTheme.id) {
        // Tema guardado: usar theme_id
        previewUrl += \`theme_id=\${currentTheme.id}\`;
      } else {
        // Tema draft: enviar theme_draft como JSON
        const themeDraft = {
          key: currentTheme.key || 'preview-temp',
          name: currentTheme.name || 'Preview Temporal',
          values: {}
        };
        
        // Recopilar valores actuales del formulario
        const form = document.getElementById('theme-form');
        if (form) {
          const formData = new FormData(form);
          contractVariables.forEach(varName => {
            const value = formData.get(\`values[\${varName}]\`);
            if (value) {
              themeDraft.values[varName] = value;
            }
          });
        } else {
          // Si no hay form, usar valores del currentTheme
          themeDraft.values = currentTheme.values || {};
        }
        
        previewUrl += \`theme_draft=\${encodeURIComponent(JSON.stringify(themeDraft))}\`;
      }
      
      // Añadir parámetro screen
      previewUrl += \`&screen=\${encodeURIComponent(selectedScreen)}\`;
      
      // Abrir modal con iframe
      abrirModalPreview(previewUrl);
    }
    
    function abrirModalPreview(previewUrl) {
      // Crear modal si no existe
      let modal = document.getElementById('preview-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'preview-modal';
        modal.style.cssText = \`
          display: none;
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.8);
          z-index: 10000;
          padding: 20px;
          box-sizing: border-box;
        \`;
        
        const modalContent = document.createElement('div');
        modalContent.style.cssText = \`
          position: relative;
          width: 100%;
          height: 100%;
          max-width: 1200px;
          max-height: 90vh;
          margin: 0 auto;
          background: white;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
        \`;
        
        const modalHeader = document.createElement('div');
        modalHeader.style.cssText = \`
          padding: 20px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          display: flex;
          justify-content: space-between;
          align-items: center;
        \`;
        modalHeader.innerHTML = \`
          <h2 style="margin: 0; font-size: 1.5rem;">👁️ Preview del Tema</h2>
          <button onclick="cerrarModalPreview()" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 1.2rem; font-weight: bold;">×</button>
        \`;
        
        const iframe = document.createElement('iframe');
        iframe.id = 'preview-iframe';
        iframe.style.cssText = \`
          width: 100%;
          height: calc(100% - 70px);
          border: none;
          display: block;
        \`;
        
        modalContent.appendChild(modalHeader);
        modalContent.appendChild(iframe);
        modal.appendChild(modalContent);
        document.body.appendChild(modal);
        
        // Añadir función global para cerrar
        window.cerrarModalPreview = function() {
          modal.style.display = 'none';
          iframe.src = '';
        };
        
        // Cerrar al hacer clic fuera del contenido
        modal.addEventListener('click', function(e) {
          if (e.target === modal) {
            window.cerrarModalPreview();
          }
        });
        
        // Cerrar con ESC
        document.addEventListener('keydown', function(e) {
          if (e.key === 'Escape' && modal.style.display !== 'none') {
            window.cerrarModalPreview();
          }
        });
      }
      
      // Cargar preview en iframe
      const iframe = document.getElementById('preview-iframe');
      iframe.src = previewUrl;
      
      // Mostrar modal
      modal.style.display = 'flex';
      modal.style.alignItems = 'center';
      modal.style.justifyContent = 'center';
    }
  </script>
</body>
</html>
  `;

  return renderHtml(html);
}

