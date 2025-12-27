// scripts/test-observability-smoke.js
// Script de smoke test para verificar observabilidad v1

import http from 'http';

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';

/**
 * Hace un request HTTP y devuelve la respuesta
 */
function makeRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const requestOptions = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = http.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
}

/**
 * Test principal
 */
async function runTests() {
  console.log('🧪 Iniciando smoke tests de observabilidad v1...\n');

  let passed = 0;
  let failed = 0;

  // Test 1: Diagnostics API debe incluir recent_errors
  console.log('Test 1: Diagnostics API incluye recent_errors');
  try {
    const response = await makeRequest('/admin/api/system/diagnostics');
    
    if (response.status !== 200) {
      throw new Error(`Status ${response.status} en lugar de 200`);
    }

    const data = JSON.parse(response.body);
    
    if (!data.ok) {
      throw new Error('Response no tiene ok: true');
    }

    if (!data.data.recent_errors) {
      throw new Error('Response no incluye recent_errors');
    }

    if (!Array.isArray(data.data.recent_errors)) {
      throw new Error('recent_errors no es un array');
    }

    if (!data.data.error_stats) {
      throw new Error('Response no incluye error_stats');
    }

    if (typeof data.data.error_stats !== 'object') {
      throw new Error('error_stats no es un objeto');
    }

    console.log('✅ Test 1 pasado: Diagnostics incluye recent_errors y error_stats\n');
    passed++;
  } catch (error) {
    console.error(`❌ Test 1 falló: ${error.message}\n`);
    failed++;
  }

  // Test 2: Respuestas deben incluir x-trace-id header
  console.log('Test 2: Respuestas incluyen x-trace-id header');
  try {
    const response = await makeRequest('/admin/api/system/diagnostics');
    
    const traceId = response.headers['x-trace-id'];
    
    if (!traceId) {
      throw new Error('Response no incluye header x-trace-id');
    }

    console.log(`✅ Test 2 pasado: x-trace-id presente: ${traceId}\n`);
    passed++;
  } catch (error) {
    console.error(`❌ Test 2 falló: ${error.message}\n`);
    failed++;
  }

  // Test 3: Errores deben incluir trace_id en el body
  console.log('Test 3: Errores incluyen trace_id en body');
  try {
    // Intentar acceder a una ruta que no existe para generar un error
    const response = await makeRequest('/admin/api/nonexistent-route-12345');
    
    if (response.status !== 404) {
      throw new Error(`Status ${response.status} en lugar de 404`);
    }

    const data = JSON.parse(response.body);
    
    if (!data.trace_id) {
      throw new Error('Error response no incluye trace_id en body');
    }

    console.log(`✅ Test 3 pasado: Error incluye trace_id: ${data.trace_id}\n`);
    passed++;
  } catch (error) {
    console.error(`❌ Test 3 falló: ${error.message}\n`);
    failed++;
  }

  // Resumen
  console.log('═══════════════════════════════════════════════════════');
  console.log(`✅ Tests pasados: ${passed}`);
  console.log(`❌ Tests fallados: ${failed}`);
  console.log(`📊 Total: ${passed + failed}`);
  console.log('═══════════════════════════════════════════════════════\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('🎉 Todos los tests pasaron!\n');
    process.exit(0);
  }
}

// Ejecutar tests
runTests().catch((error) => {
  console.error('❌ Error ejecutando tests:', error);
  process.exit(1);
});




