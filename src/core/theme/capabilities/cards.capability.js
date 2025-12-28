/**
 * Cards Capability
 * Estilos para tarjetas y paneles
 */

export default {
  capability_key: 'cards',
  version: '1.0.0',
  category: 'layout',
  name: 'Cards y Paneles',
  description: 'Estilos para tarjetas, paneles y contenedores',
  tokens: [
    {
      key: '--ap-card-bg',
      type: 'color',
      default: 'var(--ap-bg-surface, #ffffff)',
      description: 'Fondo de cards',
      aliases: ['--card-bg']
    },
    {
      key: '--ap-card-border',
      type: 'color',
      default: 'var(--ap-border-subtle, #e0e0e0)',
      description: 'Borde de cards',
      aliases: ['--card-border']
    },
    {
      key: '--ap-card-shadow',
      type: 'shadow',
      default: '0 2px 4px rgba(0,0,0,0.1)',
      description: 'Sombra de cards',
      aliases: ['--card-shadow']
    },
    {
      key: '--ap-card-padding',
      type: 'spacing',
      default: '20px',
      description: 'Padding de cards',
      aliases: ['--card-padding']
    },
    {
      key: '--ap-card-radius',
      type: 'size',
      default: '8px',
      description: 'Radio de borde de cards',
      aliases: ['--card-radius']
    }
  ],
  preview: null
};

