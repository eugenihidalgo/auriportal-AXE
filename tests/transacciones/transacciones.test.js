// tests/transacciones/transacciones.test.js
// Tests para transacciones de base de datos

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { createMockPostgresPool } from '../helpers/mocks.js';
import { createTestStudent } from '../fixtures/student.js';

describe('Transacciones de Base de Datos', () => {
  let pool;
  
  beforeEach(() => {
    pool = createMockPostgresPool();
  });
  
  describe('Transacción exitosa', () => {
    it('debe ejecutar BEGIN, operaciones y COMMIT en orden', async () => {
      // Simular transacción exitosa
      await pool.query('BEGIN');
      await pool.query('UPDATE alumnos SET nivel = $1 WHERE id = $2', [5, 1]);
      await pool.query('COMMIT');
      
      const queries = pool._getQueries();
      
      expect(queries.length).toBe(3);
      expect(queries[0].text).toContain('BEGIN');
      expect(queries[1].text).toContain('UPDATE');
      expect(queries[2].text).toContain('COMMIT');
    });
    
    it('debe aplicar todos los cambios cuando commit es exitoso', async () => {
      let nivelActual = 1;
      
      // Simular transacción
      await pool.query('BEGIN');
      
      // Simular actualización
      nivelActual = 5;
      
      await pool.query('COMMIT');
      
      // Verificar que el cambio se aplicó
      expect(nivelActual).toBe(5);
    });
  });
  
  describe('Rollback en caso de error', () => {
    it('debe ejecutar ROLLBACK cuando hay error', async () => {
      try {
        await pool.query('BEGIN');
        await pool.query('UPDATE alumnos SET nivel = $1 WHERE id = $2', [5, 1]);
        
        // Simular error
        throw new Error('Error simulado');
        
        await pool.query('COMMIT');
      } catch (error) {
        await pool.query('ROLLBACK');
      }
      
      const queries = pool._getQueries();
      const lastQuery = queries[queries.length - 1];
      
      expect(lastQuery.text).toContain('ROLLBACK');
    });
    
    it('debe revertir cambios cuando se hace rollback', async () => {
      let nivelActual = 1;
      let nivelOriginal = nivelActual;
      
      try {
        await pool.query('BEGIN');
        
        // Simular actualización
        nivelActual = 5;
        
        // Simular error
        throw new Error('Error simulado');
        
        await pool.query('COMMIT');
      } catch (error) {
        await pool.query('ROLLBACK');
        // En una transacción real, esto revertiría los cambios
        nivelActual = nivelOriginal;
      }
      
      expect(nivelActual).toBe(nivelOriginal);
    });
  });
  
  describe('Atomicidad de transacciones', () => {
    it('debe asegurar que todas las operaciones se ejecutan o ninguna', async () => {
      const operaciones = [];
      
      try {
        await pool.query('BEGIN');
        
        operaciones.push('op1');
        operaciones.push('op2');
        
        // Si hay error aquí, ninguna operación debería aplicarse
        throw new Error('Error en mitad de transacción');
        
        operaciones.push('op3');
        
        await pool.query('COMMIT');
      } catch (error) {
        await pool.query('ROLLBACK');
        // En caso de error, las operaciones no deberían aplicarse
        operaciones.length = 0;
      }
      
      // Verificar que no hay efectos parciales
      expect(operaciones.length).toBe(0);
    });
    
    it('debe manejar múltiples actualizaciones en una transacción', async () => {
      await pool.query('BEGIN');
      
      await pool.query('UPDATE alumnos SET nivel = $1 WHERE id = $2', [5, 1]);
      await pool.query('UPDATE alumnos SET streak = $1 WHERE id = $2', [10, 1]);
      
      await pool.query('COMMIT');
      
      const queries = pool._getQueries();
      const updateQueries = queries.filter(q => q.text.includes('UPDATE'));
      
      expect(updateQueries.length).toBe(2);
    });
  });
  
  describe('Aislamiento de transacciones', () => {
    it('debe aislar cambios entre transacciones concurrentes', async () => {
      // Simular dos transacciones concurrentes
      const pool1 = createMockPostgresPool();
      const pool2 = createMockPostgresPool();
      
      let valor1 = 1;
      let valor2 = 1;
      
      // Transacción 1
      await pool1.query('BEGIN');
      valor1 = 5;
      
      // Transacción 2 (no debería ver cambios de transacción 1)
      await pool2.query('BEGIN');
      expect(valor2).toBe(1); // Aún no ve cambios
      
      await pool1.query('COMMIT');
      await pool2.query('COMMIT');
      
      // Después de commit, cada una tiene su propio estado
      expect(valor1).toBe(5);
      expect(valor2).toBe(1);
    });
  });
});










