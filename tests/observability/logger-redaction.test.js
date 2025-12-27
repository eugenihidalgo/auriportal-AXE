// tests/observability/logger-redaction.test.js
// Tests para verificar que el logger redacta correctamente datos sensibles

import { describe, it, expect } from '@jest/globals';
import { redactSensitiveData } from '../../src/core/observability/logger.js';

describe('Logger Redaction', () => {
  it('debe redactar campos sensibles (case-insensitive)', () => {
    const input = {
      authorization: 'Bearer token123',
      Authorization: 'Bearer token456',
      cookie: 'session=abc123',
      password: 'secret123',
      apiKey: 'key123',
      API_KEY: 'key456',
      refreshToken: 'refresh123',
      data: {
        token: 'nested_token',
        secret: 'nested_secret'
      }
    };

    const result = redactSensitiveData(input);

    expect(result.authorization).toBe('[REDACTED]');
    expect(result.Authorization).toBe('[REDACTED]');
    expect(result.cookie).toBe('[REDACTED]');
    expect(result.password).toBe('[REDACTED]');
    expect(result.apiKey).toBe('[REDACTED]');
    expect(result.API_KEY).toBe('[REDACTED]');
    expect(result.refreshToken).toBe('[REDACTED]');
    expect(result.data.token).toBe('[REDACTED]');
    expect(result.data.secret).toBe('[REDACTED]');
  });

  it('debe preservar campos no sensibles', () => {
    const input = {
      email: 'user@example.com',
      name: 'John Doe',
      id: 123,
      status: 'active'
    };

    const result = redactSensitiveData(input);

    expect(result.email).toBe('user@example.com');
    expect(result.name).toBe('John Doe');
    expect(result.id).toBe(123);
    expect(result.status).toBe('active');
  });

  it('debe manejar objetos anidados', () => {
    const input = {
      user: {
        email: 'user@example.com',
        password: 'secret123',
        profile: {
          name: 'John',
          token: 'token123'
        }
      }
    };

    const result = redactSensitiveData(input);

    expect(result.user.email).toBe('user@example.com');
    expect(result.user.password).toBe('[REDACTED]');
    expect(result.user.profile.name).toBe('John');
    expect(result.user.profile.token).toBe('[REDACTED]');
  });

  it('debe manejar arrays', () => {
    const input = {
      users: [
        { email: 'user1@example.com', password: 'pass1' },
        { email: 'user2@example.com', token: 'token2' }
      ]
    };

    const result = redactSensitiveData(input);

    expect(result.users[0].email).toBe('user1@example.com');
    expect(result.users[0].password).toBe('[REDACTED]');
    expect(result.users[1].email).toBe('user2@example.com');
    expect(result.users[1].token).toBe('[REDACTED]');
  });

  it('debe manejar valores null y undefined', () => {
    const input = {
      email: 'user@example.com',
      password: null,
      token: undefined,
      secret: ''
    };

    const result = redactSensitiveData(input);

    expect(result.email).toBe('user@example.com');
    expect(result.password).toBe('[REDACTED]');
    expect(result.token).toBe('[REDACTED]');
    expect(result.secret).toBe('[REDACTED]');
  });
});




















