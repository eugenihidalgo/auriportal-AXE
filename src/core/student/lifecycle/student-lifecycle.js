// src/core/student/lifecycle/student-lifecycle.js
// Student Lifecycle Map v1
//
// Define los estados y transiciones del ciclo de vida del alumno.

/**
 * Estados del ciclo de vida del alumno
 */
export const STUDENT_LIFECYCLE_STATES = {
  CREATED: 'created',
  ENROLLED: 'enrolled',
  ACTIVE: 'active',
  PAUSED: 'paused',
  RESUMED: 'resumed',
  SUSPENDED: 'suspended',
  ARCHIVED: 'archived' // Futuro
};

/**
 * Transiciones permitidas del ciclo de vida
 * 
 * Formato: { from: [states], to: state, condition?: string }
 */
export const STUDENT_LIFECYCLE_TRANSITIONS = [
  {
    from: [null], // Estado inicial (no existe)
    to: STUDENT_LIFECYCLE_STATES.CREATED,
    condition: 'Al crear registro en students'
  },
  {
    from: [STUDENT_LIFECYCLE_STATES.CREATED],
    to: STUDENT_LIFECYCLE_STATES.ENROLLED,
    condition: 'Al crear student_product_memberships'
  },
  {
    from: [STUDENT_LIFECYCLE_STATES.ENROLLED, STUDENT_LIFECYCLE_STATES.RESUMED],
    to: STUDENT_LIFECYCLE_STATES.ACTIVE,
    condition: 'Al establecer operational_state = ACTIVE'
  },
  {
    from: [STUDENT_LIFECYCLE_STATES.ACTIVE],
    to: STUDENT_LIFECYCLE_STATES.PAUSED,
    condition: 'Al llamar pauseStudent()'
  },
  {
    from: [STUDENT_LIFECYCLE_STATES.PAUSED],
    to: STUDENT_LIFECYCLE_STATES.RESUMED,
    condition: 'Al llamar resumeStudent()'
  },
  {
    from: [STUDENT_LIFECYCLE_STATES.RESUMED],
    to: STUDENT_LIFECYCLE_STATES.ACTIVE,
    condition: 'Automático al establecer operational_state = ACTIVE'
  },
  {
    from: [STUDENT_LIFECYCLE_STATES.ACTIVE, STUDENT_LIFECYCLE_STATES.PAUSED],
    to: STUDENT_LIFECYCLE_STATES.SUSPENDED,
    condition: 'Al establecer operational_state = SUSPENDED (por Master o sistema)'
  },
  {
    from: [STUDENT_LIFECYCLE_STATES.SUSPENDED],
    to: STUDENT_LIFECYCLE_STATES.ACTIVE,
    condition: 'Al establecer operational_state = ACTIVE (solo Master)'
  },
  {
    from: [
      STUDENT_LIFECYCLE_STATES.ACTIVE,
      STUDENT_LIFECYCLE_STATES.PAUSED,
      STUDENT_LIFECYCLE_STATES.SUSPENDED
    ],
    to: STUDENT_LIFECYCLE_STATES.ARCHIVED,
    condition: 'Al establecer deleted_at (soft delete) - FUTURO'
  }
];

/**
 * Verifica si una transición es válida
 * 
 * @param {string} fromState - Estado origen
 * @param {string} toState - Estado destino
 * @returns {boolean} true si la transición es válida
 */
export function isValidTransition(fromState, toState) {
  const transition = STUDENT_LIFECYCLE_TRANSITIONS.find(
    t => t.to === toState && (t.from.includes(fromState) || t.from.includes(null))
  );
  return transition !== undefined;
}

/**
 * Obtiene el estado del ciclo de vida basado en el contexto del alumno
 * 
 * @param {Object} context - Contexto del alumno (output de buildStudentContext)
 * @returns {string} Estado del ciclo de vida
 */
export function getLifecycleState(context) {
  if (!context.student) {
    return null; // No existe
  }

  if (context.student.deleted_at) {
    return STUDENT_LIFECYCLE_STATES.ARCHIVED;
  }

  const operationalState = context.operational_state?.state;

  if (operationalState === 'SUSPENDED') {
    return STUDENT_LIFECYCLE_STATES.SUSPENDED;
  }

  if (operationalState === 'PAUSED') {
    return STUDENT_LIFECYCLE_STATES.PAUSED;
  }

  if (operationalState === 'ACTIVE') {
    if (context.membership) {
      return STUDENT_LIFECYCLE_STATES.ACTIVE;
    }
    return STUDENT_LIFECYCLE_STATES.ENROLLED;
  }

  // Si no hay operational_state, asumir CREATED
  if (!context.membership) {
    return STUDENT_LIFECYCLE_STATES.CREATED;
  }

  return STUDENT_LIFECYCLE_STATES.ENROLLED;
}


