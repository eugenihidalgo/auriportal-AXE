// src/core/repos/student-creation-repo.js
// Contrato/Interfaz del Repositorio de Creación de Alumnos (UUID-first)
//
// Este archivo define el contrato que debe cumplir cualquier implementación
// del repositorio de creación de alumnos. Actúa como documentación del comportamiento esperado.
//
// REGLAS DEL CONTRATO:
// - Creación UUID-first (students como SOT)
// - Creación en alumnos (legacy) solo para compatibilidad
// - Idempotencia por email (retorna existente si ya existe)
// - Transacción atómica (students + alumnos en misma transacción)
// - Retorna { student_uuid, legacy_alumno_id, email }

/**
 * @typedef {Object} StudentCreationRepo
 * @property {Function} createStudent - Crea un alumno canónico (UUID-first)
 */

/**
 * CONTRATO: createStudent({ email, apodo, nombre_completo })
 * 
 * Crea un alumno canónico (UUID-first).
 * 
 * Flujo:
 * 1. Verificar si ya existe (idempotencia por email)
 * 2. Si existe, retornar existente
 * 3. Si no existe:
 *    - Crear en alumnos (legacy) primero
 *    - Crear en students (UUID) con legacy_alumno_id
 *    - Retornar { student_uuid, legacy_alumno_id, email }
 * 
 * @param {Object} data - Datos del alumno
 * @param {string} data.email - Email (obligatorio, único)
 * @param {string} [data.apodo] - Apodo (opcional)
 * @param {string} [data.nombre_completo] - Nombre completo (opcional)
 * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
 * @returns {Promise<Object>} { student_uuid, legacy_alumno_id, email }
 * @throws {Error} Si email es requerido o hay error de base de datos
 * 
 * Ejemplo:
 * const result = await repo.createStudent({
 *   email: 'alumno@example.com',
 *   apodo: 'Apodo',
 *   nombre_completo: 'Nombre Completo'
 * });
 * // Retorna: { student_uuid: '...', legacy_alumno_id: 123, email: 'alumno@example.com' }
 */
export function createStudent(data) {
  throw new Error('createStudent debe ser implementado por el repositorio concreto');
}
