/**
 * ============================================================================
 * TESTS DEL GOOGLE WORKER - AURIPORTAL V8.0
 * ============================================================================
 * 
 * Script de pruebas automáticas para verificar todas las funcionalidades
 * del Google Worker desplegado como Web App.
 * 
 * USO:
 *   node tests/test-google-worker.js
 */

import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Cargar variables de entorno
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');
dotenv.config({ path: join(projectRoot, '.env') });

// ============================================================================
// CONFIGURACIÓN Y VALIDACIÓN
// ============================================================================

const colors = {
  green: txt => `\x1b[32m${txt}\x1b[0m`,
  red: txt => `\x1b[31m${txt}\x1b[0m`,
  yellow: txt => `\x1b[33m${txt}\x1b[0m`,
  blue: txt => `\x1b[34m${txt}\x1b[0m`,
  cyan: txt => `\x1b[36m${txt}\x1b[0m`,
  reset: txt => `\x1b[0m${txt}\x1b[0m`,
};

// Validar variables de entorno
const GOOGLE_WORKER_URL = process.env.GOOGLE_WORKER_URL;
const GOOGLE_WORKER_SECRET = process.env.GOOGLE_WORKER_SECRET;

if (!GOOGLE_WORKER_URL || !GOOGLE_WORKER_SECRET) {
  console.error(colors.red('❌ ERROR: Variables de entorno no configuradas'));
  console.error('');
  console.error('Añade a tu archivo .env:');
  console.error('  GOOGLE_WORKER_URL=https://script.google.com/...');
  console.error('  GOOGLE_WORKER_SECRET=tu_secret_aqui');
  process.exit(1);
}

// Email para tests (configurar si es necesario)
const TEST_EMAIL = process.env.TEST_EMAIL || 'bennascut@eugenihidalgo.org';

// Variables para almacenar IDs de recursos creados
const recursosCreados = {
  testFolderId: null,
  testDocId: null,
  testPdfId: null,
  testEventId: null,
  testAlumnoId: '99999',
  informeDocId: null,
  informePdfId: null,
};

// ============================================================================
// FUNCIÓN GENÉRICA PARA LLAMAR AL WORKER
// ============================================================================

/**
 * Función genérica para llamar al Google Worker
 * 
 * @param {string} accion - Nombre de la acción a ejecutar
 * @param {Object} data - Datos adicionales para la acción
 * @returns {Promise<Object>} Respuesta con status, raw response y json
 */
async function callWorker(accion, data = {}) {
  const payload = {
    token: GOOGLE_WORKER_SECRET,
    accion,
    ...data
  };

  try {
    const res = await fetch(GOOGLE_WORKER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload)
    });

    // Intentar parsear como JSON
    let json = null;
    const text = await res.text();
    
    try {
      json = JSON.parse(text);
    } catch (e) {
      // Si no es JSON, probablemente es HTML (error de Google)
      json = {
        status: 'error',
        message: 'Respuesta no es JSON (probablemente HTML)',
        html: text.substring(0, 200) // Primeros 200 caracteres
      };
    }

    return { 
      status: res.status, 
      ok: res.ok,
      raw: res, 
      json,
      text: text.substring(0, 500) // Primeros 500 caracteres para debugging
    };
  } catch (error) {
    return {
      status: 0,
      ok: false,
      error: error.message,
      json: {
        status: 'error',
        message: `Error de conexión: ${error.message}`
      }
    };
  }
}

// ============================================================================
// FUNCIONES AUXILIARES
// ============================================================================

function logTest(numero, nombre) {
  console.log(colors.cyan(`\n${'='.repeat(60)}`));
  console.log(colors.blue(`TEST ${numero}: ${nombre}`));
  console.log(colors.cyan('='.repeat(60)));
}

function logExito(mensaje, datos = null) {
  console.log(colors.green(`✅ ${mensaje}`));
  if (datos) {
    console.log(JSON.stringify(datos, null, 2));
  }
}

function logError(mensaje, error = null) {
  console.log(colors.red(`❌ ${mensaje}`));
  if (error) {
    console.log(colors.red(JSON.stringify(error, null, 2)));
  }
}

function logInfo(mensaje) {
  console.log(colors.yellow(`ℹ️  ${mensaje}`));
}

// ============================================================================
// TESTS
// ============================================================================

async function test1_Ping() {
  logTest(1, 'PING - Test de Conectividad');
  
  try {
    const resultado = await callWorker('ping');
    
    if (resultado.json && resultado.json.status === 'ok') {
      logExito('Ping exitoso', resultado.json);
      return { exito: true, datos: resultado.json };
    } else {
      logError('Ping falló', resultado.json);
      logError('Respuesta completa:', resultado);
      return { exito: false, error: resultado.json };
    }
  } catch (error) {
    logError('Error en ping:', error.message);
    return { exito: false, error: error.message };
  }
}

