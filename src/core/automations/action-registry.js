// src/core/automations/action-registry.js
// Registry canónico de acciones para el motor de automatizaciones
//
// Define todas las acciones disponibles que pueden ejecutarse cuando se dispara una automatización.
// Cada acción tiene:
// - type: identificador único
// - label: nombre legible
// - description: descripción
// - config_schema: schema JSON simple para UI dinámica
// - run: función que ejecuta la acción

/**
 * Catálogo de acciones disponibles
 * 
 * @returns {Array<Object>} Array de definiciones de acciones
 */
export function getActionCatalog() {
  return [
    {
      type: 'progress.increment_streak',
      label: 'Incrementar Racha',
      description: 'Incrementa la racha diaria del estudiante',
      config_schema: {
        fields: [
          {
            name: 'force',
            label: 'Forzar incremento',
            type: 'boolean',
            default: false,
            description: 'Si true, incrementa la racha incluso si ya practicó hoy'
          }
        ]
      }
    },
    {
      type: 'analytics.track',
      label: 'Registrar Evento Analytics',
      description: 'Registra un evento en analytics_events',
      config_schema: {
        fields: [
          {
            name: 'event_name',
            label: 'Nombre del evento',
            type: 'string',
            required: true,
            description: 'Nombre del evento (ej: "automation_triggered")'
          },
          {
            name: 'props',
            label: 'Propiedades adicionales',
            type: 'object',
            default: {},
            description: 'Propiedades adicionales del evento (JSON)'
          }
        ]
      }
    },
    {
      type: 'energy.append_event',
      label: 'Añadir Evento Energético',
      description: 'Añade un evento a energy_events',
      config_schema: {
        fields: [
          {
            name: 'event_type',
            label: 'Tipo de evento',
            type: 'string',
            required: true,
            description: 'Tipo de evento energético (ej: "automation_triggered")'
          },
          {
            name: 'metadata',
            label: 'Metadatos',
            type: 'object',
            default: {},
            description: 'Metadatos adicionales del evento (JSON)'
          }
        ]
      }
    },
    {
      type: 'notify.send_email',
      label: 'Enviar Email',
      description: 'Envía un email (stub - requiere configuración SMTP)',
      config_schema: {
        fields: [
          {
            name: 'to',
            label: 'Destinatario',
            type: 'string',
            required: true,
            description: 'Email del destinatario (puede usar {{student.email}} para variables)'
          },
          {
            name: 'subject',
            label: 'Asunto',
            type: 'string',
            required: true,
            description: 'Asunto del email'
          },
          {
            name: 'body',
            label: 'Cuerpo',
            type: 'string',
            required: true,
            description: 'Cuerpo del email (puede ser HTML o texto)'
          }
        ]
      }
    },
    {
      type: 'http.webhook.call',
      label: 'Llamar Webhook HTTP',
      description: 'Hace una llamada HTTP POST a un webhook externo',
      config_schema: {
        fields: [
          {
            name: 'url',
            label: 'URL del Webhook',
            type: 'string',
            required: true,
            description: 'URL completa del webhook (ej: https://example.com/webhook)'
          },
          {
            name: 'method',
            label: 'Método HTTP',
            type: 'string',
            default: 'POST',
            description: 'Método HTTP (POST, GET, PUT, etc.)'
          },
          {
            name: 'headers',
            label: 'Headers',
            type: 'object',
            default: {},
            description: 'Headers HTTP adicionales (JSON)'
          },
          {
            name: 'body',
            label: 'Body',
            type: 'object',
            default: {},
            description: 'Body de la petición (se serializa como JSON)'
          },
          {
            name: 'timeout',
            label: 'Timeout (ms)',
            type: 'number',
            default: 5000,
            description: 'Timeout en milisegundos (default: 5000)'
          }
        ]
      }
    },
    {
      type: 'google.drive.upload',
      label: 'Subir a Google Drive',
      description: 'Sube un archivo a Google Drive (stub - requiere configuración OAuth)',
      config_schema: {
        fields: [
          {
            name: 'file_name',
            label: 'Nombre del archivo',
            type: 'string',
            required: true,
            description: 'Nombre del archivo a subir'
          },
          {
            name: 'file_content',
            label: 'Contenido del archivo',
            type: 'string',
            required: true,
            description: 'Contenido del archivo (texto o base64)'
          },
          {
            name: 'mime_type',
            label: 'Tipo MIME',
            type: 'string',
            default: 'text/plain',
            description: 'Tipo MIME del archivo (ej: text/plain, application/json)'
          },
          {
            name: 'folder_id',
            label: 'ID de Carpeta',
            type: 'string',
            description: 'ID de la carpeta en Drive (opcional)'
          }
        ]
      }
    }
  ];
}

