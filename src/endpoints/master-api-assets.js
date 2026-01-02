/**
 * MASTER API ASSETS - AuriPortal Master
 * 
 * Endpoint de diagnóstico para el Sistema de Assets Canónico v1.
 * Expone información del contrato required_scripts y permite comparar
 * "contrato" vs "runtime" (si está disponible en el cliente).
 * 
 * GET /master/api/__assets
 * 
 * Respuesta JSON:
 * {
 *   app_version: string,
 *   build_id: string,
 *   domain_context: 'MASTER',
 *   required_scripts: Array<Object>,
 *   timestamp: string (ISO)
 * }
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default async function masterApiAssetsHandler(request, env, ctx) {
  // Solo GET permitido
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({
      error: 'Method not allowed',
      allowed: ['GET']
    }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
      }
    });
  }
  
  try {
    // Leer contrato
    const registryPath = join(__dirname, '../core/master/registry/master-layout-registry.v1.json');
    const registryContent = readFileSync(registryPath, 'utf-8');
    const registry = JSON.parse(registryContent);
    const requiredScripts = registry.required_scripts || [];
    
    // Normalizar scripts (igual que en master-page-renderer.js)
    const normalizedScripts = requiredScripts.map(script => {
      if (typeof script === 'string') {
        const path = script;
        const id = path.split('/').pop().replace('.js', '');
        return {
          id,
          path,
          type: 'module',
          required: true,
          critical: false,
          phase: 'ui',
          name: id
        };
      }
      return {
        id: script.id || script.path?.split('/').pop().replace('.js', ''),
        path: script.path || script.src,
        type: script.type || 'module',
        required: script.required !== false,
        critical: script.critical === true,
        phase: script.phase || 'ui',
        name: script.name || script.id || script.path?.split('/').pop().replace('.js', '')
      };
    });
    
    // Construir respuesta
    const response = {
      app_version: process.env.APP_VERSION || 'unknown',
      build_id: process.env.BUILD_ID || 'unknown',
      domain_context: 'MASTER',
      required_scripts: normalizedScripts,
      timestamp: new Date().toISOString()
    };
    
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
      }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Error leyendo contrato de assets',
      message: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
      }
    });
  }
}

