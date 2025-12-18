// tests/helpers/mocks.js
// Helpers para crear mocks comunes

/**
 * Mock de variables de entorno para tests
 */
export function createMockEnv(overrides = {}) {
  return {
    APP_ENV: 'dev',
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test_auriportal',
    CLICKUP_API_TOKEN: 'test_token',
    CLICKUP_LIST_ID: 'test_list_id',
    ...overrides
  };
}

/**
 * Mock de feature flags
 * 
 * @param {Object} flags - Objeto con flags a mockear { flagName: 'on'|'beta'|'off' }
 * @returns {Function} Función para restaurar flags originales
 */
export function mockFeatureFlags(flags) {
  // Guardar implementación original
  const originalModule = jest.createMockFromModule('../src/core/flags/feature-flags.js');
  
  // Mock de isFeatureEnabled
  const mockIsFeatureEnabled = jest.fn((flagName) => {
    if (flags[flagName]) {
      const state = flags[flagName];
      return state === 'on' || (state === 'beta' && process.env.APP_ENV !== 'prod');
    }
    return false;
  });
  
  return {
    isFeatureEnabled: mockIsFeatureEnabled,
    restore: () => {
      // Restaurar implementación original si es necesario
    }
  };
}

/**
 * Mock de repositorio de estudiantes
 */
export function createMockStudentRepo() {
  const students = new Map();
  
  return {
    getById: jest.fn(async (id) => {
      return students.get(id) || null;
    }),
    
    getByEmail: jest.fn(async (email) => {
      for (const student of students.values()) {
        if (student.email === email) {
          return student;
        }
      }
      return null;
    }),
    
    create: jest.fn(async (student) => {
      const id = students.size + 1;
      const newStudent = { ...student, id };
      students.set(id, newStudent);
      return newStudent;
    }),
    
    update: jest.fn(async (id, updates) => {
      const student = students.get(id);
      if (!student) {
        throw new Error(`Student ${id} not found`);
      }
      const updated = { ...student, ...updates };
      students.set(id, updated);
      return updated;
    }),
    
    delete: jest.fn(async (id) => {
      return students.delete(id);
    }),
    
    // Helper para añadir estudiantes de prueba
    _addTestStudent: (student) => {
      students.set(student.id, student);
    },
    
    // Helper para limpiar
    _clear: () => {
      students.clear();
    }
  };
}

/**
 * Mock de pool de PostgreSQL
 */
export function createMockPostgresPool() {
  const queries = [];
  
  return {
    query: jest.fn(async (text, params) => {
      queries.push({ text, params });
      
      // Mock de respuestas comunes
      if (text.includes('SELECT NOW()')) {
        return { rows: [{ now: new Date() }], rowCount: 1 };
      }
      
      if (text.includes('BEGIN')) {
        return { rows: [], rowCount: 0 };
      }
      
      if (text.includes('COMMIT')) {
        return { rows: [], rowCount: 0 };
      }
      
      if (text.includes('ROLLBACK')) {
        return { rows: [], rowCount: 0 };
      }
      
      // Respuesta por defecto
      return { rows: [], rowCount: 0 };
    }),
    
    // Helper para verificar queries ejecutadas
    _getQueries: () => queries,
    
    // Helper para limpiar
    _clear: () => {
      queries.length = 0;
    }
  };
}









