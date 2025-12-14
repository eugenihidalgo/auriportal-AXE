// src/endpoints/eugeni-admin-portal.js
// Portal de administración personal de Eugeni Hidalgo
// Portal completamente separado de AuriPortal para gestionar todos los programas y funcionalidades del servidor

import {
  getControlTranscripciones,
  actualizarControlTranscripciones,
  getHistorialTranscripciones,
  procesarTranscripcionesManual
} from '../services/whisper-transcripciones.js';
import { agregarRegistroDNS } from '../services/cloudflare-dns.js';
import { query } from '../../database/pg.js';
import { getSystemInfo } from '../services/resource-monitor.js';

export default async function eugeniAdminPortalHandler(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;
  
  // API endpoints
  if (path.startsWith('/api/')) {
    return handleAPI(request, env, url);
  }
  
  // Página principal del portal
  return renderMainPortal(env, url);
}

/**
 * Maneja requests de API
 */
async function handleAPI(request, env, url) {
  const path = url.pathname;
  const method = request.method;

  // API de Whisper Transcripciones
  if (path === '/api/whisper/control' && method === 'POST') {
    const body = await request.json();
    const result = await actualizarControlTranscripciones(body.activo);
    return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
  }

  if (path === '/api/whisper/procesar-manual' && method === 'POST') {
    const result = await procesarTranscripcionesManual(env);
    return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
  }

  if (path === '/api/whisper/historial' && method === 'GET') {
    const page = parseInt(url.searchParams.get('page')) || 1;
    const limit = parseInt(url.searchParams.get('limit')) || 20;
    const estado = url.searchParams.get('estado') || null;
    const historial = await getHistorialTranscripciones(page, limit, estado);
    return new Response(JSON.stringify(historial), { headers: { 'Content-Type': 'application/json' } });
  }

  // API de estado del sistema
  if (path === '/api/system/status' && method === 'GET') {
    const systemInfo = await getSystemInfo();
    return new Response(JSON.stringify(systemInfo), { headers: { 'Content-Type': 'application/json' } });
  }

  // API para obtener progreso de transcripción en tiempo real
  if (path === '/api/whisper/progreso' && method === 'GET') {
    const archivoId = url.searchParams.get('archivo_id');
    if (!archivoId) {
      return new Response(JSON.stringify({ error: 'archivo_id requerido' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    
    try {
      const result = await query(
        'SELECT archivo_nombre, estado, progreso_porcentaje, tiempo_estimado_restante, fecha_inicio FROM whisper_transcripciones WHERE archivo_id = $1',
        [archivoId]
      );
      
      if (result.rows.length === 0) {
        return new Response(JSON.stringify({ error: 'Transcripción no encontrada' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
      }
      
      return new Response(JSON.stringify(result.rows[0]), { headers: { 'Content-Type': 'application/json' } });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  }

  // API para obtener estado del control de transcripciones
  if (path === '/api/whisper/status' && method === 'GET') {
    try {
      const control = await getControlTranscripciones();
      return new Response(JSON.stringify({ 
        control: {
          activo: control.activo,
          total_procesados: control.total_procesados || 0,
          total_exitosos: control.total_exitosos || 0,
          total_fallidos: control.total_fallidos || 0,
          ultima_ejecucion: control.ultima_ejecucion
        }
      }), { headers: { 'Content-Type': 'application/json' } });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  }

  // API para obtener transcripción actual en progreso
  if (path === '/api/whisper/transcripcion-actual' && method === 'GET') {
    try {
      // Primero verificar si el sistema está activo
      const control = await getControlTranscripciones();
      if (!control.activo) {
        return new Response(JSON.stringify({ activa: false, pausado: true }), { headers: { 'Content-Type': 'application/json' } });
      }
      
      const result = await query(
        'SELECT * FROM whisper_transcripciones WHERE estado = $1 ORDER BY fecha_inicio DESC LIMIT 1',
        ['procesando']
      );
      
      if (result.rows.length === 0) {
        return new Response(JSON.stringify({ activa: false }), { headers: { 'Content-Type': 'application/json' } });
      }
      
      const transcripcion = result.rows[0];
      const tiempoTranscurrido = transcripcion.fecha_inicio 
        ? Math.floor((Date.now() - new Date(transcripcion.fecha_inicio).getTime()) / 1000)
        : 0;
      
      return new Response(JSON.stringify({
        activa: true,
        archivo_nombre: transcripcion.archivo_nombre,
        progreso_porcentaje: transcripcion.progreso_porcentaje || 0,
        tiempo_estimado_restante: transcripcion.tiempo_estimado_restante || 0,
        tiempo_transcurrido: tiempoTranscurrido,
        modelo_usado: transcripcion.modelo_usado,
        tamaño_archivo_mb: transcripcion.tamaño_archivo_mb
      }), { headers: { 'Content-Type': 'application/json' } });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  }

  return new Response(JSON.stringify({ error: 'API endpoint no encontrado' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
}

/**
 * Renderiza el portal principal de administración
 */
async function renderMainPortal(env, url) {
  const control = await getControlTranscripciones();
  const historial = await getHistorialTranscripciones(1, 20);
  const systemInfo = await getSystemInfo();

  const pageTitle = 'Portal de Administración - Eugeni Hidalgo';
  
  return new Response(`
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${pageTitle}</title>
    <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🎤</text></svg>">
    <link href="/css/tailwind.css" rel="stylesheet">
    <style>
        body {
            font-family: 'Inter', sans-serif;
            background: linear-gradient(135deg, #1a202c 0%, #2d3748 100%);
            color: #e2e8f0;
            min-height: 100vh;
        }
        .container {
            max-width: 1400px;
        }
        .card {
            background-color: #2d3748;
            border-radius: 0.75rem;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
            border: 1px solid #4a5568;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .card:hover {
            transform: translateY(-2px);
            box-shadow: 0 15px 35px -5px rgba(0, 0, 0, 0.4);
        }
        .header {
            background: linear-gradient(135deg, #222b38 0%, #1a202c 100%);
            padding: 2rem;
            border-bottom: 2px solid #4a5568;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2);
        }
        .btn-primary {
            background: linear-gradient(135deg, #4299e1 0%, #3182ce 100%);
            color: white;
            padding: 0.75rem 1.5rem;
            border-radius: 0.5rem;
            font-weight: 600;
            transition: all 0.2s;
            border: none;
            cursor: pointer;
        }
        .btn-primary:hover {
            background: linear-gradient(135deg, #3182ce 0%, #2c5282 100%);
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(66, 153, 225, 0.4);
        }
        .btn-danger {
            background: linear-gradient(135deg, #fc8181 0%, #f56565 100%);
            color: white;
            padding: 0.75rem 1.5rem;
            border-radius: 0.5rem;
            font-weight: 600;
            transition: all 0.2s;
            border: none;
            cursor: pointer;
        }
        .btn-danger:hover {
            background: linear-gradient(135deg, #f56565 0%, #e53e3e 100%);
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(252, 129, 129, 0.4);
        }
        .status-badge {
            padding: 0.5rem 1rem;
            border-radius: 0.5rem;
            font-size: 0.875rem;
            font-weight: bold;
            display: inline-block;
        }
        .status-active { background-color: #48bb78; color: white; }
        .status-paused { background-color: #f56565; color: white; }
        .status-processing { background-color: #4299e1; color: white; }
        .status-completed { background-color: #48bb78; color: white; }
        .status-error { background-color: #e53e3e; color: white; }
        .module-card {
            background: linear-gradient(135deg, #2d3748 0%, #1a202c 100%);
            border: 1px solid #4a5568;
            border-radius: 0.75rem;
            padding: 1.5rem;
            transition: all 0.3s;
        }
        .module-card:hover {
            border-color: #4299e1;
            box-shadow: 0 8px 20px rgba(66, 153, 225, 0.2);
        }
        table {
            width: 100%;
            border-collapse: collapse;
        }
        th, td {
            padding: 1rem;
            text-align: left;
            border-bottom: 1px solid #4a5568;
        }
        th {
            background-color: #1a202c;
            font-weight: 600;
            color: #cbd5e0;
        }
        tr:hover {
            background-color: #374151;
        }
        .stat-card {
            background: linear-gradient(135deg, #2d3748 0%, #1a202c 100%);
            border: 1px solid #4a5568;
            border-radius: 0.75rem;
            padding: 1.5rem;
        }
        .stat-value {
            font-size: 2.5rem;
            font-weight: bold;
            background: linear-gradient(135deg, #4299e1 0%, #9f7aea 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
    </style>
</head>
<body class="antialiased">
    <div class="header">
        <div class="container mx-auto">
            <h1 class="text-4xl font-bold text-white mb-2">Portal de Administración</h1>
            <p class="text-gray-400 text-lg">Gestión centralizada de todos los programas y servicios del servidor</p>
        </div>
    </div>
    
    <div class="container mx-auto p-6">
        <!-- Módulos Principales -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <!-- Módulo: Whisper Transcripciones -->
            <div class="module-card">
                <h2 class="text-2xl font-semibold mb-4 text-white">🎤 Whisper Transcripciones</h2>
                <p class="text-gray-400 mb-4">Sistema de transcripción automática de audio</p>
                <div class="mb-4">
                    <p class="text-sm mb-2">
                        Estado: 
                        <span id="whisper-status" class="status-badge ${control.activo ? 'status-active' : 'status-paused'}">
                            ${control.activo ? 'ACTIVO' : 'PAUSADO'}
                        </span>
                    </p>
                    <p class="text-sm text-gray-400">Procesados: ${control.total_procesados || 0}</p>
                    <p class="text-sm text-gray-400">Exitosos: <span class="text-green-400">${control.total_exitosos || 0}</span></p>
                    <p class="text-sm text-gray-400">Fallidos: <span class="text-red-400">${control.total_fallidos || 0}</span></p>
                </div>
                
                <!-- Progreso de Transcripción Actual -->
                <div id="progreso-transcripcion" class="mb-4 p-3 bg-gray-800 rounded-lg" style="display: none;">
                    <p class="text-sm font-semibold text-white mb-2">🎵 Transcribiendo:</p>
                    <p id="archivo-actual" class="text-sm text-blue-400 mb-2 font-medium"></p>
                    <div class="w-full bg-gray-700 rounded-full h-2.5 mb-2">
                        <div id="barra-progreso" class="bg-blue-500 h-2.5 rounded-full transition-all duration-300" style="width: 0%"></div>
                    </div>
                    <div class="flex justify-between text-xs text-gray-400">
                        <span id="porcentaje-progreso">0%</span>
                        <span id="tiempo-restante">Calculando...</span>
                    </div>
                </div>
                
                <div class="flex space-x-2">
                    <button id="btn-whisper-pausar" class="btn-danger text-sm ${control.activo ? '' : 'opacity-50 cursor-not-allowed'}" ${control.activo ? '' : 'disabled'}>Pausar</button>
                    <button id="btn-whisper-activar" class="btn-primary text-sm ${control.activo ? 'opacity-50 cursor-not-allowed' : ''}" ${control.activo ? 'disabled' : ''}>Activar</button>
                    <button id="btn-whisper-procesar" class="btn-primary text-sm">Procesar</button>
                </div>
            </div>

            <!-- Módulo: Estado del Sistema -->
            <div class="module-card">
                <h2 class="text-2xl font-semibold mb-4 text-white">💻 Estado del Sistema</h2>
                <p class="text-gray-400 mb-4">Recursos y rendimiento del servidor</p>
                <div class="space-y-2">
                    <div>
                        <p class="text-sm text-gray-400">RAM Disponible</p>
                        <p class="text-xl font-bold text-green-400">${systemInfo.memoria?.available?.toFixed(2) || 'N/A'} GB</p>
                    </div>
                    <div>
                        <p class="text-sm text-gray-400">RAM Total</p>
                        <p class="text-xl font-bold">${systemInfo.memoria?.total?.toFixed(2) || 'N/A'} GB</p>
                    </div>
                    <div>
                        <p class="text-sm text-gray-400">CPU Carga</p>
                        <p class="text-xl font-bold">${systemInfo.cpu?.loadPercent?.toFixed(1) || 'N/A'}%</p>
                    </div>
                    <div>
                        <p class="text-sm text-gray-400">Procesos Whisper</p>
                        <p class="text-xl font-bold">${systemInfo.whisperProcesses || 0}</p>
                    </div>
                </div>
                <button id="btn-refresh-system" class="btn-primary text-sm mt-4 w-full">Actualizar</button>
            </div>

            <!-- Módulo: Próximos Módulos -->
            <div class="module-card">
                <h2 class="text-2xl font-semibold mb-4 text-white">🚀 Próximos Módulos</h2>
                <p class="text-gray-400 mb-4">Módulos adicionales se agregarán aquí</p>
                <ul class="text-sm text-gray-400 space-y-2">
                    <li>• Ollama AI</li>
                    <li>• Gestión de Bases de Datos</li>
                    <li>• Monitoreo de Servicios</li>
                    <li>• Logs y Análisis</li>
                </ul>
            </div>
        </div>

        <!-- Historial de Transcripciones -->
        <div class="card p-6 mb-6">
            <h2 class="text-2xl font-semibold mb-4">📋 Historial de Transcripciones Whisper</h2>
            <div class="overflow-x-auto">
                <table>
                    <thead>
                        <tr>
                            <th>Archivo</th>
                            <th>Modelo</th>
                            <th>Estado</th>
                            <th>Duración</th>
                            <th>Tamaño</th>
                            <th>Fecha</th>
                        </tr>
                    </thead>
                    <tbody id="historial-body">
                        ${historial.registros.map(t => `
                            <tr>
                                <td><a href="https://drive.google.com/file/d/${t.archivo_id}" target="_blank" class="text-blue-400 hover:underline">${t.archivo_nombre}</a></td>
                                <td>${t.modelo_usado ? t.modelo_usado.toUpperCase() : 'N/A'}</td>
                                <td><span class="status-badge status-${t.estado}">${t.estado.toUpperCase()}</span></td>
                                <td>${t.duracion_segundos ? `${t.duracion_segundos}s` : 'N/A'}</td>
                                <td>${t.tamaño_archivo_mb ? `${t.tamaño_archivo_mb}MB` : 'N/A'}</td>
                                <td>${new Date(t.fecha_inicio).toLocaleString()}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <script>
        // Actualizar estado de Whisper
        const updateWhisperStatus = (status) => {
            const statusBadge = document.getElementById('whisper-status');
            statusBadge.textContent = status.activo ? 'ACTIVO' : 'PAUSADO';
            statusBadge.className = \`status-badge \${status.activo ? 'status-active' : 'status-paused'}\`;
            document.getElementById('btn-whisper-pausar').disabled = !status.activo;
            document.getElementById('btn-whisper-pausar').classList.toggle('opacity-50', !status.activo);
            document.getElementById('btn-whisper-activar').disabled = status.activo;
            document.getElementById('btn-whisper-activar').classList.toggle('opacity-50', status.activo);
        };

        // Botones de Whisper
        document.getElementById('btn-whisper-pausar').addEventListener('click', async () => {
            const res = await fetch('/api/whisper/control', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ activo: false })
            });
            const data = await res.json();
            if (data.success) {
                updateWhisperStatus({ activo: false });
                alert('Transcripciones pausadas');
            }
        });

        document.getElementById('btn-whisper-activar').addEventListener('click', async () => {
            const res = await fetch('/api/whisper/control', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ activo: true })
            });
            const data = await res.json();
            if (data.success) {
                updateWhisperStatus({ activo: true });
                alert('Transcripciones activadas');
            }
        });

        document.getElementById('btn-whisper-procesar').addEventListener('click', async () => {
            alert('Iniciando procesamiento manual...');
            const res = await fetch('/api/whisper/procesar-manual', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                alert('Procesamiento iniciado. Revisa el historial en unos minutos.');
                location.reload();
            } else {
                alert('Error: ' + data.error);
            }
        });

        // Actualizar estado del sistema
        document.getElementById('btn-refresh-system').addEventListener('click', () => {
            location.reload();
        });

        // Función para actualizar progreso de transcripción
        const actualizarProgreso = async () => {
            try {
                // Primero verificar el estado del control
                const statusRes = await fetch('/api/whisper/status');
                if (!statusRes.ok) return;
                const statusData = await statusRes.json();
                
                // Si está pausado, no mostrar progreso
                if (!statusData.control || !statusData.control.activo) {
                    document.getElementById('progreso-transcripcion').style.display = 'none';
                    return;
                }
                
                const res = await fetch('/api/whisper/transcripcion-actual');
                const data = await res.json();
                
                const progresoDiv = document.getElementById('progreso-transcripcion');
                const archivoActual = document.getElementById('archivo-actual');
                const barraProgreso = document.getElementById('barra-progreso');
                const porcentajeProgreso = document.getElementById('porcentaje-progreso');
                const tiempoRestante = document.getElementById('tiempo-restante');
                
                if (data.activa && !data.pausado) {
                    progresoDiv.style.display = 'block';
                    archivoActual.textContent = data.archivo_nombre || 'Procesando...';
                    const porcentaje = data.progreso_porcentaje || 0;
                    barraProgreso.style.width = porcentaje + '%';
                    porcentajeProgreso.textContent = porcentaje + '%';
                    
                    // Formatear tiempo restante
                    const segundosRestantes = data.tiempo_estimado_restante || 0;
                    if (segundosRestantes > 0) {
                        const minutos = Math.floor(segundosRestantes / 60);
                        const segundos = segundosRestantes % 60;
                        if (minutos > 0) {
                            tiempoRestante.textContent = '~' + minutos + 'm ' + segundos + 's restantes';
                        } else {
                            tiempoRestante.textContent = '~' + segundos + 's restantes';
                        }
                    } else {
                        tiempoRestante.textContent = 'Finalizando...';
                    }
                } else {
                    progresoDiv.style.display = 'none';
                }
            } catch (error) {
                console.error('Error actualizando progreso:', error);
            }
        };
        
        // Actualizar progreso cada 2 segundos
        setInterval(actualizarProgreso, 2000);
        actualizarProgreso(); // Ejecutar inmediatamente
        
        // Actualizar estado del control cada 5 segundos
        const actualizarEstadoControl = async () => {
            try {
                const res = await fetch('/api/whisper/status');
                if (res.ok) {
                    const data = await res.json();
                    if (data.control) {
                        updateWhisperStatus(data.control);
                    }
                }
            } catch (error) {
                console.error('Error actualizando estado del control:', error);
            }
        };
        setInterval(actualizarEstadoControl, 5000);
        actualizarEstadoControl(); // Ejecutar inmediatamente
        
        // Actualizar estado cada 30 segundos
        setInterval(async () => {
            const res = await fetch('/api/whisper/status');
            const data = await res.json();
            if (data.control) {
                updateWhisperStatus(data.control);
            }
        }, 30000);
    </script>
</body>
</html>
  `, {
    headers: { 'Content-Type': 'text/html' }
  });
}

