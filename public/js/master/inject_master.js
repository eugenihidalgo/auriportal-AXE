/**
 * inject_master.js
 * Entry Gate canónico del dominio MASTER
 * 
 * PRINCIPIO CONSTITUCIONAL:
 * - Master es un dominio soberano
 * - Master NO ejecuta lógica legacy (inject_main.js)
 * - Master tiene su propio entry gate
 * - Ningún script global puede ejecutarse en Master sin contrato
 * 
 * RESPONSABILIDAD ÚNICA:
 * - Verificar contexto de dominio
 * - Delegar al sistema Master (script loader)
 * 
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║ ⚠️  REGLAS ABSOLUTAS                                                         ║
 * ║                                                                              ║
 * ║ PROHIBIDO:                                                                   ║
 * ║ ❌ Guards                                                                     ║
 * ║ ❌ Lógica                                                                     ║
 * ║ ❌ UI                                                                         ║
 * ║ ❌ Timeouts                                                                    ║
 * ║                                                                              ║
 * ║ OBLIGATORIO:                                                                 ║
 * ║ ✅ Solo delegación                                                            ║
 * ║ ✅ Verificación de contexto                                                  ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

// Verificar contexto de dominio (CONTRATO: Domain Context Contract v1)
if (window.__AP_CONTEXT__ !== 'MASTER') {
  // NO ejecutar fuera del dominio Master
  return;
}

// Punto único de entrada Master
// El script loader carga los scripts requeridos desde el contrato
import('/js/master/master-script-loader.js');

