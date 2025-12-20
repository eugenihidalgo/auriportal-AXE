/**
 * ============================================================================
 * EJEMPLO DE INTEGRACIÓN - GOOGLE WORKER DESDE NODE.JS
 * ============================================================================
 * 
 * Este archivo muestra cómo integrar el Google Worker en tu servidor AuriPortal.
 * 
 * REQUISITOS:
 * npm install node-fetch
 * 
 * CONFIGURACIÓN:
 * 1. Obtén la URL del Web App desde Google Apps Script
 * 2. Configura el token secreto (debe coincidir con SCRIPT_SECRET en Apps Script)
 * 3. Añade estas variables a tu .env
 */

import fetch from 'node-fetch';
// O si usas CommonJS:
// const fetch = require('node-fetch');

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

const GOOGLE_WORKER_URL = process.env.GOOGLE_WORKER_URL || 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec';
const GOOGLE_WORKER_SECRET = process.env.GOOGLE_WORKER_SECRET || 'tu_secret_token_aqui';

// ============================================================================
// FUNCIÓN PRINCIPAL PARA LLAMAR AL WORKER
// ============================================================================

/**
 * Llama al Google Worker con una acción específica
 * 
 * @param {string} accion - Nombre de la acción a ejecutar
 * @param {Object} datos - Datos adicionales para la acción
 * @returns {Promise<Object>} Respuesta del Worker
 */
async function llamarGoogleWorker(accion, datos = {}) {
  try {
    const payload = {
      token: GOOGLE_WORKER_SECRET,
      accion: accion,
      ...datos
    };
    
    const response = await fetch(GOOGLE_WORKER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });
    
    const resultado = await response.json();
    
    // Validar respuesta
    if (resultado.status === 'error') {
      throw new Error(`Google Worker error: ${resultado.message}`);
    }
    
    return resultado;
    
  } catch (error) {
    console.error('Error llamando a Google Worker:', error);
    throw error;
  }
}

// ============================================================================
// EJEMPLOS DE USO
// ============================================================================

/**
 * Ejemplo 1: Test de conectividad
 */
async function ejemploPing() {
  try {
    const resultado = await llamarGoogleWorker('ping', {});
    console.log('✅ Worker activo:', resultado.message);
    console.log('📊 Datos:', resultado.data);
    return resultado;
  } catch (error) {
    console.error('❌ Error en ping:', error.message);
  }
}

/**
 * Ejemplo 2: Crear estructura de carpeta para un alumno nuevo
 */
async function ejemploCrearEstructuraAlumno(alumnoId) {
  try {
    const resultado = await llamarGoogleWorker('crear_estructura_alumno', {
      alumno_id: alumnoId
    });
    
    console.log('✅ Estructura creada para alumno:', alumnoId);
    console.log('📁 Carpeta principal:', resultado.data.carpeta_alumno.url);
    console.log('📂 Subcarpetas:', {
      eventos: resultado.data.subcarpetas.eventos.url,
      informes: resultado.data.subcarpetas.informes.url,
      materiales: resultado.data.subcarpetas.materiales.url
    });
    
    return resultado.data;
  } catch (error) {
    console.error('❌ Error creando estructura:', error.message);
    throw error;
  }
}

/**
 * Ejemplo 3: Crear un informe completo para un alumno
 */
async function ejemploCrearInforme(alumnoId, titulo, contenidoIA) {
  try {
    const resultado = await llamarGoogleWorker('crear_informe_aurielin', {
      alumno_id: alumnoId,
      titulo: titulo,
      contenido: contenidoIA
    });
    
    console.log('✅ Informe creado exitosamente');
    console.log('📄 Documento:', resultado.data.documento.url);
    console.log('📕 PDF:', resultado.data.pdf.url);
    
    return resultado.data;
  } catch (error) {
    console.error('❌ Error creando informe:', error.message);
    throw error;
  }
}

/**
 * Ejemplo 4: Enviar email con adjunto
 */