async function test2_CrearCarpeta() {
  logTest(2, 'CREAR CARPETA');
  
  try {
    const nombreCarpeta = `Test_AuriPortal_${Date.now()}`;
    logInfo(`Creando carpeta: ${nombreCarpeta}`);
    
    const resultado = await callWorker('crear_carpeta', {
      nombre: nombreCarpeta
    });
    
    if (resultado.json && resultado.json.status === 'ok' && resultado.json.data?.id) {
      recursosCreados.testFolderId = resultado.json.data.id;
      logExito('Carpeta creada exitosamente', {
        id: resultado.json.data.id,
        url: resultado.json.data.url,
        nombre: resultado.json.data.nombre
      });
      return { exito: true, datos: resultado.json.data };
    } else {
      logError('Error al crear carpeta', resultado.json);
      return { exito: false, error: resultado.json };
    }
  } catch (error) {
    logError('Error en crear carpeta:', error.message);
    return { exito: false, error: error.message };
  }
}

async function test3_CrearDocumento() {
  logTest(3, 'CREAR DOCUMENTO');
  
  try {
    const contenido = '<h1>Test Documento AuriPortal</h1><p>Probando integración</p>';
    
    const resultado = await callWorker('crear_documento', {
      nombre: `Test_Documento_${Date.now()}`,
      contenido: contenido,
      es_html: true,
      carpeta_id: recursosCreados.testFolderId || undefined
    });
    
    if (resultado.json && resultado.json.status === 'ok' && resultado.json.data?.id) {
      recursosCreados.testDocId = resultado.json.data.id;
      logExito('Documento creado exitosamente', {
        id: resultado.json.data.id,
        url: resultado.json.data.url,
        nombre: resultado.json.data.nombre
      });
      return { exito: true, datos: resultado.json.data };
    } else {
      logError('Error al crear documento', resultado.json);
      return { exito: false, error: resultado.json };
    }
  } catch (error) {
    logError('Error en crear documento:', error.message);
    return { exito: false, error: error.message };
  }
}

async function test4_GenerarPDF() {
  logTest(4, 'GENERAR PDF');
  
  if (!recursosCreados.testDocId) {
    logError('No hay documento creado. Saltando test de PDF.');
    return { exito: false, error: 'No hay documento creado' };
  }
  
  if (!recursosCreados.testFolderId) {
    logError('No hay carpeta de destino. Saltando test de PDF.');
    return { exito: false, error: 'No hay carpeta de destino' };
  }
  
  try {
    const resultado = await callWorker('generar_pdf', {
      documento_id: recursosCreados.testDocId,
      nombre_pdf: `Test_PDF_${Date.now()}`,
      carpeta_destino_id: recursosCreados.testFolderId
    });
    
    if (resultado.json && resultado.json.status === 'ok' && resultado.json.data?.id) {
      recursosCreados.testPdfId = resultado.json.data.id;
      logExito('PDF generado exitosamente', {
        id: resultado.json.data.id,
        url: resultado.json.data.url,
        nombre: resultado.json.data.nombre
      });
      return { exito: true, datos: resultado.json.data };
    } else {
      logError('Error al generar PDF', resultado.json);
      return { exito: false, error: resultado.json };
    }
  } catch (error) {
    logError('Error en generar PDF:', error.message);
    return { exito: false, error: error.message };
  }
}

async function test5_EnviarEmail() {
  logTest(5, 'ENVIAR EMAIL');
  
  try {
    const resultado = await callWorker('enviar_email', {
      to: TEST_EMAIL,
      subject: 'Test Google Worker AuriPortal',
      htmlBody: '<p>Este es un test del Google Worker ✔</p><p>Si recibes este email, el Worker está funcionando correctamente.</p>'
    });
    
    if (resultado.json && resultado.json.status === 'ok') {
      logExito('Email enviado exitosamente', {
        to: TEST_EMAIL,
        messageId: resultado.json.data?.messageId || 'N/A'
      });
      return { exito: true, datos: resultado.json.data };
    } else {
      logError('Error al enviar email', resultado.json);
      return { exito: false, error: resultado.json };
    }
  } catch (error) {
    logError('Error en enviar email:', error.message);
    return { exito: false, error: error.message };
  }
}

