// tests/analytics/analytics-collect.test.js
// Tests para el endpoint de ingesta de analytics

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import analyticsCollectHandler from '../../src/endpoints/analytics-collect-v1.js';
import { isFeatureEnabled } from '../../src/core/flags/feature-flags.js';

// Mock del feature flag
jest.mock('../../src/core/flags/feature-flags.js', () => ({
  isFeatureEnabled: jest.fn()
}));

// Mock del repositorio
jest.mock('../../src/infra/repos/analytics-repo-pg.js', () => ({
  default: {
    recordEvent: jest.fn()
  }
}));

describe('analyticsCollectHandler', () => {
  let mockRequest;
  let mockEnv;
  let mockCtx;
  
  beforeEach(() => {
    mockRequest = {
      method: 'POST',
      headers: new Headers(),
      json: jest.fn()
    };
    mockEnv = {};
    mockCtx = { requestId: 'test_req_123' };
    
    // Reset mocks
    jest.clearAllMocks();
  });
  
  it('debe rechazar métodos que no sean POST', async () => {
    mockRequest.method = 'GET';
    
    const response = await analyticsCollectHandler(mockRequest, mockEnv, mockCtx);
    
    expect(response.status).toBe(405);
  });
  
  it('debe responder 204 si el feature flag está desactivado', async () => {
    isFeatureEnabled.mockReturnValue(false);
    mockRequest.json.mockResolvedValue({
      event_name: 'test_event',
      props: {}
    });
    
    const response = await analyticsCollectHandler(mockRequest, mockEnv, mockCtx);
    
    expect(response.status).toBe(204);
  });
  
  it('debe validar que event_name es requerido', async () => {
    isFeatureEnabled.mockReturnValue(true);
    mockRequest.json.mockResolvedValue({
      props: {}
    });
    
    const response = await analyticsCollectHandler(mockRequest, mockEnv, mockCtx);
    
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('event_name');
  });
  
  it('debe validar formato de event_name', async () => {
    isFeatureEnabled.mockReturnValue(true);
    mockRequest.json.mockResolvedValue({
      event_name: 'INVALID_EVENT_NAME',
      props: {}
    });
    
    const response = await analyticsCollectHandler(mockRequest, mockEnv, mockCtx);
    
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('event_name');
  });
  
  it('debe validar tamaño de props (máximo 16KB)', async () => {
    isFeatureEnabled.mockReturnValue(true);
    const largeProps = {
      data: 'x'.repeat(20 * 1024) // 20KB
    };
    mockRequest.json.mockResolvedValue({
      event_name: 'test_event',
      props: largeProps
    });
    
    const response = await analyticsCollectHandler(mockRequest, mockEnv, mockCtx);
    
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('16KB');
  });
  
  it('debe aceptar un evento válido y responder 204', async () => {
    isFeatureEnabled.mockReturnValue(true);
    mockRequest.json.mockResolvedValue({
      event_name: 'test_event',
      props: { page: '/enter' },
      path: '/enter',
      screen: 'pantalla1'
    });
    
    // Mock requireStudentContext para que retorne Response (no autenticado)
    jest.doMock('../../src/core/auth-context.js', () => ({
      requireStudentContext: jest.fn().mockResolvedValue(new Response()),
      requireAdminContext: jest.fn().mockResolvedValue(new Response())
    }));
    
    const response = await analyticsCollectHandler(mockRequest, mockEnv, mockCtx);
    
    expect(response.status).toBe(204);
  });
  
  it('debe rechazar JSON inválido', async () => {
    isFeatureEnabled.mockReturnValue(true);
    mockRequest.json.mockRejectedValue(new SyntaxError('Invalid JSON'));
    
    const response = await analyticsCollectHandler(mockRequest, mockEnv, mockCtx);
    
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('JSON');
  });
});










