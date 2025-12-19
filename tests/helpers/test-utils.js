// tests/helpers/test-utils.js
// Utilidades generales para tests

/**
 * Espera un tiempo determinado (útil para tests asíncronos)
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Crea una fecha relativa a hoy
 * 
 * @param {number} daysOffset - Días de diferencia (negativo = pasado, positivo = futuro)
 * @returns {Date} Fecha calculada
 */
export function dateFromToday(daysOffset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  return date;
}

/**
 * Formatea una fecha como YYYY-MM-DD
 */
export function formatDate(date) {
  return date.toISOString().substring(0, 10);
}

/**
 * Calcula diferencia en días entre dos fechas
 */
export function daysDiff(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
}

/**
 * Mock de request de Express/Node
 */
export function createMockRequest(overrides = {}) {
  return {
    method: 'GET',
    url: '/',
    headers: {},
    query: {},
    body: {},
    cookies: {},
    ...overrides
  };
}

/**
 * Mock de response de Express/Node
 */
export function createMockResponse() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    redirect: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
    headers: {}
  };
  
  return res;
}

/**
 * Verifica que una función lance un error específico
 */
export async function expectToThrow(fn, errorMessage) {
  try {
    await fn();
    throw new Error('Expected function to throw, but it did not');
  } catch (error) {
    if (errorMessage && !error.message.includes(errorMessage)) {
      throw new Error(`Expected error message to include "${errorMessage}", but got "${error.message}"`);
    }
  }
}












