/**
 * inject_main.js
 * LEGACY GLOBAL INJECTOR
 * 
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║ ⚠️  AISLAMIENTO CONSTITUCIONAL v1.4.3                                         ║
 * ║                                                                              ║
 * ║ LEGACY GLOBAL INJECTOR                                                       ║
 * ║ MASTER domain is sovereign and MUST NOT execute this file                   ║
 * ║                                                                              ║
 * ║ PROHIBIDO ejecutarse en dominio MASTER.                                      ║
 * ║ Cualquier lógica nueva debe ir a inject_master.js                            ║
 * ║                                                                              ║
 * ║ CONTRATO: Domain Context Contract v1                                         ║
 * ║ Master es un dominio soberano con su propio entry gate                      ║
 * ║                                                                              ║
 * ║ GUARD DURA: Este archivo NUNCA se ejecuta en MASTER, bajo ninguna           ║
 * ║ circunstancia (ni directa, ni indirecta, ni por caché, ni por navegación)   ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

// ═══════════════════════════════════════════════════════════════════════════════
// GUARD CONSTITUCIONAL DURA v1.4.3 - AISLAMIENTO ABSOLUTO DE MASTER
// ═══════════════════════════════════════════════════════════════════════════════
// Este guard DEBE ejecutarse ANTES de cualquier otra lógica.
// Si el contexto es MASTER, abortar inmediatamente sin ejecutar nada.

(function() {
  'use strict';
  
  // Verificar contexto MASTER (temprano, antes de cualquier lógica)
  if (typeof window !== 'undefined' && window.__AP_CONTEXT__ === 'MASTER') {
    // ABORTAR: Este archivo NO debe ejecutarse en MASTER
    // No loguear (evitar ruido en consola)
    // No ejecutar código adicional
    return; // IIFE return - aborta la ejecución del módulo
  }
  
  // Si llegamos aquí, NO es contexto MASTER
  // Continuar con lógica legacy/global si existe
  
  // Archivo vacío para evitar errores 500 cuando extensiones del navegador intentan cargarlo
  // Este archivo es inyectado por extensiones del navegador y no debe contener código funcional
  
})();



















