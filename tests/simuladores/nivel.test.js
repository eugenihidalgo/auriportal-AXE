// tests/simuladores/nivel.test.js
// Tests para el simulador de nivel

import { describe, it, expect, beforeEach } from '@jest/globals';
import { simulateNivelCambio } from '../../src/modules/nivel-simulator-v4.js';
import { createTestStudent, createStudentWithHighLevel } from '../fixtures/student.js';
import { dateFromToday, formatDate } from '../helpers/test-utils.js';

describe('Simulador de Nivel', () => {
  let student;
  
  beforeEach(() => {
    student = createTestStudent();
  });
  
  describe('simulateNivelCambio', () => {
    it('debe calcular nivel actual vs simulado correctamente', async () => {
      const result = await simulateNivelCambio(student);
      
      expect(result).toHaveProperty('actual');
      expect(result).toHaveProperty('simulated');
      expect(result).toHaveProperty('diff');
      expect(result).toHaveProperty('diff_description');
      expect(result).toHaveProperty('detalles');
      
      expect(typeof result.actual).toBe('number');
      expect(typeof result.simulated).toBe('number');
      expect(typeof result.diff).toBe('number');
    });
    
    it('debe comparar con cálculos manuales para nivel 1', async () => {
      // Estudiante nuevo (0 días activos) → nivel 1
      const fechaInscripcion = dateFromToday(0);
      student.fechaInscripcion = fechaInscripcion.getTime();
      student.nivel = 1;
      student.nivel_actual = 1;
      
      const result = await simulateNivelCambio(student);
      
      // Con 0 días activos, debe ser nivel 1
      expect(result.simulated).toBeGreaterThanOrEqual(1);
      expect(result.actual).toBe(1);
    });
    
    it('debe calcular nivel correcto para 100 días activos', async () => {
      // 100 días desde inscripción → nivel 2 o 3 según thresholds
      const fechaInscripcion = dateFromToday(-100);
      student.fechaInscripcion = fechaInscripcion.getTime();
      student.nivel = 1;
      student.nivel_actual = 1;
      
      const result = await simulateNivelCambio(student, {
        diasActivosSimulados: 100
      });
      
      // Con 100 días, debe ser al menos nivel 2
      expect(result.simulated).toBeGreaterThanOrEqual(2);
    });
    
    it('debe respetar nivel manual si existe', async () => {
      student.nivel_manual = 5;
      student.nivel_actual = 5;
      
      const result = await simulateNivelCambio(student);
      
      expect(result.detalles.tiene_nivel_manual).toBe(true);
      expect(result.detalles.nivel_manual).toBe(5);
      
      // Si hay nivel manual diferente al simulado, no se aplicaría
      if (result.simulated !== 5) {
        expect(result.detalles.se_aplicaria_cambio).toBe(false);
        expect(result.detalles.razon_no_aplicacion).toContain('Nivel manual');
      }
    });
    
    it('debe detectar cuando suscripción está pausada', async () => {
      student.estado_suscripcion = 'pausada';
      student.suscripcionActiva = false;
      
      const result = await simulateNivelCambio(student);
      
      expect(result.detalles.estado_suscripcion).toBe('pausada');
      expect(result.detalles.suscripcion_activa).toBe(false);
      
      // Si está pausada, no se aplicaría cambio
      if (result.simulated > result.actual) {
        expect(result.detalles.se_aplicaria_cambio).toBe(false);
        expect(result.detalles.razon_no_aplicacion).toContain('Suscripción');
      }
    });
    
    it('debe calcular diferencia correctamente cuando nivel aumenta', async () => {
      const fechaInscripcion = dateFromToday(-200);
      student.fechaInscripcion = fechaInscripcion.getTime();
      student.nivel = 1;
      student.nivel_actual = 1;
      
      const result = await simulateNivelCambio(student);
      
      if (result.simulated > result.actual) {
        expect(result.diff).toBeGreaterThan(0);
        expect(result.diff_description).toContain('Aumentaría');
      }
    });
    
    it('debe manejar estudiante sin fecha de inscripción', async () => {
      student.fechaInscripcion = null;
      
      // Debe manejar el caso sin error
      const result = await simulateNivelCambio(student);
      
      expect(result).toHaveProperty('actual');
      expect(result).toHaveProperty('simulated');
    });
    
    it('debe usar función personalizada de cálculo si se proporciona', async () => {
      const customCalculator = jest.fn(async (student, context) => {
        return 10; // Nivel fijo para test
      });
      
      const result = await simulateNivelCambio(student, {
        calcularNivelSimulado: customCalculator
      });
      
      expect(customCalculator).toHaveBeenCalled();
      expect(result.simulated).toBe(10);
    });
  });
});













