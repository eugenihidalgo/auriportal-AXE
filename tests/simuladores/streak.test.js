// tests/simuladores/streak.test.js
// Tests para el simulador de streak

import { describe, it, expect, beforeEach } from '@jest/globals';
import { simulateStreakCambio } from '../../src/modules/streak-simulator-v4.js';
import { 
  createTestStudent, 
  createNewStudent, 
  createStudentWithStreak 
} from '../fixtures/student.js';
import { dateFromToday, formatDate } from '../helpers/test-utils.js';
import { createMockEnv } from '../helpers/mocks.js';

describe('Simulador de Streak', () => {
  let student;
  let env;
  
  beforeEach(() => {
    student = createTestStudent();
    env = createMockEnv();
  });
  
  describe('simulateStreakCambio', () => {
    it('debe calcular streak actual vs simulado correctamente', async () => {
      const result = await simulateStreakCambio({ student, env });
      
      expect(result).toHaveProperty('streak_actual');
      expect(result).toHaveProperty('streak_simulado');
      expect(result).toHaveProperty('accion_simulada');
      expect(result).toHaveProperty('razon');
      expect(result).toHaveProperty('detalles');
    });
    
    it('debe incrementar streak cuando última práctica fue ayer', async () => {
      const yesterday = dateFromToday(-1);
      student.lastPractice = formatDate(yesterday);
      student.streak = 5;
      
      const result = await simulateStreakCambio({ student, env });
      
      expect(result.accion_simulada).toBe('incrementa');
      expect(result.streak_simulado).toBe(6);
      expect(result.razon).toContain('incrementaría');
    });
    
    it('debe resetear streak cuando racha está rota', async () => {
      const threeDaysAgo = dateFromToday(-3);
      student.lastPractice = formatDate(threeDaysAgo);
      student.streak = 10;
      
      const result = await simulateStreakCambio({ student, env });
      
      expect(result.accion_simulada).toBe('reset');
      expect(result.streak_simulado).toBe(1);
      expect(result.razon).toContain('Racha rota');
    });
    
    it('debe iniciar streak en 1 para primera práctica', async () => {
      student = createNewStudent();
      
      const result = await simulateStreakCambio({ 
        student, 
        env, 
        forcePractice: true 
      });
      
      expect(result.accion_simulada).toBe('incrementa');
      expect(result.streak_simulado).toBe(1);
      expect(result.razon).toContain('Primera práctica');
    });
    
    it('debe mantener streak si ya practicó hoy', async () => {
      const today = formatDate(new Date());
      student.lastPractice = today;
      student.streak = 5;
      
      const result = await simulateStreakCambio({ student, env });
      
      expect(result.accion_simulada).toBe('sin_cambio');
      expect(result.streak_simulado).toBe(5);
      expect(result.razon).toContain('Ya ha practicado hoy');
    });
    
    it('debe bloquear práctica si suscripción está pausada', async () => {
      student.estado_suscripcion = 'pausada';
      student.suscripcionActiva = false;
      student.lastPractice = formatDate(dateFromToday(-1));
      student.streak = 5;
      
      const result = await simulateStreakCambio({ student, env });
      
      expect(result.accion_simulada).toBe('bloqueado');
      expect(result.streak_simulado).toBe(5); // No cambia
      expect(result.razon).toContain('Suscripción pausada');
    });
    
    it('debe forzar práctica cuando forcePractice=true', async () => {
      const threeDaysAgo = dateFromToday(-3);
      student.lastPractice = formatDate(threeDaysAgo);
      student.streak = 5;
      
      const result = await simulateStreakCambio({ 
        student, 
        env, 
        forcePractice: true 
      });
      
      // Con forcePractice, debe incrementar aunque haya gap
      expect(result.accion_simulada).toBe('incrementa');
      expect(result.streak_simulado).toBe(6);
      expect(result.razon).toContain('Fuerza práctica');
    });
    
    it('debe usar fecha personalizada para simulación', async () => {
      const customDate = formatDate(dateFromToday(-2));
      student.lastPractice = formatDate(dateFromToday(-1));
      student.streak = 5;
      
      const result = await simulateStreakCambio({ 
        student, 
        env, 
        fechaActual: customDate 
      });
      
      expect(result.detalles.fecha_simulacion).toBe(customDate);
    });
    
    it('debe manejar estudiante sin última práctica', async () => {
      student = createNewStudent();
      
      const result = await simulateStreakCambio({ student, env });
      
      expect(result.accion_simulada).toBe('sin_cambio');
      expect(result.streak_simulado).toBe(0);
      expect(result.razon).toContain('Aún no ha practicado');
    });
  });
});









