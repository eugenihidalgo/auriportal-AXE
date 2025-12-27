// tests/fixtures/student.js
// Fixtures de estudiantes para tests

/**
 * Crea un objeto estudiante de prueba con datos consistentes
 * 
 * @param {Object} overrides - Valores para sobrescribir los por defecto
 * @returns {Object} Objeto estudiante normalizado
 */
export function createTestStudent(overrides = {}) {
  const baseStudent = {
    id: 1,
    email: 'test@example.com',
    apodo: 'Test User',
    fechaInscripcion: new Date('2024-01-01').getTime(),
    nivel: 1,
    nivel_actual: 1,
    nivel_manual: null,
    streak: 0,
    lastPractice: null,
    fecha_ultima_practica: null,
    estado_suscripcion: 'activa',
    fecha_reactivacion: null,
    suscripcionActiva: true,
    tiene_mundo_de_luz: true,
    energia_emocional: 5,
    tema_preferido: 'light',
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01')
  };
  
  return { ...baseStudent, ...overrides };
}

/**
 * Crea un estudiante con racha activa
 */
export function createStudentWithStreak(days = 5) {
  const lastPractice = new Date();
  lastPractice.setDate(lastPractice.getDate() - 1); // Ayer
  
  return createTestStudent({
    streak: days,
    lastPractice: lastPractice.toISOString().substring(0, 10),
    fecha_ultima_practica: lastPractice
  });
}

/**
 * Crea un estudiante con suscripción pausada
 */
export function createStudentWithPausedSubscription() {
  return createTestStudent({
    estado_suscripcion: 'pausada',
    suscripcionActiva: false
  });
}

/**
 * Crea un estudiante con nivel avanzado
 */
export function createStudentWithHighLevel(level = 5) {
  const fechaInscripcion = new Date();
  fechaInscripcion.setDate(fechaInscripcion.getDate() - 200); // Hace 200 días
  
  return createTestStudent({
    nivel: level,
    nivel_actual: level,
    fechaInscripcion: fechaInscripcion.getTime()
  });
}

/**
 * Crea un estudiante nuevo (sin prácticas)
 */
export function createNewStudent() {
  return createTestStudent({
    streak: 0,
    lastPractice: null,
    fecha_ultima_practica: null
  });
}




