async function test6_CrearEventoCalendar() {
  logTest(6, 'CREAR EVENTO CALENDAR');
  
  try {
    const ahora = new Date();
    const inicio = new Date(ahora.getTime() + 60 * 60 * 1000); // +1 hora
    const fin = new Date(ahora.getTime() + 2 * 60 * 60 * 1000); // +2 horas
    
    const resultado = await callWorker('crear_evento_calendar', {
      titulo: 'Evento Test AuriPortal',
      descripcion: 'Este es un evento de prueba del Google Worker',
      fecha_inicio: inicio.toISOString(),
      fecha_fin: fin.toISOString(),
      ubicacion: 'https://zoom.us/test',
      invitados: [TEST_EMAIL]
    });
    
    if (resultado.json && resultado.json.status === 'ok' && resultado.json.data?.eventId) {
      recursosCreados.testEventId = resultado.json.data.eventId;
      logExito('Evento creado exitosamente', {
        eventId: resultado.json.data.eventId,
        htmlLink: resultado.json.data.htmlLink,
        titulo: resultado.json.data.titulo
      });
      return { exito: true, datos: resultado.json.data };
    } else {
      logError('Error al crear evento', resultado.json);
      return { exito: false, error: resultado.json };
    }
  } catch (error) {
    logError('Error en crear evento:', error.message);
    return { exito: false, error: error.message };
  }
}

async function test7_CrearEstructuraAlumno() {
  logTest(7, 'CREAR ESTRUCTURA ALUMNO');
  
  try {
    const resultado = await callWorker('crear_estructura_alumno', {
      alumno_id: recursosCreados.testAlumnoId
    });
    
    if (resultado.json && resultado.json.status === 'ok' && resultado.json.data?.carpeta_alumno) {
      logExito('Estructura de alumno creada exitosamente', {
        carpeta_alumno: resultado.json.data.carpeta_alumno.url,
        eventos: resultado.json.data.subcarpetas?.eventos?.url,
        informes: resultado.json.data.subcarpetas?.informes?.url,
        materiales: resultado.json.data.subcarpetas?.materiales?.url
      });
      return { exito: true, datos: resultado.json.data };
    } else {
      logError('Error al crear estructura de alumno', resultado.json);
      return { exito: false, error: resultado.json };
    }
  } catch (error) {
    logError('Error en crear estructura de alumno:', error.message);
    return { exito: false, error: error.message };
  }
}

async function test8_CrearInformeAurielin() {
  logTest(8, 'CREAR INFORME AURIELÍN');
  
  try {
    const contenido = {
      introduccion: 'Este es un informe de prueba del Google Worker de AuriPortal.',
      secciones: [
        {
          titulo: 'Nivel de Desarrollo',
          contenido: 'Nivel 3 – Integración completa con Google Workspace.'
        },
        {
          titulo: 'Estado del Sistema',
          contenido: 'Todos los módulos funcionando correctamente. ✅'
        }
      ],
      conclusion: 'El sistema está operativo y listo para producción.'
    };
    
    const resultado = await callWorker('crear_informe_aurielin', {
      alumno_id: recursosCreados.testAlumnoId,
      titulo: `Informe Test Aurelín - ${new Date().toLocaleDateString('es-ES')}`,
      contenido: contenido
    });
    
    if (resultado.json && resultado.json.status === 'ok' && resultado.json.data?.documento) {
      recursosCreados.informeDocId = resultado.json.data.documento.id;
      recursosCreados.informePdfId = resultado.json.data.pdf?.id || null;
      logExito('Informe creado exitosamente', {
        documento: resultado.json.data.documento.url,
        pdf: resultado.json.data.pdf?.url || 'N/A'
      });
      return { exito: true, datos: resultado.json.data };
    } else {
      logError('Error al crear informe', resultado.json);
      return { exito: false, error: resultado.json };
    }
  } catch (error) {
    logError('Error en crear informe:', error.message);
    return { exito: false, error: error.message };
  }
}

async function test9_RegistrarLog() {
  logTest(9, 'REGISTRAR LOG');
  
  try {
    const resultado = await callWorker('registrar_log', {
      accion: 'test_worker',
      usuario: TEST_EMAIL,
      payload: {
        test: 'Prueba completa',
        timestamp: new Date().toISOString(),
        version: '8.0'
      }
    });
    
    if (resultado.json && resultado.json.status === 'ok') {
      logExito('Log registrado exitosamente', {
        fila: resultado.json.data?.fila || 'N/A',
        fecha: resultado.json.data?.fecha || 'N/A'
      });
      return { exito: true, datos: resultado.json.data };
    } else {
      logError('Error al registrar log', resultado.json);
      return { exito: false, error: resultado.json };
    }
  } catch (error) {
    logError('Error en registrar log:', error.message);
    return { exito: false, error: error.message };
  }
}

