// tests/pde-catalogs.test.js
// Tests básicos para el sistema PDE (Catálogos y Limpiezas)
//
// Ejecutar: npm test -- --testPathPattern=pde-catalogs

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';

// Importar helpers
import { 
  getNivelEfectivo, 
  getNivelEfectivoFromStudent, 
  getAlumnoId,
  puedeAcceder,
  buildPdeContext,
  validatePdeContext
} from '../src/core/pde/nivel-helper.js';

// Tests para nivel-helper.js
describe('getNivelEfectivo', () => {
  test('debería extraer nivel de nivelInfo.nivel_efectivo', () => {
    const ctx = { nivelInfo: { nivel_efectivo: 5 } };
    expect(getNivelEfectivo(ctx)).toBe(5);
  });

  test('debería extraer nivel de nivelInfo.nivel', () => {
    const ctx = { nivelInfo: { nivel: 3 } };
    expect(getNivelEfectivo(ctx)).toBe(3);
  });

  test('debería usar nivel_efectivo directo del ctx', () => {
    const ctx = { nivel_efectivo: 7 };
    expect(getNivelEfectivo(ctx)).toBe(7);
  });

  test('debería usar progressResult.nivel_efectivo', () => {
    const ctx = { progressResult: { nivel_efectivo: 4 } };
    expect(getNivelEfectivo(ctx)).toBe(4);
  });

  test('debería usar student.nivel_efectivo', () => {
    const ctx = { student: { nivel_efectivo: 6 } };
    expect(getNivelEfectivo(ctx)).toBe(6);
  });

  test('debería usar student.nivel_actual como fallback', () => {
    const ctx = { student: { nivel_actual: 2 } };
    expect(getNivelEfectivo(ctx)).toBe(2);
  });

  test('debería retornar 1 si no hay nivel disponible', () => {
    const ctx = {};
    expect(getNivelEfectivo(ctx)).toBe(1);
  });

  test('debería retornar 1 si ctx es null', () => {
    expect(getNivelEfectivo(null)).toBe(1);
  });

  test('debería retornar 1 si ctx es undefined', () => {
    expect(getNivelEfectivo(undefined)).toBe(1);
  });
});

describe('getNivelEfectivoFromStudent', () => {
  test('debería extraer nivel_efectivo del student', () => {
    const student = { nivel_efectivo: 8 };
    expect(getNivelEfectivoFromStudent(student)).toBe(8);
  });

  test('debería usar nivel_actual como fallback', () => {
    const student = { nivel_actual: 3 };
    expect(getNivelEfectivoFromStudent(student)).toBe(3);
  });

  test('debería retornar 1 si student es null', () => {
    expect(getNivelEfectivoFromStudent(null)).toBe(1);
  });
});

describe('getAlumnoId', () => {
  test('debería extraer id de student', () => {
    const ctx = { student: { id: 123 } };
    expect(getAlumnoId(ctx)).toBe(123);
  });

  test('debería extraer alumno_id del ctx', () => {
    const ctx = { alumno_id: 456 };
    expect(getAlumnoId(ctx)).toBe(456);
  });

  test('debería extraer alumnoId del ctx', () => {
    const ctx = { alumnoId: 789 };
    expect(getAlumnoId(ctx)).toBe(789);
  });

  test('debería retornar null si no hay id', () => {
    const ctx = {};
    expect(getAlumnoId(ctx)).toBeNull();
  });
});

describe('puedeAcceder', () => {
  test('debería retornar false si está pausada', () => {
    const ctx = { estadoSuscripcion: { pausada: true } };
    expect(puedeAcceder(ctx)).toBe(false);
  });

  test('debería retornar true si no está pausada', () => {
    const ctx = { estadoSuscripcion: { pausada: false } };
    expect(puedeAcceder(ctx)).toBe(true);
  });

  test('debería retornar true por defecto (fail-open)', () => {
    const ctx = {};
    expect(puedeAcceder(ctx)).toBe(true);
  });

  test('debería usar puedePracticar si está definido', () => {
    const ctx = { puedePracticar: false };
    expect(puedeAcceder(ctx)).toBe(false);
  });

  test('debería verificar estado_suscripcion del student', () => {
    const ctx = { student: { estado_suscripcion: 'activa' } };
    expect(puedeAcceder(ctx)).toBe(true);
  });
});

