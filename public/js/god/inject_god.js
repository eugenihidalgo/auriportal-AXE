/**
 * inject_god.js
 * GOD ENTRY GATE v1 - AuriPortal God
 * 
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║ ⚠️  ENTRY GATE CANÓNICO v1                                                    ║
 * ║                                                                              ║
 * ║ GOD ENTRY GATE                                                               ║
 * ║ GOD domain is sovereign and MUST execute this file only                     ║
 * ║                                                                              ║
 * ║ CONTRATO: Domain Context Contract v1                                         ║
 * ║ GOD es un dominio soberano con su propio entry gate                         ║
 * ║                                                                              ║
 * ║ GUARD DURA: Este archivo SOLO se ejecuta en GOD, bajo ninguna               ║
 * ║ circunstancia debe ejecutarse en otros dominios                             ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

// ═══════════════════════════════════════════════════════════════════════════════
// GUARD CONSTITUCIONAL DURA v1 - AISLAMIENTO ABSOLUTO
// ═══════════════════════════════════════════════════════════════════════════════
// Este guard DEBE ejecutarse ANTES de cualquier otra lógica.
// Si el contexto NO es GOD, abortar inmediatamente sin ejecutar nada.

(function() {
  'use strict';
  
  // Verificar contexto GOD (temprano, antes de cualquier lógica)
  if (typeof window === 'undefined' || window.__AP_CONTEXT__ !== 'GOD') {
    // ABORTAR: Este archivo SOLO debe ejecutarse en GOD
    // No loguear (evitar ruido en consola)
    // No ejecutar código adicional
    return; // IIFE return - aborta la ejecución del módulo
  }
  
  // Si llegamos aquí, es contexto GOD
  // Cargar el script loader por contrato
  import('/js/god/god-script-loader.js').catch((error) => {
    console.error('[inject_god] Error cargando god-script-loader:', error);
    // Fail-closed: si falla el loader, no continuar
  });
})();
