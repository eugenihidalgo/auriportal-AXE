// src/core/flags/feature-flags.js
// Sistema de Feature Flags V4 para AuriPortal
// Control de ejecución de código según entorno (dev | beta | prod)
//
// FILOSOFÍA:
// - Fuente de verdad única en código (objeto FEATURE_FLAGS)
// - Decisión de activación SOLO por APP_ENV (sin base de datos, sin admin)
// - Sistema reversible y auditable
// - Integrado con observabilidad para trazabilidad
//
// ESTADOS:
// - "on"   → activo en dev, beta y prod
// - "beta" → activo SOLO en dev y beta (bloqueado en prod)
// - "off"  → nunca activo (en ningún entorno)
//
// USO:
//   import { isFeatureEnabled } from '../core/flags/feature-flags.js';
//   
//   if (isFeatureEnabled('progress_v4', { student })) {
//     // Código de la feature
//   }
//
// POR QUÉ NO DEPENDE DEL ADMIN AÚN:
// - El admin tiene UI visual pero NO funcional
// - Este sistema es la base para cuando el admin sea funcional
// - Por ahora, cambios de flags requieren deploy (seguro y auditable)

import { logInfo, logWarn } from '../observability/logger.js';
import { getRequestId } from '../observability/request-context.js';
import auditRepo from '../../infra/repos/audit-repo-pg.js';

/**
 * Fuente de verdad única de Feature Flags
 * 
 * Cada flag tiene un estado: "on" | "beta" | "off"
 * 
 * - "on"   → activo en todos los entornos (dev, beta, prod)
 * - "beta" → activo solo en dev y beta (bloqueado en prod)
 * - "off"  → nunca activo (en ningún entorno)
 * 
 * IMPORTANTE: Por defecto, todos los flags están en "off" para no romper nada existente.
 * Activar flags requiere cambio de código y deploy (seguro y auditable).
 */
