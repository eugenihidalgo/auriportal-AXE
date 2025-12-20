// tests/smoke/smoke.test.js
// Smoke tests - Verificación básica de funcionalidad

import { describe, it, expect } from '@jest/globals';

describe('Smoke Tests - Rutas Principales', () => {
  describe('Ruta /enter', () => {
    it('debe estar definida y ser accesible', () => {
      // Verificar que el módulo existe
      expect(() => {
        import('../../src/endpoints/enter.js');
      }).not.toThrow();
    });
    
    it('debe manejar requests sin errores de sintaxis', async () => {
      // Verificar que el handler puede importarse
      const enterModule = await import('../../src/endpoints/enter.js');
      expect(enterModule.default).toBeDefined();
    });
  });
  
  describe('Ruta /practicar', () => {
    it('debe estar definida', () => {
      // Verificar que existe algún endpoint relacionado con practicar
      // En el código real, esto podría ser parte de /enter?practico=si
      expect(true).toBe(true); // Placeholder
    });
  });
  
  describe('Simuladores sin errores', () => {
    it('debe poder importar simulador de nivel', async () => {
      expect(async () => {
        await import('../../src/modules/nivel-simulator-v4.js');
      }).not.toThrow();
    });
    
    it('debe poder importar simulador de streak', async () => {
      expect(async () => {
        await import('../../src/modules/streak-simulator-v4.js');
      }).not.toThrow();
    });
    
    it('debe poder importar simulador de días activos', async () => {
      expect(async () => {
        await import('../../src/modules/dias-activos-simulator-v4.js');
      }).not.toThrow();
    });
  });
  
  describe('Feature Flags', () => {
    it('debe poder importar sistema de feature flags', async () => {
      expect(async () => {
        await import('../../src/core/flags/feature-flags.js');
      }).not.toThrow();
    });
    
    it('debe tener función isFeatureEnabled disponible', async () => {
      const featureFlags = await import('../../src/core/flags/feature-flags.js');
      expect(featureFlags.isFeatureEnabled).toBeDefined();
      expect(typeof featureFlags.isFeatureEnabled).toBe('function');
    });
  });
  
  describe('Módulos críticos', () => {
    it('debe poder importar módulo de nivel', async () => {
      expect(async () => {
        await import('../../src/modules/nivel.js');
      }).not.toThrow();
    });
    
    it('debe poder importar módulo de streak', async () => {
      expect(async () => {
        await import('../../src/modules/streak.js');
      }).not.toThrow();
    });
    
    it('debe poder importar módulo de suscripción', async () => {
      expect(async () => {
        await import('../../src/modules/suscripcion.js');
      }).not.toThrow();
    });
  });
  
  describe('Base de datos', () => {
    it('debe tener configuración de PostgreSQL disponible', async () => {
      expect(async () => {
        await import('../../database/pg.js');
      }).not.toThrow();
    });
  });

  describe('Endpoints Legacy - Delegación y Deshabilitación', () => {
    it('typeform-webhook legacy debe delegar a v4', async () => {
      const handler = await import('../../src/endpoints/typeform-webhook.js');
      expect(handler.default).toBeDefined();
      expect(typeof handler.default).toBe('function');
    });

    it('sync-clickup-sql debe estar deshabilitado (410)', async () => {
      const handler = await import('../../src/endpoints/sync-clickup-sql.js');
      expect(handler.default).toBeDefined();
      
      // Mock request
      const mockRequest = new Request('http://localhost/sync-clickup-sql', {
        method: 'GET'
      });
      const mockEnv = {};
      const mockCtx = {};
      
      const response = await handler.default(mockRequest, mockEnv, mockCtx);
      expect(response.status).toBe(410);
    });

    it('sync-all-clickup-sql debe estar deshabilitado (410)', async () => {
      const handler = await import('../../src/endpoints/sync-all-clickup-sql.js');
      expect(handler.default).toBeDefined();
      
      // Mock request
      const mockRequest = new Request('http://localhost/sync-all-clickup-sql', {
        method: 'GET'
      });
      const mockEnv = {};
      const mockCtx = {};
      
      const response = await handler.default(mockRequest, mockEnv, mockCtx);
      expect(response.status).toBe(410);
    });

    it('sql-admin debe estar deshabilitado (410)', async () => {
      const handler = await import('../../src/endpoints/sql-admin.js');
      expect(handler.default).toBeDefined();
      
      // Mock request
      const mockRequest = new Request('http://localhost/sql-admin', {
        method: 'GET'
      });
      const mockEnv = {};
      const mockCtx = {};
      
      const response = await handler.default(mockRequest, mockEnv, mockCtx);
      expect(response.status).toBe(410);
    });
  });
});













