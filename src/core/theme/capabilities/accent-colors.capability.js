/**
 * Accent Colors Capability
 * Colores de acento del sistema
 */

export default {
  capability_key: 'accent-colors',
  version: '1.0.0',
  category: 'base-ui',
  name: 'Accent Colors',
  description: 'Colores de acento: primary, secondary, success, warning, danger, info',
  tokens: [
    {
      key: '--ap-accent-primary',
      type: 'color',
      default: '#007bff',
      description: 'Color de acento principal',
      aliases: ['--accent-primary']
    },
    {
      key: '--ap-accent-secondary',
      type: 'color',
      default: '#6c757d',
      description: 'Color de acento secundario',
      aliases: ['--accent-secondary']
    },
    {
      key: '--ap-accent-success',
      type: 'color',
      default: '#28a745',
      description: 'Color de acento success',
      aliases: ['--accent-success']
    },
    {
      key: '--ap-accent-warning',
      type: 'color',
      default: '#ffc107',
      description: 'Color de acento warning',
      aliases: ['--accent-warning']
    },
    {
      key: '--ap-accent-danger',
      type: 'color',
      default: '#dc3545',
      description: 'Color de acento danger',
      aliases: ['--accent-danger']
    },
    {
      key: '--ap-accent-info',
      type: 'color',
      default: '#17a2b8',
      description: 'Color de acento info',
      aliases: ['--accent-info']
    }
  ],
  preview: null
};