const FEATURE_FLAGS = {
  // Features de ejemplo (NO activar nada por defecto)
  progress_v4: 'off',
  admin_redesign_v4: 'off',
  observability_extended: 'on', // Ya está en uso, mantener activo
  
  // Feature flag para cálculo de días activos (v2)
  // Propósito: Permitir evolución segura del cálculo de días activos sin deploy completo
  // Estado inicial: 'off' (comportamiento actual intacto)
  // Cuando se active: permitirá implementar nueva lógica de cálculo sin riesgo
  // ACTIVADO: 2025-12-15 - Para reconstrucción de estado derivado
  dias_activos_v2: 'on',
  
  // Feature flag para cálculo automático de niveles (v2)
  // Propósito: Proteger la función actualizarNivelSiCorresponde() que modifica nivel_actual en PostgreSQL
  // Estado inicial: 'off' (comportamiento actual intacto)
  // Cuando se active: permitirá implementar nueva lógica de cálculo de niveles sin riesgo
  // Afecta: progresión de alumnos, acceso a contenido y negocio
  nivel_calculo_v2: 'off',
  
  // Feature flag para cálculo de racha diaria (v2)
  // Propósito: Proteger la función checkDailyStreak() que modifica streak y fecha_ultima_practica en PostgreSQL
  // Estado inicial: 'off' (comportamiento actual intacto)
  // Cuando se active: permitirá implementar nueva lógica de cálculo de racha sin riesgo
  // Afecta: gamificación, motivación del alumno y creación de prácticas
  streak_calculo_v2: 'off',
  
  // Feature flag para control de suscripción (v2)
  // Propósito: Proteger las funciones críticas de suscripción:
  //   - puedePracticarHoy() - bloquea o permite práctica según estado de suscripción
  //   - gestionarEstadoSuscripcion() - gestiona pausa/reactivación de suscripciones
  //   - creación/cierre de pausas - modifica estado_suscripcion del alumno
  // Estado inicial: 'off' (comportamiento actual intacto)
  // Cuando se active: permitirá implementar nueva lógica de control de suscripción sin riesgo
  // Afecta: acceso a prácticas, estado de suscripción, pausas y reactivaciones
  suscripcion_control_v2: 'off',
  
  // Feature flag para Analytics Spine v1
  // Propósito: Sistema de recogida de eventos robusta y reutilizable, preparada para futuros módulos
  //   - off: no guarda eventos (comportamiento por defecto)
  //   - beta: solo en dev/beta
  //   - on: todos los entornos
  // Estado inicial: 'off' (comportamiento actual intacto)
  // Cuando se active: permitirá recoger eventos de analytics sin romper UX
  // Afecta: recogida de eventos de analytics (client y server)
  analytics_v1: 'off',
  
  // Feature flag para UI & Experience System v1
  // Propósito: Sistema de UI & Experience con Themes, Screens, Layers y Conversation Scripts
  //   - off: engine no se ejecuta (comportamiento actual intacto)
  //   - beta: solo en dev/beta
  //   - on: todos los entornos
  // Estado inicial: 'off' (comportamiento actual intacto)
  // Cuando se active: permitirá usar el engine de UI sin romper pantallas existentes
  // Afecta: renderizado de pantallas con themes y layers
  ui_experience_v1: 'off',
  
  // Feature flag para Guided Conversation Layer v1 (Aurelín)
  // Propósito: Layer conversacional con pasos (wizard) y scripts versionados
  //   - off: layer no se aplica
  //   - beta: solo en dev/beta
  //   - on: todos los entornos
  // Estado inicial: 'off' (comportamiento actual intacto)
  // Cuando se active: permitirá mostrar conversaciones guiadas sobre pantallas
  // Afecta: overlay conversacional con Aurelín
  ui_guided_conversation_v1: 'off',
  
  // Feature flag para Transition Background Layer v1
  // Propósito: Layer simple de transición de fondo (CSS/HTML)
  //   - off: layer no se aplica
  //   - beta: solo en dev/beta
  //   - on: todos los entornos
  // Estado inicial: 'off' (comportamiento actual intacto)
  // Cuando se active: permitirá aplicar transiciones de fondo
  // Afecta: decoración visual de pantallas
  ui_transition_layer_v1: 'off',
  
  // Feature flag para Custom Extension Layer v1 (Escape Hatch)
  // Propósito: Layer especial que permite inyectar CSS/JS/HTML con guardarraíles
  //   - off: layer no se aplica (nunca en prod por defecto)
  //   - beta: solo en dev/beta (con guardarraíles)
  //   - on: todos los entornos (con guardarraíles estrictos)
  // Estado inicial: 'off' (comportamiento actual intacto)
  // Cuando se active: permitirá extensibilidad total sin quedar bloqueado
  // Afecta: escape hatch controlado para no limitar ideas futuras
  ui_custom_extension_v1: 'off',
  
  // Feature flag para Motor de Automatizaciones (AUTO-1)
  // Propósito: Controlar ejecución de reglas con status 'beta'
  //   - off: reglas beta nunca se ejecutan
  //   - beta: reglas beta se ejecutan solo en dev/beta
  //   - on: reglas beta se ejecutan en todos los entornos
  // Estado inicial: 'off' (comportamiento actual intacto)
  // Cuando se active: permitirá ejecutar reglas en beta sin riesgo en prod
  // Afecta: ejecución de reglas de automatización con status 'beta'
  automations_beta: 'off',
  
  // Feature flag para Automation Engine Canónico v2 (Fase D.4)
  // Propósito: Controlar ejecución del motor de automatizaciones canónico
  //   - off: engine no ejecuta nada (comportamiento por defecto)
  //   - beta: engine ejecuta solo en dev/beta
  //   - on: engine ejecuta en todos los entornos
  // Estado inicial: 'off' (comportamiento actual intacto)
  // Cuando se active: permitirá ejecutar automatizaciones canónicas
  // Afecta: ejecución de automatizaciones definidas en automation_definitions
  AUTOMATIONS_ENGINE_ENABLED: 'off',
  
  // Feature flag para Capability Registry v1 (Recorridos)
  // Propósito: Sistema de registry para descubrir ScreenTemplates, StepTypes, Conditions, Events y PDE Resources
  //   - off: registry no disponible
  //   - beta: registry disponible solo en dev/beta
  //   - on: registry disponible en todos los entornos
  // Estado inicial: 'beta' (disponible en dev/beta para testing)
  // ACTIVADO: 2025-12-16 - Para permitir acceso al registry en producción
  // Afecta: endpoint /admin/api/registry y validación de recorridos
  recorridos_registry_v1: 'on',
  
  // Feature flag para Editor de Recorridos v1 (UI)
  // Propósito: UI del editor de recorridos v1
  //   - off: editor no disponible
  //   - beta: editor disponible solo en dev/beta
  //   - on: editor disponible en todos los entornos
  // Estado inicial: 'beta' (disponible en dev/beta para testing)
  // Cuando se active: permitirá usar el editor en producción
  // Afecta: UI del editor de recorridos (/admin/recorridos)
  recorridos_editor_v1: 'on',
  
  // Feature flag para Runtime de Recorridos v1 (Sprint 2B)
  // Propósito: Sistema de ejecución de recorridos publicados para alumnos
  //   - off: runtime no disponible
  //   - beta: runtime disponible solo en dev/beta
  //   - on: runtime disponible en todos los entornos
  // Estado inicial: 'beta' (disponible en dev/beta para testing)
  // Cuando se active: permitirá ejecutar recorridos en producción
  // Afecta: endpoints /api/recorridos/* para alumnos
  recorridos_runtime_v1: 'on',
  
  // Feature flag para Transmutaciones Energéticas v1
  // Propósito: Sistema de catálogo y resolución de bundles de transmutaciones energéticas
  //   - off: endpoint no disponible (fail-open con bundle vacío)
  //   - beta: disponible solo en dev/beta
  //   - on: disponible en todos los entornos
  // Estado inicial: 'on' (disponible en todos los entornos)
  // ACTIVADO: 2025-12-17 - Sistema funcional
  // Afecta: endpoint GET /api/energy/transmutations/bundle
  energy_transmutations_v1: 'on',
  
  // Feature flag para Editor de Navegación v1 (Backend)
  // Propósito: Sistema de navegación con versionado (draft/publish), auditoría y validación
  //   - off: endpoints no disponibles
  //   - beta: disponible solo en dev/beta
  //   - on: disponible en todos los entornos
  // Estado inicial: 'on' (habilitado en todos los entornos)
  // ACTIVADO: 2025-12-17 - Sistema funcional
  // Afecta: endpoints /admin/navigation/*
  navigation_editor_v1: 'on',
  
  // Agregar nuevos flags aquí siguiendo el mismo patrón
  // ejemplo_nuevo_flag: 'off',
};

