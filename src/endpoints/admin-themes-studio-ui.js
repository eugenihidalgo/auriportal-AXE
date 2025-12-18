// src/endpoints/admin-themes-studio-ui.js
// Theme Studio v2 - Paleta Principal v1 + Paleta Secundaria v1 (Superficies)
// Implementa Paleta Principal v1 y Paleta Secundaria v1 (Superficies) con color pickers pro (Pickr), live preview vía postMessage y guardado de draft

import { renderHtml } from '../core/html-response.js';
import { requireAdminContext } from '../core/auth-context.js';

/**
 * Renderiza la UI del Theme Studio v2
 * 
 * REGLA: Los endpoints no gestionan autenticación; solo consumen contexto.
 * Usa requireAdminContext para obtener el contexto de autenticación admin.
 */
export default async function adminThemesStudioUIHandler(request, env, ctx) {
  // #region agent log
  fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin-themes-studio-ui.js:14',message:'Handler entry',data:{url:request?.url,method:request?.method},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  
  // Obtener contexto de autenticación admin (patrón estándar)
  // Si no está autenticado, requireAdminContext devuelve Response HTML (login)
  // #region agent log
  fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin-themes-studio-ui.js:18',message:'Before requireAdminContext',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  
  let authCtx;
  try {
    authCtx = await requireAdminContext(request, env);
    // #region agent log
    fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin-themes-studio-ui.js:25',message:'After requireAdminContext',data:{isResponse:authCtx instanceof Response,hasAuthCtx:!!authCtx},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
  } catch (authError) {
    // #region agent log
    fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin-themes-studio-ui.js:30',message:'Error in requireAdminContext',data:{error:authError?.message,stack:authError?.stack},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    throw authError;
  }
  
  if (authCtx instanceof Response) {
    // Si no está autenticado, requireAdminContext ya devolvió la respuesta HTML (login)
    // #region agent log
    fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin-themes-studio-ui.js:36',message:'Returning auth response (login)',data:{status:authCtx?.status},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    return authCtx;
  }
  
  // Si llegamos aquí, el usuario está autenticado como admin
  // authCtx contiene: { user: { isAdmin: true }, isAdmin: true, isAuthenticated: true, request, requestId }

  // #region agent log
  fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin-themes-studio-ui.js:44',message:'Before HTML construction',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  // #endregion

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Theme Studio - AuriPortal Admin</title>
  <link rel="stylesheet" href="/css/pickr/monolith.min.css">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: #0f172a;
      color: #e2e8f0;
      height: 100vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    
    /* Barra superior fija */
    .top-bar {
      background: #1e293b;
      border-bottom: 1px solid #334155;
      padding: 16px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
      z-index: 10;
    }
    
    .top-bar-left {
      display: flex;
      align-items: center;
      gap: 20px;
    }
    
    .top-bar h1 {
      font-size: 1.5rem;
      font-weight: 600;
      color: #f1f5f9;
      margin: 0;
    }
    
    .theme-name-input {
      background: #334155;
      border: 1px solid #475569;
      color: #e2e8f0;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 0.9rem;
      min-width: 200px;
      font-family: inherit;
    }
    
    .theme-name-input::placeholder {
      color: #94a3b8;
    }
    
    .theme-name-input:focus {
      outline: none;
      border-color: #667eea;
    }
    
    .top-bar-right {
      display: flex;
      gap: 12px;
      align-items: center;
    }
    
    /* Presets dropdown */
    .presets-container {
      position: relative;
    }
    
    .btn-presets {
      background: #475569;
      color: #e2e8f0;
      padding: 10px 20px;
      border: none;
      border-radius: 6px;
      font-size: 0.9rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      font-family: inherit;
    }
    
    .btn-presets:hover {
      background: #64748b;
    }
    
    .presets-dropdown {
      display: none;
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 8px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
      min-width: 200px;
      z-index: 100;
      overflow: hidden;
    }
    
    .presets-dropdown.active {
      display: block;
    }
    
    .preset-item {
      padding: 12px 16px;
      cursor: pointer;
      transition: background 0.2s;
      color: #e2e8f0;
      font-size: 0.9rem;
      border-bottom: 1px solid #334155;
    }
    
    .preset-item:last-child {
      border-bottom: none;
    }
    
    .preset-item:hover {
      background: #334155;
    }
    
    .preset-item-label {
      font-weight: 500;
    }
    
    /* Feedback toast */
    .preset-toast {
      position: fixed;
      top: 80px;
      right: 24px;
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 8px;
      padding: 12px 20px;
      color: #e2e8f0;
      font-size: 0.9rem;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
      z-index: 1000;
      opacity: 0;
      transform: translateY(-10px);
      transition: all 0.3s ease;
      pointer-events: none;
    }
    
    .preset-toast.show {
      opacity: 1;
      transform: translateY(0);
    }
    
    .btn {
      padding: 10px 20px;
      border: none;
      border-radius: 6px;
      font-size: 0.9rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      font-family: inherit;
    }
    
    .btn-primary {
      background: #667eea;
      color: white;
    }
    
    .btn-primary:hover:not(:disabled) {
      background: #5568d3;
    }
    
    .btn-secondary {
      background: #475569;
      color: #e2e8f0;
    }
    
    .btn-secondary:hover:not(:disabled) {
      background: #64748b;
    }
    
    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    .btn-save {
      background: #10b981;
      color: white;
    }
    
    .btn-save:hover:not(:disabled) {
      background: #059669;
    }
    
    .published-badge {
      display: inline-flex;
      align-items: center;
      padding: 8px 12px;
      background: #10b981;
      color: white;
      border-radius: 6px;
      font-size: 0.85rem;
      font-weight: 500;
      margin-right: 8px;
    }
    
    /* Modal de confirmación */
    .modal-overlay {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      z-index: 1000;
      align-items: center;
      justify-content: center;
    }
    
    .modal-overlay.active {
      display: flex;
    }
    
    .modal {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 24px;
      max-width: 500px;
      width: 90%;
      box-shadow: 0 20px 25px rgba(0, 0, 0, 0.5);
    }
    
    .modal h3 {
      color: #f1f5f9;
      margin-bottom: 16px;
      font-size: 1.3rem;
    }
    
    .modal p {
      color: #94a3b8;
      margin-bottom: 12px;
      line-height: 1.6;
    }
    
    .modal-actions {
      display: flex;
      gap: 12px;
      margin-top: 24px;
      justify-content: flex-end;
    }
    
    .modal-actions .btn {
      min-width: 100px;
    }
    
    /* Layout principal en 3 columnas */
    .main-layout {
      display: flex;
      flex: 1;
      overflow: hidden;
    }
    
    /* Columna izquierda - Controles */
    .controls-panel {
      width: 30%;
      min-width: 300px;
      max-width: 400px;
      background: #1e293b;
      border-right: 1px solid #334155;
      padding: 24px;
      overflow-y: auto;
      flex-shrink: 0;
    }
    
    /* Columna derecha - Theme Manager */
    .theme-manager-panel {
      width: 280px;
      min-width: 280px;
      max-width: 320px;
      background: #1e293b;
      border-left: 1px solid #334155;
      padding: 24px;
      overflow-y: auto;
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
    }
    
    .theme-manager-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 20px;
      padding-bottom: 16px;
      border-bottom: 1px solid #334155;
    }
    
    .theme-manager-header h2 {
      font-size: 1.1rem;
      font-weight: 600;
      color: #f1f5f9;
      margin: 0;
    }
    
    .theme-manager-toggle {
      background: none;
      border: none;
      color: #94a3b8;
      cursor: pointer;
      font-size: 1.2rem;
      padding: 4px 8px;
      transition: color 0.2s;
    }
    
    .theme-manager-toggle:hover {
      color: #e2e8f0;
    }
    
    .theme-manager-content {
      flex: 1;
      overflow-y: auto;
    }
    
    .theme-manager-panel.collapsed {
      width: 0;
      min-width: 0;
      padding: 0;
      border-left: none;
      overflow: hidden;
    }
    
    .theme-manager-panel.collapsed .theme-manager-content {
      display: none;
    }
    
    .theme-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    
    .theme-item {
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 12px;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .theme-item:hover {
      background: #1e293b;
      border-color: #475569;
      transform: translateX(2px);
    }
    
    .theme-item.active {
      background: #1e293b;
      border-color: #667eea;
      box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.2);
    }
    
    .theme-item-name {
      font-size: 0.95rem;
      font-weight: 500;
      color: #f1f5f9;
      margin-bottom: 8px;
    }
    
    .theme-item-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.8rem;
      color: #94a3b8;
    }
    
    .theme-status {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 500;
    }
    
    .theme-status.draft {
      background: rgba(251, 191, 36, 0.15);
      color: #fbbf24;
    }
    
    .theme-status.published {
      background: rgba(16, 185, 129, 0.15);
      color: #10b981;
    }
    
    .theme-version {
      color: #64748b;
    }
    
    .controls-panel h2 {
      font-size: 1.2rem;
      font-weight: 600;
      color: #f1f5f9;
      margin-bottom: 20px;
    }
    
    /* Paleta Principal */
    .palette-section {
      margin-bottom: 32px;
    }
    
    .palette-section-title {
      font-size: 0.85rem;
      font-weight: 600;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 16px;
    }

    /* Sección colapsable */
    .collapsible-section {
      margin-bottom: 32px;
    }

    .collapsible-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: pointer;
      padding: 12px 0;
      user-select: none;
      transition: color 0.2s;
    }

    .collapsible-header:hover {
      color: #f1f5f9;
    }

    .collapsible-header h2 {
      margin: 0;
      font-size: 1.2rem;
      font-weight: 600;
      color: #f1f5f9;
    }

    .collapsible-icon {
      font-size: 0.9rem;
      color: #94a3b8;
      transition: transform 0.2s;
    }

    .collapsible-section.collapsed .collapsible-icon {
      transform: rotate(-90deg);
    }

    .collapsible-content {
      overflow: hidden;
      transition: max-height 0.3s ease-out, opacity 0.2s;
      max-height: 2000px;
      opacity: 1;
    }

    .collapsible-section.collapsed .collapsible-content {
      max-height: 0;
      opacity: 0;
      margin: 0;
    }
    
    .color-token {
      margin-bottom: 32px;
      padding: 16px;
      background: #0f172a;
      border-radius: 8px;
      border: 1px solid #334155;
    }
    
    .color-token-label {
      font-size: 0.95rem;
      color: #e2e8f0;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    
    .color-token-name {
      font-weight: 500;
    }
    
    .color-token-code {
      font-size: 0.75rem;
      color: #64748b;
      font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
    }

    /* Estilos para controles de sombra */
    .shadow-token {
      margin-bottom: 32px;
      padding: 16px;
      background: #0f172a;
      border-radius: 8px;
      border: 1px solid #334155;
    }

    .shadow-token-label {
      font-size: 0.95rem;
      color: #e2e8f0;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .shadow-token-name {
      font-weight: 500;
    }

    .shadow-token-code {
      font-size: 0.75rem;
      color: #64748b;
      font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
    }

    .shadow-control-wrapper {
      margin-top: 12px;
    }

    .shadow-slider-container {
      margin-bottom: 16px;
    }

    .shadow-slider-label {
      font-size: 0.85rem;
      color: #94a3b8;
      margin-bottom: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .shadow-slider-value {
      font-size: 0.8rem;
      color: #64748b;
      font-weight: 500;
    }

    .shadow-slider {
      width: 100%;
      height: 6px;
      border-radius: 3px;
      background: #334155;
      outline: none;
      -webkit-appearance: none;
      appearance: none;
    }

    .shadow-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #667eea;
      cursor: pointer;
      transition: all 0.2s;
    }

    .shadow-slider::-webkit-slider-thumb:hover {
      background: #5568d3;
      transform: scale(1.1);
    }

    .shadow-slider::-moz-range-thumb {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #667eea;
      cursor: pointer;
      border: none;
      transition: all 0.2s;
    }

    .shadow-slider::-moz-range-thumb:hover {
      background: #5568d3;
      transform: scale(1.1);
    }

    .shadow-preview-container {
      margin-top: 12px;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .shadow-preview-box {
      width: 80px;
      height: 80px;
      background: #1e293b;
      border-radius: 8px;
      border: 1px solid #334155;
      transition: box-shadow 0.2s;
    }

    .shadow-css-display {
      flex: 1;
      font-size: 0.75rem;
      color: #94a3b8;
      font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
      background: #0f172a;
      padding: 8px 12px;
      border-radius: 6px;
      border: 1px solid #334155;
      word-break: break-all;
    }
    
    .color-picker-wrapper {
      position: relative;
      width: 100%;
    }
    
    .color-picker-trigger {
      width: 100%;
      height: 64px;
      border-radius: 10px;
      border: 2px solid #334155;
      cursor: pointer;
      position: relative;
      overflow: hidden;
      transition: all 0.2s;
      background: linear-gradient(45deg, #1e293b 25%, transparent 25%),
                  linear-gradient(-45deg, #1e293b 25%, transparent 25%),
                  linear-gradient(45deg, transparent 75%, #1e293b 75%),
                  linear-gradient(-45deg, transparent 75%, #1e293b 75%);
      background-size: 12px 12px;
      background-position: 0 0, 0 6px, 6px -6px, -6px 0px;
    }
    
    .color-picker-trigger:hover {
      border-color: #475569;
    }
    
    .color-picker-trigger:focus {
      outline: none;
      border-color: #667eea;
    }
    
    .color-picker-trigger .color-display {
      width: 100%;
      height: 100%;
      border-radius: 6px;
      position: relative;
      z-index: 1;
    }
    
    /* Estilos para Pickr */
    .pcr-app {
      background: #1e293b !important;
      border: 1px solid #334155 !important;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3) !important;
    }
    
    .pcr-interaction input {
      background: #0f172a !important;
      border: 1px solid #334155 !important;
      color: #e2e8f0 !important;
    }
    
    .pcr-interaction input:focus {
      border-color: #667eea !important;
    }
    
    /* Columna derecha - Preview */
    /* Columna central: Preview */
    .preview-panel {
      flex: 1;
      display: flex;
      flex-direction: column;
      background: #0f172a;
      overflow: hidden;
    }
    
    .preview-container {
      flex: 1;
      position: relative;
      overflow: hidden;
    }
    
    .preview-iframe {
      width: 100%;
      height: 100%;
      border: none;
      background: white;
    }
    
    /* Responsive */
    @media (max-width: 1024px) {
      .main-layout {
        flex-direction: column;
      }
      
      .controls-panel {
        width: 100%;
        max-width: none;
        max-height: 200px;
        border-right: none;
        border-bottom: 1px solid #334155;
      }
    }
  </style>
</head>
<body>
  <!-- Barra superior fija -->
  <div class="top-bar">
    <div class="top-bar-left">
      <h1>🎨 Theme Studio</h1>
      <input 
        type="text" 
        id="themeNameInput"
        class="theme-name-input" 
        placeholder="Nombre del tema..."
      />
    </div>
    <div class="top-bar-right">
      <div class="presets-container">
        <button id="presetsBtn" class="btn btn-presets">🎨 Presets</button>
        <div id="presetsDropdown" class="presets-dropdown">
          <div class="preset-item" data-preset-id="light">
            <div class="preset-item-label">🌞 Claro</div>
          </div>
          <div class="preset-item" data-preset-id="dark">
            <div class="preset-item-label">🌙 Oscuro</div>
          </div>
          <div class="preset-item" data-preset-id="auri">
            <div class="preset-item-label">✨ Auri</div>
          </div>
        </div>
      </div>
      <span id="publishedBadge" class="published-badge" style="display: none;">✓ Publicado</span>
      <button id="saveDraftBtn" class="btn btn-save">Guardar Draft</button>
      <button id="publishBtn" class="btn btn-primary" disabled>Publicar</button>
    </div>
  </div>
  
    <!-- Layout principal en 3 columnas -->
    <div class="main-layout">
      <!-- Columna izquierda: Controles -->
      <div class="controls-panel">
      <h2>🎨 Paleta Principal</h2>
      
      <div class="palette-section">
        <div class="palette-section-title">Colores Base</div>
        
        <div id="paletteTokens"></div>
      </div>

      <!-- Sección Superficies (colapsable, cerrada por defecto) -->
      <div class="collapsible-section collapsed" id="superficiesSection">
        <div class="collapsible-header" onclick="toggleSuperficies()">
          <h2>🧱 Superficies</h2>
          <span class="collapsible-icon">▼</span>
        </div>
        <div class="collapsible-content">
          <div class="palette-section">
            <div class="palette-section-title">Superficies y Bordes</div>
            
            <div id="superficiesTokens"></div>
          </div>
        </div>
      </div>

      <!-- Sección Sombras y Profundidad (colapsable, cerrada por defecto) -->
      <div class="collapsible-section collapsed" id="sombrasSection">
        <div class="collapsible-header" onclick="toggleSombras()">
          <h2>🌫️ Sombras y profundidad</h2>
          <span class="collapsible-icon">▼</span>
        </div>
        <div class="collapsible-content">
          <div class="palette-section">
            <div class="palette-section-title">Volumen y Profundidad</div>
            
            <div id="sombrasTokens"></div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Columna central: Preview -->
    <div class="preview-panel">
      <div class="preview-container">
        <iframe 
          id="themePreviewFrame"
          class="preview-iframe"
          src="/admin/themes/preview?screen=pantalla1"
        ></iframe>
      </div>
    </div>
    
    <!-- Columna derecha: Theme Manager -->
    <div class="theme-manager-panel" id="themeManagerPanel">
      <div class="theme-manager-header">
        <h2>🗂️ Themes</h2>
        <button class="theme-manager-toggle" id="themeManagerToggle" title="Colapsar/Expandir">×</button>
      </div>
      <div class="theme-manager-content">
        <ul class="theme-list" id="themeList">
          <li style="color: #94a3b8; padding: 12px; text-align: center; font-size: 0.9rem;">
            Cargando temas...
          </li>
        </ul>
      </div>
    </div>
  </div>

  <!-- Toast de feedback para presets -->
  <div id="presetToast" class="preset-toast"></div>

  <!-- Modal de confirmación de publicación -->
  <div id="publishModal" class="modal-overlay">
    <div class="modal">
      <h3>¿Publicar este tema?</h3>
      <p>Vas a publicar este tema con los valores actuales.</p>
      <p><strong>Se creará una nueva versión inmutable</strong> que los usuarios empezarán a ver.</p>
      <p style="color: #fbbf24; font-size: 0.9rem;">⚠️ Esta acción no se puede deshacer fácilmente.</p>
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="closePublishModal()">Cancelar</button>
        <button class="btn btn-primary" id="confirmPublishBtn">Confirmar publicación</button>
      </div>
    </div>
  </div>

  <script src="/js/pickr/pickr.min.js"></script>
  <script>
    // ============================================
    // PRESETS v1 - Definición de presets base
    // ============================================
    const THEME_PRESETS = [
      {
        id: "light",
        label: "🌞 Claro",
        tokens: {
          "--bg-main": "#f8fafc",
          "--text-primary": "#0f172a",
          "--accent-primary": "#2563eb",
          "--bg-card": "#ffffff",
          "--bg-secondary": "#e2e8f0",
          "--border-soft": "#cbd5e1",
          "--shadow-sm": "rgba(0,0,0,0.12)",
          "--shadow-md": "rgba(0,0,0,0.18)"
        }
      },
      {
        id: "dark",
        label: "🌙 Oscuro",
        tokens: {
          "--bg-main": "#020617",
          "--text-primary": "#e5e7eb",
          "--accent-primary": "#38bdf8",
          "--bg-card": "#020617",
          "--bg-secondary": "#020617",
          "--border-soft": "#020617",
          "--shadow-sm": "rgba(0,0,0,0.5)",
          "--shadow-md": "rgba(0,0,0,0.7)"
        }
      },
      {
        id: "auri",
        label: "✨ Auri",
        tokens: {
          "--bg-main": "#0f172a",
          "--text-primary": "#f8fafc",
          "--accent-primary": "#facc15",
          "--bg-card": "#1e293b",
          "--bg-secondary": "#020617",
          "--border-soft": "#334155",
          "--shadow-sm": "rgba(250,204,21,0.15)",
          "--shadow-md": "rgba(250,204,21,0.25)"
        }
      }
    ];

    // FASE 1: Token Metadata Mínima
    const PALETA_PRINCIPAL = [
      {
        label: "Fondo principal",
        token: "--bg-main",
        type: "color"
      },
      {
        label: "Texto principal",
        token: "--text-primary",
        type: "color"
      },
      {
        label: "Acento principal",
        token: "--accent-primary",
        type: "color"
      }
    ];

    // Paleta Secundaria v1 - Superficies
    const PALETA_SUPERFICIES = [
      {
        label: "Superficie principal (Cards)",
        token: "--bg-card",
        type: "color"
      },
      {
        label: "Superficie secundaria",
        token: "--bg-secondary",
        type: "color"
      },
      {
        label: "Bordes suaves",
        token: "--border-soft",
        type: "color"
      }
    ];

    // Paleta Sombras v1 - Sombras y Profundidad
    const PALETA_SOMBRAS = [
      {
        label: "Sombra suave",
        token: "--shadow-sm",
        type: "shadow",
        default: "rgba(0,0,0,0.12)"
      },
      {
        label: "Sombra media",
        token: "--shadow-md",
        type: "shadow",
        default: "rgba(0,0,0,0.18)"
      }
    ];

    // ============================================
    // ESTADO CANÓNICO - Fuente única de verdad
    // ============================================
    window.themeState = {
      meta: {
        name: "",
        themeId: null,
        dirty: false,
        publishedVersion: null
      },
      tokens: {}
    };

    // Valores por defecto (desde theme-defaults si es necesario)
    const DEFAULT_VALUES = {
      "--bg-main": "#0f172a",
      "--text-primary": "#e2e8f0",
      "--accent-primary": "#667eea",
      "--bg-card": "#1e293b",
      "--bg-secondary": "#334155",
      "--border-soft": "#475569",
      "--shadow-sm": "rgba(0,0,0,0.12)",
      "--shadow-md": "rgba(0,0,0,0.18)"
    };

    // FASE 3: Generación de sombra basada en intensidad (0-100)
    // Nota: Los tokens de sombra contienen solo el color rgba, no el valor completo de box-shadow
    // Las pantallas HTML usan estos colores dentro de valores completos de box-shadow
    function generateShadow(intensity, type = 'sm') {
      // Normalizar intensidad a 0-100
      const normalizedIntensity = Math.max(0, Math.min(100, intensity));
      
      if (type === 'sm') {
        // Sombra suave: alpha suave (0-0.15)
        const alpha = (normalizedIntensity / 100) * 0.15; // 0-0.15
        return \`rgba(0,0,0,\${alpha.toFixed(2)})\`;
      } else {
        // Sombra media: alpha más profundo (0-0.25)
        const alpha = (normalizedIntensity / 100) * 0.25; // 0-0.25
        return \`rgba(0,0,0,\${alpha.toFixed(2)})\`;
      }
    }

    // Convertir sombra CSS (color rgba) a intensidad (para cargar valores existentes)
    function shadowToIntensity(shadowValue, type = 'sm') {
      if (!shadowValue) return type === 'sm' ? 40 : 60;
      
      // Extraer alpha del color rgba
      const match = shadowValue.match(/rgba\\(0,0,0,([\\d.]+)\\)/);
      if (!match) {
        // Intentar formato alternativo sin espacios
        const match2 = shadowValue.match(/rgba\\(0,0,0,([\\d.]+)\\)/);
        if (match2) {
          const alpha = parseFloat(match2[1]);
          if (type === 'sm') {
            return Math.round((alpha / 0.15) * 100);
          } else {
            return Math.round((alpha / 0.25) * 100);
          }
        }
        return type === 'sm' ? 40 : 60;
      }
      
      const alpha = parseFloat(match[1]);
      
      // Calcular intensidad basada en alpha
      if (type === 'sm') {
        return Math.round((alpha / 0.15) * 100);
      } else {
        return Math.round((alpha / 0.25) * 100);
      }
    }

    // ============================================
    // API DE MUTACIÓN (OBLIGATORIA)
    // ============================================
    
    /**
     * FASE 2: API de mutación - setToken
     * Modifica un token individual y propaga cambios
     */
    function setToken(key, value) {
      window.themeState.tokens[key] = value;
      window.themeState.meta.dirty = true;
      propagateThemeChange();
    }

    /**
     * FASE 2: API de mutación - applyPresetTokens
     * Aplica un preset completo y propaga cambios
     */
    function applyPresetTokens(presetTokens) {
      window.themeState.tokens = { ...presetTokens };
      window.themeState.meta.dirty = true;
      
      // Actualizar pickr instances existentes (más eficiente que re-renderizar)
      [...PALETA_PRINCIPAL, ...PALETA_SUPERFICIES].forEach(item => {
        const token = item.token;
        const newColor = presetTokens[token];
        if (newColor && pickrInstances[token]) {
          pickrInstances[token].setColor(newColor);
          const trigger = document.getElementById(\`trigger-\${token}\`);
          if (trigger) {
            const colorDisplay = trigger.querySelector('.color-display');
            if (colorDisplay) {
              colorDisplay.style.backgroundColor = newColor;
            }
          }
        }
      });
      
      // Actualizar sliders de sombra
      PALETA_SOMBRAS.forEach(item => {
        const token = item.token;
        const newShadow = presetTokens[token];
        if (newShadow) {
          const shadowType = token === '--shadow-sm' ? 'sm' : 'md';
          const intensity = shadowToIntensity(newShadow, shadowType);
          
          const slider = document.getElementById(\`slider-\${token}\`);
          if (slider) {
            slider.value = intensity;
            const intensityDisplay = document.getElementById(\`intensity-\${token}\`);
            if (intensityDisplay) {
              intensityDisplay.textContent = \`\${intensity}%\`;
            }
            
            const previewBox = document.getElementById(\`preview-\${token}\`);
            if (previewBox) {
              const previewShadow = shadowType === 'sm' 
                ? \`0 2px 6px \${newShadow}\`
                : \`0 4px 12px \${newShadow}\`;
              previewBox.style.boxShadow = previewShadow;
            }
            
            const cssDisplay = document.getElementById(\`css-\${token}\`);
            if (cssDisplay) {
              cssDisplay.textContent = newShadow;
            }
          }
        }
      });
      
      // Propagar cambios (envía postMessage y actualiza UI)
      propagateThemeChange();
    }

    /**
     * FASE 2: API de mutación - loadDraft
     * Carga tokens desde servidor/localStorage y propaga cambios
     */
    function loadDraft(tokens) {
      window.themeState.tokens = { ...tokens };
      window.themeState.meta.dirty = false;
      propagateThemeChange();
      // Re-renderizar controles desde themeState
      renderAllControls();
    }

    /**
     * FASE 3: PROPAGACIÓN ÚNICA
     * Regenera CSS, envía postMessage al preview y actualiza UI
     */
    function propagateThemeChange() {
      // 1. Regenerar CSS desde themeState.tokens (si es necesario)
      // Por ahora, los tokens se aplican directamente vía postMessage
      
      // 2. Enviar postMessage al preview
      sendTokensToPreview();
      
      // 3. Actualizar UI (badges, botones, etc.)
      updateUIFromState();
    }

    /**
     * Envía tokens al preview vía postMessage
     */
    function sendTokensToPreview() {
      const iframe = document.getElementById('themePreviewFrame');
      if (!iframe || !iframe.contentWindow) return;
      
      try {
        iframe.contentWindow.postMessage({
          type: 'AP_THEME_TOKENS',
          tokens: window.themeState.tokens
        }, window.location.origin);
        
        console.log('[ThemeStudio] Tokens sent to preview:', Object.keys(window.themeState.tokens).length, 'tokens');
      } catch (e) {
        console.warn('[ThemeStudio] Error enviando tokens al preview:', e);
      }
    }

    /**
     * Actualiza UI desde themeState (badges, botones, etc.)
     */
    function updateUIFromState() {
      // Actualizar nombre en input si existe
      const nameInput = document.getElementById('themeNameInput');
      if (nameInput && window.themeState.meta.name) {
        nameInput.value = window.themeState.meta.name;
      }
      
      // Actualizar estado del botón publicar
      updatePublishButtonState();
      
      // Actualizar badge de publicado
      const badge = document.getElementById('publishedBadge');
      if (badge && window.themeState.meta.publishedVersion) {
        badge.style.display = 'inline-flex';
        badge.textContent = \`✓ Publicado (v\${window.themeState.meta.publishedVersion})\`;
      }
    }

    /**
     * FASE 1: Carga inicial de tokens (draft o published)
     * Carga desde servidor/localStorage y hidrata themeState
     */
    async function initializeThemeState() {
      // Inicializar themeState vacío
      window.themeState = {
        meta: {
          name: "",
          themeId: null,
          dirty: false,
          publishedVersion: null
        },
        tokens: {}
      };

      // Intentar cargar desde servidor primero
      try {
        const response = await fetch('/admin/themes/draft', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.draft && data.draft.values) {
            // Hidratar themeState con tokens del servidor
            window.themeState.meta.name = data.draft.name || "";
            window.themeState.meta.themeId = data.draft.themeId || null;
            window.themeState.tokens = { ...data.draft.values };
            
            if (window.themeState.meta.name) {
              document.getElementById('themeNameInput').value = window.themeState.meta.name;
            }
          }
        }
      } catch (e) {
        console.warn('Error cargando draft del servidor:', e);
      }
      
      // Fallback: cargar desde localStorage
      if (!window.themeState.tokens || Object.keys(window.themeState.tokens).length === 0) {
        const saved = localStorage.getItem('themeStudioDraft');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (parsed.values) {
              window.themeState.meta.name = parsed.name || "";
              window.themeState.meta.themeId = parsed.themeId || null;
              window.themeState.tokens = { ...parsed.values };
              
              if (window.themeState.meta.name) {
                document.getElementById('themeNameInput').value = window.themeState.meta.name;
              }
            }
          } catch (e) {
            console.warn('Error cargando draft de localStorage:', e);
          }
        }
      }
      
      // Inicializar valores faltantes con defaults
      [...PALETA_PRINCIPAL, ...PALETA_SUPERFICIES, ...PALETA_SOMBRAS].forEach(item => {
        if (!window.themeState.tokens[item.token]) {
          if (item.type === 'shadow') {
            window.themeState.tokens[item.token] = item.default || DEFAULT_VALUES[item.token] || "rgba(0,0,0,0.12)";
          } else {
            window.themeState.tokens[item.token] = DEFAULT_VALUES[item.token] || "#000000";
          }
        }
      });
      
      // Renderizar TODOS los controles desde themeState
      renderAllControls();
      
      // Si hay un themeId cargado, actualizar el Theme Manager después de un breve delay
      // para asegurar que el DOM esté listo
      if (window.themeState.meta.themeId) {
        setTimeout(() => {
          refreshThemesList();
        }, 500);
      }
    }

    /**
     * Re-renderiza todos los controles desde themeState
     */
    function renderAllControls() {
      renderPaletteTokens();
      renderSuperficiesTokens();
      renderShadowTokens();
    }

    // Renderizar tokens de la paleta
    // ❌ No leer valores desde inputs
    // ✅ Los inputs se pintan DESDE themeState
    function renderPaletteTokens() {
      const container = document.getElementById('paletteTokens');
      container.innerHTML = '';
      
      PALETA_PRINCIPAL.forEach(item => {
        const tokenEl = document.createElement('div');
        tokenEl.className = 'color-token';
        // Leer desde themeState, no desde inputs
        const currentColor = window.themeState.tokens[item.token] || DEFAULT_VALUES[item.token];
        tokenEl.innerHTML = \`
          <div class="color-token-label">
            <span class="color-token-name">\${item.label}</span>
            <span class="color-token-code">\${item.token}</span>
          </div>
          <div class="color-picker-wrapper">
            <div 
              class="color-picker-trigger" 
              id="trigger-\${item.token}"
              data-token="\${item.token}"
            >
              <div 
                class="color-display" 
                style="background-color: \${currentColor}"
              ></div>
            </div>
          </div>
        \`;
        container.appendChild(tokenEl);
      });
      
      // Inicializar color pickers después de renderizar
      initializeColorPickers();
    }

    // Renderizar tokens de superficies
    // ❌ No leer valores desde inputs
    // ✅ Los inputs se pintan DESDE themeState
    function renderSuperficiesTokens() {
      const container = document.getElementById('superficiesTokens');
      if (!container) return;
      
      container.innerHTML = '';
      
      PALETA_SUPERFICIES.forEach(item => {
        const tokenEl = document.createElement('div');
        tokenEl.className = 'color-token';
        // Leer desde themeState, no desde inputs
        const currentColor = window.themeState.tokens[item.token] || DEFAULT_VALUES[item.token];
        tokenEl.innerHTML = \`
          <div class="color-token-label">
            <span class="color-token-name">\${item.label}</span>
            <span class="color-token-code">\${item.token}</span>
          </div>
          <div class="color-picker-wrapper">
            <div 
              class="color-picker-trigger" 
              id="trigger-\${item.token}"
              data-token="\${item.token}"
            >
              <div 
                class="color-display" 
                style="background-color: \${currentColor}"
              ></div>
            </div>
          </div>
        \`;
        container.appendChild(tokenEl);
      });
      
      // Inicializar color pickers después de renderizar
      initializeColorPickers();
    }

    // Renderizar tokens de sombras (FASE 4: UI de controles con sliders)
    // ❌ No leer valores desde inputs
    // ✅ Los inputs se pintan DESDE themeState
    function renderShadowTokens() {
      const container = document.getElementById('sombrasTokens');
      if (!container) return;
      
      container.innerHTML = '';
      
      PALETA_SOMBRAS.forEach(item => {
        const tokenEl = document.createElement('div');
        tokenEl.className = 'shadow-token';
        
        // Obtener valor actual desde themeState o usar default
        const currentShadow = window.themeState.tokens[item.token] || item.default;
        
        // Convertir sombra a intensidad para el slider
        const shadowType = item.token === '--shadow-sm' ? 'sm' : 'md';
        const currentIntensity = shadowToIntensity(currentShadow, shadowType);
        
        tokenEl.innerHTML = \`
          <div class="shadow-token-label">
            <span class="shadow-token-name">\${item.label}</span>
            <span class="shadow-token-code">\${item.token}</span>
          </div>
          <div class="shadow-control-wrapper">
            <div class="shadow-slider-container">
              <div class="shadow-slider-label">
                <span>Intensidad</span>
                <span class="shadow-slider-value" id="intensity-\${item.token}">\${currentIntensity}%</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value="\${currentIntensity}"
                class="shadow-slider"
                id="slider-\${item.token}"
                data-token="\${item.token}"
                data-type="\${shadowType}"
              />
            </div>
            <div class="shadow-preview-container">
              <div 
                class="shadow-preview-box"
                id="preview-\${item.token}"
                style="box-shadow: 0 4px 12px \${currentShadow}"
              ></div>
              <div class="shadow-css-display" id="css-\${item.token}">\${currentShadow}</div>
            </div>
          </div>
        \`;
        container.appendChild(tokenEl);
      });
      
      // Inicializar event listeners para los sliders
      initializeShadowSliders();
    }

    // Inicializar sliders de sombra
    function initializeShadowSliders() {
      PALETA_SOMBRAS.forEach(item => {
        const slider = document.getElementById(\`slider-\${item.token}\`);
        if (!slider) return;
        
        const shadowType = item.token === '--shadow-sm' ? 'sm' : 'md';
        
        slider.addEventListener('input', (e) => {
          const intensity = parseInt(e.target.value);
          const shadowValue = generateShadow(intensity, shadowType);
          
          // ❌ No modificar tokens directamente
          // ✅ Usar API de mutación
          setToken(item.token, shadowValue);
          
          // Actualizar UI local del slider
          const intensityDisplay = document.getElementById(\`intensity-\${item.token}\`);
          if (intensityDisplay) {
            intensityDisplay.textContent = \`\${intensity}%\`;
          }
          
          const previewBox = document.getElementById(\`preview-\${item.token}\`);
          if (previewBox) {
            // Usar un valor de box-shadow completo para el preview visual
            const previewShadow = shadowType === 'sm' 
              ? \`0 2px 6px \${shadowValue}\`
              : \`0 4px 12px \${shadowValue}\`;
            previewBox.style.boxShadow = previewShadow;
          }
          
          const cssDisplay = document.getElementById(\`css-\${item.token}\`);
          if (cssDisplay) {
            cssDisplay.textContent = shadowValue;
          }
        });
      });
    }

    // Debounce eliminado - propagateThemeChange ya maneja todo

    // Inicializar color pickers con Pickr (FASE 2: Color picker PRO con mouse + alpha)
    const pickrInstances = {};
    
    function initializeColorPickers() {
      // Inicializar pickers de Paleta Principal
      PALETA_PRINCIPAL.forEach(item => {
        const token = item.token;
        // Leer desde themeState, no desde themeDraft
        const currentColor = window.themeState.tokens[token] || DEFAULT_VALUES[token];
        const trigger = document.getElementById(\`trigger-\${token}\`);
        
        if (!trigger || pickrInstances[token]) return; // Evitar duplicados
        
        // Crear instancia de Pickr
        const pickr = Pickr.create({
          el: trigger,
          theme: 'monolith',
          default: currentColor,
          swatches: [],
          components: {
            preview: true,
            opacity: true,
            hue: true,
            interaction: {
              hex: true,
              rgba: true,
              hsla: true,
              hsva: true,
              cmyk: true,
              input: true,
              clear: false,
              save: false
            }
          }
        });
        
        // Guardar instancia
        pickrInstances[token] = pickr;
        
        // Actualizar color cuando cambia
        pickr.on('change', (color) => {
          const hexColor = color.toHEXA().toString();
          
          // ❌ No modificar tokens directamente
          // ✅ Usar API de mutación
          setToken(token, hexColor);
          
          // Actualizar display
          const colorDisplay = trigger.querySelector('.color-display');
          if (colorDisplay) {
            colorDisplay.style.backgroundColor = hexColor;
          }
        });
      });

      // Inicializar pickers de Paleta Superficies
      PALETA_SUPERFICIES.forEach(item => {
        const token = item.token;
        // Leer desde themeState, no desde themeDraft
        const currentColor = window.themeState.tokens[token] || DEFAULT_VALUES[token];
        const trigger = document.getElementById(\`trigger-\${token}\`);
        
        if (!trigger || pickrInstances[token]) return; // Evitar duplicados
        
        // Crear instancia de Pickr
        const pickr = Pickr.create({
          el: trigger,
          theme: 'monolith',
          default: currentColor,
          swatches: [],
          components: {
            preview: true,
            opacity: true,
            hue: true,
            interaction: {
              hex: true,
              rgba: true,
              hsla: true,
              hsva: true,
              cmyk: true,
              input: true,
              clear: false,
              save: false
            }
          }
        });
        
        // Guardar instancia
        pickrInstances[token] = pickr;
        
        // Actualizar color cuando cambia
        pickr.on('change', (color) => {
          const hexColor = color.toHEXA().toString();
          
          // ❌ No modificar tokens directamente
          // ✅ Usar API de mutación
          setToken(token, hexColor);
          
          // Actualizar display
          const colorDisplay = trigger.querySelector('.color-display');
          if (colorDisplay) {
            colorDisplay.style.backgroundColor = hexColor;
          }
        });
      });
    }

    // sendTokensToPreview ya está en propagateThemeChange

    // FASE 5: Guardar Draft (sin publish)
    // ❌ No reconstruir tokens desde inputs
    // ✅ Enviar themeState.tokens al backend
    async function saveDraftToServer() {
      // Guardar en localStorage también
      const draftToSave = {
        name: window.themeState.meta.name,
        themeId: window.themeState.meta.themeId,
        values: window.themeState.tokens
      };
      localStorage.setItem('themeStudioDraft', JSON.stringify(draftToSave));
      
      try {
        const response = await fetch('/admin/themes/draft', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(draftToSave)
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('Draft guardado en servidor:', data);
          
          // Si éxito: themeState.meta.dirty = false
          window.themeState.meta.dirty = false;
          
          // Mostrar feedback visual
          const btn = document.getElementById('saveDraftBtn');
          const originalText = btn.textContent;
          btn.textContent = '✓ Guardado';
          btn.style.background = '#10b981';
          setTimeout(() => {
            btn.textContent = originalText;
            btn.style.background = '';
          }, 2000);
          return true;
        } else {
          console.warn('Error guardando draft en servidor');
          return false;
        }
      } catch (e) {
        console.warn('Error guardando draft:', e);
        return false;
      }
    }

    // Toggle sección Superficies
    function toggleSuperficies() {
      const section = document.getElementById('superficiesSection');
      if (section) {
        section.classList.toggle('collapsed');
        // Si se abre por primera vez, renderizar tokens
        if (!section.classList.contains('collapsed')) {
          renderSuperficiesTokens();
        }
      }
    }

    // Toggle sección Sombras
    function toggleSombras() {
      const section = document.getElementById('sombrasSection');
      if (section) {
        section.classList.toggle('collapsed');
        // Si se abre por primera vez, renderizar tokens
        if (!section.classList.contains('collapsed')) {
          renderShadowTokens();
        }
      }
    }

    // ============================================
    // PUBLISH v1 - Funcionalidad de publicación
    // ============================================

    /**
     * FASE 1: Validación previa de tokens mínimos
     * Verifica que existan --bg-main, --text-primary, --accent-primary
     */
    function validateMinimumTokens() {
      const requiredTokens = ['--bg-main', '--text-primary', '--accent-primary'];
      const missing = [];
      
      requiredTokens.forEach(token => {
        if (!window.themeState.tokens[token] || window.themeState.tokens[token].trim() === '') {
          missing.push(token);
        }
      });
      
      if (missing.length > 0) {
        return {
          valid: false,
          missing: missing,
          message: \`Faltan tokens requeridos: \${missing.join(', ')}. Por favor, completa estos valores antes de publicar.\`
        };
      }
      
      return { valid: true };
    }

    /**
     * Genera un themeId desde el nombre del tema
     * Convierte el nombre a slug (sin espacios, sin acentos, minúsculas)
     */
    function generateThemeId(name) {
      if (!name || name.trim() === '') {
        return null;
      }
      
      return name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Eliminar acentos
        .replace(/[^a-z0-9]+/g, '-') // Reemplazar caracteres especiales con guiones
        .replace(/^-+|-+$/g, ''); // Eliminar guiones al inicio y final
    }

    /**
     * Construye definition_json desde themeState
     * Formato esperado por el endpoint de publish
     */
    function buildDefinitionJson() {
      const themeId = window.themeState.meta.themeId || generateThemeId(window.themeState.meta.name);
      
      if (!themeId) {
        throw new Error('No se puede generar un ID de tema. Por favor, ingresa un nombre válido.');
      }
      
      return {
        id: themeId,
        name: window.themeState.meta.name || themeId,
        tokens: window.themeState.tokens,
        meta: {
          created_at: new Date().toISOString(),
          created_by: 'theme-studio'
        }
      };
    }

    /**
     * FASE 2: Maneja el click en el botón Publicar
     * Valida tokens mínimos y muestra modal de confirmación
     */
    function handlePublishClick() {
      // Validar tokens mínimos
      const validation = validateMinimumTokens();
      if (!validation.valid) {
        alert(validation.message);
        return;
      }
      
      // Validar que haya un nombre
      if (!window.themeState.meta.name || window.themeState.meta.name.trim() === '') {
        alert('Por favor, ingresa un nombre para el tema antes de publicar.');
        return;
      }
      
      // Mostrar modal de confirmación
      document.getElementById('publishModal').classList.add('active');
    }

    /**
     * Cierra el modal de confirmación
     */
    function closePublishModal() {
      document.getElementById('publishModal').classList.remove('active');
    }

    /**
     * FASE 3: Confirma y ejecuta la publicación
     * Llama al endpoint POST /admin/api/themes/:id/publish
     * Crea el tema si no existe antes de publicar
     */
    async function confirmPublish() {
      const publishBtn = document.getElementById('publishBtn');
      const confirmBtn = document.getElementById('confirmPublishBtn');
      
      // Deshabilitar botones durante la publicación
      publishBtn.disabled = true;
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Publicando...';
      
      try {
        // Construir definition_json
        const definitionJson = buildDefinitionJson();
        const themeId = definitionJson.id;
        const themeName = definitionJson.name;
        
        // Guardar draft primero (para asegurar que esté sincronizado)
        await saveDraftToServer();
        
        // Verificar si el tema existe, si no, crearlo
        let themeExists = false;
        try {
          const checkResponse = await fetch(\`/admin/api/themes/\${themeId}\`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json'
            }
          });
          themeExists = checkResponse.ok;
        } catch (e) {
          // Ignorar errores de verificación
        }
        
        // Si el tema no existe, crearlo primero
        if (!themeExists) {
          const createResponse = await fetch('/admin/api/themes', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              id: themeId,
              name: themeName
            })
          });
          
          if (!createResponse.ok) {
            const errorData = await createResponse.json();
            throw new Error(errorData.error || 'Error al crear el tema');
          }
          
          // Después de crear el tema, crear el draft en el servidor
          const draftResponse = await fetch(\`/admin/api/themes/\${themeId}/draft\`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              definition_json: definitionJson
            })
          });
          
          if (!draftResponse.ok) {
            const errorData = await draftResponse.json();
            throw new Error(errorData.error || 'Error al crear el draft');
          }
        } else {
          // Si el tema existe, actualizar el draft
          const draftResponse = await fetch(\`/admin/api/themes/\${themeId}/draft\`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              definition_json: definitionJson
            })
          });
          
          if (!draftResponse.ok) {
            const errorData = await draftResponse.json();
            throw new Error(errorData.error || 'Error al actualizar el draft');
          }
        }
        
        // Llamar al endpoint de publish
        const response = await fetch(\`/admin/api/themes/\${themeId}/publish\`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            release_notes: \`Publicado desde Theme Studio v2\`
          })
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || \`Error al publicar: \${response.status}\`);
        }
        
        const data = await response.json();
        
        // FASE 4: Feedback UX - Mostrar éxito
        window.themeState.meta.publishedVersion = data.version.version;
        window.themeState.meta.dirty = false;
        
        // Cerrar modal
        closePublishModal();
        
        // Mostrar feedback de éxito
        showPublishSuccess(data.version.version);
        
        // Actualizar estado del botón
        updatePublishButtonState();
        
        // Actualizar UI desde state
        updateUIFromState();
        
      } catch (error) {
        console.error('Error publicando tema:', error);
        alert(\`Error al publicar: \${error.message}\`);
      } finally {
        // Rehabilitar botones
        publishBtn.disabled = false;
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Confirmar publicación';
      }
    }

    /**
     * FASE 4: Muestra feedback de éxito tras publicar
     */
    function showPublishSuccess(version) {
      const publishBtn = document.getElementById('publishBtn');
      const originalText = publishBtn.textContent;
      const originalBg = publishBtn.style.background;
      
      publishBtn.textContent = \`✓ Publicado (v\${version})\`;
      publishBtn.style.background = '#10b981';
      publishBtn.disabled = true;
      
      setTimeout(() => {
        publishBtn.textContent = originalText;
        publishBtn.style.background = originalBg;
        updatePublishButtonState();
      }, 3000);
    }

    /**
     * Configura el estado inicial del botón de publicar
     * y detecta cambios para habilitar/deshabilitar
     */
    function setupPublishButtonState() {
      // Observar cambios en el nombre
      document.getElementById('themeNameInput').addEventListener('input', () => {
        window.themeState.meta.name = document.getElementById('themeNameInput').value;
        window.themeState.meta.dirty = true;
        updatePublishButtonState();
      });
      
      // Observar cambios en valores (se hace automáticamente vía setToken)
      // Se actualiza en propagateThemeChange -> updateUIFromState
      
      // Actualizar estado inicial
      updatePublishButtonState();
    }

    /**
     * Actualiza el estado del botón de publicar
     * Habilita si hay tokens mínimos y nombre, deshabilita si no
     */
    function updatePublishButtonState() {
      const publishBtn = document.getElementById('publishBtn');
      const validation = validateMinimumTokens();
      const hasName = window.themeState.meta.name && window.themeState.meta.name.trim() !== '';
      
      if (validation.valid && hasName) {
        publishBtn.disabled = false;
      } else {
        publishBtn.disabled = true;
      }
    }

    // ============================================
    // THEME MANAGER v1 - Gestión de múltiples temas
    // ============================================
    
    /**
     * Carga la lista de temas desde el backend
     */
    async function loadThemesList() {
      try {
        const response = await fetch('/admin/api/themes', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          throw new Error(`Error ${response.status} al cargar temas`);
        }
        
        const data = await response.json();
        return data.themes || [];
      } catch (error) {
        console.error('[ThemeManager] Error cargando lista de temas:', error);
        return [];
      }
    }
    
    /**
     * Renderiza la lista de temas en el panel
     */
    function renderThemesList(themes) {
      const themeList = document.getElementById('themeList');
      if (!themeList) return;
      
      if (themes.length === 0) {
        themeList.innerHTML = '<li style="color: #94a3b8; padding: 12px; text-align: center; font-size: 0.9rem;">No hay temas disponibles</li>';
        return;
      }
      
      const currentThemeId = window.themeState.meta.themeId;
      
      themeList.innerHTML = themes.map(theme => {
        const isActive = theme.id === currentThemeId;
        const status = theme.current_published_version ? 'published' : 'draft';
        const statusLabel = status === 'published' ? '✅ Published' : '📝 Draft';
        const versionText = theme.current_published_version ? `v${theme.current_published_version}` : '';
        
        return \`
          <li class="theme-item \${isActive ? 'active' : ''}" data-theme-id="\${theme.id}">
            <div class="theme-item-name">\${theme.name || theme.id}</div>
            <div class="theme-item-meta">
              <span class="theme-status \${status}">\${statusLabel}</span>
              \${versionText ? \`<span class="theme-version">\${versionText}</span>\` : ''}
            </div>
          </li>
        \`;
      }).join('');
      
      // Añadir event listeners a cada item
      themeList.querySelectorAll('.theme-item').forEach(item => {
        item.addEventListener('click', () => {
          const themeId = item.getAttribute('data-theme-id');
          if (themeId) {
            loadThemeIntoStudio(themeId);
          }
        });
      });
    }
    
    /**
     * Carga un tema en el Studio
     * Obtiene el draft del tema y lo carga en themeState
     */
    async function loadThemeIntoStudio(themeId) {
      try {
        // Mostrar indicador de carga
        const themeList = document.getElementById('themeList');
        const originalContent = themeList.innerHTML;
        themeList.innerHTML = '<li style="color: #94a3b8; padding: 12px; text-align: center; font-size: 0.9rem;">Cargando tema...</li>';
        
        // Obtener el tema completo (incluye draft)
        const response = await fetch(\`/admin/api/themes/\${themeId}\`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          throw new Error(\`Error \${response.status} al cargar el tema\`);
        }
        
        const data = await response.json();
        const theme = data.theme;
        
        if (!theme) {
          throw new Error('Tema no encontrado');
        }
        
        // Cargar draft en themeState
        // El endpoint devuelve: { theme: {...}, draft: {...}, published_version: {...} }
        if (data.draft && data.draft.definition_json) {
          const definition = data.draft.definition_json;
          
          // Actualizar themeState
          window.themeState.meta.name = definition.name || theme.name || themeId;
          window.themeState.meta.themeId = theme.id;
          window.themeState.meta.dirty = false;
          window.themeState.meta.publishedVersion = theme.current_published_version || null;
          
          // Cargar tokens desde definition_json
          if (definition.tokens && typeof definition.tokens === 'object') {
            window.themeState.tokens = { ...definition.tokens };
          } else {
            // Si no hay tokens, usar valores por defecto
            window.themeState.tokens = { ...DEFAULT_VALUES };
          }
          
          // Actualizar nombre en input
          const nameInput = document.getElementById('themeNameInput');
          if (nameInput) {
            nameInput.value = window.themeState.meta.name;
          }
          
          // Re-renderizar controles desde themeState
          renderAllControls();
          
          // Propagar cambios al preview
          propagateThemeChange();
          
          // Actualizar UI
          updateUIFromState();
          
          // Recargar lista de temas para actualizar indicador activo
          refreshThemesList();
          
          console.log('[ThemeManager] Tema cargado:', themeId);
        } else {
          // Si no hay draft, crear uno vacío
          window.themeState.meta.name = theme.name || themeId;
          window.themeState.meta.themeId = themeId;
          window.themeState.meta.dirty = false;
          window.themeState.meta.publishedVersion = theme.current_published_version || null;
          window.themeState.tokens = { ...DEFAULT_VALUES };
          
          const nameInput = document.getElementById('themeNameInput');
          if (nameInput) {
            nameInput.value = window.themeState.meta.name;
          }
          
          renderAllControls();
          propagateThemeChange();
          updateUIFromState();
          refreshThemesList();
        }
        
      } catch (error) {
        console.error('[ThemeManager] Error cargando tema:', error);
        alert(\`Error al cargar el tema: \${error.message}\`);
        
        // Restaurar lista
        refreshThemesList();
      }
    }
    
    /**
     * Recarga la lista de temas
     */
    async function refreshThemesList() {
      const themes = await loadThemesList();
      renderThemesList(themes);
    }
    
    /**
     * Inicializa el Theme Manager
     */
    async function initializeThemeManager() {
      // Cargar lista inicial
      await refreshThemesList();
      
      // Configurar toggle de colapsar/expandir
      const toggleBtn = document.getElementById('themeManagerToggle');
      const panel = document.getElementById('themeManagerPanel');
      
      if (toggleBtn && panel) {
        toggleBtn.addEventListener('click', () => {
          panel.classList.toggle('collapsed');
          toggleBtn.textContent = panel.classList.contains('collapsed') ? '☰' : '×';
        });
      }
    }

    // ============================================
    // PRESETS v1 - Funcionalidad de presets
    // ============================================

    /**
     * FASE 6: Aplica un preset al editor
     * ❌ No tocar inputs directamente
     * ✅ Llamar SOLO a applyPresetTokens(preset.tokens)
     * ✅ inputs se re-renderizan desde themeState
     */
    function applyPreset(presetId) {
      const preset = THEME_PRESETS.find(p => p.id === presetId);
      if (!preset) {
        console.warn('Preset no encontrado:', presetId);
        return;
      }

      // Llamar SOLO a applyPresetTokens(preset.tokens)
      // Esta función ya propaga cambios y re-renderiza controles
      applyPresetTokens(preset.tokens);

      // Log de debug para presets
      console.log('[ThemeStudio] Preset applied:', presetId, preset.label);

      // Mostrar feedback
      showPresetToast(preset.label);

      // Cerrar dropdown
      closePresetsDropdown();
    }

    /**
     * Muestra el dropdown de presets
     */
    function togglePresetsDropdown() {
      const dropdown = document.getElementById('presetsDropdown');
      if (dropdown) {
        dropdown.classList.toggle('active');
      }
    }

    /**
     * Cierra el dropdown de presets
     */
    function closePresetsDropdown() {
      const dropdown = document.getElementById('presetsDropdown');
      if (dropdown) {
        dropdown.classList.remove('active');
      }
    }

    /**
     * Muestra toast de feedback al aplicar preset
     */
    function showPresetToast(presetLabel) {
      const toast = document.getElementById('presetToast');
      if (!toast) return;

      toast.textContent = \`Preset aplicado: \${presetLabel}\`;
      toast.classList.add('show');

      setTimeout(() => {
        toast.classList.remove('show');
      }, 2500);
    }

    /**
     * Inicializa eventos de presets
     */
    function setupPresets() {
      const presetsBtn = document.getElementById('presetsBtn');
      const dropdown = document.getElementById('presetsDropdown');
      const presetItems = dropdown.querySelectorAll('.preset-item');

      // Toggle dropdown al hacer clic en el botón
      if (presetsBtn) {
        presetsBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          togglePresetsDropdown();
        });
      }

      // Aplicar preset al hacer clic en un item
      presetItems.forEach(item => {
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          const presetId = item.getAttribute('data-preset-id');
          if (presetId) {
            applyPreset(presetId);
          }
        });
      });

      // Cerrar dropdown al hacer clic fuera
      document.addEventListener('click', (e) => {
        if (dropdown && !dropdown.contains(e.target) && e.target !== presetsBtn) {
          closePresetsDropdown();
        }
      });
    }


    // Inicializar aplicación
    (async function init() {
      // FASE 1: Inicializar themeState (carga draft si existe)
      await initializeThemeState();
      
      // Guardar draft al cambiar nombre
      document.getElementById('themeNameInput').addEventListener('input', () => {
        window.themeState.meta.name = document.getElementById('themeNameInput').value;
        window.themeState.meta.dirty = true;
      });
      
      // Botón guardar draft
      document.getElementById('saveDraftBtn').addEventListener('click', saveDraftToServer);
      
      // Botón publicar
      document.getElementById('publishBtn').addEventListener('click', handlePublishClick);
      document.getElementById('confirmPublishBtn').addEventListener('click', confirmPublish);
      
      // Detectar cambios en el draft para habilitar/deshabilitar botón publicar
      setupPublishButtonState();
      
      // Inicializar presets
      setupPresets();
      
      // Inicializar Theme Manager (después de initializeThemeState para que detecte tema activo)
      await initializeThemeManager();
      
      // FASE 4: Inicializar preview cuando el iframe esté listo
      // El preview SOLO escucha postMessage
      const iframe = document.getElementById('themePreviewFrame');
      iframe.addEventListener('load', () => {
        // Enviar tokens iniciales al preview vía propagateThemeChange
        setTimeout(() => {
          propagateThemeChange();
        }, 150);
      });
      
      // También intentar enviar inmediatamente si el iframe ya está cargado
      setTimeout(() => {
        propagateThemeChange();
      }, 300);
    })();
  </script>
</body>
</html>
  `;

  // #region agent log
  fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin-themes-studio-ui.js:2268',message:'After HTML construction',data:{htmlLength:html?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  // #endregion

  // #region agent log
  fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin-themes-studio-ui.js:2271',message:'Before renderHtml',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  // #endregion
  
  let response;
  try {
    response = renderHtml(html);
    // #region agent log
    fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin-themes-studio-ui.js:2278',message:'After renderHtml',data:{isResponse:response instanceof Response,status:response?.status},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
  } catch (renderError) {
    // #region agent log
    fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin-themes-studio-ui.js:2282',message:'Error in renderHtml',data:{error:renderError?.message,stack:renderError?.stack},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    throw renderError;
  }
  
  return response;
}