function test10_Resumen() {
  logTest(10, 'RESUMEN Y LIMPIEZA');
  
  console.log(colors.cyan('\n📊 RECURSOS CREADOS DURANTE LAS PRUEBAS:'));
  console.log(colors.cyan('='.repeat(60)));
  
  if (recursosCreados.testFolderId) {
    console.log(colors.green(`✅ Carpeta de prueba: ${recursosCreados.testFolderId}`));
  }
  
  if (recursosCreados.testDocId) {
    console.log(colors.green(`✅ Documento de prueba: ${recursosCreados.testDocId}`));
  }
  
  if (recursosCreados.testPdfId) {
    console.log(colors.green(`✅ PDF de prueba: ${recursosCreados.testPdfId}`));
  }
  
  if (recursosCreados.testEventId) {
    console.log(colors.green(`✅ Evento de calendario: ${recursosCreados.testEventId}`));
  }
  
  if (recursosCreados.informeDocId) {
    console.log(colors.green(`✅ Informe documento: ${recursosCreados.informeDocId}`));
  }
  
  if (recursosCreados.informePdfId) {
    console.log(colors.green(`✅ Informe PDF: ${recursosCreados.informePdfId}`));
  }
  
  console.log(colors.yellow(`\n⚠️  NOTA: Estos recursos son de prueba y pueden eliminarse manualmente desde Google Drive/Calendar si lo deseas.`));
  
  logInfo('URLs completas disponibles en los logs anteriores');
}

// ============================================================================
// EJECUCIÓN PRINCIPAL
// ============================================================================

async function ejecutarTests() {
  console.log(colors.blue('🔧 Iniciando pruebas del Google Worker AuriPortal...\n'));
  console.log(colors.cyan(`URL: ${GOOGLE_WORKER_URL}`));
  console.log(colors.cyan(`Email de prueba: ${TEST_EMAIL}\n`));
  
  const resultados = {
    totales: 0,
    exitosos: 0,
    fallidos: 0,
    detalles: []
  };
  
  // Ejecutar tests secuencialmente
  const tests = [
    { nombre: 'PING', fn: test1_Ping },
    { nombre: 'CREAR CARPETA', fn: test2_CrearCarpeta },
    { nombre: 'CREAR DOCUMENTO', fn: test3_CrearDocumento },
    { nombre: 'GENERAR PDF', fn: test4_GenerarPDF },
    { nombre: 'ENVIAR EMAIL', fn: test5_EnviarEmail },
    { nombre: 'CREAR EVENTO CALENDAR', fn: test6_CrearEventoCalendar },
    { nombre: 'CREAR ESTRUCTURA ALUMNO', fn: test7_CrearEstructuraAlumno },
    { nombre: 'CREAR INFORME AURIELÍN', fn: test8_CrearInformeAurielin },
    { nombre: 'REGISTRAR LOG', fn: test9_RegistrarLog },
  ];
  
  for (const test of tests) {
    resultados.totales++;
    try {
      const resultado = await test.fn();
      if (resultado.exito) {
        resultados.exitosos++;
        resultados.detalles.push({ test: test.nombre, estado: 'exito' });
      } else {
        resultados.fallidos++;
        resultados.detalles.push({ test: test.nombre, estado: 'fallido', error: resultado.error });
      }
    } catch (error) {
      resultados.fallidos++;
      resultados.detalles.push({ test: test.nombre, estado: 'error', error: error.message });
      logError(`Error inesperado en ${test.nombre}:`, error.message);
    }
    
    // Pequeña pausa entre tests para evitar rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Mostrar resumen
  test10_Resumen();
  
  // Resumen final
  console.log(colors.cyan('\n' + '='.repeat(60)));
  console.log(colors.blue('📊 RESUMEN FINAL'));
  console.log(colors.cyan('='.repeat(60)));
  console.log(`Total de tests: ${resultados.totales}`);
  console.log(colors.green(`✅ Exitosos: ${resultados.exitosos}`));
  console.log(colors.red(`❌ Fallidos: ${resultados.fallidos}`));
  
  if (resultados.fallidos > 0) {
    console.log(colors.yellow('\n⚠️  Tests fallidos:'));
    resultados.detalles
      .filter(d => d.estado !== 'exito')
      .forEach(d => {
        console.log(colors.red(`  - ${d.test}: ${d.error?.message || d.error || 'Error desconocido'}`));
      });
  }
  
  console.log(colors.cyan('='.repeat(60)));
  console.log(colors.blue('\n🎉 Todas las pruebas finalizadas\n'));
  
  // Exit code
  process.exit(resultados.fallidos > 0 ? 1 : 0);
}

// Ejecutar
ejecutarTests().catch(error => {
  logError('Error fatal en la ejecución:', error);
  process.exit(1);
});


















