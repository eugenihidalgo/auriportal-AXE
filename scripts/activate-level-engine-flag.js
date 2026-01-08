// scripts/activate-level-engine-flag.js
// Activa el feature flag level_engine_pde_v1

import { setFlag } from '../src/core/feature-flags/feature-flag-service.js';

async function activateFlag() {
  try {
    console.log('[FeatureFlag] Activando level_engine_pde_v1...');
    
    const result = await setFlag(
      'level_engine_pde_v1',
      true,
      {
        type: 'system',
        id: 'migration-script'
      }
    );
    
    console.log('[FeatureFlag] ✅ Feature flag activado:', result);
    return result;
  } catch (error) {
    console.error('[FeatureFlag] ❌ Error activando feature flag:', error.message);
    console.error('[FeatureFlag] Stack:', error.stack);
    throw error;
  }
}

// Ejecutar
activateFlag()
  .then(() => {
    console.log('[FeatureFlag] Proceso completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('[FeatureFlag] Proceso falló:', error);
    process.exit(1);
  });
