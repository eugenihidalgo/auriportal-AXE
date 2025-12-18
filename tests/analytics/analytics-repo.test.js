// tests/analytics/analytics-repo.test.js
// Tests para el repositorio de analytics

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { AnalyticsRepoPg } from '../../src/infra/repos/analytics-repo-pg.js';
import { query } from '../../database/pg.js';

describe('AnalyticsRepoPg', () => {
  let repo;
  
  beforeEach(() => {
    repo = new AnalyticsRepoPg();
  });
  
  afterEach(async () => {
    // Limpiar eventos de test después de cada test
    try {
      await query('DELETE FROM analytics_events WHERE event_name LIKE $1', ['test_%']);
    } catch (err) {
      // Ignorar errores de limpieza
    }
  });
  
  describe('recordEvent', () => {
    it('debe registrar un evento básico correctamente', async () => {
      const event = {
        actorType: 'student',
        actorId: '123',
        source: 'server',
        eventName: 'test_page_view',
        appVersion: '4.6.0',
        buildId: 'test123',
        props: { page: '/enter' }
      };
      
      const result = await repo.recordEvent(event);
      
      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.event_id).toBeDefined();
      expect(result.event_name).toBe('test_page_view');
      expect(result.actor_type).toBe('student');
      expect(result.actor_id).toBe('123');
      expect(result.source).toBe('server');
      expect(result.app_version).toBe('4.6.0');
      expect(result.build_id).toBe('test123');
      expect(result.props).toBeDefined();
    });
    
    it('debe validar que eventName es requerido', async () => {
      const event = {
        actorType: 'student',
        source: 'server',
        appVersion: '4.6.0',
        buildId: 'test123'
      };
      
      await expect(repo.recordEvent(event)).rejects.toThrow('eventName es requerido');
    });
    
    it('debe validar formato de eventName (solo [a-z0-9_:.-])', async () => {
      const event = {
        actorType: 'student',
        source: 'server',
        eventName: 'TEST_INVALID',
        appVersion: '4.6.0',
        buildId: 'test123'
      };
      
      await expect(repo.recordEvent(event)).rejects.toThrow();
    });
    
    it('debe truncar props si exceden 16KB', async () => {
      const largeProps = {
        data: 'x'.repeat(20 * 1024) // 20KB
      };
      
      const event = {
        actorType: 'system',
        source: 'server',
        eventName: 'test_large_props',
        appVersion: '4.6.0',
        buildId: 'test123',
        props: largeProps
      };
      
      const result = await repo.recordEvent(event);
      
      expect(result).toBeDefined();
      // El props debe estar truncado o limpiado
      const props = typeof result.props === 'string' ? JSON.parse(result.props) : result.props;
      const propsStr = JSON.stringify(props);
      expect(propsStr.length).toBeLessThanOrEqual(16 * 1024);
    });
    
    it('debe validar actorType', async () => {
      const event = {
        actorType: 'invalid',
        source: 'server',
        eventName: 'test_event',
        appVersion: '4.6.0',
        buildId: 'test123'
      };
      
      await expect(repo.recordEvent(event)).rejects.toThrow();
    });
    
    it('debe validar source', async () => {
      const event = {
        actorType: 'student',
        source: 'invalid',
        eventName: 'test_event',
        appVersion: '4.6.0',
        buildId: 'test123'
      };
      
      await expect(repo.recordEvent(event)).rejects.toThrow();
    });
  });
  
  describe('getRecentEvents', () => {
    beforeEach(async () => {
      // Crear algunos eventos de test
      await repo.recordEvent({
        actorType: 'student',
        actorId: '123',
        source: 'server',
        eventName: 'test_page_view',
        appVersion: '4.6.0',
        buildId: 'test123',
        props: { page: '/enter' }
      });
      
      await repo.recordEvent({
        actorType: 'student',
        actorId: '456',
        source: 'client',
        eventName: 'test_button_click',
        appVersion: '4.6.0',
        buildId: 'test123',
        props: { button: 'submit' }
      });
    });
    
    it('debe obtener eventos recientes sin filtros', async () => {
      const events = await repo.getRecentEvents({}, 10);
      
      expect(events.length).toBeGreaterThanOrEqual(2);
      expect(events[0].event_name).toBeDefined();
    });
    
    it('debe filtrar por eventName', async () => {
      const events = await repo.getRecentEvents({ eventName: 'test_page_view' }, 10);
      
      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events.every(e => e.event_name === 'test_page_view')).toBe(true);
    });
    
    it('debe filtrar por actorId', async () => {
      const events = await repo.getRecentEvents({ actorId: '123' }, 10);
      
      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events.every(e => e.actor_id === '123')).toBe(true);
    });
    
    it('debe filtrar por source', async () => {
      const events = await repo.getRecentEvents({ source: 'client' }, 10);
      
      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events.every(e => e.source === 'client')).toBe(true);
    });
    
    it('debe respetar el límite', async () => {
      const events = await repo.getRecentEvents({}, 1);
      
      expect(events.length).toBeLessThanOrEqual(1);
    });
  });
});










