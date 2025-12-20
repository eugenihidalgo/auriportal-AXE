// tests/setup.js
// Configuración global para tests de Jest

import { jest } from '@jest/globals';

// Configurar variables de entorno para tests
process.env.NODE_ENV = 'test';
process.env.APP_ENV = 'dev';

// Mock de console para evitar ruido en tests (solo si jest está disponible)
if (typeof jest !== 'undefined') {
  global.console = {
    ...console,
    // Mantener errores y warnings visibles
    error: jest.fn(),
    warn: jest.fn(),
    // Silenciar logs normales en tests
    log: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
  };
}