/**
 * Obtiene el entorno actual de la aplicación
 * 
 * @returns {string} Entorno actual: 'dev' | 'beta' | 'prod'
 */
function getCurrentEnv() {
  const env = process.env.APP_ENV || 'prod';
  
  // Validar que sea un entorno válido
  if (!['dev', 'beta', 'prod'].includes(env)) {
    console.warn(`⚠️  APP_ENV inválido: ${env}, usando 'prod' por defecto`);
    return 'prod';
  }
  
  return env;
}

/**
 * Determina si un flag está activo según su estado y el entorno actual
 * 
 * Reglas:
 * - "on"   → activo en dev, beta y prod
 * - "beta" → activo SOLO en dev y beta
 * - "off"  → nunca activo
 * 
 * @param {string} flagState - Estado del flag: "on" | "beta" | "off"
 * @param {string} env - Entorno actual: "dev" | "beta" | "prod"
 * @returns {boolean} true si el flag está activo, false en caso contrario
 */
function isFlagActive(flagState, env) {
  if (flagState === 'on') {
    return true; // Activo en todos los entornos
  }
  
  if (flagState === 'beta') {
    return env === 'dev' || env === 'beta'; // Solo en dev y beta
  }
  
  // flagState === 'off' o cualquier otro valor
  return false; // Nunca activo
}

/**
 * Extrae metadatos del contexto para logging
 * 
 * @param {Object} ctx - Contexto opcional (puede contener student, request_id, etc.)
 * @returns {Object} Metadatos extraídos del contexto
 */
function extractContextMeta(ctx) {
  if (!ctx) return {};
  
  const meta = {};
  
  // Request ID (si existe en el contexto o en AsyncLocalStorage)
  const requestId = ctx.request_id || getRequestId();
  if (requestId) {
    meta.request_id = requestId;
  }
  
  // Información del alumno (si existe)
  if (ctx.student) {
    if (ctx.student.id) {
      meta.alumno_id = ctx.student.id;
    }
    if (ctx.student.email) {
      meta.email = ctx.student.email;
    }
  }
  
  // Cualquier otro campo del contexto
  if (ctx.alumno_id) meta.alumno_id = ctx.alumno_id;
  if (ctx.email) meta.email = ctx.email;
  
  return meta;
}