/**
 * Obtiene el runner de una acción por su tipo
 * 
 * @param {string} type - Tipo de acción
 * @returns {Function|null} Runner de la acción o null si no existe
 */
export function getActionRunner(type) {
  const runners = {
    'progress.increment_streak': runIncrementStreak,
    'analytics.track': runAnalyticsTrack,
    'energy.append_event': runEnergyAppendEvent,
    'notify.send_email': runSendEmail,
    'http.webhook.call': runWebhookCall,
    'google.drive.upload': runDriveUpload
  };
  
  return runners[type] || null;
}

/**
 * Runner: progress.increment_streak
 * Incrementa la racha del estudiante
 */
async function runIncrementStreak({ signal, actionConfig, ctx, dryRun }) {
  const { force = false } = actionConfig || {};
  const studentId = signal.runtime?.student_id;
  
  if (!studentId) {
    return {
      success: false,
      error: 'student_id no disponible en runtime'
    };
  }

  if (dryRun) {
    return {
      success: true,
      dryRun: true,
      message: `[DRY-RUN] Incrementaría racha para student_id=${studentId}, force=${force}`
    };
  }

  try {
    // Intentar importar el módulo de streak
    const { checkDailyStreak } = await import('../../modules/streak.js');
    const { findStudentByEmail } = await import('../../modules/student.js');
    
    // Obtener estudiante (necesitamos email, pero tenemos student_id)
    // Por ahora, intentamos obtener el estudiante desde la BD
    const { getDefaultStudentRepo } = await import('../../infra/repos/student-repo-pg.js');
    const studentRepo = getDefaultStudentRepo();
    const student = await studentRepo.getStudentById(studentId);
    
    if (!student) {
      return {
        success: false,
        error: `Estudiante con id=${studentId} no encontrado`
      };
    }

    // Ejecutar incremento de racha
    const result = await checkDailyStreak(student, ctx.env || {}, { forcePractice: force });
    
    return {
      success: true,
      result: {
        streak: result.streak,
        todayPracticed: result.todayPracticed,
        motivationalPhrase: result.motivationalPhrase
      }
    };
  } catch (error) {
    console.error('[AUTO_ACTION][increment_streak] Error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Runner: analytics.track
 * Registra un evento en analytics
 */
async function runAnalyticsTrack({ signal, actionConfig, ctx, dryRun }) {
  const { event_name, props = {} } = actionConfig || {};
  
  if (!event_name) {
    return {
      success: false,
      error: 'event_name es requerido'
    };
  }

  if (dryRun) {
    return {
      success: true,
      dryRun: true,
      message: `[DRY-RUN] Registraría evento analytics: ${event_name}`
    };
  }

  try {
    const { getDefaultAnalyticsRepo } = await import('../../infra/repos/analytics-repo-pg.js');
    const analyticsRepo = getDefaultAnalyticsRepo();
    
    const studentId = signal.runtime?.student_id;
    const actorType = studentId ? 'student' : 'system';
    
    const event = {
      actorType,
      actorId: studentId || null,
      source: 'server',
      eventName: event_name,
      appVersion: process.env.APP_VERSION || 'unknown',
      buildId: process.env.BUILD_ID || 'unknown',
      props: {
        ...props,
        automation_triggered: true,
        signal_key: signal.signal_key
      }
    };

    await analyticsRepo.recordEvent(event);
    
    return {
      success: true,
      result: {
        event_name,
        recorded: true
      }
    };
  } catch (error) {
    console.error('[AUTO_ACTION][analytics.track] Error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Runner: energy.append_event
 * Añade un evento energético
 */
async function runEnergyAppendEvent({ signal, actionConfig, ctx, dryRun }) {
  const { event_type, metadata = {} } = actionConfig || {};
  
  if (!event_type) {
    return {
      success: false,
      error: 'event_type es requerido'
    };
  }

  if (dryRun) {
    return {
      success: true,
      dryRun: true,
      message: `[DRY-RUN] Añadiría evento energético: ${event_type}`
    };
  }

  try {
    const { insertEnergyEvent } = await import('../energy/energy-events.js');
    
    const studentId = signal.runtime?.student_id;
    const actorType = studentId ? 'alumno' : 'system';
    
    const result = await insertEnergyEvent({
      event_type,
      actor_type: actorType,
      actor_id: studentId || null,
      alumno_id: studentId || null,
      origin: 'automation_engine',
      metadata: {
        ...metadata,
        automation_triggered: true,
        signal_key: signal.signal_key
      },
      ctx: ctx || {}
    });
    
    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Error desconocido al insertar evento energético'
      };
    }
    
    return {
      success: true,
      result: {
        event_type,
        event_id: result.event_id,
        recorded: true
      }
    };
  } catch (error) {
    console.error('[AUTO_ACTION][energy.append_event] Error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Runner: notify.send_email
 * Envía un email (stub con console/log si no hay SMTP)
 */
async function runSendEmail({ signal, actionConfig, ctx, dryRun }) {
  const { to, subject, body } = actionConfig || {};
  
  if (!to || !subject || !body) {
    return {
      success: false,
      error: 'to, subject y body son requeridos'
    };
  }

  if (dryRun) {
    return {
      success: true,
      dryRun: true,
      message: `[DRY-RUN] Enviaría email a ${to} con asunto: ${subject}`
    };
  }

  try {
    // Stub: por ahora solo logueamos
    // En el futuro, integrar con servicio de email real (SMTP, SendGrid, etc.)
    console.log('[AUTO_ACTION][send_email] Email simulado:', {
      to,
      subject,
      body: body.substring(0, 100) + (body.length > 100 ? '...' : '')
    });
    
    // TODO: Integrar con servicio de email real
    // const emailService = await import('../../services/email-service.js');
    // await emailService.sendEmail({ to, subject, body });

    return {
      success: true,
      result: {
        sent: true,
        to,
        subject,
        note: 'Email enviado (stub - no se envió realmente)'
      }
    };
  } catch (error) {
    console.error('[AUTO_ACTION][send_email] Error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Runner: http.webhook.call
 * Hace una llamada HTTP a un webhook externo
 */
async function runWebhookCall({ signal, actionConfig, ctx, dryRun }) {
  const { url, method = 'POST', headers = {}, body = {}, timeout = 5000 } = actionConfig || {};
  
  if (!url) {
    return {
      success: false,
      error: 'url es requerido'
    };
  }

  if (dryRun) {
    return {
      success: true,
      dryRun: true,
      message: `[DRY-RUN] Llamaría webhook ${method} ${url}`
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: method !== 'GET' ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const responseText = await response.text();
    let responseBody;
    try {
      responseBody = JSON.parse(responseText);
    } catch {
      responseBody = responseText;
    }

    if (!response.ok) {
      return {
        success: false,
        error: `Webhook retornó ${response.status}: ${response.statusText}`,
        result: {
          status: response.status,
          body: responseBody
        }
      };
    }

    return {
      success: true,
      result: {
        status: response.status,
        body: responseBody
      }
    };
  } catch (error) {
    console.error('[AUTO_ACTION][webhook.call] Error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Runner: google.drive.upload
 * Sube un archivo a Google Drive (stub fail-open)
 */
async function runDriveUpload({ signal, actionConfig, ctx, dryRun }) {
  const { file_name, file_content, mime_type = 'text/plain', folder_id } = actionConfig || {};
  
  if (!file_name || !file_content) {
    return {
      success: false,
      error: 'file_name y file_content son requeridos'
    };
  }

  if (dryRun) {
    return {
      success: true,
      dryRun: true,
      message: `[DRY-RUN] Subiría archivo ${file_name} a Google Drive`
    };
  }

  try {
    // Stub: por ahora solo logueamos
    // En el futuro, integrar con Google Drive API
    console.log('[AUTO_ACTION][drive.upload] Upload simulado:', {
      file_name,
      mime_type,
      folder_id,
      content_length: file_content.length
    });
    
    // TODO: Integrar con Google Drive API
    // const driveService = await import('../../services/google-drive-service.js');
    // const fileId = await driveService.uploadFile({ file_name, file_content, mime_type, folder_id });

    // Fail-open: retornar éxito aunque no se haya subido realmente
    return {
      success: true,
      result: {
        uploaded: false,
        file_name,
        note: 'Upload simulado (stub - no se subió realmente. Requiere configuración OAuth)'
      },
      warning: 'Upload simulado - requiere configuración de Google Drive API'
    };
  } catch (error) {
    console.error('[AUTO_ACTION][drive.upload] Error:', error.message);
    // Fail-open: no fallar el engine
    return {
      success: false,
      error: error.message,
      warning: 'Error en upload pero continuando (fail-open)'
    };
  }
}