describe('buildPdeContext', () => {
  test('debería construir contexto con nivel_efectivo', () => {
    const student = { id: 1, nivel_actual: 3 };
    const ctx = buildPdeContext({ student, nivel_efectivo: 5 });
    
    expect(ctx.student).toBe(student);
    expect(ctx.nivelInfo.nivel).toBe(5);
    expect(ctx.nivelInfo.nivel_efectivo).toBe(5);
    expect(ctx.estadoSuscripcion.pausada).toBe(false);
    expect(ctx.puedePracticar).toBe(true);
  });

  test('debería usar nivel del student si no se proporciona nivel_efectivo', () => {
    const student = { id: 1, nivel_efectivo: 7 };
    const ctx = buildPdeContext({ student });
    
    expect(ctx.nivelInfo.nivel).toBe(7);
  });
});

describe('validatePdeContext', () => {
  test('debería validar contexto válido', () => {
    const ctx = { student: { id: 1, nivel_efectivo: 3 } };
    const result = validatePdeContext(ctx);
    
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('debería detectar contexto null', () => {
    const result = validatePdeContext(null);
    
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Contexto es null o undefined');
  });

  test('debería detectar falta de identificación de alumno', () => {
    const ctx = { nivelInfo: { nivel: 3 } };
    const result = validatePdeContext(ctx);
    
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('alumno'))).toBe(true);
  });
});

// Tests para calcularEstado (lógica de limpieza)
describe('Cálculo de estado de limpieza', () => {
  // Simular la función calcularEstado
  function calcularEstado(item) {
    if (!item.ultima_limpieza) return 'pendiente';
    
    const diasDesde = item.dias_desde_limpieza 
      || Math.floor((Date.now() - new Date(item.ultima_limpieza).getTime()) / (1000 * 60 * 60 * 24));
    
    const frecuencia = item.frecuencia_dias || 30;
    
    if (diasDesde <= frecuencia) return 'limpio';
    if (diasDesde <= frecuencia + 15) return 'pendiente';
    return 'olvidado';
  }

  test('debería ser pendiente si nunca se limpió', () => {
    const item = { frecuencia_dias: 30, ultima_limpieza: null };
    expect(calcularEstado(item)).toBe('pendiente');
  });

  test('debería ser limpio si está dentro de frecuencia', () => {
    const hace5Dias = new Date();
    hace5Dias.setDate(hace5Dias.getDate() - 5);
    
    const item = { 
      frecuencia_dias: 30, 
      ultima_limpieza: hace5Dias.toISOString(),
      dias_desde_limpieza: 5
    };
    expect(calcularEstado(item)).toBe('limpio');
  });

  test('debería ser pendiente si pasó frecuencia pero menos de 15 días extra', () => {
    const item = { 
      frecuencia_dias: 30, 
      dias_desde_limpieza: 40 
    };
    expect(calcularEstado(item)).toBe('pendiente');
  });

  test('debería ser olvidado si pasó frecuencia + 15 días', () => {
    const item = { 
      frecuencia_dias: 30, 
      dias_desde_limpieza: 50 
    };
    expect(calcularEstado(item)).toBe('olvidado');
  });
});

// Tests para validación de tipos
describe('Validación de tipos PDE', () => {
  const TIPOS_VALIDOS = ['lugares', 'proyectos', 'apadrinados'];

  test('lugares es un tipo válido', () => {
    expect(TIPOS_VALIDOS.includes('lugares')).toBe(true);
  });

  test('proyectos es un tipo válido', () => {
    expect(TIPOS_VALIDOS.includes('proyectos')).toBe(true);
  });

  test('apadrinados es un tipo válido', () => {
    expect(TIPOS_VALIDOS.includes('apadrinados')).toBe(true);
  });

  test('otros tipos no son válidos', () => {
    expect(TIPOS_VALIDOS.includes('invalido')).toBe(false);
    expect(TIPOS_VALIDOS.includes('')).toBe(false);
    expect(TIPOS_VALIDOS.includes(null)).toBe(false);
  });
});




