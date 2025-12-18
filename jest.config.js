// jest.config.js
// Configuración de Jest para AuriPortal

export default {
  // Entorno de pruebas
  testEnvironment: 'node',
  
  // Extensión de archivos a probar
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.spec.js'
  ],
  
  // Directorios a ignorar
  testPathIgnorePatterns: [
    '/node_modules/',
    '/.git/',
    '/coverage/',
    '/logs/',
    '/database/.*\\.db',
    '/database/.*\\.sql'
  ],
  
  // Transformaciones (ES modules)
  transform: {},
  
  // Extensión de módulos
  moduleFileExtensions: ['js', 'json'],
  
  // Preset para ES modules
  preset: undefined,
  
  // Cobertura
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/**/*.spec.js',
    '!src/core/responses.js', // HTML templates, difícil de testear
    '!src/core/template-engine.js', // Templates
    '!**/node_modules/**',
    '!**/coverage/**'
  ],
  
  // Umbrales de cobertura (mínimo 70% para lógica crítica)
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60
    },
    // Lógica crítica debe tener mayor cobertura
    './src/modules/': {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    },
    './src/modules/*-simulator-v4.js': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  
  // Reportes
  coverageReporters: ['text', 'text-summary', 'html', 'json'],
  coverageDirectory: 'coverage',
  
  // Timeout para tests (30 segundos por defecto)
  testTimeout: 30000,
  
  // Setup y teardown
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  
  // Variables de entorno para tests
  testEnvironmentOptions: {
    NODE_ENV: 'test',
    APP_ENV: 'dev'
  },
  
  // Verbose output
  verbose: true,
  
  // Mostrar errores de coverage
  errorOnDeprecated: false
};







