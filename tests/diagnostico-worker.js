/**
 * Script de diagnóstico para el Google Worker
 */

import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

const URL = process.env.GOOGLE_WORKER_URL;
const SECRET = process.env.GOOGLE_WORKER_SECRET;

console.log('🔍 DIAGNÓSTICO DEL GOOGLE WORKER\n');
console.log(`URL: ${URL}`);
console.log(`Secret configurado: ${SECRET ? 'SÍ (' + SECRET.substring(0, 10) + '...)' : 'NO'}\n`);

// Test 1: Verificar que la URL responde
console.log('Test 1: Verificando que la URL responde...');
try {
  const res = await fetch(URL, { method: 'GET' });
  console.log(`Status: ${res.status}`);
  const text = await res.text();
  console.log(`Respuesta (primeros 200 chars): ${text.substring(0, 200)}\n`);
} catch (e) {
  console.log(`Error: ${e.message}\n`);
}

// Test 2: POST simple
console.log('Test 2: POST simple con JSON...');
try {
  const res = await fetch(URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: SECRET, accion: 'ping' })
  });
  console.log(`Status: ${res.status}`);
  console.log(`Headers:`, Object.fromEntries(res.headers));
  const text = await res.text();
  console.log(`Respuesta (primeros 500 chars):`);
  console.log(text.substring(0, 500));
  
  // Intentar parsear como JSON
  try {
    const json = JSON.parse(text);
    console.log('\n✅ Respuesta JSON válida:');
    console.log(JSON.stringify(json, null, 2));
  } catch (e) {
    console.log('\n❌ No es JSON válido');
  }
} catch (e) {
  console.log(`Error: ${e.message}`);
}

console.log('\n💡 SOLUCIÓN:');
console.log('Si ves HTML, necesitas:');
console.log('1. Ejecutar manualmente la URL en el navegador (autorizar permisos)');
console.log('2. Verificar que la implementación esté activa');
console.log('3. Verificar que el SCRIPT_SECRET coincida exactamente');















