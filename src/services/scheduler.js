// src/services/scheduler.js
// Sistema de tareas programadas para sincronizaciones automáticas

import cron from 'node-cron';
import { CLICKUP } from '../config/config.js';
import { clickup } from './clickup.js';
import { sincronizarClickUpASQL } from '../endpoints/sync-clickup-sql.js';
// Sistema antiguo (SSH) - NO USAR
// import { procesarArchivosNuevos, inicializarServicioTranscripcion } from './transcription-service.js';
// Sistema nuevo (Whisper Local) - USAR ESTE
import { procesarTranscripciones } from './whisper-transcripciones.js';
import { sincronizarFrasesClickUpAPostgreSQL } from './sync-frases-clickup.js';
import { recalcularNivelesTodosAlumnos } from '../modules/nivel-v4.js';
import { analytics } from './analytics.js';

/**
 * Ejecuta la sincronización masiva diaria desde ClickUp a SQL
 */
async function ejecutarSincronizacionDiaria(env) {
  const horaInicio = new Date().toISOString();
  console.log(`\n🔄 [${horaInicio}] Iniciando sincronización diaria automática ClickUp → SQL...`);
  
  try {
    // Obtener todas las tareas de ClickUp
    const tasks = await clickup.getTasks(env, CLICKUP.LIST_ID, { archived: false, page: 0 });
    console.log(`📋 Encontradas ${tasks.length} tareas en ClickUp`);
    
    const resultados = {
      total: tasks.length,
      exitosos: 0,
      fallidos: 0,
      sinEmail: 0,
      cambiosTotales: 0
    };
    
    // Procesar cada tarea
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      
      // Extraer email de la tarea
      const emailField = task.custom_fields?.find(cf => cf.id === CLICKUP.CF_EMAIL);
      const email = emailField ? String(emailField.value).trim() : null;
      
      if (!email) {
        resultados.sinEmail++;
        continue;
      }
      
      try {
        // Sincronizar este contacto
        const resultado = await sincronizarClickUpASQL(email, env);
        
        if (resultado.success) {
          resultados.exitosos++;
          resultados.cambiosTotales += resultado.cambios || 0;
        } else {
          resultados.fallidos++;
        }
        
        // Pequeño delay para no saturar la API
        if (i < tasks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (err) {
        resultados.fallidos++;
        console.error(`   ❌ Error sincronizando ${email}:`, err.message);
      }
      
      // Log de progreso cada 50 contactos
      if ((i + 1) % 50 === 0) {
        console.log(`   📊 Progreso: ${i + 1}/${tasks.length} contactos procesados`);
      }
    }
    
    const horaFin = new Date().toISOString();
    console.log(`✅ [${horaFin}] Sincronización diaria completada:`);
    console.log(`   - Total procesados: ${resultados.total}`);
    console.log(`   - Exitosos: ${resultados.exitosos}`);
    console.log(`   - Fallidos: ${resultados.fallidos}`);
    console.log(`   - Sin email: ${resultados.sinEmail}`);
    console.log(`   - Cambios totales: ${resultados.cambiosTotales}\n`);
    
    return resultados;
  } catch (err) {
    console.error(`❌ [${new Date().toISOString()}] Error en sincronización diaria:`, err);
    throw err;
  }
}

/**
 * Ejecuta el procesamiento de transcripciones de audio (Whisper Local)
 */
async function ejecutarProcesamientoTranscripciones(env) {
  const horaInicio = new Date().toISOString();
  console.log(`\n🎵 [${horaInicio}] Iniciando procesamiento de transcripciones de audio (Whisper Local)...`);
  
  try {
    const resultado = await procesarTranscripciones(env);
    
    if (resultado.success) {
      const horaFin = new Date().toISOString();
      console.log(`✅ [${horaFin}] Procesamiento de transcripciones completado:`);
      console.log(`   - Archivos procesados: ${resultado.procesados || 0}`);
      console.log(`   - Exitosos: ${resultado.exitosos || 0}`);
      console.log(`   - Fallidos: ${resultado.fallidos || 0}\n`);
    } else {
      console.error(`❌ [${new Date().toISOString()}] Error en procesamiento de transcripciones:`, resultado.error);
    }
    
    return resultado;
  } catch (err) {
    console.error(`❌ [${new Date().toISOString()}] Error en procesamiento de transcripciones:`, err);
    throw err;
  }
}

/**
 * Inicializa las tareas programadas
 */
export function iniciarScheduler(env) {
  console.log('⏰ Inicializando tareas programadas...');
  
  // Servicio de transcripciones ahora usa Whisper Local (whisper-transcripciones.js)
  // No necesita inicialización especial, se inicializa automáticamente al procesar
  console.log('✅ [Transcripción] Servicio inicializado (Whisper Local)');
  
  // Sincronización diaria a las 3:00 AM (hora del servidor)
  // Formato cron: minuto hora día mes día-semana
  // '0 3 * * *' = todos los días a las 3:00 AM
  const tareaDiaria = cron.schedule('0 3 * * *', async () => {
    await ejecutarSincronizacionDiaria(env);
  }, {
    scheduled: true,
    timezone: "Europe/Madrid" // Ajustar según tu zona horaria
  });
  
  console.log('✅ Tarea programada configurada: Sincronización diaria ClickUp → SQL a las 3:00 AM');

  // Sincronización de frases ClickUp → PostgreSQL (diaria a las 4:00 AM)
  const tareaFrases = cron.schedule('0 4 * * *', async () => {
    const horaInicio = new Date().toISOString();
    console.log(`\n🔄 [${horaInicio}] Iniciando sincronización diaria de frases ClickUp → PostgreSQL...`);
    try {
      const resultado = await sincronizarFrasesClickUpAPostgreSQL(env);
      const horaFin = new Date().toISOString();
      if (resultado.success) {
        console.log(`✅ [${horaFin}] Sincronización de frases completada:`);
        console.log(`   - Nuevas: ${resultado.nuevas || 0}`);
        console.log(`   - Actualizadas: ${resultado.actualizadas || 0}`);
        console.log(`   - Eliminadas: ${resultado.eliminadas || 0}`);
        console.log(`   - Errores: ${resultado.errores || 0}\n`);
      } else {
        console.error(`❌ [${horaFin}] Error en sincronización de frases:`, resultado.error);
      }
    } catch (err) {
      console.error(`❌ [${new Date().toISOString()}] Error en sincronización de frases:`, err);
    }
  }, {
    scheduled: true,
    timezone: "Europe/Madrid"
  });
  
  console.log('✅ Tarea programada configurada: Sincronización diaria de frases ClickUp → PostgreSQL a las 4:00 AM');
  
  // Recálculo masivo de niveles de todos los alumnos (diario a las 3:00 AM)
  const tareaRecalculoNiveles = cron.schedule('0 3 * * *', async () => {
    const horaInicio = new Date().toISOString();
    console.log(`\n🔄 [${horaInicio}] Iniciando recálculo masivo de niveles de todos los alumnos...`);
    try {
      const resultado = await recalcularNivelesTodosAlumnos();
      const horaFin = new Date().toISOString();
      if (resultado) {
        console.log(`✅ [${horaFin}] Recálculo masivo de niveles completado:`);
        console.log(`   - Total procesados: ${resultado.total || 0}`);
        console.log(`   - Actualizados: ${resultado.actualizados || 0}`);
        console.log(`   - Sin cambios: ${resultado.sinCambios || 0}`);
        console.log(`   - Pausados: ${resultado.pausados || 0}`);
        console.log(`   - Errores: ${resultado.errores || 0}\n`);
      }
    } catch (err) {
      console.error(`❌ [${new Date().toISOString()}] Error en recálculo masivo de niveles:`, err);
    }
  }, {
    scheduled: true,
    timezone: "Europe/Madrid"
  });
  
  console.log('✅ Tarea programada configurada: Recálculo masivo de niveles de todos los alumnos a las 3:00 AM');
  
  // Procesamiento de transcripciones cada X minutos (configurable)
  // DESACTIVADO PERMANENTEMENTE - Solo se ejecuta manualmente o cuando se reactive explícitamente
  // Para reactivar, cambiar scheduled: false a scheduled: true
  const intervaloTranscripciones = env.DRIVE_MONITOR_INTERVAL || 30; // minutos por defecto (aumentado de 5 a 30)
  const tareaTranscripciones = cron.schedule(`*/${intervaloTranscripciones} * * * *`, async () => {
    // Verificar si está activo antes de ejecutar
    const { getControlTranscripciones } = await import('./whisper-transcripciones.js');
    const control = await getControlTranscripciones();
    if (!control.activo) {
      console.log('⏸️ [Scheduler] Whisper desactivado - saltando ejecución automática');
      return;
    }
    await ejecutarProcesamientoTranscripciones(env);
  }, {
    scheduled: false, // DESACTIVADO - No se ejecuta automáticamente
    timezone: "Europe/Madrid"
  });
  
  console.log(`⏸️ Tarea programada DESACTIVADA: Procesamiento de transcripciones cada ${intervaloTranscripciones} minutos (solo manual)`);
  
  // Procesamiento nocturno de audios largos (diario a las 23:00 - 6:00)
  // DESACTIVADO PERMANENTEMENTE - Solo se ejecuta manualmente o cuando se reactive explícitamente
  // Para reactivar, cambiar scheduled: false a scheduled: true
  const tareaNocturnaAudiosLargos = cron.schedule('0 23 * * *', async () => {
    const horaInicio = new Date().toISOString();
    console.log(`\n🌙 [${horaInicio}] Iniciando procesamiento nocturno de audios largos con Whisper Large...`);
    try {
      // Verificar si está activo antes de ejecutar
      const { getControlTranscripciones, procesarTranscripciones } = await import('./whisper-transcripciones.js');
      const control = await getControlTranscripciones();
      if (!control.activo) {
        console.log('⏸️ [Nocturno] Whisper desactivado - saltando ejecución');
        return;
      }
      
      const { getSystemInfo } = await import('./resource-monitor.js');
      
      // Verificar recursos antes de procesar
      const sistema = await getSystemInfo();
      console.log(`📊 [Nocturno] Estado del sistema:`);
      console.log(`   - RAM disponible: ${sistema.memoria?.available?.toFixed(2)}GB`);
      console.log(`   - CPU carga: ${sistema.cpu?.loadPercent?.toFixed(2)}%`);
      
      // Procesar con Whisper Local (automáticamente usará Large si hay recursos)
      const resultado = await procesarTranscripciones(env);
      
      const horaFin = new Date().toISOString();
      if (resultado.success) {
        console.log(`✅ [${horaFin}] Procesamiento nocturno completado:`);
        console.log(`   - Archivos procesados: ${resultado.procesados || 0}`);
        console.log(`   - Exitosos: ${resultado.exitosos || 0}`);
        console.log(`   - Fallidos: ${resultado.fallidos || 0}\n`);
      } else {
        console.error(`❌ [${horaFin}] Error en procesamiento nocturno:`, resultado.error);
      }
    } catch (err) {
      console.error(`❌ [${new Date().toISOString()}] Error en procesamiento nocturno:`, err);
    }
  }, {
    scheduled: false, // DESACTIVADO - No se ejecuta automáticamente
    timezone: "Europe/Madrid"
  });
  
  console.log('⏸️ Tarea programada DESACTIVADA: Procesamiento nocturno de audios largos a las 23:00 (solo manual)');
  
  // Procesamiento automático de transcripciones Whisper (diario a las 2:00 AM)
  // DESACTIVADO PERMANENTEMENTE - Solo se ejecuta manualmente o cuando se reactive explícitamente
  // Para reactivar, cambiar scheduled: false a scheduled: true
  const tareaWhisperTranscripciones = cron.schedule('0 2 * * *', async () => {
    const horaInicio = new Date().toISOString();
    console.log(`\n🎤 [${horaInicio}] Iniciando procesamiento automático de transcripciones Whisper...`);
    try {
      const { getControlTranscripciones, procesarTranscripciones } = await import('./whisper-transcripciones.js');
      // Verificar si está activo antes de ejecutar
      const control = await getControlTranscripciones();
      if (!control.activo) {
        console.log(`⏸️ [${horaInicio}] Whisper desactivado - saltando ejecución automática`);
        return;
      }
      
      const resultado = await procesarTranscripciones(env);
      
      const horaFin = new Date().toISOString();
      if (resultado.success) {
        if (resultado.pausado) {
          console.log(`⏸️ [${horaFin}] Transcripciones pausadas - no se procesaron archivos`);
        } else {
          console.log(`✅ [${horaFin}] Procesamiento Whisper completado:`);
          console.log(`   - Archivos procesados: ${resultado.procesados || 0}`);
          console.log(`   - Exitosos: ${resultado.exitosos || 0}`);
          console.log(`   - Fallidos: ${resultado.fallidos || 0}\n`);
        }
      } else {
        console.error(`❌ [${horaFin}] Error en procesamiento Whisper:`, resultado.error);
      }
    } catch (err) {
      console.error(`❌ [${new Date().toISOString()}] Error en procesamiento Whisper:`, err);
    }
  }, {
    scheduled: false, // DESACTIVADO - No se ejecuta automáticamente
    timezone: "Europe/Madrid"
  });
  
  console.log('⏸️ Tarea programada DESACTIVADA: Procesamiento automático de transcripciones Whisper a las 2:00 AM (solo manual)');
  
  // Cálculo automático de resumen diario de analytics (diario a las 2:00 AM)
  const tareaResumenDiario = cron.schedule('0 2 * * *', async () => {
    const horaInicio = new Date().toISOString();
    console.log(`\n📊 [${horaInicio}] Iniciando cálculo de resumen diario de analytics...`);
    try {
      // Calcular resumen para ayer (el día que acaba de terminar)
      const ayer = new Date();
      ayer.setDate(ayer.getDate() - 1);
      await analytics.calcularResumenDiario(ayer);
      
      const horaFin = new Date().toISOString();
      console.log(`✅ [${horaFin}] Resumen diario de analytics calculado correctamente\n`);
    } catch (err) {
      console.error(`❌ [${new Date().toISOString()}] Error calculando resumen diario de analytics:`, err);
    }
  }, {
    scheduled: true,
    timezone: "Europe/Madrid"
  });
  
  console.log('✅ Tarea programada configurada: Cálculo de resumen diario de analytics a las 2:00 AM');
  
  // Auditoría de caché de Cloudflare (cada 6 horas)
  // Detecta errores cacheados y ejecuta purga automática
  const tareaAuditorCache = cron.schedule('0 */6 * * *', async () => {
    const horaInicio = new Date().toISOString();
    console.log(`\n🔍 [${horaInicio}] Iniciando auditoría de caché de Cloudflare...`);
    try {
      // Importar y ejecutar auditor (import dinámico para evitar dependencias circulares)
      // Usar ruta absoluta desde la raíz del proyecto
      const { fileURLToPath } = await import('url');
      const { dirname, join } = await import('path');
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      const projectRoot = join(__dirname, '../..');
      const auditorPath = join(projectRoot, 'scripts', 'cloudflare', 'cache-auditor.js');
      const { auditCache } = await import(`file://${auditorPath}`);
      const resultado = await auditCache();
      
      const horaFin = new Date().toISOString();
      if (resultado.success) {
        if (resultado.errorsDetected > 0) {
          console.warn(`⚠️  [${horaFin}] Auditoría completada con ${resultado.errorsDetected} error(es) cacheado(s) detectado(s)`);
          if (resultado.purgeExecuted) {
            console.log(`   ✅ Purga automática ejecutada`);
          }
        } else {
          console.log(`✅ [${horaFin}] Auditoría completada - sin errores cacheados`);
        }
      } else {
        console.warn(`⚠️  [${horaFin}] Error en auditoría de caché: ${resultado.error || 'Error desconocido'}`);
      }
    } catch (err) {
      // Fail-open: nunca crashear el scheduler
      console.warn(`⚠️  [${new Date().toISOString()}] Error en auditoría de caché de Cloudflare:`, err.message);
      // Log estructurado de error
      console.warn(JSON.stringify({
        source: 'cloudflare',
        action: 'audit',
        reason: 'scheduler_error',
        success: false,
        error: err.message,
        timestamp: new Date().toISOString()
      }));
    }
  }, {
    scheduled: true,
    timezone: "Europe/Madrid"
  });
  
  console.log('✅ Tarea programada configurada: Auditoría de caché de Cloudflare cada 6 horas');
  
  // Intentar configurar webhook automáticamente al iniciar (si está habilitado)
  if (env.DRIVE_WEBHOOK_AUTO_SETUP !== 'false') {
    console.log('🔔 Intentando configurar webhook de Google Drive automáticamente...');
    // Import dinámico en contexto asíncrono
    import('./drive-webhook.js').then(({ configurarWebhookCanalizaciones }) => {
      return configurarWebhookCanalizaciones(env);
    }).then(resultado => {
      if (resultado && resultado.success) {
        console.log('✅ Webhook de Google Drive configurado automáticamente');
        console.log(`   Las notificaciones se recibirán en tiempo real`);
      } else {
        console.warn('⚠️ No se pudo configurar el webhook automáticamente:', resultado?.error || 'Error desconocido');
        console.warn('   El sistema usará polling cada 5 minutos como respaldo');
      }
    }).catch(err => {
      console.warn('⚠️ Error configurando webhook automáticamente:', err.message);
      console.warn('   El sistema usará polling cada 5 minutos como respaldo');
    });
  }
  
  // Opcional: Ejecutar inmediatamente al iniciar (solo para pruebas, comentar en producción)
  // Descomentar la siguiente línea si quieres probar la sincronización al iniciar el servidor
  // ejecutarSincronizacionDiaria(env).catch(err => console.error('Error en sincronización inicial:', err));
  
  return {
    tareaDiaria,
    tareaTranscripciones,
    ejecutarSincronizacionDiaria: () => ejecutarSincronizacionDiaria(env),
    ejecutarProcesamientoTranscripciones: () => ejecutarProcesamientoTranscripciones(env)
  };
}





