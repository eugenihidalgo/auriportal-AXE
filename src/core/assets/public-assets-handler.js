/**
 * PUBLIC ASSETS HANDLER v1 - Gate canónico para assets públicos
 * 
 * PRINCIPIO CONSTITUCIONAL:
 * Cualquier request a /public/* debe resolverse como ASSET y devolver el fichero
 * (o 404 de asset), NUNCA HTML.
 * 
 * INVARIANTE ABSOLUTA:
 * - Para .js: Content-Type debe ser application/javascript (o text/javascript)
 * - El body debe ser JS real, NUNCA HTML
 * - Si el asset no existe: devolver 404 de ASSET (text/plain o JSON), pero NUNCA render UI HTML
 * 
 * RESPONSABILIDADES:
 * - Verificar si un pathname es un asset público
 * - Servir el asset con Content-Type correcto
 * - Proteger contra path traversal
 * - Validar que archivos JS no sean HTML
 * - Devolver 404 de asset (no HTML) si no existe
 * 
 * ═══════════════════════════════════════════════════════════════
 * REGLAS CONSTITUCIONALES:
 * - JAMÁS llamar a renderMasterPage ni a renderHtml en assets
 * - JAMÁS devolver HTML como respuesta de asset
 * - 404 siempre como asset (text/plain o JSON), nunca HTML
 * ═══════════════════════════════════════════════════════════════
 */

import { readFileSync, existsSync } from 'fs';
import { PUBLIC_ASSETS_ROOT, resolvePublicAsset } from '../robustness/public-assets-root.js';
import { getErrorDefensiveHeaders } from '../responses.js';
import { getRequestId } from '../observability/request-context.js';

/**
 * Verifica si un pathname es un asset público que debe ser manejado por este handler
 * @param {string} pathname - Pathname de la request
 * @returns {boolean} true si es un asset público
 */
export function canHandlePublicAsset(pathname) {
  return pathname.startsWith('/public/') || 
         pathname.startsWith('/css/') || 
         pathname.startsWith('/js/') || 
         pathname.startsWith('/uploads/');
}

/**
 * Maneja un request de asset público
 * @param {Request} req - Request object
 * @param {Object} options - Opciones
 * @param {string} options.publicRootAbsPath - Ruta absoluta a la carpeta public (opcional, usa PUBLIC_ASSETS_ROOT por defecto)
 * @returns {Promise<Response>} Respuesta con el asset o 404 de asset
 */
export async function handlePublicAsset(req, { publicRootAbsPath } = {}) {
  const pathname = new URL(req.url).pathname;
  const traceId = getRequestId() || `asset-${Date.now()}`;
  
  try {
    // Normalizar la ruta usando source of truth único
    let fullPath;
    if (pathname.startsWith('/uploads/')) {
      // uploads/ es subdirectorio de public/
      const uploadPath = pathname.slice(9); // quitar '/uploads/'
      fullPath = resolvePublicAsset(`uploads/${uploadPath}`);
    } else if (pathname.startsWith('/public/')) {
      // /public/js/... -> js/...
      fullPath = resolvePublicAsset(pathname.slice(8)); // quitar '/public/'
    } else {
      // /js/... o /css/... -> js/... o css/...
      fullPath = resolvePublicAsset(pathname.slice(1)); // quitar leading '/'
    }
    
    // Verificar que el archivo esté dentro de public (seguridad - proteger de .. traversal)
    if (!fullPath.startsWith(PUBLIC_ASSETS_ROOT)) {
      console.error(`[PublicAssets] Ruta fuera de public: ${fullPath}`);
      return new Response(JSON.stringify({
        ok: false,
        error: 'Forbidden',
        code: 'FORBIDDEN',
        trace_id: traceId
      }), { 
        status: 403,
        headers: { 
          'Content-Type': 'application/json; charset=utf-8',
          ...getErrorDefensiveHeaders()
        }
      });
    }
    
    // Verificar que el archivo existe
    if (!existsSync(fullPath)) {
      console.error(`[PublicAssets] Archivo no encontrado: ${fullPath}`);
      // 404 de ASSET (NO HTML) - text/plain o JSON
      return new Response(JSON.stringify({
        ok: false,
        error: 'Asset not found',
        code: 'NOT_FOUND_ASSET',
        trace_id: traceId,
        path: pathname
      }), { 
        status: 404,
        headers: { 
          'Content-Type': 'application/json; charset=utf-8',
          ...getErrorDefensiveHeaders()
        }
      });
    }
    
    // Obtener extensión para Content-Type
    const ext = fullPath.split('.').pop().toLowerCase();
    const isJsFile = ext === 'js';
    
    // FASE 3: Hardening - Verificar que el archivo NO sea HTML antes de servir como JS
    if (isJsFile) {
      // Leer primeros bytes para verificar que NO es HTML
      const firstBytes = readFileSync(fullPath, { encoding: 'utf-8', flag: 'r', start: 0, end: 300 });
      if (firstBytes.trim().startsWith('<!DOCTYPE') || firstBytes.trim().startsWith('<html') || firstBytes.includes('<body')) {
        console.error(`[PublicAssets] 🔴 CRÍTICO: Archivo JS contiene HTML: ${fullPath}`);
        return new Response(JSON.stringify({
          ok: false,
          error: 'Asset corrupted: HTML served as JavaScript',
          code: 'HTML_SERVED_AS_JS',
          trace_id: traceId,
          file: pathname
        }), { 
          status: 500,
          headers: { 
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
            ...getErrorDefensiveHeaders()
          }
        });
      }
    }
    
    // Leer el archivo completo
    const content = readFileSync(fullPath);
    
    // Mapa de Content-Type por extensión
    const contentType = {
      'css': 'text/css; charset=utf-8',
      'js': 'application/javascript; charset=utf-8',
      'json': 'application/json; charset=utf-8',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'svg': 'image/svg+xml',
      'ico': 'image/x-icon',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'woff': 'font/woff',
      'woff2': 'font/woff2',
      'ttf': 'font/ttf',
      'eot': 'application/vnd.ms-fontobject'
    }[ext] || 'application/octet-stream';
    
    console.log(`[PublicAssets] Sirviendo asset: ${pathname} -> ${fullPath} (${content.length} bytes, ${contentType})`);
    
    // Determinar Cache-Control según si está versionado
    const urlObj = new URL(req.url);
    const hasVersionParam = urlObj.searchParams.has('v');
    const isDevOrBeta = process.env.APP_ENV === 'development' || process.env.APP_ENV === 'beta';
    
    // Si tiene parámetro v= (versionado), cache largo es seguro
    // Si no tiene, usar cache corto para forzar actualización
    const cacheControl = hasVersionParam 
      ? 'public, max-age=31536000, immutable' // 1 año, solo si está versionado
      : (isDevOrBeta ? 'no-cache' : 'public, max-age=3600'); // 1 hora si no está versionado
    
    return new Response(content, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': cacheControl,
        'Access-Control-Allow-Origin': '*', // Permitir CORS para assets
        'Content-Length': content.length.toString()
      }
    });
  } catch (error) {
    // CRÍTICO: Cualquier error en archivos estáticos debe devolver 404 de ASSET, nunca 500 HTML
    console.error(`[PublicAssets] Error sirviendo asset ${pathname}:`, error.message);
    return new Response(JSON.stringify({
      ok: false,
      error: 'Asset error',
      code: 'ASSET_ERROR',
      trace_id: traceId,
      path: pathname
    }), { 
      status: 404,
      headers: { 
        'Content-Type': 'application/json; charset=utf-8',
        ...getErrorDefensiveHeaders()
      }
    });
  }
}


