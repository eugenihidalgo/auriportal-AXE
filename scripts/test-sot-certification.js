// scripts/test-sot-certification.js
// Script para probar la certificación SOT de Técnicas de Limpieza

import { checkSotCertification } from '../src/core/assembly/assembly-check-engine.js';

async function testTecnicasLimpiezaCertification() {
  console.log('🔍 Verificando certificación SOT: tecnicas-limpieza...\n');
  
  const result = await checkSotCertification(
    'tecnicas-limpieza',
    'services/tecnicas-limpieza-service.js',
    {}
  );
  
  console.log('📊 Resultado:');
  console.log(`Estado: ${result.status}`);
  console.log(`Código: ${result.code || 'OK'}`);
  console.log(`Mensaje: ${result.message}`);
  console.log('\n📋 Detalles:');
  console.log(`- Documento existe: ${result.details.doc_exists ? '✅' : '❌'}`);
  console.log(`- Contrato semántico: ${result.details.semantic_contract_declared ? '✅' : '❌'}`);
  console.log(`- FILTER_CONTRACT exportado: ${result.details.filter_contract_exported ? '✅' : '❌'}`);
  console.log(`- listForConsumption() existe: ${result.details.list_for_consumption_exists ? '✅' : '❌'}`);
  console.log(`- UI sin lógica: ${result.details.ui_has_no_logic ? '✅' : '❌'}`);
  console.log(`- Consumible sin UI: ${result.details.consumable_without_ui ? '✅' : '❌'}`);
  console.log(`- Duración: ${result.details.duration_ms}ms\n`);
  
  if (result.status === 'OK') {
    console.log('✅ SOT CERTIFICADO CORRECTAMENTE');
    process.exit(0);
  } else {
    console.log(`❌ SOT NO CERTIFICADO: ${result.message}`);
    process.exit(1);
  }
}

testTecnicasLimpiezaCertification().catch(error => {
  console.error('❌ Error ejecutando test:', error);
  process.exit(1);
});


