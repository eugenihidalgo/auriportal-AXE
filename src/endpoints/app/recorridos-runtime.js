// src/endpoints/app/recorridos-runtime.js
// Runtime Web Real de Recorridos para Alumnos
//
// Este es el runtime INDEPENDIENTE del admin preview.
// Los alumnos acceden a recorridos publicados por URL pública.
//
// Rutas:
// - GET  /r/:recorrido_slug - Iniciar o continuar recorrido
// - POST /r/:recorrido_slug/next - Avanzar al siguiente step

import { getCookieData } from '../../core/cookies.js';
import { getOrCreateStudent } from '../../modules/student-v4.js';
import { getDefaultRecorridoRepo } from '../../infra/repos/recorrido-repo-pg.js';
import { getDefaultRecorridoVersionRepo } from '../../infra/repos/recorrido-version-repo-pg.js';
import { getDefaultRecorridoRunRepo } from '../../infra/repos/recorrido-run-repo-pg.js';
import { executeRunEngine } from '../../core/recorridos/runtime/run-engine.js';
import { renderRunHTML } from '../../core/recorridos/runtime/render-run.js';
import { logError, logInfo, logWarn } from '../../core/observability/logger.js';
import { getErrorDefensiveHeaders } from '../../core/responses.js';

/**
 * Handler para GET /r/:recorrido_slug
 * Inicia o continúa un recorrido publicado
 */
export async function handleGetRecorridoRuntime(request, env, recorridoSlug) {
  try {
    logInfo('RecorridoRuntime', 'GET /r/:slug recibido', { slug: recorridoSlug });

    // Obtener estudiante (temporal: usar email fijo por ahora)
    const cookie = getCookieData(request);
    const userEmail = cookie?.email || 'guest@example.com'; // Temporal: fijo por ahora
    const student = await getOrCreateStudent(userEmail, env);

    // Obtener recorrido por ID (el slug es el ID por ahora)
    const recorridoRepo = getDefaultRecorridoRepo();
    const recorrido = await recorridoRepo.getRecorridoById(recorridoSlug);

    if (!recorrido) {
      logWarn('RecorridoRuntime', 'Recorrido no encontrado', { slug: recorridoSlug });
      return new Response('Recorrido no encontrado', {
        status: 404,
        headers: {
          'Content-Type': 'text/html; charset=UTF-8',
          ...getErrorDefensiveHeaders()
        }
      });
    }

    // Obtener última versión publicada
    // Si hay versión publicada, el recorrido está disponible (independiente del status del recorrido)
    const versionRepo = getDefaultRecorridoVersionRepo();
    const version = await versionRepo.getLatestVersion(recorridoSlug);

    if (!version) {
      logWarn('RecorridoRuntime', 'No hay versión publicada', { 
        slug: recorridoSlug,
        recorrido_status: recorrido.status 
      });
      return new Response('Este recorrido no está disponible. No hay versión publicada.', {
        status: 404,
        headers: {
          'Content-Type': 'text/html; charset=UTF-8',
          ...getErrorDefensiveHeaders()
        }
      });
    }

    const definition = version.definition_json;

    // Obtener o crear run activo
    const runRepo = getDefaultRecorridoRunRepo();
    let run = await runRepo.getActiveRunForUser({
      user_id: userEmail, // Temporal: usar email como user_id
      recorrido_id: recorridoSlug
    });

    if (!run) {
      // Crear nuevo run
      run = await runRepo.createRun({
        user_id: userEmail,
        recorrido_id: recorridoSlug,
        version: version.version,
        entry_step_id: definition.entry_step_id
      });
      logInfo('RecorridoRuntime', 'Run creado', { run_id: run.run_id });
    }

    // Ejecutar engine para obtener el step actual
    const engineResult = await executeRunEngine({
      definition,
      run,
      context: run.state_json || {}
    });

    if (!engineResult.ok) {
      logError('RecorridoRuntime', 'Error en run engine', {
        error: engineResult.error,
        run_id: run.run_id
      });
      return new Response(`Error ejecutando recorrido: ${engineResult.error}`, {
        status: 500,
        headers: {
          'Content-Type': 'text/html; charset=UTF-8',
          ...getErrorDefensiveHeaders()
        }
      });
    }

    // Renderizar HTML del step actual
    const html = await renderRunHTML({
      definition,
      step: engineResult.currentStep,
      run,
      student
    });

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=UTF-8',
        'Cache-Control': 'no-store'
      }
    });

  } catch (error) {
    logError('RecorridoRuntime', 'Error en GET /r/:slug', {
      error: error.message,
      stack: error.stack,
      slug: recorridoSlug
    });
    return new Response('Error interno del servidor', {
      status: 500,
      headers: {
        'Content-Type': 'text/html; charset=UTF-8',
        ...getErrorDefensiveHeaders()
      }
    });
  }
}

