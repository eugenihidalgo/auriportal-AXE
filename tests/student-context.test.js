// tests/student-context.test.js
// Tests mínimos para el módulo student-context.js

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { buildStudentContext } from '../src/core/student-context.js';

// Mock de auth-context
const mockRequireStudentContext = jest.fn();
jest.unstable_mockModule('../src/core/auth-context.js', () => ({
  requireStudentContext: mockRequireStudentContext
}));

// Mock de responses
const mockRenderPantalla0 = jest.fn(() => new Response('<html>Pantalla 0</html>', { status: 200 }));
jest.unstable_mockModule('../src/core/responses.js', () => ({
  renderPantalla0: mockRenderPantalla0
}));

// Mock de nivel-v4
const mockGetNivelInfo = jest.fn();
jest.unstable_mockModule('../src/modules/nivel-v4.js', () => ({
  getNivelInfo: mockGetNivelInfo
}));

// Mock de streak-v4
const mockCheckDailyStreak = jest.fn();
const mockDetectMilestone = jest.fn();
jest.unstable_mockModule('../src/modules/streak-v4.js', () => ({
  checkDailyStreak: mockCheckDailyStreak,
  detectMilestone: mockDetectMilestone
}));

// Mock de suscripcion-v4
const mockGestionarEstadoSuscripcion = jest.fn();
jest.unstable_mockModule('../src/modules/suscripcion-v4.js', () => ({
  gestionarEstadoSuscripcion: mockGestionarEstadoSuscripcion
}));

// Mock de frases
const mockGetFrasePorNivel = jest.fn();
jest.unstable_mockModule('../src/modules/frases.js', () => ({
  getFrasePorNivel: mockGetFrasePorNivel
}));

describe('StudentContext', () => {
  let mockRequest;
  let mockEnv;
  let mockStudent;

  beforeEach(() => {
    // Resetear todos los mocks
    jest.clearAllMocks();
    
    // Crear request mock
    mockRequest = {
      url: 'https://example.com/enter',
      method: 'GET',
      headers: new Headers({
        'Cookie': 'auriportal_session=test'
      })
    };
    
    // Crear env mock
    mockEnv = {
      DATABASE_URL: 'postgresql://test'
    };
    
    // Crear student mock
    mockStudent = {
      id: 1,
      email: 'test@example.com',
      apodo: 'Test',
      nivel: 1,
      streak: 5,
      lastPractice: '2024-01-01',
      estado_suscripcion: 'activa'
    };
    
    // Configurar mocks por defecto
    mockGetNivelInfo.mockResolvedValue({
      nivel: 1,
      fase: 'inicial',
      nombre: 'Sanación - Inicial',
      categoria: 'Sanación'
    });
    
    mockCheckDailyStreak.mockResolvedValue({
      todayPracticed: false,
      streak: 5,
      motivationalPhrase: 'Test phrase'
    });
    
    mockGestionarEstadoSuscripcion.mockResolvedValue({
      pausada: false,
      reactivada: false
    });
    
    mockGetFrasePorNivel.mockResolvedValue('Frase de nivel');
    
    mockDetectMilestone.mockReturnValue(false);
  });

  describe('buildStudentContext', () => {
    it('debe devolver ok:false y pantalla0 si no hay cookie válida', async () => {
      // Simular que no hay cookie (requireStudentContext devuelve Response)
      mockRequireStudentContext.mockResolvedValue(mockRenderPantalla0());
      
      const result = await buildStudentContext(mockRequest, mockEnv);
      
      expect(result.ok).toBe(false);
      expect(result.response).toBeDefined();
      expect(mockRequireStudentContext).toHaveBeenCalledWith(mockRequest, mockEnv);
    });

    it('debe devolver ok:false y pantalla0 si student repo falla', async () => {
      // Simular error en requireStudentContext
      mockRequireStudentContext.mockRejectedValue(new Error('Student not found'));
      
      const result = await buildStudentContext(mockRequest, mockEnv);
      
      expect(result.ok).toBe(false);
      expect(result.response).toBeDefined();
    });

    it('debe devolver ok:true con ctx completo si cookie válida', async () => {
      // Simular autenticación exitosa
      mockRequireStudentContext.mockResolvedValue({
        user: mockStudent,
        isAuthenticated: true,
        request: mockRequest
      });
      
      const result = await buildStudentContext(mockRequest, mockEnv);
      
      expect(result.ok).toBe(true);
      expect(result.ctx).toBeDefined();
      expect(result.ctx.student).toEqual(mockStudent);
      expect(result.ctx.email).toBe('test@example.com');
      expect(result.ctx.isAuthenticated).toBe(true);
      expect(result.ctx.todayPracticed).toBe(false);
      expect(result.ctx.streakInfo).toBeDefined();
      expect(result.ctx.nivelInfo).toBeDefined();
    });

    it('debe calcular todayPracticed correctamente desde streakInfo', async () => {
      // Simular autenticación exitosa
      mockRequireStudentContext.mockResolvedValue({
        user: mockStudent,
        isAuthenticated: true,
        request: mockRequest
      });
      
      // Simular que ya practicó hoy
      mockCheckDailyStreak.mockResolvedValue({
        todayPracticed: true,
        streak: 6,
        motivationalPhrase: 'Test phrase'
      });
      
      const result = await buildStudentContext(mockRequest, mockEnv);
      
      expect(result.ok).toBe(true);
      expect(result.ctx.todayPracticed).toBe(true);
      expect(result.ctx.streakInfo.todayPracticed).toBe(true);
    });

    it('debe manejar errores en módulos dependientes sin fallar', async () => {
      // Simular autenticación exitosa
      mockRequireStudentContext.mockResolvedValue({
        user: mockStudent,
        isAuthenticated: true,
        request: mockRequest
      });
      
      // Simular error en getNivelInfo
      mockGetNivelInfo.mockRejectedValue(new Error('DB error'));
      
      const result = await buildStudentContext(mockRequest, mockEnv);
      
      // Debe usar valores por defecto pero seguir funcionando
      expect(result.ok).toBe(true);
      expect(result.ctx.nivelInfo.nivel).toBe(1);
      expect(result.ctx.nivelInfo.fase).toBe('inicial');
    });

    it('debe usar defaults seguros cuando fallan funciones críticas', async () => {
      // Simular autenticación exitosa
      mockRequireStudentContext.mockResolvedValue({
        user: mockStudent,
        isAuthenticated: true,
        request: mockRequest
      });
      
      // Simular errores en múltiples funciones
      mockGetNivelInfo.mockRejectedValue(new Error('Error'));
      mockGetFrasePorNivel.mockRejectedValue(new Error('Error'));
      
      const result = await buildStudentContext(mockRequest, mockEnv);
      
      // Debe seguir funcionando con defaults
      expect(result.ok).toBe(true);
      expect(result.ctx.frase).toBeDefined(); // Debe tener frase por defecto
      expect(result.ctx.nivelInfo).toBeDefined();
    });
  });
});












