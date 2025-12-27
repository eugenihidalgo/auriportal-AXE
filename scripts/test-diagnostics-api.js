// scripts/test-diagnostics-api.js
// Script de prueba del Runtime Diagnostics API

import 'dotenv/config';
import adminSystemDiagnosticsHandler from '../src/endpoints/admin-system-diagnostics-api.js';

// Crear un request mock
const mockRequest = {
  method: 'GET',
  url: 'http://localhost:3000/admin/api/system/diagnostics',
  headers: new Headers()
};

const mockEnv = {};
const mockCtx = {};

console.log('═══════════════════════════════════════════════════════════════');
console.log('🔍 PRUEBA DEL RUNTIME DIAGNOSTICS API');
console.log('═══════════════════════════════════════════════════════════════');
console.log('');

// Ejecutar handler
adminSystemDiagnosticsHandler(mockRequest, mockEnv, mockCtx)
  .then(response => {
    console.log('✅ Respuesta recibida');
    console.log(`Status: ${response.status}`);
    console.log(`Content-Type: ${response.headers.get('Content-Type')}`);
    console.log('');
    
    return response.json();
  })
  .then(data => {
    console.log('📋 Contenido de la respuesta:');
    console.log(JSON.stringify(data, null, 2));
    console.log('');
    
    // Validar estructura
    if (data.ok === true && data.data) {
      console.log('✅ Estructura JSON válida');
      console.log(`   - system_state: ${data.data.system_state}`);
      console.log(`   - stats.total: ${data.data.stats.total}`);
      console.log(`   - stats.active: ${data.data.stats.active}`);
      console.log(`   - stats.degraded: ${data.data.stats.degraded}`);
      console.log(`   - stats.broken: ${data.data.stats.broken}`);
      console.log(`   - contracts.length: ${data.data.contracts.length}`);
    } else {
      console.log('❌ Estructura JSON inválida');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  });