/**
 * Verifica si una feature está habilitada según su estado y el entorno actual
 * 
 * Esta es la función principal que debe usarse en el código para verificar
 * si una feature está activa antes de ejecutar su código.
 * 
 * @param {string} flagName - Nombre del flag a verificar
 * @param {Object} ctx - Contexto opcional para logging (puede contener student, request_id, etc.)
 * @returns {boolean} true si la feature está habilitada, false en caso contrario
 * 
 * @example
 * // Uso básico
 * if (isFeatureEnabled('progress_v4')) {
 *   // Código de la feature
 * }
 * 
 * @example
 * // Con contexto para logging
 * if (isFeatureEnabled('progress_v4', { student })) {
 *   // Código de la feature
 * }
 */
export function isFeatureEnabled(flagName, ctx = null) {
  // Validar que el flag existe
  if (!(flagName in FEATURE_FLAGS)) {
    const env = getCurrentEnv();
    logWarn('feature_flags', `Flag desconocido consultado: ${flagName}`, {
      flag: flagName,
      env,
      ...extractContextMeta(ctx)
    });
    return false; // Flag desconocido = no habilitado (seguro por defecto)
  }
  
  const flagState = FEATURE_FLAGS[flagName];
  const env = getCurrentEnv();
  const isActive = isFlagActive(flagState, env);
  
  // Extraer metadatos del contexto para logging
  const meta = {
    flag: flagName,
    estado: flagState,
    env,
    activo: isActive,
    ...extractContextMeta(ctx)
  };
  
  // Logging según el resultado
  if (!isActive) {
    // Feature bloqueada: log WARN para trazabilidad
    logWarn('feature_flags', `Feature bloqueada: ${flagName}`, meta);
  } else if (flagState === 'beta') {
    // Feature beta activa: log INFO para confirmar que se permite en dev/beta
    logInfo('feature_flags', `Feature beta activa: ${flagName}`, meta, true);
  }
  // Si está "on" y activa, no logueamos (evitar ruido en logs)
  
  // Registrar evento de auditoría solo para flags críticos
  // Por ahora solo suscripcion_control_v2
  // Se ejecuta de forma asíncrona (fire and forget) para no bloquear
  if (flagName === 'suscripcion_control_v2') {
    (async () => {
      try {
        await auditRepo.recordEvent({
          requestId: getRequestId(),
          actorType: ctx?.student ? 'student' : 'system',
          actorId: ctx?.student?.id?.toString(),
          eventType: 'FLAG_EVALUATED',
          severity: 'info',
          data: {
            flag_name: flagName,
            flag_state: flagState,
            is_active: isActive,
            env: meta.env
          }
        });
      } catch (err) {
        // No fallar si el audit falla (fail-open)
        // No logueamos aquí para evitar ruido
      }
    })();
  }
  
  return isActive;
}

/**
 * Obtiene el estado actual de un flag
 * 
 * Útil para debugging o para mostrar el estado en el admin panel.
 * 
 * @param {string} flagName - Nombre del flag
 * @returns {Object|null} Objeto con el estado del flag o null si no existe
 * 
 * @example
 * const state = getFeatureState('progress_v4');
 * // { estado: 'off', activo: false, env: 'prod' }
 */
export function getFeatureState(flagName) {
  // Validar que el flag existe
  if (!(flagName in FEATURE_FLAGS)) {
    return null;
  }
  
  const flagState = FEATURE_FLAGS[flagName];
  const env = getCurrentEnv();
  const isActive = isFlagActive(flagState, env);
  
  return {
    estado: flagState,
    activo: isActive,
    env
  };
}

/**
 * Obtiene todos los flags y sus estados
 * 
 * Útil para debugging o para mostrar en el admin panel.
 * 
 * @returns {Object} Objeto con todos los flags y sus estados
 * 
 * @example
 * const allFlags = getAllFeatureFlags();
 * // { progress_v4: { estado: 'off', activo: false, env: 'prod' }, ... }
 */
export function getAllFeatureFlags() {
  const env = getCurrentEnv();
  const result = {};
  
  for (const flagName in FEATURE_FLAGS) {
    const flagState = FEATURE_FLAGS[flagName];
    const isActive = isFlagActive(flagState, env);
    
    result[flagName] = {
      estado: flagState,
      activo: isActive,
      env
    };
  }
  
  return result;
}