async function ejemploEnviarEmail(destinatario, asunto, contenidoHTML, adjuntoId = null) {
  try {
    const datos = {
      to: destinatario,
      subject: asunto,
      htmlBody: contenidoHTML
    };
    
    if (adjuntoId) {
      datos.adjuntos = [
        { id: adjuntoId, nombre: 'informe.pdf' }
      ];
    }
    
    const resultado = await llamarGoogleWorker('enviar_email', datos);
    
    console.log('✅ Email enviado a:', destinatario);
    return resultado.data;
  } catch (error) {
    console.error('❌ Error enviando email:', error.message);
    throw error;
  }
}

/**
 * Ejemplo 5: Crear evento en Calendar
 */
async function ejemploCrearEvento(titulo, fechaInicio, fechaFin, ubicacionZoom, invitados) {
  try {
    const resultado = await llamarGoogleWorker('crear_evento_calendar', {
      titulo: titulo,
      descripcion: 'Sesión programada desde AuriPortal',
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      ubicacion: ubicacionZoom,
      invitados: invitados
    });
    
    console.log('✅ Evento creado:', titulo);
    console.log('📅 Link:', resultado.data.htmlLink);
    
    return resultado.data;
  } catch (error) {
    console.error('❌ Error creando evento:', error.message);
    throw error;
  }
}

/**
 * Ejemplo 6: Flujo completo - Crear informe y enviarlo por email
 */
async function ejemploFlujoCompleto(alumnoId, alumnoEmail, contenidoInforme) {
  try {
    // 1. Crear el informe
    console.log('📝 Creando informe...');
    const informe = await ejemploCrearInforme(
      alumnoId,
      `Informe de Progreso - ${new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}`,
      contenidoInforme
    );
    
    // 2. Enviar email con el PDF adjunto
    console.log('📧 Enviando email...');
    const email = await ejemploEnviarEmail(
      alumnoEmail,
      'Tu informe de progreso está listo',
      `
        <h1>Hola,</h1>
        <p>Tu informe de progreso ha sido generado exitosamente.</p>
        <p>Puedes encontrarlo en los siguientes enlaces:</p>
        <ul>
          <li><a href="${informe.documento.url}">Ver documento</a></li>
          <li><a href="${informe.pdf.url}">Descargar PDF</a></li>
        </ul>
        <p>Saludos,<br>Equipo AuriPortal</p>
      `,
      informe.pdf.id
    );
    
    // 3. Registrar en logs
    console.log('📋 Registrando en logs...');
    await llamarGoogleWorker('registrar_log', {
      accion: 'flujo_informe_completo',
      usuario: alumnoEmail,
      payload: {
        alumno_id: alumnoId,
        informe_id: informe.documento.id,
        pdf_id: informe.pdf.id
      }
    });
    
    console.log('✅ Flujo completo ejecutado exitosamente');
    
    return {
      informe,
      email
    };
    
  } catch (error) {
    console.error('❌ Error en flujo completo:', error.message);
    throw error;
  }
}

// ============================================================================
// EJEMPLO DE USO EN UN ENDPOINT EXPRESS.JS
// ============================================================================

/**
 * Ejemplo de endpoint Express.js que usa el Google Worker
 */
/*
import express from 'express';
const router = express.Router();

router.post('/alumno/:id/informe', async (req, res) => {
  try {
    const { id } = req.params;
    const { email, contenido } = req.body;
    
    // Validar datos
    if (!email || !contenido) {
      return res.status(400).json({
        status: 'error',
        message: 'Email y contenido son requeridos'
      });
    }
    
    // Crear informe usando Google Worker
    const resultado = await ejemploFlujoCompleto(id, email, contenido);
    
    res.json({
      status: 'ok',
      message: 'Informe creado y enviado exitosamente',
      data: resultado
    });
    
  } catch (error) {
    console.error('Error en endpoint:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

export default router;
*/

// ============================================================================
// EJECUTAR EJEMPLOS (solo para testing)
// ============================================================================

// Descomentar para probar localmente:
/*
(async () => {
  console.log('🚀 Iniciando ejemplos de Google Worker...\n');
  
  // Test de conectividad
  await ejemploPing();
  
  // Más ejemplos...
  // await ejemploCrearEstructuraAlumno('12345');
  
})();
*/

// ============================================================================
// EXPORTAR FUNCIÓN PRINCIPAL
// ============================================================================

export { llamarGoogleWorker };
export default llamarGoogleWorker;



















