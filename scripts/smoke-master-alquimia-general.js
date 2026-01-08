#!/usr/bin/env node
/**
 * Smoke test canónico para endpoints base de Alquimia General en MASTER
 * 
 * Verifica que los 3 endpoints críticos de init funcionan:
 * - GET /master/api/alquimia-general/classifications
 * - GET /master/api/alquimia-general/item-groups
 * - GET /master/api/alquimia-general/listas?tipo=recurrente
 * 
 * Falla si:
 * - status != 200
 * - ok != true
 * - falta trace_id
 */

const BASE_URL = process.env.AP_BASE_URL || 'https://master.pdeeugenihidalgo.org';

const endpoints = [
  {
    name: 'classifications',
    path: '/master/api/alquimia-general/classifications',
    method: 'GET'
  },
  {
    name: 'item-groups',
    path: '/master/api/alquimia-general/item-groups',
    method: 'GET'
  },
  {
    name: 'listas (recurrente)',
    path: '/master/api/alquimia-general/listas?tipo=recurrente',
    method: 'GET'
  }
];

async function testEndpoint(endpoint) {
  const url = `${BASE_URL}${endpoint.path}`;
  console.log(`\n🧪 Testing: ${endpoint.name}`);
  console.log(`   ${endpoint.method} ${url}`);
  
  try {
    const response = await fetch(url, {
      method: endpoint.method,
      headers: {
        'Accept': 'application/json'
      }
    });
    
    const status = response.status;
    const contentType = response.headers.get('content-type') || '';
    const traceId = response.headers.get('x-trace-id') || 'missing';
    
    if (status !== 200) {
      console.error(`   ❌ Status: ${status} (expected 200)`);
      const text = await response.text();
      console.error(`   Body: ${text.substring(0, 200)}`);
      return { ok: false, reason: `status ${status}` };
    }
    
    if (!contentType.includes('application/json')) {
      console.error(`   ❌ Content-Type: ${contentType} (expected application/json)`);
      return { ok: false, reason: `content-type ${contentType}` };
    }
    
    const data = await response.json();
    
    if (!data.ok) {
      console.error(`   ❌ Response ok: ${data.ok} (expected true)`);
      console.error(`   Error: ${data.error || 'unknown'}`);
      console.error(`   Trace ID: ${data.trace_id || traceId}`);
      return { ok: false, reason: `response.ok = ${data.ok}` };
    }
    
    if (!traceId || traceId === 'missing') {
      console.warn(`   ⚠️  Trace ID missing in headers`);
    }
    
    console.log(`   ✅ Status: ${status}`);
    console.log(`   ✅ ok: ${data.ok}`);
    console.log(`   ✅ Trace ID: ${data.trace_id || traceId}`);
    if (data.data) {
      const dataType = Array.isArray(data.data) ? 'array' : typeof data.data;
      const dataLength = Array.isArray(data.data) ? data.data.length : 'N/A';
      console.log(`   ✅ Data: ${dataType} (length: ${dataLength})`);
    }
    
    return { ok: true };
  } catch (error) {
    console.error(`   ❌ Exception: ${error.message}`);
    console.error(`   Stack: ${error.stack}`);
    return { ok: false, reason: error.message };
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('SMOKE TEST: MASTER Alquimia General Base APIs');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  
  const results = [];
  
  for (const endpoint of endpoints) {
    const result = await testEndpoint(endpoint);
    results.push({ endpoint: endpoint.name, ...result });
  }
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('SUMMARY');
  console.log('═══════════════════════════════════════════════════════════');
  
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;
  
  results.forEach(r => {
    const icon = r.ok ? '✅' : '❌';
    console.log(`${icon} ${r.endpoint}${r.reason ? ` (${r.reason})` : ''}`);
  });
  
  console.log(`\nPassed: ${passed}/${results.length}`);
  console.log(`Failed: ${failed}/${results.length}`);
  
  if (failed > 0) {
    console.error('\n❌ SMOKE TEST FAILED');
    process.exit(1);
  } else {
    console.log('\n✅ SMOKE TEST PASSED');
    process.exit(0);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