/**
 * Handler para POST /r/:recorrido_slug/next
 * Avanza al siguiente step del recorrido
 */
export async function handlePostRecorridoNext(request, env, recorridoSlug) {
  try {
    logInfo('RecorridoRuntime', 'POST /r/:slug/next recibido', { slug: recorridoSlug });

    // Obtener estudiante
    const cookie = getCookieData(request);
    const userEmail = cookie?.email || 'guest@example.com'; // Temporal
    const student = await getOrCreateStudent(userEmail, env);

    // Obtener run activo
    const runRepo = getDefaultRecorridoRunRepo();
    const run = await runRepo.getActiveRunForUser({
      user_id: userEmail,
      recorrido_id: recorridoSlug
    });

    if (!run) {
      logWarn('RecorridoRuntime', 'Run no encontrado para POST /next', { slug: recorridoSlug });
      return new Response('No hay recorrido activo', {
        status: 404,
        headers: {
          'Content-Type': 'text/html; charset=UTF-8',
          ...getErrorDefensiveHeaders()
        }
      });
    }

    // Obtener versión del recorrido
    const versionRepo = getDefaultRecorridoVersionRepo();
    const version = await versionRepo.getVersion(recorridoSlug, run.version);

    if (!version) {
      logWarn('RecorridoRuntime', 'Versión no encontrada', { 
        slug: recorridoSlug, 
        version: run.version 
      });
      return new Response('Versión del recorrido no encontrada', {
        status: 404,
        headers: {
          'Content-Type': 'text/html; charset=UTF-8',
          ...getErrorDefensiveHeaders()
        }
      });
    }

    const definition = version.definition_json;

    // Leer datos del formulario (capture)
    let captureData = {};
    try {
      const formData = await request.formData();
      for (const [key, value] of formData.entries()) {
        captureData[key] = value;
      }
    } catch (e) {
      // Si no hay formData, continuar con capture vacío
    }

    // Ejecutar engine para avanzar
    const engineResult = await executeRunEngine({
      definition,
      run,
      context: run.state_json || {},
      capture: captureData,
      action: 'next'
    });

    if (!engineResult.ok) {
      logError('RecorridoRuntime', 'Error avanzando en run engine', {
        error: engineResult.error,
        run_id: run.run_id
      });
      return new Response(`Error avanzando: ${engineResult.error}`, {
        status: 500,
        headers: {
          'Content-Type': 'text/html; charset=UTF-8',
          ...getErrorDefensiveHeaders()
        }
      });
    }

    // Actualizar run con nuevo step y context
    await runRepo.updateRun(run.run_id, {
      current_step_id: engineResult.nextStepId,
      state_json: engineResult.context
    });

    // Si el recorrido terminó, marcar como completado
    if (engineResult.completed) {
      await runRepo.updateRun(run.run_id, {
        status: 'completed'
      });
    }

    // Renderizar HTML del siguiente step
    const html = await renderRunHTML({
      definition,
      step: engineResult.currentStep,
      run: {
        ...run,
        current_step_id: engineResult.nextStepId,
        state_json: engineResult.context
      },
      student
    });

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=UTF-8',
        'Cache-Control': 'no-store'
      }
    });

  } catch (error) {
    logError('RecorridoRuntime', 'Error en POST /r/:slug/next', {
      error: error.message,
      stack: error.stack,
      slug: recorridoSlug
    });
    return new Response('Error interno del servidor', {
      status: 500,
      headers: {
        'Content-Type': 'text/html; charset=UTF-8',
        ...getErrorDefensiveHeaders()
      }
    });
  }
}

