// tests/energy/energy-events.test.js
// Tests mínimos para el módulo de eventos energéticos

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { insertEnergyEvent } from '../../src/core/energy/energy-events.js';
import { query } from '../../database/pg.js';
import { runInRequestContext } from '../../src/core/observability/request-context.js';

describe('energy-events', () => {
  const testRequestId = 'test_req_' + Date.now();
  
  beforeEach(async () => {
    // Limpiar eventos de test anteriores (opcional, para no saturar la BD)
    try {
      await query(`
        DELETE FROM energy_events 
        WHERE request_id LIKE 'test_req_%'
      `);
    } catch (err) {
      // Ignorar si falla (puede que la tabla no exista aún)
    }
  });
  
  afterEach(async () => {
    // Limpiar eventos de test después de cada test
    try {
      await query(`
        DELETE FROM energy_events 
        WHERE request_id LIKE 'test_req_%'
      `);
    } catch (err) {
      // Ignorar si falla
    }
  });

  describe('insertEnergyEvent', () => {
    it('debe insertar un evento correctamente', async () => {
      const result = await runInRequestContext(async () => {
        return await insertEnergyEvent({
          event_type: 'cleaning',
          actor_type: 'alumno',
          actor_id: '123',
          alumno_id: 456,
          subject_type: 'aspecto',
          subject_id: '789',
          origin: 'web_portal',
          notes: 'Test de limpieza',
          metadata: { test: true },
          request_id: testRequestId,
          requires_clean_state: true,
          was_clean_before: false,
          is_clean_after: true
        });
      }, testRequestId);

      expect(result.success).toBe(true);
      expect(result.event_id).toBeDefined();
      expect(typeof result.event_id).toBe('number');
    });

    it('debe evitar duplicados por idempotencia (mismo request_id)', async () => {
      const params = {
        event_type: 'cleaning',
        actor_type: 'alumno',
        actor_id: '123',
        alumno_id: 456,
        subject_type: 'aspecto',
        subject_id: '789',
        origin: 'web_portal',
        request_id: testRequestId,
        requires_clean_state: true,
        was_clean_before: false,
        is_clean_after: true
      };

      // Primera inserción
      const result1 = await runInRequestContext(async () => {
        return await insertEnergyEvent(params);
      }, testRequestId);

      expect(result1.success).toBe(true);
      expect(result1.event_id).toBeDefined();

      // Segunda inserción con los mismos parámetros (debe ser idempotente)
      const result2 = await runInRequestContext(async () => {
        return await insertEnergyEvent(params);
      }, testRequestId);

      expect(result2.success).toBe(true);
      expect(result2.duplicate).toBe(true);
      expect(result2.event_id).toBeNull();

      // Verificar que solo hay un evento en la BD
      const countResult = await query(`
        SELECT COUNT(*) as count 
        FROM energy_events 
        WHERE request_id = $1 
          AND event_type = $2 
          AND subject_type = $3 
          AND subject_id = $4 
          AND alumno_id = $5
      `, [testRequestId, 'cleaning', 'aspecto', '789', 456]);

      expect(parseInt(countResult.rows[0].count)).toBe(1);
    });

    it('debe rechazar payload inválido (event_type faltante)', async () => {
      const result = await runInRequestContext(async () => {
        return await insertEnergyEvent({
          // event_type faltante
          actor_type: 'alumno',
          actor_id: '123',
          alumno_id: 456,
          request_id: testRequestId
        });
      }, testRequestId);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('event_type');
    });

    it('debe rechazar payload inválido (actor_type faltante)', async () => {
      const result = await runInRequestContext(async () => {
        return await insertEnergyEvent({
          event_type: 'cleaning',
          // actor_type faltante
          actor_id: '123',
          alumno_id: 456,
          request_id: testRequestId
        });
      }, testRequestId);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('actor_type');
    });

    it('debe generar request_id automáticamente si no se proporciona', async () => {
      const result = await runInRequestContext(async () => {
        return await insertEnergyEvent({
          event_type: 'cleaning',
          actor_type: 'system',
          // request_id no proporcionado
        });
      });

      expect(result.success).toBe(true);
      expect(result.event_id).toBeDefined();
    });

    it('debe manejar metadata como objeto JSON correctamente', async () => {
      const metadata = {
        legacy_table_updated: true,
        tipo_aspecto: 'anatomia',
        frecuencia_dias: 14,
        veces_limpiar: 5
      };

      const result = await runInRequestContext(async () => {
        return await insertEnergyEvent({
          event_type: 'cleaning',
          actor_type: 'master',
          alumno_id: 123,
          subject_type: 'aspecto',
          subject_id: '456',
          metadata: metadata,
          request_id: testRequestId
        });
      }, testRequestId);

      expect(result.success).toBe(true);

      // Verificar que metadata se guardó correctamente
      const eventResult = await query(`
        SELECT metadata 
        FROM energy_events 
        WHERE id = $1
      `, [result.event_id]);

      const savedMetadata = eventResult.rows[0].metadata;
      expect(savedMetadata.legacy_table_updated).toBe(true);
      expect(savedMetadata.tipo_aspecto).toBe('anatomia');
      expect(savedMetadata.frecuencia_dias).toBe(14);
    });
  });
});


















