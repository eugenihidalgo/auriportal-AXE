// scripts/test-system-modes.js
// Script de prueba de System Modes

import 'dotenv/config';
import {
  getSystemMode,
  isSystemWritable,
  isSystemReadOnly,
  getSystemModeInfo,
  getSystemModeDescription,
  isSystemInMode
} from '../src/core/system/system-modes.js';

console.log('═══════════════════════════════════════════════════════════════');
console.log('🔍 PRUEBA DE SYSTEM MODES');
console.log('═══════════════════════════════════════════════════════════════');
console.log('');

// 1. Obtener modo actual
console.log('1. MODO ACTUAL DEL SISTEMA');
console.log('───────────────────────────────────────────────────────────────');
const mode = getSystemMode();
console.log(`Modo: ${mode}`);
console.log(`Descripción: ${getSystemModeDescription()}`);
console.log('');

// 2. Verificar capacidades
console.log('2. CAPACIDADES DEL SISTEMA');
console.log('───────────────────────────────────────────────────────────────');
console.log(`Permite escritura: ${isSystemWritable() ? '✅ Sí' : '❌ No'}`);
console.log(`Modo solo lectura: ${isSystemReadOnly() ? '✅ Sí' : '❌ No'}`);
console.log('');

// 3. Información detallada
console.log('3. INFORMACIÓN DETALLADA');
console.log('───────────────────────────────────────────────────────────────');
const info = getSystemModeInfo();
console.log(JSON.stringify(info, null, 2));
console.log('');

// 4. Verificar modos específicos
console.log('4. VERIFICACIÓN DE MODOS ESPECÍFICOS');
console.log('───────────────────────────────────────────────────────────────');
const modes = ['NORMAL', 'DEGRADED', 'SAFE', 'BROKEN'];
modes.forEach(targetMode => {
  const isInMode = isSystemInMode(targetMode);
  console.log(`  ${isInMode ? '✅' : '  '} ${targetMode}: ${isInMode ? 'SÍ' : 'NO'}`);
});
console.log('');

// 5. Matriz de decisiones
console.log('5. MATRIZ DE DECISIONES');
console.log('───────────────────────────────────────────────────────────────');
console.log('Modo      | Escritura | Solo Lectura | Descripción');
console.log('──────────|───────────|──────────────|─────────────────────────');
modes.forEach(m => {
  // Simular cada modo para mostrar la matriz
  const writable = m === 'NORMAL' || m === 'DEGRADED' || m === 'SAFE';
  const readOnly = !writable;
  const desc = m === 'NORMAL' ? 'Completamente operativo' :
               m === 'DEGRADED' ? 'Operativo con limitaciones' :
               m === 'SAFE' ? 'Modo seguro (override)' :
               'No operativo';
  const current = m === mode ? ' ← ACTUAL' : '';
  console.log(`${m.padEnd(9)} | ${writable ? '✅ Sí    ' : '❌ No    '} | ${readOnly ? '✅ Sí        ' : '❌ No        '} | ${desc}${current}`);
});
console.log('');

console.log('═══════════════════════════════════════════════════════════════');
console.log('✅ PRUEBA COMPLETADA');
console.log('═══════════════════════════════════════════════════════════════');

