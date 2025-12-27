// tests/fixtures/pausas.js
// Fixtures de pausas para tests

/**
 * Crea un objeto de pausa de prueba
 * 
 * @param {Object} overrides - Valores para sobrescribir los por defecto
 * @returns {Object} Objeto pausa
 */
export function createTestPausa(overrides = {}) {
  const inicio = new Date();
  inicio.setDate(inicio.getDate() - 10); // Hace 10 días
  
  const fin = new Date();
  fin.setDate(fin.getDate() - 5); // Hace 5 días (pausa de 5 días)
  
  const basePausa = {
    id: 1,
    alumno_id: 1,
    inicio: inicio.toISOString(),
    fin: fin.toISOString(),
    razon: 'Pausa de prueba',
    created_at: inicio
  };
  
  return { ...basePausa, ...overrides };
}

/**
 * Crea una pausa activa (sin fecha de fin)
 */
export function createActivePausa() {
  const inicio = new Date();
  inicio.setDate(inicio.getDate() - 5); // Hace 5 días
  
  return createTestPausa({
    inicio: inicio.toISOString(),
    fin: null
  });
}

/**
 * Crea múltiples pausas para un estudiante
 */
export function createMultiplePausas(count = 3) {
  const pausas = [];
  const hoy = new Date();
  
  for (let i = 0; i < count; i++) {
    const inicio = new Date(hoy);
    inicio.setDate(inicio.getDate() - (30 + i * 10)); // Pausas espaciadas
    
    const fin = new Date(inicio);
    fin.setDate(fin.getDate() + 5); // Cada pausa dura 5 días
    
    pausas.push(createTestPausa({
      id: i + 1,
      inicio: inicio.toISOString(),
      fin: fin.toISOString()
    }));
  }
  
  return pausas;
}




















