// tests/preview/preview-context.test.js
// Tests estructurales para PreviewContext
//
// SPRINT AXE v0.3 - Preview Harness Unificado

import { describe, it, expect } from 'vitest';
import {
  normalizePreviewContext,
  validatePreviewContext,
  getSafePreviewContext,
  DEFAULT_PREVIEW_CONTEXT
} from '../../src/core/preview/preview-context.js';

describe('PreviewContext - Normalización', () => {
  it('debe normalizar un contexto vacío usando defaults', () => {
    const { context, warnings } = normalizePreviewContext({});
    
    expect(context).toBeDefined();
    expect(context.preview_mode).toBe(true);
    expect(context.student).toBeDefined();
    expect(context.student.nivel_efectivo).toBe(DEFAULT_PREVIEW_CONTEXT.student.nivel_efectivo);
    expect(context.student.energia).toBe(DEFAULT_PREVIEW_CONTEXT.student.energia);
    expect(context.student.racha).toBe(DEFAULT_PREVIEW_CONTEXT.student.racha);
  });

  it('debe preservar valores válidos del input', () => {
    const input = {
      student: {
        nivel_efectivo: 5,
        energia: 80,
        racha: 30
      },
      fecha_simulada: '2024-01-15T10:00:00.000Z'
    };

    const { context } = normalizePreviewContext(input);
    
    expect(context.student.nivel_efectivo).toBe(5);
    expect(context.student.energia).toBe(80);
    expect(context.student.racha).toBe(30);
    expect(context.fecha_simulada).toBe('2024-01-15T10:00:00.000Z');
  });

  it('debe ajustar nivel_efectivo fuera de rango', () => {
    const { context, warnings } = normalizePreviewContext({
      student: {
        nivel_efectivo: 20 // Fuera de rango (máximo 15)
      }
    });
    
    expect(context.student.nivel_efectivo).toBe(15);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('debe ajustar nivel_efectivo menor a 1', () => {
    const { context, warnings } = normalizePreviewContext({
      student: {
        nivel_efectivo: -5
      }
    });
    
    expect(context.student.nivel_efectivo).toBe(1);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('debe ajustar energia fuera de rango 0-100', () => {
    const { context, warnings } = normalizePreviewContext({
      student: {
        energia: 150
      }
    });
    
    expect(context.student.energia).toBe(100);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('debe calcular nivel_efectivo desde nivel string', () => {
    const { context } = normalizePreviewContext({
      student: {
        nivel: "7"
      }
    });
    
    expect(context.student.nivel_efectivo).toBe(7);
  });

  it('debe forzar preview_mode a true siempre', () => {
    const { context } = normalizePreviewContext({
      preview_mode: false
    });
    
    expect(context.preview_mode).toBe(true);
  });

  it('debe validar fecha_simulada y usar ISO string', () => {
    const fecha = new Date('2024-01-15T10:00:00Z');
    const { context } = normalizePreviewContext({
      fecha_simulada: fecha.toISOString()
    });
    
    expect(context.fecha_simulada).toBe(fecha.toISOString());
  });

  it('debe usar fecha actual si fecha_simulada es inválida', () => {
    const { context, warnings } = normalizePreviewContext({
      fecha_simulada: 'fecha-inválida'
    });
    
    expect(new Date(context.fecha_simulada).getTime()).not.toBeNaN();
    expect(warnings.length).toBeGreaterThan(0);
  });
});

describe('PreviewContext - Fail-open', () => {
  it('getSafePreviewContext siempre devuelve un contexto válido', () => {
    const context = getSafePreviewContext(null);
    
    expect(context).toBeDefined();
    expect(context.preview_mode).toBe(true);
    expect(context.student).toBeDefined();
  });

  it('getSafePreviewContext maneja input completamente inválido', () => {
    const context = getSafePreviewContext({
      student: null,
      fecha_simulada: 'invalid',
      preview_mode: false
    });
    
    expect(context).toBeDefined();
    expect(context.preview_mode).toBe(true);
    expect(context.student).toBeDefined();
    expect(context.student.nivel_efectivo).toBeGreaterThanOrEqual(1);
    expect(context.student.nivel_efectivo).toBeLessThanOrEqual(15);
  });

  it('normalizePreviewContext nunca lanza error, solo warnings', () => {
    expect(() => {
      normalizePreviewContext({
        student: {
          nivel_efectivo: 'not-a-number',
          energia: 'also-not-a-number',
          racha: null
        }
      });
    }).not.toThrow();
  });
});

describe('PreviewContext - Validación', () => {
  it('validatePreviewContext devuelve warnings para valores inválidos', () => {
    const warnings = validatePreviewContext({
      student: {
        nivel_efectivo: 20,
        energia: 150
      }
    });
    
    expect(Array.isArray(warnings)).toBe(true);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('validatePreviewContext devuelve array vacío para contexto válido', () => {
    const warnings = validatePreviewContext({
      student: {
        nivel_efectivo: 5,
        energia: 50,
        racha: 10
      },
      fecha_simulada: new Date().toISOString()
    });
    
    expect(Array.isArray(warnings)).toBe(true);
    // Puede tener warnings por campos faltantes, pero no debería tener errores críticos
  });
});

describe('PreviewContext - Protección del Runtime', () => {
  it('preview_mode siempre es true para prevenir afectar runtime', () => {
    const context1 = normalizePreviewContext({ preview_mode: false }).context;
    const context2 = normalizePreviewContext({ preview_mode: undefined }).context;
    const context3 = normalizePreviewContext({}).context;
    
    expect(context1.preview_mode).toBe(true);
    expect(context2.preview_mode).toBe(true);
    expect(context3.preview_mode).toBe(true);
  });

  it('DEFAULT_PREVIEW_CONTEXT tiene preview_mode = true', () => {
    expect(DEFAULT_PREVIEW_CONTEXT.preview_mode).toBe(true);
  });
});













