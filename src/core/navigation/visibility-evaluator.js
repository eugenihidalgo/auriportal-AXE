// src/core/navigation/visibility-evaluator.js
// Evaluador puro de visibility rules para NavigationDefinition v1
//
// PRINCIPIOS:
// - Función pura: mismo input → mismo output (determinista)
// - Sin side effects: no modifica estado, no emite eventos
// - AND por defecto: todas las reglas deben cumplirse
// - negate respetado: invierte el resultado de la regla
// - Fail-open: si hay error en evaluación, la regla se considera NO cumplida

import { logError, logWarn } from '../observability/logger.js';

/**
 * Contexto de evaluación derivado del estudiante
 * 
 * @typedef {Object} EvaluationContext
 * @property {number} user_level - Nivel actual del usuario (1-20)
 * @property {boolean} practiced_today - Si el usuario practicó hoy
 * @property {number} active_runs - Número de recorridos activos
 * @property {Object<string, boolean>} feature_flags - Feature flags activos
 * @property {string[]} roles - Roles del usuario (ej: ['student', 'beta_tester'])
 */

/**
 * Construye el contexto de evaluación desde el StudentContext
 * 
 * Este es el único punto donde se extrae información del contexto del estudiante.
 * Cambios en la estructura del StudentContext solo requieren cambios aquí.
 * 
 * @param {Object} studentCtx - Contexto del estudiante (de buildStudentContext)
 * @returns {EvaluationContext} Contexto normalizado para evaluación
 */
export function buildEvaluationContext(studentCtx) {
  // Extraer nivel del estudiante
  const userLevel = studentCtx?.nivelInfo?.nivel 
    || studentCtx?.student?.nivel_actual 
    || 1;

  // Extraer si practicó hoy
  const practicedToday = studentCtx?.todayPracticed 
    || studentCtx?.streakInfo?.todayPracticed 
    || false;

  // Extraer recorridos activos (por ahora siempre 0, se puede expandir)
  const activeRuns = studentCtx?.activeRuns || 0;

  // Extraer feature flags (se evaluarán en tiempo real con isFeatureEnabled)
  // Por ahora pasamos un objeto vacío - las flags se evalúan dinámicamente
  const featureFlags = {};

  // Extraer roles del estudiante
  const roles = [];
  
  // Rol básico de estudiante
  if (studentCtx?.student) {
    roles.push('student');
  }
  
  // Rol de beta tester (si tiene el flag)
  if (studentCtx?.student?.is_beta_tester || studentCtx?.student?.roles?.includes('beta_tester')) {
    roles.push('beta_tester');
  }
  
  // Rol de admin (si aplica)
  if (studentCtx?.isAdmin) {
    roles.push('admin');
  }
  
  // Roles adicionales del student si existen
  if (Array.isArray(studentCtx?.student?.roles)) {
    studentCtx.student.roles.forEach(role => {
      if (!roles.includes(role)) {
        roles.push(role);
      }
    });
  }

  return {
    user_level: userLevel,
    practiced_today: practicedToday,
    active_runs: activeRuns,
    feature_flags: featureFlags,
    roles
  };
}

/**
 * Evalúa un operador de comparación
 * 
 * @param {number} actual - Valor actual
 * @param {string} operator - Operador (>=, <=, ==, >, <, !=)
 * @param {number} expected - Valor esperado
 * @returns {boolean} Resultado de la comparación
 */
function evaluateOperator(actual, operator, expected) {
  switch (operator) {
    case '>=': return actual >= expected;
    case '<=': return actual <= expected;
    case '==': return actual === expected;
    case '>':  return actual > expected;
    case '<':  return actual < expected;
    case '!=': return actual !== expected;
    default:   return false;
  }
}

/**
 * Evalúa una regla de visibilidad individual
 * 
 * @param {Object} rule - Regla a evaluar
 * @param {EvaluationContext} ctx - Contexto de evaluación
 * @returns {boolean} true si la regla se cumple, false si no
 */
function evaluateRule(rule, ctx) {
  if (!rule || !rule.rule_type) {
    return false; // Regla inválida = no cumplida
  }

  let result = false;

  try {
    switch (rule.rule_type) {
      case 'user_level':
        result = evaluateOperator(ctx.user_level, rule.operator, rule.value);
        break;

      case 'practiced_today':
        result = ctx.practiced_today === rule.value;
        break;

      case 'active_runs':
        result = evaluateOperator(ctx.active_runs, rule.operator, rule.value);
        break;

      case 'feature_flag':
        // Evaluar feature flag dinámicamente
        // Importamos isFeatureEnabled de forma dinámica para evitar dependencias circulares
        // Nota: En runtime, las flags se evalúan consultando el sistema de flags
        try {
          // Por ahora usamos import dinámico
          // En el contexto actual, verificamos si el flag está en el contexto
          // o hacemos una evaluación simple
          const flagValue = ctx.feature_flags[rule.flag_name];
          if (flagValue !== undefined) {
            result = flagValue === true;
          } else {
            // Si no está en el contexto, intentar evaluar con el sistema de flags
            // Por defecto, flag no definido = false (fail-closed para features)
            result = false;
          }
        } catch {
          result = false;
        }
        break;

      case 'role':
        result = ctx.roles.includes(rule.role);
        break;

      default:
        result = false;
    }
  } catch (error) {
    logError('visibility-evaluator', 'Error evaluando regla', {
      rule_type: rule.rule_type,
      error: error.message
    });
    result = false;
  }

  // Aplicar negate si está presente
  if (rule.negate === true) {
    result = !result;
  }

  return result;
}

