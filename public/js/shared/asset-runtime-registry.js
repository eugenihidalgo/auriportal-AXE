/**
 * ASSET RUNTIME REGISTRY v1 - AuriPortal
 * 
 * Registry canónico para rastrear estado de carga de assets en runtime.
 * Garantiza diagnóstico 100% explícito de qué assets fallaron, por qué, y cuándo.
 * 
 * PRINCIPIOS:
 * - Idempotente (puede inicializarse múltiples veces sin efectos secundarios)
 * - Sin dependencias (usable desde cualquier dominio: MASTER/ADMIN/CLIENT)
 * - DOM API únicamente (no innerHTML para overlays)
 * - Logging estructurado con prefijos canónicos
 * 
 * USO:
 * - Importar desde loader de scripts
 * - Marcar inicio de carga con markAssetStart()
 * - Marcar éxito con markAssetSuccess() o fallo con markAssetFailure()
 * - Renderizar overlay de error con renderAssetFailureOverlay()
 * 
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║ ⚠️  MASTER RULE: no HTML in JS strings (constitutional)                     ║
 * ║                                                                              ║
 * ║ PROHIBIDO:                                                                   ║
 * ║ ❌ innerHTML                                                                 ║
 * ║ ❌ template literals con HTML                                                ║
 * ║                                                                              ║
 * ║ OBLIGATORIO:                                                                 ║
 * ║ ✅ DOM API (createElement, appendChild, textContent, classList)             ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

/**
 * Inicializa el registry si no existe
 * Idempotente: puede llamarse múltiples veces sin efectos secundarios
 */
function ensureRegistry() {
  if (!window.__AP_ASSETS__) {
    window.__AP_ASSETS__ = {
      domain_context: window.__AP_CONTEXT__ || 'UNKNOWN',
      assets: {},
      app_version: window.__AP_APP_VERSION__ || 'unknown',
      build_id: window.__AP_BUILD_ID__ || 'unknown',
      initialized_at: Date.now()
    };
  }
  return window.__AP_ASSETS__;
}

/**
 * Obtiene el registry de assets
 * @returns {Object} Registry de assets
 */
export function getAssetRegistry() {
  return ensureRegistry();
}

/**
 * Marca el inicio de carga de un asset
 * @param {Object} meta - Metadatos del asset
 * @param {string} meta.id - ID lógico del asset (ej: 'master-sidebar-client')
 * @param {string} meta.url - URL del asset
 * @param {string} meta.name - Nombre del asset (opcional, defaults a id)
 * @param {string} meta.expected_type - Tipo esperado ('js' | 'css')
 * @param {boolean} meta.critical - Si es crítico (default: false)
 * @returns {string} ID del asset registrado
 */
export function markAssetStart(meta) {
  const registry = ensureRegistry();
  const assetId = meta.id || meta.url;
  const startTs = Date.now();
  
  registry.assets[assetId] = {
    id: assetId,
    name: meta.name || assetId,
    url: meta.url,
    expected_type: meta.expected_type || 'js',
    critical: meta.critical || false,
    domain_context: registry.domain_context,
    start_ts: startTs,
    status: 'loading',
    failure_reason: null,
    content_type: null,
    first_bytes_sniff: null,
    duration_ms: null
  };
  
  return assetId;
}

/**
 * Marca el éxito de carga de un asset
 * @param {string} assetId - ID del asset
 * @param {Object} extra - Información adicional (opcional)
 * @param {string} extra.content_type - Content-Type observado
 * @param {string} extra.first_bytes_sniff - Primeros bytes (sanitizado, máximo 100 chars)
 */
export function markAssetSuccess(assetId, extra = {}) {
  const registry = ensureRegistry();
  const asset = registry.assets[assetId];
  
  if (!asset) {
    console.warn(`[ASSETS] markAssetSuccess: asset ${assetId} no encontrado en registry`);
    return;
  }
  
  const endTs = Date.now();
  asset.status = 'loaded';
  asset.end_ts = endTs;
  asset.duration_ms = endTs - asset.start_ts;
  
  if (extra.content_type) {
    asset.content_type = extra.content_type;
  }
  
  if (extra.first_bytes_sniff) {
    // Sanitizar: máximo 100 chars, remover caracteres de control
    asset.first_bytes_sniff = String(extra.first_bytes_sniff)
      .substring(0, 100)
      .replace(/[\x00-\x1F\x7F]/g, '');
  }
}

/**
 * Marca el fallo de carga de un asset
 * @param {string} assetId - ID del asset
 * @param {Object} errorInfo - Información del error
 * @param {string} errorInfo.reason - Razón del fallo
 * @param {string} errorInfo.content_type - Content-Type observado (si aplica)
 * @param {string} errorInfo.first_bytes_sniff - Primeros bytes (si aplica)
 */
