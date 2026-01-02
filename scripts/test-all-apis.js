// scripts/test-all-apis.js
// Script completo para probar todas las APIs del sistema

import dotenv from 'dotenv';
import { verificarAcceso, obtenerDatosCompletosPersona } from '../src/services/kajabi.js';
import { verificarAccesoDesdeSQL, sincronizarEmailKajabiASQL, existeEstudiante } from '../src/services/kajabi-sync-sql.js';
import { findStudentByEmail, getOrCreateStudent } from '../src/modules/student.js';
// SQLite eliminado - PostgreSQL es el único Source of Truth
// import { query } from '../database/pg.js';

dotenv.config();

// Colores para consola
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '═'.repeat(70));
  log(`  ${title}`, 'cyan');
  console.log('═'.repeat(70));
}

function logTest(testName) {
  log(`\n📋 ${testName}`, 'blue');
  console.log('─'.repeat(70));
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'cyan');
}

async function testEnvironment() {
  logSection('VERIFICACIÓN DE VARIABLES DE ENTORNO');
  
  const required = {
    'KAJABI_CLIENT_ID': process.env.KAJABI_CLIENT_ID,
    'KAJABI_CLIENT_SECRET': process.env.KAJABI_CLIENT_SECRET,
    'CLICKUP_API_TOKEN': process.env.CLICKUP_API_TOKEN
  };
  
  let allOk = true;
  for (const [key, value] of Object.entries(required)) {
    if (value) {
      logSuccess(`${key}: Configurado (${value.substring(0, 10)}...)`);
    } else {
      logError(`${key}: NO CONFIGURADO`);
      allOk = false;
    }
  }
  
  return allOk;
}

async function testKajabiAPI(email) {
  logSection('TEST 1: API DE KAJABI');
  
  const env = {
    KAJABI_CLIENT_ID: process.env.KAJABI_CLIENT_ID,
    KAJABI_CLIENT_SECRET: process.env.KAJABI_CLIENT_SECRET
  };
  
  try {
    logTest('Verificar Acceso');
    const acceso = await verificarAcceso(email, env);
    
    if (acceso.hasAccess) {
      logSuccess(`Acceso permitido para ${email}`);
      logInfo(`Tiene Mundo de Luz: ${acceso.tieneMundoDeLuz ? 'SÍ' : 'NO'}`);
      logInfo(`Estado suscripción: ${acceso.estadoSuscripcion || 'N/A'}`);
      if (acceso.fechaCompraMundoDeLuz) {
        logInfo(`Fecha compra: ${acceso.fechaCompraMundoDeLuz}`);
      }
    } else {
      logWarning(`Acceso denegado: ${acceso.reason || 'Sin razón especificada'}`);
    }
    
    logTest('Obtener Datos Completos');
    const datos = await obtenerDatosCompletosPersona(
      email,
      env.KAJABI_CLIENT_ID,
      env.KAJABI_CLIENT_SECRET
    );
    
    if (datos) {
      logSuccess('Datos obtenidos correctamente');
      logInfo(`Persona: ${datos.persona?.name || datos.persona?.email || 'N/A'}`);
      logInfo(`Ofertas: ${datos.ofertas?.length || 0}`);
      logInfo(`Compras: ${datos.compras?.length || 0}`);
      logInfo(`Tiene acceso: ${datos.tieneAcceso ? 'SÍ' : 'NO'}`);
    } else {
      logError('No se pudieron obtener datos completos');
    }
    
    return { acceso, datos };
  } catch (err) {
    logError(`Error en API de Kajabi: ${err.message}`);
    console.error(err.stack);
    return null;
  }
}

