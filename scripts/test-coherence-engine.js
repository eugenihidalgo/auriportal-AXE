// scripts/test-coherence-engine.js
// Script de prueba del Coherence Engine

import 'dotenv/config';
import {
  evaluateCoherence,
  getContractState,
  getSystemCoherenceReport,
  getContractsByEffectiveStatus,
  getDependents
} from '../src/core/coherence/coherence-engine.js';

console.log('═══════════════════════════════════════════════════════════════');
console.log('🔍 PRUEBA DEL COHERENCE ENGINE v1');
console.log('═══════════════════════════════════════════════════════════════');
console.log('');

// Evaluar coherencia completa
console.log('1. EVALUACIÓN COMPLETA');
console.log('───────────────────────────────────────────────────────────────');
const report = evaluateCoherence();
console.log('');
console.log('Estado global del sistema:', report.system_state);
console.log('Estadísticas:', JSON.stringify(report.stats, null, 2));
console.log('');

// Mostrar contratos con estados no-activos
console.log('2. CONTRATOS CON ESTADOS NO-ACTIVOS');
console.log('───────────────────────────────────────────────────────────────');
const degraded = getContractsByEffectiveStatus('degraded');
const broken = getContractsByEffectiveStatus('broken');

if (degraded.length > 0) {
  console.log(`\nDegradados (${degraded.length}):`);
  degraded.forEach(state => {
    console.log(`  • ${state.id}`);
    console.log(`    Declarado: ${state.declared_status}, Efectivo: ${state.effective_status}`);
    console.log(`    Razón: ${state.reason}`);
  });
}

if (broken.length > 0) {
  console.log(`\nRotos (${broken.length}):`);
  broken.forEach(state => {
    console.log(`  • ${state.id}`);
    console.log(`    Declarado: ${state.declared_status}, Efectivo: ${state.effective_status}`);
    console.log(`    Razón: ${state.reason}`);
  });
}

if (degraded.length === 0 && broken.length === 0) {
  console.log('✅ Todos los contratos están activos');
}

console.log('');

// Mostrar ejemplo de estado de un contrato específico
console.log('3. ESTADO DE UN CONTRATO ESPECÍFICO');
console.log('───────────────────────────────────────────────────────────────');
const exampleContract = 'projection.context.edit';
const state = getContractState(exampleContract);
if (state) {
  console.log(`Contrato: ${state.id}`);
  console.log(`  Declarado: ${state.declared_status}`);
  console.log(`  Efectivo: ${state.effective_status}`);
  console.log(`  Razón: ${state.reason}`);
  if (state.dependencies.length > 0) {
    console.log(`  Dependencias: ${state.dependencies.join(', ')}`);
    console.log(`  Estados de dependencias:`);
    state.dependency_states.forEach(depState => {
      console.log(`    - ${depState.id}: ${depState.effective_status}`);
    });
  }
} else {
  console.log(`❌ Contrato '${exampleContract}' no encontrado`);
}

console.log('');

// Mostrar dependientes de un contrato
console.log('4. DEPENDIENTES DE UN CONTRATO');
console.log('───────────────────────────────────────────────────────────────');
const baseContract = 'projection.context.list';
const dependents = getDependents(baseContract);
if (dependents.length > 0) {
  console.log(`Contratos que dependen de '${baseContract}':`);
  dependents.forEach(dep => {
    console.log(`  • ${dep.id} (efectivo: ${dep.effective_status})`);
  });
} else {
  console.log(`Ningún contrato depende de '${baseContract}'`);
}

console.log('');

// Mostrar resumen del reporte
console.log('5. RESUMEN DEL REPORTE');
console.log('───────────────────────────────────────────────────────────────');
console.log(`Estado del sistema: ${report.system_state}`);
console.log(`Total de contratos: ${report.stats.total}`);
console.log(`  - Activos: ${report.stats.active}`);
console.log(`  - Degradados: ${report.stats.degraded}`);
console.log(`  - Rotos: ${report.stats.broken}`);

console.log('');
console.log('═══════════════════════════════════════════════════════════════');
console.log('✅ PRUEBA COMPLETADA');
console.log('═══════════════════════════════════════════════════════════════');