export function markAssetFailure(assetId, errorInfo) {
  const registry = ensureRegistry();
  const asset = registry.assets[assetId];
  
  if (!asset) {
    console.warn(`[ASSETS] markAssetFailure: asset ${assetId} no encontrado en registry`);
    // Crear entrada de emergencia
    ensureRegistry().assets[assetId] = {
      id: assetId,
      name: assetId,
      url: errorInfo.url || assetId,
      expected_type: 'js',
      critical: false,
      domain_context: registry.domain_context,
      start_ts: Date.now(),
      status: 'failed',
      failure_reason: errorInfo.reason || 'unknown',
      content_type: errorInfo.content_type || null,
      first_bytes_sniff: errorInfo.first_bytes_sniff ? String(errorInfo.first_bytes_sniff).substring(0, 100).replace(/[\x00-\x1F\x7F]/g, '') : null,
      duration_ms: null
    };
    return;
  }
  
  const endTs = Date.now();
  asset.status = 'failed';
  asset.end_ts = endTs;
  asset.duration_ms = endTs - asset.start_ts;
  asset.failure_reason = errorInfo.reason || 'unknown';
  
  if (errorInfo.content_type) {
    asset.content_type = errorInfo.content_type;
  }
  
  if (errorInfo.first_bytes_sniff) {
    asset.first_bytes_sniff = String(errorInfo.first_bytes_sniff)
      .substring(0, 100)
      .replace(/[\x00-\x1F\x7F]/g, '');
  }
  
  // Log estructurado
  const logData = {
    asset_id: assetId,
    asset_name: asset.name,
    url: asset.url,
    reason: asset.failure_reason,
    content_type: asset.content_type,
    critical: asset.critical,
    domain_context: asset.domain_context,
    app_version: registry.app_version,
    build_id: registry.build_id,
    timestamp: new Date().toISOString()
  };
  
  console.error(`[ASSETS][${asset.domain_context}] ❌ Asset falló: ${asset.name}`, logData);
}

/**
 * Renderiza un overlay de error visible para fallos de assets críticos
 * Solo usa DOM API (sin innerHTML)
 * @param {Object} errorInfo - Información del error
 * @param {string} errorInfo.asset_name - Nombre del asset
 * @param {string} errorInfo.url - URL del asset
 * @param {string} errorInfo.reason - Razón del fallo
 * @param {string} errorInfo.content_type - Content-Type observado
 * @param {string} errorInfo.domain_context - Contexto de dominio
 * @param {string} errorInfo.app_version - Versión de la app
 * @param {string} errorInfo.build_id - Build ID
 * @param {string} errorInfo.trace_id - Trace ID (opcional)
 */
export function renderAssetFailureOverlay(errorInfo) {
  // Verificar si ya existe un overlay (evitar duplicados)
  const existingOverlay = document.getElementById('ap-asset-failure-overlay');
  if (existingOverlay) {
    return; // Ya existe, no crear otro
  }
  
  // Crear contenedor principal usando DOM API
  const overlay = document.createElement('div');
  overlay.id = 'ap-asset-failure-overlay';
  
  // Estilos inline (permitidos según reglas constitucionales para overlays críticos)
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.9);
    z-index: 99999;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #f1f5f9;
  `;
  
  // Crear contenido usando DOM API
  const container = document.createElement('div');
  container.style.cssText = `
    background-color: #1e293b;
    border: 2px solid #ef4444;
    border-radius: 8px;
    padding: 2rem;
    max-width: 600px;
    margin: 1rem;
  `;
  
  // Título
  const title = document.createElement('h1');
  title.style.cssText = 'color: #ef4444; margin: 0 0 1rem 0; font-size: 1.5rem;';
  title.textContent = '❌ Error de Carga de Asset Crítico';
  
  // Mensaje principal
  const message = document.createElement('p');
  message.style.cssText = 'color: #f1f5f9; margin: 0 0 1.5rem 0; line-height: 1.6;';
  message.textContent = `El asset "${errorInfo.asset_name || 'desconocido'}" no pudo cargarse correctamente.`;
  
  // Detalles
  const details = document.createElement('div');
  details.style.cssText = 'background-color: #0f172a; padding: 1rem; border-radius: 4px; font-family: monospace; font-size: 0.875rem;';
  
  const detailsList = [
    `Asset: ${errorInfo.asset_name || 'N/A'}`,
    `URL: ${errorInfo.url || 'N/A'}`,
    `Razón: ${errorInfo.reason || 'unknown'}`,
    `Content-Type: ${errorInfo.content_type || 'N/A'}`,
    `Dominio: ${errorInfo.domain_context || 'UNKNOWN'}`,
    `App Version: ${errorInfo.app_version || 'unknown'}`,
    `Build ID: ${errorInfo.build_id || 'unknown'}`,
    errorInfo.trace_id ? `Trace ID: ${errorInfo.trace_id}` : null,
    `Timestamp: ${new Date().toISOString()}`
  ].filter(Boolean);
  
  detailsList.forEach(detail => {
    const detailLine = document.createElement('div');
    detailLine.style.cssText = 'margin: 0.25rem 0; color: #94a3b8;';
    detailLine.textContent = detail;
    details.appendChild(detailLine);
  });
  
  // Instrucciones
  const instructions = document.createElement('p');
  instructions.style.cssText = 'color: #94a3b8; margin: 1rem 0 0 0; font-size: 0.875rem;';
  instructions.textContent = 'Por favor, recarga la página. Si el problema persiste, contacta al administrador.';
  
  // Ensamblar usando DOM API
  container.appendChild(title);
  container.appendChild(message);
  container.appendChild(details);
  container.appendChild(instructions);
  overlay.appendChild(container);
  
  // Añadir al DOM
  document.body.appendChild(overlay);
  
  console.error(`[ASSETS][${errorInfo.domain_context || 'UNKNOWN'}] ❌ Overlay de error renderizado para asset: ${errorInfo.asset_name}`);
}

