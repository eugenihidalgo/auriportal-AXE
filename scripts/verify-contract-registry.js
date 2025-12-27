// scripts/verify-contract-registry.js
// Script de verificación del Contract Registry
// Ejecuta validaciones y muestra estadísticas

import 'dotenv/config';
import {
  getAllContracts,
  validateRegistry,
  getRegistryStats,
  getContractsByType,
  getContractsByStatus
} from '../src/core/contracts/contract-registry.js';

console.log('═══════════════════════════════════════════════════════════════');
console.log('🔍 VERIFICACIÓN DEL CONTRACT REGISTRY');
console.log('═══════════════════════════════════════════════════════════════');
console.log('');

// Validar registry
const validation = validateRegistry();

console.log('📋 VALIDACIÓN');
console.log('───────────────────────────────────────────────────────────────');
if (validation.valid) {
  console.log('✅ Registry válido');
} else {
  console.log('❌ Registry inválido');
  console.log('');
  console.log('Errores:');
  validation.errors.forEach(error => {
    console.log(`  ❌ ${error}`);
  });
}

if (validation.warnings.length > 0) {
  console.log('');
  console.log('Advertencias:');
  validation.warnings.forEach(warning => {
    console.log(`  ⚠️  ${warning}`);
  });
}

console.log('');

// Estadísticas
const stats = getRegistryStats();
console.log('📊 ESTADÍSTICAS');
console.log('───────────────────────────────────────────────────────────────');
console.log(`Total de contratos: ${stats.total}`);
console.log('');
console.log('Por tipo:');
Object.entries(stats.by_type).forEach(([type, count]) => {
  console.log(`  ${type}: ${count}`);
});
console.log('');
console.log('Por estado:');
Object.entries(stats.by_status).forEach(([status, count]) => {
  console.log(`  ${status}: ${count}`);
});
console.log('');
console.log(`Con dependencias: ${stats.with_dependencies}`);
console.log(`Sin dependencias: ${stats.without_dependencies}`);

console.log('');

// Listar contratos por tipo
console.log('📑 CONTRATOS POR TIPO');
console.log('───────────────────────────────────────────────────────────────');

const types = ['domain', 'projection', 'runtime', 'ui', 'integration', 'route'];
for (const type of types) {
  const contracts = getContractsByType(type);
  if (contracts.length > 0) {
    console.log(`\n${type.toUpperCase()} (${contracts.length}):`);
    contracts.forEach(contract => {
      console.log(`  • ${contract.id} - ${contract.name}`);
      console.log(`    ${contract.description}`);
      if (contract.dependencies && contract.dependencies.length > 0) {
        console.log(`    Dependencias: ${contract.dependencies.join(', ')}`);
      }
    });
  }
}

console.log('');
console.log('═══════════════════════════════════════════════════════════════');
console.log('✅ VERIFICACIÓN COMPLETADA');
console.log('═══════════════════════════════════════════════════════════════');

// Exit code basado en validación
process.exit(validation.valid ? 0 : 1);

