// tests/observability/audit-repo.test.js
// Tests para verificar el repositorio de auditoría

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { AuditRepoPg } from '../../src/infra/repos/audit-repo-pg.js';
import { query } from '../../database/pg.js';

describe('AuditRepoPg', () => {
  let auditRepo;

  beforeEach(() => {
    auditRepo = new AuditRepoPg();
  });

  it('debe validar que eventType es requerido', async () => {
    await expect(
      auditRepo.recordEvent({})
    ).rejects.toThrow('eventType es requerido para recordEvent');
  });

  it('debe registrar un evento básico', async () => {
    const event = {
      eventType: 'TEST_EVENT',
      severity: 'info',
      data: { test: 'data' }
    };

    const result = await auditRepo.recordEvent(event);

    expect(result).toBeDefined();
    expect(result.event_type).toBe('TEST_EVENT');
    expect(result.severity).toBe('info');
    expect(result.data).toBeDefined();
    
    // Verificar que se añadió app_version y build_id
    const data = typeof result.data === 'string' ? JSON.parse(result.data) : result.data;
    expect(data.app_version).toBeDefined();
    expect(data.build_id).toBeDefined();
  });

  it('debe truncar datos si exceden el tamaño máximo', async () => {
    // Crear objeto grande
    const largeData = {
      field1: 'x'.repeat(10000),
      field2: 'y'.repeat(10000)
    };

    const event = {
      eventType: 'TEST_LARGE_EVENT',
      severity: 'info',
      data: largeData
    };

    const result = await auditRepo.recordEvent(event);

    expect(result).toBeDefined();
    // El resultado debe existir aunque los datos se hayan truncado
    expect(result.event_type).toBe('TEST_LARGE_EVENT');
  });

  it('debe obtener eventos recientes', async () => {
    // Primero crear algunos eventos
    await auditRepo.recordEvent({
      eventType: 'TEST_EVENT_1',
      severity: 'info',
      data: { test: 1 }
    });

    await auditRepo.recordEvent({
      eventType: 'TEST_EVENT_2',
      severity: 'warn',
      data: { test: 2 }
    });

    const events = await auditRepo.getRecentEvents(10);

    expect(Array.isArray(events)).toBe(true);
    expect(events.length).toBeGreaterThan(0);
    
    // Los eventos deben estar ordenados por created_at DESC
    if (events.length > 1) {
      const firstDate = new Date(events[0].created_at);
      const secondDate = new Date(events[1].created_at);
      expect(firstDate.getTime()).toBeGreaterThanOrEqual(secondDate.getTime());
    }
  });

  it('debe filtrar eventos por eventType', async () => {
    await auditRepo.recordEvent({
      eventType: 'FILTER_TEST_1',
      severity: 'info',
      data: {}
    });

    await auditRepo.recordEvent({
      eventType: 'FILTER_TEST_2',
      severity: 'info',
      data: {}
    });

    const events = await auditRepo.getRecentEvents(10, {
      eventType: 'FILTER_TEST_1'
    });

    expect(events.length).toBeGreaterThan(0);
    events.forEach(event => {
      expect(event.event_type).toBe('FILTER_TEST_1');
    });
  });

  it('debe filtrar eventos por actorId', async () => {
    await auditRepo.recordEvent({
      eventType: 'ACTOR_TEST',
      actorId: '123',
      severity: 'info',
      data: {}
    });

    await auditRepo.recordEvent({
      eventType: 'ACTOR_TEST',
      actorId: '456',
      severity: 'info',
      data: {}
    });

    const events = await auditRepo.getRecentEvents(10, {
      actorId: '123'
    });

    expect(events.length).toBeGreaterThan(0);
    events.forEach(event => {
      expect(event.actor_id).toBe('123');
    });
  });

  afterEach(async () => {
    // Limpiar eventos de test (opcional, para no saturar la BD)
    // En producción, esto no se haría ya que audit_log es append-only
  });
});













