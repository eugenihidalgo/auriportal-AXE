// scripts/test-runtime-guard-refinement.js
// Script de prueba del Runtime Guard refinement

import 'dotenv/config';
import { withRuntimeGuard } from '../src/core/runtime-guard.js';

console.log('═══════════════════════════════════════════════════════════════');
console.log('🔍 PRUEBA DEL RUNTIME GUARD REFINEMENT');
console.log('═══════════════════════════════════════════════════════════════');
console.log('');

// Mock handler que devuelve HTML
const mockHtmlHandler = async (request, env, ctx) => {
  return new Response('<html><body>Test HTML</body></html>', {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=UTF-8' }
  });
};

// Mock handler que devuelve JSON
const mockJsonHandler = async (request, env, ctx) => {
  return new Response(JSON.stringify({ ok: true, data: 'test' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};

// Mock handler que devuelve texto plano (error)
const mockTextErrorHandler = async (request, env, ctx) => {
  return new Response('Error interno del servidor', {
    status: 500,
    headers: { 'Content-Type': 'text/plain' }
  });
};

// Test 1: Página HTML del Admin (NO debe normalizar)
console.log('1. PRUEBA: Página HTML del Admin');
console.log('───────────────────────────────────────────────────────────────');
const htmlRequest = {
  url: 'http://localhost:3000/admin/system/diagnostics',
  headers: new Headers({
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
  })
};

const guardedHtml = withRuntimeGuard(mockHtmlHandler);
const htmlResponse = await guardedHtml(htmlRequest, {}, {});
const htmlBody = await htmlResponse.text();
console.log(`Status: ${htmlResponse.status}`);
console.log(`Content-Type: ${htmlResponse.headers.get('Content-Type')}`);
console.log(`Body (primeros 50 chars): ${htmlBody.substring(0, 50)}`);
if (htmlBody.includes('<html>')) {
  console.log('✅ HTML pasado sin normalizar');
} else {
  console.log('❌ HTML fue normalizado a JSON (ERROR)');
}
console.log('');

// Test 2: API del Admin (SÍ debe normalizar)
console.log('2. PRUEBA: API del Admin');
console.log('───────────────────────────────────────────────────────────────');
const apiRequest = {
  url: 'http://localhost:3000/admin/api/system/diagnostics',
  headers: new Headers({
    'Accept': 'application/json'
  })
};

const guardedApi = withRuntimeGuard(mockTextErrorHandler);
const apiResponse = await guardedApi(apiRequest, {}, {});
const apiBody = await apiResponse.text();
console.log(`Status: ${apiResponse.status}`);
console.log(`Content-Type: ${apiResponse.headers.get('Content-Type')}`);
console.log(`Body: ${apiBody.substring(0, 200)}`);
try {
  const parsed = JSON.parse(apiBody);
  if (parsed.ok !== undefined) {
    console.log('✅ API normalizada a JSON canónico');
  } else {
    console.log('❌ API no tiene formato canónico');
  }
} catch (e) {
  console.log('❌ API no es JSON válido (ERROR)');
}
console.log('');

// Test 3: API con Accept: application/json (SÍ debe normalizar)
console.log('3. PRUEBA: Request con Accept: application/json');
console.log('───────────────────────────────────────────────────────────────');
const jsonRequest = {
  url: 'http://localhost:3000/admin/dashboard',
  headers: new Headers({
    'Accept': 'application/json'
  })
};

const guardedJson = withRuntimeGuard(mockTextErrorHandler);
const jsonResponse = await guardedJson(jsonRequest, {}, {});
const jsonBody = await jsonResponse.text();
console.log(`Status: ${jsonResponse.status}`);
console.log(`Content-Type: ${jsonResponse.headers.get('Content-Type')}`);
console.log(`Body: ${jsonBody.substring(0, 200)}`);
try {
  const parsed = JSON.parse(jsonBody);
  if (parsed.ok !== undefined) {
    console.log('✅ Normalizado a JSON canónico (se espera JSON)');
  } else {
    console.log('❌ No tiene formato canónico');
  }
} catch (e) {
  console.log('❌ No es JSON válido (ERROR)');
}
console.log('');

// Test 4: Página HTML sin /admin/api (NO debe normalizar)
console.log('4. PRUEBA: Página HTML sin /admin/api');
console.log('───────────────────────────────────────────────────────────────');
const htmlPageRequest = {
  url: 'http://localhost:3000/admin/login',
  headers: new Headers({
    'Accept': 'text/html'
  })
};

const guardedPage = withRuntimeGuard(mockHtmlHandler);
const pageResponse = await guardedPage(htmlPageRequest, {}, {});
const pageBody = await pageResponse.text();
console.log(`Status: ${pageResponse.status}`);
console.log(`Content-Type: ${pageResponse.headers.get('Content-Type')}`);
console.log(`Body (primeros 50 chars): ${pageBody.substring(0, 50)}`);
if (pageBody.includes('<html>')) {
  console.log('✅ HTML pasado sin normalizar');
} else {
  console.log('❌ HTML fue normalizado a JSON (ERROR)');
}
console.log('');

console.log('═══════════════════════════════════════════════════════════════');
console.log('✅ PRUEBA COMPLETADA');
console.log('═══════════════════════════════════════════════════════════════');

