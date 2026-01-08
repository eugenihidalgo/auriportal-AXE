// scripts/verify-level-gates-sample.js
// Script de verificación de Level Gates v1 con datos de ejemplo

import { getDefaultLevelGatesRepo } from '../src/infra/repos/levels/level-gates-repo-pg.js';
import { getDefaultLevelLinesRepo } from '../src/infra/repos/levels/level-lines-repo-pg.js';
import { validateConditionContractV1 } from '../src/core/conditions/condition-contract-v1.js';

async function verifyLevelGatesSample() {
  console.log('[VerifyLevelGatesSample] Verificando funcionalidad de gates...\n');
  
  try {
    const linesRepo = getDefaultLevelLinesRepo();
    const gatesRepo = getDefaultLevelGatesRepo();
    
    // Obtener línea 'pde'
    const pdeLine = await linesRepo.getByKey('pde');
    if (!pdeLine) {
      console.error('❌ ERROR: Línea "pde" no encontrada');
      process.exit(1);
    }
    
    console.log('✅ Línea "pde" encontrada');
    
    // Verificar que podemos obtener gates (aunque estén vacíos)
    const gates = await gatesRepo.getActiveByLine('pde');
    console.log(`✅ Obtener gates activos funciona (${gates.length} gates encontrados)`);
    
    // Verificar Condition Contract v1 con ejemplo válido
    const validCondition = {
      all: [
        { path: 'level.computed_days', op: '>=', value: 30 }
      ]
    };
    
    const validation = validateConditionContractV1(validCondition);
    if (!validation.valid) {
      console.error('❌ ERROR: Condition Contract v1 no valida condición válida');
      console.error('   Errores:', validation.errors);
      process.exit(1);
    }
    
    console.log('✅ Condition Contract v1 valida correctamente');
    
    // Verificar condición inválida
    const invalidCondition = {
      invalid: true
    };
    
    const invalidValidation = validateConditionContractV1(invalidCondition);
    if (invalidValidation.valid) {
      console.error('❌ ERROR: Condition Contract v1 no rechaza condición inválida');
      process.exit(1);
    }
    
    console.log('✅ Condition Contract v1 rechaza condiciones inválidas');
    
    console.log('\n✅ Verificación de funcionalidad completada');
    process.exit(0);
  } catch (error) {
    console.error('❌ ERROR en verificación:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

verifyLevelGatesSample();