async function testSQLDatabase() {
  logSection('TEST 2: BASE DE DATOS POSTGRESQL');
  
  try {
    logTest('Conectar a PostgreSQL');
    const { query } = await import('../database/pg.js');
    logSuccess('PostgreSQL conectado');
    
    logTest('Consultar Tabla students');
    const result = await query('SELECT COUNT(*) as total FROM students');
    const count = parseInt(result.rows[0]?.total || 0, 10);
    logInfo(`Total estudiantes en BD: ${count}`);
    
    logTest('Consultar Últimos 5 estudiantes');
    const recentResult = await query(`
      SELECT email, estado_suscripcion, created_at 
      FROM students 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    if (recentResult.rows.length > 0) {
      recentResult.rows.forEach((s, i) => {
        logInfo(`${i + 1}. ${s.email} - Estado: ${s.estado_suscripcion || 'N/A'}`);
      });
    } else {
      logWarning('No hay estudiantes en la base de datos');
    }
    
    return true;
  } catch (err) {
    logError(`Error en Base de Datos PostgreSQL: ${err.message}`);
    console.error(err.stack);
    return false;
  }
}

async function testKajabiSyncSQL(email) {
  logSection('TEST 3: SINCRONIZACIÓN KAJABI → SQL');
  
  const env = {
    KAJABI_CLIENT_ID: process.env.KAJABI_CLIENT_ID,
    KAJABI_CLIENT_SECRET: process.env.KAJABI_CLIENT_SECRET
  };
  
  try {
    logTest('Sincronizar Email a SQL');
    const resultado = await sincronizarEmailKajabiASQL(email, env);
    
    if (resultado.success) {
      logSuccess(`Sincronización exitosa para ${email}`);
      logInfo(`Tiene Mundo de Luz: ${resultado.tieneMundoDeLuz ? 'SÍ' : 'NO'}`);
      logInfo(`Suscripción pausada: ${resultado.suscripcionPausada ? 'SÍ' : 'NO'}`);
      if (resultado.fechaInscripcion) {
        logInfo(`Fecha inscripción: ${resultado.fechaInscripcion}`);
      }
    } else {
      logError(`Error en sincronización: ${resultado.reason || resultado.error}`);
    }
    
    logTest('Verificar Acceso desde SQL');
    const accesoSQL = await verificarAccesoDesdeSQL(email, env, 24);
    
    if (accesoSQL.hasAccess !== undefined) {
      logSuccess(`Verificación desde SQL: ${accesoSQL.hasAccess ? 'Acceso permitido' : 'Acceso denegado'}`);
      logInfo(`Desde SQL: ${accesoSQL.desdeSQL ? 'SÍ' : 'NO'}`);
      if (accesoSQL.sincronizado) {
        logInfo('Datos sincronizados recientemente');
      }
    } else {
      logError('No se pudo verificar acceso desde SQL');
    }
    
    return resultado;
  } catch (err) {
    logError(`Error en sincronización SQL: ${err.message}`);
    console.error(err.stack);
    return null;
  }
}

async function testClickUpAPI(email) {
  logSection('TEST 4: API DE CLICKUP');
  
  const env = {
    CLICKUP_API_TOKEN: process.env.CLICKUP_API_TOKEN
  };
  
  if (!env.CLICKUP_API_TOKEN) {
    logWarning('CLICKUP_API_TOKEN no configurado, saltando test');
    return null;
  }
  
  try {
    logTest('Buscar Estudiante por Email');
    const student = await findStudentByEmail(env, email);
    
    if (student) {
      logSuccess(`Estudiante encontrado en ClickUp`);
      logInfo(`ID: ${student.id}`);
      logInfo(`Email: ${student.email}`);
      logInfo(`Apodo: ${student.apodo || 'N/A'}`);
      logInfo(`Nivel: ${student.nivel || 'N/A'}`);
      logInfo(`Racha: ${student.streak || 0}`);
    } else {
      logWarning(`No se encontró estudiante con email ${email} en ClickUp`);
    }
    
    logTest('Obtener o Crear Estudiante');
    const student2 = await getOrCreateStudent(email, env);
    logSuccess(`Estudiante obtenido/creado: ${student2.id}`);
    
    return student2;
  } catch (err) {
    logError(`Error en API de ClickUp: ${err.message}`);
    console.error(err.stack);
    return null;
  }
}

async function testExisteEstudiante(email) {
  logSection('TEST 5: VERIFICACIÓN DE EXISTENCIA');
  
  const env = {
    CLICKUP_API_TOKEN: process.env.CLICKUP_API_TOKEN
  };
  
  try {
    logTest('Verificar si Existe Estudiante');
    const existeInfo = await existeEstudiante(email, env);
    
    logInfo(`Existe: ${existeInfo.existe ? 'SÍ' : 'NO'}`);
    logInfo(`En SQL: ${existeInfo.enSQL ? 'SÍ' : 'NO'}`);
    logInfo(`En ClickUp: ${existeInfo.enClickUp ? 'SÍ' : 'NO'}`);
    if (existeInfo.clickupTaskId) {
      logInfo(`ClickUp Task ID: ${existeInfo.clickupTaskId}`);
    }
    
    return existeInfo;
  } catch (err) {
    logError(`Error verificando existencia: ${err.message}`);
    console.error(err.stack);
    return null;
  }
}

async function runAllTests() {
  console.log('\n');
  log('╔══════════════════════════════════════════════════════════════════════╗', 'cyan');
  log('║          PRUEBA COMPLETA DE APIS - AURELINPORTAL                    ║', 'cyan');
  log('╚══════════════════════════════════════════════════════════════════════╝', 'cyan');
  
  // Obtener email de argumentos
  const email = process.argv[2];
  
  if (!email) {
    logError('Por favor, proporciona un email para probar:');
    logInfo('  node scripts/test-all-apis.js email@ejemplo.com\n');
    process.exit(1);
  }
  
  log(`\n📧 Email de prueba: ${email}\n`, 'magenta');
  
  // Test 0: Variables de entorno
  const envOk = await testEnvironment();
  if (!envOk) {
    logError('\n❌ Faltan variables de entorno. Por favor, configura el archivo .env');
    process.exit(1);
  }
  
  // Test 1: API de Kajabi
  const kajabiResult = await testKajabiAPI(email);
  
  // Test 2: Base de Datos SQL
  const sqlOk = await testSQLDatabase();
  
  // Test 3: Sincronización Kajabi → SQL
  const syncResult = await testKajabiSyncSQL(email);
  
  // Test 4: API de ClickUp
  const clickupResult = await testClickUpAPI(email);
  
  // Test 5: Verificación de existencia
  const existeResult = await testExisteEstudiante(email);
  
  // Resumen final
  logSection('RESUMEN DE PRUEBAS');
  
  const results = {
    'Variables de Entorno': envOk ? '✅' : '❌',
    'API Kajabi': kajabiResult ? '✅' : '❌',
    'Base de Datos SQL': sqlOk ? '✅' : '❌',
    'Sincronización SQL': syncResult?.success ? '✅' : '❌',
    'API ClickUp': clickupResult ? '✅' : '❌',
    'Verificación Existencia': existeResult ? '✅' : '❌'
  };
  
  for (const [test, result] of Object.entries(results)) {
    console.log(`  ${result} ${test}`);
  }
  
  const allPassed = Object.values(results).every(r => r === '✅');
  
  console.log('\n');
  if (allPassed) {
    log('🎉 ¡Todas las pruebas pasaron correctamente!', 'green');
  } else {
    log('⚠️  Algunas pruebas fallaron. Revisa los errores arriba.', 'yellow');
  }
  console.log('\n');
}

// Ejecutar
runAllTests().catch(err => {
  logError(`\n❌ Error fatal: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});