/**
 * Evalúa un array de reglas de visibilidad (AND lógico)
 * 
 * Todas las reglas deben cumplirse para que el resultado sea true.
 * Un array vacío se considera como "sin restricciones" = visible.
 * 
 * @param {Object[]} rules - Array de reglas a evaluar
 * @param {EvaluationContext} ctx - Contexto de evaluación
 * @returns {boolean} true si todas las reglas se cumplen (o no hay reglas)
 */
function evaluateRules(rules, ctx) {
  // Sin reglas = visible (no hay restricciones)
  if (!rules || !Array.isArray(rules) || rules.length === 0) {
    return true;
  }

  // AND lógico: todas deben cumplirse
  return rules.every(rule => evaluateRule(rule, ctx));
}

/**
 * Filtra un NavItem según sus reglas de visibilidad
 * 
 * @param {Object} item - NavItem a filtrar
 * @param {EvaluationContext} ctx - Contexto de evaluación
 * @returns {Object|null} Item si es visible, null si no
 */
function filterItem(item, ctx) {
  const isVisible = evaluateRules(item.visibility_rules, ctx);
  return isVisible ? item : null;
}

/**
 * Filtra una sección y sus items según reglas de visibilidad
 * 
 * @param {Object} section - Sección a filtrar
 * @param {EvaluationContext} ctx - Contexto de evaluación
 * @returns {Object|null} Sección filtrada si es visible (con items visibles), null si no
 */
function filterSection(section, ctx) {
  // Primero verificar visibilidad de la sección
  const isSectionVisible = evaluateRules(section.visibility_rules, ctx);
  
  if (!isSectionVisible) {
    return null;
  }

  // Filtrar items de la sección
  const visibleItems = section.items
    .map(item => filterItem(item, ctx))
    .filter(item => item !== null)
    .sort((a, b) => a.order - b.order); // Mantener orden

  // Si no hay items visibles, ocultar sección completa
  if (visibleItems.length === 0) {
    return null;
  }

  // Devolver sección con items filtrados
  return {
    ...section,
    items: visibleItems
  };
}

/**
 * Evalúa y filtra un NavigationDefinition completo según contexto del estudiante
 * 
 * Esta es la función principal del evaluador.
 * Toma un NavigationDefinition validado y un contexto de estudiante,
 * y devuelve un NavigationDefinition filtrado con solo elementos visibles.
 * 
 * GARANTÍAS:
 * - Determinista: mismo input → mismo output
 * - Sin side effects: no modifica nada
 * - Orden preservado: los items y secciones mantienen su order
 * 
 * @param {Object} navigation - NavigationDefinition validado
 * @param {EvaluationContext} evalCtx - Contexto de evaluación (de buildEvaluationContext)
 * @returns {Object} NavigationDefinition filtrado
 */
export function evaluateNavigation(navigation, evalCtx) {
  if (!navigation || !navigation.sections) {
    logWarn('visibility-evaluator', 'NavigationDefinition inválida, devolviendo vacía', {
      has_navigation: !!navigation,
      has_sections: !!navigation?.sections
    });
    return {
      ...navigation,
      sections: []
    };
  }

  // Filtrar secciones
  const visibleSections = navigation.sections
    .map(section => filterSection(section, evalCtx))
    .filter(section => section !== null)
    .sort((a, b) => a.order - b.order); // Mantener orden

  // Devolver NavigationDefinition filtrada
  return {
    ...navigation,
    sections: visibleSections,
    _filtered: true, // Marcador interno
    _filtered_at: new Date().toISOString()
  };
}

/**
 * Evalúa navegación desde el contexto completo del estudiante
 * 
 * Función de conveniencia que combina buildEvaluationContext + evaluateNavigation.
 * Usar cuando se tiene el StudentContext directamente.
 * 
 * @param {Object} navigation - NavigationDefinition validado
 * @param {Object} studentCtx - StudentContext (de buildStudentContext)
 * @returns {Object} NavigationDefinition filtrado
 */
export function evaluateNavigationForStudent(navigation, studentCtx) {
  const evalCtx = buildEvaluationContext(studentCtx);
  return evaluateNavigation(navigation, evalCtx);
}














