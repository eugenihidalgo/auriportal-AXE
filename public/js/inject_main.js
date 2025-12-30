/**
 * inject_main.js
 * LEGACY GLOBAL INJECTOR
 * 
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║ ⚠️  AISLAMIENTO CONSTITUCIONAL                                                ║
 * ║                                                                              ║
 * ║ PROHIBIDO ejecutarse en dominio MASTER.                                      ║
 * ║ Cualquier lógica nueva debe ir a inject_master.js                            ║
 * ║                                                                              ║
 * ║ CONTRATO: Domain Context Contract v1                                         ║
 * ║ Master es un dominio soberano con su propio entry gate                      ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

// GUARD CONSTITUCIONAL: NO ejecutar en dominio Master
// Master tiene su propio entry gate (inject_master.js)
if (window.__AP_CONTEXT__ === 'MASTER') {
  return;
}

// Archivo vacío para evitar errores 500 cuando extensiones del navegador intentan cargarlo
// Este archivo es inyectado por extensiones del navegador y no debe contener código funcional



















