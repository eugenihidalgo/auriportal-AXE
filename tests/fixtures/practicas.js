// tests/fixtures/practicas.js
// Fixtures de prácticas para tests

/**
 * Crea un objeto de práctica de prueba
 * 
 * @param {Object} overrides - Valores para sobrescribir los por defecto
 * @returns {Object} Objeto práctica
 */
export function createTestPractica(overrides = {}) {
  const fecha = new Date();
  
  const basePractica = {
    id: 1,
    alumno_id: 1,
    fecha: fecha.toISOString().substring(0, 10),
    tema_id: null,
    duracion_minutos: 10,
    created_at: fecha
  };
  
  return { ...basePractica, ...overrides };
}

/**
 * Crea múltiples prácticas consecutivas
 */
export function createConsecutivePractices(days = 5) {
  const practices = [];
  const hoy = new Date();
  
  for (let i = 0; i < days; i++) {
    const fecha = new Date(hoy);
    fecha.setDate(fecha.getDate() - i);
    
    practices.push(createTestPractica({
      id: i + 1,
      fecha: fecha.toISOString().substring(0, 10)
    }));
  }
  
  return practices;
}

/**
 * Crea prácticas con gaps (para simular rachas rotas)
 */
export function createPracticesWithGaps() {
  const practices = [];
  const hoy = new Date();
  
  // Práctica hace 5 días
  const fecha1 = new Date(hoy);
  fecha1.setDate(fecha1.getDate() - 5);
  practices.push(createTestPractica({
    id: 1,
    fecha: fecha1.toISOString().substring(0, 10)
  }));
  
  // Práctica hace 3 días (gap de 2 días)
  const fecha2 = new Date(hoy);
  fecha2.setDate(fecha2.getDate() - 3);
  practices.push(createTestPractica({
    id: 2,
    fecha: fecha2.toISOString().substring(0, 10)
  }));
  
  // Práctica ayer
  const fecha3 = new Date(hoy);
  fecha3.setDate(fecha3.getDate() - 1);
  practices.push(createTestPractica({
    id: 3,
    fecha: fecha3.toISOString().substring(0, 10)
  }));
  
  return practices;
}









